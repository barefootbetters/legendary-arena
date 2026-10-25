/**
 * Tests for the operator setters (WP-806 / EC-843 / D-24713).
 *
 * The harness is a real operator-match `G` from buildInitialGameState (the
 * operatorView.build.test.ts pattern), moved to the `main` stage and seeded per
 * case, with each move called through makeMockMoveContext (seat '0', two seats).
 * The moves are called directly, so turn.onMove and endIf do not run here; their
 * consequences are verified live under WP-807.
 *
 * Uses node:test and node:assert only. No boardgame.io/testing import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  operatorSetSupplyCount,
  operatorMoveToDeckTop,
  operatorRevealNow,
  operatorMoveCard,
  operatorAddEconomy,
  operatorEscapeVillain,
} from './operatorSetters.js';
import { OPERATOR_SETTER_MOVE_NAMES, OPERATOR_SUPPLY_PILES } from './operatorSetters.types.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { MockMoveContext } from '../test/mockMoveContext.js';
import { makeCardRegistryReader } from '../test/fixtureBuilders.js';
import { buildOperatorView } from '../ui/operatorView.build.js';
import { LegendaryGame } from '../game.js';
import { SIMULATION_MOVE_NAMES } from '../simulation/ai.legalMoves.js';
import { SIMULATION_RUNNER_MOVE_NAMES } from '../simulation/simulation.runner.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import type { MatchConfiguration, LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/** A setter move as the tests call it. */
type SetterMove = (context: MockMoveContext, args: unknown) => void;

const SCHEME_TWIST_ID = 'scheme-twist-00';
const ESCAPING_VILLAIN_ID = 'city-villain-04';
const CAPTURED_BYSTANDER_ID = 'captured-bystander-00';
const DIVING_BLOCK_ID = 'core/captain-america/diving-block#0';
const RETURN_ON_DISCARD_ID = 'test-cyclops-unending-energy#0';

/**
 * Builds a two-seat operator match through the real setup path, in the `main`
 * stage, with every zone a setter reads seeded with known cards.
 */
function createOperatorState(): LegendaryGameState {
  const config: MatchConfiguration = {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
    isDebugMatch: true,
  };
  const registry = { ...makeCardRegistryReader(), listCards: () => [] };
  const G = buildInitialGameState(config, registry, makeMockCtx());
  G.currentStage = 'main';
  G.villainDeck.deck = [...G.villainDeck.deck, SCHEME_TWIST_ID];
  G.villainDeckCardTypes[SCHEME_TWIST_ID] = 'scheme-twist';
  G.heroDeck = ['hero-a', 'hero-b', 'hero-c'];
  G.hq = ['hq-0', null, 'hq-2', null, null];
  G.city = [null, null, null, null, ESCAPING_VILLAIN_ID];
  G.attachedBystanders[ESCAPING_VILLAIN_ID] = [CAPTURED_BYSTANDER_ID];
  for (const seat of ['0', '1']) {
    G.playerZones[seat] = {
      deck: [`p${seat}-deck-a`, `p${seat}-deck-b`],
      hand: [`p${seat}-hand-a`, `p${seat}-hand-b`],
      discard: [`p${seat}-discard-a`],
      inPlay: [`p${seat}-inplay-a`],
      victory: [`p${seat}-victory-a`],
      undercover: [],
    };
  }
  return G;
}

/**
 * The move context for seat '0', the current player, in a two-seat match.
 */
function contextFor(G: LegendaryGameState): MockMoveContext {
  return makeMockMoveContext(G, { playerID: '0', numPlayers: 2 });
}

/**
 * Runs a setter as seat '0' on its own turn.
 */
function run(move: SetterMove, G: LegendaryGameState, args: unknown): void {
  move(contextFor(G), args);
}

/**
 * The text of a log entry without its `{turn}.{step}.{action}` prefix.
 */
function stripLogPrefix(text: string): string {
  return text.replace(/^\d+\.\d+\.\d+ /, '');
}

/**
 * The log lines a call added, without prefixes.
 */
function addedLogLines(G: LegendaryGameState, lengthBefore: number): string[] {
  const lines: string[] = [];
  for (const entry of G.messages.slice(lengthBefore)) {
    lines.push(stripLogPrefix(entry.text));
  }
  return lines;
}

/**
 * Appends every card id in a list (skipping empty HQ / City slots) to `into`.
 */
function collectIds(into: string[], cards: readonly (CardExtId | null)[] | undefined): void {
  for (const cardId of cards ?? []) {
    if (cardId !== null) {
      into.push(cardId);
    }
  }
}

/**
 * The sorted multiset of every card id held anywhere on the board (WP-806 §D 8).
 * Reference-only queues (pendingDivingBlockWounds, pendingEscapeProcedures) are
 * not counted, and `undercover` mirrors `victory`, so neither double-counts.
 */
