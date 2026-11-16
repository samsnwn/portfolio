import { describe, it, expect } from 'vitest';
import { readPrefs, writePrefs, DEFAULT_PREFS } from '../../src/lib/prefs';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => { data.delete(k); },
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}

const throwing: Storage = {
  length: 0,
  clear() { throw new Error('blocked'); },
  getItem() { throw new Error('blocked'); },
  key() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
};

describe('prefs', () => {
  it('defaults to sound off and effects on', () => {
    expect(DEFAULT_PREFS).toEqual({ sound: false, fx: true });
    expect(readPrefs(null)).toEqual({ sound: false, fx: true });
  });

  it('returns defaults when storage throws on read', () => {
    expect(readPrefs(throwing)).toEqual(DEFAULT_PREFS);
  });

  it('returns defaults when the stored value is not JSON', () => {
    expect(readPrefs(memoryStorage({ 'portfolio.prefs': 'not json' }))).toEqual(DEFAULT_PREFS);
  });

  it('round-trips written prefs', () => {
    const s = memoryStorage();
    writePrefs({ sound: true, fx: false }, s);
    expect(readPrefs(s)).toEqual({ sound: true, fx: false });
  });

  it('does not throw when storage throws on write', () => {
    expect(() => writePrefs({ sound: true, fx: false }, throwing)).not.toThrow();
  });
});
