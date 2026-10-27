# EC-884 — Each-Player Effects Start With the Current Player and Go Clockwise (Execution Checklist)

**Source:** docs/ai/work-packets/WP-846-each-player-turn-order.md
**Layer:** Game Engine

## Before Starting
- [ ] Re-baseline on `origin/main`. Re-run the inventory (WP Verification step 1's PowerShell command, regex `Object\.keys\([A-Za-z.]*playerZones\)`) and match the 22 in-scope sites by **function name** (lines drift). A new each-player Wound or discard loop since the draft → STOP, amend the WP + EC (it is in scope by the rule), then code.
- [ ] If WP-845 has landed, H7 / V6 contain its enqueue split; rotate the loop, leave the split and WP-845's ascending apply alone, and confirm `enqueueRevealOrWoundChoice` sorts `revealingSeats` itself. If it does not, STOP.
- [ ] On the **unmodified** baseline, capture AC-5's literal expected values (one 3-player seat-0 input per family) and the per-file `Object\.keys\([A-Za-z.]*playerZones\)` code-site counts via that command (AC-9 (b): they must stay unchanged).
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test` exit 0; record the pass count, the sentinel `finalStateHash`, its messages oracle, `PRE_WP080_HASH` and the runtime-observed artifact (all predicted unchanged). PAR profiles are not measured here: the multi-seat ones move and are re-pinned by a follow-up `INFRA:` PR after EC-884 merges (WP Assumes).

## Locked Values (do not re-derive)
- Helper: `seatsInTurnOrderFrom(seatIds: readonly string[], currentPlayer: string | null | undefined): string[]` in new `packages/game-engine/src/turn/seatOrder.logic.ts`. `[...seatIds].sort()` (default lexical compare, D-18902), then rotate to start at `currentPlayer`; absent / not-a-seat → the sorted copy.
- In-scope sites (22): H1 `heroEffectGainWound` (gain-wound-each), H7 `heroEffectRevealOrGainWoundEach`; R1 `resolveMagnetoStrike`, R4 `resolveDoctorDoomStrike`, R5 `resolveCoreLokiStrike`, R6 `resolveBaronZemoStrike`, R7 `discardCardOfCostForEachPlayer`, R8 `resolveLokiStrike`, R9 `resolveCo2eMagnetoStrike`, R10 `resolveDoctorOctopusStrike`; T1 `resolveCrushingShockwave`, T6 `dealFindingZemoWounds`, T9 `resolvePetProjects`; S1 `revealOrPunish`, S2 `woundAll`, S4 the `woundPlayerIfGladiatorIsWeaker` loop; V1 / V2 `villainEffectGainWound` each-other / each, V3 `applyGainWoundEachNonSavior`, V6 `villainEffectRevealOrWound`, V10 `villainEffectGainWoundUnlessVictoryVillainGroup`; M1 `resolveCoveringFireChoice`.
- Current-player source: hero → `playerID`; villain / tactic → `currentPlayer`; strikes R4-R10 → new `currentPlayer: string | null` param from `resolveCurrentPlayer(context)` in `mastermindStrikeHandler` (R7 via `resolveArnimZolaStrike`; R10 beside its shuffle function); S4 → swap the shared `playerIds` constant (feeds the gladiator pass and the wound loop); schemes → the reveal context's `ctx.currentPlayer` (local reader, duplicate-first); M1 → `playerID`.
- Each-other shape: **rotate first, then filter** — `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer).filter((seat) => seat !== currentPlayer)` for T6 / T9 (never pass a pre-filtered `otherSeats` list: the helper would fall back to sorted). T1 / V1 / M1 keep their in-body skip.
- Test shape: 3 players; rotation cases use current `'1'` (expect `1, 2, 0`); short-supply cases use current `'2'` with one Wound left (expect seat 2 wounded); each-other short-supply uses current `'1'` (expect seat 2); T6 or T9 rotation with current `'1'` expects `2, 0` (AC-2b); no short-supply recipient holds Diving Block / Flying Shield Block; AC-4 uses S1's discard-hand penalty or R9 / R7, not R1.

## Guardrails
- Swap only the iteration source of the 22 loops; loop bodies, log text and helper calls stay byte-identical.
- Excluded sites stay untouched: RNG-only (Hypnotic Charm others, Psychic Link, Monarch's Decree draw, Melter), Rogue Steal Abilities, Paibok (D-24343), log / append-only loops (core Dr. Doom, Red Skull, Whispers and Lies, Prisoners of War, Executioner, ko-hero each, Fallen Idols, Computer-Uploaded Genius, escape builders), every simultaneous apply (D-24501), Flying Shield Block `seatsThatCanReveal` (D-24760).
- The helper imports nothing from boardgame.io, uses no RNG, never mutates its input (`.claude/rules/code-style.md` §Pure Helpers).
- Stub / unit contexts with no current player keep sorted order; seat-0 turns and solo games are unchanged (AC-5).
- No exported signature changes; the strike / scheme threading is internal to each file.
- AC-5 is shown by the literal values captured on the unmodified baseline (Before Starting) plus existing seat-0 tests staying byte-unchanged; never by passing a null current player (R1's null path parks differently).
- **Any** test file outside the allowlist that shifts → STOP and amend; never update silently. Right after the helper swap and before editing any test, run `simulation/seatChoiceDispatch.test.ts` and `moves/divingBlock.multiSeatWave.test.ts` and record the result.
- Re-assert an existing test only if its current player is non-zero and (ample supply) the new order is a permutation of the old; a seat-0 / solo test that moves → STOP. Name each in the commit body.
- Oracles: never hand-edit; re-pin only what the measured run moved, via its writer (`scripts/record-game-fixture.mjs --input …`, the documented `PRE_WP080_HASH` constant, the artifact's script), with the cause in the commit. Never weaken an assertion; each existing assertion whose order changed is named in the commit body.

## Required `// why:` Comments
- Each swapped loop: rules v23 L2247 — start with the current player, then clockwise (D-24780).
- The helper: clockwise = ascending seat id wrapping, since `ctx.playOrder` is never customised; the sorted fallback for stub contexts; the lexical sort is D-18902's (equals seat order for `'0'..'4'`); the forward rule (a new order-sensitive each-player loop uses this helper); it does not "start after" an absent current player (rotate, then filter).
- Each threaded `currentPlayer` param: null in stub contexts → sorted order.

