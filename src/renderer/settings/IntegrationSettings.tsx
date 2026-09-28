interface IntegrationSettingsProps {
  open: boolean;
  onClose: () => void;
  onUninstalled: () => void;
}

export function IntegrationSettings({ open, onClose, onUninstalled }: IntegrationSettingsProps) {
  if (!open) return null;

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      data-testid="integration-settings"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div className="modal__panel">
        <h2 id="settings-title">Integration</h2>
        <p>
          Uninstall removes only Office-owned hook entries, the mode-0600 backup and token, and the
          complete SQLite directory including WAL/SHM. Unrelated Cursor hooks are preserved.
        </p>
        <p>
          Local-only observation: closed-app gaps remain unobserved. Cloud Agents are excluded.
        </p>
        <div className="modal__actions">
          <button type="button" data-testid="close-settings" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="danger"
            data-testid="confirm-uninstall"
            onClick={() => {
              void window.office.uninstall().then((result) => {
                const r = result as { ok: boolean; error?: string };
                if (r.ok) {
                  onUninstalled();
                  onClose();
                }
              });
            }}
          >
            Uninstall Office integration
          </button>
        </div>
      </div>
    </div>
  );
}
