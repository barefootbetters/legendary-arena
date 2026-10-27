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
 *      `alwaysLeads` groups and the henchmen slots with its printed
 *      `alwaysLeadsHenchmen` groups — the game's own rules make those canonical.
 *   3. Fill the remaining villain and henchmen slots per player count from the
 *      mastermind's own set first, then from the Core Set, then Core 2E (the
 *      D-24199 core-fallback rule, ordered by D-24767).
 *   4. Emit one canonical variant (variant 0) per mastermind — the single
 *      approved configuration ranked qualification uses (D-24278). Casual play
 *      keeps free selection; only ranked qualification is fixed.
 *   5. For each scheme in the mastermind's own set that prints "Add an extra
 *      Henchman group" (D-24666) or "Add an extra Villain Group" (D-24766), emit
 *      a `schemeOverrides` entry keyed by scheme slug: variant 0 with that slot
 *      (henchmen or villains) refilled with the same rule for one more group.
 *      getGauntletConfig returns it for a leg with no authored config, so the
 *      leg's approved composition stays legal.
 *   6. Default mode: write the module. --check mode: regenerate in memory and
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

// why: mirrors SCHEMES_WITH_EXTRA_HENCHMAN_GROUP in
// packages/registry/src/playerCountSetup.ts (D-24666) — the schemes that print
// "Add an extra Henchman group" and so require base + 1 henchmen groups.
// Duplicated rather than imported because this script runs before any build and
// must not depend on the registry dist (the REQUIRED_GROUP_COUNTS precedent); the
// output-derived drift pin in gauntletLoadouts.test.ts asserts the emitted
// schemeOverrides keys equal the registry list.
const SCHEMES_WITH_EXTRA_HENCHMAN_GROUP = [
  'core/negative-zone-prison-breakout',
  'msp1/asgard-under-siege',
  'vnom/invasion-of-the-venom-symbiotes',
];

// why: mirrors SCHEMES_WITH_EXTRA_VILLAIN_GROUP in
// packages/registry/src/playerCountSetup.ts (D-24766) — the schemes that print
// "Add an extra Villain Group" and so require base + 1 villain groups.
// Duplicated rather than imported for the same reason as the Henchman list (this
// script runs before any build); the output-derived drift pin in
// gauntletLoadouts.test.ts asserts the emitted villain-override keys equal the
// registry list.
const SCHEMES_WITH_EXTRA_VILLAIN_GROUP = [
  'ca75/change-the-outcome-of-wwii',
  'co2e/bank-robbery-hostage-crisis',
  'co2e/negative-zone-prison-outbreak',
  'cvwr/predict-future-crime',
  'dkcy/steal-the-weaponized-plutonium',
  'dstr/war-for-the-dream-dimension',
  'dstr/cursed-pages-of-the-darkhold-tome',
  'mgtg/inescapable-kyln-space-prison',
  'mgtg/provoke-the-sovereign-war-fleet',
  'nmut/superhuman-baseball-game',
  'rvlt/earthquake-drains-the-ocean',
  'ssw1/fragmented-realities',
  'ssw1/smash-two-dimensions-together',
  'ssw2/deadlands-hordes-charge-the-wall',
];

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
 * Builds a mastermind's printed-lead anchor ids for one slot type, rejecting a
 * lead slug that is not an in-set group of that type.
 *
 * @param {{abbr: string}} set the mastermind's own set.
 * @param {{slug: string}} mastermind the mastermind whose leads are anchored.
 * @param {string[]} leadSlugs the bare lead slugs (`alwaysLeads` or
 *   `alwaysLeadsHenchmen`).
 * @param {string[]} inSetGroupIds the set's group ids of the matching type.
 * @param {'villain'|'henchman'} leadType which slot type the leads anchor.
 * @returns {string[]} the set-qualified anchor ids, in lead order.
 */
function buildLeadAnchorIds(set, mastermind, leadSlugs, inSetGroupIds, leadType) {
  const anchorIds = [];
  for (const leadSlug of leadSlugs) {
    const anchorId = `${set.abbr}/${leadSlug}`;
    // why: a Henchman slug in alwaysLeads once put co2e/doombot-legion in a
    // villain slot (and in the henchmen slot too); a lead must name an in-set
    // group of the slot type it anchors (D-24667).
    if (!inSetGroupIds.includes(anchorId)) {
      throw new GenerationError(
        `Mastermind "${set.abbr}/${mastermind.slug}" Always Leads "${leadSlug}", ` +
          `which is not a ${leadType} group in set "${set.abbr}". A villain lead ` +
          `belongs in alwaysLeads and a Henchman lead in alwaysLeadsHenchmen; fix ` +
          `the lead in scripts/convert-cards/inputs/leads.json (or co2e.json).`,
      );
    }
    anchorIds.push(anchorId);
  }
  return anchorIds;
}

