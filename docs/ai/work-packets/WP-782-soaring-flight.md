# WP-782 — Soaring Flight executor: a recruited Soaring Flight Hero is set aside and joins your new hand at end of turn (Game Engine + card data)

**Status:** Draft 2026-09-27
**Primary Layer:** Game Engine (recruit placement, keyword lockstep, TurnEconomy grant flags) + card data (curated markers on `data/cards/xmen.json`)
**Dependencies:**
- D-24624 (PR #2471, merged) — today's honest `soaring-flight` hollow this packet retires
- WP-273 / D-24049 (Wall-Crawl — the recruit-time keyword template: `KEYWORD_TIMING_DEFAULTS`, `RECRUIT_TIME_EXECUTED_KEYWORDS`, the `recruitHero` placement branch)
- WP-705 / D-24526 (Teleport-on-discard — the `G.pendingTeleportReturns` set-aside queue and its end-of-turn drain, reused here)
- WP-780 / D-24619 (Penumbra — the handler-bearing no-magnitude keyword that sets a lazily-materialized `TurnEconomy` flag; curated-marker precedent)
- WP-648 / D-24460 (`recruitOfficer`), WP-692 / D-24509 (free-recruit-from-HQ tactics), WP-701 / D-24520 (single end-of-turn cleanup site)

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). Keyword lockstep (+3 `HeroKeyword`s, +2 handlers), a new `TurnEconomy` contract field pair, recruit-path edits across three moves plus a tactic handler, and a replay-hash surface (xmen matches) — fails lightweight-lane criteria 3, 4 and 6.
**Numbers:** WP-782 / EC-819 / D-24627, reserved in PR #2476 (`claude/reserve-team-gate-soaring-flight`).

> Baseline: `origin/main` at `8a174e23`. The reserve PR #2476 must be merged before execution (ledger lines only; no code dependency).

---

## Goal

Legendary's **Soaring Flight** (`data/metadata/keywords-full.json` key `soaringflight`; rules v23 ~L1941-1944): "When you recruit this Hero, set it aside. At the end of this turn, add it to your new hand as an extra card."

**Today (after D-24624):** every one of the 15 X-Men cards that prints a bare `[keyword:Soaring Flight]` line is recruited into the discard pile like any other Hero. The line is an honest `soaring-flight` hollow (`parse-unrecognized`, labelled `onRecruit`) that fires on every play. The two grant lines — Cannonball "Carry to the Air" (`[hc:strength]: The next Hero you recruit this turn has [keyword:Soaring Flight].`) and Aurora & Northstar "Mach 10" (`All Heroes you recruit this turn have [keyword:Soaring Flight].`) — are onPlay hollows that do nothing. `sim:coverage` counts 17 `soaring-flight` lines.

**After this session:**
1. **Recognition.** Curated markers make the 15 bare lines resolve to a new recruit-time keyword `soaring-flight` (onRecruit, no handler — the Wall-Crawl posture), and the two grant lines resolve to two new handled keywords `grant-soaring-flight-next` / `grant-soaring-flight-all`. No xmen hero hook records a `soaring-flight` unresolved marker.
2. **Placement.** One helper, `placeRecruitedHero`, decides where a recruited card goes: deck top (Wall-Crawl chosen), set aside (Soaring Flight applies), or discard. `recruitHero`, `recruitOfficer`, and both free-recruit-from-HQ tactic paths call it.
3. **Set aside.** A Soaring Flight recruit is appended to `G.pendingTeleportReturns` (`{ playerID, cardId }`), which `applyEndOfTurnCleanup` already drains after the new-hand draw — so the card lands as the extra (seventh) card of the recruiter's new hand, on every turn-end path (live, replay, sim, PAR, fixture).
4. **Grants.** Playing Carry to the Air (with its Strength gate met) sets `TurnEconomy.isNextRecruitSoaringFlight`; playing Mach 10 sets `TurnEconomy.isEveryRecruitSoaringFlight`. The next recruit consumes the first; the second lasts the turn.

## User-Visible Impact

- X-Men Soaring Flight heroes (Aurora & Northstar, Banshee, Cannonball, Colossus & Wolverine, Kitty Pryde, Legion, Phoenix, Polaris) work as printed: recruit one and it is in your hand at the start of your next turn, as a seventh card.
- Carry to the Air and Mach 10 give that effect to other Heroes (and S.H.I.E.L.D. Officers) you recruit afterwards that turn.
- The game log says "(Soaring Flight: set aside until end of turn)" on the recruit line. The set-aside card is not drawn on the board this WP (see Out of Scope).
- Playing a Soaring Flight card no longer reports a hollow effect.

---

## Assumes

