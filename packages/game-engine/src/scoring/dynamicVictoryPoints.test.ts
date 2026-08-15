/**
 * Unit tests for the Supreme HYDRA dynamic victory-point resolver (WP-546 / D-24355).
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDynamicVillainVictoryPoints,
  isHydraGroupVillain,
  SUPREME_HYDRA_BASE_VP,
  SUPREME_HYDRA_BONUS_PER_OTHER_HYDRA_VILLAIN,
} from './dynamicVictoryPoints.js';
import type { CardExtId } from '../state/zones.types.js';

// Realistic villain instance ext_ids: {setAbbr}-villain-{groupSlug}-{cardSlug}-{copy}.
const SUPREME_HYDRA: CardExtId = 'core-villain-hydra-supreme-hydra-01' as CardExtId;
const HYDRA_OTHER_A: CardExtId = 'core-villain-hydra-hydra-agent-01' as CardExtId;
const HYDRA_OTHER_B: CardExtId = 'core-villain-hydra-viper-01' as CardExtId;
const NON_HYDRA_VILLAIN: CardExtId = 'core-villain-enemies-of-asgard-loki-01' as CardExtId;

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

describe('computeDynamicVillainVictoryPoints', () => {
  it('Supreme HYDRA with 0 other HYDRA villains scores the base 3 VP', () => {
    const victoryPile: CardExtId[] = [SUPREME_HYDRA];
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(SUPREME_HYDRA, victoryPile),
      SUPREME_HYDRA_BASE_VP,
    );
    assert.strictEqual(computeDynamicVillainVictoryPoints(SUPREME_HYDRA, victoryPile), 3);
  });

  it('Supreme HYDRA with 1 other HYDRA villain scores 6 VP', () => {
    const victoryPile: CardExtId[] = [SUPREME_HYDRA, HYDRA_OTHER_A];
    assert.strictEqual(computeDynamicVillainVictoryPoints(SUPREME_HYDRA, victoryPile), 6);
  });

  it('Supreme HYDRA with 2 other HYDRA villains scores 9 VP', () => {
    const victoryPile: CardExtId[] = [SUPREME_HYDRA, HYDRA_OTHER_A, HYDRA_OTHER_B];
    assert.strictEqual(
      computeDynamicVillainVictoryPoints(SUPREME_HYDRA, victoryPile),
      SUPREME_HYDRA_BASE_VP + SUPREME_HYDRA_BONUS_PER_OTHER_HYDRA_VILLAIN * 2,
    );
    assert.strictEqual(computeDynamicVillainVictoryPoints(SUPREME_HYDRA, victoryPile), 9);
  });

  it('non-HYDRA villains in the pile do not count toward the bonus (base 3 only)', () => {
    const victoryPile: CardExtId[] = [SUPREME_HYDRA, NON_HYDRA_VILLAIN, NON_HYDRA_VILLAIN];
    assert.strictEqual(computeDynamicVillainVictoryPoints(SUPREME_HYDRA, victoryPile), 3);
  });

  it('returns null for a non-modifier villain (caller uses the printed/fallback path)', () => {
    const victoryPile: CardExtId[] = [NON_HYDRA_VILLAIN, HYDRA_OTHER_A];
    assert.strictEqual(computeDynamicVillainVictoryPoints(NON_HYDRA_VILLAIN, victoryPile), null);
  });

  it('clamps to base 3 defensively when Supreme HYDRA is scored against an empty pile', () => {
    // Defensive: in practice this card is always in its own victory pile when scored.
    assert.strictEqual(computeDynamicVillainVictoryPoints(SUPREME_HYDRA, []), 3);
  });
});
