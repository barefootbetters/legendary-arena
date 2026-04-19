<script lang="ts">
import { defineComponent, computed, type PropType } from 'vue';
import type { UIPlayerState } from '@legendary-arena/game-engine';
import { playerColorStyles } from './hudColors';

// why: defineComponent form (not <script setup>) is required under vue-sfc-
// loader's separate-compile pipeline when the template references script-
// scope bindings other than props. `colorBundle` is a computed built from
// the helper module, so it must be returned from `setup()` to reach `_ctx`
// (D-6512 / P6-30). See `BootstrapProbe.vue` for the canonical precedent.
export default defineComponent({
  name: 'PlayerPanel',
  props: {
    player: {
      type: Object as PropType<UIPlayerState>,
      required: true,
    },
    isActive: {
      type: Boolean,
      required: true,
    },
  },
  setup(props) {
    const colorBundle = computed(() => playerColorStyles(props.player.playerId));
    return { colorBundle };
  },
});
</script>

<template>
  <article
    class="player-panel"
    data-testid="arena-hud-player-panel"
    :class="{ active: isActive }"
    :aria-current="isActive ? 'true' : undefined"
    :style="{
      background: colorBundle.background,
      color: colorBundle.foreground,
    }"
  >
    <header class="identity">
      <span class="icon" aria-hidden="true">{{ colorBundle.icon }}</span>
      <span class="id" aria-label="playerId">{{ player.playerId }}</span>
      <span v-if="isActive" class="active-badge" aria-label="active">
        (active)
      </span>
    </header>
    <dl class="zones">
      <div class="zone">
        <dt>Deck</dt>
        <dd aria-label="deckCount">{{ player.deckCount }}</dd>
      </div>
      <div class="zone">
        <dt>Hand</dt>
        <dd aria-label="handCount">{{ player.handCount }}</dd>
      </div>
      <div class="zone">
        <dt>Discard</dt>
        <dd aria-label="discardCount">{{ player.discardCount }}</dd>
      </div>
      <div class="zone">
        <dt>In play</dt>
        <dd aria-label="inPlayCount">{{ player.inPlayCount }}</dd>
      </div>
      <div class="zone">
        <dt>Victory</dt>
        <dd aria-label="victoryCount">{{ player.victoryCount }}</dd>
      </div>
      <div class="zone">
        <dt>Wounds</dt>
        <dd aria-label="woundCount">{{ player.woundCount }}</dd>
      </div>
    </dl>
  </article>
</template>

<style scoped>
.player-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  min-width: 12rem;
}

.player-panel.active {
  outline: 3px solid var(--color-active-player);
  outline-offset: 2px;
}

.identity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.icon {
  font-size: 1.25rem;
}

.zones {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem 1rem;
  margin: 0;
}

dt,
dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
</style>
