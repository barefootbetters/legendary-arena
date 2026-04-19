<script lang="ts">
import { defineComponent } from 'vue';
import { storeToRefs } from 'pinia';
import { useUiStateStore } from '../../stores/uiState';
import TurnPhaseBanner from './TurnPhaseBanner.vue';
import SharedScoreboard from './SharedScoreboard.vue';
import ParDeltaReadout from './ParDeltaReadout.vue';
import PlayerPanelList from './PlayerPanelList.vue';
import EndgameSummary from './EndgameSummary.vue';

// why: `<ArenaHud />` is the SOLE consumer of `useUiStateStore` in the HUD
// component tree. Every subcomponent (TurnPhaseBanner, SharedScoreboard,
// ParDeltaReadout, PlayerPanelList, PlayerPanel, EndgameSummary) receives
// its UIState sub-slice exclusively via props. This container/presenter
// split keeps the subcomponent tests trivial (pass a fixture slice as a
// prop, no store plugin needed) and makes the future spectator-HUD reuse
// straightforward — swap the store for a permission-filtered projection
// without editing any subcomponent.
// why: the explicit `defineComponent({ setup() { return {...} } })` form
// is required under `@legendary-arena/vue-sfc-loader`'s separate-compile
// pipeline (`inlineTemplate: false`). In that mode, `<script setup>` top-
// level bindings are NOT exposed on the template's `_ctx`, so template
// references such as `{{ snapshot.game.phase }}` would render against an
// undefined proxy and crash under `node:test`. Explicitly returning
// `snapshot` from `setup()` places it on the instance proxy where `_ctx`
// can reach it (D-6512 / P6-30). The six props-only subcomponents may
// freely use `<script setup>` because their props reach `_ctx` via
// `$props`, which the separate-compile pipeline handles correctly.
export default defineComponent({
  name: 'ArenaHud',
  components: {
    TurnPhaseBanner,
    SharedScoreboard,
    ParDeltaReadout,
    PlayerPanelList,
    EndgameSummary,
  },
  setup() {
    const store = useUiStateStore();
    const { snapshot } = storeToRefs(store);
    return { snapshot };
  },
});
</script>

<template>
  <div v-if="snapshot !== null" class="arena-hud" data-testid="arena-hud">
    <TurnPhaseBanner :game="snapshot.game" />
    <SharedScoreboard
      :scheme="snapshot.scheme"
      :mastermind="snapshot.mastermind"
      :progress="snapshot.progress"
    />
    <ParDeltaReadout
      :phase="snapshot.game.phase"
      :game-over="snapshot.gameOver"
    />
    <PlayerPanelList
      :players="snapshot.players"
      :active-player-id="snapshot.game.activePlayerId"
    />
    <EndgameSummary
      v-if="snapshot.gameOver"
      :game-over="snapshot.gameOver"
    />
  </div>
</template>

<style scoped>
.arena-hud {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
