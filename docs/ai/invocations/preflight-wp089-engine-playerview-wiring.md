# Pre-Flight — WP-089 (Engine PlayerView Wiring)

**Target Work Packet:** WP-089
**Title:** Engine PlayerView Wiring (UIState Projection)
**Previous WP Status:** WP-088 Done 2026-04-23 at `57327c2` (A0 `88580a9`, A `d183991`, B `57327c2`; engine `507 / 114 / 0`, repo-wide `672 / 128 / 0`)
**Pre-Flight Date:** 2026-04-23 (PS-1 / PS-2 resolution applied 2026-04-24)
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Runtime Wiring (new `LegendaryGame.playerView` field wiring a pure projection composed of two locked WP-028/WP-029 helpers; no new mutation of `G`; no new phase / move; no new code category).

**Mandatory sections for this class:** Dependency Check, Input Data Traceability, Structural Readiness, Runtime Readiness, Maintainability & Upgrade Readiness, Scope Lock, Test Expectations, Risk Review, Vision Sanity Check, Code Category Boundary Check.

---

## Pre-Flight Intent

Validate readiness and constraints for WP-089. Not implementing. Not generating code. The pre-flight output authorizes (or denies) generation of the WP-089 session execution prompt.

---

## Authority Chain (Read Before Verdict)

Read in order, higher wins on conflict:

1. `.claude/CLAUDE.md` — EC-mode, lint gate, commit discipline.
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary (Authoritative); UIState is the sole engine→UI projection contract; `playerView` is an engine-layer projection, not a server responsibility.
3. `docs/01-VISION.md` — §3 Player Trust & Fairness, §4 Faithful Multiplayer Experience, NG-1..7.
4. `docs/03.1-DATA-SOURCES.md` — no new data sources introduced.
5. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — `packages/game-engine/src/game.ts` is already classified engine; no new directory.
6. `docs/ai/execution-checklists/EC-089-engine-playerview-wiring.checklist.md` — execution contract.
7. `docs/ai/work-packets/WP-089-engine-playerview-wiring.md` — design authority.
8. `.claude/rules/game-engine.md` — `LegendaryGame` is the single `Game()` object; no parallel Game instances.
9. `.claude/rules/code-style.md` — human-style code, `// why:` comments, no `.reduce()` in zone / effect paths.
10. `docs/ai/DECISIONS.md` — D-0301 (UI Consumes Projections Only), D-0302 (Single UIState, Multiple Audiences) — both present at `DECISIONS.md:188` and `:196` (em-dash IDs, resolved via title grep per WP-028 precedent).
11. `docs/ai/session-context/session-context-wp089.md` — operational handoff.
12. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` — applies to WP-089 (new `LegendaryGame` field).

No conflicts between EC-089 and WP-089. Invocation prompt not yet drafted — this pre-flight is its precondition.

---

## Vision Sanity Check

- **Vision clauses touched by this WP:** §3 (Player Trust & Fairness), §4 (Faithful Multiplayer Experience), §22 (Deterministic Eval), §24 (Replay-Verified Integrity).
- **Conflict assertion:** No conflict: this WP preserves all touched clauses. `playerView` composes two existing pure functions whose determinism and aliasing discipline were locked by WP-028 / WP-029 / D-0301 / D-0302. Replay is unaffected — replays execute against `G`, never the client projection.
- **Non-Goal proximity:** N/A — WP-089 touches no monetization, cosmetic, leaderboard, or competitive surface. None of NG-1..7 are crossed.
- **Determinism preservation:** Same `(G, ctx, playerID)` triple always produces byte-identical output; no RNG, no wall-clock, no I/O inside `buildPlayerView`. `buildUIState` and `filterUIStateForAudience` are already pure under D-0301 / D-0302.
- **WP `## Vision Alignment` section:** Present at WP-089 lines 180-204. Cites §3, §4, NG-1..7, §22. PASS.

**Verdict:** PASS.

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-028 — UIState + `buildUIState` | pass | `[x]` in WORK_INDEX.md:622, reviewed 2026-04-14. `buildUIState(gameState, UIBuildContext)` exported at `packages/game-engine/src/ui/uiState.build.ts:177`. `UIState` exported at `packages/game-engine/src/ui/uiState.types.ts:27`. |
| WP-029 — Audience Filter | pass | `[x]` in WORK_INDEX.md:633, reviewed 2026-04-14. `filterUIStateForAudience(uiState, UIAudience)` exported at `packages/game-engine/src/ui/uiState.filter.ts:93`. `UIAudience` exported at `packages/game-engine/src/ui/uiAudience.types.ts:18` and re-exported through `uiState.types.ts:176`. |
| WP-088 — Setup Module Hardening | pass | `[x]` in WORK_INDEX.md:1568. Closes 2026-04-23 at `57327c2`. Does not gate WP-089 but is the baseline anchor. |
| WP-087 — Engine Type Hardening | pass | `[x]` in WORK_INDEX.md. A1 amendment at `d5880d2` added +1 test / +1 suite → engine baseline `507 / 114 / 0`. |

**Rule:** All prerequisites complete. Pre-flight proceeds.

---

## Dependency Contract Verification