function collectAllCardIds(G: LegendaryGameState): string[] {
  const ids: string[] = [];
  for (const zones of Object.values(G.playerZones)) {
    for (const zone of [zones.deck, zones.hand, zones.discard, zones.inPlay, zones.victory]) {
      collectIds(ids, zone);
    }
  }
  for (const pile of Object.values(G.piles)) collectIds(ids, pile);
  for (const pile of [G.villainDeck.deck, G.villainDeck.discard, G.heroDeck, G.hq, G.city, G.ko, G.escapedPile]) {
    collectIds(ids, pile);
  }
  for (const pile of Object.values(G.operatorSetAside ?? {})) collectIds(ids, pile);
  for (const record of [G.attachedBystanders, G.villainAttachedHeroes, G.outOfTimeCards ?? {}]) {
    for (const cards of Object.values(record)) collectIds(ids, cards);
  }
  for (const pile of [G.scheme.twistPile, G.mastermind.strikePile, G.mastermind.tacticsDeck, G.mastermind.tacticsDefeated, G.mastermind.attachedBystanders, G.transformDeck]) {
    collectIds(ids, pile);
  }
  for (const entry of G.pendingTeleportReturns ?? []) ids.push(entry.cardId);
  return ids.sort();
}

/** One successful call per setter, on a fresh `createOperatorState()`. */
const SETTER_CASES: readonly { name: string; move: SetterMove; args: unknown }[] = [
  { name: 'operatorSetSupplyCount', move: operatorSetSupplyCount, args: { pile: 'wounds', count: 3 } },
  { name: 'operatorMoveToDeckTop', move: operatorMoveToDeckTop, args: { deck: 'hero', cardId: 'hero-c' } },
  { name: 'operatorRevealNow', move: operatorRevealNow, args: { cardType: 'scheme-twist' } },
  { name: 'operatorMoveCard', move: operatorMoveCard, args: { cardId: 'p0-hand-a', from: { zone: 'hand', playerId: '0' }, to: { zone: 'ko' } } },
  { name: 'operatorAddEconomy', move: operatorAddEconomy, args: { resource: 'attack', amount: 2 } },
  { name: 'operatorEscapeVillain', move: operatorEscapeVillain, args: {} },
];

/** A gate blocker: applying it must refuse every setter; removing it must let the setter run. */
interface GateBlocker {
  readonly label: string;
  readonly apply: (G: LegendaryGameState, context: MockMoveContext) => void;
  readonly remove: (G: LegendaryGameState, context: MockMoveContext) => void;
}

const GATE_BLOCKERS: readonly GateBlocker[] = [
  {
    label: 'isDebugMatch absent',
    apply: (G) => { Reflect.deleteProperty(G, 'isDebugMatch'); },
    remove: (G) => { Object.assign(G, { isDebugMatch: true }); },
  },
  {
    label: 'the submitter is not the current player',
    apply: (_G, context) => { context.ctx.currentPlayer = '1'; },
    remove: (_G, context) => { context.ctx.currentPlayer = '0'; },
  },
  {
    label: "the stage is 'start'",
    apply: (G) => { G.currentStage = 'start'; },
    remove: (G) => { G.currentStage = 'main'; },
  },
  {
    label: "the stage is 'cleanup'",
    apply: (G) => { G.currentStage = 'cleanup'; },
    remove: (G) => { G.currentStage = 'main'; },
  },
  {
    label: 'pendingHeroChoice is set',
    apply: (G) => { Object.assign(G, { pendingHeroChoice: { playerID: '0', options: [] } }); },
    remove: (G) => { Reflect.deleteProperty(G, 'pendingHeroChoice'); },
  },
  {
    label: 'a hasAnyPendingChoice member (pendingDoOverChoices) is set',
    apply: (G) => { Object.assign(G, { pendingDoOverChoices: [{ playerID: '0', cardId: 'do-over#0' }] }); },
    remove: (G) => { Reflect.deleteProperty(G, 'pendingDoOverChoices'); },
  },
  {
    label: 'pendingDivingBlockWounds is non-empty',
    apply: (G) => { G.pendingDivingBlockWounds = [{ playerID: '1', woundCardId: 'pile-wound' }]; },
    remove: (G) => { Reflect.deleteProperty(G, 'pendingDivingBlockWounds'); },
  },
  {
    label: 'pendingEscapeProcedures is non-empty',
    apply: (G) => {
      G.pendingEscapeProcedures = [{ escapedCardId: 'old-escapee', chooserPlayerID: '0', hasCarriedBystanders: false, isHqKoResolved: false }];
    },
    remove: (G) => { Reflect.deleteProperty(G, 'pendingEscapeProcedures'); },
  },
  {
    label: 'pendingEscapeEffectDiscards is non-empty',
    apply: (G) => {
      G.pendingEscapeEffectDiscards = [{ escapedCardId: 'primus-01', eligibleCosts: [2, 3, 5, 7] }];
    },
    remove: (G) => { Reflect.deleteProperty(G, 'pendingEscapeEffectDiscards'); },
  },
  {
    // why: WP-828 / D-24761 — owed Man Out of Time grants (Winter Soldier's 2>4) are opened into a
    // seat choice after the move, like the escape queues above.
    label: 'pendingOutOfTimeGrants is non-empty',
    apply: (G) => { G.pendingOutOfTimeGrants = [{ playerID: '0', sourceCardId: 'ca75/winter-soldier/2-4#0' }]; },
    remove: (G) => { Reflect.deleteProperty(G, 'pendingOutOfTimeGrants'); },
  },
  {
    // why: WP-829 / D-24762 — owed Go Back in Time Purges are opened into a seat choice after
    // the move, like the escape queues above.
    label: 'pendingTimestreamPurges is non-empty',
    apply: (G) => { G.pendingTimestreamPurges = [{ chooserPlayerID: '0', twistCardId: 'scheme-twist-01' }]; },
    remove: (G) => { Reflect.deleteProperty(G, 'pendingTimestreamPurges'); },
  },
];

