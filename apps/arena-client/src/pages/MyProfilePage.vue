<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue';

import {
  fetchOwnerProfile,
  replaceOwnerLinks,
  updateOwnerProfile,
  uploadOwnerAvatar,
  type AvatarUploadErrorCode,
  type OwnerProfileLink,
  type OwnerProfileView,
} from '../lib/api/ownerProfileApi';
import {
  createLoadout,
  deleteLoadout,
  listLoadouts,
  updateLoadout,
  type SavedLoadoutView,
} from '../lib/api/loadoutLibraryApi';
import {
  fetchMyScores,
  type MyCompetitiveScore,
} from '../lib/api/competitionApi';
import { summarizeLoadout } from '../lib/loadoutSummary';
import BillingSection from '../components/BillingSection.vue';
import FriendsSection from '../components/FriendsSection.vue';
import MatchInvitesSection from '../components/MatchInvitesSection.vue';
import { useAuthStore } from '../stores/auth';

// why: defineComponent({ setup() { return {...} } }) is required (NOT
// <script setup>) because the template references non-prop bindings
// — the `state`, `view`, `errorBanner`, etc. values — that under the
// @legendary-arena/vue-sfc-loader separate-compile pipeline only reach
// `_ctx` when explicitly returned from setup() (D-6512 / P6-30;
// precedent matches App.vue, ArenaHud, ReplayFileLoader, and
// PlayerProfilePage).

type LoadState = 'loading' | 'ready' | 'error';

// why: WP-109 / D-10904 (PS-3 = YES) — local TeamAffiliation
// declaration mirroring the server's wire shape. ownerProfileApi.ts
// is locked under WP-104 contract (byte-identical post-WP-109 per
// Hard Stop list); the server JSON body carries the additional
// `teamAffiliations` field on OwnerProfileView regardless. The
// local interface mirrors the server's shape per the engine/server
// isolation rule (WP-104 §Scope (In) §G); a future WP can lift the
// declaration into ownerProfileApi.ts.
interface TeamAffiliationDisplay {
  readonly teamId: string;
  readonly teamSize: 3 | 4 | 5;
  readonly role: 'member' | 'substitute';
  readonly joinedAt: string;
  readonly leftAt: string | null;
}

interface OwnerProfileViewWithTeams extends OwnerProfileView {
  readonly teamAffiliations: readonly TeamAffiliationDisplay[];
}

const ALLOWED_PROVIDERS: readonly OwnerProfileLink['provider'][] = [
  'twitter',
  'github',
  'twitch',
  'discord',
  'youtube',
  'website',
] as const;

interface DraftLink {
  provider: OwnerProfileLink['provider'];
  url: string;
  isPublic: boolean;
}

// why: per WP-109 §6, Legendary supports three meaningful cooperative
// formats; the human-facing label uses the "N-handed cohort" framing
// rather than "N-player team" to avoid the competitive overtone of
// "team" in casual reading. User-facing copy stays neutral per
// EC-115 Guardrail 8; the forbidden-vocabulary list is enumerated
// in the EC + project memory, not repeated here.
function formatTeamSizeLabel(size: 3 | 4 | 5): string {
  return `${size}-handed cohort`;
}

function formatRoleLabel(role: 'member' | 'substitute'): string {
  return role === 'member' ? 'member' : 'substitute';
}

