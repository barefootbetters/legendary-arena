/**
 * The autoplay spend step offers the policy every legal move except the ones the
 * loop drives elsewhere (D-24591).
 *
 * The spend filter used to be an allow-list (recruitHero / fightVillain /
 * fightMastermind / advanceStage), so a spend move the engine adds later, such as
 * WP-757's exorciseHauntedHero, was silently never chosen. selectSpendMoves
 * excludes playCard / revealVillainCard / endTurn and parked `resolve…` choices
 * instead. The first test pins that this is byte-identical to the old allow-list
 * against the REAL getLegalMoves, so the change is behaviour-neutral today.
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialGameState, getLegalMoves } from '@legendary-arena/game-engine';
import { selectSpendMoves } from './botLoopProgress.mjs';

const OLD_ALLOW_LIST = ['recruitHero', 'fightVillain', 'fightMastermind', 'advanceStage'];

/**
 * Builds a real 2-player match state in the main stage with a hand and a
 * generous economy, so getLegalMoves emits playCard alongside the spend moves.
 */
function realMainStageState() {
  const config = {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
  const registry = { listCards: () => [] };
  const setupContext = {
    ctx: { numPlayers: 2 },
    random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
  };
  const gameState = buildInitialGameState(config as never, registry as never, setupContext as never) as unknown as {
    currentStage: string;
    playerZones: Record<string, { hand: string[] }>;
    turnEconomy: { attack: number; recruit: number };
    hq: Array<string | null>;
    city: Array<string | null>;
    mastermind: { tacticsDeck: string[] };
  };
  gameState.currentStage = 'main';
  // why: the empty registry leaves the HQ, City and tactics empty, which would
  // emit no recruit/fight move and make the equivalence pin vacuous. Uncosted ids
  // resolve to cost 0, so each seeded slot is affordable.
  gameState.hq = ['test/hq-hero#0', null, 'test/hq-hero#1', null, null];
  gameState.city = [null, 'test/city-villain#0', null, null, null];
  gameState.mastermind.tacticsDeck = ['test/tactic#0'];
  gameState.playerZones['0']!.hand = ['test/a#0', 'test/b#0'];
  gameState.turnEconomy.attack = 20;
  gameState.turnEconomy.recruit = 20;
  return gameState;
}

test('selectSpendMoves matches the old allow-list against the real engine (behaviour-neutral)', () => {
  const gameState = realMainStageState();
  const legalMoves = getLegalMoves(gameState as never, { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 2 });
  const emittedNames = new Set(legalMoves.map((legalMove) => legalMove.name));
  for (const expectedName of ['playCard', 'recruitHero', 'fightVillain', 'fightMastermind', 'advanceStage']) {
    assert.ok(emittedNames.has(expectedName), `the fixture emits ${expectedName}, so the pin is not vacuous`);
  }
  const oldSpendMoves = legalMoves.filter((legalMove) => OLD_ALLOW_LIST.includes(legalMove.name));
  assert.deepEqual(selectSpendMoves(legalMoves), oldSpendMoves);
});

test('selectSpendMoves drops loop-driven lifecycle moves and parked resolve choices', () => {
  const legalMoves = [
    { name: 'playCard', args: { cardId: 'x' } },
    { name: 'revealVillainCard' },
    { name: 'endTurn' },
    { name: 'resolveSeatChoice', args: { optionIndex: 0 } },
    { name: 'recruitHero', args: { hqIndex: 0 } },
    { name: 'advanceStage' },
  ];
  assert.deepEqual(selectSpendMoves(legalMoves).map((legalMove) => legalMove.name), ['recruitHero', 'advanceStage']);
});

test('a spend move the engine adds later reaches the policy without a server edit (regression)', () => {
  // why: before D-24591 the allow-list dropped this, so all-bot autoplay would
  // never exorcise a haunted Hero once WP-757 ships.
  const legalMoves = [
    { name: 'exorciseHauntedHero', args: { hqIndex: 2 } },
    { name: 'fightVillain', args: { cityIndex: 0 } },
    { name: 'advanceStage' },
  ];
  assert.deepEqual(selectSpendMoves(legalMoves), legalMoves);
});
