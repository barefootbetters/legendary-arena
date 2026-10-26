---
title: Sidekicks
type: Mechanic
tags:
  - layer-engine
  - layer-client
  - supply-pile
  - recruit
  - phase-play
  - stage-main
related:
  - shield-officer.md
  - card-type-taxonomy.md
  - cardextid.md
  - turn-system.md
  - wounds.md
  - scoring.md
  - play-board.md
status: canonical
source:
  - C:\dev\legendary-arena\wiki\sidekicks.md (this page — https://ewiki.legendary-arena.com/sidekicks/)
  - ../packages/game-engine/src/moves/recruitSidekick.ts
  - ../packages/game-engine/src/moves/gainSidekick.logic.ts
  - ../packages/game-engine/src/hero/heroEffects.execute.ts
  - ../scripts/convert-cards/inputs/hero-ability-markers.json
  - ../packages/game-engine/src/moves/recruitOfficer.ts
  - ../packages/game-engine/src/moves/coreMoves.impl.ts
  - ../packages/game-engine/src/hero/splitCard.logic.ts
  - ../packages/game-engine/src/economy/economy.types.ts
  - ../packages/game-engine/src/economy/economy.logic.ts
  - ../packages/game-engine/src/setup/pilesInit.ts
  - ../packages/game-engine/src/setup/buildInitialGameState.ts
  - ../packages/game-engine/src/setup/buildCardDisplayData.ts
  - ../packages/game-engine/src/game.ts
  - ../packages/game-engine/src/ui/uiState.types.ts
  - ../packages/game-engine/src/ui/uiState.build.ts
  - ../packages/game-engine/src/ui/uiState.filter.ts
  - ../apps/arena-client/src/components/play/SharedDecks.vue
  - ../apps/arena-client/src/composables/useTurnActions.ts
  - ../docs/legendary-universal-rules-v23.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-10-26
---

# Sidekicks

![The Secret Wars Vol. 1 Sidekick card: a cost-2 Hero with no Attack or Recruit icon whose text reads "You may return this card to the Sidekick Stack. If you do, draw two cards."](https://images.legendary-arena.com/ssw1/ssw1-sk-sidekick.webp "width=280px")

*The Secret Wars Vol. 1 Sidekick — recruit one per turn from the Sidekick Stack for 2 Recruit; when you play it, it goes back to the bottom of the Stack and you draw two cards. Card art hosted on R2 (`images.legendary-arena.com`).*

## Summary

A **Sidekick** is a cheap card-draw card that lives in a shared supply pile, the
**Sidekick Stack** (`G.piles.sidekicks`), beside the S.H.I.E.L.D. Officer supply.
All Sidekicks are identical fungible tokens sharing the ext_id `pile-sidekick`
(`SIDEKICK_EXT_ID`). Lobby, featured-table and guest-solo matches all build a
12-card Stack.

- **Recruit.** During your Main step you may spend **2 Recruit** to put the top
  Sidekick into your discard pile, **at most once per turn** (WP-842 / D-24776).
- **Play.** When you play a Sidekick it **returns to the bottom of the Sidekick
  Stack** and you **draw two cards**. It still counts as a card you played this
  turn.

## Mechanics

### The Sidekick Stack

`pilesInit.ts` seeds `G.piles.sidekicks` with `config.sidekicksCount` copies of
`SIDEKICK_EXT_ID`. `pile[0]` is the top (the supply convention every pile uses),
so the end of the array is the bottom. Because every copy shares one id, the
one-zone-per-card invariant exempts `pile-sidekick` (D-3103).
`buildInitialGameState.ts` registers the stats `{ attack: 0, recruit: 0, cost: 2 }`;
`buildCardDisplayData.ts` resolves the card face (name and art) from the Secret
Wars Vol. 1 `other[]` sidekick entry.

### Recruiting a Sidekick (`recruitSidekick`)

`recruitSidekick` ([`moves/recruitSidekick.ts`](../packages/game-engine/src/moves/recruitSidekick.ts))
is the [`recruitOfficer`](shield-officer.md) move with three differences: it reads
the Sidekick Stack, it costs `G.cardStats['pile-sidekick'].cost ?? SIDEKICK_RECRUIT_COST`
(2), and it is **once per turn**. It is a non-core, internally stage-gated move
(not in `CORE_MOVE_NAMES`) that takes no arguments:

1. **Validate** — the Stack is non-empty, the current player's zones exist, and
   they have at least 2 unspent Recruit.
2. **Gate** — the stage must be `main`; then the once-per-turn check
   (`G.turnEconomy.hasRecruitedSidekickThisTurn`); then the same block-all
   pending-choice guards as `recruitOfficer`; then the heal lock (D-24180).
3. **Mutate** — the top token moves to the player's discard, 2 Recruit is spent,
   `hasRecruitedSidekickThisTurn` is set, `hasActedThisTurn` is set, and one log
   line is written: *"Player 0 recruited Sidekick (pile-sidekick) from the
   Sidekick Stack (spent 2 recruit; sidekicks pile: 11)."*

Every refusal is a silent no-op; moves never throw.

The once-per-turn flag is a lazily materialized `TurnEconomy` field: absent
until the first recruit, dropped by `resetTurnEconomy` at the start of every
turn. Only this move sets it. Rules v23 says a card effect that tells you to
"gain a Sidekick" does **not** count against the limit (see
[Gaining a Sidekick](#gaining-a-sidekick) below).

### Gaining a Sidekick

Ten hero lines print "Gain a Sidekick" (WP-844 / D-24778). Each carries the
curated marker `[keyword:gain-sidekick:N]`, and the `gain-sidekick` hero keyword
moves up to **N** Sidekicks from the **top** of the Stack into the playing
player's **discard pile** (rules v23: "Gain" means "put it into your discard
pile"):

| Set | Hero | Card | Printed line | N |
|---|---|---|---|---|
| Civil War | Captain America, Secret Avenger | Inspire a Nation | Gain a Sidekick. | 1 |
| Civil War | Falcon | Talk with Birds | [Ranged]: Gain a Sidekick. | 1 |
| Civil War | Peter Parker | Spider-Man Unmasked | Gain a Sidekick. | 1 |
| Civil War | Tigra | Friendship | [Covert]: Gain a Sidekick. | 1 |
| Secret Wars Vol 1 | Black Panther | King of Wakanda | Gain three Sidekicks. | 3 |
| Secret Wars Vol 1 | Magik | Rally the New Mutants | Gain a Sidekick. | 1 |
| Secret Wars Vol 1 | Magik | Rally the New Mutants | [Covert]: Gain another Sidekick. | 1 |
| Secret Wars Vol 1 | Namor, the Sub-Mariner | Lead the Armies of Atlantis | [Instinct]: Gain a Sidekick. | 1 |
| Secret Wars Vol 1 | Ultimate Spider-Man | Marvel Team-Up | Gain a Sidekick. | 1 |
| Core Set (2nd Edition) | Spider-Man | Witty Banter | [Instinct]: Gain a Sidekick. | 1 |

- **Free and outside the limit.** A gain spends no Recruit and never reads or
  writes `hasRecruitedSidekickThisTurn`, so you can still recruit a Sidekick that
  turn. It does not set `hasActedThisTurn` either: a gain is not a recruit or a
  fight, so Healing stays available (D-24179 / D-24180).
- **Class gates.** A leading `[hc:X]:` is the same play-gate other hero lines use:
  the gain happens only when you played another card of that class this turn.
- **Empty or short Stack.** The gain stops when the Stack runs out and never
  fails the play. The log says *"Player 0 gained 1 Sidekick(s) from the Sidekick
  Stack (…)."* (`applied`), *"Player 0 gained 2 of 3 Sidekick(s) — the Sidekick
  Stack ran out (…)."* (`partial`) or *"Player 0 could not gain a Sidekick — the
  Sidekick Stack is empty (…)."* (`blocked`).
- **Loadout-builder default.** The cards.legendary-arena.com loadout builder
  defaults to 0 Sidekicks (`DEFAULT_SIDEKICKS_COUNT = 0`), so a loadout built
  there has an empty Stack and these lines log `blocked`. The lobby form, guest
  solo and autoplay build 12; set a Sidekick count when you pick one of these
  heroes.
- **New matches only.** Hero hooks are captured when a match is set up, so a
  match created before WP-844 shipped keeps the old line, which does nothing.

**Not wired yet** (each needs a primitive that does not exist): the "put that /
them on top of your deck" riders (Peter Parker *Spider-Man Unmasked*, Black
Panther *King of Wakanda*; their gain still goes to discard); Daredevil
*Roundhouse Side Kick* (choose a number); Storm & Black Panther *King & Queen of
Wakanda* (reveal-count); Maximus *Enslave the Will* (a defeat trigger); Stepford
Cuckoos *Find Mutants with Cerebro* (Investigate the Stack); Werewolf by Night
*Track the Captives*; and the villain, tactic, bystander and scheme lines that
gain or capture Sidekicks.

### Playing a Sidekick (the return and draw)

The printed card says *"You may return this card to the Sidekick Stack. If you
do, draw two cards."* The engine makes the return **automatic** (D-24776, Jeff
2026-10-25): a plain Sidekick has no Attack, no Recruit and no class, so keeping
it only puts a blank card back in your deck, and declining is never the better
choice in this engine.

`returnPlayedSidekick` runs as the **last step of `applyCardPlay`**, after the
card's abilities and after a granted Out of Time set-aside:

1. If the Sidekick is not the last card in play (a granted Out of Time already
   set it aside), nothing happens.
2. It leaves play and goes to the **end** (bottom) of `G.piles.sidekicks`, and
   `TurnEconomy.sidekicksReturnedThisTurn` goes up by one.
3. Under Venompool's draw lock (`drawsLocked`, D-24552) the return still happens
   but nothing is drawn; the log line is `blocked`.
4. Otherwise two cards are drawn (reshuffling the discard if the deck runs out),
   the realized count is added to `cardsDrawn` (D-24476 / D-24732), and the log
   says *"Player 0 returned a Sidekick to the bottom of the Sidekick Stack and
   drew 2 card(s)."* (`applied`, or `partial` when fewer than two were drawn).

### "You still played that Sidekick"

Rules v23 says a returned Sidekick still counts as played. The Sidekick left
play, so `playedCardIdsThisTurn` (the rules-facing "cards you played this turn"
view) appends `pile-sidekick` once per `sidekicksReturnedThisTurn`. It is a
**count**, not an id list, because every Sidekick shares one id. The append runs
before the Out of Time ledger is merged, so a Sidekick replayed from Out of Time
and then returned counts once.

### Client affordance

The **Sidekicks** cell of
[`SharedDecks.vue`](../apps/arena-client/src/components/play/SharedDecks.vue) is a
recruit button showing the Sidekick card face (`piles.sidekickDisplay`), the
Stack count and "Recruit: 2", like the S.H.I.E.L.D. Officers cell. It disables
with a tooltip, in this order:

1. not your turn;
2. not the Main step;
3. you healed this turn;
4. "You already recruited a Sidekick this turn." (`economy.hasRecruitedSidekickThisTurn`);
5. "No Sidekicks remain in the Sidekick Stack.";
6. "Needs 2 recruit, you have N.".

`economy.hasRecruitedSidekickThisTurn` reaches the active player only;
`piles.sidekickDisplay` is public. Clicking dispatches `recruitSidekick` with an
empty payload, and the engine re-validates.

## Interactions

- **Out of Time.** A Sidekick replayed from Out of Time on your next turn is
  played again, so it returns to the bottom of the Stack and draws two instead of
  going to your discard. A granted Out of Time set-aside beats the return.
- **Draw lock.** Venompool's "you can't draw any more cards this turn" stops the
  draw, not the return.
- **Heal lock (D-24180).** Recruiting a Sidekick sets `hasActedThisTurn`, which
  bars Healing; a player who healed this turn cannot recruit one. See
  [Wounds](wounds.md).
- **Replay.** `recruitSidekick` is in the replay dispatch map, so a recorded game
  that recruits a Sidekick replays.
- **Scoring.** A Sidekick is worth 0 Victory Points. See [Scoring](scoring.md).

## Edge Cases

- **Not simulated.** `recruitSidekick` is kept out of `SIMULATION_MOVE_NAMES`,
  so the AI / PAR bot never buys a Sidekick and every determinism oracle stays
  byte-identical. Bot Sidekick buying is a follow-up.
- **Two Sidekicks, one set aside.** If you play two Sidekicks in one turn and a
  granted Out of Time sets one aside, the played count records one Sidekick, not
  two (an accepted undercount named in D-24776).
- **"Gain a Sidekick" effects** take from this Stack without touching the
  once-per-turn flag; see [Gaining a Sidekick](#gaining-a-sidekick) for the ten
  wired lines and the ones that still need a primitive.
- **Special Sidekicks** with their own abilities are out of scope; the Stack holds
  plain fungible `pile-sidekick` tokens only.
- **"Played This Turn" row.** The client's played-cards count reads the cards
  physically in play, so a returned Sidekick shows in the log, not in that row.

## Code Touchpoints

- [`packages/game-engine/src/moves/recruitSidekick.ts`](../packages/game-engine/src/moves/recruitSidekick.ts)
  — `recruitSidekick`, `returnPlayedSidekick`, `SIDEKICK_RECRUIT_COST`, `SIDEKICK_RETURN_DRAW_COUNT`
- [`packages/game-engine/src/moves/gainSidekick.logic.ts`](../packages/game-engine/src/moves/gainSidekick.logic.ts)
  — `gainSidekickToDiscard`, the card-effect gain (D-24778)
- [`packages/game-engine/src/hero/heroEffects.execute.ts`](../packages/game-engine/src/hero/heroEffects.execute.ts)
  — the `gain-sidekick` keyword handler (`heroEffectGainSidekick`, D-24778)
- [`scripts/convert-cards/inputs/hero-ability-markers.json`](../scripts/convert-cards/inputs/hero-ability-markers.json)
  — the ten curated `[keyword:gain-sidekick:N]` markers
- [`packages/game-engine/src/moves/coreMoves.impl.ts`](../packages/game-engine/src/moves/coreMoves.impl.ts)
  — the return hook at the end of `applyCardPlay`
- [`packages/game-engine/src/hero/splitCard.logic.ts`](../packages/game-engine/src/hero/splitCard.logic.ts)
  — `playedCardIdsThisTurn` counts returned Sidekicks
- [`packages/game-engine/src/economy/economy.logic.ts`](../packages/game-engine/src/economy/economy.logic.ts)
  — `markSidekickRecruited`, `recordSidekickReturned`, the carry chokepoint
- [`packages/game-engine/src/ui/uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts)
  and [`uiState.filter.ts`](../packages/game-engine/src/ui/uiState.filter.ts)
  — the recruit cue and the card face
- [`apps/arena-client/src/components/play/SharedDecks.vue`](../apps/arena-client/src/components/play/SharedDecks.vue)
  — the recruit button and gate
- [`apps/arena-client/src/composables/useTurnActions.ts`](../apps/arena-client/src/composables/useTurnActions.ts)
  — `canRecruitSidekick`

## History

- WP-842 / D-24776 (2026-10-26): the Sidekick Stack becomes recruitable — the
  `recruitSidekick` move (2 Recruit, once per turn), the automatic
  return-and-draw-two on play, the played-this-turn count, and the SharedDecks
  recruit button. Before this the Stack was built and shown but nothing could
  take from it.
- WP-844 / D-24778 (2026-10-26): "Gain a Sidekick" — the `gain-sidekick` hero
  keyword and ten curated card lines take Sidekicks from the top of the Stack into
  your discard, free and outside the once-per-turn recruit.

## References

- [`docs/legendary-universal-rules-v23.md`](../docs/legendary-universal-rules-v23.md)
  — §"HQ" (recruit Sidekicks "no more than once per turn, using Recruit points")
  and "Sidekicks & Special Sidekicks" (return to the bottom of the Stack; you
  still played it; gained Sidekicks don't count against the limit)
- [`docs/ai/DECISIONS.md`](../docs/ai/DECISIONS.md) — D-24776 (this feature),
  D-24778 ("Gain a Sidekick" card effects),
  D-24460 (`recruitOfficer`), D-24552 (draw lock), D-24692 (played-this-turn
  ledger), D-24180 (heal lock), D-3103 (fungible pile tokens)
- [S.H.I.E.L.D. Officer](shield-officer.md), [Play Board](play-board.md)
