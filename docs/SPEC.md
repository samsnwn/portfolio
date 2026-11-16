# Portfolio — Specification

Status: agreed (grilling session, 2026-11-16)
Domain: **samuelcglantz.com**

## 1. Purpose and audience

A personal portfolio aimed at **recruiters hiring for junior and internship developer roles**.
The interactive pieces are there to get attention. The real goal is that a recruiter understands each project within about 10 seconds.

**Rule:** every project page opens with a **Mission Briefing** (what it is, the skills it shows, the tech used). A visitor must never have to play anything to understand a project.

## 2. Look and feel

- **Theme:** 80s arcade mixed with cyberpunk neon. Magenta and cyan glow on dark backgrounds, an arcade HUD, light glitch effects.
- **Navigation:** a themed "level select" site. The site itself is *not* a game world, apart from launch-ship mode (§6).
- **Sound:** muted by default, with a speaker toggle in the HUD. Nothing ever plays automatically.
- **Motion and accessibility:**
  - Glitch, scanline and flicker effects are off when `prefers-reduced-motion` is set.
  - The HUD has a manual toggle for these effects.
  - All neon text and background pairs must pass WCAG AA contrast.
- **Language:** English only. The CV is offered in both EN and DE.

## 3. Information architecture

| Route | Content |
|---|---|
| `/` | Hero ("PRESS START": name, junior dev title, one-line pitch, CV button with EN/DE choice), then the three worlds, then About and Contact |
| `/play/<project>` | Arcade game pages (section A) |
| `/42-archive` | One page holding all the non-playable 42 projects (section B) |
| `/projects/<project>` | Side Quest pages (section C) |
| `/impressum`, `/privacy` | Legal pages required in Germany |

World names (Arcade / 42 Archive / Side Quests) are placeholders and can be renamed.

**Contact:** email, GitHub, LinkedIn and the CV download. No contact form and no backend.
**CV files:** `public/cv/SamuelCastilloCV_eng.pdf` and `public/cv/SamuelCastilloCV_de.pdf`, copied from the Desktop originals.

## 4. Sections

### A. Arcade: playable 42 projects (the real C code)

Each game runs **the original C code compiled for the browser**. Nothing is reimplemented in JS or TS (see ADR 0001). Page layout: Mission Briefing → game → walkthrough (architecture plus key snippets) → Crew and My role.

| Project | Runtime | What the visitor does |
|---|---|---|
| **push_swap** | Emscripten (pure C) | Sorts a random stack using buttons (`sa sb ss pa pb ra rb rr rra rrb rrr`). Every move runs **the C operation functions**. Then "Watch my algorithm" runs the real push_swap on the same input, animates its moves and compares move counts. |
| **fractol** | Emscripten + **fake MiniLibX shim** | Explores the fractals with zoom and colour controls, exactly as the original program does. |
| **philo** | Emscripten + pthreads (needs cross-origin isolation, see ADR 0003) | Sets the arguments with sliders (number of philosophers, time to die, eat and sleep, optional meal count). The page reads **the program's real stdout** (`has taken a fork`, `is eating`, `died`…) and animates a neon dining table. |
| **miniRT** | Emscripten + fake MiniLibX shim | Picks a scene from `scenes/` or edits `.rt` text live, then renders it. Moving the camera renders at low resolution and sharpens progressively once it stops. |
| **minishell** | **v86**: a minimal Linux running the real compiled binary in the browser (see ADR 0002) | Uses a real shell: pipes, redirects, heredocs, signals, built-ins. Boot time is hidden by a saved VM snapshot and a "booting terminal…" screen. **On mobile:** a recorded demo plus a "play on desktop" note. |

**Fake MiniLibX shim.** It implements the MLX calls that fractol and miniRT actually use:
- `mlx_init`, `mlx_new_window`, `mlx_new_image`, `mlx_get_data_addr`
- `mlx_put_image_to_window`, `mlx_hook`, `mlx_loop`
- `mlx_destroy_image`, `mlx_destroy_window`, `mlx_destroy_display`

How each piece maps to the browser:
- The pixel buffer is a WASM memory region that gets copied to a `<canvas>`.
- `mlx_hook` maps browser key and mouse events, using X11 event and keycode numbers.
- `mlx_loop` becomes a `requestAnimationFrame` loop or a yield via `emscripten_set_main_loop`.

