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
 * Mounted at `PlayViewport` (which holds the `matchId` prop, D-16501, and reads
 * the shared uiState store), so a single instance covers both the desktop and
 * mobile play surfaces.
 *
 * Layer-boundary: imports no engine/server runtime — it talks to the server via
 * the `competitionApi` HTTP wrappers only.
 *
 * Authority: WP-339 §Scope (In) §B; EC-369; D-24126 (the server surfaces).
 */

import { ref, watch, type Ref } from 'vue';

import { useUiStateStore } from '../stores/uiState';
import { useAuthStore } from '../stores/auth';
import { submitCompetitiveScore, type MyCompetitiveScore } from '../lib/api/competitionApi';

/**
 * The lifecycle of a post-match submission, surfaced to the UI:
 * - `idle` — no gameover yet (or re-armed for a new match).
 * - `submitting` — the POST is in flight.
 * - `submitted` — accepted, a fresh record was created (HTTP 200, `wasExisting: false`).
 * - `already` — accepted idempotently, the score was already submitted (200, `wasExisting: true`).
 * - `failed` — a non-200 or a network failure.
 * - `guest` — the player is not signed in; nothing was submitted.
 * - `ineligible` — the match is permanently not eligible to be scored (not a
 *   ranked-gauntlet loadout); NOT an error and NOT retriable (WP-465).
 */
export type SubmissionStatus =
  | 'idle'
  | 'submitting'
  | 'submitted'
  | 'already'
  | 'failed'
  | 'guest'
  | 'ineligible';

/**
 * Watch for gameover and submit the match's competitive score once.
 *
 * @param matchId A ref to the current live match id (`''` when no live match).
 * @returns `{ submissionStatus, submittedScore }` — a reactive status plus the
 *   server-returned competitive score record (WP-578), which the endgame panel
 *   renders. `submittedScore` is `null` until a successful submit and for every
 *   non-scoring path (guest / failed / ineligible / early-end).
 */
export function useCompetitiveSubmitOnGameover(matchId: Ref<string>): {
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

  /**
   * Submit the current match's score once. A guest (null token) is a no-op that
   * sets `'guest'`; an authenticated player POSTs `{ matchId }` and the result
   * maps to `submitted` / `already`, `ineligible` (a `par_not_published`
   * rejection — the match is not a ranked-gauntlet loadout), or `failed`.
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
    // skip avoids a doomed POST. Permanent + non-retriable, so it maps to
    // 'ineligible' (mirrors the par_not_published disposition), never 'failed'.
    if (uiStateStore.snapshot?.gameOver?.endedEarly === true) {
      hasSubmitted = true;
      submittedForMatch = currentMatchId;
      submissionStatus.value = 'ineligible';
      return;
    }

    hasSubmitted = true;
    submittedForMatch = currentMatchId;

    const token = authStore.token;
    if (token === null) {
      // why: guests cannot own or submit a replay (the ownership + submission
      // are account-scoped) — never POST; prompt a sign-in via the status.
      submissionStatus.value = 'guest';
      return;
    }

    submissionStatus.value = 'submitting';
    const result = await submitCompetitiveScore(token, currentMatchId);
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
    } else {
      submissionStatus.value = 'failed';
    }
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
