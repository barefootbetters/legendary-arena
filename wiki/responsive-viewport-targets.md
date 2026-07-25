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
last-reviewed: 2026-07-25
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
and tested against, and the **open question** of fluid desktop scaling
that has *not* been decided. It is descriptive — it records the current
posture and cites where each value lives. It does not set new layout
policy; per [SCHEMA.md](SCHEMA.md) that belongs in
[`DECISIONS.md`](../docs/ai/DECISIONS.md) and a board-layout Work Packet.

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

The desktop layout is authored to *fill* that range — it does not yet
fluidly rescale beyond 1920 or below 1280 (see *Open question* below).

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
  | 2560×1440 | Larger / higher-end monitors | Should look good, not stretched |

Treat these as anchors to resize-test against, and revisit the whole
section once live analytics exist.

### Open question — fluid desktop scaling (NOT decided)

The current model is a **binary split with a fixed desktop design
range**. It does **not** yet: (a) fluidly rescale the play surface across
the full desktop resolution ladder, or (b) cap the play area on
ultra-wide / 4K monitors so cards stop stretching.

A candidate direction has been floated but **not adopted**: a comfortable
desktop floor around **1366px**, checkpoints near **1440 / 1920 /
2560px**, and a centered **max-width cap (~1600px)** on the play area so
huge monitors gain margin rather than oversized cards. These are exactly
the kind of "open layout questions"
[`DESIGN-BOARD-LAYOUT.md §1`](../docs/ai/DESIGN-BOARD-LAYOUT.md) says a
future board-layout WP is meant to lock.

Adopting any of these values is a **design decision** and must land in
[`DECISIONS.md`](../docs/ai/DECISIONS.md) plus a Work Packet before it is
real. This page records the question; it does not answer it.

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
- **Ultra-wide and 4K have no cap today.** With no max-width on the play
  area, the desktop layout can stretch past its 1920-wide design point on
  very large monitors — the unresolved item in *Open question* above.
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
