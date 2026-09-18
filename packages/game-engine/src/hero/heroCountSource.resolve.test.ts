/**
 * Tests for the count-source resolver and the HERO_COUNT_SOURCES drift parity
 * (WP-247 / D-24016).
 *
 * Covers: drift parity (union ↔ canonical array), the victory-bystanders count
 * across both ext_id forms (pile-bystander + bystander-villain-deck-NN), the
 * exclusion of non-bystander victory-pile cards, the empty / missing-player
 * zero cases, and the unknown-source defensive zero.
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCountSource, explainCountSourceInputs } from './heroCountSource.resolve.js';
import { HERO_COUNT_SOURCES } from '../rules/heroCountSource.js';
import type { HeroCountSource } from '../rules/heroCountSource.js';
import {
  BYSTANDER_EXT_ID,
  SHIELD_OFFICER_EXT_ID,
  SHIELD_AGENT_EXT_ID,
  SHIELD_TROOPER_EXT_ID,
} from '../setup/pilesInit.js';
import type { LegendaryGameState } from '../types.js';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/**
 * Builds a minimal LegendaryGameState whose only meaningful content is player
 * "0"'s victory pile. resolveCountSource reads only G.playerZones[playerID].victory.
 *
 * @param victory - The victory-pile ext_id entries for player "0".
 * @returns A minimal game state cast to LegendaryGameState.
 */
function makeStateWithVictory(victory: string[]): LegendaryGameState {
  return {
    playerZones: {
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory },
    },
  } as unknown as LegendaryGameState;
}

// ---------------------------------------------------------------------------
// Drift parity
// ---------------------------------------------------------------------------

describe('HERO_COUNT_SOURCES drift-detection', () => {
  // why: prevents union/array divergence — same pattern as HERO_KEYWORDS drift
  // detection. A new HeroCountSource must update BOTH the union and this array.
  // why: WP-563 / D-24372 — a RUNTIME assertion, not a bare `satisfies`: engine
  // test files are transpiled by tsx (not typechecked in CI), so a compile-time
  // pin would be documentation only. This keyset check gates on every run.
  it('contains exactly the 10 canonical count-source values', () => {
    const expectedSources = [
      'victory-bystanders',
      'worthy-cards-played-this-turn',
      'cost-four-plus-played-this-turn',
      'attack-icon-played-this-turn',
      'recruit-icon-played-this-turn',
      'shield-levels',
      'distinct-hero-classes-played-this-turn',
      'avengers-played-this-turn',
      'shield-heroes-played-this-turn',
      'odd-cost-heroes-played-this-turn',
    ];

    assert.equal(
      HERO_COUNT_SOURCES.length,
      10,
      'HERO_COUNT_SOURCES must have exactly 10 entries',
    );

    assert.deepStrictEqual(
      [...HERO_COUNT_SOURCES],
      expectedSources,
      'HERO_COUNT_SOURCES must match the canonical count-source values in order',
    );

    const uniqueSources = new Set(HERO_COUNT_SOURCES);
    assert.equal(
      uniqueSources.size,
      HERO_COUNT_SOURCES.length,
      'HERO_COUNT_SOURCES must have no duplicates',
    );
  });
});

// ---------------------------------------------------------------------------
// worthy-cards-played-this-turn resolver (WP-673 / D-24488)
// ---------------------------------------------------------------------------

/**
 * Builds a minimal LegendaryGameState with player "0"'s in-play zone and a
 * cardStats cost map. resolveCountSource('worthy-cards-played-this-turn') reads
 * only G.playerZones[playerID].inPlay and G.cardStats[id].cost.
 *
 * @param inPlay - The in-play ext_id entries for player "0".
 * @param costs - Map of ext_id → printed cost.
 * @returns A minimal game state cast to LegendaryGameState.
 */
function makeStateWithInPlay(
  inPlay: string[],
  costs: Record<string, number>,
): LegendaryGameState {
  const cardStats: Record<string, { cost: number }> = {};
  for (const id of Object.keys(costs)) {
    cardStats[id] = { cost: costs[id]! };
  }
  return {
    playerZones: {
      '0': { deck: [], hand: [], discard: [], inPlay, victory: [] },
    },
    cardStats,
  } as unknown as LegendaryGameState;
}

