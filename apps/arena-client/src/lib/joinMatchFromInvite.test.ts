/**
 * joinMatchFromInvite tests (WP-366 / EC-396).
 *
 * The orchestration takes injected list/join/navigate deps, so every branch is
 * exercised with fakes — no server, no jsdom navigation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  joinMatchFromInvite,
  type JoinMatchFromInviteDeps,
} from './joinMatchFromInvite';
import type { LobbyMatchSummary } from '../lobby/lobbyApi';

function summary(
  matchID: string,
  players: { id: string; name?: string }[],
): LobbyMatchSummary {
  return { matchID, players, setupData: null, gameover: null };
}

/** A deps bag with an open seat 1 (seat 0 taken by "host") on match m1. */
function depsWithOpenSeat(navigated: { query: string | null }): JoinMatchFromInviteDeps {
  return {
    listMatches: async () => [
      summary('m1', [{ id: '0', name: 'host' }, { id: '1' }]),
    ],
    joinMatch: async () => ({ playerCredentials: 'secret-creds' }),
    navigate: (query: string) => {
      navigated.query = query;
    },
  };
}

test('joins the first open seat and navigates with match/player/credentials', async () => {
  const navigated: { query: string | null } = { query: null };
  const result = await joinMatchFromInvite('m1', 'Nova', 'token', depsWithOpenSeat(navigated));
  assert.deepEqual(result, { ok: true });
  assert.ok(navigated.query !== null);
  assert.ok(navigated.query!.includes('match=m1'));
  assert.ok(navigated.query!.includes('player=1'));
  assert.ok(navigated.query!.includes('credentials=secret-creds'));
});

test('a match absent from listMatches yields not_joinable (no navigation)', async () => {
  const navigated: { query: string | null } = { query: null };
  const deps: JoinMatchFromInviteDeps = {
    listMatches: async () => [summary('other', [{ id: '0' }])],
    joinMatch: async () => {
      throw new Error('joinMatch must not be called when the match is absent.');
    },
    navigate: (query) => {
      navigated.query = query;
    },
  };
  const result = await joinMatchFromInvite('m1', 'Nova', 'token', deps);
  assert.deepEqual(result, { ok: false, reason: 'not_joinable' });
  assert.equal(navigated.query, null);
});

test('a match with every seat named yields full (no navigation)', async () => {
  const navigated: { query: string | null } = { query: null };
  const deps: JoinMatchFromInviteDeps = {
    listMatches: async () => [
      summary('m1', [{ id: '0', name: 'host' }, { id: '1', name: 'guest' }]),
    ],
    joinMatch: async () => {
      throw new Error('joinMatch must not be called when the match is full.');
    },
    navigate: (query) => {
      navigated.query = query;
    },
  };
  const result = await joinMatchFromInvite('m1', 'Nova', 'token', deps);
  assert.deepEqual(result, { ok: false, reason: 'full' });
  assert.equal(navigated.query, null);
});

test('a failed listMatches yields error, not not_joinable', async () => {
  const deps: JoinMatchFromInviteDeps = {
    listMatches: async () => {
      throw new Error('Simulated list failure.');
    },
    joinMatch: async () => ({ playerCredentials: 'x' }),
    navigate: () => {},
  };
  const result = await joinMatchFromInvite('m1', 'Nova', 'token', deps);
  assert.deepEqual(result, { ok: false, reason: 'error' });
});

test('a join failure after finding the seat yields error', async () => {
  const navigated: { query: string | null } = { query: null };
  const deps: JoinMatchFromInviteDeps = {
    listMatches: async () => [summary('m1', [{ id: '0' }])],
    joinMatch: async () => {
      throw new Error('Simulated join failure (seat taken between list and join).');
    },
    navigate: (query) => {
      navigated.query = query;
    },
  };
  const result = await joinMatchFromInvite('m1', 'Nova', 'token', deps);
  assert.deepEqual(result, { ok: false, reason: 'error' });
  assert.equal(navigated.query, null);
});
