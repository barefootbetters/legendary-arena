# Prompt 09 — Game Board UI

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. No game logic in components. No boardgame.io imports in components.
> All moves dispatched through gameStore. Disabled states must be visually obvious.
> No animations in this prompt.
> Human-style code: explicit, readable, junior-maintainable. See `00.6-code-style.md`.

## Assumes
- Prompt 08 complete: game store exists, boardgame.io client connects
- Card metadata (display names, image URLs) available in R2 and already cached
  by the existing SPA per-set registry system
- Vue 3 + Vite

---

## Role
Build the in-game UI for Legendary Arena. Prioritize clarity and correctness
over polish. No animations.

---

## Critical Data Rule

Game state contains **slugs only**. The UI must resolve display names and image
URLs through ONE shared registry module. Components must NOT fetch R2 JSON
independently. If a slug cannot be resolved, show a graceful placeholder
(card back or "Unknown card" label) — never crash.

---

## Code Style Mandate

All output must follow `00.6-code-style.md`. Key rules for this prompt:

- **Component scripts use explicit `const` declarations** — resolve the card
  object on its own line before passing it to the template. Do not chain
  registry lookups inline in the template.
  ```vue
  <!-- BAD — logic buried in template -->
  <img :src="cardRegistry.getImageUrl({ type: 'hero', setAbbr: card.setAbbr, slug: card.slug })" />

  <!-- GOOD — resolved in script, named clearly -->
  <!-- In <script setup>: -->
  <!-- const heroImageUrl = getImageUrl({ type: 'hero', setAbbr: props.card.setAbbr, slug: props.card.slug }); -->
  <img :src="heroImageUrl" loading="lazy" :alt="heroDisplayName" />
  ```
- **Props are typed explicitly** — every prop has a `type` and `required` or
  `default`. No shorthand `props: ['foo', 'bar']`.
- **Computed properties have descriptive names** — `canCurrentPlayerFight`,
  `hasInsufficientFightPoints`, not `canFight`, `noFP`.
- **Emit events are listed explicitly** — no catch-all `$emit`. Define the
  `emits` option with every event name.
- **Disabled logic is a named computed property** — not an inline expression
  in `:disabled`. This makes it greppable and testable.
  ```js
  const isFightButtonDisabled = computed(() => {
    return !props.isCurrentPlayerTurn || !props.canFight;
  });
  ```
- **No `v-if` and `v-for` on the same element** — use a wrapping `<template>`.
- **`// why:` comments** on placeholder behavior and the `loading="lazy"` attribute.

---

## Deliverables

### 0. Shared card registry accessor (`apps/registry-viewer/src/game/cardRegistry.js`)

Export as plain named functions (not a class, not a default-export object):
- `function getCardBySlug(slug)` → `{ slug, type, setAbbr, displayName, cost?, imgUrl } | null`
- `function getImageUrl({ type, setAbbr, slug, sequence })` — constructs R2 WebP URL
  using the naming convention: `https://images.barefootbetters.com/{setAbbr}/{typePrefix}_{slug}.webp`
  Type prefixes: `mm` (mastermind), `vi` (villain), `hr` (hero + sequence `_1`–`_4`)

Each function has a JSDoc comment. The `getImageUrl` function builds the URL
with explicit string concatenation (not a template literal with embedded logic).
If `type` is unrecognized, return `null` and log a full-sentence warning — do not throw.

This module reads from the SPA's existing cached registry data — do not add new
server endpoints.

---

### 1. `GameBoardView.vue` (route `/play/:matchID`)
- On mount: read `matchID` from route params, call `gameStore.joinGame()`
- On unmount: call `gameStore.leaveGame()`
- Show loading spinner while `!gameStore.isConnected`
- Show game-over overlay when `ctx.gameover` is set, displaying winner
- Delegate layout to sub-components — no layout logic in this view

