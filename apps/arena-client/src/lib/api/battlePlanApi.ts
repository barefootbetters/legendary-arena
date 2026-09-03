/**
 * Battle Plan API Client — Arena Client (WP-637 / EC-672 / D-24450)
 *
 * Typed `fetch` wrappers for the two per-match Battle Plan endpoints shipped by
 * WP-635:
 *
 *   * GET /api/match/:matchId/battle-plan — read the shared three-phase document
 *   * PUT /api/match/:matchId/battle-plan — upsert one phase's text { phase, text }
 *
 * Consumed by `useBattlePlan` / `BattlePlanPanel.vue`. The response shapes are
 * mirrored inline by structural compatibility with the server
 * `apps/server/src/match/battlePlan.types.ts` (`BattlePlanView` /
 * `BattlePlanResponse`) — the engine/server-isolation rule forbids importing
 * server-layer types (the `matchInvitesApi.ts` precedent). This is a plain
 * REST wrapper over the WP-635 endpoints: it never touches `G`/`ctx`/`UIState`
 * and never issues a boardgame.io move (the client-move transport is untouched).
 *
 * Authority: WP-637 §Scope A; EC-672 §Locked Values; D-24450; WP-161
 * (`buildApiUrl`); WP-160 (bearer).
 */

import { buildApiUrl } from './apiBaseUrl';

/**
 * A Battle Plan phase — the closed set of three lifecycle-tied phases mirrored
 * from the server `BattlePlanPhase` union. The PUT `phase` field is one of these.
 */
export type BattlePlanPhase = 'pre_battle' | 'battle_adjustments' | 'post_battle';

/**
 * The client-facing Battle Plan document. Mirrors the server `BattlePlanView` —
 * each phase is `null` until a participant writes it; `updatedByExtId` is
 * deliberately omitted server-side (never exposed to co-participants, D-5201).
 */
export interface BattlePlanView {
  readonly matchId: string;
  readonly preBattle: string | null;
  readonly battleAdjustments: string | null;
  readonly postBattle: string | null;
  readonly updatedAt: string;
}

// why: client-local mirror of the server's `BattlePlanErrorCode` union in
// apps/server/src/match/battlePlan.types.ts. The engine/server-isolation rule
// forbids importing server-layer types, so the five codes are mirrored here; the
// drift test in battlePlanApi.test.ts asserts set-equality with the server union,
// failing loudly if it moves. Any response code this set does not name (a 401
// session code, or any future code) narrows to null → a generic error banner.
export const BATTLE_PLAN_API_ERROR_CODES = [
  'invalid_request',
  'unknown_phase',
  'text_too_long',
  'not_a_participant',
  'internal_error',
] as const;

/**
 * Closed set of failure codes the Battle Plan endpoints may return in their
 * `{ error }` body. Client-local mirror of the server union.
 */
export type BattlePlanApiErrorCode = (typeof BATTLE_PLAN_API_ERROR_CODES)[number];

/**
 * Result discriminator for the Battle Plan fetch wrappers. Mirrors the
 * `matchInvitesApi` `Result<T>` shape: a transport failure is `{ ok: false,
 * status: 0, code: null }`; a non-2xx carries the HTTP status and the narrowed
 * error code (or null when the code is outside the closed set).
 */
export type BattlePlanApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; code: BattlePlanApiErrorCode | null };

/**
 * Narrow an unknown response-body `error` value to the closed error-code set.
 *
 * @param raw The `error` field from a non-2xx response body.
 * @returns The matching code, or null when it is not one of the five codes.
 */
function narrowBattlePlanCode(raw: unknown): BattlePlanApiErrorCode | null {
  if (typeof raw !== 'string') {
    return null;
  }
  for (const knownCode of BATTLE_PLAN_API_ERROR_CODES) {
    if (knownCode === raw) {
      return knownCode;
    }
  }
  return null;
}

/**
 * Parse a non-2xx Battle Plan response into the failure branch (reads
 * `body.error`). A malformed/empty body surfaces the status with a null code.
 *
 * @param response The non-2xx fetch response.
 * @returns The failure branch of the result discriminator.
 */
async function parseBattlePlanFailure(
  response: Response,
): Promise<{ ok: false; status: number; code: BattlePlanApiErrorCode | null }> {
  let code: BattlePlanApiErrorCode | null = null;
  try {
    const body = (await response.json()) as { error?: unknown };
    code = narrowBattlePlanCode(body.error);
  } catch {
    // why: a malformed/empty body is a transport failure; surface the status
    // alone and leave the code null so the UI shows a generic banner.
    code = null;
  }
  return { ok: false, status: response.status, code };
}

/** Build headers, attaching the bearer token only when non-null. */
function authHeaders(authToken: string | null): Record<string, string> {
  return authToken === null ? {} : { Authorization: `Bearer ${authToken}` };
}

/**
 * Read the current Battle Plan for a match
 * (`GET /api/match/:matchId/battle-plan`). Returns the document on 200 (its
 * `battlePlan` is null when no plan row exists yet); a typed failure code
 * otherwise (`not_a_participant` for a non-seated caller, or a null code for a
 * 401 session code / transport failure).
 *
 * @param matchId The live match whose plan to read.
 * @param authToken The caller's bearer token, or null.
 * @returns The `{ battlePlan }` envelope, or a typed failure.
 */
export async function fetchBattlePlan(
  matchId: string,
  authToken: string | null,
): Promise<BattlePlanApiResult<{ battlePlan: BattlePlanView | null }>> {
  let response: Response;
  try {
    response = await fetch(
      buildApiUrl(`/api/match/${encodeURIComponent(matchId)}/battle-plan`),
      { method: 'GET', headers: authHeaders(authToken) },
    );
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseBattlePlanFailure(response);
  }
  const body = (await response.json()) as { battlePlan: BattlePlanView | null };
  return { ok: true, value: { battlePlan: body.battlePlan } };
}

/**
 * Upsert one phase of a match's Battle Plan
 * (`PUT /api/match/:matchId/battle-plan` with `{ phase, text }`). Returns the
 * full document the server just wrote on 200; a typed failure code otherwise
 * (`text_too_long` / `unknown_phase` / `invalid_request` — 400; `not_a_participant`
 * — 403; a null code for a 401 session code / transport failure).
 *
 * @param matchId The live match whose plan to write.
 * @param phase The phase whose text to replace.
 * @param text The new phase body (an empty string clears the phase).
 * @param authToken The caller's bearer token, or null.
 * @returns The updated `{ battlePlan }` envelope, or a typed failure.
 */
export async function updateBattlePlanPhase(
  matchId: string,
  phase: BattlePlanPhase,
  text: string,
  authToken: string | null,
): Promise<BattlePlanApiResult<{ battlePlan: BattlePlanView }>> {
  let response: Response;
  try {
    response = await fetch(
      buildApiUrl(`/api/match/${encodeURIComponent(matchId)}/battle-plan`),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(authToken) },
        body: JSON.stringify({ phase, text }),
      },
    );
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseBattlePlanFailure(response);
  }
  const body = (await response.json()) as { battlePlan: BattlePlanView };
  return { ok: true, value: { battlePlan: body.battlePlan } };
}
