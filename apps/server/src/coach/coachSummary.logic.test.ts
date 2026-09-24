/**
 * Tests for the endgame-coach match-summary assembler (WP-594 / EC-629).
 *
 * Pure function; no database, no model call. Verifies the acquired-card
 * derivation (starters + Wounds netted out), loadout name resolution, adversity,
 * outcome from matchLost, and the WP-591 expected-adversity block. WP-751 adds the
 * casual (unscored) builder, which omits every score field.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCasualCoachMatchSummary, buildCoachMatchSummary } from './coachSummary.logic.js';
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
  // why: D-24579 — INTENTIONAL behavior change. Zone ids are per-copy
  // (`set/hero/card#N`), which the registry resolver does not map; the summary now
  // names cards from the match's cardDisplayData, groups copies by name, and appends
  // the hero. The ids here are the real production shape.
  test('derives acquired cards: nets out starters and Wounds, groups copies, names the hero', () => {
    // Player 0 ends with the 12 starters (8 agents + 4 troopers), a Wound, and
    // acquired cards spread across zones: two copies of one hero card, one of
    // another, and a S.H.I.E.L.D. Officer (not a hero card, so no hero name).
    const starters = [
      ...Array(8).fill('starting-shield-agent'),
      ...Array(4).fill('starting-shield-trooper'),
    ];
    const state = {
      ...makeState({
        '0': {
          deck: [...starters.slice(0, 6), 'core/spider-man/astonishing-strength#0', 'pile-wound'],
          hand: [...starters.slice(6, 9), 'core/spider-man/astonishing-strength#1'],
          discard: [...starters.slice(9), 'core/rogue/borrowed-brawn#0'],
          inPlay: ['pile-shield-officer'],
          // why: victory holds KO'd enemies + rescued bystanders — must be excluded.
          victory: ['core/villain/hydra-agent', 'core/bystander/hostage'],
        },
      }),
      cardDisplayData: {
        'core/spider-man/astonishing-strength#0': { name: 'Astonishing Strength' },
        'core/spider-man/astonishing-strength#1': { name: 'Astonishing Strength' },
        'core/rogue/borrowed-brawn#0': { name: 'Borrowed Brawn' },
        'pile-shield-officer': { name: 'S.H.I.E.L.D. Officer' },
      },
    } as unknown as LegendaryGameState;
    const summary = buildCoachMatchSummary(state, makeBreakdown(), 'heroes-win', resolveName, []);
    const line = summary.perPlayer[0];
    assert.ok(line);
    // Hero names come from the registry resolver on `set/hero` (resolveName
    // title-cases the slug); starters, the Wound and the victory pile are excluded.
    assert.deepEqual(line.acquiredCards, [
      'Astonishing Strength ×2 (Spider Man)',
      'Borrowed Brawn (Rogue)',
      'S.H.I.E.L.D. Officer',
    ]);
  });

  test('falls back to the registry resolver for a card missing from cardDisplayData', () => {
    const state = makeState({
      '0': { deck: ['core/gambit/card-shark#0'], hand: [], discard: [], inPlay: [], victory: [] },
    });
    const summary = buildCoachMatchSummary(state, makeBreakdown(), 'heroes-win', resolveName, []);
    assert.deepEqual(summary.perPlayer[0]?.acquiredCards, ['Card Shark#0 (Gambit)']);
  });

  test('carries each seat\'s WP-616 defeat counts into the coach line', () => {
    const emptyZone = { deck: [], hand: [], discard: [], inPlay: [], victory: [] };
    const state = makeState({ '0': { ...emptyZone }, '1': { ...emptyZone } });
    const breakdown = makeBreakdown({
      inputs: {
        rounds: 12,
        victoryPoints: 56,
        bystandersRescued: 17,
        escapes: 2,
        penaltyEventCounts: {
          villainEscaped: 2,
          bystanderLost: 2,
          schemeTwistNegative: 5,
          mastermindTacticUntaken: 0,
          scenarioSpecificPenalty: 0,
        },
        perPlayer: [
          {
            playerId: '0',
            victoryPoints: 36,
            bystandersRescued: 13,
            villainsDefeated: 3,
            henchmenDefeated: 1,
            mastermindTacticsDefeated: 2,
          },
          {
            playerId: '1',
            victoryPoints: 20,
            bystandersRescued: 4,
            villainsDefeated: 2,
            henchmenDefeated: 1,
            mastermindTacticsDefeated: 2,
          },
        ],
        matchLost: false,
      },
    } as unknown as Partial<ScoreBreakdown>);
    const summary = buildCoachMatchSummary(state, breakdown, 'heroes-win', resolveName, []);
    assert.equal(summary.perPlayer[0]?.villainsDefeated, 3);
    assert.equal(summary.perPlayer[0]?.henchmenDefeated, 1);
    assert.equal(summary.perPlayer[0]?.mastermindTacticsDefeated, 2);
    assert.equal(summary.perPlayer[1]?.villainsDefeated, 2);
    assert.equal(summary.perPlayer[1]?.mastermindTacticsDefeated, 2);
  });

  test('carries each seat\'s WP-708 synergy tally into the coach line (default 0 when absent)', () => {
    const emptyZone = { deck: [], hand: [], discard: [], inPlay: [], victory: [] };
    const state = makeState({ '0': { ...emptyZone }, '1': { ...emptyZone } });
    const breakdown = makeBreakdown({
      inputs: {
        rounds: 12,
        victoryPoints: 56,
        bystandersRescued: 17,
        escapes: 0,
        penaltyEventCounts: {
          villainEscaped: 0,
          bystanderLost: 0,
          schemeTwistNegative: 0,
          mastermindTacticUntaken: 0,
          scenarioSpecificPenalty: 0,
        },
        perPlayer: [
          { playerId: '0', victoryPoints: 36, bystandersRescued: 13, conditionalClausesPlayed: 8, conditionalClausesAssembled: 6, conditionalClausesPotentialValue: 22, conditionalClausesRealizedValue: 15 },
          // why: seat 1 carries NO synergy counts (a pre-WP-708/709 record) → the coach
          // line must default all of them to 0, not undefined.
          { playerId: '1', victoryPoints: 20, bystandersRescued: 4 },
        ],
        matchLost: false,
      },
    } as unknown as Partial<ScoreBreakdown>);
    const summary = buildCoachMatchSummary(state, breakdown, 'heroes-win', resolveName, []);
    assert.equal(summary.perPlayer[0]?.conditionalClausesPlayed, 8);
    assert.equal(summary.perPlayer[0]?.conditionalClausesAssembled, 6);
    assert.equal(summary.perPlayer[1]?.conditionalClausesPlayed, 0);
    assert.equal(summary.perPlayer[1]?.conditionalClausesAssembled, 0);
    // why: WP-709 — the Realized Value % inputs carry through the coach line too, and
    // default 0 for a seat with no value sums.
    assert.equal(summary.perPlayer[0]?.conditionalClausesPotentialValue, 22);
    assert.equal(summary.perPlayer[0]?.conditionalClausesRealizedValue, 15);
    assert.equal(summary.perPlayer[1]?.conditionalClausesPotentialValue, 0);
    assert.equal(summary.perPlayer[1]?.conditionalClausesRealizedValue, 0);
  });

  test('defaults the defeat counts to 0 for a record predating WP-616', () => {
    const state = makeState({
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    });
    // The default makeBreakdown() perPlayer carries no WP-616 defeat counts.
    const summary = buildCoachMatchSummary(state, makeBreakdown(), 'heroes-win', resolveName, []);
    assert.equal(summary.perPlayer[0]?.villainsDefeated, 0);
    assert.equal(summary.perPlayer[0]?.henchmenDefeated, 0);
    assert.equal(summary.perPlayer[0]?.mastermindTacticsDefeated, 0);
  });

  test('resolves the loadout to display names and carries the caller-supplied outcome (incl. tie)', () => {
    const state = makeState({
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    });
    const won = buildCoachMatchSummary(state, makeBreakdown(), 'heroes-win', resolveName, []);
    assert.equal(won.outcome, 'heroes-win');
    assert.equal(won.scheme, 'Midtown Bank Robbery');
    assert.equal(won.mastermind, 'Red Skull');
    assert.deepEqual(won.heroes, ['Spider Man', 'Rogue']);
    assert.deepEqual(won.villainGroups, ['Hydra']);

    const lost = buildCoachMatchSummary(state, makeBreakdown(), 'scheme-wins', resolveName, []);
    assert.equal(lost.outcome, 'scheme-wins');

    // why: a tie (a deck ran out with no winner) is carried through, no longer
    // mislabeled as a heroes-win.
    const tied = buildCoachMatchSummary(state, makeBreakdown(), 'tie', resolveName, []);
    assert.equal(tied.outcome, 'tie');
  });

  test('carries actual adversity always and expected adversity only with a WP-591 baseline', () => {
    const state = makeState({
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    });
    const noBaseline = buildCoachMatchSummary(state, makeBreakdown(), 'heroes-win', resolveName, []);
    assert.deepEqual(noBaseline.adversity, {
      schemeTwistsFromVillainDeck: 6,
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
      [],
    );
    assert.deepEqual(withBaseline.adversityExpected, {
      schemeTwistsFromVillainDeck: 3,
      villainsEscaped: 1,
      bystandersLost: 2,
    });
  });

  // why: WP-742 / D-24564 — the bot-ally marker rides a separate field; the seat
  // labels stay `Player N` either way.
  test('marks only the bot-ally seat isBotAlly and leaves the labels unchanged', () => {
    const state = makeState({
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    });
    const summary = buildCoachMatchSummary(state, makeBreakdown(), 'heroes-win', resolveName, ['1']);
    assert.equal(summary.perPlayer[0]?.label, 'Player 1');
    assert.equal(summary.perPlayer[0]?.isBotAlly, false);
    assert.equal(summary.perPlayer[1]?.label, 'Player 2');
    assert.equal(summary.perPlayer[1]?.isBotAlly, true);
  });

  test('marks every seat isBotAlly false in a human-only match', () => {
    const state = makeState({
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    });
    const summary = buildCoachMatchSummary(state, makeBreakdown(), 'heroes-win', resolveName, []);
    assert.equal(summary.perPlayer.length, 2);
    for (const line of summary.perPlayer) {
      assert.equal(line.isBotAlly, false);
    }
    assert.deepEqual(
      summary.perPlayer.map((line) => line.label),
      ['Player 1', 'Player 2'],
    );
  });
});

// ---------------------------------------------------------------------------
// WP-751 / D-24576 — the casual (unscored) summary
// ---------------------------------------------------------------------------

describe('buildCasualCoachMatchSummary (WP-751)', () => {
  // A state with acquired cards and two seats, so the per-player lines carry data.
  function makeTwoSeatState(): LegendaryGameState {
    return makeState({
      '0': { deck: ['core/hero/rogue'], hand: [], discard: ['core/hero/spider-man'], inPlay: [], victory: [] },
      '1': { deck: [], hand: ['core/hero/gambit'], discard: [], inPlay: [], victory: [] },
    });
  }

  // A breakdown whose PAR baseline carries expected adversity, so the scored summary
  // has all four PAR fields the casual one must omit.
  function makeBreakdownWithBaseline(): ScoreBreakdown {
    return makeBreakdown({
      parBaseline: { schemeTwistsPar: 5, escapesPar: 3, bystandersLostPar: 3 },
    } as unknown as Partial<ScoreBreakdown>);
  }

  test('omits rawScore, finalScore, grade and adversityExpected', () => {
    const summary = buildCasualCoachMatchSummary(
      makeTwoSeatState(),
      makeBreakdown().inputs,
      'heroes-win',
      resolveName,
      [],
    );
    for (const field of ['rawScore', 'finalScore', 'grade', 'adversityExpected']) {
      assert.equal(field in summary, false, 'the casual summary must omit ' + field);
    }
  });

  test('every other field equals the scored summary built from the same inputs', () => {
    const state = makeTwoSeatState();
    const breakdown = makeBreakdownWithBaseline();
    const scored = buildCoachMatchSummary(state, breakdown, 'scheme-wins', resolveName, ['1']);
    const casual = buildCasualCoachMatchSummary(state, breakdown.inputs, 'scheme-wins', resolveName, ['1']);

    // The scored summary really does carry the four PAR fields (so the comparison
    // below proves they are the ONLY difference).
    assert.notEqual(scored.rawScore, undefined);
    assert.notEqual(scored.finalScore, undefined);
    assert.notEqual(scored.grade, undefined);
    assert.notEqual(scored.adversityExpected, undefined);

    const { rawScore, finalScore, grade, adversityExpected, ...scoredWithoutParFields } = scored;
    void rawScore;
    void finalScore;
    void grade;
    void adversityExpected;
    assert.deepEqual(casual, scoredWithoutParFields);
  });

  // why: D-24578 — the bot's buys are never sent, so the coach cannot grade them.
  test('omits acquiredCards for the bot-ally seat and keeps them for the human seat', () => {
    const state = {
      ...makeState({
        '0': { deck: ['core/rogue/borrowed-brawn#0'], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: ['core/gambit/card-shark#0'], hand: [], discard: [], inPlay: [], victory: [] },
      }),
      cardDisplayData: {
        'core/rogue/borrowed-brawn#0': { name: 'Borrowed Brawn' },
        'core/gambit/card-shark#0': { name: 'Card Shark' },
      },
    } as unknown as LegendaryGameState;
    const summary = buildCoachMatchSummary(state, makeBreakdown(), 'heroes-win', resolveName, ['1']);
    assert.deepEqual(summary.perPlayer[0]?.acquiredCards, ['Borrowed Brawn (Rogue)']);
    assert.equal(summary.perPlayer[1]?.isBotAlly, true);
    assert.equal('acquiredCards' in (summary.perPlayer[1] ?? {}), false);
  });
});
