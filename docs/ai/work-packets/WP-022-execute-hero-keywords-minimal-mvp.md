# WP-022 — Execute Hero Keywords (Minimal MVP)

**Status:** Complete  
**Primary Layer:** Game Engine / Rules Execution (Hero Abilities)  
**Dependencies:** WP-021

---

## Session Context

WP-021 introduced the `HeroAbilityHook` data-only contract, `HeroKeyword`
closed union (8 literals), and `G.heroAbilityHooks` — all inert by design.
WP-018 established the attack/recruit economy with `G.turnEconomy`. WP-017
added KO and wound helpers. This packet upgrades hero abilities from
"represented but inert" to "executed deterministically with minimal scope."
Only unconditional numeric effects are supported. Conditional effects,
team/color synergies, and keyword chains are deferred to WP-023+.

---

## Goal

Execute a safe subset of hero ability keywords that were introduced as
declarative hooks in WP-021. After this session:

- When a hero card is played, its `HeroAbilityHook` effects execute immediately
- Four keywords are supported (unconditional only): `draw`, `attack`,
  `recruit`, `ko`
- Effects with conditions are safely skipped (no mutation, no error)
- Unsupported keywords are safely ignored (no mutation, no error)
- Execution uses existing helpers only (zone-ops draw primitives, economy
  mutations, koCard)
- Execution order is deterministic: hooks fire in registration order;
  effects fire in descriptor array order; filtering must not reorder results
- All execution is deterministic and leaves `G` JSON-serializable

---

## Assumes

- WP-021 complete. Specifically:
  - `packages/game-engine/src/rules/heroAbility.types.ts` exports
    `HeroAbilityHook`, `HeroEffectDescriptor`, `HeroCondition` (WP-021)
  - `packages/game-engine/src/rules/heroKeywords.ts` exports `HeroKeyword`,
    `HERO_KEYWORDS` (WP-021)
  - `HeroKeyword` union literals are: `'draw'`, `'attack'`, `'recruit'`,
    `'ko'`, `'rescue'`, `'wound'`, `'reveal'`, `'conditional'`
  - `HeroEffectDescriptor` fields are: `type: HeroKeyword`,
    `magnitude?: number`
  - `HeroAbilityHook` fields include: `cardId: CardExtId`,
    `timing: HeroAbilityTiming`, `keywords: HeroKeyword[]`,
    `conditions?: HeroCondition[]`, `effects?: HeroEffectDescriptor[]`
  - `G.heroAbilityHooks: HeroAbilityHook[]` exists in `LegendaryGameState`
    (WP-021)
  - `packages/game-engine/src/economy/economy.logic.ts` exports
    `addResources` (WP-018)
  - `packages/game-engine/src/board/ko.logic.ts` exports `koCard` (WP-017)
  - `packages/game-engine/src/moves/coreMoves.impl.ts` contains `drawCards`
    move (WP-008B) — note: `drawCards` is a **move function** (takes
    `MoveContext`, performs validation/gating), not a pure helper. WP-022
    must extract or inline the draw logic using zone-ops primitives, not
    call `drawCards` directly.
  - `packages/game-engine/src/setup/shuffle.ts` exports `ShuffleProvider`
    interface and `shuffleDeck` function (needed for deck reshuffle during draw)
  - `packages/game-engine/src/moves/zoneOps.ts` exports `moveCardFromZone`,
    `moveAllCards` (zone mutation primitives used by draw logic)
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
  modify them. Note: `effects` is optional (`effects?: HeroEffectDescriptor[]`);
  hooks with undefined or empty `effects` produce no execution.
- `packages/game-engine/src/rules/heroKeywords.ts` — read `HeroKeyword` union
  and `HERO_KEYWORDS` canonical array. The 8 literal values are: `'draw'`,
  `'attack'`, `'recruit'`, `'ko'`, `'rescue'`, `'wound'`, `'reveal'`,
  `'conditional'`. Only 4 of these are executed in this MVP.
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
- Only **unconditional** effects execute — hooks where `conditions` is
  `undefined` or empty array
- Effects with conditions are **safely skipped**: no mutation, no error,
  skip message collected in `HeroEffectResult[]` (not stored in `G`,
  available for dev/test assertions only)
- Unsupported keywords are **safely ignored**: no mutation, no error,
  skip message collected similarly
