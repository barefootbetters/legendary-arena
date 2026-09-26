# WP-772 — Divided Card off-play traits: a split hero counts as both halves until it is played

**Status:** Draft 2026-09-26 · **EC:** EC-809 · **Reserves:** D-24604
**Primary Layer:** Game Engine (no registry, server, or client change)
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session (touches a scoring input — Ultron dynamic VP — and a determinism surface — the `sim:runtime-observed` sweep boards include all five split sets; NOT lightweight-eligible per 01.0a criteria #6 / #8)
**Baseline:** `origin/main` @ `d1a71c1f` (2026-09-26); re-checked against `cb1e1935` (#2427) — see the WP-725 / #2427 line under Assumes

## Goal

Make split / **Divided** hero cards (`physicalCards[].sides.length === 2` — 39 cards in
cvwr / mgtg / xmen / msis / bkwd) follow Marvel Legendary Universal Rules v23 p.49
"Divided Cards" everywhere they are **not in play**. While one sits in a hand, deck,
discard pile, the HQ, a victory pile or the Hero Deck, it counts as **both** halves' Hero
Classes (it is "a multicolored card"), and its printed Attack and Recruit are the **total**
of both halves. Once it is played, it counts only as the chosen half, as today. The same
packet fixes a related bug. A card played as its second half now offers the "choose a side"
choice again the next time it is played.

## User-Visible Impact

- A split card in hand now satisfies **either** of its classes: "reveal a [Tech] Hero or
  gain a Wound" (reveal-or-wound Ambushes and Scheme Twists), X-Gene discard checks, "Heroes
  of N different classes you have", and "defeat requirement" reveals. Today only the half
  listed first in the data (`sides[0]`) counts. For 19 of the 39 cards that is not even the
  left half. The player is under-credited.
- HQ class counts and filters (for example "Heroes in the HQ with [Covert]", a free recruit
  of a [class] Hero from the HQ) see both classes of a split card in the HQ.
- "Reveal the top card … you get its printed [Attack]" reads (She-Hulk's Jade Giantess, the
  `card-printed-stat` primitive) and the investigate stat criterion use the **sum** of both
  halves.
- **Replay bug:** today, a card played as face **b** goes to the discard pile as the face-b
  ext_id. The next time it is played it skips the choice and plays as face b forever
  (`isSplitCardInstance` only recognises primary-face ids). After this packet, every play of
  a split card offers the choice.

## Assumes

- **WP-724 / D-24545 ✅** — both faces enumerated into `G` at setup: per-face entries in
  `G.cardTraits` / `G.cardStats` / `G.cardDisplayData` / `G.heroAbilityHooks`, keyed
  `<setAbbr>/<heroSlug>/<cardSlug>#<copyIndex>`. The alternate face reuses the primary's
  `#copyIndex`. `G.splitFaces?: Readonly<Record<CardExtId, CardExtId>>` is a copy-agnostic
  primary-base → alternate-base map, **present only when non-empty** (a conditional spread
  at `setup/buildInitialGameState.ts` ~L555/L717). `G.heroDeck` holds primary-face ids only.
- **WP-724 / D-24546 ✅** — face chosen at PLAY time. `isSplitCardInstance` / `parkSplitFaceChoice` /
  `resolveSplitFaceChoice` live in `moves/splitFaceChoice.resolve.ts`. `playCard`
  (`moves/coreMoves.impl.ts` ~L552–563) parks the choice and skips `applyCardPlay`.
- **WP-725 ✅** — the client picker consumes `UIPendingSplitFaceChoice` verbatim. Its shape
  is **unchanged** by this packet.
- **#2427 ✅ (INFRA, 2026-09-26)** — the picker renders the printed left half first. The new
  optional field `G.splitFacesAlternateOnLeft` is keyed by the copy-agnostic **primary**
  card-key. `ui/uiState.build.ts` (~L1696) derives `UIPendingSplitFaceChoice.leftFace` from
  `faceA` with its `#copy` suffix stripped. That derivation is correct only while `faceA` is
  the primary instance. This packet's lock (`faceA` always = `pair.faceA`, even when a face-b
  id is played) keeps it correct. Without that lock, a replayed face-b card would render its
  halves in the wrong order.
- **WP-703 / D-24523 ✅** — `CardTraitEntry { heroClass: string | null; heroClass2?: string | null; team: string | null }`
  (`state/cardTraits.types.ts`). Every class read already matches `heroClass || heroClass2`.
- **D-24497 → D-24499** — "Heroes you have" = hand + played this turn. Hand cards are
  off-play and played cards are in play under this packet's split.
- **Card data (verified 2026-09-26 against `data/cards/{cvwr,mgtg,xmen,msis,bkwd}.json`):**
  all 39 split pairs have **two different** `hc` values, **no** `hc2` on either face, and the
  **same** `cost` on both faces. `team` is a **hero-level** field (one team per hero), so both
  faces already carry the same team.
- `pnpm -r build` exits 0 and the engine suite is green on `origin/main`.

## Context (Read First)

- **Rule text:** `docs/legendary-universal-rules-v23.md` "Divided Cards" (p.49; ~L2761–2790).
  While a Divided Card is anywhere else, including your hand, deck, discard pile or the HQ,
  it counts as all its Hero Classes, Teams, card names and Hero Names. It still counts as 1
  card, it counts as "a multicolored card", and its printed Attack is the total of both
  numbers. Once played, it counts only as the chosen side. A card that costs 3 on each side
  costs 3. **Icon note:** the text extraction drops the icon glyph in "its printed [icon] is
  the total". The data makes the reading moot for Recruit: no pair has Recruit on both halves
  (14 pairs Attack-a / Recruit-b, 13 Recruit-a / Attack-b, 4 Attack-a only, 4 Attack-b only,
  4 Attack on both). Summing both stats therefore gives the one printed Recruit a card has, and
  the Attack total matters only for the four two-Attack pairs (Luke Cage, Storm & Black Panther,
  Wanda & Vision, Falcon & Winter Soldier). Summing both is locked.
- `wiki/split-card.md` §Edge Cases records this gap ("Off-play the engine sees only one class").
- `docs/ai/DECISIONS.md` D-24545 / D-24546 (the model this extends), D-24523 (dual-class
  reads), D-24499 ("Heroes you have"), D-24362 (Ultron dynamic VP).
- **Why the gap exists.** Every trait read is keyed by ONE instance ext_id. An unplayed split
  card carries its primary (`sides[0]`) id, so every off-play read sees one face. Nothing in
  the engine combines the two faces. `G.splitFaces` has exactly two readers today, both in
  `splitFaceChoice.resolve.ts`.
- **Why a read-time view, not a new `G` field.** The union cannot be written into
  `G.cardTraits[primaryId]`, because the primary id is also the **in-play** id when face a is
  chosen, and in-play reads must see face a only. A derived view computed at read time from
  the existing `G.splitFaces` + `G.cardTraits` + `G.cardStats` adds **no hashed state**.
  Non-split games (where `G.splitFaces` is absent) take an identity path and are
  byte-unchanged. The two-slot `CardTraitEntry` is sufficient because every split face has
  exactly one class (no `hc2`, verified above): union = `{ heroClass: faceA.hc, heroClass2: faceB.hc }`.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (engine decides) and §Persistence Boundaries (`G`
  runtime-only). No shape change touches `docs/ai/REFERENCE/00.2-data-requirements.md`.
- **Why one WP, not a split.** The change is one pure helper plus a mechanical, zone-scoped
  call-site migration inside a single layer, locked by one decision. Splitting the
  trait-union sites from the printed-number sites would force two packets to share the new
  helper file and re-derive the same off-play/in-play boundary. The face-b replay fix shares
  the same helper (a reverse lookup on `G.splitFaces`) and the same rule clause ("when you
  play a Divided Card, you choose which side to play"), so it rides along.
- **Scope decisions surfaced for review:**
  - **Team, card name, Hero Name: no code change.** Team is hero-level in the data (both
    faces equal). No gameplay code compares card names or Hero Names (names are read only for
    logs and narration). The known data gap: a dual-hero card such as *Storm & Black Panther*
    prints two team icons, but the data carries one team per hero. That is a card-data
    question, out of scope here.
  - **Cost: no code change.** Both halves print the same cost in all 39 pairs, and the rule
    charges it once.
  - **Ultron dynamic VP + Blood Frenzy (`countTechHeroesAmongCards`)** are in scope. They
    count [Tech] Heroes across every zone. Off-play zones take the union and `inPlay` takes
    the chosen face. This changes Ultron's VP in split-hero games only. That is the one
    scoring input touched.

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- Never `Math.random()`. No I/O in moves or helpers. Moves never throw.
- `G` stays JSON-serializable. **No new `G` field** is added by this packet.
- Zones store `CardExtId` strings only. Zone mutations go through `zoneOps.ts`.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test` + `makeMockCtx`, no `boardgame.io` import
  in the new helper or tests.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`. No `.reduce()`, no abbreviations,
  JSDoc on every function, and full-sentence error and warning text.

**Packet-specific:**
- **In-play reads are unchanged.** Any read of a card in `inPlay` keeps using
  `G.cardTraits[id]` / `cardHasClassWhenPlayed` / `G.cardStats[id]` as today (chosen face
  only). This includes `countDistinctHeroClassesInPlay`, `heroConditionHoldsForInPlay`,
  `applyCardPlay`, Copy Powers, and every `heroCountSource` in-play count.
- **Off-play reads go through the new helper**, never through an inline `G.splitFaces` walk.
- **Identity when not split.** For any id whose base is not a split face, or when
  `G.splitFaces` is `undefined`, the helper returns exactly `G.cardTraits[id]` /
  `G.cardStats[id]` (same object reference is acceptable). Non-split games are byte-unchanged.
- **No new `G` field. No change to `G.splitFaces`, `G.cardTraits`, `G.cardStats`, or the
  `PendingSplitFaceChoice` / `UIPendingSplitFaceChoice` shapes.**
- `faceA` in a parked choice is **always the primary-face instance** (`sides[0]`) and `faceB`
  is always the alternate at the same `#copyIndex`, whichever face id was played.
  `sourceCardId` is the id actually in `inPlay`.
- No UI / client / server / registry / card-data change.

- Call-site `// why:` comments refer to "the split-face map", never the `G` field's name — Verification Step 3 greps that token and would flag them.

**Session protocol:** if a read site's zone provenance is unclear (the id could be in play or
off play), STOP and ask. Never guess the zone.

## Locked Contract Values

- New module `packages/game-engine/src/hero/splitCard.logic.ts` (pure, no `boardgame.io` import) exporting exactly:
  - `resolveSplitFacePair(G, cardId): { faceA: CardExtId; faceB: CardExtId } | null` —
    `null` when `G.splitFaces` is `undefined` or the id's base is neither a primary nor an
    alternate split face. Otherwise both face instance ids at the id's own `#copyIndex`. The
    reverse lookup (alternate → primary) iterates `G.splitFaces` entries with `for...of`.
  - `offPlayCardTraits(G, cardId): CardTraitEntry | undefined` — split: `{ heroClass: traitsA.heroClass, heroClass2: traitsB.heroClass, team: traitsA.team }`
    (`heroClass2` omitted when equal to `heroClass`). Otherwise `G.cardTraits[cardId]`.
  - `offPlayCardStats(G, cardId): CardStatEntry | undefined` (`economy/economy.types.ts`,
    the existing `G.cardStats` value type) — split: face-a entry with `attack = a.attack + b.attack`,
    `recruit = a.recruit + b.recruit`, `hasAttackIcon = a.hasAttackIcon || b.hasAttackIcon`,
    `hasRecruitIcon = a.hasRecruitIcon || b.hasRecruitIcon`. Every other field (including `cost`) is face a's.
    Otherwise `G.cardStats[cardId]`.
- `isSplitCardInstance(G, cardId)` returns true for **either** face id
  (`resolveSplitFacePair(G, cardId) !== null`).
- `parkSplitFaceChoice` records `{ playerID, sourceCardId: <played id>, faceA: pair.faceA, faceB: pair.faceB }`.
- `resolveSplitFaceChoice` relabels the `inPlay` entry from `sourceCardId` to the chosen
  face id **when they differ** (covers played-as-b choosing a, and played-as-a choosing b),
  then grants and fires the chosen face exactly as today.
- Off-play zone set = `hand`, `deck`, `discard`, `victory`, the HQ, `G.heroDeck`, `G.ko`,
  revealed / moved cards not in `inPlay`. In-play = `playerZones[*].inPlay`.
- The three helpers are not re-exported from `index.ts`. No new `G` field. The moves-count,
  `HERO_KEYWORDS`, and `HERO_EFFECT_HANDLERS` pins are unchanged.
- The three helpers never throw. An absent `G.cardTraits` / `G.cardStats` returns `undefined`;
  a missing face-a or face-b entry falls back to the raw entry for `cardId`.
- The split path returns a newly built object and never writes to `G.cardTraits` / `G.cardStats`.
  Callers never mutate a returned entry (the identity path returns the live `G` reference).
- `resolveSplitFacePair` looks up the primary key first and scans for an alternate value only on
  a miss.

## Scope (In)

### A) New pure helper — `hero/splitCard.logic.ts` (the Locked Contract Values above)

### B) Face-b replay fix — `moves/splitFaceChoice.resolve.ts`
- `isSplitCardInstance` + `parkSplitFaceChoice` use `resolveSplitFacePair`. The relabel in
  `resolveSplitFaceChoice` goes from `sourceCardId` to the chosen face when different.
  `playCard` (`coreMoves.impl.ts`) needs no edit. If the executor finds it does, that is an
  inline allowlist amendment and must be recorded.

### C) Off-play Hero Class reads → `offPlayCardTraits`
- `hero/heroConditions.evaluate.ts`: `discardHasHeroClass` (~L652, discard); the **hand**
  branch of `countDistinctHeroClassesYouHave` (~L541). Its in-play branch is unchanged.
- `hero/heroCountSource.resolve.ts`: the **hand** branch of `collectDistinctHeroClassCards` (~L647).
  **Consistency-only:** that branch tests only "has any class", and face a always has one, so
  behavior does not change and no failing revert proof is expected for it. Update the
  diagnostics comments (~L637 / ~L700) that claim `count <= countedInputs.length`: one split
  card in hand yields 2 classes from 1 id (as a lone dual-class card already does). No test may
  assert that relationship for split cards.
- `hero/effectPrimitive.interpret.ts`: `evaluateCountCardsByClassInZone` (~L172, HQ),
  `evaluateMaxClassCountInZone` (~L221, HQ), `evaluateTopDeckCardClassCountInZone` (~L294,
  deck top + HQ).
- `hero/heroEffects.execute.ts`: `revealPredicateMatches` hero-class branch (~L1893, deck
  top); `investigateCardMatchesCriteria` (~L5066, deck window + Psychic Link hand reveal).
- `rules/mastermindHandlers.ts`: `selectLowestCostHero` class filter (~L590, hand).
- `rules/tacticHandlers.ts`: `hqHeroMatchesFreeRecruitFilter` (~L764, HQ).
- `moves/giveHqHeroChoice.resolve.ts`: `hqHeroMatchesFilter` (~L72, HQ).
- `rules/schemeTwistResolvers.ts`: the reveal-or-punish hand check (~L130–136).
- `villain/villainEffects.execute.ts`: `cardTraitMatches` (~L1465) callers made zone-aware.
  HQ (`countHqHeroesByTrait` ~L2502, `selectHqHeroIndexByTraitHighestCost` ~L2604) and the
  **hand** portion of `playerHasHeroMatchingTrait` (~L1493), `countPlayerHeroesMatchingTrait`
  (~L1521) and `koHeroMatchesTraitOrBasicShield` (~L2224) use the union. Their `inPlay`
  portions are unchanged. These helpers take `cardTraits`, not `G`, and their
  callers pass a concatenated `[...hand, ...inPlay]` (~L1592 / L2344 / L2449). The concatenation
  sites must split by zone. The behavior is locked; the helper signatures are not (they may take
  `G` or separate off-play / in-play id lists).
- `moves/villainDefeatRequirement.logic.ts`: the **hand** branch of `playerMeetsDefeatRequirement` (~L50).
- `scoring/dynamicVictoryPoints.ts` `countTechHeroesAmongCards` (~L44) and
  `computeDynamicVillainVictoryPoints` (~L90–121, Ultron), plus **both** callers that build the flat
  all-zones id list: `scoring/scoring.logic.ts` `computeFinalScores` (~L112–134, the final-score
  path) and `economy/bloodFrenzy.logic.ts` (~L62–73, which mirrors it). `inPlay` can be non-empty
  at game end (e.g. a Mastermind defeated mid-turn).
  Off-play zones take the union and `inPlay` takes the chosen face. The executor may change
  the pure function's parameters (e.g. separate off-play and in-play id lists plus `G`,
  so the helper resolves the split pair). The behavior is locked. The signature is not. Final scores and
  `victoryPointValueForCard` must agree for a split-hero Ultron board (tested).

