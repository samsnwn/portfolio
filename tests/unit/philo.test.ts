import { describe, it, expect } from 'vitest';
import { parsePhiloLine, newTable, applyEvent, clampArgs, toArgv, PRESETS, type PhiloEvent } from '../../src/lib/philo';

describe('parsePhiloLine', () => {
  it('reads the program output format', () => {
    expect(parsePhiloLine('200 3 is eating')).toEqual({ t: 200, id: 3, action: 'eating' });
    expect(parsePhiloLine('0 1 has taken a fork')?.action).toBe('fork');
    expect(parsePhiloLine('310 2 died')?.action).toBe('died');
    expect(parsePhiloLine('5 2 is sleeping')?.action).toBe('sleeping');
    expect(parsePhiloLine('9 2 is thinking')?.action).toBe('thinking');
  });

  it('rejects anything else', () => {
    expect(parsePhiloLine('hello')).toBeNull();
    expect(parsePhiloLine('')).toBeNull();
    expect(parsePhiloLine('12 x is eating')).toBeNull();
  });
});

describe('applyEvent', () => {
  const ev = (action: PhiloEvent['action'], id = 2, t = 10): PhiloEvent => ({ t, id, action });

  it('walks a philosopher through a meal without mutating the table', () => {
    const start = newTable(3);
    const snapshot = structuredClone(start);
    const t1 = applyEvent(start, ev('fork'));
    expect(t1.seats[1].forks).toBe(1);
    const t2 = applyEvent(t1, ev('fork'));
    expect(t2.seats[1].forks).toBe(2);
    const t3 = applyEvent(t2, ev('eating', 2, 20));
    expect(t3.seats[1]).toMatchObject({ status: 'eating', meals: 1 });
    expect(t3.clock).toBe(20);
    const t4 = applyEvent(t3, ev('sleeping'));
    expect(t4.seats[1]).toMatchObject({ status: 'sleeping', forks: 0 });
    const t5 = applyEvent(t4, ev('thinking'));
    expect(t5.seats[1].status).toBe('thinking');
    expect(start).toEqual(snapshot);
    expect(start.seats.every((s) => s.status === 'waiting' && s.forks === 0 && s.meals === 0)).toBe(true);
  });

  it('caps forks at two', () => {
    let t = newTable(3);
    for (let i = 0; i < 3; i++) t = applyEvent(t, ev('fork'));
    expect(t.seats[1].forks).toBe(2);
  });

  it('records a death', () => {
    const t = applyEvent(newTable(3), ev('died', 3, 310));
    expect(t.deadId).toBe(3);
    expect(t.seats[2].status).toBe('dead');
  });

  it('ignores unknown philosophers', () => {
    const t = newTable(3);
    expect(applyEvent(t, ev('eating', 9))).toEqual(t);
  });
});

describe('arguments', () => {
  it('clamps to the limits', () => {
    expect(clampArgs({ count: 50, die: 5, eat: 99999, sleep: 0, meals: 0 })).toEqual({
      count: 10,
      die: 100,
      eat: 1500,
      sleep: 60,
      meals: 1,
    });
  });

  it('builds argv with an optional meal limit', () => {
    expect(toArgv({ count: 5, die: 800, eat: 200, sleep: 200, meals: null })).toEqual(['5', '800', '200', '200']);
    expect(toArgv({ count: 5, die: 800, eat: 200, sleep: 200, meals: 3 })).toHaveLength(5);
  });

  it('offers the three presets', () => {
    expect(PRESETS.map((p) => p.name)).toEqual(['Everyone eats', 'Someone starves', 'One lonely philosopher']);
    expect(PRESETS[0].args).toEqual({ count: 5, die: 800, eat: 200, sleep: 200, meals: 3 });
  });
});
