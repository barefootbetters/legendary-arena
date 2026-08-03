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

The **Play Board** is the rendered game mat on `play.legendary-arena.com`.
It is a **pure, read-only visualization of the engine-projected
`UIState`.** The client never computes game state, derives gameplay
outcomes, or rebuilds projections: all board-visible data originates in
the game engine, is shaped and audience-filtered by `playerView`, and is
delivered to the client already visibility-safe.

This page describes:

- the board **zones and their authoritative `UIState` sources**;
- the engine→client **projection pipeline**;
- the **projection-boundary hazards** that have caused production defects.

The invariants and workflow rules below **restate**, for the board's
context, the authoritative contracts in
[ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) and
[`.claude/rules/*.md`](../.claude/rules/architecture.md); this wiki page
is descriptive and cites them, it does not mint new governance (per
[`SCHEMA.md`](SCHEMA.md)). The board's authoritative layout spec is
[`DESIGN-BOARD-LAYOUT.md`](../docs/ai/DESIGN-BOARD-LAYOUT.md) (WP-128 /
WP-129, EC-131 / EC-132).

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

### Critical invariants

These are the [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) invariants as
they bind the board. They are not new to this page — they are cited here
because the board is the surface most tempted to break them.

1. **Engine owns truth.** `G` is authoritative; the board never second-guesses it.
2. **`UIState` owns presentation.** The board renders only data exposed through the projection.
3. **The client performs no gameplay calculation.** Rendering code may transform *visuals* (format text, size an icon) but may never derive gameplay *state*.
4. **Audience filtering happens before delivery.** The board must treat every field it receives as already visibility-safe; it performs no redaction of its own.
5. **Board-visible fields require filter pass-through.** A field present in `buildUIState()` is not board-visible until `filterUIStateForAudience()` copies it (see the [Board-visible field rule](#board-visible-field-rule)).
6. **Ability text must be token-rendered.** Raw marker syntax (`[hc:…]`, `[icon:…]`) is never shown to a player; it is always routed through `AbilityText`.

### Non-Goals

The board is **not** responsible for any of the following — they belong to
the engine and the projection pipeline:

- game-state computation;
- rule evaluation, ability resolution, or turn progression;
- visibility determination or player-specific redaction;
- building or reshaping the projection.

If board code starts doing any of these, the layer boundary is already broken.

### Board zones and their `UIState` source

The **Authority** column records how the audience filter treats each
field: *public* fields are identical for every viewer (shared board);
*redacted* fields are visible only to their owner and stripped for
opponents / spectators. Every field is engine-owned and passes through
the filter — "public" vs "redacted" is the filter's disposition, not a
different source.

| Zone / tile | Component | `UIState` source | Authority |
|---|---|---|---|
| Mastermind | `MastermindTile.vue` | `mastermind` (`display`, `gameText`, `tacticsRemaining`, `strikePile`) | Engine — public |
| Scheme | `SchemeTile.vue` / `SchemeTwistPile.vue` | `scheme` (`display`, `gameText`, `twistCount`, `twistPile`) | Engine — public |
| City | `CityRow.vue` / `EscapedPile.vue` | `city` | Engine — public |
| HQ | `HQRow.vue` | `hq.slots` / `hq.slotDisplay` | Engine — public |
| Hand / played | `HandRow.vue` / `PlayedCardsRow.vue` | `players[].hand` / `handDisplay` | Engine — **redacted** (owner-only) |
| Decks & piles | `SharedDecks.vue` / `KOPile.vue` / `YourVictoryPile.vue` | `decks`, `piles`, `koPile` | Engine — public (counts / public piles) |
| Economy | `EconomyBar.vue` | `economy` | Engine — public |
| Card reader | `CardReaderModal.vue` | the tile's `display` + `gameText` | Engine — public |
| Event overlay | `NotableEventOverlay.vue` | `notableEvents` | Engine — public |

The **Card Reader** (`CardReaderModal`) is the single shared modal the
Mastermind and Scheme tiles open on "Read card"; it shows the card at a
readable size plus its `gameText` (Master-Strike / special rules, or the
scheme's twist / win conditions).

### Engine projection pipeline (authoritative data flow)

Every frame the board renders has travelled this path, engine → client:

```
Game State (G)                 authoritative engine state
      │
      ▼
playerView()  ┌──────────────────────────────────────────────┐
              │  buildUIState(G, ctx)   → full UIState        │  server-side
              │  filterUIStateForAudience(full, audience)     │  (per audience)
              └──────────────────────────────────────────────┘
      │            audience-filtered, visibility-safe UIState
      ▼
   network      (boardgame.io transport)
      │
      ▼
bgioClient.ts   const projection = state.G   (verbatim; no client re-projection)
      │
      ▼
  Pinia store
      │
      ▼
Play Board components   render only
```

`playerView` is the **sole** engine→client projection boundary; it runs
**two** engine-side stages, in order:

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
reconstruction also copies it — this is invariant #5 and the
[Board-visible field rule](#board-visible-field-rule).

### Board-visible field rule {#board-visible-field-rule}

> **Enforced.** This rule is codified as an Invariant in
> [`.claude/rules/architecture.md`](../.claude/rules/architecture.md)
> §"UIState Projection Integrity" (Board-Visible Field Rule). The steps
> below are the descriptive companion; the rules file is authoritative.

Adding a board-visible field is a **five-step contract**, not a one-line
projection edit. Because the fields are optional, TypeScript will not
catch a missed step — the field simply never reaches the board.

1. Declare the field on the `UIState` type ([`uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)).
2. Populate it in `buildUIState()` ([`uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts)).
3. **Pass it through** `filterUIStateForAudience()` ([`uiState.filter.ts`](../packages/game-engine/src/ui/uiState.filter.ts)) — with the correct audience disposition (public vs redacted).
4. Add audience-filter **test coverage** asserting the field survives for the intended audiences.
5. Verify it appears in the [Play Diagnostics](play-diagnostics.md) `uiStateSnapshot`.

Skipping step 3 or 4 is the exact defect class that blanked the scheme
tile in PR #1165; see [Edge Cases](#edge-cases).

### Ability-text markers

Card / scheme / mastermind text ships from the engine with inline markup —
`[icon:attack]`, `[hc:strength]`, `[keyword:Patrol]`, `[rule:Shards]`,
`[team:X-Men]` (the same vocabulary the
[Card Effect System](card-effect-system.md) and the card browser use).
**Any surface that displays `gameText` / `abilityText` must render its
marker tokens through
[`AbilityText`](../apps/arena-client/src/components/play/AbilityText.vue);
rendering raw marker syntax to a player is prohibited (invariant #6).**
The play surface renders the three visual marker families as their **real
SVG icon** — the
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

## Debugging: missing-data triage

When the board is missing data, the pipeline gives a deterministic path.
Start from the [Play Diagnostics](play-diagnostics.md) bundle and read its
`uiStateSnapshot`:

1. **Is the field in `uiStateSnapshot`?**
   - **Present, but the tile is blank** → the bug is in the **board component binding** (arena-client), not the projection.
2. **Absent from `uiStateSnapshot`, but `buildUIState` populates it** → the field is being dropped by **`filterUIStateForAudience`** (the whitelist missed it — the #1165 class). Fix per the [Board-visible field rule](#board-visible-field-rule).
3. **The field never existed in the projection for this match** → it is a **projection version drift** case: the match's `G` predates the field. Inspect `buildUIState` and the match creation date (see Edge Cases).

One question — "is the field in the snapshot?" — routes every missing-data
report to exactly one of the three layers.

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
  reason. Prevention is the [Board-visible field rule](#board-visible-field-rule)
  (steps 3–4).
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
- **Projection version drift.** Because the board renders a *projected*
  object rather than live engine state, and because much of a match's
  display data (`scheme.gameText` / `mastermind.gameText`, the scheme
  `display` entry) is **baked into `G` at match setup**, a field added to
  the projection *after* a match was created may be **absent from that
  match's historical `G`**. Symptoms: the board renders name-only content,
  display metadata is missing, or ability text is unavailable — for that
  match only. Diagnosis: verify the match creation date, inspect the stored
  `G`, and confirm the projection field existed when the match was
  initialized. Concrete case: a match created **before EC-206 (2026-05-26)**
  has no baked scheme/mastermind text; the current server projects it
  correctly but there is nothing to project. This is **distinct from the
  filter-drop bug** above — the render path and the filter are both correct;
  the *data* was never baked. The blob is frozen (snapshots are not
  save-games), so the only remedy is a new match.

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
