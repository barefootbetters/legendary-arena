# Session Execution Prompt — WP-025 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-025 — Keywords: Patrol, Ambush, Guard
**Mode:** Implementation (WP-025 not yet implemented)
**Pre-Flight:** Complete (2026-04-13) — build green (291 tests passing),
all dependencies met. Three WP/EC corrections applied: (1) Ambush uses inline
`gainWound` (not RuleEffect pipeline) per D-2403 escape wound precedent;
(2) `buildCardKeywords` takes `registry: unknown` with local structural
interface; (3) Ambush extractable from ability text, Patrol/Guard have no data
source (safe-skip per D-2302).
**EC:** `docs/ai/execution-checklists/EC-025-board-keywords.checklist.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- All WP-025 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - §2 "Zone & Pile Structure" — City spaces hold `CardExtId | null`. Board
     keywords are metadata about the card occupying a space.
   - "MVP Gameplay Invariants" / "Registry & Runtime Boundary" — board keyword
     data resolved at setup time. No registry queries at move time.
   - "MVP Gameplay Invariants" / "Moves & Determinism" — `fightVillain`
     validation now includes Guard blocking and Patrol cost. Three-step
     contract preserved.
   - "Layer Boundary (Authoritative)" — board keyword logic is game-engine
     layer only.
3. `docs/ai/execution-checklists/EC-025-board-keywords.checklist.md`
4. `docs/ai/work-packets/WP-025-keywords-patrol-ambush-guard.md`
5. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()` with branching), 13 (ESM only)

**Implementation anchors (read before coding):**

6. `packages/game-engine/src/moves/fightVillain.ts` — read the full file.
   This is a modification target. Current three-step contract:
   - Step 1 (line 42): validate args — `cityIndex` range, card presence,
     `requiredFightCost` from `G.cardStats[cardId]?.fightCost ?? 0`, attack check.
   - Step 2 (line 66): stage gate — `G.currentStage !== 'main'`
   - Step 3 (line 71): mutate G — remove card from city, add to victory.
   Guard and Patrol checks insert into step 1. Guard blocking check goes
   after card presence check (line 54) but before fight cost. Patrol modifier
   adds to `requiredFightCost` before the `availableAttack < requiredFightCost`
   comparison (line 62).
7. `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — read the
   full file. This is a modification target. Ambush insertion point:
   - After City placement (line 112: `G.city = pushResult.city`)
   - After escape handling (line 153: end of escape block)
   - Before bystander attachment (line 158: `attachBystanderToVillain`)
   - Ambush wound logic follows the escape wound inline pattern (lines 124-137):
     check pile length, call `gainWound`, assign results, push message.
8. `packages/game-engine/src/board/wounds.logic.ts` — read `gainWound`
   signature: `(woundsPile: CardExtId[], playerDiscard: CardExtId[]): GainWoundResult`.
   Pure helper, returns `{ woundsPile, playerDiscard }` as new arrays. Already
   imported in `villainDeck.reveal.ts` (line 25).
9. `packages/game-engine/src/board/city.types.ts` — read `CityZone` type.
   5-tuple of `CardExtId | null`. Space 0 = entry, space 4 = escape. **Do NOT
   modify this file.**
10. `packages/game-engine/src/economy/economy.logic.ts` — read `buildCardStats`
    (line 162) for the `registry: unknown` + local structural interface +
    runtime type guard pattern that `buildCardKeywords` must follow.
    Also read `CardStatsRegistryReader` (line 89) and
    `isCardStatsRegistryReader` (line 354) as the template.
11. `packages/game-engine/src/setup/buildInitialGameState.ts` — read the
    full file. `buildCardKeywords` call goes after `buildCardStats` (line 157)
    using the same `(registry as unknown, config)` pattern.
12. `packages/game-engine/src/types.ts` — read `LegendaryGameState`. New field
    `cardKeywords` will be added here.
13. `packages/game-engine/src/rules/ruleHooks.types.ts` — read `RuleEffect`
    type (lines 133-137). Current types: `queueMessage`, `modifyCounter`,
    `drawCards`, `discardHand`. **Do NOT modify this file.**

---

## Runtime Wiring Allowance (01.5)

This WP adds `cardKeywords: Record<CardExtId, BoardKeyword[]>` to
`LegendaryGameState`. Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`,
minimal wiring edits to the following files are permitted solely to restore
type and assertion correctness:

- `buildInitialGameState.ts` — to provide the new `cardKeywords` field in the
  returned `LegendaryGameState` object
- Existing structural assertions in `game.test.ts` — if any assert on
  `LegendaryGameState` field count or shape

**Constraints:**
- Only value-only assertion updates permitted — no new logic or tests
- Each modification must be documented in the execution summary
- No new behavior may be introduced

If no existing tests break beyond the expected structural change, 01.5 is
not further exercised.

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and are locked for execution:

1. **Ambush uses inline `gainWound`, NOT RuleEffect pipeline.**
   There is no `gainWound` RuleEffect type. Escape wounds in
   `villainDeck.reveal.ts` (lines 124-137) already call `gainWound` inline.
   Ambush follows the same pattern: check `hasAmbush`, iterate players,
   call `gainWound` per player, assign results, push messages. This follows
   the D-2403 safe-skip pattern for effect type gaps. Document in DECISIONS.md.

2. **`buildCardKeywords` uses `registry: unknown` with local structural
   interface.** Same pattern as `buildCardStats` in `economy.logic.ts`:
   `CardKeywordsRegistryReader` interface + `isCardKeywordsRegistryReader`
   runtime type guard. Narrow test mocks that don't satisfy the interface
   get empty results gracefully.

3. **Keyword data availability:**
   - Ambush: identifiable by `"Ambush:"` prefix in villain/henchman ability
     text strings. 304 occurrences across all sets.
   - Patrol: NOT the generic fight-cost keyword. Only appears as
     `[keyword:Patrol the X]` in Secret Wars Vol 2 (different mechanic).
     No data source for the WP-025 Patrol concept.
   - Guard: zero occurrences in any card data.
   Resolution: `buildCardKeywords` extracts Ambush from ability text.
   Patrol and Guard produce empty results (no matching cards). Mechanics
   are fully implemented and tested with synthetic data but dormant with
   real cards. DECISIONS.md documents the gap.

4. **Guard blocking direction:** Guard at a higher city index blocks
   fighting cards at lower indices. Higher index = closer to escape (space 4).
   A Guard at index 3 blocks targets at indices 0, 1, 2. Targeting the Guard
   itself (index 3) is allowed.

5. **Ambush "each player" iteration:** Use
   `Object.keys(G.playerZones)` with `for...of`. Call `gainWound` for each
   player. Check `G.piles.wounds.length > 0` before each wound (same guard
   as escape wound logic).

6. **Pre-WP-025 test mock compatibility:** Guard `G.cardKeywords` access
   with `?? {}` or `G.cardKeywords ?? {}`. If undefined, treat as no keywords
   (no Guard blocking, no Patrol modifier, no Ambush). Preserves all 291
   existing tests.

7. **WP-009A contract locked:** `ruleHooks.types.ts` must NOT be modified.
   No new RuleEffect types.

8. **WP-015 contract locked:** `city.types.ts` must NOT be modified.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any modification to `ruleHooks.types.ts` (WP-009A contract)
- Any modification to `city.types.ts` (WP-015 contract)
- Any new RuleEffect types added to `RuleEffect` union or `RULE_EFFECT_TYPES`
- Any new moves, phases, stages, or trigger names
- Any runtime registry access from moves or keyword helpers
- Any `boardgame.io` import in `boardKeywords.logic.ts`, `buildCardKeywords.ts`,
  or test files
- Any `@legendary-arena/registry` import in any new or modified file
- Any `.reduce()` in keyword logic or effect application
- Any `Math.random()` in any new file
- Any `require()` in any new file
- Any functions stored in G
- Any modification to `makeMockCtx` or other shared test helpers
- Any files modified outside the allowlist (see Scope Lock below)
- Expanding scope beyond WP-025 (no "while I'm here" improvements)
- Board keywords using the `HeroAbilityHook` system
- Keyword stacking logic (MVP: present/absent only)
- Scheme-specific keyword modifications (WP-026)

