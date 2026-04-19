<script setup lang="ts">
import type { UIState } from '@legendary-arena/game-engine';

defineProps<{
  game: UIState['game'];
}>();

// why: aria-live="polite" announces phase / stage / active-player changes to
// screen readers without interrupting the user's current speech output. The
// HUD prefers polite over assertive because a phase change is informative
// context, not an urgent interruption — the gameplay clock is the player's
// tempo, not the screen-reader's.
</script>

<template>
  <header
    class="turn-phase-banner"
    data-testid="arena-hud-banner"
    aria-live="polite"
  >
    <span class="phase" aria-label="phase">
      Phase: {{ game.phase }}
    </span>
    <span class="turn" aria-label="turn">
      Turn {{ game.turn }}
    </span>
    <span class="stage" aria-label="currentStage">
      Stage: {{ game.currentStage }}
    </span>
    <span class="active-player" aria-label="activePlayerId">
      Active player: {{ game.activePlayerId }}
    </span>
  </header>
</template>

<style scoped>
.turn-phase-banner {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-foreground);
  background: var(--color-background);
  color: var(--color-foreground);
}

.active-player {
  color: var(--color-active-player);
  font-weight: 600;
}
</style>
