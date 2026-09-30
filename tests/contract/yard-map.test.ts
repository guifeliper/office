import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseYardMap } from '../../src/renderer/office/yard-map';
import { PROP_SPECS, PROPS, YARD_MAP } from '../../src/renderer/office/world-layout';

const file = new URL('../../src/renderer/office/yard-map.yaml', import.meta.url);
const text = readFileSync(file, 'utf8');
const kinds = Object.keys(PROP_SPECS);

describe('yard map contract', () => {
  it('loads the checked-in document as the layout the renderer uses', () => {
    const parsed = parseYardMap(text, kinds);
    expect(parsed).toEqual(YARD_MAP);
    expect(PROPS.some((prop) => prop.kind === 'gateLeft' || prop.kind === 'gateRight' || prop.kind === 'gatehouse')).toBe(false);
    expect(PROPS.some((prop) => prop.kind === 'bloom')).toBe(false);
    expect(PROPS.some((prop) => prop.kind === 'flower')).toBe(true);
    expect(PROPS.some((prop) => prop.kind === 'mushroom')).toBe(true);
  });

  it('rejects a missing version, a bad kind, and a short path', () => {
    expect(() => parseYardMap(text.replace('version: 1', 'version: 9'), kinds)).toThrow(/version/);
    expect(() => parseYardMap(text.replace('kind: pier', 'kind: not-a-prop'), kinds)).toThrow(/kind/);
    expect(() => parseYardMap(text.replace(/- \[(\d+), (\d+), (\d+), (\d+)\]/, '- [$1, $2]'), kinds)).toThrow(/path/);
  });
});
