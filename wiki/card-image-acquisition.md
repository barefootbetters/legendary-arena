---
title: Card Image Acquisition
type: Guide
tags:
  - images
  - data-pipeline
  - tooling
  - card-type
related:
  - r2-image-naming-convention.md
  - data-file-locations.md
  - card-type-taxonomy.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\card-image-acquisition.md (this page — https://ewiki.legendary-arena.com/card-image-acquisition/)
  - ../scripts/card-image-downloaders/download-legendarycardgame-co2e.ps1
  - ../scripts/card-image-downloaders/README.md
  - ../scripts/card-image-converters/Convert-Co2e-JpgToWebp.ps1
  - ../scripts/card-image-converters/README.md
  - ../scripts/card-image-renamers/rename-co2e-images.ps1
  - ../scripts/card-image-renamers/README.md
last-reviewed: 2026-07-18
---

# Card Image Acquisition

## Summary

Card face images originate as scraped JPEGs pulled from the
`legendarycardgame.com` "at-a-glance" set pages by a family of
per-set PowerShell scrapers, get re-encoded to WebP, then get renamed to
the deterministic R2 convention before upload to Cloudflare R2. This
page documents the three staging steps — **scrape → convert → rename** —
that feed the naming convention gameplay and the Registry Viewer depend
on. The deployed, R2-hosted naming is defined separately by
[R2 Image Naming Convention](r2-image-naming-convention.md); this page
covers how the raw bytes get there.

The three steps run as separate per-set PowerShell scripts, producing a
three-directory staging chain:

```
original-jpeg\<set>\   --convert-->   original\<set>\   --rename-->   renamed\<set>\
   (scraped JPEG)                        (WebP)                     (R2-named WebP)
```

> **Where the runnable scripts live.** The canonical, runnable copies
> live in the sibling **staging repo**, not this repo:
> `barefootbetters-legendary-setup\card-images-staging\`, alongside their
> per-set image directories. This repo keeps **version-controlled
> backups** under
> [`scripts/card-image-downloaders/`](../scripts/card-image-downloaders/),
> [`scripts/card-image-converters/`](../scripts/card-image-converters/),
> and [`scripts/card-image-renamers/`](../scripts/card-image-renamers/)
> so the tooling survives outside the staging tree. Edit the staging
> copy to run it; keep the backup copy in sync.

## Mechanics

### The per-set scraper

Each set has its own scraper named
`download-legendarycardgame-<set>.ps1`. Every script is the same shape,
differing only in two configuration lines at the top — the page URL and
the output directory:

```
$PageUrl   = "https://www.legendarycardgame.com/core-set-at-a-glace-2ndedition"
$OutputDir = "co2e"
```

The body then:

1. Creates `$OutputDir` if it does not exist.
2. Fetches `$PageUrl` with `Invoke-WebRequest`.
3. Collects image URLs two ways — every `<img>` tag's `src`, plus a
   regex sweep of the page HTML for any `https?://…\.(jpg|jpeg|png|webp)`
   URL (to catch inline / background images the `<img>` pass misses).
4. Dedupes and sorts the URL list.
5. Downloads each image into `$OutputDir`, resolving relative URLs
   against the page base and **skipping files that already exist** (so
   re-running is cheap and only fetches new images).

Because the output directory is **relative**, the script must be run
from the staging `original-jpeg` folder so the per-set directory lands
next to the other sets.

### Naming of the scraped files

The scraper writes each file under the leaf name of its source URL —
i.e. the filename the publisher used on `legendarycardgame.com`, not the
deterministic R2 name. For the Core Set 2nd Edition these arrive
`2e`-prefixed and roughly typed by the publisher — for example
`2eHeroSpider-Man_1Rare.jpg`, `2eMastermind_RedSkullEpic.jpg`,
`2eSchemeSuperHeroCivilWar.jpg`, `2eVillainHydraViper.jpg`. These are
**source-side names**, distinct from the
`{setAbbr}-{ribbon}-{slug}.webp` convention the card-conversion pipeline
emits into each card's `imageUrl`
(see [R2 Image Naming Convention](r2-image-naming-convention.md)). The
renaming / re-encoding to the R2 convention happens downstream of this
acquisition step, not in the scraper.

### Where the output lands

Scraped JPEGs stage under the sibling setup repo, and the WebP
conversion writes a parallel `original\<set>\` tree beside the raw
`original-jpeg\<set>\` inputs:

```
barefootbetters-legendary-setup\
└── card-images-staging\
    ├── Convert-<Set>-JpgToWebp.ps1                 (one per set)
    ├── rename-<set>-images.ps1                     (one per set)
    ├── original-jpeg\
    │   ├── download-legendarycardgame-<set>.ps1    (one per set)
    │   ├── core/                                    (1st-edition core JPEGs)
    │   ├── co2e/                                  (2nd-edition core JPEGs)
    │   ├── anni/  antm/  asrd/  …                   (per-set JPEG inputs)
    │   └── …
    ├── original\
    │   ├── co2e/                                  (2nd-edition core WebP)
    │   ├── anni/  antm/  …                          (per-set WebP outputs)
    │   └── …
    └── renamed\
        ├── co2e/                                  (R2-named WebP, upload-ready)
        ├── core/  …                                 (per-set R2-named WebP)
        └── …
```

Each set's directory is keyed by a short set token that matches the
script name (`co2e`, `anni`, `bkpt`, `cvwr`, …). The naming tells you
the stage: `original-jpeg\` holds the scraped **JPEG inputs**,
`original\` the converted **WebP**, and `renamed\` the **R2-named WebP**
that is ready to upload.

### Converting JPEG to WebP

The staged JPEGs are re-encoded to WebP by a family of per-set scripts
named `Convert-<Set>-JpgToWebp.ps1`, one per set, differing only in
their input/output set token. Each script:

1. Resolves ImageMagick (`magick.exe`) — on `PATH`, or the fallback
   install at `C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe`.
2. Reads every `.jpg` / `.jpeg` under `original-jpeg\<set>\` (recursing
   into subfolders).
3. Writes `.webp` to `original\<set>\`, preserving subfolder structure
   and **skipping files that already exist** (idempotent re-runs).

The encode settings are fixed in each script:

| Setting | Value | Effect |
|---|---|---|
| `$Quality` | `80` | WebP quality (0-100). |
| `$StripMeta` | `$true` | Passes `-strip` to drop metadata for smaller files. |
| `$SkipExisting` | `$true` | Never overwrites an existing `.webp`. |
| `$Recurse` | `$true` | Processes subfolders. |

Conversion preserves the **source-side filename** (only the extension
changes: `2eHeroSpider-Man_1Rare.jpg` → `2eHeroSpider-Man_1Rare.webp`).
The rename to the deterministic `{setAbbr}-{ribbon}-{slug}.webp` R2 name
is the *next* step — WebP conversion changes the *format*, not the
*name*.

### Renaming to the R2 convention

The final staging step is a per-set script named
`rename-<set>-images.ps1` that copies each converted WebP from
`original\<set>\` into `renamed\<set>\` under its deterministic R2 name
(`{setAbbr}-{ribbon}-{slug}.webp`). The script:

1. Clears `renamed\<set>\`, then copies each mapped file across.
2. Restamps every copy's `LastWriteTime` to "now" (so a fresh run is
   visible at a glance — `Copy-Item` otherwise preserves the WebP's
   generation date).
3. Reports `NOT FOUND` in red for any mapped source missing from
   `original\<set>\`, and prints a "BEFORE UPLOADING TO R2" checklist of
   items to verify.

Unlike the scrape and convert steps — which are fully mechanical — the
**rename map is hand-authored per set.** Each entry pairs a source
filename with a target `{setAbbr}-{ribbon}-{slug}.webp` name, assigning
the correct two-letter ribbon per card family (`hr`, `mm`, `me`, `mt`,
`vi`, `hm`, `sc`, `st`, `ms`, `by`, `wd`, `sa`, `so`, `tr`, `sk`; see
[R2 Image Naming Convention](r2-image-naming-convention.md)). This is
where the source-side name (`2eHeroSpider-Man_1Rare.webp`) becomes the
canonical R2 name (`co2e-hr-spider-man-…​.webp`).

**Source-name legibility varies by set.** For Core Set 2nd Edition, most
families' 2e source names embed enough to derive the slug directly —
villains, schemes, henchmen, bystanders, S.H.I.E.L.D., and even the
mastermind **tactics** (each tactic is named, e.g.
`…RedSkullTacticVastResources` → `co2e-mt-red-skull-vast-resources`),
so there is none of the 1st-edition `Tactic1-4` ordering ambiguity.
**Heroes are the exception:** the 2e hero source names carry only rarity
(`_1Rare` / `_2Common` / `_3Common` / `_4Uncommon`), not the card title
the R2 hero convention uses for its slug — so the `co2e` map fills
those 60 entries with **rarity placeholders** (`rare` / `common-1` /
`common-2` / `uncommon`) that must be replaced with real card-title
slugs before upload. See Edge Cases.

## Interactions

- **[R2 Image Naming Convention](r2-image-naming-convention.md).** The
  target of the rename step and the authority for it. The rename map in
  each `rename-<set>-images.ps1` must produce exactly the
  `{setAbbr}-{ribbon}-{slug}.webp` names that convention defines (and
  that the convert pipeline emits into each card's `imageUrl`) — a
  mismatch surfaces as a broken image in the Registry Viewer. The
  `{setAbbr}` piece is a set's **`abbr`** from
  [`data/metadata/sets.json`](../data/metadata/sets.json), not the scrape
  token by coincidence; that page's "Set abbreviation" section is the
  authority for where the directory prefix comes from. This page covers
  the staging steps that *produce* those names; that page defines what the
  names must be.
- **[Data & File Locations](data-file-locations.md).** The locator map
  for card JSON, the convert pipeline, and R2 key prefixes. The staging
  tree described here is the pre-pipeline holding area those locations
  are eventually populated from.
- **[Card Type Taxonomy](card-type-taxonomy.md).** The publisher's
  source filenames carry a loose type hint (`2eHero…`, `2eVillain…`,
  `2eMastermind_…`) that maps, after processing, onto the engine's
  card-type taxonomy and its ribbon codes.
- **Convert pipeline.** `scripts/convert-cards/` composes each card's
  `imageUrl` to the R2 convention; it consumes set *data*, not these raw
  JPEGs, but both halves must agree on the final object name for images
  to resolve in the Registry Viewer.

## Edge Cases

- **The scraper grabs non-card page images.** Because step 3 sweeps
  every image URL on the page, banner / photo assets on the at-a-glance
  page are downloaded too. The Core Set 2nd Edition run pulled one such
  stray (`20220108_175929.jpg`, a timestamp-named page photo) alongside
  the 151 card images. Review the output directory and remove non-card
  files before feeding the set downstream.
- **URL / output-dir must both change per set.** The scripts are copies
  differing only in `$PageUrl` and `$OutputDir`. Changing one without
  the other either scrapes the wrong page or collides output into an
  existing set's directory. The 2nd-edition core variant deliberately
  writes to `co2e/` so it does not overwrite the 1st-edition `core/`.
- **1st vs 2nd edition are different pages.** The 1st-edition core page
  is `/core-set-at-a-glace` (note the publisher's spelling — "glace",
  not "glance"); the 2nd edition is `/core-set-at-a-glace-2ndedition`.
  They are separate scrapes with separate output directories.
- **Re-running is idempotent for existing files only.** The
  existence-check skips files already present but does not detect
  publisher-side image changes; a changed image at the same filename is
  not re-fetched. Delete the local copy to force a refresh.
- **Run location matters.** The relative `$OutputDir` resolves against
  the current working directory, so running the scraper from anywhere
  other than the staging `original-jpeg` folder scatters output.
- **Non-card strays carry through the conversion.** The converter
  processes every JPEG in the input directory, so a stray like
  `20220108_175929.jpg` becomes `20220108_175929.webp` too. Prune
  non-card files from `original-jpeg\<set>\` *before* converting, or
  delete their `.webp` afterward.
- **Convert scripts must resolve the staging root portably.** The
  staging-repo `Convert-<Set>-JpgToWebp.ps1` scripts historically set
  `$StagingRoot` to a per-machine absolute path (e.g. `C:\GISE\…`), which
  failed on any other machine. All 37 staging converters were repointed
  to resolve the root from the script's own location (`$PSScriptRoot`) on
  2026-07-14, matching the in-repo `co2e` backup; new converters must
  follow that pattern. The staging folder is not version-controlled, so a
  re-copied or regenerated script could reintroduce a hardcoded path —
  check the `$StagingRoot` line before running an unfamiliar converter.
- **WebP savings are modest for these sources.** At `$Quality = 80` the
  Core Set 2nd Edition set shrank only ~8% (≈445 MB → ≈408 MB) because
  the source JPEGs are already large, high-quality scans. WebP here is
  mainly about format normalization for R2, not aggressive size
  reduction; lowering `$Quality` trades fidelity for smaller files.
- **ImageMagick is a hard dependency.** The converter throws if
  `magick.exe` is neither on `PATH` nor at the fallback install path.
  WebP support is built into ImageMagick 7 (used here: 7.1.2 Q16-HDRI).
- **Hero rename slugs were placeholders — resolved on R2, not in the
  staging tree (2026-07-17/18).** The `co2e` rename map fills all 60 hero
  targets with rarity placeholders (`co2e-hr-<hero>-rare` / `-common-1` /
  `-common-2` / `-uncommon`) because the 2e source filenames carry only
  rarity, not the card title the R2 hero convention needs. The original
  guidance here was "replace them with real card-title slugs *before* R2
  upload." **That is not what happened, and the actual path is the better
  one for a set whose titles are not yet known:** the placeholder-named
  images were uploaded as-is (the set validates green because the stored
  `imageUrl`s match those objects), and each hero was renamed *in place on
  R2* as its card data was authored — `rclone copyto` to the title-slug
  key, repoint the stored `imageUrl`, verify, and only then delete the old
  key. All 60 hero placeholders are now retired. The staging tree's rename
  map still carries the placeholder targets; it is the historical record of
  the upload, not the current R2 state. See
  [R2 Image Naming Convention](r2-image-naming-convention.md) → "The
  hand-authored variant".
- **2e group slugs — confirmed correct.** The `co2e` villain targets follow
  the 2e source names: `skulls` (1st-ed core used `skrulls`) and
  `sinister-spider-foes` (1st-ed used `spider-foes`). Both are now
  **confirmed against the authored co2e card data** — the villain groups
  ship as `skulls` and `sinister-spider-foes`, so the scraped image names
  and the card data agree and no re-rename is needed.
- **The rename destination is cleared each run.** `rename-<set>-images.ps1`
  runs `Remove-Item "renamed\<set>\*"` before copying, so any manual
  fixes made directly in `renamed\<set>\` are lost on the next run. Make
  slug corrections in the script's rename map, not in the output folder.
- **The stray non-card image is dropped at rename.** The `co2e` map has
  no entry for `20220108_175929.webp`, so it is not copied into
  `renamed\co2e\` — 151 cards out of the 152 staged files. Its omission
  is deliberate (noted in a `# why:` comment), not a missed card.

## Code Touchpoints

- [`scripts/card-image-downloaders/download-legendarycardgame-co2e.ps1`](../scripts/card-image-downloaders/download-legendarycardgame-co2e.ps1)
  — backup copy of the Core Set 2nd Edition scraper (page URL, output
  dir, image-collection and download loop).
- [`scripts/card-image-downloaders/README.md`](../scripts/card-image-downloaders/README.md)
  — documents that this folder holds backup copies; the canonical
  runnable copies live in the staging repo.
- [`scripts/card-image-converters/Convert-Co2e-JpgToWebp.ps1`](../scripts/card-image-converters/Convert-Co2e-JpgToWebp.ps1)
  — backup copy of the Core Set 2nd Edition JPEG→WebP converter
  (ImageMagick resolve, quality / strip / skip-existing settings,
  recurse-and-convert loop).
- [`scripts/card-image-converters/README.md`](../scripts/card-image-converters/README.md)
  — converter backup-folder purpose, ImageMagick requirement, and
  encode settings.
- [`scripts/card-image-renamers/rename-co2e-images.ps1`](../scripts/card-image-renamers/rename-co2e-images.ps1)
  — backup copy of the Core Set 2nd Edition renamer: the hand-authored
  151-entry source→R2-name map, the clear/copy/restamp loop, and the
  before-upload verification checklist.
- [`scripts/card-image-renamers/README.md`](../scripts/card-image-renamers/README.md)
  — renamer backup-folder purpose, the hand-authored-map note, and the
  known co2e verification items.

## Data Files

- `barefootbetters-legendary-setup\card-images-staging\original-jpeg\`
  (sibling staging repo) — the scrapers and their per-set directories of
  raw source JPEGs. Not part of this repo.
- `barefootbetters-legendary-setup\card-images-staging\original\`
  (sibling staging repo) — the converters' per-set directories of
  WebP output. Not part of this repo.
- `barefootbetters-legendary-setup\card-images-staging\renamed\`
  (sibling staging repo) — the renamers' per-set directories of
  R2-named, upload-ready WebP. Not part of this repo.

## Open Questions

- **The R2 upload tail — the commands, for the record.** The scrape,
  convert, and rename steps are backed up in-repo
  (`scripts/card-image-downloaders/`, `-converters/`, `-renamers/`); the
  final push has no committed script, but it is a short rclone sequence.
  The `r2:` remote uses `env_auth`, so export `AWS_ACCESS_KEY_ID` /
  `AWS_SECRET_ACCESS_KEY` from `.env` into the shell first (`rclone lsd r2:`
  403s — the token is bucket-scoped; `r2:legendary-images/{set}/` operations
  work). Then:
  - **Bulk upload a staged set:**
    `rclone copy renamed\<set> r2:legendary-images/<set>/ --s3-no-check-bucket --header-upload "Cache-Control: public, max-age=31536000, immutable"`
    — the `--header-upload` flag stamps the immutable cache header so the CDN
    edge-caches each card image (card filenames are content-addressed, so the
    bytes never change). See
    [`docs/ops/RUNBOOK-r2-image-cache-control.md`](../docs/ops/RUNBOOK-r2-image-cache-control.md);
    apply it **only** to the card-image prefixes, never `avatars/` or `metadata/`
    (those are mutable at a stable key).
  - **Rename one object (server-side, non-destructive):**
    `rclone copyto r2:legendary-images/<set>/<old>.webp r2:legendary-images/<set>/<new>.webp --s3-no-check-bucket`
  - **Sweep orphans after repointing:**
    `rclone delete r2:legendary-images/<set>/ --files-from <list>` (or
    `deletefile` for one).
  - **Audit before deleting anything:** diff `rclone lsf` against every
    `imageUrl` in `data/cards/<set>.json`. On co2e this caught a stray
    `crushin-steel` original left behind by a title correction — the set is
    now exactly 151 objects, one per card, with zero unreferenced files and
    zero broken references.

  Note the separate, easily-missed step: card *images* live under
  `{setAbbr}/`, but the **Registry Viewer reads card *data* from the
  `metadata/` mirror**, which is also a manual `rclone copy` — see
  [Data & File Locations](data-file-locations.md).
- **~~co2e hero titles and provisional slugs need card data~~ — RESOLVED
  (2026-07-18).** co2e card data is now fully authored, which settled every
  provisional item: hero card titles are real (all 60 hero images renamed on
  R2 from rarity placeholders to title slugs), the group slugs `skulls` and
  `sinister-spider-foes` are confirmed against the shipped villain groups,
  and the S.H.I.E.L.D. Officer variants are authored under `so` as a base
  Officer plus five class Specialists. The old "do not upload under the
  placeholder names" instruction is superseded — see the Edge Case above for
  what actually happened and why upload-then-rename is the right order when
  titles are unknown at scrape time.
- **Set-token ↔ set-abbreviation — and a `SET_ABBR_MAP` gap for co2e.**
  A scrape/staging token (`co2e`, `bkpt`, …) must match a set's **`abbr`**
  in [`data/metadata/sets.json`](../data/metadata/sets.json) — the
  canonical 41-entry set registry whose `abbr` field *is* the `{setAbbr}`
  R2 directory and filename prefix (see
  [R2 Image Naming Convention](r2-image-naming-convention.md), "Set
  abbreviation (`setAbbr`) — from `sets.json`"). Core Set 2nd Edition is
  registered there as `co2e` (set #41). One gap remains: the convert
  pipeline carries a **second**, hardcoded `SET_ABBR_MAP` (in
  `scripts/convert-cards/convert-cards-v15.mjs`, keyed by the upstream
  source-set name), and `co2e` is **not yet in it**. A set's abbreviation
  must live in **both** places and match, or the generated `imageUrl` and
  the scrape token diverge. This gap is **still open but dormant**: co2e is
  hand-maintained — it has no upstream `modern-master-strike` source and no
  entry under `scripts/convert-cards/inputs/cards/`, so the converter is
  never run for it and `SET_ABBR_MAP` is never consulted. The entry must be
  added before anyone ever does run the converter for co2e.

## References

- [`scripts/card-image-downloaders/download-legendarycardgame-co2e.ps1`](../scripts/card-image-downloaders/download-legendarycardgame-co2e.ps1)
  — the scraper (backup copy)
- [`scripts/card-image-downloaders/README.md`](../scripts/card-image-downloaders/README.md)
  — scraper backup-folder purpose and run instructions
- [`scripts/card-image-converters/Convert-Co2e-JpgToWebp.ps1`](../scripts/card-image-converters/Convert-Co2e-JpgToWebp.ps1)
  — the JPEG→WebP converter (backup copy)
- [`scripts/card-image-converters/README.md`](../scripts/card-image-converters/README.md)
  — converter backup-folder purpose, ImageMagick requirement, settings
- [`scripts/card-image-renamers/rename-co2e-images.ps1`](../scripts/card-image-renamers/rename-co2e-images.ps1)
  — the source→R2-name renamer (backup copy)
- [`scripts/card-image-renamers/README.md`](../scripts/card-image-renamers/README.md)
  — renamer backup-folder purpose, hand-authored-map note, verification items
- [R2 Image Naming Convention](r2-image-naming-convention.md) — the
  deployed naming the rename step targets
- [Data & File Locations](data-file-locations.md) — where card data,
  the convert pipeline, and R2 prefixes live
