/**
 * cvwr Big Bertha's Fight and Escape lines dispatch the reveal-or-wound effect.
 *
 * Big Bertha (Great Lakes Avengers) prints "Fight: Each player reveals a [hc:strength] Hero or
 * gains a Wound." and "Escape: Same effect." Neither line carried an `[effect:]` marker, so the
 * Fight logged an `unmarked-ability` no-handler and the Wound never landed (operator match
 * vZXSkk4xJNC, log 6.2.15: Player 1 held no Strength Hero and gained nothing). The curated map
 * now marks both lines `reveal-or-wound:hc:strength`, the same shape core Zzzax uses for the same
 * printed text (WP-469 / D-24281).
 *
 * Builds the real hooks from the committed data/cards/cvwr.json. No boardgame.io imports.
 * node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';

// why: resolve the repo-root data directory from this test's own location (the
// amwpWaspSizeChanging.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const BIG_BERTHA_COPY_IDS = [
  'cvwr-villain-great-lakes-avengers-big-bertha-00',
  'cvwr-villain-great-lakes-avengers-big-bertha-01',
];

/**
 * Builds the real villain hooks for cvwr Great Lakes Avengers from the committed card data.
 *
 * @returns Every hook the villain group produces.
 */
function buildGreatLakesAvengersHooks(): VillainAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'cvwr.json'), 'utf8'));
  const registry = { getSet: (abbr: string) => (abbr === 'cvwr' ? setData : undefined) };
  const matchConfig = {
    schemeId: 'cvwr/unused',
    mastermindId: 'cvwr/unused',
    villainGroupIds: ['cvwr/great-lakes-avengers'],
    henchmanGroupIds: [],
    heroDeckIds: [],
    bystandersCount: 0,
    woundsCount: 0,
    officersCount: 0,
    sidekicksCount: 0,
  } as unknown as MatchSetupConfig;
  return buildVillainAbilityHooks(registry, matchConfig);
}

describe('cvwr Big Bertha reveal-or-wound (Fight + Escape)', () => {
  const hooks = buildGreatLakesAvengersHooks();

  for (const copyId of BIG_BERTHA_COPY_IDS) {
    for (const timing of ['onFight', 'onEscape'] as const) {
      it(`${copyId} ${timing} carries reveal-or-wound for a Strength Hero`, () => {
        const timingHooks = hooks.filter((hook) => hook.cardId === copyId && hook.timing === timing);
        assert.equal(timingHooks.length, 1, `one ${timing} hook for ${copyId}`);
        const timingHook = timingHooks[0]!;
        assert.deepEqual(timingHook.effects, [
          { primitive: 'reveal-or-wound', requireKind: 'hero-class', requireValue: 'strength' },
        ]);
        assert.deepEqual(timingHook.unresolvedMarkers ?? [], [], 'the marker resolves');
      });
    }
  }
});
