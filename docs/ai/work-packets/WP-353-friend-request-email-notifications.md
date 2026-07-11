# WP-353 — Friend-Request Email Notifications (Brevo transactional) (Server)

**Status:** Draft 2026-07-10 · **BLOCKED on WP-351** (hard dep — the send/accept route handlers are the trigger site; WP-351 is drafted, not executed). **Standard two-session lane** (D-24028 — NOT lightweight: new transactional-mail capability + a new fail-open boundary + route/`server.mjs` wiring). Pairs with **EC-383** (authored at execution-prep). Reserves **D-24145** (lands at execution).
**Primary Layer:** Server (`apps/server` — `marketing` + `friendships`)
**User-Visible Surface:** email inboxes (a friend-request / request-accepted transactional email). **D-24026 live-verify APPLIES** (a real Brevo send, deferred until WP-351 is deployed with `BREVO_*` configured).
**Dependencies:** **WP-351** (packet #2 — the `/api/me/friends*` route handlers that fire the notification) ⛔ *drafted, not executed*; WP-350 (packet #1 — `AccountId`s + `legendary.friendships`) ✅ **Done (PR #672)**; WP-293 (the Brevo `fetch`-adapter + fail-open pattern + `BREVO_API_KEY`) ✅; WP-174 (verified email captured to `legendary.players.email` at provisioning) ✅.
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution — **must be after WP-351 merged**).

---

## Goal

When a player receives a friend request, and when their sent request is accepted, send them a **transactional email** — fire-and-forget, fail-open, never blocking or failing the friend-request itself. This packet adds the missing transactional-email capability (`POST /v3/smtp/email`) to the marketing layer as a new injectable adapter (the existing Brevo module only adds contacts to a marketing list — there is **no** transactional send today), plus a `friendshipNotifications` module that resolves the recipient's email + the actor's `@handle`/display name and enqueues the email, and wires a fire-and-forget call into WP-351's send/accept handlers. This is the **notification half** of the Friends & Ranked Trust subsystem (charter FR-1…FR-9, lifecycle step 3).

---

## User-Visible Impact

A player whose account has a verified email receives "**{actor} sent you a friend request**" when someone adds them, and "**{actor} accepted your friend request**" when their sent request is accepted. Nothing about the friend-request API's behavior changes — the email is a side effect that never delays or fails the request (fail-open). Copy is social, not competitive (no match/opponent/win framing, §23(b)).

---

## Assumes

