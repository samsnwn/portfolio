import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { site } from '../../src/data/site';

const root = process.cwd();

/** Terms that must never be published (e.g. the anonymised club's name). Kept in an untracked file. */
function forbiddenTerms(): string[] {
  const file = join(root, '.private/forbidden-terms.txt');
  const fromFile = existsSync(file) ? readFileSync(file, 'utf8').split('\n') : [];
  const fromEnv = (process.env.FORBIDDEN_TERMS ?? '').split(',');
  return [...fromFile, ...fromEnv].map((t) => t.trim()).filter(Boolean);
}

function frontmatter(dir: string): { file: string; fm: string }[] {
  const d = join(root, 'src/content', dir);
  return readdirSync(d)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => ({ file: f, fm: readFileSync(join(d, f), 'utf8').split('---')[1] ?? '' }));
}

describe('publishing safety', () => {
  it('no tracked file contains a forbidden term', () => {
    const terms = forbiddenTerms();
    expect(terms.length, 'add terms to .private/forbidden-terms.txt or FORBIDDEN_TERMS').toBeGreaterThan(0);
    const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter((f) => f && !/\.(png|jpe?g|pdf|woff2?|ico)$/.test(f) && f !== 'package-lock.json');
    const hits: string[] = [];
    for (const f of tracked) {
      if (!existsSync(join(root, f))) continue;
      const text = readFileSync(join(root, f), 'utf8').toLowerCase();
      for (const t of terms) if (text.includes(t.toLowerCase())) hits.push(`${f}: ${t}`);
    }
    expect(hits).toEqual([]);
  });

  it('every live side quest has a live link', () => {
    const missing = frontmatter('side-quests')
      .filter(({ fm }) => /^status:\s*live\s*$/m.test(fm) && !/^liveUrl:\s*\S+/m.test(fm))
      .map(({ file }) => file);
    expect(missing).toEqual([]);
  });

  it('copy does not claim games are playable while none are', () => {
    const anyPlayable = frontmatter('arcade').some(({ fm }) => /^status:\s*playable\s*$/m.test(fm));
    if (anyPlayable) return;
    const arcadePage = readFileSync(join(root, 'src/pages/arcade.astro'), 'utf8');
    const presentTense = /(running in your browser|Each game runs|compiled from the original C and running)/i;
    expect(site.pitch).not.toMatch(presentTense);
    expect(arcadePage).not.toMatch(presentTense);
  });
});
