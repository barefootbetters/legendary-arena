---
title: Wounds
type: Mechanic
tags:
  - layer-engine
  - hand
  - ko
  - loss-condition
  - phase-play
  - stage-main
  - turn-economy
related:
  - turn-system.md
  - play-board.md
  - board-keywords.md
  - scheme-twist.md
  - card-type-taxonomy.md
  - cardextid.md
  - scoring.md
  - gameplay-strategy.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\wounds.md (this page — https://ewiki.legendary-arena.com/wounds/)
  - ../packages/game-engine/src/moves/healWounds.ts
  - ../packages/game-engine/src/board/wounds.logic.ts
  - ../packages/game-engine/src/setup/pilesInit.ts
  - ../packages/game-engine/src/moves/fightVillain.ts
  - ../packages/game-engine/src/moves/recruitHero.ts
  - ../packages/game-engine/src/game.ts
  - ../packages/game-engine/src/events/notableEvents.compose.ts
  - ../apps/arena-client/src/composables/useTurnActions.ts
  - ../apps/arena-client/src/components/play/TurnActionBar.vue
  - ../docs/ai/DECISIONS.md
  - ../docs/ai/work-packets/WP-379-wound-healing-ability.md
  - ../docs/Marvel Legendary Universal Rules v23.txt
last-reviewed: 2026-08-11
---

# Wounds

## Summary

A **Wound** is a worthless filler card forced into a player's deck by
Villain attacks, Master Strikes, and various card effects. Wounds carry
no Attack or Recruit and **cannot be played**. Their only interaction is
the printed universal **Healing** ability: *"If you don't recruit or
fight anything on your turn, you may KO all the Wounds from your hand."*
Healing is used **directly from hand** — the Wounds are never "played" —
and it is mutually exclusive with recruiting or fighting for the whole
turn, a lock the engine enforces in both directions (D-24179 / D-24180).

> **Important:** playing cards and triggering their effects does **not**
> bar Healing. Only `fightVillain` / `fightMastermind` / `recruitHero`
> set the acted-this-turn flag. A player may play their entire hand, use
> "draw a card" abilities to see how the turn develops, and *then* decide
> whether to Heal or to fight/recruit — exactly as the rulebook advises.

## Mechanics

### Wound card identity and supply

The Wound card's ext_id is `WOUND_EXT_ID = 'pile-wound'`
([`setup/pilesInit.ts`](../packages/game-engine/src/setup/pilesInit.ts)).
Like every zone entry it is a bare
[`CardExtId`](cardextid.md) string — Wounds hold no object, text, or
image in `G`. Setup builds a shared **wounds supply pile** of
`config.woundsCount` copies (`createPileCards(WOUND_EXT_ID, …)`, shuffled),
one of the four global supply piles alongside Bystanders, officers, and
sidekicks.

### Gaining a Wound

`gainWound`
([`board/wounds.logic.ts`](../packages/game-engine/src/board/wounds.logic.ts))
is the pure chokepoint: it removes the top card of the shared wounds pile
(`pile[0]`, the locked supply convention) and appends it to a player's
**discard** zone. An empty pile is a deterministic no-op (both arrays
returned unchanged). Because the Wound lands in discard, it re-enters the
player's deck on the next reshuffle and is drawn into hand on a later
turn — that is where Healing can reach it.

### The Healing ability (`healWounds` move)

`healWounds`
([`moves/healWounds.ts`](../packages/game-engine/src/moves/healWounds.ts),
WP-379) realizes the printed ability. It is a **non-core move that gates
internally** (the WP-014A precedent shared with `fightVillain` /
`recruitHero`), in this order:

1. **Stage gate** — `G.currentStage === 'main'` or return (a your-turn
   main-window action).
2. **Block-all pending cluster** — return with no side effects while any
   pending-choice state is unresolved (the board is frozen). This is the
   full block-all guard set the fight/recruit moves carry.
3. **Acted-this-turn precondition** — `if (G.hasActedThisTurn === true)
   return` (D-24179): Healing is barred once the player has recruited or
   fought.
4. **Mutate `G`** — partition the hand into surviving (non-Wound) cards
   and a Wound count in a single explicit pass (no `.reduce()` /
   `.filter()`), KO one `WOUND_EXT_ID` per counted Wound to `G.ko`, keep
   the rest of the hand, set `G.hasHealedThisTurn = true`, push a log
   line, then push a `healResolved` notable event.

Healing creates **no** pending-choice state — it is synchronous. Moves
never throw; every blocked, out-of-stage, already-acted, or no-Wounds
call returns `void` with no mutation.

### KO destination is permanent

Each healed Wound is KO'd to `G.ko` via `koCard`. Wounds are **never**
returned to the wounds supply pile and **never** sent to discard — they
leave the game. Healing therefore shrinks the total Wound supply that
future attacks can draw from, and (see *Interactions*) never refills the
Legacy Virus loss pile.

### Acted / healed mutual exclusion

The rulebook clause *"If you use this Healing ability, you can't recruit
or fight any kinds of cards either before or after"* is modelled by two
per-turn flags on `G`, both reset at the start of every player turn in
the turn `onBegin` hook
([`game.ts`](../packages/game-engine/src/game.ts)):

| Flag | Set by | Bars |
|---|---|---|
| `G.hasActedThisTurn` | `fightVillain` / `fightMastermind` / `recruitHero` | `healWounds` (the "before" half) |
| `G.hasHealedThisTurn` | `healWounds` | `fightVillain` / `fightMastermind` / `recruitHero` (the "after" half) |

`hasHealedThisTurn(G)` and the acted flag are read by the fight/recruit
moves to enforce the reverse lock (D-24180). Neither flag is set by
`playCard` or by any triggered hero/villain effect — playing cards is
always compatible with a later Heal.

## Interactions

- **Heal-Wounds button gate.** The client affordance is
  `canHealWounds` in
  [`useTurnActions.ts`](../apps/arena-client/src/composables/useTurnActions.ts)
  (WP-380 / D-24181), wired through `healGate()` in
  [`TurnActionBar.vue`](../apps/arena-client/src/components/play/TurnActionBar.vue).
  Its precedence is turn → main stage → block-all pending → wound-in-hand
  → not-acted → not-healed. **The pending set MUST mirror the engine
  `healWounds` guards exactly** — otherwise the button renders enabled but
  the click silently no-ops at the engine (a live-but-dead click, the
  `getLegalMoves`↔move-guard divergence class). EC-565 (2026-08-11)
  restored five guards — `discardToPlay` (D-24184), `discardChoice`
  (D-24284), `reorderChoice` (D-24286), `defeatChoice` (D-24291),
  `returnOnDiscard` (D-24301) — that had drifted out of the gate as each
  pending-choice type was added after WP-380.
- **`healResolved` notable event.** `healWounds` pushes a `healResolved`
  event (WP-381) carrying the healed count and a
  `composeHealNarrative(count)` sentence
  ([`notableEvents.compose.ts`](../packages/game-engine/src/events/notableEvents.compose.ts)).
  `G.messages` is not projected to clients, so this event is what drives
  the center-screen "Healed" overlay.
- **The Legacy Virus scheme.** *"The Legacy Virus"* loses for the heroes
  when the **Wound stack runs out** — a resource-loss condition modelled
  as `pile-depleted` / `wounds` with the wound stack sized `6×players`
  (WP-511, D-24320 / D-24321; see [Scheme Twist](scheme-twist.md)).
  Because Healing KOs Wounds to `G.ko` rather than back to the supply,
  Healing does not slow that doom clock by refilling the pile — only the
  setup sizing and the deal-out rate do.
- **Villain / scheme wound sources.** Wounds are dealt by board keywords
  and effects (Villain attacks, `wound-all` scheme twists, Master
  Strikes) through `gainWound`; see [Board Keywords](board-keywords.md)
  and [Scheme Twist](scheme-twist.md) for the emitters.
- **Turn System.** Healing is a main-stage action of the current player's
  turn; the acted/healed flags live in per-turn economy state and reset
  in the turn `onBegin` alongside the draw and reveal allowances (see
  [Turn System](turn-system.md)).

## Edge Cases

- **Healing reaches the HAND only.** Wounds in the deck or discard are
  untouched — the ability KOs Wounds *from hand*. The client gate scans
  the viewer's `handCards` for `WOUND_EXT_ID` (`hasWoundInHand`), **not**
  `UIPlayerState.woundCount`, which counts Wounds across every zone and
  cannot answer "is there a Wound I can Heal right now?".
- **No Wounds in hand is a deterministic no-op.** No flag is set, no
  event is pushed, `G` is unchanged — a heal with an empty-of-Wounds hand
  is silently harmless.
- **Wounds can't be played.** They carry no play value and are used
  directly from hand; there is no "play a Wound" path, so no on-play
  effect and no interaction with play-time costs (e.g. discard-to-play).
- **Playing cards is not "acting".** The most common misread is that
  putting cards in play should bar Healing. It does not — `hasActedThisTurn`
  is set only by an actual fight or recruit. (Reported and confirmed
  2026-08-11 from a 2p Dr. Doom + Secret Invasion match: healing succeeded
  with cards already in play.)
- **Client/engine gate parity is load-bearing.** Any pending-choice type
  the engine `healWounds` blocks on must also disable the button, or the
  Heal affordance becomes a dead click (EC-565). Conversely the client
  must **not** over-mirror: `healWounds` does not guard
  `pendingOptionalPutBottomHQ` / `pendingPutAnyNumberBottomHQ`, so the
  gate does not either.

## Code Touchpoints

- [`packages/game-engine/src/moves/healWounds.ts`](../packages/game-engine/src/moves/healWounds.ts)
  — the `healWounds` move and `hasHealedThisTurn(G)` predicate
- [`packages/game-engine/src/board/wounds.logic.ts`](../packages/game-engine/src/board/wounds.logic.ts)
  — `gainWound` (supply pile → player discard)
- [`packages/game-engine/src/setup/pilesInit.ts`](../packages/game-engine/src/setup/pilesInit.ts)
  — `WOUND_EXT_ID` and the wounds supply pile
- [`packages/game-engine/src/game.ts`](../packages/game-engine/src/game.ts)
  — turn `onBegin` reset of `hasActedThisTurn` / `hasHealedThisTurn`
- [`packages/game-engine/src/events/notableEvents.compose.ts`](../packages/game-engine/src/events/notableEvents.compose.ts)
  — `composeHealNarrative` (the `healResolved` overlay text)
- [`apps/arena-client/src/composables/useTurnActions.ts`](../apps/arena-client/src/composables/useTurnActions.ts)
  — `canHealWounds` (Heal-Wounds button gate; engine-parity guard set)
- [`apps/arena-client/src/components/play/TurnActionBar.vue`](../apps/arena-client/src/components/play/TurnActionBar.vue)
  — `healGate()` (threads the pending-choice props to `canHealWounds`)

## History

- WP-379: the `healWounds` move; `G.hasActedThisTurn` / `G.hasHealedThisTurn`
  flags and their mutual exclusion (D-24179 forward lock, D-24180 reverse
  lock + per-turn reset, D-24181 the ability contract)
- WP-380: the client Heal-Wounds button and `canHealWounds` gate (D-24181)
- WP-381: the `healResolved` notable event → center-screen "Healed" overlay
- WP-511: The Legacy Virus wound-stack-depletion loss + `6×players` wound
  sizing (D-24320 / D-24321)
- WP-530 / EC-565 (2026-08-11): client-gate parity fix — `canHealWounds`
  restored the five drifted pending-choice guards so it mirrors the engine
  `healWounds` block-all set exactly, ending a live-but-dead Heal click
  while a triggered-effect choice was unresolved

## References

- [`.claude/skills/legendary-game-engine/SKILL.md`](../.claude/skills/legendary-game-engine/SKILL.md)
  — move validation contract; non-core internally-gated moves
- [`docs/ai/DECISIONS.md`](../docs/ai/DECISIONS.md) — D-24179 / D-24180 /
  D-24181 (Healing + acted/healed locks); D-24184 / D-24284 / D-24286 /
  D-24291 / D-24301 (the pending-choice guards the gate mirrors)
- [`docs/Marvel Legendary Universal Rules v23.txt`](../docs/Marvel%20Legendary%20Universal%20Rules%20v23.txt)
  — tabletop semantics for Wounds and the Healing ability
- WP-379, WP-380, WP-381 (Wound Healing arc); WP-530 / EC-565 (gate parity)
