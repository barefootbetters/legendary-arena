---
title: Guest Accounts
type: System
tags:
  - auth
  - guest
  - layer-server
  - arena-client
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
  - ../apps/server/src/match/addGuestRoutes.mjs
  - ../apps/server/src/competition/competition.logic.ts
  - ../apps/server/src/auth/sessionToken.logic.ts
  - ../apps/arena-client/src/auth/routeAuthPolicy.ts
  - ../apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts
  - ../data/migrations/004_create_players_table.sql
  - ../data/migrations/017_create_analytics_events.sql
  - ../data/migrations/024_create_match_seat_accounts.sql
  - ../data/migrations/033_create_match_bot_ally.sql
  - ../docs/ai/work-packets/WP-499-join-by-match-id.md
  - ../docs/ai/work-packets/WP-627-guest-seat-host-add.md
  - ../docs/ai/work-packets/WP-628-add-guest-lobby-button.md
  - ../docs/ai/work-packets/WP-629-guest-lobby-button-and-persistent-link.md
  - ../docs/ai/REFERENCE/api-endpoints.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-08-31
---

# Guest Accounts

## Summary

"Guest access" means letting a person occupy a match seat **without
creating an account** — so a group at one table can just play. Two candidate
designs were weighed — a shared guest-account pool (**Candidate A**) and a
host-created guest seat (**Candidate B**) — and the platform **chose and shipped
Candidate B** on 2026-08-31 ([D-24437](../docs/ai/DECISIONS.md), WP-627 / 628 /
629). A signed-in host clicks **Add guest**, the server secret-joins one
anonymous "Player N" seat exactly as the bot-ally flow does (no
`match_seat_accounts` row, match demoted to Casual), and the host hands the
seat's credential URL to the guest for same-device / local hand-off. Candidate A
was **rejected** — a shared public credential is an attack surface the
geo-block and usage log existed only to *contain*, and Candidate B removes the
credential rather than policing it ([D-24437](../docs/ai/DECISIONS.md)).
This page documents the current reality, the shipped mechanism, and the one
piece deliberately left deferred (a remote, device-bound seat-bind link). It is
**descriptive**: it cites the decisions and Work Packets that govern guest play;
it does not itself establish direction.

## Mechanics

### At a glance

| Question | Answer today |
|---|---|
| Can a person sit without an account? | **Yes** — a signed-in host adds a guest seat via `POST /api/match/add-guest` (WP-627). Self-serve sign-up-free create/join still requires a Hanko session. |
| Does `GuestIdentity` do anything in production? | **No** — defined, unwired, never minted. The shipped guest seat does **not** use it (it is a rowless bot-ally-style seat, not a `GuestIdentity`). |
| Can a seat render as "Player N"? | Yes — and the shipped add-guest seat is exactly this: no `match_seat_accounts` row, so it renders "Player N". |
| Can a guest submit competitively? | **No** — refused on server, client, and via the Casual match tag; a guest seat is `guest_not_eligible`. |
| Closest shipped precedent | Bot-ally: host-initiated secret-join, no `match_seat_accounts` row, match tagged non-ranked — the mechanism add-guest reuses. |
| Decision | **Settled — Candidate B** ([D-24437](../docs/ai/DECISIONS.md)); shipped as WP-627 (server) + WP-628 / WP-629 (client hand-off). Candidate A rejected. |

### Current state vs proposed

**Implemented today:**

- **Host-created guest seats ship (Candidate B).** A signed-in host calls
  `POST /api/match/add-guest` (WP-627), which secret-joins one anonymous seat
  and returns its `{ seat, credentials }`; the client (WP-628 / WP-629) builds
  a `?match&player&credentials` hand-off URL and offers "Open guest seat" /
  "Copy guest link" from the lobby.
- A guest seat writes **no `match_seat_accounts` row**, so it renders
  **"Player N"** and demotes the match to Casual via
  `computeRankedEligibility` rule 2 (`roster.length !== seatCount`) — no
  `match_bot_ally` row, no marker, **no migration**.
