# EC-383 — Friend-Request Email Notifications (Execution Checklist)

**Source:** docs/ai/work-packets/WP-353-friend-request-email-notifications.md
**Layer:** Server (`apps/server/src/marketing` + `friendships`). **Lane:** Standard two-session (new transactional-mail capability + new fail-open boundary + route/`server.mjs` wiring).

## Before Starting
- [ ] Fresh branch/worktree off `origin/main` — **after WP-351 merged** (`friendships.routes.ts` has the send + accept handlers).
- [ ] Read the precedents: `marketing/brevoEnqueue.logic.ts` (+ `.test.ts`) — the fail-open boundary + injectable-`fetch` adapter (D-24077 / D-24080 / D-5306); `marketing/brevoClient.types.ts` (structural pattern — **NOT modified**); `server.mjs` `loadBrevoConfig()` (~233) + `createBrevoClient(...)` wiring (~702) + `registerFriendshipRoutes(...)` (~812).
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL. **`brevoClient.types.ts` + `enqueuePlayerToMarketingList` + WP-351's endpoint contract are byte-identical.**

## Locked Values (do not re-derive)
- **Transactional adapter:** `createBrevoTransactionalSender(apiKey, fetchImpl = globalThis.fetch)` → `POST https://api.brevo.com/v3/smtp/email`, body `{ to: [{ email }], templateId, params }`; resolves on 2xx, throws a full-sentence error (mentions `BREVO_API_KEY` + the template env) on non-2xx. `BrevoTransactionalSender.sendTemplateEmail({ to, templateId, params })` — declared in `brevoTransactional.logic.ts`, NOT in `brevoClient.types.ts`.
- **Fail-open boundary:** `notifyFriendRequestReceived(pool, config, { actorAccountId, recipientAccountId })` + `notifyFriendRequestAccepted(...)` — the SINGLE fail-open boundary: **never throw / never reject**, always `Promise<void>`. A sender throw / `undefined` sender / missing template id / unresolvable recipient → immediate/`console.warn` no-op (D-24077 / D-24080).
- **`FriendshipNotificationConfig`** = `{ sender: BrevoTransactionalSender | undefined; requestTemplateId: number | undefined; acceptedTemplateId: number | undefined }`.
- **Recipient/actor resolution:** one `SELECT ext_id, email, display_handle, display_name FROM legendary.players WHERE ext_id = ANY($1::text[])` for both accounts. Recipient addressed by `email`; params `{ actorHandle, actorDisplayName }` — **no `accountId`**; §23(b) no match/opponent/win language.
- **Fire-and-forget:** in `friendships.routes.ts`, after the ok `sendFriendRequest` → `void notifyFriendRequestReceived(database, deps.notificationConfig, { actorAccountId: accountId, recipientAccountId: targetAccount.accountId })`; after the ok `acceptFriendRequest` → `void notifyFriendRequestAccepted(database, deps.notificationConfig, { actorAccountId: accountId, recipientAccountId: requesterAccount.accountId })`. The notification never gates the HTTP response.
- **Deps field:** `notificationConfig?: FriendshipNotificationConfig` is **OPTIONAL** on `FriendshipRouteDependencies` — so WP-351's `friendships.routes.test.ts` (NOT in this allowlist) compiles unchanged; the route fires only `if (deps.notificationConfig !== undefined)`. `server.mjs` always injects a config (with possibly-`undefined` sender/template ids).
- **New env (unconfigured ⇒ no-op):** `BREVO_FRIEND_REQUEST_TEMPLATE_ID`, `BREVO_FRIEND_ACCEPTED_TEMPLATE_ID` (parse to number or `undefined`); reuses `BREVO_API_KEY`.
- **Events:** *request received* (notify addressee) + *request accepted* (notify original requester) only — decline/remove silent; no in-app bell.
- Reserved decision: **D-24145** (flips to Active at execution close).

## Guardrails
- **Fail-open is the whole point.** Callers `void notify(...)` with no try/catch of their own; the notify functions swallow everything.
- **No endpoint-contract change** — request/response/status/`FriendApiErrorCode` byte-identical; only a fire-and-forget side effect + one optional deps field.
- **WP-293 contract untouched** — `brevoClient.types.ts` + `enqueuePlayerToMarketingList` byte-identical; the transactional path is a SEPARATE new adapter.
- **Template-driven copy** — `templateId` + `params` in the Brevo dashboard; NO inline email HTML in the repo.
- **No new cross-layer import** — new files import only `pg` types + Node built-ins (global `fetch`) + same-layer siblings. No `boardgame.io`, engine, registry.
- **No `accountId` in email params.**

## Required `// why:` Comments
- On the fail-open swallow (D-24077) in both notify functions.
- On the unconfigured/missing-template-id no-op (D-24080).
- On the fire-and-forget `void` at each route call site.
- On the parse-to-`undefined` of the template-id envs.
- On the optional `notificationConfig` deps field (WP-351 test out of allowlist).

## Files to Produce
- `apps/server/src/marketing/brevoTransactional.logic.ts` — new (adapter).
- `apps/server/src/friendships/friendshipNotifications.logic.ts` — new (fail-open boundary).
- `apps/server/src/marketing/brevoTransactional.logic.test.ts` — new.
- `apps/server/src/friendships/friendshipNotifications.logic.test.ts` — new.
- `apps/server/src/friendships/friendships.routes.ts` — +1 optional deps field, +2 `void notify*` calls (additive; endpoint contract byte-identical).
- `apps/server/src/server.mjs` — build `createBrevoTransactionalSender(BREVO_API_KEY)` + parse the two template ids + inject `FriendshipNotificationConfig` into `registerFriendshipRoutes` (01.5).
- Governance: `DECISIONS.md` (D-24145 → Active), `STATUS.md`, `WORK_INDEX.md` (WP-353 `[x]`), `EC_INDEX.md` (EC-383 Done), `05-ROADMAP-MINDMAP.md`, `wiki/profile-login.md` (packet-#4 → WP-353).

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` green (new suites; DB-less skip parity; baseline otherwise unchanged).
- [ ] `git diff --name-only origin/main -- apps/server/src/marketing/brevoClient.types.ts apps/server/src/marketing/brevoEnqueue.logic.ts` → empty.
- [ ] `Select-String friendshipNotifications.logic.ts -Pattern "accountId|boardgame.io|@legendary-arena/game-engine|@legendary-arena/registry"` → no output.
- [ ] `Select-String brevoTransactional.logic.ts -Pattern "v3/smtp/email|createBrevoTransactionalSender"` → present.
- [ ] `Select-String friendships.routes.ts -Pattern "notifyFriendRequest"` → present (fire-and-forget `void`).
- [ ] `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24145 Active) / WORK_INDEX (WP-353 `[x]`) / EC_INDEX (EC-383 Done) / mindmap node ✅ / wiki packet-#4 link; `roadmap:counts:check` green.
- [ ] `User-Visible Surface = email inbox` → **D-24026**: injected-`fetch` proof in the suite; a real Brevo send is operator-pending on deploy (`BREVO_*` + template ids configured) — recorded, NOT a silent tests-only pass.

## Common Failure Smells
- An email failure propagating into the friend-request response (must be fail-open + fire-and-forget `void`).
- Modifying `brevoClient.types.ts` or `enqueuePlayerToMarketingList` (WP-293 lock).
- Changing WP-351's endpoint request/response/status contract.
- Putting an `accountId` in the email params.
- Inline email HTML in the repo (copy lives in Brevo templates).
- A required `notificationConfig` deps field breaking WP-351's out-of-allowlist routes test.
