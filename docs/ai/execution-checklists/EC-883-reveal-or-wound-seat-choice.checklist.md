# EC-883 — Reveal or Gain a Wound: a Player Who Can Reveal Chooses (Execution Checklist)

**Source:** docs/ai/work-packets/WP-845-reveal-or-wound-seat-choice.md
**Layer:** Game Engine (+ one Arena Client heading)

## Before Starting
- [ ] Re-baseline on `origin/main`. Confirm `heroEffectRevealOrGainWoundEach` and `villainEffectRevealOrWound` still auto-reveal (no seat choice), and re-count the corpus (PowerShell `(Select-String -Path data/cards/*.json -Pattern '\[effect:reveal-or-wound:' -AllMatches).Matches.Count` → 14; same with `'\[keyword:reveal-or-gain-wound-each\]'` → 1). A mismatch → STOP and reconcile.
- [ ] If WP-846 (each-player seat order) has landed, the effect loops (the inline cannot-reveal Wounds) keep its rotation; `revealingSeats` and the apply stay ascending (D-24501, Locked Values). Record that in the commit.
- [ ] On the **unmodified** baseline, capture AC-5's literal expected values (one no-revealer input per site: messages text + outcome, discard piles, `notableEvents`, `woundsDrawn`).
- [ ] `pnpm -r build`, `pnpm --filter @legendary-arena/game-engine test` and `pnpm --filter @legendary-arena/arena-client typecheck` exit 0; record the pass count and the current values of `finalStateHash` (sentinel), `PRE_WP080_HASH`, the runtime-observed artifact and the dashboard `totalObs` pin.

