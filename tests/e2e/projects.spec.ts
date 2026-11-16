import { test, expect } from '@playwright/test';
import { slugs } from './helpers/content';

import { readFileSync, existsSync } from 'node:fs';

/** Names that must never appear on the anonymised club project. Kept untracked in .private/forbidden-terms.txt. */
const termsFile = '.private/forbidden-terms.txt';
const FORBIDDEN_TERMS = [
  ...(existsSync(termsFile) ? readFileSync(termsFile, 'utf8').split('\n') : []),
  ...(process.env.FORBIDDEN_TERMS ?? '').split(','),
].map((t) => t.trim()).filter(Boolean);

for (const slug of slugs('side-quests')) {
  test(`side quest ${slug} opens with the Mission Briefing`, async ({ page }) => {
    const res = await page.goto(`/projects/${slug}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('main h2').first()).toHaveText('Mission Briefing');
  });
}

for (const slug of ['local-ai-control-plane', 'club-ops']) {
  test(`${slug} is tagged IN DEVELOPMENT`, async ({ page }) => {
    await page.goto(`/projects/${slug}`);
    await expect(page.locator('main')).toContainText('IN DEVELOPMENT');
  });
}

test('NotAnotherCards credits 42 and the team', async ({ page }) => {
  await page.goto('/projects/notanothercards');
  await expect(page.locator('main')).toContainText('built at 42 · team of 5');
});

test('the club project never names the club', async ({ page }) => {
  await page.goto('/projects/club-ops');
  const html = await page.content();
  for (const term of FORBIDDEN_TERMS) expect(html.toLowerCase()).not.toContain(term.toLowerCase());
});

test('every video on side quest pages is muted', async ({ page }) => {
  for (const slug of slugs('side-quests')) {
    await page.goto(`/projects/${slug}`);
    const unmuted = await page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.muted).length);
    expect(unmuted, slug).toBe(0);
  }
});

const comingSoon = (slug: string) =>
  /^status:\s*coming-soon\s*$/m.test(readFileSync(`src/content/arcade/${slug}.mdx`, 'utf8'));

for (const slug of slugs('arcade')) {
  test(`arcade ${slug} opens with the Mission Briefing`, async ({ page }) => {
    const res = await page.goto(`/play/${slug}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('main h2').first()).toHaveText('Mission Briefing');
    if (comingSoon(slug)) await expect(page.locator('main')).toContainText('COMING SOON');
    else await expect(page.locator('main')).not.toContainText('COMING SOON');
  });
}
