<script lang="ts">
import { defineComponent, onMounted, ref, type PropType } from 'vue';

import { useMatchInvites } from '../composables/useMatchInvites';
import { listMatches, joinMatch } from '../lobby/lobbyApi';
import { joinMatchFromInvite } from '../lib/joinMatchFromInvite';
import type {
  MatchInviteApiErrorCode,
  MatchInviteView,
} from '../lib/api/matchInvitesApi';

// why: defineComponent({ setup() { return {...} } }) is required (NOT
// <script setup>) per D-6512 — the @legendary-arena/vue-sfc-loader
// separate-compile pipeline only reaches `_ctx` when explicitly returned.

/**
 * Map a match-invite failure code to a full-sentence line. Copy is social /
 * co-op — "invite" / "game" — with no match/opponent/win framing (§23(b)).
 */
function inviteMessageForCode(code: MatchInviteApiErrorCode | null): string {
  if (code === 'invite_not_found') {
    return 'That invite is no longer available.';
  }
  if (code === 'unauthorized') {
    return 'Please sign in again.';
  }
  // why: the remaining codes are inviter-side (self_invite / not_in_match /
  // not_friends / already_invited / handle_not_found) or a network null —
  // all fall through to one generic line so the section stays usable.
  return 'Something went wrong. Please try again.';
}

/**
 * Full-sentence line for a join-from-invite failure reason (WP-366). Co-op
 * framing, no PvP language (§23(b)).
 */
function joinFailureMessage(reason: 'not_joinable' | 'full' | 'error'): string {
  if (reason === 'not_joinable') {
    return 'That game is no longer available to join.';
  }
  if (reason === 'full') {
    return 'That game is already full.';
  }
  return 'Couldn’t join the game — please try again.';
}

export default defineComponent({
  name: 'MatchInvitesSection',
  props: {
    authToken: {
      type: [String, null] as unknown as PropType<string | null>,
      required: true,
    },
    // why: the display name to show for the joined seat (the lobby requires a
    // non-empty name). Sourced from the owner profile by the parent page; a
    // signed-in player always has a NOT-NULL display_name, so '' only occurs
    // before the profile loads (guarded before the join).
    playerName: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    const { invites, isLoading, errorCode, load, accept, decline } =
      useMatchInvites(() => props.authToken);

    // why: WP-366 — a join-from-invite status line (replaces the WP-360 Lobby
    // hand-off). Set only when the post-accept join can't complete.
    const joinMessage = ref<string | null>(null);

    /**
     * Accept the invite, then join its match: find the first open seat via the
     * lobby `listMatches` and `joinMatch`, and navigate into play. A gone / full
     * match or a join failure surfaces an inline line instead of navigating.
     */
    async function onAccept(invite: MatchInviteView): Promise<void> {
      joinMessage.value = null;
      const accepted = await accept(invite.matchId);
      if (accepted !== true) {
        // why: the accept itself failed — errorCode already drives the message.
        return;
      }
      const authToken = props.authToken;
      if (authToken === null) {
        joinMessage.value = 'Please sign in again to join this game.';
        return;
      }
      const result = await joinMatchFromInvite(
        invite.matchId,
        props.playerName,
        authToken,
        {
          listMatches,
          joinMatch,
          // why: navigation is injected so the orchestration stays testable; in
          // production it sets the browser query, exactly like the lobby's join.
          navigate: (query: string) => {
            window.location.search = query;
          },
        },
      );
      if (result.ok === false) {
        joinMessage.value = joinFailureMessage(result.reason);
      }
    }

    async function onDecline(invite: MatchInviteView): Promise<void> {
      await decline(invite.matchId);
    }

    onMounted(() => {
      void load();
    });

    return {
      invites,
      isLoading,
      errorCode,
      joinMessage,
      onAccept,
      onDecline,
      inviteMessageForCode,
    };
  },
});
</script>

<template>
  <section class="match-invites-section" data-testid="match-invites-section">
    <h2>Game invites</h2>
    <p class="match-invites-help">
      Friends can invite you into a game. Accept one to jump straight in.
    </p>

    <p
      v-if="errorCode !== null"
      class="match-invites-error"
      data-testid="match-invites-error"
    >
      {{ inviteMessageForCode(errorCode) }}
    </p>

    <p
      v-if="joinMessage !== null"
      class="match-invites-error"
      data-testid="match-invites-join-status"
    >
      {{ joinMessage }}
    </p>

    <p
      v-if="isLoading"
      class="match-invites-status"
      data-testid="match-invites-loading"
    >
      Loading your game invites…
    </p>

    <template v-if="invites.length === 0">
      <p class="match-invites-empty" data-testid="match-invites-empty">
        No pending game invites.
      </p>
    </template>

    <ul v-else class="match-invites-list" data-testid="match-invites-list">
      <li
        v-for="invite in invites"
        :key="invite.matchId"
        class="match-invites-row"
        :data-testid="`match-invite-${invite.matchId}`"
      >
        <span class="match-invites-inviter">
          <strong>@{{ invite.inviterHandle }}</strong>
          <span class="match-invites-name">{{ invite.inviterDisplayName }}</span>
          invited you to a game
        </span>
        <span class="match-invites-actions">
          <button
            type="button"
            :data-testid="`match-invite-accept-${invite.matchId}`"
            @click="onAccept(invite)"
          >
            Accept
          </button>
          <button
            type="button"
            :data-testid="`match-invite-decline-${invite.matchId}`"
            @click="onDecline(invite)"
          >
            Decline
          </button>
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.match-invites-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.match-invites-section h2 {
  font-size: 1.125rem;
  margin: 0 0 0.25rem 0;
}

.match-invites-help {
  font-size: 0.875rem;
  opacity: 0.75;
  margin: 0;
}

.match-invites-error {
  font-size: 0.875rem;
  color: #b3261e;
  margin: 0;
}

.match-invites-status,
.match-invites-empty {
  font-size: 0.875rem;
  opacity: 0.75;
  margin: 0;
}

.match-invites-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.match-invites-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  font-size: 0.875rem;
  align-items: center;
}

.match-invites-name {
  color: rgba(0, 0, 0, 0.65);
  margin: 0 0.25rem;
}

.match-invites-actions {
  display: inline-flex;
  gap: 0.375rem;
}

/* why: stack the row on narrow screens so the inviter line + actions stay
   usable on mobile (mirrors the FriendsSection breakpoint). */
@media (max-width: 40rem) {
  .match-invites-row {
    grid-template-columns: 1fr;
  }
}
</style>
