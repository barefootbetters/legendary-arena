<script lang="ts">
import {
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from 'vue';
import type { LogEntry } from '@legendary-arena/game-engine';
import { isPinnedToBottom } from './gameLogScroll';
import { buildGameLogText, GAME_LOG_EXPORT_FILE_NAME } from './gameLogExport';

// why: GameLogPanel renders the engine log verbatim in chronological (append)
// order — log authorship belongs to the engine (G.messages -> UIState.log via
// buildUIState); the client is not a second interpretation layer. It takes the
// log array as a prop instead of reading the store directly so component tests
// can mount it without a Pinia plugin; the container (ReplayInspector or HUD
// parent) forwards `snapshot.log`.
//
// why: WP-321 — the live HUD shows a COMPACT window (~5-6 lines; the panel
// scrolls) that STICKS to the bottom so the newest entry is always in view,
// while KEEPING chronological order — a multi-line event (fight -> rescue ->
// effect) must read cause-before-consequence, which a newest-first reversal
// would break (WP-320, abandoned pre-merge). The stick is POLITE: a new entry
// auto-scrolls only when the viewer is already pinned to the bottom, so a
// mid-game scroll-up to read history is not yanked back down.
//
// why: WP-322 — the compact panel gains a Copy / Save / Expand toolbar. Copy
// puts the whole transcript on the clipboard, Save downloads it as a plain-text
// file, and Expand opens a full-screen overlay of the same chronological log.
// All three are read-only reads of the engine-authored projection — the client
// never reorders or re-authors the log.
//
// why: this component runs setup logic (template refs + watchers), so per
// EC-132 §2 / D-6512 it uses the `defineComponent({ setup() { return {...} } })`
// form rather than a leaf `<script setup>` — under vue-sfc-loader's
// separate-compile pipeline a leaf `<script setup>` reliably exposes only props
// to the template, not arbitrary setup bindings.
export default defineComponent({
  name: 'GameLogPanel',
  props: {
    log: {
      type: Array as PropType<readonly LogEntry[]>,
      required: true,
    },
  },
  setup(props) {
    // why: the compact scroll viewport is the panel <section> (overflow-y: auto).
    const viewport = ref<HTMLElement | null>(null);
    // why: WP-322 — the separate scroll viewport inside the full-screen overlay.
    const expandedViewport = ref<HTMLElement | null>(null);
    // why: WP-322 — drives the full-screen Teleport overlay (false = compact only).
    const isExpanded = ref(false);

    /**
     * Scrolls a viewport to its newest (bottom) content. Null-safe so a not-yet-
     * mounted ref — or jsdom, which computes no scroll layout — is a no-op, never
     * a throw.
     *
     * @param element The scroll viewport, or null when it is not mounted.
     */
    function scrollElementToBottom(element: HTMLElement | null): void {
      if (element !== null) {
        element.scrollTop = element.scrollHeight;
      }
    }

    // why: WP-321 — on a new log entry, stick the compact viewport to the bottom
    // ONLY if the viewer was already pinned there before the entry landed. The
    // watcher runs with the default 'pre' flush (before the re-render), so
    // measuring here reflects the pre-append scroll position; the scroll runs
    // after nextTick, once the new row exists in the DOM.
    watch(
      () => props.log.length,
      () => {
        const element = viewport.value;
        if (element === null) {
          return;
        }
        const wasPinned = isPinnedToBottom(
          element.scrollHeight,
          element.scrollTop,
          element.clientHeight,
        );
        if (!wasPinned) {
          return;
        }
        void nextTick(() => scrollElementToBottom(viewport.value));
      },
    );

    // why: WP-321 — start pinned to the newest entry (e.g. joining a match
    // mid-stream); the log may already be non-empty at mount.
    onMounted(() => {
      void nextTick(() => scrollElementToBottom(viewport.value));
    });

    /**
     * Copies the whole log transcript to the clipboard. Best-effort: a missing or
     * rejecting Clipboard API is swallowed so it never throws into the UI — Save
     * is the fallback share path (the DiagnosticExportButton idiom).
     */
    async function copyLog(): Promise<void> {
      // why: guard API presence (jsdom / insecure contexts lack the Clipboard
      // API) and swallow a permissions/focus rejection; the user can still Save.
      if (typeof navigator.clipboard?.writeText !== 'function') {
        return;
      }
      try {
        await navigator.clipboard.writeText(buildGameLogText(props.log));
      } catch (clipboardError) {
        // why: a clipboard rejection is intentionally swallowed — Save remains.
      }
    }

    /**
     * Downloads the whole log transcript as a plain-text file via a transient
     * object-URL anchor, revoked immediately after the click.
     */
    function saveLog(): void {
      // why: duplicates the DiagnosticExportButton object-URL download idiom
      // inline (2nd copy — §16.1 duplicate-first); extracting it would touch the
      // out-of-scope DiagnosticExportButton. This Save is a human-readable log
      // transcript, deliberately distinct from that JSON diagnostics export.
      const transcript = buildGameLogText(props.log);
      const blob = new Blob([transcript], { type: 'text/plain' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = GAME_LOG_EXPORT_FILE_NAME;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    }

    /** Opens the full-screen overlay. */
    function expand(): void {
      isExpanded.value = true;
    }

    /** Closes the full-screen overlay back to the compact window. */
    function collapse(): void {
      isExpanded.value = false;
    }

    /**
     * Collapses the overlay on Escape. Registered on the document only while
     * expanded (see the isExpanded watcher).
     *
     * @param event The document keydown event.
     */
    function onDocumentKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        collapse();
      }
    }

    // why: WP-322 (the PileBrowseModal / EC-189 pattern) — attach the
    // ESC-to-collapse listener only while expanded, and scroll the overlay to the
    // newest entry when it opens; detach on collapse AND onBeforeUnmount so no
    // document listener leaks across expand/collapse/unmount cycles.
    watch(
      () => isExpanded.value,
      (expanded) => {
        if (expanded) {
          document.addEventListener('keydown', onDocumentKeyDown);
          void nextTick(() => scrollElementToBottom(expandedViewport.value));
        } else {
          document.removeEventListener('keydown', onDocumentKeyDown);
        }
      },
    );

    onBeforeUnmount(() => {
      document.removeEventListener('keydown', onDocumentKeyDown);
    });

    return {
      viewport,
      expandedViewport,
      isExpanded,
      copyLog,
      saveLog,
      expand,
      collapse,
    };
  },
});
</script>

<template>
  <div class="game-log">
    <div class="game-log__toolbar">
      <button
        type="button"
        class="game-log__button"
        data-testid="game-log-copy"
        aria-label="Copy game log to clipboard"
        @click="copyLog"
      >
        Copy
      </button>
      <button
        type="button"
        class="game-log__button"
        data-testid="game-log-save"
        aria-label="Save game log to a file"
        @click="saveLog"
      >
        Save
      </button>
      <button
        type="button"
        class="game-log__button"
        data-testid="game-log-expand"
        aria-label="Expand game log to full screen"
        @click="expand"
      >
        Expand
      </button>
    </div>

    <section
      ref="viewport"
      class="game-log-panel"
      data-testid="game-log-panel"
    >
      <template v-if="log.length === 0">
        <p class="empty" role="status">Game log is empty.</p>
      </template>
      <template v-else>
        <ol class="entries" aria-live="polite">
          <!--
            // why: source-array index is a stable Vue :key for the life of a
            // single UIState. The engine log is append-only within a match —
            // entries are never reordered or deleted in place — so reusing the
            // index as a key cannot trigger spurious DOM thrash.
          -->
          <li
            v-for="(entry, index) in log"
            :key="index"
            :data-index="index"
            data-testid="game-log-line"
          >
            {{ entry.text }}
          </li>
        </ol>
      </template>
    </section>

    <!-- why: WP-322 / EC-189 — the <Teleport> node itself is v-if-gated so no
         always-mounted body anchor is left behind when the overlay is closed. -->
    <Teleport v-if="isExpanded" to="body">
      <div
        class="game-log-modal__backdrop"
        data-testid="game-log-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Game log"
        @click="collapse"
      >
        <!-- why: backdrop click collapses; a click inside the panel is stopped
             so it does not close the overlay. -->
        <div class="game-log-modal__panel" @click.stop>
          <header class="game-log-modal__header">
            <span class="game-log-modal__title">Game Log ({{ log.length }})</span>
            <span class="game-log-modal__actions">
              <button
                type="button"
                class="game-log__button"
                data-testid="game-log-modal-copy"
                aria-label="Copy game log to clipboard"
                @click="copyLog"
              >
                Copy
              </button>
              <button
                type="button"
                class="game-log__button"
                data-testid="game-log-modal-save"
                aria-label="Save game log to a file"
                @click="saveLog"
              >
                Save
              </button>
              <button
                type="button"
                class="game-log__button"
                data-testid="game-log-collapse"
                aria-label="Collapse game log"
                @click="collapse"
              >
                Collapse
              </button>
            </span>
          </header>
          <div
            ref="expandedViewport"
            class="game-log-modal__viewport"
            data-testid="game-log-modal-viewport"
          >
            <template v-if="log.length === 0">
              <p class="empty" role="status">Game log is empty.</p>
            </template>
            <template v-else>
              <ol class="entries" aria-live="polite">
                <li
                  v-for="(entry, index) in log"
                  :key="index"
                  :data-index="index"
                >
                  {{ entry.text }}
                </li>
              </ol>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.game-log {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.game-log__toolbar {
  display: flex;
  gap: 0.375rem;
}

.game-log__button {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  cursor: pointer;
  color: var(--color-foreground);
  background: transparent;
  border: 1px solid var(--color-foreground);
  border-radius: 3px;
}

.game-log-panel {
  display: flex;
  flex-direction: column;
  /* why: WP-321 — a compact ~5-6 line window instead of the previous 20rem,
     which dominated the board. The panel scrolls (overflow-y: auto) and the
     component auto-scrolls to keep the newest entry in view. */
  max-height: 9rem;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-foreground);
}

.empty {
  margin: 0;
  font-style: italic;
  color: var(--color-foreground);
}

.entries {
  margin: 0;
  /* why: WP-329 — each log line now carries its own {turn}.{step}.{action} number
     (WP-328), so suppress the browser <ol> ordinal (which prepended a redundant
     "1. … 167." in front of it) and drop the now-unneeded marker indent. The <ol>
     element stays (the log is semantically ordered); only its marker is hidden. */
  list-style: none;
  padding-left: 0;
  font-variant-numeric: tabular-nums;
}

.entries li {
  padding: 0.125rem 0;
}

/* why: WP-322 — the full-screen expand overlay mirrors PileBrowseModal's
   backdrop + centered panel (fixed to the viewport, high z-index so it sits
   above the board and any HUD chrome). */
.game-log-modal__backdrop {
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

.game-log-modal__panel {
  display: flex;
  flex-direction: column;
  background: var(--color-background, #fff);
  padding: 1rem 1.25rem;
  width: 90vw;
  max-width: 60rem;
  height: 85vh;
  border: 1px solid var(--color-foreground, #999);
}

.game-log-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 0.5rem 0;
}

.game-log-modal__title {
  font-weight: 600;
}

.game-log-modal__actions {
  display: flex;
  gap: 0.375rem;
}

.game-log-modal__viewport {
  flex: 1 1 auto;
  overflow-y: auto;
}
</style>