function formatJoinedDate(raw: string): string {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function bannerCopyForCode(code: string | null): string {
  // why: locked verbatim banner copy per WP-104 §Scope (In) §H.
  if (code === 'session_verifier_not_configured') {
    return 'Authentication is not yet configured on this server. Owner profile editing is temporarily unavailable.';
  }
  if (code === 'lookup_failed') {
    return 'Server error — owner profile editing is temporarily unavailable. Try again in a moment.';
  }
  if (code === 'missing_token' || code === 'invalid_token' || code === 'expired_token') {
    return 'You are not signed in. Sign in to edit your profile.';
  }
  if (code === 'unknown_account') {
    return 'Your account could not be located. Sign out and back in to refresh your session.';
  }
  return 'Could not load profile. Please try again later.';
}

/**
 * Map an avatar-upload failure code to a full-sentence message shown beneath
 * the upload control. A `null` code (network failure or an unrecognized
 * status) falls through to the generic line.
 */
function avatarUploadMessageForCode(code: AvatarUploadErrorCode | null): string {
  if (code === 'invalid_mime_type') {
    // why: the server's ALLOWED_MIME_TYPES (avatarUpload.logic.ts) accepts only
    // JPEG, PNG, and WebP — GIF is NOT accepted; the copy must match the
    // server contract so we don't promise a format the upload will reject.
    return 'That file is not a supported image; choose a PNG, JPEG, or WebP picture.';
  }
  if (code === 'file_too_large') {
    return 'That image is larger than the 5 MB limit; choose a smaller file.';
  }
  if (code === 'rate_limited') {
    return 'You have uploaded too many avatars recently; wait a moment and try again.';
  }
  if (code === 'upload_failed') {
    return 'The server could not process that image; try again in a moment.';
  }
  if (code === 'unauthorized') {
    return 'You are not signed in. Sign in to upload an avatar.';
  }
  return 'The avatar upload failed. Check your connection and try again.';
}

/**
 * One row in the Saved Loadouts list: the server's view plus a local
 * editable name draft for the inline rename control. The draft is
 * seeded from `view.name` on load and after every mutation.
 */
interface LoadoutRow {
  view: SavedLoadoutView;
  nameDraft: string;
}

/**
 * Map a loadout-library failure code (surfaced verbatim from the
 * server's `{ error: code }` body, or `null` for a network/parse
 * failure) to a full-sentence message shown inline on the Saved
 * Loadouts section. Mirrors the `bannerCopyForCode` precedent.
 */
function loadoutMessageForCode(code: string | null): string {
  if (code === 'invalid_lagn') {
    return 'That is not a valid LAGN loadout; re-export it from the loadout builder and paste it again.';
  }
  if (code === 'invalid_name') {
    return 'That name is not allowed; choose a shorter, non-empty name.';
  }
  if (code === 'loadout_limit_reached') {
    return 'You have reached the 50 saved-loadout limit; delete one to save another.';
  }
  if (code === 'not_found') {
    return 'That loadout no longer exists; it may have been deleted already.';
  }
  if (code === 'unauthorized') {
    return 'You are not signed in. Sign in to manage your saved loadouts.';
  }
  return 'Could not reach the server. Check your connection and try again.';
}

/**
 * Build the public share link for a loadout's opaque `shareSlug`, the
 * URL the shared-loadout page (`?loadout=<shareSlug>`) resolves. Reads
 * `window.location.origin` defensively (empty under a non-browser test
 * runner).
 */
function shareLinkForSlug(shareSlug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?loadout=${shareSlug}`;
}

export default defineComponent({
  name: 'MyProfilePage',
  components: { BillingSection, FriendsSection, MatchInvitesSection },
  setup() {
    const state = ref<LoadState>('loading');
    // why: cast to the locally-extended view type so the template can
    // reach `view.teamAffiliations` without modifying the locked
    // ownerProfileApi.ts contract. The server's wire shape carries
    // the additional field per WP-109 / D-10904; the client's
    // structural-typing upgrade is local to this page.
    const view = ref<OwnerProfileViewWithTeams | null>(null);
    const errorBanner = ref<string>('');

    // why: WP-305 / D-24090 — the editable display name. `formDisplayName`
    // is seeded from `view.displayName` on load and saved through the
    // existing updateOwnerProfile PATCH (no new API call). `nameError`
    // carries the inline `invalid_display_name` message beneath the field,
    // kept separate from the shared `errorBanner` so a name-validation
    // failure shows next to the input, not as a page-level banner. Both
    // are returned from setup() so the template can bind them (D-6512).
    const formDisplayName = ref<string>('');
    const nameError = ref<string>('');
    const formAvatarUrl = ref<string>('');
    // why: WP-298 — the avatar file-upload control owns its own feedback
    // state, separate from the shared `errorBanner` (which is for profile
    // load/save). `avatarFile` holds the first selected File; the in-flight
    // flag guards against a double-POST; the success/error lines reset each
    // other so a stale banner never lingers under a new outcome.
    const avatarFile = ref<File | null>(null);
    const avatarUploadInFlight = ref<boolean>(false);
    const avatarUploadSuccess = ref<string>('');
    const avatarUploadError = ref<string>('');
    // why: a bad or unreachable avatar URL should not render the browser's
    // broken-image glyph on a polished page. The <img> preview hides itself
    // on the `error` event; the watcher below re-arms it whenever the URL
    // changes, so a previously-failed URL does not permanently suppress the
    // preview and the user's typed value is never cleared by the preview.
    const avatarPreviewFailed = ref<boolean>(false);
    const formAboutMe = ref<string>('');
    const formAvatarVisibility = ref<'private' | 'public'>('private');
    const formAboutMeVisibility = ref<'private' | 'public'>('private');
    const formLinksVisibility = ref<'private' | 'public'>('private');
    // why: WP-359 / D-24151 — the friend-request email opt-out toggle.
    // Defaults to true (emails on) until the loaded profile seeds it.
    const formFriendRequestEmails = ref(true);
    const draftLinks = ref<DraftLink[]>([]);

    // why: WP-302 — the Saved Loadouts section owns its own state,
    // separate from the profile/links surfaces. `loadoutRows` is the
    // server list plus per-row rename drafts; `createName` /
    // `createLagnText` back the paste-create form; the three message
    // refs carry inline feedback (list-load error, create error, row
    // mutation error) and the best-effort copy line — each independent
    // so one surface's feedback never clobbers another's.
    const loadoutRows = ref<LoadoutRow[]>([]);
    const loadoutsError = ref<string>('');
    const createName = ref<string>('');
    const createLagnText = ref<string>('');
    const createError = ref<string>('');
    const createInFlight = ref<boolean>(false);
    const rowError = ref<string>('');
    const copyMessage = ref<string>('');

    // why: WP-339 — the owner's submitted competitive scores (the "My Scores"
    // read). Loaded on mount from GET /api/me/scores; independent loading/error
    // refs so this surface never clobbers the profile/loadout feedback.
    // (Restored under WP-341 — a #597 per-block merge conflict had kept this
    // section's template but reverted its script, breaking vue-tsc + the view.)
    const competitiveScores = ref<MyCompetitiveScore[]>([]);
    const scoresLoading = ref<boolean>(true);
    const scoresError = ref<string>('');

    // why: re-arm the avatar preview whenever the URL changes. Once `@error`
    // hides a broken URL, the <img> leaves the DOM, so `@load` can never fire
    // to clear the flag — without this reset a single bad URL would suppress
    // the preview for every later (valid) URL the user types.
    watch(formAvatarUrl, () => {
      avatarPreviewFailed.value = false;
    });

    // why: surface the remaining allowance for the 500-character About-me
    // field (the textarea's maxlength enforces the ceiling; this only tells
    // the user how much room is left). Math.max keeps the display at or above
    // zero — defensive only; the maxlength stays the authoritative cap.
    const aboutMeCharactersRemaining = computed(
      () => Math.max(0, 500 - formAboutMe.value.length),
    );

    function readAuthToken(): string | null {
      // why: WP-160 / D-16003 — the auth token is held in the Pinia
      // auth store, populated by the broker SDK wrapper at app
      // bootstrap (App.vue setup-time guarded-route check) or at
      // sign-in (LoginPage.vue's onSessionCreated handler). Reading
      // from the store keeps the token's source of truth in one
      // place; previously this function read from localStorage as a
      // placeholder pending WP-126's broker integration (now landed
      // via WP-160). The server-side fail-closed posture (D-11204)
      // still applies — a missing or stale token surfaces as a 500
      // with `code: 'session_verifier_not_configured'` (or a 401 with
      // a token-specific code), which the banner copy above
      // translates into user-friendly text.
      return useAuthStore().token;
    }

    function applyView(loaded: OwnerProfileView): void {
      view.value = loaded as OwnerProfileViewWithTeams;
      formDisplayName.value = loaded.displayName;
      nameError.value = '';
      formAvatarUrl.value = loaded.avatarUrl ?? '';
      formAboutMe.value = loaded.aboutMe ?? '';
      formAvatarVisibility.value = loaded.avatarVisibility;
      formAboutMeVisibility.value = loaded.aboutMeVisibility;
      formLinksVisibility.value = loaded.linksVisibility;
      formFriendRequestEmails.value = loaded.friendRequestEmails;
      draftLinks.value = loaded.links.map((link) => ({
        provider: link.provider,
        url: link.url,
        isPublic: link.isPublic,
      }));
      errorBanner.value = '';
      state.value = 'ready';
    }

    async function load(): Promise<void> {
      state.value = 'loading';
      errorBanner.value = '';
      const result = await fetchOwnerProfile(readAuthToken());
      if (result.ok === true) {
        applyView(result.value);
        return;
      }
      errorBanner.value = bannerCopyForCode(result.code);
      state.value = 'error';
    }

    async function saveProfile(): Promise<void> {
      nameError.value = '';
      const result = await updateOwnerProfile(readAuthToken(), {
        displayName: formDisplayName.value,
        avatarUrl: formAvatarUrl.value === '' ? null : formAvatarUrl.value,
        aboutMe: formAboutMe.value === '' ? null : formAboutMe.value,
        avatarVisibility: formAvatarVisibility.value,
        aboutMeVisibility: formAboutMeVisibility.value,
        linksVisibility: formLinksVisibility.value,
        friendRequestEmails: formFriendRequestEmails.value,
      });
      if (result.ok === true) {
        applyView(result.value);
        return;
      }
      // why: WP-305 — an invalid_display_name failure shows inline beneath
      // the name field (the field the player can fix), NOT as the shared
      // page-level banner; every other code stays on the banner.
      if (result.code === 'invalid_display_name') {
        nameError.value =
          'That name is not allowed. Use 1–64 characters with no control characters.';
        return;
      }
      errorBanner.value = bannerCopyForCode(result.code);
    }

    /**
     * Record the first File chosen in the avatar file input (or clear the
     * selection when the picker is dismissed with no file). Does not upload —
     * the player triggers that explicitly via the "Upload avatar" button.
     */
    function onAvatarFileSelected(event: Event): void {
      const target = event.target as HTMLInputElement;
      avatarFile.value = target.files?.item(0) ?? null;
    }

    /**
     * Upload the currently selected avatar file via `uploadOwnerAvatar`.
     * Returns early when no file is selected or an upload is already in
     * flight (no concurrent POSTs). On success sets `formAvatarUrl` to the
     * returned opaque URL and shows the success line (clearing any error);
     * on failure shows the mapped message (clearing any success). Never throws.
     */
    async function onUploadAvatar(): Promise<void> {
      const file = avatarFile.value;
      if (file === null) {
        return;
      }
      if (avatarUploadInFlight.value === true) {
        return;
      }
      avatarUploadInFlight.value = true;
      try {
        const result = await uploadOwnerAvatar(readAuthToken(), file);
        if (result.ok === true) {
          formAvatarUrl.value = result.avatarUrl;
          avatarUploadSuccess.value = 'Your new avatar has been uploaded.';
          avatarUploadError.value = '';
          return;
        }
        avatarUploadError.value = avatarUploadMessageForCode(result.code);
        avatarUploadSuccess.value = '';
      } finally {
        avatarUploadInFlight.value = false;
      }
    }

    async function saveLinks(): Promise<void> {
      const links: OwnerProfileLink[] = draftLinks.value.map(
        (draft, index) => ({
          provider: draft.provider,
          url: draft.url,
          isPublic: draft.isPublic,
          displayOrder: index,
        }),
      );
      const result = await replaceOwnerLinks(readAuthToken(), links);
      if (result.ok === true) {
        applyView(result.value);
        return;
      }
      errorBanner.value = bannerCopyForCode(result.code);
    }

    function addDraftLink(): void {
      draftLinks.value.push({
        provider: 'website',
        url: '',
        isPublic: false,
      });
    }

    function removeDraftLink(index: number): void {
      draftLinks.value.splice(index, 1);
    }

    /**
     * Fetch the caller's saved loadouts and rebuild the row list (each
     * with a fresh rename draft). On failure sets the inline list-load
     * error; never throws.
     */
    async function loadLoadouts(): Promise<void> {
      loadoutsError.value = '';
      const result = await listLoadouts(readAuthToken());
      if (result.ok === true) {
        loadoutRows.value = result.value.loadouts.map((view) => ({
          view,
          nameDraft: view.name,
        }));
        return;
      }
      loadoutsError.value = loadoutMessageForCode(result.code);
    }

    /**
     * Load the owner's submitted competitive scores (WP-339). Newest first,
     * from the server. On any non-200 (or network failure), surfaces a generic
     * error and leaves the list empty — never throws.
     */
    async function loadScores(): Promise<void> {
      scoresLoading.value = true;
      scoresError.value = '';
      const result = await fetchMyScores(readAuthToken());
      scoresLoading.value = false;
      if (result.status === 200 && result.scores !== null) {
        competitiveScores.value = result.scores;
        return;
      }
      // why: a personalized read failure is non-fatal to the rest of the page;
      // show a one-line notice and keep the section empty.
      scoresError.value =
        'We couldn’t load your competitive scores right now. Please try again later.';
    }

    /**
     * Replace one row in place with an updated server view, reseeding
     * its rename draft. Leaves every other row untouched.
     */
    function replaceLoadoutRow(view: SavedLoadoutView): void {
      loadoutRows.value = loadoutRows.value.map((row) =>
        row.view.id === view.id ? { view, nameDraft: view.name } : row,
      );
    }

    /**
     * Create a saved loadout from the paste form. Guards the textarea
     * with a local `JSON.parse` first — an unparseable paste surfaces an
     * inline error and sends no request — then POSTs `{ name, lagn }` and
     * refreshes the list on success. Never throws.
     */
    async function submitCreateLoadout(): Promise<void> {
      createError.value = '';
      copyMessage.value = '';
      let parsedLagn: unknown;
      try {
        parsedLagn = JSON.parse(createLagnText.value);
      } catch {
        // why: guard the paste locally before any request — an unparseable
        // textarea is a client-side error, so we surface it inline and send
        // nothing rather than round-tripping to the server for invalid_lagn.
        createError.value =
          'That is not valid JSON. Paste a LAGN loadout document exported from the loadout builder.';
        return;
      }
      if (createInFlight.value === true) {
        return;
      }
      createInFlight.value = true;
      try {
        const result = await createLoadout(readAuthToken(), {
          name: createName.value,
          lagn: parsedLagn,
        });
        if (result.ok === true) {
          createName.value = '';
          createLagnText.value = '';
          await loadLoadouts();
          return;
        }
        createError.value = loadoutMessageForCode(result.code);
      } finally {
        createInFlight.value = false;
      }
    }

    /**
     * Rename one loadout to its current draft value via PATCH, reflecting
     * the returned view on success. Sets the inline row error otherwise.
     */
    async function renameLoadout(row: LoadoutRow): Promise<void> {
      rowError.value = '';
      copyMessage.value = '';
      const result = await updateLoadout(readAuthToken(), row.view.id, {
        name: row.nameDraft,
      });
      if (result.ok === true) {
        replaceLoadoutRow(result.value);
        return;
      }
      rowError.value = loadoutMessageForCode(result.code);
    }

    /**
     * Flip one loadout between public and private via PATCH. Making it
     * public reveals a share slug; making it private clears it. Reflects
     * the returned view on success; sets the inline row error otherwise.
     */
    async function toggleLoadoutVisibility(row: LoadoutRow): Promise<void> {
      rowError.value = '';
      copyMessage.value = '';
      const nextVisibility =
        row.view.visibility === 'public' ? 'private' : 'public';
      const result = await updateLoadout(readAuthToken(), row.view.id, {
        visibility: nextVisibility,
      });
      if (result.ok === true) {
        replaceLoadoutRow(result.value);
        return;
      }
      rowError.value = loadoutMessageForCode(result.code);
    }

    /**
     * Delete one loadout via DELETE, removing its row on success. Sets
     * the inline row error otherwise.
     */
    async function removeLoadout(row: LoadoutRow): Promise<void> {
      rowError.value = '';
      copyMessage.value = '';
      const result = await deleteLoadout(readAuthToken(), row.view.id);
      if (result.ok === true) {
        loadoutRows.value = loadoutRows.value.filter(
          (candidate) => candidate.view.id !== row.view.id,
        );
        return;
      }
      rowError.value = loadoutMessageForCode(result.code);
    }

    /**
     * Copy a loadout's public share link to the clipboard (best-effort).
     * A rejected or unavailable clipboard leaves the visible link intact
     * so the player can copy it manually.
     */
    async function copyShareLink(shareSlug: string): Promise<void> {
      const link = shareLinkForSlug(shareSlug);
      try {
        // why: clipboard writes are best-effort — a rejected or unavailable
        // clipboard (denied permission, insecure context) must not break the
        // page, so the failure is caught and the link stays visible to copy
        // by hand.
        await navigator.clipboard.writeText(link);
        copyMessage.value = 'Share link copied to your clipboard.';
      } catch {
        copyMessage.value =
          'Could not copy automatically — select the link above and copy it manually.';
      }
    }

    onMounted(() => {
      void load();
      void loadLoadouts();
      void loadScores();
    });

    return {
      state,
      view,
      errorBanner,
      formDisplayName,
      nameError,
      formAvatarUrl,
      avatarFile,
      avatarUploadInFlight,
      avatarUploadSuccess,
      avatarUploadError,
      avatarPreviewFailed,
      onAvatarFileSelected,
      onUploadAvatar,
      formAboutMe,
      aboutMeCharactersRemaining,
      formAvatarVisibility,
      formAboutMeVisibility,
      formLinksVisibility,
      formFriendRequestEmails,
      draftLinks,
      providerOptions: ALLOWED_PROVIDERS,
      saveProfile,
      saveLinks,
      addDraftLink,
      removeDraftLink,
      competitiveScores,
      scoresLoading,
      scoresError,
      loadoutRows,
      loadoutsError,
      createName,
      createLagnText,
      createError,
      createInFlight,
      rowError,
      copyMessage,
      submitCreateLoadout,
      renameLoadout,
      toggleLoadoutVisibility,
      removeLoadout,
      copyShareLink,
      summarizeLoadout,
      shareLinkForSlug,
      formatTeamSizeLabel,
      formatRoleLabel,
      formatJoinedDate,
      readAuthToken,
    };
  },
});
</script>

<template>
  <article class="my-profile" data-testid="my-profile-root">
    <template v-if="state === 'loading'">
      <p class="profile-status" data-testid="my-profile-loading">Loading your profile…</p>
    </template>

    <template v-else>
      <p
        v-if="errorBanner !== ''"
        class="profile-banner"
        data-testid="my-profile-banner"
      >
        {{ errorBanner }}
      </p>

      <header class="profile-header" data-testid="my-profile-header">
        <!-- why: WP-305 / D-24089 — the owner's own identity. `@handle`
             renders from the immutable handleCanonical (display-only, absent
             until the handle is claimed); the account-ID line is always
             visible as a muted support line. Editing the name happens in the
             editable field below (bound to formDisplayName). -->
        <p
          v-if="view !== null && view.handleCanonical !== null"
          class="profile-handle"
          data-testid="my-profile-handle"
        >
          @{{ view.handleCanonical }}
        </p>
        <p
          v-if="view !== null"
          class="profile-account-id"
          data-testid="my-profile-account-id"
        >
          Account ID: {{ view.accountId }}
        </p>

        <p class="profile-help">
          Edit your owner-only profile details below. Privacy toggles default to
          <em>private</em>; flip to <em>public</em> only when you want a section
          visible on your public profile page.
        </p>
      </header>

      <section class="profile-form" data-testid="my-profile-form">
        <h2>Profile</h2>

        <!-- why: WP-305 / D-24090 — the editable display name. Saved via the
             existing "Save profile" button (updateOwnerProfile PATCH); an
             invalid_display_name failure shows inline beneath the field. -->
        <label class="profile-field">
          <span class="profile-field-label">Display name</span>
          <input
            v-model="formDisplayName"
            type="text"
            maxlength="64"
            placeholder="Your display name"
            data-testid="my-profile-display-name"
          />
          <span
            v-if="nameError !== ''"
            class="profile-upload-error"
            data-testid="my-profile-display-name-error"
          >
            {{ nameError }}
          </span>
        </label>

        <div
          v-if="formAvatarUrl !== '' && !avatarPreviewFailed"
          class="profile-avatar-preview"
        >
          <img
            :src="formAvatarUrl"
            alt="Current profile avatar preview"
            data-testid="my-profile-avatar-preview"
            @error="avatarPreviewFailed = true"
            @load="avatarPreviewFailed = false"
          />
        </div>

        <label class="profile-field">
          <span class="profile-field-label">Avatar URL (HTTPS)</span>
          <input
            v-model="formAvatarUrl"
            type="url"
            placeholder="https://example.com/avatar.png"
            data-testid="my-profile-avatar-url"
          />
        </label>

        <div class="profile-field profile-avatar-upload">
          <span class="profile-field-label">Upload a new avatar</span>
          <input
            type="file"
            accept="image/*"
            data-testid="my-profile-avatar-file"
            @change="onAvatarFileSelected"
          />
          <p class="profile-field-hint">
            PNG, JPEG, or WebP · up to 5 MB. A square image around 512×512
            pixels looks best.
          </p>
          <button
            type="button"
            class="profile-save"
            data-testid="my-profile-avatar-upload"
            :disabled="avatarFile === null || avatarUploadInFlight"
            @click="onUploadAvatar"
          >
            Upload avatar
          </button>
          <p
            v-if="avatarUploadSuccess !== ''"
            class="profile-upload-success"
            data-testid="my-profile-avatar-upload-success"
          >
            {{ avatarUploadSuccess }}
          </p>
          <p
            v-if="avatarUploadError !== ''"
            class="profile-upload-error"
            data-testid="my-profile-avatar-upload-error"
          >
            {{ avatarUploadError }}
          </p>
        </div>

        <label class="profile-field">
          <span class="profile-field-label">Avatar visibility</span>
          <select v-model="formAvatarVisibility" data-testid="my-profile-avatar-visibility">
            <option value="private">private</option>
            <option value="public">public</option>
          </select>
        </label>

        <label class="profile-field">
          <span class="profile-field-label">About me</span>
          <textarea
            v-model="formAboutMe"
            rows="4"
            maxlength="500"
            placeholder="A short bio (max 500 characters)"
            data-testid="my-profile-about-me"
          ></textarea>
          <span
            class="profile-field-hint profile-char-count"
            data-testid="my-profile-about-me-count"
            aria-live="polite"
          >
            {{ aboutMeCharactersRemaining }} characters remaining
          </span>
        </label>

        <label class="profile-field">
          <span class="profile-field-label">About-me visibility</span>
          <select v-model="formAboutMeVisibility" data-testid="my-profile-about-me-visibility">
            <option value="private">private</option>
            <option value="public">public</option>
          </select>
        </label>

        <label class="profile-field">
          <span class="profile-field-label">Links visibility</span>
          <select v-model="formLinksVisibility" data-testid="my-profile-links-visibility">
            <option value="private">private</option>
            <option value="public">public</option>
          </select>
        </label>

        <label class="profile-field">
          <span class="profile-field-label">Email me about friend requests</span>
          <input
            type="checkbox"
            v-model="formFriendRequestEmails"
            data-testid="my-profile-friend-request-emails"
          />
        </label>

        <button
          type="button"
          class="profile-save"
          data-testid="my-profile-save-profile"
          @click="saveProfile"
        >
          Save profile
        </button>
      </section>

      <section class="profile-links" data-testid="my-profile-links">
        <h2>Links</h2>
        <p class="profile-help">
          Up to 10 links. Drag to reorder is not yet supported — use the order
          shown to control display order.
        </p>

        <ul class="profile-links-list">
          <li
            v-for="(link, index) in draftLinks"
            :key="index"
            class="profile-link-row"
            :data-testid="`my-profile-link-row-${index}`"
          >
            <select
              v-model="link.provider"
              :data-testid="`my-profile-link-provider-${index}`"
            >
              <option v-for="provider in providerOptions" :key="provider" :value="provider">
                {{ provider }}
              </option>
            </select>
            <input
              v-model="link.url"
              type="url"
              placeholder="https://…"
              :data-testid="`my-profile-link-url-${index}`"
            />
            <label class="profile-link-public">
              <input
                v-model="link.isPublic"
                type="checkbox"
                :data-testid="`my-profile-link-public-${index}`"
              />
              Public
            </label>
            <button
              type="button"
              :data-testid="`my-profile-link-remove-${index}`"
              @click="removeDraftLink(index)"
            >
              Remove
            </button>
          </li>
        </ul>

        <button
          type="button"
          class="profile-add-link"
          data-testid="my-profile-add-link"
          @click="addDraftLink"
        >
          Add link
        </button>
        <button
          type="button"
          class="profile-save"
          data-testid="my-profile-save-links"
          @click="saveLinks"
        >
          Save links
        </button>
      </section>

      <!-- why: WP-109 / D-10904 (PS-3 = YES) — read-only "your teams"
           block. Owner viewer scope means 'private'-visibility teams
           are visible to the owner themselves (the composer is called
           server-side with viewerPlayerId === subjectPlayerId). No
           edit affordance, no captain-promote button, no team-creation
           CTA — those mutation flows go through /api/teams/* and never
           through MyProfilePage.vue or /api/me endpoints. A future WP
           may add captain-side affordances on a sibling page; this
           block is observational only. No competitive copy per EC-115
           Guardrail 8. -->
      <section
        v-if="view !== null"
        class="profile-teams"
        data-testid="my-profile-teams"
      >
        <h2>Your teams</h2>
        <template v-if="view.teamAffiliations.length === 0">
          <p class="profile-help">
            You're not currently affiliated with any teams. Teams are formed by
            invitation; ask a captain to invite you.
          </p>
        </template>
        <ul v-else class="profile-teams-list">
          <li
            v-for="affiliation in view.teamAffiliations"
            :key="affiliation.teamId"
            class="profile-team-row"
            :data-testid="`my-profile-team-row-${affiliation.teamId}`"
          >
            <span class="profile-team-size">{{ formatTeamSizeLabel(affiliation.teamSize) }}</span>
            <span class="profile-team-role">{{ formatRoleLabel(affiliation.role) }}</span>
            <span class="profile-team-joined">since {{ formatJoinedDate(affiliation.joinedAt) }}</span>
            <span
              v-if="affiliation.leftAt !== null"
              class="profile-team-left"
            >until {{ formatJoinedDate(affiliation.leftAt) }}</span>
          </li>
        </ul>
      </section>

      <!-- why: WP-302 — the Saved Loadouts library (Vision §19b). Saved
           loadouts are decorative, user-authored content (§19a) — never a
           competitive-submission path. The create path is paste-LAGN only;
           lobby "Save this loadout" / "Load into lobby" integration is a
           deferred follow-on (WP-303 / D-24087). -->
      <section class="profile-loadouts" data-testid="my-profile-loadouts">
        <h2>Saved Loadouts</h2>
        <p class="profile-help">
          Save a loadout by pasting a LAGN document exported from the loadout
          builder. Make one public to get a share link anyone can open.
        </p>

        <div class="profile-loadout-create" data-testid="my-profile-loadout-create">
          <label class="profile-field">
            <span class="profile-field-label">Loadout name</span>
            <input
              v-model="createName"
              type="text"
              placeholder="My Loki deck"
              data-testid="my-profile-loadout-name"
            />
          </label>
          <label class="profile-field">
            <span class="profile-field-label">LAGN document (JSON)</span>
            <textarea
              v-model="createLagnText"
              rows="5"
              placeholder='{ "lagn_version": 1, "setup": { … } }'
              data-testid="my-profile-loadout-lagn"
            ></textarea>
          </label>
          <button
            type="button"
            class="profile-save"
            data-testid="my-profile-loadout-save"
            :disabled="createInFlight"
            @click="submitCreateLoadout"
          >
            Save loadout
          </button>
          <p
            v-if="createError !== ''"
            class="profile-upload-error"
            data-testid="my-profile-loadout-create-error"
          >
            {{ createError }}
          </p>
        </div>

        <p
          v-if="loadoutsError !== ''"
          class="profile-upload-error"
          data-testid="my-profile-loadouts-error"
        >
          {{ loadoutsError }}
        </p>

        <template v-if="loadoutRows.length === 0">
          <p class="profile-help" data-testid="my-profile-loadouts-empty">
            You have no saved loadouts yet. Paste one above to get started.
          </p>
        </template>
        <ul v-else class="profile-loadouts-list">
          <li
            v-for="row in loadoutRows"
            :key="row.view.id"
            class="profile-loadout-row"
            :data-testid="`my-profile-loadout-row-${row.view.id}`"
          >
            <div class="profile-loadout-name-edit">
              <input
                v-model="row.nameDraft"
                type="text"
                :data-testid="`my-profile-loadout-name-${row.view.id}`"
              />
              <button
                type="button"
                :data-testid="`my-profile-loadout-rename-${row.view.id}`"
                @click="renameLoadout(row)"
              >
                Rename
              </button>
            </div>

            <p class="profile-loadout-summary">
              <span class="profile-loadout-summary-line">
                {{ summarizeLoadout(row.view.lagn).mastermind }} ·
                {{ summarizeLoadout(row.view.lagn).scheme }}
              </span>
              <span class="profile-loadout-summary-line">
                {{ summarizeLoadout(row.view.lagn).heroes.length }} heroes ·
                {{ summarizeLoadout(row.view.lagn).villainGroups.length }} villain groups
              </span>
            </p>

            <div class="profile-loadout-controls">
              <span
                class="profile-loadout-visibility"
                :data-testid="`my-profile-loadout-visibility-${row.view.id}`"
              >
                {{ row.view.visibility }}
              </span>
              <button
                type="button"
                :data-testid="`my-profile-loadout-toggle-${row.view.id}`"
                @click="toggleLoadoutVisibility(row)"
              >
                {{ row.view.visibility === 'public' ? 'Make private' : 'Make public' }}
              </button>
              <button
                type="button"
                :data-testid="`my-profile-loadout-delete-${row.view.id}`"
                @click="removeLoadout(row)"
              >
                Delete
              </button>
            </div>

            <div
              v-if="row.view.visibility === 'public' && row.view.shareSlug !== null"
              class="profile-loadout-share"
            >
              <a
                class="profile-loadout-share-link"
                :href="shareLinkForSlug(row.view.shareSlug)"
                :data-testid="`my-profile-loadout-share-link-${row.view.id}`"
              >
                {{ shareLinkForSlug(row.view.shareSlug) }}
              </a>
              <button
                type="button"
                :data-testid="`my-profile-loadout-copy-${row.view.id}`"
                @click="copyShareLink(row.view.shareSlug)"
              >
                Copy link
              </button>
            </div>
          </li>
        </ul>

        <p
          v-if="rowError !== ''"
          class="profile-upload-error"
          data-testid="my-profile-loadout-row-error"
        >
          {{ rowError }}
        </p>
        <p
          v-if="copyMessage !== ''"
          class="profile-upload-success"
          data-testid="my-profile-loadout-copy-message"
          aria-live="polite"
        >
          {{ copyMessage }}
        </p>
      </section>

      <section class="profile-scores" data-testid="my-profile-scores">
        <h2>Competitive Scores</h2>
        <p class="profile-scores__intro">
          Your submitted competitive scores. A finished match is submitted
          automatically when it ends; lower final scores are better.
        </p>
        <p v-if="scoresLoading" class="profile-scores__status">Loading your scores…</p>
        <p v-else-if="scoresError !== ''" class="profile-scores__status profile-scores__status--error">
          {{ scoresError }}
        </p>
        <p v-else-if="competitiveScores.length === 0" class="profile-scores__status">
          You haven’t submitted any competitive scores yet. Finish a match while
          signed in and it’ll appear here.
        </p>
        <ul v-else class="profile-scores__list">
          <li
            v-for="score in competitiveScores"
            :key="score.submissionId"
            class="profile-scores__row"
          >
            <span class="profile-scores__final">{{ score.finalScore }}</span>
            <span class="profile-scores__scenario">{{ score.scenarioKey }}</span>
            <span class="profile-scores__date">{{ score.createdAt }}</span>
          </li>
        </ul>
      </section>

      <!-- why: WP-352 / D-24144 — the owner's Friends section (packet #3
           of Friends & Ranked Trust). A thin client over WP-351's
           /api/me/friends* API, threaded the owner authToken the same way
           BillingSection is. Handle-only identity on screen (FR-2). -->
      <section class="profile-friends">
        <FriendsSection :auth-token="readAuthToken()" />

        <MatchInvitesSection :auth-token="readAuthToken()" />
      </section>

      <section class="profile-billing">
        <BillingSection :auth-token="readAuthToken()" />
      </section>
    </template>
  </article>
</template>

<style scoped>
.my-profile {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 48rem;
  margin: 0 auto;
}

.profile-status {
  font-size: 1rem;
  text-align: center;
  opacity: 0.75;
}

.profile-banner {
  padding: 0.75rem 1rem;
  background: #fff4e6;
  border: 1px solid #f4a261;
  border-radius: 0.25rem;
  font-size: 0.9rem;
}

.profile-help {
  font-size: 0.875rem;
  opacity: 0.75;
  margin: 0.25rem 0 0 0;
}

/* why: WP-305 — @handle sits just under the heading in a slightly
   emphasized tone; the account-ID line is a muted always-visible
   support line beneath it. */
.profile-handle {
  font-size: 1rem;
  font-weight: 500;
  margin: 0.1rem 0 0 0;
  opacity: 0.85;
}

.profile-account-id {
  font-size: 0.8rem;
  opacity: 0.6;
  margin: 0.1rem 0 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}

.profile-form,
.profile-links {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* why: subtle card treatment gives each major block visual separation
   and scannability without changing layout flow. */
.profile-form,
.profile-links,
.profile-teams,
.profile-loadouts,
.profile-friends,
.profile-billing {
  padding: 1.25rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.5);
}

.profile-loadouts {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.profile-loadouts h2 {
  font-size: 1.125rem;
  margin: 0 0 0.5rem 0;
}

.profile-loadout-create {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-loadouts-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.profile-loadout-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 0.375rem;
}

.profile-loadout-name-edit {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.profile-loadout-name-edit input {
  flex: 1;
}

.profile-loadout-summary {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.85rem;
  color: rgba(0, 0, 0, 0.7);
}

.profile-loadout-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.profile-loadout-visibility {
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  opacity: 0.7;
}

.profile-loadout-share {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.profile-loadout-share-link {
  font-size: 0.8rem;
  word-break: break-all;
}

.profile-avatar-preview img {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.15);
}

.profile-field-hint {
  font-size: 0.8rem;
  opacity: 0.7;
  margin: 0.15rem 0 0 0;
}

.profile-char-count {
  align-self: flex-end;
}

.profile-form h2,
.profile-links h2 {
  font-size: 1.125rem;
  margin: 0 0 0.5rem 0;
}

.profile-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.profile-field-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.profile-avatar-upload {
  gap: 0.5rem;
}

.profile-upload-success {
  font-size: 0.875rem;
  color: #2a7d2a;
  margin: 0.25rem 0 0 0;
}

.profile-upload-error {
  font-size: 0.875rem;
  color: #b3261e;
  margin: 0.25rem 0 0 0;
}

.profile-save,
.profile-add-link {
  align-self: flex-start;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.profile-links-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-link-row {
  display: grid;
  grid-template-columns: 7rem 1fr 5rem 5rem;
  gap: 0.5rem;
  align-items: center;
}

/* why: the four-column link row overflows on narrow screens; stack it to a
   single column so provider/url/public/remove stay usable on mobile. */
@media (max-width: 40rem) {
  .profile-link-row {
    grid-template-columns: 1fr;
  }
}

.profile-link-public {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.profile-teams-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-team-row {
  display: grid;
  grid-template-columns: 8rem 6rem 1fr 1fr;
  gap: 0.75rem;
  font-size: 0.875rem;
  align-items: baseline;
}

.profile-team-size {
  font-weight: 500;
}

.profile-team-role,
.profile-team-joined,
.profile-team-left {
  color: rgba(0, 0, 0, 0.65);
}
</style>
