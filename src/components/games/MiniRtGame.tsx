import { useCallback, useEffect, useRef, useState } from 'react';
import { importAtRuntime } from '../../lib/native';
import { MAX_PENDING, XK_ESCAPE, type FromWorker, type ToWorker } from '../../lib/minirt-protocol';

const KEYMAP_URL = '/native/minirt/keymap.mjs';

const SCENES = [
  { name: 'Basic shapes', file: '03_basic_shapes' },
  { name: 'Many objects', file: '06_multiple_objects' },
  { name: 'Random 1', file: '13_random_1' },
  { name: 'Random 2', file: '14_random_2' },
] as const;

/** On-screen controls: each button sends the key the original program listens for. */
const CONTROLS: { group: string; buttons: { key: string; label: string; glyph?: string }[] }[] = [
  {
    group: 'Camera',
    buttons: [
      { key: 'a', label: 'Move camera left', glyph: '←' },
      { key: 'd', label: 'Move camera right', glyph: '→' },
      { key: 'w', label: 'Move camera up', glyph: '↑' },
      { key: 's', label: 'Move camera down', glyph: '↓' },
    ],
  },
  {
    group: 'Objects',
    buttons: [
      { key: 'ArrowLeft', label: 'Move objects left', glyph: '←' },
      { key: 'ArrowRight', label: 'Move objects right', glyph: '→' },
      { key: 'ArrowUp', label: 'Move objects up', glyph: '↑' },
      { key: 'ArrowDown', label: 'Move objects down', glyph: '↓' },
      { key: '=', label: 'Move objects nearer', glyph: 'Nearer' },
      { key: '-', label: 'Move objects farther', glyph: 'Farther' },
    ],
  },
  {
    group: 'Light',
    buttons: [
      { key: 'f', label: 'Move light left', glyph: '←' },
      { key: 'h', label: 'Move light right', glyph: '→' },
      { key: 't', label: 'Move light up', glyph: '↑' },
      { key: 'g', label: 'Move light down', glyph: '↓' },
      { key: 'y', label: 'Move light forward', glyph: 'Forward' },
      { key: 'u', label: 'Move light back', glyph: 'Back' },
    ],
  },
  {
    group: 'Rotate',
    buttons: [
      { key: 'z', label: 'Rotate cylinders ⟲' },
      { key: 'x', label: 'Rotate cylinders ⟳' },
      { key: 'v', label: 'Rotate planes ⟲' },
      { key: 'c', label: 'Rotate planes ⟳' },
    ],
  },
  {
    group: 'Size',
    buttons: [
      { key: '1', label: 'Smaller' },
      { key: '2', label: 'Bigger' },
    ],
  },
];

interface Keymap {
  minirtKeyToKeysym(key: string): number | null;
}

type Status = 'loading' | 'running' | 'over' | 'scene-error' | 'error';

