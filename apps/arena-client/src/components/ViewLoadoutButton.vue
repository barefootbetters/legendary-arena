<script lang="ts">
import { defineComponent, ref } from 'vue';

import { fetchMatchLagn } from '../lib/api/matchLagnApi';
import { encodeLagnToViewerUrl, REGISTRY_VIEWER_ORIGIN } from '../lib/lagnShareLink';
import { useAuthStore } from '../stores/auth';

/**
 * Small, unobtrusive fixed-position "View loadout in Registry Viewer" control on
 * the play surface. On click it fetches the current match's Tier-1 LAGN from
 * `GET /api/match/:matchId/lagn` (WP-361, authenticated with the player's session
 * bearer), base64url-encodes it into the Registry Viewer's `?lagn=` deep-link
 * (WP-362), and opens it in a new tab. A failure surfaces a brief, non-blocking
 * inline message rather than breaking the match view.
 *
 * Not rendered outside a live match (no `?match=`). A guest (null token) is
 * short-circuited to a sign-in message with NO fetch; an in-flight guard blocks
 * double-open; a blocked pop-up (`window.open` → null) shows a fallback message.
 * The `lagn` is treated opaquely — the client never validates or inspects it.
 *
 * Per the vue-sfc-loader separate-compile pipeline (D-6512) this SFC uses
 * `defineComponent({ setup() { return {...} } })` so the template's non-prop
 * bindings reach `_ctx`. Placement idiom mirrors the `DiagnosticExportButton.vue`
 * sibling (a distinct corner so the two never overlap).
 *
 * @see WP-363 §Scope; EC-393; DECISIONS.md D-24155.
 */
export default defineComponent({
  name: 'ViewLoadoutButton',
  setup() {
    // why: the match id is read once from `?match=` (the same source
    // DiagnosticExportButton uses); when absent this is not a live match and the
    // control does not render.
    const matchId = new URLSearchParams(window.location.search).get('match');
    const hasMatch = matchId !== null && matchId !== '';

    const statusMessage = ref<string | null>(null);
    const isLoading = ref(false);
    const authStore = useAuthStore();

    /**
     * Maps a non-200 fetch status to a full-sentence inline message.
     *
     * @param status The HTTP status (or 0 for a network / bad-body failure).
     * @returns The message to show next to the control.
     */
    function messageForStatus(status: number): string {
      if (status === 401) {
        return "Sign in to view this game's loadout.";
      }
      if (status === 403) {
        return 'Only players in this game can open its loadout.';
      }
      if (status === 404) {
        return "This game's loadout isn't available yet.";
      }
      return "The loadout couldn't be loaded — please try again.";
    }

    /**
     * Click handler: fetch the match LAGN, encode it into the viewer deep-link,
     * and open it in a new tab. Best-effort; never throws, never blocks the match.
     */
    async function onViewLoadout(): Promise<void> {
      // why: in-flight guard — a second click while a fetch is pending is ignored
      // so a double-click never opens two tabs or races two requests.
      if (isLoading.value || !hasMatch || matchId === null) {
        return;
      }
      statusMessage.value = null;

      // why: read the current bearer at click time; a guest (null token) is shown
      // the sign-in message WITHOUT firing an unauthenticated request just to get
      // a 401 back.
      const token = authStore.token;
      if (token === null) {
        statusMessage.value = "Sign in to view this game's loadout.";
        return;
      }

      isLoading.value = true;
      try {
        const result = await fetchMatchLagn(matchId, token);
        if (result.ok) {
          // why: `noopener` is mandatory — the opened viewer tab gets no reverse
          // `window.opener` handle to this play surface (anti reverse-tabnabbing).
          // Only the non-secret loadout payload goes in the URL; the bearer stays
          // in the fetch's Authorization header.
          const opened = window.open(
            encodeLagnToViewerUrl(result.lagn, REGISTRY_VIEWER_ORIGIN),
            '_blank',
            'noopener',
          );
          if (opened === null) {
            statusMessage.value =
              'Your browser blocked the loadout tab — allow pop-ups for this site and try again.';
          }
        } else {
          statusMessage.value = messageForStatus(result.status);
        }
      } finally {
        isLoading.value = false;
      }
    }

    return { hasMatch, statusMessage, isLoading, onViewLoadout };
  },
});
</script>

<template>
  <div v-if="hasMatch" class="view-loadout">
    <button
      type="button"
      class="view-loadout-button"
      data-testid="view-loadout-button"
      :disabled="isLoading"
      @click="onViewLoadout"
    >
      View loadout in Registry Viewer
    </button>
    <span
      v-if="statusMessage"
      class="view-loadout-status"
      data-testid="view-loadout-status"
      role="status"
    >
      {{ statusMessage }}
    </span>
  </div>
</template>

<style scoped>
/* why: fixed-position, bottom-left, stacked ABOVE the DiagnosticExportButton
   (which sits at bottom: 8px) so the two utility affordances never overlap.
   Mirrors the DiagnosticExportButton visual idiom. */
.view-loadout {
  position: fixed;
  bottom: 40px;
  left: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 260px;
  /* why: above any game overlay/modal, matching the DiagnosticExportButton
     z-index — the loadout link stays reachable during play. */
  z-index: 9999;
}

.view-loadout-button {
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
}

.view-loadout-button:hover:not(:disabled) {
  background: #475569;
  border-color: #94a3b8;
}

.view-loadout-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.view-loadout-status {
  font-size: 11px;
  font-family: monospace;
  padding: 4px 8px;
  color: #fca5a5;
  background: #1f2937;
  border: 1px solid #475569;
  border-radius: 4px;
}
</style>