- [x] **Type/field names match exactly.** `buildUIState` signature verified at `uiState.build.ts:177-180` — `(gameState: LegendaryGameState, ctx: UIBuildContext): UIState`. `filterUIStateForAudience` signature verified at `uiState.filter.ts:93-96` — `(uiState: UIState, audience: UIAudience): UIState`. `UIAudience` members verified at `uiAudience.types.ts:18-20` — exactly `{ kind: 'player'; playerId: string }` | `{ kind: 'spectator' }`.
- [x] **Function signatures are compatible.** Both are pure helpers returning new values. `buildPlayerView` assigns directly — no `G` mutation path required. No move-function collision (neither is a move).
- [x] **Move classification is correct.** `playerView` is a boardgame.io Game-level **hook**, not a move. `CoreMoveName` / `CORE_MOVE_NAMES` are not expanded. `LegendaryGame.moves` is untouched.
- [x] **Field paths in G are verified.** Not applicable — `buildPlayerView` only reads `G` and `ctx` through existing locked helpers. No new `G` fields.
- [x] **Helper return patterns are understood.** Both helpers return new values. `buildPlayerView` composes them by normal return — no Immer assignment pattern.
- [x] **Optional fields are identified.** `playerID` can be `null` or `undefined`; `UIState.gameOver?` is optional; `UIPlayerState.handCards?` is optional. All are handled by existing helpers and preserved through projection.
- [x] **Data source identity verified.** No new data sources. No disk / R2 / DB reads. N/A.
- [x] **TypeScript types accommodate real data quirks.** `UIBuildContext` (at `uiState.build.ts:31-35`) is an exact structural interface: `{ readonly phase: string | null; readonly turn: number; readonly currentPlayer: string }`. boardgame.io `Ctx.phase` is `string | null` at runtime; `ctx.phase` passes through unchanged.
- [x] **Schema-engine alignment verified.** No schema changes.
- [x] **Handler ownership is explicit.** `buildPlayerView` is a pure function in `game.ts`; no entry stored in `G`. No `ImplementationMap` change.
- [x] **Persistence classification is clear.** `playerView`'s output is a **projection** — never persisted. `G` itself is unchanged. ARCHITECTURE.md §3 unaffected.
- [x] **WP scope pre-validated against ARCHITECTURE.md.** `playerView` is an engine-owned projection hook; ARCHITECTURE.md Layer Boundary grants the engine exclusive authority over view construction. No conflict.
- [x] **Framework API workarounds documented.** `LegendaryGame: Game<LegendaryGameState, …>` locks `Game.playerView`'s declared return type to `G = LegendaryGameState`. Returning `UIState` and accepting `PlayerID | null | undefined` will trigger TS2322 at the assignment site. WP-089 §Type Safety Note authorizes a local narrowly-scoped assertion; see **RS-3** below for the locked decision.
- [x] **New types defined in dedicated contract files.** No new types introduced by WP-089.
- [x] **Immutable file designations respected.** `uiState.build.ts`, `uiState.types.ts`, `uiState.filter.ts`, `uiAudience.types.ts` are locked WP-028 / WP-029 contracts and will not be modified.
- [x] **Cross-service identifiers use ext_id strings.** Not applicable — no new identifiers.
- [x] **Locked value string literals match actual code.** `UIAudience.kind` literals `'player'` / `'spectator'` verified at `uiAudience.types.ts:19-20`. `ctx.phase` literals `'lobby'` / `'setup'` / `'play'` / `'end'` verified at `game.ts:191-261`.
- [x] **Runtime data availability verified for all evaluators.** All fields `buildUIState` reads already exist in `G` at the moment `playerView` fires. No new resolver needed.
- [x] **Setup-time data source verified for all extractors.** N/A.
- [x] **WP function signatures match established conventions.** `buildPlayerView(gameState, ctx, playerID)` matches the existing file-local helper pattern in `game.ts` (e.g., `advanceStage`); parameter order mirrors boardgame.io 0.50.x `playerView(G, ctx, playerID) => G`.
- [x] **WP file paths verified against actual filesystem.** `packages/game-engine/src/game.ts` exists (existing). `packages/game-engine/src/game.playerView.test.ts` does **not** exist (confirmed) — WP-089 correctly lists it as "new".
- [x] **WP file paths verified against code category rules.** `game.ts` is already classified engine. No new directory. No D-XXXX required.
- [x] **WP gating assumptions verified as true.** WP-089 §Assumes items verified: `buildUIState` / `UIState` / `filterUIStateForAudience` / `UIAudience` all exported as specified (see above); `LegendaryGame` export type verified at `game.ts:81`; `game-engine` build exits 0 (re-run this session); `game-engine` tests pass at `507 / 114 / 0` (re-run this session); `DECISIONS.md` and `ARCHITECTURE.md` exist.
- [x] **Decision IDs not referenced before creation.** WP-089 names a new `D-89xx` slot (canonical language provided at WP-089:408-414). No prior `D-89xx` entry exists in `DECISIONS.md` (grep `D-89` = no matches). The session prompt must create **D-8901** (title: "Engine-Level `playerView` Projection") in A0 or in the execution commit.
- [x] **Decision ID search accounts for character encoding.** Title-grep confirmed D-0301 and D-0302 (em-dash headings) present at `DECISIONS.md:188` and `:196`. No false negatives.
- [x] **Projection aliasing verified for all derived outputs.** `buildPlayerView` does not read or copy `G` directly — it delegates to `buildUIState` and `filterUIStateForAudience`. Both helpers already apply spread-copy discipline (WP-028 `cardKeywords` fix; WP-029 shallow-copy filter). No new aliasing surface.
- [x] **Functions the WP calls are actually exported.** `buildUIState` is exported at `uiState.build.ts:177`. `filterUIStateForAudience` is exported at `uiState.filter.ts:93`. `UIState` is exported at `uiState.types.ts:27`. `UIAudience` is **not** exported from `uiState.filter.ts` — see **RS-1** for the locked fallback.
- [x] **WP approach does not require forbidden imports.** `game.ts` already imports `boardgame.io` type names. Adding `buildUIState` / `filterUIStateForAudience` imports from `./ui/*.js` does not cross the engine's layer boundary. No registry import, no `apps/server/` import.
- [x] **Filter/consumer input type contains all needed data.** N/A — `buildPlayerView` is a composition of two already-locked functions; no new filter introduced.

