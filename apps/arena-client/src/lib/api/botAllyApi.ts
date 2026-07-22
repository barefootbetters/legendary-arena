/**
 * botAllyApi.ts — arena-client HTTP wrapper for the bot-ally status read
 * (WP-415 / EC-450 / D-24231).
 *
 * Wraps WP-414's `GET /api/match/:matchId/bot-ally-status` (`guest` auth — the
 * unguessable `matchId` is the capability), which reports whether a match's bot
 * ally is still driving its seat(s), and — when it has stopped — the server's
 * public-safe co-op `fault_message`. The play surface polls this through
 * {@link fetchBotAllyStatus} so a human on a stopped bot-ally match is never left
 * frozen with no signal.
 *
 * Unlike the never-throws `matchLagnApi`, this wrapper THROWS a full-sentence
 * error on a non-2xx (or an unparseable body); the {@link useBotAllyStatus}
 * caller owns the fail-soft policy (a transient poll error is swallowed and
 * retried, never rendered as a stopped bot).
 *
 * The client reaches the server ONLY over HTTP (no runtime `@legendary-arena/
 * registry` or `server` import — layer boundary).
 *
 * Authority: WP-415 §Scope (In) §A; EC-450; D-24231; WP-414 (endpoint contract);
 * D-16101 (`buildApiUrl`).
 */

import { buildApiUrl } from './apiBaseUrl';

/** The bot-ally driver status label the server reports for a match. */
export type BotAllyStatusLabel =
  | 'active'
  | 'faulted'
  | 'abandoned'
  | 'exhausted'
  | 'completed'
  | 'absent';

/** The typed `{ driving, status, message }` body of the status surface. */
export interface BotAllyStatus {
  /** True only while the bot ally is actively driving (`status === 'active'`). */
  readonly driving: boolean;
  /** The driver status label; `absent` when the match has no bot ally at all. */
  readonly status: BotAllyStatusLabel;
  /** The public-safe co-op message when faulted, else `null`. */
  readonly message: string | null;
}

/**
 * Fetch a match's bot-ally status from `GET /api/match/:matchId/bot-ally-status`.
 *
 * @param matchId - The match id (from the `?match=` URL parameter).
 * @returns The typed `{ driving, status, message }` status body.
 * @throws A full-sentence Error on a network failure, a non-200 response, or an
 *   unparseable body — the caller decides how to fail soft.
 */
export async function fetchBotAllyStatus(matchId: string): Promise<BotAllyStatus> {
  let response: Response;
  try {
    response = await fetch(
      buildApiUrl(`/api/match/${encodeURIComponent(matchId)}/bot-ally-status`),
      { method: 'GET' },
    );
  } catch (networkError) {
    const detail = networkError instanceof Error ? networkError.message : String(networkError);
    throw new Error(
      `The bot-ally status request for match "${matchId}" could not reach the server ` +
        `(network error: ${detail}). The caller should retry on the next poll.`,
    );
  }
  if (response.status !== 200) {
    throw new Error(
      `The bot-ally status request for match "${matchId}" returned HTTP ${response.status}; ` +
        'expected 200. The caller should retry on the next poll.',
    );
  }
  try {
    return (await response.json()) as BotAllyStatus;
  } catch (parseError) {
    const detail = parseError instanceof Error ? parseError.message : String(parseError);
    throw new Error(
      `The bot-ally status response for match "${matchId}" was not valid JSON ` +
        `(${detail}). The caller should retry on the next poll.`,
    );
  }
}
