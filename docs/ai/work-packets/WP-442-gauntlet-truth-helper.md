# WP-442 — Extract the Shared Gauntlet-Truth Helper (server)

**User-Visible Surface:** `none — infrastructure`. This is a behavior-preserving
server-layer refactor: the leg-clear qualification predicate and the
fixed-division pool-assignment search move out of
`apps/server/src/legends/gauntlet.logic.ts` into a new pure helper module, and
`getGauntletStandings` is rewired to consume them with **zero behavior change**.
No endpoint, snapshot, migration, or client surface changes; a player observes
nothing. **D-24026 inverted** — STATUS states "No user-observable change —
infrastructure only." The payoff is structural: WP-5's future per-run tracker
read will consume the **same** helper, so the leaderboard and the tracker cannot
drift on what "cleared a leg" or "champion" means.

## Goal

After this session, `apps/server/src/legends/` contains a new pure module
`gauntletTruth.logic.ts` that owns the reusable gauntlet-progression truth
logic: the **leg-clear qualification predicate** (`qualifiesAsLegClear`) and the
**fixed-division pool-assignment search** (`findBestPoolAssignment` plus its
private helpers `collectDistinctTeams`, `selectBoundedTeams`, `evaluatePoolUnion`,
`pickBestTeamForLeg`, the `FIXED_POOL_TEAM_CAP` constant, and
`matchesApprovedLoadout`). `getGauntletStandings` in `gauntlet.logic.ts` is
refactored to call these extracted functions instead of its inlined copies, with
**identical observable behavior** — the existing `gauntlet.logic.test.ts` passes
**unchanged** (the primary correctness gate). A new `gauntletTruth.logic.test.ts`
unit-tests the extracted functions in isolation against seeded row fixtures. The
helper stays pure and data-injected: it queries no database and imports nothing
from `registry`, `game-engine`, `preplan`, `pg`, or `boardgame.io` (the layer
lock inherited from `gauntlet.logic.ts`). This is WP #3 of the Mastermind
Gauntlets: download → import → build → track epic — the truth logic is extracted
**before** any run API shape freezes, so the rule engine (not an endpoint)
defines the shape WP-5 reuses.

## Assumes

- **On `origin/main` @ `ff812ae1`** (the drafting baseline; `git rev-parse
  origin/main` at draft time). `apps/server` builds and its legends tests pass
  green on this SHA.
- `apps/server/src/legends/gauntlet.logic.ts` exists on `main` and exports
  `getGauntletStandings(definition, database, leaderboardDeps)`,
  `buildGauntletCatalog`, the board-name builders, `GAUNTLET_PLAYER_COUNTS`, and
  the types `GauntletDefinition`, `GauntletApprovedLoadouts`,
  `GauntletApprovedLoadout`, `GauntletHeroPoolBudgets`, `GauntletStandingsForCount`,
  `GauntletSchemeSummary`, `GauntletSetSummary`, `GauntletLeg`. It currently
  inlines the leg-clear qualification checks inside `getGauntletStandings`' fold
  loop and defines `matchesApprovedLoadout`, `findBestPoolAssignment`,
  `collectDistinctTeams`, `selectBoundedTeams`, `evaluatePoolUnion`,
  `pickBestTeamForLeg`, `FIXED_POOL_TEAM_CAP`, and the internal
  `RosterLegAccumulator` interface. (Source: the file on `main`, WP-342 / WP-344
  / WP-384 / WP-395.)
- The extracted internal helpers have **no external consumers**: a repo grep
  shows `findBestPoolAssignment`, `matchesApprovedLoadout`, and
  `RosterLegAccumulator` are referenced only within `gauntlet.logic.ts`. Only
  `buildGauntletCatalog` (imported by `server.mjs`) and the `GauntletDefinition`
  type (imported by `legends.publisher.ts` / `legends.scheduler.ts`) cross the
  module boundary, and **neither moves**. (Source: grep on `main`.)
- `apps/server/src/legends/gauntlet.logic.test.ts` exists on `main` and exercises
  the standings logic only through the public `getGauntletStandings` /
  `buildGauntletCatalog` surface (it imports neither `findBestPoolAssignment` nor
  `matchesApprovedLoadout` directly). This is why an internal signature change is
  invisible to it, and why "the existing test passes unchanged" is a valid
  correctness gate. (Source: the file on `main`.)
- `apps/server/src/leaderboards/leaderboard.types.ts` exports
  `DatabaseClient` and `LeaderboardDependencies` (with
  `checkParPublished(scenarioKey)` returning `{ scoringConfig: {
  scoringConfigVersion } } | null`); the caller resolves the published version
  from it and passes a plain `number | null` into the extracted predicate.
  (Source: the file on `main`.)
