/**
 * The Unbreakable Enigma Code — the face-down code, the paid peek and the Mastermind guess
 * (WP-830 / D-24763).
 *
 * "Twists 1-5: Put a card from the Hero Deck face down next to the scheme as part of the 'Enigma
 * Code.' Mix up those cards face-down." "Whenever you fight a Villain, you may pay 1 [recruit] to
 * look at one of the face-down Enigma Cards. When you fight the Mastermind, first guess the color
 * of each Enigma card, and then reveal them. If you guessed them right, fight the Mastermind as
 * normal. If not, your turn ends, and mix up the Enigma cards face-down."
 *
 * Builds a full G from the shipped data/cards/ca75.json (the brainwashTheMilitary.test.ts
 * precedent), resolves Twists through the registered resolver, fights through the real
 * fightVillain / fightMastermind moves, opens owed peeks through the LIVE play-phase turn.onMove,
 * and resolves them with resolveSeatChoice. The mock Shuffle reverses, which proves a mix ran.
 *
 * node:test + node:assert only. No boardgame.io import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { SCHEME_TWIST_RESOLVERS } from './schemeTwistResolvers.js';
import { SCHEME_TWIST_CONFIGS } from './schemeTwistConfigs.js';
import { DEFAULT_IMPLEMENTATION_MAP } from './ruleRuntime.impl.js';
import {
  chooseBotEnigmaGuess,
  ENIGMA_PEEK_SEAT_CHOICE_KIND,
  enigmaColorsOf,
  queueEnigmaPeekOffer,
} from './enigmaCode.logic.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import { choosePlayingSeatChoiceOption } from '../simulation/ai.seatChoice.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import { fightMastermind } from '../moves/fightMastermind.js';
import { fightVillain } from '../moves/fightVillain.js';
import { buildUIState } from '../ui/uiState.build.js';
import { filterUIStateForAudience } from '../ui/uiState.filter.js';
import { LegendaryGame } from '../game.js';
import type { LegendaryGameState } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';

const here = dirname(fileURLToPath(import.meta.url));
const ca75SetData = JSON.parse(readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', 'ca75.json'), 'utf8'));

const SCHEME_ID = 'ca75/unbreakable-enigma-code-the';
const TWIST_ID = 'scheme-twist-enigma-00' as CardExtId;
const REVERSE_RANDOM = { Shuffle: <T,>(deck: T[]): T[] => [...deck].reverse() };
const REVEAL_CONTEXT: RevealContext = { random: REVERSE_RANDOM, ctx: { currentPlayer: '0', turn: 3 } };

/** A setup registry over the real ca75 set (getSet serves ca75.json). */
const REGISTRY = {
  listCards: () => [],
  listSets: () => [{ abbr: 'ca75' }],
  getSet: (abbr: string) => (abbr === 'ca75' ? ca75SetData : undefined),
};

/** A ca75 loadout with the scheme under test. */
const CONFIG: MatchSetupConfig = {
  schemeId: SCHEME_ID,
  mastermindId: 'ca75/arnim-zola',
  villainGroupIds: ['ca75/masters-of-evil-wwii'],
  henchmanGroupIds: [],
  heroDeckIds: ['ca75/agent-x-13', 'ca75/captain-america-falcon', 'ca75/winter-soldier', 'ca75/captain-america-1941'],
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 0,
};

/**
 * Builds a 2-player match on the real ca75 data, in the main stage with plenty of Attack.
 *
 * @returns The game state.
 */
function buildMatch(): LegendaryGameState {
  const G = buildInitialGameState(CONFIG, REGISTRY, makeMockCtx({ numPlayers: 2 }));
  G.currentStage = 'main';
  G.turnEconomy = { ...G.turnEconomy, attack: 99, recruit: 0, spentAttack: 0, spentRecruit: 0 };
  return G;
}

/**
 * Resolves one Enigma Code Twist through the registered resolver, numbering it like the dispatcher.
 *
 * @param G - The game state, mutated in place.
 */
function twist(G: LegendaryGameState): void {
  // why: D-24775 — the dispatcher raises the count before the resolver runs.
  G.counters.schemeTwistCount = (G.counters.schemeTwistCount ?? 0) + 1;
  SCHEME_TWIST_RESOLVERS['enigma-code'](G, REVEAL_CONTEXT, DEFAULT_IMPLEMENTATION_MAP, {}, TWIST_ID);
}

