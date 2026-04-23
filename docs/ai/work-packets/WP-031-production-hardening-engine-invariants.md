# WP-031 — Production Hardening & Engine Invariants

**Status:** Complete  
**Primary Layer:** Engine Safety / Invariants / Fail-Fast Guarantees  
**Dependencies:** WP-029

---

## Session Context

WP-027 proved deterministic replay. WP-028/029 established the UI state
contract and audience-filtered views. All MVP gameplay mechanics are in place
(WP-002 through WP-026). This packet introduces explicit runtime invariant
checks that prevent entire classes of bugs from shipping. It implements
D-0001 (Correctness Over Convenience) and D-0102 (Fail Fast on Invariant
Violations). The distinction between invariant violations (fail fast) and
unmet gameplay conditions (safe no-op) per D-0102's clarification is central
to this packet.

---

## Goal

Introduce explicit engine invariants, runtime assertion utilities, and
production-grade safeguards. After this session:

- Five non-overlapping invariant categories are defined: structural, game
  rules, determinism, security/visibility, and lifecycle
- A runtime assertion utility (`assertInvariant`) provides deterministic
  fail-fast behavior for invariant violations
- Invariant checks are wired into key engine lifecycle points (setup, move
  execution, turn transitions)
- All checks are pure, deterministic, and side-effect-free
- Invariant violations cause immediate, observable failure — never silent
  corruption
- Unmet gameplay conditions (insufficient attack, empty pile) remain safe
  no-ops per D-0102 clarification

---

## Assumes

- WP-029 complete. Specifically:
  - All MVP gameplay mechanics in place (WP-002 through WP-026)
  - `LegendaryGameState` is stable with all fields
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/board/city.types.ts` exports `CityZone` (WP-015)
  - `packages/game-engine/src/endgame/endgame.types.ts` exports
    `ENDGAME_CONDITIONS` (WP-010)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists with D-0001, D-0002, D-0102 (including
  clarification distinguishing invariant violations from gameplay conditions)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read all subsections.
  This packet formalizes the invariants already documented there as runtime
  checks.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "Why G Must Never Be Persisted",
  "The Move Validation Contract", "Zone Mutation Rules". These define the
  structural constraints that invariant checks enforce.
- `docs/ai/DECISIONS.md` — read D-0001 (Correctness Over Convenience), D-0002
  (Determinism Is Non-Negotiable), D-0102 (Fail Fast on Invariant Violations).
  The D-0102 clarification distinguishes invariant violations (fail fast) from
  unmet gameplay conditions (safe no-op). This packet enforces that distinction.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — invariant
  checks are game-engine layer only. They validate engine state, not server
  config or UI rendering.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations),
  Rule 6 (`// why:` on each invariant explaining what it prevents), Rule 8
  (no `.reduce()`), Rule 11 (full-sentence error messages in assertions),
  Rule 13 (ESM only).

**Critical design note — fail fast vs gameplay conditions:**
Invariant violations (structural corruption, serialization failure, zone
integrity breach) cause immediate failure via `assertInvariant`. Gameplay
conditions (insufficient attack points, empty wounds pile, no valid target)
are NOT invariant violations — they are normal game states handled by moves
returning void. This packet only adds checks for the former.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — invariant checks involve no randomness
- `G` must be JSON-serializable at all times
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in any new file
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `assertInvariant` **throws** on violation — this is correct and intentional.
  Invariant violations are NOT gameplay conditions; they indicate structural
  corruption that must not be silently ignored.
- Invariant check functions are **pure** — they read `G`, return boolean or
  throw, and perform no I/O or mutations
- All assertions produce **full-sentence error messages** identifying what
  failed and where (Rule 11)
- Invariant checks must NOT reject valid gameplay states — insufficient attack,
  empty piles, etc. are NOT invariant violations
- The five invariant categories are non-overlapping — each check belongs to
  exactly one category
- No `.reduce()` in check logic — use `for...of`
- No gameplay logic changes — invariant checks observe, they do not alter
  game behavior
- Tests use `makeMockCtx` — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **Five invariant categories:**
  1. Structural — zone shapes, array types, field existence
  2. Game Rules — card uniqueness, counter validity, zone exclusivity
  3. Determinism — serialization roundtrip, no functions in G
  4. Security/Visibility — no hidden state leakage in UIState
  5. Lifecycle — phase/stage validity, turn counter monotonicity

---

## Scope (In)

### A) `src/invariants/invariants.types.ts` — new

