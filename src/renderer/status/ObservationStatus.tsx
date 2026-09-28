import { useEffect, useState } from 'react';

export type HealthSnapshot = {
  status: string;
  detail: string;
  installed: boolean;
  observerListening: boolean;
};

interface ObservationStatusProps {
  refreshToken: number;
}

export function ObservationStatus({ refreshToken }: ObservationStatusProps) {
  const [health, setHealth] = useState<HealthSnapshot | null>(null);

  useEffect(() => {
    void window.office.getHealth().then((raw) => setHealth(raw as HealthSnapshot));
  }, [refreshToken]);

  if (!health) {
    return (
      <div className="status-strip" data-testid="observation-status" aria-live="polite">
        Checking observer…
      </div>
    );
  }

  return (
    <div
      className={`status-strip status-strip--${health.status}`}
      data-testid="observation-status"
      aria-live="polite"
    >
      <span className="status-strip__label">{health.status}</span>
      <span className="status-strip__detail">{health.detail}</span>
    </div>
  );
}
