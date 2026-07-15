# WP-378 — Analytics Client Emitter: Feed the Acquisition/Activation/Retention Funnel (Arena Client)

**Status:** Draft 2026-07-14 · **PROPOSED (WP-378; highest live WP is 377)** · **Standard two-session lane** (D-24028 — NOT lightweight: net-new client subsystem + reactive instrumentation across multiple call sites + three reserved D-locks incl. a privacy posture). Pairs with **EC-407** (authored). Reserves **D-24173..D-24175** (land at execution).
**Primary Layer:** App (`apps/arena-client/src/**` only — no server, engine, registry, or preplan edit).
**User-Visible Surface:** `dashboard.legendary-arena.com/players` — the three analytics widgets (Traffic Sources, Activation Funnel, Retention Cohorts) populate once the arena client emits events. The **arena-client surface itself has no player-visible change** (capture is silent, fire-and-forget). **D-24026 live-verify APPLIES on the dashboard surface** (generate a real event — a fresh sign-in / a first match on `arena.legendary-arena.com` — then observe a non-empty row on the dashboard widget).
**Dependencies:** WP-205 / EC-233 (`POST /api/analytics/events` guest capture endpoint + `legendary.analytics_events` table + the 9-value `AcquisitionEventType` closed set — the producer target this packet fills) ✅; WP-203 / WP-206 (dashboard analytics read endpoints + LIVE-flip widgets — the consumers that render what this packet produces) ✅; WP-161 / D-16101 (`buildApiUrl` / `apiBaseUrl.ts` client base-URL seam) ✅; the arena-client auth store + match store this packet observes (`App.vue`, the Hanko session surface) ✅.
**Baseline:** `origin/main` @ `275dec78` (capture `git rev-parse origin/main` again at execution).

---

## Goal

The analytics ingestion pipeline is built server-side (WP-205: a guest capture
endpoint, the `analytics_events` table, and three aggregation reads) and the
dashboard widgets consume it — but **nothing writes events**, so Traffic
Sources / Activation Funnel / Retention Cohorts render "No data captured." This
packet adds the missing **producer**: a small arena-client emitter that POSTs to
the already-live `POST /api/analytics/events` at the moments the nine
`AcquisitionEventType` values describe, lighting up all three widgets with real
data.

---

## User-Visible Impact

No change a **player** can see — capture is silent and fire-and-forget; a failed
POST never surfaces in the UI and never blocks a click. The observable change is
on the **operator dashboard**: after a visitor lands, signs up, plays a first
match, or returns a day later, the corresponding widget on
`dashboard.legendary-arena.com/players` stops reading empty and shows real
channel / funnel / cohort rows.

---

## Assumes

- **`POST /api/analytics/events` is live, `guest`, and accepts the emitter's
  payload shape.** WP-205 wired it in `apps/server/src/server.mjs`
  (`registerAnalyticsRoutes`); the guest posture (`analytics.routes.ts:450/456`)
  means anonymous pre-signup channel events post with **no bearer**. Single-event
  body is `{ event_type, user_id, session_id, timestamp, properties? }`
  (`analytics.types.ts:115`, `AnalyticsEventCapturePayload`); a batch is
  `{ events: [...] }`. (Verified.)
- **The nine `event_type` values are a frozen closed set** enforced at four
  layers (union + canonical array + SQL CHECK + route validator, D-20501):
  `direct`, `search`, `referral`, `paid`, `signup-start`, `signup-complete`,
  `first-match-started`, `first-match-completed`, `retention-return`
  (`migration 017`; `ACQUISITION_EVENT_TYPES`). The emitter must send only these.
  (Verified.)
- **`user_id` is hashed at the route boundary, never client-side** (D-20502) — the
  client sends the **raw** internal account id (or `null` for anonymous events);
  the server computes the SHA-256 digest before INSERT. The client must never
  hash. (Verified.)
- **`buildApiUrl(path)` is the client's base-URL seam** (`apiBaseUrl.ts`, WP-161 /
  D-16101), with the `import.meta.env?.` node:test guard already established. The
  emitter prefixes `/api/analytics/events` through it. (Verified.)