1. **The D-24624 hollow is on `main`.** `UNMATCHED_KEYWORD_TIMINGS['soaring-flight'] = 'onRecruit'` (`setup/heroAbility.setup.ts:~173`), `findLeadingUnmatchedKeywordTiming` (`:~2474`), Step 4b (`:~2334-2371`). Enumerated via `buildHeroAbilityHooks` over `createRegistryFromLocalFiles({ metadataDir: 'data/metadata', cardsDir: 'data/cards' })` on `8a174e23`: 15 bare lines on 15 cards (49 copies), all `{ keywords: [], timing: 'onRecruit', unresolvedMarkers: ['soaring-flight'] }`; Mach 10 line 1 `onPlay` + `['soaring-flight']`; Carry to the Air line 1 `onPlay` + `conditional` + `heroClassMatch strength` + `['soaring-flight']`. `scripts/coverage/hero-effect-coverage.baseline.json:~293` holds `"soaring-flight": 17`.
2. **Markers parse as keywords.** A hyphenated `[keyword:X]` token appended to a line matches `KEYWORD_PATTERN` (`setup:~124`) and yields `keywords: [X]` + `effects: [{ type: X }]`; a leading `[hc:X]:` stays the gate (probed on `8a174e23` with `[keyword:play-both-sides]`). Once the line resolves a keyword, Step 4b does not run, so the inert `[keyword:Soaring Flight]` display token records nothing. The client hides lowercase-hyphenated engine tokens (`apps/arena-client/src/lib/abilityMarkers.ts` `isEngineOnlyKeyword`, D-24496).
3. **Marker pipeline.** `scripts/convert-cards/apply-hero-ability-markers.mjs` validates every token against the closed `VALID_TOKEN_PATTERN` (`:~119`, last extended by WP-780 for `play-both-sides`) and appends it idempotently; entries live in `scripts/convert-cards/inputs/hero-ability-markers.json` under `"xmen"` (`:~2130`).
4. **Recruit-time keyword template (Wall-Crawl, D-24049).**
   - `KEYWORD_TIMING_DEFAULTS` (`setup:~537`) sets the onRecruit timing.
   - `RECRUIT_TIME_EXECUTED_KEYWORDS = ['wall-crawl']` (`hero/heroEffects.execute.ts:~316`) joins `MVP_KEYWORDS`, so the play-time visit of the hook classifies `applied` (not a `no-handler` hollow). A keyword outside `NO_MAGNITUDE_KEYWORDS` is dropped by the `executeSingleEffect` magnitude pre-gate, so the play-time visit is a silent no-op.
   - `recruitHero` (`moves/recruitHero.ts:~175-229`): `placeOnDeckTop` = `toTopOfDeck === true` AND an onRecruit `wall-crawl` hook (`filterHooksByTiming(getHooksForCard(...), 'onRecruit')`, `rules/heroAbility.types.ts:~347 / ~390`); deck-top `unshift`, else `discard.push`; then `spendRecruit`, `hasActedThisTurn`, `refillHqSlot`, and the byte-locked log line with the Wall-Crawl note appended only on the deck-top branch.
   - No client and no bot sends `toTopOfDeck` today (grep of `apps/` and `simulation/`).
5. **Set-aside queue (D-24526).** `PendingTeleportReturn { playerID, cardId }` (`types.ts:~1424-1444`), `G.pendingTeleportReturns?` (`types.ts:~2145-2151`, lazily initialized, never in setup). `consumeTeleportReturns` (`moves/endOfTurnCleanup.logic.ts:~125-138`) appends each card to its owner's hand and empties the queue; it is Step 6 of `applyEndOfTurnCleanup` (`:~102-110`), after the fill to `HAND_SIZE` (6). `applyEndOfTurnCleanup` is the only turn-end cleanup and is called by `game.ts:~261`, `moves/coreMoves.impl.ts:~766` (`endTurn`), `replay/replay.execute.ts:~121`, `simulation/simulation.runner.ts:~304`, `simulation/par.aggregator.ts:~464` and `test/fixtures/runFixture.ts:~154`. No UIState field projects the queue. No card-conservation invariant exists.
6. **Other recruit paths.**
   - `recruitOfficer` (`moves/recruitOfficer.ts:~188-202`) moves `G.piles.officers[0]` to `zones.discard`.
   - Free-recruit tactics (Dr. Doom "Dark Technology", Magneto "Bitter Captor"): `gainHqHeroFree` (`rules/tacticHandlers.ts:~831-852`, forced single-eligible) and the parked pick in `moves/giveHqHeroChoice.resolve.ts:~276-294`. A parked entry is a free recruit iff `entry.filter !== undefined` (`PendingGiveHqHeroChoice.filter`, `types.ts:~1506-1525`); an entry without `filter` is Paibok's give, a gain.
   - "Gain" paths (`gainOfficerToHand`, Paibok, "Gain this as a Hero") are not recruits (rules v23 ~L1179-1183).
7. **Turn-scoped flag template (D-24619).** `TurnEconomy.isPlayBothSidesActive?: true` (`economy/economy.types.ts:~113`), set by `enablePlayBothSides` (`economy/economy.logic.ts:~804`), listed in `CarriedTurnFields` (`:~481-492`) and carried by `carryConversionFlag` (`:~518-545`), dropped by `resetTurnEconomy()` (`:~889`), which `game.ts:~869`, `simulation.runner.ts:~754`, `par.aggregator.ts:~805` and `runFixture.ts:~328` call at turn start. The handler is `heroEffectPlayBothSides` (`heroEffects.execute.ts:~4918`), registered in `HERO_EFFECT_HANDLERS` (declared `:~5739`, entry `:~5902`), `HANDLED_KEYWORDS` (declared `:~118`, entry `:~296`) and `NO_MAGNITUDE_KEYWORDS` (declared `:~446`, entry `:~577`). The economy projection in `ui/uiState.build.ts:~1012-1040` is field-by-field, so a new `TurnEconomy` field does not reach the client. `replay/replay.execute.ts` is the D-24322 determinism harness and does not reset `turnEconomy`; that posture is inherited by every turn-scoped flag and is unchanged here.
8. **Keyword lockstep sites** (`reference_hero_keyword_lockstep_sites`): the union + `HERO_KEYWORDS` (`rules/heroKeywords.ts`, 74 entries on `8a174e23`), the three length pins in `rules/heroKeywords.test.ts:~64-75`, `rules/heroAbility.setup.test.ts:~556-646` (`expectedKeywords` order array + length) and `setup/heroAbility.setup.test.ts:~1430` (the WP-780 precedent edited all three), the handler-count pins `hero/heroEffects.execute.test.ts:~135` and `:~7344` (58), and `RECRUIT_TIME_EXECUTED_KEYWORDS` membership (`heroEffects.execute.test.ts:~156`).
9. **Ledger + coverage.** `scripts/hero-mechanic-ledger.mjs` imports `MVP_KEYWORDS` from the engine `dist` (`:~61`) and maps move-executed keywords to their executor module in `MOVE_EXECUTED_HANDLER_MODULES` (`:~100`). `scripts/coverage/mechanic-provenance.json:~33` carries the `wall-crawl` provenance row. `apps/dashboard/src/composables/useInPlayCoverage.test.ts` pins the runtime-observed `totalObs`.
10. **Rules text.** v23 ~L2084-2087: a recruited Hero with several "put it somewhere" effects (Wall-Crawl, Soaring Flight, "When Recruited: Send this Undercover") — the player chooses which applies. v23 ~L2015-2017: Switcheroo is not recruiting.
11. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**; reconcile the WP and D-24627 first. Line anchors are `~` approximate; re-read at execution.

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` ~L1941-1944 (Soaring Flight), ~L2084-2087 (competing recruit destinations), ~L1175-1183 ("When Recruited" vs "gain"), ~L2015-2017 (Switcheroo).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) and §Persistence Boundaries; `.claude/rules/architecture.md` §Zone Contents, §Move Validation Contract, §UIState Projection Integrity (not triggered — no new UIState field); `.claude/rules/code-style.md` §Drift Detection (runtime pins, WP-563).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.2 (Hero Deck Shape — `abilities`) and §5 (Ability Text Markup Language).
- `docs/ai/DECISIONS.md`: D-24049 (Wall-Crawl), D-24526 (Teleport-on-discard set-aside), D-24619 (turn-scoped flag), D-24460, D-24509, D-24520, D-24624, D-24496. D-24627 is reserved.
- `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` (the tactic-handler and resolve-move edits are recruit-path wiring).
- User memory: `reference_hero_keyword_lockstep_sites`, `reference_sim_coverage_baseline_gate_distinct`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_hashed_g_field_dual_repin`, `reference-three-bgio-bypassing-turn-loops`, `feedback_ec_locked_value_stale_baseline`.

