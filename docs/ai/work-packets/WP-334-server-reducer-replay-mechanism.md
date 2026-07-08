# WP-334 — Server-Layer Faithful Reducer-Replay Mechanism

**Status:** Draft — Ready to execute (pending operator review)
**Primary Layer:** Server (`apps/server/**`)
**Dependencies:** D-24119 (Active — faithful-replay arc; authorizes the boardgame.io-reducer server-layer replay + the D-24095 read carve-out), WP-309/D-24095 (durable `bgio.matches` store — the artifact source), WP-333/D-24120 (seat→account identity — sibling arc WP, context)
**EC:** EC-364
**Baseline:** `origin/main` at `6ad8106a` (2026-07-08)
**User-Visible Surface:** none — infrastructure
**Reserves:** D-24121

---

## Goal

After this packet, `apps/server` has a **faithful reducer-replay mechanism**: given
a completed match's persisted boardgame.io `initialState + log` (from the WP-309
`bgio.matches` store), it re-executes the log through boardgame.io's OWN reducer
(`CreateGameReducer`, `isClient: false`) starting from the persisted initial state,
reproducing the exact live final `G` — seed- and phase/turn-hook-faithful by
construction — and computes the canonical `computeStateHash` over it. This is WP-2
of the D-24119 arc. It is **mechanism-only**: it does not repoint the WP-053
submission verifier (that is blocked on a `replayHash → matchId` mapping that only
the WP-3 capture step can create — see Context) and it does not capture live
matches. No user-visible change.

---

## Assumes

- **D-24119 Active** — authorizes (a) a server-layer replay pipeline that reads the
  `bgio` blob and re-executes it through boardgame.io's reducer, and (b) the D-24095
  carve-out permitting that read. This WP is its WP-2.
- **WP-309 / D-24095 Done** — `bgio.matches` durably stores `initial_state`, `log`
  (the ordered `LogEntry[]` with `MAKE_MOVE` + `GAME_EVENT` entries, appended by
  `setState`), `metadata`, `state` as jsonb; `apps/server/src/db/bgioPgStore.js` +
  migration `023`. `initial_state` is **nullable** (a `setState`-upsert-created row
  has none) — a null initial state is not replayable.
- **boardgame.io 0.50.2** exposes `CreateGameReducer`, `ProcessGameConfig`,
  `InitializeGame` from `boardgame.io/internal`. `CreateGameReducer({ game, isClient })`
  returns a `(state, action) => state` reducer. The seed lives in
  `state.plugins.random.data.seed` (NOT `ctx._random`); `InitializeGame` has **no**
  seed parameter and mints a fresh `Date`-based seed — so faithful replay MUST start
  from the persisted `initial_state`, never a fresh `InitializeGame`.
- The engine exports `computeStateHash` (read-only, unchanged here) and the
  `LegendaryGame` object. Per D-24119/D-2705, the engine's `packages/game-engine/src/replay/**`
  may NOT import boardgame.io; this server module may (server layer).
