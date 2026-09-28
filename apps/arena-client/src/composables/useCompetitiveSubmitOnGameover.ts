/**
 * Submit-on-gameover composable — Arena Client (WP-339 / WP-5b)
 *
 * Watches the live UIState snapshot and, on the gameover transition, submits the
 * finished match's competitive score exactly once (for an authenticated player).
 * The client submits only the `matchId` — the server resolves the replay,
 * captures on-demand, verifies, auto-publishes, and scores (WP-338). A guest
 * (no bearer token) is never submitted; the status becomes `'guest'` so the UI
 * can prompt a sign-in.
 *
 * D-24630 — a signed-in player whose broker session expired mid-match also has
 * no token at gameover, but their seat is still owned by the account bound at
 * join (D-24119), so the match CAN be saved once they sign back in. That case is
 * `'session-expired'`, not `'guest'`: the composable stashes a pending-submit
 * marker for the `?route=login` round trip and fires the deferred submit as soon
 * as a token appears. The broker SDK has no silent-refresh API (Hanko SDK 2.6
 * exposes only `validateSession`), so signing in again is the only way back.
 *
 * Mounted at `PlayViewport` (which holds the `matchId` prop, D-16501, and reads
 * the shared uiState store), so a single instance covers both the desktop and
 * mobile play surfaces.
 *
 * Layer-boundary: imports no engine/server runtime — it talks to the server via
 * the `competitionApi` HTTP wrappers only.
 *
 * Authority: WP-339 §Scope (In) §B; EC-369; D-24126 (the server surfaces);
 * D-24630 (expired-session recovery).
 */

import { ref, watch, type Ref } from 'vue';

import { useUiStateStore } from '../stores/uiState';
import { useAuthStore } from '../stores/auth';
import {
  submitCompetitiveScore,
  type CompetitiveSeatIdentity,
  type MyCompetitiveScore,
} from '../lib/api/competitionApi';
import {
  clearPendingScoreSubmit,
  hasPendingScoreSubmitFor,
  stashPendingScoreSubmit,
} from '../lib/pendingScoreSubmit';

/**
 * The lifecycle of a post-match submission, surfaced to the UI:
 * - `idle` — no gameover yet (or re-armed for a new match).
 * - `submitting` — the POST is in flight.
 * - `submitted` — accepted, a fresh record was created (HTTP 200, `wasExisting: false`).
 * - `already` — accepted idempotently, the score was already submitted (200, `wasExisting: true`).
 * - `failed` — a non-200 or a network failure.
 * - `guest` — the player is not signed in; nothing was submitted.
 * - `session-expired` — the player's sign-in expired (or the server rejected the
 *   token) on an account-bound seat (D-24630); nothing is submitted YET — the
 *   submit fires once they sign back in.
 * - `ineligible` — the match is permanently not eligible to be scored (not a
 *   ranked-gauntlet loadout); NOT an error and NOT retriable (WP-465).
 * - `ended-early` — the players ended the match early (the `endedEarly` gameover
 *   marker, WP-502 / D-24306), so it is never scored whatever its loadout; NOT an
 *   error and NOT retriable. Distinct from `ineligible` so the UI never claims an
 *   early-ended ranked-gauntlet match "isn't part of a ranked gauntlet".
 */
export type SubmissionStatus =
  | 'idle'
  | 'submitting'
  | 'submitted'
  | 'already'
  | 'failed'
  | 'guest'
  | 'session-expired'
  | 'ineligible'
  | 'ended-early';

/**
 * Optional account-binding evidence for telling an expired session apart from a
 * true guest (D-24630), plus a query-string test seam.
 */
export interface SubmitOnGameoverOptions {
  /** The finished match's per-seat identity roster (public read, fetched on gameover). */
  readonly seatIdentities?: Ref<readonly CompetitiveSeatIdentity[] | null>;
  /** This viewer's bgio seat id (`''` when unknown). */
  readonly playerId?: Ref<string>;
  /** Returns the current page query string for the pending-submit marker. */
  readonly readCurrentSearch?: () => string;
}

/**
 * Read `window.location.search`, or `''` outside a browser.
 *
 * @returns The current query string.
 */
function readWindowSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search;
}

/**
 * Whether the roster shows this viewer's seat bound to an account at join.
 *
 * @param roster The per-seat roster, or null when not (yet) fetched.
 * @param playerId This viewer's seat id.
 * @returns `true` when the seat is a human seat carrying an account handle.
 */
function isSeatAccountBound(
  roster: readonly CompetitiveSeatIdentity[] | null,
  playerId: string,
): boolean {
  if (roster === null || playerId === '') {
    return false;
  }
  for (const seat of roster) {
    if (seat.playerId === playerId) {
      // why: a null handle covers bots, guests AND a handleless account, so only
      // a non-null handle is positive evidence; its absence proves nothing.
      return seat.isBot === false && seat.handle !== null;
    }
  }
  return false;
}