describe('resolveCountSource worthy-cards-played-this-turn', () => {
  it('returns 0 when no other Worthy-making cards were played', () => {
    // Only the triggering card (cost 5) is in play → no OTHER Worthy cards.
    const gameState = makeStateWithInPlay(['divine-lightning#0'], {
      'divine-lightning#0': 5,
    });

    assert.equal(
      resolveCountSource(gameState, '0', 'worthy-cards-played-this-turn', 'divine-lightning#0'),
      0,
      'the triggering card is excluded and no other cost>=5 cards are in play',
    );
  });

  it('counts one other cost>=5 card played this turn', () => {
    const gameState = makeStateWithInPlay(
      ['smart-hulk#0', 'divine-lightning#0'],
      { 'smart-hulk#0': 5, 'divine-lightning#0': 5 },
    );

    assert.equal(
      resolveCountSource(gameState, '0', 'worthy-cards-played-this-turn', 'divine-lightning#0'),
      1,
      'the one other cost>=5 card counts; the triggering card is excluded',
    );
  });

  it('counts two other cost>=5 cards played this turn (the reported case)', () => {
    // Two cost-5 Smart Hulk in play before Divine Lightning → expected +2.
    const gameState = makeStateWithInPlay(
      ['smart-hulk#0', 'smart-hulk#1', 'divine-lightning#0'],
      { 'smart-hulk#0': 5, 'smart-hulk#1': 5, 'divine-lightning#0': 5 },
    );

    assert.equal(
      resolveCountSource(gameState, '0', 'worthy-cards-played-this-turn', 'divine-lightning#0'),
      2,
      'both other cost>=5 cards count; the triggering card is excluded',
    );
  });

  it('excludes cards costing less than 5 (they do not make you Worthy)', () => {
    const gameState = makeStateWithInPlay(
      ['cheap#0', 'smart-hulk#0', 'divine-lightning#0'],
      { 'cheap#0': 4, 'smart-hulk#0': 5, 'divine-lightning#0': 5 },
    );

    assert.equal(
      resolveCountSource(gameState, '0', 'worthy-cards-played-this-turn', 'divine-lightning#0'),
      1,
      'only the cost>=5 card counts; the cost-4 card does not make you Worthy',
    );
  });

  it('excludes the triggering card even when it is cost>=5', () => {
    // Without the triggering-card exclusion this would over-count by 1.
    const gameState = makeStateWithInPlay(['divine-lightning#0'], {
      'divine-lightning#0': 9,
    });

    assert.equal(
      resolveCountSource(gameState, '0', 'worthy-cards-played-this-turn', 'divine-lightning#0'),
      0,
      'a lone triggering card never counts itself, whatever its cost',
    );
  });

  it('counts the triggering card when no id is passed (defensive totality)', () => {
    // With no triggeringCardId the source counts every cost>=5 card. Documents
    // that the OTHER-exclusion depends on the executor passing the card id.
    const gameState = makeStateWithInPlay(['smart-hulk#0'], { 'smart-hulk#0': 5 });

    assert.equal(
      resolveCountSource(gameState, '0', 'worthy-cards-played-this-turn'),
      1,
      'without a triggering card id, every cost>=5 in-play card counts',
    );
  });

  it('returns 0 when the player has no zones (defensive)', () => {
    const gameState = makeStateWithInPlay([], {});

    assert.equal(
      resolveCountSource(gameState, '99', 'worthy-cards-played-this-turn', 'divine-lightning#0'),
      0,
      'a player with no zones must resolve to 0 (no throw)',
    );
  });
});

// ---------------------------------------------------------------------------
// cost-four-plus-played-this-turn resolver (WP-674 / D-24489)
// ---------------------------------------------------------------------------

