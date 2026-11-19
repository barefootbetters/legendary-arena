<script lang="ts">
import { defineComponent, nextTick, onBeforeUnmount, onMounted, ref, type PropType } from 'vue';
import type { UIDisplayEntry } from '@legendary-arena/game-engine';
import CardTile from './CardTile.vue';

/**
 * The Elite Assassin choice for Indestructible Man's shuffle-fight (WP-770 / D-24601).
 *
 * "Once during each of your turns, you may shuffle two Elite Assassins from your Victory Pile
 * into the Villain Deck. If you do, fight Indestructible Man." One toggle per Assassin the engine
 * projected (`shuffleFight.eligibleAssassins`, Victory Pile order), each with its art and name.
 * "Shuffle and fight" is enabled only at exactly `requiredCount` picks and emits `choose` with
 * the picked ext_ids in projected order; the engine validates and resolves them.
 *
 * A modal dialog: MastermindTile teleports it to `document.body`, out of the scaled, tilted
 * board (the WP-830 Enigma picker precedent on the same tile). It opens with focus on the first
 * Assassin; Escape, Cancel and a backdrop click emit `close`, and the tile returns focus to its
 * shuffle button. The chooser decides nothing: it lists what the engine projected.
 *
 * Per the EC-132 §2 SFC authoring whitelist (D-6512) it uses
 * `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: 'AssassinShuffleChooser',
  components: { CardTile },
  emits: ['choose', 'close'],
  props: {
    assassins: {
      type: Array as PropType<UIDisplayEntry[]>,
      required: true,
    },
    requiredCount: {
      type: Number,
      required: true,
    },
  },
  setup(props, { emit }) {
    const chosenIds = ref<string[]>([]);
    const optionList = ref<HTMLElement | null>(null);

    /**
     * Whether an Assassin is picked.
     *
     * @param extId - The Assassin's ext_id.
     * @returns true when it is in the pick.
     */
    function isChosen(extId: string): boolean {
      return chosenIds.value.includes(extId);
    }

    /**
     * Adds an Assassin to the pick, or removes it.
     *
     * @param extId - The Assassin's ext_id.
     */
    function toggle(extId: string): void {
      if (isChosen(extId)) {
        chosenIds.value = chosenIds.value.filter((chosenId) => chosenId !== extId);
        return;
      }
      chosenIds.value = [...chosenIds.value, extId];
    }

    /**
     * Whether the pick is exactly the number the shuffle-fight costs.
     *
     * @returns true when Confirm can be pressed.
     */
    function isComplete(): boolean {
      return chosenIds.value.length === props.requiredCount;
    }

    /** Emits the pick, in the order the engine projected the Assassins. */
    function onConfirm(): void {
      if (!isComplete()) {
        return;
      }
      // why: projected (Victory Pile) order, not click order, so the payload is the same
      // however the player clicked; the engine accepts the two ids in any order.
      const orderedIds: string[] = [];
      for (const assassin of props.assassins) {
        if (isChosen(assassin.extId)) {
          orderedIds.push(assassin.extId);
        }
      }
      emit('choose', orderedIds);
    }

    /**
     * Closes on Escape.
     *
     * @param event - The document keydown.
     */
    function onDocumentKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        emit('close');
      }
    }

    // why: the chooser is mounted only while it is open (MastermindTile's v-if), so the Escape
    // listener lives exactly as long as the dialog (the EnigmaGuessPicker pattern). Focus moves
    // to the first Assassin so the dialog is keyboard-operable from the moment it opens.
    onMounted(() => {
      document.addEventListener('keydown', onDocumentKeyDown);
      void nextTick(() => {
        const firstOption = optionList.value?.querySelector<HTMLButtonElement>('[data-testid="play-assassin-option"]');
        firstOption?.focus();
      });
    });
    onBeforeUnmount(() => {
      document.removeEventListener('keydown', onDocumentKeyDown);
    });

    return { chosenIds, optionList, isChosen, toggle, isComplete, onConfirm };
  },
});
</script>

<template>
  <div class="assassin-chooser__backdrop" data-testid="play-assassin-backdrop" @click="$emit('close')">
    <!-- why: a backdrop click closes; clicks inside the panel are stopped so picking an
         Assassin never dismisses the chooser. -->
    <div
      class="assassin-chooser"
      data-testid="play-assassin-chooser"
      role="dialog"
      aria-modal="true"
      aria-label="Choose Elite Assassins to shuffle"
      @click.stop
    >
      <header class="assassin-chooser__header">
        <h2 class="assassin-chooser__title">Choose {{ requiredCount }} Elite Assassins</h2>
        <p class="assassin-chooser__hint">Shuffle them from your Victory Pile into the Villain Deck, then fight Indestructible Man.</p>
      </header>
      <ul ref="optionList" class="assassin-chooser__options">
        <li v-for="assassin in assassins" :key="assassin.extId" class="assassin-chooser__item">
          <button
            type="button"
            class="assassin-chooser__option"
            :class="{ 'assassin-chooser__option--chosen': isChosen(assassin.extId) }"
            data-testid="play-assassin-option"
            :data-ext-id="assassin.extId"
            :aria-pressed="isChosen(assassin.extId) ? 'true' : 'false'"
            @click="toggle(assassin.extId)"
          >
            <CardTile :display="assassin.display" size="md" :show-cost="false" :show-label="true" />
          </button>
        </li>
      </ul>
      <div class="assassin-chooser__actions">
        <span class="assassin-chooser__count" role="status">{{ chosenIds.length }} of {{ requiredCount }} chosen</span>
        <button
          type="button"
          class="assassin-chooser__confirm"
          data-testid="play-assassin-confirm"
          :disabled="!isComplete()"
          @click="onConfirm"
        >
          Shuffle and fight
        </button>
        <button type="button" class="assassin-chooser__cancel" data-testid="play-assassin-cancel" @click="$emit('close')">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assassin-chooser__backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.assassin-chooser {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: min(40rem, 100%);
  max-height: 85vh;
  padding: 1rem 1.25rem;
  border: 1px solid #ffd700;
  border-radius: 0.5rem;
  /* why: opaque in both themes, the WP-830 Enigma picker's colors. */
  background: rgba(16, 20, 36, 0.97);
  color: #fff;
  font-size: 0.95rem;
}

.assassin-chooser__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.assassin-chooser__title {
  margin: 0;
  font-size: 1.15rem;
}

.assassin-chooser__hint {
  margin: 0;
  opacity: 0.85;
}

/* why: the options wrap and scroll on their own, so a Victory Pile full of Assassins never
   pushes the actions out of view. */
.assassin-chooser__options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

.assassin-chooser__item {
  display: flex;
}

.assassin-chooser__option {
  padding: 0.25rem;
  border: 2px solid transparent;
  border-radius: 0.4rem;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  cursor: pointer;
}

.assassin-chooser__option--chosen {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.18);
}

.assassin-chooser__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
}

.assassin-chooser__count {
  margin-right: auto;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}

.assassin-chooser__confirm,
.assassin-chooser__cancel {
  padding: 0.4rem 0.9rem;
}
</style>
