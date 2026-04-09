# EC-020 — VP Scoring & Win Summary (Execution Checklist)

**Source:** docs/ai/work-packets/WP-020-vp-scoring-win-summary-minimal-mvp.md
**Layer:** Game Engine / Scoring

**Execution Authority:**
This EC is the authoritative execution checklist for WP-020.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-020.

---

## Before Starting

- [ ] WP-019 complete: `G.mastermind.tacticsDefeated` exists as `CardExtId[]`
- [ ] `G.playerZones[*].victory` contains defeated villains/henchmen/bystanders (WP-016, WP-017)
- [ ] `G.villainDeckCardTypes` maps cards to `RevealedCardType` (WP-014)
- [ ] `G.ko` exists as `CardExtId[]` (WP-017)
- [ ] `EndgameResult` exists in `endgame.types.ts` (WP-010)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-020.
If formatting, spelling, or ordering differs, the implementation is invalid.

- MVP VP Table (named constants -- never inline numbers):

  | Card Type | VP | Constant |
  |---|---|---|
  | Villain | +1 | `VP_VILLAIN` |
  | Henchman | +1 | `VP_HENCHMAN` |
  | Bystander | +1 | `VP_BYSTANDER` |
  | Mastermind Tactic | +5 | `VP_TACTIC` |
  | Wound | -1 | `VP_WOUND` |
  | Hero / Scheme / KO | 0 | (not scored) |

- `PlayerZones` keys (scoring reads): `deck` | `hand` | `discard` | `inPlay` | `victory`
- `interface PlayerScoreBreakdown { playerId: string; villainVP: number; henchmanVP: number; bystanderVP: number; tacticVP: number; woundVP: number; totalVP: number }`
- `interface FinalScoreSummary { players: PlayerScoreBreakdown[]; winner: string | null }`
- `winner` is highest total VP player, or `null` if tied

---

## Guardrails

- `computeFinalScores` is pure -- no I/O, no mutation of `G`, no side effects
- Registry boundary: scoring uses `G.villainDeckCardTypes` and `G.mastermind.tacticsDefeated` -- never registry
- VP values are named constants -- not inline numbers
- Scoring does NOT trigger endgame -- WP-010 owns `endIf`
- Scoring does NOT store results back into `G` during MVP
- KO'd cards contribute 0 VP -- explicitly excluded
- No `.reduce()` with branching logic -- use `for...of`
- No boardgame.io import in scoring files

---

## Required `// why:` Comments

- MVP VP table: values locked for MVP; card-text-specific VP modifiers are future packets
- Wound identification approach: document chosen strategy
- Scoring is a derived view, not game state: storing in G would violate runtime state principle

---

## Files to Produce

- `packages/game-engine/src/scoring/scoring.types.ts` -- **new** -- FinalScoreSummary, PlayerScoreBreakdown, VP constants
- `packages/game-engine/src/scoring/scoring.logic.ts` -- **new** -- computeFinalScores pure function
- `packages/game-engine/src/game.ts` -- **modified** -- wire scoring into end phase or post-endIf
- `packages/game-engine/src/types.ts` -- **modified** -- re-export scoring types
- `packages/game-engine/src/index.ts` -- **modified** -- export scoring API
- `packages/game-engine/src/scoring/scoring.logic.test.ts` -- **new** -- 8 tests

---

## Common Failure Smells (Optional)

- Heroes win when scheme should win -- evaluation order violated (WP-010)
- VP values differ from locked table -- constants were re-derived
- Scoring reads registry at runtime -- boundary violation
- Tests pass but `G` was mutated -- missing deep equality check

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No boardgame.io import in scoring files
- [ ] No registry import in scoring files
- [ ] VP constants are named exports (not inline numbers)
- [ ] `computeFinalScores` does not mutate input `G`
- [ ] `docs/ai/STATUS.md` updated (VP scoring exists; full MVP game loop complete; Phase 4 done)
- [ ] `docs/ai/DECISIONS.md` updated (MVP VP values rationale; wound identification; tactic VP distribution; scores not stored in G)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-020 checked off with date