**Conclusion:** All dependency contracts verified. One actionable correction (**RS-1**) and one fallback lock (**RS-2**) documented below.

---

## Input Data Traceability Check

- [x] All non-user-generated inputs consumed by this WP are listed in `docs/03.1-DATA-SOURCES.md` — **YES** (inputs are `G` and `ctx`, both runtime; no new external data).
- [x] Storage location for each input is known — **YES** (in-memory runtime state; no persistence).
- [x] It is possible to determine which data source(s) would need to be inspected if this WP's behavior is incorrect — **YES** (`G`, `ctx`, and the two locked WP-028 / WP-029 helpers).
- [x] The WP does not introduce "implicit data" (hardcoded literals that originate from external datasets) — **YES**, with one exception: the audience-kind literal `'player'` / `'spectator'` appears at the `playerView` call site, but these are closed-union discriminants defined in `uiAudience.types.ts:18-20` and locked in EC-089 §Locked Values — not external dataset values.
- [x] Setup-time derived fields introduced or modified by this WP are listed under Setup-Time Derived Data — **N/A**, no new setup-time fields.

No NO answers. PASS.

---

## Structural Readiness Check

- [x] All prior WPs compile and tests pass — **YES**. This session re-verified: `pnpm --filter @legendary-arena/game-engine build` exits 0; `pnpm --filter @legendary-arena/game-engine test` reports `tests 507 / suites 114 / pass 507 / fail 0`. Repo-wide baseline `672 / 128 / 0` from session-context §1 (post-WP-088 close at `57327c2`).
- [x] No known EC violations remain open — **YES**.
- [x] Required types/contracts exist and are exported — **YES** (`UIState`, `UIBuildContext`-compatible structural shape, `UIAudience`, `buildUIState`, `filterUIStateForAudience`, `LegendaryGameState`, `PlayerID`, `Ctx`, `Game`).
- [x] No naming / ownership conflicts — **YES**. No existing `playerView` field on `LegendaryGame` (grep-verified).
- [x] No architectural boundary conflicts at contract level — **YES**. `playerView` composes existing engine-internal projections only.
- [x] DB schema / migration idempotency — **N/A**.
- [x] R2 data — **N/A**.
- [x] If the WP reads data from G fields: actual type definitions contain the subfields the WP needs — **YES** (all reads are delegated to `buildUIState`; `LegendaryGameState` already carries every field it consumes).
- [x] **Consumer-signature scan (readonly / variance tightening).** Not triggered — WP-089 tightens nothing; `buildPlayerView` reads `G` through `buildUIState` exclusively, and returns a *new* `UIState`. No shared-type field is narrowed.

No NO answers. PASS.

---

## Runtime Readiness Check (Mutation & Framework)

Applies because WP-089 is Runtime Wiring class.

- [x] Expected runtime touchpoints are known — **YES** (`packages/game-engine/src/game.ts` only).
- [x] Framework context requirements are understood — **YES** (`boardgame.io` 0.50.x `playerView?: (state: G, ctx: Ctx, playerID: PlayerID) => G`; reshape requires local type assertion per WP-089 §Type Safety Note).
- [x] Existing test infrastructure can support required mocks without modifying locked helpers — **YES**, **with the RS-2 clarification** (`makeMockCtx` provides `SetupContext`, which is sufficient for building `gameState` via `buildInitialGameState` but does **not** provide `ctx.phase` / `ctx.turn` / `ctx.currentPlayer`; an inline object literal matching the minimum boardgame.io `Ctx` shape is required, per the WP-028 precedent at `uiState.build.test.ts`).
- [x] 01.5 runtime wiring allowance is anticipated — **YES**, **INVOKED** by WP-089 (adds a new `LegendaryGame` hook field). See RS-4 below for the locked allowance scope.
- [x] No architecture boundary violations expected — **YES**.
- [x] Integration-point code has been read and the call site is confirmed — **YES**. `LegendaryGame` object literal at `game.ts:81-261` read end-to-end. `playerView` will be added as a new top-level field on the object literal (placement locked in WP-089 Scope(In)§A — immediately after `validateSetupData` / adjacent to `setup` / `moves` / `phases`; the WP lets either "after `name`/`minPlayers`/`maxPlayers`" or "adjacent to `setup`/`moves`/`phases`" — see RS-9 for the lock).
- [x] Stage gating requirements — **N/A**, `playerView` is not a move.
- [x] Multi-step mutation ordering — **N/A**, no mutation.
- [x] Registry data flow — **N/A**, `buildPlayerView` never queries the registry.
- [x] Phase transitions — **N/A**.
- [x] Simultaneous / conflicting conditions — **N/A**.
- [x] Degradation path for unknown / unsupported types — **YES** (`playerID` typeof `'string'` → player; otherwise → spectator; closed binary fallback per EC-089 Locked Values).
- [x] Move-function dispatch outside framework context — **N/A**, no move dispatch.
- [x] Mock / PRNG capabilities — **verified**: `makeMockCtx` returns `SetupContext` = `{ ctx: { numPlayers }, random: { Shuffle } }` (see `mockCtx.ts:28-44`); it does **not** satisfy the boardgame.io `Ctx` shape needed for `playerView`. The locked resolution in RS-2 preserves `makeMockCtx` for `gameState` construction and adds an inline `ctxLike` literal for the `playerView!` invocation — no modifications to `makeMockCtx` are permitted.