### 2. `MastermindsCard.vue`
Props (typed, required/default explicit):
- `mastermindsSlug: String, required: true`
- `strikeCount: Number, required: true`
- `timesDefeated: Number, required: true`
- `canFight: Boolean, required: true`
- `isCurrentPlayerTurn: Boolean, required: true`

Computed:
- `mastermindsCard` — resolved via `getCardBySlug(props.mastermindsSlug)`, or `null`
- `mastermindsImageUrl` — resolved via `getImageUrl(...)`, or placeholder
- `isFightButtonDisabled` — `!props.isCurrentPlayerTurn || !props.canFight`

Display:
- Card image via `mastermindsImageUrl`
- Strike health bar (filled/empty hearts: `timesDefeated` of `strikeCount`)
- "Fight Mastermind" button emits `'fight'` event
- Button disabled when `isFightButtonDisabled` is true — visually grayed out

### 3. `CityRow.vue`
Props:
- `slots: Array, required: true` (5 elements of `{ slug, setAbbr } | null`)

Computed:
- `resolvedSlots` — each slot mapped to `{ cardData, imageUrl, isEmpty }` using
  explicit `for...of` loop, not `.map()`

Display:
- Occupied slot: villain card image
- Empty slot: card back placeholder
- Click emits `'fight'` with `slotIndex`
- Visual warning on rightmost occupied slot: "Escapes next turn"

### 4. `PlayerHand.vue`
Props:
- `cards: Array, required: true`
- `isActivePlayer: Boolean, required: true`
- `recruitPoints: Number, required: true`
- `fightPoints: Number, required: true`

Emits: `'play'` (with cardSlug), `'endTurn'`

Computed:
- `isEndTurnDisabled` — `!props.isActivePlayer`
- Each card's image and name resolved in `resolvedCards` computed using an
  explicit `for...of` loop

### 5. `HeroHeadquarters.vue`
Props:
- `cards: Array, required: true`
- `recruitPoints: Number, required: true`

Emits: `'recruit'` (with cardSlug)

Computed:
- `resolvedCards` — each card with `canAfford: recruitPoints >= card.cost`
  computed explicitly in a `for...of` loop

Display:
- Cards the player cannot afford are visually grayed out (opacity, not hidden)
- Click emits `'recruit'` only if `canAfford` is true

### 6. `StatusBar.vue`
Props:
- `recruitPoints: Number, required: true`
- `fightPoints: Number, required: true`
- `deckSize: Number, required: true`
- `discardSize: Number, required: true`
- `playerName: String, required: true`
- `isActivePlayer: Boolean, required: true`

Display:
- Single-row display of current player resources and deck state
- Highlighted when `isActivePlayer` is true

---

## Operational Notes (answer directly)

1. **Card data loading**: Game store holds slugs. Where and when is the R2 JSON
   fetched? Is it fetched once at app load, or on-demand per slug? The answer
   must not require a new API endpoint.

2. **Hidden information**: Other players' hands are not in `G` (boardgame.io
   supports secret state via `playerView`). Describe briefly what the current
   player sees vs. what a spectator would see, and how boardgame.io handles this.

---

## Hard Constraints

- No game logic in components — all moves dispatched through `gameStore.move()`
- No boardgame.io imports in components
- No direct store access in child components — pass state as props, emit events up
- Card images loaded lazily: `<img loading="lazy" ...>`
- Disabled states must be visually obvious — not just functionally blocked
- No animations in this prompt
- **All props are typed with explicit `type` and `required` or `default`**
- **All computed properties have descriptive names** — no single-letter or
  abbreviated names
- **`emits` option is defined explicitly** on every component that emits events
- **Disabled logic is a named computed property** — never an inline expression in `:disabled`
- **Registry lookups resolved in `<script setup>`**, not in template expressions
- **`resolvedCards`/`resolvedSlots` use explicit `for...of` loops**, not `.map()`
- **No `v-if` and `v-for` on the same element**
- **`// why:` comments** on placeholder fallback, `loading="lazy"`, and
  any non-obvious Vue reactivity pattern