### D) Off-play printed Attack / Recruit → `offPlayCardStats`
- `hero/effectPrimitive.interpret.ts` `evaluateCardPrintedStat` (~L125). The bound card was
  moved off a zone top and is not in play.
- `hero/heroEffects.execute.ts` `heroEffectRevealHeroDeckAttack` (~L2497, `G.heroDeck[0]`),
  plus the stat fields of `investigateCardMatchesCriteria` (~L5074).
- `moves/resolveOptionalPutBottomHQ.ts` icon reward (~L153, HQ card). "Has a Recruit / Attack
  icon" is true when either half has one.

### E) Tests
- New `hero/splitCard.logic.test.ts`:
  - `resolveSplitFacePair` from a primary id and from an alternate id (same `#copyIndex`).
  - `null` for a non-split id and for `G.splitFaces === undefined`.
  - `offPlayCardTraits` union and identity.
  - `offPlayCardStats` sum, cost from face a, and identity.
  - Contract edges: an absent `G.cardTraits` / `G.cardStats` returns `undefined`; a missing face
    entry falls back to the raw entry; the split path returns an object that is not `===` to any
    `G` entry; an alternate id resolves only after the primary lookup misses.
  - A **real-data invariant pin**: load the five split sets' JSON and assert all 39 pairs have
    no `hc2`, distinct `hc`, equal `cost`, and no Recruit on both faces, and that the map is one-to-one (no base is
    both a primary key and an alternate value, and no alternate value appears twice). This is the two-slot and
    sum premise, and it must fail loudly if data ever breaks it.
