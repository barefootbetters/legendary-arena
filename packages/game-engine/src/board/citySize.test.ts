/**
 * A City of any size from 1 to 6 spaces (WP-831 / D-24764).
 *
 * A scheme can change the number of city spaces (Change the Outcome of WWII; rules v23 "Ego",
 * "Galactus"). Every rule that used to assume five spaces reads the current size instead: villains
 * enter space 0 and escape off the LAST space, a fight or a move names only a space that exists, a
 * Guard blocks up to the current edge, and the operator escape uses the last space. At five
 * spaces every existing test is the oracle that nothing changed.
 *
 * node:test + node:assert only. No boardgame.io import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeCity, pushVillainIntoCity } from './city.logic.js';
import { CITY_DEFAULT_SIZE, CITY_MAX_SIZE, CITY_MIN_SIZE } from './city.types.js';
import { validateCityShape } from './city.validate.js';
import { isGuardBlocking } from './boardKeywords.logic.js';
import { checkCitySize } from '../invariants/structural.checks.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { fightVillain } from '../moves/fightVillain.js';
import { resolveMoveVillainChoice } from '../moves/moveVillainChoice.resolve.js';
import { operatorEscapeVillain } from '../moves/operatorSetters.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import type { LegendaryGameState } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { BoardKeyword } from './boardKeywords.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const ca75SetData = JSON.parse(readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', 'ca75.json'), 'utf8'));

/** A setup registry over the real ca75 set (getSet serves ca75.json). */
const REGISTRY = {
  listCards: () => [],
  listSets: () => [{ abbr: 'ca75' }],
  getSet: (abbr: string) => (abbr === 'ca75' ? ca75SetData : undefined),
};

/** A plain ca75 loadout. */
const CONFIG: MatchSetupConfig = {
  schemeId: 'ca75/unbreakable-enigma-code-the',
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
 * The Villain Deck's Villain cards, in deck order.
 *
 * @param G - The game state.
 * @returns Villain card ids.
 */
function villainCards(G: LegendaryGameState): CardExtId[] {
  return G.villainDeck.deck.filter((cardId) => G.villainDeckCardTypes[cardId] === 'villain');
}

describe('City size — the zone itself (WP-831)', () => {
  it('V1 a City starts at five spaces and can be built at any size from 1 to 6', () => {
    assert.equal(CITY_DEFAULT_SIZE, 5);
    assert.deepEqual(initializeCity(), [null, null, null, null, null]);
    assert.deepEqual(initializeCity(CITY_MIN_SIZE), [null]);
    assert.equal(initializeCity(CITY_MAX_SIZE).length, 6);
  });

  it('V2 a full City of any size escapes its LAST space; a partial one cascades to the first gap', () => {
    const three = pushVillainIntoCity(['a', 'b', 'c'], 'n');
    assert.deepEqual(three, { city: ['n', 'a', 'b'], escapedCard: 'c' });
    const six = pushVillainIntoCity(['a', 'b', 'c', 'd', 'e', 'f'], 'n');
    assert.deepEqual(six, { city: ['n', 'a', 'b', 'c', 'd', 'e'], escapedCard: 'f' });
    const one = pushVillainIntoCity(['a'], 'n');
    assert.deepEqual(one, { city: ['n'], escapedCard: 'a' });
    const gap = pushVillainIntoCity(['a', null, 'c', 'd', 'e', 'f'], 'n');
    assert.deepEqual(gap, { city: ['n', 'a', 'c', 'd', 'e', 'f'], escapedCard: null });
  });

  it('V3 the shape check and the invariant accept 1-6 spaces and reject 0 or 7', () => {
    for (const size of [1, 2, 3, 4, 5, 6]) {
      assert.deepEqual(validateCityShape(initializeCity(size)), { ok: true });
      const G = { city: initializeCity(size) } as unknown as LegendaryGameState;
      assert.doesNotThrow(() => checkCitySize(G));
    }
    for (const size of [0, 7]) {
      const result = validateCityShape(initializeCity(size));
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.errors[0]!.code, 'INVALID_CITY_LENGTH');
        assert.equal(result.errors[0]!.message, `G.city must have between 1 and 6 spaces, but has ${size}.`);
      }
      const G = { city: initializeCity(size) } as unknown as LegendaryGameState;
      assert.throws(() => checkCitySize(G));
    }
  });

  it('V4 a Guard blocks up to the current edge, including a sixth space', () => {
    const keywords: Record<CardExtId, BoardKeyword[]> = { guard: ['guard'] };
    assert.equal(isGuardBlocking(['target', null, null, null, null, 'guard'], 0, keywords), true);
    assert.equal(isGuardBlocking(['target', null, null], 0, keywords), false);
  });
});

