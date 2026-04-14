# WP-024 — Scheme & Mastermind Ability Execution

**Status:** Ready  
**Primary Layer:** Game Engine / Rules Execution (Non-Hero Abilities)  
**Dependencies:** WP-023

---

## Session Context

WP-009A/009B established the `HookDefinition` + `ImplementationMap` rule
execution pipeline with triggers (`onCardRevealed`, `onSchemeTwistRevealed`,
`onMastermindStrikeRevealed`) and effects (`queueMessage`, `modifyCounter`,
`drawCards`, `discardHand`). WP-014 wired the villain reveal pipeline to emit
these triggers. WP-019 added mastermind tactics defeat. WP-022/023 added hero
keyword and conditional execution. This packet connects the scheme and
mastermind `ImplementationMap` handlers to produce real gameplay effects when
scheme twists and mastermind strikes are revealed. Schemes and masterminds use
the **same deterministic hook model** as hero cards — no new execution engine.

---

## Goal

Execute scheme and mastermind abilities through the existing rule hook pipeline.
After this session:

- Scheme twist effects execute when `onSchemeTwistRevealed` fires (via the
  reveal pipeline from WP-014)
- Mastermind strike effects execute when `onMastermindStrikeRevealed` fires
- Scheme-loss effects increment
  `G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS]` using the constant
- Mastermind tactic "fight" effects are handled as part of the existing
  `fightMastermind` flow (WP-019) — no new move is added
- `ImplementationMap` handlers for the selected scheme and mastermind are built
  at setup time and registered in memory (never stored in `G`)
- All execution is data-driven, deterministic, and replay-safe

---

## Assumes

- WP-023 complete. Specifically:
  - `packages/game-engine/src/rules/ruleHooks.types.ts` exports
    `RuleTriggerName`, `RuleEffect`, `HookDefinition` (WP-009A)
  - `packages/game-engine/src/rules/ruleRuntime.execute.ts` exports
    `executeRuleHooks` (WP-009B)
  - `packages/game-engine/src/rules/ruleRuntime.effects.ts` exports
    `applyRuleEffects` (WP-009B)
  - `G.hookRegistry: HookDefinition[]` exists (WP-009B)
  - `ImplementationMap` pattern established (WP-009B) — handler functions
    live outside `G`
  - `packages/game-engine/src/endgame/endgame.types.ts` exports
    `ENDGAME_CONDITIONS` with `SCHEME_LOSS` key (WP-010)
  - `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` emits
    `onSchemeTwistRevealed` and `onMastermindStrikeRevealed` triggers (WP-014)
  - `packages/game-engine/src/mastermind/mastermind.types.ts` exports
    `MastermindState` (WP-019)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- Scheme and mastermind card data includes ability text — resolved at setup
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants" section
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Rule Execution Pipeline".
  This is the authoritative reference for the two-step pattern
  (`executeRuleHooks` collects effects, `applyRuleEffects` applies them).
  Scheme and mastermind handlers are `ImplementationMap` entries — they live
  outside `G`, never stored in state.
- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Endgame &
  Counters". Scheme-loss effects must increment
  `G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS]` using the constant, never the
  string literal.
- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Registry &
  Runtime Boundary". Scheme/mastermind ability data is resolved at setup time.
  Handlers are built at setup and registered in the `ImplementationMap`.
  No registry access at move time.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — scheme and
  mastermind execution is game-engine layer only.
