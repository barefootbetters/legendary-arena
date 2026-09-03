<script lang="ts">
import { computed, defineComponent, ref, watch } from 'vue';

import { useBattlePlan } from '../composables/useBattlePlan';
import type { BattlePlanApiErrorCode, BattlePlanPhase } from '../lib/api/battlePlanApi';

/**
 * In-match Battle Plan panel (WP-637). A collapsible fixed-position overlay in the
 * TOP-RIGHT lane (clear of WaitingForPlayersPanel bottom-right and the bottom-left
 * ViewLoadoutButton / DiagnosticExportButton stack). It reads and writes the shared
 * team Battle Plan — one document per match with three lifecycle-tied free-text
 * phases (pre-battle plan, battle adjustments, post-battle analysis) — via
 * `useBattlePlan` (poll GET + savePhase PUT). Which phase is editable derives from
 * the match lifecycle (D-24450); nothing here touches game state.
 *
 * The panel self-sources `matchId` from `?match=` (the ViewLoadoutButton idiom) and
 * self-hides when there is no live match, so it adds no DOM outside real play. It
 * NEVER issues a boardgame.io move and never writes `G`/`ctx`/`UIState`; the only
 * UIState touch is the lifecycle READ inside `useBattlePlan`.
 *
 * Per the vue-sfc-loader separate-compile pipeline (D-6512) this SFC uses
 * `defineComponent({ setup() { return {...} } })` so the template's non-prop
 * bindings reach `_ctx`.
 *
 * @see WP-637 §Scope C; EC-672; DECISIONS.md D-24450.
 */

// why: mirrors WP-635's server cap (apps/server/src/match/battlePlan.logic.ts
// BATTLE_PLAN_PHASE_MAX_LENGTH = 4000). A soft client cap that prevents typing past
// the limit and flags an over-cap draft; the client cannot import a server const
// (the engine/server-isolation rule), so the value is mirrored here.
export const BATTLE_PLAN_PHASE_MAX_LENGTH = 4000;

/** One rendered phase editor's descriptor (label + current gating + draft text). */
interface PhaseEditor {
  readonly phase: BattlePlanPhase;
  readonly label: string;
  readonly help: string;
  readonly text: string;
  readonly canEdit: boolean;
  readonly isActive: boolean;
}

/**
 * Map a Battle Plan failure code to a full-sentence line for the save banner.
 *
 * @param code The narrowed failure code, or null for a generic/transport failure.
 * @returns A human-readable message.
 */
function saveErrorMessage(code: BattlePlanApiErrorCode | null): string {
  if (code === 'not_a_participant') {
    return 'Only players seated in this match can edit the Battle Plan.';
  }
  if (code === 'text_too_long') {
    return 'That phase is too long — please shorten it and save again.';
  }
  // why: the remaining codes (invalid_request / unknown_phase / internal_error) plus
  // a null (401 session code / transport failure) all fall through to one line.
  return 'Couldn’t save the Battle Plan — please try again.';
}

