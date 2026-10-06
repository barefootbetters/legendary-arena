# EC-830 — A Villain escape follows the rulebook procedure (Execution Checklist)

**Source:** docs/ai/work-packets/WP-793-villain-escape-rulebook-procedure.md
**Layer:** Game Engine (+ arena-client prompt headings)

## Before Starting
- [ ] WP-749 (D-24573) is merged on `main`. If not, STOP: this packet is BLOCKED on it. Re-read where WP-749's non-active-seat branch and its post-move mirrors sit in both sim loops.
- [ ] `pnpm -r build` exits 0; record baselines (re-record after WP-792 / WP-749): engine, arena-client, dashboard `test` (draft: 4838 / 2262 / 570, 0 fail); arena-client and dashboard `typecheck` exit 0 (Before)
- [ ] Confirm on `main`:
  - `resolveVillainEscape` still holds the D-24439 generic-Wound block;
  - Secret Invasion still runs its reduced escape block;
  - `applySeatChoiceByKind` and `turn.onMove`'s Diving Block opener match WP §Assumes;
  - `DECISIONS.md` carries D-24656 as Drafted.
  If any differs, STOP and report.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- Kinds: `'escape-hq-ko'`, `'escape-bystander-discard'` (`villainDeck/villainEscapeProcedure.ts`); `'return-on-discard'` (`moves/resolveReturnOnDiscard.ts`). `ESCAPE_HQ_KO_MAX_COST = 6`.
- `PendingEscapeProcedure { escapedCardId: CardExtId; chooserPlayerID: string; hasCarriedBystanders: boolean; isHqKoResolved: boolean }`. `G.pendingEscapeProcedures?` is lazy, the key is deleted when empty (only `dropAllPendingPlayerChoices` assigns `undefined`), never set in setup. The new module exports nothing beyond the WP list.
- Escape site: delete the generic-Wound block and the now-unused `gainWoundForPlayer` / `villainCardHasEscapeAbility` imports. After the carry and before the onEscape dispatch, call `enqueueEscapeProcedure(G, escapedCardId, ctx.currentPlayer, hasCarriedBystanders)`.
- Escape opener: returns at once while `hasAnyPendingChoice(G)` (exported unchanged from `moves/phaseCard.ts`) is true or `G.pendingHeroChoice !== undefined`, or when `evaluateEndgame(G) !== null`. The `evaluateEndgame` check is made at the head of every loop iteration, and an automatic KO is followed by `applyPileDepletionResourceLoss(G)` before the next iteration. When drained: `delete G.pendingEscapeProcedures`.
  - Step 1 eligible = non-null HQ slots with cost ≤ 6, sorted cost then slot. 0 → no-op line; 1 → auto KO; 2+ → park for the chooser with the active-seat skip. Mark the step resolved in every case.
  - Step 2: pop the entry. If Bystanders were carried, park the discard for every seat with a hand card (ascending), with **no** skip unless the active seat is the sole addressed seat.
  - Options `{ label, cardId }`; `defaultOptionIndex: 0`.
- KO mutation: `G.hq[slot] = null; G.ko = koCard(G.ko, id); const refill = refillHqSlot(G.hq, slot, G.heroDeck); G.hq = refill.hq; G.heroDeck = refill.heroDeck;`. A card no longer in `G.hq` → logged no-op. The log's Villain is `G.pendingEscapeProcedures[0].escapedCardId`; the entry stays at the front until step 2 pops it. Discard apply: ascending seats → `discardFromHand`.
- Log lines (verbatim, WP §Locked Contract Values):
  - `Escape: ${villain} KO'd ${hero} from the HQ.`
  - `Escape: ${villain} KO'd nothing — no Hero in the HQ costs 6 or less.`
  - `Player ${seat} discarded ${card} (Bystanders carried away).`
  - `Escape: no player has a card to discard for the Bystanders carried away.`
