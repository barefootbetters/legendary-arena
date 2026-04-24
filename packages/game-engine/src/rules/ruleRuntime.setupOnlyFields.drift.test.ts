/**
 * Drift-detection test: LegendaryGameState setup-only array fields must not
 * be mutated post-setup in production code.
 *
 * Guards the three fields (`hookRegistry`, `schemeSetupInstructions`,
 * `heroAbilityHooks`) against reassignment or in-place mutation via
 * push / pop / splice / shift / unshift. These fields are built once by
 * `buildInitialGameState` and must remain inert during gameplay — moves,
 * phases, effects, and the reveal pipeline may read them but never mutate
 * them.
 *
 * This test replaces the deferred `readonly` modifier path in WP-087 per
 * D-8702 / D-8705: tightening the TS type would ripple into four consumer
 * call sites outside the WP-087 allowlist (HookRegistry-typed parameters
 * in `game.ts` and `villainDeck/villainDeck.reveal.ts`, and
 * HeroAbilityHook[]-typed parameters in `hero/heroConditions.evaluate.ts`
 * and `hero/heroEffects.execute.ts`). A grep-based drift test gives the
 * same mutation-site guarantee without the ripple, runs on every
 * `pnpm test`, and fails loudly with the offending file and line on any
 * future violation.
 *
 * Uses node:test, node:assert, and node:fs/promises only. No boardgame.io
 * imports. No runtime engine imports. The test scans production TypeScript
 * source files under `packages/game-engine/src/` and excludes `*.test.ts`
 * from the scan scope (test fixtures may legitimately construct variant
 * states).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// why: the mutation pattern requires a `G.` or `gameState.` qualifier because
// the unqualified form false-positives on legitimate setup-time local
// variable declarations like `const schemeSetupInstructions = ...` in
// `buildInitialGameState.ts`. See WP-087 pre-flight PS-1 resolution.
const MUTATION_PATTERN =
  /(G|gameState)\.(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)/;

const SRC_ROOT = fileURLToPath(new URL('../', import.meta.url));

/**
 * Returns production TypeScript files under `SRC_ROOT` (relative paths).
 * Excludes `*.test.ts` so test fixtures that construct variant states do
 * not trigger the drift signal.
 */
async function listProductionTypeScriptFiles(): Promise<string[]> {
  const entries = await readdir(SRC_ROOT, { recursive: true });
  const result: string[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'string') continue;
    if (!entry.endsWith('.ts')) continue;
    if (entry.endsWith('.test.ts')) continue;
    result.push(entry);
  }
  return result;
}

describe('LegendaryGameState setup-only array fields — drift detection (D-8702 / D-8705)', () => {
  it('no production .ts file mutates hookRegistry / schemeSetupInstructions / heroAbilityHooks post-setup', async () => {
    const relativePaths = await listProductionTypeScriptFiles();
    assert.ok(
      relativePaths.length > 0,
      'Drift scan found zero production .ts files; the scan root or file-discovery logic is misconfigured.',
    );

    const hits: Array<{ file: string; line: number; text: string }> = [];
    for (const relativePath of relativePaths) {
      const absolutePath = join(SRC_ROOT, relativePath);
      const contents = await readFile(absolutePath, 'utf8');
      const lines = contents.split(/\r?\n/);
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        if (line === undefined) continue;
        if (MUTATION_PATTERN.test(line)) {
          hits.push({
            file: relativePath.replace(/\\/g, '/'),
            line: lineIndex + 1,
            text: line.trim(),
          });
        }
      }
    }

    assert.deepStrictEqual(
      hits,
      [],
      `Found ${hits.length} post-setup mutation site(s) on setup-only LegendaryGameState fields:\n${hits
        .map((hit) => `  ${hit.file}:${hit.line}  ${hit.text}`)
        .join(
          '\n',
        )}\n\nThese fields (hookRegistry, schemeSetupInstructions, heroAbilityHooks) are built by buildInitialGameState and must not be reassigned or mutated at runtime. If a new mutation is intentional, document the rationale in DECISIONS.md and update this drift test or its D-8702 / D-8705 basis.`,
    );
  });
});
