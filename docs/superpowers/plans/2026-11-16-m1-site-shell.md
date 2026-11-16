# M1: Site Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the live site at samuelcglantz.com. It needs the arcade/cyberpunk design system, a HUD, the home page, the 42 Archive, the Side Quest pages, "COMING SOON" pages for the Arcade games, the legal pages and the EN/DE CV downloads.

**Architecture:** A static Astro site. Content (projects) lives in typed Astro content collections, written in MDX. Pages are Astro components and ship no JS by default. The only React island is the HUD (sound and effects toggles). Archive cards expand with native `<details>`, so they need no JS. The site is deployed to Vercel, where the domain's DNS already is.

**Tech Stack:**
- Astro (latest stable), `@astrojs/react`, `@astrojs/mdx`, `@astrojs/sitemap`
- Tailwind CSS v4 via `@tailwindcss/vite`
- TypeScript (strict)
- Vitest, plus the Astro Container API for component tests
- Playwright with `@axe-core/playwright` for end-to-end and accessibility tests
- `@fontsource/press-start-2p` and `@fontsource-variable/space-grotesk` for self-hosted fonts
- `@vercel/analytics`

**Spec:** `docs/SPEC.md` (sections 2, 3, 4B, 4C, 5 and 7, plus milestone M1 in section 8). Also ADR 0003.

## Global Constraints

- Audience: recruiters for junior and internship roles. Every project page opens with a **Mission Briefing** (what it is, skills, tech) before anything else.
- Theme: 80s arcade mixed with cyberpunk neon, magenta and cyan glow on dark backgrounds.
- Sound is **muted by default** and nothing ever plays automatically.
- Glitch, scanline and flicker effects are **off** under `prefers-reduced-motion`, and there's a manual HUD toggle for them.
- All text and background colour pairs pass **WCAG AA**.
- English only. CVs: `public/cv/SamuelCastilloCV_eng.pdf` and `public/cv/SamuelCastilloCV_de.pdf`.
- Routes: `/`, `/play/<slug>`, `/42-archive`, `/projects/<slug>`, `/impressum`, `/privacy`.
- World names: **Arcade**, **42 Archive**, **Side Quests**.
- Contact: email, GitHub and LinkedIn links plus the CV. **No contact form and no backend.**
- Only architecture and key snippets are published, never full 42 source files.
- Team projects show a **Crew** line (logins, linked) and a **My role** line.
- `local-ai-control-plane` and `club-ops` carry the **IN DEVELOPMENT** tag. club-ops is anonymised (never name the club).
- NotAnotherCards is a Side Quest with the Crew note "built at 42 · team of 5". It must **not** appear in the 42 Archive.
- **All fonts and media are self-hosted.** Nothing loads from a third-party origin (COEP readiness, ADR 0003).
- Analytics: Vercel Web Analytics only, with no cookies.
- Layout works at **360 px** width with a 16 px side gutter and no horizontal scroll.

## Review Focus

1. **Blocked storage** (private mode, `localStorage` throws): the HUD toggles still work for the session and the page doesn't crash. Pinned in Task 3.
2. **`prefers-reduced-motion: reduce`:** no element has a running CSS animation. Pinned in Task 2.
3. **Phone width (360 px):** no page scrolls horizontally. Pinned in Task 10 across every route.
4. **Neon contrast:** axe reports zero violations on every route. Pinned in Task 10.
5. **Optional fields missing** (no live URL, private repo, no crew, no video): the page renders with no empty or `#` links. Pinned in Task 5.

---

