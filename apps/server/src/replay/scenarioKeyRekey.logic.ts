/**
 * Captured-Replay ScenarioKey Rekey — Server Layer (D-24597, one-time)
 *
 * Before D-24597, live capture keyed every match by bare slugs, so a reprint
 * scheme / mastermind / villain group (co2e Portals, msp1 Civil War, co2e Red
 * Skull, ...) was recorded under the identical core ScenarioKey and PAR-gated
 * against core's published PAR. This pass re-derives each captured artifact's key
 * with the current (set-qualified) derivation and rewrites the rows still carrying
 * the stale key.
 *
 * Derivation reuses the capture path exactly: `reduceMatchToFinalState` over the
 * stored `initialState + log` (the D-24119 replay carve-out), then
 * `deriveCaptureScenarioKey` on the reduced `selection`. Every all-core match
 * re-derives its stored key unchanged, so only reprint matches are touched.
 *
 * Each table is compared against the derived key independently, so passes compose
 * in any order (a `write` pass now and an `includeScores` pass later still finds
 * the score rows) and every UPDATE is idempotent. Tables:
 *   1. `legendary.competitive_scores` — only with `includeScores` (D-24597 §3).
 *   2. `legendary.replay_ownership` — the row the submission pipeline reads its
 *      scenarioKey from; rekeying it is what stops a pending reprint capture from
 *      scoring against core's PAR.
 *   3. `bgio.replay_artifacts` — the durable capture record.
 *
 * Authority: D-24597; D-24119 (replay carve-out); D-24122 (artifact store).
 */

import { deriveCaptureScenarioKey } from './matchCapture.logic.js';
import { reduceMatchToFinalState } from './matchReplay.logic.js';
import type { LegendaryGameState } from '@legendary-arena/game-engine';
import type { DatabaseClient } from '../identity/identity.types.js';

/** One captured replay with at least one row stored under a non-derived key. */
export interface ScenarioKeyRekeyCandidate {
  readonly replayHash: string;
  /** The artifact row's stored key (may already equal the derived key). */
  readonly storedScenarioKey: string;
  readonly derivedScenarioKey: string;
  readonly isArtifactStale: boolean;
  /** Ownership rows for the hash whose key differs from the derived key. */
  readonly staleOwnershipRows: number;
  /** Score rows for the hash whose key differs from the derived key. */
  readonly staleScoreRows: number;
}

/** The outcome of one rekey pass. */
export interface ScenarioKeyRekeyReport {
  readonly scanned: number;
  readonly unchanged: number;
  readonly candidates: readonly ScenarioKeyRekeyCandidate[];
  readonly failures: readonly { readonly replayHash: string; readonly reason: string }[];
  readonly wroteArtifactsAndOwnership: boolean;
  readonly wroteScores: boolean;
}

/** Options for one rekey pass. Both default to false (dry run). */
export interface ScenarioKeyRekeyOptions {
  readonly write: boolean;
  readonly includeScores: boolean;
}

interface ArtifactRow {
  replay_hash: string;
  scenario_key: string;
  initial_state: unknown;
  log: unknown[];
}

// why: blobs can be large; paging by the primary key keeps memory flat and makes
// the scan order deterministic.
const PAGE_SIZE = 25;

/**
 * Re-derive one artifact's ScenarioKey through the capture path.
 *
 * @param row A `bgio.replay_artifacts` row.
 * @returns The key capture would write today.
 */
function deriveScenarioKeyForArtifact(row: ArtifactRow): string {
  const { finalState } = reduceMatchToFinalState({
    initialState: row.initial_state,
    log: row.log,
  });
  return deriveCaptureScenarioKey((finalState as LegendaryGameState).selection);
}

/**
 * Count a hash's ownership + score rows stored under any key but the derived one.
 *
 * @param replayHash The artifact's replay hash.
 * @param derivedScenarioKey The key capture would write today.
 * @param database The injected `pg.Pool`.
 * @returns The two stale-row counts.
 */
