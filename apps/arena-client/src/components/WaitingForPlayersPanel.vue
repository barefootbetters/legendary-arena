<script lang="ts">
import { computed, defineComponent, ref } from 'vue';

import { useMatchInvites } from '../composables/useMatchInvites';
import { useMatchSeatStatus } from '../composables/useMatchSeatStatus';
import { useAuthStore } from '../stores/auth';
import { addGuest, buildGuestPlayUrl } from '../lobby/lobbyApi';
import type { MatchInviteApiErrorCode } from '../lib/api/matchInvitesApi';

/**
 * Pre-match waiting-room panel on the play surface (WP-369). While the current
 * match still has an open seat, it shows how many seats are filled, lets a
 * seated player invite a friend by `@handle` (reusing the WP-366
 * `useMatchInvites().invite` plumbing), and offers a copy-join-link. It
 * auto-hides the moment the last seat fills.
 *
 * Supersedes WP-366's always-on corner `InviteFriendControl` — inviting is only
 * meaningful while a seat is open, so this seat-aware panel is the sole invite
 * surface. Seat-fill is polled from the public lobby list (`useMatchSeatStatus`),
 * never read from the boardgame.io transport (D-24163). The match id is read once
 * from `?match=` (the `ViewLoadoutButton` idiom); this panel reads only that id —
 * it never touches `G` or the UIState projection.
 *
 * Identity is `@handle` only — no `accountId` shown or sent (FR-2). Copy is co-op
 * ("waiting" / "invite" / "join"), never PvP framing (§23(b)).
 *
 * Per the vue-sfc-loader separate-compile pipeline (D-6512) this SFC uses
 * `defineComponent({ setup() { return {...} } })` so the template's non-prop
 * bindings reach `_ctx`.
 *
 * @see WP-369 §Scope; EC-398; DECISIONS.md D-24163.
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
  name: 'WaitingForPlayersPanel',
  setup() {
    // why: the match id is read once from `?match=` (the same source
    // ViewLoadoutButton uses); when absent this is not a live match.
    const matchId = new URLSearchParams(window.location.search).get('match') ?? '';
    const hasMatch = matchId !== '';
    const authStore = useAuthStore();

    const { totalSeats, openSeats, isFull } = useMatchSeatStatus(matchId);

    // why: the panel is meaningful only while a seat is open, for a signed-in
    // player in a live match. A computed (not a one-shot read) so it reacts to
    // the poll filling the last seat (auto-hide) and to a late auth resolve.
    const isVisible = computed(
      () =>
        hasMatch &&
        authStore.isAuthenticated &&
        // why: WP-629 — stay visible while a guest link is pending. Adding a guest
        // FILLS the seat, which flips openSeats to 0 and would otherwise auto-hide
        // the panel before the host can copy the hand-off link. Keep it up (even
        // when full) until the host dismisses the guest link.
        ((!isFull.value && openSeats.value > 0) || guestLink.value !== null),
    );
    const filledSeats = computed(() => totalSeats.value - openSeats.value);

    const { errorCode, invite } = useMatchInvites(() => authStore.token);
    const handleInput = ref('');
    const confirmation = ref<string | null>(null);
    const linkCopied = ref<boolean>(false);
    const isSubmitting = ref<boolean>(false);
    // why: WP-628 — guest-seat hand-off state. `guestLink` holds the built
    // ?match&player&credentials URL after a successful add; the rest drive the
    // button's disabled/copied/error states.
    const isAddingGuest = ref<boolean>(false);
    const guestLink = ref<string | null>(null);
    const guestLinkCopied = ref<boolean>(false);
    const addGuestError = ref<string | null>(null);

    /**
     * Send the invite for the typed handle. A leading `@` is stripped; an empty
     * handle is ignored. On success the box clears and a confirmation shows.
     */
    async function onInvite(): Promise<void> {
      if (isSubmitting.value || !hasMatch) {
        return;
      }
      confirmation.value = null;
      linkCopied.value = false;
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

    /**
     * Copy a public join link for this match to the clipboard. The link carries
     * only `?route=lobby&match=<id>` — no bearer, credentials, or seat.
     */
    async function onCopyLink(): Promise<void> {
      const joinLink = `${window.location.origin}/?route=lobby&match=${encodeURIComponent(matchId)}`;
      // why: navigator.clipboard is absent in some test/embedded contexts; guard
      // it so a copy attempt never throws and breaks the panel.
      if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
        return;
      }
      try {
        await navigator.clipboard.writeText(joinLink);
        confirmation.value = null;
        linkCopied.value = true;
      } catch {
        // why: a denied clipboard permission is non-fatal — the panel stays
        // usable and the player can still invite by handle.
        linkCopied.value = false;
      }
    }

    /**
     * Add an anonymous guest seat to this match (WP-628 / D-24438). Calls the
     * host-gated WP-627 endpoint, then builds the guest play link. On failure a
     * co-op-framed message is shown; the handler never throws.
     */
    async function onAddGuest(): Promise<void> {
      const token = authStore.token;
      // why: RS-1 — authStore.token is `string | null`. The isVisible gate implies
      // a token at render, but narrow it explicitly here so vue-tsc is satisfied
      // without a non-null assertion.
      if (isAddingGuest.value || !hasMatch || token === null) {
        return;
      }
      addGuestError.value = null;
      guestLink.value = null;
      guestLinkCopied.value = false;
      isAddingGuest.value = true;
      try {
        const { seat, credentials } = await addGuest(matchId, token);
        // why: the guest occupies the seat through the same ?match&player&credentials
        // URL App.vue's UNGUARDED live route already consumes (createLiveClient
        // connects with credentials only, no Hanko session). Hot-seat / physical
        // hand-off only — the remote device-bound seat-bind link is deferred (D-24438).
        guestLink.value = buildGuestPlayUrl(matchId, seat, credentials);
      } catch (addError) {
        // why: map the wrapper's attached HTTP status to a co-op message — 409 is
        // "no open seat" (the cap or a full match), everything else a generic retry.
        // Never re-throw: a failed add must not break the panel.
        const status = (addError as { status?: number }).status;
        addGuestError.value =
          status === 409
            ? 'This match is full — there’s no open seat for a guest.'
            : 'Couldn’t add a guest — please try again.';
      } finally {
        isAddingGuest.value = false;
      }
    }

    /**
     * Open the guest seat in a new tab (same-device hot-seat: hand over the
     * keyboard) once a guest link exists.
     */
    function onOpenGuestSeat(): void {
      if (guestLink.value === null) {
        return;
      }
      // why: RS-2 — window.open is absent/blocked in some contexts; guard it so a
      // failed open never throws out of the handler (mirrors the clipboard guard).
      if (typeof window === 'undefined' || typeof window.open !== 'function') {
        return;
      }
      window.open(guestLink.value, '_blank', 'noopener');
    }

    /**
     * Copy the guest play link so the host can hand it to a walk-up player on a
     * second local device. Guarded like {@link onCopyLink}.
     */
    async function onCopyGuestLink(): Promise<void> {
      if (guestLink.value === null) {
        return;
      }
      if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
        return;
      }
      try {
        await navigator.clipboard.writeText(guestLink.value);
        guestLinkCopied.value = true;
      } catch {
        guestLinkCopied.value = false;
      }
    }

    /**
     * Dismiss the guest hand-off once the host has copied or opened the link, so
     * the panel can hide (the seat the guest took is now filled).
     */
    function onDismissGuest(): void {
      guestLink.value = null;
      guestLinkCopied.value = false;
      addGuestError.value = null;
    }

    return {
      isVisible,
      totalSeats,
      openSeats,
      filledSeats,
      handleInput,
      confirmation,
      linkCopied,
      errorCode,
      isSubmitting,
      onInvite,
      onCopyLink,
      inviteErrorMessage,
      isAddingGuest,
      guestLink,
      guestLinkCopied,
      addGuestError,
      onAddGuest,
      onOpenGuestSeat,
      onCopyGuestLink,
      onDismissGuest,
    };
  },
});
</script>

