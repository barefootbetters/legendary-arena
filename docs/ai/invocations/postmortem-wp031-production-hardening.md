# Post-Mortem — WP-031 Production Hardening & Engine Invariants

> **Step 4 of the WP execution workflow** per
> `docs/ai/REFERENCE/01.6-post-mortem-checklist.md`.
>
> Runs after EC-031 acceptance criteria pass, before pre-commit review
> (step 5). Captures the architectural / safety / longevity audit that
> tests alone cannot prove. Same session as execution.

---

## 0. Metadata

- **Work Packet:** WP-031
- **Title:** Production Hardening & Engine Invariants
- **Execution Date:** 2026-04-15
- **EC Used:** [EC-031-production-hardening.checklist.md](../execution-checklists/EC-031-production-hardening.checklist.md)
- **Pre-Flight Date:** 2026-04-15 (with mid-execution PS-3 re-run on the same day)
- **Test Baseline:** 348 tests / 93 suites → **358 tests / 94 suites / 0 failures**
- **WP Class:** Runtime Wiring (01.5 IS INVOKED; setup-only wiring per D-3102)
- **Mid-execution amendments:** A-031-01 / A-031-02 / A-031-03 + new D-3103

---

## 1. Binary Health Check (Absolute)

Active verification (this session):

- [x] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [x] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [x] Correct number of new tests added (locked at +10 — delivered exactly 10
      `test(...)` calls inside one `describe('runtime invariants (WP-031)')`
      block in `invariants.test.ts`)
- [x] No existing test files modified — `git diff --name-only` against
      `packages/game-engine/src/**/*.test.ts` returns empty
- [x] No scope expansion occurred during execution (mid-execution
      amendment narrowed one check function and widened two parameter
      types; **no files added or removed** beyond the locked allowlist)
- [x] EC-031 acceptance criteria all pass (Multi-Zone Card Check
      retargeted to "non-fungible" per amendment A-031-01)

**Verdict:** PASS — proceed with post-mortem.

---

## 2. Scope & Allowlist Audit

### git diff --name-only (modified, this session)

```
.claude/settings.local.json                                              <- pre-existing, not touched
docs/ai/DECISIONS.md                                                     <- D-3103 added
docs/ai/STATUS.md                                                        <- WP-031 entry prepended
docs/ai/work-packets/WORK_INDEX.md                                       <- WP-031 checked off
docs/ai/work-packets/WP-031-production-hardening-engine-invariants.md    <- §Amendments appended
packages/game-engine/src/game.ts                                         <- 01.5 wiring (1 import + 4-line wrap)
packages/game-engine/src/index.ts                                        <- 01.5 additive export block
packages/game-engine/src/types.ts                                        <- 01.5 additive re-export block
```

### git status --porcelain (untracked, this session)

```
?? docs/ai/invocations/copilot-wp031-production-hardening.md             <- session-prompt artifact + Re-Run 2026-04-15
?? docs/ai/invocations/preflight-wp031-production-hardening.md           <- session-prompt artifact + RS-9/10/11 + PS-3
?? docs/ai/invocations/session-wp031-production-hardening.md             <- session-prompt artifact (unchanged)
?? docs/ai/invocations/postmortem-wp031-production-hardening.md          <- THIS DOC
?? packages/game-engine/src/invariants/                                  <- 8 new files
?? docs/ai/session-context/session-context-wp029.md                      <- pre-existing, not touched
?? docs/legendary-arena-license-letter.{docx,md}                         <- pre-existing, not touched
?? docs/legendary-arena-one-pager.{docx,md}                              <- pre-existing, not touched
?? docs/upper-deck-licensing-contacts.md                                 <- pre-existing, not touched
```

### Allowlist conformance

- [x] Only files listed in the WP allowlist were modified (game.ts /
      types.ts / index.ts under 01.5; STATUS.md / WORK_INDEX.md /
      DECISIONS.md per WP §Definition of Done; new files all in
      `src/invariants/`)
