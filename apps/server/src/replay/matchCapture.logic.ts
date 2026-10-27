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
 * ownership visibility (private by default; an ACCEPTED submission flips it, D-24577), and does NOT
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
 * D-10014 (set-qualified selection ids); D-24597 (set-qualified ScenarioKey
 * segments for non-core ids).
 */

import { buildScenarioKeyFromExtIds, evaluateEndgame } from '@legendary-arena/game-engine';
import type {
  LegendaryGameState,
  MatchSelection,
} from '@legendary-arena/game-engine';

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
 * Derive the ScenarioKey a captured match is recorded (and later PAR-gated) under.
 *
 * @param selection The reduced final state's `MatchSelection` (set-qualified ids).
 * @returns The ScenarioKey stored on the artifact + every ownership row.
 */
export function deriveCaptureScenarioKey(
  selection: Pick<MatchSelection, 'schemeId' | 'mastermindId' | 'villainGroupIds'>,
): string {
  // why: D-24597 — set-qualified for every non-core id, so a reprint scheme /
  // mastermind / villain group (co2e, msp1, ...) never keys onto core's PAR row.
  // Core ids stay bare, so every published PAR key is unchanged.
  return buildScenarioKeyFromExtIds(
    selection.schemeId,
    selection.mastermindId,
    selection.villainGroupIds,
  );
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

  const scenarioKey = deriveCaptureScenarioKey(
    (finalState as LegendaryGameState).selection,
  );

  // why: durable copy of the artifact keyed by replayHash — survives the reaper
  // deleting the live bgio.matches row. ON CONFLICT DO NOTHING makes a re-capture
  // (crash between insert and the captured_at stamp) harmless. Stored as jsonb;
  // node-pg serializes the objects. The `gameover` column is the live row's
  // `metadata.gameover`, copied so /result-lagn can still report the outcome
  // once the reaper deletes the row (D-24719).
  await database.query(
    'INSERT INTO bgio.replay_artifacts ' +
      '(replay_hash, match_id, scenario_key, initial_state, log, gameover) ' +
      'VALUES ($1, $2, $3, $4, $5, $6) ' +
      'ON CONFLICT (replay_hash) DO NOTHING',
    [
      stateHash,
      matchId,
      scenarioKey,
      JSON.stringify(artifact.initialState),
      JSON.stringify(artifact.log),
      serializeStoredGameover(artifact.metadata),
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

/**
 * Serialize a live row's `metadata.gameover` for the artifact's `gameover`
 * column: the verdict as JSON, or `null` when the metadata carries none.
 *
 * @param metadata The live row's `metadata` jsonb (already parsed).
 * @returns The JSON text to store, or `null`.
 */
export function serializeStoredGameover(metadata: unknown): string | null {
  if (typeof metadata !== 'object' || metadata === null) {
    return null;
  }
  const gameover = (metadata as { gameover?: unknown }).gameover;
  if (gameover === null || gameover === undefined) {
    return null;
  }
  return JSON.stringify(gameover);
}

// why: a small batch per harvester scan — each row is a full reducer
// re-execution on the server's event loop, the same cost as one capture. Five
// per 5-minute scan clears hundreds of legacy artifacts within a day without a
// visible latency spike for live sockets (D-24719 §3).
export const ARTIFACT_GAMEOVER_SWEEP_BATCH_SIZE = 5;

/**
 * Fill `bgio.replay_artifacts.gameover` for artifacts captured before
 * migration 046 (D-24719 §3). Each row is re-executed through the D-24119
 * reducer and the verdict is the engine's own `evaluateEndgame` on the
 * reproduced final `G` — the exact value the live top-level `endIf` returned.
 *
 * @param database The injected `pg.Pool`.
 * @param batchSize The most rows to fill in this call.
 * @returns The number of rows filled.
 */
export async function fillMissingArtifactGameovers(
  database: DatabaseClient,
  batchSize: number,
): Promise<number> {
  const result = await database.query(
    'SELECT replay_hash, initial_state, log FROM bgio.replay_artifacts ' +
      'WHERE gameover IS NULL LIMIT $1',
    [batchSize],
  );
  let filledCount = 0;
  for (const row of result.rows) {
    const verdict = deriveArtifactGameover(row.replay_hash, row.initial_state, row.log);
    // why: `AND gameover IS NULL` — a concurrent capture or a second process
    // never has its value overwritten.
    const update = await database.query(
      'UPDATE bgio.replay_artifacts SET gameover = $2 ' +
        'WHERE replay_hash = $1 AND gameover IS NULL',
      [row.replay_hash, JSON.stringify(verdict)],
    );
    filledCount += update.rowCount ?? 0;
  }
  return filledCount;
}

/**
 * Re-derive one artifact's endgame verdict. Returns `{}` (outcome unknown) when
 * the reduction throws, yields no verdict, or no longer reproduces the stored
 * `replay_hash`, so the row is never re-selected.
 *
 * @param replayHash The artifact's key (for the log line).
 * @param initialState The artifact's `initial_state` jsonb.
 * @param log The artifact's `log` jsonb.
 * @returns The verdict object to store.
 */
function deriveArtifactGameover(
  replayHash: string,
  initialState: unknown,
  log: unknown,
): object {
  try {
    const { finalState, stateHash } = reduceMatchToFinalState({
      initialState,
      log: Array.isArray(log) ? log : [],
    });
    if (stateHash !== replayHash) {
      // why: the sweep runs on today's engine. If a later fidelity change makes
      // the re-execution diverge from the captured final `G` (the competition
      // verifier's own hash check), its verdict is not the live one, so storing
      // it could publish the wrong outcome. Unknown is the honest value.
      console.error(
        `[capture] Replay artifact ${replayHash} no longer reproduces its stored ` +
          `hash on this build (got ${stateHash}); storing an unknown outcome instead ` +
          `of a verdict that may differ from the live match.`,
      );
      return {};
    }
    return evaluateEndgame(finalState) ?? {};
  } catch (error) {
    // why: the reduction is pure, so a throw repeats on every scan; storing `{}`
    // (outcome unknown — the LAGN `result` block is omitted) stops the retry
    // loop instead of losing the error silently.
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[capture] Could not re-derive the endgame verdict for replay artifact ` +
        `${replayHash}; storing an unknown outcome so its result LAGN omits the ` +
        `result block. Error: ${errorMessage}`,
    );
    return {};
  }
}
