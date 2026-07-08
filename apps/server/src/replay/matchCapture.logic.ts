/**
 * Live-Match Capture — Server Layer (WP-335)
 *
 * WP-3a of the D-24119 faithful-replay arc. Captures a finished match: reconstruct
 * its final state (via WP-334 `reduceMatchToFinalState`), compute the canonical
 * `replayHash`, durably store the replay artifact keyed by that hash in
 * `bgio.replay_artifacts` (which also records the `replayHash -> matchId` mapping +
 * the derived `scenarioKey`), and `assignReplayOwnership` for each authenticated
 * seat — making the finished match competitively SUBMITTABLE.
 *
 * SUBMITTABLE-ONLY: capture does NOT score (the WP-332 submission pipeline scores),
 * does NOT gate on PAR (the submission gates `par_not_published`), does NOT flip
 * ownership visibility (private by default; WP-5 flips before submit), and does NOT
 * call `storeReplay` (which stores a ReplayInput, not the bgio artifact — the
 * artifact table replaces it for the faithful path, D-24122).
 *
 * Layer: server + persistence. Reads `bgio.matches` via WP-334's `readMatchForReplay`
 * (the D-24095 replay carve-out), writes the `bgio.replay_artifacts` table + the
 * `legendary.replay_ownership` rows (via WP-052 `assignReplayOwnership`). No engine
 * edit; no `computeStateHash` change.
 *
 * Authority: WP-335 / EC-365; D-24119 (arc); D-24121 (WP-3 owns the mapping);
 * D-24122 (durable artifact store in the bgio schema; submittable-only; storeReplay
 * superseded); D-24120 (only authenticated seats have a match_seat_accounts row);
 * D-10014 (set-qualified selection ids).
 */

import { buildScenarioKey } from '@legendary-arena/game-engine';
import type { LegendaryGameState } from '@legendary-arena/game-engine';

import {
  readMatchForReplay,
  reduceMatchToFinalState,
} from './matchReplay.logic.js';
import { readSeatAccounts } from '../match/seatAccount.logic.js';
import { assignReplayOwnership } from '../identity/replayOwnership.logic.js';
import type { DatabaseClient } from '../identity/identity.types.js';

/**
 * The outcome of capturing one match. `replayHash`/`scenarioKey` are null when the
 * match was skipped (not replayable); `skipped` carries the reason in that case.
 */
export interface CaptureResult {
  readonly matchId: string;
  readonly replayHash: string | null;
  readonly scenarioKey: string | null;
  readonly seatsOwned: number;
  readonly skipped: string | null;
}

/**
 * Strip the set-abbreviation prefix from a set-qualified id (`<setAbbr>/<slug>`)
 * to the bare slug `buildScenarioKey` expects. A bare slug (no `/`) passes through
 * unchanged (`indexOf` returns -1 → `slice(0)`).
 *
 * @param id A `MatchSelection` id, e.g. `"core/dr-doom"`.
 * @returns The bare slug, e.g. `"dr-doom"`.
 */
export function stripSetAbbreviation(id: string): string {
  return id.slice(id.indexOf('/') + 1);
}

/**
 * Capture one finished match: reconstruct, store the durable artifact + mapping +
 * scenarioKey, assign ownership per authenticated seat, and stamp `captured_at`.
 *
 * Not-replayable matches (no persisted `initial_state`) are skipped with a reason,
 * not an error. A per-seat ownership failure is logged and does not abort the other
 * seats or the artifact write (best-effort per seat).
 *
 * @param matchId The boardgame.io match id (a finished, gameover match).
 * @param database The injected `pg.Pool`.
 * @returns The capture summary.
 */
export async function captureMatch(
  matchId: string,
  database: DatabaseClient,
): Promise<CaptureResult> {
  const artifact = await readMatchForReplay(matchId, database);
  if (artifact === null) {
    // why: a match with no persisted initial_state (a setState-upsert row) is not
    // replayable; skip it rather than error — the harvester moves on.
    return {
      matchId,
      replayHash: null,
      scenarioKey: null,
      seatsOwned: 0,
      skipped: 'not_replayable',
    };
  }

  // why: replayHash = the reducer's canonical stateHash (reduceMatchToFinalState),
  // NOT a hash of the live bgio.matches.state.G — the future verifier recomputes
  // via the same reducer path, so the stored hash must come from it.
  const { finalState, stateHash } = reduceMatchToFinalState({
    initialState: artifact.initialState,
    log: artifact.log,
  });

  const selection = (finalState as LegendaryGameState).selection;
  const scenarioKey = buildScenarioKey(
    stripSetAbbreviation(selection.schemeId),
    stripSetAbbreviation(selection.mastermindId),
    selection.villainGroupIds.map(stripSetAbbreviation),
  );

  // why: durable copy of the artifact keyed by replayHash — survives the reaper
  // deleting the live bgio.matches row. ON CONFLICT DO NOTHING makes a re-capture
  // (crash between insert and the captured_at stamp) harmless. Stored as jsonb;
  // node-pg serializes the objects.
  await database.query(
    'INSERT INTO bgio.replay_artifacts ' +
      '(replay_hash, match_id, scenario_key, initial_state, log) ' +
      'VALUES ($1, $2, $3, $4, $5) ' +
      'ON CONFLICT (replay_hash) DO NOTHING',
    [
      stateHash,
      matchId,
      scenarioKey,
      JSON.stringify(artifact.initialState),
      JSON.stringify(artifact.log),
    ],
  );

  // why: assign ownership to each AUTHENTICATED seat only — bots/guests have no
  // match_seat_accounts row (D-24120). Best-effort per seat: a failure (a stale
  // account -> unknown_account Result, or a thrown DB error) is logged and does
  // not abort the other seats or the already-written artifact.
  const seats = await readSeatAccounts(matchId, database);
  let seatsOwned = 0;
  for (const seat of seats) {
    try {
      const ownership = await assignReplayOwnership(
        seat.accountId,
        stateHash,
        scenarioKey,
        database,
      );
      if (ownership.ok === true) {
        seatsOwned += 1;
      } else {
        console.warn(
          `[capture] Could not assign replay ownership for match ${matchId} seat ` +
            `${seat.playerId} (account ${seat.accountId}); this seat's result may ` +
            `not be attributable. Reason code: ${ownership.code}.`,
        );
      }
    } catch (ownershipError) {
      const errorMessage =
        ownershipError instanceof Error
          ? ownershipError.message
          : String(ownershipError);
      console.error(
        `[capture] Failed to assign replay ownership for match ${matchId} seat ` +
          `${seat.playerId}; the capture of the other seats and the artifact are ` +
          `unaffected. Error: ${errorMessage}`,
      );
    }
  }

  // why: stamp captured_at LAST — it is the harvester's dedupe marker and the
  // reaper's guard (a gameover row is reaped only once captured_at is set), so it
  // must not be set until the artifact + ownership writes above have run.
  await database.query(
    'UPDATE bgio.matches SET captured_at = now() WHERE match_id = $1',
    [matchId],
  );

  return { matchId, replayHash: stateHash, scenarioKey, seatsOwned, skipped: null };
}
