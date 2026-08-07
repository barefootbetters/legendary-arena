/**
 * parsePlayerIdentifier tests (WP-504 / EC-539).
 *
 * Pure discriminator: a well-formed UUID is an Account ID; `@jeff` /
 * `jeff` are handles (leading `@` stripped); empty / whitespace is
 * `null`. Pure `node:test` + `node:assert`; no network, no DOM.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePlayerIdentifier } from './playerIdentifier';

test('a well-formed UUID parses as an accountId', () => {
  assert.deepEqual(parsePlayerIdentifier('4f2219e4-1c3b-4a5d-8e6f-0a1b2c3d4e5f'), {
    kind: 'accountId',
    value: '4f2219e4-1c3b-4a5d-8e6f-0a1b2c3d4e5f',
  });
  // Upper-case hex is still an Account ID (case-insensitive shape).
  assert.deepEqual(parsePlayerIdentifier('4F2219E4-1C3B-4A5D-8E6F-0A1B2C3D4E5F'), {
    kind: 'accountId',
    value: '4F2219E4-1C3B-4A5D-8E6F-0A1B2C3D4E5F',
  });
});

test('a surrounding-whitespace UUID is trimmed then parsed as accountId', () => {
  assert.deepEqual(
    parsePlayerIdentifier('  4f2219e4-1c3b-4a5d-8e6f-0a1b2c3d4e5f  '),
    { kind: 'accountId', value: '4f2219e4-1c3b-4a5d-8e6f-0a1b2c3d4e5f' },
  );
});

test('@jeff parses as a handle with the leading @ stripped', () => {
  assert.deepEqual(parsePlayerIdentifier('@jeff'), {
    kind: 'handle',
    value: 'jeff',
  });
});

test('jeff (no @) parses as a handle', () => {
  assert.deepEqual(parsePlayerIdentifier('jeff'), {
    kind: 'handle',
    value: 'jeff',
  });
});

test('an empty or whitespace-only string parses as null', () => {
  assert.equal(parsePlayerIdentifier(''), null);
  assert.equal(parsePlayerIdentifier('   '), null);
  // A bare `@` with nothing after it is also nothing to send.
  assert.equal(parsePlayerIdentifier('@'), null);
});
