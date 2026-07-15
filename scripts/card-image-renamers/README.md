# Card Image Renamers (backup copies)

PowerShell scripts that rename the converted WebP card faces from their
source-side names (e.g. `2eHeroSpider-Man_1Rare.webp`) to the
deterministic R2 convention `{setAbbr}-{ribbon}-{slug}.webp` (e.g.
`core2e-hr-...webp`) — the last staging step before R2 upload.

These are **backup copies for version control only**. The canonical,
runnable copies live in the staging repo alongside the image
directories:

    C:\pcloud\BB\DEV\barefootbetters-legendary-setup\card-images-staging\

Each script reads `original\<set>\` (converted WebP) and copies each
file into `renamed\<set>\` under its R2-convention name, restamping the
copy's `LastWriteTime` so a fresh run is visible in Explorer. The
destination is cleared at the start of each run.

## The rename map is hand-authored

Unlike the scrape and convert steps (which are fully mechanical), the
rename map is **per-set and hand-authored**: it pairs each source
filename with its target `{setAbbr}-{ribbon}-{slug}.webp` name. Ribbon
codes come from the upstream `card-types.json` prefix registry
(`hr`, `mm`, `me`, `mt`, `vi`, `hm`, `sc`, `st`, `ms`, `by`, `wd`,
`sa`, `so`, `tr`, `sk`, …). See the wiki page
[Card Image Acquisition](../../wiki/card-image-acquisition.md) and
[R2 Image Naming Convention](../../wiki/r2-image-naming-convention.md).

## Files

- `rename-core2e-images.ps1` — Core Set (2nd Edition):
  `original\core2e\` → `renamed\core2e\`. **151** cards mapped (the one
  stray non-card page image is deliberately omitted).

## Known verification items (core2e)

Because no core2e card data exists yet, some target slugs are provisional
and the script prints a "BEFORE UPLOADING TO R2" checklist:

- **Hero slugs are placeholders.** All 60 hero targets use rarity
  placeholders (`rare` / `common-1` / `common-2` / `uncommon`) because
  the 2e source filenames carry only rarity, not the card title the R2
  hero convention uses. Replace with real card-title slugs before upload.
- **Group slugs follow the 2e source names** — e.g. `skulls` (was
  `skrulls` in 1st-ed core) and `sinister-spider-foes` (was
  `spider-foes`). Confirm against card data.
- **Five named S.H.I.E.L.D. Officer variants** are filed under `so`;
  confirm `so` vs a special (`sp`) prefix.
