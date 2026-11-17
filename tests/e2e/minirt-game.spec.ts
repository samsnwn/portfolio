import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const game = (page: Page) => page.getByRole('region', { name: 'Game' });
const canvas = (page: Page) => page.locator('canvas[aria-label="miniRT render"]');
const frames = async (page: Page) => Number(await canvas(page).getAttribute('data-frames'));

/** The game loads lazily, when a visitor scrolls it into view. */
async function open(page: Page) {
  await page.goto('/play/minirt');
  await game(page).scrollIntoViewIfNeeded();
  await expect.poll(() => frames(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
}

/** Waits for the original C to render another frame after `action`. */
async function afterFrame(page: Page, action: () => Promise<unknown>) {
  const before = await frames(page);
  await action();
  await expect.poll(() => frames(page), { timeout: 30_000 }).toBeGreaterThan(before);
}

const picture = (page: Page) =>
  canvas(page).evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let hash = 0;
    const colours = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 97) {
      const rgb = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      hash = (Math.imul(hash, 31) + rgb) | 0;
      colours.add(rgb);
    }
    return { hash, colours: colours.size };
  });

test.describe('miniRT game', () => {
  test('renders the default scene', async ({ page }) => {
    await open(page);
    expect((await picture(page)).colours).toBeGreaterThan(5);
  });

  test('camera button changes the image', async ({ page }) => {
    await open(page);
    const before = await picture(page);
    await afterFrame(page, () => game(page).getByRole('button', { name: 'Move camera right' }).click());
    expect((await picture(page)).hash).not.toBe(before.hash);
  });

  test('keyboard moves objects when the picture is focused', async ({ page }) => {
    await open(page);
    const before = await picture(page);
    await canvas(page).click();
    await afterFrame(page, () => page.keyboard.press('ArrowLeft'));
    expect((await picture(page)).hash).not.toBe(before.hash);
  });

  test("a broken scene shows the parser's error and can be fixed", async ({ page }) => {
    await open(page);
    // The parser accepts a scene with no camera, but not a negative radius.
    await game(page).getByRole('textbox', { name: 'Scene file' }).fill('sp 0,0,0 -5 255,0,0');
    await game(page).getByRole('button', { name: 'Render scene' }).click();
    await expect(game(page).getByText('Your scene has an error')).toBeVisible({ timeout: 15_000 });
    await expect(game(page).getByText(/Error: Sphere radius must be positive/)).toBeVisible();
    await expect(game(page).getByRole('textbox', { name: 'Scene file' })).toBeEditable();
    const drawn = await frames(page);
    await game(page).getByRole('button', { name: 'Basic shapes' }).click();
    await expect.poll(() => frames(page), { timeout: 30_000 }).toBeGreaterThan(drawn);
    await expect(game(page).getByText('Your scene has an error')).toBeHidden();
  });

  test('the page stays responsive during a heavy render', async ({ page }) => {
    test.setTimeout(90_000);
    await open(page);
    await page.evaluate(() => {
      const w = window as unknown as { maxGap: number; recording: boolean };
      w.maxGap = 0;
      w.recording = true;
      let last = performance.now();
      const tick = (now: number) => {
        w.maxGap = Math.max(w.maxGap, now - last);
        last = now;
        if (w.recording) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const drawn = await frames(page);
    await game(page).getByRole('button', { name: 'Many objects' }).click();
    await expect(game(page).getByText('Rendering…')).toBeVisible();
    await expect.poll(() => frames(page), { timeout: 60_000 }).toBeGreaterThan(drawn);
    await expect(game(page).getByText('Rendering…')).toBeHidden();
    const maxGap = await page.evaluate(() => {
      const w = window as unknown as { maxGap: number; recording: boolean };
      w.recording = false;
      return w.maxGap;
    });
    expect(maxGap).toBeLessThan(250);
  });

  test('holding a key does not queue a backlog', async ({ page }) => {
    await open(page);
    await canvas(page).focus();
    const drawn = await frames(page);
    // What a held arrow key does: dozens of repeated keydown events.
    await canvas(page).evaluate((el) => {
      for (let i = 0; i < 40; i++) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    await page.waitForTimeout(3000);
    expect((await frames(page)) - drawn).toBeLessThanOrEqual(3);
    expect((await frames(page)) - drawn).toBeGreaterThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(game(page).getByText('GAME OVER')).toBeVisible({ timeout: 5000 });
  });

  test('Escape shows GAME OVER and Restart recovers', async ({ page }) => {
    await open(page);
    await canvas(page).focus();
    await page.keyboard.press('Escape');
    await expect(game(page).getByText('GAME OVER')).toBeVisible();
    const drawn = await frames(page);
    await game(page).getByRole('button', { name: 'Restart' }).click();
    await expect(game(page).getByText('GAME OVER')).toBeHidden();
    await expect.poll(() => frames(page), { timeout: 30_000 }).toBeGreaterThan(drawn);
    await afterFrame(page, () => game(page).getByRole('button', { name: 'Move camera left' }).click());
  });

  test('wasm failure shows retry and keeps the briefing', async ({ page }) => {
    let block = true;
    await page.route('**/minirt.wasm*', (route) => (block ? route.abort() : route.continue()));
    await page.goto('/play/minirt');
    await game(page).scrollIntoViewIfNeeded();
    await expect(game(page).getByText("The game couldn't load.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Mission Briefing' })).toBeVisible();
    block = false;
    await game(page).getByRole('button', { name: 'Retry' }).click();
    await expect.poll(() => frames(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
  });

  test('the loaded game is accessible and fits the screen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.locator('main')).toContainText('our original miniRT C code, compiled to WebAssembly');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const width = await canvas(page).evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(page.viewportSize()!.width - 32);
  });
});
