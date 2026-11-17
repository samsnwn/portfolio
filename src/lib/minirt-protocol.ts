/** Messages between the miniRT game and the background worker that runs the compiled C. */

export type ToWorker =
  /** `attempt` > 0 asks for a fresh download after a failed load. */
  | { type: 'start'; scene: string; attempt?: number }
  | { type: 'key'; keysym: number };

export type FromWorker =
  | { type: 'ready' }
  | { type: 'frame'; width: number; height: number; rgba: ArrayBuffer }
  | { type: 'stderr'; line: string }
  | { type: 'exit'; status: number }
  | { type: 'failed' };

/** X11 keysym for Escape: always delivered, so the program can always be quit. */
export const XK_ESCAPE = 0xff1b;

/** Every key makes the C re-render the whole scene; more pending than this are dropped. */
export const MAX_PENDING = 2;
