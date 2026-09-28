import fs from 'node:fs';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import type { OfficeProjection } from '../domain/office-reducer';
import { previewInstall, installHooks, uninstallHooks } from './cursor/hook-installer';
import {
  deleteSecrets,
  ensureInstallToken,
  portPath,
  tokenPath,
  writePortFile,
  writeTokenFile,
} from './cursor/token';
import { startIngestionServer, type IngestionServer } from './ingestion/server';
import {
  getDatabasePath,
  getHooksJsonPath,
  getUserDataDir,
  getWrapperPath,
} from './app-paths';
import { closeDatabase, destroyDatabaseFiles, openDatabase, type OfficeDatabase } from './storage/database';
import { OfficeStore } from './storage/office-store';
import { systemClock } from './system-clock';
import { SUBSCRIBED_HOOKS } from './cursor/hook-config';

export type HealthStatus =
  | 'disconnected'
  | 'waiting'
  | 'connected'
  | 'observed'
  | 'inferred'
  | 'stale'
  | 'ambient';

export interface HealthSnapshot {
  status: HealthStatus;
  detail: string;
  installed: boolean;
  observerListening: boolean;
}

export class OfficeRuntime {
  private db: OfficeDatabase | null = null;
  private store: OfficeStore | null = null;
  private server: IngestionServer | null = null;
  private windows: Set<BrowserWindow> = new Set();
  private installed = false;
  private token = '';
  private lastProjection: OfficeProjection = { consultants: [], collaborators: [] };

  async start(): Promise<void> {
    const userData = getUserDataDir();
    fs.mkdirSync(userData, { recursive: true, mode: 0o700 });
    this.token = ensureInstallToken(userData);
    this.db = openDatabase(getDatabasePath());
    this.store = new OfficeStore(this.db, systemClock);
    this.lastProjection = this.store.restore();

    this.server = await startIngestionServer({
      token: this.token,
      store: this.store,
      clock: systemClock,
      onProjection: (projection) => {
        this.lastProjection = projection;
        this.broadcastProjection();
      },
    });
    writePortFile(userData, this.server.port);

    // Export paths for the wrapper via files only (token never in argv).
    process.env.CURSOR_OFFICE_TOKEN_FILE = tokenPath(userData);
    process.env.CURSOR_OFFICE_PORT_FILE = portPath(userData);

    this.installed = detectInstalled(getHooksJsonPath());
  }

  attachWindow(win: BrowserWindow): void {
    this.windows.add(win);
    win.on('closed', () => this.windows.delete(win));
  }

  getProjectionPayload() {
    const projection = this.store?.getProjection() ?? this.lastProjection;
    this.lastProjection = projection;
    return {
      ...projection,
      connected: this.installed && this.server !== null,
      waitingForActivity: this.installed && projection.consultants.length === 0,
    };
  }

  getSetupPreview() {
    const preview = previewInstall({
      hooksJsonPath: getHooksJsonPath(),
      wrapperPath: getWrapperPath(),
      userDataDir: getUserDataDir(),
    });
    this.installed = preview.installed;
    return preview;
  }

  installObserver() {
    const userData = getUserDataDir();
    if (!this.token) {
      this.token = ensureInstallToken(userData);
    } else {
      writeTokenFile(userData, this.token);
    }
    if (this.server) {
      writePortFile(userData, this.server.port);
    }
    const result = installHooks({
      hooksJsonPath: getHooksJsonPath(),
      wrapperPath: getWrapperPath(),
      userDataDir: userData,
    });
    if (result.ok) {
      this.installed = true;
      this.broadcastProjection();
    }
    return result;
  }

  getHealth(): HealthSnapshot {
    const projection = this.lastProjection;
    const observerListening = this.server !== null;
    if (!this.installed) {
      return {
        status: 'disconnected',
        detail: 'Cursor observer not installed',
        installed: false,
        observerListening,
      };
    }
    if (projection.consultants.length === 0) {
      return {
        status: 'waiting',
        detail: 'Waiting for Cursor activity',
        installed: true,
        observerListening,
      };
    }
    const hasStale = projection.consultants.some((c) => c.workState === 'stale');
    const hasActive = projection.consultants.some((c) => c.workState === 'active');
    const hasIdle = projection.consultants.some((c) => c.workState === 'idle');
    if (hasStale) {
      return {
        status: 'stale',
        detail: 'Retained consultant with inferred liveness',
        installed: true,
        observerListening,
      };
    }
    if (hasActive) {
      return {
        status: 'observed',
        detail: 'Observed Cursor work in progress',
        installed: true,
        observerListening,
      };
    }
    if (hasIdle) {
      return {
        status: 'ambient',
        detail: 'Consultants idle; ambient motion only',
        installed: true,
        observerListening,
      };
    }
    return {
      status: 'connected',
      detail: 'Observer ready',
      installed: true,
      observerListening,
    };
  }

  uninstallIntegration() {
    const hooksResult = uninstallHooks({
      hooksJsonPath: getHooksJsonPath(),
      wrapperPath: getWrapperPath(),
      userDataDir: getUserDataDir(),
    });
    if (!hooksResult.ok) {
      return hooksResult;
    }

    const userData = getUserDataDir();
    if (this.db) {
      closeDatabase(this.db);
      this.db = null;
    }
    destroyDatabaseFiles(getDatabasePath());
    deleteSecrets(userData);

    // Owned wrapper copy under userData if present
    const localWrapper = path.join(userData, 'cursor-hook.sh');
    try {
      fs.rmSync(localWrapper, { force: true });
    } catch {
      // ignore
    }

    this.installed = false;
    // Re-open empty DB for continued session after teardown.
    // Token remains deleted until the next install/start cycle (privacy teardown).
    this.db = openDatabase(getDatabasePath());
    this.store = new OfficeStore(this.db, systemClock);
    this.lastProjection = { consultants: [], collaborators: [] };
    this.broadcastProjection();
    return { ok: true as const };
  }

  async stop(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
    if (this.db) {
      closeDatabase(this.db);
      this.db = null;
    }
  }

  private broadcastProjection(): void {
    const payload = this.getProjectionPayload();
    for (const win of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('office:projection-updated', payload);
      }
    }
  }
}

function detectInstalled(hooksPath: string): boolean {
  try {
    const raw = fs.readFileSync(hooksPath, 'utf8');
    return raw.includes('cursor-office-observer');
  } catch {
    return false;
  }
}

export function subscribedHookNames(): string[] {
  return [...SUBSCRIBED_HOOKS];
}
