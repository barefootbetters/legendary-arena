/**
 * Unit tests for the dynamic victory-point resolver (WP-546 / D-24355 Supreme HYDRA;
 * WP-553 / D-24362 Ultron).
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDynamicVillainVictoryPoints,
  countTechHeroesAmongCards,
  isHydraGroupVillain,
  SUPREME_HYDRA_BASE_VP,
  SUPREME_HYDRA_BONUS_PER_OTHER_HYDRA_VILLAIN,
  ULTRON_BASE_VP,
} from './dynamicVictoryPoints.js';
import type { CardExtId } from '../state/zones.types.js';

// Realistic villain instance ext_ids: {setAbbr}-villain-{groupSlug}-{cardSlug}-{copy}.
const SUPREME_HYDRA: CardExtId = 'core-villain-hydra-supreme-hydra-01' as CardExtId;
const HYDRA_OTHER_A: CardExtId = 'core-villain-hydra-hydra-agent-01' as CardExtId;
const HYDRA_OTHER_B: CardExtId = 'core-villain-hydra-viper-01' as CardExtId;
const NON_HYDRA_VILLAIN: CardExtId = 'core-villain-enemies-of-asgard-loki-01' as CardExtId;
const ULTRON: CardExtId = 'core-villain-masters-of-evil-ultron-01' as CardExtId;

// The Supreme HYDRA cases carry no tech-Hero context, so the two Ultron-only args
// are inert for them: an empty card list and an empty trait map.
const NO_PLAYER_CARDS: readonly CardExtId[] = [];
const NO_TRAITS: Record<CardExtId, { heroClass: string | null; team: string | null }> = {};

// Tech-Hero trait fixtures for the Ultron cases.
const TECH_HERO_A: CardExtId = 'core-hero-iron-man-repulsor-blast-01' as CardExtId;
const TECH_HERO_B: CardExtId = 'core-hero-iron-man-endless-intervention-01' as CardExtId;
const NON_TECH_HERO: CardExtId = 'core-hero-spider-man-the-amazing-spider-man-01' as CardExtId;
const SHIELD_STARTER: CardExtId = 'core-hero-s-h-i-e-l-d-agent-01' as CardExtId;
const TECH_HERO_TRAITS: Record<
  CardExtId,
  { heroClass: string | null; team: string | null }
> = {
  [TECH_HERO_A]: { heroClass: 'tech', team: 'avengers' },
  [TECH_HERO_B]: { heroClass: 'tech', team: 'avengers' },
  [NON_TECH_HERO]: { heroClass: 'covert', team: 'spider-friends' },
  [SHIELD_STARTER]: { heroClass: null, team: null },
};

describe('isHydraGroupVillain', () => {
  it('recognizes HYDRA-group villain ext_ids by the -villain-hydra- segment', () => {
    assert.strictEqual(isHydraGroupVillain(SUPREME_HYDRA), true);
    assert.strictEqual(isHydraGroupVillain(HYDRA_OTHER_A), true);
  });

  it('rejects a non-HYDRA villain', () => {
    assert.strictEqual(isHydraGroupVillain(NON_HYDRA_VILLAIN), false);
  });

  it('does not match a bare "hydra" substring that is not a -villain-hydra- group', () => {
    // A hero or henchman ext_id containing "hydra" elsewhere must not count.
    assert.strictEqual(isHydraGroupVillain('core-henchman-hydra-armies-01' as CardExtId), false);
  });
});

describe('computeDynamicVillainVictoryPoints — Supreme HYDRA (D-24355)', () => {
  it('Supreme HYDRA with 0 other HYDRA villains scores the base 3 VP', () => {
    const victoryPile: CardExtId[] = [SUPREME_HYDRA];
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(SUPREME_HYDRA, victoryPile, NO_PLAYER_CARDS, NO_TRAITS),
      SUPREME_HYDRA_BASE_VP,
    );
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(SUPREME_HYDRA, victoryPile, NO_PLAYER_CARDS, NO_TRAITS),
      3,
    );
  });

  it('Supreme HYDRA with 1 other HYDRA villain scores 6 VP', () => {
    const victoryPile: CardExtId[] = [SUPREME_HYDRA, HYDRA_OTHER_A];
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(SUPREME_HYDRA, victoryPile, NO_PLAYER_CARDS, NO_TRAITS),
      6,
    );
  });

  it('Supreme HYDRA with 2 other HYDRA villains scores 9 VP', () => {
    const victoryPile: CardExtId[] = [SUPREME_HYDRA, HYDRA_OTHER_A, HYDRA_OTHER_B];
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(SUPREME_HYDRA, victoryPile, NO_PLAYER_CARDS, NO_TRAITS),
      SUPREME_HYDRA_BASE_VP + SUPREME_HYDRA_BONUS_PER_OTHER_HYDRA_VILLAIN * 2,
    );
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(SUPREME_HYDRA, victoryPile, NO_PLAYER_CARDS, NO_TRAITS),
      9,
    );
  });

  it('non-HYDRA villains in the pile do not count toward the bonus (base 3 only)', () => {
    const victoryPile: CardExtId[] = [SUPREME_HYDRA, NON_HYDRA_VILLAIN, NON_HYDRA_VILLAIN];
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(SUPREME_HYDRA, victoryPile, NO_PLAYER_CARDS, NO_TRAITS),
      3,
    );
  });

  it('returns null for a non-modifier villain (caller uses the printed/fallback path)', () => {
    const victoryPile: CardExtId[] = [NON_HYDRA_VILLAIN, HYDRA_OTHER_A];
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(NON_HYDRA_VILLAIN, victoryPile, NO_PLAYER_CARDS, NO_TRAITS),
      null,
    );
  });

  it('clamps to base 3 defensively when Supreme HYDRA is scored against an empty pile', () => {
    // Defensive: in practice this card is always in its own victory pile when scored.
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(SUPREME_HYDRA, [], NO_PLAYER_CARDS, NO_TRAITS),
      3,
    );
  });
});

describe('countTechHeroesAmongCards', () => {
  it('counts only cards whose heroClass is tech', () => {
    const cardIds = [TECH_HERO_A, TECH_HERO_B, NON_TECH_HERO, SHIELD_STARTER];
    assert.strictEqual(countTechHeroesAmongCards(cardIds, TECH_HERO_TRAITS), 2);
  });

  it('returns 0 when no cards are tech Heroes', () => {
    assert.strictEqual(
      countTechHeroesAmongCards([NON_TECH_HERO, SHIELD_STARTER], TECH_HERO_TRAITS),
      0,
    );
  });

  it('ignores cards absent from the trait map (villains, wounds, bystanders)', () => {
    const cardIds = [ULTRON, NON_HYDRA_VILLAIN, TECH_HERO_A];
    assert.strictEqual(countTechHeroesAmongCards(cardIds, TECH_HERO_TRAITS), 1);
  });

  it('returns 0 for an empty card list', () => {
    assert.strictEqual(countTechHeroesAmongCards([], TECH_HERO_TRAITS), 0);
  });
});

describe('computeDynamicVillainVictoryPoints — Ultron (D-24362)', () => {
  it('Ultron with 0 tech Heroes among the player cards scores the base 2 VP', () => {
    // No tech Heroes anywhere — base 2 only.
    const allPlayerCardIds: CardExtId[] = [ULTRON, NON_TECH_HERO, SHIELD_STARTER];
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(ULTRON, [ULTRON], allPlayerCardIds, TECH_HERO_TRAITS),
      ULTRON_BASE_VP,
    );
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(ULTRON, [ULTRON], allPlayerCardIds, TECH_HERO_TRAITS),
      2,
    );
  });

  it('Ultron with 1 tech Hero scores 3 VP', () => {
    const allPlayerCardIds: CardExtId[] = [ULTRON, TECH_HERO_A, NON_TECH_HERO];
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(ULTRON, [ULTRON], allPlayerCardIds, TECH_HERO_TRAITS),
      3,
    );
  });

  it('Ultron with N tech Heroes scores 2 + N (counted across ALL zones, not just victory)', () => {
    // Two tech Heroes spread across the player's card pool; the victory pile holds
    // only Ultron itself. Ultron must still count both tech Heroes → 2 + 2 = 4.
    const allPlayerCardIds: CardExtId[] = [ULTRON, TECH_HERO_A, TECH_HERO_B, SHIELD_STARTER];
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(ULTRON, [ULTRON], allPlayerCardIds, TECH_HERO_TRAITS),
      2 + 2,
    );
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(ULTRON, [ULTRON], allPlayerCardIds, TECH_HERO_TRAITS),
      4,
    );
  });

  it('a victory pile with no tech Heroes still scores Ultron the base 2', () => {
    // The victory pile carries no tech Heroes; the resolver reads the full card list,
    // which here also carries none → base 2.
    const allPlayerCardIds: CardExtId[] = [ULTRON];
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(ULTRON, [ULTRON], allPlayerCardIds, TECH_HERO_TRAITS),
      ULTRON_BASE_VP,
    );
  });

  it('returns null for a non-Ultron / non-modifier villain', () => {
    const allPlayerCardIds: CardExtId[] = [NON_HYDRA_VILLAIN, TECH_HERO_A];
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(
        NON_HYDRA_VILLAIN,
        [NON_HYDRA_VILLAIN],
        allPlayerCardIds,
        TECH_HERO_TRAITS,
      ),
      null,
    );
  });
});
