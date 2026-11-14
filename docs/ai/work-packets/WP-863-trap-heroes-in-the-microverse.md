# WP-863 — Trap Heroes in the Microverse: an extra Hero's cards fight from the Villain Deck as Micro-Sized Villains (Game Engine + Registry)

**Status:** Draft 2026-11-05 (EC-901; D-24805 reserved, PR #3167)
**Layer:** Game Engine (scheme setup conversion, the fight-cost and fight-price authorities, the defeat route, one seat-choice
kind, the scheme Evil-Wins config) + Registry (one Hero-count requirement row)
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay setup, fight pricing and loss logic for one scheme; no auth, money, persistence or server surface
**Hard-deps:** WP-514 / D-24326 (the Secret Invasion Hero → Villain Deck conversion, `setup/convertHeroesToSkrulls.ts`) ✅,
WP-823 / D-24756 (Brainwash the Military: converted-origin Attack branch, "gain it as a Hero" defeat route) ✅, D-24802 (#3159,
`G.fightSizeChanging` read by `resolveFightPrice`) ✅, WP-684 / D-24501 (seat choice) ✅, WP-821 / D-24754 (Dominate the Weak:
an active-seat "Player N gains <Hero>" choice with `recipientSeat`) ✅, WP-524 / D-24337 + D-24672 (the Hero-count requirement
table) ✅, WP-763 / D-24595 (the scheme's current `pile-depleted` Villain Deck config) ✅

## Goal

The antm scheme **Trap Heroes in the Microverse** (`antm/trap-heroes-in-the-microverse`) prints:

- Setup: 11 Twists. Add all 14 cards for an extra Hero to the Villain Deck.
- Special Rules: Heroes in the Villain Deck are "Micro-Sized" Villains with Attack equal to their printed cost. They have
  Size-Changing for their card color and no other abilities while in the City. When you fight one, choose any player to gain it
  as a Hero.
- Twist: Play two cards from the Villain Deck.
- Evil Wins: When 3 Villains per player have escaped or the Villain Deck runs out.

Today only the Villain Deck runout half works: no Hero goes into the Villain Deck, a Twist does nothing, and the escape half is
stood in for by the last-twist fallback. After this WP the scheme plays as printed.

## User-Visible Impact

`play.legendary-arena.com` — the lobby asks for one more Hero for this scheme (4 solo, 6 at 2-4 players, 7 at 5). The last Hero in
the loadout is the trapped one: its cards go into the Villain Deck, never the Hero Deck or the HQ, and the log says so at setup.
When one is revealed it enters the City like any Villain, showing its own Hero card, with Attack equal to its printed cost. It
costs 2 less to fight for each of its colors the fighting player has played this turn (a dual-class card: each color is its own
2-less step). A Twist plays two cards from the Villain Deck. Fighting one: in a one-seat match it goes straight into your discard
pile; otherwise you choose "Player N gains <Hero>" (you first). Escaped Villains (Micro-Sized ones included) and the Villain Deck
both drive the danger meter, and the scheme is lost at 3 escaped Villains per player or when the Villain Deck runs out.
Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` `bf0ed909` (2026-11-05: the WP-863 reservation #3167, WP-862 #3166 and D-24803 #3164 merged); re-recorded at commit. Draft-time suites:
  game-engine 6269 / 0, registry 311 / 0 at `2166e526` (`pnpm -r build` 0); WP-862 added engine tests, so the counts are
  re-recorded at execution.
- `data/cards/antm.json` ~977-990: the scheme's `cards[0].abilities` (the four printed lines above) and `villainDeckTwistCount:
  11` (also `scripts/convert-cards/inputs/scheme-deck-counts.json` ~37). `data/metadata/scheme-twist-assignments.json` ~17 already
  classes it `chained-reveals`.
- `rules/schemeTwistConfigs.ts` ~679-686: `{ resolverId: 'counter-only', params: {}, resourceLossCondition: { kind:
  'pile-depleted', pile: 'villainDeck' }, twistFallbackWithResourceLoss: true }`. `rules/schemeTwistConfigs.test.ts` ~169-276
  lists it in `AUDIT_COMPOUND_PILES` (`'D-compound: 25 schemes …'`, entry count 25); the registry-size pin (8 + 67 + 3) counts
  entries, not resolvers.
- `chainedReveals` (`rules/schemeTwistResolvers.ts` ~278) plays `params.revealCount` cards through `performVillainReveal`,
  stopping when the deck and its discard are both empty, and emits one `schemeTwistResolved`.
- `setup/convertHeroesToSkrulls.ts`: the WP-514 precedent — a pure passthrough for every other scheme (no new random draw); the
  converted cards typed `'villain'` in `villainDeckCardTypes`, tagged in `convertedOrigins`, injected and re-shuffled by ONE
  `context.random.Shuffle`. Called at `setup/buildInitialGameState.ts` ~699, after `buildHeroDeck` (~633) and before
  `splitMonsterPitFromVillainDeck` (~711), `fillHqFromDeck` (~716) and `resolveSchemeLossVillainDeckSetupSize` (~742, sized
  from `monsterPitSplit.villainDeckState.deck.length`).
- `setup/buildHeroDeck.ts` `buildHeroDeckCards(heroDeckIds, registry)` (~596, exported): unshuffled instance ids, transform cards
  and split-card alternate faces skipped (one id per physical card). Instance ids are copy-unique
  (`${setAbbr}/${heroSlug}/${cardSlug}#${copyIndex}`).
- In `buildInitialGameState`, `cardStats`, `cardTraits`, `cardDisplayData`, `heroAbilityHooks` and the Size-Changing snapshots are
  built from `config.heroDeckIds` / `villainBuildConfig` (all listed Heroes); `effectiveHeroDeckIds` (~628) feeds `buildHeroDeck`,
  `buildTransformSideDeck`, `buildTransformTargets`, `buildSplitFaces` and `buildSplitFaceAlternateOnLeft`. Setup strings pushed
  to `setupMessages` become the opening `G.messages` (~798, outcome `neutral`).
- `state/cardTraits.types.ts`: `CardTraitEntry { heroClass: string | null; heroClass2?: string | null; team }`.
- `types.ts` ~71: `ConvertedVillainOrigin = 'killbot' | 'skrull' | 'shield-officer'` (no canonical array). Exhaustive switch:
  `escapedConvertedKind` (`rules/schemeLossProgress.ts` ~352). Other readers branch on a named origin
  (`economy.resolve.ts`, `fightVillain.ts`, `scoring.logic.ts`, `clashMonsterPit.logic.ts`, `resolveVictoryPileCardPick.ts`,
  `brainwashTheMilitary.logic.ts`) or on "any origin" (`villainVariableAttack.logic.ts` ~60, `countEscapedCapturedHeroes`).
- `economy/economy.resolve.ts` `resolveBaseFightCost` (~363): overlay-first origin branches (Killbot, Skrull = cost + 2, Officer)
  before the `cardStats` guard. `resolveFightPrice` (~153) = `resolveFightCost` then `applyFightSizeChanging` (~190) reading
  `G.fightSizeChanging[cardId]`, through `applySizeChangingDiscount` (`hero/sizeChanging.logic.ts` ~246: each class one 2-less
  step when any played card has it, floored at 0, then Microscopic).
- `setup/buildFightSizeChanging.ts` returns the villain / mastermind map built at `buildInitialGameState.ts` ~527; the state
  literal spreads it only when non-empty (~976). Its keys are villain instance and mastermind face ids, disjoint from Hero ids.
- `moves/fightVillain.ts` `defeatCityVillainCore` (~557): the Skrull and Officer branches (~590-614) route the fought card to the
  defeater's discard, delete its origin and log; else Victory Pile. `composeFightNarrative`'s 4th argument (~734,
  `skrullGained || officerGained`) adds " and gained the Hero into the active player's discard pile".
- Seat choice: `SeatChoiceOption { label, cityIndex?, cardId?, recipientSeat?, sourceZone? }` (`types.ts` ~1427);
  `parkSeatChoice(G, events, choice, activePlayerToSkip?)` (`moves/seatChoice.resolve.ts` ~323); `applySeatChoiceByKind` (~527,
  also called from the timeout default ~825 with no current player); `buildDominateTheWeakChoice` / `applyDominateTheWeakGain`
  (`moves/seatChoiceTactics.ts` ~566 / ~666) is the active-seat recipient precedent (you first, then others ascending, default 0).
  A single addressed active seat needs no stage ride (D-24648). Bots keep `defaultOptionIndex` for an unlisted kind
  (`simulation/ai.seatChoice.ts`). The client renders any kind's labels.
- Resource loss: `SchemeResourceLossCondition` (`rules/schemeTwistConfig.types.ts` ~70) and `SchemeTwistConfig` (~160);
  `applyEscapedPileResourceLoss` (`rules/schemeResourceLoss.ts` ~170, called from the escape path `villainDeck.reveal.ts` ~745)
  reads only `config.resourceLossCondition`; `countEscapedPileByType`; `describeEscapedLoss` (`N Villains escaped`);
  `applyPileDepletionResourceLoss` / `isSchemeLossPile` / the setup-size resolvers read only a `pile-depleted`
  `resourceLossCondition`. The meter (`rules/schemeLossProgress.ts` `collectResourceConditions` ~370,
  `selectActiveLossCondition` ~471) already picks the highest normalised progress among several candidates.
- Registry: `SCHEME_HERO_COUNT_RULES` (`packages/registry/src/playerCountSetup.ts` ~92-140, 27 rows, `antm/age-of-ultron` the antm
  row); its comment says only the main Hero Deck is counted. Pinned by `playerCountSetup.test.ts` `EXPECTED_HERO_COUNTS_BY_SCHEME`
  (~267, 27 rows) and the exact-keys test (~314). Every enforcement site (engine `validatePlayerCountComposition`, the server
  setup-requirements route, the play lobby, the cards builder) reaches `resolveEffectiveHeroCount`.
- No `finalStateHash` sentinel (`test/fixtures/games/sentinel-core-doom-2p.replay.json`, core) uses this scheme. The weekly sweep
  (`data/sweep-fixtures/scheme-ids.full.json`, `sweep-weekly.yml`) does, on the 4-Hero solo `setup.json`: still valid after RS-2
  (3 + 1) and it traps `core/black-widow`; nothing there is hash-gated.
- The engine `HeroEntry` (`setup/buildHeroDeck.ts` ~123-140) has no `name` field and `isRegistryReader` (~335) is not exported;
  registry Hero entries carry `name` in set data (`getSet(abbr).heroes[].name`).

## Context (Read First)

- **Why the last listed Hero.** "Add all 14 cards for an extra Hero" makes the players pick a sixth Hero. The loadout's
  `heroDeckIds` is the only Hero input (`MatchSetupConfig` is locked at 9 fields), so the scheme raises the Hero requirement by one
  (the "Add an extra Hero" `add` rule) and the last-listed Hero is the trapped one. No new random draw picks it; the operator's
  order does. This amends the D-24672 note that the table counts only the main Hero Deck: a scheme whose extra Hero sits in the
  Villain Deck is counted too, because that Hero still arrives through `heroDeckIds`.
- **Why a setup-time `G.fightSizeChanging` entry.** The color Size-Changing is a fixed fact of each trapped card, so it is built
  once at setup next to the D-24802 villain entries and read by the existing `resolveFightPrice`. WP-862 / D-24804 handles
  runtime grants on HQ Heroes; this WP adds no overlay.
- **Why one WP across registry + engine.** The requirement row and the conversion must land together: without the row the lobby
  rejects the extra Hero (or the scheme converts a Hero Deck Hero); without the conversion the row asks for a Hero nobody uses.
  WP-524 shipped the same pair. The registry change is one data row plus its test.
- **Parallel work.** WP-862 (#3166) and D-24803 (#3164, henchman variant copies, which changed `buildFightSizeChanging`
  internals but not its call or result shape) are both in the baseline below. WP-863 depends on neither.
- **Determinism / hash.** Every step is a passthrough for every other scheme: the same Hero Deck shuffle input, no new random
  draw, no new `G` key. For this scheme, the Hero Deck shuffle input loses one Hero and ONE new `context.random.Shuffle` re-mixes
  the Villain Deck after the existing draws (the WP-514 placement). No sentinel uses the scheme.
- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, §Rule Execution Pipeline, Principle #1. `docs/ai/DECISIONS.md` — scan
  D-24326, D-24327, D-24756, D-24802, D-24501, D-24754, D-24648, D-24595, D-24609, D-24672 before coding.
  `docs/ai/REFERENCE/00.6-code-style.md`. `docs/ai/REFERENCE/00.2-data-requirements.md` §7 Match Configuration (`heroDeckIds`, the
  9-field lock) and §1 Card Data Shapes (`hc` / `hc2`, `cost`, a Hero entry's `name`). `docs/ai/ARCHITECTURE.md` §Layer Boundary
  and `.claude/rules/architecture.md` Layer Boundary: two layers, each changed in its own package; the engine reads the setup
  registry structurally (`getSet`), never by import.

### RS-1 — Setup (default locked)

Only for `antm/trap-heroes-in-the-microverse` with at least two `heroDeckIds`: the trapped Hero is the LAST entry of
`effectiveHeroDeckIds`; `buildHeroDeck` receives the list without it (every other builder that takes `effectiveHeroDeckIds` keeps
the full list, so a trapped card later gained and played still has its transform / split data). Its cards are
`buildHeroDeckCards([trappedId], registry)` (one id per physical card, transform cards set aside as usual). Each is typed
`'villain'` in `villainDeckCardTypes` and tagged `'micro-sized'` in `convertedOrigins`; they are appended to the Villain Deck and
the deck is re-shuffled by ONE `context.random.Shuffle`, after the Skrull conversion and before `splitMonsterPitFromVillainDeck`.
One setup message: `describeTrappedHero(heroName: string, cardCount: number): string` →
`Trap Heroes in the Microverse: <Hero name>'s <N> cards are shuffled into the Villain Deck as Micro-Sized Villains.`
`<Hero name>` comes from `readTrappedHeroName(registry: unknown, heroDeckId: string): string` in the new module: a structural
read of `registry.getSet(setAbbr)?.heroes[]` (slug match) `.name` behind a local `typeof getSet === 'function'` guard (the
`CardStatsRegistryReader` convention; no registry import), falling back to the hero deck id. Passthrough with no message when the
scheme has fewer than two Heroes or the registry has no callable `getSet` (narrow test mocks would otherwise reach
`buildHeroDeckCards`).

**Rewires in `buildInitialGameState`:** the Micro-Sized result (not the Skrull result) feeds `convertedVillainOrigins` (~707),
`hasConvertedVillains`, the `splitMonsterPitFromVillainDeck` input (~712) and `villainDeckCardTypes` (~807); the local
`fightSizeChanging` (~527) is merged with the RS-4 entries before the spread (~976). A trapped Transform Hero's second-form cards
still go to `G.transformDeck` (the full list feeds `buildTransformSideDeck`), so a gained card can Transform as printed.

### RS-2 — Hero requirement (default locked)

`SCHEME_HERO_COUNT_RULES['antm/trap-heroes-in-the-microverse'] = { kind: 'add', amount: 1, fromPlayerCount: 1 }`, placed after
`antm/age-of-ultron`: 4 / 6 / 6 / 6 / 7 Heroes at 1-5 players. The table comment gains the RS-1 sentence on a Villain Deck Hero.

### RS-3 — Attack (default locked)

`resolveBaseFightCost`: a `'micro-sized'` card's base Attack is `G.cardStats[cardId]?.cost ?? 0` (its printed cost; a split card's
primary face), checked overlay-first beside the Skrull branch. Scheme / mastermind modifiers that `resolveFightCost` adds to every
Villain apply unchanged.

### RS-4 — Size-Changing for its card color (default locked)

For each trapped card: `classes` = the distinct non-empty `heroClass`, then `heroClass2`, from `G.cardTraits` (the setup-built
`cardTraits`); `microscopicIcons: []`. A card with no class (grey) gets no entry. Entries are merged into the D-24802 map (Hero ids
never collide with villain ids) before the omit-when-empty spread. **Dual-class rule:** a dual-class card has Size-Changing for
BOTH colors, the same reading the engine already gives a printed two-class line (`Size-Changing: [hc:X], [hc:Y]`, D-24802): 2 less
if the fighter played an X card and another 2 less if they played a Y card, floored at 0. My reading — "its card color" on a
two-color card names both colors, and the engine has one meaning for a two-class Size-Changing; flagged for the operator in
D-24805 (reverting to "one 2-less step if either color was played" is a single-class entry). The trapped Hero's own printed
abilities, including any printed Size-Changing, never apply in the City.

### RS-5 — No other abilities (default locked)

Nothing is suppressed because nothing fires: Hero ability hooks run only when a Hero is played; no villain hook, keyword,
defeat requirement or variable-Attack entry is keyed by a Hero id; `villainVariableAttack.logic.ts` already skips every converted
origin. Tests assert a trapped card's reveal and fight run no ability, and that no villain hook, keyword, defeat requirement or
variable-Attack entry is keyed by a trapped card (so its escape runs none either; the engine has no general "KO a Villain from the
City" path to test).

### RS-6 — Fight: choose any player to gain it (default locked)

In `defeatCityVillainCore`, a `'micro-sized'` card: its origin is deleted and it is never put in a Victory Pile (no VP). Then:

- One seat in `G.playerZones`: it goes to the defeater's discard; log `Player N defeated <Hero> (Micro-Sized) and gained it as a
  Hero into their discard pile.` (`applied`); `fightResolved` narrative gets the gain clause.
- Two or more seats: it goes to the defeater's discard first (so the card always sits in a zone), then the defeater gets a seat
  choice, kind `'micro-sized-gain'` (`MICRO_SIZED_GAIN_SEAT_CHOICE_KIND`), addressed to the defeater only, options `Player <seat>
  gains <Hero>` with `cardId` + `recipientSeat`, the defeater first then the other seats ascending, `defaultOptionIndex: 0`;
  `parkSeatChoice(G, undefined, choice, currentPlayer)`; log `Player N chooses a player to gain <Hero> (Trap Heroes in the
  Microverse).` (`neutral`). The narrative gets no gain clause (the recipient is not decided yet).
- Two or more seats while `G.pendingSeatChoice` is already set: no park; the card stays in the defeater's discard; log `Player N
  gained <Hero> — another choice is open, so no other player could be chosen (Trap Heroes in the Microverse).` (`blocked`).

Apply (`applyMicroSizedGainResolvedSeatChoice`): the holder is `choice.addressedSeats[0]`. Recipient = holder → log `Player N gains
<Hero> (Trap Heroes in the Microverse).` (`applied`), nothing moves. Otherwise the card is removed from the holder's discard and
pushed onto the recipient's discard, same log with the recipient. Card not in the holder's discard (stale) → `<Hero> is no longer
in Player N's discard pile, so no one else gains it (Trap Heroes in the Microverse).` (`blocked`). Bot, sim and timeout keep index
0 (the defeater). `<Hero>` = `resolveCardName`. **Posture (the WP-860 / Commune guard, accepted):** the guard reads only
`G.pendingSeatChoice` (D-24761 also checks other queues; `resolveSeatChoice` is not gated by them, so no deadlock). `parkSeatChoice`
overwrites, so a later park in the same move (a later hero effect, the escape opener) drops this choice and the card stays with the
defeater; a later draw that reshuffles the discard pile turns the pick stale (the blocked log). Both leave the card in a zone.
After the gain, `villainDeckCardTypes[cardId]` stays `'villain'` (the Skrull precedent): a gained card later KO'd reads as a villain
to a KO-pile type count. **Import cycle (accepted):** `gainDefeatedMicroSizedHero` calls `parkSeatChoice` and
`seatChoice.resolve.ts` imports this module's apply; each side reads the other only inside function bodies (the
`outOfTimeGrant.logic.ts` / `enigmaCode.logic.ts` runtime-safe cycle precedent).

### RS-7 — Twist (default locked)

Resolver `chained-reveals`, `params: { revealCount: 2 }` (the shipped resolver; its own log and event lines).

### RS-8 — Evil Wins (default locked)

`resourceLossCondition` stays `{ kind: 'pile-depleted', pile: 'villainDeck' }`; `twistFallbackWithResourceLoss` is removed (both
halves are modelled, so the D-24315 suppression applies). New optional `SchemeTwistConfig.additionalEscapeLossCondition?:
Extract<SchemeResourceLossCondition, { kind: 'escaped-pile-count' }>` — the escape half of a printed "N Villains escape or <a pile>
runs out" — set to `{ kind: 'escaped-pile-count', cardTypes: ['villain', 'henchman'], threshold: 3, isThresholdPerPlayer: true }`.
New optional `isThresholdPerPlayer?: true` on the `escaped-pile-count` member: the loss count is `threshold × the number of
seats in G.playerZones` (one entry per seat, a bot ally included). `lobby.requiredPlayers` is equivalent; `G.playerZones` is chosen
because the escape path already reads it and it is always present, so the loss never depends on lobby metadata. One reader `resolveEscapedPileThreshold(gameState, condition)` (`rules/schemeResourceLoss.ts`) serves
the loss and the meter. `applyEscapedPileResourceLoss` evaluates the primary condition when it is an escape kind; when it is
`pile-depleted`, the additional one; the log is the shipped `Scheme loss triggered — N Villains escaped (threshold T).`.
`collectResourceConditions` also pushes the additional condition (kind `'escaped-pile'`, threshold resolved per player), so the
meter shows whichever of the Villain Deck and the escapes is closer. Micro-Sized Villains are typed `'villain'`, so they count.
`additionalEscapeLossCondition` is valid ONLY beside a `pile-depleted` primary: the loss reads it only there (as the meter already
does, its escape-kind branches returning early), and a `schemeTwistConfigs.test.ts` assertion pins that no entry pairs it with
another kind.

### RS-9 — Contract additions (D-24805)

`ConvertedVillainOrigin` gains `'micro-sized'` (`escapedConvertedKind` maps it to `'escaped-pile'`; no config counts it).
`schemeTwistConfig.types.ts` gains `isThresholdPerPlayer?` and `additionalEscapeLossCondition?`. No new `G` key, `UIState` field,
move, queue or client file; `SeatChoiceOption` is unchanged (`cardId` + `recipientSeat` already exist).

## Scope (In)

- **Registry** (`packages/registry/src/playerCountSetup.ts`): the RS-2 row + comment; `playerCountSetup.test.ts`: the expected
  row (`[4, 6, 6, 6, 7]`) after `antm/age-of-ultron`, count 27 → 28.
- **Contract** (`types.ts`): `'micro-sized'`. (`rules/schemeTwistConfig.types.ts`): RS-8 fields with JSDoc.
- **New module** `rules/trapHeroesInTheMicroverse.logic.ts` (no boardgame.io, no registry import, no `.reduce()`, never throws):
  `TRAP_HEROES_IN_THE_MICROVERSE_SCHEME_ID`, `MICRO_SIZED_GAIN_SEAT_CHOICE_KIND`; `splitTrappedHeroDeckId(schemeId,
  heroDeckIds, registry: unknown)` → `{ heroDeckIds; trappedHeroDeckId? }` and `listTrappedHeroCards(trappedHeroDeckId, registry:
  unknown)` (both behind ONE local `typeof getSet === 'function'` guard narrowing to the exported `RegistryReader` shape; when it
  fails the split returns the list unchanged and nothing is trapped or converted); `addMicroSizedHeroesToVillainDeck(trappedCardIds, villainDeckState,
  villainDeckCardTypes, convertedOrigins, context)` (WP-514 result shape, inputs not mutated); `buildMicroSizedFightSizeChanging(
  trappedCardIds, cardTraits)`; `readTrappedHeroName(registry, heroDeckId)` + `describeTrappedHero(heroName, cardCount)` for the setup line; `gainDefeatedMicroSizedHero(G, currentPlayer,
  cardId)` (RS-6); `applyMicroSizedGainResolvedSeatChoice(G, choice)`.
- **Setup** (`setup/buildInitialGameState.ts`): RS-1 split before `buildHeroDeck`, conversion after the Skrull step, RS-4 merge,
  the setup message.
- **Fight cost** (`economy/economy.resolve.ts`): the RS-3 branch.
- **Defeat** (`moves/fightVillain.ts`): the RS-6 branch → `gainDefeatedMicroSizedHero`; the narrative flag.
- **Seat choice** (`moves/seatChoice.resolve.ts`): one `applySeatChoiceByKind` arm.
- **Scheme config + loss** (`rules/schemeTwistConfigs.ts`, `schemeResourceLoss.ts`, `schemeLossProgress.ts`): RS-7, RS-8, RS-9.
- **Tests** (new `rules/trapHeroesInTheMicroverse.test.ts`; real `buildInitialGameState` on the committed card data where setup is
  exercised; the real `resolveSeatChoice`):
  - Setup: the last Hero's cards are all in the Villain Deck (typed `villain`, origin `micro-sized`), none in the Hero Deck or HQ;
    the other Heroes' cards are not converted; deck size = base + trapped count; the setup message; another scheme with the same
    loadout is byte-identical to before (deep-equal on the built state against a same-seed run without the change is not
    possible, so: no `micro-sized` origin, `villainDeckCardTypes` with no Hero id, Hero Deck holds every listed Hero).
  - Attack = printed cost through `resolveFightCost`; `resolveFightPrice` 2 less with a played card of its class, unchanged
    without; a dual-class card 4 less with both colors played, 2 less with one; floored at 0; a grey card no entry.
  - Defeat: one seat → discard, no Victory Pile, origin gone, log; two seats → in the defeater's discard + parked choice (labels,
    order, default 0); resolving "Player 1 gains" moves it to seat 1's discard; resolving the default leaves it; an open seat
    choice → no park, blocked log; stale option → blocked log.
  - Reveal and fight of a trapped card run no ability; nothing ability-bearing is keyed by a trapped card (RS-5).
  - `addMicroSizedHeroesToVillainDeck` leaves frozen inputs unchanged and draws nothing for an empty list (the WP-514 purity check).
  - Two same-seed setup builds give the identical Villain Deck order (a failure means a replay-breaking setup change).
  - Twist: plays two Villain Deck cards.
  - Evil Wins: 3 × seats escaped Villains (Micro-Sized ones count) → loss and log; one fewer → no loss; Villain Deck runout →
    loss; no twist-count loss at the last Twist; the meter picks the closer condition.
  - `schemeTwistConfigs.test.ts`: the scheme leaves `AUDIT_COMPOUND_PILES` (25 → 24; the D-compound and registry-size test titles
    updated — "the 67 audit entries" becomes 66 audit entries plus this scheme, the size assertion `8 + 66 + 1 + 3` (value unchanged
    at 78)) with a named assertion of its new config, and the additional-condition pairing pin (RS-8);
    `schemeResourceLoss` per-player threshold unit cases.
  Expected unchanged: every `finalStateHash` sentinel, the Secret Invasion / Brainwash / D-24802 / seat-choice tests.

## Out of Scope

- A UI marker on a City card that it is Micro-Sized, or choosing the trapped Hero in the lobby (the last listed Hero is it).
- Bot fight valuation of Micro-Sized Villains (the competent bot values fights by VP; they carry none — the WP-823 known gap).
- Other D-compound "N Villains escaped per player or a pile runs out" schemes (the new field makes each a config change; not in
  this WP).
- Hero VP / the Skrull cost proxy; any change to `buildFightSizeChanging.ts`, WP-862's HQ overlay, or `replay/replay.execute.ts`.
- Any new move, queue, `CoreMoveName`, `UIState` field, client or server file.

## Files Expected to Change

- `packages/registry/src/playerCountSetup.ts`, `playerCountSetup.test.ts` — **modified** — RS-2.
- `packages/game-engine/src/types.ts` — **modified** — `'micro-sized'` (contract file; D-24805).
- `packages/game-engine/src/rules/schemeTwistConfig.types.ts` — **modified** — RS-8 fields (contract file; D-24805).
- `packages/game-engine/src/rules/trapHeroesInTheMicroverse.logic.ts` — **new**; `rules/trapHeroesInTheMicroverse.test.ts` — **new**.
- `packages/game-engine/src/setup/buildInitialGameState.ts`, `economy/economy.resolve.ts`, `moves/fightVillain.ts`,
  `moves/seatChoice.resolve.ts`, `rules/schemeTwistConfigs.ts`, `rules/schemeResourceLoss.ts`, `rules/schemeLossProgress.ts` —
  **modified**.
- Tests: `rules/schemeTwistConfigs.test.ts`, `rules/schemeResourceLoss.test.ts` — **modified**.
- Generated feeds only if a regen moves them (expected: none; `sim:runtime-observed` reads the configs) and
  `docs/ai/coverage/live-verify.json` (a pending row).
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — the `/api/match/setup-requirements` row replaced whole (D-11804).
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24805), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets; ESM only; Node v22+; human-style code — see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: randomness only through the one `context.random.Shuffle` (RS-1); no clocks or I/O; `for` loops, no `.reduce()`,
  no nested ternaries; moves never throw; only `Game.setup()` may throw.
