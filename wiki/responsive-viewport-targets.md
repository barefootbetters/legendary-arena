---
title: Responsive Viewport Targets
type: Guide
tags:
  - responsive
  - viewport
  - layout
  - design-system
  - arena-client
  - play-surface
related:
  - design-system-overview.md
  - visual-effects.md
  - play-diagnostics.md
  - development-workflow.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\responsive-viewport-targets.md (this page — https://ewiki.legendary-arena.com/responsive-viewport-targets/)
  - ../apps/arena-client/src/composables/useViewport.ts
  - ../apps/arena-client/src/pages/PlayViewport.vue
  - ../apps/arena-client/src/pages/PlayDesktop.vue
  - ../docs/ai/DESIGN-BOARD-LAYOUT.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-09-10
---

# Responsive Viewport Targets

## Summary

`play.legendary-arena.com` is a **desktop-first** experience. Legendary
is a dense deck-builder — card art, a City row, an HQ lineup, Mastermind
and Scheme tiles, opponent panels, your hand, and a game log all compete
for screen space — so the play surface is designed for large screens and
degrades to phone as a secondary case.

This page catalogs three things: the **one breakpoint that is actually
locked in code**, the **reference screen sizes** the layout is designed
and tested against, and the **fluid desktop scaling model** now shipped
(WP-430 / D-24251 — a 1600px centered cap + fluid `clamp()` card/gutter
sizing above the 767px split). It is descriptive — it records the current
posture and cites where each value lives, including the governing
[`DECISIONS.md`](../docs/ai/DECISIONS.md) entry; per [SCHEMA.md](SCHEMA.md)
the wiki cites design decisions, it does not make them.

## Mechanics

### The one locked breakpoint (D-12909)

There is exactly **one** responsive breakpoint in the play surface. It
is a binary switch, not a scaling ladder:

- `BREAKPOINT_MOBILE_MAX_PX = 767` — defined once in
  `apps/arena-client/src/composables/useViewport.ts`.
- A viewport matching `(max-width: 767px)` renders `<PlayMobile>`; a
  viewport of **768px or wider** renders `<PlayDesktop>`. The
  `<PlayViewport>` page is the discriminator that mounts one or the
  other.
- The flag is evaluated **synchronously at setup** via
  `window.matchMedia`, then updates reactively on resize, so the correct
  layout mounts on the first frame (no flicker).

The 767/768 boundary was chosen deliberately and the alternatives were
rejected on the record (`useViewport.ts` comment + D-12909):

| Candidate | Verdict | Why |
|-----------|---------|-----|
| **767 px** | **Locked** | Aligns with iPad Mini portrait cutoff and common CSS/Tailwind convention |
| 640 px | Rejected | Too narrow — routes mid-size phones into the desktop layout |
| 820 px | Rejected | Collides with iPad landscape — routes landscape tablets into the mobile layout |

The value was locked *before* the first production component file was
written, specifically so it would not be re-litigated mid-build.

### Two hand-authored layouts and their design ranges

Above and below the breakpoint sit two separately authored pages. Their
target ranges come from
[`DESIGN-BOARD-LAYOUT.md §3`](../docs/ai/DESIGN-BOARD-LAYOUT.md) — a
**draft, non-normative wireframe**, so these ranges are stated design
*intent*, not enforced constraints:

| Layout | Component | Design range | Arrangement |
|--------|-----------|--------------|-------------|
| Desktop landscape | `PlayDesktop.vue` | 1280×800 – 1920×1080 | Shared board in the visual center; opponents as top-edge mini-panels (D-12902); Mastermind top-left (D-12901); your hand bottom-prominent |
| Mobile portrait | `PlayMobile.vue` | 375×667 – 414×896 | Vertical stack; sticky top HUD; sticky bottom turn-actions bar; wide rows (City, HQ, hand) scroll horizontally within their zone |

The desktop layout **scales fluidly** across that range and beyond —
centered and capped at 1600px on wider monitors, holding without
horizontal scroll down to the 1366px floor (see *Fluid desktop scaling —
shipped* below).

### Reference screen targets (external data — no first-party signal yet)

The game is **pre-launch**, so there is **no first-party analytics** to
lean on. The authoritative signal — which resolutions real players
actually use — will come from Cloudflare Web Analytics once the game is
live. Until then the targets below are **rough global references only**,
not measured audience data:

- **Traffic mix, broadly:** mobile is the majority of general web
  traffic, desktop is the next-largest share, and tablets are a small
  sliver. These are whole-web averages and are a poor proxy for a dense
  strategy game, whose audience skews toward larger screens — hence the
  desktop-first posture.
- **Common desktop resolutions to design and test against:**

  | Resolution | Represents | Priority |
  |------------|------------|----------|
  | 1920×1080 | The single most common desktop resolution | Primary baseline |
  | 1440×900 | Typical laptops | Must hold |
  | 1280×720 | 1920×1080 at 150% browser zoom (a common readability/accessibility setting) | Must hold — but **currently below the 1366px floor** (see *Browser zoom* below) |
  | 2560×1440 | Larger / higher-end monitors | Should look good, not stretched |

Treat these as anchors to resize-test against, and revisit the whole
section once live analytics exist.

#### Browser zoom shrinks the *effective* viewport below the floor

The numbers above are **native** resolutions. Browser zoom divides the
CSS viewport the layout actually sees: at **150% zoom**, a native
**1920×1080** monitor reports an effective **1280×720** to CSS. So a
player on a standard 1080p screen who bumps zoom to 150% for readability
lands at **1280 wide — 86px under the shipped 1366px fluid-scaling
floor** (see *Fluid desktop scaling — shipped* below). Below the floor
the desktop layout is not designed to hold, so the board overflows and
horizontal-scrolls.

This is not hypothetical: it is the observed cause of a real player
(Tex) having difficulty with `play.legendary-arena.com` on a home
1920×1080 machine set to 150% zoom. The layout fix — lowering the
`clamp()` floor from 1366 to accommodate 1280-wide effective viewports —
is a **code + `DECISIONS.md`** change (it would revise the D-24251 floor
anchor), not something this descriptive page can make on its own; per
[SCHEMA.md](SCHEMA.md) the wiki cites decisions, it does not make them.
1280×720 is recorded here as a **must-hold target the layout does not
yet meet**.

![Proposal mockup of a redesigned Legendary Arena play mat, rendered at 1280×720 (Tex's screen) on the dark theme with the playmat skin on. A dark cinematic board fills a single 16:9 frame with no scroll: a top HUD bar (LEGENDARY ARENA wordmark, Phase Play, Turn 4, Twists 2/8, Strikes 0/3); an adversary band holding the Loki Mastermind tile, the Capture Five Bystanders Scheme tile, and a shared-supply strip (Wounds 24, Bystanders 12, S.H.I.E.L.D. Officers 22, Sidekicks 13, KO Pile 6, Escaped 3); the five-space City battle-line (Escaped, Bridge, Doombot, Doombot Legion, Bank, Sewers, Villain Deck 14); the H.Q. hero shop (Wolverine, Iron Man, Storm, Hawkeye, Spider-Man, Hero Deck 42) with class-colour accents; a bottom cockpit with the player's in-play and hand rows, the Attack 3 / Recruit 2 economy, and the Your Deck 18 / Discard 6 / Victory 4 piles; a slim right rail with the two opponent panels and the game log; and a sticky turn-action bar. Four caption cards below explain the redesign: one mat with real geography, the rail reclaims height, authored to the 1280×720 floor, and the skin layer intact.](/responsive-viewport-targets/play-mat-redesign01.jpg "width=100%")

***Rev 1.** Illustrative proposal mockup (not shipped) of a **spatial-board redesign** authored at exactly 1280×720 — the below-floor viewport above — so the board fits Tex's screen at 1:1 and scales up from there rather than horizontal-scrolling. It moves the opponent panels and game log into a right rail to reclaim vertical height, replacing the current fluid vertical stack. This is a design proposal, not a locked decision: adopting it would supersede the D-24251 fluid-scaling anchor and require its own `DECISIONS.md` entry and Work Packet. Per [SCHEMA.md](SCHEMA.md) this page records the proposal; it does not make the decision.*

![Rev 2 of the play-mat redesign proposal, same spatial board on the dark theme at 1280×720, revised after a gameplay-service review. Differences from Rev 1: the viewport control is relabelled "Preview scale — grid is fixed at 1280×720" with the floor button reading "authoring floor · 1.00×"; the cockpit's Your Hand is a horizontally-scrolling well of ten cards (Officers, Tactician, Iron Man, Trooper, Cyclops, Black Cat, Thing) with an overflow arrow, labelled "draw-6 is cleanup size, not a hand cap"; the In Play This Turn well shows three played cards plus a dashed "Play here — tap a hand card" landing target; the occupied City spaces keep their place-names (Doombot on Rooftops, Doombot Legion on Streets); a dashed Transform side-deck rail (Loki, Agent of Asgard, +2) sits right of the Hero Deck; and a fifth caption card, "The cockpit holds a real hand", is added below.](/responsive-viewport-targets/play-mat-redesign02.jpg "width=100%")

***Rev 2.** The same geometry after a gameplay-service review of Rev 1. It keeps the rail, the locked City order, and the author-at-1280×720 policy, and fixes four fidelity gaps: the hand and in-play are now **horizontally-scrolling wells** bound to the full `handCards` / `inPlayCards` (Legendary hands routinely exceed six, so the row is never sliced to a fixed count); occupied City spaces **keep their place-names**; the **Transform Deck** (WP-664) rides an overflow rail right of H.Q.; and **1280×720 is stated as the fixed authoring grid**, not a device toggle. Twist/tactics denominators are bound to the projected `progress.schemeTwistThreshold` and mastermind tactics total — a fidelity fix independent of this layout, since the shipped build still paints a hardcoded `/8` and `/4`. Still a proposal, not a locked decision — the same D-24251 supersession, `DECISIONS.md` entry, and Work-Packet caveats as Rev 1 apply.*

![Rev 4 (the lock mock) of the play-mat redesign, the same 1280×720 spatial board on the dark theme, after two further review passes. Versus Rev 2 it corrects the two occupied City spaces to the locked left-to-right order — Doombot on Streets, Doombot Legion on Rooftops (Bridge, Streets, Rooftops, Bank) — reconciles the mastermind readout to a single source (Tactics 1/4 on the tile against a 3-card Tactics deck, HUD Strikes 2 matching the Master Strike pile, no invented HP fraction), relabels the status pill "no page scroll" (the hand and in-play wells scroll in-zone), and adds two controls to the bottom turn-action bar: an Undo button and a green Heal Wound button, sitting left of Pass priority and the red "End turn — draw 6". Everything else matches Rev 2: the fixed 1280×720 authoring grid with 1.00×/1.07×/1.50× preview scales, the right rail of opponent panels plus game log, the overflow-scrolling hand and in-play wells, and the Transform Deck rail right of the Hero Deck.](/responsive-viewport-targets/play-mat-redesign04.jpg "width=100%")

***Rev 4 — the lock mock, ratified as [`DECISIONS.md` D-24502](../docs/ai/DECISIONS.md).** The geometry is now a **locked design decision** (D-24502), prospectively superseding D-24251: the fixed 1280×720 authoring grid, the right rail, the locked City order, full-array hand/in-play binding, click-to-play into the in-play well, HQ-adjacent Transform Deck, and projection-bound denominators. D-24251's fluid stack **remains the shipped behavior until the implementation WP lands** — this entry ratifies the direction and governs that WP; it is not yet built. The two turn-bar controls are **scoped out of the geometry lock** and tracked separately: **Heal Wound** surfaces the shipped effect-driven `healWounds` mechanic (WP-379..382) as a conditional, stage-gated control (shown only when a heal is legal), and **Undo** is a genuinely new cross-layer feature — decided scope is **pre-commit, non-revealing** (undo your own actions this turn, never across a hidden-information reveal), pending its own decision + WP. (Rev 3 was a transient state — same board with the City labels still swapped and stale poster chrome — and is not archived here.)*

### Implementation status — D-24502 fully shipped (structure WP-685 + fit WP-688)

The D-24502 rebuild is **fully built**: the board a player sees today **fits
Tex's screen** (an effective 1280×720) with no page scroll.

**Structure (WP-685).** `<PlayDesktop>` was rebuilt from the D-24251 fluid
vertical stack into the spatial layout: a **two-column grid** with the shared
board + cockpit in the main column and the **opponent panels + game log in a
right rail**; the adversary-band and cockpit regroup; the hand and in-play as
**horizontally-scrolling wells** bound to the full arrays (never sliced); and the
empty in-play "play here" landing target. The occupied City place-names and the
projection-bound twist/tactics denominators were already in place.

**Fit to floor (WP-688 / D-24505).** The structural slice alone did not fit —
the live check found the board still ~1360px tall and **vertically scrolling at
1280×720**. The root cause was **structural, not just tile size**: `.app-shell`
is a flex column (brand header + `flex:1` content + footer), but `.play-viewport`
forced `min-height: 100vh`, so below a ~68px header + ~55px footer the page was
always `68 + 100vh + 55` and page-scrolled no matter how short the board. WP-688
fixes it, **at ≥768px only** (the D-12909 `<PlayMobile>` column is untouched):
`<main>` (on the play routes) and `.play-viewport` fill the flex gap instead of
forcing 100vh, and `<PlayDesktop>` is authored inside a fixed-width stage and
**scaled to fit** by `useScaleToFit` (a DOM-geometry composable), with a
`.play-desktop`-scoped card/spacing compaction keeping the scale readable.

**Realized behavior (D-24026 live-verified 2026-09-10).** 1280×720 fits with no
page scroll (~0.61×, readable), 1366×768 (~0.66×), 1920×1080 (~0.98× — the same
layout scaled up, no rewrap); ≤767px still renders `<PlayMobile>`. The sub-1366
failure this page documents is **fixed**. (The D-24502 illustrative ladder of
1.00/1.07/1.50 was drawn against the ~720px-natural Rev-4 mock; the real content
is denser, so the fit is height-bound first — the binding intent, "fit the floor
and scale up, never rewrap", holds.)

**Later refinements (2026-09-11, operator feedback).** Two follow-ups tightened
the shipped board:

- **Adversary band on one row.** The shared supply decks (Wounds / Horrors /
  Bystanders / S.H.I.E.L.D. Officers / Sidekicks) + KO pile were wrapping to a
  second row below the Mastermind/Scheme; the band is now `flex-wrap: nowrap`, so
  they sit on one line to the **right of the Scheme**, filling that space. The
  shorter board lets `useScaleToFit` scale it a touch larger.
- **Full-page scroll to reach a response prompt (D-24505 carve-out).** Normal
  play still shows **no page scroll**, but a pending-choice prompt that requires a
  response temporarily grows the board. Rather than shrink the whole board to cram
  the prompt on-screen (or clip it out of reach), `useScaleToFit` now **excludes
  the prompt block's height** from the fit — so the board holds its resting scale —
  and **reserves the full scaled height** as the fit container's `min-height`, so
  the whole **page scrolls** to reach the prompt. Live-verified at 1280×720: no
  prompt → no page scroll; a tall prompt → scale held + page scrolls to it; prompt
  resolved → no-scroll restored.

![The SHIPPED `<PlayDesktop>` board captured at 1280×720 (the mid-turn fixture) — the real build, not a mock. The whole board sits within the viewport with no page scroll: a top HUD bar (Mastermind Doctor Octopus, Scheme Midtown Bank Robbery, Turn 3, Twists 2/8, Tactics 1/4, Skin: Classic); an adversary band (the Doctor Octopus Mastermind tile with Master Strikes 0, the Midtown Bank Robbery Scheme with Twists 2/8 and Resolved Twists 0, and the shared supply — Wounds 24, Horrors 0, Bystanders 8, S.H.I.E.L.D. Officers 22, Sidekicks 13, KO Pile 0); the City battle-line in the locked left-to-right order Escaped, Bridge, Streets (Vulture), Rooftops, Bank (Electro), Sewers (Shocker), Villain Deck 28, with occupied spaces keeping their place-names; the H.Q. shop (Dp Weapon X, Sm Hero For Hire, an empty slot, Dp Chimichangas, Sm Web Slinger, Hero Deck 42); the cockpit — Played This Turn (Web Slinger, Chimichangas), the Attack 4/4 · Recruit 3/3 economy, Your Victory Pile, and Your Deck 12 / Discard 3 — with Your Hand of five unplayed cards below; a slim right rail holding the opponent panel and the game log; and the turn-action bar (Step 1 / Step 2 Play-Recruit-Fight with Pass priority + Heal Wounds / Step 3) sitting cleanly at the BOTTOM of the cockpit, no longer overlapping the played/economy/victory zones — the WP-689 fix.](/responsive-viewport-targets/play-mat-1280x820.jpg "width=100%")

*The shipped result at 1280×720 (WP-688 fit + WP-689 turn-bar fix). Unlike the Rev 1/2/4 images above — which are design **proposals** — this is a screenshot of the real build: the board fits the floor with no page scroll, and the turn-action bar sits at the bottom of the cockpit. At wider viewports the same layout scales up (~0.98× at 1920), never rewrapping.*

### Fluid desktop scaling — shipped (WP-430 / D-24251)

The desktop surface now **scales fluidly across the desktop resolution
ladder and caps on ultra-wide / 4K monitors** — resolving what this
section previously flagged as an open question. Shipped by **WP-430**,
locked in [`DECISIONS.md` D-24251](../docs/ai/DECISIONS.md), and
**additive to the D-12909 767px split** (the mobile side is unchanged):

- **Centered max-width cap.** `.play-desktop` caps at **1600px** with
  `margin-inline: auto`, so beyond the cap the board gains margin, not
  oversized cards.
- **Fluid sizing between a 1366px floor and the cap.** A `--play-gutter`
  and three `--card-width-*` tokens use `clamp()`; the card `clamp()`
  **floor equals the former fixed sizes (60/90/120px)**, so tiles only
  grow (never shrink) and `aspect-ratio: 5 / 7` is preserved.
- **Checkpoint media queries at 1440 / 1920 / 2560px** tune inter-zone
  spacing for those tiers — not new layouts (the D-12901/D-12902 zone
  placement is preserved).

The six size tokens live in `apps/arena-client/src/styles/base.css`; the
cap + centering + checkpoints in `PlayDesktop.vue`; the fluid card widths
in `CardTile.vue`. Verified live (D-24026) at 2560 (capped + centered, no
horizontal scroll), the 1366 floor (no horizontal scroll, cards at their
floor), and ≤767 (mobile unchanged). The exact `clamp()` curves remain
tunable within the locked anchors (cap 1600, floor 1366, the three
checkpoints, floor-preserving card widths).

## Interactions

- **[Design System Overview](design-system-overview.md)** — the
  sensory/feel layer (juice, audio, narrative) renders *into* the
  viewport layout described here; the two are complementary frames on
  the same play surface.
- **[Play Diagnostics](play-diagnostics.md)** — the client-side
  capture/export tool lives in the same `apps/arena-client` surface and
  is the fastest way to snapshot what a given viewport actually rendered.
- **[Development Workflow](development-workflow.md)** — how to run the
  arena-client dev server and resize-test a layout against the reference
  resolutions above.
- **`DESIGN-BOARD-LAYOUT.md`** — the draft wireframe that owns the eight
  visual zones and their placement; this page owns the *breakpoint and
  screen-target* concern, that document owns *where each zone sits*.

## Edge Cases

- **No `window` (SSR / tests without jsdom):** `useViewport` defaults to
  desktop (`isDesktop = true`), so page-level SFCs render the desktop
  layout when no media query is observable.
- **Orientation is ignored — the split is width-only.** An iPad in
  portrait (768px) and in landscape (~1024–1366px) both exceed 767px and
  therefore both get the **desktop** layout. Only genuinely narrow
  widths (phones in portrait) fall to mobile.
- **Ultra-wide and 4K are capped and centered.** `.play-desktop` caps at
  1600px with `margin-inline: auto` (WP-430 / D-24251), so very large
  monitors gain margin rather than oversized cards — see *Fluid desktop
  scaling — shipped* above.
- **Browser zoom pushes 1080p under the floor.** The split and the fluid
  floor both key off the *effective* CSS viewport, not the native
  resolution. A native 1920×1080 monitor at 150% zoom reports 1280×720 —
  86px under the 1366px floor — so the desktop board overflows and
  horizontal-scrolls. Observed with a real player (Tex). See *Browser
  zoom shrinks the effective viewport below the floor* above; the fix is
  a floor change (code + `DECISIONS.md`), not a doc edit.
- **The mobile range is draft and secondary.** 375×667–414×896 is design
  intent from a draft wireframe; mobile is a nice-to-have for launch, not
  the primary target, and its numbers may move when a board-layout WP
  formalizes it.

## References

- `apps/arena-client/src/composables/useViewport.ts` — the
  `BREAKPOINT_MOBILE_MAX_PX = 767` constant and the `matchMedia` observer
  (authoritative for the breakpoint value).
- `apps/arena-client/src/pages/PlayViewport.vue` — the desktop/mobile
  discriminator.
- `apps/arena-client/src/pages/PlayDesktop.vue` — the desktop landscape
  page and its 1280×800–1920×1080 design range.
- [`docs/ai/DESIGN-BOARD-LAYOUT.md`](../docs/ai/DESIGN-BOARD-LAYOUT.md)
  §1 (open questions), §3.1 (desktop wireframe), §3.2 (mobile wireframe)
  — draft, non-normative.
- [`docs/ai/DECISIONS.md`](../docs/ai/DECISIONS.md) — D-12909 (breakpoint),
  D-12901 (Mastermind top-left), D-12902 (opponents top edge).
- [Design System Overview](design-system-overview.md) — the companion
  feel-layer north-star page.