No NO answers. PASS.

---

## Maintainability & Upgrade Readiness (Senior Review)

- [x] **Extension seam exists.** `UIAudience` is a discriminated union; future audiences (`'coach'`, `'observer'`, `'replay'`) are added by extending the union in `uiAudience.types.ts` and routing new `playerID` kinds through the audience-derivation branch in `buildPlayerView`. No refactor of `buildPlayerView` is required for new audiences beyond adding the discriminator line.
- [x] **Patch locality.** A future fix localizes to `buildPlayerView` (≤ 1 function) or `filterUIStateForAudience` (already owned by WP-029). No cross-cutting change.
- [x] **Fail-safe behavior.** Un-parseable `playerID` → spectator projection. `ctx.phase === null` → `buildUIState` already falls back to `'unknown'` (`uiState.build.ts:184`). `buildPlayerView` never throws per EC-089 guardrail.
- [x] **Deterministic reconstructability.** Inputs `(G, ctx, playerID)` deterministically produce the projection. No runtime logging. No hidden state.
- [x] **Backward-compatible test surface.** Tests use inline `ctxLike` + existing `makeMockCtx` + existing setup helpers — no new shared test infrastructure, no new mock shape exported from `test/mockCtx.ts`.
- [x] **Semantic naming stability.** `buildPlayerView` is a stable, descriptive name; `playerView` field mirrors the boardgame.io API.

PASS.

---

## Code Category Boundary Check

- [x] All new / modified files fall cleanly into an existing code category — **YES** (`game.ts` is engine; `game.playerView.test.ts` is test).
- [x] Each file's category permits all imports and mutations it uses — **YES**.
- [x] No file blurs category boundaries — **YES**.
- [x] No new directory — **YES** (`src/ui/` already classified; `src/` root already classified; no new folder created).

No D-XXXX code-category entry required.

PASS.

---

## Scope Lock (Critical)

### WP-089 Is Allowed To

- **Modify:** `packages/game-engine/src/game.ts` — add top-level `buildPlayerView` named function; wire `playerView: buildPlayerView` into the `LegendaryGame` object literal; add required `// why:` comments; add a narrowly-scoped local type assertion at the `playerView` assignment site if — and only if — the `Game<…>` generic rejects the reshape (WP-089 §Type Safety Note, RS-3 below). Minimal imports: `buildUIState` from `./ui/uiState.build.js`; `filterUIStateForAudience` from `./ui/uiState.filter.js`; `UIState` type from `./ui/uiState.types.js`. (**UIAudience is NOT imported** — see RS-1.)
- **Create:** `packages/game-engine/src/game.playerView.test.ts` — `node:test` coverage for seated-player, other-seated-player, `playerID === null`, `playerID === undefined`, determinism, no-mutation-of-`gameState`, no-mutation-of-`ctx` (≥ 6 tests).
- **Append:** `docs/ai/DECISIONS.md` — D-8901 per WP-089 canonical language (lines 405-414).
- **Append:** `docs/ai/STATUS.md` — WP-089 complete note per WP-089 canonical line 417-420.
- **Modify:** `docs/ai/work-packets/WORK_INDEX.md` — check off WP-089 row (re-introduced via A0 per PS-1) with today's date + Commit A hash.
- **Modify:** `docs/ai/execution-checklists/EC_INDEX.md` — mark EC-089 Draft → Done (registered via A0 per PS-2).

### WP-089 Is Explicitly Not Allowed To

- No modification of `packages/game-engine/src/ui/uiState.build.ts`, `uiState.types.ts`, `uiState.filter.ts`, or `uiAudience.types.ts` (WP-028 / WP-029 locked contracts).
- No modification of `packages/game-engine/src/test/mockCtx.ts` or any other shared test helper.
- No new `Game()` instance, no wrapper Game, no parallel projection object.
- No `PlayerView.STRIP_SECRETS` fallback.
- No changes to `apps/server/**`, `packages/registry/**`, `apps/arena-client/**`, `apps/replay-producer/**`, or `apps/registry-viewer/**`.
- No modification of `.claude/rules/**`, `docs/ai/ARCHITECTURE.md`, `docs/ai/REFERENCE/**`, or `docs/01-VISION.md`.
- No modification of `apps/registry-viewer/src/registry/shared.ts` (parallel workstream — see RS-8).
- No widening of `UIBuildContext`; no new fields on `UIState`; no new `UIAudience` variants.
- No `boardgame.io/testing` import in the test file.
- No reordering / renaming of existing `LegendaryGame` fields.
- No `ctx.random.*`, `Math.random()`, `Date.now()`, or I/O inside `buildPlayerView`.
- No mutation of `G` or `ctx` inside `buildPlayerView`.
- No entries appended to `G.messages` from `buildPlayerView`.
- No expansion of `CoreMoveName` / `CORE_MOVE_NAMES`.
- No per-move / per-phase lifecycle wiring of `buildPlayerView` (lifecycle prohibition — `buildPlayerView` is consumed exclusively via `LegendaryGame.playerView`; WP-028/WP-029 lifecycle-prohibition precedent applies verbatim).
- No `git add .` / `-A` / `-u` at any commit step — exact filename staging only (P6-27).

**Rule:** Anything not explicitly allowed is out of scope.

---