- Every other scheme is a passthrough: no new random draw, no new `G` key, same Hero Deck input. A moved sentinel is a STOP.
- Registry change is data only; the engine never imports the registry.

**Session protocol:** STOP and report if any sentinel moves, if a trapped card reaches the Hero Deck, HQ or a Victory Pile, if a
non-Microverse match changes setup state, or if a Micro-Sized fight price ignores `G.fightSizeChanging`.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `ConvertedVillainOrigin` `'micro-sized'`; seat-choice kind `'micro-sized-gain'` (options `cardId` + `recipientSeat`).
- `SchemeTwistConfig.additionalEscapeLossCondition?`; `escaped-pile-count.isThresholdPerPlayer?: true`.
- `SCHEME_HERO_COUNT_RULES['antm/trap-heroes-in-the-microverse']` `add 1 from 1p`.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation).
- **No conflict:** a printed scheme whose setup, Special Rules, Twist and half its Evil Wins did nothing now plays as printed.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — printed scheme rules, nothing bought.
- **Determinism preservation:** one seeded shuffle, only for this scheme; every other match serializes byte-identically. Replays
  of earlier matches with this scheme diverge on re-execution (5-Hero loadouts no longer validate, and setup changes); stored
  `competitive_scores` rows stay frozen (D-24616 §5); live-verify needs a match created after the deploy.

