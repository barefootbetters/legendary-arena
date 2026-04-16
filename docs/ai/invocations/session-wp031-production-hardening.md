# Session Execution Prompt — WP-031 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session
> and paste this prompt to execute. Do not execute in the session that
> generated this prompt.

---

## Session Identity

**Work Packet:** WP-031 — Production Hardening & Engine Invariants
**Mode:** Implementation (WP-031 not yet implemented)
**Pre-Flight:** Complete (2026-04-15) — build green (348 tests, 93 suites,
0 fail), all dependencies met. PS-1 resolved: [D-3101](docs/ai/DECISIONS.md:3090)
created classifying `src/invariants/` as engine code category. PS-2
resolved: [D-3102](docs/ai/DECISIONS.md:3134) locked Option B (setup-only
wiring; per-move wiring deferred to a follow-up WP). Copilot check
(step 1b) CONFIRM: two scope-neutral FIXes applied in place to pre-flight
(canonical `INVARIANT_CATEGORIES` array + deterministic `Object.keys(...).sort()`
iteration). Pre-flight refinements RS-2 (local `InvariantCheckContext`
interface, NOT `boardgame.io` `Ctx`), RS-4 (`checkCountersUseConstants`
narrowed), RS-5 (throwing-convention exception covered by existing
`Game.setup() may throw` row), RS-7 (serialization-check distinction)
all locked.
**EC:** [docs/ai/execution-checklists/EC-031-production-hardening.checklist.md](docs/ai/execution-checklists/EC-031-production-hardening.checklist.md)
**WP:** [docs/ai/work-packets/WP-031-production-hardening-engine-invariants.md](docs/ai/work-packets/WP-031-production-hardening-engine-invariants.md)
**Pre-flight:** [docs/ai/invocations/preflight-wp031-production-hardening.md](docs/ai/invocations/preflight-wp031-production-hardening.md)
**Copilot check:** [docs/ai/invocations/copilot-wp031-production-hardening.md](docs/ai/invocations/copilot-wp031-production-hardening.md)

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- Test count: 348 → **358** (10 new invariant tests, 0 existing test changes)
- All WP-031 acceptance criteria satisfied
- All post-mortem checks pass
- Any deviation: **STOP and report failure**

---

## Runtime Wiring Allowance — IS INVOKED

**[docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md)
IS invoked by this session prompt.**

WP-031 introduces new runtime-visible structure by wiring
`runAllInvariantChecks` into `Game.setup()` return path. Per 01.5
§When to Include, this triggers the allowance because the WP:

- Adds runtime wiring to `game.ts` (structural runtime integration)
- Expands the public API surface of `types.ts` and `index.ts` with
  new re-exports and exports

Per 01.5 §Runtime Wiring Allowance (Explicit), minimal wiring edits to
the following files are permitted **solely to restore type and
assertion correctness**:

- `packages/game-engine/src/game.ts` — import `runAllInvariantChecks`
  and `INVARIANT_CATEGORIES` (if needed for construction), capture the
  `buildInitialGameState` return value into a local variable, call
  `runAllInvariantChecks(initialState, { phase: context.ctx.phase, turn: context.ctx.turn })`,
  and return the variable. No other edit to `game.ts`.
- `packages/game-engine/src/types.ts` — add re-export block for
  `InvariantCategory`, `InvariantViolation`, `InvariantCheckContext`
  (type exports) and `INVARIANT_CATEGORIES` (const export). Purely
  additive. No modification to `interface LegendaryGameState`.
- `packages/game-engine/src/index.ts` — add export block for
  `assertInvariant`, `InvariantViolationError`,
  `runAllInvariantChecks`, all 12 individual check functions,
  `InvariantCategory`, `InvariantViolation`, `InvariantCheckContext`,
  `INVARIANT_CATEGORIES`. Purely additive, added at the end of the
  file after the existing export block.

**No existing tests are expected to require modification.** Per the
01.5 Reporting Requirement, if any existing test fails because of the
setup-path invariant wiring, **STOP and escalate** — do not weaken
the invariant, do not modify the existing test to bypass checks, do
not use 01.5 to "fix" the test. Diagnose root cause first.

Per 01.5 §Prohibited Modifications:
- No new behavior beyond wiring (no logic, no branching, no new
  helpers, no new test cases in existing files)
- No modification to the behavioral contract of `game.ts` beyond the
  setup-return wrap
- No touching files unrelated to the structural change
- No introduction of new conditional logic inside any test

Per 01.5 §Escalation: *"It may not be cited retroactively in execution
summaries or pre-commit reviews to justify undeclared changes."* If an
unanticipated structural break appears mid-execution, the agent must
stop and escalate, not force-fit.

Any file modified outside the WP-031 allowlist under this clause must
be explicitly called out in the execution summary and pre-commit
review (Runtime Boundary Check) with: (a) which file, (b) why the
modification was required, (c) what structural change was applied,
(d) explicit statement confirming no new gameplay or runtime behavior
was introduced.

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `.claude/rules/game-engine.md` — §Throwing Convention (important for
   RS-5 locked decision), §Game State — G, §Registry Boundary
3. `docs/ai/ARCHITECTURE.md` — specifically:
   - §"MVP Gameplay Invariants" (line 1134) — this is the source of the
     invariants WP-031 formalizes as runtime checks
   - §Section 3 "The Three Data Classes" — persistence classification
     (WP-031 adds zero new fields to G)
   - §Section 4 "Why G Must Never Be Persisted"
   - §"Layer Boundary (Authoritative)" — invariant checks are
     engine-layer only
4. `docs/ai/execution-checklists/EC-031-production-hardening.checklist.md`
5. `docs/ai/work-packets/WP-031-production-hardening-engine-invariants.md`
6. `docs/ai/invocations/preflight-wp031-production-hardening.md` — read
   §Dependency Contract Verification, §Scope Lock, §Test Expectations,
   and §Risk & Ambiguity Review (RS-1 through RS-8 are locked for
   execution)
7. `docs/ai/invocations/copilot-wp031-production-hardening.md` — read
   §Applied In-Place Fixes
8. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` — already
   invoked above; read §Allowed Modifications and §Prohibited
   Modifications
9. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()`), 11 (full-sentence
   error messages), 13 (ESM only)
10. `docs/ai/DECISIONS.md` — read [D-0001](docs/ai/DECISIONS.md:21)
    (Correctness Over Convenience), [D-0002](docs/ai/DECISIONS.md:29)
    (Determinism Is Non-Negotiable),
    [D-0102](docs/ai/DECISIONS.md:55) (Fail Fast on Invariant
    Violations — including the clarification distinguishing invariant
    violations from gameplay conditions),
    [D-2706](docs/ai/DECISIONS.md:2861) / [D-2801](docs/ai/DECISIONS.md:2874) /
    [D-3001](docs/ai/DECISIONS.md:2981) (directory classification
    precedents), [D-3101](docs/ai/DECISIONS.md:3090) (invariants
    directory classification), [D-3102](docs/ai/DECISIONS.md:3134)
    (setup-only wiring decision)

**Implementation anchors (read before coding):**

11. `packages/game-engine/src/types.ts` — read `LegendaryGameState`
    (lines 250-377). Invariant checks read these fields by name. **Do
    not** add any new field.
12. `packages/game-engine/src/state/zones.types.ts` — read `CardExtId`,
    `PlayerZones`, `GlobalPiles`
13. `packages/game-engine/src/board/city.types.ts` — read `CityZone`
    (fixed 5-tuple at line 29). `checkCitySize` asserts `G.city.length === 5`.
14. `packages/game-engine/src/endgame/endgame.types.ts` — read
    `ENDGAME_CONDITIONS` (3 keys at line 36-40)
15. `packages/game-engine/src/turn/turnPhases.types.ts` — read
    `MATCH_PHASES` (4 entries at line 20) and `TURN_STAGES` (3 entries
    at line 31). `checkValidPhase` and `checkValidStage` compare
    against these canonical arrays.
16. `packages/game-engine/src/game.ts` — read the `setup()` function
    (lines 123-158). Wiring inserts between `buildInitialGameState`
    return and the function return.
17. `packages/game-engine/src/test/mockCtx.ts` — read `makeMockCtx`.
    Tests use this for G construction (via `buildInitialGameState`).
    Tests do NOT modify this file.
18. `packages/game-engine/src/index.ts` — read current exports. New
    exports are added at the end of the file.

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and copilot check.
They are **locked for execution**. Do not revisit them, do not propose
alternatives, do not re-debate.

### 1. `InvariantCheckContext` — local structural interface (RS-2)

`runAllInvariantChecks` does **NOT** use `boardgame.io` `Ctx`. It uses
a local structural interface defined in `invariants.types.ts`:

```ts
/**
 * Local subset of framework context fields read by lifecycle
 * invariant checks. Defined here to avoid importing boardgame.io
 * into pure helper files. Populated from the real Ctx at the
 * wiring site in game.ts.
 *
 * Mark fields readonly and do not widen beyond what lifecycle checks
 * actually read. Follows WP-028 UIBuildContext precedent (D-2801).
 */
export interface InvariantCheckContext {
  readonly phase?: string;
  readonly turn?: number;
}
```

The signature of `runAllInvariantChecks` is:

```ts
export function runAllInvariantChecks(
  G: LegendaryGameState,
  invariantContext: InvariantCheckContext,
): void
```

Rationale: importing `Ctx` from `boardgame.io` into any file under
`src/invariants/` would violate EC-031 verification step 3 and
D-3101's "no boardgame.io imports" clause. The local interface is
populated from the real ctx at the wiring site in `game.ts` (which
is already a framework-boundary file).

**Back-sync note:** WP-031 §G line ~196 currently says
`runAllInvariantChecks(G: LegendaryGameState, ctx: Ctx): void`. The
implementation must use the `InvariantCheckContext` shape. The WP
text back-sync (one-line edit of §G) is a post-execution task
flagged by the pre-commit review or post-mortem per P6-8.

### 2. `InvariantViolationError` — companion type class (locked)

`assertInvariant.ts` exports a concrete error class:

```ts
/**
 * Error thrown by assertInvariant when a check condition fails.
 *
 * // why: invariant violations must fail fast (D-0102) — unmet
 * gameplay conditions use move return void instead. This error
 * carries the category so post-mortem inspection can classify the
 * failure without reading the message.
 */
export class InvariantViolationError extends Error {
  readonly category: InvariantCategory;

  constructor(category: InvariantCategory, message: string) {
    super(message);
    this.name = 'InvariantViolationError';
    this.category = category;
  }
}
```

The class is authorized as a companion type — it is a natural
consequence of the locked `assertInvariant` signature (must throw a
concrete, classifiable error). Do not invent an alternative error
shape.

### 3. Canonical `INVARIANT_CATEGORIES` array (copilot FIX #4)

`invariants.types.ts` exports a canonical readonly array immediately
below the `InvariantCategory` union:

```ts
/**
 * The five non-overlapping invariant categories.
 *
 * // why: five categories prevent classification ambiguity. The
 * canonical array must match the InvariantCategory union exactly —
 * adding a category requires updating BOTH the union and this array.
 * Drift-detection is enforced by Test 1.
 */
export const INVARIANT_CATEGORIES: readonly InvariantCategory[] = [
  'structural',
  'gameRules',
  'determinism',
  'security',
  'lifecycle',
] as const;
```

Order must match the union exactly. This follows the canonical-array
precedent established by `MATCH_PHASES`, `TURN_STAGES`,
`REVEALED_CARD_TYPES`, `BOARD_KEYWORDS`, `SCHEME_SETUP_TYPES`,
`PERSISTENCE_CLASSES`, `RULE_TRIGGER_NAMES`, `RULE_EFFECT_TYPES`,
`CORE_MOVE_NAMES`. Re-export from `types.ts` (const, not type) and
`index.ts`.

### 4. Deterministic iteration order (copilot FIX #23)

Every check function that scans a `Record<string, …>` and may throw
on a specific key MUST iterate via `Object.keys(record).sort()` (or
equivalent explicit sort) before applying check logic. Each sort
site requires a `// why:` comment: "deterministic error
reproducibility — fail-fast must identify the same offending key on
every run".

Affected functions: `checkZoneArrayTypes`, `checkCountersAreFinite`,
`checkCountersUseConstants`, `checkNoCardInMultipleZones`,
`checkZoneCountsNonNegative`, `checkNoFunctionsInG`.

Rationale: `runAllInvariantChecks` fails fast on the first violation.
Non-deterministic `Object.keys()` order could make the error message
identify a different offending key on different runs against the
same broken `G`, breaking the "deterministic reconstructability"
requirement from ARCHITECTURE.md §Debuggability & Diagnostics.

### 5. `checkCountersUseConstants` narrowing (RS-4)

This check does NOT enforce strict `ENDGAME_CONDITIONS` membership.
Runtime hooks may legitimately introduce scheme-specific or
mastermind-specific counter keys beyond the canonical three. Strict
membership would false-positive on valid state.

Locked semantics:
- Every key in `G.counters` is a non-empty string
- Every value in `G.counters` is a finite number (redundant with
  `checkCountersAreFinite` — both checks independently assert this)

Add a `// why:` comment: "Strict ENDGAME_CONDITIONS membership is
deferred until the canonical custom-key list is written (future WP).
Current check asserts shape only; `checkCountersAreFinite` asserts
value validity." (References WP-023 safe-skip precedent, D-2302.)

### 6. `checkGIsSerializable` vs `checkSerializationRoundtrip` distinction (RS-7)

These checks are distinct and non-overlapping:

- **`checkGIsSerializable` (structural):** asserts that
  `JSON.stringify(G)` does not throw. Detects circular references,
  BigInts, and other JSON-incompatible values. Uses:
  ```ts
  assertInvariant(
    (() => { try { JSON.stringify(G); return true; } catch { return false; } })(),
    'structural',
    'G must be JSON-serializable at all times — JSON.stringify threw during structural invariant check. Inspect G for circular references, BigInts, Symbols, or other JSON-incompatible values.',
  );
  ```
  Add `// why:` comment: "structural: operation succeeds — roundtrip
  identity is determinism's concern".

- **`checkSerializationRoundtrip` (determinism):** asserts that
  `JSON.parse(JSON.stringify(G))` produces a **structurally equal**
  object to `G`. Detects lossy serialization (e.g., `undefined`
  values silently dropped). Uses Node's `node:assert`
  `deepStrictEqual` inside a try/catch:
  ```ts
  let identityPreserved = false;
  try {
    const serialized = JSON.stringify(G);
    const parsed = JSON.parse(serialized) as LegendaryGameState;
    // why: deepStrictEqual throws on mismatch; catching converts
    // the throw into a boolean for assertInvariant's contract.
    assertDeepEqual(parsed, G);
    identityPreserved = true;
  } catch {
    identityPreserved = false;
  }
  assertInvariant(
    identityPreserved,
    'determinism',
    'G serialization roundtrip must preserve structural identity — JSON.parse(JSON.stringify(G)) produced an object that does not deep-equal G. Inspect G for undefined values, NaN, or non-enumerable properties.',
  );
  ```
  Add `// why:` comment: "determinism: roundtrip is identity-preserving —
  lossy serialization would break replay reproducibility".

Do not fold them into a single check. They catch different failure
modes and belong to different categories.

### 7. Lifecycle wiring scope — Option B (D-3102 / PS-2)

`runAllInvariantChecks` is wired at **exactly one** point in the
engine runtime: the return path of `Game.setup()` in `game.ts`.

- **No per-move wiring.** Do not wrap entries in `LegendaryGame.moves`.
- **No phase-hook wiring.** Do not call invariant checks from
  `onBegin`, `onEnd`, or `endIf`.
- **No turn-boundary wiring.** Do not call invariant checks from
  `turnLoop.ts` or any `ctx.events.endTurn()` site.
- **No test-gate or env-gate wiring.** Do not read `process.env`
  or any module-level flag to conditionally enable checks.

The single wiring site eliminates timing ambiguity and preserves
the 348-test baseline. Per-move wiring is deferred to a follow-up
WP per D-3102.

### 8. Throwing convention — existing `Game.setup()` exception applies (RS-5)

`assertInvariant` throws `InvariantViolationError`. Under the Option
B wiring scope, the only call site is `Game.setup()` return path,
which is **already** allowed to throw per
`.claude/rules/game-engine.md §Throwing Convention` row 1
("`Game.setup()` — Throws Error — Match creation must abort early").

No new rule exception is introduced by WP-031. Do not propose
modifications to `.claude/rules/game-engine.md`. Do not propose
adding an "invariant violations in moves may throw" exception — that
is the follow-up WP's concern, not WP-031's.

### 9. Runtime registry access — forbidden in invariants (reinforced)

Invariant files never query the registry. They read only from `G`,
imported constants (`ENDGAME_CONDITIONS`, `MATCH_PHASES`,
`TURN_STAGES`, `INVARIANT_CATEGORIES`), and the type definitions in
`src/types.ts`, `src/state/zones.types.ts`,
`src/board/city.types.ts`, `src/endgame/endgame.types.ts`,
`src/turn/turnPhases.types.ts`.

### 10. Test 1 is a combined contract test (copilot FIX #4)

Test 1 is re-scoped from "Valid G passes all invariant checks" to
"Canonical `INVARIANT_CATEGORIES` array matches `InvariantCategory`
union AND valid G passes all invariant checks". The drift-detection
assertion runs first as a `assert.deepStrictEqual`:

```ts
assert.deepStrictEqual(
  INVARIANT_CATEGORIES,
  ['structural', 'gameRules', 'determinism', 'security', 'lifecycle'],
);
```

Then the check-runner call. Test count stays at **10**. Do not split
into a separate 11th test.

### 11. Gameplay conditions are silent no-ops (tests 9 and 10)

Tests 9 and 10 are **contract enforcement tests** per the WP-028
precedent. If they fail, the invariant definition is wrong and the
check function must be corrected — do NOT weaken the tests.

- **Test 9:** A valid `G` with `G.turnEconomy.attackPoints = 0` and
  a villain in `G.city[0]` with positive `fightCost`. Call
  `runAllInvariantChecks(G, { phase: 'play', turn: 1 })`. Assert
  **no throw**. The gameplay condition (insufficient attack) is a
  normal game state, not an invariant violation.
- **Test 10:** A valid `G` with `G.piles.wounds = []` (empty wounds
  pile). Call `runAllInvariantChecks(G, { phase: 'play', turn: 1 })`.
  Assert **no throw**. The empty pile is a normal game state.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any `import ... from 'boardgame.io'` in any file under
  `packages/game-engine/src/invariants/`
- Any `import ... from '@legendary-arena/registry'` in any file under
  `packages/game-engine/src/invariants/`
- Any `import type { Ctx } from 'boardgame.io'` in any invariant file
- Any `.reduce()` in any check function or test
- Any `Math.random()` in any new file
- Any `require()` in any new file
- Any `process.env` read in any new file
- Any IO, network, filesystem, or environment access
- Any mutation of `G` inside any check function
- Any modification to `LegendaryGameState` or any existing contract
  type (`MatchSetupConfig`, `CardExtId`, `PlayerZones`, `CityZone`,
  `HqZone`, `ENDGAME_CONDITIONS`, `MATCH_PHASES`, `TURN_STAGES`, etc.)
- Any new phase, stage, move, trigger, effect type, counter key, or
  card type
- Any modification to any file under `src/moves/`, `src/rules/`,
  `src/setup/`, `src/state/`, `src/turn/`, `src/board/`, `src/hero/`,
  `src/economy/`, `src/villainDeck/`, `src/scheme/`,
  `src/mastermind/`, `src/ui/`, `src/replay/`, `src/scoring/`,
  `src/endgame/`, `src/persistence/`, `src/lobby/`, `src/campaign/`
- Any modification to `game.ts` beyond the single 4-line setup-return
  wrap (capture into `initialState`, call
  `runAllInvariantChecks`, return `initialState`, plus the import line)
- Any wrapping of entries in `LegendaryGame.moves`
- Any modification to `makeMockCtx` or other shared test helpers
- Any modification to any existing test file
- Any test count change other than +10 (348 → 358)
- Any expansion of `CoreMoveName` / `CORE_MOVE_NAMES`
- Any new rule exception added to `.claude/rules/game-engine.md`
- Any "while I'm here" improvements, refactors, or cleanups
- Any file modified outside the Scope Lock allowlist (including the
  6 pre-existing untracked files — `session-context-wp029.md`,
  license/one-pager docs, `.claude/settings.local.json`)
- Any retroactive invocation of 01.5 to justify edits beyond the
  enumerated Allowance list above

---

## AI Agent Warning (Strict)

WP-031 is a **runtime hardening** work packet. Its purpose is to
enforce invariants that prior WPs documented but never checked at
runtime. The temptation to "helpfully" extend invariant coverage,
add new check categories, optimize performance, or wire checks into
more lifecycle points **must be resisted**.

**The one throwing exception:** `assertInvariant` throws
`InvariantViolationError` on violation. This is **intentional** and
is the ONE exception to "moves never throw" outside `Game.setup()`.
Under Option B wiring (setup-only), the only call site IS inside
`Game.setup()`, so the throwing-convention table (`.claude/rules/game-engine.md
§Throwing Convention` row 1) **already permits** it. No new
exception is introduced.

**The critical distinction — invariant vs gameplay:**

| Condition | Handling | Why |
|---|---|---|
| Card appears in two zones | `assertInvariant` throws | Structural corruption — D-0102 |
| Insufficient attack for fightVillain | Move returns void | Gameplay condition — D-0102 clarification |
| `G.city.length !== 5` | `assertInvariant` throws | Structural corruption |
| Empty wounds pile, player gains wound | Move returns void | Gameplay condition |
| Function stored in `G.counters` | `assertInvariant` throws | Determinism corruption |
| No valid target for a move | Move returns void | Gameplay condition |
| `G.currentStage === 'invalid'` | `assertInvariant` throws | Lifecycle corruption |
| `G.counters.escapedVillains === 0` (game not yet won/lost) | Neither — normal state | Not an invariant |

If you cannot confidently classify a check as one of the two
columns, **STOP and escalate**. Do not guess.

**Do NOT:**
- Touch any existing check in the codebase (there are none yet)
- Add new invariant check functions beyond those listed in §Implementation Tasks
- Add a 5th category's check functions (Security/Visibility is
  deferred — the category slot exists in the union, but no check
  file is created by WP-031)
- Wire `runAllInvariantChecks` into any site other than `game.ts`
  setup return
- Modify `buildInitialGameState` (it is already correct — invariant
  checks observe its output)
- Touch `makeMockCtx`
- Add `// why:` comments that restate the code (comments explain
  WHY, not WHAT)

**Instead:**
- Write one check function per invariant, each doing exactly one thing
- Use `Object.keys(record).sort()` for every Record scan that may
  throw on a key
- Use full-sentence error messages per Rule 11 (what failed, where,
  what to inspect)
- Pass literal category strings to `assertInvariant` (TypeScript
  narrows them into `InvariantCategory`)
- Use `for...of` for all iteration

---

## Implementation Tasks (Authoritative)

All new files are under `packages/game-engine/src/invariants/`.
None may import `boardgame.io`. None may import
`@legendary-arena/registry`. None may use `.reduce()`. None may use
`Math.random()`. None may perform I/O.

### A) Create `packages/game-engine/src/invariants/invariants.types.ts` (new)

**Imports (type-only, engine-internal):**

```ts
import type { MatchPhase } from '../turn/turnPhases.types.js';
```

**Exports:**

```ts
/**
 * Runtime invariant contracts for the Legendary Arena game engine.
 *
 * Invariants are checked at runtime against G at strategic lifecycle
 * points (currently: after Game.setup() returns). Violations throw
 * InvariantViolationError and abort match creation immediately.
 *
 * // why: five non-overlapping categories prevent classification
 * ambiguity. Each check belongs to exactly one category. Adding a new
 * category requires updating both the union and INVARIANT_CATEGORIES.
 *
 * // why: invariant violations (structural corruption) are distinct
 * from unmet gameplay conditions (insufficient attack, empty pile).
 * Violations fail fast per D-0102; gameplay conditions return void
 * per the move contract.
 */

/** The five non-overlapping invariant categories. */
export type InvariantCategory =
  | 'structural'
  | 'gameRules'
  | 'determinism'
  | 'security'
  | 'lifecycle';

/**
 * The five invariant categories in canonical order.
 *
 * // why: drift-detection between the union and the runtime array.
 * Test 1 asserts this array matches the union exactly. Adding a new
 * category requires updating BOTH — this is the same pattern used
 * by MATCH_PHASES, TURN_STAGES, REVEALED_CARD_TYPES, BOARD_KEYWORDS,
 * SCHEME_SETUP_TYPES, PERSISTENCE_CLASSES, RULE_TRIGGER_NAMES, and
 * RULE_EFFECT_TYPES.
 */
export const INVARIANT_CATEGORIES: readonly InvariantCategory[] = [
  'structural',
  'gameRules',
  'determinism',
  'security',
  'lifecycle',
] as const;

/**
 * Structured violation descriptor, used by assertInvariant error
 * construction.
 */
export interface InvariantViolation {
  category: InvariantCategory;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Local subset of framework context fields read by lifecycle
 * invariant checks. Defined here to avoid importing boardgame.io
 * into pure helper files. Populated from the real Ctx at the wiring
 * site in game.ts.
 *
 * // why: mark fields readonly and do not widen beyond what
 * lifecycle checks actually read. Follows WP-028 UIBuildContext
 * precedent (D-2801). Fields are optional because at some lifecycle
 * points (e.g., setup time before phase transition) they may be
 * unavailable.
 */
export interface InvariantCheckContext {
  readonly phase?: string;
  readonly turn?: number;
}
```

No runtime code, no functions, no classes. Types + one const only.

---

### B) Create `packages/game-engine/src/invariants/assertInvariant.ts` (new)

**Imports:**

```ts
import type { InvariantCategory } from './invariants.types.js';
```

**Exports:**

