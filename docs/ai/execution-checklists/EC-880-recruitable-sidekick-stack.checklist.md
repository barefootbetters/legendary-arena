# EC-880 — Recruitable Sidekick Stack (Execution Checklist)

**Source:** docs/ai/work-packets/WP-842-recruitable-sidekick-stack.md
**Layer:** Game Engine + Arena Client (+ ewiki)

## Before Starting
- [ ] Scope lock: only the 24 files in Files to Produce (plus the governance close files listed there) change; check with `git status --porcelain`.
- [ ] WP-842 Assumes 1-14 hold on the execution baseline; re-read the line anchors in Assumes 5-12.
- [ ] `pnpm -r build` → 0; record the game-engine and arena-client test totals.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.

## Locked Values (do not re-derive)
- `SIDEKICK_EXT_ID = 'pile-sidekick'`; `SIDEKICK_RECRUIT_COST = 2` (fallback for `G.cardStats[SIDEKICK_EXT_ID]?.cost`); `SIDEKICK_RETURN_DRAW_COUNT = 2`.
- `TurnEconomy.hasRecruitedSidekickThisTurn?: true`, `TurnEconomy.sidekicksReturnedThisTurn?: number`: both in `CarriedTurnFields` + `carryConversionFlag`; setters `markSidekickRecruited`, `recordSidekickReturned` in the `enablePlayBothSides` shape; `resetTurnEconomy` unchanged.
- `recruitSidekick({ G, ctx })` = `recruitOfficer` with `piles.sidekicks`, the Sidekick cost, `if (G.turnEconomy.hasRecruitedSidekickThisTurn === true) return;` after the stage gate, `markSidekickRecruited(spendRecruit(...))`, and the log `` `Player ${ctx.currentPlayer} recruited ${formatCardRef(G.cardDisplayData, sidekickId)} from the Sidekick Stack (spent ${String(requiredCost)} recruit; sidekicks pile: ${String(G.piles.sidekicks.length)}).` ``
- `returnPlayedSidekick(G: LegendaryGameState, context: unknown, playerID: string)` (`unknown`: the `applyCardPlay` context fails TS2345 as `ShuffleProvider`; the `applyGrantedOutOfTime` precedent): last `inPlay` entry must be `pile-sidekick` → drop it, append to the END of `piles.sidekicks`, `recordSidekickReturned`; `drawsLocked` → `blocked` log, no draw; else `drawCardsIntoHand(zones, SIDEKICK_RETURN_DRAW_COUNT, context as ShuffleProvider)`, `cardsDrawn += drawn`, `applied` (`=== SIDEKICK_RETURN_DRAW_COUNT`) / `partial` (fewer) log. Log texts, card `SIDEKICK_EXT_ID`:
  - blocked: `` `Player ${playerID} returned a Sidekick to the bottom of the Sidekick Stack but can't draw — no more draws this turn.` ``
  - applied / partial: `` `Player ${playerID} returned a Sidekick to the bottom of the Sidekick Stack and drew ${String(drawnCount)} card(s).` ``
- Hook: last statement of `applyCardPlay`, after `applyGrantedOutOfTime`: `if (cardId === SIDEKICK_EXT_ID) { returnPlayedSidekick(G, context, playerID); }`.
- `playedCardIdsThisTurn` appends `SIDEKICK_EXT_ID` × `sidekicksReturnedThisTurn ?? 0` right after `playedCardIdsStillInPlay` and BEFORE the Out of Time loop (no de-dup among those appends; the early no-ledger `return` moves below it), so the loop's `includes` absorbs a replayed-then-returned Sidekick (T11b). Residual undercount pinned by T11c, named in D-24776.
- Move-count drift `game.test.ts`: `recruitSidekick` after `recruitOfficer` in the sorted array AND the L240 test title, a WP-842 why line, `exactly 54 moves`.
- UIState: `economy.hasRecruitedSidekickThisTurn?: true` (active player only, omit-when-absent, not in `REDACTED_ECONOMY`); `piles.sidekickDisplay?: UICardDisplay` = `resolveDisplay(SIDEKICK_EXT_ID, gameState)`, public, fresh-copied in the filter.
- Client gate order: turn → stage → heal lock → once-per-turn → empty Stack → `< 2` recruit. Reasons: `'You already recruited a Sidekick this turn.'`, `'No Sidekicks remain in the Sidekick Stack.'`, `` `Needs ${sidekickCost} recruit, you have ${props.economy.availableRecruit}.` ``. Test ids `play-shared-deck-sidekicks` (cell), `play-recruit-sidekick` (button). Dispatch `('recruitSidekick', {})`. Default title `` `Recruit a Sidekick for ${sidekickCost} recruit (once per turn)` ``. `sidekickDisplay()` fallback `{ extId: 'pile-sidekick', name: 'Sidekick', imageUrl: '', cost: null }`.

