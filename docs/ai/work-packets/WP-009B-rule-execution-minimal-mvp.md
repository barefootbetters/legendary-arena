# WP-009B — Scheme & Mastermind Rule Execution (Minimal MVP)

**Status:** Ready
**Primary Layer:** Game Engine / Rules Runtime
**Dependencies:** WP-009A

---

## Session Context

WP-009A locked the rule hook data contracts — `HookDefinition`, `RuleEffect`,
`RuleTriggerName`, and the three validators. `HookDefinition` is data-only;
handler functions are not stored in it. This packet implements the two-step
execution pipeline: `executeRuleHooks` collects `RuleEffect[]` from registered
hooks in deterministic order; `applyRuleEffects` applies them to `G` with
`for...of`. The `ImplementationMap` pattern — handler functions keyed by hook
`id`, living outside `G` — is established here and used by every subsequent
rules packet.

---

## Goal

Implement a minimal, deterministic rule execution pipeline for scheme and
mastermind hooks based on the contracts from WP-009A.

After this session:
- `executeRuleHooks` collects `RuleEffect[]` without modifying `G`
- `applyRuleEffects` applies effects in sequence using `for...of`
- Unknown effect types push a warning to `G.messages` — no throw
- `G.messages`, `G.counters`, and `G.hookRegistry` are part of
  `LegendaryGameState`
- Default scheme and mastermind hooks respond to `onTurnStart` and `onTurnEnd`
  and produce observable changes in `G.messages`
- Ordering and integration tests prove determinism end-to-end

---

## Assumes

- WP-009A complete. Specifically:
  - `packages/game-engine/src/rules/ruleHooks.types.ts` exports
    `RuleTriggerName`, `RuleEffect`, `HookDefinition`, `HookRegistry`,
    `RULE_TRIGGER_NAMES` (WP-009A)
  - `packages/game-engine/src/rules/ruleHooks.validate.ts` exports
    `validateRuleEffect` (WP-009A)
  - `packages/game-engine/src/rules/ruleHooks.registry.ts` exports
    `createHookRegistry`, `getHooksForTrigger` (WP-009A)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `packages/game-engine/src/moves/zoneOps.ts` exports `moveAllCards` (WP-008B)
- `packages/game-engine/src/game.ts` has `G.currentStage` tracked and
  `advanceStage` wired in the `play` phase (WP-007B)