/**
 * Returns the bare slug of a set-qualified ext_id (`setAbbr/slug` → `slug`).
 *
 * @param {string} groupId a set-qualified ext_id.
 * @returns {string} the slug after the set qualifier.
 */
function toBareSlug(groupId) {
  return groupId.slice(groupId.indexOf('/') + 1);
}

/**
 * Throws a GenerationError unless one slot list of a scheme override is either
 * the base list unchanged (no extra group for that slot) or the base list plus
 * exactly one group (the scheme adds one).
 *
 * @param {string} label the mastermind / scheme / player-count being checked.
 * @param {string} slotLabel "henchmen" or "villain" (for the error message).
 * @param {string[]} baseGroupIds variant 0's ids for this slot.
 * @param {string[]} overrideGroupIds the override's ids for this slot.
 * @param {boolean} addsOneGroup whether the scheme adds one group to this slot.
 */
function assertOverrideSlot(label, slotLabel, baseGroupIds, overrideGroupIds, addsOneGroup) {
  // why: fillGroupSlots sorts its output, so the override is checked as a set —
  // every base id present, plus exactly one more (or none) — not by position.
  const isSuperset = baseGroupIds.every((groupId) => overrideGroupIds.includes(groupId));
  let expectedLength = baseGroupIds.length;
  if (addsOneGroup) {
    expectedLength = baseGroupIds.length + 1;
  }
  if (!isSuperset || overrideGroupIds.length !== expectedLength) {
    throw new GenerationError(
      `The scheme override for ${label} is not the base ${slotLabel} groups plus ` +
        `exactly ${addsOneGroup ? 'one' : 'no'} group: base [${baseGroupIds.join(', ')}], ` +
        `override [${overrideGroupIds.join(', ')}]. Check the D-24199 fill order for ` +
        `this mastermind's set.`,
    );
  }
}

/**
 * Throws a GenerationError unless one scheme-override composition is the base
 * composition plus exactly one group on each slot its scheme extends (henchmen
 * for "Add an extra Henchman group", villains for "Add an extra Villain Group"),
 * with no two ids sharing a slug.
 *
 * @param {string} label the mastermind / scheme / player-count being checked.
 * @param {object} baseComposition variant 0's composition at this player count.
 * @param {object} overrideComposition the scheme-override composition.
 * @param {{addsVillainGroup: boolean, addsHenchmanGroup: boolean}} schemeExtras
 *   which slots the scheme extends.
 */
function assertOverrideComposition(label, baseComposition, overrideComposition, schemeExtras) {
  assertOverrideSlot(
    label,
    'henchmen',
    baseComposition.henchmanGroupIds,
    overrideComposition.henchmanGroupIds,
    schemeExtras.addsHenchmanGroup,
  );
  assertOverrideSlot(
    label,
    'villain',
    baseComposition.villainGroupIds,
    overrideComposition.villainGroupIds,
    schemeExtras.addsVillainGroup,
  );
  // why: Henchman card ids are built from the BARE slug (henchman-<slug>-NN in the
  // engine's villain-deck setup), so two groups sharing a slug across sets (e.g.
  // core/doombot-legion + co2e/doombot-legion) would collide on card ids.
  const seenSlugs = new Set();
  for (const groupId of [
    ...overrideComposition.villainGroupIds,
    ...overrideComposition.henchmanGroupIds,
  ]) {
    const slug = toBareSlug(groupId);
    if (seenSlugs.has(slug)) {
      throw new GenerationError(
        `The scheme override for ${label} names two groups with the ` +
          `slug "${slug}". Card ids are built from the bare slug, so the match would ` +
          `collide; adjust the fill order so the override picks a distinct-slug group.`,
      );
    }
    seenSlugs.add(slug);
  }
}

/**
 * Fills one slot of a scheme override: the base list unchanged when the scheme
 * does not extend the slot, else the slot refilled (same D-24199 rule, same
 * anchors) for one more group.
 *
 * @param {{anchorIds: string[], inSetIds: string[], fallbackIds: string[]}} slotPools
 *   the slot's printed-lead anchors, in-set ids and Core fallback ids.
 * @param {string[]} baseGroupIds variant 0's ids for this slot.
 * @param {number} baseCount the table count for this slot at this player count.
 * @param {boolean} addsOneGroup whether the scheme adds one group to this slot.
 * @param {number} variantIndex the base variant's rotation offset.
 * @returns {string[]} the override's ids for this slot.
 */
function fillOverrideSlot(slotPools, baseGroupIds, baseCount, addsOneGroup, variantIndex) {
  if (!addsOneGroup) {
    return [...baseGroupIds];
  }
  return fillGroupSlots(
    slotPools.anchorIds,
    slotPools.inSetIds,
    slotPools.fallbackIds,
    baseCount + 1,
    variantIndex,
  );
}

