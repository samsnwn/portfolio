import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'src/content');

/** Slugs (filenames without .mdx) of a content collection directory. */
export function slugs(dir: 'arcade' | 'archive' | 'side-quests'): string[] {
  return readdirSync(join(root, dir))
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx$/, ''));
}
