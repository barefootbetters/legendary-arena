# WP-020 — VP Scoring & Win Summary (Minimal MVP)

**Status:** Ready  
**Primary Layer:** Game Engine / Scoring  
**Dependencies:** WP-019

---

## Session Context

WP-010 established the endgame evaluator that decides **when** the game ends
(escaped villains, scheme loss, mastermind defeated). WP-017 introduced wounds,
KO, and bystander capture. WP-019 introduced mastermind tactics defeat. This
packet computes **what the final scores are** after the game ends — a pure
function that reads `G` and returns a per-player VP breakdown. WP-020 does
NOT decide when the game ends (that is WP-010) and does NOT store scores back
into `G` during MVP.

---

## Goal

Introduce deterministic VP scoring and a final win summary. After this session:

- `computeFinalScores(G)` is a pure function that returns a `FinalScoreSummary`
  with per-player VP breakdowns
- MVP VP rules are locked as constants (villain +1, henchman +1, bystander +1,
  tactic +5, wound -1)
- Card type classification for scoring uses `G.villainDeckCardTypes` (for
  villain deck cards in victory piles) and `G.cardStats` (for wound
  identification) — no registry access at scoring time
- The scoring function is called after `endIf` triggers — it does not modify
  `G`, does not trigger endgame, and performs no I/O
- Tests prove deterministic scoring with correct VP math

---

## Assumes

- WP-019 complete. Specifically:
  - `G.mastermind.tacticsDefeated` exists as `CardExtId[]` (WP-019)
  - `G.playerZones[*].victory` contains defeated villains, henchmen, and
    bystanders as `CardExtId` strings (WP-006A, WP-016, WP-017)
  - `G.playerZones[*].discard`, `G.playerZones[*].deck`,
    `G.playerZones[*].hand` may contain wound `CardExtId` strings (WP-017)
  - `G.villainDeckCardTypes` maps cards to `RevealedCardType` (WP-014) —
    used to classify victory pile cards
  - `G.ko` exists as `CardExtId[]` (WP-017)
  - `packages/game-engine/src/endgame/endgame.types.ts` exports
    `EndgameResult` (WP-010)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 4` — read "The endIf Contract". `endIf`
  decides **when** the game ends. WP-020's scoring runs **after** endIf
  triggers — it does not participate in the endgame decision.
- `docs/ai/ARCHITECTURE.md §Section 2` — read "Zone & Pile Structure". Player
  victory zones contain `CardExtId` strings. Scoring must classify these cards
  to assign VP values.
- `docs/ai/ARCHITECTURE.md §Section 2` — read "Card Data Flow: Registry into
  Game Engine". Card type classification data is stored in
  `G.villainDeckCardTypes` (WP-014). Card stat data is in `G.cardStats`
  (WP-018). Scoring uses these lookups — never the registry.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — scoring is
  game-engine layer only. No server, registry, persistence, or UI.
- `packages/game-engine/src/endgame/endgame.types.ts` — read `EndgameResult`.
  The scoring function may receive or reference the endgame outcome but does
  not modify it.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `playerScore` not `ps`), Rule 6 (`// why:` on the MVP VP table and on
  wound identification strategy), Rule 8 (no `.reduce()` for score
  accumulation with branching — use `for...of`), Rule 13 (ESM only).

**Critical design note — card type identification for scoring:**
Victory pile cards are `CardExtId` strings. To classify them (villain vs
henchman vs bystander vs tactic), scoring uses `G.villainDeckCardTypes` which
maps every villain deck card to its `RevealedCardType`. Tactic cards are
identified via `G.mastermind.tacticsDefeated`. Wounds are identified by
checking if a card's `CardExtId` appears in the original wound supply (tracked
via a setup-time mechanism, or by convention — document the chosen approach
in DECISIONS.md).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — scoring involves no randomness
- Never throw inside scoring functions — return structured results
- `G` must not be mutated by scoring — `computeFinalScores` is read-only
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in any new file
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `computeFinalScores` is a **pure function** — no I/O, no mutation of `G`,
  no side effects
- Registry boundary: scoring must NOT access the registry. Card classification
  uses `G.villainDeckCardTypes` and `G.mastermind.tacticsDefeated`.