/** The live play-phase turn hooks, read once. */
const PLAY_TURN = (
  LegendaryGame.phases as Record<string, { turn?: { onMove?: (context: unknown) => void } }>
).play!.turn!;

/**
 * Runs the LIVE play-phase turn.onMove (opens an owed peek offer).
 *
 * @param G - The game state, mutated in place.
 */
function settle(G: LegendaryGameState): void {
  PLAY_TURN.onMove!({ G, ctx: { currentPlayer: '0' }, events: {}, random: REVERSE_RANDOM });
}

/**
 * The game log's text lines.
 *
 * @param G - The game state.
 * @returns Each log entry's text, in order.
 */
function logText(G: LegendaryGameState): string[] {
  const lines: string[] = [];
  for (const entry of G.messages) {
    lines.push(typeof entry === 'string' ? entry : entry.text);
  }
  return lines;
}

/**
 * The right guess for the current code (each card's first color).
 *
 * @param G - The game state.
 * @returns One color per card.
 */
function rightGuess(G: LegendaryGameState): string[] {
  const guess: string[] = [];
  for (const cardId of G.enigmaCode ?? []) {
    guess.push(enigmaColorsOf(G, cardId)[0]!);
  }
  return guess;
}

/**
 * A guess that is wrong for every card (a color none of them has).
 *
 * @param G - The game state.
 * @returns One color per card.
 */
function wrongGuess(G: LegendaryGameState): string[] {
  const guess: string[] = [];
  for (const cardId of G.enigmaCode ?? []) {
    const colors = enigmaColorsOf(G, cardId);
    guess.push(['strength', 'instinct', 'covert', 'tech', 'ranged', 'grey'].find((color) => !colors.includes(color as never))!);
  }
  return guess;
}

/**
 * Puts the first Villain card of the Villain Deck in the first City space.
 *
 * @param G - The game state, mutated in place.
 */
function placeVillainInCity(G: LegendaryGameState): void {
  const villainId = G.villainDeck.deck.find((cardId) => G.villainDeckCardTypes[cardId] === 'villain')!;
  G.villainDeck.deck = G.villainDeck.deck.filter((cardId) => cardId !== villainId);
  G.city[0] = villainId;
}

describe('Enigma Code — Twists build the code (WP-830)', () => {
  it('E1 the scheme dispatches to enigma-code and keeps its Twist-6 loss', () => {
    const config = SCHEME_TWIST_CONFIGS.get(SCHEME_ID)!;
    assert.equal(config.resolverId, 'enigma-code');
    assert.equal(config.lossThreshold, 6);
  });

  it('E2 a Twist moves the top Hero Deck card into the code and records a notable event', () => {
    const G = buildMatch();
    const top = G.heroDeck[0]!;
    const deckSize = G.heroDeck.length;
    twist(G);
    assert.deepEqual(G.enigmaCode, [top]);
    assert.equal(G.heroDeck.length, deckSize - 1);
    assert.ok(logText(G).some((line) => line.includes('[Enigma Code] Twist 1') && line.includes('(1 card)')));
    const twistEvent = G.notableEvents.find((event) => event.type === 'schemeTwistResolved');
    assert.ok(twistEvent !== undefined && twistEvent.type === 'schemeTwistResolved');
    assert.equal(twistEvent.resolverKey, 'enigmaCode');
  });

  it('E3 Twists 1-5 build five cards and Twist 6 adds none', () => {
    const G = buildMatch();
    for (let twistIndex = 0; twistIndex < 6; twistIndex++) {
      twist(G);
    }
    assert.equal(G.enigmaCode!.length, 5);
  });

  it('E4 each Twist mixes the code and forgets every peek and the reveal', () => {
    const G = buildMatch();
    const [first, second] = G.heroDeck;
    twist(G);
    G.enigmaPeeks = { '0': [0] };
    G.isEnigmaCodeRevealed = true;
    twist(G);
    assert.deepEqual(G.enigmaCode, [second, first], 'the reversing Shuffle ran over [first, second]');
    assert.equal(G.enigmaPeeks, undefined);
    assert.equal(G.isEnigmaCodeRevealed, undefined);
  });

  it('E5 an empty Hero Deck adds no card but still mixes the code', () => {
    const G = buildMatch();
    const [first, second] = G.heroDeck;
    twist(G);
    twist(G);
    G.enigmaPeeks = { '0': [0] };
    G.heroDeck = [];
    twist(G);
    assert.deepEqual(G.enigmaCode, [first, second], 'two cards, mixed again by the reversing Shuffle');
    assert.equal(G.enigmaPeeks, undefined);
    assert.ok(logText(G).some((line) => line.includes('the Hero Deck is empty') && line.includes('the code is mixed')));
  });

  it('E6 a card is its class color, both colors when dual-class, grey with no class', () => {
    const G = buildMatch();
    const cardId = G.heroDeck[0]!;
    G.cardTraits[cardId] = { heroClass: 'tech', team: null };
    assert.deepEqual(enigmaColorsOf(G, cardId), ['tech']);
    G.cardTraits[cardId] = { heroClass: 'tech', heroClass2: 'covert', team: null };
    assert.deepEqual(enigmaColorsOf(G, cardId), ['tech', 'covert']);
    G.cardTraits[cardId] = { heroClass: null, team: null };
    assert.deepEqual(enigmaColorsOf(G, cardId), ['grey']);
  });
});

