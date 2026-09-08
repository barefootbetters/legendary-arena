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
| Amadeus Cho | Gamma-Draining Nanites (3) | Like Totally Smart Hulk (5) | drew 2 cards this turn | swap | ✅ WP-665 |
| Bruce Banner | Gamma-Bomb Disaster (4) | Savage Hulk Unleashed (5) | Outwit (3 different Hero costs) | swap | ⏳ |
| Caiera | Dutiful Protector (7) | Vengeful Destructor (7) | ≥ 3 Heroes per player in the KO pile | swap | ⏳ |
| Gladiator Hulk | Seize the Throne (4) | Hulk Is King (5) | discarded ≥ 2 cards this turn | deck-top | ⏳ |
| Hiroim | Save from the Rubble (4) | Hiroim Redeemed (5) | ≥ 2 Bystanders in your Victory Pile | swap | ⏳ |
| Hulkbuster Iron Man | Build the Suit (5) | Ultra-Massive Armor (6) | `[hc:tech][hc:strength]` | swap | ⏳ |
| Joe Fixit / Grey Hulk | Ambitious Enforcer (6) | Underworld Boss (6) | defeat a Villain with 6+ Attack this turn | deck-top | ⏳ |
| Korg | Forged by Fire (3) | Lord of Granite (5) | `[hc:strength][hc:strength]` | swap | ⏳ |
| Miek the Unhived | Metamorphosis (7) | Hive King Miek (8) | Feast + an `[icon:attack]` card KO'd from your deck | swap | ⏳ |
| Namora | Herculean Effort (5) | Master of Depths (6) | defeat a Villain in the Sewers or Bridge | deck-top | ⏳ |
| No-Name Brood Queen | Bursting with Life (3) | Torrent of Broodlings (5) | Feast + a non-grey Hero KO'd from your deck | swap | ⏳ |
| Rick Jones | Seek the Nega-Bands (4) | Captain Marvel (5) | reveal top of deck, cost ≥ 3 | swap | ⏳ |
| Rick Jones | Irradiated Blood (5) | A-Bomb (6) | ≥ 5 Villains in your Victory Pile | deck-top | ⏳ |
| Rick Jones | Caught in the Kree-Skrull War (7) | The Destiny Force (9) | defeat two Villains this turn | deck-top | ⏳ |
| Sentry | Agoraphobia (2) | Golden Guardian of Good (6) | always (on play) | discard — **and back** (see below) | ⏳ |
| Sentry | Mournful Sentinel (3) | The Void Unchained (5) | reveal top of deck, cost ≥ 1 | deck-top — **and back** | ⏳ |
| She-Hulk | Hurl Legal Objections (3) | Hurl Trucks (6) | made ≥ 6 Recruit this turn | swap | ✅ WP-658 |
| Skaar, Son of Hulk | Mood Swings (5) | Raging Savage (6) | `[hc:instinct]` + you gain a Wound | swap | ⏳ |

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

## Engine status — IMPLEMENTED (partial) {#engine-status--implemented-partial}

Transform **is implemented**, in layers that shipped across one arc:

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
