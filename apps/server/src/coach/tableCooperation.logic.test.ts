/**
 * Tests for the Table Cooperation recognition (WP-717 / D-24540).
 *
 * `computeTableCooperation` is pure over a `CoachMatchSummary` (no DB, no engine, no
 * replay). Proves: the shared-outcome team line per outcome; standout co-op roles from
 * `perPlayer` (with the deterministic first-max-wins tie-break); role omission on a
 * zero metric; solo / all-zero degradation; the combined-total line; and the two
 * copy-lint vocabularies (celebration + cooperative, word-boundary matching).
 *
 * Authority: WP-717 §Contract; EC-754; D-24540.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { computeTableCooperation } from './tableCooperation.logic.js';
import type { CoachMatchSummary, CoachPlayerLine } from './coach.types.js';

// why: the two-vocabulary copy-lint — WORD-BOUNDARY matching so "defeated" does not trip
// "beat". Celebration (never defeatist) + cooperative (seats are teammates, never
// player-vs-player, the game's own no-winner/loser rule; the intra-match analogue of §23b).
const BANNED_WORDS = [
  'whiff',
  'failed',
  'error',
  'missed',
  'wasted',
  'opponent',
  'beat',
  'versus',
  'vs',
  'winner',
  'loser',
];

/** Asserts no emitted line contains a banned word (word-boundary, lowercased). */
function assertCopyClean(lines: readonly string[]): void {
  const text = lines.join('\n').toLowerCase();
  for (const banned of BANNED_WORDS) {
    assert.equal(
      new RegExp(`\\b${banned}\\b`).test(text),
      false,
      `Table Cooperation copy must not contain "${banned}": ${text}`,
    );
  }
}

// why: WP-719 no-seat-named-twice guardrail — a seat that wins multiple roles is grouped
// into ONE line, so no "Seat N" / "Player N" label leads more than one line.
function assertNoSeatNamedTwice(lines: readonly string[]): void {
  const seen = new Set<string>();
  for (const line of lines) {
    const match = /^((?:Seat|Player) \d+) /.exec(line);
    if (match !== null) {
      const label = match[1]!;
      assert.ok(!seen.has(label), `seat "${label}" named in more than one line:\n${lines.join('\n')}`);
      seen.add(label);
    }
  }
}

/** Builds a per-seat contribution line with zero defaults, overridable per field. */
function makeSeat(overrides: Partial<CoachPlayerLine> & { label: string }): CoachPlayerLine {
  return {
    victoryPoints: 0,
    bystandersRescued: 0,
    villainsDefeated: 0,
    henchmenDefeated: 0,
    mastermindTacticsDefeated: 0,
    conditionalClausesPlayed: 0,
    conditionalClausesAssembled: 0,
    conditionalClausesPotentialValue: 0,
    conditionalClausesRealizedValue: 0,
    acquiredCards: [],
    ...overrides,
  };
}

/** Builds a match summary with sensible defaults, overridable per field. */
function makeSummary(overrides: Partial<CoachMatchSummary>): CoachMatchSummary {
  return {
    outcome: 'heroes-win',
    playerCount: 2,
    rounds: 10,
    scheme: 'The Legacy Virus',
    mastermind: 'Magneto',
    villainGroups: [],
    henchmanGroups: [],
    heroes: [],
    rawScore: 0,
    finalScore: 0,
    grade: 'b',
    team: { victoryPoints: 0, bystandersRescued: 0 },
    adversity: { schemeTwistsFromVillainDeck: 0, villainsEscaped: 0, bystandersLost: 0 },
    perPlayer: [],
    ...overrides,
  };
}

