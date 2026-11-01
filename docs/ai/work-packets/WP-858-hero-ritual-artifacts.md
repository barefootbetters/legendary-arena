# WP-858 — Hero Artifacts you control and Ritual Artifacts: Doctor Voodoo's Staff of Legba and Medallion of Many Loas (Game Engine + Arena Client + card data)

**Status:** Draft 2026-10-31 (EC-896; D-24794 reserved) — pre-flight READY TO EXECUTE; copilot PASS
**Layer:** Game Engine (controlled-Artifact record, end-of-turn keep, Ritual use move + legality predicate, two ritual keywords,
two turn-economy ledgers, "Hero Classes you have" read) + Arena Client (show controlled Artifacts, a Use button) + card data
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** WP-783 / D-24629 (Phasing: the non-core, internally gated player move + one shared legality predicate projected
to the client — the pattern this WP copies) ✅, WP-803 / D-24692 (Out of Time: a per-player `G` card record shown in front of the
player, `outOfTimeCards`, PUBLIC, rendered by `PlayedCardsRow.vue`, plus the `turnEconomy.outOfTimePlayedCardIds` "still played
this turn" ledger — the patterns this WP copies) ✅, WP-842 / D-24776 (`recruitSidekick`) ✅, WP-648 / D-24460 (`recruitOfficer`) ✅,
WP-856 / D-24792 (the `dstr` Doctor Voodoo marker entries this WP's entries sit beside) ✅
**Siblings (not deps):** WP-857 / D-24793 (hero Feast) and WP-859 / D-24795 (reserved) may add `HERO_KEYWORDS` entries; see
§Context "Coordination".

## Goal

Make Doctor Voodoo's two **Ritual Artifacts** do what they print, using the Artifact rules (rules v23 p.17):

- `dstr/doctor-voodoo/staff-of-legba` — "[Ritual Artifact] — If you recruited a Hero, you may discard Staff of Legba to get
  +[icon:attack] equal to that Hero's cost."
- `dstr/doctor-voodoo/medallion-of-many-loas` — "[Ritual Artifact] — If you have at least three Hero Classes, you may discard
  Medallion of Many Loas to get +1[icon:attack] for each Hero Class you have, including this one."

Today Staff of Legba logs an "attack-no-magnitude … parse-unrecognized" hollow on every play and does nothing; Medallion of Many
Loas gives a phantom flat +1 Attack on every play. Both go to the discard pile at end of turn like any card.

After this WP: playing either card gives nothing by itself. At end of turn it **stays in front of the player** (the player
"controls" it) instead of going to the discard pile, and stays there turn after turn. During the player's own turn, once the
card's condition holds that turn, a **Use** button on the card discards it for its reward: Staff of Legba +Attack equal to the
highest printed cost among the Heroes the player recruited this turn; Medallion of Many Loas +1 Attack per Hero Class the player
has (hand, cards played this turn, and Artifacts they control, including the Medallion). Using it is optional; an unused Artifact
waits for a later turn. The Artifact can be used the turn it is played.

## User-Visible Impact

`play.legendary-arena.com`:
- Playing Staff of Legba or Medallion of Many Loas adds no Attack and logs no hollow.
- At end of turn the card does not go to the discard pile; it shows in front of the player in the played-cards row's
  "Artifacts — N" group, and the log reads "Player N keeps Staff of Legba in front of them as an Artifact."
- When its condition holds on the player's turn (Staff: a Hero recruited this turn; Medallion: three or more Hero Classes), the
  card shows a **Use** button — on the played-cards row the turn it is played, on the Artifacts group after that. Clicking it
  moves the card to the discard pile and adds the Attack; the log reads "Player N used Staff of Legba's Ritual: discarded it."
  followed by the shared "Player N gained +5 attack from Staff of Legba." line.
- Perfect Teamwork / Avengers Assemble! / Spectrum count the classes of the Artifacts the player controls (rules: "your Heroes"
  include Hero Artifacts you control).
- Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` = `e064d497` (the WP-859 reserve, #3114, after the WP-858 reserve #3113); re-recorded at commit.
- Rules v23 p.17 "Artifacts" / "Ritual Artifacts" (`docs/legendary-universal-rules-v23.md` L904-996): a played Artifact stays in
  front of you at end of turn ("you control it"); you can use it the turn you play it; you can control several with the same
  name; "your Heroes" / "Heroes you have" include Hero Artifacts you control; you only "played" it on the turn you put it out;
  you can only use Artifacts during your turn unless the card says otherwise; a Ritual Artifact may be discarded for its effect
  once its condition was fulfilled this turn, even if the condition was met before the Artifact was put out; using it is
  optional; you can use as many as you like. L3441-3453: a card you played that moved elsewhere still counts as "played this
  turn".
- `moves/phaseCard.ts` (WP-783): `export function hasAnyPendingChoice(G)` (~82) and `phasingOptions(G, playerId)` (~133), the
  single legality predicate shared by the move and the `economy.phasingOptions` projection; the predicate does not check the
  seat (callers pass `ctx.currentPlayer`). `phaseCard` is registered in `game.ts` (~596) as `{ move: phaseCard, client: false }`
  (D-10008) but is not a `CoreMoveName`, not in `MOVE_ALLOWED_STAGES`, not emitted by `getLegalMoves`, absent from the simulation /
  PAR move maps. `phasing` is a `HAND_ACTION_EXECUTED_KEYWORDS` member (`hero/heroEffects.execute.ts` ~396, joined into
  `MVP_KEYWORDS` ~487): at play `classifyHeroEffectReason` (~1145-1158) returns `applied` with no warning (only a hash-excluded
  `no-handler` effect trace).
- `executeSingleEffect(G, ctx, playerID, cardId, effect)` (`heroEffects.execute.ts` ~7187); `pushLog` (`log/logPush.ts`).
- `G.outOfTimeCards?: Record<string, CardExtId[]>` (`types.ts` ~2468) → `uiState.build.ts` (~847, `buildDisplayEntries`) →
  `UIPlayerState.outOfTimeCards?: UIDisplayEntry[]`, PUBLIC in `uiState.filter.ts` (~290 / ~433, `deepCopyDisplayEntries`) →
  `PlayedCardsRow.vue` prop `outOfTimeCards`, wired from `PlayDesktop.vue` / `PlayMobile.vue` (page wiring tested in
  `PlayDesktop.test.ts` ~650 / `PlayMobile.test.ts` ~225). Its optional UI fields are pinned in `ui/uiState.types.drift.test.ts`
  (~1021 phasing, ~1884 Out of Time).
- Turn economy: `TurnEconomy` (`economy/economy.types.ts`) lazy optional fields are carried across every rebuild by the single
  carry chokepoint `carryConversionFlag` (`economy/economy.logic.ts` ~523, its `CarriedTurnFields` pick list ~492) and dropped by
  `resetTurnEconomy` (~1322) at the next turn start; `outOfTimePlayedCardIds` (+ its setter ~1073) is the precedent.
  `playedCardIdsThisTurn` (`hero/splitCard.logic.ts` ~227) unions `inPlay` with `sidekicksReturnedThisTurn` and
  `outOfTimePlayedCardIds`; `heroClassMatch` reads it.
- `moves/endOfTurnCleanup.logic.ts` `applyEndOfTurnCleanup` (~58) moves all of `inPlay` to `discard`; it is the only bulk discard
  of `inPlay`, called from `game.ts`, `coreMoves.impl.ts` (endTurn), `rules/enigmaCode.logic.ts`, `replay/replay.execute.ts`,
  `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts` and the fixture runner — so a change there reaches every mirror.
- `hero/heroConditions.evaluate.ts` `countDistinctHeroClassesYouHave(G, playerID)` (~646) counts hand + still-in-play classes; it
  backs the `distinct-hero-classes-played-this-turn` count source, the `distinctHeroClassesAtLeast` (Spectrum) gate and its gate
  text (~887), and the villain per-class read (`villain/villainEffects.execute.ts` ~3030). `collectDistinctHeroClassCards`
  (`hero/heroCountSource.resolve.ts` ~767) is its diagnostic `countedInputs` mirror.
- Recruits: `moves/recruitHero.ts`, `recruitOfficer.ts`, `recruitSidekick.ts` each compute a `requiredCost` and spend it; printed
  costs live in `G.cardStats` (Officer 3, Sidekick 2, `buildInitialGameState.ts` ~566). No per-turn record of recruits exists.
- Parser (`setup/heroAbility.setup.ts`): `KEYWORD_PATTERN` (~149) does not match the printed `[keyword:Ritual Artifact]` (space);
  a marker `[keyword:name(:N)]` whose name is a `HeroKeyword` becomes that keyword with magnitude N through the generic path (no
  arm needed). `SELF_COMPUTED_ATTACK_KEYWORDS` (~798, D-24670) is the set of keywords that compute their own "+[icon:attack]
  equal to …", whose lines drop the plain `attack` keyword and magnitude. `HERO_PARSER_RECOGNIZED_MARKER_NAMES` lists only names
  that are NOT `HeroKeyword`s (pinned by `setup/heroAbility.setup.test.ts` ~1965).
- `data/cards/dstr.json` is GENERATED; markers live in `scripts/convert-cards/inputs/hero-ability-markers.json`, validated by
  `apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN` (~132). `scripts/hero-mechanic-ledger.mjs`
  `MOVE_EXECUTED_HANDLER_MODULES` (~100) maps move-executed keywords (`phasing`) to their module.
- Pins: `HERO_KEYWORDS.length === 87` at three sites (`rules/heroKeywords.test.ts` ~67; `rules/heroAbility.setup.test.ts` ~692 with
  its ordered `expectedKeywords` list; `setup/heroAbility.setup.test.ts` ~1603); the `heroEffects.execute.test.ts` ~169-195 "every
  MVP_KEYWORD is handled directly … or at …" category test; `game.test.ts` ~277 "exactly 54 moves".

## Context (Read First)

- **Parse today (observed, `buildHeroAbilityHooks` on the committed `dstr.json`):** `staff-of-legba#0..2`:
  `{ timing: 'onPlay', keywords: ['attack'], effects: [{ type: 'attack' }] }` (no magnitude → the `attack-no-magnitude` hollow);
  `medallion-of-many-loas#0..4`: `{ keywords: ['attack'], effects: [{ type: 'attack', magnitude: 1 }] }` (flat +1 every play).
- **Target parse (pre-flight probe on a throwaway copy, reverted):** with both keywords in `HERO_KEYWORDS` and
  `SELF_COMPUTED_ATTACK_KEYWORDS` and the markers appended, the generic path yields Staff `{ keywords: ['ritual-recruited-hero'],
  effects: [{ type: 'ritual-recruited-hero' }] }` and Medallion `{ keywords: ['ritual-hero-classes'], effects: [{ type:
  'ritual-hero-classes', magnitude: 3 }] }`.
- **Observed live (operator matches `lpGhTDyrlXK` and `D6VA6jR_JVD`, 2026-10-31, server `f88c326b`):** Staff of Legba logged the
  hollow on every play; Medallion logged "gained +1 attack" on every play.
- **Why both halves in one WP.** Persisting an Artifact without a way to use it strands the card; a Use button without persistence
  fails "save it for a future turn". The record is only visible through the client, so engine + client ship together (the WP-803
  precedent).
- **Which cards become Artifacts: only marked ones.** A card is a modeled Ritual Artifact when a hook carries a ritual keyword.
  Every other Artifact-keyword card (six other dstr Ritual Artifacts, gotg "Once per turn", mgtg Triggered, asrd / fear Thrown —
  34 lines across 5 sets) keeps today's behaviour; keeping a card whose ability is unmodeled would take it out of the deck for
  nothing.
- **Two ritual keywords, executed by the move.** `ritual-recruited-hero` (Staff) and `ritual-hero-classes` (Medallion, magnitude
  = threshold 3): `HeroKeyword`s with no `HERO_EFFECT_HANDLERS` entry, in a new `RITUAL_ARTIFACT_EXECUTED_KEYWORDS` category beside
  `HAND_ACTION_EXECUTED_KEYWORDS` (duplicate-first: they execute at different sites), so the play-time visit classifies `applied`
  and does nothing — the `phasing` posture. The move computes the reward from a closed two-case dispatch on the effect type.
- **Two turn-economy ledgers (lazy, reset each turn by `resetTurnEconomy`, carried by `carryConversionFlag`):**
  - `highestRecruitedHeroCost?: number` — the highest printed cost the current player recruited this turn (rules: the condition may
    be met before the Staff is played). Recorded by the three recruit moves only in a match whose hooks carry
    `ritual-recruited-hero` (one scan of `G.heroAbilityHooks`).
  - `ritualUsedPlayedCardIds?: CardExtId[]` — Rituals used from `inPlay` this turn, unioned into `playedCardIdsThisTurn` so a used
    Medallion (Tech) still satisfies a later `[hc:tech]:` superpower (L3441-3453; the Out of Time ledger precedent).
  Both are absent in every match without the marked cards, so `finalStateHash` sentinels stay byte-identical; no turn-boundary
  delete is needed.
- **The controlled record.** `G.controlledArtifacts?: Record<string, CardExtId[]>` — lazy, per player, written only by the cleanup
  (keep) and the use move (remove; the list key is deleted when empty, the map when empty). Never cleared at a turn boundary.
- **"Hero Classes you have".** `countDistinctHeroClassesYouHave` gains a third half: the printed class(es) of each controlled
  Artifact (rules v23 L930-932). This also reaches Perfect Teamwork / Avengers Assemble! / Spectrum, the Spectrum gate text and the
  villain per-class read (`villainEffects.execute.ts` ~3030), but only while a marked Artifact is controlled.
  `collectDistinctHeroClassCards` mirrors the third loop so the diagnostic `countedInputs` stay consistent with the count. Other
  "your Heroes" readers (Reveal-a-Hero gates, "KO one of your Heroes") are a named follow-up.
- **Bots.** Bots never use a Ritual (not emitted by `getLegalMoves`, the phasing precedent), so a bot keeps its marked Artifacts
  unused. Today a bot gets a phantom +1 (Medallion) or a hollow (Staff); after, nothing. A bot use policy is a follow-up.
- **Import cycle.** `endOfTurnCleanup.logic.ts` and the recruit moves import `ritualArtifact.ts`, which imports `phaseCard.ts` /
  `heroEffects.execute.ts` — the known runtime-safe cycle (WP-845 note, `heroEffects.execute.ts` ~116). Imported bindings are read
  only inside function bodies; no module-level constant derived from an import.
- **Coordination.** WP-857 (drafted) adds one `HERO_KEYWORDS` entry; WP-859 (reserved) may too. Whichever executes later rebases
  the three pins and appends to `expectedKeywords` after the landed names; this WP adds 2 to whatever HEAD shows.
- **Same-hero neighbour (out of scope):** Commune with the Spirit World ("You may discard an Artifact you control or three cards
  from your hand. If you do, KO a card from your hand or discard pile.") needs a two-way cost choice and a KO prompt; it reads this
  WP's controlled record, so it is the natural next packet. It keeps its `artifact` hollow until then.
- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, §Rule Execution Pipeline, Principles #1 / #2; §Persistence Boundary.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 (`[keyword:X]`, §5.1). `docs/ai/DECISIONS.md` — scan D-24629, D-24692,
  D-24460, D-24776, D-24670, D-24470, D-12803, D-24372, D-10008 before coding. `docs/ai/REFERENCE/00.6-code-style.md`.

### RS-1 — "that Hero's cost" when several Heroes were recruited (default locked)

The highest printed cost recruited this turn (the player would always pick it; D-24470 pure-upside posture). Officers (3) and
Sidekicks (2) are Heroes. Each move records its own computed `requiredCost` (the printed cost with that move's fallback), not a
re-read of `G.cardStats`.

### RS-2 — What "recruited a Hero" counts (default locked)

The three player recruit moves (`recruitHero` incl. Wall-Crawl's deck-top placement, `recruitOfficer`, `recruitSidekick`).
Effect-driven gains (Bitter Captor, "gain a Sidekick") are not counted; widening is a follow-up.

### RS-3 — When a Ritual can be used (default locked)

The controlling player's own turn, stage `main`, no pending choice open — the `phasingOptions` window. Book of the Vishanti's "any
player's turn" is not modeled here.

### RS-4 — Audience (default locked)

`controlledArtifacts` is PUBLIC (cards on the table), the `outOfTimeCards` disposition. `economy.ritualArtifactOptions` is the
active player's list, the `phasingOptions` disposition.

### RS-6 — When Medallion's condition is read (default locked at copilot)

Both the "at least three Hero Classes" threshold and the reward are read at use time. Having had three classes earlier in the turn
but not now does not qualify (a conservative reading of L962 "if you have fulfilled the listed Ritual condition this turn" for a
state condition; open to revisit). Staff's condition is an event ("recruited a Hero"), so the turn record holds it.

### RS-5 — A Ritual used from play still counts as played this turn (default locked at pre-flight)

Rules v23 L3441-3453. Recorded in `turnEconomy.ritualUsedPlayedCardIds` and unioned in `playedCardIdsThisTurn`. A Ritual used from
the controlled group was not played this turn and is not added.

## Scope (In)

- **Keywords** (`rules/heroKeywords.ts`): `HeroKeyword` and `HERO_KEYWORDS` gain `ritual-recruited-hero` and
  `ritual-hero-classes`, appended last, in lockstep.
- **Executor category** (`hero/heroEffects.execute.ts`): `export const RITUAL_ARTIFACT_EXECUTED_KEYWORDS: readonly HeroKeyword[] =
  ['ritual-recruited-hero', 'ritual-hero-classes']`, joined into `MVP_KEYWORDS` exactly as `HAND_ACTION_EXECUTED_KEYWORDS`; not in
  `HANDLED_KEYWORDS`, no `HERO_EFFECT_HANDLERS` entry.
- **Parser** (`setup/heroAbility.setup.ts`): add both keywords to `SELF_COMPUTED_ATTACK_KEYWORDS` (D-24670) — no new arm, no
  `HERO_PARSER_RECOGNIZED_MARKER_NAMES` entry. Target hooks as in §Context.
- **Markers** (`hero-ability-markers.json` → `dstr`, after the doctor-voodoo Possessed entries): `{ heroSlug: "doctor-voodoo",
  cardSlug: "staff-of-legba", abilityIndex: 0, markupToken: "[keyword:ritual-recruited-hero]" }`, then `{ …, cardSlug:
  "medallion-of-many-loas", …, markupToken: "[keyword:ritual-hero-classes:3]" }`. `VALID_TOKEN_PATTERN` gains
  `^\[keyword:ritual-recruited-hero\]$` and `^\[keyword:ritual-hero-classes:[1-9]\d*\]$`; its "locked token forms" error message
  lists both. Regenerate `dstr.json`.
- **Turn economy** (`economy/economy.types.ts`, `economy/economy.logic.ts`): `TurnEconomy` gains `highestRecruitedHeroCost?:
  number` and `ritualUsedPlayedCardIds?: CardExtId[]`; both join `CarriedTurnFields` and `carryConversionFlag` (present-only);
  setters `recordRecruitedHeroCost(economy, cost): TurnEconomy` (keeps the max) and `recordRitualUsedPlayed(economy, cardId):
  TurnEconomy` (append), each spreading the carry like `recordOutOfTimePlayed`. `resetTurnEconomy` unchanged (drops both).
- **Played this turn** (`hero/splitCard.logic.ts`): `playedCardIdsThisTurn` unions `G.turnEconomy?.ritualUsedPlayedCardIds`
  (optional chain, the minimal-G guard), skipping ids already present. The function today returns early when
  `outOfTimePlayedCardIds` is undefined (~245-248), which is always the case in a Voodoo match, so restructure it so the ritual
  union runs whether or not the Out of Time ledger exists (no early return before it).
- **New module** `moves/ritualArtifact.ts`:
  - `isRitualArtifact(G, cardId): boolean` — a hook for the card carries a `RITUAL_ARTIFACT_EXECUTED_KEYWORDS` keyword
    (`getHooksForCard`; `Array.isArray(G.heroAbilityHooks)` guard).
  - `matchHasRecruitedHeroRitual(G): boolean` — some hook in `G.heroAbilityHooks` carries `ritual-recruited-hero`.
  - `ritualArtifactOptions(G, playerId): CardExtId[]` — the single legality predicate; does not check the seat (callers pass
    `ctx.currentPlayer`, the `phasingOptions` posture). `[]` unless `G.currentStage === 'main'` and `!hasAnyPendingChoice(G)`;
    candidates in order: distinct `playerZones.inPlay` ids, then `G.controlledArtifacts?.[playerId]`; listed when
    `isRitualArtifact` and the condition holds (Staff: `G.turnEconomy?.highestRecruitedHeroCost !== undefined`; Medallion:
    `countDistinctHeroClassesYouHave(G, playerId) >= magnitude`). The dispatch on the hook's ritual effect type is an exhaustive
    `if / else if`; an unrecognized ritual type is not listed (and its reward is 0), so further Rituals are added as new branches.
  - `ritualArtifactReward(G, playerId, cardId): number` — Staff: `highestRecruitedHeroCost`; Medallion:
    `countDistinctHeroClassesYouHave`, read BEFORE the card leaves ("including this one").
  - `useRitualArtifact({ G, ctx, ...context }, { cardId })` — validate `cardId` (non-empty string); stage gate; require
    `ritualArtifactOptions(G, ctx.currentPlayer).includes(cardId)`; compute the reward; move the card to the player's `discard`
    with `moveCardFromZone` (from `inPlay` — then `recordRitualUsedPlayed` — else from the controlled list, deleting the empty
    list key and then the empty map); `pushLog` "Player N used <card>'s Ritual: discarded it."; then, only when `reward > 0`,
    `executeSingleEffect(G, context, playerId, cardId, { type: 'attack', magnitude: reward })` (the `flat-attack` precedent), which
    logs the shared "Player N gained +R attack from <card>." line. A reward of 0 discards with no attack call. Returns void, never
    throws.
- **Cleanup** (`moves/endOfTurnCleanup.logic.ts`): before the in-play discard, each `inPlay` card for which `isRitualArtifact`
  holds moves to `G.controlledArtifacts[playerID]` (lazy) with `pushLog` "Player N keeps <card> in front of them as an Artifact.";
  the rest of `inPlay` discards as today; hand / draw unchanged.
- **Recruit record** (`recruitHero.ts`, `recruitOfficer.ts`, `recruitSidekick.ts`): after the spend, when
  `matchHasRecruitedHeroRitual(G)`, `G.turnEconomy = recordRecruitedHeroCost(G.turnEconomy, requiredCost)`.
- **Classes you have** (`hero/heroConditions.evaluate.ts`): `countDistinctHeroClassesYouHave` adds a third loop over
  `G.controlledArtifacts?.[playerID] ?? []`, `heroClass` / `heroClass2` from `G.cardTraits` (printed only). The same third loop in
  `collectDistinctHeroClassCards` (`hero/heroCountSource.resolve.ts`).
- **Final and live VP** (`scoring/scoring.logic.ts` ~139, `economy/bloodFrenzy.logic.ts` ~73; the two lists are kept identical so
  live VP == final VP): the "all your cards" list gains the player's controlled Artifacts (`...(gameState.controlledArtifacts?.[playerId]
  ?? [])` in `scoring.logic.ts`, `...(G.controlledArtifacts?.[playerId] ?? [])` in `bloodFrenzy.logic.ts`), so Ultron's "+1 for each
  tech Hero you have among all your cards" counts a Medallion (Tech) still in front of the player at game end.
- **Spectrum gate text** (`hero/heroConditions.evaluate.ts` ~887): "in hand or play" becomes "in hand, play, or Artifacts you
  control".
- **Count-marker gate** (`scripts/check-hero-count-markers.mjs` ~174-181): the DEFERRED `medallion-of-many-loas` entry's reason is
  reworded to "Ritual Artifact modeled by WP-858 / D-24794 (`ritual-hero-classes`); not a per-count onPlay grant." (the entry
  stays: the line still carries no per-count marker).
- **Move registration** (`game.ts`, 01.5 wiring): `useRitualArtifact: { move: useRitualArtifact, client: false }` (D-10008, the
  `phaseCard` shape). Not a `CoreMoveName`, not in `MOVE_ALLOWED_STAGES`, not in `getLegalMoves`, absent from simulation / PAR maps.
- **Types** (`types.ts`): `controlledArtifacts?: Record<string, CardExtId[]>` beside `outOfTimeCards`; never set in `Game.setup`.
- **UIState** (D-12803 five steps):
  1. `ui/uiState.types.ts`: `UIPlayerState.controlledArtifacts?: UIDisplayEntry[]`; `UITurnEconomyState.ritualArtifactOptions?:
     CardExtId[]`.
  2. `ui/uiState.build.ts`: `controlledArtifacts` via `buildDisplayEntries` when non-empty (the `outOfTimeCards` block);
     `ritualArtifactOptions` for `ctx.currentPlayer` when non-empty (the `phasingOptions` spread).
  3. `ui/uiState.filter.ts`: `controlledArtifacts` PUBLIC in both player branches (the `outOfTimeCards` lines);
     `ritualArtifactOptions` copied beside `phasingOptions`.
  4. `ui/uiState.filter.test.ts`: both survive for the owner; `controlledArtifacts` survives for another player and a spectator.
     `ui/uiState.types.drift.test.ts`: keyset pins on a built projection for both fields (the phasing / Out of Time pins).
  5. Live: Play Diagnostics `uiStateSnapshot.players[0].controlledArtifacts` lists the kept card, and
     `uiStateSnapshot.economy.ritualArtifactOptions` lists it when usable.
- **Client** (`apps/arena-client`):
  - `components/play/uiMoveName.types.ts`: `| 'useRitualArtifact'` with a `// why:` (WP-858 / D-24794, `{ cardId }`).
  - `components/play/PlayedCardsRow.vue`: props `controlledArtifacts: readonly UIDisplayEntry[]` (default `[]`), `ritualCardIds:
    readonly string[]` (default `[]`) and an optional `submitMove` (the `HandRow` prop shape). A group "Artifacts — N" after the Out
    of Time group when non-empty; a **Use** button (`data-testid="use-ritual-artifact"`) on any played or controlled tile whose
    `extId` is in `ritualCardIds`, calling `submitMove('useRitualArtifact', { cardId })`. Controlled tiles are not counted in
    "Played This Turn — N"; the empty-state condition (~139) also requires `controlledArtifacts.length === 0`.
  - `pages/PlayDesktop.vue`, `pages/PlayMobile.vue`: pass `viewer.controlledArtifacts ?? []`,
    `snapshot.economy.ritualArtifactOptions ?? []` and `submitMove`.
- **Ledger / coverage:** `scripts/hero-mechanic-ledger.mjs` `MOVE_EXECUTED_HANDLER_MODULES` gains both keywords →
  `packages/game-engine/src/moves/ritualArtifact.ts`; `scripts/coverage/mechanic-provenance.json` rows `ritual-recruited-hero` and
  `ritual-hero-classes` (WP-858 / D-24794); pending `docs/ai/coverage/live-verify.json` rows
  `dstr/doctor-voodoo|ritual-recruited-hero` and `dstr/doctor-voodoo|ritual-hero-classes`; regenerate `ledger:heroes`,
  `effect-index`, `mechanics:metadata`, `sim:runtime-observed`, `sim:coverage --update-baseline`, the dashboard coverage copies (+
  the in-play pin only if it moves, with a dated comment).
- **Tests** (hooks from the real parser on the committed `dstr.json`; never a hand-built hook):
  - New `moves/ritualArtifact.test.ts`: the two target parses (no `attack` effect); playing either adds 0 Attack and records no
    hollow; cleanup keeps a played Staff in `controlledArtifacts['0']` and discards the rest; a kept card stays across a second
    cleanup; no option without the condition; recruit (Hero cost 5, then Officer 3) → listed, use → +5 Attack, card in discard,
    controlled list and map gone; use on the play turn from `inPlay` → listed in `ritualUsedPlayedCardIds` and still counted by
    `playedCardIdsThisTurn` (a later `[hc:tech]` gate sees a used Medallion); Medallion with three classes in hand + play → +3
    (four incl. a controlled one → +4); a controlled Medallion + two other classes in hand → listed, reward 3; two Staffs
    controlled, one recruit → both listed, each gives the cost; wrong stage / pending choice / a non-ritual card / a card not held
    → silent no-op, `G` unchanged; after a recruit in a match without a Staff hook, `turnEconomy` has no `highestRecruitedHeroCost`
    key (`Object.hasOwn`); a match without either card leaves `controlledArtifacts` absent after cleanup; Wand of Watoomb's parse
    and cleanup unchanged.
  - In `moves/ritualArtifact.test.ts` also: the `playedCardIdsThisTurn` union with NO `outOfTimePlayedCardIds` key; after a
    Medallion is used from play it no longer counts toward `countDistinctHeroClassesYouHave` (L3443-3447, a moved card is not a Hero
    you have); a use with reward 0 discards with no attack log.
  - `scoring/scoring.logic.test.ts` + `economy/bloodFrenzy.logic.test.ts`: an Ultron in the Victory Pile counts a controlled Tech
    Medallion (final and live VP agree).
  - `economy/economy.logic.test.ts`: both setters; both fields survive an `addResources` / `spendRecruit` rebuild; absent after
    `resetTurnEconomy` and through a JSON round-trip when unset.
  - `game.test.ts`: the move list gains `useRitualArtifact` (54 → 55, sorts last).
  - Keyword pins +2 at `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` (append both names last to
    `expectedKeywords`) and `setup/heroAbility.setup.test.ts` (comment names WP-858 / D-24794).
  - `hero/heroEffects.execute.test.ts`: the MVP-category test imports `RITUAL_ARTIFACT_EXECUTED_KEYWORDS` and gains an
    `executesAsRitual` arm; a "plays → applied, no hollow" case for each card (the WP-783 phasing case's shape).
  - `hero/heroConditions.evaluate.test.ts`: the class count includes a controlled Artifact's class; unchanged when absent.
  - `ui/uiState.filter.test.ts` and `ui/uiState.types.drift.test.ts`: the step-4 cases, incl. `economy.ritualArtifactOptions`
    ABSENT for another player and a spectator.
  - `apps/arena-client/src/components/play/PlayedCardsRow.test.ts`: the group renders with its count; the Use button shows only
    for listed ids and dispatches `useRitualArtifact` with `{ cardId }`; controlled tiles do not change "Played This Turn — N";
    the empty state hides only when both lists are empty. `pages/PlayDesktop.test.ts` / `PlayMobile.test.ts`: both props wired
    from the snapshot (the WP-803 cases' shape).
  Expected unchanged: the `HERO_EFFECT_HANDLERS` ↔ `HANDLED_KEYWORDS` bidirectional test, the phasing tests, every
  `finalStateHash` sentinel.

## Out of Scope

- Commune with the Spirit World (discard an Artifact you control or three cards, then KO) — the next packet; keeps its hollow.
- The other Artifact cards (six dstr Ritual Artifacts, gotg "Once per turn", mgtg Triggered, asrd / fear Thrown) and the readers
  "If you control an [Artifact]" (Keeper of the Sanctum, Absorb Metal, Sharpen Blades, Give, Don't Need That Stuff, Body of Uru).
- Bot use of Rituals; effect-driven Hero gains as "recruited"; "your Heroes" readers other than the class count; copying an
  Artifact (Rogue / Chameleon); the Final Showdown; the card-name typo "Posessed" (a separate data papercut).
- Known readers that do not see `controlledArtifacts` (the `outOfTimeCards` posture, follow-ups): the persistence snapshot zone
  counts (`persistence/snapshot.create.ts` ~66), the operator view (`ui/operatorView.build.ts` ~148) and setter source lists, the
  duplicate-zone invariant scan (`invariants/gameRules.checks.ts`), and a Ritual replayed by "grant-out-of-time" (discarded, not
  kept).
- Any new pending choice, `CoreMoveName`, `MOVE_ALLOWED_STAGES` entry, simulation / PAR dispatch, turn-boundary delete, or server
  change. `replay/replay.execute.ts` keeps its D-24322 posture (it calls the shared cleanup).

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — two keywords (closed union; D-24794).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `RITUAL_ARTIFACT_EXECUTED_KEYWORDS` + `MVP_KEYWORDS` join.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `SELF_COMPUTED_ATTACK_KEYWORDS` entries.
- `packages/game-engine/src/economy/{economy.types,economy.logic}.ts` — **modified** — two ledgers, carry, setters (D-24794).
- `packages/game-engine/src/hero/splitCard.logic.ts` — **modified** — `playedCardIdsThisTurn` union.
- `packages/game-engine/src/moves/ritualArtifact.ts` — **new** — helpers, predicate, reward, move.
- `packages/game-engine/src/moves/endOfTurnCleanup.logic.ts` — **modified** — keep marked Artifacts.
- `packages/game-engine/src/moves/{recruitHero,recruitOfficer,recruitSidekick}.ts` — **modified** — gated cost record.
- `packages/game-engine/src/hero/heroConditions.evaluate.ts`, `hero/heroCountSource.resolve.ts` — **modified** — third class loop.
- `packages/game-engine/src/types.ts` — **modified** — `controlledArtifacts?` (D-24794).
- `packages/game-engine/src/scoring/scoring.logic.ts`, `economy/bloodFrenzy.logic.ts` — **modified** — "all your cards" lists.
- `packages/game-engine/src/game.ts` — **modified** — move registration (01.5 runtime wiring).
- `packages/game-engine/src/ui/{uiState.types,uiState.build,uiState.filter}.ts` — **modified** — two fields (D-12803).
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified** — `'useRitualArtifact'`.
- `apps/arena-client/src/components/play/PlayedCardsRow.vue` — **modified** — Artifacts group + Use button.
- `apps/arena-client/src/pages/{PlayDesktop,PlayMobile}.vue` — **modified** — three props each.
- `scripts/hero-mechanic-ledger.mjs` — **modified** — two `MOVE_EXECUTED_HANDLER_MODULES` rows.
- `scripts/check-hero-count-markers.mjs` — **modified** — DEFERRED `medallion-of-many-loas` reason reworded.
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified**;
  `data/cards/dstr.json` — **generated**.
- Generated / provenance: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/hero-effect-coverage.baseline.json`, `scripts/coverage/mechanic-provenance.json`,
  `docs/ai/coverage/live-verify.json`, `apps/dashboard/src/data/*` copies the regen rewrites;
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (in-play pin, only if it moves).
- Engine tests: `moves/ritualArtifact.test.ts` (new), `economy/economy.logic.test.ts`, `game.test.ts`, `rules/heroKeywords.test.ts`,
  `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`,
  `hero/heroConditions.evaluate.test.ts`, `ui/uiState.filter.test.ts`, `ui/uiState.types.drift.test.ts`,
  `scoring/scoring.logic.test.ts`, `economy/bloodFrenzy.logic.test.ts`.
- Client tests: `apps/arena-client/src/components/play/PlayedCardsRow.test.ts`, `apps/arena-client/src/pages/PlayDesktop.test.ts`,
  `apps/arena-client/src/pages/PlayMobile.test.ts`.
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24794), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets; ESM only; Node v22+; human-style code — see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Move validation contract: validate args → stage gate → legality (the shared predicate) → mutate via `zoneOps` helpers → void.
  Never throw. `for` loops, no `.reduce()`, no nested ternaries.
- `G` stays JSON and data-only. All three new fields are lazy and absent in every match without a marked card, so `finalStateHash`
  sentinels serialize byte-identically — **no re-pin**. A moved sentinel is a STOP.
- The predicate is the only legality source for the move and the projection; the client renders and dispatches only.
- Card data via the marker source + reproducible regen (`cards:check`); never hand-edit `dstr.json`. Cards are selected by their
  marker keywords only — no per-card special-casing in the parser, executor or cleanup.
- Import-cycle safety: imported bindings are read only inside function bodies; no module-level constant derived from an import.

**Session protocol:** if a marked card still adds Attack at play, or an unmarked Artifact card (e.g. Wand of Watoomb) stays in
front of a player after cleanup, or any sentinel moves, STOP and report.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `HeroKeyword` gains `'ritual-recruited-hero'` and `'ritual-hero-classes'`; markers `[keyword:ritual-recruited-hero]`,
  `[keyword:ritual-hero-classes:N]` (N = the printed class threshold).
- `LegendaryGameState.controlledArtifacts?: Record<string, CardExtId[]>` — Ritual Artifacts each player controls, kept at end of
  turn; never cleared at a turn boundary.
- `TurnEconomy.highestRecruitedHeroCost?: number`, `TurnEconomy.ritualUsedPlayedCardIds?: CardExtId[]` — lazy, carried, reset each
  turn; setters `recordRecruitedHeroCost`, `recordRitualUsedPlayed`.
- Move `useRitualArtifact({ cardId: CardExtId })` (non-core, internally gated, `client: false`); predicate
  `ritualArtifactOptions(G, playerId)`.
- `UIPlayerState.controlledArtifacts?: UIDisplayEntry[]` (PUBLIC); `UITurnEconomyState.ritualArtifactOptions?: CardExtId[]`.
- Client move name `'useRitualArtifact'`.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation).
- **No conflict:** two printed abilities that are hollow or over-fire today resolve as printed, under the published Artifact rules.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — printed hero abilities, nothing bought.
- **Determinism preservation:** no randomness in the new move; the fields are plain data, lazy, absent in matches without the
  marked cards, so sentinels are byte-identical. Seed-PAR is scheme-keyed and hero-agnostic. Replays of pre-WP-858 matches that
  played Staff or Medallion diverge on re-execution; stored `competitive_scores` rows stay frozen (D-24616 §5). In-flight matches
  keep their setup-built hooks.

## Funding Surface Gate

N/A — no nav, pricing or funding surface; one board group label ("Artifacts — N") and one button ("Use").

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. Playing Staff of Legba or Medallion of Many Loas adds 0 Attack and records no hollow effect.
2. At end of turn a played Staff / Medallion goes to `controlledArtifacts[player]`, not the discard pile, and stays there across
   later cleanups; every other card in play discards as before.
3. Staff: after any Hero, Officer or Sidekick recruit this turn it is listed in `ritualArtifactOptions`; using it discards it and
   adds Attack equal to the highest printed cost recruited this turn.
4. Medallion: with three or more Hero Classes among hand, play and controlled Artifacts (itself included) it is listed; using it
   discards it and adds +1 Attack per class.
5. A Ritual can be used from play on the turn it is played (and still counts as played this turn) and from the controlled group on
   a later turn; an unused one stays.
6. The move is a silent no-op outside `main`, with a pending choice open, for an unlisted card, or for a card the player does not
   hold.
7. Wand of Watoomb and every other unmarked Artifact card behave exactly as before.
8. The client shows the "Artifacts — N" group and a Use button only on listed cards; clicking dispatches `useRitualArtifact`.
9. `cards:check` reproduces `dstr.json`; every feed `:check` exits 0; the ledger lists both keywords for `dstr/doctor-voodoo` as
   executable, handler `moves/ritualArtifact.ts`.
10. Engine, arena-client (+ typecheck) and dashboard suites green; `pnpm -r build` 0; `finalStateHash` sentinels unchanged with no
    pin edited.

## Verification Steps

Regenerate (in order, after the engine change builds):

- Add the two `mechanic-provenance.json` rows and the two pending `live-verify.json` rows first.
- `node scripts/convert-cards/apply-hero-ability-markers.mjs` — exits 0; only `dstr.json` changes.
- `pnpm -r build` — exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`,
  `pnpm sim:coverage --update-baseline`, `pnpm --filter @legendary-arena/dashboard prebuild:coverage` — each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test` — green (record the baseline at session start and the exact delta; expect at
  least +20); every sentinel assert passes with no pin literal edited.
- `pnpm --filter @legendary-arena/arena-client test`, `pnpm --filter @legendary-arena/arena-client typecheck`,
  `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm cards:check`, `pnpm cards:count-markers:check`, `pnpm ledger:heroes:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`,
  `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`.
- `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
  `node scripts/check-number-ledger.mjs --check` — at govern-close.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + arena-client (incl. typecheck) + dashboard suites green; `pnpm -r build` 0.
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance rows added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** a match **created after the deploy** (`isMatchOlderThanServer: false`) with Doctor Voodoo:
      play Staff and Medallion (no Attack, no hollow); end the turn (both under "Artifacts", not in the discard); on a later turn
      recruit a Hero and Use the Staff (+cost Attack, card to discard; Play Diagnostics `uiStateSnapshot.economy.ritualArtifactOptions`
      listed it); with three classes Use the Medallion (+classes Attack) — confirmed live, or operator-pending in `STATUS.md` with
      the pending `live-verify.json` rows.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24794 → Active; `WORK_INDEX.md` checked; `EC_INDEX.md` Done; mindmap
      ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED (its D-24794 line reworded from "per-card
      allowlist" to "marker-selected").
- [ ] No files outside `## Files Expected to Change` were modified — `git diff --name-only origin/main...HEAD` checked.

## Reserved Decision (lands at execution)

D-24794 — Hero Artifacts and Ritual Artifacts (rules v23 p.17), first slice. A card is a modeled Ritual Artifact when a hook
carries a ritual keyword (`ritual-recruited-hero`, `ritual-hero-classes`, a move-executed category, `SELF_COMPUTED_ATTACK_KEYWORDS`
members), selected by marker only; every other Artifact card keeps its previous behaviour. A played modeled Artifact is kept at end
of turn in `G.controlledArtifacts[player]` (lazy, never cleared at a turn boundary); the player may, on their own turn in `main`
with no choice open, discard it from play or from that record through the non-core move `useRitualArtifact` once its condition
held this turn; `ritualArtifactOptions` is the single legality predicate, projected as `economy.ritualArtifactOptions`, and the
record is projected PUBLIC as `players[].controlledArtifacts`; the final / live VP "all your cards" lists include it. Staff of Legba reads `turnEconomy.highestRecruitedHeroCost` (the
three recruit moves' own costs, recorded only in a match with that hook; the highest, D-24470 posture); Medallion of Many Loas reads
`countDistinctHeroClassesYouHave`, which now includes controlled Artifacts' printed classes (rules v23 L930-932). A Ritual used from
play stays "played this turn" through `turnEconomy.ritualUsedPlayedCardIds` (L3441-3453). Bots never use a Ritual. Replays of
pre-WP-858 matches that played either card diverge; stored competitive rows stay frozen (D-24616 §5).

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1:** NOT READY — PS-1 the ritual names must not join `HERO_PARSER_RECOGNIZED_MARKER_NAMES` (non-HeroKeyword
  list, pinned); PS-2 three keyword / category pin files missing from the allowlist; PS-3 use `SELF_COMPUTED_ATTACK_KEYWORDS`
  (D-24670), not the `attack-per-count` block; PS-4 a Ritual used from play dropped out of "played this turn" (L3441-3453). RS:
  predicate seat posture; `client: false` registration; import-cycle guardrail; recruit cost from `requiredCost`; the other class
  readers + `collectDistinctHeroClassCards`; UIState drift pins; page wiring tests; empty-state condition; turn-economy home for the
  recruit record; baseline `e064d497`. Verified at HEAD: the probe parse, the play-time `applied` classification with no warning,
  the shared cleanup, no dstr sentinel, the Officer / Sidekick costs. All folded: PS-4 by RS-5 (the `ritualUsedPlayedCardIds`
  ledger); the recruit record moved to `TurnEconomy` (no turn-boundary delete, `game.ts` registration only).
- **Pre-flight round 2:** **READY TO EXECUTE** — all four PS items verified folded; the carry pattern (14 rebuild sites, all
  spread `carryConversionFlag`), no TurnEconomy keyset pin tripped (`resetTurnEconomy` stays 7 fields), `G.turnEconomy` defined in
  the recruit moves, allowlist complete. Two wording notes applied: the setter is `recordOutOfTimePlayed` (new setters
  `recordRecruitedHeroCost` / `recordRitualUsedPlayed`), and the two `turnEconomy` reads use `?.` (minimal-G guard).
- **Copilot round 1:** RISK, HOLD, seven fixes, all folded: (1) the `playedCardIdsThisTurn` early return made the ritual union dead
  code in a Voodoo match, so it is restructured, with a test that has no Out of Time key; (2) Ultron's "tech Hero you have among all
  your cards" would miss a controlled Medallion, so `scoring.logic.ts` + `bloodFrenzy.logic.ts` lists are in scope (+ tests) and
  the other unaware readers are named in Out of Scope; (3) the count-marker gate's DEFERRED Medallion entry is reworded and
  `cards:count-markers:check` added; (4) RS-6 Medallion read at use time; (5) the two use log lines locked, no attack call at
  reward 0; (6) tests: options absent for others, a used Medallion stops counting as a class you have; Spectrum gate text
  reworded; (7) the ritual dispatch's unrecognized-type fallback stated. Verified PASS on 24 modes incl. hash surfaces
  (mock-registry sentinels, core-only seed PAR), the replay posture, layers (type-only client import), move contract, client
  marker rendering and the sibling pins.
- **Copilot round 2:** **PASS → CONFIRM** — all seven folds verified in the WP and EC; the two scoring files open no new gap
  (`computeDynamicVillainVictoryPoints` has exactly those two callers; PAR's hero pool is core-only; no sentinel reaches them); all
  30 modes PASS.
- **Pre-flight round 3 (allowlist changed after round 2):** **READY TO EXECUTE** holds — the five added files and the check exist
  at the cited lines; one wording note applied (`gameState` is the variable name in `scoring.logic.ts`).

## Lint Gate Self-Review (00.3)

- **§1 structure:** every template section present and non-empty; Out of Scope names Commune, the other Artifact cards and
  "control an Artifact" readers, bot use, effect-driven recruits, other "your Heroes" readers, copying, Final Showdown, the name
  typo, the readers that do not see the record, and new choice / core-move / sim / server surfaces. **PASS.**
- **§2 constraints:** full-file output, no diffs/snippets, ESM, Node v22+, `00.6-code-style.md` cited; move contract, lazy-field /
  sentinel, single-predicate, marker-only selection and import-cycle constraints; session protocol (three STOP triggers); locked
  values → EC. **PASS.**
- **§3 Assumes:** WP-783 / 803 / 842 / 648 / 856 and every helper, export, field, pin and pattern the change reads, with file and
  line; baseline `e064d497`; the rules passages. **PASS.**
- **§4 Context:** observed and probed parses, live evidence (two operator matches), the one-WP rationale, marker-only selection,
  the move-executed category, both ledgers, the controlled record, the class-count reach, bots, import cycle, coordination,
  Commune; ARCHITECTURE sections, 00.2 §5, DECISIONS scan list, 00.6. RS-1..RS-6 locked. **PASS.**
- **§5 files:** every file listed with role and full path (~30 source / test / data files plus generated feeds); the cross-layer
  size is justified in §Context ("Why both halves in one WP": the record is only visible through the client). **PASS.**
- **§6 naming:** full words (`controlledArtifacts`, `highestRecruitedHeroCost`, `ritualUsedPlayedCardIds`,
  `ritualArtifactOptions`, `useRitualArtifact`); data slugs verbatim; no 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; engine + client + card data; the client imports only types from the `.`
  engine surface (as `PlayedCardsRow` already does) and dispatches by move name; no registry import in the engine; no server
  change. **PASS.**
- **§9 Windows:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`; hooks from the real parser on committed `dstr.json`; `Object.hasOwn` key checks; runtime
  keyset pins for the UI fields (D-24372); no `boardgame.io` import in helpers. **PASS.**
- **§13 verification:** exact regen and check commands with expected exits; engine baseline recorded at session start. **PASS.**
- **§14 / §15:** 10 binary criteria; DoD names STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap / ledger and the D-24026 live
  check (§15.1, operator-pending fallback with the `live-verify.json` rows). **PASS.**
- **§16 code-style:** reuse of the phasing move/predicate, the Out of Time record/projection/ledger and the carry chokepoint;
  duplicate-first category; `for` loops, no `.reduce()`, no nested ternaries; `// why:` locations listed in the EC. **PASS.**
- **§17 Vision:** clauses §1/§2/§8/§10/§22, no-conflict line, NG-1 line, determinism line. **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** no repo-state-summarizing artifact beyond the baseline SHA,
  re-checked at commit. **N/A.** Contract files: `types.ts`, `economy/economy.types.ts`, `ui/uiState.types.ts` and the
  `HeroKeyword` closed union each gain optional fields / members, all covered by D-24794.
- **§20 funding:** N/A with the statement above. **§21 API catalog:** N/A (no endpoint). **PASS.**