- [x] No contract files modified — `LegendaryGameState`,
      `MatchSetupConfig`, `CardExtId`, `CityZone`, `HqZone`,
      `MATCH_PHASES`, `TURN_STAGES`, `ENDGAME_CONDITIONS`,
      `REVEALED_CARD_TYPES`, `BOARD_KEYWORDS`, `SCHEME_SETUP_TYPES`,
      `PERSISTENCE_CLASSES`, `RULE_TRIGGER_NAMES`, `RULE_EFFECT_TYPES`,
      `CORE_MOVE_NAMES` all untouched
- [x] No "while I'm here" refactors slipped in
- [x] No formatting-only or cleanup-only edits (game.ts diff is exactly
      1 import + 1 four-line block; types.ts diff is exactly 1 re-export
      block; index.ts diff is exactly 1 export block at end of file)
- [x] No new files created outside the WP scope (8 new files all under
      `src/invariants/`)
- [x] WP §Amendments edits (A-031-01/02/03), pre-flight RS-9/10/11/PS-3,
      and copilot Re-Run 2026-04-15 are user-authorized mid-session
      audit-trail edits, not silent scope expansion. They are documented
      in this post-mortem and in the session prompt summary.
- [x] Pre-existing untracked files (license letter, one-pager,
      contacts, session-context-wp029, settings.local.json) are NOT
      staged. Will use explicit `git add <file>` per WP commit
      convention.

**Verdict:** PASS.

---

## 3. Boundary Integrity Check (Critical)

### Framework Boundaries

Active grep (this session):

```bash
git grep --untracked -n "from ['\"]boardgame\.io" -- "packages/game-engine/src/invariants/"
# → empty
```

- [x] No `boardgame.io` imports anywhere in `src/invariants/` — confirmed
      by grep above
- [x] No framework `Ctx` leaking into pure helpers — `runAllChecks.ts`
      uses the local `InvariantCheckContext` interface declared in
      `invariants.types.ts` per pre-flight RS-2 / D-2801 precedent
- [x] No lifecycle coupling beyond what 01.5 explicitly authorized
      (single setup-return wrap in `game.ts`; no per-move wrapping;
      no `onBegin` / `onEnd` / `endIf` integration; no `turnLoop.ts`
      modification — all per D-3102 Option B)

### Registry / IO Boundaries

Active grep (this session):

```bash
git grep --untracked -n "@legendary-arena/registry" -- "packages/game-engine/src/invariants/"
# → empty
git grep --untracked -n "fs|node:fs|http|node:http|process\.env" -- "packages/game-engine/src/invariants/"
# → empty
git grep --untracked -n "require(" -- "packages/game-engine/src/invariants/"
# → empty
```

- [x] No registry imports anywhere in `src/invariants/`
- [x] No filesystem, network, persistence, or environment access
- [x] No CommonJS `require()` calls

### Code Category Compliance

- [x] `src/invariants/` directory classified as engine code category
      via D-3101 (pre-session, follows D-2706 / D-2801 / D-3001
      precedent)
- [x] Files in `src/invariants/`:
  - `invariants.types.ts` — data-only types and one canonical const ✓
  - `assertInvariant.ts` — pure assertion utility ✓
  - `*.checks.ts` (4 files) — pure read-only check functions ✓
  - `runAllChecks.ts` — pure orchestrator (calls + sequences checks) ✓
  - `invariants.test.ts` — pure unit tests ✓
- [x] No setup-time builders, no execution-stage logic, no UI code
- [x] No type-only file contains runtime functions (`invariants.types.ts`
      has only types + one `INVARIANT_CATEGORIES` const)

**Verdict:** PASS.

---

## 4. Representation & Determinism Audit

### Data-only representations

- [x] `InvariantCategory` is a closed string union of 5 literals
- [x] `INVARIANT_CATEGORIES` is a `readonly InvariantCategory[]` const
      array — JSON-serializable, no functions
- [x] `InvariantViolation` interface contains only `category` (string),
      `message` (string), `context?: Record<string, unknown>` — all
      JSON-compatible
- [x] `InvariantCheckContext` interface contains only optional
      `phase?: string` and `turn?: number` — both JSON-compatible
- [x] `InvariantViolationError` is a `class extends Error` — but it is
      ONLY thrown, never stored in `G`. No `G` field references this
      type. The class instances live in the JS exception path, which
      is not subject to the JSON-serializability invariant.

### Determinism

Active grep (this session):

