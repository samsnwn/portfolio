import { test, expect } from '@playwright/test';
import { slugs } from './helpers/content';

test('hero shows PRESS START and the name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('PRESS START');
  await expect(page.locator('body')).toContainText('Samuel Castillo Glantz');
});

test('the world selector links to the three world pages', async ({ page }) => {
  await page.goto('/');
  const worlds = page.getByRole('region', { name: 'Choose a world' });
  await expect(worlds.getByRole('link', { name: /^Arcade/ })).toHaveAttribute('href', '/arcade');
  await expect(worlds.getByRole('link', { name: /^42 Archive/ })).toHaveAttribute('href', '/42-archive');
  await expect(worlds.getByRole('link', { name: /^Side Quests/ })).toHaveAttribute('href', '/side-quests');
});

test('home shows only the worlds, then About and Contact', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main a[href^="/play/"], main a[href^="/projects/"]')).toHaveCount(0);
  const order = await page.evaluate(() =>
    ['worlds-title', 'about-title', 'contact-title'].map((id) => document.getElementById(id)!.getBoundingClientRect().top),
  );
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThanOrEqual(order[2]);
});

test('Arcade page lists every game', async ({ page }) => {
  await page.goto('/arcade');
  await expect(page.locator('h1')).toHaveText('Arcade');
  await expect(page.locator('main a[href^="/play/"]')).toHaveCount(slugs('arcade').length);
});

test('Side Quests page lists every project', async ({ page }) => {
  await page.goto('/side-quests');
  await expect(page.locator('h1')).toHaveText('Side Quests');
  await expect(page.locator('main a[href^="/projects/"]')).toHaveCount(slugs('side-quests').length);
});

test('both CVs are served as PDFs', async ({ request }) => {
  for (const f of ['SamuelCastilloCV_eng.pdf', 'SamuelCastilloCV_de.pdf']) {
    const res = await request.get(`/cv/${f}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('pdf');
  }
});

test('has contact links and no form', async ({ page }) => {
  await page.goto('/');
  const contact = page.locator('#contact');
  await expect(contact.locator('a[href^="mailto:"]')).toHaveCount(1);
  await expect(contact.locator('a[href*="github.com"]')).toHaveCount(1);
  // LinkedIn is shown only when a real profile URL is configured; never a placeholder.
  await expect(contact.locator('a[href*="TODO"], a[href$="/in/"]')).toHaveCount(0);
  await expect(page.locator('form')).toHaveCount(0);
});
