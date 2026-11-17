/// <reference lib="webworker" />
// Runs one miniRT program in the background, so a slow render never freezes the page.
// One worker is one program run: the page terminates it to start another.
import { importAtRuntime, loadNative } from '../lib/native';
import { MAX_PENDING, XK_ESCAPE, type FromWorker, type ToWorker } from '../lib/minirt-protocol';

const MODULE_URL = '/native/minirt/minirt.mjs';
const KEYMAP_URL = '/native/minirt/keymap.mjs';

interface MlxHost {
  queue: number[][];
  blit(pixels: Uint8Array, width: number, height: number): void;
}

interface MiniRtModule {
  callMain(args: string[]): void;
  FS: { writeFile(path: string, data: string): void };
  mlxweb?: MlxHost;
}

interface Keymap {
  X_EVENT: { KeyPress: number };
  bgrxToRgba(src: Uint8Array, dst: Uint8Array | Uint8ClampedArray): void;
}

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (message: FromWorker, transfer: Transferable[] = []) => scope.postMessage(message, transfer);

let host: MlxHost | null = null;
let keyPress = 2;

async function start(scene: string, attempt = 0) {
  try {
    const retry = attempt ? `?retry=${attempt}` : '';
    const [keymap, mod] = await Promise.all([
      importAtRuntime<Keymap>(KEYMAP_URL + retry),
      loadNative<MiniRtModule>(MODULE_URL + retry, {
        print: () => {},
        printErr: (line) => post({ type: 'stderr', line }),
        onExit: (status) => {
          host = null;
          post({ type: 'exit', status });
        },
      }),
    ]);
    keyPress = keymap.X_EVENT.KeyPress;
    host = {
      queue: [],
      blit(pixels, width, height) {
        const rgba = new Uint8ClampedArray(width * height * 4);
        keymap.bgrxToRgba(pixels, rgba);
        post({ type: 'frame', width, height, rgba: rgba.buffer }, [rgba.buffer]);
      },
    };
    mod.mlxweb = host;
    mod.FS.writeFile('/scene.rt', scene);
    post({ type: 'ready' });
    try {
      mod.callMain(['/scene.rt']);
    } catch (e) {
      if ((e as { name?: string })?.name !== 'ExitStatus') throw e;
    }
  } catch {
    post({ type: 'failed' });
  }
}

scope.onmessage = (e: MessageEvent<ToWorker>) => {
  const message = e.data;
  if (message.type === 'start') void start(message.scene, message.attempt);
  else if (message.type === 'key' && host) {
    // Keys that arrive while a render is running are dropped, never queued. Esc always gets through.
    if (message.keysym !== XK_ESCAPE && host.queue.length >= MAX_PENDING) return;
    host.queue.push([keyPress, message.keysym, 0, 0]);
  }
};