```ts
/**
 * Error thrown by assertInvariant when a check condition fails.
 *
 * // why: invariant violations must fail fast (D-0102). Gameplay
 * conditions (insufficient attack, empty pile, no valid target)
 * are NOT violations — they are normal game states handled by
 * moves returning void. Only structural corruption throws.
 *
 * // why: the category field lets post-mortem inspection classify
 * the failure without string-parsing the message.
 */
export class InvariantViolationError extends Error {
  readonly category: InvariantCategory;

  constructor(category: InvariantCategory, message: string) {
    super(message);
    this.name = 'InvariantViolationError';
    this.category = category;
  }
}

/**
 * Asserts that a runtime invariant condition holds. Throws
 * InvariantViolationError if the condition is false.
 *
 * // why: throwing at the setup return path is permitted by the
 * existing Game.setup() throw-allowed exception in
 * .claude/rules/game-engine.md §Throwing Convention. Moves never
 * throw (D-0102); only setup throws, and runAllInvariantChecks is
 * called from setup.
 *
 * @param condition - The condition to assert. False triggers a throw.
 * @param category - The invariant category the violation belongs to.
 * @param message - Full-sentence error message per Rule 11: state
 *   what failed and what to inspect.
 * @throws {InvariantViolationError} if condition is false.
 */
export function assertInvariant(
  condition: boolean,
  category: InvariantCategory,
  message: string,
): void {
  if (!condition) {
    throw new InvariantViolationError(category, message);
  }
}
```

---

### C) Create `packages/game-engine/src/invariants/structural.checks.ts` (new)

**Imports:**

```ts
import type { LegendaryGameState } from '../types.js';
import { assertInvariant } from './assertInvariant.js';
```

**Exports (four pure check functions):**

Each function receives `G: LegendaryGameState` and returns `void` or
throws via `assertInvariant`.

1. **`checkCitySize(G)`** — asserts `G.city.length === 5`. Full-sentence
   error: "The City zone must contain exactly 5 spaces (tuple shape
   enforced by CityZone type). Current length: ${G.city.length}. Inspect
   buildInitialGameState and any code that modifies G.city."

2. **`checkZoneArrayTypes(G)`** — asserts that every field in every
   entry of `G.playerZones` is an array. Iterate
   `Object.keys(G.playerZones).sort()` with a `// why:` comment:
   "deterministic error reproducibility — fail-fast must identify
   the same offending player on every run". For each player, check
   that `deck`, `hand`, `discard`, `inPlay`, `victoryPile` are all
   arrays. Full-sentence error per failing zone: "Player ${playerId}'s
   ${zoneName} must be an array of CardExtId strings. Found:
   ${typeof zone}. Inspect PlayerZones construction in
   buildInitialGameState."

3. **`checkCountersAreFinite(G)`** — iterate
   `Object.keys(G.counters).sort()` with the same `// why:` comment.
   For each key, assert `Number.isFinite(G.counters[key])`.
   Full-sentence error: "Counter '${key}' must be a finite number
   (int or float, not NaN, Infinity, or -Infinity). Found: ${value}.
   Inspect any modifyCounter effect that sets this counter."

4. **`checkGIsSerializable(G)`** — wrap `JSON.stringify(G)` in
   try/catch; call `assertInvariant` with the success boolean. See §
   Pre-Flight Locked Decisions item 6 for the exact code pattern and
   `// why:` comment.

No `.reduce()`. Use `for...of` for iteration. Each check function has
a `// why:` comment on its one-line description explaining what it
prevents.

---

### D) Create `packages/game-engine/src/invariants/gameRules.checks.ts` (new)

**Imports:**

```ts
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { assertInvariant } from './assertInvariant.js';
```

**Exports (three pure check functions):**

1. **`checkNoCardInMultipleZones(G)`** — build a `Set<CardExtId>` as
   you iterate. For each player (via `Object.keys(G.playerZones).sort()`),
   iterate zones in canonical order (`deck`, `hand`, `discard`,
   `inPlay`, `victoryPile`) and for each `CardExtId` in each zone,
   assert via `assertInvariant` that the Set does not already contain
   it, then add it. Also scan `G.city` (skip nulls), `G.hq` (skip
   nulls), `G.ko`, `G.villainDeck.deck`, `G.villainDeck.discard`,
   `G.piles.bystanders`, `G.piles.wounds`, `G.piles.officers`,
   `G.piles.sidekicks`, `G.mastermind.tacticsDeck`,
   `G.mastermind.tacticsDefeated`. Note: `attachedBystanders` values
   contain CardExtIds that ARE simultaneously in City — these are
   attached, not duplicated. **Exclude `attachedBystanders` from the
   duplicate scan.** Full-sentence error: "CardExtId '${cardId}'
   appears in more than one zone simultaneously (first seen in
   ${firstLocation}, also found in ${secondLocation}). This is a
   game rules invariant violation — each card must exist in exactly
   one zone at a time. Inspect any move that moved this card for a
   missing zoneOps.removeFromZone call."

   **Add `// why:` comment on the `attachedBystanders` exclusion:**
   "bystanders attached to a villain are simultaneously in the City
   (via the villain's space) and in attachedBystanders (via the
   attached relationship). This is not a duplicate — it is the
   attachment model from D-1703."

2. **`checkZoneCountsNonNegative(G)`** — for each player zone (via
   sorted `Object.keys`) and for `G.city`, `G.hq`, `G.ko`, each
   `G.piles.*`, `G.villainDeck.deck`, `G.villainDeck.discard`,
   `G.mastermind.tacticsDeck`, `G.mastermind.tacticsDefeated`, assert
   `array.length >= 0`. (Arrays can't have negative length in
   JavaScript, but this check guards against someone assigning a
   non-array or `undefined` via type bypass.) Full-sentence error:
   "Zone or pile must be an array with length >= 0. Found:
   ${String(value)} (type: ${typeof value}). Inspect any assignment
   to this zone/pile for type corruption."

3. **`checkCountersUseConstants(G)`** — per RS-4 narrowing, iterate
   `Object.keys(G.counters).sort()` and assert each key is a
   non-empty string. Full-sentence error: "Counter key must be a
   non-empty string (canonical ENDGAME_CONDITIONS or documented
   custom key per rule hook). Found: '${key}'. Inspect any
   modifyCounter effect that created this counter." Add the `// why:`
   comment documenting that strict `ENDGAME_CONDITIONS` membership
   is deferred per RS-4 / future WP.

No `.reduce()`. Use `for...of`.

---

### E) Create `packages/game-engine/src/invariants/determinism.checks.ts` (new)

**Imports:**

```ts
import type { LegendaryGameState } from '../types.js';
import { assertInvariant } from './assertInvariant.js';
import { deepStrictEqual } from 'node:assert/strict';
```

Wait — `node:assert/strict` in production engine code is unusual.
Use a local deep-equal helper instead to avoid dragging `node:assert`
into runtime engine code. Replace import with:

```ts
import type { LegendaryGameState } from '../types.js';
import { assertInvariant } from './assertInvariant.js';
```

And implement a minimal local deep-equal helper inside the file:

```ts
/**
 * Minimal structural equality check for JSON-serialized values.
 *
 * // why: used only by checkSerializationRoundtrip to detect lossy
 * serialization (undefined values, NaN, etc.). Not a general-purpose
 * deep-equal — it assumes both inputs came from JSON.parse and only
 * contain plain objects, arrays, strings, numbers, booleans, and
 * null. Works by recursive key-by-key comparison.
 */
function isStructurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      if (!isStructurallyEqual(a[index], b[index])) return false;
    }
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>).sort();
    const keysB = Object.keys(b as Record<string, unknown>).sort();
    if (keysA.length !== keysB.length) return false;
    for (let index = 0; index < keysA.length; index += 1) {
      if (keysA[index] !== keysB[index]) return false;
    }
    for (const key of keysA) {
      const valueA = (a as Record<string, unknown>)[key];
      const valueB = (b as Record<string, unknown>)[key];
      if (!isStructurallyEqual(valueA, valueB)) return false;
    }
    return true;
  }
  return false;
}
```

Note: the `for (let index = 0; ...; index += 1)` classic `for` loop is
permitted here because `index` is a descriptive name and the loop is
iterating an array by position. The code-style rule "no abbreviations
except `i` in classic for loops" applies — here `index` is the
non-abbreviated form and is preferred over `i` per Rule 4.

**Exports (two pure check functions):**

1. **`checkNoFunctionsInG(G)`** — deep scan for `typeof value ===
   'function'`. Use a recursive helper `hasFunction(value: unknown):
   boolean` that returns `true` at the first function found.
   Traverse arrays by index, objects by sorted keys (`// why:`
   comment: deterministic error reproducibility). `assertInvariant`
   with category `'determinism'`. Full-sentence error: "G must be
   JSON-serializable at all times (D-0002). A function value was
   detected in G — functions cannot be serialized or replayed.
   Inspect any code that assigns to G for accidentally storing a
   callback, closure, or method reference. Handlers belong in the
   ImplementationMap, not in G."

