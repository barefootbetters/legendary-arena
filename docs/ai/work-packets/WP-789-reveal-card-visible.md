# WP-789 — Reveal card visible: auto-resolving deck-top reveals show the revealed card

**Status:** Draft 2026-09-29 · **EC:** EC-826 · **Reserves:** D-24637 (reserve PR #2504)
**Primary Layer:** Game Engine + App arena-client
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session (a notable-event contract change plus a client render; both the engine and the client change)
**Baseline:** `origin/main` @ `17b9787f` (2026-09-29)

## Goal

When a hero card reveals the top card of your deck and the reveal resolves on its own (Gambit's
**Card Shark**, **High Stakes Jackpot**, and the rest of the WP-726 reveal family), the board now
**shows you the revealed card**:
- on every reveal, including a miss ("not an X-Men Hero — left on top");
- with the card's **image and name** on the "Hero Ability" overlay, not just a sentence.

## User-Visible Impact

- Jeff's report (match `b8KeKuLE5Tb`, 1p Red Skull / Midtown Bank Robbery, `gitSha 17b9787`): "when I
  play Card Shark and High Stakes Jackpot I'm not shown what my top card on my deck is."
  - **Card Shark:** the overlay fired only on a **hit** ("drew it", 19 events). Every **miss** — a
    S.H.I.E.L.D. Agent, Surge of Power or Call Lightning left on top (log 3.2.7, 4.2.7, 6.2.2, 7.2.6,
    10.2.6, 12.2.6/8, 13.2.10, 24.2.6/8) — emitted nothing. You were never shown the card now sitting on
    your deck.
  - **Card Shark hits and High Stakes Jackpot:** these emitted only a text line on the transient
    overlay. No card image was shown.
- After this packet, every auto-resolving reveal shows an overlay with the revealed card's image and
  name, plus the outcome ("drew it", "gained attack", "left on top").

## Assumes

- **WP-697 / D-24516 ✅** — `HeroEffectResolvedEvent { type: 'heroEffectResolved', playerId, narrative }`
  (`events/notableEvents.types.ts` ~L433) renders on `NotableEventOverlay.vue` as the "Hero Ability" chip.
- **WP-726 / D-24547 ✅** — `applyRevealRules` (`hero/heroEffects.execute.ts` ~L1817) emits a
  `heroEffectResolved` event with `composeHeroRevealTopNarrative(source, revealed, cost, outcomeText)`
  (`events/notableEvents.compose.ts` ~L463) only when `revealLogOutcome !== 'blocked'` and no
  `choose-discard-or-return` action is present (~L1904–1917).
  - D-24547 names "rendering the flipped card's image (an optional `revealedCardId` field)" as a
    **follow-up** — this packet is that follow-up.
  - Inside `applyRevealRules`, `'blocked'` means only "no predicate matched". The function always has
    a real `topCardId`; an empty deck returns earlier in `heroEffectReveal`. So a miss always has a
    revealed card.
- **Projection.** `UIState.notableEvents` is public and unconditional (D-12803).
  `filterUIStateForAudience` copies each event with `notableEvents: [...uiState.notableEvents]`
  (`ui/uiState.filter.ts` ~L606), so an added optional field survives.
  - The client resolves card identity through `eventCardId`
    (`apps/arena-client/src/composables/useNotableEventStream.ts` ~L50), which today returns `''` for
    `heroEffectResolved`.
  - **The overlay's lookup CANNOT resolve a card that is still in the deck.**
    `notableEventCardLookup` (`apps/arena-client/src/pages/PlayDesktop.vue` ~L273–340) folds only
    visible zones: city, HQ, mastermind, scheme, hand, in-play, discard top, victory and KO.
    `G.cardDisplayData` is not projected.
  - So a miss or a High Stakes Jackpot reveal (the card stays on the deck) would fall back to the raw
    ext_id. This packet therefore adds the D-24547-named projection `notableEventCards`
    (Locked Values). `UIDisplayEntry` (`uiState.types.ts` ~L403) is the existing `{ extId, display }`
    shape, and `transformDeck?: UIDisplayEntry[]` (~L112) is the public precedent.
- **Pins.** `notableEvents.types.test.ts` pins the event-TYPE list only (no per-event keyset), so an
  optional field needs no pin change.
- Engine and arena-client suites green on `origin/main`. Engine 4700/0 at `17b9787f`; re-record at
  execution.

## Context (Read First)

- **Why the misses were silent.** D-24547 §2 chose "emit only when the reveal realized work" so the
  overlay would not spam. For "If it's an X-Men Hero, draw it", the miss is exactly when the player
  most needs to know: the revealed card stays on top as their next draw. Showing a revealed card is
  what "reveal" means at the table.
- **Why an id on the event PLUS a small card projection.** The overlay already resolves an event's card
  through `eventCardId` + `cardDisplayData` for fights, ambushes, twists, strikes and bystanders. One
  optional `revealedCardId` on `heroEffectResolved` plugs the reveal family into that existing path.
  This mirrors `ambushResolved.revealedCardId` / `bystanderRevealed.revealedCardId`. Because a revealed
  card often stays in the deck (outside every projected zone), `notableEventCards` carries exactly the
  revealed cards' display entries so the lookup can resolve them.
- **Overlay volume.** Every single-card reveal now raises an overlay, hit or miss (for example, the
  12-card Spider-Man `reveal:2` family), and plays the WP-697 `hero-ability` sound. That trade-off is
  intended: a reveal is shown. Multi-card reveals that open a reorder prompt suppress their misses
  (Locked Values), so one play never double-surfaces the same cards. A multi-card reveal WITHOUT a reorder
  marker (the co2e Spider-Man "reveal the top two … put the rest back in any order" card lacks
  `[keyword:reveal-reorder]` — a card-data gap, a separate fix) raises one overlay per revealed card.
- **Privacy.** A revealed card is public at the table, and the engine already writes it into the public
  log line. Putting its id on the public event is consistent with that.
- **Determinism.** `G.notableEvents` is hashed by both oracles. The core-only sentinel plays no deck-top
  reveal hero (WP-726 verified), so the sentinel `finalStateHash` / `PRE_WP080_HASH` stay byte-unchanged.
  A moved oracle means an emit leaked outside the reveal family: investigate, never re-pin.
- **Why one packet, not engine + client.** The client change is two small edits and depends on the new
  field. Splitting would ship an id nobody renders. It mirrors WP-776 (engine + client in one packet).
- **Hypnotic Charm is out of scope.** It parks a discard-or-keep prompt that already shows each
  revealed top. Its Instinct "each other player's deck" clause is multiplayer-only and correct in a
  1-player game (log 23.2.21). Any solo variant is a separate rules call for Jeff.
- `docs/ai/DECISIONS.md` — scan D-24516, D-24547 (§2 revised by D-24637), D-12803, D-20002 / D-20105
  (the overlay renders engine narrative verbatim; no client rule logic).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — no §-level shape change (`UIState` is not specified
  in 00.2); `CardExtId` is used verbatim.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (engine emits, client renders) and `.claude/rules/architecture.md`
  §UIState Projection Integrity (the Board-Visible Field Rule — `notableEventCards` follows all five steps).

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- Never `Math.random()`. No I/O in moves or helpers. Moves never throw.
- `G` stays JSON-serializable. Zones store `CardExtId` strings only.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test` + `makeMockCtx`. No `boardgame.io` import
  in helpers or tests. Vue tests via `vue-sfc-loader`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`. No nested ternaries, full-word names,
  JSDoc on functions.

**Packet-specific:**
- **No game-state change.** The reveal grant, draw, deck order, the `G.messages` line and every return
  value stay byte-identical. The only engine changes are which reveals emit an event, and one more
  field on that event.
- **The parking reveals still do not emit.** A `choose-discard-or-return` reveal (reveal-attack-choose)
  surfaces via its pending prompt; the D-24547 double-surface rule is kept.
- **The existing WP-726 test `does NOT emit on a blocked reveal` (`heroEffects.execute.test.ts`
  ~L1997) is intentionally INVERTED** (a miss now emits, per D-24637). It is the only authorized edit
  to an existing test. The EC commit body must say so (Reward Integrity). Every other existing test
  passes without edits.
- **Client renders served data only** (D-20105): the image comes from `cardDisplayData[id].imageUrl`.
  The narrative is rendered verbatim. No client-side rule evaluation.
- **Only `heroEffectResolved` gains an image.** Other overlay event types render exactly as today.
- **Sentinel oracles byte-unchanged; no re-pin.**
- **Session protocol:** if another emit site of `heroEffectResolved` (e.g. Jade Giantess
  `reveal-herodeck-attack`) turns out to reveal a single deck-top card, STOP and ask before extending
  scope to it.

## Locked Contract Values

- `HeroEffectResolvedEvent` gains `revealedCardId?: CardExtId`: optional, with a JSDoc `// why:`
  (WP-789 / D-24637). It is set only by the `applyRevealRules` emit. Other emit sites leave it absent.
- `applyRevealRules` emit condition becomes
  `!revealRulesContainAnyAction(rules, ['choose-discard-or-return']) && Array.isArray(G.notableEvents)`
  (the `revealLogOutcome !== 'blocked'` clause is removed). The pushed event is
  `{ type: 'heroEffectResolved', playerId: playerID, narrative, revealedCardId: topCardId }`.
- Narrative `outcomeText`:
  - matched → `matchedActionPhrases.join(', ')` (unchanged);
  - miss (`matchedPredicateText === undefined`) → `left on top`.
  - The composer is unchanged. A miss therefore reads, e.g.,
    `"Card Shark" revealed "S.H.I.E.L.D. Agent" (cost 0) — left on top.`
- **Multi-card reveals with a reorder (reveal-count ≥ 2 + `reorderRemainder`).** `applyRevealRules` gains a
  final optional parameter `deferredEvents?: { event: HeroEffectResolvedEvent; isMiss: boolean }[]`. When it
  is provided, EVERY event (hit or miss) is pushed there, in reveal order, instead of `G.notableEvents`.
  - `heroEffectReveal` passes a local buffer only when `effect.reorderRemainder === true`, and tracks
    `let didParkReorder = false`, set inside its `remainderCount >= 2` park branch.
  - After the loop (it also runs on the deck-exhausted `break` exit), it pushes the buffer to
    `G.notableEvents` in order:
    - all entries when `!didParkReorder`;
    - only the `isMiss === false` entries when it parked.
  - A parked reorder prompt already shows the remainder, which keeps the D-24547 double-surface rule.
  - Reveals without `reorderRemainder` pass no buffer and emit inline (unchanged ordering).
- **Projection (UIState five-step).**
  - `UIState.notableEventCards?: UIDisplayEntry[]` — one `{ extId, display }` per DISTINCT
    `revealedCardId` in `G.notableEvents`, in first-appearance order, built by deduping the ids and
    calling the existing `buildDisplayEntries` (as `transformDeck` does) in `buildUIState`.
  - The field is omitted when there are none (conditional spread, never `undefined`).
  - PUBLIC: `filterUIStateForAudience` copies it for every audience, with the `transformDeck`
    conditional-copy pattern (~L666).
- Client:
  - `eventCardId` returns `event.revealedCardId ?? ''` for `heroEffectResolved`, so the card-name row
    appears when the id is present and stays hidden when it is absent (today's behavior).
  - `PlayDesktop.vue` `notableEventCardLookup` folds `notableEventCards` into its map with the
    existing first-wins `store()`, so a revealed card still in the deck resolves.
  - `NotableEventOverlay.vue` renders
    `<img class="notable-event-overlay__card-image" data-testid="play-notable-event-overlay-card-image">`
    only when `event.type === 'heroEffectResolved'` and the resolved `cardDisplayData[id].imageUrl` is
    a non-empty string. `alt` = the card name. There is no image for any other event type, and none
    when the id or URL is missing.

## Scope (In)

### A) Engine
- `events/notableEvents.types.ts` — the optional field and its JSDoc.
- `hero/heroEffects.execute.ts` — the `applyRevealRules` emit condition, the miss `outcomeText`,
  `revealedCardId`, the `deferredEvents` parameter, and the `heroEffectReveal` buffer and flush,
  with an updated `// why:` (D-24637 revises D-24547 §2).
- `events/notableEvents.types.ts` — also rewrite the `HeroEffectResolvedEvent` JSDoc, which says "no
  card id".
- `ui/uiState.types.ts` / `ui/uiState.build.ts` / `ui/uiState.filter.ts` — `notableEventCards`
  (the five-step contract).

### B) Client
- `apps/arena-client/src/composables/useNotableEventStream.ts` — the `eventCardId` branch.
- `apps/arena-client/src/pages/PlayDesktop.vue` — fold `notableEventCards` into
  `notableEventCardLookup`. (`PlayMobile.vue` does not mount the overlay; that pre-existing gap is
  out of scope.)
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — the image element, and a
  `cardImageUrl` computed with JSDoc and a small scoped style (a max height that keeps the overlay
  compact).

### C) Tests
- `hero/heroEffects.execute.test.ts`:
  1. **The authorized inversion:** the WP-726 test `does NOT emit on a blocked reveal` (~L1997) keeps its
     fixture (`reveal-odd-draw`, `starter-agent` cost 0). It is renamed to "emits on a blocked reveal",
     and its assertions change to: length 1, `revealedCardId === 'starter-agent'`, and a narrative ending
     `— left on top.`. No other edit to that test.
  1b. A new test: a Card Shark-shape (`reveal:team-x-men:draw`) miss emits exactly one event with
     `revealedCardId` = the top card and `— left on top.`.
  2. A hit emits one event with `revealedCardId` and the unchanged "drew it" narrative.
  3. A `reveal-cost-attack` (High Stakes Jackpot) event carries `revealedCardId`.
  4. A parking `reveal-attack-choose` still emits nothing (the double-surface rule).
  5. For a miss and a hit, the deck order, `turnEconomy` and the `G.messages` reveal line equal
     EXPLICIT expected values (the WP-729 test style).
  6. A `reveal-count:3` + `reveal-reorder` reveal that parks a reorder choice emits hit events only (its
     misses are suppressed). A [miss, hit, hit] reveal (1 remaining, no reorder parked) flushes all three
     events in reveal order: miss, hit, hit.
- `events/notableEvents.types.test.ts` — a JSON round-trip case (the existing precedent at ~L179): a
  `heroEffectResolved` event with `revealedCardId` survives `JSON.parse(JSON.stringify(...))` deep-equal.
- `ui/uiState.filter.test.ts` — `revealedCardId` AND `notableEventCards` survive the filter for the
  player, an opponent and a spectator (public).
- `ui/uiState.build.test.ts` — `notableEventCards` holds one entry per distinct `revealedCardId` in
  first-appearance order, with display resolved. It is omitted (key absent) when there are no reveal
  events (a runtime keyset assertion, D-24372).
- `apps/arena-client/src/pages/PlayDesktop.test.ts` — a revealed card present only in
  `notableEventCards` resolves in `notableEventCardLookup`, so the overlay shows its name and image.
- `apps/arena-client/src/composables/useNotableEventStream.test.ts` — `eventCardId` returns the id
  when present and `''` when absent.
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts`:
  - The image renders with the URL and `alt` for a `heroEffectResolved` event with `revealedCardId`.
  - There is no image when the id is absent.
  - There is no image for a `fightResolved` event, even with a card id.
- **Non-vacuous:** reverting each of the following must fail at least one new test. Report 6/6.
  - (a) the emit-condition change
  - (b) the `revealedCardId` field write
  - (c) the `eventCardId` branch
  - (d) the image `v-if`
  - (e) the `notableEventCards` build or pass-through
  - (f) the reorder miss-suppression buffer

## Out of Scope

- Hypnotic Charm (its pending prompt already shows each revealed top) and any solo reinterpretation
  of "each other player's deck".
- Images for other overlay event types (fights, ambushes, twists).
- Overlay duration or queue behavior.
- Jade Giantess / other non-`applyRevealRules` `heroEffectResolved` emitters (session protocol).
- `PlayMobile.vue` overlay mounting (a pre-existing gap: only PlayDesktop mounts `NotableEventOverlay`).
- The co2e Spider-Man `reveal-count:2` card's missing `[keyword:reveal-reorder]` marker (card-data fix).
- Existing comment-only text in test files (e.g. `NotableEventOverlay.test.ts` "carries no card id") is
  NOT edited; those tests assert id-less events and stay true.

## Files Expected to Change

- `packages/game-engine/src/events/notableEvents.types.ts` — modified — optional `revealedCardId`
- `packages/game-engine/src/hero/heroEffects.execute.ts` — modified — `applyRevealRules` emit on a miss + the id; the reorder miss buffer
- `packages/game-engine/src/ui/uiState.types.ts` — modified — `notableEventCards?: UIDisplayEntry[]`
- `packages/game-engine/src/ui/uiState.build.ts` — modified — build `notableEventCards`
- `packages/game-engine/src/ui/uiState.filter.ts` — modified — public pass-through
- `apps/arena-client/src/pages/PlayDesktop.vue` — modified — fold into `notableEventCardLookup`
- `apps/arena-client/src/composables/useNotableEventStream.ts` — modified — the `eventCardId` branch
- `apps/arena-client/src/components/play/NotableEventOverlay.vue` — modified — the reveal card image
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — modified — six new tests (1b, 2–6; test 6 has two cases) + the one authorized inversion (test 1)
- `packages/game-engine/src/ui/uiState.build.test.ts` — modified — `notableEventCards` build + keyset
- `apps/arena-client/src/pages/PlayDesktop.test.ts` — modified — the lookup fold
- `packages/game-engine/src/events/notableEvents.types.test.ts` — modified — one JSON round-trip case
- `packages/game-engine/src/ui/uiState.filter.test.ts` — modified — the public pass-through cases
- `apps/arena-client/src/composables/useNotableEventStream.test.ts` — modified — two cases
- `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — modified — three cases
- Governance:
  - `docs/ai/STATUS.md`
  - `docs/ai/DECISIONS.md` (D-24637 → Active; D-24547 §2 annotated "revised by D-24637")
  - `docs/ai/work-packets/WORK_INDEX.md`
  - `docs/ai/execution-checklists/EC_INDEX.md`
  - `docs/05-ROADMAP-MINDMAP.md`

No other files may be modified.

## Contract

- Every auto-resolving (non-parking) `applyRevealRules` reveal emits exactly one `heroEffectResolved`
  event carrying the revealed card's `revealedCardId`, on a hit or a miss.
- The client shows that card's name and image on the "Hero Ability" overlay.
- Game outcomes are unchanged.

## Acceptance Criteria

1. Card Shark revealing a non-X-Men card emits one overlay event whose narrative ends
   "— left on top." and whose `revealedCardId` is the revealed card.
2. Card Shark revealing an X-Men Hero emits one event ("— drew it.") with `revealedCardId`.
3. High Stakes Jackpot's event carries `revealedCardId`.
4. reveal-attack-choose still emits no overlay event.
5. Deck order, `turnEconomy` and the `G.messages` reveal line equal the explicit expected values in heroEffects
   test 5 (miss and hit).
6. `revealedCardId` reaches every audience through the filter.
7. The overlay shows the revealed card's image and name for a `heroEffectResolved` event with an id,
   including a card still in the deck (a miss, High Stakes Jackpot). There is no image when the id is
   absent, or for any other event type.
8. The sentinel `finalStateHash` / `PRE_WP080_HASH` are unchanged.
9. A multi-card reorder reveal that parks a reorder prompt raises no miss overlays; one that parks none
   shows every revealed card's overlay in reveal order.
10. `notableEventCards` reaches every audience and is absent when no reveal event exists.

## Verification Steps

```pwsh
pnpm --filter "@legendary-arena/arena-client^..." build
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0 (the client reads the engine's built dist types)
pnpm --filter @legendary-arena/game-engine test
# Expected: 0 fail; record before/after counts
pnpm --filter @legendary-arena/game-engine exec node --import tsx --test "src/test/fixtures/replayFixtures.test.ts"
git diff --exit-code -- packages/game-engine/src/test/fixtures/games
# Expected: green; exits 0
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: exits 0; 0 fail
pnpm -r build; pnpm -r --no-bail test
# Expected: 0 failures
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All ACs pass. The 6/6 revert proofs are reported.
- [ ] `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. arena-client vue-tsc exits 0.
      Engine and client before/after counts are recorded.
- [ ] Sentinel / replay oracles byte-identical, with no re-pin.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED):** in a manual match with Gambit, play Card Shark on a
      non-X-Men top card and the overlay shows that card's image with "left on top". Play High Stakes
      Jackpot and the overlay shows the revealed card's image. The Play Diagnostics `uiStateSnapshot`
      carries `notableEventCards` (five-step, step 5). Record the matchId in STATUS.md.
- [ ] STATUS.md updated. D-24637 → Active. D-24547 §2 annotated.
- [ ] WORK_INDEX WP-789 `[x]` with date. EC_INDEX EC-826 → Done. Mindmap `📝`→`✅`.
      `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:**
  - §1 / §2: faithful card semantics — "reveal" means the card is shown.
  - §11: stateless client — it renders served state only.
  - §17: accessibility — the image has an `alt` name and the overlay's `aria-live` text is kept.
  - §8 / §22: determinism — no state change, and the hashed events are sentinel-inert.
  - None of NG-1..NG-8 is crossed (display-only; nothing paid, persuasive or competitive).
- **Conflict assertion:** No conflict. Display-only; no monetization surface; no scoring change.
- **Determinism preservation:** only `notableEvents` content changes, for reveal-family plays. Replays
  recorded before WP-789 re-execute with extra or longer events. The game outcome and scoring are
  identical (events are display-only; D-24547 §3). **Accepted window:** `G.notableEvents` is hashed, so a
  competitive match captured before the deploy that includes a reveal miss or a reveal event, but is
  submitted after it, fails `replay_verification_failed` (competition.logic ~L833) — the same window
  WP-726 already carried. It closes once pre-deploy matches age out; no code handles it.

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1 structure:** every required section is present. Baseline `17b9787f` cited.
- **§2 constraints:** engine-wide, packet-specific, session protocol, and locked values.
- **§3 / §4:** WP-697 / WP-726 / D-24547 with anchors. Jeff's match with log line numbers. 00.2 and a
  DECISIONS scan list are cited.
- **§5 / §7:** a closed 15-file (8 source + 7 test) allowlist with per-entry descriptions, plus
  governance. No new deps. It exceeds the ~8-file guidance; not split, because the client consumes the new
  field and projection in the same packet (the WP-776 precedent; see Context).
- **§6 naming:** `revealedCardId` mirrors the existing `ambushResolved` / `bystanderRevealed` field.
  Source names are verbatim.
- **§8 layer:** engine decides and emits; the client renders served data. No client import of engine
  runtime beyond types.
- **§9 Windows:** `pwsh` verification.
- **§10 / §11:** N/A — no env var or auth surface.
- **§12 tests:** `node:test`, `makeMockCtx` and `vue-sfc-loader`; a revert proof per mechanism.
- **§13 / §14 / §15:** exact commands, 10 binary ACs, and a DoD with STATUS, DECISIONS, WORK_INDEX and
  D-24026.
- **§16 code style:** a `v-if` guard (no nested ternary), and a JSDoc'd computed.
- **§17 Vision:** present.
- **§18 prose-vs-grep:** N/A — no grep-based acceptance.
- **§19:** N/A — baseline recorded.
- **§20 Funding:** N/A — a gameplay-display change; no funding surface or copy.
- **§21 API Catalog:** N/A — no `apps/server` endpoint or `Library-only` function touched.

## Gate Verdicts

- **Pre-flight (01.4): NOT READY → fixed.** Three blockers:
  - PS-1: a card still in the deck could not resolve on the client. Fixed with the `notableEventCards`
    projection and its five-step contract, plus the PlayDesktop lookup fold.
  - PS-2: the WP-726 "no emit on a miss" test contradicts the change. It is now the one authorized
    inversion.
  - PS-3: multi-card reveals would double-surface with the reorder prompt. Fixed with the buffered
    miss-suppression.

  RS items applied:
  - the event JSDoc rewrite;
  - the overlay-volume trade-off stated;
  - explicit expected values in test 5;
  - an arena-client typecheck after the engine build;
  - the PlayMobile gap noted as out of scope.

  Baseline re-recorded at execution (engine 4700/0 at `17b9787f`). The prototype showed exactly one
  failure (the inverted test) and no hash re-pin. Scope grew, so pre-flight re-runs with the copilot
  pass.
- **Pre-flight re-run (01.4): READY TO EXECUTE.** RS-1 applied: every event of a reorder reveal is
  buffered, so a flush keeps reveal order. Other applied items:
  - the no-marker multi-card and sound-effect notes;
  - the competition replay window;
  - the `notableEventCards` size bound;
  - the full `// why:` list;
  - the inversion defined as rename + assertions only;
  - the index rows refreshed;
  - AC order;
  - a JSON round-trip shape test;
  - the baseline reconciled.
- **Copilot (01.7): RISK → HOLD, fixes applied.** All findings were scope-neutral text (ordering,
  testing, docs, unstated consequences). A residual edge is recorded in D-24637 §3a: a reorder-family hit
  that leaves the card on the deck would double-surface; no current card does.
- **Lint (00.3): PASS after fixes.** The first run FAILED on AC numbering. Also fixed: AC-5 made binary,
  the test counts, the baseline, the Context architecture citations, the NG-1..8 check, PlayMobile in Out
  of Scope, the EC `// why:` entries, the index rows, and the file-bound note. A delta re-check confirms.