- Return-on-discard opener: returns at once while a seat choice is open; otherwise only for a front entry whose `playerID !== currentPlayer`, and never once `evaluateEndgame(G) !== null`. Options `Return <name> to your hand` / `Leave <name> in your discard pile`, each with `cardId: front.cardId`, default 0. The apply duplicates the legacy move's decline/return mutation (no shared helper; the legacy body is untouched apart from the guard). It proceeds only if the front entry still matches the seat and `cardId`, else a logged no-op. `resolveReturnOnDiscard` returns at once while `G.pendingSeatChoice?.kind === 'return-on-discard'`. `buildUIState` projects `pendingReturnOnDiscard` only for an active-player front entry.
- `turn.onMove` order after `resolveDeferredHeroGrants`:
  1. return-on-discard opener;
  2. escape opener;
  3. `latchFinalTurnIfDeckExhausted(G)` + `applyPileDepletionResourceLoss(G)` again;
  4. the Diving Block opener.
- Sim mirrors: openers 1 and 2 (events undefined), then `applyPileDepletionResourceLoss`, at every post-move mirror site in `simulation.runner.ts` and `par.aggregator.ts` (the deferred-grant site and WP-749's non-active branch, before its `continue`). The argument is the loop's `currentPlayer`, never the move context's ctx. `runFixture`: the two openers only (no depletion mirror), after its deferred-grant mirror, with `cursor.currentPlayer`; correct its header comment.
- The `seatChoiceDispatch.test.ts` case is a hand-built-`G` harness case per WP §Scope F (fallback: `runFixture` with a scripted move list).
- Secret Invasion: refill the vacated HQ slot first, then `resolveVillainEscape(gameState, context, implementationMap, pushResult.escapedCard)`.
- Headings:
  - `A Villain escaped — choose a Hero in the HQ to KO`
  - `Bystanders were carried away — choose a card to discard`
  - `Return the discarded card to your hand?`
- Expected re-pins (real-opener scaffold): runtime-observed 7959 → 7980 obs, 81 mechanics, 0 dropped; dashboard `totalObs` 8884 → 8903. Re-measure after WP-749 and WP-792.

## Guardrails
- No new move, no new `hasPending*` guard, no new `UIState` field. The `game.test.ts` move pin, `SIMULATION_MOVE_NAMES` and both `MOVE_MAP`s are unchanged. `buildSeatChoiceActivePlayersValue` is unchanged.
- Step 3 (onEscape, captured-Hero KO, Mystique, resource loss) keeps its code and order inside the move.
- Every hand→discard goes through `discardFromHand`. `resolveReturnOnDiscard`'s move behavior stays byte-identical for every previously reachable state.
- Authorized existing-test edits ONLY: the generic-Wound assertion becomes "no Wound" (rename the test if its title names the Wound; keep every other assertion). The tests:
  - `escape-wound.integration.test.ts` L122, L221
  - `economy.integration.test.ts` L344
  - `exorciseHauntedHero.test.ts` L251
  - `villainDeck.enterCity.test.ts` L132
  - `villainDeck.reveal.test.ts` L1216, L1804, L2263
  - the dashboard `totalObs` pin
  - adding `'pendingEscapeProcedures'` to the `mastermindVictory.logic.test.ts` field list
- Session protocol — STOP and report if:
  - any other existing test fails;
  - the sentinel `finalStateHash` or `PRE_WP080_HASH` moves;
  - `sim:runtime-observed` reports a non-terminating game or a dropped mechanic;
  - a gate other than the forced re-pins shows a diff.
- Fixtures and feeds are regenerated by their scripts, never hand-edited. Do NOT regenerate `data/par/**`. No database access.
- Moves and helpers never throw. No `Math.random()`, no `.reduce()`, no `boardgame.io` import in the new module or its test. Cross-module references stay inside function bodies (import-cycle safety).

## Required `// why:` Comments
- `ESCAPE_HQ_KO_MAX_COST`: rules v23 L561.
- The enqueue call: steps 1–2 are owed in rule order but resolve after the move (D-24656 point 4); step 3 stays inline (L573).
- Each `turn.onMove` opener, the depletion re-check, and each sim / `runFixture` mirror: why that order, why before Diving Block, why the loop's active seat.
- The discard park with no skip: a mixed ride must admit the active seat (D-24656 point 3).
- The `pendingReturnOnDiscard` projection gate: a non-active owner answers only through its seat choice.
- Each new cross-module import, including the new module → `phaseCard.ts` edge: the cycle note (the `divingBlock.logic.ts` precedent).
- `dropAllPendingPlayerChoices`: the new queue joins the drop set.
- The re-pinned `totalObs`: a dated provenance note (WP-793 / D-24656).

## Files to Produce
- `packages/game-engine/src/villainDeck/villainEscapeProcedure.ts` — **new**
- `packages/game-engine/src/villainDeck/villainEscapeProcedure.test.ts` — **new**
- Engine — **modified**:
  - `villainDeck/villainDeck.reveal.ts`, `villainDeck/villainDeck.enterCity.ts` (comment only);
  - `rules/schemeTwistResolvers.ts`, `types.ts`, `moves/seatChoice.resolve.ts`, `moves/resolveReturnOnDiscard.ts`, `moves/phaseCard.ts` (`export` only);
  - `ui/uiState.build.ts`, `game.ts`, `endgame/mastermindVictory.logic.ts`;
  - `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `test/fixtures/runFixture.ts`
- Tests — **modified**:
  - `moves/resolveReturnOnDiscard.test.ts`, `ui/uiState.build.test.ts`, `game.test.ts`, `endgame/mastermindVictory.logic.test.ts`;
  - `simulation/seatChoiceDispatch.test.ts` (created by WP-749);
  - `board/escape-wound.integration.test.ts`, `economy/economy.integration.test.ts`, `moves/exorciseHauntedHero.test.ts`;
  - `villainDeck/villainDeck.enterCity.test.ts`, `villainDeck/villainDeck.reveal.test.ts`
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + `.test.ts` — **modified**
- `docs/ai/coverage/runtime-observed-hollows.json` (`pnpm sim:runtime-observed`), `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (`totalObs` + comment only) — **modified**
- `wiki/villain-deck.md` — **modified**
- Generated, ONLY with a real gate diff (none expected): the hero-effect coverage baseline, `effect-implementation-index.json`, `card-mechanics.json`, the hero / villain mechanic ledgers
- `docs/ai/post-mortems/01.6-WP-793-villain-escape-rulebook-procedure.md` — **new**
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] Engine, arena-client and dashboard at 0 fail, before/after counts recorded; both typechecks exit 0; `pnpm -r --no-bail test` 0 failures
- [ ] 6/6 revert proofs (restore the Wound; restore the reduced Secret Invasion block; drop the escape opener; drop the return-on-discard opener; drop the any-pending wait; drop the legacy-move guard), each failing ≥ 1 new test. The `game.test.ts` real-reducer case accepts the active seat's discard first.
- [ ] Sentinel and `PRE_WP080_HASH` unchanged. Checks OK:
  - `sim:runtime-observed:check` after regeneration (312 terminate, 0 dropped);
  - `sim:coverage --check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`, `ledger:villains:check`;
  - `wiki:lint`, `wiki-viewer:check-links`; the WP `Select-String` checks return nothing
