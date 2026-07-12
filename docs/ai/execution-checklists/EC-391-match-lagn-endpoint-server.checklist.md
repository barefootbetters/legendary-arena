# EC-391 — Current-Match Loadout as LAGN (Server) (WP-361)

**Pairs with:** WP-361 · **Reserves:** D-24153 · **Lane:** standard two-session · **Status:** executed 2026-07-12
**Layer:** Server (`apps/server`).

> **EC number note:** WP-364 (hero gain-wound keywords) also reserved `EC-391` at
> draft. WP-361 executed first and claimed `EC-391` (matching its own body
> reference); WP-364 must take a fresh EC number when it executes.

## Before Starting
- [x] Baseline `origin/main` @ `72ac5655`; WP-309 (`bgio.matches` store), WP-334 (`readMatchForReplay`), WP-333 (`readSeatAccounts`), WP-112 (`requireAuthenticatedSession`), WP-301 (server imports `@legendary-arena/lagn`) all on `main`.
- [x] Isolated worktree off `origin/main` (concurrent sessions live on the repo); `pnpm install` + `pnpm -r build` (apps consume the lagn/registry dist).

## Locked Values
- **Endpoint:** `GET /api/match/:matchId/lagn`, `authenticated-session-required` + participant gate. `200 → { lagn }` (single top-level key). Status domain `{200,401,403,404,500}`; `Cache-Control: no-store` first.
- **Setup source:** `bgio.matches.initial_state.G.matchConfiguration` (9 fields) + `initial_state.ctx.numPlayers` — a thin `SELECT initial_state`-only read (the **D-24153** carve-out extension; **no** domain table, **no** create-path write).
- **Participant gate:** session `AccountId` ∈ `readSeatAccounts(matchId)` else `403 { error: 'not_a_participant' }`.
- **Fail-closed:** absent row AND null `initial_state` both → `404 { error: 'match_not_found' }` (indistinguishable — no match-existence oracle).
- **Field rename:** `officersCount → setup.shield_officers_count` (only non-1:1). **Variant:** `numPlayers === 1` → `'solo'`, else `'cooperative'`. **`game_id`** = matchId.
- **Names:** canonical registry display name (`registry.listCards()` `extId → name`), else the ext_id verbatim — no synthesis.
- **Validation ownership:** `buildMatchLagn` is **construction-only** (never validates); the route calls `validate()` **exactly once** before `200`; failure → `500 { error: 'lagn_projection_failed' }` (a corrupt `numPlayers` lands here).

## Guardrails
- [x] No `boardgame.io` / `@legendary-arena/game-engine` import in the new files; only `@legendary-arena/lagn` (validate/type) + `@legendary-arena/registry` (`CardRegistry` type).
- [x] Read-only — no `bgio.*` / `legendary.*` write, no registry mutation, no name cache beyond the per-registration lookup, no LAGN persistence. A convenience projection, never round-tripped into gameplay.
- [x] Mapper never throws — a non-array group field → `[]` (fails `validate()`); `numPlayers` passed through un-coerced.
- [x] 9-field drift test: mapper consumes exactly the sanctioned 9 fields; an extra field never leaks.

## Required Comments (`// why:`)
- [x] The thin `SELECT initial_state`-only read + the D-24153 carve-out.
- [x] The `officersCount → shield_officers_count` rename (only non-1:1).
- [x] `Cache-Control` first-statement (WP-115 D-11504); the `unknown_account → 401` probe defense.

## Files Produced
- `apps/server/src/match/matchLagn.logic.ts` (reader + construction-only mapper + `buildNameResolver`)
- `apps/server/src/match/matchLagn.routes.ts` (`registerMatchLagnRoutes`, auth + participant gate + validate-once)
- `apps/server/src/match/matchLagn.logic.test.ts` / `matchLagn.routes.test.ts`
- `apps/server/src/server.mjs` (one `registerMatchLagnRoutes(...)` wiring, `registry` threaded)
- `docs/ai/ARCHITECTURE.md` + `.claude/rules/architecture.md` (D-24153 §Persistence Boundary carve-out + mirror)
- `docs/ai/REFERENCE/api-endpoints.md` (1 `Wired` row, D-11804)

## After Completing
- [x] `pnpm -r build` 0; server suite `pass 796 / fail 0 / skipped 154` (16 new pure tests pass; DB-gated skip parity — no `TEST_DATABASE_URL`).
- [x] D-24153 → Active; WORK_INDEX WP-361 `[x]`; EC_INDEX + STATUS updated; `api-endpoints.md` (§21) + ARCHITECTURE/rules carve-out.
- [ ] **D-24026:** N/A — `User-Visible Surface = none — infrastructure`. The read API is consumed by WP-363 (blocked on WP-362 + this); optional DB smoke: create+join a match → `GET /api/match/:matchId/lagn` with the seat's session → a valid Tier-1 LAGN, a non-participant → `403`.
