# Session Execution Prompt — WP-020 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-020 — VP Scoring & Win Summary (Minimal MVP)
**Mode:** Implementation (WP-020 not yet implemented)
**Pre-Flight:** Complete (2026-04-12) — build green (239 tests passing),
authority chain aligned, bystander dual-source rule locked, wound/tactic
VP rules locked, game.ts NOT modified rule locked
**EC:** `docs/ai/execution-checklists/EC-020-vp-scoring.checklist.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- All WP-020 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - §4 "The endIf Contract" (scoring runs AFTER endIf, never triggers it)
   - §2 "Zone & Pile Structure" (victory zones, pile contents)
   - §2 "Card Data Flow: Registry into Game Engine"
   - "Layer Boundary (Authoritative)"
3. `docs/ai/execution-checklists/EC-020-vp-scoring.checklist.md`
4. `docs/ai/work-packets/WP-020-vp-scoring-win-summary-minimal-mvp.md`
5. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()` with branching), 13 (ESM only)

**Implementation anchors (patterns, not templates):**

6. `packages/game-engine/src/endgame/endgame.evaluate.ts` — read
   `evaluateEndgame`. This is the pattern for a pure read-only function
   that examines `G` and returns a structured result without mutation.
   `computeFinalScores` follows this exact pattern.
7. `packages/game-engine/src/villainDeck/villainDeck.types.ts` — read
   `RevealedCardType` union (`'villain' | 'henchman' | 'bystander' |
   'scheme-twist' | 'mastermind-strike'`). Scoring classifies victory
   pile cards against these types via `G.villainDeckCardTypes`.
8. `packages/game-engine/src/setup/pilesInit.ts` — read `WOUND_EXT_ID`
   (`'pile-wound'`) and `BYSTANDER_EXT_ID` (`'pile-bystander'`). These
   are the well-known constants for wound and supply-pile bystander
   identification.
9. `packages/game-engine/src/types.ts` — read `LegendaryGameState` to
   understand the full shape scoring reads from.

---

## Runtime Wiring Allowance (01.5)

**Not applicable.** WP-020 adds no new fields to `LegendaryGameState`,
no new moves, and no phase hooks. `game.ts` is NOT modified.
`computeFinalScores` is a pure library export that reads existing `G`
fields only. No existing test mock factories need updating.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any mutation of `G` inside `computeFinalScores` — scoring is read-only
- Any modification of `game.ts` — scoring is NOT wired into engine
  lifecycle during MVP
- Any `boardgame.io` import in scoring files
- Any `@legendary-arena/registry` import in scoring files
- Any `.reduce()` with branching logic — use `for...of`
- Any `Math.random()` in any new file
- Any `require()` in any new file
- Any inline VP numbers instead of named constants
- Any use of `MoveResult` / `MoveError` — scoring has its own return type
- Storing scores in `G` — MVP scoring is a derived view
- Reading `G.cardStats` for VP classification — stats are for gameplay
  effects; VP uses only `villainDeckCardTypes`, `tacticsDefeated`, and
  known pile constants (`WOUND_EXT_ID`, `BYSTANDER_EXT_ID`)
- Triggering endgame from scoring — WP-010 owns `endIf`
- Only checking `G.villainDeckCardTypes` for bystanders — must ALSO check
  `BYSTANDER_EXT_ID` for rescued supply-pile bystanders
- Only checking `BYSTANDER_EXT_ID` for bystanders — must ALSO check
  `G.villainDeckCardTypes` for villain-deck bystanders
- Awarding tactic VP per-player — MVP awards to ALL players (WP-019
  lacks per-player attribution)
- Expand scope beyond WP-020 (no "while I'm here" improvements)
- Modify files not listed in WP-020 "Files Expected to Change"

---

## Implementation Tasks (Authoritative)

### A) Create `src/scoring/scoring.types.ts` (new)

```ts
// why: MVP VP values locked as named constants. Card-text-specific VP
// modifiers (some cards grant extra VP) are future packets.
export const VP_VILLAIN = 1;
export const VP_HENCHMAN = 1;
export const VP_BYSTANDER = 1;
export const VP_TACTIC = 5;
export const VP_WOUND = -1;
```

```ts
export interface PlayerScoreBreakdown {
  playerId: string;
  villainVP: number;
  henchmanVP: number;
  bystanderVP: number;
  tacticVP: number;
  woundVP: number;
  totalVP: number;
}

export interface FinalScoreSummary {
  /** Per-player VP breakdowns, one entry per player. */
  players: PlayerScoreBreakdown[];
  /** Player with highest total VP, or null if tied. */
  winner: string | null;
}
```

Export all constants and interfaces.

---

### B) Create `src/scoring/scoring.logic.ts` (new, pure helper)

**No boardgame.io imports. No `.reduce()` with branching. No mutation.
No throws. No registry access.**

```ts
computeFinalScores(G: LegendaryGameState): FinalScoreSummary
```

