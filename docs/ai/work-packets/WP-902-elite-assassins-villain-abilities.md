# WP-902 — Elite Assassins do what they print: villain Dark Memories, Black Lotus, Snapdragon, Iron Maiden and Blue Talon (Game Engine + card data)

**Status:** Draft 2026-11-19 (EC-940; D-24859 reserved, #3446) — pre-flight READY TO EXECUTE; copilot CONFIRM; 00.3 PASS
**Layer:** Game Engine (six no-param villain primitives, a villain Dark Memories fight-cost term built at setup, owed-choice variants on the shipped D-24750 and D-24817 queues) + card data (bkwd villain markers)
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay rules on four bkwd villains (seven hollow lines start working) and a fight-cost term on five villains (bkwd + rvlt), one omit-when-empty `G` field, card data and derived feeds; `finalStateHash` sentinels byte-identical; no auth, money, persistence or server surface
**Hard-deps:** WP-760 / D-24589 (villain Blood Frenzy: the setup-scan → `G` flag → `resolveFightCost` term pattern) ✅, WP-817 / D-24750 (owed every-player effect discards, `G.pendingEscapeEffectDiscards`, opened after the move) ✅, WP-837 / D-24770 (Ambush rides that FIFO; trait discard) ✅, WP-839 / D-24772 (any-card discard variant, presence-tested) ✅, WP-872 / D-24817 (`G.pendingVillainFightPicks`, fight picks opened from `onMove`) ✅, WP-684 / D-24501 (multi-seat seat choice) ✅, WP-678 / D-24494 (Undercover = Victory Pile + `zones.undercover`, 1 VP each) ✅, WP-901 / D-24858 (`'your-hero'` Undercover choice, `moveCardUndercover`) ✅, WP-836 / D-24769 (`isGreyHero` / `matchesGreyHeroFilter`) ✅, WP-899 / D-24856 (a mid-turn exit from play is recorded; the inPlay write-site drift tables) ✅, D-24583 (a Wound costs 0) ✅
**Origin:** WP-770 live-verify (match `5O59pcTtXIS`, 2026-11-19) logged `no-handler` `unmarked-ability` breadcrumbs for Iron Maiden (onAmbush + onFight), Black Lotus (onAmbush + onFight) and Snapdragon (onAmbush); Indestructible Man (WP-768) Always Leads this group.

## Goal

Make every printed Elite Assassins line do what it says. Today seven of the eight Ambush / Fight lines carry no `[effect:]`
marker, so they log an `unmarked-ability` breadcrumb and do nothing, and the two "4+" / "3+" villains never get their Dark
Memories bonus:

| Card | Line (rules text, bkwd) | Today | After |
|---|---|---|---|
| Blue Talon (3+) | `[keyword:Dark Memories]` | no bonus | +1 Attack per Hero Class among cards in the fighter's discard pile |
| Blue Talon | Ambush: Each player reveals a Ranged Hero or gains a Wound. | works (WP-469) | unchanged |
| Blue Talon | Fight: You may send a Hero from your discard pile Undercover. | hollow | optional pick from the fighter's discard pile |
| Iron Maiden (4+) | `[keyword:Dark Memories]` | no bonus | as Blue Talon |
| Iron Maiden | Ambush: Each player must send one of their non-grey Heroes Undercover. | hollow | every player with a non-grey Hero sends one (no decline) |
| Iron Maiden | Fight: Each player may Unleash one of their Heroes from Undercover. | hollow | every player with an Undercover Hero may return one to hand |
| Snapdragon | Ambush: Each player discards a non-grey Hero. Then each player draws a card. | hollow | every player with one discards a non-grey Hero, then every player draws 1 |
| Snapdragon | Fight: You may send one of your Heroes Undercover. | hollow | the WP-901 Undercover prompt (hand + played, "Don't send") |
| Black Lotus | Ambush: Each player discards a card that costs 0. | hollow | every player with a 0-cost card (Wounds included) discards one |
| Black Lotus | Fight: You get +3 Recruit. | hollow | +3 Recruit |

The Dark Memories scan is keyed on the printed keyword, not the set, so the three rvlt Hood's Gang villains that print the same
bare `[keyword:Dark Memories]` line (Cancer 3+, Chemistro 4+, Madam Masque 5+) gain the same bonus.

## User-Visible Impact

`play.legendary-arena.com`: Blue Talon and Iron Maiden show their real Attack in the City (base + the number of Hero Classes in
the active player's discard pile) and cost that to fight. Black Lotus's Fight logs `+3` Recruit. Black Lotus's and Snapdragon's
Ambush open the every-player discard prompt (Snapdragon then draws everyone a card); Iron Maiden's Ambush opens an every-player
"send a non-grey Hero Undercover" prompt; Iron Maiden's Fight opens an every-player "Unleash" prompt with "Don't Unleash"; Blue
Talon's Fight opens a "send a Hero from your discard pile Undercover" prompt with "Don't send"; Snapdragon's Fight opens the
existing WP-901 Undercover prompt. The seat-choice prompts use the generic `PendingSeatChoicePrompt.vue` heading ("Your choice")
with self-describing option labels. No `unmarked-ability` breadcrumb fires for these seven lines. Live-on-surface is
operator-pending (D-24026).

## Assumes

- Baseline `origin/main` = `11d21e201` (the WP-902 reserve merge, #3446). At the baseline: `pnpm -r build` exits 0; game-engine
  `pnpm --filter @legendary-arena/game-engine test` = **7450 pass / 0 fail, 1683 suites** (observed 2026-11-19 at `eb81fe5cc`;
  only docs changed since).
- **Card data (rules text, observed):** `data/cards/bkwd.json` villain group `elite-assassins` — Blue Talon (vAttack `3+`,
  abilities `[keyword:Dark Memories]` / `Ambush: … [effect:reveal-or-wound:hc:ranged]` / `Fight: You may send a Hero from your
  discard pile [keyword:Undercover].`), Iron Maiden (`4+`; `[keyword:Dark Memories]` / `Ambush: Each player must send one of their
  non-grey Heroes [keyword:Undercover].` / `Fight: Each player may [keyword:Unleash] one of their Heroes from [keyword:Undercover].`),
  Snapdragon (`4`; `Ambush: Each player discards a non-grey Hero. Then each player draws a card.` / `Fight: You may send one of
  your Heroes [keyword:Undercover].`), Black Lotus (`6`; `Ambush: Each player discards a card that costs 0.` / `Fight: You get
  +3[icon:recruit].`); 2 copies each. `data/cards/rvlt.json` `hoods-gang`: Cancer `3+`, Chemistro `4+`, Madam Masque `5+` each
  have ability 0 = `[keyword:Dark Memories]`; The Dark Dimension prints `Villains here get [keyword:Dark Memories]. …` (not a bare
  line). The Hood / Epic Hood (Mastermind) print `[keyword:Dark Memories]` / `[keyword:Double Dark Memories]`.
- `data/cards/bkwd.json` is GENERATED; villain markers come from `scripts/convert-cards/inputs/villain-effect-markers.json`
  (`villains → bkwd → elite-assassins` holds only `blue-talon: { ambush: ["reveal-or-wound:hc:ranged"] }` today) via
  `scripts/convert-cards/apply-effect-markers.mjs`, whose own hand-synced `VILLAIN_EFFECT_PRIMITIVES` array (64 entries, last
  `put-self-beside-mastermind`) must list every token.
- **Villain parse:** `setup/villainAbility.setup.ts` `extractEffects` reads only `[effect:]` markers; a no-param primitive parses
  through `parseUngatedEffect`'s terminal `parts.length === 1` branch with no parser code (a `:N` suffix is rejected). A timing line
  with no descriptor records the D-24266 `unmarked-ability` `no-handler` breadcrumb. `gain-recruit-current:<N>` exists (D-24350,
  `magnitude` added to `G.turnEconomy.recruit`).
- `rules/villainAbility.types.ts` `VILLAIN_EFFECT_PRIMITIVES` has **64** entries (last `put-self-beside-mastermind`, position 64);
  `rules/villainAbility.types.test.ts` pins it at **eleven** `length 64` assertions (L460, 692, 731, 760, 816, 876, 966, 991, 1033,
  1074, 1102), the canonical ordered list (L392-457), the "appended last" check (L463-467) and the runtime `unionMembers:
  Record<VillainEffectPrimitive, true>` keyset (L880-947); the T2 case at L1101-1104 keeps its `[63]` index (only its length moves).
  `villain/villainEffects.execute.ts` `VILLAIN_EFFECT_HANDLERS: Record<VillainEffectPrimitive, VillainEffectHandler>` (handler
  signature `(G, currentPlayer, cardId, timing, descriptor, shuffleContext?) => VillainEffectApplication`), private
  `villainEffectTimingLabel(timing)`; keyword-less descriptors self-narrate via `pushLog` and, per D-24854 §6, return the logged
  clause as `VillainEffectApplication.narrativeClause` (L1246-1250; without it the Ambush overlay falls back to "its Ambush effect
  resolved (see the log)", L403-411). `villain/ambushNarrative.keywordless.test.ts` (L463, L494-516) pins the set of keyword-less
  Ambush primitives found in all `data/cards/*.json` at **21**; D-24854 §6 requires each new keyword-less Ambush handler to join it.
- **Owed every-player effects (D-24750 FIFO):** `types.ts` `PendingEscapeEffectDiscard { escapedCardId; eligibleCosts;
  traitFilter?; anyHandCard? }`, `PendingEffectDiscardAnyHandCard { effectLabel: 'Ambush' }`; `G.pendingEscapeEffectDiscards`
  (lazy). `villainDeck/villainEscapeProcedure.ts` `openEscapeEffectDiscardIfNeeded(G, events, currentPlayer?)` routes
  `anyHandCard` → `buildVillainEffectAnyCardDiscardChoice`, `traitFilter` → `prepareVillainEffectTraitDiscardChoice`, else
  `buildEscapeEffectCostDiscardChoice`, then `parkSeatChoice`; kinds `VILLAIN_EFFECT_TRAIT_DISCARD_KIND`,
  `VILLAIN_EFFECT_ANY_CARD_DISCARD_KIND` (`'villain-effect-any-card-discard'`), `applyVillainEffectAnyCardDiscard(G, choice)`
  (discards each chosen `option.cardId` via `discardFromHand`). `openEscapeEffectDiscardIfNeeded` is called only from the tail of
  `openEscapeProcedureSeatChoiceIfNeeded` (L329), which `game.ts` `turn.onMove` and the rebuilt loops (`simulation.runner.ts`,
  `par.aggregator.ts`) already call; `villainEscapeProcedure.ts` L32-41 documents its function-body-only import cycles.
- **Seat-choice apply:** `moves/seatChoice.resolve.ts` `applySeatChoiceByKind(G, choice, shuffleContext, currentPlayer?)` — the
  `shuffleContext` is `{ random }` from `resolveSeatChoice` (Monarch's Decree draws there, WP-694 precedent); the timeout path
  (`applySeatChoiceTimeoutDefault`) passes none and is not wired live.
- **Fight picks (D-24817):** `types.ts` `PendingVillainFightPick { primitive: 'look-other-player-deck-top-claim-current' |
  'reveal-villain-deck-defeat-low-vp-current' | 'give-card-to-right-player-current'; playerID; sourceCardId; targetSeat? }`;
  `moves/villainFightPick.logic.ts` `queueVillainFightPick`, `openVillainFightPickSeatChoiceIfNeeded` (called from `onMove` and the
  rebuilt loops), private `buildFirstStepChoice` (its last arm assumes Remaker), `VILLAIN_FIGHT_PICK_KINDS` /
  `isVillainFightPickKind`, `applyVillainFightPickResolvedSeatChoice(G, choice, shuffleContext)`, `chainVillainFightPick`.
  `PendingSeatChoice.villainFightPick?: { sourceCardId; fighterSeat; … }`; `SeatChoiceOption { label; cardId?; sourceZone? … }`.
- **Undercover:** `hero/heroEffects.execute.ts` exports `moveCardUndercover(G, playerID, cardId, fromZone): CardExtId[]` (moves to
  `victory`, appends to `zones.undercover`, returns the new source array; missing card → `fromZone` unchanged) and keeps the
  private `isYourHeroUndercoverCandidate` (not a Wound or Bystander). `types.ts` `PendingUndercoverChoice { playerID; cardId;
  source: 'hand-shield-hero' | 'your-hero'; eligibleTargets; eligibleInPlayTargets?; canDecline? }`; a `'your-hero'` entry always
  carries `eligibleInPlayTargets` (possibly `[]`) and `canDecline: true` (D-24858); `moves/undercover.resolve.ts`
  `resolveUndercoverChoice`, the projection and `UndercoverChoicePrompt.vue` already handle it. `state/zones.types.ts`
  `PlayerZones.undercover: Zone`; scoring adds 1 VP per `zones.undercover` entry (`scoring/scoring.logic.ts`).
- **Grey / cost / traits:** `hero/splitCard.logic.ts` `isGreyHero`, `matchesGreyHeroFilter(G, cardId, 'non-grey')` (a Wound or
  Bystander fails), `offPlayCardTraits`, `offPlayCardStats`; `setup/pilesInit.ts` `WOUND_EXT_ID`, `BYSTANDER_EXT_ID`; D-24583: a
  Wound reads as cost 0 (S.H.I.E.L.D. starters have synthesized cost-0 stats; a Wound has no stats entry).
- **Fight cost:** `economy/economy.resolve.ts` `resolveFightCost(G, villainCardId, fightingPlayerId?)` sums the base and the
  terms (incl. private `villainBloodFrenzyBonus(G, villainCardId, fightingPlayerId)`, 0 when `fightingPlayerId` is undefined or
  `G.villainBloodFrenzy?.[id] !== true`) before the reduction and 0 floor; it is the single authority for the fight move, the
  bot's legal moves and the City `fightCost` projection (the three production callers pass the active player).
  `setup/buildVillainBloodFrenzy.ts` `buildVillainBloodFrenzy(registry, matchConfig)` scans the match's villain cards and keys
  `villainCardInstanceExtIds` (`villainDeck/villainDeck.setup.ts`); `setup/buildInitialGameState.ts` spreads
  `villainBloodFrenzy` onto `G` only when non-empty; `types.ts` `villainBloodFrenzy?: Record<CardExtId, true>`.
  `content/content.schemas.ts` `HERO_CLASSES`.
- Other read exports: `moves/drawCards.logic.ts` `drawCardsIntoHand(zones, count, shuffleProvider)`, `moves/discardFromHand.ts`
  `discardFromHand`, `turn/seatOrder.logic.ts` `seatsInTurnOrderFrom`, `log/logDisplay.ts` `formatCardRef` / `resolveCardName`,
  `log/logPush.ts` `pushLog`, `economy/economy.logic.ts` `recordPlayedCardLeftPlay(economy, cardId)`; D-24732 (a current-player
  villain-effect draw adds to `G.turnEconomy.cardsDrawn`). `hero/playedCardLeftPlay.test.ts` T15 pins every engine function that
  writes `inPlay` (`LOCKED_IN_PLAY_WRITE_TABLE`) and every `recordPlayedCardLeftPlay` caller (`LOCKED_LEFT_PLAY_RECORD_TABLE`).
- `scripts/build-local-spike-bundle.mjs` embeds every set's card data (incl. bkwd) and supports `--check`; the featured setup is
  core-only (`initialStateHash` `495e9cc2`). The `finalStateHash` sentinel fixture (`sentinel-core-doom-2p`) uses no bkwd / rvlt card.

## Context (Read First)

- **Rules v23** (`docs/legendary-universal-rules-v23.md`): **Dark Memories** (~L1267-1297) — "on a Villain it means 'This gets +1
  for each Hero Class among cards in your discard pile'"; grey cards have no class; one per class however many cards; the bonus
  resets when the discard pile is shuffled away. **Undercover** (~L2043-2050): "Put that Hero into your Victory Pile. It's worth 1
  Victory Point." **Unleash from Undercover** (~L2057-2073): "Return that Hero from your Victory Pile to your hand"; the player may
  play it that turn; it leaves Undercover. "Your Heroes" = hand + played this turn (glossary; D-24858).
- **Why one WP, not two.** The co2e villain-fidelity arc split by family (WP-835..840). Here every line belongs to one 8-card
  group, every effect reuses a shipped queue (D-24750 FIFO, D-24817 fight picks, the WP-901 Undercover entry) and one D-entry
  locks them, so one packet keeps the four villains' test file, marker edit and feed regen in one place. The per-primitive size
  matches WP-838 (five primitives) and WP-870 / WP-872 (three each). No client file changes: the generic seat-choice prompt and the
  WP-901 Undercover prompt render the new choices.
- **Dark Memories = the Blood Frenzy pattern (WP-760).** A printed villain keyword that the `[effect:]`-only parser never sees is
  scanned once at setup (`buildVillainDarkMemories`), keyed to each copy's instance id, and read by `resolveFightCost` from the
  FIGHTER's discard pile, so the move, the bot and the City projection agree by construction. The scan matches a **whole-line**
  bare keyword (`/^\s*\[keyword:\s*dark memories\s*\]\s*\.?\s*$/i`) on Villain cards only: The Dark Dimension's "Villains here
  get …" line and the Masterminds' lines are out of scope.
- **Ambush each-player effects ride the D-24750 FIFO** as presence-tested variants (the D-24772 Operator fork F3 precedent), so rule
  order with other owed effects of the same reveal is kept and the existing openers drain them. Black Lotus is the shipped
  any-card variant with a cost filter (`zeroCostOnly: true`) and reuses its kind and apply. Snapdragon and Iron Maiden each get a
  variant, a builder and a kind.
- **Snapdragon's draw follows the discard.** "Then each player draws a card" must run after the discards, so it runs in the
  Snapdragon apply (which receives `{ random }`), for **every** seat, current player first then clockwise (D-24780), the current
  player's draw counted in `cardsDrawn` (D-24732). If no seat holds a non-grey Hero, the opener parks a one-option choice for the
  current player ("No player has a non-grey Hero to discard — each player draws a card") so the draw still has a shuffle source;
  the opener itself has no `random` and must never draw.
- **Fight picks ride D-24817.** Blue Talon and Iron Maiden's Fight handlers queue `PendingVillainFightPick` entries; the shipped
  `onMove` opener builds their seat choices. "You may" defaults to the decline (option 0), matching Remaker.
- **Snapdragon's Fight reuses WP-901.** "You may send one of your Heroes Undercover" is exactly the `'your-hero'` shape: the
  handler parks a `PendingUndercoverChoice` (hand + played Heroes, `canDecline: true`) attributed to the Snapdragon copy, and the
  shipped resolve, projection, prompt and bot default do the rest. This is the second copy of the ~20-line park (duplicate-first,
  00.6 Rule 1).
- **Unleash** moves one Hero out of `zones.undercover` and `zones.victory` into the hand (−1 VP). Only Heroes are offered (a Wound
  sent Undercover by Hulk 2099 is not a Hero). A tracker entry whose card is no longer in the Victory Pile is refused with a log.
- **Hash safety.** `villainDarkMemories` is written only when non-empty, so a match without those five villains serializes
  byte-identically; all queues are the shipped lazy ones. Pre-deploy `initialState` blobs keep their hooks and carry no
  `villainDarkMemories`, and every runtime change is presence-tested or keyed on the new primitives, so stored matches play and
  replay identically (D-24749 §12 / D-24750 §11). Only matches created after the deploy see the change. Stored
  `competitive_scores` rows are unaffected (D-24616 §5).
- **Defaults give away the least.** Every new kind's default is option 0 (timeout, autoplay, sim, PAR, and the D-24744 bot-ally,
  which keeps the default for kinds it does not know). So the two mandatory Ambush builders sort each seat's options by ascending
  printed cost (index 0 = cheapest; the `escape-hq-ko` builder-orders-by-cost precedent), and the "may" picks put the decline at 0.
- **Out-of-scope neighbors (inventoried, follow-ups):** Taskmaster's Thunderbolts — Jester Fight (reveal 4 Villain Deck cards, play
  the Henchmen, reorder the rest), Joystick Ambush and Jack O'Lantern Fight (a chosen Henchman from any Victory Pile enters the
  City), Jack O'Lantern Escape (fewer than two Henchmen → Wound), Bullseye Ambush / Fight / Escape (icon guess, Hero Deck capture,
  +Attack = its cost; chosen player gains it; Escape KOs it) — all hollow today, none covered by an existing WP. Hero-side Dark
  Memories and Unleash (`unsupported` in the hero ledger); The Hood / Epic Hood Masterminds and The Dark Dimension's granted Dark
  Memories; per-kind client headings for the four new seat-choice kinds.
- **Feeds checked at draft:** `docs/ai/coverage/villain-mechanic-ledger.*` lists Black Lotus, Iron Maiden, Snapdragon, Bullseye,
  Jack O'Lantern and Joystick as `(unmarked)` and Blue Talon as `executable` (its one marked Ambush line hides the hollow Fight);
  `docs/ai/coverage/runtime-observed-hollows.json` never sees these villains (the sweep's villain board is the core sentinel);
  `WORK_INDEX.md` names elite-assassins only in WP-768 / WP-770 (Indestructible Man).
- Governing docs: `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, Principle #1 (determinism), §Persistence Boundary, §Layer
  Boundary; `docs/ai/REFERENCE/00.2-data-requirements.md` §1 (villain card fields `vAttack` / `abilities` / `copies`, read verbatim) and §5
  (Ability Text Markup: `[keyword:]` / `[effect:]`); `docs/ai/REFERENCE/00.6-code-style.md`;
  DECISIONS scanned: D-24023, D-24266, D-24350, D-24494, D-24501, D-24583, D-24589, D-24616, D-24732, D-24750, D-24769, D-24770,
  D-24772, D-24780, D-24817, D-24854, D-24858.

## Scope (In)

**A. Villain primitives** (`rules/villainAbility.types.ts`, appended in this order at positions 65-70, no params, keyword-less,
each self-narrates; mirrored in `apply-effect-markers.mjs`):
`discard-zero-cost-card-each-player`, `discard-non-grey-hero-then-draw-each-player`, `undercover-non-grey-hero-each-player`,
`undercover-your-hero-current`, `undercover-hero-from-discard-current`, `unleash-undercover-hero-each-player`.

**B. Handlers** (`villain/villainEffects.execute.ts`, one per primitive, registered in `VILLAIN_EFFECT_HANDLERS`). Each Ambush
handler (1-3) builds its clause once, logs `` `Ambush effect: ${clause}.` `` and returns `{ targets: [], narrativeClause: clause }`
(D-24854 §6):
1. `discard-zero-cost-card-each-player` — push `{ escapedCardId: cardId, eligibleCosts: [], anyHandCard: { effectLabel: 'Ambush',
   zeroCostOnly: true } }` to `G.pendingEscapeEffectDiscards` (lazy); clause `each player must discard a card that costs 0`.
2. `discard-non-grey-hero-then-draw-each-player` — push `{ escapedCardId: cardId, eligibleCosts: [], nonGreyHeroDiscardThenDraw:
   { effectLabel: 'Ambush' } }`; clause `each player must discard a non-grey Hero, then each player draws a card`.
3. `undercover-non-grey-hero-each-player` — push `{ escapedCardId: cardId, eligibleCosts: [], nonGreyHeroUndercover:
   { effectLabel: 'Ambush' } }`; clause `each player must send one of their non-grey Heroes Undercover`.
4. `undercover-your-hero-current` — eligible = current player's hand + `inPlay` cards passing `isYourHeroUndercoverCandidate`;
   none → log `Player N had no Hero to send Undercover for <formatCardRef(cardId)>.` and park nothing; else push a `'your-hero'`
   `PendingUndercoverChoice { playerID, cardId, source: 'your-hero', eligibleTargets, eligibleInPlayTargets, canDecline: true }`.
5. `undercover-hero-from-discard-current` — `queueVillainFightPick(G, { primitive, playerID: currentPlayer, sourceCardId: cardId })`.
6. `unleash-undercover-hero-each-player` — the same queue call with this primitive.

**C. Owed every-player choices** (`villainDeck/villainEscapeProcedure.ts`; routed in `openEscapeEffectDiscardIfNeeded` by
presence, before the existing arms):
1. **Black Lotus** — `buildVillainEffectAnyCardDiscardChoice` filters to cost-0 cards when `anyHandCard.zeroCostOnly === true`
   (cost 0 = `offPlayCardStats(G, id)?.cost === 0`, or `id === WOUND_EXT_ID`; a Bystander never); a seat with none logs
   `Ambush effect: Player N has no card that costs 0 to discard.`; kind and apply unchanged.
2. **Snapdragon** — `buildNonGreyHeroDiscardThenDrawChoice(G, entry, currentPlayer)`: every seat (ascending) with a non-grey
   Hero in hand (`matchesGreyHeroFilter(..., 'non-grey')`) is addressed, one option per such card, label `Discard <name>`, ordered
   by ascending `offPlayCardStats(...).cost` with ties in hand order (index 0 = cheapest, the default); a seat with
   none logs `Ambush effect: Player N has no non-grey Hero to discard.`; when none is addressed, a one-seat choice for
   `currentPlayer` (else the lowest seat) with the single option `No player has a non-grey Hero to discard — each player draws a
   card`. Kind `VILLAIN_EFFECT_NON_GREY_DISCARD_THEN_DRAW_KIND = 'villain-effect-non-grey-discard-then-draw'`, default 0.
   `applyVillainEffectNonGreyDiscardThenDraw(G, choice, shuffleContext, currentPlayer?)`: discard each submitted `cardId`
   (ascending) via `discardFromHand`, then, with a shuffle context, every seat in `seatsInTurnOrderFrom(seats, currentPlayer)` draws
   1 via `drawCardsIntoHand`; without one, log `blocked` and draw nothing. When `G.turnEconomy.drawsLocked === true` the current
   player's draw is skipped with a `blocked` log (D-24552; the D-24602 Throw from the Waterfall precedent, `tacticHandlers.ts`
   L3133); other seats always draw. The current player's `cardsDrawn += hand.length − handBefore` (the cards actually drawn —
   `drawCardsIntoHand` returns the reshuffle count, never use it).
3. **Iron Maiden Ambush** — `buildNonGreyHeroUndercoverChoice(G)`: every seat (ascending) with a non-grey Hero in hand or `inPlay`
   is addressed, one option per card (`cardId`, `sourceZone`, label `Send <name> Undercover (from your hand)` /
   `Send <name> Undercover (played this turn)`), ordered by ascending `offPlayCardStats(...).cost` with ties hand before play, then
   zone order (index 0 = cheapest, the default); `matchesGreyHeroFilter` is applied to in-play cards too (its
   off-play view only widens a split card's classes, so non-grey is unaffected — a `// why:` says so); a seat with none
   logs `Ambush effect: Player N has no non-grey Hero to send Undercover.`; no decline; kind
   `VILLAIN_EFFECT_UNDERCOVER_EACH_PLAYER_KIND = 'villain-effect-undercover-each-player'`, default 0.
   `applyVillainEffectUndercoverEachPlayer(G, choice)`: for each submission (ascending) `moveCardUndercover` from the option's
   zone and log `Player N sent <formatCardRef> Undercover (into the Victory Pile, +1 VP).`; a card no longer in that zone is skipped
   with a `blocked` log. An `inPlay` send is a mid-turn exit from play, so this function also calls
   `G.turnEconomy = recordPlayedCardLeftPlay(G.turnEconomy, cardId)` for it (WP-899 / D-24856, the `resolveUndercoverChoice`
   precedent), and `hero/playedCardLeftPlay.test.ts` gains this function's row in `LOCKED_IN_PLAY_WRITE_TABLE` (disposition
   comment: an in-play Undercover send, recorded) and in `LOCKED_LEFT_PLAY_RECORD_TABLE` — the counts the T15 scanner reports.
4. `moves/seatChoice.resolve.ts` `applySeatChoiceByKind` gains the two arms (before the generic fall-through; Snapdragon's passes
   `shuffleContext` and `currentPlayer`).

**D. Fight picks** (`moves/villainFightPick.logic.ts`; `PendingVillainFightPick.primitive` widened with the two primitives):
1. **Blue Talon** — `buildFirstStepChoice` arm: the fighter's discard-pile cards passing `isYourHeroUndercoverCandidate`, one
   option per **distinct id** in first-seen pile order (the `appendRemakerZoneOptions` dedupe, so eight S.H.I.E.L.D. Agents are one
   option); none → log `Player N has no Hero in their discard pile to send Undercover (<formatCardRef(sourceCardId)>).`; else
   one-seat kind `VILLAIN_FIGHT_UNDERCOVER_FROM_DISCARD_KIND = 'villain-fight-undercover-from-discard'`, option 0 `Don't send a Hero
   Undercover`, then `Send <name> Undercover` (`cardId`, `sourceZone: 'discard'`). Apply: option 0 logs the decline; else
   `moveCardUndercover` from `discard` (first occurrence) with the Iron Maiden log line (stale → `blocked` log).
2. **Iron Maiden Fight** — arm: every seat (ascending) whose `zones.undercover` holds a Hero (`isYourHeroUndercoverCandidate`) still
   in `zones.victory`; none → log `No player has a Hero Undercover to Unleash.`; else a multi-seat kind
   `VILLAIN_FIGHT_UNLEASH_KIND = 'villain-fight-unleash'`, per seat option 0 `Don't Unleash`, then `Unleash <name>` per distinct
   eligible id (`cardId`) in first-seen `zones.undercover` order. Apply: loops **every** addressed seat itself, ascending (the shared `readChosenOption` reads only
   `addressedSeats[0]`), `returnUndercoverHeroToHand(G, seat, cardId)`; log `Player N Unleashed <formatCardRef> from Undercover
   (back to their hand).` or `Player N chose not to Unleash a Hero.`
3. Both kinds' choices carry `villainFightPick: { sourceCardId, fighterSeat }` (`applyVillainFightPickResolvedSeatChoice` returns
   early without it, L566-570), join `VILLAIN_FIGHT_PICK_KINDS`, and get apply arms there; `chainVillainFightPick` does nothing for
   them; `buildFirstStepChoice`'s Remaker fall-through stays last.