---

## AI Agent Warning (Strict)

**Ambush wound gain MUST be inline — NOT via RuleEffect.**

Do NOT:
- Create a `getAmbushEffects()` function that returns `RuleEffect[]`
- Create a new `'gainWound'` RuleEffect type
- Route Ambush wounds through `applyRuleEffects`
- Add new effect types to `ruleHooks.types.ts`

Instead:
- Use `hasAmbush(cardId, G.cardKeywords ?? {})` to check
- Call `gainWound` directly for each player (same as escape wounds)
- Push messages to `G.messages` for observability

This is the D-2403 safe-skip pattern applied to effect type gaps.

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/board/boardKeywords.types.ts` (new)

**No boardgame.io imports. No registry imports.**

```ts
/**
 * Board keyword type definitions for the Legendary Arena game engine.
 *
 * Board keywords are structural City rules — NOT hero abilities. They fire
 * automatically without player choice and do not use the HeroAbilityHook
 * system.
 */

// why: board keywords are structural City rules, not hero abilities.
// They modify City behavior automatically: Patrol increases fight cost,
// Guard blocks access to lower-index cards, Ambush triggers effects on
// City entry. They require no player choice and use a separate mechanism
// from hero hooks.

/** A board-control keyword that modifies City behavior. */
export type BoardKeyword = 'patrol' | 'ambush' | 'guard';

/**
 * Canonical array of all board keywords. Single source of truth.
 *
 * Used for drift-detection testing — if a keyword is added to the
 * BoardKeyword union, it must also appear in this array (and vice versa).
 */