- `moves/splitFaceChoice.resolve.test.ts`:
  - **Intentional assertion flip:** the existing `isSplitCardInstance(withMap, FACE_B) === false`
    assertion (~L151) becomes `=== true`. This is a deliberate behavior change (D-24604 §4), and
    the EC commit body must say so (Reward Integrity).
  - Face-b played → cleanup → replay parks a new choice with `faceA` = primary id and
    `faceB` = alternate id.
  - Choosing `a` from a played face-b id relabels `inPlay` to face a and grants face a's economy.
- One targeted test per converted surface family:
  - Hand reveal-or-wound: a split card whose **face b** has the required class satisfies it.
  - HQ class count sees both classes.
  - X-Gene discard.
  - Distinct classes "you have": a hand split card contributes 2, an in-play one contributes 1.
  - Jade Giantess and `card-printed-stat` both read the sum.
  - Ultron VP counts a split card with a [Tech] face b in the deck but not an in-play face-a
    non-Tech choice, and `computeFinalScores` agrees with `victoryPointValueForCard` on that board.
- **Negative / non-vacuous:** each test must fail when its site is reverted to the raw
  `G.cardTraits[id]` / `G.cardStats[id]` read. The executor proves this once per family (by
  temporary revert, reported in the session summary).

## Out of Scope

