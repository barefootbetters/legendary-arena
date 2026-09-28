# WP-783 — Phasing: swap a Phasing card in hand with the top card of your deck (Game Engine + App arena-client)

**Status:** Draft 2026-09-27
**Primary Layer:** Game Engine (keyword lockstep, new move, UIState projection) + App arena-client (the Phase button on a hand card)
**Dependencies:**
- WP-275 / D-24051 (Dodge — the hand-action keyword + `HAND_ACTION_EXECUTED_KEYWORDS` + hand-card move template)
- WP-379 / D-24183 (healWounds — the optional player-initiated `main`-stage move)
- WP-739 / D-24560 (`economy.excessiveViolenceAvailable` — the active-player-only economy projection)
- WP-724 / 772 (Divided Cards — a split card in hand sits under one face id)
- D-24624 (#2471 — the ungated-keyword hollow work that surfaced `phasing` at runtime)
- WP-128 / D-12803 (audience-filter redaction matrix)

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). New move, new UIState field, a contract-file edit (`heroKeywords.ts`) and two layers, so it fails lightweight-lane criteria 1, 3 and 4.

> Baseline: `origin/main` at `ab0a3da9` plus the reserve commit (#2478, WP-783 / EC-820 / D-24629).

---

## Goal

Legendary's **Phasing** (rules v23 ~L1782-1798; `keywords-full.json` `phasing`, rulebook p.31): "During your turn, if a card with Phasing is in your hand, you may swap it with the top card of your deck." The rules add that this lets you "get a different card instead, save a crucial Phasing card for the next turn, or set up a combo that cares about the top card of your deck", and that swapping "isn't 'playing a card,' or 'drawing a card,' so it doesn't count for other abilities that trigger on those things."

**Today:** Phasing does nothing. Its 12 `[keyword:Phasing]` lines fall to the parser's unresolved-marker fallback, so every play of a Phasing card records a `phasing` `parse-unrecognized` hollow at `onPlay`, although Phasing never does anything on play. Runtime evidence: 98 `phasing` hits in `runtime-observed-hollows.json`, and every cvwr Cloak & Dagger match Jeff played on 2026-09-27 logged it on almost every turn.

**After this session:**
1. **Recognition.** `phasing` is a `HeroKeyword` executed off the play path. It joins `HAND_ACTION_EXECUTED_KEYWORDS` beside `dodge`, so the line resolves, does nothing on play, and records no hollow. No parser change is needed: the generic valid-keyword branch consumes it once it is in `HERO_KEYWORDS`.
2. **Move.** `phaseCard({ cardId })` swaps a Phasing card in the current player's hand with the top card of their deck, during the `main` stage, with no choice pending. There is no per-turn limit.
3. **Empty deck.** If the deck is empty, the discard pile is shuffled into a new deck first (rules v23 L254 "Whenever your deck runs out of cards and you need more…", Jeff-confirmed 2026-09-27). If both are empty, the move is not available.
4. **Not a draw, not a play.** No draw counter, draw lock, play count or trigger moves.
5. **Projection.** Owner-only `economy.phasingOptions?: CardExtId[]`, present iff the move is legal for at least one hand card.
6. **Client.** A **Phase** button beside each phasable card in `HandRow.vue`.
7. **Bots do not phase** (`getLegalMoves` untouched, the Dodge / Heal precedent).

## User-Visible Impact

- Cloak & Dagger, Vision, Wiccan and Doctor Strange (Marvel Studios) play as printed. On your turn a Phasing card in hand shows **Phase**; pressing it puts that card on top of your deck and gives you the top card instead.
- The Hollow effects panel stops listing `phasing`.

---

## Assumes

1. **Keyword lockstep sites** (all in `packages/game-engine/src`):
   - `rules/heroKeywords.ts` — `HeroKeyword` union `:26-100` (dodge `:48`) + `HERO_KEYWORDS` `:109-184`, length **74**.
   - Length pins (**three**): `rules/heroKeywords.test.ts:65-75`; `rules/heroAbility.setup.test.ts:560-645` (ordered `expectedKeywords` + `.length` assert ~`:638`); and `setup/heroAbility.setup.test.ts:~1427-1431` ("X-Gene adds NO HeroKeyword" — `HERO_KEYWORDS.length === 74`). Note the two different `heroAbility.setup.test.ts` files.
   - `hero/heroEffects.execute.ts` — `HAND_ACTION_EXECUTED_KEYWORDS = ['dodge']` `:331` (rationale `:318-330`), folded into `MVP_KEYWORDS` `:403-412`. `phasing` joins **only** this set: not `HANDLED_KEYWORDS`, not `HERO_EFFECT_HANDLERS`, not `NO_MAGNITUDE_KEYWORDS`.
   - `classifyHeroEffectReason` `:983-1007` returns `applied` for `MVP_KEYWORDS`, so `detectHollowHeroHook` `:1126-1189` records nothing. The magnitude pre-gate `:5955-5959` drops the `{ type: 'phasing' }` effect silently; the recorded effect trace status is `no-op` (`heroLegacyTraceStatus` `:1347-1356`), the dodge behaviour.
   - The MVP coverage test `heroEffects.execute.test.ts:141-178` accepts hand-action members. The dodge block `:5247-5330` is the test template.
2. **Parser.** `setup/heroAbility.setup.ts` Step 2 generic branch `:1323-1329` consumes a valid `HeroKeyword`; today `phasing` falls to the fallback `:1590-1597`. `KEYWORD_TIMING_DEFAULTS` (`:537`) is **not** touched; the hook keeps `onPlay` timing, which is harmless because the effect is dropped.
3. **Move template** `moves/dodgeCard.ts`:
   - args `:83`, stage gate `:90`, the 29-guard inline block-all pending cluster `:95-143` (identical in healWounds / recruitHero / exorciseHauntedHero; no shared helper)
   - eligibility via `getHooksForCard(G.heroAbilityHooks, cardId).some(h => h.keywords.includes('dodge'))` `:148-158`
   - the `({ G, ctx, ...context })` → `context as ShuffleProvider` idiom `:81,177`
   - `pushLog` + `formatCardRef` `:182-184`
4. **Registration.** `game.ts` imports `:57-66`, moves bag `:520-678` (`dodgeCard: { move: dodgeCard, client: false }` `:543`). `game.test.ts:181-217` pins the sorted key set and "exactly **45** moves". `CORE_MOVE_NAMES` is **not** touched.
5. **Simulation / server untouched.** `SIMULATION_MOVE_NAMES` (`simulation/ai.legalMoves.ts:97-230`) omits `dodgeCard` / `healWounds`; the drift test only checks it ⊆ the two sim maps. Autoplay (`apps/server/src/autoplay/botLoopProgress.mjs:105`, D-24591) only sees what `getLegalMoves` emits. `replay/replay.execute.ts` `MOVE_MAP` omits `dodgeCard` / `healWounds`; `phaseCard` follows that precedent.
6. **Deck mechanics.** Top of deck = `deck[0]` (`moves/drawCards.logic.ts:77`). `reshuffleDiscardIntoDeck(playerZones, shuffleContext)` (`:120-141`) appends a shuffled discard behind any deck cards and no-ops on an empty discard. `moveCardFromZone` (`moves/zoneOps.ts:54-85`). The hand-to-deck-top precedent is `putHandOnDeckTop.resolve.ts:123-131`.
7. **Projection precedent.** `economy.excessiveViolenceAvailable?`: types `ui/uiState.types.ts:~790`, build `ui/uiState.build.ts:~1034-1040` (omit when absent), filter `ui/uiState.filter.ts:~452-460` in the active-player branch, `REDACTED_ECONOMY` `:44-51` for everyone else, tests `uiState.filter.test.ts:~2672-2695`, economy built-projection keyset pins `uiState.types.drift.test.ts:~765-900` (the WP-739 block at `:~831`). `uiState.build` already imports from `moves/`.
8. **Client.**
   - `HandRow.vue` (props `:33-62`; each card is `<button data-testid="play-hand-card">` wrapping `CardTile` `:218-242`, so the Phase button must be a **sibling** inside the `<li class="hand-card">`, never nested)
   - mounted in `pages/PlayDesktop.vue:~910-916` and `pages/PlayMobile.vue:~639-645`
   - `uiMoveName.types.ts:43-144` (`UiMoveName` union)
   - `App.vue` `submitMove` → `client.moves[name]` (no allowlist)
   - Optional UIState fields need no fixture backfill.
9. **Split cards.** cvwr Fight / Flee (`cloak-dagger-fight-flee`) and Harder than Diamond / Lighter than Air carry `[keyword:Phasing]` on both faces, and setup keys hooks on both faces, so either face id in hand resolves the keyword.
10. **Coverage feeds** (all read engine `dist`):
    - `scripts/hero-mechanic-ledger.mjs` — `MOVE_EXECUTED_HANDLER_MODULES` `:100-103` (wall-crawl, dodge)
    - `scripts/coverage/mechanic-provenance.json` (`dodge` `:34`)
    - `data/metadata/card-mechanics.json` phasing `source` `free-text`
    - `effect-index`
    - `sim:coverage` baseline (`unsupportedMechanics.phasing: 12`)
    - `runtime-observed-hollows.json` phasing row (98)
    - dashboard `useInPlayCoverage.test.ts:~494-497` pin (totalObs 8006, percentResolved 14.2)
11. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**; reconcile the WP and D-24629 first. Line anchors are `~` approximate; re-read at execution.

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` ~L1782-1798 (Phasing) and L252-256 (deck runs out).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary; `.claude/rules/architecture.md` §UIState Projection Integrity and §Move Validation Contract; `.claude/rules/code-style.md` §Drift Detection.
- `docs/ai/DECISIONS.md`: D-24051 (Dodge), D-24183 (healWounds), D-24560, D-24591, D-24604, D-12803, D-24624.
- `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` (a new move is a wiring category).
- User memory: `reference_hero_keyword_lockstep_sites`, `feedback_move_registration_drift_test`, `reference_bot_legalmoves_moveguard_divergence`, `reference_inplay_totalobs_pin_stale_on_feed_regen`.

**Why one packet across engine and client.** A human cannot use the move without the button, and bots do not use it, so an engine-only packet would ship a dead move. The client side is one sibling button, one prop and one move name (seven files, including the two page-mount tests), so the WP-781 / WP-776 single-packet precedent applies.

**Why bots are excluded.** Phasing is optional and has no simple heuristic value. If the card taken from the deck also has Phasing, two cards can swap back and forth indefinitely, and a bot offered the move could burn its per-turn step budget (D-24038) on it. Dodge and Heal set the same precedent. Consequence: PAR and sim runs never phase, so Phasing heroes are modelled without their swap (recorded in D-24629).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves and effects never throw. No `.reduce()` with branching. All randomness through the move context (`ctx.random` via `ShuffleProvider`).
- The client submits intent (`phaseCard({ cardId })`); the engine decides legality and outcome.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24629) before coding. One WP per session.

**Packet-specific:**
- **Keyword.** `'phasing'` joins the union and `HERO_KEYWORDS` (placed after `'dodge'`, keeping the two hand-action keywords together, with a `// why:` naming the `phaseCard` move), and `HAND_ACTION_EXECUTED_KEYWORDS`. It has no handler and no magnitude-set membership.
- **Legality helper** `phasingOptions(G, playerId): CardExtId[]`, exported from `moves/phaseCard.ts`. It returns the distinct `hand` card ids, in hand order, for which all of the following hold:
  1. `G.currentStage === 'main'`
  2. no choice is pending: the 29-guard cluster copied verbatim from `dodgeCard.ts`, **plus** `hasPendingOptionalPutBottomHQ(G)` and `hasPendingPutAnyNumberBottomHQ(G)`. Those two are checked only by `advanceStage` (`game.ts:216,218`) and are missing from every action move's cluster; that pre-existing gap in the other moves is out of scope.
  3. `playerId`'s hand holds the card, and `getHooksForCard(G.heroAbilityHooks, cardId)` carries the `phasing` keyword
  4. that player's `deck` or `discard` is non-empty

  It returns `[]` otherwise and tolerates absent zones or hooks. The move and the projection both call it (one predicate). `getLegalMoves` does not.
- **Move `phaseCard({ cardId })`** in `moves/phaseCard.ts` (new). The Move Validation Contract, in order:
  1. `cardId` is a non-empty string, else return.
  2. `G.currentStage === 'main'`, else return.
  3. `phasingOptions(G, ctx.currentPlayer).includes(cardId)`, else return.
  4. If the deck is empty, `reshuffleDiscardIntoDeck(playerZones, context as ShuffleProvider)`. If it is still empty, return.
  5. Take `deck[0]` out, remove `cardId` from `hand` (`moveCardFromZone`), append the old top card to `hand`, and set `deck = [cardId, ...rest]`.
  6. `pushLog`: `Player N phased <formatCardRef(cardId)> onto the top of their deck and took the top card into their hand.` The phased card is named (the `putHandOnDeckTop` precedent); the card taken into hand is **not** named, because `G.messages` is public.
  7. Return void.
- **Not a draw, not a play.** The move touches no `turnEconomy` field (not `cardsDrawn`, no play count), fires no hero hook or trigger, and is **not** blocked by a draw lock (`drawsLocked`), because the rules say the swap is not a draw.
- **Window narrower than the printed text (deliberate).** The rule says "during your turn"; the move is legal only in `main` with no choice pending. `start` is excluded because the villain reveal precedes hero actions in turn order. `cleanup` is excluded because the turn is over once the new hand is drawn. Pending windows are excluded because effects resolve atomically. The rules' stated purposes (rules v23 ~L1791-1793: get a different card, save a Phasing card for next turn, set up a top-of-deck combo) are all served by the `main` window. D-24629 records this.
- **No per-turn limit.** The printed rule has none. A phased card on top of the deck can come back through a later draw and be phased again.
- **Projection:** `UITurnEconomyState.phasingOptions?: CardExtId[]`, present iff `phasingOptions(G, ctx.currentPlayer)` is non-empty. The filter passes a copied array (`[...options]`) for the **active player only**, present only when non-empty; everyone else gets `REDACTED_ECONOMY` (the `excessiveViolenceAvailable` disposition).
- **Client:**
  - `HandRow.vue` gains a `phasingCardIds?: CardExtId[]` prop (default `[]`), passed by `PlayDesktop.vue` and `PlayMobile.vue` from `economy.phasingOptions`.
  - For each hand card in that list, it renders a **sibling** button `data-testid="play-hand-phase"`, labelled `Phase` (with an accessible label naming the card), that submits `phaseCard({ cardId })`.
  - **Placement (locked).** `li.hand-card` gets `position: relative`. The Phase button is an absolutely positioned overlay with its own class `.hand-card__phase`, which explicitly overrides the scoped `.hand-card button` reset (`HandRow.vue:~296-302`). It is anchored to the tile's **left** edge. **That anchor is what keeps it visible:** a later `<li>` overlaps only the right part of an earlier one when the fan tightens past six cards (up to −40px, `:~177`). Each `.hand-card` carries a `transform` (`:~288`), so each `<li>` is its own stacking context. The button's `z-index` therefore only lifts it above its own `CardTile`, never above a neighbouring card. `.hand-card:focus-within { z-index: 5 }` mirrors the existing `.hand-card:hover` lift (`:~308-311`) so a keyboard-focused button is never covered. The hit target is at least 24×24 px (the `PlayMobile` band uses the same overlap inside a horizontal scroll, `PlayMobile.vue:~638-645`). `aria-label="Phase <display name>"` uses the same display-name source as the card's play button. The `<li>` box and the arc geometry are unchanged, so the fixed 1280×720 cockpit does not grow.
  - `uiMoveName.types.ts` gets `'phaseCard'`. No rule logic runs client-side.
- **Bots:** no change to `SIMULATION_MOVE_NAMES`, the sim / PAR maps, `ai.competent.ts`, `getLegalMoves` or `apps/server`.
- **Determinism.** The only randomness is the empty-deck reshuffle, through the move context. There is no new `G` field or turn flag. Sentinel / PAR oracles use core boards with no Phasing heroes, and bots never phase, so the oracles are expected unchanged.

## Card Map (locked — every `[keyword:Phasing]` line)

| Card | Set | Notes |
|---|---|---|
| cloak-dagger / flee, fight | cvwr | one split card (both faces print Phasing) |
| vision / solar-energy, through-solid-objects, insubstantial-accomplishments | cvwr | |
| vision / lighter-than-air, harder-than-diamond | cvwr | one split card (both faces print Phasing) |
| wiccan / sorcerous-illusions, astral-projection | cvwr | |
| doctor-strange / open-portals, sift-futures, invoke-the-time-stone | msis | |

12 lines on 12 card faces (10 physical cards). Each card's other ability lines are unaffected.

## Locked Values

- Keyword: `'phasing'`; `HERO_KEYWORDS` +1; member of `HAND_ACTION_EXECUTED_KEYWORDS` only. Handler count unchanged.
- Move name: `'phaseCard'`, args `{ cardId: CardExtId }`, registered `{ move, client: false }`; `game.test.ts` count +1. Not in `CORE_MOVE_NAMES`, `SIMULATION_MOVE_NAMES` or `MOVE_MAP`.
- Legality helper: `phasingOptions(G, playerId): CardExtId[]`, exported from `moves/phaseCard.ts`.
- Projection: `UITurnEconomyState.phasingOptions?: CardExtId[]`, active player only, copied array, present only when non-empty.
- Log: `Player N phased <card> onto the top of their deck and took the top card into their hand.`
- Test id: `play-hand-phase`; label `Phase`.
- Ledger handler module: `'phasing': 'packages/game-engine/src/moves/phaseCard.ts'`. Provenance: `{ "wp": "WP-783", "decision": "D-24629" }`.

---

## Scope (In)

- **A) Keyword.** `rules/heroKeywords.ts` + test; `rules/heroAbility.setup.test.ts` (ordered array, length pin, and a Phasing parse test: `keywords ['phasing']`, no `unresolvedMarkers`); `setup/heroAbility.setup.test.ts` (the X-Gene length pin 74 → 75); `hero/heroEffects.execute.ts` (`HAND_ACTION_EXECUTED_KEYWORDS`) + test (a phasing block cloned from the dodge block: no mutation on play, no hollow, `MVP_KEYWORDS` membership, not handled).
- **B) Move.** `moves/phaseCard.ts` + `moves/phaseCard.test.ts` (new); `game.ts`; `game.test.ts`.
- **C) Projection.** The five steps: `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts`, `ui/uiState.types.drift.test.ts` (keyset pin), plus the diagnostics snapshot check.
- **D) Client.** `HandRow.vue` + `HandRow.test.ts`, `pages/PlayDesktop.vue` + `pages/PlayDesktop.test.ts`, `pages/PlayMobile.vue` + `pages/PlayMobile.test.ts`, `uiMoveName.types.ts`.
- **E) Feeds.** `scripts/hero-mechanic-ledger.mjs` (`MOVE_EXECUTED_HANDLER_MODULES`), `scripts/coverage/mechanic-provenance.json`. Then regenerate the hero ledger (json + csv), `card-mechanics.json`, the effect index, `runtime-observed-hollows.json` and the `sim:coverage` baseline, and re-pin the dashboard `useInPlayCoverage.test.ts`.
- **F) Tests.** Cover:
  - a Phasing card in hand swaps with `deck[0]`, asserting the **exact arrays**: `hand` equals the old hand without `cardId` plus the old top card appended last; `deck` equals `[cardId, ...oldDeck.slice(1)]`
  - a non-Phasing hand card, a card not in hand, and a `cleanup`-stage call are no-ops
  - three pending no-op cases, each asserting both the move no-op **and** `phasingOptions === []`: `hasPendingOptionalPutBottomHQ`, `hasPendingPutAnyNumberBottomHQ`, and one guard from the `dodgeCard` cluster
  - empty deck with a non-empty discard: the discard is reshuffled through the move context, then the swap happens; afterwards `discard` is empty, `deck[0] === cardId`, and `deck.length` equals the old discard length
  - empty deck and empty discard: a no-op, and `phasingOptions` is empty
  - `turnEconomy` is byte-identical before and after (`cardsDrawn` unchanged), and the move works while `drawsLocked` is set
  - two phases in one turn both succeed
  - the face-b id of a split card (Flee) in hand is phasable
  - playing a Phasing card records no `phasing` hollow and changes no resources beyond its other lines
  - the log names the phased card and does not name the card taken into hand
  - `phasingOptions` agrees with the move for every case above
  - the projection is present only for the active player
  - `HandRow`: the Phase button renders only for listed cards, is a sibling of the play button, and submits `phaseCard({ cardId })`
  - `PlayDesktop` and `PlayMobile` (page-mount): a snapshot with `economy.phasingOptions: [<a handCards id>]` renders exactly one `[data-testid="play-hand-phase"]`; with the field absent, none renders

