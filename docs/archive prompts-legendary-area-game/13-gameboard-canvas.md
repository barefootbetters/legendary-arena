# Prompt 13 — Gameboard Canvas Mockup (Konva.js)

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. No game logic in canvas components. All moves dispatched
> through gameStore. No animations in this prompt. Konva.js only — no vue-konva.
> ESM only. Node v22+.
> Human-style code: explicit, readable, junior-maintainable. See `00.6-code-style.md`.
> Use real card model field names throughout — not simplified display-only names.

## Assumes

- Prompts 08–09 complete: game store exists, `cardRegistry.js` exists,
  `GameBoardView.vue` exists as a stub at route `/play/:matchID`
- `src/game/state.mjs` defines the `G` typedef (from Prompt 04)
- Konva.js is NOT yet installed — this prompt installs it
- Vue 3 + Vite SPA at `apps/registry-viewer/`
- Card images exist at `https://images.barefootbetters.com/{setAbbr}/{typePrefix}_{slug}.webp`
- Real card data may be available at
  `src/lib/master-strike-data/dist/definitions/cards/*` and
  `src/lib/master-strike-data/dist/metadata/*` — attempt to import these first

---

## Role

You are implementing the visual game board for Legendary Arena using Konva.js —
a canvas rendering library. This prompt produces a **mockup**: the board is
fully drawn and interactive, but uses placeholder rectangles when card images
have not yet loaded. The mockup must correctly reflect live game state (`G`)
passed in as props, so it can be swapped in as a direct replacement for the
component stubs from Prompt 09.

The canvas renders using **real card model fields** — not simplified placeholder
shapes. Card types, rarities, keywords, and special flags are all visible on the
board. When a player clicks a card, a Card Details Modal opens showing the full
card record using ID-based lookup tables.

---

## What This Phase Adds

Prompt 09 built Vue component stubs (`CityRow.vue`, `PlayerHand.vue`, etc.)
using HTML/CSS. This prompt replaces the rendering inside `GameBoardView.vue`
with a single Konva canvas that draws the entire board. The game store, move
dispatch, and data flow are unchanged — only the rendering layer changes.

The HTML component stubs from Prompt 09 are **not deleted** — they remain as
fallback reference. The Konva canvas is mounted inside `GameBoardView.vue`
alongside a toggle that swaps between the two renderers during development.

Beyond basic rendering, this phase adds:
- Real card model field names (`cardId`, `setId`, `rarityId`, `cardTypeId`, etc.)
  used throughout every draw function and modal
- `boardLookups.js` — ID-to-display-name lookup tables, loaded from real project
  modules if available, otherwise from embedded fallback data matching the real shape
- `CardDetailsModal.vue` — HTML overlay (not Konva) showing full card record when
  any card on the board is clicked
- Rarity-colored card borders, keyword badges, and special flag indicators drawn
  on canvas cards
- A data source indicator badge showing whether real modules or fallback data is in use

---

## Real Card Data Model

### Field names (use these throughout — do not invent alternatives)

The canonical card model uses these field names. Every draw function, every
JSDoc typedef, and every modal that references card data must use exactly
these names:

```js
/**
 * @typedef {Object} CardModel
 * @property {string}   cardId        — unique card identifier (primary key)
 * @property {string}   slug          — URL-safe name, used for image construction
 * @property {string}   name          — display name shown to players
 * @property {string}   setId         — references setsById lookup
 * @property {string}   teamId        — references teamsById lookup (null for non-hero cards)
 * @property {string}   cardTypeId    — references cardTypesById lookup
 * @property {string}   rarityId      — references raritiesById lookup
 * @property {string|null} heroClassId — references heroClassesById lookup (heroes only)
 * @property {string[]} keywords      — array of keyword IDs, each references keywordsById
 * @property {number|null} cost       — recruit cost (heroes in HQ)
 * @property {number|null} attack     — fight/attack value (heroes, villains, masterminds)
 * @property {number|null} recruit    — recruit points generated (heroes)
 * @property {string|null} rulesText  — card effect rules text
 * @property {boolean} isAlwaysLeads  — true if mastermind always leads a villain group
 * @property {boolean} isEpic        — true if this is an epic variant card
 * @property {boolean} isTransform   — true if this card has a transform/flip side
 */
```

### Lookup table shapes (use these — do not invent generic alternatives)

```js
// setsById[setId] = { name, abbr, releaseYear }
// teamsById[teamId] = { name, abbr }
// raritiesById[rarityId] = { name, color }  ← color used for card border
// heroClassesById[heroClassId] = { name }
// cardTypesById[cardTypeId] = { displayName, category }
//   category is one of: 'hero' | 'villain' | 'mastermind' | 'scheme'
//                       | 'bystander' | 'henchman' | 'wound' | 'strike'
// keywordsById[keywordId] = { name }
```

### ID-to-color mapping for rarities

These colors are used for the card border stroke on the canvas:

| rarityId | color |
|---|---|
| `'common'` | `#888888` (gray) |
| `'uncommon'` | `#4a9a4a` (green) |
| `'rare'` | `#4a6ae2` (blue) |
| `'epic'` | `#9a4ae2` (purple) |
| `'legendary'` | `#e2a84a` (gold) |

These colors are constants in `boardLayout.js` — not hard-coded in draw functions.

### Data source strategy

`boardLookups.js` must attempt to import real data first, then fall back gracefully:

```js
// Strategy:
// 1. Try dynamic import() from real module paths
// 2. If import fails (module not found, plain HTML context, etc.),
//    use embedded fallback objects that match the exact model shape
// 3. Export DATA_SOURCE = 'local-modules' or DATA_SOURCE = 'fallback-sample'
//    so the UI can display which source is active
```

Fallback sample data must include at least 25 cards covering all card type
categories: hero, villain, mastermind, scheme, bystander, henchman, wound, strike.
Every fallback card must use the real field names above — not simplified alternatives.

### Card model validation

`boardLookups.js` must export a `validateCardShape(card)` function that checks
for required fields and returns an array of missing field names (empty array = valid).
`GameBoardCanvas.vue` calls this on the first card from the dataset at mount time
and shows a developer-facing warning banner in the UI if validation fails.

