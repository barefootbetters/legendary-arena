# WP-860 — Commune with the Spirit World: discard an Artifact you control or three cards, then KO a card (Game Engine + card data)

**Status:** Draft 2026-10-31 (EC-898; D-24796 reserved) — pre-flight READY TO EXECUTE (conditional on #3120 merging); copilot PASS
**Layer:** Game Engine (one handler-bearing hero keyword, three chained seat-choice kinds, one KO site) + card data
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** WP-858 / D-24794 (Ritual Artifacts: `G.controlledArtifacts`, `isRitualArtifact`, `turnEconomy.ritualUsedPlayedCardIds`
via `recordRitualUsedPlayed` — executed in PR #3120; must be merged before this WP executes), WP-684 / D-24501 (the seat choice:
`PendingSeatChoice`, `parkSeatChoice`, `resolveSeatChoice`, `applySeatChoiceByKind`, the live-move chain point) ✅, WP-683 /
D-24500 (a hero handler parking a seat choice at play — Deadpool's Here, Hold This / Random Acts) ✅, WP-821 / D-24754 (a seat
choice chaining a second pick from the live move context — Crush Pacifist Resistance) ✅, WP-853 / D-24789 + WP-856 / D-24792 (the
owned-KO recorder and its per-function KO-site pin) ✅

## Goal

Make Doctor Voodoo's **Commune with the Spirit World** (`dstr/doctor-voodoo/commune-with-the-spirit-world`, 5 copies, cost 3,
Covert, printed 2 Recruit) do what it prints: "You may discard an [keyword:Artifact] you control or three cards from your hand. If
you do, KO a card from your hand or discard pile." Today the line parses to nothing and logs an `artifact … parse-unrecognized`
hollow on every play. After this WP, playing it (besides its printed 2 Recruit) offers the player a choice: discard one of the
Artifacts they control, discard three cards from their hand, or don't. If they pay either cost, they then KO one card of their
choice from their hand or discard pile.

## User-Visible Impact

