import { useCallback, useEffect, useMemo, useState } from 'react';
import GameShell from './GameShell';
import { loadEngine, randomStack, PUSH_SWAP_MODULE_URL, type Engine, type Op } from '../../lib/pushswap';

const OP_GROUPS: { title: string; ops: { op: Op; does: string }[] }[] = [
  {
    title: 'Swap',
    ops: [
      { op: 'sa', does: 'swap top two of A' },
      { op: 'sb', does: 'swap top two of B' },
      { op: 'ss', does: 'both swaps' },
    ],
  },
  {
    title: 'Push',
    ops: [
      { op: 'pa', does: 'top of B to A' },
      { op: 'pb', does: 'top of A to B' },
    ],
  },
  {
    title: 'Rotate',
    ops: [
      { op: 'ra', does: 'top of A to bottom' },
      { op: 'rb', does: 'top of B to bottom' },
      { op: 'rr', does: 'both rotations' },
    ],
  },
  {
    title: 'Reverse rotate',
    ops: [
      { op: 'rra', does: 'bottom of A to top' },
      { op: 'rrb', does: 'bottom of B to top' },
      { op: 'rrr', does: 'both reverse rotations' },
    ],
  },
];

const SIZES = [5, 8] as const;
const REPLAY_STEP_MS = 250;

/** Small deterministic generator, used when the URL carries ?seed= (for reproducible stacks). */
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Replay = { index: number; playing: boolean };

