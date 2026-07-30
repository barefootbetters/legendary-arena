#!/usr/bin/env node
/**
 * Canonical gauntlet loadout menu generator (WP-395 / EC-435 / D-24199).
 *
 * Emits the approved villain-group and henchmen-group configurations every
 * ranked gauntlet leg must be played with, into the registry source module
 * packages/registry/src/gauntletLoadouts.generated.ts.
 *
 * Why this exists: ScenarioKey is
 * `{schemeSlug}::{mastermindSlug}::{sorted-villainGroupSlugs-joined-by-+}` and
 * villain groups are unconstrained today, so PAR — which is calibrated per
 * scenario key and rejects a sample size under 500 — would have to cover
 * 8,205,239,889 scenarios at five players. Constraining the villain and
 * henchmen groups to an enumerated menu collapses that to a few thousand.
 * Casual play is untouched; this is a ranked-surface constraint only.
 *
 * What it does, in order:
 *   1. Read every set in data/cards/ and keep the QUALIFYING ones — a set with
 *      at least one scheme, matching buildGauntletCatalog's own filter
 *      (D-24131 §1). Sets with no scheme host no gauntlet, so they need no menu.
 *   2. For each mastermind, seed the villain slots with its printed
 *      `alwaysLeads` groups — the game's own rules make those canonical.
 *   3. Fill the remaining villain and henchmen slots per player count from the
 *      mastermind's own set first, then from the Core Set / Core 2E pool
 *      (the D-24199 core-fallback rule).
 *   4. Emit one canonical variant (variant 0) per mastermind — the single
 *      approved configuration ranked qualification uses (D-24278). Casual play
 *      keeps free selection; only ranked qualification is fixed.
 *   5. Default mode: write the module. --check mode: regenerate in memory and
 *      exit non-zero if the committed module drifts (the CI freshness gate).
 *
 * Deterministic: identical card data always yields byte-identical output.
 * No wall-clock reads, no randomness — the variant spread is an index
 * rotation, not a shuffle. Run from the repo root.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIRECTORY);
const CARDS_DIRECTORY = join(REPO_ROOT, 'data', 'cards');
const OUTPUT_PATH = join(
  REPO_ROOT,
  'packages',
  'registry',
  'src',
  'gauntletLoadouts.generated.ts',
);

// why: the fallback pool is the two Core sets, in this order — a mastermind's
// own set is always preferred, and Core is what every player is assumed to own.
// D-24199 chose this over nearest-thematic (no set-adjacency map exists for 41
// sets) and over difficulty-balanced (circular: it needs the PAR calibration
// this menu exists to unblock).
const CORE_FALLBACK_SET_ABBRS = ['core', 'co2e'];

// why: ONE canonical configuration per mastermind — variant 0 (D-24278,
// superseding D-24199's menu of three). Ranked gauntlet qualification fixes the
// villains and henchmen so the only competitive variable is the heroes; casual
// play keeps free selection. Done while competitive_scores is empty, so dropping
// the former variants 1/2 re-keys and invalidates no scores.
const VARIANTS_PER_MASTERMIND = 1;

// why: mirrors PLAYER_COUNT_SETUP in packages/registry/src/playerCountSetup.ts.
// Duplicated rather than imported because this script runs before any build and
// must not depend on the registry dist; the drift test in
// gauntletLoadouts.test.ts asserts the two tables agree.
const REQUIRED_GROUP_COUNTS = {
  1: { villainGroupCount: 1, henchmenGroupCount: 1 },
  2: { villainGroupCount: 2, henchmenGroupCount: 1 },
  3: { villainGroupCount: 3, henchmenGroupCount: 1 },
  4: { villainGroupCount: 3, henchmenGroupCount: 2 },
  5: { villainGroupCount: 4, henchmenGroupCount: 2 },
};

const SUPPORTED_PLAYER_COUNTS = [1, 2, 3, 4, 5];

/** Error type signalling a probe or transform failure (exit code 2). */
class GenerationError extends Error {}

/**
 * Reads every set file in data/cards/ into `{ abbr, data }` records.
 *
 * @returns {{abbr: string, data: object}[]} every set, in file-name order.
 */
