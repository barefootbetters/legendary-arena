/**
 * Tests for the Fortify contract and helpers (WP-873 / D-24818).
 *
 * Covers the canonical arrays and records (runtime keyset pins, WP-563 / D-24372), the
 * escape-pile pull in fortifyWithEscapedVillain (the escape counter is never touched), the
 * one-per-place rule, removeFortification's delete-when-empty, and the predicates.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader } from '../test/fixtureBuilders.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import {
  FORTIFY_ALLOWED_LOCKS,
  FORTIFY_LOCK_TEXT,
  FORTIFY_LOCKS,
  FORTIFY_PLACE_LABELS,
  FORTIFY_PLACES,
} from './fortify.types.js';
import {
  buildFortifyBlockReason,
  fortifyWithEscapedVillain,
  getFortification,
  isFortifyPlace,
  isMastermindFortified,
  isSidekickStackFortified,
  listFortifications,
  removeFortification,
} from './fortify.logic.js';

const EMPTY_REGISTRY: CardRegistryReader = { ...makeCardRegistryReader(), listCards: () => [] };
const SQUIRREL_GIRL = 'cvwr-villain-great-lakes-avengers-squirrel-girl-00' as CardExtId;
const COLLEEN_WING = 'cvwr-villain-heroes-for-hire-colleen-wing-00' as CardExtId;
const OTHER_VILLAIN = 'test-villain-other-00' as CardExtId;
const BYSTANDER = 'test-bystander-00' as CardExtId;

/**
 * Builds a game state with an Escape Pile [other, bystander, Squirrel Girl] and counter 3.
 *
 * @returns The game state.
 */
function buildState(): LegendaryGameState {
  const config: MatchConfiguration = {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 0,
  };
  const G = buildInitialGameState(config, EMPTY_REGISTRY, makeMockCtx({ numPlayers: 1 }));
  G.escapedPile = [OTHER_VILLAIN, BYSTANDER, SQUIRREL_GIRL];
  G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] = 3;
  G.cardDisplayData = {
    ...G.cardDisplayData,
    [SQUIRREL_GIRL]: { extId: SQUIRREL_GIRL, name: 'Squirrel Girl', imageUrl: '', cost: 0 },
  };
  return G;
}

describe('WP-873 fortify contract (D-24818)', () => {
  it('T1: the arrays are the canonical order and the records key exactly their members', () => {
    assert.deepStrictEqual([...FORTIFY_PLACES], ['sidekick-stack', 'mastermind']);
    assert.deepStrictEqual([...FORTIFY_LOCKS], ['no-recruit-or-gain', 'no-fight']);
    assert.deepStrictEqual(FORTIFY_ALLOWED_LOCKS, {
      'sidekick-stack': ['no-recruit-or-gain'],
      mastermind: ['no-fight'],
    });
    assert.deepStrictEqual(Object.keys(FORTIFY_ALLOWED_LOCKS), [...FORTIFY_PLACES]);
    assert.deepStrictEqual(Object.keys(FORTIFY_PLACE_LABELS), [...FORTIFY_PLACES]);
    assert.deepStrictEqual(Object.keys(FORTIFY_LOCK_TEXT), [...FORTIFY_LOCKS]);
    assert.deepStrictEqual(FORTIFY_PLACE_LABELS, {
      'sidekick-stack': 'the Sidekick Stack',
      mastermind: 'the Mastermind',
    });
    assert.deepStrictEqual(FORTIFY_LOCK_TEXT, {
      'no-recruit-or-gain': "Sidekicks can't be recruited or gained",
      'no-fight': "the Mastermind can't be fought",
    });
    assert.equal(isFortifyPlace('sidekick-stack'), true);
    assert.equal(isFortifyPlace('wound-stack'), false);
    assert.equal(isFortifyPlace(3), false);
  });
});

