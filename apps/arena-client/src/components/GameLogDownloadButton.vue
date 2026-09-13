<script lang="ts">
import { computed, defineComponent } from 'vue';
import { storeToRefs } from 'pinia';
import { useUiStateStore } from '../stores/uiState';
import { buildGameLogText } from './log/gameLogExport';
import { downloadTextFile } from '../lib/downloadTextFile';

/**
 * Small fixed-position "Download game log" button, mounted once at the play
 * viewport root beside `<DiagnosticExportButton>`.
 *
 * Why it exists (Jeff feedback): at the end-of-match outcome screen the shared
 * board — and with it the `GameLogPanel` whose "Save" button downloads the log
 * transcript — is collapsed behind the "View final board" toggle (the
 * outcome-primary layout). So on the endgame screen the only reachable download
 * is "Download diagnostics"; the human-readable game-log `.txt` has no button,
 * which reads as a missing log. This fills that gap: it appears at game over
 * (when a non-empty log exists) right above the diagnostics button, so the log
 * can be saved without expanding the board. During play it stays hidden — the
 * `GameLogPanel` Save button already covers that.
 *
 * The log itself is unchanged engine-authored data (`UIState.log`); this is a
 * read-only export, same as the diagnostics button. Per the vue-sfc-loader
 * separate-compile pipeline (D-6512) this SFC uses the
 * `defineComponent({ setup() { return {...} } })` form so the template's
 * non-prop bindings reach `_ctx`.
 */
export default defineComponent({
  name: 'GameLogDownloadButton',
  setup() {
    const store = useUiStateStore();
    const { snapshot } = storeToRefs(store);

    // why: the button is the ENDGAME log-download affordance. It shows only when
    // the match is over (gameOver set) AND there is a log to save — during play
    // the GameLogPanel Save button already offers this, so showing it then would
    // duplicate that control.
    const hasDownloadableLog = computed<boolean>(() => {
      const current = snapshot.value;
      return current !== null && current.gameOver !== undefined && current.log.length > 0;
    });

    /**
     * Builds a match-scoped file name mirroring the diagnostics export scheme
     * (`legendary-arena-diagnostics-<match>-<ts>.json`) so a player's per-match
     * archive keeps the log and diagnostics files side by side.
     */
    function buildFileName(): string {
      const matchId = new URLSearchParams(window.location.search).get('match');
      const rawMatchSegment = matchId !== null && matchId !== '' ? matchId : 'no-match';
      // why: a match id can carry '/' or '\' (set-qualified ids); strip them so
      // the value is a safe single file-name segment, exactly as
      // buildDiagnosticFileName does.
      const safeMatchSegment = rawMatchSegment.replaceAll('/', '-').replaceAll('\\', '-');
      // why: Date.now() is a client-layer file-name stamp for the export moment,
      // outside the engine determinism boundary (mirrors the diagnostics export).
      return `legendary-arena-game-log-${safeMatchSegment}-${Date.now()}.txt`;
    }

    function onDownloadGameLog(): void {
      const current = snapshot.value;
      if (current === null) {
        return;
      }
      downloadTextFile(buildFileName(), buildGameLogText(current.log));
    }

    return { hasDownloadableLog, onDownloadGameLog };
  },
});
</script>

<template>
  <button
    v-if="hasDownloadableLog"
    type="button"
    class="game-log-download-button"
    data-testid="game-log-download-button"
    @click="onDownloadGameLog"
  >
    Download game log
  </button>
</template>

<style scoped>
/* why: mirrors the DiagnosticExportButton fixed-position pill, stacked directly
   above it (bottom: 40px vs its 8px) so the endgame "Download diagnostics" and
   "Download game log" affordances sit together in the bottom-left corner. */
.game-log-download-button {
  position: fixed;
  bottom: 40px;
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
     panel, matching the diagnostics button it sits beside. */
  z-index: 9999;
}

.game-log-download-button:hover {
  background: #475569;
  border-color: #94a3b8;
}
</style>
