# WP-025 — Keywords: Patrol, Ambush, Guard

**Status:** Ready  
**Primary Layer:** Game Engine / Board Keywords & Constraints  
**Dependencies:** WP-024

---

## Session Context

WP-015 introduced the City with deterministic push/escape logic. WP-016/018
added fight actions gated by attack points. WP-022/023 added hero keyword
execution with conditional evaluation. This packet introduces three
**board-control keywords** that modify City behavior: Patrol (increases fight
cost), Ambush (triggers effects on reveal into City), and Guard (blocks access
to other City cards). These are structural rules of the City, NOT hero
abilities — they are automatic, require no player choice, and do not use hero
hook timing. WP-026 will add scheme setup instructions and city modifiers.

---

## Goal

Implement core board-control keywords that modify how the City behaves. After
this session:

- `BoardKeyword` closed union exists: `'patrol'` | `'ambush'` | `'guard'`
- `BOARD_KEYWORDS` canonical array exists with drift-detection test
- Villain/henchman cards in the City carry board keyword metadata (resolved
  at setup time from registry into `G.cardKeywords` or equivalent)
- **Patrol**: villains with Patrol add a fixed fight-cost modifier while in
  the City (MVP: +1 attack required)
- **Ambush**: when a villain with Ambush enters the City, an automatic effect
  fires immediately (MVP: each player gains 1 wound)
- **Guard**: a villain with Guard blocks `fightVillain` targeting of City cards
  behind it (lower index) until the Guard villain is defeated
- All behavior is deterministic, automatic, and engine-enforced

---

## Assumes

- WP-024 complete. Specifically:
  - `packages/game-engine/src/board/city.types.ts` exports `CityZone` (WP-015)
  - `packages/game-engine/src/board/city.logic.ts` exports
    `pushVillainIntoCity` (WP-015)
  - `packages/game-engine/src/moves/fightVillain.ts` exports `fightVillain`
    (WP-016, modified by WP-017/018)
  - `packages/game-engine/src/economy/economy.logic.ts` exports
    `getAvailableAttack` (WP-018)
  - `packages/game-engine/src/board/wounds.logic.ts` exports `gainWound`
    (WP-017)
  - `G.villainDeckCardTypes` maps cards to types (WP-014)
  - `G.cardStats` exists with parsed card values (WP-018)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- Card data includes keyword information in ability text or structured metadata
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants" section
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 2` — read "Zone & Pile Structure". City
  spaces hold `CardExtId | null`. Board keywords are metadata about the card
  occupying a space — they modify how the City interacts with that card.
- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Registry &
  Runtime Boundary". Board keyword data must be resolved at setup time (same
  pattern as `G.villainDeckCardTypes` and `G.cardStats`). No registry queries
  at move time.
- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Moves &
  Determinism". `fightVillain` validation now includes Guard blocking and
  Patrol cost modification. The three-step contract is preserved.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — board keyword
  logic is game-engine layer only. No server, registry, persistence, or UI.
- `packages/game-engine/src/moves/fightVillain.ts` — read it entirely. This
  packet modifies fight validation to check Guard blocking and Patrol cost.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — read it
  entirely. This packet modifies the City entry path to trigger Ambush effects.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `boardKeyword` not `bk`), Rule 6 (`// why:` on each keyword's behavior
  and on the distinction from hero hooks), Rule 8 (no `.reduce()`), Rule 13
  (ESM only).

**Critical design note — board keywords are NOT hero abilities:**
Board keywords are automatic, structural rules of the City. They fire without
player choice, do not use hero hook timing (`onPlay`, `onFight`, etc.), and
are not represented as `HeroAbilityHook` entries. They are a separate
mechanism that modifies City behavior directly.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — board keywords involve no randomness
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
- Registry boundary (hard rule): board keyword data resolved at setup time.
  No registry queries at move time. Keyword classification stored in a
  setup-time lookup (e.g., `G.cardKeywords: Record<CardExtId, BoardKeyword[]>`
  or included in `G.cardStats`).
- `BoardKeyword` is a **closed canonical union** — adding a new keyword
  requires a `DECISIONS.md` entry and updating both the type and canonical
  array (drift-detection test)
- Board keywords are **automatic** — no player choice involved
- Board keywords do NOT use the `HeroAbilityHook` system — they are a separate
  mechanism
- Patrol MVP: +1 to fight cost (additive modifier). Document exact value in
  DECISIONS.md.
- Ambush MVP: each player gains 1 wound on entry. Document in DECISIONS.md.
- Guard MVP: blocks `fightVillain` targeting of City cards at lower indices.
  Document blocking rule in DECISIONS.md.
- `fightVillain` validation extended to check Guard and Patrol — three-step
  contract preserved
- Ambush effects fire during City entry (in `pushVillainIntoCity` path or
  reveal pipeline) — not during fight
