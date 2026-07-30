---
title: Master Strike
type: Mechanic
tags:
  - layer-engine
  - mastermind
  - villain-deck
  - trigger
  - phase-play
  - stage-start
related:
  - villain-deck.md
  - scheme-twist.md
  - scheme.md
  - rule-execution-pipeline.md
  - card-effect-system.md
  - turn-system.md
  - cardextid.md
  - card-type-taxonomy.md
  - board-keywords.md
  - scoring.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\master-strike.md (this page — https://ewiki.legendary-arena.com/master-strike/)
  - ../.claude/skills/legendary-game-engine/SKILL.md
  - ../packages/game-engine/src/rules/mastermindHandlers.ts
  - ../packages/game-engine/src/villainDeck/villainDeck.reveal.ts
  - ../packages/game-engine/src/mastermind/mastermind.types.ts
  - ../packages/game-engine/src/mastermind/mastermind.logic.ts
  - ../packages/game-engine/src/board/ko.logic.ts
  - ../data/cards/co2e.json
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/ai/work-packets/WP-014A-villain-reveal-pipeline.md
  - ../docs/ai/work-packets/WP-019-mastermind-tactics-boss-fight-minimal-mvp.md
  - ../docs/ai/DECISIONS.md
  - ../docs/10-GLOSSARY.md
last-reviewed: 2026-07-18
---

# Master Strike

## Summary

Master Strike is the mechanic fired when a `mastermind-strike` card is
revealed from the villain deck. The trigger fires at stage `start` as
part of the reveal pipeline. Every fire increments a counter, captures a
bystander onto the Mastermind, and queues a deterministic log entry;
the mastermind's *printed* strike text is then resolved by a
per-mastermind branch, which currently exists for Magneto and Red
Skull only.

## Mechanics

### Trigger emission

`onMastermindStrikeRevealed` is one of two type-specific triggers
emitted by `revealVillainCard` (see [Villain Deck](villain-deck.md)).
It fires when the drawn card's classification in
`G.villainDeckCardTypes` is `'mastermind-strike'`. The trigger payload
is `{ cardId }`. Effects are collected alongside the always-emitted
`onCardRevealed` trigger and applied together via the
[Rule Execution Pipeline](rule-execution-pipeline.md).

### Default handler behaviour

`mastermindStrikeHandler` in
[`rules/mastermindHandlers.ts`](../packages/game-engine/src/rules/mastermindHandlers.ts)
is the registered `ImplementationMap` entry for the trigger. It still
returns the two generic `RuleEffect` entries on every fire:

```ts
{ type: 'modifyCounter', counter: 'masterStrikeCount', delta: 1 }
{ type: 'queueMessage',  message: 'Mastermind strike revealed — strike count incremented.' }
```

**It is no longer effect-only or per-mastermind agnostic.** The MVP
description ("does not read or mutate `G`… per-mastermind agnostic") has
been superseded. A fire now does three things in order:

1. **Generic bystander capture (D-15401)** — `captureBystanderOntoMastermind`
   moves one bystander from `G.piles.bystanders` onto
   `G.mastermind.attachedBystanders`, **mutating `G` directly**. An empty
   supply logs a message and captures nothing.
2. **Per-mastermind text effect** — the handler branches on
   `G.selection.mastermindId` and, for the masterminds whose printed strike
   text is implemented, calls a resolver that also mutates `G` directly:

   | Mastermind | Resolver | Printed effect |
   |---|---|---|
   | `core/magneto` | `resolveMagnetoStrike` | each player discards down to `MAGNETO_HAND_SIZE_LIMIT` (4) |
   | Red Skull (see below) | `resolveRedSkullStrike` | each player KOs a Hero from hand (D-24188) |

   Every other mastermind takes no branch — the strike is generic
   counter-plus-capture only, and its printed text is **not** applied.
3. **Terminal emission (WP-200)** — `mastermindStrikeResolved`, after both
   the capture and the text effect, with the payload's `cardId` narrowed
   defensively (a malformed payload yields an empty `strikeCardId` rather
   than throwing — moves never throw).

Three details worth knowing when adding the next mastermind:

- **An "or" clause resolves to its punitive branch.** Magneto's printed text
  is *"reveals an X-Men Hero **or** discards down to four cards."* The engine
  has no reveal-and-choose mechanic and `G.cardKeywords` carries no team
  affiliation, so the resolver unconditionally takes the discard branch. The
  same shape will recur — decide the branch deliberately and say so in a
  `// why:`.
- **The branch key is `G.selection.mastermindId`, not `cardId`.** The
  original "does not branch on `cardId`" is still literally true and now
  misleading — dispatch is by *selected mastermind*, not by the revealed
  strike card.
- **Red Skull matches a list, not a single id.** `MASTERMINDS_RED_SKULL`
  covers every set whose base face prints the same strike text
  (`core/red-skull` and `co2e/red-skull`). Epic faces with *different* text
  — co2e's `epic-red-skull` — are excluded from the list.
- **⚠️ Which face is actually played is currently wrong (D-24193).** An
  earlier revision of this page claimed Epic faces "are not
  engine-selectable." **That is false.** `findMastermindCards` (the internal
  helper behind `buildMastermindState`) assigns `baseCard` on *every*
  non-tactic face with no early exit, so the **last** one wins — the
  alternate face, for **65 masterminds across 24 sets** (56 Epic variants, 9
  transformation faces). Strike
  *dispatch* is unaffected (it keys on `G.selection.mastermindId`, not the
  card id), so a co2e Red Skull strike still fires
  `resolveRedSkullStrike` — but the card on the board is *Epic Red Skull*,
  whose printed text differs. **WP-389 / D-24193** fixes the classifier to
  select the first non-tactic face; until it lands, treat every "the base
  face is played" statement here as aspirational. The same wrong premise is
  baked into the WP-386 `// why:` comment in the source.

