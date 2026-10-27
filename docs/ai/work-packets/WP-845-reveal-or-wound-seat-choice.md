# WP-845 — Reveal or Gain a Wound: a Player Who Can Reveal Chooses (Game Engine + one client heading)

**Status:** Draft — pending execution
**Primary Layer:** Game Engine (+ one Arena Client heading)
**User-Visible Surface:** play.legendary-arena.com

---

## Goal

Every "Each player reveals a [X] Hero or gains a Wound" line wired through the villain
primitive `reveal-or-wound` or the hero keyword `reveal-or-gain-wound-each`
auto-reveals today: a player who can reveal always does. Rules v23 "Revealing a Card" (L3196-3200) says the
player *could choose not to reveal it and just gain the Wound instead*, and the game
has cards that reward Wounds (co2e Hulk's Don't Make Me Angry, Healing, Wounded Fury).
After this WP, each player who can reveal gets a prompt — **Reveal another / a matching {X} Hero** or
**Gain a Wound instead** — and players who cannot reveal gain the Wound as before. This covers
the hero keyword `reveal-or-gain-wound-each` (co2e Crazed Rampage, D-24777) and the
villain primitive `reveal-or-wound` (Sabretooth, Frost Giant, Ymir, Ultron, Zzzax and
their co2e versions, D-24281): one seat-choice kind, one prompt, one bot answer.

## User-Visible Impact

When Sabretooth is fought (or a Frost Giant ambushes, Ultron escapes, co2e Crazed
Rampage is played…), every player holding a qualifying Hero sees "Reveal a Hero or
gain a Wound?" with two buttons, on their own seat, at the same time. The turn waits
until they all answer. Players with no qualifying Hero gain the Wound at once, as
today. If the Wound supply is empty no prompt opens (taking a Wound is not an option
you can do, rules L3199-3200). Bot seats and absent seats reveal.

## Assumes