## Funding Surface Gate

N/A — engine + registry data only; no nav, registry-viewer, profile or funding-channel surface and no user-visible funding copy.

## API Catalog Update

No endpoint code changes, but `GET /api/match/setup-requirements` returns a new `heroCount` for this scheme: its row in
`docs/ai/REFERENCE/api-endpoints.md` is replaced whole (D-11804) — the table becomes 28 rows, the scheme is named (base + 1, the
extra Hero is the trapped one, D-24805), and `WP-863 / D-24805` joins the Authorizing column.

## Acceptance Criteria

1. The lobby, the engine and the server require base + 1 Heroes for the scheme; a base-count loadout is rejected.
2. The last listed Hero's cards are all in the Villain Deck as Micro-Sized Villains and none in the Hero Deck or HQ; other schemes
   are unchanged.
3. A Micro-Sized Villain's Attack is its printed cost, and its fight price drops 2 per color the fighter played (both colors for
   a dual-class card), floored at 0.
4. Defeating one never scores VP; one seat gains it at once; with two or more the defeater chooses the player (default themself).
5. A Twist plays two Villain Deck cards.
6. The scheme is lost at 3 × seats escaped Villains or an empty Villain Deck, never on the twist count; the meter tracks both.
7. Engine + registry + arena-client + server suites green; `pnpm -r build` 0; every feed `:check` 0; `finalStateHash` sentinels
   unchanged.

