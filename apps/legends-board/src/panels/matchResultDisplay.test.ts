import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildResultLagnUrl,
  formatOutcome,
  buildRoster,
  parseResultLagn,
} from './matchResultDisplay.ts'

/**
 * Pure-logic tests for the match-result view model (WP-407 / EC-442). The SFC
 * renderer is covered by the dev-server smoke; this pins the parsing, rostering,
 * and outcome-formatting that drive AC-1..AC-3.
 */

describe('buildResultLagnUrl', () => {
  it('joins the API base and the match id, trimming a trailing slash', () => {
    assert.equal(
      buildResultLagnUrl('https://play.legendary-arena.com', 'match-1'),
      'https://play.legendary-arena.com/api/match/match-1/result-lagn',
    )
    assert.equal(
      buildResultLagnUrl('https://play.legendary-arena.com/', 'match-1'),
      'https://play.legendary-arena.com/api/match/match-1/result-lagn',
    )
  })

  it('url-encodes the match id', () => {
    assert.equal(
      buildResultLagnUrl('https://x.test', 'a/b'),
      'https://x.test/api/match/a%2Fb/result-lagn',
    )
  })
})

describe('formatOutcome', () => {
  it('maps victory and defeat to decisive labels', () => {
    assert.deepEqual(formatOutcome({ outcome: 'victory' }), {
      label: 'Victory',
      isDecisive: true,
    })
    assert.deepEqual(formatOutcome({ outcome: 'defeat' }), {
      label: 'Defeat',
      isDecisive: true,
    })
  })

  it('labels an absent result block (a finished-match tie) as a non-decisive Draw', () => {
    assert.deepEqual(formatOutcome(undefined), { label: 'Draw', isDecisive: false })
  })
})

describe('buildRoster', () => {
  it('AC-1: a named seat shows its handle + optional display name', () => {
    const seats = buildRoster(
      [
        { seat: 0, player_id: 'ana-handle', display_name: 'Ana' },
        { seat: 1, player_id: 'devon-handle' },
      ],
      2,
    )
    assert.deepEqual(seats, [
      { seat: 0, playerId: 'ana-handle', displayName: 'Ana', isAnonymous: false },
      { seat: 1, playerId: 'devon-handle', displayName: null, isAnonymous: false },
    ])
  })

  it('AC-2: a seat WP-406 omitted renders anonymous with no id', () => {
    // seat 1 has no players[] entry (no claimed handle / bot / guest)
    const seats = buildRoster([{ seat: 0, player_id: 'ana-handle' }], 3)
    assert.equal(seats.length, 3)
    assert.equal(seats[0].isAnonymous, false)
    assert.deepEqual(seats[1], {
      seat: 1,
      playerId: null,
      displayName: null,
      isAnonymous: true,
    })
    assert.equal(seats[2].isAnonymous, true)
    // no private id leaks into an omitted seat
    assert.equal(JSON.stringify(seats).includes('account'), false)
  })

  it('lists seats in ascending order regardless of players[] order', () => {
    const seats = buildRoster(
      [
        { seat: 1, player_id: 'b' },
        { seat: 0, player_id: 'a' },
      ],
      2,
    )
    assert.deepEqual(
      seats.map((row) => row.seat),
      [0, 1],
    )
  })
})

describe('parseResultLagn', () => {
  it('AC-1: parses outcome + roster from a { lagn } body', () => {
    const view = parseResultLagn('match-1', {
      lagn: {
        lagn_version: '1.4.0',
        game_id: 'match-1',
        variant: 'cooperative',
        player_count: 2,
        setup: {},
        players: [
          { seat: 0, player_id: 'ana-handle', display_name: 'Ana' },
          { seat: 1, player_id: 'devon-handle' },
        ],
        result: { outcome: 'victory' },
      },
    })
    assert.equal(view.matchId, 'match-1')
    assert.equal(view.outcomeLabel, 'Victory')
    assert.equal(view.isDecisive, true)
    assert.equal(view.seats.length, 2)
    assert.equal(view.seats[0].playerId, 'ana-handle')
  })

  it('AC-3: a body with no players / result yields a Draw and anonymous seats', () => {
    const view = parseResultLagn('match-2', {
      lagn: {
        lagn_version: '1.4.0',
        game_id: 'match-2',
        variant: 'solo',
        player_count: 1,
        setup: {},
      },
    })
    assert.equal(view.outcomeLabel, 'Draw')
    assert.equal(view.seats.length, 1)
    assert.equal(view.seats[0].isAnonymous, true)
  })

  it('degrades to an empty roster on a malformed body rather than throwing', () => {
    assert.doesNotThrow(() => parseResultLagn('m', null))
    const view = parseResultLagn('m', {})
    assert.equal(view.seats.length, 0)
    assert.equal(view.outcomeLabel, 'Draw')
  })
})
