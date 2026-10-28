# WP-850 — Discard-top printed Attack + KO any of those cards (Cross-layer — Game Engine + Arena Client)

**Status:** Draft 2026-10-28 (EC-888; D-24786 reserved)
**Layer:** Game Engine (parse + runtime + pending-choice filter + UIState) + Arena Client (prompt heading) + card data
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** WP-693 / D-24510 (`PendingKoDiscardChoice` + `resolveKoDiscardChoice`, block-all guards, prompt, bot default) ✅, WP-836 / D-24769 (the omit-when-absent `greyFilter` on that choice — the filter precedent) ✅, D-24285 (empty-deck reshuffle mid-effect) ✅, D-24604 (`offPlayCardStats` printed Attack, Divided-card sum) ✅, D-24670 (`SELF_COMPUTED_ATTACK_KEYWORDS` icon suppression) ✅, D-24521 §6 / D-24558 (sibling abilities run in order; a later clause acts on an earlier clause's result) ✅

## Goal

Make Bishop's **Firepower from the Future** (`dkcy/bishop/firepower-from-the-future`) do what it
prints. Playing it discards the top four cards of the player's deck and grants +Attack equal to
the total printed Attack of those four cards; when another X-Men Hero was played this turn, the
player then chooses any number of those discarded cards to KO. Today both lines are hollow: the
card grants only its base 4 and the log shows two `Unhandled effect observed … (parse-unrecognized)`
lines (`attack-no-magnitude`, `gate-only`) on every play.

## User-Visible Impact

`play.legendary-arena.com` — playing Firepower from the Future logs the four discarded cards and
the Attack they granted, and the turn's Attack rises by that amount on top of the base 4. With an
X-Men Hero already played this turn, a KO prompt lists only the cards this play discarded
("KO any number of the N cards you just discarded"); zero is a valid pick. The two hollow
`Unhandled effect observed` lines stop. Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` = `452956c5` (after the WP-850 reserve #3074 and the sibling WP-851 reserve
  #3075). Drift pins at that HEAD: `HERO_KEYWORDS` = **85** (`rules/heroKeywords.test.ts`,
  `rules/heroAbility.setup.test.ts` list + count, `setup/heroAbility.setup.test.ts`),
  `HERO_EFFECT_HANDLERS` = **67** (two asserts in `hero/heroEffects.execute.test.ts`). The EC says
  read HEAD: WP-851 (optional-KO hand/discard sweep) may land first and move them.
- The engine `tsconfig.json` sets `exactOptionalPropertyTypes: true`; turn-scoped optional G fields
  are cleared with `delete` (`game.ts` turn reset), never by assigning `undefined`.
- `packages/game-engine/src/types.ts` carries `PendingKoDiscardChoice { choiceType: 'ko-from-discard',
  playerID, maxCount, sourceCardId?, greyFilter? }` and `G.pendingKoDiscardChoices?` (WP-693, WP-760,
  WP-836). The block-all guard `hasPendingKoDiscardChoice` is already replicated at every action
  move (`game.ts`, `coreMoves.impl.ts`, `dodgeCard`, `exorciseHauntedHero`, `fightMastermind`,
  `fightVillain`, `healWounds`, `phaseCard`, `recruitHero`, `recruitOfficer`, `recruitSidekick`,
  `villainDeck.reveal.ts`) and in the bot short-circuit; `mastermindVictory.logic.ts` drops the queue
  on a vanquish; `resolveKoDiscardChoice` is already in `SIMULATION_MOVE_NAMES` and both `MOVE_MAP`s.
  **This WP adds no new queue, move, guard site, or sim dispatch.**
- `packages/game-engine/src/moves/koDiscardChoice.resolve.ts` exports `getEligibleKoDiscardCards`
  (today called only by the UIState build) and `resolveKoDiscardChoice` (checks `greyFilter` inline,
  then an in-discard presence check on a working copy, `koCard` to `G.ko`, front-pop on success).
- `packages/game-engine/src/simulation/ai.legalMoves.ts` `selectDefaultKoDiscardCardIds` filters
  inline (D-24769) — Wounds first, then S.H.I.E.L.D. starters, capped by `maxCount`. This WP switches
  it to call `getEligibleKoDiscardCards` so the bot and the projection share one filter.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `heroEffectStealAbilities` (WP-592) is
  the deck-top discard model (`reshuffleDiscardIntoDeck` on an empty deck, `moveCardFromZone`
  deck → discard, D-24017 log when nothing is left); `heroEffectRevealTopDisposeKo` (D-24558) is
  the "later sibling clause acts on the earlier clause's result" model; `HANDLED_KEYWORDS`,
  `NO_MAGNITUDE_KEYWORDS`, `HERO_EFFECT_HANDLERS` are the registration sets.
- `packages/game-engine/src/hero/splitCard.logic.ts` `offPlayCardStats(G, cardId)` returns a card's
  printed stats outside play (drops the trailing `+`, sums Divided halves — D-24604);
  `economy/abomination.logic.ts` `printedHeroAttack` is the existing reader.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — the generic `KEYWORD_PATTERN`
  (`[keyword:name(:N)?]`) records a keyword and its magnitude with no dedicated step;
  `SELF_COMPUTED_ATTACK_KEYWORDS` drops the co-located `[icon:attack]` so it is not mis-read as a
  magnitude-less flat attack; a leading `[team:x-men]:` on its own `abilities[]` entry becomes that
  entry's `requiresTeam` condition (self-excluding).
- `data/cards/dkcy.json` is GENERATED. Markers are authored in
  `scripts/convert-cards/inputs/hero-ability-markers.json` and applied by
  `apply-hero-ability-markers.mjs`, whose `VALID_TOKEN_PATTERN` must list every new token.
- `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.vue` renders the choice
  (index-keyed selection, D-24783 heading variants).

## Context (Read First)

- Evidence: operator match `Ps0Hg_m5B-H` (2026-10-28, Red Skull / Midtown Bank Robbery, 2p), log
  `C:\pcloud\matches\Core\RedSkull\red-skull-midtown-LOG-2p-bishop.txt` turns 13 / 19 / 21:
  `played Firepower from the Future … (+4 attack)` followed by `Unhandled effect observed … "attack-no-magnitude"`
  and `… "gate-only" … (parse-unrecognized)`. No row exists for it in
  `docs/ai/coverage/hero-mechanic-ledger.csv`.
- **Corpus survey (all 41 sets).** The "discard the top N cards of your deck … +Attack equal to
  those cards' printed Attack" wording appears on **one card only**: dkcy Firepower from the Future.
  Its neighbours are different primitives and stay out of scope (see Out of Scope). No existing
  handler covers it: `steal-abilities` discards one card per player and plays copies;
  `reveal-herodeck-attack` reads the shared Hero Deck; `reveal-cost-attack` leaves the card on top.
- **Why reuse the KO-from-discard choice instead of a new queue.** "KO any number of those cards"
  is a 0..N multi-select KO from the player's own discard pile — exactly `PendingKoDiscardChoice`,
  which already ships its block-all guards, resolve move, UIState projection, prompt, bot default,
  and vanquish drop. WP-836 proved the extension shape: one omit-when-absent filter field. Adding
  `eligibleCardIds?` (the cards this play discarded) restricts the same choice to "those cards".
  A new queue would re-do ~20 files of guard / dispatch / prompt wiring for no behavioural gain
  (code-style "duplicate first" does not apply — this is reuse of a live surface, not a new copy).
- **Why a one-play hand-off record.** The two printed lines are separate `abilities[]` entries,
  so the X-Men gate attaches only to line 2's hook (the free `requiresTeam` condition). Line 2's
  handler runs right after line 1's in the same `executeHeroEffects` pass (D-24521 §6) but has no
  return channel from it. Line 1 therefore writes the discarded ids to an optional
  `G.lastDeckTopDiscard` record; line 2 reads it (matching `playerID` + `sourceCardId`), parks the
  choice, and clears it. A record left behind by a gated-out line 2 is overwritten by the next
  line-1 play and never read by anything else.
- `docs/legendary-universal-rules-v23.md` §"run out of cards": "Sometimes a card effect tells you to
  reveal the top card of your deck or do something else with the top card of your deck, and you
  don't have any cards left in your deck. If that happens, shuffle your discard pile into a new deck,
  then do the … effect." — so a short deck reshuffles mid-effect (D-24285), and cards this play
  already discarded go back into the new deck with the rest of the discard pile.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary + Principle #2; `.claude/rules/architecture.md`
  §UIState Projection Integrity (five-step Board-Visible Field contract).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (§5.1 `[keyword:X]`
  / `[team:X]` tokens) and §1 Card Data Shapes (`abilities[]`).
- `docs/ai/DECISIONS.md` — scan D-24510, D-24769, D-24783, D-24285, D-24604, D-24670, D-24521 §6,
  D-24558, D-24372 before coding.
- `docs/ai/REFERENCE/00.6-code-style.md` — the code-style rules every file follows.

## Scope (In)

- **Two handler-bearing keywords:**
  - `discard-top-printed-attack` (magnitude N = cards to discard; Firepower = 4). Handler
    `heroEffectDiscardTopPrintedAttack`: for i in 1..N — if the deck is empty, reshuffle the discard
    into it (`reshuffleDiscardIntoDeck`, threaded `ctx`, D-24285); if still empty, `break` the loop
    (never `return` — the steps after the loop run on every path; log how many were discarded); else move `deck[0]` to the discard (`const moved = moveCardFromZone(zones.deck,
    zones.discard, topId); zones.deck = moved.from; zones.discard = moved.to;` — the
    `heroEffectStealAbilities` idiom) and add its printed Attack
    (`offPlayCardStats(G, id)?.attack ?? 0`) to a running total. A reshuffle can return a card this
    play already discarded to the deck, so the same id may be discarded twice (`[a, b, b, a]`); each
    discard event counts, as printed and per the rules' mid-effect reshuffle. Then add the total to
    `G.turnEconomy.attack`, log one line naming the discarded cards and the +Attack, and write
    `G.lastDeckTopDiscard = { playerID, sourceCardId: cardId, cardIds }` (every discard event, in
    order). The grant, log and record run on every path, with `cardIds: []` when nothing could be
    discarded: zones hold instance ids, so the same `firepower-from-the-future#N` replayed on a later
    turn would otherwise match a record its earlier gated-out play left behind. Joins `SELF_COMPUTED_ATTACK_KEYWORDS` so the line's `[icon:attack]` tokens are its own
    grant. Carries a magnitude → NOT in `NO_MAGNITUDE_KEYWORDS`.
  - `ko-discarded-this-way` (no magnitude). Handler `heroEffectKoDiscardedThisWay`: read
    `G.lastDeckTopDiscard`; if absent or its `playerID` / `sourceCardId` do not match this play,
    log a `blocked` no-op. Otherwise compute the eligible multiset = the recorded ids still in the
    player's discard (each id counted at most as many times as it was recorded AND is present).
    Empty → log "none of those cards are still in your discard pile" (`neutral`), no park. Non-empty
    → park `PendingKoDiscardChoice { choiceType: 'ko-from-discard', playerID, maxCount:
    eligible.length, sourceCardId: cardId, eligibleCardIds: eligible }`. `delete G.lastDeckTopDiscard`
    in every branch (`exactOptionalPropertyTypes` forbids assigning `undefined`). In
    `NO_MAGNITUDE_KEYWORDS`.
- **Keyword registration:** `HeroKeyword` union + `HERO_KEYWORDS` array (lockstep, RUNTIME pins
  +2); `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS` (+2).
- **Choice filter:** `PendingKoDiscardChoice.eligibleCardIds?: CardExtId[] | undefined` (omit-when-absent, the
  WP-836 shape). `getEligibleKoDiscardCards` gains an `eligibleCardIds?` argument: walk the discard
  in order and keep a card only while its remaining allowance in the multiset is > 0 (then apply
  `greyFilter` if both are set). `resolveKoDiscardChoice` rejects (silent `void`, queue intact) a
  selection that is not a sub-multiset of `front.eligibleCardIds` when it is set (checked inline
  beside the existing `greyFilter` check). The log names Firepower from the Future via the existing
  `sourceCardId` path.
- **Bot default:** `selectDefaultKoDiscardCardIds` replaces its inline grey filter with a call to
  `getEligibleKoDiscardCards(G, front.playerID, front.greyFilter, front.eligibleCardIds)` and picks
  from that list (Wounds, then S.H.I.E.L.D. starters; Heroes kept) — one shared filter for the
  projection and the bot, so the block-all guard always lifts. Loki / Salomé / grey picks unchanged.
- **G hand-off record:** `lastDeckTopDiscard?: { playerID: string; sourceCardId: CardExtId; cardIds:
  CardExtId[] } | undefined` on `LegendaryGameState` (the house `?: T | undefined` form) — written
  only by `discard-top-printed-attack`, removed with `delete` by `ko-discarded-this-way`, never set
  in `Game.setup`. When line 2's X-Men gate fails its handler never runs, so the record stays in `G`
  until the next line-1 play overwrites it; nothing else reads it, and only games that play
  Firepower carry it (no sentinel impact).
- **UIState five-step:** `UIPendingKoDiscardChoice.isLimitedToDiscardedThisWay?: boolean` — set
  `true` in `buildUIState` when the front entry carries `eligibleCardIds`, omitted otherwise; passed
  through in `filterUIStateForAudience`'s field-by-field rebuild (chooser-only, like the rest of the
  object); an audience-filter test. `buildUIState` also passes `frontChoice.eligibleCardIds` as the
  4th argument at its existing `getEligibleKoDiscardCards` call (`maxCount` projected unchanged).
  Step 5 is satisfied by construction — the Play Diagnostics `uiStateSnapshot` serializes the
  client's filtered UIState verbatim; evidence is the filter test plus a diagnostics export from
  the live-verify match showing `isLimitedToDiscardedThisWay: true`.
