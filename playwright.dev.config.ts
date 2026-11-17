import { defineConfig, devices } from '@playwright/test';

// Runs a small set of checks against the DEV server (`astro dev`), which serves and transforms
// files differently from the production build that the main suite tests.
const port = Number(process.env.PW_DEV_PORT ?? 4331);

export default defineConfig({
  testDir: 'tests/e2e-dev',
  reporter: 'list',
  use: { baseURL: `http://localhost:${port}`, channel: 'chrome' },
  projects: [{ name: 'dev-server', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    // Astro backgrounds itself under AI agents; strip those variables so Playwright owns the process.
    command: `exec env -u AI_AGENT -u CLAUDECODE -u CLAUDE_CODE_CHILD_SESSION ./node_modules/.bin/astro dev --port ${port} --ignore-lock`,
    port,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
