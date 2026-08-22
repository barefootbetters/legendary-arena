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
  // why: WP-583 — the server already returns the full component breakdown inside
  // `record.scoreBreakdown` (built + persisted server-side); the endgame screen
  // renders it verbatim. Declared as a local structural shape (mirroring the engine
  // `ScoreBreakdown`) because this file must not import engine/server types.
  // Optional: a record without a breakdown still typechecks and renders the headline.
  readonly scoreBreakdown?: CompetitiveScoreBreakdown;
}

/**
 * Per-penalty-event counts, keyed by the engine's PenaltyEventType members.
 * Declared locally (no engine import) — mirrors the engine `PenaltyEventType`
 * union; the server is authoritative on the keys.
 */
export interface CompetitivePenaltyCounts {
  readonly villainEscaped: number;
  readonly bystanderLost: number;
  readonly schemeTwistNegative: number;
  readonly mastermindTacticUntaken: number;
  readonly scenarioSpecificPenalty: number;
}

/**
 * The derived inputs a breakdown was computed from (structural mirror of the
 * engine `ScoringInputs`).
 */
export interface CompetitiveScoringInputs {
  readonly rounds: number;
  readonly victoryPoints: number;
  readonly bystandersRescued: number;
  readonly escapes: number;
  readonly penaltyEventCounts: CompetitivePenaltyCounts;
}

/**
 * The full competitive score component breakdown, a local structural mirror of
 * the engine `ScoreBreakdown` (the server returns it verbatim inside a record).
 * The client never recomputes these — it renders them.
 */
export interface CompetitiveScoreBreakdown {
  readonly inputs: CompetitiveScoringInputs;
  // why: WP-585 / D-24394 — no weightedRoundCost; the round-cost term was removed
  // from the scoring formula (the rulebook has no round penalty).
  readonly weightedPenaltyTotal: number;
  readonly penaltyBreakdown: CompetitivePenaltyCounts;
  readonly weightedBystanderReward: number;
  readonly weightedVictoryPointReward: number;
  readonly rawScore: number;
  readonly parScore: number;
  readonly finalScore: number;
  readonly scoringConfigVersion: number;
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