`play.legendary-arena.com` — playing Commune with the Spirit World no longer logs a hollow. When the player controls a Ritual
Artifact or holds three or more cards, a choice opens: "Discard Staff of Legba" (one button per Artifact they control),
"Discard three cards from your hand", "Don't discard". Choosing three cards opens three single-card picks from the hand ("Discard
<name>"), one after the other. After the cost is paid, a pick opens listing every card in the hand ("KO <name> (hand)") then the
discard pile ("KO <name> (discard pile)"); the chosen card is KO'd. With no Artifact and fewer than three cards in hand, nothing opens and the log says so. KOing
one of their Heroes this way counts for Possessed by Brother's Spirit and Absorb Energies. Live-on-surface is operator-pending
(D-24026).

## Assumes

- Baseline `origin/main` at or after the WP-858 execution merge (#3120); re-recorded at commit.
- WP-858 (#3120) on `main`: `G.controlledArtifacts?: Record<string, CardExtId[]>` (lazy; key deleted when its list empties, map
  when empty), `moves/ritualArtifact.ts` `isRitualArtifact(G, cardId)`, `economy/economy.logic.ts`
  `recordRitualUsedPlayed(economy, cardId)` (the "played this turn, left play" ledger unioned in `playedCardIdsThisTurn`).
- Seat choice (WP-684): `types.ts` `PendingSeatChoice { kind, addressedSeats, seatPrompts{ [seat]: { options: SeatChoiceOption[] } },
  submissions, defaultOptionIndex, leftNeighborBySeat? }` (~1448), `SeatChoiceOption { label, cityIndex?, cardId?, … }` (~1388);
  `moves/seatChoice.resolve.ts` `parkSeatChoice(G, events, choice)` (~299), `applySeatChoiceByKind` (~475, one `if (choice.kind
  === …)` arm per kind) and the live-move chain point after the apply in `resolveSeatChoice` (~430-455, where
  `chainCrushPacifistResistanceLastKo` / `chainMonarchsDiscard` run). The client `PendingSeatChoicePrompt.vue` renders any kind's
  option `label`s and submits `resolveSeatChoice({ optionIndex })`; no client change is needed for a new kind.
- A hero handler parks a seat choice at play with `parkSeatChoice(G, undefined, …)` (`heroEffects.execute.ts` ~4159 Here, Hold
  This; ~4204 Random Acts).
- `simulation/ai.seatChoice.ts`: a bot answers a seat choice with `defaultOptionIndex` unless its kind has a policy (kinds whose
  default is the right answer need no entry).
- `moves/discardFromHand.ts` `discardFromHand(G, playerID, cardId): boolean` (~198) is the discard chokepoint
  (`cardsDiscardedThisTurn`, return-on-discard, teleport-on-discard).
- `board/ko.logic.ts` `koCard(koPile, cardId)`; `hero/deferredConditionalGrants.ts` `recordOwnedCardKoed(G, ownerPlayerID, cardId)`
  (WP-856 signature; `+ fromZone` if WP-855 executed first); `hero/ownedCardKoTrigger.test.ts` (~374-404) pins every KO site per
  function (`'file#function': { koSites, ownedRecords }`).
- Hero keyword lockstep (handler-bearing): `HeroKeyword` + `HERO_KEYWORDS` (`rules/heroKeywords.ts`), the three length pins
  (`rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` with its ordered `expectedKeywords`,
  `setup/heroAbility.setup.test.ts`), `HERO_EFFECT_HANDLERS` + the handler-count pins (`hero/heroEffects.execute.test.ts` ~148 and
  ~7886, both 69), `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`.
- Parser: a marker `[keyword:name]` whose name is a `HeroKeyword` becomes that keyword through the generic path. The printed
  `[keyword:Artifact]` (not a HeroKeyword) lands in `unresolvedMarkers` through the generic keyword-loop fallback
  (`heroAbility.setup.ts` ~1842-1848), which runs regardless of other keywords; a hook with a reachable effect records no hollow
  (`detectHollowHeroHook`, `heroEffects.execute.ts` ~1366-1383) — the WP-858 `ritual-artifact` precedent.
- WP-858's `removeControlledArtifact` is private to `ritualArtifact.ts` (not in this WP's file list), so the Commune module carries
  its own empty-key / empty-map delete (duplicate-first, 00.6).
- `SeatChoiceOption.sourceZone?` (`types.ts` ~1405-1409) names the zone of a picked card where ids repeat (`starting-shield-agent`,
  Wounds); `applyCrushPacifistResistanceKo` (`seatChoiceTactics.ts` ~750-761) removes the card from the option's zone only.
- `resolveSeatChoice` reads the chain inputs BEFORE the apply (Crush: `didCrushChooseKo(choice)`, ~423-428); `applySeatChoiceByKind`
  returns void. The timeout default path `applySeatChoiceTimeoutDefault` (~714-751) runs no chain.
- `data/cards/dstr.json` is GENERATED; markers via `hero-ability-markers.json` + `apply-hero-ability-markers.mjs`
  (`VALID_TOKEN_PATTERN`).

## Context (Read First)

- **Parse today (observed):** all 5 copies `{ timing: 'onPlay', keywords: [], unresolvedMarkers: ['artifact'] }` — the hollow seen
  on operator matches `lpGhTDyrlXK` / `D6VA6jR_JVD` (2026-10-31). The printed card was checked against the card image: "You may
  discard an Artifact you control or three cards from your hand. If you do, KO a card from your hand or discard pile."
- **Why seat choices.** No existing queue offers a two-way cost then a mandatory KO from hand OR discard of any card: the
  optional-KO queue always offers a decline; the KO-Hero queue rejects Wounds; the discard queues have no follow-up. The WP-684
  seat choice is generic (labelled options, the client renders any kind), already parks from a hero handler at play (WP-683), and
  already chains a second pick from the live move context (WP-821). So the card is three seat-choice kinds and no new queue, move,
  UIState field or client change.
- **"An Artifact you control"** (rules v23 p.17: you control an Artifact from the moment you play it): the cards in
  `G.controlledArtifacts[player]`, then any card in `inPlay` for which `isRitualArtifact` holds — the WP-858 modeled Artifacts
  only. An unmodeled Artifact card in play (e.g. Wand of Watoomb) is not offered (RS-2).
- **Discarding an Artifact this way is a cost, not a Ritual use:** no Ritual reward. A controlled one leaves the record (empty key /
  map deleted, as `useRitualArtifact` does); one played this turn leaves `inPlay` and is recorded with `recordRitualUsedPlayed` so it
  still counts as played this turn (rules v23 L3441-3453; the ledger is "played this turn, then left play").
- **Three cards** are three chained single-card picks (`discardFromHand` each, so discard triggers fire), the WP-821 chained-pick
  shape. The remaining count rides on the choice (`PendingSeatChoice.communeSpiritWorld`, below).
- **The KO is mandatory once paid** ("If you do, KO a card"): no decline option; the default (timeout / bot) is the first listed card.
  Any card counts, Wounds included ("a card"). Each option carries its `sourceZone` (`'hand'` / `'discard'`) and the card leaves
  that zone only, because ids repeat (S.H.I.E.L.D. Agents, Wounds); identical (zone, card id) pairs are listed once. The hand and
  discard pile can both be empty after a paid cost (teleport-on-discard takes a discarded card out of the discard pile), so an empty
  pool parks nothing and logs it (RS-5). The KO is an OWNED KO from hand or discard → `recordOwnedCardKoed`, so Possessed by
  Brother's Spirit and Absorb Energies react (WP-853 / WP-856); the KO-site pin gains one row (the pin's scanner reads every engine
  file, so the row is required).
