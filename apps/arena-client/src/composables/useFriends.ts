/**
 * useFriends — Friends section state (Arena Client, WP-352)
 *
 * Owns the reactive state for the owner-profile Friends section: the
 * accepted-friends list, the incoming and outgoing pending-request
 * lists, a loading flag, and the last error code. Exposes `load()` plus
 * the four mutating actions (`add` / `accept` / `decline` / `remove`),
 * each of which calls the matching `friendsApi` wrapper and then
 * re-fetches so the lists always reflect server-authoritative state.
 *
 * Pure of the DOM and free of lifecycle hooks — the component calls
 * `load()` from its own `onMounted`, so this composable is directly
 * unit-testable by stubbing `globalThis.fetch`.
 *
 * Layer-boundary: imports only `vue` + the same-layer `friendsApi`. No
 * game-engine, registry, server, or boardgame-framework import.
 *
 * Authority: WP-352 §Scope (In) §B; EC-382 §Locked Values; D-24144.
 */

import { ref, type Ref } from 'vue';

import {
  fetchFriends,
  fetchFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  type FriendApiErrorCode,
  type FriendSummary,
} from '../lib/api/friendsApi';

/**
 * The reactive surface returned by `useFriends`. The three lists are the
 * server-authoritative view; `errorCode` carries the last failure's code
 * (or `null` for a network failure / unrecognized code); `isLoading` is
 * true while `load()` is in flight.
 */
export interface UseFriends {
  readonly friends: Ref<FriendSummary[]>;
  readonly incoming: Ref<FriendSummary[]>;
  readonly outgoing: Ref<FriendSummary[]>;
  readonly isLoading: Ref<boolean>;
  readonly errorCode: Ref<FriendApiErrorCode | null>;
  readonly load: () => Promise<void>;
  readonly add: (handle: string) => Promise<boolean>;
  readonly accept: (handle: string) => Promise<boolean>;
  readonly decline: (handle: string) => Promise<boolean>;
  readonly remove: (handle: string) => Promise<boolean>;
}

/**
 * Build the Friends-section state bound to a single `authToken` getter.
 * The token is read fresh on every call so a re-auth mid-session is
 * always reflected.
 */
export function useFriends(readAuthToken: () => string | null): UseFriends {
  const friends = ref<FriendSummary[]>([]);
  const incoming = ref<FriendSummary[]>([]);
  const outgoing = ref<FriendSummary[]>([]);
  const isLoading = ref<boolean>(false);
  const errorCode = ref<FriendApiErrorCode | null>(null);

  /**
   * Fetch the friends list and the pending-request lists, replacing all
   * three refs. A failure on either read sets `errorCode` and leaves the
   * previously-loaded lists intact (a transient error never blanks the
   * section).
   */
  async function load(): Promise<void> {
    isLoading.value = true;
    errorCode.value = null;
    const token = readAuthToken();
    const friendsResult = await fetchFriends(token);
    const requestsResult = await fetchFriendRequests(token);
    isLoading.value = false;
    if (friendsResult.ok === false) {
      errorCode.value = friendsResult.code;
      return;
    }
    if (requestsResult.ok === false) {
      errorCode.value = requestsResult.code;
      return;
    }
    friends.value = friendsResult.value;
    incoming.value = requestsResult.value.incoming;
    outgoing.value = requestsResult.value.outgoing;
  }

  // why: every action is mutate-then-refetch (authoritative, not
  // optimistic) — after a successful wrapper call we reload the lists so
  // they reflect exactly what the server stored, rather than guessing the
  // post-mutation shape on the client. A failed action sets `errorCode`
  // and returns false WITHOUT reloading, so the visible lists are never
  // corrupted by a rejected mutation.

  /**
   * Send a friend request by `@handle`, then reload on success.
   * Returns true on success, false on failure (with `errorCode` set).
   */
  async function add(handle: string): Promise<boolean> {
    errorCode.value = null;
    const result = await sendFriendRequest(readAuthToken(), handle);
    if (result.ok === false) {
      errorCode.value = result.code;
      return false;
    }
    await load();
    return true;
  }

  /**
   * Accept a pending incoming request from a `@handle`, then reload.
   */
  async function accept(handle: string): Promise<boolean> {
    errorCode.value = null;
    const result = await acceptFriendRequest(readAuthToken(), handle);
    if (result.ok === false) {
      errorCode.value = result.code;
      return false;
    }
    await load();
    return true;
  }

  /**
   * Decline a pending incoming request from a `@handle`, then reload.
   */
  async function decline(handle: string): Promise<boolean> {
    errorCode.value = null;
    const result = await declineFriendRequest(readAuthToken(), handle);
    if (result.ok === false) {
      errorCode.value = result.code;
      return false;
    }
    await load();
    return true;
  }

  /**
   * Remove an accepted friendship by `@handle`, then reload.
   */
  async function remove(handle: string): Promise<boolean> {
    errorCode.value = null;
    const result = await removeFriend(readAuthToken(), handle);
    if (result.ok === false) {
      errorCode.value = result.code;
      return false;
    }
    await load();
    return true;
  }

  return {
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
  };
}