describe('resolveCountSource cost-four-plus-played-this-turn', () => {
  it('returns 0 when no other cost>=4 cards were played', () => {
    // Only the triggering card (cost 6) is in play → no OTHER cost>=4 cards.
    const gameState = makeStateWithInPlay(['being-big-is-best#0'], {
      'being-big-is-best#0': 6,
    });

    assert.equal(
      resolveCountSource(gameState, '0', 'cost-four-plus-played-this-turn', 'being-big-is-best#0'),
      0,
      'the triggering card is excluded and no other cost>=4 cards are in play',
    );
  });

  it('counts two other cost>=4 cards played this turn', () => {
    const gameState = makeStateWithInPlay(
      ['ally-a#0', 'ally-b#0', 'being-big-is-best#0'],
      { 'ally-a#0': 4, 'ally-b#0': 7, 'being-big-is-best#0': 6 },
    );

    assert.equal(
      resolveCountSource(gameState, '0', 'cost-four-plus-played-this-turn', 'being-big-is-best#0'),
      2,
      'both other cost>=4 cards count; the triggering card is excluded',
    );
  });

  it('excludes cards costing less than 4', () => {
    const gameState = makeStateWithInPlay(
      ['cheap#0', 'ally-a#0', 'being-big-is-best#0'],
      { 'cheap#0': 3, 'ally-a#0': 4, 'being-big-is-best#0': 6 },
    );

    assert.equal(
      resolveCountSource(gameState, '0', 'cost-four-plus-played-this-turn', 'being-big-is-best#0'),
      1,
      'only the cost>=4 card counts; the cost-3 card is below the threshold',
    );
  });

  it('excludes the triggering card even when it is cost>=4', () => {
    // Without the triggering-card exclusion this would over-count by 1.
    const gameState = makeStateWithInPlay(['being-big-is-best#0'], {
      'being-big-is-best#0': 8,
    });

    assert.equal(
      resolveCountSource(gameState, '0', 'cost-four-plus-played-this-turn', 'being-big-is-best#0'),
      0,
      'a lone triggering card never counts itself, whatever its cost',
    );
  });

  it('returns 0 when the player has no zones (defensive)', () => {
    const gameState = makeStateWithInPlay([], {});

    assert.equal(
      resolveCountSource(gameState, '99', 'cost-four-plus-played-this-turn', 'being-big-is-best#0'),
      0,
      'a player with no zones must resolve to 0 (no throw)',
    );
  });
});

// ---------------------------------------------------------------------------
// attack-icon / recruit-icon-played-this-turn resolver (WP-675 / D-24490)
// ---------------------------------------------------------------------------

/**
 * Builds a state with player "0"'s in-play zone and a cardStats icon-presence map.
 * The icon sources read only inPlay + G.cardStats[id].hasAttackIcon/hasRecruitIcon.
 */
function makeStateWithIcons(
  inPlay: string[],
  icons: Record<string, { hasAttackIcon: boolean; hasRecruitIcon: boolean }>,
): LegendaryGameState {
  const cardStats: Record<string, { hasAttackIcon: boolean; hasRecruitIcon: boolean }> = {};
  for (const id of Object.keys(icons)) {
    cardStats[id] = { hasAttackIcon: icons[id]!.hasAttackIcon, hasRecruitIcon: icons[id]!.hasRecruitIcon };
  }
  return {
    playerZones: { '0': { deck: [], hand: [], discard: [], inPlay, victory: [] } },
    cardStats,
  } as unknown as LegendaryGameState;
}