- Any client / UI display of both classes for an unplayed split card
  (`ui/uiState.build.ts` `resolveDisplay` projects `heroClass` only). This is a
  follow-up client WP if wanted.
- Per-face teams for dual-hero split cards (a card-data gap). Card-name / Hero-Name matching
  (no such gameplay reads exist).
- Steal Abilities / Copy Powers playing a copy **of** a split card (which face the copy
  plays is a separate face-choice question). Economy stays per-id as today.
- `PendingSplitFaceChoice` / `UIPendingSplitFaceChoice` shape changes, the bot's face-a
  default, or any `G.splitFaces` / `G.cardTraits` / `G.cardStats` shape change.
- In-play reads (listed under Non-Negotiable Constraints) — unchanged by design.
- Registry schema, card data, and the D-13502 ext_id grammar.

## Files Expected to Change

Engine (`packages/game-engine/src/`):
- `hero/splitCard.logic.ts` — **new**
- `moves/splitFaceChoice.resolve.ts` — **modified**
- `hero/heroConditions.evaluate.ts` — **modified**
- `hero/heroCountSource.resolve.ts` — **modified**
- `hero/effectPrimitive.interpret.ts` — **modified**
- `hero/heroEffects.execute.ts` — **modified**
- `rules/mastermindHandlers.ts` — **modified**
- `rules/tacticHandlers.ts` — **modified**
- `rules/schemeTwistResolvers.ts` — **modified**
- `moves/giveHqHeroChoice.resolve.ts` — **modified**
- `moves/villainDefeatRequirement.logic.ts` — **modified**
- `moves/resolveOptionalPutBottomHQ.ts` — **modified**
- `villain/villainEffects.execute.ts` — **modified**
- `scoring/dynamicVictoryPoints.ts` — **modified**
- `scoring/scoring.logic.ts` — **modified**
- `economy/bloodFrenzy.logic.ts` — **modified**

