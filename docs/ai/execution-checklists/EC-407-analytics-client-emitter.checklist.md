# EC-407 — Analytics Client Emitter (Arena Client) (Execution Checklist)

> **Status:** PROPOSED — EC-407 (next free; highest allocated is EC-406).
> **Source WP:** [WP-378](../work-packets/WP-378-analytics-client-emitter.md).

**Layer:** App (`apps/arena-client/src/**`)

## Scope (read first)
IN scope: the fire-and-forget `analyticsEmitter`, the pure `channelClassifier`,
the single `useAnalyticsCapture` reactive hub (mounted once in `App.vue`), and the
`signup-start` register-CTA emit in `LoginPage.vue`. OUT of scope: any server /
engine / registry / preplan edit (the capture endpoint + table + reads already
exist, WP-205/206); www marketing-site capture (separate repo, fast-follow);
server-derived first-match/retention detection (v1 is client-local); a consent
banner; new event types.

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it
- [ ] WP-378 §Pre-Flight Verdict = READY; D-24173..D-24175 reserved
- [ ] `POST /api/analytics/events` is live + **guest** (`analytics.routes.ts:450/456`); payload shape `{ event_type, user_id, session_id, timestamp, properties? }` (`analytics.types.ts:115`)
- [ ] The nine `event_type` values confirmed against `ACQUISITION_EVENT_TYPES` / migration 017 CHECK
- [ ] `buildApiUrl` seam present (`apps/arena-client/src/lib/api/apiBaseUrl.ts`) with the `import.meta.env?.` node:test guard
- [ ] Resolve the live store signals before wiring the hub: the auth-store first-authenticated transition (`signup-complete`) and the match-store first-match state (`first-match-started/completed`) — inspect the actual stores, do NOT guess an internal
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; `pnpm --filter @legendary-arena/arena-client test` runs

## Locked Values (do not re-derive)
- Endpoint: `POST /api/analytics/events`, **guest** (NO bearer); `keepalive: true`
- Event set (only these nine): `direct`, `search`, `referral`, `paid`, `signup-start`, `signup-complete`, `first-match-started`, `first-match-completed`, `retention-return`
- Payload: `{ event_type, user_id, session_id, timestamp, properties? }` single, or `{ events: [...] }` batch
- `user_id`: RAW internal account id, or `null` for anonymous — the client **NEVER** hashes (server hashes, D-20502)
- `session_id`: `crypto.randomUUID()` stored in `sessionStorage` (create-or-read); opaque; not the account id
- `timestamp`: `Date.now()` (client capture time; the route bounds it server-side)
- `properties`: channel/funnel metadata only — NO email / handle / display-name / card contents
- Retention threshold: `retention-return` fires only for an authenticated user whose `localStorage` last-visit stamp is ≥ 1 day (86_400_000 ms) old
- Channel rule (D-24175): no/same-origin referrer → `direct`; `utm_medium ∈ {cpc,ppc,paid}` OR `gclid` present → `paid`; referrer host in the known search-engine set → `search`; else → `referral`
- First-match guard: `localStorage` flags gate a single `first-match-started` + single `first-match-completed` per device (D-24174, non-authoritative)

## Guardrails
- Capture is **silent, fire-and-forget**: every failure is caught → no-op; NEVER throws into a caller, surfaces to the UI, or blocks a click
- The emitter imports **nothing** from game-engine / registry / server / preplan / boardgame.io — inline the `AcquisitionEventType` union structurally (grep-gated)
- The client **NEVER** hashes `user_id` (no `createHash` / `sha256` / `subtle.digest`)
- Only the nine closed-set event types are ever emitted — no tenth
- No PII in `properties`
- Instrumentation is centralized: exactly **one** `useAnalyticsCapture()` mount in `App.vue`; the only other in-component edit is the `LoginPage.vue` `signup-start` emit — NOT scattered across match/turn components
- `channelClassifier` is pure (deterministic, side-effect free, independently testable)

