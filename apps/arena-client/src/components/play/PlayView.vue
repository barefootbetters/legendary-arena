<script lang="ts">
import { defineComponent, computed, type PropType } from 'vue';
import { storeToRefs } from 'pinia';
import type { UIPlayerState } from '@legendary-arena/game-engine';
import { useUiStateStore } from '../../stores/uiState';
import ArenaHud from '../hud/ArenaHud.vue';
import HandRow from './HandRow.vue';
import CityRow from './CityRow.vue';
import HQRow from './HQRow.vue';
import MastermindTile from './MastermindTile.vue';
import TurnActionBar from './TurnActionBar.vue';
import LobbyControls from './LobbyControls.vue';
import type { SubmitMove } from './uiMoveName.types';

// why: defineComponent({ setup() { return {...} } }) is required (NOT
// <script setup>) because the template references store-derived bindings
// (snapshot, viewer, currentStage, isLobbyPhase, isPlayPhase). Under the
// @legendary-arena/vue-sfc-loader separate-compile pipeline (D-6512 / P6-30),
// top-level <script setup> bindings do not reach `_ctx`. Returning the refs
// from setup() places them on the instance proxy. Precedent: ArenaHud,
// PlayerPanel, App.vue, LobbyView.vue.
export default defineComponent({
  name: 'PlayView',
  components: {
    ArenaHud,
    HandRow,
    CityRow,
    HQRow,
    MastermindTile,
    TurnActionBar,
    LobbyControls,
  },
  props: {
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup() {
    const store = useUiStateStore();
    const { snapshot } = storeToRefs(store);

    /**
     * Resolve the viewing player's `UIPlayerState`. The server-side
     * `playerView` filter populates `handCards` on the viewer's player
     * record only — for opponents and spectators the field is redacted
     * (undefined). Searching for the player whose `handCards` is defined
     * therefore identifies the viewer without requiring a separate
     * playerID prop.
     */
    const viewer = computed<UIPlayerState | null>(() => {
      const current = snapshot.value;
      if (current === null) {
        return null;
      }
      for (const player of current.players) {
        if (player.handCards !== undefined) {
          return player;
        }
      }
      return null;
    });

    const currentStage = computed<string>(
      () => snapshot.value?.game.currentStage ?? '',
    );

    // why: phase-branch rendering per WP-100 §Scope F (revised 2026-04-27).
    // Locked phase vocabulary is `'lobby' | 'setup' | 'play' | 'end'`
    // (per uiState.types.ts and ARCHITECTURE.md §Phases). The path is
    // nested at uiState.game.phase, NOT uiState.phase.
    //
    // - phase === 'lobby' renders <LobbyControls> below <ArenaHud /> so the
    //   seated viewer can ready up and trigger the match start.
    // - phase === 'play' AND viewer identified renders the five
    //   play-surface children below <ArenaHud />.
    // - All other phases (setup, end, or null snapshot) render only
    //   <ArenaHud />. The setup phase is unreachable in WP-100 (per the
    //   §Scope J engine retarget — D-10006) but the branch is preserved
    //   defensively in case a future WP reroutes the lobby → setup
    //   transition.
    const isLobbyPhase = computed<boolean>(
      () => snapshot.value?.game.phase === 'lobby',
    );

    const isPlayPhase = computed<boolean>(
      () => snapshot.value?.game.phase === 'play',
    );

    return {
      snapshot,
      viewer,
      currentStage,
      isLobbyPhase,
      isPlayPhase,
    };
  },
});
</script>

<template>
  <div class="play-view" data-testid="play-view">
    <p
      v-if="snapshot === null"
      class="play-empty-match"
      data-testid="play-empty-match"
    >
      No match is currently loaded. Wait for the server to push a frame, or
      return to the lobby.
    </p>
    <template v-else>
      <ArenaHud />
      <LobbyControls
        v-if="isLobbyPhase"
        :submit-move="submitMove"
      />
      <template v-if="isPlayPhase && viewer !== null">
        <MastermindTile
          :mastermind="snapshot.mastermind"
          :current-stage="currentStage"
          :economy="snapshot.economy"
          :submit-move="submitMove"
        />
        <CityRow
          :city="snapshot.city"
          :current-stage="currentStage"
          :economy="snapshot.economy"
          :submit-move="submitMove"
        />
        <HQRow
          :hq="snapshot.hq"
          :current-stage="currentStage"
          :economy="snapshot.economy"
          :submit-move="submitMove"
        />
        <HandRow
          :hand-cards="viewer.handCards ?? []"
          :current-stage="currentStage"
          :submit-move="submitMove"
        />
        <TurnActionBar
          :current-stage="currentStage"
          :hand-count="viewer.handCount"
          :submit-move="submitMove"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
.play-view {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.play-empty-match {
  padding: 0.75rem 1rem;
  border: 1px dashed var(--color-foreground, #666);
}
</style>