export default defineComponent({
  name: 'BattlePlanPanel',
  setup() {
    // why: the match id is read once from `?match=` (the same source
    // ViewLoadoutButton / WaitingForPlayersPanel use); when absent this is not a
    // live match and the panel self-hides.
    const matchId = new URLSearchParams(window.location.search).get('match') ?? '';
    const hasMatch = matchId !== '';

    const {
      preBattle,
      battleAdjustments,
      postBattle,
      canEditPreBattle,
      canEditBattleAdjustments,
      canEditPostBattle,
      activePhase,
      savePhase,
    } = useBattlePlan(matchId);

    // why: collapsed to a single toggle by default so the panel never covers the
    // board unprompted; a player opens it to read/write the plan.
    const isOpen = ref<boolean>(false);

    // why: local editable drafts, seeded from the polled document. Kept separate
    // from the loaded refs so a background poll never clobbers an in-progress edit
    // (the guard below only reseeds a phase that is neither dirty nor focused).
    const preBattleDraft = ref<string>(preBattle.value);
    const battleAdjustmentsDraft = ref<string>(battleAdjustments.value);
    const postBattleDraft = ref<string>(postBattle.value);

    const preBattleDirty = ref<boolean>(false);
    const battleAdjustmentsDirty = ref<boolean>(false);
    const postBattleDirty = ref<boolean>(false);

    const focusedPhase = ref<BattlePlanPhase | null>(null);
    const isSaving = ref<boolean>(false);
    const savingPhase = ref<BattlePlanPhase | null>(null);
    const saveError = ref<string | null>(null);
    const saveConfirmation = ref<string | null>(null);

    // why: reseed a draft from a fresh poll ONLY when that phase is not being
    // edited (not dirty and not focused), so a teammate's saved text appears while
    // you are idle but never overwrites what you are typing.
    watch(preBattle, (loaded) => {
      if (!preBattleDirty.value && focusedPhase.value !== 'pre_battle') {
        preBattleDraft.value = loaded;
      }
    });
    watch(battleAdjustments, (loaded) => {
      if (!battleAdjustmentsDirty.value && focusedPhase.value !== 'battle_adjustments') {
        battleAdjustmentsDraft.value = loaded;
      }
    });
    watch(postBattle, (loaded) => {
      if (!postBattleDirty.value && focusedPhase.value !== 'post_battle') {
        postBattleDraft.value = loaded;
      }
    });

    const editors = computed<PhaseEditor[]>(() => [
      {
        phase: 'pre_battle',
        label: 'Pre-battle plan',
        help: 'Your plan for the mastermind, scheme, villains, and why these heroes.',
        text: preBattleDraft.value,
        canEdit: canEditPreBattle.value,
        isActive: activePhase.value === 'pre_battle',
      },
      {
        phase: 'battle_adjustments',
        label: 'Battle adjustments',
        help: 'Mid-match adjustments once play is underway.',
        text: battleAdjustmentsDraft.value,
        canEdit: canEditBattleAdjustments.value,
        isActive: activePhase.value === 'battle_adjustments',
      },
      {
        phase: 'post_battle',
        label: 'Post-battle analysis',
        help: 'The debrief once the match is over — what worked?',
        text: postBattleDraft.value,
        canEdit: canEditPostBattle.value,
        isActive: activePhase.value === 'post_battle',
      },
    ]);

    /**
     * Record a draft edit for one phase (explicit per-phase branches so no dynamic
     * property access is used for the three known keys).
     */
    function onDraftInput(phase: BattlePlanPhase, value: string): void {
      saveError.value = null;
      saveConfirmation.value = null;
      if (phase === 'pre_battle') {
        preBattleDraft.value = value;
        preBattleDirty.value = true;
      } else if (phase === 'battle_adjustments') {
        battleAdjustmentsDraft.value = value;
        battleAdjustmentsDirty.value = true;
      } else {
        postBattleDraft.value = value;
        postBattleDirty.value = true;
      }
    }

    /** Read the current draft text for one phase (explicit per-phase branches). */
    function draftFor(phase: BattlePlanPhase): string {
      if (phase === 'pre_battle') {
        return preBattleDraft.value;
      }
      if (phase === 'battle_adjustments') {
        return battleAdjustmentsDraft.value;
      }
      return postBattleDraft.value;
    }

    /** Clear the dirty flag for one phase after a successful save. */
    function clearDirty(phase: BattlePlanPhase): void {
      if (phase === 'pre_battle') {
        preBattleDirty.value = false;
      } else if (phase === 'battle_adjustments') {
        battleAdjustmentsDirty.value = false;
      } else {
        postBattleDirty.value = false;
      }
    }

    /**
     * Save one phase. Guards a re-entrant save and an over-cap draft (a belt-and-
     * suspenders check beside the textarea maxlength), then writes via the composable
     * and surfaces a typed message on failure.
     */
    async function onSave(phase: BattlePlanPhase): Promise<void> {
      if (isSaving.value) {
        return;
      }
      const text = draftFor(phase);
      saveError.value = null;
      saveConfirmation.value = null;
      if (text.length > BATTLE_PLAN_PHASE_MAX_LENGTH) {
        saveError.value = saveErrorMessage('text_too_long');
        return;
      }
      isSaving.value = true;
      savingPhase.value = phase;
      const outcome = await savePhase(phase, text);
      isSaving.value = false;
      savingPhase.value = null;
      if (outcome.ok) {
        clearDirty(phase);
        saveConfirmation.value = 'Battle Plan saved.';
      } else {
        saveError.value = saveErrorMessage(outcome.code);
      }
    }

    /** Track which phase's textarea is focused (poll-clobber guard). */
    function onFocus(phase: BattlePlanPhase): void {
      focusedPhase.value = phase;
    }

    /** Clear the focus tracker when a textarea blurs. */
    function onBlur(): void {
      focusedPhase.value = null;
    }

    /** Toggle the panel open/collapsed. */
    function toggleOpen(): void {
      isOpen.value = !isOpen.value;
    }

    return {
      hasMatch,
      isOpen,
      editors,
      isSaving,
      savingPhase,
      saveError,
      saveConfirmation,
      maxLength: BATTLE_PLAN_PHASE_MAX_LENGTH,
      onDraftInput,
      onSave,
      onFocus,
      onBlur,
      toggleOpen,
    };
  },
});
</script>

