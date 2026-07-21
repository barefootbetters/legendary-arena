/**
 * Match-result display logic (WP-407 / D-24217).
 *
 * Pure helpers that turn a WP-406 result-LAGN response
 * (`GET /api/match/:matchId/result-lagn`) into the view model the
 * `MatchResultPanel` renders. Kept out of the SFC so it is unit-testable under
 * `node:test` (the app does not mount components in tests — see
 * `FreshnessBadge.test.ts`).
 *
 * why: this view is a **pure consumer** of the result LAGN (D-24217). It reads
 * ONLY the public labels WP-406 chose to emit — `players[].player_id` (the
 * claimed handle) and the optional `display_name` — and never joins
 * `match_seat_accounts`, `legendary.players`, or any identity table. A seat
 * WP-406 omitted (no claimed handle, a bot, or a guest) has no `players[]` entry,
 * so it renders **anonymous**, never back-filled from any private source.
 */

import type { LAGN, LagnPlayer } from '@legendary-arena/lagn'

/** One roster row: a named participant, or an anonymous (omitted) seat. */
export interface MatchRosterSeat {
  readonly seat: number
  /** The claimed public handle (WP-406 `player_id`), or `null` when anonymous. */
  readonly playerId: string | null
  /** The mutable display label, or `null` when absent / anonymous. */
  readonly displayName: string | null
  /** True when WP-406 omitted this seat (no claimed handle / bot / guest). */
  readonly isAnonymous: boolean
}

/** The full view model for one completed match's result view. */
export interface MatchResultView {
  readonly matchId: string
  /** `'Victory'` | `'Defeat'` | `'Draw'`. */
  readonly outcomeLabel: string
  /** True for a decisive outcome (drives the win/loss accent). */
  readonly isDecisive: boolean
  /** One row per seat, in seat order. */
  readonly seats: readonly MatchRosterSeat[]
}

/**
 * Build the `GET /api/match/:matchId/result-lagn` URL from the API base.
 *
 * @param apiBaseUrl The server API origin (e.g. `https://play.legendary-arena.com`).
 * @param matchId The match id.
 * @returns The absolute endpoint URL.
 */
export function buildResultLagnUrl(apiBaseUrl: string, matchId: string): string {
  const base = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl
  return `${base}/api/match/${encodeURIComponent(matchId)}/result-lagn`
}

/**
 * Map a result LAGN's `result` block to a human outcome label.
 *
 * why: `victory` / `defeat` are the two decisive LAGN outcomes. WP-406 omits the
 * `result` block for a deck-exhaustion tie (LAGN has no tie outcome), and the
 * endpoint only returns `200` for a FINISHED match — so a completed match with no
 * `result` is a draw, labelled as such rather than "pending".
 *
 * @param result The LAGN `result` block, or `undefined` when absent.
 * @returns The label and whether it is a decisive win/loss.
 */
export function formatOutcome(
  result: LAGN['result'],
): { label: string; isDecisive: boolean } {
  if (result?.outcome === 'victory') {
    return { label: 'Victory', isDecisive: true }
  }
  if (result?.outcome === 'defeat') {
    return { label: 'Defeat', isDecisive: true }
  }
  return { label: 'Draw', isDecisive: false }
}

/**
 * Project the emitted `players[]` + `player_count` into a complete seat roster,
 * one row per seat in seat order.
 *
 * why: a seat present in `players[]` shows its claimed handle + optional display
 * name; a seat WP-406 omitted (absent from `players[]`) renders **anonymous** —
 * the view never invents an id for it (D-24217 / D-24214). `player_count` bounds
 * the seat list, so bot/guest seats appear as anonymous rows rather than vanishing.
 *
 * @param players The emitted roster (may be empty / omitted).
 * @param playerCount The match's seat count.
 * @returns One `MatchRosterSeat` per seat, in ascending seat order.
 */
export function buildRoster(
  players: readonly LagnPlayer[],
  playerCount: number,
): MatchRosterSeat[] {
  const playerBySeat = new Map<number, LagnPlayer>()
  for (const participant of players) {
    playerBySeat.set(participant.seat, participant)
  }
  const seats: MatchRosterSeat[] = []
  for (let seat = 0; seat < playerCount; seat += 1) {
    const participant = playerBySeat.get(seat)
    if (participant === undefined) {
      seats.push({ seat, playerId: null, displayName: null, isAnonymous: true })
    } else {
      seats.push({
        seat,
        playerId: participant.player_id,
        displayName: participant.display_name ?? null,
        isAnonymous: false,
      })
    }
  }
  return seats
}

/**
 * Parse a WP-406 result-LAGN response body into the panel's view model.
 *
 * The endpoint returns `{ lagn }` where `players[]` and `result` live inside
 * `lagn`, and both are optional. The server already `validate()`d the document
 * before returning it, so this consumes the typed shape without re-validating
 * (no parser fork, EC-442). A malformed body degrades to an empty roster rather
 * than throwing.
 *
 * @param matchId The match id (for the view model).
 * @param body The parsed JSON response body (`{ lagn }`).
 * @returns The view model.
 */
export function parseResultLagn(matchId: string, body: unknown): MatchResultView {
  const lagn = (body as { lagn?: LAGN } | null)?.lagn
  const players = lagn?.players ?? []
  // why: fall back to the emitted roster length if player_count is somehow
  // absent, so a malformed document still lists the seats it names.
  const playerCount =
    typeof lagn?.player_count === 'number' ? lagn.player_count : players.length
  const { label, isDecisive } = formatOutcome(lagn?.result)
  return {
    matchId,
    outcomeLabel: label,
    isDecisive,
    seats: buildRoster(players, playerCount),
  }
}
