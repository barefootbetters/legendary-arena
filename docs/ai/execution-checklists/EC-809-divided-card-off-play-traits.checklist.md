# EC-809 — Divided Card off-play traits (Execution Checklist)

**Source:** docs/ai/work-packets/WP-772-divided-card-off-play-traits.md
**Layer:** Game Engine

## Before Starting
- [ ] `pnpm --filter @legendary-arena/registry --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (record the baseline count)
- [ ] Confirm on `main`: `G.splitFaces` is runtime-read only in `moves/splitFaceChoice.resolve.ts` (setup writes it in
      `buildHeroDeck.ts` / `buildInitialGameState.ts`); `isSplitCardInstance` recognises primary ids only; the resolve
      relabel is `faceA → faceB` only.
- [ ] Re-verify the data premise: all 39 split pairs have no `hc2`, distinct `hc`, equal `cost`, no Recruit on both faces; else STOP.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
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

## Guardrails
- In-play reads untouched: `cardHasClassWhenPlayed`, `countDistinctHeroClassesInPlay`, `heroConditionHoldsForInPlay`,
  `applyCardPlay`, Copy Powers, every `heroCountSource` in-play count.
- Off-play reads call the helper — never an inline walk of the split-face map at a call site.
- Identity when not split / map absent → non-split games byte-unchanged; sentinel `finalStateHash` NOT re-pinned.
- Mixed `[...hand, ...inPlay]` concatenations (villainEffects, scoring, Blood Frenzy) split by zone; signatures may change.
- Zone-ambiguous site → STOP and ask; never guess. Team / cost / name reads NOT converted.
- The `isSplitCardInstance(…FACE_B) === false` test flip is an intentional behavior change — say so in the commit body.
- Moves never throw; `for...of` only; full file contents; call-site `// why:` says "the split-face map", not the field name.
- Tests non-vacuous: each surface-family test FAILS when its site is reverted to the raw read (prove once, report);
  `collectDistinctHeroClassCards` is consistency-only (no revert proof expected); fix its `count <= countedInputs.length`
  diagnostics comments (~L637 / ~L700).

## Required `// why:` Comments
- `splitCard.logic.ts` union + sum: cite rules v23 p.49 Divided Cards (off-play = all classes, printed numbers totalled; cost once).
- The reverse (alternate → primary) lookup: why face-b ids reach off-play zones (the resolve relabel survives cleanup).
- `resolveSplitFaceChoice` relabel from `sourceCardId`: why a played face-b id may choose face a.
- Each zone-split call site (hand vs inPlay; the [Tech] count callers): why only the off-play portion unions.

## Files to Produce
- `packages/game-engine/src/hero/splitCard.logic.ts` — **new** — pair / off-play traits / off-play stats
- `packages/game-engine/src/moves/splitFaceChoice.resolve.ts` — **modified** — either-face recognition + relabel
- `packages/game-engine/src/hero/{heroConditions.evaluate,heroCountSource.resolve,effectPrimitive.interpret,heroEffects.execute}.ts` — **modified**
- `packages/game-engine/src/rules/{mastermindHandlers,tacticHandlers,schemeTwistResolvers}.ts` — **modified**
- `packages/game-engine/src/moves/{giveHqHeroChoice.resolve,villainDefeatRequirement.logic,resolveOptionalPutBottomHQ}.ts` — **modified**
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — zone-aware trait-match callers
- `packages/game-engine/src/scoring/{dynamicVictoryPoints,scoring.logic}.ts` + `economy/bloodFrenzy.logic.ts` — **modified** — [Tech] count
- `packages/game-engine/src/hero/splitCard.logic.test.ts` — **new** (incl. 39-pair real-data pin: no hc2, distinct hc, equal cost, no Recruit on both, one-to-one map incl. no duplicate alternate)
- `packages/game-engine/src/moves/splitFaceChoice.resolve.test.ts` — **modified** (face-b replay + assertion flip)
- Sibling `*.test.ts` of any file above — **modified** (family tests; list them in the summary)
- `docs/ai/coverage/runtime-observed-hollows.json` — **conditional** (only after an attributed split-board diff)
- `docs/ai/{STATUS,DECISIONS}.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `wiki/split-card.md` — **modified**

## After Completing
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 failures; engine before/after counts recorded
- [ ] Sentinel pin: `src/test/fixtures/replayFixtures.test.ts` green + `git diff --exit-code -- packages/game-engine/src/test/fixtures/games` exits 0; moves / keyword / handler pins unchanged
- [ ] `pnpm sim:runtime-observed:check` exits 0 with no regeneration — OR a diff confined to bkwd/cvwr/mgtg/msis/xmen
      boards, attributed in the commit body, then regenerated once (never re-baselined blind)
- [ ] `git status --porcelain` ⊆ Files to Produce (includes the untracked new files; revert line-ending-only
      `pnpm -r build` churn such as `lagn-v1.json`)
- [ ] Live-on-surface (D-24026): manual play.legendary-arena.com split-hero match — a face-b card replayed shows the
      picker again; matchId recorded in STATUS.md
- [ ] Read-only psql count of stored split-hero `team_key` rows handed to Jeff (no prod write)
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24604 → Active (with the D-24119 replay note)
- [ ] `wiki/split-card.md` Edge Cases updated (off-play gap closed; face-b replay fixed)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-772 checked off with date; `EC_INDEX.md` EC-809 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-772 `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells
- An in-play synergy ("if you played a [Tech] card") fires off the unchosen half → an `inPlay` site got the union.
- Sentinel hash moved → the helper is not identity for non-split ids, or a new `G` field leaked in.
- runtime-observed diff on a non-split board → a non-split read path changed; investigate, do not regenerate.
- Final score ≠ live Ultron VP on a split board → `scoring.logic.ts` still passes the flat all-zones list.
- Face-b card replays with no picker → `isSplitCardInstance` still keyed on primary only.
