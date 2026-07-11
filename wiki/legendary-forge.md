---
title: Legendary Forge — Diorama Platform
type: Guide
tags:
  - diorama
  - legendary-forge
  - hardware
  - venture
related:
  - hugo-web-system.md
status: draft
source:
  - https://github.com/barefootbetters/legendary-forge (private — canonical)
last-reviewed: 2026-07-11
---

> 📍 **Overview page.** The Legendary Forge diorama venture lives in its own
> **private repository**, kept separate from this engine monorepo so it stays a
> cleanly separable, sellable asset. This page is the collaborator-facing overview
> on the (authenticated) ewiki. The **canonical** docs — and the deepest buildable
> detail (exact BOM part numbers, full connector spec, P1 procedure) — live in the
> private repo: <https://github.com/barefootbetters/legendary-forge>.

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

## What it looks like assembled

![Shelf-ready core display — an assembled high-tech sci-fi diorama room with blue LED lighting holding one to four 6-inch figures, annotated with external dimensions (14 × 10 × 12 in), a 6-inch figure scale reference, and front/side/top views](/legendary-forge/core-display-render.jpg)

The shelf-ready **Core Display**: external footprint **14 × 10 × 12 in**, sized
for a bookshelf and one to four 6-inch figures. The systems below are how it
gets there.

## The experience — one afternoon

The build is deliberately simple and repeatable:

1. **Frame assembly** — flat-pack; minutes, not hours.
2. **Grid & figures** — snap Smart Base-equipped figures anywhere on the powered
   grid; they light up automatically.
3. **Motion & effects** — plug a sealed Swinger or Spinner module into the
   matching labeled Hub port. Match the cord label — that's the entire
   instruction.
4. **Audio** — pair a phone over Bluetooth; play anything (narration,
   soundtrack, ambient).
5. **Scene change** — swap printed backdrop cards, or slide in a tablet loop.

The result stays visible and playable daily — no dedicated hobby room required.
The learning (magnets, circuits, motors, mechanisms) is experiential and
optional: kids absorb it by building, and the opt-in STEM tier makes it
explicit for the families who want that.

## Architecture — five plug-and-play systems

![System architecture — the five plug-and-play systems and how they connect](/legendary-forge/system-architecture.png "width=50%")

1. **Magnetic grid (Lite-Brite).** Steel-backed powered-surface panels; snap a
   magnetic "Smart Base"-equipped figure on anywhere and it lights up. No wiring.
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
port — that's the whole manual.** The knob scales intensity and animation tempo
across the connected ports; ports and cords are color/icon-coded to make the
match obvious at a glance. Fixed firmware generates every effect — the user
never configures anything beyond physical connections.

## Connector strategy — two interfaces

The connector *is* the product; it's the make-or-break. There are **two** distinct
contact problems, designed separately:

**Interface A — Smart Base ↔ grid (lighting, Rev B).** Low-power, static,
magnetic-*anywhere* — a keyed dock would kill the "snap anywhere" mechanic, so
reliability is bought with contact geometry. **Rev B** (2026-07-11 design
review): magnets are retention-only and fully encapsulated — they never carry
current — and all conduction goes through a ring of gold pogo pins with an
onboard rectifier, against alternating-polarity strips on an insulated PCB face
over a plain steel backer. Pin tips narrower than the strip gaps make +/−
shorts geometrically impossible; the pin ring makes placement and rotation
irrelevant. (The original magnet-as-ground-conductor design shorted on
arbitrary placement and fought the magnet-safety encapsulation rules — full
rationale in the private repo's master plan §4.)

![Smart Base contact cross-section — encapsulated retention-only magnets, ring of gold pogo pins with bridge rectifier, sealed LED+resistor, against the steel-backed alternating-polarity PCB grid](/legendary-forge/smart-boot-cross-section.png "width=50%")

**Interface B — module ↔ frame/Hub (motion).** Vibration + motor stall current →
a **hybrid**: magnets to align, a mechanical anti-shear constraint (dock pocket +
micro-lip), and redundant power pins through a keyed cord.

![Module connector stack — module in a dock pocket with alignment magnets and micro-lip anti-shear, captive keyed cord to the Hub port, and the pin allocation](/legendary-forge/module-connector-stack.png "width=50%")

## Business model — razor & blades

- **Razor — Starter Kit (~$100):** grid frame, Smart Hub + Bluetooth audio,
  starter Smart Bases, one launch theme (Street/Alley), certified 5V USB supply.
- **Blades — Expansion Packs:** sealed motion modules, theme packs, backdrop-card
  multipacks, Smart Base refills, and an optional STEM "See How It Works" pack.
  The blades carry the margin; the Starter Kit gets a customer into the ecosystem.

Launch is **platform-agnostic** — Street/Alley as the hero example, generic /
affiliate-sourced figures at launch; licensed-character integration deferred.

## Regulatory headline

Treat it as a **toy from day one**: at an 8+ age grade the mandatory U.S. toy
standard (ASTM F963 via 16 CFR 1250) governs, with magnet requirements front and
centre — and relabeling 14+ does *not* escape magnet regulation (16 CFR 1262
scopes by purpose, court-upheld 2025). The compliant path is **non-separable,
fully encapsulated magnets**, which the Rev B retention-only design satisfies by
construction; the enclosure must still survive use-and-abuse testing without
liberating a magnet. Age rating + CPSIA testing scope and FCC (pre-certified BT
module, plus host-level Part 15B SDoC + composite spot-check) are gating items
before tooling. Full treatment in the master plan's regulatory section.

## Risks & mitigations (high-level)

- **Connector reliability / user error** → the P1 randomized-placement gate
  (Interface A) plus mechanical keying and labeled cords (Interface B); a flaky
  contact on an "it just works" toy is a one-star review, so the connector
  gates everything.
- **Magnet regulation** → Rev B encapsulation-by-design (retention-only,
  non-separable magnets under ASTM F963's routing) + use-and-abuse testing on
  the Smart Base enclosure.
- **Certification timeline & cost** → front-loaded in the master plan; no
  tooling until the regulatory path is confirmed with a compliance consultant.
- **NRE / supply chain** → phased build (hand-built → low-volume → tooled) per
  the master plan's economics section; multiple manufacturing quotes early.
- **Market adoption** → accessible razor pricing, the Saturday-project family
  pitch, and cross-promotion to the Legendary Arena audience; demand signal
  (waitlist / pre-orders) required before inventory spend.

## Status & next step

Design is stabilized at **Rev B** (contact architecture revised by the
2026-07-11 design review); the project is at the **prove-it-in-hardware**
transition. The next step is the **P1 connector prototype** — one port
end-to-end (LED → motor) plus the grid bench — gated on a binary **A1–A8**
acceptance set (dock self-alignment ±3 mm, no-disconnect side-bump, no-flicker
vibration, 200+ cycles, full-load no-brownout, reverse-proof,
partial-engagement clean-fail, and the new **randomized-placement gate**: ≥100
random position/rotation drops with zero dead placements and zero shorts). No
tooling, PCB fab, or inventory until P1 passes and a demand signal appears.

## Open items (tracked in the master plan §13)

The living tracker is the master plan's Open Questions section; highlights a
collaborator should know exist:

- Final age rating + CPSIA testing scope (consultant engagement runs in
  parallel with P1).
- BOM cost model + real margins to replace the placeholder economics.
- Manufacturing-partner shortlist and tooling quotes.
- Family playtest protocol — assembly time, delight moments, pain points.
- **Legendary Arena integration** — themed dioramas tied to game lore,
  digital-physical linking — deliberately deferred, not forgotten.
- Marketing visuals for the public page: exploded view of the grid layers and
  module mating, an in-use parent-and-child render, packaging/unboxing
  concepts, lifestyle shelf shots.

## Sibling project — STEM Diorama Kit (SDK-1)

Running alongside the Forge venture is the **STEM Diorama Kit (SDK-1)** — a
deliberately *decoupled, shareable* educational build that captures the spirit of
the diorama (lighted, modular, snap-together shelf tiles) using **commodity parts
only** (Arduino Nano, off-the-shelf magnets, JST/Dupont, micro servos), fabricable
in a school makerspace in a session or two with everything visible and serviceable.

It lives in its **own repo** on purpose, so it can be shared, handed to a builder,
or open-sourced **without ever exposing the Forge connector spec or P1 build
plan**. An IP firewall (`docs/sdk-1-spec.md` §1 and §9) forbids proprietary
connector geometry, hidden or sub-±1 mm alignment, keyed/blind-mating interfaces,
and any tile-to-tile auto-addressing — everything in SDK-1 stays off-the-shelf,
traceable by eye, and hand-serviceable. Treat it as the educational counterpart,
**not** a source of canonical Forge detail.

Repo (private): <https://github.com/barefootbetters/stem-diorama-kit>

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
- STEM Diorama Kit (SDK-1), shareable educational sibling (private): <https://github.com/barefootbetters/stem-diorama-kit>
