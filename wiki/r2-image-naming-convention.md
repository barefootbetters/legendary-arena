---
title: R2 Image Naming Convention
type: Concept
tags:
  - layer-registry
  - card-type
  - data-shape
  - data-pipeline
  - images
related:
  - card-type-taxonomy.md
  - cardextid.md
  - lagn-v1.md
  - card-image-acquisition.md
  - data-file-locations.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\r2-image-naming-convention.md (this page — https://ewiki.legendary-arena.com/r2-image-naming-convention/)
  - ../packages/registry/src/heroImageUrl.ts
  - ../scripts/convert-cards/convert-cards-v15.mjs
  - ../data/metadata/sets.json
  - ../data/metadata/card-types.json
  - ../docs/ai/DECISIONS.md
  - ../apps/arena-client/src/composables/useCardImagePrefetch.ts
  - ../docs/ops/RUNBOOK-r2-image-cache-control.md
last-reviewed: 2026-07-21
---

# R2 Image Naming Convention

## Summary

Every card's printed-card image is stored on Cloudflare R2 under a
deterministic URL derived from the card's set abbreviation, a two-letter
**ribbon** code for its card type, and the card's lowercase-hyphen slug(s).
The convention is what the card-conversion pipeline emits into each card's
`imageUrl` field and what the Registry Viewer fetches for display. This page is
the reference for that convention — useful when a new set is released and its
images must be named to match.

## Mechanics

### Host and directory

The R2 host is the single constant `R2_BASE_URL` in
[`heroImageUrl.ts`](../packages/registry/src/heroImageUrl.ts):

```
https://images.legendary-arena.com
```

Every image lives in a per-set directory keyed by the set abbreviation, so the
full shape is:

```
{R2_BASE_URL}/{setAbbr}/{setAbbr}-{ribbon}-{slug(s)}.webp
```

- `{setAbbr}` appears twice — once as the directory, once as the filename prefix
  (e.g. `nmut/`, `2099/`, `core/`).
- All images are `.webp`.
- Slugs are **lowercase, hyphen-separated** — never underscores, never
  uppercase. `S.H.I.E.L.D.` normalizes to the slug `shield` in the pipeline.

### Set abbreviation (`setAbbr`) — from `sets.json`

The `{setAbbr}` that opens both the R2 directory and the filename is a set's
**`abbr`** — the four-character code assigned to each expansion in
[`data/metadata/sets.json`](../data/metadata/sets.json). That file is the
canonical set index the Registry loads at startup
([`localRegistry.ts`](../packages/registry/src/impl/localRegistry.ts),
[`httpRegistry.ts`](../packages/registry/src/impl/httpRegistry.ts) read it as
`metadata/sets.json`). Each entry has seven fields:

```json
{
  "id": 26,
  "abbr": "nmut",
  "pkgId": 26,
  "slug": "new-mutants",
  "name": "New Mutants",
  "releaseDate": "2020-04-16",
  "type": "22nd Expansion"
}
```

Only **`abbr`** feeds the image path — it is the `nmut` in
`nmut/nmut-hr-wolfsbane-night-vision.webp`. The other fields (`name`, `slug`,
`releaseDate`, `type`) describe the set for the Registry and Viewer but never
appear in an image URL. Note the set-level `slug` (`new-mutants`) is **not** the
image slug — image slugs come from the individual card, not the set. `sets.json`
is therefore the **decoder ring** for any R2 path: given a four-letter
directory, it names the set.

The 41 sets and their abbreviations:

| `abbr` | Set (`name`) | `type` |
|---|---|---|
| `core` | Core Set | 1st Core Set |
| `dkcy` | Dark City | 1st Expansion |
| `ff04` | Fantastic Four | 2nd Expansion |
| `pttr` | Paint the Town Red | 3rd Expansion |
| `vill` | Villains | 2nd Core Set |
| `gotg` | Guardians of the Galaxy | 4th Expansion |
| `fear` | Fear Itself | 5th Expansion |
| `3dtc` | Playable Marvel 3D Trading Cards | Promo / Trading Card Mini-Expansion |
| `ssw1` | Secret Wars Vol 1 | 6th Expansion |
| `ssw2` | Secret Wars Vol 2 | 7th Expansion |
| `ca75` | Captain America 75th | 8th Expansion |
| `cvwr` | Civil War | 9th Expansion |
| `dead` | Deadpool | 10th Expansion |
| `noir` | Noir | 11th Expansion |
| `xmen` | X-Men | 12th Expansion |
| `smhc` | Spider-Man Homecoming | 13th Expansion |
| `chmp` | Champions | 14th Expansion |
| `wwhk` | World War Hulk | 15th Expansion |
| `msp1` | Marvel Studios, Phase 1 | 3rd Core Set |
| `antm` | Ant-Man | 16th Expansion |
| `vnom` | Venom | 17th Expansion |
| `dims` | Dimensions | 18th Expansion |
| `rvlt` | Revelations | 19th Expansion |
| `shld` | S.H.I.E.L.D. | 20th Expansion |
| `asrd` | Heroes of Asgard | 21st Expansion |
| `nmut` | New Mutants | 22nd Expansion |
| `cosm` | Into the Cosmos | 23rd Expansion |
| `rlmk` | Realm of Kings | 24th Expansion |
| `anni` | Annihilation | 25th Expansion |
| `msmc` | Messiah Complex | 26th Expansion |
| `dstr` | Doctor Strange | 27th Expansion |
| `mgtg` | MCU Guardians of the Galaxy | 28th Expansion |
| `bkpt` | Black Panther | 29th Expansion |
| `bkwd` | Black Widow | 30th Expansion |
| `msis` | MCU The Infinity Saga | 31st Expansion |
| `mdns` | Midnight Sons | 32nd Expansion |
| `wtif` | What If | 4th Core Set |
| `amwp` | Ant-Man and the Wasp | 33rd Expansion |
| `2099` | 2099 | 34th Expansion |
| `wpnx` | Weapon X | 35th Expansion |
| `co2e` | Core Set (2nd Edition) | Core Set (2nd Edition) |

The table order matches the `sets.json` array order — `co2e` (set #41) is
appended after `wpnx`, not slotted by release date.

> **The convert pipeline does not read `sets.json` for the abbreviation.**
> Stage 1 ([`convert-cards-v15.mjs`](../scripts/convert-cards/convert-cards-v15.mjs))
> carries its own hardcoded `SET_ABBR_MAP` keyed by the **upstream** source-set
> name (`'NewMutants' → 'nmut'`) and composes every `imageUrl` from that. For
> the 40 sets with card data, the `abbr` values in `sets.json` match
> `SET_ABBR_MAP`'s values exactly — but `sets.json` is the canonical registry
> the running app reads, while the pipeline map is a build-time convenience.
> Adding a new set means adding the abbreviation in **both** places, and they
> must match, until the naming is made data-driven from `sets.json` (a
> Work-Packet-scoped change, not in place today).
>
> **Live gap: `co2e`.** Core Set 2nd Edition (set #41) is registered in
> `sets.json` as `co2e` but has **no** `SET_ABBR_MAP` entry — the two
> diverge for this one set. It stays harmless not because the set is empty
> (`data/cards/co2e.json` is fully populated) but because **co2e is
> hand-maintained and never fed through the converter**: it has no upstream
> `modern-master-strike` source and no entry under
> `scripts/convert-cards/inputs/cards/`, so `SET_ABBR_MAP` is never consulted
> for it and its `imageUrl`s are authored directly. The entry must be added
> before the converter is ever run for co2e, or generated `imageUrl`s would
> lose the `co2e` prefix. See
> [Data & File Locations](data-file-locations.md) → the co2e exception, and
> [Card Image Acquisition](card-image-acquisition.md) → Open Questions.

### Ribbon codes by card type

The ribbon is a two-letter code identifying the card family. The complete,
authoritative registry of card-type prefixes is the project's upstream card-data
source — the 37-entry `modern-master-strike/src/data/card-types.json` (sibling
repo). Each entry is `{ id, slug, name, displayName, prefix }`; the six hero
rarity slots all share the `hr` prefix.

| Prefix | Card type | Slug(s) |
|---|---|---|
| `sc` | Scheme | `scheme` |
| `st` | Scheme Twist | `scheme-twist` |
| `sx` | Scheme Transform | `scheme-transform` |
| `sv` | Scheme Veiled | `scheme-veiled` |
| `mm` | Mastermind | `mastermind` |
| `ma` | Mastermind Adapting | `mastermind-adapting` |
| `mp` | Mastermind Adapting Epic | `mastermind-adapting-epic` |
| `me` | Mastermind Epic | `mastermind-epic` |
| `mt` | Mastermind Tactics | `mastermind-tactics` |
| `mc` | Mastermind Tactics Epic | `mastermind-tactics-epic` |
| `ms` | Mastermind Strike | `mastermind-strike` |
| `vi` | Villain | `villain` |
| `hm` | Henchman | `henchman` |
| `hr` | Hero (all rarities) | `hero-common1` · `hero-common2` · `hero-common3` · `hero-uncommon` · `hero-uncommon2` · `hero-rare` |
| `sk` | Sidekick | `sidekick` |
| `ss` | Sidekick Special | `sidekick-special` |
| `sa` | S.H.I.E.L.D. Agent | `shield-agent` |
| `so` | S.H.I.E.L.D. Officer | `shield-officer` |
| `sp` | S.H.I.E.L.D. Officer Special | `shield-officer-special` |
| `tr` | S.H.I.E.L.D. Trooper | `shield-trooper` |
| `by` | Bystander | `bystander` |
| `bh` | Bystander Heroic | `bystander-heroic` |
| `bs` | Bystander Special | `bystander-special` |
| `wd` | Wound | `wound` |
| `we` | Wound Enraging | `wound-enraging` |
| `wg` | Wound Grievous | `wound-grievous` |
| `am` | Ambitions | `ambitions` |
| `ho` | Horror | `horror` |
| `lo` | Location | `location` |
| `sr` | Start | `start` |
| `to` | Token | `token` |
| `tp` | Trap | `trap` |

> **Two `card-types.json` files — do not confuse them.** The prefix registry
> above is the **upstream** `modern-master-strike/src/data/card-types.json`. The
> **in-repo** [`data/metadata/card-types.json`](../data/metadata/card-types.json)
> is a separate Registry-Viewer taxonomy carrying `slug` / `label` / `emoji` /
> `order` / `parentType` and **no prefix** — see Edge Cases.

### Filename patterns

Every image is `{set}-{prefix}-{slug(s)}.webp`. The convert pipeline currently
auto-composes `imageUrl`s for the core imaged families:

| Family | Pattern | Example |
|---|---|---|
| Hero (`hr`) | `{set}-hr-{heroSlug}-{sides…}.webp` | `nmut-hr-wolfsbane-night-vision.webp` |
| Mastermind base (`mm`) | `{set}-mm-{mmSlug}.webp` | `bkpt-mm-killmonger.webp` |
| Mastermind epic (`me`) | `{set}-me-{mmSlug}.webp` | `bkpt-me-killmonger.webp` |
| Mastermind tactic (`mt`) | `{set}-mt-{mmSlug}-{cardSlug}.webp` | `2099-mt-sinister-six-2099-electro-2099.webp` |
| Villain (`vi`) | `{set}-vi-{groupSlug}-{cardSlug}.webp` | `2099-vi-alchemax-enforcers-cyber-nostra.webp` |
| Henchman (`hm`) | `{set}-hm-{groupSlug}.webp` (group) / `{set}-hm-{groupSlug}-{cardSuffix}.webp` (per-card) | `core-hm-hand-ninjas.webp` |
| Scheme (`sc`) | `{set}-sc-{schemeSlug}.webp` | `2099-sc-pull-reality-into-cyberspace.webp` |
| Bystander (`by`) | `{set}-by-{slug}.webp` | `co2e-by-police-officer.webp` |
| Wound (`wd`) | `{set}-wd-{slug}.webp` | `core-wd-wound.webp` |

Base and epic mastermind filenames carry a **single** slug — the redundant
double slug (`bkpt-mm-killmonger-killmonger.webp`) was removed; tactic and
villain cards keep both the group/mastermind slug and the per-card slug because
those families have multiple distinct cards under one parent. The remaining
prefixes in the registry (e.g. `st`, `sa`, `so`, `tr`, `sk`, `am`, `to`) name
their card families' images by the same `{set}-{prefix}-{slug}.webp` rule; their
URLs are **not auto-composed by the pipeline** — but that is a statement about
the *converter*, not about whether they are used. A hand-authored set writes
them directly: `co2e` references `sa` (S.H.I.E.L.D. Agent), `so`
(`co2e-so-officer.webp` plus five class variants), `tr` (Trooper), `sk`
(`co2e-sk-daring-sidekick.webp`), and `ms` / `st` (Master Strike, Scheme Twist),
alongside five `me` epic-mastermind faces — every one of them a stored
`imageUrl` written by hand to this same rule.

### Hero filename variants

Heroes are the most structured family because a hero card can be single-sided,
a two-sided split card, or carry a companion character. The builder is
[`heroImageUrl.ts`](../packages/registry/src/heroImageUrl.ts):

- **Solo (one side):** `{set}-hr-{heroSlug}-{sides[0]}.webp`
  — `nmut-hr-wolfsbane-night-vision.webp`
- **Split (two sides):** `{set}-hr-{heroSlug}-{sides[0]}-{sides[1]}.webp`
  — `bkwd-hr-falcon-winter-soldier-attune-atone.webp`
- **Companion:** the companion slug is inserted between the hero slug and the
  side segment — `{set}-hr-{heroSlug}-{companionSlug}-{sides…}.webp`
  — `mgtg-hr-drax-rhomann-dey-remove-his-spine-also-illegal.webp`

`sides` must contain exactly one or two entries; for two-sided cards the array
order is the physical-side order and is **not** sorted (D-14702), while
single-side ordering follows the UTF-16 sort lock (D-13802). The optional
companion slug must match `^[a-z0-9-]+$`.

### Adding a new set

When a new set is released, its images join this same convention — the set's
abbreviation (`setAbbr`) becomes both the R2 directory and the filename prefix,
and every card's filename follows the ribbon table above. Two halves are
involved:

1. **URL generation (automatic).** The set's npm-derived source files are placed
   under `scripts/convert-cards/inputs/cards/` (with any per-set fixups under
   `scripts/convert-cards/inputs/patches/` and count inputs under
   `scripts/convert-cards/inputs/`). The convert pipeline assigns the ribbon per
   card family and writes `data/cards/{setAbbr}.json` with each card's `imageUrl`
   already composed to this convention — the URLs are generated, never
   hand-written.
2. **Image assets (manual).** The actual `.webp` files must exist on R2 under
   `{setAbbr}/` at the exact `{setAbbr}-{ribbon}-{slug}.webp` paths the generated
   `imageUrl`s point to. Producing and uploading those assets is the manual
   side; a mismatch between a generated `imageUrl` and the uploaded object name
   is what shows up as a broken image in the Registry Viewer.

A set that only adds new cards of **existing** card types needs no code change —
the ribbons already cover those families, so it is effectively a data drop into
`scripts/convert-cards/inputs/`. A set that introduces a brand-new card *type*
(and therefore a new ribbon) requires a convert-pipeline change, because ribbons
are assigned in code rather than derived from `card-types.json` (see Edge Cases).

### The hand-authored variant (how `co2e` was actually built)

The two-halves flow above assumes the convert pipeline generates the
`imageUrl`s. A set with **no upstream source** — Core Set 2nd Edition is the
first — is authored the other way round, and the ordering is the interesting
part. Because the scraped 2e source filenames carried only *rarity*
(`_1Rare`, `_2Common`) and not the card title the `hr` convention needs, the
images were uploaded **before** the titles were known:

1. **Upload under provisional names.** All 151 images went to R2 first, hero
   art under rarity placeholders (`co2e-hr-black-widow-common-1.webp`). The set
   validated green at this stage because the stored `imageUrl`s matched those
   placeholder objects — the convention cares that the URL resolves, not that
   the slug is final.
2. **Author the card data.** Real titles arrive per hero, and each
   `physicalCards[].imageUrl` is rewritten to the title-slug form the
   convention wants (`co2e-hr-black-widow-covert-operation.webp`).
3. **Rename the objects to match.** A server-side `rclone copyto` copies each
   object from its placeholder key to the title-slug key — **copy, not move**,
   so the placeholder survives as a harmless orphan and every step stays
   reversible while the data is still being reviewed.
4. **Sweep the orphans.** Once the set is complete and no `imageUrl` references
   a placeholder, the leftovers are deleted in one pass (co2e: 60 hero
   placeholders removed, leaving exactly 151 objects — one per card).

The lesson that generalises: **the stored `imageUrl` is the contract, not the
object name.** Renaming an image means copy-to-new-key → repoint the stored
URL → verify → only then delete the old key. Never rename first.

## Delivery & Caching

The naming convention above makes every card image **content-addressed**: a given
`{setAbbr}-{ribbon}-{slug}.webp` never changes bytes — new art is a new slug or set,
i.e. a new URL. That immutability is what makes the two delivery decisions below
safe. Both landed 2026-07-21.

### Prefetch at match start (WP-410 / D-24222)

The arena client warms the match's card images into the browser image cache **during
the setup / pre-match screen**, so a card paints from cache the moment it is revealed
instead of blocking the turn on a round-trip to `images.legendary-arena.com`.

The client cannot derive the image set itself — it may not import the registry at
runtime (layer boundary), and the live UIState projects only *currently-visible*
cards. So the **engine** projects the deduped, non-empty set of every `imageUrl` in
`G.cardDisplayData` as an optional top-level `UIState.matchCardImageUrls`, passed
through `filterUIStateForAudience` public for every audience (the design set is public
from the composition — information-safe; no face-down order). The client composable
[`useCardImagePrefetch`](../apps/arena-client/src/composables/useCardImagePrefetch.ts)
warms the list with bounded concurrency, fail-soft (a rejected warm falls back to
`CardTile.vue`'s lazy `<img>`), and idempotent (a `Set`, so the per-frame re-send and
reconnect never refetch). Projection-only — never a `G` field, no state-hash surface.

The **LAGN document is unchanged** by this — image bytes are not embedded and there is
no zip side-cart. The embed-vs-zip-vs-prefetch analysis that chose this path lives on
[LAGN Specification](lagn-v1.md) §"Card Images: Embed, Side-Cart, or Prefetch?".

### Immutable `Cache-Control` (pending operator action)

Because card images are immutable, they **should** serve
`Cache-Control: public, max-age=31536000, immutable` so the Cloudflare edge caches
them and a previously-seen card is free on every later request — the companion to the
prefetch, making a warmed image free *across* matches, not just within one. As of
2026-07-21 they serve **no `Cache-Control`** and `cf-cache-status: DYNAMIC` (nothing is
edge-cached).

Applying it is an out-of-band operator action, documented in
[`docs/ops/RUNBOOK-r2-image-cache-control.md`](../docs/ops/RUNBOOK-r2-image-cache-control.md)
and recorded (as not-yet-applied) in
[`docs/ops/OUT-OF-BAND-SETTINGS.md`](../docs/ops/OUT-OF-BAND-SETTINGS.md). The one
guardrail: the immutable header applies to the **card-image prefixes only** — never
`avatars/` (mutable bytes at a stable key) or `metadata/` (re-synced JSON), which it
would pin stale. The `--header-upload` flag on the [Card Image
Acquisition](card-image-acquisition.md) upload command already stamps the header on
future set uploads.

## Interactions

- **[Card Type Taxonomy](card-type-taxonomy.md).** The card-type taxonomy in
  [`data/metadata/card-types.json`](../data/metadata/card-types.json) is the
  canonical list of card types (`hero`, `mastermind`, `villain`, `henchman`,
  `scheme`, `bystander`, `wound`, `sidekick`, `shield`, `other`, plus
  sub-chips). Each *imaged* type maps to a ribbon code above. The taxonomy
  names the types; this page documents how each is named on R2. Note the
  **in-repo** taxonomy file does **not** carry the ribbon codes; the upstream
  `card-types.json` is the prefix registry — see Ribbon codes by card type and
  Edge Cases.
- **[CardExtId](cardextid.md).** A `CardExtId` is `<setAbbr>/<slug>` — the same
  `setAbbr` and slug components that compose the image filename. The image URL
  is an orthogonal projection of the same identity parts into an R2 path.
- **Convert pipeline.** [`convert-cards-v15.mjs`](../scripts/convert-cards/convert-cards-v15.mjs)
  reads the npm-derived set sources under `scripts/convert-cards/inputs/`,
  assigns the ribbon per family, and writes the resulting `imageUrl` into each
  card object in `data/cards/{setAbbr}.json`.
- **Registry Viewer.** `apps/registry-viewer` consumes each card's `imageUrl`
  field verbatim to render tiles and the detail panel; it does not recompute the
  URL. A mis-named R2 object surfaces as a broken image in the viewer.

## Edge Cases

- **The prefix registry lives upstream, not in the in-repo taxonomy.** The
  authoritative prefix mapping is the upstream
  `modern-master-strike/src/data/card-types.json` (37 entries, each with a
  `prefix`). The **in-repo** [`data/metadata/card-types.json`](../data/metadata/card-types.json)
  is a *different* file — the Registry-Viewer taxonomy reintroduced by WP-086
  with the shape `{ slug, label, emoji?, order, parentType }` and **no prefix
  field** (the pre-WP-084 in-repo file did carry a `prefix`; WP-086 dropped it).
  Inside this repo, the convert pipeline therefore carries the imaged-subset
  prefixes as hardcoded literals; adding an entry to the in-repo
  `card-types.json` does **not** create an image ribbon. Making the in-repo
  naming data-driven — so the prefix registry lives in this repo as the single
  source — would mean importing the prefixes into `data/metadata/card-types.json`,
  extending its strict Zod schema with a `prefix` / `ribbon` field, and wiring
  the convert pipeline to read it. That is a data-plus-code change at Work-Packet
  scope, would require its own DECISIONS entry, and is not in place today.
- **Not every taxonomy type is imaged.** The convert pipeline emits ribbon
  images for hero, mastermind (base/epic/tactic), villain, henchman, scheme,
  bystander, and wound. Other taxonomy entries (`sidekick`, `shield` and its
  sub-chips, `other` and its sub-chips such as scheme-twist and master-strike)
  do not get their own ribbon family from the pipeline — they are either
  deck-internal card kinds or are not separately imaged.
- **Two-sided hero ordering is not sorted (D-14702).** For `sides.length === 2`,
  the source-data order is preserved verbatim (side A first). This narrowly
  overrides the D-13802 UTF-16 sort lock, which still governs single-side
  filenames and any future automatic ordering.
- **Side-count ceiling is two (D-13802).** `heroImageUrl` throws if `sides` is
  not an array of length 1 or 2; raising the ceiling requires a new DECISIONS
  entry.
- **`S.H.I.E.L.D.` normalization.** The convert pipeline rewrites
  `s.h.i.e.l.d.` to the slug `shield` before composing filenames, so dotted
  source names never leak into URLs.
- **The host moved.** Image URLs were historically on
  `images.barefootbetters.com`; the current host is
  `images.legendary-arena.com`, the single constant `R2_BASE_URL`. Any older
  reference to the barefootbetters host is stale. The player-avatar surface
  (`AVATAR_CDN_BASE` in `apps/server/src/profile/avatarUpload.logic.ts`) was
  the last code path still on the legacy host; WP-296 / D-24083 unified it
  onto `images.legendary-arena.com` (same `legendary-images` bucket), so card
  images and avatars now share one host.

## Code Touchpoints

- [`packages/registry/src/heroImageUrl.ts`](../packages/registry/src/heroImageUrl.ts)
  — `R2_BASE_URL` constant and the hero (`hr`) URL builder (solo / split /
  companion).
- [`scripts/convert-cards/convert-cards-v15.mjs`](../scripts/convert-cards/convert-cards-v15.mjs)
  — assigns the `mm` / `me` / `mt` / `vi` / `hm` / `sc` / `by` / `wd` ribbons
  and writes `imageUrl` into the generated card JSON.

## Data Files

- [`data/metadata/sets.json`](../data/metadata/sets.json) — the canonical
  41-entry set index (`id`, `abbr`, `pkgId`, `slug`, `name`, `releaseDate`,
  `type`). Its `abbr` field is the `{setAbbr}` directory + filename prefix; the
  Registry loads it at startup.
- `modern-master-strike/src/data/card-types.json` (upstream, sibling repo) — the
  authoritative 37-entry card-type **prefix** registry.
- [`data/metadata/card-types.json`](../data/metadata/card-types.json) — the
  in-repo Registry-Viewer taxonomy (type list; **no** prefix codes).
- `data/cards/{setAbbr}.json` — the generated per-set card data; each card
  object carries the composed `imageUrl`.

## History

- D-13802 — sides UTF-16 sort lock and the two-side ceiling for hero filenames.
- D-14701 — optional `companionSlug` on the physical-card schema; placed between
  hero slug and side segment in the filename.
- D-14702 — two-side hero filenames preserve source-data side order (no sort),
  narrowly overriding D-13802.
- Card-type-taxonomy history: the `prefix` field was present pre-WP-084, dropped
  by the WP-086 reintroduction — see [Card Type Taxonomy](card-type-taxonomy.md).
- 2026-07-17/18 — `co2e` (set #41) completed as the first **hand-authored** set:
  151 images uploaded under provisional rarity placeholders, then renamed to
  title slugs as each hero's card data was authored (copy-then-repoint-then-
  sweep; 60 placeholder orphans deleted). It is also the first set to reference
  the `me`, `sa`, `so`, `tr`, and `sk` ribbons from hand-written `imageUrl`s.

## References

- [`heroImageUrl.ts`](../packages/registry/src/heroImageUrl.ts) — host constant
  and hero URL builder
- [`data/metadata/sets.json`](../data/metadata/sets.json) — canonical set index;
  the `abbr` field is the `{setAbbr}` directory + filename prefix
- [`convert-cards-v15.mjs`](../scripts/convert-cards/convert-cards-v15.mjs) —
  ribbon assignment, the hardcoded `SET_ABBR_MAP`, and `imageUrl` generation
- `modern-master-strike/src/data/card-types.json` (upstream card-data origin,
  sibling repo) — the authoritative 37-entry card-type **prefix** registry
  (`sc`, `st`, `sa`, `tr`, …)
- [`data/metadata/card-types.json`](../data/metadata/card-types.json) — in-repo
  Registry-Viewer taxonomy (no prefix codes)
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-13802, D-14701, D-14702
  (hero filename rules)
- [Card Type Taxonomy](card-type-taxonomy.md) — the type list and its
  pre/post-WP-086 shape change
