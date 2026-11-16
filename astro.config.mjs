// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://samuelcglantz.com',
  integrations: [react(), mdx(), sitemap()],
  markdown: { shikiConfig: { theme: 'github-dark-high-contrast' } },
  vite: { plugins: [tailwindcss()] },
});