- `GuestIdentity` is defined but **unwired** — nothing mints one at runtime,
  and the shipped guest seat does not use it.
- Competitive submission **excludes** guest seats three ways
  (`guest_not_eligible`, client no-token status, Casual match tag).

**Rejected / deferred:**

- Candidate A (shared guest-account pool) was **rejected** — see
  [D-24437](../docs/ai/DECISIONS.md) and the comparison below.
- A remote, **device-bound seat-bind link** (a guest joining from their own
  distant device without the raw credential in a shareable URL) is **deferred**
  as new protocol work — see [Open Questions](#open-questions).

The decision is recorded in [D-24437](../docs/ai/DECISIONS.md) (server) and
[D-24438](../docs/ai/DECISIONS.md) (client hand-off). The rest of this section
is the detail behind those lines.

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

Counting the two candidate designs below, the single word **"guest"** would
carry five distinct meanings:

| Term | Meaning | Status |
|---|---|---|
| `GuestIdentity` | Ephemeral, no-row anonymous identity type | Implemented (unwired) |
| Guest traffic | Unauthenticated analytics events | Implemented |
| Guest submission status | Client-side no-token gameover state | Implemented |
| Guest seat | A non-account match participant | Proposed (Candidate B) |
| Shared pool account | A reusable shared-credential account | Proposed (Candidate A) |

The naming overload — and why a new feature under the bare name "guest"
would collide with the shipped `isGuest` / `guest_not_eligible` vocabulary —
is discussed under Edge Cases.

### The self-serve auth gate — and the one exception

To occupy a seat **on your own** you must have a real account.
`POST /api/match/create` and `POST /api/match/join`
([matchGate.routes.ts](../apps/server/src/match/matchGate.routes.ts)) both
resolve an authenticated `AccountId` as their first business step; no valid
Hanko session returns `401`. On the client,
[routeAuthPolicy.ts](../apps/arena-client/src/auth/routeAuthPolicy.ts)
lets anyone *spectate* the lobby, but bounces a signed-out user to
`?route=login` the moment they try to create or join. So a guest cannot
sit down *unaided*.

**The shipped exception is host-initiated.** `POST /api/match/add-guest`
(WP-627) is the one path that seats a person without an account — but it is
gated on an **authenticated host** who is already a participant in the match
(a `readSeatAccounts` participant check), not on the guest. The guest never
authenticates; the host vouches for the seat and hands off its credential. So
the gate still holds for self-serve play — the guest is admitted only through
a signed-in host's action, never on their own.

Join-by-match-ID (WP-499,
[WP-499-join-by-match-id.md](../docs/ai/work-packets/WP-499-join-by-match-id.md))
lets any *account holder* join by pasting an ID or link, but it still runs
through the same authenticated `POST /api/match/join`.

### Existing precedent — bot-ally seats

The engine **already** secret-joins a non-account seat — the "Add bot"
flow, `POST /api/match/create-with-bot`
([botAllyRoutes.mjs](../apps/server/src/bot-ally/botAllyRoutes.mjs)). Its
characteristics:

- An authenticated **host** initiates creation.
- An internal delegation secret joins the extra seats (no player session).
- **No `match_seat_accounts` row** is written for those seats (per
  `DECISIONS.md` D-24120) — exactly the "Player N" shape above.
- The match is tagged **non-ranked** by a
  [match_bot_ally](../data/migrations/033_create_match_bot_ally.sql) row.
- The seat renders without a player account.

This demonstrates that the platform already supports occupancy of a match
seat without creating a user account. Both candidate designs below build on
this precedent.

### Candidate designs

Two shapes solve "let people play without accounts." They differ mainly in
whether a **shared credential** exists.

#### Candidate A — a shared guest-account pool (`guest01`…`guest05`) — **rejected**

A small fixed pool of real accounts — five is the practical ceiling
(five-player max table). Each is an ordinary
[players](../data/migrations/004_create_players_table.sql) row provisioned
as the `email` auth provider (e.g. `guest01@legendary-arena.com`), so it
reuses the entire session / seat stack unchanged. A host hands out (or the
kiosk auto-fills) a shared guest password; the guest signs in and plays.
This shape is what motivates the operational controls below:

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

#### Candidate B — a host-side "Add guest" seat (bot-ally clone) — **shipped**

This is the design the platform chose and shipped ([D-24437](../docs/ai/DECISIONS.md);
server WP-627, client WP-628 / WP-629). The host, already signed in, clicks
**Add guest**; the server (`POST /api/match/add-guest`,
[addGuestRoutes.mjs](../apps/server/src/match/addGuestRoutes.mjs)) runs a
participant gate, reads occupancy from the bgio **metadata** (never a raw
`G` / `ctx` read), finds the lowest free seat, enforces a per-match
`MAX_GUEST_SEATS_PER_MATCH` (= 4) cap, then secret-joins that seat via the
WP-308 internal-delegation header exactly as `create-with-bot` does — writing
**no** `match_seat_accounts` row (so it renders "Player N") and demoting the
match to Casual. **No shared password is ever minted** — there is no guest login
path, so there is nothing to leave switched on and nothing to leak. The endpoint
returns the seat's `{ seat, credentials }`; the client (WP-628 / WP-629,
[D-24438](../docs/ai/DECISIONS.md)) turns that into a
`?match&player&credentials` hand-off URL surfaced from the lobby seat list as
"Open guest seat" (new-tab hot-seat) and "Copy guest link" (a second local
device), plus a persistent link for the seat. **Scope is host hot-seat /
physical hand-off only** — a guest joining from a distant device of their own is
outside this scope (see [Open Questions](#open-questions)).

#### Comparison

| Dimension | A — shared pool | B — add-guest seat |
|---|---|---|
| New credentials | 5 shared logins | **None** |
| Attack surface | A public guest-login path | None (seat minted only when an authenticated host asks) |
| Geo-block needed | Yes — to contain the shared credential | No path to protect |
| Usage log needed | Yes — to detect leak / left-on | Optional (host is already identified) |
| Build cost | New accounts + login lockdown + log + WAF rule | Clone `create-with-bot` with a human driver |
| Reuses shipped machinery | Session/seat stack | Session/seat stack **and** the bot-ally secret-join |
| Concurrent tables | Pool of 5 is a **deployment-wide** cap unless the pool grows | Limited only by match size and host action |
| Durable identity | Yes — a real `players` row, so surfaces must be locked down | No account, so no profile / friends / loadout state |
| Typical UX | Kiosk, or "here is the guest password" | Host adds a seat; guest uses the host screen or a handoff link |

The geo-block and usage log exist to *contain* the risk that a shared
public credential creates. Candidate B eliminates that shared-credential
risk entirely, because no guest login exists to attack; Candidate A retains
the credential and adds controls to contain it. **This is why B was chosen**
([D-24437](../docs/ai/DECISIONS.md)): removing the credential removes the risk
rather than policing it, and B's seats are minted per match on demand instead
of drawing from a deployment-wide pool of five. Candidate A's flexibility
(dedicated, namable accounts and a reusable kiosk login) did not outweigh that
simplicity. Candidate A is retained here as the rejected alternative for the
record, not as a live option.

### Shared constraints (any guest design)

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
  Candidate A's shared accounts this means locking those surfaces down; for
  Candidate B there is no account to carry state at all.

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
  for Candidate A (house / kiosk / shared-pool seat) avoids conflating the
  two.
- **Shared credential left on or leaked (Candidate A).** The scenario the
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
- **One pool slot, two tables (Candidate A).** If Hanko / session / seat
  binding assumes one live occupant per account, two tables cannot both be
  `guest03` — so a pool of five is a **deployment-wide** cap, not a
  per-match one. Kick-previous-session vs. reject-the-second-login vs.
  grow-the-pool is undecided.
- **Candidate B's handoff client is not one thing.** "Plays on the host's
  screen" and "a handed-off join link" are different products. A join link
  that still requires Hanko is not guest play; a link that binds a seat to a
  device with no account is **new protocol work on top of the bot-ally
  clone**, not a free part of it.
- **How many guest seats per match.** One extra human vs. filling the table.
  The guest analogue of bot-fill needs an **explicit cap** so a host cannot
  launder a ranked lobby by seating guests.

## Open Questions

The load-bearing decision — *which shape* — is settled: Candidate B, shipped
([D-24437](../docs/ai/DECISIONS.md); WP-627 / 628 / 629). What remains open is
one deliberately-deferred extension and a couple of second-order questions. Each
would be settled in `DECISIONS.md` and a Work Packet, not here.

- **Remote, device-bound seat-bind link (deferred).** Today's hand-off puts the
  seat credential in a `?match&player&credentials` URL — sound for same-device /
  local hand-off, which is all WP-627 scoped ([D-24438](../docs/ai/DECISIONS.md)).
  A guest joining from their own *distant* device would want a link that binds a
  seat to a device without exposing the raw credential in a shareable URL. That
  is genuinely new protocol on top of the bot-ally clone, not a free part of it,
  and stays deferred to a future client WP.
- **Per-match guest cap value.** The shipped cap is
  `MAX_GUEST_SEATS_PER_MATCH = 4`; whether that is the right ceiling for every
  table size is a tuning question the endpoint centralizes.
- **`is_guest` analytics hygiene.** There is still no `is_guest` database column;
  separating guest-seat activity from real-player analytics remains net-new work
  if it is ever wanted (the shipped guest seat has no `players` row at all, so it
  does not pollute the accounts table).

Candidate A (shared pool) is **not** an open question — it was rejected. The
questions that were conditional on choosing it (Hanko rows vs dedicated path,
pool marking, geo-block scope, concurrency policy) no longer apply.

## History

- **D-24437 / WP-627 / EC-662** (Active 2026-08-31) — chose Candidate B over
  Candidate A and shipped the server endpoint `POST /api/match/add-guest`: a
  host-initiated, rowless, non-ranked anonymous seat cloning the bot-ally
  secret-join, with a `MAX_GUEST_SEATS_PER_MATCH` cap. Candidate A (shared pool)
  rejected.
- **D-24438 / WP-628 / EC-663** (Active 2026-08-31) — the client hand-off: an
  `addGuest` wrapper in `lobbyApi.ts` plus an "Add guest" control in
  `WaitingForPlayersPanel.vue` that builds the `?match&player&credentials` URL
  and offers "Open guest seat" / "Copy guest link". Client-only; no new endpoint
  or auth mechanism.
- **WP-629** (2026-08-31) — moved "Add guest" into the lobby seat list and added
  a persistent hand-off link (a guest filling the seat had been auto-hiding the
  link).
- **D-24120** — the prior art this reuses: a bot seat carries no
  `match_seat_accounts` row and seat 0 is never a bot.

## References

- Guest-seat endpoint and hand-off —
  [addGuestRoutes.mjs](../apps/server/src/match/addGuestRoutes.mjs),
  [api-endpoints.md](../docs/ai/REFERENCE/api-endpoints.md)
  (`POST /api/match/add-guest` row),
  [WP-627](../docs/ai/work-packets/WP-627-guest-seat-host-add.md),
  [WP-628](../docs/ai/work-packets/WP-628-add-guest-lobby-button.md),
  [WP-629](../docs/ai/work-packets/WP-629-guest-lobby-button-and-persistent-link.md)
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
- Decisions referenced — [DECISIONS.md](../docs/ai/DECISIONS.md) (D-24437
  Candidate B choice + `add-guest` endpoint; D-24438 client hand-off; D-24120
  the bot seat carrying no `match_seat_accounts` row)
- Related surfaces — [Profile Login](profile-login.md),
  [Play Board](play-board.md), [Leaderboard](leaderboard.md),
  [Data & File Locations](data-file-locations.md)
