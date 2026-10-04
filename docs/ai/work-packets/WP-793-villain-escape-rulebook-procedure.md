# WP-793 — A Villain escape follows the rulebook: HQ KO, Bystander discard, then the Escape effect

**Status:** Draft 2026-10-04 · **EC:** EC-830 · **Reserves:** D-24656 (reserve PR #2578) · **BLOCKED on WP-749** (the sim
and PAR loops must resolve a seat choice addressed to a non-active seat)
**Primary Layer:** Game Engine (+ one arena-client prompt heading)
**User-Visible Surface:** play.legendary-arena.com (game log, HQ, every player's hand, the seat-choice prompt, score)
**Lane:** standard two-session (scoring input, simulation, determinism oracles; ineligible for the lightweight lane
under 01.0a criteria 1, 2, 6 and 8)
**Baseline:** `origin/main` @ `afd76ffe` (2026-10-04), plus the reserve commit `f5bf04a5` (#2578, ledger-only)

## Goal

When a Villain escapes, the engine runs the rulebook escape procedure in its printed order (rules v23 L556–L572):
1. the escaping Villain KOs a Hero costing 6 or less from the HQ; the player whose turn it is chooses which, and the
   HQ space refills from the Hero Deck;
2. if the Villain carried any Bystanders away, each player discards one card from their hand (one card per player,
   however many Bystanders);
3. the Villain's own Escape effect resolves.

The generic "current player gains a Wound" placeholder is removed. It was an MVP stand-in (D-1702, WP-017; gated by
D-24439) with no basis in any card, scheme or rule. Every path that pushes a Villain out of the City runs the same
procedure, including the Secret Invasion Skrull push, which today runs a reduced copy. A non-active player who
discards a return-on-discard card (core Cyclops, Unending Energy) can now answer that reaction from their own seat
instead of freezing the turn.

## User-Visible Impact

- Jeff's solo match `jjChx_MJ2gl` (2026-10-04, build `afd76ff`, Magneto / Midtown Bank Robbery, Brotherhood +
  Sentinel, Spider-Man / Captain America / Hulk; diagnostics
  `C:\pcloud\matches\Core\Magneto\magneto-MidtownBankRobbery-DIAGNOSTICS-1p-hulk.lagn.json`):
  - `16.1.2`–`16.1.4`: Blob escaped. The log reads "Player 0 gained a wound from villain escape." and "Bystanders
    from escaped villain Blob … carried into the Escaped Villains pile." No HQ Hero was KO'd and no card was
    discarded;
  - `30.1.4`–`30.1.6`: Blob escaped again (pushed by a Midtown twist's Villain-Deck play), with the same Wound, carry
    and no KO or discard;
  - `32.1.2`–`32.1.4`: Mystique escaped carrying a Bystander. There was no Wound (D-24439 gate), no KO and no
    discard, then her Escape turned into a Scheme Twist.
- After this packet, each of those escapes:
  - logs no Wound;
  - KOs an HQ Hero costing 6 or less. With two or more candidates the current player picks one in the seat-choice
    prompt ("A Villain escaped — choose a Hero in the HQ to KO"); with one candidate it is KO'd automatically; with
    none the log says so. The HQ space refills from the Hero Deck;
  - because each one carried a Bystander, asks every player with a card in hand to discard one ("Bystanders were
    carried away — choose a card to discard");
  - still runs the Villain's own Escape effect (Mystique's Scheme Twist) in the same move as before.

**Business impact.** Escapes are the most common bad outcome in a match, so this changes difficulty and scores in
almost every game.
- **Fewer Wounds.** Every ability-less escape gave the current player a Wound: a dead card in the deck and −1 VP
  (D-2001). That goes away, so `totalVP` rises. The competitive RawScore is lower-is-better:
  `rawScore = weightedPenaltyTotal − VP × weights.victoryPointReward` (`scoring/parScoring.logic.ts` ~L403), and the
  seed configs carry `victoryPointReward: 10`. Each avoided Wound is therefore +1 VP, which lowers (improves) RawScore
  by 10.
- **New costs.** Each escape removes an HQ Hero (the market churns, and the Hero Deck drains faster, which brings the
  Hero-Deck draw and Super Hero Civil War's loss closer). A Bystander-carrying escape costs every player a card.
- **Midtown Bank Robbery changes most.** Its whole threat is Bystander-carrying escapes, so almost every escape now
  costs every player a card.
- Scores on the same scenario before and after the deploy are not comparable. Stored competitive rows stay frozen;
  the history choice is OD-1.

## Assumes

- **Dependencies:**
  - **WP-749 / D-24573 (Draft 2026-09-22, NOT yet executed) — hard dependency.** The sim and PAR loops
    (`simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`) only enumerate `ctx.currentPlayer`
    (`simulation.runner.ts` ~L582–668). A seat choice addressed to another seat leaves the active seat with no legal
    move, and the game is flagged stuck. This packet's Bystander discard addresses every seat, so in any 2+ player sim
    every Bystander-carrying escape would stall. WP-749 adds the non-active-seat dispatch, its own post-move mirror
    block (ending in `continue`), the `runFixture` `resolveSeatChoice` entry and `simulation/seatChoiceDispatch.test.ts`.
    WP-758 is already blocked on it for the same reason. At execution, re-read WP-749's landed loop shape before
    placing the mirrors.
  - WP-684 / D-24501 ✅ (the seat-choice capability), WP-694 / D-24511 ✅ (the Monarch's Decree multi-seat discard
    this packet copies), WP-682 / D-24499 ✅ and D-24648 ✅ (the Diving Block onMove opener and the active-seat
    stage-ride skip), WP-498 / D-24301 ✅ (return-on-discard), WP-757 / D-24587 ✅ (`resolveVillainEscape`
    extraction), WP-508 / D-24314 ✅ (Bystander carry).
- **The escape procedure today.** `packages/game-engine/src/villainDeck/villainDeck.reveal.ts`
  `resolveVillainEscape` (~L571–731), in this order:
  - escape counter and `G.escapedPile` push (~L581–591);
  - the generic Wound, only when `!villainCardHasEscapeAbility` (~L593–615): `gainWoundForPlayer(G,
    ctx.currentPlayer)`, `G.turnEconomy.woundsDrawn += 1`, log "Player N gained a wound from villain escape.";
  - `carryEscapedBystandersToPile` and its log (~L617–635);
  - `executeVillainAbilities(…, 'onEscape', …)` and the "Escape effect:" log (~L637–676);
  - `koAttachedHeroesOnEscape` (~L678), the Mystique become-scheme-twist branch (~L680–721),
    `applyEscapedPileResourceLoss` (~L723–730).
  - Its context is `RevealContext` (`{ random, ctx: { currentPlayer } }`, ~L84–89). It has **no `events`**, so it
    cannot admit a non-active seat to a seat choice.
- **Every escape path** (the inventory in §Context): `performVillainReveal` (~L300–305), `enterCityIgnoringAmbush`
  (`villainDeck/villainDeck.enterCity.ts` ~L54–56) and the Secret Invasion twist
  (`rules/schemeTwistResolvers.ts` `secretInvasion` ~L670, reduced escape block ~L719–740, which bypasses
  `resolveVillainEscape`). The resolver signature already receives `RevealContext` and `ImplementationMap` (unused
  today, `_context` / `_implementationMap`).
- **The seat-choice capability** (`moves/seatChoice.resolve.ts`):
  - `G.pendingSeatChoice` is a single slot (`types.ts` ~L2091; `PendingSeatChoice` ~L1348, `SeatChoiceOption`
    ~L1298 with `label` and optional `cardId`);
  - `parkSeatChoice(G, events, choice, activePlayerToSkip?)` (~L230) overwrites the slot and stage-rides every
    addressed seat except the active one (D-24648);
  - `resolveSeatChoice` (~L298) applies through `applySeatChoiceByKind` (~L386–416) once every addressed seat has
    submitted, in ascending seat order, then clears the slot;
  - it is block-all for every action move and `advanceStage` (`game.ts` ~L233), `getLegalMoves` short-circuits to it
    at `defaultOptionIndex` (`simulation/ai.legalMoves.ts` ~L326–332), `resolveSeatChoice` is in
    `SIMULATION_MOVE_NAMES` and both sim `MOVE_MAP`s;
  - the audience filter sends a seat only its own options (`ui/uiState.filter.ts` ~L1289–1306), the client renders
    them in `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` with a heading keyed by `kind`
    (~L86–108);
  - `TurnActionBar.vue` `anyPendingChoice()` already includes it, so the start-stage reveal auto-advance waits for
    it (D-24648);
  - server autoplay (`findSeatChoiceActingSeat`, D-24590) and the bot-ally driver (D-24593) answer a seat choice
    owed by a non-active bot seat.
- **The Monarch's Decree multi-seat discard** (`moves/seatChoiceTactics.ts`): `buildMonarchsDiscardChoice` (~L198)
  addresses every listed seat holding a card, one option per hand card (`label` = name, `cardId`),
  `defaultOptionIndex: 0`; `applyMonarchsDiscard` (~L244) discards through `discardFromHand`.
- **The Diving Block onMove opener** (`moves/divingBlock.logic.ts` `openDivingBlockSeatChoiceIfNeeded` ~L243),
  called from the play phase `turn.onMove` (`game.ts` ~L821). It parks with the move's `events`, skips the active
  seat, and returns early while any seat choice is open.
- **The discard chokepoint** `discardFromHand(G, playerID, cardId)` (`moves/discardFromHand.ts` ~L198–220) runs
  `checkReturnOnDiscard` (~L98) and `checkTeleportOnDiscard`. `checkReturnOnDiscard` appends `{ playerID, cardId }`
  to `G.pendingReturnOnDiscard` for ANY seat. `resolveReturnOnDiscard` (`moves/resolveReturnOnDiscard.ts` ~L106)
  accepts only `front.playerID === playerID` (~L139), and boardgame.io admits only the current player. A non-active
  seat's entry therefore freezes the turn today (Monarch's discard, the Magneto strike and Covering Fire auto-discards
  can all reach it). This packet's discard reaches it on every Bystander-carrying escape in a 2+ player match.
- **HQ helpers.** `refillHqSlot(hq, hqIndex, heroDeck)` (`board/city.logic.ts` ~L204) leaves the slot `null` on an
  empty Hero Deck (D-13503). `koCard(ko, cardId)` (`board/ko.logic.ts`). `G.cardStats[id].cost`. Haunters stay in
  their HQ space when the Hero leaves (`board/haunt.logic.ts` header, D-24587).
- **Hero-Deck depletion.** `latchFinalTurnIfDeckExhausted` and `applyPileDepletionResourceLoss` run at the top of
  `turn.onMove` (`game.ts` ~L787 / ~L794) and in both sim loops (Super Hero Civil War, D-24318). The deck-out tie
  latch is in `endgame/finalTurn.logic.ts` ~L37–60. Both run **before** an opener at the end of `turn.onMove`, so an
  opener's automatic KO refill would be caught only on the next move without the re-check locked below.
- **Pending-choice and endgame helpers.**
  - `moves/phaseCard.ts` `hasAnyPendingChoice` (~L81) is module-private today. It holds 31 checks, including
    `hasPendingSeatChoice` and `hasPendingReturnOnDiscard`, and does **not** check `G.pendingHeroChoice`. That is the
    WP-427 reveal-discard-or-return slot, guarded separately (`game.ts` ~L250, `coreMoves.impl.ts` ~L605).
  - `endgame/endgame.evaluate.ts` `evaluateEndgame(G)` (~L29) returns `null` while the match is undecided.
  - `ui/uiState.build.ts` ~L2111–2117 projects the front `pendingReturnOnDiscard` entry for any owner today, gated only
    on `!hasPendingDiscardToPlay`.
- **End-of-game drop.** `endgame/mastermindVictory.logic.ts` `dropAllPendingPlayerChoices` (~L89) clears every
  `pending*` field; `mastermindVictory.logic.test.ts` (~L120) pins the list.
- **Determinism oracles.** The only replay fixture, `test/fixtures/games/sentinel-core-doom-2p.replay.json`, contains
  no escape. `PRE_WP080_HASH` (`replay/replay.execute.test.ts` ~L181) replays no moves. `replay/replay.execute.ts`
  deliberately does not mirror `turn.onMove` (its header, D-0205 posture). The runtime-observed sweep
  (`scripts/runtime-observed-hollows.mjs`, `RUN_SEED` `wp265-real-v1`, 312 one-player games, Portals / Dr. Doom /
  Brotherhood) escapes Villains in most games.
- **No new dependencies.** No package, script or workflow is added.
- **Suites at baseline (scaffold worktree on `f5bf04a5`, after `pnpm -r build`):** game-engine 4838 / 0; arena-client
  2262 / 0; dashboard 570 / 0; server 1659 / 0 fail; registry 253, preplan 52, engine-runner 20, replay-producer 4,
  legends-board 135: 0 fail. Re-record at execution (WP-749 lands first and moves them).

## Context (Read First)

**Rules (authoritative; Jeff's physical rulebook p.15 matches).** `docs/legendary-universal-rules-v23.md`:
- L556–L570: the three-step procedure quoted in §Goal, "in this order";
- L573–L575: handle every Escape effect of the escaping Villain before the new Villain's Ambush;
- L1037–L1039 (Astral Plane) and L2826–L2829: an escape from a card effect "causes all the same effects … (including
  KO'ing from the HQ, discarding from captured Bystanders, and Escape abilities)";
- L1533: an escape can KO a Haunted Hero that costs 6 or less;
- L1952–L1957: a Combined Villain is one escape, one KO, one discard;
- L3447–L3449: escaping with captured Heroes (not Bystanders) causes no discard;
- L3327–L3330: "do as much as you can" (no eligible HQ Hero, or an empty hand, is a no-op).

**Why the Wound goes.** D-1702 (~L2557, WP-017) introduced it as "a reasonable MVP default". The code and later
entries call it "WP-015"; WP-015 only added the escape counter and message, so that label is a misattribution.
D-24439 (~L38938) found it had "no basis in the card text, the scheme text or the Legendary rules" and gated it
rather than removing it because removal "would leave ability-less villains with no escape penalty at all". This packet
supplies the real penalty. A scan of every scheme and Mastermind in `data/cards/*.json` found **no printed per-escape
Wound**, so the placeholder was not standing in for any printed text.

**Escape-path inventory (verified 2026-10-04).**

| Path | Site | Stage | Runs `resolveVillainEscape` today |
|---|---|---|---|
| Villain-Deck reveal push-off | `performVillainReveal` ~L300 | start (the reveal move); main when chained from a fight (Endless Armies of HYDRA, `fightVillain.ts` ~L509) or Shadowed Thoughts (`playVillainTop.resolve.ts` ~L106); either via The Leader's Ambush (~L392) or a twist's chained reveal (`schemeTwistResolvers.ts` ~L267 Negative Zone, ~L579 Midtown) | yes |
| Haunt exorcise release | `enterCityIgnoringAmbush` (`exorciseHauntedHero.ts` ~L235) | main | yes |
| Secret Invasion Skrull push | `secretInvasion` ~L713–740 | inside a twist (start, or wherever the reveal ran) | **no** — counter, pile, carry, captured-Hero KO and resource loss only |
| Mystique's become-scheme-twist | the secondary site inside `resolveVillainEscape` ~L690 | inherits | it is part of step 3, and its twist can chain more escapes |
| `hero-deck-top-to-escape` | `villainEffects.execute.ts` ~L1061 | — | not an escape (a Hero card into the pile; no counter) |

- Not escapes: `defeatCityVillainCore` (defeat), Whirlwind's `swap-two-city-villains` (swaps positions, nothing leaves),
  `haunt-hq-hero` (the Villain moves under an HQ Hero).
- No card, keyword, strike or tactic makes a Villain escape "instantly". `[keyword:Charge]` (ssw2) would push Villains
  but is unimplemented (`board/boardKeywords.types.ts` ~L16).
- The sim runner, PAR aggregator, sweep runner, engine-runner, replay harnesses and the server autoplay / bot-ally
  loops all call the real move functions. **No harness reimplements the escape.** They differ only in which
  `turn.onMove` effects they mirror, which is why this packet adds its openers to the two sim loops and `runFixture`.

**Design: why a seat-choice queue opened from `turn.onMove`.**
- `resolveVillainEscape` has no `events`, can run several times in one move (chained reveals, Mystique's twist), and
  the seat-choice slot holds one choice. So an escape **records** what it owes on a `G`-only FIFO
  (`G.pendingEscapeProcedures`), and `turn.onMove` **opens** it, exactly as Diving Block's Wound queue opens its waves
  (D-24499 / D-24648). Every escape path, in every stage, is covered by one opener.
- **Step 1 is a single-seat seat choice** addressed to the current player. The active seat needs no stage ride
  (D-24648), the prompt, projection, filter, bot short-circuit, sim dispatch, End-Turn / auto-advance gate and
  disconnect posture already exist, and no new move is registered. 0 eligible → a logged no-op; exactly 1 → automatic
  KO; 2+ → the choice. That is the shared 0 / 1 / 2+ rule (D-24006, D-24007, D-24343, D-24644). The alternative, a new
  active-player queue or an extension of the Paibok give-HQ-Hero queue, needs a new move or a projection change plus
  the 14-site block-all guard set for no gain in order or fidelity.
- **Step 2 is a simultaneous multi-seat seat choice** (D-24501), a copy of Monarch's Decree's discard (D-24511):
  every seat holding a card is addressed, a seat with an empty hand is not, and each discards one card through
  `discardFromHand`, so return-on-discard and teleport-on-discard see it as a card-effect discard. A one-card hand
  still prompts, as Monarch's does, because a multi-seat choice applies atomically (D-24501 §3). Each player chooses
  their own card, which is the printed rule; the D-24284 "current player chooses, others auto-pick" split is not used
  because the multi-seat capability now exists.
- **Order.** The opener:
  - runs before Diving Block's;
  - waits while any pending player choice is open (a seat choice, a return-on-discard reaction, or a step-3 choice
    such as the Juggernaut Escape's hand KO), so a step-3 pick resolves first and prompts never stack;
  - opens nothing once the match is decided;
  - resolves an escape's step 1 before opening its step 2;
  - drains escapes in the order they happened.
- **Accepted deviation (recorded in D-24656 point 4).** The engine cannot suspend a move halfway. Steps 1 and 2
  therefore resolve **after** the move that caused the escape finishes. Step 3, the escape's other automatic
  consequences, the entering Villain's Ambush and the rest of the reveal resolve first, in the same move as today. The
  HQ and hands are read when the choice opens. Effects of this:
  - a hand-reading Escape effect (`reveal-or-wound`, Juggernaut's KO-two-from-hand) sees the hand before the
    Bystander discard;
  - an Ambush that touches the HQ resolves before the escape's KO pick.
  The other options are worse:
  - Deferring step 3 as well would fire the new Villain's Ambush before the old Villain's Escape, against L573 and the
    existing escape-before-Ambush ordering test.
  - Suspending the reveal pipeline is an engine-wide continuation change, out of scope (OD-3).
  - The universal pending-choice model already parks and continues this way (D-24284 Magneto strike, D-24644
    Juggernaut).
- **Non-active return-on-discard.** A second `turn.onMove` opener converts a front `G.pendingReturnOnDiscard` entry
  owned by a non-active seat into a single-seat seat choice for that seat ("Return X to your hand?" / "Leave X in
  your discard pile"). Its apply repeats `resolveReturnOnDiscard`'s short mutation. Without it, a
  Bystander-carrying escape in a 2+ player match (including a bot-ally match) freezes the turn whenever a non-active
  player discards Unending Energy. The fix also closes the same latent freeze for Monarch's discard. The active
  player's own entries keep using `resolveReturnOnDiscard`, unchanged. The legacy `pendingReturnOnDiscard` projection
  is gated to the active player, so a non-active owner never sees two prompts for one entry.
- **Stage ride.** A one-seat choice addressed to the active player (the KO) is parked with the D-24648 skip. A
  multi-seat choice that includes the active player (the discard) is parked with no skip, as Random Acts' pass-left
  is, so every addressed seat, the active one included, can submit in any order.

**Empirical scaffold (2026-10-04).** On a throwaway worktree of `f5bf04a5` (removed after the run):
1. **Deferred-semantics probe.** The generic Wound was removed, a `pendingEscapeProcedures` entry was appended at the
   escape site, and Secret Invasion was routed through `resolveVillainEscape`. Then `pnpm -r build` and the engine
   suite ran. Observed: engine 4838 → **8 fail**, every one a generic-Wound assertion:
   - `board/escape-wound.integration.test.ts`: L122 (asserts at L141) and L221 (L241);
   - `economy/economy.integration.test.ts`: L344 (L356);
   - `moves/exorciseHauntedHero.test.ts`: L251 (L269);
   - `villainDeck/villainDeck.enterCity.test.ts`: L132 (L164);
   - `villainDeck/villainDeck.reveal.test.ts`: L1216 (L1255), L1804 (L1874), L2263 (L2293).
   `test/fixtures/replayFixtures.test.ts` (sentinel `finalStateHash`) and `replay/replay.execute.test.ts`
   (`PRE_WP080_HASH`) stayed green. The extra `G` field broke nothing else, and the Secret Invasion suites stayed
   green.
2. **Trajectory probe.** Steps 1 and 2 ran inline at the bot defaults (cheapest eligible HQ Hero; each seat's first
   hand card). This approximates the deferred opener plus the bot's `defaultOptionIndex` 0. Observed:
   - `sim:runtime-observed:check`: **stale**. Regenerated: 7959 → **7980** observations, 80 → **81** mechanics,
     **0 dropped**, all 312 games terminate;
   - dashboard `useInPlayCoverage.test.ts` ~L543 after `prebuild:coverage`: `totalObs` 8884 → **8903** (the only
     dashboard failure);
   - `sim:coverage --check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`,
     `ledger:villains:check`: OK, no diff;
   - arena-client 2262 / 0, server 1659 / 0 fail, registry, preplan, engine-runner, replay-producer, legends-board,
     registry-viewer: 0 fail.
3. **Real-opener probe** (round 2, after pre-flight PS-4). This prototype ran the queue for real:
   - `enqueueEscapeProcedure` sits at the escape site;
   - `openEscapeProcedureSeatChoiceIfNeeded` is wired into `game.ts` `turn.onMove`, guarded by `evaluateEndgame` and
     followed by the depletion re-check;
   - it parks real `escape-hq-ko` and `escape-bystander-discard` seat choices (mixed rides with no skip) and applies
     them through `applySeatChoiceByKind`;
   - the sim runner, PAR aggregator and `runFixture` mirror it.

   `pnpm -r build` exits 0. Per-package results:
   - game-engine 4838 → the **same 8** failures as probe 1 and nothing else;
   - server 1659 / 0 fail (the DB-backed tests skip locally). `replay/matchReplay.logic.test.ts`, which drives real
     boardgame.io matches with blind `advanceStage` calls, passes, including its `turnCount` reconciliation case;
   - arena-client 2262 / 0, engine-runner 20 / 0, replay-producer 4 / 0, legends-board 135 / 0, registry 253 / 0,
     preplan 52 / 0;
   - `sim:runtime-observed` regenerated: **7980** observations, 81 mechanics, 0 dropped, 312 terminate (identical to
     probe 2);
   - dashboard `totalObs` **8903** (the only dashboard failure);
   - `sim:coverage --check`: OK.

   The prototype did not include the return-on-discard opener or the projection gate (both are no-ops in the
   one-player sweep). WP-749 and WP-792 land first and move the baselines, so the executor re-records every value.

**PAR.**
- Seed PAR (`data/par/seed/**`) is difficulty-rating driven and its files are unchanged. Its per-scheme anchors
  (WP-591; Midtown Bank Robbery included) were calibrated under the old escape costs, though. Grades on Midtown and
  other Bystander-heavy schemes will shift relative to the frozen seed PAR; that goes to OD-2.
- The diagnostic profiles (`data/par/profile/v1/**`, `scripts/generate-par-profiles.mjs`, `authoritative: false`,
  multi-player) go stale. Nothing gates them. They can only be re-pinned after WP-749 lands; see OD-2.

**Scores and competitive history.** This is **wider than the WP-792 / D-24654 window**:
- Live play in a match in progress at deploy continues normally. Its next escape runs the new procedure.
- **Re-executing any log that contains a pre-deploy escape stalls.** Under the new rules the first such escape parks a
  seat choice. The recorded log has no `resolveSeatChoice`, so every later recorded move is a silent block-all no-op,
  and the reconstruction stops at that escape. Affected:
  - competitive submit-by-match and submit-by-`replayHash` verification (`replay_verification_failed`);
  - the coach (`apps/server/src/coach/coach.logic.ts`, `reduceReplayByHash`);
  - every match that was in progress at deploy, whose log mixes pre- and post-deploy moves.
  `scenarioKeyRekey` reads only `selection` and is unaffected. Replays are durable in `bgio.replay_artifacts`, so for
  a pre-deploy match this is permanent. Accepted (OD-1); no migration.
- Stored `competitive_scores` rows stay frozen (D-24616 §5). No stored-data change.

**Read:**
- `docs/ai/DECISIONS.md`: D-1702, D-2001, D-24439, D-24440, D-24314, D-24315, D-18603, D-24287, D-24587, D-24501,
  D-24511, D-24499, D-24648, D-24301, D-24527, D-24644, D-24284, D-24006, D-24007, D-13503, D-24318, D-24616 §5,
  D-24081, D-24573 (WP-749, reserved). Scan for any later entry touching escapes before starting.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary and §Disconnect & Reconnect Semantics (D-11602 pause-and-preserve);
  `.claude/rules/architecture.md` §Move & Phase Rules and §UIState Projection Integrity.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 (no setup-payload change) and the `ext_id` / `CardExtId`
  conventions.
- `docs/ai/work-packets/WP-749-sim-non-active-seat-choice-dispatch.md` (the dependency's loop branch).
- `wiki/villain-deck.md` §Step 4 (describes the generic Wound as current behavior; updated by this packet).

**WP-792 relationship.** WP-792 (PR #2580, D-24654) retires the D-15401 Master Strike capture placeholder.
- **Shared ground.** Both packets:
  - retire an MVP placeholder;
  - move scores, so both feed OD-1;
  - regenerate `docs/ai/coverage/runtime-observed-hollows.json` and the dashboard `totalObs` pin;
  - leave the PAR profiles stale.
- **Order.** WP-792 first, then WP-749, then WP-793. Whichever merges second re-runs `pnpm sim:runtime-observed` and
  the dashboard `prebuild:coverage` on top of the first, so its pin values are not the scaffold's.
- **Sentinel.** WP-793 does not touch the sentinel fixture (it has no escape); WP-792 re-records it.
- **Merge-conflict surfaces:** the `DECISIONS.md` tail (both append before "Protect this file."), the top of
  `WORK_INDEX.md`, the `EC_INDEX.md` tail, the mindmap and its generated count table (regenerate with
  `pnpm roadmap:counts:write`, never hand-merge), and `docs/ai/STATUS.md` at govern-close.
- **PAR.** A single PAR profile re-pin after both packets and WP-749 is the cheapest path (OD-2).

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- Never `Math.random()`; randomness only via `ctx.random.*` (none is added here). No I/O in moves, hooks or helpers.
  Moves never throw.
- `G` stays JSON-serializable. Zones store `CardExtId` strings only. No `.reduce()` in zone operations.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test` + `makeMockCtx`. Pure helpers and their tests import
  no `boardgame.io` (the existing `game.test.ts` reducer import is the only exception and is not extended).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full-word names, JSDoc on every function, functions
  ≤ ~30 lines, explicit loops, no nested ternaries.

**Packet-specific:**
- **No new move.** `LegendaryGame.moves`, `SIMULATION_MOVE_NAMES`, both sim `MOVE_MAP`s and the `game.test.ts`
  move-registration pin are unchanged. No new `hasPending*` block-all guard: the open seat choice is the block.
- **No new client-visible `UIState` field.** The choices ride the already-projected `pendingSeatChoice` (its `kind` and
  per-seat options are already built, filtered and rendered). `G.pendingEscapeProcedures` is engine-internal, like
  `G.pendingDivingBlockWounds`, and is not projected. The only `ui/` edit is the `pendingReturnOnDiscard`
  active-player gate in `buildUIState`. It narrows when an existing field is emitted; it adds no field.
- **No generic escape Wound.** After this packet nothing in `resolveVillainEscape` calls `gainWoundForPlayer` or
  touches `G.turnEconomy.woundsDrawn`. A Villain's own printed Escape Wound (`gainWoundEachPlayer`, `reveal-or-wound`,
  …) is unchanged.
- **Step 3 is untouched.** The onEscape dispatch, the captured-Hero KO, the Mystique branch and the resource-loss
  check keep their code and their order inside the move.
- **Every hand→discard goes through `discardFromHand`** (enforced by `moves/discardFromHand.test.ts`).
- **Existing-test edits are limited to** the authorized list in §Scope (In) G, the dashboard `totalObs` pin, and
  the `ALL_PENDING_FIELDS` addition in `mastermindVictory.logic.test.ts` (§Scope F). Every other existing test file
  only gains new cases.
- **Oracle re-pins are limited to the forced list** in §Files Expected to Change, each produced by its regenerator,
  never by hand. The sentinel fixture and `PRE_WP080_HASH` stay byte-unchanged.
- **Do not regenerate** `data/par/profile/**` or `data/par/seed/**`. No database access, no migration.
- **Session protocol — STOP and report, do not guess, if:**
  - WP-749 has not merged to `main`, or a Before Starting check differs from §Assumes;
  - an existing test outside §Scope (In) G fails;
  - the sentinel `finalStateHash` or `PRE_WP080_HASH` moves;
  - `sim:runtime-observed` reports a non-terminating game or a dropped mechanic;
  - any gate other than the forced re-pins shows a diff.

## Locked Contract Values

- **Kinds and constants** (exported from `villainDeck/villainEscapeProcedure.ts` unless noted):
  - `ESCAPE_HQ_KO_KIND = 'escape-hq-ko'`;
  - `ESCAPE_BYSTANDER_DISCARD_KIND = 'escape-bystander-discard'`;
  - `ESCAPE_HQ_KO_MAX_COST = 6` (with a `// why:` citing rules v23 L561);
  - `RETURN_ON_DISCARD_SEAT_CHOICE_KIND = 'return-on-discard'` (exported from `moves/resolveReturnOnDiscard.ts`).
- **State** (`types.ts`, beside `pendingDivingBlockWounds`):
  ```ts
  export interface PendingEscapeProcedure {
    escapedCardId: CardExtId;
    chooserPlayerID: string;
    hasCarriedBystanders: boolean;
    isHqKoResolved: boolean;
  }
  // on LegendaryGameState:
  pendingEscapeProcedures?: PendingEscapeProcedure[] | undefined;
  ```
  The field is created lazily by the first escape. When the queue empties it is removed with
  `delete G.pendingEscapeProcedures` (the Diving Block precedent, `divingBlock.logic.ts` ~L334–336). Only
  `dropAllPendingPlayerChoices` assigns `undefined`, which is that file's pattern. Nothing writes it in `Game.setup()`.
- **Escape site** (`resolveVillainEscape`):
  - delete the generic-Wound block (~L593–615);
  - after the Bystander carry and before the onEscape dispatch, call
    `enqueueEscapeProcedure(G, escapedCardId, ctx.currentPlayer, hasCarriedBystanders)`, where
    `hasCarriedBystanders` is "the carry grew `G.escapedPile`" (the existing length comparison);
  - every later line is unchanged.
- **Opener** `openEscapeProcedureSeatChoiceIfNeeded(G, events, currentPlayer)`. It returns at once when any of
  these holds:
  - **any** pending player choice is open: `hasAnyPendingChoice(G)` from `moves/phaseCard.ts`, which this packet
    exports unchanged. It covers the open seat choice, `pendingReturnOnDiscard` (so a discard's return reaction
    resolves before the next step opens), and every active-player queue, such as the Juggernaut Escape's
    `pendingKoHeroChoices`. A step-3 choice therefore always resolves before that escape's steps 1–2 open, as recorded
    in point 4 of D-24656, and the two kinds of prompt never stack. One exception: a Diving Block reaction to a
    step-3 Escape Wound can still open after steps 1–2. That is harmless, because the reveal undoes a Wound that has
    already landed. The aggregate does not cover `G.pendingHeroChoice`
    (the WP-427 reveal-discard-or-return choice), so the opener also returns while `G.pendingHeroChoice !== undefined`;
  - `evaluateEndgame(G) !== null`, so a match that the escape ended never parks a prompt.

  The `evaluateEndgame` check is made at the **head of every loop iteration**, not once per call. After an automatic
  one-Hero KO, the opener calls `applyPileDepletionResourceLoss(G)` before the next iteration, so a refill that
  empties the Hero Deck on a Hero-Deck scheme ends the loop before step 2 parks.

  Otherwise it loops over the front entry:
  - **Step 1, when `isHqKoResolved` is false.** Eligible = non-null `G.hq` slots whose `G.cardStats[id].cost`
    (missing → 0) is ≤ `ESCAPE_HQ_KO_MAX_COST`, sorted cost ascending then slot ascending.
    - 0 eligible: log the no-op line and mark the step resolved.
    - 1 eligible: KO it and mark the step resolved.
    - 2+ eligible: mark the step resolved, park the `ESCAPE_HQ_KO_KIND` choice addressed to
      `[entry.chooserPlayerID]` with `parkSeatChoice(G, events, choice, currentPlayer)`, and return.
  - **Step 2, otherwise.** Pop the entry. If `hasCarriedBystanders`, build the discard choice:
    - when no seat holds a card, log the no-op line and continue;
    - otherwise park it and return. The active seat is skipped from the stage ride **only when it is the sole
      addressed seat**: `parkSeatChoice(G, events, choice, currentPlayer)` for a one-seat choice that addresses
      `currentPlayer`, and `parkSeatChoice(G, events, choice)` for every other choice (the Random Acts pass-left
      precedent, `seatChoice.resolve.ts` ~L450). If the active seat were skipped from a mixed ride, boardgame.io would
      set `activePlayers` to the non-active seats only and reject the active seat's own submission until they all
      answered. Autoplay would then abort and bot-ally would fault. `buildSeatChoiceActivePlayersValue` itself is not
      changed; `seatChoice.resolve.test.ts` ~L237 / ~L254 pin its mixed-choice skip.
  - When the queue empties, `delete G.pendingEscapeProcedures`.
- **Depletion re-check.** Directly after the two openers, `turn.onMove` calls `latchFinalTurnIfDeckExhausted(G)` and
  `applyPileDepletionResourceLoss(G)` again (both idempotent). An automatic KO's refill that empties the Hero Deck is
  then caught on the same move, not the next one.
- **HQ KO mutation** (pure helpers; the `koFromHq` template at `schemeTwistResolvers.ts` ~L479–492):
  `G.hq[slot] = null; G.ko = koCard(G.ko, cardId); const refill = refillHqSlot(G.hq, slot, G.heroDeck);
  G.hq = refill.hq; G.heroDeck = refill.heroDeck;`.
- **Import cycles.** `seatChoice.resolve.ts` imports the applies, and the new module imports `parkSeatChoice`.
  `resolveReturnOnDiscard.ts` has the same shape. A third cycle runs: new module → `moves/phaseCard.ts` →
  `seatChoice.resolve.ts` / `resolveReturnOnDiscard.ts` / `playVillainTop.resolve.ts` → new module. `phaseCard.ts`
  holds only imports and functions at top level. These cycles are safe only while every cross-reference sits inside
  a function body, with no top-level map keyed by an imported constant. Each new import carries the `// why:` cycle
  note that `divingBlock.logic.ts` ~L25–28 uses.
- **Options:**
  - **HQ KO:** one per eligible Hero, in eligibility order, `{ label: '<name> (cost <N>)', cardId }`;
    `defaultOptionIndex: 0`.
  - **Discard:** addressed seats = `Object.keys(G.playerZones).sort()` filtered to non-empty hands; per seat one
    option per hand card in hand order, `{ label: '<name>', cardId }`; `defaultOptionIndex: 0` (the Monarch's Decree
    precedent).
- **Applies** (dispatched in `applySeatChoiceByKind` before the `applySeatChoiceCard` fallback):
  - `applyEscapeHqKo(G, choice)`: the chosen `cardId` must still be in `G.hq`, else a logged no-op. Set the slot to
    `null`, `koCard`, then `refillHqSlot`. The Villain named in the log line is read from
    `G.pendingEscapeProcedures[0].escapedCardId`; the entry stays at the front until step 2 pops it.
  - `applyEscapeBystanderDiscard(G, choice)`: each submitted seat, ascending, calls
    `discardFromHand(G, seat, cardId)`.
  - The automatic one-Hero KO uses the same KO helper as `applyEscapeHqKo`.
- **Log lines** (`pushLog`, names via `formatCardRef(G.cardDisplayData, id)`):
  - KO: `` `Escape: ${villain} KO'd ${hero} from the HQ.` ``
  - no eligible Hero: `` `Escape: ${villain} KO'd nothing — no Hero in the HQ costs 6 or less.` ``
  - discard, per seat: `` `Player ${seat} discarded ${card} (Bystanders carried away).` `` (outcome `'applied'`)
  - no hand to discard from: `` `Escape: no player has a card to discard for the Bystanders carried away.` ``
- **Return-on-discard opener** `openNonActiveReturnOnDiscardSeatChoiceIfNeeded(G, events, currentPlayer)`. It
  returns at once while a seat choice is open, when the front entry's `playerID === currentPlayer`, or when
  `evaluateEndgame(G) !== null`. Otherwise it
  parks a choice addressed to `[front.playerID]` with options:
  - `[{ label: 'Return <name> to your hand', cardId: front.cardId }, { label: 'Leave <name> in your discard pile',
    cardId: front.cardId }]`. The apply proceeds only when the queue's front entry still has `playerID` equal to the
    addressed seat and `cardId` equal to the option's `cardId`; otherwise it is a logged no-op;
  - `defaultOptionIndex: 0`, matching the bot's existing return-when-eligible default.
  Its apply **duplicates** the ~10-line mutation of `resolveReturnOnDiscard` steps 3–5 (00.6: duplicate first;
  abstract only at a third copy): decline front-pops and logs; return moves discard → hand via `moveCardFromZone`,
  logs, then front-pops. The legacy move's body is not refactored; its only change is the guard below. If the front
  entry is no longer the one the choice was built for (it was already popped), the apply is a logged no-op.
- **Legacy-move guard.** `resolveReturnOnDiscard` returns at once (no change) while
  `G.pendingSeatChoice?.kind === RETURN_ON_DISCARD_SEAT_CHOICE_KIND`. The ridden seat's empty stage still accepts
  global moves, so a stale client or a crafted submission of the legacy move would otherwise pop the entry out from
  under the choice. Before this packet that state could not occur, so the move is byte-identical for every state that
  was reachable before.
  - This guard is **defense in depth**. boardgame.io counts even a no-op move against the ridden seat's
    `moveLimit: 1`, so any off-prompt global move from a ridden seat still forfeits its admission. That is a
    pre-existing property of every D-24501 seat choice (Random Acts, Monarch's Decree, Diving Block), not new here.
  - The real protection is the projection gate: a well-formed client never shows a ridden seat any other prompt.
  - Hardening the stage ride itself (for example, a stage `moves` map limited to `resolveSeatChoice`) is a separate
    follow-up (OD-3).
- **Return-on-discard projection gate** (`ui/uiState.build.ts` ~L2099–2128). `pendingReturnOnDiscard` is projected
  only when the front entry's `playerID === currentPlayer`; `buildUIState` already receives it. A non-active owner
  sees only the seat choice. Without the gate it would also see the legacy prompt. One click there pops the entry and
  spends the seat's single stage-ride move (`moveLimit: 1`), and the seat choice addressed to that seat could then
  never be answered.
- **`turn.onMove` order** (`game.ts`, after `resolveDeferredHeroGrants`):
  1. `openNonActiveReturnOnDiscardSeatChoiceIfNeeded(G, events, ctx?.currentPlayer)`;
  2. `openEscapeProcedureSeatChoiceIfNeeded(G, events, ctx?.currentPlayer)`;
  3. the depletion re-check above;
  4. the existing `openDivingBlockSeatChoiceIfNeeded`.
- **Sim and fixture mirrors.** Openers 1 and 2 are mirrored with `events` undefined:
  - `simulation/simulation.runner.ts` and `simulation/par.aggregator.ts`: at **every** post-move mirror site, each
    followed by `applyPileDepletionResourceLoss(gameState)` (both loops already mirror it). The sites are the existing
    one after `resolveDeferredHeroGrants` and the non-active-seat branch WP-749 adds, before that branch's `continue`.
    The `currentPlayer` argument is the loop's active seat (the loop variable `currentPlayer`), never the move
    context's `ctx.currentPlayer`, which both harnesses set to the acting seat.
  - `test/fixtures/runFixture.ts`: the two openers only, after its `resolveDeferredHeroGrants` mirror, with
    `cursor.currentPlayer`. No depletion mirror is added there (out of scope since WP-749). Its header comment
    ("mirrors no other onMove effect") is corrected to name the two openers.
- **Secret Invasion.**
  - Move the vacated slot's `refillHqSlot` (~L742–746) **before** the City push's escape handling, so the HQ is
    full when the escape resolves. The rule says "immediately flip a new Hero"; it also keeps a nested twist from
    Mystique's Escape from seeing a `null` slot.
  - Then replace the reduced escape block (~L719–740) with
    `resolveVillainEscape(gameState, context, implementationMap, pushResult.escapedCard)`, renaming `_context` /
    `_implementationMap`.
  - Remove an import only if it becomes unused.
- **`villainDeck.reveal.ts` imports.** Remove the `gainWoundForPlayer` import (~L27), and `villainCardHasEscapeAbility`
  from the `villainEffects.execute.js` import (~L42), because both become unused there. The function itself stays
  exported. Rewritten comments describe the removed Wound in words, without those identifiers, so the AC1 /
  Verification `Select-String` on `villainDeck.reveal.ts` stays clean.
- **Client headings** (`PendingSeatChoicePrompt.vue`):
  - `'escape-hq-ko'` → `A Villain escaped — choose a Hero in the HQ to KO`;
  - `'escape-bystander-discard'` → `Bystanders were carried away — choose a card to discard`;
  - `'return-on-discard'` → `Return the discarded card to your hand?`.

## Scope (In)

### A) Engine — the escape procedure
- `villainDeck/villainEscapeProcedure.ts` (**new**): the constants, `enqueueEscapeProcedure`,
  `openEscapeProcedureSeatChoiceIfNeeded`, the two builders, the shared HQ-KO helper and the two applies, as locked
  above. No other export.
- `villainDeck/villainDeck.reveal.ts`: remove the Wound and enqueue. Rewrite the stale comments:
  - the `resolveVillainEscape` JSDoc ("the generic per-escape wound …");
  - the D-24439 `// why:` block;
  - the onEscape `// why:` ("The generic per-escape current-player wound above (WP-015 …) is PRESERVED");
  - the Mystique `// why:` ("wound / bystander release …");
  - the resource-loss `// why:` ("current-player wound", "the only place G.escapedPile grows").
  Each cites D-24656.
- `villainDeck/villainDeck.enterCity.ts`: comment only — the header and the `enterCityIgnoringAmbush` JSDoc list "the
  generic wound"; they now name the rulebook procedure (D-24656).
- `rules/schemeTwistResolvers.ts`: Secret Invasion routes through `resolveVillainEscape`.
- `moves/phaseCard.ts`: `export` on the existing `hasAnyPendingChoice`, with no body change, so the opener reuses the
  aggregate instead of adding another copy of the inlined guard cluster.
- `types.ts`: `PendingEscapeProcedure` and the optional field.

### B) Engine — wiring
- `moves/seatChoice.resolve.ts`: dispatch the three kinds in `applySeatChoiceByKind`.
- `game.ts`: the two openers in `turn.onMove`, each with a `// why:` (D-24656; why before Diving Block).
- `endgame/mastermindVictory.logic.ts`: `gameState.pendingEscapeProcedures = undefined;` in
  `dropAllPendingPlayerChoices`, with a `// why:`.

### C) Engine — return-on-discard for a non-active seat
- `moves/resolveReturnOnDiscard.ts`: the kind constant, `openNonActiveReturnOnDiscardSeatChoiceIfNeeded`, the
  seat-choice apply (which duplicates the short decline/return mutation), and the legacy-move guard. The body of
  `resolveReturnOnDiscard` is otherwise untouched, and its behavior is byte-identical for every state that was
  reachable before.
- `ui/uiState.build.ts`: the projection gate locked above. This is a read-only `ui/` change; the field, its type and
  its filter disposition are unchanged.

### D) Simulation and fixture parity
- `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `test/fixtures/runFixture.ts`: mirror openers 1
  and 2 at the sites and with the argument locked above, each with a `// why:` naming the live `turn.onMove` order.
- No `getLegalMoves` change: its seat-choice short-circuit already answers every kind at `defaultOptionIndex`, and
  WP-749 dispatches non-active seats.

### E) Client
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue`: the three heading cases; the header comment
  names D-24656.

### F) New tests
- `villainDeck/villainEscapeProcedure.test.ts` (**new**):
  - Step 1 with 0, 1 and 2+ eligible Heroes:
    - a cost-7 Hero is never offered;
    - a Haunted Hero costing 6 or less is offered and its haunter stays;
    - the refill takes `heroDeck[0]`, and an empty Hero Deck leaves the slot `null`;
    - option order and default.
  - Step 2:
    - only when a Bystander was carried;
    - one choice per escape, never one per Bystander;
    - an empty-hand seat is not addressed, and all hands empty is a logged no-op;
    - a 2-seat apply discards one card each through `discardFromHand` (a seat's Unending Energy queues
      return-on-discard).
  - Order:
    - step 1 opens before step 2;
    - two escapes in one move drain in order;
    - nothing opens while another seat choice is open;
    - the opener leaves `pendingEscapeProcedures` `undefined` when drained.
  - Every path enqueues:
    - a reveal push-off;
    - `enterCityIgnoringAmbush`;
    - the Secret Invasion Skrull push. It now also fires the escaping card's onEscape, and its HQ slot is already
      refilled when the escape resolves.
  - The opener parks nothing when `evaluateEndgame(G)` is non-null, nothing while `pendingReturnOnDiscard` is
    non-empty, and nothing while `pendingHeroChoice` is set.
  - A Juggernaut escape carrying a Bystander, with 3+ **distinct** Heroes in the current player's hand (identical
    copies auto-resolve in `parkZoneKoChoice`, `villainEffects.execute.ts` ~L976–985, which would make the test
    vacuous), parks its
    `pendingKoHeroChoices` pick in the move and opens no escape seat choice until that pick resolves.
  - A two-seat discard parks with no stage-ride skip; a one-seat KO choice for the active player parks with the skip.
  - Depletion: on a Hero-Deck scheme (`pile-depleted` `heroDeck`), with one eligible HQ Hero and a one-card Hero
    Deck, the automatic KO's refill empties the deck. `SCHEME_LOSS` is set in the same opener call, and a queued
    step 2 does not park.
  - No path calls `gainWoundForPlayer` and no path logs the Wound line.
  - Step 3 still fires in the move, before the queue opens.
- `moves/resolveReturnOnDiscard.test.ts`:
  - a non-active front entry opens a `'return-on-discard'` choice for that seat;
  - accept returns the card; decline leaves it;
  - an active-player front entry opens nothing and `resolveReturnOnDiscard` behaves as before;
  - while a `'return-on-discard'` seat choice is open, the ridden seat's legacy `resolveReturnOnDiscard` submission
    changes nothing: the queue and the seat choice stay intact.
- `game.test.ts`: play-phase `turn.onMove` wiring:
  - a queued escape with two eligible HQ Heroes opens an `'escape-hq-ko'` choice;
  - a non-active return-on-discard entry opens its choice;
  - an open Diving Block wave is left alone;
  - the move count is unchanged.
  - **A real-reducer case** (`InitializeGame` + `CreateGameReducer`, the file's existing pattern): two seats, a
    Bystander-carrying escape. The active seat submits its discard **first** and the reducer accepts it, then the
    other seat submits and the choice applies.
- `ui/uiState.build.test.ts`: `pendingReturnOnDiscard` is projected for an active-player front entry and omitted for
  a non-active one.
- `simulation/seatChoiceDispatch.test.ts` (created by WP-749): a **hand-built-`G` harness case**, not a seeded
  full game.
  - Setup:
    - two seats, with `G.pendingEscapeProcedures` pre-seeded with one entry (`hasCarriedBystanders: true`,
      `isHqKoResolved: true`);
    - seat 0 (active) has an empty hand, so only seat 1 is addressed;
    - seat 1's hand holds only the return-on-discard hero card used by `moves/resolveReturnOnDiscard.test.ts`, and
      that card's hook is present in `G.heroAbilityHooks` so `checkReturnOnDiscard` queues the entry.
  - Drive: the same loop entry point and dispatch WP-749's own case uses.
  - Assert, in order:
    1. the discard choice opens, addressed to seat 1 only;
    2. seat 1 resolves it through the WP-749 non-active dispatch;
    3. seat 1's `return-on-discard` seat choice opens and resolves;
    4. the queue drains.
  - If WP-749's landed harness cannot start from a hand-built `G`, test the two mirror sites through `runFixture`
    with a scripted move list instead, and record which one was used.
- `endgame/mastermindVictory.logic.test.ts`: add `'pendingEscapeProcedures'` to `ALL_PENDING_FIELDS`.
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.test.ts`: one heading test per new kind.
- **Revert proofs (6/6).** Each restoration fails at least one new test:
  1. the generic Wound;
  2. the reduced Secret Invasion block;
  3. dropping the escape opener from `turn.onMove`;
  4. removing the return-on-discard opener;
  5. dropping the `hasAnyPendingChoice` wait (the Juggernaut case);
  6. dropping the legacy-move guard in `resolveReturnOnDiscard`.

### G) Existing tests — authorized edits only (the scaffold's 8)
Each edit replaces the generic-Wound assertion with "no Wound, the wound pile unchanged, the discard unchanged, no
'gained a wound from villain escape' line". It renames the test where its title names the Wound and keeps every other
assertion.
- `board/escape-wound.integration.test.ts` L122 and L221 (and the file header's description, if it describes the Wound
  as current).
- `economy/economy.integration.test.ts` L344: `woundsDrawn` stays 0.
- `moves/exorciseHauntedHero.test.ts` L251: the discard stays `[]` (asserted at L269).
- `villainDeck/villainDeck.enterCity.test.ts` L132: the discard stays `[]` and the pile is unchanged (asserted at L164).
- `villainDeck/villainDeck.reveal.test.ts` L1216 (L1255), L1804 (L1874) and L2263 (L2293, the direct-vs-reveal parity
  stays, with the discard now `[]`). The two other WP-186 tests that already assert the Wound is absent (L957, L1269)
  keep passing unedited.

### H) Forced re-pins (by their regenerators)
- `docs/ai/coverage/runtime-observed-hollows.json` via `pnpm sim:runtime-observed`. Scaffold: 7959 → 7980
  observations, 81 mechanics, 0 dropped.
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` ~L543: the `totalObs` pin only, after
  `pnpm --filter @legendary-arena/dashboard run prebuild:coverage`, with a dated provenance comment in the file's style.
  Scaffold: 8903.

### I) Docs
- `wiki/villain-deck.md` §Step 4: the escape sequence becomes:
  - counter + pile;
  - carry;
  - the procedure owed (steps 1–2 opened after the move);
  - Escape effects;
  - captured-Hero KO;
  - Mystique.
  The "MVP system-level escape penalty … not modeled" sentence goes; cite D-24656 and the deviation. The edit drops
  the literal phrases "gains **1 Wound**" and "MVP system-level escape" (AC10 is a literal match).

## D-24656 Content

Drafted in `DECISIONS.md` as `(Drafted 2026-10-04; not yet landed — WP-793 / EC-830)`. To flip it, the executor:
- replaces that suffix with `(Active <date> — WP-793 / EC-830)`;
- adds a `**Gates.**` paragraph with the recorded results;
- updates the point 6 numbers.

It locks:
1. The procedure order and its source (rules v23 L556–L570; Astral Plane L1037, L2826).
2. The 6-or-less eligibility, the 0 / 1 / 2+ handling, the current-player chooser and the refill/empty-deck behavior.
3. The once-per-escape, all-seats discard via a multi-seat seat choice through `discardFromHand`.
4. The `turn.onMove` queue and the accepted ordering deviation.
5. Every escape path, including Secret Invasion, through `resolveVillainEscape`.
6. The non-active return-on-discard seat choice.
7. Supersessions and determinism.

**Supersedes D-1702** (the WP-017 escape Wound) and **D-24439** (its gate).

## Out of Scope

- Modeling printed Escape texts that are unmarked today, including those that name "the normal Escape KO"
  ("(After the normal Escape KO) Put each Hero that costs 5 or more from the HQ on the bottom…", "KO a Hero from the HQ
  with the highest cost", New Reality's HQ-space destruction). When one is modeled it must run after this packet's
  deferred KO; that is OD-3.
- Suspending the reveal pipeline so that steps 1–2 resolve before the escape's other consequences (the deviation in
  D-24656 point 4).
- `[keyword:Charge]`, the Astral Plane, Escape-Pile additions that are not escapes (rules L1611–L1613),
  Combined Villains, and Adversaries / Overrun boards. None is modeled.
- A card-image HQ picker. The seat-choice prompt shows text labels, and the HQ is visible on the board.
- Mirroring `openDivingBlockSeatChoiceIfNeeded` in the sim loops (the WP-749 exclusion, unchanged).
- `replay/replay.execute.ts` (core moves only, no `turn.onMove` mirror; D-0205 posture, unchanged).
- The getLegalMoves non-active-seat dispatch itself (WP-749).
- Stale "only place `G.escapedPile` grows" wording in `rules/schemeResourceLoss.ts` ~L159. It is a separate
  comment-only `INFRA:` papercut; this packet must not edit that file.
- PAR profile regeneration (`data/par/profile/v1/**`), seed PAR, and any `competitive_scores` read, write, recompute
  or annotation.
- `VP_WOUND` (D-2001) and any other scoring weight.
- Two pre-existing defects found during drafting, each a separate `INFRA:` fix:
  - `koAttachedHeroesOnEscape` KOs a Villain's captured Heroes on escape. Rules v23 L3447–L3449 say "The captured
    Heroes just stay in the Escape Pile". This packet leaves that step-3 line as it is.
  - A Diving Block wave addressed to both the active seat and a non-active seat already locks the active seat out
    until the others answer, because `buildSeatChoiceActivePlayersValue` skips the active seat in a mixed ride. This
    packet avoids that for its own discard by parking with no skip, and does not change the shared builder.

## Files Expected to Change

- `packages/game-engine/src/villainDeck/villainEscapeProcedure.ts` — **new** — the queue, the opener, the builders,
  the KO helper and the applies
- `packages/game-engine/src/villainDeck/villainEscapeProcedure.test.ts` — **new** — §Scope F cases
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — modified — Wound removed, enqueue added, comments
- `packages/game-engine/src/villainDeck/villainDeck.enterCity.ts` — modified — comment only
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — modified — Secret Invasion via `resolveVillainEscape`
- `packages/game-engine/src/types.ts` — modified — `PendingEscapeProcedure` and the optional field
- `packages/game-engine/src/moves/seatChoice.resolve.ts` — modified — three kind dispatches
- `packages/game-engine/src/moves/resolveReturnOnDiscard.ts` — modified — non-active opener, seat-choice apply, legacy-move guard
- `packages/game-engine/src/moves/resolveReturnOnDiscard.test.ts` — modified — new cases
- `packages/game-engine/src/moves/phaseCard.ts` — modified — `export` added to the existing `hasAnyPendingChoice`
  (no body change)
- `packages/game-engine/src/ui/uiState.build.ts` — modified — the `pendingReturnOnDiscard` active-player projection gate
- `packages/game-engine/src/ui/uiState.build.test.ts` — modified — the projection-gate cases
- `packages/game-engine/src/simulation/seatChoiceDispatch.test.ts` — modified (created by WP-749) — the two-seat return-on-discard sim case
- `packages/game-engine/src/game.ts` — modified — the two `turn.onMove` openers
- `packages/game-engine/src/game.test.ts` — modified — onMove wiring cases
- `packages/game-engine/src/endgame/mastermindVictory.logic.ts` — modified — clear the new field
- `packages/game-engine/src/endgame/mastermindVictory.logic.test.ts` — modified — the pinned field list
- `packages/game-engine/src/simulation/simulation.runner.ts` — modified — opener mirrors
- `packages/game-engine/src/simulation/par.aggregator.ts` — modified — opener mirrors
- `packages/game-engine/src/test/fixtures/runFixture.ts` — modified — opener mirrors
- `packages/game-engine/src/board/escape-wound.integration.test.ts` — modified — §Scope G
- `packages/game-engine/src/economy/economy.integration.test.ts` — modified — §Scope G
- `packages/game-engine/src/moves/exorciseHauntedHero.test.ts` — modified — §Scope G
- `packages/game-engine/src/villainDeck/villainDeck.enterCity.test.ts` — modified — §Scope G
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — modified — §Scope G
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` — modified — three headings
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.test.ts` — modified — heading tests
- `docs/ai/coverage/runtime-observed-hollows.json` — modified — regenerated by `pnpm sim:runtime-observed`
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — modified — the `totalObs` pin and a dated comment only
- `wiki/villain-deck.md` — modified — §Step 4 escape sequence
- **Generated, modified ONLY if its gate shows a real diff** (none in the scaffold):
  - `scripts/coverage/hero-effect-coverage.baseline.json`;
  - `data/metadata/effect-implementation-index.json`;
  - `data/metadata/card-mechanics.json`;
  - `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`;
  - `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`.
- `docs/ai/post-mortems/01.6-WP-793-villain-escape-rulebook-procedure.md` — **new** — the `01.6` post-mortem (govern-close)
- Governance — modified: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24656 → Active; the D-1702 / D-24439
  pointers), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`

No other files may be modified. A `packages/lagn-spec/schemas/lagn-v1.json` line-ending churn from the build is
reverted, not committed.

**Size.** The list is over the ~8-file guidance (00.1 §Splitting), and splitting is rejected:
- 16 entries are tests or regenerator re-pins;
- the engine change and its client heading must ship together, or the new choices would render the "Your choice"
  fallback;
- an engine/client split would also have to land the Wound removal without its replacement penalty in between.
The packet adds no new move, guard set, projection or prompt component, which is what keeps it to one session.
§Scope C (the non-active return-on-discard fix) is not split out either. It is a safety precondition for the
discard: without it, every Bystander escape in a multi-seat match can freeze. On its own it would still need the same
seat-choice wiring.

A `01.6` post-mortem **is required** at govern-close. The packet adds a new runtime-wiring category (a second
`turn.onMove` queue opener feeding the seat-choice slot) and changes an engine-wide behavior every match exercises.

## Contract

- **Every escape** records one `PendingEscapeProcedure`. After the move, the HQ KO resolves first (0 = no-op,
  1 = automatic, 2+ = the current player's choice). Then, only if Bystanders were carried, every player holding a card
  discards exactly one.
- **The escape's own Escape effect** and other automatic consequences resolve inside the move, unchanged.
- **No escape** gives a generic Wound.
- **A non-active seat's** return-on-discard is answered by that seat.

## Acceptance Criteria

1. No escape, on any path, adds a Wound or a "gained a wound from villain escape" line, or changes
   `turnEconomy.woundsDrawn`. A Villain's printed Escape Wound still applies.
2. After the move that caused it, an escape KOs an HQ Hero costing ≤ 6:
   - 0 eligible → only the no-op line;
   - 1 eligible → that Hero is in `G.ko`, and the slot holds the previous `heroDeck[0]` (or `null` on an empty deck);
   - 2+ eligible → `G.pendingSeatChoice.kind === 'escape-hq-ko'`, addressed to the current player only, with options
     sorted cost then slot. Resolving option *i* KOs that Hero and refills its slot.
3. A Hero costing 7 or more is never offered or KO'd. A Haunted Hero costing ≤ 6 is offered, and its haunter stays in
   the space.
4. Step 2 opens only when ≥ 1 Bystander was carried, once per escape regardless of the Bystander count:
   - every seat with a card in hand is addressed, and no other seat;
   - each addressed seat loses exactly one hand card to its discard via `discardFromHand`;
   - when every hand is empty, only the no-op line is logged;
   - in the `game.test.ts` real-reducer case, the active seat's submission is accepted before the other seat's.
5. Order:
   - an escape's step-1 choice resolves before its step-2 choice opens;
   - two escapes in one move resolve in escape order;
   - nothing opens while `hasAnyPendingChoice(G)` is true or `pendingHeroChoice` is set (a Juggernaut escape's hand-KO
     pick resolves before that escape's seat choices open), or once `evaluateEndgame(G)` is non-null;
   - the escape opener runs before Diving Block's, followed by the depletion re-check;
   - when drained, the `pendingEscapeProcedures` key is absent from `G`.
6. Step 3 is unchanged: onEscape effects, the captured-Hero KO, the Mystique twist and the resource-loss check fire
   inside the move. The existing escape-before-Ambush ordering test (`villainDeck.reveal.test.ts` ~L1269) passes
   unedited.
7. A reveal push-off, `enterCityIgnoringAmbush` and the Secret Invasion Skrull push all enqueue the procedure. Secret
   Invasion's escape now also runs the escaping card's onEscape and the shared log line.
8. A non-active seat's front `pendingReturnOnDiscard` entry opens a `'return-on-discard'` seat choice for that seat:
   - option 0 returns the card to hand, option 1 leaves it, and the entry is front-popped either way;
   - an active-player entry opens nothing, and `resolveReturnOnDiscard` behaves exactly as before;
   - `buildUIState` projects `pendingReturnOnDiscard` only for an active-player front entry;
   - while that seat choice is open, a legacy `resolveReturnOnDiscard` submission changes nothing;
   - the two-seat sim case in `seatChoiceDispatch.test.ts` terminates.
9. No move, guard or `UIState` field is added:
   - the `game.test.ts` move pin, `SIMULATION_MOVE_NAMES` and both `MOVE_MAP`s are unchanged;
   - `mastermindVictory.logic.test.ts` includes `pendingEscapeProcedures`, and the drop clears it;
   - the three prompt headings render (arena-client tests, `vue-tsc` 0).
10. Oracles:
    - the sentinel `finalStateHash` and `PRE_WP080_HASH` are byte-unchanged;
    - `sim:runtime-observed` regenerates with all 312 games terminating and 0 dropped;
    - the only edited existing tests are §Scope G, the dashboard `totalObs` pin and the `ALL_PENDING_FIELDS` addition
      (§Scope F); every other existing test file only gains new cases;
    - `Select-String -Path wiki/villain-deck.md -Pattern 'gains \*\*1 Wound\*\*|MVP system-level escape'` returns
      nothing.

## Verification Steps

```pwsh
git show origin/main:docs/ai/work-packets/WORK_INDEX.md | Select-String -SimpleMatch '- [x] WP-749'
# Expected: one line — WP-749 executed and merged (else STOP)
pnpm -r build
# Expected: exits 0
pnpm --filter @legendary-arena/game-engine test
# Expected: 0 fail; record before/after counts (draft baseline 4838 before WP-749)
pnpm --filter @legendary-arena/game-engine test 2>&1 | Select-String 'committed fixture replays|PRE_WP080'
# Expected: the sentinel and PRE_WP080_HASH tests pass (no re-pin)
pnpm sim:runtime-observed; pnpm sim:runtime-observed:check
# Expected: "312 game(s) … dropped 0", then OK
pnpm sim:coverage --check; pnpm effect-index:check; pnpm mechanics:metadata:check; pnpm ledger:heroes:check; pnpm ledger:villains:check
# Expected: OK, no diff
pnpm --filter @legendary-arena/dashboard run prebuild:coverage; pnpm --filter @legendary-arena/dashboard test; pnpm --filter @legendary-arena/dashboard typecheck
# Expected: 0 fail after the totalObs re-pin; typecheck exits 0
pnpm --filter @legendary-arena/arena-client test; pnpm --filter @legendary-arena/arena-client typecheck
# Expected: 0 fail; vue-tsc exits 0
pnpm wiki:lint; pnpm wiki-viewer:check-links
# Expected: exits 0
Select-String -Path wiki/villain-deck.md -Pattern 'gains \*\*1 Wound\*\*|MVP system-level escape'
# Expected: no output
Select-String -Path packages/game-engine/src/villainDeck/villainDeck.reveal.ts -Pattern 'gainWoundForPlayer|woundsDrawn'
# Expected: no output
pnpm -r --no-bail test
# Expected: 0 failures in every package
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All ACs pass; the 6/6 revert proofs are reported; engine, arena-client and dashboard before/after counts are
      recorded.
- [ ] `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. The arena-client and dashboard typechecks
      exit 0.
- [ ] Sentinel and `PRE_WP080_HASH` are unchanged. `sim:runtime-observed:check` is OK after regeneration, the other
      feed checks are OK, and the dashboard pin is re-pinned.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] Two commits on one branch:
  1. `EC-830: …` — engine, client, tests, re-pins, wiki. The body lists each §Scope G edit as an intentional behavior
     change. Trailers: `Tests-changed:` and `Vision: §1, §3, §4, §8, §14, §18, §20–§24, §26`.
  2. `SPEC: WP-793 / EC-830 govern-close — …` — STATUS, DECISIONS (D-24656 Active; D-1702 and D-24439 pointers),
     WORK_INDEX, EC_INDEX, mindmap, roadmap counts, the `01.6` post-mortem.
- [ ] **D-24026 live verify (REQUIRED):** in a manual match where a Villain carrying a Bystander escapes:
  - no Wound line;
  - the HQ-KO prompt (or the automatic or no-op line), with the HQ refilled;
  - the discard prompt, and one card leaves the hand;
  - the Villain's own Escape effect, as before.
  Record the matchId in STATUS.md. If a 2-seat match is available, confirm the non-active seat answers its own discard
  prompt.
- [ ] **Order:** the live verify runs after merge and deploy. The `SPEC:` govern-close records "D-24026 live-verify
      pending" (the WP-783 / WP-790 / WP-792 precedent), and a post-deploy STATUS commit records the matchId. Do not
      record a live result before it is observed.
- [ ] STATUS.md updated. D-24656 flipped to Active with gate results; the D-1702 / D-24439 pointers added.
- [ ] WORK_INDEX WP-793 `[x]` with date. EC_INDEX EC-830 → Done. Mindmap `📝`→`✅`. `pnpm roadmap:counts:write`;
      `roadmap:counts:check` exits 0. `pnpm ledger:numbers:check` exits 0.

## Open Operator Decisions (do not block execution)

- **OD-1 — competitive history.** Stored `competitive_scores` rows from before the deploy include escape Wounds
  (−1 VP each) and lack the HQ-KO and discard costs. Options:
  - leave them as-is (the default; D-24616 §5, as WP-792 OD-1 proposes);
  - annotate the leaderboard with the deploy date;
  - start a new gauntlet season covering both WP-792 and WP-793.
  Rewriting stored scores is not proposed. Whatever is chosen, replays with a pre-deploy escape stop re-executing at
  that escape (§Context), so coach and verification for those matches fail permanently.
- **OD-2 — PAR profile re-pin timing.** The multi-player profiles can only be regenerated after WP-749. The
  recommendation is one follow-up `INFRA:` re-pin of `data/par/profile/v1/**` after WP-792, WP-749 and WP-793 have
  all merged (precedent #2405), rather than one per packet. It can also wait for the next calibration pass, since the
  profiles are diagnostic only. The same pass should re-anchor seed PAR for Midtown Bank Robbery and the other
  Bystander-heavy schemes. Their WP-591 anchors were calibrated under the old escape costs, so grades drift until
  then.
- **OD-3 — follow-ups**, which to schedule, if any:
  - the printed Escape texts that reference "the normal Escape KO" (hollow today);
  - a strict-order reveal continuation (steps 1–2 before the escape's other consequences);
  - a card-image HQ picker for the escape KO;
  - `[keyword:Charge]`;
  - the stale `schemeResourceLoss.ts` comment;
  - hardening the D-24501 seat-choice stage ride so a ridden seat can submit only `resolveSeatChoice`. Today any
    off-prompt global move spends its single admitted move.

## Vision Alignment

- **Clauses touched:**
  - §1 Rules Authenticity: an escape does what rules v23 p.15 says, in its order, and the invented Wound is gone.
  - §3 Player Trust & Fairness, §20–§24 (PAR scoring, scenario-aware scoring, deterministic evaluation, leaderboards,
    replay-verified integrity): escape costs now come from the rules, not a placeholder.
  - §4 Multiplayer integrity: each player chooses their own discard. A non-active seat answers its own return-on-discard
    instead of freezing the turn. The D-24501 pause-and-preserve disconnect posture applies unchanged.
  - §8 / §22 Determinism: no randomness and no wall-clock read. The choices apply in ascending seat order. The new
    `G` field is omitted when absent. The oracles that move are re-pinned by their regenerators.
  - §14 Explicit Decisions: D-24656 supersedes D-1702 and D-24439 in the open and records the ordering deviation.
  - §18 Replayability: new replays are faithful. A replay that contains a pre-deploy escape stops re-executing at
    that escape; this is accepted under OD-1.
  - §26 Simulation-Calibrated PAR: the profiles are re-pinned by the OD-2 follow-up.
- **Non-Goal proximity:** none of NG-1..NG-8 is crossed. Nothing paid, persuasive or cosmetic affects play.
- **Conflict assertion:** No conflict: this WP preserves all touched clauses.
- **Determinism and scoring:** the change is deterministic and replay-faithful. The bgio reducer replays the same
  `turn.onMove` openers, and the sim loops mirror them. Scores change because the rules changed; the accepted replay
  window and the frozen rows are in §Context, and the history choice is OD-1.

## Funding Surface Gate

N/A: this is a gameplay-rules change to the engine's escape procedure plus three prompt headings. It adds no
navigation, registry-viewer, profile or tournament funding affordance, and no donate or support copy.

## API Catalog

N/A: no HTTP endpoint and no `apps/server/src/**` library function is added, changed or re-statused. The server bot
loops are unchanged; they already answer seat choices (D-24590, D-24593).

## Lint Gate Self-Review (00.3)

All 21 sections are satisfied or N/A. The gate ran as an independent subagent: FAIL on the first pass, then PASS on a
delta re-lint.
- **First-pass FAILs, all fixed:**
  - §2 / §14: the authorized-test wording missed the `ALL_PENDING_FIELDS` addition;
  - §3: `hasAnyPendingChoice`, `evaluateEndgame`, the current `pendingReturnOnDiscard` projection and
    `pendingHeroChoice` were not in Assumes;
  - §16.1: a two-caller shared helper; the apply now duplicates the short mutation;
  - EC: a non-verbatim Locked Value (the return-on-discard opener's seat-choice wait).
- **Advisories applied:** the sentinel `Select-String` pattern; Vision §18; the AC1 / Verification grep label;
  `chooserPlayerID` casing; a depletion test; the EC wording aligned. The mindmap node stays beside WP-749 on purpose.
- **§1 structure:** every required section is present. The baseline `afd76ffe` and the reserve commit `f5bf04a5` are
  cited.
- **§2 constraints:** engine-wide (full files, ESM / Node v22+, 00.6), packet-specific, the Session protocol and the
  Locked Contract Values.
- **§3 Assumes:**
  - WP-749 as the hard dependency, plus the shipped dependencies;
  - the escape procedure, every escape path, the seat-choice machinery and Monarch's discard;
  - the Diving Block opener, the discard chokepoint, and the HQ / depletion / endgame / pending-choice helpers;
  - the oracles and the baseline suite counts.
- **§4 Context:**
  - rules v23 line cites and the D-1702 origin;
  - the escape-path inventory and the design rationale with the accepted deviation;
  - three scaffold probes, PAR, the replay window, and the DECISIONS scan list;
  - ARCHITECTURE, the rules files, 00.2 §8.1, WP-749 and the wiki.
- **§5 files:** a closed allowlist with markers and descriptions. It is over the ~8-file guidance, with the
  no-split rationale given in §Files Expected to Change.
- **§6 naming:** existing contract names (`cardId`, `playerID`, `CardExtId`); no setup-payload change.
- **§7:** no new dependency.
- **§8 layer:** engine-owned rules. The one `ui/` edit narrows an existing field. The client change is heading text
  only. No persistence.
- **§9:** pwsh verification with `Select-String`.
- **§10 / §11:** N/A. No environment variable, no auth surface.
- **§12 tests:** `node:test` + `makeMockCtx`, plus a real-reducer case through the existing `game.test.ts` pattern.
  6/6 revert proofs.
- **§13 verification:** exact commands with expected output, including the WP-749-merged check.
- **§14:** 10 binary ACs.
- **§15 DoD:** STATUS; DECISIONS (D-24656 Active + the D-1702 / D-24439 pointers); WORK_INDEX; EC_INDEX; the mindmap;
  the `git status` allowlist; two commits; the `01.6` post-mortem; the D-24026 live verify after deploy.
- **§16:** duplicate-first. The HQ-KO helper is the third copy of the `koFromHq` mutation. JSDoc and `// why:`
  comments are locked in the EC.
- **§17 Vision:** §1, §3, §4, §8, §14, §18, §20–§24 and §26; no NG crossing; the conflict and determinism lines are
  present.
- **§18 prose-vs-grep:** the wiki and `villainDeck.reveal.ts` greps are protected by the Scope I phrase ban and the
  comment-paraphrase rule.
- **§19:** N/A (commit-time discipline at govern-close).
- **§20 Funding:** N/A, with a reasoned justification.
- **§21 API Catalog:** N/A, with a reasoned justification.

## Gate Verdicts

Each gate ran as an independent subagent against the live worktree, with the scaffold logs as evidence.

**Pre-flight (01.4): NOT READY → READY TO EXECUTE once WP-749 merges.** WP-749 is the declared hard dependency, the
same conditional form as the WP-758 precedent.
- **PS-1 (blocking).** The multi-seat discard was parked with the D-24648 active-seat skip.
  - boardgame.io would have set `activePlayers` to the non-active seats only, rejecting the active seat's own
    submission until they all answered.
  - Autoplay would abort (`stage-did-not-advance`) and bot-ally would fault.
  - **Fixed:** the skip is used only for a one-seat choice addressed to the active player, plus a real-reducer
    test in which the active seat submits first.
- **PS-2 (blocking).** A non-active owner would see both the legacy return-on-discard prompt and the new seat choice.
  One legacy click spent its single stage move and stranded the choice. **Fixed:** the projection is gated to the
  active player, and an already-popped entry is a no-op.
- **PS-3 (blocking).** The sim and fixture mirror sites and their `currentPlayer` argument were under-specified.
  **Fixed:** both loop sites are locked (including WP-749's branch), the argument is the loop's active seat, and a
  two-seat harness case is added.
- **PS-4 (blocking).** The scaffold had never run a real opener. **Fixed:** a round-2 real-opener prototype ran (see
  §Context, the third scaffold probe). Engine showed the same 8 failures; server, client and the other packages were
  green, including `matchReplay` `turnCount`.
- **RS items applied:** the endgame guards, the depletion re-check and the in-loop depletion check, the Secret
  Invasion refill before the escape, the import removals and the comment paraphrase, the cycle notes, the pure-return
  KO mutation, the wait on return-on-discard, the dropped unused export, and the title-first D-24654 reference.
- Out-of-scope papercuts recorded: `koAttachedHeroesOnEscape` vs rules L3447, and the Diving Block mixed-ride
  lockout.
- **Delta re-checks: READY** (twice).
  - The second covered the copilot fixes, including the export-only `moves/phaseCard.ts` allowlist addition: no body
    change, no new layer edge, a safe import cycle, no deadlock from the broader wait.
  - **01.4 delta note:** `moves/phaseCard.ts` is an export-only, non-scope addition.

**Copilot (01.7): RISK/HOLD → PASS (CONFIRM).** Ten scope-neutral findings, all fixed:
- **F1:** step-3 parked choices (Juggernaut) stacked with the escape prompts. The opener now waits on every pending
  choice through the exported `hasAnyPendingChoice` and on `pendingHeroChoice`.
- **F2:** a legacy-move guard in `resolveReturnOnDiscard`, recorded as defense in depth. Hardening the stage ride
  is OD-3.
- **F3:** `cardId` on the return-on-discard options.
- **F4:** `delete` on drain.
- **F5:** the replay window restated. Re-executing a log with a pre-deploy escape stalls; accepted under OD-1.
- **F6:** the scoring wording now uses the real formula, VP weight 10. The seed-PAR anchor shift goes to OD-2.
- **F7:** D-24656 point 2 now cites the post-opener re-check.
- **F8:** a robust WP-749-merged check.
- **F9:** the KO log's Villain source.
- **F10:** why §Scope C is not split.
- **Delta re-check: PASS.** Six wording fixes were applied: the deleted-key wording in the EC and D-24656, seed PAR in
  D-24656 point 7, OD-2, the RawScore formula, the `phaseCard` cycle note, and distinct Heroes in the Juggernaut
  test. CONFIRM stands without another re-run.

**Lint (00.3): FAIL → PASS** (details in §Lint Gate Self-Review). After the lint edits, final delta confirms
returned **01.4 READY TO EXECUTE once WP-749 merges** and **01.7 PASS (CONFIRM)**.