## Locked Values (do not re-derive)
- Kind `reveal-or-wound` (`REVEAL_OR_WOUND_SEAT_CHOICE_KIND`). Option 0 = `{revealOptionLabel}`, option 1 = `Gain a Wound instead` via `VILLAIN_EFFECT_WOUND_OPTION_LABEL`: import it from WP-837 if WP-837 landed first, else export it (same name) from `moves/revealOrWoundChoice.logic.ts`. `defaultOptionIndex` 0.
- Queue field `G.pendingRevealOrWoundChoices?: PendingRevealOrWoundChoice[] | undefined`; entry `{ sourceCardId: CardExtId; currentPlayerID: string; revealOptionLabel: string; revealingSeats: string[]; strikeBlockThreatKind?: StrikeBlockThreatKind }`. Lazy at the enqueue site, deleted when drained, never in `Game.setup`, not projected. A hero entry **omits** `strikeBlockThreatKind` (conditional assignment, never `: undefined`).
- `enqueueRevealOrWoundChoice` sorts `revealingSeats` numeric ascending itself (never relies on the loop order; WP-846 may rotate that loop).
- Builder: `addressedSeats = [...entry.revealingSeats]` verbatim, a prompt for every seat. Seat equality in the applier is element-wise (same length, `a[i] === b[i]`), never array identity.
- `revealOptionLabel`: hero `Reveal another {req} Hero`; villain `Reveal a matching {req} Hero` (`{req}` = each site's existing requirement label: hero `describeHeroRevealRequirement`, villain `describeRevealRequirement`).
- Client heading for the kind: `Reveal a Hero or gain a Wound?`.
- Log lines (`{card}` = `formatCardRef(G.cardDisplayData, sourceCardId)`; names = `Player {id}` joined `, `; WP-438 card attribution on the hero site):
  - order at enqueue: the existing cannot-reveal summary (if any) first, then the enqueue line.
  - enqueue, hero: `{names} can reveal another {req} Hero and will choose whether to reveal it or gain a Wound ({card}).` [`neutral`]
  - enqueue, villain: `{label} effect: {names} can reveal a matching {req} Hero and will choose whether to reveal it or gain a Wound.` [`neutral`]
  - apply: `Reveal or gain a Wound ({card}): {revealed} revealed; {declined} chose to gain a Wound.` — omit an empty half (and its `; `); the declined half uses `composeWoundOutcomeClause(gained, divingBlockPending)` when a Diving Block reveal is pending (D-24673) and appends `; the Wound supply ran out before {names}` for empty-supply decliners (D-24686). [`applied`] if any decliner, else [`blocked`].
  - defensive paths (malformed entry dropped at open; missing / mismatched entry at apply) log a full-sentence line with outcome `blocked`; their text is not asserted.
  - empty supply at open: `Reveal or gain a Wound ({card}): the Wound supply is empty, so {names} revealed.` [`blocked`]
- The existing cannot-reveal lines keep their text. The hero "Every player revealed …" line and the villain "every player revealed …" branch keep their text but are reachable only with no seats at all (nothing queued, nobody lacked a match); the existing tests that assert them for a revealing seat are rewritten to the queued behaviour.

## Guardrails
- Cannot-reveal seats: same helper calls, same order, same lines as today. A run where no seat can reveal leaves `G` deep-equal to today's (AC-5).
- Predicates are reused, never forked: hero `playerCanRevealMatch`, villain `playerHasHeroMatchingTrait`. Wounds go through `gainWoundWithOutcome`; `turnEconomy.woundsDrawn` bumps only for `currentPlayerID`.
- Opener: wait while `hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined`; stop once `evaluateEndgame(G) !== null`; serve only `queue[0]`, **leave it in the queue** while its choice is open (Timestream Purge shape); stage ride per the D-24750 active-seat-only rule. Empty supply at open → resolve all-reveal (log + villain `strikeBlocked` per seat) and shift. An entry with empty `revealingSeats` or naming a seat with no `playerZones` is shifted off with a log line at open, never parked. Never add the queue to `hasAnyPendingChoice`.
- Applier: read `G.pendingRevealOrWoundChoices[0]` for `sourceCardId` / `currentPlayerID` / `strikeBlockThreatKind` (works on the timeout path, which passes no current player); missing entry → log and no-op; `choice.addressedSeats` ≠ `entry.revealingSeats` → log, leave the entry queued (the opener re-parks it on the next `onMove`); otherwise apply, shift, delete the key when empty.
- Positions (01.5): live `game.ts` immediately before `openDivingBlockSeatChoiceIfNeeded`, after the latch / `applyPileDepletionResourceLoss` re-check; `simulation.runner.ts` ×2 and `par.aggregator.ts` ×2 after the `applyPileDepletionResourceLoss` following each escape-opener call; `runFixture.ts` directly after its escape-opener call.
- Cycles: the new module ↔ `seatChoice.resolve.ts`, and the `phaseCard.ts` → `playVillainTop.resolve` → `villainDeck.reveal` → `villainEffects.execute` chain: imported bindings are used only inside function bodies, never at module top level; the `// why:` names both.
- Rewritten tests are exactly the WP §Scope list (villain strikeBlocked ×4 and the two "every player revealed" asserts; Crazed Rampage AC-3 / AC-4 / AC-5 revealer cases); every cannot-reveal assertion stays verbatim; the commit body lists old → new.
- Villain `strikeBlocked` is pushed at apply time for Reveal only, and in the empty-supply open branch, with the entry's `strikeBlockThreatKind`; none at enqueue.
- Ascending seat order at enqueue and apply. No RNG, no wall-clock, no `.reduce()`; never throws (missing zones / malformed entry → skip and drop the entry).
- Do not change `simulation/ai.seatChoice.ts`, `getLegalMoves`, any move list, `UIState`, the Legacy Virus twist, or any unmarked card line.
- Oracles: never hand-edit; re-pin only what the measured run moved, via `scripts/record-game-fixture.mjs` / the documented constant / the artifact's own writer, cause in the commit. Never weaken an assertion.

## Required `// why:` Comments
- `types.ts` field: lazy D-24750-style queue; the executor has no `events`; not projected.
- Enqueue sites: rules v23 L3196-3200 allow declining (D-24779 amends D-24281 / D-24777 §5); predicate fixed at effect time.
- Opener: position relative to the escape / Purge / Diving Block openers; empty supply = declining is not an option (L3199-3200).
- `applySeatChoiceByKind` branch; the applier's ascending order and `woundsDrawn` rule.

## Files to Produce
- Engine **new**: `moves/revealOrWoundChoice.logic.ts`, `moves/revealOrWoundChoice.test.ts`
- Engine **modified**: `types.ts`; `moves/seatChoice.resolve.ts`; `moves/operatorSetters.test.ts` (one BLOCKERS entry); `simulation/seatChoiceDispatch.test.ts` (seeded sim + `runFixture` case and PAR-loop twin, AC-8); `hero/heroEffects.execute.ts`, `hero/crazedRampage.revealOrGainWound.test.ts`; `villain/villainEffects.execute.ts`, `villain/villainEffects.execute.test.ts`; `game.ts`, `game.test.ts`; `simulation/simulation.runner.ts`; `simulation/par.aggregator.ts`; `test/fixtures/runFixture.ts`; `endgame/mastermindVictory.logic.ts` + `.test.ts`; `moves/operatorSetters.logic.ts`
- Client **modified**: `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + `.test.ts`
- Conditional (only if measured to move): `test/fixtures/games/sentinel-core-doom-2p.replay.json`, `replay/replay.execute.test.ts`, `docs/ai/coverage/runtime-observed-hollows.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts`. Predicted: sentinel and `PRE_WP080_HASH` unchanged (a move is STOP-and-explain); runtime-observed / `totalObs` may move. Not here: `data/par/profile/v1/**` (follow-up `INFRA:`, `node scripts/generate-par-profiles.mjs --version v1`).
- Governance: `docs/ai/DECISIONS.md` (D-24779 Active), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/coverage/live-verify.json`

## After Completing
- [ ] `pnpm -r build` 0; engine suite 0 fail (record the delta and each moved pin with its cause); arena-client `test` + `typecheck` 0; dashboard `prebuild:coverage` + `prebuild:effect-index`, then `pnpm -r --no-bail test` 0 fail.
- [ ] `sim:runtime-observed:check`, `sim:coverage --check`, `effect-index:check`, `ledger:villains:check`, `ledger:heroes:check` 0 (or regenerated by their writer with the cause).
- [ ] Revert proofs: drop the `game.ts` opener call → the AC-8 real-reducer cases fail; wound revealers at the enqueue site → AC-1 fails; drop the `simulation.runner.ts` mirror calls → AC-8's sim case fails; drop the `par.aggregator.ts` calls → AC-8's PAR-loop twin fails (or a recorded manual run); force the stage ride to always skip → the AC-8 non-active case fails; restore all.
- [ ] `git diff --name-only` = allowlist; no CRLF-only churn.
- [ ] Two commits: `EC-883:` implementation, `SPEC:` governance close (D-24779 Active, STATUS, indices, mindmap `✅` + `roadmap:counts:write`, then `pnpm roadmap:counts:check` exits 0, ledger LANDED).
- [ ] D-24026 live-verify recorded, or operator-pending.

## Common Failure Smells
- The turn freezes after Sabretooth's Fight → the opener is missing from `onMove` or a mirror, or the stage ride skipped a non-active seat.
- A cannot-reveal seat's Diving Block wave opens before the revealers answer → the opener runs after the Diving Block opener (it must run before it).
- The apply line says `option N` or a villain Reveal pushes no `strikeBlocked` → the entry was shifted at open time, so the applier lost its payload.
- A revealer is wounded at effect time → the enqueue split was skipped.
- Two prompts collide or one is lost → the opener did not wait on an open choice, or the applier did not shift the front entry.
- `strikeBlocked` fires for a decliner, or twice → the push stayed at enqueue time.
