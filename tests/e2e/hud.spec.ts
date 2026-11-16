import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});

test('sound starts muted', async ({ page }) => {
  await page.goto('/');
  const sound = page.getByRole('button', { name: /sound/i });
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await expect(sound).toHaveAccessibleName(/sound off/i);
});

test('effects toggle persists across reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /effects/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-fx', 'off');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-fx', 'off');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('works with storage blocked', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('blocked', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /effects/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-fx', 'off');
  expect(errors).toEqual([]);
});

test('HUD links to the three worlds', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Arcade' })).toHaveAttribute('href', '/arcade');
  await expect(nav.getByRole('link', { name: '42 Archive' })).toHaveAttribute('href', '/42-archive');
  await expect(nav.getByRole('link', { name: 'Side Quests' })).toHaveAttribute('href', '/side-quests');
});
