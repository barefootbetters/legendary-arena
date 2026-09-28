/**
 * Pending score-submit marker — Arena Client (D-24630).
 *
 * When a signed-in player's broker session expires mid-match, the gameover
 * submission finds no bearer token and cannot POST. The seat is still owned by
 * the account bound at join (D-24119), so the server accepts the same
 * `submitCompetitiveScore(token, matchId)` call once the player signs back in.
 * This module keeps the finished match's live URL (`?match=&player=&credentials=`)
 * across the `?route=login` round trip, so the LoginPage can send the player
 * back to the match and the submit composable can fire the deferred submit.
 *
 * Storage choice: `sessionStorage`, NOT the login URL. The live URL carries the
 * seat `credentials`; parking them in `?returnTo=` would copy them into the login
 * page's URL (browser history, the broker widget's referrer). `sessionStorage` is
 * per-tab and survives the same-tab navigation to `?route=login` and back.
 *
 * Posture: zero engine import, zero network egress. Every storage access is
 * guarded — a missing or throwing `sessionStorage` is a silent no-op, and the
 * endgame falls back to the plain sign-in copy.
 */

// why: namespaced like the matchSetupSession keys so it is greppable in a
// browser inspector and never collides with another sessionStorage user.
const PENDING_SCORE_SUBMIT_KEY = 'legendary-arena:pending-score-submit';

/**
 * The live-route coordinates of a finished match whose score submission is
 * waiting on the player signing back in.
 */
export interface PendingScoreSubmit {
  readonly matchId: string;
  readonly playerId: string;
  readonly credentials: string;
}

/**
 * Returns the live `sessionStorage`, or `null` when it is unavailable.
 *
 * @returns The Storage instance, or null in a non-browser / storage-disabled
 *   context.
 */
function getSessionStorageSafely(): Storage | null {
  // why: some privacy modes throw on the mere property access, so the read is
  // wrapped; a missing storage degrades to "no pending submit", never a crash.
  try {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }
    return sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Parse a live-route query string into its match / player / credentials triple.
 *
 * @param search A `window.location.search`-shaped string (leading `?` optional).
 * @returns The triple, or `null` when any of the three is missing or empty.
 */
export function parseLiveSearch(search: string): PendingScoreSubmit | null {
  const params = new URLSearchParams(search);
  const matchId = params.get('match');
  const playerId = params.get('player');
  const credentials = params.get('credentials');
  if (
    matchId === null || matchId === '' ||
    playerId === null || playerId === '' ||
    credentials === null || credentials === ''
  ) {
    return null;
  }
  return { matchId, playerId, credentials };
}

/**
 * Build the relative live-route URL for a pending submit. Rebuilt from the three
 * validated fields (never a stored raw string), so the post-login navigation can
 * only ever land on a same-origin `?match=` page.
 *
 * @param pending The pending submit to return to.
 * @returns A relative `?match=…&player=…&credentials=…` URL.
 */
export function buildLiveReturnUrl(pending: PendingScoreSubmit): string {
  const params = new URLSearchParams();
  params.set('match', pending.matchId);
  params.set('player', pending.playerId);
  params.set('credentials', pending.credentials);
  return '?' + params.toString();
}

/**
 * Record that `matchId`'s score is waiting on a sign-in. The seat coordinates
 * are taken from the current live URL; a mismatched or incomplete URL (a
 * non-live mount) records nothing.
 *
 * @param matchId The finished match whose submit is deferred.
 * @param currentSearch The current page's query string (`window.location.search`).
 */
export function stashPendingScoreSubmit(matchId: string, currentSearch: string): void {
  const live = parseLiveSearch(currentSearch);
  if (live === null || live.matchId !== matchId) {
    return;
  }
  const storage = getSessionStorageSafely();
  if (storage === null) {
    return;
  }
  try {
    storage.setItem(PENDING_SCORE_SUBMIT_KEY, JSON.stringify(live));
  } catch {
    // why: a quota / privacy-mode write failure only loses the auto-return; the
    // player can still reopen the match from the lobby and the endgame re-offers
    // the sign-in, so it is safe to ignore.
  }
}

/**
 * Read the pending submit, if one is stashed and well-formed.
 *
 * @returns The pending submit, or `null` when absent, malformed, or unreadable.
 */
export function readPendingScoreSubmit(): PendingScoreSubmit | null {
  const storage = getSessionStorageSafely();
  if (storage === null) {
    return null;
  }
  let raw: string | null;
  try {
    raw = storage.getItem(PENDING_SCORE_SUBMIT_KEY);
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PendingScoreSubmit>;
    if (
      typeof parsed.matchId !== 'string' || parsed.matchId === '' ||
      typeof parsed.playerId !== 'string' || parsed.playerId === '' ||
      typeof parsed.credentials !== 'string' || parsed.credentials === ''
    ) {
      return null;
    }
    return {
      matchId: parsed.matchId,
      playerId: parsed.playerId,
      credentials: parsed.credentials,
    };
  } catch {
    // why: a malformed entry (hand-edited, or a future shape) is treated as
    // absent — the endgame then falls back to the plain sign-in copy.
    return null;
  }
}

/**
 * Whether a pending submit is stashed for `matchId`.
 *
 * @param matchId The match to check.
 * @returns `true` when the stashed pending submit belongs to `matchId`.
 */
export function hasPendingScoreSubmitFor(matchId: string): boolean {
  const pending = readPendingScoreSubmit();
  return pending !== null && pending.matchId === matchId;
}

/**
 * Clear the pending submit (after the deferred submit settles).
 */
export function clearPendingScoreSubmit(): void {
  const storage = getSessionStorageSafely();
  if (storage === null) {
    return;
  }
  try {
    storage.removeItem(PENDING_SCORE_SUBMIT_KEY);
  } catch {
    // why: a failed removal leaves a stale marker for a match that already
    // submitted; a later deferred submit for it is idempotent ('already').
  }
}
