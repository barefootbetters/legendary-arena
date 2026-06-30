# WP-293 — Game-Signup → Brevo Marketing List (Server-Side, Fire-and-Forget)

**User-Visible Surface:** none — infrastructure (server-side marketing
capture). Payoff: every new game account's verified email enters the Brevo
marketing funnel (newsletter list + double-opt-in confirmation email), so
tournament announcements and the welcome series can reach players. No change
to any in-app surface (play / cards / dashboard).

## Goal

When a player creates a game account on first Hanko sign-in (the WP-174
provisioning path), the server makes a best-effort, fire-and-forget call to
add that player's already-verified email to the existing Brevo newsletter
list. After WP-293 lands, new game-account emails enter the marketing funnel
automatically — closing the gap where provisioned emails sat in
`legendary.players` with no path to Brevo. The enqueue is **fail-open**: a
Brevo outage, a missing API key, or any HTTP error MUST NOT block, delay
past a single attempt, or fail account provisioning.

## Assumes

- WP-174 `provisionPlayerAccount` + `attemptProvisioning` (read-or-create
  resolver) — Done ✅ (the provision-success site this WP hooks).
  Source: `apps/server/src/auth/accountResolver.logic.ts`,
  `apps/server/src/auth/accountProvisioning.logic.ts`.
- WP-131 production wiring (`productionAccountResolver` constructed in
  `server.mjs`) — Done ✅ (the injection seam for the Brevo client).
- WP-106 caller-injected R2 client (`AvatarR2Client`) — Done ✅ (the
  pattern this WP mirrors for `BrevoClient`).
- WP-105 badge issuance fire-and-forget hook (D-10501) — Done ✅ (the
  fail-open side-effect pattern this WP mirrors).
  Source: `apps/server/src/competition/competition.logic.ts`,
  `apps/server/src/badges/badge.issuance.ts`.
- An existing Brevo newsletter list and verified sending domain — set up by
  the marketing pipeline. The marketing repo doc
  `C:\www\legendary-arena-com\docs\brevo\email-automation.md` is
  authoritative for Brevo list/DOI configuration; this WP only adds a second
  caller (the game server) to that existing list.
- `origin/main` @ `8b53b2a8` (2026-06-29).

## Context (Read First)

The auth-strategy review (2026-06-29) found that game-account emails are
captured in `legendary.players` (WP-174) but never reach Brevo — the
marketing newsletter signup path (`www` form →
`C:\www\legendary-arena-com\functions\api\subscribe.js` → Brevo) is a
separate surface that game signups never touch. The dashboard roadmap item
`au-email-capture` (`apps/dashboard/src/data/buildRoadmap.ts`, not-started,
target 2026-07-15) names this gap.

This WP wires the server side: after a new account row is created, the
server best-effort-adds the player's verified email to the **existing**
Brevo newsletter list. Consent is satisfied by Brevo's list-level
double-opt-in (the player must confirm before receiving marketing) — the
same consent model the marketing pipeline already relies on. No new Brevo
list and no marketing-repo change.

**Read order:**
1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — §Layer Boundary, §Persistence Boundaries
3. `.claude/rules/architecture.md` + `code-style.md` + `work-packets.md`
4. `.claude/skills/legendary-server/SKILL.md`
5. `apps/server/src/auth/accountResolver.logic.ts` (the file to change)
6. `apps/server/src/auth/accountProvisioning.logic.ts` (the provision
   helper — stays byte-identical; read for the `ProvisionedAccount` shape)
7. `apps/server/src/competition/competition.logic.ts` (badge fire-and-forget
   precedent, D-10501)
8. `apps/server/src/profile/avatarUpload.types.ts` (`AvatarR2Client`
   caller-injected pattern)
9. `apps/server/src/server.mjs` (startup wiring + env-load patterns:
   `loadSweepSubmitToken`, `tryConstructHankoVerifier`, R2 client)
10. `wiki/brevo-email-pipeline.md` (the existing pipeline + list/DOI config)

## Scope (In)

### §A — New `BrevoClient` interface (caller-injected)

Add `apps/server/src/marketing/brevoClient.types.ts` exporting a minimal
caller-injected client interface, mirroring `AvatarR2Client`:

```ts
export interface BrevoClient {
  /**
   * Best-effort add of a contact to a Brevo list. Resolves on success;
   * throws on any non-2xx response or transport failure (the caller's
   * fail-open wrapper swallows the throw).
   */
  addContactToList(params: {
    email: string;
    listId: number;
  }): Promise<void>;
}
```

### §B — Fire-and-forget enqueue wrapper + production factory

Add `apps/server/src/marketing/brevoEnqueue.logic.ts`:

- `enqueuePlayerToMarketingList(account, brevoClient, listId)` — the
  fail-open wrapper. If `brevoClient` is `undefined`, return immediately
  (marketing not configured → no-op). Otherwise `await
  brevoClient.addContactToList({ email: account.email, listId })` inside a
  `try/catch`; on any error, `console.warn` a full-sentence message and
  swallow. This function NEVER throws and NEVER rejects.
- `createBrevoClient(apiKey)` — production factory returning a `BrevoClient`
  backed by Node's built-in `fetch` (no `axios`, no `node-fetch`). It
  `POST`s to `https://api.brevo.com/v3/contacts` with header
  `api-key: <apiKey>` and JSON body `{ email, listIds: [listId],
  updateEnabled: true }`; throws a full-sentence `Error` on non-2xx.
  Mirrors the marketing `subscribe.js` contract (plain `/v3/contacts`,
  `updateEnabled: true`); double-opt-in behavior is inherited from the
  Brevo list configuration (marketing-repo authority).

### §C — Hook the enqueue into the provision-success branch

In `apps/server/src/auth/accountResolver.logic.ts`, thread an optional
`marketingEnqueue?: (account: ProvisionedAccount) => Promise<void>`
dependency into the production resolver. Immediately after
`provisionPlayerAccount` returns ok (the existing success branch), and
before returning the `accountId`, call `await
marketingEnqueue?.(newAccount)`. Because the wrapper never throws, no extra
`try/catch` is required at this site, but the `?.` guard ensures absence of
the dependency is a clean no-op. The provisioning return value, the
`console.info` provisioning log, and all existing `Result` paths are
byte-identical otherwise.

### §D — Startup wiring + env vars

In `apps/server/src/server.mjs`, read `BREVO_API_KEY` and `BREVO_LIST_ID`
from `process.env` using the established optional-env pattern. If EITHER is
absent or `BREVO_LIST_ID` is not a finite positive integer, construct
`undefined` for the marketing dependency (marketing not wired) and emit a
one-shot startup `console.warn` (mirroring `loadSweepSubmitToken`'s
one-shot warning) — this is NOT production-fatal. Otherwise build
`createBrevoClient(BREVO_API_KEY)` and pass a bound
`marketingEnqueue = (account) => enqueuePlayerToMarketingList(account,
brevoClient, listId)` into the `productionAccountResolver` construction.

Document both vars in `.env.example` and declare them in `render.yaml`
(`sync: false`).

## Out of Scope

- **Marketing-repo changes.** The `www` newsletter form,
  `functions/api/subscribe.js`, Brevo templates, and the welcome workflow
  are owned by the marketing repo and its pipeline doc. This WP does not
  touch them.
- **Creating a separate "players" Brevo list or segment.** v1 reuses the
  existing newsletter list (D-24078); a dedicated list/segment is deferred.
- **`SIGNUP_SOURCE` (or any) contact attribute.** v1 adds the contact with
  no attributes (the marketing pipeline's `SIGNUP_SOURCE` hedge is itself
  not yet live). Segmentation is deferred.
- **Recording subscription state in PostgreSQL.** No migration, no new
  column. Brevo is the source of truth for subscription state; the enqueue
  is stateless and best-effort. `accountProvisioning.logic.ts` stays
  byte-identical (no `wasCreated` flag — Brevo's `updateEnabled` makes a
  rare concurrent-first-signin double-add idempotent).
- **A new HTTP endpoint.** The Brevo call is outbound only; no inbound
  route is added (§21 N/A).
- **Double-opt-in correctness / Brevo dashboard setup.** DOI is configured
  at the Brevo list level (marketing-repo authority); this WP inherits it.
- **Unsubscribe / re-engagement / drip logic.** Deferred per the pipeline's
  staged plan.

## Files Expected to Change

| File | Action |
|------|--------|
| `apps/server/src/marketing/brevoClient.types.ts` | **New** — `BrevoClient` interface |
| `apps/server/src/marketing/brevoEnqueue.logic.ts` | **New** — fail-open wrapper + `createBrevoClient` factory |
| `apps/server/src/marketing/brevoEnqueue.logic.test.ts` | **New** — unit tests (fake client; fail-open + success-path) |
| `apps/server/src/auth/accountResolver.logic.ts` | **Modified** — call injected `marketingEnqueue` after provision success |
| `apps/server/src/server.mjs` | **Modified** — construct Brevo client from env (undefined if unset), inject into resolver wiring |
| `.env.example` | **Modified** — document `BREVO_API_KEY`, `BREVO_LIST_ID` |
| `render.yaml` | **Modified** — declare `BREVO_API_KEY` + `BREVO_LIST_ID` (`sync: false`) |
| `docs/ai/DECISIONS.md` | **Modified** — land D-24077..D-24080 |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — mark WP-293 done |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — flip EC-325 to Done |

