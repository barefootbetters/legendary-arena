import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { filterJoinableMatches, isSeatOpen } from './lobbyMatchFilter';
import type { LobbyMatchSummary } from './lobbyApi';

/**
 * Builds a minimal {@link LobbyMatchSummary} for the filter tests. `players` is
 * passed as `{ id, name? }` tuples; a seat with no `name` is an open seat.
 */
function makeMatch(
  matchID: string,
  seats: { id: string; name?: string }[],
  gameover: unknown | null,
): LobbyMatchSummary {
  return { matchID, players: seats, setupData: null, gameover };
}

describe('lobbyMatchFilter (WP-326)', () => {
  test('isSeatOpen is true only when the seat has no name', () => {
    assert.equal(isSeatOpen({ id: '0' }), true);
    assert.equal(isSeatOpen({ id: '0', name: 'Alice' }), false);
  });

  test('filterJoinableMatches([]) returns an empty array', () => {
    assert.deepEqual(filterJoinableMatches([]), []);
  });

  test('keeps an ongoing match that has at least one open seat', () => {
    const match = makeMatch('m1', [{ id: '0', name: 'Alice' }, { id: '1' }], null);
    const result = filterJoinableMatches([match]);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.matchID, 'm1');
  });

  test('drops a fully-seated match (no open seat), even though it is ongoing', () => {
    const match = makeMatch(
      'm2',
      [{ id: '0', name: 'Alice' }, { id: '1', name: 'Bob' }],
      null,
    );
    assert.deepEqual(filterJoinableMatches([match]), []);
  });

  test('drops a single-seat match whose only seat is filled (the Watch-Bot/solo case)', () => {
    // why: every stale row observed on play.legendary-arena.com (2026-07-07) was
    // exactly this shape — "1 seats, seat 0 — <name>", no open seat.
    const match = makeMatch('m3', [{ id: '0', name: 'jjensen' }], null);
    assert.deepEqual(filterJoinableMatches([match]), []);
  });

  test('drops a gameover match even when it still has an open seat', () => {
    const match = makeMatch('m4', [{ id: '0', name: 'Alice' }, { id: '1' }], {
      winner: '0',
    });
    assert.deepEqual(filterJoinableMatches([match]), []);
  });

  test('returns only the joinable subset of a mixed list, preserving input order', () => {
    const joinableA = makeMatch('a', [{ id: '0' }, { id: '1', name: 'Bob' }], null);
    const full = makeMatch('b', [{ id: '0', name: 'X' }], null);
    const finished = makeMatch('c', [{ id: '0' }], { winner: '0' });
    const joinableB = makeMatch('d', [{ id: '0' }], null);

    const result = filterJoinableMatches([joinableA, full, finished, joinableB]);

    assert.deepEqual(
      result.map((match) => match.matchID),
      ['a', 'd'],
    );
  });
});