- No `.reduce()` in keyword logic — use `for...of`
- WP-015 contract files (`city.types.ts`) must not be modified
- Tests use `makeMockCtx` — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **BoardKeyword closed union:**
  `'patrol'` | `'ambush'` | `'guard'`

- **MVP keyword effects:**

  | Keyword | Trigger | MVP Effect |
  |---|---|---|
  | `patrol` | Fight validation | +1 attack required to fight this villain |
  | `ambush` | City entry (reveal) | Each player gains 1 wound |
  | `guard` | Fight validation | Blocks targeting of City cards at lower indices |

---

## Scope (In)

### A) `src/board/boardKeywords.types.ts` — new

- `type BoardKeyword = 'patrol' | 'ambush' | 'guard'`
- `const BOARD_KEYWORDS: readonly BoardKeyword[]` — canonical array for
  drift-detection
- `// why:` comment: board keywords are structural City rules, not hero
  abilities; they fire automatically without player choice

### B) `src/board/boardKeywords.logic.ts` — new

- `getCardKeywords(cardId: CardExtId, cardKeywords: Record<CardExtId, BoardKeyword[]>): BoardKeyword[]`
  — returns keywords for a card, or empty array if none

- `getPatrolModifier(cardId: CardExtId, cardKeywords: Record<CardExtId, BoardKeyword[]>): number`
  — returns additional fight cost for Patrol (MVP: 1 if has `'patrol'`, 0 otherwise)

- `isGuardBlocking(city: CityZone, targetIndex: number, cardKeywords: Record<CardExtId, BoardKeyword[]>): boolean`
  — returns `true` if any card at a higher index (closer to escape) has Guard
  — Guard blocks access to cards behind it (lower indices)
  — `// why:` comment on blocking direction

- `getAmbushEffects(cardId: CardExtId, cardKeywords: Record<CardExtId, BoardKeyword[]>): RuleEffect[]`
  — returns MVP ambush effects (wound gain per player) if card has `'ambush'`,
  empty array otherwise

- Pure helpers, no boardgame.io import

### C) `src/setup/buildCardKeywords.ts` — new

- `buildCardKeywords(registry: CardRegistry, matchConfig: MatchSetupConfig): Record<CardExtId, BoardKeyword[]>`
  — called during `Game.setup()`:
  - Resolves villain/henchman cards from registry
  - Extracts keyword metadata from card data
  - Returns a flat lookup keyed by `CardExtId`
  - Uses `for...of` (no `.reduce()`)
  - `// why:` comment: same setup-time resolution pattern as `G.cardStats`

### D) `src/moves/fightVillain.ts` — modified

- In step 1 (validate args), after existing attack check:
  - Check Guard: `isGuardBlocking(G.city, cityIndex, G.cardKeywords)` — if
    blocked, return void
  - Check Patrol: add `getPatrolModifier` to required attack before
    availability check
  - `// why:` comments on Guard blocking and Patrol cost modification

### E) `src/villainDeck/villainDeck.reveal.ts` — modified

- After placing villain/henchman into City:
  - Check for Ambush: `getAmbushEffects(cardId, G.cardKeywords)`
  - If effects returned: apply via `applyRuleEffects`
  - `// why:` comment: Ambush fires on City entry, not on fight

### F) `src/setup/buildInitialGameState.ts` — modified

- Call `buildCardKeywords(registry, matchConfig)` and store as `G.cardKeywords`

### G) `src/types.ts` — modified

- Add `cardKeywords: Record<CardExtId, BoardKeyword[]>` to `LegendaryGameState`
- Re-export `BoardKeyword`, `BOARD_KEYWORDS`

### H) `src/index.ts` — modified

- Export `BoardKeyword`, `BOARD_KEYWORDS`, `buildCardKeywords`,
  `getPatrolModifier`, `isGuardBlocking`, `getAmbushEffects`

### I) Tests — `src/board/boardKeywords.logic.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Nine tests:
  1. `getPatrolModifier` returns 1 for card with Patrol
  2. `getPatrolModifier` returns 0 for card without Patrol
  3. `isGuardBlocking` returns `true` when Guard card is at higher index
  4. `isGuardBlocking` returns `false` when no Guard between target and escape
  5. `isGuardBlocking` returns `false` when targeting the Guard card itself
  6. `getAmbushEffects` returns wound effects for Ambush card
  7. `getAmbushEffects` returns empty array for non-Ambush card
  8. Drift: `BOARD_KEYWORDS` contains exactly `['patrol', 'ambush', 'guard']`
  9. `JSON.stringify(cardKeywords)` succeeds

### J) Tests — `src/board/boardKeywords.integration.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Five tests:
  1. Fight against Patrol villain requires extra attack
  2. Fight blocked by Guard: returns void, no mutation
  3. Fight targeting Guard card itself: succeeds (not self-blocking)
  4. Ambush triggers wound gain on City entry
  5. `JSON.stringify(G)` succeeds after keyword interactions

