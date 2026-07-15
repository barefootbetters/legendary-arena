# Card Image Converters (backup copies)

PowerShell scripts that convert staged card face JPEGs to WebP using
ImageMagick (`magick.exe`), the step between raw acquisition and R2
upload.

These are **backup copies for version control only**. The canonical,
runnable copies live in the staging repo alongside the image
directories:

    C:\pcloud\BB\DEV\barefootbetters-legendary-setup\card-images-staging\

Each script reads `original-jpeg\<set>\` and writes `.webp` files to
`original\<set>\`, preserving subfolder structure and skipping files
that already exist.

## Requirements

- **ImageMagick 7** (`magick.exe`) on `PATH`, or installed at the
  fallback `C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe`.

## Settings (per script)

- `$Quality = 80` — WebP quality (0-100).
- `$StripMeta = $true` — strips metadata (`-strip`) for smaller output.
- `$SkipExisting = $true` — never overwrites an existing `.webp`.
- `$Recurse = $true` — processes subfolders.

## Running

From the staging-root folder (or anywhere — the script resolves its
own location):

```powershell
cd "C:\pcloud\BB\DEV\barefootbetters-legendary-setup\card-images-staging"
.\Convert-Core2e-JpgToWebp.ps1
```

## Files

- `Convert-Core2e-JpgToWebp.ps1` — Core Set (2nd Edition):
  `original-jpeg\core2e\` → `original\core2e\`.

## Note on portability

The older `Convert-<set>-JpgToWebp.ps1` scripts in the staging repo
hardcode a per-machine `$StagingRoot` (e.g. `C:\GISE\...`) and break
when run on a different machine. This backup copy resolves the staging
root from the script's own location (`$PSScriptRoot`) instead, so it
runs wherever it sits in the staging tree.
