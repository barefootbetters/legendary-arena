# EC-719 — Diving Block + Pure Fury (Execution Checklist)

**Source:** docs/ai/work-packets/WP-682-core-hero-reactive-and-conditional-defeat.md
**Layer:** Game Engine + Arena Client (heavyweight)
**Status:** Pending

## Before Starting
- [ ] **WP-684 (non-active-seat pending-choice capability) shipped** — Diving Block needs the reveal window for a NON-ACTIVE wound recipient (Master Strike / scheme), impossible on the active-only model; do NOT start Diving Block before WP-684 lands
- [ ] Read `defeat-with-bystander` (Silent Sniper): `moves/defeatChoice.resolve.ts` + `moves/fightVillain.ts`/`fightMastermind.ts` — Pure Fury reuses this free-defeat path
- [ ] Read `return-on-discard` (WP-498) — the reactive-chokepoint precedent Diving Block mirrors on the wound side
- [ ] Enumerate every caller of `gainWound` (`board/wounds.logic.ts`) — Diving Block must intercept at the chokepoint so ALL wound sources see it (baseline assertion)
- [ ] Confirm `G.ko` is a single GLOBAL zone (`types.ts`) and how a S.H.I.E.L.D.-team Hero is identified in it (baseline assertion — S.H.I.E.L.D. Hero, NOT `isShieldOrHydra` which also matches HYDRA)
- [ ] `pnpm -r build` 0; engine + arena-client suites green

## Locked Values (do not re-derive)
- [ ] Diving Block = reactive, OPTIONAL, revealed FROM HAND, stays in hand, PER-WOUND (one reveal cancels one Wound), replaces the Wound with "draw a card"
- [ ] Diving Block interception site = `gainWound` chokepoint (NOT any single effect path) — fires for mastermind strikes, scheme twists, villain effects, hero self-wounds
- [ ] Pure Fury = FREE defeat (no attack paid) of a Villain (city) or Mastermind with **printed attack STRICTLY LESS THAN** `count(S.H.I.E.L.D. Heroes in G.ko)`; Masterminds ELIGIBLE
- [ ] Pure Fury KO count = S.H.I.E.L.D.-**team Hero** cards in the GLOBAL `G.ko` (all players), not per-player, not HYDRA
- [ ] Diving Block is offered to the WOUND RECIPIENT — which may be a NON-ACTIVE seat (uses WP-684); it is NOT active-scoped. Pure Fury's target pick IS active-scoped; 0/1/≥2 qualifying targets → no-op / auto / pending (the conditional-defeat family shape)
- [ ] Both `diving-block` and `pure-fury` are NO-MAGNITUDE handler-bearing keywords → they MUST be enrolled in `NO_MAGNITUDE_KEYWORDS` (the most-missed lockstep site — a no-magnitude handler omitted from it silently NEVER runs)
- [ ] `gainWound` today is `gainWound(woundPile, destZone)` (zone arrays) — the interception needs a signature/caller refactor to thread the gaining player + park capability across all 7 callers; NOT a drop-in hook

## Guardrails
- [ ] Diving Block leaves the card IN HAND on reveal (not played, not discarded)
- [ ] Diving Block does NOT change wound-to-discard for players who decline / hold no copy
- [ ] Pure Fury spends NO attack and routes through the shared defeat path (bystander award + on-defeat handlers) — do not fork a parallel defeat
- [ ] Both NEW HeroKeywords touch all SIX lockstep sites + drift test + `game.test.ts` registration
- [ ] Any NEW `resolve*` move enrolls in `SIMULATION_MOVE_NAMES` + BOTH sim `MOVE_MAP`s or the sim hangs
- [ ] New board-visible `UIState` fields follow the FIVE-step filter pass-through
- [ ] Moves never throw; determinism — re-pin only if a hashed field is added (assert the delta)
- [ ] Card markers via the generator + full regen — never hand-edit `data/cards/`

## Required `// why:` Comments
- [ ] The `gainWound` interception hook (why at the chokepoint, per-Wound, wound-recipient-scoped — may be a non-active seat via WP-684, NOT active-scoped)
- [ ] Diving Block "reveal keeps the card in hand" vs a normal play
- [ ] Pure Fury strict `<` and the GLOBAL-`G.ko` S.H.I.E.L.D.-Hero read
- [ ] Pure Fury reusing the `defeat-with-bystander` free-defeat path incl. Masterminds
- [ ] Each new HeroKeyword union/array entry cites WP-682 / D-24499

## Files to Produce
- [ ] `rules/heroKeywords.ts` — `diving-block` + `pure-fury` (six-site lockstep, drift)
- [ ] `board/wounds.logic.ts` — the reactive Diving-Block interception at `gainWound`
- [ ] `hero/heroEffects.execute.ts` — Pure Fury handler (predicate + free defeat) + a pure `countShieldHeroesInKo` helper
- [ ] `moves/*Choice.resolve.ts` — Diving Block reveal/decline + Pure Fury target pick; `game.ts` block-all; sim dispatch
- [ ] `ui/uiState.{types,build,filter}.ts` — projections for both prompts (five-step contract)
- [ ] `apps/arena-client/**` — renderers for the reveal prompt and the free-defeat target prompt
- [ ] `game.test.ts` — move registration for both new moves
- [ ] `mechanic-provenance.json` — rows for `diving-block` + `pure-fury`
- [ ] Card-data generator: markers for both cards + regenerate `data/cards/core.json`
- [ ] Regenerated hero ledger + card-mechanics + effect-index + runtime-observed + coverage feeds
- [ ] Tests: Diving Block (prevent+draw+keep; decline lands; 2 simultaneous wounds; non-hero wound source), Pure Fury (strict `<`; Mastermind; 0/1/≥2 targets; no attack spent; rewards), drift + registration + projection

## After Completing
- [ ] engine + arena-client suites green; `pnpm -r build` 0
- [ ] `pnpm cards:check` reproducible; ledger/mechanics/effect-index/runtime-observed/coverage feeds green
- [ ] hash re-pin only if a hashed field was added (delta verified); else none
- [ ] D-24499 Active; WORK_INDEX `[x]` + EC_INDEX + roadmap mindmap [d]→[x]
- [ ] `Tests-changed:` trailer if a pin moved; PR squash-merged when green

## Common Failure Smells
- Diving Block only intercepts hero self-wounds → the hook is in an effect path, not at `gainWound`.
- Revealing Diving Block discards/plays it → it must STAY in hand.
- One Diving Block cancels multiple wounds → it is per-Wound.
- Pure Fury spends attack or forks its own defeat → reuse the shared free-defeat path.
- Pure Fury counts HYDRA cards or per-player KO → it is S.H.I.E.L.D.-team Heroes in the GLOBAL pile.
- Sim hangs → new `resolve*` move missing sim-dispatch enrollment.
