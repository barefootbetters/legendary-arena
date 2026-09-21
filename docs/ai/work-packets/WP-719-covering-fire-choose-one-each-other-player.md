# WP-719 — Covering Fire choose-one each-other-player hero effect

**Status:** Executed 2026-09-20 · **EC:** EC-756 · **Reserves:** D-24541
**Layers:** Game Engine + Arena Client · **Lane:** standard two-session (cross-layer, new contract field, pending-choice + determinism-adjacent surface — NOT lightweight-eligible)

## Goal

Implement Hawkeye's **Covering Fire** — `[hc:tech]: Choose one: each other player
draws a card or each other player discards a card.` — for **both identical printings**
(`core/hawkeye/covering-fire` idx0 and `msp1/hawkeye/covering-fire` idx0), which are
hollow today (the `[hc:tech]` gate parses but the choose-one has no engine effect). The
active player, when the gate passes (another tech Hero was played this turn), is shown a
two-option prompt; the chosen branch applies to **each other seat**: draw a card, or discard
a card. Resolves the two `_deferred` entries in the hero-ability curated map.

## Assumes

- **WP-286 / D-24069** ✅ — the draw-or-empowered choose-one pending-choice pattern (park a
  binary choice for the active player, resolve via a server-only `resolve*` move). Model.
- **WP-476 / D-24284** ✅ — the each-player active-scoped auto-resolve: an interactive choice
  is ALWAYS active-player-scoped; non-active seats are auto-resolved deterministically inside
  the effect. Covering Fire's discard branch auto-picks each other seat's card.
- **WP-676 / D-24492** ✅ — `selectDefaultSmashDiscardTarget(G, playerID)` (lowest cost, ext_id
  asc tie-break), reused as the deterministic auto-discard selector for each other seat.
- **WP-702 / D-24521** ✅ — `reveal-top-dispose-others`, the each-other-seat iteration idiom
  (`Object.keys(G.playerZones).sort()`, skip active) + a park handler.
- The `[hc:tech]` prefix already parses as a `heroClassMatch` play-gate condition (unchanged) —
  this WP adds only the choose-one keyword + handler + resolve move.

## Context

Surfaced by the 2026-07-16 Red Skull live-game review (match `TYB2-jQuUc_`, turn 18): the
`[hc:tech]` condition was met and Covering Fire silently no-oped. The effect is a compound
that no existing executor covered — a two-branch choose-one whose BOTH branches act on every
OTHER player — so it was deferred in `hero-ability-markers.json._deferred` pending an engine
handler + keyword. Both printings are byte-identical text, so one WP fixes both. Every
multi-seat Legendary match is cooperative, so "each other player draws" is a gift to
teammates and "each other player discards" is a shared downside — a genuine either/or (neither
dominant), which is why it parks an interactive choice rather than auto-resolving.

## Scope (In)

- New `covering-fire` **HeroKeyword** (union + array + `HANDLED_KEYWORDS` +
  `NO_MAGNITUDE_KEYWORDS`) and `heroEffectCoveringFire` park handler (registered in
  `HERO_EFFECT_HANDLERS`) that pushes ONE `PendingCoveringFireChoice { playerID, sourceCardId }`
  for the ACTIVE player (silent park, lazy-init, never in `Game.setup`).
- New `PendingCoveringFireChoice` type + `G.pendingCoveringFireChoices?` FIFO field.
- New server-only `resolveCoveringFireChoice({ choice: 'draw' | 'discard' })` move + the
  `hasPendingCoveringFireChoice` block-all guard replicated across every action move
  (`game.ts`, `coreMoves.impl.ts` ×3, `fightVillain`, `fightMastermind`, `recruitHero`,
  `recruitOfficer`, `dodgeCard`, `healWounds`, `villainDeck.reveal`) + the sim short-circuit.
  Draw branch: each other seat draws 1 (`drawCardsIntoHand`). Discard branch: each other seat
  auto-discards `selectDefaultSmashDiscardTarget` via the `discardFromHand` chokepoint.
- UIState projection (`UIPendingCoveringFireChoice { playerID, otherPlayerCount }`) + audience-
  filter chooser-redaction pass-through + `index.ts` re-export.
- Arena client: `CoveringFireChoicePrompt.vue` + `UiMoveName` union + `useTurnActions` End-Turn
  / Pass / Heal gate + `TurnActionBar` prop + `PlayDesktop`/`PlayMobile` mount + prop pass +
  the `anyPendingChoice()` auto-advance aggregate.
- Sim dispatch: `SIMULATION_MOVE_NAMES` + both `MOVE_MAP`s (runner + par.aggregator).
- Curated map: two apply entries (core + msp1) + remove the two `_deferred` entries +
  extend the apply-script token grammar; regenerate `data/cards/core.json` + `msp1.json`,
  the hero ledger, the mechanics-metadata feed, and the effect-implementation index.

## Scope (Out)

- Making non-active seats interactively choose their own discard (a turn-engine change per
  D-24284 — deferred; the auto-pick is the freeze-safe behavior).
- Any change to the `[hc:tech]` heroClassMatch gate semantics.
- Other Hawkeye cards / other sets.

## Files Expected to Change

Engine: `types.ts`, `moves/coveringFireChoice.resolve.ts` (new), `hero/heroEffects.execute.ts`,
`rules/heroKeywords.ts`, `game.ts`, `moves/coreMoves.impl.ts`, `moves/fightVillain.ts`,
`moves/fightMastermind.ts`, `moves/recruitHero.ts`, `moves/recruitOfficer.ts`,
`moves/dodgeCard.ts`, `moves/healWounds.ts`, `villainDeck/villainDeck.reveal.ts`,
`simulation/ai.legalMoves.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`,
`ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `index.ts`.
Engine tests: `moves/coveringFireChoice.resolve.test.ts` (new), `game.test.ts`,
`rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`.
Arena client: `components/play/CoveringFireChoicePrompt.vue` (new) + `.test.ts` (new),
`components/play/uiMoveName.types.ts`, `composables/useTurnActions.ts`,
`components/play/TurnActionBar.vue`, `pages/PlayDesktop.vue`, `pages/PlayMobile.vue`.
Data/tooling: `scripts/convert-cards/inputs/hero-ability-markers.json`,
`scripts/convert-cards/apply-hero-ability-markers.mjs`, `data/cards/core.json`,
`data/cards/msp1.json`, `data/metadata/card-mechanics.json`,
`data/metadata/effect-implementation-index.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`.