describe('operator setters — gate (WP-806 §D 1)', () => {
  for (const setter of SETTER_CASES) {
    for (const blocker of GATE_BLOCKERS) {
      it(`${setter.name} is refused when ${blocker.label}, and runs once the blocker is removed`, () => {
        const G = createOperatorState();
        const context = contextFor(G);
        blocker.apply(G, context);
        const before = structuredClone(G);
        setter.move(context, setter.args);
        assert.deepEqual(G, before, `${setter.name} must leave G untouched when ${blocker.label}.`);

        blocker.remove(G, context);
        const unblocked = structuredClone(G);
        setter.move(context, setter.args);
        assert.notDeepEqual(G, unblocked, `${setter.name} must change G once the blocker is removed (positive control).`);
      });
    }
  }

  it('a non-empty pendingTeleportReturns is not a choice and does not block operatorAddEconomy', () => {
    const G = createOperatorState();
    G.pendingTeleportReturns = [{ playerID: '0', cardId: 'teleport-card#0' }];
    run(operatorAddEconomy, G, { resource: 'recruit', amount: 4 });
    assert.equal(G.turnEconomy.recruit, 4);
  });

  it('every setter refuses an undefined and a null payload without throwing', () => {
    for (const setter of SETTER_CASES) {
      for (const payload of [undefined, null]) {
        const G = createOperatorState();
        const before = structuredClone(G);
        setter.move(contextFor(G), payload);
        assert.deepEqual(G, before, `${setter.name} must refuse a ${String(payload)} payload.`);
      }
    }
  });

  it('a fresh operator match has no operatorSetAside key (omit-when-off)', () => {
    const G = createOperatorState();
    assert.equal(Object.hasOwn(G, 'operatorSetAside'), false);
  });
});

describe('operatorSetSupplyCount (WP-806 §D 2)', () => {
  it('a decrease to 0 moves every Wound to operatorSetAside.wounds and logs the exact line', () => {
    const G = createOperatorState();
    const lengthBefore = G.messages.length;
    run(operatorSetSupplyCount, G, { pile: 'wounds', count: 0 });
    assert.deepEqual(G.piles.wounds, []);
    assert.equal(G.operatorSetAside?.wounds?.length, 15);
    assert.deepEqual(addedLogLines(G, lengthBefore), ['Operator: Wound supply set to 0 (was 15).']);
  });

  it('an increase restores cards from the set-aside zone and keeps the emptied key', () => {
    const G = createOperatorState();
    run(operatorSetSupplyCount, G, { pile: 'bystanders', count: 4 });
    assert.equal(G.piles.bystanders.length, 4);
    assert.equal(G.operatorSetAside?.bystanders?.length, 6);
    const lengthBefore = G.messages.length;
    run(operatorSetSupplyCount, G, { pile: 'bystanders', count: 10 });
    assert.equal(G.piles.bystanders.length, 10);
    assert.deepEqual(G.operatorSetAside?.bystanders, []);
    assert.deepEqual(addedLogLines(G, lengthBefore), ['Operator: Bystander supply set to 10 (was 4).']);
  });

  it('a decrease then an equal increase restores the original pile order', () => {
    const G = createOperatorState();
    G.piles.officers = ['officer-0', 'officer-1', 'officer-2', 'officer-3'];
    run(operatorSetSupplyCount, G, { pile: 'officers', count: 1 });
    assert.deepEqual(G.piles.officers, ['officer-3']);
    assert.deepEqual(G.operatorSetAside?.officers, ['officer-0', 'officer-1', 'officer-2']);
    run(operatorSetSupplyCount, G, { pile: 'officers', count: 4 });
    assert.deepEqual(G.piles.officers, ['officer-0', 'officer-1', 'officer-2', 'officer-3']);
  });

  it('refuses over-max, negative, non-integer, non-number and unknown-pile requests', () => {
    for (const args of [
      { pile: 'wounds', count: 16 },
      { pile: 'wounds', count: -1 },
      { pile: 'wounds', count: 1.5 },
      { pile: 'wounds', count: '3' },
      { pile: 'horrors', count: 0 },
      { count: 0 },
    ]) {
      const G = createOperatorState();
      const before = structuredClone(G);
      run(operatorSetSupplyCount, G, args);
      assert.deepEqual(G, before, `operatorSetSupplyCount must refuse ${JSON.stringify(args)}.`);
    }
  });

  it('an equal count is a silent no-op with no log line', () => {
    const G = createOperatorState();
    const before = structuredClone(G);
    run(operatorSetSupplyCount, G, { pile: 'sidekicks', count: 5 });
    assert.deepEqual(G, before);
  });
});

