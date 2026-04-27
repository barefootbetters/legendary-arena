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
import type { SubmitMove } from './uiMoveName.types';

// why: defineComponent({ setup() { return {...} } }) is required (NOT
// <script setup>) because the template references store-derived bindings
// (snapshot, viewer, currentStage, isPlayPhase). Under the
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

    const isPlayPhase = computed<boolean>(() => {
      // why: the locked phase vocabulary is `'lobby' | 'setup' | 'play' |
      // 'end'` (per `uiState.types.ts` and ARCHITECTURE.md §Phases). The
      // path is nested at `uiState.game.phase`, NOT `uiState.phase`. The
      // five interactive children are suppressed in any non-play phase so
      // pre-game lobby / setup and post-game end screens render only the
      // existing HUD.
      return snapshot.value?.game.phase === 'play';
    });

    return {
      snapshot,
      viewer,
      currentStage,
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
