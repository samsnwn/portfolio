/** Options every Emscripten module factory accepts. */
export interface NativeOptions {
  print?: (line: string) => void;
  printErr?: (line: string) => void;
  onExit?: (status: number) => void;
}

/**
 * `import(url)` that the bundler never sees.
 *
 * The compiled games live in /public and are loaded by URL at runtime. In dev, Vite rewrites every
 * dynamic `import(variable)` to add an `?import` marker, and then refuses it for /public files
 * ("should not be imported from source code"). Building the call at runtime keeps the URL as-is
 * in dev and in production alike.
 */
export type ModuleImporter = <T>(url: string) => Promise<T>;

export const importAtRuntime = new Function('url', 'return import(url)') as ModuleImporter;

/**
 * Loads a compiled C project (an Emscripten ES module in /public/native) at runtime.
 * The .wasm file is fetched from the same folder as the module, so everything stays same-origin.
 */
export async function loadNative<M>(
  url: string,
  opts: NativeOptions = {},
  /** Tests running outside a browser pass their own importer. */
  importModule: ModuleImporter = importAtRuntime,
): Promise<M> {
  const { default: create } = await importModule<{ default: (opts: NativeOptions) => Promise<M> }>(url);
  return create(opts);
}