- **Chaining.** The chain inputs (the seat, the chosen branch, `discardsRemaining - 1`, the `sourceCardId`) are read from the
  submitted choice BEFORE the apply, by pure readers, and the chain parks at the live-move chain point after the apply (the Crush
  precedent); the applies return void. The unwired WP-116 timeout path (`applySeatChoiceTimeoutDefault`) runs no chain, so a
  defaulted mid-cost pick ends there (the Random Acts precedent) — accepted.
- **Import cycles.** `seatChoice.resolve` ↔ `communeSpiritWorld.logic`, and `heroEffects.execute` → `communeSpiritWorld.logic` →
  `ritualArtifact` → `heroEffects.execute`: imported bindings are read only inside function bodies and the kind constants are
  string literals (the `revealOrWoundChoice.logic.ts` precedent).
- **Bots** answer with each kind's default: the cost choice defaults to "Don't discard" (so bots never pay), the discard picks and
  the KO default to the first listed card. No `ai.seatChoice.ts` policy is added.
- **Coordination.** WP-857 (drafted) and WP-859 (reserved) may add `HERO_KEYWORDS` entries / handlers; WP-855 (drafted) appends a
  `fromZone` parameter to `recordOwnedCardKoed`. Whichever executes later rebases the pins (+1 here) and passes `fromZone`
  (`'hand'` / `'discard'`) at the new KO site if WP-855 landed first.
- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, §Rule Execution Pipeline, Principle #1. `docs/ai/REFERENCE/00.2-data-requirements.md`
  §5. `docs/ai/DECISIONS.md` — scan D-24794, D-24501, D-24500, D-24754, D-24789, D-24792, D-24470, D-24372 before coding.
  `docs/ai/REFERENCE/00.6-code-style.md`.

### RS-1 — No cost available (default locked)

No Artifact to offer and fewer than three cards in hand: no choice parks; the log reads "… had no Artifact to discard and fewer
than three cards in hand, so Commune with the Spirit World did nothing." (`blocked` outcome). Another seat choice already open
(`G.pendingSeatChoice !== undefined` — e.g. two copies of Commune replayed by one Steal Abilities, or Commune with Here, Hold This /
Random Acts in the same `executeHeroEffects` loop): no choice parks (`parkSeatChoice` overwrites unconditionally) and the log reads
"Player N could not Commune with the Spirit World — another choice is open." (`blocked`; the D-24761 never-park-on-top posture).

### RS-2 — Which Artifacts are offered (default locked)

Only modeled Ritual Artifacts (WP-858: a hook carries a ritual keyword), controlled first then in play this turn, in record /
play order. Unmodeled Artifact cards are not offered; modeling them is a follow-up.

### RS-3 — Option order and defaults (default locked)

Cost options: one per Artifact (label "Discard <name>", `cardId`), then "Discard three cards from your hand" (only when the hand
holds three or more), then "Don't discard"; `defaultOptionIndex` = the last (decline). The branch is read by POSITION, never by
label: the option at `defaultOptionIndex` is the decline, an option carrying `cardId` is an Artifact, any other is three cards
(`readCommuneCostBranch`, shared by the reader and the apply). Discard picks: one option per hand card in hand order, default 0.
KO pick: hand cards then discard-pile cards, default 0. Labels per RS-6. `discardsRemaining` is set only when a discard pick is
built (never written as `undefined`; `exactOptionalPropertyTypes`).

### RS-4 — A reactive discard choice during the three picks (default locked)

`discardFromHand` may park its own reactive choice (return-on-discard / teleport-on-discard). The next Commune pick still chains;
both prompts are open and resolve independently (the WP-856 RS-4 posture). Known deviation, stated in D-24796: the active
player's return-on-discard (`pendingReturnOnDiscard`) is not blocked by an open Commune pick, so a returned card could be picked
again and one card could pay more than one of the three discards (D-24527 forbids this for discard-to-play). Excluding picked ids is
not used because ids repeat (two S.H.I.E.L.D. Agents are two cards); the case needs a return-on-discard Hero in the same match.

### RS-5 — Nothing to KO (default locked)

When the cost is paid but the hand and discard pile are both empty, no KO pick parks; the log reads "Player N had no card to KO
(Commune with the Spirit World)." (`blocked`).

