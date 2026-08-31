---
title: Guest Accounts
type: System
tags:
  - auth
  - guest
  - layer-server
  - arena-client
  - planning
related:
  - profile-login.md
  - play-board.md
  - leaderboard.md
  - data-file-locations.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\guest-accounts.md (this page — https://ewiki.legendary-arena.com/guest-accounts/)
  - ../apps/server/src/identity/identity.types.ts
  - ../apps/server/src/identity/identity.logic.ts
  - ../apps/server/src/match/matchGate.routes.ts
  - ../apps/server/src/match/seatAccount.logic.ts
  - ../apps/server/src/bot-ally/botAllyRoutes.mjs
  - ../apps/server/src/competition/competition.logic.ts
  - ../apps/server/src/auth/sessionToken.logic.ts
  - ../apps/arena-client/src/auth/routeAuthPolicy.ts
  - ../apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts
  - ../data/migrations/004_create_players_table.sql
  - ../data/migrations/017_create_analytics_events.sql
  - ../data/migrations/024_create_match_seat_accounts.sql
  - ../data/migrations/033_create_match_bot_ally.sql
  - ../docs/ai/work-packets/WP-499-join-by-match-id.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-08-31
---

# Guest Accounts

## Summary

"Guest access" means letting a person occupy a match seat **without
creating an account** — so a group at one table can just play. No such
path exists today: every seat requires a Hanko sign-in, and the word
"guest" already names three unrelated, mostly-unwired things in the code.
This page maps that reality and lays out two **proposed** designs for real
guest play — a shared guest-account pool and a host-side "Add guest" seat —
and records the tradeoffs. It proposes options; it reserves no `WP-` / `D-`
and makes no decision — a future Work Packet owns any build.

## Mechanics

### "Guest" today — three disconnected forms

There is no single guest feature. The word is reused for three things
that do not connect to each other, and none of them is a persistent
shared login:

| Form | Where | State |
|---|---|---|
| Ephemeral `GuestIdentity` type | [identity.types.ts](../apps/server/src/identity/identity.types.ts) — `{ guestSessionId, createdAt, isGuest: true }`, an in-memory identity with **no `legendary.players` row** | **Defined but unwired.** `createGuestIdentity` in [identity.logic.ts](../apps/server/src/identity/identity.logic.ts) has no production caller — nothing mints one at runtime. |
| Client "no-token" status | [useCompetitiveSubmitOnGameover.ts](../apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts) — a signed-out player at gameover gets `submissionStatus = 'guest'` | Shipped. It only means "no bearer token" → show a sign-in prompt, never submit. This is the "scored-card gated" behaviour. |
| Derived "Player N" seat | [seatAccount.logic.ts](../apps/server/src/match/seatAccount.logic.ts) — a seat with **neither a `match_seat_accounts` row nor a bot tag** renders as a plain "Player N" | Shipped as a rendering path, but **no code creates such a seat** for a human today, because joining requires auth (below). |

A fourth, unrelated use: the analytics ingest `POST /api/analytics/events`
is deliberately unauthenticated ("guest" traffic) so pre-signup visitors
can be counted; it persists no identity.

There is **no `is_guest` database column anywhere** — the analytics-hygiene
flag that would separate guest activity from real players does not exist
yet; it would be net-new.

### Why there is no guest play today — the auth gate

To occupy a seat you must have a real account. `POST /api/match/create`
and `POST /api/match/join`
([matchGate.routes.ts](../apps/server/src/match/matchGate.routes.ts)) both
resolve an authenticated `AccountId` as their first business step; no valid
Hanko session returns `401`. On the client,
[routeAuthPolicy.ts](../apps/arena-client/src/auth/routeAuthPolicy.ts)
lets anyone *spectate* the lobby, but bounces a signed-out user to
`?route=login` the moment they try to create or join. So a guest cannot
sit down at all. Join-by-match-ID (WP-499,
[WP-499-join-by-match-id.md](../docs/ai/work-packets/WP-499-join-by-match-id.md))
lets any *account holder* join by pasting an ID or link, but it still runs
through the same authenticated `POST /api/match/join`.

### The ready-made template — the bot-ally seat

The engine already secret-joins a **non-account seat**: the "Add bot"
flow. `POST /api/match/create-with-bot`
([botAllyRoutes.mjs](../apps/server/src/bot-ally/botAllyRoutes.mjs))
authenticates the human host, then joins the bot seats using an internal
delegation secret rather than a player session. A bot seat deliberately
gets **no `match_seat_accounts` row** (per `DECISIONS.md` D-24120), which
is exactly the "Player N" shape above, and the match is tagged non-ranked
by the presence of a
[match_bot_ally](../data/migrations/033_create_match_bot_ally.sql) row.
Both proposals below lean on this machinery.

### Two proposals for real guest play

Two shapes solve "let people play without accounts." They differ mainly in
whether a **shared credential** exists.

#### Proposal A — a shared guest-account pool (`guest01`…`guest05`)

A small fixed pool of real accounts — five is the practical ceiling
(five-player max table). Each is an ordinary
[players](../data/migrations/004_create_players_table.sql) row provisioned
as the `email` auth provider (e.g. `guest01@legendary-arena.com`), so it
reuses the entire session / seat stack unchanged. A host hands out (or the
kiosk auto-fills) a shared guest password; the guest signs in and plays.
This is the model that motivates the operational controls Jeff sketched:

- **A lean server-side usage log** — one row per guest sign-in / seat use:
  slot (`guest03`), timestamp, and IP or derived country. Its purpose is
  *visibility*: if `guest03` signs in at 3 a.m. from the other side of the
  world, the enable switch was left on or the password leaked, and without
  a log you would never know. It belongs in a **new per-match side table**
  in the `match_*` family (the next number is `044`, alongside
  [match_seat_accounts](../data/migrations/024_create_match_seat_accounts.sql)
  (024) and [match_bot_ally](../data/migrations/033_create_match_bot_ally.sql)
  (033)) — **not** in the closed 7-column
  [analytics_events](../data/migrations/017_create_analytics_events.sql)
  schema, and kept separate from real-player analytics for the same reason
  the `is_guest` flag would exist. Client IP is net-new: nothing persists it
  today; it would be read from the Koa request at the guest-join handler.
- **An edge geo-block** — a single Cloudflare WAF rule scoped to the guest
  login path, blocking traffic whose country is not the United States, so
  foreign traffic never reaches the app. One rule can hold both the country
  test and the path test in one expression, which fits inside the free
  plan's five-custom-rule budget. Country-level, not state-level:
  geo-IP is reliable at country and sloppy at state, so an "Idaho-only" rule
  would lock out the operator's own family on mobile data.

#### Proposal B — a host-side "Add guest" seat (bot-ally clone)

The host, already signed in, clicks **Add guest**; the server secret-joins
an anonymous seat exactly as `create-with-bot` does, writes **no**
`match_seat_accounts` row (so it already renders "Player N"), and tags the
match non-ranked. The guest plays on the host's screen or a handed-off
join link. **No shared password is ever minted** — there is no guest login
path, so there is nothing to leave switched on and nothing to leak.

#### Comparison

| Dimension | A — shared pool | B — add-guest seat |
|---|---|---|
| New credentials | 5 shared logins | **None** |
| Attack surface | A public guest-login path | None (seat minted only when an authenticated host asks) |
| Geo-block needed | Yes — to contain the shared credential | No path to protect |
| Usage log needed | Yes — to detect leak / left-on | Optional (host is already identified) |
| Build cost | New accounts + login lockdown + log + WAF rule | Clone `create-with-bot` with a human driver |
| Reuses shipped machinery | Session/seat stack | Session/seat stack **and** the bot-ally secret-join |

The geo-block and usage log exist to *contain* the risk that a shared
public credential creates. Proposal B removes the credential, so it removes
that risk rather than containing it — which is why the existing
architecture favours it.

### The lockdown and non-ranked gate (shared by both)

Whichever shape is chosen, a guest seat must be walled off from anything
that assumes a durable identity:

- **Never ranked / never competitively scored.** Competitive submission
  already refuses a guest three ways: the `guest_not_eligible` guard in
  [competition.logic.ts](../apps/server/src/competition/competition.logic.ts),
  the client `'guest'` no-token status, and the non-ranked match tag a
  bot-ally-style seat carries. Ranked eligibility is a full-clique-of-humans
  test (see [Profile Login](profile-login.md)); a guest seat must be treated
  the way bot seats already are — excluded.
- **Nothing durable to reset.** If a guest seat cannot edit a profile, add
  friends, or save loadouts, it accumulates no state, so "reset between
  uses" becomes a non-issue by construction rather than a cleanup job. For
  Proposal A's shared accounts this means locking those surfaces down; for
  Proposal B there is no account to carry state at all.

## Interactions

- **[Profile Login](profile-login.md)** — the authentication stack this
  page sits against: the Hanko broker, the `email | google | discord`
  provider enum (a guest pool account would be an `email` row, no enum
  change), first-sign-in provisioning, and the existing guest submission
  gating.
- **[Play Board](play-board.md)** — renders a seat with no account as
  "Player N", and the `UIState` audience filter governs what a guest seat
  may see; any guest-visible field still passes the same whitelist.
- **[Leaderboard](leaderboard.md)** — zero-auth public read (a guest can
  view it), but a guest seat is never a *source* of a ranked row.
- **Bot-ally machinery** —
  [botAllyRoutes.mjs](../apps/server/src/bot-ally/botAllyRoutes.mjs) and the
  [match_bot_ally](../data/migrations/033_create_match_bot_ally.sql) table
  are the template for a secret-joined, non-account, non-ranked seat.
- **[Data & File Locations](data-file-locations.md)** — locator for the
  `legendary.*` tables a pool account or a usage-log table would live in.

## Edge Cases

- **Name collision with `isGuest`.** The shipped `GuestIdentity` /
  `isGuest` / `guest_not_eligible` vocabulary already means *ephemeral,
  no-row anonymous identity* — the opposite of a persistent shared pool
  account. A pool built under the bare name "guest account" would collide
  with that vocabulary and the `is_guest` analytics intent. A distinct name
  for Proposal A (house / kiosk / shared-pool seat) avoids conflating the
  two.
- **Shared credential left on or leaked (Proposal A).** The scenario the
  usage log exists to catch: a guest slot signing in at an implausible hour
  from an unexpected country signals the enable switch was left on or the
  password escaped. The geo-block narrows the window; the log makes it
  visible after the fact.
- **State-level geo-IP is unreliable.** Country resolution is dependable;
  state/region resolution is not — a state-scoped rule risks blocking
  legitimate local players on mobile networks. Country-level US is the
  correct granularity.
- **Guest at gameover.** A guest seat hitting gameover sees the existing
  sign-in prompt (`submissionStatus = 'guest'`), never a competitive
  submission — no special-casing required.
- **A guest seat in a would-be-ranked lobby.** The human-only clique rule
  for ranked eligibility must count a guest the way it counts a bot: a seat
  that keeps the match Casual. Silently letting a guest seat satisfy the
  clique would be an exploit.

## Open Questions

- **Which proposal** — the lower-risk host-side add-guest seat (B), the
  shared pool Jeff sketched (A), or both for different contexts (kiosk /
  in-person vs. remote handoff)? No decision is recorded; a Work Packet
  should own it.
- **If Proposal A: real Hanko rows or a bypass?** Provisioning five
  `email` accounts reuses everything but means shared passwords inside the
  Hanko model; the alternative is a dedicated non-Hanko guest sign-in path
  (more surface, more control). Undecided.
- **The `is_guest` marker.** If pool accounts ship, how are they marked out
  of real analytics and hard-gated from ranked — a new `players` column, or
  a small allowlist of the five `ext_id`s checked at the gates? Undecided.
- **Exact geo-block path scope.** Which route(s) the WAF expression pins to
  (`play.` guest-login path only) so real players elsewhere are unaffected.
- **Governance.** No `WP-` / `D-` is reserved for guest play yet. This page
  is descriptive of today plus a recorded proposal; the design decision
  belongs in `DECISIONS.md` and a Work Packet before any of it is built.

## References

- Identity types and the ephemeral guest skeleton —
  [identity.types.ts](../apps/server/src/identity/identity.types.ts),
  [identity.logic.ts](../apps/server/src/identity/identity.logic.ts)
- The authenticated play gate —
  [matchGate.routes.ts](../apps/server/src/match/matchGate.routes.ts),
  [routeAuthPolicy.ts](../apps/arena-client/src/auth/routeAuthPolicy.ts),
  [sessionToken.logic.ts](../apps/server/src/auth/sessionToken.logic.ts)
- The non-account seat template —
  [botAllyRoutes.mjs](../apps/server/src/bot-ally/botAllyRoutes.mjs),
  [seatAccount.logic.ts](../apps/server/src/match/seatAccount.logic.ts),
  [match_bot_ally](../data/migrations/033_create_match_bot_ally.sql) (033),
  [match_seat_accounts](../data/migrations/024_create_match_seat_accounts.sql) (024)
- Competitive gating —
  [competition.logic.ts](../apps/server/src/competition/competition.logic.ts),
  [useCompetitiveSubmitOnGameover.ts](../apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts)
- Accounts and analytics schema —
  [004_create_players_table.sql](../data/migrations/004_create_players_table.sql),
  [017_create_analytics_events.sql](../data/migrations/017_create_analytics_events.sql)
- Identity-agnostic join —
  [WP-499-join-by-match-id.md](../docs/ai/work-packets/WP-499-join-by-match-id.md)
- Decisions referenced — [DECISIONS.md](../docs/ai/DECISIONS.md) (D-24120,
  the bot seat carrying no `match_seat_accounts` row)
- Related surfaces — [Profile Login](profile-login.md),
  [Play Board](play-board.md), [Leaderboard](leaderboard.md),
  [Data & File Locations](data-file-locations.md)