- `type InvariantCategory = 'structural' | 'gameRules' | 'determinism' | 'security' | 'lifecycle'`
- `interface InvariantViolation { category: InvariantCategory; message: string; context?: Record<string, unknown> }`
- `// why:` comment: five non-overlapping categories prevent classification
  ambiguity

### B) `src/invariants/assertInvariant.ts` — new

- `assertInvariant(condition: boolean, category: InvariantCategory, message: string): void`
  — throws `InvariantViolationError` if condition is false
  - Error message is full-sentence, includes category
  - `// why:` comment: invariant violations must fail fast (D-0102); unmet
    gameplay conditions use move return void instead

### C) `src/invariants/structural.checks.ts` — new

- Pure check functions for structural invariants:
  - `checkCitySize(G)` — City length matches expected size
  - `checkZoneArrayTypes(G)` — all zone fields are arrays of strings
  - `checkCountersAreFinite(G)` — all `G.counters` values are finite numbers
  - `checkGIsSerializable(G)` — `JSON.parse(JSON.stringify(G))` roundtrips
- Each function calls `assertInvariant` on failure
- No boardgame.io import — pure helpers

### D) `src/invariants/gameRules.checks.ts` — new

- Pure check functions for game rules invariants:
  - `checkNoCardInMultipleZones(G)` — no **non-fungible** CardExtId
    appears in more than one distinct zone simultaneously. See the
    §Amendments section (A-031-01 / D-3103) for the fungible-exclusion
    set and revised semantics. CardExtIds are card-type identifiers,
    not per-instance identifiers, so the check must exclude the six
    known fungible token strings (starting-shield-agent,
    starting-shield-trooper, pile-bystander, pile-wound,
    pile-shield-officer, pile-sidekick) whose legitimate duplication
    inside piles and starting decks is structural, not corruption.
  - `checkZoneCountsNonNegative(G)` — all zone lengths >= 0
  - `checkCountersUseConstants(G)` — all counter keys are valid
    `ENDGAME_CONDITIONS` values or documented custom keys
- No boardgame.io import

### E) `src/invariants/determinism.checks.ts` — new

- Pure check functions for determinism invariants:
  - `checkNoFunctionsInG(G)` — no function values in `G` (deep scan)
  - `checkSerializationRoundtrip(G)` — `JSON.stringify` -> `JSON.parse`
    produces structurally equal object
- No boardgame.io import

### F) `src/invariants/lifecycle.checks.ts` — new

- Pure check functions for lifecycle invariants:
  - `checkValidPhase(phase)` — phase is one of the 4 locked names
  - `checkValidStage(stage)` — stage is one of the 3 locked values
  - `checkTurnCounterMonotonic(currentTurn, previousTurn)` — turn number
    never decreases
- No boardgame.io import

### G) `src/invariants/runAllChecks.ts` — new

- `runAllInvariantChecks(G: LegendaryGameState, ctx: Ctx): void`
  — runs all category checks in order
  - Called at strategic lifecycle points (after setup, after each move, on
    turn boundary)
  - First failure throws — remaining checks are skipped
  - `// why:` comment on check ordering and fail-fast behavior

### H) `src/game.ts` — modified

- Wire `runAllInvariantChecks` into:
  - After `Game.setup()` completes
  - Optionally after each move (configurable — may be dev/test only for
    performance). Document the approach in DECISIONS.md.

### I) `src/types.ts` — modified

- Re-export invariant types

### J) `src/index.ts` — modified

- Export `assertInvariant`, `runAllInvariantChecks`, `InvariantCategory`,
  `InvariantViolation`, and individual check functions

### K) Tests — `src/invariants/invariants.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Ten tests:
  1. Valid `G` passes all invariant checks (no throw)
  2. Card in two zones simultaneously: throws with `gameRules` category
  3. Function stored in `G`: throws with `determinism` category
  4. Non-finite counter value: throws with `structural` category
  5. Invalid phase name: throws with `lifecycle` category
  6. `assertInvariant(true, ...)` does not throw
  7. `assertInvariant(false, ...)` throws with full-sentence message
  8. Serialization roundtrip passes for valid `G`
  9. Insufficient attack points does NOT trigger any invariant (gameplay
     condition, not structural violation)
  10. Empty wounds pile does NOT trigger any invariant

---

## Out of Scope

- **No performance optimization of invariant checks** — correctness first
- **No conditional compilation or build-time stripping** — future concern
- **No security/visibility invariant checks** (UIState leakage) — requires
  WP-028/029 integration testing, deferred
