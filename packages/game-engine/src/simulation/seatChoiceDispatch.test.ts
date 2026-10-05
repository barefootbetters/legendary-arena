/**
 * Non-active seat-choice dispatch across the rebuilt turn loops (WP-749 / D-24573).
 *
 * The simulation runner only ever drives the current player. When a WP-684 seat choice
 * is addressed to a DIFFERENT seat — here core Loki's Vanishing Illusions ("each other
 * player must KO a Villain from their Victory Pile") — the active seat is blocked, and
 * before WP-749 its policy fell back to endTurn outside cleanup and the game was
 * recorded stuck. WP-749 dispatches, for the first outstanding addressed seat, the single
 * deterministic-default resolveSeatChoice that getLegalMoves already offers it.
 *
 * This file drives one two-seat mock-registry game through the sim with strict-priority
 * policies, then replays the captured moves through runFixture (the WP-732
 * `simulation.captureMoves.test.ts` / WP-744 `deferredGrantParity.test.ts` round-trip
 * pattern). The sim exposes no final `G`, so the sim side is observed through the
 * policies' `playerView.log` (the `G.messages` projection). One round-trip test carries
 * the three locked assertions:
 *
 *   (a) the captured moves contain seat 1's resolveSeatChoice, after seat 0's
 *       fightMastermind and before seat 0's next endTurn;
 *   (b) the game terminates heroes-win and the Vanishing Illusions KO line appears
 *       after the fight;
 *   (c) runFixture replays the capture without throwing and reproduces the KO line.
 *
 * No boardgame.io imports. No @legendary-arena/registry imports. No `Math.random()`.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

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

// why: the locked WP-749 §E lines. The fight-effect lines are the two
// resolveVanishingIllusions pushLogs (rules/tacticHandlers.ts); the KO line is the
// per-seat applyVanishingIllusionsKo pushLog (moves/seatChoiceTactics.ts). All are
// matched as substrings of LogEntry.text, which carries a turn.stage.sequence prefix.
const FIGHT_EFFECT_LINE =
  'Fight effect: each other player must KO a Villain from their Victory Pile (Vanishing Illusions).';
const NO_VILLAIN_LINE =
  'no other player had a Villain in their Victory Pile to KO';
const KO_LINE_PATTERN = /KO'd .+ from their Victory Pile \(Vanishing Illusions\)\./;

// why: the locked literal seed. Villain-reveal order is seed-dependent (the single
// Tactic removes tactic-order dependence, nothing removes reveal order), so the seed is
// fixed and the precondition below fails loudly if a future setup change stops this
// seed from bringing a Villain into seat 1's reach before seat 0 fights.
const LOCKED_SEED = 'wp749-seat-choice-dispatch-seed';

/** One policy decision, recorded for the post-run assertions. */
interface DecisionRecord {
  readonly seat: string;
  readonly moveName: string;
  readonly logTexts: readonly string[];
}

/**
 * Builds a real-shaped CardRegistryReader whose Mastermind is core Loki with a single
 * Vanishing Illusions Tactic.
 *
 * Local copy of `simulation.captureMoves.test.ts`'s non-exported `buildWinnableRegistry`,
 * modified per the WP-749 §E recipe: the Mastermind is `loki` in set `core` with a
 * fightCost-0 base card and ONE Tactic slugged `vanishing-illusions`, so the defeated
 * Tactic's ext id is `core-mastermind-loki-vanishing-illusions` (the id the tactic handler
 * keys on) and one fight both triggers the effect and vanquishes Loki. The single Villain
 * group has ten `vAttack '0'` copies (only `-villain-` ids qualify for the KO), so a seat
 * that plays no cards can still fight one; the Henchmen are `vAttack '9'`, so they are
 * never an affordable fight target.
 *
 * @returns A hand-built registry reader (engine tests never import the registry layer).
 */
