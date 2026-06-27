---
title: Legendary Forge — Diorama Platform
type: Guide
tags:
  - diorama
  - legendary-forge
  - hardware
  - venture
  - family-stem
  - bookshelf-nook
related:
  - hugo-web-system.md
status: draft
source:
  - https://github.com/barefootbetters/legendary-forge (private — canonical)
last-reviewed: 2026-06-26
---

> 📍 **Overview page.** The Legendary Forge diorama venture lives in its own
> **private repository**, kept separate from this engine monorepo so it stays a
> cleanly separable, sellable asset. This page is the collaborator-facing overview
> on the (authenticated) ewiki. The **canonical** docs — and the deepest buildable
> detail (exact BOM part numbers, full connector spec, P1 procedure) — live in the
> private repo: <https://github.com/barefootbetters/legendary-forge>.

## Vision

> **"Build a world together. Keep the memory for life."**

Parents and kids still crave the magic of building miniature worlds — glowing
streetlights, swinging signs, tiny alleyways — but modern life took the **space**
(no spare 4×8 table) and the **time** (projects that drag for months). Legendary
Forge gives both back: a complete, reconfigurable **bookshelf-scale** diorama a
parent and child fully assemble, light, and animate **in one afternoon** on the
kitchen table. The finished build lives on the shelf as a daily reminder of
something they made *together* — not another screen, not another toy boxed after a
week.

## Summary