- **Baseline:** `origin/main` @ `51a43bf8` (after the WP-844 draft, #3032). Re-baseline at execution.
- **The two auto-reveal sites exist on `main`.** Hero `heroEffectRevealOrGainWoundEach`
  (`hero/heroEffects.execute.ts`, WP-843 / D-24777 §5: "A per-seat choice needs the
  multi-seat `pendingSeatChoice` wave and is deferred with D-24281's interactive
  choice"). Villain `villainEffectRevealOrWound` (`villain/villainEffects.execute.ts`,
  WP-469 / D-24281 Semantics: "the rare Wound-synergy decline is a documented
  auto-resolve simplification, deferred with the interactive choice"). ✅
- **Corpus.** 14 villain lines in `data/cards/core.json` + `co2e.json` carry
  `[effect:reveal-or-wound:…]` across Fight / Ambush / Escape; 1 hero line carries
  `[keyword:reveal-or-gain-wound-each]` (`co2e/hulk/crazed-rampage`). Re-count at
  execution (PowerShell): `(Select-String -Path data/cards/*.json -Pattern '\[effect:reveal-or-wound:' -AllMatches).Matches.Count`
  → 14 and `(Select-String -Path data/cards/*.json -Pattern '\[keyword:reveal-or-gain-wound-each\]' -AllMatches).Matches.Count`
  → 1. ✅
- **The multi-seat seat choice exists** (WP-684 / D-24501): `G.pendingSeatChoice`,
  `parkSeatChoice`, `resolveSeatChoice`, the atomic ascending-seat apply,
  `applySeatChoiceTimeoutDefault`, and the block-all guards that read
  `hasAnyPendingChoice` (`moves/phaseCard.ts`). ✅
- **The villain executor has no `events`**, so it cannot park a choice itself. The
  D-24750 precedent records the owed choice on a lazy queue
  (`G.pendingEscapeEffectDiscards`) that an opener drains after the move, from
  `game.ts` `turn.onMove` and its mirrors (`simulation/simulation.runner.ts` ×2,
  `simulation/par.aggregator.ts` ×2, `test/fixtures/runFixture.ts` ×1). WP-793 /
  D-24656 point 4 accepted the same "resolves after the move" deviation. ✅
- **The client prompt is generic.** `PendingSeatChoicePrompt.vue` renders any kind's
  options from the `UIPendingSeatChoice` projection and picks its heading by `kind`
  (fallback "Your choice"). No new `UIState` field, so the five-step Board-Visible
  Field contract is not triggered. ✅
- **Reused helpers (exist on `main`):** `gainWoundWithOutcome` (`board/wounds.logic.ts`),
  `openDivingBlockSeatChoiceIfNeeded` (`moves/divingBlock.logic.ts`), `evaluateEndgame`
  (`endgame/endgame.evaluate.ts`), `applyPileDepletionResourceLoss`
  (`rules/schemeResourceLoss.ts`), `openEscapeProcedureSeatChoiceIfNeeded` (which ends by
  calling `openEscapeEffectDiscardIfNeeded`, `villainDeck/villainEscapeProcedure.ts`),
  `composeWoundOutcomeClause` (`events/notableEvents.compose.ts`), `StrikeBlockThreatKind`
  (`events/notableEvents.types.ts`), `formatCardRef` (`log/logDisplay.ts`); file-private,
  used only at the enqueue sites: `playerCanRevealMatch` / `describeHeroRevealRequirement`
  (hero file), `playerHasHeroMatchingTrait` / `describeRevealRequirement` (villain file).
  `apps/server/src/bot-ally/botAllyDriver.mjs` answers through
  `choosePlayingSeatChoiceOption`, so it needs no change. ✅
- **The bot answer needs no code.** `choosePlayingSeatChoiceOption`
  (`simulation/ai.seatChoice.ts`, D-24744) returns `defaultOptionIndex` for a kind it
  does not list; the default here is Reveal, which is also the present-player answer.
  Autoplay, the simulation runner and PAR submit the default (D-24745). ✅
- **Hash surfaces.** `hashGameState` (`test/fixtures/hashGameState.ts`, the sentinel
  `finalStateHash`) excludes `G.messages` (D-24081) but includes `G.notableEvents` and
  the pending fields. `computeStateHash` (`replay/replay.hash.ts`: `PRE_WP080_HASH`,
  competition verification, desync detection) includes `G.messages`.
- **Dependencies:** none open — WP-469, WP-684, WP-793, WP-817, WP-843 are Done.
  **Soft ordering** (same files, anchor shifts only, either landing order works):
  WP-844 (on `main` as a draft: `hero/heroEffects.execute.ts`, the dashboard `totalObs`
  pin); WP-836..WP-840 (drafted co2e villain packets: `villainEffects.execute.ts`,
  `seatChoice.resolve.ts`, `types.ts`, `PendingSeatChoicePrompt.vue`, the drop set and
  busy guard); WP-837 in particular widens the owed-discard queue this WP's opener sits
  after. Rebase onto whichever has landed and re-read the anchors.

## Context (Read First)

- `packages/game-engine/src/moves/seatChoice.resolve.ts` — **AUTHORITATIVE for**
  `parkSeatChoice`, `resolveSeatChoice`, `applySeatChoiceByKind` (the kind dispatch the
  new kind joins) and the timeout default.
- `packages/game-engine/src/villainDeck/villainEscapeProcedure.ts` —
  `openEscapeEffectDiscardIfNeeded` is the opener template for the guards (wait while
  any choice is open or `pendingHeroChoice` is set; stop once `evaluateEndgame` is
  non-null; the active-seat-only stage-ride rule). The **remove-at-apply** shape comes
  from `rules/timestreamPurge.logic.ts` (opens `queue[0]` without shifting, the applier
  shifts) and `moves/flyingShieldBlock.logic.ts`.
- `packages/game-engine/src/game.ts` play-phase `turn.onMove` — the opener order
  (return-on-discard → Purge sweep → escape → Purge → … → Diving Block).
- `packages/game-engine/src/hero/heroEffects.execute.ts` (`heroEffectRevealOrGainWoundEach`,
  `playerCanRevealMatch`) and `packages/game-engine/src/villain/villainEffects.execute.ts`
  (`villainEffectRevealOrWound`, `playerHasHeroMatchingTrait`,
  `STRIKE_BLOCK_THREAT_KIND_BY_TIMING`).
- `docs/ai/DECISIONS.md` — D-24281, D-24501, D-24656 (point 4 and the replay note),
  D-24744, D-24745, D-24750, D-24777; the reserved **D-24779** below.
- `docs/legendary-universal-rules-v23.md` L3192-3200 ("Revealing a Card"), L2247
  (each-player order).
- `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` — `game.ts` and the sim / PAR /
  fixture mirrors are runtime wiring.

## Design Rationale

**Lane.** Standard two-session lane: gameplay surface, a new hashed `G` field, wiring
in `game.ts` and three mirrors (D-24028 criteria #2, #6, #8 all fail).

**Scope: hero AND villain.** One rule (L3196-3200) governs both. The villain primitive
is where the choice comes up (14 lines in the two most-played sets; the hero form is
one line), and a fix that prompted for Crazed Rampage but not for Sabretooth would
teach players a wrong rule. Both sites already share the predicate shape (hand, plus
in-play) and the wound chokepoint; they now share one kind, one applier, one prompt
and one bot answer. Doing the hero site alone would also build the queue, opener and
mirrors, which are most of the cost, so splitting saves little.

**Shape.**
1. **At effect time** (both sites), seats are split by the existing predicate. A seat
   that **cannot** reveal gains its Wound **inline**, exactly as today (same helper,
   same log line, same `woundsDrawn` rule, same Diving Block handoff). Seats that
   **can** reveal are recorded, ascending, on one new
   `G.pendingRevealOrWoundChoices` entry. No seat can reveal → nothing is queued and
   behaviour is byte-identical to today.
2. **After the move**, `openRevealOrWoundSeatChoiceIfNeeded` (new) serves the queue in
   FIFO order with the D-24750 opener guards. If the Wound supply is empty when the
   front entry opens, the entry resolves as every seat revealing (declining is not an
   option you can do, L3199-3200): it logs the empty-supply line, pushes one
   `strikeBlocked` per revealing seat for a villain source (the entry's threat kind),
   and is shifted off. Otherwise it parks, for the front entry, one simultaneous
   `PendingSeatChoice`, kind `reveal-or-wound`, addressed to the recorded seats, with
   options `[{revealOptionLabel}, Gain a Wound instead]` (hero `Reveal another {req} Hero`, villain `Reveal a matching {req} Hero`) and `defaultOptionIndex` 0 (Reveal).
   Stage ride: the D-24750 rule (skip the ride only when the active seat is the sole
   addressed seat). The entry **stays at the front of the queue** while its choice is
   open (the Timestream Purge shape); the open choice makes `hasAnyPendingChoice` true,
   so the opener does not reopen it. The new queue never joins `hasAnyPendingChoice`
   (that would deadlock its own opener).
3. **Apply** (`applyRevealOrWoundSeatChoice`, dispatched from `applySeatChoiceByKind`):
   reads the front entry `G.pendingRevealOrWoundChoices[0]` for its `sourceCardId`,
   `currentPlayerID` and `strikeBlockThreatKind` (`PendingSeatChoice` carries no
   payload and the timeout path passes no current player), checks that
   `choice.addressedSeats` equals `entry.revealingSeats` (mismatch or missing entry →
   log and no-op, the `applyEscapeHqKo` precedent), then shifts the entry and deletes
   the key when the queue empties. Seats in ascending order; Reveal → no mutation (villain source: one `strikeBlocked`
   notable event, moved here from effect time); Gain a Wound →
   `gainWoundWithOutcome` (Diving Block / Flying Shield Block still intercept), the
   empty-supply no-op logged, `turnEconomy.woundsDrawn` bumped only for the entry's
   current player. One summary line.
4. **Opener position.** Live `turn.onMove`: immediately before
   `openDivingBlockSeatChoiceIfNeeded`, after the latch / pile-depletion re-check that
   follows the escape and Purge openers (so `evaluateEndgame` already sees a scheme
   loss, and an Escape-timing entry resolves after that escape's steps 1-2, the D-24750
   order). Sim and PAR mirrors (`simulation.runner.ts` ×2, `par.aggregator.ts` ×2):
   after the `applyPileDepletionResourceLoss` that follows each escape-opener call.
   `runFixture.ts`: directly after its escape-opener call (it has no re-check). A
   consequence of running before Diving Block: a Diving Block wave from an inline
   cannot-reveal Wound waits until the revealers' choice resolves. A decliner's Wound is
   gained inside the `resolveSeatChoice` move, so its Diving Block wave opens in that
   move's `onMove` whatever the opener order.
5. **Logs.** At enqueue, the existing cannot-reveal summary line (if any) first, then
   one enqueue line naming the revealers. The hero "Every player revealed …" line and
   the villain "every player revealed …" branch become reachable only when there are no
   seats at all (no cannot-reveal and nothing queued); the apply line replaces them for
   the queued case. Exact text: EC-883 Locked Values.

**Why its own queue, not WP-817's owed-discard FIFO.** WP-837 (drafted) widens
`G.pendingEscapeEffectDiscards` to Ambush discards so that one FIFO keeps rule order
between owed discards. This entry is not a discard, has a hero source too, and
carries a different payload; folding it into that queue would turn a discard queue
into a general owed-choice queue through an entry union. A separate queue drained right
after it keeps both simple. Residual: in one reveal move that records both an owed
discard and a reveal-or-wound entry, the discard opens first even when the
reveal-or-wound was printed first (e.g. an Escape-timing reveal-or-wound followed by
an Ambush discard). Recorded in D-24779.

**Why the predicate is fixed at effect time.** The seats addressed are the ones that
could reveal when the effect resolved. The opener runs in the same `onMove`, unless
another open choice holds it; re-testing hands later would let an earlier prompt's
discard change who is asked. A seat whose qualifying card left its hand meanwhile
still "reveals"; noted as a residual. **The common case is an Escape with carried
Bystanders**: escape step 2 (every player discards one card) opens before this opener,
so a seat can discard its only qualifying Hero and then be offered "Reveal a matching …
Hero" it no longer holds; by rules L556-570 (steps 1-2 before the Escape effect) that
seat should take the Wound. This is the D-24656 point-4 consequence, recorded in
D-24779 and in the live-verify notes; re-testing at open is a scope change left to
Jeff.

**Why not a setup-time flag to keep old replays.** Gating the choice on a hook field
set only for new matches would keep pre-deploy logs replaying, but it leaves two
permanent code paths for one rule. D-24656 already accepted that re-executing a
pre-deploy log stalls when a runtime change parks a choice the log never answers;
this WP takes the same position (see Replay compatibility).

**Bot / sim.** Default and playing-seat answer are both Reveal, which is what
auto-reveal did, so every simulated Wound outcome is the same as today. What can move:
extra `resolveSeatChoice` decisions in sim trajectories, the transient
`G.pendingSeatChoice`, and `strikeBlocked` events now pushed after the move's other
events. Whether any pinned oracle moves is **measured at execution** (predictions under §Files;
a surprise is STOP-and-explain)
(memory `reference_getlegalmoves_change_determinism_scope`): run the hash oracles,
`sim:runtime-observed:check` and the dashboard pin; re-pin only what moved, by its
recorder, and say why in the commit. PAR profiles are measured; if they move, the
cause is recorded for the follow-up `INFRA:` re-pin
(`node scripts/generate-par-profiles.mjs --version v1`); they are not re-pinned in
EC-883. A smarter bot (decline when it holds a
Wound-KO payoff) is a follow-up.

**Seat order.** The apply is ascending (D-24501 governs every simultaneous apply) and
`revealingSeats` are recorded ascending, whatever order the effect loop runs in:
`enqueueRevealOrWoundChoice` sorts them itself (numeric ascending), so a later
rotation of the effect loop cannot change the stored or applied order. The
effect loops themselves (the inline cannot-reveal Wounds) are WP-846's (reserved, #3035: rules
v23 L2247, start with the current player and go clockwise): if WP-846 lands first
they already rotate, and this WP keeps that; if this lands first, WP-846 rotates them
with the enqueue split inside. Under a short supply this gives a mixed order
(cannot-reveal seats in turn order at effect time, decliners ascending at apply),
recorded in D-24779 and in WP-846's reserved decision (D-24780, reserve PR #3035).

**Replay compatibility.** This changes runtime handler code that existing hooks reach,
so it is not setup-only (memory `reference_setup_hook_change_replay_compat`). A match
in progress at deploy gets the prompt on its next reveal-or-wound with a revealer.
Re-executing a pre-deploy log that contains such a resolution stalls (the log never
answers the new choice), the D-24656 class: competitive verification
(`replay_verification_failed`), coach `reduceReplayByHash`. Accepted, no migration;
D-24779 records it.

## Scope (In)

- **Type** (`types.ts`): `PendingRevealOrWoundChoice` interface and optional
  `G.pendingRevealOrWoundChoices?: PendingRevealOrWoundChoice[] | undefined`, lazily
  created at the enqueue site, deleted when drained, never set in `Game.setup`, not
  projected to UIState.
- **New module** `moves/revealOrWoundChoice.logic.ts`: `REVEAL_OR_WOUND_SEAT_CHOICE_KIND`,
  the option-index constants, `enqueueRevealOrWoundChoice`,
  `buildRevealOrWoundSeatChoice`, `openRevealOrWoundSeatChoiceIfNeeded`,
  `applyRevealOrWoundSeatChoice`.
- **Dispatch**: one branch in `applySeatChoiceByKind` (`moves/seatChoice.resolve.ts`).
- **Hero site**: `heroEffectRevealOrGainWoundEach` enqueues its revealers instead of
  skipping them; the apply line replaces "Every player revealed" for the queued case.
- **Villain site**: `villainEffectRevealOrWound` enqueues its revealers; their
  `strikeBlocked` push moves to the applier (Reveal only).
- **Wiring** (01.5): the opener call in `game.ts` `turn.onMove`, and in
  `simulation/simulation.runner.ts` (2 sites), `simulation/par.aggregator.ts`
  (2 sites), `test/fixtures/runFixture.ts` (1 site), at the positions in Design Rationale Shape §4.
- **End-of-game drop set** (`endgame/mastermindVictory.logic.ts`) and its
  `ALL_PENDING_FIELDS` test list; the operator-setter pending check
  (`moves/operatorSetters.logic.ts`).
- **Client**: one heading case in `PendingSeatChoicePrompt.vue` + one test.
- **Tests**: new `moves/revealOrWoundChoice.test.ts`; revealer cases in
  `hero/crazedRampage.revealOrGainWound.test.ts` and `villain/villainEffects.execute.test.ts`
  rewritten to the new behaviour (product behaviour intentionally changed; the commit
  says so); the AC-8 real-reducer cases in `game.test.ts` (non-active revealer, mixed
  active + non-active, Diving Block decliner); the AC-8 seeded two-seat sim +
  `runFixture` case and its PAR-loop twin in `simulation/seatChoiceDispatch.test.ts`
  (the WP-793 precedent), so the mirror wiring is proven; one BLOCKERS entry in `moves/operatorSetters.test.ts`.
- **Shared label with WP-837.** WP-837 (drafted) locks `Gain a Wound instead`
  (`VILLAIN_EFFECT_WOUND_OPTION_LABEL`) for Frost Giant Warrior's discard-or-Wound
  choice. This WP uses the same text: if WP-837 has not landed, this WP exports
  `VILLAIN_EFFECT_WOUND_OPTION_LABEL` (same name) from `moves/revealOrWoundChoice.logic.ts`
  and WP-837 imports it; if WP-837 landed first, this WP imports WP-837's. WP-837 /
  EC-875 carry the reciprocal line (added with this draft). (WP-837 wounds its no-match seats when the
  choice opens; this WP wounds them at effect time, keeping the no-revealer path
  byte-identical. D-24779 records the difference.)
- **Import cycles.** The new module and `seatChoice.resolve.ts` reference each other
  only inside function bodies, and so does the chain through `moves/phaseCard.ts`
  (`hasAnyPendingChoice`) → `playVillainTop.resolve` → `villainDeck.reveal` →
  `villainEffects.execute` (the "third cycle" at `villainEscapeProcedure.ts` ~L36-41).
  No imported binding is read at module top level; local constants are literals. The
  `// why:` names both cycles.
- **Existing tests rewritten (named; nothing else in either file changes):**
  `villain/villainEffects.execute.test.ts` — the four WP-646 / WP-651
  `strikeBlocked`-at-effect-time cases (~L1463-1535) are re-driven through enqueue →
  opener → apply(Reveal), still asserting count, `playerId` and `threatKind`; the AC-7
  "every player revealed" log asserts (~L1678, ~L1710) become the enqueue + apply
  lines. `hero/crazedRampage.revealOrGainWound.test.ts` — the AC-4 / AC-5 revealer
  cases (~L208-299) and the AC-3 "exactly one log line" assert (~L180) take the
  enqueue line. Every cannot-reveal-seat assertion in both files is kept verbatim. The
  commit body lists each rewritten test with its old → new assertion.

## Out of Scope

- Rotating each-player order to start at the current player (WP-846, reserved in #3035).
- Any other "reveal X or Y" form (reveal-or-discard Master Strikes, `reveal-from-hand`
  draws: revealing there is pure upside, so declining is strictly dominated, D-24470).
- A bot policy that declines (follow-up; needs a Wound-payoff read).
- `simulation/ai.seatChoice.ts` and `getLegalMoves` (no change; default = Reveal).
- Any new move, `UIState` field, card-data or marker change, registry or server change.
- Re-testing the predicate at open time (Design Rationale).
- The core Legacy Virus Scheme Twist (`rules/schemeTwistConfigs.ts` `reveal-or-punish`,
  `penalty: 'gainWound'`, resolved in `schemeTwistResolvers.ts`) and the ~45 printed
  "reveals a … Hero or gains a Wound" lines that carry no marker: they stay as they
  are (follow-up). The sentinel fixture plays Legacy Virus with Tech Heroes, so
  touching that twist would move `finalStateHash`.

## Files Expected to Change

- `packages/game-engine/src/types.ts` — **modified** (one interface, one optional field, `// why:`)
- `packages/game-engine/src/moves/revealOrWoundChoice.logic.ts` — **new** (kind + option constants; enqueue / build / open / apply)
- `packages/game-engine/src/moves/revealOrWoundChoice.test.ts` — **new** (unit cases incl. the JSON round-trip and mismatch re-park)
- `packages/game-engine/src/moves/seatChoice.resolve.ts` — **modified** (import + one dispatch branch)
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (the hero effect queues the seats that can reveal)
- `packages/game-engine/src/hero/crazedRampage.revealOrGainWound.test.ts` — **modified** (the named revealer cases rewritten; cannot-reveal asserts kept verbatim)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** (the villain effect queues the seats that can reveal; `strikeBlocked` moves to apply time)
- `packages/game-engine/src/villain/villainEffects.execute.test.ts` — **modified** (four `strikeBlocked` cases and two log asserts re-driven through the queue)
- `packages/game-engine/src/game.ts` — **modified** (01.5 wiring, one opener call)
- `packages/game-engine/src/game.test.ts` — **modified** (the AC-8 real-reducer cases)
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** (01.5 mirror, 2 calls)
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** (01.5 mirror, 2 calls)
- `packages/game-engine/src/test/fixtures/runFixture.ts` — **modified** (01.5 mirror, 1 call)
- `packages/game-engine/src/endgame/mastermindVictory.logic.ts` + `.test.ts` — **modified** (the field joins the drop set and `ALL_PENDING_FIELDS`)
- `packages/game-engine/src/moves/operatorSetters.logic.ts` + `operatorSetters.test.ts` — **modified** (one pending check, one BLOCKERS entry)
- `packages/game-engine/src/simulation/seatChoiceDispatch.test.ts` — **modified** (one seeded sim + `runFixture` case and its PAR-loop twin, AC-8)
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + `.test.ts` — **modified** (one heading case, one test)
- **Conditional (only if the measured run moves them), each re-pinned by its writer
  with the cause in the commit:**
  `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  (`finalStateHash`, recorder only), `packages/game-engine/src/replay/replay.execute.test.ts`
  (`PRE_WP080_HASH`), `docs/ai/coverage/runtime-observed-hollows.json`,
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (`totalObs`).
  **Not in this WP:** `data/par/profile/v1/**`; if the multi-seat profiles move they
  are re-pinned by a follow-up `INFRA:` PR with
  `node scripts/generate-par-profiles.mjs --version v1` after EC-883 merges, one run
  shared with WP-846's (the
  WP-793 precedent, #2593; they are already stale against `main`, PR #2698).
  **Predictions** (a surprise is a STOP-and-explain): the
  sentinel does not move (its Brotherhood Sabretooth needs an X-Men Hero and the
  fixture's Black Widow / Captain America decks hold none, so nothing is queued);
  `PRE_WP080_HASH` does not move (empty replay, no hooks); `sim:runtime-observed`,
  `totalObs` and (in the follow-up) the PAR profiles may move (extra decisions against the per-turn step
  budget). Seed PAR (`data/par/seed/v1`) is rating-based and cannot move.
- Governance close (all **modified**): `docs/ai/DECISIONS.md` (D-24779), `docs/ai/STATUS.md`,
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/coverage/live-verify.json`.

Expected **unchanged** (checked at draft): `docs/ai/rulings/effect-rulings.json` — its
three reveal-or-wound rulings assert the discard pile at effect time (no-match → one
Wound; match in hand / in play → empty), which a queued revealer still satisfies;
`board/escape-wound.integration.test.ts` (Ultron's onEscape replaces the generic
Wound — unaffected). If either fails at execution, STOP: it means the cannot-reveal
path changed.

The list exceeds 00.3 §5's ~8-file guide because the opener needs the same five mirror
sites as D-24750 (one call each) and the end-of-game / operator pending lists; the new
logic is one module.

## Non-Negotiable Constraints

> - Full file contents for every new or modified file — no diffs, no snippets; human-style code per
>   `docs/ai/REFERENCE/00.6-code-style.md`; ESM; Node v22+; no `.reduce()`; JSDoc on
>   every function; full-sentence log text.
> - Moves never throw. The opener, builder and applier are plain helpers (no
>   boardgame.io import in the new module beyond types); every missing-zone or
>   malformed-entry case is a safe skip.
> - Determinism: no RNG, no wall-clock; ascending seat order at enqueue and apply.
> - The new `G` field is lazy and deleted when drained; a match where no revealer is
>   ever queued never creates it.
> - The cannot-reveal path is byte-identical to today (same helper calls, same log
>   lines, same order).
> - Never edit a pinned hash or fixture by hand; never weaken an assertion to pass.
> - On any ambiguity the WP + EC do not resolve, STOP and surface it.

## Contract

- **Kind** `reveal-or-wound`; options index 0 `{revealOptionLabel}`, index 1
  `Gain a Wound instead`; `defaultOptionIndex` 0.
- **Queue entry** `PendingRevealOrWoundChoice { sourceCardId: CardExtId;
  currentPlayerID: string; revealOptionLabel: string; revealingSeats: string[];
  strikeBlockThreatKind?: StrikeBlockThreatKind }` (`strikeBlockThreatKind` present
  for the villain source only).
- **Behaviour**: cannot-reveal seats wounded inline (unchanged); can-reveal seats
  queued; opener parks after the move (empty supply → all reveal, no prompt); apply in
  ascending seat order.

## Vision Alignment

- **Vision clauses touched:** §1 (rules v23 L3196-3200's decline becomes playable); §2;
  §4 (simultaneous prompts on non-active seats; the D-24501 pause-and-preserve posture
  is unchanged); §8 / §22 (no RNG; ascending seat order; lazy field; oracles re-pinned
  only by their recorder); §18 / §24 (new replays are faithful; a pre-deploy log holding
  a queued reveal-or-wound stops re-executing — competitive `replay_verification_failed`,
  the D-24656 class — accepted in D-24779); §26 (PAR profiles measured; any move is
  re-pinned by the follow-up `INFRA:`).
- **Conflict assertion:** No conflict — a printed rule (L3196-3200) becomes playable;
  no RNG, no paid advantage (NG-1 untouched).
- **Non-Goal proximity check:** N/A — none of NG-1..NG-8 crossed.
- **Determinism preservation:** no RNG; fixed seat order; the new field is lazy; oracle
  movement measured and re-pinned only by recorder (Design Rationale, Bot / sim).

## Funding Surface Gate

§20 N/A — engine gameplay and one prompt heading; no funding affordance or copy.

## API Catalog Update

§21 N/A per D-11804 — no HTTP endpoint or server-reachable library function changes.

## Acceptance Criteria

- **AC-1** Villain, 2 players, current player `0`: seat 0 holds an X-Men Hero, seat 1
  does not; Sabretooth's Fight `reveal-or-wound:team:x-men` → seat 1 gains a Wound
  inline (today's line), and one queue entry `{ revealingSeats: ['0'],
  strikeBlockThreatKind: 'fight' }` exists; no `strikeBlocked` yet. (Hero entries
  omit the `strikeBlockThreatKind` key entirely: AC-4 asserts
  `!('strikeBlockThreatKind' in entry)`.)
- **AC-2** Opener on that state parks `G.pendingSeatChoice` of kind `reveal-or-wound`
  addressed to `['0']` with the two locked option labels and default 0; the entry stays
  at the front of `G.pendingRevealOrWoundChoices`; a second opener call does nothing.
- **AC-3** Apply: seat 0 submits 1 → seat 0 gains a Wound through
  `gainWoundWithOutcome`, `woundsDrawn` +1 (seat 0 is the current player), the summary
  line is logged; submits 0 instead → no Wound, one `strikeBlocked` for seat 0 with
  threat kind `fight`. Either way the entry is shifted off and the empty queue key is
  deleted. A choice whose addressed seats do not match the front entry is logged and
  applies nothing and leaves the entry queued; the opener re-parks it on the next `onMove`.
  In `revealOrWoundChoice.test.ts`: a `JSON.parse(JSON.stringify(G))` round-trip between
  park and resolve still applies and shifts (seat equality is element-wise, never array
  identity); a forced mismatch re-parks once and the next resolve drains the entry.
- **AC-4** Hero (co2e Crazed Rampage): a non-playing seat holding a Strength Hero is
  queued; the playing seat's "another" scope is unchanged (`playerCanRevealMatch`); a
  decline by the non-playing seat does not move the playing seat's `woundsDrawn`.
- **AC-5** No revealer → nothing queued, `!Object.hasOwn(G, 'pendingRevealOrWoundChoices')`,
  and the final `G` matches literal expected values captured on the **unmodified**
  baseline before any code change (messages text + outcome, discard piles,
  `notableEvents`, `woundsDrawn`), one fixed input per site. Computing the expected
  value with the new code is forbidden.
- **AC-6** Empty Wound supply at open time → no choice parks, the entry resolves as all
  revealing, its line is logged, a villain source pushes one `strikeBlocked` per
  revealing seat with the entry's threat kind, and the entry is shifted off.
- **AC-7** Opener guards: does nothing while another seat choice or `pendingHeroChoice`
  is open, or once `evaluateEndgame` is non-null; two entries queued in one move open
  one at a time, FIFO; an entry with empty `revealingSeats` is shifted and no choice
  parks (a `blocked` line is logged, text not asserted).
- **AC-8** Wiring. Live reducer (`game.test.ts`, the `InitializeGame` / `CreateGameReducer`
  pattern): a **non-active** revealer, and one mixed case (active + non-active), each
  submit `resolveSeatChoice` and the reducer accepts it and the turn proceeds; a seat
  that declines while holding Diving Block gets its `pendingDivingBlockWounds` entry
  and the Diving Block wave opens in that move's `onMove`. Mirrors
  (`simulation/seatChoiceDispatch.test.ts`): a seeded two-seat sim where a
  reveal-or-wound queues a non-active revealer resolves it (that seat submits
  `resolveSeatChoice`) and the recorded run replays through `runFixture` to the same
  state; a twin of that case driven through the PAR loop does the same.
- **AC-9** Timeout / absent seat: `applySeatChoiceTimeoutDefault` resolves the seat as
  Reveal; `choosePlayingSeatChoiceOption` returns 0 for the kind.
- **AC-10** Client: the prompt shows the locked heading for kind `reveal-or-wound` and
  the two option labels; submitting index 1 sends `resolveSeatChoice({ optionIndex: 1 })`.
- **AC-11** The new field joins `ALL_PENDING_FIELDS`, is cleared on a decided match,
  and the operator-setter pending check reports it.
- **AC-12** Determinism: the hash oracles, `sim:runtime-observed:check` and the
  dashboard pin are run; each either is byte-unchanged or is re-pinned by its recorder
  with the measured cause in the commit body. PAR profiles are measured only; a move is
  recorded for the follow-up `INFRA:` re-pin, not re-pinned in EC-883; the predictions under §Files hold or the
  difference is explained.

## Verification Steps

1. `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0
   (record the delta and every pin that moved).
2. `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`,
   `pnpm effect-index:check`, `pnpm ledger:villains:check`, `pnpm ledger:heroes:check`
   exit 0 (or the artifact is regenerated with the measured cause).
3. `pnpm --filter @legendary-arena/arena-client test` and `typecheck` exit 0.
4. `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` and
   `run prebuild:effect-index`, then `pnpm -r --no-bail test` — 0 failures.
5. **Revert proofs:** (a) drop the opener call from `game.ts` → the AC-8 real-reducer
   case fails; (b) make the enqueue site wound revealers again → AC-1 fails; (c) drop
   the `simulation.runner.ts` mirror calls → AC-8's sim / `runFixture` case fails;
   (d) drop the `par.aggregator.ts` calls → AC-8's PAR-loop twin in
   `simulation/seatChoiceDispatch.test.ts` fails (if the PAR loop has no test seam,
   record the manual revert run in the commit body);
   (e) force the stage ride to always skip → the AC-8 non-active case fails; restore
   all.
6. `git diff --name-only` equals the EC allowlist; no CRLF-only churn.

## Definition of Done

- [ ] AC-1..AC-12 satisfied; Verification Steps green, including the five revert proofs.
- [ ] No files outside the finalised EC allowlist.
- [ ] `docs/ai/DECISIONS.md` **D-24779 Active**.
- [ ] `docs/ai/STATUS.md` close-out entry.
- [ ] **D-24026 live-on-surface:** a `play.legendary-arena.com` 2-player match created
      after the deploy where a reveal-or-wound fires with a revealer: the prompt shows
      on that seat, Reveal avoids the Wound, Gain a Wound instead takes it; recorded in STATUS /
      DECISIONS and `docs/ai/coverage/live-verify.json`, or operator-pending.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`.

## Reserved Decision (lands at execution)

**D-24779 — A player who can reveal for "reveal … or gain a Wound" chooses, through a
multi-seat seat choice, for both the hero keyword and the villain primitive.** Records:
rules v23 L3196-3200; the hero + villain scope and why; cannot-reveal seats wounded
inline unchanged, can-reveal seats queued on lazy `G.pendingRevealOrWoundChoices` and
opened after the move (the D-24750 / D-24656 point 4 deviation); predicate fixed at
effect time; the entry is removed at apply (the Timestream Purge shape), so the applier
reads its payload; empty supply → no prompt; default and bot answer Reveal (the
`reveal-or-wound` row of the D-24744 audit table is recorded here, D-24744's Active
body is not edited); `strikeBlocked` moves to apply time, so the shield-block VFX plays
when the Reveal lands, not at the fight; every trigger waits on every human revealer
(accepted for fidelity; smarter bot is a follow-up); opener position (after the
escape / Purge openers and re-check, before Diving Block); the cross-queue order
residual with WP-817's owed discards; the mixed seat-order residual with WP-846
(cannot-reveal seats in turn order at effect time once WP-846 lands, decliners
ascending at apply, D-24501); the owed multi-seat PAR re-pin, one `INFRA:` run shared
with WP-846; the shared `Gain a Wound instead` label and the
open-time vs effect-time wounding difference from WP-837; measured oracle movement;
replay stall for pre-deploy logs accepted (D-24656 class); residuals: the core Legacy
Virus twist and unmarked printed lines stay auto-reveal, and the Escape + carried
Bystanders case (a seat may be offered a reveal it can no longer make); the three
`reveal-or-wound` effect rulings stay valid as effect-time assertions (no decline
ruling: the rulings runner fires only the executor). Amends D-24281 (Semantics) and
D-24777 §5.

## Lint Gate Self-Review (00.3)

Completed at draft against all 21 sections, after both gates, by an independent
subagent. Its first run FAILED §2 (no explicit diff / snippet ban), §3 (reused helpers
not listed with files), §5 (entries without descriptions; the PAR-twin file unnamed), §9
(`grep -c` corpus count), §14 (14 ACs) and §17 (replay / PAR clauses missing), plus
EC-883 against EC-TEMPLATE (arena-client `typecheck` missing from Before Starting,
`roadmap:counts:check` missing, the heading text differed from the WP). All were fixed
in place; the list shows the post-fix state.

- **PASS:** §1 (every required section present, §Contract included; Out of Scope names
  seven exclusions); §2 (full-file / no-diffs / no-snippets / ESM / Node v22 / `00.6`
  constraints, packet-specific determinism, lazy-field and byte-identical cannot-reveal
  constraints, STOP-on-ambiguity, locked values in §Contract and EC-883); §3 (WP-469 /
  WP-684 / WP-793 / WP-817 / WP-843 Done; both auto-reveal sites, the seat-choice
  machinery, the D-24750 queue precedent and every reused helper named with its file;
  the bot-ally driver needs no change; hash surfaces stated; soft ordering with WP-844 /
  WP-836..840 recorded); §5 (every file marked new / modified with its change, the
  conditional oracle re-pins named with their writers, the PAR-loop twin homed in
  `simulation/seatChoiceDispatch.test.ts`; the count above ~8 is justified under
  §Files); §6 (canonical names; `currentPlayerID` follows the `playerID` casing; no 00.2
  field touched); §7 (no new dependency); §8 (engine-only logic plus one client heading;
  lazy, JSON-serializable `G` field, never persisted or projected; no RNG); §9 (`pnpm` /
  `node` / `git`; the corpus re-count is `Select-String`); §12 (`node:test`, no
  `boardgame.io/testing`; the reducer case extends `game.test.ts` per the WP-411
  precedent; no network / DB; hash oracles stand in for the golden test); §13 (exact
  commands, each "exits 0" or naming the AC a revert proof fails); §14 (twelve binary ACs
  naming files, fields, labels and log lines); §15 / §15.1 (STATUS, DECISIONS D-24779
  Active, WORK_INDEX + EC_INDEX, scope-boundary check; `play.legendary-arena.com`
  declared with a live-on-surface DoD item); §16 (`00.6` cited; the enqueue helper is the
  queue's single writer, the `enqueueEscapeProcedure` precedent; no `.reduce()`; JSDoc
  and `// why:` locations in EC-883); §17 (clauses §1 / §2 / §4 / §8 / §18 / §22 / §24 /
  §26, no-conflict assertion, NG-1..NG-8 check, determinism line); §19 (baseline
  `51a43bf8` cited; re-baseline at execution).
- **§4:** Context is specific (files, D-entries, rules line ranges, 01.5). No data-shape,
  layer-boundary or import change and no new `UIState` field, so 00.2 and ARCHITECTURE.md
  are not required references.
- **EC-883:** under the 100-line ceiling; arena-client `typecheck` in both Before
  Starting and After Completing; mindmap + `roadmap:counts:write` / `:check`;
  live-on-surface gate; Locked Values match the WP (kind, options, entry shape, labels,
  heading `Reveal a Hero or gain a Wound?`).
- **N/A, with reason:** §10 (no environment variables); §11 (no authentication); §18 (no
  forbidden-token grep; the only grep is a card-marker corpus count); §20 (engine
  gameplay and one prompt heading; no funding affordance or copy); §21 (no HTTP endpoint
  and no `apps/server/src/**` file or catalog row touched, per D-11804).

## Gate Record

- **01.4 pre-flight (independent subagent):** NOT READY → READY TO EXECUTE. PS-1: the
  applier could not read its payload (`PendingSeatChoice` has none and the timeout path
  passes no current player); the entry now stays queued until apply (Timestream Purge
  shape). PS-2: WP / EC log-line disagreement; both "every player revealed" lines are
  zero-seat only and the enqueue line order is locked. PS-3: mirror wiring was
  untested; AC-13 (seeded sim + `runFixture`), revert proof (c), two test files and the
  named conditional oracle paths added. RS-1..RS-9 folded (exact opener positions, the
  Diving Block ordering reason, empty-supply `strikeBlocked`, the shared WP-837 label,
  D-24744 row in D-24779, prediction lines, import cycle, VFX timing, WP-844 soft
  ordering, vision §4). Re-confirmation: READY TO EXECUTE after C-1 (a seat mismatch
  leaves the entry queued) and C-2 (stale failure smell), both applied.
- **01.7 copilot (independent subagent):** pass 1 RISK / HOLD, findings A-M applied
  (verbatim builder seats + element-wise equality + open-time validation + AC-3b
  JSON / mismatch tests; AC-8 non-active and mixed real-reducer cases + revert proof
  (e); Goal narrowed and the Legacy Virus twist / unmarked lines out of scope; the
  rewritten tests named; AC-5 literal baseline; revert proof (d) for the PAR mirror;
  hero entries omit `strikeBlockThreatKind`; the shared label's home locked both ways
  with the WP-837 / EC-875 reciprocal line; both import cycles; the Escape +
  carried-Bystanders residual; effect rulings still valid; PAR to a follow-up
  `INFRA:`). Pass 2 RISK / HOLD, findings 1-3 applied (stale EC seat-order line;
  two PAR re-pin passages; the D-24780 citation). Pass 3 (diff-confirm of findings
  1-3): **CONFIRM** — the pre-flight READY TO EXECUTE verdict stands.
- **00.3 lint (independent subagent):** FAIL on §2 / §3 / §5 / §9 / §14 / §17 and three
  EC-TEMPLATE items; all fixed in place (AC-3b folded into AC-3, AC-13 into AC-8, so
  AC-1..AC-12); post-fix re-lint **PASS** (every section PASS or justified N/A; EC-883
  meets EC-TEMPLATE).
- **01.7 pass 4 (diff-confirm of the post-lint edits):** one wording finding (the §Scope
  "Tests" and §Files `game.test.ts` lines still described one reducer case), fixed to
  name the AC-8 cases; per the reviewer, **CONFIRM** once those lines match AC-8, which
  they do.
