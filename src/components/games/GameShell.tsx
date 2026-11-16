import { useEffect, useState, type ReactNode } from 'react';

type State<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error' };

interface Props<T> {
  /** Loads the compiled game. `attempt` is 0 on first load and increases on each retry. */
  load: (attempt: number) => Promise<T>;
  children: (value: T) => ReactNode;
}

/** Loading and failure states shared by every Arcade game. */
export default function GameShell<T>({ load, children }: Props<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State<T>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    load(attempt).then(
      (value) => !cancelled && setState({ status: 'ready', value }),
      () => !cancelled && setState({ status: 'error' }),
    );
    return () => {
      cancelled = true;
    };
    // `load` is stable for the lifetime of a game component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (state.status === 'ready') return <>{children(state.value)}</>;

  return (
    <div className="grid min-h-64 place-items-center p-6 text-center">
      {state.status === 'loading' ? (
        <p className="font-display fx-blink text-sm text-magenta">Loading…</p>
      ) : (
        <div role="alert">
          <p className="text-lg">The game couldn't load.</p>
          <p className="mt-2 text-muted">Check your connection and try again. The briefing above still tells you what it does.</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-5 border-2 border-magenta px-4 py-2 font-semibold text-magenta hover:bg-magenta hover:text-bg"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
