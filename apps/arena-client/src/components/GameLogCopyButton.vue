<script lang="ts">
import { computed, defineComponent } from 'vue';
import { storeToRefs } from 'pinia';
import { useUiStateStore } from '../stores/uiState';
import { buildGameLogText } from './log/gameLogExport';

/**
 * Small fixed-position "Copy game log" button, mounted once at the play viewport
 * root beside `<GameLogDownloadButton>` and `<DiagnosticExportButton>`.
 *
 * Why it exists (Jeff feedback): at the end-of-match outcome screen the shared
 * board — and with it the `GameLogPanel` whose "Copy" button puts the log
 * transcript on the clipboard — is collapsed behind the "View final board"
 * toggle. So on the endgame screen the log can be downloaded (via the sibling
 * `GameLogDownloadButton`) but not copied to the clipboard in one click. This
 * fills that gap: it appears at game over (when a non-empty log exists) directly
 * above the download button, so the transcript can be copied without expanding
 * the board. During play it stays hidden — the `GameLogPanel` Copy button
 * already covers that.
 *
 * The log itself is unchanged engine-authored data (`UIState.log`); this is a
 * read-only export, same as the download button, reusing its `buildGameLogText`
 * formatter so the copied text matches the downloaded `.txt` byte-for-byte. Per
 * the vue-sfc-loader separate-compile pipeline (D-6512) this SFC uses the
 * `defineComponent({ setup() { return {...} } })` form so the template's
 * non-prop bindings reach `_ctx`.
 */
export default defineComponent({
  name: 'GameLogCopyButton',
  setup() {
    const store = useUiStateStore();
    const { snapshot } = storeToRefs(store);

    // why: the button is the ENDGAME log-copy affordance. It shows only when the
    // match is over (gameOver set) AND there is a log to copy — during play the
    // GameLogPanel Copy button already offers this, so showing it then would
    // duplicate that control. Mirrors GameLogDownloadButton.hasDownloadableLog.
    const hasCopyableLog = computed<boolean>(() => {
      const current = snapshot.value;
      return current !== null && current.gameOver !== undefined && current.log.length > 0;
    });

    /**
     * Copies the whole log transcript to the clipboard. Best-effort: a missing or
     * rejecting Clipboard API is swallowed so it never throws into the UI.
     */
    async function onCopyGameLog(): Promise<void> {
      const current = snapshot.value;
      if (current === null) {
        return;
      }
      // why: guard API presence (jsdom / insecure contexts lack the Clipboard
      // API) and swallow a permissions/focus rejection; the endgame "Download
      // game log" button remains as the fallback share path.
      if (typeof navigator.clipboard?.writeText !== 'function') {
        return;
      }
      try {
        await navigator.clipboard.writeText(buildGameLogText(current.log));
      } catch (clipboardError) {
        // why: a clipboard rejection is intentionally swallowed — Download remains.
      }
    }

    return { hasCopyableLog, onCopyGameLog };
  },
});
</script>

<template>
  <button
    v-if="hasCopyableLog"
    type="button"
    class="game-log-copy-button"
    data-testid="game-log-copy-button"
    @click="onCopyGameLog"
  >
    Copy game log
  </button>
</template>

<style scoped>
/* why: mirrors the DiagnosticExportButton fixed-position pill, stacked directly
   above the "Download game log" button (bottom: 72px vs its 40px vs the
   diagnostics button's 8px) so the endgame copy/download/diagnostics affordances
   sit together in the bottom-left corner. */
.game-log-copy-button {
  position: fixed;
  bottom: 72px;
  left: 8px;
  font-size: 12px;
  font-family: monospace;
  padding: 5px 10px;
  color: #f1f5f9;
  background: #334155;
  border: 1px solid #64748b;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  user-select: none;
  /* why: a high z-index keeps it reachable above any game overlay or endgame
     panel, matching the sibling buttons it sits beside. */
  z-index: 9999;
}

.game-log-copy-button:hover {
  background: #475569;
  border-color: #94a3b8;
}
</style>
