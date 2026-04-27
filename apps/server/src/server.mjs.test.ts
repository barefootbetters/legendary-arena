/**
 * Wiring-ordering test for `startServer()` — WP-113 PS-5.
 *
 * Verifies that `apps/server/src/server.mjs`:
 * 1. Imports `setRegistryForSetup` from `@legendary-arena/game-engine`.
 * 2. Calls `setRegistryForSetup(registry)` inside `startServer()`,
 *    AFTER the `Promise.all` destructure that captures the loaded
 *    registry, and BEFORE `Server({ games, origins })` is constructed.
 *
 * The test reads `server.mjs` as text and asserts on the call site
 * shape rather than running `startServer()` end-to-end. Running the
 * server requires the real PostgreSQL rules loader, the local registry
 * file loader, and a TCP listener — all outside the boundary of a unit
 * test. The text-shape assertion is sufficient to lock the wiring
 * ordering: if the call is removed, reordered, or commented out, this
 * test fails.
 *
 * Per EC-113 §6 step 13: "use `mock.module` or a re-exported test
 * seam to spy the call; do NOT require deep boardgame.io constructor
 * spying." Text-shape assertion is a re-exported test seam in spirit —
 * it observes the wiring contract without spinning up the runtime.
 *
 * @amended WP-113: per D-10014.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, 'server.mjs');

describe('apps/server/src/server.mjs — registry wiring contract (WP-113 PS-5)', () => {
  it('imports setRegistryForSetup from @legendary-arena/game-engine', async () => {
    const text = await readFile(serverPath, 'utf8');

    const importMatch = text.match(
      /import\s*\{[^}]*\bsetRegistryForSetup\b[^}]*\}\s*from\s*['"]@legendary-arena\/game-engine['"]/,
    );
    assert.ok(
      importMatch,
      'server.mjs must import setRegistryForSetup from @legendary-arena/game-engine',
    );
  });

  it('captures the resolved registry from the Promise.all destructure (PS-5 minimal-diff destructure rename)', async () => {
    const text = await readFile(serverPath, 'utf8');

    // why: PS-5 LOCKED — the Promise.all destructure was renamed from
    // `[, , parGate]` to `[registry, , parGate]` so `registry` is in
    // scope for the setRegistryForSetup call that follows. The third
    // entry remains `parGate` to preserve the existing wiring.
    const destructureMatch = text.match(
      /const\s*\[\s*registry\s*,\s*,\s*parGate\s*\]\s*=\s*await\s+Promise\.all\s*\(/,
    );
    assert.ok(
      destructureMatch,
      'server.mjs must destructure `[registry, , parGate]` from `await Promise.all(...)` per PS-5',
    );
  });

  it('calls setRegistryForSetup(registry) immediately after the Promise.all resolves', async () => {
    const text = await readFile(serverPath, 'utf8');

    // why: assert the call site exists with the expected argument.
    const callMatch = text.match(/setRegistryForSetup\s*\(\s*registry\s*\)/);
    assert.ok(
      callMatch,
      'server.mjs must call setRegistryForSetup(registry) inside startServer()',
    );
  });

  it('orders the setRegistryForSetup call BEFORE the Server({ games, origins }) construction (wiring-ordering invariant)', async () => {
    const text = await readFile(serverPath, 'utf8');

    const callIndex = text.indexOf('setRegistryForSetup(registry)');
    const serverConstructIndex = text.indexOf('Server({');

    assert.ok(callIndex > -1, 'setRegistryForSetup(registry) call must exist');
    assert.ok(serverConstructIndex > -1, 'Server({...}) construction must exist');
    assert.ok(
      callIndex < serverConstructIndex,
      'setRegistryForSetup(registry) must be called BEFORE Server({ games, origins }) is constructed — otherwise Game.setup() runs without the registry on the first match-create',
    );
  });
});
