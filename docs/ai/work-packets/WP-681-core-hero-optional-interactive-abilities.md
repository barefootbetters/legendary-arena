# WP-681 — Three optional/interactive core-hero abilities (Game Engine + Arena Client)

**Status:** Draft 2026-09-09 (EC-718; D-24498 reserved)
**Layer:** Game Engine + Arena Client (two of the three cards are interactive) — **heavyweight**
**Hard-deps:** WP-676 (Smash optional-discard pending-choice pattern / D-24492) ✅, WP-678 (Undercover interactive target-select + gain-to-Victory precedent / D-24494) ✅, the `optional-ko-hand-discard` / `optional-ko-reward` family (`moves/optionalKoReward.resolve.ts`) ✅

## Goal

Make three inert core-hero abilities faithful: Nick Fury's **High-Tech Weaponry** (a
data-only class-synergy grant), Deadpool's **Hey, Can I Get a Do-Over?** (a first-Hero-gated
optional discard-and-redraw), and Nick Fury's **Battlefield Promotion** (an optional KO of a
S.H.I.E.L.D. Hero rewarding a S.H.I.E.L.D. Officer to hand). Two of the three are genuine
player choices and need a pending-choice + client renderer; the third is a marker.

## User-Visible Impact

Nick Fury's two S.H.I.E.L.D. build cards and Deadpool's hand-refresh begin working. Two of
them present an in-play prompt (accept/decline the discard-redraw; pick the Hero to KO and
whether to take the Officer). High-Tech Weaponry silently adds its conditional +1 attack.

## Assumes

- `[hc:tech]:` is the existing `heroClassMatch` synergy gate (`heroConditions.evaluate.ts`,
  self-exclusive per D-24023) and `[keyword:attack:N]` is a shipped grant — High-Tech
  Weaponry is therefore a **card-data marker only**, no engine change.
- `applyDiscardHand` (`rules/ruleRuntime.effects.ts`) already moves the whole hand to
  discard — Do-Over reuses it for the discard half (confirm at HEAD).
- The `optional-ko-hand-discard` keyword + `moves/optionalKoReward.resolve.ts` already model
  "optionally KO a card from hand or discard, then a reward"; Battlefield Promotion extends
  the **reward** (gain a S.H.I.E.L.D. Officer to hand), not the KO half.
- A card-effect "gain a S.H.I.E.L.D. Officer" today lands in **discard** (`gain-officer-current`,
  `moves/recruitOfficer.ts`); "to your **hand**" is a new destination variant (baseline
  assertion — read the officer-gain helper before extending it).
- The interactive-choice, block-all pending pattern (park choice → block all moves →
  resolve* move → UIState projection → client renderer) is the shipped
  draw-or-empowered / count-scaled / Undercover model (D-24069, WP-675, WP-678).
- Card data is GENERATED; markers via the generator + regen.

## Design Rationale

### 1. High-Tech Weaponry is a marker, not code
`[hc:tech]: You get +1[icon:attack].` composes the existing class-synergy gate with the
existing `attack` grant. Author `[hc:tech]:` + `[keyword:attack:1]` and regenerate. No
engine change; the only risk is the marker form, resolved against the parser at execution.

### 2. Do-Over — a new "first Hero this turn" condition + an optional discard-redraw
Two new pieces: (a) a `heroCondition` "this is the first Hero played this turn" (no OTHER
Hero in `inPlay` when it resolves — the D-24055/D-24023 evaluators are the shape precedent);
(b) an **optional** (`may`) discard-rest-of-hand-then-draw-4. Discarding your hand is a real
cost, so this is a genuine pending choice (accept/decline), not an auto-resolve. On accept:
`applyDiscardHand` then draw a fixed 4 (not one-per-discard). Reuses the Smash-style
accept/decline pending choice (WP-676); no new grant primitive.

### 3. Battlefield Promotion — reuse optional-KO, add a "to hand" Officer reward
The KO half reuses `optional-ko-hand-discard` (choose a `[team:shield]` Hero from hand or
discard, or decline). The reward is the new part: **gain a S.H.I.E.L.D. Officer to hand**
(also optional — "you may"), a destination variant of the existing discard-bound officer
gain. Empty Officer supply → the reward no-ops. "S.H.I.E.L.D. Hero" includes the Officer
itself (a S.H.I.E.L.D.-class Hero).

## Scope (In)

- Card-data marker for High-Tech Weaponry (`[hc:tech]:` + `attack:1`) + regen.
- New `heroCondition` "first Hero played this turn" + evaluator + tests.
- Do-Over: a handler-bearing keyword (optional discard-hand-and-draw-4) gated on the new
  condition; pending accept/decline choice + block-all + resolve move + UIState projection +
  arena-client renderer; reuses `applyDiscardHand` + draw.
- Battlefield Promotion: `optional-ko-hand-discard` (target a `[team:shield]` Hero) + a new
  **gain-Officer-to-hand** reward variant on `optionalKoReward.resolve.ts`; pending choice +
  client renderer as the family already does.
- HeroKeyword lockstep (six sites) for any new keyword; move-registration (`game.test.ts`);
  sim dispatch (`SIMULATION_MOVE_NAMES` + both sim `MOVE_MAP`s) for any new `resolve*` move.
- Tests: condition (first-Hero true/false), Do-Over accept + decline, Battlefield Promotion
  KO-from-hand / KO-from-discard / decline / empty-officer-supply, UIState projection
  (five-step board-visible contract, active-player-scoped), arena-client renderer.

## Out of Scope

- Any card outside these three; the count-scaled Cap/Fury/Deadpool cards (WP-680).
- Changing the existing discard-bound `gain-officer-current` behavior (additive variant only).
- Multiplayer effects (WP-683).

