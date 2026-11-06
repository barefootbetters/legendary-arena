# WP-862 — Size-Changing granted or removed during play: an HQ grant overlay read by the recruit price (Game Engine + card data)

**Status:** Draft 2026-11-05 (EC-900; D-24804 reserved, PR #3163)
**Layer:** Game Engine (one HQ Size-Changing grant overlay on `G`, the recruit-price authority, one villain primitive, one hero
keyword, two tactic resolvers, two seat-choice kinds) + card data
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay pricing logic and new `G` state; no auth, money, persistence or server surface
**Hard-deps:** D-24801 (#3155, Size-Changing is a recruit discount: `resolveRecruitCost` / `applySizeChangingDiscount` in
`hero/sizeChanging.logic.ts`) ✅, D-24802 (#3159, the villain / mastermind fight discount through `resolveFightPrice`) ✅,
WP-684 / D-24501 (the seat choice: `PendingSeatChoice`, `parkSeatChoice`, `applySeatChoiceByKind`, the live-move chain point) ✅,
WP-683 / D-24500 (a hero handler parks a seat choice at play) ✅, WP-821 / D-24754 (a tactic parks an HQ-Hero seat choice:
Dominate the Weak) ✅, WP-860 / D-24796 (chained seat-choice picks read before the apply; the open-choice guard) ✅, WP-497
(`dispatchTacticOnFight`) ✅

## Goal

Six printed effects give a Hero in the HQ Size-Changing during play (one also takes it away), and today none of them does
anything. After this WP:

- **Pym Particles** (antm Ant-Man, second line): "A Hero in the HQ with no Size-Changing abilities gains Size-Changing [Tech] this
  turn."
- **Ultron-Pym** (antm Ultron's Legacy villain), Fight: the same grant.
- **Shrinksperiments** (amwp Cross Technologies villain), Fight: "A Hero in the HQ loses all Size-Changing abilities, then gains
  Size-Changing [Tech] this turn."
- **Sporr** (chmp Monsters Unleashed villain), Fight: "A Hero in the HQ gains Size-Changing [Tech], [Ranged] this turn."
- **Alien Dragon Technology** (chmp Fin Fang Foom tactic), Fight: "A Hero in the HQ gets Size-Changing [Strength], [Instinct],
  [Covert], [Tech], [Ranged] this turn."
- **Shrinking Research Budget** (amwp Darren Cross tactic), Fight: "Each Hero currently in the HQ that has no Size-Changing abilities
  gains Size-Changing for one of its Hero Classes."

The granted Size-Changing makes that Hero cheaper to recruit exactly as printed Size-Changing does (D-24801): 2 less per listed
class the recruiting player played this turn. The player picks which HQ Hero gets it. The grant ends at the end of the turn, or
for Shrinking Research Budget when that Hero leaves the HQ. It also fixes a D-24801 parse bug on Pym Particles: its grant sentence
is read today as a second, printed Size-Changing [Tech] line on Pym Particles itself, so Pym Particles costs 2 less than printed.

## User-Visible Impact

`play.legendary-arena.com` — fighting Ultron-Pym, Shrinksperiments or Sporr, defeating the Alien Dragon Technology tactic, or
playing Pym Particles with two or more eligible Heroes in the HQ opens a choice: "Captain America (Avengers Assemble!) gains
Size-Changing Tech this turn" (one button per eligible Hero, recruitable and priciest first). With one eligible Hero it is applied
at once; with none the log says so. The HQ recruit price of the chosen Hero then drops by 2 per matching class the player has
played (the `recruitCosts` HQ projection already shown since D-24801). Shrinking Research Budget gives each HQ Hero that has no
Size-Changing its own class at once; a dual-class Hero opens a "gains Size-Changing Tech / Ranged" pick, one Hero after another.
Pym Particles' own price no longer takes the extra Tech step. Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` `f147df19` (2026-11-05, D-24801 #3155, D-24802 #3159 and the WP-862 reservation #3163 merged);
  re-recorded at commit. Engine baseline 6269 / 0, arena-client 2546 / 0, dashboard 594 / 0.
- Hero instance ids are copy-unique: `${setAbbr}/${heroSlug}/${cardSlug}#${copyIndex}` (`setup/buildHeroDeck.ts` ~557-563), and
  `G.cardStats` / `G.cardSizeChangingClasses` are keyed by them. Two copies of one Hero in the HQ are two distinct ids.
- `hero/sizeChanging.logic.ts`: `getSizeChangingClasses(G, cardId)`, `getMicroscopicSizeChangingClasses(G, cardId)`,
  `hasSizeChanging(G, cardId)`, `resolveRecruitCost(G, playerID, cardId)` (~152, printed cost through
  `applySizeChangingDiscount`), `applySizeChangingDiscount(G, playerID, baseCost, classes, microscopicIcons)` (~181). Its three
  callers (`moves/recruitHero.ts` ~113, `ui/uiState.build.ts` `buildHqRecruitCosts` ~704, `simulation/ai.legalMoves.ts` ~1078) are
  the only HQ recruit-price readers (server, preplan and client compute none); they keep their call shape.
- `ui/uiState.build.ts` `matchHasSizeChangingCard` (~679) gates `UIHQState.recruitCosts` on either setup map being non-empty; the
  client `HQRow` reads `recruitCosts[hqIndex]`.
- `economy/economy.resolve.ts` `resolveFightPrice` (~152; the `G.fightSizeChanging` read in `applyFightSizeChanging` ~190-196)
  is not changed: no effect in scope grants Size-Changing to a Villain or Mastermind (RS-8).
- The hero parser (`setup/heroAbility.setup.ts`) routes every `[hc:X]` on a line containing `[keyword:Size-Changing]` to that
  card's `sizeChangingClasses` (Step 1a, ~1236 / ~1371) and records the `size-changing` keyword (Step 2, `KEYWORD_PATTERN` ~152).
  Observed (probe through `buildHeroAbilityHooks` on the committed `antm.json`): Pym Particles' abilityIndex 1 (second line) builds
  `{ keywords: ['size-changing'], effects: [{ type: 'size-changing' }], sizeChangingClasses: ['tech'] }`; with the marker appended
  it still does, so RS-6 suppresses at both steps. The marker script appends `${line} ${token}`
  (`apply-hero-ability-markers.mjs` ~430), so the parser can key on the token.
- The villain setup parser's own Size-Changing line pattern (`setup/buildFightSizeChanging.ts` ~58) is anchored, so the three
  Fight lines never reach `G.fightSizeChanging`; their villains' own icon lines keep their D-24802 fight discount.
- Seat choice (WP-684): `PendingSeatChoice` (`types.ts` ~1471), `SeatChoiceOption { label, cityIndex?, cardId?, recipientSeat?,
  sourceZone? }` (~1408); `parkSeatChoice(G, events, choice, activePlayerToSkip?)` (`moves/seatChoice.resolve.ts` ~313; with no
  `events` it only writes `G`); `applySeatChoiceByKind` (~507); the live-move chain point after the apply in `resolveSeatChoice`
  (~474-482, the Commune chain); `applySeatChoiceTimeoutDefault` (~760) runs no chain. The client renders any kind's `label`s
  under a generic heading; bots answer with `defaultOptionIndex` (`ai.legalMoves.ts` ~450; `ai.seatChoice.ts` returns null for
  an unknown kind). A single addressed active seat needs no stage ride (D-24648).
- Every action move carries the `hasPendingSeatChoice` block-all guard (fightVillain, fightMastermind, playCard, endTurn,
  drawCards, recruitHero / Officer / Sidekick, exorcise, heal, dodge, phase; `useRitualArtifact` through `hasAnyPendingChoice`).
  Some other pending-choice resolve moves can still change the HQ while a pick is open (`resolveOptionalPutBottomHQ`,
  `resolvePutAnyNumberBottomHQ`, `resolveGiveHqHeroChoice`, the defeat-choice resolve), so every apply re-checks its card (RS-7).
- No villain `onFight` handler parks a seat choice today; this is the first. After `onFight`, `defeatCityVillainCore`
  (`moves/fightVillain.ts` ~557-767, `onFight` at ~661) only logs, records `fightResolved` and plays Villain Deck cards for Endless Armies — nothing
  that parks a seat choice for these three villains.
- Villain primitives: `VillainEffectPrimitive` + `VILLAIN_EFFECT_PRIMITIVES` (`rules/villainAbility.types.ts` ~342 / ~448, 38 at
  HEAD, last `hq-heroes-to-hero-deck-bottom`), `VillainEffectDescriptor` (~650), the parser (`setup/villainAbility.setup.ts`,
  `parseHeroClassList` ~325), the handler table (`villain/villainEffects.execute.ts` ~4655-4699) with `VillainEffectHandler(G,
  currentPlayer, cardId, timing, descriptor, …)` returning a `VillainEffectApplication` (~956); the marker script
  `scripts/convert-cards/apply-effect-markers.mjs` (primitive list ~186-224, `isValidHeroClassList`, grammar ~430) and
  `inputs/villain-effect-markers.json`. The length 38 is pinned only in `rules/villainAbility.types.test.ts` (~404-421, 631, 666,
  691, 742).
- Tactics: `dispatchTacticOnFight(G, ctx, defeatedTacticId, shuffleContext, events?)` (`rules/tacticHandlers.ts` ~1463), ids
  `${setAbbr}-mastermind-${mastermindSlug}-${tacticSlug}` (`mastermind.setup.ts` ~279); unknown ids are silent no-ops (WP-497).
  `scripts/coverage/tactic-provenance.json` feeds the effect index (`build-effect-implementation-index.mjs` ~61; a tactic with no
  row reads `unmarked`; the WP-818 / WP-821 precedent).
- Hero keywords (handler-bearing lockstep): `HeroKeyword` + `HERO_KEYWORDS` (`rules/heroKeywords.ts`, 92 at three pin sites),
  `HERO_EFFECT_HANDLERS` (71 at `heroEffects.execute.test.ts` ~151 and ~8117), `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`;
  markers in `inputs/hero-ability-markers.json` + `VALID_TOKEN_PATTERN` in `apply-hero-ability-markers.mjs`.
- `hero/splitCard.logic.ts` `offPlayCardTraits(G, cardId)` (an HQ card's classes, either half of a split card) and
  `offPlayCardStats`. `content/content.schemas.ts` `HERO_CLASSES` is `tech, covert, strength, ranged, instinct` — not the printed
  order, so this WP locks its own order (RS-3).
- `moves/endOfTurnCleanup.logic.ts` `applyEndOfTurnCleanup` is reached by every turn-end path (game.ts, coreMoves, replay, PAR,
  sim, enigmaCode); its Step 7 `clearCopyPowersGrants` is the turn-scoped grant precedent (deleted keys, omit-when-empty).
- The only `finalStateHash` sentinel (`test/fixtures/games/sentinel-core-doom-2p.replay.json`, core) uses no antm, amwp or chmp card.
- `data/cards/antm.json` and `chmp.json` are GENERATED (markers applied by the marker scripts); `amwp.json` is an outlier whose
  committed file is its own base, already carrying `[effect:]` markers, rewritten in place (`cards:check` seeds outlier bases
  from the committed copy, `check-card-data-regen.mjs` ~122).

## Context (Read First)

- **Why an overlay and not the setup maps.** `G.cardSizeChangingClasses` / `cardMicroscopicSizeChangingClasses` are setup-built
  printed data, never written after setup (the D-24801 contract). A runtime grant is a separate, removable fact about one card
  instance while it sits in the HQ, so it lives in its own lazy list keyed by that instance id, and is read only while the card
  is still in `G.hq` — once the card leaves the HQ the grant is inert, which makes Shrinking Research Budget's lifetime literal.
- **Why one WP.** Every effect writes the same overlay and the same price authority reads it; splitting would reopen the contract.
  Out of the requested set, the antm scheme **Trap Heroes in the Microverse** ("Heroes in the Villain Deck are Micro-Sized
  Villains … They have Size-Changing for their card color") is not a runtime grant: its Heroes-in-the-Villain-Deck setup does not
  exist yet (the Secret Invasion Skrull conversion is the precedent), and once it does, the per-card color discount is a static
  `G.fightSizeChanging` entry built at setup. It is a separate scheme WP (Out of Scope).
- **Observed today:** the three villain Fight lines are `(unmarked)` in the villain ledger (they do nothing); the two tactics are
  not in `dispatchTacticOnFight` (silent no-op); Pym Particles' grant line parses as printed Size-Changing [Tech] on itself.
- **Pending-choice rules.** The pick reuses the WP-684 seat choice addressed to the active player only (the Dominate the Weak
  shape): no new queue, move, UIState field or client file. Zero eligible → a logged no-op; one → applied at once (the Bitter
  Captor single-eligible rule); two or more → a pick. HQ contents are public, so labels carry no secret.
- **Determinism / hash.** `G.hqSizeChangingGrants` is created lazily at the first grant and deleted when it empties. The RS-6 parse
  fix removes Pym Particles from `G.cardSizeChangingClasses` at setup in every match that selects antm Ant-Man (not only matches
  that play the six cards). No sentinel uses antm, amwp or chmp, so every `finalStateHash` sentinel serializes byte-identically.
- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, §Rule Execution Pipeline, Principle #1. `docs/ai/DECISIONS.md` — scan
  D-24801, D-24802, D-24501, D-24500, D-24754, D-24796, D-24648, D-24372 before coding. `docs/ai/REFERENCE/00.6-code-style.md`.

### RS-1 — The overlay (default locked)

`G.hqSizeChangingGrants?: HqSizeChangingGrant[]`, in grant order. `HqSizeChangingGrant { cardId: CardExtId; classes: string[];
replacesPrinted: boolean; expiresAtEndOfTurn: boolean }`. A card's effective Size-Changing starts from its printed lists; when the
card is in `G.hq`, each grant with that `cardId` applies in order: `replacesPrinted` sets the classes to the grant's and clears
the Microscopic icons; otherwise the grant's classes are added with duplicates dropped (a Hero that already has Size-Changing
[Tech] and gains [Tech] still takes one Tech step — my reading: "gains Size-Changing [Tech]" names an ability the Hero already
has, and the rulebook counts each listed class once). Microscopic icons are only ever printed. A card not in `G.hq` reads its
printed lists only.

### RS-2 — Lifetimes (default locked)

"This turn" grants (`expiresAtEndOfTurn: true`) are removed at the end of the turn. Shrinking Research Budget prints no duration;
its grant (`expiresAtEndOfTurn: false`) lasts while that card stays in the HQ — my reading of "each Hero currently in the HQ …
gains", against the same set's Shrinksperiments, which prints "this turn" (flagged for the operator in D-24804). A grant whose
card is not in `G.hq` is never read. End-of-turn cleanup (new Step 8) keeps only grants with `expiresAtEndOfTurn: false` whose card
is still in `G.hq`, and deletes the field when nothing is left. Consequence: a Shrinking
Research Budget grant outlives the turn, so any player who later recruits that card gets the discount against their own played
cards. Switching to a "this turn" reading is one value (`expiresAtEndOfTurn: true`) plus the RS-7 Shrinking Research Budget log text. No caller of the price changes (a recruited card leaves `G.hq`, so
its grant goes inert at once and is pruned at turn end).

### RS-3 — Eligibility and the pick (default locked)

Eligible: the non-null HQ cards; for the "with no Size-Changing abilities" effects (Pym Particles, Ultron-Pym, Shrinking Research
Budget), only cards whose effective Size-Changing (printed classes, Microscopic icons and grants) is empty. A Haunted Hero is
eligible (it is in the HQ). Options: one per eligible card, ordered not-Haunted first (`isHqSlotHaunted`), then printed off-play
cost descending (`offPlayCardStats`), then lower slot index — so the default never lands on a Hero that cannot be recruited while
another exists. Label `<Hero name> gains Size-Changing <Classes> this turn` (replace: `<Hero name> loses its Size-Changing and gains
Size-Changing <Classes> this turn`); each option carries `cardId`; `defaultOptionIndex: 0`. Class words and their order are a local
constant in `hero/sizeChangingGrant.logic.ts`, the printed order `Strength, Instinct, Covert, Tech, Ranged` (slugs `strength,
instinct, covert, tech, ranged`), used for labels and the RS-4 option order; a list reads "A", "A and B", "A, B and C". **Open
choice guard (the WP-860 RS-1 posture):** when `G.pendingSeatChoice !== undefined`, a pick that would park does not park and logs
`blocked`; zero- and one-eligible grants still resolve. The guard checks only `pendingSeatChoice` (like WP-860).

### RS-4 — Shrinking Research Budget (default locked)

At the tactic, every eligible card (no effective Size-Changing) in slot order: its classes are the distinct non-empty
`heroClass` / `heroClass2` of `offPlayCardTraits`, in the RS-3 order. No class → a `blocked` log line for that Hero; one class →
the persistent grant at once; two classes → deferred. The first deferred card (lowest slot) opens a class pick (one option per
class, label `<Hero name> gains Size-Changing <Class>`, `cardId` + `heroClass`, default 0); after its apply the next deferred card
is found by a fresh scan from slot 0 (the lowest-slot non-null HQ card with no effective Size-Changing and two classes — every
earlier eligible card already holds a grant, and a stale pick's card is no longer in `G.hq`) and chains from the live-move chain
point. Accepted: a Hero that entered the HQ while a pick was open (a refill by another resolve move) can be offered, though the
card says "currently in the HQ" — rare, and snapshotting would need a contract field. Under an open seat choice the single-class grants still apply and the dual-class picks are dropped with one `blocked` line. The
class-pick kind carries no source field: only the addressed seat is read before the apply, and the chain passes the module
constant `SHRINKING_RESEARCH_BUDGET_TACTIC_ID` (`amwp-mastermind-darren-cross-shrinking-research-budget`, a string literal defined once in
`hero/sizeChangingGrant.logic.ts`; `tacticHandlers.ts` imports it for its dispatch arm, avoiding an import cycle) as `sourceCardId`. On
the timeout path no further class pick opens and no line is logged (the WP-860 accepted posture). "This Mastermind Transforms" on the same tactic stays unimplemented (Out of Scope).

### RS-5 — The six effects (default locked)

| Card | Source | Eligible | Classes | Mode | Lifetime |
|---|---|---|---|---|---|
| Pym Particles (antm Ant-Man, line 2) | hero keyword `hq-hero-gains-size-changing-tech` | no Size-Changing | tech | add | this turn |
| Ultron-Pym (antm Ultron's Legacy) | villain Fight `hq-hero-gains-size-changing:if-none:tech` | no Size-Changing | tech | add | this turn |
| Shrinksperiments (amwp Cross Technologies) | villain Fight `hq-hero-gains-size-changing:replace:tech` | any | tech | replace | this turn |
| Sporr (chmp Monsters Unleashed) | villain Fight `hq-hero-gains-size-changing:add:tech+ranged` | any | tech, ranged | add | this turn |
| Alien Dragon Technology (chmp Fin Fang Foom) | tactic `chmp-mastermind-fin-fang-foom-alien-dragon-technology` | any | all five | add | this turn |
| Shrinking Research Budget (amwp Darren Cross) | tactic `amwp-mastermind-darren-cross-shrinking-research-budget` | no Size-Changing, each | its own class | add | while in the HQ |

### RS-6 — Pym Particles' parse (default locked)

On a hero line carrying `[keyword:hq-hero-gains-size-changing-tech]`, the printed `[keyword:Size-Changing]` and `[hc:tech]` are
descriptive (they name what the other Hero gains): the line records no `size-changing` keyword (Step 2), no `sizeChangingClasses`
and no class condition (Step 1a). Target hook: `{ timing: 'onPlay', keywords: ['hq-hero-gains-size-changing-tech'], effects:
[{ type: 'hq-hero-gains-size-changing-tech' }] }` with no conditions and no unresolved markers. Pym Particles keeps its first line
(Microscopic [Tech]×5). Its recruit price drops the spurious Tech step (a correction of D-24801's parse).

### RS-7 — Logs and the villain result (default locked)

Grant applied: `Player N gave <Hero> Size-Changing <Classes> this turn (<source name>).` (replace: `Player N made <Hero> lose its
Size-Changing and gain Size-Changing <Classes> this turn (<source name>).`; Shrinking Research Budget: `<Hero> gains Size-Changing
<Class> while it stays in the HQ (Shrinking Research Budget).`), outcome `applied`. No eligible Hero: `No Hero in the HQ can gain
Size-Changing (<source name>).` (`blocked`). Pick parked: `Player N chooses a Hero in the HQ to gain Size-Changing (<source
name>).` (`neutral`). Open choice: `Player N could not choose a Hero to gain Size-Changing — another choice is open (<source
name>).` (`blocked`). A stale option at apply (its card no longer in `G.hq`): `<Hero> is no longer in the HQ, so it gains nothing
(<source name>).` (`blocked`). The source name is the source card's display name (`resolveCardName`). Lines written for a villain or tactic source carry the `Fight effect: ` prefix (the keyword-less sibling and tactic precedent);
the Pym Particles lines do not. The primitive is keyword-less, so the executor records no result for it: no generic `Fight
effect:` line, and `fightResolved.appliedEffects` and its narrative are unchanged. The handler self-narrates with the RS-7 lines
and returns `{ targets: [] }`. Shrinking Research Budget, a Hero with no class: `<Hero> has no Hero Class, so it gains nothing
(Shrinking Research Budget).` (`blocked`); its dropped picks under an open choice reuse the open-choice line with that source.

### RS-8 — Out of the price authorities (default locked)

Only `resolveRecruitCost` reads the overlay (signature unchanged), through a new `getHqCardSizeChanging(G, cardId)` reader;
`applySizeChangingDiscount` and `resolveFightPrice` are unchanged (no effect grants Size-Changing to a Villain or Mastermind).
`hasSizeChanging` keeps its printed meaning for played cards (Antics, reveals); the new reader is separate. `matchHasSizeChangingCard`
also returns true while `G.hqSizeChangingGrants` exists, so `recruitCosts` shows the granted price in a match with no printed
Size-Changing Hero.

## Scope (In)

- **Contract** (`types.ts`): `HqSizeChangingGrant` (RS-1) and `LegendaryGameState.hqSizeChangingGrants?: HqSizeChangingGrant[]`;
  `PendingSeatChoice.sizeChangingGrant?: { classes: string[]; replacesPrinted: boolean; sourceCardId: CardExtId }` (present only on
  the grant kind); `SeatChoiceOption.heroClass?: string` (consumer-added, not projected beyond `label`).
- **Price authority** (`hero/sizeChanging.logic.ts`): `getHqCardSizeChanging(G, cardId): { classes; microscopicIcons }` (RS-1),
  `hqCardHasSizeChanging(G, cardId): boolean`; `resolveRecruitCost` reads `getHqCardSizeChanging`.
- **New module** `hero/sizeChangingGrant.logic.ts` (no boardgame.io, no registry, no `.reduce()`, never throws):
  `SIZE_CHANGING_GRANT_SEAT_CHOICE_KIND = 'size-changing-grant'`, `SIZE_CHANGING_CLASS_PICK_SEAT_CHOICE_KIND =
  'size-changing-class-pick'`; `SizeChangingGrantMode = 'if-none' | 'add' | 'replace'`; the RS-3 class-order constant;
  `grantSizeChangingToHqHero(G, playerID, classes, mode, sourceCardId): CardExtId | null` (RS-3 0 / 1 / ≥2 + guard; returns the
  Hero granted at once), `applySizeChangingGrantResolvedSeatChoice(G, choice)`, `resolveShrinkingResearchBudgetGrants(G, playerID,
  sourceCardId)` (RS-4), `applySizeChangingClassPickResolvedSeatChoice(G, choice)`, `chainSizeChangingClassPick(G, playerID,
  sourceCardId)`,
  `clearExpiredHqSizeChangingGrants(G)`; labels / logs per RS-3 / RS-7; one private writer `addHqSizeChangingGrant` (lazy create).
- **UI** (`ui/uiState.build.ts`): `matchHasSizeChangingCard` grant arm (RS-8).
- **Cleanup** (`moves/endOfTurnCleanup.logic.ts`): Step 8 `clearExpiredHqSizeChangingGrants(G)`.
- **Seat-choice wiring** (`moves/seatChoice.resolve.ts`): two `applySeatChoiceByKind` arms; the class-pick seat read before the apply (the source is the
  `SHRINKING_RESEARCH_BUDGET_TACTIC_ID` constant); `chainSizeChangingClassPick` at the live-move chain point.
- **Villain primitive** `hq-hero-gains-size-changing` (appended last; drift list + length pins 38 → 39): descriptor fields
  `sizeChangingGrantMode?: 'if-none' | 'add' | 'replace'` and `sizeChangingGrantClasses?: readonly HeroClass[]`, NOT in
  `descriptorKey`; grammar `hq-hero-gains-size-changing:<mode>:<c>[+<c>…]` (exactly 3 parts, class list via `parseHeroClassList`,
  else `null`); handler `villainEffectHqHeroGainsSizeChanging` → `grantSizeChangingToHqHero(G, currentPlayer, classes, mode,
  cardId)`, returning per RS-7. Markers (`villain-effect-markers.json` fight lists): antm `ultrons-legacy/ultron-pym`
  `hq-hero-gains-size-changing:if-none:tech`; amwp `cross-technologies/shrinksperiments` `hq-hero-gains-size-changing:replace:tech`;
  chmp `monsters-unleashed/sporr` `hq-hero-gains-size-changing:add:tech+ranged`; the script's primitive list and grammar arm gain it.
- **Hero keyword** `hq-hero-gains-size-changing-tech` (appended last; `HERO_KEYWORDS` + `HANDLED_KEYWORDS` +
  `NO_MAGNITUDE_KEYWORDS`; handler `heroEffectHqHeroGainsSizeChangingTech` → `grantSizeChangingToHqHero(G, playerID, ['tech'],
  'if-none', cardId)`); marker `{ heroSlug: "ant-man", cardSlug: "pym-particles", abilityIndex: 1, markupToken:
  "[keyword:hq-hero-gains-size-changing-tech]" }` in `antm`; `VALID_TOKEN_PATTERN` arm + error message; the RS-6 suppression at
  Step 1a and Step 2 in `setup/heroAbility.setup.ts`.
- **Tactics** (`rules/tacticHandlers.ts`): `resolveAlienDragonTechnology(G, currentPlayer)` (all five classes, add, this turn) and
  `resolveShrinkingResearchBudget(G, currentPlayer)`; two dispatch arms.
- **Data:** regenerate `antm.json`, `chmp.json`; `amwp.json` rewritten in place by the marker script.
- **Ledger / coverage:** provenance rows (`hq-hero-gains-size-changing-tech`, `hq-hero-gains-size-changing`) → WP-862 / D-24804 in
  `mechanic-provenance.json`; `tactic-provenance.json` rows `chmp-mastermind-fin-fang-foom-alien-dragon-technology` → `{ status:
  "executable", handler: "packages/game-engine/src/rules/tacticHandlers.ts#resolveAlienDragonTechnology", wp: "WP-862", decision:
  "D-24804" }` and `amwp-mastermind-darren-cross-shrinking-research-budget` → the same shape with `#resolveShrinkingResearchBudget`;
  pending `live-verify.json` rows; regenerate `ledger:heroes`, `ledger:villains`, `effect-index`, `mechanics:metadata`,
  `sim:runtime-observed`, `sim:coverage --update-baseline`, the dashboard coverage copies (+ the in-play pin only if it moves).
- **Tests** (new `hero/sizeChangingGrant.test.ts`; hooks from the real parsers on the committed card data):
  - Pym Particles' target hook (RS-6) and its recruit price: no Tech step from line 2 (Microscopic only).
  - The three villain lines parse to their descriptors; a malformed marker (`:sideways:tech`, missing class, 2 parts) is `null`.
  - Overlay reads (RS-1): add, replace (drops Microscopic), dedupe, a card not in `G.hq` reads printed only.
  - `resolveRecruitCost` with a Tech grant and a Tech card played: 2 less; another HQ Hero (incl. another copy of the same card)
    is not discounted; once the granted card leaves `G.hq` its price is printed again.
  - Each effect end to end: zero eligible → blocked log, nothing parked; one → applied at once; two → a seat choice with the
    RS-3 options (a Haunted Hero after the recruitable ones), default 0, resolved through the real `resolveSeatChoice`; if-none
    skips a Hero with printed or granted Size-Changing; replace on a printed Size-Changing [Strength] Hero leaves only [Tech].
  - Shrinking Research Budget: single-class Heroes granted at once; two dual-class Heroes chain two class picks through the real
    `resolveSeatChoice`; a no-class Hero logs; the grants survive end of turn and are pruned once the card leaves the HQ.
  - Lifetimes: end-of-turn cleanup removes this-turn grants and grants whose card left the HQ, and deletes the field.
  - Open seat choice → no park, blocked log, the open choice untouched (single-eligible still applies); a stale option → blocked
    log, no grant.
  - `buildUIState` `recruitCosts` present in a match with no printed Size-Changing Hero once a grant exists; the bot
    (`getLegalMoves`) answers the pick with index 0; a parked grant choice round-trips through JSON.
  - Pins: primitive drift list + length pins +1, the last-entry assert and the WP-837 T1 `slice(34)` → `slice(34, 38)`;
    `HERO_KEYWORDS` +1 at three sites and the ordered `expectedKeywords` append; `HERO_EFFECT_HANDLERS` +1 at both pins.
  Expected unchanged: every `finalStateHash` sentinel, the D-24801 / D-24802 tests, the seat-choice tests.

## Out of Scope

- **Trap Heroes in the Microverse** (antm scheme): Heroes in the Villain Deck as Micro-Sized Villains — a separate scheme WP.
- **Look Out for the Little Guy** (amwp Ant-Man): its reveal line's `[hc:strength]` is read as a second Size-Changing [Strength]
  (the same D-24801 parse class as Pym Particles, but not a runtime grant) — a separate fix.
- Shrinking Research Budget's "This Mastermind Transforms" (Darren Cross transform is unimplemented; `transformMastermind` is only
  called from General Ross's Master Strike).
- Other "has Size-Changing" readers of HQ cards (none implemented today); a UIState field or client badge showing a granted
  Size-Changing on an HQ card; a bot policy beyond the defaults; Tim Boo Ba's "All Heroes currently in the HQ cost 1 less this turn";
  `wiki/card-effect-system.md`.
- Any new pending queue, move, `CoreMoveName`, UIState field, client file or server change; `replay/replay.execute.ts`.

## Files Expected to Change

- `packages/game-engine/src/types.ts` — **modified** — `HqSizeChangingGrant`, `hqSizeChangingGrants?`,
  `PendingSeatChoice.sizeChangingGrant?`, `SeatChoiceOption.heroClass?` (contract file; D-24804).
- `packages/game-engine/src/hero/sizeChanging.logic.ts` — **modified** — `getHqCardSizeChanging`, `hqCardHasSizeChanging`, the
  `resolveRecruitCost` read.
- `packages/game-engine/src/hero/sizeChangingGrant.logic.ts` — **new** — kinds, grant writer, picks, chain, cleanup.
- `packages/game-engine/src/moves/endOfTurnCleanup.logic.ts`, `moves/seatChoice.resolve.ts`, `ui/uiState.build.ts` —
  **modified** — cleanup Step 8, kind arms + chain, the `recruitCosts` presence arm.
- `packages/game-engine/src/rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`, `villain/villainEffects.execute.ts` —
  **modified** — the primitive (contract file; D-24804).
- `packages/game-engine/src/rules/heroKeywords.ts`, `hero/heroEffects.execute.ts`, `setup/heroAbility.setup.ts` — **modified** —
  the keyword, handler + sets, RS-6 suppression.
- `packages/game-engine/src/rules/tacticHandlers.ts` — **modified** — two resolvers + dispatch arms.
- `scripts/convert-cards/apply-effect-markers.mjs`, `inputs/villain-effect-markers.json`, `apply-hero-ability-markers.mjs`,
  `inputs/hero-ability-markers.json` — **modified**; `data/cards/antm.json`, `chmp.json` — **generated**; `data/cards/amwp.json` —
  **rewritten by the marker script**.
- Generated / provenance: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `villain-mechanic-ledger.{json,csv}`,
  `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`,
  `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json`,
  `scripts/coverage/mechanic-provenance.json`, `scripts/coverage/tactic-provenance.json`, `docs/ai/coverage/live-verify.json`,
  `apps/dashboard/src/data/*` copies the regen rewrites; `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (in-play pin,
  only if it moves).
- Tests: `hero/sizeChangingGrant.test.ts` (new), `rules/villainAbility.types.test.ts`, `rules/heroKeywords.test.ts`,
  `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`; any existing test that
  pins Pym Particles' second-line parse (updated with the RS-6 reason).
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24804), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets; ESM only; Node v22+; human-style code — see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness, clocks or I/O; `for` loops, no `.reduce()`, no nested ternaries; moves never throw.
- `G` stays JSON: the overlay is a plain array, created at the first grant and deleted when empty. A moved sentinel is a STOP.
- Card data via the marker sources + reproducible regen (`cards:check`); never hand-edit generated card JSON. No per-card
  special-casing outside the marked keyword / primitive handler and the two tactic resolvers.

**Session protocol:** STOP and report if a price changes for a card no grant targets (other than Pym Particles' RS-6 fix), if
any sentinel moves, if a pick parks with fewer than two options, or if Pym Particles' line 2 still produces `sizeChangingClasses`.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `G.hqSizeChangingGrants?: HqSizeChangingGrant[]` (RS-1, RS-2); `resolveRecruitCost` signature unchanged.
- Seat-choice kinds `'size-changing-grant'` and `'size-changing-class-pick'`; `PendingSeatChoice.sizeChangingGrant?`;
  `SeatChoiceOption.heroClass?` (not projected beyond `label`).
- Villain primitive `hq-hero-gains-size-changing` (`:<mode>:<classes>`); hero keyword `hq-hero-gains-size-changing-tech`.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation).
- **No conflict:** six printed effects that do nothing today resolve as printed; a mis-parsed price is corrected.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — printed card abilities, nothing bought.
- **Determinism preservation:** no randomness; the overlay and the picks are plain `G` state, absent in every match that does
  not play the six cards. Seed-PAR is scheme-keyed. Replays of pre-WP-862 matches diverge on re-execution if they selected antm
  Ant-Man (the RS-6 setup change) or played any of the six cards; stored `competitive_scores` rows stay frozen (D-24616 §5);
  in-flight matches keep their setup-built hooks, so live-verify needs a match created after the deploy.

## Funding Surface Gate

N/A — no nav, pricing or funding surface; option labels in the existing seat-choice prompt.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. Each of the six effects grants (or for Shrinksperiments replaces) Size-Changing on the chosen HQ Hero per RS-5, and that
   Hero's recruit price (move, legal moves, `recruitCosts`) drops by 2 per granted class the recruiting player has played.
2. Zero / one / two-plus eligible Heroes give a logged no-op / an immediate grant / a seat-choice pick (RS-3); if-none effects
   never offer a Hero with any Size-Changing.
3. Shrinking Research Budget grants each eligible Hero its own class; dual-class Heroes chain one class pick each (RS-4).
4. This-turn grants are gone after the turn; Shrinking Research Budget grants last while the card stays in the HQ (RS-2).
5. A grant discounts only its own card and only while that card is in `G.hq`; every other HQ card is priced as before.
6. Pym Particles' line 2 records no `size-changing` keyword or class; its recruit price takes only its Microscopic steps.
7. `cards:check` reproduces the card data; every feed `:check` exits 0; the villain ledger lists the three villains executable,
   the effect index lists both tactics executable, and the hero ledger lists `hq-hero-gains-size-changing-tech` for `antm/ant-man`.
8. Engine + arena-client + dashboard suites green; `pnpm -r build` 0; `finalStateHash` sentinels unchanged.

## Verification Steps

Regenerate (in order, after the engine change builds):

- Add the provenance and tactic-provenance rows and the pending `live-verify.json` rows first.
- `node scripts/convert-cards/apply-effect-markers.mjs` and `node scripts/convert-cards/apply-hero-ability-markers.mjs` — exit 0;
  only `antm.json`, `amwp.json`, `chmp.json` change.
- `pnpm -r build` — exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:heroes`, `pnpm ledger:villains`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`,
  `pnpm sim:coverage --update-baseline`, `pnpm --filter @legendary-arena/dashboard prebuild:coverage` — each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test` — green (baseline 6269; record the exact delta; expect at least +20).
- `pnpm --filter @legendary-arena/arena-client test`, `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`,
  `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`.
- `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
  `node scripts/check-number-ledger.mjs --check` — at govern-close.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + arena-client + dashboard suites green; `pnpm -r build` 0.
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance rows added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** a match **created after the deploy** (`isMatchOlderThanServer: false`) with Sporr in the
      Villain Deck and two or more Heroes in the HQ: fight Sporr → the pick (Play Diagnostics `uiStateSnapshot.pendingSeatChoice`
      options), choose a Hero, play a Tech card → that slot's `recruitCosts` entry is 2 below its printed cost; after End Turn the
      price is printed again. Plus Pym Particles played with an eligible Hero — confirmed live, or operator-pending in `STATUS.md`
      with the pending `live-verify.json` rows.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24804 → Active; `WORK_INDEX.md` checked; `EC_INDEX.md` Done; mindmap ✅
      + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] No files outside `## Files Expected to Change` were modified — `git diff --name-only origin/main...HEAD` checked.

## Reserved Decision (lands at execution)

D-24804 — Effects that grant or remove Size-Changing during play write a lazy overlay, `G.hqSizeChangingGrants` (`{ cardId,
classes, replacesPrinted, expiresAtEndOfTurn }`, grant order, deleted when empty), keyed by the copy-unique Hero instance id and
read only by `resolveRecruitCost` (signature unchanged) while that card is in `G.hq`. A card's Size-Changing is its printed lists,
then each grant: replace sets the classes and drops Microscopic; add unions the classes (a class counts once). "This turn" grants
clear at end of turn; Shrinking Research Budget's (no printed duration) lasts while the card stays in the HQ (an interpretation,
flagged for the operator); end of turn prunes grants whose card left the HQ. The pick is the WP-684 seat choice addressed to the
active player (0 eligible → logged no-op, 1 → immediate, ≥2 → recruitable-then-priciest-first pick, default 0; an open seat choice
blocks only the park, the WP-860 posture). Class words in the printed order Strength, Instinct, Covert, Tech, Ranged. Pym
Particles' grant line no longer parses as its own Size-Changing [Tech] (D-24801 parse correction; changes setup state for every
match with antm Ant-Man). Villain primitive `hq-hero-gains-size-changing:<if-none|add|replace>:<classes>`, hero keyword
`hq-hero-gains-size-changing-tech`, tactic resolvers for Alien Dragon Technology and Shrinking Research Budget (its Transform
stays unimplemented). `resolveFightPrice` and `G.fightSizeChanging` are unchanged. Replays of pre-WP-862 matches with antm Ant-Man
or these cards diverge; stored competitive rows stay frozen (D-24616 §5).

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1:** NOT READY, three PS items, all folded: PS-1 `HERO_CLASSES` is `tech, covert, strength, ranged,
  instinct`, not any order the draft stated — a local printed-order constant is now locked (RS-3); PS-2 Hero instance ids are
  copy-unique (`…#copyIndex`), so the slot-keying premise and its "same-id refill" limitation were false — the overlay is now keyed
  by `cardId` and read only while the card is in `G.hq`, which drops the `hqIndex` plumbing (`recruitHero`, `ai.legalMoves` and
  the `resolveRecruitCost` signature no longer change) and the two fabricated-fixture tests; PS-3 `tactic-provenance.json` added
  (scope, files, rows). RS folded: line refs re-baselined; the open-choice guard cites WP-860 and gates only the park (SRB
  single-class grants still apply); "HQ frozen" reworded (other resolve moves can change it; applies re-check); the villain result
  defined (RS-7); Darren Cross's Transform out of scope; Haunted Heroes ordered after recruitable ones; the RS-6 determinism note
  widened to every match with antm Ant-Man.
- **Pre-flight round 2:** NOT READY on one PS, folded: the RS-4 chain read "the slot above the applied card" though options now
  carry only `cardId` and nothing records a slot — replaced by a fresh scan from slot 0 (every earlier eligible card already holds a
  grant), dropping `readSizeChangingClassPickSlot` / `afterSlot`. RS folded: a Hero refilled into the HQ during the chain may be
  offered (accepted, one sentence); "abilityIndex 1 (second line)" wording. Gate verdict: **READY TO EXECUTE** once folded (no
  third run required).
- **Copilot round 1:** RISK → HOLD, seven wording findings, all folded: (26/4) the primitive is keyword-less, so the executor
  drops its result — the handler self-narrates with a `Fight effect: ` prefix and returns `{ targets: [] }` (RS-7); (4/6) the class
  pick carries no source — the chain passes the `SHRINKING_RESEARCH_BUDGET_TACTIC_ID` constant; (11/12) the last-entry assert, the
  WP-837 `slice(34)` pin and the ordered `expectedKeywords` are sanctioned pin edits; (26) the no-class SRB line locked, the timeout
  path logs nothing; (27) the WORK_INDEX row and two line refs corrected; (30) the SRB lifetime consequence and its one-value
  reversal stated in RS-2; (21) class values limited to the RS-3 slugs. Verified clean on the other 23 modes.
- **Copilot round 2:** RISK → HOLD, three wording fixes, folded: the EC After Completing line now names only `finalStateHash` /
  golden-hash pins (the sanctioned test pins may change); `SHRINKING_RESEARCH_BUDGET_TACTIC_ID` is defined once in
  `hero/sizeChangingGrant.logic.ts` (no cycle, no second copy); the EC folds rewrapped and three duplicate lines trimmed to stay
  under the ceiling. Gate verdict after the folds: **PASS** (no further pre-flight or copilot run required).

## Lint Gate Self-Review (00.3)

- **§1 structure:** every template section present and non-empty; Out of Scope names the Microverse scheme, Look Out for the Little
  Guy, Darren Cross's Transform, other HQ "has Size-Changing" readers, a client badge, a bot policy, Tim Boo Ba, the wiki page, and
  new queue / move / UIState / client / server surfaces. **PASS.**
- **§2 constraints:** full-file output, ESM, Node v22+, `00.6-code-style.md` cited; determinism, G-JSON / lazy overlay, sentinel STOP,
  marker-regen and no-special-casing constraints; session protocol (four STOP triggers); locked values → EC. **PASS.**
- **§3 Assumes:** D-24801 / D-24802 / WP-684 / 683 / 821 / 860 / 497 and every helper, type, pin, chain point, guard and generated-data
  fact the change reads, with file and line, verified by two pre-flight rounds. **PASS.**
- **§4 Context:** why an overlay keyed by instance id, why one WP (and why the Microverse scheme is not in it), observed state,
  pending-choice rules, determinism; RS-1..RS-8 locked; ARCHITECTURE sections, DECISIONS scan list, 00.6. **PASS.**
- **§5 files:** every file listed with role and full path (13 engine source, 4 script / input, 3 card data, generated / provenance
  incl. `tactic-provenance.json`, tests, governance). **PASS.**
- **§6 naming:** full words (`hqSizeChangingGrants`, `expiresAtEndOfTurn`, `getHqCardSizeChanging`, `resolveShrinkingResearchBudget`);
  data slugs verbatim; no 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; engine + card data only; no registry import in the engine; no client or server
  change (the generic seat-choice prompt and the existing `recruitCosts` projection). **PASS.**
- **§9 Windows:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`; hooks from the real parsers on committed card data; the real `resolveSeatChoice` end to
  end; runtime pins (D-24372); no fabricated id fixtures (copy-unique ids). **PASS.**
- **§13 verification:** exact regen and check commands with expected exits; engine baseline 6269 recorded. **PASS.**
- **§14 / §15:** 8 binary criteria; DoD names STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap / ledger, the scope-boundary
  check and the D-24026 live check (§15.1, operator-pending fallback with `live-verify.json` rows); **§15.2** `**Risk Tier:** MEDIUM`
  in the WP header and verbatim in the EC (not HIGH, so no threat-model section). **PASS.**
- **§16 code-style:** reuse of the seat-choice park / chain / generic prompt and the D-24801 discount; one grant writer and one
  reader (no duplicated RS-1 logic); `for` loops, no `.reduce()`, no nested ternaries; `// why:` locations in the EC. **PASS.**
- **§17 Vision:** clauses §1/§2/§8/§10/§22, no-conflict line, NG-1 line, determinism line (incl. the antm Ant-Man setup change).
  **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** baseline SHA and counts re-recorded at execution. **PASS.**
  Contract files: `types.ts` and `villainAbility.types.ts` gain optional fields / one appended primitive, covered by D-24804.
- **§20 funding:** N/A with the statement above. **§21 API catalog:** N/A (no endpoint). **PASS.**