## Guardrails
- `recruitSidekick` is NOT in `CoreMoveName` / `CORE_MOVE_NAMES` / `MOVE_ALLOWED_STAGES` / `SIMULATION_MOVE_NAMES`. If a hash oracle, `sim:runtime-observed` or `sim:coverage` moves → STOP; do not re-pin.
- The block-all guard list is copied verbatim from `recruitOfficer`, same order, plus `hasHealedThisTurn`.
- Only `recruitSidekick` sets `hasRecruitedSidekickThisTurn`.
- Every non-Sidekick play is byte-identical (T9); no setup default is seeded for the two new `TurnEconomy` fields; the economy cue is omit-when-absent; `sidekickDisplay` is always built (the `officerDisplay` precedent).
- Moves never throw; every refusal is a silent no-op.
- Engine test pins of the new optional fields are runtime keyset assertions on built projections (D-24372), never bare `satisfies`.

## Required `// why:` Comments
- `recruitSidekick.ts`: cost source + fallback; `piles.sidekicks[0]` top convention; once-per-turn (rules v23 L727-729, card-effect gains exempt); the locked log line.
- `returnPlayedSidekick`: the automatic "may" (D-24776); the Out of Time last-entry guard; bottom = end of the pile; draw lock (D-24552); `cardsDrawn` (D-24732).
- `applyCardPlay` hook: after Out of Time so a set-aside wins.
- `playedCardIdsThisTurn`: "you still played that Sidekick" (rules v23); a count because tokens share one id; placed before the Out of Time loop so a replayed Sidekick counts once (the residual, D-24776).
- `returnPlayedSidekick` draw: the `context as ShuffleProvider` narrowing (heroEffectDraw precedent).
- `economy.types.ts` fields and the carry lines: lazily materialized, omit-when-absent hash stability.
- `game.ts`: `client: false` (D-10008). UIState build + filter: audience and omit-when-absent (the EC-206 drop).
- `SharedDecks.vue`: gate precedence; why `useCardCostGating.canRecruit` is not reused (token cost is null).

## Files to Produce
- Engine **new**: `moves/recruitSidekick.ts` + `.test.ts`
- Engine **modified**: `economy/economy.types.ts`, `economy/economy.logic.ts` + `economy.logic.test.ts`, `moves/coreMoves.impl.ts`, `hero/splitCard.logic.ts` + `splitCard.logic.test.ts`, `game.ts` + `game.test.ts`, `index.ts`, `replay/replay.execute.ts`, `ui/uiState.types.ts`, `ui/uiState.build.ts` + test, `ui/uiState.filter.ts` + test, `ui/uiState.types.drift.test.ts`
- Client **modified**: `components/play/uiMoveName.types.ts`, `composables/useTurnActions.ts` + test, `components/play/SharedDecks.vue` + test (the L186-197 "exactly one recruit button" case is rewritten to two buttons / three static cells, an intended behavior change named in the `EC-880:` commit body)
- ewiki **new**: `wiki/sidekicks.md`
- Governance close: `docs/ai/post-mortems/01.6-WP-842-recruitable-sidekick-stack.md` (**new**, mandatory: new execution path + projection fields), `DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## After Completing
- [ ] T1-T22 + T10b, T11b, T11c, T15b pass (T6 seeds the `sidekick-stack-marker` test string; T15b via `applyReplayStep`). `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] `sim:runtime-observed:check`, `sim:coverage --check` → 0, nothing regenerated; hash oracles unchanged; `ai.legalMoves.ts` has no `recruitSidekick`.
- [ ] Local match: Play Diagnostics `uiStateSnapshot` shows `economy.hasRecruitedSidekickThisTurn` and `piles.sidekickDisplay` (five-step contract, step 5).
- [ ] Ten revert proofs observed (WP-842 Verification 10). `pnpm wiki-viewer:project && pnpm wiki-viewer:check-links` → 0.
- [ ] Allowlist-only diff. Two-commit topology `EC-880:` then `SPEC:`.
- [ ] 01.6 post-mortem written. D-24776 Active; STATUS (+ gain-Sidekick, Special Sidekicks, bot buying follow-ups); WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0.
- [ ] Live-verify (D-24026) on a match created after the deploy, plus `ewiki.legendary-arena.com/sidekicks/` 200 via CF Access service-token curl; operator-pending until seen.

## Common Failure Smells
- "exactly 53 moves" fails → `game.test.ts` set / count not updated.
- Button always disabled → `useCardCostGating.canRecruit` (null cost) reused, or the cue never reaches the client (filter whitelist missing it, EC-206).
- The Sidekick stays in play → hook placed before `applyCardPlay`'s `inPlay` append, or the last-entry guard compares the wrong id.
- A "played N cards this turn" condition drops after a Sidekick play → the `playedCardIdsThisTurn` append is missing on the no-ledger path.
- Second recruit allowed → a later `spendRecruit` / `addResources` rebuild dropped the flag (carry line missing).
- A hash oracle moved → the move leaked into `SIMULATION_MOVE_NAMES`, or a setup default was seeded.
