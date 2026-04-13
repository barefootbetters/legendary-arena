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
- **MVP wound identification:** `cardId === WOUND_EXT_ID` where
  `WOUND_EXT_ID = 'pile-wound'` (from `pilesInit.ts`). No registry lookup.
- **MVP bystander dual-source:** Victory piles contain bystanders from two
  sources — check BOTH: (1) `G.villainDeckCardTypes[cardId] === 'bystander'`
  for villain-deck bystanders, AND (2) `cardId === BYSTANDER_EXT_ID`
  (`'pile-bystander'`) for rescued supply-pile bystanders. Both contribute
  `VP_BYSTANDER`.
- **MVP tactic VP distribution:** Each defeated tactic contributes `VP_TACTIC`
  to **every player's score**. WP-019 does not track which player defeated
  each tactic — per-player attribution is a future packet.
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
- `game.ts` must NOT be modified -- `computeFinalScores` is a pure library
  export, not wired into engine lifecycle during MVP
- Wounds identified by `WOUND_EXT_ID` constant -- no registry, no prefix
  matching, no setup-time tracking needed
- Bystander VP uses dual check: `G.villainDeckCardTypes` for villain-deck
  bystanders AND `BYSTANDER_EXT_ID` for rescued supply-pile bystanders
- Tactic VP awarded to all players -- not per-player (WP-019 lacks attribution)
- Scoring must NOT read `G.cardStats` -- stats are for gameplay effects,
  not VP classification
- Player iteration uses `Object.keys(G.playerZones).sort()` for deterministic
  ordering of `FinalScoreSummary.players`
- Cards not in `G.villainDeckCardTypes` score 0 VP (undefined = unknown = 0)
- Winner: exactly one player with max VP wins; ties produce `null` (no tiebreaker)

---

## Required `// why:` Comments

- MVP VP table: values locked for MVP; card-text-specific VP modifiers are future packets
- Wound identification: wounds identified by `WOUND_EXT_ID` constant
  (`'pile-wound'`) — no registry or card text inspection
- Bystander dual-source: victory bystanders come from villain deck
  (`G.villainDeckCardTypes`) and supply pile (`BYSTANDER_EXT_ID`) —
  scoring must check both
- Tactic VP distribution: every player receives full tactic VP because
  WP-019 does not track per-player tactic defeat attribution
- Scoring is a derived view, not game state: storing in G would violate
  runtime state principle; not wired into engine lifecycle during MVP

---

## Files to Produce

- `packages/game-engine/src/scoring/scoring.types.ts` -- **new** -- FinalScoreSummary, PlayerScoreBreakdown, VP constants
- `packages/game-engine/src/scoring/scoring.logic.ts` -- **new** -- computeFinalScores pure function
- `packages/game-engine/src/types.ts` -- **modified** -- re-export scoring types
- `packages/game-engine/src/index.ts` -- **modified** -- export scoring API
- `packages/game-engine/src/scoring/scoring.logic.test.ts` -- **new** -- 8 tests

---

## Common Failure Smells (Optional)

- Heroes win when scheme should win -- evaluation order violated (WP-010)
- VP values differ from locked table -- constants were re-derived
- Scoring reads registry at runtime -- boundary violation
- Tests pass but `G` was mutated -- missing deep equality check
- `game.ts` modified to wire scoring -- MVP keeps scoring as pure library export
- Wounds identified by prefix matching or registry -- should use `WOUND_EXT_ID` constant
- Tactic VP awarded per-player -- WP-019 lacks attribution data
- Only `G.villainDeckCardTypes` checked for bystanders -- misses rescued
  supply-pile bystanders (`BYSTANDER_EXT_ID`)

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No boardgame.io import in scoring files
- [ ] No registry import in scoring files
- [ ] VP constants are named exports (not inline numbers)
- [ ] `computeFinalScores` does not mutate input `G`
- [ ] `docs/ai/STATUS.md` updated (VP scoring exists; full MVP game loop complete; Phase 4 done)
- [ ] `game.ts` NOT modified (`git diff --name-only`)
- [ ] `docs/ai/DECISIONS.md` updated (MVP VP values rationale; wound
      identification via WOUND_EXT_ID; tactic VP to all players; scores
      not stored in G; game.ts not modified)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-020 checked off with date
