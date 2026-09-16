# EC-737 — Put-hand-on-deck-top: draw-then-stack hero keyword (Execution Checklist)

**Source:** docs/ai/work-packets/WP-700-put-hand-on-deck-top.md
**Layer:** Game Engine + Arena Client (cross-layer pending choice)

## Before Starting
- [ ] Scope lock: the exact target file set is `## Files to Produce` below — any edit
      outside it is a FAIL; surface it as a blocker, do not improvise.
- [ ] Baseline is `origin/main` (must contain `dropAllPendingPlayerChoices`, D-24518, in
      `fightMastermind.ts`). If it is absent, STOP — the branch is not off current main.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] Confirm the models exist: `heroEffectSmash` + `moves/smashDiscard.resolve.ts`
      (magnitude park), `moves/resolveDiscardToPlay.ts` (mandatory hand pick, no decline),
      `moves/putCardsOnDeckChoice.resolve.ts` (`deck = [...chosen, ...deck]` top placement),
      `components/play/DiscardToPlayPrompt.vue` (mandatory, no Decline button).
- [ ] Re-read every drift-pin literal at HEAD (they go stale) before editing — see Locked Values.

## Locked Values (do not re-derive; verify each against HEAD first)
- Keyword slug: `put-hand-on-deck-top` (letters/hyphens only — no digit; the generic
  2-segment `[keyword:name:N]` capture applies, so **no `heroAbility.setup.ts` change**).
- Marker form `[keyword:put-hand-on-deck-top:N]`, `N` = printed draw count ∈ {1,2}
  (2 = core/co2e/wpnx + wtif line 838; 1 = anni/dstr + wtif line 1136).
- The keyword carries a magnitude (the **draw count**) → **NOT** in `NO_MAGNITUDE_KEYWORDS`.
- Deck shape: `G.playerZones[playerID].deck: CardExtId[]`, **`deck[0]` is the top** (drawn
  first). Put-on-top idiom (mirror `putCardsOnDeckChoice.resolve.ts`): validate+remove from a
  working hand copy via `moveCardFromZone(hand, [], cardId)`, then `deck = [cardId, ...deck]`.
  **No new `zoneOps.ts` helper** — the inline spread is the established idiom.
- Draw: `drawFromPlayerDeck(G, playerID, effect.magnitude, ctx as ShuffleProvider)` (the
  `heroEffectDraw` idiom). Handler draws FIRST, then parks.
- `PendingPutHandOnDeckTop { playerID: string; sourceCardId?: CardExtId }`; FIFO queue
  `pendingPutHandOnDeckTop?: PendingPutHandOnDeckTop[]` on `LegendaryGameState` — optional,
  lazy-init, never in `Game.setup` (canonical JSON byte-identical → no hash re-pin).
- Resolve: `resolvePutHandOnDeckTop({ cardId })` → validate front-entry `playerID`, confirm
  `cardId` in the active player's hand NOW, move hand→deck-top, `pushLog`, `queue.shift()`.
  **MANDATORY — no decline arm.** Silent `void` on any failure (queue intact).
- `hasPendingPutHandOnDeckTop(G)` → `(G.pendingPutHandOnDeckTop?.length ?? 0) > 0`.
- `getEligiblePutHandOnDeckTopCards(G, playerID)` → `[...hand]` (the whole hand is eligible).
- Move is server-only: `resolvePutHandOnDeckTop: { move, client: false }`.
- Bot default `selectDefaultPutHandOnDeckTopTarget`: lowest-`cost` hand card (CardExtId asc
  tie-break) — deterministic, not strategic.
- Sim dispatch (drift-pinned): `resolvePutHandOnDeckTop` in `SIMULATION_MOVE_NAMES`
  (`ai.legalMoves.ts`) AND a `MOVE_MAP` key in BOTH `simulation.runner.ts` and
  `par.aggregator.ts` — else `simulation.moveDispatch.drift.test.ts` reds / a sim hangs.