- The layer lock is already in force on `gauntlet.logic.ts` (its module header +
  D-24187 / D-24199): no engine, registry, preplan, pg, or UI imports. The new
  module inherits this lock verbatim; it introduces **no** new decision.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the Server layer
  and its Import Rules row (`apps/server` may import `pg` + registry + Node
  built-ins; **pure gauntlet logic imports none of those**). The extracted module
  is a pure server-layer helper with the same import posture as its source file.
- `.claude/rules/architecture.md` Import Rules table + §Persistence Boundary —
  `G`/`ctx` untouched; standings are a read-only derived aggregation; no snapshot
  or persistence surface is touched by this refactor.
- `.claude/rules/code-style.md` — ESM-only, `node:test`, `.test.ts`, full English
  names, no `.reduce()` in the extracted logic, `// why:` on non-self-evident
  constants and on any swallowed error, human-style code. The extracted code
  keeps its existing `for` / `for...of` structure (no new `.reduce()`).
- `apps/server/src/legends/gauntlet.logic.ts` (WP-342 / WP-344 / WP-384 / WP-395)
  — the source of the extraction. Read the fold loop's per-replay qualification
  block and `findBestPoolAssignment` + its four private helpers verbatim; the
  extraction moves them **byte-for-byte** except for the two decoupling signature
  changes named in `## Contract`.
- `apps/server/src/legends/gauntlet.logic.test.ts` — the primary correctness
  gate; it must pass **unchanged** after the refactor.
- `docs/ai/DECISIONS.md` — D-24131 / D-24134 / D-24187 / D-24199 (the gauntlet
  standings contract and the clause a–g qualification semantics this refactor
  preserves), D-24245 (number ledger). This WP reserves **no** new D-entry (see
  "Why now" below).
- `C:\Users\jjensen\.claude\plans\glimmering-meandering-russell.md §3
  "Progression = derived truth, extracted once"` — the approved design this WP
  implements.

**Why now / split rationale.** This is WP #3 of the approved Mastermind Gauntlets
epic (plan §Work-packet decomposition). It deliberately lands **before** the run
persistence (WP-4) and the import + run API (WP-5) so the truth logic exists as a
single shared helper before any API shape freezes — "the rule engine, not the
endpoint, defines the shape." It is a single-layer, single-app (`apps/server`)
behavior-preserving refactor. It touches no contract file (`.types.ts` /
`.validate.ts` / `.gating.ts`), crosses no layer boundary, and touches no
determinism / persistence / hash surface — but it is **not** lightweight-lane
eligible: it is a **refactor of existing logic**, not strictly additive, which
fails the lane's empirical criterion #7 (Structural criterion #1 also requires no
rewrite of existing logic). It therefore runs the standard two-session lane.

**Why no DECISIONS.md entry.** This is a behavior-preserving extract-to-helper
that locks **no new architectural invariant**. The registry/engine/pg-free layer
lock is **pre-existing** (inherited from `gauntlet.logic.ts`' header and D-24187 /
D-24199), not established here. The "single source of truth — one helper consumed
by both the leaderboard and WP-5's run read" property is enforced **structurally**
(the code physically has one implementation) and captured as an EC Guardrail + the
`## Contract` note below, which is the right durability tier for it. Per
`01.0a` Step 2, a `D-NNNNN` is reserved "only if the WP locks architectural
decisions"; this one does not, and the approved plan assigns required D-entries
only to WP-1 (D-24260) and WP-4, flagging WP-3 as a layer-lock note rather than a
decision. `D-24262` therefore stays in the free pool.

## Scope (In)

- **New module** `apps/server/src/legends/gauntletTruth.logic.ts` (pure,
  data-injected, layer-locked) that **receives** the following moved-verbatim
  logic from `gauntlet.logic.ts`:
  - `FIXED_POOL_TEAM_CAP` constant (value `12`, unchanged).
  - `matchesApprovedLoadout(approvedLoadouts, playerCount, scenarioKey,
    henchmanKey)` — moved verbatim, now **exported**.
  - `findBestPoolAssignment(...)` and its private helpers `collectDistinctTeams`,
    `selectBoundedTeams`, `evaluatePoolUnion`, `pickBestTeamForLeg` — moved
    verbatim except the decoupling signature change below;
    `findBestPoolAssignment` becomes **exported**, the four helpers stay
    module-private.
  - The `RosterLegAccumulator` interface — moved here and **exported** (it is the
    accumulator the pool search consumes); `gauntlet.logic.ts` type-only imports
    it back.
