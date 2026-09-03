# EC-670 — Battle Plan API (Execution Checklist)

**Source:** docs/ai/work-packets/WP-635-battle-plan-api.md
**Layer:** Server (`apps/server`) + Persistence (DB migrations)

## Before Starting

- [ ] On `main`, clean, fast-forward synced; `origin/main` baseline recorded in the WP.
- [ ] `data/migrations/` latest is `044_create_match_guest_access.sql` (this WP adds 045).
- [ ] Read `apps/server/src/feedback/feedback.routes.ts` (module shape to clone) + `apps/server/src/match/seatAccount.logic.ts` (`readSeatAccounts`, the participant gate).
- [ ] Target file set = exactly the `## Files to Produce` list below; any file outside it is a FAIL, surfaced as a blocker before editing.

## Locked Values (do not re-derive)

- Table `legendary.battle_plan`; PK `id bigserial`; `match_id text NOT NULL UNIQUE` (one shared row per match, **no FK** — bgio owns match lifecycle).
- Phase columns: `pre_battle`, `battle_adjustments`, `post_battle` (all `text`, nullable). Request `phase` closed set maps 1:1 to these; unknown phase → `400 unknown_phase`.
- `BATTLE_PLAN_PHASE_MAX_LENGTH = 4000` (chars per phase). Over → `400 text_too_long`. Empty string is allowed (clears the phase).
- `updated_by_ext_id text NOT NULL` = the last editor's `legendary.players.ext_id` (D-5201). Stored for **audit only** — it is NOT projected in the GET response (never expose an internal ext_id; a future client WP adds a handle projection). `created_at` / `updated_at timestamptz DEFAULT now()`.
- Routes: `PUT /api/match/:matchId/battle-plan` body `{ phase, text }` (per-phase upsert); `GET /api/match/:matchId/battle-plan` → `{ battlePlan: { matchId, preBattle, battleAdjustments, postBattle, updatedAt } | null }` (no `id`, no `created_at`, no `updatedByExtId`). Auth = `authenticated-session-required`.
- 401 body carries the pass-through `requireAuthenticatedSession` session code (a `SessionValidationErrorCode`, relayed exactly as `feedback.routes.ts` does — not a fixed literal); this packet's own codes are `not_a_participant` / `unknown_phase` / `text_too_long`.
- Participant = authenticated `accountId` present in `readSeatAccounts(matchId)`; else `403 not_a_participant`. The gate applies to **both** `PUT` **and** `GET`.

## Guardrails

- No new file imports `boardgame.io` or `@legendary-arena/game-engine`. Nothing touches `G`/`ctx`/snapshot/hash. Verify by Select-String, not by reasoning.
- One shared row per match: upsert is `INSERT … ON CONFLICT (match_id) DO UPDATE SET <phase-column> = $, updated_by_ext_id = $, updated_at = now()` — per-column, so writing one phase never clears the other two. STOP if a whole-row REPLACE appears.
- Phase→column is a closed-set `switch`/map — **no dynamic property access** from the request string (`.reduce`/`obj[phase]` on untrusted input is forbidden).
- No global `/api` body parser — each write route attaches its OWN `koaBody()` (`request.body` is `undefined` in prod otherwise). Verify by running.
- `Cache-Control: no-store` is the first statement in every handler (D-11504); uniform `{ error: <code> }` envelope.
- Participant gate reuses `readSeatAccounts` — do NOT hand-roll a new `match_seat_accounts` query.
- DB-gated test serialized (`--test-concurrency=1`) — shared local Postgres.

## Required `// why:` Comments

- `045` `match_id text … UNIQUE` (no FK): match lifecycle is owned by the bgio store, not the `legendary.*` schema (mirror migration 032).
- `045` header: persistence-boundary note — ordinary domain table, never `G`/snapshot/save-game/hash, no carve-out (mirror 042/043).
- `battlePlan.routes.ts` route-scoped `koaBody()`: no global `/api` body parser; `request.body` undefined in prod without it.
- `battlePlan.routes.ts` participant gate: why a non-roster account is `403` (the Battle Plan is a seated-team artifact; bots/guests have no seat-account row, D-24120).
- `battlePlan.logic.ts` `phaseColumnFor`: why a closed-set map, not dynamic property access on the request string.

## Files to Produce

- `data/migrations/045_create_battle_plan.sql` — **new** — `legendary.battle_plan`, `match_id UNIQUE`, persistence-boundary + not-FK headers
- `apps/server/src/match/battlePlan.types.ts` — **new** — `BattlePlanPhase` union, record + input + response types
- `apps/server/src/match/battlePlan.logic.ts` — **new** — pure: validate + `phaseColumnFor` + record→response (no `pg`, no `boardgame.io`)
- `apps/server/src/match/battlePlan.persistence.ts` — **new** — the only `pg` file (`upsertBattlePlanPhase` + `readBattlePlan`)
- `apps/server/src/match/battlePlan.routes.ts` — **new** — `registerBattlePlanRoutes` (own `koaBody`, auth + participant gate, no-store)
- `apps/server/src/match/battlePlan.logic.test.ts` — **new** — closed-set map + length cap + empty-clear
- `apps/server/src/match/battlePlan.routes.test.ts` — **new** — auth reject + per-phase preservation + error envelopes via the injected logic seam (no live DB); MUST assert `403 not_a_participant` for an authenticated non-participant on **both** `PUT` **and** `GET` (read-side gate, symmetric to write)
- `apps/server/src/match/battlePlan.persistence.test.ts` — **new** — ON CONFLICT upsert + read round-trip (DB-gated, serialized)
- `apps/server/src/server.mjs` — **modified** — register battle-plan routes (01.5 runtime-wiring; the ONLY wiring file)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — two new rows (PUT + GET), whole-row, closed-set Status/Auth (D-11804)

## After Completing

- [ ] `pnpm --filter @legendary-arena/server build` exits 0; `pnpm --filter @legendary-arena/server test` exits 0
- [ ] `Select-String` confirms: no `boardgame.io`/`game-engine` import, `koaBody` present per write route, no whole-row REPLACE
- [ ] `docs/ai/DECISIONS.md` — **create** the D-24449 entry as **Active (post-execution)** (currently RESERVED in `NUMBER-LEDGER.md`; no prior Drafted entry to flip)
- [ ] `docs/ai/STATUS.md` — "No user-observable change — infrastructure only"
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-635 checked off; `docs/ai/execution-checklists/EC_INDEX.md` — EC-670 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-635 glyph `📝` → `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells

- `request.body` undefined at runtime → the write route is missing its own `koaBody()` (no global parser).
- Writing one phase blanks the others → the upsert replaced the whole row instead of `SET <phase-column> = $` for the single column.
- A `400` on a legit phase → the closed-set phase map is out of sync with the three column names.
- Persistence test races another DB suite → `--test-concurrency=1` missing (shared local Postgres).
- A non-seated but authenticated account can write → the participant gate (`readSeatAccounts` membership) was skipped or only applied to GET.
