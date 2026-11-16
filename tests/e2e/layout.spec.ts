import { test, expect } from '@playwright/test';

const animationCount = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.getAnimations().length);

test('reduced motion disables animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await animationCount(page)).toBe(0);
});

test('effects on by default animate the hero heading', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  expect(await animationCount(page)).toBeGreaterThan(0);
});

test('skip link targets main', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const href = await page.evaluate(() => document.activeElement?.getAttribute('href'));
  expect(href).toBe('#main');
  await expect(page.locator('main#main')).toHaveCount(1);
});
