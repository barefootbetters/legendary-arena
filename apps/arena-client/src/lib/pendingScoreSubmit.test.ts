/**
 * pendingScoreSubmit + LoginPage post-sign-in destination tests (D-24630).
 */

import '../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLiveReturnUrl,
  clearPendingScoreSubmit,
  hasPendingScoreSubmitFor,
  parseLiveSearch,
  readPendingScoreSubmit,
  stashPendingScoreSubmit,
} from './pendingScoreSubmit';
import { resolveSignInDestination } from '../pages/LoginPage.vue';

const LIVE_SEARCH = '?match=match-1&player=0&credentials=cred-xyz';

describe('pendingScoreSubmit', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('round-trips a stash taken from the live URL', () => {
    stashPendingScoreSubmit('match-1', LIVE_SEARCH);
    assert.deepEqual(readPendingScoreSubmit(), {
      matchId: 'match-1',
      playerId: '0',
      credentials: 'cred-xyz',
    });
    assert.equal(hasPendingScoreSubmitFor('match-1'), true);
    assert.equal(hasPendingScoreSubmitFor('match-2'), false);
    clearPendingScoreSubmit();
    assert.equal(readPendingScoreSubmit(), null);
  });

  test('stashes nothing when the URL is not this match or is incomplete', () => {
    stashPendingScoreSubmit('match-2', LIVE_SEARCH);
    stashPendingScoreSubmit('match-1', '?match=match-1&player=0');
    assert.equal(sessionStorage.length, 0);
  });

  test('a malformed stored entry reads as absent', () => {
    sessionStorage.setItem('legendary-arena:pending-score-submit', '{not json');
    assert.equal(readPendingScoreSubmit(), null);
    sessionStorage.setItem('legendary-arena:pending-score-submit', '{"matchId":"m"}');
    assert.equal(readPendingScoreSubmit(), null);
  });

  test('the return URL is rebuilt from the three fields and parses back identically', () => {
    const pending = { matchId: 'm 1', playerId: '0', credentials: 'a&b=c' };
    const url = buildLiveReturnUrl(pending);
    assert.ok(url.startsWith('?match='), 'always a same-origin relative query');
    assert.deepEqual(parseLiveSearch(url), pending);
  });
});

describe('LoginPage resolveSignInDestination', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('returnTo=live returns to the stashed match', () => {
    stashPendingScoreSubmit('match-1', LIVE_SEARCH);
    assert.equal(
      resolveSignInDestination('live'),
      '?match=match-1&player=0&credentials=cred-xyz',
    );
  });

  test('returnTo=live with no stash falls back to the lobby', () => {
    assert.equal(resolveSignInDestination('live'), '?route=');
  });

  test('guarded routes and null are unchanged', () => {
    assert.equal(resolveSignInDestination('me'), '?route=me');
    assert.equal(resolveSignInDestination('admin-billing'), '?route=admin-billing');
    assert.equal(resolveSignInDestination(null), '?route=');
  });
});
