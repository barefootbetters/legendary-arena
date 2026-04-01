# Prompt 01 — R2 Data Structure & Conventions

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. Read-only validation only — do not modify R2 data.
> No environment variables required — R2 bucket is publicly readable.
> ESM only. Node v22+.

## Assumes

- Cloudflare R2 bucket exists and is publicly accessible at
  `https://images.barefootbetters.com`
- CORS policy on the bucket allows `GET` and `HEAD` from any origin (`*`)
- At least one set JSON file has been uploaded to `/metadata/{abbr}.json`
- At least one set's images have been uploaded to `/{abbr}/`

---

## Role

You are documenting and validating the Cloudflare R2 data store for Legendary
Arena. The bucket is the single source of truth for all card display data.
Your job is to write a diagnostic script that verifies the bucket structure
matches the conventions below, and to document those conventions precisely
so future sets are uploaded correctly.

---

## R2 Bucket Structure

```
images.barefootbetters.com/
├── metadata/
│   ├── sets.json                    ← master set index (all 40+ sets)
│   ├── card-types.json              ← card type definitions with prefixes
│   └── {abbr}.json                  ← full set data per abbreviation
└── {abbr}/                          ← images for one set
    ├── {abbr}-hr-{hero-slug}-1.webp ← hero card slot 1
    ├── {abbr}-hr-{hero-slug}-2.webp ← hero card slot 2
    ├── {abbr}-hr-{hero-slug}-3.webp ← hero card slot 3
    ├── {abbr}-hr-{hero-slug}-4.webp ← hero card slot 4
    ├── {abbr}-mm-{mm-slug}.webp     ← mastermind base card
    ├── {abbr}-mt-{mm-slug}-{card-slug}.webp  ← mastermind tactic
    ├── {abbr}-me-{mm-slug}-{card-slug}-epic.webp ← mastermind epic tactic
    ├── {abbr}-vi-{group-slug}-{card-slug}.webp   ← villain card
    └── {abbr}-sc-{scheme-slug}.webp ← scheme card
```

---

## sets.json Structure

Located at `https://images.barefootbetters.com/metadata/sets.json`.
Contains an array of set index entries. Each entry:

```json
{
  "id": 40,
  "abbr": "2099",
  "pkgId": 39,
  "slug": "2099",
  "name": "2099",
  "releaseDate": "2024-04-03",
  "type": "34th Expansion"
}
```

**Field notes:**
- `abbr` — 4-char lowercase identifier, used in all file paths
- `pkgId` — package ID from source data, may differ from `id`
- `type` — human-readable expansion type (e.g., "1st Core Set", "34th Expansion")

The 40 set abbreviations in release order:
`core dkcy ff04 pttr vill gotg fear 3dtc ssw1 ssw2 ca75 cvwr dead noir xmen
smhc chmp wwhk msp1 antm vnom dims rvlt shld asrd nmut cosm rlmk anni msmc
dstr mgtg bkpt bkwd msis mdns wtif amwp 2099 wpnx`

---

## card-types.json Structure

Located at `https://images.barefootbetters.com/metadata/card-types.json`.
Contains an array of card type definitions with image filename prefixes:

```json
[
  { "id": 1,  "slug": "scheme",              "name": "Scheme",              "displayName": "Scheme",              "prefix": "sc" },
  { "id": 5,  "slug": "mastermind",          "name": "Mastermind",          "displayName": "Mastermind",          "prefix": "mm" },
  { "id": 8,  "slug": "mastermind-epic",     "name": "Mastermind-Epic",     "displayName": "Mastermind Epic",     "prefix": "me" },
  { "id": 10, "slug": "mastermind-tactics",  "name": "Mastermind-Tactics",  "displayName": "Mastermind Tactics",  "prefix": "mt" },
  { "id": 11, "slug": "villain",             "name": "Villain",             "displayName": "Villain",             "prefix": "vi" },
  { "id": 12, "slug": "henchman",            "name": "Henchman",            "displayName": "Henchman",            "prefix": "hm" },
  { "id": 13, "slug": "hero-common1",        "name": "Hero-Common1",        "displayName": "Hero Common 1",       "prefix": "hr" },
  { "id": 19, "slug": "sidekick",            "name": "Sidekick",            "displayName": "Sidekick",            "prefix": "sk" }
]
```

