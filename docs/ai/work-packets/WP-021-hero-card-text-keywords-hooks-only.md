# WP-021 — Hero Card Text & Keywords (Hooks Only)

**Status:** Ready  
**Primary Layer:** Game Engine / Rules (Hero Abilities — Contracts Only)  
**Dependencies:** WP-020

---

## Session Context

WP-009A/009B established the `HookDefinition` + `ImplementationMap` rule
execution pipeline for scheme and mastermind hooks. WP-018 through WP-020
completed the MVP economy, mastermind fight, and VP scoring. This packet
introduces the equivalent representation layer for hero card abilities — a
data-only hook contract and keyword taxonomy that maps hero cards to structured
declarations. **No hero ability logic is executed in this packet.** Execution
is deferred to WP-022+. This packet must remain inert by design.

---

## Goal

Introduce a canonical, deterministic representation of hero card abilities
using hooks and keywords, without executing their effects. After this session:

- `HeroAbilityHook` is a data-only interface (no functions, no closures) that
  maps a hero card to its timing, keywords, conditions, and effect descriptors
- `HeroKeyword` is a closed canonical union of semantic labels
- `G.heroAbilityHooks: HeroAbilityHook[]` is built at setup time from registry
  data and stored in `G` (immutable during gameplay)
- The rule engine can observe, query, and filter hero hooks by timing/keyword
- No hero ability produces gameplay effects — execution is WP-022+
- Future packets can add execution without refactoring the hook contract

---

## Assumes

- WP-020 complete. Specifically:
  - `packages/game-engine/src/rules/ruleHooks.types.ts` exports
    `RuleTriggerName`, `HookDefinition` (WP-009A)
  - `packages/game-engine/src/rules/ruleRuntime.execute.ts` exports
    `executeRuleHooks` (WP-009B)
  - `packages/game-engine/src/economy/economy.types.ts` exports `TurnEconomy`,
    `CardStatEntry` (WP-018)
  - `G.cardStats` exists (WP-018) — hero card stat values resolved at setup
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- Card data includes hero cards with `abilities: string[]` arrays containing
  ability text markup (`[keyword:X]`, `[icon:X]`, `[hc:X]`)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Rule Execution Pipeline".
  `HeroAbilityHook` follows the same data-only pattern as `HookDefinition`:
  data lives in `G`, handler functions live outside `G` (added in WP-022+).
  This packet adds the data layer only.
- `docs/ai/ARCHITECTURE.md §Section 2` — read "Card Data Flow: Registry into
  Game Engine". Hero ability hooks are resolved at setup time from registry
  data, stored in `G`, and never recomputed during moves. Same pattern as
  `G.villainDeckCardTypes` and `G.cardStats`.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — hero ability
  hooks are game-engine layer only. Registry provides data at setup time.
  No server, persistence, or UI concerns.
- `packages/game-engine/src/rules/ruleHooks.types.ts` — read `HookDefinition`.
  `HeroAbilityHook` follows the same philosophy: data-only, JSON-serializable,
  no functions.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `heroKeyword` not `hk`), Rule 6 (`// why:` on the hooks-only design and
  on the closed keyword union), Rule 8 (no `.reduce()`), Rule 13 (ESM only).

**Critical design note — this packet is inert by design:**
`HeroAbilityHook` describes what a hero card *can* do. It does not *do* it.
No game state changes result from hero hooks in this packet. The hooks are
observation-only data that WP-022+ will attach execution logic to via an
`ImplementationMap`-style pattern.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — hook setup involves no randomness
- Never throw inside move functions — this packet adds no moves
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
- Registry boundary (hard rule): the game engine must NOT import
  `@legendary-arena/registry` at module scope. Registry data is provided to
  setup as a parameter and used only during setup-time helpers such as
  `buildHeroAbilityHooks`. Moves must never query the registry.
- `HeroAbilityHook` is **data-only** — no functions, no closures, no handler
  references. Fully JSON-serializable.
- `HeroKeyword` is a **closed canonical union** — adding a new keyword requires
  a `DECISIONS.md` entry and updating both the union type and the canonical
  array (drift-detection test required)
- `G.heroAbilityHooks` is built at setup time and **immutable during gameplay**
  — moves must never modify it
