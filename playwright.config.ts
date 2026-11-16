import { defineConfig, devices } from '@playwright/test';

const remote = process.env.PLAYWRIGHT_BASE_URL;
const port = Number(process.env.PW_PORT ?? 4321);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: remote ?? `http://localhost:${port}`,
    // Playwright's bundled Chromium is unsupported on macOS 13: use installed Chrome.
    channel: 'chrome',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: false } },
  ],
  webServer: remote
    ? undefined
    : { command: `npm run build && exec env -u AI_AGENT -u CLAUDECODE -u CLAUDE_CODE_CHILD_SESSION ./node_modules/.bin/astro preview --port ${port} --ignore-lock`, port, reuseExistingServer: false, timeout: 180_000 },
});