export const BOARD_KEYWORDS: readonly BoardKeyword[] = [
  'patrol',
  'ambush',
  'guard',
] as const;
```

---

### B) Create `packages/game-engine/src/board/boardKeywords.logic.ts` (new)

**No boardgame.io imports. No registry imports. No `.reduce()`. Pure
functions only — no G mutation.**

```ts
import type { CardExtId } from '../state/zones.types.js';
import type { CityZone } from './city.types.js';
import type { BoardKeyword } from './boardKeywords.types.js';
```

**Functions (all pure helpers, return values — never mutate):**

1. **`getCardKeywords`**
   ```ts
   /**
    * Returns board keywords for a card, or empty array if none.
    */
   export function getCardKeywords(
     cardId: CardExtId,
     cardKeywords: Record<CardExtId, BoardKeyword[]>,
   ): BoardKeyword[]
   ```
   Implementation: `return cardKeywords[cardId] ?? [];`

2. **`getPatrolModifier`**
   ```ts
   /**
    * Returns additional fight cost for a card with Patrol.
    *
    * // why: Patrol adds a fixed +1 attack requirement (MVP value). This is
    * additive on top of the card's base fightCost from G.cardStats.
    */
   export function getPatrolModifier(
     cardId: CardExtId,
     cardKeywords: Record<CardExtId, BoardKeyword[]>,
   ): number
   ```
   Implementation: Check if card has `'patrol'` keyword. Return `1` if yes,
   `0` if no. Use `getCardKeywords` internally.

3. **`isGuardBlocking`**
   ```ts
   /**
    * Returns true if a Guard card at a higher index blocks the target.
    *
    * // why: Guard blocking direction — Guard at a higher City index (closer
    * to the escape edge at space 4) blocks fighting cards at lower indices
    * (further from escape). The Guard card itself is NOT blocked (you can
    * fight the Guard to remove the blocker).
    */
   export function isGuardBlocking(
     city: CityZone,
     targetIndex: number,
     cardKeywords: Record<CardExtId, BoardKeyword[]>,
   ): boolean
   ```
   Implementation: Use `for` loop from `targetIndex + 1` to `4` (inclusive).
   For each city space, if the space has a card and that card has `'guard'`
   keyword, return `true`. If no Guard found at any higher index, return
   `false`. Use `getCardKeywords` internally. No `.reduce()`.

4. **`hasAmbush`**
   ```ts
   /**
    * Returns true if a card has the Ambush keyword.
    *
    * // why: Ambush wound gain is inline in the reveal pipeline (not via
    * RuleEffect) because no 'gainWound' RuleEffect type exists. This helper
    * identifies Ambush cards; the reveal pipeline calls gainWound directly
    * for each player (same pattern as escape wounds). Future WP may add
    * 'gainWound' to the RuleEffect union and migrate to pipeline (D-2403).
    */
   export function hasAmbush(
     cardId: CardExtId,
     cardKeywords: Record<CardExtId, BoardKeyword[]>,
   ): boolean
   ```
   Implementation: Check if card has `'ambush'` keyword. Return `true`/`false`.
   Use `getCardKeywords` internally.

---

### C) Create `packages/game-engine/src/setup/buildCardKeywords.ts` (new)

**No boardgame.io imports. No `.reduce()`. Uses `registry: unknown` with
local structural interface.**

Follow the `buildCardStats` pattern from `economy.logic.ts` exactly:

1. **Define local structural interface** `CardKeywordsRegistryReader`:
   ```ts
   // why: game-engine must not import @legendary-arena/registry; this interface
   // is satisfied structurally by CardRegistry. It exposes the minimum methods
   // needed for keyword resolution at setup time.
   ```
   The interface needs methods to enumerate villain and henchman cards and
   access their ability text. Model after `CardStatsRegistryReader` — expose
   `listCards()` or equivalent that returns objects with `{ slug, abilities }`.
   Read `economy.logic.ts` to determine the exact shape needed.

2. **Define runtime type guard** `isCardKeywordsRegistryReader`:
   ```ts
   // why: narrow test mocks (CardRegistryReader) may lack the required
   // methods. We check at runtime. If the registry doesn't satisfy the
   // interface, we return an empty record — moves handle missing
   // cardKeywords entries gracefully (no keywords = no effects).
   ```

3. **`buildCardKeywords` function:**
   ```ts
   /**
    * Resolves board keywords for all villain/henchman cards at setup time.
    *
    * // why: same setup-time resolution pattern as G.cardStats (WP-018) and
    * G.villainDeckCardTypes (WP-014B). Moves never query registry at runtime.
    *
    * MVP keyword extraction:
    * - Ambush: detected by "Ambush:" prefix in ability text strings
    * - Patrol: no data source in current card data (safe-skip, D-2302)
    * - Guard: no data source in current card data (safe-skip, D-2302)
    *
    * @param registry - Setup-time registry reader. Accepts unknown to support
    *   narrow test mocks. If the registry does not satisfy
    *   CardKeywordsRegistryReader structurally, returns empty record.
    * @param matchConfig - Match setup configuration with selected entity IDs.
    * @returns Record keyed by CardExtId with detected board keywords.
    */
   export function buildCardKeywords(
     registry: unknown,
     matchConfig: MatchSetupConfig,
   ): Record<CardExtId, BoardKeyword[]>
   ```

   Implementation logic:
   - Runtime type guard check — if not satisfied, return `{}`
   - Create `result: Record<CardExtId, BoardKeyword[]> = {}`
   - Iterate villain/henchman cards from registry using `for...of`
   - For each card, check ability text strings for `"Ambush"` prefix
     (case-sensitive — all data uses capital "Ambush")
   - If Ambush detected, add `['ambush']` to result for that card's ext_id
   - Return result
   - No `.reduce()`

---

### D) Modify `packages/game-engine/src/moves/fightVillain.ts`

**Two additions to step 1 validation. Three-step contract preserved.**

Add imports at top:
```ts
import { isGuardBlocking, getPatrolModifier } from '../board/boardKeywords.logic.js';
```

**Guard check — insert after line 56 (after card presence check, before
fight cost):**

```ts
// why: Guard blocks access to lower-index City cards. A Guard at a higher
// index (closer to escape) prevents fighting villains behind it. You must
// defeat the Guard first. Guard check uses defensive access (G.cardKeywords
// may be undefined in pre-WP-025 test states).
const cardKeywords = G.cardKeywords ?? {};
if (isGuardBlocking(G.city, cityIndex, cardKeywords)) {
  return;
}
```

**Patrol modifier — modify the fight cost computation (replace line 60):**

```ts
// why: Patrol adds +1 to the fight cost (MVP additive modifier). The
// patrol modifier is additive on top of the card's base fightCost.
const baseFightCost = G.cardStats[cardId]?.fightCost ?? 0;
const patrolModifier = getPatrolModifier(cardId, cardKeywords);
const requiredFightCost = baseFightCost + patrolModifier;
```

The existing `availableAttack < requiredFightCost` check (line 62) remains
unchanged — it now includes the Patrol modifier.

**No other changes to this file. Steps 2 and 3 are untouched.**

---

### E) Modify `packages/game-engine/src/villainDeck/villainDeck.reveal.ts`

**One addition: Ambush wound gain after City placement, before bystander
attachment.**

Add import at top:
```ts
import { hasAmbush } from '../board/boardKeywords.logic.js';
```

**Ambush check — insert after the escape handling block (after line 153, the
close of the `if (pushResult.escapedCard !== null)` block) and before
bystander attachment (line 158):**

```ts
// why: Ambush fires on City entry, not on fight. When a villain with
// Ambush enters the City, each player gains 1 wound. Wound gain is
// inline (not RuleEffect) because no 'gainWound' RuleEffect type exists
// — same pattern as escape wounds above (D-2403 safe-skip for effect
// type gaps).
const cardKeywords = G.cardKeywords ?? {};
if (hasAmbush(cardId, cardKeywords)) {
  const playerIds = Object.keys(G.playerZones);
  for (const playerId of playerIds) {
    if (G.piles.wounds.length > 0) {
      const ambushWoundResult = gainWound(
        G.piles.wounds,
        G.playerZones[playerId]!.discard,
      );
      G.piles.wounds = ambushWoundResult.woundsPile;
      G.playerZones[playerId]!.discard = ambushWoundResult.playerDiscard;
      G.messages.push(
        `Player ${playerId} gained a wound from Ambush on "${cardId}".`,
      );
    }
  }
}
```

**No other changes to this file.**

---

### F) Modify `packages/game-engine/src/setup/buildInitialGameState.ts`

Add import at top:
```ts
import { buildCardKeywords } from './buildCardKeywords.js';
```

Add call after `buildCardStats` (after line 157, before `buildMastermindState`):

```ts
// why: card keywords resolved at setup from registry so moves never query
// registry at runtime — same pattern as G.cardStats (WP-018) and
// G.villainDeckCardTypes (WP-014B).
const cardKeywords = buildCardKeywords(registry as unknown, config);
```

Add `cardKeywords` to the returned `LegendaryGameState` object literal,
near the `cardStats` field.

---

### G) Modify `packages/game-engine/src/types.ts`

Add import:
```ts
import type { BoardKeyword } from './board/boardKeywords.types.js';
```

Re-export:
```ts
export type { BoardKeyword } from './board/boardKeywords.types.js';
export { BOARD_KEYWORDS } from './board/boardKeywords.types.js';
```

Add to `LegendaryGameState` interface, near `cardStats`:
```ts
/** Board keywords for villain/henchman cards. Built at setup from registry.
 *  Immutable during gameplay. Moves read this to check Patrol, Guard, Ambush.
 *  // why: same setup-time resolution pattern as G.cardStats and
 *  G.villainDeckCardTypes. No runtime registry access. */
