import { test, expect } from '@playwright/test';

// The compiled games are loaded at runtime from /public. The dev server treats module imports
// differently from the production build, so both games are checked here too.

test('push_swap loads on the dev server', async ({ page }) => {
  await page.goto('/play/push-swap?seed=1&size=5');
  await page.getByRole('region', { name: 'Game' }).scrollIntoViewIfNeeded();
  await expect(page.locator('[data-testid="stack-a"] li')).toHaveCount(5, { timeout: 30_000 });
  await page.locator('button[data-op="pb"]').click();
  await expect(page.getByTestId('moves')).toHaveText('1');
});

test('fract-ol draws on the dev server', async ({ page }) => {
  await page.goto('/play/fractol');
  await page.getByRole('region', { name: 'Game' }).scrollIntoViewIfNeeded();
  const canvas = page.locator('canvas[aria-label="fract-ol render"]');
  await expect.poll(async () => Number(await canvas.getAttribute('data-frames')), { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
});

test('philosophers runs on the dev server', async ({ page }) => {
  await page.goto('/play/philo');
  const game = page.getByRole('region', { name: 'Game' });
  await game.scrollIntoViewIfNeeded();
  await game.getByRole('button', { name: 'Everyone eats' }).click({ timeout: 30_000 });
  await game.getByRole('button', { name: 'Start' }).click();
  await expect(game.getByRole('status')).toHaveText(/Everyone ate 3 meals/, { timeout: 30_000 });
});
