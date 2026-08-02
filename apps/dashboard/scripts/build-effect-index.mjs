#!/usr/bin/env node
/**
 * build-effect-index.mjs — Build-time copy of the committed Effect Implementation
 * Index into the dashboard bundle (WP-487 / D-24292).
 *
 * Copies the canonical generated artifact into gitignored `src/data` (the
 * dashboard cannot statically import a file outside its package root, so the data
 * is copied in at build time and imported by `useEffectIndex`):
 *   - data/metadata/effect-implementation-index.json → src/data/effect-implementation-index.json
 *
 * The source is produced by WP-484's `scripts/build-effect-implementation-index.mjs`
 * (a verbatim join of the two committed mechanic ledgers) and CI-gated for
 * freshness. This script never regenerates or edits it — it only copies it in.
 *
 * On any read/parse failure this writes an empty-index stub (with an `error`
 * field) and continues — aborting the build is strictly worse for the operator
 * than an empty-state Debug Effects page. Mirrors `build-coverage-ledger.mjs`.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = resolve(SCRIPT_DIR, '..');
const REPO_ROOT = resolve(DASHBOARD_DIR, '..', '..');

const INDEX_SOURCE_PATH = join(REPO_ROOT, 'data/metadata/effect-implementation-index.json');
const INDEX_OUTPUT_PATH = join(DASHBOARD_DIR, 'src/data/effect-implementation-index.json');

// why: the empty-index stub mirrors the EffectImplementationIndexSchema shape
// (version + scope + generatedAt + a full summary with both byScope keys and all
// five byStatus keys + empty entries/cards) so the Debug Effects page renders its
// empty state rather than failing the build when the artifact is missing (e.g. a
// clean tree before WP-484's transform has run). The `error` field is off the
// strict schema on purpose — the composable reads it from the raw import and shows
// the load-error banner; safeParse of the stub fails by design (see useEffectIndex).
const EMPTY_INDEX_STUB = {
  version: 1,
  scope: 'all',
  generatedAt: '1970-01-01T00:00:00.000Z',
  summary: {
    totalEntries: 0,
    byScope: { hero: 0, villain: 0 },
    byStatus: { executable: 0, deferred: 0, condition: 0, unsupported: 0, unmarked: 0 },
  },
  entries: [],
  cards: {},
};

/**
 * Copies the committed effect-implementation index into the dashboard bundle; on
 * any failure writes the empty stub (with an `error` field) and resolves — never
 * throws, so a missing artifact cannot abort the build.
 *
 * @returns {Promise<void>}
 */
async function copyEffectIndex() {
  try {
    const raw = await readFile(INDEX_SOURCE_PATH, 'utf-8');
    // why: validate it parses before copying, so a corrupt source never lands a
    // broken JSON import into the dashboard bundle.
    JSON.parse(raw);
    await mkdir(dirname(INDEX_OUTPUT_PATH), { recursive: true });
    await writeFile(INDEX_OUTPUT_PATH, raw.endsWith('\n') ? raw : `${raw}\n`, 'utf-8');
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : 'unknown read failure';
    process.stderr.write(
      `effect-index copy warning: could not read/parse ${INDEX_SOURCE_PATH} (detail: ${detail}); ` +
        'writing an empty stub so the Debug Effects page renders its empty state rather than failing the build.\n',
    );
    try {
      await mkdir(dirname(INDEX_OUTPUT_PATH), { recursive: true });
      const stub = { ...EMPTY_INDEX_STUB, error: String(detail).slice(0, 240) };
      await writeFile(INDEX_OUTPUT_PATH, `${JSON.stringify(stub, null, 2)}\n`, 'utf-8');
    } catch {
      // why: best-effort write — even if persistence fails we continue so the
      // build runner stays alive; the page renders its load-error state.
    }
  }
}

await copyEffectIndex();
