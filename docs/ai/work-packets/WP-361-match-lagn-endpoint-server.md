# WP-361 — Current-Match Loadout as LAGN: `GET /api/match/:matchId/lagn` (Server)

**Status:** Draft 2026-07-11 · **READY (not blocked — all hard-deps Done)** · **Standard two-session lane** (D-24028 — new pure mapper + a thin blob reader + one endpoint + a persistence-boundary carve-out extension + a catalog row). Pairs with **EC-391** (authored at execution-prep). Reserves **D-24153** (lands at execution).
**Primary Layer:** Server (`apps/server`)
**User-Visible Surface:** **none — infrastructure.** No user-observable change by itself; it is the read API the WP-363 play-surface "View loadout" link consumes. The visible payoff lands in WP-362 (viewer ingest) + WP-363 (client link).
**Dependencies:** WP-309 (`bgio` Postgres match store — D-24095) ✅ **Done**; WP-334 (`readMatchForReplay` blob-read precedent + `matchReplay.logic.ts`) ✅; WP-333 (`readSeatAccounts` — the participant guard) ✅; WP-112 (`requireAuthenticatedSession` orchestrator) ✅; WP-301 (server already imports `@legendary-arena/lagn` — `loadoutLibrary.logic.ts`) ✅. **No unmerged dependency — executable now.**
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution).

---

## Session Context

WP-334/336 established the D-24119 faithful-replay carve-out that reads the WP-309 `bgio.matches` blob server-side (`readMatchForReplay`); WP-333 locked `readSeatAccounts` as the authenticated match roster; this packet reuses both to project a **read-only Tier-1 LAGN** of a match's setup, and extends the persistence-boundary carve-out (D-24095/D-24119) to name that new read.

---

## Goal

`apps/server` gains a read-only endpoint `GET /api/match/:matchId/lagn` that returns the **current match's setup as a Tier-1 LAGN document** (`@legendary-arena/lagn`). It reads the 9-field composition + player count already persisted verbatim in the `bgio.matches` blob at `initial_state.G.matchConfiguration` (+ `initial_state.ctx.numPlayers`), resolves each ext_id to its display name via the startup registry (name-falls-back-to-id), maps it to Tier-1 LAGN, validates it with the published `validate()`, and returns `{ lagn }`. Access is gated to authenticated **participants** of the match (session `AccountId` present in `readSeatAccounts(matchId)`). This is the server half that WP-363's play-surface link fetches and WP-362's viewer ingests.

---

## User-Visible Impact

