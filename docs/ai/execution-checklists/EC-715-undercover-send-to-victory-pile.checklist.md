# EC-715 — Undercover: rules-faithful Victory-Pile mechanic (supersede WP-282 / D-24060) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-678-undercover-send-to-victory-pile.md
**Layer:** Game Engine + Arena Client
**Status:** Pending (heavyweight / two-session)

## Before Starting
- [ ] Read WP-282 (`sendUndercover`/`playFromUndercover`/`faceDownCards`) + D-24060 (face-down identity) — this WP RETIRES that infra; confirm it is dead (both moves `client:false`, no UI caller, `undercover` has no `HERO_EFFECT_HANDLERS` entry, only a `FACE_DOWN_EXECUTED_KEYWORDS` classification)
- [ ] Read WP-286 (draw-or-empowered / D-24069) + WP-675 (count-scaled-choice / D-24490) — the pending-choice pattern this mirrors (type, guards, resolve move, UIPending* build+filter, client renderer)
- [ ] Read `scoring/scoring.logic.ts:119–156` (the `zones.victory` loop) + `scoring/scoring.types.ts` (`PlayerScoreBreakdown`)
- [ ] `pnpm -r build` exits 0; engine + arena-client suites green

## Locked Values (do not re-derive)
- [ ] Destination = `G.playerZones[pid].victory` (NOT `victoryPile`); Officer Stack = `G.piles.officers` (NOT `officerStack`)
- [ ] Undercover = move the target to `victory`, worth **1 VP** (universal-rules-v23 §Undercover)
- [ ] Scoring = **explicit tracking**, NOT type inference: the undercover handler records each sent card in a per-player `G` tracker (e.g. `G.playerZones[pid].undercover: readonly CardExtId[]`); scoring sums 1 VP per tracked entry → new `PlayerScoreBreakdown.undercoverVP`. Do NOT use `cardTraits.heroClass != null` — basic `[team:shield]` cards are classless and officers have NO `cardTraits` entry, so both would wrongly score 0
- [ ] Source shapes (this WP): `send-shield-hero-from-hand` (chosen `[team:shield]` Hero) + `send-officer-from-officer-stack` (deterministic)
- [ ] Hand-shape eligibility: 0 = legal no-op; 1 = auto-send; ≥2 = `PendingUndercoverChoice`
- [ ] D-24494 **supersedes D-24060**; mark D-24060 superseded

## Guardrails
- [ ] Keyword lockstep (ALL sites): add `undercover` to `HERO_EFFECT_HANDLERS` + `HANDLED_KEYWORDS` + **`NO_MAGNITUDE_KEYWORDS`** (`heroEffects.execute.ts:270` — omit it and the magnitude pre-gate DROPS the handler silently, the most-missed site per WP-659); bump the handler-count pin (`heroEffects.execute.test.ts:82` `31`→`32` + comment); REMOVE it from `FACE_DOWN_EXECUTED_KEYWORDS`; keep it `executable` for the right reason — [[reference_hero_keyword_lockstep_sites]]
- [ ] All zone mutations via `zoneOps.ts`; zones store `CardExtId` only
- [ ] Block-all guard on EVERY move site that guards `hasPendingDrawOrEmpowered`/`hasPendingCountScaledChoice` — grep BOTH; ~13 insertion points (incl. `coreMoves.impl.ts` lines 127/327/493, `game.ts`, `villainDeck.reveal.ts`, `dodgeCard`, `fightVillain`, `fightMastermind`, `healWounds`, `recruitHero`, `recruitOfficer`, `playFromUndercover`→removed, + sim short-circuit)
- [ ] `PendingUndercoverChoice` has a `UIPendingUndercoverChoice` projection through BOTH `buildUIState` AND `filterUIStateForAudience` (five-step Board-Visible Field contract) BEFORE merge — a build-only field is dropped at the filter and the game freezes
- [ ] Choice active-player-scoped; audience-filter test asserts the eligibleTargets survive for the chooser and are redacted from others
- [ ] `scoring.types.ts` is a locked contract file — the `undercoverVP` add is carried by D-24494 (contract change ⇒ DECISIONS entry)
- [ ] New resolve move `resolveUndercoverChoice` → register in `game.ts`, add to `SIMULATION_MOVE_NAMES` + BOTH sim MOVE_MAPs + bot short-circuit + the move-registration `game.test.ts` pin (or the sim hangs / drift fails)
- [ ] Disambiguate the new type/move/handler names from the RETIRED `sendUndercover`/`playFromUndercover`
- [ ] Combined dual re-pin (`PRE_WP080_HASH` + sentinel) ONLY after confirming the sole hashed-shape delta is `−faceDownCards +undercover tracker` (both land together — the tracker is a new hashed field, so removal is not optional-to-avoid-a-re-pin); one-line rationale + D-24494
- [ ] Moves never throw

## Required `// why:` Comments
- [ ] The undercover handler cites WP-678 / D-24494 + §Undercover (Victory Pile, 1 VP) + "supersedes D-24060 face-down model"
- [ ] The scoring branch cites: sum the per-player `undercover` tracker, 1 VP each; never inferred from victory-pile presence or `heroClass`/`team` (D-24494, supersedes D-24060)
- [ ] The block-all guard cites D-24069 + WP-678
- [ ] The `faceDownCards` removal (or deprecation) + re-pin comment states the sole shape delta