**Legendary Forge** is a plug-and-play bookshelf diorama platform: a magnetic
grid, snap-in lighting and motion modules, and Bluetooth audio that a parent and
child build together in one afternoon — **no coding, no soldering, nothing to
debug**. The business model is **razor-and-blades**: an accessible ~$100 Starter
Kit plus high-margin Expansion Packs. It is sold through
[legendary-arena.com/diorama](https://www.legendary-arena.com/diorama).

It's a **V2** design. V1 was a code-it-yourself Raspberry-Pi kit that gated the
market to hobbyists; V2 removes the coding barrier by relocating that complexity
into manufacturable, warrantied hardware — a bigger market and a bigger capital
bet, with the costs (NRE, COGS, RMA, certification) named honestly in the master
plan.

## Target users & the one-afternoon build

**Primary buyer:** a parent (≈30–45) who wants meaningful hands-on time with a kid
(≈6–12) — drawn to the nostalgia of model building but put off by the mess,
duration, and skill floor of traditional kits.

**The build session (target 2–4 hours):**

1. Flat-pack frame assembly (~10–15 min, a screwdriver).
2. Drop in the grid; power-up test.
3. Snap Smart Boots and props anywhere → instant lighting.
4. Plug in one or two motion modules.
5. Pair Bluetooth audio, pick a soundtrack.
6. Optional: add a backdrop card or a second theme layer.

**Outcome:** a finished, living diorama on the shelf before dinner — zero loose
wires, zero "it doesn't work and I don't know why." The educational layer is
subtle: real magnets, circuits, motors, and cause-and-effect, with an optional
"See How It Works" STEM pack for kids who want to go deeper.

## Architecture — five plug-and-play systems

![System architecture — the five plug-and-play systems and how they connect](/legendary-forge/system-architecture.png "width=50%")

1. **Magnetic grid (Lite-Brite).** Conductive floor/wall plates; snap a magnetic
   "Smart Boot" figure on anywhere and it lights up. No wiring.
2. **Smart Hub (the power strip).** A sealed box with labeled low-voltage ports —
   **Always On / Pulse / Flicker / Swing Motor / Spin Motor**. No Pi, no SD card,
   no code.
3. **No-code motion modules (Snap-Circuits).** Sealed motor boxes (Swinger,
   Spinner) with a captive cord that plugs into the matching Hub port.
4. **Bluetooth audio.** Pair a phone, play anything.
5. **Backdrops.** A rear slot for a printed card or a slid-in tablet loop.

## The Smart Hub

![Smart Hub front panel — five color-coded labeled ports, theme/speed knob, master switch, status LEDs](/legendary-forge/smart-hub-front-panel.png "width=50%")

Fixed-firmware, Arduino-class controller. The whole interface is five labeled
ports, a theme/speed knob, and an on/off switch. **Match the cord's label to the
port — that's the whole manual.**

## Connector strategy — two interfaces

The connector *is* the product; it's the make-or-break. There are **two** distinct
contact problems, designed separately:

**Interface A — Smart Boot ↔ grid (lighting).** Low-power, static,
magnetic-*anywhere* — a keyed dock would kill the "snap anywhere" mechanic, so
reliability comes from contact geometry and materials (wiping pogo pin, plating).

![Smart Boot contact cross-section — ring magnet (GND + hold), recessed pogo pin (+5V), sealed LED+resistor, against the steel-plate/copper-strip grid](/legendary-forge/smart-boot-cross-section.png "width=50%")

**Interface B — module ↔ frame/Hub (motion).** Vibration + motor stall current →
a **hybrid**: magnets to align, a mechanical anti-shear constraint (dock pocket +
micro-lip), and redundant power pins through a keyed cord.

![Module connector stack — module in a dock pocket with alignment magnets and micro-lip anti-shear, captive keyed cord to the Hub port, and the pin allocation](/legendary-forge/module-connector-stack.png "width=50%")

## Business model — razor & blades

- **Razor — Starter Kit (~$100):** grid frame, Smart Hub + Bluetooth audio,
  starter Smart Boots, one launch theme (Street/Alley), certified 5V USB supply.
- **Blades — Expansion Packs:** sealed motion modules, theme packs, backdrop-card
  multipacks, Smart Boot refills, and an optional STEM "See How It Works" pack.
  The blades carry the margin; the Starter Kit gets a customer into the ecosystem.

The current model is **à-la-carte blades**, not fixed bundle tiers; specific tier
bundles and final price points are worked in the GTM notes, not fixed here.

Launch is **platform-agnostic** — Street/Alley as the hero example, generic /
affiliate-sourced figures at launch; licensed-character integration deferred.

## Regulatory headline

Treat it as a **toy from day one**: the mandatory U.S. toy standard (ASTM F963 via
the CPSIA) governs, with magnet-ingestion requirements front and centre. The Smart
Boot magnet must be encapsulated to standard; age rating + CPSIA testing scope and
FCC (for the Bluetooth module) are gating items before tooling. Full treatment in
the master plan's regulatory section.

## Status & next step

Design is stabilized; the project is at the **prove-it-in-hardware** transition.
The next step is the **P1 connector prototype** — one port end-to-end (LED → motor)
plus the grid bench — gated on a binary **A1–A7** acceptance set (self-alignment
±3 mm, no-disconnect side-bump, no-flicker vibration, 200+ cycles, full-load
no-brownout, reverse-proof, partial-engagement clean-fail). No tooling, PCB fab,
or inventory until P1 passes and a demand signal appears.

## Competitive differentiation

Most "book nook" / bookshelf-diorama kits on the market today are **static wooden
puzzles** — glue, hours of assembly, fixed once built, with basic battery-LED or
copper-tape lighting. Beautiful, but non-reconfigurable and time-intensive.
Legendary Forge wins on:

- **True reconfigurability** — "snap anywhere" lighting + a modular grid.
- **Zero wiring / zero code** — sealed, child-safe modules.
- **One-afternoon completion** with the kid participating.
- **An expandable motion + audio layer** a static kit can't touch.
- **Razor-and-blades economics** that keep the platform alive and improving for
  years.

It competes more with book-nook kits and Snap Circuits / LEGO than with anything
on a typical toy shelf — see the master plan's positioning section.

## Open questions & future opportunities

- Addressable per-boot LEDs (more magic, higher cost — possible V3).
- Deeper audio↔motion sync vs. plain Bluetooth passthrough.
- An optional companion app for custom patterns (post-launch; never required for
  the core joy).
- Larger / connectable diorama systems for advanced builders.
- A physical-digital bridge to the Legendary Arena card game or other IP.
- Repairability and a second-hand theme/marketplace.

## Canonical docs (private repo)

<https://github.com/barefootbetters/legendary-forge>

| Doc | What |
|-----|------|
| `docs/master-plan.md` | Product master plan (V2), illustrated — the source of truth |
| `docs/connector-spec.md` | Connector spec + pass/fail test protocol |
| `docs/p1-prototype-build-plan.md` | P1 bench parts list (specific part series) + build steps |
| `docs/gtm-and-resourcing.md` | Go-to-market, ICP, roadmap, break-even |
| `assets/diagrams/` | Editable SVG sources for the diagrams above |

## References

- Marketing / waitlist: <https://www.legendary-arena.com/diorama>
- Canonical docs (private): <https://github.com/barefootbetters/legendary-forge>
