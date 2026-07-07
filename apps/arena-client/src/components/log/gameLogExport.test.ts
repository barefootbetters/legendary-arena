import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGameLogText, GAME_LOG_EXPORT_FILE_NAME } from './gameLogExport';

test('buildGameLogText: an empty log yields an empty string (no stray newline)', () => {
  assert.equal(buildGameLogText([]), '');
});

test('buildGameLogText: a single entry gets a trailing newline', () => {
  assert.equal(buildGameLogText(['only entry']), 'only entry\n');
});

test('buildGameLogText: multiple entries, one per line, chronological, trailing newline', () => {
  assert.equal(
    buildGameLogText(['first', 'second', 'third']),
    'first\nsecond\nthird\n',
  );
});

test('buildGameLogText: preserves entry text verbatim (no reordering or trimming)', () => {
  const log = ['  Player 0 fought "Sentinel".', 'Player 0 rescued 2 bystander(s).'];
  assert.equal(
    buildGameLogText(log),
    '  Player 0 fought "Sentinel".\nPlayer 0 rescued 2 bystander(s).\n',
  );
});

test('GAME_LOG_EXPORT_FILE_NAME is the plain-text log file name', () => {
  assert.equal(GAME_LOG_EXPORT_FILE_NAME, 'game-log.txt');
});