- `packages/game-engine/src/rules/ruleRuntime.execute.ts` — read
  `executeRuleHooks`. Scheme/mastermind handlers are called through this
  existing function — no new execution path.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — read the
  trigger emission for scheme-twist and mastermind-strike. This packet's
  handlers fire when these triggers emit.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` on handler registration and on scheme-loss
  counter), Rule 8 (no `.reduce()`), Rule 13 (ESM only).

**Critical design note — no new execution engine:**
Schemes and masterminds produce effects through the SAME `executeRuleHooks` ->
`applyRuleEffects` pipeline as all other rule hooks. The only new work is
writing the `ImplementationMap` handler functions for the selected scheme and
mastermind and registering them at setup time. The pipeline itself is unchanged.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — no randomness in ability execution
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
- Registry boundary (hard rule): handler functions are built at setup time.
  No registry queries at move time.
- Handler functions live in `ImplementationMap` — **never stored in `G`**
- Scheme-loss effects must use `ENDGAME_CONDITIONS.SCHEME_LOSS` constant —
  never the string literal `'schemeLoss'`
- Scheme and mastermind hooks use the **existing** `HookDefinition` shape from
  WP-009A — do not define a new hook type
- Effect types use the **existing** `RuleEffect` types from WP-009A (`queueMessage`,
  `modifyCounter`, `drawCards`, `discardHand`) — do not define new effect types
  unless justified and logged in DECISIONS.md
- `applyRuleEffects` handles all effect application — no inline effect logic
  in handlers
- Unknown effect types push warning to `G.messages` and continue (never throw)
  — existing behavior from WP-009B
- WP-009A contract files (`ruleHooks.types.ts`) must not be modified unless
  adding a new effect type (with DECISIONS.md entry)
- WP-014 reveal pipeline must not be modified — handlers fire via existing
  trigger emission
- Tests use `makeMockCtx` — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **ENDGAME_CONDITIONS keys** (scheme-loss trigger):
  `SCHEME_LOSS = 'schemeLoss'`

- **Existing RuleTriggerName values** (handlers respond to these):
  `'onSchemeTwistRevealed'` | `'onMastermindStrikeRevealed'`

- **Existing RuleEffect types** (handlers produce these):
  `'queueMessage'` | `'modifyCounter'` | `'drawCards'` | `'discardHand'`

- **HookDefinition.kind values** (already defined in WP-009A):
  `'scheme'` | `'mastermind'`

---

## Scope (In)

### A) `src/rules/schemeHandlers.ts` — new

- MVP scheme handler functions for the `ImplementationMap`:
  - `schemeTwistHandler(G, ctx, payload): RuleEffect[]`
    — produces effects when a scheme twist is revealed
    - MVP: increment scheme twist counter via `modifyCounter` effect +
      queue message
    - If twist count reaches scheme-specific threshold: produce
      `modifyCounter` effect on `ENDGAME_CONDITIONS.SCHEME_LOSS`
    - `// why:` comment: scheme-loss is mediated through counters, not direct
      endgame calls
  - Returns `RuleEffect[]` — never mutates `G` directly

### B) `src/rules/mastermindHandlers.ts` — new

- MVP mastermind handler functions for the `ImplementationMap`:
  - `mastermindStrikeHandler(G, ctx, payload): RuleEffect[]`
    — produces effects when a mastermind strike is revealed
    - MVP: each player gains 1 wound via appropriate effects + queue message
    - `// why:` comment: MVP strike effect is simplified; full mastermind
      text abilities are future scope
  - Returns `RuleEffect[]` — never mutates `G` directly

### C) `src/rules/ruleRuntime.impl.ts` — modified

- Update `buildDefaultHookDefinitions(matchSetupConfig)` to use correct
  triggers for the selected scheme and mastermind:
  - Scheme hook: `kind: 'scheme'`, `sourceId: schemeId`,
    `triggers: ['onSchemeTwistRevealed']` (was `['onTurnStart']` stub)
  - Mastermind hook: `kind: 'mastermind'`, `sourceId: mastermindId`,
    `triggers: ['onMastermindStrikeRevealed']` (was `['onTurnEnd']` stub)
- These are stored in `G.hookRegistry` (data-only, JSON-serializable)
- Update `DEFAULT_IMPLEMENTATION_MAP` to map hook ids to the new real
  handler functions (`schemeTwistHandler`, `mastermindStrikeHandler`)
  instead of the stub implementations
- Remove or replace `defaultSchemeImplementation` and
  `defaultMastermindImplementation` stubs
- `ImplementationMap` lives in memory — **never stored in `G`**
- `// why:` comment: functions cannot be serialized; ImplementationMap is
  rebuilt each match from matchData

### E) `src/types.ts` — modified (if needed)

- Re-export any new types if needed for test access

### F) `src/index.ts` — modified

- Export `schemeTwistHandler`, `mastermindStrikeHandler`

### G) Tests — `src/rules/schemeHandlers.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Six tests:
  1. Scheme twist handler returns `RuleEffect[]` (not empty)
  2. Scheme twist handler produces `modifyCounter` effect for twist count
  3. Scheme twist at threshold produces `modifyCounter` on `SCHEME_LOSS`
  4. Handler does not mutate `G` (read-only — effects are returned, not applied)
  5. Handler uses `ENDGAME_CONDITIONS.SCHEME_LOSS` constant (not string literal)
  6. `JSON.stringify(effects)` succeeds (effects are serializable)

### H) Tests — `src/rules/mastermindHandlers.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Four tests:
  1. Mastermind strike handler returns `RuleEffect[]`
  2. Strike handler produces wound-related effects
  3. Handler does not mutate `G`
  4. `JSON.stringify(effects)` succeeds

---

## Out of Scope

- **No full scheme text parsing** — MVP uses simplified twist/loss logic;
  scheme-specific setup instructions are WP-026
- **No full mastermind text abilities** — MVP uses simplified strike effects
- **No tactic text effects on defeat** — tactics are defeated (WP-019) but
  their text doesn't execute in MVP
- **No new effect types** unless justified — use existing `queueMessage`,
  `modifyCounter`, `drawCards`, `discardHand`
