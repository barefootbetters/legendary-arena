# Data Pipeline

This document covers how card data gets from source JSON files into the live
Registry Viewer at `https://cards.barefootbetters.com`, and why `@master-strike/data`
is no longer the source of truth.

---

## Why @master-strike/data was retired

`@master-strike/data` is an npm package that was the original source of Marvel
Legendary card metadata. It was used to generate per-set JSON files via the
`convert-cards.mjs` pipeline.

**It is no longer the source of truth for one concrete reason:** its embedded
CDN image URLs (hosted on DigitalOcean Spaces) return HTTP 403. The images are
not publicly accessible. Any attempt to load card data at runtime through the
package's URLs fails silently.

The fix was to copy the card metadata into this repository under `data/metadata/`,
host the images on our own Cloudflare R2 bucket, and serve all data from
`https://images.barefootbetters.com`. The `@master-strike/data` npm package
is still installed as a dev dependency for reference during data migration, but
it is not used in any production code path.

---

## Data ownership model

```
data/metadata/{abbr}.json     ← source of truth (version-controlled)
             card-types.json  ← set index (version-controlled)
             hero-classes.json
             hero-teams.json
             leads.json
             sets.json
```

These files are the canonical record of all card data. If something is wrong
in the viewer, fix it here first, then re-run the pipeline.

The `@master-strike/data` package and the old `convert-cards.mjs` /
`patch-relationships.mjs` scripts produced earlier versions of these files.
Those scripts are no longer needed — `data/metadata/` is now maintained directly.

---

## R2 data format

The live site reads from R2 at two URL patterns:

```
https://images.barefootbetters.com/metadata/card-types.json   ← set index
https://images.barefootbetters.com/metadata/{abbr}.json        ← full set data
https://images.barefootbetters.com/{abbr}/{imageFile}.webp     ← card images
```

Each `{abbr}.json` file follows this top-level shape (enforced by Zod in
`packages/registry/src/schema.ts`):

```typescript
{
  id:          number
  abbr:        string        // e.g. "mdns", "wtif"
  exportName:  string
  heroes:      Hero[]
  masterminds: Mastermind[]
  villains:    VillainGroup[]
  henchmen:    unknown[]
  schemes:     Scheme[]
  bystanders:  unknown[]
  wounds:      unknown[]
  other:       unknown[]
}
```

`card-types.json` is an array of `SetIndexEntry` objects:

```typescript
{
  id:          number
  abbr:        string
  pkgId:       number
  slug:        string
  name:        string
  releaseDate: string   // "YYYY-MM-DD"
  type:        string
}
```

These schemas are the authoritative contract. See
`packages/registry/src/schema.ts` for full Zod definitions.

---

## How the registry package reads the data

`packages/registry` (`@legendary-arena/registry`) provides two factory
functions:

### Production — `createRegistryFromHttp(options)`

Used by `apps/registry-viewer` at runtime. Fetches from R2 over HTTPS.

```typescript
import { createRegistryFromHttp } from '@legendary-arena/registry';

const registry = await createRegistryFromHttp({
  metadataBaseUrl: 'https://images.barefootbetters.com',
  eagerLoad: ['*'],   // load all sets, or pass specific abbrs
});

registry.listSets();           // SetIndexEntry[]
registry.getSet('mdns');       // SetData | undefined
registry.listCards();          // FlatCard[] — one entry per card
registry.query({ cardType: 'hero', heroClass: 'strength' });
registry.validate();           // HealthReport
```

`eagerLoad: ['*']` fetches every set listed in `card-types.json` concurrently
on startup. Pass a subset of abbreviations for faster startup during development.

### Local validation — `createRegistryFromLocalFiles(options)`

Used by CI and the `pnpm validate` script. Reads from `data/metadata/`, which
mirrors the R2 `metadata/` folder structure exactly.

```typescript
import { createRegistryFromLocalFiles } from '@legendary-arena/registry';

const registry = await createRegistryFromLocalFiles({
  metadataDir: 'data/metadata',
});

const health = registry.validate();
// health.summary.parseErrors === 0 means all files are schema-valid
```

The `metadataDir` must contain `card-types.json` and one `{abbr}.json` per set,
matching the R2 format exactly.

---

## Pipeline: adding or updating a set

This is the workflow for adding a new expansion or correcting data in an
existing set.

### 1. Add or edit the JSON file

Place or update the file at:
```
data/metadata/{abbr}.json
```

The file must conform to `SetDataSchema` (see `packages/registry/src/schema.ts`).
Copy the shape from an existing file like `data/metadata/mdns.json`.

If this is a new set, also add an entry to `data/metadata/card-types.json`.

### 2. Validate locally

```powershell
cd packages/registry
pnpm validate
```

The script runs `createRegistryFromLocalFiles` against `data/metadata/`, parses
every file with Zod, and exits 1 if any schema errors are found. Fix all errors
before proceeding.

Expected output on success:
```
✅  Validation passed!
   Sets indexed:  2
   Sets loaded:   2
   Total heroes:  ...
   Total cards:   ...
   Parse errors:  0
```

### 3. Upload to R2

