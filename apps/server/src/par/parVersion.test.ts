/**
 * Tests for the PAR version resolution (`parVersion.mjs`).
 *
 * A blank `PAR_VERSION=` in the production env file left the PAR gate empty, so every
 * competitive submission failed with `par_not_published`. These tests pin the default for
 * unset and blank values, and check that the resolved default loads the repository's
 * published seed index.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// @ts-ignore — importing .mjs from .ts; tsx resolves this at runtime.
import { DEFAULT_PAR_VERSION, resolveParVersion } from './parVersion.mjs';
// @ts-ignore — importing .mjs from .ts; tsx resolves this at runtime.
import { createParGate } from './parGate.mjs';

// why: the repository's own published PAR store, so the regression test exercises the real
// seed index the server loads in production rather than a fixture that always passes.
const REPOSITORY_PAR_BASE_PATH = fileURLToPath(new URL('../../../../data/par', import.meta.url));

describe('PAR version resolution', () => {
  test('an unset PAR_VERSION resolves to the default', () => {
    assert.equal(resolveParVersion(undefined), DEFAULT_PAR_VERSION);
    assert.equal(DEFAULT_PAR_VERSION, 'v1');
  });

  test('a blank or whitespace-only PAR_VERSION resolves to the default', () => {
    assert.equal(resolveParVersion(''), 'v1');
    assert.equal(resolveParVersion('   '), 'v1');
    assert.equal(resolveParVersion('\t\r\n'), 'v1');
  });

  test('a set PAR_VERSION is used, trimmed', () => {
    assert.equal(resolveParVersion('v2'), 'v2');
    assert.equal(resolveParVersion(' v2 \r'), 'v2');
  });

  test('a gate built from a blank PAR_VERSION publishes a seed scenario from the repository PAR store', async () => {
    const parGate = await createParGate(REPOSITORY_PAR_BASE_PATH, resolveParVersion(''));
    const hit = parGate.checkParPublished('midtown-bank-robbery::magneto::brotherhood');
    assert.notEqual(hit, null, 'The seed scenario must be published when PAR_VERSION is blank.');
    assert.equal(hit.parVersion, 'v1');
  });
});