### RS-7 — Stale options and the Artifact discard count (default locked)

Every apply re-checks its card before acting ("If you do" must hold): a cost Artifact no longer in the controlled list or `inPlay`
→ `readCommuneCostBranch` returns `undefined` (no chain, so no KO without payment); a discard pick whose `discardFromHand` returns
`false` → a `blocked` log and Commune ends with no KO; a KO option whose card is no longer in its `sourceZone` (e.g. returned to hand
by return-on-discard while the pick was open) → a `blocked` log, no `koCard`, no recorder call. Discarding an Artifact as the cost
does NOT count toward `cardsDiscardedThisTurn` (it is not a discard from hand; the WP-858 `useRitualArtifact` posture); the three
hand discards count through `discardFromHand`. Discarding a controlled Artifact from an earlier turn is not added to
`ritualUsedPlayedCardIds` (rules v23: you only "played" an Artifact the turn you put it out).

### RS-6 — Labels (default locked)

Discard picks are labelled "Discard <name>"; KO picks "KO <name> (hand)" / "KO <name> (discard pile)"; the client heading stays
the generic "Your choice" (no client change). Artifacts are listed controlled-first (WP-858's `ritualArtifactOptions` lists
in-play first; the order here is intentional and only affects button order).

## Scope (In)

- **Keyword** (`rules/heroKeywords.ts`): `HeroKeyword` + `HERO_KEYWORDS` gain `discard-artifact-or-three-then-ko` (appended last,
  lockstep). No magnitude.
- **Executor** (`hero/heroEffects.execute.ts`): `HERO_EFFECT_HANDLERS['discard-artifact-or-three-then-ko'] =
  heroEffectDiscardArtifactOrThreeThenKo`; the keyword joins `HANDLED_KEYWORDS` and `NO_MAGNITUDE_KEYWORDS`. The handler calls
  `parkCommuneCostChoice(G, playerID, cardId)` (below) and returns.
- **Markers** (`hero-ability-markers.json` → `dstr`): `{ heroSlug: "doctor-voodoo", cardSlug: "commune-with-the-spirit-world",
  abilityIndex: 0, markupToken: "[keyword:discard-artifact-or-three-then-ko]" }`; `VALID_TOKEN_PATTERN` gains
  `^\[keyword:discard-artifact-or-three-then-ko\]$` and its error message lists it. Regenerate `dstr.json`. Target hook:
  `{ timing: 'onPlay', keywords: ['discard-artifact-or-three-then-ko'], effects: [{ type: 'discard-artifact-or-three-then-ko' }],
  unresolvedMarkers: ['artifact'] }` (the printed `[keyword:Artifact]` through the generic fallback; harmless — the reachable effect
  suppresses the hollow; observed on a pre-flight prototype).
- **Contract** (`types.ts`): `PendingSeatChoice.communeSpiritWorld?: { sourceCardId: CardExtId; discardsRemaining?: number }` —
  present only on the three Commune kinds; `discardsRemaining` only on the discard pick. `SeatChoiceOption.sourceZone?` widens to
  `'hand' | 'inPlay' | 'discard'` (with a `// why:`) for the KO pick.
