export type Prefs = { sound: boolean; fx: boolean };

export const DEFAULT_PREFS: Prefs = { sound: false, fx: true };

const KEY = 'portfolio.prefs';

/** Resolve the storage to use. `undefined` means "the browser's localStorage, if reachable". */
function resolve(storage: Storage | null | undefined): Storage | null {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readPrefs(storage?: Storage | null): Prefs {
  const s = resolve(storage);
  if (!s) return { ...DEFAULT_PREFS };
  try {
    const raw = s.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PREFS };
    const p = parsed as Partial<Record<keyof Prefs, unknown>>;
    return {
      sound: typeof p.sound === 'boolean' ? p.sound : DEFAULT_PREFS.sound,
      fx: typeof p.fx === 'boolean' ? p.fx : DEFAULT_PREFS.fx,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writePrefs(p: Prefs, storage?: Storage | null): void {
  const s = resolve(storage);
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage blocked (private mode, disabled site data): keep the in-memory value only.
  }
}

export function applyFx(fx: boolean, root: HTMLElement = document.documentElement): void {
  root.dataset.fx = fx ? 'on' : 'off';
}
