/**
 * useBattlePlan — Arena Client (WP-637 / EC-672 / D-24450)
 *
 * Reactive read + write for a match's shared Battle Plan. Polls
 * `GET /api/match/:matchId/battle-plan` (mirroring `useMatchSeatStatus`'s poll
 * shape) so teammates' edits appear within a few seconds, and exposes a
 * `savePhase` action over `PUT …/battle-plan`.
 *
 * The Battle Plan is non-gameplay per-match data: it flows only through
 * `battlePlanApi` (plain `fetch` + bearer) and NEVER through the boardgame.io
 * client-move transport; it is never written to `G`/`ctx`/`UIState`. The
 * composable READS the `useUiStateStore` snapshot for one thing only — the
 * lifecycle signal that decides which phase is currently editable (D-24450).
 *
 * Authority: WP-637 §Scope B; EC-672 §Locked Values + §Required // why:
 * comments; D-24450; mirrors `useMatchSeatStatus`.
 */

import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';
import { storeToRefs } from 'pinia';

import {
  fetchBattlePlan,
  updateBattlePlanPhase,
  type BattlePlanApiErrorCode,
  type BattlePlanPhase,
  type BattlePlanView,
} from '../lib/api/battlePlanApi';
import { useAuthStore } from '../stores/auth';
import { useUiStateStore } from '../stores/uiState';

// why: a 5s poll mirrors SEAT_POLL_INTERVAL_MS — frequent enough that a
// teammate sees an edit within a couple of seconds, light on the endpoint.
export const BATTLE_PLAN_POLL_INTERVAL_MS = 5000;

/** The outcome of a `savePhase` call: ok, plus the narrowed error code on failure. */
export interface SavePhaseOutcome {
  readonly ok: boolean;
  readonly code: BattlePlanApiErrorCode | null;
}

export interface BattlePlanState {
  /** Loaded pre-battle plan text ('' when unset). */
  readonly preBattle: Ref<string>;
  /** Loaded battle-adjustments text ('' when unset). */
  readonly battleAdjustments: Ref<string>;
  /** Loaded post-battle analysis text ('' when unset). */
  readonly postBattle: Ref<string>;
  /** True once the plan has been read at least once. */
  readonly isLoaded: Ref<boolean>;
  /** Whether the pre-battle phase is currently editable (always, when shown). */
  readonly canEditPreBattle: Ref<boolean>;
  /** Whether the battle-adjustments phase is editable (once the match is in play). */
  readonly canEditBattleAdjustments: Ref<boolean>;
  /** Whether the post-battle phase is editable (once the match is over). */
  readonly canEditPostBattle: Ref<boolean>;
  /** The active (highlighted) phase — the latest lifecycle phase reached. */
  readonly activePhase: Ref<BattlePlanPhase>;
  /** Write one phase's text; updates the loaded snapshot on success. */
  readonly savePhase: (phase: BattlePlanPhase, text: string) => Promise<SavePhaseOutcome>;
}

/**
 * Poll a match's Battle Plan and expose its three phases plus the lifecycle-derived
 * editability. A failed poll preserves the last snapshot so the panel never blanks.
 *
 * @param matchId The live match to read (empty string disables polling).
 * @returns Reactive Battle Plan state + the `savePhase` action.
 */