Required fields for validation: `cardId`, `name`, `setId`, `cardTypeId`, `rarityId`.

---

## Marvel Legendary Board Layout

The board is divided into named zones. Every zone has a fixed logical position
defined in `boardLayout.js`. The logical canvas size is **1600 × 960 px**
(16:10 aspect ratio). The stage scales proportionally to fit the viewport.

```
┌─────────────────────────────────────────────────────────────┐
│  MASTERMIND ZONE    │  SCHEME ZONE   │  VILLAIN DECK ZONE   │
│  (card + tactics)   │  (card + twists│  (face-down stack)   │
├─────────────────────┴────────────────┴──────────────────────┤
│  CITY ROW  [ slot 0 ] [ slot 1 ] [ slot 2 ] [ slot 3 ] [ slot 4 → ESCAPES ]
├─────────────────────────────────────────────────────────────┤
│  HQ ZONE  [ 0 ] [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]  HERO DECK  │
├─────────────────────────────────────────────────────────────┤
│  ESCAPE PILE  │  BYSTANDER POOL  │  KO PILE   │  INFO BAR   │
├─────────────────────────────────────────────────────────────┤
│  PLAYER HAND (current player — face up)                     │
│  Player deck  │  Discard pile  │  Recruit pts  │  Fight pts │
└─────────────────────────────────────────────────────────────┘
```

For multiplayer (2–5 players), other players' hand areas appear as compact
rows of face-down card backs above the current player's hand area.
The layout shrinks each opponent row proportionally — define the heights as
named constants so they can be adjusted.

---

## Three-Layer Architecture

### Layer 0 — Background (`backgroundLayer`)

Rendered once on mount. Never redrawn unless the window resizes.

Contents:
- Full-board fill rectangle in board background color (`BOARD_BACKGROUND_COLOR`)
- Outer border rectangle with a contrasting stroke (`BOARD_BORDER_COLOR`)
- Subtle texture: a repeating `Konva.Rect` grid pattern drawn in a slightly
  lighter shade to suggest felt/baize — drawn as a grid of small squares,
  not a CSS texture
- Board title text: "Legendary Arena" in the top-left margin

### Layer 1 — Zones and Overlays (`zonesLayer`)

Redrawn whenever the game phase changes or the active player changes.
Never redrawn on every card move — only on structural state changes.

Contents:
- One `Konva.Rect` per zone (rounded corners, zone fill color, subtle border)
- One `Konva.Text` label per zone (zone name, e.g. "City", "HQ", "Mastermind")
- City slot dividers: vertical `Konva.Line` between each of the 5 city slots
- HQ slot outlines: dashed `Konva.Rect` for each of the 6 HQ positions
- Active player highlight: a colored border around the current player's hand area
- "Escapes next turn" warning: a red `Konva.Rect` overlay on city slot 4
  (the rightmost slot) — only shown when that slot is occupied
- Escape count badge: small `Konva.Text` + `Konva.Rect` showing `escapedVillains.length`
  in the escape pile zone
- Turn phase label: current phase name displayed in the info bar zone
- **Data source badge**: small pill label in the info bar zone showing
  `DATA_SOURCE` value from `boardLookups.js` — "Local Modules" or "Fallback Sample"
  — drawn in green or amber respectively
- Dev-mode grid: when `import.meta.env.DEV` is true, draw zone boundaries
  in a bright color with coordinate labels to aid layout debugging

### Layer 2 — Cards, Tokens, Counters, Labels (`cardsLayer`)

Redrawn on every `G` state change. This is the hot layer.

Each visible card is drawn as a `Konva.Group` using real `CardModel` fields:
- **Border color** derived from `rarityId` → `raritiesById[rarityId].color`
  (not a generic color — must use the rarity lookup)
- **Cost/attack/recruit badges** drawn only when non-null for that `cardTypeId`
- **Keyword badges**: first 2 keywords from `keywords[]` shown as small pill labels
  (mapped through `keywordsById`); if there are more, show a `+N` badge
- **Special flag badges**: "ALWAYS LEADS" if `isAlwaysLeads`, "EPIC" if `isEpic`,
  "TRANSFORM" if `isTransform` — each as a small colored text badge on the card
- **Card type tint**: a subtle background tint on the placeholder rectangle
  based on `cardTypesById[cardTypeId].category`:
  - hero → dark blue tint
  - villain → dark red tint
  - mastermind → dark purple tint
  - scheme → dark teal tint
  - bystander/henchman/wound/strike → dark gray tint

Full list of Layer 2 contents:
- **Mastermind card**: `Konva.Group` with image/placeholder + name + "ALWAYS LEADS"
  badge if `isAlwaysLeads` + strike health bar (filled/empty pips)
- **Scheme card**: `Konva.Group` with image/placeholder + name + twist counter badge
- **Villain deck**: face-down card stack (3 staggered rects implying depth) + count label
- **City slots**: each a `Konva.Group` — villain card with rarity border + type tint
  OR empty slot indicator (dashed outline)
- **HQ cards**: 6 `Konva.Group` nodes — hero card with rarity border + cost badge
  top-left + first 2 keywords as pills
- **Hero deck**: face-down stack + count label
- **Player hand** (current player): face-up cards with rarity borders + cost badges
- **Opponent hands**: compact rows of face-down card backs
- **Recruit point counter**: coin icon (`Konva.Circle`) + numeric label
- **Fight point counter**: sword icon (simple `Konva.Line` cross shape) + numeric label
- **Deck/discard/KO size badges**: `Konva.Text` + background on each pile
- **Bystander pool**: stacked token circles + count
- **Player name labels**: `Konva.Text` above each player area

---

## Deliverables

### 1. Board layout constants (`apps/registry-viewer/src/game/boardLayout.js`)

A plain JavaScript module — no class, no factory. All values are named constants.

Define:

```js
// Canvas logical size — the stage always renders at this size,
// then scales to fit the viewport.
export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 960;
export const BOARD_PADDING = 16;

// Card dimensions (all cards are the same logical size)
export const CARD_WIDTH = 100;
export const CARD_HEIGHT = 140;
export const CARD_CORNER_RADIUS = 6;

// Zone rectangles — each is { x, y, width, height }
// These are the logical positions BEFORE any viewport scaling.
export const MASTERMIND_ZONE   = { x: 16,   y: 16,  width: 220,  height: 200 };
export const SCHEME_ZONE       = { x: 252,  y: 16,  width: 220,  height: 200 };
export const VILLAIN_DECK_ZONE = { x: 1364, y: 16,  width: 220,  height: 200 };
export const CITY_ZONE         = { x: 16,   y: 232, width: 1568, height: 180 };
export const HQ_ZONE           = { x: 16,   y: 428, width: 1364, height: 200 };
export const HERO_DECK_ZONE    = { x: 1396, y: 428, width: 188,  height: 200 };
export const ESCAPE_ZONE       = { x: 16,   y: 644, width: 320,  height: 120 };
export const BYSTANDER_ZONE    = { x: 352,  y: 644, width: 320,  height: 120 };
export const KO_ZONE           = { x: 688,  y: 644, width: 320,  height: 120 };
export const INFO_BAR_ZONE     = { x: 1024, y: 644, width: 560,  height: 120 };
export const PLAYER_HAND_ZONE  = { x: 16,   y: 780, width: 1568, height: 164 };

// City slot positions — listed explicitly, one per slot
// Do NOT compute these with a loop — list each one explicitly.
export const CITY_SLOT_0 = { x: 32,   y: 248, width: 292, height: 148 };
export const CITY_SLOT_1 = { x: 340,  y: 248, width: 292, height: 148 };
export const CITY_SLOT_2 = { x: 648,  y: 248, width: 292, height: 148 };
export const CITY_SLOT_3 = { x: 956,  y: 248, width: 292, height: 148 };
export const CITY_SLOT_4 = { x: 1264, y: 248, width: 292, height: 148 }; // rightmost — escapes from here

// HQ slot positions — 6 slots, listed explicitly
export const HQ_SLOT_0 = { x: 32,   y: 444, width: 210, height: 168 };
export const HQ_SLOT_1 = { x: 258,  y: 444, width: 210, height: 168 };
export const HQ_SLOT_2 = { x: 484,  y: 444, width: 210, height: 168 };
export const HQ_SLOT_3 = { x: 710,  y: 444, width: 210, height: 168 };
export const HQ_SLOT_4 = { x: 936,  y: 444, width: 210, height: 168 };
export const HQ_SLOT_5 = { x: 1162, y: 444, width: 210, height: 168 };

// Opponent hand row heights (for 2–5 player layouts)
// Listed explicitly — do not compute in a loop.
export const OPPONENT_ROW_HEIGHT_1_OPPONENT = 60;  // 2 players total
export const OPPONENT_ROW_HEIGHT_2_OPPONENTS = 50; // 3 players total
export const OPPONENT_ROW_HEIGHT_3_OPPONENTS = 44; // 4 players total
export const OPPONENT_ROW_HEIGHT_4_OPPONENTS = 38; // 5 players total

// Color palette — board and zone colors
export const BOARD_BACKGROUND_COLOR = '#1a3a1a';
export const BOARD_BORDER_COLOR     = '#4a2c0a';
export const ZONE_FILL_COLOR        = '#0f2a0f';
export const ZONE_STROKE_COLOR      = '#2d5a2d';
export const ACTIVE_PLAYER_HIGHLIGHT_COLOR = '#f0c040';
export const ESCAPE_WARNING_COLOR   = '#cc2200';
export const CARD_PLACEHOLDER_COLOR = '#2a4a2a';
export const CARD_PLACEHOLDER_STROKE = '#4a7a4a';
export const TEXT_COLOR_PRIMARY     = '#e8e8e8';
export const TEXT_COLOR_SECONDARY   = '#a0c0a0';
export const RECRUIT_POINT_COLOR    = '#4a90e2';
export const FIGHT_POINT_COLOR      = '#e24a4a';

// Rarity border colors — keyed to rarityId values from the card model
// These match raritiesById[rarityId].color in the lookup tables.
export const RARITY_COLOR_COMMON    = '#888888';
export const RARITY_COLOR_UNCOMMON  = '#4a9a4a';
export const RARITY_COLOR_RARE      = '#4a6ae2';
export const RARITY_COLOR_EPIC      = '#9a4ae2';
export const RARITY_COLOR_LEGENDARY = '#e2a84a';

// Card type background tint colors — keyed to cardTypesById[cardTypeId].category
export const CARD_TINT_HERO       = '#0a1a3a';
export const CARD_TINT_VILLAIN    = '#3a0a0a';
export const CARD_TINT_MASTERMIND = '#2a0a3a';
export const CARD_TINT_SCHEME     = '#0a2a2a';
export const CARD_TINT_OTHER      = '#1a1a1a'; // bystander, henchman, wound, strike

// Data source badge colors
export const DATA_SOURCE_LOCAL_COLOR    = '#2a7a2a';  // green — real modules loaded
export const DATA_SOURCE_FALLBACK_COLOR = '#8a6a00';  // amber — fallback sample in use
```

### 2. Card data lookups and fallback (`apps/registry-viewer/src/game/boardLookups.js`)

A plain JavaScript module. No class. Named functions and constants only.

**Import strategy** (written as sequential `if/else` blocks — not a try/catch chain):