- VP values are **named constants** (not inline numbers):
  `VP_VILLAIN = 1`, `VP_HENCHMAN = 1`, `VP_BYSTANDER = 1`, `VP_TACTIC = 5`,
  `VP_WOUND = -1`
- KO'd cards contribute 0 VP — they are explicitly excluded
- Hero cards contribute 0 VP in MVP
- Scoring does NOT trigger endgame — WP-010 owns that
- Scoring does NOT store results back into `G` during MVP — the return value
  is consumed by the caller (future UI or snapshot)
- No `.reduce()` for score accumulation with branching — use `for...of`
- `MoveResult` / `MoveError` are NOT used — scoring has its own return type
  (`FinalScoreSummary`)
- Tests use `makeMockCtx` or plain mocks — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values:**

- **MVP VP Table (constants):**

  | Card Type | VP | Constant |
  |---|---|---|
  | Villain | +1 | `VP_VILLAIN` |
  | Henchman | +1 | `VP_HENCHMAN` |
  | Bystander | +1 | `VP_BYSTANDER` |
  | Mastermind Tactic | +5 | `VP_TACTIC` |
  | Wound | -1 | `VP_WOUND` |
  | Hero / Scheme / KO | 0 | (not scored) |

- **PlayerZones keys** (scoring reads these):
  `deck` | `hand` | `discard` | `inPlay` | `victory`

---

## Scope (In)

### A) `src/scoring/scoring.types.ts` — new

- `interface PlayerScoreBreakdown { playerId: string; villainVP: number; henchmanVP: number; bystanderVP: number; tacticVP: number; woundVP: number; totalVP: number }`
- `interface FinalScoreSummary { players: PlayerScoreBreakdown[]; winner: string | null }`
  — `winner` is the `playerId` with highest total VP, or `null` if tied
- VP value constants: `VP_VILLAIN`, `VP_HENCHMAN`, `VP_BYSTANDER`, `VP_TACTIC`,
  `VP_WOUND` — named exports, never inline numbers
- `// why:` comment on the MVP VP table: values are locked for MVP; card-text-
  specific VP modifiers are future packets

### B) `src/scoring/scoring.logic.ts` — new

- `computeFinalScores(G: LegendaryGameState): FinalScoreSummary`
  — pure function, read-only on `G`:
  1. For each player in `G.playerZones`:
     - Count villains in victory pile using `G.villainDeckCardTypes` classification
     - Count henchmen in victory pile using `G.villainDeckCardTypes`
     - Count bystanders in victory pile using `G.villainDeckCardTypes`
     - Count wounds across all player zones (deck + hand + discard + inPlay)
       — wound identification strategy must be documented in DECISIONS.md
  2. Count tactic VP from `G.mastermind.tacticsDefeated.length`
     — tactics VP is shared equally or awarded to the defeating player
     (MVP decision — document in DECISIONS.md)
  3. Compute `totalVP` per player
  4. Determine `winner` (highest total; `null` if tied)
  - Uses `for...of` loops for all accumulation (no `.reduce()` with branching)
  - `// why:` comment on wound identification approach
  - Returns `FinalScoreSummary` — never mutates `G`

- Pure helper, no boardgame.io import

### C) `src/game.ts` — modified

- Wire `computeFinalScores` into the `end` phase or make it callable after
  `endIf` returns a truthy `EndgameResult`
- The scoring result is available to the caller but NOT stored in `G` during MVP
- `// why:` comment: scoring is a derived view, not game state; storing it in
  `G` would violate the principle that `G` is runtime state managed by moves

### D) `src/types.ts` — modified

- Re-export `FinalScoreSummary`, `PlayerScoreBreakdown`, VP constants

### E) `src/index.ts` — modified

- Export `computeFinalScores`, `FinalScoreSummary`, `PlayerScoreBreakdown`,
  `VP_VILLAIN`, `VP_HENCHMAN`, `VP_BYSTANDER`, `VP_TACTIC`, `VP_WOUND`