- `cardId` in `HeroAbilityHook` must be a hero card `CardExtId`
- Timing values use `HeroAbilityTiming` closed union — same drift-detection
  pattern as `HeroKeyword`. Declarative labels only — no execution semantics
  are attached in this packet
- Effects are **descriptors, not functions** — `HeroEffectDescriptor` describes
  what an effect would do; it does not do it
- Conditions are **declarative** — `HeroCondition` describes when an effect
  applies; no evaluation logic is implemented
- No `.reduce()` in hook construction — use `for...of`
- Tests use `makeMockCtx` or plain mocks — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values:**

- **HeroAbilityTiming closed union:**
  ```ts
  type HeroAbilityTiming =
    | 'onPlay'
    | 'onFight'
    | 'onRecruit'
    | 'onKO'
    | 'onReveal'
  ```

- **HERO_ABILITY_TIMINGS canonical array:**
  ```ts
  const HERO_ABILITY_TIMINGS: readonly HeroAbilityTiming[] = [
    'onPlay',
    'onFight',
    'onRecruit',
    'onKO',
    'onReveal',
  ] as const;
  ```

- **HeroAbilityHook shape:**
  ```ts
  interface HeroAbilityHook {
    cardId: CardExtId
    timing: HeroAbilityTiming
    keywords: HeroKeyword[]
    conditions?: HeroCondition[]
    effects?: HeroEffectDescriptor[]
  }
  ```

- **HeroKeyword closed union:**
  ```ts
  type HeroKeyword =
    | 'draw'
    | 'attack'
    | 'recruit'
    | 'ko'
    | 'rescue'
    | 'wound'
    | 'reveal'
    | 'conditional'
  ```

---

## Scope (In)

### A) `src/rules/heroAbility.types.ts` — new

- `interface HeroAbilityHook` — data-only hook contract as specified in locked
  contract values above
- `interface HeroCondition` — declarative condition descriptor (MVP: type label
  only, e.g., `{ type: 'heroClassMatch'; value: string }`)
- `interface HeroEffectDescriptor` — declarative effect descriptor (MVP:
  `{ type: HeroKeyword; magnitude?: number }`)
- `// why:` comments:
  - `cardId` must be a hero card `CardExtId`
  - Timing is declarative only — no execution
  - Effects are descriptors, not functions
  - Hooks are immutable after setup

### B) `src/rules/heroKeywords.ts` — new

- `type HeroKeyword` — closed union as specified in locked contract values
- `const HERO_KEYWORDS: readonly HeroKeyword[]` — canonical array for
  drift-detection
- `type HeroAbilityTiming` — closed union as specified in locked contract values
- `const HERO_ABILITY_TIMINGS: readonly HeroAbilityTiming[]` — canonical
  array for drift-detection
- Drift-detection tests required: both arrays must match their union types
  exactly
- `// why:` comment: keywords are semantic labels only; they do not imply
  magnitude or effect. Adding a new keyword requires a `DECISIONS.md` entry
  and updating both the type and the array. Same rule applies to timings.

### C) `src/setup/heroAbility.setup.ts` — new

- `buildHeroAbilityHooks(registry: CardRegistryReader, matchConfig: MatchSetupConfig): HeroAbilityHook[]`
  — called during `Game.setup()`:
  1. Resolve hero cards from selected hero decks in registry
  2. Extract hero text metadata (ability text is already normalized in registry)
  3. Build a list of `HeroAbilityHook` entries from ability text
  4. Return the list (stored as `G.heroAbilityHooks`)
  - Setup-time only — never recomputed in moves
  - No parsing of natural language — uses structured ability metadata from
    registry
  - No side effects
  - Uses `for...of` (no `.reduce()`)
  - `// why:` comment on setup-time-only pattern
  - Output must be deterministic: identical registry + matchConfig inputs
    produce byte-identical JSON output order

**Registry Field Constraint:** `buildHeroAbilityHooks` may only rely on:
- `cardId` / `key` (CardExtId)
- `abilities: string[]` (structured markup text)
- deck or set membership (to match `heroDeckIds`)

If the registry provides richer data, it must be ignored in WP-021.