- **WP-351 is Done and its route handlers exist.** `friendships.routes.ts` has a `POST /api/me/friends/requests` handler (after `sendFriendRequest` → notify the **addressee**) and a `POST …/requests/:handle/accept` handler (after `acceptFriendRequest` → notify the **original requester**). This packet adds a fire-and-forget call at those two success points + one injected dependency. ⛔ *At draft time WP-351 is not executed — this packet is BLOCKED until it is.*
- **The Brevo module has no transactional-send path.** `BrevoClient` (`brevoClient.types.ts`, WP-293) exposes only `addContactToList` (`POST /v3/contacts`); `createBrevoClient` implements only that. This packet adds a **separate** transactional adapter (`POST /v3/smtp/email`) and does **not** modify `brevoClient.types.ts` (WP-293's locked contract stays byte-identical). (Verified: `apps/server/src/marketing/brevoClient.types.ts`, `brevoEnqueue.logic.ts`.)
- **The fail-open + injectable-provider pattern is fixed.** `enqueuePlayerToMarketingList` is the single fail-open boundary (never throws; unconfigured client → clean no-op, D-24077 / D-24080); `createBrevoClient(apiKey, fetchImpl = fetch)` is the caller-injected adapter (D-5306). The new transactional sender + notification boundary mirror both exactly. (Verified: `brevoEnqueue.logic.ts`.)
- **`BREVO_API_KEY` is resolved at startup and the client is injected.** `server.mjs` resolves `BREVO_API_KEY` (+ `BREVO_LIST_ID`) and builds `createBrevoClient(...)` at boot, injecting it into the provisioning path; an empty/invalid config warns and disables enqueue. The transactional sender reuses `BREVO_API_KEY` and is built + injected the same way. (Verified: `apps/server/src/server.mjs:233,702`.)
- **Recipient email + actor identity are on `legendary.players`.** `email` (NOT NULL, WP-174), `display_handle`, `display_name`. The notification resolves them by `ext_id`. (Verified: migrations 004/008.)

If WP-351 is not Done, or any of the above is false, this packet is **BLOCKED** and must not execute.

---

## Context (Read First)

- [`wiki/profile-login.md` §Friends & Ranked Trust Layer (Proposed)](../../../wiki/profile-login.md) — the charter; lifecycle step 3 ("receives an email via the Brevo enqueue pipeline") is this packet. **Correction locked here:** that pipeline is contact-list-only today; this packet adds the transactional-send path.
- `docs/ai/work-packets/WP-351-friend-request-api.md` — the routes this packet hooks. **Do not change the endpoint request/response contract** — only add a fire-and-forget side effect + one injected dep.
- `apps/server/src/marketing/brevoEnqueue.logic.ts` + `brevoClient.types.ts` — the fail-open boundary + `fetch`-adapter + injectable-provider precedent to mirror **verbatim** (D-24077 / D-24080 / D-5306). **`brevoClient.types.ts` is not modified.**
- `apps/server/src/server.mjs` (the `BREVO_API_KEY` resolution + `createBrevoClient(...)` wiring at ~233/702) — where the transactional sender is built + injected into the friend routes.
- `docs/ai/ARCHITECTURE.md §Layer Boundary` — `apps/server` may use `pg` + Node built-ins (incl. global `fetch`); no engine/registry/boardgame.io import.
- WP-105 badges — the **fire-and-forget-into-an-existing-handler** precedent (issuance never blocks the competition pipeline); this packet's route hook mirrors that posture.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, Node v22+; `node:` prefix on built-ins; `.test.ts`; human-style code per `00.6`; full-sentence errors; `// why:` on non-obvious choices; JSDoc per function.
- No cross-layer import beyond the allowed server set; the only runtime dependency of the new mail code is the global `fetch` (+ `pg` for the recipient lookup). No `boardgame.io`, engine, or registry.

**Packet-specific:**
- **Fail-open is the whole point (D-24077).** `notifyFriendRequestReceived` / `notifyFriendRequestAccepted` are the **single fail-open boundary**: they NEVER throw and NEVER reject. A Brevo outage, an HTTP error, an unconfigured sender, a missing template id, or an unresolvable recipient degrades to a `console.warn` — the friend-request response is unaffected. Callers `void notify(...)` (fire-and-forget) with no try/catch of their own.
- **Never delays or fails the request.** The route awaits the WP-350 logic mutation, sets its HTTP response, and fires the notification as a side effect that does not gate the response.
- **Unconfigured → clean no-op (D-24080).** If the transactional sender is `undefined` (no `BREVO_API_KEY`) or the template id env is unset, the notify function returns immediately — not an error. Local/dev with no Brevo config sends nothing and logs nothing alarming.
- **WP-293 contract untouched.** `brevoClient.types.ts` + `enqueuePlayerToMarketingList` are byte-identical; the transactional path is a **separate** adapter (new file), not a mutation of the contact-list client.
- **WP-351 endpoint contract untouched.** The routes' request/response shapes, status codes, and `FriendApiErrorCode` set are byte-identical; this packet adds only a fire-and-forget call + one injected dep field.
- **Transactional, template-driven copy.** Emails use Brevo **templates** (`templateId` + `params`), so copy/design live in the Brevo dashboard (marketing authority, like the double-opt-in config), not in code. `params` carry `{ actorHandle, actorDisplayName }` (+ minimal context). No inline HTML in the repo. §23(b): no match/opponent/win framing in the params.
- **Identity by handle, not `accountId`.** Email params reference the actor's `@handle` + display name; the recipient is addressed by their `email`. No `accountId` appears in any email body/param.

**Session protocol:**
- If the exact fail-open shape or the `BREVO_API_KEY` wiring is unclear, stop and read `brevoEnqueue.logic.ts` / `server.mjs` — do not invent the adapter or the boundary.

---

## Scope (In)

### A) `brevoTransactional.logic.ts` (new) — `apps/server/src/marketing/`
- `BrevoTransactionalSender` interface: `sendTemplateEmail(params: { to: string; templateId: number; params: Record<string, string> }): Promise<void>` (resolves on 2xx, throws on non-2xx — the caller is the fail-open boundary). Mirrors the `BrevoClient` structural pattern; **declared here, not in `brevoClient.types.ts`**.
- `createBrevoTransactionalSender(apiKey: string, fetchImpl = globalThis.fetch): BrevoTransactionalSender` — `POST https://api.brevo.com/v3/smtp/email` with `{ to: [{ email }], templateId, params }`; full-sentence throw on non-2xx (mentions `BREVO_API_KEY` + the template env). Injectable `fetch` (D-5306).

### B) `friendshipNotifications.logic.ts` (new) — `apps/server/src/friendships/`
- `FriendshipNotificationConfig` = `{ sender: BrevoTransactionalSender | undefined; requestTemplateId: number | undefined; acceptedTemplateId: number | undefined }` (undefined ⇒ that notification no-ops).
- `notifyFriendRequestReceived(pool, config, { actorAccountId, recipientAccountId })` and `notifyFriendRequestAccepted(pool, config, { actorAccountId, recipientAccountId })` — resolve the recipient `email` + the actor `display_handle`/`display_name` (one `WHERE ext_id = ANY($1)` read), build `params`, call `sender.sendTemplateEmail(...)`, and **swallow every failure** with a full-sentence `console.warn`. Always resolve `Promise<void>`; the **single fail-open boundary**.

### C) Route wiring — `friendships.routes.ts` (WP-351, additive)
- In the `POST /api/me/friends/requests` handler, after `sendFriendRequest` returns ok: `void notifyFriendRequestReceived(pool, notificationConfig, { actorAccountId: session account, recipientAccountId: resolved target })`.
- In the `POST …/requests/:handle/accept` handler, after `acceptFriendRequest` returns ok: `void notifyFriendRequestAccepted(pool, notificationConfig, { actorAccountId: session account, recipientAccountId: the original requester })`.
- Extend the route deps bundle with one field: `notificationConfig: FriendshipNotificationConfig`. **No endpoint-contract change** (fire-and-forget side effect only).

### D) Startup wiring — `server.mjs`
- Build `createBrevoTransactionalSender(BREVO_API_KEY)` (reusing the existing `BREVO_API_KEY` resolution; `undefined` when unconfigured) + read `BREVO_FRIEND_REQUEST_TEMPLATE_ID` / `BREVO_FRIEND_ACCEPTED_TEMPLATE_ID` (parse to number or `undefined`); pass the assembled `FriendshipNotificationConfig` into `registerFriendshipRoutes` (01.5 runtime-wiring, same-layer).

### E) Tests
- `brevoTransactional.logic.test.ts` — injected fake `fetch`: 2xx resolves; non-2xx throws a full-sentence error; correct `POST /v3/smtp/email` body (`to`/`templateId`/`params`).
- `friendshipNotifications.logic.test.ts` — resolves recipient email + actor identity and calls the sender with the right template + params; **fail-open**: sender throws → the function still resolves (warns, does not reject); `sender: undefined` → no-op (no send, no throw); missing template id → no-op; unresolvable recipient → warn + resolve. No `accountId` in any built `params` (asserted).

---

## Out of Scope

- **No new endpoint / migration / table** — a side effect on WP-351's existing routes; `api-endpoints.md` unchanged (the endpoint contracts don't change), §21 N/A.
- **No modification of WP-293's Brevo contact client** — `brevoClient.types.ts` + `enqueuePlayerToMarketingList` byte-identical.
- **No modification of WP-351's endpoint contract** — request/response/status/`FriendApiErrorCode` byte-identical; only a fire-and-forget hook + one injected dep.
- **No notification preferences / opt-out / rate limiting** — a per-account "email me on friend requests" toggle and anti-spam throttling ride on **packet #6** (privacy/abuse controls); see **Risk**. This packet ships the send; the guardrails are packet #6.
- **No in-app (bell) notification** — the charter's in-app notification is a separate future surface; this packet is email only.
- **No email for decline / remove** — only *request received* and *request accepted* (charter lifecycle). Decline/remove are silent.
- **No engine / `G` / gameplay / replay / RNG touch.**

