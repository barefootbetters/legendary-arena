/**
 * Tests for the endgame-coach match-summary assembler (WP-594 / EC-629).
 *
 * Pure function; no database, no model call. Verifies the acquired-card
 * derivation (starters + Wounds netted out), loadout name resolution, adversity,
 * outcome from matchLost, and the WP-591 expected-adversity block.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCoachMatchSummary } from './coachSummary.logic.js';
import type { LegendaryGameState, ScoreBreakdown } from '@legendary-arena/game-engine';

// why: the assembler reads only matchConfiguration + playerZones off the state,
// so a minimal cast is sufficient (no full game state needed).
function makeState(
  playerZones: Record<
    string,
    { deck: string[]; hand: string[]; discard: string[]; inPlay: string[]; victory: string[] }
  >,
): LegendaryGameState {
  return {
    matchConfiguration: {
      schemeId: 'core/scheme/midtown-bank-robbery',
      mastermindId: 'core/mastermind/red-skull',
      villainGroupIds: ['core/villain/hydra'],
      henchmanGroupIds: ['core/henchman/hand-ninjas'],
      heroDeckIds: ['core/hero/spider-man', 'core/hero/rogue'],
      bystandersCount: 12,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    },
    playerZones,
  } as unknown as LegendaryGameState;
}

function makeBreakdown(over: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    inputs: {
      rounds: 12,
      victoryPoints: 40,
      bystandersRescued: 5,
      escapes: 1,
      penaltyEventCounts: {
        villainEscaped: 1,
        bystanderLost: 2,
        schemeTwistNegative: 6,
        mastermindTacticUntaken: 0,
        scenarioSpecificPenalty: 0,
      },
      perPlayer: [{ playerId: '0', victoryPoints: 40, bystandersRescued: 5 }],
      matchLost: false,
    },
    weightedPenaltyTotal: 1800,
    penaltyBreakdown: {
      villainEscaped: 100,
      bystanderLost: 400,
      schemeTwistNegative: 1800,
      mastermindTacticUntaken: 0,
      scenarioSpecificPenalty: 0,
    },
    weightedBystanderReward: 1000,
    weightedVictoryPointReward: 400,
    rawScore: 400,
    parScore: -300,
    finalScore: 700,
    scoringConfigVersion: 4,
    ...over,
  } as ScoreBreakdown;
}

// A readable name resolver: strips the path and title-cases the slug tail.
function resolveName(extId: string): string {
  const tail = extId.split('/').pop() ?? extId;
  return tail
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

describe('buildCoachMatchSummary (WP-594)', () => {
  test('derives acquired cards: nets out the starting deck and Wounds', () => {
    // Player 0 ends with the 12 starters (8 agents + 4 troopers), a Wound, and
    // acquired hero cards spread across zones.
    const starters = [
      ...Array(8).fill('starting-shield-agent'),
      ...Array(4).fill('starting-shield-trooper'),
    ];
    const state = makeState({
      '0': {
        deck: [...starters.slice(0, 6), 'core/hero/rogue', 'pile-wound'],
        hand: [...starters.slice(6, 9), 'core/hero/spider-man'],
        discard: [...starters.slice(9), 'core/hero/spider-man'],
        inPlay: ['core/hero/gambit'],
        // why: victory holds KO'd enemies + rescued bystanders — must be excluded.
        victory: ['core/villain/hydra-agent', 'core/bystander/hostage'],
      },
    });
    const summary = buildCoachMatchSummary(state, makeBreakdown(), 'heroes-win', resolveName);
    const line = summary.perPlayer[0];
    assert.ok(line);
    // acquired = 2× Spider Man, 1× Rogue, 1× Gambit; starters + wound + victory excluded.
    assert.deepEqual(line.acquiredCards, ['Spider Man ×2', 'Gambit', 'Rogue']);
  });

  test('resolves the loadout to display names and carries the caller-supplied outcome (incl. tie)', () => {
    const state = makeState({
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    });
    const won = buildCoachMatchSummary(state, makeBreakdown(), 'heroes-win', resolveName);
    assert.equal(won.outcome, 'heroes-win');
    assert.equal(won.scheme, 'Midtown Bank Robbery');
    assert.equal(won.mastermind, 'Red Skull');
    assert.deepEqual(won.heroes, ['Spider Man', 'Rogue']);
    assert.deepEqual(won.villainGroups, ['Hydra']);

    const lost = buildCoachMatchSummary(state, makeBreakdown(), 'scheme-wins', resolveName);
    assert.equal(lost.outcome, 'scheme-wins');

    // why: a tie (a deck ran out with no winner) is carried through, no longer
    // mislabeled as a heroes-win.
    const tied = buildCoachMatchSummary(state, makeBreakdown(), 'tie', resolveName);
    assert.equal(tied.outcome, 'tie');
  });

  test('carries actual adversity always and expected adversity only with a WP-591 baseline', () => {
    const state = makeState({
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    });
    const noBaseline = buildCoachMatchSummary(state, makeBreakdown(), 'heroes-win', resolveName);
    assert.deepEqual(noBaseline.adversity, {
      schemeTwists: 6,
      villainsEscaped: 1,
      bystandersLost: 2,
    });
    assert.equal(noBaseline.adversityExpected, undefined);

    const withBaseline = buildCoachMatchSummary(
      state,
      makeBreakdown({
        parBaseline: {
          bystandersPar: 6,
          victoryPointsPar: 40,
          escapesPar: 1,
          schemeTwistsPar: 3,
          bystandersLostPar: 2,
        },
      }),
      'heroes-win',
      resolveName,
    );
    assert.deepEqual(withBaseline.adversityExpected, {
      schemeTwists: 3,
      villainsEscaped: 1,
      bystandersLost: 2,
    });
  });
});
