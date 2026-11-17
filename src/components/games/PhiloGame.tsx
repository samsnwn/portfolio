import { useCallback, useEffect, useRef, useState } from 'react';
import { loadNative } from '../../lib/native';
import {
  LIMITS,
  PRESETS,
  applyEvent,
  clampArgs,
  newTable,
  parsePhiloLine,
  toArgv,
  type PhiloArgs,
  type Seat,
  type Table,
} from '../../lib/philo';

const MODULE_URL = '/native/philo/philo.mjs';
const LOG_LINES = 200;

/** The compiled program: main() runs on a worker and every philosopher is a real thread. */
interface PhiloModule {
  callMain(args: string[]): void;
  PThread: { terminateAllThreads(): void };
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'running' }
  | { kind: 'died'; id: number; t: number }
  | { kind: 'fed'; meals: number }
  | { kind: 'stopped' }
  | { kind: 'failed'; message: string }
  | { kind: 'error' };

const STATUS_CLASS: Record<Seat['status'], string> = {
  waiting: 'border-muted/50 text-text',
  thinking: 'border-magenta text-magenta',
  eating: 'border-cyan text-cyan',
  sleeping: 'border-muted/50 text-muted',
  dead: 'border-warn text-warn',
};

const SLIDERS = [
  { key: 'count', label: 'Philosophers', step: 1 },
  { key: 'die', label: 'Time to die (ms)', step: 10 },
  { key: 'eat', label: 'Time to eat (ms)', step: 10 },
  { key: 'sleep', label: 'Time to sleep (ms)', step: 10 },
] as const;

const sameArgs = (a: PhiloArgs, b: PhiloArgs) =>
  a.count === b.count && a.die === b.die && a.eat === b.eat && a.sleep === b.sleep && a.meals === b.meals;

