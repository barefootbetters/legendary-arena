#!/usr/bin/env node
/**
 * Co-op win-rate + loss-cause baseline harness (WP-452 / EC-487 / D-24272).
 *
 * The bot-ally-strength yardstick: it plays a pinned 2-player core board
 * (Magneto / Midtown Bank Robbery) over a fixed seed list through the shipped
 * simulation runner, classifies each game (win / scheme-completed /
 * villains-escaped / tie / turn-cap-inconclusive), and PRINTS the co-op win
 * rate + per-cause breakdown. Later WPs of the Bot Ally Strengthening epic run
 * this and report the delta.
 *
 * Deliberately prints only — NO committed artifact and NO CI freshness gate
 * (D-24272). Each consuming WP records its own number in its own STATUS/PR;
 * this avoids the runtime-observed-hollows / dashboard freshness-gate cascade.
 *
 * Determinism: a fixed (config, seed list) through the engine's seeded PRNGs ⇒
 * a byte-identical report every run (randomness lives in the engine, never
 * here — no Math.random, no clock, no network).
 *
 * Layer note: the SCRIPT layer (not the engine) loads the real registry via
 * createRegistryFromLocalFiles and passes it into runCoopWinRate as an explicit
 * param. The engine harness imports only the CardRegistryReader TYPE.
 *
 * Run from the repo root after `pnpm -r build` (imports the engine + registry
 * dist, mirroring scripts/runtime-observed-hollows.mjs).
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRegistryFromLocalFiles } from '../packages/registry/dist/index.js';
// why: import the COMPILED engine dist, not the .ts source — plain `node`
// cannot resolve TypeScript, and importing the build output preserves the
// packages/** empty-diff boundary (the runtime-observed-hollows.mjs precedent).
import { runCoopWinRate } from '../packages/game-engine/dist/index.js';

// why: __dirname is unavailable in ESM; anchor data paths to the repo root
// (one level above scripts/) regardless of the invoking cwd.
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIRECTORY);
const METADATA_DIRECTORY = join(REPO_ROOT, 'data', 'metadata');
const CARDS_DIRECTORY = join(REPO_ROOT, 'data', 'cards');

// why: two cooperative seats — the solo + one-bot-ally shape the Bot Ally
// Strengthening epic strengthens.
const PLAYER_COUNT = 2;

// why (the pinned board): a real, reviewer-reproducible 2-player core board.
// The composition is sized exactly to PLAYER_COUNT_SETUP[2] (2 villain groups,
// 1 henchman group, 5 heroes); supply counts mirror the known-valid
// SENTINEL_CORE in runtime-observed-hollows.mjs. All ext_ids are set-qualified
// `<setAbbr>/<slug>` per D-10014 and verified present in data/cards/core.json.
//
// why (scheme substitution — EC-487 execution amendment, 2026-07-29): WP-452
// pinned `core/midtown-bank-robbery`, but that scheme (and
// `core/negative-zone-prison-breakout`) trips the SCHEME_LOSS counter at
// initial setup, so evaluateEndgame returns `scheme-wins` on turn 0 — the game
// is lost before a single move and the baseline measures nothing. The harness
// surfaced this on its first run (its intended purpose). The scheme is swapped
// to `core/legacy-virus-the` — the repo's canonical known-valid SENTINEL scheme
// (the exact scheme runtime-observed-hollows.mjs sweeps) — which plays real
// games (~7 turns) and yields an honest, fast baseline. The turn-0 auto-loss on
// Midtown Bank Robbery / Negative Zone Prison Breakout is a separate scheme-setup
// issue (out of this WP's engine allowlist) flagged for a follow-up.
const MATCH_CONFIGURATION = {
  schemeId: 'core/legacy-virus-the',
  mastermindId: 'core/magneto',
  villainGroupIds: ['core/brotherhood', 'core/hydra'],
  henchmanGroupIds: ['core/savage-land-mutates'],
  heroDeckIds: [
    'core/black-widow',
    'core/captain-america',
    'core/cyclops',
    'core/deadpool',
    'core/emma-frost',
  ],
  bystandersCount: 12,
  woundsCount: 30,
  officersCount: 16,
  sidekicksCount: 16,
};

// why (the fixed seed list): the baseline is reviewer-reproducible only if the
// seeds are pinned. The list is fully determined by these two constants —
// SEED_PREFIX + index 0..SEED_COUNT-1 — so it is a fixed literal set by
// construction (mirrors the runtime-observed-hollows.mjs per-index seed
// convention). 60 games is comfortably above the ≥50 floor and keeps the run
// to a few seconds. Changing either constant re-baselines the number.
const SEED_PREFIX = 'wp452-coop-v1';
const SEED_COUNT = 60;

/**
 * Builds the fixed, reproducible seed list from SEED_PREFIX + index.
 *
 * @returns {string[]} SEED_COUNT deterministic seed strings.
 */
