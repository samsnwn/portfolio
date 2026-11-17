# M3: philosophers and miniRT Playable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/play/philo` and `/play/minirt` playable in the browser. Both run Samuel's original 42 C code, compiled to WebAssembly.

**Architecture:**
- **philo** is compiled with Emscripten pthreads. The program's `main` runs on a worker (`PROXY_TO_PTHREAD`), and each philosopher is a real thread (a Web Worker sharing memory). The page reads the program's own stdout lines and draws the table from them.
- **miniRT** is compiled against the fake MiniLibX from M2 and runs **inside a Web Worker**, so a slow render never freezes the page. The worker sends finished frames to a canvas and receives key events.
- **Deviation from the spec:** SPEC §4A describes a low-resolution preview while the camera moves. miniRT's resolution is a compile-time constant in the original code (`WIDTH`/`HEIGHT` 700), and that code must not be edited. So renders always run at full resolution in the background worker, with a "Rendering…" indicator.
- Threads need a cross-origin isolated page, so the isolation headers are extended to the worker scripts and mirrored on the local dev and preview servers.

**Tech Stack:**
- Emscripten 6.0.13, the pinned Docker image from M2. Flags: `-pthread -sPROXY_TO_PTHREAD` for philo, and `-sASYNCIFY` plus the virtual filesystem for miniRT.
- `node:test` in `~/dev/portfolio-native`.
- Astro, React, Vitest and Playwright in `~/dev/portfolio`.

**Spec:** `docs/SPEC.md` (§4A, §5, §7, milestone M3) and ADRs 0001 and 0003. Background on M2 conventions: `docs/superpowers/plans/2026-11-16-m2-push-swap-fractol.md`.

## Global Constraints

- **The original C is never edited.**
  - `vendor/philo` and `vendor/miniRT` are byte-identical copies of `~/dev/42/rank3/philo/philo` and `~/dev/42/rank4/miniRT` (without `minilibx/`, `.git`, objects or binaries).
  - `tests/vendor.test.mjs` covers them.
  - Web glue goes only in `shim/`, the Makefile and the site.
- **The C source stays private** in `samsnwn/portfolio-native`. The public site repo gets only `.mjs`, `.wasm`, the shared `keymap.mjs` and the `.rt` scene files.
- **No Claude or AI attribution** in any commit, PR or comment, in either repo.
- **Branching and deploys:**
  - Site work happens on the branch `m3-games`.
  - **Pushing `main` deploys to samuelcglantz.com.** Never push `main`, merge or deploy without Samuel's explicit go-ahead.
  - Pushing the feature branch (which creates a Vercel preview) also needs his OK.
- **Compiled modules load through `importAtRuntime` / `loadNative`** (`src/lib/native.ts`). A plain `import(url)` breaks on the dev server.
- **Every game is tested on both servers:** the production build (`tests/e2e`) and the dev server (`tests/e2e-dev`).
- **Games hydrate with `client:visible`**, so tests scroll the `Game` region into view first.
- **Same origin only.** Nothing loads from another origin.
- **Mission Briefing first.** It must stay readable if a game fails to load.
- **Sound** stays muted. M3 adds none.
- **Mobile:** both games are usable by touch alone, with on-screen controls.
- **Reduced motion:** state changes are shown without animation (no pulsing or tweening).
- **Input that arrives faster than frames can be drawn is dropped, never queued.** At most 2 events may be pending, and Esc always gets through.
- **Copy** under each game says it is "my original … C code, compiled to WebAssembly".

## Review Focus

1. **No cross-origin isolation** (`crossOriginIsolated === false`: an old browser or missing headers). philo shows the clear message "This game needs a browser with shared-memory threads." It doesn't crash or show a blank box. Pinned in Task 5.
2. **A philo run that never ends** (no meal limit, nobody starves). **Stop** ends it and frees its threads, a new **Start** works, and leaving the page mid-run leaves no threads running. Pinned in Tasks 1 and 5.
3. **Invalid scene text in miniRT.** The C parser's own `Error: …` message is shown, the game is not dead, and editing and rendering again works. Pinned in Tasks 2 and 6.
4. **A heavy miniRT scene** (`06_multiple_objects`, 60+ objects). The page stays responsive while it renders, and "Rendering…" is visible. Pinned in Task 6.
5. **Phone at 360 px.** The philo table and sliders fit and work by touch. miniRT's on-screen controls change the image. Pinned in Tasks 5 and 6.

---