cardKeywords: Record<CardExtId, BoardKeyword[]>;
```

---

### H) Modify `packages/game-engine/src/index.ts`

Add exports:
```ts
export type { BoardKeyword } from './board/boardKeywords.types.js';
export { BOARD_KEYWORDS } from './board/boardKeywords.types.js';
export { buildCardKeywords } from './setup/buildCardKeywords.js';
export {
  getPatrolModifier,
  isGuardBlocking,
  hasAmbush,
} from './board/boardKeywords.logic.js';
```

---

### I) Create `packages/game-engine/src/board/boardKeywords.logic.test.ts` (new — 9 tests)

**Uses `node:test` and `node:assert` only. No boardgame.io imports.
No modifications to shared test helpers.**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPatrolModifier,
  isGuardBlocking,
  hasAmbush,
} from './boardKeywords.logic.js';
import { BOARD_KEYWORDS } from './boardKeywords.types.js';
import type { BoardKeyword } from './boardKeywords.types.js';
import type { CityZone } from './city.types.js';
import type { CardExtId } from '../state/zones.types.js';
```

**Test data builder:** Create helper function(s) to construct test
`cardKeywords` records and `CityZone` values. These are local to the test
file — not shared helpers.

**9 tests:**

1. **`getPatrolModifier` returns 1 for card with Patrol**
   - Card `'v-patrol'` has keywords `['patrol']`
   - Assert `getPatrolModifier('v-patrol', keywords) === 1`