Engine tests:
- `hero/splitCard.logic.test.ts` — **new**
- `moves/splitFaceChoice.resolve.test.ts` — **modified**
- The existing sibling `*.test.ts` of any converted file that gains its family test — **modified**
  (the executor lists which in the session summary; test-only files beside an allowlisted
  source file are pre-authorized).

Determinism artifact (**conditional**): `docs/ai/coverage/runtime-observed-hollows.json`, only through
`pnpm sim:runtime-observed` after an investigated, split-board-attributable diff (see DoD).

Governance: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24604 → Active),
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md`, `wiki/split-card.md` (Edge Cases: gap closed).

No other files may be modified.

## Contract

- `resolveSplitFacePair`, `offPlayCardTraits`, `offPlayCardStats` exactly as in Locked
  Contract Values. They are engine-internal and **not** re-exported from `index.ts`.
- `isSplitCardInstance(G, id)` is true for either face of a split card.
- Rulebook boundary: **off-play → union / sum; in-play → chosen face only.**
- No new `G` field, no move added, no `HeroKeyword` / handler change. Moves count,
  `HERO_KEYWORDS`, and `HERO_EFFECT_HANDLERS` pins are unchanged.

## Acceptance Criteria

1. A split card in hand satisfies a hand-scoped class check for **either** of its two classes
   (reveal-or-wound, reveal-or-punish, defeat requirement, lowest-cost-of-class, Psychic Link).
2. In the HQ, a split card counts toward both its classes in every HQ class count and filter.
3. In the discard pile, a split card satisfies X-Gene for either class.
4. "Distinct classes you have": a split card in hand contributes both classes. The same card
   in play contributes only its chosen class.
5. Off-play printed Attack / Recruit reads return the sum of both halves. Cost reads are
   unchanged.
6. Ultron VP and Blood Frenzy count a split card with a [Tech] half as a [Tech] Hero when it
   is not in play. In play, only the chosen face counts.
7. A card played as face b and later replayed parks a fresh choice. Choosing either face
   relabels `inPlay` correctly and grants that face's economy and ability.
8. Every in-play read is unchanged (the existing engine suite stays green without edits to
   in-play assertions).
9. Non-split games are byte-unchanged. The sentinel `finalStateHash` pin is unchanged with
   no re-pin.

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/registry --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — engine suite (record before/after counts; +N new tests, 0 fail)
pnpm --filter @legendary-arena/game-engine test

# Step 3 — no inline splitFaces walks outside the helper + the choice module
# (word-bounded, so #2427's splitFacesAlternateOnLeft field is not matched)
Get-ChildItem packages\game-engine\src -Recurse -Filter *.ts -Exclude *.test.ts | Select-String -Pattern "\bsplitFaces\b" | Select-Object -ExpandProperty Path -Unique
# Expected: matches only in hero/splitCard.logic.ts, moves/splitFaceChoice.resolve.ts,
#           setup/buildHeroDeck.ts, setup/buildInitialGameState.ts, types.ts (the baseline set on cb1e1935
#           is buildHeroDeck.ts / buildInitialGameState.ts / types.ts / splitFaceChoice.resolve.ts)

# Step 4 — sentinel hash (core plays no split hero)
pnpm --filter @legendary-arena/game-engine exec node --import tsx --test "src/test/fixtures/replayFixtures.test.ts"
# Expected: green ("every committed fixture replays equal to its pinned expected block")
git diff --exit-code -- packages/game-engine/src/test/fixtures/games
# Expected: exits 0 (sentinel-core-doom-2p.replay.json and siblings not re-pinned)

# Step 5 — determinism artifact
pnpm sim:runtime-observed:check
# Expected: exits 0 with no regeneration; OR a diff confined to the bkwd/cvwr/mgtg/msis/xmen
#           boards, investigated and attributed, then regenerated with `pnpm sim:runtime-observed`

# Step 6 — whole repo
pnpm -r build; pnpm -r --no-bail test
# Expected: 0 failures

# Step 7 — scope
git status --porcelain
# Expected: only the Files Expected to Change allowlist (tracked edits AND the two new untracked files).
# `pnpm -r build` may rewrite generated artifacts (e.g. packages/lagn-spec/schemas/lagn-v1.json);
# revert line-ending-only churn — it is neither in scope nor a violation.
```