- **New module** `moves/communeSpiritWorld.logic.ts` (no boardgame.io import, no registry, no `.reduce()`, never throws):
  - Kinds: `COMMUNE_COST_SEAT_CHOICE_KIND = 'commune-cost'`, `COMMUNE_DISCARD_SEAT_CHOICE_KIND = 'commune-discard'`,
    `COMMUNE_KO_SEAT_CHOICE_KIND = 'commune-ko'`.
  - `communeArtifactOptions(G, playerID): CardExtId[]` — controlled list then in-play `isRitualArtifact` cards, distinct.
  - `parkCommuneCostChoice(G, playerID, sourceCardId)` — RS-1 logs (no cost, or another seat choice open) or park the cost choice
    (RS-3) via `parkSeatChoice(G, undefined, …)`.
  - Pure readers for the chain, called BEFORE the apply: `readCommuneCostBranch(G, choice): 'artifact' | 'three' | 'decline' |
    undefined` (positional per RS-3; `'artifact'` only while the card is still in the controlled list or `inPlay`, RS-7) and
    `readCommuneDiscardsLeft(G, choice): number | undefined` (`discardsRemaining - 1`; `undefined` — no chain — when the picked card
    is no longer in hand), plus the seat and `sourceCardId` from the choice.
  - `applyCommuneCostResolvedSeatChoice(G, choice): void` — Artifact option: move it to the discard pile (from the controlled list
    with the module's own empty-key / empty-map deletes, else from `inPlay` + `recordRitualUsedPlayed`), log "Player N discarded
    <Artifact> to Commune with the Spirit World."; three-cards option: nothing yet; decline: log "Player N chose not to Commune with
    the Spirit World.".
  - `applyCommuneDiscardResolvedSeatChoice(G, choice): void` — `discardFromHand` the picked card, log it; a `false` return logs
    `blocked` (RS-7; the reader already returned `undefined`, so nothing chains).
  - `applyCommuneKoResolvedSeatChoice(G, choice): void` — the picked card leaves its option's `sourceZone` only, `G.ko =
    koCard(G.ko, cardId)`, `recordOwnedCardKoed(G, playerID, cardId)`, log "Player N KO'd <card> from their hand / discard pile
    (Commune with the Spirit World)."
  - `chainCommuneAfterCost(G, playerID, branch, sourceCardId)` / `chainCommuneAfterDiscard(G, playerID, discardsLeft,
    sourceCardId)` — park the next discard pick (`discardsRemaining` = discardsLeft) while picks remain and the hand is non-empty,
    else park the KO pick (RS-5: nothing when hand and discard pile are empty). Options per RS-3 / RS-6.
- **Seat-choice wiring** (`moves/seatChoice.resolve.ts`): three `applySeatChoiceByKind` arms; the chain inputs captured BEFORE the
  apply beside `crushChoseKo` (the pure readers above), and the chain calls at the live-move chain point beside
  `chainCrushPacifistResistanceLastKo`.
- **KO-site pin** (`hero/ownedCardKoTrigger.test.ts`): add `'moves/communeSpiritWorld.logic.ts#applyCommuneKoResolvedSeatChoice':
  { koSites: 1, ownedRecords: 1 }`.
- **Ledger / coverage:** provenance row `discard-artifact-or-three-then-ko` (WP-860 / D-24796); pending `live-verify.json` row
  `dstr/doctor-voodoo|discard-artifact-or-three-then-ko`; regenerate `ledger:heroes`, `effect-index`, `mechanics:metadata`,
  `sim:runtime-observed`, `sim:coverage --update-baseline`, the dashboard coverage copies (+ the in-play pin only if it moves, dated
  comment).
- **Tests** (new `moves/communeSpiritWorld.test.ts`; hooks from the real parser on the committed `dstr.json`):
  - The target parse (`keywords: ['discard-artifact-or-three-then-ko']`, `unresolvedMarkers: ['artifact']`); playing Commune records no hollow and keeps its printed 2 Recruit (`cardStats`).
  - RS-1: no Artifact and two cards in hand → no choice, the blocked log.
  - Options (RS-3): a controlled Staff + an in-play Medallion + four hand cards → labels `["Discard Staff of Legba", "Discard Medallion
    of Many Loas", "Discard three cards from your hand", "Don't discard"]`, default index 3; two hand cards → no three-cards option.
  - Artifact branch through the real `resolveSeatChoice`: the controlled Staff goes to the discard pile, the record empties, the KO
    pick opens listing hand then discard (incl. the Staff); KO a Wound from the discard pile → it is in `G.ko`.
  - Repeated ids: a S.H.I.E.L.D. Agent in both hand and discard pile — picking the "(discard pile)" option KOs from the discard pile
    and leaves the hand Agent; identical (zone, id) pairs are listed once.
  - RS-5: a paid cost with an empty hand and discard pile parks no KO pick and logs it.
  - In-play Artifact branch: the Medallion leaves play, is listed in `ritualUsedPlayedCardIds` and still counts as played this turn.
  - Three-cards branch: three chained picks each through `discardFromHand` (`cardsDiscardedThisTurn` = 3), then the KO pick; KO a Hero
    from hand.
  - Decline: nothing moves, no further choice.
  - With Possessed by Brother's Spirit waiting (WP-856), a Hero KO'd by Commune parks its +4 Recruit / +4 Attack choice.
  - Bot: `getLegalMoves` returns `resolveSeatChoice` with the decline index; after it no choice is open. Timeout:
    `applySeatChoiceTimeoutDefault` on the cost choice declines and parks nothing.
  - RS-1 guard: with a seat choice already open, Commune parks nothing and logs the blocked line; the open choice is untouched.
  - RS-7: a KO option whose card was returned to hand before the pick → blocked log, nothing KO'd, no owned-KO count; a cost
    Artifact that left before the apply → no KO pick.
  - The three-cards branch runs through the real `resolveSeatChoice` end to end (proves the chain is at the live-move point).
  - A controlled Artifact from an earlier turn discarded as the cost is NOT added to `ritualUsedPlayedCardIds`; the emptied record
    asserts `G.controlledArtifacts === undefined`; `cardsDiscardedThisTurn` is unchanged by the Artifact branch.
  - A parked `commune-discard` choice round-trips through JSON unchanged.
  - Hero-keyword pins: `HERO_KEYWORDS` +1 at the three sites; `HERO_EFFECT_HANDLERS` count +1 at both `heroEffects.execute.test.ts`
    pins; the MVP/handled bidirectional test passes unedited.
  Expected unchanged: every `finalStateHash` sentinel, the seat-choice and WP-858 tests.

## Out of Scope

- Unmodeled Artifacts (the other dstr Ritual Artifacts, gotg / mgtg / asrd / fear) as Commune options; the mgtg "discard an
  Artifact you control to get …" lines (Give, Don't Need That Stuff).
- A bot policy for Commune (bots decline); a multi-select discard UI (three single picks instead).
- Any new pending queue, move, `CoreMoveName`, UIState field, client file, or server change.
- `replay/replay.execute.ts` keeps its D-24322 posture.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — one keyword (closed union; D-24796).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — handler + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`.
- `packages/game-engine/src/moves/communeSpiritWorld.logic.ts` — **new** — kinds, options, park, applies, chains, KO site.
- `packages/game-engine/src/moves/seatChoice.resolve.ts` — **modified** — three kind arms + chain calls.
- `packages/game-engine/src/types.ts` — **modified** — `PendingSeatChoice.communeSpiritWorld?` and the `SeatChoiceOption.sourceZone`
  widen (contract file; D-24796).
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified**;
  `data/cards/dstr.json` — **generated**.
- Generated / provenance: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/hero-effect-coverage.baseline.json`, `scripts/coverage/mechanic-provenance.json`,
  `docs/ai/coverage/live-verify.json`, `apps/dashboard/src/data/*` copies the regen rewrites;
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (in-play pin, only if it moves).
- Tests: `packages/game-engine/src/moves/communeSpiritWorld.test.ts` (new), `rules/heroKeywords.test.ts`,
  `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`,
  `hero/ownedCardKoTrigger.test.ts`.
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24796), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets; ESM only; Node v22+; human-style code — see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness, clocks or I/O; `for` loops, no `.reduce()`, no nested ternaries; never throw.
- `G` stays JSON: `pendingSeatChoice` exists only while a Commune choice is open and is removed by the shared resolve; the new
  optional field rides only on Commune kinds. No sentinel game plays Commune, so `finalStateHash` sentinels serialize
  byte-identically — **no re-pin**. A moved sentinel is a STOP.
- Every discard goes through `discardFromHand`; the KO goes through `koCard` + `recordOwnedCardKoed` (one pinned site).
- Card data via the marker source + reproducible regen (`cards:check`); never hand-edit `dstr.json`. No per-card special-casing
  outside the marked keyword's handler.

**Session protocol:** if the parse lacks the keyword / effect or playing Commune records a hollow, or a choice parks with no cost
available (or a KO pick with no option), or the KO pick offers a decline, or any sentinel moves, STOP and report.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `HeroKeyword` gains `'discard-artifact-or-three-then-ko'`; marker `[keyword:discard-artifact-or-three-then-ko]`.
- Seat-choice kinds `'commune-cost'`, `'commune-discard'`, `'commune-ko'`; `PendingSeatChoice.communeSpiritWorld?: { sourceCardId:
  CardExtId; discardsRemaining?: number }` (not projected to the client); `SeatChoiceOption.sourceZone?` widened to `'hand' |
  'inPlay' | 'discard'`.
- Hook: the Commune line keeps `unresolvedMarkers: ['artifact']` (harmless; no hollow).
- One new owned KO site: `communeSpiritWorld.logic.ts#applyCommuneKoResolvedSeatChoice`.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation).
- **No conflict:** a printed ability that does nothing today resolves as printed.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — a printed hero ability, nothing bought.
- **Determinism preservation:** no randomness; the choices are seat-choice state the shared resolve already serializes; absent in
  every match that does not play Commune. Seed-PAR is scheme-keyed and hero-agnostic. Replays of pre-WP-860 matches that played
  Commune diverge on re-execution; stored `competitive_scores` rows stay frozen (D-24616 §5). In-flight matches keep their
  setup-built hooks.