- **New exported predicate** `qualifiesAsLegClear(facts, approvedLoadouts,
  publishedScoringConfigVersion)` in the new module, which packages the
  per-replay qualification checks currently inlined in `getGauntletStandings`'
  fold (clauses (d)–(g) plus the PAR-published version gate). It takes a
  `LegClearReplayFacts` value object and returns `boolean`. The predicate applies
  the checks in the **same order** as the source fold: published-version present
  → version match → player-count integer/range guard → roster-size-equals-count →
  `matchesApprovedLoadout` → all-owners-visible. Behavior is identical; it is a
  pure boolean over already-fetched facts.
- **New exported type** `LegClearReplayFacts` (the predicate's input value
  object): `{ scenarioKey: string; scoringConfigVersion: number; playerCount:
  number; ownerVisibilities: readonly string[]; henchmanKey: string | null }`.
- **Decoupling signature change (behavior-preserving):** `selectBoundedTeams` and
  `findBestPoolAssignment` take a `boardName: string` parameter in place of the
  `definition: GauntletDefinition` argument (used only to compose the cap-warning
  string via `buildGauntletBoardName(definition)`). The caller now computes
  `buildGauntletBoardName(definition)` once and passes the string. This removes
  the new module's need to import the board-name builder or the `GauntletDefinition`
  type, and the emitted warning string is **byte-identical**.
- **Refactor** `getGauntletStandings` in `gauntlet.logic.ts` to consume the
  extracted module:
  - Replace the inlined per-replay qualification block (the `checkParPublished`
    gate, version compare, count guard, roster-size check, `matchesApprovedLoadout`
    call, and visibility loop) with: resolve `publishedScoringConfigVersion` from
    `leaderboardDeps.checkParPublished(replay.scenarioKey)`, build a
    `LegClearReplayFacts` from the replay accumulator (owner visibilities via a
    `for...of`, not `.reduce()`), and `if (!qualifiesAsLegClear(...)) continue;`.
  - Replace the `findBestPoolAssignment(rosterAccumulator, legSchemeSlugs,
    poolBudget, definition, playerCount)` call with the `boardName`-string form,
    passing `buildGauntletBoardName(definition)`.
  - Remove the now-moved definitions from `gauntlet.logic.ts`; add a **runtime**
    import of `{ qualifiesAsLegClear, findBestPoolAssignment }` and a **type-only**
    import of `{ RosterLegAccumulator, LegClearReplayFacts }` from
    `./gauntletTruth.logic.js`.
- **New test** `apps/server/src/legends/gauntletTruth.logic.test.ts` (`node:test`)
  unit-testing the extracted functions in isolation against seeded fixtures:
  - `qualifiesAsLegClear`: the all-pass case returns `true`; each clause rejects
    independently (null published version; version mismatch; non-integer / <1 />5
    count; roster size ≠ count; unapproved loadout; a hidden owner); and an
    `undefined` `approvedLoadouts` skips the loadout clause.
  - `matchesApprovedLoadout`: `undefined` loadouts → `true`; empty-for-count →
    `false`; null `henchmanKey` → `false`; exact villain-segment + henchman-key
    match → `true`; mismatch → `false`.
  - `findBestPoolAssignment`: a budget-valid assignment is found; an over-budget
    union returns `null`; the published `heroPool` is the union of the **chosen**
    teams (not the candidate subset); ties break to the lexicographically smallest
    joined pool; and more than `FIXED_POOL_TEAM_CAP` distinct teams truncates to
    the cap.

## Out of Scope

- **No DB query change.** The `getGauntletStandings` SQL (the DISTINCT-ON dedupe +
  ownership join) is untouched; the SQL-side clauses (a) `outcome='heroes-win'`,
  (b) `player_count IS NOT NULL`, (c) both-segments-same-set stay in the query,
  not the extracted predicate.
- **No behavior change of any kind.** No clause is added, removed, reordered in a
  way that changes the qualifying set, or re-weighted; no ranking, average, or
  pool-search result changes. Identical inputs → identical `getGauntletStandings`
  output. This is the load-bearing constraint.
- **No new endpoint, no `apps/server` HTTP route change, no persistence, no
  migration** — those are WP-4 (persistence) and WP-5 (import + run API).
- **No run-read.** The per-run derived read that *consumes* this helper is WP-5;
  this WP only extracts the helper.
- **No registry / game-engine / preplan / pg / boardgame.io import** in the new
  module — the layer lock. The predicate receives already-fetched facts and a
  plain `number | null`; it never resolves PAR or queries anything itself.
