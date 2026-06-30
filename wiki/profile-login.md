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
related:
  - operational-health-checks.md
  - hugo-web-system.md
  - data-file-locations.md
  - r2-image-naming-convention.md
status: draft
source:
  - ../docs/ai/work-packets/WP-102-public-profile-page.md
  - ../docs/ai/work-packets/WP-104-owner-profile-data-model-and-me-edit.md
  - ../docs/ai/work-packets/WP-160-hanko-client-ui.md
  - ../docs/ai/work-packets/WP-161-arena-client-api-base-url.md
  - ../docs/ai/work-packets/WP-174-first-signin-auto-provisioning.md
  - ../docs/ai/work-packets/WP-175-arena-client-auth-nav.md
  - ../docs/ai/work-packets/WP-296-avatar-cdn-host-unification.md
  - ../docs/ai/work-packets/WORK_INDEX.md
last-reviewed: 2026-06-30
---

# Profile Login

## Summary

The player sign-in and profile surface for Legendary Arena. The whole
auth stack — broker selection, server-side session verification,
first-sign-in provisioning, the client login UI, and the profile
pages — ships into the **arena-client** app, which deploys to
`play.legendary-arena.com`. The marketing site at
`www.legendary-arena.com` is a separate Hugo project
([Hugo Web System](hugo-web-system.md)) and currently has no sign-in
surface of its own.

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
| Auth-aware nav | WP-175 | "Sign in" / "My profile" / "Sign out" element in the header. |

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

WP-175 then added the auth-aware navigation element to
`BrandHeader.vue`: signed-out shows a "Sign in" link, signed-in shows a
display label plus "My profile" and "Sign out".

### Profile surface

The user profile is **two distinct pages plus layered data**, all
rendered in **arena-client** and read through the same authenticated API.
Like the login screen, none of it lives in the marketing repo:

| Surface | Work Packet | Route / location | What it is |
|---------|-------------|------------------|------------|
| Public profile (read-only) | WP-102 (route wired by WP-152) | by player handle | `PublicProfileView` (closed field shape); returns **404** on no-match. |
| Owner profile + edit | WP-104 | `?route=me` → `MyProfilePage.vue` | The signed-in player's own editable profile. Migration `009_create_player_profiles_and_links.sql` creates `legendary.player_profiles` + `legendary.player_links`; `PATCH /api/me/profile` is the edit path. |
| Team affiliation | WP-109 | both profile views | Profile-level cooperative cohorts; extends `PublicProfileView` (4→5 keys) and `OwnerProfileView` (7→8 keys). |
| Badges | WP-105 | both profile views | Tier-1 gameplay badges (migration 013); fire-and-forget issuance in the competition pipeline. |
| Avatar | WP-106 — **host unified by [WP-296](../docs/ai/work-packets/WP-296-avatar-cdn-host-unification.md)** | owner profile | `POST /api/me/avatar` upload pipeline. Avatars are served from `https://images.legendary-arena.com/avatars/{accountId}.webp` — the **same** Cloudflare custom domain + `legendary-images` R2 bucket as card images, unified under **D-24083** (WP-296, 2026-06-30). The legacy `images.barefootbetters.com` avatar host is retired; `AVATAR_CDN_BASE`, the closed-origin `validateAvatarUrl` allowlist, and existing `avatar_url` rows (migration 021) all moved. See [R2 Image Naming Convention](r2-image-naming-convention.md). |
| Billing & funding history | WP-108 | `BillingSection` in `MyProfilePage.vue` | Benefits / purchase history / community funding panels; `GET /api/me/billing/history`. |
| Integrity / anti-cheat | WP-107 | admin-only | `/api/admin/players/:handle/` suspend / integrity / unsuspend endpoints over profiles. |

The header's "My profile" link (WP-175) points at `?route=me`; the
public profile is reached by handle. The `www.legendary-arena.com` Hugo
content tree (`content/`: `about`, `brand`, `shop`, `tournaments`,
`leaderboard`, `posts`, `emails`, `diorama`) contains **no profile or
login surface** — confirming the play-vs-www split below.

## Interactions

- **[Hugo Web System](hugo-web-system.md)** — the marketing site
  (`www.legendary-arena.com`) is a separate Hugo project in a separate
  repo. None of the auth Work Packets touch it, which is why login does
  not appear there.
- **[Operational Health Checks](operational-health-checks.md)** —
  `pnpm check` probes Hanko JWKS / CORS connectivity, which the
  server-side verifier (WP-126 / WP-131) depends on.
- **`apps/server/src/auth/hanko/`** — server-side broker code, confined
  to this directory by the F-2 gate.
- **`apps/arena-client/src/auth/hankoClient.ts`** — client-side broker
  code, the client extension of the same confinement discipline.

## Edge Cases

- **`www` versus `play` confusion.** Login is present on
  `play.legendary-arena.com` and absent on `www.legendary-arena.com`.
  This is a consequence of where the WPs landed (arena-client only),
  not a broken deploy or a regression — no Work Packet has ever added a
  sign-in surface to the marketing repo.
- **Relative API URLs broke once.** Before WP-161, the SPA issued
  relative `fetch('/api/me/profile', …)` calls that resolved to the
  Pages origin and returned HTML, hanging `MyProfilePage` on
  "Loading…". WP-161 introduced `VITE_API_BASE_URL` + `buildApiUrl()`
  to prefix every API call with the API host. A missing production env
  var fails loud (local-dev fallback is `http://localhost:8000`).
- **Broker name leakage.** The string `'hanko'` must never surface as
  an `auth_provider` value; the federated-IdP mapping outputs only the
  WP-052 enum verbatim. Grep gates assert zero leakage on every commit.
- **Display label placeholder.** Per WP-175, the signed-in label was
  `"My account"` until the server `/api/me/profile` response was
  extended with identity fields; verify the current response shape
  before relying on the displayed name.

## Open Questions

- **Login on `www` — RESOLVED by [D-24084](../docs/ai/DECISIONS.md) (2026-06-30).**
  The marketing site does **not** gain its own sign-in surface; it stays
  a static Hugo bundle and **links** to the existing Hanko sign-in on
  `play` (`?route=login`) and profile (`?route=me`). Commerce needs no
  `www`-owned login either (the shop checks out via Snipcart, WP-019; in-game
  purchases via Stripe-on-Hanko). The link affordance is executed by the
  **marketing repo's WP-031** (`C:\www\legendary-arena-com`) — two
  `[[menu.main]]` entries in its `hugo.toml` — which completes the "Log In"
  entry the marketing repo's WP-027 deferred. (The marketing site is
  independently governed and uses no EC layer, so the execution is its WP-031,
  not an engine-repo WP; the engine repo holds only the decision.) Product
  guidance: account copy stays passwordless ("Manage sign-in methods", not
  "change password"). No open auth-surface questions remain for `www`.

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
- [WP-159 — Admin Session Gate](../docs/ai/work-packets/WP-159-admin-session-gate.md)
- [WORK_INDEX.md](../docs/ai/work-packets/WORK_INDEX.md) — Auth Stack and
  Profile Surface dependency trees.
- `apps/arena-client/src/stores/auth.ts` — client auth store.
- `apps/arena-client/src/auth/hankoClient.ts` — client broker wrapper.
- `apps/server/src/auth/hanko/` — server-side Hanko verifier.