## Test Expectations (Locked)

- **New tests:** exactly **6** tests in `packages/game-engine/src/game.playerView.test.ts`, all inside a single `describe('LegendaryGame.playerView (WP-089)')` block (one describe → +1 suite per WP-031 precedent P6-15):
  1. `'returns a UIState deep-equal to filterUIStateForAudience(buildUIState(G, ctxLike), player(P1)) when playerID is "0"'`
  2. `'returns spectator projection when playerID is null'`
  3. `'returns spectator projection when playerID is undefined (identical to null case)'`
  4. `'is deterministic: two calls with identical inputs produce deep-equal results'`
  5. `'does not mutate its gameState argument (JSON.stringify identical before/after)'`
  6. `'does not mutate its ctx argument (JSON.stringify identical before/after)'`
- **Existing test changes:** none expected. All 507 existing engine tests must continue to pass.
- **Prior test baseline:** engine `507 / 114 / 0` (re-verified this session). Repo-wide `672 / 128 / 0` (session-context §1 anchor, post-WP-088).
- **Expected baseline after execution:** engine `513 / 115 / 0` (+6 tests, +1 suite). Repo-wide `678 / 129 / 0` (+6 tests, +1 suite).
- **Test boundaries:** no new logic in existing test files; no `boardgame.io/testing` import; no modifications to `makeMockCtx` or other shared helpers; `gameState` constructed via `buildInitialGameState(matchConfiguration, registryForSetup, makeMockCtx())` per existing `uiState.build.test.ts` pattern; `ctxLike` is an inline object literal matching the boardgame.io `Ctx` subset that `playerView` actually receives (`phase`, `turn`, `currentPlayer`, `numPlayers`, etc., as needed) — no cast required if the literal is typed `as any` only at the `playerView!` invocation site with a `// why:` comment citing the test-only nature.
- **Defensive guards:** `buildPlayerView` must tolerate a `ctx` whose `.phase` is `null` (boardgame.io 0.50.x transport-side possibility); existing `buildUIState` already applies the `?? 'unknown'` fallback.

---

## Risk & Ambiguity Review (Resolve Now, Lock for Execution)

### PS-1 — WP-089 Is Not Registered in `WORK_INDEX.md` (RESOLVED 2026-04-24)

- **Risk:** `.claude/rules/work-packets.md` prohibits executing a packet not listed in WORK_INDEX.md. Session-context §2 documents the intentional trim during WP-088 A0.
- **Impact:** HIGH (blocks execution start).
- **Mitigation:** Re-introduced WP-089's row (14 lines) verbatim from `.claude/worktrees/wp088-handoff-preserve/WORK_INDEX.md.with-all-wp-a0` lines 1602-1614, inserted after WP-088's entry in the current `WORK_INDEX.md`. Also re-added the `Engine→Client Projection Wiring (prerequisite for WP-090): WP-028 + WP-029 → WP-089 (LegendaryGame.playerView)` Dependency Chain subsection inside the ASCII-art block, after the `WP-027 + WP-028 → WP-063 ─┘` line. WP-090 / WP-059 portions in the backup were **not** pulled forward — they remain pending their own A0 sessions.
- **Status:** **RESOLVED 2026-04-24.** Changes staged in the working tree; awaiting the `SPEC: WP-089 A0 pre-flight bundle` commit.
- **Decision / pattern:** Used the pre-preserved backup (session-context §2); did not re-derive. Selective re-add only.

### PS-2 — EC-089 Is Not Registered in `EC_INDEX.md` (RESOLVED 2026-04-24)

- **Risk:** EC-089 §Before-Starting gate item (d) requires "this EC is registered in `EC_INDEX.md`". Prior state: EC_INDEX.md listed the latest as EC-088 at row 153; Summary `Done 16 / Draft 46 / Total 62`.
- **Impact:** HIGH (blocks execution start).
- **Resolution detail:** The backup at `.claude/worktrees/wp088-handoff-preserve/EC_INDEX.md.with-all-wp-a0` was found to contain rows for EC-059 and EC-090 but **no EC-089 row** (confirmed by grep — the A0 trim that dropped WP-089 predates any EC-089 index row ever being written). A fresh EC-089 row was therefore drafted from the EC-089 checklist + WP-089 spec, mirroring the EC-088 Draft-state row pattern from the backup. Inserted before the EC-085 entry in the `| EC-### | WP-### | Layer | Execution Scope | Status |` table. Summary counts updated: `Draft 46 → Draft 47; Total 62 → Total 63; Done 16` unchanged.
- **Status:** **RESOLVED 2026-04-24.** Changes staged in the working tree; awaiting the `SPEC: WP-089 A0 pre-flight bundle` commit.
- **Note for future pre-flights:** The session-context §2 claim that the preserved backups contain "WP-088 + WP-089 + WP-090 + WP-059 A0 entries co-mingled" holds for `WORK_INDEX.md` but **not** for `EC_INDEX.md` — the EC-089 row had to be composed fresh rather than lifted from the backup. This is a back-sync candidate for session-context §2.

### RS-1 — `UIAudience` Import Path (SCOPE-NEUTRAL LOCK)