- **No client change** (`apps/arena-client`, `apps/legends-board`) and **no
  snapshot / publisher output change** — `legends.publisher.ts` and the R2
  artifacts are byte-identical because `getGauntletStandings`' output is
  unchanged.
- **No contract-file creation** (`.types.ts` / `.validate.ts` / `.gating.ts`);
  the new file is a `.logic.ts` helper, not a locked contract.

## Files Expected to Change

- `apps/server/src/legends/gauntletTruth.logic.ts` — **new** — the pure,
  data-injected truth helper: `qualifiesAsLegClear` + `LegClearReplayFacts`,
  `matchesApprovedLoadout`, `findBestPoolAssignment` + its four private helpers +
  `FIXED_POOL_TEAM_CAP`, and the moved-and-exported `RosterLegAccumulator`
  interface.
- `apps/server/src/legends/gauntlet.logic.ts` — **modified** — remove the moved
  definitions; add runtime + type-only imports from `./gauntletTruth.logic.js`;
  rewire `getGauntletStandings`' fold to call `qualifiesAsLegClear` and the
  `boardName`-string `findBestPoolAssignment`. No public export removed
  (`getGauntletStandings`, `buildGauntletCatalog`, the board-name builders,
  `GAUNTLET_PLAYER_COUNTS`, and the public types keep their identity).
- `apps/server/src/legends/gauntletTruth.logic.test.ts` — **new** — `node:test`
  unit tests for the extracted predicate, `matchesApprovedLoadout`, and
  `findBestPoolAssignment` against seeded row fixtures.

## Non-Negotiable Constraints

**Output contract for this session:**
- Full file contents for every new or modified file — **no diffs, no snippets, no
  "show only the changed section."**
- ESM only, Node v22+, human-style code per `docs/ai/REFERENCE/00.6-code-style.md`
  (full English names, small functions with JSDoc, explicit `for...of` control
  flow, `// why:` on non-self-evident decisions).

**Engine-wide (always apply):**
- No `Math.random()`, no wall-clock reads, no filesystem / network / environment
  access in the extracted logic — it is a pure deterministic derivation.
- No `.reduce()` in the extracted or rewired logic — preserve the existing `for` /
  `for...of` structure (the owner-visibility array in the rewired fold is built
  with an explicit `for...of`).

**Packet-specific:**
- **Behavior-preserving refactor:** the extracted logic and the rewired
  `getGauntletStandings` produce **identical** observable output; the existing
  `gauntlet.logic.test.ts` passes **unchanged** (no edit to that file is
  permitted as part of this WP — if it needs editing, behavior changed and the
  refactor is wrong).
- **Layer lock:** `gauntletTruth.logic.ts` imports **nothing** from `registry`,
  `game-engine`, `preplan`, `pg`, `boardgame.io`, or any `apps/*` package — only
  Node built-ins and **type-only** imports from sibling server-layer
  `./gauntlet.logic.js` (`GauntletApprovedLoadouts`, `GauntletApprovedLoadout`)
  and `./leaderboards`-free plain types it defines itself.
- **Single source of truth:** after this WP the leg-clear predicate and the pool
  search exist in **exactly one** module; no future WP (including WP-5) may
  re-inline or fork them. The tracker and the leaderboard derive from the same
  functions.
- **Pure + data-injected:** the extracted functions receive already-fetched rows /
  params (facts, budgets, board name, published version) and never perform I/O.

**Session protocol:** if any step appears to require changing observable behavior,
editing `gauntlet.logic.test.ts`, adding a DB query to the new module, or crossing
a layer boundary — **STOP and ask.** Do not improvise a behavior change.

**Locked contract values:** see `## Contract`.

## Contract

**Extracted module public surface (`gauntletTruth.logic.ts`):**

- `export interface LegClearReplayFacts { scenarioKey: string;
  scoringConfigVersion: number; playerCount: number; ownerVisibilities:
  readonly string[]; henchmanKey: string | null; }`
- `export function qualifiesAsLegClear(facts: LegClearReplayFacts,
  approvedLoadouts: GauntletApprovedLoadouts | undefined,
  publishedScoringConfigVersion: number | null): boolean`
- `export function matchesApprovedLoadout(approvedLoadouts:
  GauntletApprovedLoadouts | undefined, playerCount: number, scenarioKey: string,
  henchmanKey: string | null): boolean`
- `export function findBestPoolAssignment(rosterAccumulator: RosterLegAccumulator,
  legSchemeSlugs: readonly string[], poolBudget: number, boardName: string,
  playerCount: number): { totalScore: number; heroPool: string[] } | null`
