/**
 * Tests for the count-aware setup requirement labels.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatSetupCount, setupCountNounForField } from './setupCountLabels.js';

describe('formatSetupCount', () => {
  it('uses the singular for a count of 1', () => {
    assert.equal(formatSetupCount(1, 'villainGroup'), '1 villain group');
    assert.equal(formatSetupCount(1, 'henchmanGroup'), '1 henchman group');
    assert.equal(formatSetupCount(1, 'hero'), '1 hero');
    assert.equal(formatSetupCount(1, 'villainDeckBystander'), '1 villain-deck bystander');
  });

  it('uses the plural, including the irregular ones, for any other count', () => {
    assert.equal(formatSetupCount(2, 'villainGroup'), '2 villain groups');
    assert.equal(formatSetupCount(2, 'henchmanGroup'), '2 henchmen groups');
    assert.equal(formatSetupCount(5, 'hero'), '5 heroes');
    assert.equal(formatSetupCount(0, 'villainDeckBystander'), '0 villain-deck bystanders');
  });
});

describe('setupCountNounForField', () => {
  it('maps each mismatch field to its noun', () => {
    assert.equal(setupCountNounForField('villainGroupIds'), 'villainGroup');
    assert.equal(setupCountNounForField('henchmanGroupIds'), 'henchmanGroup');
    assert.equal(setupCountNounForField('heroDeckIds'), 'hero');
  });
});
