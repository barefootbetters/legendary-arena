# WP-022 — Execute Hero Keywords (Minimal MVP)

**Status:** Ready  
**Primary Layer:** Game Engine / Rules Execution (Hero Abilities)  
**Dependencies:** WP-021

---

## Session Context

WP-021 introduced the `HeroAbilityHook` data-only contract, `HeroKeyword`
closed union, and `G.heroAbilityHooks` — all inert by design. WP-018
established the attack/recruit economy with `G.turnEconomy`. WP-017 added
KO and wound helpers. This packet upgrades hero abilities from "represented
but inert" to "executed deterministically with minimal scope." Only
unconditional numeric effects are supported. Conditional effects, team/color
synergies, and keyword chains are deferred to WP-023+.

---

## Goal

Execute a safe subset of hero ability keywords that were introduced as
declarative hooks in WP-021. After this session:

- When a hero card is played, its `HeroAbilityHook` effects execute immediately
- Four keywords are supported (unconditional only): `draw`, `gainAttack`,
  `gainRecruit`, `koCard`
- Effects with conditions are safely skipped (no mutation, no error)
- Unsupported keywords are safely ignored
- Execution uses existing helpers only (drawCards, economy mutations, koCard)
- Execution order is deterministic: hooks fire in registration order
- All execution is pure and JSON-serializable

---

## Assumes

- WP-021 complete. Specifically:
  - `packages/game-engine/src/rules/heroAbility.types.ts` exports
    `HeroAbilityHook`, `HeroEffectDescriptor`, `HeroCondition` (WP-021)
  - `packages/game-engine/src/rules/heroKeywords.ts` exports `HeroKeyword`,
    `HERO_KEYWORDS` (WP-021)
  - `G.heroAbilityHooks: HeroAbilityHook[]` exists in `LegendaryGameState`
    (WP-021)
  - `packages/game-engine/src/economy/economy.logic.ts` exports
    `addResources` (WP-018)
  - `packages/game-engine/src/board/ko.logic.ts` exports `koCard` (WP-017)
  - `packages/game-engine/src/moves/coreMoves.impl.ts` contains `drawCards`
    logic (WP-008B)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013) with "MVP Gameplay
  Invariants" section documenting "Data Representation Before Execution"
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Data
  Representation Before Execution". WP-021 provided the representation layer;
  this packet adds execution without refactoring existing state contracts.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Rule Execution Pipeline".
  Hero effect execution follows the same two-step pattern: collect effects,
  then apply. Effects are applied using `for...of` (never `.reduce()`).
- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Move Validation Contract".
  The `playCard` move is extended to trigger hero effect execution after
  placing the card in `inPlay`. The three-step contract is preserved.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — hero execution
  is game-engine layer only. No server, registry, persistence, or UI.
- `packages/game-engine/src/rules/heroAbility.types.ts` — read `HeroAbilityHook`
  and `HeroEffectDescriptor`. Execution reads these descriptors; it does not
  modify them.
- `packages/game-engine/src/rules/heroKeywords.ts` — read `HeroKeyword`. Only
  4 of the 8 keywords are executed in this MVP.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations),
  Rule 6 (`// why:` on which keywords are executed and why others are skipped),
  Rule 8 (no `.reduce()`), Rule 11 (full-sentence messages for skipped effects),
  Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — hero execution involves no randomness
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
- Registry boundary (hard rule): no registry access at runtime. Hero hooks
  are already resolved and stored in `G.heroAbilityHooks` (WP-021).
- Move functions return `void` and never throw. Execution helpers may return
  structured results internally but the move itself returns void.
- Only **unconditional** effects execute — effects where `conditions` is
  undefined or empty
- Effects with conditions are **safely skipped**: no mutation, no error, optional
  dev log message
- Unsupported keywords are **safely ignored**: no mutation, no error
- Execution must use **existing helpers only**: `drawCards` logic, `addResources`,
  `koCard` — no ad-hoc state writes
- `koCard` MVP targeting: the played hero card itself (models "KO this card"
  text). No player choice. Document in DECISIONS.md.
- Execution order: hooks fire in registration order (same order as
  `G.heroAbilityHooks`). Deterministic for identical inputs.
- Hero effects execute **immediately after a hero card is played**, before any
  fight/recruit actions that turn. This preserves "play -> generate resources -> act."
- No `.reduce()` in effect execution — use `for...of`
- WP-021 contract files (`heroAbility.types.ts`, `heroKeywords.ts`) must not
  be modified
- Tests use `makeMockCtx` — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values:**

- **Executed keywords (MVP):**

  | Keyword | Effect | Helper |
  |---|---|---|
  | `draw` | Draw N cards | `drawCards` logic |
  | `gainAttack` | Add N to `turnEconomy.attack` | `addResources` |
  | `gainRecruit` | Add N to `turnEconomy.recruit` | `addResources` |
  | `koCard` | KO the played card | `koCard` helper |

- **Skipped keywords (deferred):**
  `rescue`, `wound`, `reveal`, `conditional` — safely ignored in MVP

---

## Scope (In)

### A) `src/hero/heroEffects.types.ts` — new

- `interface HeroEffectResult { executed: boolean; keyword: string; message: string }`
  — internal tracking type for what happened during execution
- Not stored in `G` — used only for dev/test logging

### B) `src/hero/heroEffects.execute.ts` — new

