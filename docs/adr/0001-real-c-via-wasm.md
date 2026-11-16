# ADR 0001: Run the real C code in the browser via WebAssembly

Status: accepted (2026-11-16)

## Context
The playable 42 projects (push_swap, fractol, philo, miniRT) are written in C against Unix and MiniLibX (X11). The simpler option was to reimplement each one in TypeScript or WebGL. That would be smoother and quicker to build, but it would show new code rather than the code that passed 42 evaluation.

## Decision
Compile the original C sources with **Emscripten**. Changes to the source stay minimal and are kept as patches.
- fractol and miniRT link against a small **fake MiniLibX** that draws to a `<canvas>` and maps browser input to X11 events.
- philo uses Emscripten pthreads.
- minishell can't run this way because it needs `fork`/`execve`. See ADR 0002.

## Consequences
- The site can honestly say "this is my real code running", which is a strong interview talking point.
- miniRT renders on the CPU, so it can't orbit smoothly at full resolution. It uses a low-resolution preview that refines progressively.
- Threads require cross-origin isolation headers, which constrains hosting (ADR 0003).
- The build needs an Emscripten toolchain, run in Docker inside the private `portfolio-native` repo.
- Shipped WASM can be decompiled. That's an accepted risk, since the source itself is never published.