## Out of Scope

- Vision **Insubstantial Accomplishments**' second line ("When you play this, you may swap a card from your hand with the top two cards of your deck.") has no marker, so it builds an empty hook: silently inert, and not even a hollow. It is a different effect (a play-time swap of one hand card with two deck cards) and needs its own marker and handler. It is a named follow-up.
- Bot, sim and PAR use of Phasing (see Context).
- `replay/replay.execute.ts` `MOVE_MAP`. `phaseCard` follows the Dodge / Heal omission; the map's header comment claiming every move is mapped is already wrong on `main`, and fixing it is a separate hygiene change. **Known consequence:** `apps/replay-producer` (`src/cli.ts` → `buildSnapshotSequence` → `applyReplayStep`) warns "unknown move … skipped" on a `phaseCard` step, so its snapshots after a phase are wrong for that match (as they already are after a heal or a dodge). Competitive verification (D-24119) re-executes through boardgame.io's own reducer and is unaffected.
- Pre-planning (`packages/preplan`) awareness of Phasing.
- Notable-event SFX (no new `NotableGameEventType`; `moveSfxManifest` is a partial map).

## Files Expected to Change

- `packages/game-engine/src/moves/phaseCard.ts` + `.test.ts` — **new**
- `packages/game-engine/src/rules/heroKeywords.ts` (+ test), `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts` — modified
- `packages/game-engine/src/hero/heroEffects.execute.ts` (+ test) — modified
- `packages/game-engine/src/game.ts`, `game.test.ts` — modified (01.5 wiring)
- `packages/game-engine/src/ui/uiState.types.ts`, `uiState.build.ts`, `uiState.filter.ts`, `uiState.filter.test.ts`, `uiState.types.drift.test.ts` — modified
- `apps/arena-client/src/components/play/HandRow.vue` (+ test), `components/play/uiMoveName.types.ts`, `pages/PlayDesktop.vue` (+ test), `pages/PlayMobile.vue` (+ test) — modified
- `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json` — modified
- Regenerated: `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv`, `data/metadata/card-mechanics.json`, `data/metadata/effect-implementation-index.json`, `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json`; re-pinned: `apps/dashboard/src/composables/useInPlayCoverage.test.ts`
- Governance: `docs/ai/DECISIONS.md` (D-24629), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 36 files. About a third are tests, and eight are regenerated feeds or pins. The new logic is one move file.