async function countStaleDependentRows(
  replayHash: string,
  derivedScenarioKey: string,
  database: DatabaseClient,
): Promise<{ staleOwnershipRows: number; staleScoreRows: number }> {
  const ownership = await database.query(
    'SELECT count(*)::int AS n FROM legendary.replay_ownership ' +
      'WHERE replay_hash = $1 AND scenario_key <> $2',
    [replayHash, derivedScenarioKey],
  );
  const scores = await database.query(
    'SELECT count(*)::int AS n FROM legendary.competitive_scores ' +
      'WHERE replay_hash = $1 AND scenario_key <> $2',
    [replayHash, derivedScenarioKey],
  );
  return {
    staleOwnershipRows: ownership.rows[0].n,
    staleScoreRows: scores.rows[0].n,
  };
}

/**
 * Rewrite one candidate's stale rows to the derived key.
 *
 * @param candidate The candidate to apply.
 * @param includeScores Whether `competitive_scores` rows are rewritten too.
 * @param database The injected `pg.Pool`.
 */
async function applyCandidate(
  candidate: ScenarioKeyRekeyCandidate,
  includeScores: boolean,
  database: DatabaseClient,
): Promise<void> {
  const parameters = [candidate.derivedScenarioKey, candidate.replayHash];
  if (includeScores) {
    await database.query(
      'UPDATE legendary.competitive_scores SET scenario_key = $1 ' +
        'WHERE replay_hash = $2 AND scenario_key <> $1',
      parameters,
    );
  }
  await database.query(
    'UPDATE legendary.replay_ownership SET scenario_key = $1 ' +
      'WHERE replay_hash = $2 AND scenario_key <> $1',
    parameters,
  );
  await database.query(
    'UPDATE bgio.replay_artifacts SET scenario_key = $1 ' +
      'WHERE replay_hash = $2 AND scenario_key <> $1',
    parameters,
  );
}

/**
 * Scan every captured artifact, report the ones whose stored ScenarioKey differs
 * from the current derivation, and (with `write`) rewrite them.
 *
 * @param database The injected `pg.Pool`.
 * @param options `write` applies artifact + ownership rewrites; `includeScores`
 *   (only with `write`) also rewrites `competitive_scores`.
 * @returns The pass report.
 */
export async function rekeyCapturedScenarioKeys(
  database: DatabaseClient,
  options: ScenarioKeyRekeyOptions,
): Promise<ScenarioKeyRekeyReport> {
  const candidates: ScenarioKeyRekeyCandidate[] = [];
  const failures: { replayHash: string; reason: string }[] = [];
  let scanned = 0;
  let unchanged = 0;
  let lastReplayHash = '';

  for (;;) {
    const page = await database.query(
      'SELECT replay_hash, scenario_key, initial_state, log FROM bgio.replay_artifacts ' +
        'WHERE replay_hash > $1 ORDER BY replay_hash LIMIT $2',
      [lastReplayHash, PAGE_SIZE],
    );
    const rows = page.rows as ArtifactRow[];
    if (rows.length === 0) {
      break;
    }
    for (const row of rows) {
      scanned += 1;
      lastReplayHash = row.replay_hash;
      let derivedScenarioKey: string;
      try {
        derivedScenarioKey = deriveScenarioKeyForArtifact(row);
      } catch (error) {
        // why: a malformed artifact is reported and left untouched — one bad blob
        // must not abort the pass over the rest.
        failures.push({
          replayHash: row.replay_hash,
          reason: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      const counts = await countStaleDependentRows(row.replay_hash, derivedScenarioKey, database);
      const isArtifactStale = derivedScenarioKey !== row.scenario_key;
      if (!isArtifactStale && counts.staleOwnershipRows === 0 && counts.staleScoreRows === 0) {
        unchanged += 1;
        continue;
      }
      const candidate: ScenarioKeyRekeyCandidate = {
        replayHash: row.replay_hash,
        storedScenarioKey: row.scenario_key,
        derivedScenarioKey,
        isArtifactStale,
        staleOwnershipRows: counts.staleOwnershipRows,
        staleScoreRows: counts.staleScoreRows,
      };
      candidates.push(candidate);
      if (options.write) {
        await applyCandidate(candidate, options.includeScores, database);
      }
    }
  }

  return {
    scanned,
    unchanged,
    candidates,
    failures,
    wroteArtifactsAndOwnership: options.write,
    wroteScores: options.write && options.includeScores,
  };
}