## Funding Surface Gate

N/A — no nav, pricing or funding surface; option labels in the existing seat-choice prompt.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. Playing Commune with the Spirit World records no hollow and keeps its printed 2 Recruit.
2. With an Artifact controlled or three or more cards in hand, the cost choice opens with the RS-3 options; otherwise nothing opens
   and the RS-1 line is logged.
3. Choosing an Artifact discards it (no Ritual reward); a controlled one leaves the record, an in-play one still counts as played.
4. Choosing three cards opens three single-card picks, each discarded through `discardFromHand`.
5. After either cost, a mandatory KO pick lists every hand then discard-pile card (no decline); the chosen card is KO'd and recorded
   as an owned KO.
6. Declining changes nothing; the bot / timeout default is decline.
7. A Hero KO'd this way triggers a waiting Possessed by Brother's Spirit.
8. `cards:check` reproduces `dstr.json`; every feed `:check` exits 0; the ledger lists the keyword for `dstr/doctor-voodoo` as
   executable.
9. Engine + dashboard suites green; `pnpm -r build` 0; the KO-site pin has the one new row; `finalStateHash` sentinels unchanged.

## Verification Steps

Regenerate (in order, after the engine change builds):

- Add the provenance row and the pending `live-verify.json` row first.
- `node scripts/convert-cards/apply-hero-ability-markers.mjs` — exits 0; only `dstr.json` changes.
- `pnpm -r build` — exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`,
  `pnpm sim:coverage --update-baseline`, `pnpm --filter @legendary-arena/dashboard prebuild:coverage` — each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test` — green (record the baseline and the exact delta; expect at least +12).
