# EC-731 — Multi-seat "each other player chooses" core mastermind tactics (Execution Checklist)

**Source:** docs/ai/work-packets/WP-694-mastermind-tactic-multi-seat-core.md
**Layer:** Game Engine + Arena Client
**Status:** Pending

## Before Starting
- [ ] WP-684 (multi-seat pending-choice / D-24501) shipped — read `moves/seatChoice.resolve.ts` (`parkSeatChoice`, `resolveSeatChoice`, `applySeatChoiceByKind`, `chainRandomActsPassLeft`, `applySeatChoiceTimeoutDefault`) + `moves/seatChoiceCards.ts` (the pure-builder/applier module precedent) FIRST; this WP mirrors both
- [ ] WP-497 (tactic-onFight framework / D-24300) shipped — read `dispatchTacticOnFight` + how `defeatMastermindTacticCore` calls it
- [ ] Confirm at HEAD (baseline assertions): `SeatChoiceOption.cardId` exists (reuse for KO + discard targets — no new field); `resolveSeatChoice` is in `SIMULATION_MOVE_NAMES` + both sim `MOVE_MAP`s and `getLegalMoves` short-circuits to it (no new sim entry, no new bgio move); a Victory-Pile Villain is identifiable by the `-villain-` ext_id infix (no new hashed villain-group map)
- [ ] Enumerate every caller of `defeatMastermindTacticCore` — `moves/fightMastermind.ts` + `moves/defeatChoice.resolve.ts` (Silent Sniper) — both own `events`
- [ ] `pnpm -r build` 0; engine + arena-client suites green

## Locked Values (do not re-derive)
- [ ] Tactic ext_ids: `core-mastermind-dr-doom-monarchs-decree`, `core-mastermind-loki-vanishing-illusions`
- [ ] Kinds: `monarchs-decree-mode` (active single-seat), `monarchs-discard` (multi-seat), `vanishing-illusions-ko` (multi-seat)
- [ ] Monarch's option order: index 0 = "Each other player draws a card"; index 1 = "Each other player discards a card"
- [ ] `defaultOptionIndex` = 0 for all three kinds (draw / first hand card / first Victory-Pile Villain, ascending)
- [ ] Each-other-draws count = 1 per other player; KO = 1 Villain per addressed seat; discard = 1 card per addressed seat
- [ ] Both resolvers skip `ctx.currentPlayer`; a seat with no eligible target is not addressed (no-op); no qualifying other seat → park nothing

## Guardrails
- [ ] REUSE WP-684 — NO new pending-choice field, NO new bgio move, NO new block-all guard, NO new sim `MOVE_MAP` entry; new behavior enters only as `kind` discriminants + `applySeatChoiceByKind` branches
- [ ] Multi-seat apply ATOMIC + ascending-seat-order (byte-identical regardless of submission order); moves never throw
- [ ] Monarch's chains from `resolveSeatChoice` (capture the active seat's chosen option BEFORE clearing; chain the multi-seat discard only when option 1) — NOT from the ctx-free apply (admission needs `events.setActivePlayers`), mirroring `chainRandomActsPassLeft`
- [ ] `events` threaded through BOTH `defeatMastermindTacticCore` callers → `dispatchTacticOnFight`; optional/guarded (unit/replay parks on `G` and resolves directly)
- [ ] Hand→discard via `discardFromHand` (enforced chokepoint), never raw `zoneOps`; KO via `koCard` into `G.ko`
- [ ] `seatChoiceTactics.ts` (new) has NO boardgame.io import and NO `parkSeatChoice` import (no cycle with `seatChoice.resolve.ts`); no `.reduce()` in apply/count loops
- [ ] Per-seat UIState redaction unchanged (WP-684 projection); option `cardId`/`cityIndex` never projected
- [ ] Determinism: no `Math.random`/wall-clock; `ctx.random.Shuffle` only for the draw-branch reshuffle (commented); re-pin ONLY if a hashed field is added (none expected — assert the delta)

## Required `// why:` Comments
- [ ] Each tactic-id const cites WP-694 / D-24511 + the printed Fight text
- [ ] The Monarch's-discard chain (why chain from the live move context, not the apply) cites the `chainRandomActsPassLeft` precedent
- [ ] The `events` threading through `defeatMastermindTacticCore` (why both callers, why guarded-optional)
- [ ] The ascending-seat-order atomic apply (why deterministic) for each new multi-seat kind
- [ ] The `-villain-` id-grammar villain match (why not a new hashed villain-group map)
- [ ] The draw-branch `ctx.random.Shuffle` reshuffle

## Files to Produce
- [ ] `rules/tacticHandlers.ts` — `resolveMonarchsDecree`, `resolveVanishingIllusions`, tactic-id consts, two dispatch branches, `events` param threaded
- [ ] `moves/seatChoiceTactics.ts` — **new** — `buildMonarchsDecreeModeChoice`, `applyMonarchsDecreeMode` (deterministic each-other-draws), `buildMonarchsDiscardChoice`, `applyMonarchsDiscard`, `buildVanishingIllusionsChoice`, `applyVanishingIllusionsKo`, kind consts
- [ ] `moves/seatChoice.resolve.ts` — `applySeatChoiceByKind` three new kinds + the Monarch's-discard chain hook (capture active option before clear)
- [ ] `moves/fightMastermind.ts` + `moves/defeatChoice.resolve.ts` — thread `events` into `defeatMastermindTacticCore` → `dispatchTacticOnFight`
- [ ] `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` — three `heading()` cases
- [ ] `scripts/coverage/tactic-provenance.json` — two `executable` rows (handler + wp WP-694 + decision D-24511)
- [ ] tests: `rules/tacticHandlers.test.ts` (dispatch, park shape, per-seat prompts, atomic multi-seat apply, each-other-draws, KO-from-victory, skip-self, empty-hand / no-villain no-op, disconnect default, active-only regression untouched); `moves/seatChoiceTactics.test.ts` (builders/appliers); `PendingSeatChoicePrompt.test.ts` (three headings)
- [ ] Regenerated effect-implementation index + `sim:runtime-observed`

## After Completing
- [ ] engine + arena-client suites green; `pnpm -r build` 0
- [ ] sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical (no committed fixture defeats these tactics) — STOP on any drift, never blind re-pin
- [ ] `effect-index:check` + `sim:runtime-observed:check` current after regen; two tactic-provenance rows present
- [ ] `git diff --name-only` = allowlist + governance only
- [ ] D-24511 Active; WORK_INDEX `[x]` + EC_INDEX `Done`; roadmap mindmap 📝→✅; `roadmap:counts:check` 0; STATUS close-out
- [ ] Two-commit topology (EC-731 impl + SPEC close); PR squash-merged when green; D-24026 live-verify performed or operator-pending

## Common Failure Smells
- New pending field / new move / new sim entry appears → the WP-684 reuse was missed (rebuilding infra).
- Monarch's discard chains from the apply → non-active seats never admitted (needs `events` in the live move context).
- Multi-seat apply is order-dependent or non-atomic → replays diverge; iterate addressed seats sorted ascending.
- A seat's prompt leaks another seat's hand / Victory Pile → per-seat redaction not exercised in the test.
- Every unrelated replay fixture fails → an accidental new hashed field; the reuse of `G.pendingSeatChoice` adds none — confirm before any re-pin.
- The defeating player draws / discards / KOs → forgot to skip `ctx.currentPlayer`.