/**
 * Builds the `schemeOverrides` map for one mastermind: for each scheme in its own
 * set that prints "Add an extra Henchman group" (D-24666) or "Add an extra
 * Villain Group" (D-24766), variant 0 with that slot refilled (same D-24199 rule)
 * for one more group, at every player count.
 *
 * @param {{abbr: string, data: object}} set the mastermind's own set.
 * @param {string} mastermindSlug the mastermind's slug (for error messages).
 * @param {object} baseVariant the mastermind's variant 0.
 * @param {{anchorIds: string[], inSetIds: string[], fallbackIds: string[]}} villainPools
 *   the villain slot's printed-lead anchors (may be empty), in-set ids and Core
 *   fallback ids — anchored first, exactly as in the base fill (D-24667).
 * @param {{anchorIds: string[], inSetIds: string[], fallbackIds: string[]}} henchmanPools
 *   the henchmen slot's pools, in the same shape.
 * @returns {object|undefined} the overrides keyed by scheme slug, or undefined
 *   when the set has no extra-Henchman or extra-Villain-Group scheme.
 */
function buildSchemeOverrides(set, mastermindSlug, baseVariant, villainPools, henchmanPools) {
  const sortedSchemes = [...(set.data.schemes ?? [])].sort(
    (firstScheme, secondScheme) =>
      firstScheme.slug < secondScheme.slug ? -1 : 1,
  );
  let schemeOverrides;
  for (const scheme of sortedSchemes) {
    const schemeId = `${set.abbr}/${scheme.slug}`;
    const schemeExtras = {
      addsVillainGroup: SCHEMES_WITH_EXTRA_VILLAIN_GROUP.includes(schemeId),
      addsHenchmanGroup: SCHEMES_WITH_EXTRA_HENCHMAN_GROUP.includes(schemeId),
    };
    if (!schemeExtras.addsVillainGroup && !schemeExtras.addsHenchmanGroup) {
      continue;
    }
    const compositionsByPlayerCount = {};
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      const baseComposition = baseVariant.compositionsByPlayerCount[playerCount];
      const requiredCounts = REQUIRED_GROUP_COUNTS[playerCount];
      const overrideComposition = {
        villainGroupIds: fillOverrideSlot(
          villainPools,
          baseComposition.villainGroupIds,
          requiredCounts.villainGroupCount,
          schemeExtras.addsVillainGroup,
          baseVariant.variantIndex,
        ),
        henchmanGroupIds: fillOverrideSlot(
          henchmanPools,
          baseComposition.henchmanGroupIds,
          requiredCounts.henchmenGroupCount,
          schemeExtras.addsHenchmanGroup,
          baseVariant.variantIndex,
        ),
      };
      assertOverrideComposition(
        `"${set.abbr}/${mastermindSlug}" / "${scheme.slug}" at ${playerCount} players`,
        baseComposition,
        overrideComposition,
        schemeExtras,
      );
      compositionsByPlayerCount[playerCount] = overrideComposition;
    }
    if (schemeOverrides === undefined) {
      schemeOverrides = {};
    }
    schemeOverrides[scheme.slug] = compositionsByPlayerCount;
  }
  return schemeOverrides;
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
  // why: D-24767 — the pool keeps CORE_FALLBACK_SET_ABBRS order (Core, then Core
  // 2E), each set's ids sorted by buildGroupIds. A combined sort put `co2e/` before
  // `core/`, so out-of-set slots took Core 2E groups first, and most of those print
  // effects the engine does not implement while their Core versions do.

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
      const anchorVillainIds = buildLeadAnchorIds(
        set,
        mastermind,
        mastermind.alwaysLeads ?? [],
        inSetVillainIds,
        'villain',
      );
      const anchorHenchmenIds = buildLeadAnchorIds(
        set,
        mastermind,
        mastermind.alwaysLeadsHenchmen ?? [],
        inSetHenchmenIds,
        'henchman',
      );
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
            anchorHenchmenIds,
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
      const menu = {
        setAbbr: set.abbr,
        mastermindSlug: mastermind.slug,
        variants,
      };
      const schemeOverrides = buildSchemeOverrides(
        set,
        mastermind.slug,
        variants[0],
        {
          anchorIds: anchorVillainIds,
          inSetIds: inSetVillainIds,
          fallbackIds: fallbackVillainIds,
        },
        {
          anchorIds: anchorHenchmenIds,
          inSetIds: inSetHenchmenIds,
          fallbackIds: fallbackHenchmenIds,
        },
      );
      if (schemeOverrides !== undefined) {
        menu.schemeOverrides = schemeOverrides;
      }
      menus.push(menu);
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
    if (menu.schemeOverrides !== undefined) {
      lines.push('    schemeOverrides: {');
      for (const [schemeSlug, compositionsByPlayerCount] of Object.entries(
        menu.schemeOverrides,
      )) {
        lines.push(`      '${schemeSlug}': {`);
        for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
          lines.push(
            renderComposition(playerCount, compositionsByPlayerCount[playerCount]),
          );
        }
        lines.push('      },');
      }
      lines.push('    },');
    }
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