**Why engine-only.** The reservation line names "Game Engine + App arena-client". The set-aside card is visible to no one this WP: the recruit log line is the surface, and the Teleport queue it reuses already ships without a projection. Projecting both queues publicly is one follow-up (the five-step UIState contract plus a client chip), named in Out of Scope. Folding it in would add the UIState contract to a packet whose point is the rules executor.

**Why reuse `pendingTeleportReturns`.** Teleport's rule text is word-for-word the same effect ("set it aside. At the end of this turn, add it to your new hand as an extra card"). The queue already has the right shape, is lazily created, and is drained at the one cleanup site every harness calls. A second queue would duplicate the drain and add a new `G` field (a dual hash re-pin) for no behavioral difference.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves and effects never throw. No randomness. No `.reduce()` with branching. Zones and queues hold `CardExtId` strings only.
- The client submits intent (`recruitHero({ hqIndex, toTopOfDeck? })`); the engine decides the destination.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24627) before coding. One WP per session.

**Packet-specific:**

- **Markers (card data).** Exactly 17 curated rows in `hero-ability-markers.json` `"xmen"`, then regenerate `data/cards/xmen.json` with `apply-hero-ability-markers.mjs`:
  - `[keyword:soaring-flight]` on abilityIndex 0 of the 15 cards in §Card Map.
  - `[keyword:grant-soaring-flight-next]` on `cannonball/carry-to-the-air` abilityIndex 1.
  - `[keyword:grant-soaring-flight-all]` on `aurora-northstar/mach-10` abilityIndex 1.
  - `VALID_TOKEN_PATTERN` gains exactly these three bare tokens, with a `// why:` citing WP-782 / D-24627.