## Definition of Done

- [ ] All acceptance criteria pass. Each test family is proven non-vacuous by a temporary
      revert (reported).
- [ ] `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. Engine counts are
      recorded.
- [ ] Sentinel `finalStateHash` byte-identical with no re-pin. The moves-count,
      `HERO_KEYWORDS`, and `HERO_EFFECT_HANDLERS` pins are unchanged.
- [ ] `sim:runtime-observed:check` exits 0 with no regeneration, **or** the diff is confined
      to split-set boards and the WP-772 behavior change explains it. In that case it is
      regenerated once and the attribution goes in the commit body. It is never
      re-baselined blind.
- [ ] `git status --porcelain` ⊆ the allowlist (the untracked new files included).
- [ ] **D-24026 live verify (REQUIRED):** on play.legendary-arena.com, use a match with a
      split hero (for example `cvwr/peter-parker`), in a **manual** match. Autoplay cannot
      do it, because the bot always picks face a. Play a split card as face **b**. After it cycles back, playing it
      again shows the picker again. Record the matchId in STATUS.md. Check the off-play union
      through Play Diagnostics where a hand-reveal or HQ class check fires. A merged PR
      alone is not done.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` D-24604 flipped to Active.
      `wiki/split-card.md` Edge Cases updated (gap closed; the face-b replay fix recorded).