- **No invariant checks in server or registry layers** — engine only
- **No UI changes**
- **No persistence / database access**
- **No server changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/invariants/invariants.types.ts` — **new** —
  InvariantCategory, InvariantViolation
- `packages/game-engine/src/invariants/assertInvariant.ts` — **new** —
  assertion utility
- `packages/game-engine/src/invariants/structural.checks.ts` — **new** —
  structural checks
- `packages/game-engine/src/invariants/gameRules.checks.ts` — **new** —
  game rules checks
- `packages/game-engine/src/invariants/determinism.checks.ts` — **new** —
  determinism checks
- `packages/game-engine/src/invariants/lifecycle.checks.ts` — **new** —
  lifecycle checks
- `packages/game-engine/src/invariants/runAllChecks.ts` — **new** —
  orchestrator
- `packages/game-engine/src/game.ts` — **modified** — wire invariant checks
- `packages/game-engine/src/types.ts` — **modified** — re-export types
- `packages/game-engine/src/index.ts` — **modified** — export API
- `packages/game-engine/src/invariants/invariants.test.ts` — **new** — tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Invariant Categories
- [ ] Five categories defined: structural, gameRules, determinism, security,
      lifecycle
- [ ] Categories are non-overlapping (each check belongs to exactly one)

### Fail-Fast Behavior
- [ ] `assertInvariant(false, ...)` throws with full-sentence message
- [ ] `assertInvariant(true, ...)` does not throw
- [ ] Error includes category and context

### Structural Checks
- [ ] City size check detects wrong length
- [ ] Zone array type check detects non-array zones
- [ ] Counter finiteness check detects NaN/Infinity
- [ ] Serialization roundtrip check detects non-serializable state

### Game Rules Checks
- [ ] Multi-zone card check detects a **non-fungible** CardExtId
      placed into two distinct zones simultaneously (fungible token
      CardExtIds excluded per §Amendments / D-3103)
- [ ] Zone count check detects negative lengths

### Determinism Checks
- [ ] Function-in-G check detects stored functions
- [ ] Serialization roundtrip produces structurally equal object

### Gameplay Conditions NOT Flagged
- [ ] Insufficient attack points does NOT trigger any invariant
- [ ] Empty wounds pile does NOT trigger any invariant

### Pure Helpers
- [ ] All check files have no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in check logic
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Tests cover all 4 implemented categories (structural, gameRules,
      determinism, lifecycle)
- [ ] Tests confirm gameplay conditions are NOT invariant violations
- [ ] All test files use `.test.ts`; no boardgame.io import

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding invariant checks
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in invariant files
Select-String -Path "packages\game-engine\src\invariants" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 4 — confirm no .reduce() in check logic
Select-String -Path "packages\game-engine\src\invariants" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 5 — confirm assertInvariant throws (test exists)
Select-String -Path "packages\game-engine\src\invariants\invariants.test.ts" -Pattern "throws|assert.throws"
# Expected: at least one match

# Step 6 — confirm gameplay-condition-not-invariant tests exist
Select-String -Path "packages\game-engine\src\invariants\invariants.test.ts" -Pattern "insufficient|empty.*pile"
# Expected: at least one match

# Step 7 — confirm no require()
Select-String -Path "packages\game-engine\src\invariants" -Pattern "require(" -Recurse
# Expected: no output

# Step 8 — confirm no files outside scope
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No boardgame.io import in invariant files
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in check logic (confirmed with `Select-String`)
- [ ] Gameplay conditions confirmed NOT flagged as invariant violations
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — engine invariant checks exist; five
      categories defined; fail-fast on structural corruption; D-0001 and
      D-0102 implemented
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: whether invariant checks
      run after every move or only in dev/test; which lifecycle points trigger
      checks; why gameplay conditions are excluded from invariant checking
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-031 checked off with today's date

---

## Amendments

### A-031-01 — `checkNoCardInMultipleZones` Fungible-Exclusion Semantics (2026-04-15)

**Decision reference:** [D-3103](../DECISIONS.md) — Card Uniqueness
Invariant Scope (Fungible Token Exclusion).

**Context:** Mid-session execution of WP-031 discovered that the
original §D spec for `checkNoCardInMultipleZones` — "no CardExtId
appears in more than one zone simultaneously" — is incompatible with
the actual engine state. `CardExtId` is a card-**type** identifier, not
a per-instance identifier. The starting deck builder
(`packages/game-engine/src/setup/buildInitialGameState.ts`) pushes 8
copies of `'starting-shield-agent'` and 4 copies of
`'starting-shield-trooper'` into every player's deck (see
`buildStartingDeckCards`, §`STARTING_AGENTS_COUNT = 8`). The pile
builder (`packages/game-engine/src/setup/pilesInit.ts`
`createPileCards`) fills `G.piles.bystanders` with N copies of
`'pile-bystander'`, and similarly for wounds, officers, and sidekicks.
The literal Set-based dedup would throw
`InvariantViolationError` on every freshly-constructed valid `G`, breaking
every existing test that routes through `LegendaryGame.setup()`.

**Amended semantics:** The check scans every zone that can contain
`CardExtId` entries and flags ONLY **non-fungible** CardExtIds whose
identity appears in two or more **distinct zone names**. Fungible
CardExtIds are excluded from the dedup entirely — their legitimate
duplication across zones (bystanders in supply and in city space,
troopers in deck and in hand) is structurally normal and must not
fire the invariant. The fungible set is locked to the six well-known
constants exported by the setup layer:

- `SHIELD_AGENT_EXT_ID`   = `'starting-shield-agent'`
- `SHIELD_TROOPER_EXT_ID` = `'starting-shield-trooper'`
- `BYSTANDER_EXT_ID`      = `'pile-bystander'`
- `WOUND_EXT_ID`          = `'pile-wound'`
- `SHIELD_OFFICER_EXT_ID` = `'pile-shield-officer'`
- `SIDEKICK_EXT_ID`       = `'pile-sidekick'`

All other CardExtIds (villain cards resolved from
`listCards()`, henchmen as `henchman-{group}-{NN}`, scheme twists as
`scheme-twist-{scheme}-{NN}`, virtual bystanders as
`bystander-villain-deck-{NN}`, mastermind tactics and strikes as
`{setAbbr}-mastermind-{slug}-{cardSlug}`, and any future hero-deck
entries) are treated as unique per-instance — if the same string
appears in two distinct zones, that is a real invariant violation.

**Revised implementation contract (supersedes §D item 1):**

1. Import the six fungible constants from the setup layer's public
   re-exports in `src/types.ts` / `src/index.ts`. If the re-exports
   are not already available from `../types.js` or a sibling engine
   path, use the existing `src/setup/buildInitialGameState.js` and
   `src/setup/pilesInit.js` re-exports — these are data-only constants
   with no runtime or side effects. An inline `Set<CardExtId>` built
   from these constants inside the check function is acceptable
   (preferred) and requires a `// why:` comment: "fungible token
   exclusion — see D-3103; CardExtIds are card-type IDs, not per-
   instance IDs; duplication across zones for these six strings is
   structural and must not fire the invariant".

