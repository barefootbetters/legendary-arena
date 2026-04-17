/**
 * `compileVue` — pure function that transforms a Vue 3 Single-File
 * Component source string into an ESM JavaScript module string suitable
 * for Node 22's module loader chain.
 *
 * This helper exists so `node:test` consumers (and the loader hook in
 * `loader.ts`) can treat `.vue` files as importable JavaScript modules
 * without installing a bundler (Vite, esbuild, rollup, swc, babel).
 *
 * Contract (load-bearing):
 * - Pure function: no I/O, no logging, no wall-clock reads, no RNG,
 *   no mutation of inputs.
 * - Input `filename` is POSIX-normalized before it is passed to the
 *   compiler as `id`. This is what makes output byte-identical across
 *   Windows and Linux CI.
 * - Output `code` is always ESM JavaScript. TypeScript syntax emitted
 *   by `@vue/compiler-sfc.compileScript` (observed at Vue ^3.4.27 —
 *   see D-NNNN "TS strategy outcome") is stripped inside this helper
 *   via `typescript.transpileModule`. Node's loader chain does not
 *   re-transform the string returned from `load()`.
 * - `<style>` blocks and unknown custom blocks are intentionally
 *   stripped. This is documented test-time behavior, not a silent
 *   fallback.
 * - Errors are thrown as full-sentence `Error` objects naming the
 *   OS-native file path and the compiler diagnostic. Moves never throw
 *   in this project, but `compileVue` is not a move — it is a pure
 *   build-time helper and throwing on invalid input is the appropriate
 *   contract.
 */

import {
  parse,
  compileScript,
  compileTemplate,
  rewriteDefault,
} from '@vue/compiler-sfc';
import * as typescript from 'typescript';

/**
 * The locked public return shape. Kept narrow on purpose: future
 * consumers that need compile statistics (styleStripped counts, etc.)
 * obtain them via `parseVueBlocks` below so this shape stays stable.
 */
export interface CompileVueResult {
  code: string;
  map?: string;
}

/**
 * Block-count summary used by `loader.ts`'s `DEBUG=vue-sfc-loader`
 * output. Exported as a separate helper so `compileVue`'s return
 * shape stays locked per EC-065.
 */
export interface VueBlockCounts {
  hasTemplate: boolean;
  hasScript: boolean;
  styleStripped: number;
  customStripped: number;
}

/**
 * Parse an SFC and count its blocks without compiling. Used by
 * `loader.ts` to populate the DEBUG one-liner. Kept separate from
 * `compileVue` so the public compile signature stays narrow.
 */
export function parseVueBlocks(
  source: string,
  filename: string,
): VueBlockCounts {
  const posixFilename = toPosix(filename);
  const parsed = parse(source, { filename: posixFilename });
  const descriptor = parsed.descriptor;
  return {
    hasTemplate: descriptor.template !== null,
    hasScript:
      descriptor.script !== null || descriptor.scriptSetup !== null,
    styleStripped: descriptor.styles.length,
    customStripped: descriptor.customBlocks.length,
  };
}

/**
 * Compile a Vue 3 SFC source string to a single ESM JavaScript module.
 *
 * @param source   Raw `.vue` file contents.
 * @param filename OS-native file path. Retained for error messages.
 *                 POSIX-normalized before being passed to the compiler
 *                 as `id` so output is deterministic across OSes.
 * @returns `{ code, map? }` where `code` is ESM JavaScript and `map`
 *          is an inline sourcemap comment when one could be produced.
 */
export function compileVue(
  source: string,
  filename: string,
): CompileVueResult {
  // why: deterministic compiler identity across Windows and Linux CI;
  // a byte-for-byte identical output on both platforms is the test
  // invariant that makes this package portable.
  const posixFilename = toPosix(filename);
  const osNativeFilename = filename;

  const parsed = parse(source, { filename: posixFilename });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    const detail =
      first !== undefined && typeof first === 'object' && 'message' in first
        ? String(first.message)
        : String(first ?? 'unknown parse error');
    throw new Error(
      `Compilation of "${osNativeFilename}" failed in SFC parse: ${detail}.`,
    );
  }

  const descriptor = parsed.descriptor;
  const hasTemplate = descriptor.template !== null;
  const hasScript =
    descriptor.script !== null || descriptor.scriptSetup !== null;

  if (!hasTemplate && !hasScript) {
    throw new Error(
      `Compilation of "${osNativeFilename}" failed: the SFC has zero <template> blocks and zero <script> blocks. Provide at least one <template> or one <script> block.`,
    );
  }

  const scriptVariableName = '_sfc_main';
  const bodyParts: string[] = [];
  let scriptLangIsTypeScript = false;

  if (hasScript) {
    bodyParts.push(
      buildScriptSection(
        descriptor,
        posixFilename,
        osNativeFilename,
        scriptVariableName,
      ),
    );
    scriptLangIsTypeScript = isScriptTypeScript(descriptor);
  } else {
    // why: template-only SFC is valid per WP-065 §B; synthesize a
    // default component object so the template's render function has
    // something to attach to.
    bodyParts.push(`const ${scriptVariableName} = {};`);
  }

  if (hasTemplate) {
    bodyParts.push(
      buildTemplateSection(
        descriptor,
        posixFilename,
        osNativeFilename,
        scriptVariableName,
      ),
    );
  }

  // why: `<style>` blocks and unknown custom blocks are intentionally
  // stripped at test time — jsdom ignores CSS, and component tests
  // assert on text and a11y, not visual styles. The stripping is
  // surfaced via `parseVueBlocks` so `loader.ts`'s DEBUG output can
  // report the counts.
  // (No code emission for descriptor.styles or descriptor.customBlocks.)

  bodyParts.push(`export default ${scriptVariableName};`);

  let code = bodyParts.join('\n');

  if (scriptLangIsTypeScript) {
    code = transpileTypeScript(code, posixFilename);
  }

  const mapString = buildInlineSourceMap(posixFilename, source);
  code = `${code}\n${mapString}\n`;

  // why: `exactOptionalPropertyTypes: true` in the repo's strict
  // tsconfig forbids assigning a `string | undefined` to an optional
  // `string` property. Build the base object, then conditionally
  // assign `map` only when we have a value. Precedent: D-2206 /
  // WP-029 `preserveHandCards`.
  const result: { code: string; map?: string } = { code };
  if (mapString !== undefined) {
    result.map = mapString;
  }
  return result;
}