## Verification Steps

- `pnpm -r build` — exits 0; `git status` shows no unexpected generated churn.
- `pnpm --filter @legendary-arena/game-engine test`, `pnpm --filter @legendary-arena/registry test`,
  `pnpm --filter @legendary-arena/arena-client test`, `pnpm --filter @legendary-arena/server test` — exit 0; record the deltas.
- `pnpm -r --no-bail test` — whole-repo totals, 0 fail.
- `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`,
  `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check` — each exits 0 (regenerate any
  that reports drift and record why).
- `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
  `node scripts/check-number-ledger.mjs --check` — at govern-close.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + registry + arena-client + server suites green; `pnpm -r build` 0; feeds regenerated where they moved, every
      `:check` / `--check` above green.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** a match **created after the deploy** with Trap Heroes in the Microverse and base + 1 Heroes:
      the setup log names the trapped Hero; Play Diagnostics `uiStateSnapshot` shows a trapped card in the City with its printed
      cost as fight cost (2 less after playing a card of its class); fighting it with two seats opens the "Player N gains" choice
      and the card lands in the chosen discard; a Twist reveals two cards. Confirmed live, or operator-pending in `STATUS.md` with
      a pending `live-verify.json` row.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24805 → Active; `WORK_INDEX.md` checked; `EC_INDEX.md` Done; mindmap ✅
      + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] No files outside `## Files Expected to Change` were modified — `git diff --name-only origin/main...HEAD` checked.