- **Parser.** `KEYWORD_TIMING_DEFAULTS['soaring-flight'] = 'onRecruit'`. No other parser change. `UNMATCHED_KEYWORD_TIMINGS['soaring-flight']` **stays**: it is the honest fallback for an unmarked Soaring Flight line, and `hero/ungatedKeywordHollow.test.ts` (which parses raw, unmarked text) stays green unmodified.
- **Keyword lockstep.**
  - `soaring-flight`: union + `HERO_KEYWORDS`, **appended to `RECRUIT_TIME_EXECUTED_KEYWORDS`**. No handler, not in `HANDLED_KEYWORDS`, not in `NO_MAGNITUDE_KEYWORDS` (the Wall-Crawl posture: the play-time visit classifies `applied` and does nothing).
  - `grant-soaring-flight-next` and `grant-soaring-flight-all`: union + `HERO_KEYWORDS`, `HERO_EFFECT_HANDLERS`, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`.
  - Pins move `HERO_KEYWORDS` +3 and `HERO_EFFECT_HANDLERS` +2 from whatever the current values are at execution (74 / 58 on `8a174e23`; WP-781 may land first and move them).
- **Grant flags.** `TurnEconomy.isNextRecruitSoaringFlight?: true` and `TurnEconomy.isEveryRecruitSoaringFlight?: true` (`economy/economy.types.ts`), lazily materialized, added to `CarriedTurnFields` and `carryConversionFlag`, dropped by `resetTurnEconomy()` (no edit needed there — it builds a fresh literal). Three rebuild helpers in `economy/economy.logic.ts` (the `enablePlayBothSides` shape):
  - `grantSoaringFlightToNextRecruit(economy)` spreads `carryConversionFlag(economy)`, then sets `isNextRecruitSoaringFlight: true` (idempotent).
  - `grantSoaringFlightToEveryRecruit(economy)` spreads `carryConversionFlag(economy)`, then sets `isEveryRecruitSoaringFlight: true` (idempotent).
  - `consumeNextRecruitSoaringFlight(economy)` builds the carried set from `carryConversionFlag(economy)`, **deletes `isNextRecruitSoaringFlight` from that local carried object**, then spreads it — so the returned economy has no such key. A plain spread would carry the flag straight back (it is in `carryConversionFlag`) and every later recruit that turn would be set aside.
- **Handlers** (`hero/heroEffects.execute.ts`): `heroEffectGrantSoaringFlightNext` and `heroEffectGrantSoaringFlightAll` each call the matching grant helper on `G.turnEconomy` and `pushLog(..., 'applied', cardId)` a full sentence naming the card and the effect. Two plays of Carry to the Air set one flag (both name the same next Hero).
- **Placement helper** — new boardgame.io-free, `moves/`-free helper file `hero/soaringFlight.logic.ts` (imports only `getHooksForCard`, `filterHooksByTiming`, `consumeNextRecruitSoaringFlight` and types). Exports:
  - `cardHasSoaringFlight(G, cardId): boolean` — read-only; `Array.isArray(G.heroAbilityHooks)` guard; true iff an onRecruit hook for `cardId` carries `soaring-flight`.
  - `placeRecruitedHero(G, playerId, cardId, isWallCrawlChosen): RecruitPlacement` — **mutates the passed `G` draft** (`turnEconomy`, the recruiter's zones, `pendingTeleportReturns`) and returns the placement; no `turnEconomy` guard (a real `G` always has one), where `RecruitPlacement = 'deck-top' | 'set-aside' | 'discard'`. In this exact order:
    1. `hasSoaringFlight` = `cardHasSoaringFlight(G, cardId)` OR `G.turnEconomy.isEveryRecruitSoaringFlight === true` OR `G.turnEconomy.isNextRecruitSoaringFlight === true` (read **before** the consume).
    2. If `G.turnEconomy.isNextRecruitSoaringFlight === true`, `G.turnEconomy = consumeNextRecruitSoaringFlight(G.turnEconomy)` — the next recruit consumes the grant whatever the destination.
    3. If `G.playerZones[playerId]` is absent, return `'discard'` with no zone write (moves never throw). Only narrow test mocks reach this; today `recruitHero`'s non-null assertion would throw there instead. D-24627 records the difference.
    4. `isWallCrawlChosen` → `deck.unshift(cardId)`, return `'deck-top'`.
    5. else `hasSoaringFlight` → lazily create `G.pendingTeleportReturns`, push `{ playerID: playerId, cardId }`, return `'set-aside'`.
    6. else `discard.push(cardId)`, return `'discard'`.
- **Recruit sites.** Each replaces its own zone write with one `placeRecruitedHero` call; nothing else in the move changes order.
  - `recruitHero`: `placeRecruitedHero(G, ctx.currentPlayer, cardId, placeOnDeckTop)`; `placeOnDeckTop` is computed exactly as today. The log appends ` (Soaring Flight: set aside until end of turn)` only on `'set-aside'`; the `'deck-top'` note and the `'discard'` line stay byte-identical.
  - `recruitOfficer`: `placeRecruitedHero(G, ctx.currentPlayer, officerId, false)` (grants only; an Officer has no native Soaring Flight). The same note is appended only on `'set-aside'`.
  - `gainHqHeroFree` (`rules/tacticHandlers.ts`, private): `placeRecruitedHero(G, playerId, heroId, false)`; its return type becomes `{ heroId: CardExtId; placement: RecruitPlacement } | null` so its caller (`freeRecruitFromHqByFilter`) appends the note to its existing log line only on `'set-aside'`.
  - `giveHqHeroChoice.resolve.ts`: when `entry.filter !== undefined` (free recruit), `placeRecruitedHero(G, playerID, heroId, false)`, and on `'set-aside'` the log reads `Player N recruited <card> from the HQ (Soaring Flight: set aside until end of turn).` When `filter` is absent (Paibok's give — a gain), the `discard.push` and its log stay byte-identical.
- **Wall-Crawl vs Soaring Flight** (v23 ~L2084-2087, the player chooses): `toTopOfDeck: true` on a card that has Wall-Crawl chooses Wall-Crawl; otherwise Soaring Flight applies because it is mandatory. No client or bot affordance changes. Today no card prints both; the case arises only when a grant gives Soaring Flight to a Wall-Crawl card.
- **Narrow mock fixture.** `moves/giveHqHeroChoice.resolve.test.ts` `makeG` (`:~28-48`) builds `G` without `turnEconomy`; its filtered-pick test (`:~205-217`) would now reach `placeRecruitedHero` and throw. Add the baseline `turnEconomy` literal to `makeG` (the `tacticHandlers.test.ts:~50` shape plus `cardsDrawn: 0`). This completes the fixture; no assertion changes and no test is weakened.
- **Set-aside queue.** `types.ts` gets **JSDoc/comment edits only**: on `PendingTeleportReturn` and `pendingTeleportReturns` (the queue now holds Teleport-on-discard **and** Soaring Flight cards), and on `PendingGiveHqHeroChoice.filter` (a present `filter` marks a free recruit, so Soaring Flight and the next-recruit grant apply, D-24627; a future filtered **gain** must add an explicit discriminant instead of reusing `filter`). No field rename, no shape change. `endOfTurnCleanup.logic.ts` is **not** modified.
- **Ledger.** `scripts/hero-mechanic-ledger.mjs` `MOVE_EXECUTED_HANDLER_MODULES['soaring-flight'] = 'packages/game-engine/src/hero/soaringFlight.logic.ts'`. `scripts/coverage/mechanic-provenance.json` gains `soaring-flight`, `grant-soaring-flight-next`, `grant-soaring-flight-all` → `{ wp: 'WP-782', decision: 'D-24627' }`.
- **Determinism.** No randomness. Both flags and the queue are lazily omitted, so a match with no Soaring Flight recruit keeps `G` byte-identical. (After the first one, `consumeTeleportReturns` leaves `pendingTeleportReturns: []` for the rest of the match — the existing D-24526 behavior.) Sentinel `finalStateHash` and `PRE_WP080_HASH` are expected unchanged (core boards). A pinned oracle whose board includes xmen heroes may change and is re-pinned citing D-24627; a changed oracle with no xmen hero on its board means STOP and diagnose. xmen matches recorded before this WP will not replay identically (D-24627 records this with the D-24119 re-verification note).

## Card Map (locked)

`[keyword:soaring-flight]` on abilityIndex 0 of (setAbbr `xmen`, copies in parentheses):

| Hero | Cards |
|---|---|
| aurora-northstar | northern-lights (5), twin-blast (3), mach-10 (1) |
| banshee | speed-of-sound (5) |
| cannonball | kinetic-blast-field (5), carry-to-the-air (5), natural-leader (3), human-cannon (1) |
| colossus-wolverine | fastball-special (5) |
| kitty-pryde | lockheed-kittys-dragon (1) |
| legion | maelstrom-of-clashing-powers (1) |
| phoenix | obliterating-fire (5) |
| polaris | ride-the-magnetic-waves (5), subtle-attunement (3), reverse-polarity (1) |

15 cards, 49 copies. None is a Divided Card half. Grants: `cannonball/carry-to-the-air` abilityIndex 1 → `[keyword:grant-soaring-flight-next]` (keeps its `[hc:strength]:` gate); `aurora-northstar/mach-10` abilityIndex 1 → `[keyword:grant-soaring-flight-all]` (ungated).

## Locked Values

The EC copies this list verbatim.

- Keywords: `'soaring-flight'` (recruit-time, no handler), `'grant-soaring-flight-next'`, `'grant-soaring-flight-all'` (handled, no-magnitude).
- `KEYWORD_TIMING_DEFAULTS['soaring-flight'] = 'onRecruit'`. `UNMATCHED_KEYWORD_TIMINGS['soaring-flight']` stays.
- `soaring-flight` joins `RECRUIT_TIME_EXECUTED_KEYWORDS` only — NOT `HANDLED_KEYWORDS`, NOT `NO_MAGNITUDE_KEYWORDS`. The two grant keywords join `HERO_EFFECT_HANDLERS`, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`.
- Flags: `TurnEconomy.isNextRecruitSoaringFlight?: true`, `TurnEconomy.isEveryRecruitSoaringFlight?: true` — lazy, in `CarriedTurnFields` + `carryConversionFlag`, dropped by `resetTurnEconomy()`.
- Economy helpers: `grantSoaringFlightToNextRecruit`, `grantSoaringFlightToEveryRecruit` (spread `carryConversionFlag`, then set their flag); `consumeNextRecruitSoaringFlight` (build the carried set from `carryConversionFlag`, delete `isNextRecruitSoaringFlight` from that local object, then spread — the key must be absent).
- `hero/soaringFlight.logic.ts` (boardgame.io-free, `moves/`-free; imports only `getHooksForCard`, `filterHooksByTiming`, `consumeNextRecruitSoaringFlight` and types) exports `cardHasSoaringFlight(G, cardId)` (read-only), `placeRecruitedHero(G, playerId, cardId, isWallCrawlChosen)` (mutates the passed `G`: `turnEconomy`, the recruiter's zones, `pendingTeleportReturns`; returns the placement), `RecruitPlacement = 'deck-top' | 'set-aside' | 'discard'`. No `turnEconomy` guard in the helper.
- `placeRecruitedHero` order: (1) read `hasSoaringFlight` = native OR every-flag OR next-flag; (2) consume the next-flag if set; (3) missing zones → `'discard'`, no write; (4) `isWallCrawlChosen` → `deck.unshift` → `'deck-top'`; (5) `hasSoaringFlight` → push `{ playerID: playerId, cardId }` onto lazily-created `G.pendingTeleportReturns` → `'set-aside'`; (6) `discard.push` → `'discard'`.
- `gainHqHeroFree` returns `{ heroId, placement } | null` so `freeRecruitFromHqByFilter` appends the note only on `'set-aside'`.
- Call sites: `recruitHero` passes today's `placeOnDeckTop`; `recruitOfficer`, `gainHqHeroFree`, and `giveHqHeroChoice.resolve` (only when `entry.filter !== undefined`) pass `false`. Paibok (no `filter`) keeps its `discard.push` + log byte-identical.
- Log note, appended only on `'set-aside'`: ` (Soaring Flight: set aside until end of turn)`. Filtered give-hq-hero set-aside line: `Player N recruited <card> from the HQ (Soaring Flight: set aside until end of turn).`
- Markers, 17 rows in `hero-ability-markers.json` `"xmen"`, abilityIndex 0 `[keyword:soaring-flight]` on: aurora-northstar northern-lights, twin-blast, mach-10; banshee speed-of-sound; cannonball kinetic-blast-field, carry-to-the-air, natural-leader, human-cannon; colossus-wolverine fastball-special; kitty-pryde lockheed-kittys-dragon; legion maelstrom-of-clashing-powers; phoenix obliterating-fire; polaris ride-the-magnetic-waves, subtle-attunement, reverse-polarity. Plus `cannonball/carry-to-the-air` abilityIndex 1 `[keyword:grant-soaring-flight-next]` and `aurora-northstar/mach-10` abilityIndex 1 `[keyword:grant-soaring-flight-all]`.
- `VALID_TOKEN_PATTERN` gains exactly `^\[keyword:soaring-flight\]$`, `^\[keyword:grant-soaring-flight-next\]$`, `^\[keyword:grant-soaring-flight-all\]$`.
- `types.ts`: JSDoc/comment edits only, on `PendingTeleportReturn` / `pendingTeleportReturns` (the queue holds Teleport-on-discard and Soaring Flight cards) and on `PendingGiveHqHeroChoice.filter` (a present `filter` marks a free recruit, D-24627; a future filtered gain must add its own discriminant). `endOfTurnCleanup.logic.ts` untouched.
- `giveHqHeroChoice.resolve.test.ts` `makeG` gains the baseline `turnEconomy` literal (`{ attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0 }`) — fixture completion only (a real `G` always carries `turnEconomy`); no assertion changes.
- Ledger: `MOVE_EXECUTED_HANDLER_MODULES['soaring-flight'] = 'packages/game-engine/src/hero/soaringFlight.logic.ts'`; provenance rows for all three keywords → `{ wp: 'WP-782', decision: 'D-24627' }`.
- The §Card Map, verbatim.

---

## Scope (In)

- **A) Markers + data.** 17 rows in `hero-ability-markers.json`; 3 tokens in `VALID_TOKEN_PATTERN`; regenerate `data/cards/xmen.json`.
- **B) Parser + keywords.** `KEYWORD_TIMING_DEFAULTS` entry; `rules/heroKeywords.ts` (+3); `hero/heroEffects.execute.ts` (`RECRUIT_TIME_EXECUTED_KEYWORDS` +1; two handlers; `HANDLED_KEYWORDS` / `NO_MAGNITUDE_KEYWORDS` +2); the count pins.
- **C) Economy.** Two optional fields, `CarriedTurnFields`, `carryConversionFlag`, three rebuild helpers.
- **D) Placement.** `hero/soaringFlight.logic.ts` (new) + tests; `recruitHero`, `recruitOfficer`, `tacticHandlers.ts` (`gainHqHeroFree`), `giveHqHeroChoice.resolve.ts`; `types.ts` JSDoc.
- **E) Feeds.** `hero-mechanic-ledger.mjs` handler-module row, `mechanic-provenance.json`, and regenerate card-mechanics, the effect index, the hero ledger, `runtime-observed-hollows`, the `sim:coverage` baseline, and the dashboard `totalObs` pin.
- **F) Tests.** Cover:
  - every §Card Map card's built hook carries `soaring-flight` at onRecruit with no unresolved marker; the two grant hooks carry their keyword (Carry to the Air with `heroClassMatch strength`)
  - `recruitHero` of a Soaring Flight card: not in discard or deck; the queue ends with `{ playerID, cardId }`; recruit spent; HQ refilled; the note is logged
  - `recruitHero` of a plain card: zones and log byte-identical to today
  - end of turn through the `endTurn` move: the hand is 6 drawn cards plus the set-aside card last (7); the queue is empty
  - a Wall-Crawl card with a granted Soaring Flight: `toTopOfDeck: true` → `deck[0]`; omitted → set aside
  - Carry to the Air with Strength met: the next `recruitHero` sets aside and clears the flag, the second goes to discard; Strength unmet → no flag; two plays still affect one recruit; `recruitOfficer` also consumes the flag
  - Mach 10: every later `recruitHero` and `recruitOfficer` that turn sets aside; a recruit made before the play does not; the flag is gone after `resetTurnEconomy()`
  - both flags survive `addResources`, `spendRecruit` and `spendAttack` rebuilds
  - Bitter Captor forced single-eligible with a Soaring Flight X-Men Hero → set aside; a parked filtered pick → set aside; a Paibok (no filter) pick of a Soaring Flight Hero → discard
  - with a Carry to the Air grant active, a Paibok gain and a declined Dark Technology pick each leave `isNextRecruitSoaringFlight === true`
  - `consumeNextRecruitSoaringFlight`'s return value has no `isNextRecruitSoaringFlight` key (`'isNextRecruitSoaringFlight' in result === false`), asserted in `economy.logic.test.ts`
  - playing a Soaring Flight card records no hollow and changes no resource
  - a match with no Soaring Flight recruit leaves no `pendingTeleportReturns` key and neither flag
  - a Carry to the Air grant consumed by a Bitter Captor forced free recruit made during a fight (the grant is consumed and the Hero set aside on the tactic path)

