import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GITHUB_ACTIONS_ALLOWANCES,
  GITHUB_ACTIONS_DAYS_ELAPSED,
  GITHUB_ACTIONS_DAYS_IN_CYCLE,
  projectGitHubActionsAllowance,
  type GitHubActionsAllowance,
} from './githubActionsUsage.js';

/**
 * Build a test allowance with the given minutes used against 2,000 included.
 */
function makeAllowance(minutesUsed: number): GitHubActionsAllowance {
  return {
    account: 'test',
    description: 'test allowance',
    minutesUsed,
    includedMinutes: 2000,
    budgetCents: null,
    isLegendaryArenaCost: false,
  };
}

test('the studio account projects to about 961 minutes over, about $5.77', () => {
  const studio = GITHUB_ACTIONS_ALLOWANCES.find((allowance) => !allowance.isLegendaryArenaCost);
  assert.ok(studio, 'Expected a non-game (studio) allowance in GITHUB_ACTIONS_ALLOWANCES.');
  const projection = projectGitHubActionsAllowance(studio);
  // 1,815 minutes over 19 days is ~95.5 a day; 31 days of that is 2,961.
  assert.equal(projection.projectedMinutes, 2961);
  assert.equal(projection.overageMinutes, 961);
  // 961 minutes at $0.006 is $5.766, rounded to 577 cents.
  assert.equal(projection.overageCents, 577);
});

test('the game organization stays inside its included minutes and costs $0', () => {
  const game = GITHUB_ACTIONS_ALLOWANCES.find((allowance) => allowance.isLegendaryArenaCost);
  assert.ok(game, 'Expected a Legendary Arena allowance in GITHUB_ACTIONS_ALLOWANCES.');
  const projection = projectGitHubActionsAllowance(game);
  assert.equal(projection.overageMinutes, 0);
  assert.equal(projection.overageCents, 0);
});

test('a projection at or under the included minutes has no overage', () => {
  const minutesAtLimit = Math.floor(
    (2000 * GITHUB_ACTIONS_DAYS_ELAPSED) / GITHUB_ACTIONS_DAYS_IN_CYCLE,
  );
  const projection = projectGitHubActionsAllowance(makeAllowance(minutesAtLimit));
  assert.ok(projection.projectedMinutes <= 2000);
  assert.equal(projection.overageMinutes, 0);
  assert.equal(projection.overageCents, 0);
});

test('the snapshot covers the elapsed part of one billing cycle', () => {
  assert.ok(GITHUB_ACTIONS_DAYS_ELAPSED > 0);
  assert.ok(GITHUB_ACTIONS_DAYS_ELAPSED <= GITHUB_ACTIONS_DAYS_IN_CYCLE);
});