## Reserved Decision (lands at execution)

D-24805 — Trap Heroes in the Microverse. The scheme requires one more Hero (`add 1 from 1p`: 4 / 6 / 6 / 6 / 7); the last-listed
Hero in `heroDeckIds` is trapped (amends D-24672's main-Hero-Deck-only note). Its cards (one per physical card) are typed
`'villain'`, tagged `ConvertedVillainOrigin` `'micro-sized'`, added to the Villain Deck and re-shuffled by one seeded shuffle
after the Skrull step; every other scheme is a passthrough. Attack = printed cost (overlay-first in `resolveBaseFightCost`).
Size-Changing for its card color is a setup-time `G.fightSizeChanging` entry `{ classes: distinct heroClass, heroClass2;
microscopicIcons: [] }` read by `resolveFightPrice`; a dual-class card counts both colors as separate 2-less steps (the engine's
two-class Size-Changing reading, flagged for the operator); a grey card has none. No other ability fires in the City. Defeat: no
VP, origin cleared; one seat gains at once; otherwise the card goes to the defeater's discard and an active-seat seat choice
`'micro-sized-gain'` ("Player N gains <Hero>", defeater first, default 0) moves it to the chosen player's discard; an open seat
choice blocks only the park. Twist: `chained-reveals` with 2. Evil Wins: the Villain Deck runout plus the new
`additionalEscapeLossCondition` (escaped Villains and Henchmen, `threshold 3`, `isThresholdPerPlayer` = × seats in
`G.playerZones`); the twist fallback is removed; the meter reports the closer condition. Notes: the trapped Hero is positional
(a registry-viewer bench swap can change which Hero is last; the setup log names it); a gained card keeps
`villainDeckCardTypes` `'villain'`; a trapped Transform Hero's second forms stay in the transform side deck.

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1:** READY TO EXECUTE after one PS, folded: PS-1 the setup message's Hero name had no source (the engine
  `HeroEntry` has no `name`) — `readTrappedHeroName(registry: unknown, heroDeckId)` (structural `getSet` read, id fallback) and
  `describeTrappedHero(heroName, cardCount)` are locked. RS folded: the `typeof getSet` passthrough guard; the sweep Assumes line
  corrected (the weekly sweep runs this scheme solo with 4 Heroes, still valid); the `buildInitialGameState` rewires named and line
  refs corrected; the park posture (overwrite / stale) stated; `G.playerZones` chosen over `lobby.requiredPlayers` with the reason;
  the leftover `villainDeckCardTypes` entry and the Transform side deck recorded in D-24805; the registry-size test title edit
  sanctioned; a City-KO no-ability test added. Not folded: the D-24672 / D-24595 prose counts (ungated history).
