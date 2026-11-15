/**
 * Villain primitive marker sweep: the reveal-or-wound and add-next-hand-size lines resolve.
 *
 * These villains print "Each player reveals a(n) [hc:X] Hero or gains a Wound." (often with an
 * "Escape: Same effect." sibling) or "Fight: When you draw a new hand of cards at the end of this
 * turn, draw an extra card / two extra cards." Before this sweep none of those lines carried an
 * `[effect:]` marker, so each logged an `unmarked-ability` no-handler and nothing happened. The
 * curated villain-effect-markers.json now marks them with primitives the engine already executes:
 * `reveal-or-wound:hc:X` (WP-469 / D-24281, core Zzzax is the template) and
 * `add-next-hand-size:N` (WP-543 / D-24352, Savage Land Mutates is the template).
 *
 * Builds the real hooks from the committed data/cards/*.json for every swept card, so a regen that
 * drops a marker, or a parser change that stops reading one, fails here. No boardgame.io imports.
 * node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { VillainAbilityHook, VillainAbilityTiming } from '../rules/villainAbility.types.js';

// why: resolve the repo-root data directory from this test's own location (the
// cvwrBigBerthaRevealOrWound / amwpWaspSizeChanging precedent), so the tests read the card data
// that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

interface SweptCard {
  setAbbr: string;
  groupSlug: string;
  cardSlug: string;
  timings: readonly VillainAbilityTiming[];
  expectedEffect: Record<string, unknown>;
}

/**
 * Returns the expected parsed effect for a `reveal-or-wound:hc:<heroClass>` marker.
 *
 * @param heroClass - The printed Hero Class the player must reveal.
 * @returns The effect object the setup parser builds for that marker.
 */
function revealOrWound(heroClass: string): Record<string, unknown> {
  return { primitive: 'reveal-or-wound', requireKind: 'hero-class', requireValue: heroClass };
}

/**
 * Returns the expected parsed effect for an `add-next-hand-size:<extraCards>` marker.
 *
 * @param extraCards - The printed number of extra cards drawn for the next hand.
 * @returns The effect object the setup parser builds for that marker.
 */
function addNextHandSize(extraCards: number): Record<string, unknown> {
  return { primitive: 'add-next-hand-size', magnitude: extraCards };
}

