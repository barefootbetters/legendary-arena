---
title: Transform
type: Mechanic
tags:
  - layer-engine
  - hero-deck
  - card-effect
  - wwhk
  - keyword
  - status-unsupported
related:
  - card-effect-system.md
  - card-type-taxonomy.md
  - cardextid.md
  - dashboard.md
  - data-file-locations.md
  - play-board.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\transform.md (this page — https://ewiki.legendary-arena.com/transform/)
  - ../data/cards/wwhk.json
  - ../data/metadata/keywords-full.json
  - ../docs/ai/coverage/hero-mechanic-ledger.json
  - ../packages/game-engine/src/setup/heroAbility.setup.ts
  - ../docs/ai/work-packets/WP-653-hero-condition-gate-family.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-09-07
---

# Transform

## Summary

**Transform** is the signature mechanic of the **World War Hulk (`wwhk`)**
set. Every one of that set's Heroes carries one or more **Transformed cards** —
a stronger, alternate version of a base card. When you play a base card and meet
its printed Transform condition, you **swap** the base card for its Transformed
version.

The crucial rule, and the thing this page exists to make unambiguous:

> **Transformed cards are NOT part of the Hero deck.** They are set aside in
> their own stack next to the Hero, and only ever enter the game through a
> Transform. You never recruit a Transformed card, and it is never shuffled into
> your deck.

Transform is currently **not implemented in the engine** — it is the largest
unresolved hero mechanic by in-play frequency (`transform`, ~101 observed
hollows across 15 cards on the [coverage worklist](dashboard.md)). This page is
the design reference for the future implementation, and the field guide for
reading the cards today. The hardest card in the set — **Sentry** — has its own
section below.

## The rule

Each Transform Hero's cards split into two groups:

| Group | Where it lives | How it enters play |
|---|---|---|
| **Base cards** | The 14-card Hero deck (recruited, shuffled, drawn like any Hero) | Recruit from the HQ, then draw and play |
| **Transformed cards** | A **separate set-aside stack** beside the Hero | ONLY via a Transform — never recruited |

A base card's text ends with a **Transform clause**:

> "…, [Transform] this into *&lt;Transformed card&gt;*[ and put it *&lt;somewhere&gt;*]."

When you play the base card and its condition is satisfied, you:

1. Take the named Transformed card from the set-aside stack.
2. **Replace** the just-played base card with it.
3. Send the transformed card to the **destination** the clause names (see
   [Destinations](#destinations)) — most often it simply stays in play as the
   swapped card, but some go to the **top of your deck** or your **discard
   pile**.

The base card and the Transformed card are two different cards that share one
"slot": at any moment the Hero shows one face or the other. Some Heroes
(notably Sentry) let a Transformed card **Transform back**, so the pair cycles.

## Anatomy of a transform (the data model)

In `data/cards/wwhk.json` the relationship is encoded on the card objects:

| Field | On | Meaning |
|---|---|---|
| `transform: "<slug>"` | the **base** card | the Transformed card it becomes |
| `transformOf: "<slug>"` | the **Transformed** card | the base card it came from |
| `isTransform: true` | the **Transformed** card | marks it as a set-aside card, not a deck card |

The printed Transform **trigger** lives in the ability text as the
`[keyword:Transform]` marker; the structured `transform` / `transformOf` fields
are the machine-readable link. Each card — base and transformed alike — is its
own `physicalCard` entry (`sides: ["<slug>"]`), so the art and the counts are
separate.

> **All 15 pairings are structurally marked.** Every `wwhk` Hero's base card
> carries `transform` and its Transformed card carries `transformOf` +
> `isTransform`, so an implementation or migration can rely on the fields rather
> than parsing ability text. (`hulkbuster-iron-man`'s *Build the Suit* →
> *Ultra-Massive Armor* was the last text-only pairing; it was marked to match
> the other 14.)

## The WWHK roster

Every Transform pairing in the set. **Destination** is where the Transformed
card goes: *swap* = it stays in play as the new card; *deck-top* / *discard* per
the printed clause.

| Hero | Base card (cost) | Transformed card (cost) | Trigger | Destination |
|---|---|---|---|---|
| Amadeus Cho | Gamma-Draining Nanites (3) | Like Totally Smart Hulk (5) | drew 2 cards this turn | swap |
| Bruce Banner | Gamma-Bomb Disaster (4) | Savage Hulk Unleashed (5) | Outwit (3 different Hero costs) | swap |
| Caiera | Dutiful Protector (7) | Vengeful Destructor (7) | ≥ 3 Heroes per player in the KO pile | swap |
| Gladiator Hulk | Seize the Throne (4) | Hulk Is King (5) | discarded ≥ 2 cards this turn | deck-top |
| Hiroim | Save from the Rubble (4) | Hiroim Redeemed (5) | ≥ 2 Bystanders in your Victory Pile | swap |
| Hulkbuster Iron Man | Build the Suit (5) | Ultra-Massive Armor (6) | `[hc:tech][hc:strength]` | swap |
| Joe Fixit / Grey Hulk | Ambitious Enforcer (6) | Underworld Boss (6) | defeat a Villain with 6+ Attack this turn | deck-top |
| Korg | Forged by Fire (3) | Lord of Granite (5) | `[hc:strength][hc:strength]` | swap |
| Miek the Unhived | Metamorphosis (7) | Hive King Miek (8) | Feast + an `[icon:attack]` card KO'd from your deck | swap |
| Namora | Herculean Effort (5) | Master of Depths (6) | defeat a Villain in the Sewers or Bridge | deck-top |
| No-Name Brood Queen | Bursting with Life (3) | Torrent of Broodlings (5) | Feast + a non-grey Hero KO'd from your deck | swap |
| Rick Jones | Seek the Nega-Bands (4) | Captain Marvel (5) | reveal top of deck, cost ≥ 3 | swap |
| Rick Jones | Irradiated Blood (5) | A-Bomb (6) | ≥ 5 Villains in your Victory Pile | deck-top |
| Rick Jones | Caught in the Kree-Skrull War (7) | The Destiny Force (9) | defeat two Villains this turn | deck-top |
| Sentry | Agoraphobia (2) | Golden Guardian of Good (6) | always (on play) | discard — **and back** (see below) |
| Sentry | Mournful Sentinel (3) | The Void Unchained (5) | reveal top of deck, cost ≥ 1 | deck-top — **and back** |
| She-Hulk | Hurl Legal Objections (3) | Hurl Trucks (6) | made ≥ 6 Recruit this turn | swap |
| Skaar, Son of Hulk | Mood Swings (5) | Raging Savage (6) | `[hc:instinct]` + you gain a Wound | swap |

Rick Jones is the widest (three independent base→transformed pairs); Sentry is
the deepest (two **bidirectional** pairs).

## Sentry — the hard case

Sentry is "almost impossible to figure out" because — alone in the set — his
Transformed cards **Transform back**. He is two dual-identity loops, not two
one-way upgrades. Read each pair as a coin that can be flipped either way:

**Loop 1 — the Sentry ↔ the Void of madness:**

- **Agoraphobia** (2) → *always* Transform into **Golden Guardian of Good**,
  put in your **discard**. (Playing the timid Sentry summons the hero.)
- **Golden Guardian of Good** (6) → you *may* Transform back into
  **Agoraphobia** (put in discard); **if you do, you get +4 Attack.** (The hero
  can spend his power and retreat, cashing out for a burst.)

**Loop 2 — the Void:**

- **Mournful Sentinel** (3) → reveal the top card of your deck; if it costs 1+,
  Transform into **The Void Unchained**, put it on **top of your deck**.
- **The Void Unchained** (5) → reveal the top card of your deck; if it costs 0,
  **Feast**; otherwise Transform back into **Mournful Sentinel**, put it in your
  **discard**. (The Void is unstable — a cheap draw sends it back.)

**The payoff card:** **Rival Personalities** (4) — "+1 Attack for each card that
Transformed this turn." Sentry's deck is built to Transform *repeatedly* in a
turn; this card scores the chaos. That is why the loops matter: they are not
flavour, they are the engine of Sentry's combo, and any implementation has to
count Transforms-this-turn for it to work.

**The other odd one:** **Vast Unstable Power** (8) — reveal five, gain their
Attack, and Transform only if the play makes 12+ Attack. A conditional Transform
with no fixed Transformed-card target in the structured data — flag it as a
special case.

> Reading tip: for Sentry, always ask two questions per card — *which* card does
> it become, and *where does that card go* (in play / deck-top / discard)? The
> destination is what makes the loop cycle rather than dead-end.

## Trigger conditions & destinations {#destinations}

**Triggers** fall into a handful of shapes — the same game-state predicates the
rest of the hero engine already reads:

- **Play-this-turn counts** — drew 2 cards, discarded ≥ 2, made ≥ 6 Recruit.
- **Class conditions** — `[hc:strength][hc:strength]`, `[hc:instinct]`, an
  Outwit-style distinct-cost gate.
- **Board / pile reads** — Bystanders in your Victory Pile, Villains in your
  Victory Pile, Heroes in the KO pile.
- **Combat outcomes** — defeat a Villain of a certain Attack, in a certain city
  space, or defeat two this turn.
- **Reveal-and-check** — reveal the top of your deck and test its cost.
- **Unconditional** — Agoraphobia always transforms on play.

**Destinations** — where the Transformed card lands — are the load-bearing
detail:

| Destination | Printed as | Effect |
|---|---|---|
| **swap** | bare "Transform this into X" | X replaces the base card in play this turn |
| **deck-top** | "…and put it on top of your deck" | X is drawn again next turn (a delayed, guaranteed replay) |
| **discard** | "…and put it in your discard pile" | X re-enters via the normal deck cycle (and enables the return loops) |

## Engine status — UNSUPPORTED

Transform is **not implemented**. There is **no** `transform` / `isTransform`
handling anywhere in `packages/game-engine` or `packages/registry`. Two
concrete consequences you can see today:

1. **The Transform clause is an honest hollow.** `[keyword:Transform]` reaches
   the parser's unresolved-marker fallback, so at play time the engine logs a
   `parse-unrecognized` breadcrumb — e.g. *"card
   `wwhk/amadeus-cho/gamma-draining-nanites#1` declared a `transform` mechanic at
   onPlay, but no executable handler was reached."* The **base card's other
   effects still fire** (Gamma-Draining Nanites' `[keyword:draw:1]` draws); only
   the swap is skipped. This is deliberate [honest-partial](dashboard.md)
   behaviour — the hollow stays loud so the mechanic is never silently faked.
2. **Transformed cards are in the wrong place.** Because nothing sets them
   aside, `isTransform` cards are treated as ordinary Hero-deck cards: they sit
   in the HQ and are **recruitable**. In a real match today you can recruit *Like
   Totally Smart Hulk* directly, which the printed rules never allow.

On the [coverage worklist](dashboard.md), `transform` is `Unsupported` with the
second-highest observed-in-play count of any mechanic (~101), behind only
`moonlight`. It is a **Bucket-D** target — a new zone/state model, not a data
row — so it warrants its own Work Packet (or a small arc of them), designed
before implementation.

## What a real implementation needs

A faithful Transform needs more than a new keyword handler — it needs a **new
zone** and a **swap primitive**:

1. **A set-aside Transformed-cards zone**, per Hero, seeded at setup from the
   `isTransform` cards and **excluded from the Hero deck / HQ** so they are never
   recruited. (This is the piece that does not exist today.)
2. **A `Transform` effect primitive**: given a base card in play and its
   `transform` target, move the base card out, bring the target in, and route
   the target to its destination (in play / deck-top / discard).
3. **Trigger evaluation** reusing the existing hero-condition and combat-outcome
   reads — most triggers map to predicates the engine already has (the WP-653
   `HeroCondition` seam is the closest precedent for the class/count gates).
4. **Bidirectional support** for Sentry (a Transformed card may itself carry a
   `transform` back to its base) and a **"cards Transformed this turn" counter**
   for Rival Personalities.

The card data is ready for it: all 15 pairings carry `transform` /
`transformOf` / `isTransform`, so the engine can drive the swap off the fields.

Until that lands, the honest hollow is the correct behaviour: the base card does
what it can, and the unimplemented swap is reported, not hidden.

## Interactions

- **Recruiting the base card** works normally — base cards are ordinary Hero-deck
  cards. Only the *swap* is unimplemented.
- **Draw / Recruit / Attack** printed on a base card fire independently of the
  Transform clause (see the engine-status note); a Transform sitting on the same
  line does not block the rest of the card.
- **[Coverage](dashboard.md)** counts `transform` under its own mechanic row; it
  is distinct from the base cards' other mechanics (draw, smash, outwit, feast).
- **Sentry's Rival Personalities** depends on a per-turn Transform count that
  does not exist yet, so it reads 0 today.

## Edge Cases

- **Conditional target (Vast Unstable Power).** Transforms only above an Attack
  threshold and does not name a fixed target in the structured data — special-case
  it.
- **Destination changes the loop.** "swap" is a one-turn upgrade; "deck-top" is a
  guaranteed next-turn replay; "discard" is what lets Sentry's pairs cycle. Do
  not collapse the three.
- **Bidirectional cards.** A Transformed card can be a base card for the reverse
  Transform (Golden Guardian of Good → Agoraphobia; The Void Unchained → Mournful
  Sentinel). A one-directional model will get Sentry wrong.

## References

- Card data: `data/cards/wwhk.json` (the 15 World War Hulk Heroes).
- Keyword glossary: `data/metadata/keywords-full.json` (the printed *Transform*
  rule — note the glossary text is a summary; the **card text is authoritative**).
- Coverage worklist: [dashboard.md](dashboard.md) → /coverage — `transform` mechanic row.
- Parser: `packages/game-engine/src/setup/heroAbility.setup.ts` (the
  unresolved-marker fallback that records the `transform` hollow).
- Honest-partial precedent: `docs/ai/work-packets/WP-653-hero-condition-gate-family.md`
  (why an unimplemented gated effect stays a loud hollow rather than a silent no-op).