- **Risk:** WP-089 Scope(In)§A line 216 says "Import `UIAudience` from `./ui/uiState.filter.js` (type-only) **if it is exported there; otherwise construct the audience literal inline** at the `playerView` call site". Actual state: `UIAudience` is **not** exported from `uiState.filter.ts` (confirmed by grep: it is imported *into* the filter from `./uiAudience.types.js`).
- **Impact:** LOW (WP already provides the fallback branch).
- **Mitigation / Lock:** Take the fallback branch. **Do not import `UIAudience`** into `game.ts`. Construct the audience literal inline at the `filterUIStateForAudience(...)` call site: `{ kind: 'player', playerId: playerID }` or `{ kind: 'spectator' }`. This matches `filterUIStateForAudience`'s parameter contract by structural typing (discriminated union) and avoids adding a new import.
- **Decision / pattern:** Structural typing over nominal import — matches the WP-028 `UIBuildContext` inline-literal precedent.

### RS-2 — `makeMockCtx` Does Not Satisfy boardgame.io `Ctx` (SCOPE-NEUTRAL LOCK)

- **Risk:** EC-089 §Files-to-Produce line 48 requires "Uses `makeMockCtx` from `packages/game-engine/src/test/mockCtx.ts` for constructing the `ctx`-like fixture." But `makeMockCtx` returns `SetupContext` = `{ ctx: { numPlayers }, random: { Shuffle } }` (`mockCtx.ts:28-44`) — it does **not** populate `ctx.phase`, `ctx.turn`, or `ctx.currentPlayer`, which `buildPlayerView → buildUIState` requires.
- **Impact:** MEDIUM (EC text and reality diverge; executor would otherwise invent an ad-hoc workaround mid-session).
- **Mitigation / Lock:** Dual-context test pattern, mirroring `uiState.build.test.ts:52-56`:
  - `makeMockCtx()` is still used to construct `gameState` via `buildInitialGameState(matchConfiguration, registryForSetup, makeMockCtx())` (setup-side).
  - An **inline `ctxLike` object literal** (`{ phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 2 }`, typed as `any` only at the `LegendaryGame.playerView!(gameState, ctxLike as any, playerID)` call, with a `// why:` comment) supplies the boardgame.io `Ctx` subset that `playerView` consumes (runtime-side).
  - **No modifications to `makeMockCtx`**; **no new shared test helper**; **no boardgame.io/testing import**.
- **Decision / pattern:** Extends WP-028 `UIBuildContext` inline-literal precedent to `playerView` tests. The EC text is carried through verbatim on paper — `makeMockCtx` **is** used in the test, just not as the `ctx` passed into `playerView`. Back-sync note for EC-089 after execution: clarify "for constructing the `ctx`-like fixture" to read "for constructing the `SetupContext` used by `buildInitialGameState`; a separate inline `ctxLike` literal supplies the runtime `Ctx` subset that `playerView` receives" — optional 01.6 post-mortem follow-up.

### RS-3 — `Game<LegendaryGameState, …>` Rejects Reshape (LOCAL ASSERTION LOCK)

- **Risk:** `LegendaryGame: Game<LegendaryGameState, …>` (game.ts:81) locks `Game.playerView`'s declared signature to `(state: G, ctx: Ctx, playerID: PlayerID) => G` where `G = LegendaryGameState`. Returning `UIState` (a non-subtype of `LegendaryGameState`) and accepting `PlayerID | null | undefined` triggers TS2322 / TS2345.
- **Impact:** MEDIUM (compiler-enforced; caught at build time but requires an authorized workaround).
- **Mitigation / Lock:** Take WP-089 §Type Safety Note option (b) — a **narrowly-scoped local assertion at the `playerView` assignment site only**. Example form (executor selects exact keyword pattern):
  ```ts
  // why: boardgame.io 0.50.x Game<G,…>.playerView types as (G, Ctx, PlayerID) => G,
  // but this engine reshapes the client-visible state to UIState per D-0301 / D-8901.
  // Local assertion confined to this assignment — Game<...> generic unchanged to avoid
  // ripple through every consumer of LegendaryGameState.
  playerView: buildPlayerView as unknown as Game<LegendaryGameState>['playerView'],
  ```
  Do **not** change the `Game<LegendaryGameState, …>` generic — option (a) would ripple through every file referencing the generic and expands the WP-089 scope.
- **Decision / pattern:** Precedent — `game.ts:213` already uses a similar `as unknown as boolean | void` assertion on `endIf` for the same category of boardgame.io type-vs-runtime gap, with a `// why:` comment at `game.ts:210-212`. WP-089 extends the pattern; does not invent it.

### RS-4 — 01.5 Runtime Wiring Allowance INVOKED (LOCK)

- **Risk:** Adding `playerView: buildPlayerView` to the `LegendaryGame` object literal is a **new `LegendaryGame` top-level field**, which is one of the four `01.5-runtime-wiring-allowance.md` triggers.
- **Impact:** LOW (the allowance is precisely designed for this).
- **Mitigation / Lock:** Session prompt MUST INVOKE 01.5 explicitly for this single field addition plus the RS-3 local type assertion plus the required `// why:` comments. The 01.5 invocation scope is confined to `game.ts`. No other file is touched under 01.5.
- **Decision / pattern:** Declare in the session prompt, per the standing WP-030 precedent pattern (`01.5 INVOKED` block with explicit criteria check).

### RS-5 — Aliasing Discipline Already Upstreamed (OBSERVATION)

- **Risk:** Naïve composition of `buildUIState` + `filterUIStateForAudience` could return objects aliasing `G`.
- **Impact:** LOW — both upstream functions already apply spread-copy discipline (WP-028 `cardKeywords` fix at `uiState.build.ts:221-226`; WP-029 shallow-copy filter throughout `uiState.filter.ts`).
- **Mitigation / Lock:** `buildPlayerView` does not need its own aliasing-prevention logic — it composes two pure functions and returns the second's output. A `// why:` comment on the return statement citing "returned UIState is a new object per WP-028 / WP-029 upstream copy discipline" is sufficient documentation.
- **Decision / pattern:** No post-mortem aliasing audit required for `buildPlayerView` beyond confirming the two upstream purity contracts still hold.