## Files Expected to Change

See EC-718 §Files to Produce (authoritative allowlist). Primarily: `rules/heroConditions.ts` +
`hero/heroConditions.evaluate.ts` (`first-hero-played-this-turn`), `rules/heroKeywords.ts`
(Do-Over keyword, six-site lockstep incl. `NO_MAGNITUDE_KEYWORDS`), `hero/heroEffects.execute.ts`,
`moves/optionalKoReward.resolve.ts` + `moves/recruitOfficer.ts` (gain-Officer-to-hand variant),
`moves/*Choice.resolve.ts` + `game.ts` + the sim dispatch maps, `ui/uiState.{types,build,filter}.ts`,
`game.test.ts`, `mechanic-provenance.json`, the card-data generator inputs + regenerated
`data/cards/core.json` + derived feeds, and `apps/arena-client/**` renderers.

## Non-Negotiable Constraints

- Moves never throw; new `resolve*` moves follow the validate→gate→mutate→void contract.
- Any new HeroKeyword touches all six lockstep sites + drift + `game.test.ts` move
  registration; any new `resolve*` move enrolls in `SIMULATION_MOVE_NAMES` + both sim
  `MOVE_MAP`s or the simulation hangs (reference: new-resolve-move sim-dispatch lockstep).
- New board-visible `UIState` fields follow the five-step filter pass-through contract
  (declare → build → filter → audience test → diagnostics snapshot).
- Interactive choices are ACTIVE-player-scoped (pending-choice is active-only).
- Card markers via the generator + full regen; all card-data-derived feeds regenerated.

## Contract

- `heroCondition` `first-hero-played-this-turn` = true iff no other Hero is in the acting
  player's `inPlay` when the effect resolves.
- Do-Over on accept: discard the entire current hand, then draw 4.
- Battlefield Promotion: optional KO of a `[team:shield]` Hero from hand or discard → global
  `G.ko`; if KO'd, optionally gain a S.H.I.E.L.D. Officer from supply to the acting player's
  hand. Markers/token forms confirmed against the parser at execution.

## Vision Alignment

- §1 Rules Authenticity — the first-Hero gate, the fixed draw-4, and the S.H.I.E.L.D.-Hero /
  Officer semantics match the rulebook.
- §3 Player Trust & Fairness — every "may" is a real, deterministic, active-player choice.

## Acceptance Criteria

- High-Tech Weaponry grants +1 attack iff another Tech Hero was played this turn.
- Do-Over offers the choice only when it is the first Hero this turn; accept discards the
  hand and draws 4; decline is a clean no-op.
- Battlefield Promotion KOs the chosen S.H.I.E.L.D. Hero and (if taken) puts a S.H.I.E.L.D.
  Officer in hand; declining either step is a no-op; empty supply no-ops the reward.
- Engine + arena-client suites green; `pnpm -r build` 0; `cards:check` reproducible; feeds
  regenerated; determinism impact assessed (new pending-choice `G` shape — re-pin only if a
  hashed field is added; confirm the delta).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — condition, both interactive flows,
   UIState projection, drift/registration green.
2. `pnpm --filter @legendary-arena/arena-client test` — the two renderers.
3. `pnpm -r build` 0; `pnpm cards:check` reproducible; ledger/mechanics/effect-index/
   runtime-observed/coverage feeds regenerated + green.
4. Confirm any hash re-pin is limited to a deliberately-added hashed field (else none).

## Definition of Done

Both suites green, `pnpm -r build` 0, `cards:check` reproducible, three markers live + feeds
regenerated, D-24498 Active, WORK_INDEX + EC_INDEX rows flipped, roadmap mindmap node
flipped, PR squash-merged.

## Reserved Decision (lands at execution)

D-24498 — High-Tech Weaponry marker-only; Do-Over first-Hero condition + optional
discard-hand-and-draw-4; Battlefield Promotion optional-KO + gain-Officer-to-hand reward
variant. See DECISIONS.md.

## Context / split note (operator review)

This WP bundles **two** interactive pending-choice cards (Do-Over, Battlefield Promotion)
plus one data-only card. That is at the heavier end for one execution session (cf. WP-678,
a single interactive card, ran heavyweight). It is drafted as one WP for conceptual
cohesion ("optional/interactive single-player abilities"); if execution finds the two
pending-choice flows too large for one session, split into WP-681a (Do-Over + High-Tech)
and a follow-on (Battlefield Promotion) per the self-demotion rule — the numbers and D-entry
adjust at that point. Flagged here so the reviewer can decide at the 01.0a pause point.

## Lint Gate Self-Review (00.3)

Locked values (first-Hero condition; fixed draw-4; gain-Officer-to-hand additive variant;
S.H.I.E.L.D.-Hero includes the Officer) stated. Cross-layer (Game Engine + Arena Client) —
the interactive cards legitimately cross to the client via the shipped pending-choice model;
no layer inversion (engine decides, client renders). Move/keyword lockstep + sim-dispatch +
UIState five-step contract called out as guardrails. Determinism: new pending `G` shape —
re-pin only if a hashed field is added. Card data regenerated via the generator. Tests
specified per card + projection + renderer. §21 API catalog: N/A. §20 funding: N/A. §1: Files
Expected to Change present; Context carried by Goal + Assumes + the split note. §17.2 Non-Goal
proximity: no pay-to-win / no client authority; determinism preserved (re-pin only if a hashed
field is added). Do-Over's new keyword enrolls in `NO_MAGNITUDE_KEYWORDS`. Heaviness + split
option surfaced. All applicable items satisfied or explicitly N/A.
