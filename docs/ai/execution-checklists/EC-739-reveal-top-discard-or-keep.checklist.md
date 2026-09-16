# EC-739 — Reveal-top discard-or-keep hero keyword (Execution Checklist)

**Source:** docs/ai/work-packets/WP-702-reveal-top-discard-or-keep.md
**Layer:** Game Engine + Arena Client (cross-layer pending choice)

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce` below — any edit outside it is a
      FAIL; surface it, don't improvise.
- [ ] Baseline `origin/main` at the D-24521 reserve (has D-24518 `dropAllPendingPlayerChoices`,
      D-24512 `resolveRuthlessDictatorChoice`, D-24413 Melter `resolveMelterKoChoice`).
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0;
      `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] Confirm the models: `moves/ruthlessDictatorChoice.resolve.ts` (own-deck snapshot +
      `discard`/`top` disposition), `moves/melterKoChoice.resolve.ts` (each-deck snapshot),
      `villainEffects.execute.ts` Lizard `!== currentPlayer` each-other skip,
      `components/play/PendingMelterKoChoicePrompt.vue`.
- [ ] Re-read every drift-pin literal at HEAD before editing (see Locked Values).

## Locked Values (do not re-derive; verify at HEAD)
- **Two keywords, both NO_MAGNITUDE:** `reveal-top-dispose` (active player's OWN deck) and
  `reveal-top-dispose-others` (EACH OTHER seat's deck, `[hc:instinct]`-gated on Hypnotic Charm).
  Slugs letters/hyphens only; both marker tokens are single-segment (no magnitude):
  `[keyword:reveal-top-dispose]`, `[keyword:reveal-top-dispose-others]`.
- **Pending contract:** `RevealTopDisposition = 'discard' | 'top'`; `RevealedTopEntry {
  ownerPlayerID: string; cardId: CardExtId }`; `PendingRevealTopDispose { choiceType:
  'reveal-top-dispose'; playerID: string; revealedTops: RevealedTopEntry[] }`; FIFO queue
  `pendingRevealTopDispose?: PendingRevealTopDispose[]` on `LegendaryGameState` — optional,
  lazy-init at the park site, never in `Game.setup` (no hash re-pin).
- **Handlers (snapshot, do NOT remove the deck top):**
  - `heroEffectRevealTopDispose(G, ctx, playerID, cardId, _effect)`: reshuffle the active player's
    deck if empty (`ctx.random` via the shared shuffle, the Melter idiom), read `deck[0]`; park
    `{ playerID, revealedTops:[{ownerPlayerID: playerID, cardId: deck[0]}] }`. Empty deck+discard →
    logged no-op (nothing to reveal).
  - `heroEffectRevealTopDisposeOthers(G, ctx, playerID, cardId, _effect)`: for each `pid` in
    `Object.keys(G.playerZones).sort()`, `if (pid === playerID) continue;` reshuffle-if-empty +
    read `deck[0]`, collect into `revealedTops`; park one entry (playerID = active). No other seats
    / all empty → logged no-op (no park).
- **Resolve** `resolveRevealTopDispose({ ownerPlayerID, cardId, disposition })`: validate the front
  entry, `{ownerPlayerID, cardId}` ∈ its `revealedTops`, and `cardId === ownerZones.deck[0]` NOW;
  `discard` → `moveCardFromZone(ownerZones.deck, ownerZones.discard, cardId)`; `top` → no-op;
  splice the resolved `revealedTops` entry; when empty, `queue.shift()`. Silent `void` otherwise.
  Server-only: `resolveRevealTopDispose: { move, client: false }`.
- **Bot default** `selectDefaultRevealTopDisposition(G, ownerPlayerID, cardId)`: `discard` a Wound
  or basic S.H.I.E.L.D. starter (`isCullableDeckTopCard` / `selectScryKoTarget` tiers), else `top`.
- **Sim dispatch (drift-pinned):** `resolveRevealTopDispose` in `SIMULATION_MOVE_NAMES`
  (`ai.legalMoves.ts`) AND a `MOVE_MAP` key in BOTH `simulation.runner.ts` and `par.aggregator.ts`.
- **Drift pins (READ HEAD — bump by exactly 2 keywords / 2 handlers / 1 move):** `HERO_KEYWORDS`
  55→**57** (`heroKeywords.test.ts` + `heroAbility.setup.test.ts`, RUNTIME); `HERO_EFFECT_HANDLERS`
  / `HANDLED_KEYWORDS` 40→**42** (`heroEffects.execute.test.ts`); `game.test.ts` move count 40→**41**
  (ONE shared resolve move; sorts alphabetically) + array + `it('defines moves …')` title.
- **Vanquish-drop (D-24518):** `G.pendingRevealTopDispose = undefined;` in
  `dropAllPendingPlayerChoices` (`fightMastermind.ts`) + the sentinel in its drift test.
- **Card scope (11 base + 1 each-other):** base `[keyword:reveal-top-dispose]` on the standalone
  "Reveal/Look the top card of your deck. Discard it or put it back." line in: core (Hypnotic
  Charm entry 1), rvlt ×2, dstr, cvwr, gotg, shld, xmen ×2, wwhk, wpnx. **wpnx SPLITS** the
  disposition across two `abilities[]` strings ("Look at the top card of your deck." + "Discard it
  or put it back.") — attach the marker to the FIRST ("Look at the top card…") entry; the second
  stays decorative prose. Each-other `[keyword:reveal-top-dispose-others]` on Hypnotic Charm entry
  2 (`core.json:587`), alongside the existing `[hc:instinct]` gate token. OUT OF SCOPE:
  reveal-for-attack (co2e/2099) + bottom-card (fear).

## Guardrails
- Lockstep: `HeroKeyword` union AND `HERO_KEYWORDS` array change together (both keywords); update
  all three RUNTIME pins.
- Block-all pending choice ships WITH its UIState projection AND client prompt (freeze prevention);
  five-step Board-Visible Field contract, active-player-scoped.
- Block-all guard replicated per action-move (the `hasPendingMelterKoChoice` set); enroll the queue
  in `dropAllPendingPlayerChoices` (D-24518) + its drift test.
- The reveal SNAPSHOTS the deck top (does not remove it); `discard` removes it at resolve, `top`
  keeps it. A reshuffle-on-empty uses `ctx.random` — no new randomness.
- Both keywords carry no magnitude → BOTH in `NO_MAGNITUDE_KEYWORDS`.
- Card data GENERATED — marker SOURCE + regen; `cards:check` reproduces the 9 sets. Never hand-edit.
- Optional `pendingRevealTopDispose?` → no `finalStateHash` re-pin. If a sentinel hash moves, STOP —
  a game that plays none of these cards must not change.
- Errors a drift/typecheck gate surfaces are fixed in test/source, never `any`/`@ts-ignore`/weakened.

## Required `// why:` Comments
- `heroEffects.execute.ts` — why both keywords are in `NO_MAGNITUDE_KEYWORDS` (per-card disposition,
  no count).
- the handlers — why the reveal SNAPSHOTS (does not remove) the deck top; why the each-other loop
  skips `currentPlayer` (the base clause is own-deck; the extension is each OTHER deck).
- `revealTopDispose.resolve.ts` — why `discard` removes the exact deck-top card and `top` is a no-op.
- `game.ts` + each replicated site — why the `hasPendingRevealTopDispose` block-all guard (freeze).
- `fightMastermind.ts` — why the queue joins the vanquish drop (D-24518).

## Files to Produce
### Engine — keyword + type + handlers
- `packages/game-engine/src/rules/heroKeywords.ts` — modified — two keywords (union + array).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — modified — `HANDLED_KEYWORDS`,
  `HERO_EFFECT_HANDLERS`, `NO_MAGNITUDE_KEYWORDS`; the two handlers + `selectDefaultRevealTopDisposition`.
- `packages/game-engine/src/types.ts` — modified — disposition/entry/pending types + queue field.
### Engine — move + guards + vanquish drop
- `packages/game-engine/src/moves/revealTopDispose.resolve.ts` — new — resolve + `hasPending…`.
- `packages/game-engine/src/game.ts` — modified — import + move entry (server-only) + block-all guard.
- `packages/game-engine/src/moves/{coreMoves.impl,fightVillain,fightMastermind,recruitHero,
  recruitOfficer,healWounds,dodgeCard}.ts` + `villainDeck/villainDeck.reveal.ts` — modified — guard.
- `packages/game-engine/src/moves/fightMastermind.ts` — modified — vanquish-drop enrollment.
### Engine — drift pins
- `packages/game-engine/src/game.test.ts` — modified — move-registration pin (count+array+title).
### Engine — UIState (five-step)
- `packages/game-engine/src/ui/uiState.types.ts` — modified — `UIRevealedTopEntry` +
  `UIPendingRevealTopDispose` + `UIState` field.
- `packages/game-engine/src/ui/uiState.build.ts` — modified — build from front entry.
- `packages/game-engine/src/ui/uiState.filter.ts` — modified — chooser-only pass-through.
- `packages/game-engine/src/index.ts` — modified — re-export the UI type.
### Engine — sim dispatch
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — modified — short-circuit + `SIMULATION_MOVE_NAMES`.
- `packages/game-engine/src/simulation/simulation.runner.ts` + `par.aggregator.ts` — modified — `MOVE_MAP`.
### Client (arena-client)
- `apps/arena-client/src/components/play/PendingRevealTopDisposePrompt.vue` — new — prompt (model
  on `PendingMelterKoChoicePrompt.vue`).
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — modified — `UIMoveName` union.
- `apps/arena-client/src/pages/PlayDesktop.vue` + `PlayMobile.vue` — modified — import/register/render/prop.
- `apps/arena-client/src/components/play/TurnActionBar.vue` — modified — prop + call-site arg.
- `apps/arena-client/src/composables/useTurnActions.ts` — modified — append-last param + gates.
- `apps/arena-client/src/diagnostics/effectProvenance.ts` — modified — provenance row.
### Data pipeline + coverage (generated)
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — modified — two token arms + detector
  (handle the wpnx split form).
- `scripts/convert-cards/inputs/hero-ability-markers.json` — modified — 11 base + 1 each-other markers.
- `data/cards/{core,rvlt,dstr,cvwr,gotg,shld,xmen,wwhk,wpnx}.json` — modified (generated) — regenerated.
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/mechanic-provenance.json` — modified (generated / provenance rows).
- Paired `*.test.ts` for each engine/client source above — new/modified.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` + `test` exit 0.
- [ ] `pnpm cards:check` reproducible; `ledger:heroes:check` + `effect-index:check` +
      `sim:runtime-observed:check` exit 0 (both keyword rows `executable`).
- [ ] **wpnx orphan check (copilot RISK):** after regen, confirm the wpnx SECOND `abilities[]`
      entry (`"Discard it or put it back."`, wpnx.json:267 — decorative prose, marker rides the
      FIRST "Look at the top card…" entry) introduces NO new hollow / parse-unrecognized row in
      `ledger:heroes` / `runtime-observed-hollows.json`. If a row appears, it means the detector
      is treating the unmarked disposition line as its own ability — STOP and reconcile (attach
      no second marker; the phrase is a continuation of the first entry's effect), do not paper
      over it. `ledger:heroes:check` staying green here is the intended state, not a surprise.
- [ ] `finalStateHash` sentinels byte-unchanged (no re-pin); if the sim sweep shifts,
      `sim:runtime-observed` + the dashboard in-play coverage pin re-pinned honestly (verified).
- [ ] Live-on-surface (D-24026): a real match plays a reveal-top-dispose card; the prompt appears;
      Discard / Keep resolve.
- [ ] STATUS / DECISIONS (D-24521 Active) / WORK_INDEX (checked) / mindmap (✅ + `roadmap:counts:check`).

## Common Failure Smells
- Game freezes on a reveal-top card with no prompt — block-all guard or UIState filter pass-through
  missing (five-step incomplete).
- Discard removes the WRONG card — the resolve didn't confirm `cardId === ownerZones.deck[0]` now.
- Hypnotic Charm's each-other clause fires without the instinct Hero — the `[hc:instinct]` gate
  wasn't attached to entry 2's hook (marker on the wrong entry).
- `cards:check` diff — a `data/cards/*.json` hand-edited instead of regenerated, or the wpnx split
  marker attached to the wrong entry.
- A sim hangs on a reveal-top card — `resolveRevealTopDispose` missing from a `MOVE_MAP`.
