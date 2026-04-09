# WP-023 — Conditional Hero Effects (Teams, Colors, Keywords)

**Status:** Ready  
**Primary Layer:** Game Engine / Rules Execution (Hero Abilities — Conditional Layer)  
**Dependencies:** WP-022

---

## Session Context

WP-022 introduced execution of unconditional hero keywords (`draw`,
`gainAttack`, `gainRecruit`, `koCard`). WP-021 defined the `HeroAbilityHook`
contract with optional `conditions` and `effects` descriptors. This packet
adds a condition evaluation layer so hero abilities can react to game state —
team-based synergies, hero class matches, keyword-gated bonuses, and
played-card-count thresholds. All condition checking is deterministic, read-only,
and never mutates game state. WP-024 will add scheme and mastermind ability
execution; WP-025 will add board-control keywords (Patrol, Ambush, Guard).

---

## Goal

Execute conditional hero card effects by evaluating declarative conditions
against current game state. After this session:

- Condition evaluators exist for 4 MVP condition types: `requiresTeam`,
  `requiresColor`, `requiresKeyword`, `playedThisTurn`
- Effects with conditions execute only when ALL conditions are met
- Conditions are **checked, not inferred** — they read `G` and return boolean
- Conditions **never mutate game state**
- Effects **never inspect hidden information** (opponent hands, deck contents)
- Execution order remains deterministic and observable
- Unsupported condition types are safely skipped (same as WP-022 pattern)

---

## Assumes

- WP-022 complete. Specifically:
  - `packages/game-engine/src/hero/heroEffects.execute.ts` exports
    `executeHeroEffects` (WP-022)
  - `packages/game-engine/src/rules/heroAbility.types.ts` exports
    `HeroAbilityHook`, `HeroCondition`, `HeroEffectDescriptor` (WP-021)
  - `packages/game-engine/src/rules/heroKeywords.ts` exports `HeroKeyword`,
    `HERO_KEYWORDS` (WP-021)
  - `G.heroAbilityHooks` exists in `LegendaryGameState` (WP-021)
  - `G.turnEconomy` exists (WP-018)
  - `G.playerZones[*].inPlay` tracks played cards (WP-006A)
  - `G.cardStats` exists with card metadata (WP-018)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- Hero card data includes `team` (string) and `hc` (hero class string) fields
  — per ARCHITECTURE.md "Card Field Data Quality"
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants" section
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Data
  Representation Before Execution". WP-021 provided representation, WP-022
  added unconditional execution, this packet adds conditional evaluation
  without refactoring existing contracts.
- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Registry &
  Runtime Boundary". Condition evaluation uses data already in `G` — team/class
  information must be available from `G.cardStats` or `G.heroAbilityHooks`.
  No registry queries at runtime.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Rule Execution Pipeline".
  Condition evaluation is a pre-filter step before effect application. It
  follows the same deterministic pattern.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — conditional
  logic is game-engine layer only. No server, registry, persistence, or UI.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — read it entirely.
  This packet modifies the conditional-skip logic to actually evaluate conditions
  instead of always skipping.
- `packages/game-engine/src/rules/heroAbility.types.ts` — read `HeroCondition`.
  WP-021 defined the shape; this packet provides evaluation.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations),
  Rule 6 (`// why:` on condition evaluation design and why conditions never
  mutate), Rule 8 (no `.reduce()`), Rule 13 (ESM only).

**Critical design rules (locked):**
- Conditions are **checked**, not inferred — each evaluator reads `G` and
  returns `boolean`
- Conditions **NEVER mutate game state** — they are pure predicates
- Effects **NEVER inspect hidden information** — no reading opponent hands,
  deck contents, or unrevealed cards
- Execution order is deterministic and observable

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — condition evaluation involves no randomness
- Never throw inside boardgame.io move functions — return void on invalid input
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in any new file
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Registry boundary (hard rule): no registry access at runtime. Team/class
  information must come from data already in `G` (resolved at setup).
