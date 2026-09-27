# WP-780 — Penumbra: while it is active, a played Divided Card plays both sides as two different cards

**Status:** Draft 2026-09-26 · **EC:** EC-817 · **Reserves:** D-24619
**Primary Layer:** Game Engine + card data (no registry, server, or client change)
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session (adds a `HeroKeyword` + handler, a lazy `TurnEconomy` field, and changes how
in-play hero-condition / count reads see a card — a determinism surface; NOT lightweight-eligible per 01.0a
criteria #3 / #6 / #8)
**Baseline:** `origin/main` @ `9dff9dba` (2026-09-26, #2446 D-24618 merged)

## Goal

Make cvwr Cloak & Dagger **Penumbra** (rare, cost 7, `[hc:ranged]`, 4 Attack) do what it prints:
"Whenever you play a [rule:Divided Card] card this turn, play both sides as if they were two different
cards." After Penumbra is played, every **later** split / Divided hero card played **that turn** skips the
"choose a side" picker. The engine grants **both** faces' base Attack / Recruit and fires **both** faces'
abilities, face a then face b. For the rest of the turn, in-play hero-ability reads see that one physical card as
**two played cards**, one per face, each with its own class. Today Penumbra does nothing (its 4 Attack
aside). Since D-24618 it at least reports a `rule:divided-card` hollow.

## User-Visible Impact

- Play Penumbra, then play Above/Below: no picker. You get Above's 2 Attack **and** Below's Recruit and
  ability. The log shows "Player N played <card>.", then "Penumbra: both sides of <card> play as two
  different cards.", then one "Player N resolved side a/b: …" line per face.
- Superpowers see both halves as separate cards, played in order. The second half's superpower can count
  the first half as "another [class] Hero you played"; the first half's cannot count the second (it has not
  been played yet). "Played N cards this turn" counts go up by 2.
- The play diagnostics stop listing `rule:divided-card` for Penumbra: the line becomes executable.
- A split card played **before** Penumbra, or on a turn Penumbra is not played, behaves exactly as today
  (picker, one face).

## Assumes

- **WP-724 / D-24545 / D-24546 ✅**: both faces are enumerated into `G` at setup (per-face `cardStats` /
  `cardTraits` / `heroAbilityHooks`, `#copyIndex` shared); `G.splitFaces` is present only when non-empty;
  `playCard` (`moves/coreMoves.impl.ts` ~L547–564) parks a `PendingSplitFaceChoice` and skips `applyCardPlay`;
  `resolveSplitFaceChoice` grants the chosen face and fires `executeHeroEffects(G, context, playerID, chosenExtId)`.
- **WP-772 / D-24604 ✅**: `hero/splitCard.logic.ts` exports `resolveSplitFacePair(G, cardId)` (either face
  id → `{ faceA, faceB }` at the id's `#copyIndex`, or `null`). `isSplitCardInstance` recognises either face.
  In-play reads were deliberately left chosen-face-only (EC-809 Guardrails); this WP is the first to widen them,
  and only for a card marked "both faces played" this turn.
- **D-24618 ✅ (#2446, merged 2026-09-26 as `9dff9dba`)**: `[rule:X]`-only lines record `rule:<concept>`
  unresolved markers. Penumbra's line is the `rule:divided-card` hollow this WP retires.
- **Per-turn state pattern (verified 2026-09-26)**: lazy optional fields on `TurnEconomy`
  (`economy/economy.types.ts`: `drawsLocked` :69, `excessiveViolencePlayedCards` :88,
  `excessiveViolenceUsedThisTurn` :100) are carried through `carryConversionFlag`
  (`economy/economy.logic.ts` ~L504–525) and dropped by `resetTurnEconomy` (:808) at the play-phase
  `turn.onBegin` (`game.ts` ~L861). Absent-until-set keeps every hash oracle byte-identical.
- **Card-data marker pipeline**: `[keyword:X]` markers come from the curated map
  `scripts/convert-cards/inputs/hero-ability-markers.json` via `apply-hero-ability-markers.mjs` (surgical,
  idempotent); `cards:check` regenerates and compares.
- **Handler-bearing `HeroKeyword` lockstep (verified 2026-09-26)**:
  - `rules/heroKeywords.ts` union + array.
  - **Three** `HERO_KEYWORDS` length pins: `rules/heroKeywords.test.ts` ~L67, `rules/heroAbility.setup.test.ts`
    ~L637, and `setup/heroAbility.setup.test.ts` ~L1430.
  - `HERO_EFFECT_HANDLERS` and its **two** count pins: `hero/heroEffects.execute.test.ts` ~L132 and ~L7198.
  - `HANDLED_KEYWORDS`; `NO_MAGNITUDE_KEYWORDS` (~L441); and the setup parser.
  - Read the current values at execution. Do not reuse these line numbers as values.
- **Data premise (verified 2026-09-26 over all 39 split pairs)**: no split face's ability text refers to
  "this card", so firing face b's ability under its face-b id (which is not itself an `inPlay` entry) loses no
  self-reference. Penumbra is the only card in the corpus whose text grants "play both sides".
- **Existing exports this WP uses:**
  - `addResources` (`economy/economy.logic.ts`).
  - `formatPlayedCardLabel` / `formatBaseEconomyClause` (`log/logDisplay.ts`).
  - `pushLog(G, message, outcome, card?)` (`log/logPush.ts`).
  - `isSplitCardInstance` (`moves/splitFaceChoice.resolve.ts`).
  - `executeHeroEffects(...): number`.
  - `PLAYED_LINE` (`apps/arena-client/src/diagnostics/effectProvenance.ts`), read-only.
- `pnpm -r build` exits 0 and the engine suite is green on `origin/main`.

## Context (Read First)

- **Rule text.** `docs/legendary-universal-rules-v23.md` "Divided Cards" (p.49, ~L2761–2790): "When you play
  a Divided Card, you choose which side to play … You ignore the other side, as if it didn't exist." Penumbra
  overrides that for the rest of its turn: both sides are played "as if they were two different cards".
- **Found via** operator match `19720cb4-929c-467a-ab31-6a63bfaa85ea` (Loki / Midtown Bank Robbery, 1p,
  split heroes). Penumbra was played 4 times and did nothing. That match also exposed that the hollow detector
  missed `[rule:X]` lines, which D-24618 fixed first so this gap is observable.
- **Why one `inPlay` entry, not two.** Every in-play read keys off `inPlay` entries and a single instance id:
  self-exclusion is `playedCardId === triggeringCardId`, and "played N cards" is `inPlay.length`. A second entry
  for the same physical card would break the duplicate-id invariant (`invariants/gameRules.checks.ts` ~L92),
  discard two cards at cleanup (`moves/endOfTurnCleanup.logic.ts` ~L66), and inflate `inPlayCount` in the UI and
  snapshots. So the physical card stays one entry (normalised to face a's id) and a per-turn marker lists it.
  Reads that mean **"cards played this turn"** expand a marked entry to `[faceA, faceB]`. Reads that mean
  **"this physical card"** (UI, cleanup, invariants, KO targets, Copy Powers targets) keep the raw entry.
- **Why face a then face b, with no choice.** Jeff's direction for this WP is "skip the choice". Order is
  fixed to the data order (`sides[0]` then `sides[1]`) so replays are deterministic and no new pending choice,
  UI, or bot path is needed. Consequence, stated honestly: face b's superpower can see face a as "another card
  played", but face a's cannot see face b (it has not been played yet). A player-chosen order is a possible
  follow-up; it is not rules-required to be offered here and is out of scope.
- **Why the marker is added between the faces.** Face a fires while the entry is still an ordinary one-face
  entry, so face a sees exactly what a normal play sees. The marker is recorded only after face a resolves, so
  face b's reads expand the entry and see face a as a separate card. This gives the sequential "two different
  cards" semantics without a new abstraction.
- **Interaction with the reserved split-face discard-cost WP (#2443, not yet drafted).** That
  WP adds a face-bind discard precondition for bkwd Falcon & Winter Soldier faces. If it is on `main` when this
  WP executes, the both-sides path must call the same precondition for each face and **skip only the unpayable
  face** (logged), never the payable one. If it is not on `main`, there is no per-face cost to honour and
  nothing extra is done; #2443's executor then owns wiring its precondition into the both-sides path. This is
  a conditional, not a dependency: #2443 covers bkwd Attune only. cvwr Hercules "Manly Dullard" also prints "To
  play this, you must discard a card from your hand", but it carries no marker today, so neither the picker
  path nor this WP enforces it. That gap is pre-existing, outside #2443's scope, and outside this WP.
- **Known side effects (accepted, recorded in D-24619).**
  - With the fixed order, face b resolves in the same move even while a face-a pending choice is open.
  - Copy Powers targets the physical entry, so it can copy only face a.
  - The server sequence teacher (`heroConditionHoldsForInPlay`) sees the raw `inPlay` and may emit a false
    "whiff" tip on a Penumbra turn.
- **Interaction with the Lightshow executor (#2445).** A Lightshow count
  of "Lightshow cards played this turn" should use the same expansion helper. Noted for that WP; no change here.
- **Required reading for the executor:**
  - `docs/ai/REFERENCE/00.2-data-requirements.md`: §1.2 / §1.2.1 (`physicalCards[].sides`, split faces), §4.4
    (`ext_id`), and §5 (Ability Text Markup: `[keyword:X]` / `[rule:X]`). `TurnEconomy` is not in 00.2; its
    shape is in `economy/economy.types.ts`.
  - `docs/ai/DECISIONS.md`: D-24545 / D-24546 (WP-724), D-24604 (WP-772), D-24618, D-21601 (the marker-token
    closed set), and D-24026.
  - `.claude/skills/legendary-game-engine/SKILL.md`: the move contract, determinism, and zone ops.
- **One WP, not a split.** The call-site conversions are mechanical swaps of `playerZones.inPlay` for
  `playedCardIdsThisTurn(G, playerZones.inPlay)` at already-enumerated reads, behind one helper. That mirrors
  WP-772's single-helper, many-call-site shape (≈20 files, one WP).

## Non-Negotiable Constraints

- Moves never throw. `for...of` only; no `.reduce()` in any read or zone op. No `Math.random()`.
- Zones keep `CardExtId` strings only. The physical card is exactly **one** `inPlay` entry.
- No new `G` top-level field. The two new per-turn fields live on `TurnEconomy`, are **absent until set**, are
  carried by `carryConversionFlag`, and are dropped by `resetTurnEconomy`. A game that never plays Penumbra
  serialises byte-identically (sentinel `finalStateHash` NOT re-pinned).
- No new move, no new pending choice, no UIState field, no client change.
- The expansion helper is identity when the marker is absent or empty, so every non-Penumbra game's reads are
  byte-unchanged.
- Card data changes only through the curated marker map + `apply-hero-ability-markers.mjs`; never a hand
  edit of `data/cards/cvwr.json`.
- Engine-wide:
  - Write full file contents for every new or modified file: no diffs, no snippets, no "changed section only".
  - ESM only, on Node v22+.
  - Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: functions of 30 lines or fewer, JSDoc, `// why:`
    comments, and full-sentence errors. `playBothSplitFaces` stays within 30 lines; extract a per-face helper if
    needed.
- Tests:
  - `node:test` + `node:assert` only, with `makeMockCtx` / `makeMockMoveContext`.
  - No `boardgame.io` or `boardgame.io/testing` import, and no network or DB access.
  - `.test.ts` files only.
- Session protocol: if anything is unclear, or a read site is on neither list in Locked Contract Values, STOP
  and ask. Never guess.

## Locked Contract Values

- **HeroKeyword:** `'play-both-sides'` (appended to the `HeroKeyword` union and the end of `HERO_KEYWORDS`).
  Handler-bearing, no magnitude (joins `HANDLED_KEYWORDS` and `NO_MAGNITUDE_KEYWORDS`). Timing `onPlay`.
- **Marker map entry** (`inputs/hero-ability-markers.json`, `cvwr` array):
  `{ "heroSlug": "cloak-dagger", "cardSlug": "penumbra", "abilityIndex": 0, "markupToken": "[keyword:play-both-sides]" }`.
  The resulting cvwr line:
  `Whenever you play a [rule:Divided Card] card this turn, play both sides as if they were two different cards. [keyword:play-both-sides]`.
- **`TurnEconomy` fields** (optional, lazy):
  - `isPlayBothSidesActive?: true`, set by the `play-both-sides` handler (idempotent; a second Penumbra is a no-op).
  - `bothSidesPlayedCardIds?: CardExtId[]` lists the `inPlay` entry ids (face-a ids) of split cards played
    both-sides this turn, appended in play order.
  - **Writers.** `economy.logic.ts` gains two pure rebuilds that mirror `enrollExcessiveViolenceCard`:
    `enablePlayBothSides(economy): TurnEconomy` and `markBothSidesPlayed(economy, cardId: CardExtId): TurnEconomy`.
    Each does a full rebuild plus `...carryConversionFlag(economy)`, and the append builds a new array
    (`[...(existing ?? []), cardId]`). Callers assign `G.turnEconomy = …`. Direct field mutation and `push` are
    forbidden.
  - **Naming.** `is`-prefixed per the code-style boolean rule.
- **Helper** (`hero/splitCard.logic.ts`, pure, never throws):
  `playedCardIdsThisTurn(G, inPlay: readonly CardExtId[]): CardExtId[]` returns `inPlay` in order, with each
  entry listed in `G.turnEconomy?.bothSidesPlayedCardIds` replaced **in place** by `[faceA, faceB]` from
  `resolveSplitFacePair`. It reads through optional chaining. It returns a fresh copy of `inPlay` (identity)
  when `turnEconomy` is absent (the `heroConditionHoldsForInPlay` minimal-G slice), when the field is absent or
  empty, or when an entry's pair resolves to `null`.
- **Both-sides play sequence** (`moves/splitFaceChoice.resolve.ts`, new exported `playBothSplitFaces(G, context,
  playerID, cardId): boolean`. When `isSplitCardInstance(G, cardId) && G.turnEconomy.isPlayBothSidesActive ===
  true`, `playCard` calls it and returns if it returns `true`; on `false` (null pair) it falls through to the
  existing park path):
  1. `pair = resolveSplitFacePair(G, cardId)`.
     - A missing `playerZones` returns `true` before any mutation (silent no-op).
     - If `pair === null`, return `false` so `playCard` falls through to the existing park path. The card has already left the hand,
       so the null-pair path must return `false` (never `true`). The park path then adds the card to `inPlay`.
     - Otherwise append `pair.faceA` to `inPlay`, normalising a played face-b id to face a.
  2. Log two lines:
     - `Player N played <faceA label, empty economy clause>.`, with `card: faceA`. This is the same shape as
       every other play line and the only line in the sequence that matches `PLAYED_LINE`
       (`apps/arena-client/src/diagnostics/effectProvenance.ts` ~L193, which takes the ext-id from the structured
       `entry.card`). The play-diagnostics provenance therefore attributes both faces' effects to one play of the
       physical card, with no client change.
     - `Penumbra: both sides of <faceA label> play as two different cards.`
  3. Grant `G.cardStats[faceA]` attack/recruit and log `Player N resolved side a: <faceA label with economy
     clause>.`. Then `effectsA = executeHeroEffects(G, context, playerID, faceA)`.
  4. Append `pair.faceA` to `G.turnEconomy.bothSidesPlayedCardIds` (lazy-init).
  5. Grant `G.cardStats[faceB]` attack/recruit and log `Player N resolved side b: <faceB label with economy
     clause>.`. Then `effectsB = executeHeroEffects(G, context, playerID, faceB)`.
  6. `G.lastPlayEffectsFired = effectsA + effectsB`.
  `pushLog` card argument (`LogEntry.card`, which provenance actually reads): the played line, the Penumbra line
  and the side-a line carry `faceA`; the side-b line carries `faceB`. Steps 4 and the handler write through
  `markBothSidesPlayed` / `enablePlayBothSides`. All four lines use outcome `'neutral'` (mirrors `applyCardPlay` /
  `resolveSplitFaceChoice`).
  Labels use `formatPlayedCardLabel(G.cardDisplayData, id, formatBaseEconomyClause(attack, recruit))`. The
  per-face lines must never begin `Player N played`.
  Steps 3 and 5 use the same `addResources` + `formatPlayedCardLabel` / `formatBaseEconomyClause` idiom as
  `resolveSplitFaceChoice`. If a face-a ability parks a pending choice, face b still resolves in the same move.
  That is legitimate queueing, the same as a chosen face parking today.
- **Principle.** Rules-facing in-play Hero **trait / count** reads expand: "another [X] Hero you played",
  "Heroes you have", "played N cards". **Target and physical** reads do not: anything that picks, moves, KOs, or
  copies a card, and every VP, UI, snapshot, or invariant count.
- **Expanded read sites.** At each site, swap the raw `inPlay` iteration for `playedCardIdsThisTurn(G, inPlay)`;
  nothing else changes at the site.
  - `hero/heroConditions.evaluate.ts`:
    - `heroClassMatch`, `requiresTeam`, `requiresKeyword`, `playedThisTurn`, `firstHeroPlayedThisTurn` and
      `distinctHeroClassesAtLeast`.
    - The in-play half of `heroCostAtLeastInHandOrPlay`, `cheapOrSizeChangingAtLeast` and
      `distinctHeroCostsAtLeast`.
    - `countOtherInPlayMatchingCondition` and `countDistinctHeroClassesInPlay`.
    - The in-play half of `countDistinctHeroClassesYouHave`.
    - `describeFailedCondition` (~L746, the `playedThisTurn` count it quotes).
  - `hero/heroCountSource.resolve.ts`: every in-play counter and collector (`countWorthy`, `countCost4Plus`,
    `countIcon`, `countTeam`, `countHeroClass`, `countOddCost`, and their collectors).
  - `rules/tacticHandlers.ts` ~L613: the Xavier's Nemesis in-play X-Men **count** only.
  - `villain/villainEffects.execute.ts` ~L1515 and ~L1551: in-play class / count reads, including the Baron
    Zemo count.
  - `moves/villainDefeatRequirement.logic.ts` ~L72.
  - Self-exclusion stays `playedCardId === triggeringCardId`. Face b fires with `triggeringCardId = faceB`, so it
    excludes itself and sees face a (the physical entry).
- **Unexpanded (physical / target / VP) reads, explicitly unchanged.** Each is either a pick, move, KO or copy
  of a physical card, or a VP / UI / invariant count.
  - `rules/tacticHandlers.ts` ~L1203–1212 `collectInPlayXMenHeroes`: the Electromagnetic Bubble **target**
    list; the pick is moved out of `inPlay` at `deferredHandInjection.logic.ts` ~L43.
  - `economy/bloodFrenzy.logic.ts` ~L59–79: must mirror `computeFinalScores` (parity test). VP is physical.
  - `hero/heroEffects.execute.ts`:
    - ~L1531 self-KO.
    - ~L2628 KO eligibility count.
    - ~L2745 optional-KO-your-Hero eligibility.
    - ~L4518 Copy Powers targets.
    - ~L5229 Transform move.
    - ~L6022 KO fallback.
  - `villain/villainEffects.execute.ts` ~L2308 (Destroyer KO-all), ~L3348 and ~L3560 (KO targets).
  - `ui/uiState.build.ts` ~L365, ~L690, ~L764 and ~L775; `invariants/structural.checks.ts` ~L80;
    `persistence/snapshot.create.ts` ~L66; `invariants/gameRules.checks.ts` ~L92.
  - `heroConditions.evaluate.ts` ~L925: the `heroConditionHoldsForInPlay` slice. It is raw by construction; the
    helper is identity there because the slice has no `turnEconomy`.
  - End-of-turn cleanup, and scoring (`scoring.logic.ts` / `dynamicVictoryPoints.ts`).
  - Any read not on either list is zone-ambiguous: STOP and ask.

## Scope (In)

1. Keyword + parser + handler (six-site lockstep) for `play-both-sides`; the handler sets
   `isPlayBothSidesActive`.
2. Marker map entry + `apply-hero-ability-markers.mjs` apply run; regenerated `data/cards/cvwr.json`.
3. `TurnEconomy` fields + `carryConversionFlag` carry + reset-by-omission.
4. `playedCardIdsThisTurn` helper + `playBothSplitFaces` + the `playCard` branch.
5. The expanded read-site conversions listed above.
6. Tests (see Acceptance Criteria), regenerated derived artifacts, and governance close.

## Out of Scope

- A player-chosen face order, or any new pending choice / UI for Penumbra.
- Split cards played through any path other than `playCard` (no other path parks a split choice today).
- Physical-card reads (listed above), scoring, PAR, leaderboards.
- The Lightshow executor and the split-face discard cost (separate WPs, see Context).
- `rule:shard` / `rule:sidekick` / `rule:multicolored` hollows (D-24618) — untouched.

## Files Expected to Change

More than 8 files is justified in §Context ("One WP, not a split").

**`packages/game-engine/src/`**

- Keyword lockstep:
  - `rules/heroKeywords.ts`, `rules/heroKeywords.test.ts` — modified.
  - `rules/heroAbility.setup.test.ts` — modified (length + order pin).
  - `setup/heroAbility.setup.ts`, `setup/heroAbility.setup.test.ts` — modified (the parser, plus the third
    length pin).
  - `hero/heroEffects.execute.ts`, `hero/heroEffects.execute.test.ts` — modified.
- Economy:
  - `economy/economy.types.ts` — modified.
  - `economy/economy.logic.ts`, `economy/economy.logic.test.ts` — modified.
- Split-card play:
  - `hero/splitCard.logic.ts`, `hero/splitCard.logic.test.ts` — modified.
  - `moves/splitFaceChoice.resolve.ts`, `moves/splitFaceChoice.resolve.test.ts` — modified.
  - `moves/coreMoves.impl.ts` — modified (the `playCard` branch; runtime wiring per `01.5`).
- Read sites:
  - `hero/heroConditions.evaluate.ts`, `hero/heroCountSource.resolve.ts` — modified.
  - `rules/tacticHandlers.ts` — modified (the ~L613 count only).
  - `villain/villainEffects.execute.ts`, `moves/villainDefeatRequirement.logic.ts` — modified.
  - The sibling `*.test.ts` of each modified read-site file — modified (family tests, including AC-7c).
- `hero/penumbraPlayBothSides.test.ts` — **new** (end-to-end AC-1..AC-9).
- `hero/ruleTokenHollow.test.ts` and the D-24618 Penumbra test in `hero/heroEffects.execute.test.ts` (~L4977) —
  modified. Keep both as fixtures for the `[rule:X]`-only-line detector, but retitle and re-comment them as the
  **pre-marker** line, not "Penumbra as generated". AC-1 is the Penumbra-as-generated pin. The commit body notes
  this as an intentional behavior change.

**Card data**

- `scripts/convert-cards/apply-hero-ability-markers.mjs` — modified. Add `^\[keyword:play-both-sides\]$` to
  `VALID_TOKEN_PATTERN` with a `// why:` citing D-24619. The locked D-21601 allowlist rejects the token today and
  `assertValidToken` would throw.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — modified (the Penumbra entry).
- `data/cards/cvwr.json` — modified (regenerated by the apply script).

**Derived** (regenerated by their scripts, and committed only on a real diff)

- `data/metadata/card-mechanics.json`, `data/metadata/effect-implementation-index.json` — modified.
- `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv` — modified.
- `scripts/coverage/hero-effect-coverage.baseline.json` — modified (conditional).
- `docs/ai/coverage/runtime-observed-hollows.json` and
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — modified (conditional, only on an attributed
  diff).

**Governance**

- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` and `wiki/split-card.md` — modified.

## Contract

`HeroKeyword` gains `'play-both-sides'`. `TurnEconomy` gains two optional lazy fields. `splitCard.logic.ts`
gains `playedCardIdsThisTurn`; `splitFaceChoice.resolve.ts` gains `playBothSplitFaces`. No move, UIState,
registry, or server contract changes.

## Acceptance Criteria

- **AC-1** Penumbra's hook parses to `keywords: ['play-both-sides']` with a `play-both-sides` effect and **no**
  `unresolvedMarkers`. Playing it records no hollow.
- **AC-2** Penumbra then Above/Below: no `pendingSplitFaceChoices` entry; attack += Above's attack, recruit +=
  Below's recruit; both faces' hooks fire; `inPlay` holds the card once (face-a id);
  `bothSidesPlayedCardIds` lists it.
- **AC-3** A split card played **before** Penumbra in the same turn parks the picker as today.
- **AC-4** Next turn: `isPlayBothSidesActive` and `bothSidesPlayedCardIds` are absent; a split play parks the picker.
- **AC-5** Face-b id played under Penumbra (a card discarded as face b earlier) normalises to one face-a entry
  and still resolves both faces.
- **AC-6** Superpower ordering and later-card visibility. Use a synthetic split fixture built **through the
  setup parser** (`buildHeroAbilityHooks` / real `G.splitFaces` / `cardTraits`), with deck cards so draws
  resolve, and with no other card able to satisfy the gates.
  - Face a is `[hc:tech]` with `[hc:strength]: Draw a card. [keyword:draw:1]`.
  - Face b is `[hc:strength]` with `[hc:tech]: Draw a card. [keyword:draw:1]`.
  - The Penumbra stand-in is neither Tech nor Strength.
  - After the both-sides card, play a third card C (neither Tech nor Strength) with
    `[hc:strength]: Draw a card. [keyword:draw:1]`.
  - Expected: face a's draw does **not** fire, because face b is not yet played. Face b's draw fires, because
    face a is the physical entry. C's draw fires, because face b is expanded. `playedThisTurn` is 4 after C
    (stand-in, face a, face b, C).
- **AC-7** Revert proof, run once and reported: when `heroConditions.evaluate.ts` reads the raw `inPlay`,
  C's draw does not fire and the count drops to 3. (Face b's assertion cannot be the proof, because face b
  sees face a through the raw entry.) `playedCardIdsThisTurn` is identity (a deep-equal copy) when the marker
  is absent or empty.
- **AC-7b** `playedCardIdsThisTurn` is identity on a `G` slice with **no** `turnEconomy`, the
  `heroConditionHoldsForInPlay` minimal-G shape.
- **AC-7c** The Electromagnetic Bubble target list and Blood Frenzy VP stay physical.
  - With a both-sides X-Men split card in play (Legion or Aurora & Northstar), the Bubble offers its physical
    entry exactly once, and never a face-b id.
  - With an Ultron-style villain (VP from the count of Tech Heroes) in the Victory Pile, a both-sides split
    card with a Tech face in play, and a Blood Frenzy read, the Blood Frenzy VP equals `computeFinalScores`.
    The Tech face is what makes this parity check non-vacuous.
- **AC-8** Physical reads unchanged: `inPlayCount`, cleanup discards exactly one card, the duplicate-id invariant
  holds.
- **AC-9** A second Penumbra in the same turn is a no-op on the flag.
- **AC-10** Determinism: sentinel `finalStateHash` and replay fixtures unchanged; `sim:runtime-observed:check`
  unchanged, or a diff confined to the cvwr board and attributed.

## Verification Steps

```bash
pnpm -r build
pnpm -r --no-bail test
node scripts/convert-cards/apply-hero-ability-markers.mjs
pnpm cards:check
pnpm sim:coverage --check
pnpm sim:runtime-observed:check
pnpm ledger:heroes:check
pnpm effect-index:check
pnpm mechanics:metadata:check
pnpm ledger:numbers:check
pnpm roadmap:counts:check
```

Expected results:

- The build exits 0, and the tests report 0 failures (engine count = baseline + the new tests).
- The apply script marks the cvwr Penumbra line and is zero-diff on a re-run.
- Every `*:check` exits 0. For `sim:runtime-observed:check`, that means no diff, or a cvwr-only attributed diff.
- **AC-7 revert proof:**
  1. Temporarily point the `heroConditions.evaluate.ts` reads at raw `inPlay`.
  2. Run `pnpm --filter @legendary-arena/game-engine test`. The `penumbraPlayBothSides` C-draw and count-of-4
     assertions must FAIL.
  3. Restore the reads, re-run, and report both results.

## Definition of Done

- All AC green; `pnpm -r --no-bail test` 0 failures (engine before/after counts recorded).
- Every gate in Verification Steps exits 0. Regenerated artifacts are committed only with real diffs.
- `git status --porcelain` ⊆ Files Expected to Change.
- D-24619 → Active in DECISIONS; STATUS entry; WORK_INDEX `[x]`; EC_INDEX EC-817 Done; mindmap `📝`→`✅`.
- D-24026 live-on-surface: on play.legendary-arena.com, play Penumbra then a Cloak & Dagger split card; no picker
  appears and both faces' economy lands. Record the matchId in STATUS.

## Vision Alignment

- **Vision clauses touched:** §1 (Rules Authenticity), §2 (Content Authenticity), §8 (Deterministic Game
  Engine), §22 (Deterministic & Reproducible Evaluation), NG-1.
- **No conflict:** this WP preserves every touched clause. A printed card does what it says.
- **Non-Goal proximity:** no monetization, identity, cosmetic, or paid surface. NG-1..7 are not crossed.
- **Determinism:** face order is fixed to data order (`sides[0]` then `sides[1]`), with no RNG and no new
  choice. Both new `TurnEconomy` fields are absent until set, so non-Penumbra games serialise byte-identically.
  The sentinel `finalStateHash` and the replay fixtures are unchanged (AC-10).

## Lint Gate Self-Review (00.3)

Final run on 2026-09-26, after the fixes recorded below. All 21 sections resolve.

| § | Section | Result | Note |
|---|---|---|---|
| 1 | WP Structure | PASS | All required sections present |
| 2 | Non-Negotiable Constraints | PASS | Engine-wide constraints, packet constraints and session protocol are all present |
| 3 | Assumes | PASS | Existing exports listed; dependency #2446 / D-24618 merged |
| 4 | Context refs | PASS | 00.2 §1.2 / §1.2.1 / §4.4 / §5, DECISIONS scan, and the engine skill are cited |
| 5 | Files Expected | PASS | More than 8 files, justified in §Context; the apply-script allowlist is included; the client file is read-only |
| 6 | Naming | PASS | `ext_id`; the `is`-prefixed boolean `isPlayBothSidesActive` |
| 7 | Dependencies | PASS | No new packages |
| 8 | Architectural boundaries | PASS | Engine + card-data script only; `G` stays JSON-serialisable |
| 9 | Windows | PASS | `pnpm` / `node` commands only |
| 10 | Env vars | N/A | None used or introduced |
| 11 | Auth | N/A | No auth surface |
| 12 | Tests | PASS | `node:test` + `node:assert` and `makeMockCtx`; no bgio / network / DB |
| 13 | Verification | PASS | Every script exists; expected output and the AC-7 revert-proof steps are given |
| 14 | Acceptance Criteria | PASS | 12 binary items (AC-1..AC-10, AC-7b, AC-7c) |
| 15 | Definition of Done | PASS | STATUS / DECISIONS / WORK_INDEX, the scope check, and the D-24026 live-verify |
| 16 | Code style | PASS | Functions ≤30 lines, JSDoc, `// why:`; a per-face helper is allowed for the line limit |
| 17 | Vision | PASS | §1 / §2 / §8 / §22 / NG-1 plus the determinism line |
| 18 | Prose-vs-grep | N/A | No grep verification steps |
| 19 | Bridge staleness | N/A | Commit-time rule only; the baseline `9dff9dba` holds (later main commits are docs only) |
| 20 | Funding gate | N/A | Engine + card-data packet: no UI, no user-visible funding copy, no funding channel |
| 21 | API catalog | N/A | No `apps/server` endpoint and no `apps/server/src` library function touched |

## Gate Verdicts

All gates ran as independent subagents against the drafted artifacts, on 2026-09-26.

**Pre-flight (01.4): READY TO EXECUTE.** Class: Behavior / State Mutation.
- The first run was NOT READY, with five PS items. All five were fixed:
  - PS-1: AC-6 / AC-7 now prove the expansion through a third card, C. Face b sees face a through the raw
    physical entry, so face b alone cannot be the proof.
  - PS-2 / PS-3: the Electromagnetic Bubble target list and Blood Frenzy VP stay physical.
  - PS-4: `playedCardIdsThisTurn` is null-safe on a `G` without `turnEconomy` (AC-7b).
  - PS-5: the expanded and unexpanded read-site lists are complete, and any unlisted read means STOP.
- Re-run after the copilot and lint fixes: READY. The dependency #2446 / D-24618 merged as `9dff9dba`.

**Copilot (01.7): RISK → CONFIRM.** Every fix is text-only, so none changes scope.
- First run fixes:
  - #3 / #17: the pure economy writers `enablePlayBothSides` / `markBothSidesPlayed`.
  - #22: a null-pair fall-through with a boolean return.
  - #11 / #12: the D-24618 Penumbra fixtures are retitled as the pre-marker line, and `ruleTokenHollow.test.ts`
    is allowlisted.
  - #26: the `pushLog` card arguments are locked.
  - #27: the flag is renamed `isPlayBothSidesActive`.
  - #30: these verdicts are recorded.
- Second run fixes: stale log wording, the self-contradicting null-pair sentence, the log outcome locked to
  `'neutral'`, and the ambiguous WP-777 citations replaced with #2443 / #2445.

**Lint (00.3): PASS** (table above).
- First run failed §2, §4, §5, §12, §13 and §17. It also caught the execution blocker: the
  `apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN` allowlist rejects `[keyword:play-both-sides]`, so that
  script is now in scope.
- Second run failed §3 and §4. Both are fixed.
