import type { Clock } from '../domain/lifecycle';

export const systemClock: Clock = {
  now: () => Date.now(),
};