## Non-Negotiable Constraints

### Engine-wide

- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+ (built-in `fetch` — no `axios`, no `node-fetch`).
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.
- Every function has a JSDoc comment.
- Every `async` function doing I/O handles errors explicitly with try/catch.
- Error messages are full sentences (what failed + what to check).
- No `.reduce()` in data operations.

### Packet-specific

- `accountProvisioning.logic.ts` is LOCKED — stays byte-identical. The hook
  attaches at the resolver orchestration layer only (D-24079).
- `identity.logic.ts` / `identity.types.ts` / `accountLookup.logic.ts` /
  `sessionToken.logic.ts` are LOCKED — DO NOT MODIFY.
- The enqueue is fail-open: it NEVER throws, NEVER rejects, and NEVER
  changes the resolver's `Result` outcome (D-24077).
- Missing/invalid `BREVO_*` env is NOT production-fatal — the dependency is
  `undefined` and the enqueue is a no-op with a one-shot warning (D-24080).
- No new npm dependency. Use built-in `fetch`.
- No new `auth_provider` value; no token-shape change; the identity model
  is untouched.

### Session protocol

- Stop and ask on unclear items.
- If a locked file needs modification, STOP — architectural review first.

### Locked contract values

- New directory: `apps/server/src/marketing/`.
- Interface: `BrevoClient.addContactToList({ email: string; listId: number }): Promise<void>`.
- Brevo endpoint: `POST https://api.brevo.com/v3/contacts`; header
  `api-key: <BREVO_API_KEY>`; body `{ email, listIds: [listId], updateEnabled: true }`.
- Wrapper: `enqueuePlayerToMarketingList(account, brevoClient, listId)` —
  `undefined` client → return; else awaited `try/catch` → `console.warn` on
  failure; never throws.
- Resolver dependency: `marketingEnqueue?: (account: ProvisionedAccount) => Promise<void>`.
- Hook site: immediately after `provisionPlayerAccount` success, before the
  `accountId` return, in `accountResolver.logic.ts`.
- Env vars: `BREVO_API_KEY` (secret), `BREVO_LIST_ID` (finite positive
  integer). `BREVO_LIST_ID` parsed via `Number.parseInt` + `Number.isInteger`
  + `> 0` guard; any failure → marketing unwired.
- Contact email source: `ProvisionedAccount.email` (already
  trim+lowercased by WP-174 provisioning).

### Locked Policies

- **Consent:** the player's email is already Hanko-verified; marketing
  consent is satisfied by Brevo's list-level double-opt-in confirmation.
  The server adds to the list; Brevo gates actual sends on confirmation.
- **Idempotency:** `updateEnabled: true` makes a repeat add a harmless
  update; a rare concurrent-first-signin double-call is acceptable.

## Vision Alignment

- **Vision clauses touched:** §3 (player identity / accounts), §11
  (accounts / ownership), Financial Sustainability covenant.
- **Conflict assertion:** `No conflict: this WP preserves all touched
  clauses.` The identity model is untouched (no new `auth_provider`, no
  token change). Capturing a verified email for marketing is standard
  commerce and directly serves the Financial Sustainability covenant
  (tournament/newsletter reach drives revenue).
- **Non-Goal proximity check:** NG-1 (no pay-to-win) and NG-2..7 are not
  crossed — marketing email is neither a paid game advantage nor a
  persuasive in-game surface. No Non-Goal exception required.
- **Determinism preservation:** N/A — this WP touches no scoring, replay,
  RNG, or simulation surface.

## Acceptance Criteria

1. A brand-new Hanko user's first sign-in still provisions and resolves to
   an `AccountId` with no behavior change (existing WP-174 tests pass).
2. On first-sign-in provisioning, the injected `marketingEnqueue` is called
   exactly once with the new account, with the player's email.
3. If the Brevo client throws (HTTP error / outage), provisioning still
   returns `{ ok: true, value: accountId }` — the enqueue failure is
   swallowed and logged via `console.warn` (fail-open).
4. If `marketingEnqueue` is absent (BREVO env unset), provisioning behaves
   byte-identically to WP-174 and emits no enqueue (no-op).
5. `createBrevoClient` posts to `/v3/contacts` with `listIds: [listId]` and
   `updateEnabled: true`, header `api-key`; throws a full-sentence error on
   non-2xx (asserted with a fake fetch, no network).
6. Existing-account sign-ins (lookup hits) never call `marketingEnqueue`.
7. `accountProvisioning.logic.ts`, `identity.*`, `accountLookup.logic.ts`,
   `sessionToken.logic.ts` are byte-identical (`git diff` empty).