- Execution must use **existing helpers only**: zone-ops primitives
  (`moveCardFromZone`, `moveAllCards`) + `shuffleDeck` for draw,
  `addResources` for economy, `koCard` for KO — no ad-hoc state writes.
  **Do not call the `drawCards` move function directly** — it is a full move
  with validation/gating that cannot be invoked from a helper context.
- `ko` MVP targeting: the played hero card itself (models "KO this card"
  text). No player choice. Document in DECISIONS.md.
- Execution order is deterministic and stable:
  - Hooks fire in registration order (same order as `G.heroAbilityHooks`)
  - Effects fire in descriptor array order (same order as hook's `effects[]`)
  - Filtering (e.g., `getHooksForCard`) must not reorder results
  - Given identical `G` + identical `cardId`, execution must produce
    identical `G` mutations every time
- Hero effects execute **immediately after a hero card is played**, before any
  fight/recruit actions that turn. This preserves "play -> generate resources -> act."
- No `.reduce()` in effect execution — use `for...of`
- WP-021 contract files (`heroAbility.types.ts`, `heroKeywords.ts`) must not
  be modified
- Tests use `makeMockCtx` — no `boardgame.io` imports
- Numeric validation for `magnitude`: must be a **finite integer >= 0**.
  If `magnitude` is `undefined`, `NaN`, negative, fractional, or `Infinity`,
  **skip the effect** with a descriptive message. Never default to 1 or 0 —
  skipping is the only valid response to invalid magnitude.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (use these exact literals — they come from WP-021):**

- **Executed keywords (MVP):**

  | Keyword literal | Effect | Helpers used |
  |---|---|---|
  | `'draw'` | Draw N cards from player deck to hand | `moveCardFromZone`, `moveAllCards`, `shuffleDeck` (with `ShuffleProvider`) |
  | `'attack'` | Add N to `turnEconomy.attack` | `addResources(G.turnEconomy, N, 0)` |
  | `'recruit'` | Add N to `turnEconomy.recruit` | `addResources(G.turnEconomy, 0, N)` |
  | `'ko'` | KO the played card to `G.ko` | `koCard(G.ko, cardId)` |

- **Skipped keywords (deferred):**
  `'rescue'`, `'wound'`, `'reveal'`, `'conditional'` — safely ignored in MVP

- **Descriptor field for numeric value:** `magnitude` (not `amount`)

---

## Scope (In)

### A) `src/hero/heroEffects.types.ts` — new

- `interface HeroEffectResult { executed: boolean; keyword: string; message: string }`
  — internal tracking type for what happened during execution
- Not stored in `G` — used only for dev/test assertions and debugging

### B) `src/hero/heroEffects.execute.ts` — new

- `executeHeroEffects(G: LegendaryGameState, ctx: unknown, playerID: string, cardId: CardExtId): void`
  — executes hero ability effects for the played card

  **Why `ctx: unknown`:** keeps this file free of `boardgame.io` imports
  while still allowing a caller to pass ctx. The `'draw'` keyword needs
  `ctx.random.Shuffle` for deck reshuffle — narrow `ctx` to `ShuffleProvider`
  (imported from `../setup/shuffle.js`, engine-internal) at the draw call site.
  This is the established pattern from WP-005B/008B.

  **Why `playerID: string`:** the `'draw'` keyword must know which player's
  deck/hand zones to modify, and economy effects target `G.turnEconomy` which
  is per-active-player. The caller (`playCard`) already has `playerID` from
  `MoveContext` and passes it through. Plain string — no boardgame.io import.

  Algorithm (strict):
  1. Find hooks matching `cardId` in `G.heroAbilityHooks` using
     `getHooksForCard` (preserves registration order).
  2. For each hook:
     - If hook has `conditions` (non-empty `conditions` array): skip all its
       effects, collect skip message, no mutation.
     - If hook has no `effects` (undefined or empty array): skip, no mutation.
     - For each effect in `effects[]`:
       - Validate `magnitude`: must be a finite integer >= 0. If invalid,
         skip with descriptive message.
       - If keyword is `'draw'`: draw `magnitude` cards from the player's
         deck to hand. Use `moveCardFromZone`, `moveAllCards`, and
         `shuffleDeck` (with `ctx as ShuffleProvider`) — the same primitives
         used by `drawCards` in `coreMoves.impl.ts:52-76`. If deck is empty
         and discard has cards, reshuffle discard into deck. If both empty,
         stop drawing. **Do not call the `drawCards` move function** — it
         includes validation/gating that is the move's job, not the helper's.
       - If keyword is `'attack'`:
         `G.turnEconomy = addResources(G.turnEconomy, magnitude, 0)`
       - If keyword is `'recruit'`:
         `G.turnEconomy = addResources(G.turnEconomy, 0, magnitude)`
       - If keyword is `'ko'`: `G.ko = koCard(G.ko, cardId)` — targets the
         played card itself (MVP: no player choice)
       - Else: unsupported keyword, skip with message, no mutation
  3. Do not modify hook data (read-only traversal).

  **Helper pattern:** `addResources` and `koCard` are pure — they return new
  values. The result must be assigned back to `G` (e.g.,
  `G.turnEconomy = addResources(...)`, `G.ko = koCard(...)`). Zone-ops
  helpers (`moveCardFromZone`, `moveAllCards`) also return new arrays that
  must be assigned back to the player's zone fields.

  - Uses `for...of` for all iteration (no `.reduce()`)
  - `// why:` comments on: which keywords are executed, why others are skipped,
    why `ko` targets the played card, why execution runs immediately after play,
    and why `ctx` is narrowed to `ShuffleProvider` at the draw call site

### C) `src/moves/coreMoves.impl.ts` — modified (one file only)

- The `playCard` function currently destructures `{ G, playerID }` from
  `MoveContext`. Change to `{ G, playerID, ...context }` to capture the rest
  (includes `random` for `ShuffleProvider` compatibility). This is the same
  pattern used by `drawCards` on line 33.
- After existing `playCard` logic places the card in `inPlay` and calls
  `addResources` for base stats:
  - Call `executeHeroEffects(G, context, playerID, args.cardId)`
  - `// why:` comment on execution timing: effects fire immediately after play
  - **Do not remove or replace the existing `addResources` call from WP-018.**
    Hero hooks that grant attack/recruit are additive to any base card
    economy that WP-018 already handles. If testing reveals duplication
    (a hero card grants economy via both the WP-018 path and a hook effect),
    document the finding in DECISIONS.md and resolve it — but do not
    pre-emptively remove the WP-018 call without proof of duplication.

### D) `src/types.ts` — modified

- Re-export `HeroEffectResult` if needed for test access

### E) `src/index.ts` — modified

- Export `executeHeroEffects`

### F) Tests — `src/hero/heroEffects.execute.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Required tests:
  1. Hero with `'draw'` effect: player draws N cards
  2. Hero with `'attack'` effect: `turnEconomy.attack` increases by N
  3. Hero with `'recruit'` effect: `turnEconomy.recruit` increases by N
  4. Hero with `'ko'` effect: played card moves to KO pile deterministically
  5. Hero with conditional effect: effect is skipped, **no G mutation**
     (assert deep-equal snapshot of relevant `G` subtrees before/after)
  6. Hero with unsupported keyword: effect is skipped, **no G mutation**
     (assert deep-equal snapshot)
  7. Hook with undefined/empty `effects` array: no mutation
  8. Effect with invalid magnitude (undefined, NaN, negative, 1.5): skipped,
     no mutation
  9. Multiple effects on one card: all execute in descriptor array order
  10. Determinism: run twice on identical deep-cloned input -> deep-equal
      resulting `G`
  11. `JSON.stringify(G)` succeeds after execution (serialization invariant)

---

## Out of Scope

- **No conditional effect execution** — effects with conditions are skipped;
  WP-023 adds conditional logic
- **No team/color synergy effects** — WP-023
- **No multi-step hero chains** — future packets
- **No target selection UI** — `ko` targets the played card only (MVP)
- **No keywords beyond the 4 listed**: `'rescue'`, `'wound'`, `'reveal'`,
  `'conditional'` are safely ignored
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
- [ ] `'draw'` draws correct number of cards
- [ ] `'attack'` adds N to `turnEconomy.attack`
- [ ] `'recruit'` adds N to `turnEconomy.recruit`
- [ ] `'ko'` KOs the played card deterministically

### Safety
- [ ] Effects with conditions are skipped — no G mutation
- [ ] Unsupported keywords are ignored — no G mutation
- [ ] Hooks with undefined/empty `effects` — no G mutation
- [ ] Effects with invalid magnitude (undefined, NaN, negative, float)
      — skipped, no G mutation
- [ ] No crashes, no thrown exceptions, no undefined behavior

### Ordering & Determinism
- [ ] Hooks execute in registration order (same as `G.heroAbilityHooks`)
- [ ] Effects execute in descriptor array order (same as hook's `effects[]`)
- [ ] Filtering does not reorder results
- [ ] Effects execute immediately after hero card is played
- [ ] Deterministic: identical deep-cloned inputs produce identical output

### Layer Boundaries
- [ ] `heroEffects.execute.ts` has no `boardgame.io` import
      (confirmed with `Select-String`)
- [ ] `heroEffects.execute.ts` signature uses `ctx: unknown` (not `Ctx`)
- [ ] `heroEffects.execute.ts` signature includes `playerID: string`
- [ ] `ShuffleProvider` imported from `../setup/shuffle.js` (engine-internal),
      not from `boardgame.io`
- [ ] No `.reduce()` in execution logic
      (confirmed with `Select-String`)
- [ ] No registry import in any new file
      (confirmed with `Select-String`)
- [ ] Does NOT call `drawCards` move function — uses zone-ops primitives
      for draw logic

### Contract Fidelity
- [ ] Keyword literals match WP-021 exactly: `'draw'`, `'attack'`,
      `'recruit'`, `'ko'` (not `gainAttack`, `gainRecruit`, `koCard`)
- [ ] Effect magnitude field is `magnitude` (not `amount`)
- [ ] `HeroEffectDescriptor.type` is used as the keyword source
- [ ] WP-021 contract files (`heroAbility.types.ts`, `heroKeywords.ts`)
      not modified

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Draw effect test confirms cards drawn
- [ ] Economy effect tests confirm turnEconomy changes
- [ ] KO effect test confirms card removed
- [ ] Conditional skip test confirms no mutation (deep-equal snapshot)
- [ ] Unsupported keyword test confirms no mutation (deep-equal snapshot)
- [ ] Invalid magnitude test confirms skip
- [ ] Determinism test: run twice, deep-equal result
- [ ] Serialization test: `JSON.stringify(G)` succeeds
- [ ] All test files use `.test.ts` and `makeMockCtx`
- [ ] No boardgame.io import in test files (confirmed with `Select-String`)

### Scope Enforcement
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

# Step 4 — confirm ctx: unknown (not Ctx type import)
Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts" -Pattern "ctx:\s*Ctx"
# Expected: no output

# Step 5 — confirm no registry import
Select-String -Path "packages\game-engine\src\hero" -Pattern "@legendary-arena/registry" -Recurse
# Expected: no output

# Step 6 — confirm no .reduce() in execution
Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 7 — confirm WP-021 contracts not modified
git diff --name-only packages/game-engine/src/rules/heroAbility.types.ts packages/game-engine/src/rules/heroKeywords.ts
# Expected: no output

# Step 8 — confirm no require()
Select-String -Path "packages\game-engine\src\hero" -Pattern "require\(" -Recurse
# Expected: no output

# Step 9 — confirm correct keyword literals used (not old names)
Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts" -Pattern "gainAttack|gainRecruit|koCard"
# Expected: no output (these are the WRONG names)

# Step 10 — confirm magnitude field used (not amount)
Select-String -Path "packages\game-engine\src\hero\heroEffects.execute.ts" -Pattern "\.amount\b"
# Expected: no output (amount is the WRONG field name)

# Step 11 — confirm no files outside scope were changed
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
- [ ] Keyword literals match WP-021 exactly (confirmed with `Select-String`)
- [ ] Descriptor field is `magnitude` not `amount` (confirmed with `Select-String`)
- [ ] `ctx: unknown` used, not `Ctx` (confirmed with `Select-String`)
- [ ] WP-021 contracts not modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — hero abilities now execute for 4 keywords
      (`draw`, `attack`, `recruit`, `ko`); conditional effects safely skipped;
      WP-023 is unblocked
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why only 4 keywords are
      executed in MVP; why `ko` targets the played card (no player choice);
      how hero effect execution interacts with WP-018 economy (additive vs
      replacement — document findings from testing)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-022 checked off with today's date