**E. Undercover helpers** (`hero/heroEffects.execute.ts`, beside `moveCardUndercover`): exported
`returnUndercoverHeroToHand(G, playerID, cardId): boolean` — first checks `cardId` is in both `zones.undercover` and
`zones.victory` (else returns false, no write); then moves it with `moveCardFromZone(zones.victory, zones.hand, cardId)`
(`zoneOps.ts`, the zone-mutation rule) and rebuilds `zones.undercover` as a new array without its first matching entry (no
`splice`); returns true. The private
`isYourHeroUndercoverCandidate(cardId)` becomes an export (body unchanged) so the three new call sites share it instead of copying
it (00.6 Rule 1, third copy). `villainEscapeProcedure.ts`, `villainFightPick.logic.ts` and `villain/villainEffects.execute.ts`
(handler 4) importing `heroEffects.execute.ts` close new cycles through `moves/seatChoice.resolve.ts`; each is safe because the bindings are read only inside function bodies, and each
importing file says so in a `// why:` (the `villainEscapeProcedure.ts` L32-41 precedent).

**F. Villain Dark Memories:** new `setup/buildVillainDarkMemories.ts` (`buildVillainDarkMemories(registry: unknown, matchConfig):
Record<CardExtId, true>`, the `buildVillainBloodFrenzy` shape, whole-line pattern above, Villain cards of the match's villain
groups only); `types.ts` `villainDarkMemories?: Record<CardExtId, true>`; `buildInitialGameState.ts` calls it with
`villainBuildConfig` (L421-424, as `buildVillainBloodFrenzy` at L521) and spreads it only when non-empty;
`economy.resolve.ts` adds `villainDarkMemoriesBonus(G, villainCardId, fightingPlayerId)` to `costBeforeReduction` = 0 without a
fighter or flag, else the number of distinct `HERO_CLASSES` among the fighter's discard-pile cards (`offPlayCardTraits`, both
`heroClass` and `heroClass2`; grey / Wound / Bystander add none).

