# WP-396 — `bystanderLost` Has No Producer (Game Engine / Scoring)

**User-Visible Surface:** play.legendary-arena.com, legends.legendary-arena.com

**Status:** Draft — pending execution
**Layer:** Game Engine (scoring + villain deck)

## Goal

`bystanderLost` is the penalty the scoring model ranks highest, and it
cannot fire. `deriveScoringInputs` hardcodes it to `0`:

```ts
// why: no engine producer today; follow-up WP will introduce bystander-
// lost tracking (either via ENDGAME_CONDITIONS.BYSTANDERS_LOST counter
// or via a structured event log). D-4801 safe-skip.
const bystanderLostCount = 0;
```

This WP is that follow-up. It gives `bystanderLost` a real producer so a
match is scored on civilian casualties.

## Why this is not cosmetic

`validateScoringConfig` **hard-fails** any scenario config that does not
satisfy three structural invariants:

1. `bystanderReward > villainEscaped`
2. `bystanderLost > villainEscaped`
3. `bystanderLost > bystanderReward`

So every config that will ever ship is required to weight `bystanderLost`
above both a villain escape and the credit for a rescue. That encodes the
VISION §21 moral hierarchy in code — and then the term multiplies by a
constant zero. The engine currently cannot express the thing the scoring
model is built around.

## Two separate defects

### 1. Nothing counts it

There is no `BYSTANDERS_LOST` counter. `ENDGAME_CONDITIONS` has three
members (`ESCAPED_VILLAINS`, `SCHEME_LOSS`, `MASTERMIND_DEFEATED`) and none
tracks bystander loss.

**The count is already computed at the one site that matters.**
`villainDeck.reveal.ts:242–250` measures the delta across the escape branch:

```ts
const bystanderPileBefore = G.piles.bystanders.length;
const escapeBystanderResult = resolveEscapedBystanders(...);
G.piles.bystanders = escapeBystanderResult.bystandersPile;
if (escapeBystanderResult.bystandersPile.length > bystanderPileBefore) {
  pushLog(G, `Bystanders from escaped villain ... returned to supply.`);
}
```

That delta is the number wanted. It is computed, used for a log line, and
discarded.

### 2. The state semantics say "returned", not "lost"

`resolveEscapedBystanders` puts the escaped villain's bystanders **back into
the supply pile**:

```
// why: escaped villains release bystanders to prevent memory leaks and
// supply depletion. Returned to end of pile to maintain deterministic
// ordering.
```

So today a bystander carried off by an escaping villain is recycled, not
lost. Counting the delta as `bystanderLost` while the same bystanders
re-enter the supply would make the penalty and the board state disagree.

**The rulebook is explicit, and the engine diverges from it.**
`docs/legendary-universal-rules-v23.md:565–569`, on an escaping or
overrunning Villain with captured Bystanders:

> Put the captured/rescued Bystanders in the Escaped Villains/Overrun pile.

Reinforced at `:1544–1548` for Hidden Witnesses, which "stay in the Escape
Pile as normal, face-up Bystanders." They do not return to supply. The same
passage also specifies a consequence the engine does not implement: **each
player discards a card** as a penalty for failing to rescue them (once, no
matter how many were carried away).

So returning bystanders to supply is a **rules divergence**, not an MVP
simplification — and the stated rationale (memory leaks, supply depletion)
is an implementation concern being solved at the cost of rules fidelity.
That reframes this WP: it is not only "add a counter", it is "make the
escape branch resolve correctly, and then count what it produces."

Confirm with the rules owner before implementing — the rulebook is quoted
here, not paraphrased, but scheme-specific overrides may exist.

## Why this should land before PAR calibration publishes

This is the argument for doing it now rather than later.

`computeParScore` builds the PAR side with `bystanderLost: 0` explicitly:

```ts
penaltyEventCounts: {
  villainEscaped: config.parBaseline.escapesPar,
  bystanderLost: 0,
  ...
}
```

`ParBaseline` has `roundsPar` / `bystandersPar` / `victoryPointsPar` /
`escapesPar` — **no bystanders-lost field.** So PAR structurally assumes
zero casualties.

If PAR baselines are calibrated and published while the producer is inert,
and the producer lands afterward:

- Raw Score gains a term that PAR has no counterpart for
- every score shifts worse against an unchanged baseline, by an amount
  proportional to how bloody the run was
- fixing it means either a new `scoringConfigVersion` (which by VISION §22
  breaks comparability with every historical entry) or re-calibrating
  baselines that VISION §22 declares immutable

PAR is unpublished today and `legendary.competitive_scores` is empty, so
there is no historical record to damage **yet**. That window closes when
calibration publishes.

## Open design questions (resolve before execution)

1. **Where do escaped bystanders go, and does the discard penalty land?**
   The rulebook says the Escaped Villains/Overrun pile, and says each player
   discards one card. The engine returns them to supply and imposes no
   discard. Fixing the destination needs a pile (or a reuse of the escaped
   pile) and a different answer to the depletion concern; the discard is a
   separate rules effect that may warrant its own WP. Rules-owner call on
   whether both land here.
2. **Counter or structured event log?** D-4801 rejected an event-log
   dependency for scoring derivation and locked "read G state directly". A
   `BYSTANDERS_LOST` counter in `G.counters` follows the existing
   `ESCAPED_VILLAINS` precedent and the `?? 0` lazy-init pattern. An event
   log would reopen D-4801.
3. **Does `ParBaseline` gain a `bystandersLostPar` field?** If yes it is a
   breaking change to a persisted, version-pinned type — needs a
   `scoringConfigVersion` bump and a migration story. If no, PAR keeps
   assuming zero and every real casualty scores strictly worse than
   baseline, which may be the intended moral statement rather than a bug.
4. **Are there non-escape loss paths?** Scheme twists that KO bystanders,
   mastermind tactics that capture them, `[rule:Adapt]` council effects.
   The escape branch is the obvious producer; it may not be the only one.
   An audit is in scope, implementing every path is not.
5. **What about the other three inert penalties?** `schemeTwistNegative`,
   `mastermindTacticUntaken`, and `scenarioSpecificPenalty` are also
   hardcoded to `0`. The PAR-window argument above applies to all four.
   Deliberately out of scope here — see below.

## Scope (In)

- A producer for `bystanderLost`, following the `ESCAPED_VILLAINS` counter
  precedent unless question 2 resolves otherwise.
- Correcting `resolveEscapedBystanders` so escaped bystanders stop returning
  to supply, per the rulebook passage quoted above and question 1.
- `deriveScoringInputs` reads the real count; the safe-skip comment and its
  `const bystanderLostCount = 0` are removed.
- Test coverage: a match that loses bystanders produces a non-zero
  `penaltyEventCounts.bystanderLost` and a strictly worse `rawScore` than
  the same match without the loss.
- Audit of non-escape loss paths (question 4) — findings recorded, not
  necessarily implemented.
- Update `wiki/scoring.md` §"Penalty producer status", which currently
  documents this penalty as having no producer.

## Out of Scope

- **The other three inert penalty types.** Same root cause, different
  producers, and each has its own design question. They deserve their own
  WPs. If PAR calibration is imminent, sequencing all four ahead of it
  matters more than bundling them.
- PAR re-calibration itself (WP-049 territory).
- Any `scoringConfigVersion` bump — that is a governance decision, not an
  implementation one, and belongs with whoever owns question 3.
- Retro-fixing published scores. None exist; PAR is unpublished and
  `legendary.competitive_scores` is empty.

## Dependencies

- **Question 1 blocks execution.** It is a rules-correctness call with a
  data-model consequence; implementing either branch first risks rework.
- No code dependency on WP-389 / WP-390 — different subsystem. But note
  WP-390 leaves four masterminds inert, including both `shld` ones, so
  `shld` gauntlets cannot currently exercise mastermind-driven bystander
  capture end-to-end.

## Notes

Found 2026-07-18 while correcting `wiki/scoring.md`, which described
`bystanderLost` as "counted from bystander-resolution paths". It is not
counted from anything. The same claim had already propagated into a
published gauntlet guide on `www.legendary-arena.com`, which told readers a
run that "bleeds civilians can score worse than a slower, cleaner one" —
false against the current engine. The docs are corrected
(`legendary-arena-website#76`, this repo's #822/#829); the engine gap is
this WP.

Documentation now describes the model honestly. That is not the same as the
model working.
