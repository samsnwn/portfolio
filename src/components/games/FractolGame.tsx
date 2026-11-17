import { useCallback, useEffect, useRef, useState } from 'react';
import { loadNative } from '../../lib/native';

const MODULE_URL = '/native/fractol/fractol.mjs';
const KEYMAP_URL = '/native/fractol/keymap.mjs';

/** What the fake MiniLibX inside the compiled program talks to (see shim/mlx in the native repo). */
interface MlxHost {
  /** X11-style events for the program's hooks: [type, a, b, c]. */
  queue: number[][];
  /** Called by mlx_put_image_to_window with the image's BGRX pixels. */
  blit(pixels: Uint8Array, width: number, height: number): void;
}

interface FractolModule {
  callMain(args: string[]): void;
  mlxweb?: MlxHost;
}

interface Keymap {
  X_EVENT: { KeyPress: number; ButtonPress: number; DestroyNotify: number };
  keyToKeysym(key: string): number | null;
  wheelToButton(deltaY: number): number | null;
  bgrxToRgba(src: Uint8Array, dst: Uint8ClampedArray): void;
}

const PRESETS = [
  { name: 'Mandelbrot', args: ['mandelbrot'] },
  { name: 'Julia A', args: ['julia', '-0.8', '0.156'] },
  { name: 'Julia B', args: ['julia', '0.285', '0.01'] },
] as const;

type Status = 'loading' | 'running' | 'over' | 'error';

/**
 * Every event makes the C redraw the whole picture. A held key or a fast wheel sends events far
 * quicker than frames can be drawn, so extra ones are dropped instead of queued up.
 */
const MAX_QUEUED = 2;

