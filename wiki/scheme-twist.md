---
title: Scheme Twist
type: Mechanic
tags:
  - layer-engine
  - scheme
  - villain-deck
  - trigger
  - endgame
  - loss-condition
  - phase-play
  - stage-start
related:
  - villain-deck.md
  - master-strike.md
  - scheme.md
  - rule-execution-pipeline.md
  - turn-system.md
  - cardextid.md
  - card-type-taxonomy.md
  - board-keywords.md
  - scoring.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\scheme-twist.md (this page — https://ewiki.legendary-arena.com/scheme-twist/)
  - ../.claude/skills/legendary-game-engine/SKILL.md
  - ../packages/game-engine/src/rules/schemeHandlers.ts
  - ../packages/game-engine/src/rules/schemeTwistConfigs.ts
  - ../packages/game-engine/src/rules/schemeTwistConfig.types.ts
  - ../packages/game-engine/src/rules/schemeTwistResolvers.ts
  - ../packages/game-engine/src/villainDeck/villainDeck.reveal.ts
  - ../packages/game-engine/src/scheme/schemeSetup.types.ts
  - ../packages/game-engine/src/endgame/endgame.types.ts
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/ai/DECISIONS.md
  - ../docs/ai/work-packets/WP-009B-rule-execution-minimal-mvp.md
  - ../docs/ai/work-packets/WP-014A-villain-reveal-pipeline.md
  - ../docs/ai/work-packets/WP-024-scheme-mastermind-ability-execution.md
  - ../docs/10-GLOSSARY.md
last-reviewed: 2026-08-07
---

# Scheme Twist

## Summary

Scheme Twist is the mechanic fired when a `scheme-twist` card is
revealed from the villain deck. Unlike its sibling
[Master Strike](master-strike.md), it drives scheme-side behaviour:
every twist increments a counter and dispatches to the active scheme's
twist resolver, and — for a scheme whose loss is modelled as a twist
count — once the count reaches the scheme's printed twist-stack size the
handler emits the `ENDGAME_CONDITIONS.SCHEME_LOSS` counter that pushes
the match toward a `scheme-wins` outcome.

> **Important:** for six of the eight core schemes that twist-count loss
> is a *doom-clock proxy*, **not** the scheme's real printed Evil-Wins
> condition (D-24178). See *Twist-loss vs resource-loss (the doom-clock
> proxy)* below — this is the distinction that makes a Midtown Bank
> Robbery match end at the eighth twist even with an empty Escaped
> Villains pile.

## Mechanics

### Trigger emission

`onSchemeTwistRevealed` is one of two type-specific triggers emitted
by `revealVillainCard` (see [Villain Deck](villain-deck.md) Step 5).
It fires when the drawn card's classification in
`G.villainDeckCardTypes` is `'scheme-twist'`. Trigger payload is
`{ cardId }`. Effects are collected alongside the always-emitted
`onCardRevealed` trigger and applied together.

### Config-driven dispatch and default handler behaviour

`schemeTwistHandler` in
[`rules/schemeHandlers.ts`](../packages/game-engine/src/rules/schemeHandlers.ts)
is the registered `ImplementationMap` entry. Since WP-200 it is a
**config-driven dispatcher**: it looks up the active scheme in
`SCHEME_TWIST_CONFIGS`
([`rules/schemeTwistConfigs.ts`](../packages/game-engine/src/rules/schemeTwistConfigs.ts))
and, when a config is found, invokes the matching resolver from
`SCHEME_TWIST_RESOLVERS`
([`rules/schemeTwistResolvers.ts`](../packages/game-engine/src/rules/schemeTwistResolvers.ts)).
The seven resolvers (`reveal-or-punish`, `chained-reveals`, `wound-all`,
`ko-from-hq`, `midtown-bank-robbery`, `killbots`, `secret-invasion`) carry
out the scheme's printed twist text — they **mutate `G` directly** and push
a `schemeTwistResolved` event, rather than returning effects (see the
resolver note under [Rule Execution Pipeline](rule-execution-pipeline.md)).
The last two are the converted-card schemes: `killbots` raises the
per-scheme "twists next to this Scheme" counter that drives Killbot attack
(WP-513), and `secret-invasion` drags the highest-cost HQ Hero into the
Sewers as a Skrull Villain (WP-514). An unconfigured scheme runs no
card-specific text (counter-only).

After the resolver (or fallback) runs, the dispatcher appends two
generic effects unconditionally, for every scheme:

```ts
{ type: 'modifyCounter', counter: 'schemeTwistCount', delta: 1 }
{ type: 'queueMessage',  message: 'Scheme twist revealed — twist count incremented.' }
```

Then, if the predicted post-increment twist count reaches the scheme's
**loss threshold**, it appends two more effects to the same returned
array:

```ts
{ type: 'modifyCounter', counter: ENDGAME_CONDITIONS.SCHEME_LOSS, delta: 1 }
{ type: 'queueMessage',  message: 'Scheme loss triggered — twist threshold reached.' }
```

The loss threshold is resolved **per-scheme** (D-24178), in priority
order: `config.lossThresholdByPlayerCount[requiredPlayers]` (for schemes
whose printed twist stack varies by seat count — e.g. Super Hero Civil
War, 8 twists at 2–3 players, 5 at 4–5) ▸ `config.lossThreshold` (a
fixed printed twist-stack size) ▸ the constant
`MVP_SCHEME_TWIST_THRESHOLD = 7`, which is now only an **arbitrary
fallback for unconfigured schemes** — not "most schemes lose at 7."
Each configured threshold equals the scheme's printed twist-stack size,
so a scheme never resolves a twist early. Crucially, for most schemes
this write is a *proxy*, not the real loss — see the next section.

### The predict-post-effect pattern

The handler cannot read `G` after applying its own effects — handlers
run before `applyRuleEffects` mutates state (see
[Rule Execution Pipeline](rule-execution-pipeline.md) for the
two-phase contract). To check the threshold against the
*post-increment* count, it predicts the post-effect value locally:

```ts
const predictedTwistCount = (gameState.counters.schemeTwistCount ?? 0) + 1;
if (predictedTwistCount >= effectiveThreshold) { /* append loss effects */ }
```

The generic-effects builder (`buildGenericTwistEffects`) stays purely
functional — it returns effects and never mutates `G` — while still
gating the conditional loss effect on the post-increment count. (The
scheme's *resolver*, dispatched earlier in the same handler, does mutate
`G` directly; the two roles are separate.) All generic effects land
atomically in a single `applyRuleEffects` call.

### Counter inventory

Two distinct counters are involved, used differently:

| Counter | Constant? | Role |
|---|---|---|
| `'schemeTwistCount'` | string literal, not in `ENDGAME_CONDITIONS` | per-match twist tally; observability only |
| `'schemeLoss'` (via `ENDGAME_CONDITIONS.SCHEME_LOSS`) | constant | endgame counter; consumed by `evaluateEndgame` |

A value `>= 1` on `schemeLoss` is sufficient for the loss to register;
the handler increments by exactly 1 on threshold cross.

### Twist-loss vs resource-loss (the doom-clock proxy)

The twist-threshold `SCHEME_LOSS` write is the scheme's **real**
Evil-Wins condition for only **two** of the eight core schemes — the
printed *"Twist N: Evil Wins!"* schemes:

| Scheme | Printed loss twist |
|---|---|
| Portals to the Dark Dimension | Twist 7 |
| Unleash the Power of the Cosmic Cube | Twist 8 |

For the other **six** core schemes the printed Evil-Wins is a
**resource** condition. The twist count *used to be* only a **doom-clock
proxy** at the full twist-stack size (D-24178) — the engine ended the game
when the last twist was drawn *as a stand-in* for a loss condition it did
not model. **As of the resource-loss-scheme-fidelity epic (WP-508..514,
shipped 2026-08), all six are now modelled on their real conditions**, and
the twist-count proxy is *suppressed* for each (a scheme that declares a
`resourceLossCondition` no longer loses on twist count).

| Scheme | Printed Evil-Wins (real) | Modelled today |
|---|---|---|
| Midtown Bank Robbery | 8 Bystanders carried away by escaping Villains | ✅ `escaped-pile-count` / bystander / 8 (WP-508) |
| Negative Zone Prison Breakout | 12 Villains escape | ✅ `escaped-pile-count` / villain / 12 (WP-509) |
| Super Hero Civil War | Hero Deck runs out | ✅ `pile-depleted` / heroDeck (WP-510); "4 Heroes at 2p" deck sizing drafted (WP-515) |
| The Legacy Virus | Wound stack runs out | ✅ `pile-depleted` / wounds; stack sized 6×players (WP-511) |
| Replace Earth's Leaders with Killbots | 5 "Killbots" escape | ✅ `escaped-converted-count` / killbot / 5 (WP-513) |
| Secret Invasion of the Skrull Shapeshifters | 6 Heroes reach the Escaped Villains pile | ✅ `escaped-converted-count` / skrull / 6 (WP-514) |

**Why the proxy was wrong (historical).** A resource-loss scheme could end
for evil even though its real condition was nowhere near met. Observed
2026-08-07: a Midtown Bank Robbery co-op ended `scheme-wins` the instant
the eighth twist was drawn, with an **empty** Escaped Villains pile and a
dominant hero board. Killbots was worse — only 5 twists sit in its villain
deck (3 more beside the Scheme), so its proxy was *unreachable* and it
could never lose on twist count at all. Both are the motivation for the
epic below.

**The three resource-loss kinds** (`SchemeTwistConfig.resourceLossCondition`,
a data-only discriminated union on `kind`; each writes `SCHEME_LOSS` from
its check site and suppresses the twist proxy — `evaluateEndgame` stays
counter-only):

- **`escaped-pile-count`** (D-24315) — counts entries of a `cardType` in
  `G.escapedPile` against a `threshold`, checked in the escape path.
  Escaping villains **carry** their captured Bystanders into `G.escapedPile`
  (D-24314, replacing the old return-to-supply). Midtown (bystander/8),
  Negative Zone (villain/12).
- **`pile-depleted`** (D-24318/D-24320) — a named pile reaching zero:
  `heroDeck` (Civil War, WP-510) or `wounds` (Legacy Virus, WP-511),
  checked in the play-phase `turn.onMove` hook (a central per-move
  chokepoint, since twist-driven refills can drain the pile outside any
  recruit). Some schemes also need **setup sizing** so the pile is small
  enough to run out — Legacy Virus builds `6×players` Wounds (D-24321);
  Civil War builds a 4-hero deck at 2 players (WP-515, drafted).
- **`escaped-converted-count`** (D-24325/D-24326) — the **converted-card**
  schemes: a card that "counts as" a villain of a named group is typed
  `'villain'` for native routing plus a `G.convertedVillainOrigins` overlay
  (`'killbot'` | `'skrull'`); the loss counts escaped entries by **origin**
  (never the shared `'villain'` type, which would include real villains).
  Killbots — its 18 villain-deck Bystanders convert, attack = a per-scheme
  "twists next to this Scheme" counter (WP-513). Secret Invasion — setup
  shuffles 12 Heroes from the Hero Deck into the Villain Deck as Skrull
  Villains (attack = the Hero's cost + 2, a documented proxy for the
  printed VP + 2, which no card data carries); defeating a Skrull **gains**
  the Hero into your discard; the `secret-invasion` twist drags the
  highest-cost HQ Hero into the Sewers as a Skrull; Evil Wins at 6 escaped
  Skrulls (WP-514). See [Villain Deck](villain-deck.md) for the
  converted-card model and the cross-deck setup shuffle.

## Interactions

- **Villain Deck.** `scheme-twist` is one of five `RevealedCardType`
  values. The reveal pipeline routes the twist card to
  `G.villainDeck.discard` after triggers fire.
- **[Master Strike](master-strike.md).** Sibling trigger fired by
  the same `revealVillainCard` step. Both write a string-literal
  counter; only Scheme Twist additionally writes an
  `ENDGAME_CONDITIONS` counter. Master Strike's `masterStrikeCount`
  is observability-only; Scheme Twist's `schemeLoss` actually drives
  endgame.
- **Endgame.** `evaluateEndgame` reads `G.counters` via
  `ENDGAME_CONDITIONS` keys; `SCHEME_LOSS >= 1` short-circuits to the
  `scheme-wins` outcome (loss conditions are evaluated before
  victory). The `MASTERMIND_DEFEATED` victory path is unrelated to
  twist counts.
- **[Scheme](scheme.md).** The scenario-level entity. Scheme Twist
  is the runtime side of scheme behaviour; the Scheme page documents
  the configuration field, setup-time mutator, and registry
  classification. The Scheme entity itself is not read at runtime —
  the threshold and counter wiring live in this handler, not in the
  scheme.
- **Scheme setup instructions.** A *separate* scheme-related
  mechanism: `SchemeSetupInstruction` (closed union of 4 types in
  [`schemeSetup.types.ts`](../packages/game-engine/src/scheme/schemeSetup.types.ts))
  applies declarative changes at setup time per D-2601 (Representation
  Before Execution). These instructions never participate in the
  twist trigger and are not consulted by `schemeTwistHandler`. See
  [Scheme](scheme.md) Layer 2 for the full setup-instruction model.
- **[Scoring](scoring.md).** Scheme-twist outcomes feed the
  `schemeTwistNegative` penalty event, one of five
  `PenaltyEventType` values consumed by `buildScoreBreakdown`.
  Scheme-loss outcomes are additionally penalised per VISION §21;
  the formula and weights live in
  [`12-SCORING-REFERENCE.md`](../docs/12-SCORING-REFERENCE.md).

## Edge Cases

- **Slug must be hyphenated.** The classification value is
  `'scheme-twist'` (hyphen). An underscore variant silently fails to
  match the union and prevents the trigger from firing.
- **Threshold is per-scheme, not a flat 7.** Since D-24178 the loss
  threshold is resolved from the scheme's `SchemeTwistConfig`
  (`lossThreshold` / `lossThresholdByPlayerCount`), set to the printed
  twist-stack size; the flat `MVP_SCHEME_TWIST_THRESHOLD = 7` is now only
  the fallback for **unconfigured** schemes. And for the six resource-loss
  schemes this twist threshold is a *doom-clock proxy*, not the printed
  Evil-Wins condition — see *Twist-loss vs resource-loss* above. Tabletop
  Marvel Legendary uses per-scheme conditions (varying twist counts, or
  entirely different conditions like Bystanders carried away, villains
  escaped, or deck depletion); faithful modelling of the resource
  conditions is the WP-508+ epic.
- **Threshold check is *predicted*, not observed.** The handler
  evaluates the threshold against `currentCount + 1`, not against a
  post-effect read of `G`. If two scheme-twist effects ever land in
  the same `applyRuleEffects` batch from a single trigger, the
  prediction would under-count by 1. In practice the reveal pipeline
  produces exactly one twist increment per reveal, so the prediction
  is correct.
- **Twist counter is not a scheme-loss counter.** `schemeTwistCount`
  is incremented every twist; `schemeLoss` is incremented at most
  once (when the threshold is crossed). They are separate counters
  with different semantics.
- **Pipeline ordering inside one reveal.** The twist trigger fires
  *after* `onCardRevealed` in the same `revealVillainCard` call.
  Effects from both triggers are collected first, then applied
  together — there is no intermediate "twist-before-card-revealed"
  state.
- **Twist card destination.** The twist card moves to
  `G.villainDeck.discard` after triggers resolve. It does not enter
  the City and never attaches a bystander.

## Code Touchpoints

- [`packages/game-engine/src/rules/schemeHandlers.ts`](../packages/game-engine/src/rules/schemeHandlers.ts)
  — `schemeTwistHandler` and `MVP_SCHEME_TWIST_THRESHOLD`
- [`packages/game-engine/src/rules/schemeHandlers.test.ts`](../packages/game-engine/src/rules/schemeHandlers.test.ts)
  — handler tests
- [`packages/game-engine/src/villainDeck/villainDeck.reveal.ts`](../packages/game-engine/src/villainDeck/villainDeck.reveal.ts)
  — twist trigger emission point (Step 5)
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `ENDGAME_CONDITIONS.SCHEME_LOSS` constant
- [`packages/game-engine/src/scheme/schemeSetup.types.ts`](../packages/game-engine/src/scheme/schemeSetup.types.ts)
  — `SchemeSetupInstruction` (separate scheme mechanism — listed for
  disambiguation, not because it participates in twist behaviour)

## History

- WP-009B: Rule pipeline and `onSchemeTwistRevealed` handler stub introduced (no real effects)
- WP-014A: Reveal pipeline added; `onSchemeTwistRevealed` actually emitted on `scheme-twist` reveals
- WP-024: WP-009B stubs replaced with real handlers; threshold + loss-counter logic landed via EC-024
- WP-200: `schemeTwistHandler` became a config-driven dispatcher (`SCHEME_TWIST_CONFIGS` + the five `SCHEME_TWIST_RESOLVERS`); resolvers mutate `G` and emit a `schemeTwistResolved` event
- D-24178: per-scheme loss threshold = printed twist-stack size (`lossThreshold` / `lossThresholdByPlayerCount`); `MVP_SCHEME_TWIST_THRESHOLD = 7` demoted to unconfigured-only fallback; records the twist-count loss as a doom-clock proxy for the six resource-loss schemes
- WP-508..514 (shipped 2026-08): resource-loss-scheme-fidelity epic — models the real Evil-Wins conditions for all six resource schemes via three `resourceLossCondition` kinds and suppresses the proxy per scheme. WP-508 `escaped-pile-count` framework + Midtown (D-24314/D-24315); WP-509 Negative Zone + retired generic `ESCAPE_LIMIT` (D-24316/D-24317); WP-510 `pile-depleted` + Civil War hero-deck (D-24318/D-24319); WP-511 Legacy Virus wounds + `6×players` setup sizing (D-24320/D-24321); WP-513 converted-card villains (`convertedVillainOrigins`) + `escaped-converted-count` + Killbots (D-24324/D-24325); WP-514 Secret Invasion cross-deck hero→Skrull conversion + defeat-to-gain + HQ→Sewers twist (D-24326/D-24327, live-verified). The `SCHEME_TWIST_RESOLVERS` registry grew to **seven** (added `killbots`, `secret-invasion`)
- WP-515 (drafted, D-24328): Super Hero Civil War "use only 4 Heroes at 2 players" hero-deck setup sizing — makes the WP-510 hero-deck-depletion loss reachable at 2p (mirrors WP-511's wound sizing)

## References

- [`.claude/skills/legendary-game-engine/SKILL.md`](../.claude/skills/legendary-game-engine/SKILL.md)
  — Villain Deck & Reveal Pipeline (twist trigger emission contract);
  `G.counters` keys (`SCHEME_LOSS` constant)
- [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) — WP-014, WP-024
  review notes; rule execution pipeline contract
- [`docs/10-GLOSSARY.md`](../docs/10-GLOSSARY.md) — `RuleTriggerName`,
  `RuleEffectType`, `RevealedCardType`, `ENDGAME_CONDITIONS`,
  `evaluateEndgame`
- [`docs/12-SCORING-REFERENCE.md`](../docs/12-SCORING-REFERENCE.md) —
  scheme-loss penalty in scoring formula
- [`docs/legendary-universal-rules-v23.md`](../docs/legendary-universal-rules-v23.md)
  — tabletop semantics for Scheme Twist cards and per-scheme loss
  conditions
- [WP-009B](../docs/ai/work-packets/WP-009B-rule-execution-minimal-mvp.md),
  [WP-014A](../docs/ai/work-packets/WP-014A-villain-reveal-pipeline.md),
  [WP-024](../docs/ai/work-packets/WP-024-scheme-mastermind-ability-execution.md)