<template>
  <div v-if="hasMatch" class="battle-plan" data-testid="battle-plan">
    <button
      v-if="!isOpen"
      type="button"
      class="battle-plan-toggle"
      data-testid="battle-plan-toggle"
      @click="toggleOpen"
    >
      Battle Plan
    </button>
    <div v-else class="battle-plan-body" data-testid="battle-plan-body">
      <div class="battle-plan-header">
        <p class="battle-plan-title">Battle Plan</p>
        <button
          type="button"
          class="battle-plan-collapse"
          data-testid="battle-plan-collapse"
          @click="toggleOpen"
        >
          Hide
        </button>
      </div>
      <p class="battle-plan-shared">Shared with everyone in this match.</p>
      <section
        v-for="editor in editors"
        :key="editor.phase"
        class="battle-plan-phase"
        :class="{ 'battle-plan-phase--active': editor.isActive }"
        :data-testid="`battle-plan-phase-${editor.phase}`"
      >
        <label class="battle-plan-phase-label" :for="`battle-plan-textarea-${editor.phase}`">
          {{ editor.label }}
          <span v-if="editor.isActive" class="battle-plan-active-tag">now</span>
        </label>
        <p class="battle-plan-phase-help">{{ editor.help }}</p>
        <textarea
          :id="`battle-plan-textarea-${editor.phase}`"
          class="battle-plan-textarea"
          :data-testid="`battle-plan-textarea-${editor.phase}`"
          :value="editor.text"
          :maxlength="maxLength"
          :disabled="!editor.canEdit"
          rows="3"
          @input="onDraftInput(editor.phase, ($event.target as HTMLTextAreaElement).value)"
          @focus="onFocus(editor.phase)"
          @blur="onBlur"
        ></textarea>
        <div class="battle-plan-phase-footer">
          <span class="battle-plan-count">{{ editor.text.length }}/{{ maxLength }}</span>
          <button
            type="button"
            class="battle-plan-save"
            :data-testid="`battle-plan-save-${editor.phase}`"
            :disabled="!editor.canEdit || (isSaving && savingPhase === editor.phase)"
            @click="onSave(editor.phase)"
          >
            Save
          </button>
        </div>
        <p v-if="!editor.canEdit" class="battle-plan-locked" data-testid="battle-plan-locked">
          Opens later in the match.
        </p>
      </section>
      <span
        v-if="saveConfirmation !== null"
        class="battle-plan-note"
        data-testid="battle-plan-confirm"
        role="status"
      >
        {{ saveConfirmation }}
      </span>
      <span
        v-else-if="saveError !== null"
        class="battle-plan-error"
        data-testid="battle-plan-error"
        role="status"
      >
        {{ saveError }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* why: a fixed-position panel in the TOP-RIGHT lane, deliberately clear of the
   WaitingForPlayersPanel (bottom-right) and the bottom-left ViewLoadoutButton /
   DiagnosticExportButton stack, so the overlays never overlap. */
.battle-plan {
  position: fixed;
  top: 8px;
  right: 8px;
  /* why: above any game overlay/modal, matching the WaitingForPlayersPanel z-index. */
  z-index: 9999;
}

.battle-plan-toggle {
  font-size: 12px;
  font-family: monospace;
  padding: 6px 12px;
  color: #f1f5f9;
  background: rgba(20, 20, 28, 0.94);
  border: 1px solid #475569;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}

.battle-plan-toggle:hover {
  background: #334155;
  border-color: #94a3b8;
}

.battle-plan-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 300px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  padding: 12px;
  background: rgba(20, 20, 28, 0.96);
  border: 1px solid #475569;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
}

.battle-plan-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.battle-plan-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
}

.battle-plan-shared {
  margin: 0;
  font-size: 11px;
  color: #94a3b8;
}

.battle-plan-collapse {
  font-size: 11px;
  font-family: monospace;
  padding: 3px 8px;
  color: #93c5fd;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

.battle-plan-phase {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid #334155;
  border-radius: 5px;
}

.battle-plan-phase--active {
  border-color: #93c5fd;
  background: rgba(37, 51, 78, 0.5);
}

.battle-plan-phase-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #f1f5f9;
}

.battle-plan-active-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  color: #0f172a;
  background: #93c5fd;
  border-radius: 999px;
  text-transform: uppercase;
}

.battle-plan-phase-help {
  margin: 0;
  font-size: 11px;
  color: #cbd5e1;
}

.battle-plan-textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  font-size: 12px;
  font-family: inherit;
  padding: 6px 8px;
  color: #f1f5f9;
  background: #1f2937;
  border: 1px solid #64748b;
  border-radius: 4px;
}

.battle-plan-textarea:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.battle-plan-phase-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.battle-plan-count {
  font-size: 10px;
  font-family: monospace;
  color: #94a3b8;
}

.battle-plan-save {
  font-size: 12px;
  font-family: monospace;
  padding: 4px 12px;
  color: #f1f5f9;
  background: #334155;
  border: 1px solid #64748b;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}

.battle-plan-save:hover:not(:disabled) {
  background: #475569;
  border-color: #94a3b8;
}

.battle-plan-save:disabled {
  opacity: 0.6;
  cursor: default;
}

.battle-plan-locked {
  margin: 0;
  font-size: 10px;
  font-style: italic;
  color: #94a3b8;
}

.battle-plan-note {
  font-size: 11px;
  font-family: monospace;
  color: #86efac;
}

.battle-plan-error {
  font-size: 11px;
  font-family: monospace;
  color: #fca5a5;
}
</style>
