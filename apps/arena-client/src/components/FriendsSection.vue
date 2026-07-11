<script lang="ts">
import { defineComponent, onMounted, ref, type PropType } from 'vue';

import { useFriends } from '../composables/useFriends';
import type { FriendApiErrorCode } from '../lib/api/friendsApi';

// why: defineComponent({ setup() { return {...} } }) is required (NOT
// <script setup>) per D-6512 / P6-30 — the @legendary-arena/vue-sfc-loader
// separate-compile pipeline only reaches `_ctx` when explicitly returned
// from setup().

/**
 * Map a friend-action failure code to a full-sentence line shown in the
 * section. The copy is deliberately social — "friend" / "request" /
 * "add" — with no match/opponent/win-loss framing (§23(b)). A `null`
 * code (network failure or unrecognized status) falls through to the
 * generic banner.
 */
function friendMessageForCode(code: FriendApiErrorCode | null): string {
  if (code === 'already_friends') {
    return "You're already friends.";
  }
  if (code === 'already_pending') {
    return 'A request to that player is already pending.';
  }
  if (code === 'handle_not_found') {
    return 'No player with that handle.';
  }
  if (code === 'handle_required') {
    return 'Claim a handle first to add friends.';
  }
  if (code === 'self_friendship') {
    return "You can't friend yourself.";
  }
  if (code === 'not_addressee') {
    return 'Only the player who received a request can respond to it.';
  }
  if (code === 'no_pending_request') {
    return 'That request is no longer pending.';
  }
  if (code === 'not_friends') {
    return "You're not friends with that player.";
  }
  if (code === 'unauthorized') {
    return 'Please sign in again.';
  }
  // why: unknown_account / invalid_request / a network null all fall
  // through to one generic line — the section stays usable and never
  // leaks an internal code to the reader.
  return 'Something went wrong. Please try again.';
}

export default defineComponent({
  name: 'FriendsSection',
  props: {
    authToken: {
      type: [String, null] as unknown as PropType<string | null>,
      required: true,
    },
  },
  setup(props) {
    const {
      friends,
      incoming,
      outgoing,
      isLoading,
      errorCode,
      load,
      add,
      accept,
      decline,
      remove,
    } = useFriends(() => props.authToken);

    const addHandle = ref<string>('');

    /**
     * Send a friend request for the typed `@handle`. A leading `@` is
     * stripped so both `nova` and `@nova` work; an empty box does
     * nothing. Clears the input only on success so a rejected handle
     * stays editable.
     */
    async function onAdd(): Promise<void> {
      const raw = addHandle.value.trim().replace(/^@/, '');
      if (raw === '') {
        return;
      }
      const ok = await add(raw);
      if (ok === true) {
        addHandle.value = '';
      }
    }

    onMounted(() => {
      void load();
    });

    return {
      friends,
      incoming,
      outgoing,
      isLoading,
      errorCode,
      addHandle,
      onAdd,
      accept,
      decline,
      remove,
      friendMessageForCode,
    };
  },
});
</script>

