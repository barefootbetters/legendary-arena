---
title: Transform
type: Mechanic
tags:
  - layer-engine
  - hero-deck
  - card-effect
  - wwhk
  - keyword
  - status-partial
related:
  - card-effect-system.md
  - card-type-taxonomy.md
  - cardextid.md
  - dashboard.md
  - data-file-locations.md
  - master-strike.md
  - play-board.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\transform.md (this page — https://ewiki.legendary-arena.com/transform/)
  - ../data/cards/wwhk.json
  - ../data/metadata/keywords-full.json
  - ../docs/ai/coverage/hero-mechanic-ledger.json
  - ../packages/game-engine/src/setup/heroAbility.setup.ts
  - ../packages/game-engine/src/hero/heroEffects.execute.ts
  - ../packages/game-engine/src/setup/buildTransformSideDeck.ts
  - ../docs/ai/work-packets/WP-657-transform-side-deck-partition.md
  - ../docs/ai/work-packets/WP-658-transform-keyword-runtime.md
  - ../docs/ai/work-packets/WP-665-amadeus-cho-transform.md
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

Transform is **implemented in the engine** — as of the WP-657 → WP-658 → WP-662
arc, plus WP-664 (the visible side deck) and WP-665 (Amadeus Cho). The set-aside
zone, the swap runtime, and the read-only UI projection all ship. Coverage is
**partial by design**: only cards whose printed **trigger condition** is modeled
actually Transform today (the [`SUPPORTED_TRANSFORM_BASES` allowlist](#engine-status--implemented-partial));
every other Transform card keeps its printed swap as a **loud, honest hollow**
rather than firing an unconditional (unfaithful) swap. This page is both the
design reference and the field guide for reading the cards. The hardest card in
the set — **Sentry** — has its own section below.

Transform is **not only a Hero mechanic**. Six of the set's **Masterminds** also
transform between two boss faces (General Ross ⇄ Red Hulk, the Sentry ⇄ the Void),
flipping off a [Master Strike](master-strike.md) — see
[Mastermind Transform](#mastermind-transform). And a third surface reaches beyond
this set entirely: double-sided **Schemes** that flip into a "Great Old One"
(Chthon and eight siblings across three sets) — see
[Scheme Transform](#scheme-transform). Both now have a shipped **first slice** — the
flip works for General Ross (Mastermind) and Chthon (Scheme); the remaining bosses
and the payoff effects are honest-partial follow-ups.

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
the printed clause. **Modeled** is whether the engine actually fires the swap
today (✅) or holds it as an honest hollow until its trigger condition is modeled
(⏳) — see [Engine status](#engine-status--implemented-partial).

| Hero | Base card (cost) | Transformed card (cost) | Trigger | Destination | Modeled |
|---|---|---|---|---|---|
| Amadeus Cho | ![Gamma-Draining Nanites (3)](https://images.legendary-arena.com/wwhk/wwhk-hr-amadeus-cho-gamma-draining-nanites.webp "width=44px") Gamma-Draining Nanites (3) | ![Like Totally Smart Hulk (5)](https://images.legendary-arena.com/wwhk/wwhk-hr-amadeus-cho-like-totally-smart-hulk.webp "width=44px") Like Totally Smart Hulk (5) | drew 2 cards this turn | swap | ✅ WP-665 |
| Bruce Banner | ![Gamma-Bomb Disaster (4)](https://images.legendary-arena.com/wwhk/wwhk-hr-bruce-banner-gamma-bomb-disaster.webp "width=44px") Gamma-Bomb Disaster (4) | ![Savage Hulk Unleashed (5)](https://images.legendary-arena.com/wwhk/wwhk-hr-bruce-banner-savage-hulk-unleashed.webp "width=44px") Savage Hulk Unleashed (5) | Outwit (3 different Hero costs) | swap | ⏳ |
| Caiera | ![Dutiful Protector (7)](https://images.legendary-arena.com/wwhk/wwhk-hr-caiera-dutiful-protector.webp "width=44px") Dutiful Protector (7) | ![Vengeful Destructor (7)](https://images.legendary-arena.com/wwhk/wwhk-hr-caiera-vengeful-destructor.webp "width=44px") Vengeful Destructor (7) | ≥ 3 Heroes per player in the KO pile | swap | ⏳ |
| Gladiator Hulk | ![Seize the Throne (4)](https://images.legendary-arena.com/wwhk/wwhk-hr-gladiator-hulk-seize-the-throne.webp "width=44px") Seize the Throne (4) | ![Hulk Is King (5)](https://images.legendary-arena.com/wwhk/wwhk-hr-gladiator-hulk-hulk-is-king.webp "width=44px") Hulk Is King (5) | discarded ≥ 2 cards this turn | deck-top | ⏳ |
| Hiroim | ![Save from the Rubble (4)](https://images.legendary-arena.com/wwhk/wwhk-hr-hiroim-save-from-the-rubble.webp "width=44px") Save from the Rubble (4) | ![Hiroim Redeemed (5)](https://images.legendary-arena.com/wwhk/wwhk-hr-hiroim-hiroim-redeemed.webp "width=44px") Hiroim Redeemed (5) | ≥ 2 Bystanders in your Victory Pile | swap | ⏳ |
| Hulkbuster Iron Man | ![Build the Suit (5)](https://images.legendary-arena.com/wwhk/wwhk-hr-hulkbuster-iron-man-build-the-suit.webp "width=44px") Build the Suit (5) | ![Ultra-Massive Armor (6)](https://images.legendary-arena.com/wwhk/wwhk-hr-hulkbuster-iron-man-ultra-massive-armor.webp "width=44px") Ultra-Massive Armor (6) | `[hc:tech][hc:strength]` | swap | ⏳ |
| Joe Fixit / Grey Hulk | ![Ambitious Enforcer (6)](https://images.legendary-arena.com/wwhk/wwhk-hr-joe-fixit-grey-hulk-ambitious-enforcer.webp "width=44px") Ambitious Enforcer (6) | ![Underworld Boss (6)](https://images.legendary-arena.com/wwhk/wwhk-hr-joe-fixit-grey-hulk-underworld-boss.webp "width=44px") Underworld Boss (6) | defeat a Villain with 6+ Attack this turn | deck-top | ⏳ |
| Korg | ![Forged by Fire (3)](https://images.legendary-arena.com/wwhk/wwhk-hr-korg-forged-by-fire.webp "width=44px") Forged by Fire (3) | ![Lord of Granite (5)](https://images.legendary-arena.com/wwhk/wwhk-hr-korg-lord-of-granite.webp "width=44px") Lord of Granite (5) | `[hc:strength][hc:strength]` | swap | ⏳ |
| Miek the Unhived | ![Metamorphosis (7)](https://images.legendary-arena.com/wwhk/wwhk-hr-miek-the-unhived-metamorphosis.webp "width=44px") Metamorphosis (7) | ![Hive King Miek (8)](https://images.legendary-arena.com/wwhk/wwhk-hr-miek-the-unhived-hive-king-miek.webp "width=44px") Hive King Miek (8) | Feast + an `[icon:attack]` card KO&#39;d from your deck | swap | ⏳ |
| Namora | ![Herculean Effort (5)](https://images.legendary-arena.com/wwhk/wwhk-hr-namora-herculean-effort.webp "width=44px") Herculean Effort (5) | ![Master of Depths (6)](https://images.legendary-arena.com/wwhk/wwhk-hr-namora-master-of-depths.webp "width=44px") Master of Depths (6) | defeat a Villain in the Sewers or Bridge | deck-top | ⏳ |
| No-Name Brood Queen | ![Bursting with Life (3)](https://images.legendary-arena.com/wwhk/wwhk-hr-no-name-brood-queen-bursting-with-life.webp "width=44px") Bursting with Life (3) | ![Torrent of Broodlings (5)](https://images.legendary-arena.com/wwhk/wwhk-hr-no-name-brood-queen-torrent-of-broodlings.webp "width=44px") Torrent of Broodlings (5) | Feast + a non-grey Hero KO&#39;d from your deck | swap | ⏳ |
| Rick Jones | ![Seek the Nega-Bands (4)](https://images.legendary-arena.com/wwhk/wwhk-hr-rick-jones-seek-the-nega-bands.webp "width=44px") Seek the Nega-Bands (4) | ![Captain Marvel (5)](https://images.legendary-arena.com/wwhk/wwhk-hr-rick-jones-captain-marvel.webp "width=44px") Captain Marvel (5) | reveal top of deck, cost ≥ 3 | swap | ⏳ |
| Rick Jones | ![Irradiated Blood (5)](https://images.legendary-arena.com/wwhk/wwhk-hr-rick-jones-irradiated-blood.webp "width=44px") Irradiated Blood (5) | ![A-Bomb (6)](https://images.legendary-arena.com/wwhk/wwhk-hr-rick-jones-a-bomb.webp "width=44px") A-Bomb (6) | ≥ 5 Villains in your Victory Pile | deck-top | ⏳ |
| Rick Jones | ![Caught in the Kree-Skrull War (7)](https://images.legendary-arena.com/wwhk/wwhk-hr-rick-jones-caught-in-kree-skrull-war.webp "width=44px") Caught in the Kree-Skrull War (7) | ![The Destiny Force (9)](https://images.legendary-arena.com/wwhk/wwhk-hr-rick-jones-the-destiny-force.webp "width=44px") The Destiny Force (9) | defeat two Villains this turn | deck-top | ⏳ |
| Sentry | ![Agoraphobia (2)](https://images.legendary-arena.com/wwhk/wwhk-hr-sentry-agoraphobia.webp "width=44px") Agoraphobia (2) | ![Golden Guardian of Good (6)](https://images.legendary-arena.com/wwhk/wwhk-hr-sentry-golden-guardian-of-good.webp "width=44px") Golden Guardian of Good (6) | always (on play) | discard — **and back** (see below) | ⏳ |
| Sentry | ![Mournful Sentinel (3)](https://images.legendary-arena.com/wwhk/wwhk-hr-sentry-mournful-sentinel.webp "width=44px") Mournful Sentinel (3) | ![The Void Unchained (5)](https://images.legendary-arena.com/wwhk/wwhk-hr-sentry-the-void-unchained.webp "width=44px") The Void Unchained (5) | reveal top of deck, cost ≥ 1 | deck-top — **and back** | ⏳ |
| She-Hulk | ![Hurl Legal Objections (3)](https://images.legendary-arena.com/wwhk/wwhk-hr-she-hulk-hurl-legal-objections.webp "width=44px") Hurl Legal Objections (3) | ![Hurl Trucks (6)](https://images.legendary-arena.com/wwhk/wwhk-hr-she-hulk-hurl-trucks.webp "width=44px") Hurl Trucks (6) | made ≥ 6 Recruit this turn | swap | ✅ WP-658 |
| Skaar, Son of Hulk | ![Mood Swings (5)](https://images.legendary-arena.com/wwhk/wwhk-hr-skaar-son-of-hulk-mood-swings.webp "width=44px") Mood Swings (5) | ![Raging Savage (6)](https://images.legendary-arena.com/wwhk/wwhk-hr-skaar-son-of-hulk-raging-savage.webp "width=44px") Raging Savage (6) | `[hc:instinct]` + you gain a Wound | swap | ⏳ |

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

## Mastermind Transform

Transform is not only a Hero mechanic — **six of the set's Masterminds transform
too**, and they are why this page needs a second half. A transforming Mastermind
ships **two boss faces** in one Mastermind and flips between them mid-game, almost
always off a **Master Strike** (see the [Master Strike](master-strike.md) mechanic
for how strikes fire and stack).

| Mastermind (leads) | Base form | ⇄ Second form | Transform trigger |
|---|---|---|---|
| **General “Thunderbolt” Ross** (Code Red) | ![General Ross](https://images.legendary-arena.com/wwhk/wwhk-mm-general-thunderbolt-ross.webp "width=90px") General Ross | ![Red Hulk](https://images.legendary-arena.com/wwhk/wwhk-me-general-thunderbolt-ross.webp "width=90px") Red Hulk | Master Strike (either form flips to the other) |
| **Illuminati** (Illuminati) | ![Secret Society](https://images.legendary-arena.com/wwhk/wwhk-mm-illuminati-secret-society.webp "width=90px") Secret Society | ![Open Warfare](https://images.legendary-arena.com/wwhk/wwhk-me-illuminati-secret-society.webp "width=90px") Open Warfare | Master Strike (each player discards two cards in a cost band) |
| **King Hulk** (Warbound) | ![Sakaarson](https://images.legendary-arena.com/wwhk/wwhk-mm-king-hulk-sakaarson.webp "width=90px") Sakaarson | ![Worldbreaker](https://images.legendary-arena.com/wwhk/wwhk-me-king-hulk-sakaarson.webp "width=90px") Worldbreaker | Master Strike |
| **M.O.D.O.K.** (Intelligencia) | ![M.O.D.O.K.](https://images.legendary-arena.com/wwhk/wwhk-mm-m-o-d-o-k.webp "width=90px") M.O.D.O.K. | ![Network Nightmare](https://images.legendary-arena.com/wwhk/wwhk-me-m-o-d-o-k.webp "width=90px") Network Nightmare | Master Strike (players who can&#39;t Outwit take the hit) |
| **The Red King** (Sakaar Imperial Guard) | ![The Red King](https://images.legendary-arena.com/wwhk/wwhk-mm-red-king-the.webp "width=90px") The Red King | ![Power Armored](https://images.legendary-arena.com/wwhk/wwhk-me-red-king-the.webp "width=90px") Power Armored | Master Strike |
| **The Sentry** (Aspects of the Void) | ![The Sentry](https://images.legendary-arena.com/wwhk/wwhk-mm-sentry-the.webp "width=90px") The Sentry | ![The Void](https://images.legendary-arena.com/wwhk/wwhk-me-sentry-the.webp "width=90px") The Void | Master Strike (the deepest loop — the Void side is its own boss) |

Read them as bidirectional, the way you read Sentry's Hero pair: each face carries
its own Master Strike, and firing it flips the Mastermind to the *other* face —
General Ross ⇄ Red Hulk, the timid Sentry ⇄ the Void. The two faces have different
Attack, different Master Strikes, and different always-on rules (Red Hulk's
Helicopters, the Void being its own boss), so *which face is showing* is real board
state, not flavour.

**How the flip is worded.** The trigger is the printed **`[keyword:Transforms]`**
(plural — the Mastermind analog of a Hero's `[keyword:Transform]`). It appears in
two places: on a face's **Master Strike** ("General Ross `[keyword:Transforms]`,
then …") and on some **tactics** ("This Mastermind `[keyword:Transforms]`."). A few
faces also carry named one-off keyword effects — `[keyword:Cross-Dimensional Hulk
Rampage]`, `[keyword:Wounded Fury]` — that ride along with the flip.

### Mastermind engine status — IMPLEMENTED (partial)

Mastermind Transform's **first slice shipped (WP-669 / D-24483)** — the flip
primitive for **General "Thunderbolt" Ross**. Historically the engine took only the
**first non-tactic face** and **dropped every later one** (DECISIONS **D-24193**),
so a transforming Mastermind's second boss face never loaded. Now, for a Mastermind
in the `MASTERMIND_TRANSFORM_ALLOWLIST`, setup captures the second face (its Attack
into `G.cardStats`, its text alongside the first), and a strike resolver **flips**
the boss on its Master Strike: **General Ross ⇄ Red Hulk**, the play surface showing
the new face's Attack, Master Strike, and rules text. The flip is bidirectional.

**Honest-partial (the next slices):** the other five transforming Masterminds
(Illuminati, King Hulk, M.O.D.O.K., Red King, the Sentry ⇄ the Void) stay on the
first-face-only path until they are added to the allowlist with their own resolver,
and the named ride-along strike effects (`Cross-Dimensional Hulk Rampage`,
`Wounded Fury`) plus the Helicopter carry-over are not yet modeled. Each is a named
follow-up on the shipped foundation.

## Scheme Transform

There is a **third** transform surface, and it is the strangest: a handful of
**Schemes** are double-sided and **flip into a "Great Old One"** — an alternate
villain win condition that takes over the game. The clearest example is Midnight
Sons' **Chthon**:

| Scheme side | ⇄ Great Old One side | Flip trigger | Win condition |
|---|---|---|---|
| ![Ritual Sacrifice to Summon Chthon](https://images.legendary-arena.com/mdns/mdns-sc-ritual-sacrifice-to-summon-chthon.webp "width=90px") Ritual Sacrifice to Summon Chthon | ![Great Old One Chthon](https://images.legendary-arena.com/mdns/mdns-sx-great-old-one-chthon.webp "width=90px") Great Old One Chthon | 5 Bystanders in the KO pile → the Scheme `[rule:Transforms]` (flip it over) and KOs all other Masterminds | **Chthon Wins** when all players are destroyed |

The Scheme starts on its "Ritual Sacrifice" face and plays like a normal Scheme.
Once 5 Bystanders are KO'd it **flips** — the Twists reshuffle, every other
Mastermind and its Tactics are KO'd, and **Great Old One Chthon** takes over as
the sole boss. Its flip side even prints *"[This card can only start the game as
the Scheme on the other side.]"* — the Great Old One face is unreachable except by
transforming into it.

**A distinct marker.** Scheme transform is worded **`[rule:Transforms]`** (a
*scheme-rule* trigger), separate from the Mastermind's `[keyword:Transforms]` and
the Hero's `[keyword:Transform]`. Chthon's flip side is its own card with
**`cardType: "scheme-transform"`** (image prefix `sx`, vs the base scheme's `sc`).
The Revelations four are double-sided too — each reverse is a distinct
**"Scheme, Transformed"** face, now with its own `sx` art (the engine models it as
the scheme's second face, not a separate card). The Messiah Complex four flip into
a *random* face, so they carry no fixed transformed image.

### The nine transforming schemes

Nine schemes across three sets carry `[rule:Transforms]`. Their **second forms**
differ in kind, so the "Transforms into" column shows an image only where a
distinct card exists:

- **Chthon** flips into one **distinct Great Old One boss card** (`mdns-sx-…`) —
  shown inline in its row.
- The **Messiah Complex four** each flip into a **random Unveiled Scheme**, drawn
  from the shared pool of four cards pictured [below](#the-four-unveiled-schemes-the-messiah-complex-pool)
  — no single per-row image, because the target is random.
- The **Revelations four** are **two-sided** schemes; each flips between the two
  faces of the *same physical card*, and the reverse **"Scheme, Transformed"** face
  is shown inline in its row.

| Scheme | Set | `[rule:Transforms]` trigger | Transforms into |
|---|---|---|---|
| ![Ritual Sacrifice to Summon Chthon](https://images.legendary-arena.com/mdns/mdns-sc-ritual-sacrifice-to-summon-chthon.webp "width=90px") Ritual Sacrifice to Summon Chthon | Midnight Sons | 5 Bystanders in the KO pile | ![Great Old One Chthon](https://images.legendary-arena.com/mdns/mdns-sx-great-old-one-chthon.webp "width=90px") **Great Old One Chthon** — a boss with its own win condition (below) |
| ![Hack Cerebro Servers To…](https://images.legendary-arena.com/msmc/msmc-sc-hack-cerebro-servers-to.webp "width=90px") Hack Cerebro Servers To… | X-Men: Messiah Complex | Twist 6 | a random **Unveiled Scheme** — one of the four below (do its Twist) |
| ![Drain Mutant Powers To…](https://images.legendary-arena.com/msmc/msmc-sc-drain-mutant-powers-to.webp "width=90px") Drain Mutant Powers To… | X-Men: Messiah Complex | Twist 7 | a random **Unveiled Scheme** — one of the four below (do its Twist) |
| ![Hire Singularity Investigations To…](https://images.legendary-arena.com/msmc/msmc-sc-hire-singularity-investigations-to.webp "width=90px") Hire Singularity Investigations To… | X-Men: Messiah Complex | Twist 5 | a random **Unveiled Scheme** — one of the four below (do its Twist) |
| ![Raid Gene Banks To…](https://images.legendary-arena.com/msmc/msmc-sc-raid-gene-banks-to.webp "width=90px") Raid Gene Banks To… | X-Men: Messiah Complex | Twist 4 | a random **Unveiled Scheme** — one of the four below (do its Twist) |
| ![Earthquake Drains the Ocean](https://images.legendary-arena.com/rvlt/rvlt-sc-earthquake-drains-the-ocean.webp "width=90px") Earthquake Drains the Ocean | Revelations | every Twist (the tide rushes in / out) | ![Tsunami Crushes the Coast](https://images.legendary-arena.com/rvlt/rvlt-sx-tsunami-crushes-the-coast.webp "width=90px") **Tsunami Crushes the Coast** — the "Scheme, Transformed" reverse face (flips back and forth) |
| ![House of M](https://images.legendary-arena.com/rvlt/rvlt-sc-house-of-m.webp "width=90px") House of M | Revelations | a Twist with ≥ 2 Scarlet Witch cards in the city | ![No More Mutants](https://images.legendary-arena.com/rvlt/rvlt-sx-no-more-mutants.webp "width=90px") **No More Mutants** — the "Scheme, Transformed" reverse face |
| ![Secret HYDRA Corruption](https://images.legendary-arena.com/rvlt/rvlt-sc-secret-hydra-corruption.webp "width=90px") Secret HYDRA Corruption | Revelations | a Twist (S.H.I.E.L.D. Officers stack up as HYDRA corrupts them) | ![Open HYDRA Revolution](https://images.legendary-arena.com/rvlt/rvlt-sx-open-hydra-revolution.webp "width=90px") **Open HYDRA Revolution** — the "Scheme, Transformed" reverse face |
| ![Korvac Saga, The](https://images.legendary-arena.com/rvlt/rvlt-sc-korvac-saga-the.webp "width=90px") Korvac Saga, The | Revelations | a Twist (players search for the Korvac Entity) | ![Korvac Revealed](https://images.legendary-arena.com/rvlt/rvlt-sx-korvac-revealed.webp "width=90px") **Korvac Revealed** — the "Scheme, Transformed" reverse face |

#### The four Unveiled Schemes (the Messiah Complex pool)

The four `…To…` schemes above each `[rule:Transforms]` into a **random** one of
these four Unveiled Schemes and then do its Twist. All four share the one pool, so
the second form is any of the cards below — never a fixed pairing.

| ![Control the Mutant Messiah](https://images.legendary-arena.com/msmc/msmc-sc-control-the-mutant-messiah.webp "width=90px") | ![Open Rifts to Future Timelines](https://images.legendary-arena.com/msmc/msmc-sc-open-rifts-to-future-timelines.webp "width=90px") | ![Reveal the Heroes' Evil Clones](https://images.legendary-arena.com/msmc/msmc-sc-reveal-the-heroes-evil-clones.webp "width=90px") | ![Unleash an Anti-Mutant Bioweapon](https://images.legendary-arena.com/msmc/msmc-sc-unleash-an-anti-mutant-bioweapon.webp "width=90px") |
|---|---|---|---|
| …Control the Mutant Messiah | …Open Rifts to Future Timelines | …Reveal the Heroes' Evil Clones | …Unleash an Anti-Mutant Bioweapon |

### Scheme engine status — IMPLEMENTED (partial)

Scheme Transform's **first slice shipped (WP-670 / D-24484)** — the flip primitive
for **Chthon**. At setup, a scheme in the `SCHEME_TRANSFORM_TARGETS` allowlist
captures its Great Old One target's rules text; a per-move check counts Bystanders
in the KO pile, and once **5** accumulate the Scheme **flips** — its rules text
becomes Chthon's and the game log announces *"The Great Old One awakens."*

**Honest-partial (the next slices):** the scheme's name/image does not yet change
(only the rules text), Chthon's *destroy-the-current-player* effect is not modeled,
and the **Chthon-Wins alternate win condition** (all players destroyed → the
villains win) is not yet wired — that is a net-new player-elimination mechanic. The
Messiah Complex "random Unveiled Scheme" flip and the Revelations two-sided flips
are also unbuilt; each is a named follow-up on the shipped foundation.

## Hero engine status — IMPLEMENTED (partial) {#engine-status--implemented-partial}

Hero Transform **is implemented**, in layers that shipped across one arc:

1. **The set-aside zone (WP-657 / D-24468).** At setup, `buildTransformSideDeck`
   partitions every `isTransform` instance **out** of the shuffled Hero-deck
   reservoir into a new top-level `G.transformDeck` zone — built deterministically
   with no extra `ctx.random` call (the side deck is unshuffled; all copies of a
   Transformed card are identical). So Transformed cards are **no longer
   recruitable from the HQ**; they only ever enter play through a Transform.
2. **The swap runtime (WP-658 / D-24469).** `[keyword:Transform]` is a real
   `HeroKeyword`. Its handler `heroEffectTransform` reads the base→target link
   from a G-resident `G.transformTargets` map (built at setup from the base card's
   `transform` field), pulls the matching second-form out of `G.transformDeck`
   into play, routes the base card **back** to the side deck (a permanent deck
   upgrade), and applies the second-form's printed Attack / Recruit.
3. **The registry fix (WP-662 / D-24473).** `HeroCardSchema` now declares
   `transform` / `transformOf` / `isTransform`, so the real
   `createRegistryFromLocalFiles` loader stops stripping them — the fix that made
   both the partition and the swap actually live (they had been silently no-ops
   because Zod dropped the fields).
4. **The visible side deck (WP-664 / D-24475).** `G.transformDeck` projects to a
   read-only public `UIState.transformDeck` (the koPile / strikePile shared-board
   pattern, survived through `filterUIStateForAudience`), rendered as a face-up
   `TransformDeck.vue` pile beside the HQ — so a player can **see** each Hero's
   set-aside second-forms.

**Coverage is gated by trigger fidelity, not left half-done.** The setup parser
only resolves `[keyword:Transform]` into an executable effect for a card in the
**`SUPPORTED_TRANSFORM_BASES`** allowlist
(`packages/game-engine/src/setup/heroAbility.setup.ts`). Today that is two cards:

- **She-Hulk — Hurl Legal Objections → Hurl Trucks** (WP-658), gated on the
  shipped `recruit-threshold:6` wait-and-see condition ("made ≥ 6 Recruit this
  turn").
- **Amadeus Cho — Gamma-Draining Nanites → Like Totally Smart Hulk** (WP-665),
  gated on a new `cardsDrawnThisTurnAtLeast` wait-and-see condition ("drew two
  cards this turn"); the card's own "Draw a card" stays unconditional.

Every **other** Transform card carries a printed trigger the engine does not yet
model (an Outwit-style distinct-cost gate, a KO-pile count, a combat-outcome, a
reveal-and-check…), so resolving its `[keyword:Transform]` unconditionally would
be an **unfaithful** swap. Those cards keep the marker as an **honest hollow**:
`[keyword:Transform]` reaches the parser's unresolved-marker fallback and logs a
`parse-unrecognized` breadcrumb at play time, while the base card's **other
effects still fire** (Gamma-Draining Nanites' `[keyword:draw:1]` always draws).
This is the deliberate [honest-partial](dashboard.md) posture — the swap is
reported as unmodeled, never silently faked.

## Adding the next Hero

Each held-back pairing (⏳ in the roster) needs exactly one thing before it can
join the allowlist: its **trigger condition modeled**. The swap primitive, the
side-deck zone, the base→target map, and the UI are all done and shared, so a new
Hero is a small, repeatable WP:

1. **Model the trigger** as a `HeroCondition` (the WP-653 condition-gate-family
   seam is the closest precedent for the class / count / board-read gates) or a
   wait-and-see condition (the WP-568 window, as Amadeus Cho's "drew two cards"
   reuses).
2. **Mark the card** with the condition marker on its Transform ability line, and
   add its base ext_id to `SUPPORTED_TRANSFORM_BASES`.
3. **Regenerate** the card data + the hero ledger (the row flips
   `unsupported → executable`).

Still outstanding as their own follow-ups: **Sentry's bidirectional loops** (a
Transformed card that carries a `transform` back to its base) and the **"cards
Transformed this turn" counter** that Sentry's *Rival Personalities* scores — a
distinct piece of state, not just another trigger.

## Interactions

- **Recruiting the base card** works normally — base cards are ordinary Hero-deck
  cards. **Transformed cards are not recruitable** — they live in `G.transformDeck`,
  out of the HQ (WP-657).
- **Playing a supported base card** performs the swap: the second-form comes in
  from the side deck, the base card is routed back to the side deck, and the
  second-form's printed Attack / Recruit apply (WP-658 / WP-665).
- **Draw / Recruit / Attack** printed on a base card fire independently of the
  Transform clause; a Transform sitting on the same line does not block the rest of
  the card, and a held-back card's other effects still fire while the swap stays a
  loud hollow.
- **[Coverage](dashboard.md)** counts `transform` under its own mechanic row; the
  supported bases read `executable`, the held-back ones `unsupported` (parse-
  unrecognized). It is distinct from the base cards' other mechanics (draw, smash,
  outwit, feast).
- **Sentry's Rival Personalities** depends on a per-turn Transform count that does
  not exist yet, so it reads 0 today (a named follow-up).

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
- Side deck partition: `packages/game-engine/src/setup/buildTransformSideDeck.ts`
  (`G.transformDeck`, WP-657 / D-24468).
- Swap runtime: `packages/game-engine/src/hero/heroEffects.execute.ts`
  (`heroEffectTransform`, WP-658 / D-24469).
- Parser + allowlist: `packages/game-engine/src/setup/heroAbility.setup.ts`
  (`SUPPORTED_TRANSFORM_BASES`; the unresolved-marker fallback that keeps a
  held-back card's `transform` an honest hollow).
- Registry fields: `packages/registry/src/schema.ts` (`transform` / `transformOf`
  / `isTransform` on `HeroCardSchema`, WP-662 / D-24473).
- UI projection: `packages/game-engine/src/ui/uiState.build.ts` +
  `apps/arena-client/src/components/play/TransformDeck.vue` (WP-664 / D-24475).
- Honest-partial precedent: `docs/ai/work-packets/WP-653-hero-condition-gate-family.md`
  (why an unmodeled gated effect stays a loud hollow rather than a silent no-op).
- **Mastermind Transform:** [Master Strike](master-strike.md) (the trigger surface);
  `packages/game-engine/src/mastermind/mastermind.setup.ts` (the base-face selection
  that drops the second face); DECISIONS **D-24193** (first-non-tactic-face rule, the
  gap the Mastermind transform must close).
- **Scheme Transform:** `data/cards/mdns.json` / `msmc.json` / `rvlt.json` (the nine
  `[rule:Transforms]` schemes; `cardType: "scheme-transform"`, image prefix `sx`);
  no engine handler exists yet.