### Task 1: Scaffold the repo and tooling

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `src/pages/index.astro` (temporary), `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Produces these npm scripts: `dev`, `build`, `preview`, `test` (vitest run), `test:e2e` (playwright test, which serves `astro preview` on port 4321).

- [ ] **Step 1:** In `~/dev/portfolio` (it already holds `docs/`), run `git init -b main`, then scaffold with `npm create astro@latest . -- --template minimal --typescript strict --no-install --no-git`. Keep `docs/`.
- [ ] **Step 2:** Run `npx astro add react mdx sitemap --yes`, then `npm i -D tailwindcss @tailwindcss/vite vitest @playwright/test @axe-core/playwright` and `npm i @fontsource/press-start-2p @fontsource-variable/space-grotesk @vercel/analytics`. Then run `npx playwright install chromium`.
- [ ] **Step 3:** In `astro.config.mjs`, set `site: 'https://samuelcglantz.com'` and add `tailwindcss()` under `vite.plugins`. Set `vitest.config.ts` to use `getViteConfig` from `astro/config`. Set `playwright.config.ts` with `webServer: { command: 'npm run build && npm run preview', port: 4321 }` and two projects: `desktop` (1280×800) and `phone` (360×740). `use.baseURL` = `process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4321"`; omit `webServer` when `PLAYWRIGHT_BASE_URL` is set.
- [ ] **Step 4: Write the failing smoke test.** `tests/e2e/smoke.spec.ts`: `test('home responds', ...)` expects `page.goto('/')` to return status 200 and `page.locator('h1')` to contain `PRESS START`.
- [ ] **Step 5:** Run `npm run test:e2e`. Expected: FAIL, because the h1 text isn't there yet.
- [ ] **Step 6:** Make the temporary `src/pages/index.astro` render `<h1>PRESS START</h1>`.
- [ ] **Step 7:** Run `npm run build && npm run test:e2e`. Expected: PASS for both projects.
- [ ] **Step 8:** Commit: `chore: scaffold Astro site with React, MDX, Tailwind, Vitest, Playwright`.

---

### Task 2: Design system and base layout

**Files:**
- Create: `src/styles/global.css`, `src/layouts/BaseLayout.astro`, `tests/e2e/layout.spec.ts`

**Interfaces:**
- Produces `BaseLayout` with props `{ title: string; description: string }`. It renders `<html lang="en" data-fx="on">`, a skip link, `<slot name="hud" />` (filled in Task 3), `<main id="main"><slot /></main>` and a footer with Impressum and Privacy links.
- Produces these CSS tokens on `:root` (Tailwind v4 `@theme`):
  - `--color-bg: #0b0614`
  - `--color-surface: #160c26`
  - `--color-text: #f2ecff`
  - `--color-muted: #b3a6d4`
  - `--color-magenta: #ff2bd6`
  - `--color-cyan: #00f0ff`
  - `--color-warn: #ffd23f`
  - `--font-display: "Press Start 2P"`
  - `--font-body: "Space Grotesk Variable"`
- Produces these utility classes: `.glow-magenta`, `.glow-cyan` (text-shadow), `.neon-border`, `.fx-scanlines` (an overlay pseudo-element on `body`) and `.fx-glitch` (keyframe animation used on headings).
- **Rule:** every animation and the scanline overlay live inside `html[data-fx="on"]` *and* `@media (prefers-reduced-motion: no-preference)`. The display font is used only for headings and labels. Body text uses Space Grotesk at 16 px or more, for readability.

- [ ] **Step 1: Write the failing tests** in `tests/e2e/layout.spec.ts`:
  - `reduced motion disables animations`: run `page.emulateMedia({ reducedMotion: 'reduce' })`, go to `/`, then check that `document.getAnimations().length === 0`.
  - `effects on by default animate the hero heading`: with no emulation, check that `document.getAnimations().length > 0`.
  - `skip link targets main`: the first focusable element has `href="#main"`.