**Other porting notes:**
- miniRT also calls `readline` and `signal`, so those need stubs or a small shim.
- Changes to the C source should stay minimal and be kept as patches in the native repo.

**Mobile:** push_swap, fractol, philo and miniRT must work with touch.

### B. 42 Archive: non-playable 42 projects

libft, ft_printf, get_next_line, pipex, NetPractice, cpp00-04, cpp05-09, ft_irc and inception.

- One page with a grid of **cartridge cards**: name, rank, a one-line summary, skill tags.
- Clicking a card expands it into a short walkthrough: architecture, key snippets, what I learned.
- inception and ft_irc get a slightly longer walkthrough with an architecture diagram, because they show DevOps and networking skills.
- The rank structure (Rank 0 to 5, all cleared) is visible, to show progress through the curriculum.

### C. Side Quests: other projects, each on its own page

Not interactive. Each page has: a Mission Briefing, a looping muted demo video (20–40 s), 3–4 screenshots, tech tags, a live link if one exists, and a GitHub link if the repo is public.

| Project | Notes |
|---|---|
| **sculpted_audio** | Next.js 16 / React 19 production site. Live link. |
| **NotAnotherCards** | Flashcard and spaced-repetition app (web and mobile, offline sync, AI card generation). Presented as an independent product, with a small "built at 42 · team of 5" line in the Crew area. |
| **local-ai-control-plane** | NestJS + Drizzle control plane for a private AI node fleet. Tagged **IN DEVELOPMENT**. |
| **club-ops** | Nightclub operations platform with a local AI assistant. Tagged **IN DEVELOPMENT**. **Anonymised:** demo data only, club not named unless it has agreed. |

## 5. Content rules

- **Source code:** architecture and key snippets only. No full 42 solutions published (42 policy).
- **Team projects:** a **Crew** line (teammates' 42 logins, linked) and a **My role** line saying what I personally built.
- **IN DEVELOPMENT projects:** say honestly what works today and what is next.
- **Authoring:** Claude drafts briefings, cards and walkthroughs from the repositories. Samuel reviews everything, especially the My role lines.

## 6. Launch-ship mode (built last)

A HUD button switches to a canvas star map. The visitor flies a small ship and each planet is a project. Flying into a planet opens that project's page. It is optional and never required for navigation.

## 7. Technical architecture

**Site repo, public, `~/dev/portfolio`:**
- **Stack:** Astro + React islands + TypeScript + Tailwind + MDX.
- Content (briefings, walkthroughs, cards) lives in MDX content collections.
- Each game is a React island loaded only when its page is opened. WASM and VM assets are fetched only when needed.
- Holds only the **compiled** artifacts (`.wasm`, `.js` glue, VM image and state) under `public/native/`.

**Native repo, private, `portfolio-native`:**
- Holds the C sources (copied from `~/dev/42`) plus small patches, the MLX shim, the Emscripten build scripts (run in Docker for reproducible builds) and the v86 Linux image build.
- One build script compiles everything and copies the output into the site repo.

**Hosting (see ADR 0003):**
- **Vercel**, with the domain `samuelcglantz.com`. The DNS is already on Vercel.
- `vercel.json` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`) on the routes that need threads. At minimum that's `/play/philo`; site-wide is fine if nothing third-party breaks.
- **Analytics:** Vercel Web Analytics, which is cookieless, so there's no cookie banner.

## 8. Milestones

1. **M1, site shell:** design system, layout and HUD, home page, 42 Archive, Side Quests, legal pages, CVs, deployed to samuelcglantz.com.
2. **M2:** push_swap and fractol, including the MLX shim.
3. **M3:** philo (pthreads plus the cross-origin headers) and miniRT.
4. **M4:** minishell on v86. This carries the most risk.
5. **M5:** launch-ship mode.

The site is live from M1 onwards. Each later milestone replaces a "COMING SOON" placeholder on an Arcade game.

## 9. Open items to resolve during implementation

- Check the teammate logins and roles for minishell, miniRT and NotAnotherCards against the git history.
- Check which C build each project should use (for example push_swap's bonus checker).
- Size budget for the v86 image and snapshot. Target: under 20 MB, served compressed.
- Record and edit the Side Quest demo videos and the minishell mobile demo.
