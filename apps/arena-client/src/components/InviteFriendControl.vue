<script lang="ts">
import { computed, defineComponent, ref } from 'vue';

import { useMatchInvites } from '../composables/useMatchInvites';
import { useAuthStore } from '../stores/auth';
import type { MatchInviteApiErrorCode } from '../lib/api/matchInvitesApi';

/**
 * Small, unobtrusive fixed-position "Invite a friend" control on the play
 * surface. A seated player types a friend's `@handle` and sends them an invite
 * into the current match via `POST /api/match/invites` (WP-358), reusing the
 * `useMatchInvites().invite` action (WP-366). Typed per-code copy renders inline
 * on failure; the box clears and confirms on success.
 *
 * Not rendered outside a live match (no `?match=`) or for a guest — playing a
 * seat requires a signed-in account (D-24092), and only a seated player may
 * invite. The match id is read once from `?match=` (the same source
 * `ViewLoadoutButton` / `DiagnosticExportButton` use); this control reads only
 * that id and posts an invite — it never touches `G` or the UIState projection.
 *
 * Identity is `@handle` only — no `accountId` is shown or sent (FR-2). Copy is
 * co-op ("invite" / "game"), never PvP framing (§23(b)).
 *
 * Per the vue-sfc-loader separate-compile pipeline (D-6512) this SFC uses
 * `defineComponent({ setup() { return {...} } })` so the template's non-prop
 * bindings reach `_ctx`. Placement idiom mirrors the `ViewLoadoutButton.vue`
 * sibling (a distinct corner so the utility affordances never overlap).
 *
 * @see WP-366 §Scope; EC-396; DECISIONS.md D-24158.
 */

/**
 * Map an inviter-side failure code to a full-sentence, co-op-framed line
 * (§23(b) — no match/opponent/win language).
 */
function inviteErrorMessage(code: MatchInviteApiErrorCode | null): string {
  if (code === 'not_friends') {
    return 'You can only invite players on your friends list.';
  }
  if (code === 'handle_not_found') {
    return 'No player with that handle was found.';
  }
  if (code === 'not_in_match') {
    return 'You must be in the game to invite a friend.';
  }
  if (code === 'already_invited') {
    return 'That friend has already been invited to this game.';
  }
  if (code === 'self_invite') {
    return 'You can’t invite yourself.';
  }
  // why: the remaining codes (unauthorized / invalid_request / unknown_account /
  // invite_not_found) plus a network null all fall through to one generic line.
  return 'Couldn’t send the invite — please try again.';
}

export default defineComponent({
  name: 'InviteFriendControl',
  setup() {
    // why: the match id is read once from `?match=` (the same source
    // ViewLoadoutButton uses); when absent this is not a live match and the
    // control does not render.
    const matchId = new URLSearchParams(window.location.search).get('match');
    const hasMatch = matchId !== null && matchId !== '';
    const authStore = useAuthStore();

    const { errorCode, invite } = useMatchInvites(() => authStore.token);
    const handleInput = ref('');
    const confirmation = ref<string | null>(null);
    const isSubmitting = ref(false);

    /**
     * Send the invite for the typed handle. A leading `@` is stripped; an empty
     * handle is ignored. On success the box clears and a confirmation shows; on
     * failure `errorCode` drives the inline message.
     */
    async function onInvite(): Promise<void> {
      if (isSubmitting.value || matchId === null) {
        return;
      }
      confirmation.value = null;
      const handle = handleInput.value.trim().replace(/^@/, '');
      if (handle === '') {
        return;
      }
      isSubmitting.value = true;
      const ok = await invite(matchId, handle);
      isSubmitting.value = false;
      if (ok === true) {
        confirmation.value = `Invited @${handle} to this game.`;
        handleInput.value = '';
      }
    }

    return {
      hasMatch,
      // why: a computed (not a one-shot read) so the control appears if the auth
      // session resolves after this control mounts.
      isAuthenticated: computed(() => authStore.isAuthenticated),
      handleInput,
      confirmation,
      errorCode,
      isSubmitting,
      onInvite,
      inviteErrorMessage,
    };
  },
});
</script>

<template>
  <div v-if="hasMatch && isAuthenticated" class="invite-friend" data-testid="invite-friend">
    <form class="invite-friend-form" @submit.prevent="onInvite">
      <label class="invite-friend-label" for="invite-friend-handle">
        Invite a friend
      </label>
      <span class="invite-friend-row">
        <input
          id="invite-friend-handle"
          v-model="handleInput"
          type="text"
          class="invite-friend-input"
          data-testid="invite-friend-handle"
          placeholder="@handle"
          autocomplete="off"
        />
        <button
          type="submit"
          class="invite-friend-button"
          data-testid="invite-friend-submit"
          :disabled="isSubmitting"
        >
          Invite
        </button>
      </span>
    </form>
    <span
      v-if="confirmation !== null"
      class="invite-friend-confirm"
      data-testid="invite-friend-confirm"
      role="status"
    >
      {{ confirmation }}
    </span>
    <span
      v-else-if="errorCode !== null"
      class="invite-friend-error"
      data-testid="invite-friend-error"
      role="status"
    >
      {{ inviteErrorMessage(errorCode) }}
    </span>
  </div>
</template>

<style scoped>
/* why: fixed-position, bottom-right, so it never overlaps the bottom-left
   ViewLoadoutButton / DiagnosticExportButton stack. Mirrors their utility
   idiom (monospace, dark chip) so the play surface stays consistent. */
.invite-friend {
  position: fixed;
  bottom: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 260px;
  /* why: above any game overlay/modal, matching the ViewLoadoutButton z-index
     so the invite control stays reachable during play. */
  z-index: 9999;
}

.invite-friend-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.invite-friend-label {
  font-size: 11px;
  font-family: monospace;
  color: #cbd5e1;
}

.invite-friend-row {
  display: inline-flex;
  gap: 4px;
}

.invite-friend-input {
  font-size: 12px;
  font-family: monospace;
  padding: 5px 8px;
  width: 150px;
  color: #f1f5f9;
  background: #1f2937;
  border: 1px solid #64748b;
  border-radius: 4px;
}

.invite-friend-button {
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

.invite-friend-button:hover:not(:disabled) {
  background: #475569;
  border-color: #94a3b8;
}

.invite-friend-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.invite-friend-confirm,
.invite-friend-error {
  font-size: 11px;
  font-family: monospace;
  padding: 4px 8px;
  background: #1f2937;
  border: 1px solid #475569;
  border-radius: 4px;
}

.invite-friend-confirm {
  color: #86efac;
}

.invite-friend-error {
  color: #fca5a5;
}
</style>