- [ ] **Step 2:** Run `npx playwright test layout`. Expected: FAIL.
- [ ] **Step 3:** Implement `global.css` and `BaseLayout.astro` (font imports from `@fontsource`, tokens, effects). Switch the temporary index to `BaseLayout`, with the h1 using `.fx-glitch`.
- [ ] **Step 4:** Run `npx playwright test layout`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: neon design tokens, effects and base layout`.

---

### Task 3: Preferences and the HUD island

**Files:**
- Create: `src/lib/prefs.ts`, `src/components/hud/Hud.tsx`, `tests/unit/prefs.test.ts`, `tests/e2e/hud.spec.ts`
- Modify: `src/layouts/BaseLayout.astro` (mount `<Hud client:load />` in the hud slot, and add an inline script in `<head>` that applies the saved `fx` before first paint)

**Interfaces:**
- Produces:
  - `type Prefs = { sound: boolean; fx: boolean }`
  - `const DEFAULT_PREFS: Prefs = { sound: false, fx: true }`
  - `readPrefs(storage?: Storage | null): Prefs`
  - `writePrefs(p: Prefs, storage?: Storage | null): void`
  - `applyFx(fx: boolean, root?: HTMLElement): void`, which sets `data-fx`
  - Storage key: `"portfolio.prefs"`. Every storage access is wrapped in try/catch, and a bad or missing value returns `DEFAULT_PREFS`.
- The HUD shows two `aria-pressed` buttons: "Sound" (labelled `Sound off` / `Sound on`) and "Effects". It also shows a nav to Arcade, 42 Archive and Side Quests, plus the logo linking to `/`. "Launch ship" is **not** in M1.

- [ ] **Step 1: Write the failing unit tests** in `tests/unit/prefs.test.ts`:
  - `readPrefs(null)` equals `{ sound: false, fx: true }`.
  - With a storage whose `getItem` throws, `readPrefs` returns the defaults and doesn't throw.
  - Storage holding `"not json"` gives the defaults.
  - A `writePrefs` then `readPrefs` round trip keeps `{ sound: true, fx: false }`.
  - With a storage whose `setItem` throws, `writePrefs` doesn't throw.
- [ ] **Step 2:** Run `npx vitest run prefs`. Expected: FAIL.
- [ ] **Step 3:** Implement `prefs.ts`, then `Hud.tsx` using it.
- [ ] **Step 4:** Run `npx vitest run prefs`. Expected: PASS.
- [ ] **Step 5: Write the failing e2e tests** in `tests/e2e/hud.spec.ts`:
  - `sound starts muted`: the Sound button has `aria-pressed="false"`.
  - `effects toggle persists`: click Effects, then `html` has `data-fx="off"`. After a reload it is still `off`, and `document.getAnimations().length === 0`.
  - `works with storage blocked`: add an init script that makes `localStorage` getters throw. Clicking Effects still sets `data-fx="off"`, and there are no `pageerror` events.
- [ ] **Step 6:** Run `npx playwright test hud`, fix anything failing, and repeat until it PASSES.
- [ ] **Step 7:** Commit: `feat: HUD with sound and effects preferences`.

---

### Task 4: Content collections and helpers

**Files:**
- Create: `src/content.config.ts`, `src/lib/content.ts`, `tests/unit/content.test.ts`, one stub entry per collection (replaced with real content in Task 9)

**Interfaces:**
- Produces these shared schema pieces (zod, from `astro:content`):
  - `briefing = { summary: string (≤ 280 chars), skills: string[] (1–6), tech: string[] }`
  - `crew = { members: { login: string; url: url }[]; myRole: string; note?: string }` (optional on every entry)
- Produces these collections:
  - `arcade` (glob `src/content/arcade/*.mdx`): `{ title, slug, rank: 0-5, order: number, briefing, crew?, status: 'coming-soon' | 'playable' }`
  - `archive` (glob `src/content/archive/*.mdx`): `{ title, rank: 0-5, order: number, briefing, crew?, longform: boolean }`
  - `sideQuests` (glob `src/content/side-quests/*.mdx`): `{ title, order, briefing, crew?, status: 'live' | 'in-development', liveUrl?: url, repoUrl?: url, video?: string, screenshots: { src: string; alt: string }[] (0–4) }`
- Produces these helpers in `src/lib/content.ts`, all pure and taking plain arrays so they can be unit tested:
  - `groupByRank<T extends { rank: number; order: number }>(items: T[]): { rank: number; items: T[] }[]`, sorted by rank ascending and then by order
  - `byOrder<T extends { order: number }>(items: T[]): T[]`
  - `safeLinks(e: { liveUrl?: string; repoUrl?: string }): { label: 'Live' | 'GitHub'; href: string }[]`, which only includes links that are present and non-empty

- [ ] **Step 1: Write the failing tests** in `tests/unit/content.test.ts`:
  - `groupByRank` on ranks [2, 0, 2, 1] gives groups in the order 0, 1, 2, and within rank 2 the items are sorted by `order`.
  - `safeLinks({})` gives `[]`.
  - `safeLinks({ repoUrl: '' })` gives `[]`.
  - `safeLinks({ liveUrl: 'https://x.dev', repoUrl: 'https://github.com/a/b' })` gives Live then GitHub.
- [ ] **Step 2:** Run `npx vitest run content`. Expected: FAIL.
- [ ] **Step 3:** Implement `content.config.ts` and `content.ts`, and add one valid stub `.mdx` per collection.
- [ ] **Step 4:** Run `npx vitest run content && npm run build`. Expected: PASS, and the build validates the stubs.
- [ ] **Step 5:** Commit: `feat: typed content collections and helpers`.

---

### Task 5: Project components

**Files:**
- Create: `src/components/project/MissionBriefing.astro`, `StatusTag.astro`, `CrewLine.astro`, `ProjectLinks.astro`, `CartridgeCard.astro`, `WorldCard.astro`, `CvButton.astro`, and `tests/unit/components.test.ts` (using Astro `experimental_AstroContainer`)

**Interfaces:**
- Consumes `briefing` and `crew` (Task 4), `safeLinks` (Task 4) and the tokens (Task 2).
- Produces these components:
  - `MissionBriefing { briefing; status?: 'coming-soon' | 'in-development' | 'live' | 'playable' }`: a `<section aria-labelledby>` with the heading "Mission Briefing", the summary, skills as a list and tech as tags.
  - `StatusTag { status }`, with this text: `in-development` → `IN DEVELOPMENT`, `coming-soon` → `COMING SOON`. It renders nothing for `live` or `playable`.
  - `CrewLine { crew? }`: renders nothing when `crew` is undefined. Otherwise it renders "Crew:" with linked logins, "My role:", and the note if there is one.
  - `ProjectLinks { liveUrl?, repoUrl? }`: renders `safeLinks` output, external links with `rel="noopener"`, and nothing when the list is empty.
  - `CartridgeCard { entry: archive entry }`: `<details>` with a `<summary>` (title, `RANK n`, one-line summary, skill tags). The expanded body holds the MDX content and the CrewLine.
  - `WorldCard { name: string; href: string; tagline: string; count: number }`
  - `CvButton`: two links, `CV · EN` → `/cv/SamuelCastilloCV_eng.pdf` and `CV · DE` → `/cv/SamuelCastilloCV_de.pdf`, both with `download`.

- [ ] **Step 1: Write the failing tests** in `tests/unit/components.test.ts`:
  - The rendered MissionBriefing HTML contains "Mission Briefing", the summary text and every skill.
  - StatusTag with `in-development` contains `IN DEVELOPMENT`. With `live`, the trimmed output is `''`.
  - CrewLine with no `crew` gives `''`. With crew, it contains each login as an `<a href=...>` and the `myRole` text.
  - ProjectLinks with `{}` contains no `<a`. With `{ repoUrl: '' }` it also contains no `<a`. No rendered output ever contains `href="#"` or `href=""`.
  - CvButton contains both PDF paths.
- [ ] **Step 2:** Run `npx vitest run components`. Expected: FAIL.
- [ ] **Step 3:** Implement the components with the neon styles. Cartridge cards look like a game cartridge: a notched top edge, a label area and a cyan glow on hover or focus.
- [ ] **Step 4:** Run `npx vitest run components`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: project presentation components`.

---

### Task 6: Home page

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/data/site.ts`, `public/cv/` (copy both PDFs from `~/Desktop`), `tests/e2e/home.spec.ts`

**Interfaces:**
- Produces `site` in `src/data/site.ts`: `{ name: 'Samuel Castillo Glantz', role: string, pitch: string, email: string, github: url, linkedin: url, about: string }`.
- **Ask Samuel** for `role`, `pitch`, `about` and the LinkedIn URL. Draft defaults until then: role `Junior Software Developer`; GitHub `https://github.com/samsnwn`; email `samuel.c.glantz@gmail.com` (**confirm with Samuel before publishing** that this is the public contact address).

Page sections, in order:
1. Hero: `<h1>` with "PRESS START" (styled), the name, role, pitch and CvButton.
2. Worlds: three WorldCards, Arcade → `#arcade` (arcade entries listed below it, each linking to `/play/<slug>`, with StatusTag), 42 Archive → `/42-archive`, Side Quests → `#side-quests` (cards linking to `/projects/<slug>`).
3. About.
4. Contact: email, GitHub and LinkedIn links.

- [ ] **Step 1: Write the failing tests** in `tests/e2e/home.spec.ts`:
  - The h1 contains `PRESS START`, and the page contains `Samuel Castillo Glantz`.
  - World headings "Arcade", "42 Archive" and "Side Quests" are visible.
  - There are 5 links matching `a[href^="/play/"]` and 4 matching `a[href^="/projects/"]` (once Task 9 content exists, so keep this assertion and let it fail until then, or write it against the stub counts and update it in Task 9).
  - `request.get('/cv/SamuelCastilloCV_eng.pdf')` and the `_de` one both return 200 with `content-type` containing `pdf`.
  - The page contains no `<form>`.
- [ ] **Step 2:** Run `npx playwright test home`. Expected: FAIL.
- [ ] **Step 3:** Implement the page and `site.ts`, and copy the PDFs.
- [ ] **Step 4:** Run `npx playwright test home`. Expected: PASS (apart from the content-count assertion, if it's deferred to Task 9).
- [ ] **Step 5:** Commit: `feat: home page with hero, worlds, about, contact, CVs`.

---

### Task 7: The 42 Archive page

**Files:**
- Create: `src/pages/42-archive.astro`, `tests/e2e/archive.spec.ts`

**Interfaces:**
- Consumes `getCollection('archive')`, `groupByRank` and `CartridgeCard`.
- Renders one section per rank with the heading `RANK n · CLEARED`, then the cartridge cards. Entries with `longform: true` (inception, ft_irc) get a wider card.

- [ ] **Step 1: Write the failing tests** in `tests/e2e/archive.spec.ts`:
  - The rank headings appear in ascending order.
  - Clicking the first card's `summary` makes its `details` open, and its body text becomes visible.
  - The page doesn't contain `NotAnotherCards`.
- [ ] **Step 2:** Run `npx playwright test archive`. Expected: FAIL.
- [ ] **Step 3:** Implement the page.
- [ ] **Step 4:** Run `npx playwright test archive`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: 42 Archive page`.

---

### Task 8: Side Quest pages and Arcade "coming soon" pages

**Files:**
- Create: `src/pages/projects/[slug].astro`, `src/pages/play/[slug].astro`, `src/components/project/MediaGallery.astro`, `tests/e2e/projects.spec.ts`

**Interfaces:**
- Side Quest page layout, in order: title and StatusTag, MissionBriefing, MediaGallery (a muted looping `<video autoplay muted loop playsinline>` only when `video` is set, then the screenshots with alt text), the MDX body, CrewLine, ProjectLinks.
- Play page layout: title, MissionBriefing (status `coming-soon`), and an "INSERT COIN, game coming soon" panel. No game code in M1.

- [ ] **Step 1: Write the failing tests** in `tests/e2e/projects.spec.ts`:
  - On each `/projects/<slug>`, the first `h2` on the page is "Mission Briefing".
  - `/projects/local-ai-control-plane` and `/projects/club-ops` show `IN DEVELOPMENT`.
  - `/projects/notanothercards` contains `built at 42 · team of 5`.
  - `/projects/club-ops` doesn't contain the stub's club name (assert against a `FORBIDDEN_TERMS` list in the test, which Samuel fills in).
  - Every `<video>` on the site has the `muted` attribute.
  - Each `/play/<slug>` returns 200 and shows `COMING SOON`.
- [ ] **Step 2:** Run `npx playwright test projects`. Expected: FAIL.
- [ ] **Step 3:** Implement both routes and the MediaGallery.
- [ ] **Step 4:** Run `npx playwright test projects`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: side quest and arcade placeholder pages`.

---

### Task 9: Draft all the project content

**Files:**
- Create:
  - `src/content/arcade/{push-swap,fractol,philo,minirt,minishell}.mdx`
  - `src/content/archive/{libft,ft-printf,get-next-line,pipex,netpractice,cpp00-04,cpp05-09,ft-irc,inception}.mdx`
  - `src/content/side-quests/{sculpted-audio,notanothercards,local-ai-control-plane,club-ops}.mdx`
- Create: `public/media/<slug>/` (screenshots and videos, added later)
- Delete: the Task 4 stubs

**Sources:**
- `~/dev/42/rank*/<project>` (code, Makefile, README)
- `git log` in each repo, for crew and role
- `~/dev/{sculpted_audio_page,NotAnotherCards,local-ai-control-plane,club-ops}` (README, AGENTS.md, STATUS.md, docs)

**Rules:**
- Briefing summaries are ≤ 280 characters and written for recruiters: what it is and what it proves.
- Archive bodies run 80–200 words: architecture, 1–2 key snippets of ≤ 15 lines each, what I learned. inception and ft_irc go up to 400 words with a simple diagram, as an inline SVG or an ASCII figure in a code block.
- Crew logins come only from git history or READMEs (the NotAnotherCards README lists `amoiseik, dgomez-a, pschneid, samcasti, tpandya`). `myRole` is a draft marked for review.
- club-ops uses no club name and no real data. Leave `screenshots: []` and no `video` until Samuel adds anonymised media.
- `liveUrl` and `repoUrl` are set only where Samuel confirms them. Otherwise leave them out.

- [ ] **Step 1:** Draft all 18 entries.
- [ ] **Step 2:** Run `npm run build && npm test && npm run test:e2e`. Expected: PASS, including the deferred home link counts (5 play, 4 projects).
- [ ] **Step 3:** **Samuel reviews** every briefing and every `myRole`, and confirms the live and repo URLs. Apply the edits.
- [ ] **Step 4:** Commit: `content: draft briefings and walkthroughs for all projects`.

---

### Task 10: Legal pages, SEO and the cross-site quality gate

**Files:**
- Create: `src/pages/impressum.astro`, `src/pages/privacy.astro`, `src/pages/404.astro`, `src/data/legal.ts`, `tests/e2e/quality.spec.ts`
- Modify: `BaseLayout.astro` (canonical URL, Open Graph tags, `public/og.png` at 1200×630 in arcade style, and `<Analytics />` from `@vercel/analytics/astro`)

**Interfaces:**
- `legal.ts` holds `{ name, street, city, country, email }`. **Samuel provides the address.** The build has to fail if any of these is empty, so throw an error in `legal.ts`.
- The privacy page states: no cookies, Vercel Web Analytics is cookieless and aggregated, Vercel is the hosting provider and logs requests, and no forms.

- [ ] **Step 1: Write the failing tests** in `tests/e2e/quality.spec.ts`. Build the route list from the collections (every static route plus every `/play/*` and `/projects/*`), and for each route:
  - axe (`AxeBuilder` with the `wcag2a`, `wcag2aa` tags) reports 0 violations.
  - In the `phone` project, `document.documentElement.scrollWidth <= window.innerWidth`.
  - Every request the page makes goes to the same origin (collect them with `page.on('request')`; anything at `/_vercel/*` counts as same-origin).
  - Exactly one `h1`.
  - Then: `/impressum` contains the name and city, and `/does-not-exist` shows the 404 page ("GAME OVER", with a link home).
- [ ] **Step 2:** Run `npx playwright test quality`. Expected: FAIL.
- [ ] **Step 3:** Implement the pages and meta tags, and fix every axe and overflow failure it finds (most likely muted text or neon text contrast on surfaces; adjust the tokens in `global.css`, not individual components).
- [ ] **Step 4:** Run `npm test && npm run test:e2e`. Expected: all tests PASS in both projects.
- [ ] **Step 5:** Commit: `feat: legal pages, SEO, 404 and site-wide quality gate`.

---

### Task 11: Deploy to Vercel at samuelcglantz.com

**Files:**
- Create: `vercel.json`, `README.md` (dev commands, how content is structured, a pointer to the spec)

**Interfaces:**
- `vercel.json`: `"headers"` for the source `/play/(.*)` with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, ready for philo in M3. Plus `Cache-Control: public, max-age=31536000, immutable` for `/_astro/(.*)`.

- [ ] **Step 1:** **Ask Samuel** before creating the public GitHub repo (`samsnwn/portfolio`). It's outward-facing. Then run `gh repo create samsnwn/portfolio --public --source . --push`.
- [ ] **Step 2:** Samuel runs `! npx vercel login`. Then link the project: `npx vercel link` (framework Astro), then `npx vercel --prod`.
- [ ] **Step 3:** Run `npx vercel domains add samuelcglantz.com` and `npx vercel domains add www.samuelcglantz.com`, redirecting www to the apex domain. Enable Web Analytics in the project settings.
- [ ] **Step 4: Verify the live site.**
  - `curl -sI https://samuelcglantz.com` returns `200`.
  - `curl -sI https://samuelcglantz.com/play/philo` includes `cross-origin-embedder-policy: require-corp`.
  - `curl -sI https://samuelcglantz.com/cv/SamuelCastilloCV_de.pdf` returns `200`.
  - Run `PLAYWRIGHT_BASE_URL=https://samuelcglantz.com npx playwright test smoke quality`. Expected: PASS.
- [ ] **Step 5:** Commit and push: `chore: Vercel config and deploy`. From now on, a push to `main` deploys automatically.