<template>
  <section class="friends-section" data-testid="friends-section">
    <h2>Friends</h2>
    <p class="friends-help">
      Add a friend by their <strong>@handle</strong>. They'll get a request to
      accept before you're connected.
    </p>

    <div class="friends-add" data-testid="friends-add">
      <input
        v-model="addHandle"
        type="text"
        placeholder="@handle"
        data-testid="friends-add-input"
        @keyup.enter="onAdd"
      />
      <button
        type="button"
        class="friends-add-button"
        data-testid="friends-add-button"
        @click="onAdd"
      >
        Add friend
      </button>
    </div>

    <p
      v-if="errorCode !== null"
      class="friends-error"
      data-testid="friends-error"
    >
      {{ friendMessageForCode(errorCode) }}
    </p>

    <p v-if="isLoading" class="friends-status" data-testid="friends-loading">
      Loading your friends…
    </p>

    <!-- Requests -->
    <div class="friends-panel" data-testid="friends-requests">
      <h3>Requests</h3>

      <template v-if="incoming.length === 0 && outgoing.length === 0">
        <p class="friends-empty" data-testid="friends-requests-empty">
          No pending friend requests.
        </p>
      </template>

      <ul
        v-if="incoming.length > 0"
        class="friends-list"
        data-testid="friends-incoming-list"
      >
        <li
          v-for="request in incoming"
          :key="request.handle"
          class="friends-row"
          :data-testid="`friends-incoming-${request.handle}`"
        >
          <span class="friends-handle">@{{ request.handle }}</span>
          <span class="friends-name">{{ request.displayName }}</span>
          <span class="friends-actions">
            <button
              type="button"
              :data-testid="`friends-accept-${request.handle}`"
              @click="accept(request.handle)"
            >
              Accept
            </button>
            <button
              type="button"
              :data-testid="`friends-decline-${request.handle}`"
              @click="decline(request.handle)"
            >
              Decline
            </button>
          </span>
        </li>
      </ul>

      <!-- why: outgoing requests are display-only — WP-351 exposes no
           cancel-my-sent-request route (Known gap), so there is no
           affordance to rescind a pending request from here. -->
      <ul
        v-if="outgoing.length > 0"
        class="friends-list"
        data-testid="friends-outgoing-list"
      >
        <li
          v-for="request in outgoing"
          :key="request.handle"
          class="friends-row"
          :data-testid="`friends-outgoing-${request.handle}`"
        >
          <span class="friends-handle">@{{ request.handle }}</span>
          <span class="friends-name">{{ request.displayName }}</span>
          <span class="friends-pending">Request sent</span>
        </li>
      </ul>
    </div>

    <!-- Friends -->
    <div class="friends-panel" data-testid="friends-friends">
      <h3>Your friends</h3>
      <template v-if="friends.length === 0">
        <p class="friends-empty" data-testid="friends-empty">
          You have no friends yet. Add one by their @handle above.
        </p>
      </template>
      <ul v-else class="friends-list" data-testid="friends-list">
        <li
          v-for="friend in friends"
          :key="friend.handle"
          class="friends-row"
          :data-testid="`friends-friend-${friend.handle}`"
        >
          <span class="friends-handle">@{{ friend.handle }}</span>
          <span class="friends-name">{{ friend.displayName }}</span>
          <span class="friends-actions">
            <button
              type="button"
              :data-testid="`friends-remove-${friend.handle}`"
              @click="remove(friend.handle)"
            >
              Remove
            </button>
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.friends-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.friends-section h2 {
  font-size: 1.125rem;
  margin: 0 0 0.25rem 0;
}

.friends-help {
  font-size: 0.875rem;
  opacity: 0.75;
  margin: 0;
}

.friends-add {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.friends-add input {
  flex: 1;
  min-width: 12rem;
}

.friends-add-button {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.friends-error {
  font-size: 0.875rem;
  color: #b3261e;
  margin: 0;
}

.friends-status {
  font-size: 0.875rem;
  opacity: 0.75;
  margin: 0;
}

.friends-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.friends-panel h3 {
  font-size: 1rem;
  margin: 0;
}

.friends-empty {
  font-size: 0.875rem;
  opacity: 0.75;
  margin: 0;
}

.friends-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.friends-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.5rem;
  font-size: 0.875rem;
  align-items: center;
}

.friends-handle {
  font-weight: 500;
}

.friends-name {
  color: rgba(0, 0, 0, 0.65);
}

.friends-actions {
  display: inline-flex;
  gap: 0.375rem;
}

.friends-pending {
  font-size: 0.8rem;
  opacity: 0.7;
  font-style: italic;
}

/* why: the three-column row overflows on narrow screens; stack it so
   handle / name / actions stay usable on mobile. */
@media (max-width: 40rem) {
  .friends-row {
    grid-template-columns: 1fr;
  }
}
</style>