- [ ] `git status --porcelain` ⊆ Files to Produce (revert `lagn-v1.json` CRLF churn)
- [ ] Commit 1, `EC-830: …`: names each authorized test edit as an intentional behavior change; `Tests-changed:` and `Vision: §1, §3, §4, §8, §14, §18, §20–§24, §26` trailers
- [ ] Commit 2, `SPEC: WP-793 / EC-830 govern-close — …`:
  - STATUS.md;
  - D-24656 → Active with gates, plus the D-1702 and D-24439 `Superseded by D-24656` pointers;
  - WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`;
  - `pnpm roadmap:counts:write` + `:check`; `pnpm ledger:numbers:check`;
  - the `01.6` post-mortem
- [ ] Live (D-24026), after merge + deploy only: a Bystander-carrying escape shows no Wound, the HQ-KO prompt or line plus the refill, the discard prompt, and the Escape effect. Govern-close says "live-verify pending"; a post-deploy STATUS commit records the matchId

## Common Failure Smells
- A 2+ player sim flags games stuck → WP-749 is missing, a mirror site was missed, or the mirror passed the acting seat instead of the loop's active seat.
- Autoplay aborts or bot-ally faults on a Bystander escape → the discard was parked with the active-seat skip.
- The KO prompt never appears in a live match but unit tests pass → the opener is not wired in `game.ts` `turn.onMove` (the injected-seam trap); the `game.test.ts` wiring case must fail without it.
- A turn freezes after a non-active discard → the return-on-discard opener or the projection gate is missing.
- The escape-before-Ambush test fails → step 3 was deferred along with steps 1–2; it must stay inline.