## Contract

- The Locked Values.
- `phasingOptions(G, playerId)` is the single legality authority, shared by the move and the projection.
- Phasing is neither a draw nor a play: no counter, lock or trigger reads or writes it.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §23 / §24 (ranked fairness: a human-only optional move changes competitive outcomes the way the printed card intends), NG-1 (no pay-to-win; untouched).
**Conflict assertion:** none.
**Non-Goal proximity:** not crossed.
**Determinism:** the only randomness is the empty-deck reshuffle, through `ctx.random`. No new `G` field. Matches recorded before this WP contain no `phaseCard` moves, so re-executing them yields the same game outcome and score. Only the runtime-only `G.diagnostics.hollowEffects` loses its `phasing` records. Bots never phase, so PAR is unchanged. D-24629 records that PAR models Phasing heroes without their swap.

## Funding Surface Gate

§20 **N/A** (no monetization surface).

## API Catalog

§21 **N/A** (no HTTP endpoint or `apps/server` library change).

---

## Acceptance Criteria

1. Playing a Phasing card records no `phasing` hollow; its other lines behave exactly as before.
2. `phaseCard` swaps a Phasing hand card with `deck[0]`. Hand and deck sizes are unchanged, and the phased card is on top of the deck.
3. It is a no-op for a non-Phasing card, a card not in the current player's hand, outside `main`, and while any pending choice is open (the 29 `dodgeCard` guards plus the two put-bottom-HQ guards).
4. With an empty deck and a non-empty discard, the discard is shuffled into the deck through the move context, then the swap happens. With both empty, it is a no-op and `phasingOptions` is empty.
5. `turnEconomy` is unchanged by the move, and the move works while `drawsLocked` is set.
6. Two phases in one turn both apply.
7. A split card's face-b id (Flee, Lighter than Air) in hand is phasable.
8. The log line names the phased card and not the card taken into hand.
9. `economy.phasingOptions` equals `phasingOptions(G, currentPlayer)` when non-empty, is omitted when empty, and survives the audience filter only for the active player.
10. The Phase button renders once per listed hand card, never nested in the play button, and submits `phaseCard({ cardId })`. No button renders when the list is absent. Both `PlayDesktop` and `PlayMobile` pass `economy.phasingOptions` through (page-mount test).
11. `ledger:heroes:check`, `mechanics:metadata:check`, `effect-index:check`, `sim:runtime-observed:check` and `sim:coverage --check` exit 0; the four Phasing hero rows read `executable`, and the `phasing` runtime row is gone.
12. `pnpm -r build` → 0 and `pnpm -r --no-bail test` → 0 fail (dashboard pin re-pinned). Sentinel / PAR oracles unchanged; if one changes, STOP and diagnose.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm ledger:heroes && pnpm mechanics:metadata && pnpm effect-index && pnpm sim:runtime-observed && pnpm sim:coverage --update-baseline`, then `pnpm ledger:heroes:check && pnpm mechanics:metadata:check && pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → all 0.
3. Run the dashboard `prebuild:*` scripts, then re-pin `useInPlayCoverage.test.ts` to the observed values with a dated `// why:`. **Expected direction:** `in-play-hollow-baseline.json` keeps `phasing.peakObs 100`, and a mechanic that flips to `executable` moves its observations into `resolvedObs` with the denominator held. So `totalObs` should stay the same and `percentResolved` should **rise**. Any other delta is a trajectory shift to diagnose, not just re-pin.
4. `pnpm --filter @legendary-arena/game-engine test` → all pass; `pnpm --filter @legendary-arena/arena-client test` and `typecheck` → 0.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git diff --name-only` ⊆ Files Expected to Change. Revert `lagn-v1.json` CRLF churn.
7. `economy.phasingOptions` appears in the Play Diagnostics `uiStateSnapshot` for the active seat (UIState step 5; AC9), e.g. via the `?fixture=mid-turn&play=1` dev route with a Phasing card in hand, or a unit assertion on the diagnostics builder.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24629 Active: the move contract and legality helper, the `main`-stage / no-pending window (including the two put-bottom-HQ guards) and why it is narrower than "during your turn", no per-turn limit, the empty-deck reshuffle (Jeff-confirmed 2026-09-27), not-a-draw / not-a-play (draw lock ignored), the log privacy rule, bot exclusion and its PAR consequence, the `MOVE_MAP` omission (naming the replay-producer consequence), and the owner-only projection.
- [ ] STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-820:` then `SPEC:`).
- [ ] **D-24026 live-verify (post-merge):** in a Cloak & Dagger match, press **Phase** on a hand card. The card leaves the hand, a different card arrives, the log line appears, and the Hollow effects panel no longer lists `phasing`. Recorded as a STATUS-flip.

