# EC-724 — Final Blow Endgame Gate + UI (Execution Checklist)

**Source:** docs/ai/work-packets/WP-687-final-blow-endgame-gate-and-ui.md
**Layer:** Game Engine + Arena Client

## Before Starting
- [ ] **WP-686 is merged on `main`**: `G.finalBlow?: boolean` seeded (optional,
      omitted when off) — else this WP is BLOCKED, STOP
- [ ] Record the current sentinel `finalStateHash` as the off-path baseline;
      it must stay unchanged (a `finalBlow: false` match is byte-identical)
- [ ] `fightMastermind.ts` Step 1 still early-returns on empty `tacticsDeck`
      (`:72`); `defeatMastermindTacticCore` sets `MASTERMIND_DEFEATED` on
      `areAllTacticsDefeated` (`:262`) — re-verify against HEAD
- [ ] `UIMastermindState` (uiState.types.ts) + the build literal + the
      filter whitelist + the filter test template exist as surveyed
- [ ] `MastermindTile.vue` `gateForFight()` locks on `tacticsRemaining === 0`
      (`:83-88`); `MastermindTile.test.ts` pins it (~`:105`)
- [ ] `resolveMastermindFightCost(G)` is exported from economy.resolve.ts
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] Target file set is EXACTLY `## Files to Produce`; anything outside is a FAIL

## Locked Values (do not re-derive)
- Engine reads: `G.finalBlow === true` (WP-686, optional, absent = off) + `G.mastermind.finalBlowPending?: boolean` (optional, omitted when off)
- Availability: `G.finalBlow === true && tacticsDeck.length === 0 && finalBlowPending && card not yet awarded`
- The 5th fight is a DISTINCT self-contained branch in `fightMastermind` that does NOT fall into `defeatMastermindTacticCore` (its empty-deck no-op would spend attack for nothing)
- Final fight cost: `resolveMastermindFightCost(G)` (Mastermind's own cost)
- Victory-Pile award on final blow: `G.mastermind.baseCardId` (a CardExtId string, via zoneOps), awarded exactly once
- Endgame counter set on final blow: `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED = 1` (reused, NOT a new condition)
- UIState field: `UIMastermindState.finalBlowPending?: boolean`
- Re-pin: expected NONE (`finalBlowPending?` omitted when off; no committed fixture uses Final Blow) — verify empirically, re-pin only if an oracle actually moves
- DECISIONS entry: **D-24504**

## Guardrails
- Gate every new branch on `G.finalBlow`; the `false` path MUST stay
  byte-identical to today (mandatory regression pin) — if an off-path hash
  oracle moves, STOP and investigate
- Reuse `MASTERMIND_DEFEATED`; do NOT add an `ENDGAME_CONDITIONS` member
- Five-step Board-Visible Field Rule: declare → build → **filter pass-through**
  → filter test → Play Diagnostics; a field missing from the filter is silently
  dropped (the EC-206 shipped failure) — STOP if the filter is not updated
- The Mastermind card enters exactly ONE Victory Pile ONCE; the deferred
  4th-tactic branch must NOT also award it (double-award guard)
- `defeatMastermindTacticCore` is SHARED — Silent Sniper's `resolveDefeatChoice`
  also drives it, so a Silent Sniper last-tactic defeat under Final Blow also
  defers the win (rulebook-correct); confirm `resolveDefeatChoice` has no
  separate win path that bypasses/double-sets the counter
- The 5th fight is a DISTINCT branch, NOT merely removing Step 1's early return
  (falling through reaches the core's own empty-deck no-op while `spendFightCost`
  / `hasActedThisTurn` still run — attack spent, nothing awarded)
- Tile precedence stays stage → cost → structural: when `finalBlowPending`
  inverts the 0-tactics lock, the cost gate must still block an under-resourced
  final fight (mirrors the engine silent no-op)
- Moves never throw (insufficient-attack final fight = silent no-op); zones
  store strings; mutate via zoneOps; no `.reduce()`; no `Math.random()`
- Client renders gameText through `AbilityText.vue`; the badge is plain copy
- arena-client `typecheck` (vue-tsc) is load-bearing — build/test don't check SFCs

## Required `// why:` Comments
- `fightMastermind.ts` deferred-defeat branch: the Final Blow rule (4th tactic
  no longer wins; Mastermind stays fightable) — cite the rulebook + D-24504
- `fightMastermind.ts` final-fight `MASTERMIND_DEFEATED` write + card award
- `mastermind.types.ts` `finalBlowPending?`: optional so off-matches serialize
  byte-identically (hypnoThralls?/gameText? precedent)
- `uiState.filter.ts` pass-through: why the field is public shared-board
- any state-hash re-pin (expected NONE): if one moves, which oracle and why —
  but the field is omitted when off, so no committed fixture should move

## Files to Produce
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** — final-blow-aware core + 5th-fight path + card award
- `packages/game-engine/src/mastermind/mastermind.types.ts` — **modified** — `finalBlowPending?: boolean`
- `packages/game-engine/src/mastermind/mastermind.logic.ts` — **modified** — `isFinalBlowAvailable` + state helper
- `packages/game-engine/src/endgame/endgame.evaluate.ts` — **verify** (edit only if required; document deviation)
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `finalBlowPending?` on `UIMastermindState`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate the field
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — whitelist pass-through
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — per-audience survival
- `packages/game-engine/src/moves/fightMastermind.test.ts` — **modified** — final-blow ON/OFF + award + no-op + regression
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — field value
- engine state-hash oracle tests — **verify only; edit only if a pin unexpectedly moves** — expected: NO re-pin (field omitted when off)
- `apps/arena-client/src/components/play/MastermindTile.vue` — **modified** — invert 0-tactics lock; final-blow affordance
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — **modified** — final-blow gate pins
- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — widen `createMatch` AND `createMatchWithBot` `config`/`setupData` type to `MatchConfiguration`
- `apps/arena-client/src/lobby/useCreateMatchFromComposition.ts` — **modified** — widen `LaunchMatchInput.config` to `MatchConfiguration`
- `apps/arena-client/src/lobby/LobbyView.vue` (the `launchMatchFromComposition` caller; confirm at execution) + its test — **modified** — "Final Blow (optional)" toggle + round-trip assertion
- `docs/ai/DECISIONS.md` — **modified** — land D-24504
- `docs/ai/STATUS.md` — **modified** — live-verified entry
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-687 check-off
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-724 → Done
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-687 node `📝` → `✅` + counts

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] Live-on-surface (D-24026): on play.legendary-arena.com a Final Blow match
      keeps the Mastermind fightable after the 4th tactic and wins only on the
      5th fight — record the evidence in STATUS.md
- [ ] `git diff --name-only` shows only the files above
- [ ] `docs/ai/DECISIONS.md` D-24504 landed (incl. the hashed-G re-pin note)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-687 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph updated, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- A blank Mastermind tile / no final-blow affordance → the new field reached
  build but not the audience filter (EC-206 drop)
- The win still fires on the 4th tactic under Final Blow → the deferred branch
  didn't gate on `G.finalBlow`, or the availability helper is wrong
- A `finalBlow: false` sentinel hash moved → the off-path is not byte-identical
- The Mastermind card in two Victory Piles / twice → double-award guard missing