describe('computeTableCooperation (WP-717 / D-24540)', () => {
  test('heroes-win: frames the shared victory as a team achievement', () => {
    const lines = computeTableCooperation(makeSummary({ outcome: 'heroes-win', mastermind: 'Magneto', perPlayer: [makeSeat({ label: 'You' })] }));
    assert.match(lines[0]!, /stopped Magneto together/);
    assert.match(lines[0]!, /shared victory/);
    assertCopyClean(lines);
  });

  test('scheme-wins: frames a regroup, never blame', () => {
    const lines = computeTableCooperation(makeSummary({ outcome: 'scheme-wins', scheme: 'The Legacy Virus', perPlayer: [makeSeat({ label: 'You' })] }));
    assert.match(lines[0]!, /The Legacy Virus won this round/);
    assert.match(lines[0]!, /regroup/);
    assertCopyClean(lines);
  });

  test('tie: frames the held stand', () => {
    const lines = computeTableCooperation(makeSummary({ outcome: 'tie', perPlayer: [makeSeat({ label: 'You' })] }));
    assert.match(lines[0]!, /hard-fought stand/);
    assertCopyClean(lines);
  });

  test('groups roles by seat: a one-role seat keeps its voice, a multi-role seat combines', () => {
    const summary = makeSummary({
      team: { victoryPoints: 0, bystandersRescued: 5 },
      perPlayer: [
        makeSeat({ label: 'Seat 1', villainsDefeated: 4, henchmenDefeated: 1, conditionalClausesAssembled: 1 }),
        makeSeat({ label: 'Seat 2', conditionalClausesAssembled: 6, conditionalClausesRealizedValue: 12, bystandersRescued: 5 }),
      ],
    });
    const lines = computeTableCooperation(summary);

    // Seat 1 wins only combat → its specific single-role line, unchanged.
    assert.ok(lines.some((line) => /Seat 1 carried the combat — 5 enemies defeated\./.test(line)), lines.join('\n'));
    // Seat 2 wins synergy + rescue → ONE combined line (not named twice).
    assert.ok(
      lines.some((line) => /Seat 2 anchored the table — 6 conditional clauses landed and 5 Bystanders saved\./.test(line)),
      lines.join('\n'),
    );
    assert.ok(lines.some((line) => /Together your table defeated 5 enemies and rescued 5 Bystanders\./.test(line)), lines.join('\n'));
    assertNoSeatNamedTwice(lines);
    assertCopyClean(lines);
  });

  test('one-seat sweep: a seat that wins all three roles gets one combined line', () => {
    const summary = makeSummary({
      team: { victoryPoints: 0, bystandersRescued: 12 },
      perPlayer: [
        makeSeat({ label: 'Player 1', villainsDefeated: 1 }),
        makeSeat({
          label: 'Player 2',
          villainsDefeated: 6,
          conditionalClausesAssembled: 3,
          bystandersRescued: 12,
        }),
      ],
    });
    const lines = computeTableCooperation(summary);

    const roleLines = lines.filter((line) => /anchored the table|carried the|assembled the most synergy/.test(line));
    assert.equal(roleLines.length, 1, 'a full sweep by one seat yields exactly one role line');
    assert.match(
      roleLines[0]!,
      /Player 2 anchored the table — 6 enemies defeated, 3 conditional clauses landed, and 12 Bystanders saved\./,
    );
    assertNoSeatNamedTwice(lines);
    assertCopyClean(lines);
  });

  test('all-distinct: three seats each win one role → three specific single-role lines', () => {
    const summary = makeSummary({
      team: { victoryPoints: 0, bystandersRescued: 3 },
      playerCount: 3,
      perPlayer: [
        makeSeat({ label: 'Seat 1', villainsDefeated: 5 }),
        makeSeat({ label: 'Seat 2', conditionalClausesAssembled: 4 }),
        makeSeat({ label: 'Seat 3', bystandersRescued: 3 }),
      ],
    });
    const lines = computeTableCooperation(summary);

    assert.ok(lines.some((line) => /Seat 1 carried the combat — 5 enemies defeated\./.test(line)), lines.join('\n'));
    assert.ok(lines.some((line) => /Seat 2 assembled the most synergy — 4 conditional clauses landed\./.test(line)), lines.join('\n'));
    assert.ok(lines.some((line) => /Seat 3 carried the rescue — 3 Bystanders saved\./.test(line)), lines.join('\n'));
    assert.ok(!lines.some((line) => /anchored the table/.test(line)), 'no combined line when each seat wins one role');
    assertNoSeatNamedTwice(lines);
  });

  test('omits a role line when its metric is zero across the table', () => {
    const summary = makeSummary({
      perPlayer: [
        makeSeat({ label: 'Seat 1', villainsDefeated: 2 }),
        makeSeat({ label: 'Seat 2', villainsDefeated: 1 }),
      ],
    });
    const lines = computeTableCooperation(summary);
    // Combat exists; synergy and rescue are zero across the table → no such lines.
    assert.ok(lines.some((line) => /carried the combat/.test(line)));
    assert.ok(!lines.some((line) => /synergy/.test(line)), 'no synergy line when zero across the table');
    assert.ok(!lines.some((line) => /carried the rescue/.test(line)), 'no rescue line when zero across the table');
  });

  test('tie-break: an exact combat tie resolves to the first seat, one line only', () => {
    const summary = makeSummary({
      perPlayer: [
        makeSeat({ label: 'Seat 1', villainsDefeated: 3 }),
        makeSeat({ label: 'Seat 2', villainsDefeated: 3 }),
      ],
    });
    const lines = computeTableCooperation(summary);
    const combatLines = lines.filter((line) => /carried the combat/.test(line));
    assert.equal(combatLines.length, 1, 'exactly one combat role line');
    assert.match(combatLines[0]!, /Seat 1 carried the combat/, 'a full tie resolves to the first seat');
  });

  test('synergy tie-break falls to the higher realized value, then to the first seat', () => {
    const summary = makeSummary({
      perPlayer: [
        makeSeat({ label: 'Seat 1', conditionalClausesAssembled: 3, conditionalClausesRealizedValue: 4 }),
        makeSeat({ label: 'Seat 2', conditionalClausesAssembled: 3, conditionalClausesRealizedValue: 9 }),
      ],
    });
    const lines = computeTableCooperation(summary);
    assert.ok(lines.some((line) => /Seat 2 assembled the most synergy/.test(line)), 'the higher realized value breaks the assembled tie');
  });

  test('solo / single-seat: returns just the shared-outcome line (no cross-seat roles)', () => {
    const lines = computeTableCooperation(makeSummary({ playerCount: 1, perPlayer: [makeSeat({ label: 'You', villainsDefeated: 4, bystandersRescued: 2 })] }));
    assert.equal(lines.length, 1, 'no role lines for a solo match');
    assert.match(lines[0]!, /stopped Magneto together/);
  });

  test('all-zero multi-seat table: outcome line only (no roles, no combined total)', () => {
    const summary = makeSummary({ perPlayer: [makeSeat({ label: 'Seat 1' }), makeSeat({ label: 'Seat 2' })] });
    const lines = computeTableCooperation(summary);
    assert.equal(lines.length, 1, 'only the shared-outcome line when the table did nothing scorable');
    assertCopyClean(lines);
  });

  test('singular grammar: one enemy / one Bystander', () => {
    const summary = makeSummary({
      team: { victoryPoints: 0, bystandersRescued: 1 },
      perPlayer: [
        makeSeat({ label: 'Seat 1', villainsDefeated: 1 }),
        makeSeat({ label: 'Seat 2', bystandersRescued: 1 }),
      ],
    });
    const lines = computeTableCooperation(summary);
    assert.ok(lines.some((line) => /1 enemy defeated\./.test(line)), lines.join('\n'));
    assert.ok(lines.some((line) => /Together your table defeated 1 enemy and rescued 1 Bystander\./.test(line)), lines.join('\n'));
  });
});
