import { useCallback, useEffect, useState } from 'react';
import type { OfficeProjection } from '../domain/office-reducer';
import { OfficeCanvas } from './office/OfficeCanvas';
import { ConnectCursor } from './onboarding/ConnectCursor';
import { IntegrationSettings } from './settings/IntegrationSettings';
import { ObservationStatus } from './status/ObservationStatus';

type ShellInfo = {
  productName: string;
  viewerOnly: boolean;
  platform: string;
  version: string;
};

const EMPTY_PROJECTION: OfficeProjection = {
  consultants: [],
  collaborators: [],
};

export function App() {
  const [shell, setShell] = useState<ShellInfo | null>(null);
  const [projection, setProjection] = useState<OfficeProjection>(EMPTY_PROJECTION);
  const [connected, setConnected] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [nodeLeaked, setNodeLeaked] = useState(false);

  const markConnected = useCallback(() => {
    setOnboarded(true);
    setConnected(true);
    setRefreshToken((n) => n + 1);
  }, []);

  useEffect(() => {
    const hasRequire = typeof window.require !== 'undefined';
    const hasProcess = typeof window.process !== 'undefined';
    setNodeLeaked(hasRequire || hasProcess);

    void window.office.getShellInfo().then((info) => {
      setShell(info as ShellInfo);
    });

    void window.office.getSetupPreview().then((raw) => {
      const preview = raw as { installed?: boolean };
      if (preview.installed) {
        setOnboarded(true);
        setConnected(true);
      }
    });

    void window.office.getProjection().then((raw) => {
      const p = raw as OfficeProjection & { connected?: boolean };
      setProjection({
        consultants: p.consultants ?? [],
        collaborators: p.collaborators ?? [],
      });
      setConnected(Boolean(p.connected));
    });

    const unsubscribe = window.office.onProjection((raw) => {
      const p = raw as OfficeProjection & { connected?: boolean };
      setProjection({
        consultants: p.consultants ?? [],
        collaborators: p.collaborators ?? [],
      });
      if (typeof p.connected === 'boolean') {
        setConnected(p.connected);
      }
      setRefreshToken((n) => n + 1);
    });

    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === ',') {
        event.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__header-row">
          <div>
            <h1 className="shell__brand">{shell?.productName ?? 'Cursor Office'}</h1>
            <p className="shell__tagline">Viewer-only local observation</p>
          </div>
          <button
            type="button"
            className="shell__settings"
            data-testid="open-settings"
            onClick={() => setSettingsOpen(true)}
          >
            Integration
          </button>
        </div>
        <ObservationStatus refreshToken={refreshToken} />
      </header>
      <main className="shell__stage" data-testid="office-stage">
        {!onboarded ? <ConnectCursor onConnected={markConnected} /> : null}
        <OfficeCanvas projection={projection} connected={connected && onboarded} />
        {shell ? (
          <p className="shell__meta" data-testid="shell-meta">
            v{shell.version} · {shell.platform}
            {shell.viewerOnly ? ' · viewer-only' : ''}
          </p>
        ) : null}
        {nodeLeaked ? (
          <p className="shell__error" data-testid="node-leak">
            Security error: Node globals exposed in renderer
          </p>
        ) : (
          <p className="shell__ok" data-testid="node-isolated" hidden>
            isolated
          </p>
        )}
      </main>
      <IntegrationSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onUninstalled={() => {
          setOnboarded(false);
          setConnected(false);
          setProjection(EMPTY_PROJECTION);
          setRefreshToken((n) => n + 1);
        }}
      />
    </div>
  );
}