2. **`getPatrolModifier` returns 0 for card without Patrol**
   - Card `'v-plain'` has no keywords
   - Assert `getPatrolModifier('v-plain', keywords) === 0`

3. **`isGuardBlocking` returns `true` when Guard at higher index**
   - City: `[null, 'v-target', null, 'v-guard', null]`
   - `'v-guard'` has `['guard']`
   - Target index 1 → Guard at index 3 blocks
   - Assert `isGuardBlocking(city, 1, keywords) === true`

4. **`isGuardBlocking` returns `false` when no Guard between target and escape**
   - City: `['v-guard', null, 'v-target', null, null]`
   - `'v-guard'` has `['guard']` but is at index 0, target at index 2
   - No Guard at index > 2
   - Assert `isGuardBlocking(city, 2, keywords) === false`

5. **`isGuardBlocking` returns `false` when targeting the Guard itself**
   - City: `[null, null, null, 'v-guard', null]`
   - `'v-guard'` has `['guard']`
   - Target index 3 (the Guard itself) — no Guard at index > 3
   - Assert `isGuardBlocking(city, 3, keywords) === false`

6. **`hasAmbush` returns `true` for Ambush card**
   - Card `'v-ambush'` has keywords `['ambush']`
   - Assert `hasAmbush('v-ambush', keywords) === true`

7. **`hasAmbush` returns `false` for non-Ambush card**
   - Card `'v-plain'` has no keywords
   - Assert `hasAmbush('v-plain', keywords) === false`

8. **Drift: `BOARD_KEYWORDS` contains exactly `['patrol', 'ambush', 'guard']`**
   - `assert.deepStrictEqual([...BOARD_KEYWORDS], ['patrol', 'ambush', 'guard'])`
   - `// why: drift-detection — canonical array must match BoardKeyword union`

9. **`JSON.stringify(cardKeywords)` succeeds (serialization proof)**
   - Create a keywords record with all three types
   - Assert `JSON.stringify(keywords)` is a non-empty string

---

### J) Create `packages/game-engine/src/board/boardKeywords.integration.test.ts` (new — 5 tests)

