/** The philosophers program's own stdout, turned into a table the page can draw. */

export type PhiloAction = 'fork' | 'eating' | 'sleeping' | 'thinking' | 'died';

export interface PhiloEvent {
  t: number;
  id: number;
  action: PhiloAction;
}

const LINE = /^(\d+) (\d+) (has taken a fork|is eating|is sleeping|is thinking|died)$/;

const ACTIONS: Record<string, PhiloAction> = {
  'has taken a fork': 'fork',
  'is eating': 'eating',
  'is sleeping': 'sleeping',
  'is thinking': 'thinking',
  died: 'died',
};

/** Parses one line in the exact format the program prints, e.g. `200 3 is eating`. */
export function parsePhiloLine(line: string): PhiloEvent | null {
  const m = LINE.exec(line);
  return m ? { t: Number(m[1]), id: Number(m[2]), action: ACTIONS[m[3]] } : null;
}

export interface Seat {
  id: number;
  status: 'waiting' | 'thinking' | 'eating' | 'sleeping' | 'dead';
  forks: 0 | 1 | 2;
  meals: number;
}

export interface Table {
  seats: Seat[];
  clock: number;
  deadId: number | null;
}

export function newTable(count: number): Table {
  return {
    seats: Array.from({ length: count }, (_, i) => ({ id: i + 1, status: 'waiting', forks: 0, meals: 0 })),
    clock: 0,
    deadId: null,
  };
}

/** Returns the table after one event. The input table is never changed. */
export function applyEvent(table: Table, e: PhiloEvent): Table {
  const index = e.id - 1;
  const seat = table.seats[index];
  if (!seat) return table;
  let next: Seat;
  switch (e.action) {
    case 'fork':
      next = { ...seat, forks: Math.min(seat.forks + 1, 2) as Seat['forks'] };
      break;
    case 'eating':
      next = { ...seat, status: 'eating', meals: seat.meals + 1 };
      break;
    case 'sleeping':
      next = { ...seat, status: 'sleeping', forks: 0 };
      break;
    case 'thinking':
      next = { ...seat, status: 'thinking' };
      break;
    case 'died':
      next = { ...seat, status: 'dead' };
      break;
  }
  const seats = table.seats.slice();
  seats[index] = next;
  return { seats, clock: e.t, deadId: e.action === 'died' ? e.id : table.deadId };
}

export interface PhiloArgs {
  count: number;
  die: number;
  eat: number;
  sleep: number;
  meals: number | null;
}

/** What the page lets you choose. The program itself rejects times under 60 ms. */
export const LIMITS = {
  count: [1, 10],
  die: [100, 3000],
  eat: [60, 1500],
  sleep: [60, 1500],
  meals: [1, 10],
} as const satisfies Record<keyof PhiloArgs, readonly [number, number]>;

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round(v)));

export function clampArgs(a: PhiloArgs): PhiloArgs {
  return {
    count: clamp(a.count, LIMITS.count),
    die: clamp(a.die, LIMITS.die),
    eat: clamp(a.eat, LIMITS.eat),
    sleep: clamp(a.sleep, LIMITS.sleep),
    meals: a.meals === null ? null : clamp(a.meals, LIMITS.meals),
  };
}

/** The command line: `count die eat sleep [meals]`. */
export function toArgv(a: PhiloArgs): string[] {
  const argv = [a.count, a.die, a.eat, a.sleep].map(String);
  return a.meals === null ? argv : [...argv, String(a.meals)];
}

export const PRESETS: { name: string; args: PhiloArgs }[] = [
  { name: 'Everyone eats', args: { count: 5, die: 800, eat: 200, sleep: 200, meals: 3 } },
  { name: 'Someone starves', args: { count: 4, die: 310, eat: 200, sleep: 100, meals: null } },
  { name: 'One lonely philosopher', args: { count: 1, die: 800, eat: 200, sleep: 200, meals: null } },
];
