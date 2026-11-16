# ADR 0002: Run minishell inside a v86 Linux VM

Status: accepted (2026-11-16)

## Context
minishell depends on `fork`, `execve`, `waitpid`, `sigaction`, pipes and `readline`. WebAssembly in the browser has no processes. Compiling with `fork` stubbed out would break pipes and external commands, so the result wouldn't really be minishell.

## Decision
Use the **v86** x86 emulator to boot a minimal Linux image (Buildroot or similar, 32-bit) that contains the statically linked minishell binary plus basic userland tools (`ls`, `cat`, `grep`, `wc`…). A saved VM state snapshot lets it start almost instantly, and a "booting terminal…" screen hides the load.

## Consequences
- Fully authentic: real processes, pipes, signals and readline.
- Large download, targeted at under 20 MB compressed. It's loaded only on `/play/minishell`.
- Needs a keyboard, so mobile visitors get a recorded demo instead.
- The riskiest piece, so it's scheduled late (milestone M4) and doesn't block anything else.