describe('operatorMoveToDeckTop (WP-806 §D 3)', () => {
  it('moves a villain-deck card to index 0 and keeps the rest in order', () => {
    const G = createOperatorState();
    const original = [...G.villainDeck.deck];
    const lengthBefore = G.messages.length;
    run(operatorMoveToDeckTop, G, { deck: 'villain', cardId: 'master-strike-01' });
    const rest = original.filter((cardId) => cardId !== 'master-strike-01');
    assert.deepEqual(G.villainDeck.deck, ['master-strike-01', ...rest]);
    assert.equal(addedLogLines(G, lengthBefore).length, 1);
    assert.match(addedLogLines(G, lengthBefore)[0]!, /^Operator: .*master-strike-01.* moved to the top of the Villain Deck\.$/);
  });

  it('moves a hero-deck card to index 0 and keeps the rest in order', () => {
    const G = createOperatorState();
    const lengthBefore = G.messages.length;
    run(operatorMoveToDeckTop, G, { deck: 'hero', cardId: 'hero-c' });
    assert.deepEqual(G.heroDeck, ['hero-c', 'hero-a', 'hero-b']);
    assert.match(addedLogLines(G, lengthBefore)[0]!, /moved to the top of the Hero Deck\.$/);
  });

  it('refuses an absent card, a card already on top, an unknown deck and a non-string cardId', () => {
    for (const args of [
      { deck: 'hero', cardId: 'not-in-deck' },
      { deck: 'hero', cardId: 'hero-a' },
      { deck: 'player', cardId: 'hero-b' },
      { deck: 'hero', cardId: 42 },
    ]) {
      const G = createOperatorState();
      const before = structuredClone(G);
      run(operatorMoveToDeckTop, G, args);
      assert.deepEqual(G, before, `operatorMoveToDeckTop must refuse ${JSON.stringify(args)}.`);
    }
  });
});

describe('operatorRevealNow (WP-806 §D 4)', () => {
  it('reveals the deep Scheme Twist through the reveal path, with the reveal lines after the operator line', () => {
    const G = createOperatorState();
    G.villainRevealedThisTurn = false;
    const deckLengthBefore = G.villainDeck.deck.length;
    const lengthBefore = G.messages.length;
    run(operatorRevealNow, G, { cardType: 'scheme-twist' });
    assert.equal(G.villainDeck.deck.length, deckLengthBefore - 1);
    assert.equal(G.villainDeck.deck.includes(SCHEME_TWIST_ID), false);
    const occurrences = [...G.villainDeck.deck, ...G.scheme.twistPile].filter((cardId) => cardId === SCHEME_TWIST_ID);
    assert.equal(occurrences.length, 1);
    assert.deepEqual(G.scheme.twistPile, [SCHEME_TWIST_ID]);
    assert.equal(G.villainRevealedThisTurn, false);
    const lines = addedLogLines(G, lengthBefore);
    assert.match(lines[0]!, /^Operator: revealing .*scheme-twist-00.* now\.$/);
    assert.ok(lines.length > 1, 'The reveal path must add its own log lines after the operator line.');
  });

  it('reveals the first Master Strike into the strike pile', () => {
    const G = createOperatorState();
    const firstStrike = G.villainDeck.deck[0]!;
    run(operatorRevealNow, G, { cardType: 'mastermind-strike' });
    assert.deepEqual(G.mastermind.strikePile, [firstStrike]);
  });

  it('leaves the once-per-turn reveal allowance alone when it was already spent', () => {
    const G = createOperatorState();
    G.villainRevealedThisTurn = true;
    run(operatorRevealNow, G, { cardType: 'scheme-twist' });
    assert.equal(G.villainRevealedThisTurn, true);
  });

  it('refuses a deck with no Master Strike and an unknown card type', () => {
    const G = createOperatorState();
    G.villainDeck.deck = G.villainDeck.deck.filter((cardId) => G.villainDeckCardTypes[cardId] !== 'mastermind-strike');
    const before = structuredClone(G);
    run(operatorRevealNow, G, { cardType: 'mastermind-strike' });
    run(operatorRevealNow, G, { cardType: 'villain' });
    assert.deepEqual(G, before);
  });
});

