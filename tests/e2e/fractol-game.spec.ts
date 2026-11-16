import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const canvas = (page: Page) => page.locator('canvas[aria-label="fract-ol render"]');
const frames = async (page: Page) => Number(await canvas(page).getAttribute('data-frames'));

/** The game loads lazily, when a visitor scrolls it into view. */
async function open(page: Page) {
  await page.goto('/play/fractol');
  await page.getByRole('region', { name: 'Game' }).scrollIntoViewIfNeeded();
  await expect.poll(() => frames(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
}

/** Waits for the original C to draw another frame after `action`. */
async function afterFrame(page: Page, action: () => Promise<unknown>) {
  const before = await frames(page);
  await action();
  await expect.poll(() => frames(page), { timeout: 20_000 }).toBeGreaterThan(before);
}

const picture = (page: Page) =>
  canvas(page).evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let hash = 0;
    const colours = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 997) {
      const rgb = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      hash = (Math.imul(hash, 31) + rgb) | 0;
      colours.add(rgb);
    }
    return { hash, colours: colours.size };
  });

test.describe('fract-ol game', () => {
  test('renders the Mandelbrot set', async ({ page }) => {
    await open(page);
    expect((await picture(page)).colours).toBeGreaterThan(5);
  });

  test('zoom button changes the image', async ({ page }) => {
    await open(page);
    const before = await picture(page);
    await afterFrame(page, () => page.getByRole('button', { name: 'Zoom in' }).click());
    expect((await picture(page)).hash).not.toBe(before.hash);
  });

  test('keyboard pans', async ({ page }) => {
    await open(page);
    const before = await picture(page);
    await canvas(page).focus();
    await afterFrame(page, () => page.keyboard.press('ArrowLeft'));
    expect((await picture(page)).hash).not.toBe(before.hash);
  });

  test('wheel zooms without scrolling the page', async ({ page }) => {
    await open(page);
    const before = await picture(page);
    await canvas(page).hover();
    const scrollY = await page.evaluate(() => window.scrollY);
    await afterFrame(page, () => page.mouse.wheel(0, -200));
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    expect((await picture(page)).hash).not.toBe(before.hash);
  });

  test('Escape shows GAME OVER and Restart recovers', async ({ page }) => {
    await open(page);
    await canvas(page).focus();
    await page.keyboard.press('Escape');
    const game = page.getByRole('region', { name: 'Game' });
    await expect(game.getByText('GAME OVER')).toBeVisible();
    await game.getByRole('button', { name: 'Restart' }).click();
    await expect(game.getByText('GAME OVER')).toBeHidden();
    await expect.poll(() => frames(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
    expect((await picture(page)).colours).toBeGreaterThan(5);
    // and it still responds to input
    await afterFrame(page, () => page.getByRole('button', { name: 'Zoom in' }).click());
  });

  test('Julia preset renders a different fractal', async ({ page }) => {
    await open(page);
    const mandelbrot = await picture(page);
    await page.getByRole('button', { name: 'Julia A' }).click();
    await expect(page.getByRole('button', { name: 'Julia A' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await picture(page)).hash, { timeout: 20_000 }).not.toBe(mandelbrot.hash);
    expect((await picture(page)).colours).toBeGreaterThan(5);
  });

  test('canvas fits the screen', async ({ page }) => {
    await open(page);
    const width = await canvas(page).evaluate((el) => el.getBoundingClientRect().width);
    const viewport = page.viewportSize()!.width;
    expect(width).toBeLessThanOrEqual(viewport - 32);
    expect(width).toBeGreaterThan(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('wasm failure shows retry and keeps the briefing', async ({ page }) => {
    let block = true;
    await page.route('**/fractol.wasm', (route) => (block ? route.abort() : route.continue()));
    await page.goto('/play/fractol');
    const game = page.getByRole('region', { name: 'Game' });
    await game.scrollIntoViewIfNeeded();
    await expect(game.getByText("The game couldn't load.")).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mission Briefing' })).toBeVisible();
    block = false;
    await game.getByRole('button', { name: 'Retry' }).click();
    await expect.poll(() => frames(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  });

  test('the loaded game is accessible and says what is running', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.locator('main')).toContainText('my original fract-ol C code, compiled to WebAssembly');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
});