## Out of Scope

- **Villain-side grants:** Shi'ar Patrol Craft (henchman) "Fight: The next Hero you recruit this turn has Soaring Flight." and Shadow-X Dark Angel "[keyword:X-Gene] [hc:instinct]: The next Hero you recruit from the HQ has Soaring Flight." They need the villain effect vocabulary; the follow-up reuses `grantSoaringFlightToNextRecruit` (Dark Angel's "from the HQ" also needs an HQ-only variant).
- **Showing set-aside cards on the board** (UIState projection + client), for Soaring Flight and Teleport alike. Named follow-up; public disposition when built (the physical game shows set-aside cards).
- **A client Wall-Crawl choice** (`toTopOfDeck` affordance). Unchanged: humans get Soaring Flight on a card that has both.
- **Gains are not recruits:** Paibok's give, `gainOfficerToHand`, "Gain this as a Hero", heroic bystanders, Switcheroo (v23 ~L2015-2017).
- **Other next-recruit destination effects** ("The next Hero you recruit this turn goes on top of your deck", Backflip, Silent Meditation, Excessive Kindness). None is implemented; D-24627 records that they join `placeRecruitedHero` and that the player chooses when two apply.
- Renaming `pendingTeleportReturns`; pre-planning (`packages/preplan`) awareness; a notable-event SFX.
- **Parallel work on the same files.** WP-781 (Lightshow, in flight) edits other lines of the same Aurora & Northstar cards and the same keyword pins. Open PRs #2444 (D-24622), #2447 (D-24614) and #2479 (D-24628) regenerate `runtime-observed-hollows.json`, the coverage baseline and/or the dashboard `totalObs` pin. No design overlap (#2447 keeps handler-less recruit-time keywords `applied`; the grant keywords are no-magnitude); whichever lands second rebases, re-reads the pins, and regenerates the feeds.