---

## Files Expected to Change

- `apps/server/src/marketing/brevoTransactional.logic.ts` — **new**
- `apps/server/src/friendships/friendshipNotifications.logic.ts` — **new**
- `apps/server/src/marketing/brevoTransactional.logic.test.ts` — **new**
- `apps/server/src/friendships/friendshipNotifications.logic.test.ts` — **new**
- `apps/server/src/friendships/friendships.routes.ts` — **modified** (WP-351; +2 fire-and-forget calls +1 deps field — 01.5, additive)
- `apps/server/src/server.mjs` — **modified** (build + inject the transactional sender + template-id config — 01.5)
- Governance: `WORK_INDEX.md` (blocked row) + `DECISIONS.md` (**D-24145**, at execution) + `STATUS.md` + `wiki/profile-login.md` (packet-#4 → WP-353 link). `EC_INDEX.md` row + the EC-383 file at **execution-prep**.

**2 new code + 2 new tests + 2 wiring edits. Standard two-session lane.** No `brevoClient.types.ts` / WP-351-endpoint-contract / migration / engine touch.

---

## Contract

### New transactional adapter
`BrevoTransactionalSender.sendTemplateEmail({ to, templateId, params }) → Promise<void>` (resolve 2xx / throw non-2xx). `createBrevoTransactionalSender(apiKey, fetchImpl?)` → the `fetch`-backed impl (`POST /v3/smtp/email`).

### Notification boundary (fail-open — never throws)
`notifyFriendRequestReceived(pool, config, { actorAccountId, recipientAccountId }) → Promise<void>` (always resolves) · `notifyFriendRequestAccepted(...)` (same shape).

### Env (new; unconfigured ⇒ no-op)
`BREVO_FRIEND_REQUEST_TEMPLATE_ID`, `BREVO_FRIEND_ACCEPTED_TEMPLATE_ID` (Brevo transactional template ids). Reuses `BREVO_API_KEY`.

### Locked Values (do not re-derive at execution)
| Key | Value |
|---|---|
| Transactional endpoint | `POST https://api.brevo.com/v3/smtp/email`, body `{ to: [{ email }], templateId, params }` |
| Fail-open boundary | the two `notify*` functions never throw/reject; unconfigured sender or missing template id → immediate no-op (D-24077 / D-24080) |
| Fire-and-forget | routes call `void notify(...)` after the ok mutation; the notification never gates the HTTP response |
| Email params | `{ actorHandle, actorDisplayName }` (+ minimal context) — **no `accountId`**; §23(b): no match/opponent/win language |
| Copy home | Brevo **templates** (dashboard authority); no inline email HTML in the repo |
| Events | *request received* (notify addressee) + *request accepted* (notify original requester) only — decline/remove silent |
| WP-293 / WP-351 contracts | `brevoClient.types.ts` + `enqueuePlayerToMarketingList` + WP-351 endpoint shapes all byte-identical |

---

## Acceptance Criteria

1. `createBrevoTransactionalSender` posts to `/v3/smtp/email` with `{ to:[{email}], templateId, params }`, resolves on 2xx, and throws a full-sentence error on non-2xx (injected-`fetch` test) (**AC-1**).
2. `notifyFriendRequestReceived` / `notifyFriendRequestAccepted` resolve the recipient email + actor handle/displayName and call `sendTemplateEmail` with the correct template id + `params` (no `accountId` in params) (**AC-2**).
3. Both `notify*` functions are fail-open: a sender throw, an `undefined` sender, a missing template id, or an unresolvable recipient all result in the function **resolving** (with a `console.warn` where appropriate) and **never rejecting** — proven by tests (**AC-3**).
4. `friendships.routes.ts` fires `void notifyFriendRequestReceived` after a successful send and `void notifyFriendRequestAccepted` after a successful accept, with **no change** to the endpoints' request/response/status contract or `FriendApiErrorCode` set (**AC-4**).
5. `server.mjs` builds the transactional sender from `BREVO_API_KEY` (undefined when unconfigured) + parses the two template-id envs, and injects the `FriendshipNotificationConfig` into `registerFriendshipRoutes` (**AC-5**).
6. `brevoClient.types.ts` and `enqueuePlayerToMarketingList` are byte-identical (`git diff` empty); no `boardgame.io`/engine/registry import in the new files (**AC-6**).
7. `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/server test` green (new suites pass; DB-less env skips DB-backed cases; baseline otherwise unchanged) (**AC-7**).

---

## Verification Steps

```pwsh
# Step 1 — build (requires WP-350 + WP-351 merged)
pnpm -r build   # Expected: exits 0

# Step 2 — server tests (new suites; DB-less skip parity)
pnpm --filter @legendary-arena/server test
# Expected: brevoTransactional + friendshipNotifications suites present; baseline + these

# Step 3 — WP-293 contract untouched
git diff --name-only origin/main -- apps/server/src/marketing/brevoClient.types.ts apps/server/src/marketing/brevoEnqueue.logic.ts
# Expected: no output (byte-identical)

# Step 4 — fail-open boundary + no accountId in params + no cross-layer import
Select-String -Path "apps\server\src\friendships\friendshipNotifications.logic.ts" -Pattern "accountId|boardgame.io|@legendary-arena/game-engine|@legendary-arena/registry"
# Expected: no output (accountId not put in email params; no cross-layer import)
Select-String -Path "apps\server\src\marketing\brevoTransactional.logic.ts" -Pattern "v3/smtp/email|createBrevoTransactionalSender"
# Expected: present

# Step 5 — the routes fire fire-and-forget (void), not awaited-blocking
Select-String -Path "apps\server\src\friendships\friendships.routes.ts" -Pattern "notifyFriendRequest"

# Step 6 — scope
git diff --name-only   # Expected: only the ## Files Expected to Change set
```

---

## Definition of Done

- [ ] **WP-351 is Done on `main`** (hard dep) — verified before execution opens
- [ ] All acceptance criteria pass
- [ ] `brevoTransactional.logic.ts` (`/v3/smtp/email` adapter) + `friendshipNotifications.logic.ts` (fail-open boundary) created; routes fire `void notify*` after ok send/accept; `server.mjs` builds + injects the sender + template config
- [ ] Fail-open proven: sender throw / undefined sender / missing template id / unresolvable recipient all resolve, never reject; unconfigured → clean no-op
- [ ] `brevoClient.types.ts` + `enqueuePlayerToMarketingList` byte-identical; WP-351 endpoint contract byte-identical; no `accountId` in email params; no cross-layer import
- [ ] `pnpm -r build` 0; server test green (DB-less skip parity)
- [ ] `DECISIONS.md` **D-24145** landed (Active); `WORK_INDEX` (WP-353) + `STATUS.md` updated; `wiki/profile-login.md` packet-#4 row links WP-353
- [ ] **User-visible verification (D-24026):** APPLIES. In the execution session, with `BREVO_API_KEY` + a template id configured against a test tenant, trigger a friend request and confirm the transactional email is accepted by Brevo (2xx / arrives). If a live tenant isn't available at execution, record the injected-`fetch` proof + note the live send as operator-pending on deploy — NOT a silent tests-only pass.

---

## Vision Alignment

**Vision clauses touched:** none of the scoring/PAR/replay clauses. A transactional notification side effect; the ranked UX is packet #5.

**Conflict assertion:** No conflict. Fail-open email on an existing social event; no scoring, PAR, replay, RNG, or leaderboard touch. Email copy references the public `@handle`, never the internal `AccountId`.

**Non-Goal proximity check:** Crosses none of NG-1..7. **Not pay-to-win (NG-1)** — a notification confers no gameplay advantage. **PvP terminology (§23(b)):** template params are "friend request" / "accepted" — no match/opponent/win/vs framing. **No social reputation** — no counts/scores in the email.

**Determinism preservation:** N/A — server-side notification over profile-adjacent data; no engine, `G`, replay, RNG, or hash. Global `fetch` is confined to the marketing adapter (never in a move/effect).

---

## Risk (surfaced, not a blocker)

Emailing on every *received* request is a mild spam vector: an abuser could spam friend requests to flood a victim's inbox. This packet does **not** add throttling or an opt-out — those are **packet #6** (rate limits + a per-account notification preference). Flagged so packet #6 owns the guardrail; the fail-open send here is safe to ship first (a Brevo outage never breaks requests), but the abuse surface should not be forgotten. Also: the send targets a **verified** account email (WP-174), and transactional (not marketing) mail needs no list-consent — but if volume becomes a deliverability concern, that too is a packet-#6 tuning knob.

---

## Lint Gate Self-Review (00.3)

- §1 Structure — PASS: all required sections; `## Out of Scope` lists ≥2 (endpoint/migration, WP-293 contract, WP-351 contract, prefs/rate-limit, in-app, decline/remove, engine).
- §2 Non-Negotiable Constraints — PASS: fail-open boundary, never-block-request, unconfigured-no-op, both locked contracts untouched, template-driven copy, handle-not-accountId; cites `00.6` + D-24077/D-24080/D-5306.
- §3 Assumes — PASS: WP-351 handlers (blocked note), no-transactional-path-today, fail-open pattern, `BREVO_API_KEY` wiring, email/identity on `players` — each with a source.
- §4 Context — PASS: charter (+ the pipeline correction), WP-351, `brevoEnqueue.logic.ts`/`brevoClient.types.ts`, `server.mjs`, ARCHITECTURE, the WP-105 fire-and-forget precedent.
- §5 Output Completeness — PASS: 2 new code + 2 tests + 2 wiring edits; standard lane (new capability + new fail-open boundary → correctly NOT lightweight).
- §6 Naming — PASS: `createBrevoTransactionalSender`, `notifyFriendRequestReceived`, `FriendshipNotificationConfig`; no abbreviations.
- §7 Dependency Discipline — PASS: **zero** new dependencies (global `fetch` + `pg`, both present).
- §8 Architectural Boundaries — PASS (Server): no engine/registry/boardgame.io import; `fetch` confined to the marketing adapter; grep-gated.
- §9 Windows Compatibility — PASS: `pwsh` + `Select-String` + `\` paths.
- §10 Env Var Hygiene — PASS: two new `BREVO_*_TEMPLATE_ID` vars, unconfigured ⇒ documented no-op (D-24080 pattern); reuses `BREVO_API_KEY`; `// why:` on the parse-to-undefined.
- §11 Authentication Clarity — N/A (no endpoint added): the trigger routes are WP-351's `authenticated-session-required`; this packet adds no auth surface.
- §12 Test Quality — PASS: `node:test`; injected-`fetch` adapter test + the four fail-open branches + no-`accountId`-in-params assertion; DB-less skip parity for the recipient-lookup cases.
- §13 Commands & Verification — PASS: exact `pnpm` + `Select-String` + a `git diff` proving the WP-293 contract is untouched.
- §14 Acceptance Criteria — PASS: 7 binary, observable items naming the real adapter/functions/envs.
- §15 Definition of Done — PASS: binary checkboxes incl. dependency gate + DECISIONS/index/wiki + live-verify; §15.1 addressed.
- §15.1 User-Visible Verification (D-24026) — PASS (APPLIES): a real Brevo send is the live proof; if no live tenant at execution, injected-`fetch` proof + operator-pending live send is stated (not a silent tests-only pass).
- §16 Code Style — PASS: explicit `if/else`; typed sender/config; `// why:` on the fail-open swallow, the unconfigured no-op, and the fire-and-forget `void`; JSDoc per function; named imports.
- §17 Vision Alignment — PASS: `## Vision Alignment` present; NG-1 + §23(b); scoring/determinism N/A.
- §18 Prose-vs-Grep — PASS: greps target identifiers (`v3/smtp/email`, `notifyFriendRequest`) + real absence checks, not a count-literal echo.
- §19 Bridge-vs-HEAD — N/A.
- §20 Funding Surface Gate — N/A: transactional friend email; no donate/support/tournament-funding copy.
- §21 API Catalog Update — N/A: no endpoint added/changed (a side effect on existing WP-351 routes); no `api-endpoints.md` edit.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): NOT READY — BLOCKED on WP-351.** The blocking PS-item is the hard dep: WP-351's route handlers (the fire-and-forget trigger site) are not on `main` at draft time. Per `01.0a §Blocking drafts`, merged as a `[ ]` placeholder carrying **BLOCKED on WP-351**, reserving WP-353 / EC-383 / D-24145 and locking the notification contract. **Re-run pre-flight to READY once WP-351 is Done on `main`.** No other blockers: the Brevo fail-open/adapter pattern, `BREVO_API_KEY` wiring, and the `players` email/identity reads are verified on `main` (WP-350 Done); scope is 2 code + 2 tests + 2 wiring, single layer.