- `export interface RosterLegAccumulator { players: readonly string[];
  bestScoreBySchemeSlug: Map<string, number>; bestScoreBySchemeAndTeamKey:
  Map<string, Map<string, number>>; }`
- `export const FIXED_POOL_TEAM_CAP = 12` (moved verbatim; re-exported so the new
  test can assert the truncation boundary).
- Private (not exported): `collectDistinctTeams`, `selectBoundedTeams`,
  `evaluatePoolUnion`, `pickBestTeamForLeg`.

**Locked values (do not re-derive):**

- `FIXED_POOL_TEAM_CAP = 12` — the D-24187 §5 fixed-division team cap, moved
  verbatim (not re-derived).
- **Qualification order in `qualifiesAsLegClear`** (identical to the source fold):
  1. `publishedScoringConfigVersion === null` → `false`;
  2. `facts.scoringConfigVersion !== publishedScoringConfigVersion` → `false`;
  3. `!Number.isInteger(facts.playerCount) || playerCount < 1 || playerCount > 5`
     → `false`;
  4. `facts.ownerVisibilities.length !== facts.playerCount` → `false`;
  5. `!matchesApprovedLoadout(approvedLoadouts, playerCount, scenarioKey,
     henchmanKey)` → `false`;
  6. any `visibility` not in `{ 'link', 'public' }` → `false`;
  7. otherwise `true`.
- **`matchesApprovedLoadout` semantics** (moved verbatim): `undefined` loadouts →
  `true`; empty-for-count → `false`; `null` `henchmanKey` → `false`; villain
  segment = `scenarioKey.split('::')[2] ?? ''` and it plus `henchmanKey` must
  exactly match one approved entry.
- **`findBestPoolAssignment` semantics** (moved verbatim): subset enumeration over
  the bounded teams, budget filter on the pool union, published `heroPool` = union
  of the **chosen** teams' heroes sorted ASC, ties → smallest joined pool.
- **Board-name warning string** emitted on cap truncation is byte-identical to the
  source (`selectBoundedTeams` now receives the precomputed `boardName` string).

**Correctness contract:** the extraction is **behavior-preserving**. The
authoritative proof is that `apps/server/src/legends/gauntlet.logic.test.ts`
passes **unchanged**; `gauntletTruth.logic.test.ts` additionally proves the
extracted functions in isolation.

## Acceptance Criteria

- [ ] `apps/server/src/legends/gauntletTruth.logic.ts` exists and exports
      `qualifiesAsLegClear`, `LegClearReplayFacts`, `matchesApprovedLoadout`,
      `findBestPoolAssignment`, `RosterLegAccumulator`, and `FIXED_POOL_TEAM_CAP`;
      its four pool helpers (`collectDistinctTeams`, `selectBoundedTeams`,
      `evaluatePoolUnion`, `pickBestTeamForLeg`) are module-private.
- [ ] `gauntletTruth.logic.ts` imports nothing from `registry`, `game-engine`,
      `preplan`, `pg`, `boardgame.io`, or any `apps/*` package: a grep for those
      import specifiers in the file returns **no match** (only Node built-ins and
      **type-only** imports from `./gauntlet.logic.js` are present).
- [ ] `gauntlet.logic.ts` no longer defines `matchesApprovedLoadout`,
      `findBestPoolAssignment`, `collectDistinctTeams`, `selectBoundedTeams`,
      `evaluatePoolUnion`, `pickBestTeamForLeg`, `FIXED_POOL_TEAM_CAP`, or the
      `RosterLegAccumulator` interface; it imports them (runtime for the two
      functions, type-only for the interface + `LegClearReplayFacts`) from
      `./gauntletTruth.logic.js`.
- [ ] `getGauntletStandings` keeps its exact public signature
      `(definition, database, leaderboardDeps)` and its return type
      `Promise<ReadonlyMap<number, GauntletStandingsForCount>>`; no public export
      of `gauntlet.logic.ts` is renamed or removed.
- [ ] `getGauntletStandings`' fold calls `qualifiesAsLegClear(...)` (with the
      published version resolved from `leaderboardDeps.checkParPublished`) and the
      `boardName`-string form of `findBestPoolAssignment`; the owner-visibility
      list feeding the predicate is built with an explicit `for...of` (no
      `.reduce()`).
- [ ] `apps/server/src/legends/gauntlet.logic.test.ts` passes **unchanged** (the
      file is not edited by this WP) — the behavior-preservation proof.
