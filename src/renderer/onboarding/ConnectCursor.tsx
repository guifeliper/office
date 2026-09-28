import { useEffect, useState } from 'react';

export type SetupPreview = {
  installed: boolean;
  hooks: string[];
  retainedFields: string[];
  commandPath: string;
  additiveChange: string;
  hooksJsonPath: string;
};

interface ConnectCursorProps {
  onConnected: () => void;
}

export function ConnectCursor({ onConnected }: ConnectCursorProps) {
  const [preview, setPreview] = useState<SetupPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void window.office.getSetupPreview().then((raw) => {
      const p = raw as SetupPreview;
      setPreview(p);
      if (p.installed) {
        onConnected();
      }
    });
  }, [onConnected]);

  if (!preview || preview.installed) {
    return null;
  }

  return (
    <section className="connect" data-testid="connect-cursor" aria-labelledby="connect-title">
      <h2 id="connect-title">Connect local Cursor</h2>
      <p>
        Office observes local Cursor IDE and CLI sessions only. Activity while this app is closed is
        not reconstructed. Cloud Agents are unsupported. The observer is viewer-only and always fails
        open.
      </p>

      <h3>Hooks to install</h3>
      <ul data-testid="preview-hooks">
        {preview.hooks.map((hook) => (
          <li key={hook}>
            <code>{hook}</code>
          </li>
        ))}
      </ul>

      <h3>Fields retained</h3>
      <ul data-testid="preview-fields">
        {preview.retainedFields.map((field) => (
          <li key={field}>
            <code>{field}</code>
          </li>
        ))}
      </ul>

      <h3>Command path</h3>
      <p data-testid="preview-command">
        <code>{preview.commandPath}</code>
      </p>

      <h3>Additive configuration change</h3>
      <pre className="connect__diff" data-testid="preview-change">
        {preview.additiveChange}
      </pre>
      <p className="connect__path">
        Target: <code>{preview.hooksJsonPath}</code>
      </p>

      {error ? (
        <p className="connect__error" role="alert">
          {error} Cursor configuration was left unchanged.
        </p>
      ) : null}

      <div className="connect__actions">
        <button
          type="button"
          data-testid="confirm-install"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            void window.office.installHooks().then((result) => {
              setBusy(false);
              const r = result as { ok: boolean; error?: string };
              if (r.ok) {
                onConnected();
              } else {
                setError(r.error ?? 'Install failed');
              }
            });
          }}
        >
          Confirm and install observer
        </button>
      </div>
    </section>
  );
}
