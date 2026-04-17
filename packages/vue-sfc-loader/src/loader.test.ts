/**
 * End-to-end tests for the Node 22 `.vue` loader hook.
 *
 * Loader hooks install per-process. Verifying them in-process would
 * only prove that `module.register` accepts the hook — it would not
 * prove that `import Hello from './hello.vue'` resolves, compiles,
 * and mounts. So each scenario spawns a fresh child Node process
 * with the canonical `NODE_OPTIONS` composition, runs a tiny script
 * that imports a `.vue` file, and asserts on the child's exit code
 * and output.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(currentDirectory, '..');
const fixturePath = resolve(packageRoot, 'test-fixtures', 'hello.vue');

/** Canonical `NODE_OPTIONS` composition documented in README.md. */
const canonicalNodeOptions =
  '--import tsx --import @legendary-arena/vue-sfc-loader/register';

// why: loader hooks install per-process, so verifying them requires
// spawning a fresh Node process with the `--import` flags. In-process
// testing would verify hook registration in isolation but not actual
// import resolution or `.vue` compilation end-to-end.

test('loader imports and mounts a .vue fixture via @vue/test-utils + jsdom', () => {
  const driverCode = `
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.MathMLElement = dom.window.MathMLElement;
// why: Node 22+ makes globalThis.navigator a read-only getter, so we
// defineProperty to override it rather than assigning through =.
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });

const { mount } = await import('@vue/test-utils');
const HelloModule = await import(${JSON.stringify(pathToFileURL(fixturePath).href)});
const wrapper = mount(HelloModule.default, { props: { name: 'Claude' } });
const rendered = wrapper.text();
if (rendered !== 'Hello, Claude!') {
  console.error('UNEXPECTED_TEXT:' + rendered);
  process.exit(2);
}
console.log('MOUNT_OK');
`;

  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', driverCode],
    {
      encoding: 'utf8',
      cwd: packageRoot,
      env: {
        ...process.env,
        NODE_OPTIONS: canonicalNodeOptions,
      },
    },
  );
  assert.equal(
    child.status,
    0,
    `child process exited with status ${child.status}; stderr was:\n${child.stderr}`,
  );
  assert.equal(
    child.stdout.includes('MOUNT_OK'),
    true,
    `child stdout did not include MOUNT_OK; stdout was:\n${child.stdout}\nstderr:\n${child.stderr}`,
  );
});

test('loader stack trace from a broken fixture names the .vue path', async () => {
  const tempDirectory = await mkdtemp(join(packageRoot, '.tmp-loader-broken-'));
  const brokenFixturePath = join(tempDirectory, 'broken.vue');
  const brokenSource = '<template><div></template>';
  await writeFile(brokenFixturePath, brokenSource, 'utf8');
  try {
    const driverCode = `await import(${JSON.stringify(pathToFileURL(brokenFixturePath).href)});`;
    const child = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', driverCode],
      {
        encoding: 'utf8',
        cwd: packageRoot,
        env: {
          ...process.env,
          NODE_OPTIONS: canonicalNodeOptions,
        },
      },
    );
    assert.notEqual(
      child.status,
      0,
      'broken fixture must cause the child process to exit with a non-zero status',
    );
    const combinedOutput = `${child.stdout}\n${child.stderr}`;
    assert.equal(
      combinedOutput.includes('broken.vue'),
      true,
      `stack trace must reference the .vue path; combined output was:\n${combinedOutput}`,
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