Full list has 36 card types. All hero variants share the `hr` prefix.

---

## Per-Set JSON Structure ({abbr}.json)

Located at `https://images.barefootbetters.com/metadata/{abbr}.json`.
Top-level shape:

```json
{
  "id": 40,
  "abbr": "2099",
  "exportName": "Marvel2099",
  "heroes":      [...],
  "masterminds": [...],
  "villains":    [...],
  "henchmen":    [...],
  "schemes":     [...],
  "bystanders":  [...],
  "wounds":      [...],
  "other":       [...]
}
```

### Hero shape
```json
{
  "id": 281,
  "name": "Spider-Man 2099",
  "slug": "spider-man-2099",
  "team": "spider-friends",
  "cards": [
    {
      "name": "Retractable Talons",
      "displayName": "Retractable Talons",
      "slug": "retractable-talons",
      "rarity": 1,
      "rarityLabel": "Common 1",
      "slot": 1,
      "hc": "covert",
      "cost": 2,
      "attack": "1",
      "recruit": null,
      "imageUrl": "https://images.barefootbetters.com/2099/2099-hr-spider-man-2099-1.webp",
      "abilities": ["You may send this [keyword:Undercover]."]
    }
  ]
}
```

**Real-world field variations across 40+ sets (schema must accept all):**
- `hero.id` — can be `null` in some sets (e.g., `3dtc`)
- `hero.cards[].displayName` — missing in older sets
- `hero.cards[].slot` — can exceed 4 in some sets (dual-class heroes have 5–9 cards)
- `hero.cards[].cost` — can be a string `"X"`, null, or number
- `hero.cards[].hc` — can be null in some sets
- `mastermind.cards[].vAttack` — can be string `"9"`, number `9`, or null
- `villain.cards[].vp` — can be string `"2"`, number `2`, or null
- `scheme.id` — can be null in some sets

### Mastermind shape
```json
{
  "id": 100,
  "name": "Sinister Six 2099",
  "slug": "sinister-six-2099",
  "alwaysLeads": [],
  "vp": 6,
  "cards": [
    {
      "name": "Electro 2099",
      "slug": "electro-2099",
      "tactic": true,
      "vAttack": "9",
      "imageUrl": "https://images.barefootbetters.com/2099/2099-mt-sinister-six-2099-electro-2099.webp",
      "abilities": ["Always Leads: Any "Alchemax" or "Sinister" Villain Group"]
    }
  ]
}
```

**Epic tactic image naming:** Epic tactic images append `-epic` before `.webp`.
Example: `2099-me-sinister-six-2099-electro-2099-epic.webp`
The `imageUrl` in the JSON must include `-epic` — this is NOT auto-derived.

### Villain group shape
```json
{
  "id": 123,
  "name": "False Aesir of Alchemax",
  "slug": "false-aesir-of-alchemax",
  "ledBy": [],
  "cards": [
    {
      "name": "Heimdall 2099",
      "slug": "heimdall-2099",
      "vp": "2",
      "vAttack": "3+",
      "imageUrl": "https://images.barefootbetters.com/2099/2099-vi-false-aesir-of-alchemax-heimdall-2099.webp",
      "abilities": ["[keyword:Uru-Enchanted Weapons]"]
    }
  ]
}
```

### Scheme shape
```json
{
  "id": 182,
  "name": "Pull Reality Into Cyberspace",
  "slug": "pull-reality-into-cyberspace",
  "imageUrl": "https://images.barefootbetters.com/2099/2099-sc-pull-reality-into-cyberspace.webp",
  "cards": [
    { "abilities": ["Setup: 7 Twists, representing "Cyberspace.""] }
  ]
}
```