**G. Data:** `villain-effect-markers.json` `bkwd.elite-assassins` (locked in the EC); regen `bkwd.json`; provenance rows for the
six primitives (WP-902 / D-24859); regen the derived feeds.

**H. Tests** (`node:test`, hooks parsed from committed `data/cards/bkwd.json` / `rvlt.json` where a parse is asserted): new
`villain/eliteAssassins.test.ts` (incl. the seven parse assertions and the Ambush narrative = logged clause, the
`assertNarrativeEqualsLog` shape) and `setup/buildVillainDarkMemories.test.ts`. `rules/villainAbility.types.test.ts`: the eleven
`length` pins 64 → 70, six entries appended to the ordered list, "appended last" → `unleash-undercover-hero-each-player` (position
70), six keys added to `unionMembers`, and the T2 case title at L1101 drops "appended last" (its `[63]` index stays). `villain/ambushNarrative.keywordless.test.ts`: the RS-5 set 21 → 24 with
`discard-non-grey-hero-then-draw-each-player`, `discard-zero-cost-card-each-player`, `undercover-non-grey-hero-each-player`
sorted into the list and a sanctioned-pin-change `// why:` (the WP-839 / WP-840 precedent at L458-462). `hero/playedCardLeftPlay.test.ts`
per §C.3.