export default function FractolGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<MlxHost | null>(null);
  const keymapRef = useRef<Keymap | null>(null);
  const runRef = useRef(0);
  const attemptRef = useRef(0);
  const [preset, setPreset] = useState(0);
  const [status, setStatus] = useState<Status>('loading');

  /** Asks the running program to close its window, which makes the C call exit(). */
  const stop = useCallback(() => {
    const host = hostRef.current;
    const keymap = keymapRef.current;
    hostRef.current = null;
    if (host && keymap) host.queue.push([keymap.X_EVENT.DestroyNotify, 0, 0, 0]);
  }, []);

  const start = useCallback(
    async (presetIndex: number) => {
      stop();
      const run = ++runRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.dataset.frames = '0';
      setPreset(presetIndex);
      setStatus('loading');

      try {
        const retry = attemptRef.current ? `?retry=${attemptRef.current}` : '';
        const [keymap, mod] = await Promise.all([
          import(/* @vite-ignore */ KEYMAP_URL + retry) as Promise<Keymap>,
          loadNative<FractolModule>(MODULE_URL + retry, {
            print: () => {},
            printErr: () => {},
            onExit: () => {
              // Only the instance on screen ends the game; replaced instances exit quietly.
              if (runRef.current === run) {
                hostRef.current = null;
                setStatus('over');
              }
            },
          }),
        ]);
        if (runRef.current !== run) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        let image: ImageData | null = null;
        const host: MlxHost = {
          queue: [],
          blit(pixels, width, height) {
            if (!image || image.width !== width || image.height !== height) {
              canvas.width = width;
              canvas.height = height;
              image = ctx.createImageData(width, height);
            }
            keymap.bgrxToRgba(pixels, image.data);
            ctx.putImageData(image, 0, 0);
            canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
          },
        };
        mod.mlxweb = host;
        keymapRef.current = keymap;
        hostRef.current = host;
        setStatus('running');
        try {
          mod.callMain([...PRESETS[presetIndex].args]);
        } catch (e) {
          if ((e as { name?: string })?.name !== 'ExitStatus') throw e;
        }
      } catch {
        if (runRef.current === run) setStatus('error');
      }
    },
    [stop],
  );

  useEffect(() => {
    void start(0);
    return () => {
      runRef.current++;
      stop();
    };
  }, [start, stop]);

  const send = useCallback((event: number[], times = 1) => {
    const host = hostRef.current;
    if (!host) return;
    for (let i = 0; i < times; i++) host.queue.push(event);
  }, []);

  const key = (name: string) => {
    const keymap = keymapRef.current;
    const keysym = keymap?.keyToKeysym(name);
    if (keymap && keysym != null) send([keymap.X_EVENT.KeyPress, keysym, 0, 0]);
  };

  const zoom = (button: 4 | 5) => {
    const keymap = keymapRef.current;
    const canvas = canvasRef.current;
    if (keymap && canvas) send([keymap.X_EVENT.ButtonPress, button, canvas.width / 2, canvas.height / 2], 2);
  };

  // The wheel listener must be non-passive so the page does not scroll while zooming.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      const keymap = keymapRef.current;
      const host = hostRef.current;
      // Only take over the wheel once the visitor has clicked the picture: otherwise the page scrolls.
      if (!keymap || !host || document.activeElement !== canvas) return;
      e.preventDefault();
      const button = keymap.wheelToButton(e.deltaY);
      if (button === null || host.queue.length >= MAX_QUEUED) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
      const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);
      host.queue.push([keymap.X_EVENT.ButtonPress, button, x, y]);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const keymap = keymapRef.current;
    if (!keymap || !hostRef.current) return;
    const keysym = keymap.keyToKeysym(e.key);
    if (keysym === null) return;
    e.preventDefault();
    // Esc always gets through; other keys are dropped while frames are still pending.
    if (e.key !== 'Escape' && hostRef.current.queue.length >= MAX_QUEUED) return;
    send([keymap.X_EVENT.KeyPress, keysym, 0, 0]);
  };

  const retry = () => {
    attemptRef.current++;
    void start(preset);
  };

  const idle = status !== 'running';
  const pill = 'border-2 px-3 py-1.5 text-sm font-semibold disabled:opacity-40';
  const control = `${pill} border-magenta text-magenta hover:bg-magenta hover:text-bg disabled:hover:bg-transparent disabled:hover:text-magenta`;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.name}
            type="button"
            aria-pressed={preset === i}
            onClick={() => void start(i)}
            className={`${pill} border-cyan/60 text-cyan aria-pressed:bg-cyan aria-pressed:text-bg`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="relative mt-4">
        <canvas
          ref={canvasRef}
          width={1000}
          height={800}
          tabIndex={0}
          role="img"
          aria-label="fract-ol render"
          data-frames="0"
          onKeyDown={onKeyDown}
          className="block h-auto w-full bg-bg"
          style={{ aspectRatio: '5 / 4' }}
        />
        {status !== 'running' && (
          <div className="absolute inset-0 grid place-items-center bg-bg/85 p-6 text-center">
            {status === 'loading' && <p className="font-display fx-blink text-sm text-magenta">Loading…</p>}
            {status === 'over' && (
              <div>
                <p className="font-display glow-magenta text-lg sm:text-2xl">GAME OVER</p>
                <p className="mt-3 text-text">The program quit, just as it does when you press Esc or close its window on Linux.</p>
                <button type="button" onClick={() => void start(preset)} className={`${control} mt-5`}>
                  Restart
                </button>
              </div>
            )}
            {status === 'error' && (
              <div role="alert">
                <p className="text-lg">The game couldn't load.</p>
                <p className="mt-2 text-muted">Check your connection and try again. The briefing above still tells you what it does.</p>
                <button type="button" onClick={retry} className={`${control} mt-5`}>
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" disabled={idle} onClick={() => zoom(4)} className={control}>
          Zoom in
        </button>
        <button type="button" disabled={idle} onClick={() => zoom(5)} className={control}>
          Zoom out
        </button>
        <span className="mx-1 hidden h-6 w-px bg-muted/40 sm:block" aria-hidden="true" />
        {(
          [
            ['ArrowLeft', '←', 'Move left'],
            ['ArrowUp', '↑', 'Move up'],
            ['ArrowDown', '↓', 'Move down'],
            ['ArrowRight', '→', 'Move right'],
          ] as const
        ).map(([name, glyph, label]) => (
          <button key={name} type="button" disabled={idle} aria-label={label} onClick={() => key(name)} className={`${control} min-w-10`}>
            <span aria-hidden="true">{glyph}</span>
          </button>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-muted/40 sm:block" aria-hidden="true" />
        <button type="button" disabled={idle} onClick={() => key('+')} className={control}>
          More detail
        </button>
        <button type="button" disabled={idle} onClick={() => key('-')} className={control}>
          Less detail
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">
        With a mouse and keyboard: click the picture first, then scroll to zoom, use the arrow keys to move, and + and - for
        detail. Esc quits the program.
      </p>
    </div>
  );
}
