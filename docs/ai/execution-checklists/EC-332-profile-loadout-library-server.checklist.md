# EC-332 — Profile Loadout Library: Data Model + Endpoints (Server) — Execution Checklist

**Source:** docs/ai/work-packets/WP-301-profile-loadout-library-server.md
**Layer:** Server + Persistence (`apps/server`, `data/migrations`) · **Standard two-session lane** (D-24028)

## Before Starting (Hard Gate)
- [ ] §19b ratified on `main`: `grep -c "19b. Profile Loadout Library" docs/01-VISION.md` ≥ 1 (the authority clause this packet implements)
- [ ] Auth pattern present to mirror: `grep -c "requireAuthenticatedSession" apps/server/src/profile/ownerProfile.routes.ts` ≥ 1
- [ ] LAGN validator importable (zod-only, no boardgame.io): `packages/lagn-spec/package.json` deps = `zod` only; exports `validate` + `LAGN`
- [ ] Migration number free: `022` is the next unused in `data/migrations/` (highest on disk = `021`)
- [ ] Baseline: `pnpm -r build` → 0; `pnpm --filter @legendary-arena/server test` → record pass/skip/fail counts (DB-less env skips DB-backed cases). At close: same, plus the new loadoutLibrary suites; no other suite delta

## Locked Values (do not re-derive)
- Table: `legendary.player_loadouts` — `id uuid PK`, `player_id bigint FK→players(player_id) ON DELETE CASCADE`, `name text` (1–80, trimmed), `lagn_json jsonb`, `visibility 'private'|'public'` (CHECK, default private), `share_slug text UNIQUE` (partial-unique WHERE NOT NULL), `created_at`/`updated_at timestamptz`
- Ownership keying: resolve `ext_id → player_id` inline (`WHERE player_id = (SELECT player_id FROM legendary.players WHERE ext_id = $1 LIMIT 1)`) — the migration-009 profile pattern, NOT an `account_id text` column
- **`MAX_SAVED_LOADOUTS_PER_ACCOUNT = 50`** — a 51st create → `loadout_limit_reached`
- Closed error union `LoadoutLibraryErrorCode`: `'unauthorized' | 'not_found' | 'invalid_lagn' | 'invalid_name' | 'loadout_limit_reached' | 'empty_update'` (+ generic 500) — canonical `readonly` array `LOADOUT_LIBRARY_ERROR_CODES` + drift test (mirror `OWNER_PROFILE_ERROR_CODES`)
- Endpoints: `POST/GET /api/me/loadouts`, `PATCH/DELETE /api/me/loadouts/:id` (**authenticated-session-required**); `GET /api/loadouts/:shareSlug` (**guest**). `Auth` ∈ D-9905 closed set
- `share_slug`: server-minted via `crypto.randomBytes(SHARE_SLUG_BYTES=16)` → `base64url` (**≥128 bits, 22 chars**), opaque — NEVER derived from `id`/`name`/`accountId`; **collision-retried** until unique; `null` when private
- **List ordering:** `GET /api/me/loadouts` returns rows `updated_at DESC`
- **Name:** trimmed before validation, persisted trimmed; empty-after-trim or >80 → `invalid_name`
- **LAGN storage:** persist the parsed `lagn` JSON value that passed `validate` into `jsonb` (Postgres canonicalizes); never the raw request text (lagn-spec `validate` returns `{valid}` only — do NOT change it)
- **Visibility→slug transitions:** `private→public` mint · `public→public` **preserve** · `public→private` clear · `private→private` leave `null`
- **PATCH semantics:** neither `name` nor `visibility` → `empty_update` (400), no write; any real change → `updated_at = now()`
- **Malformed `:id`** (not a well-formed UUID) → `not_found` (no existence leak)

## Guardrails
- **Validate server-side always** — `@legendary-arena/lagn` `validate` on every create/update before write; invalid → `invalid_lagn`, never stored. Never trust client validation
- **Guest read is public-only** — `GET /api/loadouts/:shareSlug` returns `404` for missing/private; body carries only `name` + `lagn` + `displayHandle`; NEVER `accountId`/`ext_id`, NEVER a private loadout
- **Cross-account isolation** — every `/api/me/*` op resolves the caller's `player_id` and scopes the query; account B operating on account A's `:id` returns `not_found` (no existence leak)
- **Cap enforced with a typed error** — the 51st create → `loadout_limit_reached` (not a silent drop, not a 500)
- **One new cross-layer import only** — `@legendary-arena/lagn` in the logic; NO `boardgame.io`/engine-runtime/registry-runtime anywhere in the new files. Add `@legendary-arena/lagn` to `apps/server/package.json`
- Auth-first, typed-error, `Cache-Control` on every response path — mirror `ownerProfile.routes.ts` / `avatarUpload.routes.ts`. Every DB call in `try/catch` → typed 500
- `for...of` / explicit `if/else` (no branching `.reduce()`); full-word names; JSDoc per function; `// why:` where required below