## Out of Scope

- Taskmaster's Thunderbolts (Jester Fight, Joystick Ambush, Jack O'Lantern Fight + Escape, Bullseye Ambush / Fight / Escape) — a
  follow-up WP. Hero-side Dark Memories / Unleash; The Hood / Epic Hood (Double) Dark Memories; The Dark Dimension's granted Dark
  Memories; Cancer / Chemistro / Madam Masque's other lines.
- Any arena-client source change (the regenerated `featuredSetupBundle.json` data fixture is the one arena-client file touched),
  server, registry, persistence or `index.ts` export change; new moves, phases, stages or `G` keys beyond
  `villainDarkMemories`; per-kind prompt headings (the generic heading renders).
- Changing any shipped kind's behavior: Speed Demon's any-card discard, Mystique / Frost Giant trait discards, Primus's cost
  discard, the WP-872 pick kinds and the WP-901 / WP-678 Undercover shapes stay byte-identical.

## Files Expected to Change

- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — six primitives (positions 65-70) + why-comment.
- `packages/game-engine/src/setup/villainAbility.setup.ts` — **modified** — `parseUngatedEffect` JSDoc no-param list only.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — six handlers + registry entries.
- `packages/game-engine/src/types.ts` — **modified** — `PendingEffectDiscardAnyHandCard.zeroCostOnly?`,
  `PendingEscapeEffectDiscard.nonGreyHeroDiscardThenDraw?` / `.nonGreyHeroUndercover?`, the widened
  `PendingVillainFightPick.primitive`, `villainDarkMemories?` (contract; D-24859).
