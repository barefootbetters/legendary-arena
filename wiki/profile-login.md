---
title: Profile Login
type: System
tags:
  - auth
  - hanko
  - layer-server
  - arena-client
  - profile
  - governance
  - friends
  - social-graph
  - ranked
related:
  - operational-health-checks.md
  - hugo-web-system.md
  - data-file-locations.md
  - r2-image-naming-convention.md
  - leaderboard.md
status: draft
source:
  - ../docs/ai/work-packets/WP-102-public-profile-page.md
  - ../docs/ai/work-packets/WP-104-owner-profile-data-model-and-me-edit.md
  - ../docs/ai/work-packets/WP-160-hanko-client-ui.md
  - ../docs/ai/work-packets/WP-161-arena-client-api-base-url.md
  - ../docs/ai/work-packets/WP-174-first-signin-auto-provisioning.md
  - ../docs/ai/work-packets/WP-175-arena-client-auth-nav.md
  - ../docs/ai/work-packets/WP-296-avatar-cdn-host-unification.md
  - ../docs/ai/work-packets/WP-298-owner-profile-avatar-upload-ui.md
  - ../docs/ai/work-packets/WP-299-owner-profile-edit-ux-polish.md
  - ../docs/ai/work-packets/WP-305-owner-profile-identity-fields.md
  - ../docs/ai/work-packets/WP-338-submit-by-matchid-server.md
  - ../docs/ai/work-packets/WP-339-arena-submit-my-scores.md
  - ../apps/server/src/profile/ownerProfile.types.ts
  - ../apps/arena-client/src/pages/MyProfilePage.vue
  - ../apps/arena-client/src/composables/useAuthNav.ts
  - ../apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts
  - ../docs/ai/work-packets/WORK_INDEX.md
last-reviewed: 2026-07-10
---

# Profile Login

## Summary

The player sign-in and profile surface for Legendary Arena. The whole
auth stack — broker selection, server-side session verification,
first-sign-in provisioning, the client login UI, and the profile
pages — ships into the **arena-client** app, which deploys to
`play.legendary-arena.com`. The marketing site at
`www.legendary-arena.com` is a separate Hugo project
([Hugo Web System](hugo-web-system.md)) and does not **own** a sign-in
surface — but as of 2026-07 it is auth-**aware**: it reads the
cross-subdomain session to greet a signed-in visitor by name in its header
(WP-033 / D-24138, on the WP-347 shared cookie). Sign-in and profile
editing still live entirely on `play`.

## Mechanics

![Auth stack and profile surface. Hanko issues an RS256 JWT to the WP-126 verifier; the server chain WP-099 to WP-112 to WP-126 to WP-131 to WP-174 provisions an account; the arena-client Pinia store holds the bearer token and feeds the WP-160 login UI, WP-161 API base URL, and WP-175 nav. Broker code is confined at two F-2 sites: the server apps/server/src/auth/hanko directory and the client hankoClient.ts.](/profile-login/auth-stack.svg "width=82%")

*Top-to-bottom is build/dependency order; amber boxes are the two F-2 broker-confinement sites. Diagram source: [auth-stack.mmd](../ewiki/profile-login/auth-stack.mmd) — regenerate the render with `mmdc`.*

Authentication is brokered through **Hanko**. The broker name is
deliberately invisible at rest: the `auth_provider` enum stays
`'email' | 'google' | 'discord'` and the literal string `'hanko'`
never appears as a value, fixture, or seed (the F-1 / F-2 replacement
-safety gates enforce this).

The stack landed as a dependency chain, server-side first, then the
client UI:

| Layer | Work Packet | What it does |
|-------|-------------|--------------|
| Broker selection | WP-099 | Selects Hanko as the broker (governance only). |
| Session middleware | WP-112 | Broker-agnostic orchestrator + `SessionVerifier` interface. |
| Session verifier | WP-126 | Hanko session verifier, confined to `apps/server/src/auth/hanko/`. |
| Production wiring | WP-131 | Wires the verifier + account resolver at server startup. |
| Auto-provisioning | WP-174 | Read-or-create account on first sign-in from Hanko JWT claims. |
| Client sign-in UI | WP-160 | The actual login page on arena-client. |
| API base URL | WP-161 | Makes client fetches target the API host, not the SPA origin. |
| Auth-aware nav | WP-175 (evolved by WP-330 / WP-332 / WP-346) | Header auth element. Signed-out: "Sign in". Signed-in: the player's **name** (WP-330 — the label, once "My account", now shows the real `displayName`), which is **itself the link** to `?route=me` (WP-346 dropped the separate "My profile" link), + "Sign out". The header reads `Home · Cards · <name> · Sign out`. |

### Identity provider options (Google, Discord, Facebook)

Hanko federates several upstream identity providers. Today the
`auth_provider` enum recognises exactly three values —
`'email' | 'google' | 'discord'` — with native email plus federated
`ext:google` and `ext:discord` wired
(`apps/server/src/auth/hanko/hankoVerifier.types.ts`,
`HANKO_IDP_TO_AUTH_PROVIDER`). **Facebook is not in the enum and is not
wired anywhere**; adding it is a governance change (the F-1
replacement-safety gate guards the enum), not a dashboard toggle. The
buttons a player actually sees are configured in the Hanko tenant
dashboard, not in repo code.

The trade-offs below are recorded for engineering reference. The
authoritative decision (which providers ship, and any move to add
Facebook) lives in [DECISIONS.md](../docs/ai/DECISIONS.md) and the
grounded strategy brief
[auth-and-file-management-strategy.md](../docs/ai/auth-and-file-management-strategy.md),
not on this page.

#### Google — *supported (wired)*