function buildLokiRegistry(): CardRegistryReader {
  const setData = {
    abbr: 'core',
    villains: [
      {
        slug: 'enemies-of-asgard',
        cards: [
          { slug: 'frost-giant', copies: 10, vAttack: '0', abilities: [] },
        ],
      },
    ],
    henchmen: [{ slug: 'doombot-legion', vAttack: '9', abilities: [] }],
    masterminds: [
      {
        slug: 'loki',
        cards: [
          { name: 'Loki', slug: 'loki', tactic: false, vAttack: '0', abilities: [] },
          { name: 'Vanishing Illusions', slug: 'vanishing-illusions', tactic: true, vAttack: '0', abilities: [] },
        ],
      },
    ],
    schemes: [{ slug: 'bank-job', cards: [{ abilities: [] }] }],
    heroes: [
      {
        slug: 'spider-man',
        cards: [
          { slug: 'web-strike', name: 'Web Strike', rarityLabel: 'Common 1', attack: '2', recruit: null, cost: 0, abilities: [] },
          { slug: 'spider-sense', name: 'Spider Sense', rarityLabel: 'Common 2', attack: null, recruit: '2', cost: 3, abilities: [] },
          { slug: 'wall-crawl', name: 'Wall Crawl', rarityLabel: 'Uncommon', attack: '1', recruit: '1', cost: 4, abilities: [] },
          { slug: 'the-amazing', name: 'The Amazing Spider-Man', rarityLabel: 'Rare', attack: '4', recruit: null, cost: 6, abilities: [] },
        ],
        physicalCards: [
          { id: 'p1', count: 5, sides: ['web-strike'] },
          { id: 'p2', count: 3, sides: ['spider-sense'] },
          { id: 'p3', count: 3, sides: ['wall-crawl'] },
          { id: 'p4', count: 3, sides: ['the-amazing'] },
        ],
      },
    ],
    bystanders: [],
    wounds: [],
    other: [],
  };

  return {
    listCards: () => [],
    listSets: () => [{ abbr: 'core' }],
    getSet: (abbr: string) => (abbr === 'core' ? setData : undefined),
  } as unknown as CardRegistryReader;
}

/**
 * The two-seat match config the round trip builds from.
 *
 * `bystandersCount: 4` follows the captureMoves / deferredGrantParity precedent; it sizes
 * only the supply pile (villain-deck Bystanders come from the scheme / player-count
 * table), and the sim path never runs the D-24032 supply-floor validator.
 *
 * @returns A 9-field MatchSetupConfig over the Loki registry.
 */
function buildLokiConfig(): MatchSetupConfig {
  return {
    schemeId: 'core/bank-job',
    mastermindId: 'core/loki',
    villainGroupIds: ['core/enemies-of-asgard'],
    henchmanGroupIds: ['core/doombot-legion'],
    heroDeckIds: ['core/spider-man'],
    bystandersCount: 4,
    woundsCount: 8,
    officersCount: 6,
    sidekicksCount: 4,
  };
}

/**
 * Returns the first legal move with the given name, or undefined when none is offered.
 *
 * @param legalMoves - The legal moves at this decision.
 * @param moveName - The move name to look for.
 * @returns The first matching legal move, if any.
 */
function findMove(legalMoves: readonly LegalMove[], moveName: string): LegalMove | undefined {
  return legalMoves.find((move) => move.name === moveName);
}

/**
 * Builds one seat's strict-priority policy.
 *
 * Seat 1 (the fighter of Villains): reveal → first fightVillain (raising the shared flag
 * once a Villain sits in its Victory Pile) → advance → end. Seat 0 (the fighter of Loki):
 * reveal → fightMastermind only once the flag is raised → advance → end. Seat 0 waiting
 * for the flag is what guarantees seat 1 holds a Victory-Pile Villain, so the Vanishing
 * Illusions choice is actually addressed to seat 1 when Loki falls. Every decision is
 * pushed to `records` with the log the policy observed. No decisionLog is set, so the
 * sim's G.messages carries no policy lines.
 *
 * @param seat - The seat this policy drives ('0' or '1').
 * @param sharedState - The cross-seat flag seat 1 raises and seat 0 reads.
 * @param records - The sink each decision is recorded into.
 * @returns The AIPolicy for the seat.
 */
