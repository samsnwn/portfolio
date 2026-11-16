import { test, expect } from '@playwright/test';

test('rank sections appear in ascending order', async ({ page }) => {
  await page.goto('/42-archive');
  const headings = await page.locator('main h2[id^="rank-"]').allTextContents();
  const ranks = headings.map((h) => Number(/RANK (\d)/.exec(h)?.[1]));
  expect(ranks.length).toBeGreaterThan(1);
  expect(ranks.every((r) => !Number.isNaN(r))).toBe(true);
  expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  for (const h of headings) expect(h).toContain('CLEARED');
});

test('a cartridge expands to show its walkthrough', async ({ page }) => {
  await page.goto('/42-archive');
  const card = page.locator('details.cartridge').first();
  const body = card.locator('.prose-cartridge');
  await expect(body).toBeHidden();
  await card.locator('summary').click();
  await expect(card).toHaveAttribute('open', '');
  await expect(body).toBeVisible();
});

test('NotAnotherCards is not in the archive', async ({ page }) => {
  await page.goto('/42-archive');
  await expect(page.locator('main')).not.toContainText('NotAnotherCards');
});
