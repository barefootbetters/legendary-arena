# WP-635 — Battle Plan API (Server + Persistence)

**Status:** Ready
**Primary Layer:** Server (`apps/server`) + Persistence (DB migrations)
**Dependencies:** WP-01 (schema + migration runner), WP-104 / WP-332 (authenticated-session gate), WP-333 / WP-335 (`apps/server/src/match/seatAccount.logic.ts` — WP-333 authored the module + `recordSeatAccount` writer + the `match_seat_accounts` table; WP-335 added the `readSeatAccounts` reader this WP's participant gate calls), WP-604 (the `feedback/` module shape this mirrors)
**User-Visible Surface:** none — infrastructure (the per-match Battle Plan storage + read/write contract the client `BattlePlanPanel` — a follow-on WP — and the LAGN `battle_plan` export block build on)
**Baseline:** `origin/main` @ `3c57e1c0` (draft worktree checkout point; the reserve-only ledger commit lands on top)

## Session Context

D-24449 locks the storage model for the in-match **Battle Plan** — the
free-text, football-style "game plan" players write during a match. The
Battle Plan is **one shared team document per match** with three
lifecycle-tied phases: **pre-battle plan** (mastermind / scheme / villains
read + why these heroes), **battle adjustments** (in-game hero focus /
course corrections), and **post-battle analysis** (the debrief — what
worked?). This packet builds only the **server + persistence foundation**:
the domain table and the read/write API. The client `BattlePlanPanel.vue`
(the three-phase UI, waiting-room display) and the LAGN `battle_plan` export
block are **separate follow-on WPs** — the client depends on these
endpoints, so the API lands first.

This is the first packet of the Battle Plan arc and mirrors the
structurally-identical WP-604 feedback-intake shape (a `legendary.*` domain
table + an authenticated `apps/server` module + per-route `koaBody`), which
itself mirrors WP-594 `coach/` + WP-332 `competition.routes.ts`.

## Goal

After this packet, `apps/server` can **store and read** a per-match shared
Battle Plan. Two authenticated, participant-gated endpoints:
`PUT /api/match/:matchId/battle-plan` upserts one phase's text, and
`GET /api/match/:matchId/battle-plan` returns the current three-phase
document. Storage is a new `legendary.battle_plan` domain table — one row
per match, keyed on `match_id` (plain text, not an FK). The Battle Plan is
**non-gameplay per-match data**: it flows exclusively over REST + Postgres,
never through boardgame.io, and is never `G`/`ctx`, a snapshot, or hashed
into the game-state hash.

## User-Visible Impact

**None — infrastructure.** No user-observable change; this packet's payoff
is the persistence + read/write contract the Battle Plan panel and the LAGN
export build on. The `User-Visible Surface = none — infrastructure` D-24026
disposition applies (STATUS records "No user-observable change —
infrastructure only").

## Assumes

- WP-01 complete. Specifically: the `legendary.*` schema exists, the
  `data/migrations/*.sql` runner applies numbered migrations idempotently on
  deploy (`scripts/migrate.mjs` in the Render `buildCommand`), and the latest
  landed migration is `044_create_match_guest_access.sql` (this WP adds 045).
- WP-104 / WP-332 complete: `requireAuthenticatedSession` is the injected
  auth guard `apps/server` mounts on identity-gated write routes; the coach /
  feedback / competition modules already consume it.
- WP-333 / WP-335 complete: `legendary.match_seat_accounts` (migration 024,
  WP-333) records one `(match_id, player_id, account_id)` row per
  **authenticated** seat, and `readSeatAccounts(matchId, database)`
  (`apps/server/src/match/seatAccount.logic.ts`; the reader added by WP-335,
  also consumed by its replay-ownership capture step)
  returns `{ playerId, accountId }[]`. `account_id` holds the account's
  `legendary.players.ext_id` (D-5201). This is the participant gate — a
  caller is a participant iff their authenticated `accountId` appears in that
  roster. Bots/guests have no row (D-24120), so they are never participants.
- WP-604 complete: the `apps/server/src/feedback/` module (own per-route
  `koaBody`, injected `requireAuthenticatedSession`, `DatabaseClient`
  persistence file, test-logic injection seam) is the module shape to clone.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

## Context (Read First)

Before writing a single line:

- `.claude/rules/architecture.md` §Persistence Boundary (Cross-Layer) — `G`
  and `ctx` are runtime-only; only the server/application layer persists
  data; snapshots are counts-only. The Battle Plan is an ordinary domain
  table, **not** a persistence carve-out (contrast the D-24095/24119 bgio
  blob carve-outs — this touches none of them).
- `data/migrations/042_create_feedback_item.sql` +
  `043_create_feedback_vote.sql` — the persistence-boundary comment formula
  and the per-column `-- why:` idiom to mirror.
- `data/migrations/032_create_match_invites.sql` — the `match_id text` (not
  FK) "match lifecycle is owned by the bgio store, not the `legendary.*`
  schema" rationale to reuse verbatim.
- `apps/server/src/feedback/feedback.routes.ts` — the per-route `koaBody`,
  `Cache-Control: no-store`-first, `{ error: <code> }` envelope, and the
  `registerFeedbackRoutes(router, database, deps, logic = PRODUCTION_...)`
  injection shape.
- `apps/server/src/match/seatAccount.logic.ts` — `readSeatAccounts` (the
  participant gate).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — canonical field naming (no
  abbreviations); `matchId` in code, `match_id` in SQL.

## Non-Negotiable Constraints

**Server + persistence packet (engine-wide game constraints are N/A — no
`G`, no moves, no `ctx.random`, no determinism surface):**

- The Battle Plan flows over **REST + Postgres only**. No new file may
  import `boardgame.io` or `@legendary-arena/game-engine`. Nothing this
  packet writes touches `G`, `ctx`, a snapshot, or the game-state hash.
- One shared row per match: `match_id` carries a `UNIQUE` constraint; the
  upsert is `INSERT … ON CONFLICT (match_id) DO UPDATE`. The Battle Plan is a
  *team* document, not per-player rows.
- Writes are **authenticated + participant-gated**: after
  `requireAuthenticatedSession` resolves the caller's `accountId`, the route
  rejects (`403`) unless that id is in `readSeatAccounts(matchId)`. A
  non-participant can neither read nor write.
- Each write route attaches its **own** `koaBody()` (`request.body` is
  `undefined` in prod without it — there is no global `/api` parser).
- `Cache-Control: no-store` is the first statement in every handler
  (D-11504); uniform `{ error: <code> }` failure envelope.

**Locked contract values:**

- Table: `legendary.battle_plan`. Columns: `id bigserial PRIMARY KEY`,
  `match_id text NOT NULL UNIQUE`, `pre_battle text`, `battle_adjustments
  text`, `post_battle text`, `updated_by_ext_id text NOT NULL`, `created_at
  timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL
  DEFAULT now()`. `match_id` is plain `text`, **no FK**.
- Phase key closed set: `'pre_battle' | 'battle_adjustments' | 'post_battle'`
  — the request `phase`, mapped 1:1 to the three columns. An unknown phase is
  a `400`.
- `BATTLE_PLAN_PHASE_MAX_LENGTH = 4000` (characters, per phase). A longer
  `text` is a `400`. Empty string is allowed (clears the phase).
- `PUT /api/match/:matchId/battle-plan` body `{ phase, text }` upserts one
  phase; `GET` returns `{ battlePlan: { matchId, preBattle,
  battleAdjustments, postBattle, updatedAt } | null }`.
- `updated_by_ext_id` is stored for audit but is **NOT projected** in the GET
  response — the response never exposes an internal account `ext_id` (D-5201).
  A future client WP that wants a "last edited by" label adds a **handle**
  projection then (mirroring the result-LAGN producer, which surfaces public
  handles, never raw ext_ids); this MVP omits the field rather than leaking an
  internal id to co-participants.
- Auth (both routes): `authenticated-session-required` (D-9905 closed set).

**Session protocol:** one WP per session; do not combine with the client
panel WP or the LAGN WPs.

## Debuggability & Diagnostics

- Every endpoint is deterministic given identical DB state + inputs; no RNG,
  no clock branch (the `now()` defaults are DB-side stamps, not read back
  into logic).
- A rejected write returns a full-sentence `{ error: <code> }` naming the
  failure. The `401` body carries the **pass-through** `requireAuthenticatedSession`
  session code (a `SessionValidationErrorCode`, exactly as `feedback.routes.ts`
  relays it — not a fixed literal); this packet's own coded envelopes are
  `not_a_participant` (`403`), `unknown_phase` (`400`), and `text_too_long`
  (`400`), so the client can surface each.
- The participant gate reuses `readSeatAccounts` — the same roster the
  result-LAGN producer and replay-ownership capture already trust — so a
  Battle Plan write can never credit a seat the match doesn't recognise.

## Scope (In)

### A) Migration

- `data/migrations/045_create_battle_plan.sql` — **new**. Creates
  `legendary.battle_plan` per the locked columns above, idempotent
  (`CREATE TABLE IF NOT EXISTS`), with the persistence-boundary comment block
  (mirror 042/043) and the `match_id text` / not-FK rationale (mirror 032).
  `match_id` `UNIQUE` is the one-row-per-match rule.

### B) Types

- `apps/server/src/match/battlePlan.types.ts` — **new**. `BattlePlanPhase`
  (the closed union), `BattlePlanRecord`, `UpdateBattlePlanInput`, the
  response envelope type.

### C) Pure logic

- `apps/server/src/match/battlePlan.logic.ts` — **new**. `validateUpdateBattlePlanInput`
  (phase in set, text a string, `length ≤ BATTLE_PLAN_PHASE_MAX_LENGTH`),
  `phaseColumnFor(phase)` (closed-set map, no dynamic property access), and
  the record→response mapper. Pure; no `pg`, no `boardgame.io`.

### D) Persistence

- `apps/server/src/match/battlePlan.persistence.ts` — **new**. The only `pg`
  file: `upsertBattlePlanPhase(matchId, column, text, editorExtId, database)`
  (`INSERT … ON CONFLICT (match_id) DO UPDATE SET <column> = $, updated_by_ext_id
  = $, updated_at = now()`) and `readBattlePlan(matchId, database)`.

### E) Routes

- `apps/server/src/match/battlePlan.routes.ts` — **new**.
  `registerBattlePlanRoutes(router, database, deps, logic = PRODUCTION_...)`;
  `PUT` + `GET /api/match/:matchId/battle-plan`; per-route `koaBody`;
  `Cache-Control: no-store`; auth via injected `requireAuthenticatedSession`;
  participant gate via `readSeatAccounts`.

### F) Wiring (01.5 runtime-wiring)

- `apps/server/src/server.mjs` — **modified**. Register the routes beside
  `registerMatchInviteRoutes`, injected with `pool` +
  `requireAuthenticatedSession` (+ verifier/accountResolver).

### G) Tests

- `apps/server/src/match/battlePlan.logic.test.ts` — **new** (pure
  validation).
- `apps/server/src/match/battlePlan.routes.test.ts` — **new** (route
  behaviour via the injected logic seam; no live DB).
- `apps/server/src/match/battlePlan.persistence.test.ts` — **new** (DB-gated;
  `--test-concurrency=1`).

### H) API catalog (D-11804)

- `docs/ai/REFERENCE/api-endpoints.md` — **modified**. Two new rows (PUT +
  GET), whole-row, closed-set `Status`/`Auth`.

## Out of Scope

- **No client UI.** The `BattlePlanPanel.vue` three-phase panel + waiting-room
  display is the follow-on WP.
- **No LAGN change.** The `battle_plan` LAGN export block + the result-LAGN
  producer read are a separate WP.
- **No lifecycle phase-edit gating in the server.** The server stores three
  text columns permissively; *which* phase is editable when (waiting →
  playing → gameover) is a client concern.
- **No reactions / thumbs-up.** A shared team doc has no per-entry vote
  surface; reactions are a deferred follow-on.
- **No engine / `G` / scoring / hash change; no snapshot; no bgio blob read.**
- **No broader read audience** (spectators, unseated accounts) — participant-
  gated only for the MVP.

## Vision Alignment

The Battle Plan deepens team engagement and per-match investment (a written
plan a team returns to across a match), and — via the post-battle-analysis
phase that sits beside the endgame report card — the debrief loop. It adds a
retention/engagement surface with no anti-commercial commitment and no
gameplay-balance impact. No Vision non-goal is touched (it is not
player-vs-player interaction — it is a shared team artifact).

## Files Expected to Change

- `data/migrations/045_create_battle_plan.sql` — **new**
- `apps/server/src/match/battlePlan.types.ts` — **new**
- `apps/server/src/match/battlePlan.logic.ts` — **new**
- `apps/server/src/match/battlePlan.persistence.ts` — **new**
- `apps/server/src/match/battlePlan.routes.ts` — **new**
- `apps/server/src/match/battlePlan.logic.test.ts` — **new**
- `apps/server/src/match/battlePlan.routes.test.ts` — **new**
- `apps/server/src/match/battlePlan.persistence.test.ts` — **new**
- `apps/server/src/server.mjs` — **modified** — register battle-plan routes (01.5 runtime-wiring; the ONLY wiring file)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — two new endpoint rows (D-11804)

No other files may be modified (beyond the governance close-out: STATUS.md, DECISIONS.md, WORK_INDEX.md, ROADMAP-MINDMAP.md, EC_INDEX.md).

## Acceptance Criteria

### Migration
- [ ] `045_create_battle_plan.sql` creates `legendary.battle_plan` with the locked columns; re-running the runner against a seeded DB succeeds (idempotent).
- [ ] `match_id` is `text NOT NULL UNIQUE`, no FK; the header carries the persistence-boundary block + the not-FK rationale.

### API
- [ ] `PUT /api/match/:matchId/battle-plan` with `{ phase, text }` from a **participant** upserts that phase and returns the full current document.
- [ ] A second PUT to a different phase preserves the other two phases (per-column upsert, not whole-row replace).
- [ ] `GET /api/match/:matchId/battle-plan` returns the current document, or `{ battlePlan: null }` when none exists.
- [ ] An **unauthenticated** caller gets `401` (the pass-through session code); an **authenticated non-participant** gets `403 not_a_participant`.
- [ ] The participant gate applies to **both** routes: an authenticated non-participant gets `403 not_a_participant` on `GET` as well as on `PUT` (the read-side gate is not skipped).
- [ ] An unknown `phase` → `400 unknown_phase`; `text` longer than `BATTLE_PLAN_PHASE_MAX_LENGTH` → `400 text_too_long`; empty `text` clears the phase (allowed).
- [ ] Each write route attaches its own `koaBody()`; `Cache-Control: no-store` is the first line of every handler.

### Tests
- [ ] `battlePlan.logic.test.ts` covers the closed-set phase map + length cap + empty-clear.
- [ ] `battlePlan.routes.test.ts` covers auth reject, per-phase upsert preservation, and error envelopes via the injected logic seam (no live DB); it asserts `403 not_a_participant` for an authenticated non-participant on **both** `PUT` **and** `GET` (the read-side gate, symmetric to the write case).
- [ ] `battlePlan.persistence.test.ts` (DB-gated, `--test-concurrency=1`) covers the ON CONFLICT upsert + read round-trip.

### Scope
- [ ] No new file imports `boardgame.io` or `@legendary-arena/game-engine` (Select-String).
- [ ] No file outside `## Files Expected to Change` is modified (`git diff --name-only`).
- [ ] `api-endpoints.md` carries two new rows (D-11804), whole-row, closed-set `Status`/`Auth`.

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/server build            # exits 0

# Step 2 — unit + route tests
pnpm --filter @legendary-arena/server test             # exits 0

# Step 3 — DB-gated persistence (local Postgres, serialized)
#   TEST_DATABASE_URL set; migrations applied via psql per the DB-test runbook
node --test --test-concurrency=1 apps/server/src/match/battlePlan.persistence.test.ts

# Step 4 — no engine coupling
Select-String -Path apps/server/src/match/battlePlan.*.ts -Pattern "boardgame.io|game-engine"   # no matches

# Step 5 — koaBody per write route
Select-String -Path apps/server/src/match/battlePlan.routes.ts -Pattern "koaBody"                # present

# Step 6 — scope
git diff --name-only origin/main                       # only the allowlist + governance close
```

## Definition of Done

- [ ] **User-visible verification (CONDITIONAL):** surface is `none — infrastructure` → `docs/ai/STATUS.md` states "No user-observable change — infrastructure only"; no live-bundle check applies.
- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/server build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0
- [ ] DB-gated `battlePlan.persistence.test.ts` passes locally (`--test-concurrency=1`)
- [ ] No `boardgame.io` / `game-engine` import in any new file (Select-String)
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` — two new rows (D-11804), whole-row, closed-set Status/Auth
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — **create** the D-24449 entry as **Active (post-execution)** (it is currently RESERVED in `NUMBER-LEDGER.md`; there is no prior "Drafted" DECISIONS entry to flip)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-635 checked off with today's date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-670 status → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-635 node glyph `📝` → `✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Lint Gate Self-Review

Audited against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` (21 sections):

- §1 Goal is one user-visible outcome — **PASS** (store/read a per-match Battle Plan).
- §2 Assumes lists every prerequisite with a source — **PASS**.
- §3 Scope (In) is a closed enumeration — **PASS** (A–H).
- §4 Out of Scope is explicit — **PASS** (client, LAGN, reactions, engine, broader read).
- §5 Files allowlist matches EC — **PASS** (10 files + governance close).
- §6 Contract / locked values verbatim — **PASS** (table, phase set, length cap, envelopes, auth).
- §7 Acceptance criteria testable — **PASS**.
- §8 Verification steps operator-runnable — **PASS** (pwsh block).
- §9 Definition of Done binary — **PASS**.
- §10 Layer boundary respected — **PASS** (server + persistence only; no engine import).
- §11 Determinism — **N/A** (no `G`/`ctx`/RNG; DB `now()` is not read into logic).
- §12 Persistence boundary — **PASS** (ordinary domain table; explicitly not a carve-out/snapshot/hash).
- §13 No new canonical array / union — **N/A**.
- §14 Naming (no abbreviations; `matchId`/`match_id`) — **PASS**.
- §15 Error messages full-sentence coded envelopes — **PASS**.
- §16 Tests `.test.ts`, DB-gated serialized — **PASS**.
- §17 No contract-file modification (A-packet) — **N/A** (all new files).
- §18 DECISIONS entry reserved (D-24449) — **PASS** (lands at execution).
- §19 Dependencies complete — **PASS** (WP-01/104/332/333/335/604 all shipped).
- §20 One WP per session — **PASS**.
- §21 API catalog obligation (D-11804) — **PASS** (two rows in the same commit).