- `pnpm --filter @legendary-arena/arena-client test`, `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`,
  `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`.
- `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
  `node scripts/check-number-ledger.mjs --check` — at govern-close.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + arena-client + dashboard suites green; `pnpm -r build` 0.
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance row added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** a match **created after the deploy** (`isMatchOlderThanServer: false`) with Doctor Voodoo:
      play Commune with an Artifact controlled → the cost choice (Play Diagnostics `uiStateSnapshot.pendingSeatChoice` options), pay
      with the Artifact, KO a card from the discard pile; another turn, pay with three cards and KO from hand — confirmed live, or
      operator-pending in `STATUS.md` with the pending `live-verify.json` row.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24796 → Active; `WORK_INDEX.md` checked; `EC_INDEX.md` Done; mindmap ✅ +
      `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] No files outside `## Files Expected to Change` were modified — `git diff --name-only origin/main...HEAD` checked.

## Reserved Decision (lands at execution)

D-24796 — Commune with the Spirit World's "You may discard an Artifact you control or three cards from your hand. If you do, KO a
card from your hand or discard pile." is the handler-bearing hero keyword `discard-artifact-or-three-then-ko`, resolved through three
chained WP-684 seat-choice kinds: `commune-cost` (one option per modeled Artifact the player controls — the WP-858 controlled
record, then in-play Ritual Artifacts — then "three cards" when the hand holds three or more, then decline, the default), up to
three `commune-discard` picks through `discardFromHand`, and a mandatory `commune-ko` pick over hand then discard pile (any card,
each option carrying its `sourceZone`, default the first; nothing to KO → logged, no pick). Discarding an Artifact is a cost (no Ritual reward); one played this turn stays "played this turn" through the
WP-858 ledger (only when played this turn). The KO is an owned KO (`recordOwnedCardKoed`, one pinned site). No cost available, or
another seat choice already open → nothing parks (logged). The cost branch is read by option position, never by label; every apply
re-checks its card and a stale option is a logged no-op (no KO without payment). The Artifact discard does not count toward
`cardsDiscardedThisTurn`. Bots take the defaults (never pay); the timeout path does not chain (WP-116, unwired). Known deviation: a return-on-discard card returned
during the three picks may be picked again (D-24527 forbids this for discard-to-play). Contract: `PendingSeatChoice.communeSpiritWorld?`,
`SeatChoiceOption.sourceZone?` widened to include `'discard'`. Replays of pre-WP-860 matches that played the card
diverge; stored competitive rows stay frozen (D-24616 §5).

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1:** READY TO EXECUTE conditional on #3120 merging and three PS fixes, all folded: PS-1 the Commune line keeps
  `unresolvedMarkers: ['artifact']` (generic fallback; prototyped; harmless), so the target hook and the STOP were corrected; PS-2 the
  KO options carry `sourceZone` (ids repeat), `SeatChoiceOption.sourceZone` widened; PS-3 an empty hand + discard pool is possible
  (teleport-on-discard), so RS-5 logs and parks nothing. RS folded: chain inputs read before the apply (applies void); the
  return-on-discard deviation stated (RS-4); labels locked (RS-6); import-cycle guardrail; the unwired timeout path does not chain;
  controlled-first order intentional; the private WP-858 delete helper duplicated. Verified at HEAD + `claude/wp858-exec`: seat-choice
  park / chain / guards, the client prompt and projection (no per-kind whitelist), bots + sim resolve at the default, the Possessed
  interaction via `turn.onMove`, the KO-site scanner, the lockstep pins, sentinel safety.