describe('resolveCountSource attack-icon / recruit-icon-played-this-turn', () => {
  it('counts OTHER cards showing an attack icon, excluding the triggering card', () => {
    const gameState = makeStateWithIcons(
      ['ally-a#0', 'ally-b#0', 'symbiotic-adaptation#0'],
      {
        'ally-a#0': { hasAttackIcon: true, hasRecruitIcon: false },
        'ally-b#0': { hasAttackIcon: true, hasRecruitIcon: true },
        'symbiotic-adaptation#0': { hasAttackIcon: true, hasRecruitIcon: true },
      },
    );
    assert.equal(
      resolveCountSource(gameState, '0', 'attack-icon-played-this-turn', 'symbiotic-adaptation#0'),
      2,
      'both other attack-icon cards count; the triggering card (also attack-icon) is excluded',
    );
  });

  it('counts OTHER cards showing a recruit icon independently of attack icons', () => {
    const gameState = makeStateWithIcons(
      ['ally-a#0', 'ally-b#0', 'symbiotic-adaptation#0'],
      {
        'ally-a#0': { hasAttackIcon: true, hasRecruitIcon: false },
        'ally-b#0': { hasAttackIcon: false, hasRecruitIcon: true },
        'symbiotic-adaptation#0': { hasAttackIcon: true, hasRecruitIcon: true },
      },
    );
    assert.equal(
      resolveCountSource(gameState, '0', 'recruit-icon-played-this-turn', 'symbiotic-adaptation#0'),
      1,
      'only ally-b shows a recruit icon; ally-a (attack only) does not count',
    );
  });

  it('counts a "0+" card as showing its icon (faithful presence, NOT a >0 proxy)', () => {
    // A "0+" printed card parses to attack/recruit 0 but hasAttackIcon/hasRecruitIcon true.
    // A >0 proxy would wrongly drop it; the faithful boolean counts it.
    const gameState = makeStateWithIcons(
      ['zero-plus-attacker#0', 'symbiotic-adaptation#0'],
      {
        'zero-plus-attacker#0': { hasAttackIcon: true, hasRecruitIcon: false },
        'symbiotic-adaptation#0': { hasAttackIcon: true, hasRecruitIcon: true },
      },
    );
    assert.equal(
      resolveCountSource(gameState, '0', 'attack-icon-played-this-turn', 'symbiotic-adaptation#0'),
      1,
      'the "0+" attack-icon card counts even though its parsed attack is 0',
    );
  });

  it('returns 0 when the player has no zones (defensive)', () => {
    const gameState = makeStateWithIcons([], {});
    assert.equal(
      resolveCountSource(gameState, '99', 'attack-icon-played-this-turn', 'symbiotic-adaptation#0'),
      0,
      'a player with no zones must resolve to 0 (no throw)',
    );
  });
});

// ---------------------------------------------------------------------------
// victory-bystanders resolver
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// shield-levels resolver (WP-677 / D-24493)
// ---------------------------------------------------------------------------

/**
 * Builds a state with player "0"'s victory pile + a cardStats isShieldOrHydra map.
 * The shield-levels source reads only victory + G.cardStats[id].isShieldOrHydra.
 */
function makeVictoryState(
  victory: string[],
  membership: Record<string, boolean>,
): LegendaryGameState {
  const cardStats: Record<string, { isShieldOrHydra: boolean }> = {};
  for (const id of Object.keys(membership)) {
    cardStats[id] = { isShieldOrHydra: membership[id]! };
  }
  return {
    playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: [], victory } },
    cardStats,
  } as unknown as LegendaryGameState;
}

describe('resolveCountSource shield-levels', () => {
  it('counts S.H.I.E.L.D./HYDRA cards in the victory pile; NO self-exclusion (whole pile)', () => {
    const gameState = makeVictoryState(
      ['nick-fury#0', 'agent#0', 'hydra-kidnappers-00', 'spider-man#0'],
      {
        'nick-fury#0': true, // team shield
        'agent#0': true, // classless [team:shield] basic — still qualifies
        'hydra-kidnappers-00': true, // HYDRA group name
        'spider-man#0': false, // not shield/hydra
      },
    );
    // triggeringCardId is passed but MUST be ignored (S.H.I.E.L.D. Level counts the whole pile)
    assert.equal(
      resolveCountSource(gameState, '0', 'shield-levels', 'nick-fury#0'),
      3,
      'all three S.H.I.E.L.D./HYDRA cards count; the non-member does not; no self-exclusion',
    );
  });

  it('a victory-pile card with no cardStats row does not qualify; empty pile → 0', () => {
    const withUnknown = makeVictoryState(['mystery-card#0'], {}); // no cardStats entry
    assert.equal(resolveCountSource(withUnknown, '0', 'shield-levels'), 0, 'no cardStats row → not counted');
    const empty = makeVictoryState([], {});
    assert.equal(resolveCountSource(empty, '0', 'shield-levels'), 0, 'empty victory pile → 0');
  });

  it('a player with no zones resolves to 0 (no throw)', () => {
    const gameState = makeVictoryState(['nick-fury#0'], { 'nick-fury#0': true });
    assert.equal(resolveCountSource(gameState, '99', 'shield-levels'), 0);
  });
});