- `packages/game-engine/src/villainDeck/villainEscapeProcedure.ts` — **modified** — routing, two builders, two kinds, two applies,
  the zero-cost filter.
- `packages/game-engine/src/moves/seatChoice.resolve.ts` — **modified** — two dispatch arms.
- `packages/game-engine/src/moves/villainFightPick.logic.ts` — **modified** — two kinds, two first-step arms, two applies.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `returnUndercoverHeroToHand` export;
  `isYourHeroUndercoverCandidate` exported (body unchanged).
- `packages/game-engine/src/economy/economy.resolve.ts` — **modified** — the Dark Memories term.
- `packages/game-engine/src/setup/buildVillainDarkMemories.ts` — **new**.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — build + omit-when-empty spread.
- Tests: `packages/game-engine/src/villain/eliteAssassins.test.ts` (**new**), `packages/game-engine/src/setup/buildVillainDarkMemories.test.ts`
  (**new**), `packages/game-engine/src/rules/villainAbility.types.test.ts` (pins 64 → 70),
  `packages/game-engine/src/villain/ambushNarrative.keywordless.test.ts` (RS-5 keyword-less Ambush set 21 → 24),
  `packages/game-engine/src/hero/playedCardLeftPlay.test.ts` (one row in each WP-899 drift table, for the Iron Maiden in-play send).
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified**.
- `data/cards/bkwd.json` — **modified (generated)**.
- Generated / provenance: `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `scripts/coverage/mechanic-provenance.json`, `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json` (data only;
  `initialStateHash` unchanged), `docs/ai/coverage/live-verify.json`; `data/metadata/card-mechanics.json`,
  `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json` **only if** their
  regen moves them; dashboard data copies are gitignored, not committed.
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24859), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`,
  `docs/ai/post-mortems/01.6-WP-902-elite-assassins-villain-abilities.md` (01.6: new setup builder + `G` field).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets; ESM only; Node v22+; human-style code per
  `docs/ai/REFERENCE/00.6-code-style.md` (full words, JSDoc on every function, ~30-line functions, `for` loops, no `.reduce()`,
  no nested ternaries).