8. No new npm dependency; `package.json` / `pnpm-lock.yaml` unchanged.
9. `BREVO_API_KEY` + `BREVO_LIST_ID` documented in `.env.example` and
   declared in `render.yaml` with `sync: false`; no real secret appears.
10. `pnpm -r build` exits 0 and the server test baseline increases (new
    `brevoEnqueue.logic.test.ts` cases).

## Verification Steps

```bash
# Build + server tests
pnpm -r build
pnpm --filter @legendary-arena/server test

# 1. accountProvisioning stays byte-identical
git diff HEAD -- apps/server/src/auth/accountProvisioning.logic.ts
# Expected: empty

# 2. No forbidden HTTP client introduced
grep -rE "axios|node-fetch" apps/server/src/marketing/
# Expected: no matches

# 3. updateEnabled present in the factory
grep -c "updateEnabled" apps/server/src/marketing/brevoEnqueue.logic.ts
# Expected: 1

# 4. No new HTTP route added (outbound only)
grep -c "router\." apps/server/src/marketing/brevoEnqueue.logic.ts
# Expected: 0

# 5. Env vars declared
grep -c "BREVO_API_KEY" .env.example render.yaml
# Expected: >= 1 in each
```

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All verification steps pass
- [ ] `pnpm -r build` exits 0; server test baseline increases
- [ ] **Live verification (D-24026, infrastructure payoff):** with
      `BREVO_API_KEY` + `BREVO_LIST_ID` set against a test list, a test
      first-sign-in produces a Brevo contact on the list (and a DOI
      confirmation email), observed in the Brevo dashboard — OR, if a live
      Brevo test list is unavailable at execution, STATUS.md records the
      fake-client test evidence plus the operator step deferred to the
      Brevo dashboard.
- [ ] `docs/ai/STATUS.md` updated (state "No in-app user-observable change —
      server-side marketing capture; payoff = new accounts enter the Brevo
      funnel")
- [ ] `docs/ai/DECISIONS.md` updated: D-24077..D-24080 landed (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-325 flipped to Done
- [ ] No files outside `## Files Expected to Change` modified
- [ ] 01.6 post-mortem authored (new `marketing/` server code category +
      new `BrevoClient` caller-injected seam)

## Lint Gate Self-Review

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | All 10 required sections present and non-empty |
| 2 | ✅ PASS | Engine-wide + packet-specific + session protocol + locked values; references 00.6 |
| 3 | ✅ PASS | §Assumes lists deps (WP-174/131/106/105) + Brevo list state, all cited |
| 4 | ✅ PASS | §Context (Read First) lists 10 specific docs/files |
| 5 | ✅ PASS | §Files Expected to Change: complete allowlist, new/modified marked |
| 6 | ✅ PASS | Canonical names (`email`, `accountId`, `auth_provider`) per 00.2 |
| 7 | ✅ PASS | No new dependency; `axios`/`node-fetch` explicitly forbidden — built-in `fetch` |
| 8 | ✅ PASS | Server layer only; no engine/registry import; outbound HTTP at app boundary |
| 9 | ✅ N/A | No shell script added; env read via `process.env` (cross-platform) |
| 10 | ✅ PASS | `BREVO_API_KEY` / `BREVO_LIST_ID` documented (.env.example + render.yaml); no secret in WP |
| 11 | ✅ PASS | Touches provisioning but identity model unchanged — no new token/provider; §Locked Policies states the trust boundary |
| 12 | ✅ PASS | Tests use node:test + injected fake client; no network/DB, no boardgame.io |
| 13 | ✅ PASS | §Verification Steps: exact `pnpm` + grep commands with expected output |
| 14 | ✅ PASS | §Acceptance Criteria: 10 binary, observable checks aligned to scope |
| 15 | ✅ PASS | §Definition of Done includes STATUS/DECISIONS/WORK_INDEX + scope-boundary + User-Visible Surface declared + live-verification (D-24026) |
| 16 | ✅ PASS | Human-style: small JSDoc'd functions, explicit control flow, full-sentence errors |
| 17 | ✅ PASS | `## Vision Alignment` present — §3/§11 + Financial Sustainability; no conflict; NG checked; determinism N/A |
| 18 | ✅ PASS | Grep steps target `axios|node-fetch`/`updateEnabled`/`router.`; no forbidden-token prose enumeration |
| 19 | ✅ N/A | No repo-state-summarizing artifact authored (commit-time discipline applies at execution) |
| 20 | ✅ N/A | No funding surface — server-side marketing-list enqueue, no donate/tournament-funding UI or copy |
| 21 | ✅ N/A | No HTTP endpoint added or modified (outbound Brevo call only); no `apps/server` library row in the catalog changes |