```bash
git grep --untracked -n "Math\.random" -- "packages/game-engine/src/invariants/"
# → empty
git grep --untracked -n "^let " -- "packages/game-engine/src/invariants/"
# → empty (no module-level mutable state)
```

- [x] No module-level `let` accumulators, caches, memoization, or
      mutable singletons in `src/invariants/`
- [x] One module-level `const`: `FUNGIBLE_TOKEN_EXT_IDS` in
      `gameRules.checks.ts` — a frozen `ReadonlySet<CardExtId>` built
      from the six setup-layer constants (post-mortem fix below
      replaced inline literals with imports). Constant data, no
      accumulation.
- [x] All 6 affected check functions iterate `Object.keys(record).sort()`
      with a `// why:` comment ("deterministic error reproducibility —
      fail-fast must identify the same offending key on every run")
- [x] `JSON.stringify` is deterministic for JSON-valid inputs (per
      ECMAScript spec) — used in `checkGIsSerializable` and
      `checkSerializationRoundtrip`
- [x] `isStructurallyEqual` recursive helper sorts keys before
      comparison so deep-equal results are identical across runs

### Safe failure modes

- [x] `checkValidPhase` short-circuits on `undefined` phase (mock
      contexts) — no throw, no warn
- [x] `checkTurnCounterMonotonic` short-circuits when either argument
      is `undefined` — no throw
- [x] `checkCountersUseConstants` accepts any non-empty string key
      (per RS-4 narrowing) — does not enforce strict
      `ENDGAME_CONDITIONS` membership, so future custom counter keys
      do not false-positive
- [x] `checkNoCardInMultipleZones` skips fungible tokens entirely
      and skips intra-zone duplicates (deferred to a future check)
- [x] All other check functions either pass silently or throw
      `InvariantViolationError`. The throw path is contained to
      `Game.setup()` per D-3102, which is the one engine-wide
      throw-allowed call site.

**Verdict:** PASS.

---

## 5. Mutation, Aliasing, & Reference Safety (High-Risk)

This is the WP-028 precedent risk area. Reviewed deliberately.

### Direct G mutation in non-test files

Active grep (this session):

```bash
git grep --untracked -nE "^\s*G\." -- "packages/game-engine/src/invariants/" \
  ":(exclude)*.test.ts"
# → packages/game-engine/src/invariants/structural.checks.ts:29:    G.city.length === 5,
```

The single hit is `G.city.length === 5` inside an `assertInvariant`
condition expression — a **read**, not a write. All other G access
sites are nested inside `Object.keys(G.playerZones)`,
`G.piles.bystanders.length`, `G.counters[counterKey]`, etc., which
are also reads.

```bash
git grep --untracked -nE "G\.[a-zA-Z_.]+\.(push|splice|pop|shift|unshift|sort|reverse|fill|copyWithin)\(" \
  -- "packages/game-engine/src/invariants/" ":(exclude)*.test.ts"
# → empty
```

No mutating Array methods invoked on any `G.*` field in non-test
files.

- [x] All mutation occurs only in authorized lifecycle contexts (i.e.,
      none in invariants/ — checks are observation-only)
- [x] No helpers mutate `G` or `ctx`
- [x] No mutation during rendering, projection, or evaluation (there
      is no projection — all check functions return `void`)
- [x] Pure helpers are actually pure (confirmed by grep + line-by-line
      inspection of every check function)

### Aliasing (returned object references)

Active grep:

```bash
git grep --untracked -n "^export function" -- "packages/game-engine/src/invariants/"
```

All 14 exported functions in `src/invariants/` (excluding tests):

| File | Function | Return type |
|---|---|---|
| `assertInvariant.ts` | `assertInvariant` | `void` |
| `structural.checks.ts` | `checkCitySize` | `void` |
| `structural.checks.ts` | `checkZoneArrayTypes` | `void` |
| `structural.checks.ts` | `checkCountersAreFinite` | `void` |
| `structural.checks.ts` | `checkGIsSerializable` | `void` |
| `gameRules.checks.ts` | `checkNoCardInMultipleZones` | `void` |
| `gameRules.checks.ts` | `checkZoneCountsNonNegative` | `void` |
| `gameRules.checks.ts` | `checkCountersUseConstants` | `void` |
| `determinism.checks.ts` | `checkNoFunctionsInG` | `void` |
| `determinism.checks.ts` | `checkSerializationRoundtrip` | `void` |
| `lifecycle.checks.ts` | `checkValidPhase` | `void` |
| `lifecycle.checks.ts` | `checkValidStage` | `void` |
| `lifecycle.checks.ts` | `checkTurnCounterMonotonic` | `void` |
| `runAllChecks.ts` | `runAllInvariantChecks` | `void` |

**Every exported function returns `void`.** No projection, no derived
data, no array/object reference handed back to a caller. The WP-028
aliasing-bug class (return reference shared with mutable `G` field) is
**structurally impossible** in WP-031 because nothing is returned.

- [x] No aliasing bugs possible in the WP-031 surface area
- [x] Internal helpers (`scanZone`, `visitCardId`, `assertNonNegativeArray`,
      `hasFunction`, `isStructurallyEqual`) are also `void`-returning
      or boolean-returning (primitives, not aliasable)
- [x] The local `firstSeenZone: Record<CardExtId, string>` Map in
      `checkNoCardInMultipleZones` is built from string keys (CardExtIds)
      and string values (zone names). Strings are immutable in JS —
      no aliasing possible.

### game.ts wiring aliasing

The setup-return wrap captures `initialState = buildInitialGameState(...)`
and passes it to `runAllInvariantChecks(initialState, ...)` then returns
`initialState`. Same `G` object flows through both calls. No new
reference, no copy, no aliasing. The second argument
`{ phase: context.ctx.phase, turn: context.ctx.turn }` is a fresh
object literal — not aliased to anything.

- [x] Wiring site introduces zero aliasing risk

**Verdict:** PASS. WP-028 precedent does not apply — invariant
checks have no return surface area to alias through.

---

## 6. Hidden-Coupling Detection

### Engine internals exposed?

The new `index.ts` export block exposes 14 functions, 1 const, 4
types. Each is intended public API for future WPs that may want to:

- Call individual checks directly (e.g., a follow-up WP that wires
  `checkNoCardInMultipleZones` into a per-move position)
- Catch `InvariantViolationError` and inspect `category` for
  post-mortem tooling
- Iterate `INVARIANT_CATEGORIES` for diagnostics or UI

This is **intentional** per the WP §Scope and the extension-seam
documentation in pre-flight §Maintainability.

- [x] No engine internals exposed unintentionally
- [x] No private state or non-exported helpers leaked

### Union widening?

- [x] `InvariantCategory` is a closed 5-value union — locked by
      `INVARIANT_CATEGORIES` drift-detection (Test 1)
- [x] `InvariantViolation`, `InvariantCheckContext` interfaces are
      additive — fields are optional and no current consumer requires
      them, so future widening is safe

### Implicit knowledge of upstream details — POST-MORTEM FINDING

**Original implementation (pre-fix):** `gameRules.checks.ts` hardcoded
the six fungible token strings inline:

```ts
const FUNGIBLE_TOKEN_EXT_IDS: ReadonlySet<CardExtId> = new Set<CardExtId>([
  'starting-shield-agent',
  'starting-shield-trooper',
  'pile-bystander',
  'pile-wound',
  'pile-shield-officer',
  'pile-sidekick',
]);
```

**Risk:** Drift coupling. If a future setup-layer refactor renames
any of the six constants in `buildInitialGameState.ts` /
`pilesInit.ts` (e.g., for a per-instance unique-ID refactor that
supersedes D-3103), the inline literals here would NOT follow
automatically. The check would silently scan the renamed strings as
non-fungible, false-positive on every valid G, and break the
348-test baseline at that future point.

**Mitigation in original code:** `// why:` comment cited D-3103 and
called the values "stable engine constants". This was passive
mitigation.

**Why the original code chose inline literals:** speed-of-typing
during execution, plus a misreading of D-3103's "no runtime dependency
on the setup layer's exports" clause as "do not import from setup/".
The actual D-3103 clause says "the values are stable" — it does not
forbid imports.

**WP-031 §Amendments A-031-01 item 1** (which I authored mid-
execution) explicitly preferred the import form: *"use the existing
`src/setup/buildInitialGameState.js` and `src/setup/pilesInit.js`
re-exports — these are data-only constants with no runtime or side
effects."* The implementation deviated from the amendment's
preferred form.

**Fix applied during post-mortem (this section):** Replaced inline
literals with named imports. `gameRules.checks.ts` now imports
`SHIELD_AGENT_EXT_ID`, `SHIELD_TROOPER_EXT_ID`, `BYSTANDER_EXT_ID`,
`WOUND_EXT_ID`, `SHIELD_OFFICER_EXT_ID`, `SIDEKICK_EXT_ID` from
`../setup/buildInitialGameState.js` (which already re-exports the
pile constants from `pilesInit.ts`). The `Set` is built from those
imported names, so a future rename of any constant follows
automatically through the type system. The `// why:` comment block
was updated to cite this post-mortem and the WP-031 amendment's
preferred form.

**Re-verified after fix:** build green, 358/94/0 tests still
passing. No test changes. No other file changes.

- [x] After the fix, no implicit knowledge of upstream implementation
      details remains in the WP-031 surface

### Ordering assumptions

- [x] `runAllInvariantChecks` runs checks in fixed category order
      (structural → gameRules → determinism → lifecycle); the order
      is documented in the orchestrator's `// why:` comment
- [x] Within `checkNoCardInMultipleZones`, the zone scan order is
      fixed and documented in WP §Amendments A-031-01 item 3 + the
      function's body comments
- [x] `Object.keys(...).sort()` sites pin iteration order of every
      `Record<string, …>` scan that may throw on a specific key —
      documented at each site

### Internal module state dependency

- [x] No dependency on non-exported functions or internal module state
      from any other engine package
- [x] The post-mortem fix introduces a new dependency from
      `src/invariants/gameRules.checks.ts` → `src/setup/buildInitialGameState.ts`.
      This is a downward, same-layer dependency (engine package,
      data-only constants). Setup does not import from invariants,
      so no circular dependency. Verified by re-running build.

**Verdict:** PASS after post-mortem fix. The original implementation
had one hidden-coupling risk; the fix eliminates it.

---

## 7. Test Adequacy Review

### Boundary enforcement

- [x] Tests fail if architectural boundaries are violated:
  - **Test 1** asserts `INVARIANT_CATEGORIES` matches the
    `InvariantCategory` union exactly (drift-detection contract test)
  - **Test 2** asserts cross-zone duplication of a non-fungible
    CardExtId throws with `category === 'gameRules'`
  - **Test 3** asserts function-in-G throws with `category === 'determinism'`
  - **Test 4** asserts non-finite counter value throws with
    `category === 'structural'`
  - **Test 5** asserts invalid phase string throws with
    `category === 'lifecycle'` AND directly exercises
    `checkTurnCounterMonotonic` (which is exported but not called by
    the orchestrator)
  - **Test 7** asserts `assertInvariant(false, ...)` throws with the
    correct error type, category, and full-sentence message

### Determinism explicitly tested

- [x] **Test 1** + **Test 8** exercise `checkSerializationRoundtrip`
      on a freshly-built valid G — this is the determinism happy path
- [x] The deterministic-iteration sort is exercised indirectly by
      Tests 2/3/4: each test creates a single-violation G, and the
      check runs with sorted iteration order. The fact that Tests
      2/3/4 produce reproducible failures across runs is implicit
      evidence that the sort works. (Explicit "two runs of
      runAllInvariantChecks on the same broken G produce identical
      error messages" is NOT tested — see Notes for follow-up.)

### Serialization tested

- [x] Tests 1 + 8 verify that a valid G survives the
      `checkGIsSerializable` (structural) and
      `checkSerializationRoundtrip` (determinism) checks

### Non-mutation tested

- [ ] **GAP** — There is no test that explicitly captures
      `JSON.stringify(G)` before `runAllInvariantChecks(G)` and asserts
      structural equality after. The implementation is pure by
      inspection (Section 5 grep + line-by-line audit confirmed zero
      mutations on G in non-test files), but no test exists to lock
      the purity contract.
      **Why this is non-blocking:** Section 5's active grep audit
      (`G.foo = ...`, `G.foo.push(...)`, etc.) returned zero hits in
      all non-test files. All 14 exported functions return `void`.
      Aliasing is structurally impossible. Adding a non-mutation test
      would be a meaningful belt-and-suspenders defense against
      future refactors but is not required to prove WP-031 correctness.
      **Logged as follow-up in Notes.**

### Other test adequacy items

- [x] Tests do NOT depend on unrelated engine behavior:
      - Test 9 mutates `G.turnEconomy.attackPoints` and `G.cardStats[id]`
        and `G.city[0]` — these are stable fields on `LegendaryGameState`
        per WP-018 and WP-015
      - Test 10 mutates `G.piles.wounds` — stable per WP-005B
      - Test 1's drift assertion depends only on `INVARIANT_CATEGORIES`
        and the literal array, both owned by this WP
- [x] No tests weakened to "make things pass":
      - Tests 9 and 10 carry explicit "Contract enforcement test per
        WP-028 precedent — do not weaken" `// why:` comments
      - The test file does not contain any `assert.ok(true)` or
        equivalent silent-skip patterns
      - The locked test count of +10 was preserved exactly, and the
        locked baseline transition (348/93 → 358/94) was met without
        weakening any existing test (no existing test file was
        modified)

**Verdict:** PASS with one non-blocking gap (no explicit non-mutation
test). Logged as follow-up.

---

## 8. Documentation & Governance Updates

### DECISIONS.md

- [x] **D-3101** — `src/invariants/` classified as engine code
      category (pre-session, follows D-2706 / D-2801 / D-3001
      precedent). Verified at `docs/ai/DECISIONS.md:3090`.
- [x] **D-3102** — Setup-only wiring scope (Option B). Per-move wiring
      deferred. Verified at `docs/ai/DECISIONS.md:3134`.
- [x] **D-3103** — Card uniqueness invariant scope (fungible token
      exclusion). Mid-execution, user-authorized. Verified at
      `docs/ai/DECISIONS.md:3205`. Includes rationale, three considered
      options, the trade-off acknowledgement (what the amended check
      does NOT detect), and the forward-compatibility path.

### ARCHITECTURE.md — NON-BLOCKING GAP

`docs/ai/ARCHITECTURE.md §"MVP Gameplay Invariants"` (lines 1134+)
documents the invariants WP-031 formalizes (zone exclusivity, JSON
serializability, determinism, etc.) but does NOT mention
`runAllInvariantChecks`, `assertInvariant`, `InvariantCategory`, or
`src/invariants/` by name.

Active grep:

```bash
grep -n "runAllInvariantChecks\|src/invariants/\|InvariantCategory" docs/ai/ARCHITECTURE.md
# → empty
```

This matches the WP-028 precedent (the post-mortem flagged
ARCHITECTURE.md as not mentioning `UIState` / `buildUIState` by name
and treated it as a non-blocking gap addressable in a future
ARCHITECTURE.md refresh). Same disposition here: the principle is
correctly stated; the implementation is documented in STATUS.md and
DECISIONS.md; the file-by-file mention can wait for a future refresh.

- [x] ARCHITECTURE.md state principles still hold (no contradiction)
- [ ] ARCHITECTURE.md does not name WP-031 artifacts — **non-blocking
      gap**, follow-up in Notes

### STATUS.md

- [x] WP-031 entry prepended above WP-030 at `docs/ai/STATUS.md:10`
- [x] Documents the 8 new files, the 11 check functions, the 5
      categories, the 01.5 invocation, the mid-execution amendment,
      D-3101/D-3102/D-3103, the architectural significance of D-0001
      and D-0102 implementation, and what's-true-now / what's-next

### WORK_INDEX.md

- [x] WP-031 line at `docs/ai/work-packets/WORK_INDEX.md:644` updated
      from `[ ]` to `[x] … ✅ Reviewed ✅ Completed 2026-04-15`
- [x] Notes block summarizes the 5 categories, the test count, the
      01.5 invocation, the mid-execution amendment (A-031-01/02/03 +
      D-3103), and the three new decisions

### Audit trail (untracked)

- [x] `preflight-wp031-production-hardening.md` — RS-9 / RS-10 / RS-11
      + PS-3 + Pre-Flight Verdict re-confirmation
- [x] `copilot-wp031-production-hardening.md` — Re-Run 2026-04-15
      with Findings #31 / #32 / #33 + CONFIRM disposition
- [x] `postmortem-wp031-production-hardening.md` — this document

**Verdict:** PASS with one non-blocking gap (ARCHITECTURE.md naming).

---

## 9. Forward-Safety Questions

### Q1. Can this code survive future refactors without touching unrelated layers?

**YES.** Future WPs that add a new field to `LegendaryGameState` do
not need to touch any check function unless that field is a new zone
of `CardExtId` strings. In that case, the new zone needs to be added
to `checkNoCardInMultipleZones` and `checkZoneCountsNonNegative` and
exactly nothing else. This is a known, documented extension point.

The post-mortem fix to `gameRules.checks.ts` (Section 6) eliminates
the previous coupling risk to setup-layer constant names — the Set
now follows automatically through the import.

### Q2. Can replay/debugging reconstruct behavior from stored data?

**YES.** `InvariantViolationError` carries:

- A typed `category: InvariantCategory` for programmatic classification
- A `message: string` that is a full sentence per Rule 11 (states
  what failed and what to inspect)
- The standard `Error.stack` trace pointing at the offending check
  function

Post-mortem inspection of a thrown error reconstructs the failure
without logs. The orchestrator's fail-fast ordering means the first
thrown category is always the most-structural failure.

### Q3. Would removing upstream data still fail safely?

**YES.** The check functions don't query the registry, so registry
data removal does not affect them. They read `G` fields via type
imports; if a field is removed from `LegendaryGameState`, the check
fails to compile (caught at build time, not runtime). The
`checkValidPhase` and `checkTurnCounterMonotonic` functions explicitly
short-circuit on `undefined` lifecycle context fields — a missing
mock-context field is silently ignored, never throws.

### Q4. Is it impossible for this WP's output to influence gameplay unintentionally?

**YES.** All 14 exported functions return `void`. They do not produce
projections, derived state, or anything a gameplay code path could
consume. The only behavior-affecting path is the throw from
`assertInvariant`, which is **the intended design** of fail-fast
invariant enforcement — not unintentional influence. The throw is
contained to `Game.setup()` per D-3102, which is the one engine-wide
call site permitted to throw per `.claude/rules/game-engine.md
§Throwing Convention`.

### Q5. Is the contract stable enough to be referenced by future WPs?

**YES.** Specifically:

- `InvariantCategory` is a closed 5-value union, drift-protected by
  `INVARIANT_CATEGORIES` and Test 1 (the WP-031 test, not a future
  one — drift is mechanically caught)
- `assertInvariant(condition, category, message): void` is a stable
  signature locked by EC-031 and the WP §Locked contract values
- `runAllInvariantChecks(G, invariantContext): void` uses the local
  `InvariantCheckContext` interface, which is widening-compatible
  (future WPs may add optional fields without breaking existing
  callers)
- `InvariantViolationError` is a class with a stable shape (`name`,
  `message`, `category`, `stack`) — no future widening planned
- The 11 individual check functions are exported by name from
  `index.ts` so future WPs can call them à la carte if needed
- The follow-up WP that adds per-move wiring will introduce its own
  decision (a new throwing-convention exception) and consume this
  WP's exports without modification

**Verdict:** All YES. Forward-safety PASS.

---

## 10. Final Post-Mortem Verdict

- [x] **WP COMPLETE** — execution is correct, safe, and durable
- [ ] WP INCOMPLETE — unresolved issues listed below

### Notes / Follow-ups (non-blocking)

```
1. ARCHITECTURE.md does not name `runAllInvariantChecks`,
   `assertInvariant`, `InvariantCategory`, or `src/invariants/` by
   name. The principles in §"MVP Gameplay Invariants" still hold
   correctly. Same disposition as the WP-028 post-mortem
   precedent: log as a non-blocking gap addressable in a future
   ARCHITECTURE.md refresh. Recommended addition: a new
   §"Runtime Invariant Checks" subsection that names the orchestrator,
   the five categories, and the D-3102 setup-only wiring decision.

2. No explicit non-mutation test exists for `runAllInvariantChecks`.
   Section 5's active grep + line-by-line audit confirmed zero
   mutations on G in non-test files (all 14 exported functions return
   void, no `G.foo = ...` assignments, no mutating Array methods on
   G.foo, no aliased return references possible). The purity contract
   is structurally enforced, not test-enforced. A future WP could add
   a single test that captures `JSON.stringify(G)` before and after
   `runAllInvariantChecks(G, SETUP_CONTEXT)` and asserts strict
   equality — this would be a belt-and-suspenders defense matching
   the WP-028 precedent's recommendation. Logged for a future test-
   adequacy WP. Not blocking because the WP-028 aliasing-bug class
   is structurally impossible here (void returns).

3. No explicit deterministic-error-message test exists. The
   `Object.keys(...).sort()` pattern is in place at every required
   site, and Tests 2/3/4 produce reproducible failures across runs,
   but no test asserts that two runs of `runAllInvariantChecks` on
   the same deliberately-broken G produce byte-identical error
   messages. A future WP could add this as a property test. Not
   blocking — the sort discipline is locked by the `// why:` comment
   convention and would be caught by code review on any future
   change.

4. The `'security'` invariant category slot is reserved in the union
   and the canonical `INVARIANT_CATEGORIES` array but no check
   functions are implemented for it (deferred per WP-031 §Out of
   Scope). A follow-up WP fills the slot without refactoring the
   orchestrator. Documented in `runAllChecks.ts` `// why:` comment.

5. `checkTurnCounterMonotonic` is exported from `index.ts` but is
   NOT called by `runAllInvariantChecks` (no previous-turn reference
   at setup time per D-3102). It is a pure helper reserved for a
   future per-turn wiring follow-up WP. Test 5 exercises it directly.
   Documented in `runAllChecks.ts` `// why:` comment.

6. WP-031 §G text back-sync flagged in pre-flight RS-2 / P6-8 still
   pending: WP-031 §G says
   `runAllInvariantChecks(G: LegendaryGameState, ctx: Ctx): void`
   but the shipped signature is
   `runAllInvariantChecks(G: LegendaryGameState, invariantContext: InvariantCheckContext): void`.
   This is a one-line WP-text edit for the pre-commit reviewer
   (step 5) to apply, not a code issue. Logged here for visibility.
```

### Fixes applied during post-mortem

```
1. Section 6 — Hidden-coupling fix in
   packages/game-engine/src/invariants/gameRules.checks.ts:

   Replaced inline string literals for the six fungible token
   CardExtIds with named imports from
   '../setup/buildInitialGameState.js' (which already re-exports
   the pile constants from pilesInit.ts):

   - SHIELD_AGENT_EXT_ID
   - SHIELD_TROOPER_EXT_ID
   - BYSTANDER_EXT_ID
   - WOUND_EXT_ID
   - SHIELD_OFFICER_EXT_ID
   - SIDEKICK_EXT_ID

   The `FUNGIBLE_TOKEN_EXT_IDS` ReadonlySet is now built from these
   imported names. If a future setup-layer refactor renames any
   constant, the Set follows automatically through the type system.
   Updated the `// why:` comment block to cite this post-mortem fix
   and the WP-031 §Amendments A-031-01 item 1 preferred form
   ("use the existing src/setup/buildInitialGameState.js and
   src/setup/pilesInit.js re-exports").

   Re-verified: build exits 0, tests still 358/94/0. No test
   change required, no behavioral change — the imported values
   are byte-identical to the inline literals at this moment in
   time. The fix is purely a coupling reduction.
```

---

## Closing

Post-mortem complete. WP-031 is **safe and durable** in addition to
being correct (per EC-031). All 10 sections passed with one
non-blocking ARCHITECTURE.md naming gap and three test-adequacy
follow-up notes that are structurally enforced rather than test-
enforced. One coupling fix was applied during this post-mortem and
re-verified.

**Authorized next step (per workflow):** step 5 (pre-commit review)
in a separate session. The pre-commit reviewer should apply the
WP-031 §G one-line back-sync (Note 6) before the commit lands.

**Files touched by this post-mortem:**

- `packages/game-engine/src/invariants/gameRules.checks.ts` —
  Section 6 hidden-coupling fix (inline literals → named imports)
- `docs/ai/invocations/postmortem-wp031-production-hardening.md` —
  this document (new, untracked)

No other file modified.