describe('WP-873 fortify helpers (D-24818)', () => {
  it('T2: fortifying pulls one index out of the Escape Pile and never touches the counter', () => {
    const G = buildState();
    assert.equal(G.fortifications, undefined, 'the table is lazy');
    const outcome = fortifyWithEscapedVillain(G, 'sidekick-stack', 'no-recruit-or-gain', SQUIRREL_GIRL);
    assert.equal(outcome, 'fortified');
    assert.deepStrictEqual(G.escapedPile, [OTHER_VILLAIN, BYSTANDER], 'other pile cards keep their order');
    assert.equal(G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS], 3);
    assert.deepStrictEqual(G.fortifications, {
      'sidekick-stack': { villainCardId: SQUIRREL_GIRL, lock: 'no-recruit-or-gain' },
    });
  });

  it('T3: an already-fortified place and a Villain not in the pile write nothing', () => {
    const G = buildState();
    fortifyWithEscapedVillain(G, 'sidekick-stack', 'no-recruit-or-gain', SQUIRREL_GIRL);
    const pileBefore = [...G.escapedPile];
    const tableBefore = structuredClone(G.fortifications);
    assert.equal(fortifyWithEscapedVillain(G, 'sidekick-stack', 'no-recruit-or-gain', OTHER_VILLAIN), 'already-fortified');
    assert.deepStrictEqual(G.escapedPile, pileBefore);
    assert.deepStrictEqual(G.fortifications, tableBefore);
    assert.equal(fortifyWithEscapedVillain(G, 'mastermind', 'no-fight', COLLEEN_WING), 'not-in-escape-pile');
    assert.deepStrictEqual(G.escapedPile, pileBefore);
    assert.deepStrictEqual(G.fortifications, tableBefore);
  });

  it('T4: removeFortification, the predicates, the list and the reason track the entry', () => {
    const G = buildState();
    assert.equal(isSidekickStackFortified(G), false);
    assert.equal(isMastermindFortified(G), false);
    assert.deepStrictEqual(listFortifications(G), []);
    assert.equal(buildFortifyBlockReason(G, 'sidekick-stack'), null);
    fortifyWithEscapedVillain(G, 'sidekick-stack', 'no-recruit-or-gain', SQUIRREL_GIRL);
    assert.equal(isSidekickStackFortified(G), true);
    assert.equal(isMastermindFortified(G), false);
    assert.deepStrictEqual(listFortifications(G), [
      { place: 'sidekick-stack', fortification: { villainCardId: SQUIRREL_GIRL, lock: 'no-recruit-or-gain' } },
    ]);
    assert.equal(
      buildFortifyBlockReason(G, 'sidekick-stack'),
      'Squirrel Girl fortifies the Sidekick Stack. Fight Squirrel Girl first.',
    );
    assert.equal(removeFortification(G, 'mastermind'), null, 'a missing place returns null');
    assert.equal(removeFortification(G, 'sidekick-stack'), SQUIRREL_GIRL);
    assert.equal('fortifications' in G, false, 'the key is deleted when the table empties');
    assert.equal(getFortification(G, 'sidekick-stack'), null);
    assert.equal(isSidekickStackFortified(G), false);
    assert.equal(buildFortifyBlockReason(G, 'sidekick-stack'), null);
  });

  it('T4: listFortifications follows FORTIFY_PLACES order and the reason falls back to the id', () => {
    const G = buildState();
    G.escapedPile = [...G.escapedPile, COLLEEN_WING];
    fortifyWithEscapedVillain(G, 'mastermind', 'no-fight', COLLEEN_WING);
    fortifyWithEscapedVillain(G, 'sidekick-stack', 'no-recruit-or-gain', SQUIRREL_GIRL);
    const places = listFortifications(G).map((entry) => entry.place);
    assert.deepStrictEqual(places, ['sidekick-stack', 'mastermind']);
    assert.equal(isMastermindFortified(G), true);
    assert.equal(
      buildFortifyBlockReason(G, 'mastermind'),
      `${COLLEEN_WING} fortifies the Mastermind. Fight ${COLLEEN_WING} first.`,
    );
    removeFortification(G, 'mastermind');
    assert.ok(G.fortifications !== undefined, 'one entry remains, so the key stays');
  });
});