- **Copilot round 1:** RISK → HOLD, eight wording / test / comment findings, all folded: (6) the loss read the additional escape
  condition beside any non-escape primary while the meter reads it only beside `pile-depleted` — now both read it only beside
  `pile-depleted`, with a config pin (RS-8); (26/15) three existing comments that become false are named in the EC required
  comments; (3/17) a frozen-input purity test for the conversion; (26/22) the `getSet` guard's owner locked (the split and the card
  list share one guard, failing → nothing trapped); (16) the import cycle accepted with its precedent (RS-6); (11/26) the size
  assertion locked as `8 + 66 + 1 + 3`; (26) the one-seat log outcome `applied` stated in the WP; (30) line refs refreshed after
  WP-862. Also: the RS-5 test list reworded (the engine has no general City-KO path). Verified clean on the other 22 modes.
- **Copilot round 2:** PASS (CONFIRM). All eight folds verified in WP and EC; three optional wording nits folded without a re-run
  (the RS-8 "else" clause names `pile-depleted`; the EC Before Starting line says #3166 / #3164 are in the baseline and counts are
  re-recorded; the EC comment item says the JSDoc must also name Micro-Sized ids). Gate verdict: **PASS**.

## Lint Gate Self-Review (00.3)

- **Lint round 1 (subagent):** two FAILs, both folded: §4 now cites `00.2-data-requirements.md` §1 / §7 and the Layer Boundary;
  §21 was a wrong N/A — the `/api/match/setup-requirements` catalog row names the 27-row hero-count table and lists each per-scheme
  count WP, so it is replaced whole (now in the allowlist). Gaps folded: a same-seed determinism test (§12), the stale EC rebase
  line (§19, already fixed after copilot round 2), a fuller §20 justification. The lint folds add one documentation file and one
  test; no scope, contract or locked value changed, so copilot and pre-flight are not re-run.