`resolveRedSkullStrike` is the current precedent for adding another:
mutate `G` directly, resolve deterministically (D-24188 picks the lowest
eligible cost, ties broken by lowest hand index — no RNG), and write one
durable log line.

### Mastermind state context

`G.mastermind` is built at setup with the chosen mastermind's tactics
deck and base card id (`MastermindState` in
[`mastermind.types.ts`](../packages/game-engine/src/mastermind/mastermind.types.ts)).
Master Strike resolution **does not consume tactics** — tactic defeat
is a combat path through `defeatTopTactic` in
[`mastermind.logic.ts`](../packages/game-engine/src/mastermind/mastermind.logic.ts),
fired during a successful fight against the mastermind. The strike
trigger and the combat-side tactic defeat are separate mechanics that
share the same Mastermind entity.

## Interactions

- **Villain Deck.** `mastermind-strike` is one of five
  `RevealedCardType` values. The reveal pipeline routes the strike
  card to `G.villainDeck.discard` after triggers fire. The trigger
  emission step is documented in [Villain Deck](villain-deck.md) as
  Step 5 of `revealVillainCard`.
- **[Scheme Twist](scheme-twist.md).** Sibling type-specific
  trigger, fired by the same reveal step. Both write a string-literal
  observability counter; only Scheme Twist additionally writes an
  `ENDGAME_CONDITIONS` counter (`SCHEME_LOSS`). Master Strike's
  `masterStrikeCount` does not feed `evaluateEndgame`.
- **Mastermind state.** The strike handler writes
  `G.mastermind.attachedBystanders` (D-15401 capture) and never touches
  `G.mastermind.tacticsDeck` / `tacticsDefeated`, which are read at
  setup and during combat resolution.
- **Combat (defeat tactic).** The combat-side path —
  `defeatTopTactic` — is unrelated to the strike trigger. It runs
  when a player successfully fights the Mastermind, drawing the top
  tactic from `tacticsDeck` and appending it to `tacticsDefeated`.
- **Endgame.** The strike handler writes to
  `G.counters.masterStrikeCount`. This key is **not** in
  `ENDGAME_CONDITIONS` and is not consumed by `evaluateEndgame`.
  Victory still resolves through
  `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED`, which becomes truthy
  when `areAllTacticsDefeated` returns true.

## Edge Cases

- **Slug must be hyphenated.** The classification value is
  `'mastermind-strike'` (hyphen). An underscore variant silently
  fails to match the union and prevents the trigger from firing.
  Drift-detection tests against `REVEALED_CARD_TYPES` exist to catch
  this. See
  [`game-engine.md` "RevealedCardType Conventions"](../.claude/skills/legendary-game-engine/SKILL.md).
- **Most printed strike text still does not fire.** Only Magneto and
  Red Skull have resolvers. For every other mastermind a Strike is
  counter-plus-bystander-capture plus a log line — no wound, discard,
  or KO derived from its own "Master Strike:" ability. co2e is the
  scale of the gap: its five masterminds carry **ten** authored strike
  texts (base + Epic), of which exactly one — the base Red Skull face —
  is engine-resolved. The rest is data.
- **Implemented strikes bypass the `RuleEffect` union.** The closed
  `RuleEffectType` union (`queueMessage` / `modifyCounter` /
  `drawCards` / `discardHand`) has no per-player `gainWound`, KO, or
  reveal-and-choose effect, so `resolveMagnetoStrike` and
  `resolveRedSkullStrike` mutate `G` directly instead of returning
  effects. Adding a mastermind therefore does **not** require extending
  the union — but it does mean the strike's real work is invisible to
  anything that only inspects the returned effect list.