function Board({ engine }: { engine: Engine }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const seedParam = params.get('seed');
  const rand = useMemo(() => (seedParam === null ? Math.random : seeded(Number(seedParam) || 0)), [seedParam]);

  const [size, setSize] = useState<number>(() => {
    const requested = Number(params.get('size'));
    return (SIZES as readonly number[]).includes(requested) ? requested : SIZES[0];
  });
  const [initial, setInitial] = useState<number[]>([]);
  const [algoOps, setAlgoOps] = useState<Op[]>([]);
  const [stacks, setStacks] = useState<{ a: number[]; b: number[] }>({ a: [], b: [] });
  const [moves, setMoves] = useState(0);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [stress, setStress] = useState<string>('');

  const sync = useCallback(() => setStacks(engine.stacks()), [engine]);

  const newGame = useCallback(
    (n: number) => {
      const nums = randomStack(n, rand);
      setSize(n);
      setInitial(nums);
      setAlgoOps(engine.solve(nums));
      engine.load(nums);
      setMoves(0);
      setReplay(null);
      sync();
    },
    [engine, rand, sync],
  );

  // First stack, once the compiled code is ready.
  useEffect(() => {
    newGame(size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  const startOver = () => {
    engine.load(initial);
    setMoves(0);
    setReplay(null);
    sync();
  };

  const move = (op: Op) => {
    if (replay || !engine.apply(op)) return;
    setMoves((m) => m + 1);
    sync();
  };

  /** Puts the board in the state after the algorithm's first `index` moves. */
  const showStep = (index: number, playing = false) => {
    engine.load(initial);
    for (let i = 0; i < index; i++) engine.apply(algoOps[i]);
    sync();
    setReplay({ index, playing });
  };

  const watch = () => {
    setMoves(0);
    if (prefersReducedMotion()) showStep(algoOps.length);
    else showStep(0, algoOps.length > 0);
  };

  useEffect(() => {
    if (!replay?.playing) return;
    const timer = window.setTimeout(() => {
      engine.apply(algoOps[replay.index]);
      sync();
      const index = replay.index + 1;
      setReplay({ index, playing: index < algoOps.length });
    }, REPLAY_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [replay, algoOps, engine, sync]);

  const runStress = (n: number) => {
    const nums = randomStack(n, rand);
    const count = engine.solve(nums).length;
    setStress(`${n} numbers sorted in ${count.toLocaleString('en-US')} moves.`);
  };

  const cleared = !replay && initial.length > 0 && engine.isSorted();
  const rank = useMemo(() => {
    const sorted = [...initial].sort((x, y) => x - y);
    return new Map(sorted.map((v, i) => [v, i]));
  }, [initial]);
  const width = (v: number) => `${32 + (68 * (rank.get(v) ?? 0)) / Math.max(initial.length - 1, 1)}%`;

  let status = 'Sort stack A from smallest (top) to largest, leaving B empty.';
  if (replay) status = replay.index === algoOps.length ? 'My algorithm finished.' : 'My algorithm is sorting…';
  if (cleared) status = `STAGE CLEAR: you ${moves} moves · my algorithm ${algoOps.length} moves`;

  const pill = 'border-2 px-3 py-1.5 text-sm font-semibold disabled:opacity-40';

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {SIZES.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={size === n}
            onClick={() => newGame(n)}
            className={`${pill} border-cyan/60 text-cyan aria-pressed:bg-cyan aria-pressed:text-bg`}
          >
            {n} numbers
          </button>
        ))}
        <button type="button" onClick={() => newGame(size)} className={`${pill} border-muted/60 text-text hover:border-cyan`}>
          New stack
        </button>
        <button type="button" onClick={startOver} className={`${pill} border-muted/60 text-text hover:border-cyan`}>
          Start over
        </button>
        <p className="ml-auto text-lg">
          Moves: <span data-testid="moves" className="font-display text-sm text-warn">{moves}</span>
        </p>
      </div>

      <p role="status" className={`mt-4 min-h-7 ${cleared ? 'font-display text-xs leading-relaxed text-warn sm:text-sm' : 'text-muted'}`}>
        {status}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-6">
        {(['a', 'b'] as const).map((name) => (
          <div key={name}>
            <h3 className="font-display text-xs text-muted">Stack {name.toUpperCase()}</h3>
            <ol
              data-testid={`stack-${name}`}
              aria-label={`Stack ${name.toUpperCase()}, top first`}
              className="mt-2 flex flex-col gap-1 border-l-2 border-muted/40 pl-2"
              style={{ minHeight: `${initial.length * 2.25}rem` }}
            >
              {stacks[name].map((v) => (
                <li
                  key={v}
                  data-value={v}
                  style={{ width: width(v) }}
                  className={`h-8 px-2 text-right font-semibold leading-8 text-bg ${name === 'a' ? 'bg-cyan' : 'bg-magenta'}`}
                >
                  {v}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {OP_GROUPS.map((group) => (
          <fieldset key={group.title} disabled={Boolean(replay) || cleared} className="min-w-0">
            <legend className="text-sm text-muted">{group.title}</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {group.ops.map(({ op, does }) => (
                <button
                  key={op}
                  type="button"
                  data-op={op}
                  title={does}
                  disabled={!engine.can(op)}
                  onClick={() => move(op)}
                  className="min-w-14 border-2 border-magenta px-3 py-2 text-magenta hover:bg-magenta hover:text-bg disabled:border-muted/40 disabled:text-muted/70 disabled:hover:bg-transparent"
                >
                  <span className="font-display block text-xs">{op}</span>
                  <span className="sr-only">: {does}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-8 border-t border-cyan/30 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={watch} className={`${pill} border-warn text-warn hover:bg-warn hover:text-bg`}>
            Watch my algorithm
          </button>
          {replay && (
            <>
              <button type="button" disabled={replay.index === 0} onClick={() => showStep(replay.index - 1)} className={`${pill} border-muted/60 text-text`}>
                Step back
              </button>
              <button
                type="button"
                disabled={replay.index === algoOps.length}
                onClick={() => showStep(replay.index, !replay.playing)}
                className={`${pill} border-muted/60 text-text`}
              >
                {replay.playing ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                disabled={replay.index === algoOps.length}
                onClick={() => showStep(replay.index + 1)}
                className={`${pill} border-muted/60 text-text`}
              >
                Step forward
              </button>
              <span className="text-muted">
                Move <span data-testid="replay-progress">{replay.index} / {algoOps.length}</span>
              </span>
            </>
          )}
        </div>
        {replay && (
          <p className="mt-3 break-words text-sm text-muted">
            Operations:{' '}
            <span data-testid="algo-ops" className="text-text">
              {algoOps.join(' ')}
            </span>
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-muted">Stress test my algorithm:</span>
          {[100, 500].map((n) => (
            <button key={n} type="button" onClick={() => runStress(n)} className={`${pill} border-cyan/60 text-cyan hover:bg-cyan hover:text-bg`}>
              Sort {n} numbers
            </button>
          ))}
          <span data-testid="stress-result" aria-live="polite" className="text-text">
            {stress}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PushSwapGame() {
  const load = (attempt: number) => loadEngine(attempt === 0 ? PUSH_SWAP_MODULE_URL : `${PUSH_SWAP_MODULE_URL}?retry=${attempt}`);
  return <GameShell load={load}>{(engine) => <Board engine={engine} />}</GameShell>;
}