describe('operatorMoveCard R1 — a gain from a supply (WP-806 §D 5)', () => {
  it('Wounds go to a discard pile through gainWoundForPlayer, so Diving Block fires', () => {
    const G = createOperatorState();
    G.playerZones['1']!.hand = [DIVING_BLOCK_ID];
    G.heroAbilityHooks = [{ cardId: DIVING_BLOCK_ID, timing: 'onPlay', keywords: ['diving-block'] }];
    const lengthBefore = G.messages.length;
    run(operatorMoveCard, G, { cardId: 'pile-wound', from: { zone: 'supply', pile: 'wounds' }, to: { zone: 'discard', playerId: '1' } });
    assert.equal(G.piles.wounds.length, 14);
    assert.deepEqual(G.playerZones['1']!.discard, ['p1-discard-a', 'pile-wound']);
    assert.deepEqual(G.pendingDivingBlockWounds, [{ playerID: '1', woundCardId: 'pile-wound' }]);
    assert.match(addedLogLines(G, lengthBefore)[0]!, /^Operator: .*pile-wound.* moved from the Wound supply to Player 1's discard pile\.$/);
  });

  it('Officers and Sidekicks go to a discard pile; Bystanders go to a Victory Pile', () => {
    const cases = [
      { pile: 'officers', cardId: 'pile-shield-officer', zone: 'discard' },
      { pile: 'sidekicks', cardId: 'pile-sidekick', zone: 'discard' },
      { pile: 'bystanders', cardId: 'pile-bystander', zone: 'victory' },
    ] as const;
    for (const gain of cases) {
      const G = createOperatorState();
      const pileLength = G.piles[gain.pile].length;
      run(operatorMoveCard, G, { cardId: gain.cardId, from: { zone: 'supply', pile: gain.pile }, to: { zone: gain.zone, playerId: '0' } });
      assert.equal(G.piles[gain.pile].length, pileLength - 1, `${gain.pile} must lose its top card.`);
      assert.equal(G.playerZones['0']![gain.zone].at(-1), gain.cardId, `${gain.pile} must land in the ${gain.zone}.`);
    }
  });

  it('refuses a card that is not the top of the pile, a wrong destination and a supply destination', () => {
    for (const args of [
      { cardId: 'p0-hand-a', from: { zone: 'supply', pile: 'wounds' }, to: { zone: 'discard', playerId: '0' } },
      { cardId: 'pile-wound', from: { zone: 'supply', pile: 'wounds' }, to: { zone: 'victory', playerId: '0' } },
      { cardId: 'pile-bystander', from: { zone: 'supply', pile: 'bystanders' }, to: { zone: 'discard', playerId: '0' } },
      { cardId: 'p0-hand-a', from: { zone: 'hand', playerId: '0' }, to: { zone: 'supply', pile: 'wounds' } },
    ]) {
      const G = createOperatorState();
      const before = structuredClone(G);
      run(operatorMoveCard, G, args);
      assert.deepEqual(G, before, `operatorMoveCard must refuse ${JSON.stringify(args)}.`);
    }
  });
});

describe('operatorMoveCard R2 — a KO from a player zone (WP-806 §D 5)', () => {
  it('KOs a card from each of the five player zones', () => {
    for (const zone of ['hand', 'deck', 'discard', 'inPlay', 'victory'] as const) {
      const G = createOperatorState();
      const cardId = G.playerZones['1']![zone][0]!;
      run(operatorMoveCard, G, { cardId, from: { zone, playerId: '1' }, to: { zone: 'ko' } });
      assert.equal(G.playerZones['1']![zone].includes(cardId), false, `${zone} must lose the card.`);
      assert.deepEqual(G.ko, [cardId], `the KO pile must hold the card from ${zone}.`);
    }
  });
});

describe('operatorMoveCard R3 — between player zones (WP-806 §D 5)', () => {
  it('a deck destination puts the card on top, with the exact label', () => {
    const G = createOperatorState();
    const lengthBefore = G.messages.length;
    run(operatorMoveCard, G, { cardId: 'p0-hand-a', from: { zone: 'hand', playerId: '0' }, to: { zone: 'deck', playerId: '1' } });
    assert.deepEqual(G.playerZones['0']!.hand, ['p0-hand-b']);
    assert.deepEqual(G.playerZones['1']!.deck, ['p0-hand-a', 'p1-deck-a', 'p1-deck-b']);
    assert.match(addedLogLines(G, lengthBefore)[0]!, /moved from Player 0's hand to the top of Player 1's deck\.$/);
  });

  it('the deck top moves into the hand (a draw by the operator)', () => {
    const G = createOperatorState();
    run(operatorMoveCard, G, { cardId: 'p0-deck-a', from: { zone: 'deck', playerId: '0' }, to: { zone: 'hand', playerId: '0' } });
    assert.deepEqual(G.playerZones['0']!.deck, ['p0-deck-b']);
    assert.deepEqual(G.playerZones['0']!.hand, ['p0-hand-a', 'p0-hand-b', 'p0-deck-a']);
  });

  it('a play-area card moves to another seat\'s Victory Pile', () => {
    const G = createOperatorState();
    const lengthBefore = G.messages.length;
    run(operatorMoveCard, G, { cardId: 'p0-inplay-a', from: { zone: 'inPlay', playerId: '0' }, to: { zone: 'victory', playerId: '1' } });
    assert.deepEqual(G.playerZones['0']!.inPlay, []);
    assert.deepEqual(G.playerZones['1']!.victory, ['p1-victory-a', 'p0-inplay-a']);
    assert.match(addedLogLines(G, lengthBefore)[0]!, /moved from Player 0's play area to Player 1's Victory Pile\.$/);
  });

  it('same-seat hand → discard goes through discardFromHand (a return-on-discard card parks its return)', () => {
    const G = createOperatorState();
    G.playerZones['0']!.hand = [RETURN_ON_DISCARD_ID];
    G.heroAbilityHooks = [{ cardId: RETURN_ON_DISCARD_ID, timing: 'onDiscard', keywords: ['return-on-discard'] }];
    run(operatorMoveCard, G, { cardId: RETURN_ON_DISCARD_ID, from: { zone: 'hand', playerId: '0' }, to: { zone: 'discard', playerId: '0' } });
    assert.deepEqual(G.playerZones['0']!.discard, ['p0-discard-a', RETURN_ON_DISCARD_ID]);
    assert.deepEqual(G.pendingReturnOnDiscard, [{ playerID: '0', cardId: RETURN_ON_DISCARD_ID }]);
  });

  it('refuses cross-seat hand → discard, an inPlay destination, a KO source and a same-zone move', () => {
    for (const args of [
      { cardId: 'p0-hand-a', from: { zone: 'hand', playerId: '0' }, to: { zone: 'discard', playerId: '1' } },
      { cardId: 'p0-hand-a', from: { zone: 'hand', playerId: '0' }, to: { zone: 'inPlay', playerId: '0' } },
      { cardId: 'p0-hand-a', from: { zone: 'ko' }, to: { zone: 'hand', playerId: '0' } },
      { cardId: 'p0-hand-a', from: { zone: 'hand', playerId: '0' }, to: { zone: 'hand', playerId: '0' } },
    ]) {
      const G = createOperatorState();
      G.ko = ['p0-hand-a'];
      const before = structuredClone(G);
      run(operatorMoveCard, G, args);
      assert.deepEqual(G, before, `operatorMoveCard must refuse ${JSON.stringify(args)}.`);
    }
  });
});

describe('operatorMoveCard R4 — a hero into the HQ (WP-806 §D 5)', () => {
  it('fills an empty space; nothing refills and the hero deck loses only the placed card', () => {
    const G = createOperatorState();
    const lengthBefore = G.messages.length;
    run(operatorMoveCard, G, { cardId: 'hero-b', from: { zone: 'heroDeck' }, to: { zone: 'hq', hqIndex: 1 } });
    assert.deepEqual(G.hq, ['hq-0', 'hero-b', 'hq-2', null, null]);
    assert.deepEqual(G.heroDeck, ['hero-a', 'hero-c']);
    assert.match(addedLogLines(G, lengthBefore)[0]!, /moved from the Hero Deck to HQ space 2\.$/);
  });

  it('an occupied space sends the displaced card to the hero-deck bottom', () => {
    const G = createOperatorState();
    const lengthBefore = G.messages.length;
    run(operatorMoveCard, G, { cardId: 'hero-b', from: { zone: 'heroDeck' }, to: { zone: 'hq', hqIndex: 0 } });
    assert.deepEqual(G.hq, ['hero-b', null, 'hq-2', null, null]);
    assert.deepEqual(G.heroDeck, ['hero-a', 'hero-c', 'hq-0']);
    assert.equal(G.heroDeck.length, 3);
    assert.match(addedLogLines(G, lengthBefore)[0]!, /moved from the Hero Deck to HQ space 1\. .*hq-0.* went to the bottom of the Hero Deck\.$/);
  });
});

describe('operatorMoveCard — refused payloads (WP-806 §D 5)', () => {
  it('refuses malformed refs, foreign or prototype player ids, absent cards and out-of-range HQ spaces without throwing', () => {
    for (const args of [
      { cardId: 'p0-hand-a', from: null, to: { zone: 'ko' } },
      { cardId: 'p0-hand-a', from: { zone: 'hand', playerId: '0' }, to: undefined },
      { cardId: 42, from: { zone: 'hand', playerId: '0' }, to: { zone: 'ko' } },
      { cardId: 'p0-hand-a', from: { zone: 'hand', playerId: 'constructor' }, to: { zone: 'ko' } },
      { cardId: 'p0-hand-a', from: { zone: 'hand', playerId: '__proto__' }, to: { zone: 'ko' } },
      { cardId: 'p0-hand-a', from: { zone: 'hand', playerId: '7' }, to: { zone: 'ko' } },
      { cardId: 'not-in-hand', from: { zone: 'hand', playerId: '0' }, to: { zone: 'ko' } },
      { cardId: 'hero-a', from: { zone: 'heroDeck' }, to: { zone: 'hq', hqIndex: 5 } },
      { cardId: 'hero-a', from: { zone: 'heroDeck' }, to: { zone: 'hq', hqIndex: -1 } },
      { cardId: 'hero-a', from: { zone: 'heroDeck' }, to: { zone: 'hand', playerId: '0' } },
      { cardId: 'not-in-deck', from: { zone: 'heroDeck' }, to: { zone: 'hq', hqIndex: 1 } },
    ]) {
      const G = createOperatorState();
      const before = structuredClone(G);
      run(operatorMoveCard, G, args);
      assert.deepEqual(G, before, `operatorMoveCard must refuse ${JSON.stringify(args)}.`);
    }
  });
});

describe('operatorAddEconomy (WP-806 §D 6)', () => {
  it('adds Attack and Recruit for this turn and logs the exact line', () => {
    const G = createOperatorState();
    const attackBefore = G.turnEconomy.attack;
    const recruitBefore = G.turnEconomy.recruit;
    const lengthBefore = G.messages.length;
    run(operatorAddEconomy, G, { resource: 'attack', amount: 20 });
    run(operatorAddEconomy, G, { resource: 'recruit', amount: 1 });
    assert.equal(G.turnEconomy.attack, attackBefore + 20);
    assert.equal(G.turnEconomy.recruit, recruitBefore + 1);
    assert.deepEqual(addedLogLines(G, lengthBefore), ['Operator: +20 Attack this turn.', 'Operator: +1 Recruit this turn.']);
  });

  it('refuses 0, 21, 1.5 and an unknown resource', () => {
    for (const args of [
      { resource: 'attack', amount: 0 },
      { resource: 'attack', amount: 21 },
      { resource: 'recruit', amount: 1.5 },
      { resource: 'piercing', amount: 2 },
    ]) {
      const G = createOperatorState();
      const before = structuredClone(G);
      run(operatorAddEconomy, G, args);
      assert.deepEqual(G, before, `operatorAddEconomy must refuse ${JSON.stringify(args)}.`);
    }
  });
});

describe('operatorEscapeVillain (WP-806 §D 7)', () => {
  it('the space-4 Villain escapes through the escape path, carrying its Bystanders', () => {
    const G = createOperatorState();
    const escapedBefore = G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0;
    const lengthBefore = G.messages.length;
    run(operatorEscapeVillain, G, { ignored: true });
    assert.equal(G.city[4], null);
    assert.ok(G.escapedPile.includes(ESCAPING_VILLAIN_ID));
    assert.ok(G.escapedPile.includes(CAPTURED_BYSTANDER_ID));
    assert.equal(Object.hasOwn(G.attachedBystanders, ESCAPING_VILLAIN_ID), false);
    assert.equal(G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS], escapedBefore + 1);
    const lines = addedLogLines(G, lengthBefore);
    assert.match(lines[0]!, /^Operator: .*city-villain-04.* escapes\.$/);
    assert.ok(lines.length > 1, 'The escape path must add its own log lines after the operator line.');
  });

  it('an empty space 4 is refused', () => {
    const G = createOperatorState();
    G.city = [ESCAPING_VILLAIN_ID, null, null, null, null];
    const before = structuredClone(G);
    run(operatorEscapeVillain, G, {});
    assert.deepEqual(G, before);
  });
});

