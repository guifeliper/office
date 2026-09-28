import { useEffect, useState } from 'react';

type ShellInfo = {
  productName: string;
  viewerOnly: boolean;
  platform: string;
  version: string;
};

export function App() {
  const [shell, setShell] = useState<ShellInfo | null>(null);
  const [nodeLeaked, setNodeLeaked] = useState(false);

  useEffect(() => {
    const hasRequire = typeof window.require !== 'undefined';
    const hasProcess = typeof window.process !== 'undefined';
    setNodeLeaked(hasRequire || hasProcess);

    void window.office.getShellInfo().then((info) => {
      setShell(info as ShellInfo);
    });
  }, []);

  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="shell__brand">{shell?.productName ?? 'Cursor Office'}</h1>
        <p className="shell__tagline">Viewer-only local observation</p>
      </header>
      <main className="shell__stage" data-testid="office-stage">
        <p className="shell__waiting">Waiting for Cursor activity</p>
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
