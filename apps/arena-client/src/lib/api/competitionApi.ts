/**
 * Competition API Client — Arena Client (WP-339 / WP-5b)
 *
 * Typed `fetch` wrappers for the two competitive-scoring HTTP endpoints:
 *   - `POST /api/competition/scores` — submit a finished match's score by
 *     `matchId` (the server resolves the replay, captures on-demand, verifies,
 *     auto-publishes, and scores — WP-338). The client never sends a
 *     `replayHash`: it cannot compute `computeStateHash`.
 *   - `GET /api/me/scores` — the authenticated player's submitted scores.
 *
 * Layer-boundary contract: imports nothing from `boardgame.io`,
 * `@legendary-arena/game-engine`, `@legendary-arena/registry`,
 * `@legendary-arena/preplan`, `@legendary-arena/vue-sfc-loader`, or any
 * `apps/server/**` module. `MyCompetitiveScore` is declared inline by
 * structural compatibility with the server's `CompetitiveScoreRecord`
 * (`apps/server/src/competition/competition.types.ts`) — the server is
 * authoritative on the shape; the client must not import server-layer types.
 * Mirrors the WP-104 `ownerProfileApi.ts` never-throw Bearer-fetch pattern.
 *
 * Authority: WP-339 §Scope (In) §A; EC-369; D-24126 (the server surfaces).
 */

import { buildApiUrl } from './apiBaseUrl';

/**
 * A submitted competitive score, mirroring the server's
 * `CompetitiveScoreRecord` display fields by structural compatibility (the
 * `accountId` owner field is intentionally absent — a player's own scores are
 * implicitly theirs). Declared locally because the client must not import
 * server-layer types.
 */
export interface MyCompetitiveScore {
  readonly submissionId: number;
  readonly replayHash: string;
  readonly scenarioKey: string;
  readonly rawScore: number;
  readonly finalScore: number;
  readonly parVersion: string;
  readonly scoringConfigVersion: number;
  readonly stateHash: string;
  readonly createdAt: string;
}

/**
 * Result of a submit attempt. Never throws: a network failure surfaces as
 * `status: 0`. `record`/`wasExisting` are present only on HTTP 200; `error`
 * carries the server's `{ error: <code> }` string on a non-200.
 */
export interface SubmitScoreResult {
  readonly status: number;
  readonly wasExisting: boolean | null;
  readonly record: MyCompetitiveScore | null;
  readonly error: string | null;
}

/**
 * Result of a my-scores fetch. Never throws (`status: 0` on network failure).
 * `scores` is present only on HTTP 200.
 */
export interface MyScoresResult {
  readonly status: number;
  readonly scores: MyCompetitiveScore[] | null;
  readonly error: string | null;
}

/**
 * Best-effort extraction of the server's `{ error: <code> }` string from a
 * non-200 response body. Returns `null` when the body is absent, not JSON, or
 * carries no string `error`.
 *
 * @param response The non-200 fetch response.
 * @returns The error code string, or `null`.
 */
async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : null;
  } catch {
    // why: a non-200 with no body / malformed JSON is a transport-level failure;
    // surface only the status so the caller can render a generic message.
    return null;
  }
}

/**
 * Submit a finished match's competitive score by `matchId`. The server resolves
 * the replay, captures on-demand if needed, verifies, auto-publishes, and scores
 * (WP-338); the client sends only `matchId` because it cannot compute the
 * `replayHash`. `Authorization: Bearer` is attached only for an authenticated
 * caller; a `null` token yields a request the server rejects with 401 (the
 * caller should not submit for a guest — see `useCompetitiveSubmitOnGameover`).
 *
 * @param authToken The bearer token, or `null` for an unauthenticated caller.
 * @param matchId The finished match's id.
 * @returns The submit result (never throws; `status: 0` on network failure).
 */
export async function submitCompetitiveScore(
  authToken: string | null,
  matchId: string,
): Promise<SubmitScoreResult> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/competition/scores'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // why: the submit key is matchId, NOT replayHash — the client cannot run
        // computeStateHash; the server resolves the hash from the matchId (WP-338).
        ...(authToken === null ? {} : { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify({ matchId }),
    });
  } catch {
    return { status: 0, wasExisting: null, record: null, error: null };
  }
  if (response.status === 200) {
    const body = (await response.json()) as {
      record: MyCompetitiveScore;
      wasExisting: boolean;
    };
    return {
      status: 200,
      wasExisting: body.wasExisting,
      record: body.record,
      error: null,
    };
  }
  return {
    status: response.status,
    wasExisting: null,
    record: null,
    error: await readErrorCode(response),
  };
}

/**
 * Fetch the authenticated player's submitted competitive scores (newest first).
 *
 * @param authToken The bearer token, or `null` for an unauthenticated caller.
 * @returns The my-scores result (never throws; `status: 0` on network failure).
 */
export async function fetchMyScores(
  authToken: string | null,
): Promise<MyScoresResult> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/scores'), {
      method: 'GET',
      headers:
        authToken === null ? {} : { Authorization: `Bearer ${authToken}` },
    });
  } catch {
    return { status: 0, scores: null, error: null };
  }
  if (response.status === 200) {
    const body = (await response.json()) as { scores: MyCompetitiveScore[] };
    return { status: 200, scores: body.scores, error: null };
  }
  return {
    status: response.status,
    scores: null,
    error: await readErrorCode(response),
  };
}

/**
 * One leg of a gauntlet's progress. Hand-mirrored from the server's
 * `GauntletLegProgress` (apps/server/src/legends/gauntlet.logic.ts) —
 * the client must not import server-layer types.
 */
export interface MyGauntletLegProgress {
  readonly schemeSlug: string;
  readonly bestFinalScore: number | null;
}

/**
 * One gauntlet's progress for the authenticated player ("5/8 schemes
 * defeated"). Hand-mirrored from the server's `GauntletProgress`
 * (apps/server/src/legends/gauntlet.logic.ts). The endpoint returns only
 * gauntlets with at least one winning leg.
 */
export interface MyGauntletProgress {
  readonly setAbbr: string;
  readonly setName: string;
  readonly mastermindSlug: string;
  readonly mastermindName: string;
  readonly board: string;
  readonly legCount: number;
  readonly completedLegCount: number;
  readonly isComplete: boolean;
  readonly legs: readonly MyGauntletLegProgress[];
}

/**
 * Result of a my-gauntlets fetch. Never throws (`status: 0` on network
 * failure). `gauntlets` is present only on HTTP 200.
 */
export interface MyGauntletsResult {
  readonly status: number;
  readonly gauntlets: MyGauntletProgress[] | null;
  readonly error: string | null;
}

/**
 * Fetch the authenticated player's per-gauntlet progress (WP-344 /
 * D-24131 §8b). Progress uses the exact public-board predicate, so the
 * numbers always agree with legends.legendary-arena.com.
 *
 * @param authToken The bearer token, or `null` for an unauthenticated caller.
 * @returns The my-gauntlets result (never throws; `status: 0` on network failure).
 */
export async function fetchMyGauntlets(
  authToken: string | null,
): Promise<MyGauntletsResult> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/gauntlets'), {
      method: 'GET',
      headers:
        authToken === null ? {} : { Authorization: `Bearer ${authToken}` },
    });
  } catch {
    return { status: 0, gauntlets: null, error: null };
  }
  if (response.status === 200) {
    const body = (await response.json()) as { gauntlets: MyGauntletProgress[] };
    return { status: 200, gauntlets: body.gauntlets, error: null };
  }
  return {
    status: response.status,
    gauntlets: null,
    error: await readErrorCode(response),
  };
}