2. **`checkSerializationRoundtrip(G)`** — per RS-7, wrap
   `JSON.parse(JSON.stringify(G))` in try/catch; compare result to
   `G` via `isStructurallyEqual`; `assertInvariant` with category
   `'determinism'`. Full-sentence error as specified in Pre-Flight
   Locked Decisions item 6.

No `.reduce()`. Use `for...of` and classic-`for` (the one loop in
`isStructurallyEqual` uses classic `for` because array-by-index is
clearer there).

---

### F) Create `packages/game-engine/src/invariants/lifecycle.checks.ts` (new)

**Imports:**

```ts
import type { MatchPhase, TurnStage } from '../turn/turnPhases.types.js';
import { MATCH_PHASES, TURN_STAGES } from '../turn/turnPhases.types.js';
import { assertInvariant } from './assertInvariant.js';
```

**Exports (three pure check functions):**

1. **`checkValidPhase(phase)`** — accepts `phase: string | undefined`
   (because `InvariantCheckContext.phase` is optional). If
   `phase === undefined`, return immediately (no throw — nothing to
   check). Otherwise, assert `(MATCH_PHASES as readonly string[]).includes(phase)`.
   Full-sentence error: "Match phase '${phase}' is not one of the
   canonical MATCH_PHASES (${MATCH_PHASES.join(', ')}). Inspect
   game.ts phase transitions for a setPhase call with an invalid
   argument."

2. **`checkValidStage(stage)`** — accepts `stage: TurnStage` (read
   directly from `G.currentStage`, which is typed as `TurnStage`).
   Assert `(TURN_STAGES as readonly string[]).includes(stage)`.
   Full-sentence error: "Turn stage '${stage}' is not one of the
   canonical TURN_STAGES (${TURN_STAGES.join(', ')}). Inspect any
   assignment to G.currentStage for an invalid value — this is a
   type-bypass invariant guard."

3. **`checkTurnCounterMonotonic(currentTurn, previousTurn)`** —
   accepts two optional numbers. If either is `undefined`, return
   (no throw). Otherwise assert `currentTurn >= previousTurn`.
   Full-sentence error: "Turn counter must be monotonic — current
   turn (${currentTurn}) decreased from previous turn
   (${previousTurn}). Turn counter may never decrease. Inspect any
   code that assigns to ctx.turn or bypasses ctx.events.endTurn."

No `.reduce()`. Lifecycle checks are small and focused.

---

### G) Create `packages/game-engine/src/invariants/runAllChecks.ts` (new)

**Imports:**

```ts
import type { LegendaryGameState } from '../types.js';
import type { InvariantCheckContext } from './invariants.types.js';
import {
  checkCitySize,
  checkZoneArrayTypes,
  checkCountersAreFinite,
  checkGIsSerializable,
} from './structural.checks.js';
import {
  checkNoCardInMultipleZones,
  checkZoneCountsNonNegative,
  checkCountersUseConstants,
} from './gameRules.checks.js';
import {
  checkNoFunctionsInG,
  checkSerializationRoundtrip,
} from './determinism.checks.js';
import {
  checkValidPhase,
  checkValidStage,
} from './lifecycle.checks.js';
```

Note: `checkTurnCounterMonotonic` is NOT called from
`runAllInvariantChecks` in WP-031 because there is no "previous turn"
state at setup time. It is exported from `lifecycle.checks.ts` as a
pure helper for future use by a follow-up WP that adds per-turn
wiring. Test 5 exercises it directly.

**Export:**

```ts
/**
 * Runs all implemented invariant checks against G in category order.
 *
 * // why: the fixed order prevents "which violation fired first?"
 * ambiguity. Structural checks run first because structural
 * corruption invalidates every other check — asserting gameRules
 * on a non-array zone would produce a confusing secondary failure.
 * Fail-fast: the first assertInvariant throw aborts the runner;
 * remaining checks are skipped.
 *
 * // why: security/visibility checks are deferred per WP-031 §Out
 * of Scope. The InvariantCategory 'security' slot exists in the
 * union and INVARIANT_CATEGORIES array for future extension, but
 * no check functions are implemented yet.
 *
 * // why: checkTurnCounterMonotonic is not called here — it requires
 * a previous-turn reference that does not exist at setup time. It
 * is a pure helper exported for future per-turn wiring.
 *
 * @param G - The game state to check.
 * @param invariantContext - Local structural framework context subset
 *   for lifecycle checks. Fields may be undefined if unavailable at
 *   the call site; lifecycle checks handle this gracefully.
 * @throws {InvariantViolationError} on first invariant violation.
 */
export function runAllInvariantChecks(
  G: LegendaryGameState,
  invariantContext: InvariantCheckContext,
): void {
  // Structural
  checkCitySize(G);
  checkZoneArrayTypes(G);
  checkCountersAreFinite(G);
  checkGIsSerializable(G);

  // Game Rules
  checkNoCardInMultipleZones(G);
  checkZoneCountsNonNegative(G);
  checkCountersUseConstants(G);

  // Determinism
  checkNoFunctionsInG(G);
  checkSerializationRoundtrip(G);

  // Security (deferred — no checks at MVP per WP-031 §Out of Scope)

  // Lifecycle
  checkValidPhase(invariantContext.phase);
  checkValidStage(G.currentStage);
}
```

Do not import `boardgame.io`. Do not import from the registry. Do
not add any other behavior. Do not use `.reduce()`.

---

### H) Modify `packages/game-engine/src/game.ts` (runtime wiring — 01.5)

**Minimal-wiring edit.** Add one import and wrap the setup return
into a four-line block. No other change.

**Import addition** (add to the existing import block near the top):

```ts
import { runAllInvariantChecks } from './invariants/runAllChecks.js';
```

**Setup return wrap.** Replace the current setup return:

```ts
return buildInitialGameState(matchConfiguration, registryForSetup, context);
```

with:

```ts
// why: runAllInvariantChecks enforces structural, gameRules,
// determinism, and lifecycle invariants after buildInitialGameState
// constructs G. Setup is the one engine-wide call site permitted to
// throw per .claude/rules/game-engine.md §Throwing Convention row 1,
// so assertInvariant's throw is safe here. Per D-3102, per-move
// wiring is deferred to a follow-up WP.
const initialState = buildInitialGameState(
  matchConfiguration,
  registryForSetup,
  context,
);
runAllInvariantChecks(initialState, {
  phase: context.ctx.phase,
  turn: context.ctx.turn,
});
return initialState;
```

**Do NOT:**
- Modify any existing move, phase hook, or `endIf`
- Wrap any entry in `LegendaryGame.moves`
- Add any other import
- Touch `validateSetupData`, `setRegistryForSetup`, `clearRegistryForSetup`,
  `EMPTY_REGISTRY`, or `advanceStage`
- Reformat any surrounding code
- Add or modify any other `// why:` comment in `game.ts`

---

### I) Modify `packages/game-engine/src/types.ts` (purely additive re-export)

Add a re-export block at the end of the file (after line ~170, after
the campaign re-export block):

```ts
// why: Invariant types (InvariantCategory, InvariantViolation,
// InvariantCheckContext) are defined canonically in
// src/invariants/invariants.types.ts (WP-031). The canonical
// INVARIANT_CATEGORIES array is a const export (not a type), so it
// uses a separate export statement. Re-exported here so that
// consumers importing from './types.js' have access.
export type {
  InvariantCategory,
  InvariantViolation,
  InvariantCheckContext,
} from './invariants/invariants.types.js';
export { INVARIANT_CATEGORIES } from './invariants/invariants.types.js';
```

**Do NOT:**
- Modify `interface LegendaryGameState`
- Modify `interface SetupContext` or `MatchSelection`
- Touch any other re-export
- Add any new field to any existing type

---

### J) Modify `packages/game-engine/src/index.ts` (purely additive public API)

Add a new export block at the end of the file. Preserve existing
export ordering.

```ts
// WP-031 invariant API
export {
  assertInvariant,
  InvariantViolationError,
} from './invariants/assertInvariant.js';
export { runAllInvariantChecks } from './invariants/runAllChecks.js';
export {
  checkCitySize,
  checkZoneArrayTypes,
  checkCountersAreFinite,
  checkGIsSerializable,
} from './invariants/structural.checks.js';
export {
  checkNoCardInMultipleZones,
  checkZoneCountsNonNegative,
  checkCountersUseConstants,
} from './invariants/gameRules.checks.js';
export {
  checkNoFunctionsInG,
  checkSerializationRoundtrip,
} from './invariants/determinism.checks.js';
export {
  checkValidPhase,
  checkValidStage,
  checkTurnCounterMonotonic,
} from './invariants/lifecycle.checks.js';
export type {
  InvariantCategory,
  InvariantViolation,
  InvariantCheckContext,
} from './invariants/invariants.types.js';
export { INVARIANT_CATEGORIES } from './invariants/invariants.types.js';
```