```js
// why: Real module paths may not exist in all environments (e.g., plain HTML,
// early dev setup). We attempt the import once and record which source succeeded.

let setsById = null;
let teamsById = null;
let raritiesById = null;
let heroClassesById = null;
let cardTypesById = null;
let keywordsById = null;

export let DATA_SOURCE = 'fallback-sample';

async function tryLoadRealModules() {
  try {
    const setsModule = await import('../../lib/master-strike-data/dist/metadata/sets.js');
    const teamsModule = await import('../../lib/master-strike-data/dist/metadata/teams.js');
    const raritiesModule = await import('../../lib/master-strike-data/dist/metadata/rarities.js');
    const heroClassesModule = await import('../../lib/master-strike-data/dist/metadata/heroClasses.js');
    const cardTypesModule = await import('../../lib/master-strike-data/dist/metadata/cardTypes.js');
    const keywordsModule = await import('../../lib/master-strike-data/dist/metadata/keywords.js');

    setsById       = setsModule.setsById;
    teamsById      = teamsModule.teamsById;
    raritiesById   = raritiesModule.raritiesById;
    heroClassesById = heroClassesModule.heroClassesById;
    cardTypesById  = cardTypesModule.cardTypesById;
    keywordsById   = keywordsModule.keywordsById;

    DATA_SOURCE = 'local-modules';
  } catch (importError) {
    // why: Import fails when real modules don't exist yet. We fall back silently
    // and the DATA_SOURCE badge on the board tells the developer which is active.
    useFallbackData();
  }
}
```

`tryLoadRealModules()` must be called in `boardLookups.js` and awaited before
the canvas mounts. Export `async function initializeLookups()` that calls it.

**Fallback lookup tables** (embedded in `boardLookups.js`):
Define `FALLBACK_SETS_BY_ID`, `FALLBACK_TEAMS_BY_ID`, etc. as plain object
literals with at minimum:

```js
const FALLBACK_SETS_BY_ID = {
  'core':      { name: 'Marvel Legendary',      abbr: 'CORE', releaseYear: 2012 },
  'dark-city': { name: 'Dark City',             abbr: 'DC',   releaseYear: 2013 },
  'guardians': { name: 'Guardians of the Galaxy', abbr: 'GotG', releaseYear: 2014 },
  // ... at least 5 sets
};

const FALLBACK_RARITIES_BY_ID = {
  'common':    { name: 'Common',    color: '#888888' },
  'uncommon':  { name: 'Uncommon',  color: '#4a9a4a' },
  'rare':      { name: 'Rare',      color: '#4a6ae2' },
  'epic':      { name: 'Epic',      color: '#9a4ae2' },
  'legendary': { name: 'Legendary', color: '#e2a84a' },
};

const FALLBACK_CARD_TYPES_BY_ID = {
  'hero':       { displayName: 'Hero',       category: 'hero'       },
  'villain':    { displayName: 'Villain',    category: 'villain'    },
  'mastermind': { displayName: 'Mastermind', category: 'mastermind' },
  'scheme':     { displayName: 'Scheme',     category: 'scheme'     },
  'bystander':  { displayName: 'Bystander',  category: 'bystander'  },
  'henchman':   { displayName: 'Henchman',   category: 'henchman'   },
  'wound':      { displayName: 'Wound',      category: 'wound'      },
  'strike':     { displayName: 'Master Strike', category: 'strike'  },
};
// ... teamsById, heroClassesById, keywordsById similarly
```

**Fallback card data** — at least 25 cards, each using real `CardModel` field names.
Include heroes (with `cost`, `attack`, `recruit`, `teamId`, `heroClassId`),
villains (with `attack`), masterminds (with `isAlwaysLeads`), schemes, bystanders,
henchmen, wounds, strikes. Each card must have `keywords[]` with at least 1 entry.

**Exported lookup functions** — each is a plain named function:

```js
/**
 * Look up a set by ID. Returns { name, abbr, releaseYear } or a safe default.
 * @param {string} setId
 * @returns {{ name: string, abbr: string, releaseYear: number }}
 */
export function lookupSet(setId) {
  const foundSet = setsById[setId];
  if (!foundSet) {
    return { name: 'Unknown Set', abbr: '??', releaseYear: 0 };
  }
  return foundSet;
}

export function lookupTeam(teamId) { ... }
export function lookupRarity(rarityId) { ... }
export function lookupHeroClass(heroClassId) { ... }
export function lookupCardType(cardTypeId) { ... }
export function lookupKeyword(keywordId) { ... }
```

Each lookup function returns a safe default object (never throws, never returns null)
with a `// why:` comment explaining the safe-default strategy.

**Card model validation**:

```js
const REQUIRED_CARD_FIELDS = ['cardId', 'name', 'setId', 'cardTypeId', 'rarityId'];

/**
 * Validate a card object against the required CardModel fields.
 * Returns an array of missing field names. Empty array means valid.
 * @param {Object} card
 * @returns {string[]}
 */
export function validateCardShape(card) {
  const missingFields = [];
  if (!card.cardId) { missingFields.push('cardId'); }
  if (!card.name) { missingFields.push('name'); }
  if (!card.setId) { missingFields.push('setId'); }
  if (!card.cardTypeId) { missingFields.push('cardTypeId'); }
  if (!card.rarityId) { missingFields.push('rarityId'); }
  return missingFields;
}
```

Each check is its own `if` block (not a loop over `REQUIRED_CARD_FIELDS`) — this
keeps validation explicit and easy to extend without understanding a pattern.

### 3. Card image cache (`apps/registry-viewer/src/game/cardImageCache.js`)

A plain JavaScript module. No class. Named functions only.

```js
// why: Konva.Image requires a pre-loaded HTMLImageElement. This module loads
// images once and caches them so the same image is never fetched twice.
const imageCache = new Map();

/**
 * Load a card image by URL. Returns a Promise<HTMLImageElement | null>.
 * Resolves with null on failure — callers draw a placeholder instead.
 * @param {string} imageUrl
 * @returns {Promise<HTMLImageElement | null>}
 */
export async function loadCardImage(imageUrl) { ... }

/**
 * Get a cached image synchronously.
 * Returns HTMLImageElement if cached, null if not yet loaded.
 * @param {string} imageUrl
 * @returns {HTMLImageElement | null}
 */
export function getCachedImage(imageUrl) { ... }

/**
 * Pre-load images for all card models currently visible on the board.
 * @param {CardModel[]} visibleCards  — full CardModel objects
 * @param {Function} getImageUrl      — from cardRegistry.js
 * @returns {Promise<void>}
 */
export async function preloadVisibleCardImages(visibleCards, getImageUrl) { ... }
```

