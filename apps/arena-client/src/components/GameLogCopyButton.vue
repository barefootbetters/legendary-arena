<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useUiStateStore } from '../stores/uiState';
import { buildGameLogText } from './log/gameLogExport';

type CopyState = 'idle' | 'copied' | 'failed';

// why: how long the "Copied!" / "Copy failed" confirmation stays before the
// label reverts to "Copy game log" — long enough to read, short enough not to
// linger past the next click.
const COPY_FEEDBACK_RESET_MS = 2000;

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
 * above the download button.
 *
 * The log itself is unchanged engine-authored data (`UIState.log`); this is a
 * read-only export, reusing the download button's `buildGameLogText` formatter
 * so the copied text matches the downloaded `.txt` byte-for-byte.
 *
 * Copy is done as an observable, two-path operation (WP-707 live-verify fix):
 * the async Clipboard API first, then a legacy `execCommand('copy')` fallback,
 * and the button label reflects the outcome ("Copied!" / "Copy failed"). The
 * original silent best-effort swallow read as a dead button on the live outcome
 * screen — the write was rejecting (`NotAllowedError`) with no feedback.
 *
 * Per the vue-sfc-loader separate-compile pipeline (D-6512) this SFC uses the
 * `defineComponent({ setup() { return {...} } })` form so the template's
 * non-prop bindings reach `_ctx`.
 */
export default defineComponent({
  name: 'GameLogCopyButton',
  setup() {
    const store = useUiStateStore();
    const { snapshot } = storeToRefs(store);
    const copyState = ref<CopyState>('idle');
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    // why: the button is the ENDGAME log-copy affordance. It shows only when the
    // match is over (gameOver set) AND there is a log to copy — during play the
    // GameLogPanel Copy button already offers this, so showing it then would
    // duplicate that control. Mirrors GameLogDownloadButton.hasDownloadableLog.
    const hasCopyableLog = computed<boolean>(() => {
      const current = snapshot.value;
      return current !== null && current.gameOver !== undefined && current.log.length > 0;
    });

    const buttonLabel = computed<string>(() => {
      if (copyState.value === 'copied') {
        return 'Copied!';
      }
      if (copyState.value === 'failed') {
        return 'Copy failed';
      }
      return 'Copy game log';
    });

    /**
     * Copies text to the clipboard, preferring the async Clipboard API and
     * falling back to a hidden-textarea `execCommand('copy')` when the API is
     * absent or rejects (e.g. the `NotAllowedError` seen at the live outcome
     * screen). Returns whether either path reported success. Never throws — a
     * failure surfaces as the "Copy failed" label, never as an unhandled error.
     *
     * @param text The transcript to place on the clipboard.
     * @returns True when a copy path reported success.
     */
    async function copyTextToClipboard(text: string): Promise<boolean> {
      if (typeof navigator.clipboard?.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (clipboardError) {
          // why: the async write can reject (permission/focus, NotAllowedError);
          // fall through to the legacy path rather than swallowing silently.
        }
      }
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        // why: keep the scratch textarea off-screen so selecting it does not
        // flash a visible element or scroll the outcome screen.
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        const didCopy = document.execCommand('copy');
        document.body.removeChild(textarea);
        return didCopy;
      } catch (execError) {
        // why: the legacy path can also throw in locked-down contexts; report
        // failure to the label rather than letting it reach the UI as an error.
        return false;
      }
    }

    function scheduleReset(): void {
      if (resetTimer !== null) {
        clearTimeout(resetTimer);
      }
      // why: setTimeout is a client-only label reset outside the engine
      // determinism boundary; it never touches G/ctx.
      resetTimer = setTimeout(() => {
        copyState.value = 'idle';
        resetTimer = null;
      }, COPY_FEEDBACK_RESET_MS);
    }

    async function onCopyGameLog(): Promise<void> {
      const current = snapshot.value;
      if (current === null) {
        return;
      }
      const didCopy = await copyTextToClipboard(buildGameLogText(current.log));
      copyState.value = didCopy ? 'copied' : 'failed';
      scheduleReset();
    }

    onBeforeUnmount(() => {
      if (resetTimer !== null) {
        clearTimeout(resetTimer);
      }
    });

    return { hasCopyableLog, buttonLabel, copyState, onCopyGameLog };
  },
});
</script>

<template>
  <button
    v-if="hasCopyableLog"
    type="button"
    class="game-log-copy-button"
    :class="{
      'game-log-copy-button--copied': copyState === 'copied',
      'game-log-copy-button--failed': copyState === 'failed',
    }"
    data-testid="game-log-copy-button"
    aria-live="polite"
    @click="onCopyGameLog"
  >
    {{ buttonLabel }}
  </button>
</template>

<style scoped>
/* why: mirrors the DiagnosticExportButton fixed-position pill, at the top of the
   SHARED bottom-left fixed-pill stack (each left: 8px, z-index: 9999):
   DiagnosticExportButton 8px, ViewLoadoutButton 40px (while `?match=`),
   "Download game log" 72px, this "Copy game log" 104px. (Was 72px, which after
   the WP-707 collision fix moved the download button up would have overlapped
   it — hence 104px.) Any new bottom-left pill MUST take the next free slot. */
.game-log-copy-button {
  position: fixed;
  bottom: 104px;
  left: 8px;
  /* why: a fixed min-width keeps the pill from resizing as the label swaps
     between "Copy game log", "Copied!", and "Copy failed". */
  min-width: 104px;
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

/* why: a brief green/red tint confirms the copy outcome the label already
   states, so success/failure reads at a glance on the outcome screen. */
.game-log-copy-button--copied {
  background: #166534;
  border-color: #22c55e;
}

.game-log-copy-button--failed {
  background: #7f1d1d;
  border-color: #ef4444;
}
</style>
