# Historical Context: modern-master-strike

The current registry-viewer evolved from **modern-master-strike**
(`C:\Users\jjensen\bbcode\modern-master-strike`), a standalone card browser
for the Legendary deck-building game. This document captures the predecessor's
architecture so future sessions understand what was carried forward, what was
dropped, and why things are shaped the way they are.

---

## What It Was

A Vue 3 + Tailwind CSS single-page app for browsing Legendary card data.
Deployed to Cloudflare Workers/Pages. No game logic — purely a data viewer
with rich filtering and search.

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Styling | Tailwind CSS 4.x |
| Search | Flexsearch (client-side full-text) |
| Build | Vite 8 beta + `@cloudflare/vite-plugin` |
| Deploy | Cloudflare Workers via Wrangler |
| Images | Sharp (dev-time processing to WebP) |
| TypeScript | 5.9, strict mode |

## Key Differences from Current Registry-Viewer

| Aspect | modern-master-strike | registry-viewer |
|---|---|---|
| Styling | Tailwind CSS | Scoped CSS (no Tailwind) |
| Search | Flexsearch library | Simple string matching via `applyQuery()` |
| Card data source | Bundled JSON from npm package + patches | HTTP fetch from R2 at runtime |
| Data pipeline | `convert-cards-v15.mjs` → local JSON | Registry package with Zod schemas |
| Schema validation | None (trusted bundled data) | Zod runtime validation |
| Themes | Not present | Full theme browsing + cross-linking |
| Health diagnostics | Not present | HealthPanel with parse error reporting |
| Ability rendering | CardDescription component | Token parser in `useRules.ts` composable |
| Deployment | Cloudflare Workers (wrangler) | Cloudflare Pages (static dist/) |
| Build tool | Vite 8 beta | Vite 5 stable |
| Gallery layout | CSS masonry columns, IntersectionObserver lazy-load | CSS Grid, flat list |
| Filters | 8 categories (type, group, set, team, class, keyword, rule, sort) | 4 categories (type, set, class, search) |

## Architecture

```
src/
├── App.vue                      # Root — state + layout (180 lines)
├── components/
│   ├── AppSidebar.vue           # 8-category filter panel (largest component)
│   ├── CardGallery.vue          # Lazy-loaded masonry grid
│   ├── CardItem.vue             # Individual card tile
│   ├── CardModal.vue            # Fullscreen detail modal
│   └── CardDescription.vue      # Ability text renderer
├── services/
│   └── cardData.ts              # Filter/sort/search wrapper
├── types/
│   └── card.ts                  # TypeScript card types
├── lib/master-strike-data/      # Compiled npm card data library
├── data/
│   ├── cards/                   # 40 set JSON files (~45K lines total)
│   ├── patches/                 # Per-set field corrections
│   ├── keywords.json            # 100+ keyword definitions
│   ├── rules.json               # Extra rules (Divided, Adapting, etc.)
│   ├── hero-classes-meta.json   # 5 hero classes with colors
│   ├── card-types.json          # 37 card type definitions
│   └── icons-meta.json          # Icon metadata
└── assets/
```

## Data Pipeline

The data originated from an npm package (`master-strike-data`) and was
converted through a multi-step pipeline:

1. **`convert-keywords.mjs`** — Extract keyword/rules metadata from npm package
   → `keywords.json`, `rules.json`, `hero-classes-meta.json`, `icons-meta.json`

2. **`convert-cards-v15.mjs`** (752 lines) — Convert npm card definitions to
   editable JSON:
   - Regenerate image URLs using pattern: `{set}-{prefix}-{slug}.webp`
   - Parse abilities from both array and object formats
   - Apply field-by-field patch files (`patches/*.patch.json`)
   - Support slug renaming via `_slug` field (v15 feature)
   - Output to `data/cards/`

3. **Patch system** — Per-set `.patch.json` files for post-conversion corrections
   (slot fixes, slug renames, field overrides)

4. **Image tools** — `convert-to-webp.mjs`, `crawl-img.mjs`, `download-images.mjs`

5. **WordPress export** — `gen-wp-tables.mjs` generated HTML tables for the
   BarefootBetters.com WordPress site

## What Was Carried Forward

- **Card data JSON files** — The 40 set JSONs in `src/data/cards/` became the
  source data now hosted on R2 at `images.barefootbetters.com/metadata/`
- **Ability token syntax** — The `[keyword:X]`, `[icon:Y]`, `[hc:Z]` notation
  in ability text carried over directly
- **Hero class system** — 5 classes (Covert, Instinct, Ranged, Strength, Tech)
  with color coding
- **Image URL pattern** — `https://images.barefootbetters.com/{set}/{slug}.webp`
- **Card type taxonomy** — Hero, Mastermind, Villain, Henchman, Scheme,
  Bystander, Wound, plus subtypes
- **SVG icons** — 82 set/team/class icons in `public/img/`

## What Was Dropped or Replaced

- **Tailwind CSS** — replaced with scoped CSS for simplicity and fewer deps
- **Flexsearch** — replaced with simple string filtering (sufficient for ~3K cards)
- **Bundled data** — replaced with runtime HTTP fetch from R2
- **npm data package dependency** — replaced with standalone registry package
  using Zod schemas
- **Masonry layout** — replaced with CSS Grid
- **IntersectionObserver lazy-load** — dropped (not needed with simpler grid)
- **AppSidebar filter complexity** — 8 filter categories reduced to 4
- **Cloudflare Workers runtime** — replaced with static Cloudflare Pages
- **CardModal fullscreen** — replaced with side panel (CardDetail)
- **WordPress table generation** — no longer needed
- **Patch system** — corrections baked into canonical JSON on R2

## What Was Added in Registry-Viewer

- **Zod schema validation** — runtime type checking for inconsistent set data
- **Health diagnostics** — HealthPanel showing parse errors and set stats
- **Theme browsing** — full ThemeGrid/ThemeDetail with setup intent cross-linking
- **Registry abstraction** — CardRegistry interface with HTTP and local (Node)
  implementations
- **Browser-safe entry point** — `browser.ts` prevents Node imports in client

## Card Data Format (for reference)

The original set JSON structure:
```json
{
  "id": 1,
  "abbr": "core",
  "exportName": "CoreSet",
  "heroes": [{
    "id": 1, "name": "Black Widow", "slug": "black-widow",
    "team": "avengers",
    "cards": [{
      "name": "Dangerous Rescue",
      "slug": "dangerous-rescue",
      "rarity": 1, "slot": "hero",
      "hc": "covert", "cost": 2,
      "attack": 0, "recruit": 0,
      "imageUrl": "https://images.barefootbetters.com/core/core-bkwd-dangerous-rescue.webp",
      "abilities": ["[hc:covert] [keyword:fight]: ..."]
    }]
  }]
}
```

This format is largely preserved in the current R2-hosted data, with minor
schema evolution handled by Zod's permissive parsing.

## Notes

- No git history exists for modern-master-strike (no `.git` directory)
- The project is a working snapshot, not actively maintained
- Card data at `C:\Users\jjensen\bbcode\modern-master-strike\src\data\cards\`
  is the same dataset referenced in `.claude/CLAUDE.md` as the external card
  data source