### RS-6 — 01.6 Post-Mortem MANDATORY (LOCK)

- **Risk:** `playerView` establishes the engine→client projection boundary — a new long-lived abstraction that every future UI-consuming WP depends on.
- **Impact:** HIGH value to future WPs (especially WP-090 Live Match Client Wiring) if the contract is mis-stated.
- **Mitigation / Lock:** 01.6 post-mortem is MANDATORY per triggers "new long-lived abstraction" and "new contract consumed by future WPs". Session prompt must schedule it.
- **Decision / pattern:** Post-mortem lives at `docs/ai/post-mortems/01.6-WP-089-engine-playerview-wiring.md` per existing convention.

### RS-7 — `playerView` Field Placement Ambiguity (SCOPE-NEUTRAL LOCK)

- **Risk:** WP-089 Scope(In)§A mentions two candidate placements for `playerView` in the `LegendaryGame` literal: "immediately after `name` / `minPlayers` / `maxPlayers` and before `validateSetupData`" (line 237) and "adjacent to `setup` / `moves` / `phases`" (line 77). EC-089 Guardrails line 34 says "adjacent to `setup` / `moves` / `phases`".
- **Impact:** LOW (cosmetic; both placements are valid).
- **Mitigation / Lock:** Place `playerView: buildPlayerView,` **immediately after `setup:` and before `moves:`** (at the logical boundary between "state initialization" and "state transitions" — with `playerView` as the "state-read" hook). This matches EC-089 Guardrails language verbatim and preserves the natural reading order of the object.
- **Decision / pattern:** EC-089 wins (higher authority than WP-089 for execution per 01.4 §Review Order); WP-089 text at line 237 is a back-sync candidate.

### RS-8 — Parallel-Session `shared.ts` and Other Untracked Files (LOCK)

- **Risk:** `apps/registry-viewer/src/registry/shared.ts` carries an unstaged Vue v-for key fix from a separate workstream (session-context §3.3). Untracked WP-090 / WP-059 / EC-090 / EC-059 files are on disk.
- **Impact:** MEDIUM (accidental staging would expand WP-089 scope).
- **Mitigation / Lock:** Stage by **exact filename only** (P6-27). Verify `git status` before every commit. Do **not** touch `shared.ts`, the WP-090 files, the WP-059 files, the EC-090 file, the EC-059 file, or the `.claude/worktrees/` directory. The A0, A, and B commits each touch only the files listed in Scope Lock → Allowed.
- **Decision / pattern:** Exact-filename staging is already the standing norm (WP-087 precedent used `git stash pop` for in-flight WP-089 / WP-090 governance adds; the same discipline applies inverted here).

### RS-9 — Session-Context Baseline Rebase (OBSERVATION)

- **Risk:** WP-089's invocation (if ever drafted against pre-WP-087-A1 state) would cite baseline `506 / 113 / 0` engine + `671 / 127 / 0` repo-wide. Session-context §1 and §3.1 authorize a rebase to the current `507 / 114 / 0` + `672 / 128 / 0` post-WP-088 baseline.
- **Impact:** LOW (handled by session context; the pre-flight already uses the correct numbers).
- **Mitigation / Lock:** Session prompt must cite `507 / 114 / 0` engine + `672 / 128 / 0` repo-wide as the starting baseline, with expected post-execution delta `+6 / +1 / 0` yielding `513 / 115 / 0` engine + `678 / 129 / 0` repo-wide. If WP-089's eventual invocation draft cites the pre-drift numbers, apply the rebase protocol from session-context §3.1 verbatim.

### RS-10 — Test Isolation from Lifecycle Wiring Creep (LOCK)

- **Risk:** A helpful executor might wire `buildPlayerView` into a phase hook, `onBegin`, or move (lifecycle wiring creep — WP-028 precedent).
- **Impact:** MEDIUM.
- **Mitigation / Lock:** Session prompt must include an explicit lifecycle prohibition: `buildPlayerView` is consumed **exclusively** via `LegendaryGame.playerView` — never from `game.ts`'s phase-level hooks, turn hooks, or any move. Mirror the WP-028 `buildUIState` lifecycle-prohibition language verbatim.

---

## Established Patterns to Follow (Locked Precedents for WP-089)

The following prior patterns apply verbatim and must be reused:

- **D-0301 / D-0302** — UIState is the sole engine→UI projection; one UIState, multiple audiences.
- **Lifecycle isolation for non-framework-authoritative code** (WP-028) — explicit prohibition on wiring `buildPlayerView` into lifecycle hooks.
- **Projection purity as a strict contract** (WP-028) — no caching, memoization, closures over G, or retained state.
- **Projection aliasing prevention** (WP-028) — delegated to upstream helpers; no new aliasing surface.
- **Local narrowly-scoped type assertion at framework-interface assignment site** (game.ts:213 `endIf` precedent) — single cast with `// why:` comment.
- **Dual-context test pattern** (WP-028 `uiState.build.test.ts`) — `makeMockCtx` for `SetupContext` + inline literal for boardgame.io `Ctx` subset.
- **Contract enforcement tests** (WP-028) — six tests frame as contract enforcement, not illustration; if they fail, the implementation is incorrect.
- **One `describe()` block → +1 suite** (WP-031 precedent P6-15) — `describe('LegendaryGame.playerView (WP-089)')` wrapping six `test()` calls yields `+6 / +1 / 0`.
- **Exact-filename staging** (P6-27) — never `git add .` / `-A` / `-u`.
- **`EC-089:` prefix on code commits; `SPEC:` on governance / pre-flight / close commits; `WP-089:` forbidden** (P6-36, 01.3).
- **01.5 INVOKED block in session prompt** (WP-030 precedent) — the single `game.ts` field addition requires an explicit invocation statement.
- **01.6 post-mortem scheduled in session prompt** (WP-028 precedent) — MANDATORY per new long-lived abstraction trigger.
- **Pre-preserved A0 backup at `.claude/worktrees/wp088-handoff-preserve/`** (session-context §2) — diff and selectively re-add only WP-089 rows for PS-1 / PS-2.

