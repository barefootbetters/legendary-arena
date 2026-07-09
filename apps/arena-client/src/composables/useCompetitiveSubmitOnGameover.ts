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
import { submitCompetitiveScore } from '../lib/api/competitionApi';

/**
 * The lifecycle of a post-match submission, surfaced to the UI:
 * - `idle` — no gameover yet (or re-armed for a new match).
 * - `submitting` — the POST is in flight.
 * - `submitted` — accepted, a fresh record was created (HTTP 200, `wasExisting: false`).
 * - `already` — accepted idempotently, the score was already submitted (200, `wasExisting: true`).
 * - `failed` — a non-200 or a network failure.
 * - `guest` — the player is not signed in; nothing was submitted.
 */
export type SubmissionStatus =
  | 'idle'
  | 'submitting'
  | 'submitted'
  | 'already'
  | 'failed'
  | 'guest';

/**
 * Watch for gameover and submit the match's competitive score once.
 *
 * @param matchId A ref to the current live match id (`''` when no live match).
 * @returns `{ submissionStatus }` — a reactive status the play surface renders.
 */
export function useCompetitiveSubmitOnGameover(matchId: Ref<string>): {
  submissionStatus: Ref<SubmissionStatus>;
} {
  const uiStateStore = useUiStateStore();
  const authStore = useAuthStore();

  const submissionStatus: Ref<SubmissionStatus> = ref('idle');
  // why: the gameover snapshot recurs on every server frame, so a guard fires
  // the submit at most once per match. `submittedForMatch` records which match
  // it fired for, so the matchId watch below can re-arm for a new match.
  let hasSubmitted = false;
  let submittedForMatch: string | null = null;

  /**
   * Submit the current match's score once. A guest (null token) is a no-op that
   * sets `'guest'`; an authenticated player POSTs `{ matchId }` and the result
   * maps to `submitted` / `already` / `failed`.
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
    }
  });

  return { submissionStatus };
}