- [ ] `gauntletTruth.logic.test.ts` covers: `qualifiesAsLegClear` all-pass + each
      of the six reject clauses + `undefined`-loadouts skip; `matchesApprovedLoadout`
      undefined/empty/null-henchman/match/mismatch; `findBestPoolAssignment`
      budget-valid, over-budget→null, chosen-union pool, tie-break, and cap
      truncation.
- [ ] `pnpm --filter @legendary-arena/server test` passes (both the unchanged
      `gauntlet.logic.test.ts` and the new `gauntletTruth.logic.test.ts`); `pnpm
      -r build` exits 0.
- [ ] No file outside the `Files Expected to Change` list is modified — in
      particular `legends.publisher.ts`, `legends.scheduler.ts`, `server.mjs`, and
      the R2 snapshot artifacts are untouched.

## Verification Steps

```bash
pnpm -r build
# Expected: whole-repo build green; apps/server compiles with the new module and
# the rewired getGauntletStandings.

pnpm --filter @legendary-arena/server test
# Expected: all server tests pass — gauntlet.logic.test.ts UNCHANGED and green
# (behavior-preservation proof), plus the new gauntletTruth.logic.test.ts.

git -C . diff --name-only origin/main -- apps/server/src/legends/gauntlet.logic.test.ts
# Expected: NO output — the existing correctness gate file is not modified.

grep -nE "from '(pg|boardgame\.io|@legendary-arena/(registry|game-engine|preplan))'" apps/server/src/legends/gauntletTruth.logic.ts ; echo "exit=$?"
# Expected: no match (grep exit=1) — the new module holds the layer lock.

grep -nE "^(export )?function (findBestPoolAssignment|matchesApprovedLoadout|collectDistinctTeams|selectBoundedTeams|evaluatePoolUnion|pickBestTeamForLeg)" apps/server/src/legends/gauntlet.logic.ts ; echo "exit=$?"
# Expected: no match (grep exit=1) — the moved functions no longer live in gauntlet.logic.ts.
```

## Vision Alignment

**Vision clauses touched:** §20–26 (Scoring, PAR & leaderboards — gauntlet
standings are a competitive-leaderboard derivation), §22 (determinism /
replay-faithful scoring). No identity / monetization / RNG-sourcing / persistence
surface is touched; the standings remain a read-only aggregation over existing
`competitive_scores` rows.

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.* The
refactor is behavior-preserving — the same qualification clauses and the same
pool-assignment search produce the same standings; nothing about what qualifies,
how a leg clears, or how a champion is computed changes.

**Determinism preservation:** the extracted logic is a pure, deterministic
derivation over already-fetched rows — identical inputs yield identical output,
and the reordering of the extraction introduces no non-determinism (the
qualification-clause order is preserved and the pool search is unchanged). The
authoritative proof is that `gauntlet.logic.test.ts` passes **unchanged**.

**Non-Goal proximity check:** No proximity to NG-1..7. The refactor adds no
paid surface, no pay-to-win lever, no cosmetic or monetization affordance; it
moves internal server logic between files.

## Definition of Done

This packet is complete when ALL of the following are true:
- [ ] All Acceptance Criteria pass.
- [ ] `pnpm -r build` exits 0 and `pnpm --filter @legendary-arena/server test`
      passes, including the **unchanged** `gauntlet.logic.test.ts`.
- [ ] **D-24026 inverted (no user-observable change):** `docs/ai/STATUS.md` states
      "No user-observable change — infrastructure only" (a behavior-preserving
      server refactor); no live-surface verification is required because the
      surface is `none — infrastructure`.
- [ ] `docs/ai/STATUS.md` updated (names the gauntlet-truth extraction + the
      behavior-preservation guarantee).
- [ ] `docs/ai/DECISIONS.md` — **no entry** (this WP reserves no D-number; note in
      STATUS that the layer lock is inherited, not newly decided).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph moved `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-477 status → `Done`.
- [ ] No files outside the `Files Expected to Change` list were modified.

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE**

- **Authority chain read:** CLAUDE.md → ARCHITECTURE.md §Layer Boundary (Server
  layer; pure gauntlet logic imports no pg/registry/engine) →
  `.claude/rules/architecture.md` Import Rules + §Persistence Boundary →
  `.claude/rules/code-style.md` (no `.reduce()`, `// why:`, small functions) →
  this WP → EC-477. No conflict: a pure server-layer helper split from an existing
  pure server-layer file inherits the same import posture; no boundary is crossed.