describe('operator setters — conservation (WP-806 §D 8)', () => {
  const conservationCases: readonly { label: string; move: SetterMove; args: unknown; prepare?: (G: LegendaryGameState) => void }[] = [
    { label: 'setter 1 decrease', move: operatorSetSupplyCount, args: { pile: 'wounds', count: 2 } },
    { label: 'setter 1 increase', move: operatorSetSupplyCount, args: { pile: 'wounds', count: 9 }, prepare: (G) => run(operatorSetSupplyCount, G, { pile: 'wounds', count: 0 }) },
    { label: 'setter 2 villain', move: operatorMoveToDeckTop, args: { deck: 'villain', cardId: SCHEME_TWIST_ID } },
    { label: 'setter 2 hero', move: operatorMoveToDeckTop, args: { deck: 'hero', cardId: 'hero-b' } },
    { label: 'R1 wounds', move: operatorMoveCard, args: { cardId: 'pile-wound', from: { zone: 'supply', pile: 'wounds' }, to: { zone: 'discard', playerId: '1' } } },
    { label: 'R1 officers', move: operatorMoveCard, args: { cardId: 'pile-shield-officer', from: { zone: 'supply', pile: 'officers' }, to: { zone: 'discard', playerId: '0' } } },
    { label: 'R1 sidekicks', move: operatorMoveCard, args: { cardId: 'pile-sidekick', from: { zone: 'supply', pile: 'sidekicks' }, to: { zone: 'discard', playerId: '0' } } },
    { label: 'R1 bystanders', move: operatorMoveCard, args: { cardId: 'pile-bystander', from: { zone: 'supply', pile: 'bystanders' }, to: { zone: 'victory', playerId: '0' } } },
    { label: 'R2', move: operatorMoveCard, args: { cardId: 'p1-victory-a', from: { zone: 'victory', playerId: '1' }, to: { zone: 'ko' } } },
    { label: 'R3 deck top', move: operatorMoveCard, args: { cardId: 'p0-discard-a', from: { zone: 'discard', playerId: '0' }, to: { zone: 'deck', playerId: '0' } } },
    { label: 'R3 hand discard', move: operatorMoveCard, args: { cardId: 'p0-hand-a', from: { zone: 'hand', playerId: '0' }, to: { zone: 'discard', playerId: '0' } } },
    { label: 'R3 cross-seat', move: operatorMoveCard, args: { cardId: 'p1-hand-b', from: { zone: 'hand', playerId: '1' }, to: { zone: 'victory', playerId: '0' } } },
    { label: 'R4 empty space', move: operatorMoveCard, args: { cardId: 'hero-c', from: { zone: 'heroDeck' }, to: { zone: 'hq', hqIndex: 3 } } },
    { label: 'R4 occupied space', move: operatorMoveCard, args: { cardId: 'hero-c', from: { zone: 'heroDeck' }, to: { zone: 'hq', hqIndex: 2 } } },
  ];
  for (const conservation of conservationCases) {
    it(`${conservation.label} neither creates nor destroys a card`, () => {
      const G = createOperatorState();
      conservation.prepare?.(G);
      const idsBefore = collectAllCardIds(G);
      const unchanged = structuredClone(G);
      run(conservation.move, G, conservation.args);
      assert.notDeepEqual(G, unchanged, `${conservation.label} must move a card.`);
      assert.deepEqual(collectAllCardIds(G), idsBefore);
    });
  }
});

