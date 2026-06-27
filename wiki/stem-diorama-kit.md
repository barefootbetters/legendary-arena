---
title: STEM Diorama Kit (SDK-1)
type: Guide
tags:
  - diorama
  - stem-diorama-kit
  - hardware
  - education
related:
  - legendary-forge.md
status: draft
source:
  - https://github.com/barefootbetters/stem-diorama-kit (private — canonical)
last-reviewed: 2026-06-27
---

> 📍 **Overview page.** The **STEM Diorama Kit (SDK-1)** is a deliberately
> *decoupled, shareable* educational build of the diorama, kept in its **own
> repository** so it can be shared, handed to a builder, or open-sourced without
> ever exposing the proprietary [Legendary Forge](legendary-forge.md) connector
> IP. Canonical files live in the repo:
> <https://github.com/barefootbetters/stem-diorama-kit>.

## Summary

SDK-1 captures the *spirit* of the [Legendary Forge](legendary-forge.md) diorama
— a lighted, modular, snap-together shelf scene — using **commodity parts only**
(Arduino Nano, off-the-shelf magnets, JST/Dupont connectors, micro servos). It's
designed to be built in a high-school makerspace in a session or two, with
everything visible and serviceable so the builder actually learns how it works.
It originated as a buildable version for a robotics-class student.

## How it differs from Legendary Forge (the IP boundary)

SDK-1 is the **"inferior but buildable"** version — and that's the point. The
proprietary connector system (the make-or-break IP) stays in the private
[Legendary Forge](legendary-forge.md) repo; SDK-1 never reproduces it.

| | SDK-1 (this kit) | Forge system (out of scope here) |
|---|---|---|
| Purpose | Educational, shareable | Productized, sellable |
| Connections | Manual, visible | Precision, hidden |
| Tolerances | Loose (≥ ±2 mm) | Tight |
| Alignment | Magnet assist only | Self-aligning interface |
| Home | `stem-diorama-kit` repo | `legendary-forge` (private IP) |

The firewall is enforced in the spec (§1 hard constraints, §9 explicit
non-features): no proprietary connector geometry, no keyed / blind-mate or
self-aligning interfaces, no hidden bus — everything visible and
user-serviceable.

## What's in the kit

- **Spec** (`docs/sdk-1-spec.md`) — the buildable contract: architecture, BOM,
  acceptance tests, IP firewall.
- **Assembly guide** (`docs/assembly-guide.md`) — step-by-step one-tile build.
- **Shopping list** (`docs/shopping-list.md`) — orderable parts + rough cost.
- **Firmware** (`firmware/sdk1_tile/`) — Arduino sketch: LED modes (Always On /
  Pulse / Flicker), button, optional servo + speed knob.
- **CAD** (`cad/`) — parametric OpenSCAD: tile base, LED-strip holder, Nano
  mount, SG90 servo bracket.
- **Diagrams** (`docs/images/`) — wiring, tile layout, part previews, assembled
  concept, all-parts overview.

## Tiling (expansion)

A single 150 mm tile is about one 6-inch figure's footprint; tiles compose edge
to edge into bigger scenes (a 2×2 makes a roomy multi-figure environment). The
join stays **dumb** — abutment + drop-in alignment pins + visible jumpers, never
an integrated edge connector — so tiling never drifts into Forge connector IP
(spec §11).

## Status

A complete first printable build packet: spec, guide, shopping list, firmware,
four CAD parts, and diagrams. CAD is validated by inspection (not yet
rendered/printed). Open item, deliberately deferred: an edge-face magnet variant
for tile-to-tile latching — drop-in alignment pins are the IP-safe answer.

## Canonical repo

<https://github.com/barefootbetters/stem-diorama-kit>

| Path | What |
|------|------|
| `docs/sdk-1-spec.md` | Buildable spec — architecture, BOM, tests, IP firewall |
| `docs/assembly-guide.md` | Step-by-step one-tile build |
| `docs/shopping-list.md` | Orderable parts + rough cost |
| `firmware/sdk1_tile/` | Reference Arduino sketch |
| `cad/` | Parametric OpenSCAD parts |
| `docs/images/` | Wiring/layout diagrams, part previews, assembled concept |

## References

- Canonical repo: <https://github.com/barefootbetters/stem-diorama-kit>
- Parent venture: [Legendary Forge — Diorama Platform](legendary-forge.md)
- Marketing / waitlist: <https://www.legendary-arena.com/diorama>