function readAllSets() {
  const setFileNames = readdirSync(CARDS_DIRECTORY).filter((fileName) =>
    fileName.endsWith('.json'),
  );
  if (setFileNames.length === 0) {
    throw new GenerationError(
      `No set files were found in ${CARDS_DIRECTORY}. Check that the card data ` +
        `is present before regenerating the gauntlet loadout menu.`,
    );
  }
  const sets = [];
  for (const fileName of setFileNames) {
    const setAbbreviation = fileName.replace('.json', '');
    const fileText = readFileSync(join(CARDS_DIRECTORY, fileName), 'utf8');
    sets.push({ abbr: setAbbreviation, data: JSON.parse(fileText) });
  }
  return sets;
}

/**
 * Builds the sorted set-qualified ext_ids for one set's groups (D-10014
 * `setAbbr/slug` space — the same id space match setup configures).
 *
 * @param {string} setAbbreviation the owning set's abbreviation.
 * @param {{slug: string}[]} groups the set's villain or henchmen groups.
 * @returns {string[]} sorted set-qualified ids.
 */
function buildGroupIds(setAbbreviation, groups) {
  const groupIds = [];
  for (const group of groups) {
    groupIds.push(`${setAbbreviation}/${group.slug}`);
  }
  return groupIds.sort();
}

/**
 * Picks `requiredCount` ids from `candidates`, starting at `rotationOffset` and
 * wrapping. Variant 0 (the only variant now, D-24278) takes the first candidates
 * (`rotationOffset 0`); the offset parameter is retained for the rotation logic.
 *
 * @param {string[]} candidates the ordered candidate ids.
 * @param {number} requiredCount how many ids to take.
 * @param {number} rotationOffset the variant's starting index.
 * @returns {string[]} the picked ids, in rotation order.
 */
function pickByRotation(candidates, requiredCount, rotationOffset) {
  const picked = [];
  const alreadyPicked = new Set();
  for (
    let stepIndex = 0;
    stepIndex < candidates.length && picked.length < requiredCount;
    stepIndex += 1
  ) {
    const candidateId =
      candidates[(rotationOffset + stepIndex) % candidates.length];
    if (!alreadyPicked.has(candidateId)) {
      alreadyPicked.add(candidateId);
      picked.push(candidateId);
    }
  }
  return picked;
}

/**
 * Fills one slot list: printed anchors first, then the mastermind's own set,
 * then the Core fallback pool.
 *
 * @param {string[]} anchorIds ids the printed card makes canonical (may be empty).
 * @param {string[]} inSetIds the mastermind's own set's group ids.
 * @param {string[]} fallbackIds the Core Set / Core 2E pool ids.
 * @param {number} requiredCount how many groups this player count needs.
 * @param {number} rotationOffset the variant's starting index.
 * @returns {string[]} the chosen ids, sorted for a stable comparison key.
 */
function fillGroupSlots(
  anchorIds,
  inSetIds,
  fallbackIds,
  requiredCount,
  rotationOffset,
) {
  const chosenIds = [];
  const alreadyChosen = new Set();
  for (const anchorId of anchorIds) {
    if (chosenIds.length < requiredCount && !alreadyChosen.has(anchorId)) {
      alreadyChosen.add(anchorId);
      chosenIds.push(anchorId);
    }
  }
  const remainingCount = requiredCount - chosenIds.length;
  if (remainingCount <= 0) {
    return chosenIds.sort();
  }
  const candidates = [];
  for (const inSetId of inSetIds) {
    if (!alreadyChosen.has(inSetId)) {
      candidates.push(inSetId);
    }
  }
  for (const fallbackId of fallbackIds) {
    if (!alreadyChosen.has(fallbackId) && !inSetIds.includes(fallbackId)) {
      candidates.push(fallbackId);
    }
  }
  for (const pickedId of pickByRotation(
    candidates,
    remainingCount,
    rotationOffset,
  )) {
    chosenIds.push(pickedId);
  }
  return chosenIds.sort();
}

/**
 * Builds every mastermind's single-variant menu.
 *
 * @param {{abbr: string, data: object}[]} sets every set read from data/cards/.
 * @returns {object[]} one menu record per (set x mastermind), ordered by
 *   setAbbr ASC then mastermindSlug ASC to match buildGauntletCatalog.
 */