### Task 1: philo as threaded WebAssembly (native repo)

**Files (`~/dev/portfolio-native`):**
- Modify: `scripts/vendor.sh` (add `philo` from `$HOME/dev/42/rank3/philo/philo` and `miniRT` from `$HOME/dev/42/rank4/miniRT`, excluding `minilibx`), `Makefile`
- Create: `tests/philo.test.mjs`, `tests/helpers/philo-lines.mjs`

**Interfaces:**
- **`make philo`** builds `build/philo.mjs` and `build/philo.wasm` from exactly the sources the project's own Makefile lists.
  - Flags: `-O2 -pthread -sPROXY_TO_PTHREAD -sPTHREAD_POOL_SIZE=12 -sPTHREAD_POOL_SIZE_STRICT=2 -sEXIT_RUNTIME=1 -sINVOKE_RUN=0 -sMODULARIZE -sEXPORT_ES6 -sENVIRONMENT=web,worker,node -sEXPORTED_RUNTIME_METHODS=callMain,PThread`
  - The pool of 12 allows up to **10 philosophers**, plus the watcher thread and the proxied `main`.
- **Running it:** `create({ print, printErr, onExit })`, then `mod.callMain([n, die, eat, sleep, meals?])`. Every stdout line arrives through `print` on the creating thread.
- **Stopping it:** `mod.PThread.terminateAllThreads()` ends a run that would never finish.
- **`tests/helpers/philo-lines.mjs`:** `parseLine(line): { t: number, id: number, action: string } | null`, for `^(\d+) (\d+) (has taken a fork|is eating|is sleeping|is thinking|died)$`.

- [ ] **Step 1: Write the failing tests** in `tests/philo.test.mjs`. A helper `run(args, { stopAfterMs })` resolves with `{ lines, exitStatus }`.
  - `five philosophers with a meal limit all eat and nobody dies`: args `5 800 200 200 3`.
    - Every line parses.
    - Timestamps never decrease.
    - There is no `died` line.
    - Each id from 1 to 5 has at least 3 `is eating` lines.
    - Exit status is 0.
  - `a lone philosopher takes one fork and starves on time`: args `1 300 100 100`.
    - The lines are exactly `has taken a fork` and then `died`, both for id 1.
    - The death timestamp `t` satisfies `300 <= t <= 310`. This is the subject's 10 ms rule.
  - `a tight schedule produces exactly one death and then silence`: args `4 310 200 100`.
    - There is exactly one `died` line and it is the last line.
  - `nobody eats while holding fewer than two forks`: for `5 800 200 200 3`, every `is eating` line for an id is preceded by two `has taken a fork` lines for that id since its previous meal.
  - `bad arguments print an error and exit non-zero`: args `5 800`.
  - `an endless run can be stopped`: args `5 800 200 200` with `stopAfterMs: 1500`.
    - Lines were received.
    - After `terminateAllThreads()`, no further lines arrive for 500 ms and the Node process can exit (the test completes).
- [ ] **Step 2:** Run `make test`. Expected: FAIL (no build yet).
- [ ] **Step 3:** Extend `vendor.sh`, run it, and add the `philo` Makefile target.
- [ ] **Step 4:** Run `make philo test`. Expected: PASS. If the death lands a few ms after `die + 10` on this machine, record the measured value in the ledger and widen the upper bound to that value plus 5 ms. The C stays untouched.
- [ ] **Step 5:** Commit: `feat: philosophers runs as threaded wasm`.

---

### Task 2: miniRT as WebAssembly (native repo)

**Files:**
- Create: `shim/X11/keysym.h`, `shim/readline/readline.h` (an empty stub; the header is included but never used), `tests/minirt.test.mjs`
- Modify: `shim/mlx/keymap.mjs`, `tests/mlx-keymap.test.mjs`, `Makefile`

**Interfaces:**
- **`shim/X11/keysym.h`** defines, with X11's real values:
  - `XK_Escape 0xff1b`, `XK_Left 0xff51`, `XK_Up 0xff52`, `XK_Right 0xff53`, `XK_Down 0xff54`, `XK_minus 0x2d`, `XK_1 0x31`, `XK_2 0x32`
  - the lowercase letters the code uses (`a c d f g h s t u v w x y z`) as their ASCII codes
