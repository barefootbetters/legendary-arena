/**
 * The Unending Energy return-on-discard reaction on its co2e and wwhk reprints
 * (WP-498 / D-24301 follow-up).
 *
 * Printed:
 *   co2e Cyclops "Unending Energy": "When a card effect causes you to discard this card from
 *     your hand, you may return it to your hand."
 *   wwhk Gladiator Hulk "Hulk Is King": "When a card effect causes you to discard this card,
 *     you may return this card to your hand."
 *
 * Only core Unending Energy carried [keyword:return-on-discard], so the reprints never offered
 * the return: in live match 7XTFMemTaJH co2e Frost Giant Warrior's Ambush made Player 0 discard
 * co2e Unending Energy on the bot's turn and no return choice opened. Both lines now carry the
 * marker (hero-ability-markers.json). These tests parse the REAL marked lines through
 * buildHeroAbilityHooks and drive the live scenario through the Frost Giant trait-discard seat
 * choice, so the wiring cannot drift from a hand-authored hook.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { makeCardRegistryReader, makePlayerZones } from '../test/fixtureBuilders.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import {
  RETURN_ON_DISCARD_SEAT_CHOICE_KIND,
  openNonActiveReturnOnDiscardSeatChoiceIfNeeded,
} from '../moves/resolveReturnOnDiscard.js';
import {
  VILLAIN_EFFECT_TRAIT_DISCARD_KIND,
  openEscapeProcedureSeatChoiceIfNeeded,
} from '../villainDeck/villainEscapeProcedure.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// why: the exact generated ability lines, verified against data/cards/co2e.json
// (cyclops/unending-energy) and data/cards/wwhk.json (gladiator-hulk/hulk-is-king).
const CO2E_UNENDING_ENERGY_ABILITY =
  'When a card effect causes you to discard this card from your hand, you may return it to your hand. [keyword:return-on-discard]';
const HULK_IS_KING_ABILITY =
  'When a card effect causes you to discard this card, you may return this card to your hand. [keyword:return-on-discard]';
// why: the co2e line as it shipped before the marker, kept to prove the live gap is real.
const CO2E_UNENDING_ENERGY_UNMARKED =
  'When a card effect causes you to discard this card from your hand, you may return it to your hand.';

const CO2E_UNENDING_ENERGY = 'co2e/cyclops/unending-energy#0' as CardExtId;
const HULK_IS_KING = 'wwhk/gladiator-hulk/hulk-is-king#0' as CardExtId;
const FROST_GIANT = 'frost-giant-warrior-01' as CardExtId;
const NON_RANGED = 'test-non-ranged-hero' as CardExtId;

/**
 * Builds a getSet registry holding one single-copy hero card.
 *
 * @param setAbbr - The set abbreviation.
 * @param heroSlug - The hero deck slug.
 * @param cardSlug - The card slug (its canonical face).
 * @param abilities - The card's ability lines.
 * @returns A registry buildHeroAbilityHooks accepts.
 */
function makeRegistry(setAbbr: string, heroSlug: string, cardSlug: string, abilities: string[]): unknown {
  const setData = {
    abbr: setAbbr,
    heroes: [{
      slug: heroSlug,
      cards: [{ slug: cardSlug, abilities }],
      physicalCards: [{ id: 'p0', count: 1, sides: [cardSlug] }],
    }],
    villains: [],
    henchmen: [],
    schemes: [],
    masterminds: [],
    bystanders: [],
    wounds: [],
    other: [],
  };
  return {
    listCards: () => [],
    listSets: () => [{ abbr: setAbbr }],
    getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined),
  };
}

/**
 * Parses one card's ability lines into its hero ability hooks.
 *
 * @param heroDeckId - The `{setAbbr}/{heroSlug}` deck id.
 * @param cardSlug - The card slug.
 * @param abilities - The card's ability lines.
 * @returns The hooks keyed to that card's single copy.
 */
