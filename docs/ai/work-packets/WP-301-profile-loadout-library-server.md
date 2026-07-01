# WP-301 — Profile Loadout Library: Data Model + Endpoints (Server)

**Status:** Draft — ready to execute (drafted 2026-07-01) · **Standard two-session lane** (D-24028 — NOT lightweight: new `.types.ts` contract + new table + new endpoints + api-catalog row)
**Primary Layer:** Server + Persistence (`apps/server`, `data/migrations`)
**User-Visible Surface:** none in this packet — infrastructure (the owner-profile UI that consumes these endpoints is the deferred follow-on **WP-302**). Payoff surface: `play.legendary-arena.com` once WP-302 lands.
**Dependencies:** WP-104 (the `/api/me/*` authenticated owner surface + route pattern) ✅; WP-160 (the auth session / `requireAuthenticatedSession`) ✅; WP-244 (`@legendary-arena/lagn` validator package) ✅; WP-291 (the LAGN validate + composition-mapping precedent) ✅; **01-VISION §19b** (the authority clause — ratified in this packet's SPEC PR).
**Baseline:** `origin/main` @ (the SPEC PR baseline; capture `git rev-parse origin/main` at execution). The engine has `legendary.players` (`ext_id`/`player_id`), the `player_profiles`/`player_links` tables (migration 009), the `/api/me/*` owner routes (WP-104), and the published `@legendary-arena/lagn` validator — but **no** account-scoped loadout storage.

---

## Goal

Players gain server-side storage for their LAGN loadouts, scoped to their account: a new `legendary.player_loadouts` table and a set of authenticated `/api/me/loadouts` endpoints (create / list / rename+visibility / delete) plus one guest `GET /api/loadouts/:shareSlug` read for public share links. The server validates every stored loadout against the published `@legendary-arena/lagn` schema and enforces a per-account cap. This is the **server contract half** of the Profile Loadout Library (Vision §19b); the owner-profile UI that calls these endpoints is the deferred **WP-302**. Saved loadouts are decorative, user-authored content (§19a/§19b) — never a competitive-submission path.

---

## User-Visible Impact

None in this packet (no UI). After the paired **WP-302** lands, a signed-in player will be able to save the loadout they built to their profile under a name, see their saved list, rename / toggle a loadout public/private, delete one, and copy a share link that opens a public loadout for anyone. This packet ships the storage + API those actions call.

---

## Assumes

- **The `/api/me/*` authenticated pattern is fixed.** `registerOwnerProfileRoutes` (`apps/server/src/profile/ownerProfile.routes.ts`) registers owner routes on the boardgame.io Koa router, calls `requireAuthenticatedSession` as the first business step (caller-injected `verifier` + `accountResolver`), resolves an `AccountId` (= `legendary.players.ext_id`), wraps every DB call in `try/catch` → typed 500, and sets status + body + `Cache-Control` on every path. The new routes mirror this exactly. (Verified at `ownerProfile.routes.ts`.)
- **Ownership is keyed the profile-table way.** `legendary.player_profiles` / `player_links` (migration 009) FK an internal `player_id bigint` to `legendary.players(player_id)`, and queries resolve `ext_id → player_id` inline (`WHERE player_id = (SELECT player_id FROM legendary.players WHERE ext_id = $1 LIMIT 1)`). `player_loadouts` uses the same shape. (Verified at `ownerProfile.logic.ts` + migration 009.)
- **`@legendary-arena/lagn` is a pure, dep-light validator.** It exports `validate` + the `LAGN` type; its only dependency is `zod`; it imports nothing from `boardgame.io`, the engine, the registry, or the server. The client already consumes it (`loadoutLagnImport.ts`). (Verified at `packages/lagn-spec/package.json`.)
- **The WP-291 mapping exists to reuse conceptually.** WP-291's `parseLagnLoadout` reverses WP-245's `compositionToLagnSetup`; this packet stores the raw LAGN JSON and does **not** need the composition mapping (it stores/serves the file; the client maps on load). (Verified at `apps/registry-viewer/src/lib/loadoutLagnImport.ts`.)
- **Migration numbering:** the next free migration is `022` (highest on disk is `021`). (Verified at `data/migrations/`.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `docs/01-VISION.md §19b` (ratified with this packet) — saved loadouts are decorative/shareable and **never** a competitive-submission path. `§19a` — decorative vs merit-bearing distinction.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — `apps/server` may import `registry`, `game-engine` (runtime-safe), `pg`, Node built-ins. **This packet adds `@legendary-arena/lagn` to that allowed set** (a pure zod validator, no upward/sideways runtime edge) — authorized by D-24086.
- `apps/server/src/profile/ownerProfile.routes.ts` + `ownerProfile.logic.ts` + `ownerProfile.types.ts` — the exact route/logic/types pattern to mirror (auth-first, typed errors, `ext_id → player_id` resolution, closed error-code union).
- `apps/server/src/server.mjs` (the `registerOwnerProfileRoutes(...)` / `registerAvatarUploadRoutes(...)` wiring block) — where `registerLoadoutLibraryRoutes` is wired with the same caller-injected auth deps + the `pool`.
- `data/migrations/009_create_player_profiles_and_links.sql` — the FK/`player_id` pattern for the new table.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — canonical field names (`playerCount`, composition field names) the LAGN schema already locks; do not rename.
- `docs/ai/REFERENCE/api-endpoints.md` + `00.3 §21` / D-11804 — the catalog obligation for the 5 new endpoints (same-commit at execution).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, Node v22+; `node:` prefix on built-ins; test files `.test.ts`.
- Human-style code per `00.6`; full-sentence error messages; `// why:` on non-obvious choices.
- No cross-layer import beyond the allowed set. **The only new import authorized is `@legendary-arena/lagn`** (validator). No `boardgame.io`, no engine runtime, no registry runtime in the logic/types.

**Packet-specific:**
- **Validate server-side, always.** Every stored loadout is validated with `@legendary-arena/lagn` `validate` before insert/update; an invalid LAGN is rejected with a typed error and never written. Never trust the client's validation.
- **Per-account cap.** A create that would exceed `MAX_SAVED_LOADOUTS_PER_ACCOUNT` (locked value **50**) is rejected with a typed `loadout_limit_reached` error — not silently dropped. (Premium "unlimited" is a future monetization hook, explicitly NOT built here.)
- **`share_slug` is server-generated + opaque.** When a loadout is public, the server mints a random URL-safe slug (never derived from `id`, `name`, or `accountId`); the guest read is by slug only. A private loadout has `share_slug = null` and is never readable via the guest endpoint.
- **The guest read exposes only public loadouts** — `GET /api/loadouts/:shareSlug` returns `404` for a missing/private slug, and returns only the loadout's `name` + `lagn` + owner `displayHandle` (never `accountId`, never `ext_id`, never a private loadout).
- **Zone/engine boundary untouched.** `G`, the engine, and gameplay are not involved — this is profile persistence. The stored `lagn_json` is opaque application data, not game state.
- Every closed error-code union has a canonical `readonly` array + a drift test (mirrors `OWNER_PROFILE_ERROR_CODES`).

**Session protocol:**
- If the exact `requireAuthenticatedSession` dependency shape or the `ext_id → player_id` SQL is unclear, stop and read `ownerProfile.routes.ts` / `.logic.ts` — do not invent the auth wiring or the FK resolution.

---

## Scope (In)

### A) Migration `022_create_player_loadouts.sql`
- `legendary.player_loadouts`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `player_id bigint NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE`, `name text NOT NULL` (trimmed, 1–80 chars — validated in logic), `lagn_json jsonb NOT NULL`, `visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public'))`, `share_slug text UNIQUE`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`. Index on `player_id`; partial unique index on `share_slug WHERE share_slug IS NOT NULL`.

### B) `loadoutLibrary.types.ts` (new contract)
- `SavedLoadoutView` (`id`, `name`, `visibility`, `shareSlug: string | null`, `createdAt`, `updatedAt`, `lagn`), `SavedLoadoutSummary` (list item — same minus `lagn` if we choose lighter list; **decision: list includes `lagn`** so the client can render "view as cards" without a second fetch), the closed `LoadoutLibraryErrorCode` union + its `readonly` array, the route dependency bundle interface (mirrors `AvatarUploadRouteDependencies` — `requireAuthenticatedSession`, `verifier`, `accountResolver`).

### C) `loadoutLibrary.logic.ts` (pure-ish DB logic)
- `createLoadout`, `listLoadouts`, `updateLoadout` (rename + visibility; mints/clears `share_slug` on the public⇄private transition), `deleteLoadout`, `getPublicLoadoutBySlug`. Each takes the `pg` pool + the resolved `accountId` (except the slug read). LAGN `validate` on create/update. Enforce the cap on create. Full `try/catch` → typed result union.

### D) `loadoutLibrary.routes.ts` (new)
- `registerLoadoutLibraryRoutes(router, pool, deps)` registering: `POST /api/me/loadouts`, `GET /api/me/loadouts`, `PATCH /api/me/loadouts/:id`, `DELETE /api/me/loadouts/:id` (all `authenticated-session-required`), and `GET /api/loadouts/:shareSlug` (guest). Auth-first, typed-error mapping, `Cache-Control` on every path — mirrors `ownerProfile.routes.ts` / `avatarUpload.routes.ts`.

### E) Wiring — `server.mjs`
- One `registerLoadoutLibraryRoutes(server.router, pool, { requireAuthenticatedSession, verifier, accountResolver })` call in the existing profile-routes wiring block (01.5 runtime-wiring — same-layer, authorized).

### F) `api-endpoints.md` (D-11804, at execution)
- Add the 5 rows: 4 `/api/me/loadouts*` (`Auth = authenticated-session-required`) + 1 `/api/loadouts/:shareSlug` (`Auth = guest`), each `Status = Wired`.

### G) Tests
- `loadoutLibrary.logic.test.ts` + `loadoutLibrary.routes.test.ts` (`node:test`): create/list/update/delete happy paths; **cap enforcement** (51st create → `loadout_limit_reached`); **invalid LAGN rejected**; **guest slug read returns public only, 404 on private/missing**; **cross-account isolation** (account B cannot read/update/delete account A's loadout by id); the error-code drift test. No `boardgame.io`; DB-backed tests follow the existing profile-test harness (skip when no DB, like the WP-296 profile suite).

---

## Out of Scope

- **No client UI** — the owner-profile "Save / list / share" surface is **WP-302** (deferred until this contract lands; UI-defer rule).
- **No competitive-submission path** — per §19b, a saved loadout is never a scoreboard entry. No leaderboard/`competitive_scores` touch.
- **No premium/paywall enforcement** beyond the numeric cap constant — the "unlimited for premium" tier is a future WP; this packet ships the free-tier cap only.
- **No change** to `player_profiles` / `player_links` / avatar / the existing `/api/me/profile|links|avatar` endpoints, the `OwnerProfileView` contract, or the LAGN spec package.
- **No composition mapping / registry lookup** — the server stores/serves the opaque LAGN JSON; the client owns LAGN→draft mapping (WP-291).
- **No engine / `G` / gameplay / replay / RNG surface.**

---

## Files Expected to Change

- `data/migrations/022_create_player_loadouts.sql` — **new**
- `apps/server/src/profile/loadoutLibrary.types.ts` — **new** (contract)
- `apps/server/src/profile/loadoutLibrary.logic.ts` — **new**
- `apps/server/src/profile/loadoutLibrary.routes.ts` — **new**
- `apps/server/src/profile/loadoutLibrary.logic.test.ts` — **new**
- `apps/server/src/profile/loadoutLibrary.routes.test.ts` — **new**
- `apps/server/src/server.mjs` — **modified** (one `registerLoadoutLibraryRoutes(...)` wiring call — 01.5 runtime-wiring)
- `apps/server/package.json` — **modified** (add `@legendary-arena/lagn` workspace dependency)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (5 new rows, D-11804, at execution)
- Governance: `WORK_INDEX.md` + `EC_INDEX.md` + `STATUS.md` + `DECISIONS.md` (D-24086 lands at execution)

**~8 code/test files + 1 wiring + governance. Standard two-session lane** (new contract file + new table + new endpoints + catalog). No other files may be modified.

---

## Contract

- **Endpoints** (all JSON): `POST /api/me/loadouts` `{name, lagn}` → `201 {SavedLoadoutView}` | typed error; `GET /api/me/loadouts` → `200 {loadouts: SavedLoadoutView[]}`; `PATCH /api/me/loadouts/:id` `{name?, visibility?}` → `200 {SavedLoadoutView}`; `DELETE /api/me/loadouts/:id` → `204`; `GET /api/loadouts/:shareSlug` (guest) → `200 {name, lagn, displayHandle}` | `404`.
- **Closed error union** `LoadoutLibraryErrorCode`: `'unauthorized' | 'not_found' | 'invalid_lagn' | 'invalid_name' | 'loadout_limit_reached'` (+ the generic 500). Canonical `readonly` array + drift test.
- **Auth** ∈ `{ authenticated-session-required (the /api/me/* four), guest (the slug read) }` per D-9905.
- **Locked value:** `MAX_SAVED_LOADOUTS_PER_ACCOUNT = 50`.
- Canonical field names in the LAGN body match `00.2` / the LAGN schema exactly.

---

## Acceptance Criteria

1. Migration `022` creates `legendary.player_loadouts` with the columns/constraints in Scope A (FK CASCADE on `player_id`, `visibility` CHECK, partial-unique `share_slug`) (**AC-1**).
2. `POST /api/me/loadouts` validates the body's `lagn` via `@legendary-arena/lagn` `validate`, enforces the 50-per-account cap (`loadout_limit_reached` on the 51st), trims+bounds `name` (`invalid_name` on empty/over-80), and inserts scoped to the caller's account (**AC-2**).
3. `GET /api/me/loadouts` returns only the caller's loadouts; `PATCH`/`DELETE` by `:id` operate only on the caller's own rows (account B gets `not_found` for account A's id — cross-account isolation) (**AC-3**).
4. `PATCH` to `visibility: 'public'` mints an opaque URL-safe `share_slug`; to `'private'` clears it; `GET /api/loadouts/:shareSlug` returns a **public** loadout's `name` + `lagn` + `displayHandle` and `404` for a missing/private slug — never `accountId`/`ext_id`, never a private loadout (**AC-4**).
5. Every non-200 path returns a typed `LoadoutLibraryErrorCode`; the code has a canonical `readonly` array asserted by a drift test; no route throws uncaught (typed 500) (**AC-5**).
6. `apps/server` imports `@legendary-arena/lagn` and nothing else newly cross-layer; no `boardgame.io`/engine/registry-runtime import in the new files; `apps/server/package.json` lists `@legendary-arena/lagn` (**AC-6**).
7. `api-endpoints.md` has the 5 new rows (closed `Status`/`Auth` sets) added in the same commit as the routes (D-11804); `00.3 §21` passes (**AC-7**).
8. `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` green (new suites pass; DB-less env skips DB-backed cases exactly as the existing profile suites do, failing set unchanged) (**AC-8**).

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build   # Expected: exits 0

# Step 2 — server tests (new suites; DB-less skip parity)
pnpm --filter @legendary-arena/server test
# Expected: new loadoutLibrary suites present; failing/skip set == baseline + these new suites

# Step 3 — the LAGN validator is the only new cross-layer import
Select-String -Path "apps\server\src\profile\loadoutLibrary.*.ts" -Pattern "boardgame.io|@legendary-arena/game-engine|@legendary-arena/registry"
# Expected: no output
Select-String -Path "apps\server\src\profile\loadoutLibrary.logic.ts" -Pattern "@legendary-arena/lagn"
# Expected: present

# Step 4 — the cap constant + closed error union exist
Select-String -Path "apps\server\src\profile\loadoutLibrary.types.ts" -Pattern "MAX_SAVED_LOADOUTS_PER_ACCOUNT|loadout_limit_reached|LoadoutLibraryErrorCode"

# Step 5 — the 5 catalog rows landed
Select-String -Path "docs\ai\REFERENCE\api-endpoints.md" -Pattern "/api/me/loadouts|/api/loadouts/"

# Step 6 — scope
git diff --name-only   # Expected: only the ## Files Expected to Change set
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Migration `022` present; `player_loadouts` shape per Scope A
- [ ] `loadoutLibrary.types.ts` / `.logic.ts` / `.routes.ts` created; LAGN-validated writes; 50-cap; opaque server-minted `share_slug`; guest read returns public-only (no `accountId`)
- [ ] `server.mjs` wires `registerLoadoutLibraryRoutes` (01.5); `apps/server/package.json` adds `@legendary-arena/lagn`
- [ ] Tests cover create/list/update/delete, cap, invalid-LAGN, guest public-only + 404, cross-account isolation, error-code drift; `node:test`, no `boardgame.io`
- [ ] `api-endpoints.md` 5 rows added same-commit (D-11804); closed `Status`/`Auth` sets
- [ ] `pnpm -r build` 0; server test green (DB-less skip parity)
- [ ] `DECISIONS.md` **D-24086** landed (Active); `WORK_INDEX` (WP-301) + `EC_INDEX` (EC-332) + `STATUS.md` updated
- [ ] **User-visible verification (D-24026):** N/A for this packet (no UI) — the live check is deferred to **WP-302**. This packet's proof is the test suite + a DB-backed manual `curl`/psql smoke of the 5 endpoints against a real Postgres (documented in the execution session), NOT a `play.legendary-arena.com` screenshot.

---

## Vision Alignment

**Vision clauses touched:** **§19b** (this packet's authority — the profile loadout library), §19a (decorative-not-merit), §19 (LAGN export format). No scoring / PAR / replay / RNG surface.

**Conflict assertion:** No conflict — the packet *implements* §19b exactly: saved loadouts are decorative, account-scoped, editable, shareable, and **explicitly excluded** from any competitive-submission path (no `competitive_scores`/leaderboard touch). The guest share read exposes only public, user-authored content.

**Non-Goal proximity check:** Crosses none of NG-1..7. **Not pay-to-win (NG-1)** — a saved deck file confers no gameplay advantage; the cap + future "unlimited" tier is a cosmetic/convenience quota, not power. **PvP terminology (§23(b)):** "loadout" / "library" / "share" carry no match/opponent/win-loss framing. The monetization hook (free cap → premium unlimited) is normal commerce, not gated power.

**Determinism preservation:** N/A — profile persistence; no engine, `G`, replay, RNG, or hash surface. `lagn_json` is opaque application data, never game state.

---

## Lint Gate Self-Review (00.3)

- §1 Structure — PASS: all required sections; `## Out of Scope` lists ≥2 (client UI, competitive path, premium enforcement, engine surface).
- §2 Non-Negotiable Constraints — PASS: server-side validate, cap, opaque slug, public-only guest read, single authorized new import; cites `00.6`.
- §3 Assumes — PASS: auth pattern, ownership keying, `@legendary-arena/lagn` shape, migration number — each with a file source.
- §4 Context — PASS: §19b/§19a, the real `ownerProfile.*` pattern, ARCHITECTURE import rule + the new-import authorization, migration 009, `00.2`, D-11804.
- §5 Output Completeness — PASS: 8 code/test + 1 wiring + catalog + governance, each new/modified with a role; standard lane (>4 files, new contract — correctly NOT lightweight).
- §6 Naming — PASS: `SavedLoadoutView`, `loadoutLibrary.*`, `MAX_SAVED_LOADOUTS_PER_ACCOUNT`, `share_slug`; canonical LAGN field names preserved; no abbreviations.
- §7 Dependency Discipline — PASS: adds exactly one workspace dep (`@legendary-arena/lagn`, zod-only); no new third-party runtime dep.
- §8 Architectural Boundaries — PASS (Server): no game logic, no engine/registry-runtime/`boardgame.io` import; the one new import is a pure validator authorized by D-24086; grep-gated.
- §9 Windows Compatibility — PASS: `pwsh` + `Select-String` + `\` paths.
- §10 Env Var Hygiene — N/A: no new env var (reuses the `pool` + auth deps).
- §11 Authentication Clarity — PASS: the four `/api/me/loadouts*` are `authenticated-session-required` (reuse `requireAuthenticatedSession`); the slug read is `guest` and exposes public-only data. No new identity model or secret.
- §12 Test Quality — PASS: `node:test`; cap / invalid-LAGN / cross-account isolation / guest public-only+404 / drift; DB-less skip parity with the existing profile suites.
- §13 Commands & Verification — PASS: exact `pnpm` + `Select-String` with expected output.
- §14 Acceptance Criteria — PASS: 8 binary, observable items naming real tables/endpoints/codes.
- §15 Definition of Done — PASS: binary checkboxes incl. DECISIONS/indices/catalog + commit topology; §15.1 addressed.
- §15.1 User-Visible Verification (D-24026) — PASS (N/A-with-reason): no UI in this packet; the live check is explicitly deferred to WP-302; this packet's proof is the suite + a DB-backed endpoint smoke, stated as such (not a tests-only hand-wave).
- §16 Code Style — PASS: `for...of`/explicit `if-else` (no branching `.reduce()`); typed result unions; `// why:` on the slug-opacity + cap + server-validate decisions; JSDoc per function; named imports.
- §17 Vision Alignment — PASS: `## Vision Alignment` present; §19b/§19a/§19; NG-1 + §23(b) addressed; determinism N/A.
- §18 Prose-vs-Grep — PASS: verification greps target identifiers (`@legendary-arena/lagn`, `MAX_SAVED_LOADOUTS_PER_ACCOUNT`), not a count-literal echoed adjacent to its own check.
- §19 Bridge-vs-HEAD — N/A: no repo-state snapshot artifact.
- §20 Funding Surface Gate — N/A: profile persistence; no donate/support/tournament-funding copy or affordance.
- §21 API Catalog Update — **APPLIES**: 5 new server endpoints → `api-endpoints.md` rows added same-commit at execution (D-11804), closed `Status`/`Auth` sets. Called out in Scope F + DoD.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): READY.** Dependencies verified on source (WP-104 route pattern, WP-160 auth, WP-244 `@legendary-arena/lagn`, WP-291 precedent, §19b ratified in this PR). Scope locked to the ~8-file allowlist + wiring + catalog. New contract file (`loadoutLibrary.types.ts`) + new table → **standard two-session lane, correctly not lightweight** (D-24028 forbids the lane for new contract files). No validation-tightening of an existing input path (net-new endpoints), so `01.4 §Empirical Scaffold` does not apply.

**Copilot (01.7): PASS.** Real failure modes pinned: (a) trusting client LAGN → **server-side `validate` mandatory**; (b) leaking private loadouts / `accountId` via the guest read → **public-only + slug-opacity + no-id guardrails + isolation test**; (c) an unbounded library → **50-cap with a typed error + test**; (d) cross-account id access → **isolation AC-3 + test**; (e) a new cross-layer import sneaking in → **grep gate + single-import authorization (D-24086)**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24086**: (1) the `player_loadouts` data model + `/api/me/loadouts` + guest-slug contract; (2) authorization for `apps/server` to import `@legendary-arena/lagn` (a pure zod validator, no upward/sideways runtime edge — the first server import of a non-`registry`/`game-engine` workspace validator, added to the ARCHITECTURE allowed-import set for the server layer); (3) the decorative-not-merit lock (cites §19b — saved loadouts are never a competitive submission); (4) `MAX_SAVED_LOADOUTS_PER_ACCOUNT = 50` (free-tier quota; premium-unlimited is a future, un-reserved hook). Drafted 2026-07-01; not yet landed.