export default function PhiloGame() {
  // Unknown until the browser says so: the server render can't tell.
  const [isolated, setIsolated] = useState<boolean | null>(null);
  const [args, setArgs] = useState<PhiloArgs>(PRESETS[0].args);
  const [mealLimit, setMealLimit] = useState(3);
  const [table, setTable] = useState<Table>(() => newTable(PRESETS[0].args.count));
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [log, setLog] = useState<{ lines: string[]; count: number }>({ lines: [], count: 0 });

  const modRef = useRef<PhiloModule | null>(null);
  const runRef = useRef(0);
  const attemptRef = useRef(0);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => setIsolated(typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated), []);

  /** Ends the current program, threads and all. Lines it already queued are ignored. */
  const halt = useCallback(() => {
    runRef.current++;
    const mod = modRef.current;
    modRef.current = null;
    try {
      mod?.PThread.terminateAllThreads();
    } catch {
      // Already torn down by its own exit().
    }
  }, []);

  useEffect(() => halt, [halt]);

  const start = useCallback(
    async (runArgs: PhiloArgs) => {
      halt();
      const run = runRef.current;
      const current = () => runRef.current === run;

      // Lines arrive one at a time from the program's threads; draw them at most once per frame.
      let tableNow = newTable(runArgs.count);
      let pending: string[] = [];
      let lines: string[] = [];
      let count = 0;
      let scheduled = false;
      const flush = () => {
        scheduled = false;
        if (!current() || pending.length === 0) return;
        let died: { id: number; t: number } | null = null;
        for (const line of pending) {
          const event = parsePhiloLine(line);
          if (!event) continue;
          tableNow = applyEvent(tableNow, event);
          if (event.action === 'died') died = { id: event.id, t: event.t };
        }
        lines = lines.concat(pending).slice(-LOG_LINES);
        count += pending.length;
        pending = [];
        setTable(tableNow);
        setLog({ lines, count });
        if (died) setPhase({ kind: 'died', ...died });
      };
      const print = (line: string) => {
        if (!current()) return;
        pending.push(line);
        if (!scheduled) {
          scheduled = true;
          requestAnimationFrame(flush);
        }
      };

      setTable(tableNow);
      setLog({ lines: [], count: 0 });
      setPhase({ kind: 'loading' });
      try {
        const retry = attemptRef.current ? `?retry=${attemptRef.current}` : '';
        const mod = await loadNative<PhiloModule>(MODULE_URL + retry, {
          print,
          printErr: print,
          onExit: (status) => {
            if (!current()) return;
            flush();
            modRef.current = null;
            setPhase((p) => {
              if (p.kind === 'died') return p;
              if (status === 0 && runArgs.meals !== null) return { kind: 'fed', meals: runArgs.meals };
              return { kind: 'failed', message: lines.at(-1) ?? `exit status ${status}` };
            });
          },
        });
        if (!current()) {
          mod.PThread.terminateAllThreads();
          return;
        }
        modRef.current = mod;
        setPhase({ kind: 'running' });
        mod.callMain(toArgv(runArgs));
      } catch {
        if (current()) setPhase({ kind: 'error' });
      }
    },
    [halt],
  );

  const stop = () => {
    halt();
    setPhase({ kind: 'stopped' });
  };

  const retry = () => {
    attemptRef.current++;
    void start(args);
  };

  const update = (next: PhiloArgs) => {
    const clamped = clampArgs(next);
    setArgs(clamped);
    if (clamped.meals !== null) setMealLimit(clamped.meals);
    if (phase.kind !== 'running' && phase.kind !== 'loading') setTable(newTable(clamped.count));
  };

  // Keep the newest program output in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  if (isolated === null) {
    return (
      <div className="grid min-h-64 place-items-center p-6 text-center">
        <p className="font-display fx-blink text-sm text-magenta">Loading…</p>
      </div>
    );
  }

  if (!isolated) {
    return (
      <div className="grid min-h-64 place-items-center p-6 text-center">
        <p className="max-w-[48ch] text-lg">
          This game needs a browser with shared-memory threads. The briefing above explains what it does.
        </p>
      </div>
    );
  }

  const busy = phase.kind === 'running' || phase.kind === 'loading';
  const pill = 'border-2 px-3 py-1.5 text-sm font-semibold disabled:opacity-40';
  const control = `${pill} border-magenta text-magenta hover:bg-magenta hover:text-bg disabled:hover:bg-transparent disabled:hover:text-magenta`;

  const statusText = (() => {
    switch (phase.kind) {
      case 'idle':
        return 'Choose a table and press Start.';
      case 'loading':
      case 'running':
        return 'Running…';
      case 'died':
        return `Philosopher ${phase.id} died at ${phase.t} ms.`;
      case 'fed':
        return `Everyone ate ${phase.meals} meals. Nobody died.`;
      case 'stopped':
        return 'Stopped.';
      case 'failed':
        return `The program stopped: ${phase.message}`;
      case 'error':
        return '';
    }
  })();

  const seatSize = table.seats.length > 6 ? 'w-[3.75rem]' : 'w-[4.5rem]';

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            aria-pressed={sameArgs(args, p.args)}
            disabled={busy}
            onClick={() => update(p.args)}
            className={`${pill} border-cyan/60 text-cyan aria-pressed:bg-cyan aria-pressed:text-bg`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {SLIDERS.map(({ key, label, step }) => (
          <label key={key} className="block">
            <span className="flex justify-between text-sm">
              <span>{label}</span>
              <span className="font-semibold text-cyan">{args[key]}</span>
            </span>
            <input
              type="range"
              aria-label={label}
              min={LIMITS[key][0]}
              max={LIMITS[key][1]}
              step={step}
              value={args[key]}
              disabled={busy}
              onChange={(e) => update({ ...args, [key]: Number(e.target.value) })}
              className="mt-1 w-full accent-[var(--color-magenta)]"
            />
          </label>
        ))}
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={args.meals !== null}
              disabled={busy}
              onChange={(e) => update({ ...args, meals: e.target.checked ? mealLimit : null })}
              className="size-4 accent-[var(--color-magenta)]"
            />
            Stop after {args.meals ?? mealLimit} meals
          </label>
          <input
            type="range"
            aria-label="Meals per philosopher"
            min={LIMITS.meals[0]}
            max={LIMITS.meals[1]}
            value={args.meals ?? mealLimit}
            disabled={busy || args.meals === null}
            onChange={(e) => update({ ...args, meals: Number(e.target.value) })}
            className="mt-1 w-full accent-[var(--color-magenta)] disabled:opacity-40"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void start(args)} className={control}>
          Start
        </button>
        <button type="button" disabled={!busy} onClick={stop} className={control}>
          Stop
        </button>
        <p role="status" className="ml-1 text-sm">
          {statusText}
        </p>
      </div>

      {phase.kind === 'error' ? (
        <div role="alert" className="mt-6 grid min-h-48 place-items-center text-center">
          <div>
            <p className="text-lg">The game couldn't load.</p>
            <p className="mt-2 text-muted">Check your connection and try again. The briefing above still tells you what it does.</p>
            <button type="button" onClick={retry} className={`${control} mt-5`}>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto mt-6 aspect-square w-full max-w-[26rem]">
          <ol aria-label="The table" className="contents">
            {table.seats.map((seat, i) => {
              const angle = (i / table.seats.length) * 2 * Math.PI - Math.PI / 2;
              const single = table.seats.length === 1;
              return (
                <li
                  key={seat.id}
                  data-testid="seat"
                  data-status={seat.status}
                  data-meals={seat.meals}
                  className={`absolute ${seatSize} -translate-x-1/2 -translate-y-1/2 border-2 bg-bg px-1 py-1 text-center text-xs leading-tight ${STATUS_CLASS[seat.status]}`}
                  style={{
                    left: `${50 + (single ? 0 : 39 * Math.cos(angle))}%`,
                    top: `${50 + (single ? -30 : 39 * Math.sin(angle))}%`,
                  }}
                >
                  <span className="block font-semibold">
                    <span className="sr-only">Philosopher </span>
                    <span aria-hidden="true">#</span>
                    {seat.id}
                  </span>
                  <span className="block">{seat.status}</span>
                  <span className="block min-h-[1em] tracking-widest" aria-hidden="true">
                    {'●'.repeat(seat.forks)}
                  </span>
                  <span className="sr-only">holding {seat.forks} forks, </span>
                  <span className="block text-text">
                    {seat.meals}
                    <span aria-hidden="true"> ate</span>
                    <span className="sr-only"> meals</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-sm text-muted">
            {table.clock} ms
          </p>
        </div>
      )}

      <h2 id="philo-output" className="mt-6 text-sm font-semibold">
        Program output
      </h2>
      <pre
        ref={logRef}
        tabIndex={0}
        // A named region, not role="log": a live log would read hundreds of lines a second aloud.
        role="region"
        aria-labelledby="philo-output"
        data-testid="philo-log"
        data-count={log.count}
        className="mt-2 h-40 overflow-y-auto border-2 border-muted/30 bg-bg p-2 text-xs leading-snug text-text"
      >
        {log.lines.join('\n')}
      </pre>
      <p className="mt-3 text-sm text-muted">
        Eating is cyan, thinking is magenta, sleeping is grey. Dots are the forks each philosopher is holding.
      </p>
    </div>
  );
}
