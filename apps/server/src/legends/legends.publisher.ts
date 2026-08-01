/**
 * Legends Snapshot Publisher — I/O Layer (WP-142)
 *
 * `publishAllBoards()` runs all leaderboard queries inside a single
 * `BEGIN; SET TRANSACTION READ ONLY; ... COMMIT;` scope, builds
 * snapshot boards, writes each board to R2, then writes the manifest
 * LAST. R2 errors are caught and returned in `PublishResult` — never
 * thrown. Archive writes once per UTC day.
 *
 * Layer-boundary contract: no engine, registry, preplan, or UI imports.
 *
 * Authority: WP-142 §B; EC-157 §Locked Values; D-14201..D-14204.
 */

import { randomBytes } from 'node:crypto';

import type { DatabaseClient } from '../leaderboards/leaderboard.types.js';
import type {
  BoardPublishOutcome,
  GauntletIndexApprovedLoadouts,
  GauntletIndexEntry,
  GauntletIndexLeg,
  LegendsManifest,
  LegendsR2Client,
  PublishResult,
  SetDetails,
} from './legends.types.js';

import type {
  GauntletApprovedLoadouts,
  GauntletDefinition,
} from './gauntlet.logic.js';
import {
  buildFixedGauntletBoardNameForPlayerCount,
  buildGauntletBoardNameForPlayerCount,
  GAUNTLET_PLAYER_COUNTS,
  getGauntletStandings,
} from './gauntlet.logic.js';

import {
  buildBoardList,
  buildGlobalTopSnapshot,
  buildScenarioSnapshot,
  serializeSnapshot,
} from './legends.logic.js';

import {
  getGlobalTopLeaderboard,
  getScenarioLeaderboard,
  listScenarioKeys,
} from '../leaderboards/leaderboard.logic.js';

import type { LeaderboardDependencies } from '../leaderboards/leaderboard.types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKET_PREFIX = 'legends/v1/';
const MANIFEST_KEY = 'legends/v1/manifest.json';
const GLOBAL_TOP_QUERY_LIMIT = 500;
const SCENARIO_QUERY_LIMIT = 100;

// ---------------------------------------------------------------------------
// Archive tracking (module-level, reset on process restart)
// ---------------------------------------------------------------------------

let lastArchivedDate: string | null = null;

/**
 * Resets the archive tracking state. Exposed only for tests.
 */
export function resetArchiveTracking(): void {
  lastArchivedDate = null;
}

// ---------------------------------------------------------------------------
// Internal: board payload collected during a publish run
// ---------------------------------------------------------------------------

interface BoardPayload {
  readonly boardName: string;
  readonly jsonPayload: string;
  readonly rowCount: number;
}

// ---------------------------------------------------------------------------
// Publisher
// ---------------------------------------------------------------------------

/**
 * Publishes all leaderboard snapshot boards to R2. Queries run inside
 * a single READ ONLY transaction to get a consistent view of the data.
 *
 * Boards are written in sorted-ASC order, then the manifest LAST.
 * If any board write fails, the manifest is NOT updated — consumers
 * reading a stale manifest see a consistent prior snapshot.
 *
 * R2 errors are caught and returned in `PublishResult` — never thrown.
 */