### F) Tests — `src/scoring/scoring.logic.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Eight tests:
  1. Empty victory pile: player scores 0 total VP
  2. Victory pile with 2 villains + 1 bystander: scores 3 VP
  3. Wound in discard: -1 VP per wound
  4. Tactic defeated: +5 VP per tactic
  5. Multiple players: each gets independent score
  6. Tie: `winner` is `null`
  7. KO pile cards: contribute 0 VP
  8. `computeFinalScores` does not mutate input `G`
     (deep equality check before/after)

---

## Out of Scope

- **No card-text VP modifiers** — future packets (some cards grant extra VP)
- **No scheme-specific scoring rules** — WP-024/026
- **No balance tuning** — VP values are locked constants for MVP
- **No UI formatting or presentation** — scoring returns data, not display
- **No endgame detection** — WP-010 owns `endIf`; this packet only scores
- **No storing scores in `G`** — MVP scoring is a derived view, not state
- **No persistence or database storage of scores**
- **No server or UI changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/scoring/scoring.types.ts` — **new** —
  FinalScoreSummary, PlayerScoreBreakdown, VP constants
- `packages/game-engine/src/scoring/scoring.logic.ts` — **new** —
  computeFinalScores pure function
- `packages/game-engine/src/game.ts` — **modified** — wire scoring into end
  phase or post-endIf
- `packages/game-engine/src/types.ts` — **modified** — re-export scoring types
- `packages/game-engine/src/index.ts` — **modified** — export scoring API
- `packages/game-engine/src/scoring/scoring.logic.test.ts` — **new** — scoring
  unit tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### VP Constants
- [ ] `VP_VILLAIN`, `VP_HENCHMAN`, `VP_BYSTANDER`, `VP_TACTIC`, `VP_WOUND`
      are named exports (not inline numbers)
- [ ] Values match the MVP VP table exactly

### Score Computation
- [ ] `computeFinalScores` is a pure function — does not mutate `G`
- [ ] Returns `FinalScoreSummary` with per-player breakdowns
- [ ] Villains, henchmen, bystanders classified using `G.villainDeckCardTypes`
- [ ] Tactic VP computed from `G.mastermind.tacticsDefeated`
- [ ] Wound VP is negative (per wound = -1)
- [ ] KO pile cards are excluded (0 VP)
- [ ] Winner determined by highest total; `null` on tie

### Responsibility Split
- [ ] `computeFinalScores` does NOT call `endIf` or trigger endgame
- [ ] `computeFinalScores` does NOT store results in `G`
- [ ] `// why:` comment explaining scoring is a derived view, not game state

### Pure Helper
- [ ] `scoring.logic.ts` has no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `.reduce()` with branching logic in scoring
      (confirmed with `Select-String`)
- [ ] No registry import in scoring
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Test confirms empty pile = 0 VP
- [ ] Test confirms wound = -1 VP
- [ ] Test confirms tactic = +5 VP
- [ ] Test confirms `G` is not mutated by scoring
- [ ] All test files use `.test.ts`; no boardgame.io import

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding scoring
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in scoring
Select-String -Path "packages\game-engine\src\scoring\scoring.logic.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm no registry import in scoring
Select-String -Path "packages\game-engine\src\scoring\scoring.logic.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 5 — confirm no .reduce() with branching in scoring
Select-String -Path "packages\game-engine\src\scoring\scoring.logic.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 6 — confirm VP constants are named exports
Select-String -Path "packages\game-engine\src\scoring\scoring.types.ts" -Pattern "VP_VILLAIN|VP_HENCHMAN|VP_BYSTANDER|VP_TACTIC|VP_WOUND"
# Expected: 5 matches

# Step 7 — confirm no require()
Select-String -Path "packages\game-engine\src\scoring" -Pattern "require(" -Recurse
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
- [ ] No boardgame.io import in scoring files
      (confirmed with `Select-String`)
- [ ] No registry import in scoring files (confirmed with `Select-String`)
- [ ] No `.reduce()` in scoring files (confirmed with `Select-String`)
- [ ] VP constants are named exports (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — VP scoring exists; the full MVP game loop
      is complete (setup -> play cards -> fight -> recruit -> endgame -> score);
      Phase 4 is done
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why MVP VP table uses these
      specific values; how wounds are identified for scoring; how tactic VP is
      distributed (shared vs per-player); why scores are not stored in G
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-020 checked off with today's date