<template>
  <div v-if="isVisible" class="waiting-room" data-testid="waiting-room">
    <p class="waiting-room-title" data-testid="waiting-room-title">
      Waiting for players — {{ filledSeats }} of {{ totalSeats }}
    </p>
    <p class="waiting-room-seats">
      {{ openSeats }} seat{{ openSeats === 1 ? '' : 's' }} still open. Invite a
      friend to fill {{ openSeats === 1 ? 'it' : 'them' }}.
    </p>
    <form class="waiting-room-form" @submit.prevent="onInvite">
      <input
        v-model="handleInput"
        type="text"
        class="waiting-room-input"
        data-testid="waiting-room-handle"
        placeholder="@handle"
        autocomplete="off"
      />
      <button
        type="submit"
        class="waiting-room-button"
        data-testid="waiting-room-invite"
        :disabled="isSubmitting"
      >
        Invite
      </button>
    </form>
    <button
      type="button"
      class="waiting-room-link"
      data-testid="waiting-room-copy-link"
      @click="onCopyLink"
    >
      Copy join link
    </button>
    <span
      v-if="linkCopied"
      class="waiting-room-note"
      data-testid="waiting-room-link-copied"
      role="status"
    >
      Link copied.
    </span>
    <span
      v-else-if="confirmation !== null"
      class="waiting-room-note"
      data-testid="waiting-room-confirm"
      role="status"
    >
      {{ confirmation }}
    </span>
    <span
      v-else-if="errorCode !== null"
      class="waiting-room-error"
      data-testid="waiting-room-error"
      role="status"
    >
      {{ inviteErrorMessage(errorCode) }}
    </span>
    <button
      type="button"
      class="waiting-room-button"
      data-testid="waiting-room-add-guest"
      :disabled="isAddingGuest"
      @click="onAddGuest"
    >
      Add guest
    </button>
    <div
      v-if="guestLink !== null"
      class="waiting-room-guest"
      data-testid="waiting-room-guest"
    >
      <p class="waiting-room-seats">
        Guest seat ready — open it here (hand over the keyboard) or copy the
        link to a nearby device.
      </p>
      <button
        type="button"
        class="waiting-room-link"
        data-testid="waiting-room-open-guest"
        @click="onOpenGuestSeat"
      >
        Open guest seat
      </button>
      <button
        type="button"
        class="waiting-room-link"
        data-testid="waiting-room-copy-guest"
        @click="onCopyGuestLink"
      >
        Copy guest link
      </button>
      <span
        v-if="guestLinkCopied"
        class="waiting-room-note"
        data-testid="waiting-room-guest-copied"
        role="status"
      >
        Guest link copied.
      </span>
      <button
        type="button"
        class="waiting-room-link"
        data-testid="waiting-room-guest-done"
        @click="onDismissGuest"
      >
        Done
      </button>
    </div>
    <span
      v-if="addGuestError !== null"
      class="waiting-room-error"
      data-testid="waiting-room-add-guest-error"
      role="status"
    >
      {{ addGuestError }}
    </span>
  </div>
