#!/usr/bin/env node
/**
 * build-in-play-baseline.mjs — Maintain the committed in-play hollow baseline.
 *
 * The `/coverage` "% in-play hollows resolved" metric (WP-274 / D-24050) is
 * obs-weighted: every unsupported mechanic contributes its observed in-play
 * hollow count, so the denominator must NOT silently shrink when a mechanic
 * gets fixed (a fixed mechanic stops producing hollows and vanishes from the
 * live sweep artifact). The committed baseline
 * `src/data/in-play-hollow-baseline.json` is that frozen high-water-mark
 * denominator: this script monotonically merges the live sweep artifact
 * `docs/ai/coverage/runtime-observed-hollows.json` into it — `peakObs =
 * max(prior, current)`, never lowering a peak, adding any newly-observed
 * mechanic.
 *
 * Unlike `build-coverage-ledger.mjs` (a `prebuild` copy into gitignored
 * `src/data`), this writes a COMMITTED seed, so it is run DELIBERATELY
 * (`pnpm --filter @legendary-arena/dashboard build:in-play-baseline`), NOT in
 * the auto-build chain. It is deterministic — a stable key sort and a fixed
 * `generatedAt` sentinel (never `Date.now()`) — so re-running it on unchanged
 * input is a byte no-op. It is tooling, so it MAY throw (a thrown assertion is
 * the intended loud failure for a monotonicity regression).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = resolve(SCRIPT_DIR, '..');
const REPO_ROOT = resolve(DASHBOARD_DIR, '..', '..');

const LIVE_SOURCE_PATH = join(REPO_ROOT, 'docs/ai/coverage/runtime-observed-hollows.json');
const BASELINE_PATH = join(DASHBOARD_DIR, 'src/data/in-play-hollow-baseline.json');

const BASELINE_SCHEMA_VERSION = 1;
// why: `generatedAt` is a FIXED deterministic sentinel, not a wall-clock — the
// baseline is a high-water-mark merged across many sweeps (no single timestamp),
// and the no-op-on-unchanged-input rule (AC-4) forbids a value that changes per
// run. A literal sentinel keeps the merged output byte-stable (D-24050).
const GENERATED_AT_SENTINEL = 'seed';

/**
 * Reads and parses the committed live sweep artifact. Throws with a full
 * sentence on a missing or malformed file — this is a deliberate maintenance
 * run, so failing loudly is correct (unlike the build-copy script, which must
 * never abort the build).
 *
 * @param {string} sourcePath - the committed `runtime-observed-hollows.json` path.
 * @returns {Promise<object>} the parsed live artifact.
 */
async function readLiveArtifact(sourcePath) {
  let raw;
  try {
    raw = await readFile(sourcePath, 'utf-8');
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : 'unknown read failure';
    throw new Error(
      `build-in-play-baseline: could not read the live sweep artifact at ${sourcePath} ` +
        `(detail: ${detail}); confirm the runtime-observed-hollows.json artifact exists and is committed.`,
    );
  }
  try {
    return JSON.parse(raw);
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : 'unknown parse failure';
    throw new Error(
      `build-in-play-baseline: the live sweep artifact at ${sourcePath} is not valid JSON ` +
        `(detail: ${detail}); confirm the runtime-observed-hollows.json artifact is well-formed.`,
    );
  }
}

/**
 * Reads the prior committed baseline if it exists, returning its by-mechanic
 * peak map. A missing baseline file (the first-seed case) is NOT an error —
 * it is treated as an empty prior so the live artifact seeds the baseline.
 *
 * @param {string} baselinePath - the committed `in-play-hollow-baseline.json` path.
 * @returns {Promise<Record<string, { peakObs: number }>>} the prior by-mechanic map (empty if absent).
 */
async function readPriorBaseline(baselinePath) {
  let raw;
  try {
    raw = await readFile(baselinePath, 'utf-8');
  } catch {
    // why: a missing baseline is the first-seed case, not a failure — return an
    // empty prior so the live artifact's hit counts seed the baseline.
    return {};
  }
  const parsed = JSON.parse(raw);
  return parsed.byMechanic ?? {};
}

/**
 * Monotonically merges the live artifact's per-mechanic hit counts into the
 * prior baseline peaks: `peakObs = max(prior, live)` over the union of both key
 * sets. Asserts every pre-existing mechanic's new peak is not below its prior
 * peak and throws on violation.
 *
 * @param {Record<string, { peakObs: number }>} priorByMechanic - the prior baseline peaks.
 * @param {Record<string, { hitCount: number }>} liveByMechanic - the live sweep tallies.
 * @returns {Record<string, { peakObs: number }>} the merged, key-sorted by-mechanic peak map.
 */
function mergeMonotonic(priorByMechanic, liveByMechanic) {
  const mechanics = new Set([...Object.keys(priorByMechanic), ...Object.keys(liveByMechanic)]);
  const mergedByMechanic = {};
  // why: stable alphabetical key order makes the written file deterministic, so
  // re-running on unchanged input is a byte no-op (D-24050).
  const sortedMechanics = [...mechanics].sort();
  for (const mechanic of sortedMechanics) {
    const priorPeak = priorByMechanic[mechanic]?.peakObs ?? 0;
    const livePeak = liveByMechanic[mechanic]?.hitCount ?? 0;
    // why: monotonic high-water-mark merge — never lower a peak. The denominator
    // preserves a fixed mechanic's obs after it vanishes from the live sweep; the
    // `max` with live auto-adds any newly-observed mechanic (D-24050).
    const newPeak = Math.max(priorPeak, livePeak);
    // why: regression guard — `max` makes `newPeak >= priorPeak` structurally
    // true, so a violation means a future refactor broke monotonicity; fail
    // loudly (this is tooling, so it may throw) (D-24050).
    if (newPeak < priorPeak) {
      throw new Error(
        `build-in-play-baseline: monotonicity violation for mechanic "${mechanic}" ` +
          `(prior peak ${priorPeak}, merged peak ${newPeak}); the baseline must never lower a peak — ` +
          `investigate the merge logic before re-running.`,
      );
    }
    mergedByMechanic[mechanic] = { peakObs: newPeak };
  }
  return mergedByMechanic;
}

/**
 * Reads the live artifact + the prior baseline, merges monotonically, and writes
 * the committed baseline as deterministic 2-space JSON with a trailing newline
 * (Prettier-compatible, so `format:check` stays green).
 */
async function buildInPlayBaseline() {
  const liveArtifact = await readLiveArtifact(LIVE_SOURCE_PATH);
  const priorByMechanic = await readPriorBaseline(BASELINE_PATH);
  const mergedByMechanic = mergeMonotonic(priorByMechanic, liveArtifact.byMechanic ?? {});
  const baseline = {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    generatedAt: GENERATED_AT_SENTINEL,
    byMechanic: mergedByMechanic,
  };
  await mkdir(dirname(BASELINE_PATH), { recursive: true });
  await writeFile(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf-8');
  const mechanicCount = Object.keys(mergedByMechanic).length;
  let totalObs = 0;
  for (const entry of Object.values(mergedByMechanic)) {
    totalObs += entry.peakObs;
  }
  process.stdout.write(
    `build-in-play-baseline: wrote ${BASELINE_PATH} (${mechanicCount} mechanics / ${totalObs} obs).\n`,
  );
}

await buildInPlayBaseline();