## Files Expected to Change

- `packages/game-engine/src/hero/soaringFlight.logic.ts` + `soaringFlight.logic.test.ts` — **new** (placement helper + the §F behavior tests)
- `packages/game-engine/src/setup/heroAbility.setup.ts` — modified (`KEYWORD_TIMING_DEFAULTS` entry)
- `packages/game-engine/src/rules/heroKeywords.ts`, `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts` — modified (+3 keywords; the three `HERO_KEYWORDS` pins; a parse test per §F bullet 1)
- `packages/game-engine/src/hero/heroEffects.execute.ts`, `hero/heroEffects.execute.test.ts` — modified (recruit-time set, two handlers, lockstep sets, handler pins)
- `packages/game-engine/src/economy/economy.types.ts`, `economy/economy.logic.ts`, `economy/economy.logic.test.ts` — modified (flags, carry, three helpers)
- `packages/game-engine/src/moves/recruitHero.ts`, `moves/recruitHero.test.ts`, `moves/recruitOfficer.ts`, `moves/recruitOfficer.test.ts` — modified (placement call + note)
- `packages/game-engine/src/rules/tacticHandlers.ts`, `rules/tacticHandlers.test.ts`, `moves/giveHqHeroChoice.resolve.ts`, `moves/giveHqHeroChoice.resolve.test.ts` — modified (01.5 recruit-path wiring; `makeG` fixture completion)
- `packages/game-engine/src/types.ts` — modified (JSDoc only: the set-aside queue and `PendingGiveHqHeroChoice.filter`)
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/convert-cards/apply-hero-ability-markers.mjs` — modified (17 rows; 3 tokens)
- `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json` — modified
- `data/cards/xmen.json`, `data/metadata/card-mechanics.json`, `data/metadata/effect-implementation-index.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json`, `apps/dashboard/src/data/*` mirrors the generators write, `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` pin — regenerated / re-pinned
- Conditional: a pinned replay oracle whose board holds xmen heroes (re-pin citing D-24627); `docs/ai/post-mortems/01.6-WP-782-soaring-flight.md` if a `01.6` trigger fires
- Governance: `docs/ai/DECISIONS.md` (D-24627), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

About 25 authored files plus regenerated feeds. Over half are tests, lockstep pins, or generator output. The new logic is one ~60-line helper file, two ~15-line handlers and three economy helpers. The recruit-site edits are one-line swaps; splitting them across packets would ship a Soaring Flight that works on one recruit path and silently not on another.

## Contract

- The Locked Values.
- `placeRecruitedHero` is the single authority for where a recruited card goes. Every recruit path calls it; gain paths never do.
- `cardHasSoaringFlight` is the single native-Soaring-Flight read.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §2 (card content semantics), §22 / §24 (replay determinism; PAR / leaderboard inputs — Soaring Flight changes hand composition on xmen boards), NG-1 (no pay-to-win; untouched).
**Conflict assertion:** No conflict: this WP preserves all touched clauses.
**Non-Goal proximity:** none of NG-1..7 crossed — no paid, persuasive or cosmetic surface.
**Determinism:** deterministic and replay-faithful; no new randomness; lazily-omitted state keeps non-Soaring-Flight `G` unchanged; the pre-WP xmen replay note is recorded in D-24627.

## Funding Surface Gate

§20 **N/A** — engine rules executor and card-data markers only; no UI surface, no user-visible funding copy, no funding channel.

## API Catalog

§21 **N/A** — no HTTP endpoint added or changed and no `apps/server/src/**` library function touched; recruit moves are boardgame.io moves, not catalog rows.

---

## Acceptance Criteria

1. For every §Card Map card, the `buildHeroAbilityHooks` hook for abilityIndex 0 has `keywords` containing `soaring-flight`, `timing: 'onRecruit'`, and no `unresolvedMarkers`. Carry to the Air's grant hook carries `grant-soaring-flight-next` and a `heroClassMatch strength` condition; Mach 10's carries `grant-soaring-flight-all` at `onPlay`. No xmen hero hook records `soaring-flight` in `unresolvedMarkers`.
2. `recruitHero` of a Soaring Flight card leaves it out of `discard` and `deck`, appends `{ playerID, cardId }` to `G.pendingTeleportReturns`, spends its cost, refills the HQ slot, sets `hasActedThisTurn`, and logs the ` (Soaring Flight: set aside until end of turn)` note. A plain recruit's zones and log line are byte-identical to `8a174e23`.
3. After `endTurn`, the recruiter's hand holds `HAND_SIZE` drawn cards plus the set-aside card as the last entry, and `G.pendingTeleportReturns` is empty.
4. A Wall-Crawl card with a granted Soaring Flight goes to `deck[0]` with `toTopOfDeck: true` and is set aside without it.
5. With Carry to the Air's Strength gate met, the next recruit (`recruitHero` or `recruitOfficer`) is set aside and the `isNextRecruitSoaringFlight` key is absent from `G.turnEconomy`; the recruit after it goes to discard. Gate unmet → flag never set. Two plays → one recruit affected.
6. After Mach 10, every later `recruitHero` / `recruitOfficer` that turn is set aside; earlier recruits are not; `resetTurnEconomy()` clears it.
7. Both flags survive `addResources`, `spendRecruit` and `spendAttack`.
8. A free recruit through Bitter Captor / Dark Technology (forced or parked pick) of a Soaring Flight Hero is set aside; a Paibok give of one goes to discard. A Paibok gain or a declined Dark Technology pick leaves an active `isNextRecruitSoaringFlight` grant in place.
9. Playing a Soaring Flight card records no hollow and changes no resource. `runtime-observed-hollows.json` has no `soaring-flight` row, and the `sim:coverage` baseline has no `soaring-flight` entry.
10. A match with no Soaring Flight recruit creates neither flag nor the `pendingTeleportReturns` key. Sentinel `finalStateHash` and `PRE_WP080_HASH` are unchanged, or the oracle rule in the constraints is followed.
11. `cards:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`, `sim:runtime-observed:check` and `sim:coverage --check` exit 0; a second `apply-hero-ability-markers.mjs` run reports 0 updates.
12. `pnpm -r build` → 0 and `pnpm -r --no-bail test` → 0 fail, with `HERO_KEYWORDS` +3 and `HERO_EFFECT_HANDLERS` +2 against the execution-time baseline.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → reports 17 xmen updates; a second run → 0 updates.
3. `pnpm -r build && pnpm mechanics:metadata && pnpm effect-index && pnpm ledger:heroes && pnpm sim:runtime-observed && pnpm sim:coverage --update-baseline` (confirm no set's `executable` fell before accepting the baseline; xmen sweep cells now play 7-card hands and change path — confirm every cell still reaches a terminal state), then `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → all exit 0.
4. `pnpm --filter @legendary-arena/game-engine test` → 0 fail.
5. `pnpm -r --no-bail test` → 0 fail (dashboard `totalObs` re-pinned; re-run once after the first re-pin, since `percentResolved` can move too).
6. `git diff --name-only` ⊆ Files Expected to Change. Revert `packages/lagn-spec/schemas/lagn-v1.json` line-ending churn.

## Definition of Done

- [ ] All acceptance criteria pass.
- [ ] No files outside §Files Expected to Change were modified (`git diff --name-only`).
- [ ] `docs/ai/DECISIONS.md` — D-24627 Active: `pendingTeleportReturns` reuse; engine-only visibility posture; the recruit paths that apply it and the gain paths that do not; the Wall-Crawl choice via `toTopOfDeck`; the two grant flags and next-recruit consumption; the narrow-mock missing-zones return and the `makeG` fixture completion; that Wall-Crawl is not strictly worse (a player may want the card on the deck to draw it later the same turn), so humans lose that choice on a granted Wall-Crawl card until a client `toTopOfDeck` affordance exists; the villain-grant follow-up; the oracle re-pin rule and the replay / D-24119 note.
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; mindmap `✅`; `pnpm roadmap:counts:check` → 0.
- [ ] Two-commit topology (`EC-819:` then `SPEC:`).
- [ ] **D-24026 live-verify (post-merge):** in a match with Cannonball, recruit Kinetic Blast Field; the log shows the Soaring Flight note, and the next turn opens with 7 cards including it. Then play Carry to the Air with a Strength Hero and recruit a non-Soaring-Flight Hero; it also opens the next hand. Recorded as a STATUS flip.

## Reserved Decision (lands at execution)

**D-24627 — soaring-flight.** Locks everything listed in the DoD DECISIONS item.

---

## Lint Gate Self-Review (00.3)

- §1 Structure: every required section present and non-empty; Out of Scope names seven related exclusions; 12 ACs.
- §2 Constraints: engine-wide block verbatim (full files, no diffs, ESM / Node 22, 00.6); packet-specific bullets; session protocol; Locked Values section.
- §3 Assumes: 11 items with file:line anchors, verified on `8a174e23`; the reserve PR is named.
- §4 Context: rules v23 lines, ARCHITECTURE sections, rules files, 00.2 §1.2 / §5 (card data), D-entries, 01.5, memory references.
- §5 Output: every file listed new / modified / regenerated with its change; the ~25-file count justified in-section.
- §6 Naming: `placeRecruitedHero`, `RecruitPlacement`, `cardHasSoaringFlight`, `isNextRecruitSoaringFlight`, `isEveryRecruitSoaringFlight` (booleans start with `is`), `grant-soaring-flight-*`; `ext_id` / setup fields untouched.
- §7 Dependencies: no new npm package; every listed WP is Done; #2476 is ledger-only.
- §8 Architecture: all logic engine-side; `hero/soaringFlight.logic.ts` has no boardgame.io or `moves/` import (it mutates the `G` draft it is handed, like the economy and zone helpers); no server, client or persistence change; zones and queue hold `CardExtId` only.
- §9 Windows: pnpm / node commands only.
- §10 Env vars: N/A — no environment variable read or added.
- §11 Auth: N/A — in-match move behavior; seat authority unchanged.
- §12 Tests: `node:test`, `.test.ts`, `makeMockCtx`, no `boardgame.io/testing`, no network or DB; negative cases (plain recruit byte-identical, gate unmet, Paibok gain, earlier recruit, flag reset) are locked.
- §13 Verification: exact commands with expected exits.
- §14 ACs: 12, binary, file / value specific.
- §15 DoD: STATUS, DECISIONS (D-24627), WORK_INDEX, EC_INDEX, mindmap, scope check, two-commit topology; §15.1 live-verify present (surface `play.legendary-arena.com`).
- §16 Code style: 00.6 cited; the placement helper has 4 call sites (§16.1); `if/else` placement order; each function ≤30 lines with JSDoc; `// why:` sites listed in the EC.
- §17 Vision: triggered (card semantics, replay, PAR); block present with clauses and the determinism line.
- §18 Prose-vs-grep: N/A — no literal forbidden-token grep in Verification.
- §19 Bridge staleness: baseline `8a174e23` cited; re-checked against `origin/main` at commit time.
- §20 Funding: N/A with reason. §21 API catalog: N/A with reason.

## Gate Record

**Pre-flight (01.4), independent subagent, 2026-09-27: READY TO EXECUTE**, conditional on two blocking fixes. Both are applied here and neither changes scope.
- The design was verified against the code:
  - Every recruit path is covered. `spendRecruit` is called only by `recruitHero`, `recruitOfficer` and `exorciseHauntedHero`, and the last is not a recruit.
  - Every other HQ or officer-pile write is a gain or a KO.
  - `pendingTeleportReturns` is drained after the new-hand fill at all six turn-end call sites, and nothing else projects it.
  - The marker parse was probed on the real registry.
  - No pinned oracle holds xmen Soaring Flight heroes.
  - Baseline for the 10 affected test files: 454/454.
- **PS-1:** the `setup/heroAbility.setup.test.ts:~1430` `HERO_KEYWORDS` pin was missing from the allowlist. It is now added.
- **PS-2:** `consumeNextRecruitSoaringFlight` would have been a no-op, because a plain `carryConversionFlag` spread carries the flag back. It is now locked as delete-from-local-then-spread.
- **RS-1..RS-6 applied:**
  - `gainHqHeroFree` returns `{ heroId, placement }`.
  - Narrow-mock missing-zones note.
  - "match with no Soaring Flight recruit" wording.
  - Parallel-PR overlap note (#2444 / #2447 / #2479 / WP-781).
  - Sweep terminal-state check on regen.
  - Carry to the Air + Bitter Captor test.

**Copilot (01.7), first pass: RISK → HOLD.** Five scope-neutral findings, all fixed:
1. The `giveHqHeroChoice.resolve.test.ts` `makeG` has no `turnEconomy`, which would throw. Locked as fixture completion.
2. The "pure file" wording is corrected; `placeRecruitedHero` mutates the draft.
3. The `filter` = free-recruit convention is now documented in the `types.ts` JSDoc.
4. Added negative tests: a gain or a declined pick leaves the grant; the consume leaves the key absent.
5. WP §Locked Values is now the superset, and the EC copies it verbatim.

It also asked that D-24627 record that Wall-Crawl is not strictly worse than Soaring Flight.

**Copilot re-run: PASS → CONFIRM** (2026-09-27). No residual findings. The pre-flight verdict stands.

**00.3 lint:** all 21 sections resolved (above). Re-confirmed after the gate edits.
