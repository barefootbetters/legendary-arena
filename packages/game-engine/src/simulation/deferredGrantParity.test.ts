/**
 * Deferred conditional grant parity across the rebuilt turn loops (WP-744 / D-24567).
 *
 * The simulation runner and the replay-fixture runner rebuild the boardgame.io turn
 * cycle and never run `game.ts`'s `turn.onMove` / `turn.onBegin`. WP-744 mirrors the
 * deferred-grant lifecycle into both: `resolveDeferredHeroGrants` after every
 * dispatched move, and the `clearDeferredConditionalGrants` + WP-656 defeat-edge
 * clear at every turn start (`applyOnBeginParity`).
 *
 * This file drives one real-shaped mock-registry game through the sim with a
 * two-phase spy policy, then replays the captured moves through `runFixture`
 * (the WP-732 `simulation.captureMoves.test.ts` round-trip pattern). The sim exposes
 * no final `G`, so the sim side is observed through the policy's `playerView.log`
 * (the `G.messages` projection). One round-trip test carries all three assertions:
 *
 *   (a) deferred fire — the Diamond Form +3 lands after the Mastermind fight, not
 *       at the play (where the "is waiting" line appears instead);
 *   (b) cross-turn clear — a later-turn fight with no copy in play grants nothing
 *       (a stale entry would re-fire, since the fight sets the edge whenever the
 *       deferred list is non-empty);
 *   (c) fixture parity — the ordered waiting/grant lines of `runFixture` equal the
 *       sim's.
 *
 * `replay.execute.ts` is deliberately NOT compared (D-24322 exclusion).
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

// why: the locked WP-744 §F matching rules. The grant line is the recruit-grant
// pushLog in heroEffects.execute.ts; the waiting line is the wait-and-see deferral
// pushLog. Both are matched on LogEntry.text only.
const GRANT_LINE_PATTERN = /gained \+3 recruit from/;
const WAITING_LINE_PATTERN = /ability is waiting/;
const PARITY_LINE_PATTERN = /ability is waiting|gained \+3 recruit from/;

// why: the test hero's only card slug. Card ext ids embed the slug, so a substring
// test identifies a copy in hand / in play without hard-coding the id format.
const DEFERRED_CARD_SLUG = 'diamond-form';

/** One policy decision, recorded by the spy for the post-run assertions. */
interface DecisionRecord {
  readonly policyPhase: 1 | 2;
  readonly moveName: string;
  readonly cardId: string | null;
  readonly logTexts: readonly string[];
  readonly isCardInPlay: boolean;
}

/**
 * Builds a real-shaped CardRegistryReader for the deferred-grant round trip.
 *
 * The Mastermind base card has fightCost 0 (vAttack '0') and FOUR Tactics, so a
 * fightMastermind is always legal without depending on villain-deck order, and each
 * fight defeats one Tactic (a defeat that sets the WP-656 edge when a grant waits).
 * With Final Blow off (the default) the game needs four fights to end, so both
 * policy phases get a fight before the last Tactic.
 *
 * The one hero has a single cost-0, recruit-null card carrying the core Diamond Form
 * text and its WP-656 marker, so it can be recruited with no resources and its only
 * effect is the wait-and-see +3 Recruit.
 *
 * @returns A hand-built registry reader (engine tests never import the registry layer).
 */
