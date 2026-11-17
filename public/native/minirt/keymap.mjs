// Pure input/pixel mappings shared by the site and the tests.
// fract-ol is compiled with its Linux key codes (X11 keysyms).

const KEYSYMS = {
  ArrowLeft: 65361,
  ArrowUp: 65362,
  ArrowRight: 65363,
  ArrowDown: 65364,
  '+': 65451, // KP_Add
  '=': 65451, // the unshifted "+" key on most layouts
  '-': 65453, // KP_Subtract
  Escape: 65307,
};

// miniRT is compiled with the real X11 keysyms (shim/X11/keysym.h).
const MINIRT_KEYSYMS = {
  ArrowLeft: 0xff51,
  ArrowUp: 0xff52,
  ArrowRight: 0xff53,
  ArrowDown: 0xff54,
  Escape: 0xff1b,
  '+': 61, // miniRT's PLUS_KEY is the "=" key
  '=': 61,
  '-': 0x2d,
  1: 0x31,
  2: 0x32,
};
for (const ch of 'acdfghstuvwxyz') MINIRT_KEYSYMS[ch] = ch.charCodeAt(0);

/** X11 event numbers used with Module.mlxweb.queue. */
export const X_EVENT = { KeyPress: 2, ButtonPress: 4, DestroyNotify: 17 };

/** Maps a KeyboardEvent.key to the X11 keysym MiniLibX would deliver, or null. */
export function keyToKeysym(key) {
  return Object.hasOwn(KEYSYMS, key) ? KEYSYMS[key] : null;
}

/** Maps a KeyboardEvent.key to the keysym miniRT handles, or null. Letters are case-insensitive. */
export function minirtKeyToKeysym(key) {
  const k = key.length === 1 ? key.toLowerCase() : key;
  return Object.hasOwn(MINIRT_KEYSYMS, k) ? MINIRT_KEYSYMS[k] : null;
}

/** Maps a wheel delta to the X11 button MiniLibX reports: 4 = scroll up, 5 = scroll down. */
export function wheelToButton(deltaY) {
  if (deltaY < 0) return 4;
  if (deltaY > 0) return 5;
  return null;
}

/** MiniLibX images are 32-bit BGRX; canvas ImageData is RGBA. */
export function bgrxToRgba(src, dst) {
  for (let i = 0; i < src.length; i += 4) {
    dst[i] = src[i + 2];
    dst[i + 1] = src[i + 1];
    dst[i + 2] = src[i];
    dst[i + 3] = 255;
  }
}
