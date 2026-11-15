# WP-884 — Stalk the Night Stalkers: "You may have a Villain or Mastermind Hunt for Victims", then KO a Hero, with the Tech rescue (Game Engine + card data + arena-client headings)

**Status:** Draft 2026-11-11 (EC-922; D-24835 reserved (#3287)). Gates: pre-flight READY TO EXECUTE; copilot RISK, both items fixed;
lint PASS.
**Layer:** Game Engine (two handler-bearing hero keywords, two chained seat-choice kinds, two KO sites, one bot answer pair) + card data + two arena-client prompt headings
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay rules (two hero keywords, two chained seat-choice kinds, two KO sites) plus card data, derived feeds and two client headings; no auth, money, persistence or server surface
**Hard-deps:** WP-684 / D-24501 (the seat choice: `PendingSeatChoice`, `parkSeatChoice`, `resolveSeatChoice`, `applySeatChoiceByKind`,
the live-move chain point) ✅, WP-683 / D-24500 (a hero handler parking a seat choice at play; Here, Hold This's City-target builder
and capture helpers) ✅, WP-860 / D-24796 (a hero keyword chaining seat choices into a KO from hand or discard, `sourceZone` on an
option, the never-park-on-top guard) ✅, WP-853 / D-24789 + WP-856 / D-24792 (the owned-KO recorder and the per-function KO-site
pin) ✅, WP-744 / D-24745 + WP-882 / D-24833 (playing-seat bot answers in `ai.seatChoice.ts`, kind headings in
`PendingSeatChoicePrompt.vue`) ✅

## Goal

Make Elsa Bloodstone's **Stalk the Night Stalkers** (`mdns/elsa-bloodstone/stalk-the-night-stalkers`, Uncommon, cost 6, Tech,
printed 3 Attack) do what it prints:

- "You may have a Villain or Mastermind [keyword:Hunt for Victims]. If it KOs a Bystander this way, you may KO a Hero from your hand
  or discard pile."
- "[hc:tech]: If a Bystander is KO'd this way, you may also rescue that Bystander instead of putting it in the KO pile."

Hunt for Victims means "KO a Bystander that is captured by any Villain or Mastermind or in the Escape Pile. If you can't, then this
captures a Bystander instead." (rules v23 L1564-1577). Today line 1 parses to nothing and logs a `hunt-for-victims
parse-unrecognized` hollow on every play; line 2 is a Tech gate with no effect (`gate-only` hollow). After this WP, playing the card
(besides its printed 3 Attack) offers the player a choice of which captured or escaped Bystander to KO, or, when there is none, which
Villain or the Mastermind captures one, or to decline. If a Bystander was KO'd, the player may then KO a Hero from their hand or
discard pile. After another Tech Hero, each KO choice also offers to rescue that Bystander instead.

## User-Visible Impact

`play.legendary-arena.com`: playing Stalk the Night Stalkers no longer logs a hollow.
- **A Bystander to hunt:** a prompt headed "Have a Villain or Mastermind Hunt for Victims?" lists one button per holder. These read
  "KO a Bystander held by Hand Ninjas (Bank)", "KO a Bystander held by Zarathos" and "KO a Bystander from the Escape Pile". After another
  Tech Hero, each holder also gets a "Rescue a Bystander held by …" / "Rescue a Bystander from the Escape Pile" button. A last
  button reads "Don't Hunt for Victims".
- **No Bystander anywhere:** the buttons read "Hand Ninjas (Bank) captures a Bystander" and "Zarathos captures a Bystander", then the
  decline button.
- **After a Bystander is KO'd or rescued:** a second prompt headed "KO a Hero from your hand or discard pile?" lists "KO <name>
  (discard pile)" / "KO <name> (hand)" and "Don't KO a Hero".

The log names every step. Live-on-surface is operator-pending (D-24026).

## Assumes

- **Baseline:** `origin/main` at `a374e0a3` (WP-883 merged; #3286 bot-ally chained-round fix), re-recorded at commit. The reserve PR #3287 is merged before this body
  lands.
- **Seat choice (WP-684):**
  - `types.ts` defines `PendingSeatChoice { kind, addressedSeats, seatPrompts{ [seat]: { options } }, submissions,
    defaultOptionIndex, … }` (~1543).
  - `SeatChoiceOption { label, cityIndex?, cardId?, recipientSeat?, sourceZone?: 'hand' | 'inPlay' | 'discard', heroClass? }`
    (~1471).
  - `moves/seatChoice.resolve.ts`: `parkSeatChoice(G, events, choice)` (~387) overwrites unconditionally. The chain inputs
    are read BEFORE the apply (~511-526), and the chains run at the live-move chain point after it (~580-586).
    `applySeatChoiceByKind` (~629) has one arm per kind; new arms sit above the generic fall-through (~830-833). The timeout
    path `applySeatChoiceTimeoutDefault` (~1029) runs no chain.
  - Client: `PendingSeatChoicePrompt.vue` renders any kind's option `label`s, takes a `heading` per kind (default "Your choice"),
    and submits `resolveSeatChoice({ optionIndex })`. The projection passes only labels.
- **A hero handler parks at play** with `parkSeatChoice(G, undefined, …)`: Here, Hold This (`heroEffects.execute.ts`
  `heroEffectHereHoldThis` ~4558) and Commune (`heroEffectDiscardArtifactOrThreeThenKo` ~2230 →
  `communeSpiritWorld.logic.ts` `parkCommuneCostChoice`). Commune refuses to park on top of an open choice
  (`G.pendingSeatChoice !== undefined` → `blocked` log, ~98; the D-24761 posture).
- **Bystander holders on `G`:**
  - City captures: `G.attachedBystanders: Record<CardExtId, CardExtId[]>` keyed by the City occupant (D-1703; entry deleted when
    the list empties, `carryEscapedBystandersToPile` precedent).
  - Mastermind captures: `G.mastermind.attachedBystanders: CardExtId[]` (`mastermind/mastermind.types.ts` ~48). A Villain-Deck
    Bystander revealed into an empty City is **also** copied into `G.attachedBystanders[G.mastermind.baseCardId]`
    (`villainDeck/villainDeck.reveal.ts` ~569-590). Here, Hold This's capture (`captureBystanderToMastermind`) writes no copy.
    Defeating a tactic deletes the copy (`fightMastermind.ts` ~431-435). The invariant scan skips `attachedBystanders`
    (`gameRules.checks.ts` ~140-146), so a stale copy fails silently.
  - The Escape Pile: `G.escapedPile: CardExtId[]`, Villains and carried-away Bystanders mixed (D-24314);
    `scoring/scoring.logic.ts` `isBystanderCard(G, cardId)` tells them apart.
  - The supply: `G.piles.bystanders` (top = index 0, D-21501).
  - No special Bystander, Hidden Witness or Human Shield is modeled on `G` (grep-verified), so every Bystander is interchangeable.
- **Capture helpers** (`moves/seatChoiceCards.ts`): `buildHereHoldThisTargets(G)` lists every City occupant (~74);
  `attachBystanderToVillain(pile, villainId, attached)` (`board/bystanders.logic.ts` ~124);
  `captureBystanderToMastermind(G)` (~127). The two seat-choice helpers log Here, Hold This text, so this WP writes its own capture
  with its own log (duplicate-first, 00.6).
- **KO helpers:**
  - `board/ko.logic.ts` `koCard(koPile, cardId)` (~24).
  - `hero/deferredConditionalGrants.ts` `recordOwnedCardKoed(G, ownerPlayerID, cardId, fromZone)` (~196).
  - `villain/villainEffects.execute.ts` `buildKoEligibleTargets(zones, allowedZones?)` (~5841): non-Wound cards in zone order
    discard, hand, inPlay, deduped per (zone, id). Heroes = non-Wound cards, D-18503.
  - `hero/ownedCardKoTrigger.test.ts` (~364-404) pins every engine KO site per function: `'file#function': { koSites,
    ownedRecords }`. Its scanner (~492-519) counts every `koCard(` call and every `moveCardFromZone(…, G.ko …)` against the
    nearest preceding `function` declaration.
- **Bots** (`simulation/ai.seatChoice.ts`): `choosePlayingSeatChoiceOption` (~89) → `chooseByKind` (~127). A kind with no arm keeps
  `defaultOptionIndex`. `indexOfZeroCostKoOption` (~484) exists. `getLegalMoves`, autoplay, the sim runner and PAR always take
  `defaultOptionIndex` (D-24745).
- **Hero keyword lockstep (handler-bearing):**
  - `HeroKeyword` + `HERO_KEYWORDS` (`rules/heroKeywords.ts`). Three length pins, at **99** today:
    - `rules/heroKeywords.test.ts` ~73.
    - `rules/heroAbility.setup.test.ts`, with its ordered `expectedKeywords` (~704 / ~734).
    - `setup/heroAbility.setup.test.ts` ~1614.
  - `HERO_EFFECT_HANDLERS` and its two count pins in `hero/heroEffects.execute.test.ts` (~157, ~8128), at **78** today.
  - `HANDLED_KEYWORDS` and `NO_MAGNITUDE_KEYWORDS`.
- **Parse today (probed at `f8933dd8`):**
  - Line 1 → `{ timing: 'onPlay', keywords: [], unresolvedMarkers: ['hunt-for-victims'] }`.
  - Line 2 → `{ keywords: ['conditional'], conditions: [{ type: 'heroClassMatch', value: 'tech' }], unresolvedMarkers:
    ['gate-only'] }`.
- **Scaffold (observed 2026-11-11; temporary edits reverted).** With `'hunt-for-victims'` and `'hunt-for-victims-rescue'` appended
  to the union and array, and the tokens `[keyword:hunt-for-victims]` / `[keyword:hunt-for-victims-rescue]` appended to lines 1 / 2
  of `mdns.json`, the real parser yields:
  - Line 1: `{ timing: 'onPlay', keywords: ['hunt-for-victims'], effects: [{ type: 'hunt-for-victims' }] }`, with **no**
    `unresolvedMarkers`. The token's slug resolves the printed `[keyword:Hunt for Victims]`.
  - Line 2: `{ keywords: ['hunt-for-victims-rescue', 'conditional'], conditions: [{ type: 'heroClassMatch', value: 'tech' }],
    effects: [{ type: 'hunt-for-victims-rescue' }] }`.
  - Without the line-1 token, the generic path does **not** pick up the printed marker (it stays in `unresolvedMarkers`), so both
    tokens are required.
- `data/cards/mdns.json` is GENERATED; markers go via `hero-ability-markers.json` + `apply-hero-ability-markers.mjs`
  (`VALID_TOKEN_PATTERN`).

## Context (Read First)

- **The only Hunt for Victims hero line.** It is the only hero ability across all 41 sets that names Hunt for Victims. The Lilin
  Ambush lines (Meatmarket, Outcast, Sister Nil, Skinner, Blackout) and Lilith's tactics are villain / mastermind text, unmarked
  today, and out of scope. Their WP reuses the target / KO / capture helpers this WP writes in `moves/huntForVictims.logic.ts`.
- **Why seat choices.** No queue offers "pick a Bystander holder or decline, then optionally KO a Hero from hand or discard". The
  WP-684 seat choice is generic: labelled options, any kind rendered, parked from a hero handler at play (WP-683), and chained from
  the live move context (WP-860). So the card becomes two seat-choice kinds and no new queue, move, UIState field or projection.
- **Who hunts doesn't matter when a Bystander exists.** The KO takes "a Bystander captured by **any** Villain or Mastermind or in the
  Escape Pile", so the options name the Bystander's holder. The hunter matters only for "this captures a Bystander instead", so in
  capture mode the options name the hunter.
- **The Tech line marks the open hunt choice.** Hooks run in line order inside one `executeHeroEffects` call:
  - Line 1's handler parks the hunt choice.
  - Line 2's hook (Tech-gated by the existing pipeline, so its blocked log and Synergy clause behave like every other `[hc:X]` line)
    runs `hunt-for-victims-rescue`.
  - That handler finds the still-unsubmitted hunt choice this card parked, sets `huntForVictims.isRescueAllowed = true` and rebuilds
    its options with the rescue rows.
  - No client has seen the choice yet: the park and the rebuild happen in the same move.
  - Evaluating Tech inside line 1's handler was rejected, because it would leave line 2 a hollow and drop its Synergy clause.
- **"If it KOs a Bystander this way" holds after a rescue** (RS-5). The Tech line says "you may **also** rescue that Bystander
  instead of putting it in the KO pile". It changes the Bystander's destination, not whether it was KO'd, so the KO-a-Hero pick
  still follows. This is a reading, stated in D-24835.
- **The KO-a-Hero pick is optional** ("you may"): decline is the default. "A Hero" = a non-Wound card (D-18503). The options come
  from `buildKoEligibleTargets(zones, ['discard', 'hand'])`, in its order. Each option carries `cardId` + `sourceZone`, because ids
  repeat (S.H.I.E.L.D. Agents). It is an owned KO from hand or discard → `recordOwnedCardKoed(G, seat, cardId, sourceZone)`.
- **Scoring and scheme consequence (stated, not changed).** KOing or rescuing a Bystander from the Escape Pile removes it from
  `G.escapedPile`. So:
  - PAR's derived `bystanderLost` (`parScoring.logic.ts` ~150-161, a count of Bystanders in `G.escapedPile`) drops by one.
  - Midtown Bank Robbery's "Bystanders carried away" count (`rules/schemeResourceLoss.ts`) drops by one.
  - This is what the card prints: the Escape Pile is a named Hunt for Victims target. Bystanders KO'd this way land in `G.ko`, so
    `countBystandersInKo` (Lilin / Lilith) sees them.
  - This WP adds no scoring field and changes no weight. Whether a Bystander KO'd by any effect should count as lost is a separate
    scoring decision, out of scope (D-24835 names it).
- **Chaining.** The KO-a-Hero chain's inputs (the seat, `sourceCardId`, and whether the chosen option will move a Bystander) are read
  from the submitted choice BEFORE the apply, by a pure reader. The chain parks at the live-move chain point after the apply (the
  Commune / Crush precedent). The applies return void. The unwired WP-116 timeout path runs no chain; its default is decline anyway.
- **Bots.** `getLegalMoves`, autoplay, the sim runner and PAR keep each kind's default (decline / decline), so seed PAR, sim sweeps
  and every `finalStateHash` sentinel are untouched. A playing bot ally (`ai.seatChoice.ts`, D-24745) answers like this:
  - **Hunt:** rescue from the Escape Pile; else KO from the Escape Pile (an escaped Bystander is otherwise lost and counts in
    `bystanderLost`); else the first remaining rescue option; else decline. It never chooses a capture or a KO from a Villain or the
    Mastermind, since those take away the VP it would rescue by fighting.
  - **Live bot path:** the hunt → KO-a-Hero chain re-parks a choice for the same bot seat. The server's bot-ally driver handles
    that since #3286 (`a374e0a3`, `apps/server/src/bot-ally/botAllyDriver.mjs`), which is already on `main`.
  - **KO a Hero:** a 0-cost Hero (S.H.I.E.L.D. starter); else decline.
- **Import cycles.** `seatChoice.resolve` ↔ `huntForVictims.logic` and `heroEffects.execute` → `huntForVictims.logic`: imported
  bindings are read only inside function bodies, and the kind constants are string literals (the `communeSpiritWorld.logic.ts`
  precedent).
- **Coordination.** WP-883 merged on `d2c38884` (pins 99 / 78). Any hero-keyword WP that lands first moves the pins. Rebase them as
  "+2 from HEAD", not to a literal.
- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, §Rule Execution Pipeline, Principle #1; `docs/ai/REFERENCE/00.2-data-requirements.md`
  §5; `docs/ai/REFERENCE/00.6-code-style.md`. Scan `docs/ai/DECISIONS.md` for D-24501, D-24500, D-24796, D-24761, D-24789, D-24792,
  D-24745, D-24833, D-24314, D-24339, D-18503 and D-24372 before coding.

### RS-1 — When nothing parks (default locked)

- **Another seat choice is already open** (`G.pendingSeatChoice !== undefined`): no park; `blocked` log "Player N could not Hunt for
  Victims — another choice is open." (the D-24761 / Commune posture).
- **No Bystander to KO anywhere and an empty Bystander supply:** nothing can happen. No park; `blocked` log "Player N's
  <cardRef> found no Bystander to Hunt for Victims, and the Bystander supply is empty."
- **The Tech handler finds no open hunt choice from this card** (RS-1 blocked it, or a copy played it after the choice resolved):
  nothing happens and nothing is logged. The hunt line already logged the reason; a second line would be noise, so the source
  carries a `// why:` for this.

### RS-2 — Hunt options (default locked)

**KO mode** applies when at least one holder has a Bystander. The holders, in this order:
- each City space (ascending index) whose occupant has at least one `G.attachedBystanders` entry: `{ label: 'KO a Bystander held by
  <Villain> (<Space>)', huntAction: 'ko', huntSource: 'city', cityIndex, cardId: <occupant> }`;
- the Mastermind when `G.mastermind.attachedBystanders.length >= 1`: `{ label: 'KO a Bystander held by <Mastermind>', huntAction:
  'ko', huntSource: 'mastermind' }`;
- the Escape Pile when it holds at least one `isBystanderCard` entry: `{ label: 'KO a Bystander from the Escape Pile', huntAction:
  'ko', huntSource: 'escape-pile' }`.

With `isRescueAllowed`, each holder's KO option is preceded by its rescue twin: label "Rescue a Bystander held by <Villain> (<Space>)" /
"Rescue a Bystander held by <Mastermind>" / "Rescue a Bystander from the Escape Pile", with `huntAction: 'rescue'` (a City
twin carries the same `cityIndex` + `cardId`).

**Capture mode** applies when no holder has a Bystander and the supply is non-empty:
- one option per City occupant (`buildHereHoldThisTargets` order): `{ label: '<Villain> (<Space>) captures a Bystander', huntAction:
  'capture', huntSource: 'city', cityIndex, cardId: <occupant> }`;
- then `{ label: '<Mastermind> captures a Bystander', huntAction: 'capture', huntSource: 'mastermind' }`.

**Both modes** end with `{ label: "Don't Hunt for Victims" }` (no `huntAction`), and `defaultOptionIndex` = that last index. The
action is read from the option's fields, never from its label or position. Names come from `resolveCardName(G.cardDisplayData, id)`.
The Mastermind's name is `resolveCardName(G.cardDisplayData, G.mastermind.baseCardId)` (the `fightMastermind.ts` ~598 idiom).
Every City label appends its space in parentheses: `citySpaceNameForIndex(cityIndex)` (`board/citySpaceNames.ts`, lowercase
slugs), title-cased (Sewers / Bank / Rooftops / Streets / Bridge). An out-of-range index gets no suffix. For example, "KO a Bystander held by Hand Ninjas
(Bank)" / "Hand Ninjas (Bank) captures a Bystander". Two copies of one Villain are then distinguishable; it matters because some
Villains gain Attack per Bystander held (`economy.resolve.ts` ~342-360).

### RS-3 — Which Bystander (default locked)

- From a City Villain or the Mastermind: the **last** entry of that holder's list (the most recently captured). A City list that
  empties deletes its `G.attachedBystanders` key.
- From the Mastermind: the last entry of `G.mastermind.attachedBystanders`. Also remove that id's last occurrence from
  `G.attachedBystanders[G.mastermind.baseCardId]` when present, and delete the key when it empties (PS-1: the reveal path's mirror
  copy). The option list and RS-7 read `G.mastermind.attachedBystanders` only. City options come from `G.city` occupants, never
  from the map's keys, so the mirror key is never offered as a City holder. A capture to the Mastermind writes no copy (the Here,
  Hold This precedent).
- From the Escape Pile: the last entry for which `isBystanderCard` holds. The Villains in the pile never move. Removing from
  `G.escapedPile` has a precedent: Fortify's `fortify.logic.ts` ~154. The `types.ts` "append-only" comment on it is already
  stale; leave that comment alone (out of scope).

Every Bystander on `G` is interchangeable (no special Bystander is modeled), so the instance choice changes nothing visible. It is
locked for determinism. If special Bystanders are ever modeled, revisit.

### RS-4 — Apply outcomes (default locked)

Placeholders in the log templates:
- `<cardRef>` = `formatCardRef(G.cardDisplayData, sourceCardId)`, which renders `Name (ext-id)`.
- `<holder>` = "<Villain> (<Space>)", "<Mastermind>", or "the Escape Pile".
- `<hunter>` = "<Villain> (<Space>)" or "<Mastermind>".

The outcomes:
- **`ko`:** the Bystander leaves its holder, then **one** `G.ko = koCard(G.ko, bystanderId)` call per apply, made after the holder
  is resolved (not one per holder branch). Log "Player N's <cardRef> Hunted for Victims: a Bystander held by <holder> was KO'd."
  The Escape Pile reads "…: a Bystander in the Escape Pile was KO'd."
- **`rescue`:** the Bystander leaves its holder into the seat's `victory`. Log "Player N's <cardRef> Hunted for Victims: a Bystander
  held by <holder> was rescued instead of KO'd." (The Escape Pile reads "a Bystander in the Escape Pile …".)
- **`capture`:** the top supply Bystander goes to the hunter. A City hunter uses `attachBystanderToVillain`; the Mastermind gets it
  appended to `G.mastermind.attachedBystanders`. Log "Player N's <cardRef> Hunted for Victims: no Bystander to KO, so <hunter>
  captured a Bystander."
- **Decline:** log "Player N chose not to Hunt for Victims." It names no card, nor does the RS-1 open-choice line.
- `ko` and `rescue` chain the KO-a-Hero pick (RS-6); `capture` and decline chain nothing.

### RS-5 — The rescue reading (default locked)

A rescued Bystander counts as "KO'd this way" for the KO-a-Hero clause (Context). It is not added to `G.ko`, and no rescue counter
exists on `G` to update.

### RS-6 — The KO-a-Hero pick (default locked)

Kind `hunt-for-victims-ko-hero`, addressed to the same seat. The options:
- one per `buildKoEligibleTargets(zones, ['discard', 'hand'])` target: label "KO <name> (discard pile)" / "KO <name> (hand)", with
  `cardId` and `sourceZone`;
- then `{ label: "Don't KO a Hero" }`, with `defaultOptionIndex` = last.

An empty pool parks nothing and logs "Player N had no Hero in hand or discard pile to KO for <cardRef>." (`blocked`).
The apply moves the card out of its option's `sourceZone` only, then:
- `G.ko = koCard(G.ko, cardId)`;
- `recordOwnedCardKoed(G, seat, cardId, sourceZone)`, in the same named function as the `koCard`;
- log "Player N KO'd <Hero> from their hand|discard pile for <cardRef>."

Every log that names the source card uses `<cardRef>`, never a hardcoded name, because the villain-side follow-up reuses this
module. The open-choice line and the two decline lines name no card.

Decline logs "Player N chose not to KO a Hero."

### RS-7 — Stale options (default locked)

Every apply re-checks before acting. Each case below logs `blocked`, moves nothing, and chains no KO-a-Hero pick:
- a city option (ko, rescue or capture) with `G.city[cityIndex] !== option.cardId`, or (ko / rescue) whose occupant's
  `G.attachedBystanders` list is empty;
- a Mastermind / Escape Pile option with no Bystander left;
- a capture with an empty supply;
- a KO-a-Hero option whose card is no longer in its `sourceZone`. This one also makes no recorder call.

The chain reader returns `false` for all of these, so no Hero KO is offered without a Bystander KO.

### RS-8 — Headings and labels (default locked)

`PendingSeatChoicePrompt.vue` headings:
- `'hunt-for-victims'` → "Have a Villain or Mastermind Hunt for Victims?"
- `'hunt-for-victims-ko-hero'` → "KO a Hero from your hand or discard pile?"

Option labels are as in RS-2 / RS-6.

## Scope (In)

- **Keywords** (`rules/heroKeywords.ts`): `HeroKeyword` + `HERO_KEYWORDS` gain `'hunt-for-victims'` then
  `'hunt-for-victims-rescue'`, appended last in that order. Neither has a magnitude.
- **Executor** (`hero/heroEffects.execute.ts`):
  - `HERO_EFFECT_HANDLERS['hunt-for-victims'] = heroEffectHuntForVictims` calls `parkHuntForVictimsChoice(G, playerID, cardId)`.
  - `HERO_EFFECT_HANDLERS['hunt-for-victims-rescue'] = heroEffectHuntForVictimsRescue` calls `allowHuntForVictimsRescue(G,
    playerID, cardId)`.
  - Both keywords join `HANDLED_KEYWORDS` and `NO_MAGNITUDE_KEYWORDS`.
- **Markers** (`hero-ability-markers.json` → `mdns`):
  - `{ heroSlug: "elsa-bloodstone", cardSlug: "stalk-the-night-stalkers", abilityIndex: 0, markupToken:
    "[keyword:hunt-for-victims]" }`
  - the same with `abilityIndex: 1, markupToken: "[keyword:hunt-for-victims-rescue]"`.
  - `VALID_TOKEN_PATTERN` gains `^\[keyword:hunt-for-victims\]$` and `^\[keyword:hunt-for-victims-rescue\]$`, and its error message
    lists them.
  - Regenerate `mdns.json`. The target hooks are as in §Assumes "Scaffold".
- **Contract** (`types.ts`):
  - `PendingSeatChoice.huntForVictims?: { sourceCardId: CardExtId; isRescueAllowed?: boolean }`, present only on the two hunt
    kinds. `isRescueAllowed` is written only as `true` (omit-when-false; `exactOptionalPropertyTypes`).
  - `SeatChoiceOption.huntAction?: 'ko' | 'rescue' | 'capture'` and `SeatChoiceOption.huntSource?: 'city' | 'mastermind' |
    'escape-pile'`, present only on hunt options.
  - Every City hunt option also carries the existing `SeatChoiceOption.cardId` (the occupant, for the RS-7 staleness check). Its
    `// why:` comment gains the hunt options.
  - None of the three new fields is projected to the client.
- **New module** `moves/huntForVictims.logic.ts` (no boardgame.io import, no registry, no `.reduce()`, never throws):
  - **Kinds:** `HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND = 'hunt-for-victims'`, `HUNT_FOR_VICTIMS_KO_HERO_SEAT_CHOICE_KIND =
    'hunt-for-victims-ko-hero'`.
  - **Option builder** `buildHuntForVictimsOptions(G, isRescueAllowed): SeatChoiceOption[]` implements RS-2 (KO / rescue mode or
    capture mode), with the decline last.
  - **Park and allow:**
    - `parkHuntForVictimsChoice(G, playerID, sourceCardId)`: the RS-1 guards, else `parkSeatChoice(G, undefined, …)` with
      `huntForVictims: { sourceCardId }` and the "must choose" neutral log.
    - `allowHuntForVictimsRescue(G, playerID, sourceCardId)`: when the open choice is kind `'hunt-for-victims'`, addressed to
      `playerID`, unsubmitted, with a matching `sourceCardId`, set `isRescueAllowed: true` and replace the seat's options with
      `buildHuntForVictimsOptions(G, true)`. The default stays the last index. Otherwise it is a no-op (RS-1).
  - **Pure chain reader** `readHuntForVictimsWillKoBystander(G, choice): boolean` is called BEFORE the apply. It returns true only
    for a `ko` / `rescue` option whose holder still has a Bystander (RS-7).
  - **Applies:**
    - `applyHuntForVictimsResolvedSeatChoice(G, choice): void` (RS-3 / RS-4; holds the Bystander KO site).
    - `applyHuntForVictimsKoHeroResolvedSeatChoice(G, choice): void` (RS-6; holds the owned KO site).
  - **Chain** `chainHuntForVictimsKoHero(G, seat, sourceCardId)` parks the KO-a-Hero pick with `parkSeatChoice(G, undefined,
    choice)`, or logs the RS-6 empty-pool line. The hunting seat is always the active player, so there is no stage ride
    (D-24648): never pass `events` without the seat argument.
- **Seat-choice wiring** (`moves/seatChoice.resolve.ts`):
  - two `applySeatChoiceByKind` arms;
  - the reader and seat / source captured BEFORE the apply, beside `readCommuneCostBranch`;
  - the chain call at the live-move chain point, beside `chainCommuneAfterCost`.
- **Bot answers** (`simulation/ai.seatChoice.ts`): two `chooseByKind` arms per Context "Bots". The header comment lists the kinds.
- **Client** (`apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue`): two `heading` cases (RS-8), each with a `//
  why:`.
- **KO-site pin** (`hero/ownedCardKoTrigger.test.ts`):
  - `'moves/huntForVictims.logic.ts#applyHuntForVictimsResolvedSeatChoice': { koSites: 1, ownedRecords: 0 }`
  - `'moves/huntForVictims.logic.ts#applyHuntForVictimsKoHeroResolvedSeatChoice': { koSites: 1, ownedRecords: 1 }`
  - The scanner reads every engine file. If a named helper holds the single Bystander `koCard` call, the row names that helper.
    The Hero KO's `koCard` and `recordOwnedCardKoed` sit in the same named function (row x / 1).
- **Ledger / coverage:**
  - Provenance rows `hunt-for-victims` and `hunt-for-victims-rescue` (WP-884 / D-24835).
  - A pending `live-verify.json` row `mdns/elsa-bloodstone|hunt-for-victims`.
  - Regenerate `ledger:heroes`, `effect-index`, `mechanics:metadata`, `sim:runtime-observed`, `sim:coverage --update-baseline`
    (only if `--check` fails on the removed hollows) and the dashboard coverage copies. The in-play pin is updated only if it moves,
    with a dated comment.
- **Tests:** a new `moves/huntForVictims.test.ts`, built from hooks the real parser produces on the committed `mdns.json`.
  - **Parse:** the two target hooks exactly. Playing the card records no hollow and keeps its printed 3 Attack.
  - **KO mode options:** a Villain holding 2 Bystanders at space 1, the Mastermind holding 1, and the Escape Pile holding 1 Villain
    + 1 Bystander → labels `['KO a Bystander held by <V> (Bank)', 'KO a Bystander held by <M>', 'KO a Bystander from the Escape
    Pile', "Don't Hunt for Victims"]`, default 3. Two copies of one Villain get two distinct labels.
  - **Mastermind mirror (PS-1):** a Bystander revealed from the Villain Deck into an empty City (through the real reveal path) is
    in both Mastermind stores. KOing it removes it from `G.mastermind.attachedBystanders` and from
    `G.attachedBystanders[G.mastermind.baseCardId]`, deleting the key when it empties. A Here, Hold This capture (no copy) KOs
    cleanly too.
  - **KO from a City Villain** through the real `resolveSeatChoice`: the last Bystander lands in `G.ko`, the Villain keeps one, and
    the KO-a-Hero pick opens.
  - **KO the only City Bystander:** the `G.attachedBystanders` key is deleted.
  - **KO from the Escape Pile:** the escaped Villain stays, and `escapedPile` holds one fewer Bystander.
  - **Rescue (Tech):** with another Tech Hero played first, the options interleave rescue/KO twins, default last. Rescue moves the
    Bystander to `victory` (not `G.ko`), and the KO-a-Hero pick still opens (RS-5).
  - **No Tech Hero:** the rescue line logs its blocked line, and the options have no rescue rows.
  - **Capture mode:** no Bystander anywhere, two City Villains → options `['<V1> (<space>) captures a Bystander', '<V2> (<space>)
    captures a Bystander', '<M> captures a Bystander', "Don't Hunt for Victims"]`. Choosing the Mastermind appends the top supply Bystander
    to `G.mastermind.attachedBystanders`, and no KO-a-Hero pick opens.
  - **RS-1:** an empty supply with no Bystander anywhere → no park, the blocked log. An open seat choice → no park, the blocked log,
    the open choice untouched, and the Tech handler a no-op.
  - **KO a Hero:** a S.H.I.E.L.D. Agent in both hand and discard pile → two options; picking the discard one KOs from the discard
    pile only, records an owned KO, and the hand copy stays. Decline → nothing.
  - **Empty Hero pool:** after a Bystander KO with an empty hand and discard pile, no pick opens and the log says so.
  - **RS-7:** a city option whose Villain lost its Bystander before the apply → blocked, nothing in `G.ko`, no chain. A city
    option whose space now holds a different occupant (`G.city[cityIndex] !== option.cardId`), for both ko and capture →
    blocked, nothing moves.
  - **Bots:** `choosePlayingSeatChoiceOption` picks the Escape Pile rescue, then the Escape Pile KO, then the first other rescue,
    then decline. For the Hero pick it picks a 0-cost Hero, then decline. `getLegalMoves` still offers the decline default.
  - **Timeout:** `applySeatChoiceTimeoutDefault` declines and parks nothing.
  - **JSON round-trip:** a parked hunt choice with `isRescueAllowed` survives JSON unchanged.
  - **Pins:** `HERO_KEYWORDS` +2 at the three sites (`expectedKeywords` appended in order); `HERO_EFFECT_HANDLERS` count +2 at both
    pins; the MVP / handled bidirectional test passes unedited.
  - **Client** (`PendingSeatChoicePrompt.test.ts`): the two headings render for their kinds.

  Expected unchanged: every `finalStateHash` sentinel, the seat-choice / Commune / Here, Hold This tests and PAR.

## Out of Scope

- The villain / mastermind Hunt for Victims (Lilin Ambush ×5, Blackout's Moonlight repeat, Lilith's tactics and strike): a
  follow-up WP reusing this module's target / KO / capture helpers.
- Counting a KO'd Bystander as "lost" in scoring, and any scoring weight (Context; a separate decision).
- Special Bystanders, Hidden Witnesses and Human Shields (none modeled).
- Any new pending queue, move, `CoreMoveName`, UIState field, projection change or server change.
- `replay/replay.execute.ts` keeps its D-24322 posture.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — two keywords (closed union; D-24835).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — two handlers + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`.
- `packages/game-engine/src/moves/huntForVictims.logic.ts` — **new** — kinds, options, park, rescue allow, reader, applies, chain,
  two KO sites.
- `packages/game-engine/src/moves/seatChoice.resolve.ts` — **modified** — two kind arms, the pre-apply reader, the chain call.
- `packages/game-engine/src/types.ts` — **modified** — `PendingSeatChoice.huntForVictims?`, `SeatChoiceOption.huntAction?` /
  `huntSource?` (contract file; D-24835).
- `packages/game-engine/src/simulation/ai.seatChoice.ts` — **modified** — two bot arms.
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` — **modified** — two headings.
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified**;
  `data/cards/mdns.json` — **generated**.
- Generated / provenance: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/hero-effect-coverage.baseline.json` (only if it moves), `scripts/coverage/mechanic-provenance.json`,
  `docs/ai/coverage/live-verify.json`, the `apps/dashboard/src/data/*` copies the regen rewrites, and
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (in-play pin, only if it moves).
- Tests:
  - new: `packages/game-engine/src/moves/huntForVictims.test.ts`;
  - modified: `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`,
    `hero/heroEffects.execute.test.ts`, `hero/ownedCardKoTrigger.test.ts`, `simulation/ai.seatChoice.test.ts`,
    `apps/arena-client/src/components/play/PendingSeatChoicePrompt.test.ts`.
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24835), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file: no diffs, no snippets. ESM only; Node v22+; human-style code per
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness, clocks or I/O; `for` loops, no `.reduce()`, no nested ternaries; never throw.
- `G` stays JSON. The new optional fields ride only on the two hunt kinds and are removed with the choice. No sentinel game plays
  Stalk the Night Stalkers, and every default is decline, so `finalStateHash` sentinels and PAR serialize byte-identically: **no
  re-pin**. A moved sentinel is a STOP.
- Bystander KO only at the RS-4 site; Hero KO only at the RS-6 site, with the recorder. Card data only via the marker source + a
  reproducible regen (`cards:check`); never hand-edit `mdns.json`.

**Session protocol:** STOP and report if any of these happens:
- the parse differs from the scaffold;
- playing the card still records a hollow;
- a choice parks with no actionable option;
- a KO-a-Hero pick opens without a Bystander KO / rescue;
- any sentinel or PAR value moves.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `HeroKeyword` gains `'hunt-for-victims'` and `'hunt-for-victims-rescue'`; markers `[keyword:hunt-for-victims]` /
  `[keyword:hunt-for-victims-rescue]`.
- Seat-choice kinds `'hunt-for-victims'`, `'hunt-for-victims-ko-hero'`.
- `PendingSeatChoice.huntForVictims?: { sourceCardId: CardExtId; isRescueAllowed?: boolean }`.
- `SeatChoiceOption.huntAction?: 'ko' | 'rescue' | 'capture'` and `huntSource?: 'city' | 'mastermind' | 'escape-pile'`.
- None of these new fields is projected to the client.
- Two KO sites in `moves/huntForVictims.logic.ts` (one owned).

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation).
- **No conflict:** a printed ability that does nothing today resolves as printed.
- **Non-Goal proximity:** NG-1 (no pay-to-win) is untouched: a printed hero ability, nothing bought. A player-chosen KO from the
  Escape Pile lowers the derived `bystanderLost`, as the printed card allows; no weight changes.
- **Determinism preservation:** no randomness. The choices are seat-choice state the shared resolve already serializes, absent in
  any match that doesn't play the card. Seed PAR is scheme-keyed and hero-agnostic, and every default is decline.
  - Replay compatibility: a stored match replays from its bgio `initialState`, which holds its setup-time `G.heroAbilityHooks`,
    so pre-WP-884 matches (and in-flight ones) replay identically. Only matches created after the deploy, or a re-setup from
    config + seed, see the new hooks (the D-24749 §12 / D-24750 §11 wording).

## Funding Surface Gate

N/A — no nav, pricing or funding surface; two headings and option labels in the existing seat-choice prompt.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. Playing Stalk the Night Stalkers records no hollow and keeps its printed 3 Attack.
2. With a captured or escaped Bystander anywhere, the hunt choice lists each holder (RS-2 order) and a decline (default). With none
   and a non-empty supply, it lists each hunter and a decline. Otherwise nothing parks and the RS-1 line is logged.
3. A KO option moves the holder's last Bystander to `G.ko`; an emptied City list loses its key.
4. After another Tech Hero, each holder also offers a rescue. Rescue moves the Bystander to the player's Victory Pile.
5. After a KO or rescue, an optional KO-a-Hero pick lists hand and discard-pile Heroes (no Wounds). The chosen card is KO'd from its
   zone and recorded as an owned KO. Capture and decline open no pick.
6. A capture attaches the top supply Bystander to the chosen City Villain or the Mastermind.
7. Stale options and an open choice are logged no-ops; nothing parks on top of another choice.
8. A playing bot ally rescues from the Escape Pile, else KOs from it, else takes another rescue, else declines. It KOs a 0-cost
   Hero, else declines. `getLegalMoves`
   keeps the defaults.
9. The client shows the two headings.
10. `cards:check` reproduces `mdns.json` and every feed `:check` exits 0; the ledger lists Elsa Bloodstone's `hunt-for-victims` as
    executable.
11. Engine, arena-client and dashboard suites are green; `pnpm -r build` exits 0; the KO-site pin has the two rows; `finalStateHash`
    sentinels and PAR are unchanged.

## Verification Steps

Regenerate, in order, after the engine change builds:

1. Add the provenance rows and the pending `live-verify.json` row.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` — exits 0; only `mdns.json` changes (two lines). Re-run → 0 updates;
   `--validate` → no drift.
3. `pnpm -r build` — exits 0; `git status` shows no unexpected generated churn (revert CRLF-only `lagn-v1.json` churn).
4. `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`, `pnpm --filter
   @legendary-arena/dashboard prebuild:coverage` — each exits 0. `pnpm sim:coverage --check`; if it fails only on the removed
   Stalk hollows, run `--update-baseline` and state it.

Check (each exits 0):

5. `pnpm --filter @legendary-arena/game-engine test`: green. Record the baseline and the exact delta (expect at least +18).
6. `pnpm --filter @legendary-arena/arena-client test`, `pnpm --filter @legendary-arena/dashboard test`, `pnpm --filter
   @legendary-arena/arena-client typecheck` and `pnpm --filter @legendary-arena/dashboard typecheck`; `pnpm -r --no-bail test`
   at 0 fail.
7. The checks: `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`, `pnpm
   sim:runtime-observed:check`, `pnpm sim:coverage --check`.
8. At govern-close: `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`, `node
   scripts/check-number-ledger.mjs --check`.
9. `git diff --name-only origin/main...HEAD` is a subset of §Files Expected to Change.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + arena-client + dashboard suites green; arena-client and dashboard `typecheck` 0; `pnpm -r build` 0.
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance rows added.
- [ ] `finalStateHash` sentinels and PAR byte-unchanged.
- [ ] **Live-on-surface (D-24026):** on a match **created after the deploy** (`isMatchOlderThanServer: false`) with Elsa
      Bloodstone, using the operator setters to stage a Villain holding a Bystander:
      - play Stalk → the hunt choice (Play Diagnostics `uiStateSnapshot.pendingSeatChoice` options), KO that Bystander, then KO a
        S.H.I.E.L.D. Agent from the discard pile;
      - on another turn, after a Tech Hero, rescue one;
      - with no Bystander anywhere, see the capture options.

      Either confirm all of this live, or record it as operator-pending in `STATUS.md` with the pending `live-verify.json` row.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24835 → Active; `WORK_INDEX.md` checked; `EC_INDEX.md` Done; mindmap ✅ +
      `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only origin/main...HEAD` checked).

## Reserved Decision (lands at execution)

D-24835 — Stalk the Night Stalkers' two lines resolve as the handler-bearing hero keywords `hunt-for-victims` and
`hunt-for-victims-rescue`, through two chained WP-684 seat-choice kinds:

- **`hunt-for-victims`** has two modes:
  - KO mode: one option per Bystander holder (City Villains ascending, then the Mastermind, then the Escape Pile), each KOing that
    holder's last Bystander.
  - Capture mode, used only when no holder has one and the supply is non-empty: one option per City Villain, then the Mastermind,
    each capturing the top supply Bystander.
  - Both end with a decline, which is the default. City labels carry the space name. A Mastermind KO also clears the reveal
    path's mirror copy in `G.attachedBystanders[baseCardId]`.
- **The Tech line's handler** marks the still-unsubmitted hunt choice its own card parked (`isRescueAllowed`) and adds a rescue twin
  before each KO option. A rescued Bystander goes to the Victory Pile and still counts as "KO'd this way", the "also" reading.
- **`hunt-for-victims-ko-hero`** follows a KO or rescue: an optional pick over discard-pile then hand non-Wound cards, each carrying
  `sourceZone`, with decline as the default. It is an owned KO (`recordOwnedCardKoed`).
- **Actions are read from option fields** (`huntAction` / `huntSource` / `cityIndex`), never from labels.
- **Logged no-ops:** another open choice, nothing to hunt with an empty supply, and every stale option. No Hero KO happens without a
  Bystander KO.
- **The Tech handler** is silent when no hunt choice from its card is open.
- **Bots:** a playing bot ally rescues from the Escape Pile, else KOs from it, else takes another rescue, else declines. It KOs a
  0-cost Hero, else declines. Autoplay,
  sim and PAR take the declines.
- **Stated consequence, no scoring change:** KOing or rescuing an escaped Bystander lowers PAR's derived `bystanderLost` and Midtown
  Bank Robbery's carried-away count, as the printed card allows. Whether any KO'd Bystander should score as lost is left to a
  separate decision.
- **Contract:** `PendingSeatChoice.huntForVictims?`, `SeatChoiceOption.huntAction?` / `huntSource?`.
- **Replays:** a stored match replays from its `initialState`, whose setup-time hooks are unchanged, so pre-WP-884 matches replay
  identically. Only matches created after the deploy see the new hooks.
- **Follow-up:** the villain / mastermind Hunt for Victims reuses this module.

## Gate Record

Each gate ran as an independent subagent against the files at HEAD.

- **01.4 pre-flight, round 1: NOT READY.**
  - PS-1: the Mastermind's Bystanders have a mirror copy in `G.attachedBystanders[G.mastermind.baseCardId]`, written by the
    Villain-Deck reveal into an empty City (`villainDeck.reveal.ts` ~569-590). It is now folded into §Assumes, RS-3 and EC RS-3,
    with a test.
  - RS items folded: baseline `a374e0a3` + #3286 (the bot-ally chained re-park); bot order Escape Pile first; the Mastermind name
    idiom locked; the City-space label suffix; one `koCard` per apply; `formatCardRef` in logs; the Fortify Escape-Pile removal
    precedent; line refs refreshed.
  - The scaffold was re-proved on a scratch dist.
- **01.4 pre-flight, round 2: READY TO EXECUTE**, conditional on two text fixes, both applied:
  - the title-cased `citySpaceNameForIndex` suffix;
  - no hardcoded card name in the EC log.
- **01.7 copilot, round 1: RISK → HOLD.** Five fixes, all applied:
  - #28: replay compatibility. The `initialState` hooks are unchanged, so pre-WP-884 matches replay identically.
  - #26 / #11: City options carry `cardId`, and RS-7 checks the occupant (test added).
  - #4 / #12: the KO-site row may name the helper that holds the single `koCard`; the Hero `koCard` + recorder share one function.
  - #26 / #27: complete log templates (`<cardRef>` / `<holder>` / `<hunter>`, "Hunted for Victims", no nested parentheses).
  - #16: the chain park passes `undefined` events, so there is no stage ride (D-24648).
- **01.7 copilot, round 2: RISK.** Both items were applied and confirmed by the 00.3 reviewer:
  - the EC line budget (now 96);
  - the EC RS-4 rescue line written as a full template, with the Escape Pile wording stated once for ko and rescue.
- No PS remains open, and execution needs reserve PR #3287 merged (EC Before Starting).

## Lint Gate Self-Review (00.3)

- §1 Structure: PASS — all ten required sections are present and non-empty. Out of Scope names five exclusions: villain /
  mastermind Hunt for Victims, scoring "lost" counting, special Bystanders, new queue / move / UIState / server, and the replay
  posture.
- §2 Constraints: PASS — full-file output (no diffs or snippets), ESM, Node v22+, and `00.6-code-style.md` cited. Packet
  constraints: determinism, G-JSON with no sentinel re-pin, single KO sites, marker-only card data. A five-trigger STOP protocol;
  locked values live in the EC.
- §3 Assumes: PASS — baseline `a374e0a3`, reserve PR #3287, and WP-684 / 683 / 860 / 853 / 856 / 744 / 882 (all ✅). Every
  helper, type, pin and chain point is cited with file and line, plus the probed and scaffold parses.
- §4 Context: PASS — ARCHITECTURE §Move Validation Contract, §Rule Execution Pipeline and Principle #1; `00.2` §5; `00.6`; a
  12-entry DECISIONS scan list. RS-1..RS-8 are locked. No new cross-package import.
- §5 Files: PASS — every file is listed as new / modified / generated, with its role. The count follows the handler-bearing keyword
  lockstep plus the generated feeds (WP-860 / WP-883 precedent).
- §6 Naming: PASS — full-word names (`readHuntForVictimsWillKoBystander`, `isRescueAllowed`); the existing
  `SeatChoiceOption.cardId` is reused; no 00.2 §7 field is touched.
- §7 Dependencies: PASS — no new npm dependency.
- §8 Boundaries: PASS — gameplay stays in the engine. The new module is a pure helper (no boardgame.io, no registry). The client
  change is two heading strings. No server change.
- §9 Windows: PASS — `pnpm` / `node` / `git` commands only.
- §10 Env vars: N/A — none read or added.
- §11 Auth: N/A — no auth surface.
- §12 Tests: PASS — `node:test` `.test.ts`; hooks from the real parser on the committed `mdns.json`, run end to end through
  the real `resolveSeatChoice`; no network or DB.
- §13 Verification: PASS — exact regen and `:check` commands (all existing scripts) with expected exits, an engine delta of
  at least +18, and the scope diff.
- §14 Acceptance Criteria: PASS — 11 binary criteria aligned to scope.
- §15 Definition of Done: PASS — STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap / ledger, the scope check, and the D-24026
  live check (§15.1). The Risk Tier line (D-24800) is in the WP header and copied verbatim into the EC (§15.2, fixed after
  round 1).
- §16 Code style: PASS — `00.6` cited. Duplicate-first capture; `for` loops, no `.reduce()`, no nested ternaries, never
  throws. Options are read from fields, not labels. The `// why:` locations are in the EC.
- §17 Vision: PASS — §1, §2, §8, §10 and §22; no-conflict, NG-1 and determinism lines; replay-compatibility wording.
- §18 Prose-vs-grep: N/A — no literal-string grep step (the KO-site pin is a test).
- §19 Bridge staleness: N/A — no repo-state summary; the baseline hash is re-recorded at commit.
- §20 Funding: PASS (N/A with reason) — no nav, pricing or funding surface.
- §21 API catalog: PASS (N/A with reason) — no HTTP endpoint or `apps/server` library function.
- **EC-922:** 96 non-empty content lines (ceiling 100). Every required section is present, and Locked Values match the WP RS
  strings. The arena-client + dashboard `typecheck` gates were added to Before Starting / After Completing after round 1 and
  mirrored into WP Verification Step 6 and the DoD.
- **Overall:** FAIL → PASS after the two fixes (Risk Tier line; app typecheck gates).
