<script setup lang="ts">
import type { UIState } from '@legendary-arena/game-engine';

defineProps<{
  finalTurn: UIState['finalTurn'];
}>();

// why: role="alert" + aria-live="assertive" (contrast TurnPhaseBanner's
// aria-live="polite"): the final turn is an urgent, one-time stakes change —
// win or lose this turn or the game ends in a tie — that a screen-reader user
// must hear immediately, not ambient phase context announced when convenient.
</script>

<template>
  <!--
    why: v-if guards the whole banner on the projected field. The engine
    projects finalTurn only while a shared deck is exhausted and the game has
    not yet ended (it omits the field once the game is over), so absence means
    render nothing. The client never re-derives "is it the final turn" or
    suppresses at game over — those are the engine's decisions.
  -->
  <aside
    v-if="finalTurn"
    class="final-turn-banner"
    data-testid="arena-hud-final-turn"
    role="alert"
    aria-live="assertive"
  >
    <p class="heading">
      <span class="warning-icon" aria-hidden="true">⚠</span>
      Final turn
    </p>
    <p class="reason" data-testid="arena-hud-final-turn-reason">
      {{ finalTurn.reason }}
    </p>
    <p class="deck-readout" data-testid="arena-hud-final-turn-decks">
      Hero deck: {{ finalTurn.heroDeckRemaining }} ·
      Villain deck: {{ finalTurn.villainDeckRemaining }}
    </p>
  </aside>
</template>

<style scoped>
/* why: --color-par-partial is the arena-client alias for the brand
   semantic-warning (amber) token; it is the palette's caution accent, distinct
   from --color-penalty (error red) and the class/brand colours. A final-turn
   warning is a caution, not an error state, so the amber accent is correct and
   keeps the banner within the token layer (no raw hex — WP-009 audit rule). */
.final-turn-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 1rem;
  padding: 0.75rem 1rem;
  border: 2px solid var(--color-par-partial);
  border-radius: 0.375rem;
  background: var(--color-background);
  color: var(--color-foreground);
}

.heading {
  margin: 0;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-par-partial);
}

.warning-icon {
  margin-right: 0.25rem;
}

.reason {
  margin: 0;
  color: var(--color-foreground);
}

.deck-readout {
  margin: 0;
  color: var(--color-foreground);
  font-variant-numeric: tabular-nums;
}
</style>
