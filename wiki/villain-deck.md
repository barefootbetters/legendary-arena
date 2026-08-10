---
title: Villain Deck
type: System
tags:
  - layer-engine
  - villain-deck
  - phase-play
  - stage-start
  - trigger
related:
  - master-strike.md
  - card-effect-system.md
  - scheme-twist.md
  - scheme.md
  - rule-execution-pipeline.md
  - turn-system.md
  - cardextid.md
  - card-type-taxonomy.md
  - board-keywords.md
  - scoring.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\villain-deck.md (this page — https://ewiki.legendary-arena.com/villain-deck/)
  - ../.claude/skills/legendary-game-engine/SKILL.md
  - ../packages/game-engine/src/villainDeck/villainDeck.types.ts
  - ../packages/game-engine/src/villainDeck/villainDeck.reveal.ts
  - ../packages/game-engine/src/villainDeck/villainDeck.setup.ts
  - ../packages/game-engine/src/villain/villainEffects.execute.ts
  - ../packages/game-engine/src/board/city.logic.ts
  - ../packages/game-engine/src/board/bystanders.logic.ts
  - ../packages/game-engine/src/rules/schemeResourceLoss.ts
  - ../packages/game-engine/src/board/boardKeywords.logic.ts
  - ../docs/legendary-universal-rules-v23.md
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/ai/work-packets/WP-014A-villain-reveal-pipeline.md
  - ../docs/ai/work-packets/WP-014B-villain-deck-composition.md
  - ../docs/ai/work-packets/WP-015-city-hq-zones-villain-movement.md
  - ../docs/ai/work-packets/WP-015A-reveal-safety-fixes.md
  - ../docs/10-GLOSSARY.md
last-reviewed: 2026-08-08
---

# Villain Deck

## Summary

The villain deck is the shared antagonist stack revealed once per turn
at the [`start`](turn-system.md) stage. Every reveal classifies the
drawn card into one of five card-type values and fires the
corresponding rule triggers; downstream mechanics —
[Master Strike](master-strike.md), [Scheme Twist](scheme-twist.md),
and Ambush / Patrol / Guard board keywords — all sit on top of this
pipeline.

## Mechanics

### State shape

`G.villainDeck` is a `VillainDeckState` with two
[`CardExtId`](cardextid.md) arrays:

```ts
interface VillainDeckState {
  deck: CardExtId[];     // top of deck = deck[0]
  discard: CardExtId[];  // revealed and resolved cards
}
```

A second field, `G.villainDeckCardTypes: Record<CardExtId, RevealedCardType>`,
holds the classification for every card in the deck. It is populated at
**setup time** by `buildVillainDeck` from registry data, then read in
O(1) at runtime — moves never query the registry. See
[`.claude/skills/legendary-game-engine/SKILL.md`](../.claude/skills/legendary-game-engine/SKILL.md)
"Registry Boundary" for the rule.

### Classification: the 5-value closed set

`RevealedCardType` is a closed union (5 values, hyphens not underscores):

| Value | Routing on reveal |
|---|---|
| `villain` | Pushed into the City |
| `henchman` | Pushed into the City |
| `bystander` | **Captured** — attached under the frontmost City villain (or the Mastermind if the City is empty); **never** discarded |
| `scheme-twist` | Fires `onSchemeTwistRevealed`; card goes to `G.scheme.twistPile` |
| `mastermind-strike` | Fires `onMastermindStrikeRevealed`; card goes to `G.mastermind.strikePile` |

Note the final destinations: **no** revealed card routes to `G.villainDeck.discard`
in the current engine — villains/henchmen enter the City, bystanders attach,
twists go to `twistPile`, strikes go to `strikePile`. The `discard` array on
`VillainDeckState` exists in the shape but is effectively dead (see Edge Cases).

The canonical array `REVEALED_CARD_TYPES` in
[`villainDeck.types.ts`](../packages/game-engine/src/villainDeck/villainDeck.types.ts)
is the single source of truth and is asserted against the union by
drift-detection tests.

### The reveal pipeline

`revealVillainCard` in
[`villainDeck.reveal.ts`](../packages/game-engine/src/villainDeck/villainDeck.reveal.ts)
is the only authority for drawing from the deck. Step numbering
mirrors the source comments exactly. The order is contractual — rule
hooks must observe post-placement board state, so City routing
happens before triggers fire:

- **Step 0 — Stage gate.** Return silently unless
  `G.currentStage === 'start'`.
- **Step 1 — Empty-deck handling.** If the deck is empty, log and
  return — a no-op reveal. The villain deck does **not** reshuffle from
  its discard (WP-367 / D-24160): unlike a hero deck, running the villain
  deck out is terminal — it latches the final turn (game.ts `turn.onMove`,
  D-24159) rather than being refilled. In practice `villainDeck.discard`
  never accumulates anything to reshuffle anyway (see Step 7).
- **Step 2 — Draw.** Read `deck[0]` (top of deck). Defer removal from
  the deck until placement is confirmed (see Edge Cases / WP-015A).
- **Step 3 — Classify.** Look up `G.villainDeckCardTypes[cardId]`. If
  missing, log and return without removal.
- **Step 4 — City routing (`villain` / `henchman` only).** Validate
  `G.city` (a malformed city returns silently, card kept on deck —
  WP-015A), remove the card from the deck, then `pushVillainIntoCity`.
  A push that overflows the five City spaces escapes the card at the far
  edge; the **escape sequence** then runs in this exact order (the order
  is contractual — reveal.ts):
  1. increment `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` and append the card
     to `G.escapedPile`;
  2. the current player gains **1 Wound** (the MVP system-level escape
     penalty, WP-015 — supply-gated; this is *not* the tabletop "KO a Hero
     ≤6 from the HQ" procedure, which is not modeled);
  3. **carry** the escaped villain's attached bystanders into `G.escapedPile`
     alongside it (WP-508 / D-24314, `carryEscapedBystandersToPile`) — the
     tabletop *"Bystanders carried away by escaping Villains"*, **not** released
     back to the supply (the pre-WP-508 behaviour). This is what makes the escaped
     pile a **countable resource** for the resource-loss schemes (see Endgame);
  4. fire the card's `onEscape` / `Overrun:` abilities via
     `executeVillainAbilities`;
  5. KO any heroes captured on the escaped villain;
  6. if the escaped card carries a `become-scheme-twist` hook (Mystique),
     fire `onSchemeTwistRevealed` — a second trigger path (WP-481 /
     D-24287; see Edge Cases).

  **Ambush fires only after the escape sequence fully resolves.** Ambush is
  *not* a hardcoded "every player gains a Wound" — that loop was deleted
  (D-18504). When `hasAmbush(cardId)` is true, the reveal move dispatches
  the card's parsed `[effect:]` hooks via `executeVillainAbilities(…,
  'onAmbush')` and emits an `ambushResolved` notable event. A villain/
  henchman does **not** capture a bystander merely by entering the City
  (WP-432 removed that non-canonical attach); bystanders enter play only via
  a revealed `bystander` card or an explicit `capture-bystander` effect.
- **Step 5 — Collect rule effects.** Always emit `onCardRevealed`.
  Conditionally emit `onSchemeTwistRevealed` or
  `onMastermindStrikeRevealed`. Trigger evaluation is delegated to
  the rule-execution pipeline — the move contains no inline effect
  logic.
- **Step 6 — Apply effects.** `applyRuleEffects` mutates `G` from the
  collected `RuleEffect[]`.
- **Step 7 — Final destination.** `villain` and `henchman` are already
  in the City. A `bystander` is attached under its captor (frontmost City
  villain, or the Mastermind if the City is empty — also mirrored onto
  `G.mastermind.attachedBystanders` for the UI projection, D-12805).
  `scheme-twist` goes to `G.scheme.twistPile`; `mastermind-strike` goes to
  `G.mastermind.strikePile`. Nothing routes to `G.villainDeck.discard`.

**Move wrapper vs. inner pipeline.** `revealVillainCard` (the boardgame.io
move) is a thin wrapper that owns three gates, then delegates the draw →
classify → route → trigger → apply body to `performVillainReveal`:

- **Block-all pending-choice guards.** Before any state write, the wrapper
  returns silently if any interactive choice is outstanding —
  `hasPendingKoHeroChoice`, `hasPendingScryKoChoice`, `hasPendingDiscardChoice`,
  `hasPendingReorderChoice`, `hasPendingOptionalKoReward`,
  `hasPendingVictoryPileCardPick`, `hasPendingDrawOrEmpowered`,
  `hasPendingReturnZeroCostDiscard`. The board is frozen until the player
  resolves the choice (the [pending-choice interaction model](card-effect-system.md)).
- **Once per turn.** `G.villainRevealedThisTurn` gates the start-of-turn
  reveal; it is set after the attempt even when the deck is empty, so an
  exhausted-deck no-op still spends the allowance (no same-turn retry loop).
- **Chaining bypass.** Scheme/card effects that reveal *additional* cards
  (e.g. the Midtown Bank Robbery twist) call `performVillainReveal`
  directly, intentionally bypassing both the once-per-turn guard and the
  stage gate.

The full step contract is also documented inline in
[`game-engine.md` "Villain Deck & Reveal Pipeline"](../.claude/skills/legendary-game-engine/SKILL.md).

## Interactions

- **[Master Strike](master-strike.md)** — When the revealed card is
  classified `mastermind-strike`, the reveal pipeline fires
  `onMastermindStrikeRevealed`. Master Strike resolution lives in
  the rule-execution pipeline, not in the reveal move.
- **[Scheme Twist](scheme-twist.md)** — Sibling type-specific
  trigger, fired on `scheme-twist` reveals via
  `onSchemeTwistRevealed`. Unlike Master Strike, the default
  scheme-twist handler can drive an `ENDGAME_CONDITIONS.SCHEME_LOSS`
  counter increment when the twist count crosses an MVP threshold.
  `onSchemeTwistRevealed` has a **second trigger path** on top of the
  `scheme-twist` classification: a villain escaping from the City with a
  `become-scheme-twist` `onEscape` hook fires the same pipeline
  (WP-481 / D-24287), so a Scheme Twist can occur without a
  `scheme-twist` card being revealed at all.
- **[Rule Execution Pipeline](rule-execution-pipeline.md).** All
  triggers route through `executeRuleHooks` → `applyRuleEffects`.
  The reveal move does not implement effects; it only collects them.
- **City** — `villain` and `henchman` reveals push into `G.city` via
  `pushVillainIntoCity`. A push that overflows the city escapes the
  card at index 4, increments `ENDGAME_CONDITIONS.ESCAPED_VILLAINS`,
  triggers a wound for the current player, and **carries** its attached
  bystanders into `G.escapedPile` with it (WP-508 / D-24314) — not back
  to the supply.
- **[Board Keywords](board-keywords.md) (Ambush).** A card entering the
  City with the Ambush keyword runs its **printed** `[effect:]` text via
  `executeVillainAbilities(…, 'onAmbush')`, gated by a `hasAmbush`
  fast-check. Ambush is **not** a blanket "every player gains a Wound" — the
  hardcoded wound loop was deleted in D-18504 because it fired identical
  wrong behaviour for every Ambush card regardless of printed text. The
  reveal move emits an `ambushResolved` notable event with the parsed
  effect keywords for the arena-client overlay.
- **[Card Type Taxonomy](card-type-taxonomy.md).** `RevealedCardType`
  is a strict subset of the broader registry-side taxonomy. Only the
  five values listed above ever appear in `G.villainDeckCardTypes`;
  the wider taxonomy (13 entries in
  [`data/metadata/card-types.json`](../data/metadata/card-types.json))
  also includes hero, sidekick, S.H.I.E.L.D., and other types that
  never enter the villain deck.
- **Endgame — the escaped pile is a per-scheme resource, not a global cap.**
  The old generic `escapedVillains >= ESCAPE_LIMIT (8)` scheme-wins loss was
  **retired** (WP-509 / D-24317). Escape / carry-away losses are now declared
  **per scheme** via `SchemeTwistConfig.resourceLossCondition` (kind
  `escaped-pile-count`), which counts entries of a given type in `G.escapedPile`
  and latches `SCHEME_LOSS` from the escape path: **Midtown Bank Robbery** loses
  at **8 Bystanders** carried into the pile (WP-508 / D-24315), **Negative Zone
  Prison Breakout** at **12 Villains** escaped (WP-509 / D-24316 — *villains only*,
  counted by card type so real villains, not carried bystanders/henchmen, count).
  `evaluateEndgame` stays counter-only — the resource check does the counting and
  sets `SCHEME_LOSS`. The `ESCAPED_VILLAINS` counter still increments per escaped
  adversary (stats + the co-op loss-cause heuristic) but no longer ends the game;
  `ESCAPE_LIMIT` survives only as that heuristic threshold. Schemes with no
  `resourceLossCondition` still fall back to the twist-count doom-clock proxy
  (D-24178 — see [Scheme Twist](scheme-twist.md)). Separately, **exhausting the
  villain deck latches the final turn** (game.ts `turn.onMove`, D-24159 / D-24160) —
  the deck is not refilled, so its running out is itself an end-condition trigger
  rather than a reshuffle.
- **Converted-card villains — a card that "counts as" a villain (Killbots,
  Secret Invasion).** Some schemes turn non-villain cards into villains. The card
  is typed **`'villain'`** in `G.villainDeckCardTypes` (so it reveals into the city,
  is fought, and escapes via the **existing** villain path — `RevealedCardType`
  is *not* extended) plus a lazily-materialized **`G.convertedVillainOrigins`**
  overlay recording the group it counts as (`'killbot'` | `'skrull'`; absent for
  every non-converting game, so the state hash is unchanged). Two schemes use it:
  **Replace Earth's Leaders with Killbots** (WP-513 / D-24324/D-24325) converts its
  18 villain-deck Bystanders to Killbot Villains at setup, whose attack equals a
  per-scheme "twists next to this Scheme" counter (`G.counters`, seeded 3, +1 per
  Killbots twist); **Secret Invasion of the Skrull Shapeshifters** (WP-514 /
  D-24326/D-24327) shuffles **12 Heroes from the Hero Deck into the Villain Deck**
  at setup — a deterministic cross-deck conversion (the top 12 of the shuffled hero
  reservoir are taken *before* the HQ is filled, typed `'villain'` + origin
  `'skrull'`, and the villain deck is re-shuffled by a single scheme-gated RNG draw
  that is the *last* setup draw, so non-Secret-Invasion games stay byte-identical).
  A Skrull's attack is the Hero's **cost + 2** (a documented proxy for the printed
  "VP + 2" — no card data carries hero VP); **defeating a Skrull gains the Hero into
  the defeating player's discard** (a guarded branch in the shared city-villain
  defeat core) rather than the victory pile; and the `secret-invasion` twist drags
  the highest-cost HQ Hero into the Sewers as a fresh Skrull.
- **Escaped-converted-count loss.** Both converted-card schemes lose via the
  `escaped-converted-count` `resourceLossCondition` kind (D-24325 / D-24326), which
  counts escaped-pile entries by **converted `origin`** — never the shared
  `'villain'` type, which would wrongly include the scheme's real villains: Killbots
  at **5** escaped Killbots, Secret Invasion at **6** escaped Skrulls. This is a
  sibling of the `escaped-pile-count` kind above; a third kind, `pile-depleted`
  (Civil War hero deck / Legacy Virus wound stack), is checked in `turn.onMove`
  rather than the escape path. See [Scheme Twist](scheme-twist.md) for the full
  six-scheme resource-loss taxonomy.

## Edge Cases

- **Slug mismatch is a silent failure.** A card whose classification
  is stored as `'scheme_twist'` (underscore) instead of
  `'scheme-twist'` (hyphen) will not match the union and will silently
  prevent the trigger from firing. Drift-detection tests against
  `REVEALED_CARD_TYPES` exist specifically to catch this. See
  [`game-engine.md` "RevealedCardType Conventions"](../.claude/skills/legendary-game-engine/SKILL.md).
- **Deferred deck removal (WP-015A).** Earlier versions of the move
  removed the drawn card before validating City placement. If the
  city was malformed, the card was lost permanently. The current
  pipeline keeps the card on top of the deck until placement
  succeeds, then removes it. See
  [WP-015A](../docs/ai/work-packets/WP-015A-reveal-safety-fixes.md).
- **Missing classification fails closed.** If
  `G.villainDeckCardTypes[cardId]` is undefined, the move logs a
  message and returns without modifying state — no removal, no
  trigger. This protects against partially-built decks at setup.
- **The villain deck never reshuffles; its discard is dead state.**
  Unlike a player deck (and unlike an earlier version of this page),
  the villain deck does not shuffle its discard back in when it empties —
  exhaustion latches the final turn (WP-367 / D-24160). The
  `VillainDeckState.discard` array remains in the shape for historical
  reasons but nothing routes to it: villains/henchmen go to the City,
  bystanders attach, twists/strikes go to their own piles.
- **Bystander captor selection.** A revealed `bystander` is captured by
  the **frontmost** City villain — the highest occupied City index, i.e.
  the one nearest the escape edge — or by the Mastermind when the City is
  empty. It is stored in `G.attachedBystanders[captorId]`; a Mastermind
  capture is additionally mirrored onto `G.mastermind.attachedBystanders`
  for the UI (D-12805).
- **Ambush gates on supply.** Ambush wound application is gated on
  `G.piles.wounds.length > 0` — once the wound supply is exhausted,
  Ambush degrades silently for the remaining players. Same gating
  applies to escape-induced wounds.
- **Reveal is start-stage only.** Calling `revealVillainCard` outside
  `G.currentStage === 'start'` returns silently — never throws.
  Moves never throw per
  [`game-engine.md` "Move Validation Contract"](../.claude/skills/legendary-game-engine/SKILL.md).
- **An escape can trigger a Scheme Twist (WP-481 / D-24287).** After the
  City push escapes a villain (index-4 overflow) and its `onEscape`
  abilities resolve, `villainCardEscapeTriggersSchemeTwist(G, cardId)`
  checks whether the escaped card carries a `become-scheme-twist` hook; if
  so the reveal move runs the `onSchemeTwistRevealed` rule pipeline for the
  escaped card (Mystique's *"Escape: … becomes a Scheme Twist"*). The
  `become-scheme-twist` villain-effect executor is itself a deliberate
  no-op — the Scheme Twist is realized here at the fire site, not by an
  executor mutation — so the twist count and any `SCHEME_LOSS` progression
  advance exactly as a revealed `scheme-twist` would. See
  [Card Effect System](card-effect-system.md).

## Tabletop features not yet modeled

`RevealedCardType` is a closed **five-value** set. Several villain-deck
mechanics from the *Marvel Legendary Universal Rulebook v23* and later
expansions are deliberately **not** modeled at this revision — documenting
them here as engine behaviour would be inaccurate. Adding any of them is a
design change (union + `REVEALED_CARD_TYPES` array + a `DECISIONS.md` entry +
drift tests), not a card-data edit:

- **Locations, Traps, Villainous Weapons, ambush-schemes** — none exist as
  a revealed card type; the engine has no Location zone, Trap challenge
  queue, or weapon-attachment/Artifact conversion.
- **The full tabletop escape procedure** — a real escape has the escaping
  villain KO a Hero of cost ≤ 6 from the HQ, and (per some schemes) triggers
  per-player discards. The engine substitutes a single current-player Wound
  (see Step 4). The *"Bystanders carried away by escaping Villains"* half **is**
  now modeled (WP-508 — attached bystanders travel into `G.escapedPile`, which the
  resource-loss schemes count); the KO-a-Hero and per-player-discard steps remain
  unmodeled MVP simplifications.
- **Warmup Round** — the 4–5 player first-turn skip of the villain reveal is
  not implemented; the only gate is `G.currentStage === 'start'`.

## Code Touchpoints

- [`packages/game-engine/src/villainDeck/villainDeck.types.ts`](../packages/game-engine/src/villainDeck/villainDeck.types.ts)
  — `RevealedCardType` union, `REVEALED_CARD_TYPES` array,
  `VillainDeckState` interface
- [`packages/game-engine/src/villainDeck/villainDeck.setup.ts`](../packages/game-engine/src/villainDeck/villainDeck.setup.ts)
  — `buildVillainDeck` (setup-time composition + classification map)
- [`packages/game-engine/src/villainDeck/villainDeck.reveal.ts`](../packages/game-engine/src/villainDeck/villainDeck.reveal.ts)
  — `revealVillainCard` move wrapper + `performVillainReveal` (the 8-step pipeline)
- [`packages/game-engine/src/board/city.logic.ts`](../packages/game-engine/src/board/city.logic.ts)
  — `pushVillainIntoCity` (push + overflow escape)
- [`packages/game-engine/src/board/bystanders.logic.ts`](../packages/game-engine/src/board/bystanders.logic.ts)
  — `carryEscapedBystandersToPile` (carry attached bystanders into `G.escapedPile` on escape, WP-508)
- [`packages/game-engine/src/rules/schemeResourceLoss.ts`](../packages/game-engine/src/rules/schemeResourceLoss.ts)
  — `countEscapedPileByType` + `countEscapedByConvertedOrigin` + `applyEscapedPileResourceLoss` + `applyPileDepletionResourceLoss` (the three resource-loss kinds, WP-508..514)
- [`packages/game-engine/src/setup/convertHeroesToSkrulls.ts`](../packages/game-engine/src/setup/convertHeroesToSkrulls.ts)
  — Secret Invasion's deterministic 12-hero cross-deck conversion at setup (WP-514)
- [`packages/game-engine/src/setup/schemeSetupSizing.ts`](../packages/game-engine/src/setup/schemeSetupSizing.ts)
  — `resolveEffectiveWoundsCount` (Legacy Virus 6×players, WP-511) + `resolveEffectiveHeroDeckIds` (Civil War 4-hero @2p, WP-515 drafted)
- [`packages/game-engine/src/board/boardKeywords.logic.ts`](../packages/game-engine/src/board/boardKeywords.logic.ts)
  — `hasAmbush` fast-check
- [`packages/game-engine/src/villain/villainEffects.execute.ts`](../packages/game-engine/src/villain/villainEffects.execute.ts)
  — `executeVillainAbilities` (onAmbush / onEscape), `villainCardEscapeTriggersSchemeTwist`
- [`packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts`](../packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts)
  — reveal pipeline tests
- [`packages/game-engine/src/villainDeck/villainDeck.city.integration.test.ts`](../packages/game-engine/src/villainDeck/villainDeck.city.integration.test.ts)
  — integration with city push / escape
- [`packages/game-engine/src/villainDeck/villainDeck.types.test.ts`](../packages/game-engine/src/villainDeck/villainDeck.types.test.ts)
  — drift-detection: array-vs-union assertion

## History

- WP-014A: Reveal pipeline established with classify-then-trigger contract and 5-value `RevealedCardType` union
- WP-014B: Villain deck composition; setup-time `G.villainDeckCardTypes` registry resolution
- WP-015: City routing added for `villain` and `henchman`; escape counter tracking
- WP-015A: Deferred deck removal until placement confirmation; closed silent-loss path on malformed city
- D-18504: Deleted the hardcoded "every player gains a Wound" Ambush loop; Ambush now dispatches the card's parsed `[effect:]` hooks
- WP-367 (D-24159 / D-24160): Villain deck exhaustion latches the final turn — the deck does not reshuffle from its discard
- WP-432 (supersedes D-1701): Removed the non-canonical city-entry bystander attach; bystanders enter play only via a revealed `bystander` card or a `capture-bystander` effect
- WP-481 (D-24287): Escape fire site can trigger a Scheme Twist — an escaping villain carrying a `become-scheme-twist` `onEscape` hook (Mystique) runs the `onSchemeTwistRevealed` pipeline, a second trigger path for that hook beyond the `scheme-twist` reveal classification
- 2026-08-01: Correctness pass against `villainDeck.reveal.ts` — fixed bystander routing (capture, not discard), scheme-twist/mastermind-strike final piles (`twistPile`/`strikePile`, not discard), empty-deck handling (terminal, no reshuffle), and the Ambush description; documented the move-wrapper guards, the real escape order, and the tabletop features not yet modeled
- WP-508 (D-24314 / D-24315): escaping villains now **carry** their attached bystanders into `G.escapedPile` (renamed `resolveEscapedBystanders` → `carryEscapedBystandersToPile`), not back to the supply; introduced the data-only `SchemeTwistConfig.resourceLossCondition` (`escaped-pile-count`) framework that counts the escaped pile by card type and latches `SCHEME_LOSS` from the escape path — Midtown Bank Robbery wired at 8 carried-away Bystanders
- WP-509 (D-24316 / D-24317): **retired** the generic `escapedVillains >= ESCAPE_LIMIT (8)` scheme-wins loss; escape losses are now per-scheme — Negative Zone Prison Breakout loses at 12 escaped **Villains** (villains only, counted by card type). `ESCAPED_VILLAINS` counter + `ESCAPE_LIMIT` constant retained (counter still increments; `ESCAPE_LIMIT` is now only the co-op loss-cause heuristic threshold)
- WP-510 (D-24318 / D-24319): second resource-loss kind — `pile-depleted` — Super Hero Civil War loses when the **Hero Deck runs out** (`G.heroDeck` empty), checked in the play-phase `turn.onMove` hook (a per-move chokepoint, since the scheme's "KO all HQ heroes" twist drains the deck via refills outside any recruit); the twist proxy is suppressed
- WP-511 (D-24320 / D-24321): reused `pile-depleted` for **The Legacy Virus** (Wound stack empty, `G.piles.wounds`) + first scheme-specific **setup sizing** — the Wound stack builds at `6×players` (post-validation override) so it is small enough to run out
- WP-513 (D-24324 / D-24325): **converted-card villains** — `G.convertedVillainOrigins` overlay + the `escaped-converted-count` loss kind; **Replace Earth's Leaders with Killbots** converts its 18 villain-deck Bystanders to Killbot Villains (attack = a per-scheme twist counter), losing at 5 escaped Killbots (counted by origin, not the shared `'villain'` type)
- WP-514 (D-24326 / D-24327): second converted-card scheme — **Secret Invasion of the Skrull Shapeshifters** shuffles 12 Heroes from the Hero Deck into the Villain Deck at setup (deterministic cross-deck re-shuffle, the last setup RNG draw) as Skrull Villains (attack = Hero cost + 2, a proxy for the printed VP + 2); defeating a Skrull gains the Hero to your discard; the `secret-invasion` twist drags the highest-cost HQ Hero to the Sewers; Evil Wins at 6 escaped Skrulls. Resource-loss-scheme-fidelity epic complete (all six schemes faithful)

## References

- [`.claude/skills/legendary-game-engine/SKILL.md` "Villain Deck & Reveal Pipeline"](../.claude/skills/legendary-game-engine/SKILL.md)
- [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) — WP-014 review
  notes; villain-deck classification stored at setup
- [`docs/10-GLOSSARY.md`](../docs/10-GLOSSARY.md) — `RevealedCardType`,
  `G.villainDeckCardTypes`, `REVEALED_CARD_TYPES`
- [`docs/legendary-universal-rules-v23.md`](../docs/legendary-universal-rules-v23.md)
  — tabletop semantics for villain reveal, escape, and bystander capture
- [WP-014A](../docs/ai/work-packets/WP-014A-villain-reveal-pipeline.md),
  [WP-014B](../docs/ai/work-packets/WP-014B-villain-deck-composition.md),
  [WP-015](../docs/ai/work-packets/WP-015-city-hq-zones-villain-movement.md),
  [WP-015A](../docs/ai/work-packets/WP-015A-reveal-safety-fixes.md)