**Do NOT:**
- Modify any existing export
- Reorder existing exports
- Touch the existing `LegendaryGame`, `setRegistryForSetup`,
  `clearRegistryForSetup` export block at the top
- Add any comment block beyond the section header

---

### K) Create `packages/game-engine/src/invariants/invariants.test.ts` (new)

**Test runner:** `node:test` + `node:assert`. **Extension:** `.test.ts`.
**No** `boardgame.io` imports. **No** `boardgame.io/testing` imports.
**No** modifications to `makeMockCtx`.

**Imports:**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState } from '../types.js';
import type { MatchConfiguration } from '../types.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import {
  INVARIANT_CATEGORIES,
  type InvariantCheckContext,
} from './invariants.types.js';
import {
  assertInvariant,
  InvariantViolationError,
} from './assertInvariant.js';
import { runAllInvariantChecks } from './runAllChecks.js';
import { checkTurnCounterMonotonic } from './lifecycle.checks.js';
```

**Test fixture builder:** write one small helper at the top of the
file that constructs a valid `G` via `buildInitialGameState` with a
minimal valid `MatchConfiguration`. Reuse the MatchConfiguration
pattern from existing tests (e.g., `src/game.test.ts` or
`src/setup/buildInitialGameState.test.ts`). Do not invent new fixture
patterns.

**Ten tests in this exact order:**

1. **`canonical INVARIANT_CATEGORIES array matches InvariantCategory union AND valid G passes all invariant checks`**
   - Drift-detection pre-assertion (runs first):
     ```ts
     assert.deepStrictEqual(
       INVARIANT_CATEGORIES,
       ['structural', 'gameRules', 'determinism', 'security', 'lifecycle'],
     );
     ```
   - Build valid `G` via `buildInitialGameState`.
   - Build `const context: InvariantCheckContext = { phase: 'play', turn: 1 };`
   - Call `runAllInvariantChecks(G, context)`.
   - Assert no throw (the call completes without error).

2. **`card in two zones simultaneously throws with gameRules category`**
   - Build valid `G`.
   - Inject a duplicate: append `G.playerZones['0'].hand[0]` (the
     first hand card) into `G.playerZones['0'].discard` (bypassing
     the move system with a direct mutation — test-only).
   - Call `runAllInvariantChecks(G, { phase: 'play', turn: 1 })`.
   - Assert it throws `InvariantViolationError` with
     `error.category === 'gameRules'`.
   - Use `assert.throws(() => runAllInvariantChecks(G, ctx), (err: Error) => err instanceof InvariantViolationError && (err as InvariantViolationError).category === 'gameRules')`.

3. **`function stored in G throws with determinism category`**
   - Build valid `G`.
   - Inject a function into `G.counters` via type bypass:
     `(G.counters as Record<string, unknown>)['bogusHandler'] = (() => 0);`
   - Call `runAllInvariantChecks(G, { phase: 'play', turn: 1 })`.
   - Assert throws with `error.category === 'determinism'`.

4. **`non-finite counter value throws with structural category`**
   - Build valid `G`.
   - Inject `G.counters.bogus = NaN;` (or `Infinity`).
   - Call `runAllInvariantChecks(G, { phase: 'play', turn: 1 })`.
   - Assert throws with `error.category === 'structural'`.

5. **`invalid phase name throws with lifecycle category`**
   - Build valid `G`.
   - Call `runAllInvariantChecks(G, { phase: 'not-a-phase', turn: 1 })`.
   - Assert throws with `error.category === 'lifecycle'`.
   - **ALSO** verify `checkTurnCounterMonotonic` directly (since it
     is not called by `runAllInvariantChecks`):
     `assert.throws(() => checkTurnCounterMonotonic(2, 5), (err: Error) => err instanceof InvariantViolationError && (err as InvariantViolationError).category === 'lifecycle');`
   - This covers both lifecycle check paths in one test.

6. **`assertInvariant(true, ...) does not throw`**
   - Call `assertInvariant(true, 'structural', 'should not throw');`
   - Assert no throw (wrap in `assert.doesNotThrow`).

7. **`assertInvariant(false, ...) throws with full-sentence message`**
   - Call and assert throws:
     ```ts
     assert.throws(
       () => assertInvariant(false, 'gameRules', 'Full sentence error message identifying the failure and where to inspect.'),
       (err: Error) => {
         return err instanceof InvariantViolationError &&
           (err as InvariantViolationError).category === 'gameRules' &&
           err.message === 'Full sentence error message identifying the failure and where to inspect.';
       },
     );
     ```

8. **`serialization roundtrip passes for valid G`**
   - Build valid `G`.
   - Call `runAllInvariantChecks(G, { phase: 'play', turn: 1 })`.
   - Assert no throw.
   - (This is redundant with Test 1 but specifically exercises the
     serialization check path — kept distinct to match EC-031 §K
     item 8.)

9. **`insufficient attack points does NOT trigger any invariant`**
   - Build valid `G`.
   - Set `G.turnEconomy.attackPoints = 0` (zero attack points).
   - Inject a villain into `G.city[0]` with a positive fight cost
     via direct mutation (test-only).
   - Call `runAllInvariantChecks(G, { phase: 'play', turn: 1 })`.
   - Assert **no throw** — this is a gameplay condition, not an
     invariant violation per D-0102 clarification.
   - Include inline comment: `// why: insufficient attack is a
     gameplay condition handled by fightVillain returning void.
     assertInvariant must not flag it. Contract enforcement test
     per WP-028 precedent — do not weaken.`

10. **`empty wounds pile does NOT trigger any invariant`**
    - Build valid `G`.
    - Set `G.piles.wounds = [];` (empty wounds pile).
    - Call `runAllInvariantChecks(G, { phase: 'play', turn: 1 })`.
    - Assert **no throw** — normal game state.
    - Same inline comment pattern as Test 9.

**Tests 9 and 10 are contract enforcement tests.** If either fails,
the invariant check is wrong — fix the check, not the test. Do not
weaken assertions. Do not add conditional logic to the tests.

All tests use the `InvariantCheckContext` shape directly (plain
object literal). No `makeMockCtx` call for the context — only for
the underlying `buildInitialGameState`.

---

## Required `// why:` Comments

Per EC-031 §Required `// why:` Comments and the code-style rules,
the following `// why:` comments are mandatory:

- `invariants.types.ts` — on the five-categories rationale (prevents
  classification ambiguity)
- `invariants.types.ts` — on `INVARIANT_CATEGORIES` (drift-detection
  with the union)
- `invariants.types.ts` — on `InvariantCheckContext` (local subset to
  avoid boardgame.io import; cites WP-028 D-2801 precedent)
- `assertInvariant.ts` — on `InvariantViolationError` (invariant
  violations must fail fast per D-0102; distinguishes from gameplay
  conditions)
- `assertInvariant.ts` — on `assertInvariant` (throwing is permitted
  here because Game.setup() is the call site per
  `.claude/rules/game-engine.md §Throwing Convention` row 1)
- `structural.checks.ts`, `gameRules.checks.ts`,
  `determinism.checks.ts`, `lifecycle.checks.ts` — one-line
  description on each check function explaining **what it prevents**
  (not what it does)
- Every `Object.keys(record).sort()` site (6 total): "deterministic
  error reproducibility — fail-fast must identify the same
  offending key on every run"
- `gameRules.checks.ts` — on the `attachedBystanders` exclusion in
  `checkNoCardInMultipleZones` (attachment model per D-1703)
- `gameRules.checks.ts` — on `checkCountersUseConstants` narrowing
  (strict ENDGAME_CONDITIONS membership deferred per RS-4)
- `structural.checks.ts` — on `checkGIsSerializable` (structural:
  operation succeeds)
- `determinism.checks.ts` — on `checkSerializationRoundtrip`
  (determinism: roundtrip is identity-preserving)
- `determinism.checks.ts` — on `isStructurallyEqual` local helper
  (JSON-output-only scope)
- `runAllChecks.ts` — on the fail-fast ordering rationale
- `runAllChecks.ts` — on the deferred Security category
- `runAllChecks.ts` — on `checkTurnCounterMonotonic` not being called
- `game.ts` — on the wired block (runAllInvariantChecks enforces
  invariants; Game.setup() is the one throw-allowed site; per-move
  wiring is deferred per D-3102)
- `types.ts` — on the re-export block
- `invariants.test.ts` Test 9 and Test 10 — on the contract-enforcement
  status (do not weaken)

