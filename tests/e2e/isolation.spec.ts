import { test, expect } from '@playwright/test';

// Threads (philosophers) need a cross-origin isolated page, and an isolated page only starts
// workers whose scripts carry the isolation headers themselves.

test('play pages are cross-origin isolated', async ({ page }) => {
  await page.goto('/play/philo');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
});

test('a module worker can start on an isolated page', async ({ page }) => {
  await page.goto('/play/philo');
  const error = await page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const worker = new Worker('/native/fractol/keymap.mjs', { type: 'module' });
        worker.addEventListener('error', (e) => resolve(e.message || 'worker failed to start'));
        setTimeout(() => resolve(null), 500);
      }),
  );
  expect(error).toBeNull();
});