- Condition evaluators are **pure functions** — they read `G`, return `boolean`,
  never mutate state
- Effects with unsupported condition types are **safely skipped** (no mutation,
  no error) — same pattern as WP-022 for unsupported keywords
- Effects execute only when **ALL** conditions on the hook are met (AND logic)
- No hidden information access: conditions cannot read opponent hands, deck
  order, or unrevealed card positions
- `HeroCondition` type shape from WP-021 must not be modified — this packet
  adds evaluators, not new condition shapes
- Execution order unchanged from WP-022: hooks fire in registration order
- No `.reduce()` in condition evaluation — use `for...of`
- WP-021 contract files (`heroAbility.types.ts`, `heroKeywords.ts`) must not
  be modified
- WP-022 execution file is modified to integrate condition checking, not
  replaced
- Tests use `makeMockCtx` — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **Supported condition types (MVP):**

  | Condition type | Evaluates | Data source |
  |---|---|---|
  | `requiresTeam` | Player has played a card from specified team this turn | `G.playerZones[player].inPlay` + team data |
  | `requiresColor` | Player has played a card with specified hero class | `G.playerZones[player].inPlay` + `hc` field |
  | `requiresKeyword` | Player has played a card with specified keyword this turn | `G.heroAbilityHooks` filtered by played cards |
  | `playedThisTurn` | Player has played at least N cards this turn | `G.playerZones[player].inPlay.length` |

- **Unsupported condition types (deferred):**
  Any condition type not in the above table is safely skipped.

---

## Scope (In)

### A) `src/hero/heroConditions.evaluate.ts` — new

- `evaluateCondition(G: LegendaryGameState, ctx: Ctx, condition: HeroCondition): boolean`
  — pure function that evaluates a single condition:
  - `requiresTeam`: check if any card in current player's `inPlay` has the
    specified team (team data resolved from `G.cardStats` or setup-time lookup)
  - `requiresColor`: check if any card in `inPlay` has the specified hero class
  - `requiresKeyword`: check if any played card's hooks include the keyword
  - `playedThisTurn`: check if `inPlay.length >= value`
  - Unsupported type: return `false` (safe skip)
  - Never mutates `G`
  - `// why:` comment on each evaluator

- `evaluateAllConditions(G: LegendaryGameState, ctx: Ctx, conditions: HeroCondition[]): boolean`
  — returns `true` only if ALL conditions pass (AND logic)
  - Empty/undefined conditions array: returns `true` (unconditional)
  - Uses `for...of` (no `.reduce()`)

- Pure helpers, no boardgame.io import

### B) `src/hero/heroEffects.execute.ts` — modified

- Replace the "skip all conditional effects" logic from WP-022 with actual
  condition evaluation:
  - Call `evaluateAllConditions(G, ctx, hook.conditions)` before executing
    each hook's effects
  - If conditions pass: execute effects (same as WP-022 execution)
  - If conditions fail: skip effects (no mutation, optional log message)
  - `// why:` comment: WP-022 skipped all conditional effects; WP-023
    evaluates them deterministically

### C) `src/types.ts` — modified (if needed)

- Re-export condition evaluator types if needed for test access

### D) `src/index.ts` — modified

- Export `evaluateCondition`, `evaluateAllConditions`

### E) Tests — `src/hero/heroConditions.evaluate.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Ten tests:
  1. `requiresTeam` passes when matching team card in `inPlay`
  2. `requiresTeam` fails when no matching team card in `inPlay`
  3. `requiresColor` passes when matching hero class in `inPlay`
  4. `requiresColor` fails when no matching hero class
  5. `requiresKeyword` passes when matching keyword on played card
  6. `playedThisTurn` passes when enough cards played
  7. `playedThisTurn` fails when too few cards played
  8. Unsupported condition type: returns `false` (safe skip)
  9. `evaluateAllConditions` with empty conditions: returns `true`
  10. `evaluateAllConditions` with mixed pass/fail: returns `false` (AND logic)

