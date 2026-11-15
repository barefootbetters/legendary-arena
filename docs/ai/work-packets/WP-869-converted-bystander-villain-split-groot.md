# WP-869 — Stack cards enter the City as Villains: Groot from Planet X's Splintered Half-Groots and the S.H.I.E.L.D. Elite Officers (Game Engine + card data)

**Status:** Done 2026-11-07 (EC-907 `EC-907:`; **D-24814 Active**; drafted #3195; pre-flight READY TO EXECUTE, copilot PASS, 00.3 PASS; inline amendments in §Execution Amendments)
**Layer:** Game Engine (one villain primitive with a fire-site bridge at the Fight and Ambush sites, two converted-villain origins,
their fight cost, defeat routing and setup display, one narrative clause) + card data
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay logic (City entry, escape, defeat routing, scoring of a rescued Bystander); no UIState field, no
client, auth, money, persistence or server surface
**Hard-deps:** WP-513 / D-24324 (the `G.convertedVillainOrigins` overlay) ✅, WP-823 / D-24756 (a converted Officer is gained as the
`SHIELD_OFFICER_EXT_ID` token on defeat) ✅, D-24668 (setup-time display names for converted cards) ✅, WP-542 / D-24351 (the
executor-no-op plus fire-site bridge at the Fight and Ambush sites) ✅, D-24703 (the Ambush narrative names a bridged effect) ✅,
WP-757 / D-24587 (`resolveVillainEscape`) ✅, D-24656 (the rulebook escape procedure) ✅, WP-252 / D-24023 (parameterized villain
primitives) ✅, D-24266 (the `unmarked-ability` hollow breadcrumb) ✅

## Goal

In operator match `OZLV05npDB8` (2-player, Fin Fang Foom, 2026-11-06) Groot from Planet X's Fight logged an `unmarked-ability`
hollow and did nothing. After this WP:

- **Groot from Planet X** (chmp, Monsters Unleashed), Fight: "Two Bystanders from the Bystander Stack enter the city as 3 Attack
  'Splintered Half-Groot' Villains. When you fight one, rescue it as a Bystander." Two Bystanders leave the Bystander Stack and
  enter the City one after the other at the Sewers, each a 3-Attack Villain named "Splintered Half-Groot". Fighting one puts a
  Bystander in your Victory Pile, counted as a rescued Bystander. One that escapes is an escaped Villain.
- **Agent Gabe Jones** (cvwr, S.H.I.E.L.D. Elite), Fight, and **Agent Eric Marshall** (cvwr, S.H.I.E.L.D. Elite), Ambush: "A
  S.H.I.E.L.D. Officer enters the city as a 3 Attack Villain. When you fight it, gain it as a Hero." One Officer leaves the
  S.H.I.E.L.D. Officer Stack and enters the Sewers as a 3-Attack Villain. Fighting it puts the S.H.I.E.L.D. Officer Hero in your
  discard pile.

## User-Visible Impact

`play.legendary-arena.com`: after fighting Groot from Planet X, two "Splintered Half-Groot" cards (Bystander art) stand in the City
at 3 Attack and the log and fight overlay say so; fighting one adds a Bystander to the Victory Pile and the log reads "rescued 1
bystander(s)". After Agent Eric Marshall's Ambush or Agent Gabe Jones's Fight, a 3-Attack S.H.I.E.L.D. Officer stands in the Sewers;
fighting it puts the Officer in your discard pile. The hollow-effects panel stops listing these three lines. Live-on-surface is
operator-pending (D-24026).

## Assumes

- Baseline `origin/main` `82d8c0e8` (2026-11-06: reserve #3195, then WP-866 `03867810`, which touched only hero files, then the
  docs-only WP-871 reserve #3197); re-record at execution. `pnpm -r build` exits 0; game-engine `test` is green at the count in
  §Verification Steps.
- **Sibling drafts, not dependencies:** WP-864 (Demolish, drafted) and WP-868 (#3192, drafted) append villain primitives, edit
  `villainEffects.execute.ts`, the marker map and the feeds, and WP-868 adds its reenter-the-Sewers bridge at the end of `defeatCityVillainCore`,
  after the Endless Armies block: the same insertion point as this WP's Fight bridge. Tail order is locked: WP-868's reenter bridge,
  then this WP's stack bridge (no card carries both, so only the text order matters). Whichever executes later rebases, appends its
  primitive after whatever is last at HEAD, and regenerates. WP-871 (reserved #3197) adds an "already defeated another Villain this
  turn" fight gate; defeating a converted Half-Groot or Officer is defeating a Villain, which WP-871 should note. No scope change here.
- **Overlay:** `ConvertedVillainOrigin` (`types.ts` ~73) is `'killbot' | 'skrull' | 'shield-officer' | 'micro-sized'`;
  `G.convertedVillainOrigins?` (~2830) is lazy and keyed by a unique card id. Every converted card is typed `'villain'` in
  `G.villainDeckCardTypes` so the City, fight and escape paths treat it as a Villain; Secret Invasion writes that type at runtime
  (`rules/schemeTwistResolvers.ts` ~768), the precedent this WP follows. `buildUIState` reads the City card `type` from
  `G.villainDeckCardTypes` (`ui/uiState.build.ts` ~943, `'unknown'` when absent) and `fightCost` from `resolveFightPrice` (~966).
- **Stacks are tokens:** `G.piles.bystanders` and `G.piles.officers` hold identical `'pile-bystander'` / `'pile-shield-officer'`
  ids (`setup/pilesInit.ts`: `BYSTANDER_EXT_ID`, `SHIELD_OFFICER_EXT_ID`); the top is index 0 (D-21501, `applyRescueOnFight` in
  `moves/fightVillain.ts` ~508). A token id cannot carry an overlay entry (every copy would convert), so a stack card entering the
  City needs its own unique id (RS-2).
- **Display:** `G.cardDisplayData` is "built at setup, read-only at runtime" (`types.ts`). Both tokens have entries
  (`setup/buildCardDisplayData.ts` ~832, ~868). Converted cards get theirs at setup beside `applyKillbotDisplayNames` and
  `applyBrainwashedOfficerDisplay` (`setup/buildInitialGameState.ts` ~574-577). `G.villainAbilityHooks` is built at ~935 by
  `buildVillainAbilityHooks`; each hook's `cardId` is the villain instance id (`villainCardInstanceExtIds`, `<set>-villain-<group>-
  <card>-<NN>`), matched exactly by `getVillainHooksForCard`.
- **Fight cost:** `resolveBaseFightCost` (`economy/economy.resolve.ts` ~363) checks each converted origin first, before the
  `cardStats` guard (a converted card has no `cardStats` row). `isHydraVillainCard` (`economy/villainVariableAttack.logic.ts` ~60)
  already returns false for any converted card.
- **Defeat:** `defeatCityVillainCore` (`moves/fightVillain.ts` ~559) routes by origin at ~595-625 (Micro-Sized, Skrull, Officer:
  `SHIELD_OFFICER_EXT_ID` to the discard and the overlay entry deleted), else to the Victory Pile; it measures `bystandersRescued`
  as the Victory Pile growth after that routing (~628, ~678), pushes `fightResolved` with `composeFightNarrative`, then runs the
  Endless Armies of HYDRA bridge (~748), which builds `{ random: shuffleContext.random, ctx: { currentPlayer, turn:
  readTurnNumber(ctx) } }` and uses `DEFAULT_IMPLEMENTATION_MAP`. Every defeat path (a fight, Silent Sniper) runs this core.
- **Ambush site:** `performVillainReveal` (`villainDeck/villainDeck.reveal.ts` ~337-419) pushes the revealed Villain into the City,
  runs `executeVillainAbilities(..., 'onAmbush', ...)`, reads The Leader's count with `villainCardPlaysVillainDeckCards` (~391)
  before pushing `ambushResolved` with `composeAmbushNarrative(name, results, playCount)` (`events/notableEvents.compose.ts` ~416),
  then plays (~416). The `RevealContext` and `implementationMap` are in scope there. `resolveVillainEscape(G, context,
  implementationMap, escapedCardId)` (~598) is the full escape procedure; `pushVillainIntoCity(G.city, cardId)`
  (`board/city.logic.ts` ~56) places at space 0 and returns the escaped card.
- **Executor:** keyword-less primitives produce no `VillainEffectResult` (`descriptorToLegacyKeyword` is undefined, ~253), so a
  bridged effect reaches a narrative only through a clause the fire site adds (D-24703). A handler that mutates nothing joins
  `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (~835) or its trace mislabels `fired`. `villainCardPlaysVillainDeckCards` (~1975) is the
  predicate template.
- **Scoring:** a `'pile-bystander'` in a Victory Pile counts as a Bystander everywhere (`isBystanderCard`, `scoring/scoring.logic.ts`
  ~43); the Killbot rule (rules v23 "Bystanders that become Villains": they "count as Bystanders in your Victory Pile, not
  Villains") and the v23 note on Schemes that turn Bystanders into Villains ("When you fight one, rescue it as a Bystander") are
  met by routing the token, not the converted id. An escaped converted card is an escaped Villain (`isVictoryPileBystander` note).
- **Danger meter:** `escapedConvertedKind` (`rules/schemeLossProgress.ts` ~351) is an exhaustive `switch` over the origin union; a
  new origin fails to compile until it has a case.
- **Primitives:** `VILLAIN_EFFECT_PRIMITIVES` (`rules/villainAbility.types.ts`) ends at position 39, `hq-hero-gains-size-changing`,
  at draft. The parser arm template is `play-villain-deck-cards` (`setup/villainAbility.setup.ts` ~821); the marker script's copy
  and `isValidParameterizedEffectToken` are `scripts/convert-cards/apply-effect-markers.mjs` ~189-228, ~319, ~440. Groot, Gabe
  Jones and Eric Marshall have no entry in the marker map or its `_unassigned` list.
- **Fixtures:** no sentinel, golden or replay fixture names `chmp/monsters-unleashed` or `cvwr/shield-elite`. The only sentinel is
  `sentinel-core-doom-2p`; the unit tests that use the chmp group (`sizeChangingGrant`, `buildFightSizeChanging`, `clashMonsterPit`,
  `schemeTwistResolvers`, `villainPrimitiveMarkerSweep`) pin no hash; `gauntletLoadouts.generated.ts` lists both groups but
  `data/par` holds no artifact for them.
- **Logs:** `formatCardRef` renders `Name (ext-id)` (`log/logDisplay.ts` ~185-193), the house log convention; the overlay
  narratives use the display name alone.
- **No-Ambush entry helper:** `enterCityIgnoringAmbush` (`villainDeck/villainDeck.enterCity.ts` ~40-58) chains
  `pushVillainIntoCity` and `resolveVillainEscape` with a fixed "exorcised" log line, and imports from `villainDeck.reveal.ts`.

## Context (Read First)

- **Read first:** `docs/ai/ARCHITECTURE.md` §The Rule Execution Pipeline, §The Move Validation Contract, §Zone & Pile Structure;
  `.claude/rules/architecture.md` §Zone Contents and §Layer Boundary; in `docs/ai/DECISIONS.md` D-24023, D-24266, D-24324,
  D-24119, D-24351, D-24587, D-24656, D-24668, D-24703, D-24756, D-24805; `docs/legendary-universal-rules-v23.md` ~2337 ("Bystanders
  that become Villains") and ~2764 (Bystanders turned into Villains: "When you fight one, rescue it as a Bystander");
  `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 and §5; `docs/ai/REFERENCE/00.6-code-style.md`.

WP-868 split Groot out because it needs a new converted-villain origin with its own defeat and escape routing. The engine has four
such origins, all converted at setup from Villain Deck cards. Groot's Half-Groots are made mid-game from the Bystander Stack, whose
cards share one token id. So this WP adds runtime conversion of a stack card into a uniquely-named City Villain.

**Siblings: included.** Agent Gabe Jones's Fight and Agent Eric Marshall's Ambush print the same effect on the S.H.I.E.L.D. Officer
Stack: a stack card enters the City as a 3-Attack Villain and, when fought, goes home (a rescued Bystander, or a gained Officer
Hero, the D-24756 routing). One primitive parameterized by stack covers all three lines at one marker line and a few test rows each;
leaving the two cvwr lines unmarked would keep known hollows on the exact primitive this WP builds. Eric Marshall's Ambush needs the
same bridge at the Ambush site (the WP-542 The Leader precedent), so the cost is one more call site.

**Out, and why:** Maria Hill's Master Strike and her Rapid Response Team / Declare Martial Law tactics print Officer entries too, but
they run on the Master Strike resolver and the tactic Fight path, not the villain executor; they can reuse this origin and bridge in
a follow-up. Sharon Carter's Fortify ("an extra one becomes a Villain") and Maria Hill's fight restriction are separate mechanics.
The scheme-twist lines (Giant Ant, Hypno-Thrall, Smuggler) are scheme resolvers.

### RS-1 — Primitive and grammar (default locked)

Primitive `stack-cards-enter-city-as-villains`, grammar `stack-cards-enter-city-as-villains:<bystander|officer>:<N>[:<name>]`
(3 or 4 colon-parts with the primitive; N a positive integer → `magnitude`; kind → new descriptor field `stackVillainKind`; the
optional `name` token → new field `stackVillainName`; it must match `/^[a-z0-9]+([_-][a-z0-9]+)*$/`, else the token is
unparseable). The display name comes from the token alone, with no engine name map: `_` separates words, `-` stays a hyphen, and
every word and hyphen segment is capitalized, so `splintered_half-groot` → "Splintered Half-Groot" (`stackVillainDisplayName`). The handler is a deliberate no-op (`{ targets: [] }`, no log) listed in `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`. A
predicate `villainCardStackVillainEntry(G, cardId, timing)` beside `villainCardPlaysVillainDeckCards` returns the first matching
descriptor's `{ kind, count, nameToken }` (`nameToken: string | null`) or `null`. The parser sets `stackVillainName` only when the
fourth part exists.

### RS-2 — Unique ids, minted at setup (default locked)

A new module `rules/stackVillain.logic.ts` owns the ids (pure except `applyStackVillainDisplay`, which mutates the setup-local
`cardDisplayData` before `G` exists). A villain instance carries at most one stack-villain descriptor (a test sweeps the committed
hooks); a future card with two would need the id to include the timing. That descriptor owns exactly `count` ids,
`stackVillainExtId(sourceCardId, index)` = `stack-villain-<sourceCardId>-<NN>` (NN two-digit, 00..count-1). At setup
`applyStackVillainDisplay(cardDisplayData, villainAbilityHooks)` gives each id a fresh copy of the stack token's display entry with
its own `extId` (and, with a name token, the derived `name`). The hooks are built once into a local const before the display calls
and that same value goes into `G`. A match with no marked card gains no entry, so its `G` and every hash are unchanged. An id is
free while it has no overlay entry; when the effect fires it takes the free ids in index order. One copy of a card can therefore
have at most `count` of its converted cards in the City or the Escape Pile at once (they are not freed by escaping). A defeated one
frees its id.

### RS-3 — City entry bridge (default locked)

`enterStackCardsAsVillains(G, context, implementationMap, sourceCardId, entry, timing)` in `villainDeck/villainDeck.reveal.ts`, beside
`resolveVillainEscape`. It does not live in `villainDeck.enterCity.ts`: that module imports `reveal.ts`, so the Ambush call site in
`reveal.ts` would close an import cycle. It does not call `enterCityIgnoringAmbush`, whose fixed log line says "exorcised". For each of `count` cards, in order:
(1) an empty stack logs the shortfall and stops; (2) no free id logs the shortfall and stops (nothing leaves the stack); (3) remove
the stack's index-0 token; set `G.convertedVillainOrigins[id]` (`'bystander-stack-villain'` or `'officer-stack-villain'`,
materializing the map if absent) and `G.villainDeckCardTypes[id] = 'villain'`; `pushVillainIntoCity`; log the entry; run
`resolveVillainEscape` on any pushed-out card. Entering is not a reveal: no Ambush and no `onCardRevealed` hook.
Fight site: at the end of `defeatCityVillainCore`, after the Endless Armies block (and after WP-868's reenter bridge if it has
landed), with a `RevealContext` built exactly as that block
builds one and `DEFAULT_IMPLEMENTATION_MAP`. Ambush site: in `performVillainReveal`, after The Leader's play block, with the reveal's
own context and map. The fire site computes the entry count before pushing its event (`min(count, stack length, free ids)`) for the
narrative clause (RS-6).

### RS-4 — Fight cost (default locked)

Both origins attack for `STACK_VILLAIN_ATTACK = 3` (every marked line prints 3), checked overlay-first in `resolveBaseFightCost`
beside the Officer branch. A marked line printing another Attack is out of contract: a test asserts every marked line's text
contains `3[icon:attack]`, so a future marking fails loudly and adds an Attack parameter instead.

### RS-5 — Defeat and escape routing (default locked)

In `defeatCityVillainCore`'s origin routing: `'bystander-stack-villain'` pushes `BYSTANDER_EXT_ID` to the defeating player's Victory
Pile, deletes the overlay entry, and adds 1 to `bystandersRescued` through a `stackBystandersRescued` count (so the existing "rescued N bystander(s) from <card>" log line
and the `fightResolved` count include it; any Bystanders it had captured are awarded as usual). `'officer-stack-villain'` pushes
`SHIELD_OFFICER_EXT_ID` to the discard, deletes the overlay entry, logs the D-24756 gain line, and turns on the narrative's gain
clause. The converted id itself never enters a Victory Pile or discard. Escape is the standard procedure (counter, Escape Pile, the
D-24656 HQ KO owed, carried Bystanders); the converted id stays in the Escape Pile with its overlay entry and counts as an escaped
Villain, never a lost Bystander or Officer. It has no Escape effect (no hooks). `escapedConvertedKind` returns `'escaped-pile'` for
both new origins (the Micro-Sized precedent). Brainwash the Military reads only `'shield-officer'`, so its +Twist Attack, Twist 7 and
escaped-Officer loss do not see these Officers (recorded, not changed).

### RS-6 — Log and narrative (default locked)

Bridge lines follow the house `Name (ext-id)` log convention (`<src>` = `formatCardRef(G.cardDisplayData, sourceCardId)`, `<villain>` = the same for the converted id, `label` =
`Fight` / `Ambush`, `<stack>` = `Bystander Stack` / `S.H.I.E.L.D. Officer Stack`): entry `${label} effect: <villain> enters the city
from the <stack> (<src>).` (`threat`); empty stack `${label} effect: the <stack> is empty, so ${entered} of ${count} entered the city
(<src>).` (`blocked`); no free id `${label} effect: no unused card remains, so ${entered} of ${count} entered the city (<src>).`
(`blocked`). New `composeStackVillainEntryClause(entryCount, villainName)`: 1 → `<villainName> enters the city`, more →
`<n> <villainName> Villains enter the city`. `composeFightNarrative` and `composeAmbushNarrative` each gain an optional last
`stackVillainClause?: string`, appended as one more clause; absent, both are byte-identical. `villainName` is the display name of
the first id the effect will take. Narratives carry display names only, never a converted id.

### RS-7 — Markers (default locked)

| Primitive token | Set / group / card | Timing |
|---|---|---|
| `stack-cards-enter-city-as-villains:bystander:2:splintered_half-groot` | chmp `monsters-unleashed/groot-from-planet-x` | fight |
| `stack-cards-enter-city-as-villains:officer:1` | cvwr `shield-elite/agent-gabe-jones` | fight |
| `stack-cards-enter-city-as-villains:officer:1` | cvwr `shield-elite/agent-eric-marshall` | ambush |

Three lines, two set files.

## Scope (In)

- **Primitive** (`rules/villainAbility.types.ts`, a contract file, D-24814): one union member and array entry appended last;
  descriptor fields `stackVillainKind?: 'bystander' | 'officer'`, `stackVillainName?: string`.
- **Parser** (`setup/villainAbility.setup.ts`): the RS-1 grammar arm.
- **Executor** (`villain/villainEffects.execute.ts`): the no-op handler, its table entry and no-op set entry; the exported predicate
  `villainCardStackVillainEntry`.
- **Origins** (`types.ts`, D-24814): `ConvertedVillainOrigin` gains `'bystander-stack-villain' | 'officer-stack-villain'`.
- **New `rules/stackVillain.logic.ts`:** `STACK_VILLAIN_ATTACK`, `STACK_VILLAIN_NAME_PATTERN`, `stackVillainDisplayName`,
  `stackVillainExtId`, `listFreeStackVillainIds`, `applyStackVillainDisplay`. No boardgame.io. (The kind → origin choice and the
  origin test are written inline at their one call site each, per 00.6.)
- **Setup** (`setup/buildInitialGameState.ts`): hoist the hooks; call `applyStackVillainDisplay`.
- **Fight cost** (`economy/economy.resolve.ts`), **defeat routing + Fight bridge call** (`moves/fightVillain.ts`), **bridge + Ambush
  call** (`villainDeck/villainDeck.reveal.ts`), **danger-meter cases** (`rules/schemeLossProgress.ts`), **narrative clause**
  (`events/notableEvents.compose.ts`).
- **Data:** the marker script's primitive list and grammar arm (the same name-token pattern as the engine); the three marker entries; regenerated `chmp.json`, `cvwr.json`.
- **Coverage:** `mechanic-provenance.json` row → `{ wp: "WP-869", decision: "D-24814" }`; pending `live-verify.json` rows (Groot,
  Gabe Jones, Eric Marshall); regenerated feeds as in §Verification Steps.
- **Tests** (hooks from the real parser on the committed card JSON, the `hero/amwpWaspSizeChanging.test.ts` precedent), new
  `villain/stackVillain.test.ts`:
  - Groot's Fight through `defeatCityVillainCore`: two tokens leave `G.piles.bystanders`; City spaces 0 and 1 hold the two ids
    (index 01 at space 0); each has the overlay entry, type `'villain'`, `resolveFightCost` 3, display name "Splintered Half-Groot";
    `buildUIState` shows each City card with `type: 'villain'` and `fightCost: 3`; the `fightResolved` narrative carries
    "2 Splintered Half-Groot Villains enter the city" and no `stack-villain-` text; the no-op trace reads `no-op`; the exact entry
    line (`Fight effect: Splintered Half-Groot (stack-villain-…-01) enters the city from the Bystander Stack (Groot from Planet X
    (chmp-villain-monsters-unleashed-groot-from-planet-x-00)).`) is logged with outcome `threat`.
  - A one-card stack: one enters plus the empty-stack line; an empty stack: none, nothing moves, and the `fightResolved` narrative
    equals `composeFightNarrative` without the clause.
  - A full City, driven through Eric Marshall's Ambush with four other cards already in the City: the Officer's entry pushes the
    Bridge card through the escape procedure (Escape Pile, counter + 1). (Groot's first entry can never escape: the defeat empties
    his space first.)
  - Fighting a Half-Groot: the Victory Pile gains `'pile-bystander'`, the overlay entry is gone, the converted id is in no zone,
    `bystandersRescued` is 1 (2 with one captured Bystander), and `computeFinalScores` counts it as a Bystander.
  - An escaped Half-Groot: the Escape Pile holds the converted id with its overlay entry; `isBystanderCard` is false.
  - Re-firing while both ids are in use: the no-free-id line, the stack unchanged. After one is defeated, re-firing takes that id.
  - Gabe Jones's Fight: one Officer token leaves `G.piles.officers`, a 3-Attack converted Officer is at space 0; fighting it puts
    `'pile-shield-officer'` in the discard (not the Victory Pile) and the narrative has the gain clause.
  - Eric Marshall's Ambush through `performVillainReveal`: Eric enters, then the Officer, so the Officer is at space 0 and Eric at 1;
    the `ambushResolved` narrative names the Officer entry, not "no Ambush effect".
  - Setup: `buildInitialGameState` for a Monsters Unleashed match seeds exactly two `stack-villain-` display entries; a match
    without a marked card has none.
  - Parser: each marked line parses from the committed JSON; `...:wound:1`, `...:bystander:0`, `...:bystander:2:-groot`
    land in `unresolvedMarkers`; `stackVillainDisplayName('splintered_half-groot')` is "Splintered Half-Groot"; every marked line's text contains `3[icon:attack]` (RS-4); the officer descriptors have
    no `stackVillainName` key (`Object.hasOwn`); no committed villain instance carries two stack-villain descriptors; the marker
    script's text contains `STACK_VILLAIN_NAME_PATTERN.source` (the two grammar copies cannot drift).
  - `events/notableEvents.compose.test.ts`: the clause in both narratives; both byte-identical without it.
  - Pins: `rules/villainAbility.types.test.ts` list, lengths, last-entry assert, count strings and `// why:` comments.
  - Expected unchanged: every `finalStateHash` sentinel and golden hash.

## Out of Scope

- Maria Hill's Master Strike, Rapid Response Team and Declare Martial Law; Sharon Carter's Fortify Escape; Maria Hill's fight
  restriction; S.H.I.E.L.D. Clearance; the scheme-twist conversions (Giant Ant, Hypno-Thrall, Smuggler, Possessed Psychotics).
- Brainwash the Military reading the new Officer origin (RS-5); an Attack parameter on the primitive (RS-4).
- "When you rescue this Bystander" effects: the Bystander Stack holds generic tokens with none.
- Any UIState field, arena-client change, new move, pending queue, server change or `replay/replay.execute.ts` change.
- WP-864 / WP-868 lines; Orrgo and Squirrel Girl.

## Files Expected to Change

- Engine source (modified unless noted): `packages/game-engine/src/types.ts`, `rules/villainAbility.types.ts`,
  `setup/villainAbility.setup.ts`, `villain/villainEffects.execute.ts`, `rules/stackVillain.logic.ts` (**new**),
  `setup/buildInitialGameState.ts`, `economy/economy.resolve.ts`, `moves/fightVillain.ts`, `villainDeck/villainDeck.reveal.ts`,
  `rules/schemeLossProgress.ts`, `events/notableEvents.compose.ts`.
- Data: `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`; generated
  `data/cards/chmp.json`, `data/cards/cvwr.json`.
- Generated / provenance: `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/hero-effect-coverage.baseline.json` (only if it moves), `scripts/coverage/mechanic-provenance.json`,
  `docs/ai/coverage/live-verify.json`; `apps/dashboard/src/data/in-play-hollow-baseline.json` and
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` only if the in-play pin moves (other dashboard data copies are
  gitignored).
- Tests: new `packages/game-engine/src/villain/stackVillain.test.ts`; modified `rules/villainAbility.types.test.ts`,
  `events/notableEvents.compose.test.ts`.
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24814), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file: no diffs, no snippets. ESM only, Node v22+, human-style code; see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness, clocks or I/O; the stack top and free-id order are fixed. `for` loops; no `.reduce()`, no nested
  ternaries. Moves and handlers never throw.
- Zones hold `CardExtId` strings only. All new `G` state is lazy: overlay and type entries appear only when the effect fires, display
  entries only when a marked card is in the match.
- Card data changes only through the marker sources plus a reproducible regen (`cards:check`); never hand-edit generated card JSON.
  No per-card special-casing in the engine: the effect and the display name both come from the marker.
- Tests use `node:test` and `node:assert` only; no `boardgame.io` import. Optional fields are written only when present
  (`exactOptionalPropertyTypes` is on in the engine), never as `undefined`.

**Session protocol:** STOP and ask on any unclear item. STOP and report if any `finalStateHash` sentinel or golden hash moves; if the regen changes a card file other
than `chmp.json` / `cvwr.json`; or if a Killbot, Skrull, Brainwash Officer or Micro-Sized test changes behavior.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- Villain primitive `stack-cards-enter-city-as-villains`, appended last; descriptor fields `stackVillainKind`, `stackVillainName`.
- `ConvertedVillainOrigin` adds `'bystander-stack-villain'`, `'officer-stack-villain'`.
- `rules/stackVillain.logic.ts` exports (RS-1 / RS-2 / RS-4); `villainCardStackVillainEntry(G, cardId, timing)`;
  `enterStackCardsAsVillains(G, context, implementationMap, sourceCardId, entry, timing)`; `composeStackVillainEntryClause`.
- `composeFightNarrative` / `composeAmbushNarrative` gain one optional trailing parameter; `defeatCityVillainCore`,
  `performVillainReveal`, `resolveVillainEscape` and `resolveFightCost` keep their signatures.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation).
- **No conflict:** printed abilities that do nothing today resolve as printed, following the rulebook's Bystanders-as-Villains notes.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched; these are printed card abilities and nothing is bought.
- **Determinism preservation:** no randomness; all new state is a pure function of `G` and lazy. Pre-WP-869 matches replay
  byte-identically: the faithful replay re-runs the stored `initialState + log` (D-24119), whose `villainAbilityHooks` and
  `cardDisplayData` carry no stack-villain descriptor or entry. Only matches created after the deploy get the behavior.

## Funding Surface Gate

N/A: no nav, pricing or funding surface.

## API Catalog Update

N/A: no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. After Groot from Planet X is defeated, two Bystanders leave the Bystander Stack and stand in the City as 3-Attack "Splintered
   Half-Groot" Villains (fewer, with a log line, when the stack is short); a pushed-out card goes through `resolveVillainEscape`
   (Escape Pile, escape counter + 1).
2. Fighting a Half-Groot puts a Bystander in the Victory Pile, counted in `bystandersRescued`, the rescue log line and final
   scoring as a Bystander; an escaped one is an escaped Villain.
3. After Agent Gabe Jones's Fight or Agent Eric Marshall's Ambush, one S.H.I.E.L.D. Officer stands in the Sewers at 3 Attack;
   fighting it puts the S.H.I.E.L.D. Officer Hero in the discard pile.
4. The log names each entry in the house `Name (ext-id)` form; the `fightResolved` / `ambushResolved` narratives name it by display
   name only (no `stack-villain-` text); no raw primitive token appears in either.
5. `cards:check` reproduces the card data; the villain ledger lists the three lines as executable; every feed `:check` exits 0.
6. Engine, arena-client and dashboard suites green; `pnpm -r build` exits 0; `finalStateHash` sentinels unchanged.

## Verification Steps

Regenerate, in this order, after the engine change builds:

- Add the provenance row and pending `live-verify.json` rows first.
- `node scripts/convert-cards/apply-effect-markers.mjs`: exits 0; `git status --porcelain data/cards` lists exactly `chmp.json`
  and `cvwr.json`.
- `pnpm -r build`: exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:villains`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`, `pnpm sim:coverage --check`
  (`--update-baseline` only if it reports a move), `pnpm --filter @legendary-arena/dashboard prebuild:coverage`: each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test`: green. Draft baseline 6455 (below); record the exact delta and expect at
  least +15.
- `pnpm --filter @legendary-arena/arena-client test` (no change expected; it consumes the engine build) and
  `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm cards:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`,
  `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`, `pnpm cards:count-markers:check`.
- At govern-close: `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
  `node scripts/check-number-ledger.mjs --check`.

Draft baseline (`03867810`, observed by the pre-flight run after `pnpm -r build`): game-engine `test` 6455 / 6455 pass, 0 fail;
`git status` clean after the build.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine, arena-client and dashboard suites green; `pnpm -r build` exits 0.
- [ ] Generated feeds regenerated and every `:check` above green; provenance rows added.
- [ ] `finalStateHash` sentinels and golden hashes byte-unchanged.
- [ ] **Live-on-surface (D-24026):** in a match with Monsters Unleashed and S.H.I.E.L.D. Elite **created after the deploy**
      (`isMatchOlderThanServer: false`): defeating Groot from Planet X puts two 3-Attack Splintered Half-Groots in the City and the
      log names them; fighting one adds a Bystander to the Victory Pile; Agent Eric Marshall's Ambush and Agent Gabe Jones's Fight
      each put a 3-Attack S.H.I.E.L.D. Officer in the Sewers, and fighting it puts the Officer in the discard pile; Play Diagnostics
      `uiStateSnapshot` shows the converted City cards with `type: "villain"` and `fightCost: 3`. Confirmed live, or operator-pending
      in `STATUS.md` with the pending `live-verify.json` rows.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24814 → Active; `WORK_INDEX.md` checked; `EC_INDEX.md` Done; mindmap
      ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] No files outside `## Files Expected to Change` were modified; checked with `git diff --name-only origin/main...HEAD`.

## Reserved Decision (lands at execution)

D-24814: A villain line that sends stack cards into the City as Villains (Groot from Planet X's two Splintered Half-Groots from the
Bystander Stack; Agent Gabe Jones's Fight and Agent Eric Marshall's Ambush, one S.H.I.E.L.D. Officer each) is the villain primitive
`stack-cards-enter-city-as-villains:<bystander|officer>:<N>[:<name>]`, a deliberate executor no-op with a bridge at the Fight site
(end of `defeatCityVillainCore`) and the Ambush site (`performVillainReveal`), the D-24351 pattern. Stack cards are identical tokens,
so each marked villain instance owns `N` unique ids, `stack-villain-<sourceCardId>-<NN>`, whose display entries are seeded at setup
(only when a marked card is in the match) and which are converted at fire time: the overlay entry (new origins
`'bystander-stack-villain'` / `'officer-stack-villain'`) and type `'villain'` (the Secret Invasion runtime-type precedent). Both
attack for a fixed 3. Defeat sends the token home: a Bystander to the Victory Pile counted as rescued, or the Officer Hero to the
discard (D-24756); the converted id is freed. Escape is the standard procedure; the converted id stays in the Escape Pile as an
escaped Villain. A short stack, or no free id, enters as many as it can and logs the rest. Brainwash the Military reads only
`'shield-officer'`. The display name comes from the marker's name token. Pre-WP-869 matches replay byte-identically (their stored
`initialState` holds no stack-villain hooks or display entries); only matches created after the deploy get the behavior.

## Execution Amendments

- **Primitive position.** WP-868 (40-42), WP-873 (`fortify`, 43) and WP-864 (`demolish-each-player`, 44, merged while this PR was open) landed first, so the primitive is appended at position 45; the `villainAbility.types.test.ts` pins moved 44 -> 45 (`main` with WP-864 merged in at `1cd2c7e3`; the generated feeds regenerated rather than hand-merged). The Fight bridge runs after WP-868's reenter bridge, as locked.
- **Helpers.** The predicate returns an exported `StackVillainEntry` (the RS-1 `{ kind, count, nameToken }` shape, named so the bridge parameter can be typed). The clause's villain name reuses the existing exported `resolveCardDisplayName`. The Inspector's P2-4 split the bridge's per-card placement into a private `placeStackVillainInCity` (00.6 function length); the locked per-card order is unchanged.
- **01.6 post-mortem.** `docs/ai/post-mortems/01.6-WP-869-converted-bystander-villain-split-groot.md` is added at close: 01.6 makes it mandatory (two new origins, a setup-time display artifact, a new City-entry path), though `## Files Expected to Change` did not list it (the WP-873 precedent). `data/metadata/card-mechanics.json` and `docs/ai/coverage/runtime-observed-hollows.json` regenerated byte-identical and are not committed.

## Pre-flight (01.4) and Copilot (01.7)

All gates ran as independent subagents against source at HEAD `03867810`.

- **Pre-flight round 1:** NOT READY, two PS items, both folded: (PS-1) AC-4 claimed no converted id is shown, but `formatCardRef`
  renders `Name (ext-id)`; AC-4 now separates the house log form from the display-name-only narratives, with a no-`stack-villain-`
  narrative test; (PS-2) the WP claimed pre-WP-869 replays diverge, but the faithful replay re-runs the stored `initialState`
  (D-24119), so they are byte-identical. RS 1-6 folded: the 6455 baseline and the WP-871 note; the full-City test driven through
  Eric Marshall's Ambush; why the bridge lives in `reveal.ts`; the locked tail order after WP-868's bridge; the display name
  derived from the marker token (no engine name map); the widened fixture sentence. Empirical scaffold not required (not
  validation-tightening).
- **Copilot round 1:** RISK (HOLD), seven fixes, all folded: optional fields written only when present
  (`exactOptionalPropertyTypes`); at most one stack-villain descriptor per instance, with a sweep test; the exact entry log line and
  the empty-stack narrative pinned; one exported name pattern with a script-parity test; the stale `countSetupSchemeTwists` comment;
  the purity wording; the Contract cross-reference.
- **Lint round 1:** FAIL §16.3 (a locked boolean not named is/has/can), folded as the `stackBystandersRescued` count; advisories
  folded (`node:test` / `node:assert` only, STOP-and-ask, single-use helpers inlined, AC-1 / AC-6 wording, a checkable card-file
  diff, EC header order).
- **Round 2 (all three gates, after the folds):** pre-flight **READY TO EXECUTE**, copilot **PASS**, lint **PASS**. Every round-1
  item confirmed landed and WP / EC consistent on every locked value. Two optional assertions the executor may add to
  `stackVillain.test.ts`: `G.convertedVillainOrigins?.['pile-bystander']` stays undefined, and neither narrative contains the raw
  primitive token.

## Lint Gate Self-Review (00.3)

- **§1 structure:** every required section present; Out of Scope names Maria Hill's cards, Fortify, the fight restriction,
  scheme-twist conversions, Brainwash interplay, rescue triggers, sibling WPs; six binary criteria. **PASS.**
- **§2 constraints:** full-file output, ESM, Node v22+, 00.6; determinism, lazy state, marker-only data, `exactOptionalPropertyTypes`;
  STOP-and-ask plus three STOP triggers; locked values → EC. **PASS.**
- **§3 Assumes:** nine hard-deps ✅ plus every helper, type, fire-site and fixture fact with file and line, verified twice. **PASS.**
- **§4 Context:** ARCHITECTURE sections, `.claude/rules` sections, eleven D-entries, rules v23 ~2337 / ~2764, 00.2 §1.4 / §5,
  00.6; RS-1..RS-7 locked; sibling decision and the Maria Hill split justified. **PASS.**
- **§5 files:** every file with path, the new file marked; 11 engine files as one cohesive primitive (WP-862 / WP-868
  precedent); gitignored dashboard copies called out. **PASS.**
- **§6 naming:** full words (`stackBystandersRescued`, `enterStackCardsAsVillains`, `villainCardStackVillainEntry`); slugs
  verbatim; no 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new dependency; engine + data only; no UIState, client, server, registry or boardgame.io import
  added. **PASS.**
- **§9 Windows:** `pnpm` / `node` only. **PASS.** **§10 / §11:** no env var, no auth. **N/A.**
- **§12 tests:** `node:test` + `node:assert`, `.test.ts`; hooks from the real parser on committed JSON; runtime pins (D-24372);
  malformed tokens through `unresolvedMarkers`. **PASS.**
- **§13 verification:** exact regen and check commands with exits; card-file diff checkable; engine baseline 6455, +15 floor.
  **PASS.**
- **§14 / §15:** six binary criteria; DoD names governance close, the diff allowlist check and D-24026 live-verify incl.
  `uiStateSnapshot` (§15.1, operator-pending fallback). **§15.2:** `MEDIUM` verbatim in WP and EC. **PASS.**
- **§16 code-style:** reuses `pushVillainIntoCity`, `resolveVillainEscape`, the D-24756 token routing and the converted-villain
  overlay; `for` loops, no `.reduce()`, no nested ternaries; is/has/can booleans; `// why:` sites listed in the EC. **PASS.**
- **§17 Vision:** §1 / §2 / §8 / §10 / §22, no-conflict, NG-1 and determinism lines. **PASS.**
- **§18:** no literal-grep step. **N/A.** **§19:** baseline re-recorded at execution. **PASS.** Contract files
  `villainAbility.types.ts` (one appended primitive) and `types.ts` (two origins) are covered by D-24814.
- **§20 funding / §21 API catalog:** N/A, stated. **PASS.**
