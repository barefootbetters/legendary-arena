/**
 * Node 22 module-customization loader hook for `.vue` files.
 *
 * Exports a single `load` function that intercepts `.vue` URLs, reads
 * the file via `node:fs/promises`, and delegates compilation to the
 * pure `compileVue` helper. All non-`.vue` URLs fall through to the
 * upstream loader (typically `tsx` for `.test.ts` consumers), which
 * is why the documented canonical composition installs `tsx` *before*
 * this loader.
 *
 * `resolve` is intentionally not implemented — default Node resolution
 * handles `./Component.vue` specifiers on both Windows and POSIX when
 * the consumer is written with a relative import. Implementing
 * `resolve` speculatively is a scope violation per WP-065 Locked
 * Decision 8. If a future failing case appears, the fix is to add
 * `resolve` in a follow-up packet after documenting the reproduction.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { compileVue, parseVueBlocks } from './compileVue.js';

/**
 * Context shape Node 22 passes to a loader hook's `load` function.
 * Kept narrow to the fields this loader reads.
 */
interface LoadContext {
  format?: string | null | undefined;
  importAttributes?: Record<string, string> | undefined;
  conditions?: string[] | undefined;
}

/**
 * Return shape expected by Node 22's loader chain.
 */
interface LoadResult {
  format: 'module' | 'commonjs' | 'builtin' | 'json' | 'wasm';
  source: string | ArrayBuffer | Uint8Array;
  shortCircuit?: boolean;
}

/**
 * Signature of the `nextLoad` function Node 22 passes to `load`.
 */
type NextLoad = (
  specifier: string,
  context: LoadContext,
) => LoadResult | Promise<LoadResult>;

/**
 * Node 22 module-loader hook. Branches on `.vue`:
 * - If the URL ends in `.vue`, read the file, compile via
 *   `compileVue`, and short-circuit the loader chain with the ESM
 *   JavaScript source.
 * - Otherwise delegate to `nextLoad` so upstream loaders (TypeScript,
 *   JSON, etc.) still run.
 */
export async function load(
  url: string,
  context: LoadContext,
  nextLoad: NextLoad,
): Promise<LoadResult> {
  // why: the loader intercepts `.vue` only — every other extension
  // must pass through untouched so the TypeScript loader above it
  // still runs on consumer `.test.ts` files.
  if (!url.endsWith('.vue')) {
    return nextLoad(url, context);
  }

  const osNativeFilename = decodeVueUrlToPath(url);
  const source = await readFile(osNativeFilename, 'utf8');
  const { code } = compileVue(source, osNativeFilename);

  if (process.env['DEBUG'] === 'vue-sfc-loader') {
    emitDebugLine(osNativeFilename, source, code);
  }

  return {
    format: 'module',
    source: code,
    shortCircuit: true,
  };
}

/**
 * Convert a module URL to an OS-native filesystem path. Handles both
 * `file://` URLs (Node's standard resolution) and the (rare) case of
 * a bare path — which should not normally appear but is tolerated so
 * the loader never crashes mid-import.
 */
function decodeVueUrlToPath(url: string): string {
  if (url.startsWith('file://')) {
    return fileURLToPath(url);
  }
  return url;
}

/**
 * Write the `DEBUG=vue-sfc-loader` one-liner described in WP-065
 * §Debuggability. Kept inside `loader.ts` so `compileVue` stays pure
 * (no stderr writes, no env reads).
 */
function emitDebugLine(
  osNativeFilename: string,
  source: string,
  code: string,
): void {
  const blocks = parseVueBlocks(source, osNativeFilename);
  const templateFlag = blocks.hasTemplate ? 1 : 0;
  const scriptFlag = blocks.hasScript ? 1 : 0;
  const bytesIn = Buffer.byteLength(source, 'utf8');
  const bytesOut = Buffer.byteLength(code, 'utf8');
  const line =
    `compiled ${osNativeFilename} template=${templateFlag} script=${scriptFlag}` +
    ` styleStripped=${blocks.styleStripped} customStripped=${blocks.customStripped}` +
    ` bytesIn=${bytesIn} bytesOut=${bytesOut}\n`;
  process.stderr.write(line);
}
