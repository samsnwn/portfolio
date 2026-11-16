import { loadNative } from './native';

export type Op = 'sa' | 'sb' | 'ss' | 'pa' | 'pb' | 'ra' | 'rb' | 'rr' | 'rra' | 'rrb' | 'rrr';

/** The index of each operation is its code in the C game API. */
export const OPS: readonly Op[] = ['sa', 'sb', 'ss', 'pa', 'pb', 'ra', 'rb', 'rr', 'rra', 'rrb', 'rrr'];

export const PUSH_SWAP_MODULE_URL = '/native/push-swap/pushswap.mjs';

/** The exports of the compiled push_swap game API (api/push_swap_api.c in the native repo). */
export interface PushSwapModule {
  _ps_load(nums: number, n: number): number;
  _ps_apply(op: number): number;
  _ps_can(op: number): number;
  _ps_size(which: number): number;
  _ps_copy(which: number, out: number): void;
  _ps_is_sorted(): number;
  _ps_solve(nums: number, n: number): number;
  _malloc(bytes: number): number;
  _free(ptr: number): void;
  HEAP32: Int32Array;
}

export interface Engine {
  /** Starts a new game: `nums` becomes stack a (top first), stack b is empty. */
  load(nums: number[]): void;
  /** Runs one original operation. Returns false, changing nothing, if it cannot apply. */
  apply(op: Op): boolean;
  can(op: Op): boolean;
  stacks(): { a: number[]; b: number[] };
  isSorted(): boolean;
  /** Runs the original sorting algorithm on `nums` and returns the operations it printed. */
  solve(nums: number[]): Op[];
}

/** `n` unique integers from 1 to n*10 that are not already in sorted order. */
export function randomStack(n: number, rand: () => number = Math.random): number[] {
  for (;;) {
    const picked = new Set<number>();
    while (picked.size < n) picked.add(1 + Math.floor(rand() * n * 10));
    const stack = [...picked];
    if (n < 2 || stack.some((v, i) => i > 0 && stack[i - 1] > v)) return stack;
  }
}

/** `takeOutput` returns, and clears, the lines the module printed since the last call. */
export function createEngine(mod: PushSwapModule, takeOutput: () => string[]): Engine {
  function withInts<T>(nums: number[], fn: (ptr: number) => T): T {
    const ptr = mod._malloc(Math.max(nums.length, 1) * 4);
    try {
      mod.HEAP32.set(nums, ptr >> 2);
      return fn(ptr);
    } finally {
      mod._free(ptr);
    }
  }

  function copy(which: 0 | 1): number[] {
    const n = mod._ps_size(which);
    if (n === 0) return [];
    const ptr = mod._malloc(n * 4);
    try {
      mod._ps_copy(which, ptr);
      return Array.from(mod.HEAP32.subarray(ptr >> 2, (ptr >> 2) + n));
    } finally {
      mod._free(ptr);
    }
  }

  return {
    load(nums) {
      withInts(nums, (ptr) => mod._ps_load(ptr, nums.length));
      takeOutput();
    },
    apply(op) {
      const applied = mod._ps_apply(OPS.indexOf(op)) === 1;
      takeOutput(); // the original operation prints its own name; the game does not need it
      return applied;
    },
    can: (op) => mod._ps_can(OPS.indexOf(op)) === 1,
    stacks: () => ({ a: copy(0), b: copy(1) }),
    isSorted: () => mod._ps_is_sorted() === 1,
    solve(nums) {
      takeOutput();
      withInts(nums, (ptr) => mod._ps_solve(ptr, nums.length));
      return takeOutput().filter((line): line is Op => (OPS as readonly string[]).includes(line));
    },
  };
}

/** Loads the compiled push_swap and wraps it. */
export async function loadEngine(url: string = PUSH_SWAP_MODULE_URL): Promise<Engine> {
  let lines: string[] = [];
  const mod = await loadNative<PushSwapModule>(url, { print: (line) => lines.push(line) });
  return createEngine(mod, () => {
    const taken = lines;
    lines = [];
    return taken;
  });
}
