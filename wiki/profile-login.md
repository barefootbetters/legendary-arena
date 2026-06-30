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
status: draft
source:
  - ../docs/ai/work-packets/WP-160-hanko-client-ui.md
  - ../docs/ai/work-packets/WP-161-arena-client-api-base-url.md
  - ../docs/ai/work-packets/WP-174-first-signin-auto-provisioning.md
  - ../docs/ai/work-packets/WP-175-arena-client-auth-nav.md
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

The profile pages are a parallel chain rooted in the identity model:
public read-only profile (WP-102), owner profile and `/me` edit
(WP-104), team affiliation (WP-109), badges, avatar upload, and billing
history (WP-105 through WP-108). These all render in arena-client and
read through the same authenticated API surface.

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

- **Login on `www` is not yet captured in a Work Packet or DECISION.**
  Whether the marketing site should gain its own sign-in surface, or
  instead link/redirect to `play.legendary-arena.com/?route=login`, is
  an open product question. This page only records the current state
  (www has no sign-in surface); it does not make that decision — design
  decisions belong in [DECISIONS.md](../docs/ai/DECISIONS.md) and a
  future Work Packet.

## References

- [WP-160 — Hanko Client UI](../docs/ai/work-packets/WP-160-hanko-client-ui.md)
  — production sign-in surface for arena-client.
- [WP-161 — Arena Client API Base URL](../docs/ai/work-packets/WP-161-arena-client-api-base-url.md)
- [WP-174 — First-Sign-In Auto-Provisioning](../docs/ai/work-packets/WP-174-first-signin-auto-provisioning.md)
- [WP-175 — Arena Client Auth-Aware Navigation](../docs/ai/work-packets/WP-175-arena-client-auth-nav.md)
- [WP-159 — Admin Session Gate](../docs/ai/work-packets/WP-159-admin-session-gate.md)
- [WORK_INDEX.md](../docs/ai/work-packets/WORK_INDEX.md) — Auth Stack and
  Profile Surface dependency trees.
- `apps/arena-client/src/stores/auth.ts` — client auth store.
- `apps/arena-client/src/auth/hankoClient.ts` — client broker wrapper.
- `apps/server/src/auth/hanko/` — server-side Hanko verifier.