/**
 * Watch for gameover and submit the match's competitive score once.
 *
 * @param matchId A ref to the current live match id (`''` when no live match).
 * @param options Optional account-binding evidence (roster + seat) and a
 *   query-string seam; see {@link SubmitOnGameoverOptions}.
 * @returns `{ submissionStatus, submittedScore }` — a reactive status plus the
 *   server-returned competitive score record (WP-578), which the endgame panel
 *   renders. `submittedScore` is `null` until a successful submit and for every
 *   non-scoring path (guest / expired session / failed / ineligible / early-end).
 */
export function useCompetitiveSubmitOnGameover(
  matchId: Ref<string>,
  options: SubmitOnGameoverOptions = {},
): {
  submissionStatus: Ref<SubmissionStatus>;
  submittedScore: Ref<MyCompetitiveScore | null>;
} {
  const uiStateStore = useUiStateStore();
  const authStore = useAuthStore();

  const submissionStatus: Ref<SubmissionStatus> = ref('idle');
  // why: WP-578 — the server already returns the scored record on a successful
  // submit, so the endgame panel reads it from here rather than re-fetching. It
  // stays null for guests, failures, and non-scoring matches.
  const submittedScore: Ref<MyCompetitiveScore | null> = ref(null);
  // why: the gameover snapshot recurs on every server frame, so a guard fires
  // the submit at most once per match. `submittedForMatch` records which match
  // it fired for, so the matchId watch below can re-arm for a new match.
  let hasSubmitted = false;
  let submittedForMatch: string | null = null;
  // why: D-24630 — a token seen at any point on this mount means the player was
  // signed in while playing; a null token at gameover is then an expired or
  // cleared session, not a guest. Not reset on re-arm: the broker session is
  // per-tab, not per-match.
  let hasSeenTokenThisMount = authStore.token !== null;
  const readCurrentSearch = options.readCurrentSearch ?? readWindowSearch;

  /**
   * Whether a no-token gameover is an expired session on an account-bound seat
   * rather than a true guest: a token was held earlier on this mount, a
   * pending-submit marker exists for the match (the player is returning from
   * sign-in), or the roster binds this seat to an account.
   *
   * @param currentMatchId The finished match.
   * @returns `true` for the expired-session case.
   */
  function isExpiredSession(currentMatchId: string): boolean {
    if (hasSeenTokenThisMount || hasPendingScoreSubmitFor(currentMatchId)) {
      return true;
    }
    return isSeatAccountBound(
      options.seatIdentities?.value ?? null,
      options.playerId?.value ?? '',
    );
  }

  /**
   * Latch `'session-expired'` (stashing the pending-submit marker for the login
   * round trip) for an account-bound seat.
   *
   * @param currentMatchId The finished match.
   */
  function markSessionExpired(currentMatchId: string): void {
    submissionStatus.value = 'session-expired';
    stashPendingScoreSubmit(currentMatchId, readCurrentSearch());
  }

  /**
   * POST the submit and map the result onto the status. Shared by the gameover
   * submit and the deferred post-sign-in submit (D-24630).
   *
   * @param token The bearer token.
   * @param currentMatchId The finished match.
   */
  async function postSubmit(token: string, currentMatchId: string): Promise<void> {
    const priorStatus = submissionStatus.value;
    submissionStatus.value = 'submitting';
    const result = await submitCompetitiveScore(token, currentMatchId);
    if (result.status === 401) {
      // why: D-24630 — the store still held a token the server no longer accepts
      // (the broker's periodic expiry check had not fired yet). Same recovery as
      // a cleared token: offer sign-in-to-save, and keep the marker.
      markSessionExpired(currentMatchId);
      return;
    }
    // why: any answer other than an auth rejection settles a deferred submit, so
    // the marker must not re-trigger it on a later reload of this tab.
    clearPendingScoreSubmit();
    if (result.status === 200) {
      submissionStatus.value = result.wasExisting === true ? 'already' : 'submitted';
      // why: WP-578 — surface the scored record (rawScore / finalScore) so the
      // endgame panel can show the competitive score the server just computed.
      submittedScore.value = result.record;
    } else if (result.error === 'par_not_published') {
      // why: WP-465 — `par_not_published` means the finished match is not a
      // ranked-gauntlet loadout, so it is PERMANENTLY not eligible to be scored —
      // distinct from a retriable failure. `result.error` is an intentional
      // cross-layer string couple mirroring the server's `SubmissionRejectionReason`
      // (apps/server/src/competition/competition.types.ts); the client cannot import
      // that enum across the layer boundary, so it matches by value. Any other /
      // renamed reason falls through to `'failed'` by design (safe, no throw).
      submissionStatus.value = 'ineligible';
    } else if (result.error === 'not_owner' && priorStatus === 'guest') {
      // why: D-24630 — a deferred submit that started from 'guest' (a token that
      // hydrated after gameover) for an account owning no seat in this match: it
      // really was a guest seat, so keep the guest copy, not a submit error.
      submissionStatus.value = 'guest';
    } else {
      submissionStatus.value = 'failed';
    }
  }

  /**
   * Submit the current match's score once. A missing token is a no-op that
   * sets `'guest'` or, for an account-bound seat, `'session-expired'`; an
   * authenticated player POSTs `{ matchId }` and the result maps to
   * `submitted` / `already`, `ineligible` (a `par_not_published` rejection — the
   * match is not a ranked-gauntlet loadout), `session-expired` (401), or `failed`.
   */
  async function submitOnce(): Promise<void> {
    if (hasSubmitted) {
      return;
    }
    const currentMatchId = matchId.value;
    if (currentMatchId === '') {
      // why: no live match id (a non-live mount) — nothing to submit.
      return;
    }

    // why: WP-502 / D-24306 — a match the players ended early (the endedEarly
    // gameover marker) is never a ranked result, so skip the submission entirely.
    // The server is the authority and also rejects it (ended_early); this client
    // skip avoids a doomed POST. Permanent + non-retriable, so never 'failed';
    // its own 'ended-early' status (not 'ineligible') because the loadout may well
    // be a ranked gauntlet — the par_not_published copy would be false here.
    // Checked before the guest check, so a guest's early end also lands here.
    if (uiStateStore.snapshot?.gameOver?.endedEarly === true) {
      hasSubmitted = true;
      submittedForMatch = currentMatchId;
      submissionStatus.value = 'ended-early';
      return;
    }

    hasSubmitted = true;
    submittedForMatch = currentMatchId;

    const token = authStore.token;
    if (token === null) {
      // why: guests cannot own or submit a replay (the ownership + submission
      // are account-scoped) — never POST; prompt a sign-in via the status.
      // D-24630: an expired session on an account-bound seat is told apart here.
      if (isExpiredSession(currentMatchId)) {
        markSessionExpired(currentMatchId);
      } else {
        submissionStatus.value = 'guest';
      }
      return;
    }

    await postSubmit(token, currentMatchId);
  }

  // why: gameover is engine truth, read PASSIVELY from the live snapshot — the
  // presence of `snapshot.gameOver` marks the match as over. `immediate` covers
  // a mount that is already at gameover (e.g. a reconnect after the match ended).
  watch(
    () => uiStateStore.snapshot?.gameOver !== undefined,
    (isGameOver) => {
      if (isGameOver) {
        void submitOnce();
      }
    },
    { immediate: true },
  );

  // why: D-24630 — a token that appears after a no-token gameover (the broker
  // hydrating late on a reload that lands at gameover, or the player returning
  // from sign-in via the pending-submit marker) fires the deferred submit. The
  // server resolves ownership from the seat bound at join (D-24119), so the
  // re-signed-in account can still save this match.
  watch(
    () => authStore.token,
    (nextToken) => {
      if (nextToken === null) {
        return;
      }
      hasSeenTokenThisMount = true;
      const status = submissionStatus.value;
      const currentMatchId = matchId.value;
      if (
        (status === 'guest' || status === 'session-expired') &&
        currentMatchId !== '' &&
        submittedForMatch === currentMatchId
      ) {
        void postSubmit(nextToken, currentMatchId);
      }
    },
  );

  // why: D-24630 — the public seat roster lands after gameover; when it shows
  // this seat bound to an account, an earlier 'guest' latch was really an expired
  // session (e.g. the session lapsed before a reload, so this mount never saw a
  // token). Upgrades the copy only; the submit still waits for a token.
  const seatIdentities = options.seatIdentities;
  if (seatIdentities !== undefined) {
    watch(seatIdentities, () => {
      const currentMatchId = matchId.value;
      if (
        submissionStatus.value === 'guest' &&
        currentMatchId !== '' &&
        isExpiredSession(currentMatchId)
      ) {
        markSessionExpired(currentMatchId);
      }
    });
  }

  // why: re-arm when the mounted match changes so a subsequent live match on the
  // same viewport instance submits its own score.
  watch(matchId, (nextMatchId) => {
    if (nextMatchId !== submittedForMatch) {
      hasSubmitted = false;
      submittedForMatch = null;
      submissionStatus.value = 'idle';
      // why: WP-578 — clear the previous match's score when re-arming for a new
      // match on the same viewport instance.
      submittedScore.value = null;
    }
  });

  return { submissionStatus, submittedScore };
}
