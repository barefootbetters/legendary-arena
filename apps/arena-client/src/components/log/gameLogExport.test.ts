import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGameLogText, GAME_LOG_EXPORT_FILE_NAME } from './gameLogExport';

test('buildGameLogText: an empty log yields an empty string (no stray newline)', () => {
  assert.equal(buildGameLogText([]), '');
});

test('buildGameLogText: a single entry gets a trailing newline', () => {
  assert.equal(buildGameLogText([{ text: 'only entry', outcome: 'neutral' }]), 'only entry\n');
});

test('buildGameLogText: multiple entries, one per line, chronological, trailing newline', () => {
  assert.equal(
    buildGameLogText([
      { text: 'first', outcome: 'neutral' },
      { text: 'second', outcome: 'neutral' },
      { text: 'third', outcome: 'neutral' },
    ]),
    'first\nsecond\nthird\n',
  );
});

test('buildGameLogText: preserves entry text verbatim (no reordering or trimming)', () => {
  const log = [
    { text: '  Player 0 fought "Sentinel".', outcome: 'neutral' as const },
    { text: 'Player 0 rescued 2 bystander(s).', outcome: 'neutral' as const },
  ];
  assert.equal(
    buildGameLogText(log),
    '  Player 0 fought "Sentinel".\nPlayer 0 rescued 2 bystander(s).\n',
  );
});

test('buildGameLogText: non-neutral lines get a leading [outcome] tag; neutral stays untagged (WP-435)', () => {
  assert.equal(
    buildGameLogText([
      { text: 'Player 0 played Nightcrawler.', outcome: 'neutral' as const },
      { text: 'Player 0 drew 1 card(s) from Quick Draw.', outcome: 'applied' as const },
      { text: 'Player 1 drew 1 of 2 card(s) — deck and discard empty.', outcome: 'partial' as const },
      { text: "Player 1's Team Player ability did not activate.", outcome: 'blocked' as const },
    ]),
    'Player 0 played Nightcrawler.\n' +
      '[applied] Player 0 drew 1 card(s) from Quick Draw.\n' +
      '[partial] Player 1 drew 1 of 2 card(s) — deck and discard empty.\n' +
      "[blocked] Player 1's Team Player ability did not activate.\n",
  );
});

test('GAME_LOG_EXPORT_FILE_NAME is the plain-text log file name', () => {
  assert.equal(GAME_LOG_EXPORT_FILE_NAME, 'game-log.txt');
});