**Timing Derivation Rules (Non-Negotiable):**
- If ability markup explicitly encodes timing (e.g., `[timing:onFight]`),
  use it
- Otherwise, **always assign `'onPlay'`**
- Do not infer timing from natural-language phrasing
- Do not interpret words like "fight", "recruit", or "reveal" as timing cues

**Ability Parsing Order (Authoritative):**
Ability text is processed in the following fixed order:
1. Extract `[hc:X]` condition markup -> `HeroCondition` entries
2. Extract `[keyword:X]` markup -> `HeroKeyword` entries
3. Extract `[icon:X]` markup -> `HeroKeyword` entries
4. Perform final keyword normalization (dedup, validate against union)
5. Assign timing (per Timing Derivation Rules above)

No step may depend on results of a later step.

**Magnitude Constraint:** Do not extract numeric magnitude from
natural-language phrasing (e.g., "Draw two cards" does NOT produce
`magnitude: 2`). Only structured markup with explicit numeric values
may populate `HeroEffectDescriptor.magnitude`. If no structured markup
provides a magnitude, omit it.

**Keywords vs Effects:** `keywords` are labels only. They do not imply
that a matching `HeroEffectDescriptor` must exist for that ability.
A hook may have keywords but no effects, or effects but no keywords.

### D) Rule Engine Integration (Observation Only)

- Expose hero hooks to the rule engine so that:
  - Hooks can be observed (iterated, inspected)
  - Hooks can be queried (filtered by `timing` or `keyword`)
  - Hooks can be filtered for a specific card
- But:
  - No hero hook produces effects
  - No rule execution is triggered
  - Execution is deferred to WP-022+
- Implementation: utility functions in `heroAbility.types.ts` or a small
  helper file that filter `G.heroAbilityHooks` — pure, read-only

### E) `src/types.ts` — modified

- Add `heroAbilityHooks: HeroAbilityHook[]` to `LegendaryGameState`
- Re-export `HeroAbilityHook`, `HeroKeyword`, `HeroAbilityTiming`,
  `HeroCondition`, `HeroEffectDescriptor`

### F) `src/index.ts` — modified

- Export `HeroAbilityHook`, `HeroKeyword`, `HERO_KEYWORDS`,
  `HeroAbilityTiming`, `HERO_ABILITY_TIMINGS`, `HeroCondition`,
  `HeroEffectDescriptor`, `buildHeroAbilityHooks`

### G) Tests — `src/rules/heroAbility.setup.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Eight tests:
  1. `buildHeroAbilityHooks` produces a non-empty array for valid hero decks
  2. Every hook has a valid `cardId` (CardExtId string)
  3. Every hook has a valid `timing` value from `HERO_ABILITY_TIMINGS`
  4. Every hook's `keywords` are from the `HeroKeyword` union
  5. `JSON.stringify(hooks)` succeeds (fully serializable)
  6. Drift: `HERO_KEYWORDS` array matches union type exactly
     — `// why:` comment on drift detection
  7. Determinism: calling `buildHeroAbilityHooks` twice with the same mock
     input produces `JSON.stringify`-identical output
  8. Drift: `HERO_ABILITY_TIMINGS` array matches `HeroAbilityTiming` union
     exactly — same pattern as HERO_KEYWORDS drift detection

---

## AI Agent Warning (Strict)

This WP is satisfiable without interpreting gameplay intent. If you believe
an ability "should do something", that belief is irrelevant in WP-021.
Record structure only. Do not produce:
- Keywords inferred solely from English text (only `[keyword:X]`, `[icon:X]`
  markup)
- Effects with implied magnitude without explicit numeric markup
- Timing derived from phrase interpretation (e.g., "fight" does NOT imply
  `'onFight'`)

---

## Out of Scope

- **No execution of hero abilities** — WP-022 adds that
- **No conditional logic resolution** — conditions are declarative labels only
- **No keyword semantics** — keywords are labels, not behavior
- **No timing windows beyond labels** — `'onPlay'` means "this triggers on
  play" but no trigger fires in this packet