## Required `// why:` Comments
- On the server-side `validate` (never trust client LAGN; invalid input must not reach storage)
- On `share_slug` opacity (random/URL-safe via `crypto.randomBytes`, never derived — a derived slug would leak `id`/enumerate)
- On the slug-collision retry loop (partial-unique index is the backstop; retry keeps the mint deterministic-free of the race)
- On the guest read's field allowlist (public-only projection — no `accountId`/`ext_id`, no private rows)
- On `MAX_SAVED_LOADOUTS_PER_ACCOUNT` (free-tier quota; premium-unlimited is a future hook, not this packet)
- On the `empty_update`/`updated_at` rule (a no-field PATCH writes nothing; any real change bumps the timestamp)

## Files to Produce
- `data/migrations/022_create_player_loadouts.sql` (new)
- `apps/server/src/profile/loadoutLibrary.types.ts` (new — contract) / `.logic.ts` (new) / `.routes.ts` (new)
- `apps/server/src/profile/loadoutLibrary.logic.test.ts` + `.routes.test.ts` (new)
- `apps/server/src/server.mjs` (modify — one `registerLoadoutLibraryRoutes(...)` wiring call, 01.5)
- `apps/server/package.json` (modify — add `@legendary-arena/lagn` workspace dep)
- `docs/ai/REFERENCE/api-endpoints.md` (modify — 5 rows, D-11804, whole-row)
- `WORK_INDEX.md` + `EC_INDEX.md` + `STATUS.md` + `DECISIONS.md` (D-24086 lands Active)

## File Responsibilities (no logic duplication)
- `loadoutLibrary.logic.ts` — the SINGLE source of validate + cap + slug-mint + SQL; routes only parse/auth/map-errors
- `loadoutLibrary.routes.ts` — auth-first orchestration + typed-error → HTTP mapping; no SQL or validation logic inline
- `loadoutLibrary.types.ts` — the closed contract (view shapes, error union + array, deps bundle); locked once created

## Required Test Matrix (every row required)
- create → 201 + row scoped to caller; list → only caller's rows, ordered `updated_at DESC`
- 51st create → `loadout_limit_reached`; empty/over-80 name → `invalid_name`; whitespace-padded name → stored trimmed; malformed LAGN → `invalid_lagn` (nothing written)
- PATCH visibility public → `share_slug` minted; **`public→public` PATCH preserves the same slug**; private → cleared; guest slug read → public row's `name`+`lagn`+`displayHandle`; private/missing slug → 404 (no `accountId` in any body)
- PATCH with a real change bumps `updated_at`; **PATCH with neither field → `empty_update` (400), no row written**
- slug-collision path: inject a colliding generator then a unique one → mint retries and succeeds (final slug unique)
- account B PATCH/DELETE/GET account A's `:id` → `not_found` (isolation); malformed-UUID `:id` → `not_found`
- drift: `LOADOUT_LIBRARY_ERROR_CODES` set-equals the union (incl. `empty_update`), no duplicates

## After Completing
- [ ] Migration 022 shape per Locked Values; `.types`/`.logic`/`.routes` created; validate+cap+opaque-slug(`randomBytes`/collision-retry)+preserve-on-`public→public`+`updated_at DESC` list+trimmed-name+`empty_update`+malformed-`:id`→`not_found`+public-only-guest all present
- [ ] `server.mjs` wires the routes; `apps/server/package.json` adds `@legendary-arena/lagn`; no forbidden import (grep clean)
- [ ] Test matrix green; `node:test`, boardgame.io-free; DB-less skip parity with existing profile suites
- [ ] `api-endpoints.md` 5 rows (closed Status/Auth); `pnpm -r build` 0; server test green
- [ ] `DECISIONS.md` D-24086 landed Active; WORK_INDEX (WP-301) / EC_INDEX (EC-332) / STATUS flipped
- [ ] Commit prefix `EC-332:` (code) + `SPEC:` (governance); D-24026 N/A this packet (UI is WP-302) — proof = suite + DB-backed endpoint smoke, documented
- [ ] Hand off to **WP-302** (client owner-profile UI) — note the contract is now on `main`

## Common Failure Smells
- Every LAGN accepted / bad file stored → server-side `validate` was skipped (client validation is not the gate)
- A share link exposes a private loadout or an `accountId` → the guest projection wasn't allowlisted / slug wasn't opacity-checked
- Account B can read/edit account A's loadout → the query didn't scope by the resolved `player_id`
- Library grows unbounded → the cap check is missing or runs after insert
- A `public→public` PATCH changes the share link → the slug is being re-minted on every update instead of preserved (breaks already-shared links)
- A no-field PATCH silently succeeds / touches `updated_at` → the `empty_update` guard is missing
- `pnpm -r build` fails on `@legendary-arena/lagn` resolution → workspace dep not added to `apps/server/package.json`
- Typecheck fails importing engine/registry types → use only `@legendary-arena/lagn` + `pg` + local types