- **Drift pins (READ HEAD — these bump by exactly 1):** `HERO_KEYWORDS` length 54→55
  (`heroKeywords.test.ts` + `heroAbility.setup.test.ts`, RUNTIME asserts — D-24372);
  `HERO_EFFECT_HANDLERS`/`HANDLED_KEYWORDS` count 39→40 (`heroEffects.execute.test.ts`);
  `game.test.ts` moves: the sorted expected array has **39** entries at HEAD → add
  `resolvePutHandOnDeckTop` (sorts between `resolvePutCardsOnDeckChoice` and
  `resolveReorderChoice`) → **40** entries, in BOTH the `it('defines moves …')` title and the
  array. NOTE the pre-existing off-by-one: the assertion message ALREADY reads "exactly 40
  moves" and the last progression comment ALREADY reads "(39 → 40)" while the array holds only
  39 — so adding the 40th move makes the message correct; leave the message at "40" (do NOT
  bump to 41) and add a progression `// why:` comment that also notes it corrects the inherited
  label.
- Vanquish drop (D-24518): add `G.pendingPutHandOnDeckTop = undefined;` to
  `dropAllPendingPlayerChoices(G)` in `fightMastermind.ts` + the sentinel in its drift test.

## Guardrails
- Lockstep: `HeroKeyword` union AND `HERO_KEYWORDS` array change together; update both pins.
- Block-all pending choice ships WITH its UIState projection AND client prompt — a parked
  choice without a projection/renderer freezes the game. Five-step Board-Visible Field
  contract (type → build → filter pass-through → audience test → diagnostics snapshot),
  active-player-scoped. **The filter pass-through is the recurring miss — without it the
  prompt never reaches the client.**
- The block-all guard is replicated per action-move (NOT centralized): add
  `hasPendingPutHandOnDeckTop` beside every `hasPendingSmashDiscard` site.
- The new queue MUST be dropped on a true mastermind vanquish (D-24518) + its drift test.
- Placement is MANDATORY — no decline; card → deck **top** (index 0), never shuffled/bottomed.
- Client submits intent only; the engine mutates the deck. Move never throws.
- Card data is GENERATED — edit the marker SOURCE + regen; `cards:check` reproduces the six
  sets byte-identically. Never hand-edit `data/cards/*.json`.
- New `pendingPutHandOnDeckTop?` is optional and absent by default → no `finalStateHash`
  re-pin. If a sentinel hash moves, STOP — a game that never plays one of these cards must
  not change.
- Errors a drift/typecheck gate surfaces are fixed in the test/source, never with `any` /
  `@ts-ignore` / a widened production type.

## Required `// why:` Comments
- `heroEffects.execute.ts` — why `put-hand-on-deck-top` is excluded from
  `NO_MAGNITUDE_KEYWORDS` (its magnitude is the draw count, consumed by the pre-gate).
- `heroEffectPutHandOnDeckTop` — why it draws BEFORE parking (the drawn cards join the hand
  the player then chooses from); why an empty post-draw hand parks nothing.
- `game.ts` (and each replicated site) — why the `hasPendingPutHandOnDeckTop` block-all guard
  is required (freeze prevention).
- `putHandOnDeckTop.resolve.ts` — why there is no decline arm (the printed placement is
  mandatory); why `deck = [cardId, ...deck]` (deck[0] is the top).
- `fightMastermind.ts` — why the new queue joins the vanquish drop (D-24518).

## Files to Produce
### Engine — keyword + type + handler
- `packages/game-engine/src/rules/heroKeywords.ts` — modified — union + array (lockstep).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — modified — `HANDLED_KEYWORDS`,
  `HERO_EFFECT_HANDLERS`, `heroEffectPutHandOnDeckTop` (draw-then-park),
  `selectDefaultPutHandOnDeckTopTarget`; NOT in `NO_MAGNITUDE_KEYWORDS`.
- `packages/game-engine/src/types.ts` — modified — `PendingPutHandOnDeckTop` + queue field.
### Engine — resolve move + guards + vanquish drop
- `packages/game-engine/src/moves/putHandOnDeckTop.resolve.ts` — new — `resolvePutHandOnDeckTop`
  + `hasPendingPutHandOnDeckTop` + `getEligiblePutHandOnDeckTopCards`.
