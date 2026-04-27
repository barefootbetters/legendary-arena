<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { SubmitMove } from './uiMoveName.types';

// why: defineComponent({ setup() { return {...} } }) per the vue-sfc-loader
// separate-compile pipeline (D-6512 / P6-30) — the template references the
// click handlers as non-prop bindings. Precedent: HandRow, CityRow, HQRow,
// MastermindTile, TurnActionBar.
//
// LobbyControls is intentionally STATELESS. It does not receive a
// UILobbyState projection (UIState does not project G.lobby in this
// scaffold). The three buttons are unconditionally enabled; the engine
// validates on receipt:
//   - setPlayerReady requires args.ready: boolean and only mutates the
//     calling player's slot in G.lobby.ready.
//   - startMatchIfReady requires all required players ready
//     (validateCanStartMatch) and silently no-ops otherwise.
// The phase transition itself (lobby → play, when validation passes) is
// the visible "it worked" signal. Adding uiState.lobby projection is a
// future engine-projection WP — see WP-100 §Out of Scope.
export default defineComponent({
  name: 'LobbyControls',
  props: {
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props) {
    /**
     * Mark the viewing player as ready in the lobby. The engine sets
     * `G.lobby.ready[ctx.currentPlayer] = true`.
     */
    function onMarkReady(): void {
      // why: explicit boolean payload; engine validates args.ready is a
      // boolean per validateSetPlayerReadyArgs.
      props.submitMove('setPlayerReady', { ready: true });
    }

    /**
     * Mark the viewing player as NOT ready in the lobby. The engine sets
     * `G.lobby.ready[ctx.currentPlayer] = false`.
     */
    function onMarkNotReady(): void {
      // why: explicit boolean payload; sym-pair to onMarkReady so a player
      // can withdraw their ready state without leaving the match.
      props.submitMove('setPlayerReady', { ready: false });
    }

    /**
     * Request that the match start. The engine validates that all required
     * players are ready (`validateCanStartMatch`) and silently no-ops if
     * they are not. On success, the engine calls `setPhase('play')` per
     * the WP-100 §Scope J retarget (D-10006).
     */
    function onStartMatch(): void {
      // why: empty-object payload — startMatchIfReady takes no arguments by
      // engine design (lobby.moves.ts:48-50). The move reads G.lobby.ready
      // and decides on its own.
      props.submitMove('startMatchIfReady', {});
    }

    return { onMarkReady, onMarkNotReady, onStartMatch };
  },
});
</script>

<template>
  <section
    class="lobby-controls"
    data-testid="play-lobby-controls"
    aria-label="Lobby controls"
  >
    <button
      type="button"
      data-testid="play-lobby-mark-ready"
      @click="onMarkReady"
    >
      Mark Ready
    </button>
    <button
      type="button"
      data-testid="play-lobby-mark-not-ready"
      @click="onMarkNotReady"
    >
      Mark Not Ready
    </button>
    <button
      type="button"
      data-testid="play-lobby-start-match"
      @click="onStartMatch"
    >
      Start Match
    </button>
  </section>
</template>

<style scoped>
.lobby-controls {
  display: flex;
  gap: 0.5rem;
}

.lobby-controls button {
  padding: 0.5rem 1rem;
}
</style>