describe('resolveCountSource victory-bystanders', () => {
  it('counts N victory-pile bystanders across both ext_id forms', () => {
    // 3 bystanders: 2 pile-bystander + 1 villain-deck form → 3.
    const gameState = makeStateWithVictory([
      BYSTANDER_EXT_ID,
      'bystander-villain-deck-03',
      BYSTANDER_EXT_ID,
    ]);

    assert.equal(
      resolveCountSource(gameState, '0', 'victory-bystanders'),
      3,
      'all three bystanders (both ext_id forms) must be counted',
    );
  });

  it('returns 0 when the victory pile holds no bystanders', () => {
    const gameState = makeStateWithVictory([]);

    assert.equal(
      resolveCountSource(gameState, '0', 'victory-bystanders'),
      0,
      'an empty victory pile must resolve to 0',
    );
  });

  it('excludes villain, henchman, and tactic victory-pile cards', () => {
    // Mixed victory pile: 2 bystanders + 3 non-bystander VP cards → 2.
    const gameState = makeStateWithVictory([
      BYSTANDER_EXT_ID,
      'core/villain/hydra/agent#0',
      'bystander-villain-deck-07',
      'core/henchman/doombot#1',
      'core/mastermind/red-skull/tactic-1#0',
    ]);

    assert.equal(
      resolveCountSource(gameState, '0', 'victory-bystanders'),
      2,
      'only the two bystanders count; villain/henchman/tactic VP cards are excluded',
    );
  });

  it('returns 0 when the player has no zones (defensive)', () => {
    const gameState = makeStateWithVictory([]);

    assert.equal(
      resolveCountSource(gameState, '99', 'victory-bystanders'),
      0,
      'a player with no zones must resolve to 0 (no throw)',
    );
  });
});

// ---------------------------------------------------------------------------
// unknown source (defensive totality)
// ---------------------------------------------------------------------------