describe('operator setters — no random, determinism, logging (WP-806 §D 9–11)', () => {
  it('setters 1, 2, 4 and 5 never read random (a get-trap Proxy throws on any access)', () => {
    const throwingRandom = new Proxy({}, {
      get(): never {
        throw new Error('An operator setter read random, but setters 1, 2, 4 and 5 must never touch it (D-24689 §7).');
      },
    }) as MockMoveContext['random'];
    for (const setter of SETTER_CASES) {
      if (setter.name === 'operatorRevealNow' || setter.name === 'operatorEscapeVillain') continue;
      const G = createOperatorState();
      const before = structuredClone(G);
      setter.move({ ...contextFor(G), random: throwingRandom }, setter.args);
      assert.notDeepEqual(G, before, `${setter.name} must still run with the throwing random.`);
    }
  });

  it('the same G and args, run on two clones, give deep-equal results', () => {
    for (const setter of SETTER_CASES) {
      const first = createOperatorState();
      const second = structuredClone(first);
      run(setter.move, first, setter.args);
      run(setter.move, second, setter.args);
      assert.deepEqual(first, second, `${setter.name} must be deterministic.`);
    }
  });

  it('the first entry each setter adds starts with "Operator:"; setters 1, 2, 4 and 5 add only that entry', () => {
    for (const setter of SETTER_CASES) {
      const G = createOperatorState();
      const lengthBefore = G.messages.length;
      run(setter.move, G, setter.args);
      const lines = addedLogLines(G, lengthBefore);
      assert.ok(lines[0]?.startsWith('Operator:'), `${setter.name}'s first added log entry must start with "Operator:".`);
      if (setter.name !== 'operatorRevealNow' && setter.name !== 'operatorEscapeVillain') {
        assert.equal(lines.length, 1, `${setter.name} must add exactly one log entry.`);
      }
    }
  });
});