- **The dashboard analytics widgets are already LIVE and authenticate** (WP-206 +
  the #742 apiClient-bearer fix) — the moment this packet supplies rows, the
  widgets render them with no further dashboard change. (Verified.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `apps/server/src/analytics/analytics.routes.ts` + `analytics.types.ts` +
  `data/migrations/017_create_analytics_events.sql` — the producer target: guest
  POST, the payload shape, the 9-value closed set, the hashed-`user_id` posture.
- `apps/arena-client/src/lib/api/apiBaseUrl.ts` — the base-URL seam (`buildApiUrl`)
  and the `import.meta.env?.` node:test guard the emitter mirrors.
- `apps/arena-client/src/lib/api/friendsApi.ts` / `ownerProfileApi.ts` — the
  typed-`fetch` client-API idiom (no engine/server/framework imports; inline
  structural types); the emitter follows it.
- `docs/ai/DECISIONS.md` D-20501..D-20503 (analytics schema / body caps / envelope),
  D-16101 (`buildApiUrl`) — scan for related analytics entries before adding
  D-24173..D-24175.
- `docs/01-VISION.md` — the identity-ownership boundary (~§ lines 140-155; NG-8):
  analytics must not accrete social-network semantics and must not let an auth
  provider define identity.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; `.test.ts`; full-sentence errors; `// why:` on non-obvious choices;
  JSDoc on every function; no branching `.reduce()`; explicit control flow.
- App layer only. The emitter imports **nothing** from the game engine, registry,
  preplan, boardgame.io, or any server package — same layer-boundary contract the
  EC grep enforces on every `lib/api/*.ts` module.

**Packet-specific:**
- **Only the nine closed-set `event_type` values may be emitted.** Never invent a
  tenth; the value list is a locked mirror of `ACQUISITION_EVENT_TYPES`.
- **The client sends `user_id` RAW and NEVER hashes it** (D-20502 hashes
  server-side). Anonymous events send `user_id: null`.
- **Capture is silent and fire-and-forget.** A rejected/failed POST is swallowed
  (caught → no-op) and MUST NOT surface to the UI, throw into a caller, or block
  any user action. Use `keepalive: true` so an in-flight event survives navigation.
- **No PII in `properties`.** Channel/funnel metadata only (e.g. referrer host,
  utm medium) — never email, display name, handle, or raw card/loadout contents.
- **Session id is opaque and per-session** — `crypto.randomUUID()` stored in
  `sessionStorage`, regenerated per browser session; it is not the account id and
  carries no identity.
- **First-match / retention detection is client-local for v1** — `localStorage`
  flags/timestamps, per-device, explicitly non-authoritative (D-24174).
- **Instrumentation is centralized in one composable** (`useAnalyticsCapture`)
  mounted once in `App.vue`, observing existing stores reactively — call sites are
  NOT scattered across match/turn components. The only additional in-component edit
  is the `signup-start` emit on the register CTA (`LoginPage.vue`).

**Session protocol:**
- If the exact reactive signal for `signup-complete` (first authenticated session
  vs. returning sign-in) or `first-match-started` (match-store state) is ambiguous
  against the live store shape, resolve it against the actual store at execution —
  do not guess a store internal.

---

## Scope (In)

### A) `analyticsEmitter.ts` (`apps/arena-client/src/lib/api/analyticsEmitter.ts`, new)
- `captureAnalyticsEvent(eventType: AcquisitionEventType, properties?: Record<string, unknown>): void` — builds the payload (`user_id` from the caller-supplied account id or `null`; `session_id` from the sessionStorage session id; `timestamp: Date.now()`), POSTs to `buildApiUrl('/api/analytics/events')` with `keepalive: true`, and swallows all failures silently.
- A local `AcquisitionEventType` union declared inline (structural mirror of the server's 9-value set — the layer boundary forbids importing the server type), plus `getAnalyticsSessionId()` (create-or-read the opaque sessionStorage id).
- Never imports engine/server/framework code; never hashes `user_id`; never throws.

### B) `channelClassifier.ts` (`apps/arena-client/src/lib/api/channelClassifier.ts`, new)
- Pure `classifyChannel(referrer: string, params: URLSearchParams): 'direct'|'search'|'referral'|'paid'` — deterministic, side-effect free, independently testable. Rule table locked in **D-24175** (no/same-origin referrer → `direct`; paid-medium UTM or `gclid` → `paid`; known search-engine host → `search`; else `referral`).

### C) `useAnalyticsCapture.ts` (`apps/arena-client/src/composables/useAnalyticsCapture.ts`, new)
- The single reactive instrumentation hub, invoked once from `App.vue`'s setup. On mount: classify the channel from `document.referrer` + `location` UTM params and emit the channel event; read the `localStorage` last-visit stamp and, for an authenticated user returning after ≥1 day, emit `retention-return`; refresh the stamp. Watches the auth store for the first-authenticated-session transition → `signup-complete`. Watches the match store for the player's first-ever match start/end (guarded by `localStorage` first-match flags) → `first-match-started` / `first-match-completed`.

### D) Instrumentation edits
- `App.vue` — invoke `useAnalyticsCapture()` once in setup (the only mount point).
- `LoginPage.vue` — emit `signup-start` when the visitor opens the register flow (the funnel's top step).

### E) Tests
- `analyticsEmitter.test.ts`: builds the correct payload; sends `user_id` raw + `null` for anon; a rejected fetch is swallowed (no throw); session id is stable within a session; posts to the `/api/analytics/events` path.
- `channelClassifier.test.ts`: each of the four channels for representative referrer/UTM inputs, incl. same-origin → `direct`, `gclid` → `paid`, a search host → `search`, an unknown host → `referral`.
- `useAnalyticsCapture.test.ts`: channel emit fires once on mount; `retention-return` fires only for an authed user past the day threshold; first-match flags gate a single `first-match-started`/`first-match-completed`; `signup-complete` fires on the first authenticated transition, not on a returning sign-in.

---

## Out of Scope

- **www marketing-site capture** — the true top-of-funnel referrer/UTM at first
  marketing-site landing lives in the separate `C:\www\legendary-arena-com` repo;
  a fast-follow WP per `reference_dual_repo_layout`. This packet captures the
  channel at **arena-client** landing only, and says so on the widget.
- **Server-derived (authoritative) first-match / retention detection** — v1 is
  client-local `localStorage` (D-24174); a future variant reading
  `competitive_scores` / session history is explicitly deferred.
- **Any server, engine, registry, or preplan edit** — the capture endpoint, the
  table, and the reads all already exist and are untouched.
- **A consent banner / cookie-gate UI** — the v1 posture is first-party analytics
  with a hashed user id and an opaque session id (D-24173); a banner, if desired,
  is a separate product decision.
- **New event types** — the nine-value set is frozen; no tenth.

---

## Files Expected to Change

- `apps/arena-client/src/lib/api/analyticsEmitter.ts` — **new** — the emitter + session id
- `apps/arena-client/src/lib/api/analyticsEmitter.test.ts` — **new**
- `apps/arena-client/src/lib/api/channelClassifier.ts` — **new** — pure referrer/UTM → channel
- `apps/arena-client/src/lib/api/channelClassifier.test.ts` — **new**
- `apps/arena-client/src/composables/useAnalyticsCapture.ts` — **new** — reactive instrumentation hub
- `apps/arena-client/src/composables/useAnalyticsCapture.test.ts` — **new**
- `apps/arena-client/src/App.vue` — **modified** — invoke `useAnalyticsCapture()` once
- `apps/arena-client/src/pages/LoginPage.vue` — **modified** — `signup-start` on the register CTA
- Governance: `WORK_INDEX.md` (WP-378) + `EC_INDEX.md`/EC-407 + `DECISIONS.md` (**D-24173..D-24175**) + `STATUS.md` + `05-ROADMAP-MINDMAP.md` (📝 node) at execution-prep.

---

## Contract

| Key | Value |
|---|---|
| Producer target | `POST /api/analytics/events`, **guest** (no bearer); body `{ event_type, user_id, session_id, timestamp, properties? }` single, or `{ events: [...] }` batch |
| Event set | the frozen nine `AcquisitionEventType` values only (mirror of `ACQUISITION_EVENT_TYPES`); no tenth |
| `user_id` | RAW internal account id, or `null` for anonymous; server hashes (D-20502) — client NEVER hashes |
| Session id | opaque `crypto.randomUUID()` in `sessionStorage`; not the account id; carries no identity |
| Failure posture | fire-and-forget; all errors swallowed; `keepalive: true`; never surfaces to UI, never blocks a click |
| `properties` | channel/funnel metadata only — no email/handle/display-name/card contents |
| Detection (v1) | first-match + retention = client-local `localStorage`, non-authoritative (D-24174) |
| Channel rule | referrer + UTM → `direct`/`search`/`referral`/`paid` per the D-24175 table |
| Layer | `apps/arena-client` only; no engine/server/registry/preplan/framework import |

---

## Acceptance Criteria

1. `analyticsEmitter.captureAnalyticsEvent` builds a payload with the raw `user_id` (or `null`), the sessionStorage session id, and `Date.now()`, and POSTs it to `buildApiUrl('/api/analytics/events')` with `keepalive: true` (**AC-1**).
2. A rejected or failed POST is swallowed — no throw, no unhandled rejection, no UI effect (**AC-2**).
3. `classifyChannel` returns the locked channel for each representative input: same-origin/empty referrer → `direct`, paid-medium/`gclid` → `paid`, a known search host → `search`, any other host → `referral` (**AC-3**).
4. On app mount the channel event fires exactly once; `retention-return` fires only for an authenticated user whose last visit is ≥1 day old; the last-visit stamp is refreshed (**AC-4**).
5. `first-match-started` and `first-match-completed` each fire at most once per device (guarded by `localStorage` flags); `signup-complete` fires on the first authenticated-session transition, not on a returning sign-in; `signup-start` fires from the register CTA (**AC-5**).
6. Only the nine closed-set `event_type` values are ever emitted; no engine/server/framework import appears in any new `lib/api` or composable module (grep-clean) (**AC-6**).
7. `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; `pnpm --filter @legendary-arena/arena-client test` green; a real sign-in / first match on `arena.legendary-arena.com` produces a non-empty row on the matching `dashboard.legendary-arena.com/players` widget (D-24026) (**AC-7**).

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# no cross-layer imports in the new modules:
Select-String -Path "apps\arena-client\src\lib\api\analyticsEmitter.ts","apps\arena-client\src\lib\api\channelClassifier.ts","apps\arena-client\src\composables\useAnalyticsCapture.ts" -Pattern "game-engine|@legendary-arena/(registry|server|preplan)|boardgame"  # zero
# client never hashes user_id:
Select-String -Path "apps\arena-client\src\lib\api\analyticsEmitter.ts" -Pattern "createHash|sha256|subtle\.digest"  # zero
# emitter mounted once:
Select-String -Path "apps\arena-client\src\App.vue" -Pattern "useAnalyticsCapture"  # exactly 1
git diff --name-only
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Emitter posts to the guest endpoint fire-and-forget, swallows failure, sends `user_id` raw, uses an opaque sessionStorage session id
- [ ] Channel classifier is pure + covers all four channels; only the nine closed-set event types are emitted
- [ ] Instrumentation centralized in `useAnalyticsCapture` (one `App.vue` mount) + the `signup-start` register-CTA emit; no scattered per-component call sites
- [ ] No engine/server/registry/preplan/framework import in any new module (grep-clean)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` 0; arena-client test green
- [ ] Live D-24026: a real event on `arena.legendary-arena.com` produces a non-empty dashboard analytics row (operator-pending on deploy)
- [ ] `DECISIONS.md` **D-24173..D-24175** landed; `WORK_INDEX` (WP-378) + `EC_INDEX`/EC-407 + `STATUS.md` + `05-ROADMAP-MINDMAP.md` updated

---

## Vision Alignment

**Vision clauses touched:** the identity-ownership boundary (~§ lines 140-155 —
"authentication providers verify access; they never define identity"; profile
surfaces never accrete social-network semantics) and **NG-8** (no
OAuth-derived identity / social-network semantics). **Conflict assertion:** No
conflict — analytics keys on an opaque per-session id and a server-hashed
internal account id; it accretes **no** social-network semantics (no followers,
likes, influence) and never lets an auth provider define identity. **Non-Goal
check:** the `paid` value is inbound **traffic-source attribution**, not an
outbound funding/monetization surface — no NG-1..7 monetization proximity.
**Determinism:** N/A to the engine — no engine/RNG/persistence/replay surface is
touched; the client session id uses the browser `crypto.randomUUID()`, outside
any deterministic-replay path.

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. Highlights — **§5** bounded (6 new + 2 modified
code files, single package); **§8** app-layer boundary (no engine/server/registry/
framework import — grep-gated); **§11** N/A (the emitter uses the **guest**
capture endpoint — no auth model introduced; authenticated events merely include
the already-issued account id in the body); **§12** `node:test` + no
boardgame.io imports; **§15.1** APPLIES — surface is the dashboard analytics
widgets, D-24026 live-verify on that surface; **§17** identity boundary + NG-8
addressed above (no conflict); **§20** N/A — no donate/support-tournament
affordance; the `paid` channel is inbound attribution, not an outbound funding
surface; **§21** N/A — no `apps/server` endpoint or `Library-only` function is
added/modified/removed/re-statused; this packet adds a client **producer** for
the already-cataloged `POST /api/analytics/events`, whose row and Status are
unchanged.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight: READY TO EXECUTE** — all dependencies are Done on `main` (WP-205
capture endpoint + table; WP-203/206 dashboard reads/widgets; WP-161
`buildApiUrl`). The producerless gap is verified (grep for
`api/analytics/events` callers in non-server code returns zero). Contract is
frozen and source-verified (payload shape, guest posture, 9-value set,
hashed-`user_id`). Two reactive signals (`signup-complete` transition,
`first-match-started` store state) are the only execution-time resolutions and
are locked to "resolve against the live store, do not guess" (RS-1). Scope is
locked to 8 arena-client files; no cross-layer surface.

**Copilot: PASS.** Failure modes pinned: (a) analytics failure blocks a player →
**silent fire-and-forget, swallow-all, tested** (AC-2); (b) client hashes/leaks
identity → **raw `user_id`, server hashes (D-20502); opaque session id; no PII in
properties; NG-8 non-conflict**; (c) layer creep (emitter reaches engine/server)
→ **grep-gated boundary, inline structural type**; (d) event-type drift → **nine
closed-set values only, mirror of `ACQUISITION_EVENT_TYPES`**; (e) scattered
instrumentation rots → **one composable, one `App.vue` mount**; (f)
double-counting funnel steps → **`localStorage` first-match flags + last-visit
threshold, tested**. RS-1 (store-signal exactness) is decided-and-locked:
resolve against the live store at execution, never guess a store internal.

## Decision (reserved, lands at execution)

Reserves **D-24173** (client analytics emitter architecture: fire-and-forget POST
to the guest capture endpoint; opaque per-session `crypto.randomUUID()` session
id in sessionStorage; raw `user_id` in the body with server-side hashing per
D-20502; silent-failure posture — analytics never surfaces to the player or
blocks UX; first-party privacy posture — hashed user id, opaque session id, no
PII in `properties`, no consent-banner gate in v1), **D-24174** (client-local,
non-authoritative funnel-state detection for v1: first-match and retention-return
derived from `localStorage` flags/timestamps, per-device; documents the
re-count-on-new-device caveat and the server-derived upgrade path), and
**D-24175** (channel classification taxonomy: referrer + UTM → `direct`/`search`/
`referral`/`paid`; locks the rule table). Drafted 2026-07-14; not yet landed.