- `pnpm install && pnpm -r build` exits 0 on `main`; the `apps/server` suite passes
  its baseline (DB-dependent tests skip without `TEST_DATABASE_URL`).

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` D-24119 (the ratified architecture + the 5-WP arc + the
  implementation landmines), D-24095 (the amended replay/verification carve-out),
  D-0205 (engine `replayGame` stays determinism-only — this WP does NOT change it),
  D-2705 (engine `replay/` no-boardgame.io boundary).
- **Arc-ordering refinement (this WP's key scoping decision).** D-24119's arc text
  describes WP-2 as "server reducer-replay **+ repoint the WP-053 verifier**." Design
  research found the repoint is **not executable in this WP**: the submission endpoint
  (WP-332) takes only `{ replayHash }`, and there is **no `replayHash → matchId`
  mapping** in any table (`bgio.matches`, `replay_blobs`, `replay_ownership`,
  `competitive_scores`, `match_seat_accounts`). That mapping is created by the WP-3
  capture step (which reconstructs the final `G`, computes the hash, and records it
  against the `match_id`). WP-334 therefore ships the **mechanism only**; the verifier
  repoint moves to WP-3 (or a dedicated post-capture WP). This refinement is recorded
  as **D-24121**.
- `node_modules/.pnpm/boardgame.io@0.50.2/.../dist/cjs/internal.js` — `CreateGameReducer`
  / `ProcessGameConfig` / `InitializeGame` exports; `reducer-*.js` (the reducer body,
  `MAKE_MOVE` / `GAME_EVENT` handling, `isClient` branches); `plugin-random-*.js` (the
  alea seed at `plugins.random.data`); `turn-order-*.js` (the `LogEntry` shape
  `{ action, _stateID, turn, phase }` + action creators `{ type, payload }`).
- `apps/server/src/db/bgioPgStore.js` (`fetch` at `:195-234`; `log` append at
  `:128-144`; migration `data/migrations/023_create_bgio_match_store.sql`).
- `apps/server/src/replay/replay.logic.ts` — the existing server replay module
  (WP-103 `loadReplay`/`storeReplay`); the new mechanism lives alongside it.
- `packages/game-engine/src/replay/replay.hash.ts` — `computeStateHash` (hashes the
  whole `G`, sorted keys; includes `messages` + `logMeta`; the `game.ts:~433`
  "hash-excluded" claim is unenforced — see the landmine below).
- `docs/ai/REFERENCE/00.6-code-style.md` Rules 4, 6, 11, 13; `.claude/skills/legendary-server/SKILL.md`.
- `docs/01-VISION.md` §22 (replay-verified competitive integrity).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+.
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.
- Full file contents for every new or modified file (no diffs, no snippets).
- Test files `.test.ts`; `node:test` + `node:assert`. DB-dependent tests use the
  non-silent skip when `TEST_DATABASE_URL` is unset (the WP-052/053 precedent).
- Full-sentence error messages.

**Packet-specific:**
- Faithful replay MUST start from the **persisted `initial_state` blob** and dispatch
  each `log[i].action` through `CreateGameReducer({ game: LegendaryGame, isClient: false })`.
  It MUST NOT call `InitializeGame` to produce the replay's start state (no seed
  param → a fresh Date-based seed → divergence). `InitializeGame` may be used only in
  the test to *manufacture* a start state whose seed then travels in the persisted
  blob.
- `isClient: false` is mandatory (a client reducer skips `GAME_EVENT` handling and
  move triggers → the phase/turn hooks that drive the start-of-turn draw would not
  fire → divergence).
- Reconstruct from the raw persisted `state`/`initial_state`, NEVER the
  `playerView`/UIState projection.
- A **null `initial_state`** (or empty/malformed `log`) is not replayable: the
  mechanism returns a typed not-replayable result (or throws a full-sentence error) —
  fail closed, never a partial/guessed state.
- The canonical faithful hash is **`computeStateHash(reducedState.G)`** where
  `reducedState` is the reducer-replay output. This WP does **NOT** change
  `computeStateHash`'s field set (the `messages`/`logMeta` inclusion). Reconciling
  that is D-24119 WP-4's job (it is shared with `desync.detect` and carries engine
  fixture blast radius). WP-334 pins the canonical hash as computed by the current
  function over the reduced `G`, and its test asserts the faithfulness invariant
  (reduced final `G` === the live final `G`) via that hash.
- This WP does NOT repoint the WP-053 verifier, does NOT capture live matches, does
  NOT edit any engine file, does NOT change `computeStateHash`, does NOT touch the
  engine `replayGame` harness or any determinism fixture.
- Server layer only. The module MAY import `boardgame.io/internal` (permitted for the
  server per D-24119/D-24095) + `@legendary-arena/game-engine` (`LegendaryGame`,
  `computeStateHash`) + `pg` via the injected pool. No new npm dependency.
- boardgame.io is version-locked `^0.50.0`; the mechanism couples to 0.50.x reducer
  internals — add a `// why:` note recording the coupling.

**Session protocol:**
- If the reducer API, the `LogEntry`/action shape, or the seed location is unclear,
  stop and read the installed `boardgame.io/internal` + `reducer-*.js` — never guess
  the framework internals.

