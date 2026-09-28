import { useEffect, useRef } from 'react';
import type { OfficeProjection } from '../../domain/office-reducer';
import { toOfficeViewModel } from './projection';
import { OfficeScene } from './scene';

export interface OfficeCanvasProps {
  projection: OfficeProjection;
  connected: boolean;
}

export function OfficeCanvas({ projection, connected }: OfficeCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<OfficeScene | null>(null);

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
      const view = toOfficeViewModel(projection, {
        connected,
        width: host.clientWidth,
        height: host.clientHeight,
      });
      scene.setView(view);
    });

    const onResize = () => {
      if (!hostRef.current || !sceneRef.current) return;
      sceneRef.current.resize(hostRef.current.clientWidth, hostRef.current.clientHeight);
      sceneRef.current.setView(
        toOfficeViewModel(projection, {
          connected,
          width: hostRef.current.clientWidth,
          height: hostRef.current.clientHeight,
        }),
      );
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      scene.destroy();
      sceneRef.current = null;
    };
    // Mount once; projection updates flow through the second effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const scene = sceneRef.current;
    if (!host || !scene) return;
    scene.setView(
      toOfficeViewModel(projection, {
        connected,
        width: host.clientWidth || 1280,
        height: host.clientHeight || 800,
      }),
    );
  }, [projection, connected]);

  return (
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
  );
}
