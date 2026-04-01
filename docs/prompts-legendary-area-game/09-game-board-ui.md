# Prompt 09 — Game Board UI

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. No game logic in components. No boardgame.io imports in components.
> All moves dispatched through gameStore. Disabled states must be visually obvious.
> No animations in this prompt.

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

## Deliverables

### 0. Shared card registry accessor (`apps/registry-viewer/src/game/cardRegistry.js`)

Export:
- `getCardBySlug(slug)` → `{ slug, type, setAbbr, displayName, cost?, imgUrl } | null`
- `getImageUrl({ type, setAbbr, slug, sequence? })` — constructs R2 WebP URL using
  the naming convention: `https://images.barefootbetters.com/{setAbbr}/{typePrefix}_{slug}.webp`
  Type prefixes: `mm` (mastermind), `vi` (villain), `hr` (hero + sequence `_1`–`_4`)

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
Props: `{ mastermindsSlug, strikeCount, timesDefeated }`

Display:
- Card image via `cardRegistry.getImageUrl`
- Strike health bar (e.g., filled/empty hearts representing `timesDefeated/strikeCount`)
- "Fight Mastermind" button — emits `fight` event
- Button disabled if not current player's turn OR insufficient fight points
  (pass `canFight: boolean` as a prop — do not access game store directly)

### 3. `CityRow.vue`
Props: `{ slots: Array<{ slug, setAbbr } | null> }` (5 elements)

Display:
- Occupied slot: villain card image
- Empty slot: card back placeholder
- Click emits `fight(slotIndex)` event
- Visual warning on rightmost occupied slot: "Escapes next turn"

### 4. `PlayerHand.vue`
Props: `{ cards: Array<{ slug, setAbbr }>, isActivePlayer, recruitPoints, fightPoints }`

Display:
- Each card with image and name resolved via `cardRegistry`
- Click on card emits `play(cardSlug)` — disabled if not active player
- "End Turn" button emits `endTurn` — disabled if not active player

### 5. `HeroHeadquarters.vue`
Props: `{ cards: Array<{ slug, setAbbr }>, recruitPoints }`

Display:
- 6 hero cards available to recruit
- Each card shows its recruit cost (from `cardRegistry`)
- Click emits `recruit(cardSlug)` — disabled if cost > recruitPoints
- Cards player cannot afford are visually grayed out (opacity, not hidden)

### 6. `StatusBar.vue`
Props: `{ recruitPoints, fightPoints, deckSize, discardSize, playerName, isActivePlayer }`

Single-row display of current player resources and deck state.
Highlight entire bar when `isActivePlayer` is true.

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
