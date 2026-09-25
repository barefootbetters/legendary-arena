# EC-790 — Reveal-three assign (draw / discard / KO) hero keyword (Execution Checklist)

**Source:** docs/ai/work-packets/WP-753-reveal-three-assign.md
**Layer:** Game Engine + Arena Client (cross-layer pending choice)
**Status:** Pending

## Before Starting
- [ ] Scope lock: `## Files to Produce` is the whole allowlist — an edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `04a6d0ab` (the D-24580 reserve). `pnpm install`, then
      `pnpm -r build`, engine `test`, arena-client `typecheck` + `test` all exit 0; record counts.
- [ ] Read the models: `moves/ruthlessDictatorChoice.resolve.ts`, `rules/tacticHandlers.ts`
      `resolveRuthlessDictator` (L1136–1177), `moves/revealTopDispose.resolve.ts`,
      `heroEffectRevealTopDispose` + `parkRevealTopDispose`, `drawCards.logic.ts`
      `reshuffleDiscardIntoDeck` (appends — D-24285), `PendingRuthlessDictatorChoicePrompt.vue`.

## Locked Values (do not re-derive; verify at HEAD)
- **Keywords (both NO_MAGNITUDE, single-segment tokens):** `reveal-three-assign`
  (`[keyword:reveal-three-assign]`) and `reveal-three-assign-again` (`[keyword:reveal-three-assign-again]`).
- **Types:** `RevealThreeAssignDisposition = 'draw' | 'discard' | 'ko'`;
  `PendingRevealThreeAssign { choiceType: 'reveal-three-assign'; playerID: string; sourceCardId:
  CardExtId; revealedCardIds: CardExtId[]; availableDispositions: RevealThreeAssignDisposition[];
  remainingRepeats: number }`; queue `pendingRevealThreeAssign?: PendingRevealThreeAssign[]` —
  optional, lazy-init at the park site, never in `Game.setup`.
- **Dispositions:** `availableDispositions = ['draw','discard','ko']` always; the entry completes when
  `revealedCardIds` is empty (unused slots are discarded with it).
- **Reveal rule:** deck.length < 3 → `reshuffleDiscardIntoDeck(zones, ctx as ShuffleProvider)`
  (appends beneath), then snapshot `deck.slice(0, min(3, deck.length))` without removing.
  0 cards → logged no-op, no park. An entry for the player ALREADY queued → no snapshot; bump the
  LAST such entry's `remainingRepeats`.
- **Again:** increment `remainingRepeats` on the LAST queued entry where `playerID === active &&
  sourceCardId === cardId`; none → call `heroEffectRevealThreeAssign` (fresh reveal).
- **Resolve** `resolveRevealThreeAssign({ cardId, disposition })`: front entry with
  `front.playerID === playerID` (submitting seat) and `choiceType === 'reveal-three-assign'`; `cardId ∈ revealedCardIds`; `disposition ∈ availableDispositions`. `draw` → `moveCardFromZone(deck, hand)` unless
  `turnEconomy.drawsLocked` (then card stays, `[blocked]` log, slot consumed, no count); `discard` →
  `moveCardFromZone(deck, discard)`; `ko` → `moveCardFromZone(deck, [])` + `koCard`
  (`board/ko.logic.ts`). A realized `draw` also does `turnEconomy.cardsDrawn += 1`. Stale card →
  splice it and the SUBMITTED disposition's slot. Randomness: destructure `{ G, playerID,
  ...context }`, pass `context as unknown as ShuffleProvider` (`doOver.resolve.ts` L131). Entry empty (after an applied OR a stale-drop step):
  `remainingRepeats > 0` → re-reveal via the top-up + snapshot steps ONLY (never by calling
  `heroEffectRevealThreeAssign` — its already-queued bump would hit the emptied front) and replace the front with a fresh entry
  (`remainingRepeats − 1`, empty reveal → front-pop); else `shift()`. Server-only
  `resolveRevealThreeAssign: { move, client: false }`; never throws.
- **Bot** `selectDefaultRevealThreeAssignment(G, entry)` (in `revealThreeAssign.resolve.ts`) →
  `{ cardId, disposition }` for ONE step; cost = `G.cardStats[id]?.cost ?? 0`: if `ko` open and a
  Wound / basic S.H.I.E.L.D. starter is revealed (`isCullableDeckTopCard`,
  `villain/villainEffects.execute.ts` L1976) → KO it; else if `draw` open → the highest-cost revealed
  card (ties: revealed order); else if `discard` open → the first remaining card; else `ko` it. Short-circuit beside Ruthless Dictator's (`ai.legalMoves.ts` ~L657).
- **UIState:** field `pendingRevealThreeAssign?: UIPendingRevealThreeAssign`; `revealedCards:
  UIRevealThreeAssignCard[]` with `display: UICardDisplay`; `availableDispositions:
  ('draw'|'discard'|'ko')[]`; chooser-only (the `pendingRuthlessDictatorChoice` audience,
  `uiState.filter.ts` L764).
- **Markers (4):** `abilities[0]` `[keyword:reveal-three-assign]` on vnom `venomized-dr-strange/
  crystal-of-kadavus`, 3dtc `howard-the-duck/interplanetary-visitor`, dims `howard-the-duck/
  interplanetary-visitor`; Crystal `abilities[1]` `[keyword:reveal-three-assign-again]` beside its
  existing `[team:venomverse][team:venomverse]` tokens.
- **Drift pins (bump exactly):** `HERO_KEYWORDS` 65→**67** in `rules/heroKeywords.test.ts`
  L64–69, `rules/heroAbility.setup.test.ts` L629 + its ORDERED `expectedKeywords` (append both, in
  `HERO_KEYWORDS` order), `setup/heroAbility.setup.test.ts` L1430; `HERO_EFFECT_HANDLERS` /
  `HANDLED_KEYWORDS` 49→**51** (`heroEffects.execute.test.ts` L112 + L7132); `game.test.ts` moves
  43→**44** (count + sorted array + message). Neither keyword joins `REVEAL_KEYWORDS`.

## Guardrails
- Lockstep union + array; all RUNTIME pins updated (D-24372).
- Block-all choice ships with UIState five-step AND the prompt (freeze prevention); guard at every
  `hasPendingRevealTopDispose` site + bot short-circuit; enroll in `dropAllPendingPlayerChoices`
  (cleared at the winning turn's end since WP-732 — NOT at vanquish) + `ALL_PENDING_FIELDS`.
- `PendingRuthlessDictatorChoice`, its resolve move and prompt are NOT touched (contract lock).
- The reveal SNAPSHOTS; cards move only at resolve. Randomness only via `reshuffleDiscardIntoDeck`.
- Card data GENERATED (marker source + regen); `cards:check` byte-reproducible.
- Optional queue field → no `finalStateHash` re-pin; if a sentinel moves, STOP.
- Gate-surfaced errors are fixed in source/tests — never `any` / `@ts-ignore` / weakened assertions.

## Required `// why:` Comments
- `heroEffects.execute.ts` — NO_MAGNITUDE membership; Reveal tops up (D-24285) unlike Ruthless
  Dictator's Look; again = counter, not a second park (synchronous siblings, D-24521 §6).
