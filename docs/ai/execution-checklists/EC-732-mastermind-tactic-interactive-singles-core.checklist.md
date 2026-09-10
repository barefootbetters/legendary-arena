# EC-732 — Interactive single-player core mastermind tactics (Red Skull / Magneto) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-695-mastermind-tactic-interactive-singles-core.md
**Layer:** Game Engine + Arena Client
**Status:** Pending

## Before Starting
- [ ] WP-497 (tactic-onFight framework + `handSizeOverrides` / D-24300) landed on `main`; read `dispatchTacticOnFight`, `resolveOctetOfValenceElectrons`, and the `game.ts` `onBegin` fill (`:799` / `:817`)
- [ ] Read the pending-choice siblings FIRST: `moves/scryKoChoice.resolve.ts` (snapshot) + `moves/melterKoChoice.resolve.ts` (sequential resolution) + their `PendingScryKoChoice` / `PendingMelterKoChoice` types and their five-step UIState projection
- [ ] `git grep hasPendingScryKoChoice` — record the CURRENT block-all guard set (it drifts); both new predicates enroll at every site
- [ ] Re-verify baseline vs `origin/main`; `pnpm -r build` 0; engine + arena-client suites green

## Locked Values (do not re-derive)
- [ ] Tactic ext_ids = `core-mastermind-red-skull-ruthless-dictator`, `core-mastermind-magneto-electromagnetic-bubble`
- [ ] Ruthless Dictator = scry `min(3, deck.length)`; 3 cards → exactly one KO + one discard + one top; **<3 rule (D-24512):** apply KO→discard→top priority to as many as exist, remainder stays on top, **never reshuffle**, no `ctx.random.*`
- [ ] Ruthless discard = deck-top → discard via the deck→discard zone helper, **NOT** `discardFromHand`; KO via `koCard`; "top" leaves the card on the deck top
- [ ] Electromagnetic Bubble eligibility = in-play Heroes with `G.cardTraits?.[extId]?.team === 'x-men'` (map-level `?.`, no `heroClass` guard); 0 → no-op, 1 → auto-select inline, ≥2 → park
- [ ] Deferred injection = a specific ext_id added as an extra (7th) card at the defeating player's NEXT `onBegin` fill, then cleared; card-not-locatable → logged no-op
- [ ] Both pending choices are ACTIVE-scoped (`ctx.currentPlayer` only)

## Guardrails
- [ ] Deferred-injection field is a NEW sibling to `handSizeOverrides` (carries WHICH card, not a count) — lazily materialized, absent by default, never seeded in `Game.setup`; confirm the final field name against HEAD
- [ ] Both new pending-queue fields + the injection field are lazily materialized; **verify sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical** (no fixture defeats these tactics → no re-pin); STOP on any drift, never blind-re-pin
- [ ] Five-step UIState contract ×2: declare (`uiState.types.ts`) → populate (`uiState.build.ts`) → **pass through** `uiState.filter.ts` (owner-redacted) → audience-filter test → Play Diagnostics `uiStateSnapshot`. A field that reaches build but not the filter whitelist is silently dropped
- [ ] New-resolve-move sim lockstep ×2: `SIMULATION_MOVE_NAMES` + `getLegalMoves` short-circuit + BOTH `MOVE_MAP`s (`simulation.runner.ts` + `par.aggregator.ts`) + `simulation.moveDispatch.drift.test.ts` — or the simulator HANGS
- [ ] Both moves registered in `game.ts` moves AND asserted by the `game.test.ts` move-registration drift test
- [ ] Both `hasPending…` predicates enrolled in the FULL block-all guard set (verified via grep, not this list); turn-end + action moves blocked while pending
- [ ] Resolve moves silent no-op on invalid/stale state, queue left byte-identical for resubmit; front-pop only on completion
- [ ] No `boardgame.io` import in `tacticHandlers.ts` (`ctx` via `unknown`); no `.reduce()`; zone mutation via `zoneOps`/zone helpers; both resolved effects LOG
- [ ] Client `useTurnActions` params appended LAST (positional-caller safety); prompts mount in BOTH `PlayDesktop.vue` + `PlayMobile.vue`; any `gameText` via `AbilityText.vue`
- [ ] No card-data edit (resolver-only); tactic-provenance rows added + effect-index regenerated