---

## Pre-Session Actions (PS-#)

| # | Action | Owner | Scope | Status |
|---|---|---|---|---|
| PS-1 | Re-introduce WP-089 row in `WORK_INDEX.md` (+ `Engine→Client Projection Wiring` Dependency Chain subsection) from preserved backup | Session-prompt author, pre-session A0 SPEC commit | Docs-only | Open — required before session prompt |
| PS-2 | Register EC-089 row in `EC_INDEX.md` (`Draft` status) from preserved backup; update Summary counts `Draft 46 → 47; Total 62 → 63` | Same A0 SPEC commit as PS-1 | Docs-only | Open — required before session prompt |

Both PS items resolve in a single `SPEC: WP-089 A0 pre-flight bundle — register WP-089 / EC-089 governance rows (PS-1, PS-2)` commit. No code changes. Commit-msg prefix `SPEC:` per 01.3 (no `packages/` or `apps/` staged).

---

## Verdict

**READY TO EXECUTE.** PS-1 and PS-2 resolved 2026-04-24 via in-tree edits to `WORK_INDEX.md` and `EC_INDEX.md`; changes await the `SPEC: WP-089 A0 pre-flight bundle` commit.

- Dependencies WP-028 / WP-029 are verified-complete with correct export paths.
- Engine baseline is green at `507 / 114 / 0` (re-verified 2026-04-23).
- Repo-wide baseline is `672 / 128 / 0` (session-context §1 anchor, post-WP-088 close at `57327c2`).
- All contract-verification items PASS after the RS-1 (inline `UIAudience` literal) and RS-2 (dual-context test fixture) locks.
- No code-category boundary issues; no new directory; no new decision slot conflicts.
- The one compile-time obstacle (Game<…> generic rejecting the reshape, RS-3) has a precedent-aligned local-assertion resolution that ripples nowhere.
- 01.5 INVOKED (RS-4) and 01.6 post-mortem MANDATORY (RS-6) locked in the session-prompt contract.
- WP-089 row registered in `WORK_INDEX.md` (line ~1601, Ready status); EC-089 registered in `EC_INDEX.md` (Draft status); Dependency Chain ASCII block carries the `Engine→Client Projection Wiring` subsection per backup lines 1794-1796.

The session execution prompt is authorized for generation once the A0 SPEC commit lands (or concurrently with the session-prompt draft per A0 convention).

---

## Authorized Next Step

1. **PS-1 / PS-2 in-tree resolution complete (2026-04-24).** `WORK_INDEX.md` and `EC_INDEX.md` edits are staged in the working tree and ready to commit as `SPEC: WP-089 A0 pre-flight bundle — register WP-089 / EC-089 governance rows (PS-1, PS-2)` (docs-only; `SPEC:` prefix valid per 01.3).
2. Re-run the **copilot check (step 1b per `01.7`)** — Issues 4(a), 4(b), 21, and 30 FIXes now fold naturally into the forthcoming session-prompt draft. Expected verdict: **CONFIRM**.
3. Draft the WP-089 session execution prompt at `docs/ai/invocations/session-wp089-engine-playerview-wiring.md`, folding in the RS-1 (inline `UIAudience` literal), RS-2 (dual-context test fixture), RS-3 (exact cast form), RS-4 (01.5 INVOKED), and RS-6 (01.6 post-mortem MANDATORY) locks verbatim.
4. Commit the A0 SPEC bundle (staging exact filenames: `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/ai/invocations/preflight-wp089-engine-playerview-wiring.md`, `docs/ai/invocations/copilot-wp089-engine-playerview-wiring.md`, `docs/ai/invocations/session-wp089-engine-playerview-wiring.md`, `docs/ai/session-context/session-context-wp089.md`, plus the untracked WP-089 / EC-089 files themselves — **never** `git add .` / `-A` / `-u`).
5. Open the WP-089 execution session in a fresh Claude Code session (step 3 per 01.4 workflow table).

Post-execution back-sync candidates (non-blocking, deferrable to 01.6 post-mortem):

- WP-089 Scope(In)§A line 216: "Import `UIAudience` from `./ui/uiState.filter.js` (type-only) if it is exported there" — remove the "if exported there" branch and lock the inline-literal form, matching actual state.
- WP-089 line 237: `playerView` placement phrasing "after name/minPlayers/maxPlayers" — align with EC-089's "adjacent to `setup` / `moves` / `phases`" per RS-7.
- EC-089 §Files-to-Produce line 48: clarify `makeMockCtx` usage per RS-2 dual-context lock.
- Session-context-wp089.md §2: clarify that the preserved `EC_INDEX.md.with-all-wp-a0` backup did **not** contain an EC-089 row — a fresh row was composed from EC-089 + WP-089 mirroring the EC-088 Draft pattern.