`preloadVisibleCardImages` accepts full `CardModel` objects (not a simplified
slug tuple), extracts `{ setId, cardTypeId, slug, sequence }` from each to
construct image URLs, loops with `for...of`, and awaits `Promise.allSettled()`.

The `getImageUrl` function must be called with real model fields:
```js
getImageUrl({ setId: card.setId, cardTypeId: card.cardTypeId, slug: card.slug, sequence: card.sequence })
```

### 4. Draw functions — Layer 0 Background (`apps/registry-viewer/src/game/drawBackground.js`)

Named functions, no class. Each function accepts a `Konva.Layer` and draws into it.

```js
/**
 * Draw the full board background fill and outer border. Call once on mount.
 * @param {Konva.Layer} backgroundLayer
 */
export function drawBoardBackground(backgroundLayer) { ... }

/**
 * Draw a repeating felt texture grid across the full board.
 * Uses small, slightly lighter rectangles in a repeating pattern.
 * @param {Konva.Layer} backgroundLayer
 */
export function drawFeltTexture(backgroundLayer) { ... }
```

Neither function calls `layer.destroyChildren()` — Layer 0 is drawn once on
mount and redrawn in full only on window resize (resize calls both functions
after `stage.scale()` is updated).

### 5. Draw functions — Layer 1 Zones (`apps/registry-viewer/src/game/drawZones.js`)

```js
/**
 * Draw all static zone rectangles and labels.
 * @param {Konva.Layer} zonesLayer
 */
export function drawAllZones(zonesLayer) { ... }

/**
 * Draw city slot dividers between the 5 city positions.
 * @param {Konva.Layer} zonesLayer
 */
export function drawCitySlotDividers(zonesLayer) { ... }

/**
 * Draw dashed outlines for each of the 6 HQ card slots.
 * @param {Konva.Layer} zonesLayer
 */
export function drawHQSlotOutlines(zonesLayer) { ... }

/**
 * Highlight the active player's hand area with a gold border.
 * Clears previous highlight by destroying 'active-player-highlight-group' first.
 * @param {Konva.Layer} zonesLayer
 * @param {string} activePlayerID
 * @param {number} playerCount
 */
export function drawActivePlayerHighlight(zonesLayer, activePlayerID, playerCount) { ... }

/**
 * Draw or clear the escape warning overlay on city slot 4.
 * @param {Konva.Layer} zonesLayer
 * @param {boolean} isSlot4Occupied
 */
export function drawEscapeWarning(zonesLayer, isSlot4Occupied) { ... }

/**
 * Draw the data source badge in the info bar zone.
 * Shows 'Local Modules' in green or 'Fallback Sample' in amber.
 * @param {Konva.Layer} zonesLayer
 * @param {string} dataSource  — 'local-modules' or 'fallback-sample'
 */
export function drawDataSourceBadge(zonesLayer, dataSource) { ... }

/**
 * In DEV mode only, draw zone boundary debug overlays with coordinate labels.
 * @param {Konva.Layer} zonesLayer
 */
export function drawDevModeGrid(zonesLayer) { ... }
```

Each draw function that updates a dynamic element (highlight, escape warning,
data source badge) must destroy its named group before redrawing. The static
zone rectangles and labels are drawn once by `drawAllZones()` and never
individually re-cleared.

### 6. Draw functions — Layer 2 Cards (`apps/registry-viewer/src/game/drawCards.js`)

All draw functions in this module accept full `CardModel` objects — not simplified
slug tuples. Each function that draws a card must:
1. Use `lookupRarity(card.rarityId).color` for the border stroke
2. Use `lookupCardType(card.cardTypeId).category` for the background tint color
3. Show `cost`, `attack`, or `recruit` badges only when non-null
4. Show up to 2 keyword name badges from `card.keywords` (via `lookupKeyword`)
5. Show special flag badges for `isAlwaysLeads`, `isEpic`, `isTransform`

```js
/**
 * Redraw the entire cards layer from current game state.
 * Destroys all children and rebuilds from scratch on every call.
 * @param {Konva.Layer} cardsLayer
 * @param {Object} G          — boardgame.io game state
 * @param {string} currentPlayerID
 * @param {CardModel[]} cardModels  — full card model objects for all cards in G
 */
export function drawCardsLayer(cardsLayer, G, currentPlayerID, cardModels) { ... }

/**
 * Draw a single card using real CardModel fields.
 * Shows rarity border, type tint, stat badges, keyword pills, and flag badges.
 * Returns a Konva.Group.
 * @param {{ x, y, width, height }} position
 * @param {CardModel} card
 * @param {{ groupName: string, onInspect?: Function }} options
 * @returns {Konva.Group}
 */
export function drawCard(position, card, options) { ... }

/**
 * Draw a face-down card back rectangle.
 * @param {{ x, y, width, height }} position
 * @returns {Konva.Group}
 */
export function drawCardBack(position) { ... }

/**
 * Draw a deck stack (3 staggered rects) with a count badge.
 * @param {{ x, y, width, height }} position
 * @param {number} cardCount
 * @returns {Konva.Group}
 */
export function drawDeckStack(position, cardCount) { ... }

/**
 * Draw the mastermind strike health bar (filled/empty pip row).
 * @param {{ x, y }} origin
 * @param {number} strikeCount
 * @param {number} timesDefeated
 * @returns {Konva.Group}
 */
export function drawMastermindsHealthBar(origin, strikeCount, timesDefeated) { ... }

/**
 * Draw the scheme twist counter (filled/empty pip row + number label).
 * @param {{ x, y }} origin
 * @param {number} twistCount
 * @param {number} currentTwists
 * @returns {Konva.Group}
 */
export function drawSchemeTwistCounter(origin, twistCount, currentTwists) { ... }

/**
 * Draw recruit point and fight point resource counters.
 * @param {Konva.Layer} cardsLayer
 * @param {number} recruitPoints
 * @param {number} fightPoints
 */
export function drawPlayerResourceCounters(cardsLayer, recruitPoints, fightPoints) { ... }

/**
 * Draw player name labels above each player area.
 * @param {Konva.Layer} cardsLayer
 * @param {string[]} playerNames  — ordered by playerID (index = playerID)
 * @param {string} activePlayerID
 */
export function drawPlayerNameLabels(cardsLayer, playerNames, activePlayerID) { ... }
```