- `packages/game-engine/src/game.ts` — modified — import + move entry (server-only) +
  block-all guard in the stage/turn-advance path.
- `packages/game-engine/src/moves/coreMoves.impl.ts` — modified — block-all guard (3 sites:
  drawCards, playCard, endTurn).
- `packages/game-engine/src/moves/{fightVillain,fightMastermind,recruitHero,recruitOfficer,
  healWounds,dodgeCard}.ts` — modified — block-all guard.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — modified — block-all guard.
- `packages/game-engine/src/moves/fightMastermind.ts` — modified — `dropAllPendingPlayerChoices`
  gains the new queue (D-24518).
### Engine — drift pins
- `packages/game-engine/src/game.test.ts` — modified — move-registration pin (count + array + title).
### Engine — UIState (five-step)
- `packages/game-engine/src/ui/uiState.types.ts` — modified — `UIPendingPutHandOnDeckTop` +
  `pendingPutHandOnDeckTop?` on `UIState`.
- `packages/game-engine/src/ui/uiState.build.ts` — modified — build from front entry.
- `packages/game-engine/src/ui/uiState.filter.ts` — modified — active-player pass-through.
- `packages/game-engine/src/index.ts` — modified — re-export the UI type.
### Engine — sim dispatch
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — modified — bot short-circuit +
  `SIMULATION_MOVE_NAMES`.
- `packages/game-engine/src/simulation/simulation.runner.ts` — modified — `MOVE_MAP` entry.
- `packages/game-engine/src/simulation/par.aggregator.ts` — modified — `MOVE_MAP` entry.
### Client (arena-client)
- `apps/arena-client/src/components/play/PutHandOnDeckTopPrompt.vue` — new — mandatory prompt
  (model on `DiscardToPlayPrompt.vue`, no Decline button).
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — modified — `UIMoveName` union.
- `apps/arena-client/src/pages/PlayDesktop.vue` — modified — import/register/computed/render/prop.
- `apps/arena-client/src/pages/PlayMobile.vue` — modified — identical wiring.
- `apps/arena-client/src/components/play/TurnActionBar.vue` — modified — new prop + call-site arg.
- `apps/arena-client/src/composables/useTurnActions.ts` — modified — append-last param + gates.
- `apps/arena-client/src/diagnostics/effectProvenance.ts` — modified — provenance row.
### Data pipeline + coverage (generated)
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — modified — token pattern arm.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — modified — 7 markers; drop the
  stale `anni` deferred entry.
- `data/cards/{core,co2e,anni,dstr,wpnx,wtif}.json` — modified (generated) — regenerated.
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/mechanic-provenance.json` — modified (generated / provenance row).
- Paired `*.test.ts` for each engine/client source above — new/modified.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm cards:check` reproducible; `ledger:heroes:check` + `effect-index:check` +
      `sim:runtime-observed:check` exit 0 (keyword row `executable`)
- [ ] `finalStateHash` sentinels byte-unchanged (no re-pin), confirmed by a clean run
- [ ] Live-on-surface verification (D-24026): a real play.legendary-arena.com match plays
      Stack the Deck (or a sibling), the prompt appears, the card lands on deck top
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` D-24519 flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph → `✅`, then `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- Game freezes on Stack the Deck with no prompt — the block-all guard or the UIState filter
  pass-through is missing (five-step contract incomplete).
- The drawn cards aren't in hand when the prompt appears — the handler parked BEFORE drawing.
- The chosen card goes to discard or the deck bottom — used `discardFromHand` / appended
  instead of `deck = [cardId, ...deck]`.
- A sentinel `finalStateHash` moved — a non-optional field or a non-card-data edit leaked in.
- `cards:check` diff — a `data/cards/*.json` was hand-edited instead of regenerated.
- A wtif/wpnx sim hangs — `resolvePutHandOnDeckTop` missing from a `MOVE_MAP` (sim dispatch).