```powershell
cd packages/registry
DATA_VERSION=1.0.0 pnpm upload
```

The upload script (`scripts/upload-r2.ts`) reads environment variables from
`.env` (copy from `.env.example`) and pushes files to R2.

Required environment variables:
```ini
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=legendary-arena-assets
R2_PUBLIC_URL=https://images.barefootbetters.com
DATA_VERSION=1.0.0
```

> These credentials are in the Cloudflare R2 dashboard under
> **R2 → Manage R2 API tokens**. Never commit real values.

### 4. Verify in the viewer

Open `https://cards.barefootbetters.com` and confirm the new or updated set
appears. The viewer fetches data from R2 at runtime — no code deploy needed.

If the set does not appear, run the R2 validation diagnostic:
```powershell
node scripts/validate-r2.mjs
```

---

## Image naming convention

All card images on R2 follow this pattern:

```
https://images.barefootbetters.com/{abbr}/{abbr}-{typePrefix}-{slug}.webp
```

The filename always starts with the set abbreviation, followed by a two-letter
type prefix, followed by the card slug — all hyphen-separated.

### Type prefixes

| Prefix | Card type | Example filename |
|---|---|---|
| `hr` | Hero card | `mdns-hr-blade-daywalker-3c1.webp` |
| `mm` | Mastermind base card | `mdns-mm-lilith-mother-of-demons.webp` |
| `me` | Mastermind epic card | `mdns-me-lilith-mother-of-demons.webp` |
| `mt` | Mastermind tactic card | `mdns-mt-lilith-mother-of-demons-connoisseur-of-souls.webp` |
| `vi` | Villain card | `mdns-vi-lilin-meatmarket.webp` |
| `hm` | Henchmen | `wtif-hm-giants-of-jotunheim.webp` |
| `sc` | Scheme card | `mdns-sc-sire-vampires-at-the-blood-bank.webp` |
| `sx` | Scheme extra (epic scheme) | `mdns-sx-great-old-one-chthon.webp` |

### Hero card filename suffix

Hero cards append a cost+rarity+slot suffix after the hero slug:

```
{abbr}-hr-{hero-slug}-{cost}{rarityCode}{slot?}.webp
```

| Rarity code | Meaning |
|---|---|
| `c` | Common (rarity 1) |
| `u` | Uncommon (rarity 2) |
| `r` | Rare (rarity 3) |

A slot number is appended only when a hero has multiple cards of the same rarity.
If there is only one card of that rarity, the slot number is omitted.

**Examples from `wtif` (Captain Carter):**

| Filename | Cost | Rarity | Slot |
|---|---|---|---|
| `wtif-hr-captain-carter-2c1.webp` | 2 | common | slot 1 of 2 commons |
| `wtif-hr-captain-carter-3c2.webp` | 3 | common | slot 2 of 2 commons |
| `wtif-hr-captain-carter-5u.webp` | 5 | uncommon | only uncommon (no slot #) |
| `wtif-hr-captain-carter-6u2.webp` | 6 | uncommon | slot 2 of 2 uncommons |
| `wtif-hr-captain-carter-8r.webp` | 8 | rare | only rare (no slot #) |

Each card object in `{abbr}.json` carries an `imageUrl` field with the full
absolute R2 URL. The registry package exposes this via `FlatCard.imageUrl`.
The `imageUrl` in the JSON is the source of truth — do not reconstruct URLs
from slugs programmatically.

---

## Relationship to the game server

The game server (all prompts under
`barefootbetters-legendary-setup/docs/prompts/`) consumes card data in two ways:

| What | Where it comes from | How |
|---|---|---|
| Card display data (names, images, costs) | R2 JSON via `createRegistryFromHttp` | Fetched by the SPA at runtime |
| Game rules (strike counts, twist counts, villain group relationships) | PostgreSQL | Seeded by `scripts/seed-from-r2.mjs` (Prompt 03) |

PostgreSQL is **never** used for card display data. R2 is **never** used for
live turn state. These two stores serve completely different purposes and must
stay separate.

The seeder in `scripts/seed-from-r2.mjs` reads `{abbr}.json` files from R2
and extracts only the game-mechanical fields — mastermind `alwaysLeads`,
scheme `twistCount`, etc. — for storage in PostgreSQL. Re-run the seeder any
time a `data/metadata/` file changes and has been uploaded to R2.

---

## Known issues and open work

### Incomplete set migration

`data/metadata/` currently contains `mdns.json` and `wtif.json`. All remaining
expansion sets need to be added and validated before `@master-strike/data` can
be removed from `devDependencies`.

Migration status per set is tracked by file presence in `data/metadata/`: if a
file exists and passes `pnpm validate`, it is migrated.

### normalize-cards.ts / build-dist.mjs

These scripts (`packages/registry/scripts/`) implement an older flat-card
pipeline that predates the current per-set R2 format. They reference `CardSchema`
and `CardIDSchema` exports that no longer exist in `src/schema.ts`. They are
not part of the current production pipeline and should not be run. They are
retained for reference during the data migration and will be removed once all
sets are migrated to `data/metadata/`.