- `revealThreeAssign.resolve.ts` — slot consumption = "one of each"; draw-lock branch (D-24552);
  stale-card drop (never loop); repeat re-reveal at empty.
- `game.ts` + each guard site — the block-all guard; `mastermindVictory.logic.ts` — the winning-turn
  drop (D-24518 / WP-732).

## Files to Produce
- Engine: `rules/heroKeywords.ts`, `hero/heroEffects.execute.ts`, `types.ts`,
  `moves/revealThreeAssign.resolve.ts` (new), `game.ts`, `moves/{coreMoves.impl,fightVillain,
  fightMastermind,recruitHero,recruitOfficer,healWounds,dodgeCard}.ts`,
  `villainDeck/villainDeck.reveal.ts`, `endgame/mastermindVictory.logic.{ts,test.ts}`,
  `ui/uiState.{types,build,filter}.ts`, `index.ts`, `simulation/{ai.legalMoves,simulation.runner,
  par.aggregator}.ts` — all under `packages/game-engine/src/`.
- Client (`apps/arena-client/src/`): `components/play/PendingRevealThreeAssignPrompt.vue` (new),
  `components/play/{TurnActionBar.vue,uiMoveName.types.ts}`, `pages/{PlayDesktop,PlayMobile}.vue`,
  `composables/useTurnActions.ts`, `diagnostics/effectProvenance.ts`.
- Pins/tests (under `packages/game-engine/src/`): `rules/heroKeywords.test.ts`,
  `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`,
  `game.test.ts`, `ui/uiState.filter.test.ts`; plus `apps/server/src/autoplay/botLoopProgress.test.ts`.
- Data: `scripts/convert-cards/apply-hero-ability-markers.mjs`,
  `scripts/convert-cards/inputs/hero-ability-markers.json`, `data/cards/{vnom,3dtc,dims}.json` (generated).
- Coverage (generated / provenance): `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`,
  `data/metadata/{effect-implementation-index,card-mechanics}.json`,
  `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/mechanic-provenance.json`,
  `scripts/coverage/hero-effect-coverage.baseline.json` (if it shifts),
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (if `totalObs` shifts — expected).
- Paired `*.test.ts` for each source above (incl. the prompt test and the drift tests).
- Govern-close (`SPEC:`): STATUS, DECISIONS (D-24580 Active), WORK_INDEX, EC_INDEX, mindmap.

## After Completing
- [ ] Engine + arena-client suites green; arena-client `typecheck` 0; `pnpm -r build` 0 (counts in body).
- [ ] `apply-hero-ability-markers.mjs --validate`, `cards:check`, `ledger:heroes:check`,
      `effect-index:check`, `sim:coverage --check`, `sim:runtime-observed:check` exit 0 (regenerated
      honestly if shifted); dashboard + server tests green.
- [ ] `finalStateHash` sentinels unchanged.
- [ ] Live (D-24026): Crystal of Kadavus prompts; with a Venomverse Hero in play it prompts twice.
- [ ] STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap (✅ + `roadmap:counts:check`).

## Common Failure Smells
- Freeze with no prompt — five-step or a guard site missed.
- Crystal's second prompt shows the SAME three cards — the again-handler parked a second entry
  instead of bumping `remainingRepeats`.
- Crystal repeats without a Venomverse Hero — the again marker landed on `abilities[0]`, or the gate
  tokens were dropped from `abilities[1]`.
- Sim hangs on these cards — `resolveRevealThreeAssign` missing from a `MOVE_MAP` / `SIMULATION_MOVE_NAMES`.
