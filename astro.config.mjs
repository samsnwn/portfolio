// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Cross-origin isolation (needed for shared-memory threads) on `astro dev` and `astro preview`.
// Production sets the same headers in vercel.json.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export default defineConfig({
  site: 'https://samuelcglantz.com',
  integrations: [react(), mdx(), sitemap()],
  markdown: { shikiConfig: { theme: 'github-dark-high-contrast' } },
  server: { headers: isolation },
  vite: { plugins: [tailwindcss()] },
});