- **No new trigger names** — use existing `onSchemeTwistRevealed` and
  `onMastermindStrikeRevealed`
- **No hero ability changes** — WP-022/023 are complete
- **No VP scoring changes** — WP-020 is complete
- **No persistence / database access**
- **No server or UI changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/rules/schemeHandlers.ts` — **new** — scheme twist
  handler
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **new** — mastermind
  strike handler
- `packages/game-engine/src/rules/ruleRuntime.impl.ts` — **modified**
  — update triggers, replace stub handlers, wire ImplementationMap
- `packages/game-engine/src/index.ts` — **modified** — export handlers
- `packages/game-engine/src/rules/schemeHandlers.test.ts` — **new** — scheme
  handler tests
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **new** —
  mastermind handler tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Scheme Twist Execution
- [ ] Scheme twist handler fires when `onSchemeTwistRevealed` triggers
- [ ] Handler produces `modifyCounter` effect for twist count
- [ ] At threshold: handler produces `modifyCounter` on
      `ENDGAME_CONDITIONS.SCHEME_LOSS` (uses constant, confirmed with
      `Select-String`)
- [ ] Handler returns `RuleEffect[]` — does not mutate `G` directly

### Mastermind Strike Execution
- [ ] Mastermind strike handler fires when `onMastermindStrikeRevealed` triggers
- [ ] Handler produces wound-related effects
- [ ] Handler returns `RuleEffect[]` — does not mutate `G` directly

### ImplementationMap
- [ ] Scheme and mastermind handlers registered in `ImplementationMap` at setup
- [ ] `ImplementationMap` is NOT stored in `G`
      (confirmed with `Select-String` on types.ts)
- [ ] `// why:` comment on why ImplementationMap lives outside G

### Hook Registration
- [ ] `G.hookRegistry` contains scheme and mastermind `HookDefinition` entries
- [ ] Hook definitions are data-only (no functions)
- [ ] Uses existing `HookDefinition` shape — no new hook type

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Scheme handler tests confirm twist counting and loss trigger
- [ ] Mastermind handler tests confirm strike effects
- [ ] All handlers confirmed read-only on `G` (effects returned, not applied)
- [ ] All test files use `.test.ts` and `makeMockCtx`
- [ ] No boardgame.io import in test files (confirmed with `Select-String`)

### Scope Enforcement
- [ ] WP-009A contracts not modified (unless new effect type with DECISIONS.md)
      (confirmed with `git diff --name-only`)
- [ ] WP-014 reveal pipeline not modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding scheme/mastermind handlers
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm ENDGAME_CONDITIONS constant usage
Select-String -Path "packages\game-engine\src\rules\schemeHandlers.ts" -Pattern "ENDGAME_CONDITIONS"
# Expected: at least one match

Select-String -Path "packages\game-engine\src\rules\schemeHandlers.ts" -Pattern "'schemeLoss'"
# Expected: no output (string literal forbidden)

# Step 4 — confirm ImplementationMap not stored in G
Select-String -Path "packages\game-engine\src\types.ts" -Pattern "ImplementationMap"
# Expected: no output (ImplementationMap lives outside G)

# Step 5 — confirm no boardgame.io import in handler files
Select-String -Path "packages\game-engine\src\rules\schemeHandlers.ts","packages\game-engine\src\rules\mastermindHandlers.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 6 — confirm no .reduce() in handlers
Select-String -Path "packages\game-engine\src\rules\schemeHandlers.ts","packages\game-engine\src\rules\mastermindHandlers.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 7 — confirm WP-009A and WP-014 contracts not modified
git diff --name-only packages/game-engine/src/rules/ruleHooks.types.ts packages/game-engine/src/villainDeck/villainDeck.reveal.ts
# Expected: no output (unless new effect type added with DECISIONS.md entry)

# Step 8 — confirm no require()
Select-String -Path "packages\game-engine\src\rules\schemeHandlers.ts","packages\game-engine\src\rules\mastermindHandlers.ts" -Pattern "require("
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
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] `ENDGAME_CONDITIONS.SCHEME_LOSS` used (not string literal)
      (confirmed with `Select-String`)
- [ ] `ImplementationMap` not stored in `G`
      (confirmed with `Select-String`)
- [ ] No boardgame.io import in handler files
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in handler files (confirmed with `Select-String`)
- [ ] WP-009A and WP-014 contracts not modified
      (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — scheme twists and mastermind strikes now
      produce real gameplay effects; scheme-loss condition is functional;
      WP-025 is unblocked
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why schemes and masterminds
      use the same hook pipeline as heroes (no new execution engine); what
      MVP simplifications were made for twist and strike effects; whether any
      new effect types were needed
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-024 checked off with today's date
