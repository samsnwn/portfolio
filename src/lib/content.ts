export type Ranked = { rank: number; order: number };

export function byOrder<T extends { order: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export function groupByRank<T extends Ranked>(items: readonly T[]): { rank: number; items: T[] }[] {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const list = groups.get(item.rank) ?? [];
    list.push(item);
    groups.set(item.rank, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rank, list]) => ({ rank, items: byOrder(list) }));
}

export type ProjectLink = { label: 'Live' | 'GitHub'; href: string };

export function safeLinks(e: { liveUrl?: string; repoUrl?: string }): ProjectLink[] {
  const links: ProjectLink[] = [];
  if (e.liveUrl?.trim()) links.push({ label: 'Live', href: e.liveUrl.trim() });
  if (e.repoUrl?.trim()) links.push({ label: 'GitHub', href: e.repoUrl.trim() });
  return links;
}