- **Dependencies verified on `main` @ `ff812ae1`:** `gauntlet.logic.ts` exists
  with the named exports and inlined logic; `gauntlet.logic.test.ts` exercises
  only the public surface (does not import the internals being moved); a repo grep
  confirms `findBestPoolAssignment` / `matchesApprovedLoadout` /
  `RosterLegAccumulator` have no external consumers. No prerequisite WP is
  in-flight (WP-1/WP-2 shipped; WP-4/WP-5 depend on this, not the reverse).
- **Scope lock:** exactly three files, all under `apps/server/src/legends/`
  (2 new, 1 modified) + governance ledgers. Single layer (Server), single app. No
  contract file; no DB / migration / endpoint / persistence surface.
- **Validation-tightening check (Empirical Scaffold, `01.4`):** this WP **tightens
  no input path** and rejects no previously-accepted input — it moves existing
  qualification logic verbatim and rewires the caller. The qualifying set is
  provably unchanged (`gauntlet.logic.test.ts` unchanged-and-green is the gate).
  The scaffold-first empirical gate does not trigger; the correctness proof is the
  unchanged existing suite, not a reasoned "additive" claim.
- **Ambiguities:** none blocking. The one design call — how to decouple the pool
  search from `buildGauntletBoardName` without a runtime edge back into
  `gauntlet.logic.ts` — is resolved to **passing a precomputed `boardName: string`**
  into `selectBoundedTeams` / `findBestPoolAssignment` (the warning string stays
  byte-identical, and the only cross-module runtime edge is the one-directional
  `gauntlet.logic → gauntletTruth`). The second — whether the predicate takes the
  `LeaderboardDependencies` bundle or a resolved value — is resolved to a plain
  `number | null` published version (keeps the helper free of the leaderboard-deps
  type and maximally reusable by WP-5). Both recorded in the WP Contract + EC.

### Copilot Check (`01.7`) — verdict: **PASS**

Audited against the Top-30 lens; findings summarized:
- **Separation of concerns / layer boundaries — PASS.** Server layer only; the
  new module imports only Node built-ins + type-only sibling types; no pg /
  registry / engine / preplan / boardgame.io edge (grep-asserted). One-directional
  runtime edge `gauntlet.logic → gauntletTruth`; the reverse is type-only, so no
  import cycle.
- **Behavior preservation — PASS.** The load-bearing risk (a silent semantic
  drift during extraction) is fenced by the "`gauntlet.logic.test.ts` unchanged"
  gate and the byte-verbatim move discipline; the two signature changes are
  internal and preserve the emitted warning string.
- **Determinism — PASS.** Pure deterministic derivation; no RNG, time, or I/O; the
  qualification-clause order is preserved and the pool search is unchanged.
- **Immutability / mutation — PASS.** The extracted functions read the accumulator
  and return fresh results; no shared-state mutation introduced.
- **Type safety / contract integrity — PASS.** `LegClearReplayFacts` and
  `RosterLegAccumulator` are explicit; `GauntletApprovedLoadouts` reused type-only
  from the sibling; `getGauntletStandings`' public signature is unchanged.
- **Persistence / serialization — PASS.** No persistence, no snapshot output
  change; standings remain a read-only aggregation.
- **Testing / invariants — PASS.** The new suite is non-vacuous: it drives each
  reject clause independently and asserts the chosen-union pool + cap truncation,
  not just a happy path; the existing suite is the regression oracle.
- **Scope / governance — PASS.** Three-file, single-app refactor with explicit
  Out-of-Scope fences (no DB / endpoint / migration / client / snapshot / behavior
  change) and no contract-file creation.
- **Reuse / DRY — PASS.** The whole point: one shared helper consumed by both the
  leaderboard now and WP-5's run read later — eliminates the drift class.
- **Documentation / intent — PASS.** JSDoc on every export; `// why:` on the
  `FIXED_POOL_TEAM_CAP` constant, the `boardName` decoupling, and the
  clause-order preservation.

No RISK or BLOCK findings.

## Lint Gate Self-Review (`00.3`, all 21 sections)

- **§1 Structure** — PASS. All required sections present in order (Goal, Assumes,
  Context (Read First), Scope (In), Out of Scope, Files Expected to Change,
  Non-Negotiable Constraints, Acceptance Criteria, Verification Steps, Definition
  of Done), plus Contract, Vision Alignment, and the gate verdicts.
- **§2 Non-Negotiable Constraints** — PASS. Full-file-output + no-diffs, ESM /
  Node v22+, references `00.6-code-style.md`; engine-wide (no RNG/clock/IO, no
  `.reduce()`), packet-specific (behavior-preserving, layer lock, single source of
  truth), session protocol (STOP on behavior change), locked values.