function createStrictPriorityPolicy(
  seat: string,
  sharedState: { hasSeatOneFoughtVillain: boolean },
  records: DecisionRecord[],
): AIPolicy {
  return {
    name: `wp749-strict-priority-seat-${seat}`,
    decideTurn(playerView: UIState, legalMoves: LegalMove[]): ClientTurnIntent {
      let chosen: LegalMove | undefined = findMove(legalMoves, 'revealVillainCard');
      if (chosen === undefined && seat === '1') {
        chosen = findMove(legalMoves, 'fightVillain');
        if (chosen !== undefined) {
          sharedState.hasSeatOneFoughtVillain = true;
        }
      }
      if (chosen === undefined && seat === '0' && sharedState.hasSeatOneFoughtVillain) {
        chosen = findMove(legalMoves, 'fightMastermind');
      }
      if (chosen === undefined) {
        chosen =
          findMove(legalMoves, 'advanceStage') ??
          findMove(legalMoves, 'endTurn') ??
          { name: 'endTurn', args: {} };
      }

      const logTexts: string[] = [];
      for (const entry of playerView.log) {
        logTexts.push(entry.text);
      }
      records.push({ seat, moveName: chosen.name, logTexts });

      return {
        matchId: `simulation-${LOCKED_SEED}`,
        playerId: playerView.game.activePlayerId,
        turnNumber: playerView.game.turn,
        move: { name: chosen.name, args: chosen.args },
      };
    },
  };
}

/**
 * Assembles a FixtureFile from a captured ReplayMove[] so the captured trace can be
 * replayed through runFixture. Duplicated from `simulation.captureMoves.test.ts`
 * (duplicate-first); the `expected` block is a placeholder because runFixture produces
 * the oracle rather than comparing against it.
 *
 * @param capturedMoves - The sim-captured moves.
 * @param seed - The game seed (runFixture re-seeds from it).
 * @param setupConfig - The match config.
 * @param fixtureName - The fixture name (must equal the validate basename).
 * @returns A validated two-seat FixtureFile.
 */
function buildFixtureFromCapture(
  capturedMoves: readonly ReplayMove[],
  seed: string,
  setupConfig: MatchSetupConfig,
  fixtureName: string,
): FixtureFile {
  const skeleton = {
    name: fixtureName,
    meta: {
      version: 1 as const,
      createdAt: '2026-10-05T00:00:00.000Z',
      engineVersion: 'wp749-test',
    },
    input: {
      seed,
      playerCount: 2,
      playerOrder: ['0', '1'],
      setupConfig,
      moves: capturedMoves.map((move) => ({
        playerId: move.playerId,
        moveName: move.moveName,
        args: move.args,
      })),
    },
    expected: {
      finalStateHash:
        '0000000000000000000000000000000000000000000000000000000000000000',
      messages: [] as string[],
      snapshotPerTurn: [],
      outcome: {
        winner: null,
        counters: {},
      },
    },
  };
  return validateFixture(skeleton, fixtureName);
}

