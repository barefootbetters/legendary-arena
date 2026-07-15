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
  - ../scripts/card-image-downloaders/download-legendarycardgame-core2e.ps1
  - ../scripts/card-image-downloaders/README.md
  - ../scripts/card-image-converters/Convert-Core2e-JpgToWebp.ps1
  - ../scripts/card-image-converters/README.md
last-reviewed: 2026-07-14
---

# Card Image Acquisition

## Summary

Card face images originate as scraped JPEGs pulled from the
`legendarycardgame.com` "at-a-glance" set pages by a family of
per-set PowerShell scrapers, then get re-encoded to WebP before being
renamed and uploaded to Cloudflare R2. This page documents the front of
the image pipeline — the scrape step and the JPEG→WebP conversion — and
how it feeds the naming convention that gameplay and the Registry Viewer
depend on. The deployed, R2-hosted naming is covered separately by
[R2 Image Naming Convention](r2-image-naming-convention.md); this page
covers where the raw bytes come from and how they reach WebP.

> **Where the runnable scripts live.** The canonical, runnable copies
> of the scrapers live in the sibling **staging repo**, not this repo:
> `barefootbetters-legendary-setup\card-images-staging\original-jpeg\`,
> alongside their per-set output directories. This repo keeps a
> **version-controlled backup** under
> [`scripts/card-image-downloaders/`](../scripts/card-image-downloaders/)
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
$OutputDir = "core2e"
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
    ├── original-jpeg\
    │   ├── download-legendarycardgame-<set>.ps1    (one per set)
    │   ├── core/                                    (1st-edition core JPEGs)
    │   ├── core2e/                                  (2nd-edition core JPEGs)
    │   ├── anni/  antm/  asrd/  …                   (per-set JPEG inputs)
    │   └── …
    └── original\
        ├── core2e/                                  (2nd-edition core WebP)
        ├── anni/  antm/  …                          (per-set WebP outputs)
        └── …
```

Each set's directory is keyed by a short set token that matches the
script name (`core2e`, `anni`, `bkpt`, `cvwr`, …). Note the naming: the
**JPEG inputs** live under `original-jpeg\`, the **WebP outputs** under
`original\` — the shorter name is the converted, canonical-format tree.

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
still happens downstream — WebP conversion changes the *format*, not the
*name*.

## Interactions

- **[R2 Image Naming Convention](r2-image-naming-convention.md).** The
  downstream half. Once acquired, images are renamed / re-encoded to the
  deterministic `{setAbbr}-{ribbon}-{slug}.webp` shape and uploaded to
  the `legendary-images` R2 bucket, served at
  `images.legendary-arena.com`. This page is the *upstream* half — the
  raw source bytes before that transform.
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
  writes to `core2e/` so it does not overwrite the 1st-edition `core/`.
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
  2026-07-14, matching the in-repo `core2e` backup; new converters must
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

## Code Touchpoints

- [`scripts/card-image-downloaders/download-legendarycardgame-core2e.ps1`](../scripts/card-image-downloaders/download-legendarycardgame-core2e.ps1)
  — backup copy of the Core Set 2nd Edition scraper (page URL, output
  dir, image-collection and download loop).
- [`scripts/card-image-downloaders/README.md`](../scripts/card-image-downloaders/README.md)
  — documents that this folder holds backup copies; the canonical
  runnable copies live in the staging repo.
- [`scripts/card-image-converters/Convert-Core2e-JpgToWebp.ps1`](../scripts/card-image-converters/Convert-Core2e-JpgToWebp.ps1)
  — backup copy of the Core Set 2nd Edition JPEG→WebP converter
  (ImageMagick resolve, quality / strip / skip-existing settings,
  recurse-and-convert loop).
- [`scripts/card-image-converters/README.md`](../scripts/card-image-converters/README.md)
  — converter backup-folder purpose, ImageMagick requirement, and
  encode settings.

## Data Files

- `barefootbetters-legendary-setup\card-images-staging\original-jpeg\`
  (sibling staging repo) — the scrapers and their per-set directories of
  raw source JPEGs. Not part of this repo.
- `barefootbetters-legendary-setup\card-images-staging\original\`
  (sibling staging repo) — the converters' per-set directories of
  WebP output. Not part of this repo.

## Open Questions

- **The rename + upload tail is not documented in this repo.** The
  scrape and the JPEG→WebP conversion are now backed up in-repo
  (`scripts/card-image-downloaders/`, `scripts/card-image-converters/`),
  but the final steps — renaming a converted `2eHeroSpider-Man_1Rare.webp`
  to the deterministic `core2e-hr-spider-man-…​.webp` R2 name and
  uploading it to the `legendary-images` bucket — still live in the
  staging repo and operator workflow, not a repo-citable artifact. This
  page links forward to [R2 Image Naming Convention](r2-image-naming-convention.md)
  for the target shape, but that rename/upload transform is unsourced
  here — treat it as operator knowledge until it is captured.
- **Set-token ↔ set-abbreviation mapping.** The scraper output tokens
  (`core2e`, `bkpt`, …) match the set directories but the authoritative
  set-abbreviation list is the convert pipeline's concern; confirm a new
  set's token against `scripts/convert-cards/` before assuming the R2
  `{setAbbr}` matches the scrape directory name.

## References

- [`scripts/card-image-downloaders/download-legendarycardgame-core2e.ps1`](../scripts/card-image-downloaders/download-legendarycardgame-core2e.ps1)
  — the scraper (backup copy)
- [`scripts/card-image-downloaders/README.md`](../scripts/card-image-downloaders/README.md)
  — scraper backup-folder purpose and run instructions
- [`scripts/card-image-converters/Convert-Core2e-JpgToWebp.ps1`](../scripts/card-image-converters/Convert-Core2e-JpgToWebp.ps1)
  — the JPEG→WebP converter (backup copy)
- [`scripts/card-image-converters/README.md`](../scripts/card-image-converters/README.md)
  — converter backup-folder purpose, ImageMagick requirement, settings
- [R2 Image Naming Convention](r2-image-naming-convention.md) — the
  downstream deployed naming this acquisition feeds
- [Data & File Locations](data-file-locations.md) — where card data,
  the convert pipeline, and R2 prefixes live