/**
 * POSIX-normalize a filename. Backslashes become forward slashes so
 * `C:\fix\hello.vue` and `/fix/hello.vue` become equivalent compiler
 * `id`s. The drive letter is preserved literally — `@vue/compiler-sfc`
 * treats the whole string as opaque identity.
 */
function toPosix(filename: string): string {
  return filename.replace(/\\/g, '/');
}

/**
 * True when the descriptor has a `<script lang="ts">` or
 * `<script setup lang="ts">` block.
 */
function isScriptTypeScript(
  descriptor: ReturnType<typeof parse>['descriptor'],
): boolean {
  if (descriptor.scriptSetup !== null && descriptor.scriptSetup.lang === 'ts') {
    return true;
  }
  if (descriptor.script !== null && descriptor.script.lang === 'ts') {
    return true;
  }
  return false;
}

/**
 * Compile the script block (either `<script>` or `<script setup>`)
 * and rewrite its `export default ...` into `const _sfc_main = ...`
 * so the template's render function can later attach to it.
 */
function buildScriptSection(
  descriptor: ReturnType<typeof parse>['descriptor'],
  posixFilename: string,
  osNativeFilename: string,
  scriptVariableName: string,
): string {
  let scriptResult;
  try {
    scriptResult = compileScript(descriptor, {
      id: posixFilename,
      babelParserPlugins: ['typescript'],
      inlineTemplate: false,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Compilation of "${osNativeFilename}" failed in <script>: ${detail}.`,
    );
  }

  const parserPlugins =
    scriptResult.lang === 'ts' ? (['typescript'] as const) : [];
  try {
    return rewriteDefault(
      scriptResult.content,
      scriptVariableName,
      [...parserPlugins],
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Compilation of "${osNativeFilename}" failed while rewriting the <script> default export: ${detail}.`,
    );
  }
}

/**
 * Compile the template block and strip its `export` keyword so the
 * render function becomes a local binding that can be attached to
 * `_sfc_main` before the final default export.
 */
function buildTemplateSection(
  descriptor: ReturnType<typeof parse>['descriptor'],
  posixFilename: string,
  osNativeFilename: string,
  scriptVariableName: string,
): string {
  const template = descriptor.template;
  if (template === null) {
    throw new Error(
      `Compilation of "${osNativeFilename}" failed: the template section was requested but parse() returned no template descriptor.`,
    );
  }

  let templateResult;
  try {
    templateResult = compileTemplate({
      source: template.content,
      filename: posixFilename,
      id: posixFilename,
      compilerOptions: {},
      transformAssetUrls: false,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Compilation of "${osNativeFilename}" failed in <template>: ${detail}.`,
    );
  }

  if (templateResult.errors.length > 0) {
    const first = templateResult.errors[0];
    const detail =
      first !== undefined && typeof first === 'object' && 'message' in first
        ? String(first.message)
        : String(first ?? 'unknown template error');
    throw new Error(
      `Compilation of "${osNativeFilename}" failed in <template>: ${detail}.`,
    );
  }

  const localRender = templateResult.code.replace(
    /^export function render\b/m,
    'function render',
  );
  return `${localRender}\n${scriptVariableName}.render = render;`;
}

/**
 * Feed a mixed TS/JS module body through `typescript.transpileModule`
 * to produce ESM JavaScript that Node 22 can execute directly.
 *
 * Settings match the canonical pass described in WP-065 Non-Negotiable
 * Constraints: `module: 'ESNext'`, `target: 'ES2022'`.
 */
function transpileTypeScript(
  source: string,
  posixFilename: string,
): string {
  const transpiled = typescript.transpileModule(source, {
    fileName: posixFilename,
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
      sourceMap: false,
      esModuleInterop: true,
      isolatedModules: true,
    },
  });
  return transpiled.outputText;
}

/**
 * Build a minimal inline sourcemap comment. The acceptance target per
 * WP-065 and Locked Decision 9 is "stack traces contain the `.vue`
 * path and a non-zero line number" — perfect column accuracy is
 * explicitly out of scope. A one-segment identity mapping against the
 * full source content is sufficient to satisfy that contract.
 */
function buildInlineSourceMap(
  posixFilename: string,
  source: string,
): string {
  const sourceMap = {
    version: 3,
    file: posixFilename,
    sources: [posixFilename],
    sourcesContent: [source],
    names: [] as string[],
    mappings: 'AAAA',
  };
  const jsonString = JSON.stringify(sourceMap);
  const base64 = Buffer.from(jsonString, 'utf8').toString('base64');
  return `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${base64}`;
}