2. Build a `Map<CardExtId, string>` mapping each **non-fungible**
   CardExtId to the **name of the first zone** it was seen in. Scan
   zones in a deterministic order (see item 3). On each encounter:
   - If the CardExtId is in the fungible set → skip entirely; do not
     add to the map, do not check.
   - Otherwise, if the map already contains the CardExtId AND the
     previously-recorded zone name differs from the current zone
     name → `assertInvariant(false, 'gameRules', ...)`.
   - Otherwise, insert into the map if not already present. If the
     same non-fungible CardExtId appears twice within the SAME zone,
     that is currently allowed (not flagged) because the zone-name
     key is identical. A stronger "no duplicates within one zone"
     check is deferred.

3. Scan order is deterministic and fixed:
   - Player zones, via `Object.keys(G.playerZones).sort()` with a
     `// why:` comment ("deterministic error reproducibility — fail
     fast must identify the same offending player on every run").
     For each player, iterate zones in canonical field order:
     `deck`, `hand`, `discard`, `inPlay`, `victory`
     (**not** `victoryPile`; see Amendment A-031-02).
   - Global piles: `G.piles.bystanders`, `G.piles.wounds`,
     `G.piles.officers`, `G.piles.sidekicks` (in that order).
   - City: `G.city` — skip `null` entries.
   - HQ: `G.hq` — skip `null` entries.
   - KO: `G.ko`.
   - Villain deck: `G.villainDeck.deck`, then `G.villainDeck.discard`.
   - Mastermind: `G.mastermind.tacticsDeck`, then
     `G.mastermind.tacticsDefeated`.
   - `G.attachedBystanders` — **excluded** from the scan per D-1703
     attachment semantics. Add a `// why:` comment citing D-1703.

4. Zone-name keys used inside the map should be stable, descriptive
   strings, e.g., `"playerZones[0].deck"`, `"piles.bystanders"`,
   `"city[2]"`, `"villainDeck.deck"`. The zone name is used in the
   full-sentence error message and must identify the offender
   unambiguously.

5. The full-sentence error message remains: "CardExtId '${cardId}'
   appears in more than one zone simultaneously (first seen in
   ${firstLocation}, also found in ${secondLocation}). This is a
   game rules invariant violation — each non-fungible card must
   exist in exactly one zone at a time. Fungible token CardExtIds
   (see D-3103) are excluded from this check. Inspect any move that
   moved this card for a missing zoneOps.removeFromZone call."

**Implications for Test K.2:** The test must inject a
**non-fungible** CardExtId into two distinct zones to trigger the
check. Example (test-only direct mutation after valid-G
construction):

```ts
const syntheticUniqueCard = 'test-injection-unique-villain-001';
// Bypass the move system — this is a structural corruption test.
G.villainDeck.deck.push(syntheticUniqueCard);
G.city[0] = syntheticUniqueCard;
runAllInvariantChecks(G, { phase: 'play', turn: 1 });
// Asserts throws with error.category === 'gameRules'.
```

Using a fungible (e.g., `'starting-shield-agent'`) will NOT trigger
the check and is explicitly rejected by this amendment.

**Forward-compatibility note:** This amendment narrows WP-031's
correctness coverage but does not remove future coverage. A
follow-up WP may introduce per-instance unique CardExtIds
(e.g., `starting-shield-agent-00`, `starting-shield-agent-01`, …)
and then strengthen the check to the literal "no CardExtId in
multiple zones" semantics without a fungible exclusion. That
refactor is out of scope for WP-031.

---

### A-031-02 — `PlayerZones` Canonical Field Name Is `victory`, Not `victoryPile` (2026-04-15)

**Context:** The original WP §C item 2 (`checkZoneArrayTypes`) and
§D item 1 (`checkNoCardInMultipleZones`) list the zones to scan as
`deck, hand, discard, inPlay, victoryPile`. The canonical type in
`packages/game-engine/src/state/zones.types.ts:49` exports
`PlayerZones.victory: Zone` — **no** `victoryPile` field exists. The
`victoryPile` spelling is a WP drafting typo.

**Resolution:** The check implementation and the test fixtures must
use the canonical field name `victory` exclusively. Do not introduce
aliases. Do not rename the type. Amendment A-031-01 already lists
the corrected canonical order (`deck, hand, discard, inPlay, victory`).

**Affected spec locations:** §C item 2, §D item 1, §K Test 1
(when iterating zones), and any doc comments that mention the zone
list.

---

### A-031-03 — `InvariantCheckContext` Compatibility with `exactOptionalPropertyTypes` (2026-04-15)

**Context:** `packages/game-engine/tsconfig.json` sets
`exactOptionalPropertyTypes: true`. `InvariantCheckContext` as
declared in Pre-Flight RS-2 uses

```ts
readonly phase?: string;
readonly turn?: number;
```

These fields are compile-time compatible with `context.ctx.phase`
(boardgame.io `Ctx.phase: string`) and `context.ctx.turn`
(`Ctx.turn: number`), so the literal
`{ phase: context.ctx.phase, turn: context.ctx.turn }` at the
wiring site type-checks under `exactOptionalPropertyTypes: true`.

At runtime, mock contexts (via `makeMockCtx` + cast, used by the
existing `game.test.ts`) do not set `phase` or `turn`, so the check
functions receive `undefined` at runtime even though the compiler
sees `string` / `number`. The lifecycle check functions
(`checkValidPhase`, `checkTurnCounterMonotonic`) MUST handle the
runtime-undefined case by short-circuiting:

```ts
export function checkValidPhase(phase: string | undefined): void {
  // why: at setup time inside tests that cast makeMockCtx, phase
  // may be runtime-undefined even though boardgame.io Ctx types it
  // as string. Silent-skip when undefined — lifecycle validity
  // cannot be asserted on an absent field.
  if (phase === undefined) return;
  // ... existing canonical-phase assertion
}
```

The parameter type must be declared `string | undefined` (not
`string`) on `checkValidPhase` and on `checkTurnCounterMonotonic`'s
`currentTurn`/`previousTurn` parameters, even though the interface
field is `phase?: string`. This is because TypeScript parameter
types describe what the function can accept, independent of the
interface field's declared type. The interface field type does not
leak into the function signature.

**No change to `InvariantCheckContext` itself is required** — the
interface remains `readonly phase?: string; readonly turn?: number;`
as locked in RS-2.

---

