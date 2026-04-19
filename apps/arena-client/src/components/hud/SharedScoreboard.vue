<script setup lang="ts">
import type {
  UIMastermindState,
  UISchemeState,
  UIProgressCounters,
} from '@legendary-arena/game-engine';

defineProps<{
  scheme: UISchemeState;
  mastermind: UIMastermindState;
  progress: UIProgressCounters;
}>();

// why: `bystandersRescued` carries `data-emphasis="primary"` because docs/
// 01-VISION.md §Heroic Values in Scoring names it as the strongest positive
// action the player takes. The visual hierarchy surfaces cooperation and
// protection above penalty tracking — if a counter deserves the single
// "primary" slot in the scoreboard, it is this one.
// why: the `data-emphasis` attribute contract is structural, not stylistic.
// Tests assert attribute presence (`[data-emphasis="primary"]`), not class
// or style tokens. Styling selectors key off the attribute so a CSS refactor
// or a theme layer cannot silently regress the emphasis rule.
// why: every counter's `aria-label` is the literal leaf UIState field name
// (verbatim, no paraphrasing). This binds the HUD's accessibility tree to
// the WP-067 drift test on `uiState.types.drift.test.ts` — a rename of
// `twistCount` / `tacticsRemaining` / `tacticsDefeated` /
// `bystandersRescued` / `escapedVillains` breaks both the drift test and
// the HUD tests in lockstep, preventing silent accessibility drift.
</script>

<template>
  <section
    class="shared-scoreboard"
    data-testid="arena-hud-scoreboard"
    aria-label="shared scoreboard"
  >
    <div class="counter" data-emphasis="primary">
      <span class="counter-label">Bystanders rescued</span>
      <span class="counter-value" aria-label="bystandersRescued">
        {{ progress.bystandersRescued }}
      </span>
    </div>
    <div class="counter" data-emphasis="secondary">
      <span class="counter-label">Escaped villains</span>
      <span class="counter-value" aria-label="escapedVillains">
        {{ progress.escapedVillains }}
      </span>
    </div>
    <div class="counter" data-emphasis="secondary">
      <span class="counter-label">Scheme twists</span>
      <span class="counter-value" aria-label="twistCount">
        {{ scheme.twistCount }}
      </span>
    </div>
    <div class="counter" data-emphasis="secondary">
      <span class="counter-label">Mastermind tactics remaining</span>
      <span class="counter-value" aria-label="tacticsRemaining">
        {{ mastermind.tacticsRemaining }}
      </span>
    </div>
    <div class="counter" data-emphasis="secondary">
      <span class="counter-label">Mastermind tactics defeated</span>
      <span class="counter-value" aria-label="tacticsDefeated">
        {{ mastermind.tacticsDefeated }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.shared-scoreboard {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-foreground);
}

.counter {
  display: flex;
  flex-direction: column;
  min-width: 8rem;
}

.counter[data-emphasis="primary"] {
  color: var(--color-emphasis);
  font-weight: 700;
}

.counter[data-emphasis="secondary"] {
  color: var(--color-penalty);
  font-weight: 500;
}

.counter-label {
  font-size: 0.85rem;
}

.counter-value {
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
}
</style>
