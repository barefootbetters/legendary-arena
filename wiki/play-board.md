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
board must **render these markers, not print them raw**:

- `[icon:X]` → a glyph (`attack` → ⚔, `recruit` → ★, `cost` → ◆, …)
- `[hc:X]` → a hero-class chip (`strength` → "Strength")
- `[keyword:X]` / `[rule:X]` / `[team:X]` → the label text

[`abilityMarkers.ts`](../apps/arena-client/src/lib/abilityMarkers.ts)
parses a line into tokens and
[`AbilityText.vue`](../apps/arena-client/src/components/play/AbilityText.vue)
renders them; `CardReaderModal` renders each `gameText` line through it.
Unknown `icon` / `hc` values fall back to the raw value (no data loss).

> **Cross-surface duplication.** The parser and the glyph / hero-class-label
> maps mirror the canonical tokenizer in the registry-viewer
> (`apps/registry-viewer/src/composables/useRules.ts` +
> `CardDetail.vue`). The two apps are separate surfaces and may not import
> each other, so the maps are duplicated verbatim. **If the registry-viewer
> maps change, update `abilityMarkers.ts` to match.**

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
  `reveals a [hc:strength] Hero`. Any new surface that shows `gameText` /
  `abilityText` must route it through
  [`AbilityText`](../apps/arena-client/src/components/play/AbilityText.vue).
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
  marker parsing + rendering.

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