describe('City size — the moves (WP-831)', () => {
  it('V5 a fight names only a space that exists: a sixth space can be fought, a removed one cannot', () => {
    const G = buildMatch();
    const [villain] = villainCards(G);
    G.city = [null, null, null, null, null, villain!];
    fightVillain(makeMockMoveContext(G, { numPlayers: 2 }), { cityIndex: 5 });
    assert.equal(G.city[5], null, 'the Villain on the sixth space was fought');
    const H = buildMatch();
    H.city = initializeCity(3);
    const before = JSON.stringify(H.city);
    fightVillain(makeMockMoveContext(H, { numPlayers: 2 }), { cityIndex: 3 });
    assert.equal(JSON.stringify(H.city), before);
    assert.equal(H.city.length, 3, 'nothing was written past the edge');
  });

  it('V6 a revealed Villain enters a smaller City, and one pushed off its last space escapes', () => {
    const G = buildMatch();
    const villains = villainCards(G);
    const top = villains[0]!;
    G.villainDeck.deck = [top, ...G.villainDeck.deck.filter((cardId) => cardId !== top)];
    G.currentStage = 'start';
    G.city = [villains[1]!, villains[2]!];
    const escapedBefore = G.escapedPile.length;
    revealVillainCard(makeMockMoveContext(G, { numPlayers: 2 }));
    assert.deepEqual(G.city, [top, villains[1]]);
    assert.equal(G.escapedPile.length, escapedBefore + 1);
    assert.ok(G.escapedPile.includes(villains[2]!));
  });

  it('V5b the bot enumerates a fight on the sixth space, as the move allows it', () => {
    const G = buildMatch();
    const [villain] = villainCards(G);
    G.city = [null, null, null, null, null, villain!];
    const moves = getLegalMoves(G, { phase: 'play', turn: 3, currentPlayer: '0', numPlayers: 2 });
    assert.ok(moves.some((move) => move.name === 'fightVillain' && (move.args as { cityIndex: number }).cityIndex === 5));
  });

  it('V9 Spinning Cyclone can move a Villain off the sixth space, and the bot resolves it', () => {
    const G = buildMatch();
    const [villain] = villainCards(G);
    G.city = [null, null, null, null, null, villain!];
    G.attachedBystanders[villain!] = [G.piles.bystanders[0]!];
    G.pendingMoveVillainChoices = [{ playerID: '0', sourceCardId: 'spinning-cyclone' as CardExtId }];
    const [botMove] = getLegalMoves(G, { phase: 'play', turn: 3, currentPlayer: '0', numPlayers: 2 });
    assert.deepEqual(botMove, { name: 'resolveMoveVillainChoice', args: { fromCityIndex: 5, toCityIndex: 0 } });
    resolveMoveVillainChoice(makeMockMoveContext(G, { numPlayers: 2 }), { fromCityIndex: 5, toCityIndex: 0 });
    assert.equal(G.city[0], villain);
    assert.equal(G.city[5], null);
    assert.equal(G.pendingMoveVillainChoices?.length ?? 0, 0, 'the choice resolved (no freeze)');
  });

  it('V8 the bot declines a move-a-Villain choice in a 1-space City (no other space exists)', () => {
    const G = buildMatch();
    const [villain] = villainCards(G);
    G.city = [villain!];
    G.attachedBystanders[villain!] = [G.piles.bystanders[0]!];
    G.pendingMoveVillainChoices = [{ playerID: '0', sourceCardId: 'spinning-cyclone' as CardExtId }];
    const moves = getLegalMoves(G, { phase: 'play', turn: 3, currentPlayer: '0', numPlayers: 2 });
    assert.deepEqual(moves, [{ name: 'resolveMoveVillainChoice', args: { decline: true } }]);
  });

  it('V7 the operator escape uses the last space of the current City', () => {
    const G = buildMatch();
    const [villain] = villainCards(G);
    G.isDebugMatch = true;
    G.city = [null, null, villain!];
    operatorEscapeVillain(makeMockMoveContext(G, { numPlayers: 2 }), {});
    assert.deepEqual(G.city, [null, null, null]);
    assert.ok(G.escapedPile.includes(villain!));
  });
});