export default function MiniRtGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const keymapRef = useRef<Keymap | null>(null);
  const pendingRef = useRef(0);
  const attemptRef = useRef(0);
  const [scene, setScene] = useState('');
  const [chosen, setChosen] = useState<string | null>(SCENES[0].file);
  const [status, setStatus] = useState<Status>('loading');
  const [rendering, setRendering] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const halt = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  /** Starts a fresh program run on `text`. The previous run's worker is always terminated. */
  const run = useCallback(
    async (text: string) => {
      halt();
      const canvas = canvasRef.current;
      if (!canvas) return;
      setStatus('loading');
      setErrors([]);
      setRendering(true);
      pendingRef.current = 0;
      try {
        keymapRef.current ??= await importAtRuntime<Keymap>(KEYMAP_URL);
      } catch {
        setStatus('error');
        return;
      }
      const worker = new Worker(new URL('../../workers/minirt.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      const stderr: string[] = [];
      const ctx = canvas.getContext('2d');

      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        if (workerRef.current !== worker) return;
        const message = e.data;
        switch (message.type) {
          case 'ready':
            setStatus('running');
            break;
          case 'frame': {
            const { width, height, rgba } = message;
            if (canvas.width !== width || canvas.height !== height) {
              canvas.width = width;
              canvas.height = height;
            }
            ctx?.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
            canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
            pendingRef.current = Math.max(0, pendingRef.current - 1);
            if (pendingRef.current === 0) setRendering(false);
            break;
          }
          case 'stderr':
            stderr.push(message.line);
            break;
          case 'exit':
            halt();
            setRendering(false);
            if (message.status === 0) setStatus('over');
            else {
              const lines = stderr.filter((l) => l.startsWith('Error'));
              setErrors(lines.length ? lines : [`The program exited with status ${message.status}.`]);
              setStatus('scene-error');
            }
            break;
          case 'failed':
            halt();
            setRendering(false);
            setStatus('error');
            break;
        }
      };
      worker.onerror = () => {
        if (workerRef.current !== worker) return;
        halt();
        setRendering(false);
        setStatus('error');
      };
      const start: ToWorker = { type: 'start', scene: text, attempt: attemptRef.current };
      worker.postMessage(start);
    },
    [halt],
  );

  const loadScene = useCallback(
    async (file: string) => {
      setChosen(file);
      try {
        const res = await fetch(`/native/minirt/scenes/${file}.rt`);
        if (!res.ok) throw new Error(String(res.status));
        const text = await res.text();
        setScene(text);
        await run(text);
      } catch {
        halt();
        setStatus('error');
      }
    },
    [run, halt],
  );

  useEffect(() => {
    void loadScene(SCENES[0].file);
    return halt;
  }, [loadScene, halt]);

  /** Sends one key press, unless renders are already pending. Esc always gets through. */
  const send = (key: string) => {
    const worker = workerRef.current;
    const keysym = keymapRef.current?.minirtKeyToKeysym(key);
    if (!worker || keysym == null || status !== 'running') return false;
    if (keysym !== XK_ESCAPE) {
      if (pendingRef.current >= MAX_PENDING) return true;
      pendingRef.current++;
      setRendering(true);
    }
    const message: ToWorker = { type: 'key', keysym };
    worker.postMessage(message);
    return true;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (send(e.key)) e.preventDefault();
  };

  const retry = () => {
    attemptRef.current++;
    void (chosen ? loadScene(chosen) : run(scene));
  };

  const idle = status !== 'running';
  const pill = 'border-2 px-3 py-1.5 text-sm font-semibold disabled:opacity-40';
  const control = `${pill} border-magenta text-magenta hover:bg-magenta hover:text-bg disabled:hover:bg-transparent disabled:hover:text-magenta`;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {SCENES.map((s) => (
          <button
            key={s.file}
            type="button"
            aria-pressed={chosen === s.file}
            onClick={() => void loadScene(s.file)}
            className={`${pill} border-cyan/60 text-cyan aria-pressed:bg-cyan aria-pressed:text-bg`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="relative mt-4 max-w-[700px]">
        <canvas
          ref={canvasRef}
          width={700}
          height={700}
          tabIndex={0}
          role="img"
          aria-label="miniRT render"
          data-frames="0"
          onKeyDown={onKeyDown}
          className="block h-auto bg-bg"
          style={{ width: '100%', maxWidth: '700px', aspectRatio: '1 / 1' }}
        />
        {rendering && status !== 'over' && status !== 'scene-error' && status !== 'error' && (
          <p className="absolute top-2 left-2 border-2 border-cyan bg-bg/90 px-2 py-1 text-sm text-cyan">Rendering…</p>
        )}
        {(status === 'over' || status === 'scene-error' || status === 'error') && (
          <div className="absolute inset-0 grid place-items-center overflow-auto bg-bg/90 p-6 text-center">
            {status === 'over' && (
              <div>
                <p className="font-display glow-magenta text-lg sm:text-2xl">GAME OVER</p>
                <p className="mt-3 text-text">The program quit, just as it does when you press Esc or close its window on Linux.</p>
                <button type="button" onClick={() => void run(scene)} className={`${control} mt-5`}>
                  Restart
                </button>
              </div>
            )}
            {status === 'scene-error' && (
              <div role="alert">
                <p className="text-lg text-warn">Your scene has an error</p>
                {errors.map((line) => (
                  <p key={line} className="mt-3 font-mono text-sm break-words text-text">
                    {line}
                  </p>
                ))}
                <p className="mt-3 text-muted">Fix the scene file below and render it again, or pick a scene.</p>
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

      <div className="mt-4 space-y-3">
        {CONTROLS.map(({ group, buttons }) => (
          <div key={group} role="group" aria-label={group} className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-sm text-muted" aria-hidden="true">
              {group}
            </span>
            {buttons.map(({ key, label, glyph }) => (
              <button
                key={key}
                type="button"
                disabled={idle}
                aria-label={glyph ? label : undefined}
                onClick={() => send(key)}
                className={`${control} min-w-10`}
              >
                {glyph ? <span aria-hidden="true">{glyph}</span> : label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        With a keyboard: click the picture first. W A S D move the camera, the arrow keys and + and - move the objects, T F G H
        Y U move the light, Z X C V rotate, and 1 and 2 resize. Esc quits the program. Every key moves all objects of that
        kind at once, as in the original.
      </p>

      <label className="mt-6 block text-sm font-semibold" htmlFor="minirt-scene">
        Scene file
      </label>
      <textarea
        id="minirt-scene"
        aria-label="Scene file"
        value={scene}
        onChange={(e) => {
          setScene(e.target.value);
          setChosen(null);
        }}
        spellCheck={false}
        rows={8}
        className="mt-2 block w-full border-2 border-muted/30 bg-bg p-2 font-mono text-xs text-text"
      />
      <button type="button" onClick={() => void run(scene)} className={`${control} mt-3`}>
        Render scene
      </button>
    </div>
  );
}
