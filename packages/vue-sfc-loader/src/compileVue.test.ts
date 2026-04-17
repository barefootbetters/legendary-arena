/**
 * Tests for `compileVue` — the pure SFC-to-ESM transform.
 *
 * Uses `node:test` + `node:assert` per repo policy (no Vitest / Jest /
 * Mocha). Reads the committed `test-fixtures/hello.vue` via
 * `node:fs/promises` rather than bundling the source inline so the
 * fixture-sharing path is exercised end-to-end.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import { compileVue } from './compileVue.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(currentDirectory, '..', 'test-fixtures', 'hello.vue');
// why: child process must resolve `vue` through the workspace's
// node_modules tree; placing the temp file inside the package root
// lets Node's resolver walk upward to the monorepo's pnpm store.
const packageRoot = resolve(currentDirectory, '..');

/** Strip the inline sourcemap comment for byte-equivalence checks. */
function stripSourceMapComment(code: string): string {
  return code.replace(/\r?\n\/\/# sourceMappingURL=[^\n]*/g, '');
}

test('compileVue emits a single top-level `export default` statement', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const { code } = compileVue(source, fixturePath);

  const exportDefaultMatches = code.match(/^export default\b/gm);
  assert.equal(
    exportDefaultMatches !== null && exportDefaultMatches.length === 1,
    true,
    'emitted module must have exactly one top-level `export default`',
  );
});

test('compileVue strips the <style> block from emitted code', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const { code } = compileVue(source, fixturePath);

  assert.equal(
    code.includes('color: red'),
    false,
    'style block contents must not appear in compiled output',
  );
  assert.equal(
    code.includes('<style>'),
    false,
    'raw style tags must not appear in compiled output',
  );
});

test('compileVue is deterministic — two identical calls produce byte-identical bodies', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const firstCall = compileVue(source, fixturePath).code;
  const secondCall = compileVue(source, fixturePath).code;
  assert.equal(
    stripSourceMapComment(firstCall),
    stripSourceMapComment(secondCall),
    'repeated calls must produce byte-identical module bodies',
  );
});

test('compileVue produces byte-identical bodies for Windows and POSIX filenames', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const windowsOutput = compileVue(source, 'C:\\fix\\hello.vue').code;
  const posixOutput = compileVue(source, '/fix/hello.vue').code;
  assert.equal(
    stripSourceMapComment(windowsOutput),
    stripSourceMapComment(posixOutput),
    'POSIX-normalized compiler identity must erase filename-slash differences',
  );
});

test('compileVue accepts a template-only SFC', () => {
  const source = '<template><p>hi</p></template>';
  const { code } = compileVue(source, 'template-only.vue');
  assert.equal(
    /export default\s+_sfc_main/.test(code),
    true,
    'template-only SFC must still export a component default',
  );
  assert.equal(
    code.includes('render'),
    true,
    'template-only SFC must include a render function',
  );
});

test('compileVue accepts a script-only SFC', () => {
  const source = `<script>export default { name: 'ScriptOnly' }</script>`;
  const { code } = compileVue(source, 'script-only.vue');
  assert.equal(
    /export default\s+_sfc_main/.test(code),
    true,
    'script-only SFC must still export a component default',
  );
});

test('compileVue throws when the SFC has zero <template> and zero <script> blocks', () => {
  const source = '<style>.x{}</style>';
  assert.throws(
    () => compileVue(source, 'no-blocks.vue'),
    (error: unknown) => {
      if (!(error instanceof Error)) return false;
      const includesFile = error.message.includes('no-blocks.vue');
      const isFullSentence = error.message.trim().endsWith('.');
      return includesFile && isFullSentence;
    },
    'zero-block SFC must throw a full-sentence error naming the file',
  );
});

test('compileVue throws a full-sentence error naming file and diagnostic on malformed input', () => {
  const malformed = '<template><div></template>';
  assert.throws(
    () => compileVue(malformed, 'malformed.vue'),
    (error: unknown) => {
      if (!(error instanceof Error)) return false;
      return (
        error.message.includes('malformed.vue') &&
        error.message.trim().endsWith('.')
      );
    },
    'malformed SFC must throw a full-sentence error naming the file',
  );
});

test('compiled output is parseable by Node 22 as ESM JavaScript', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const { code } = compileVue(source, fixturePath);

  const tempFilePath = resolve(packageRoot, `.compileVue-verify-${process.pid}.mjs`);
  await writeFile(tempFilePath, code, 'utf8');
  try {
    const tempFileUrl = pathToFileURL(tempFilePath).href;
    const child = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const mod = await import(${JSON.stringify(tempFileUrl)}); if (!mod.default) throw new Error('no default export from compiled output');`,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(
      child.status,
      0,
      `child process must exit 0; stderr was: ${child.stderr}`,
    );
    assert.equal(
      child.stderr.includes('SyntaxError'),
      false,
      `compiled output must not produce a SyntaxError; stderr was: ${child.stderr}`,
    );
  } finally {
    await unlink(tempFilePath);
  }
});