## Reserved Decision (lands at execution)

**D-24629 — phasing-hand-swap.** It locks everything listed in the DoD item above.

---

## Lint Gate Self-Review (00.3)

- §1 Structure: every required section is present and non-empty. Out of Scope names five exclusions. 12 binary ACs.
- §2 Constraints: the engine-wide block is kept verbatim; packet-specific constraints are flat bullets.
- §3 Assumes: 11 items, each cited to file:line from a read-only survey of `ab0a3da9`.
- §4 Context: rules v23 lines, ARCHITECTURE sections, rules files, D-entries and memory references are named.
- §5 Output completeness: 36 files enumerated and the count explained; `game.test.ts`, the keyset drift pin and all three keyword length pins are in the allowlist up front.
- §6 Naming: `phaseCard`, `phasingOptions`, `phasingCardIds`, `UITurnEconomyState`. Full English words.
- §7 Dependencies: every listed WP is Done; D-24624 is merged (#2471).
- §8 Architecture: the engine decides; the client submits intent only; no server edit; no new `G` field; no persistence change; the legality helper lives in `moves/` (which `uiState.build` already imports).
- §9 Windows: pnpm and node commands only.
- §10 Env vars: N/A.
- §11 Auth: N/A (in-match move; boardgame.io seat authority is unchanged).
- §12 Tests: `node:test`, `.test.ts`, no `boardgame.io/testing`; negative cases (wrong card, wrong stage, pending, empty zones) are locked so a wrong implementation fails.
- §13 Verification: exact commands with expected exit codes, plus the diagnostics snapshot step.
- §14 ACs: 12, binary and observable.
- §15 DoD: STATUS, DECISIONS (D-24629), WORK_INDEX, EC_INDEX, mindmap, two-commit topology, D-24026 live-verify.
- §16 Code style: 00.6 is cited; no `.reduce()` with branching; full-sentence log line.
- §17 Vision: the block is present; §1 / §23 / §24 touched, NG-1 not crossed.
- §18 Prose-vs-grep: N/A (no literal forbidden-token grep in Verification).
- §19 Bridge staleness: baseline `ab0a3da9` cited; the drafting commit re-checks `origin/main` at commit time.
- §20 Funding surface: N/A.
- §21 API catalog: N/A.

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent, source `db07ea47`): DO NOT EXECUTE YET.** Every Assumes anchor, count (74 keywords, 45 moves, 29 guards), the no-hollow path, the no-parser-change claim, the split-card face ids, the deck helpers, the projection path, bot exclusion and the feed claims checked out. One blocker:
- **PS-1:** the page-level `phasingCardIds` prop wiring had no test (the injected-seam trap). `PlayDesktop.test.ts` and `PlayMobile.test.ts` were added to the allowlist, with a page-mount test and an AC10 clause.

