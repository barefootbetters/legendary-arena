/**
 * Tests for the shared gauntlet-truth helper (WP-442).
 *
 * These exercise the extracted functions in ISOLATION against seeded
 * fixtures — the complement to `gauntlet.logic.test.ts`, which proves the
 * same logic through the public `getGauntletStandings` surface and is the
 * behavior-preservation gate. Here we drive each reject clause of
 * `qualifiesAsLegClear` independently, the five `matchesApprovedLoadout`
 * cases, and the `findBestPoolAssignment` budget / chosen-union / tie-break /
 * cap-truncation behavior.
 *
 * Authority: WP-442; EC-477 §Locked Values; WP-384; WP-395; D-24187;
 * D-24199.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FIXED_POOL_TEAM_CAP,
  findBestPoolAssignment,
  matchesApprovedLoadout,
  qualifiesAsLegClear,
} from './gauntletTruth.logic.js';
import type {
  LegClearReplayFacts,
  RosterLegAccumulator,
} from './gauntletTruth.logic.js';
import type { GauntletApprovedLoadouts } from './gauntlet.logic.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const APPROVED_HENCHMEN = 'core/doombot-legion';
const OTHER_HENCHMEN = 'core/hand-ninjas';

// why: a solo menu approving two configurations, so a test can prove that
// membership — not mere non-emptiness — is what qualifies a replay.
const SOLO_LOADOUTS: GauntletApprovedLoadouts = {
  1: [
    {
      villainSegment: 'villains-x',
      henchmanKey: APPROVED_HENCHMEN,
      villainGroupIds: ['core/villains-x'],
      henchmanGroupIds: ['core/doombot-legion'],
    },
    {
      villainSegment: 'villains-y',
      henchmanKey: OTHER_HENCHMEN,
      villainGroupIds: ['core/villains-y'],
      henchmanGroupIds: ['core/hand-ninjas'],
    },
  ],
};

/** An approved solo scenario key (villains-x is approved with doombots). */
const APPROVED_SCENARIO = 'scheme-a::mm-one::villains-x';

/**
 * Builds a fully-qualifying solo leg-clear facts object; override any field
 * via `overrides` to drive a single reject clause.
 */
