import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const URL = '/play/push-swap?seed=1&size=5';

const values = (page: Page, stack: 'a' | 'b') =>
  page.locator(`[data-testid="stack-${stack}"] li`).evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-value'))));

const isAscending = (nums: number[]) => nums.every((v, i) => i === 0 || nums[i - 1] < v);

/** The game loads lazily, when a visitor scrolls it into view. */
const scrollToGame = (page: Page) => page.getByRole('region', { name: 'Game' }).scrollIntoViewIfNeeded();

async function ready(page: Page) {
  await scrollToGame(page);
  await expect(page.locator('[data-testid="stack-a"] li')).toHaveCount(5);
}

/** Reads the algorithm's operations for the current stack, then puts the stack back. */
async function algorithmOps(page: Page): Promise<string[]> {
  await page.getByRole('button', { name: 'Watch my algorithm' }).click();
  const list = page.getByTestId('algo-ops');
  await expect(list).toBeVisible();
  const ops = ((await list.textContent()) ?? '').trim().split(/\s+/);
  await page.getByRole('button', { name: 'Start over' }).click();
  return ops;
}

test.describe('push_swap game', () => {
  test('a seeded stack is deterministic and unsorted', async ({ page }) => {
    await page.goto(URL);
    await ready(page);
    const first = await values(page, 'a');
    expect(isAscending(first)).toBe(false);
    await page.reload();
    await ready(page);
    expect(await values(page, 'a')).toEqual(first);
  });

  test('player can sort by hand', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(URL);
    await ready(page);
    const start = await values(page, 'a');
    const ops = await algorithmOps(page);
    expect(await values(page, 'a')).toEqual(start);
    await expect(page.getByTestId('moves')).toHaveText('0');

    for (const op of ops) await page.locator(`button[data-op="${op}"]`).click();

    await expect(page.getByTestId('moves')).toHaveText(String(ops.length));
    await expect(page.getByRole('status')).toContainText('STAGE CLEAR');
    await expect(page.getByRole('status')).toContainText(`you ${ops.length} moves`);
    await expect(page.getByRole('status')).toContainText(`my algorithm ${ops.length} moves`);
    expect(isAscending(await values(page, 'a'))).toBe(true);
  });

  test('impossible moves are disabled', async ({ page }) => {
    await page.goto(URL);
    await ready(page);
    for (const op of ['pa', 'sb', 'rb', 'rrb']) await expect(page.locator(`button[data-op="${op}"]`)).toBeDisabled();
    for (const op of ['sa', 'pb', 'ra', 'rra']) await expect(page.locator(`button[data-op="${op}"]`)).toBeEnabled();
    await page.locator('button[data-op="pb"]').click();
    await expect(page.locator('button[data-op="pa"]')).toBeEnabled();
    await expect(page.getByTestId('moves')).toHaveText('1');
    expect(await values(page, 'b')).toHaveLength(1);
  });

  test('algorithm replay finishes sorted', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(URL);
    await ready(page);
    await page.getByRole('button', { name: 'Watch my algorithm' }).click();
    await expect(page.getByTestId('replay-progress')).toHaveText(/^(\d+) \/ \1$/, { timeout: 20_000 });
    expect(isAscending(await values(page, 'a'))).toBe(true);
    expect(await values(page, 'b')).toEqual([]);
  });

  test('reduced motion shows the final state at once, with stepping', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(URL);
    await ready(page);
    await page.getByRole('button', { name: 'Watch my algorithm' }).click();
    await expect(page.getByTestId('replay-progress')).toHaveText(/^(\d+) \/ \1$/, { timeout: 500 });
    expect(isAscending(await values(page, 'a'))).toBe(true);

    const sorted = await values(page, 'a');
    const progress = page.getByTestId('replay-progress');
    const total = Number(((await progress.textContent()) ?? '').split('/')[1]);
    const back = page.getByRole('button', { name: 'Step back' });
    await expect(back).toBeEnabled();
    await back.click();
    await expect(progress).toHaveText(`${total - 1} / ${total}`);
    await page.getByRole('button', { name: 'Step forward' }).click();
    await expect(progress).toHaveText(`${total} / ${total}`);
    expect(await values(page, 'a')).toEqual(sorted);
  });

  test('stress test reports a move count', async ({ page }) => {
    await page.goto(URL);
    await ready(page);
    await page.getByRole('button', { name: 'Sort 100 numbers' }).click();
    await expect(page.getByTestId('stress-result')).toHaveText(/100 numbers.*\b\d[\d,]* moves/);
    await page.getByRole('button', { name: 'Sort 500 numbers' }).click();
    await expect(page.getByTestId('stress-result')).toHaveText(/500 numbers.*\b\d[\d,]* moves/);
  });

  test('size choice gives a new stack of that size', async ({ page }) => {
    await page.goto(URL);
    await ready(page);
    await page.getByRole('button', { name: '8 numbers' }).click();
    await expect(page.locator('[data-testid="stack-a"] li')).toHaveCount(8);
    await expect(page.getByTestId('moves')).toHaveText('0');
  });

  test('wasm failure shows retry and keeps the briefing', async ({ page }) => {
    let block = true;
    await page.route('**/pushswap.wasm', (route) => (block ? route.abort() : route.continue()));
    await page.goto(URL);
    await scrollToGame(page);
    await expect(page.getByText("The game couldn't load.")).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mission Briefing' })).toBeVisible();
    block = false;
    await page.getByRole('button', { name: 'Retry' }).click();
    await ready(page);
  });

  test('the loaded game is accessible and fits the screen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(URL);
    await ready(page);
    await page.locator('button[data-op="pb"]').click();
    await page.getByRole('button', { name: 'Watch my algorithm' }).click();
    await page.getByRole('button', { name: 'Sort 500 numbers' }).click();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('page says the game is the original C', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('main')).toContainText('my original push_swap C code, compiled to WebAssembly');
  });
});
