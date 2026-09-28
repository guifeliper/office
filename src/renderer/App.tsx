import { useEffect, useState } from 'react';
import type { OfficeProjection } from '../domain/office-reducer';
import { OfficeCanvas } from './office/OfficeCanvas';

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
  const [nodeLeaked, setNodeLeaked] = useState(false);

  useEffect(() => {
    const hasRequire = typeof window.require !== 'undefined';
    const hasProcess = typeof window.process !== 'undefined';
    setNodeLeaked(hasRequire || hasProcess);

    void window.office.getShellInfo().then((info) => {
      setShell(info as ShellInfo);
    });

    void window.office.getProjection().then((raw) => {
      const p = raw as OfficeProjection & { connected?: boolean };
      setProjection({
        consultants: p.consultants ?? [],
        collaborators: p.collaborators ?? [],
      });
      setConnected(Boolean(p.connected));
    });

    void window.office.getHealth().then((health) => {
      const status = (health as { status?: string }).status;
      setConnected(status === 'connected' || status === 'waiting');
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
    });

    return unsubscribe;
  }, []);

  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="shell__brand">{shell?.productName ?? 'Cursor Office'}</h1>
        <p className="shell__tagline">Viewer-only local observation</p>
      </header>
      <main className="shell__stage" data-testid="office-stage">
        <OfficeCanvas projection={projection} connected={connected} />
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
    </div>
  );
}