**Algorithm:**

1. For each player in `G.playerZones` — iterate using
   `Object.keys(G.playerZones).sort()` to ensure deterministic ordering
   of `FinalScoreSummary.players`:
   a. **Victory pile classification** — iterate `playerZones[playerId].victory`
      using `for...of`:
      - If `G.villainDeckCardTypes[cardId] === 'villain'`: increment villain count
      - If `G.villainDeckCardTypes[cardId] === 'henchman'`: increment henchman count
      - **Bystander dual check** (CRITICAL):
        If `G.villainDeckCardTypes[cardId] === 'bystander'` OR
        `cardId === BYSTANDER_EXT_ID`: increment bystander count
      - If `G.villainDeckCardTypes[cardId]` is `undefined`: contributes 0 VP
        (only villain-deck cards appear in the lookup; heroes, starting cards,
        and other non-deck cards are unknown and score 0)
      - All other classified types (scheme-twists, mastermind-strikes):
        contribute 0 VP

   b. **Wound count** — iterate ALL player zones (deck + hand + discard +
      inPlay) using `for...of`:
      - If `cardId === WOUND_EXT_ID`: increment wound count
      - Do NOT count victory pile for wounds (wounds in victory would be
        unusual but should not double-count)

   c. Build `PlayerScoreBreakdown`:
      - `villainVP = villainCount * VP_VILLAIN`
      - `henchmanVP = henchmanCount * VP_HENCHMAN`
      - `bystanderVP = bystanderCount * VP_BYSTANDER`
      - `woundVP = woundCount * VP_WOUND` (negative)
      - `tacticVP` = computed once (see step 2)
      - `totalVP = villainVP + henchmanVP + bystanderVP + tacticVP + woundVP`

2. **Tactic VP** (shared across all players):
   - `tacticVP = G.mastermind.tacticsDefeated.length * VP_TACTIC`
   - Add this value to **every** player's breakdown

**Required comments:**
```ts
// why: bystanders in victory come from two sources — villain-deck
// bystanders (tracked in G.villainDeckCardTypes) and rescued supply-pile
// bystanders (using BYSTANDER_EXT_ID from WP-017). Both contribute VP.
```
```ts
// why: wounds identified by WOUND_EXT_ID constant ('pile-wound') — all
// wound cards share this single ext_id. No registry or card text needed.
```
```ts
// why: MVP awards tactic VP to every player because WP-019 does not
// track which player defeated each tactic. Per-player attribution is
// a future packet.
```

3. **Determine winner** (exact algorithm):
   - Compute `maxVP = Math.max(...players.map(p => p.totalVP))`
   - Collect all players where `totalVP === maxVP`
   - If exactly one player: `winner = playerId`
   - If more than one player: `winner = null` (tie)
   - No tiebreaker logic in MVP — ties are ties

4. Return `{ players: [...breakdowns], winner }`

**Imports:** `WOUND_EXT_ID`, `BYSTANDER_EXT_ID` from
`../setup/buildInitialGameState.js` (re-exported from `pilesInit.ts`).
VP constants from `./scoring.types.js`. `LegendaryGameState` type from
`../types.js`.

---

### C) `src/game.ts` — NOT modified

**Hard rule:** Do NOT modify `game.ts` for WP-020. `computeFinalScores`
is a pure library export consumed by future UI/server/snapshot code.
It is not wired into any boardgame.io lifecycle hook during MVP.

---

### D) Modify `src/types.ts`

Re-export scoring types and constants:

```ts
export type { FinalScoreSummary, PlayerScoreBreakdown } from './scoring/scoring.types.js';
export { VP_VILLAIN, VP_HENCHMAN, VP_BYSTANDER, VP_TACTIC, VP_WOUND } from './scoring/scoring.types.js';
```

---

### E) Modify `src/index.ts`

Export scoring API:

```ts
export { computeFinalScores } from './scoring/scoring.logic.js';
export type { FinalScoreSummary, PlayerScoreBreakdown } from './scoring/scoring.types.js';
export { VP_VILLAIN, VP_HENCHMAN, VP_BYSTANDER, VP_TACTIC, VP_WOUND } from './scoring/scoring.types.js';
```

---

## Tests (8 Total — 1 New File)

All test files: `node:test`, `node:assert`, `.test.ts` extension.
No boardgame.io imports.

### F) `src/scoring/scoring.logic.test.ts` — 8 tests