function buildDeferredGrantRegistry(): CardRegistryReader {
  const setData = {
    abbr: 'core',
    villains: [
      {
        slug: 'spider-foes',
        cards: [
          { slug: 'green-goblin', copies: 2, vAttack: '5', abilities: [] },
        ],
      },
    ],
    henchmen: [{ slug: 'doombot-legion', vAttack: '3', abilities: [] }],
    masterminds: [
      {
        slug: 'doc-ock',
        cards: [
          { name: 'Doctor Octopus', slug: 'doc-ock-base', tactic: false, vAttack: '0', abilities: [] },
          { name: 'Tentacle Slam', slug: 'tentacle-slam', tactic: true, vAttack: '5', abilities: [] },
          { name: 'Arm Grab', slug: 'arm-grab', tactic: true, vAttack: '5', abilities: [] },
          { name: 'Steel Coil', slug: 'steel-coil', tactic: true, vAttack: '5', abilities: [] },
          { name: 'Iron Grip', slug: 'iron-grip', tactic: true, vAttack: '5', abilities: [] },
        ],
      },
    ],
    schemes: [{ slug: 'bank-job', cards: [{ abilities: [] }] }],
    heroes: [
      {
        slug: 'emma-frost',
        cards: [
          {
            slug: DEFERRED_CARD_SLUG,
            name: 'Diamond Form',
            rarityLabel: 'Common 1',
            attack: null,
            recruit: null,
            cost: 0,
            abilities: [
              'Whenever you defeat a Villain or Mastermind this turn, you get +3[icon:recruit]. [keyword:defeated-villain-or-mastermind]',
            ],
          },
        ],
        physicalCards: [{ id: 'p1', count: 14, sides: [DEFERRED_CARD_SLUG] }],
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
 * The single-seat match config the round trip builds from.
 *
 * @returns A 9-field MatchSetupConfig over the deferred-grant registry.
 */
function buildDeferredGrantConfig(): MatchSetupConfig {
  return {
    schemeId: 'core/bank-job',
    mastermindId: 'core/doc-ock',
    villainGroupIds: ['core/spider-foes'],
    henchmanGroupIds: ['core/doombot-legion'],
    heroDeckIds: ['core/emma-frost'],
    bystandersCount: 4,
    woundsCount: 8,
    officersCount: 6,
    sidekicksCount: 4,
  };
}

/**
 * Reports whether a card ext id is a copy of the test hero's deferred-grant card.
 *
 * @param cardId - A card ext id from a zone projection or a move arg.
 * @returns True when the id names the Diamond Form test card.
 */
function isDeferredCard(cardId: string): boolean {
  return cardId.includes(DEFERRED_CARD_SLUG);
}

/**
 * Reads the `cardId` argument of a legal move, when it has one.
 *
 * @param move - A legal move from getLegalMoves.
 * @returns The string cardId, or null when the move carries none.
 */
function readCardIdArg(move: LegalMove): string | null {
  const args = move.args;
  if (typeof args !== 'object' || args === null || !('cardId' in args)) {
    return null;
  }
  const cardId = (args as { cardId: unknown }).cardId;
  if (typeof cardId !== 'string') {
    return null;
  }
  return cardId;
}

/**
 * Counts the log lines matching a pattern.
 *
 * @param logTexts - The ordered log texts.
 * @param pattern - The locked line pattern.
 * @returns How many lines match.
 */
function countMatching(logTexts: readonly string[], pattern: RegExp): number {
  let matchCount = 0;
  for (const text of logTexts) {
    if (pattern.test(text)) {
      matchCount += 1;
    }
  }
  return matchCount;
}

/**
 * Picks Phase 1's move: reveal, at most one recruit, play every copy of the card,
 * at most one Mastermind fight and only while a copy is in play, then advance / end.
 *
 * @param legalMoves - The legal moves at this decision.
 * @param turnState - The per-turn recruit / fight allowances (mutated when used).
 * @param isCardInPlay - Whether a copy of the card is in the seat's inPlayCards.
 * @returns The chosen legal move, or null when none of the preferences applies.
 */
function choosePhaseOneMove(
  legalMoves: LegalMove[],
  turnState: { hasRecruited: boolean; hasFought: boolean },
  isCardInPlay: boolean,
): LegalMove | null {
  const reveal = legalMoves.find((move) => move.name === 'revealVillainCard');
  if (reveal !== undefined) {
    return reveal;
  }
  const recruit = legalMoves.find((move) => move.name === 'recruitHero');
  if (recruit !== undefined && !turnState.hasRecruited) {
    turnState.hasRecruited = true;
    return recruit;
  }
  const playDeferredCard = legalMoves.find((move) => {
    const cardId = readCardIdArg(move);
    return move.name === 'playCard' && cardId !== null && isDeferredCard(cardId);
  });
  if (playDeferredCard !== undefined) {
    return playDeferredCard;
  }
  const fight = legalMoves.find((move) => move.name === 'fightMastermind');
  if (fight !== undefined && !turnState.hasFought && isCardInPlay) {
    turnState.hasFought = true;
    return fight;
  }
  return null;
}

/**
 * Picks Phase 2's move: reveal, one Mastermind fight per turn whenever legal (never
 * playing the card), then advance / end.
 *
 * @param legalMoves - The legal moves at this decision.
 * @param turnState - The per-turn fight allowance (mutated when used).
 * @returns The chosen legal move, or null when none of the preferences applies.
 */
function choosePhaseTwoMove(
  legalMoves: LegalMove[],
  turnState: { hasRecruited: boolean; hasFought: boolean },
): LegalMove | null {
  const reveal = legalMoves.find((move) => move.name === 'revealVillainCard');
  if (reveal !== undefined) {
    return reveal;
  }
  const fight = legalMoves.find((move) => move.name === 'fightMastermind');
  if (fight !== undefined && !turnState.hasFought) {
    turnState.hasFought = true;
    return fight;
  }
  return null;
}

/**
 * Builds the deterministic two-phase spy policy.
 *
 * Phase 1 runs until a grant line is first observed; Phase 2 is every turn AFTER the
 * turn the grant appeared. Every decision (the log the policy saw, its chosen move and
 * whether a copy was in play) is pushed to `records`. No decisionLog is set, so the
 * sim's G.messages carries no policy lines.
 *
 * @param seed - The game seed, used only for the intent's matchId.
 * @param records - The sink the spy writes one DecisionRecord per decision into.
 * @returns The AIPolicy for seat 0.
 */
function createTwoPhaseSpyPolicy(seed: string, records: DecisionRecord[]): AIPolicy {
  let lastTurnSeen = -1;
  let grantTurn: number | null = null;
  const turnState = { hasRecruited: false, hasFought: false };

  return {
    name: `deferred-grant-two-phase-${seed}`,
    decideTurn(playerView: UIState, legalMoves: LegalMove[]): ClientTurnIntent {
      const turn = playerView.game.turn;
      if (turn !== lastTurnSeen) {
        lastTurnSeen = turn;
        turnState.hasRecruited = false;
        turnState.hasFought = false;
      }

      const logTexts: string[] = [];
      for (const entry of playerView.log) {
        logTexts.push(entry.text);
      }
      if (grantTurn === null && countMatching(logTexts, GRANT_LINE_PATTERN) > 0) {
        grantTurn = turn;
      }
      const policyPhase: 1 | 2 = grantTurn !== null && turn > grantTurn ? 2 : 1;

      const seat = playerView.players.find(
        (player) => player.playerId === playerView.game.activePlayerId,
      );
      const inPlayCards = seat?.inPlayCards ?? [];
      const isCardInPlay = inPlayCards.some((cardId) => isDeferredCard(cardId));

      let chosen: LegalMove | null = null;
      if (policyPhase === 1) {
        chosen = choosePhaseOneMove(legalMoves, turnState, isCardInPlay);
      } else {
        chosen = choosePhaseTwoMove(legalMoves, turnState);
      }
      if (chosen === null) {
        chosen =
          legalMoves.find((move) => move.name === 'advanceStage') ??
          legalMoves.find((move) => move.name === 'endTurn') ??
          legalMoves[0] ??
          { name: 'endTurn', args: {} };
      }

      records.push({
        policyPhase,
        moveName: chosen.name,
        cardId: readCardIdArg(chosen),
        logTexts,
        isCardInPlay,
      });

      return {
        matchId: `simulation-${seed}`,
        playerId: playerView.game.activePlayerId,
        turnNumber: turn,
        move: { name: chosen.name, args: chosen.args },
      };
    },
  };
}

/**
 * Assembles a FixtureFile from a captured ReplayMove[] so the captured trace can be
 * replayed through runFixture. Duplicated from `simulation.captureMoves.test.ts`
 * (duplicate-first); the `expected` block is a placeholder because runFixture
 * produces the oracle rather than comparing against it.
 *
 * @param capturedMoves - The sim-captured moves.
 * @param seed - The game seed (runFixture re-seeds from it).
 * @param setupConfig - The match config.
 * @param fixtureName - The fixture name (must equal the validate basename).
 * @returns A validated single-seat FixtureFile.
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
      createdAt: '2026-09-22T00:00:00.000Z',
      engineVersion: 'wp744-test',
    },
    input: {
      seed,
      playerCount: 1,
      playerOrder: ['0'],
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

/**
 * Returns the index of the first record satisfying a predicate, failing loudly when
 * none does (a vacuous pass is a bug).
 *
 * @param records - The spy's decision records.
 * @param predicate - The record test.
 * @param description - Full-sentence failure message naming the missing precondition.
 * @returns The index of the first matching record.
 */
function findRequiredIndex(
  records: readonly DecisionRecord[],
  predicate: (record: DecisionRecord) => boolean,
  description: string,
): number {
  const index = records.findIndex(predicate);
  assert.notEqual(index, -1, description);
  return index;
}

describe('deferred conditional grant parity — sim and runFixture (WP-744 / D-24567)', () => {
  test('a waiting Diamond Form grants after the fight, not at play; clears at the turn boundary; and runFixture replays the same lines', () => {
    const setupConfig = buildDeferredGrantConfig();
    const registry = buildDeferredGrantRegistry();
    const seed = 'wp744-deferred-grant-parity-seed';
    const records: DecisionRecord[] = [];
    const policies: AIPolicy[] = [createTwoPhaseSpyPolicy(seed, records)];

    const captured = simulateOneGameAndCaptureMoves(setupConfig, registry, policies, seed, 0);

    // Precondition (i): the card was actually played (else nothing was ever deferred).
    const playIndex = findRequiredIndex(
      records,
      (record) => record.moveName === 'playCard' && record.cardId !== null && isDeferredCard(record.cardId),
      'Precondition (i) failed: the policy never played the Diamond Form test card, so no grant was ever deferred; choose a seed that brings a copy to hand.',
    );
    const afterPlay = records[playIndex + 1];
    assert.ok(afterPlay, 'The sim must make at least one decision after the Diamond Form play.');

    // (a) Deferred fire — at the play the waiting line appears and no grant does.
    assert.equal(
      countMatching(afterPlay.logTexts, WAITING_LINE_PATTERN) >
        countMatching(records[playIndex]!.logTexts, WAITING_LINE_PATTERN),
      true,
      'Playing Diamond Form with no defeat yet this turn must log the "ability is waiting" line.',
    );
    assert.equal(
      countMatching(afterPlay.logTexts, GRANT_LINE_PATTERN),
      0,
      'Diamond Form must NOT grant at play — its condition (a defeat this turn) is not yet met.',
    );

    const phaseOneFightIndex = findRequiredIndex(
      records,
      (record) => record.policyPhase === 1 && record.moveName === 'fightMastermind',
      'Phase 1 never fought the Mastermind while a copy of Diamond Form was in play.',
    );
    assert.equal(
      countMatching(records[phaseOneFightIndex]!.logTexts, GRANT_LINE_PATTERN),
      0,
      'No grant line may exist before the first Phase-1 Mastermind fight.',
    );
    const afterFight = records[phaseOneFightIndex + 1];
    assert.ok(afterFight, 'The sim must make at least one decision after the Phase-1 fight.');
    assert.equal(
      countMatching(afterFight.logTexts, GRANT_LINE_PATTERN) > 0,
      true,
      'The deferred +3 Recruit must fire after the Mastermind fight (the per-move resolveDeferredHeroGrants mirror).',
    );

    // Precondition (ii): a Phase-2 fight with no copy in play (else (b) proves nothing).
    const phaseTwoFightIndex = findRequiredIndex(
      records,
      (record) => record.policyPhase === 2 && record.moveName === 'fightMastermind' && !record.isCardInPlay,
      'Precondition (ii) failed: no Phase-2 Mastermind fight was dispatched with no Diamond Form in play; the game ended too early for the cross-turn clear to be observed.',
    );
    const afterPhaseTwoFight = records[phaseTwoFightIndex + 1];
    assert.ok(afterPhaseTwoFight, 'The sim must make at least one decision after the Phase-2 fight.');

    // (b) Cross-turn clear — a later-turn fight with no copy in play grants nothing.
    assert.equal(
      countMatching(afterPhaseTwoFight.logTexts, GRANT_LINE_PATTERN),
      countMatching(records[phaseTwoFightIndex]!.logTexts, GRANT_LINE_PATTERN),
      'A Phase-2 fight with no Diamond Form in play must add no grant line — a deferred entry surviving the turn boundary would re-fire here.',
    );

    // (c) Fixture parity — runFixture replays the same ordered waiting / grant lines.
    const fixture = buildFixtureFromCapture(captured.moves, seed, setupConfig, 'wp744-deferred-grant-parity');
    const replay = runFixture(fixture, registry);
    const fixtureLines: string[] = [];
    for (const entry of replay.messages) {
      if (PARITY_LINE_PATTERN.test(entry.text)) {
        fixtureLines.push(entry.text);
      }
    }
    const lastRecord = records[records.length - 1]!;
    const simLines: string[] = [];
    for (const text of lastRecord.logTexts) {
      if (PARITY_LINE_PATTERN.test(text)) {
        simLines.push(text);
      }
    }
    assert.deepEqual(
      fixtureLines,
      simLines,
      'runFixture must replay the sim-captured moves to the same ordered waiting / grant lines (the D-24273 capture -> replay lockstep).',
    );
  });
});