## Files to Produce
- [ ] `rules/heroKeywords.ts` — `undercover` handler-bearing (HANDLED + handler-map; add to `NO_MAGNITUDE_KEYWORDS`; remove FACE_DOWN classification); update length/handler pins
- [ ] `hero/heroEffects.execute.ts` — `heroEffectSendUndercover` (→ `zones.victory` + record in tracker) + two source shapes + dispatch entry; remove `undercover` from `FACE_DOWN_EXECUTED_KEYWORDS` + add to `NO_MAGNITUDE_KEYWORDS`; handler-count pin `heroEffects.execute.test.ts:82` `31`→`32`
- [ ] `state/zones.types.ts` — add the per-player undercover tracker (e.g. `undercover: readonly CardExtId[]`); `setup/playerInit.ts` inits it; fixtures/mocks set it
- [ ] `types.ts` — `PendingUndercoverChoice` + `G.pendingUndercoverChoice`
- [ ] `moves/undercover.resolve.ts` (new name, NOT the retired ones) — `resolveUndercoverChoice({ targetExtId })` + `hasPendingUndercoverChoice`; register in `game.ts`; block-all guards across move sites + the reciprocal `hasPendingUndercoverChoice` line on each peer resolve move
- [ ] `scoring/scoring.types.ts` (`undercoverVP`) + `scoring/scoring.logic.ts` (sum the tracker; NOT `heroClass`/`team` inference)
- [ ] `ui/uiState.types.ts` — `UIPendingUndercoverChoice`; `ui/uiState.build.ts` + `ui/uiState.filter.ts` — projection + pass-through
- [ ] `simulation/ai.legalMoves.ts` + `SIMULATION_MOVE_NAMES` + both sim MOVE_MAPs + `game.test.ts` move-registration pin
- [ ] arena-client — the Undercover target renderer (mirror `VictoryPileCardPickPrompt.vue`, WP-285 — the closest precedent)
- [ ] **Retire:** delete `moves/sendUndercover.ts`, `moves/playFromUndercover.ts`, `helpers/lookAtUndercover.ts` + the dead `FaceDownCard` type + the empty `FACE_DOWN_EXECUTED_KEYWORDS` category (+ MVP spread + `executesAtFaceDown` test branch `heroEffects.execute.test.ts:104,118,122` + the D-24060 comment) + their `game.ts` registrations; remove `faceDownCards` from `state/zones.types.ts` + `setup/playerInit.ts` + `test/fixtureBuilders.ts` + mocks; fix the stale `apps/server/src/coach/coachSummary.logic.ts:58` comment
- [ ] **Delete/rewrite the four face-down test files** (else the suite breaks at import): `undercover.integration.test.ts`, `moves/__tests__/sendUndercover.test.ts`, `moves/__tests__/playFromUndercover.test.ts`, `helpers/__tests__/lookAtUndercover.test.ts`
- [ ] tests: undercover→victory + tracker recorded, 1-VP scoring built directly incl. a **classless `[team:shield]` card + an officer**, 0/1/≥2 branches, officer-stack, block-all, UIState audience filter, arena-client renderer, keyword-lockstep drift, dead-infra-removed
- [ ] Regenerated hero ledger + card-mechanics + effect-index + runtime-observed

## After Completing
- [ ] engine + arena-client suites green; `pnpm -r build` 0; sim not hung
- [ ] `pnpm cards:check` reproducible; `ledger:heroes:check` + `mechanics:metadata:check` + `effect-index:check` + `sim:runtime-observed:check` + `sim:coverage --check` green
- [ ] the combined dual re-pin landed, delta = `−faceDownCards +undercover tracker` only
- [ ] D-24494 Active (supersedes D-24060; D-24060 marked superseded); WORK_INDEX `[x]` + EC_INDEX flipped; roadmap mindmap [d]→[x]
- [ ] `Tests-changed:` trailer (fixtures updated for the shape/scoring change); PR squash-merged when green

## Common Failure Smells
- Game freezes on the send → block-all guard added but no UIState projection (or it stops at build, dropped by the filter).
- Sim hangs → new `resolveUndercoverChoice` missing from `SIMULATION_MOVE_NAMES` / a sim MOVE_MAP / the bot short-circuit; or a stray reference to a deleted move.
- Undercover'd card scores 0 → used `heroClass`/`team` inference instead of the tracker (classless `[team:shield]` cards + officers have no class / no `cardTraits` entry), or the tracker isn't summed, or the scoring branch is missing.
- `undercover` silently does nothing → NOT in `NO_MAGNITUDE_KEYWORDS` (magnitude pre-gate drops it), or a `no-handler` hollow → HANDLED without a handler / not removed from FACE_DOWN classification.
- Suite breaks at import → a face-down test file (or a mock) still references a deleted move/type/zone.
- Every replay fixture fails → expected (shape re-pin); confirm the delta is ONLY `−faceDownCards +undercover tracker`, never re-pin to mask an unrelated shift.