| Pros | Cons |
|------|------|
| Near-universal account ownership — almost every player already has one; lowest sign-in friction. | Generic, not gaming-flavoured — no community hook back into a player network. |
| Reliably returns a **verified email**, which directly feeds the marketing relationship (the captured email is written to `legendary.players.email` on first sign-in, WP-174). | Some privacy-conscious players avoid linking Google to game accounts. |
| Mature, trusted OAuth; 2FA common; low support burden. | Returns minimal profile richness beyond name / email / avatar. |
| Already federated through Hanko (`ext:google`). | — |

#### Discord — *supported (wired)*

| Pros | Cons |
|------|------|
| **Best audience fit** — gamers and tabletop communities live on Discord; signals "this is a game for people like you." | **Email scope is optional and must be requested.** If Discord returns no email, WP-174 provisioning is skipped and the user is hard-rejected with a 401 — there is no "add your email to finish" screen yet (see Edge Cases). This is the real operational catch. |
| Opens the door to future community integration — server roles, presence, notifications, looking-for-game — a genuine retention lever. | Not universal: older / casual / lapsed players may not have a Discord account. |
| Strong brand affinity with the target demographic. | Account-linking gap: a player who signs in with Discord and later with Google under the same email is rejected (`duplicate_email`), not linked. |
| Already federated through Hanko (`ext:discord`). | — |

#### Facebook — *not supported (not in the locked enum)*

Recorded for completeness because it comes up; it is **not** an
available provider and would require an architecture change plus a
DECISION before it could ship.

| Pros | Cons |
|------|------|
| Huge install base across broad and older demographics — widest raw reach if casual / lapsed players are the target. | Declining trust and engagement among younger gamers — off-brand for this audience. |
| Returns email and a rich social graph; useful for social-invite virality. | Heavier privacy / permission baggage; users increasingly decline Facebook login. |
| Familiar to non-gamer audiences. | Meta OAuth app review is onerous (business verification + periodic re-review) — real ongoing maintenance cost. |
| — | **Not in the `auth_provider` enum** — net-new governance + engineering work, not a config toggle. |
| — | Largely redundant: Google already covers the "universal verified-email login" job with less baggage. |

**Net:** Google + Discord (both already wired) cover the two jobs that
matter — universal low-friction email login (Google) and audience-fit
community login (Discord). Facebook adds reach at the cost of trust,
maintenance, and a governance change, and overlaps the job Google
already does.

### Where the login UI lives

The production sign-in surface is **WP-160**. It ships entirely inside
`apps/arena-client/`:

- `src/stores/auth.ts` — Pinia auth store holding the bearer token and
  `accountId`, with `setSession` / `clearSession` /
  `bootstrapFromCachedToken` actions.
- `src/auth/hankoClient.ts` — single-file broker-confined SDK wrapper
  (the only file allowed to import `@teamhanko/*`).
- `LoginPage.vue` — rendered at the `?route=login` route discriminator.
- `MyProfilePage.vue` — cut over from a `localStorage` placeholder to
  reading the auth store token.

WP-175 added the auth-aware navigation element to `BrandHeader.vue`:
signed-out shows a "Sign in" link; signed-in shows a display label +
"Sign out". A run of 2026-07 refinements gave the signed-in state its
current shape:

- **WP-330 (D-24116)** — the label shows the player's actual **name**
  instead of the static "My account". `useAuthNav` fetches the owner
  profile once on the signed-in transition (via the existing
  `fetchOwnerProfile`, now that WP-305 returns the fields) and resolves
  `displayName.trim()` → `@handleCanonical` → "My account" (non-blocking,
  silent-fallback, fetched once, reset on sign-out).
- **WP-346 (D-24136)** — the **name itself is the link** to `?route=me`;
  the standalone "My profile" link is removed as redundant (both pointed
  at the same route). The header now reads `Home · Cards · <name> · Sign out`.
- **WP-332 (D-24118)** — removed a *second* copy of the name + a *second*
  "Sign out" button that `MyProfilePage.vue` rendered on top of the global
  header; identity + sign-out now live **only** in the header, and
  `?route=me` shows a plain "Your profile" title.
- **WP-347 (D-24137, amends D-16002)** — scopes the `hanko` session cookie
  to `.legendary-arena.com` on production hosts, so a sign-in is shared
  across `play` / `dashboard` / `www` (**single sign-on**; existing users
  re-sign-in once). This is what lets `www` read a `play.` login (below).

### Profile surface

The user profile is **two distinct pages plus layered data**, all
rendered in **arena-client** and read through the same authenticated API.
Like the login screen, none of it lives in the marketing repo:

| Surface | Work Packet | Route / location | What it is |
|---------|-------------|------------------|------------|
| Public profile (read-only) | WP-102 (route wired by WP-152) | by player handle | `PublicProfileView` (closed field shape); returns **404** on no-match. |
| Public-profile link preview (unfurl) | **[WP-300](../docs/ai/work-packets/WP-300-public-profile-link-preview-meta.md)** (Done 2026-06-30) | edge `functions/_middleware.ts` on `play` | Makes shared public-profile links **unfurl** with a rich preview. arena-client's first Cloudflare Pages Function intercepts the SPA-shell HTML for `?profile=<handle>`, fetches the guest `GET /api/players/:handle/profile`, and injects per-player Open Graph + Twitter Card `<meta>` into `<head>` via `HTMLRewriter` (title = display name; description = §23-compliant badge/team/replay counts — **no** win/rank/opponent framing; image = a static 1200×630 brand card). **Fail-soft:** paramless loads, non-HTML responses, bad handles, or any API failure serve the **unmodified** shell (1500 ms bounded fetch). No server/contract/`index.html` change; reserves **D-24085** (edge subsurface + HTMLRewriter inject-for-all + static brand-image v1; per-player/avatar OG image deferred). |
| Owner profile + edit | WP-104 (edit-page polish by **[WP-299](../docs/ai/work-packets/WP-299-owner-profile-edit-ux-polish.md)**) | `?route=me` → `MyProfilePage.vue` | The signed-in player's own editable profile. Migration `009_create_player_profiles_and_links.sql` creates `legendary.player_profiles` + `legendary.player_links`; `PATCH /api/me/profile` is the edit path. **WP-299 (Done 2026-06-30, PR #504)** polished this page — a live avatar **preview** thumbnail (hides on a broken URL, never mutates the typed value), an accurate upload **hint** (**PNG/JPEG/WebP · up to 5 MB**, sourced from the server `ALLOWED_MIME_TYPES` + `MAX_FILE_SIZE_BYTES`, correcting stale copy that wrongly listed **GIF**), a live **About-me character counter** against the 500-char cap, and scoped **card treatment** with a `@media (max-width: 40rem)` one-column link row. Presentation-only: no API/contract/store change, no new D-entry. |
| Saved loadouts (library + public share) | **[WP-301](../docs/ai/work-packets/WP-301-profile-loadout-library-server.md)** (server) + **[WP-302](../docs/ai/work-packets/WP-302-profile-loadout-library-client.md)** (client) — both Done 2026-07-01 | `?route=me` "Saved Loadouts" section + `?loadout=<shareSlug>` public page | Vision **§19b** loadout library: a signed-in player saves LAGN loadouts to their account (create by pasting LAGN JSON, list / rename / public-private toggle / delete / copy-share-link) and shares a public one via an opaque slug. **Server (WP-301):** migration `022_create_player_loadouts.sql` (`legendary.player_loadouts`), `POST/GET /api/me/loadouts` + `PATCH/DELETE /api/me/loadouts/:id` (authenticated-session) + guest `GET /api/loadouts/:shareSlug` (**public-only** — 404 on private/missing, never leaks `accountId`); server-side LAGN `validate` on every write; per-account cap **50** (**D-24086**). **Client (WP-302):** the owner section plus a net-new **unguarded** `SharedLoadoutPage.vue` at `?loadout=<shareSlug>` (name + `displayHandle` + composition summary), treating LAGN as opaque JSON (no validator import). **Decorative-not-merit (§19b / §19a)** — never a competitive-submission path (**D-24087**). Lobby "Save this loadout" / "Load into lobby" integration deferred to **WP-303**. |
| Team affiliation | WP-109 | both profile views | Profile-level cooperative cohorts; extends `PublicProfileView` (4→5 keys) and `OwnerProfileView` (7→8 keys). |
| Badges | WP-105 | both profile views | Tier-1 gameplay badges (migration 013); fire-and-forget issuance in the competition pipeline. |
| Competitive scores ("My Scores") + on-gameover submission | **[WP-338](../docs/ai/work-packets/WP-338-submit-by-matchid-server.md)** (server) + **[WP-339](../docs/ai/work-packets/WP-339-arena-submit-my-scores.md)** (client) — both Done 2026-07-08, deployed 2026-07-09 | `?route=me` "Competitive Scores" section + a fire-once submit watcher at `PlayViewport` | The player-facing end of the **D-24119 faithful-replay arc**. On gameover, an *authenticated* player's arena-client submits the match's competitive score **by `matchId`** (the client never computes a `replayHash`; the server resolves + captures on-demand + verifies + auto-publishes + scores — see [Leaderboard → the write path](leaderboard.md#from-a-finished-match-to-a-ranked-row-the-write-path)). A **guest is never submitted** — the on-gameover status line instead prompts a sign-in. The owner profile then reads **`GET /api/me/scores`** (`authenticated-session-required`) to list the player's own submitted scores. **Auth-gated end to end:** submission requires the WP-112 session → WP-107 unsuspended → non-guest `PlayerAccount` chain (a guest hits `guest_not_eligible`); the `MyProfilePage` list attaches the bearer token like every other `/api/me/*` call. Reserves **D-24126** (submit-by-matchId + auto-publish) + **D-24127** (client fire-once, authed-only). |
| Avatar | WP-106 (pipeline) + **[WP-298](../docs/ai/work-packets/WP-298-owner-profile-avatar-upload-ui.md)** (upload UI) — host unified by **[WP-296](../docs/ai/work-packets/WP-296-avatar-cdn-host-unification.md)** | owner profile | `POST /api/me/avatar` upload pipeline. Avatars are served from `https://images.legendary-arena.com/avatars/{accountId}.webp` — the **same** Cloudflare custom domain + `legendary-images` R2 bucket as card images, unified under **D-24083** (WP-296, 2026-06-30). The legacy `images.barefootbetters.com` avatar host is retired; `AVATAR_CDN_BASE`, the closed-origin `validateAvatarUrl` allowlist, and existing `avatar_url` rows (migration 021) all moved. **WP-298 (2026-06-30)** wires the pipeline into the client: `MyProfilePage.vue` (`?route=me`) gained a `<input type="file">` + "Upload avatar" control that calls a new `uploadOwnerAvatar(authToken, file)` wrapper in `ownerProfileApi.ts` (multipart field `avatar`) and updates the displayed avatar on success. Before WP-298 the page exposed **only** a free-text avatar-URL field that was effectively unusable, because the closed-origin allowlist accepts only the `images.legendary-arena.com/avatars/` URLs this endpoint produces — a player had no way to generate one. The free-text field is retained alongside the uploader; the server still owns resize → `{accountId}.webp` (D-10601). See [R2 Image Naming Convention](r2-image-naming-convention.md). |
| Billing & funding history | WP-108 | `BillingSection` in `MyProfilePage.vue` | Benefits / purchase history / community funding panels; `GET /api/me/billing/history`. |
| Integrity / anti-cheat | WP-107 | admin-only | `/api/admin/players/:handle/` suspend / integrity / unsuspend endpoints over profiles. |

The header's player-name link (WP-330 / WP-346) points at `?route=me`; the
public profile is reached by handle. The `www.legendary-arena.com` Hugo
content tree (`content/`: `about`, `brand`, `shop`, `tournaments`,
`leaderboard`, `posts`, `emails`, `diorama`) contains **no profile or
login surface of its own**. As of the marketing repo's **WP-031**
(executing **[D-24084](../docs/ai/DECISIONS.md)**, 2026-06-30) its header
**links** to `play`'s sign-in (`?route=login`) and profile (`?route=me`)
via two `[[menu.main]]` entries — but the auth surface itself lives
entirely on `play`. Linking, not owning: this is the play-vs-www split
below.

### Profile UI design direction — evaluation (2026-06-30)

Two external AI design passes (a general assistant and a Copilot
enterprise-search pass) recommended re-skinning the `?route=me` owner
profile as a **gamer-flavoured identity page** — a prominent "player
identity" header (large ringed avatar, display name, title/rank line,
short about-me) over a responsive card grid (Profile / Links / Teams /
Billing / Achievements), in a dark slate theme with a gold "legendary"
accent. The stated models were Steam / Discord / GitHub / MMO character
pages rather than Salesforce / Azure / Stripe settings screens. Suggested
structural references were Vuestic Admin, a Vue-3 profile-page template,
and DevExpress's user-profile demo, plus avatar npm packages
(`vue-profile-avatar`, `avatar-vue3`). Recorded here so the direction is
evaluated once against the vision rather than re-litigated per WP.

**Layout and aesthetic — mostly sound.**

| Pros | Cons |
|------|------|
| The identity-header + modular card-grid shape fits the [WP-104](../docs/ai/work-packets/WP-104-owner-profile-data-model-and-me-edit.md) / [WP-299](../docs/ai/work-packets/WP-299-owner-profile-edit-ux-polish.md) direction and reinforces player identity over a generic account-settings feel. | "Player as a legend in the making" must not drift into pay-to-win prestige — decoration is fine, purchasable standing is not (NG-1 no-pay-to-win; §23's competitive question is never "who purchased more advantages"). |
| Dark theme + a single gold accent reads as on-brand prestige; avatar UX (crop, client-side compression, explicit "Apply Changes" + toast) matches the WP-298 upload contract already wired. | The second "cyan/electric" accent is a net-new palette token — don't invent it unless it already exists in the arena-client theme. |
| Build private-first and structure components so the public profile ([WP-102](../docs/ai/work-packets/WP-102-public-profile-page.md)) reuses them is the right sequencing. | Reusing components across the owner and public views must respect the **closed field shapes** (`PublicProfileView` vs `OwnerProfileView`) — the public view is a distinct, narrower projection, not the same page read-only. |

**Stats / "dopamine" row — this is where the suggestions go wrong.** The
proposed header pills (*Matches*, *Win Rate*, *Tournaments*, *Global
Rank #47*) and a *"Challenge"* CTA import a real-time player-vs-player
combat-ladder model the game explicitly does not have:

| Proposed element | Problem | On-brand replacement |
|---|---|---|
| **Win Rate**, **Matches** | Win/loss + head-to-head "match" framing. §23 sanctions competition only as *scenario benchmarking* and *asynchronous comparison* — "players never act as opponents inside a match." | Scenarios cleared, best PAR delta, per-attempt efficiency (personal history is fine to *display*). |
| **Global Rank #47** as a generic pill | A rank is legitimate **only** as the §23(b) seasonal / scenario ladder, and §25(a) forbids cumulative counts (wins/sessions/attempts) as ranking inputs — rankings must be quality-normalized (best-N-runs, avg PAR delta). | Seasonal standing labelled as a replay-verified scenario-benchmark ladder, not an ELO. |
| **"Challenge" CTA** | Implies real-time PvP combat, which §23 rules out entirely. | "View replays" / "Compare runs" (comparison, not combat). |
| Any raw stat slot | Building header slots for aggregates that aren't wired yet ships zeros or, worse, invented numbers. | Only surface metrics with data behind them today. |

Note what is **already founded** and should be kept: **badges**
([WP-105](../docs/ai/work-packets/WP-105-player-badges-data-model-and-display.md)) are
replay-verified per §24 (an achievements showcase is real, not phantom),
and **team affiliation**
([WP-109](../docs/ai/work-packets/WP-109-team-affiliation.md)) is a wired
profile surface (a Teams card has a data model behind it). Both are safe
to feature early.

**Scope.** WP-299 (shipped 2026-06-30, PR #504) delivered UX polish on the
private *edit* page — see the Owner-profile row above for what landed. The full
proposal (Teams, achievements showcase, public profiles, banner
customization, activity feed, verified-replay gallery) is a multi-WP
player-identity subsystem. It should be decomposed and sequenced — private
edit view, then public profile ([WP-102](../docs/ai/work-packets/WP-102-public-profile-page.md)) —
not folded under a "polish" label.

**Structural reference (Vuestic Admin et al.) — do not adopt as a
dependency.**

| Pros | Cons |
|------|------|
| The referenced templates are genuinely useful *visual* inspiration for card layout and responsive breakpoints. | Pulling an admin framework in "to skin aggressively so it never looks like an admin panel" inherits a dependency and a design language you then fight — the arena-client is already Vue 3; extend its existing components. |
| Avatar packages solve initials-fallback and image handling. | The avatar pipeline is **already** wired (WP-298: `uploadOwnerAvatar` → `POST /api/me/avatar` → server-owned resize to `{accountId}.webp`); a new avatar package would duplicate a solved, contract-bound path. |

**Revenue lens.** A prettier *private* edit page is polish, not payroll.
The business-relevant surface is the **public profile** — a shareable,
marketing/virality asset. If any of this is prioritized, that is the
piece that earns its keep.

**Net:** adopt the identity-header + card-grid layout and the dark/gold
skin; feature badges and teams early; **replace the combat/volume stat
cluster (win-rate, match count, generic rank, "Challenge") with §23/§24/§25-compliant
scenario-benchmark progression**; extend existing arena-client components
rather than adopting Vuestic/DevExpress as dependencies; and split the
public-profile ambitions into their own sequenced Work Packets. External
enterprise-search artifacts (Copilot / SharePoint) are intentionally
**not** linked here — the founded facts they surfaced are the WP rows
above.

### Owner-page identity fields — `accountId`, `displayName`, `handleCanonical`

> **Status: SHIPPED.** Landed by **[WP-305](../docs/ai/work-packets/WP-305-owner-profile-identity-fields.md) / EC-335 (2026-07-04)** under two decisions —
> **[D-24089](../docs/ai/DECISIONS.md)** (read: surface the three fields) +
> **D-24090** (write: editable `displayName`) — and is **deployed** (the server is
> live at `gitSha b20b97a`, 2026-07-09). This replaces the earlier "proposed — not
> scheduled" design note; both gating decisions below were ratified and built.

Three identity fields live on `legendary.players`: **`ext_id`** (the
`accountId` — an opaque UUID, mapped to `AccountId` per D-5201),
**`display_name`** (the human profile name, WP-101), and **`display_handle`**
(immutable, globally unique, URL-safe; migration `008_add_handle_to_players.sql`,
WP-101). They were already surfaced on the **public** profile
(`PublicProfileView` → `displayName` + `handleCanonical`, rendered by
`PlayerProfilePage.vue`), and the **owner** profile now surfaces them too.

**Read — the owner response carries the player's own identity (D-24089).**
`OwnerProfileView` (`GET /api/me/profile`,
[WP-104](../docs/ai/work-packets/WP-104-owner-profile-data-model-and-me-edit.md))
went from 9 → **12 keys**, adding `accountId: AccountId`, `displayName: string`,
and `handleCanonical: string | null` (composed on every return path, including
the synthesized-default branch). `MyProfilePage.vue` (`?route=me`) renders
**`@{handleCanonical}`** (shown only when a handle is claimed) and a muted
**"Account ID: `{accountId}`"** support line, with `displayName` editable in the
form below. **Refinement (WP-332 / D-24118, 2026-07-08):** the page no longer
shows the `displayName` as a *heading* nor a page-level "Sign out" button — those
duplicated the global header (which shows the name as of WP-330 and owns
sign-out on every route), so they were removed; the page header is now a plain
"Your profile" title. The three read fields are still returned by
`/api/me/profile` and mirrored structurally in `ownerProfileApi.ts` (no
cross-layer type import). Locked choices from D-24089:

- **`accountId` is always shown** (operator decision) — a muted, always-visible
  support line ("give support this id"), not hidden behind a copy control and
  not omitted. Opaque UUID; display-only, never editable.
- **`handleCanonical` is display-only** — immutable by design (migration 008;
  `claimHandle` is its sole writer), and surfaced under the **same wire name +
  form** the public view uses (one concept, one name). Nullable pre-claim.

**Write — `displayName` is editable here (D-24090).** `OwnerProfilePatch` gained
`displayName?: string` (never `| null` — `display_name` is NOT NULL and cannot be
cleared), so the owner page is now the **rename** surface (previously the name was
set once at provisioning, WP-174, with no edit path). A local `validateDisplayName`
in `ownerProfile.logic.ts` re-derives the identity rules verbatim (trim; reject
empty-after-trim, `> 64` chars, any control char) — failure returns the closed-set
code `invalid_display_name` (HTTP 400). The rename is **transactional with the
profile upsert**: when the PATCH carries `displayName`, `upsertOwnerProfile` runs
`UPDATE legendary.players SET display_name = …` inside one `BEGIN/COMMIT` with the
`player_profiles` upsert — both land or neither. **`handle` and `accountId` remain
non-editable** (handle immutable; `accountId` a system identifier).

Both `GET /api/me/profile` (12-key read) and `PATCH /api/me/profile` (recognized
fields gain `displayName`; error set gains `invalid_display_name`) rows in
`api-endpoints.md` were updated whole-row per D-11804.

### Friends & Ranked Trust Layer (Proposed)

> **Status: PROPOSED — not yet scheduled.** No Work Packet is assigned; no
> table, endpoint, or UI for friendships exists at HEAD. This subsection is a
> design charter, recorded so the shape is settled once and decomposed through
> the normal WP-drafting flow rather than re-litigated per packet. Field names
> reuse the identity contract already shipped (above); the schema sketch is
> **illustrative**, not locked.

**Purpose (why this earns 4–6 packets).** The primary purpose of the friendship
graph is **player retention** — enabling intentional multiplayer, repeat play
groups, and durable social ties that bring players back. Its use as a
leaderboard-integrity signal is a *reuse* of the same graph, not its reason for
existing. The profile surface today has authentication (Hanko), a public
profile, an owner profile, badges (WP-105), and **team affiliation**
(WP-109 — cooperative cohorts, migration 010) — but **no peer-to-peer social
graph**: a player cannot find a specific person by name, form a persistent
connection, and reliably pull them into a game. The secondary benefit is that
the same graph lets the leaderboard distinguish an organic co-op crew from an
ad-hoc group of strangers assembled to farm ranked results. (Teams and
friendships are distinct: a team is a named group cohort; a friendship is a
symmetric one-to-one tie. The friend graph is the new primitive.)

**Design invariants.** Numbered so future WPs can cite them (`FR-#` — distinct
from the `F-1`/`F-2` broker-confinement gates elsewhere on this page):

- **FR-1 — Purpose order.** Friendship is a durable social connection first;
  its ranked-integrity role is a reuse of the same graph, never the driver of
  its design.
- **FR-2 — Identity anchor.** Friendships, friend requests, ranked-eligibility
  calculations, invitation targets, notification routes, and audit records
  depend **only** on `AccountId`; discovery uses `@handle`. `display_name` is
  presentation-only and MUST NOT participate in friendship identity or trust
  calculations.
- **FR-3 — Durability.** A friendship survives display-name, avatar, profile,
  handle-display, and team changes; it is identified solely by the two
  `AccountId`s. No presentation-layer field is part of friendship identity.
- **FR-4 — Symmetry.** An accepted friendship is symmetric: if A is a friend of
  B then B is a friend of A. No one-way followers, subscriptions, or
  unidirectional ties.
- **FR-5 — Casual stays frictionless.** Casual play never requires a
  friendship; the gate applies to ranked eligibility only.
- **FR-6 — Objectively computable.** Ranked eligibility is a pure function of
  the accepted-friendship relation over the human-player set at match start —
  no human judgement, no moderation call.
- **FR-7 — Immutable after match start.** Social-graph changes (friend,
  unfriend, block) never retroactively alter a completed run's leaderboard
  eligibility. (Admin/anti-cheat voiding is a separate policy — see *Open
  question* below.)
- **FR-8 — Trust signal, not security guarantee.** The gate raises the cost of
  collusion; it does not eliminate it. No WP may present it as anti-cheat.
- **FR-9 — Human players only.** "Player" in the ranked rule means a human
  seat. AI companions, autoplay bots, replay ghosts, tutorial actors, and
  system seats are excluded from the friendship requirement.

**Identity anchor (FR-2 / FR-3).** Friendship is *discovered* by `@handle` and
*stored* against `AccountId` — never `display_name`. This is the same naming
trap called out in the identity-fields section above: a graph keyed on the
editable name silently corrupts on every rename.

| Concern | Field | Why |
|---|---|---|
| Discovery / search | `@handle` (`handle_canonical`, `^[a-z][a-z0-9_]{2,23}$`, WP-101) | Immutable, globally unique, URL-safe. |
| Storage / trust key | `AccountId` (`ext_id`, opaque UUID, D-5201) | Stable across renames; never re-used. |
| Never a key | `display_name` (editable, non-unique) | A rename would break every relationship, invite, and trust check built on it. |

**Request lifecycle.** Standard symmetric-friendship state machine:

```
Search (@handle) -> Send Request -> Pending -> Accepted | Declined
```

1. Player searches by `@handle` (exact / prefix).
2. Player submits a friend request (subject to the recipient's
   allow-requests preference and block list).
3. Recipient sees the request in a **Pending Requests** list on `?route=me`
   and receives an email via the existing **Brevo enqueue pipeline**
   (`apps/server/src/marketing/brevoEnqueue.logic.ts`) — no new mailer.
4. Recipient **accepts** or **declines**.
5. Acceptance records a mutual, two-way friendship.
6. Either side may **remove** the friendship at any time.

**Illustrative schema — communicates concepts, not an approved design.** The
sketch below exists solely to convey the shape (symmetric tie, pending state,
immutable `ext_id` keys). Column names, indexes, normalization strategy, and
physical implementation remain **WP-owned decisions** — do not treat this as
ratified. It would land as the next migration, `028_*`, following repo
conventions (`legendary.` schema, snake_case, `ext_id` foreign keys, idempotent
`IF NOT EXISTS`):

```
CREATE TABLE IF NOT EXISTS legendary.friendships (
    friendship_id  bigserial   PRIMARY KEY,
    requester_id   text        NOT NULL REFERENCES legendary.players(ext_id),
    addressee_id   text        NOT NULL REFERENCES legendary.players(ext_id),
    status         text        NOT NULL,  -- pending | accepted | declined | blocked
    requested_at   timestamptz NOT NULL DEFAULT now(),
    responded_at   timestamptz,
    UNIQUE (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);
```

**Two-tier multiplayer model.** Friendship is the trust gate for ranked play,
not a barrier to casual play:

| Tier | Invite rule | Playable? | Leaderboard credit |
|---|---|---|---|
| **Casual** | Anyone, by `@handle` or from the friends list — friendship not required | Fully | **No** |
| **Ranked** | Every human player is a mutual friend of every other at match start | Fully | **Yes** |

Casual preserves zero-friction pickup games; ranked adds the trust boundary.

**Ranked eligibility contract.**

*Definition (full clique).* For the set `H` of **human** players in a run
(FR-9), the run is ranked-eligible at match start **iff**:

```
for every pair (A, B) in H with A != B:  accepted_friendship(A, B) = true
```

i.e. `H` forms a complete friendship clique. Full-clique — not merely "friends
of the lobby host" — prevents loose collusion rings around a single ringleader
and makes coordination visible to later analytics. It translates directly to a
query with no interpretation layer. Cost is a non-issue: co-op crews are small,
so the pairwise check is `O(n²)` over a handful of human seats.

*Snapshot (FR-7).* Eligibility is evaluated **exactly once, at match start**,
and stored as immutable run metadata. Subsequent friend / unfriend / block
actions cannot change a completed run's leaderboard eligibility.

*Lobby-mutation rule.* Any change to the human-player set **after** evaluation
(a seat leaves, a new player joins) invalidates the snapshot: the run must be
re-evaluated or demoted to Casual. The exact behavior is a WP decision,
dependent on the final multiplayer / lobby architecture — but a mutated lobby
must never silently retain a stale "eligible" snapshot (this is the exploit the
rule closes).

*Fallback.* If the clique test fails, the run proceeds cleanly as Casual (no
leaderboard credit) rather than being blocked.

> **Governing principle: friendship is a trust signal, not a security
> guarantee.** The clique gate does not eliminate collusion; it raises the cost
> of disposable-account rings and makes coordination detectable after the fact.
> Future WPs should design to that intent and not over-claim it as anti-cheat.

**Reconciliation required at WP-design time** (do not assume during
implementation):

- **Co-op competition model (Vision §23/§24/§25).** Legendary is cooperative —
  players challenge the Mastermind together, never each other. The ranked gate
  must fit that framing (shared victory conditions; how individual leaderboard
  attribution works in a shared win), not import a PvP ladder.
- **Multiplayer scoring (migration 027, `player_count`).** Orthogonal to
  friendship. The clique check belongs in the match-start / scoring-eligibility
  layer; do not conflate it with the scoring migration.
- **Lobby dependency.** Friends-invite-to-game presupposes an N-seat human
  co-op lobby / game-creation flow. Verify current state (match seat accounts,
  migration 024; lobby intake WP-092) and treat it as a hard dependency if it
  is not yet in place.

**Privacy & abuse controls (in scope for the subsystem).** An
allow-friend-requests preference (Everyone / No one, extensible), a block list
(blocked users cannot request, be invited, or appear in the blocker's search),
per-day outgoing-request rate limits, a re-request cooldown after a decline,
and DB-level guards against self / duplicate / cross requests.

**Non-goals (explicitly out of the first subsystem).** Real-time presence /
online status, chat or direct messaging, and a social activity feed — later
retention capabilities the graph *enables* (alongside looking-for-game,
recently-played-with, and Discord community integration, per FR-1), not part of
the initial build. Also a **permanent** non-goal: **social reputation** — no
endorsements, likes, trust scores, karma, or reputation rankings. Friendship
stays a **binary** relation (this also keeps the graph clear of the
cumulative-count ranking inputs §25(a) forbids).

**Open question (owned by the ranked-submission WP, not this charter).** FR-7
freezes eligibility against *social-graph* changes, but does an admin integrity
action — a WP-107 suspension or a confirmed-cheating finding — retroactively
void a completed ranked run's leaderboard credit? WP-107's current posture
keeps historical scores; whether friend-gated ranked runs need a stricter
cheating-invalidation path is unresolved and must not be assumed either way
during implementation.

**Proposed WP breakdown (4–6 packets).**

1. Friendships data model + status machine + mutual-clique query helper
   (migration `028`) — **executed as
   [WP-350](../docs/ai/work-packets/WP-350-friendships-data-model.md)**
   (executed 2026-07-11, D-24142 Active; library-only, no endpoint/UI).
2. Friend-request API (send / accept / decline / remove / list;
   `authenticated-session-required`, per D-9905) — **executed as
   [WP-351](../docs/ai/work-packets/WP-351-friend-request-api.md)**
   (executed 2026-07-11, D-24143 Active; six `/api/me/friends*` routes;
   `FriendSummary` exposes `@handle`, never `accountId`).
3. Profile UI: Friends tab, incoming / sent / pending, add-by-`@handle`
   search — **executed as
   [WP-352](../docs/ai/work-packets/WP-352-friends-profile-ui.md)**
   (executed 2026-07-11, D-24144 Active; owner `?route=me` section,
   `@handle` only, never `accountId`). Privacy controls + block
   list ride on packet #6's models, deferred there.
4. Brevo transactional emails (request received, request accepted) —
   **executed as
   [WP-353](../docs/ai/work-packets/WP-353-friend-request-email-notifications.md)**
   (executed 2026-07-11, D-24145 Active; fail-open,
   fire-and-forget; added the transactional `POST /v3/smtp/email` path the
   contact-list-only Brevo module lacked; real send operator-pending on deploy).
5. Ranked eligibility gate — **executed as
   [WP-354](../docs/ai/work-packets/WP-354-ranked-eligibility-gate.md)**
   (executed 2026-07-11, D-24146 Active): the clique check runs at score
   submission over `readSeatAccounts`, storing `is_ranked_eligible` on
   `competitive_scores` (solo vacuously eligible; fail-safe to Casual); the
   public ranked board filters it, the owner My-Scores read stays unfiltered.
   The charter's *lobby-invite-flow* half is **split into a separate future
   WP** (depends on multiplayer-lobby UX).
6. Abuse controls — **drafted as
   [WP-355](../docs/ai/work-packets/WP-355-friend-abuse-controls.md)**
   (2026-07-11, reserves D-24147; **READY**): a separate `legendary.player_blocks`
   table (block severs friendship), symmetric block enforcement, a per-day
   request cap + re-request cooldown at the send handler. Notification opt-out
   (the WP-353 spam-vector risk) is a separate WP-353-dependent follow-up.

## Interactions

- **[Hugo Web System](hugo-web-system.md)** — the marketing site
  (`www.legendary-arena.com`) is a separate Hugo project in a separate
  repo. None of the *engine* auth Work Packets touch it. Its header links
  to `play`'s auth: marketing **WP-031** added "Sign in" / "My account"
  links (per **D-24084**); **WP-032** collapsed them to a single
  **"Account"** → `?route=me` (the guarded route bounces a signed-out
  visitor to login); and **WP-033** (per **D-24138**, amending D-24084)
  made the header **auth-aware** — a deferred script reads the
  cross-subdomain `hanko` cookie (WP-347) and swaps in the player's name.
  Still no broker wiring and no auth *surface* on `www` — it only READS
  the session.
- **[Operational Health Checks](operational-health-checks.md)** —
  `pnpm check` probes Hanko JWKS / CORS connectivity, which the
  server-side verifier (WP-126 / WP-131) depends on.
- **`apps/server/src/auth/hanko/`** — server-side broker code, confined
  to this directory by the F-2 gate.
- **`apps/arena-client/src/auth/hankoClient.ts`** — client-side broker
  code, the client extension of the same confinement discipline.

## Edge Cases

- **`www` versus `play` — linked + auth-aware, not auth-owning.** The
  sign-in **surface** is present on `play.legendary-arena.com` and absent
  on `www.legendary-arena.com` — by decision (**D-24084**, 2026-06-30, as
  amended by **D-24138**, 2026-07-09): `www` stays a static marketing site
  and **links** to `play`'s auth rather than owning its own. Header
  evolution: **WP-031** added "Sign in" / "My account" links → **WP-032**
  collapsed them to one **"Account"** (`?route=me`; the guarded route
  redirects a signed-out visitor to login) → **WP-033** made the header
  **auth-aware**, reading the cross-subdomain `hanko` cookie (WP-347 /
  D-24137) to greet a signed-in visitor by name. `www` still has no sign-in
  *surface* (form / broker / session mutation) — it only READS an existing
  session (D-24138). Commerce is split the same way: the `www` shop checks
  out via Snipcart (WP-019), in-game purchases via Stripe over the `play`
  Hanko session — neither needs a `www` login.
- **Relative API URLs broke once.** Before WP-161, the SPA issued
  relative `fetch('/api/me/profile', …)` calls that resolved to the
  Pages origin and returned HTML, hanging `MyProfilePage` on
  "Loading…". WP-161 introduced `VITE_API_BASE_URL` + `buildApiUrl()`
  to prefix every API call with the API host. A missing production env
  var fails loud (local-dev fallback is `http://localhost:8000`).
- **Broker name leakage.** The string `'hanko'` must never surface as
  an `auth_provider` value; the federated-IdP mapping outputs only the
  WP-052 enum verbatim. Grep gates assert zero leakage on every commit.
- **Display label — now resolves the real name (WP-305 + WP-330).** Per
  WP-175 the signed-in header label was originally the placeholder
  `"My account"`. **WP-305 / D-24089** added `displayName` +
  `handleCanonical` to `GET /api/me/profile`, and **WP-330 / D-24116** then
  wired `useAuthNav` to fetch the owner profile once and resolve the label
  through the locked fallback chain **`displayName` → `@handleCanonical` →
  `"My account"`** (the last as a non-blocking placeholder shown only until
  the fetch resolves). Because `display_name` is NOT NULL, the real name
  normally wins.
- **Avatar upload has two non-obvious contract catches** (WP-298). First,
  the upload `fetch` must **not** set a `Content-Type` header — the browser
  sets `multipart/form-data; boundary=…` itself, and a manual `Content-Type`
  drops the boundary so the server rejects the body as `invalid_mime_type`.
  Second, the avatar endpoint's failure body is `{ code, message }`, **not**
  the `{ error }` shape the sibling `/api/me/profile` endpoints use; the
  client reads `body.code`, and the client-local `AVATAR_UPLOAD_ERROR_CODES`
  mirror (`invalid_mime_type` / `file_too_large` / `rate_limited` /
  `upload_failed` / `unauthorized`) is drift-guarded by a test against the
  server union. Reusing the profile endpoints' parser here would silently map
  every avatar error to `null`.

## Open Questions

- **Login on `www` — RESOLVED by [D-24084](../docs/ai/DECISIONS.md)
  (2026-06-30), extended by [D-24138](../docs/ai/DECISIONS.md) (2026-07-09).**
  The marketing site does **not** gain its own sign-in surface; it stays a
  static Hugo bundle and **links** to the existing Hanko sign-in on `play`.
  It is now, however, auth-**aware**: **D-24138** amended D-24084 so `www`
  may *read* the (cross-subdomain, WP-347) `hanko` session to personalize
  the header — executed by marketing **WP-033** (a deferred cookie-read
  script; no Hanko SDK on `www`, so the Lighthouse baseline is untouched).
  Header lineage on `www`: WP-031 (two links) → **WP-032** (one "Account"
  link) → **WP-033** (greets by name when signed in). Commerce needs no
  `www`-owned login either (shop via Snipcart WP-019; in-game via
  Stripe-on-Hanko). The marketing site is independently governed and uses no
  EC layer, so its execution is WP-031/WP-032/WP-033, not engine-repo WPs;
  the engine repo holds only the decisions (D-24084 / D-24138) + the
  cross-subdomain-cookie enabler (WP-347 / D-24137). Product guidance:
  account copy stays passwordless. **Open:** the Hanko App URL / passkey
  rpID is being corrected separately (operator runbook, INFRA #644) — it is
  independent of the session-read above.

## References

- [WP-160 — Hanko Client UI](../docs/ai/work-packets/WP-160-hanko-client-ui.md)
  — production sign-in surface for arena-client.
- [WP-161 — Arena Client API Base URL](../docs/ai/work-packets/WP-161-arena-client-api-base-url.md)
- [WP-174 — First-Sign-In Auto-Provisioning](../docs/ai/work-packets/WP-174-first-signin-auto-provisioning.md)
- [WP-175 — Arena Client Auth-Aware Navigation](../docs/ai/work-packets/WP-175-arena-client-auth-nav.md)
- [WP-102 — Public Player Profile Page](../docs/ai/work-packets/WP-102-public-profile-page.md)
  — read-only profile (route wired by [WP-152](../docs/ai/work-packets/WP-152-wire-public-profile-route.md)).
- [WP-104 — Owner Profile Data Model & `/me` Edit](../docs/ai/work-packets/WP-104-owner-profile-data-model-and-me-edit.md)
  — owner profile + edit; migration 009.
- [WP-296 — Avatar CDN Host Unification](../docs/ai/work-packets/WP-296-avatar-cdn-host-unification.md)
  — avatars moved to `images.legendary-arena.com` (D-24083).
- [WP-298 — Owner Profile Avatar Upload UI](../docs/ai/work-packets/WP-298-owner-profile-avatar-upload-ui.md)
  — file-upload control wiring the `POST /api/me/avatar` pipeline into
  `MyProfilePage.vue` (consumes D-10601 / D-10602 / D-24083; no new D-entry).
- [WP-159 — Admin Session Gate](../docs/ai/work-packets/WP-159-admin-session-gate.md)
- [WORK_INDEX.md](../docs/ai/work-packets/WORK_INDEX.md) — Auth Stack and
  Profile Surface dependency trees.
- `apps/arena-client/src/stores/auth.ts` — client auth store.
- `apps/arena-client/src/auth/hankoClient.ts` — client broker wrapper.
- `apps/server/src/auth/hanko/` — server-side Hanko verifier.
