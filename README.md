# samuelcglantz.com

Portfolio of Samuel Castillo Glantz: an 80s-arcade / cyberpunk site where 42 projects run as playable games.

- Spec: [`docs/SPEC.md`](docs/SPEC.md) · decisions: [`docs/adr/`](docs/adr/) · plans: [`docs/superpowers/plans/`](docs/superpowers/plans/)
- Stack: Astro, React islands (HUD), Tailwind v4, MDX content collections; hosted on Vercel.

## Develop

```bash
npm install
npm run dev          # http://localhost:4321
npm test             # unit tests (Vitest)
npm run test:e2e     # build + browser tests (Playwright, desktop and 360px phone)
```

Playwright uses the installed Google Chrome (`channel: 'chrome'`).

## Content

| Collection | Folder | Route |
|---|---|---|
| Arcade (playable 42 projects) | `src/content/arcade/*.mdx` | `/play/<file>` |
| 42 Archive | `src/content/archive/*.mdx` | `/42-archive` |
| Side Quests | `src/content/side-quests/*.mdx` | `/projects/<file>` |

Frontmatter is validated by `src/content.config.ts`. Site copy lives in `src/data/site.ts`; Impressum data in `src/data/legal.ts`
(a production build fails while the address is incomplete). CVs are in `public/cv/`, demo media goes in `public/media/<slug>/`.

All fonts and media are self-hosted: `/play/*` pages send cross-origin isolation headers (see `vercel.json` and ADR 0003).