function soloFacts(
  overrides?: Partial<LegClearReplayFacts>,
): LegClearReplayFacts {
  return {
    scenarioKey: APPROVED_SCENARIO,
    scoringConfigVersion: 1,
    playerCount: 1,
    ownerVisibilities: ['public'],
    henchmanKey: APPROVED_HENCHMEN,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// qualifiesAsLegClear
// ---------------------------------------------------------------------------

describe('qualifiesAsLegClear (WP-442)', () => {
  test('the all-pass case qualifies', () => {
    assert.strictEqual(qualifiesAsLegClear(soloFacts(), SOLO_LOADOUTS, 1), true);
  });

  test('clause 1: a null published version fails closed', () => {
    assert.strictEqual(
      qualifiesAsLegClear(soloFacts(), SOLO_LOADOUTS, null),
      false,
    );
  });

  test('clause 2: a version mismatch does not qualify', () => {
    assert.strictEqual(
      qualifiesAsLegClear(
        soloFacts({ scoringConfigVersion: 2 }),
        SOLO_LOADOUTS,
        1,
      ),
      false,
    );
  });

  test('clause 3: a non-integer or out-of-range player count does not qualify', () => {
    assert.strictEqual(
      qualifiesAsLegClear(soloFacts({ playerCount: 1.5 }), SOLO_LOADOUTS, 1),
      false,
    );
    assert.strictEqual(
      qualifiesAsLegClear(
        soloFacts({ playerCount: 0, ownerVisibilities: [] }),
        SOLO_LOADOUTS,
        1,
      ),
      false,
    );
    assert.strictEqual(
      qualifiesAsLegClear(
        soloFacts({
          playerCount: 6,
          ownerVisibilities: [
            'public',
            'public',
            'public',
            'public',
            'public',
            'public',
          ],
        }),
        SOLO_LOADOUTS,
        1,
      ),
      false,
    );
  });

  test('clause 4: a roster size not equal to the player count does not qualify', () => {
    assert.strictEqual(
      qualifiesAsLegClear(
        soloFacts({ playerCount: 2, ownerVisibilities: ['public'] }),
        SOLO_LOADOUTS,
        1,
      ),
      false,
    );
  });

  test('clause 5: an unapproved loadout does not qualify', () => {
    assert.strictEqual(
      qualifiesAsLegClear(
        soloFacts({ henchmanKey: 'core/savage-land-mutates' }),
        SOLO_LOADOUTS,
        1,
      ),
      false,
    );
  });

  test('clause 6: a hidden owner excludes the whole replay', () => {
    assert.strictEqual(
      qualifiesAsLegClear(
        soloFacts({ ownerVisibilities: ['private'] }),
        SOLO_LOADOUTS,
        1,
      ),
      false,
    );
  });

  test('undefined approvedLoadouts skips the loadout clause (still qualifies)', () => {
    // why: an unconstrained gauntlet — the loadout clause is opt-in, so a
    // NULL henchman key that would fail clause 5 under a menu now passes.
    assert.strictEqual(
      qualifiesAsLegClear(soloFacts({ henchmanKey: null }), undefined, 1),
      true,
    );
  });

  test('a link-visible owner qualifies (link and public both count as visible)', () => {
    assert.strictEqual(
      qualifiesAsLegClear(
        soloFacts({ ownerVisibilities: ['link'] }),
        SOLO_LOADOUTS,
        1,
      ),
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// matchesApprovedLoadout
// ---------------------------------------------------------------------------

describe('matchesApprovedLoadout (WP-442)', () => {
  test('undefined loadouts qualify everything', () => {
    assert.strictEqual(
      matchesApprovedLoadout(undefined, 1, APPROVED_SCENARIO, null),
      true,
    );
  });

  test('an empty configuration for the count fails closed', () => {
    const emptyForSolo: GauntletApprovedLoadouts = { 1: [] };
    assert.strictEqual(
      matchesApprovedLoadout(emptyForSolo, 1, APPROVED_SCENARIO, APPROVED_HENCHMEN),
      false,
    );
    // A count with no key at all is likewise unqualifiable.
    assert.strictEqual(
      matchesApprovedLoadout(SOLO_LOADOUTS, 2, APPROVED_SCENARIO, APPROVED_HENCHMEN),
      false,
    );
  });

  test('a null henchman key never matches once a menu is configured', () => {
    assert.strictEqual(
      matchesApprovedLoadout(SOLO_LOADOUTS, 1, APPROVED_SCENARIO, null),
      false,
    );
  });

  test('an exact villain-segment + henchman-key pair matches', () => {
    assert.strictEqual(
      matchesApprovedLoadout(SOLO_LOADOUTS, 1, APPROVED_SCENARIO, APPROVED_HENCHMEN),
      true,
    );
  });

  test('a crossed pairing (approved halves, wrong combination) does not match', () => {
    // why: villains-x is approved only WITH doombots; pairing it with the
    // hand-ninjas half must fail, or the check is two independent allowlists.
    assert.strictEqual(
      matchesApprovedLoadout(SOLO_LOADOUTS, 1, APPROVED_SCENARIO, OTHER_HENCHMEN),
      false,
    );
    // A villain segment outside the menu also fails.
    assert.strictEqual(
      matchesApprovedLoadout(
        SOLO_LOADOUTS,
        1,
        'scheme-a::mm-one::villains-unapproved',
        APPROVED_HENCHMEN,
      ),
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// per-scheme approved-loadout selection (WP-472 / D-24283)
// ---------------------------------------------------------------------------

// why: two DISTINCT per-scheme configs for the same mastermind — scheme-a
// approves villains-a + doombots, scheme-b approves villains-b + hand-ninjas —
// so a test can prove the predicate selects by the replay's scheme, not the
// mastermind default.
const PER_SCHEME_LOADOUTS: ReadonlyMap<string, GauntletApprovedLoadouts> =
  new Map([
    [
      'scheme-a',
      {
        1: [
          {
            villainSegment: 'villains-a',
            henchmanKey: APPROVED_HENCHMEN,
            villainGroupIds: ['core/villains-a'],
            henchmanGroupIds: ['core/doombot-legion'],
          },
        ],
      },
    ],
    [
      'scheme-b',
      {
        1: [
          {
            villainSegment: 'villains-b',
            henchmanKey: OTHER_HENCHMEN,
            villainGroupIds: ['core/villains-b'],
            henchmanGroupIds: ['core/hand-ninjas'],
          },
        ],
      },
    ],
  ]);

describe('qualifiesAsLegClear per-scheme selection (WP-472 / D-24283)', () => {
  test("a run matching ITS leg's per-scheme config qualifies", () => {
    assert.strictEqual(
      qualifiesAsLegClear(
        soloFacts({
          scenarioKey: 'scheme-a::mm-one::villains-a',
          henchmanKey: APPROVED_HENCHMEN,
        }),
        undefined,
        1,
        PER_SCHEME_LOADOUTS,
      ),
      true,
    );
  });

  test("a run bringing a DIFFERENT scheme's villains of the same mastermind is rejected", () => {
    // why: the core WP-472 guarantee — scheme-a approves villains-a, so a run on
    // the scheme-a leg played with scheme-b's villains-b (an approved config for
    // a DIFFERENT leg) must NOT qualify.
    assert.strictEqual(
      qualifiesAsLegClear(
        soloFacts({
          scenarioKey: 'scheme-a::mm-one::villains-b',
          henchmanKey: OTHER_HENCHMEN,
        }),
        undefined,
        1,
        PER_SCHEME_LOADOUTS,
      ),
      false,
    );
  });

  test('a scheme absent from the overlay falls back to the per-mastermind menu', () => {
    // why: scheme-c has no per-scheme override, so the predicate matches against
    // the base `approvedLoadouts` (SOLO_LOADOUTS approves villains-x + doombots).
    assert.strictEqual(
      qualifiesAsLegClear(
        soloFacts({
          scenarioKey: 'scheme-c::mm-one::villains-x',
          henchmanKey: APPROVED_HENCHMEN,
        }),
        SOLO_LOADOUTS,
        1,
        PER_SCHEME_LOADOUTS,
      ),
      true,
    );
  });

  test('an undefined overlay reproduces the pre-WP-472 per-mastermind match', () => {
    assert.strictEqual(
      qualifiesAsLegClear(soloFacts(), SOLO_LOADOUTS, 1, undefined),
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// findBestPoolAssignment
// ---------------------------------------------------------------------------

const TEAM_ABC = 'core/hero-a+core/hero-b+core/hero-c';
const TEAM_DEF = 'core/hero-d+core/hero-e+core/hero-f';
const TEAM_ABD = 'core/hero-a+core/hero-b+core/hero-d';

const SOLO_LEGS = ['scheme-a', 'scheme-b'] as const;

/**
 * Builds a roster accumulator with the given per-(leg, team) scores. Each
 * entry is `[schemeSlug, teamKey, score]`; the open-division
 * `bestScoreBySchemeSlug` map is filled from the same data for completeness.
 */
function rosterWith(
  entries: readonly [string, string, number][],
  players: readonly string[] = ['Alice'],
): RosterLegAccumulator {
  const bestScoreBySchemeSlug = new Map<string, number>();
  const bestScoreBySchemeAndTeamKey = new Map<string, Map<string, number>>();
  for (const [schemeSlug, teamKey, score] of entries) {
    const currentBest = bestScoreBySchemeSlug.get(schemeSlug);
    if (currentBest === undefined || score < currentBest) {
      bestScoreBySchemeSlug.set(schemeSlug, score);
    }
    let legTeams = bestScoreBySchemeAndTeamKey.get(schemeSlug);
    if (legTeams === undefined) {
      legTeams = new Map<string, number>();
      bestScoreBySchemeAndTeamKey.set(schemeSlug, legTeams);
    }
    const currentTeamBest = legTeams.get(teamKey);
    if (currentTeamBest === undefined || score < currentTeamBest) {
      legTeams.set(teamKey, score);
    }
  }
  return { players, bestScoreBySchemeSlug, bestScoreBySchemeAndTeamKey };
}

describe('findBestPoolAssignment (WP-442)', () => {
  test('one team clearing every leg yields that team as the pool', () => {
    const roster = rosterWith([
      ['scheme-a', TEAM_ABC, -5],
      ['scheme-b', TEAM_ABC, -2],
    ]);
    const assignment = findBestPoolAssignment(
      roster,
      SOLO_LEGS,
      5,
      'gauntlet-core-mm-one',
      1,
    );
    assert.deepEqual(assignment, {
      totalScore: -7,
      heroPool: ['core/hero-a', 'core/hero-b', 'core/hero-c'],
    });
  });

  test('two disjoint teams that blow the budget yield null', () => {
    const roster = rosterWith([
      ['scheme-a', TEAM_ABC, -5],
      ['scheme-b', TEAM_DEF, -2],
    ]);
    // Union of 6 heroes > solo budget 5, and neither team cleared both legs.
    const assignment = findBestPoolAssignment(
      roster,
      SOLO_LEGS,
      5,
      'gauntlet-core-mm-one',
      1,
    );
    assert.strictEqual(assignment, null);
  });

  test('the published pool is the union of the CHOSEN teams, not the candidate subset', () => {
    // why: the unconstrained best plays TEAM_ABC on A (-10) and TEAM_DEF on B
    // (-10) for -20, but pool 6 > budget 5. The best pool-satisfying
    // assignment plays TEAM_ABC on both legs (-10 + -4 = -14); the published
    // pool is the CHOSEN teams' union (ABC only), not the enumerated subset.
    const roster = rosterWith([
      ['scheme-a', TEAM_ABC, -10],
      ['scheme-b', TEAM_DEF, -10],
      ['scheme-b', TEAM_ABC, -4],
    ]);
    const assignment = findBestPoolAssignment(
      roster,
      SOLO_LEGS,
      5,
      'gauntlet-core-mm-one',
      1,
    );
    assert.strictEqual(assignment?.totalScore, -14);
    assert.deepEqual(assignment?.heroPool, [
      'core/hero-a',
      'core/hero-b',
      'core/hero-c',
    ]);
  });

  test('overlapping teams within budget publish the union pool', () => {
    // TEAM_ABC ∪ TEAM_ABD = {a, b, c, d} = 4 heroes ≤ budget 5.
    const roster = rosterWith([
      ['scheme-a', TEAM_ABC, -5],
      ['scheme-b', TEAM_ABD, -2],
    ]);
    const assignment = findBestPoolAssignment(
      roster,
      SOLO_LEGS,
      5,
      'gauntlet-core-mm-one',
      1,
    );
    assert.strictEqual(assignment?.totalScore, -7);
    assert.deepEqual(assignment?.heroPool, [
      'core/hero-a',
      'core/hero-b',
      'core/hero-c',
      'core/hero-d',
    ]);
  });

  test('ties on total score break to the lexicographically smallest joined pool', () => {
    // why: both TEAM_ABC-only and TEAM_ABD-only clear every leg for the same
    // total (-7). Their joined pools are "a+b+c" and "a+b+d"; the search must
    // publish the smaller, "core/hero-a+core/hero-b+core/hero-c".
    const roster = rosterWith([
      ['scheme-a', TEAM_ABC, -5],
      ['scheme-a', TEAM_ABD, -5],
      ['scheme-b', TEAM_ABC, -2],
      ['scheme-b', TEAM_ABD, -2],
    ]);
    const assignment = findBestPoolAssignment(
      roster,
      SOLO_LEGS,
      5,
      'gauntlet-core-mm-one',
      1,
    );
    assert.deepEqual(assignment?.heroPool, [
      'core/hero-a',
      'core/hero-b',
      'core/hero-c',
    ]);
  });

  test('more distinct teams than the cap are truncated with a logged warning', () => {
    // why: 13 distinct teams exceeds FIXED_POOL_TEAM_CAP (12). The kept 12
    // are the lowest-scoring; team x1 (leg-A score -13, also holding leg B at
    // -5) survives truncation, so the entry still computes at -18. A silent
    // cap is a FAIL by design, so the warning is asserted.
    const entries: [string, string, number][] = [];
    for (let teamIndex = 1; teamIndex <= 13; teamIndex += 1) {
      const teamKey =
        `core/x${teamIndex}a+core/x${teamIndex}b+core/x${teamIndex}c`;
      entries.push(['scheme-a', teamKey, -14 + teamIndex]);
    }
    entries.push(['scheme-b', 'core/x1a+core/x1b+core/x1c', -5]);
    const roster = rosterWith(entries);

    const capturedWarnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...warnArgs: unknown[]) => {
      capturedWarnings.push(String(warnArgs[0]));
    };
    let assignment: { totalScore: number; heroPool: string[] } | null = null;
    try {
      assignment = findBestPoolAssignment(
        roster,
        SOLO_LEGS,
        5,
        'gauntlet-core-mm-one',
        1,
      );
    } finally {
      console.warn = originalWarn;
    }

    assert.strictEqual(assignment?.totalScore, -18);
    assert.deepEqual(assignment?.heroPool, ['core/x1a', 'core/x1b', 'core/x1c']);
    assert.strictEqual(capturedWarnings.length, 1);
    assert.ok(
      capturedWarnings[0].includes('13 distinct teams'),
      'The truncation warning must name the distinct-team count.',
    );
    // The warning carries the precomputed board-name string byte-for-byte.
    assert.ok(capturedWarnings[0].includes('gauntlet-core-mm-one'));
  });

  test('the cap constant is the D-24187 §5 locked value of 12', () => {
    assert.strictEqual(FIXED_POOL_TEAM_CAP, 12);
  });
});