**None — infrastructure. No user-observable change; this packet's payoff is the read API that WP-363's "View loadout in Registry Viewer" play-surface link consumes** (and WP-362's `?lagn=` viewer ingest renders). A player sees nothing new until WP-362 + WP-363 ship.

---

## Assumes

- **The composition is durably in the blob.** `bgio.matches.initial_state` (WP-309 / D-24095) stores the boardgame.io initial state; `initial_state.G` **is** the engine's `LegendaryGameState`, whose readonly `matchConfiguration` is the full 9-field `MatchSetupConfig` and whose `ctx.numPlayers` is the seat count. (Verified: `apps/server/src/replay/matchReplay.logic.ts` blob shape; `packages/game-engine/src/types.ts` `LegendaryGameState.matchConfiguration`; `matchCapture.logic.ts` already reads `(finalState).selection.*` off the same blob.)
- **`readMatchForReplay(matchId, db)` (WP-334) is the sanctioned blob read** returning `{ initialState, log, metadata } | null` (null when the row is absent OR `initial_state` is null — a setState-upsert row is **not** reconstructable). This packet adds a **thinner** dedicated reader that SELECTs `initial_state` only (no `log`), but the null/absent fail-closed semantics are identical. (Verified: `matchReplay.logic.ts` `readMatchForReplay`.)
- **`readSeatAccounts(matchId, db)` (WP-333) returns the authenticated roster** `{ playerId, accountId }[]` from `legendary.match_seat_accounts` — the participant guard. Bots/guests have no row; all human seats are authenticated (WP-307/308). (Verified: `apps/server/src/match/seatAccount.logic.ts`.)
- **`requireAuthenticatedSession` (WP-112) resolves the caller's `AccountId`** first, exactly as `matchGate.routes.ts` / `competition.routes.ts` do. (Verified: `apps/server/src/match/matchGate.routes.ts`.)
- **The server may import `@legendary-arena/lagn`** — it already does in `apps/server/src/profile/loadoutLibrary.logic.ts` (a pure zod validator, no upward edge; sanctioned by the import rules). (Verified: `apps/server/package.json` `"@legendary-arena/lagn": "workspace:*"`.)
- **The registry is loaded at startup** (`server.mjs` `loadRegistry()` / `setRegistryForSetup`) and can be handed to the new route handler for name resolution. Today it is not passed to route handlers — this packet threads it into the new route registration.
- **CORS already allowlists the callers.** `Server({ origins: [...] })` in `server.mjs` already includes `https://play.legendary-arena.com` (the WP-363 caller); no CORS change. (Verified: `server.mjs` `origins:` array.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- [`docs/ai/ARCHITECTURE.md §Persistence Boundary`](../ARCHITECTURE.md) + [`.claude/rules/architecture.md §Persistence Boundary (Cross-Layer)`](../../../.claude/rules/architecture.md) — the D-24095 framework-store exemption + the D-24119 replay/verification carve-out. **This packet extends that carve-out** (see Scope G) to name a read-only Tier-1 LAGN loadout projection; read the exact wording before editing.
- `apps/server/src/replay/matchReplay.logic.ts` — `readMatchForReplay` (the fail-closed blob-read pattern to mirror; the new thin reader lives beside it or in a new `match/` module).
- `apps/server/src/match/seatAccount.logic.ts` — `readSeatAccounts` (participant guard).
- `apps/server/src/match/matchGate.routes.ts` + `apps/server/src/competition/competition.routes.ts` — the `authenticated-session-required` route + typed-error + `Cache-Control: no-store` precedent; auth resolved first.
- `apps/server/src/profile/loadoutLibrary.logic.ts` — the existing server `import { validate, type LAGN } from '@legendary-arena/lagn'` usage.
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` (`compositionToLagnSetup`) + `apps/arena-client/src/lobby/lagnLoadout.ts` (the inverse) — the **exact** composition↔LAGN field mapping to mirror, incl. the one rename `officersCount` → `setup.shield_officers_count`.
- `docs/ai/REFERENCE/00.2-data-requirements.md §7-§8.1` — the 9 canonical `MatchSetupConfig` field names + the S.H.I.E.L.D. officers pile naming.
- `packages/lagn-spec/src/validator.ts` (`GameSetupSchema`, root `variant`/`player_count`) — the Tier-1 target shape + enums.
- `docs/ai/REFERENCE/api-endpoints.md` + `00.3 §21` / D-11804 — the new endpoint's catalog row (lands at execution).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:`), Rule 11 (full-sentence errors), Rule 13 (ESM), Rule 14 (field names match contract).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+; `node:` prefix on built-ins; `.test.ts` (never `.test.mjs`); human-style code per `00.6`; full-sentence errors; `// why:` on non-obvious choices; JSDoc on every function; no branching `.reduce()`.
- Full file contents for every new/modified file in the output — no diffs, no snippets.

**Packet-specific:**
- **Read-only, no mutation.** The endpoint never writes `bgio.*` or `legendary.*`; it never writes back to the blob. It also **never mutates the startup registry, caches derived names, or persists any LAGN artifact** — the projection is built fresh per request and discarded. It is a derived projection (D-24153 carve-out) exactly like the D-24119 reducer read — a **convenience representation, not a source of truth; the persisted match blob remains authoritative** — never a save-game, never a source of competitive/derived features, never round-tripped back into gameplay state.
- **Blob read is minimal.** The new reader SELECTs `initial_state` only (not `log`); it maps **only** `initial_state.G.matchConfiguration` (the 9 fields) + `initial_state.ctx.numPlayers`. No `log` reduction, no `deltalog`, no engine import.
- **No engine / `boardgame.io` / registry-runtime import.** The mapper is a pure function over the plain composition object + the registry name lookup passed in; the server does not import `@legendary-arena/game-engine` or `boardgame.io`. `@legendary-arena/lagn` (pure zod) and `@legendary-arena/registry` (for names) are the only new imports, both already in the server's allowed set.
- **Fail closed.** Unknown match, `initial_state === null` (unreplayable), or a non-participant caller → the endpoint returns without leaking the composition (`404` unknown/unreplayable; `403` authenticated-but-not-a-participant). No 200 with a partial/empty document.
- **Canonical names + the one rename.** Composition fields are the 00.2 §8.1 names verbatim; `officersCount` maps to LAGN `setup.shield_officers_count` (the only non-1:1 field). Never rename any other field.
- **Validation ownership is the route, exactly once.** `buildMatchLagn` MUST NOT validate — it only constructs the document. The route calls `validate()` from `@legendary-arena/lagn` exactly once, immediately before the `200`; a validation failure is a `500 { error: 'lagn_projection_failed' }` (server bug — the blob's stored composition should always be well-formed), never a silent partial return. No second validation anywhere.
- **Corrupt `numPlayers` is a `500`.** `initial_state.ctx.numPlayers` should always be an integer in `1..5`. If it is missing, non-numeric, or otherwise fails LAGN validation (LAGN `player_count` requires an int 1–5), the built document fails `validate()` and the route returns `500 { error: 'lagn_projection_failed' }` — the same fail-closed path as any other blob-shape regression. The mapper does not silently coerce or default it.
- **`Cache-Control: no-store`** set as the first statement of every response (200 and every error path), mirroring the competition/leaderboard handlers.

**Session protocol:**
- If the blob shape, the `matchConfiguration` field names, or the `variant`/`player_count` enum values are unclear, stop and read `matchReplay.logic.ts` / `packages/game-engine/src/types.ts` / `packages/lagn-spec/src/validator.ts` — do not invent the shape.

**Locked contract values:**

- **MatchSetupConfig fields** (source: `initial_state.G.matchConfiguration`): `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`.
- **LAGN Tier-1 rename:** `officersCount` → `setup.shield_officers_count` (only non-1:1 field; every other name is 1:1 snake_case).
- **LAGN `variant` derivation:** `numPlayers === 1` → `'solo'`; else → `'cooperative'` (mirrors `useLoadoutLagnExport` classic→solo / custom→cooperative; the game is co-op vs the Mastermind — never `'competitive'`).
- **LAGN `game_id`:** the `matchId` (a stable, unique per-match string).
- **Registry name source:** the ext_id's **canonical registry display name**; when the registry has no entry for the ext_id, fall back to the ext_id string **unchanged**. The resolver MUST NOT synthesize names, localize, title-case, or derive labels from any other metadata (heroes-only vs all-catalog search, canonical vs localized name, etc. are not choices — it is the one canonical display name or the raw ext_id).
- **Response envelope:** `{ lagn }` — a single top-level key. This envelope is **owned by WP-361**; WP-362/WP-363 read only `lagn` and MUST NOT depend on any additional top-level field.
- **`bgio` schema is not the `legendary.*` domain** (D-24095) — this read is the D-24153 carve-out extension, not a domain read.

---

## Debuggability & Diagnostics

The endpoint is a pure read: given the same persisted blob + registry, it returns the same LAGN byte-for-byte (deterministic; the mapper reads no clock/RNG). A failure is localizable to one of four observable states: match absent (`404`), `initial_state` null (`404`), caller not in `readSeatAccounts` (`403`), or a `validate()` failure on the built document (`500`, indicating an upstream blob-shape regression). The response is a plain JSON LAGN document, inspectable directly. No mutation, so no post-execution state to reconcile.

---

## Scope (In)

### A) `match/matchLagn.logic.ts` (new) — thin blob reader
- `readMatchConfigurationForLagn(matchId, database)` → `{ matchConfiguration, numPlayers } | null`:
  - `SELECT initial_state FROM bgio.matches WHERE match_id = $1` (parameterized). `null` when the row is absent OR `initial_state` is null (unreplayable) — same fail-closed semantics as `readMatchForReplay`.
  - Returns `initial_state.G.matchConfiguration` (the 9-field composition, typed as a plain object here — no engine import) + `initial_state.ctx.numPlayers`.
  - Add `// why:` — SELECTs `initial_state` only (not `log`) because the Tier-1 projection needs no move log; the D-24153 carve-out authorizes exactly this read.

### B) `match/matchLagn.logic.ts` — pure mapper `buildMatchLagn(...)`
- `buildMatchLagn(matchId, matchConfiguration, numPlayers, resolveName): LAGN` — pure, deterministic, side-effect-free, and **construction-only (it MUST NOT call `validate()`** — validation is the route's job, once):
  - Builds a Tier-1 `LAGN` (`lagn_version: '1.0.0'`, `game_id: matchId`, `variant` per the locked derivation, `player_count: numPlayers` as-read — no coercion/defaulting; a bad value fails the route's `validate()`, `setup`).
  - `setup.mastermind = { id: matchConfiguration.mastermindId, name: resolveName(mastermindId) }`, same for `scheme`; `villain_groups`/`henchmen_groups`/`heroes` map each id → `{ id, name: resolveName(id) }`; the four counts map 1:1 except `officersCount` → `shield_officers_count`.
  - The mapper reads **exactly** the 9 sanctioned `matchConfiguration` fields (the locked list) and no others — an extra field added to `MatchSetupConfig` later is ignored by construction and caught by the Scope F drift test.
  - No `card_catalog`, `replay`, or `result` (Tier-1 only).
- `resolveNameFromRegistry(registry)` — a small factory returning the `resolveName` closure over the startup registry lookup (the ONE closure the framework-free mapper needs; registry lookup is the only non-pure dependency, injected). `resolveName(extId)` returns the ext_id's **canonical registry display name**, or the ext_id string unchanged when absent. It MUST NOT synthesize, localize, or title-case names (per the Locked Values registry-name-source rule).

### C) `match/matchLagn.routes.ts` (new) — `registerMatchLagnRoutes(router, pool, deps)`
- `GET /api/match/:matchId/lagn`, `authenticated-session-required`:
  - `Cache-Control: no-store` first.
  - Resolve the caller's `AccountId` via `requireAuthenticatedSession` (auth-first; absent/invalid → `401` full-sentence `{ error }`).
  - `readMatchConfigurationForLagn(matchId, pool)` → `null` ⇒ `404 { error: 'match_not_found' }`. The endpoint **intentionally does not distinguish** a missing match row from an unreplayable row (`initial_state` null) — both return the same `404 { error: 'match_not_found' }` so the response never leaks whether a given matchId exists.
  - `readSeatAccounts(matchId, pool)` → caller's `AccountId` not present ⇒ `403 { error: 'not_a_participant' }`.
  - `buildMatchLagn(...)` with `resolveNameFromRegistry(registry)` (construction only). The route then calls `validate(lagn)` **exactly once**; failure ⇒ `500 { error: 'lagn_projection_failed' }` (blob-shape regression, incl. a corrupt `numPlayers`).
  - `200 { lagn }`.
  - Status domain locked to `{ 200, 401, 403, 404, 500 }`.
- `deps`: `{ requireAuthenticatedSession, verifier, accountResolver, registry }`.

### D) Wiring — `server.mjs`
- One `registerMatchLagnRoutes(server.router, pool, { …auth, registry })` in the existing route-wiring block; thread the already-loaded `registry` object into the deps (it is in scope where `loadRegistry()` resolves). 01.5 wiring only — no game logic.

### E) `api-endpoints.md` (D-11804, at execution)
- One new row: `Wired | GET | /api/match/:matchId/lagn | authenticated-session-required | :matchId path param | { lagn: LAGN (Tier-1) } | WP-361 | ...`. Canonical `matchId` spelling; status domain `{200,401,403,404,500}`.

### F) Tests
- `matchLagn.logic.test.ts` — `buildMatchLagn` maps all 9 fields + player_count; the `officersCount → shield_officers_count` rename; `variant` = `'solo'` at numPlayers 1, `'cooperative'` at ≥2; `resolveName` returns the registry display name when present and falls back to the ext_id **unchanged** when absent (a no-synthesis assertion: a known ext_id → its display name, an unknown ext_id → itself verbatim); the built document passes `validate()`; `readMatchConfigurationForLagn` returns null for an absent row / null `initial_state` (fixture-injected `DatabaseClient`).
- **9-field composition drift test** — assert `buildMatchLagn` consumes **exactly** the sanctioned 9 `matchConfiguration` fields and no others: feed a `matchConfiguration` fixture carrying the 9 fields **plus** an extra unsanctioned field (e.g. a stray key) and assert (a) the built `setup` is byte-identical to the same fixture without the extra field, and (b) the extra field appears nowhere in the output. `// why:` — a field added to `MatchSetupConfig` later must not silently leak into the LAGN projection; this test fails loudly when the sanctioned set changes.
- **Corrupt `numPlayers`** — `buildMatchLagn` with `numPlayers` of `0`, `8`, `null`, and non-numeric produces a document that **fails** `validate()` (proving the route's single `validate()` → `500` path); the mapper does not coerce or default it.
- `matchLagn.routes.test.ts` — auth-first (guest → `401`); unknown match → `404 match_not_found`; **unreplayable row (null `initial_state`) → the same `404 match_not_found`** (indistinguishable from unknown); non-participant authenticated caller → `403 not_a_participant`; participant → `200 { lagn }` (a single `lagn` top-level key, valid Tier-1); a blob whose `numPlayers`/composition fails validation → `500 lagn_projection_failed`; `Cache-Control: no-store` on every path; no `boardgame.io`/engine import in the new files.

---

## Out of Scope

- **No client, no viewer** — the play-surface "View loadout" link is **WP-363**; the registry-viewer `?lagn=` ingest is **WP-362**. This packet ships only the read API.
- **No Tier-2/Tier-3 LAGN** — `card_catalog` and `replay` are out; this is a setup-only (Tier-1) projection.
- **No `result` block** — a live/in-progress match has no outcome; even a finished match's outcome is out of scope here (Tier-1 setup only).
- **No new domain table, no match-create write** — the composition is already in the blob (the D-24153 carve-out reads it); WP-361 does not persist anything (the domain-table alternative was rejected — see D-24153).
- **No blob mutation, no write-back, no save-game semantics** — read-only projection only.
- **No engine / `G` / RNG / `boardgame.io` import.**
- Refactors or "while I'm here" cleanups to `matchReplay.logic.ts` / `seatAccount.logic.ts` are out of scope — they are consumed as-is.

---

## Files Expected to Change

- `apps/server/src/match/matchLagn.logic.ts` — **new** — thin `initial_state` reader + pure Tier-1 LAGN mapper + registry-name closure
- `apps/server/src/match/matchLagn.routes.ts` — **new** — `registerMatchLagnRoutes` (one `GET` endpoint, auth + participant gate)
- `apps/server/src/match/matchLagn.logic.test.ts` — **new** — `node:test` coverage (mapper + reader)
- `apps/server/src/match/matchLagn.routes.test.ts` — **new** — `node:test` coverage (auth / participant / status domain)
- `apps/server/src/server.mjs` — **modified** — one `registerMatchLagnRoutes(...)` wiring call (threads `registry` into deps)
- `docs/ai/ARCHITECTURE.md` — **modified** — extend the §Persistence Boundary D-24119 carve-out wording to name the D-24153 Tier-1 LAGN read (see Scope G intent)
- `.claude/rules/architecture.md` — **modified** — mirror the same carve-out sentence in §Persistence Boundary (Cross-Layer) (rules mirror, per the ARCHITECTURE↔rules sync obligation)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — one new `Wired` row (D-11804, at execution)
- Governance: `WORK_INDEX.md` + `DECISIONS.md` (**D-24153**) + `STATUS.md`. `EC_INDEX.md` + EC-391 at execution-prep.

**~2 new code + 2 tests + 1 wiring + 2 authority-doc edits + catalog. Standard two-session lane.**

---

## Contract

### Endpoint (`authenticated-session-required`)
`GET /api/match/:matchId/lagn` → `200 { lagn: LAGN /* Tier-1 */ }` · `401` (no session) · `403 { error: 'not_a_participant' }` · `404 { error: 'match_not_found' }` · `500 { error: 'lagn_projection_failed' }`. `Cache-Control: no-store` first, always.

### Locked Values
| Key | Value |
|---|---|
| Setup source | `bgio.matches.initial_state.G.matchConfiguration` (9 fields) + `.ctx.numPlayers` — the D-24153 carve-out read (no domain table, no create-path write) |
| Reader scope | `SELECT initial_state` only (not `log`); null row / null `initial_state` ⇒ fail-closed |
| Participant gate | caller `AccountId` ∈ `readSeatAccounts(matchId)` else `403 not_a_participant` |
| Field rename | `officersCount` → `setup.shield_officers_count` (only non-1:1) |
| `variant` | `numPlayers === 1` → `'solo'`, else `'cooperative'` (co-op; never `'competitive'`) |
| `game_id` | the `matchId` |
| Names | canonical registry display name for the ext_id; absent ⇒ ext_id string unchanged. No synthesis / localization / title-casing |
| Bad `numPlayers` | missing / non-numeric / not 1–5 ⇒ fails `validate()` ⇒ `500 lagn_projection_failed` (no coercion/default) |
| Validation ownership | route calls `validate()` (published `@legendary-arena/lagn`) **exactly once** before `200`; `buildMatchLagn` never validates; failure ⇒ `500` |
| Response envelope | `{ lagn }` (single top-level key), owned by WP-361; consumers read only `lagn` |
| Authority | projection is a convenience representation, **not** a source of truth; the blob stays authoritative (never round-tripped back into gameplay) |

---

## Acceptance Criteria

1. `readMatchConfigurationForLagn` SELECTs `initial_state` only and returns `{ matchConfiguration, numPlayers }` for a valid row, `null` for an absent row or null `initial_state` (**AC-1**).
2. `buildMatchLagn` returns a Tier-1 `LAGN` mapping all 9 composition fields (incl. `officersCount → shield_officers_count`) + `player_count`, with `variant` `'solo'` at 1 player and `'cooperative'` at ≥2, `game_id` = matchId, and `resolveName` returning the registry display name when present / the ext_id unchanged when absent (no synthesis); it does **not** call `validate()` itself; the result passes `validate()` when run by the caller (**AC-2**).
3. The route is auth-first (guest → `401`), `404 match_not_found` for **both** an unknown match and an unreplayable (`initial_state` null) row indistinguishably, `403 not_a_participant` when the caller's `AccountId` is not in `readSeatAccounts`, `200 { lagn }` (single top-level `lagn` key) for a participant, and `500 lagn_projection_failed` when the built document fails validation; `validate()` is called exactly once, in the route; `Cache-Control: no-store` on every path; status domain `{200,401,403,404,500}` (**AC-3**).
4. Neither new file has a dependency edge to `boardgame.io` or `@legendary-arena/game-engine` — verified by both source inspection (no import statement, direct or aliased) and the build/module graph; the only new imports are `@legendary-arena/lagn` (validate/type) and `@legendary-arena/registry` (names). The `Select-String` grep is a supporting check, not the sole proof (**AC-4**).
5. The 9-field composition drift test passes: `buildMatchLagn` consumes exactly the sanctioned 9 `matchConfiguration` fields (an extra field on the fixture never appears in the output), and a corrupt `numPlayers` (`0`/`8`/`null`/non-numeric) produces a document that fails `validate()` (**AC-5**).
6. `server.mjs` wires exactly one `registerMatchLagnRoutes`, threading the startup `registry` into deps; the endpoint never mutates the registry, caches names, or persists any LAGN artifact; CORS unchanged (already allowlists `play.legendary-arena.com`) (**AC-6**).
7. `docs/ai/ARCHITECTURE.md §Persistence Boundary` + `.claude/rules/architecture.md` both name the D-24153 read-only Tier-1 LAGN carve-out (a convenience projection, blob stays authoritative); `api-endpoints.md` gains the one row (D-11804); `00.3 §21` passes (**AC-7**).
8. `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` — new suites green; DB-less skip parity; baseline otherwise unchanged (**AC-8**).

---

## Verification Steps

```pwsh
pnpm -r build   # 0
pnpm --filter @legendary-arena/server test   # matchLagn suites green; DB-less skip parity
Select-String -Path "apps\server\src\match\matchLagn.logic.ts","apps\server\src\match\matchLagn.routes.ts" -Pattern "boardgame.io|@legendary-arena/game-engine"   # no output
Select-String -Path "apps\server\src\match\matchLagn.logic.ts" -Pattern "shield_officers_count|matchConfiguration|initial_state"
Select-String -Path "docs\ai\REFERENCE\api-endpoints.md" -Pattern "/api/match/:matchId/lagn"
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "Tier-1 LAGN"   # the carve-out extension is present
git diff --name-only   # only the ## Files Expected to Change set
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `matchLagn.logic.ts` — thin `initial_state` reader (null fail-closed) + **construction-only** pure Tier-1 mapper (9 fields + rename + variant + canonical/id-fallback names, **no `validate()` inside the mapper**); the 9-field drift test + corrupt-`numPlayers` test pass
- [ ] `matchLagn.routes.ts` — one `GET` endpoint, auth-first, `403` participant gate, `404` unknown **and** unreplayable (indistinguishable), `500` on the single-`validate()` projection failure, `no-store` always, `{ lagn }` single-key envelope, status domain `{200,401,403,404,500}`
- [ ] No `boardgame.io`/engine dependency edge (source + build graph); read-only (no `bgio.*`/`legendary.*` write, no registry mutation, no name cache, no LAGN persistence)
- [ ] `server.mjs` wires once (registry threaded); CORS unchanged
- [ ] `ARCHITECTURE.md §Persistence Boundary` + `.claude/rules/architecture.md` mirror the **D-24153** Tier-1 LAGN carve-out; `api-endpoints.md` row (D-11804); `00.3 §21` passes
- [ ] `pnpm -r build` 0; server test green (DB-less skip parity)
- [ ] `DECISIONS.md` **D-24153** landed; `WORK_INDEX` (WP-361) + `STATUS.md` updated
- [ ] **User-visible verification (D-24026):** N/A — `User-Visible Surface = none — infrastructure`. STATUS.md states "No user-observable change — infrastructure only; the read API WP-363's play-surface link consumes." (An optional DB smoke: create+join a match, `GET /api/match/:matchId/lagn` with the seat's session → a valid Tier-1 LAGN; a non-participant session → `403`.)

---

## Vision Alignment

**Vision clauses touched:** §3 (player identity — participant-gated read), §10a (Registry Viewer public surface — the LAGN this feeds is rendered there via WP-362), §18/§22 (LAGN/replay data — this is a Tier-1 setup projection, not a replay). **Conflict assertion:** No conflict — a read-only derived projection of data already persisted; it changes no game state and no scoring. **Non-Goal check:** NG-1 (not pay-to-win — inspecting a loadout confers no advantage; both players already see the board). **Determinism:** the mapper reads no clock/RNG and re-derives the same LAGN from the same blob; it is a pure projection, replay-faithful by construction (Vision §22) — it neither writes back to the blob nor participates in scoring.

## Lint Gate Self-Review (00.3)

- §1–§21: PASS or N/A-with-reason. Highlights — §5 standard lane (new mapper + reader + endpoint + carve-out edit → not lightweight); §8 server boundary (no bgio/engine import; blob read is the sanctioned D-24153 projection; the mapper is a pure function over a plain object + injected registry lookup); §11 endpoint `authenticated-session-required`, session-resolved actor + participant gate; §15.1 surface = `none — infrastructure` → DoD requires the STATUS.md "no user-observable change" line (no live-on-surface gate); §17 §3/§10a/§22 addressed, determinism = pure projection; §21 APPLIES (1 row, at execution). §18 greps target identifiers + a no-bgio/engine absence check, not a count-echo.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): READY.** Hard-deps Done on `main` (WP-309 blob store, WP-334 `readMatchForReplay`, WP-333 `readSeatAccounts`, WP-112 auth, server-imports-lagn). No blocker. Scope locked to ~2 code + 2 tests + wiring + 2 authority-doc edits + catalog, single layer.

**Copilot (01.7): PASS.** Failure modes pinned: (a) reading the blob for a new purpose without sanction → **D-24153 carve-out extension in ARCHITECTURE.md + rules mirror**; (b) leaking a loadout to a non-participant → **`readSeatAccounts` `403` gate**; (c) leaking match existence → participant/unknown both fail-closed (`403`/`404`); (d) a wrong field mapping → **locked rename table + `validate()` gate + drift tests**; (e) pulling the whole replay log for a setup read → **thin `SELECT initial_state`-only reader**; (f) engine/bgio import creep → **pure mapper over a plain object + `Select-String` absence check**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24153**: current-match loadout as a read-only Tier-1 LAGN endpoint. Locks: (1) **`GET /api/match/:matchId/lagn`**, `authenticated-session-required` + a participant gate (`readSeatAccounts`); (2) the **persistence-boundary carve-out extension** — the server MAY read `bgio.matches.initial_state.G.matchConfiguration` (+ `ctx.numPlayers`) to project a match's **Tier-1 LAGN loadout**, a derived read-only projection (never written back, never a save-game, never a source of competitive/derived features), extending the D-24095/D-24119 blob-read carve-out; ARCHITECTURE.md §Persistence Boundary + the rules mirror gain the sentence; (3) **no new domain table and no match-create write** — the composition is already in the blob, so duplicating it (the rejected alternative) would add a migration, a hot-path write, and a backfill gap for no gain; (4) the locked field mapping (`officersCount → shield_officers_count`; `variant` `solo`/`cooperative` by seat count; `game_id` = matchId; canonical-registry-display-name-or-ext_id-unchanged names, no synthesis), built by a **construction-only** mapper and validated by the published `@legendary-arena/lagn` **exactly once in the route** before return (a corrupt `numPlayers` fails validation → `500`); (5) the projection is a **convenience representation, not a source of truth** — the persisted match blob remains authoritative, and the LAGN is never round-tripped back into gameplay state. The registry-viewer `?lagn=` ingest (WP-362) and the play-surface link (WP-363) are separate follow-ons. Drafted 2026-07-11; not yet landed.