- **No UI changes**
- **No persistence / database access**
- **No balance tuning**
- **No server changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroAbility.types.ts` — **new** —
  HeroAbilityHook, HeroCondition, HeroEffectDescriptor
- `packages/game-engine/src/rules/heroKeywords.ts` — **new** — HeroKeyword
  union, HERO_KEYWORDS canonical array
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **new** —
  buildHeroAbilityHooks
- `packages/game-engine/src/types.ts` — **modified** — adds heroAbilityHooks
  to LegendaryGameState
- `packages/game-engine/src/index.ts` — **modified** — exports types and setup
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **new** — tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Hero Ability Representation
- [ ] `HeroAbilityHook` is data-only and JSON-serializable
- [ ] No functions or closures stored in `G`
- [ ] Hooks reference hero cards by `CardExtId` only
- [ ] `// why:` comments on data-only design and immutability

### Keyword & Timing Taxonomy
- [ ] `HeroKeyword` union is closed and canonical
- [ ] `HERO_KEYWORDS` canonical array matches union exactly
- [ ] `HeroAbilityTiming` union is closed and canonical
- [ ] `HERO_ABILITY_TIMINGS` canonical array matches union exactly
- [ ] Drift-detection tests exist for both with `// why:` comments
- [ ] No duplicate or ad-hoc keywords or timings

### Setup Integration
- [ ] Hooks are built at setup time via `buildHeroAbilityHooks`
- [ ] Hooks are deterministic for identical inputs (test exists: same input
      produces `JSON.stringify`-identical output)
- [ ] Hooks are immutable during gameplay (never modified by moves)
- [ ] No registry import in move or type files
      (confirmed with `Select-String`)
- [ ] `buildHeroAbilityHooks` uses only `cardId`/`key`, `abilities: string[]`,
      and deck membership from registry — no other fields consumed

### Rule Engine Observation
- [ ] Hero hooks can be queried/filtered (utility functions exist)
- [ ] No hero hook produces gameplay effects
- [ ] No mutation of `G` based on hero hooks

### Scope Enforcement
- [ ] No hero ability effects are executed
- [ ] No registry access after setup
- [ ] No `.reduce()` in hook construction
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file
      (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding hero hooks
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in hero ability files
Select-String -Path "packages\game-engine\src\rules\heroAbility.types.ts","packages\game-engine\src\rules\heroKeywords.ts","packages\game-engine\src\setup\heroAbility.setup.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm no registry import in type files
Select-String -Path "packages\game-engine\src\rules\heroAbility.types.ts","packages\game-engine\src\rules\heroKeywords.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 5 — confirm no .reduce() in setup
Select-String -Path "packages\game-engine\src\setup\heroAbility.setup.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 6 — confirm HERO_KEYWORDS and HERO_ABILITY_TIMINGS drift tests exist
Select-String -Path "packages\game-engine\src\rules\heroAbility.setup.test.ts" -Pattern "HERO_KEYWORDS"
# Expected: at least one match
Select-String -Path "packages\game-engine\src\rules\heroAbility.setup.test.ts" -Pattern "HERO_ABILITY_TIMINGS"
# Expected: at least one match

# Step 7 — confirm heroAbilityHooks is JSON-serializable
Select-String -Path "packages\game-engine\src\rules\heroAbility.setup.test.ts" -Pattern "JSON.stringify"
# Expected: at least one match

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
- [ ] Hero card text is represented as structured hooks
- [ ] Keywords are normalized and versioned (drift-detection test passes)
- [ ] The rule engine can observe hero hooks (query/filter utilities exist)
- [ ] No hero abilities execute effects
- [ ] No boardgame.io import in hero ability files
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in hook construction (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — hero ability hooks exist as data-only
      contracts; keywords are normalized; WP-022 is unblocked for execution
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why hooks are data-only
      (same pattern as `HookDefinition`); why keyword union is closed (prevents
      ad-hoc additions); why timing union is closed (same pattern); why
      execution is deferred to WP-022+; why timing defaults to `'onPlay'`
      (no NL inference). Use only factual language — no speculative words
      ("enables", "supports", "allows") in DECISIONS entries
- [ ] `docs/ai/ARCHITECTURE.md` updated — add `G.heroAbilityHooks` to the
      Field Classification Reference table in Section 3 (class: Runtime)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-021 checked off with today's date
- [ ] Future packets (WP-022+) can add execution without refactoring
- [ ] This packet remains inert by design