**Uses `node:test` and `node:assert` only. Uses `makeMockCtx`. No
boardgame.io imports. No modifications to shared test helpers.**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fightVillain } from '../moves/fightVillain.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
```

**Test state builder:** Create a `makeTestGameState` helper (local to this
file) that builds a minimal `LegendaryGameState`-compatible object with:
- `city`: 5-tuple
- `cardKeywords`: test keywords record
- `cardStats`: with `fightCost` entries
- `turnEconomy`: with sufficient/insufficient attack
- `currentStage: 'main'` (for fight tests) or `'start'` (for reveal tests)
- `playerZones`: at least 2 players with deck/hand/discard/inPlay/victory
- `piles`: with wounds, bystanders, officers, sidekicks
- `villainDeck`: with deck and discard
- `villainDeckCardTypes`: with card type classifications
- `messages: []`, `counters: {}`, `hookRegistry: []`
- `cardKeywords`: test-specific keyword assignments

Guard against `undefined` on all optional fields that may not exist in
the test state (e.g., `attachedBystanders`, `heroAbilityHooks`, `lobby`,
`hq`, `mastermind`).

**5 tests:**

1. **Fight against Patrol villain requires extra attack**
   - Place a Patrol villain in city with `fightCost: 3`
   - Set available attack to 3 (sufficient for base, NOT for base + patrol)
   - Call `fightVillain` → card should remain (fight fails)
   - Set available attack to 4 (sufficient for 3 + 1 patrol)
   - Call `fightVillain` → card should be removed (fight succeeds)

2. **Fight blocked by Guard: returns void, no mutation**
   - Place Guard villain at index 3, target villain at index 1
   - Call `fightVillain` targeting index 1 → no mutation (Guard blocks)
   - Verify city unchanged

3. **Fight targeting Guard card itself: succeeds (not self-blocking)**
   - Place Guard villain at index 3
   - Call `fightVillain` targeting index 3 → card removed (Guard doesn't
     block itself)

4. **Ambush triggers wound gain on City entry**
   - Set up villain deck with an Ambush villain as top card
   - Set up `cardKeywords` with Ambush for that card
   - Set up 2 players with empty discards and wound pile with cards
   - Call `revealVillainCard` (stage must be `'start'`)
   - Verify both players gained a wound (discard lengths increased)
   - Verify wound pile decreased

5. **`JSON.stringify(G)` succeeds after keyword interactions**
   - Run a fight or reveal with keywords active
   - Assert `JSON.stringify(G)` is a non-empty string

---

## Scope Lock (Critical)

### Files Allowed to Change

| File | Action | Category |
|---|---|---|
| `packages/game-engine/src/board/boardKeywords.types.ts` | **new** | engine |
| `packages/game-engine/src/board/boardKeywords.logic.ts` | **new** | engine |
| `packages/game-engine/src/setup/buildCardKeywords.ts` | **new** | setup |
| `packages/game-engine/src/moves/fightVillain.ts` | **modified** | moves |
| `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` | **modified** | moves |
| `packages/game-engine/src/setup/buildInitialGameState.ts` | **modified** | setup |
| `packages/game-engine/src/types.ts` | **modified** | engine |
| `packages/game-engine/src/index.ts` | **modified** | engine |
| `packages/game-engine/src/board/boardKeywords.logic.test.ts` | **new** | test |
| `packages/game-engine/src/board/boardKeywords.integration.test.ts` | **new** | test |
| `docs/ai/STATUS.md` | **modified** | docs |
| `docs/ai/DECISIONS.md` | **modified** | docs |
| `docs/ai/ARCHITECTURE.md` | **modified** | docs |
| `docs/ai/work-packets/WORK_INDEX.md` | **modified** | docs |

### Files Explicitly NOT Allowed to Change

- `ruleHooks.types.ts` (WP-009A contract — no new RuleEffect types)
- `city.types.ts` (WP-015 contract)
- `ruleRuntime.execute.ts` (WP-009B execution engine)
- `ruleRuntime.effects.ts` (WP-009B effect application)
- `ruleRuntime.impl.ts` (WP-024 — no changes needed)
- `endgame.types.ts` (WP-010 contract)
- `game.ts` (no new moves or phase hooks)
- `makeMockCtx.ts` (shared test helper)
- `heroEffects.execute.ts` (WP-022)
- `heroConditions.evaluate.ts` (WP-023)
- `economy.logic.ts` (WP-018)
- `wounds.logic.ts` (WP-017 — used but not modified)

---

## Verification (Run All Before Completion)

```bash
# Step 1 — build after adding board keywords
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing
# Expected: 291 existing + 14 new = 305 total (approximate)

# Step 3 — confirm no boardgame.io import in keyword helpers
grep -n "boardgame.io" packages/game-engine/src/board/boardKeywords.logic.ts
# Expected: no output

# Step 4 — confirm no registry import in keyword or move files
grep -n "@legendary-arena/registry" packages/game-engine/src/board/boardKeywords.logic.ts packages/game-engine/src/moves/fightVillain.ts packages/game-engine/src/setup/buildCardKeywords.ts
# Expected: no output