---

## Image Naming Convention

All images are WebP format. Filename pattern:
```
{setAbbr}-{typePrefix}-{subject-slug}[-{card-slug}][-epic].webp
```

| Card type | Pattern | Example |
|---|---|---|
| Hero card | `{abbr}-hr-{hero-slug}-{slot}` | `2099-hr-spider-man-2099-1.webp` |
| Mastermind tactic | `{abbr}-mt-{mm-slug}-{card-slug}` | `2099-mt-sinister-six-2099-electro-2099.webp` |
| Mastermind epic tactic | `{abbr}-me-{mm-slug}-{card-slug}-epic` | `2099-me-sinister-six-2099-electro-2099-epic.webp` |
| Villain card | `{abbr}-vi-{group-slug}-{card-slug}` | `2099-vi-false-aesir-of-alchemax-heimdall-2099.webp` |
| Scheme | `{abbr}-sc-{scheme-slug}` | `2099-sc-pull-reality-into-cyberspace.webp` |

**Critical:** Epic tactic image URLs in JSON must include `-epic` suffix.
The JSON is the source of truth for `imageUrl` — the viewer uses `imageUrl`
directly from the card object, it does not construct image URLs from slug patterns.

---

## Deliverables

### 1. R2 spot-check script (`scripts/check-r2.mjs`)

A read-only Node.js ESM diagnostic script that:

1. Fetches `metadata/sets.json` — verifies it is valid JSON with an array of
   objects each containing `abbr` and `name`
2. Fetches `metadata/card-types.json` — verifies it contains all 36 card types
3. For each set in `eagerLoad` list (passed as CLI args or hardcoded):
   - Fetches `metadata/{abbr}.json`
   - Counts heroes, masterminds, villain groups, schemes
   - Reports any fields that are null where non-null is expected
   - HEAD-checks one hero image, one villain image, one mastermind tactic image
4. Prints a summary report and exits 0 (no errors) or 1 (any errors)

### 2. Image upload checklist (`docs/image-upload-checklist.md`)

A markdown checklist a developer follows when uploading a new set to R2:

- [ ] JSON file uploaded to `metadata/{abbr}.json`
- [ ] `sets.json` updated to include the new set entry
- [ ] All hero images named `{abbr}-hr-{hero-slug}-{slot}.webp` (slots 1–N)
- [ ] All mastermind tactic images named `{abbr}-mt-{mm-slug}-{card-slug}.webp`
- [ ] All epic tactic images named `{abbr}-me-{mm-slug}-{card-slug}-epic.webp`
- [ ] All villain images named `{abbr}-vi-{group-slug}-{card-slug}.webp`
- [ ] All scheme images named `{abbr}-sc-{scheme-slug}.webp`
- [ ] `imageUrl` field in JSON matches actual uploaded filename (including `-epic`)
- [ ] Ran `pnpm check:r2` and confirmed 0 errors
- [ ] Added `abbr` to `registry-config.json` `eagerLoad` array in viewer

### 3. `package.json` script

```json
{ "check:r2": "node scripts/check-r2.mjs" }
```

---

## Hard Constraints

- Read-only — never write to R2
- Node.js built-in `fetch` only (no axios, node-fetch)
- HEAD requests for image checks — do not download image data
- No environment variables required — R2 is public
- Script must run without any `.env` file

---

## Acceptance Checklist

- [ ] `pnpm check:r2` runs without crashing on a clean machine
- [ ] Script fetches and validates `metadata/sets.json` and reports set count
- [ ] Script fetches and validates `metadata/card-types.json` and reports type count
- [ ] Script HEAD-checks at least one image per set and reports 404s
- [ ] Script exits 0 when all checks pass
- [ ] Script exits 1 when any check fails
- [ ] `docs/image-upload-checklist.md` exists and covers all file types