function hooksFor(heroDeckId: string, cardSlug: string, abilities: string[]): HeroAbilityHook[] {
  const [setAbbr, heroSlug] = heroDeckId.split('/') as [string, string];
  const config: MatchSetupConfig = {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: ['test/villain-001'],
    henchmanGroupIds: ['test/henchman-001'],
    heroDeckIds: [heroDeckId],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
  const cardId = `${heroDeckId}/${cardSlug}#0`;
  return buildHeroAbilityHooks(makeRegistry(setAbbr, heroSlug, cardSlug, abilities), config)
    .filter((hook) => hook.cardId === cardId);
}

/**
 * Two seats after co2e Frost Giant Warrior's Ambush on the bot's (seat 1's) turn: seat 0 holds
 * only co2e Unending Energy (its one Ranged Hero), seat 1 holds no Ranged Hero.
 *
 * @param abilities - Unending Energy's ability lines (marked or unmarked).
 * @returns The game state with the Frost Giant discard owed.
 */
function buildFrostGiantState(abilities: string[]): LegendaryGameState {
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
  const gameState = buildInitialGameState(config, makeCardRegistryReader(), makeMockCtx({ numPlayers: 2 }));
  gameState.playerZones = {
    '0': { ...makePlayerZones(), deck: [], hand: [CO2E_UNENDING_ENERGY], discard: [], inPlay: [], victory: [] },
    '1': { ...makePlayerZones(), deck: [], hand: [NON_RANGED], discard: [], inPlay: [], victory: [] },
  };
  gameState.piles.wounds = ['test-wound-00', 'test-wound-01'] as CardExtId[];
  gameState.heroAbilityHooks = hooksFor('co2e/cyclops', 'unending-energy', abilities);
  gameState.cardTraits = {
    ...gameState.cardTraits,
    [CO2E_UNENDING_ENERGY]: { heroClass: 'ranged', team: 'x-men' },
    [NON_RANGED]: { heroClass: 'tech', team: 'avengers' },
  } as LegendaryGameState['cardTraits'];
  gameState.pendingEscapeEffectDiscards = [{
    escapedCardId: FROST_GIANT,
    eligibleCosts: [],
    traitFilter: {
      requireKind: 'hero-class',
      requireValue: 'ranged',
      requirementLabel: 'Ranged',
      effectLabel: 'Ambush',
      hasWoundAlternative: true,
    },
  }];
  return gameState;
}

/**
 * Submits `optionIndex` for `seat` through the real resolveSeatChoice move.
 *
 * @param gameState - The game state.
 * @param seat - The submitting seat.
 * @param optionIndex - The option the seat picks.
 */
function submit(gameState: LegendaryGameState, seat: string, optionIndex: number): void {
  resolveSeatChoice(makeMockMoveContext(gameState, { playerID: seat, numPlayers: 2 }), { optionIndex });
}

/**
 * Opens the Frost Giant seat choice on seat 1's turn and has seat 0 discard Unending Energy.
 *
 * @param gameState - The Frost Giant state, mutated.
 */
function discardUnendingEnergyToFrostGiant(gameState: LegendaryGameState): void {
  openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '1');
  const choice = gameState.pendingSeatChoice;
  assert.ok(choice !== undefined, 'the Frost Giant discard opens a seat choice');
  assert.equal(choice.kind, VILLAIN_EFFECT_TRAIT_DISCARD_KIND);
  assert.deepEqual(choice.addressedSeats, ['0'], 'only seat 0 has a Ranged Hero to discard');
  assert.deepEqual(choice.seatPrompts['0']!.options[0], { label: CO2E_UNENDING_ENERGY, cardId: CO2E_UNENDING_ENERGY });
  submit(gameState, '0', 0);
  assert.deepEqual(gameState.playerZones['0']!.discard, [CO2E_UNENDING_ENERGY], 'the card is discarded first');
}

describe('return-on-discard reprints parse to the reactive hook (WP-498 / D-24301)', () => {
  const cases = [
    { label: 'co2e Cyclops Unending Energy', deck: 'co2e/cyclops', slug: 'unending-energy', ability: CO2E_UNENDING_ENERGY_ABILITY },
    { label: 'wwhk Gladiator Hulk Hulk Is King', deck: 'wwhk/gladiator-hulk', slug: 'hulk-is-king', ability: HULK_IS_KING_ABILITY },
  ];
  for (const testCase of cases) {
    it(`${testCase.label} carries return-on-discard with onDiscard timing`, () => {
      const hooks = hooksFor(testCase.deck, testCase.slug, [testCase.ability]);
      assert.equal(hooks.length, 1, 'one hook for the one printed ability line');
      assert.deepEqual(hooks[0]!.keywords, ['return-on-discard']);
      assert.equal(hooks[0]!.timing, 'onDiscard');
      assert.deepEqual(hooks[0]!.unresolvedMarkers ?? [], [], 'no hollow marker rides the line');
    });
  }
});

describe('co2e Unending Energy discarded to Frost Giant Warrior on another seat\'s turn (match 7XTFMemTaJH)', () => {
  it('parks the return, opens seat 0\'s return choice, and returns the card to hand', () => {
    const gameState = buildFrostGiantState([CO2E_UNENDING_ENERGY_ABILITY]);
    discardUnendingEnergyToFrostGiant(gameState);
    assert.equal(gameState.pendingSeatChoice, undefined, 'the trait choice cleared on apply');
    assert.deepEqual(gameState.pendingReturnOnDiscard, [{ playerID: '0', cardId: CO2E_UNENDING_ENERGY }]);

    // why: the play-phase turn.onMove opener, called directly with seat 1 as the active player.
    openNonActiveReturnOnDiscardSeatChoiceIfNeeded(gameState, undefined, '1');
    const returnChoice = gameState.pendingSeatChoice;
    assert.ok(returnChoice !== undefined, 'the return-on-discard choice opens for seat 0');
    assert.equal(returnChoice.kind, RETURN_ON_DISCARD_SEAT_CHOICE_KIND);
    assert.deepEqual(returnChoice.addressedSeats, ['0']);

    submit(gameState, '0', 0);
    assert.deepEqual(gameState.playerZones['0']!.hand, [CO2E_UNENDING_ENERGY], 'the card is back in hand');
    assert.deepEqual(gameState.playerZones['0']!.discard, []);
    assert.deepEqual(gameState.pendingReturnOnDiscard, []);
  });

  it('the unmarked line (as shipped before this fix) parks nothing, which is the live gap', () => {
    const gameState = buildFrostGiantState([CO2E_UNENDING_ENERGY_UNMARKED]);
    discardUnendingEnergyToFrostGiant(gameState);
    assert.equal(gameState.pendingReturnOnDiscard, undefined);
    openNonActiveReturnOnDiscardSeatChoiceIfNeeded(gameState, undefined, '1');
    assert.equal(gameState.pendingSeatChoice, undefined, 'no return choice opens');
  });
});