</template>

<style scoped>
/* why: a fixed-position panel in the bottom-right corner, distinct from the
   bottom-left ViewLoadoutButton / DiagnosticExportButton stack so the utility
   affordances never overlap. Slightly larger than the old corner control since
   it now carries seat status + a copy-link. */
.waiting-room {
  position: fixed;
  bottom: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 280px;
  padding: 10px 12px;
  background: rgba(20, 20, 28, 0.94);
  border: 1px solid #475569;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  /* why: above any game overlay/modal, matching the ViewLoadoutButton z-index. */
  z-index: 9999;
}

.waiting-room-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
}

.waiting-room-seats {
  margin: 0;
  font-size: 11px;
  color: #cbd5e1;
}

.waiting-room-form {
  display: inline-flex;
  gap: 4px;
}

.waiting-room-input {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  font-family: monospace;
  padding: 5px 8px;
  color: #f1f5f9;
  background: #1f2937;
  border: 1px solid #64748b;
  border-radius: 4px;
}

.waiting-room-button {
  font-size: 12px;
  font-family: monospace;
  padding: 5px 10px;
  color: #f1f5f9;
  background: #334155;
  border: 1px solid #64748b;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}

.waiting-room-button:hover:not(:disabled) {
  background: #475569;
  border-color: #94a3b8;
}

.waiting-room-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.waiting-room-link {
  align-self: flex-start;
  font-size: 11px;
  font-family: monospace;
  padding: 3px 0;
  color: #93c5fd;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

.waiting-room-note {
  font-size: 11px;
  font-family: monospace;
  color: #86efac;
}

.waiting-room-error {
  font-size: 11px;
  font-family: monospace;
  color: #fca5a5;
}
</style>