**Locked contract values:**
- Module: `apps/server/src/replay/matchReplay.logic.ts`.
- `readMatchForReplay(matchId: string, database: DatabaseClient): Promise<{ initialState: unknown; log: readonly unknown[]; metadata: unknown } | null>`
  — direct `SELECT initial_state, log, metadata FROM bgio.matches WHERE match_id = $1`;
  returns `null` when the row is absent OR `initial_state` is null (not replayable).
- `reduceMatchToFinalState(artifact: { initialState: unknown; log: readonly unknown[] }): { finalState: LegendaryGameState; stateHash: string }`
  — pure (no I/O): builds `CreateGameReducer({ game: LegendaryGame, isClient: false })`,
  folds `log[i].action` from `initialState`, returns `{ finalState: state.G, stateHash: computeStateHash(state.G) }`.
- Reducer construction: `CreateGameReducer({ game: LegendaryGame, isClient: false })`.
- Faithfulness invariant (the test's assertion): for a real match,
  `reduceMatchToFinalState({ initialState, log }).stateHash === computeStateHash(liveFinalState.G)`.

---

## Scope (In)

### A) Reducer-replay mechanism
- **`apps/server/src/replay/matchReplay.logic.ts`** — new. Exports:
  - `readMatchForReplay(matchId, database)` — the fail-closed `bgio.matches` read
    helper (direct SELECT; null when absent or `initial_state` null).
  - `reduceMatchToFinalState({ initialState, log })` — pure reducer-replay: construct
    the `isClient: false` reducer for `LegendaryGame`, fold each `log[i].action` from
    the persisted `initialState`, return `{ finalState, stateHash }`. A malformed
    entry / null initial state fails closed with a full-sentence error.

### B) Test
- **`apps/server/src/replay/matchReplay.logic.test.ts`** — new. The **faithfulness
  golden**: manufacture a real short match (load the registry via `setRegistryForSetup`
  + a minimal valid `MatchSetupConfig`, `InitializeGame` the start state, then drive a
  short deterministic sequence — at least one `endTurn` `GAME_EVENT` so a turn hook +
  the start-of-turn draw fire — through the SAME `CreateGameReducer`, collecting the
  emitted `log`), capture the live final `state`, then assert
  `reduceMatchToFinalState({ initialState, log }).stateHash === computeStateHash(liveFinal.G)`
  (replaying the log from the initial state reproduces the live final `G`). Pin the
  hash as a golden. Plus: a null-`initial_state` / empty-log fail-closed test
  (logic-pure); a DB-gated `readMatchForReplay` round-trip against `bgio.matches`
  (skip without `TEST_DATABASE_URL`).

### C) API catalog (§21)
- **`docs/ai/REFERENCE/api-endpoints.md`** — modified. Add a `Library-only` row for
  `reduceMatchToFinalState` (+ `readMatchForReplay`), mirroring the `storeReplay` /
  `loadReplay` Library-only rows — reachable via direct import from
  `apps/server/src/**`, no HTTP surface (consumed by the future WP-3 capture step and
  the deferred verifier repoint).

---

## Out of Scope

- **Repointing the WP-053 competitive verifier** — blocked on the `replayHash → matchId`
  mapping the WP-3 capture step creates (see Context / D-24121). Deferred.
- **Live-match capture** (the gameover harvester, `assignReplayOwnership`, storing the
  hash→match mapping) — that is WP-3 of the arc.
- **Any `computeStateHash` field-set change** (the `messages`/`logMeta` reconciliation)
  — D-24119 WP-4; shared with `desync.detect`; carries engine-fixture blast radius.
- **Any engine edit** — `replayGame`/`verifyDeterminism` stay determinism-only
  (D-0205); no engine `replay/` file changes; no determinism fixture re-pin.
- **The arena-client** — no client surface.

---

## Files Expected to Change

- `apps/server/src/replay/matchReplay.logic.ts` — **new** — reducer-replay + bgio read helper
- `apps/server/src/replay/matchReplay.logic.test.ts` — **new** — faithfulness golden + fail-closed + DB-gated read
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — Library-only rows (§21)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-334 row
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-364 row
- `docs/ai/execution-checklists/EC-364-server-reducer-replay-mechanism.checklist.md` — **new**
- `docs/ai/work-packets/WP-334-server-reducer-replay-mechanism.md` — **new** — this file
- `docs/ai/STATUS.md` — **modified** (execution) — infrastructure-only entry
- `docs/ai/DECISIONS.md` — **modified** (execution) — D-24121

No other files may be modified. No migration (reads existing `bgio.matches`).

---

## Contract

- `readMatchForReplay(matchId, database) => { initialState, log, metadata } | null`
  (null = absent row or null `initial_state`).
- `reduceMatchToFinalState({ initialState, log }) => { finalState: LegendaryGameState, stateHash }`
  — pure; `CreateGameReducer({ game: LegendaryGame, isClient: false })`; starts from
  `initialState`; folds `log[i].action`; hash = `computeStateHash(finalState)`.
- **Faithfulness invariant:** replaying a real match's `initialState + log` reproduces
  the live final `G` (equal `computeStateHash`).
- Canonical hash = current `computeStateHash` over the reduced `G` (field set
  unchanged).

---

## Acceptance Criteria

- [ ] `reduceMatchToFinalState` builds `CreateGameReducer({ game: LegendaryGame, isClient: false })`,
      starts from the passed `initialState`, and folds `log[i].action` in order.
- [ ] The faithfulness test manufactures a real short match (≥1 `endTurn` event so a
      turn hook + start-of-turn draw fire) and asserts the reduced final `G` hash
      equals the live final `G` hash — and the hash is pinned as a golden.
- [ ] A null `initial_state` (or empty/malformed `log`) fails closed (typed
      not-replayable result / full-sentence error), never a partial state.
- [ ] `readMatchForReplay` issues a `SELECT initial_state, log, metadata FROM bgio.matches`
      and returns `null` for an absent row or a null `initial_state` (DB-gated test).
- [ ] The module imports `boardgame.io/internal` (server layer) and does NOT edit any
      engine file; `computeStateHash` is imported read-only and unchanged.
- [ ] `InitializeGame` is NOT used to produce the replay start state (grep: the replay
      fold starts from `initialState`, not a fresh `InitializeGame`).
- [ ] No engine `replay/` file, no `computeStateHash` field-set change, no determinism
      fixture re-pin.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` has a `Library-only` row for the new
      function(s).
- [ ] No files outside `## Files Expected to Change` modified.

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — server tests (faithfulness golden + fail-closed run; DB read-test skips without TEST_DATABASE_URL)
pnpm --filter @legendary-arena/server test
# Expected: baseline preserved; new matchReplay tests pass

# Step 3 — reducer uses the server-permitted internal + isClient:false
Select-String -Path "apps\server\src\replay\matchReplay.logic.ts" -Pattern "boardgame\.io/internal|isClient: false"
# Expected: both present

# Step 4 — replay starts from the persisted initial state, not a fresh InitializeGame
Select-String -Path "apps\server\src\replay\matchReplay.logic.ts" -Pattern "InitializeGame"
# Expected: no match (the mechanism folds from initialState; InitializeGame is test-only)

# Step 5 — engine untouched
git diff --name-only packages/
# Expected: no output

# Step 6 — scope
git diff --name-only
# Expected: matches Files Expected to Change
```

---

## Vision Alignment

**Vision clauses touched:** §22 (Scoring & Skill Measurement — replay-verified
competitive integrity: this is the faithful re-execution that makes a live match's
score reproducible and verifiable).

**Conflict assertion:** No conflict: this WP preserves §22. It adds the faithful
reconstruction path D-24119 authorized; it introduces no new scoring logic and no new
identity model.

**Non-Goal proximity check:** NG-1..7 — none crossed. No paid surface, no user-facing
change.

**Determinism preservation:** The mechanism reproduces the live match deterministically
by re-executing the persisted log through boardgame.io's own seeded reducer (seed from
the persisted `initial_state`), which is the framework's authoritative determinism path.
It does NOT change `ctx.random.*` sourcing, the engine `replayGame` harness, or
`computeStateHash`. Replay-faithful by construction (Vision §22); the test asserts
reduced final `G` === live final `G`.

---

## Funding Surface Gate

**N/A** — server-internal replay mechanism. No global-nav / registry / profile funding
affordance, no tournament funding channel, no user-visible funding copy. Authority:
WP-097, D-9701, D-9801.

---

## API Catalog Update (§21 — D-11804)

**Triggered** (adds `apps/server/src/**` library functions with no HTTP surface). At
execution, `docs/ai/REFERENCE/api-endpoints.md` gains a `Library-only` row for
`reduceMatchToFinalState` (and `readMatchForReplay`), mirroring the `storeReplay` /
`loadReplay` rows: `Status = Library-only`, `Authorizing WP = WP-334`, with a note that
they are consumed by the future WP-3 capture step + the deferred verifier repoint. No
HTTP endpoint is added.

---

## Lint Gate Self-Review (00.3)

| § | Verdict | Notes |
|---|---------|-------|
| §1 Structure | PASS | All required sections incl. Out of Scope (≥2 exclusions) |
| §2 Constraints | PASS | Engine-wide + packet-specific + session protocol + locked values; references 00.6; no partial output |
| §3 Assumes | PASS | D-24119/WP-309 + the InitializeGame-seed + null-initial_state facts explicit |
| §4 Context | PASS | DECISIONS + boardgame.io internals + bgioPgStore + hash + SKILL cited; arc-ordering refinement stated |
| §5 Output | PASS | 9 files new/modified w/ descriptions; ≤8 code/doc (governance excluded); bounded |
| §6 Naming | PASS | `matchId`/`initialState`/`log`/`stateHash` consistent; no canonical field renames |
| §7 Dependencies | PASS | No new npm dep; boardgame.io ^0.50 locked (already present); `pg` via pool |
| §8 Boundaries | PASS | Server layer imports boardgame.io/internal (D-24119 permitted); engine untouched; no DB in moves; reads bgio store per D-24095 carve-out |
| §9 Windows | PASS | `Select-String` / `pnpm` |
| §10 Env vars | N/A | No new env vars |
| §11 Auth | N/A | No authentication surface (internal mechanism) |
| §12 Tests | PASS | `node:test`; faithfulness golden + fail-closed + DB-gated read (skips w/o TEST_DATABASE_URL) |
| §13 Commands | PASS | Exact `pnpm` + `Select-String` w/ expected output |
| §14 Acceptance | PASS | 9 binary, observable, referenced items |
| §15 Definition of Done | PASS | STATUS/DECISIONS/WORK_INDEX + scope-boundary + User-Visible Surface (`none — infrastructure`) |
| §16 Code style | PASS | Small functions; `// why:` on isClient/seed-from-initialState/0.50.x-coupling; no premature abstraction |
| §17 Vision | PASS | §22 cited; no conflict; determinism-preservation line present |
| §18 Prose-vs-grep | PASS | Step 3/4 greps (`boardgame.io/internal`, `isClient: false`, `InitializeGame`) — prose uses them intentionally; Step 4 expects zero (InitializeGame test-only) |
| §19 Bridge staleness | N/A | No repo-state-summarizing artifact |
| §20 Funding | N/A | Justified: server-internal mechanism, no funding surface |
| §21 API catalog | PASS | Triggered; Library-only row obligated in the impl commit |

**Pre-flight self-verdict:** READY — deps (D-24119 Active, WP-309/333 Done) on `main`;
scope locked as mechanism-only; the repoint-deferral + the InitializeGame-seed +
canonical-hash decisions are resolved via the design research and recorded as D-24121;
no ambiguity.

**Copilot self-check:** PASS — server-only, additive, no engine edit, no hash change,
verifier repoint honestly deferred (arc-ordering refinement recorded), catalog
obligation captured, User-Visible Surface `none — infrastructure`.

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (faithfulness golden + fail-closed green; baseline preserved)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated in the impl commit (Library-only row; §21)
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change — infrastructure only"; names the payoff (faithful reducer-replay mechanism ready for the WP-3 capture step)
- [ ] `docs/ai/DECISIONS.md` updated — D-24121 (WP-2 scoped mechanism-only; verifier repoint deferred to post-capture because no `replayHash → matchId` mapping exists yet; faithful replay starts from the persisted `initial_state` not `InitializeGame`; canonical hash pinned over the reduced `G` without changing `computeStateHash`) flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-334 checked off with date
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`)
