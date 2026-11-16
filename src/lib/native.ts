/** Options every Emscripten module factory accepts. */
export interface NativeOptions {
  print?: (line: string) => void;
  printErr?: (line: string) => void;
  onExit?: (status: number) => void;
}

/**
 * Loads a compiled C project (an Emscripten ES module in /public/native) at runtime.
 * The .wasm file is fetched from the same folder as the module, so everything stays same-origin.
 */
export async function loadNative<M>(url: string, opts: NativeOptions = {}): Promise<M> {
  const { default: create } = (await import(/* @vite-ignore */ url)) as {
    default: (opts: NativeOptions) => Promise<M>;
  };
  return create(opts);
}