- **§1 structure:** every template section present and non-empty; Out of Scope names a City Micro-Sized marker, lobby choice of
  the trapped Hero, bot valuation, other D-compound escape schemes, Hero VP / Skrull proxy, `buildFightSizeChanging.ts`, WP-862's
  overlay, `replay.execute.ts`, and new move / queue / UIState / client / server surfaces. **PASS.**
- **§2 constraints:** full-file output, ESM, Node v22+, `00.6-code-style.md` cited; one-shuffle determinism, passthrough for every
  other scheme, registry data-only; session protocol (four STOP triggers); locked values → EC. **PASS.**
- **§3 Assumes:** WP-514 / 823 / 684 / 821 / 524 / 763 and D-24802, plus every helper, type, pin, call site and data fact with
  file and line, spot-checked at `bf0ed909`. **PASS.**
- **§4 Context:** why the last-listed Hero, why a setup-time `G.fightSizeChanging` entry, why one WP; RS-1..RS-9 locked;
  ARCHITECTURE sections incl. Layer Boundary, 00.2 §1 / §7, DECISIONS scan list, 00.6. **PASS.**
- **§5 files:** every file listed new / modified with role (registry 2, engine 9 source + 1 new module, tests, `live-verify.json`,
  `api-endpoints.md`, governance); one WP justified (registry row + conversion must land together). **PASS.**