---

## Out of Scope

- **No additional board keywords** beyond Patrol, Ambush, Guard — future packets
- **No player choice in keyword resolution** — all automatic
- **No keyword stacking** (multiple of same keyword on one card) — MVP treats
  as present/absent only
- **No keyword interaction with hero abilities** — board keywords and hero hooks
  are separate systems
- **No scheme-specific keyword modifications** — WP-026
- **No UI or animation for keyword effects**
- **No persistence / database access**
- **No server changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/board/boardKeywords.types.ts` — **new** —
  BoardKeyword union, BOARD_KEYWORDS array
- `packages/game-engine/src/board/boardKeywords.logic.ts` — **new** — keyword
  helpers (patrol, guard, ambush)
- `packages/game-engine/src/setup/buildCardKeywords.ts` — **new** — setup-time
  keyword resolution
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — Guard
  blocking + Patrol cost
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** —
  Ambush on City entry
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  build cardKeywords
- `packages/game-engine/src/types.ts` — **modified** — add cardKeywords to
  LegendaryGameState
- `packages/game-engine/src/index.ts` — **modified** — exports
- `packages/game-engine/src/board/boardKeywords.logic.test.ts` — **new** —
  unit tests
- `packages/game-engine/src/board/boardKeywords.integration.test.ts` — **new**
  — integration tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Board Keyword Types
- [ ] `BoardKeyword` union is `'patrol' | 'ambush' | 'guard'`
- [ ] `BOARD_KEYWORDS` canonical array matches union exactly
- [ ] Drift-detection test exists with `// why:` comment

### Patrol
- [ ] Fight against Patrol villain requires +1 attack
- [ ] Fight against non-Patrol villain: no modifier

### Guard
- [ ] Guard blocks `fightVillain` targeting of lower-index City cards
- [ ] Targeting the Guard card itself is allowed
- [ ] No Guard in City: no blocking

### Ambush
- [ ] Ambush triggers wound gain on City entry
- [ ] Non-Ambush villain: no effect on entry

### Setup Integration
- [ ] `G.cardKeywords` built at setup time from registry
- [ ] No registry access at move time
      (confirmed with `Select-String`)

### Pure Helpers
- [ ] `boardKeywords.logic.ts` has no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in keyword logic
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Unit tests cover all 3 keywords + drift detection
- [ ] Integration tests cover fight with Patrol/Guard + Ambush on entry
- [ ] All test files use `.test.ts` and `makeMockCtx`
- [ ] No boardgame.io import in test files (confirmed with `Select-String`)

### Scope Enforcement
- [ ] WP-015 contract files (`city.types.ts`) not modified
      (confirmed with `git diff --name-only`)
- [ ] Board keywords are separate from hero hook system
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding board keywords
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in keyword helpers
Select-String -Path "packages\game-engine\src\board\boardKeywords.logic.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm no registry import in keyword or move files
Select-String -Path "packages\game-engine\src\board\boardKeywords.logic.ts","packages\game-engine\src\moves\fightVillain.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 5 — confirm no .reduce() in keyword logic
Select-String -Path "packages\game-engine\src\board\boardKeywords.logic.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 6 — confirm BOARD_KEYWORDS drift test
Select-String -Path "packages\game-engine\src\board\boardKeywords.logic.test.ts" -Pattern "BOARD_KEYWORDS"
# Expected: at least one match

# Step 7 — confirm city.types.ts not modified
git diff --name-only packages/game-engine/src/board/city.types.ts
# Expected: no output

# Step 8 — confirm no require()
Select-String -Path "packages\game-engine\src\board\boardKeywords.logic.ts","packages\game-engine\src\setup\buildCardKeywords.ts" -Pattern "require("
# Expected: no output

# Step 9 — confirm no files outside scope
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
- [ ] No boardgame.io import in keyword helpers
      (confirmed with `Select-String`)
- [ ] No registry import at move time (confirmed with `Select-String`)
- [ ] No `.reduce()` in keyword logic (confirmed with `Select-String`)
- [ ] `BOARD_KEYWORDS` drift test passes
- [ ] WP-015 contracts not modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — Patrol, Ambush, Guard keywords are
      functional; City gameplay has tactical friction; WP-026 is unblocked
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why board keywords are
      separate from hero hooks (structural City rules vs hero abilities); MVP
      values for Patrol (+1), Ambush (wound gain), Guard (index blocking);
      why keywords are automatic with no player choice
- [ ] `docs/ai/ARCHITECTURE.md` updated — add `G.cardKeywords` to the Field
      Classification Reference table in Section 3 (class: Runtime)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-025 checked off with today's date