## Required `// why:` Comments
- emitter POST site — why fire-and-forget + `keepalive: true` + swallow-all (analytics must never block or surface to the player)
- emitter `user_id` field — why RAW not hashed (server hashes at the route boundary, D-20502)
- session-id site — why `sessionStorage` + opaque `crypto.randomUUID()` (per-session, carries no identity)
- `useAnalyticsCapture` first-match / last-visit gates — why client-local `localStorage` for v1 (non-authoritative, D-24174) + the re-count caveat
- `signup-complete` watch — why it distinguishes a first authenticated transition from a returning sign-in

## Files to Produce
- `apps/arena-client/src/lib/api/analyticsEmitter.ts` — **new** — `captureAnalyticsEvent` + `getAnalyticsSessionId` + inline `AcquisitionEventType`
- `apps/arena-client/src/lib/api/analyticsEmitter.test.ts` — **new** — payload build; raw + null `user_id`; swallowed failure; stable session id; correct path
- `apps/arena-client/src/lib/api/channelClassifier.ts` — **new** — pure `classifyChannel(referrer, params)`
- `apps/arena-client/src/lib/api/channelClassifier.test.ts` — **new** — all four channels incl. same-origin/`gclid`/search-host/unknown-host
- `apps/arena-client/src/composables/useAnalyticsCapture.ts` — **new** — mount-time channel + retention; auth-store `signup-complete`; match-store first-match
- `apps/arena-client/src/composables/useAnalyticsCapture.test.ts` — **new** — channel-once; retention threshold; first-match single-fire; signup-complete vs returning sign-in
- `apps/arena-client/src/App.vue` — **modified** — invoke `useAnalyticsCapture()` once in setup
- `apps/arena-client/src/pages/LoginPage.vue` — **modified** — `signup-start` on the register CTA
- `docs/ai/DECISIONS.md` — **modified** — land D-24173 (emitter architecture + privacy posture), D-24174 (client-local detection v1), D-24175 (channel taxonomy)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` (WP-378) / `EC_INDEX.md` (EC-407) / `05-ROADMAP-MINDMAP.md` (📝 node + `pnpm roadmap:counts:write`) — **modified**

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` green
- [ ] `rg "game-engine|@legendary-arena/(registry|server|preplan)|boardgame" apps/arena-client/src/lib/api/analyticsEmitter.ts apps/arena-client/src/lib/api/channelClassifier.ts apps/arena-client/src/composables/useAnalyticsCapture.ts` → zero
- [ ] `rg "createHash|sha256|subtle\.digest" apps/arena-client/src/lib/api/analyticsEmitter.ts` → zero
- [ ] `rg "useAnalyticsCapture" apps/arena-client/src/App.vue` → exactly 1
- [ ] Live D-24026: a real sign-in / first match on `arena.legendary-arena.com` yields a non-empty row on the matching `dashboard.legendary-arena.com/players` widget (operator-pending on deploy)
- [ ] D-24173..D-24175 Active; STATUS / WORK_INDEX / EC_INDEX / mindmap updated
- [ ] Commit prefix `EC-407:` (staged files under `apps/arena-client/` + `docs/`)

## Common Failure Smells
- Widgets still empty after deploy → emitter posting to the wrong base/path, or `VITE_API_BASE_URL` unset on the arena-client Pages project (fallback localhost never reaches prod)
- A click or navigation hangs → capture not fire-and-forget (awaited / thrown), or `keepalive` missing on a nav-time event
- Funnel step double-counts → `localStorage` first-match flag not set, or `signup-complete` firing on every sign-in instead of the first authenticated transition
- 400 from the endpoint → an out-of-set `event_type`, a `session_id` outside 1–128 chars, or a `timestamp` beyond the server's +5min bound
- Identity leak → client hashed `user_id`, or PII placed in `properties`
- Cross-layer import slips in → emitter/classifier reached into engine/server for a type instead of the inline structural union
