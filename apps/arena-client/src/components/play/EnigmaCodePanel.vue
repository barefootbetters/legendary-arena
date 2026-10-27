<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { UIEnigmaCodeState, UIEnigmaCard } from '@legendary-arena/game-engine';
import { enigmaColorLabel } from './enigmaColors';

/**
 * The Unbreakable Enigma Code readout (WP-830 / D-24763).
 *
 * One small box per face-down Enigma card, in code order. The engine's per-viewer projection
 * already decides what this viewer may see: a card with `display` shows its name and color(s), any
 * other shows "?". Who has looked at each card is public, like the peek log.
 */
export default defineComponent({
  name: 'EnigmaCodePanel',
  props: {
    enigmaCode: {
      type: Object as PropType<UIEnigmaCodeState>,
      required: true,
    },
  },
  setup() {
    /**
     * The color text for a card this viewer can see ("Tech", "Tech / Covert").
     *
     * @param card - The Enigma card.
     * @returns The joined color labels, or an empty string for an unseen card.
     */
    function colorText(card: UIEnigmaCard): string {
      const labels: string[] = [];
      for (const color of card.colors ?? []) {
        labels.push(enigmaColorLabel(color));
      }
      return labels.join(' / ');
    }

    /**
     * The "seen by" line for a card.
     *
     * @param card - The Enigma card.
     * @returns "Seen by Player 0, Player 1", or an empty string.
     */
    function seenByText(card: UIEnigmaCard): string {
      if (card.peekedBy.length === 0) {
        return '';
      }
      const names: string[] = [];
      for (const seat of card.peekedBy) {
        names.push(`Player ${seat}`);
      }
      return `Seen by ${names.join(', ')}`;
    }

    /**
     * The compact "seen" marker: the seats that looked, as "P0 P1".
     *
     * @param card - The Enigma card.
     * @returns The short marker.
     */
    function seenByShort(card: UIEnigmaCard): string {
      const names: string[] = [];
      for (const seat of card.peekedBy) {
        names.push(`P${seat}`);
      }
      return names.join(' ');
    }

    /**
     * The card's full description for its tooltip and screen readers.
     *
     * @param card - The Enigma card.
     * @returns "Seen Card (Tech / Covert). Seen by Player 0", or "Face down".
     */
    function cardTitle(card: UIEnigmaCard): string {
      const parts: string[] = [card.display !== undefined ? `${card.display.name} (${colorText(card)})` : 'Face down'];
      const seenBy = seenByText(card);
      if (seenBy !== '') {
        parts.push(seenBy);
      }
      return parts.join('. ');
    }

    return { colorText, seenByShort, cardTitle };
  },
});
</script>

<template>
  <div class="enigma-code" data-testid="play-enigma-code" role="group" aria-label="Enigma Code">
    <p class="enigma-code__title">
      Enigma Code ({{ enigmaCode.cards.length }})<span v-if="enigmaCode.isRevealed" class="enigma-code__revealed"> — revealed</span>
    </p>
    <ol class="enigma-code__cards">
      <li
        v-for="(card, position) in enigmaCode.cards"
        :key="position"
        class="enigma-code__card"
        :class="{ 'enigma-code__card--seen': card.display !== undefined }"
        :data-testid="`play-enigma-card-${position}`"
        :title="cardTitle(card)"
        :aria-label="cardTitle(card)"
      >
        <span class="enigma-code__number">{{ position + 1 }}</span>
        <span v-if="card.display !== undefined" class="enigma-code__colors" data-testid="play-enigma-card-colors">{{ colorText(card) }}</span>
        <span v-else class="enigma-code__hidden">?</span>
        <span v-if="card.peekedBy.length > 0" class="enigma-code__seen" data-testid="play-enigma-card-seen">{{ seenByShort(card) }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.enigma-code {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.75rem;
}

.enigma-code__title {
  margin: 0;
  font-weight: 600;
}

.enigma-code__revealed {
  font-weight: 400;
}

.enigma-code__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.enigma-code__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 2rem;
  max-width: 4rem;
  padding: 0.15rem 0.25rem;
  border: 1px dashed var(--color-foreground, #999);
  border-radius: 0.2rem;
}

.enigma-code__card--seen {
  border-style: solid;
}

.enigma-code__number {
  font-weight: 700;
}

.enigma-code__colors,
.enigma-code__seen {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enigma-code__seen {
  font-size: 0.65rem;
  opacity: 0.8;
}

.enigma-code__hidden {
  font-weight: 700;
}
</style>