describe('non-active seat-choice dispatch — sim and runFixture (WP-749 / D-24573)', () => {
  test('a Vanishing Illusions KO addressed to seat 1 is resolved by seat 1, the game ends heroes-win, and runFixture replays it', () => {
    const setupConfig = buildLokiConfig();
    const registry = buildLokiRegistry();
    const sharedState = { hasSeatOneFoughtVillain: false };
    const records: DecisionRecord[] = [];
    const policies: AIPolicy[] = [
      createStrictPriorityPolicy('0', sharedState, records),
      createStrictPriorityPolicy('1', sharedState, records),
    ];

    const captured = simulateOneGameAndCaptureMoves(setupConfig, registry, policies, LOCKED_SEED, 0);

    // Loud precondition: the choice was actually parked for another seat. Without it the
    // test would pass vacuously (no seat held a Victory-Pile Villain, nothing was parked).
    const lastRecord = records[records.length - 1];
    assert.ok(lastRecord, 'The sim must make at least one policy decision.');
    const fightEffectLineIndex = lastRecord.logTexts.findIndex((text) => text.includes(FIGHT_EFFECT_LINE));
    assert.notEqual(
      fightEffectLineIndex,
      -1,
      'Precondition failed: the policies never observed the Vanishing Illusions fight-effect line, so no seat choice was parked for another seat; the locked seed no longer brings a Villain into seat 1\'s Victory Pile before seat 0 fights Loki.',
    );
    assert.equal(
      lastRecord.logTexts.some((text) => text.includes(NO_VILLAIN_LINE)),
      false,
      'Precondition failed: Vanishing Illusions found no Villain in another player\'s Victory Pile, so the choice was never addressed to seat 1.',
    );

    // (a) Seat 1's resolveSeatChoice is captured between seat 0's fight and its next endTurn.
    const fightIndex = captured.moves.findIndex(
      (move) => move.playerId === '0' && move.moveName === 'fightMastermind',
    );
    assert.notEqual(fightIndex, -1, 'The captured moves must contain seat 0\'s fightMastermind.');
    const resolveIndex = captured.moves.findIndex(
      (move, index) => index > fightIndex && move.moveName === 'resolveSeatChoice',
    );
    assert.notEqual(
      resolveIndex,
      -1,
      'The captured moves must contain a resolveSeatChoice after seat 0\'s fightMastermind — the non-active seat-choice dispatch.',
    );
    assert.equal(
      captured.moves[resolveIndex]!.playerId,
      '1',
      'The captured resolveSeatChoice must carry the addressed seat\'s playerId (\'1\'), not the active seat\'s.',
    );
    const nextEndTurnIndex = captured.moves.findIndex(
      (move, index) => index > fightIndex && move.playerId === '0' && move.moveName === 'endTurn',
    );
    assert.notEqual(nextEndTurnIndex, -1, 'Seat 0 must end the turn in which it fought Loki.');
    assert.equal(
      resolveIndex < nextEndTurnIndex,
      true,
      'Seat 1 must resolve the choice before seat 0\'s next endTurn — the outstanding seat acts before the blocked active seat.',
    );

    // (b) The game ends heroes-win and the KO line follows the fight.
    assert.equal(
      captured.endgameReached,
      true,
      'The sim must terminate the game rather than flag it stuck — seat 0 is no longer frozen by seat 1\'s open choice.',
    );
    assert.equal(
      captured.outcome.winner,
      'heroes-win',
      'Defeating Loki\'s single Tactic must end the game as heroes-win once the choice resolves.',
    );
    const koLineIndex = lastRecord.logTexts.findIndex((text) => KO_LINE_PATTERN.test(text));
    assert.notEqual(koLineIndex, -1, 'The Vanishing Illusions KO line must appear in the observed log.');
    assert.equal(
      koLineIndex > fightEffectLineIndex,
      true,
      'The Vanishing Illusions KO line must appear after the fight-effect line.',
    );

    // (c) runFixture replays the capture, including seat 1's move, and reproduces the KO line.
    const fixture = buildFixtureFromCapture(captured.moves, LOCKED_SEED, setupConfig, 'wp749-seat-choice-dispatch');
    const replay = runFixture(fixture, registry);
    const fixtureKoLines: string[] = [];
    for (const entry of replay.messages) {
      if (KO_LINE_PATTERN.test(entry.text)) {
        fixtureKoLines.push(entry.text);
      }
    }
    assert.deepEqual(
      fixtureKoLines,
      [lastRecord.logTexts[koLineIndex]!],
      'runFixture must replay seat 1\'s captured resolveSeatChoice and reproduce the same Vanishing Illusions KO line (the D-24273 capture -> replay lockstep).',
    );
  });
});