describe('Enigma Code — the paid peek (WP-830)', () => {
  it('E7 a Villain fight owes a peek that opens after the move as the fighter\'s choice', () => {
    const G = buildMatch();
    twist(G);
    twist(G);
    placeVillainInCity(G);
    G.turnEconomy = { ...G.turnEconomy, recruit: 2 };
    fightVillain(makeMockMoveContext(G, { numPlayers: 2 }), { cityIndex: 0 });
    assert.equal(G.pendingEnigmaPeekOffers!.length, 1);
    settle(G);
    assert.equal(G.pendingSeatChoice!.kind, ENIGMA_PEEK_SEAT_CHOICE_KIND);
    const options = G.pendingSeatChoice!.seatPrompts['0']!.options;
    assert.deepEqual(options.map((option) => option.label), [
      'Pay 1 Recruit: look at Enigma card 1',
      'Pay 1 Recruit: look at Enigma card 2',
      "Don't look",
    ]);
    assert.equal(G.pendingSeatChoice!.defaultOptionIndex, 2, 'a timeout declines');
    assert.ok(options.every((option) => option.cardId === undefined), 'no option names the card');
  });

  it('E8 looking pays 1 Recruit and remembers the position; declining spends nothing', () => {
    const G = buildMatch();
    twist(G);
    twist(G);
    G.turnEconomy = { ...G.turnEconomy, recruit: 2 };
    queueEnigmaPeekOffer(G, '0');
    settle(G);
    resolveSeatChoice(makeMockMoveContext(G), { optionIndex: 1 });
    assert.deepEqual(G.enigmaPeeks, { '0': [1] });
    assert.equal(G.turnEconomy.spentRecruit, 1);
    assert.ok(logText(G).some((line) => line.includes('paid 1 Recruit to look at Enigma card 2')));
    queueEnigmaPeekOffer(G, '0');
    settle(G);
    assert.equal(G.pendingSeatChoice!.seatPrompts['0']!.options.length, 2, 'only the unseen card and the decline');
    resolveSeatChoice(makeMockMoveContext(G), { optionIndex: 1 });
    assert.equal(G.turnEconomy.spentRecruit, 1, 'the decline spends nothing');
    assert.deepEqual(G.enigmaPeeks, { '0': [1] });
    assert.equal(G.pendingEnigmaPeekOffers, undefined);
  });

  it('E9 an offer without 1 Recruit left, or with nothing unseen, never opens', () => {
    const G = buildMatch();
    twist(G);
    queueEnigmaPeekOffer(G, '0');
    settle(G);
    assert.equal(G.pendingSeatChoice, undefined, 'no Recruit');
    assert.equal(G.pendingEnigmaPeekOffers, undefined);
    G.enigmaPeeks = { '0': [0] };
    queueEnigmaPeekOffer(G, '0');
    assert.equal(G.pendingEnigmaPeekOffers, undefined, 'nothing unseen');
    G.turnEconomy = { ...G.turnEconomy, recruit: 2 };
    queueEnigmaPeekOffer(G, '1');
    settle(G);
    assert.equal(G.pendingSeatChoice, undefined, "another seat's offer is not charged to the current player");
    assert.equal(G.pendingEnigmaPeekOffers, undefined);
  });

  it('E19 the peek waits behind a Diving Block wave the same fight caused', () => {
    const G = buildMatch();
    twist(G);
    G.turnEconomy = { ...G.turnEconomy, recruit: 2 };
    queueEnigmaPeekOffer(G, '0');
    G.pendingDivingBlockWounds = [{ playerID: '0', woundCardId: 'wound-enigma-test' as CardExtId }];
    settle(G);
    assert.equal(G.pendingSeatChoice!.kind, 'diving-block', 'the reaction first');
    assert.equal(G.pendingEnigmaPeekOffers!.length, 1, 'the peek still owed');
  });

  it('E10 the bot looks at the first unseen card', () => {
    const G = buildMatch();
    twist(G);
    twist(G);
    G.turnEconomy = { ...G.turnEconomy, recruit: 2 };
    queueEnigmaPeekOffer(G, '0');
    settle(G);
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), 0);
  });
});

