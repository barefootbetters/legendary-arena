/**
 * useMatchInvites — Arena Client (WP-360)
 *
 * Reactive state for the invitee-side match-invite surface: the pending
 * incoming invites, a loading flag, and the last failure code. `load()`
 * fetches; `accept` / `decline` call the wrapper and refetch (authoritative,
 * not optimistic) so the list reflects server state after any action.
 *
 * Authority: WP-360 §Scope; D-24152; mirrors the WP-352 `useFriends` shape.
 */

import { ref, type Ref } from 'vue';

import {
  fetchMatchInvites,
  acceptMatchInvite,
  declineMatchInvite,
  type MatchInviteView,
  type MatchInviteApiErrorCode,
} from '../lib/api/matchInvitesApi';

export interface UseMatchInvites {
  readonly invites: Ref<MatchInviteView[]>;
  readonly isLoading: Ref<boolean>;
  readonly errorCode: Ref<MatchInviteApiErrorCode | null>;
  load(): Promise<void>;
  accept(matchId: string): Promise<boolean>;
  decline(matchId: string): Promise<boolean>;
}

/**
 * @param readAuthToken A getter for the current bearer token (or `null`).
 */
export function useMatchInvites(
  readAuthToken: () => string | null,
): UseMatchInvites {
  const invites = ref<MatchInviteView[]>([]);
  const isLoading = ref<boolean>(false);
  const errorCode = ref<MatchInviteApiErrorCode | null>(null);

  /**
   * Fetch the caller's pending invites. A failure sets `errorCode` and leaves
   * the current list unchanged.
   */
  async function load(): Promise<void> {
    isLoading.value = true;
    errorCode.value = null;
    const result = await fetchMatchInvites(readAuthToken());
    isLoading.value = false;
    if (result.ok === true) {
      invites.value = result.value;
    } else {
      errorCode.value = result.code;
    }
  }

  /**
   * Accept the invite to `matchId`; refetch on success. Returns true on
   * success, false on failure (with `errorCode` set). The caller then joins
   * the match from the lobby.
   */
  async function accept(matchId: string): Promise<boolean> {
    errorCode.value = null;
    const result = await acceptMatchInvite(readAuthToken(), matchId);
    if (result.ok === false) {
      errorCode.value = result.code;
      return false;
    }
    await load();
    return true;
  }

  /**
   * Decline the invite to `matchId`; refetch on success.
   */
  async function decline(matchId: string): Promise<boolean> {
    errorCode.value = null;
    const result = await declineMatchInvite(readAuthToken(), matchId);
    if (result.ok === false) {
      errorCode.value = result.code;
      return false;
    }
    await load();
    return true;
  }

  return { invites, isLoading, errorCode, load, accept, decline };
}