`drawCardsLayer` calls sub-functions explicitly in a fixed order:
```js
export function drawCardsLayer(cardsLayer, G, currentPlayerID, cardModels) {
  cardsLayer.destroyChildren(); // why: hot layer — full rebuild on every G update
  drawMastermindCard(cardsLayer, G.mastermindsSlug, cardModels);
  drawSchemeCard(cardsLayer, G.schemeSlug, G.schemeProgress, cardModels);
  drawVillainDeck(cardsLayer, G.villainDeck.length);
  drawCitySlotCards(cardsLayer, G.city, cardModels);
  drawHQCards(cardsLayer, G.hq, cardModels);
  drawHeroDeck(cardsLayer, G.heroDeck.length);
  drawEscapePile(cardsLayer, G.escapedVillains, cardModels);
  drawPlayerHand(cardsLayer, G.players[currentPlayerID], currentPlayerID, cardModels);
  drawOpponentHands(cardsLayer, G.players, currentPlayerID);
  drawPlayerResourceCounters(cardsLayer, G.players[currentPlayerID].recruitPoints, G.players[currentPlayerID].fightPoints);
  drawPlayerNameLabels(cardsLayer, playerNames, G.activePlayerID);
  drawMastermindsHealthBar(...);
  drawSchemeTwistCounter(...);
  cardsLayer.batchDraw(); // why: batches all node additions into a single repaint
}
```

**`drawCard()` internal structure** — written as explicit `if` blocks:

```js
export function drawCard(position, card, options) {
  const cardGroup = new Konva.Group({ name: options.groupName, x: position.x, y: position.y });
  cardGroup.setAttr('cardId', card.cardId); // used by click handler and modal

  // Determine background tint from cardTypeId
  const cardTypeInfo = lookupCardType(card.cardTypeId);
  let backgroundTintColor = CARD_TINT_OTHER;
  if (cardTypeInfo.category === 'hero')       { backgroundTintColor = CARD_TINT_HERO; }
  if (cardTypeInfo.category === 'villain')    { backgroundTintColor = CARD_TINT_VILLAIN; }
  if (cardTypeInfo.category === 'mastermind') { backgroundTintColor = CARD_TINT_MASTERMIND; }
  if (cardTypeInfo.category === 'scheme')     { backgroundTintColor = CARD_TINT_SCHEME; }

  // Determine border color from rarityId
  const rarityInfo = lookupRarity(card.rarityId);
  const borderColor = rarityInfo.color;

  // Draw image or placeholder
  const cachedImage = getCachedImage(getImageUrl({ setId: card.setId, cardTypeId: card.cardTypeId, slug: card.slug }));
  if (cachedImage) {
    drawCardImage(cardGroup, cachedImage, position);
  } else {
    drawCardPlaceholder(cardGroup, position, backgroundTintColor, borderColor, card.name);
  }

  // Draw stat badges (only if non-null for this card type)
  if (card.cost !== null && card.cost !== undefined) {
    drawCostBadge(cardGroup, card.cost);
  }
  if (card.attack !== null && card.attack !== undefined) {
    drawAttackBadge(cardGroup, card.attack);
  }
  if (card.recruit !== null && card.recruit !== undefined) {
    drawRecruitBadge(cardGroup, card.recruit);
  }

  // Draw keyword pills (first 2, then +N badge)
  drawKeywordPills(cardGroup, card.keywords, position);

  // Draw special flag badges
  if (card.isAlwaysLeads) { drawFlagBadge(cardGroup, 'ALWAYS LEADS', '#9a4ae2', position); }
  if (card.isEpic)        { drawFlagBadge(cardGroup, 'EPIC',         '#e2a84a', position); }
  if (card.isTransform)   { drawFlagBadge(cardGroup, 'TRANSFORM',    '#4a90e2', position); }

  return cardGroup;
}
```

`drawKeywordPills` maps the first 2 keyword IDs using `lookupKeyword()` and draws
them as small rounded `Konva.Rect` + `Konva.Text` pill nodes. If `card.keywords.length > 2`,
draws a `+N` badge alongside them.

### 7. Main canvas Vue component (`apps/registry-viewer/src/components/GameBoardCanvas.vue`)

This is the only Vue component in this phase. All Konva rendering code lives
in the draw modules — not inside this component.

```vue
<script setup>
import Konva from 'konva';
import { onMounted, onUnmounted, watch, ref } from 'vue';
import { BOARD_WIDTH, BOARD_HEIGHT, BOARD_BACKGROUND_COLOR } from '../game/boardLayout.js';
import { drawBoardBackground, drawFeltTexture } from '../game/drawBackground.js';
import { drawAllZones, drawCitySlotDividers, drawHQSlotOutlines,
         drawActivePlayerHighlight, drawEscapeWarning,
         drawDataSourceBadge, drawDevModeGrid } from '../game/drawZones.js';
import { drawCardsLayer } from '../game/drawCards.js';
import { preloadVisibleCardImages } from '../game/cardImageCache.js';
import { getImageUrl } from '../game/cardRegistry.js';
import { initializeLookups, validateCardShape, DATA_SOURCE } from '../game/boardLookups.js';

const props = defineProps({
  G:               { type: Object, required: true },
  currentPlayerID: { type: String, required: true },
  playerNames:     { type: Array,  required: true },
  cardModels:      { type: Array,  required: true }, // full CardModel[] for all cards in G
});

const emit = defineEmits([
  'playCard', 'recruitHero', 'fightVillain', 'fightMastermind', 'endTurn',
  'viewCardDetails', // emitted with cardId when any card is clicked for inspection
]);

const containerRef = ref(null);
const validationWarningMessage = ref(''); // shown in dev banner if card shape is invalid
const selectedCardId = ref(null);         // drives CardDetailsModal
const isCardDetailsModalVisible = ref(false);

let stage = null;
let backgroundLayer = null;
let zonesLayer = null;
let cardsLayer = null;
</script>
```