describe('Enigma Code — the Mastermind guess (WP-830)', () => {
  it('E11 with a code, a fight with no guess (or a malformed one) does nothing', () => {
    const G = buildMatch();
    twist(G);
    const tactics = G.mastermind.tacticsDeck.length;
    fightMastermind(makeMockMoveContext(G, { numPlayers: 2 }));
    fightMastermind(makeMockMoveContext(G, { numPlayers: 2 }), { enigmaGuess: ['purple'] });
    fightMastermind(makeMockMoveContext(G, { numPlayers: 2 }), { enigmaGuess: [] });
    assert.equal(G.mastermind.tacticsDeck.length, tactics);
    assert.equal(G.turnEconomy.spentAttack, 0);
  });

  it('E12 a right guess reveals the code and the fight goes ahead', () => {
    const G = buildMatch();
    twist(G);
    twist(G);
    const tactics = G.mastermind.tacticsDeck.length;
    fightMastermind(makeMockMoveContext(G, { numPlayers: 2 }), { enigmaGuess: rightGuess(G) });
    assert.equal(G.mastermind.tacticsDeck.length, tactics - 1);
    assert.equal(G.isEnigmaCodeRevealed, true);
    assert.ok(logText(G).some((line) => line.includes('right, so the fight goes ahead')));
  });

  it('E13 a wrong guess spends no Attack, mixes the code, runs the cleanup and ends the turn', () => {
    const G = buildMatch();
    twist(G);
    twist(G);
    G.enigmaPeeks = { '0': [0] };
    const codeBefore = [...G.enigmaCode!];
    const tactics = G.mastermind.tacticsDeck.length;
    G.playerZones['0']!.inPlay = [G.playerZones['0']!.hand[0]!];
    G.playerZones['0']!.hand = G.playerZones['0']!.hand.slice(1);
    const endTurnCalls: unknown[] = [];
    const moveContext = makeMockMoveContext(G, { numPlayers: 2 });
    moveContext.events.endTurn = (options?: unknown) => { endTurnCalls.push(options); };
    fightMastermind(moveContext, { enigmaGuess: wrongGuess(G) });
    assert.equal(G.mastermind.tacticsDeck.length, tactics, 'no fight');
    assert.equal(G.turnEconomy.spentAttack, 0);
    assert.deepEqual(G.enigmaCode, [...codeBefore].reverse(), 'mixed');
    assert.equal(G.enigmaPeeks, undefined, 'every peek forgotten');
    assert.equal(G.playerZones['0']!.inPlay.length, 0, 'the end-of-turn cleanup ran');
    assert.equal(G.playerZones['0']!.hand.length, 6, 'a new hand was drawn');
    assert.deepEqual(endTurnCalls, [undefined]);
    assert.ok(logText(G).some((line) => line.includes('wrong, so the turn ends')));
  });

  it('E14 a wrong guess with a queued extra turn begins the same seat\'s next turn', () => {
    const G = buildMatch();
    twist(G);
    G.extraTurns = { '0': 1 };
    const endTurnCalls: unknown[] = [];
    const moveContext = makeMockMoveContext(G, { numPlayers: 2 });
    moveContext.events.endTurn = (options?: unknown) => { endTurnCalls.push(options); };
    fightMastermind(moveContext, { enigmaGuess: wrongGuess(G) });
    assert.deepEqual(endTurnCalls, [{ next: '0' }]);
  });

  it('E15 either color of a dual-class card is right', () => {
    const G = buildMatch();
    twist(G);
    const cardId = G.enigmaCode![0]!;
    G.cardTraits[cardId] = { heroClass: 'tech', heroClass2: 'covert', team: null };
    const tactics = G.mastermind.tacticsDeck.length;
    fightMastermind(makeMockMoveContext(G, { numPlayers: 2 }), { enigmaGuess: ['covert'] });
    assert.equal(G.mastermind.tacticsDeck.length, tactics - 1);
  });

  it('E16 the bot fights the Mastermind only once it has seen every card, guessing their colors', () => {
    const G = buildMatch();
    twist(G);
    twist(G);
    G.cardTraits[G.enigmaCode![0]!] = { heroClass: 'ranged', team: null };
    G.cardTraits[G.enigmaCode![1]!] = { heroClass: 'instinct', team: null };
    const context = { phase: 'play', turn: 3, currentPlayer: '0', numPlayers: 2 };
    G.enigmaPeeks = { '0': [0] };
    assert.equal(chooseBotEnigmaGuess(G, '0'), null, 'one card unseen');
    assert.equal(getLegalMoves(G, context).some((move) => move.name === 'fightMastermind'), false, 'no gamble');
    G.enigmaPeeks = { '0': [0, 1] };
    assert.deepEqual(chooseBotEnigmaGuess(G, '0'), ['ranged', 'instinct']);
    const fight = getLegalMoves(G, context).find((move) => move.name === 'fightMastermind');
    assert.deepEqual((fight?.args as { enigmaGuess?: string[] } | undefined)?.enigmaGuess, ['ranged', 'instinct']);
  });
});

