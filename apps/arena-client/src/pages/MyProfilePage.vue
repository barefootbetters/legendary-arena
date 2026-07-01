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
import BillingSection from '../components/BillingSection.vue';
import {
  initializeHankoClient,
  signOutCurrentSession,
  type HankoClientHandle,
} from '../auth/hankoClient';
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

// why: WP-160 — module-scoped lazy initializer for the broker SDK
// handle used by this page's sign-out flow. The Hanko SDK initialization
// is expensive and idempotent; memoizing per page-instance keeps the
// handle stable across multiple sign-out clicks (none expected in
// practice, but defensive) and avoids racing with App.vue's bootstrap
// which may have already initialized a separate handle. This is the
// only acceptable in-app memoization in this WP — the wrapper itself
// is stateless beyond the handle it returns.
let cachedHankoHandle: Promise<HankoClientHandle> | null = null;
function ensureHankoHandle(): Promise<HankoClientHandle> {
  if (cachedHankoHandle === null) {
    const tenantBaseUrl =
      (import.meta.env?.VITE_HANKO_TENANT_BASE_URL ?? '') as string;
    cachedHankoHandle = initializeHankoClient({ tenantBaseUrl });
  }
  return cachedHankoHandle;
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

export default defineComponent({
  name: 'MyProfilePage',
  components: { BillingSection },
  setup() {
    const state = ref<LoadState>('loading');
    // why: cast to the locally-extended view type so the template can
    // reach `view.teamAffiliations` without modifying the locked
    // ownerProfileApi.ts contract. The server's wire shape carries
    // the additional field per WP-109 / D-10904; the client's
    // structural-typing upgrade is local to this page.
    const view = ref<OwnerProfileViewWithTeams | null>(null);
    const errorBanner = ref<string>('');

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
    const draftLinks = ref<DraftLink[]>([]);

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

    function applyView(loaded: OwnerProfileView): void {
      view.value = loaded as OwnerProfileViewWithTeams;
      formAvatarUrl.value = loaded.avatarUrl ?? '';
      formAboutMe.value = loaded.aboutMe ?? '';
      formAvatarVisibility.value = loaded.avatarVisibility;
      formAboutMeVisibility.value = loaded.aboutMeVisibility;
      formLinksVisibility.value = loaded.linksVisibility;
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
      const result = await updateOwnerProfile(readAuthToken(), {
        avatarUrl: formAvatarUrl.value === '' ? null : formAvatarUrl.value,
        aboutMe: formAboutMe.value === '' ? null : formAboutMe.value,
        avatarVisibility: formAvatarVisibility.value,
        aboutMeVisibility: formAboutMeVisibility.value,
        linksVisibility: formLinksVisibility.value,
      });
      if (result.ok === true) {
        applyView(result.value);
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

    onMounted(() => {
      void load();
    });

    return {
      state,
      view,
      errorBanner,
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
      draftLinks,
      providerOptions: ALLOWED_PROVIDERS,
      saveProfile,
      saveLinks,
      addDraftLink,
      removeDraftLink,
      formatTeamSizeLabel,
      formatRoleLabel,
      formatJoinedDate,
      readAuthToken,
      signOut,
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
        <div class="profile-header-row">
          <h1>Your profile</h1>
          <button
            type="button"
            class="profile-sign-out"
            data-testid="my-profile-sign-out"
            @click="signOut"
          >
            Sign out
          </button>
        </div>
        <p class="profile-help">
          Edit your owner-only profile details below. Privacy toggles default to
          <em>private</em>; flip to <em>public</em> only when you want a section
          visible on your public profile page.
        </p>
      </header>

      <section class="profile-form" data-testid="my-profile-form">
        <h2>Profile</h2>

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

.profile-header h1 {
  font-size: 1.5rem;
  margin: 0 0 0.25rem 0;
}

.profile-header-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

.profile-sign-out {
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.profile-help {
  font-size: 0.875rem;
  opacity: 0.75;
  margin: 0.25rem 0 0 0;
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
.profile-billing {
  padding: 1.25rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.5);
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