- Determinism: no `Math.random`, clocks or I/O; every draw goes through `drawCardsIntoHand` with the move's `{ random }`; moves and
  applies never throw; ascending seat order for simultaneous applies, current-player-first for the draws.
- `G` stays JSON; the only new `G` key is `villainDarkMemories`, written only when non-empty. `finalStateHash` sentinels and the
  local spike bundle's `initialStateHash` (`495e9cc2`) are byte-unchanged — a moved hash is a STOP.
- Shipped shapes byte-identical: an `anyHandCard` entry without `zeroCostOnly` builds exactly today's choice; WP-817 / 837 / 839 /
  872 / 678 / 901 tests pass unedited.
- Card data only through the marker source + reproducible regen; never hand-edit `bkwd.json`. No per-card special-casing in the
  parser; handlers read descriptors, not card names.
- Layer Boundary: engine only (plus the card-data pipeline); no registry import in the engine (the builder takes `registry:
  unknown` behind a structural guard, as Blood Frenzy does).

**Session protocol:** STOP and report if a marked line still records an `unmarked-ability` breadcrumb, a sentinel or the spike
bundle hash moves, a shipped kind's test needs any edit (the three pin files in §H are the only sanctioned test edits), or the
Snapdragon draw would need `random` outside a seat-choice apply.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- Primitives (append order, positions 65-70): `discard-zero-cost-card-each-player`, `discard-non-grey-hero-then-draw-each-player`,
  `undercover-non-grey-hero-each-player`, `undercover-your-hero-current`, `undercover-hero-from-discard-current`,
  `unleash-undercover-hero-each-player`; markers `[effect:<primitive>]` (no params) plus Black Lotus's `[effect:gain-recruit-current:3]`.
- `PendingEffectDiscardAnyHandCard { effectLabel: 'Ambush'; zeroCostOnly?: true }` (written only as `true`).
- `PendingEscapeEffectDiscard` + `nonGreyHeroDiscardThenDraw?: { effectLabel: 'Ambush' }`, `nonGreyHeroUndercover?:
  { effectLabel: 'Ambush' }` (presence-tested; at most one variant field per entry).
- `PendingVillainFightPick.primitive` + `'undercover-hero-from-discard-current' | 'unleash-undercover-hero-each-player'`.
- Seat-choice kinds `'villain-effect-non-grey-discard-then-draw'`, `'villain-effect-undercover-each-player'`,
  `'villain-fight-undercover-from-discard'`, `'villain-fight-unleash'`.
