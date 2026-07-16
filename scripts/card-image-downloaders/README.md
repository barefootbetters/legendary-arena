# Card Image Downloaders (backup copies)

PowerShell scrapers that pull card face images from
`legendarycardgame.com` "at-a-glance" set pages.

These are **backup copies for version control only**. The canonical,
runnable copies live alongside the image output directories in the
staging repo:

    C:\pcloud\BB\DEV\barefootbetters-legendary-setup\card-images-staging\original-jpeg\

Each script scrapes every `<img>` and inline/background image URL from
its `$PageUrl`, dedupes, and downloads any `.jpg/.jpeg/.png/.webp` into
`$OutputDir` (relative to the working directory), skipping files that
already exist.

## Running

Run from the staging `original-jpeg` folder so the relative `$OutputDir`
resolves next to the other sets:

```powershell
cd "C:\pcloud\BB\DEV\barefootbetters-legendary-setup\card-images-staging\original-jpeg"
.\download-legendarycardgame-co2e.ps1
```

## Files

- `download-legendarycardgame-co2e.ps1` — Core Set (2nd Edition),
  from `/core-set-at-a-glace-2ndedition`, output dir `co2e/`.

## Note

The scraper is URL-driven and will grab any non-card image present on
the page (e.g. banner/photo images). Review the output directory and
remove non-card files before feeding the set into the image pipeline.
