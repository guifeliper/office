import type { OfficeProjection } from '../../domain/office-reducer';
import { toOfficeViewModel } from './projection';

export type LatestOfficeProps = {
  projection: OfficeProjection;
  connected: boolean;
};

/** Pure helper used by mount/resize handlers — always read from latest, never a stale closure. */
export function viewFromLatest(
  latest: LatestOfficeProps,
  width: number,
  height: number,
) {
  return toOfficeViewModel(latest.projection, {
    connected: latest.connected,
    width,
    height,
  });
}
