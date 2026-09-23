# WP-743 — Spring the Trap / Grief: gate on a Master Strike (or Ambush Villain) played this turn (Engine + card data)

**Status:** Draft 2026-09-22 (EC-780; D-24566 reserved) — READY TO EXECUTE (pre-flight READY, copilot PASS r2, lint PASS r2)
**Primary Layer:** Game Engine (`packages/game-engine/src/**`) + card data (`data/cards/{vnom,msis}.json` via the curated hero-ability-marker map)
**Dependencies:** WP-568 / D-24377 (wait-and-see deferred conditional grants) ✅, WP-656 / D-24467 (event-gate wait-and-see condition + marker→condition precedent) ✅, WP-542 / D-24351 (`playTopVillainDeckCards` — every villain-deck play routes through `performVillainReveal`) ✅
**User-Visible Surface:** play.legendary-arena.com (the in-match economy + game log)
**Baseline:** `origin/main` @ `2efdc971`

---

## Goal

As a player using Venom Rocket's **Spring the Trap** or Wanda & Vision's **Grief**, I
want the card's bonus to fire only when its printed condition is met, so the match
plays the way the card reads. Today the condition is ignored and the bonus is free.

- **Spring the Trap** (`vnom/venom-rocket/spring-the-trap`): "If a Master Strike or
  Villain that has an Ambush ability was played this turn, you get +1 Attack."
- **Grief** (`msis/wanda-vision/grief`): "If a Master Strike was completed this turn,
  you get +2 Recruit."

---

## User-Visible Impact

Found live on Jeff's 2p bot-ally game on 2026-09-22 (Red Skull / Midtown Bank Robbery,
Venom heroes, build `2efdc97`, match `lQenkemqsPx`). The bot gained "+1 attack from
Spring the Trap" on turns 13 and 19 (log 13.2.6, 19.2.2). In both turns the only
villain-deck reveal was a Bystander: no Master Strike and no Ambush Villain.

After this WP:

- **Spring the Trap** grants +1 Attack only in a turn where a Master Strike or an
  Ambush Villain has been played.
- **Grief** grants +2 Recruit only in a turn where a Master Strike has been played.
- **When the condition is not yet met,** the card waits (the D-24377 whole-turn
  window). If a Master Strike or Ambush Villain lands later that same turn (for
  example Endless Armies of HYDRA playing the top two villain cards), the bonus fires
  then, exactly once.

---

## Assumes

All verified at baseline `2efdc971`.

- **Both cards are free grants today.** Observed by running `buildHeroAbilityHooks`
  against the local registry at the baseline build. Each hook carries its printed
  grant and **no condition**:
  - `vnom/venom-rocket/spring-the-trap#0` → `{"keywords":["attack"],"effects":[{"type":"attack","magnitude":1}]}`
  - `msis/wanda-vision/grief#0` → `{"keywords":["recruit"],"effects":[{"type":"recruit","magnitude":2}]}`

  Neither ability line carries a `[keyword:…]` marker. The Step 2b
  icon-magnitude read grants the `+N[icon:…]` unconditionally.
- **These are the only two cards.** A grep of `data/cards/*.json` for
  "Master Strike … this turn" and "Ambush … this turn" finds exactly these two lines.
  The antm/dkcy "When a Master Strike is played … you may discard this card" is a
  different, reactive mechanic.
- **The marker→condition pattern exists.** It has shipped for `[keyword:recruit-threshold:N]`, `[keyword:draw-threshold:N]`,
  `[keyword:defeated-villain-or-mastermind]` and `[keyword:first-hero-condition]`
  (`setup/heroAbility.setup.ts` ~1225–1296). A recognized marker pushes a
  `HeroCondition` onto the same hook as the printed grant, before the
  unresolved-marker fallback.
