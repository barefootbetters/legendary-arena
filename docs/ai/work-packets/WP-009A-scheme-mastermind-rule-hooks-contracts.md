# WP-009A — Scheme & Mastermind Rule Hooks (Contracts)

**Status:** Ready
**Primary Layer:** Game Engine / Contracts
**Dependencies:** WP-008B

---

## Session Context

WP-008B implemented the three core moves and established `zoneOps.ts` as a
pure zone operation helper. This packet locks the rule hook contracts — the
data structures that allow scheme and mastermind rules to be declared without
implementing them. `HookDefinition` is data-only with no handler functions;
the execution layer comes in WP-009B. `MoveError` from WP-008A is reused —
no new error type is defined here.

---

## Goal

Define the canonical hook, trigger, and effect contracts for scheme and
mastermind rules without implementing any specific behavior.

After this session, `@legendary-arena/game-engine` exports:
- `RuleTriggerName` union and `RULE_TRIGGER_NAMES` constant with payload shapes
- `RuleEffect` tagged union and `RULE_EFFECT_TYPES` constant
- `HookDefinition` interface — data-only, fully JSON-serializable
- Three validators that return structured results, never throw
- Drift-detection tests that prevent trigger names and effect types from
  changing silently

No rule logic is implemented here. `HookDefinition` contains no handler
functions. WP-009B adds the `ImplementationMap` and execution layer.

---

## Assumes

- WP-008B complete. Specifically:
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId`
    (WP-006A)
  - `packages/game-engine/src/turn/turnPhases.types.ts` exports `TurnStage`
    (WP-007A)
  - `packages/game-engine/src/moves/coreMoves.types.ts` exports `MoveError`
    (WP-008A) — reuse this shape; do not define a new error type
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `data/metadata/card-types.json` exists and contains entries for
  `scheme-twist` and `mastermind-strike` — confirm exact slug strings before
  naming triggers
- `docs/ai/DECISIONS.md` exists (created in WP-002)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Rule Execution Pipeline"
  subsection in full. It documents how `HookDefinition`, `ImplementationMap`,
  `executeRuleHooks`, and `applyRuleEffects` fit together. This packet defines
  the data contracts; WP-009B builds the execution layer. Read it now so every
  type decision in this packet is consistent with the architecture.
- `data/metadata/card-types.json` — read the `slug` column to confirm the
  exact slug strings for `scheme-twist` and `mastermind-strike` before naming
  triggers. Do not use underscores — slugs use hyphens.
- `packages/game-engine/src/moves/coreMoves.types.ts` — `MoveError` type.
  Reuse this shape for rule hook errors — do not define a parallel error type.
- `packages/game-engine/src/state/zones.types.ts` — `CardExtId`. Trigger
  payloads that reference cards use `CardExtId`, not plain `string`.
- `docs/ai/REFERENCE/00.2-data-requirements.md §2.1` — the full card type
  taxonomy including `scheme-twist` and `mastermind-strike`. Confirms the
  exact slug strings and that slugs use hyphens not underscores.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.2` — runtime state
  boundaries: `G` must be JSON-serializable. All trigger payloads, effects,
  and hook definitions must contain only plain objects, arrays, strings, and
  numbers — no functions.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` on the data-only effect design), Rule 9
  (`node:` prefix), Rule 11 (full-sentence error messages), Rule 13 (ESM
  only), Rule 14 (field names match data contract — `cardTypeSlug` not
  `card_type`).

---

## Non-Negotiable Constraints

**Applicable engine-wide constraints:**
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions; all new types must satisfy this
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access of any kind
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `HookDefinition` is data-only — no handler functions, no closures, no class
  instances anywhere in its fields
- All trigger payloads, `RuleEffect` variants, and `HookDefinition` must pass
  `JSON.stringify` without throwing
- Card references in trigger payloads use `CardExtId` (imported from
  `state/zones.types.ts`) — not plain `string`
- `MoveError` from `coreMoves.types.ts` is reused for validator errors — no
  new error type defined in this packet
- No `boardgame.io` import in any file under `src/rules/` — all rule files
  must be independently testable without a boardgame.io instance
- `RULE_TRIGGER_NAMES` and `RULE_EFFECT_TYPES` each require a drift-detection
  test — failure means a value was added to the type but not the array, or
  vice versa

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **MoveError shape** (reused from WP-008A for all three validators — do not
  redefine or create a parallel error type):
  `{ code: string; message: string; path: string }`

- **RuleTriggerName values** (this packet defines `RuleTriggerName` as exactly
  these 5 strings — `RULE_TRIGGER_NAMES` array must contain all 5; slugs use
  hyphens not underscores, confirmed in `data/metadata/card-types.json`):
  `'onTurnStart'` | `'onTurnEnd'` | `'onCardRevealed'` |
  `'onSchemeTwistRevealed'` | `'onMastermindStrikeRevealed'`

- **RuleEffect type values** (this packet defines `RuleEffect` as a tagged
  union with exactly these 4 `type` strings — `RULE_EFFECT_TYPES` must contain
  all 4):
  `'queueMessage'` | `'modifyCounter'` | `'drawCards'` | `'discardHand'`

- **HookDefinition fields** (this packet defines `HookDefinition` with exactly
  these 5 fields — no handler functions, no additional fields):
  `id: string` | `kind: 'scheme' | 'mastermind'` | `sourceId: string` |
  `triggers: RuleTriggerName[]` | `priority: number`

---

## Scope (In)

### A) `src/rules/ruleHooks.types.ts` — new

Trigger types:
- `type RuleTriggerName = 'onTurnStart' | 'onTurnEnd' | 'onCardRevealed' | 'onSchemeTwistRevealed' | 'onMastermindStrikeRevealed'`
- `const RULE_TRIGGER_NAMES: readonly RuleTriggerName[]` — canonical ordered
  array (enables drift-detection test)
- Payload interfaces, one per trigger:
  - `OnTurnStartPayload { currentPlayerId: string }`
  - `OnTurnEndPayload { currentPlayerId: string }`
  - `OnCardRevealedPayload { cardId: CardExtId; cardTypeSlug: string }`
  - `OnSchemeTwistRevealedPayload { cardId: CardExtId }`
  - `OnMastermindStrikeRevealedPayload { cardId: CardExtId }`
- `type TriggerPayloadMap` — maps each `RuleTriggerName` to its payload type

Effect types:
- `type RuleEffect` — tagged union, all variants data-only:
  - `{ type: 'queueMessage'; message: string }`
  - `{ type: 'modifyCounter'; counter: string; delta: number }`
  - `{ type: 'drawCards'; playerId: string; count: number }`
  - `{ type: 'discardHand'; playerId: string }`
- `const RULE_EFFECT_TYPES: readonly string[]` — canonical array of `type`
  values
- `// why:` comment on the data-only effect design: effects describe what
  should happen; the executor in WP-009B applies them deterministically;
  this separates rule declaration from execution and keeps `HookDefinition`
  JSON-serializable

