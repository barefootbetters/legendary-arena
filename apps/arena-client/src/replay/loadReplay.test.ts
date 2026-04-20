import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseReplayJson } from './loadReplay';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(
  HERE,
  '..',
  'fixtures',
  'replay',
  'three-turn-sample.json',
);

test('parseReplayJson parses the committed three-turn-sample fixture', async () => {
  const raw = await readFile(FIXTURE_PATH, 'utf8');

  const sequence = parseReplayJson(raw, 'three-turn-sample.json');

  assert.equal(sequence.version, 1);
  assert.ok(Array.isArray(sequence.snapshots));
  assert.ok(sequence.snapshots.length >= 6 && sequence.snapshots.length <= 12);
  assert.equal(sequence.metadata?.matchId, 'wp064-three-turn-sample-match');
});

test('parseReplayJson throws the locked template when version is not the literal 1', () => {
  const raw = JSON.stringify({ version: 2, snapshots: [{}] });

  assert.throws(
    () => parseReplayJson(raw, 'bad-version.json'),
    {
      message:
        'Replay file bad-version.json field "version" must be the literal 1; received 2.',
    },
  );
});

test('parseReplayJson uses the in-memory source label when source is omitted', () => {
  const raw = JSON.stringify({ version: 'not-a-number', snapshots: [{}] });

  assert.throws(
    () => parseReplayJson(raw),
    {
      message:
        'Replay file in-memory field "version" must be the literal 1; received "not-a-number".',
    },
  );
});

test('parseReplayJson throws the locked template when snapshots is missing', () => {
  const raw = JSON.stringify({ version: 1 });

  assert.throws(
    () => parseReplayJson(raw, 'no-snapshots.json'),
    {
      message:
        'Replay file no-snapshots.json is missing required field "snapshots".',
    },
  );
});

test('parseReplayJson throws the locked template when snapshots is an empty array', () => {
  const raw = JSON.stringify({ version: 1, snapshots: [] });

  assert.throws(
    () => parseReplayJson(raw, 'empty-snapshots.json'),
    {
      message:
        'Replay file empty-snapshots.json field "snapshots" must contain at least one UIState; received an empty array.',
    },
  );
});

test('parseReplayJson surfaces a JSON.parse failure for malformed input', () => {
  assert.throws(
    () => parseReplayJson('{not json', 'broken.json'),
    /JSON|Unexpected/,
  );
});
