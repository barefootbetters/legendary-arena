# WP-870 — Mandarin's Rings own-deck Fight lines: Lightning (and Daystar) reveal your deck top and may KO it, Spin discards the 0-cost cards from your top six and reorders the rest, Zero adds a 0-cost card you played to your next hand (Game Engine + card data)

**Status:** Draft 2026-11-06 — pre-flight (01.4) READY TO EXECUTE (round 4, after PS-1..4); copilot (01.7) RISK → CONFIRM (round 3); lint (00.3) FAIL → PASS (run 3). See §Gate Record. EC-908; **D-24815** reserved (#3196).
**Primary Layer:** Game Engine (+ card data and card-data-derived feeds)
**Dependencies:** none open. Builds on WP-754 / D-24581 (the `reveal-top-may-ko` KO-or-keep entry on the WP-702 / D-24521 `G.pendingRevealTopDispose` queue and its `resolveRevealTopDispose` move), WP-479 / D-24286 (`G.pendingReorderChoices` + `resolveReorderChoice`), WP-695 / D-24512 and D-24797 (`G.deferredHandInjections`, lifted from the discard before the end-of-turn fill and added after it), WP-684 / D-24501 (`G.pendingSeatChoice`), WP-828 / D-24761 and WP-845 / D-24779 (the queue → play-phase onMove opener → seat-choice shape for a pick an executor cannot park itself, and its lockstep sites), D-24285 (a short deck tops up from the discard before a reveal), D-24583 (a Wound costs 0), D-24518 (end-of-game pending drop), D-24803 (each Mandarin's Rings copy is its own variant card). All on `main`.
**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM — gameplay rules (three new villain-effect primitives, one new lazily created hashed `G` queue, one new seat-choice kind) plus card data and derived determinism feeds; no auth, money, persistence or server surface
**Lane:** Standard (two-session). Three primitives append to a contract file (`rules/villainAbility.types.ts`, D-entry required), a new `G` field lands in `types.ts`, the opener wires into `game.ts` and the bgio-bypassing loops, and the change moves derived feeds (D-24028 criteria #2, #4, #6).

> Baseline: drafted on `origin/main` @ `67940860`; the pre-flight scaffold ran on `03867810` (WP-866 #3194 landed in between, shifting `hero/heroEffects.execute.ts` anchors by about +50; no villain-primitive change). `origin/main` is now `82d8c0e8` (the WP-871 reserve, #3197). Three drafts may append villain primitives first: WP-868 (#3192, incl. antm `queens-vengeance/star-knight`), WP-869 and WP-871. Re-baseline at execution and re-read every anchor, position and pin value.

---

## Goal

As a player who defeats one of the Mandarin's Rings henchmen (Revelations), I want its printed Fight effect to happen. Today six of the ten variants do nothing and log a hollow effect in Play Diagnostics (operator match `WD8nQuYu31s`, build `afa74cc`: `henchman-mandarins-rings-04` at log line 23.2.11, and the `-08` / `-09` copies at 24.2.31 / 24.2.37).

After this session three of them do what they print:

- **Lightning, The Electro-Blast** — "Reveal the top card of your deck. You may KO it." The same text on Ant-Man's **Daystar** (antm Queen's Vengeance villain) works too.
- **Spin, The Vortex Beam** — "Reveal the top six cards of your deck. Discard all of them that cost 0, then put the rest back in any order."
- **Zero, The Ice Blast** — "Choose a card you played this turn that costs 0. When you draw a new hand of cards at the end of this turn, add that card to your hand as an extra card."

The other three (Liar, Nightbringer, Remaker) need new cross-player or Villain Deck mechanics and are a separate WP (§Out of Scope).

## User-Visible Impact

On play.legendary-arena.com:

- Defeating **Lightning** or **Daystar** opens the existing KO-or-keep prompt for your deck top (the one Gruesome Feast uses). KO puts the card in the KO pile; Keep leaves it on top.
- Defeating **Spin** reveals your top six, discards every 0-cost card among them (S.H.I.E.L.D. Agents, Troopers, Wounds, any 0-cost Hero) with one log line each, then opens the existing "put the rest back in any order" prompt when two or more cards remain.
- Defeating **Zero** looks at the cards you played this turn that cost 0. One kind of card (say, only S.H.I.E.L.D. Agents) is picked for you and logged; two or more kinds (an Agent and a Trooper) open a choice listing them. At the end of the turn you draw six as usual and then get the chosen card as a seventh. No 0-cost card played: a logged no-op. Two Zeros in one turn with three Agents in play give two extra Agents.
- The end-of-turn line for the returned card no longer says "Electromagnetic Bubble"; it reads `<card> was added to Player 0's hand as an extra card.` (also for the Bubble itself).
- These cards no longer appear as hollow effects in Play Diagnostics.

---

## Assumes

Anchors are as observed on `03867810`; re-read at execution.

1. **Rules.** "You may KO it" is the KO-or-keep shape WP-754 / D-24581 already models for hero lines. "Reveal the top N cards of your deck" tops the deck up from the discard when short (D-24285). "Put the rest back in any order" is the WP-479 / D-24286 reorder choice. A Wound costs 0 (D-24583, rules v23 L2861-2862). "Add that card to your hand as an extra card" when the new hand is drawn is the Electromagnetic Bubble injection (D-24512, D-24797).
2. **Villain primitive lockstep.** `rules/villainAbility.types.ts`: the `VillainEffectPrimitive` union ends `| 'hq-hero-gains-size-changing';` (L381); `VILLAIN_EFFECT_PRIMITIVES` (L449-527) ends at position 39 (L526); `VillainEffectDescriptor` already has `magnitude?: number` (L668). `rules/villainAbility.types.test.ts`: test title "39 canonical primitives" (L363), the `expectedPrimitives` list (L364-404, +3 entries), the count (L407-408), the last-entry assertion (L410-414), and `VILLAIN_EFFECT_PRIMITIVES.length, 39` at L633, L668, L694, L746 with their "total is 39" `why:` prose (L423 is a uniqueness check, not a pin). The marker script `scripts/convert-cards/apply-effect-markers.mjs`: hand-synced list L189-229 (last entry L228); grammar chain L335-496, ending in a terminal no-param `return parts.length === 1`. The engine parser `setup/villainAbility.setup.ts` `parseUngatedEffect` (L536, arms L544-986) needs an arm only for a parameterized primitive (no-param primitives fall through to the terminal `parts.length === 1` return). The executor map in `villain/villainEffects.execute.ts` (L4674-4726) ends `'hq-hero-gains-size-changing': villainEffectHqHeroGainsSizeChanging,` (L4725); its keyset guard is the compile-time `Record<VillainEffectPrimitive, VillainEffectHandler>`, checked by the engine `tsc` build (there is no runtime keyset test; the comment at L4633-4636 saying otherwise is stale).
3. **Append order.** WP-868, WP-869 and WP-871 are drafted or reserved, not executed, and may append villain primitives. Whichever runs first owns the next positions. This WP appends its three primitives **last at execution time**, in the Locked Values order, and re-reads every count pin then.
4. **KO-or-keep (WP-754).** `hero/heroEffects.execute.ts` `heroEffectRevealTopMayKo` (L4118) reveals via `revealDeckTopForDispose` (L3816, reshuffle-on-empty) and pushes one `PendingRevealTopDispose` whose single `RevealedTopEntry` has `isKoAllowed: true` and `isDiscardAllowed: false`, with the "queued behind another choice" log branch. `moves/revealTopDispose.resolve.ts` `resolveRevealTopDispose` (L114) accepts only `ko` / `top` for that entry, KOs via the shipped path, and `refreshStaleKoOrKeepFront` (run every move at the end of `resolveDeferredHeroGrants`, `game.ts` L899) re-reveals a stale front. Prompt, UIState projection and block-all guards already exist. `villainEffects.execute.ts` does not import `heroEffects.execute.ts`.
5. **Reorder (WP-479).** `PendingReorderChoice` (`types.ts` L925) is `{ choiceType: 'reorder-deck-top', playerID, cardIds }` on `G.pendingReorderChoices`, an active-player FIFO queue a handler may push directly (the hero reveal path, `heroEffects.execute.ts` L2533-2557). `moves/reorderChoice.resolve.ts` resolves it; prompt, UIState projection and block-all guards exist.
6. **Cost of a revealed card.** The villain module already has a private resolver, `resolveRevealedDeckTopCost` (`villainEffects.execute.ts` L2542): `G.cardStats` cost, or 0 for a Wound; any other card without stats has no known cost.
7. **Deferred hand injection (D-24512 / D-24797).** `G.deferredHandInjections?: Record<string, CardExtId[]>` (`types.ts` L2163, lazy, hashed). `moves/endOfTurnCleanup.logic.ts` `applyEndOfTurnCleanup`: Step 1 moves in-play then hand to discard, Step 1b `setAsideDeferredHandInjections` lifts each recorded card from the discard, Step 2 fills the hand, Step 5 `consumeDeferredHandInjections` adds them after the fill (and looks in discard / in-play / deck for one the set-aside did not find; not found = logged no-op). So a card recorded while still in play goes to the discard at Step 1 and comes back as the extra card. `rules/tacticHandlers.ts` `recordDeferredHandInjection` (L1447) is the shipped lazy-init + push. Hero in-play ids are copy-unique (`…#N`), but S.H.I.E.L.D. Agents (`starting-shield-agent`), Troopers (`starting-shield-trooper`) and Wounds (`pile-wound`) share one id each (`setup/pilesInit.ts` L25-40, `buildInitialGameState.ts` L150). Any copy is the same card to the consumer, so recording the id is exact, and "already recorded" has to count copies. The consume log lines name the Bubble (`moves/deferredHandInjection.logic.ts` L132 and the not-found line L140); no test pins either string.
8. **Seat choice (WP-684, WP-828).** One `G.pendingSeatChoice` open at a time. `moves/outOfTimeGrant.logic.ts` is the template: `queueOutOfTimeGrant` (L55) appends to a lazy `G.pendingOutOfTimeGrants`; `openOutOfTimeGrantSeatChoiceIfNeeded` (L134), called from the play-phase `onMove` in `game.ts` (L967), resolves no-choice entries inline and parks a seat choice for the first that needs a pick; `applyOutOfTimeGrantResolvedSeatChoice` (L218) is dispatched by kind from `moves/seatChoice.resolve.ts` `applySeatChoiceByKind` (L533). The kind arm is required (without it the queue never shifts). The bot `getLegalMoves` seat-choice short-circuit, `ai.seatChoice` (unknown kind → default index) and `applySeatChoiceTimeoutDefault` (through `applySeatChoiceByKind`) are generic. `hasAnyPendingChoice` need not know the queue (the WP-828 precedent; the opener runs every move). `SeatChoiceOption` already carries `cardId?` and `sourceZone?: 'hand' | 'inPlay' | 'discard'`. `PendingSeatChoicePrompt.vue` (L141) falls back to "Your choice" for an unnamed kind and the audience filter projects option labels only.
9. **Queue lockstep (WP-828 / WP-845).** A new `pending*` queue joins: the end-of-game drop `dropAllPendingPlayerChoices` (`endgame/mastermindVictory.logic.ts` L110 / L118, D-24518) and its drift guard `ALL_PENDING_FIELDS` (`mastermindVictory.logic.test.ts` L120-131); `isOperatorChoiceOpen` (`moves/operatorSetters.logic.ts` L81 / L92) and its row table (`operatorSetters.test.ts` L225 / L246); the play `onBegin` turn-start delete (`game.ts` L1056) and its mirror `applyOnBeginParity` (`simulation/onBeginParity.ts` L147). The rebuilt loops never run `onMove` ("The rebuilt loops never run the onMove opener", `onBeginParity.ts`), so the D-24779 opener is mirrored at `simulation/simulation.runner.ts` L710 and L817, `simulation/par.aggregator.ts` L785 and L872, and `test/fixtures/runFixture.ts` L426.
10. **Why the villain executor cannot park the seat choice.** `villainEffects.execute.ts` handlers receive no boardgame.io `events`; the D-24750 / D-24779 queue precedent (record the owed pick, open it from `onMove`) applies.
11. **Card data.** `scripts/convert-cards/inputs/villain-effect-markers.json` henchmen → `rvlt` → `mandarins-rings` → `cards` holds four variant entries (L456-463); `_unassigned` holds the six unmarked variants (L486-491). `villains` → `antm` → `queens-vengeance` exists with `blackbird`, `gigantus`, `iron-knight`; `daystar` prints `Fight: Reveal the top card of your deck. You may KO it.` and is in neither block. The pass (`node scripts/convert-cards/apply-effect-markers.mjs`, no `--validate` flag) appends the `[effect:…]` token to the matched `Fight:` line and prints `N new [effect:] marker(s) appended`.
12. **Copy ids.** D-24803 maps the ten copies to the variants in alphabetical order, one each: `henchman-mandarins-rings-04` Lightning, `-08` Spin, `-09` Zero (also Liar `-03`, Nightbringer `-05`, Remaker `-06`). Scaffold-confirmed (T1).
13. **No migration.** Villain hooks are captured in `initialState` at setup, so matches and replays created before the deploy keep the hollow hook (memory `reference_setup_hook_change_replay_compat`).
14. **Scaffold (2026-11-06, `03867810`, throwaway worktree, removed).** Every Locked Value of the first draft built and ran; engine 6455 / 0 → 6470 / 0 with the villain count pins the only existing-test edits at scaffold time (execution adds the D-24815 drift-case rewrite, PS-4); hash oracles unchanged; `pnpm -r --no-bail test` 0 fail in every package (server 207 DB-backed skipped, `TEST_DATABASE_URL` unset); dashboard `typecheck` / `lint` / `format:check` / `test:coverage` 0. Marker pass `4 new` (rvlt 3, antm 1), re-run `0`. The PS-1..3 fixes (§Gate Record) were applied to the text after the scaffold; they move no feed (no sweep, gauntlet or fixture uses `mandarins-rings`). **Expected feed deltas:**
    - `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`: executable 224 → 228, unmarked 534 → 530, distinctMechanics 47 → 50, totalRows 761; Daystar, Lightning, Spin, Zero become `executable` with WP-870 / D-24815.
    - `data/metadata/effect-implementation-index.json`: executable 735 → 739, unmarked 981 → 977, the same four entries.
    - `scripts/coverage/mechanic-provenance.json`: +3 keys after `hq-hero-gains-size-changing`.
    - **Unchanged** (line-ending churn only; revert): `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json` (totalObservations 7662, parse-unrecognized 7141; the sweep's sentinel villains are core Brotherhood and Savage Land Mutates), `scripts/coverage/hero-effect-coverage.baseline.json` (executable 3939, noEffect 2354). `apps/dashboard/src/composables/useInPlayCoverage.test.ts` passes unchanged (totalObs 8686, resolvedObs 1141, percentResolved 13.1). No pre-existing drift observed.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Triage (2026-11-06).** None of the six unmarked Mandarin's Rings lines fits an existing villain primitive, so none is a marker-only INFRA fix. The engine already has each mechanic on the hero side (the KO-or-keep reveal, the reorder choice, the deferred hand injection), but villain `[effect:…]` markers dispatch only `VILLAIN_EFFECT_PRIMITIVES`. This WP adds three thin villain primitives that reuse those shipped queues, so no new player-facing pending-choice type, move, client prompt or UIState field is needed (Zero adds one owed-pick queue, drained by an opener).
- **Why one primitive per line, not a bridge to hero keywords.** A generic "villain line runs a hero keyword" bridge would change the villain parser's grammar and the hollow-detection contract for every villain line. Three named primitives keep the D-24267 append-only vocabulary and the marker script's loud-fail list honest.
- **Lightning: why duplicate the hero park, not import it.** `villainEffects.execute.ts` does not import the hero executor, and importing it adds a module-cycle risk for one ~25-line park. Code style (00.6 Rule 1) duplicates until a third copy. The villain handler reproduces the WP-754 park and the shipped resolve move does the rest.
- **Spin: discard from the deck.** The 0-cost cards move deck → discard with `moveCardFromZone`, the move `resolveRevealTopDispose`'s `discard` branch uses. That is not a hand discard, so hand-discard reactions (`discardFromHand`) do not fire, as for every shipped reveal-discard. Cards are examined in reveal order; the survivors keep their relative order on top, and the reorder choice parks over them when two or more remain (none for 0 or 1, the WP-479 rule).
- **Spin: the reorder can go stale in the same move.** Spin parks inside `defeatCityVillainCore` (`moves/fightVillain.ts` L355), and `fireExcessiveViolencePlays` runs after it in the same move (L385-389): an Excessive Violence draw, or a KO-or-keep KO resolved first, can take a parked card before the reorder resolves. Today `resolveReorderChoice` (L120-121) returns with the entry still queued when the deck top is no longer a permutation of `cardIds`, which holds the block-all guard forever (a turn that cannot end; a stuck sim). WP-870 is the first packet to park a reorder inside a fight, so the resolve drops a drifted front instead (Locked Values, Reorder drift). `refreshStaleKoOrKeepFront` already covers the KO-or-keep side (`heroEffects.execute.ts` L7291-7296).
- **Zero: why the card stays in play.** The card is recorded, not moved. It stays in play for the rest of the turn (so "for each color of Hero you have" and similar later reads still see it), goes to the discard at cleanup Step 1, and comes back after the fill through the shipped D-24797 set-aside. No new cleanup step.
- **Zero: the pick.** Eligible cards are the defeating player's in-play cards that cost 0 whose id occurs more times in play than in `G.deferredHandInjections[player]` (copies counted, so a second Zero can take a second Agent), de-duplicated by display name (three Agents are one option; the first instance in play order is recorded). Zero distinct names: logged no-op. One: auto-picked and logged. Two or more: a seat choice addressed to the defeating player, `defaultOptionIndex` 0 (the bot / timeout default). Mandatory, as printed (no decline).
- **Zero: the queue's lockstep (Assumes 9).** The queue joins the end-of-game drop set, the operator choice-open guard, the turn-start delete, and the rebuilt sim / PAR / fixture loops, which call the opener at the D-24779 position because they never run `onMove`. Without the mirror a sim or PAR game that fights Zero would never apply the pick, and the hashed queue would grow.
- **The consume log.** Zero is the first non-Bubble writer to `deferredHandInjections`, so the two consume lines become source-neutral (the Bubble's own pick line already names it).
- **The three deferred lines.** Liar (another player's deck, the other player decides), Remaker (the player on your right gains a card from your hand or discard pile; solo has no right-hand player) and Nightbringer (Villain Deck reveal, defeat a ≤2VP Villain with its Fight effect, reorder the rest) each need a new cross-player or Villain Deck mechanic and at least one rules ruling. They stay in `_unassigned` and are a follow-up WP.
- **Determinism.** No RNG beyond the existing reshuffle-on-short-deck (`ctx.random` through the `ShuffleProvider` the executor already receives). One new `G` field, lazily created (never seeded), so a match without Zero serializes byte-identically. Hash oracles unchanged (scaffold). `replay/replay.execute.ts` is deliberately not given the opener (the D-24322 onMove-parity exclusion); server replay uses the boardgame.io reducer (`apps/server/src/replay/matchReplay.logic.ts` L236), which runs `onMove`.
- `docs/ai/ARCHITECTURE.md` §The Rule Execution Pipeline, §Zone & Pile Structure, §Layer Boundary.
- `docs/ai/DECISIONS.md`: D-24267, D-24285, D-24286, D-24501, D-24512, D-24518, D-24521, D-24581, D-24583, D-24761, D-24779, D-24797, D-24803, D-24372 before coding.
- User memory: `reference_pending_choice_wp_full_file_set`, `reference_interactive_choice_active_player_only`, `reference_simulation_harness_bypasses_bgio`, `reference_three_bgio_bypassing_turn_loops`, `reference_setup_hook_change_replay_compat`, `reference_hashed_g_field_dual_repin`, `feedback_ec_locked_value_stale_baseline`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+, `node:` prefix. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No `Math.random`, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24815) before coding. One WP per session.

**Packet-specific:**
- No new player-facing pending-choice type, move, client component or UIState field (the one new queue, `pendingNextHandFromPlayPicks`, is an owed-pick queue drained by the opener, the WP-828 shape). Lightning parks on `G.pendingRevealTopDispose`, Spin on `G.pendingReorderChoices`, Zero's pick on `G.pendingSeatChoice`. `moves/revealTopDispose.resolve.ts`, `moves/endOfTurnCleanup.logic.ts`, `hero/heroEffects.execute.ts` and every `apps/**` source file stay byte-unchanged. `moves/reorderChoice.resolve.ts` changes only its two deck-drift returns (L120-121), their comment (L116-119), the module header (L12-16) and function JSDoc (L78-83) where they call drift a no-op, and one added `pushLog` import; `moves/reorderChoice.resolve.test.ts` changes only its drift case (L192-198) and the header sentence at L7-9 (Locked Values, Reorder drift). `moves/deferredHandInjection.logic.ts` changes only its two consume log strings and its module-header comment.
- The new module never imports `villain/villainEffects.execute.ts`.
- The one new `G` field is `pendingNextHandFromPlayPicks`, lazily created at the first queue write, never seeded in `Game.setup` / `buildInitialGameState`.
- Card data changes only through `apply-effect-markers.mjs` (a re-run applies 0). Map edits keep the file's existing per-line formatting (no whole-file `JSON.stringify` rewrite).
- Every derived-feed delta matches Assumes 14. A delta that also appears when the same generator runs on a clean `origin/main` checkout is pre-existing drift: record it in the `EC-908:` commit body. Any other delta, or any hash-oracle movement, is a STOP.
- Drift pins are **runtime** assertions (D-24372).

## Locked Values

- **Primitives**, appended last to the union and to `VILLAIN_EFFECT_PRIMITIVES` in this order, at the next free positions at execution time (40, 41, 42 if nothing else lands first):
  1. `reveal-top-may-ko-current` — no parameter.
  2. `reveal-top-discard-zero-cost-current` — grammar `reveal-top-discard-zero-cost-current:<N>` (exactly 2 tokens, N a positive integer, carried as `magnitude`); a missing or bad N parses to `null` (→ `unresolvedMarkers`).
  3. `next-hand-from-play-zero-cost-current` — no parameter.
- **Markers** (in `villain-effect-markers.json`): henchmen `rvlt` / `mandarins-rings` / `cards`: `lightning-the-electro-blast` `{ "fight": ["reveal-top-may-ko-current"] }`, `spin-the-vortex-beam` `{ "fight": ["reveal-top-discard-zero-cost-current:6"] }`, `zero-the-ice-blast` `{ "fight": ["next-hand-from-play-zero-cost-current"] }` (alphabetical among the four existing entries); villains `antm` / `queens-vengeance`: insert `daystar` `{ "fight": ["reveal-top-may-ko-current"] }` between `blackbird` and `gigantus` (if WP-868 added `star-knight`, keep alphabetical order). Remove the three matching `_unassigned` rows (lightning, spin, zero); keep liar, nightbringer, remaker.
- **New `G` field** (`types.ts`, beside `pendingOutOfTimeGrants`): `pendingNextHandFromPlayPicks?: PendingNextHandFromPlayPick[] | undefined` with `export interface PendingNextHandFromPlayPick { playerID: string; sourceCardId: CardExtId; }` (JSDoc on both; `// why: WP-870 / D-24815`).
- **New module** `moves/nextHandFromPlay.logic.ts` exporting `NEXT_HAND_FROM_PLAY_SEAT_CHOICE_KIND = 'next-hand-from-play'`, `queueNextHandFromPlayPick(G, playerID, sourceCardId)`, `openNextHandFromPlaySeatChoiceIfNeeded(G, events, currentPlayer)` and `applyNextHandFromPlayResolvedSeatChoice(G, choice)`, modelled on `moves/outOfTimeGrant.logic.ts` (same import-cycle `// why:`).
- **Handlers** in `villain/villainEffects.execute.ts`, appended to the executor map in the same order, each self-narrating (keyword-less):
  1. `villainEffectRevealTopMayKoCurrent` — the Assumes 4 park for `currentPlayer`. Empty deck + discard: no park, log `` `Player ${currentPlayer} had no card to reveal on top of their deck (reveal-top).` `` `'blocked'`, return `{ targets: [] }`. Otherwise the WP-754 log lines verbatim (`… revealed {card} from the top of their deck — KO it or keep it (reveal-top).` `'neutral'` with the card; or the queued-behind line), return `{ targets: [], pending: true }`.
  2. `villainEffectRevealTopDiscardZeroCostCurrent` — `count = descriptor.magnitude`; reshuffle the discard in when `deck.length < count` (D-24285); look at `deck.slice(0, count)`; for each looked-at card in order whose `resolveRevealedDeckTopCost` is 0, move it deck → discard and log `` `Player ${currentPlayer} discarded ${card} from the top of their deck (cost 0).` `` `'applied'` with the card; then `remaining` = looked-at count minus discarded count; if `remaining >= 2` push `{ choiceType: 'reorder-deck-top', playerID: currentPlayer, cardIds: deck.slice(0, remaining) }` (lazy-init the queue) and log `` `Player ${currentPlayer} puts the other ${String(remaining)} revealed cards back in any order.` `` `'neutral'`. Nothing looked at (empty deck + discard): log `` `Player ${currentPlayer} had no cards to reveal (cost-0 discard).` `` `'blocked'`. Returns `{ targets: [] }` (`pending: true` when a reorder parked).
  3. `villainEffectNextHandFromPlayZeroCostCurrent` — `queueNextHandFromPlayPick(G, currentPlayer, cardId)`; log `` `Player ${currentPlayer} will add a 0-cost card they played this turn to their next hand (${card}).` `` `'neutral'` with `cardId`. Returns `{ targets: [], pending: true }`.
- **Opener** (`openNextHandFromPlaySeatChoiceIfNeeded`): a no-op while `G.pendingSeatChoice` is open, `hasAnyPendingChoice(G)` is true, `G.pendingHeroChoice` is set, or the match is decided (`evaluateEndgame(G) !== null`) — the `isAnotherChoiceOpenOrMatchOver` shape in `outOfTimeGrant.logic.ts`. Zero's cost test is a local helper, `G.cardStats[cardId]?.cost === 0` (a Wound is not played; an unknown cost is not eligible, matching Spin), with a `// why:` naming why it does not reuse `isZeroCostCard` (`moves/resolveReturnZeroCostDiscard.ts` L58 treats a missing stats entry as 0) or the villain executor's private resolver (import cycle). When the queue empties, `delete G.pendingNextHandFromPlayPicks` (the template's L161 / L238 shape). Walk the queue front to back: eligible = the entry player's `inPlay` cards with cost 0 whose id occurs more times in `inPlay` than in `G.deferredHandInjections[player]` (copies counted), de-duplicated by display name (first instance kept, play order). 0 → log `` `Player ${player} played no 0-cost card to add to their next hand (${source}).` `` `'blocked'`, shift, continue. 1 → record it (below), shift, continue. ≥2 → park one seat choice (kind `next-hand-from-play`, addressed `[player]`, options `{ label: '<card name>', cardId, sourceZone: 'inPlay' }` in play order, `defaultOptionIndex` 0) via `parkSeatChoice`, leave the entry queued, stop.
- **Record + apply:** lazy-init `G.deferredHandInjections` and the player's array (reuse `recordDeferredHandInjection` from `rules/tacticHandlers.ts` if it imports without a cycle, else duplicate it; record which), push the chosen in-play id, log `` `Player ${player} will add ${card} to their next hand as an extra card (${source}).` `` `'applied'` with the card. The applier reads the submitted option's `cardId`, records it, and shifts the queue front.
- **Log card references:** in every locked handler and opener line, `${card}` is `formatCardRef(G.cardDisplayData, <that card's id>)` and `${source}` is `formatCardRef(G.cardDisplayData, entry.sourceCardId)` (the defeated Zero copy); each line passes that card id as the 4th `pushLog` argument. The consume lines keep their shipped `resolveCardName` rendering.
- **Consume log** (`moves/deferredHandInjection.logic.ts`, strings + module-header comment only): `` `${name} (${id}) was added to Player ${p}'s hand as an extra card.` `` and `` `Player ${p}'s extra card (${id}) could not be found to add to their hand; no effect.` `` (same outcomes and card arguments as today). The header comment and the `deferredHandInjections` JSDoc in `types.ts` name both writers (the Bubble and Zero).
- **Reorder drift (D-24815; amends the D-24286 drift no-op).** In `resolveReorderChoice`, when the owner's deck is shorter than `front.cardIds.length` (L120) or its `deck.slice(0, front.cardIds.length)` is no longer a permutation of `front.cardIds` (L121), shift the front entry (delete `G.pendingReorderChoices` when it empties) and log `` `Player ${playerID}'s revealed cards are no longer all on top of their deck; nothing to put back in order.` `` `'neutral'`. Both early returns become this drop; never return with the entry still queued. The L111 submission-permutation check stays first, so the drop fires only on a permutation submission against a drifted deck; a non-permutation **submission** stays a no-op with the queue intact (a bad submission, not drift). A valid submission on an undrifted deck is unchanged. `// why:` Spin parks inside `defeatCityVillainCore` and `fireExcessiveViolencePlays` runs after it in the same move; `refreshStaleKoOrKeepFront` covers only KO-or-keep, so a drifted reorder would hold the block-all guard forever.
- **Wiring:** `game.ts` play-phase `onMove` calls `openNextHandFromPlaySeatChoiceIfNeeded(G, events, ctx?.currentPlayer)` immediately after `openOutOfTimeGrantSeatChoiceIfNeeded` and before `openEnigmaPeekSeatChoiceIfNeeded`, with a `// why:`. `seatChoice.resolve.ts` `applySeatChoiceByKind` gains the `NEXT_HAND_FROM_PLAY_SEAT_CHOICE_KIND` arm.
- **Queue lockstep (the WP-828 / WP-845 set):** `dropAllPendingPlayerChoices` sets `gameState.pendingNextHandFromPlayPicks = undefined` (`// why: WP-870 / D-24815 — owed Zero picks join the end-of-game drop set (D-24518)`), and `ALL_PENDING_FIELDS` gains `'pendingNextHandFromPlayPicks'`. `isOperatorChoiceOpen` returns true on a non-empty queue, with one row in `operatorSetters.test.ts`. `game.ts` play `onBegin` and `applyOnBeginParity` guarded-delete the queue. The opener is mirrored directly after `openRevealOrWoundSeatChoiceIfNeeded` in `simulation.runner.ts` (both sites), `par.aggregator.ts` (both sites) and `test/fixtures/runFixture.ts`, with `events` undefined and the loop's active seat.
- **Provenance:** one `mechanic-provenance.json` key per primitive, `{ "wp": "WP-870", "decision": "D-24815" }`, after `hq-hero-gains-size-changing`.

---

## Scope (In)

- **A) Primitives** — `rules/villainAbility.types.ts` (union + array, `// why: WP-870 / D-24815` naming the three printed lines); `setup/villainAbility.setup.ts` (the `:<N>` arm for primitive 2); `scripts/convert-cards/apply-effect-markers.mjs` (hand-synced list + the grammar check for primitive 2).
- **B) Handlers** — `villain/villainEffects.execute.ts` (three handlers + map entries); `moves/reorderChoice.resolve.ts` (the drift-drop branch) + `moves/reorderChoice.resolve.test.ts` (the drift case).
- **C) Zero's pick** — `types.ts` (field + interface); `moves/nextHandFromPlay.logic.ts` (new); `moves/seatChoice.resolve.ts` (dispatch arm); `game.ts` (onMove opener + onBegin delete; the `01.5` runtime-wiring file); `moves/deferredHandInjection.logic.ts` (two log strings + header comment).
- **D) Queue lockstep** — `endgame/mastermindVictory.logic.ts`, `moves/operatorSetters.logic.ts`, `simulation/onBeginParity.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `test/fixtures/runFixture.ts`.
- **E) Tests** — `villain/mandarinsRingsFight.test.ts` (new; T1-T18), the villain count / list / last-entry pins in `rules/villainAbility.types.test.ts`, `ALL_PENDING_FIELDS` in `endgame/mastermindVictory.logic.test.ts`, one row in `moves/operatorSetters.test.ts`.
- **F) Card data** — `villain-effect-markers.json` (four entries, three `_unassigned` removals); `data/cards/rvlt.json` and `antm.json` regenerated by the pass.
- **G) Derived feeds** — `mechanic-provenance.json`; the regenerated villain ledger and effect index (Assumes 14).

## Out of Scope

- **Liar, Nightbringer, Remaker** (Mandarin's Rings `-03`, `-05`, `-06`): new cross-player and Villain Deck mechanics plus rulings (does the engine model Liar's "Good / Bad" table talk at all; Remaker in solo; Nightbringer's recursive Fight effect and reorder of Villain Deck cards). Follow-up WP; they keep their `_unassigned` rows and their hollow records.
- **Other "choose a card you played / one of your Heroes … add it to your next hand" Fight lines**: vill (an Ally), wwhk (a Hero that costs 5 or less), co2e (set aside an X-Men or S.H.I.E.L.D. Hero). Different filters and, for co2e, a set-aside; follow-up (the Zero module is the template).
- **Other "Reveal the top card … You may KO it" lines not printed as a plain villain `Fight:`** (mdns Patrol keywords, the `[hc:instinct]` vnom look-at line, wtif's recruit trigger): hero-side or keyword-timed.
- **A card-specific heading in `PendingSeatChoicePrompt.vue`** for the Zero pick (it shows the fallback "Your choice" with card-name options; the log names Zero). Every earlier seat-choice kind shipped one (L96, L138), so this is a known UX gap: follow-up client copy (`case 'next-hand-from-play': return 'Zero — choose a 0-cost card you played to add to your next hand';`), kept out to hold this WP to the engine layer.
- **The stale executor-map comment** (`villainEffects.execute.ts` L4633-4636, "15 primitives … the drift test asserts"): a separate papercut commit.
- **Re-snapshotting a drifted reorder** to the parked cards still on top (instead of dropping it): follow-up.
- The client, UIState, server, registry, and the existing resolve moves, except the `resolveReorderChoice` drift-drop branch (Locked Values, Reorder drift).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/villainAbility.types.ts` — modified (contract file; D-24815); `rules/villainAbility.types.test.ts` — modified (pins)
- `setup/villainAbility.setup.ts` — modified (primitive 2 grammar arm)
- `villain/villainEffects.execute.ts` — modified (three handlers + map)
- `types.ts` — modified (contract file; the new field + interface)
- `moves/nextHandFromPlay.logic.ts` — **new**
- `moves/seatChoice.resolve.ts` — modified (dispatch arm)
- `moves/deferredHandInjection.logic.ts` — modified (two log strings + header comment)
- `moves/reorderChoice.resolve.ts` — modified (the two drift returns, their comments, the header / JSDoc drift wording, and a `pushLog` import)
- `moves/reorderChoice.resolve.test.ts` — modified (the drift case now expects the drop: the deck is unchanged, `G.pendingReorderChoices` is `undefined`, and the neutral drift line is logged; an intentional D-24815 behavior change, stated in the `EC-908:` commit body)
- `game.ts` — modified (onMove opener + onBegin delete; `01.5` runtime wiring)
- `endgame/mastermindVictory.logic.ts` + `.test.ts` — modified (drop set + `ALL_PENDING_FIELDS`)
- `moves/operatorSetters.logic.ts` + `moves/operatorSetters.test.ts` — modified (guard + row)
- `simulation/onBeginParity.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `test/fixtures/runFixture.ts` — modified (turn-start delete + opener mirror)
- `villain/mandarinsRingsFight.test.ts` — **new**

**Scripts / data**
- `scripts/convert-cards/apply-effect-markers.mjs` — modified; `scripts/convert-cards/inputs/villain-effect-markers.json` — modified
- `data/cards/rvlt.json`, `data/cards/antm.json` — regenerated by the pass
- `scripts/coverage/mechanic-provenance.json` — modified
- `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json` — regenerated

**Expected unchanged after regeneration** (revert line-ending churn): `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts`, `packages/lagn-spec/schemas/lagn-v1.json`, `docs/ai/coverage/hero-mechanic-ledger.*`.

**Governance close:** `docs/ai/DECISIONS.md` (D-24815), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/coverage/live-verify.json`.

28 code / test / data files (20 engine, 8 scripts / data): 2 new. The hand-written logic is three handlers, one module, the reorder drift branch and the six lockstep one-liners; the rest are pins, two regenerated card files and three regenerated feeds. The count is above 00.3 §5's ~8-file guide through the pending-queue lockstep every WP-828-shaped queue carries (the WP-845 precedent). No `01.6` trigger beyond the standard ones: the primitives follow the D-24267 append-only category, the queue the WP-828 / WP-845 category, and the seat-choice kind the WP-684 consumer category.

## Contract

- **Primitives** `reveal-top-may-ko-current`, `reveal-top-discard-zero-cost-current:<N>`, `next-hand-from-play-zero-cost-current` (union + array + executor map + marker-script list).
- **Field** `G.pendingNextHandFromPlayPicks?: PendingNextHandFromPlayPick[] | undefined` (lazy, hashed; drained by the opener; dropped at game end and turn start).
- **Seat-choice kind** `next-hand-from-play` (one addressed seat, options carry `cardId` + `sourceZone: 'inPlay'`, default 0).
- **Behavior:** Lightning / Daystar park the WP-754 KO-or-keep entry; Spin discards the looked-at 0-cost cards and parks the WP-479 reorder over two or more survivors; Zero records one in-play 0-cost card id in `G.deferredHandInjections` (copies counted), which the shipped cleanup returns as an extra card after the new-hand fill; the consume log no longer names the Bubble.
- `resolveReorderChoice` drops a drifted front instead of leaving it queued; every other path of it, the other shipped resolve moves, every existing primitive, the cleanup and the hero executor keep their behavior.

## Test Contract

All in `villain/mandarinsRingsFight.test.ts`. Parser cases build villain hooks from the **committed** `data/cards/rvlt.json` / `antm.json` (so they fail on today's data). Handler cases dispatch through the exported villain executor entry point (`executeVillainAbilities`, `villainEffects.execute.ts` L166), never by calling a handler directly. Zero cases use the real `SHIELD_AGENT_EXT_ID` / `SHIELD_TROOPER_EXT_ID` / `WOUND_EXT_ID` constants. T17 is the one case that drives boardgame.io's own reducer: it imports `InitializeGame` / `CreateGameReducer` from the deep dist entry `boardgame.io/dist/cjs/internal.js` under the WP-411 / D-24223 exception (the `game.test.ts` and `divingBlock.multiSeatWave.test.ts` precedent), with that precedent's `// why:` copied above the import; no `boardgame.io/testing` import, and no other case touches boardgame.io.

| # | Input | Expected | Invariant / must NOT |
|---|---|---|---|
| T1 | Committed rvlt Mandarin's Rings hooks | `-04` onFight effects `[{ primitive: 'reveal-top-may-ko-current' }]`; `-08` `[{ primitive: 'reveal-top-discard-zero-cost-current', magnitude: 6 }]`; `-09` `[{ primitive: 'next-hand-from-play-zero-cost-current' }]`; no `unresolvedMarkers` on those three; separately, `reveal-top-discard-zero-cost-current` bare, `:0`, `:x` and `:6:x` each parse to `null` and land in `unresolvedMarkers` | no longer hollow; strict grammar |
| T2 | Committed rvlt `-03`, `-05`, `-06` | still no effects (unmarked) | deferred lines untouched |
| T3 | Committed antm Daystar hook | onFight `[{ primitive: 'reveal-top-may-ko-current' }]` | |
| T4 | Lightning, deck `[A, B]` | `G.pendingRevealTopDispose` front `{ choiceType: 'reveal-top-dispose', playerID: '0', revealedTops: [{ ownerPlayerID: '0', cardId: A, isKoAllowed: true, isDiscardAllowed: false }] }`; the locked `neutral` log line | |
| T5 | T4 then `resolveRevealTopDispose` `ko` A; separately `top`; separately `discard` | `ko`: A in `G.ko`, deck `[B]`; `top`: deck `[A, B]`; `discard`: no change, entry still pending | KO-or-keep only |
| T6 | Lightning, empty deck and discard | no queue entry; the locked `blocked` line | never throws |
| T7 | Spin, deck `[agent, heroA, WOUND, trooper, heroB, heroC, heroD, agent]` | discard gains agent, WOUND, trooper in that order; deck `[heroA, heroB, heroC, heroD, agent]` (the second Agent, below the six-card window, stays); reorder front `cardIds` `[heroA, heroB, heroC]`; three `applied` lines + one `neutral` | only the top six looked at; first-occurrence removal stays inside the window |
| T8 | Spin, deck 3 cards, discard 5 (mock shuffle reverses) | the discard is shuffled in first (D-24285); six cards looked at; the cost-0 ones among them discarded | reshuffle-on-short |
| T9 | Spin, top six all cost 0 except one | five discarded, no reorder parked | 0 or 1 survivors → no park |
| T10 | Zero; in-play `[SHIELD_AGENT_EXT_ID, SHIELD_AGENT_EXT_ID, heroCost3]`; run the opener | `deferredHandInjections['0']` `[SHIELD_AGENT_EXT_ID]`; no seat choice; `pendingNextHandFromPlayPicks` is `undefined`; `applied` line | auto-pick on one distinct name |
| T11 | Zero; in-play `[agent, trooper]`; opener, then resolve the seat choice with option 1 | seat choice kind `next-hand-from-play`, 2 options, labels the card names, default 0; after resolve `deferredHandInjections['0']` `[trooper]`, `pendingNextHandFromPlayPicks` is `undefined`, `G.pendingSeatChoice` cleared | |
| T12 | Zero; no 0-cost card in play | no injection, `pendingNextHandFromPlayPicks` is `undefined`, the locked `blocked` line | |
| T13 | T10's `G` (10-card deck) then `applyEndOfTurnCleanup` for `'0'` | hand is 7 cards and contains an Agent; `deferredHandInjections['0']` gone; the source-neutral consume line `… was added to Player 0's hand as an extra card.` | the shipped consumer returns it after the fill; no "Electromagnetic Bubble" |
| T14 | Two Zero picks queued, in-play `[agent, trooper]`, opener + apply | the second pick's eligible list excludes the recorded card, so it auto-picks the other | no double-record past the copies in play |
| T15 | Two Zero picks queued, in-play three Agents, a 10-card deck; opener; then `applyEndOfTurnCleanup` for `'0'` | after the opener: `deferredHandInjections['0']` `[SHIELD_AGENT_EXT_ID, SHIELD_AGENT_EXT_ID]`, no seat choice, two `will add … as an extra card` `applied` lines; after cleanup: an 8-card hand with two extra Agents and two source-neutral consume lines | copies counted |
| T16 | Spin, deck `[heroA, agent, heroB, heroC, heroD, heroE, heroF]` → reorder parks over `[heroA, heroB, heroC, heroD, heroE]`; then move heroA deck → hand (the Excessive Violence draw); then `resolveReorderChoice` with the parked order | `G.pendingReorderChoices` is `undefined`; deck `[heroB, heroC, heroD, heroE, heroF]`; the locked `neutral` drift line. Separately: deck `[A, B]`, parked `[A, B, C]`, resolve `[C, B, A]` (the short-deck drift) → queue dropped, deck unchanged, the neutral line | a drifted reorder never holds the block-all guard (both drift returns) |
| T17 | Real reducer, the `game.test.ts` WP-845 pattern (`startRevealOrWoundMatch`, L1733-1771): `InitializeGame` with `createMockMatchConfiguration()`, both seats `setPlayerReady`, then `startMatchIfReady`. Then `structuredClone(state.G)` and inject: `city[0] = 'henchman-mandarins-rings-09'`; Zero's `onFight` hook `{ cardId, timing: 'onFight', keywords: [], effects: [{ primitive: 'next-hand-from-play-zero-cost-current' }] }`; active seat `inPlay = [SHIELD_AGENT_EXT_ID, SHIELD_TROOPER_EXT_ID]` (both carry cost-0 stats, `buildInitialGameState.ts` L605-606); `turnEconomy.attack` ≥ Zero's fight price (or a `cardStats` entry with `fightCost: 0`); `currentStage = 'main'`. Dispatch `fightVillain` `[{ cityIndex: 0 }]`, then `resolveSeatChoice` `[{ optionIndex: 1 }]`, both from the active seat | after the fight `G.pendingSeatChoice.kind === 'next-hand-from-play'`; after the answer `deferredHandInjections[activeSeat]` `[SHIELD_TROOPER_EXT_ID]` and `pendingNextHandFromPlayPicks` `undefined` | proves the `game.ts` onMove wiring |
| T18 | `applyOnBeginParity` on a `G` with a queued pick; and a fresh initial state | the field is deleted; the fresh state has no own `pendingNextHandFromPlayPicks` key | turn-start delete; never seeded |

Plus: the runtime count / list / last-entry pins in `rules/villainAbility.types.test.ts` (+3, last three in Locked Values order), `ALL_PENDING_FIELDS` (+1) and the `operatorSetters.test.ts` row (a non-empty queue reports a choice open).

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §2, §22 (determinism), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed. Printed villain Fight effects now do what they print; no money, cosmetic or account state reaches them.

**Determinism preservation:** RNG only through the existing reshuffle `ShuffleProvider`. One new lazy `G` field, dropped at game end and turn start, and opened identically by the live `onMove` and the rebuilt loops. Hash oracles (sentinel `finalStateHash`, `PRE_WP080_HASH`) unchanged (scaffold). **Replay-compat:** hooks live in `initialState`, so a match created before the deploy replays identically; live-verify uses a match created after it.

## Funding Surface Gate

§20 **N/A**: engine gameplay and card data. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Parser.** T1-T3 pass on the committed data.
2. **Lightning.** T4-T6 pass with `moves/revealTopDispose.resolve.ts` byte-unchanged.
3. **Spin.** T7-T9 and T16 pass with `moves/reorderChoice.resolve.ts` changed only as the Packet-specific constraint allows (the two drift returns, their comment, the header / JSDoc drift wording, one `pushLog` import); the existing drift case in `reorderChoice.resolve.test.ts` is rewritten to expect the drop (intentional, D-24815); every other existing reorder test passes unchanged.
4. **Zero.** T10-T15, T17 and T18 pass with `moves/endOfTurnCleanup.logic.ts` byte-unchanged and `moves/deferredHandInjection.logic.ts` changed only in its two log strings and header comment.
5. **Lockstep.** The three primitives are last in the union and the array in the locked order, in the marker script's list and the executor map; the count pins move +3 from their execution-time values; `pnpm --filter @legendary-arena/game-engine build` (tsc, the `Record<VillainEffectPrimitive, …>` keyset guard) exits 0. The queue is in `dropAllPendingPlayerChoices`, `ALL_PENDING_FIELDS`, `isOperatorChoiceOpen`, the `onBegin` delete and its parity mirror, and the opener runs in all five rebuilt-loop sites.
6. **Card data.** The marker pass reports `4 new [effect:] marker(s) appended`, a re-run reports `0`, only `rvlt.json` and `antm.json` change, `pnpm cards:check` exits 0, and the three `_unassigned` rows are gone.
7. **Feeds.** Every Assumes 14 delta is observed and nothing else beyond recorded pre-existing drift; every `:check` gate in Verification 3 exits 0.
8. **Gates.** `pnpm -r build` 0; `pnpm -r --no-bail test` 0 failures; hash oracles unchanged.

## Verification Steps

1. `pnpm -r build` → 0; `pnpm --filter @legendary-arena/game-engine test` → 0 fail; record the total before any edit (6455 at `03867810`).
2. `node scripts/convert-cards/apply-effect-markers.mjs` → `4 new`; again → `0`. `git diff --stat -- data/cards` lists only `rvlt.json` and `antm.json`.
3. `pnpm ledger:villains`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`, `pnpm sim:coverage --update-baseline`; diff each (`git diff --ignore-cr-at-eol`) against Assumes 14; then `pnpm cards:check`, `ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `cards:count-markers:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `gauntlet:loadouts:check`, `gauntlet:configs:check` → each 0.
4. `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` and `run prebuild:effect-index`; `pnpm -r build`; `pnpm -r --no-bail test` → 0 fail (server suites need `TEST_DATABASE_URL`; record whether they ran). Then dashboard `typecheck`, `lint`, `run format:check`, `run test:coverage` → each 0.
5. **Control run:** drop the `next-hand-from-play-zero-cost-current` map entry (keep the build compiling by pointing it at a no-op) → T10-T15 and T17 fail; restore. Then remove the `game.ts` onMove opener call → T17 fails; restore. Then restore the shipped reorder drift no-op → T16 fails; restore.
6. **Revert proof:** make Spin discard every looked-at card (no cost test) → T7 and T9 fail (T8 too, since it asserts the discard); restore.
7. `git status --porcelain` (tracked + untracked) ⊆ Files Expected to Change. Revert line-ending-only churn in the expected-unchanged files.

## Definition of Done

- [ ] AC 1-8 pass; the control run and the revert proof were observed; the diff is allowlist-only.
- [ ] D-24815 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated, naming every §Out of Scope item as a follow-up.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0; NUMBER-LEDGER lines annotated LANDED.
- [ ] Two-commit topology: `EC-908:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a `play.legendary-arena.com` match created after the deploy (deployed gitSha checked) with The Mandarin as Mastermind (his Always Leads puts Mandarin's Rings in the Villain Deck): defeat Lightning (KO-or-keep prompt; KO one), Spin (cost-0 discards logged, reorder prompt), and Zero after playing a S.H.I.E.L.D. Agent and a Trooper (the pick opens; end the turn; seven cards in hand, the picked one among them, the source-neutral consume line). Recipe (auto-memory `reference_operator_match_live_verify_recipe`): an operator match via `?route=workshop`, the setters to place the wanted Mandarin's Rings copy (`henchman-mandarins-rings-04` / `-08` / `-09`) in the City and give Attack. Read the hand from `uiState.snapshot.players[0].handDisplay.length`. Recorded in `docs/ai/coverage/live-verify.json`, STATUS and D-24815, or operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24815 — villain-fight-own-deck-reveal-and-set-aside.** It locks:
- three villain-effect primitives appended after the last shipped one (`reveal-top-may-ko-current`, `reveal-top-discard-zero-cost-current:<N>`, `next-hand-from-play-zero-cost-current`), named per printed line rather than a villain → hero-keyword bridge, which would change the villain grammar and hollow contract for every line;
- each reuses a shipped queue: the WP-754 KO-or-keep entry on `pendingRevealTopDispose`, the WP-479 `pendingReorderChoices`, and the D-24512 / D-24797 `deferredHandInjections` for the returned card, so no new player-facing pending type, move, prompt or UIState field;
- `resolveReorderChoice` drops a drifted front (deck top no longer a permutation of `cardIds`) with a neutral log instead of returning with it queued, amending the D-24286 drift no-op: a fight-time reorder can be overtaken in the same move by an Excessive Violence draw or a KO-or-keep KO, and a stuck front holds the block-all guard forever; the cost is the reorder of the cards still on top (a re-snapshot of the surviving parked cards is a possible follow-up), and the stale prompt clears on its next submission;
- Lightning's park is duplicated from the hero handler (code-style Rule 1; no hero-executor import into the villain executor);
- Spin's discard is a deck → discard move, not a hand discard (no hand-discard reactions); cost 0 = stats cost 0 or a Wound (D-24583); a card with no known cost stays;
- Zero's card stays in play until cleanup and returns through the shipped set-aside; its pick is a WP-828-shaped queue (`pendingNextHandFromPlayPicks`, lazy) opened from `onMove`, and from the rebuilt sim / PAR / fixture loops at the D-24779 position, as a `next-hand-from-play` seat choice; the queue joins the end-of-game drop (D-24518), the operator choice-open guard and the turn-start delete; options de-duplicated by name, auto on one, mandatory, default 0; a played copy already injected is not eligible again (copies counted, since S.H.I.E.L.D. and Wound ids are shared); Zero's eligibility uses stats cost 0 only (a played card with no stats entry is not eligible), deliberately stricter than the `isZeroCostCard` missing-entry-is-0 convention;
- the deferred-hand-injection consume lines are source-neutral now that a second writer exists;
- Liar, Nightbringer, Remaker and the same-shape vill / wwhk / co2e lines are follow-ups;
- the derived-feed movement in Assumes 14 (villain ledger and effect index +4 executable) and no hash-oracle movement;
- replay-compat: hooks are captured at setup, so only matches created after the deploy run these effects.

---

## Gate Record

All gates ran as independent subagents.

**Pre-flight (01.4), round 1: NOT READY (3 PS), with a full scaffold** in a throwaway worktree on `03867810` (removed afterwards): every first-draft Locked Value implemented, 15 scaffold tests passing, engine 6455 / 0 → 6470 / 0 (villain count pins the only existing-test edits), `pnpm -r --no-bail test` 0 fail in every package, dashboard CI gates 0, marker pass `4 new` then `0`, all ten `:check` gates 0, hash oracles unchanged, feed deltas as Assumes 14. The opener order, generic seat-choice dispatch, bot / timeout defaults and the Lightning resolve path all held.
- **PS-1 (fixed):** the new queue lacked the WP-828 / WP-845 lockstep sites (end-of-game drop + `ALL_PENDING_FIELDS`, operator guard, `onBegin` delete + parity) and the rebuilt loops never run `onMove`, so a sim / PAR game would never apply Zero's pick. Assumes 9, the Queue lockstep Locked Value, Scope D and seven files added; mirror chosen over "sims skip Zero".
- **PS-2 (fixed):** S.H.I.E.L.D. Agent / Trooper / Wound ids are shared, so "already recorded" blocked a second Zero from taking a second Agent (observed). Eligibility now counts copies; Assumes 7, T10 and new T15 updated.
- **PS-3 (fixed, option A):** the shipped consume line credited Zero's card to "Electromagnetic Bubble" (observed). `deferredHandInjection.logic.ts` now in scope for its two log strings; T13 asserts the neutral line.
- **RS-1..9 (applied):** anchors corrected to `03867810`; AC5's keyset test is the compile-time `Record` guard; Spin uses the villain module's `resolveRevealedDeckTopCost`; `recordDeferredHandInjection` reuse optional; antm group already exists (insert `daystar`); no `--validate` flag; control run / revert proof scopes; Lightning return values; three feeds and the dashboard pin expected unchanged. RS-10 (stale executor-map comment) is Out of Scope as a separate papercut.
- **Re-confirm (round 2, on `82d8c0e8`): READY TO EXECUTE, no new PS.** PS-1..3 verified complete (every lockstep anchor re-checked; `applyOnBeginParity` has no fourth caller; the one existing consume-line assertion, `endOfTurnCleanup.logic.test.ts` L153, matches a substring the neutral line keeps). RS-A (T15 deck size and log wording) and RS-B (`pendingHeroChoice` in the opener guard) applied.

**Copilot (01.7), round 1: RISK (SUSPEND), all findings applied except P2-6.** Card text, anchors, determinism, bot default, server replay (bgio reducer runs `onMove`) and name de-duplication verified on `82d8c0e8`.
- **P1-1 (fixed):** Spin's fight-time reorder can be overtaken in the same move by `fireExcessiveViolencePlays` (an EV draw, or a KO-or-keep KO resolved first); `resolveReorderChoice` then returns with the front still queued and the block-all guard soft-locks the turn (and a sim / PAR run). Fixed with the Reorder drift Locked Value (`moves/reorderChoice.resolve.ts` drift branch now in scope), T16, a D-24815 bullet and a Context paragraph.
- **P1-2 (fixed):** nothing proved `game.ts` opens Zero's pick (direct opener calls only; the control run removed the map entry). Added T17 (real reducer: fight Zero, answer the seat choice) and T18 (`applyOnBeginParity` delete + never seeded), and a control step that removes the `game.ts` call.
- **P2 (fixed):** Zero's cost predicate locked as a local `cardStats` cost-0 helper (not `isZeroCostCard`, which treats missing stats as 0; no villain-executor import); delete-on-drain; T4 `choiceType`; parser negatives in T1 and the below-window Agent in T7; `formatCardRef` scope made global; the Bubble-only comments (`deferredHandInjection.logic.ts` header, `types.ts` JSDoc) allowed to name both writers; file count; the replay-mirror exclusion note.
- **P2-6 (kept out of scope):** a Zero-specific seat-choice heading needs an `apps/**` edit; recorded in Out of Scope as a follow-up with the exact case line.

**Pre-flight re-confirm (round 3, `82d8c0e8`): READY TO EXECUTE once PS-4 applied (applied).** PS-4: `reorderChoice.resolve.test.ts` L192-198 asserts the queue stays intact on drift (a short-deck case, the L120 return), so the drift drop covers both L120 and L121 and that test is rewritten to expect the drop (allowlisted, intentional per D-24815). RS-C (the T17 injection recipe) and RS-D (the stricter Zero cost convention recorded in D-24815) applied. Every other round-3 fix verified against source (P1-1 premise, T16-T18 feasibility, the three control runs, the P2s, the replay exclusion, the lint fixes, EC ↔ WP).

**Copilot (01.7), round 2: RISK (HOLD), five P2 wording fixes, scope-neutral, all applied.** Both P1s fixed; the drift drop is safe for the Amazing Spider-Man reorder path, the bot (always submits `front.cardIds`) and both reorder rulings. Applied: the reorder file's allowance covers the `pushLog` import and the stale header / JSDoc drift wording (test header L7-9); the Out of Scope resolve-moves line excepts the drift branch; T17 keys `deferredHandInjections[activeSeat]`; D-24815 records the lost-reorder cost and the stale prompt (re-snapshot follow-up added); the L111-first check order locked.

**Pre-flight re-confirm (round 4, text-only, `82d8c0e8`): READY TO EXECUTE, no new PS.** All reorderChoice anchors verified (L12-16, L78-83, L111, L116-121, test header L5-9). RS-E (AC3 restates the full reorderChoice allowance) applied.

**Lint (00.3), run 1: FAIL (EC only), fixed.** F1 the EC Risk Tier line made verbatim (D-24800); F2 the EC field type gains `| undefined` (`exactOptionalPropertyTypes`, the `pendingOutOfTimeGrants` shape); F3 the `formatCardRef` rule moved into the WP Locked Values. Notes applied: file count, the "no new player-facing pending-choice type" wording, the `executeVillainAbilities` entry point, full EC paths, WORK_INDEX row names WP-871.


**Lint (00.3), run 2: FAIL (WP only), fixed.** F4 the Out of Scope resolve-moves line contradicted the reorder change (now excepts the drift branch); F5 T17's boardgame.io deep-dist import declared under the WP-411 / D-24223 exception (EC `// why:` line added). Notes applied: Contract field type `| undefined`; Assumes 14 names the PS-4 drift-case rewrite.

**Copilot (01.7), round 3: PASS → CONFIRM.** Round-2 P2-1..5 and lint F4 / F5 verified in both files; WP and EC agree; no new findings.

**Lint (00.3), run 3: PASS** (table below).

**Final gate state:** pre-flight READY TO EXECUTE (round 4) · copilot CONFIRM (round 3) · 00.3 PASS (run 3). Two optional lint run-3 nits left as is (EC "its only change" reads as "its only behavior change"; the Files entry for `reorderChoice.resolve.test.ts` defers to the Packet-specific allowance for the header sentence).

## Lint Gate Self-Review (00.3)

From the independent 00.3 runs: run 1 FAIL (EC: Risk Tier not verbatim, field type missing `| undefined`, `formatCardRef` locked only in the EC), run 2 FAIL (WP: Out of Scope contradicted the reorder change, T17's boardgame.io import undeclared), run 3 PASS. All five fixed.

| § | Result |
|---|---|
| §1 | PASS — all ten required sections; Out of Scope closed (7 items); 8 ACs |
| §2 | PASS — engine-wide block, session protocol, packet constraints with an exact per-line allowance for `reorderChoice.resolve.ts`, its test and `deferredHandInjection.logic.ts`; Locked Values; Out of Scope matches Scope B |
| §3 | PASS — Assumes 1-14 with anchors, append-order hazard, copy ids, feed deltas, the PS-4 rewrite; BLOCKED if any is false |
| §4 | PASS — ARCHITECTURE sections, 14 D-ids, memories; 00.2 not needed (marker append, no schema change) |
| §5 | PASS — 28 files (20 engine, 8 scripts / data, 2 new), each marked; expected-unchanged list; size justified by the WP-828 / WP-845 queue lockstep |
| §6 | PASS — card / group slugs and copy ids match `data/cards` and the marker map |
| §7 | PASS — no new dependency |
| §8 | PASS — engine plus data; one lazy JSON-serializable `G` field; RNG only through the existing `ShuffleProvider`; replay mirror excluded (D-24322) |
| §9 | PASS — `pnpm` / `node` / `git` only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — `node:test`, committed-data parsers, `executeVillainAbilities` dispatch, real pile constants, mock reverse shuffle, T17 under the WP-411 / D-24223 exception, three control runs + revert proof |
| §13 | PASS — exact commands with expected values; control runs name the tests that must fail |
| §14 | PASS — 8 binary ACs tied to T1-T18 |
| §15 / §15.1 | PASS — DoD covers ACs, allowlist, STATUS, DECISIONS, indexes, ledger; D-24026 live-verify recipe |
| §15.2 | PASS — Risk Tier MEDIUM, EC verbatim; not HIGH, so no threat model |
| §16 | PASS — full words, JSDoc, `// why:` sites enumerated, no `.reduce()`, no throws |
| §17 | PASS — §1 / §2 / §22 / NG-1; conflict line; determinism + replay-compat |
| §18 | N/A — no literal-string grep step |
| §19 | N/A at draft — commit-time (baseline SHAs cited) |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason |
| EC-TEMPLATE | PASS — 53 content lines (cap 100); Risk Tier verbatim; Locked Values match the WP |

**Verdict:** PASS.
