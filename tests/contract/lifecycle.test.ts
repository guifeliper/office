import { describe, expect, it } from 'vitest';
import {
  collaboratorFallbackFrom,
  deriveAccentHue,
  deriveLabelSuffix,
  leaseFrom,
} from '../../src/domain/lifecycle';
import { COLLABORATOR_FALLBACK_MS, CONSULTANT_LEASE_MS } from '../../src/domain/events';

describe('lifecycle helpers', () => {
  it('derives a stable 4-character label suffix and accent from identity', () => {
    const a = deriveLabelSuffix('cursor', 'conv-1');
    const b = deriveLabelSuffix('cursor', 'conv-1');
    const c = deriveLabelSuffix('cursor', 'conv-2');
    expect(a).toHaveLength(4);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(deriveAccentHue('cursor', 'conv-1')).toBe(deriveAccentHue('cursor', 'conv-1'));
    expect(deriveAccentHue('cursor', 'conv-1')).not.toBe(deriveAccentHue('cursor', 'conv-2'));
  });

  it('computes fixed lease and collaborator fallback windows', () => {
    const t = 1_000;
    expect(leaseFrom(t) - t).toBe(CONSULTANT_LEASE_MS);
    expect(collaboratorFallbackFrom(t) - t).toBe(COLLABORATOR_FALLBACK_MS);
  });
});