Hook definition:
- `interface HookDefinition`:
  - `id: string` — stable unique identifier
  - `kind: 'scheme' | 'mastermind'`
  - `sourceId: string` — `ext_id` of the scheme or mastermind from setup
  - `triggers: RuleTriggerName[]`
  - `priority: number` — lower fires first; ties broken by `id` lexically
- `type HookRegistry = HookDefinition[]`

### B) `src/rules/ruleHooks.validate.ts` — new (all validators return `MoveResult`, never throw)
- `validateTriggerPayload(triggerName: unknown, payload: unknown): { ok: true } | { ok: false; errors: MoveError[] }`
  — validates `triggerName` is a known `RuleTriggerName`; validates `payload`
  has the required fields for that trigger
- `validateRuleEffect(effect: unknown): { ok: true } | { ok: false; errors: MoveError[] }`
  — validates `effect.type` is a known effect type and required fields are
  present with correct primitive types
- `validateHookDefinition(hook: unknown): { ok: true } | { ok: false; errors: MoveError[] }`
  — validates shape only; does not execute handler logic
- No `boardgame.io` import

### C) `src/rules/ruleHooks.registry.ts` — new
- `createHookRegistry(hooks: HookDefinition[]): HookRegistry`
  — validates each hook with `validateHookDefinition`; throws on invalid entry
  with a full-sentence message identifying which hook failed (this is registry
  construction, not a move — throwing is appropriate here)
- `getHooksForTrigger(registry: HookRegistry, triggerName: RuleTriggerName): HookDefinition[]`
  — returns hooks subscribed to the trigger, sorted by `priority` ascending
  then `id` lexically for ties
- `// why:` comment on the sort: deterministic ordering is required for replay;
  priority-then-id ensures identical effect sequences given the same hooks
- No `boardgame.io` import

### D) `src/types.ts` — modified
- Re-export `RuleTriggerName`, `RuleEffect`, `HookDefinition`, `HookRegistry`
  alongside existing game state types

### E) `src/index.ts` — modified
- Export all new public types and functions as named exports

### F) Tests — `src/rules/ruleHooks.contracts.test.ts` — new
- Uses `node:test` and `node:assert` only; does not import from `boardgame.io`
- Ten tests:
  1. Drift: `RULE_TRIGGER_NAMES` contains exactly
     `['onTurnStart', 'onTurnEnd', 'onCardRevealed', 'onSchemeTwistRevealed', 'onMastermindStrikeRevealed']` —
     `// why:` comment: failure here means a trigger name was added to the
     `RuleTriggerName` union but not the canonical array, or vice versa
  2. Drift: `RULE_EFFECT_TYPES` contains exactly
     `['queueMessage', 'modifyCounter', 'drawCards', 'discardHand']` —
     `// why:` comment: failure here means an effect type was added to the
     `RuleEffect` tagged union but not the canonical array, or vice versa
  3. Valid trigger payload passes `validateTriggerPayload`
  4. Missing required field fails `validateTriggerPayload` → `{ ok: false }`
  5. Valid effect passes `validateRuleEffect`
  6. Unknown `type` field fails `validateRuleEffect` → `{ ok: false }`
  7. Valid `HookDefinition` passes `validateHookDefinition`
  8. Missing `priority` field fails `validateHookDefinition` → `{ ok: false }`
  9. All trigger payload instances pass `JSON.stringify` without throwing
  10. All effect variants pass `JSON.stringify` without throwing