- [ ] `WORK_INDEX.md` WP-772 checked off with date. `EC_INDEX.md` EC-809 → Done.
      `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅`. `pnpm roadmap:counts:write`;
      `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:** §1 / §2 (faithful card semantics — the printed Divided Card rule),
  §8 / §22 (determinism), §20–§21 (scoring — Ultron dynamic VP feeds RawScore in split-hero games).
  NG-1 (no pay-to-win).
- **Conflict assertion:** No conflict. This makes existing printed rules faithful. It
  touches no monetization surface. The scoring change applies the printed rule to every
  player equally.
- **Non-Goal proximity:** NG-1 not crossed — nothing is purchasable.
- **Determinism preservation:**
  - The helper is pure and derived from already-hashed setup maps, and no new `G` state
    is added.
  - `G.splitFaces` is absent in non-split games, so they take the identity path.
  - The reverse lookup iterates object keys in insertion order (deterministic).
  - Split-hero replays (D-24119) recorded before this packet may diverge on re-execution,
    because class checks now succeed where they failed. Gauntlet `legPicks` are player-chosen, so
    stored competitive or gauntlet rows with split heroes can exist without a fixed pool. Policy
    (D-24604 §5): stored `competitive_scores` rows are frozen and not re-verified. The executor
    gives Jeff a read-only psql count of split-hero `team_key` rows for the record. The executor
    never writes to prod.

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1 structure:** Goal / Assumes / Context / Non-Negotiable Constraints / Scope In + Out /
  Files / Contract / AC / Verification / DoD are all present. The baseline SHA is cited.
- **§2 constraints:** engine-wide (including full file contents and Node v22+),
  packet-specific, session protocol, and locked values.
- **§3 Assumes / §4 Context:** dependencies, the data premise, the rule text, ARCHITECTURE,
  and D-entries are all cited.
- **§5 files / §7 deps:** a closed allowlist (16 source + 2 named tests + sibling tests
  pre-authorized by rule + one conditional artifact + governance). No new npm deps, no
  forbidden packages.
- **§6 naming:** `MatchSetupConfig` untouched. `CardTraitEntry`,
  `heroClass` / `heroClass2`, `splitFaces`, `faceA` / `faceB`, and `sourceCardId` are used
  verbatim from source. The new names (`resolveSplitFacePair`, `offPlayCardTraits`,
  `offPlayCardStats`) are full words.
- **§8 layer boundary:** engine only. No registry, server, or client import. The new helper
  imports types only (`types.ts`, `state/cardTraits.types.ts`, `economy/economy.types.ts`).
- **§9 Windows:** the verification uses `pwsh` (`Get-ChildItem -Recurse | Select-String`).
- **§10 env / §11 auth:** N/A — no env var or auth surface.
- **§12 tests:** `node:test` + `makeMockCtx`, no boardgame.io import. The tests include a
  non-vacuous revert proof and a real-data invariant pin.
- **§13 verification:** exact commands with expected outcomes.
- **§14 AC / §15 DoD:** binary ACs. The DoD carries STATUS, DECISIONS, WORK_INDEX, scope,
  and D-24026 live-verify. Determinism and persistence: no new `G` field, a pure read-time derivation,
  a sentinel pin unchanged, and runtime-observed handled honestly. Replay divergence is
  recorded.
- **§16 code style:** small functions, `for...of` (no `.reduce()`), and `// why:` on the
  union/sum rule, the reverse lookup, and each zone-split call site.