- **§3 Prerequisites (`## Assumes`)** — PASS. Each assumption cites its source on
  `main` @ `ff812ae1`; the no-external-consumer fact is grep-verified.
- **§4 Context References** — PASS. Specific docs/sections + source files +
  DECISIONS ids + the approved plan section listed. Data shapes touched are the
  `MatchSetupConfig`-adjacent gauntlet types, all defined in the cited source
  file; no `00.2` field is renamed (§6).
- **§5 Output Completeness (`## Files Expected to Change`)** — PASS. Three files
  enumerated with new/modified + one-line each; matches the EC allowlist. No
  ambiguous "update this section" language.
- **§6 Naming Consistency** — PASS. `setAbbr`, `mastermindSlug`, `scenarioKey`,
  `playerCount`, `henchmanKey`, `scoringConfigVersion`, `heroPool` match the
  source contract exactly; no abbreviation invented (`facts` /
  `publishedScoringConfigVersion` are full words).
- **§7 Dependency Discipline** — PASS. No new npm dependency; no forbidden package
  (no ORM, no non-`pg` DB access — in fact no DB access at all in the new module).
- **§8 Architectural Boundaries** — PASS. Server layer; the new module holds the
  layer lock (no pg/registry/engine/preplan/boardgame.io — grep-asserted); `G`/`ctx`
  untouched; no DB query inside the extracted logic; no snapshot/persistence reach.
- **§9 Windows Compatibility** — PASS. No shell scripts authored; `pnpm` + `grep`
  verification only.
- **§10 Environment Variable Hygiene** — PASS. No env access (the helper reads
  in-memory facts); no secret in output.
- **§11 Authentication Clarity** — N/A. No auth surface; the refactor moves
  internal scoring-derivation logic and touches no credential or protected route.
- **§12 Test Quality** — PASS. `node:test` / `node:assert`, `.test.ts`, no
  `boardgame.io` import, no network/DB; the new suite is non-vacuous (each reject
  clause driven independently; chosen-union + cap truncation asserted).
- **§13 Commands & Verification** — PASS. Exact `pnpm` + `git diff --name-only` +
  `grep` commands with expected output (incl. the unchanged-test-file check and the
  layer-lock grep).
- **§14 Acceptance Criteria Quality** — PASS. Binary, observable checks naming real
  symbols, the unchanged-file gate, and the layer-lock grep.
- **§15 Definition of Done** — PASS, incl. §15.1: `User-Visible Surface` is
  `none — infrastructure`, so the DoD carries the **inverted D-24026** requirement
  (STATUS states "No user-observable change — infrastructure only") and no
  live-surface item. Server package build IS the typecheck (no separate `typecheck`
  line needed, per EC-TEMPLATE Rules). STATUS.md / WORK_INDEX.md / mindmap updates
  present; DECISIONS.md explicitly "no entry."
- **§16 Code Style** — PASS. Small pure functions with JSDoc, explicit `for...of`
  (no `.reduce()`), `// why:` on `FIXED_POOL_TEAM_CAP` / the `boardName` decoupling
  / the clause-order preservation, named exports, no `import *`.
- **§17 Vision Alignment** — PASS. `## Vision Alignment` present; §20–26 + §22
  cited; "No conflict"; determinism-preservation line present (behavior-preserving,
  proven by the unchanged suite); NG proximity checked (none).
- **§18 Prose-vs-Grep Discipline** — PASS. The count-bounded grep gates
  (`grep exit=1` for pg/boardgame.io/registry/engine import specifiers, and for the
  moved `function` declarations) are scoped to import-specifier and
  `function`-declaration patterns (`from '(pg|...)'`, `^(export )?function`), which
  source prose cannot match; the WP/EC prose that names the moved function symbols
  never sits inside `gauntletTruth.logic.ts` in a form matching those anchored
  patterns.
- **§19 Bridge-vs-HEAD Staleness** — N/A. No bridge / state-snapshot artifact
  authored; the baseline SHA `ff812ae1` is recorded in `## Assumes`.
- **§20 Funding Surface Gate** — N/A. No funding surface: no global-nav,
  donate/tournament-funding copy, or funding channel — the WP moves internal server
  logic between files.
- **§21 API Catalog Update** — N/A. No `apps/server` HTTP endpoint is added,
  modified, or removed, and `getGauntletStandings` is **not** a catalogued
  `Library-only` function (a grep of `docs/ai/REFERENCE/api-endpoints.md` for
  "gauntlet" / "getGauntletStandings" returns no row); its signature is unchanged
  regardless. `api-endpoints.md` is untouched.

All 21 sections resolved (PASS or justified N/A). Lint gate satisfied.