- **§6 naming:** full words (`additionalEscapeLossCondition`, `isThresholdPerPlayer`, `resolveEscapedPileThreshold`,
  `gainDefeatedMicroSizedHero`); `heroDeckIds` and scheme slug verbatim; no 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; engine never imports the registry (structural `getSet` read at setup, the
  `CardStatsRegistryReader` convention); no client, server or persistence change; G stays JSON. **PASS.**
- **§9 Windows:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`; real `buildInitialGameState` on committed card data and the real `resolveSeatChoice`;
  frozen-input purity, same-seed determinism, passthrough checks for another scheme; no boardgame.io, network or DB. **PASS.**
- **§13 verification:** exact build, four suite, `--no-bail`, seven feed `:check` and govern-close commands with expected exits;
  baseline counts re-recorded at execution. **PASS.**
- **§14 / §15:** 7 binary criteria; DoD names STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap / ledger, the scope-boundary
  check and the D-24026 live check on a post-deploy match (§15.1, operator-pending fallback with a `live-verify.json` row);
  **§15.2** `**Risk Tier:** MEDIUM` in the WP header and verbatim in the EC (not HIGH, so no threat-model section). **PASS.**
- **§16 code-style:** reuse of `chained-reveals`, the seat-choice park / generic prompt, `resolveFightPrice` and the D-24802 map;
  one threshold reader shared by loss and meter (the `countEscapedPileByType` precedent); `for` loops, no `.reduce()`, no nested
  ternaries, never throws; `// why:` locations incl. three stale comments in the EC. **PASS.**
- **§17 Vision:** clauses §1/§2/§8/§10/§22, no-conflict line, NG-1 line, determinism line (one seeded shuffle, only this
  scheme; earlier-match replay divergence and frozen `competitive_scores` stated). **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** baseline `bf0ed909` and counts re-recorded at commit. **PASS.**
  Contract files: `types.ts` and `schemeTwistConfig.types.ts` gain one union member / optional fields, covered by D-24805.
- **§20 funding:** N/A, engine + registry data only; no nav, registry-viewer, profile or funding-channel surface and no
  user-visible funding copy. **§21 API catalog:** the `/api/match/setup-requirements` row replaced whole (28-row table, this
  scheme base + 1, WP-863 / D-24805); no new endpoint. **PASS.**
