import { describe, it, expect } from 'vitest';
import { groupByRank, byOrder, safeLinks } from '../../src/lib/content';

describe('groupByRank', () => {
  it('groups ascending by rank and sorts each group by order', () => {
    const items = [
      { id: 'b', rank: 2, order: 2 },
      { id: 'z', rank: 0, order: 1 },
      { id: 'a', rank: 2, order: 1 },
      { id: 'm', rank: 1, order: 1 },
    ];
    const groups = groupByRank(items);
    expect(groups.map((g) => g.rank)).toEqual([0, 1, 2]);
    expect(groups[2].items.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('byOrder', () => {
  it('sorts ascending without mutating the input', () => {
    const input = [{ order: 3 }, { order: 1 }, { order: 2 }];
    expect(byOrder(input).map((i) => i.order)).toEqual([1, 2, 3]);
    expect(input.map((i) => i.order)).toEqual([3, 1, 2]);
  });
});

describe('safeLinks', () => {
  it('returns nothing when no links are set', () => {
    expect(safeLinks({})).toEqual([]);
  });
  it('drops empty strings', () => {
    expect(safeLinks({ repoUrl: '' })).toEqual([]);
    expect(safeLinks({ liveUrl: '   ', repoUrl: '' })).toEqual([]);
  });
  it('lists Live before GitHub', () => {
    expect(safeLinks({ liveUrl: 'https://x.dev', repoUrl: 'https://github.com/a/b' })).toEqual([
      { label: 'Live', href: 'https://x.dev' },
      { label: 'GitHub', href: 'https://github.com/a/b' },
    ]);
  });
});