describe('Enigma Code — the per-viewer projection (WP-830)', () => {
  it('E17 a viewer sees only the cards they looked at; everyone sees all once revealed', () => {
    const G = buildMatch();
    twist(G);
    twist(G);
    G.enigmaPeeks = { '0': [1] };
    const full = buildUIState(G, makeMockCtx({ numPlayers: 2 }) as never);
    const seat0 = filterUIStateForAudience(full, { kind: 'player', playerId: '0' }).scheme.enigmaCode!;
    const seat1 = filterUIStateForAudience(full, { kind: 'player', playerId: '1' }).scheme.enigmaCode!;
    const spectator = filterUIStateForAudience(full, { kind: 'spectator' }).scheme.enigmaCode!;
    // why: a runtime keyset pin (D-24372) — an unseen card carries peekedBy ONLY; a leaked
    // `colors` would hand every viewer the answer to the guess.
    assert.deepEqual(Object.keys(seat0.cards[0]!), ['peekedBy']);
    assert.equal(seat0.cards[1]!.display!.extId, G.enigmaCode![1]);
    assert.deepEqual(seat0.cards[1]!.colors, enigmaColorsOf(G, G.enigmaCode![1]!));
    assert.deepEqual(seat1.cards.map((card) => Object.keys(card)), [['peekedBy'], ['peekedBy']]);
    assert.deepEqual(seat1.cards[1]!.peekedBy, ['0'], 'who looked is public');
    assert.deepEqual(spectator.cards.map((card) => Object.keys(card)), [['peekedBy'], ['peekedBy']]);
    G.isEnigmaCodeRevealed = true;
    const revealed = filterUIStateForAudience(buildUIState(G, makeMockCtx({ numPlayers: 2 }) as never), { kind: 'spectator' }).scheme.enigmaCode!;
    assert.equal(revealed.isRevealed, true);
    assert.ok(revealed.cards.every((card) => card.display !== undefined));
  });

  it('E18 with no code the projection is absent', () => {
    const G = buildMatch();
    const full = buildUIState(G, makeMockCtx({ numPlayers: 2 }) as never);
    assert.equal(full.scheme.enigmaCode, undefined);
    assert.equal(filterUIStateForAudience(full, { kind: 'player', playerId: '0' }).scheme.enigmaCode, undefined);
  });
});