function buildLoadoutMenus(sets) {
  const setsByAbbreviation = new Map();
  for (const set of sets) {
    setsByAbbreviation.set(set.abbr, set.data);
  }

  const fallbackVillainIds = [];
  const fallbackHenchmenIds = [];
  for (const fallbackSetAbbreviation of CORE_FALLBACK_SET_ABBRS) {
    const fallbackSet = setsByAbbreviation.get(fallbackSetAbbreviation);
    if (fallbackSet === undefined) {
      throw new GenerationError(
        `The core fallback set "${fallbackSetAbbreviation}" is missing from ` +
          `${CARDS_DIRECTORY}. The core-fallback rule (D-24199) cannot fill ` +
          `out-of-set slots without it.`,
      );
    }
    for (const villainId of buildGroupIds(
      fallbackSetAbbreviation,
      fallbackSet.villains ?? [],
    )) {
      fallbackVillainIds.push(villainId);
    }
    for (const henchmanId of buildGroupIds(
      fallbackSetAbbreviation,
      fallbackSet.henchmen ?? [],
    )) {
      fallbackHenchmenIds.push(henchmanId);
    }
  }
  fallbackVillainIds.sort();
  fallbackHenchmenIds.sort();

  // why: a set with no scheme hosts no gauntlet board (D-24131 §1, the same
  // filter buildGauntletCatalog applies), so it needs no approved loadout.
  const qualifyingSets = [];
  for (const set of sets) {
    if ((set.data.schemes ?? []).length > 0) {
      qualifyingSets.push(set);
    }
  }
  qualifyingSets.sort((firstSet, secondSet) =>
    firstSet.abbr < secondSet.abbr ? -1 : 1,
  );

  const menus = [];
  for (const set of qualifyingSets) {
    const inSetVillainIds = buildGroupIds(set.abbr, set.data.villains ?? []);
    const inSetHenchmenIds = buildGroupIds(set.abbr, set.data.henchmen ?? []);
    const sortedMasterminds = [...(set.data.masterminds ?? [])].sort(
      (firstMastermind, secondMastermind) =>
        firstMastermind.slug < secondMastermind.slug ? -1 : 1,
    );
    for (const mastermind of sortedMasterminds) {
      const anchorVillainIds = [];
      for (const alwaysLedSlug of mastermind.alwaysLeads ?? []) {
        anchorVillainIds.push(`${set.abbr}/${alwaysLedSlug}`);
      }
      const variants = [];
      for (
        let variantIndex = 0;
        variantIndex < VARIANTS_PER_MASTERMIND;
        variantIndex += 1
      ) {
        const compositionsByPlayerCount = {};
        for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
          const requiredCounts = REQUIRED_GROUP_COUNTS[playerCount];
          const villainGroupIds = fillGroupSlots(
            anchorVillainIds,
            inSetVillainIds,
            fallbackVillainIds,
            requiredCounts.villainGroupCount,
            variantIndex,
          );
          const henchmanGroupIds = fillGroupSlots(
            [],
            inSetHenchmenIds,
            fallbackHenchmenIds,
            requiredCounts.henchmenGroupCount,
            variantIndex,
          );
          if (
            villainGroupIds.length !== requiredCounts.villainGroupCount ||
            henchmanGroupIds.length !== requiredCounts.henchmenGroupCount
          ) {
            throw new GenerationError(
              `Mastermind "${set.abbr}/${mastermind.slug}" variant ` +
                `${variantIndex} cannot be filled at ${playerCount} players: ` +
                `needed ${requiredCounts.villainGroupCount} villain and ` +
                `${requiredCounts.henchmenGroupCount} henchmen groups but got ` +
                `${villainGroupIds.length} and ${henchmanGroupIds.length}. ` +
                `Check that the Core fallback sets still supply enough groups.`,
            );
          }
          compositionsByPlayerCount[playerCount] = {
            villainGroupIds,
            henchmanGroupIds,
          };
        }
        variants.push({ variantIndex, compositionsByPlayerCount });
      }
      menus.push({
        setAbbr: set.abbr,
        mastermindSlug: mastermind.slug,
        variants,
      });
    }
  }
  return menus;
}