describe('operator setters — runtime pins (WP-806 §D 12)', () => {
  it('every operator setter is registered on LegendaryGame as { move, client: false }', () => {
    const moves = LegendaryGame.moves ?? {};
    const registeredNames = Object.keys(moves);
    for (const moveName of OPERATOR_SETTER_MOVE_NAMES) {
      assert.ok(registeredNames.includes(moveName), `${moveName} must be registered on LegendaryGame.moves.`);
      const registration = moves[moveName];
      assert.equal(typeof registration, 'object', `${moveName} must use the long registration form.`);
      assert.equal((registration as { client?: unknown }).client, false, `${moveName} must be server-only (client: false).`);
    }
  });

  it('no operator setter is in SIMULATION_MOVE_NAMES or the simulation runner MOVE_MAP', () => {
    for (const moveName of OPERATOR_SETTER_MOVE_NAMES) {
      assert.equal((SIMULATION_MOVE_NAMES as readonly string[]).includes(moveName), false, `${moveName} must not be in SIMULATION_MOVE_NAMES.`);
      assert.equal(SIMULATION_RUNNER_MOVE_NAMES.includes(moveName), false, `${moveName} must not be in the simulation MOVE_MAP.`);
    }
  });

  it('OPERATOR_SUPPLY_PILES matches the OperatorSupplyCounts key set of a built OperatorView', () => {
    const G = createOperatorState();
    run(operatorSetSupplyCount, G, { pile: 'sidekicks', count: 1 });
    const view = buildOperatorView(G, { phase: 'play', turn: 1, currentPlayer: '0' });
    assert.ok(view !== null);
    assert.deepEqual(Object.keys(view.supplyCounts), [...OPERATOR_SUPPLY_PILES]);
    assert.deepEqual(Object.keys(view.setAsideCounts ?? {}), [...OPERATOR_SUPPLY_PILES]);
  });
});
