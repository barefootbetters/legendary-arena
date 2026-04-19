<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { UIPlayerState } from '@legendary-arena/game-engine';
import PlayerPanel from './PlayerPanel.vue';

// why: defineComponent form (not <script setup>) is required here because
// the template references the imported `PlayerPanel` component. Under
// vue-sfc-loader's separate-compile pipeline, top-level imports from
// `<script setup>` are not hoisted onto the render function's component
// registry the way `@vitejs/plugin-vue` handles them, so the template's
// `<PlayerPanel>` reference fails to resolve. Explicit registration via
// `components: { PlayerPanel }` is required (D-6512 / P6-30).
export default defineComponent({
  name: 'PlayerPanelList',
  components: { PlayerPanel },
  props: {
    players: {
      type: Array as PropType<readonly UIPlayerState[]>,
      required: true,
    },
    activePlayerId: {
      type: String,
      required: true,
    },
  },
});
</script>

<template>
  <section
    class="player-panel-list"
    data-testid="arena-hud-player-panel-list"
    aria-label="players"
  >
    <PlayerPanel
      v-for="player in players"
      :key="player.playerId"
      :player="player"
      :is-active="player.playerId === activePlayerId"
    />
  </section>
</template>

<style scoped>
.player-panel-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}
</style>