### F) Tests — `src/hero/heroEffects.conditional.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Five tests:
  1. Conditional effect with met conditions: effect executes
  2. Conditional effect with unmet conditions: effect skipped, no G mutation
  3. Multiple effects on one card, some conditional: only met ones execute
  4. Condition evaluation does not mutate `G` (deep equality check)
  5. `JSON.stringify(G)` succeeds after conditional execution

---

## Out of Scope

- **No new condition types beyond the 4 listed** — future packets
- **No multi-step hero chains** — future packets
- **No Patrol, Ambush, Guard keywords** — WP-025
- **No scheme or mastermind ability execution** — WP-024
- **No target selection UI** — future packets
- **No hidden information access** — conditions cannot read opponent zones
- **No balance tuning** — condition logic reads data as-is
- **No persistence / database access**
- **No server or UI changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **new** —
  condition evaluators
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** —
  integrate condition evaluation into effect execution
- `packages/game-engine/src/index.ts` — **modified** — export evaluators
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **new** —
  condition evaluator unit tests
- `packages/game-engine/src/hero/heroEffects.conditional.test.ts` — **new** —
  conditional execution integration tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Condition Evaluation
- [ ] `requiresTeam` correctly evaluates against played cards
- [ ] `requiresColor` correctly evaluates against hero class
- [ ] `requiresKeyword` correctly evaluates against played card hooks
- [ ] `playedThisTurn` correctly evaluates card count
- [ ] Unsupported condition type returns `false` (safe skip)
- [ ] `evaluateAllConditions` returns `true` only when ALL pass
- [ ] Empty conditions array returns `true` (unconditional)

### Safety
- [ ] Conditions NEVER mutate `G` (confirmed by deep equality test)
- [ ] No hidden information accessed (no opponent hand reads)
- [ ] No crashes on unsupported conditions

### Integration
- [ ] Conditional effects with met conditions execute correctly
- [ ] Conditional effects with unmet conditions are skipped — no mutation
- [ ] Execution order unchanged from WP-022

### Pure Helpers
- [ ] `heroConditions.evaluate.ts` has no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in condition evaluation
      (confirmed with `Select-String`)
- [ ] No registry import in any new file
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Condition evaluator tests cover all 4 types + unsupported
- [ ] Integration test confirms conditional execution + skip
- [ ] All test files use `.test.ts` and `makeMockCtx`
- [ ] No boardgame.io import in test files (confirmed with `Select-String`)

### Scope Enforcement
- [ ] WP-021 contract files not modified
      (confirmed with `git diff --name-only`)
- [ ] No new condition types beyond the 4 listed
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding conditional evaluation
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in condition evaluator
Select-String -Path "packages\game-engine\src\hero\heroConditions.evaluate.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm no registry import
Select-String -Path "packages\game-engine\src\hero" -Pattern "@legendary-arena/registry" -Recurse
# Expected: no output

# Step 5 — confirm no .reduce() in condition logic
Select-String -Path "packages\game-engine\src\hero\heroConditions.evaluate.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 6 — confirm WP-021 contracts not modified
git diff --name-only packages/game-engine/src/rules/heroAbility.types.ts packages/game-engine/src/rules/heroKeywords.ts
# Expected: no output

# Step 7 — confirm no require()
Select-String -Path "packages\game-engine\src\hero" -Pattern "require(" -Recurse
# Expected: no output

# Step 8 — confirm no files outside scope were changed
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
- [ ] No boardgame.io import in condition evaluator
      (confirmed with `Select-String`)
- [ ] No registry import in hero files (confirmed with `Select-String`)
- [ ] No `.reduce()` in condition logic (confirmed with `Select-String`)
- [ ] WP-021 contracts not modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — conditional hero effects now execute;
      team/class/keyword synergies work; WP-024 is unblocked
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why only 4 condition types
      in MVP; why conditions use AND logic (all must pass); why conditions
      never mutate state; how team/class data is accessed at runtime
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-023 checked off with today's date
