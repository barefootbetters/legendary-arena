# EC-477 — Extract Shared Gauntlet-Truth Helper (Execution Checklist)

**Source:** docs/ai/work-packets/WP-442-gauntlet-truth-helper.md
**Layer:** Server

## Before Starting
- [ ] On `origin/main` @ `ff812ae1`; `apps/server` builds and its legends tests pass green.
- [ ] `apps/server/src/legends/gauntlet.logic.ts` on `main` inlines the leg-clear checks in `getGauntletStandings` and defines `matchesApprovedLoadout`, `findBestPoolAssignment` + 4 helpers, `FIXED_POOL_TEAM_CAP`, and `RosterLegAccumulator`.
- [ ] Grep confirms `findBestPoolAssignment` / `matchesApprovedLoadout` / `RosterLegAccumulator` have **no external consumers** (only `buildGauntletCatalog` + `GauntletDefinition` cross the module boundary — neither moves).
- [ ] `pnpm --filter @legendary-arena/server build` exits 0.
- [ ] `pnpm --filter @legendary-arena/server test` exits 0.
- [ ] **Scope lock — EXACT target set (any file outside is a FAIL):** `apps/server/src/legends/gauntletTruth.logic.ts` (new), `apps/server/src/legends/gauntlet.logic.ts` (modified), `apps/server/src/legends/gauntletTruth.logic.test.ts` (new) + governance ledgers only.

## Locked Values (do not re-derive)
- `FIXED_POOL_TEAM_CAP = 12` — moved verbatim (D-24187 §5), re-exported.
- **`qualifiesAsLegClear` clause order (identical to the source fold):** (1) `publishedScoringConfigVersion === null`→false; (2) version mismatch→false; (3) `!Number.isInteger(playerCount) || <1 || >5`→false; (4) `ownerVisibilities.length !== playerCount`→false; (5) `!matchesApprovedLoadout(...)`→false; (6) any visibility not in `{'link','public'}`→false; (7) else true.
- **`matchesApprovedLoadout`** (verbatim): undefined→true; empty-for-count→false; null `henchmanKey`→false; villain segment = `scenarioKey.split('::')[2] ?? ''` + `henchmanKey` exact-match one entry.
- **`findBestPoolAssignment`** (verbatim): subset enumeration; budget filter on pool union; published `heroPool` = union of the **chosen** teams sorted ASC; ties→smallest joined pool.
- **Exported surface of `gauntletTruth.logic.ts`:** `qualifiesAsLegClear`, `LegClearReplayFacts`, `matchesApprovedLoadout`, `findBestPoolAssignment`, `RosterLegAccumulator`, `FIXED_POOL_TEAM_CAP`. Private: `collectDistinctTeams`, `selectBoundedTeams`, `evaluatePoolUnion`, `pickBestTeamForLeg`.
- **`LegClearReplayFacts`:** `{ scenarioKey: string; scoringConfigVersion: number; playerCount: number; ownerVisibilities: readonly string[]; henchmanKey: string | null }`.
- **Signature decoupling:** `selectBoundedTeams` / `findBestPoolAssignment` take `boardName: string` (caller passes `buildGauntletBoardName(definition)`), NOT `definition` — the warning string stays byte-identical.

## Guardrails
- **BEHAVIOR-PRESERVING:** identical inputs → identical `getGauntletStandings` output. `gauntlet.logic.test.ts` passes **UNCHANGED** — editing that file means behavior changed and the refactor is wrong. If it needs editing, **STOP**.
- **LAYER LOCK:** `gauntletTruth.logic.ts` imports nothing from `registry`, `game-engine`, `preplan`, `pg`, `boardgame.io`, or any `apps/*` — only Node built-ins + **type-only** imports from `./gauntlet.logic.js` (`GauntletApprovedLoadouts`, `GauntletApprovedLoadout`).
- **PURE + DATA-INJECTED:** the helper receives already-fetched facts / budgets / board name / published version; it performs no DB query or I/O. The predicate takes a plain `number | null` published version, NOT the `LeaderboardDependencies` bundle.
- **NO IMPORT CYCLE:** runtime edge is one-directional `gauntlet.logic → gauntletTruth`; the reverse (`RosterLegAccumulator`, `LegClearReplayFacts` into `gauntlet.logic.ts`) is **type-only**.
- **NO `.reduce()`** in the extracted or rewired logic — keep `for` / `for...of`; the owner-visibility list in the rewired fold is built with an explicit `for...of`.
- **SINGLE SOURCE OF TRUTH:** after this WP the predicate + pool search exist in exactly one module; no re-inline or fork. WP-5 will consume the same functions.
- **NO out-of-scope file:** `legends.publisher.ts`, `legends.scheduler.ts`, `server.mjs`, R2 snapshots untouched.

## Required `// why:` Comments
- `FIXED_POOL_TEAM_CAP` — the D-24187 §5 bounded-search cap (moved verbatim, not re-derived).
- The `boardName: string` parameter on `selectBoundedTeams` / `findBestPoolAssignment` — why the string is passed in (decouples the pure helper from the board-name builder / `GauntletDefinition`, avoiding a runtime edge back into `gauntlet.logic.ts`; warning string stays byte-identical).
- `qualifiesAsLegClear` — that the clause order mirrors the source fold exactly (behavior preservation).

## Files to Produce
- `apps/server/src/legends/gauntletTruth.logic.ts` — **new** — pure truth helper: `qualifiesAsLegClear` + `LegClearReplayFacts`, `matchesApprovedLoadout`, `findBestPoolAssignment` + 4 private helpers + `FIXED_POOL_TEAM_CAP`, moved-and-exported `RosterLegAccumulator`.
- `apps/server/src/legends/gauntlet.logic.ts` — **modified** — remove moved defs; add runtime + type-only imports from `./gauntletTruth.logic.js`; rewire `getGauntletStandings` fold to call `qualifiesAsLegClear` + `boardName`-string `findBestPoolAssignment`. No public export renamed/removed.
- `apps/server/src/legends/gauntletTruth.logic.test.ts` — **new** — `node:test` unit tests (predicate all-pass + 6 reject clauses + undefined-loadouts skip; `matchesApprovedLoadout` 5 cases; `findBestPoolAssignment` budget-valid / over-budget / chosen-union / tie-break / cap truncation).

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (incl. **unchanged** `gauntlet.logic.test.ts` + new `gauntletTruth.logic.test.ts`).
- [ ] `git diff --name-only origin/main -- apps/server/src/legends/gauntlet.logic.test.ts` prints nothing (correctness-gate file unedited).
- [ ] Layer-lock grep on `gauntletTruth.logic.ts` returns no pg/boardgame.io/registry/engine/preplan import (grep exit 1).
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change — infrastructure only" (D-24026 inverted).
- [ ] `docs/ai/DECISIONS.md` — **no entry** (this WP reserves no D-number; layer lock is inherited).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph `📝` → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-477 status → `Done`.
- [ ] No file outside `Files to Produce` (+ governance ledgers) modified.

## Common Failure Smells
- `gauntlet.logic.test.ts` needs an edit to pass → behavior changed; the extraction drifted a clause. Revert and move verbatim.
- An import cycle / `ERR_MODULE` at server boot → a value (non-type) import from `gauntlet.logic.js` into `gauntletTruth.logic.ts`. Make the back-edge type-only.
- A `.reduce()` sneaks into the visibility-list build → rewrite as `for...of` (code-style §16.2 + layer rule).
- The cap-truncation warning string changed → `selectBoundedTeams` received a re-derived board name instead of the precomputed `buildGauntletBoardName(definition)` string.