/**
 * Renders one composition as a single source line.
 *
 * @param {number} playerCount the player count this composition serves.
 * @param {object} composition the villain and henchmen id lists.
 * @returns {string} the rendered object-property line.
 */
function renderComposition(playerCount, composition) {
  const villains = composition.villainGroupIds
    .map((groupId) => `'${groupId}'`)
    .join(', ');
  const henchmen = composition.henchmanGroupIds
    .map((groupId) => `'${groupId}'`)
    .join(', ');
  return (
    `        ${playerCount}: { villainGroupIds: [${villains}], ` +
    `henchmanGroupIds: [${henchmen}] },`
  );
}

/**
 * Renders the whole generated TypeScript module.
 *
 * @param {object[]} menus every mastermind's menu.
 * @returns {string} the module source text.
 */
function renderModule(menus) {
  const lines = [];
  lines.push('// GENERATED FILE — DO NOT EDIT BY HAND.');
  lines.push('// Regenerate with `pnpm gauntlet:loadouts`; CI gates it with');
  lines.push('// `pnpm gauntlet:loadouts:check` (WP-395 / EC-435 / D-24199).');
  lines.push('//');
  lines.push('// The approved villain and henchmen group configurations a ranked');
  lines.push('// gauntlet leg must be played with. Casual play is unconstrained —');
  lines.push('// this menu governs qualification only.');
  lines.push('');
  lines.push(
    "import type { GauntletLoadoutMenu } from './gauntletLoadouts.js';",
  );
  lines.push('');
  lines.push(
    'export const GAUNTLET_LOADOUT_MENUS: readonly GauntletLoadoutMenu[] = [',
  );
  for (const menu of menus) {
    lines.push('  {');
    lines.push(`    setAbbr: '${menu.setAbbr}',`);
    lines.push(`    mastermindSlug: '${menu.mastermindSlug}',`);
    lines.push('    variants: [');
    for (const variant of menu.variants) {
      lines.push('      {');
      lines.push(`        variantIndex: ${variant.variantIndex},`);
      lines.push('        compositionsByPlayerCount: {');
      for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
        lines.push(
          '  ' +
            renderComposition(
              playerCount,
              variant.compositionsByPlayerCount[playerCount],
            ),
        );
      }
      lines.push('        },');
      lines.push('      },');
    }
    lines.push('    ],');
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

/**
 * Entry point.
 *
 * @returns {number} the process exit code.
 */
function main() {
  const mode = process.argv[2];
  const sets = readAllSets();
  const menus = buildLoadoutMenus(sets);
  const freshText = renderModule(menus);

  if (mode === '--check') {
    let committedText = '';
    try {
      committedText = readFileSync(OUTPUT_PATH, 'utf8');
    } catch {
      console.log(
        `FAIL: the gauntlet loadout menu is missing at ${OUTPUT_PATH}. ` +
          `Run \`pnpm gauntlet:loadouts\` and commit the result.`,
      );
      return 1;
    }
    // why: compare content, not the platform's newline style — a CRLF checkout
    // must not fail a gate that is about data drift (mirrors ledger:heroes:check).
    if (committedText.replace(/\r\n/g, '\n') !== freshText) {
      console.log(
        `FAIL: the gauntlet loadout menu at ${OUTPUT_PATH} is stale. ` +
          `Run \`pnpm gauntlet:loadouts\` and commit the result.`,
      );
      return 1;
    }
    console.log(`OK: the gauntlet loadout menu is current (${menus.length} masterminds).`);
    return 0;
  }

  writeFileSync(OUTPUT_PATH, freshText, 'utf8');
  console.log(
    `Wrote ${menus.length} mastermind menus ` +
      `(${menus.length * VARIANTS_PER_MASTERMIND} loadouts) to:`,
  );
  console.log(`  ${OUTPUT_PATH}`);
  return 0;
}

try {
  process.exitCode = main();
} catch (generationError) {
  if (generationError instanceof GenerationError) {
    console.error(`FAIL: ${generationError.message}`);
    process.exitCode = 2;
  } else {
    console.error(generationError);
    process.exitCode = 2;
  }
}
