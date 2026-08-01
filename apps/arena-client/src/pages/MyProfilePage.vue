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
import {
  deleteGauntletRun,
  importGauntletRun,
  listGauntletRuns,
  updateLegPicks,
  type GauntletRunLegProgress,
  type GauntletRunProgressView,
  type GauntletRunStatus,
} from '../lib/api/gauntletRunApi';
import { launchMatchFromComposition } from '../lobby/useCreateMatchFromComposition';
import type { MatchSetupConfig } from '@legendary-arena/game-engine';
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

/**
 * Map a gauntlet-run failure code (surfaced verbatim from the server's
 * `{ error: code }` body, or `null` for a network/parse failure) to a
 * full-sentence message shown inline on the Gauntlet Runs section. Mirrors the
 * `loadoutMessageForCode` precedent. The `invalid_pack` line is actionable — it
 * tells the player where to get a valid pack.
 */
function gauntletRunMessageForCode(code: string | null): string {
  if (code === 'invalid_pack') {
    return 'That is not a valid gauntlet pack; re-download it from the gauntlet page on the wiki and import it again.';
  }
  if (code === 'unknown_gauntlet') {
    return 'That gauntlet is not offered for this player count; it may have been retired. Download a current pack and try again.';
  }
  if (code === 'invalid_leg_picks') {
    return 'Those hero picks are not in a valid shape; enter set-qualified hero ids separated by commas and try again.';
  }
  if (code === 'not_found') {
    return 'That run no longer exists; it may have been deleted already.';
  }
  if (code === 'account_suspended') {
    return 'Your account is suspended, so gauntlet runs are unavailable right now.';
  }
  if (code === 'unauthorized') {
    return 'You are not signed in. Sign in to manage your gauntlet runs.';
  }
  return 'Could not reach the server. Check your connection and try again.';
}

/**
 * One row in the Gauntlet Runs status badge: the display label plus a tone
 * class. `champion` is green (celebratory / done); `all-legs-cleared` is amber
 * (a strategy state, NOT an error); the three in-progress states are neutral.
 * The two every-leg-cleared states occupy distinct badge treatments so a
 * champion is never masked by all-legs-cleared (AC-4).
 */
function statusBadge(status: GauntletRunStatus): {
  label: string;
  toneClass: string;
} {
  if (status === 'champion') {
    return { label: 'Champion', toneClass: 'gauntlet-badge--champion' };
  }
  if (status === 'all-legs-cleared') {
    return {
      label: 'All legs cleared',
      toneClass: 'gauntlet-badge--all-legs-cleared',
    };
  }
  if (status === 'playing') {
    return { label: 'Playing', toneClass: 'gauntlet-badge--playing' };
  }
  if (status === 'ready') {
    return { label: 'Ready', toneClass: 'gauntlet-badge--ready' };
  }
  return { label: 'Needs heroes', toneClass: 'gauntlet-badge--needs-heroes' };
}

/**
 * The sort rank for a run's status, matching WP-446's evaluation order
 * (`champion → all-legs-cleared → playing → ready → needs-heroes`). Active runs
 * are displayed in this order so a champion-or-cleared run sorts above an
 * in-progress one. Presentation-local only — never re-derives the status.
 */
function statusRank(status: GauntletRunStatus): number {
  if (status === 'champion') {
    return 0;
  }
  if (status === 'all-legs-cleared') {
    return 1;
  }
  if (status === 'playing') {
    return 2;
  }
  if (status === 'ready') {
    return 3;
  }
  return 4;
}

/**
 * The scheme id of a run's most-recently-played leg (the max non-null
 * `lastPlayedAt`), or `null` when no leg has ever been played. Presentation-local
 * only — used to highlight the "where you left off" leg; the derived per-leg
 * `lastPlayedAt` values come from the server (D-24262).
 */