export async function publishAllBoards(
  database: DatabaseClient,
  r2Client: LegendsR2Client,
  bucket: string,
  leaderboardDeps: LeaderboardDependencies,
  // why: optional (WP-342 / D-24131) — when absent the publisher behaves
  // byte-identically to WP-142 (no gauntlet queries, no gauntlet files, no
  // manifest additions). The wiring layer builds the catalog from the startup
  // registry; this module keeps its no-registry-import lock.
  gauntletCatalog?: readonly GauntletDefinition[],
  // why: WP-461 — additive optional per-set details, built by the wiring layer
  // via buildSetDetailsCatalog and emitted as the gauntlet index's `sets` field.
  // Absent → the index omits `sets` (byte-compatible with a pre-WP-461 consumer).
  setDetailsCatalog?: readonly SetDetails[],
): Promise<PublishResult> {
  // why: runId format is <ISO-timestamp>-<4-char-hex> per EC-157
  // §Locked Values. crypto.randomBytes(2) yields 4 hex chars.
  const runId = `${new Date().toISOString()}-${randomBytes(2).toString('hex')}`;

  const boardOutcomes: BoardPublishOutcome[] = [];
  const boardPayloads: BoardPayload[] = [];
  let anyBoardFailed = false;

  // why: READ ONLY transaction ensures the publisher does not contend
  // with hot match traffic per WP-142 §Non-Negotiable Constraints.
  // All leaderboard queries run inside this scope for a consistent
  // point-in-time snapshot.
  await database.query('BEGIN');
  await database.query('SET TRANSACTION READ ONLY');

  let scenarioKeys: string[];
  try {
    scenarioKeys = await listScenarioKeys(database);
  } catch (error) {
    await database.query('ROLLBACK');
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        runId,
        board: '*',
        rowCount: 0,
        byteCount: 0,
        putLatencyMs: 0,
        success: false,
        error: `Failed to list scenario keys: ${errorMessage}`,
      }),
    );
    return { boards: [], manifestWritten: false, runId };
  }

  const boardNames = buildBoardList(scenarioKeys);

  // --- Build and write global-top snapshot ---
  try {
    const globalLeaderboard = await getGlobalTopLeaderboard(
      { limit: GLOBAL_TOP_QUERY_LIMIT, offset: 0 },
      database,
      leaderboardDeps,
    );
    const globalSnapshot = buildGlobalTopSnapshot(globalLeaderboard);
    const globalJson = serializeSnapshot(globalSnapshot);

    boardPayloads.push({
      boardName: 'global-top',
      jsonPayload: globalJson,
      rowCount: globalSnapshot.rowCount,
    });

    const outcome = await writeBoardToR2(
      r2Client, bucket, 'global-top', globalJson, globalSnapshot.rowCount, runId,
    );
    boardOutcomes.push(outcome);
    if (!outcome.success) {
      anyBoardFailed = true;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    anyBoardFailed = true;
    boardOutcomes.push({
      board: 'global-top',
      byteCount: 0,
      errorMessage,
      putLatencyMs: 0,
      rowCount: 0,
      success: false,
    });
    logBoardOutcome(runId, 'global-top', 0, 0, 0, false, errorMessage);
  }

  // --- Build and write per-scenario snapshots (sorted ASC) ---
  const sortedScenarioKeys = [...scenarioKeys].sort();
  for (const scenarioKey of sortedScenarioKeys) {
    const boardName = `scenario-${scenarioKey.toLowerCase()}`;
    try {
      const scenarioLeaderboard = await getScenarioLeaderboard(
        { scenarioKey, limit: SCENARIO_QUERY_LIMIT, offset: 0 },
        database,
        leaderboardDeps,
      );
      const scenarioSnapshot = buildScenarioSnapshot(scenarioLeaderboard);
      const scenarioJson = serializeSnapshot(scenarioSnapshot);

      boardPayloads.push({
        boardName: scenarioSnapshot.board,
        jsonPayload: scenarioJson,
        rowCount: scenarioSnapshot.rowCount,
      });

      const outcome = await writeBoardToR2(
        r2Client, bucket, scenarioSnapshot.board, scenarioJson,
        scenarioSnapshot.rowCount, runId,
      );
      boardOutcomes.push(outcome);
      if (!outcome.success) {
        anyBoardFailed = true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      anyBoardFailed = true;
      boardOutcomes.push({
        board: boardName,
        byteCount: 0,
        errorMessage,
        putLatencyMs: 0,
        rowCount: 0,
        success: false,
      });
      logBoardOutcome(runId, boardName, 0, 0, 0, false, errorMessage);
    }
  }

  // --- Build and write gauntlet boards + index (WP-342 / D-24131) ---
  // why: standings queries run inside the same READ ONLY transaction as the
  // leaderboard queries so all boards in one publish run see one consistent
  // point-in-time snapshot.
  const writtenGauntletBoardNames: string[] = [];
  if (gauntletCatalog !== undefined) {
    const gauntletIndexEntries: GauntletIndexEntry[] = [];
    let indexBuildFailed = false;

    for (const gauntletDefinition of gauntletCatalog) {
      const soloBoardName = buildGauntletBoardNameForPlayerCount(
        gauntletDefinition,
        1,
      );
      try {
        const standingsByPlayerCount = await getGauntletStandings(
          gauntletDefinition,
          database,
          leaderboardDeps,
        );

        const entryCounts = {
          '1': standingsByPlayerCount.get(1)?.open.length ?? 0,
          '2': standingsByPlayerCount.get(2)?.open.length ?? 0,
          '3': standingsByPlayerCount.get(3)?.open.length ?? 0,
          '4': standingsByPlayerCount.get(4)?.open.length ?? 0,
          '5': standingsByPlayerCount.get(5)?.open.length ?? 0,
        };
        // why: WP-384 / D-24187 §6 — the fixed division's per-count claim
        // state, additive beside entryCounts; the client's fixed chips and
        // division-tab gating read these.
        const fixedEntryCounts = {
          '1': standingsByPlayerCount.get(1)?.fixed.length ?? 0,
          '2': standingsByPlayerCount.get(2)?.fixed.length ?? 0,
          '3': standingsByPlayerCount.get(3)?.fixed.length ?? 0,
          '4': standingsByPlayerCount.get(4)?.fixed.length ?? 0,
          '5': standingsByPlayerCount.get(5)?.fixed.length ?? 0,
        };

        gauntletIndexEntries.push({
          setAbbr: gauntletDefinition.setAbbr,
          setName: gauntletDefinition.setName,
          mastermindSlug: gauntletDefinition.mastermindSlug,
          mastermindName: gauntletDefinition.mastermindName,
          legCount: gauntletDefinition.legs.length,
          // why: entryCount predates the player-count dimension and reports
          // the SOLO board (D-24134 §5) — the deployed WP-343 index renders
          // it unchanged; per-count detail is the additive entryCounts.
          entryCount: entryCounts['1'],
          board: soloBoardName,
          entryCounts,
          fixedEntryCounts,
          // why: WP-472 / D-24283 — legs now carry their PER-SCHEME approved
          // loadout so a mastermind's legs can differ scheme-to-scheme; WP-474's
          // client mirror reads the leg-level field.
          legs: buildPublishedLegs(gauntletDefinition),
          // why: WP-395 / D-24199 — the entry-level per-mastermind requirement.
          // why: WP-472 / D-24283 dual-write (RS-1) — kept POPULATED (per
          // mastermind) so the deployed pre-WP-474 legends-board, which reads it
          // via selectApprovedLoadout, keeps showing loadouts across the gap
          // between the WP-472 and WP-474 Pages deploys; WP-474 removes it once
          // the client mirror reads the per-leg field. Only the ids travel; the
          // derived comparison keys are server-side.
          approvedLoadouts: projectApprovedLoadouts(
            gauntletDefinition.approvedLoadouts,
          ),
        });

        for (const playerCount of GAUNTLET_PLAYER_COUNTS) {
          const standings =
            standingsByPlayerCount.get(playerCount)?.open ?? [];
          // why: zero-entry boards (any count) appear via the index's
          // entryCounts but get NO board file (D-24131 §7 / D-24134 §2) —
          // the index carries "unclaimed" state without writing 500+ empty
          // JSON files every publish cycle.
          if (standings.length === 0) {
            continue;
          }

          const boardName = buildGauntletBoardNameForPlayerCount(
            gauntletDefinition,
            playerCount,
          );
          const gauntletJson = JSON.stringify({
            board: boardName,
            entries: standings,
            rowCount: standings.length,
            schemaVersion: 1,
          });

          boardPayloads.push({
            boardName,
            jsonPayload: gauntletJson,
            rowCount: standings.length,
          });

          const outcome = await writeBoardToR2(
            r2Client, bucket, boardName, gauntletJson, standings.length, runId,
          );
          boardOutcomes.push(outcome);
          if (!outcome.success) {
            anyBoardFailed = true;
          } else {
            writtenGauntletBoardNames.push(boardName);
          }
        }

        // why: WP-384 / D-24187 §3 — the fixed-hero-pool division publishes
        // as additive `-fixed[-p<N>]` files under the same lazy rule
        // (≥1 complete entry only); open-division files above are untouched.
        for (const playerCount of GAUNTLET_PLAYER_COUNTS) {
          const fixedStandings =
            standingsByPlayerCount.get(playerCount)?.fixed ?? [];
          if (fixedStandings.length === 0) {
            continue;
          }

          const fixedBoardName = buildFixedGauntletBoardNameForPlayerCount(
            gauntletDefinition,
            playerCount,
          );
          const fixedJson = JSON.stringify({
            board: fixedBoardName,
            entries: fixedStandings,
            rowCount: fixedStandings.length,
            schemaVersion: 1,
          });

          boardPayloads.push({
            boardName: fixedBoardName,
            jsonPayload: fixedJson,
            rowCount: fixedStandings.length,
          });

          const fixedOutcome = await writeBoardToR2(
            r2Client, bucket, fixedBoardName, fixedJson,
            fixedStandings.length, runId,
          );
          boardOutcomes.push(fixedOutcome);
          if (!fixedOutcome.success) {
            anyBoardFailed = true;
          } else {
            writtenGauntletBoardNames.push(fixedBoardName);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        anyBoardFailed = true;
        indexBuildFailed = true;
        boardOutcomes.push({
          board: soloBoardName,
          byteCount: 0,
          errorMessage,
          putLatencyMs: 0,
          rowCount: 0,
          success: false,
        });
        logBoardOutcome(runId, soloBoardName, 0, 0, 0, false, errorMessage);
      }
    }

    // why: the index is only written when every gauntlet computed — a partial
    // index would silently drop boards; the stale prior index stays consistent
    // (same posture as the manifest-last rule).
    if (!indexBuildFailed) {
      const gauntletIndexJson = JSON.stringify({
        gauntlets: gauntletIndexEntries,
        // why: WP-461 — emit the per-set roster via conditional spread. Assigning
        // `sets: undefined` is a type error under exactOptionalPropertyTypes and
        // would change the JSON shape; the spread omits the field entirely when
        // no catalog was injected (byte-compatible with a pre-WP-461 consumer).
        ...(setDetailsCatalog !== undefined ? { sets: setDetailsCatalog } : {}),
        generatedAt: new Date().toISOString(),
        schemaVersion: 1,
      });

      boardPayloads.push({
        boardName: 'gauntlet-index',
        jsonPayload: gauntletIndexJson,
        rowCount: gauntletIndexEntries.length,
      });

      const indexOutcome = await writeBoardToR2(
        r2Client, bucket, 'gauntlet-index', gauntletIndexJson,
        gauntletIndexEntries.length, runId,
      );
      boardOutcomes.push(indexOutcome);
      if (!indexOutcome.success) {
        anyBoardFailed = true;
      }
    }
  }

  await database.query('COMMIT');

  // --- Write archive (once per UTC day) ---
  const currentDateUtc = new Date().toISOString().slice(0, 10);
  if (currentDateUtc !== lastArchivedDate && !anyBoardFailed) {
    try {
      for (const payload of boardPayloads) {
        const archiveKey = `${BUCKET_PREFIX}archive/${currentDateUtc}/${payload.boardName}.json`;
        await r2Client.putObject({
          body: payload.jsonPayload,
          bucket,
          contentType: 'application/json',
          key: archiveKey,
          signal: AbortSignal.timeout(10_000),
        });
      }
      lastArchivedDate = currentDateUtc;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        JSON.stringify({
          runId,
          board: 'archive',
          error: `Archive write failed: ${errorMessage}`,
        }),
      );
    }
  }

  // why: manifest is written LAST per D-14204. If any board failed,
  // the manifest is NOT updated — consumers see the prior consistent
  // snapshot.
  let manifestWritten = false;
  if (!anyBoardFailed) {
    try {
      const generatedAt = new Date().toISOString();
      // why: the gauntlet fields are additive and appear ONLY when a catalog
      // was provided (WP-342 / D-24131 §7) — the no-catalog manifest is
      // byte-compatible with WP-142 consumers.
      let manifest: LegendsManifest;
      if (gauntletCatalog === undefined) {
        manifest = {
          boards: boardNames,
          generatedAt,
          schemaVersion: 1,
        };
      } else {
        manifest = {
          boards: boardNames,
          generatedAt,
          schemaVersion: 1,
          gauntletBoards: [...writtenGauntletBoardNames].sort(),
          gauntletIndex: 'gauntlet-index',
        };
      }
      const manifestJson = JSON.stringify(manifest);

      await r2Client.putObject({
        body: manifestJson,
        bucket,
        contentType: 'application/json',
        key: MANIFEST_KEY,
        signal: AbortSignal.timeout(10_000),
      });
      manifestWritten = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        JSON.stringify({
          runId,
          board: 'manifest',
          error: `Manifest write failed: ${errorMessage}`,
        }),
      );
    }
  }

  return { boards: boardOutcomes, manifestWritten, runId };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Projects one set of approved loadouts into the published index shape
 * (WP-395 / D-24199): only the set-qualified group ids a player must configure,
 * dropping the server-side comparison keys. Shared by the entry-level
 * (per-mastermind) and the per-leg (per-scheme) emission (WP-472 / D-24283).
 *
 * @param approvedLoadouts the per-count approved configurations to project, or
 *   undefined when the source carries no requirement.
 * @returns the per-count published configurations, or undefined when the source
 *   carries no requirement.
 */
function projectApprovedLoadouts(
  approvedLoadouts: GauntletApprovedLoadouts | undefined,
): GauntletIndexApprovedLoadouts | undefined {
  if (approvedLoadouts === undefined) {
    return undefined;
  }
  const publishedByPlayerCount: Record<
    string,
    { villainGroupIds: readonly string[]; henchmanGroupIds: readonly string[] }[]
  > = {};
  for (const [playerCount, approvedForCount] of Object.entries(
    approvedLoadouts,
  )) {
    const published = [];
    for (const approvedLoadout of approvedForCount) {
      published.push({
        villainGroupIds: approvedLoadout.villainGroupIds,
        henchmanGroupIds: approvedLoadout.henchmanGroupIds,
      });
    }
    publishedByPlayerCount[playerCount] = published;
  }
  return publishedByPlayerCount;
}

/**
 * Projects a gauntlet's legs into the published index shape (WP-472 / D-24283),
 * attaching each leg's per-scheme approved loadout when it carries one.
 *
 * why: the requirement is colocated with its scheme so a mastermind's legs can
 * field different adversaries scheme-to-scheme; a leg with no effective loadout
 * omits the field via conditional spread (exactOptionalPropertyTypes, and so a
 * pre-WP-472 leg publishes byte-identically).
 *
 * @param gauntletDefinition the gauntlet being published.
 * @returns the published legs in the definition's leg order.
 */
function buildPublishedLegs(
  gauntletDefinition: GauntletDefinition,
): GauntletIndexLeg[] {
  const publishedLegs: GauntletIndexLeg[] = [];
  for (const leg of gauntletDefinition.legs) {
    const publishedLoadout = projectApprovedLoadouts(leg.approvedLoadouts);
    publishedLegs.push({
      schemeSlug: leg.schemeSlug,
      schemeName: leg.schemeName,
      ...(publishedLoadout !== undefined
        ? { approvedLoadouts: publishedLoadout }
        : {}),
    });
  }
  return publishedLegs;
}

/**
 * Writes a single board JSON to R2 with a 10-second per-PUT timeout.
 */
async function writeBoardToR2(
  r2Client: LegendsR2Client,
  bucket: string,
  boardName: string,
  jsonPayload: string,
  rowCount: number,
  runId: string,
): Promise<BoardPublishOutcome> {
  const key = `${BUCKET_PREFIX}${boardName}.json`;
  const byteCount = Buffer.byteLength(jsonPayload, 'utf8');
  const startTime = performance.now();

  try {
    // why: AbortSignal.timeout(10_000) per PUT, not globally, per
    // EC-157 §Locked Values. A slow PUT on one board does not
    // cancel other board writes.
    await r2Client.putObject({
      body: jsonPayload,
      bucket,
      contentType: 'application/json',
      key,
      signal: AbortSignal.timeout(10_000),
    });

    const putLatencyMs = Math.round(performance.now() - startTime);
    logBoardOutcome(runId, boardName, rowCount, byteCount, putLatencyMs, true);

    return {
      board: boardName,
      byteCount,
      putLatencyMs,
      rowCount,
      success: true,
    };
  } catch (error) {
    const putLatencyMs = Math.round(performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : String(error);
    logBoardOutcome(runId, boardName, rowCount, byteCount, putLatencyMs, false, errorMessage);

    return {
      board: boardName,
      byteCount,
      errorMessage,
      putLatencyMs,
      rowCount,
      success: false,
    };
  }
}

/**
 * Emits a structured JSON log line per board per EC-157 §Locked Values.
 */
function logBoardOutcome(
  runId: string,
  board: string,
  rowCount: number,
  byteCount: number,
  putLatencyMs: number,
  success: boolean,
  errorMessage?: string,
): void {
  const logEntry: Record<string, unknown> = {
    runId,
    board,
    rowCount,
    byteCount,
    putLatencyMs,
    success,
  };
  if (errorMessage !== undefined) {
    logEntry.error = errorMessage;
  }
  console.log(JSON.stringify(logEntry));
}