- **Pre-flight round 2:** **READY TO EXECUTE** (conditional on #3120 merging) — all folds verified; one stale test line ("no
  `unresolvedMarkers`") corrected.

- **Copilot round 2:** **PASS → CONFIRM** — all round-1 folds verified consistent across WP and EC; one wording nit applied
  (`readCommuneDiscardsLeft(G, choice)` returns `undefined` when the picked card left the hand). Execution still requires #3120
  merged (the EC's Before Starting STOP).

## Lint Gate Self-Review (00.3)

- **§1 structure:** every template section present and non-empty; Out of Scope names unmodeled Artifacts, the mgtg Artifact-discard
  lines, a bot policy, a multi-select UI, new queue / move / UIState / client / server surfaces, and the replay posture. **PASS.**
- **§2 constraints:** full-file output, no diffs/snippets, ESM, Node v22+, `00.6-code-style.md` cited; determinism, G-JSON /
  sentinel, discard-chokepoint, single-KO-site and marker-regen constraints; session protocol (four STOP triggers); locked values →
  EC. **PASS.**
- **§3 Assumes:** WP-858 (unmerged #3120, STOP gate in the EC), WP-684 / 683 / 821 / 853 / 856 and every helper, type, pin and
  chain point the change reads, with file and line. **PASS.**
- **§4 Context:** observed parse + card image check, why seat choices, "control" per rules p.17, cost semantics, three picks, the
  mandatory KO with zones, chaining, import cycles, bots, coordination; RS-1..RS-7 locked; ARCHITECTURE sections, 00.2 §5,
  DECISIONS scan list, 00.6. **PASS.**
- **§5 files:** every file listed with role and full path (~5 source + 5 test + data / generated). **PASS.**
- **§6 naming:** full words (`communeArtifactOptions`, `readCommuneCostBranch`, `discardsRemaining`); data slugs verbatim; no 00.2
  field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; engine + card data only; no client change (the generic seat-choice prompt);
  no registry import in the engine; no server change. **PASS.**
- **§9 Windows:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`; hooks from the real parser on committed `dstr.json`; the real `resolveSeatChoice`
  end to end; `Object.hasOwn` / `=== undefined` key checks; runtime pins (D-24372). **PASS.**
- **§13 verification:** exact regen and check commands with expected exits; engine baseline recorded at session start. **PASS.**
- **§14 / §15:** 9 binary criteria; DoD names STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap / ledger and the D-24026 live
  check (§15.1, operator-pending fallback with the `live-verify.json` row). **PASS.**
- **§16 code-style:** reuse of the seat-choice park / chain / generic prompt, the discard chokepoint and the owned-KO recorder;
  duplicate-first for the private WP-858 delete; `for` loops, no `.reduce()`, no nested ternaries; `// why:` locations in the EC.
  **PASS.**
- **§17 Vision:** clauses §1/§2/§8/§10/§22, no-conflict line, NG-1 line, determinism line. **PASS.**
- **§18:** no literal-grep verification step (the KO-site pin is a test). **N/A.** **§19:** no repo-state-summarizing artifact
  beyond the dependency PR number, re-checked at execution. **N/A.** Contract files: `types.ts` gains one optional field and widens
  one optional union, both covered by D-24796.
- **§20 funding:** N/A with the statement above. **§21 API catalog:** N/A (no endpoint). **PASS.**
- **Copilot round 1:** RISK → HOLD, all folded: (22/18) `parkSeatChoice` overwrites unconditionally, so a second park in one
  `executeHeroEffects` loop (Steal Abilities replaying two Communes, or Commune with Here, Hold This / Random Acts) would replace the
  open choice — RS-1 now refuses to park on top (D-24761 posture), with a test; (22) stale options locked as logged no-ops (RS-7: no
  KO without payment); (10/26) the cost branch is read by position, never label (RS-3); (27) RS-3 / User-Visible Impact labels aligned
  with RS-6; (11) tests added: end-to-end three-cards chain, bot decline, timeout decline, the guard, stale options, the earlier-turn
  Artifact not in the played ledger, the empty record `undefined`, a JSON round-trip; (26) the Artifact discard does not count toward
  `cardsDiscardedThisTurn` (RS-7); (12) `types.ts` file entry names the `sourceZone` widen; (5) `discardsRemaining` never written as
  `undefined`. Verified PASS on 21 modes incl. the chain after the delete, label-only projection (no client leak), no pin on the
  `sourceZone` union, sim via the real resolve, sentinel safety, WP-855 / 857 / 859 coordination.
