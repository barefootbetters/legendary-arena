<script lang="ts">
import { defineComponent, watch, ref, type PropType } from 'vue';
import type { RevealEvent } from '../../composables/useRevealDetector';

/**
 * Full-card reveal modal overlay. Shows the revealed card's image and
 * ability text when a card is drawn from the villain deck. Click anywhere
 * to dismiss, or auto-dismisses after durationMs.
 */
export default defineComponent({
  name: 'RevealOverlay',
  props: {
    reveal: {
      type: Object as PropType<RevealEvent | null>,
      default: null,
    },
    durationMs: {
      type: Number,
      default: 4000,
    },
  },
  emits: ['dismiss'],
  setup(props, { emit }) {
    const visible = ref(false);
    let dismissTimer: ReturnType<typeof setTimeout> | null = null;

    function clearDismissTimer(): void {
      if (dismissTimer !== null) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
      }
    }

    function handleDismiss(): void {
      clearDismissTimer();
      visible.value = false;
      emit('dismiss');
    }

    watch(() => props.reveal, (next) => {
      if (next === null) {
        visible.value = false;
        return;
      }
      visible.value = true;

      clearDismissTimer();
      dismissTimer = setTimeout(() => {
        visible.value = false;
        emit('dismiss');
        dismissTimer = null;
      }, props.durationMs);
    });

    function destinationLabel(destination: string): string {
      if (destination === 'city') return 'Enters the City';
      if (destination === 'scheme-twist') return 'Scheme Twist!';
      if (destination === 'mastermind-strike') return 'Master Strike!';
      if (destination === 'bystander') return 'Bystander captured';
      return '';
    }

    return { visible, destinationLabel, handleDismiss };
  },
});
</script>

<template>
  <Transition name="reveal-fade">
    <div
      v-if="visible && reveal !== null"
      class="reveal-backdrop"
      data-testid="play-reveal-overlay"
      :data-destination="reveal.destination"
      aria-live="polite"
      role="dialog"
      aria-label="Card revealed"
      @click="handleDismiss"
    >
      <div class="reveal-modal">
        <p class="reveal-modal__destination">{{ destinationLabel(reveal.destination) }}</p>
        <div class="reveal-modal__content">
          <img
            v-if="reveal.display !== null && reveal.display.imageUrl"
            :src="reveal.display.imageUrl"
            :alt="reveal.display.name || reveal.cardName"
            class="reveal-modal__image"
          />
          <div class="reveal-modal__info">
            <p class="reveal-modal__card-name">{{ reveal.display?.name || reveal.cardName }}</p>
            <ul
              v-if="reveal.display?.abilities && reveal.display.abilities.length > 0"
              class="reveal-modal__abilities"
            >
              <li
                v-for="(ability, abilityIndex) in reveal.display.abilities"
                :key="abilityIndex"
                class="reveal-modal__ability"
              >
                {{ ability }}
              </li>
            </ul>
          </div>
        </div>
        <p class="reveal-modal__hint">Click to dismiss</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.reveal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  cursor: pointer;
}

.reveal-modal {
  background: var(--color-reveal-bg, #1a1a2e);
  color: var(--color-reveal-fg, #fff);
  border-radius: 0.75rem;
  padding: 1.25rem;
  max-width: 28rem;
  width: 90%;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
  text-align: center;
  cursor: default;
}

.reveal-modal__destination {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.85;
}

.reveal-modal__content {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  text-align: left;
}

.reveal-modal__image {
  width: 10rem;
  height: auto;
  border-radius: 0.5rem;
  flex-shrink: 0;
  object-fit: contain;
}

.reveal-modal__info {
  flex: 1;
  min-width: 0;
}

.reveal-modal__card-name {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
  font-weight: 700;
}

.reveal-modal__abilities {
  list-style: none;
  margin: 0;
  padding: 0;
}

.reveal-modal__ability {
  padding: 0.3rem 0;
  font-size: 0.9rem;
  line-height: 1.35;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.reveal-modal__ability:last-child {
  border-bottom: none;
}

.reveal-modal__hint {
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  opacity: 0.5;
}

/* Destination-specific accent borders */
[data-destination="city"] .reveal-modal {
  border: 2px solid var(--color-villain, #7b1fa2);
}

[data-destination="scheme-twist"] .reveal-modal {
  border: 2px solid var(--color-scheme-twist, #e6a817);
}

[data-destination="mastermind-strike"] .reveal-modal {
  border: 2px solid var(--color-master-strike, #c62828);
}

[data-destination="bystander"] .reveal-modal {
  border: 2px solid var(--color-bystander, #1565c0);
}

/* Transitions */
.reveal-fade-enter-active {
  transition: opacity 0.2s ease-out;
}

.reveal-fade-leave-active {
  transition: opacity 0.3s ease-in;
}

.reveal-fade-enter-from,
.reveal-fade-leave-to {
  opacity: 0;
}
</style>