function buildSeeds() {
  const seeds = [];
  for (let seedIndex = 0; seedIndex < SEED_COUNT; seedIndex++) {
    seeds.push(`${SEED_PREFIX}::${seedIndex}`);
  }
  return seeds;
}

/**
 * The category display order + human labels, matching COOP_OUTCOME_CATEGORIES.
 *
 * why: a local label map keeps the printed order stable and readable without
 * the script importing the canonical array as a value (it prints, it does not
 * re-derive categories).
 */
const CATEGORY_LABELS = [
  ['win', 'Wins'],
  ['loss-scheme-completed', 'Losses — scheme completed'],
  ['loss-villains-escaped', 'Losses — villains escaped'],
  ['loss-tie', 'Losses — deck-exhaustion tie'],
  ['inconclusive-turn-cap', 'Inconclusive — turn cap hit'],
];

/**
 * Prints one policy's co-op report as a labelled block.
 *
 * @param {string} policyName - 'random' | 'competent'.
 * @param {{games:number,wins:number,winRate:number,byCategory:Record<string,number>}} report
 */
function printReport(policyName, report) {
  const winRatePercent = (report.winRate * 100).toFixed(1);
  console.log(`\nPolicy: ${policyName}`);
  console.log(`  Games:    ${report.games}`);
  console.log(`  Wins:     ${report.wins}`);
  console.log(`  Win rate: ${winRatePercent}%`);
  console.log('  By outcome:');
  for (const [category, label] of CATEGORY_LABELS) {
    console.log(`    ${label.padEnd(34)} ${report.byCategory[category]}`);
  }
}

/**
 * Loads the real registry, runs the harness for both shipped policies, and
 * prints the reports (competent is the recorded epic baseline).
 *
 * @returns {Promise<number>} the process exit code.
 */
async function main() {
  const registry = await createRegistryFromLocalFiles({
    metadataDir: METADATA_DIRECTORY,
    cardsDir: CARDS_DIRECTORY,
  });

  const seeds = buildSeeds();
  console.log('Co-op win-rate + loss-cause baseline (WP-452 / D-24272)');
  console.log(
    `Board: ${MATCH_CONFIGURATION.mastermindId} / ${MATCH_CONFIGURATION.schemeId} ` +
      `— ${PLAYER_COUNT} players, ${seeds.length} seeds (${SEED_PREFIX}::0..${SEED_COUNT - 1}).`,
  );

  // why: both shipped policies are reported for contrast; the competent policy
  // is the epic baseline (the random policy is the too-passive floor).
  const randomReport = runCoopWinRate(
    { matchConfiguration: MATCH_CONFIGURATION, policyName: 'random', seeds, numPlayers: PLAYER_COUNT },
    registry,
  );
  printReport('random', randomReport);

  const competentReport = runCoopWinRate(
    { matchConfiguration: MATCH_CONFIGURATION, policyName: 'competent', seeds, numPlayers: PLAYER_COUNT },
    registry,
  );
  printReport('competent', competentReport);

  console.log(
    `\nBaseline (competent): ${(competentReport.winRate * 100).toFixed(1)}% co-op win rate ` +
      `over ${competentReport.games} games.`,
  );
  return 0;
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error('Co-op win-rate harness failed to run. Ensure "pnpm -r build" has run and data/cards/ is present.');
    console.error(error);
    process.exitCode = 1;
  });