- **`keymap.mjs` gains `minirtKeyToKeysym(key: string): number | null`:**
  - arrows and Escape as above
  - `'+'` and `'='` → 61 (the project's `PLUS_KEY`)
  - `'-'` → 45
  - `'1'` and `'2'`
  - the 14 letters, case-insensitive
  - anything else → `null`
- **`make minirt`** builds `build/minirt.{mjs,wasm}` from exactly the sources the project's own Makefile lists, plus libft and `shim/mlx/mlx_web.c`.
  - Flags: `-O3 -sASYNCIFY -sEXIT_RUNTIME=1 -sINVOKE_RUN=0 -sALLOW_MEMORY_GROWTH -sFORCE_FILESYSTEM -sMODULARIZE -sEXPORT_ES6 -sENVIRONMENT=web,worker,node -sEXPORTED_RUNTIME_METHODS=callMain,FS -Ishim -Ishim/mlx -Ivendor/miniRT/includes -Ivendor/miniRT/libft/include`
- **Running it:**
  1. The host sets `mod.mlxweb = { queue, blit }` (the same contract as fract-ol).
  2. It writes the scene with `mod.FS.writeFile('/scene.rt', text)`.
  3. It calls `mod.callMain(['/scene.rt'])`.
  - Frames are 700×700.
  - A parse failure prints `Error: <reason>` to stderr and exits with status 1.
- **`make install`** also copies:
  - `build/philo.*` → `$(SITE)/public/native/philo/`
  - `build/minirt.*` and `keymap.mjs` → `$(SITE)/public/native/minirt/`
  - `vendor/miniRT/scenes/{03_basic_shapes,06_multiple_objects,13_random_1,14_random_2}.rt` → `$(SITE)/public/native/minirt/scenes/`

- [ ] **Step 1: Write the failing tests.**
  - In `tests/mlx-keymap.test.mjs`:
    - `minirtKeyToKeysym('w') === 119`, `('W') === 119`, `('=') === 61`, `('+') === 61`, `('-') === 45`, `('1') === 49`.
    - `ArrowUp` → 65362, `Escape` → 65307, `('q') === null`.
    - The existing fract-ol mapping is unchanged (`keyToKeysym('+') === 65451`).
  - In `tests/minirt.test.mjs`, using the recording host from `fractol-build.test.mjs`:
    - `renders a scene file`: with `03_basic_shapes.rt`, the first blit is 700×700 with more than 5% lit pixels.
    - `moving the camera re-renders a different image`: pushing KeyPress `d` (100) gives a second blit whose lit-pixel count or pixel hash differs.
    - `an invalid scene reports the parser's error and exits 1`: with the text `sp 0,0,0 5 255,0,0` (no camera, no ambient, no light), stderr contains a line starting with `Error:`, the exit status is 1, and there are no blits.
    - `Escape exits cleanly`: pushing KeyPress 65307 gives exit status 0.
    - `the heavy scene renders`: `06_multiple_objects.rt` blits once. Record its render time in the ledger.
- [ ] **Step 2:** Run `make test`. Expected: FAIL.
- [ ] **Step 3:** Implement the headers, the keymap addition and the Makefile target.
- [ ] **Step 4:** Run `make minirt test`. Expected: PASS.
- [ ] **Step 5:** Run `make install SITE=../portfolio`. Commit: `feat: miniRT compiles unmodified to wasm`. Pushing to the private repo is fine without asking, because it's private and was already approved.

---

### Task 3: Cross-origin isolation everywhere the games run (site)

**Files (`~/dev/portfolio`, branch `m3-games`):**
- Modify: `astro.config.mjs`, `vercel.json`
- Create: `tests/e2e/isolation.spec.ts`, `tests/e2e-dev/isolation.spec.ts`

**Interfaces:**
- **`astro.config.mjs`:** `server.headers` sets `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Resource-Policy: same-origin`, so `astro dev` and `astro preview` isolate every page.
- **`vercel.json`:** keeps COOP and COEP on `/play/(.*)`, and adds `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Resource-Policy: same-origin` for `/native/(.*)` and `/_astro/(.*)`.
  - Worker scripts must carry COEP themselves, or an isolated page refuses to start them.
  - This covers Emscripten's pthread workers (`/native/philo/philo.mjs`) and the bundled miniRT worker (under `/_astro/`).

- [ ] **Step 1: Write the failing tests.** The same two tests go in both spec files:
  - `play pages are cross-origin isolated`: on `/play/philo`, `await page.evaluate(() => crossOriginIsolated)` is `true`.
  - `a module worker can start on an isolated page`: evaluate code that creates a `Blob`-free module worker from `/native/fractol/keymap.mjs` (any same-origin module) and resolves on its first `error` or after 500 ms without one. Expect no error.
- [ ] **Step 2:** Run both configs. Expected: FAIL (`crossOriginIsolated` is false locally).
- [ ] **Step 3:** Add the headers.
- [ ] **Step 4:** Run `npx vitest run && PW_PORT=4361 npx playwright test && npx playwright test -c playwright.dev.config.ts`. Expected: PASS. The full existing suite must stay green, since every local page is now isolated.
- [ ] **Step 5:** Commit: `feat: cross-origin isolation on local servers and for worker scripts`.

---

### Task 4: philo output model (site)

**Files:**
- Create: `src/lib/philo.ts`, `tests/unit/philo.test.ts`

**Interfaces:**
- **Events:**
  - `type PhiloAction = 'fork' | 'eating' | 'sleeping' | 'thinking' | 'died'`
  - `interface PhiloEvent { t: number; id: number; action: PhiloAction }`
  - `parsePhiloLine(line: string): PhiloEvent | null`, for the program's exact output format
- **Table state:**
  - `interface Seat { id: number; status: 'waiting' | 'thinking' | 'eating' | 'sleeping' | 'dead'; forks: 0 | 1 | 2; meals: number }`
  - `interface Table { seats: Seat[]; clock: number; deadId: number | null }`
  - `newTable(count: number): Table`: every seat is `waiting`, with 0 forks and 0 meals.
  - `applyEvent(table: Table, e: PhiloEvent): Table` is pure and returns a new object:
    - `fork` → that seat's forks +1, capped at 2
    - `eating` → status `eating`, meals +1
    - `sleeping` → status `sleeping`, forks 0
    - `thinking` → status `thinking`
    - `died` → status `dead`, and `deadId` is set
    - `clock` becomes `e.t`. Events for unknown ids are ignored.
- **Run arguments:**
  - `interface PhiloArgs { count: number; die: number; eat: number; sleep: number; meals: number | null }`
  - `const LIMITS = { count: [1, 10], die: [100, 3000], eat: [60, 1500], sleep: [60, 1500], meals: [1, 10] }`
  - `clampArgs(a: PhiloArgs): PhiloArgs` and `toArgv(a: PhiloArgs): string[]`
- **Presets:**
  - `PRESETS: { name: string; args: PhiloArgs }[]`
  - `Everyone eats` (5, 800, 200, 200, 3)
  - `Someone starves` (4, 310, 200, 100, null)
  - `One lonely philosopher` (1, 800, 200, 200, null)

- [ ] **Step 1: Write the failing tests** in `tests/unit/philo.test.ts`:
  - `parsePhiloLine('200 3 is eating')` equals `{ t: 200, id: 3, action: 'eating' }`.
  - `'0 1 has taken a fork'` gives the action `fork`.
  - `'310 2 died'` gives `died`.
  - `'hello'`, `''` and `'12 x is eating'` give `null`.
  - A sequence fork, fork, eating, sleeping, thinking for id 2 on `newTable(3)` passes through forks 1 → 2, then eating with meals 1, then sleeping with forks 0, then thinking. The input table is not mutated.
  - A third `fork` event keeps forks at 2.
  - `died` sets `deadId` and the status `dead`.
  - An event for id 9 on a 3-seat table returns an equal table.
  - `clampArgs({ count: 50, die: 5, eat: 99999, sleep: 0, meals: 0 })` gives `{ count: 10, die: 100, eat: 1500, sleep: 60, meals: 1 }`.
  - `toArgv` with `meals: null` has 4 items. With `meals: 3` it has 5.
- [ ] **Step 2:** Run `npx vitest run philo`. Expected: FAIL.
- [ ] **Step 3:** Implement `src/lib/philo.ts`.
- [ ] **Step 4:** Run `npx vitest run`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: philosophers output parser and table model`.

---

### Task 5: The philosophers game (site)

**Files:**
- Create: `src/components/games/PhiloGame.tsx`, `tests/e2e/philo-game.spec.ts`
- Modify: `src/pages/play/[slug].astro`, `src/content/arcade/philo.mdx` (`status: playable`), `tests/e2e-dev/games.spec.ts`

**Interfaces:**
- **Controls:**
  - Three preset buttons.
  - Sliders with visible values: `Philosophers`, `Time to die (ms)`, `Time to eat (ms)`, `Time to sleep (ms)`.
  - A `Stop after N meals` checkbox with its own slider.
  - **Start** and **Stop** buttons.
- **Table:**
  - Seats are arranged in a circle (`data-testid="seat"`, with `data-status` and `data-meals`).
  - Each seat shows its number, a status word, fork pips (`●`) and a meal count.
  - Colours: eating is cyan, sleeping is muted, thinking is magenta, dead is warn.
- **Status line** (`role="status"`), one of:
  - `Running…`
  - `Philosopher N died at T ms.`
  - `Everyone ate N meals. Nobody died.`
  - `Stopped.`
- **Program output:** a scrolling panel `data-testid="philo-log"` shows the last 200 raw stdout lines exactly as the program printed them, under the heading "Program output".
- **Lifecycle:**
  - Start creates a fresh module with `loadNative('/native/philo/philo.mjs', …)` and calls `callMain(toArgv(args))`.
  - Stop, a new Start and unmount all call `PThread.terminateAllThreads()` on the old instance.
  - Lines from a replaced instance are ignored.
- **No isolation:** if `!crossOriginIsolated`, the game area shows only "This game needs a browser with shared-memory threads. The briefing above explains what it does." No Start button is shown.
- **Copy under the game:** "This is my original philosophers C code, compiled to WebAssembly. Each philosopher is a real thread, and the table is drawn from the program's own output."

- [ ] **Step 1: Write the failing tests** in `tests/e2e/philo-game.spec.ts`:
  - `Everyone eats finishes with nobody dead`: choose the preset and press Start. The status matches `/Everyone ate 3 meals/` within 15 s, there are 5 seats, each seat's `data-meals` is at least 3, and no seat has `data-status="dead"`.
  - `Someone starves ends with one death`: the status matches `/Philosopher \d died at \d+ ms/`, and exactly one seat is dead.
  - `the lonely philosopher starves holding one fork`: there is 1 seat and it dies.
  - `the log shows the program's real output`: the log contains a line matching `/^\d+ \d has taken a fork$/m`.
  - `an endless run can be stopped and restarted`: use Everyone eats with the meal limit unticked. After 1.5 s press Stop. The status is `Stopped.` and the number of log lines stays the same for 700 ms. Press Start again and the log grows.
  - `sliders are clamped to the model's limits`: the Philosophers slider has `min=1` and `max=10`.
  - `without cross-origin isolation it explains instead of breaking`: with `addInitScript` defining `crossOriginIsolated` as `false`, the message is visible, there is no Start button, "Mission Briefing" is still visible, and there are no `pageerror` events.
  - `the loaded game is accessible and fits the screen`: axe with wcag2a and wcag2aa shows no violations after a finished run, and there is no horizontal overflow. This runs in both projects, so it covers 360 px.
  - `wasm failure shows retry`: with `**/philo.wasm` aborted, "The game couldn't load." and a Retry button appear, and Retry recovers.
  - Add `philosophers runs on the dev server` to `tests/e2e-dev/games.spec.ts`: Everyone eats reaches its final status.
- [ ] **Step 2:** Run `PW_PORT=4361 npx playwright test philo-game`. Expected: FAIL.
- [ ] **Step 3:** Implement the component and the page wiring, and set the status to `playable`.
- [ ] **Step 4:** Run `npx vitest run && PW_PORT=4361 npx playwright test && npx playwright test -c playwright.dev.config.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: playable philosophers running the original C on real threads`.

---

### Task 6: The miniRT game (site)

**Files:**
- Create: `src/workers/minirt.worker.ts`, `src/lib/minirt-protocol.ts`, `src/components/games/MiniRtGame.tsx`, `tests/e2e/minirt-game.spec.ts`
- Modify: `src/pages/play/[slug].astro`, `src/content/arcade/minirt.mdx` (`status: playable`), `tests/e2e-dev/games.spec.ts`

**Interfaces:**
- **`minirt-protocol.ts`:**
  - `type ToWorker = { type: 'start'; scene: string } | { type: 'key'; keysym: number }`
  - `type FromWorker = { type: 'ready' } | { type: 'frame'; width: number; height: number; rgba: ArrayBuffer } | { type: 'stderr'; line: string } | { type: 'exit'; status: number } | { type: 'failed' }`
- **`minirt.worker.ts`:**
  - On `start` it loads `/native/minirt/minirt.mjs` with `loadNative` and `/native/minirt/keymap.mjs` with `importAtRuntime`.
  - It writes `/scene.rt`, sets `mlxweb`, and calls `callMain(['/scene.rt'])`.
  - Its `blit` converts pixels with `bgrxToRgba` into a fresh buffer and posts `frame`, transferring the buffer.
  - `key` pushes `[KeyPress, keysym, 0, 0]`, unless 2 events are already pending. Escape is always pushed.
  - One worker is one program run.
- **`MiniRtGame` (`client:visible`):**
  - Scene buttons: `Basic shapes`, `Many objects`, `Random 1`, `Random 2`. Each fetches `/native/minirt/scenes/*.rt`.
  - A `<textarea aria-label="Scene file">` holds the scene text, with a **Render scene** button.
  - A `<canvas width=700 height=700 aria-label="miniRT render" data-frames>` is styled `width:100%; max-width:700px`.
  - A `Rendering…` indicator shows from the moment a start or key is sent until the next frame.
  - On-screen control groups, each button sending the matching key:
    - **Camera:** ← → ↑ ↓ (`a d w s`)
    - **Objects:** left, right, up, down, nearer, farther (arrows, `=`, `-`)
    - **Light:** left, right, up, down, forward, back (`f h t g y u`)
    - **Rotate:** `z x c v`, labelled "Rotate cylinders ⟲ ⟳" and "Rotate planes ⟲ ⟳"
    - **Size:** smaller, bigger (`1 2`)
  - Keyboard: when the canvas has focus, keys go through `minirtKeyToKeysym`.
  - Exit with status 0 (Esc) shows "GAME OVER" and a Restart button.
  - Exit with a non-zero status shows the heading "Your scene has an error" and the collected `Error:` line(s) from the C parser. The textarea stays editable.
  - Starting a new run always terminates the old worker.
- **Copy under the game:** "This is our original miniRT C code, compiled to WebAssembly. It runs in a background thread, so a complex scene can take a few seconds. The error messages come from my scene parser."

- [ ] **Step 1: Write the failing tests** in `tests/e2e/minirt-game.spec.ts`. They reuse the `frames`, `afterFrame` and `picture` helper pattern from `fractol-game.spec.ts`.
  - `renders the default scene`: at least 1 frame, and more than 5 distinct colours.
  - `camera button changes the image`: the hash differs after "Move camera right". This runs in the `phone` project too, so it covers touch.
  - `keyboard moves objects when the picture is focused`: click the canvas and press `ArrowLeft`. A new frame arrives and the hash differs.
  - `a broken scene shows the parser's error and can be fixed`:
    - Set the textarea to `sp 0,0,0 5 255,0,0` and press Render scene.
    - "Your scene has an error" is visible, along with text matching `/Error:/`.
    - Then choose `Basic shapes`, and a frame renders.
  - `the page stays responsive during a heavy render`:
    - Start a `requestAnimationFrame` gap recorder in the page.
    - Choose `Many objects` and wait for its frame. "Rendering…" was visible while waiting.
    - The largest recorded gap is under 250 ms.
  - `holding a key does not queue a backlog`: dispatch 40 `keydown` events for `ArrowLeft`. After 3 s, at most 3 new frames have arrived. Then `Escape` shows GAME OVER within 5 s.
  - `Escape shows GAME OVER and Restart recovers`.
  - `wasm failure shows retry and keeps the briefing`.
  - `the loaded game is accessible and fits the screen`: axe, plus no horizontal overflow. This runs in both projects.
  - Add `miniRT renders on the dev server` to `tests/e2e-dev/games.spec.ts`.
- [ ] **Step 2:** Run `PW_PORT=4361 npx playwright test minirt-game`. Expected: FAIL.
- [ ] **Step 3:** Implement the protocol, the worker, the component and the page wiring. Set the status to `playable`.
  - In `minirt.mdx`, check every sentence of the walkthrough against `vendor/miniRT` and fix any that don't match. The lighting is Blinn–Phong, and the keys act on all objects of a type.
- [ ] **Step 4:** Run `npx vitest run && PW_PORT=4361 npx playwright test && npx playwright test -c playwright.dev.config.ts`. Expected: the full suite passes.
- [ ] **Step 5:** Commit: `feat: playable miniRT in a background worker`. **Stop.** Ask Samuel before pushing `m3-games` for a preview.
  - Local servers can't prove the `vercel.json` worker headers.
  - After his go-ahead to merge, run `PLAYWRIGHT_BASE_URL=https://samuelcglantz.com npx playwright test isolation philo-game minirt-game quality` against the live site and report the result.