function lastPlayedLegId(run: GauntletRunProgressView): string | null {
  let bestSchemeId: string | null = null;
  let bestPlayedAt: string | null = null;
  for (const leg of run.legs) {
    if (leg.lastPlayedAt === null) {
      continue;
    }
    if (
      bestPlayedAt === null ||
      Date.parse(leg.lastPlayedAt) > Date.parse(bestPlayedAt)
    ) {
      bestPlayedAt = leg.lastPlayedAt;
      bestSchemeId = leg.schemeId;
    }
  }
  return bestSchemeId;
}

/**
 * Whether "Play this leg" may launch: the leg has a full hero pick AND the
 * run's approved-menu launch composition resolved server-side. Both are
 * required — an incomplete pick or a `null` launch block cannot assemble a
 * valid nine-field `MatchSetupConfig`. Presentation-local only.
 */
function canPlayLeg(
  run: GauntletRunProgressView,
  leg: GauntletRunLegProgress,
): boolean {
  // why: BOTH conditions gate a launch — hasFullPicks proves the hero deck is
  // complete, and launch !== null proves the server resolved the adversary
  // composition + supply counts for this run's (division, playerCount). Missing
  // either means no valid MatchSetupConfig can be built, so the button stays
  // disabled with an explanatory line rather than launching an incomplete game.
  return leg.hasFullPicks && run.launch !== null;
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

    // why: WP-449 — the Gauntlet Runs section owns its own state, independent of
    // the profile / loadout / scores surfaces so one section's feedback never
    // clobbers another's. `gauntletRuns` is the server's DERIVED progression
    // list (rendered verbatim, D-24262 — never recomputed here). `pickDrafts`
    // holds the per-leg editable hero-id text, keyed `${runId}::${schemeId}` and
    // reseeded from the server view after every load / mutation. The message
    // refs carry the list-load error, the import error, the per-run row error,
    // and the launch error separately.
    const gauntletRuns = ref<GauntletRunProgressView[]>([]);
    const gauntletError = ref<string>('');
    const gauntletPasteText = ref<string>('');
    const gauntletImportError = ref<string>('');
    const gauntletImportInFlight = ref<boolean>(false);
    const gauntletRowError = ref<string>('');
    const gauntletPlayError = ref<string>('');
    const pickDrafts = ref<Record<string, string>>({});

    // why: the active runs (still in progress) are shown in WP-446 evaluation
    // order (champion → all-legs-cleared → playing → ready → needs-heroes) so a
    // champion-or-cleared run sorts above an in-progress one; the completed
    // history (a first_completed_at stamp) is listed separately. Both read the
    // same server view — the split is presentation-local, never a re-derivation.
    const activeGauntletRuns = computed(() => {
      const active = gauntletRuns.value.filter(
        (run) => run.firstCompletedAt === null,
      );
      return [...active].sort(
        (firstRun, secondRun) =>
          statusRank(firstRun.status) - statusRank(secondRun.status),
      );
    });
    const completedGauntletRuns = computed(() =>
      gauntletRuns.value.filter((run) => run.firstCompletedAt !== null),
    );

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
     * Reseed the per-leg hero-pick drafts from a freshly-loaded run list. Each
     * leg's draft is the run's stored `legPicks[schemeId]` joined by `, ` so the
     * editable input shows what the server holds. Replaces the whole draft map so
     * a deleted run leaves no stale draft behind.
     */
    function seedPickDrafts(runs: readonly GauntletRunProgressView[]): void {
      const drafts: Record<string, string> = {};
      for (const run of runs) {
        for (const leg of run.legs) {
          const picks = run.legPicks[leg.schemeId] ?? [];
          drafts[`${run.id}::${leg.schemeId}`] = picks.join(', ');
        }
      }
      pickDrafts.value = drafts;
    }

    /**
     * Fetch the caller's gauntlet runs (with derived progression + launch block)
     * and reseed the pick drafts. On failure sets the inline list-load error;
     * never throws.
     */
    async function loadGauntletRuns(): Promise<void> {
      gauntletError.value = '';
      const result = await listGauntletRuns(readAuthToken());
      if (result.ok === true) {
        gauntletRuns.value = result.value.runs;
        seedPickDrafts(result.value.runs);
        return;
      }
      gauntletError.value = gauntletRunMessageForCode(result.code);
    }

    /**
     * Import a gauntlet pack from a JSON string (shared by the paste box and the
     * file picker). Guards the text with a local `JSON.parse` first — an
     * unparseable value surfaces an inline error and sends no request — then
     * POSTs the opaque pack and refreshes the derived list on success (the POST
     * returns a raw view without the launch block, so the list refetch supplies
     * the derived progression the tracker renders). Never throws.
     */
    async function importGauntletPack(packText: string): Promise<void> {
      gauntletImportError.value = '';
      let parsedPack: unknown;
      try {
        parsedPack = JSON.parse(packText);
      } catch {
        // why: guard the pack locally before any request — an unparseable paste
        // or file is a client-side error, so we surface it inline and send
        // nothing rather than round-tripping to the server for invalid_pack.
        gauntletImportError.value =
          'That is not valid JSON. Paste or upload a gauntlet pack downloaded from the gauntlet page.';
        return;
      }
      if (gauntletImportInFlight.value === true) {
        return;
      }
      gauntletImportInFlight.value = true;
      try {
        const result = await importGauntletRun(readAuthToken(), parsedPack);
        if (result.ok === true) {
          gauntletPasteText.value = '';
          await loadGauntletRuns();
          return;
        }
        gauntletImportError.value = gauntletRunMessageForCode(result.code);
      } finally {
        gauntletImportInFlight.value = false;
      }
    }

    /**
     * Import the gauntlet pack pasted into the textarea. Delegates to the shared
     * `importGauntletPack`. Never throws.
     */
    async function submitImportPaste(): Promise<void> {
      await importGauntletPack(gauntletPasteText.value);
    }

    /**
     * Read the chosen pack file and import it. Returns early when the picker is
     * dismissed with no file. A file that cannot be read as text surfaces an
     * inline error; a readable file delegates to the shared `importGauntletPack`.
     * Never throws.
     */
    async function onGauntletFileSelected(event: Event): Promise<void> {
      const target = event.target as HTMLInputElement;
      const file = target.files?.item(0) ?? null;
      if (file === null) {
        return;
      }
      let packText: string;
      try {
        packText = await file.text();
      } catch {
        // why: a file that cannot be read (permission / transient IO) is a
        // client-side failure — surface it inline and send nothing.
        gauntletImportError.value =
          'That file could not be read. Choose a downloaded gauntlet pack JSON file and try again.';
        return;
      }
      await importGauntletPack(packText);
    }

    /**
     * Save one leg's edited hero picks via PATCH. Parses the leg's draft (a
     * comma-separated hero-id list) into an array, merges it over the run's
     * stored `legPicks` (PATCH replaces the whole map), and refreshes the list on
     * success. Sets the inline row error otherwise. Never throws.
     */
    async function saveLegPicks(
      run: GauntletRunProgressView,
      leg: GauntletRunLegProgress,
    ): Promise<void> {
      gauntletRowError.value = '';
      const draft = pickDrafts.value[`${run.id}::${leg.schemeId}`] ?? '';
      const heroDeckIds: string[] = [];
      for (const rawId of draft.split(',')) {
        const trimmed = rawId.trim();
        if (trimmed !== '') {
          heroDeckIds.push(trimmed);
        }
      }
      const nextLegPicks: Record<string, readonly string[]> = {
        ...run.legPicks,
        [leg.schemeId]: heroDeckIds,
      };
      const result = await updateLegPicks(readAuthToken(), run.id, nextLegPicks);
      if (result.ok === true) {
        await loadGauntletRuns();
        return;
      }
      gauntletRowError.value = gauntletRunMessageForCode(result.code);
    }

    /**
     * Launch a match for one leg via the WP-448 primitive. Enabled only when the
     * leg has full picks and the run's launch block is present; assembles the
     * nine-field `MatchSetupConfig` from the run's picks + the server-supplied
     * launch composition, then calls `launchMatchFromComposition`. On a failed
     * launch sets the inline play error. Never throws.
     */
    async function playLeg(
      run: GauntletRunProgressView,
      leg: GauntletRunLegProgress,
    ): Promise<void> {
      gauntletPlayError.value = '';
      if (!canPlayLeg(run, leg) || run.launch === null) {
        return;
      }
      const authToken = readAuthToken();
      if (authToken === null) {
        gauntletPlayError.value =
          'You are not signed in. Sign in to play a gauntlet leg.';
        return;
      }
      // why: WP-475 / D-24283 — assemble the LEG's own approved adversaries from
      // the per-leg `legLaunch` map (keyed by the leg's bare scheme slug), so a
      // swapped scheme launches its own villains/henchmen. Falls back to the
      // per-run block when the map is absent (a pre-WP-473 snapshot) or the leg
      // has no entry — the per-run mastermind default keeps the flat behaviour
      // correct rather than launching empty piles.
      const legLaunch = run.launch.legLaunch?.[leg.schemeId];
      const villainGroupIds =
        legLaunch?.villainGroupIds ?? run.launch.villainGroupIds;
      const henchmanGroupIds =
        legLaunch?.henchmanGroupIds ?? run.launch.henchmanGroupIds;
      const config: MatchSetupConfig = {
        // why: the progress leg carries the BARE scheme slug, but the match
        // config wants the set-qualified D-10014 ext_id, so qualify it with the
        // run's setAbbr (`${setAbbr}/${schemeId}`). mastermindId already arrives
        // set-qualified in the launch block.
        schemeId: `${run.setAbbr}/${leg.schemeId}`,
        mastermindId: run.launch.mastermindId,
        villainGroupIds,
        henchmanGroupIds,
        heroDeckIds: run.legPicks[leg.schemeId] ?? [],
        bystandersCount: run.launch.bystandersCount,
        woundsCount: run.launch.woundsCount,
        officersCount: run.launch.officersCount,
        sidekicksCount: run.launch.sidekicksCount,
      };
      const playerName =
        view.value?.displayName ?? view.value?.handleCanonical ?? '';
      const result = await launchMatchFromComposition({
        config,
        playerCount: run.playerCount,
        playerName,
        authToken,
      });
      if (result.ok === false) {
        gauntletPlayError.value = result.message;
      }
    }

    /**
     * Delete (reset) one gauntlet run via DELETE, removing its row on success.
     * Sets the inline row error otherwise. Never throws.
     */
    async function removeGauntletRun(
      run: GauntletRunProgressView,
    ): Promise<void> {
      gauntletRowError.value = '';
      const result = await deleteGauntletRun(readAuthToken(), run.id);
      if (result.ok === true) {
        gauntletRuns.value = gauntletRuns.value.filter(
          (candidate) => candidate.id !== run.id,
        );
        return;
      }
      gauntletRowError.value = gauntletRunMessageForCode(result.code);
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
      void loadGauntletRuns();
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
      activeGauntletRuns,
      completedGauntletRuns,
      gauntletError,
      gauntletPasteText,
      gauntletImportError,
      gauntletImportInFlight,
      gauntletRowError,
      gauntletPlayError,
      pickDrafts,
      submitImportPaste,
      onGauntletFileSelected,
      saveLegPicks,
      playLeg,
      removeGauntletRun,
      statusBadge,
      lastPlayedLegId,
      canPlayLeg,
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

      <!-- why: WP-449 / D-24269 — the Gauntlet Runs tracker. Renders the
           server's DERIVED GauntletRunProgressView verbatim (status / pool /
           budgetHeadroom / isChampion never recomputed client-side, D-24262);
           only presentation-local values (last-played highlight, Play-button
           enablement) are computed. "Play this leg" assembles a MatchSetupConfig
           from the run's picks + the server-supplied launch block and reuses the
           WP-448 launch primitive. champion (green) and all-legs-cleared (amber)
           are visibly distinct states (AC-4). -->
      <section class="profile-gauntlets" data-testid="my-profile-gauntlets">
        <h2>Gauntlet Runs</h2>
        <p class="profile-help">
          Import a Mastermind Gauntlet pack downloaded from the gauntlet page,
          pick your heroes for each leg, and launch a leg. Clearing every leg
          with one legal hero pool makes you champion.
        </p>

        <div class="profile-gauntlet-import" data-testid="my-profile-gauntlet-import">
          <label class="profile-field">
            <span class="profile-field-label">Import a pack file</span>
            <input
              type="file"
              accept="application/json,.json"
              data-testid="my-profile-gauntlet-file"
              @change="onGauntletFileSelected"
            />
          </label>
          <label class="profile-field">
            <span class="profile-field-label">…or paste a pack (JSON)</span>
            <textarea
              v-model="gauntletPasteText"
              rows="4"
              placeholder='{ "pack_version": 1, "gauntlet": { … } }'
              data-testid="my-profile-gauntlet-paste"
            ></textarea>
          </label>
          <button
            type="button"
            class="profile-save"
            data-testid="my-profile-gauntlet-import-paste"
            :disabled="gauntletImportInFlight"
            @click="submitImportPaste"
          >
            Import pasted pack
          </button>
          <p
            v-if="gauntletImportError !== ''"
            class="profile-upload-error"
            data-testid="my-profile-gauntlet-import-error"
          >
            {{ gauntletImportError }}
          </p>
        </div>

        <p
          v-if="gauntletError !== ''"
          class="profile-upload-error"
          data-testid="my-profile-gauntlet-error"
        >
          {{ gauntletError }}
        </p>

        <template v-if="activeGauntletRuns.length === 0">
          <p class="profile-help" data-testid="my-profile-gauntlet-active-empty">
            No active gauntlet runs yet. Import a pack above to start one.
          </p>
        </template>
        <ul v-else class="profile-gauntlet-list">
          <li
            v-for="run in activeGauntletRuns"
            :key="run.id"
            class="profile-gauntlet-run"
            :data-testid="`my-profile-gauntlet-run-${run.id}`"
          >
            <div class="profile-gauntlet-run-head">
              <span
                class="profile-gauntlet-badge"
                :class="statusBadge(run.status).toneClass"
                :data-testid="`my-profile-gauntlet-status-${run.id}`"
              >
                {{ statusBadge(run.status).label }}
              </span>
              <span class="profile-gauntlet-identity">
                {{ run.setAbbr }} · {{ run.mastermindSlug }} ·
                {{ run.playerCount }}-player
              </span>
            </div>

            <!-- why: AC-4 — all-legs-cleared is an amber STRATEGY state, not an
                 error; the copy names the budget/pool gap directly (never
                 "incomplete" / "failed") and champion never renders this block. -->
            <p
              v-if="run.status === 'all-legs-cleared'"
              class="profile-gauntlet-strategy"
              :data-testid="`my-profile-gauntlet-all-cleared-${run.id}`"
            >
              You cleared every leg, but this run is not champion yet because
              your winning teams use {{ run.pool.length }} heroes over the
              {{ run.budget }}-hero budget. Trim the run to one legal pool.
            </p>
            <p
              v-if="run.status === 'champion'"
              class="profile-gauntlet-champion-note"
              :data-testid="`my-profile-gauntlet-champion-${run.id}`"
            >
              Champion — every leg cleared with one legal hero pool.
            </p>

            <p class="profile-gauntlet-pool">
              Hero pool: {{ run.pool.length }} / {{ run.budget }} budget ·
              headroom {{ run.budgetHeadroom }}
            </p>

            <p
              v-if="run.launch === null"
              class="profile-gauntlet-launch-missing"
              :data-testid="`my-profile-gauntlet-launch-missing-${run.id}`"
            >
              This gauntlet's adversary composition isn't configured for this
              player count yet, so its legs can't be launched.
            </p>

            <ul class="profile-gauntlet-legs">
              <li
                v-for="leg in run.legs"
                :key="leg.schemeId"
                class="profile-gauntlet-leg"
                :class="{
                  'profile-gauntlet-leg--last-played':
                    leg.schemeId === lastPlayedLegId(run),
                }"
                :data-testid="`my-profile-gauntlet-leg-${run.id}-${leg.schemeId}`"
              >
                <div class="profile-gauntlet-leg-head">
                  <span class="profile-gauntlet-leg-name">{{ leg.schemeName }}</span>
                  <span
                    v-if="leg.cleared"
                    class="profile-gauntlet-chip profile-gauntlet-chip--cleared"
                    :data-testid="`my-profile-gauntlet-leg-cleared-${run.id}-${leg.schemeId}`"
                  >
                    cleared
                  </span>
                  <span
                    v-else
                    class="profile-gauntlet-chip profile-gauntlet-chip--uncleared"
                  >
                    not cleared
                  </span>
                  <span
                    v-if="leg.hasFullPicks"
                    class="profile-gauntlet-chip profile-gauntlet-chip--picks"
                  >
                    full picks
                  </span>
                  <span
                    v-if="leg.schemeId === lastPlayedLegId(run)"
                    class="profile-gauntlet-chip profile-gauntlet-chip--resume"
                  >
                    where you left off
                  </span>
                </div>

                <p
                  v-if="leg.lastPlayedAt !== null"
                  class="profile-gauntlet-leg-played"
                >
                  Last played {{ leg.lastPlayedAt }}
                </p>

                <div class="profile-gauntlet-leg-edit">
                  <input
                    v-model="pickDrafts[`${run.id}::${leg.schemeId}`]"
                    type="text"
                    placeholder="core/spider-man, core/hulk, core/storm"
                    :data-testid="`my-profile-gauntlet-picks-${run.id}-${leg.schemeId}`"
                  />
                  <button
                    type="button"
                    :data-testid="`my-profile-gauntlet-save-${run.id}-${leg.schemeId}`"
                    @click="saveLegPicks(run, leg)"
                  >
                    Save picks
                  </button>
                  <button
                    type="button"
                    class="profile-gauntlet-play"
                    :disabled="!canPlayLeg(run, leg)"
                    :data-testid="`my-profile-gauntlet-play-${run.id}-${leg.schemeId}`"
                    @click="playLeg(run, leg)"
                  >
                    Play this leg
                  </button>
                </div>
                <p
                  v-if="!canPlayLeg(run, leg)"
                  class="profile-field-hint"
                  :data-testid="`my-profile-gauntlet-play-hint-${run.id}-${leg.schemeId}`"
                >
                  <template v-if="run.launch === null">
                    Launch is unavailable until this gauntlet's composition is
                    configured.
                  </template>
                  <template v-else>
                    Enter a full hero pick ({{ run.heroCount }} heroes) and save
                    to enable Play this leg.
                  </template>
                </p>
              </li>
            </ul>
          </li>
        </ul>

        <template v-if="completedGauntletRuns.length > 0">
          <h3 class="profile-gauntlet-history-heading">Completed runs</h3>
          <ul class="profile-gauntlet-list">
            <li
              v-for="run in completedGauntletRuns"
              :key="run.id"
              class="profile-gauntlet-run profile-gauntlet-run--history"
              :data-testid="`my-profile-gauntlet-history-${run.id}`"
            >
              <div class="profile-gauntlet-run-head">
                <span
                  class="profile-gauntlet-badge"
                  :class="statusBadge(run.status).toneClass"
                >
                  {{ statusBadge(run.status).label }}
                </span>
                <span class="profile-gauntlet-identity">
                  {{ run.setAbbr }} · {{ run.mastermindSlug }} ·
                  {{ run.playerCount }}-player
                </span>
                <button
                  type="button"
                  :data-testid="`my-profile-gauntlet-delete-${run.id}`"
                  @click="removeGauntletRun(run)"
                >
                  Delete / reset
                </button>
              </div>
            </li>
          </ul>
        </template>

        <p
          v-if="gauntletRowError !== ''"
          class="profile-upload-error"
          data-testid="my-profile-gauntlet-row-error"
        >
          {{ gauntletRowError }}
        </p>
        <p
          v-if="gauntletPlayError !== ''"
          class="profile-upload-error"
          data-testid="my-profile-gauntlet-play-error"
        >
          {{ gauntletPlayError }}
        </p>
      </section>

      <!-- why: WP-352 / D-24144 — the owner's Friends section (packet #3
           of Friends & Ranked Trust). A thin client over WP-351's
           /api/me/friends* API, threaded the owner authToken the same way
           BillingSection is. Handle-only identity on screen (FR-2). -->
      <section class="profile-friends">
        <FriendsSection :auth-token="readAuthToken()" />

        <MatchInvitesSection
          :auth-token="readAuthToken()"
          :player-name="view?.displayName ?? view?.handleCanonical ?? ''"
        />
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
.profile-gauntlets,
.profile-friends,
.profile-billing {
  padding: 1.25rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.5);
}