- **§17 Vision Alignment:** present (§1/§2, §8/§22, §20–§21, NG-1).
- **§18 prose-vs-grep:** Step 3 greps `splitFaces` as an allowlist of files, not a count. A
  packet constraint requires call-site `// why:` comments to say "the split-face map".
- **§19 bridge:** N/A — commit-time rule; baseline `d1a71c1f` recorded.
- **§20 Funding Surface:** N/A — no funding, navigation, profile, or donate
  surface.
- **§21 API Catalog:** N/A — no `apps/server` endpoint or `Library-only` function changes.

## Gate Verdicts

All three gates ran as independent subagents against source (2026-09-26). After #2427 landed,
the WP was amended: an Assumes line and a word-bounded Step 3 grep. A delta gate re-run
followed (recorded below).

- **Pre-flight (01.4): READY TO EXECUTE.**
  - The first run was NOT READY on PS-1: the final-score caller `scoring.logic.ts`
    `computeFinalScores` was missing. It was added to Scope C and the allowlist.
  - RS-1..RS-10 were resolved in place: icon flags OR'd; the test flip called out; zone-split
    latitude; consistency-only note; stored-scores policy; the recursive grep; sentinel
    verification on `replayFixtures.test.ts`; `git status --porcelain`.
  - A delta re-run confirmed READY.
- **Copilot (01.7): PASS.**
  - The first run was RISK → HOLD on six wording/test items: never-throw, no-write,
    primary-first lookup, the icon hatch closed by data, the diagnostics comment, and the
    build-churn note. All were applied in place.
  - The re-run was PASS with three optional nits: contract-edge tests, one-to-one pin wording,
    and the EC churn mirror. These were also applied.
- **Lint (00.3): PASS.**
  - The first run failed on §2, §9/§13, and EC Locked Values not verbatim.
  - The re-run failed only on the Step 4 sentinel filter. That was fixed, and a delta re-run
    gave PASS.

**Documented RISK (none open).** The printed-icon glyph is lost in text extraction. The data
settles it (see the Context icon note).