## Required `// why:` Comments
- [ ] Both tactic-id constants cite WP-695 / D-24512 + the printed Fight text
- [ ] The deferred-injection field cites WP-695 / D-24512 + why `handSizeOverrides` (count-only) cannot carry a specific card
- [ ] The `onBegin` injection consume/clear cites the WP-497 `handSizeOverrides` co-location
- [ ] Ruthless <3 disposition-priority + "no reshuffle / no `ctx.random`" cite the rulebook look-at
- [ ] Electromagnetic 0/1/≥2 branch (auto-select at 1) cites the undercover auto precedent
- [ ] The re-pin-not-expected note cites `reference_hashed_g_field_dual_repin` (lazily-materialized, no fixture defeats these)

## Files to Produce
- [ ] `rules/tacticHandlers.ts` — `resolveRuthlessDictator` + `resolveElectromagneticBubble` + 2 consts + 2 dispatch branches
- [ ] `types.ts` — `PendingRuthlessDictatorChoice` + queue, `PendingElectromagneticBubbleChoice` + queue, deferred-injection field
- [ ] `moves/ruthlessDictatorChoice.resolve.ts` + `moves/electromagneticBubbleChoice.resolve.ts` (+ `hasPending…` predicates)
- [ ] `game.ts` — register 2 moves; consume + clear deferred injection at `onBegin`; enroll 2 guards
- [ ] block-all guard enrollment across the grep'd set (`coreMoves.impl.ts`, `discardChoice.resolve.ts`, `dodgeCard.ts`, `fightMastermind.ts`, `fightVillain.ts`, `healWounds.ts`, `melterKoChoice.resolve.ts`, `recruitHero.ts`, `recruitOfficer.ts`, `scryKoChoice.resolve.ts`, `villainDeck/villainDeck.reveal.ts`, `simulation/ai.legalMoves.ts` — CONFIRM vs HEAD)
- [ ] `ui/uiState.types.ts` / `uiState.build.ts` / `uiState.filter.ts` — five-step projection ×2
- [ ] `simulation/ai.legalMoves.ts` / `simulation.runner.ts` / `par.aggregator.ts` — sim move lockstep ×2
- [ ] `apps/arena-client/.../Pending{RuthlessDictator,ElectromagneticBubble}ChoicePrompt.vue` + `uiMoveName.types.ts` + `useTurnActions.ts` + `TurnActionBar.vue` + `Play{Desktop,Mobile}.vue`
- [ ] `scripts/coverage/tactic-provenance.json` — 2 `executable` rows
- [ ] Tests: resolvers (park/inline/no-op), resolve moves (valid, sequential front-pop, <3 edge, invalid no-op), deferred injection (materialize at right `onBegin` + not-locatable edge), UIState build + filter survival ×2, sim dispatch drift, `game.test.ts` registration, both client prompt renderers
- [ ] Regenerated tactic-provenance + effect-index + runtime-observed

## After Completing
- [ ] engine + arena-client suites green; `pnpm -r build` 0
- [ ] sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical (verified, not assumed) — no re-pin
- [ ] `effect-index:check` + `sim:runtime-observed:check` current after regen; tactic-provenance rows present
- [ ] `git diff --name-only` = allowlist + governance only
- [ ] D-24512 Active; WORK_INDEX `[x]` row + EC_INDEX row flipped; roadmap mindmap node flipped; `roadmap:counts:check` 0; `STATUS.md` close-out
- [ ] Two-commit topology (EC-732 impl + SPEC close); D-24026 live-verify performed or operator-pending; PR squash-merged when green

## Common Failure Smells
- Parked a choice with no UIState projection or no renderer → human player hard-freezes (the exact WP-567 deferral reason).
- Field reaches `uiState.build.ts` but not the `uiState.filter.ts` whitelist → prompt renders blank; add the owner-redacted pass-through + the survival test.
- New resolve move missing from a sim `MOVE_MAP` or `SIMULATION_MOVE_NAMES` → the simulator hangs on a match that defeats these tactics.
- Ruthless "discard" routed through `discardFromHand` → wrong chokepoint (it is a deck-top card); use the deck→discard zone helper.
- Deferred injection folded into `handSizeOverrides` → loses WHICH card (count-only field); needs the specific-ext_id sibling.
- Guard set enrolled from this file's list instead of a fresh `git grep` → a missed site lets turn-end fire mid-choice.
- Re-pinned an oracle to "fix" a shift → these tactics defeat no committed fixture; any drift is a real bug to diagnose, not to pin over.
