# WP-897 — The Ambush overlay names keyword-less Ambush effects instead of "entered the city with no Ambush effect" (Game Engine)

**Status:** Draft 2026-11-15 (EC-935; D-24854 reserved (#3397)). Gates: pre-flight READY TO EXECUTE (round 2); copilot PASS (round 2); lint PASS (re-run).
**Layer:** Game Engine (the villain-ability executor's per-dispatch narrative clause, the Ambush narrative composer, the Ambush fire site)
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — the hashed `notableEvents` narrative changes for every match that reveals one of about 25 Ambush cards; no gameplay rule, new `G` write (the existing `ambushResolved` push carries a different narrative), card data, client, server, auth, money or persistence change
**Hard-deps:** WP-319 / D-24105 (the target-naming Ambush narrative) ✅, WP-838 / D-24771 (Kidnappers' and Venom's capture primitives) ✅, WP-889 / D-24841 (the Hunt for Victims clause this WP folds in) ✅, WP-837 / D-24770 (The Leader's reveal-gated play, the trait-discard primitives) ✅, WP-877 / D-24824 (`DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`) ✅

## Goal

When a Villain whose Ambush has no legacy keyword enters the City, the center-screen Ambush overlay says what the Ambush did. Today it reads `"<card>" entered the city with no Ambush effect.` even though the effect resolved; only the durable log is right. After this WP:

- HYDRA Kidnappers reads `"HYDRA Kidnappers" ambushed: captured S.H.I.E.L.D. Officer from the S.H.I.E.L.D. Officer Deck.`
- Venom reads `"Venom" ambushed: captured <Sidekick> from the Sidekick Deck; captured <names> from the HQ (cost 2 or less).`
- Every other keyword-less Ambush in the card data (the list in `## Context`) names its outcome the same way, in the words of its own log line.
- `entered the city with no Ambush effect` is said only when no Ambush descriptor ran.

## User-Visible Impact

`play.legendary-arena.com`: the Ambush overlay (`NotableEventOverlay.vue`, which renders `ambushResolved.narrative` as-is) stops contradicting the log for about 25 Villains across 15 clause-setting primitives. The badges (`appliedEffects`) and every log line are unchanged. Live-on-surface is checked per D-24026 on a match created after the deploy.

## Assumes

- **Baseline:** `origin/main` at `aa0aedde` (the reserve PR #3397 merged), re-recorded at commit.
- **Executor** (`packages/game-engine/src/villain/villainEffects.execute.ts`):
  - `executeVillainAbilities(G, ctx, cardId, timing, shuffleContext?, cityIndex?)` (~195-348) loops hooks × descriptors: location gate (~254), condition gate (~267), then `applyVillainEffect` (~5632). It records a `VillainEffectResult` **only** when `descriptorToLegacyKeyword(descriptor)` resolves (~282-310); a keyword-less handler's application is dropped. A `null` application is the hollow branch (~311-318); every dispatch also records an `EffectTrace` (~324).
  - `interface VillainEffectApplication` (~1070-1084, module-private): `targets`, `pending?`, `targetsByPlayer?`, `targetZones?`, `woundOutcomes?`, `greyFilter?`.
  - `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (~881): `become-scheme-twist`, `gain-attached-hero`, `play-villain-deck-cards`, `reenter-sewers-if-villain-deck-top`, `stack-cards-enter-city-as-villains`, `gain-one-attached-hero-rest-to-bottom`.
  - `villainEffectTimingLabel(timing)` (~2224): `onAmbush` → `Ambush`.
  - Keyword-less handlers self-narrate with `pushLog(G, \`${label} effect: <clause>.\`, outcome)` and return `{ targets: [] }` (handler line anchors in `## Context`).
  - Callers of `executeVillainAbilities`: the Ambush site (`villainDeck/villainDeck.reveal.ts` ~388), the Escape site (~770), the Fight sites (`moves/fightVillain.ts` ~715 and ~1125), `moves/fortifyFight.ts` ~166.
- **Legacy reverse map** (`rules/villainAbility.types.ts` ~952-994): `descriptorKey` = `primitive|target|magnitude|selector` (zone and condition excluded), so `ko-hero:each:2:discard` (core Juggernaut), co2e Destroyer and Scorpion's `gain-wound:each!another-group-villain-in-city` resolve to legacy keywords and already narrate. The JSDoc at ~982-986 says "descriptor-keyed narrative labels are deferred to WP-253"; WP-253 shipped as the Hero Reveal collapse (D-24024) without narration, so that deferral is orphaned.
- **Composer** (`events/notableEvents.compose.ts` ~445-482): `composeAmbushNarrative(cardName, effectResults, villainDeckPlayCount = 0, stackVillainClause?, huntForVictimsClause?)` joins, in order, the keyword-result clause (`composeEffectResultLogLine`), The Leader's play clause (D-24703), the stack-entry clause (WP-869 / D-24814) and the hunt clause (WP-889 / D-24841) with `; `; with none it returns `"<card>" entered the city with no Ambush effect.` (~478-480).
- **Fire site** (`villainDeck/villainDeck.reveal.ts` ~376-480): runs the executor (~388), maps `appliedEffects` from results (~393), pushes the `Ambush effect:` log line only when results exist (~414-422), reads The Leader's play count (~430), the stack entry (~441-456) and `villainAmbushHuntsForVictims(G, cardId)` (~461-464, from `moves/huntForVictims.logic.ts` ~877, its only caller), then pushes `ambushResolved` with `composeAmbushNarrative(…)` (~465-480).
- **Hunt handler** `villainEffectHuntForVictims(G, currentPlayer, cardId)` (`villainEffects.execute.ts` ~5509) calls `huntForVictimsForVillain` and returns `{ targets: [] }`. Blackout's Ambush has two descriptors, the second with `requireCondition: 'moonlight'`.
- **The Leader's handler** `villainEffectPlayVillainDeckCards` (~2002-2020) logs `Ambush effect: Player <p> revealed a <trait> Hero, so no card is played from the Villain Deck.` when the current player reveals; otherwise it logs nothing (the fire site plays and narrates).
- **Demolish:** `villainEffectDemolishEachPlayer` (~5213) calls `demolishEachPlayer(G, currentPlayer, 'Ambush effect:')` (`board/demolish.logic.ts` ~51), which logs `<prefix> Demolish revealed <name> (cost <c>) and put it on the bottom of the Hero Deck.` then one line per player, and returns `DemolishResult { revealedCardId, cost, discards }`. `discards` lists only the seats that discarded; a seat with no card of that cost is logged (`<prefix> Player <p> has no card that costs <c> to discard.`, ~119) and skipped. The resolver walks seats with `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)` (`turn/seatOrder.logic.ts` ~33) and names cards with `resolveCardName(G.cardDisplayData, …)` (`log/logDisplay.ts` ~29). Its two early returns log `<prefix> the Hero Deck is empty, so nothing is Demolished.` (~61) and `<prefix> Demolish revealed <name> and put it on the bottom of the Hero Deck, but it has no cost, so no one discards.` (~71-75).
- **Reveal-or-wound** (~2500-2632) logs at most one outcome line, and when any player can reveal, `queueVillainRevealOrWoundChoice` (~2633+) logs `<label> effect: <players> can reveal a matching <trait> Hero and will choose whether to reveal it or gain a Wound.`
- **Hashing:** `G.notableEvents` is hashed (its `narrative` included); `G.messages` is excluded from `hashGameState` (D-24081) but included in `computeStateHash` (`replay/replay.hash.ts` ~73-74, the D-24119 `replay_hash`); this WP keeps it byte-identical. The core sentinel (`test/fixtures/games/sentinel-core-doom-2p.replay.json`) uses `core/brotherhood` + `core/savage-land-mutates`, neither with a keyword-less Ambush; `PRE_WP080_HASH` (`replay/replay.execute.test.ts` ~188) is a `moves: []` replay; the other hash-pinning tests use test groups, `core/brotherhood` or `core/hydra` (no keyword-less Ambush).
- **Replay verification (D-24119):** `apps/server/src/replay/matchCapture.logic.ts` stores `replay_hash` = the capture-time `stateHash`; the competition verifier (`apps/server/src/competition/competition.logic.ts` ~833) and the gameover sweep (`matchCapture.logic.ts` ~261) re-reduce on today's engine and fail closed / store "unknown" on a mismatch.
- **Client:** `apps/arena-client/src/components/play/NotableEventOverlay.vue` renders `narrative` verbatim; no client change.
- **Prior WPs complete:** the header Hard-deps, all `[x]` in WORK_INDEX.

## Context (Read First)

- **Why now.** WP-838's live-verify (autoplay `9L2FBYe3ifK`, server `3cc2c042`) showed Kidnappers' and Venom's overlays reading "no Ambush effect" while the log narrated the captures. `docs/ai/STATUS.md` L21 and L776 record the gap and point at "WP-253", which never did it (WP-252 §111 deferred it; WP-253 became D-24024). No WP covered it and no PR was open (checked at draft).
- **Root cause.** The executor records results only through the 10-keyword legacy reverse map, frozen by D-24023. Every keyword-less primitive (all but the five primitives behind the 10 legacy keywords, of 57) self-narrates and is dropped from `results`, so `composeAmbushNarrative` sees nothing. Three ad-hoc fixes added one clause each (D-24703 Leader play, WP-869 stack entry, WP-889 hunt); this would be the fourth. `.claude/rules/code-style.md` "abstract only when a third copy appears" applies, so this WP adds one general path.
- **Design (locked; alternatives rejected):**
  - **Handler-supplied clause (B).** A keyword-less handler reports, on its application, the clause it just logged. Each handler already composes that text, so the overlay and the log say the same thing. The executor returns the clauses beside `results` in a parallel channel; `VillainEffectResult.keyword` and `appliedEffects` stay the frozen keyword array (D-24023).
  - **Honest fallback (C).** A keyword-less descriptor that ran without supplying a clause (and is not a deliberate no-op) contributes `its Ambush effect resolved (see the log)` (timing label substituted). A future handler that forgets its clause degrades to an honest sentence, never to "no Ambush effect".
  - **Rejected: a `Record<VillainEffectPrimitive, …>` clause table (A).** It cannot carry target names, needs 57 entries most of which are never Ambush-timed, and duplicates the handlers' wording.
  - **Rejected: scraping `G.messages` for lines the handler pushed.** Fully general, but it couples the hashed narrative to log formatting by string parsing and misses lines a handler logs through another module; explicit beats clever (code-style §Guiding Principle).
- **Bridged effects stay where they are.** The Leader's play and the stack entry are performed by the fire site, not the executor (their handlers are deliberate no-ops), so their existing clauses (D-24703, WP-869) stay. The Hunt for Victims runs inside its handler, so WP-889's fire-site read folds into B and `villainAmbushHuntsForVictims` is deleted.
- **The keyword-less Ambush set** (data walk at `aa0aedde`: every villain group's `onAmbush` descriptors built by the real setup parser, kept where `descriptorToLegacyKeyword` is `undefined`; execution turns the walk into a test, RS-5). **16 primitives:** the 15 below set a handler clause, plus `stack-cards-enter-city-as-villains` (cvwr Agent Eric Marshall), a deliberate no-op whose fire-site WP-869 clause already narrates (unchanged, no fallback). Each primitive and the handler that sets the clause:
  - `reveal-or-wound` (`villainEffectRevealOrWound` ~2500): core Ymir; msp1 Laufey; amwp Yellowjacket Prototype, City Defense System; bkwd Blue Talon; co2e Sabretooth; rvlt Dark Wolverine (Daken); wtif Captain Marvel, End of the Party.
  - `capture-pile-hero` (~6206): co2e HYDRA Kidnappers, Venom. `capture-hq-heroes-cost-lte` (~6262): co2e Venom.
  - `capture-bystander-each-victory-pile` (~6126): co2e Enchantress (after its legacy `captureBystander`).
  - `capture-bystanders-plus-per-hq-hero-by-trait` (~4460): co2e Baron Zemo. `swap-two-city-villains` (~4819): co2e Whirlwind.
  - `discard-hero-each-player-by-trait` (~3294) and `discard-hero-or-wound-each-player-by-trait` (~3309), both through `recordOwedTraitDiscard` (~3330): co2e Mystique, Frost Giant Warrior.
  - `discard-hand-matching-hq-card-names-each-player` (~3420) and `hq-heroes-to-hero-deck-bottom` (~3728): co2e Juggernaut.
  - `demolish-each-player` (~5213): chmp Trull the Unhuman (after its legacy `captureBystander`).
  - `haunt-hq-hero` (~4875): mdns Metarchus, Atrocity, Patriarch. `hq-heroes-cost-change` (~3506): msis The Mind Stone.
  - `villain-hunt-for-victims` (~5509): mdns Skinner, Meatmarket, Blackout (twice under Moonlight). Its handler takes only `(G, currentPlayer, cardId)` today; it gains the `timing, descriptor` parameters the dispatcher already passes (~5654).
  - `play-villain-deck-cards` (~2002), revealed branch only: co2e The Leader (core The Leader's play is unconditional and already narrated).
- **Clause order.** Keyword-result clauses first, then keyword-less clauses in dispatch order, then the Leader play and stack clauses. The two mixed cards (Trull, Enchantress) list the legacy marker first, so this equals printed order for every card today.
- **Fight and Escape stay out.** `composeFightNarrative` omits keyword-less outcomes (`Fought "Venom".`) but claims nothing false, and the Escape site has no narrative. The executor's clause channel is timing-agnostic, so a follow-up can wire the Fight site; it needs clauses on the Fight-timed keyword-less handlers. Named in D-24854.
- **Drafted WPs that add Ambush primitives** (WP-839 co2e Ymir, WP-840 The Blob, WP-874 The Wrecker): whichever lands second sets `narrativeClause` on its new handler; until then the fallback (C) reads honestly. WP-839 / EC-877 locks a fourth composer argument `fireSiteClauses` and WP-874 / EC-912 a fifth `chargeClause`; both are already stale against WP-889's fifth parameter. Forward rule (D-24854): a new fire-site (bridged) clause is a new trailing parameter after `descriptorClauses`, ordered after the stack clause; a handler-run effect uses `narrativeClause`, never a new parameter. WP-874's "the Wrecker overlay still reads no Ambush effect" stops holding once this lands.
- **Hash and replay.** `notableEvents` is hashed, so `finalStateHash` changes for any match that reveals one of the listed cards. No committed oracle does (see `## Assumes`); the execution suite run is the proof. Capture re-reduces `initialState + log` on the engine running at capture time (`apps/server/src/replay/matchCapture.logic.ts` ~103-109), so a match in flight across the deploy is self-consistent. The exposure is pre-deploy `bgio.replay_artifacts` rows that revealed a listed card: re-reduced on the new engine they no longer reproduce their stored `replay_hash` under D-24119, so a competitive or gauntlet submission captured before the deploy and submitted after it fails closed `replay_verification_failed` (`competition.logic.ts` ~833), and the gameover sweep stores "unknown". Core Ymir puts core Enemies of Asgard (in the gauntlet base villain pool, `data/gauntlet-configs.json` ~20) in that set. Accepted: the capture-to-submit window, the WP-823 / D-24756 precedent. Recorded in D-24854.
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #1-2, §The Rule Execution Pipeline; `.claude/rules/architecture.md` §UIState Projection Integrity (no new `UIState` field here, the narrative already flows); `docs/ai/REFERENCE/00.6-code-style.md`. Scan `docs/ai/DECISIONS.md` for D-24023, D-24024, D-24081, D-24105, D-24119, D-24351, D-24673, D-24703, D-24756, D-24770, D-24771, D-24814, D-24824, D-24841 before coding.

### RS-1 — The application field and the executor channel (locked)

1. `VillainEffectApplication` gains `narrativeClause?: string` with a `// why: WP-897 / D-24854`: the clause of the line(s) the handler logged for this dispatch, without the `<Timing> effect: ` prefix and without the final period, joined with `; ` in log order. Set only with a non-empty string; never assign `undefined` or `''` (the engine compiles with `exactOptionalPropertyTypes`); omitted when the handler sets none.
2. New exported `executeVillainAbilitiesWithNarrative(G, ctx, cardId, timing, shuffleContext?, cityIndex?): VillainAbilityExecution`, where `export interface VillainAbilityExecution { results: VillainEffectResult[]; narrativeClauses: string[] }` is declared in `villainEffects.execute.ts` (not a contract file). The current loop body moves into it unchanged, except the stale comment at ~276-281 ("every dispatched descriptor came from a legacy marker") is corrected to name the narrative channel; `executeVillainAbilities` becomes a wrapper that returns `executeVillainAbilitiesWithNarrative(…).results`, so the Fight, Escape and fortify callers are byte-identical.
3. In the loop, for each descriptor whose application is non-null **and** whose `descriptorToLegacyKeyword` is `undefined`:
   - `application.narrativeClause` is a non-empty string → push it to `narrativeClauses`;
   - else, if `descriptor.primitive` is not in `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` → push `its ${villainEffectTimingLabel(timing)} effect resolved (see the log)`;
   - else nothing.
   A gated-out descriptor (location or condition gate) is never dispatched and adds nothing. A `null` application (hollow) adds nothing. A legacy-keyword descriptor adds nothing (it narrates through `results`). `results`, hollow records and traces are unchanged.

### RS-2 — Handler clauses (locked rule; strings follow from each handler's own log text)

Every handler in the `## Context` list sets `narrativeClause` on every return path that logged an `<label> effect:` line, to exactly that line's clause (RS-1 §1), applied or blocked alike. Each directly-logging handler builds `clause` once and logs exactly `` `${label} effect: ${clause}.` `` from that variable, so the overlay and log are equal by construction; Demolish is the only re-derived clause and is test-pinned. These handlers also run at Fight and Escape (reveal-or-wound, the Zzutak / Piledriver Demolish Escapes, trait-discard at Escape): every existing Fight / Escape log expectation passes unchanged. A blocked line is still what the Ambush did (`nothing was captured because the Sidekick Deck is empty`). Specific cases:

- **`capture-pile-hero`, `capture-hq-heroes-cost-lte`, `capture-bystander-each-victory-pile`, `capture-bystanders-plus-per-hq-hero-by-trait`, `swap-two-city-villains`, `haunt-hq-hero`, `hq-heroes-cost-change`, `hq-heroes-to-hero-deck-bottom`, `recordOwedTraitDiscard`:** one line per return path; the clause is that line's clause.
- **`discard-hand-matching-hq-card-names-each-player`:** one line per discarding player (or one blocked line); the clause joins them with `; ` in log order.
- **`reveal-or-wound`:** the outcome line's clause (if one was logged), then, when players were queued, the `queueVillainRevealOrWoundChoice` line's clause (`<players> can reveal a matching <trait> Hero and will choose whether to reveal it or gain a Wound`), joined with `; `. A parked choice says what is owed, not an outcome (the D-24673 wording precedent). `queueVillainRevealOrWoundChoice` returns its clause so the handler can read it.
- **`demolish-each-player`:** composed in the executor from the returned `DemolishResult` plus the same seat walk, matching the resolver's three shapes (names via `resolveCardName(G.cardDisplayData, …)`): (a) `revealedCardId === null` → `the Hero Deck is empty, so nothing is Demolished`; (b) `cost === null` → `Demolish revealed <name> and put it on the bottom of the Hero Deck, but it has no cost, so no one discards`; (c) otherwise `Demolish revealed <name> (cost <c>) and put it on the bottom of the Hero Deck`, then one clause per seat in `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)` order: `Player <p> discarded <name> (cost <c>)` when the seat is in `discards`, else `Player <p> has no card that costs <c> to discard`; all joined with `; `. `board/demolish.logic.ts` is not edited; a test asserts the clause equals the logged lines' clauses.
- **`villain-hunt-for-victims`:** (the handler gains `timing, descriptor` parameters) `it Hunts for Victims` when `descriptor.requireCondition === undefined`, `it Hunts for Victims again` when it carries one (Blackout's Moonlight repeat). The hunt module's own log lines are unchanged.
- **Malformed-descriptor returns** that log nothing (reveal-or-wound with no predicate ~2512, Baron Zemo's with no predicate ~4473, cost-change with no magnitude or direction ~3515) set no clause and so take the fallback. No parsed card produces them; accepted and stated in D-24854.
- **`play-villain-deck-cards`:** only on the revealed branch: `Player <p> revealed <a/an> <trait> Hero, so no card is played from the Villain Deck`. The unrevealed branch sets none (the fire site narrates the play; the primitive is a deliberate no-op, so no fallback either).

### RS-3 — Composer (locked)

`composeAmbushNarrative(cardName, effectResults, villainDeckPlayCount = 0, stackVillainClause?, descriptorClauses: readonly string[] = [])`. The fifth parameter replaces `huntForVictimsClause?: string`. Clause order: `composeEffectResultLogLine(effectResults)` (when non-empty), then each `descriptorClauses` entry in order, then the villain-deck play clause, then the stack clause. With no clause: `"<card>" entered the city with no Ambush effect.` (unchanged). JSDoc and `// why:` name WP-897 / D-24854 and drop the per-card hunt wording. The file header's "no optional clauses that reorder segments" stays true: the order is fixed. Moving WP-889's hunt slot from after the stack clause to before the play clause changes no output: no card combines a hunt with a Villain Deck play or a stack entry.

### RS-4 — Fire site (locked)

`performVillainReveal` calls `executeVillainAbilitiesWithNarrative(G, ctx, cardId, 'onAmbush', { random: context.random }, undefined)`, takes `results` exactly where `appliedAmbushResults` is used today, and passes `narrativeClauses` as the fifth `composeAmbushNarrative` argument. The `villainAmbushHuntsForVictims` read and its import are removed; `villainAmbushHuntsForVictims` is deleted from `moves/huntForVictims.logic.ts` (no other caller). The `Ambush effect:` log push, The Leader's play, the stack entry and every trace stay byte-identical.

### RS-5 — The data-walk test (locked)

`ambushNarrative.keywordless.test.ts` has a case that reads every `data/cards/*.json`, builds each villain group's hooks through the real setup parser (`setup/villainAbility.setup.ts`, the way `moves/villainHuntForVictims.test.ts` builds Lilin hooks from `mdns.json`), keeps `onAmbush` descriptors whose `descriptorToLegacyKeyword` is `undefined`, and asserts the primitive set equals the 16 in `## Context`. The same case asserts (a) across a card's `onAmbush` hooks in dispatch order, no keyword-less descriptor comes before a legacy-keyword descriptor (else the overlay would be out of printed order), and (b) every conditional `villain-hunt-for-victims` descriptor follows an unconditional one in the same hook (the "again" wording). It runs under `pnpm -r --no-bail test`; a mismatch is the STOP condition (a new keyword-less Ambush needs a clause first).

## Scope (In)

- RS-1..RS-4 in `villain/villainEffects.execute.ts`, `events/notableEvents.compose.ts`, `villainDeck/villainDeck.reveal.ts`, `moves/huntForVictims.logic.ts` (one function and its now-unused `getVillainHooksForCard` import deleted).
- `setup/villainAbility.setup.ts` ~1198-1202: comment only, the same "deferred to WP-253" note, corrected to name WP-897's channel.
- `rules/villainAbility.types.ts`: JSDoc only, at `descriptorToLegacyKeyword` (~982-986): replace "deferred to WP-253" with a sentence naming WP-897's narrative channel. No type or value change.
- Tests: a new `packages/game-engine/src/villain/ambushNarrative.keywordless.test.ts` (RS-5 and the AC cases); `packages/game-engine/src/events/notableEvents.compose.test.ts` (the WP-889 positional hunt call at ~717 becomes `['it Hunts for Victims']`, same expected string; new cases); `packages/game-engine/src/moves/villainHuntForVictims.test.ts` (~511, Blackout under Moonlight: expected `'"Blackout" ambushed: it Hunts for Victims; it Hunts for Victims again.'`, an intended product change).
- Governance at close: `docs/ai/STATUS.md` (a new entry; L21 and L776 "Descriptor-keyed narration is WP-253." → "Closed by WP-897 (D-24854)."), D-24854, WORK_INDEX, EC_INDEX, mindmap, NUMBER-LEDGER, `docs/ai/coverage/live-verify.json`.
- Drafting commit (this SPEC): the WORK_INDEX rows of drafted WP-839, WP-840 and WP-874 gain a note: re-run 01.4 after WP-897; composer signature and Ambush clause channel per D-24854; add the new primitive to the RS-5 set.

## Out of Scope

- The Fight and Escape narratives (named follow-up). The Escape site and Fight sites keep calling `executeVillainAbilities`.
- Any change to `appliedEffects`, `VillainEffectResult`, `EFFECT_KEYWORD_LABELS`, the legacy reverse map, any log line, any handler's mutation, card data, `UIState`, the client or the server.
- The Leader's and the stack-entry fire-site clauses (kept), and their wording.
- Clauses for keyword-less primitives no card uses at Ambush today (they get the fallback if ever marked so).
- Editing Done WPs, ECs, post-mortems or past DECISIONS entries that cite "WP-253" (append-only; D-24854 lists them).

## Files Expected to Change

- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — RS-1 field, `VillainAbilityExecution`, `executeVillainAbilitiesWithNarrative` + wrapper; RS-2 clauses on the 16 listed handlers (15 primitives plus the shared `recordOwedTraitDiscard`), `queueVillainRevealOrWoundChoice` returns its clause, the Demolish clause composer.
- `packages/game-engine/src/events/notableEvents.compose.ts` — **modified** — RS-3.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — RS-4.
- `packages/game-engine/src/moves/huntForVictims.logic.ts` — **modified** — `villainAmbushHuntsForVictims` and its unused import deleted.
- `packages/game-engine/src/setup/villainAbility.setup.ts` — **modified** — one comment (~1198-1202).
- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — JSDoc only (contract file; D-24854 records it).
- Tests: `packages/game-engine/src/villain/ambushNarrative.keywordless.test.ts` — **new**; `packages/game-engine/src/events/notableEvents.compose.test.ts`, `packages/game-engine/src/moves/villainHuntForVictims.test.ts` — **modified** (as in Scope).
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/coverage/live-verify.json`.

## Non-Negotiable Constraints

- Full file contents for every new or modified file, no diffs or snippets. ESM only; Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (functions ≤ ~30 lines: split the moved loop body into named helpers if it grows; `for` loops, no `.reduce()`, no nested ternaries).
- Determinism: no randomness, clocks or I/O; handlers and moves never throw; the composer stays pure (no `G`, no boardgame.io, no registry).
- No new npm dependency; tests use `node:test` only.
- No log line, `G` mutation beyond the `ambushResolved` narrative string, `appliedEffects` value, hollow record or trace changes; `G.messages` is byte-identical for every reveal.
- No existing assertion is weakened, skipped or deleted; the two test edits in Scope are the only changes to existing expectations.
- **Session protocol — STOP and report** if: a `finalStateHash` / `PRE_WP080_HASH` / golden / PAR pin moves (then check that the sole delta is an `ambushResolved.narrative` and re-pin only with the commit naming the intended change); a handler's clause cannot equal its logged clause; a test outside the two named needs a changed expectation; the data walk finds a keyword-less Ambush primitive not in the `## Context` list.
- **Locked values:** EC-935 `## Locked Values`.

## Contract

- `VillainEffectApplication.narrativeClause?: string` (module-private) and its meaning (RS-1 §1).
- `export interface VillainAbilityExecution { results: VillainEffectResult[]; narrativeClauses: string[] }`; `executeVillainAbilitiesWithNarrative(…)`; `executeVillainAbilities` returns its `results`.
- The fallback clause `its <Timing> effect resolved (see the log)`.
- `composeAmbushNarrative(cardName, effectResults, villainDeckPlayCount = 0, stackVillainClause?, descriptorClauses = [])` and its clause order.
- The hunt clauses `it Hunts for Victims` / `it Hunts for Victims again`.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible Evaluation).
- **No conflict:** the overlay stops contradicting the log; no rule changes.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched: narration only.
- **Determinism preservation:** the clauses are pure functions of the handler's inputs; same seed and moves give the same narrative. The hashed narrative changes for matches revealing the listed cards; no committed oracle does. Replay compatibility: pre-deploy matches that revealed such a card no longer reproduce their captured hash under D-24119 (WP-823 precedent), recorded in D-24854.

## Funding Surface Gate

N/A — engine narrative text only; no nav, profile, pricing or tournament-funding surface and no donate / support copy.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server/src/**` library function added or changed.

## Acceptance Criteria

1. Revealing HYDRA Kidnappers with Officers in supply yields `ambushResolved.narrative === '"HYDRA Kidnappers" ambushed: captured S.H.I.E.L.D. Officer from the S.H.I.E.L.D. Officer Deck.'`. The fixture seeds `G.cardDisplayData` for the villain and the Officer token so the exact string holds (the existing unit fixture logs a raw id); the lock is not loosened.
2. Revealing Venom yields `'"Venom" ambushed: captured <Sidekick name> from the Sidekick Deck; captured <names> from the HQ (cost 2 or less).'` with the fixture's names, pinned exactly.
3. For each of the 15 clause-setting primitives except the hunt (whose clause is fixed by RS-2), a reveal yields a narrative whose clause equals the clause of the `Ambush effect:` line(s) it logged (asserted against the log in the same test), including one blocked path (an empty pile), Demolish shapes (a) and (c) with a seat that has no card of the cost, and Ymir's reveal-or-wound with a queued revealer (the owed wording). The RS-5 data-walk case passes.
4. Trull and Enchantress: the keyword clause precedes the keyword-less clause.
5. A hand-built `onAmbush` hook with `draw-cards-current` (keyword-less, not in `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`, sets no clause) yields `"<card>" ambushed: its Ambush effect resolved (see the log).`, and its trace reads `fired`.
6. A gated-out descriptor contributes nothing: Blackout under Sunlight reads `"Blackout" ambushed: it Hunts for Victims.`; under Moonlight `… it Hunts for Victims; it Hunts for Victims again.`
7. The Leader (co2e) with a Strength Hero revealed reads `"The Leader" ambushed: Player <p> revealed a Strength Hero, so no card is played from the Villain Deck.`; unrevealed, its narrative is byte-identical to today (`… ambushed: plays the top card of the Villain Deck.`).
8. A card whose Ambush has no descriptor (Outcast, a plain Villain) still reads `entered the city with no Ambush effect`; legacy-keyword, Leader-play and stack-entry narratives are byte-identical; every existing `notableEvents.compose.test.ts` expectation passes except the one positional-argument update.
9. For every revealed card in the new test, the exact log lines, `appliedEffects` and trace statuses are pinned against literals equal to what `origin/main` produces (no new or changed line; `appliedEffects` keyword-only).
10. Revert proof: with `narrativeClauses` not passed to the composer, the Kidnappers and Venom tests fail showing `entered the city with no Ambush effect`.
11. `pnpm -r build`; `pnpm -r --no-bail test` 0 fail; every hash pin (sentinel, `PRE_WP080_HASH`, goldens) unchanged; `pnpm --filter @legendary-arena/arena-client typecheck` 0; `ledger:numbers:check`, `roadmap:counts:check`, `workindex:rows:check`, `workindex:executed:check` exit 0.

## Verification Steps

Run in order; each exits 0. Record the engine test count before and after.

```pwsh
pnpm -r build
pnpm -r --no-bail test
pnpm --filter @legendary-arena/arena-client typecheck
pnpm sim:runtime-observed:check
pnpm sim:coverage --check
pnpm ledger:numbers:check
pnpm roadmap:counts:check
pnpm workindex:rows:check
pnpm workindex:executed:check
git diff --name-only origin/main...HEAD   # a subset of ## Files Expected to Change
```

The data walk is the RS-5 test case, run by `pnpm -r --no-bail test`.

Live (D-24026, after deploy): guest autoplay `POST https://api.legendary-arena.com/api/match/autoplay` with `{ playerCount, policy, delayMs, setupData }` on (A) `co2e/hydra` + `co2e/sinister-spider-foes` and (B) `co2e/enemies-of-asgard` + `co2e/masters-of-evil`; read `ambushResolved.narrative` from the match state for each keyword-less Ambush revealed (Kidnappers and Venom at least), and confirm none reads "no Ambush effect". Autoplay may not reveal Kidnappers or Venom; if not, use an operator match created after the deploy with the card staged on top of the Villain Deck (Villain deck → "Move villain card to top") and reveal it.

## Definition of Done

- [ ] Acceptance Criteria 1-11 pass, with the Verification tails recorded in the `EC-935:` body.
- [ ] Hash pins byte-unchanged (or STOP per the protocol).
- [ ] **Live-on-surface (D-24026):** confirmed on a post-deploy match, or recorded operator-pending in `STATUS.md` with `pending` `live-verify.json` rows (`co2e-villain-hydra-hydra-kidnappers|ambush-narrative`, `co2e-villain-sinister-spider-foes-venom|ambush-narrative`, `kind: "villain"`).
- [ ] `docs/ai/STATUS.md` entry plus the L21 / L776 edits; D-24854 → Active; WORK_INDEX `[x]` with its live-verify token; EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write`; NUMBER-LEDGER LANDED.
- [ ] 01.6 post-mortem evaluated (expected trigger: a new executor return channel; author it in the execution session).
- [ ] No files outside `## Files Expected to Change` modified.

## Reserved Decision (lands at execution)

D-24854 — Keyword-less villain-ability descriptors narrate through a handler-supplied clause:

- **Channel:** `VillainEffectApplication.narrativeClause` = the clause the handler logged; `executeVillainAbilitiesWithNarrative` returns `narrativeClauses` beside `results`; `appliedEffects` stays the frozen keyword array (D-24023).
- **Fallback:** a keyword-less, non-no-op descriptor that ran without a clause narrates `its <Timing> effect resolved (see the log)`; "no Ambush effect" means no descriptor ran.
- **Forward rule:** every new keyword-less handler sets `narrativeClause` (WP-839, WP-840, WP-874 when they execute); a new fire-site (bridged) clause is a trailing composer parameter after `descriptorClauses`, ordered after the stack clause.
- **Accepted residual:** malformed-descriptor returns that log nothing take the fallback; no parsed card reaches them.
- **Folds WP-889's hunt clause** into the channel (`villainAmbushHuntsForVictims` deleted); the D-24703 Leader-play and WP-869 stack clauses stay at the fire site (bridged work).
- **Orphaned deferral:** WP-252 deferred descriptor-keyed narration to WP-253, which shipped as D-24024 without it. Still cited in Done docs (WP-837 §173, WP-838 §186, WP-447 §148, EC-482 L42/L60, the WP-837 / WP-838 post-mortems, D-24770 §10); left as written (append-only), superseded here. Draft WP-840 §169 also cites it; it is amended when WP-840 is re-gated (below).
- **Drafted composer editors:** WP-839 / EC-877 (`fireSiteClauses`), WP-874 / EC-912 (`chargeClause`, and its EC's expected "no Ambush effect" Wrecker outcome) and WP-840 re-run 01.4 after this lands, follow the forward rule, and add their new primitive to the RS-5 set (adding `villain/ambushNarrative.keywordless.test.ts` to their allowlists). Their WORK_INDEX rows carry that note from this WP's drafting commit.
- **Hunt "again":** the word is keyed to `requireCondition`, valid because every conditional `villain-hunt-for-victims` descriptor follows an unconditional one in the same hook (Blackout); RS-5 asserts it.
- **Hash / replay:** `finalStateHash` changes for matches revealing a listed card; no committed oracle does. Capture re-reduces `initialState + log` on the engine running at capture time (`apps/server/src/replay/matchCapture.logic.ts` ~103-109), so a match in flight across the deploy is self-consistent. The exposure is pre-deploy `bgio.replay_artifacts` rows that revealed a listed card: re-reduced on the new engine they no longer reproduce their stored `replay_hash` under D-24119, so a competitive or gauntlet submission captured before the deploy and submitted after it fails closed `replay_verification_failed` (`competition.logic.ts` ~833), and the gameover sweep stores "unknown". Core Ymir puts core Enemies of Asgard (in the gauntlet base villain pool, `data/gauntlet-configs.json` ~20) in that set. Accepted: the capture-to-submit window, the WP-823 / D-24756 precedent.
- **Follow-up:** the Fight narrative (`composeFightNarrative`) via the same channel.

## Gate Record

Each gate ran as an independent subagent against the files at HEAD `aa0aedde` (after reserve PR #3397 merged).

- **01.4 pre-flight — READY TO EXECUTE** (round 2, a delta re-check):
  - Round 1 NOT READY, two PS:
    - the data walk finds 16 keyword-less Ambush primitives, not 15 (cvwr Agent Eric Marshall's bridged stack entry; now named in `## Context`);
    - the Demolish clause could not be rebuilt from `DemolishResult` alone (seats with no discard are not in `discards`; two early returns); now RS-2's three shapes with the seat walk.
    Plus eight RS items, all applied: the hunt is exempt from AC 3 and gains its parameters; `G.messages` is in `computeStateHash`; the malformed-descriptor residual; fixture display data; the composer forward rule; the stale comments (`setup/villainAbility.setup.ts` added, comment only); AC 9 pinned against literals; the unused import.
  - Round 2 READY, with one EC guardrail wording fix and one optional rewording, both applied.
- **01.7 copilot check — PASS** (round 2, CONFIRM):
  - Round 1 RISK → HOLD, seven findings, all applied:
    - #30 / #20: drafted WP-839 / WP-840 / WP-874 lock contradicting composer signatures. Their WORK_INDEX rows now carry a re-gate note, and D-24854 names them; WP-840 §169 was moved out of the Done list.
    - #23: RS-5 asserts keyword-before-keyword-less order across a card's hooks; the hunt-slot move changes no output.
    - #26: the "again" wording is coupled to `requireCondition`; RS-5 asserts the hunt order.
    - #11: each clause is built once and logged from the variable; Fight / Escape logs are unchanged.
    - #28: the replay text is corrected. In-flight matches are self-consistent; pre-deploy artifacts (including core Enemies of Asgard in the gauntlet pool) fail D-24119 verification, accepted.
    - #5 / #22: `exactOptionalPropertyTypes` handling; AC 5 names `draw-cards-current` and a `fired` trace.
    - #30: this record.
  - Round 2 PASS; its optional "across a card's hooks" tightening was applied.
- **00.3 lint — PASS** (round 2, then re-confirmed on the final text): round 1 failed §3 (the Demolish shape) and §13 (the data walk was prose, now the RS-5 test); advisories applied.

## Lint Gate Self-Review (00.3)

- §1 Structure: PASS — every required section is present. Out of Scope names five exclusions: Fight / Escape narratives; logs, `appliedEffects` and the reverse map; the bridged clauses' wording; clauses for unused primitives; editing Done docs.
- §2 Constraints: PASS — full files, ESM, Node v22+, `00.6`, `node:test` only with no new dependency, determinism and byte-identity rules, a four-trigger STOP protocol; locked values in EC-935.
- §3 Assumes: PASS — baseline `aa0aedde`; every executor, composer, fire-site, Demolish, seat-walk, hashing and replay anchor is cited with file and line; dependencies are ✅.
- §4 Context: PASS — ARCHITECTURE §Principles #1-2 and §Rule Execution Pipeline; rules §UIState; `00.6`; a DECISIONS scan list. RS-1..RS-5 are locked, and the rejected designs are given with reasons.
- §5 Files: PASS — 9 engine files (6 source, 3 test) plus governance, each marked new / modified with its role; it matches EC Files to Produce.
- §6 Naming: PASS — full-word names (`narrativeClause`, `executeVillainAbilitiesWithNarrative`, `descriptorClauses`); no `00.2` field touched.
- §7 Dependencies: PASS — none added.
- §8 Boundaries: PASS — engine only. The composer stays pure; no client, server or registry edit.
- §9 Windows: PASS — `pnpm` / `node` / `git` only.
- §10 Env vars: N/A — none.
- §11 Auth: N/A — no auth surface (the live check uses guest autoplay).
- §12 Tests: PASS — `node:test` `.test.ts`, the real parser over `data/cards`, the real reveal path, and a revert proof.
- §13 Verification: PASS — exact build / test / typecheck / `:check` commands; the data walk is a test.
- §14 Acceptance Criteria: PASS — 11 binary criteria with pinned strings.
- §15 Definition of Done: PASS — STATUS (including the L21 / L776 edits), DECISIONS, WORK_INDEX, EC_INDEX, mindmap, NUMBER-LEDGER, the scope check, the D-24026 live item (§15.1); the Risk Tier is verbatim in the EC (§15.2).
- §16 Code style: PASS — `00.6` cited; ≤30-line split; `for` loops, no `.reduce()` and no nested ternaries; clause built once; `// why:` sites listed in the EC.
- §17 Vision: PASS — §1, §8, §10 and §22; no-conflict, NG-1, determinism and replay lines.
- §18 Prose-vs-grep: N/A — no literal grep step.
- §19 Bridge staleness: N/A — the baseline is re-recorded at commit.
- §20 Funding: PASS (N/A with reason).
- §21 API catalog: PASS (N/A with reason).
- **EC-935:** under the 100-line ceiling; Risk Tier verbatim; Locked Values match the WP's RS text.
- **Overall:** PASS.
