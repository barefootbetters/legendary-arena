/**
 * Tests for the villain defeat-requirement gate logic (WP-292 / D-24076).
 *
 * Verifies getDefeatRequirement lookup and playerMeetsDefeatRequirement scope:
 * hand-hit, in-play-hit, discard/deck miss, no-hero miss, and team-vs-class
 * matching.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefeatRequirement,
  playerMeetsDefeatRequirement,
} from './villainDefeatRequirement.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { VillainDefeatRequirement } from '../rules/villainAbility.types.js';

/**
 * Builds a minimal game state for the gate helpers: one player's zones, a card
 * trait table, and an optional defeat-requirement table. Cast through unknown
 * because only the fields the helpers read are populated.
 */
function makeState(options: {
  hand?: CardExtId[];
  inPlay?: CardExtId[];
  discard?: CardExtId[];
  deck?: CardExtId[];
  traits?: Record<string, { heroClass: string | null; team: string | null }>;
  requirements?: Record<string, VillainDefeatRequirement>;
}): LegendaryGameState {
  const state = {
    playerZones: {
      '0': {
        deck: options.deck ?? [],
        hand: options.hand ?? [],
        discard: options.discard ?? [],
        inPlay: options.inPlay ?? [],
        victory: [],
      },
    },
    cardTraits: options.traits ?? {},
    ...(options.requirements ? { villainDefeatRequirements: options.requirements } : {}),
  };
  return state as unknown as LegendaryGameState;
}

// A small trait corpus: an X-Men strength hero card, a non-X-Men covert card,
// and an unaffiliated card matching neither requirement.
const TRAITS = {
  'core/cyclops/optic-blast#0': { heroClass: 'ranged', team: 'x-men' },
  'antm/black-knight/flying-steed#0': { heroClass: 'covert', team: 'avengers' },
  'starting-shield-agent': { heroClass: null, team: null },
};

const TEAM_REQ: VillainDefeatRequirement = { kind: 'team', value: 'x-men' };
const CLASS_REQ: VillainDefeatRequirement = { kind: 'hero-class', value: 'covert' };

describe('getDefeatRequirement', () => {
  it('returns the requirement for a marked villain', () => {
    const state = makeState({
      requirements: { 'core-villain-brotherhood-blob-01': TEAM_REQ },
    });
    assert.deepStrictEqual(
      getDefeatRequirement(state, 'core-villain-brotherhood-blob-01' as CardExtId),
      TEAM_REQ,
    );
  });

  it('returns null for an unmarked villain', () => {
    const state = makeState({
      requirements: { 'core-villain-brotherhood-blob-01': TEAM_REQ },
    });
    assert.equal(
      getDefeatRequirement(state, 'core-villain-skrulls-super-skrull-00' as CardExtId),
      null,
    );
  });

  it('returns null when the requirements table is absent', () => {
    const state = makeState({});
    assert.equal(
      getDefeatRequirement(state, 'core-villain-brotherhood-blob-01' as CardExtId),
      null,
    );
  });
});

describe('playerMeetsDefeatRequirement — zone scope (hand or in play only)', () => {
  it('is satisfied by a qualifying Hero in hand', () => {
    const state = makeState({
      hand: ['core/cyclops/optic-blast#0' as CardExtId],
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), true);
  });

  it('is satisfied by a qualifying Hero in play', () => {
    const state = makeState({
      inPlay: ['core/cyclops/optic-blast#0' as CardExtId],
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), true);
  });

  it('is NOT satisfied when the only qualifying Hero is in discard', () => {
    const state = makeState({
      discard: ['core/cyclops/optic-blast#0' as CardExtId],
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), false);
  });

  it('is NOT satisfied when the only qualifying Hero is in the deck', () => {
    const state = makeState({
      deck: ['core/cyclops/optic-blast#0' as CardExtId],
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), false);
  });

  it('is NOT satisfied when the player holds no qualifying Hero', () => {
    const state = makeState({
      hand: ['starting-shield-agent' as CardExtId],
      inPlay: ['antm/black-knight/flying-steed#0' as CardExtId],
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), false);
  });

  it('returns false for an unknown player id', () => {
    const state = makeState({ traits: TRAITS });
    assert.equal(playerMeetsDefeatRequirement(state, '7', TEAM_REQ), false);
  });
});

describe('playerMeetsDefeatRequirement — team vs hero-class matching', () => {
  it("a 'team' requirement matches by team regardless of class", () => {
    const state = makeState({
      hand: ['core/cyclops/optic-blast#0' as CardExtId], // ranged class, x-men team
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), true);
  });

  it("a 'hero-class' requirement matches by class regardless of team", () => {
    const state = makeState({
      inPlay: ['antm/black-knight/flying-steed#0' as CardExtId], // covert class, avengers team
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', CLASS_REQ), true);
  });

  it("a 'hero-class:covert' requirement is NOT met by an X-Men non-covert Hero", () => {
    const state = makeState({
      hand: ['core/cyclops/optic-blast#0' as CardExtId], // ranged, x-men → not covert
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', CLASS_REQ), false);
  });
});
