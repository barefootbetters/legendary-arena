<script lang="ts">
import { defineComponent, ref, type PropType } from 'vue';
import type { UIEnigmaCodeState } from '@legendary-arena/game-engine';
import { ENIGMA_COLOR_OPTIONS } from './enigmaColors';

/**
 * The Unbreakable Enigma Code guess, made when you fight the Mastermind (WP-830 / D-24763).
 *
 * "When you fight the Mastermind, first guess the color of each Enigma card, and then reveal them."
 * One row per Enigma card with the six colors; a card this viewer has seen starts on its first
 * color. "Guess and fight" emits the guess (one color per card, in code order); the engine decides
 * whether it is right.
 */
export default defineComponent({
  name: 'EnigmaGuessPicker',
  emits: ['submit', 'cancel'],
  props: {
    enigmaCode: {
      type: Object as PropType<UIEnigmaCodeState>,
      required: true,
    },
  },
  setup(props, { emit }) {
    const initialGuess: (string | null)[] = [];
    for (const card of props.enigmaCode.cards) {
      initialGuess.push(card.colors?.[0] ?? null);
    }
    const guess = ref<(string | null)[]>(initialGuess);

    /**
     * Sets one card's guessed color.
     *
     * @param position - The Enigma card's position.
     * @param color - The color id.
     */
    function choose(position: number, color: string): void {
      const next = [...guess.value];
      next[position] = color;
      guess.value = next;
    }

    /**
     * Whether every card has a guessed color.
     *
     * @returns true when the guess can be submitted.
     */
    function isComplete(): boolean {
      return guess.value.every((color) => color !== null);
    }

    /** Emits the complete guess. */
    function onSubmit(): void {
      if (!isComplete()) {
        return;
      }
      emit('submit', guess.value as string[]);
    }

    return { guess, choose, isComplete, onSubmit, colorOptions: ENIGMA_COLOR_OPTIONS };
  },
});
</script>

<template>
  <div class="enigma-guess" data-testid="play-enigma-guess" role="group" aria-label="Guess the Enigma Code">
    <p class="enigma-guess__title">Guess the color of each Enigma card. A wrong guess ends your turn.</p>
    <div
      v-for="(card, position) in enigmaCode.cards"
      :key="position"
      class="enigma-guess__row"
      :data-testid="`play-enigma-guess-row-${position}`"
    >
      <span class="enigma-guess__label">
        Card {{ position + 1 }}<span v-if="card.display !== undefined">: {{ card.display.name }}</span>
      </span>
      <button
        v-for="option in colorOptions"
        :key="option.id"
        type="button"
        class="enigma-guess__color"
        :class="{ 'enigma-guess__color--chosen': guess[position] === option.id }"
        :aria-pressed="guess[position] === option.id ? 'true' : 'false'"
        :data-testid="`play-enigma-guess-${position}-${option.id}`"
        @click="choose(position, option.id)"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="enigma-guess__actions">
      <button
        type="button"
        class="enigma-guess__submit"
        data-testid="play-enigma-guess-submit"
        :disabled="!isComplete()"
        @click="onSubmit"
      >
        Guess and fight
      </button>
      <button type="button" class="enigma-guess__cancel" data-testid="play-enigma-guess-cancel" @click="$emit('cancel')">
        Cancel
      </button>
    </div>
  </div>
</template>

<style scoped>
.enigma-guess {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.35rem;
  border: 1px solid #ffd700;
  border-radius: 0.35rem;
  /* why: opaque in both themes: it covers the Mastermind tile, like the #2970 Primus chooser. */
  background: rgba(16, 20, 36, 0.95);
  color: #fff;
  font-size: 0.75rem;
}

.enigma-guess__title {
  margin: 0;
  font-weight: 600;
}

.enigma-guess__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem;
}

.enigma-guess__label {
  min-width: 4rem;
  font-weight: 600;
}

.enigma-guess__color {
  padding: 0.1rem 0.3rem;
  font-size: 0.7rem;
}

.enigma-guess__color--chosen {
  outline: 2px solid currentColor;
  font-weight: 700;
}

.enigma-guess__actions {
  /* why: with five cards the overlay scrolls; the submit row stays in view. */
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 0.35rem;
  background: inherit;
}
</style>
