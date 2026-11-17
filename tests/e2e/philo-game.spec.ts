import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const game = (page: Page) => page.getByRole('region', { name: 'Game' });
const seats = (page: Page) => page.getByTestId('seat');
const statusLine = (page: Page) => game(page).getByRole('status');
const log = (page: Page) => page.getByTestId('philo-log');
const logCount = async (page: Page) => Number(await log(page).getAttribute('data-count'));

/** The game loads lazily, when a visitor scrolls it into view. */
async function open(page: Page) {
  await page.goto('/play/philo');
  await game(page).scrollIntoViewIfNeeded();
  await expect(game(page).getByRole('button', { name: 'Start' })).toBeVisible({ timeout: 20_000 });
}

async function runPreset(page: Page, name: string) {
  await game(page).getByRole('button', { name }).click();
  await game(page).getByRole('button', { name: 'Start' }).click();
}

test.describe('philosophers game', () => {
  test('Everyone eats finishes with nobody dead', async ({ page }) => {
    await open(page);
    await runPreset(page, 'Everyone eats');
    await expect(statusLine(page)).toHaveText(/Everyone ate 3 meals/, { timeout: 15_000 });
    await expect(seats(page)).toHaveCount(5);
    for (const seat of await seats(page).all()) {
      expect(Number(await seat.getAttribute('data-meals'))).toBeGreaterThanOrEqual(3);
    }
    await expect(page.locator('[data-testid="seat"][data-status="dead"]')).toHaveCount(0);
  });

  test('Someone starves ends with one death', async ({ page }) => {
    await open(page);
    await runPreset(page, 'Someone starves');
    await expect(statusLine(page)).toHaveText(/Philosopher \d died at \d+ ms/, { timeout: 15_000 });
    await expect(page.locator('[data-testid="seat"][data-status="dead"]')).toHaveCount(1);
  });

  test('the lonely philosopher starves holding one fork', async ({ page }) => {
    await open(page);
    await runPreset(page, 'One lonely philosopher');
    await expect(statusLine(page)).toHaveText(/Philosopher 1 died at \d+ ms/, { timeout: 15_000 });
    await expect(seats(page)).toHaveCount(1);
    await expect(seats(page).first()).toHaveAttribute('data-status', 'dead');
  });

  test("the log shows the program's real output", async ({ page }) => {
    await open(page);
    await runPreset(page, 'Everyone eats');
    await expect(statusLine(page)).toHaveText(/Everyone ate/, { timeout: 15_000 });
    await expect(game(page).getByRole('heading', { name: 'Program output' })).toBeVisible();
    expect(await log(page).textContent()).toMatch(/^\d+ \d has taken a fork$/m);
  });

  test('an endless run can be stopped and restarted', async ({ page }) => {
    await open(page);
    await game(page).getByRole('button', { name: 'Everyone eats' }).click();
    await game(page).getByRole('checkbox', { name: /Stop after/ }).uncheck();
    await game(page).getByRole('button', { name: 'Start' }).click();
    await expect(statusLine(page)).toHaveText('Running…');
    await page.waitForTimeout(1500);
    await game(page).getByRole('button', { name: 'Stop' }).click();
    await expect(statusLine(page)).toHaveText('Stopped.');
    const count = await logCount(page);
    expect(count).toBeGreaterThan(0);
    await page.waitForTimeout(700);
    expect(await logCount(page)).toBe(count);
    await game(page).getByRole('button', { name: 'Start' }).click();
    await expect.poll(() => logCount(page), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(statusLine(page)).toHaveText('Running…');
    await game(page).getByRole('button', { name: 'Stop' }).click();
  });

  test("sliders are clamped to the model's limits", async ({ page }) => {
    await open(page);
    const slider = game(page).getByRole('slider', { name: 'Philosophers' });
    await expect(slider).toHaveAttribute('min', '1');
    await expect(slider).toHaveAttribute('max', '10');
  });

  test('without cross-origin isolation it explains instead of breaking', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (e) => errors.push(e));
    await page.addInitScript(() => Object.defineProperty(window, 'crossOriginIsolated', { get: () => false }));
    await page.goto('/play/philo');
    await game(page).scrollIntoViewIfNeeded();
    await expect(game(page).getByText('This game needs a browser with shared-memory threads.')).toBeVisible({ timeout: 20_000 });
    await expect(game(page).getByRole('button', { name: 'Start' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Mission Briefing' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the loaded game is accessible and fits the screen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await runPreset(page, 'Everyone eats');
    await expect(statusLine(page)).toHaveText(/Everyone ate/, { timeout: 15_000 });
    await expect(page.locator('main')).toContainText('my original philosophers C code, compiled to WebAssembly');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('wasm failure shows retry', async ({ page }) => {
    let block = true;
    await page.route('**/philo.wasm', (route) => (block ? route.abort() : route.continue()));
    await open(page);
    await runPreset(page, 'Everyone eats');
    await expect(game(page).getByText("The game couldn't load.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Mission Briefing' })).toBeVisible();
    block = false;
    await game(page).getByRole('button', { name: 'Retry' }).click();
    await expect(statusLine(page)).toHaveText(/Everyone ate 3 meals/, { timeout: 15_000 });
  });
});