- `executeHeroEffects(G: LegendaryGameState, ctx: Ctx, cardId: CardExtId): void`
  — executes hero ability effects for the played card:
  1. Find hooks matching `cardId` in `G.heroAbilityHooks`
  2. For each hook, iterate `effects`:
     - If effect has conditions (non-empty `conditions` array): skip, log message
     - If keyword is unsupported: skip, log message
     - If keyword is `'draw'`: call draw logic with `amount`
     - If keyword is `'gainAttack'`: call `addResources(G.turnEconomy, amount, 0)`
     - If keyword is `'gainRecruit'`: call `addResources(G.turnEconomy, 0, amount)`
     - If keyword is `'koCard'`: call `koCard(G.ko, cardId)` (the played card)
  3. Update `G.turnEconomy` and other state as needed
  - Uses `for...of` for all iteration (no `.reduce()`)
  - `// why:` comments on: which keywords are executed, why others are skipped,
    and why koCard targets the played card

### C) `src/moves/playCard` path — modified

- After existing `playCard` logic places the card in `inPlay` and adds
  resources (WP-018):
  - Call `executeHeroEffects(G, ctx, cardId)`
  - This replaces the direct `addResources` call from WP-018 if hero hooks
    are the source of resource generation (document the approach in DECISIONS.md)
  - `// why:` comment on execution timing: effects fire immediately after play

### D) `src/types.ts` — modified

- Re-export `HeroEffectResult` if needed for test access

### E) `src/index.ts` — modified

- Export `executeHeroEffects`

### F) Tests — `src/hero/heroEffects.execute.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Nine tests:
  1. Hero with `draw` effect: player draws N cards
  2. Hero with `gainAttack` effect: `turnEconomy.attack` increases by N
  3. Hero with `gainRecruit` effect: `turnEconomy.recruit` increases by N
  4. Hero with `koCard` effect: played card moves to `G.ko`
  5. Hero with conditional effect: effect is skipped, no G mutation
  6. Hero with unsupported keyword: effect is skipped, no G mutation
  7. Multiple effects on one card: all execute in order
  8. Execution is deterministic: identical inputs produce identical results
  9. `JSON.stringify(G)` succeeds after execution

---

## Out of Scope

- **No conditional effect execution** — effects with conditions are skipped;
  WP-023 adds conditional logic
- **No team/color synergy effects** — WP-023
- **No multi-step hero chains** — future packets
- **No target selection UI** — koCard targets the played card only (MVP)
- **No keywords beyond the 4 listed**: `rescue`, `wound`, `reveal`,
  `conditional` are safely ignored
- **No Patrol, Ambush, Guard keywords** — WP-025
- **No mastermind or scheme ability execution** — WP-024
- **No persistence / database access**
- **No server or UI changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/hero/heroEffects.types.ts` — **new** —
  HeroEffectResult internal type
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **new** —
  executeHeroEffects
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — playCard
  calls executeHeroEffects
- `packages/game-engine/src/types.ts` — **modified** — re-export if needed
- `packages/game-engine/src/index.ts` — **modified** — export
  executeHeroEffects
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **new** —
  execution tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Keyword Execution
- [ ] `draw` draws correct number of cards
- [ ] `gainAttack` adds N to `turnEconomy.attack`
- [ ] `gainRecruit` adds N to `turnEconomy.recruit`
- [ ] `koCard` KOs the played card deterministically

### Safety
- [ ] Effects with conditions are skipped — no G mutation
- [ ] Unsupported keywords are ignored — no G mutation
- [ ] No crashes, no thrown exceptions, no undefined behavior

### Ordering & Timing
- [ ] Hooks execute in registration order (same as `G.heroAbilityHooks`)
- [ ] Effects execute immediately after hero card is played
- [ ] Deterministic: identical inputs produce identical output

### Pure Helpers
- [ ] `heroEffects.execute.ts` has no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in execution logic
      (confirmed with `Select-String`)
- [ ] No registry import in any new file
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Draw effect test confirms cards drawn
- [ ] Economy effect tests confirm turnEconomy changes
- [ ] Conditional skip test confirms no mutation
- [ ] Unsupported keyword test confirms no mutation
- [ ] All test files use `.test.ts` and `makeMockCtx`
- [ ] No boardgame.io import in test files (confirmed with `Select-String`)

### Scope Enforcement
- [ ] WP-021 contract files (`heroAbility.types.ts`, `heroKeywords.ts`) not
      modified (confirmed with `git diff --name-only`)
- [ ] No conditional logic executed
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding hero execution
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in execution file
Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm no registry import
Select-String -Path "packages\game-engine\src\hero" -Pattern "@legendary-arena/registry" -Recurse
# Expected: no output

# Step 5 — confirm no .reduce() in execution
Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts" -Pattern "\.reduce\("
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
- [ ] No boardgame.io import in hero execution files
      (confirmed with `Select-String`)
- [ ] No registry import in hero execution files
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in execution logic (confirmed with `Select-String`)
- [ ] WP-021 contracts not modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — hero abilities now execute for 4 keywords;
      conditional effects safely skipped; WP-023 is unblocked
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why only 4 keywords are
      executed in MVP; why koCard targets the played card (no player choice);
      how hero effect execution interacts with WP-018 economy (addResources
      vs direct economy mutation)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-022 checked off with today's date