**Lifecycle — `onMounted`:**
1. `await initializeLookups()` — must resolve before any drawing starts
2. Validate shape of first card in `props.cardModels`:
   `const missingFields = validateCardShape(props.cardModels[0])`
   If `missingFields.length > 0`, set `validationWarningMessage`
3. Create `Konva.Stage` attached to `containerRef.value`
4. Create three `Konva.Layer` instances — add each to stage in order
5. Calculate initial scale and apply: `stage.scale({ x: scale, y: scale })`
6. Draw Layer 0: `drawBoardBackground(backgroundLayer)` + `drawFeltTexture(backgroundLayer)`
7. Draw Layer 1: all zone draw functions + `drawDataSourceBadge(zonesLayer, DATA_SOURCE)`
8. Pre-load images for initial visible cards
9. Draw Layer 2: `drawCardsLayer(cardsLayer, props.G, props.currentPlayerID, props.cardModels)`
10. Register `window.addEventListener('resize', handleResize)`
11. Register `stage.on('click', handleStageClick)`

**Lifecycle — `onUnmounted`:**
1. `window.removeEventListener('resize', handleResize)`
2. `stage.destroy()`

**`handleResize` (named function):**
- Recalculate scale from `containerRef.value` dimensions
- Apply new scale to stage
- Redraw Layer 0 and Layer 1 only (Layer 2 keeps current state)

**Watcher on `props.G` (deep):**
```js
watch(() => props.G, async (newG) => {
  // why: preload any new card images before rebuilding the layer
  await preloadVisibleCardImages(props.cardModels, getImageUrl);
  drawCardsLayer(cardsLayer, newG, props.currentPlayerID, props.cardModels);
  drawActivePlayerHighlight(zonesLayer, newG.activePlayerID, Object.keys(newG.players).length);
  drawEscapeWarning(zonesLayer, newG.city[4] !== null);
  zonesLayer.batchDraw();
}, { deep: true });
```

**`handleStageClick` (named function):**

```js
function handleStageClick(konvaEvent) {
  const clickedNode = konvaEvent.target;
  const clickedGroup = clickedNode.findAncestor('Group');
  if (!clickedGroup) {
    return;
  }

  const groupName = clickedGroup.name();
  const cardId = clickedGroup.getAttr('cardId');

  // Inspect action: Shift+click opens card details modal without dispatching a move
  if (konvaEvent.evt.shiftKey && cardId) {
    selectedCardId.value = cardId;
    isCardDetailsModalVisible.value = true;
    return;
  }

  // Game actions (normal click)
  if (groupName.startsWith('city-slot-')) {
    const slotIndex = parseInt(groupName.replace('city-slot-', ''), 10);
    emit('fightVillain', slotIndex);
    return;
  }
  if (groupName.startsWith('hq-card-')) {
    emit('recruitHero', cardId);
    return;
  }
  if (groupName.startsWith('hand-card-')) {
    emit('playCard', cardId);
    return;
  }
  if (groupName === 'mastermind-card') {
    emit('fightMastermind');
    return;
  }
}
```

**Note on click behavior**: Normal click dispatches a game move. Shift+click opens
the Card Details Modal for inspection without dispatching a move. Document this
in a `// why:` comment — this allows players to inspect a card before deciding
whether to play/recruit/fight.

**Template:**
```vue
<template>
  <div class="game-board-canvas-wrapper">

    <!-- Developer warning banner — shown only when card model validation fails -->
    <div v-if="validationWarningMessage" class="game-board-canvas-wrapper__dev-warning">
      ⚠ Card model validation failed: {{ validationWarningMessage }}
    </div>

    <!-- Konva stage container -->
    <div ref="containerRef" class="game-board-canvas-wrapper__stage"></div>

    <!-- Card Details Modal — HTML overlay, not Konva -->
    <CardDetailsModal
      v-if="isCardDetailsModalVisible"
      :card-id="selectedCardId"
      :card-models="cardModels"
      @close="isCardDetailsModalVisible = false"
    />

  </div>
</template>
```

### 8. Card details modal (`apps/registry-viewer/src/components/CardDetailsModal.vue`)

An HTML overlay component — not drawn on canvas. Opens when Shift+clicking any
card. Closed by pressing ESC or clicking the overlay background.

Props:
- `cardId: String, required: true`
- `cardModels: Array, required: true`

Emits: `'close'`

Internal logic:
1. `const card = computed(() => cardModels.find(c => c.cardId === cardId))`
2. If `card` is null, show "Card not found" message
3. All display names resolved through lookup functions from `boardLookups.js`

Display (one section per field group, each section as an explicit named block):
- **Header**: `card.name` + `cardTypesById[card.cardTypeId].displayName` badge
- **Identity**: Set (`lookupSet(card.setId).name`), Team (`lookupTeam(card.teamId)?.name`),
  Rarity (`lookupRarity(card.rarityId).name`) with rarity color swatch,
  Hero Class (`lookupHeroClass(card.heroClassId)?.name`) if non-null
- **Stats**: Cost, Attack, Recruit — each shown only if non-null for this card type
- **Keywords**: Each `card.keywords` ID mapped via `lookupKeyword(id).name`, shown as pills
- **Flags**: "Always Leads", "Epic", "Transform" shown only when `true`
- **Rules text**: `card.rulesText` displayed in a styled text block

Interactions:
- ESC key closes: `document.addEventListener('keydown', handleKeyDown)` in `onMounted`,
  removed in `onUnmounted`
- Overlay background click closes: `@click.self="$emit('close')"`
- The close listener and overlay click are separate handlers — not combined into one

**No game logic in this modal** — it is read-only display only.

### 9. Update `GameBoardView.vue` to use the canvas

Add `GameBoardCanvas.vue` to `GameBoardView.vue` alongside the existing HTML
components. Add a `useCanvasRenderer` boolean ref (defaulting to `true`) and
a toggle button so developers can switch renderers during development.

The canvas receives `G`, `currentPlayerID`, `playerNames`, and `cardModels` as
props. Its `playCard`, `recruitHero`, `fightVillain`, `fightMastermind`, and
`endTurn` emits are forwarded to `gameStore.move(...)`. The `viewCardDetails`
emit is not forwarded to the store — the modal is handled inside `GameBoardCanvas.vue`.

