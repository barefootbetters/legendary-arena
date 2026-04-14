# Session Execution Prompt — WP-021 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-021 — Hero Card Text & Keywords (Hooks Only)
**Mode:** Implementation (WP-021 not yet implemented)
**Pre-Flight:** Complete (2026-04-13) — build green (247 tests passing),
all dependencies met, registry type naming locked (`CardRegistryReader`),
`HeroCondition` shape locked (`{ type: string; value: string }`),
`HeroAbilityTiming` closed union + `HERO_ABILITY_TIMINGS` canonical array added,
timing defaults to `'onPlay'` (no NL inference), parsing order locked,
`game.ts` NOT modified, `buildInitialGameState.ts` wiring authorized via 01.5
**EC:** `docs/ai/execution-checklists/EC-021-hero-hooks.checklist.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- All WP-021 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - §4 "The Rule Execution Pipeline" (`HeroAbilityHook` follows the same
     data-only pattern as `HookDefinition`: data in `G`, handler functions
     outside `G`)
   - §2 "Card Data Flow: Registry into Game Engine" (hero ability hooks
     resolved at setup, stored in `G`, never recomputed during moves)
   - "Layer Boundary (Authoritative)" — hero ability hooks are game-engine
     layer only
3. `docs/ai/execution-checklists/EC-021-hero-hooks.checklist.md`
4. `docs/ai/work-packets/WP-021-hero-card-text-keywords-hooks-only.md`
5. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()` with branching), 13 (ESM only)

**Implementation anchors (patterns, not templates):**

6. `packages/game-engine/src/rules/ruleHooks.types.ts` — read
   `HookDefinition`. `HeroAbilityHook` follows the same philosophy:
   data-only, JSON-serializable, no functions.
7. `packages/game-engine/src/setup/buildInitialGameState.ts` — read the
   full file. This is where `heroAbilityHooks` will be wired (via 01.5
   allowance). Follow the existing pattern: import builder, call it,
   assign to return object with a `// why:` comment.
8. `packages/game-engine/src/villainDeck/villainDeck.types.ts` — read
   `REVEALED_CARD_TYPES` canonical array and its drift-detection test
   pattern. `HERO_KEYWORDS` follows the same pattern.
9. `packages/game-engine/src/types.ts` — read `LegendaryGameState` to
   understand the full shape and where `heroAbilityHooks` will be added.

---

## Runtime Wiring Allowance (01.5)

This WP adds `heroAbilityHooks: HeroAbilityHook[]` to `LegendaryGameState`.
Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring
edits to the following files are permitted solely to restore type and
assertion correctness:

- `buildInitialGameState.ts` — import `buildHeroAbilityHooks`, call it,
  assign result to `heroAbilityHooks` in the return object

No new behavior may be introduced. The shape test
(`buildInitialGameState.shape.test.ts`) does not enumerate all top-level
keys exhaustively, so it should NOT need updating. If it does, only
value-only assertion updates are permitted — no new logic.

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and are locked for execution:

1. **Registry parameter type:** Use `CardRegistryReader` (the actual codebase
   type), not `CardRegistry` (the WP's shorthand). The WP's intent is clear;
   the type name in the WP is a generalization.
2. **Keyword extraction:** `buildHeroAbilityHooks` extracts keywords from
   structured ability text markup (`[keyword:X]`, `[icon:X]`, `[hc:X]`
   patterns) already present in registry hero card data. No natural language
   parsing. Abilities that don't map to a known `HeroKeyword` value produce
   hooks with empty `keywords: []`.
3. **HeroCondition shape:** `{ type: string; value: string }` per EC-021
   (MVP generalization). The WP's `'heroClassMatch'` is an example, not a
   locked literal.
4. **`game.ts` NOT modified.** Wiring goes through `buildInitialGameState.ts`
   only (01.5 allowance). `game.ts` already calls `buildInitialGameState` —
   no change needed there.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any hero ability producing gameplay effects — this packet is INERT
- Any function, closure, or class instance stored in `G.heroAbilityHooks`
- Any `boardgame.io` import in hero ability files
- Any `@legendary-arena/registry` import in type files or move files
- Any `.reduce()` in hook construction — use `for...of`
- Any `Math.random()` in any new file
- Any `require()` in any new file
- Any modification of `game.ts`
- Any modification to `makeMockCtx` or shared test helpers
- Any new moves, phase hooks, or turn flow changes
- Any files modified outside the allowlist (see Scope Lock below)
- Expand scope beyond WP-021 (no "while I'm here" improvements)
- Any timing inferred from natural-language phrasing (e.g., "fight" does
  NOT imply `'onFight'`) — always default to `'onPlay'` unless markup
  explicitly encodes timing
- Any numeric magnitude extracted from English text (e.g., "Draw two cards"
  does NOT produce `magnitude: 2`) — only structured markup allowed
- Any keyword inferred solely from English text — only `[keyword:X]`,
  `[icon:X]` markup produces keywords

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

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/rules/heroAbility.types.ts` (new)

**No boardgame.io imports. No registry imports.**

```ts
import type { CardExtId } from '../state/zones.types.js';
import type { HeroKeyword, HeroAbilityTiming } from './heroKeywords.js';
```

**Locked interfaces (copy verbatim from EC-021):**

```ts
/**
 * Declarative, data-only representation of a hero card's ability.
 *
 * Built at setup time from registry card data. Stored in
 * G.heroAbilityHooks. Immutable during gameplay — moves must never
 * modify these hooks.
 *
 * Execution of hero abilities is deferred to WP-022+. This interface
 * describes what a hero card can do; it does not do it.
 */
interface HeroAbilityHook {
  // why: must be a hero card CardExtId — links this hook to a specific
  // hero card in the match's hero decks
  cardId: CardExtId;
  // why: timing is a declarative label only — no execution semantics
  // are attached in WP-021. WP-022+ will use timing to determine when
  // the ability fires. Defaults to 'onPlay' — no NL inference.
  timing: HeroAbilityTiming;
  // why: keywords are labels only. They do not imply that a matching
  // HeroEffectDescriptor must exist. A hook may have keywords but no
  // effects, or effects but no keywords.
  keywords: HeroKeyword[];
  // why: conditions are declarative descriptors, not evaluation logic.
  // Resolution is deferred to WP-022+.
  conditions?: HeroCondition[];
  // why: effects are descriptors, not functions. They describe what an
  // effect would do; they do not do it. Execution is WP-022+.
  effects?: HeroEffectDescriptor[];
}
```

```ts
/**
 * Declarative condition descriptor for hero abilities (MVP).
 *
 * Describes when a hero ability applies. No evaluation logic is
 * implemented in WP-021.
 */
interface HeroCondition {
  type: string;
  value: string;
}
```

```ts
/**
 * Declarative effect descriptor for hero abilities (MVP).
 *
 * Describes what an effect would do. Does not execute it.
 */
interface HeroEffectDescriptor {
  type: HeroKeyword;
  magnitude?: number;
}
```

Export all three interfaces.

Add query/filter utility functions (pure, read-only):

```ts
/**
 * Returns hero ability hooks matching a specific timing value.
 */
function filterHooksByTiming(
  hooks: HeroAbilityHook[],
  timing: HeroAbilityHook['timing'],
): HeroAbilityHook[]

/**
 * Returns hero ability hooks matching a specific keyword.
 */
function filterHooksByKeyword(
  hooks: HeroAbilityHook[],
  keyword: HeroKeyword,
): HeroAbilityHook[]

/**
 * Returns hero ability hooks for a specific card.
 */
function getHooksForCard(
  hooks: HeroAbilityHook[],
  cardId: CardExtId,
): HeroAbilityHook[]
```

Implementation: simple `for...of` with array accumulation. No `.reduce()`.
Export all utility functions.

---

### B) Create `packages/game-engine/src/rules/heroKeywords.ts` (new)

**No boardgame.io imports. No registry imports.**

**Locked values (copy verbatim from EC-021):**

```ts
/**
 * Closed canonical union of hero ability keyword labels.
 *
 * Keywords are semantic labels only — they do not imply magnitude,
 * effect resolution, or execution semantics. Adding a new keyword
 * requires a DECISIONS.md entry and updating both the type and the
 * HERO_KEYWORDS array.
 */
// why: keywords are semantic labels only; adding a keyword requires a
// DECISIONS.md entry and updating both the union type and the canonical
// array. This prevents ad-hoc keyword proliferation.
type HeroKeyword =
  | 'draw'
  | 'attack'
  | 'recruit'
  | 'ko'
  | 'rescue'
  | 'wound'
  | 'reveal'
  | 'conditional';
```

```ts
// why: canonical array for drift-detection. Must match HeroKeyword
// union exactly. Drift-detection test in heroAbility.setup.test.ts
// asserts array/union parity.
const HERO_KEYWORDS: readonly HeroKeyword[] = [
  'draw',
  'attack',
  'recruit',
  'ko',
  'rescue',
  'wound',
  'reveal',
  'conditional',
] as const;
```

Also in this file, add the timing closed union and canonical array:

```ts
/**
 * Closed canonical union of hero ability timing labels.
 *
 * Same drift-detection pattern as HeroKeyword. Adding a new timing
 * requires a DECISIONS.md entry and updating both the type and the
 * HERO_ABILITY_TIMINGS array.
 */
// why: timing labels are declarative only — no execution semantics.
// Defaults to 'onPlay' when markup does not encode timing explicitly.
type HeroAbilityTiming =
  | 'onPlay'
  | 'onFight'
  | 'onRecruit'
  | 'onKO'
  | 'onReveal';
```

```ts
// why: canonical array for drift-detection. Must match HeroAbilityTiming
// union exactly. Same pattern as HERO_KEYWORDS.
const HERO_ABILITY_TIMINGS: readonly HeroAbilityTiming[] = [
  'onPlay',
  'onFight',
  'onRecruit',
  'onKO',
  'onReveal',
] as const;
```

Export `HeroKeyword`, `HERO_KEYWORDS`, `HeroAbilityTiming`, and
`HERO_ABILITY_TIMINGS`.

---

### C) Create `packages/game-engine/src/setup/heroAbility.setup.ts` (new)

**No boardgame.io imports. No `.reduce()`. Uses `for...of`.**

```ts
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
```

```ts
/**
 * Builds hero ability hooks from registry card data at setup time.
 *
 * Called during Game.setup() via buildInitialGameState. Resolves hero
 * cards from the selected hero decks, extracts structured ability
 * metadata, and produces a list of HeroAbilityHook entries.
 *
 * After setup, G.heroAbilityHooks is immutable — moves must never
 * modify it.
 *
 * @param registry - Card registry for resolving hero card data.
 *   Used at setup time only.
 * @param matchConfig - Validated match setup config with heroDeckIds.
 * @returns Array of HeroAbilityHook entries for all selected hero cards.
 */
// why: setup-time-only pattern — same as buildVillainDeck,
// buildCardStats. Registry data is consumed once and never accessed
// at runtime.
function buildHeroAbilityHooks(
  registry: CardRegistryReader,
  matchConfig: MatchSetupConfig,
): HeroAbilityHook[]
```

**Registry Field Constraint:** `buildHeroAbilityHooks` may only rely on:
- `cardId` / `key` (CardExtId)
- `abilities: string[]` (structured markup text)
- deck or set membership (to match `heroDeckIds`)

If the registry provides richer data, it must be ignored in WP-021.

**Algorithm:**

1. Iterate `matchConfig.heroDeckIds` using `for...of`
2. For each hero deck ID, resolve hero cards from registry
   - Use `registry.listCards()` or equivalent to find cards belonging to
     that hero deck. The registry's card data includes hero cards with
     `abilities: string[]` arrays containing structured markup.
   - If the registry provides a method to filter by set/deck, use it.
     Otherwise, iterate `listCards()` and match by deck membership.
3. For each hero card with abilities, extract structured ability metadata
   using the **Ability Parsing Order** below
4. Build one `HeroAbilityHook` per ability (a card with 2 abilities
   produces 2 hooks)
5. Return the complete array

**Ability Parsing Order (Authoritative):**

Ability text is processed in the following fixed order:

1. Extract `[hc:X]` condition markup -> `HeroCondition` entries
   (e.g., `[hc:tech]` -> `{ type: 'heroClassMatch', value: 'tech' }`)
2. Extract `[keyword:X]` markup -> `HeroKeyword` entries
3. Extract `[icon:X]` markup -> `HeroKeyword` entries
   (e.g., `[icon:recruit]` -> `'recruit'`, `[icon:attack]` -> `'attack'`)
4. Perform final keyword normalization (dedup, validate against union)
5. Assign timing (per Timing Derivation Rules below)

No step may depend on results of a later step.

**Timing Derivation Rules (Non-Negotiable):**
- If ability markup explicitly encodes timing (e.g., `[timing:onFight]`),
  use it
- Otherwise, **always assign `'onPlay'`**
- Do not infer timing from natural-language phrasing
- Do not interpret words like "fight", "recruit", or "reveal" as timing cues

**Magnitude Constraint:** Do not extract numeric magnitude from
natural-language phrasing (e.g., "Draw two cards" does NOT produce
`magnitude: 2`). Only structured markup with explicit numeric values
may populate `HeroEffectDescriptor.magnitude`. If no structured markup
provides a magnitude, omit it.

**Keywords vs Effects:** `keywords` are labels only. They do not imply
that a matching `HeroEffectDescriptor` must exist for that ability.
A hook may have keywords but no effects, or effects but no keywords.

**Keyword extraction mapping (MVP — structured markup only):**

| Markup Pattern | HeroKeyword | Notes |
|---|---|---|
| `[icon:recruit]` | `'recruit'` | |
| `[icon:attack]` | `'attack'` | |
| `[icon:ko]` | `'ko'` | |
| `[keyword:X]` where X maps to union | corresponding keyword | |
| `[hc:X]` present | `'conditional'` | When ability has a condition |

**Invalid extraction (do NOT produce):**
- Keywords inferred solely from English text ("Draw a card" -> `'draw'`)
- Effects with magnitude from English text ("Draw two" -> `magnitude: 2`)
- Timing from phrase interpretation ("fight" -> `'onFight'`)

Unrecognized patterns produce hooks with `keywords: []`. This is
correct for MVP — keyword coverage will improve in future WPs without
contract changes.

**Critical:** The registry interface used is `CardRegistryReader`. Examine
the actual registry API at implementation time to understand how to access
hero cards and their abilities. The registry exposes `listCards()` which
returns `Array<{ key: string }>` at minimum. Additional methods like
`listSets()`, `getSet()`, or richer card objects may be available — use
what exists, do not invent new registry methods.

If the registry API does not provide enough data to resolve hero card
abilities (e.g., `listCards()` only returns `{ key }` without abilities),
**STOP and report**. Do not mock or fake ability data.

---

### D) Modify `packages/game-engine/src/setup/buildInitialGameState.ts` (01.5 wiring)

**Minimal wiring change only. No new behavior.**

1. Add import:
   ```ts
   import { buildHeroAbilityHooks } from './heroAbility.setup.js';
   ```

2. Add call before the return statement:
   ```ts
   // why: hero ability hooks built from registry at setup time — same
   // pattern as hookRegistry and cardStats. Immutable during gameplay.
   // Execution deferred to WP-022+.
   const heroAbilityHooks = buildHeroAbilityHooks(registry, config);
   ```

3. Add field to the return object:
   ```ts
   heroAbilityHooks,
   ```

No other changes to this file.

---

### E) Modify `packages/game-engine/src/types.ts`

Add to `LegendaryGameState`:

```ts
import type { HeroAbilityHook, HeroCondition, HeroEffectDescriptor } from './rules/heroAbility.types.js';
import type { HeroKeyword, HeroAbilityTiming } from './rules/heroKeywords.js';
```

```ts
// why: hero ability hooks are built at setup time and immutable during
// gameplay. Data-only — no functions or closures. Execution is WP-022+.
heroAbilityHooks: HeroAbilityHook[];
```

Re-export types:
```ts
export type { HeroAbilityHook, HeroCondition, HeroEffectDescriptor } from './rules/heroAbility.types.js';
export type { HeroKeyword, HeroAbilityTiming } from './rules/heroKeywords.js';
```

---

### F) Modify `packages/game-engine/src/index.ts`

Export all new public API:

```ts
export type { HeroAbilityHook, HeroCondition, HeroEffectDescriptor } from './rules/heroAbility.types.js';
export type { HeroKeyword, HeroAbilityTiming } from './rules/heroKeywords.js';
export { HERO_KEYWORDS, HERO_ABILITY_TIMINGS } from './rules/heroKeywords.js';
export { filterHooksByTiming, filterHooksByKeyword, getHooksForCard } from './rules/heroAbility.types.js';
export { buildHeroAbilityHooks } from './setup/heroAbility.setup.js';
```

---

### G) Create `packages/game-engine/src/rules/heroAbility.setup.test.ts` (new — 8 tests)

**Uses `node:test` and `node:assert` only. Uses `makeMockCtx` if needed.
No boardgame.io imports. No modifications to shared test helpers.**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
```

**8 tests:**

1. **`buildHeroAbilityHooks` produces a non-empty array for valid hero decks**
   - Use a mock registry that returns hero cards with abilities
   - Assert result is a non-empty array

2. **Every hook has a valid `cardId` (CardExtId string)**
   - Assert each hook's `cardId` is a non-empty string

3. **Every hook has a valid `timing` value from `HERO_ABILITY_TIMINGS`**
   - Import `HERO_ABILITY_TIMINGS`
   - Assert each hook's `timing` is in `HERO_ABILITY_TIMINGS`

4. **Every hook's `keywords` are from the `HeroKeyword` union**
   - Import `HERO_KEYWORDS`
   - Assert each keyword in each hook is a member of `HERO_KEYWORDS`

5. **`JSON.stringify(hooks)` succeeds (fully serializable)**
   - Assert `JSON.stringify` does not throw and produces a non-empty string

6. **Drift: `HERO_KEYWORDS` array matches union type exactly**
   - // why: prevents union/array divergence — same pattern as
   -   REVEALED_CARD_TYPES drift detection
   - Assert `HERO_KEYWORDS` contains exactly the 8 canonical values
   - Assert no duplicates
   - Assert length equals 8

7. **Determinism: identical input produces identical output**
   - // why: protects replay, snapshot tests, and leaderboards
   - Call `buildHeroAbilityHooks` twice with the same mock registry
     and matchConfig
   - Assert `JSON.stringify(result1) === JSON.stringify(result2)`

8. **Drift: `HERO_ABILITY_TIMINGS` array matches `HeroAbilityTiming` union exactly**
   - // why: same pattern as HERO_KEYWORDS drift detection
   - Assert `HERO_ABILITY_TIMINGS` contains exactly the 5 canonical values
   - Assert no duplicates
   - Assert length equals 5

**Mock registry for tests:** Create a minimal mock that returns hero cards
with structured ability text. The mock should produce enough data for
`buildHeroAbilityHooks` to generate hooks. Follow the existing pattern
from `buildInitialGameState.shape.test.ts` (`createMockRegistry`), but
extend it to return hero card data with abilities. The mock must only
provide the three allowed registry fields (`cardId`/`key`,
`abilities: string[]`, deck membership) — do not include richer data
that would mask drift from the real registry.

If `buildHeroAbilityHooks` requires registry methods beyond `listCards()`,
the mock must implement those methods. Do not skip tests because of mock
complexity — if the mock is too complex, that signals the builder is
doing too much for a Contract-Only WP.

---

## Verification (Run All Before Completion)

```bash
# Step 1 — build after adding hero hooks
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in hero ability files
grep -l "boardgame.io" packages/game-engine/src/rules/heroAbility.types.ts packages/game-engine/src/rules/heroKeywords.ts packages/game-engine/src/setup/heroAbility.setup.ts
# Expected: no output

# Step 4 — confirm no registry import in type files
grep -l "@legendary-arena/registry" packages/game-engine/src/rules/heroAbility.types.ts packages/game-engine/src/rules/heroKeywords.ts
# Expected: no output

# Step 5 — confirm no .reduce() in setup
grep -n "\.reduce(" packages/game-engine/src/setup/heroAbility.setup.ts
# Expected: no output

# Step 6 — confirm HERO_KEYWORDS and HERO_ABILITY_TIMINGS drift tests exist
grep -n "HERO_KEYWORDS" packages/game-engine/src/rules/heroAbility.setup.test.ts
# Expected: at least one match
grep -n "HERO_ABILITY_TIMINGS" packages/game-engine/src/rules/heroAbility.setup.test.ts
# Expected: at least one match

# Step 7 — confirm heroAbilityHooks is JSON-serializable
grep -n "JSON.stringify" packages/game-engine/src/rules/heroAbility.setup.test.ts
# Expected: at least one match

# Step 8 — confirm no require() in new files
grep -rn "require(" packages/game-engine/src/rules/heroAbility.types.ts packages/game-engine/src/rules/heroKeywords.ts packages/game-engine/src/setup/heroAbility.setup.ts packages/game-engine/src/rules/heroAbility.setup.test.ts
# Expected: no output

# Step 9 — confirm game.ts NOT modified
git diff --name-only packages/game-engine/src/game.ts
# Expected: no output

# Step 10 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in scope + buildInitialGameState.ts (01.5 wiring)
# Allowed files:
#   packages/game-engine/src/rules/heroAbility.types.ts (new)
#   packages/game-engine/src/rules/heroKeywords.ts (new)
#   packages/game-engine/src/setup/heroAbility.setup.ts (new)
#   packages/game-engine/src/rules/heroAbility.setup.test.ts (new)
#   packages/game-engine/src/types.ts (modified)
#   packages/game-engine/src/index.ts (modified)
#   packages/game-engine/src/setup/buildInitialGameState.ts (01.5 wiring)
#   docs/ai/* (governance updates)
```

All grep checks must return empty (or comment-only). Build and tests
must exit 0.

---

## Post-Execution Documentation

1. **`docs/ai/DECISIONS.md`** — add entries. **Use only factual language.
   No speculative words ("enables", "supports", "allows"). State only
   what WP-021 concretely introduces.**
   - D-2101: `HeroAbilityHook` is data-only (same pattern as
     `HookDefinition` from WP-009A). No functions, closures, or handler
     references stored in `G`.
   - D-2102: `HeroKeyword` union is closed. Adding a keyword requires a
     `DECISIONS.md` entry and updating both the union type and the
     `HERO_KEYWORDS` canonical array. Prevents ad-hoc keyword
     proliferation.
   - D-2103: `HeroAbilityTiming` union is closed. Same drift-detection
     pattern as `HeroKeyword`. Timing defaults to `'onPlay'` when ability
     markup does not encode timing explicitly. No NL inference.
   - D-2104: Hero ability execution deferred to WP-022+.
     `G.heroAbilityHooks` is an observation-only data structure in WP-021.
     No game state changes result from hero hooks.
   - D-2105: `buildHeroAbilityHooks` uses `CardRegistryReader` (not
     `CardRegistry`). The WP's `CardRegistry` was a generalization — the
     actual codebase type is `CardRegistryReader`. Builder consumes only
     `cardId`/`key`, `abilities: string[]`, and deck membership.

2. **`docs/ai/STATUS.md`** — hero ability hooks exist as data-only
   contracts; keywords are normalized with drift detection; WP-022 is
   unblocked for execution

3. **`docs/ai/ARCHITECTURE.md`** — add `G.heroAbilityHooks` to the Field
   Classification Reference table in Section 3 (class: Runtime,
   built at setup, immutable during gameplay)

4. **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-021 with
   today's date

---

## 01.5 Reporting Requirement

If `buildInitialGameState.ts` or any other file outside the WP-021
allowlist was modified under the runtime wiring allowance:

Document in the execution summary:
- Which file was modified
- Why the modification was required (new required field
  `heroAbilityHooks` on `LegendaryGameState`)
- What structural change was applied (import + call + field assignment)
- Confirmation that no new gameplay or runtime behavior was introduced