- **Client:** `PendingKoDiscardChoicePrompt.vue` heading — when `isLimitedToDiscardedThisWay` is
  true: `KO any number of the {N} {card|cards} you just discarded`, where N is the number of cards
  LISTED (`discard.length` of the projection, never the park-time `maxCount` — a later same-move
  discard change, e.g. in Steal Abilities' copy loop, can only shrink the list); every other entry
  keeps its current heading byte-identical. Prompt test covers both.
- **Card data (GENERATED):** two token forms in `VALID_TOKEN_PATTERN`
  (`^\[keyword:discard-top-printed-attack:[1-9]\d*\]$`, `^\[keyword:ko-discarded-this-way\]$`);
  two `dkcy` entries in `hero-ability-markers.json` (bishop / firepower-from-the-future: index 0 →
  `[keyword:discard-top-printed-attack:4]`, index 1 → `[keyword:ko-discarded-this-way]`); regenerate
  `dkcy.json` via apply mode.
- **Coverage regen:** `ledger:heroes`, `effect-index`, `mechanics:metadata`, `sim:runtime-observed`,
  `sim:coverage --update-baseline`, and the dashboard in-play coverage pin (expected to move, since
  the shared `attack-no-magnitude` / `gate-only` hit counts drop); `mechanic-provenance.json` rows
  for both keywords; two pending `live-verify.json` rows keyed `dkcy/bishop|discard-top-printed-attack` and
  `dkcy/bishop|ko-discarded-this-way` (`kind: "hero"`, `card`, `ability`, `wp`, `state: "pending"`, `date`,
  `evidence`, `note` — the WP-844 row shape; the dashboard joins on `<hero ledger id>|<mechanic>`).
- **Tests:** parser (both lines → their keyword hooks, line 1 has no plain `attack`, line 2 gates on
  `requiresTeam` x-men). The no-hollow play builds its hooks with the setup parser from the real
  dkcy Firepower text + markers (never a hook-less fixture, which returns early and passes vacuously)
  and asserts positively: `turnEconomy.attack` = 4 + the printed sum, plus the parked choice (X-Men
  case) or the `did not activate one of its abilities` line (no X-Men case), and no `Unhandled
  effect observed` line. Handler 1: four discards, printed-Attack sum incl. a `+` card and a Wound =
  0, short-deck reshuffle, deck+discard empty stops early; a stale record from an earlier play is
  overwritten with `cardIds: []` when nothing can be discarded and handler 2 then takes the
  `neutral` no-park branch; a re-discard after reshuffle (`[a,b,b,a]`) — Attack counts every
  discard event, the KO choice offers each id once per copy actually in the discard. Handler 2:
  park with `eligibleCardIds`, mismatched/absent record no-op, all-reshuffled empty no-op, record
  deleted. Resolve: subset accepted incl. empty; a non-eligible discard card rejected; over-cap
  rejected. `getEligibleKoDiscardCards` multiset. Bot: the discard holds a Wound NOT in
  `eligibleCardIds` — the bot does not pick it, and `resolveKoDiscardChoice` with the bot's pick
  front-pops. UIState build/filter: presence/absence by key (`Object.hasOwn`), not `=== undefined`
  — opponent and spectator lack `pendingKoDiscardChoice`, a Loki / Salomé / grey entry lacks
  `isLimitedToDiscardedThisWay`, the chooser's `discard` lists only the eligible multiset. Prompt
  heading. Drift pins.

## Out of Scope

- **Neighbouring top-of-deck Attack cards** — different primitives, untouched by this WP:
  xmen "Reveal the top card of the Hero Deck … its printed [icon:attack]" (`reveal-herodeck-attack`
  family), pttr "Reveal the top card of any player's deck … printed [icon:recruit] plus its printed
  [icon:attack]", vill "Reveal the top five cards of the Ally Deck … total printed [icon:attack]",
  cvwr "Discard the top two cards … If they have different costs … repeat".
- **Return-on-discard on a deck-top discard.** Cyclops's Unending Energy fires at the
  `discardFromHand` chokepoint only (WP-498). A deck-top discard here uses the `steal-abilities`
  deck → discard move and does not offer the return, matching WP-592. A ruling to extend it is a
  separate WP.
- **"Whenever you discard" / "whenever you KO" observers** beyond what `koCard` and the existing
  resolve already do.
- **A new pending queue, resolve move, block-all guard site, or sim dispatch entry** — reused.
- **Copy / Steal re-fires** — Copy Powers or Steal Abilities re-firing Firepower runs both clauses
  again through the reentrant `executeHeroEffects`, as printed; no special handling.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — two keywords (union + array).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `HANDLED_KEYWORDS`,
  `NO_MAGNITUDE_KEYWORDS` (`ko-discarded-this-way` only), `HERO_EFFECT_HANDLERS`; the two handlers.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `SELF_COMPUTED_ATTACK_KEYWORDS`
  gains `discard-top-printed-attack`.
- `packages/game-engine/src/types.ts` — **modified** — `PendingKoDiscardChoice.eligibleCardIds?` +
  `LegendaryGameState.lastDeckTopDiscard?`.
- `packages/game-engine/src/moves/koDiscardChoice.resolve.ts` — **modified** — eligible-multiset
  argument + resolve sub-multiset check.
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** — bot default calls the shared filter.
- `packages/game-engine/src/ui/uiState.types.ts`, `uiState.build.ts`, `uiState.filter.ts` —
  **modified** — the five-step field.
- `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.vue` — **modified** — heading.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — two token forms.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — two dkcy entries.
- `data/cards/dkcy.json` — **modified (generated)**.
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/hero-effect-coverage.baseline.json`, `scripts/coverage/mechanic-provenance.json`
  — **modified (generated / provenance)**; `docs/ai/coverage/live-verify.json` — **modified** —
  two pending rows (keys in Scope); `apps/dashboard/src/composables/useInPlayCoverage.test.ts` —
  **modified** — the in-play pin, expected to move with the regenerated coverage (left alone only if
  it does not).
- Tests (new/modified), all under `packages/game-engine/src/` unless noted:
  `hero/discardTopPrintedAttack.test.ts` (new), `rules/heroKeywords.test.ts`,
  `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`,
  `hero/heroEffects.execute.test.ts`, `moves/koDiscardChoice.resolve.test.ts`,
  `simulation/ai.legalMoves.test.ts`, `ui/uiState.build.test.ts`, `ui/uiState.filter.test.ts`, and
  `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.test.ts`.
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24786),
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

> ~12 hand-edited source files plus tests and generated feeds — one WP because the KO clause is a
> block-all choice: shipping the engine park without the projection + prompt would freeze the game
> ([[project_pending_choice_no_ux_freeze]]). Reusing the KO-from-discard choice keeps it well under
> the WP-702 footprint.

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets, no "changed section
  only" output; ESM only; Node v22+; human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: the only randomness is the empty-deck reshuffle via the threaded `ctx` shuffle
  (D-24285); no `Math.random()`; moves never throw; zone moves via `zoneOps` / `koCard`.
- `G` stores `CardExtId` strings only; the record and the filter are string arrays.
- Union and `HERO_KEYWORDS` array change in lockstep; RUNTIME drift pins (D-24372).
- The new UIState field follows all five Board-Visible steps; omitted (never `undefined`-literal)
  when the entry has no `eligibleCardIds`, so Loki / Salomé / Destroyer / Frost Giant Warrior / Ymir
  projections stay byte-identical.
- Optional `eligibleCardIds?` and `lastDeckTopDiscard?` → a game that never plays Firepower
  serializes byte-identically; **no `finalStateHash` re-pin**. If a sentinel hash moves, STOP.
- Card data via marker source + reproducible regen (`cards:check`); never hand-edit `dkcy.json`.

**Session protocol:** if the parser does not attach `requiresTeam` (x-men) to line 2's hook, or line
1 still emits a plain `attack` effect after the `SELF_COMPUTED_ATTACK_KEYWORDS` addition, STOP and
report — do not add per-card parser special-casing.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `heroEffectDiscardTopPrintedAttack(G, ctx, playerID, cardId, effect)` — discards
  `effect.magnitude` deck-top cards one at a time (reshuffle-on-empty), grants their summed printed
  Attack, writes `G.lastDeckTopDiscard`.
- `heroEffectKoDiscardedThisWay(G, ctx, playerID, cardId, effect)` — parks a filtered
  `PendingKoDiscardChoice` over the recorded cards still in the discard, or logs a no-op; always
  `delete G.lastDeckTopDiscard`.
- `PendingKoDiscardChoice.eligibleCardIds?: CardExtId[] | undefined`; `G.lastDeckTopDiscard?: {
  playerID; sourceCardId; cardIds } | undefined`; `UIPendingKoDiscardChoice.isLimitedToDiscardedThisWay?:
  boolean` (all omit-when-absent).
- `getEligibleKoDiscardCards(G, playerID, greyFilter?, eligibleCardIds?)` — discard order,
  multiset-capped.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §10.
- **No conflict:** a printed ability that does nothing today resolves as printed.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — a printed hero ability, nothing bought.
- **Determinism preservation:** the reshuffle uses `ctx.random` via the shared shuffle; the KO pick
  is an ordinary recorded move. Both new G fields are optional and absent for any game that never
  plays Firepower, so the `finalStateHash` sentinels serialize byte-identically (no re-pin). Seed-PAR
  is scheme-keyed and hero-agnostic.

## Funding Surface Gate

N/A — the only UI/copy change is the KO prompt heading; no nav / registry / profile funding
affordance, no donate or support copy, no funding channel. A hero card ability only.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. Playing Firepower moves exactly four cards (deck permitting) from the player's deck top to their
   discard and adds their summed printed Attack to `G.turnEconomy.attack`, on top of the base 4; a
   `4+` card counts 4, a Wound counts 0.
2. A deck with fewer than four cards reshuffles the discard mid-effect and keeps discarding; with
   deck and discard both empty it stops and logs how many were discarded. A card discarded, then
   reshuffled back and discarded again, adds its printed Attack each time.
3. With no other X-Men Hero played this turn, line 2 logs the gated-ability line and parks nothing.
4. With another X-Men Hero played, a `PendingKoDiscardChoice` parks with `eligibleCardIds` = the
   discarded cards still in the discard (each id at most once per copy present) and `maxCount` =
   their count; other moves are blocked.
5. `resolveKoDiscardChoice` KOs a chosen subset (including none) to `G.ko` and front-pops; a discard
   card outside `eligibleCardIds`, or more copies of an id than the multiset allows, is rejected
   with the queue intact.
6. If every discarded card was reshuffled back into the deck, no choice parks (`neutral` log).
7. `UIPendingKoDiscardChoice` for that entry lists only the eligible cards and carries
   `isLimitedToDiscardedThisWay: true` for the chooser; absent for other audiences; absent on Loki /
   Salomé / grey-filter entries; present in the Play Diagnostics `uiStateSnapshot`.
8. The prompt heading reads `KO any number of the N cards you just discarded`; other headings unchanged.
9. The bot resolves the filtered choice through `getEligibleKoDiscardCards` (block-all lifts in a
   sim game); Loki / Salomé / grey bot picks are unchanged.
10. `HERO_KEYWORDS` and `HERO_EFFECT_HANDLERS` each rise by exactly 2 from HEAD — RUNTIME pins.
11. A unit test plays Firepower with and without another X-Men Hero: no hollow is recorded and no
    `Unhandled effect observed` line is pushed. `cards:check` reproduces `dkcy.json`; the ledger
    lists both keywords `executable`; the regenerated `runtime-observed-hollows.json` is committed
    and `sim:runtime-observed:check` passes (the shared `attack-no-magnitude` / `gate-only` counts
    may drop; those mechanic rows stay, since other cards still carry them).
12. Engine + arena-client suites green; arena-client `typecheck` 0; `pnpm -r build` 0;
    `finalStateHash` sentinels unchanged.

## Verification Steps

Regenerate (in order, after the engine change builds):

- `node scripts/convert-cards/apply-hero-ability-markers.mjs` — exits 0; only `dkcy.json` changes.
- `pnpm -r build` — exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`,
  `pnpm sim:coverage --update-baseline` — each exits 0.
- `pnpm --filter @legendary-arena/dashboard prebuild:coverage` — exits 0 (refreshes the in-play
  feed the dashboard pin reads).

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test` — green; every `finalStateHash` / sentinel assert
  (`game.test.ts`, `simulation/*Parity.test.ts`, `test/fixtures/replayFixtures.test.ts`,
  `test/fixtures/hashGameState.test.ts`, `simulation/seatChoiceDispatch.test.ts`,
  `simulation/simulation.captureMoves.test.ts`) passes with no pin literal edited.
- `pnpm --filter @legendary-arena/arena-client typecheck` and `pnpm --filter @legendary-arena/arena-client test`.
- `pnpm --filter @legendary-arena/dashboard test` — after the `useInPlayCoverage.test.ts` pin update.
- `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm effect-index:check`,
  `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`.
- `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
  `node scripts/check-number-ledger.mjs --check` — at govern-close.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + arena-client + dashboard suites green; `typecheck` 0; `pnpm -r build` 0.
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance rows added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** a real match plays Firepower with and without another X-Men
      Hero; Attack rises by the printed sum, the KO prompt lists only the discarded cards, KO
      resolves, and the diagnostics export shows `isLimitedToDiscardedThisWay: true` — confirmed live, or explicitly left open as operator-pending in `docs/ai/STATUS.md`
      with the pending `live-verify.json` row.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24786 → Active;
      `docs/ai/work-packets/WORK_INDEX.md` checked; `docs/ai/execution-checklists/EC_INDEX.md` Done;
      mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0.
- [ ] No files outside `## Files Expected to Change` were modified — `git diff --name-only
      origin/main...HEAD` checked against that list.

## Reserved Decision (lands at execution)

D-24786 — "Discard the top N cards of your deck; +Attack equal to those cards' printed Attack" is
the `discard-top-printed-attack` keyword (one card at a time, D-24285 reshuffle mid-effect, every
discard event counts, printed Attack via `offPlayCardStats`); "[team:X]: KO any number of those
cards" is `ko-discarded-this-way`, which reuses the KO-from-discard choice restricted by
`eligibleCardIds` (the WP-836 filter shape; one shared filter for projection and bot) and receives
"those cards" through the one-play `G.lastDeckTopDiscard` record (removed with `delete`; left
in place, unread, when the gate fails). Deck-top discards do not offer return-on-discard (WP-592
parity).

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1:** NOT READY — PS-1 (`exactOptionalPropertyTypes`: clear with `delete`,
  type `?: T | undefined`), PS-2 (the hollow feed is per-mechanic, so the criterion became a unit
  test + `sim:runtime-observed:check`), PS-3 (`live-verify.json` allowlisted); RS-1 (missing gates
  added), RS-2 (helper call sites corrected; bot locked to the shared helper), RS-3
  (`moveCardFromZone` assign-back spelled out), RS-4 (re-discard-after-reshuffle test). All folded
  in above and in the EC.
- **Pre-flight round 2:** READY TO EXECUTE; three wording nits applied (Scope type form,
  `live-verify.json` row keys, full `finalStateHash` assert list).
- **Copilot round 1:** RISK → HOLD — stale hand-off record on an early `return` (now `break`, record
  written on every path with `cardIds: []`), projection threading locked, three tests hardened
  against vacuous passes (real parsed hooks + positive asserts; bot vs a non-eligible Wound;
  `Object.hasOwn` key checks), step-5 evidence named, heading N = listed count, DoD diff command.
  Round 2 recorded in the drafting commit body.

## Lint Gate Self-Review (00.3)

- **§1 structure:** all template sections present; Out of Scope names four neighbour cards,
  return-on-discard, observers, and the not-built queue. **PASS.**
- **§2 constraints:** full-file output with no diffs or snippets, ESM, Node v22+, and
  `00.6-code-style.md` cited in Non-Negotiable Constraints; determinism and session protocol stated.
  **PASS.**
- **§3 Assumes:** every dependency file and decision cited with its role; baseline `452956c5`;
  pin sites named. **PASS.**
- **§4 Context:** evidence log, rules quote, 00.2 §5 / §5.1 / §1, DECISIONS scan list, 00.6. **PASS.**
- **§5 files:** every file listed new/modified/generated with role and full path; ~12 hand-edited
  source files, justified by the no-UX-freeze note. **PASS.**
- **§6 naming:** `CardExtId`, `discard`, `deck`, `ko` per 00.2; booleans `is…`; full words. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; engine decides, client renders a projected
  boolean; no server change; no registry import in the engine. **PASS.**
- **§9:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`; no `boardgame.io` import in helpers; deterministic
  fixtures (makeMockCtx reverse shuffle). **PASS.**
- **§13 verification:** every step an exact command with its expected exit or result. **PASS.**
- **§14 / §15:** 12 binary criteria; DoD names STATUS / DECISIONS / WORK_INDEX / EC_INDEX / D-24026.
  **PASS.**
- **§16 code-style:** reuse of the live choice, no new abstraction; `for` loops, no `.reduce()`;
  `// why:` on the reshuffle, the record hand-off, the filter, the NO_MAGNITUDE membership. **PASS.**
- **§17 Vision:** clauses §1/§2/§10, no-conflict line, NG-1 line, determinism line. **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** Bridge-vs-HEAD staleness is a
  commit-time rule, not linted here. (Contract files, code-style §Contract Files: only
  `ui/uiState.types.ts` is edited, as every five-step UIState field does; covered by D-24786.)
- **§20 funding:** N/A with the copy-surface statement above. **§21 API catalog:** N/A. **PASS.**