- `returnUndercoverHeroToHand(G, playerID, cardId): boolean` and `isYourHeroUndercoverCandidate(cardId): boolean` (both exported
  from `hero/heroEffects.execute.ts`; the latter's body unchanged).
- The three Ambush handlers return `narrativeClause` = their logged clause (D-24854 §6); both fight-pick kinds carry
  `villainFightPick: { sourceCardId, fighterSeat }`.
- `buildVillainDarkMemories(registry: unknown, matchConfig: MatchSetupConfig): Record<CardExtId, true>`;
  `LegendaryGameState.villainDarkMemories?: Record<CardExtId, true>`; `resolveFightCost` term = distinct Hero Classes in the
  fighter's discard pile for a flagged copy.
- No `UIState` field: the City `fightCost` already reads `resolveFightCost`; the seat choices and the `'your-hero'` entry use the
  shipped projections.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22.
- **No conflict:** seven printed lines and a printed keyword that do nothing today resolve as printed, including the printed
  "may" / "must" and the "Then".
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — every change is printed card text.
- **Determinism preservation:** draws use `ctx.random` through the seat-choice apply; defaults are fixed indexes; one
  omit-when-empty `G` key; sentinels byte-identical. Seed-PAR is scheme-keyed. Pre-deploy `initialState` blobs keep their hooks and
  carry no `villainDarkMemories`, so stored matches play and replay identically (D-24749 §12 / D-24750 §11); only matches created
  after the deploy see the change; stored `competitive_scores` rows are unaffected (D-24616 §5).

## Funding Surface Gate

N/A — no funding, nav or account surface.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. Each of the seven lines parses to exactly its locked descriptor (Black Lotus Fight `{ primitive: 'gain-recruit-current',
   magnitude: 3 }`); no hook on the four cards carries an unresolved marker, and firing them records no `unmarked-ability`
   breadcrumb. Blue Talon's Ambush parse is unchanged.
1a. The three Ambush handlers' overlay narrative equals their logged clause (no "see the log" fallback); the keyword-less Ambush
   set is 24.
2. Black Lotus Fight adds exactly 3 Recruit. Black Lotus Ambush addresses only seats holding a cost-0 card (a Wound counts, a
   Bystander does not) and each discards its pick.
3. Snapdragon Ambush: holders of a non-grey Hero each discard one (options `Discard <name>`, cheapest first); afterwards every seat
   (holders or not) draws 1, current player first; the current player's `cardsDrawn` rises by the cards actually drawn (1, or 0
   when deck and discard are empty or `drawsLocked` is set — then only the current player's draw is skipped); with no holder, the
   one-option choice draws everyone a card.
4. Iron Maiden Ambush: every seat with a non-grey Hero in hand or play sends exactly one Undercover (no decline option; options
   cheapest first, so the default sends the cheapest); it sits in
   `victory` and `undercover` (+1 VP); seats with none are logged; an in-play send is recorded in the played-this-turn view
   (`leftPlayPlayedCardIds`) and the WP-899 drift tables carry the new function.
5. Iron Maiden Fight: every seat with an Undercover Hero gets "Don't Unleash" + one option per distinct Hero id (no Wound); every
   addressed seat's pick applies; Unleash moves the card to hand and out of `victory` and `undercover`; a decline changes nothing.
6. Blue Talon Fight: the fighter gets "Don't send" + one option per distinct discard-pile Hero id; a send moves one copy to
   `victory` + `undercover`; none → a log, no choice.
7. Snapdragon Fight parks one `'your-hero'` entry (`canDecline: true`, hand + played Heroes, attributed to the Snapdragon copy)
   that the shipped resolve sends or declines.
8. Dark Memories: a flagged copy's `resolveFightCost` = base + distinct classes in the fighter's discard pile (0 with an empty pile
   or without a fighter; a dual-class or split card counts both; grey / Wound none; duplicates once); the five bare-line villains
   are flagged, The Dark Dimension and every other villain are not; a match without them has no `villainDarkMemories` key.
9. Shipped kinds unchanged (their tests pass unedited); `cards:check` reproduces `bkwd.json`; the villain ledger lists the six new
   primitives as executable with WP-902 / D-24859 (Black Lotus's `gain-recruit-current` keeps WP-541 / D-24350); every feed
   `:check` exits 0.
10. `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail; sentinels and the spike-bundle hash unchanged with no hash pin (sentinel /
   `initialStateHash`) edited.

## Verification Steps

- Add the six provenance rows and the seven pending `live-verify.json` rows first, keyed `bkwd-villain-elite-assassins-<slug>|<primitive>`:
  `blue-talon|undercover-hero-from-discard-current`, `iron-maiden|undercover-non-grey-hero-each-player`,
  `iron-maiden|unleash-undercover-hero-each-player`, `snapdragon|discard-non-grey-hero-then-draw-each-player`,
  `snapdragon|undercover-your-hero-current`, `black-lotus|discard-zero-cost-card-each-player`, `black-lotus|gain-recruit-current`.
  Dark Memories has no ledger key; its evidence is recorded inside the Blue Talon and Iron Maiden rows.
- `node scripts/convert-cards/apply-effect-markers.mjs` — exits 0; only `bkwd.json` changes; a second run is zero-diff.
- `pnpm -r build` — exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:villains`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`,
  `node scripts/build-local-spike-bundle.mjs` (then `--check` 0; `initialStateHash` stays `495e9cc2`) — each exits 0.
- `pnpm -r --no-bail test` — 0 fail; record per-package totals (engine baseline 7450 / 0, 1683 suites; record the exact delta).
- `pnpm cards:check`, `pnpm ledger:villains:check`, `pnpm ledger:heroes:check`, `pnpm effect-index:check`,
  `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check` — each 0.
- At close: `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:liveverify:check`,
  `pnpm workindex:executed:check`, `node scripts/check-number-ledger.mjs --check` — each 0.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail.
- [ ] Feeds regenerated, every `:check` green; provenance + pending live-verify rows present.
- [ ] `finalStateHash` sentinels and the spike-bundle `initialStateHash` byte-unchanged.
- [ ] **Live-on-surface (D-24026):** an operator match **created after the deploy** with Indestructible Man (Always Leads Elite
      Assassins): Blue Talon / Iron Maiden's City Attack moves with the discard pile; Black Lotus's Fight adds 3 Recruit; each
      Ambush and Fight above opens its prompt and resolves as printed; no `unmarked-ability` breadcrumb for the seven lines —
      confirmed in its own `SPEC:` PR, or operator-pending in `STATUS.md` with the pending rows.
- [ ] `STATUS.md`; D-24859 → Active; `WORK_INDEX.md` `[x]` + `[live-verify: pending]`; `EC_INDEX.md` Done; mindmap ✅ +
      `roadmap:counts:write`; NUMBER-LEDGER LANDED; 01.6 post-mortem.
- [ ] No files outside `## Files Expected to Change` modified — `git diff --name-only origin/main...HEAD` checked.

## Reserved Decision (lands at execution)

D-24859 — the Elite Assassins' printed lines. (1) Villain **Dark Memories** is a setup-scanned printed keyword (the D-24589 Blood
Frenzy pattern): a whole-line bare `[keyword:Dark Memories]` on a Villain card flags each copy in `G.villainDarkMemories`
(omit-when-empty), and `resolveFightCost` adds the number of distinct Hero Classes among the FIGHTER's discard-pile cards (0 without
a fighter). Granted Dark Memories (The Dark Dimension) and Masterminds are not covered. (2) Six no-param, keyword-less villain
primitives (positions 65-70). (3) Ambush each-player effects ride the D-24750 FIFO as presence-tested variants: Black Lotus =
the any-card discard with `zeroCostOnly` (cost 0 includes a Wound, D-24583); Snapdragon = a non-grey discard whose apply then draws
every seat a card, current player first, with a one-option fallback choice when nobody can discard, so every draw has a shuffle
source; Iron Maiden = a mandatory non-grey Undercover send from hand or play. (4) Fight "may" picks ride the D-24817 queue and
default to the decline: Blue Talon (from the discard pile) and Iron Maiden (each player may Unleash). Unleash returns a Hero from
`zones.undercover` + `victory` to hand; Wounds are never offered. (5) Snapdragon's Fight parks the D-24858 `'your-hero'` Undercover
entry. (6) Black Lotus's Fight is the existing `gain-recruit-current:3`. (7) Defaults: the D-24744 bot-ally keeps the option-0
default for all four new kinds; the two mandatory Ambush choices order options cheapest first, Unleash and Blue Talon default to
the decline. Snapdragon's draw respects the D-24552 draw lock for the current player and counts the cards actually drawn.

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1 (independent subagent, 2026-11-19):** NOT READY — three text defects, scope-neutral. PS-1:
  `villain/ambushNarrative.keywordless.test.ts` pins the keyword-less Ambush set at 21 and D-24854 §6 requires new handlers to join
  it — the file was off the allowlist (added; 21 → 24). PS-2: the three Ambush handlers lacked the D-24854 §6 `narrativeClause`
  return (locked, with AC 1a). PS-3: the primitive-count pins are eleven, plus the ordered list, "appended last" and the
  `unionMembers` keyset (corrected). RS-1..RS-10 folded: fight-pick payload + the Unleash apply loops every seat; per-distinct-id
  options; zone-suffixed Iron Maiden labels; `isYourHeroUndercoverCandidate` exported instead of copied; import-cycle `// why:`s;
  AC 9 provenance; opener call-site wording; `villainBuildConfig`; the in-play grey-filter `// why:`; parse tests moved out of the
  sweep file. RS-11 (03.1 setup-flag list) is precedent, no action. Verified at HEAD: baseline engine 7450 / 0 / 1683 suites, every
  hard-dep `[x]`, numbers reserved, every cited symbol, the card text and rules quotes, the Snapdragon apply's live `{ random }`,
  the sim / PAR / replay loops resolving through `resolveSeatChoice`, core-only sentinel / spike / PAR fixtures.