describe('resolveCountSource unknown source', () => {
  it('returns 0 for an unrecognized source (defensive)', () => {
    const gameState = makeStateWithVictory([BYSTANDER_EXT_ID, BYSTANDER_EXT_ID]);

    // why: the union is closed, but a malformed hook could carry an unknown
    // source string; the resolver must be total and return 0 (no throw).
    const unknownSource = 'made-up-source' as HeroCountSource;

    assert.equal(
      resolveCountSource(gameState, '0', unknownSource),
      0,
      'an unknown source must resolve to 0',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-680 / D-24497 — per-count sources for five unmarked core heroes
// ---------------------------------------------------------------------------

/**
 * Builds a minimal state whose player "0" has an in-play zone plus the
 * cardTraits (heroClass/team) and cardStats (cost) the WP-680 sources read.
 *
 * @param inPlay - The in-play ext_ids for player "0".
 * @param cardTraits - Per-card heroClass/team.
 * @param cardStats - Per-card cost (only `cost` is read here).
 * @returns A minimal game state cast to LegendaryGameState.
 */
function makeStatePlayed(
  inPlay: string[],
  cardTraits: Record<string, { heroClass: string | null; team: string | null }>,
  cardStats: Record<string, { cost: number }>,
): LegendaryGameState {
  return {
    playerZones: {
      '0': { deck: [], hand: [], discard: [], inPlay, victory: [] },
    },
    cardTraits,
    cardStats,
  } as unknown as LegendaryGameState;
}

describe('resolveCountSource distinct-hero-classes-played-this-turn (WP-680)', () => {
  it('counts distinct hero classes and is SELF-INCLUSIVE (ignores triggeringCardId)', () => {
    const gameState = makeStatePlayed(
      ['perfect-teamwork', 'covert-op', 'another-tech'],
      {
        'perfect-teamwork': { heroClass: 'strength', team: 'avengers' },
        'covert-op': { heroClass: 'covert', team: null },
        'another-tech': { heroClass: 'strength', team: null },
      },
      {},
    );

    // why: distinct classes = {strength, covert} = 2; the duplicate 'strength'
    // counts once. Passing the triggering card must NOT change the count —
    // "for each color of Hero you have" includes this card (self-inclusive).
    assert.equal(
      resolveCountSource(gameState, '0', 'distinct-hero-classes-played-this-turn', 'perfect-teamwork'),
      2,
      'distinct classes are counted once each, self-inclusive',
    );
    assert.equal(
      resolveCountSource(gameState, '0', 'distinct-hero-classes-played-this-turn'),
      2,
      'omitting triggeringCardId yields the same self-inclusive count',
    );
  });

  it('ignores cards with no hero class (Officers/Sidekicks)', () => {
    const gameState = makeStatePlayed(
      ['tech-hero', 'shield-officer'],
      {
        'tech-hero': { heroClass: 'tech', team: null },
        'shield-officer': { heroClass: null, team: 'shield' },
      },
      {},
    );

    assert.equal(
      resolveCountSource(gameState, '0', 'distinct-hero-classes-played-this-turn'),
      1,
      'a no-class card contributes no color',
    );
  });
});

describe('resolveCountSource team-played sources (WP-680)', () => {
  it('avengers-played-this-turn counts OTHER Avengers, self-excluded, wrong team ignored', () => {
    const gameState = makeStatePlayed(
      ['a-day', 'iron-man', 'nick-fury'],
      {
        'a-day': { heroClass: 'covert', team: 'avengers' },
        'iron-man': { heroClass: 'tech', team: 'avengers' },
        'nick-fury': { heroClass: 'tech', team: 'shield' },
      },
      {},
    );

    // why: self-exclusive — the triggering 'a-day' is excluded; 'iron-man' counts,
    // 'nick-fury' (shield) does not.
    assert.equal(
      resolveCountSource(gameState, '0', 'avengers-played-this-turn', 'a-day'),
      1,
      'counts other Avengers only, excluding the triggering card',
    );
  });

  it('shield-heroes-played-this-turn counts OTHER S.H.I.E.L.D. cards, self-excluded', () => {
    const gameState = makeStatePlayed(
      ['legendary-commander', 'shield-officer', 'wolverine'],
      {
        'legendary-commander': { heroClass: 'strength', team: 'shield' },
        'shield-officer': { heroClass: null, team: 'shield' },
        'wolverine': { heroClass: 'instinct', team: 'x-men' },
      },
      {},
    );

    assert.equal(
      resolveCountSource(gameState, '0', 'shield-heroes-played-this-turn', 'legendary-commander'),
      1,
      'the S.H.I.E.L.D. Officer counts; the X-Men card does not; self excluded',
    );
  });

  it('shield-heroes-played-this-turn counts the teamless basic S.H.I.E.L.D. tokens (Jeff feedback — Legendary Commander)', () => {
    // why: the REAL Officer / Agent / Trooper tokens carry NO cardTraits row, so the
    // trait-only read used to miss them and Legendary Commander stayed at +0. Only
    // legendary-commander has a traits row here; the three tokens do not.
    const gameState = makeStatePlayed(
      ['legendary-commander', SHIELD_OFFICER_EXT_ID, SHIELD_AGENT_EXT_ID, SHIELD_TROOPER_EXT_ID],
      { 'legendary-commander': { heroClass: 'strength', team: 'shield' } },
      {},
    );

    assert.equal(
      resolveCountSource(gameState, '0', 'shield-heroes-played-this-turn', 'legendary-commander'),
      3,
      'a played Officer, Agent and Trooper each count as a shield Hero',
    );
  });
});

describe('resolveCountSource odd-cost-heroes-played-this-turn (WP-680)', () => {
  it('counts OTHER odd-cost cards; self-excluded; even and cost-0 ignored', () => {
    const gameState = makeStatePlayed(
      ['oddball', 'cost-three', 'cost-four', 'basic-agent'],
      {
        oddball: { heroClass: 'covert', team: null },
        'cost-three': { heroClass: 'tech', team: null },
        'cost-four': { heroClass: 'strength', team: null },
        'basic-agent': { heroClass: null, team: 'shield' },
      },
      {
        oddball: { cost: 5 },
        'cost-three': { cost: 3 },
        'cost-four': { cost: 4 },
        // basic-agent has no cardStats row → cost 0 → even → never counts
      },
    );

    // why: odd costs among OTHER cards = {cost-three (3)}; cost-four (even) and
    // basic-agent (no row → 0, even) excluded; oddball (5, odd) is the triggering
    // card and is self-excluded.
    assert.equal(
      resolveCountSource(gameState, '0', 'odd-cost-heroes-played-this-turn', 'oddball'),
      1,
      'only other odd-cost cards count',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-706 / D-24528 — explainCountSourceInputs (diagnostics-only counted inputs)
// ---------------------------------------------------------------------------

/**
 * Builds a minimal state whose player "0" has an in-play zone plus cardTraits that
 * can carry `heroClass` AND `heroClass2` (the dual-class case), and an optional
 * cardStats cost/icon map. The explain reads only these.
 *
 * @param inPlay - The in-play ext_ids for player "0".
 * @param cardTraits - Per-card heroClass / heroClass2 / team.
 * @param cardStats - Per-card cost + icon flags (only the read fields matter).
 * @returns A minimal game state cast to LegendaryGameState.
 */
function makeExplainState(
  inPlay: string[],
  cardTraits: Record<string, { heroClass: string | null; heroClass2?: string | null; team: string | null }>,
  cardStats: Record<string, { cost?: number; hasAttackIcon?: boolean; hasRecruitIcon?: boolean }> = {},
): LegendaryGameState {
  return {
    playerZones: {
      '0': { deck: [], hand: [], discard: [], inPlay, victory: [] },
    },
    cardTraits,
    cardStats,
  } as unknown as LegendaryGameState;
}

describe('explainCountSourceInputs — per-card played-this-turn sources (WP-706)', () => {
  it('returns the matched ext-ids and count === length for a cost-threshold source', () => {
    const gameState = makeExplainState(
      ['divine-lightning#0', 'worthy-ally#0', 'weak-ally#0'],
      {
        'divine-lightning#0': { heroClass: 'strength', team: null },
        'worthy-ally#0': { heroClass: 'tech', team: null },
        'weak-ally#0': { heroClass: 'covert', team: null },
      },
      {
        'divine-lightning#0': { cost: 5 },
        'worthy-ally#0': { cost: 6 },
        'weak-ally#0': { cost: 2 },
      },
    );

    // why: self-EXCLUSIVE — the triggering divine-lightning#0 is skipped; only the
    // other cost >= 5 card (worthy-ally#0) is collected.
    const inputs = explainCountSourceInputs(gameState, '0', 'worthy-cards-played-this-turn', 'divine-lightning#0');
    assert.deepStrictEqual(inputs, ['worthy-ally#0'], 'collects the other Worthy-making card');
    const count = resolveCountSource(gameState, '0', 'worthy-cards-played-this-turn', 'divine-lightning#0');
    assert.equal(count, inputs.length, 'count === countedInputs.length for a per-card source');
  });

  it('collects the OTHER team cards, self-excluded, matching the resolver count', () => {
    const gameState = makeExplainState(
      ['a-day#0', 'iron-man#0', 'nick-fury#0'],
      {
        'a-day#0': { heroClass: 'covert', team: 'avengers' },
        'iron-man#0': { heroClass: 'tech', team: 'avengers' },
        'nick-fury#0': { heroClass: 'tech', team: 'shield' },
      },
    );

    const inputs = explainCountSourceInputs(gameState, '0', 'avengers-played-this-turn', 'a-day#0');
    assert.deepStrictEqual(inputs, ['iron-man#0'], 'the other Avenger only, self-excluded');
    assert.equal(
      resolveCountSource(gameState, '0', 'avengers-played-this-turn', 'a-day#0'),
      inputs.length,
      'count === countedInputs.length',
    );
  });

  it('collects the OTHER attack-icon cards via the faithful icon flag', () => {
    const gameState = makeExplainState(
      ['sym#0', 'ally-a#0', 'ally-b#0'],
      {
        'sym#0': { heroClass: 'instinct', team: null },
        'ally-a#0': { heroClass: 'tech', team: null },
        'ally-b#0': { heroClass: 'covert', team: null },
      },
      {
        'sym#0': { hasAttackIcon: true, hasRecruitIcon: true },
        'ally-a#0': { hasAttackIcon: true, hasRecruitIcon: false },
        'ally-b#0': { hasAttackIcon: false, hasRecruitIcon: true },
      },
    );

    const inputs = explainCountSourceInputs(gameState, '0', 'attack-icon-played-this-turn', 'sym#0');
    assert.deepStrictEqual(inputs, ['ally-a#0'], 'only the other attack-icon card');
    assert.equal(
      resolveCountSource(gameState, '0', 'attack-icon-played-this-turn', 'sym#0'),
      inputs.length,
      'count === countedInputs.length',
    );
  });
});

describe('explainCountSourceInputs — victory-pile sources return [] (WP-706)', () => {
  it('returns [] for victory-bystanders (countedInputs omitted at the capture site)', () => {
    const gameState = makeStateWithVictory([BYSTANDER_EXT_ID, BYSTANDER_EXT_ID]);
    assert.deepStrictEqual(
      explainCountSourceInputs(gameState, '0', 'victory-bystanders'),
      [],
      'victory-pile source explains to no counted inputs',
    );
  });

  it('returns [] for shield-levels', () => {
    const gameState = makeStateWithVictory(['some-shield-card#0']);
    assert.deepStrictEqual(explainCountSourceInputs(gameState, '0', 'shield-levels'), []);
  });
});

describe('explainCountSourceInputs — distinct-hero-classes dual-class case (WP-706 / WP-703)', () => {
  it('includes a dual-class card whose colour is matched ONLY via heroClass2', () => {
    // why: the load-bearing WP-703 tie — a dual-class card contributes its second colour
    // via heroClass2 alone; explainCountSourceInputs must list that card so the heroClass2
    // contribution is live-observable. dual#0 has heroClass 'tech' (shared with tech#0) and
    // heroClass2 'covert' (unique) — its unique colour comes ONLY from heroClass2.
    const gameState = makeExplainState(
      ['tech#0', 'dual#0'],
      {
        'tech#0': { heroClass: 'tech', team: null },
        'dual#0': { heroClass: 'tech', heroClass2: 'covert', team: null },
      },
    );

    const inputs = explainCountSourceInputs(gameState, '0', 'distinct-hero-classes-played-this-turn');
    assert.ok(inputs.includes('dual#0'), 'the dual-class card appears in the counted inputs');
    assert.ok(inputs.includes('tech#0'), 'the single-class card appears too');

    // why: self-INCLUSIVE, distinct-colour rollup — count (distinct colours {tech,covert}=2)
    // <= the card-list length (2 here, but the invariant is count <= length, not ===).
    const count = resolveCountSource(gameState, '0', 'distinct-hero-classes-played-this-turn');
    assert.equal(count, 2, 'two distinct colours: tech + covert (covert only via heroClass2)');
    assert.ok(count <= inputs.length, 'distinct-class invariant: count <= countedInputs.length');
  });
});

describe('explainCountSourceInputs — resolver byte-identical guarantee (WP-706)', () => {
  it('resolveCountSource returns the identical integer with and without an explain call', () => {
    // why: the gameplay grant path is untouched — the explain is a SEPARATE read-only pass;
    // the resolver integer the grant uses must be byte-identical whether or not explain runs.
    const gameState = makeExplainState(
      ['a-day#0', 'iron-man#0', 'thor#0'],
      {
        'a-day#0': { heroClass: 'covert', team: 'avengers' },
        'iron-man#0': { heroClass: 'tech', team: 'avengers' },
        'thor#0': { heroClass: 'strength', team: 'avengers' },
      },
    );

    const before = resolveCountSource(gameState, '0', 'avengers-played-this-turn', 'a-day#0');
    const explained = explainCountSourceInputs(gameState, '0', 'avengers-played-this-turn', 'a-day#0');
    const after = resolveCountSource(gameState, '0', 'avengers-played-this-turn', 'a-day#0');

    assert.equal(before, after, 'resolver is unaffected by the explain pass');
    assert.equal(before, explained.length, 'and agrees with the explain length for a per-card source');
  });
});
