import { describe, expect, it } from 'vitest';
import { DollCache } from '../../src/renderer/office/doll-cache';

describe('doll cache', () => {
  it('builds one sheet per pump and destroys a look only after the last claim', () => {
    const cache = new DollCache<string>();
    const destroyed: string[] = [];
    const drop = (value: string) => destroyed.push(value);

    cache.claim('a');
    cache.claim('a');
    cache.claim('b');
    cache.claim('c');

    expect(cache.pump((key) => key)).toBe(true);
    expect(cache.peek('a')).toBe('a');
    expect(cache.peek('b')).toBeNull();

    expect(cache.pump((key) => key)).toBe(true);
    expect(cache.peek('b')).toBe('b');
    expect(cache.peek('c')).toBeNull();

    cache.release('a', drop);
    expect(cache.peek('a')).toBe('a');
    expect(destroyed).toEqual([]);

    cache.release('a', drop);
    expect(cache.peek('a')).toBeNull();
    expect(destroyed).toEqual(['a']);

    cache.destroyAll(drop);
    expect(destroyed).toEqual(['a', 'b']);
    expect(cache.peek('c')).toBeNull();
    expect(cache.size).toBe(0);
    expect(cache.pump(() => 'later')).toBe(false);
  });
});