- **Pre-flight round 2:** **READY TO EXECUTE** — every fix landed, WP and EC consistent, EC within 100 content lines. Two wording
  nits folded: `villainEffects.execute.ts` named as the third new importer; AC 10 reads "no hash pin edited".
- **Copilot round 1 (independent subagent):** RISK → HOLD, seven scope-neutral fixes, all folded: (#28/#8) the replay claim was
  backwards — pre-deploy `initialState` blobs keep their hooks and carry no `villainDarkMemories`, so stored matches replay
  identically (D-24749 §12 / D-24750 §11); (#26) Snapdragon's current-player draw respects the D-24552 draw lock and counts the
  hand-length delta, not `drawCardsIntoHand`'s reshuffle-count return; (#26/#9) Snapdragon options read `Discard <name>`; (#26) the
  two mandatory Ambush builders order options cheapest first so the option-0 default (timeout, sim, PAR, D-24744 bot-ally) never
  throws away the best Hero — D-24859 point 7; (#17/#3) `returnUndercoverHeroToHand` checks both zones first and moves through
  `moveCardFromZone`, rebuilding `undercover` without `splice`; (#23) Unleash / Snapdragon option order locked; (#30/#12)
  `workindex:liveverify:check` / `workindex:executed:check` added and the seven pending live-verify keys named. Verified: card text
  and rules, the opener / apply seams with live `{ random }`, mixed multi-seat rides, onBegin + end-of-game drops of every queue
  used, sim / PAR openers, the pins. Pre-flight READY stands (no allowlist change).
- **Copilot round 2:** **PASS → CONFIRM** — all seven fixes verified in the WP and EC and mutually consistent; no new defect; EC
  95 content lines. Pre-flight READY TO EXECUTE stands.
- **Noticed outside the audit (not WP-902 defects, follow-ups):** a printed "N+" villain Attack is parsed as dynamic (base N plus
  the costs of captured Heroes, `economy/economy.logic.ts` ~L374-378), which misreads every "N+" whose "+" means something else
  (here Dark Memories; the Elite Assassins capture no Heroes, so WP-902 is unaffected); `wiki/card-effect-system.md` ~L181 lists
  the keyword-less primitives by hand, ungated.

## Lint Gate Self-Review (00.3)

Run as an independent subagent 2026-11-19, after pre-flight READY and copilot CONFIRM. Verdict **PASS**, no Final Gate row
tripped. Four text cleanups folded (scope-, contract- and allowlist-neutral, so no 01.4 / 01.7 re-run): the EC After Completing
names the full regen chain, not only the checks (EC-TEMPLATE effect-index rule); Out of Scope names `featuredSetupBundle.json` as
the one arena-client file touched; the 00.2 citation is §1 (villain card fields) + §5 (markup); §H notes the T2 test title. The
optional `zeroCostOnly` → `isZeroCostOnly` rename was declined: `koHeroesOnly?: true` is the unprefixed precedent and 00.3 §16.3's
FAIL condition is not met.

- **§1 structure:** every template section present and non-empty; Out of Scope names Taskmaster's Thunderbolts, hero-side Dark
  Memories / Unleash, The Hood / Epic Hood, The Dark Dimension, the other Hood's Gang lines, client / server / registry /
  `index.ts` changes, per-kind headings and shipped-kind behavior. **PASS.**
- **§2 constraints:** full-file output, no diffs / snippets, ESM, Node v22+, `00.6-code-style.md` cited; determinism, one
  omit-when-empty `G` key, sentinel / spike-hash no-re-pin, shipped shapes byte-identical, marker-only regen, Layer Boundary
  (`registry: unknown`); four STOP triggers; locked values in the EC. **PASS.**
- **§3 Assumes:** baseline `11d21e201`, engine 7450 / 0 / 1683; observed card text; marker pipeline (64-entry script array);
  parser path; primitive pins with line numbers; the D-24750 FIFO, D-24817 fight-pick and WP-901 Undercover seams with signatures;
  grey / cost / trait helpers; the fight-cost + Blood Frenzy builder seam; T15 tables; spike bundle and sentinel; hard-deps WP-760 /
  817 / 837 / 839 / 872 / 684 / 678 / 901 / 836 / 899 all ✅. **PASS.**
- **§4 Context:** rules v23 Dark Memories / Undercover / Unleash with line ranges; one-WP rationale; Blood Frenzy pattern; queue
  reuse; draw ordering; hash safety; cheapest-first defaults; out-of-scope inventory and feeds; ARCHITECTURE §Rule Execution
  Pipeline / Principle #1 / §Persistence Boundary / §Layer Boundary; 00.2 §1 / §5; 00.6; DECISIONS scan list. **PASS.**
- **§5 files:** every file listed with new / modified and its role (~30, most generated or governance); single-WP size justified;
  conditional regen files named. **PASS.**
- **§6 naming:** full-word builders / applies / kinds; kebab kind strings, SCREAMING constants; data slugs and the ledger key format
  match existing rows; no 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; engine + card-data pipeline only, no registry import, no server / DB / client
  code; draws only via the move's `{ random }`; function-body-only import cycles each carry a `// why:`. **PASS.**
- **§9 Windows:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var, no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`; hooks parsed from committed card JSON; no network / DB / `boardgame.io` import; runtime
  pins (D-24372); only the three pin files are sanctioned edits. **PASS.**
- **§13 verification:** exact commands with expected exits; provenance + live-verify rows before the ledger; zero-diff marker
  re-run; spike `--check` (`495e9cc2`); engine delta recorded; close-time roadmap / workindex / number-ledger checks. **PASS.**
- **§14 / §15:** 11 binary criteria aligned with Scope A–H; DoD names STATUS / D-24859 / WORK_INDEX / EC_INDEX / mindmap / ledger /
  01.6 and the scope diff; §15.1 live-on-surface on a post-deploy match with operator-pending fallback; §15.2 Risk Tier MEDIUM,
  byte-identical in WP and EC. **PASS.**
- **§16 code style:** named builders / applies; `for` loops, no `.reduce()`, no nested ternaries, no `splice`; zone moves via
  `moveCardFromZone`; `isYourHeroUndercoverCandidate` exported at its third use; `// why:` sites listed in the EC. **PASS.**
- **§17 Vision:** §1 / §2 / §8 / §10 / §22, no-conflict, NG-1 and determinism / replay lines. **PASS.**
- **§18:** no literal-grep step. **N/A.** **§19:** baseline SHA only. **N/A.** **§20 funding:** N/A, stated. **§21 API catalog:**
  N/A, stated. **PASS.** Contract files: `types.ts` and `rules/villainAbility.types.ts` gain optional fields / appended
  primitives covered by D-24859, with the union and array moving together under the runtime `unionMembers` pin.
