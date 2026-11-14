/**
 * A bot Heist round-trips from a simulation capture through the fixture runner (D-24831).
 *
 * WP-878 / D-24826 taught the bot to attempt a Heist, so a simulation capture can now hold an
 * `attemptHeist` move and the resolve moves the Heist abilities park. The D-24273 capture ->
 * replay contract says `runFixture` (the fixture oracle `record-game-fixture.mjs` records through)
 * must replay any capture the sim produces. Before D-24831 its MOVE_MAP held 12 moves and threw
 * "unknown move name" on the first `attemptHeist`.
 *
 * This file drives a real-data game (core board, the amwp Heist hero decks) through the sim with
 * a policy that attempts a Heist whenever getLegalMoves offers one, then replays the captured
 * moves through `runFixture`. The sim exposes no final `G`, so the sim side is observed through
 * the policy's `playerView.log`; the Heist log lines of both paths must match in order.
 *
 * No boardgame.io imports. No @legendary-arena/registry imports. No `Math.random()`.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { UIState } from '../ui/uiState.types.js';
import type { ClientTurnIntent } from '../network/intent.types.js';
import type { AIPolicy, LegalMove } from './ai.types.js';
import type { FixtureFile } from '../test/fixtures/fixtureSchema.js';
import type { ReplayMove } from '../replay/replay.types.js';

import { simulateOneGameAndCaptureMoves } from './simulation.runner.js';
import { runFixture } from '../test/fixtures/runFixture.js';
import { validateFixture } from '../test/fixtures/fixtureSchema.js';

const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

// why: the attemptHeist log line (moves/attemptHeist.ts). Matched on the log text only.
const HEIST_LINE_PATTERN = /attempts a Heist: Heist Count/;

// why: a short game is enough to reach several Heists; the cap keeps the test fast.
const MAX_TURNS = 16;

/**
 * Reads the committed card data for the sets the match uses.
 *
 * @returns A registry reader over data/cards/core.json and data/cards/amwp.json.
 */
function buildRealDataRegistry(): CardRegistryReader {
  const setsByAbbr: Record<string, unknown> = {
    core: JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'core.json'), 'utf8')),
    amwp: JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'amwp.json'), 'utf8')),
  };
  return {
    listCards: () => [],
    listSets: () => [{ abbr: 'core' }, { abbr: 'amwp' }],
    getSet: (abbr: string) => setsByAbbr[abbr],
  } as unknown as CardRegistryReader;
}

/** A one-seat core board with three amwp hero decks that carry Heist cards. */
function buildHeistConfig(): MatchSetupConfig {
  return {
    schemeId: 'core/midtown-bank-robbery',
    mastermindId: 'core/dr-doom',
    villainGroupIds: ['core/hydra'],
    henchmanGroupIds: ['core/doombot-legion'],
    heroDeckIds: ['amwp/scott-lang-cat-burglar', 'amwp/ant-man', 'amwp/wasp'],
    bystandersCount: 1,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

/**
 * A deterministic policy that attempts a Heist whenever it is offered, otherwise plays a card,
 * otherwise takes the first offered move (a resolve move when a choice is parked, or a recruit,
 * fight or stage advance). It records every log line it sees, so the test reads the sim's log.
 *
 * @param seenLog - Receives the latest `playerView.log` after every decision.
 * @returns The policy.
 */
function createHeistFirstPolicy(seenLog: { lines: readonly string[] }): AIPolicy {
  return {
    name: 'heist-first',
    decideTurn(playerView: UIState, legalMoves: LegalMove[]): ClientTurnIntent {
      seenLog.lines = playerView.log.map((entry) => entry.text);
      const base = {
        matchId: 'simulation-heist-roundtrip',
        playerId: playerView.game.activePlayerId,
        turnNumber: playerView.game.turn,
      };
      const preferenceOrder = ['attemptHeist', 'playCard'];
      for (const preferred of preferenceOrder) {
        const match = legalMoves.find((move) => move.name === preferred);
        if (match !== undefined) {
          return { ...base, move: { name: match.name, args: match.args } };
        }
      }
      const fallback = legalMoves[0] ?? { name: 'endTurn', args: {} };
      return { ...base, move: { name: fallback.name, args: fallback.args } };
    },
  };
}

/**
 * Wraps captured moves in a validated fixture (the simulation.captureMoves.test.ts pattern).
 *
 * @param moves - The captured move list.
 * @param seed - The run seed.
 * @param setupConfig - The match setup.
 * @returns A fixture runFixture accepts.
 */
function buildFixture(moves: readonly ReplayMove[], seed: string, setupConfig: MatchSetupConfig): FixtureFile {
  const name = 'heist-capture-roundtrip';
  return validateFixture(
    {
      name,
      meta: { version: 1 as const, createdAt: '2026-11-10T00:00:00.000Z', engineVersion: 'd24831-test' },
      input: {
        seed,
        playerCount: 1,
        playerOrder: ['0'],
        setupConfig,
        moves: moves.map((move) => ({ playerId: move.playerId, moveName: move.moveName, args: move.args })),
      },
      expected: {
        finalStateHash: '0000000000000000000000000000000000000000000000000000000000000000',
        messages: [] as string[],
        snapshotPerTurn: [],
        outcome: { winner: null, counters: {} },
      },
    },
    name,
  );
}

describe('a bot Heist round-trips from a sim capture through runFixture (D-24831)', () => {
  test('the capture holds attemptHeist, and runFixture replays it to the same Heist log lines', () => {
    const setupConfig = buildHeistConfig();
    const registry = buildRealDataRegistry();
    const seed = 'd24831-heist-capture-roundtrip';
    const seenLog: { lines: readonly string[] } = { lines: [] };

    const captured = simulateOneGameAndCaptureMoves(
      setupConfig,
      registry,
      [createHeistFirstPolicy(seenLog)],
      seed,
      0,
      MAX_TURNS,
    );

    // why: non-vacuous — the bot really attempted a Heist, so the replay has one to dispatch.
    const heistMoveCount = captured.moves.filter((move) => move.moveName === 'attemptHeist').length;
    assert.ok(heistMoveCount > 0, 'the captured game must hold at least one attemptHeist');

    const replay = runFixture(buildFixture(captured.moves, seed, setupConfig), registry);

    const simHeistLines = seenLog.lines.filter((line) => HEIST_LINE_PATTERN.test(line));
    const replayHeistLines = replay.messages
      .map((entry) => entry.text)
      .filter((line) => HEIST_LINE_PATTERN.test(line));
    assert.ok(simHeistLines.length > 0, 'the sim log shows the Heist');
    // why: the policy sees the log BEFORE each decision, so a Heist on the very last move is not
    // in seenLog; every Heist the sim showed must lead the replay's list in the same order.
    assert.deepStrictEqual(
      replayHeistLines.slice(0, simHeistLines.length),
      simHeistLines,
      'runFixture replays the same Heists, in order, with the same counts and revealed cards',
    );
    assert.equal(replayHeistLines.length, heistMoveCount, 'one Heist line per captured attemptHeist');
  });
});
