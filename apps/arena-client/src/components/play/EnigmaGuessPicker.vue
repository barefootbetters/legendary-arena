<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted, ref, type PropType } from 'vue';
import type { UIEnigmaCodeState, UIEnigmaCard } from '@legendary-arena/game-engine';
import { ENIGMA_COLOR_OPTIONS, enigmaColorLabel } from './enigmaColors';

/**
 * The Unbreakable Enigma Code guess, made when you fight the Mastermind (WP-830 / D-24763).
 *
 * "When you fight the Mastermind, first guess the color of each Enigma card, and then reveal them."
 * One row per Enigma card with the six colors; a card this viewer has seen starts on its first
 * color. "Guess and fight" emits the guess (one color per card, in code order); the engine decides
 * whether it is right.
 *
 * A modal dialog: MastermindTile teleports it to `document.body`, out of the scaled, tilted board.
 * Escape and a backdrop click cancel, like the other play-page dialogs (CardReaderModal).
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

    /**
     * What this viewer knows about a card: its name and color(s) once seen, or that it is face down.
     *
     * @param card - The Enigma card.
     * @returns "Sniper Nest — you saw Tech", or "Face down".
     */
    function knownText(card: UIEnigmaCard): string {
      if (card.display === undefined) {
        return 'Face down';
      }
      const labels: string[] = [];
      for (const color of card.colors ?? []) {
        labels.push(enigmaColorLabel(color));
      }
      return `${card.display.name} — you saw ${labels.join(' / ')}`;
    }

    /**
     * Cancels on Escape.
     *
     * @param event - The document keydown.
     */
    function onDocumentKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        emit('cancel');
      }
    }

    // why: the picker is mounted only while the guess is open (MastermindTile's v-if), so the
    // Escape listener lives exactly as long as the dialog. It sits on the document because the
    // Fight button keeps focus when the dialog opens (the CardReaderModal pattern).
    onMounted(() => {
      document.addEventListener('keydown', onDocumentKeyDown);
    });
    onBeforeUnmount(() => {
      document.removeEventListener('keydown', onDocumentKeyDown);
    });

    return { guess, choose, isComplete, onSubmit, knownText, colorOptions: ENIGMA_COLOR_OPTIONS };
  },
});
</script>

<template>
  <div class="enigma-guess__backdrop" data-testid="play-enigma-guess-backdrop" @click="$emit('cancel')">
    <!-- why: a backdrop click cancels; clicks inside the panel are stopped so picking a color
         never dismisses the guess. -->
    <div
      class="enigma-guess"
      data-testid="play-enigma-guess"
      role="dialog"
      aria-modal="true"
      aria-label="Guess the Enigma Code"
      @click.stop
    >
      <header class="enigma-guess__header">
        <h2 class="enigma-guess__title">Guess the Enigma Code</h2>
        <p class="enigma-guess__hint">Pick a color for each card. A wrong guess ends your turn and mixes the code.</p>
      </header>
      <ol class="enigma-guess__rows">
        <li
          v-for="(card, position) in enigmaCode.cards"
          :key="position"
          class="enigma-guess__row"
          :class="{ 'enigma-guess__row--seen': card.display !== undefined }"
          :data-testid="`play-enigma-guess-row-${position}`"
        >
          <div class="enigma-guess__label">
            <span class="enigma-guess__number">Card {{ position + 1 }}</span>
            <span class="enigma-guess__known" :data-testid="`play-enigma-guess-known-${position}`">{{ knownText(card) }}</span>
          </div>
          <div class="enigma-guess__colors" role="group" :aria-label="`Card ${position + 1} color`">
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
        </li>
      </ol>
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
  </div>
</template>

<style scoped>
.enigma-guess__backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.enigma-guess {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: min(40rem, 100%);
  max-height: 85vh;
  padding: 1rem 1.25rem;
  border: 1px solid #ffd700;
  border-radius: 0.5rem;
  /* why: opaque in both themes, the WP-830 picker's colors. */
  background: rgba(16, 20, 36, 0.97);
  color: #fff;
  font-size: 0.95rem;
}

.enigma-guess__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.enigma-guess__title {
  margin: 0;
  font-size: 1.15rem;
}

.enigma-guess__hint {
  margin: 0;
  opacity: 0.85;
}

/* why: the rows scroll on their own, so a five-card code never pushes the actions out of view
   and the actions never cover a row (the in-tile picker's sticky bar hid the "Card 2" label). */
.enigma-guess__rows {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

.enigma-guess__row {
  display: grid;
  grid-template-columns: 11rem 1fr;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.enigma-guess__row:first-child {
  border-top: none;
}

.enigma-guess__label {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.enigma-guess__number {
  font-weight: 700;
}

.enigma-guess__known {
  font-size: 0.8rem;
  opacity: 0.75;
}

.enigma-guess__row--seen .enigma-guess__known {
  color: #ffd700;
  opacity: 1;
}

/* why: all six colors of one card on one line, so a button can only be read as its own row's. */
.enigma-guess__colors {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.3rem;
}

.enigma-guess__color {
  padding: 0.35rem 0.25rem;
  font-size: 0.85rem;
}

.enigma-guess__color--chosen {
  outline: 2px solid #ffd700;
  font-weight: 700;
}

.enigma-guess__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.enigma-guess__submit,
.enigma-guess__cancel {
  padding: 0.4rem 0.9rem;
}

/* why: on a phone the label sits above its colors and the six buttons take two lines of three,
   still inside the card's own bordered row. */
@media (max-width: 600px) {
  .enigma-guess__row {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }

  .enigma-guess__colors {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