- **A strike does not touch tactics.** Despite the tabletop
  association, the strike handler never reads or writes
  `G.mastermind.tacticsDeck` / `tacticsDefeated`. Tactic resolution is
  the combat path (`defeatTopTactic`), a separate mechanic.
- **Pipeline ordering inside one reveal.** The strike trigger fires
  *after* `onCardRevealed` in the same `revealVillainCard` call.
  Effects from both are collected first, then applied together —
  there is no "strike-before-card-revealed" intermediate state.
- **Strike card destination.** The strike card moves to
  `G.villainDeck.discard` after triggers resolve. It does not enter
  the City, and no bystander attaches *to the strike card* — the
  D-15401 capture attaches to the **Mastermind**
  (`G.mastermind.attachedBystanders`), not to the revealed card.
- **Counter key is a string literal.** `'masterStrikeCount'` is
  written directly by the handler and is not exported as a constant
  in `ENDGAME_CONDITIONS`. Any code that wants to read this counter
  must use the literal key.

## Code Touchpoints

- [`packages/game-engine/src/rules/mastermindHandlers.ts`](../packages/game-engine/src/rules/mastermindHandlers.ts)
  — `mastermindStrikeHandler` (dispatcher), `captureBystanderOntoMastermind`,
  `resolveMagnetoStrike`, `resolveRedSkullStrike`, `selectRedSkullKoTarget`
- [`packages/game-engine/src/rules/mastermindHandlers.test.ts`](../packages/game-engine/src/rules/mastermindHandlers.test.ts)
  — handler tests
- [`packages/game-engine/src/villainDeck/villainDeck.reveal.ts`](../packages/game-engine/src/villainDeck/villainDeck.reveal.ts)
  — strike trigger emission point (Step 5)
- [`packages/game-engine/src/mastermind/mastermind.types.ts`](../packages/game-engine/src/mastermind/mastermind.types.ts)
  — `MastermindState` interface
- [`packages/game-engine/src/mastermind/mastermind.logic.ts`](../packages/game-engine/src/mastermind/mastermind.logic.ts)
  — `defeatTopTactic`, `areAllTacticsDefeated` (combat path; unrelated
  to the strike trigger but shares the Mastermind entity)

## History

- WP-014A: `onMastermindStrikeRevealed` trigger introduced; emitted from the villain-deck reveal pipeline on `mastermind-strike` classification
- WP-019: `MastermindState` added to `G`; tactics deck and combat-side tactic defeat introduced (separate path from the strike trigger)
- WP-200: terminal `mastermindStrikeResolved` emission added, with defensive `cardId` narrowing
- D-15401: generic bystander capture onto the Mastermind on every strike — the handler begins mutating `G`
- Magneto: first per-mastermind branch (`resolveMagnetoStrike`), taking the punitive discard-to-four branch of the printed "or" clause
- WP-386 / D-24188: `resolveRedSkullStrike` — each player KOs a Hero from hand, auto-picked deterministically (lowest cost, tie → lowest hand index). Establishes the pattern for subsequent masterminds and the `MASTERMINDS_RED_SKULL` multi-set id list
- co2e data pass (2026-07-17): ten authored Master Strike texts added as card data; only the base Red Skull face is engine-resolved
- D-24193 (2026-07-18): the mastermind face classifier is found to select the LAST non-tactic face, so Epic faces are what 65 masterminds across 24 sets actually play; WP-389 corrects it to first-wins. Supersedes this page's earlier "Epic faces are not engine-selectable" claim

## References

- [`.claude/skills/legendary-game-engine/SKILL.md`](../.claude/skills/legendary-game-engine/SKILL.md)
  — Villain Deck & Reveal Pipeline (strike trigger emission contract);
  `G.counters` keys (`MASTERMIND_DEFEATED` victory counter, distinct
  from strike count)
- [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) — WP-014 / WP-019
  review notes
- [`docs/10-GLOSSARY.md`](../docs/10-GLOSSARY.md) — `RuleTriggerName`
  (5-trigger union), `RuleEffectType` (4-effect union),
  `RevealedCardType` (5-classification union),
  `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED`
- [`docs/legendary-universal-rules-v23.md`](../docs/legendary-universal-rules-v23.md)
  — tabletop semantics for Mastermind Strike cards and per-tactic
  resolution
- [WP-014A](../docs/ai/work-packets/WP-014A-villain-reveal-pipeline.md),
  [WP-019](../docs/ai/work-packets/WP-019-mastermind-tactics-boss-fight-minimal-mvp.md)