- `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Rule Execution Pipeline"
  subsection in full. It describes the complete `HookDefinition` →
  `ImplementationMap` → `executeRuleHooks` → `applyRuleEffects` architecture,
  why handler functions live outside `G`, and why the two-step execute-then-apply
  design is required. This is the authoritative reference for every design
  decision in this packet.
- `packages/game-engine/src/rules/ruleHooks.types.ts` — read entirely.
  `RuleEffect`, `HookDefinition`, and `HookRegistry` are the primary types this
  packet operates on. The `ImplementationMap` maps data-only `HookDefinition`
  entries to handler functions — it must not add functions to `HookDefinition`
  itself.
- `packages/game-engine/src/rules/ruleHooks.registry.ts` — `getHooksForTrigger`
  handles filtering and sorting. `executeRuleHooks` calls it — do not duplicate
  the sort logic.
- `packages/game-engine/src/moves/zoneOps.ts` — `moveAllCards`. The
  `discardHand` effect uses this; do not reimplement zone movement.
- `packages/game-engine/src/game.ts` — read entirely before modifying. The
  `onTurnStart` and `onTurnEnd` triggers must be wired into boardgame.io
  lifecycle hooks (`turn.onBegin` / `turn.onEnd`). Understand the existing
  structure before adding the wiring.
- `docs/ai/REFERENCE/00.2-data-requirements.md §2.9` — rules text for real
  schemes and masterminds comes from PostgreSQL at server startup; it is not
  queried inside move functions. This packet uses minimal stub implementations
  only.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable:
  no DB queries inside move functions; `ImplementationMap` is built once at
  startup and passed in as an argument — never stored in `G`.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 5 (30-line limit
  — extract a named helper per effect type in `applyRuleEffects` if needed),
  Rule 6 (`// why:` on the ImplementationMap pattern and `ctx.events` calls),
  Rule 8 (no `.reduce()` in effect application — use `for...of`), Rule 13
  (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions; `hookRegistry` is `HookDefinition[]` (data-only)
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in the rules runtime or move functions
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `executeRuleHooks` returns `RuleEffect[]` without modifying `G` — it only
  reads `G`; effects are applied separately by `applyRuleEffects`
- `applyRuleEffects` uses `for...of` — never `.reduce()`
- Unknown effect types push a structured warning to `G.messages` — never throw
- `ImplementationMap` handler functions live outside `G` — they must never be
  assigned to any field of `G` or stored in `hookRegistry`
- No `boardgame.io` import in any file under `src/rules/`
- WP-009A contract files (`ruleHooks.types.ts`, `ruleHooks.validate.ts`,
  `ruleHooks.registry.ts`) must not be modified in this packet
- Integration tests use `makeMockCtx` from `src/test/mockCtx.ts` — never
  import from `boardgame.io` or `boardgame.io/testing`

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **New LegendaryGameState fields** (this packet adds exactly these 3 fields
  to `LegendaryGameState` — use these exact names; initialized in `Game.setup()`):
  `messages: string[]` (init: `[]`) |
  `counters: Record<string, number>` (init: `{}`) |
  `hookRegistry: HookDefinition[]` (init: from `buildDefaultHookDefinitions`)

- **PlayerZones keys** (the `discardHand` effect calls `moveAllCards` on
  specific zone names — use these exact keys from WP-006A):
  `hand` → `discard` (the `discardHand` effect moves all of `player.zones.hand`
  into `player.zones.discard`)

- **Default implementation message strings** (integration test asserts exact
  string equality — do not paraphrase or alter):
  Scheme `onTurnStart`: `'Scheme: turn started.'`
  Mastermind `onTurnEnd`: `'Mastermind: turn ended.'`

---

## Scope (In)

### A) `src/rules/ruleRuntime.execute.ts` — new
- `type ImplementationMap = Record<string, (G: LegendaryGameState, ctx: Ctx, payload: unknown) => RuleEffect[]>`
- `executeRuleHooks(G, ctx, triggerName, payload, registry, implementationMap): RuleEffect[]`
  1. Calls `getHooksForTrigger(registry, triggerName)` — gets sorted definitions
  2. For each definition: looks up handler in `implementationMap` by
     `definition.id`; if no handler found, logs a warning and skips (no throw)
  3. Calls handler and accumulates `RuleEffect[]`
  4. Returns the flat combined array in hook order
- `// why:` comment: returning effects without applying them lets tests assert
  what would happen without modifying `G`; it also allows callers to inspect,
  filter, or replay the effect list before application
- No `boardgame.io` import

### B) `src/rules/ruleRuntime.effects.ts` — new
- `applyRuleEffects(G: LegendaryGameState, ctx: Ctx, effects: RuleEffect[]): LegendaryGameState`
  — applies effects in sequence using `for...of`; returns updated `G`:
  - `queueMessage`: `G.messages.push(effect.message)`
  - `modifyCounter`: `G.counters[effect.counter] = (G.counters[effect.counter] ?? 0) + effect.delta`
  - `drawCards`: calls the shared draw helper from `coreMoves.impl.ts`
  - `discardHand`: calls `moveAllCards` from `zoneOps.ts` (hand → discard)
  - Unknown effect type: push a structured warning to `G.messages` — do not
    throw
- `// why:` comment on the unknown-type handler: new effect types added in
  later packets should fail gracefully in older runtime versions rather than
  crashing
- No `.reduce()` calls anywhere in this file
- No `boardgame.io` import

### C) `src/rules/ruleRuntime.impl.ts` — new (minimal default implementations)
- `DEFAULT_SCHEME_HOOK_ID = 'default-scheme-hook'`
- `DEFAULT_MASTERMIND_HOOK_ID = 'default-mastermind-hook'`
- `defaultSchemeImplementation(G, ctx, payload): RuleEffect[]`
  — responds to `onTurnStart`; returns:
  `[{ type: 'queueMessage', message: 'Scheme: turn started.' }, { type: 'modifyCounter', counter: 'schemeTwistCount', delta: 0 }]`
- `defaultMastermindImplementation(G, ctx, payload): RuleEffect[]`
  — responds to `onTurnEnd`; returns:
  `[{ type: 'queueMessage', message: 'Mastermind: turn ended.' }, { type: 'modifyCounter', counter: 'masterStrikeCount', delta: 0 }]`
- `DEFAULT_IMPLEMENTATION_MAP: ImplementationMap` — maps both hook IDs to
  their implementations
- `buildDefaultHookDefinitions(matchSetupConfig): HookDefinition[]` — builds
  two `HookDefinition` entries using `schemeId` and `mastermindId` from the
  setup config as `sourceId`
- No database, network, or filesystem access

### D) `src/types.ts` — modified
- Add to `LegendaryGameState`:
  - `messages: string[]` — deterministic event log; initialized to `[]` in
    setup
  - `counters: Record<string, number>` — initialized to `{}` in setup
  - `hookRegistry: HookDefinition[]` — definitions only (JSON-serializable);
    handler functions live in `ImplementationMap` outside `G`

### E) `src/game.ts` — modified
- `Game.setup()` calls `buildDefaultHookDefinitions(matchData)`, builds a
  `HookRegistry`, stores definitions in `G.hookRegistry` as
  `HookDefinition[]`; initializes `G.messages = []` and `G.counters = {}`
- Wire `onTurnStart` trigger: in `play` phase `turn.onBegin`, call
  `executeRuleHooks` then `applyRuleEffects`
- Wire `onTurnEnd` trigger: in `play` phase `turn.onEnd`, call
  `executeRuleHooks` then `applyRuleEffects`
- `// why:` comment on both wiring points: explains the trigger → collect
  effects → apply effects pipeline
- `ImplementationMap` is passed as a local variable to the lifecycle hooks —
  never assigned to `G`

### F) `src/index.ts` — modified
- Export `ImplementationMap`, `executeRuleHooks`, `applyRuleEffects`,
  `buildDefaultHookDefinitions` as named exports

### G) Tests

**`src/rules/ruleRuntime.ordering.test.ts`** — new:
- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no `boardgame.io`
  import
- Three tests:
  1. Two hooks with different priorities — lower priority hook's effects appear
     first in the result
  2. Two hooks with equal priority — tie broken by `id` lexically
  3. Hook with no matching handler in `implementationMap` is skipped gracefully
     — no throw, remaining hooks still fire

**`src/rules/ruleRuntime.integration.test.ts`** — new:
- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no `boardgame.io`
  import
- Build a `G` with `messages: []`, `counters: {}`, `hookRegistry` from
  `buildDefaultHookDefinitions`
- Call `executeRuleHooks` for `onTurnStart` with `DEFAULT_IMPLEMENTATION_MAP`
- Call `applyRuleEffects` with the returned effects
- Assert `G.messages` contains `'Scheme: turn started.'`
- Repeat for `onTurnEnd` — assert `'Mastermind: turn ended.'` appears
- Assert `JSON.stringify(G)` succeeds after all effects applied

---

## Out of Scope

- No implementation of specific printed scheme twist or mastermind strike card
  text
- No villain deck, city, HQ, or KO logic
- `onSchemeTwistRevealed` and `onMastermindStrikeRevealed` triggers exist as
  types but are not wired yet — that is a later packet
- No rules glossary lookups from `legendary.rule_docs`
- No persistence or PostgreSQL access
- No server or UI changes
- WP-009A contract files (`ruleHooks.types.ts`, `ruleHooks.validate.ts`,
  `ruleHooks.registry.ts`) must not be modified
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/rules/ruleRuntime.execute.ts` — **new** —
  deterministic hook execution
- `packages/game-engine/src/rules/ruleRuntime.effects.ts` — **new** — effect
  applicator
- `packages/game-engine/src/rules/ruleRuntime.impl.ts` — **new** — default
  stub implementations
- `packages/game-engine/src/types.ts` — **modified** — add `messages`,
  `counters`, `hookRegistry` to `LegendaryGameState`
- `packages/game-engine/src/game.ts` — **modified** — wire triggers and
  initialize new `G` fields in setup
- `packages/game-engine/src/index.ts` — **modified** — export runtime types
  and functions
- `packages/game-engine/src/rules/ruleRuntime.ordering.test.ts` — **new** —
  ordering tests
- `packages/game-engine/src/rules/ruleRuntime.integration.test.ts` — **new** —
  end-to-end integration tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Runtime State Additions
- [ ] `LegendaryGameState` has `messages: string[]`
- [ ] `LegendaryGameState` has `counters: Record<string, number>`
- [ ] `LegendaryGameState` has `hookRegistry: HookDefinition[]`
- [ ] `Game.setup()` initializes `messages: []`, `counters: {}`, and
      `hookRegistry` from `buildDefaultHookDefinitions(matchData)`
- [ ] `JSON.stringify(G)` succeeds after setup — no functions in `G`

### Hook Execution
- [ ] `executeRuleHooks` returns `RuleEffect[]` without modifying `G` —
      calling it twice with the same args produces the same `G` both times
- [ ] `executeRuleHooks` calls `getHooksForTrigger` — no duplicate sort logic
      in `ruleRuntime.execute.ts`
      (confirmed with `Select-String` for `.sort(` in the file)
- [ ] A hook with no matching handler is skipped — no throw, no crash

### Effect Application
- [ ] `applyRuleEffects` with `{ type: 'queueMessage', message: 'hello' }`
      appends `'hello'` to `G.messages`
- [ ] `applyRuleEffects` with `{ type: 'modifyCounter', counter: 'twists', delta: 1 }`
      sets `G.counters.twists` to `1`
- [ ] `applyRuleEffects` with an unknown `type` does not throw
      (confirmed with `Select-String` for `throw` in `ruleRuntime.effects.ts`)
- [ ] `applyRuleEffects` uses `for...of` — no `.reduce()` call
      (confirmed with `Select-String`)

### MVP Implementations and Wiring
- [ ] After `onTurnStart` fires, `G.messages` contains
      `'Scheme: turn started.'`
- [ ] After `onTurnEnd` fires, `G.messages` contains
      `'Mastermind: turn ended.'`
- [ ] `ruleRuntime.impl.ts` has no database, network, or filesystem access
      (confirmed with `Select-String` for `fetch`, `pg`, `readFile`)
- [ ] `ImplementationMap` is not assigned to any field of `G`
      (confirmed by reading `game.ts`)

### WP-009A Contract Protection
- [ ] `src/rules/ruleHooks.types.ts` was not modified
      (confirmed with `git diff --name-only`)
- [ ] `src/rules/ruleHooks.validate.ts` was not modified
      (confirmed with `git diff --name-only`)
- [ ] `src/rules/ruleHooks.registry.ts` was not modified
      (confirmed with `git diff --name-only`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test
      files, including WP-009A contract tests)
- [ ] Ordering test proves priority-then-id determinism with at least 2 hooks
- [ ] Integration test asserts both `messages` entries appear after trigger and
      apply
- [ ] Both test files use `makeMockCtx` from `src/test/mockCtx.ts`
- [ ] Neither test file imports from `boardgame.io` or `boardgame.io/testing`
      (confirmed with `Select-String`)

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after wiring changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no throw in effect applicator
Select-String -Path "packages\game-engine\src\rules\ruleRuntime.effects.ts" -Pattern "throw "
# Expected: no output

# Step 4 — confirm no .reduce() in effect applicator
Select-String -Path "packages\game-engine\src\rules\ruleRuntime.effects.ts" -Pattern "\.reduce("
# Expected: no output

# Step 5 — confirm executeRuleHooks has no duplicate sort logic
Select-String -Path "packages\game-engine\src\rules\ruleRuntime.execute.ts" -Pattern "\.sort("
# Expected: no output (sorting happens in getHooksForTrigger from WP-009A)

# Step 6 — confirm WP-009A contract files were not modified
git diff --name-only packages/game-engine/src/rules/ruleHooks.types.ts packages/game-engine/src/rules/ruleHooks.validate.ts packages/game-engine/src/rules/ruleHooks.registry.ts
# Expected: no output (all three files untouched)

# Step 7 — confirm no IO access in implementations
Select-String -Path "packages\game-engine\src\rules\ruleRuntime.impl.ts" -Pattern "fetch|readFile|pg\."
# Expected: no output

# Step 8 — confirm no require() in any generated file
Select-String -Path "packages\game-engine\src\rules" -Pattern "require(" -Recurse
# Expected: no output

# Step 9 — confirm no files outside scope were changed
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
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files,
      including WP-009A contract tests)
- [ ] No `throw` in `ruleRuntime.effects.ts` (confirmed with `Select-String`)
- [ ] No `.reduce(` in `ruleRuntime.effects.ts` (confirmed with `Select-String`)
- [ ] No `.sort(` in `ruleRuntime.execute.ts` (confirmed with `Select-String`)
- [ ] No IO access in `ruleRuntime.impl.ts` (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] WP-009A contract files were not modified
      (confirmed with `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what the rules pipeline can do; what a
      match produces on each turn start/end
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: the `ImplementationMap`
      pattern (why handler functions are separate from `HookDefinition`); why
      `executeRuleHooks` and `applyRuleEffects` are two separate functions
      rather than one; why unknown effect types are handled gracefully rather
      than thrown
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-009B checked off with today's date
