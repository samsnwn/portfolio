import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { slugs } from './helpers/content';

const routes = [
  '/',
  '/arcade',
  '/42-archive',
  '/side-quests',
  '/impressum',
  '/privacy',
  ...slugs('arcade').map((s) => `/play/${s}`),
  ...slugs('side-quests').map((s) => `/projects/${s}`),
];

for (const route of routes) {
  test.describe(route, () => {
    test('has no WCAG A/AA violations', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route);
      // Open every cartridge so walkthrough content is checked too.
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });

    test('does not scroll horizontally', async ({ page }) => {
      await page.goto(route);
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('loads nothing from other origins', async ({ page, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const foreign: string[] = [];
      page.on('request', (r) => {
        const u = new URL(r.url());
        if (u.protocol.startsWith('http') && u.origin !== origin) foreign.push(r.url());
      });
      await page.goto(route, { waitUntil: 'networkidle' });
      expect(foreign).toEqual([]);
    });

    test('has exactly one h1', async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('h1')).toHaveCount(1);
    });
  });
}

test('impressum names the site owner and city', async ({ page }) => {
  await page.goto('/impressum');
  await expect(page.locator('main')).toContainText('Samuel Castillo Glantz');
  await expect(page.locator('main')).toContainText('Berlin');
});

test('unknown routes show the GAME OVER page with a way home', async ({ page }) => {
  const res = await page.goto('/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('GAME OVER');
  await expect(page.getByRole('link', { name: /home/i }).first()).toHaveAttribute('href', '/');
});

test('pages carry canonical and Open Graph tags', async ({ page }) => {
  await page.goto('/42-archive');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://samuelcglantz.com/42-archive');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://samuelcglantz.com/og.png');
});