export function useBattlePlan(matchId: string): BattlePlanState {
  const authStore = useAuthStore();
  const uiStateStore = useUiStateStore();
  const { snapshot } = storeToRefs(uiStateStore);

  const preBattle = ref<string>('');
  const battleAdjustments = ref<string>('');
  const postBattle = ref<string>('');
  const isLoaded = ref<boolean>(false);

  // why: D-24450 — editability derives from the UIState snapshot (the server stays
  // permissive per D-24449; the CLIENT owns the phase window). These are LATCH
  // booleans, not plain computeds off the live snapshot: a phase, once reached,
  // never re-locks — so a match moving from 'play' to 'end', or a snapshot blip,
  // must not take away an already-open editor. pre_battle is always editable when
  // the panel is shown, so it has no latch.
  const hasReachedPlay = ref<boolean>(false);
  const hasReachedGameOver = ref<boolean>(false);

  const canEditPreBattle = computed<boolean>(() => true);
  const canEditBattleAdjustments = computed<boolean>(() => hasReachedPlay.value);
  const canEditPostBattle = computed<boolean>(() => hasReachedGameOver.value);

  const activePhase = computed<BattlePlanPhase>(() => {
    if (hasReachedGameOver.value) {
      return 'post_battle';
    }
    if (hasReachedPlay.value) {
      return 'battle_adjustments';
    }
    return 'pre_battle';
  });

  // why: latch the lifecycle signals as the snapshot advances. battle_adjustments
  // opens once the match has entered the 'play' phase (equivalently game.turn >= 1),
  // NOT merely when a snapshot exists — bgioClient sets the snapshot the moment the
  // client connects, so a non-null snapshot is present in the waiting room / setup,
  // and keying off presence would open the phase before play begins. post_battle
  // opens once gameOver is present. `immediate` evaluates against the snapshot that
  // already exists at mount.
  watch(
    snapshot,
    (current) => {
      if (current?.game?.phase === 'play') {
        hasReachedPlay.value = true;
      }
      if (current?.gameOver !== undefined) {
        // why: gameOver also implies play was reached, so both earlier phases stay
        // editable in the post phase (you can still revise the plan and adjustments).
        hasReachedPlay.value = true;
        hasReachedGameOver.value = true;
      }
    },
    { immediate: true },
  );

  let timer: ReturnType<typeof setInterval> | null = null;

  /** Stop the poll timer (idempotent). */
  function stopPolling(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  /**
   * Copy a loaded plan document into the three phase refs (null → '').
   *
   * @param plan The plan document, or null when no plan row exists yet.
   */
  function applyPlan(plan: BattlePlanView | null): void {
    preBattle.value = plan?.preBattle ?? '';
    battleAdjustments.value = plan?.battleAdjustments ?? '';
    postBattle.value = plan?.postBattle ?? '';
    isLoaded.value = true;
  }

  /**
   * One poll: read the plan and refresh the phase refs. A failed read (transport
   * error, a 403 not-yet-participant, an auth blip) leaves the last snapshot
   * untouched so the panel stays stable rather than blanking mid-match.
   */
  async function pollOnce(): Promise<void> {
    const result = await fetchBattlePlan(matchId, authStore.token);
    if (result.ok !== true) {
      // why: a failed poll is a transport/permission blip, not "the plan cleared" —
      // preserve the last-known text so a teammate's in-progress read stays put.
      return;
    }
    applyPlan(result.value.battlePlan);
  }

  /**
   * Write one phase's text (`PUT …/battle-plan`). On success the returned document
   * refreshes the loaded phase refs; on failure the caller gets the narrowed code
   * to surface a message. The bearer comes from the auth store.
   *
   * @param phase The phase to write.
   * @param text The new phase body (an empty string clears the phase).
   * @returns `{ ok, code }` — the code is the narrowed failure code (or null).
   */
  async function savePhase(
    phase: BattlePlanPhase,
    text: string,
  ): Promise<SavePhaseOutcome> {
    const result = await updateBattlePlanPhase(matchId, phase, text, authStore.token);
    if (result.ok !== true) {
      return { ok: false, code: result.code };
    }
    applyPlan(result.value.battlePlan);
    return { ok: true, code: null };
  }

  onMounted(() => {
    if (matchId === '') {
      return;
    }
    void pollOnce();
    timer = setInterval(() => {
      void pollOnce();
    }, BATTLE_PLAN_POLL_INTERVAL_MS);
  });

  onUnmounted(() => {
    stopPolling();
  });

  return {
    preBattle,
    battleAdjustments,
    postBattle,
    isLoaded,
    canEditPreBattle,
    canEditBattleAdjustments,
    canEditPostBattle,
    activePhase,
    savePhase,
  };
}