RS items applied:
- RS-1: the Phase button placement and styling are locked.
- RS-2: the two put-bottom-HQ guards were added to `phasingOptions`, and AC3 was reworded.
- RS-3: the non-existent `hasDrawnThisTurn` was dropped.
- RS-4: the drift-pin anchor was corrected.
- RS-5: the dashboard pin direction is stated.
- RS-6: merge-order note added to the EC.
- RS-8: the trace status is `no-op`.

RS-7 (Dodge has no client button, so Phase is the first hand-card action button) is out of scope and noted as a follow-up.

**Pre-flight re-check: READY TO EXECUTE** (2026-09-27). PS-1 is closed and every RS edit is verified against source. The cosmetic residuals (RS-9 the file count is 35, RS-10 "seven files", the reset anchor `~296-302`) are applied; RS-11 is confirmed (#2476 is the Soaring Flight reservation).

**Copilot (01.7), round 1: RISK → HOLD.** The design holds; seven findings, all applied:
1. A third `HERO_KEYWORDS` length pin (`setup/heroAbility.setup.test.ts:~1427`) was added to the allowlist (36 files). This is the one allowlist change; pre-flight re-checked it.
2. The `main`-only / no-pending narrowing is now stated with its rationale.
3. Three explicit pending no-op tests were added, covering both put-bottom-HQ guards.
4. Exact-array swap assertions were added, including the reshuffle case.
5. The placement lock was corrected: the left anchor provides visibility (each `<li>` is its own stacking context), plus `:focus-within`, a 24×24 px target and an `aria-label`.
6. The missing `// why:` for the put-bottom-HQ guards was added (EC).
7. The replay-producer consequence of the `MOVE_MAP` omission is named.

**Pre-flight re-check (allowlist change): READY TO EXECUTE.** Exactly three `HERO_KEYWORDS.length` pins exist repo-wide, and all are in the allowlist; no script or app enumerates the keyword list. **Copilot re-run: PASS** (2026-09-27). The one cosmetic residual (lint §5 "all three" pins) is applied.

Checked with no fix needed: hidden information (decks project as counts; the button never renders in replay or spectator views), D-24119 verification through boardgame.io's reducer, rules edge cases (copy-powers, Penumbra, gated lines), bots / preplan, and the feeds.
