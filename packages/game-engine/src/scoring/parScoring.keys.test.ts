/**
 * PAR scoring identity-key unit tests (WP-048).
 *
 * Covers buildScenarioKey and buildTeamKey. Uses node:test and node:assert
 * only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildScenarioKey, buildTeamKey } from './parScoring.keys.js';

describe('parScoring keys (WP-048)', () => {
  it('buildScenarioKey with unsorted villain slugs produces a sorted, stable key', () => {
    const key = buildScenarioKey('midtown-bank-robbery', 'red-skull', [
      'masters-of-evil',
      'hydra',
    ]);

    assert.strictEqual(
      key,
      'midtown-bank-robbery::red-skull::hydra+masters-of-evil',
    );
  });

  it('buildScenarioKey with a single villain group joins without a separator', () => {
    const key = buildScenarioKey('negative-zone-prison-breakout', 'loki', [
      'brotherhood',
    ]);

    assert.strictEqual(
      key,
      'negative-zone-prison-breakout::loki::brotherhood',
    );
  });

  it('buildTeamKey with unsorted hero slugs produces a sorted, stable key', () => {
    const key = buildTeamKey([
      'wolverine',
      'spider-man',
      'iron-man',
      'captain-america',
    ]);

    assert.strictEqual(
      key,
      'captain-america+iron-man+spider-man+wolverine',
    );
  });

  it('key stability: same inputs always produce the same output across repeated calls', () => {
    const scenarioInputsA = {
      scheme: 'midtown-bank-robbery',
      mastermind: 'red-skull',
      villains: ['hydra', 'masters-of-evil'],
    };
    const scenarioInputsB = {
      scheme: 'midtown-bank-robbery',
      mastermind: 'red-skull',
      villains: ['masters-of-evil', 'hydra'],
    };
    const teamInputsA = ['iron-man', 'captain-america'];
    const teamInputsB = ['captain-america', 'iron-man'];

    const scenarioKeyA = buildScenarioKey(
      scenarioInputsA.scheme,
      scenarioInputsA.mastermind,
      scenarioInputsA.villains,
    );
    const scenarioKeyB = buildScenarioKey(
      scenarioInputsB.scheme,
      scenarioInputsB.mastermind,
      scenarioInputsB.villains,
    );
    const scenarioKeyRepeat = buildScenarioKey(
      scenarioInputsA.scheme,
      scenarioInputsA.mastermind,
      scenarioInputsA.villains,
    );

    const teamKeyA = buildTeamKey(teamInputsA);
    const teamKeyB = buildTeamKey(teamInputsB);
    const teamKeyRepeat = buildTeamKey(teamInputsA);

    assert.strictEqual(scenarioKeyA, scenarioKeyB);
    assert.strictEqual(scenarioKeyA, scenarioKeyRepeat);
    assert.strictEqual(teamKeyA, teamKeyB);
    assert.strictEqual(teamKeyA, teamKeyRepeat);
  });
});