### 10. `package.json` — add Konva dependency

Add to `apps/registry-viewer/package.json`:
```json
{ "dependencies": { "konva": "^9.0.0" } }
```

Show the install command:
```
pnpm --filter registry-viewer add konva
```

---

## Operational Notes (answer directly)

1. **Why vanilla Konva instead of vue-konva?** Vue-konva wraps every Konva node
   as a reactive Vue component. A Legendary board can have 50+ card nodes on
   screen at once, all rebuilt on every `G` change. Vanilla Konva with explicit
   `batchDraw()` gives direct control over repaints and avoids per-node reactive
   overhead. `GameBoardCanvas.vue` is a thin lifecycle wrapper — all rendering
   lives in the draw modules.

2. **Why `cardsLayer.destroyChildren()` on Layer 2 but not Layers 0 and 1?**
   Layer 0 draws once on mount (redraws only on resize). Layer 1 uses named
   group destruction for its individual dynamic elements. Layer 2 changes on
   every move — full rebuild is simpler than diffing 50+ card nodes, and
   `batchDraw()` makes the repaint efficient regardless.

3. **Image loading race condition:** If `drawCardsLayer` runs before
   `preloadVisibleCardImages` resolves, `getCachedImage()` returns null and
   `drawCard()` draws a placeholder. The placeholder is permanent for that draw
   cycle — the canvas does not auto-update when the image loads later. The next
   `G` state change triggers a fresh `preloadVisibleCardImages` + redraw cycle,
   which will then pick up the now-cached image. Document this behavior in a
   `// why:` comment in `drawCard()`.

4. **Responsive scaling strategy:** Zone positions in `boardLayout.js` are logical
   coordinates at 1600 × 960. `stage.scale()` applies a uniform transform to the
   entire stage — Konva's hit-testing operates in logical coordinates, so click
   routing in `handleStageClick` never needs to reverse-apply the scale factor.

5. **Multiplayer hand layout:** Opponent row heights are named constants
   (`OPPONENT_ROW_HEIGHT_1_OPPONENT` through `OPPONENT_ROW_HEIGHT_4_OPPONENTS`).
   `drawOpponentHands` reads the appropriate constant using explicit `if/else` on
   `playerCount` — not a computed formula or array index.

6. **Import-first fallback-second data strategy:** `initializeLookups()` attempts
   dynamic `import()` of real module paths inside a try/catch. If any import fails
   (module not found, loaded as plain HTML, etc.), `useFallbackData()` populates
   all lookup tables from the embedded constants and sets `DATA_SOURCE = 'fallback-sample'`.
   The data source badge on the board tells developers which is active without
   opening devtools.

7. **Card model validation:** `validateCardShape()` is called on the first card
   at mount time. If it returns missing field names, a developer banner appears
   above the canvas. This is not a hard error — the board still renders with
   whatever data is available. The banner disappears in production builds if
   `import.meta.env.PROD` is true (document this in a `// why:` comment).

---

## Hard Constraints

- Konva.js only — no vue-konva, no PixiJS, no other canvas libraries
- No game logic in draw functions — they only draw what they receive as parameters
- No direct store access in draw functions — data flows: `G` + `cardModels`
  → `GameBoardCanvas.vue` → draw functions as plain arguments
- No animations in this prompt — all transitions are instant redraws
- `cardsLayer.destroyChildren()` is permitted ONLY on the hot Layer 2 —
  never on Layer 0 (background) or Layer 1 (zones)
- Named `Konva.Group` instances for every interactive element — click routing
  depends on group names being consistent and `cardId` attribute being set
- Image loading failures must always fall back to a placeholder rectangle —
  never crash or leave a blank space
- Responsive scaling uses `stage.scale()` only — zone position constants are
  never recomputed on resize
- `window.removeEventListener` and `stage.destroy()` must both be called in
  `onUnmounted` to prevent memory leaks
- **Real card model field names only** — `cardId`, `setId`, `teamId`, `cardTypeId`,
  `rarityId`, `heroClassId`, `keywords`, `cost`, `attack`, `recruit`, `rulesText`,
  `isAlwaysLeads`, `isEpic`, `isTransform` — never simplified alternatives like
  `type`, `setName`, or `rarity`
- **ID-based lookups only** — display names always resolved through
  `lookupSet()`, `lookupRarity()`, etc. — never stored directly on the card object
- **Import-first strategy** — `boardLookups.js` must attempt real module imports
  before falling back; the DATA_SOURCE constant must be set correctly in both cases
- **Fallback data uses real field names** — every fallback card object must have
  all `CardModel` fields including `keywords[]`, `isAlwaysLeads`, `isEpic`, `isTransform`
- **`validateCardShape()` checks each field with its own `if` block** — not a loop
- **`drawCard()` uses `if/else` blocks** for all conditional rendering
  (image-vs-placeholder, rarity color, type tint, stat badges, flags) —
  never nested ternaries
- **No anonymous arrow functions as draw functions** — every draw function is a
  named export with a JSDoc comment
- **No abbreviated variable names** — `backgroundLayer`, `zonesLayer`, `cardsLayer`,
  not `bg`, `zones`, `cards`; `clickedGroup`, not `grp`; `slotIndex`, not `idx`;
  `cardTypeInfo`, not `type`
- **No magic numbers** — all sizes, positions, colors, and rarity/type constants
  come from `boardLayout.js`
- **No `import *`** — import each named export explicitly
- **All city slot and HQ slot positions are explicit named constants** in
  `boardLayout.js` — never computed in a loop
- **Each draw function is 30 lines or fewer** — break larger operations into
  named helper functions
- **Every function has a JSDoc comment** with parameter types and return value
- **`// why:` comments** on `batchDraw()`, `destroyChildren()`, the single stage
  click handler, Shift+click inspect behavior, and the import fallback strategy
- **`CardDetailsModal.vue` is read-only** — no game actions, no store access
- **ESC handler and overlay click handler are separate** in `CardDetailsModal.vue`