---

## Out of Scope

- No rule implementations — `HookDefinition` is data-only; no handler functions
- No effect executor — that is WP-009B
- No new move behaviors
- No city, HQ, or villain deck logic
- No persistence or PostgreSQL access
- No UI or server changes
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/rules/ruleHooks.types.ts` — **new** — triggers,
  payloads, effects, hook definition
- `packages/game-engine/src/rules/ruleHooks.validate.ts` — **new** — three
  validators
- `packages/game-engine/src/rules/ruleHooks.registry.ts` — **new** — registry
  factory and query helper
- `packages/game-engine/src/types.ts` — **modified** — re-export rule hook
  contracts
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/rules/ruleHooks.contracts.test.ts` — **new** —
  `node:test` coverage including drift-detection for both arrays

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Trigger Contracts
- [ ] `src/rules/ruleHooks.types.ts` exports `RuleTriggerName` as exactly:
      `'onTurnStart' | 'onTurnEnd' | 'onCardRevealed' | 'onSchemeTwistRevealed' | 'onMastermindStrikeRevealed'`
- [ ] `RULE_TRIGGER_NAMES` is a `readonly` array containing all 5 trigger names
- [ ] All 5 payload interfaces exported with fields specified in Scope (In)
- [ ] `OnCardRevealedPayload.cardId` is typed as `CardExtId`, not plain `string`

### Effect Contracts
- [ ] `RuleEffect` is a tagged union with exactly 4 variants:
      `queueMessage`, `modifyCounter`, `drawCards`, `discardHand`
- [ ] `RULE_EFFECT_TYPES` is a `readonly` array containing all 4 type strings
- [ ] No effect variant contains a function property
      (confirmed with `Select-String` for `=>` or `function` in `ruleHooks.types.ts`)
- [ ] `ruleHooks.types.ts` has a `// why:` comment on the data-only effect
      design

### Hook Definition Contract
- [ ] `HookDefinition` has exactly 5 fields: `id`, `kind`, `sourceId`,
      `triggers`, `priority`
- [ ] `HookDefinition` contains no function properties
- [ ] `getHooksForTrigger` returns hooks sorted by `priority` ascending, then
      `id` lexically for ties

### Validators
- [ ] All three validators exported from `ruleHooks.validate.ts`
- [ ] No validator contains a `throw` statement
      (confirmed with `Select-String`)
- [ ] `validateTriggerPayload` with an unknown trigger name returns `{ ok: false }`
- [ ] `validateRuleEffect` with an unknown `type` value returns `{ ok: false }`
- [ ] `validateHookDefinition` with a missing `priority` field returns
      `{ ok: false }`

### No boardgame.io in Rules Files
- [ ] No file under `src/rules/` imports from `boardgame.io`
      (confirmed with `Select-String -Recurse`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `RULE_TRIGGER_NAMES` drift test: array contains exactly the 5 trigger
      name strings specified in Scope (In); test has a `// why:` comment
- [ ] `RULE_EFFECT_TYPES` drift test: array contains exactly the 4 effect
      type strings specified in Scope (In); test has a `// why:` comment
- [ ] `JSON.stringify` succeeds on all payload and effect instances
- [ ] Test file does not import from `boardgame.io`
      (confirmed with `Select-String`)
- [ ] Test uses `node:test` and `node:assert` only

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after new types are added
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests including new contract tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no function expressions in HookDefinition or RuleEffect
Select-String -Path "packages\game-engine\src\rules\ruleHooks.types.ts" -Pattern "=>"
# Expected: no output (no arrow functions in type definitions)

# Step 4 — confirm validators do not throw
Select-String -Path "packages\game-engine\src\rules\ruleHooks.validate.ts" -Pattern "throw "
# Expected: no output

# Step 5 — confirm no boardgame.io import in any rules file
Select-String -Path "packages\game-engine\src\rules" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 6 — confirm no require() in any generated file
Select-String -Path "packages\game-engine\src\rules" -Pattern "require(" -Recurse
# Expected: no output

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files under packages/game-engine/src/rules/ plus
#           src/types.ts and src/index.ts
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
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No function expressions in `ruleHooks.types.ts`
      (confirmed with `Select-String`)
- [ ] No `throw` in any validator (confirmed with `Select-String`)
- [ ] No `boardgame.io` import in any rules file
      (confirmed with `Select-String -Recurse`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what rule hook contracts are now exported
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why `HookDefinition` is
      data-only with no handler functions; why effects are a tagged data union
      rather than callback functions; the priority-then-id ordering decision
      for deterministic hook execution
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-009A checked off with today's date