const SWEPT_CARDS: readonly SweptCard[] = [
  { setAbbr: 'amwp', groupSlug: 'cross-technologies', cardSlug: 'yellowjacket-prototype', timings: ['onAmbush', 'onEscape'], expectedEffect: revealOrWound('instinct') },
  { setAbbr: 'amwp', groupSlug: 'armada-of-kang', cardSlug: 'city-defense-system', timings: ['onAmbush', 'onEscape'], expectedEffect: revealOrWound('ranged') },
  { setAbbr: 'anni', groupSlug: 'annihilation-wave', cardSlug: 'ravenous', timings: ['onEscape'], expectedEffect: revealOrWound('strength') },
  { setAbbr: 'antm', groupSlug: 'ultrons-legacy', cardSlug: 'brutish-ultron-14', timings: ['onFight', 'onEscape'], expectedEffect: revealOrWound('strength') },
  { setAbbr: 'antm', groupSlug: 'queens-vengeance', cardSlug: 'iron-knight', timings: ['onEscape'], expectedEffect: revealOrWound('tech') },
  { setAbbr: 'bkwd', groupSlug: 'elite-assassins', cardSlug: 'blue-talon', timings: ['onAmbush'], expectedEffect: revealOrWound('ranged') },
  { setAbbr: 'cosm', groupSlug: 'black-order-of-thanos', cardSlug: 'proxima-midnight', timings: ['onEscape'], expectedEffect: revealOrWound('instinct') },
  { setAbbr: 'cvwr', groupSlug: 'thunderbolts', cardSlug: 'mach-iv', timings: ['onFight', 'onEscape'], expectedEffect: revealOrWound('tech') },
  { setAbbr: 'dkcy', groupSlug: 'streets-of-new-york', cardSlug: 'tombstone', timings: ['onEscape'], expectedEffect: revealOrWound('strength') },
  { setAbbr: 'ff04', groupSlug: 'heralds-of-galactus', cardSlug: 'firelord', timings: ['onFight', 'onEscape'], expectedEffect: revealOrWound('ranged') },
  { setAbbr: 'msp1', groupSlug: 'enemies-of-asgard', cardSlug: 'frost-giant', timings: ['onFight', 'onEscape'], expectedEffect: revealOrWound('ranged') },
  { setAbbr: 'msp1', groupSlug: 'enemies-of-asgard', cardSlug: 'laufey-frost-giant-king', timings: ['onAmbush'], expectedEffect: revealOrWound('ranged') },
  { setAbbr: 'msp1', groupSlug: 'iron-foes', cardSlug: 'whiplash', timings: ['onFight', 'onEscape'], expectedEffect: revealOrWound('tech') },
  { setAbbr: 'pttr', groupSlug: 'sinister-six', cardSlug: 'sandman', timings: ['onEscape'], expectedEffect: revealOrWound('instinct') },
  { setAbbr: 'pttr', groupSlug: 'sinister-six', cardSlug: 'vulture', timings: ['onEscape'], expectedEffect: revealOrWound('instinct') },
  { setAbbr: 'rvlt', groupSlug: 'dark-avengers', cardSlug: 'dark-wolverine-daken', timings: ['onAmbush'], expectedEffect: revealOrWound('instinct') },
  { setAbbr: 'rvlt', groupSlug: 'lethal-legion', cardSlug: 'living-laser', timings: ['onFight', 'onEscape'], expectedEffect: revealOrWound('ranged') },
  { setAbbr: 'smhc', groupSlug: 'salvagers', cardSlug: 'tinkerer', timings: ['onEscape'], expectedEffect: revealOrWound('tech') },
  { setAbbr: 'vnom', groupSlug: 'life-foundation', cardSlug: 'agony', timings: ['onEscape'], expectedEffect: revealOrWound('covert') },
  { setAbbr: 'wtif', groupSlug: 'intergalactic-party-animals', cardSlug: 'captain-marvel-end-of-the-party', timings: ['onAmbush'], expectedEffect: revealOrWound('strength') },
  { setAbbr: 'wwhk', groupSlug: 'code-red', cardSlug: 'red-she-hulk', timings: ['onFight', 'onEscape'], expectedEffect: revealOrWound('covert') },
  { setAbbr: 'wwhk', groupSlug: 'u-foes', cardSlug: 'vapor', timings: ['onFight', 'onEscape'], expectedEffect: revealOrWound('covert') },
  { setAbbr: 'xmen', groupSlug: 'sisterhood-of-mutants', cardSlug: 'lady-deathstrike', timings: ['onEscape'], expectedEffect: revealOrWound('instinct') },
  { setAbbr: 'chmp', groupSlug: 'monsters-unleashed', cardSlug: 'monsteroso', timings: ['onFight'], expectedEffect: addNextHandSize(1) },
  { setAbbr: 'ff04', groupSlug: 'subterranea', cardSlug: 'giganto', timings: ['onFight'], expectedEffect: addNextHandSize(2) },
];

/**
 * Builds the real villain hooks for one villain group from the committed card data.
 *
 * @param setAbbr - The set file to read (data/cards/<setAbbr>.json).
 * @param groupSlug - The villain group to build hooks for.
 * @returns Every hook the villain group produces.
 */
function buildGroupHooks(setAbbr: string, groupSlug: string): VillainAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  const registry = { getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined) };
  const matchConfig = {
    schemeId: `${setAbbr}/unused`,
    mastermindId: `${setAbbr}/unused`,
    villainGroupIds: [`${setAbbr}/${groupSlug}`],
    henchmanGroupIds: [],
    heroDeckIds: [],
    bystandersCount: 0,
    woundsCount: 0,
    officersCount: 0,
    sidekicksCount: 0,
  } as unknown as MatchSetupConfig;
  return buildVillainAbilityHooks(registry, matchConfig);
}

describe('villain primitive marker sweep (reveal-or-wound, add-next-hand-size)', () => {
  for (const sweptCard of SWEPT_CARDS) {
    const { setAbbr, groupSlug, cardSlug, timings, expectedEffect } = sweptCard;
    const copyIdPrefix = `${setAbbr}-villain-${groupSlug}-${cardSlug}-`;

    for (const timing of timings) {
      it(`${setAbbr} ${cardSlug} ${timing} carries ${String(expectedEffect.primitive)}`, () => {
        const hooks = buildGroupHooks(setAbbr, groupSlug);
        const timingHooks = hooks.filter(
          (hook) => hook.cardId.startsWith(copyIdPrefix) && hook.timing === timing,
        );
        assert.ok(timingHooks.length > 0, `at least one ${timing} hook for ${copyIdPrefix}*`);
        for (const timingHook of timingHooks) {
          assert.deepEqual(timingHook.effects, [expectedEffect], `${timingHook.cardId} ${timing} effects`);
          assert.deepEqual(timingHook.unresolvedMarkers ?? [], [], `${timingHook.cardId} marker resolves`);
        }
      });
    }
  }
});
