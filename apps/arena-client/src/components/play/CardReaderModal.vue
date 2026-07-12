<script lang="ts">
import {
  defineComponent,
  onBeforeUnmount,
  watch,
  type PropType,
} from 'vue';
// why: type-only import on the Runtime-Safe Engine Surface — the
// arena-client layer must not import engine runtime code (Layer Boundary).
// `import type` erases at compile time. Mirrors PileBrowseModal.
import type { UICardDisplay } from '@legendary-arena/game-engine';
import CardTile from './CardTile.vue';

/**
 * Single-card reader modal — shows one card at a readable size plus its full
 * rules text. Used by the Mastermind and Scheme tiles so the always-on board
 * tiles can stay compact (card art + counters only) while the full card is
 * legible on demand. The rules text is the engine's `gameText` projection
 * (mastermind Master-Strike / special rules, or the scheme's twist + win
 * conditions), already shipped in UIState — this modal only presents it.
 *
 * Mounts under `document.body` via `<Teleport>` and closes on backdrop click,
 * `Escape`, or the close button — the same interaction contract as
 * `PileBrowseModal`. Per the EC-132 §2 SFC authoring whitelist this leaf uses
 * `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: 'CardReaderModal',
  components: { CardTile },
  props: {
    isOpen: {
      type: Boolean,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    /**
     * The card to show at reader size. `null` when nothing is being read
     * (the modal renders nothing while closed anyway).
     */
    display: {
      type: Object as PropType<UICardDisplay | null>,
      required: false,
      default: null,
    },
    /**
     * The card's rules text lines (engine `gameText` projection). Empty when
     * the card has no ability text or the projection did not populate it.
     */
    gameText: {
      type: Array as PropType<readonly string[]>,
      required: false,
      default: () => [],
    },
  },
  emits: ['close'],
  setup(props, { emit }) {
    function onDocumentKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        emit('close');
      }
    }

    function attachKeydownListener(): void {
      document.addEventListener('keydown', onDocumentKeyDown);
    }

    function detachKeydownListener(): void {
      document.removeEventListener('keydown', onDocumentKeyDown);
    }

    // why: attach the Escape handler only while open, and detach on close and
    // on unmount, so no listener leaks across open/close cycles. `immediate`
    // covers an initial isOpen=true. Same pattern PileBrowseModal locks under
    // EC-189 — the trigger button keeps focus at open time, so the listener
    // must live on the document, not the dialog.
    watch(
      () => props.isOpen,
      (open) => {
        if (open) {
          attachKeydownListener();
        } else {
          detachKeydownListener();
        }
      },
      { immediate: true },
    );

    onBeforeUnmount(() => {
      detachKeydownListener();
    });

    return {};
  },
});
</script>

<template>
  <Teleport v-if="isOpen" to="body">
    <div
      class="card-reader-modal__backdrop"
      data-testid="play-card-reader-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @click="$emit('close')"
    >
      <!-- why: backdrop click closes; clicks inside the panel are stopped so
           reading the card does not dismiss the modal. -->
      <div class="card-reader-modal__panel" @click.stop>
        <header class="card-reader-modal__header" data-testid="play-card-reader-title">
          {{ title }}
        </header>
        <button
          type="button"
          class="card-reader-modal__close"
          data-testid="play-card-reader-close"
          aria-label="Close card reader"
          @click="$emit('close')"
        >
          Close
        </button>
        <div class="card-reader-modal__body">
          <CardTile
            v-if="display !== null"
            :display="display"
            size="lg"
            :show-cost="true"
            :show-label="true"
          />
          <div class="card-reader-modal__text" data-testid="play-card-reader-text">
            <p
              v-for="(line, index) in gameText"
              :key="index"
              class="card-reader-modal__line"
            >
              {{ line }}
            </p>
            <p
              v-if="gameText.length === 0"
              class="card-reader-modal__empty"
              data-testid="play-card-reader-empty"
            >
              No rules text available for this card.
            </p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.card-reader-modal__backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.card-reader-modal__panel {
  background: var(--color-background, #fff);
  padding: 1rem 1.25rem;
  min-width: 20rem;
  max-width: 34rem;
  max-height: 85vh;
  overflow-y: auto;
  border: 1px solid var(--color-foreground, #999);
}

.card-reader-modal__header {
  font-weight: 600;
  font-size: 1.1rem;
  margin: 0 0 0.5rem 0;
}

.card-reader-modal__close {
  align-self: flex-start;
  padding: 0.25rem 0.5rem;
  margin-bottom: 0.75rem;
}

.card-reader-modal__body {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.card-reader-modal__text {
  flex: 1;
  min-width: 0;
}

.card-reader-modal__line {
  margin: 0 0 0.6rem 0;
  line-height: 1.5;
}

.card-reader-modal__empty {
  margin: 0;
  font-style: italic;
  opacity: 0.7;
}
</style>
