---
title: Play Board
type: System
tags:
  - arena-client
  - uistate
  - projection
  - board-layout
  - ability-text
  - rendering
related:
  - design-system-overview.md
  - play-diagnostics.md
  - responsive-viewport-targets.md
  - card-effect-system.md
  - turn-system.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\play-board.md (this page — https://ewiki.legendary-arena.com/play-board/)
  - ../apps/arena-client/src/pages/PlayDesktop.vue
  - ../apps/arena-client/src/pages/PlayMobile.vue
  - ../apps/arena-client/src/components/play/CardReaderModal.vue
  - ../apps/arena-client/src/components/play/AbilityText.vue
  - ../apps/arena-client/src/lib/abilityMarkers.ts
  - ../apps/arena-client/src/client/bgioClient.ts
  - ../packages/game-engine/src/ui/uiState.build.ts
  - ../packages/game-engine/src/ui/uiState.filter.ts
  - ../packages/game-engine/src/game.ts
  - ../docs/ai/DESIGN-BOARD-LAYOUT.md
  - ../docs/ai/ARCHITECTURE.md
last-reviewed: 2026-08-02
---

# Play Board

## Summary

The **Play Board** is the rendered game mat on `play.legendary-arena.com`
— the mastermind and scheme tiles, the city, the HQ, your hand and piles,
and the card-reader modal. It is a **pure read-only view of the engine's
projected `UIState`**: the client renders what the engine already decided
and never computes game state itself.

This page documents two things no other page covers: the **zones on the
mat and which `UIState` field feeds each**, and the **two-stage
projection→render contract** that the board depends on. The second is
where two shipped bugs lived (2026-08-02) — worth reading before adding
any field to the board.

The board's authoritative layout spec is
[`DESIGN-BOARD-LAYOUT.md`](../docs/ai/DESIGN-BOARD-LAYOUT.md) (WP-128 /
WP-129, EC-131 / EC-132); this page is the descriptive companion and the
home for the projection-boundary gotchas.

## Mechanics

### The board is a projection, not state

Per [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) the engine owns truth
and the UI consumes read-only projections. The client's bgio subscriber
takes the server-sent `state.G` verbatim
([`bgioClient.ts` — `const projection = state.G`](../apps/arena-client/src/client/bgioClient.ts))
and writes it into the store; the board tiles render from it. The client
does **not** run `buildUIState` — the projection is produced **server-side**
by `playerView` and arrives already shaped. This is the same invariant the
[Design System Overview](design-system-overview.md) feel layer inherits.

### Board zones and their `UIState` source

| Zone / tile | Component | `UIState` field |
|---|---|---|
| Mastermind | `MastermindTile.vue` | `mastermind` (`display`, `gameText`, `tacticsRemaining`, `strikePile`) |
| Scheme | `SchemeTile.vue` / `SchemeTwistPile.vue` | `scheme` (`display`, `gameText`, `twistCount`, `twistPile`) |
| City | `CityRow.vue` / `EscapedPile.vue` | `city` |
| HQ | `HQRow.vue` | `hq.slots` / `hq.slotDisplay` |
| Hand / played | `HandRow.vue` / `PlayedCardsRow.vue` | `players[].hand` / `handDisplay` |
| Decks & piles | `SharedDecks.vue` / `KOPile.vue` / `YourVictoryPile.vue` | `decks`, `piles`, `koPile` |
| Economy | `EconomyBar.vue` | `economy` |
| Card reader | `CardReaderModal.vue` | the tile's `display` + `gameText` |
| Event overlay | `NotableEventOverlay.vue` | `notableEvents` |

The **Card Reader** (`CardReaderModal`) is the single shared modal the
Mastermind and Scheme tiles open on "Read card"; it shows the card at a
readable size plus its `gameText` (Master-Strike / special rules, or the
scheme's twist / win conditions).

### The projection→render contract (two gates)

Every frame the board renders has passed through **two** engine-side
stages, in this order:

1. **`buildUIState(G, ctx)`**
   ([`uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts))
   — builds the full projection from `G`, resolving card `display` from
   `G.cardDisplayData` and copying baked text (`scheme.gameText`,
   `mastermind.gameText`).
2. **`filterUIStateForAudience(full, audience)`**
   ([`uiState.filter.ts`](../packages/game-engine/src/ui/uiState.filter.ts))
   — an **audience whitelist** that redacts private data (other players'
   hands, deck order) and rebuilds the shared-board objects
   **field-by-field**. `playerView` runs both
   ([`game.ts` — `buildPlayerView`](../packages/game-engine/src/game.ts)).

The load-bearing subtlety: the filter is a **whitelist that reconstructs
`scheme` / `mastermind` / `city` / `hq` object-by-object**. A field
`buildUIState` populates does **not** reach the client unless the filter's
reconstruction also copies it. See [Edge Cases](#edge-cases).

### Ability-text markers

Card / scheme / mastermind text ships from the engine with inline markup —
`[icon:attack]`, `[hc:strength]`, `[keyword:Patrol]`, `[rule:Shards]`,
`[team:X-Men]` (the same vocabulary the
[Card Effect System](card-effect-system.md) and the card browser use). The
board must **render these markers, not print them raw**. The play surface
renders the three visual marker families as their **real SVG icon** — the
same art printed on the physical card — served from the card-image domain
(`images.legendary-arena.com/icons/…`, same origin as card art so no new
CSP `img-src` entry):

| Marker | Asset | Values |
|---|---|---|
| `[hc:X]` | `/icons/hero-classes/class-{X}.svg` | the 5 classes below |
| `[icon:X]` | `/icons/card-info/info-{X}.svg` | `attack` `recruit` `cost` `vp` `focus` `piercing` `token` |
| `[team:X]` | `/icons/hero-teams/team-{slug}.svg` | slugged team name (`X-Men` → `team-x-men`), open set |

`[keyword:X]` / `[rule:X]` render as their label text (no icon).

**Hero-class icons** (`[hc:…]`):

![Covert](https://images.legendary-arena.com/icons/hero-classes/class-covert.svg "width=44px")
![Instinct](https://images.legendary-arena.com/icons/hero-classes/class-instinct.svg "width=44px")
![Ranged](https://images.legendary-arena.com/icons/hero-classes/class-ranged.svg "width=44px")
![Strength](https://images.legendary-arena.com/icons/hero-classes/class-strength.svg "width=44px")
![Tech](https://images.legendary-arena.com/icons/hero-classes/class-tech.svg "width=44px")

*Covert · Instinct · Ranged · Strength · Tech*

**Resource icons** (`[icon:…]`):

![attack](https://images.legendary-arena.com/icons/card-info/info-attack.svg "width=40px")
![recruit](https://images.legendary-arena.com/icons/card-info/info-recruit.svg "width=40px")
![cost](https://images.legendary-arena.com/icons/card-info/info-cost.svg "width=40px")
![vp](https://images.legendary-arena.com/icons/card-info/info-vp.svg "width=40px")
![focus](https://images.legendary-arena.com/icons/card-info/info-focus.svg "width=40px")
![piercing](https://images.legendary-arena.com/icons/card-info/info-piercing.svg "width=40px")
![token](https://images.legendary-arena.com/icons/card-info/info-token.svg "width=40px")

*attack · recruit · cost · vp · focus · piercing · token*

**Team icons** (`[team:…]`, sample of the set):

![Avengers](https://images.legendary-arena.com/icons/hero-teams/team-avengers.svg "width=40px")
![X-Men](https://images.legendary-arena.com/icons/hero-teams/team-x-men.svg "width=40px")
![Brotherhood](https://images.legendary-arena.com/icons/hero-teams/team-brotherhood.svg "width=40px")
![Guardians of the Galaxy](https://images.legendary-arena.com/icons/hero-teams/team-guardians-of-the-galaxy.svg "width=40px")
![S.H.I.E.L.D.](https://images.legendary-arena.com/icons/hero-teams/team-shield.svg "width=40px")

*Avengers · X-Men · Brotherhood · Guardians of the Galaxy · S.H.I.E.L.D.*

[`abilityMarkers.ts`](../apps/arena-client/src/lib/abilityMarkers.ts)
parses a line into tokens and resolves each marker's icon URL;
[`AbilityText.vue`](../apps/arena-client/src/components/play/AbilityText.vue)
renders each as an inline `<img>` (with the readable label as `alt` /
`title`), and `CardReaderModal` renders each `gameText` line through it.
Every icon carries an `@error` fallback to its text label, so a missing
asset (an unknown team slug, a future class) degrades to a readable word
instead of a broken image; an `hc` / `icon` value with no shipped asset
renders as text without even requesting one.

> **Cross-surface note.** The **parser** and the marker vocabulary mirror
> the canonical tokenizer in the registry-viewer
> (`apps/registry-viewer/src/composables/useRules.ts` + `CardDetail.vue`);
> the two apps are separate surfaces and may not import each other, so the
> parser is duplicated verbatim. **The rendering has diverged on purpose:**
> the card browser prints hero-class / resource markers as coloured
> words / unicode glyphs, while the play board renders the real SVG icons
> documented here. Keep the *parser* in sync; the *rendering* is
> surface-specific.

## Interactions

- **[Design System Overview](design-system-overview.md)** — the feel layer
  (visual / audio / dopamine / narrative) is a pure reaction to the *same*
  projected `UIState` this board renders. Its Feel-Layer Contract's
  "allowed input surfaces" are subject to the same second gate (the
  audience filter) documented here.
- **[Play Diagnostics](play-diagnostics.md)** — the "Download diagnostics"
  bundle captures the live `uiStateSnapshot`; a field present in
  `buildUIState` but absent from that snapshot was dropped by the filter,
  not by `buildUIState`. That distinction is the fastest way to diagnose a
  missing-field board bug.
- **[Responsive Viewport Targets](responsive-viewport-targets.md)** — the
  desktop-first layout posture the same tiles are arranged under (Desktop
  vs Mobile page).
- **[Card Effect System](card-effect-system.md)** — the source of the
  `[keyword:…]` / `[icon:…]` marker vocabulary the board renders.

## Edge Cases {#edge-cases}

- **The audience filter silently drops new optional projection fields.**
  `filterUIStateForAudience` rebuilds `scheme` / `mastermind` on a
  field-by-field whitelist. Because most new `UIState` fields are added
  **optional** (`?:`) for privacy / back-compat, TypeScript does **not**
  flag a field the whitelist forgot to copy — it is dropped at the filter
  and the client never sees it. Shipped bug (PR #1165, 2026-08-02): EC-206
  added `scheme.display`, `scheme.gameText`, and `mastermind.gameText` to
  `buildUIState` but not to the filter, so every match rendered a blank
  scheme tile and "No rules text available" for both cards. The
  `matchCardImageUrls` pass-through in the filter exists for exactly this
  reason. **When you add a board-visible field, add it to the filter's
  reconstruction and cover it with a filter test.**
- **Ability markers must be rendered, not printed.** Before PR #1166 the
  Card Reader printed `gameText` lines verbatim, so players saw
  `reveals a [hc:strength] Hero`; #1166 rendered them and #1171 swapped the
  glyph/word rendering for the real SVG icons above. Any new surface that
  shows `gameText` / `abilityText` must route it through
  [`AbilityText`](../apps/arena-client/src/components/play/AbilityText.vue),
  never print the raw line.
- **Marker icons fall back to text, never a broken image.** Each icon
  `<img>` has an `@error` handler that swaps to the marker's text label, and
  an `hc` / `icon` value outside the shipped asset sets renders as text with
  no request. So a new team, a renamed slug, or an R2 hiccup degrades to a
  readable word — it never leaves a broken-image glyph in the rules text.
- **Very old match blobs lack baked text.** `scheme.gameText` /
  `mastermind.gameText` and the scheme `display` entry are baked into `G`
  at match setup. A match created **before EC-206 (2026-05-26)** has a `G`
  with no such text; the current server projects it correctly but there is
  nothing to project — the tiles fall back to name-only. Not a bug in the
  render path; the blob is frozen (snapshots are not save-games).

## Code Touchpoints

- [`PlayDesktop.vue`](../apps/arena-client/src/pages/PlayDesktop.vue) /
  [`PlayMobile.vue`](../apps/arena-client/src/pages/PlayMobile.vue) — the
  board layout; wire each tile to its `UIState` field and feed the one
  shared `CardReaderModal`.
- [`bgioClient.ts`](../apps/arena-client/src/client/bgioClient.ts) — the
  subscriber that writes the server-projected `state.G` into the store.
- [`uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts) —
  gate 1: builds the full projection.
- [`uiState.filter.ts`](../packages/game-engine/src/ui/uiState.filter.ts) —
  gate 2: the audience whitelist (the drop hazard above).
- [`AbilityText.vue`](../apps/arena-client/src/components/play/AbilityText.vue)
  / [`abilityMarkers.ts`](../apps/arena-client/src/lib/abilityMarkers.ts) —
  marker parsing + the icon-URL builders (`heroClassIconUrl`,
  `resourceIconUrl`, `teamIconUrl`, `abilityTokenIconUrl`) + inline
  `<img>` rendering with text fallback.

## References

- [`DESIGN-BOARD-LAYOUT.md`](../docs/ai/DESIGN-BOARD-LAYOUT.md) — the
  authoritative board layout spec (WP-128 / WP-129, EC-131 / EC-132)
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — engine owns truth / UI
  consumes read-only projections; `playerView` is the sole engine→client
  projection boundary
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-12801 / D-12803 / D-12806
  (WP-128 audience-filter redaction matrix and shared-board pass-through)
- EC-206 — surfaced scheme / mastermind ability text on the play views
  (the fields the filter later had to be taught to pass through)
