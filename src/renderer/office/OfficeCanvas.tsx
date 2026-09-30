import { useEffect, useRef } from 'react';
import type { OfficeProjection } from '../../domain/office-reducer';
import { rosterRows } from './projection';
import { OfficeScene } from './scene';
import { viewFromLatest, type LatestOfficeProps } from './view-from-latest';

export interface OfficeCanvasProps {
  projection: OfficeProjection;
  connected: boolean;
}

export function OfficeCanvas({ projection, connected }: OfficeCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<OfficeScene | null>(null);
  const latestRef = useRef<LatestOfficeProps>({ projection, connected });
  latestRef.current = { projection, connected };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new OfficeScene();
    sceneRef.current = scene;
    let cancelled = false;

    void scene.mount(host).then(() => {
      if (cancelled) {
        scene.destroy();
        return;
      }
      scene.setView(
        viewFromLatest(latestRef.current, host.clientWidth, host.clientHeight),
      );
    });

    const onResize = () => {
      if (!hostRef.current || !sceneRef.current) return;
      const w = hostRef.current.clientWidth;
      const h = hostRef.current.clientHeight;
      sceneRef.current.resize(w, h);
      sceneRef.current.setView(viewFromLatest(latestRef.current, w, h));
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      scene.destroy();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const scene = sceneRef.current;
    if (!host || !scene) return;
    scene.setView(
      viewFromLatest(
        { projection, connected },
        host.clientWidth || 1280,
        host.clientHeight || 800,
      ),
    );
  }, [projection, connected]);

  return (
    <div className="office-frame">
      <div
        ref={hostRef}
        className="office-canvas"
        data-testid="office-canvas"
        role="img"
        aria-label={
          connected
            ? projection.consultants.length === 0
              ? 'Office waiting for Cursor activity'
              : `Office with ${projection.consultants.length} consultants`
            : 'Office disconnected from Cursor observer'
        }
      />
      {(projection.consultants.length > 0 || projection.collaborators.length > 0) && (
        <ol className="office-roster" data-testid="office-roster">
          {rosterRows(projection).map((row) => (
            <li key={row.id}>
              <span className="roster-row">
                <span className={`roster-mark is-${row.badge}`} />
                {row.label}
              </span>
              {row.children.length > 0 && (
                <ol className="roster-children">
                  {row.children.map((child) => (
                    <li key={child.id}>
                      <span className="roster-row">
                        <span className={`roster-mark is-${child.badge}`} />
                        {child.label}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        className="office-fit"
        data-testid="fit-world"
        title="Fit world (0)"
        onClick={() => sceneRef.current?.fit()}
      >
        Fit world
      </button>
    </div>
  );
}
