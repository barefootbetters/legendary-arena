<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type {
  UIMastermindState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
import { useTurnActions } from '../../composables/useTurnActions';
import { useCardCostGating, type GatingResult } from '../../composables/useCardCostGating';
import CardTile from './CardTile.vue';
import type { SubmitMove } from './uiMoveName.types';

/**
 * Mastermind tile — renders the mastermind id + tactics-remaining counter
 * + WP-128 `attachedBystanders` array. Click fires `fightMastermind`.
 *
 * `mastermind.attachedBystanders` (D-12805 Interpretation B) is bystanders
 * captured by the mastermind itself via Master Strike — populated at runtime
 * since WP-154 / D-15401. Per WP-505 it renders as a count-only "N captured"
 * badge (face-down = identity hidden), matching the city-villain badge; these
 * are the mastermind's own captures, never the top-level city-villain
 * `G.attachedBystanders` (which render on the city row).
 *
 * Cost gating: the mastermind is fightable when `economy.availableAttack
 * >= mastermind.display.cost`. Disabled-state tooltip precedence locked at
 * EC-132 §3 (stage → resource → structural; "all tactics defeated" is the
 * structural lock).
 *
 * Per the EC-132 §2 SFC authoring whitelist: this is a tested non-leaf
 * composer that USES composables, so it MUST use
 * `defineComponent({ setup() { return {...} } })` per P6-30 / P6-46 /
 * D-6512.
 *
 * @see WP-129 §Acceptance Criteria — Mastermind tile
 * @see DECISIONS.md D-12805 attachedBystanders semantics
 * @see DECISIONS.md D-12806 safe-skip resolution
 */
export default defineComponent({
  name: 'MastermindTile',
  components: { CardTile },
  emits: ['read'],
  props: {
    mastermind: {
      type: Object as PropType<UIMastermindState>,
      required: true,
    },
    currentStage: {
      type: String,
      required: true,
    },
    isViewerTurn: {
      type: Boolean,
      required: false,
      default: true,
    },
    economy: {
      type: Object as PropType<UITurnEconomyState>,
      required: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props, { emit }) {
    function gateForFight(): GatingResult {
      // why: disabled-state tooltip precedence per EC-132 §3 — stage →
      // resource → structural. Stage gate first; then cost gate (consumes
      // WP-128 economy.availableAttack); finally the structural-lock
      // "all tactics defeated" check.
      const stage = useTurnActions(props.currentStage, props.isViewerTurn).canFightMastermind();
      if (!stage.allowed) {
        return stage;
      }
      const cost = useCardCostGating(props.economy).canFight(props.mastermind.display);
      if (!cost.allowed) {
        return cost;
      }
      if (props.mastermind.tacticsRemaining === 0) {
        return {
          allowed: false,
          reason: 'All tactics defeated; mastermind already fallen.',
        };
      }
      return { allowed: true, reason: null };
    }

    function onFight(): void {
      // why: empty-object payload — fightMastermind takes no arguments by
      // engine design. The move always defeats the top tactic.
      props.submitMove('fightMastermind', {});
    }

    function onRead(): void {
      // why: surface the full card + Master-Strike / special rules in the
      // shared CardReaderModal. `gameText` is already in the projection; the
      // tile keeps it off-board to stay compact and emits it on demand.
      emit('read', {
        title: props.mastermind.display.name,
        display: props.mastermind.display,
        gameText: props.mastermind.gameText ?? [],
      });
    }

    return { gateForFight, onFight, onRead };
  },
});
</script>

<template>
  <section
    class="mastermind-tile"
    data-testid="play-mastermind-tile"
    aria-label="Mastermind"
  >
    <button
      type="button"
      data-testid="play-mastermind-button"
      :data-mastermind-id="mastermind.id"
      :disabled="!gateForFight().allowed"
      :aria-disabled="!gateForFight().allowed ? 'true' : undefined"
      :title="gateForFight().reason ?? undefined"
      @click="onFight"
    >
      <!-- why: disabled-state tooltip precedence locked at EC-132 §3
           (stage → resource → structural). Reason text is bound from
           useTurnActions / useCardCostGating + the structural "all
           tactics defeated" override. -->
      <CardTile
        :display="mastermind.display"
        size="md"
        :interactive="gateForFight().allowed"
        :show-label="true"
      />
      <span class="mastermind-status" data-testid="play-mastermind-tactics-remaining">
        Tactics remaining: {{ mastermind.tacticsRemaining }}
      </span>
    </button>
    <!-- why: the full card + Master-Strike / special rules open in the shared
         CardReaderModal instead of rendering inline, so the tile stays short
         (Jeff: the top row wasted vertical space without being readable). -->
    <button
      type="button"
      class="mastermind-read"
      data-testid="play-mastermind-read"
      @click="onRead"
    >
      Read card ▸
    </button>
    <!-- why: WP-505 — captured bystanders are face down, so they render as a
         count-only "N captured" badge (identity hidden), matching the
         city-villain badge; shown only when the mastermind holds some. -->
    <span
      v-if="mastermind.attachedBystanders.length > 0"
      class="mastermind-bystanders"
      data-testid="play-mastermind-bystanders"
      :aria-label="mastermind.attachedBystanders.length + ' bystanders captured'"
    >
      {{ mastermind.attachedBystanders.length }} captured
    </span>
  </section>
</template>

<style scoped>
.mastermind-tile {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-foreground, #999);
}

.mastermind-tile button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0.25rem 0.5rem;
}

.mastermind-id {
  font-weight: 600;
}

.mastermind-cost,
.mastermind-status {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}

/* why: WP-505 — count-only badge (face-down bystanders), matching the
   city-villain "N captured" pill. */
.mastermind-bystanders {
  align-self: flex-start;
  padding: 0.05rem 0.4rem;
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.mastermind-read {
  align-self: flex-start;
  padding: 0.2rem 0.5rem;
  font-size: 0.8rem;
}
</style>