No `// why:` comment is required on `ctx.events.setPhase` or
`ctx.events.endTurn` — WP-031 does not call either.

---

## Scope Lock (Authoritative)

### WP-031 Is Allowed To

**New files** (all under `packages/game-engine/src/invariants/`):
- Create: `invariants.types.ts`
- Create: `assertInvariant.ts`
- Create: `structural.checks.ts`
- Create: `gameRules.checks.ts`
- Create: `determinism.checks.ts`
- Create: `lifecycle.checks.ts`
- Create: `runAllChecks.ts`
- Create: `invariants.test.ts`

**Modified files** (under 01.5 Runtime Wiring Allowance):
- Modify: `packages/game-engine/src/game.ts` — exactly one import
  addition + four-line setup-return wrap (see §Implementation Task H)
- Modify: `packages/game-engine/src/types.ts` — exactly one re-export
  block (see §Implementation Task I)
- Modify: `packages/game-engine/src/index.ts` — exactly one export
  block at end of file (see §Implementation Task J)

**Governance updates:**
- Update: `docs/ai/STATUS.md` — engine invariant checks exist; five
  categories defined; fail-fast on structural corruption; D-0001 and
  D-0102 implemented; per-move wiring deferred per D-3102
- Update: `docs/ai/work-packets/WORK_INDEX.md` — check off WP-031
  with today's date (2026-04-15)

### WP-031 Is Explicitly Not Allowed To

- No modification to any engine file not in the list above
  (`src/moves/`, `src/rules/`, `src/setup/`, `src/state/`, `src/turn/`,
  `src/board/`, `src/hero/`, `src/economy/`, `src/villainDeck/`,
  `src/scheme/`, `src/mastermind/`, `src/ui/`, `src/replay/`,
  `src/scoring/`, `src/endgame/`, `src/persistence/`, `src/lobby/`,
  `src/campaign/`)
- No modification to `interface LegendaryGameState`
- No modification to any contract type (`MatchSetupConfig`,
  `PlayerZones`, `CardExtId`, `CityZone`, `HqZone`,
  `MATCH_PHASES`, `TURN_STAGES`, `ENDGAME_CONDITIONS`,
  `REVEALED_CARD_TYPES`, `BOARD_KEYWORDS`, `SCHEME_SETUP_TYPES`,
  `PERSISTENCE_CLASSES`)
- No new field, move, phase, stage, trigger, effect, or counter
- No expansion of `CoreMoveName` / `CORE_MOVE_NAMES`
- No new Security/Visibility check functions (deferred per WP §Out
  of Scope)
- No `boardgame.io` imports in any file under `src/invariants/`
- No `@legendary-arena/registry` imports in any file under
  `src/invariants/`
- No `node:assert` imports in any non-test file under `src/invariants/`
  (use the local `isStructurallyEqual` helper for
  `checkSerializationRoundtrip`)
- No imports of `LegendaryGameState`, `hookRegistry`, or
  `ImplementationMap` into invariant files beyond the `type`-only
  imports specified in §Implementation Tasks
- No `.reduce()` in any check function, orchestrator, or test
- No `Math.random()`, `Date.now()`, or other nondeterministic source
- No `require()` in any file
- No IO, network, filesystem, or environment access
- No `process.env` read anywhere
- No mutation of `G` inside any check function
- No mutation of the input `InvariantCheckContext` object
- No modification to `makeMockCtx` or other shared test helpers
- No modification to any existing test file
- No wiring of individual check functions into `game.ts`, moves,
  phase hooks, or setup builders (only `runAllInvariantChecks` is
  wired, and only at the setup return path)
- No wrapping of `LegendaryGame.moves` entries with `withInvariantChecks`
  or similar (per-move wiring deferred per D-3102)
- No new exception added to `.claude/rules/game-engine.md`
- No touching the 6 pre-existing untracked files
  (`docs/ai/session-context/session-context-wp029.md`, the license
  letter docs, the one-pager docs, the Upper Deck contacts doc,
  `.claude/settings.local.json`) — exclude explicitly at commit time
- No "while I'm here" improvements, refactors, or cleanups
- No retroactive invocation of 01.5 to justify edits beyond the
  enumerated Allowance list at the top of this prompt

---

## Test Expectations (Locked)

- **10 new tests** in
  `packages/game-engine/src/invariants/invariants.test.ts`, in the
  order specified in §Implementation Task K
- All **348 existing tests** must continue to pass **unchanged**
- Expected final test count: **358 tests, 94 suites, 0 fail**
- No existing test file may be modified
- No `boardgame.io` imports in test files
- No `boardgame.io/testing` imports
- No modifications to `makeMockCtx` or other shared test helpers
- Tests use `buildInitialGameState` + `makeMockCtx` for valid-G
  fixtures. Injection of broken state into `G` is done via direct
  test-only mutation AFTER the initial state is built (bypassing
  the move system, which is the correct pattern for structural
  corruption testing).
- Tests 9 and 10 are contract enforcement — do not weaken if they
  fail; fix the check functions instead.

---

## Verification Steps (Must Execute Before Completion)

Run every step. Each must match the expected output.

```bash
# Step 1 — build after adding invariants
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — 358 tests passing, 0 failing, 94 suites

# Step 3 — confirm no boardgame.io import in invariants directory
# Use rg (ripgrep) or sed-free grep. On PowerShell the canonical
# command is Select-String; on bash use grep -rn.
# Either works as long as output is empty.
git grep -l "boardgame.io" -- "packages/game-engine/src/invariants/"
# Expected: no output

# Step 4 — confirm no registry import in invariants directory
git grep -l "@legendary-arena/registry" -- "packages/game-engine/src/invariants/"
# Expected: no output

# Step 5 — confirm no .reduce() in invariants directory
git grep -n "\.reduce(" -- "packages/game-engine/src/invariants/"
# Expected: no output

# Step 6 — confirm no Math.random() in invariants directory
git grep -n "Math\.random" -- "packages/game-engine/src/invariants/"
# Expected: no output

# Step 7 — confirm no require() in invariants directory
git grep -n "require(" -- "packages/game-engine/src/invariants/"
# Expected: no output

# Step 8 — confirm no process.env in invariants directory
git grep -n "process\.env" -- "packages/game-engine/src/invariants/"
# Expected: no output

# Step 9 — confirm assertInvariant throws (test exists)
git grep -n "throws\|InvariantViolationError" -- "packages/game-engine/src/invariants/invariants.test.ts"
# Expected: at least one match per test 2, 3, 4, 5, 7

# Step 10 — confirm gameplay-condition-not-invariant tests exist
git grep -n "insufficient\|empty\|gameplay condition" -- "packages/game-engine/src/invariants/invariants.test.ts"
# Expected: at least two matches (tests 9 and 10)

# Step 11 — confirm canonical array drift-detection assertion exists
git grep -n "INVARIANT_CATEGORIES" -- "packages/game-engine/src/invariants/invariants.test.ts"
# Expected: at least one match (test 1)

# Step 12 — confirm deterministic sort in every Record-scanning check
git grep -n "Object\.keys.*\.sort()" -- "packages/game-engine/src/invariants/"
# Expected: at least 6 matches (one per affected check function)

# Step 13 — confirm no engine files modified outside the 01.5 allowlist
git diff --name-only packages/game-engine/src/moves/ packages/game-engine/src/rules/ packages/game-engine/src/setup/ packages/game-engine/src/state/ packages/game-engine/src/turn/ packages/game-engine/src/board/ packages/game-engine/src/hero/ packages/game-engine/src/economy/ packages/game-engine/src/villainDeck/ packages/game-engine/src/scheme/ packages/game-engine/src/mastermind/ packages/game-engine/src/ui/ packages/game-engine/src/replay/ packages/game-engine/src/scoring/ packages/game-engine/src/endgame/ packages/game-engine/src/persistence/ packages/game-engine/src/lobby/ packages/game-engine/src/campaign/ packages/game-engine/src/test/
# Expected: no output

# Step 14 — confirm only allowlisted files in diff
git diff --name-only
# Expected: only these files —
#   packages/game-engine/src/game.ts
#   packages/game-engine/src/types.ts
#   packages/game-engine/src/index.ts
#   packages/game-engine/src/invariants/invariants.types.ts
#   packages/game-engine/src/invariants/assertInvariant.ts
#   packages/game-engine/src/invariants/structural.checks.ts
#   packages/game-engine/src/invariants/gameRules.checks.ts
#   packages/game-engine/src/invariants/determinism.checks.ts
#   packages/game-engine/src/invariants/lifecycle.checks.ts
#   packages/game-engine/src/invariants/runAllChecks.ts
#   packages/game-engine/src/invariants/invariants.test.ts
#   docs/ai/STATUS.md
#   docs/ai/work-packets/WORK_INDEX.md
# (Plus pre-existing unrelated untracked files — must NOT be staged)

# Step 15 — confirm game.ts changes are minimal-wiring only
git diff packages/game-engine/src/game.ts
# Expected: exactly one new import line; exactly one 4-line block
#   replacing the original single-line setup return statement.
#   No other diff. No reformatting.
```