Construct minimal mock `G` objects directly (no `makeMockCtx` needed —
scoring doesn't use `ctx`). Each mock G needs at minimum:
`playerZones`, `villainDeckCardTypes`, `mastermind.tacticsDefeated`,
`ko`. Use known card IDs that map to known types.

1. **Empty victory pile:** player scores 0 total VP
   - Victory pile `[]`, no wounds, no tactics defeated
   - Assert `totalVP === 0`

2. **Victory pile with 2 villains + 1 bystander:** scores 3 VP
   - Place 2 villain ext_ids and 1 bystander ext_id in victory
   - Map them in `G.villainDeckCardTypes`
   - Assert `villainVP === 2`, `bystanderVP === 1`, `totalVP === 3`

3. **Wound in discard:** -1 VP per wound
   - Place `WOUND_EXT_ID` cards in discard
   - Assert `woundVP === -N` for N wounds

4. **Tactic defeated:** +5 VP per tactic (awarded to all players)
   - Set `G.mastermind.tacticsDefeated` with entries
   - Assert each player's `tacticVP === length * VP_TACTIC`

5. **Multiple players:** each gets independent score
   - Two players with different victory piles
   - Assert independent VP calculations

6. **Tie:** `winner` is `null`
   - Two players with identical total VP
   - Assert `winner === null`

7. **KO pile cards:** contribute 0 VP
   - Place cards in `G.ko` — assert they do not appear in any score

8. **No mutation:** `computeFinalScores` does not mutate input `G`
   - Deep-clone G before, call scoring, deep-compare after
   - Assert `JSON.stringify(before) === JSON.stringify(after)`

**Bystander test note:** At least one test must include a rescued
supply-pile bystander (`BYSTANDER_EXT_ID = 'pile-bystander'`) that is
NOT in `G.villainDeckCardTypes`, to prove the dual-check works. Test 2
or a separate assertion within test 5 is appropriate.

---

## Verification (Run All Before Completion)

```bash
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all tests pass, 0 fail

# Step 3 — no boardgame.io import in scoring
grep -l "boardgame.io" packages/game-engine/src/scoring/scoring.logic.ts packages/game-engine/src/scoring/scoring.types.ts
# Expected: no output (or comment-only)

# Step 4 — no registry import in scoring
grep -l "@legendary-arena/registry" packages/game-engine/src/scoring/scoring.logic.ts
# Expected: no output

# Step 5 — no .reduce() in scoring
grep -rn "\.reduce(" packages/game-engine/src/scoring/
# Expected: no output

# Step 6 — VP constants are named exports
grep -c "VP_VILLAIN\|VP_HENCHMAN\|VP_BYSTANDER\|VP_TACTIC\|VP_WOUND" packages/game-engine/src/scoring/scoring.types.ts
# Expected: 5 or more

# Step 7 — no require()
grep -rn "require(" packages/game-engine/src/scoring/
# Expected: no output

# Step 8 — game.ts NOT modified
git diff --name-only packages/game-engine/src/game.ts
# Expected: no output

# Step 9 — BYSTANDER_EXT_ID used in scoring (dual check)
grep -n "BYSTANDER_EXT_ID" packages/game-engine/src/scoring/scoring.logic.ts
# Expected: at least one match

# Step 10 — WOUND_EXT_ID used in scoring
grep -n "WOUND_EXT_ID" packages/game-engine/src/scoring/scoring.logic.ts
# Expected: at least one match

# Step 11 — no boardgame.io in test files
grep -l "boardgame.io" packages/game-engine/src/scoring/scoring.logic.test.ts
# Expected: no output (or comment-only)

# Step 12 — confirm no files outside scope were changed
git diff --name-only
# Expected: only WP-020 files (types.ts, index.ts + new scoring/)
```

All grep checks must return empty (or comment-only). Build and tests
must exit 0.

---

## Post-Execution Documentation

1. **`docs/ai/DECISIONS.md`** — add entries:
   - D-2001: MVP VP table values (VP_VILLAIN=1, VP_HENCHMAN=1,
     VP_BYSTANDER=1, VP_TACTIC=5, VP_WOUND=-1) are locked constants.
     Card-text VP modifiers are future packets. Values chosen for MVP
     simplicity, not balance.
   - D-2002: Wounds identified by `WOUND_EXT_ID = 'pile-wound'` constant
     comparison. All wound cards share this single ext_id from WP-017.
     No registry lookup needed.
   - D-2003: Tactic VP awarded to all players — WP-019's
     `G.mastermind.tacticsDefeated` does not track which player defeated
     each tactic. Per-player attribution is a future packet.
   - D-2004: Scores not stored in `G` during MVP — scoring is a derived
     view, not game state. Future UI/snapshot code calls
     `computeFinalScores` explicitly.
   - D-2005: `game.ts` not modified — scoring is a pure library export,
     not wired into engine lifecycle. Automatic invocation is a future
     concern.
   - D-2006: Bystander VP uses dual-source check —
     `G.villainDeckCardTypes` for villain-deck bystanders AND
     `BYSTANDER_EXT_ID` for rescued supply-pile bystanders. Both
     contribute `VP_BYSTANDER`.

2. **`docs/ai/STATUS.md`** — VP scoring exists; full MVP game loop
   complete (setup -> play cards -> fight villains -> recruit heroes ->
   fight mastermind -> endgame -> score); Phase 4 is done

3. **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-020 with
   today's date
