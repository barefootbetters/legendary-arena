import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGameLogFileName, buildGameLogText } from './gameLogExport';

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

// why: the game-log export file name intentionally changed from the fixed
// `game-log.txt` to a match-scoped, timestamped name — a later export with the
// same setup overwrote an earlier match's evidence under the fixed name.
test('buildGameLogFileName: a match id and the export timestamp name the .txt file', () => {
  assert.equal(
    buildGameLogFileName('room-7', 1717848000000),
    'legendary-arena-game-log-room-7-1717848000000.txt',
  );
});

test('buildGameLogFileName: / and \\ in the match id become - (single filename segment)', () => {
  assert.equal(buildGameLogFileName('a/b\\c', 42), 'legendary-arena-game-log-a-b-c-42.txt');
});

test('buildGameLogFileName: an absent or empty match id becomes no-match', () => {
  assert.equal(buildGameLogFileName(null, 42), 'legendary-arena-game-log-no-match-42.txt');
  assert.equal(buildGameLogFileName('', 42), 'legendary-arena-game-log-no-match-42.txt');
});