/* why: WP-449 — the Gauntlet Runs tracker. champion (green) and
   all-legs-cleared (amber) MUST be visibly distinct (AC-4); the three
   in-progress states use neutral tones. */
.profile-gauntlets {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.profile-gauntlets h2 {
  font-size: 1.125rem;
  margin: 0 0 0.5rem 0;
}

.profile-gauntlet-import {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-gauntlet-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.profile-gauntlet-run {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 0.375rem;
}

.profile-gauntlet-run-head {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.profile-gauntlet-badge {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.15rem 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid transparent;
}

.gauntlet-badge--champion {
  color: #1b5e20;
  background: #e6f4ea;
  border-color: #2a7d2a;
}

.gauntlet-badge--all-legs-cleared {
  color: #8a5300;
  background: #fff4e0;
  border-color: #f4a261;
}

.gauntlet-badge--playing,
.gauntlet-badge--ready,
.gauntlet-badge--needs-heroes {
  color: rgba(0, 0, 0, 0.65);
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.12);
}

.profile-gauntlet-identity {
  font-size: 0.85rem;
  opacity: 0.75;
}

.profile-gauntlet-strategy {
  font-size: 0.85rem;
  color: #8a5300;
  background: #fff8ee;
  border-left: 3px solid #f4a261;
  padding: 0.4rem 0.6rem;
  margin: 0;
  border-radius: 0.2rem;
}

.profile-gauntlet-champion-note {
  font-size: 0.85rem;
  color: #1b5e20;
  margin: 0;
}

.profile-gauntlet-pool {
  font-size: 0.8rem;
  opacity: 0.8;
  margin: 0;
}

.profile-gauntlet-launch-missing {
  font-size: 0.8rem;
  color: #b3261e;
  margin: 0;
}

.profile-gauntlet-legs {
  list-style: none;
  padding: 0;
  margin: 0.25rem 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-gauntlet-leg {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.5rem;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 0.3rem;
}

.profile-gauntlet-leg--last-played {
  border-color: #4a90d9;
  background: rgba(74, 144, 217, 0.06);
}

.profile-gauntlet-leg-head {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  flex-wrap: wrap;
}

.profile-gauntlet-leg-name {
  font-weight: 500;
  font-size: 0.9rem;
}

.profile-gauntlet-chip {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 0.6rem;
}

.profile-gauntlet-chip--cleared {
  color: #1b5e20;
  background: #e6f4ea;
}

.profile-gauntlet-chip--uncleared {
  color: rgba(0, 0, 0, 0.55);
  background: rgba(0, 0, 0, 0.05);
}

.profile-gauntlet-chip--picks {
  color: #0d47a1;
  background: #e3f0fb;
}

.profile-gauntlet-chip--resume {
  color: #4a90d9;
  background: rgba(74, 144, 217, 0.12);
  font-weight: 600;
}

.profile-gauntlet-leg-played {
  font-size: 0.75rem;
  opacity: 0.65;
  margin: 0;
}

.profile-gauntlet-leg-edit {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  flex-wrap: wrap;
}

.profile-gauntlet-leg-edit input {
  flex: 1;
  min-width: 12rem;
}

.profile-gauntlet-play:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.profile-gauntlet-history-heading {
  font-size: 1rem;
  margin: 0.5rem 0 0 0;
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
