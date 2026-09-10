# EC-718 — Three optional/interactive core-hero abilities (Execution Checklist)

**Source:** docs/ai/work-packets/WP-681-core-hero-optional-interactive-abilities.md
**Layer:** Game Engine + Arena Client (heavyweight)
**Status:** Pending

## Before Starting
- [ ] WP-676 (Smash optional accept/decline pending-choice / D-24492) shipped — read the park→block-all→resolve→UIState→renderer flow FIRST; Do-Over reuses this shape
- [ ] WP-678 (Undercover interactive target-select / D-24494) shipped — read the target-pick pending choice + the five-step UIState projection
- [ ] Read `moves/optionalKoReward.resolve.ts` + the `optional-ko-hand-discard` keyword — Battlefield Promotion reuses the KO half
- [ ] Confirm at HEAD: `applyDiscardHand` (`ruleRuntime.effects.ts`) empties the hand to discard; `gain-officer-current` (`moves/recruitOfficer.ts`) lands the Officer in DISCARD (baseline assertions)
- [ ] `pnpm -r build` 0; engine + arena-client suites green

## Locked Values (do not re-derive)
- [ ] High-Tech Weaponry = **card-data marker only**: `[hc:tech]:` gate + `[keyword:attack:1]`; NO engine change
- [ ] Do-Over gate = **first Hero played this turn** = no OTHER Hero in the acting player's `inPlay` when it resolves
- [ ] Do-Over on accept = discard the ENTIRE current hand (reuse `applyDiscardHand`), then draw a FIXED **4** (not one-per-discard); optional (accept/decline)
- [ ] Battlefield Promotion KO target = a `[team:shield]` Hero from HAND or DISCARD → global `G.ko`; the S.H.I.E.L.D. Officer itself counts as a S.H.I.E.L.D. Hero
- [ ] Battlefield Promotion reward = optionally gain a S.H.I.E.L.D. Officer to **HAND** (new destination variant; existing gain is discard-bound); empty Officer supply → reward no-ops
- [ ] Both interactive prompts are ACTIVE-player-scoped (the acting player only — no WP-684 dependency)
- [ ] Do-Over's new handler-bearing keyword is NO-MAGNITUDE → it MUST be enrolled in `NO_MAGNITUDE_KEYWORDS` (the most-missed lockstep site — omission = the handler silently never runs)

## Guardrails
- [ ] Moves never throw; new `resolve*` moves = validate→gate→mutate→void
- [ ] Any NEW HeroKeyword touches all SIX lockstep sites + drift test + `game.test.ts` move registration
- [ ] Any NEW `resolve*` move enrolls in `SIMULATION_MOVE_NAMES` + BOTH sim `MOVE_MAP`s (runner + aggregator) or the sim hangs
- [ ] New board-visible `UIState` fields follow the FIVE-step filter pass-through (declare → build → filter → audience test → diagnostics snapshot) — an unfiltered field is silently dropped
- [ ] `gain-officer-current` discard behavior UNCHANGED — the to-hand path is an additive variant
- [ ] Determinism: adding a hashed pending-choice field forces a dual re-pin; if none is hashed, assert no state-hash fixture churn
- [ ] Card markers via the generator + full regen — never hand-edit `data/cards/`

## Required `// why:` Comments
- [ ] The `first-hero-played-this-turn` condition evaluator (what "first Hero" means over `inPlay`)
- [ ] Do-Over's fixed draw-4 (not one-per-discard) cites the printed text
- [ ] The gain-Officer-**to-hand** reward variant (vs the discard-bound default) cites Battlefield Promotion
- [ ] Any `ctx.events`/pending-choice park + block-all site
- [ ] Each new HeroKeyword union/array entry cites WP-681 / D-24498

## Files to Produce
- [ ] `rules/heroConditions.ts` + `hero/heroConditions.evaluate.ts` (+ test) — `first-hero-played-this-turn`
- [ ] Do-Over: new keyword in `rules/heroKeywords.ts` (six-site lockstep) + handler in `hero/heroEffects.execute.ts` + `moves/*Choice.resolve.ts` (accept/decline) + `game.ts` block-all + `ui/uiState.{types,build,filter}.ts` projection + `game.test.ts` registration + sim dispatch
- [ ] Battlefield Promotion: reward extension in `moves/optionalKoReward.resolve.ts` (gain-Officer-to-hand) + officer-gain helper variant in/near `moves/recruitOfficer.ts` + any UIState field for the reward step
- [ ] `apps/arena-client/**` — renderers for the Do-Over accept/decline prompt and the Battlefield Promotion KO+reward prompt (reuse the draw-or-empowered / count-scaled renderer model)
- [ ] Card-data generator: markers for the 3 cards + regenerate `data/cards/core.json`
- [ ] Regenerated hero ledger + card-mechanics + effect-index + runtime-observed + coverage feeds
- [ ] `mechanic-provenance.json` rows for the new mechanic keys (Do-Over keyword; the reward variant if it names a mechanic)

## After Completing
- [ ] engine + arena-client suites green; `pnpm -r build` 0
- [ ] `pnpm cards:check` reproducible; ledger/mechanics/effect-index/runtime-observed/coverage feeds green
- [ ] hash re-pin only if a hashed field was added (delta verified); else none
- [ ] D-24498 Active; WORK_INDEX `[x]` + EC_INDEX + roadmap mindmap [d]→[x]
- [ ] `Tests-changed:` trailer if any pin/fixture moved; PR squash-merged when green

## Common Failure Smells
- Do-Over draws one-per-discard → it draws a FIXED 4.
- Do-Over offered when a Hero already played → the first-Hero gate is wrong.
- Battlefield Promotion Officer lands in discard → you reused the default gain; this one is to HAND.
- New `resolve*` move added but sim hangs → missing `SIMULATION_MOVE_NAMES` / sim `MOVE_MAP` enrollment.
- Prompt renders blank / choice never reaches client → a `UIState` field skipped the filter pass-through.