# Step 5 — confirm no .reduce() in keyword logic
grep -n "\.reduce(" packages/game-engine/src/board/boardKeywords.logic.ts packages/game-engine/src/setup/buildCardKeywords.ts
# Expected: no output

# Step 6 — confirm BOARD_KEYWORDS drift test
grep -n "BOARD_KEYWORDS" packages/game-engine/src/board/boardKeywords.logic.test.ts
# Expected: at least one match

# Step 7 — confirm city.types.ts not modified
git diff --name-only packages/game-engine/src/board/city.types.ts
# Expected: no output

# Step 8 — confirm no require()
grep -n "require(" packages/game-engine/src/board/boardKeywords.logic.ts packages/game-engine/src/board/boardKeywords.types.ts packages/game-engine/src/setup/buildCardKeywords.ts
# Expected: no output

# Step 9 — confirm no files outside scope
git diff --name-only
# Expected: only files listed in Scope Lock + docs/ai/* governance files

# Step 10 — confirm ruleHooks.types.ts not modified
git diff --name-only packages/game-engine/src/rules/ruleHooks.types.ts
# Expected: no output

# Step 11 — confirm no boardgame.io import in test files
grep -l "boardgame.io" packages/game-engine/src/board/boardKeywords.logic.test.ts packages/game-engine/src/board/boardKeywords.integration.test.ts
# Expected: no output
```

All grep checks must return empty (where expected). Build and tests must exit 0.

---

## Post-Execution Documentation

1. **`docs/ai/DECISIONS.md`** — add entries:
   - D-2501: Board keywords (Patrol, Ambush, Guard) are a separate mechanism
     from hero ability hooks. They are structural City rules that fire
     automatically without player choice. They do not use the
     `HeroAbilityHook` system. Extension seam: `BoardKeyword` union +
     `BOARD_KEYWORDS` canonical array — new keywords add to both.
   - D-2502: MVP values — Patrol: +1 fight cost (additive). Ambush: each
     player gains 1 wound on City entry. Guard: blocks `fightVillain`
     targeting of lower-index City cards.
   - D-2503: Ambush wound gain is inline (not RuleEffect pipeline) because
     no `gainWound` RuleEffect type exists. Follows the escape wound inline
     pattern in `villainDeck.reveal.ts` and the D-2403 safe-skip pattern for
     effect type gaps. Future WP may add `gainWound` to the RuleEffect union.
   - D-2504: Keyword data availability — Ambush is extractable from villain/
     henchman ability text (`"Ambush:"` prefix, 304 occurrences). Patrol and
     Guard have no data source in current card data (Patrol in data is a
     different mechanic from Secret Wars Vol 2; Guard has zero occurrences).
     Mechanics are implemented and tested with synthetic data. Future WP adds
     structured keyword classification. Safe-skip per D-2302.

2. **`docs/ai/STATUS.md`** — Patrol, Ambush, Guard board keywords are
   functional. City gameplay has tactical friction. `G.cardKeywords` built
   at setup. Guard blocking and Patrol cost modifier integrated into
   `fightVillain`. Ambush wound gain integrated into reveal pipeline.
   WP-026 (Scheme Setup Instructions) is unblocked.

3. **`docs/ai/ARCHITECTURE.md`** — add `G.cardKeywords` to the Field
   Classification Reference table in Section 3:
   ```
   | `G.cardKeywords` | Runtime | Board keywords per card — built at setup, immutable during gameplay |
   ```

4. **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-025 with
   today's date.

---

## 01.5 Reporting Requirement

The following existing file is expected to be modified under the runtime
wiring allowance:

- `packages/game-engine/src/setup/buildInitialGameState.ts`
  - **Why:** WP-025 adds `cardKeywords` as a required field on
    `LegendaryGameState`. `buildInitialGameState` must provide this field.
  - **What changed:** Import `buildCardKeywords`, call it with
    `(registry as unknown, config)`, add result to returned object.
  - **Confirmation:** No new gameplay or runtime behavior introduced.
    Wiring-only change to provide the new field.

If additional existing files require changes not listed above (e.g.,
`game.test.ts` structural assertions), document them in the execution
summary with the same format. Do not modify without justification.
