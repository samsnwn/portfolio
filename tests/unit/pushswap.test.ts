import { describe, it, expect, beforeAll } from 'vitest';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { OPS, randomStack, loadEngine, type Engine, type Op } from '../../src/lib/pushswap';

// The real compiled push_swap, as the browser gets it.
const moduleUrl = pathToFileURL(join(process.cwd(), 'public/native/push-swap/pushswap.mjs')).href;

function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('randomStack', () => {
  it('gives unique ints in range', () => {
    const s = randomStack(8, seeded(1));
    expect(s).toHaveLength(8);
    expect(new Set(s).size).toBe(8);
    expect(s.every((v) => Number.isInteger(v) && v >= 1 && v <= 80)).toBe(true);
  });

  it('is deterministic for a seeded generator', () => {
    expect(randomStack(8, seeded(5))).toEqual(randomStack(8, seeded(5)));
    expect(randomStack(8, seeded(5))).not.toEqual(randomStack(8, seeded(6)));
  });

  it('is never already sorted when it has more than one number', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = randomStack(3, seeded(seed));
      expect(s.every((v, i) => i === 0 || s[i - 1] < v)).toBe(false);
    }
  });
});

describe('engine (original C compiled to wasm)', () => {
  let engine: Engine;
  beforeAll(async () => {
    // Node imports the module directly; the browser uses importAtRuntime (see src/lib/native.ts).
    engine = await loadEngine(moduleUrl, (url) => import(/* @vite-ignore */ url));
  });

  it('lists the 11 operations in code order', () => {
    expect(OPS).toEqual(['sa', 'sb', 'ss', 'pa', 'pb', 'ra', 'rb', 'rr', 'rra', 'rrb', 'rrr']);
  });

  it('applies original ops', () => {
    engine.load([2, 1, 3]);
    expect(engine.isSorted()).toBe(false);
    expect(engine.apply('sa')).toBe(true);
    expect(engine.stacks()).toEqual({ a: [1, 2, 3], b: [] });
    expect(engine.isSorted()).toBe(true);
  });

  it('refuses impossible ops', () => {
    engine.load([1]);
    expect(engine.can('pa')).toBe(false);
    expect(engine.apply('pa')).toBe(false);
    expect(engine.can('pb')).toBe(true);
    expect(engine.stacks()).toEqual({ a: [1], b: [] });
  });

  it('solve sorts and leaves the game untouched', () => {
    const nums = [9, 3, 7, 1, 5];
    engine.load([5, 4]);
    const ops = engine.solve(nums);
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.every((op: Op) => OPS.includes(op))).toBe(true);
    expect(engine.stacks()).toEqual({ a: [5, 4], b: [] });

    engine.load(nums);
    for (const op of ops) expect(engine.apply(op)).toBe(true);
    expect(engine.isSorted()).toBe(true);
  });

  it('applying moves does not leak into a later solve', () => {
    engine.load([3, 2, 1]);
    engine.apply('sa');
    engine.apply('pb');
    const ops = engine.solve([2, 1]);
    expect(ops).toEqual(['sa']);
  });
});