Every step must pass before marking the WP complete.

---

## Post-Mortem Checks (Run Before Marking Complete)

Mandatory post-mortem for WP-031:

1. **Canonical array drift-detection:** confirm
   `INVARIANT_CATEGORIES` in `invariants.types.ts` has exactly 5
   entries matching the `InvariantCategory` union in order. Confirm
   Test 1 asserts this via `assert.deepStrictEqual`.

2. **Deterministic iteration trace:** read each of the 6 affected
   check functions (`checkZoneArrayTypes`, `checkCountersAreFinite`,
   `checkCountersUseConstants`, `checkNoCardInMultipleZones`,
   `checkZoneCountsNonNegative`, `checkNoFunctionsInG`) and confirm
   every `Object.keys(record)` is followed by `.sort()`. No
   exceptions. Each sort site has a `// why:` comment.

3. **`InvariantCheckContext` structural scope:** confirm no file
   under `src/invariants/` contains `from 'boardgame.io'`. Confirm
   `runAllChecks.ts` uses the local interface, not `Ctx`.

4. **Setup wiring minimality:** read `game.ts` diff. Confirm exactly
   one new import (`runAllInvariantChecks`) and exactly one 4-line
   block replacing the original return. No reformatting. No other
   change. No move wrapping. No `withInvariantChecks` helper.

5. **Gameplay conditions not flagged:** confirm Tests 9 and 10 pass
   with the exact assertions specified above. Confirm the comments
   explicitly cite "contract enforcement test — do not weaken".

6. **No security category checks:** confirm `runAllChecks.ts` has
   no import from any hypothetical `security.checks.ts` file and no
   call to any security check function. The category slot exists in
   the union but no check functions are implemented.

7. **`LegendaryGameState` unchanged:** run
   `git diff packages/game-engine/src/types.ts` and confirm
   `interface LegendaryGameState` block is untouched (only the
   re-export block at the bottom is new).

8. **No new rule exception:** run
   `git diff .claude/rules/game-engine.md` and confirm no output —
   the existing `Game.setup() may throw` row already covers
   `assertInvariant`.

9. **`checkTurnCounterMonotonic` uncalled but exported:** confirm
   `runAllChecks.ts` does NOT call `checkTurnCounterMonotonic`, but
   `index.ts` DOES export it, and Test 5 exercises it directly.

10. **Mystery untracked files untouched:** confirm `git status`
    still shows the 6 pre-existing untracked files unchanged. None
    of them are staged for WP-031 commits.

If any check fails, the implementation is incorrect. Fix and
re-verify before marking complete.

---

## Post-Execution Documentation (After All Tests Pass)

1. **`docs/ai/STATUS.md`** — update Phase 6 status:
   - Engine invariant checks exist (WP-031 complete)
   - Five invariant categories defined
     (`INVARIANT_CATEGORIES`): structural, gameRules, determinism,
     security (deferred), lifecycle
   - Fail-fast on structural corruption; gameplay conditions remain
     safe no-ops per D-0102 clarification
   - D-0001 (Correctness Over Convenience) and D-0102 (Fail Fast on
     Invariant Violations) implemented
   - Per-move wiring deferred to a follow-up WP per D-3102
   - 358 engine tests passing, 94 suites, 0 fail

2. **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-031:
   ```
   - [x] WP-031 — Production Hardening & Engine Invariants ✅ Reviewed ✅ Completed 2026-04-15
   ```
   Add completion date to the Notes block and a one-line mention of
   the setup-only wiring scope per D-3102.

3. **DECISIONS.md** — NO new entries required. D-3101 and D-3102
   were written pre-session. Do NOT add retroactive entries. If the
   execution discovers a need for a new decision, STOP and escalate
   — do not auto-create decisions mid-session.

4. **WP text back-sync:** the post-mortem must flag that WP-031 §G
   line ~196 still says `runAllInvariantChecks(G: LegendaryGameState, ctx: Ctx): void`
   but the shipped signature is
   `runAllInvariantChecks(G: LegendaryGameState, invariantContext: InvariantCheckContext): void`.
   Flag this as a one-line WP-text edit for the post-mortem or
   pre-commit review to catch per P6-8. Do NOT edit the WP text
   from this session — that is the post-mortem reviewer's call.

---

## Execution Summary Requirements

At the end of the session, produce a brief execution summary that
states:

1. Test count: should be `358 tests, 94 suites, 0 fail`
2. Files created (should match the 8 allowlist entries exactly under
   `src/invariants/`)
3. Files modified under 01.5 (should be exactly `game.ts`, `types.ts`,
   `index.ts` — with the minimal edits described in §Implementation
   Tasks H, I, J)
4. Explicit confirmation that **01.5 was INVOKED** with the three
   enumerated files and what was done in each
5. Explicit confirmation that no `LegendaryGameState` field was added
6. Explicit confirmation that no move was wrapped with invariant
   checks (per D-3102 / Option B)
7. Explicit confirmation that no engine file outside the 01.5
   allowlist was modified
8. Explicit confirmation that no new rule exception was added to
   `.claude/rules/game-engine.md`
9. Post-mortem checks 1–10 explicitly passed (list each check and
   its disposition)
10. WP-031 §G back-sync note (signature refinement RS-2) flagged for
    the post-mortem / pre-commit review per P6-8
11. Mystery untracked files confirmation — 6 files still untracked,
    none staged, none modified

Any deviation from the above must be documented and justified in the
execution summary. Do not silently proceed if any verification step
fails — stop and escalate.

---

## Commit Convention

When work is complete and all verification steps pass, stage exactly
the allowlist files (use explicit `git add <file>` for each; do NOT
use `git add -A` or `git add .` because 6 unrelated untracked files
must remain unstaged):

```bash
git add packages/game-engine/src/invariants/invariants.types.ts
git add packages/game-engine/src/invariants/assertInvariant.ts
git add packages/game-engine/src/invariants/structural.checks.ts
git add packages/game-engine/src/invariants/gameRules.checks.ts
git add packages/game-engine/src/invariants/determinism.checks.ts
git add packages/game-engine/src/invariants/lifecycle.checks.ts
git add packages/game-engine/src/invariants/runAllChecks.ts
git add packages/game-engine/src/invariants/invariants.test.ts
git add packages/game-engine/src/game.ts
git add packages/game-engine/src/types.ts
git add packages/game-engine/src/index.ts
git add docs/ai/STATUS.md
git add docs/ai/work-packets/WORK_INDEX.md
```

Then commit with:

```
EC-031: implement engine invariant checks with setup-only wiring
```

Commit body should note:
- Runtime Wiring WP; 01.5 IS INVOKED (game.ts setup-return wrap,
  types.ts + index.ts additive exports)
- Five invariant categories (structural, gameRules, determinism,
  security deferred, lifecycle)
- `assertInvariant` throws `InvariantViolationError` — throwing
  permitted at setup return per existing `Game.setup() may throw`
  exception
- Per D-3102, per-move wiring deferred to a follow-up WP
- 10 new tests (358 total); test 1 is combined drift-detection + valid-G
- Canonical `INVARIANT_CATEGORIES` array added for drift prevention
- Deterministic `Object.keys(...).sort()` locked at every Record scan
- `InvariantCheckContext` local structural interface follows WP-028
  D-2801 UIBuildContext precedent
- D-3101 (directory classification) and D-3102 (setup-only wiring)
  locked pre-session

Follow commit hygiene per
`docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md` — `EC-###:`
prefix, no hook-skipping, no amending prior commits.

---

## Final Instruction

WP-031 is a **runtime hardening** work packet. The temptation to
"helpfully" extend invariant coverage beyond the locked categories,
wire checks into more lifecycle points, add a Security check
function, or weaken Tests 9/10 when they fail must be resisted.
Every one of those temptations is an anti-pattern explicitly
addressed by the pre-flight and copilot check.

**The two golden rules for this session:**

1. **Invariant violations throw; gameplay conditions return void.**
   Use the two-column table in §AI Agent Warning to classify every
   check. If you cannot confidently classify, STOP and escalate.

2. **Setup-only wiring, nothing more.** Per D-3102 / Option B, the
   only call to `runAllInvariantChecks` is at the `Game.setup()`
   return path. No moves. No phase hooks. No turn boundaries. A
   future WP may expand this under a new decision — but NOT this WP.

When in doubt, STOP and consult the pre-flight document, the copilot
check, or escalate to the user. Do not force-fit changes. Do not
invoke 01.5 retroactively. Do not add decisions mid-session.
