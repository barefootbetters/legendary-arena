---
title: S.H.I.E.L.D. Officer
type: Mechanic
tags:
  - layer-engine
  - layer-client
  - supply-pile
  - recruit
  - phase-play
  - stage-main
related:
  - card-type-taxonomy.md
  - cardextid.md
  - turn-system.md
  - wounds.md
  - scoring.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\shield-officer.md (this page — https://ewiki.legendary-arena.com/shield-officer/)
  - ../packages/game-engine/src/moves/recruitOfficer.ts
  - ../packages/game-engine/src/moves/recruitHero.ts
  - ../packages/game-engine/src/setup/pilesInit.ts
  - ../packages/game-engine/src/setup/buildInitialGameState.ts
  - ../packages/game-engine/src/setup/buildCardDisplayData.ts
  - ../packages/game-engine/src/villain/villainEffects.execute.ts
  - ../packages/game-engine/src/game.ts
  - ../packages/game-engine/src/ui/uiState.types.ts
  - ../packages/game-engine/src/ui/uiState.build.ts
  - ../packages/game-engine/src/ui/uiState.filter.ts
  - ../apps/arena-client/src/components/play/SharedDecks.vue
  - ../apps/arena-client/src/components/play/CardTile.vue
  - ../apps/arena-client/src/composables/useTurnActions.ts
  - ../docs/legendary-universal-rules-v23.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-09-05
---

# S.H.I.E.L.D. Officer

![The core-set S.H.I.E.L.D. Officer card: a generic S.H.I.E.L.D.-class Hero showing a recruit cost of 3 and a "+2 Recruit" ability.](https://images.legendary-arena.com/core/core-so-officer.webp "width=280px")

*The core-set S.H.I.E.L.D. Officer (`core/officer`) — buy from the supply for 3 Recruit during Main; provides +2 Recruit when played. Card art hosted on R2 (`images.legendary-arena.com`).*

## Summary

The **S.H.I.E.L.D. Officer** is a generic support card that lives in a shared
supply pile (`G.piles.officers`), separate from the five HQ Hero slots. All
Officers are identical fungible tokens sharing the ext_id
`pile-shield-officer` (`SHIELD_OFFICER_EXT_ID`). An Officer **costs 3 Recruit
to buy** and, once in your deck, **provides +2 Recruit when played**.

There are two ways an Officer enters a player's deck:

1. **Player-initiated recruit** (WP-648 / D-24460) — during your Main step you
   may spend 3 Recruit to buy the top Officer from the supply, any number of
   times. Handled by the `recruitOfficer` move.
2. **Card effects** — a villain/henchman Fight reward or hero ability that
   grants an Officer for free. The core example is HYDRA Kidnappers'
   *"Fight: You may gain a S.H.I.E.L.D. Officer."* (WP-541 / D-24350), handled
   by the `gain-officer-current` villain-effect primitive.

Both paths move one token from `G.piles.officers` to the acquiring player's
**discard** pile.

## Mechanics

### The supply pile

`pilesInit.ts` seeds `G.piles.officers` with `config.officersCount` copies of
`SHIELD_OFFICER_EXT_ID` (shuffled; all copies are identical, so order is
immaterial). `buildInitialGameState.ts` registers the well-known card stats:

```ts
cardStats['pile-shield-officer'] = { attack: 0, recruit: 2, cost: 3, fightCost: 0, ... }
```

Here `cost: 3` is the **buy price** and `recruit: 2` is the **+2 Recruit the
Officer produces when played**. `buildCardDisplayData.ts` sets the token's
display `cost` to `null` (a supply token has no printed cost on its physical
face) — the authoritative buy price lives in `cardStats`, not the display
payload.

### Recruiting an Officer (`recruitOfficer`)

`recruitOfficer` ([`moves/recruitOfficer.ts`](../packages/game-engine/src/moves/recruitOfficer.ts))
is a **non-core, internally-stage-gated** move — the same class as
[`recruitHero`](../packages/game-engine/src/moves/recruitHero.ts). It is **not**
in `CoreMoveName` / `CORE_MOVE_NAMES` / `MOVE_ALLOWED_STAGES`; it gates itself.
It takes **no arguments** (every Officer is identical, so there is no slot or
index to choose). It follows the three-step move contract:

1. **Validate** — the supply must be non-empty; the current-player zone must
   exist; `getAvailableRecruit(G.turnEconomy)` must be `>=` the cost. The cost
   is `G.cardStats['pile-shield-officer'].cost ?? OFFICER_RECRUIT_COST`, where
   the exported `OFFICER_RECRUIT_COST = 3` is the fallback for narrow test
   mocks. The gate is on the **cost (3)**, never the Officer's play-value
   (`recruit: 2`).
2. **Stage gate** — `G.currentStage !== 'main'` returns. Then the **full
   block-all pending-guard set** (identical to `recruitHero`) plus the D-24180
   heal-lock (`hasHealedThisTurn`) — a player who used the Wound Healing
   ability this turn may not recruit.
3. **Mutate** — `G.piles.officers = G.piles.officers.slice(1)` (drop the top
   token), append it to the current player's `discard`, `spendRecruit(cost)`,
   set `G.hasActedThisTurn = true` (which, per D-24180, bars Healing for the
   rest of the turn), and push one replay-visible log line.

Every failure branch (empty supply, missing zone, insufficient Recruit, wrong
stage, a parked interactive choice, the heal-lock) is a **deterministic silent
no-op** — moves never throw.

There is **no per-turn limit** on Officer recruits (unlike Sidekicks): you may
buy as many as you can afford. `recruitOfficer` is registered in
[`game.ts`](../packages/game-engine/src/game.ts) as `client: false` (D-10008;
it mutates real `G`).

### Gaining an Officer from a card effect

The `gain-officer-current` primitive
(`villainEffectGainOfficerCurrent` in
[`villain/villainEffects.execute.ts`](../packages/game-engine/src/villain/villainEffects.execute.ts),
WP-541 / D-24350) is the **free** path: it moves `G.piles.officers[0]` to the
current player's discard with no cost and no stage gate, auto-resolving because
"may gain an Officer" is a pure benefit. An empty supply is a logged no-op. The
`recruitOfficer` move and `gain-officer-current` share the same pile→discard
mutation; only `recruitOfficer` charges Recruit and gates to the Main step.

### Client affordance

In the arena client, the **S.H.I.E.L.D. Officers** cell of
[`SharedDecks.vue`](../apps/arena-client/src/components/play/SharedDecks.vue)
renders as a recruit **button** that shows the **actual Officer card face** — a
[`CardTile`](../apps/arena-client/src/components/play/CardTile.vue) painted from
the engine-projected `piles.officerDisplay`, above the supply count and buy cost.
This is what tells the player the cell is a **shop**: the other four supply cells
(Wounds / Horrors / Bystanders / Sidekicks) stay bare count text, so an Officers
cell that also read as a bare count looked face-down and players did not realise
they could recruit from it. When `officerDisplay` is absent (older snapshots) or
the card image fails to load, the tile falls back to a text card face — never a
broken image.

The card face reaches the client through the standard projection contract, not a
new client-side registry lookup:

- `UISharedPilesState.officerDisplay`
  ([`uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)) is the
  optional `UICardDisplay` field.
- [`buildUIState`](../packages/game-engine/src/ui/uiState.build.ts) §11 always
  populates it via `resolveDisplay(SHIELD_OFFICER_EXT_ID, gameState)` — a fresh,
  non-aliased copy of `G.cardDisplayData['pile-shield-officer']` (the same
  `name` / `imageUrl` `buildCardDisplayData.ts` resolves from the core Officer
  art), falling back to the `<unknown>` placeholder for narrow mocks.
- [`filterUIStateForAudience`](../packages/game-engine/src/ui/uiState.filter.ts)
  passes it through **public** (the Officer's identity is fixed and
  information-safe) with an aliasing-safe conditional spread.

The button's enabled/disabled state follows the locked tooltip precedence:

- **turn → stage** via `useTurnActions(...).canRecruitOfficer()`
  ([`useTurnActions.ts`](../apps/arena-client/src/composables/useTurnActions.ts)),
- **resource** — `economy.availableRecruit >= 3`,
- **structural** — `piles.officersCount > 0`.

Because the Officer token's `UICardDisplay.cost` is `null`, the generic
`useCardCostGating.canRecruit` path is **not** reused — `SharedDecks` reads the
engine's exported `OFFICER_RECRUIT_COST`. Clicking dispatches `recruitOfficer`
with an empty payload; the engine re-validates authoritatively.

## Interactions

- **Recruit economy.** An Officer buy spends 3 Recruit via `spendRecruit`,
  exactly like an HQ Hero recruit. When later played from hand, the Officer
  adds +2 Recruit through the same base-economy path as any card.
- **Heal-lock (D-24180).** A successful `recruitOfficer` sets
  `hasActedThisTurn`, which bars the Wound "Healing" ability for the rest of
  the turn — and conversely, a player who already healed this turn cannot
  recruit an Officer. See [Wounds](wounds.md).
- **Replay.** `recruitOfficer` is dispatchable in `replay.execute`, so a
  recorded human game that buys an Officer replays deterministically.
- **Scoring.** An Officer is worth 0 Victory Points; it is a pure Recruit-ramp
  card. See [Scoring](scoring.md).
- **Card class.** S.H.I.E.L.D. Officers count as Heroes of the S.H.I.E.L.D.
  class for any effect that reads Hero class (rules v23).

## Edge Cases

- **Buy cost is 3, play-value is 2.** These are different numbers on the same
  token: `cost: 3` (what you pay) vs `recruit: 2` (what it gives when played).
  The recruit gate keys on **cost**. Surfacing the +2 play-value as the price
  is exactly the bug WP-648 fixed.
- **No per-turn limit.** Officers may be bought repeatedly in one turn, unlike
  Sidekicks (which the canonical rules limit to once per turn using Recruit).
  Sidekick recruiting is not yet implemented.
- **Empty supply.** With `officersCount` exhausted, the client button disables
  ("No S.H.I.E.L.D. Officers remain in the supply.") and the engine move is a
  silent no-op.
- **Not simulated.** `recruitOfficer` is deliberately kept **out** of the
  simulation move-set (`SIMULATION_MOVE_NAMES`), so the competent-AI / PAR
  bot never buys Officers. This keeps every determinism oracle
  (`finalStateHash`, `PRE_WP080_HASH`, the sentinel fixture, `sim:runtime-observed`,
  Seed-PAR) byte-identical. Teaching the bot to buy Officers is a deferred
  follow-up that would move the PAR/sentinel surfaces.
- **Display cost is null.** The token's `UICardDisplay.cost` is `null` by
  design (a supply token has no printed cost); the buy price is a game
  constant, not a card-face value.

## Code Touchpoints

- [`packages/game-engine/src/moves/recruitOfficer.ts`](../packages/game-engine/src/moves/recruitOfficer.ts)
  — the `recruitOfficer` move + `OFFICER_RECRUIT_COST`
- [`packages/game-engine/src/moves/recruitOfficer.test.ts`](../packages/game-engine/src/moves/recruitOfficer.test.ts)
  — move coverage
- [`packages/game-engine/src/setup/pilesInit.ts`](../packages/game-engine/src/setup/pilesInit.ts)
  — `SHIELD_OFFICER_EXT_ID`, supply seeding
- [`packages/game-engine/src/setup/buildInitialGameState.ts`](../packages/game-engine/src/setup/buildInitialGameState.ts)
  — the `cardStats` entry (`cost: 3`, `recruit: 2`)
- [`packages/game-engine/src/villain/villainEffects.execute.ts`](../packages/game-engine/src/villain/villainEffects.execute.ts)
  — `villainEffectGainOfficerCurrent` (the free `gain-officer-current` path)
- [`packages/game-engine/src/game.ts`](../packages/game-engine/src/game.ts)
  — move registration (`client: false`)
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — the `UISharedPilesState.officerDisplay` field
- [`packages/game-engine/src/ui/uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts)
  — §11 projects `officerDisplay` via `resolveDisplay`
- [`packages/game-engine/src/ui/uiState.filter.ts`](../packages/game-engine/src/ui/uiState.filter.ts)
  — public, aliasing-safe pass-through of `officerDisplay`
- [`apps/arena-client/src/components/play/SharedDecks.vue`](../apps/arena-client/src/components/play/SharedDecks.vue)
  — the recruit button + gate + Officer card face
- [`apps/arena-client/src/components/play/CardTile.vue`](../apps/arena-client/src/components/play/CardTile.vue)
  — renders the card face (image, with text fallback)
- [`apps/arena-client/src/composables/useTurnActions.ts`](../apps/arena-client/src/composables/useTurnActions.ts)
  — `canRecruitOfficer`

## History

- WP-541 / D-24350: `gain-officer-current` villain-effect primitive — HYDRA
  Kidnappers' *"Fight: You may gain a S.H.I.E.L.D. Officer."* (the free,
  card-effect path)
- WP-648 / D-24460 (2026-09-04): player-initiated `recruitOfficer` move (buy an
  Officer from the supply for 3 Recruit during Main) + the `SharedDecks`
  recruit button; closes the reported "can't recruit shield officers" bug.
  Deliberately kept out of the simulation move-set so no determinism oracle
  moves; the AI/PAR officer-buy heuristic is a deferred follow-up
- INFRA (2026-09-05, [PR #1828](https://github.com/barefootbetters/legendary-arena/pull/1828)):
  project the Officer card face onto `UISharedPilesState.officerDisplay` and
  render it as a `CardTile` in the Officers cell, so the recruitable supply
  reads as a card rather than a bare count. Follows the Board-Visible Field Rule
  five-step contract (type → build → filter → filter test → build/drift tests);
  no engine behaviour or determinism oracle moves — projection + client only

## References

- [`docs/legendary-universal-rules-v23.md`](../docs/legendary-universal-rules-v23.md)
  — §"HQ": "You can also recruit 'S.H.I.E.L.D. Officer' Heroes from the
  S.H.I.E.L.D. Officer stack"; core Officer costs 3 and provides +2 Recruit;
  no per-turn limit (unlike Sidekicks)
- [`docs/ai/DECISIONS.md`](../docs/ai/DECISIONS.md) — D-24460 (this feature),
  D-24350 (`gain-officer-current`), D-24180 (the heal-lock), D-10008
  (`client: false` move registration)
- [Wounds](wounds.md), [Card Type Taxonomy](card-type-taxonomy.md)
