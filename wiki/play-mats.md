---
title: Play Mats
type: Guide
tags:
  - play-board
  - physical-accessory
  - merchandise
  - print-and-play
  - designer-reference
related:
  - play-board.md
  - legendary-forge.md
  - ip-licensing.md
  - card-image-acquisition.md
  - design-system-overview.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\play-mats.md (this page — https://ewiki.legendary-arena.com/play-mats/)
  - https://www.legendarycardgame.com/promo-cards
  - https://upperdeckstore.com/legendaryr-playmat-dark-phoenix-vs-the-x-men.html
  - https://upperdeckstore.com/marvel-thanos-playmat.html
  - https://upperdeckstore.com/marvel-wolverine-playmat.html
  - https://boardgamegeek.com/boardgameaccessory/157107/legendary-a-marvel-deck-building-game-playmat
  - https://boardgamegeek.com/boardgame/129437/legendary-a-marvel-deck-building-game/files
  - https://icv2.com/articles/news/view/36546/upper-deck-launching-op-kits-marvel-legendary
  - https://github.com/ruler501/Marvel
last-reviewed: 2026-09-07
---

# Play Mats

## Summary

A **play mat** is the physical surface a Marvel Legendary game is set up on.
Three different objects get casually called a "mat," and they are not
interchangeable:

1. **Layout mat** — a printed surface with labelled card zones (City, HQ,
   Mastermind, Scheme, decks, stacks). This is the design reference for the
   digital [Play Board](play-board.md).
2. **Art-only mat** — a rubber TCG-style print with Marvel art and **no**
   Legendary zones. Decorative; not a zone spec.
3. **Cardboard game board** — the fold-out board that shipped in the original
   core set. Same zone vocabulary as a layout mat, different object.

This page catalogues those products so the team building the digital Play Board
and any future merchandise ([Legendary Forge](legendary-forge.md)) has one
reference for what the printed layouts look like and where they come from. It is
a **product / reference page, not an engine spec** — the digital board is
authoritative for zone behaviour; mat art is decorative.

Marvel Legendary mats come from two supply streams: **official Upper Deck
products** (boxed boards, rubber layout mats, organized-play mats, art-only
mats) and **fan-made printable layouts** that added spaces the official mats
never caught up to (Sidekicks, Horrors, Infinity Shards, extra City / plot
piles).

> **Status: draft.** Product facts below mix values verified against the Upper
> Deck store (SKUs 93433 / 93486 / 93490, confirmed by direct image lookup)
> with figures relayed from secondary sources (some model numbers, artist
> credits, and dimensions). Treat the secondary figures as best-available, not
> gospel, until a primary source is attached.

## Mechanics

### Who this page is for

| Audience | What to take from this page |
|---|---|
| Play Board / arena-client | The shared zone vocabulary. Do not pixel-match any one physical mat. |
| [Legendary Forge](legendary-forge.md) | What already exists in the market, at what sizes, and what a first-party mat would need to beat. |
| Art / IP | Which scans are official Upper Deck art vs fan files vs promo dumps. Licensing is a separate question — see [IP Licensing](ip-licensing.md). |
| [Card Image Acquisition](card-image-acquisition.md) | The `legendarycardgame.com` scrape also pulled mat photographs; those files stay in the playmats staging folder, not the card-naming pipeline. |

### The zone layout every layout mat shares

Every labelled Legendary layout mat prints the same core set of zones — the same
vocabulary the engine projects to the [Play Board](play-board.md). The official
**Dark Phoenix vs. The X-Men** mat is a clean example of the full label set:

![Dark Phoenix vs. The X-Men Legendary layout mat (Upper Deck SKU 93433) — Jean Grey as Dark Phoenix ablaze in the centre, with the full labelled zone layout: Twists, Scheme, Escape, Wounds, Bystanders across the top; Strikes, Mastermind, the five-space City row (Bridge, Streets, Rooftops, Bank, Sewers), and Villain Deck across the middle; Sidekicks, Officers, Hero Deck, and HQ along the bottom.](/play-mats/dark-phoenix-vs-xmen-playmat.jpg "width=100%")

| Mat label | Engine zone | Notes on physical mats |
|---|---|---|
| SCHEME | Active [Scheme](scheme.md) | Always present. |
| TWISTS | Scheme-twist stack | A small labelled box beside the Scheme. Not every official mat prints it. |
| STRIKES | Master Strike discard (see [Master Strike](master-strike.md)) | Same pattern as Twists — not on every mat. |
| MASTERMIND | Mastermind + tactics | One large slot; tactics tuck under or beside. |
| ESCAPE | Escaped villains pile | |
| CITY — BRIDGE · STREETS · ROOFTOPS · BANK · SEWERS | The five City spaces, left → right toward Escape | This left-to-right march is the one rule nearly every mat agrees on. |
| VILLAIN DECK | Villain deck | |
| WOUNDS | Wound stack | Later expansions add special wounds into this pile. |
| BYSTANDERS | Bystander stack | |
| SIDEKICKS · OFFICERS | Sidekick / Officer piles | Missing on the original cardboard board. Second Edition prints recruit costs (2 / 3) under the face-down decks. |
| HERO DECK | Remaining Hero cards not in HQ | Sometimes labelled, sometimes just implied beside HQ. |
| HQ | The five HQ recruit slots | |

The mat art changes per theme; the zones do not. That is why a single digital
board can render every scenario.

Physical mats disagree on **extras**. These appear on some (mostly fan) mats and
must not be promoted into engine-required zones: Horrors / Ambitions, an
Infinity Shards / Stones holding area, "plot" overflow stacked beside the
Scheme, a sixth City space, a separate Mastermind-tactics row, and the
Villains-side label set (below).

### Official products — retail layout mats

Sold on their own as "Legendary Playmat: *Theme*" — rubber-backed, roughly
32.5″ × 14.5″, with labelled zones **and** extra card spaces versus the original
cardboard board.

| Product | SKU | Artist | Status (2026-09) |
|---|---|---|---|
| Dark Phoenix vs. The X-Men | 93433 (verified) | Gil Martimiano da Silva Jr. | Listed ~$29.99 on the Upper Deck store and Amazon. Best currently-buyable official layout mat. |
| Thanos vs. The Avengers | 93431 (secondary source) | Caio Cacau | Frequently out of print / Amazon "currently unavailable". A working board replacement with extra expansion slots. |

The Thanos layout mat, photographed mid-set-up (Caio Cacau's signature is
visible lower-centre). **This is the labelled layout mat**, not the 24″ art-only
Thanos mat further down:

![The Legendary Playmat: Thanos vs. The Avengers layout mat by Caio Cacau, photographed in use — Thanos wielding the Infinity Gauntlet across the centre, decks sleeved in blue, gem tokens in the Sidekicks area, and a Thanos Mastermind card plus an Infinity Gauntlet Scheme card placed on their labelled spaces.](/play-mats/thanos-infinity-saga-playmat.jpg "width=100%")

### Official products — boxed boards and in-box mats

| Product | Year | Form | Layout? | Notes |
|---|---|---|---|---|
| Core Set (1st ed.) game board | 2012 | Folding cardboard | Yes — the classic City / HQ / stacks | The layout everyone still copies. Wears out; the 2014 rubber accessory replaced it. |
| Legendary Playmat (sold separately) | 2014 | Rubber layout mat, ~32″ × 14″ class | Yes | BGG accessory [157107](https://boardgamegeek.com/boardgameaccessory/157107/legendary-a-marvel-deck-building-game-playmat). Out of print; used copies on GeekMarket / eBay. |
| *Villains* standalone | 2014 | Rubber in-box mat | Yes — Villains vocabulary | Same five-space City geometry, flipped/renamed factions. Players consistently prefer it over the cardboard core board. |
| *Marvel Studios Phase 1* | 2018 | Rubber in-box mat | Yes — MCU-still art | Standalone / reskinned core (per BGG contents). |
| *Legendary: Second Edition* core | 2026 | Rubber-backed deluxe mat in the box | Yes | Ships with the 550-card core (~$99.99 on the Upper Deck store); the 2E rulebook shows Sidekick / Officer cost reminders printed on the mat. Compatible with older expansions. |

The **Villains** standalone renames the hero-side zones rather than changing the
geometry — PLOT / OVERRUN / COMMANDER / ADVERSARIES / NEW RECRUITS / HYDRA and a
LAIR where HQ sits, over the same five-space City:

![The Legendary Villains in-box play mat — a blue villain-themed layout labelled with Twists, Plot, Overrun, Bindings, Bystanders across the top; Strikes, Commander, the five-space City row (Sewers, Bank, Rooftops, Streets, Bridge), and Adversaries in the middle; New Recruits, Hydra, a central Lair strip, and Allies along the bottom, with a printed set-up table at the right.](/play-mats/villains-playmat.jpg "width=100%")

### Official products — organized-play mats

Upper Deck ran retailer store-event kits in 2017; each bundled a play mat with
promos.

| Kit | Mat | Bundled with |
|---|---|---|
| Organized Play Kit #1 | Loki vs. The Avengers, ~32″ × 14″, art by Bob Larkin | Acetate Loki Mastermind; 5 foil Thor rares; 25 alt-art foil *Unleash the Power of the Cosmic Cube* schemes. |
| Organized Play Kit #2 / #3 | Playmats (OPK2 / OPK3), scanned on legendarycardgame.com | Foil Daredevil (OPK2) / Symbiote Spider-Man (OPK3) promo sets. Mat themes are not well documented in secondary sources — caption from the scan, don't guess. |

The OPK1 mat is the classic Loki-vs-Avengers zone diagram — the same layout as
the 2014 rubber accessory and the original cardboard board:

![The Loki vs. The Avengers layout mat — Loki at far left, with Hulk, Hawkeye, Captain America, Thor, Iron Man, and Black Widow across a burning city, and the full Legendary zone layout labelled around the art.](/play-mats/avengers-core-playmat.jpg "width=100%")

Upper Deck's Organized Play Kit #1 promotional sheet shows the same mat with the
kit contents:

![Legendary Organized Play Kit #1 promotional sheet — the Loki vs. The Avengers play mat surrounded by an acetate Loki Mastermind card, a foil Thor rare, and an Unleash the Power of the Cosmic Cube scheme card, with an "Order Now — coming February 2017" burst.](/play-mats/organized-play-kit-1.jpg "width=55%")

### Official products — art-only Marvel mats

Upper Deck also sells generic Marvel rubber mats, 24″ × 13.5″, marketed as
usable with any game. **No City / HQ labels** — decorative only.

| Product | SKU | Do not confuse with |
|---|---|---|
| Marvel Thanos Playmat | 93486 (verified) | *Legendary Playmat: Thanos vs. The Avengers* (93431), which **is** a layout mat |
| Marvel Wolverine Playmat | 93490 (verified) | — |
| Marvel Spider-Man Playmat | — (~$20) | — |

The Thanos art-only mat reuses Caio Cacau's Thanos-vs-Avengers art with no zones
printed; the Wolverine and Spider-Man mats are pure art:

![Marvel Thanos art-only play mat (Upper Deck SKU 93486) — Caio Cacau's Thanos-versus-Avengers illustration with the Infinity Gauntlet at centre and no game zones printed.](/play-mats/thanos-art-mat.jpg "width=32%")
![Marvel Wolverine art-only play mat (Upper Deck SKU 93490) — a close-up of Wolverine mid-slash on a red field, with no game zones printed.](/play-mats/wolverine-art-mat.jpg "width=32%")
![Marvel Spider-Man art-only play mat (Upper Deck) — Spider-Man crawling head-first down a glass skyscraper toward the viewer, a spider descending on a web at right, full-bleed art with no game zones printed.](/play-mats/spider-man-art-mat.jpg "width=32%")

### Layout scans on legendarycardgame.com

Labelled layout photographs currently retrievable from the fan reference site
[legendarycardgame.com/promo-cards](https://www.legendarycardgame.com/promo-cards),
sitting among the promo-card scans under odd camera-roll filenames. Staged at up
to 2500 px in
`barefootbetters-legendary-setup/card-images-staging/original-jpeg/playmats/`;
the copies on this page are downscaled.

**Caption rule:** if a scan cannot be tied to an Upper Deck SKU, call it a
*layout scan*, not an *official product*. Dark City and Paint the Town Red — the
expansions — did **not** ship playmats, and the Upper Deck store lists no such
SKU (only Dark Phoenix, Thanos, and Wolverine mats). These are layout assets we
happen to have scans of:

![Dark City layout scan — Daredevil and red-clad Hand ninjas across a night city, with the full Legendary zone layout labelled around the art. A layout scan, not a confirmed retail SKU.](/play-mats/dark-city-playmat.jpg "width=49%")
![Paint the Town Red layout scan — Spider-Man battling Doctor Octopus and the Vulture on train tracks, with the full Legendary zone layout labelled around the art. A layout scan, not a confirmed retail SKU.](/play-mats/paint-the-town-red-playmat.jpg "width=49%")

### Fan-made / print-and-play layouts

What most long-time players use once a collection outgrows the official mats.
Starting point: [BoardGameGeek Files for Legendary](https://boardgamegeek.com/boardgame/129437/legendary-a-marvel-deck-building-game/files).

| Design | Size target | Why it matters |
|---|---|---|
| zeroeo (updated 2020) | ~24.5″ × 28.5″ full table + a separate Mastermind mat | Extra expansion spaces incl. an Infinity Shards slot; built rotated for Inked Gaming oversized/two-player upload. [BGG file 121186](https://boardgamegeek.com/filepage/121186/040920-updated-marvel-legendary-play-mats-heroes-a). |
| MrWorley Universal Mat | 14″ × 28″ oversized | Updated for Sidekicks / Horrors; often recommended as the "not too busy for teaching" option. |
| Player / theme variants | 14×24, 14×28, 24×28 | Avengers, X-Men, Spider-Man, Villains-side, minimalist. Quality varies. |
| [ruler501/Marvel](https://github.com/ruler501/Marvel) | mixed; some sized for 10″ printing | A print-and-play repo — `Playmats/`, `Examples/`, box-cutout templates, card-logo art. Personal-use, not a commercial licence. |

**Where people print them:** [Inked Gaming](https://www.inkedgaming.com/) (custom
oversized ~14″ × 28″ or two-player ~24″ × 28″; the US community default; wait for
sales), Etsy (digital JPG layouts you send to a printer), or local
neoprene / dye-sub shops from the same files.

## Interactions

- **[Play Board](play-board.md)** — the digital analog. The engine projects the
  same zone set the physical layout mats label (City / HQ / Mastermind / Scheme /
  villain deck / Wounds / Bystanders / Sidekicks / Officers / decks) into
  `UIState`, which the arena-client renders. Mat art is a skin; zone semantics
  live in the engine, so the board is not bound to any one mat's layout. Useful
  as a *composition* reference: the City reads left-to-right toward Escape, HQ is
  a five-slot row, and Mastermind + Scheme sit as a pair with Twists / Strikes as
  adjacent stacks rather than separate rows.
- **[Legendary Forge](legendary-forge.md)** — the physical-product line. A
  first-party Arena mat belongs in the official catalogue above; the Second
  Edition mat is the current printed baseline (cost reminders on the face-down
  decks). Whether such a mat is a *layout* mat or an *art-only* mat is a product
  decision worth making before briefing an artist — a layout mat teaches the
  game, an art mat does not.
- **[IP Licensing](ip-licensing.md)** — every official mat here is a Marvel /
  Upper Deck product, and the fan-site scans of those mats are still UD / Marvel
  art. Fan print files sit in a grey area their authors mark "personal use."
  Reproducing or selling mat art — official or fan — is a licensing question,
  not just a design one.
- **[Card Image Acquisition](card-image-acquisition.md)** — the same
  `legendarycardgame.com` scrape that sources card art also hosted these mat
  photographs; they were pulled with the same staging tooling and stay in the
  playmats staging folder, not the card pipeline.

## Edge Cases

- **Thanos is two products.** The Caio Cacau art appears on both the *Legendary
  Playmat: Thanos vs. The Avengers* layout mat (93431, City / HQ slots printed)
  and the generic 24″ Thanos art mat (93486, no zones). Same art, different
  product.
- **Generic art mats have no labels.** The 24″ × 13.5″ Thanos / Spider-Man /
  Wolverine mats do not teach or enforce any zone layout — don't mistake one for
  a layout mat.
- **Dark City and Paint the Town Red did not ship official playmats.** The scans
  with those themes are layout assets, not boxed SKUs, and appear in no current
  Upper Deck listing.
- **Villains is a standalone with its own mat**, not a sticker over the
  hero-side board. The labels change (Plot, Overrun, Commander, Adversaries, New
  Recruits, Hydra, Lair); the five-space City geometry does not.
- **Official themed mats do not carry every expansion slot.** They print
  base-game zones plus a few extras; large collections (Sidekicks, special
  Bystanders, extra City / plot cards) outgrow them, which is why the BGG fan
  files are usually more complete.
- **Setup tables printed on old mats go stale.** Player-count rows on the 2012 /
  2014 mats predate later card types — a physical convenience, never a rules
  source; do not scrape them into the engine.
- **Availability drifts.** The 2014 accessory, the OP kits, and the Thanos
  layout mat are frequently out of print; prices quoted here were current at
  `last-reviewed` and will move.

## References

- [Play Board](play-board.md) — the digital game mat and its zone projection.
- [Legendary Forge](legendary-forge.md) — the physical-product line.
- [IP Licensing](ip-licensing.md) — Marvel / Upper Deck rights posture.
- [Card Image Acquisition](card-image-acquisition.md) — how the mat scans were staged.
- Layout-scan source: [legendarycardgame.com — Promo Cards](https://www.legendarycardgame.com/promo-cards).
- Upper Deck store SKUs (verified by image lookup): [Dark Phoenix vs. The X-Men (93433)](https://upperdeckstore.com/legendaryr-playmat-dark-phoenix-vs-the-x-men.html), [Marvel Thanos art mat (93486)](https://upperdeckstore.com/marvel-thanos-playmat.html), [Marvel Wolverine art mat (93490)](https://upperdeckstore.com/marvel-wolverine-playmat.html).
- 2014 official accessory: [BGG accessory 157107](https://boardgamegeek.com/boardgameaccessory/157107/legendary-a-marvel-deck-building-game-playmat).
- Organized-play kits: [ICv2 — Upper Deck launching OP kits](https://icv2.com/articles/news/view/36546/upper-deck-launching-op-kits-marvel-legendary).
- Villains mat photo: Noble Knight Games product listing (used copy).
- Fan files: [BoardGameGeek — Legendary Files](https://boardgamegeek.com/boardgame/129437/legendary-a-marvel-deck-building-game/files), [zeroeo mats (BGG 121186)](https://boardgamegeek.com/filepage/121186/040920-updated-marvel-legendary-play-mats-heroes-a).
- Print-and-play collection: [ruler501/Marvel](https://github.com/ruler501/Marvel).
- Print shop: [Inked Gaming](https://www.inkedgaming.com/).
- Staged source scans (full resolution): `barefootbetters-legendary-setup/card-images-staging/original-jpeg/playmats/`.
