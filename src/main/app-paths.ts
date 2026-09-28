import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';

export function getUserDataDir(): string {
  if (process.env.CURSOR_OFFICE_USER_DATA) {
    fs.mkdirSync(process.env.CURSOR_OFFICE_USER_DATA, { recursive: true, mode: 0o700 });
    return process.env.CURSOR_OFFICE_USER_DATA;
  }
  return app.getPath('userData');
}

export function getHooksJsonPath(): string {
  if (process.env.CURSOR_OFFICE_HOOKS_PATH) {
    return process.env.CURSOR_OFFICE_HOOKS_PATH;
  }
  return path.join(os.homedir(), '.cursor', 'hooks.json');
}

export function getWrapperPath(): string {
  if (process.env.CURSOR_OFFICE_WRAPPER_PATH) {
    return process.env.CURSOR_OFFICE_WRAPPER_PATH;
  }
  // Packaged: extraResource copies ./resources → process.resourcesPath/resources
  // Dev: project resources/
  const candidates = [
    path.join(process.resourcesPath, 'resources', 'cursor-hook.sh'),
    path.join(process.resourcesPath, 'cursor-hook.sh'),
    path.join(app.getAppPath(), 'resources', 'cursor-hook.sh'),
    path.resolve(__dirname, '../../resources/cursor-hook.sh'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[candidates.length - 1]!;
}

export function getDatabasePath(): string {
  return path.join(getUserDataDir(), 'office.sqlite');
}