**Copilot (01.7): PASS (design), pending re-run post-WP-351.** Real failure modes pinned: (a) an email failure breaking the friend request → **fail-open boundary + fire-and-forget `void`, tested four ways**; (b) modifying WP-293's locked contact-client contract → **separate transactional adapter, byte-identical `git diff` gate**; (c) changing WP-351's endpoint contract → **side-effect-only, contract byte-identical**; (d) leaking `accountId` into email copy → **params are handle/displayName, no-`accountId` assertion**; (e) unconfigured Brevo crashing dev → **undefined-sender/ missing-template no-op**; (f) an abuse/spam surface shipped without a guardrail → **surfaced as a Risk owned by packet #6**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24145**: friend-request email notifications (packet #4 of the Friends & Ranked Trust subsystem). Locks: (1) a **new transactional-mail adapter** (`POST /v3/smtp/email`, `createBrevoTransactionalSender`, injectable `fetch`) — the Brevo module had no transactional path; **WP-293's `brevoClient.types.ts` contact-client contract is not modified**; (2) `notifyFriendRequestReceived` / `notifyFriendRequestAccepted` as the **single fail-open boundary** (never throw; unconfigured/failed → `console.warn` no-op; D-24077/D-24080), fired **fire-and-forget** (`void`) from WP-351's send/accept handlers with **no endpoint-contract change**; (3) **template-driven copy** (`templateId` + `params` in the Brevo dashboard, not inline HTML) with `params` referencing the actor's `@handle`/display name and **never** an `accountId`; (4) events limited to *request received* + *request accepted* (decline/remove silent, no in-app bell); (5) two new `BREVO_*_TEMPLATE_ID` envs reusing `BREVO_API_KEY`, unconfigured ⇒ no-op. Rate limiting + notification opt-out are explicitly **packet #6** (Risk). Drafted 2026-07-10; not yet landed (BLOCKED on WP-351).
