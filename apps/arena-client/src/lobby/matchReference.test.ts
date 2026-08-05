import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseMatchReference } from './matchReference';

test('parseMatchReference returns a bare match ID unchanged', () => {
  assert.equal(parseMatchReference('KdHnMXaOPin'), 'KdHnMXaOPin');
});

test('parseMatchReference trims surrounding whitespace on a bare ID', () => {
  assert.equal(parseMatchReference('  KdHnMXaOPin  '), 'KdHnMXaOPin');
});

test('parseMatchReference extracts the match param from a full invite link', () => {
  assert.equal(
    parseMatchReference('https://play.legendary-arena.com/?route=lobby&match=KdHnMXaOPin'),
    'KdHnMXaOPin',
  );
});

test('parseMatchReference extracts the match param from a query-only string', () => {
  assert.equal(
    parseMatchReference('?route=lobby&match=KdHnMXaOPin'),
    'KdHnMXaOPin',
  );
});

test('parseMatchReference strips a trailing URL fragment from the match param', () => {
  assert.equal(
    parseMatchReference('https://play.legendary-arena.com/?match=KdHnMXaOPin#board'),
    'KdHnMXaOPin',
  );
});

test('parseMatchReference returns null for empty or whitespace-only input', () => {
  assert.equal(parseMatchReference(''), null);
  assert.equal(parseMatchReference('   '), null);
});

test('parseMatchReference returns null for a URL with no match param', () => {
  assert.equal(
    parseMatchReference('https://play.legendary-arena.com/?route=lobby'),
    null,
  );
});

test('parseMatchReference returns null for a URL whose match param is empty', () => {
  assert.equal(parseMatchReference('?route=lobby&match='), null);
});

test('parseMatchReference returns null for a bare token with disallowed characters', () => {
  // why: a token with a space or slash is not a valid nanoid match ID; reject
  // it as malformed rather than firing a guaranteed-404 fetch.
  assert.equal(parseMatchReference('not a match id'), null);
  assert.equal(parseMatchReference('foo/bar'), null);
});
