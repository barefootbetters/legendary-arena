import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadUiStateFixture, isFixtureName } from './index';

test('mid-turn fixture loads with all required UIState top-level keys', () => {
  const fixture = loadUiStateFixture('mid-turn');
  assert.ok('game' in fixture, 'mid-turn fixture is missing the `game` key');
  assert.ok('players' in fixture, 'mid-turn fixture is missing the `players` key');
  assert.ok('city' in fixture, 'mid-turn fixture is missing the `city` key');
  assert.ok('hq' in fixture, 'mid-turn fixture is missing the `hq` key');
  assert.ok('mastermind' in fixture, 'mid-turn fixture is missing the `mastermind` key');
  assert.ok('scheme' in fixture, 'mid-turn fixture is missing the `scheme` key');
  assert.ok('economy' in fixture, 'mid-turn fixture is missing the `economy` key');
  assert.ok('log' in fixture, 'mid-turn fixture is missing the `log` key');
});

test('mid-turn fixture omits the gameOver key entirely', () => {
  // why: `exactOptionalPropertyTypes: true` makes `{gameOver: null}` and
  // `{gameOver: undefined}` both non-assignable to `gameOver?: UIGameOverState`.
  // The only valid shape for an in-progress match is to omit the key.
  const fixture = loadUiStateFixture('mid-turn');
  assert.equal('gameOver' in fixture, false);
});

test('mid-turn fixture reports phase === "play"', () => {
  const fixture = loadUiStateFixture('mid-turn');
  assert.equal(fixture.game.phase, 'play');
});

test('endgame-win fixture reports gameOver.outcome === "win"', () => {
  const fixture = loadUiStateFixture('endgame-win');
  assert.ok(fixture.gameOver, 'endgame-win fixture must include a gameOver block');
  assert.equal(fixture.gameOver.outcome, 'win');
  assert.equal(fixture.game.phase, 'end');
});

test('endgame-loss fixture reports gameOver.outcome === "loss"', () => {
  const fixture = loadUiStateFixture('endgame-loss');
  assert.ok(fixture.gameOver, 'endgame-loss fixture must include a gameOver block');
  assert.equal(fixture.gameOver.outcome, 'loss');
  assert.equal(fixture.game.phase, 'end');
});

test('isFixtureName accepts the three known names', () => {
  assert.equal(isFixtureName('mid-turn'), true);
  assert.equal(isFixtureName('endgame-win'), true);
  assert.equal(isFixtureName('endgame-loss'), true);
});

test('isFixtureName rejects unknown and malformed names', () => {
  assert.equal(isFixtureName('not-a-fixture'), false);
  assert.equal(isFixtureName(''), false);
  assert.equal(isFixtureName('MID-TURN'), false);
  assert.equal(isFixtureName('mid-turn '), false);
});
