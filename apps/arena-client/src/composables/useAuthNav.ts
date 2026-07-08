/**
 * Auth-aware navigation composable (WP-175).
 *
 * Encapsulates the reactive state for the BrandHeader's auth-aware nav
 * section: sign-in/sign-out state, bootstrapping detection, display
 * label, and the sign-out action.
 *
 * Amendment 2 (WP-330): the display label now shows the signed-in
 * player's own name. On the signed-in transition the composable fetches
 * the owner profile once via `fetchOwnerProfile` (the `displayName` /
 * `handleCanonical` fields were added to `GET /api/me/profile` by
 * WP-305 / D-24089) and resolves the label through `resolveDisplayLabel`:
 * `displayName` → `@handleCanonical` → "My account". The fetch is
 * non-blocking (the label renders "My account" until it resolves) and
 * silent-failing (any non-ok result leaves the fallback in place). The
 * email local-part rung named in the original Amendment 1 is
 * intentionally dropped — the owner profile omits `email` (D-24089) and
 * `display_name` is NOT NULL, so `displayName` always wins. Contract
 * locked by D-24116.
 */

import { computed, inject, ref, watch, type ComputedRef, type Ref } from 'vue';

import {
  initializeHankoClient,
  signOutCurrentSession,
  type HankoClientHandle,
} from '../auth/hankoClient';
import {
  fetchOwnerProfile,
  type OwnerProfileView,
} from '../lib/api/ownerProfileApi';
import { useAuthStore } from '../stores/auth';

/** Reactive return shape of the auth-nav composable. */
export interface AuthNavState {
  readonly isSignedIn: ComputedRef<boolean>;
  readonly isBootstrapping: Ref<boolean>;
  readonly displayLabel: Ref<string>;
  readonly signOut: () => Promise<void>;
}

/**
 * Resolve the header label from an owner profile via the locked fallback
 * chain (D-24116): the trimmed `displayName` when non-empty, else
 * `@handleCanonical` when a handle has been claimed, else "My account".
 *
 * @param view The owner profile returned by `GET /api/me/profile`.
 * @returns The label to show in the signed-in header.
 */
export function resolveDisplayLabel(view: OwnerProfileView): string {
  const trimmedDisplayName = view.displayName.trim();
  if (trimmedDisplayName.length > 0) {
    return trimmedDisplayName;
  }
  // why: no email rung — the owner profile deliberately omits `email`
  // (D-24089) and `display_name` is NOT NULL, so the handle and the
  // "My account" fallback below are purely defensive for a would-be
  // empty display name.
  if (view.handleCanonical !== null) {
    const trimmedHandle = view.handleCanonical.trim();
    if (trimmedHandle.length > 0) {
      return `@${trimmedHandle}`;
    }
  }
  return 'My account';
}

// why: module-scoped lazy initializer mirrors MyProfilePage.vue's
// ensureHankoHandle pattern. The Hanko SDK initialization is expensive
// and idempotent; memoizing avoids racing with App.vue's bootstrap.
let cachedHankoHandle: Promise<HankoClientHandle> | null = null;

/**
 * Lazily initialize the broker SDK, memoizing the resulting handle.
 *
 * @returns Promise resolving to the broker SDK handle.
 */
function ensureHankoHandle(): Promise<HankoClientHandle> {
  if (cachedHankoHandle === null) {
    const tenantBaseUrl =
      (import.meta.env?.VITE_HANKO_TENANT_BASE_URL ?? '') as string;
    cachedHankoHandle = initializeHankoClient({ tenantBaseUrl });
  }
  return cachedHankoHandle;
}

/**
 * Composable providing auth-aware navigation state for the BrandHeader.
 *
 * @returns Reactive auth-nav state: sign-in status, bootstrapping flag,
 *          display label, and sign-out action.
 */
export function useAuthNav(): AuthNavState {
  const authStore = useAuthStore();

  const isSignedIn: ComputedRef<boolean> = computed(
    () => authStore.isAuthenticated,
  );

  // why: isAuthBootstrapping is provided via Vue provide/inject (D-17501),
  // NOT stored in the Pinia auth store. The ref(true) default is fail-safe:
  // if the provide is missing, the nav renders the bootstrapping placeholder
  // rather than flashing the signed-out state.
  const isBootstrapping = inject('isAuthBootstrapping', ref(true));

  // why: starts at the fallback and is updated only when the owner-profile
  // fetch resolves ok — the header never blocks on the network (WP-330).
  const displayLabel: Ref<string> = ref('My account');

  // why: a per-composable single-in-flight + loaded guard. useAuthNav is
  // called once per Header mount; these locals fetch the owner profile at
  // most once per signed-in session and allow a re-fetch after a
  // sign-out → sign-in cycle (the loaded flag is cleared on sign-out below).
  let isProfileRequestInFlight = false;
  let hasLoadedForCurrentSession = false;

  /**
   * Fetch the owner profile once and set `displayLabel` from it. Silent on
   * failure: `fetchOwnerProfile` never throws, and any non-ok result leaves
   * the "My account" fallback in place (no console error, no error surface).
   */
  async function loadDisplayLabelFromProfile(): Promise<void> {
    if (isProfileRequestInFlight || hasLoadedForCurrentSession) {
      return;
    }
    isProfileRequestInFlight = true;
    try {
      const result = await fetchOwnerProfile(authStore.token);
      if (result.ok) {
        displayLabel.value = resolveDisplayLabel(result.value);
        hasLoadedForCurrentSession = true;
      }
    } finally {
      isProfileRequestInFlight = false;
    }
  }

  // why: fetch the label on the signed-in-and-bootstrapped transition, and
  // reset to the fallback on sign-out so a later, different sign-in cannot
  // show a stale name. immediate:true covers a page reload that mounts
  // already-signed-in from a cached broker session. The fetch is fire-and-
  // forget (void) — the header renders "My account" until it resolves.
  watch(
    () => isSignedIn.value && !isBootstrapping.value,
    (isReadyAndSignedIn) => {
      if (isReadyAndSignedIn) {
        void loadDisplayLabelFromProfile();
      } else if (!isSignedIn.value) {
        displayLabel.value = 'My account';
        hasLoadedForCurrentSession = false;
      }
    },
    { immediate: true },
  );

  /**
   * Sign out the current user. Mirrors the MyProfilePage.vue sign-out
   * flow byte-for-byte: broker logout (try) → store clear (always) →
   * navigate to lobby (always).
   */
  async function signOut(): Promise<void> {
    try {
      const handle = await ensureHankoHandle();
      await signOutCurrentSession(handle);
    } catch {
      // why: if the broker logout call fails (network down, broker
      // unreachable, SDK initialization failure), clear the local
      // store and navigate to lobby anyway. A stuck sign-in state is
      // worse than a stale-cookie state: the cookie may persist on
      // the client, but the next page load will re-detect it via
      // App.vue's guarded-route bootstrap and re-route through
      // sign-in if the session has actually been invalidated
      // server-side. This is the fail-safe path (D-16004).
    }
    useAuthStore().clearSession();
    if (typeof window !== 'undefined') {
      window.location.assign('?route=');
    }
  }

  return {
    isSignedIn,
    isBootstrapping,
    displayLabel,
    signOut,
  };
}