## Files to Produce
- Engine **new**: `turn/seatOrder.logic.ts`, `turn/seatOrder.logic.test.ts`
- Engine **comment-only**: `rules/heroKeywords.ts` (covering-fire comment ~L88), `types.ts` (~L1221) — M1's old sorted-order text; types byte-identical
- Engine **modified**: `hero/heroEffects.execute.ts`, `rules/mastermindHandlers.ts`, `rules/tacticHandlers.ts`, `rules/schemeTwistResolvers.ts`, `villain/villainEffects.execute.ts`, `moves/coveringFireChoice.resolve.ts`
- Tests **modified**: `hero/heroEffects.execute.test.ts`, `hero/crazedRampage.revealOrGainWound.test.ts`, `rules/mastermindHandlers.test.ts`, `rules/tacticHandlers.test.ts`, `rules/schemeTwistResolvers.test.ts`, `villain/villainEffects.execute.test.ts`, `moves/coveringFireChoice.resolve.test.ts`
- Conditional (predicted not to move; a move is STOP-and-explain, then re-pin by its writer): `test/fixtures/games/sentinel-core-doom-2p.replay.json`, `replay/replay.execute.test.ts`, `docs/ai/coverage/runtime-observed-hollows.json` + `apps/dashboard/src/composables/useInPlayCoverage.test.ts`. Not here: `data/par/profile/v1/**` (follow-up `INFRA:`)
- Governance: `docs/ai/DECISIONS.md` (D-24780 Active), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/coverage/live-verify.json`

## After Completing
- [ ] `pnpm -r build` 0; engine suite 0 fail (record the delta and every moved assertion / pin with its cause); dashboard `prebuild:coverage` + `prebuild:effect-index`, then `pnpm -r --no-bail test` 0 fail.
- [ ] `sim:runtime-observed:check`, `sim:coverage --check` 0.
- [ ] AC-9 grep gate: non-comment `seatsInTurnOrderFrom(` calls per file = hero 2, mastermind 8, tactic 3, scheme 3, villain 5, coveringFire 1 (22; none elsewhere but the helper's definition file and its test; WP step 5c); `Object\.keys\([A-Za-z.]*playerZones\)` code-site counts unchanged per file; diff hunks only in the 22 functions, the strike threading, the six helper imports, the scheme file's current-player reader and the touched JSDoc / `// why:` lines.
- [ ] Revert proofs: helper returns the sorted copy → AC-2 / AC-3 / AC-3b / AC-8 fail; `null` into R6's strike → its AC-8 case fails; restore both.
- [ ] `git diff --name-only` = allowlist; no CRLF-only churn.
- [ ] Two commits: `EC-884:` implementation, `SPEC:` governance close (D-24780 Active, STATUS, indices, mindmap `✅` + `roadmap:counts:write`, then `pnpm roadmap:counts:check` exits 0, ledger LANDED, STATUS owed line for the shared PAR re-pin).
- [ ] D-24026 live-verify recorded, or operator-pending.

## Common Failure Smells
- A test with no current player changes order → the fallback is not the sorted list.
- The strike order still starts at seat 0 → `resolveCurrentPlayer` returned null (stub context) or the param was not threaded.
- Paibok or a simultaneous apply changed order → an excluded site was swapped.
- A T6 / T9 rotation test still sees `0, 2` on seat 1's turn → the pre-filtered list was passed to the helper.
