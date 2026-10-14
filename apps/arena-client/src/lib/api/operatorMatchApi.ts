/**
 * Operator Match API Client — Arena Client (WP-804 / EC-841 / D-24689 §5–§6).
 *
 * Typed `fetch` wrappers for the three `admin-session-required` operator-match
 * routes WP-802 shipped: the eligibility probe, the operator create-with-bot,
 * and the whole-board read of an operator match.
 *
 * Layer-boundary contract: the operator view types come from
 * `@legendary-arena/game-engine` as TYPES ONLY (the `.` surface). The bot
 * decision record is not an engine export (it lives in the server's
 * `operatorBotDecisions.ts`), so its wire shape is declared inline here by
 * structural compatibility, as `adminBillingApi.ts` does.
 *
 * URLs go through `buildApiUrl` (`VITE_API_BASE_URL`), the `lib/api/*`
 * convention, and every call carries `Authorization: Bearer <token>`.
 */

import type { MatchConfiguration, OperatorView } from '@legendary-arena/game-engine';

import { buildApiUrl } from './apiBaseUrl';

/** One bot decision in an operator match, mirroring the server's `OperatorBotDecision`. */
export interface OperatorBotDecisionWire {
  turn: number;
  seat: string;
  isForced: boolean;
  move: { name: string; args: unknown };
  decisionLog: readonly string[];
  legalMoveCount: number;
}

/** The body of `GET /api/admin/operator-match/:matchId/board` on HTTP 200. */
export interface OperatorBoardResponse {
  matchId: string;
  operatorView: OperatorView;
  botDecisions: readonly OperatorBotDecisionWire[];
}

/** The result of {@link fetchOperatorBoard}; it never throws. */
export type OperatorBoardResult =
  | { ok: true; value: OperatorBoardResponse }
  | { ok: false; status: number; error: string };

/**
 * Ask the server whether the signed-in account may use the operator tools.
 *
 * // why: anything but a 200 means "not an operator", silently — a non-admin
 * gets a 403 and a lapsed session a 401, and neither is an error worth showing.
 * Hiding the operator UI protects nothing on its own; the server gate on every
 * operator route (D-15902) is the real protection.
 *
 * @param authToken The bearer token of the signed-in account.
 * @returns `true` only for HTTP 200 with `isOperator === true`; never throws.
 */
export async function fetchOperatorEligibility(authToken: string): Promise<boolean> {
  try {
    const response = await fetch(buildApiUrl('/api/admin/operator-match/eligibility'), {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (response.status !== 200) {
      return false;
    }
    const body = (await response.json()) as { isOperator?: unknown } | null;
    return body?.isOperator === true;
  } catch {
    // why: a network failure or an unparseable body is "not an operator" too;
    // the probe must never throw into the lobby or the play surface.
    return false;
  }
}

/**
 * Create an operator match with a bot ally. The body is the same one
 * `createMatchWithBot` sends to the public route.
 *
 * @param config The match configuration (composition plus envelope flags).
 * @param seatCount Total seats to allocate.
 * @param botCount How many seats the bot ally fills.
 * @param policy The bot policy.
 * @param authToken The admin's bearer token.
 * @returns The server-assigned matchId.
 * @throws Error with a full-sentence message on a non-2xx response.
 */
export async function createOperatorMatchWithBot(
  config: MatchConfiguration,
  seatCount: number,
  botCount: number,
  policy: 'competent' | 'random',
  authToken: string,
): Promise<{ matchId: string }> {
  const endpoint = buildApiUrl('/api/admin/operator-match/create-with-bot');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ numPlayers: seatCount, botCount, policy, setupData: config }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to create an operator match at ${endpoint}: the server returned HTTP ${response.status}. ${errorBody}`,
    );
  }
  const body = (await response.json()) as { matchId: string };
  return { matchId: body.matchId };
}

/**
 * Read the error text from a non-2xx board response. 401 / 403 answer
 * `{ code, reason }` and 404 / 409 / 500 answer `{ error }`.
 *
 * @param response The non-2xx response.
 * @returns The server's message, or a full-sentence fallback naming the status.
 */
async function readBoardError(response: Response): Promise<string> {
  const fallback = `The operator board could not be loaded (HTTP ${response.status}).`;
  try {
    const body = (await response.json()) as { error?: unknown; reason?: unknown } | null;
    if (typeof body?.error === 'string') {
      return body.error;
    }
    if (typeof body?.reason === 'string') {
      return body.reason;
    }
    return fallback;
  } catch {
    // why: an empty or non-JSON error body still gets an honest message.
    return fallback;
  }
}

/**
 * Read the whole board of an operator match.
 *
 * @param matchId The operator match id (encoded into the path).
 * @param authToken The admin's bearer token.
 * @returns `{ ok: true, value }` on 2xx; `{ ok: false, status, error }`
 *   otherwise, with `status: 0` for a thrown fetch. Never throws.
 */
export async function fetchOperatorBoard(
  matchId: string,
  authToken: string,
): Promise<OperatorBoardResult> {
  const path = `/api/admin/operator-match/${encodeURIComponent(matchId)}/board`;
  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch (fetchError) {
    const cause = fetchError instanceof Error ? fetchError.message : String(fetchError);
    return { ok: false, status: 0, error: `The operator board could not be reached: ${cause}` };
  }
  if (!response.ok) {
    return { ok: false, status: response.status, error: await readBoardError(response) };
  }
  try {
    const body = (await response.json()) as OperatorBoardResponse;
    return { ok: true, value: body };
  } catch {
    return {
      ok: false,
      status: response.status,
      error: 'The operator board response was not valid JSON; refresh to try again.',
    };
  }
}