## Contract

- `resolveCoveringFireChoice({ choice: 'draw' | 'discard' })` — server-only (`client: false`).
- `UIPendingCoveringFireChoice = { playerID: string; otherPlayerCount: number }`, chooser-redacted.
- `[keyword:covering-fire]` — single-segment, no-magnitude marker token.
- Drift pins: `HERO_KEYWORDS` 59→60, `HERO_EFFECT_HANDLERS` 43→44, moves 41→42 (all runtime).

## Acceptance Criteria

- Choosing draw → each other seat draws 1; the active seat is untouched; queue pops.
- Choosing discard → each other seat auto-discards its lowest-cost card (via `discardFromHand`);
  the active seat is untouched; an empty-hand seat discards nothing; queue pops.
- With the `[hc:tech]` gate failing (no other tech Hero in play) → the hook parks nothing.
- The pending choice surfaces in the Play Diagnostics `uiStateSnapshot` and the client prompt
  renders only for the chooser (redacted for opponents/spectators); the board does not freeze.
- `cards:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`,
  `sim:runtime-observed:check` all green; engine + arena-client suites green.

## Verification Steps

1. `pnpm --filter @legendary-arena/registry --filter @legendary-arena/game-engine build`
2. Engine: `node --import tsx --test "src/**/*.test.ts"` (3960/0).
3. Arena client: `pnpm --filter @legendary-arena/arena-client typecheck && ... test` (1871/0).
4. Data: `pnpm cards:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`,
   `pnpm ledger:heroes:check`, `pnpm sim:runtime-observed:check`.
5. D-24026 live-verify (operator): play a match where a tech Hero + Hawkeye Covering Fire land
   the same turn; the choose-one prompt appears; picking each branch behaves per AC; no freeze.

## Definition of Done

- [x] Engine keyword + handler + resolve move + guards + sim dispatch, all drift pins bumped.
- [x] UIState projection + audience-filter pass-through + index re-export.
- [x] Arena-client prompt + move union + End-Turn/Heal gate + both play pages.
- [x] Curated map resolved (apply entries added, `_deferred` removed) + data regenerated.
- [x] Engine 3960/0, arena-client 1871/0, vue-tsc clean, all derived gates green.
- [ ] D-24026 live-verify (operator-pending).

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1–4 (structure/goal/assumes/context):** present above.
- **§5–7 (scope/files/contract):** closed enumerations above; file allowlist matches `git diff`.
- **§8 canonical field names:** `MatchSetupConfig` untouched; `choice`/`playerID`/`otherPlayerCount`
  are new UI/move field names, consistent with sibling pending choices (00.2 unaffected).
- **§9 determinism:** all randomness via `context.random.Shuffle` (draw reshuffle); seat iteration
  is sorted; discard auto-pick is deterministic. No `Math.random()`.
- **§10 layer boundary:** engine owns the effect; client submits intent only; no upward imports.
- **§11 persistence:** `G.pendingCoveringFireChoices` is runtime-only, lazy-init, never in setup;
  no snapshot/DB surface; `finalStateHash` unchanged (sentinel is core-2p-Doom, never plays Hawkeye).
- **§12–20:** `// why:` comments on every `ctx.random`/guard/park; no `.reduce()`; error paths are
  silent no-ops per the move contract; drift pins updated in lockstep with their canonical arrays.
- **§21 API catalog:** N/A — no `apps/server` HTTP endpoint or Library-only function changed.

**Pre-flight:** READY (dependencies all ✅ on main; scope locked; the each-other-player + park
patterns are established precedents; determinism unchanged). **Copilot:** PASS (the sim-dispatch
three-site lockstep, the audience-filter pass-through, and the full guard set — the historically
under-scoped pieces — are all in the allowlist and verified by the drift + suite runs).