- **The whole-turn window exists.**
  - `WAIT_AND_SEE_CONDITION_TYPES` (`hero/deferredConditionalGrants.ts` ~59–72) gives a
    condition that fails at play a deferred grant.
  - That grant is re-checked by the existing per-move `onMove` resolution and fires
    once when the condition turns true (shape #1, one-shot).
  - The turn boundary clears it (`game.ts` ~808, `clearDeferredConditionalGrants`).
  - A runtime drift pin in `deferredConditionalGrants.test.ts` enforces that every
    listed type has an `evaluateCondition` case.
- **There is one reveal chokepoint.** Every villain-deck card play goes through
  `performVillainReveal` (`villainDeck/villainDeck.reveal.ts:201`):
  - the start-of-turn reveal (`revealVillainCard`, L174)
  - the scheme-twist chains (`rules/schemeTwistResolvers.ts:264, 573`)
  - `playTopVillainDeckCards` (L698; The Leader's Ambush at L526, the Endless Armies
    of HYDRA fight at `moves/fightVillain.ts:486`, and Shadowed Thoughts at
    `moves/playVillainTop.resolve.ts:106`)

  The one non-deck City placement is Secret Invasion's Skrull conversion
  (`schemeTwistResolvers.ts:707`, an HQ hero). It is not a villain-deck play, has no
  Ambush, and correctly sets nothing.

  Inside it:
  - Master Strikes take the `cardType === 'mastermind-strike'` branch (L582 hooks,
    L669 routing to `G.mastermind.strikePile`).
  - An Ambush card is detected once as `cardHasAmbush = hasAmbush(cardId, G.cardKeywords ?? {})`
    (L278), inside the villain/henchman City-entry branch.
- **Per-turn resets happen in `onBegin`.** The play-phase turn `onBegin` (`game.ts` ~798–818)
  clears per-turn state before the start-of-turn reveal. That includes the guarded
  delete of the WP-656 edge flag `villainOrMastermindDefeatedSinceResolve`.
- **The rebuilt turn loops mirror `onBegin` through a parity helper.** Three loops
  rebuild boardgame.io's turn cycle and never run `game.ts` `onBegin`:
  - `simulation/simulation.runner.ts:724`
  - `simulation/par.aggregator.ts:776`
  - `test/fixtures/runFixture.ts:327`

  They copy its resets through `applyOnBeginParity` (`simulation/onBeginParity.ts:38`),
  which today clears only `villainRevealedThisTurn` and `hasDrawnThisTurn`. A
  per-turn flag reset only in `game.ts` would carry over between turns in the sim,
  the PAR sweep and the fixture runner (pre-flight PS-1).
  `replay/replay.execute.ts` has no turn rotation, so no action is needed there.
- **Hash-safe lazy fields.** A `G` field that is absent in a game never shifts the
  two hash oracles: the sentinel `finalStateHash` and `PRE_WP080_HASH` (the D-24377
  §6 / D-24467 lazy-field posture). The sentinel fixture is `sentinel-core-doom-2p`,
  with no vnom or msis hero.
- **Marker plumbing.** Hero markers come from the curated map
  `scripts/convert-cards/inputs/hero-ability-markers.json` and are applied by
  `apply-hero-ability-markers.mjs`, which is surgical and idempotent. That script's
  token allowlist regex (~L106) and `scripts/hero-mechanic-ledger.mjs`'s
  marker→condition map (~L174) are the only other places that enumerate
  condition-marker names (a grep for `draw-threshold` across `scripts/`).
- **No typecheck gate on engine tests.** Engine tests are not typechecked in CI
  (D-24372). The drift pins are runtime assertions.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md`:
  - D-24377 (the whole-turn wait-and-see operator decision: "If you [did X] this
    turn" is a whole-turn window)
  - D-24467 (event-gate condition + marker; gated lazy `G` field)
  - D-24351 (villain-deck play loop)
  - D-24372 (runtime drift pins)
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 (Ability Text Markup Language): the
  two new `[keyword:…]` tokens follow the §5.1 token form.
- `packages/game-engine/src/hero/{heroConditions.evaluate,deferredConditionalGrants}.ts`
  and their tests; `diamondForm.overfire.test.ts` (the closest behavioral precedent).
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` L195–720.
- `packages/game-engine/src/setup/heroAbility.setup.ts` L1225–1296.
- `packages/game-engine/src/game.ts` L798–818.

**Why wait-and-see and not a play-time snapshot.** D-24377 is an operator decision:
"If you [did X] this turn" is a whole-turn window. It limited the window to numeric
thresholds so that the `[hc:X]` class gates keep play-order skill. "A Master Strike
was played this turn" is a **sticky, monotonic** predicate: once true, it stays true
for the turn. That makes it a count ≥ 1 threshold (shape #1: one-shot), not a
play-order gate. Reordering hero plays cannot make a Master Strike appear, so a
snapshot would only punish playing the card before a mid-turn Master Strike. It
would add no skill.

**Why include Grief.** Grief has the same defect (a free +2 Recruit) and reads the
same per-turn Master Strike signal. Fixing only Spring the Trap would leave a known
sibling over-grant built on the very signal this WP adds. Scope stays two cards, one
chokepoint and two conditions.

**Why two conditions, not one parameterized one.** Spring the Trap accepts a Master
Strike **or** an Ambush Villain; Grief accepts only a Master Strike. Two explicit
condition types with two explicit flags follow the code-style rule "no dynamic
property access for known keys". It keeps each evaluator case a one-line boolean
read.

**Why gate the write.** Writing the flags only when some hero hook reads them keeps
every other game's `G` byte-identical. That avoids a hash re-pin, sim-feed churn and
any PAR shift for matches without these cards (the D-24467 posture).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:`-prefixed imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English words,
  `is`/`has`/`can` booleans, JSDoc on every function, `// why:` on non-obvious
  choices, no `.reduce()` with branching.
- Determinism: no `Math.random()` or wall-clock; moves never throw; the evaluator
  never throws (an absent flag reads `false`).
- Error messages are full sentences.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and
ask.

**Packet-specific:**
- **One write site.** Both flags are written only inside `performVillainReveal`. No
  flag writes in moves, schemes or mastermind handlers.
- **Gated, lazy writes.** A flag is written only when `G.heroAbilityHooks` contains a
  hook carrying a condition that reads it. It is never written as `false`, it is
  absent otherwise, and it is deleted (guarded) in the play-phase turn `onBegin`.
  Consequence: the sentinel `finalStateHash` and `PRE_WP080_HASH` are
  **byte-unchanged**. No re-pin is permitted; a moved oracle means a gating bug.
- **Card data is regenerated, not hand-edited.** The markers go through the curated
  map plus `apply-hero-ability-markers.mjs` apply mode. `cards:check` must reproduce
  the committed bytes.
- **Label/log copy.** `describeFailedCondition` gains full-sentence cases (below).
  The `default` fallback stays.
- **Drift pins are runtime assertions** (D-24372). Never `any`, `@ts-ignore`, or a
  loosened type.
- **No new move, no new `onMove` resolve call.** The existing deferred-grant
  resolution fires the grant.

---

## Scope (In)

### A) `packages/game-engine/src/types.ts` (**modified**)
- `LegendaryGameState` gains two optional fields, each with a `// why:` (WP-743 /
  D-24566):
  - `masterStrikePlayedThisTurn?: boolean`: a Master Strike was played this turn.
  - `ambushVillainPlayedThisTurn?: boolean`: a Villain or Henchman with an Ambush
    ability was played (entered the City from the Villain Deck) this turn.
- Both are gated and lazy (absent unless a hook reads them), and cleared at the turn
  boundary.

### B) `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` (**modified**)
- In `performVillainReveal`:
  - Inside the existing `if (cardHasAmbush)` executor block (~L466), **before** The
    Leader's `playTopVillainDeckCards` call, when the match reads the ambush flag,
    set `G.ambushVillainPlayedThisTurn = true`. Setting it before the chained play
    means a card revealed by that chain sees it already set.
  - In the `mastermind-strike` routing branch, **immediately after** the
    `strikePile` append (~L672), when the match reads the master-strike flag, set
    `G.masterStrikePlayedThisTurn = true`. The only reader runs at `onMove` or at a
    later play, so setting it after `applyRuleEffects` is safe.
- "The match reads the flag" is the new pure helper
  `matchReadsConditionType(G, conditionType)` (Scope C). It is evaluated per reveal
  and is true iff any `G.heroAbilityHooks` entry has a condition of that type.
- The master-strike flag is read by both new conditions. The ambush flag is read only
  by the Spring the Trap condition.

### C) `packages/game-engine/src/hero/heroConditions.evaluate.ts` (**modified**)
- New exported condition-type constants:
  - `MASTER_STRIKE_THIS_TURN_CONDITION_TYPE = 'masterStrikePlayedThisTurn'`
  - `MASTER_STRIKE_OR_AMBUSH_THIS_TURN_CONDITION_TYPE = 'masterStrikeOrAmbushPlayedThisTurn'`
- `evaluateCondition` cases:
  - `masterStrikePlayedThisTurn` → `G.masterStrikePlayedThisTurn === true`
  - `masterStrikeOrAmbushPlayedThisTurn` → `G.masterStrikePlayedThisTurn === true || G.ambushVillainPlayedThisTurn === true`
  - Both ignore `condition.value` (`'1'` is a placeholder).
- `describeFailedCondition` cases (locked text):
  - `masterStrikePlayedThisTurn` → `it needs a Master Strike played this turn`
  - `masterStrikeOrAmbushPlayedThisTurn` → `it needs a Master Strike or a Villain with an Ambush ability played this turn`
- New exported pure helper
  `matchReadsConditionType(G, conditionType: string): boolean`: scans
  `G.heroAbilityHooks` (absent → `false`) with an explicit `for…of`.
  - The master-strike write site passes **either** type: it is true if either
    condition is present. The site calls the helper twice (once per type) and ORs
    the results.
  - The ambush write site passes only the Spring the Trap type.

### D) `packages/game-engine/src/hero/deferredConditionalGrants.ts` (**modified**)
- Append both new constants to `WAIT_AND_SEE_CONDITION_TYPES`, with a `// why:`.
  They are sticky per-turn predicates (a count ≥ 1 threshold), so shape #1
  (one-shot) applies.
- Extend the module doctrine comment's shape #1 paragraph by one sentence naming
  them.

### E) `packages/game-engine/src/setup/heroAbility.setup.ts` (**modified**)
- Two new marker arms, placed before the unresolved-marker fallback, beside
  `defeated-villain-or-mastermind`:
  - `[keyword:master-strike-this-turn]` → push `{ type: 'masterStrikePlayedThisTurn', value: '1' }`
  - `[keyword:master-strike-or-ambush-this-turn]` → push `{ type: 'masterStrikeOrAmbushPlayedThisTurn', value: '1' }`
- Each arm gets a `// why:` citing WP-743 / D-24566. The line's printed `+N[icon:…]`
  grant stays on the same hook (unchanged Step 2b path).

### F) `packages/game-engine/src/game.ts` + `packages/game-engine/src/simulation/onBeginParity.ts` (**modified**)
- In the play-phase turn `onBegin`, beside the WP-656 guarded delete, add guarded
  deletes of both flags, with a `// why:`. Guarded means that a game which never set
  them is byte-unchanged.
- Add the **same two guarded deletes** to `applyOnBeginParity`
  (`simulation/onBeginParity.ts`), with a `// why:` naming the `game.ts` mirror
  (pre-flight PS-1). Without them the simulation runner, the PAR aggregator and the
  fixture runner would carry a Master Strike flag into every later turn. That would
  put the over-grant back into `sim:runtime-observed` and PAR.
- Update the `onBeginParity.ts` module and function JSDoc, which today say it "resets
  the two once-per-turn allowance flags", to name the two new deletes.

### G) Card data (**modified**; regenerated)
- `scripts/convert-cards/inputs/hero-ability-markers.json`, two apply entries:
  - `vnom`: `{ heroSlug: 'venom-rocket', cardSlug: 'spring-the-trap', abilityIndex: 0, markupToken: '[keyword:master-strike-or-ambush-this-turn]' }`
  - `msis`: `{ heroSlug: 'wanda-vision', cardSlug: 'grief', abilityIndex: 0, markupToken: '[keyword:master-strike-this-turn]' }`
- `scripts/convert-cards/apply-hero-ability-markers.mjs`: add both single-segment
  tokens to the token allowlist regex, with the house `// why:` line.
- `scripts/hero-mechanic-ledger.mjs`: add both entries to the marker→condition map.
- `data/cards/vnom.json` and `data/cards/msis.json`: regenerated by apply mode
  (surgical; exactly those two ability lines change).

### H) Derived artifacts (**modified**; regenerated by their sanctioned commands)
Run every `:check` even when it shows no diff.
- **Certain** (every shipped marker token appears in these, so the two new tokens are
  intended universe growth):
  - `data/metadata/effect-implementation-index.json`: `effect-index`
  - `data/metadata/card-mechanics.json`: `mechanics:metadata`
  - `scripts/coverage/hero-effect-coverage.baseline.json`:
    `sim:coverage --update-baseline`. Confirm the diff is only the new tokens on
    these two cards.
- **Conditional** (only if the `:check` reports drift):
  - `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`: `ledger:heroes`
  - `docs/ai/coverage/runtime-observed-hollows.json`: `sim:runtime-observed`
  - If `totalObs` moves, re-pin the one constant in
    `apps/dashboard/src/composables/useInPlayCoverage.test.ts` to the fresh value in
    the same commit.
  - That is the documented feed-regen pairing: a sanctioned re-baseline, not a
    weakened test. It needs a `Tests-changed:` trailer.

### I) Tests (**new/modified**)
- **New** `packages/game-engine/src/hero/masterStrikeOrAmbushCondition.test.ts`,
  covering at least:
  1. **Parse.** Both markers push their condition onto the same hook as the grant.
     The grant is unchanged, and there is no `unresolvedMarkers` entry.
  2. **Evaluate.** Each condition is false when its flags are absent. It is true when
     `masterStrikePlayedThisTurn`, and the or-condition is also true when
     `ambushVillainPlayedThisTurn`. The Grief condition is **false** when only the
     ambush flag is set.
  3. **Write site.**
     - A `mastermind-strike` reveal sets `masterStrikePlayedThisTurn` when a reading
       hook exists.
     - An Ambush villain reveal sets `ambushVillainPlayedThisTurn`.
     - A non-Ambush villain and a Bystander set neither.
     - **With no reading hook, neither key exists on `G`** (the oracle-safety
       assertion).
     - **Per-flag gate.** With only a Grief hook, an Ambush villain reveal leaves
       `ambushVillainPlayedThisTurn` absent, and a Master Strike reveal sets
       `masterStrikePlayedThisTurn`.
  4. **Turn reset.** `onBegin` deletes both flags, and so does `applyOnBeginParity`
     (the parity case). Both are no-ops on a `G` that never set them.
     - The `onBegin` assertion MUST invoke the real `LegendaryGame` play-phase
       `turn.onBegin` (the `game.test.ts` ~L279 pattern), never a hand-written
       `delete`.
  5. **Play-time grant.** A Master Strike before the play → Spring the Trap gains +1
     Attack on play; Grief gains +2 Recruit. An Ambush villain before the play →
     Spring the Trap gains +1 Attack.
  6. **No event.** Only a Bystander was revealed → no grant on play; a deferred grant
     is recorded. At the turn boundary it is dropped with no grant.
  7. **Mid-turn.** Spring the Trap is played first, then a Master Strike is played
     through `playTopVillainDeckCards`. The deferred grant fires **once** on the next
     resolution. A second Master Strike the same turn does not grant again.
     Two Spring the Trap copies played before the strike → +2 total, one grant per
     copy.
  8. **Grief and Ambush.** An Ambush-only turn gives Grief no grant.
- **`deferredConditionalGrants.test.ts` (modified, certain).** Its keyset
  `deepEqual` (~L70) and the `TRUTHY_FIXTURE` entries (~L104–116) must join both new
  types, or the drift pin fails. This is a value-only extension, never a loosened
  assertion.
- `heroConditions.evaluate.test.ts` and `rules/heroAbility.setup.test.ts` are
  modified **only if** a pin enumerates the extended set. Pre-flight found none:
  the disjointness pin at ~L1495 stays green.

---

## Out of Scope

- **No other conditional-over-grant family.** The "If this is the first card you
  played this turn" cards (amwp, dkcy) and "If this is the eighth card you played
  this turn" (vill) have the same Step 2b free-grant symptom. They are a **separate
  follow-up** (a different predicate: card-play ordinal).
- No reactive "When a Master Strike is played … you may discard this card" (antm/dkcy).
- No distinction between a Master Strike that is "played" and one that is
  "completed" (Grief). The flag is set when the strike card reaches the strike pile.
  A strike that parks a choice (for example Magneto's discard-to-limit, D-24284)
  freezes the board (block-all) until it resolves, so play is equivalent.
- **Rage** (`msis/wanda-vision/rage`, the other face of Grief: "If a Hero was put
  into the KO pile this turn…") has the same free-grant defect under a different
  predicate (Hero KO'd this turn). It is a separate follow-up.
- Scheme or mastermind text that says "Master Strike effect" without a Master Strike
  card being played does **not** set the flag.
- No UIState field, no client change, no bot-valuation change, no new move.
- **Fixed by WP-744 / D-24567:** a sim Spring the Trap played before a same-turn
  Master Strike now grants when the strike arrives, as live does.
- Refactors not listed in Scope (In).

---

## Files Expected to Change

- `packages/game-engine/src/types.ts` — **modified** — two optional lazy flags
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — gated writes
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — constants, 2 evaluate + 2 describe cases, `matchReadsConditionType`
- `packages/game-engine/src/hero/deferredConditionalGrants.ts` — **modified** — `WAIT_AND_SEE_CONDITION_TYPES` + doctrine sentence
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — two marker arms
- `packages/game-engine/src/game.ts` — **modified** — guarded `onBegin` deletes
- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — the same guarded deletes (rebuilt-loop parity)
- `packages/game-engine/src/hero/masterStrikeOrAmbushCondition.test.ts` — **new**
- `packages/game-engine/src/hero/deferredConditionalGrants.test.ts` — **modified** — keyset + truthy-fixture drift-pin extension
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts`, `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified only if** an existing runtime pin enumerates the extended set
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — two apply entries
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — token allowlist
- `scripts/hero-mechanic-ledger.mjs` — **modified** — marker→condition map
- `data/cards/vnom.json`, `data/cards/msis.json` — **modified** — regenerated marker lines
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`,
  `scripts/coverage/hero-effect-coverage.baseline.json` — **modified** — regenerated
  (the new marker tokens)
- **Conditional (only if the named `:check` reports drift):**
  - `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`
  - `docs/ai/coverage/runtime-observed-hollows.json`, with its paired
    `apps/dashboard/src/composables/useInPlayCoverage.test.ts` `totalObs` re-pin

No other files may be modified in the `EC-780:` commit. The governance close
`SPEC:` commit edits STATUS, DECISIONS (D-24566 Active), WORK_INDEX, EC_INDEX and
the mindmap.

---

## Contract

- **`LegendaryGameState.masterStrikePlayedThisTurn?`** — `true` from the moment a
  Master Strike card is played (any `performVillainReveal` of a `mastermind-strike`)
  until the next turn begins. It is only ever present when a hook in the match reads
  it.
- **`LegendaryGameState.ambushVillainPlayedThisTurn?`** — the same lifecycle, for a
  villain or henchman card with an Ambush ability entering the City from the Villain
  Deck.
- **Condition `masterStrikePlayedThisTurn`** (Grief) and **condition
  `masterStrikeOrAmbushPlayedThisTurn`** (Spring the Trap) are both whole-turn
  wait-and-see members, one-shot per play.
- **Markers:**
  - `[keyword:master-strike-this-turn]` → the `masterStrikePlayedThisTurn` condition
  - `[keyword:master-strike-or-ambush-this-turn]` → the `masterStrikeOrAmbushPlayedThisTurn` condition
  - Both are single-segment, with no magnitude.
- **`matchReadsConditionType(G, conditionType)`** is a pure read over
  `G.heroAbilityHooks`.
- **Hash oracles.** The sentinel `finalStateHash` and `PRE_WP080_HASH` are unchanged.

---

## Vision Alignment

- **Vision clauses touched:**
  - §1 (rules authenticity: the condition is enforced as printed)
  - §2 (content authenticity: card semantics)
  - §3 (no hidden modifiers: an unearned bonus is removed)
  - §8, §22, §26 (deterministic engine; PAR and sim feeds regenerate through their
    sanctioned commands)
  - NG-1 (untouched)
- **Conflict assertion:** No conflict. The change removes an unearned bonus.
- **Non-Goal proximity:** NG-1..8 are not crossed.
- **Determinism:** the new state is deterministic, written only at a deterministic
  reveal and cleared at the turn boundary. The hash oracles are unchanged by
  construction (gated lazy fields).
  - Matches with these two cards legitimately change outcome, because the bonus was
    wrong.
  - Any committed sim feed that sweeps them is regenerated through its sanctioned
    command (Scope H).
- **Upgrade / replay story.** No migration: no persisted shape changes, and the two
  fields are lazy and optional. Replaying a historical vnom/msis match on the new
  engine applies the corrected grants (the D-24467 posture).

## Funding Surface Gate

N/A — no funding affordance, channel, or donate/support copy (engine + card-data only; no UI or copy changes).

## API Catalog

N/A (§21). No `apps/server` endpoint or `Library-only` server function changes.
Engine-only.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] Spring the Trap in a turn with no Master Strike and no Ambush Villain grants
  **no** Attack (the bot-game turn-13/19 shape).
- [ ] Spring the Trap after a Master Strike **or** an Ambush Villain this turn grants
  +1 Attack on play.
- [ ] Grief after a Master Strike this turn grants +2 Recruit; after only an Ambush
  Villain, **no** Recruit.
- [ ] Spring the Trap played **before** a mid-turn Master Strike grants +1 exactly
  once, when the strike lands. A second strike the same turn adds nothing.
- [ ] Neither flag key exists on `G` in a match with no reading hook. The sentinel
  `finalStateHash` and `PRE_WP080_HASH` are byte-unchanged (no re-pin).
- [ ] Both flags are cleared at the next turn's `onBegin`.
- [ ] Both markers parse to their conditions with no `unresolvedMarkers` entry.
  `cards:check` reproduces the committed `vnom.json` / `msis.json`.
- [ ] `pnpm -r build` exits 0. The engine suite is green at baseline plus the new
  cases, with counts in the commit body. Every Coverage & Ledger `:check` exits 0.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/game-engine test
# Expected: exit 0; masterStrikeOrAmbushCondition.test.ts passes; no sentinel/PRE_WP080 failure

node scripts/convert-cards/apply-hero-ability-markers.mjs
git diff --stat data/cards
# Expected (first run): 2 files changed, 2 insertions(+), 2 deletions(-); a re-run is zero-diff

pnpm cards:check; pnpm ledger:heroes:check; pnpm effect-index:check; pnpm mechanics:metadata:check
pnpm sim:coverage --check; pnpm sim:runtime-observed:check
# Expected: all exit 0 (after any sanctioned regen in Scope H)

Select-String -Path "packages\game-engine\src\villainDeck\villainDeck.reveal.ts" -Pattern "PlayedThisTurn = true"
# Expected: exactly two matches (the two gated writes)

git diff --name-only
# Expected (implementation commit): within ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **Live verification (D-24026), on play.legendary-arena.com:** play a match with
  Venom Rocket and read the log.
  - A Spring the Trap play in a turn without a Master Strike or Ambush shows **no**
    "+1 attack from Spring the Trap".
  - A play in a turn with one shows it.
  - For the fastest check, use a bot-ally or autoplay match with Venom Rocket in the
    hero pool.
- [ ] `docs/ai/STATUS.md` updated, with the live observation.
- [ ] All acceptance criteria pass.
- [ ] No files outside `## Files Expected to Change` are modified in the `EC-780:`
  commit.
- [ ] `docs/ai/DECISIONS.md`: D-24566 landed Active.
- [ ] `WORK_INDEX.md` WP-743 is `[x]`, and `EC_INDEX.md` EC-780 is Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then
  `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

---

## Reserved Decision (lands at execution)

- **D-24566 (reserved; Drafted 2026-09-22): "a Master Strike (or Ambush Villain)
  played this turn" is a whole-turn wait-and-see gate, backed by gated lazy
  per-turn flags written at the single reveal chokepoint.**
  - Two conditions:
    - `masterStrikePlayedThisTurn` (Grief)
    - `masterStrikeOrAmbushPlayedThisTurn` (Spring the Trap)
  - Two markers, `[keyword:master-strike-this-turn]` and
    `[keyword:master-strike-or-ambush-this-turn]`.
  - Both conditions join `WAIT_AND_SEE_CONDITION_TYPES` as shape #1 (one-shot),
    because the predicate is sticky for the turn (a count ≥ 1 threshold). This
    extends D-24377's numeric-threshold boundary to sticky event predicates, and
    keeps `[hc:X]` class gates on-play.
  - Two lazy `G` flags are written only in `performVillainReveal`, only when a hero
    hook in the match reads them, and deleted in the turn `onBegin`. Games without
    these cards are byte-unchanged.
  - "Ambush Villain" means a villain or henchman card for which `hasAmbush` is true,
    entering the City from the Villain Deck.

---

## Lint Gate Self-Review (00.3)

Both rounds were run by an independent reviewer.

**Round 1: FAIL on 2 items, both fixed in this revision.**

| Item | Problem | Fix |
|---|---|---|
| §4 | Card-data markup edits did not cite 00.2 | Context cites 00.2 §5 / §5.1 for the new tokens |
| §17 | §3 was glossed as rules fidelity, and the determinism/PAR clauses were missing | Clauses now §1, §2, §3, §8/§22/§26, NG-1 |

Round 1 also suggested two optional tightenings, both applied:
- §13: the `git diff --stat` expectation is now exact.
- §20: the Funding N/A names the engine + card-data scope.

**Round 2: all sections PASS or N/A.** §10, §11 and §19 are N/A. §21 is N/A,
justified: engine-only, no `apps/server` surface.

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-22)**, conditional on PS-1. It is applied.

- **PS-1:** the three rebuilt turn loops (`simulation.runner.ts`, `par.aggregator.ts`,
  `runFixture.ts`) skip `game.ts` `onBegin` and mirror it through
  `applyOnBeginParity`. The flag deletes are added there too (Scope F), with a
  parity test (case 4).
- **RS-1..RS-3 applied:**
  - `deferredConditionalGrants.test.ts` is a certain edit.
  - The `playVillainTop.resolve.ts` caller is listed.
  - The write placements are locked.
- **Verified in code:**
  - the single `performVillainReveal` chokepoint, the only `strikePile` write and
    the only `onMastermindStrikeRevealed` site
  - `hasAmbush` covers henchmen
  - `abilityIndex 0` is correct for both cards
  - no other marker/condition lockstep site
  - the sentinel fixture and `PRE_WP080_HASH` contain neither card
- **Pre-existing gap, recorded Out of Scope:** the rebuilt loops never resolve or
  clear deferred grants.

## Copilot Check (01.7)

**Round 1: RISK / HOLD** on modes #11, #12, #15, #26 and #28. The nine fixes (a–i):
- **(a)** the reset test invokes the real `turn.onBegin`
- **(b)** a per-flag gate test
- **(c)** an Ambush on-play case and a two-copies case
- **(d)** no grep literal in comments
- **(e)** Rage named Out of Scope
- **(f)** three derived artifacts moved to "certain"
- **(g)** the `onBeginParity` JSDoc
- **(h)** the Grief "completed" reasoning corrected
- **(i)** the upgrade/replay story

**Round 2: PASS on all 30 modes.** It was re-confirmed PASS after the lint-round
citation edits.

---

## See Also

- WP-656 / D-24467 — Diamond Form (event-gate wait-and-see; gated lazy `G` flag)
- WP-568 / D-24377 — the wait-and-see window
- WP-542 / D-24351 — villain-deck play loop
- Live evidence: `C:\pcloud\matches\Core\RedSkull\red-skull-midtown-LOG-2p-bot-venom.txt` 13.2.6, 19.2.2
