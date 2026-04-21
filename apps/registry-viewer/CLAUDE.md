# Registry Viewer

Browse and inspect Legendary Arena card data and game setup themes.
Live at: https://cards.barefootbetters.com/

## Tech Stack

- Vue 3 (Composition API, SFCs), TypeScript, Vite 5, Zod
- No router — single-page with tab switching (Cards / Themes)
- Dark theme, scoped CSS throughout
- Data source: Cloudflare R2 at `https://images.barefootbetters.com/`
- ES2022 build target

## Architecture & Data Flow

```
registry-config.json (public/)
  ├─ metadataBaseUrl  → R2 base URL
  └─ eagerLoad        → which card sets to fetch on startup

App Mount
  ├─ getRegistry()           → singleton, cached in module scope
  │   ├─ GET /metadata/sets.json    → set index
  │   └─ GET /metadata/{abbr}.json  → per-set card data (parallel)
  │       └─ flattenSet() → FlatCard[] for grid display
  │
  ├─ getThemes()             → singleton, non-blocking (Promise.allSettled)
  │   ├─ GET /themes/index.json     → filename list
  │   └─ GET /themes/{file}.json    → ThemeDefinition[] (parallel)
  │
  ├─ getKeywordGlossary()    → singleton, non-blocking
  │   └─ GET /metadata/keywords-full.json → Map<key, description>
  │
  ├─ getRuleGlossary()       → singleton, non-blocking
  │   └─ GET /metadata/rules-full.json    → Map<key, { label, summary }>
  │
  └─ User interaction
      ├─ Filter/search → applyQuery()
      ├─ Select card   → CardDetail panel
      ├─ Select theme  → ThemeDetail panel
      └─ Theme card link → cross-navigates to Cards view with filter
```

## Key Files

| File | Purpose |
|---|---|
| `src/App.vue` | Root component — all state, filters, both views |
| `src/components/CardGrid.vue` | Responsive tile grid with lazy images, type badges, rarity dots |
| `src/components/CardDetail.vue` | Card detail panel — stats, tokenized abilities, raw JSON |
| `src/components/ThemeGrid.vue` | Theme tile grid with tag-colored accents |
| `src/components/ThemeDetail.vue` | Theme detail — setup intent with cross-links to cards |
| `src/components/HealthPanel.vue` | Diagnostics modal — set counts, parse errors |
| `src/composables/useRules.ts` | Glossary lookups + ability text tokenizer; fetched keyword/rule Maps are installed at mount via `setGlossaries()` |
| `src/composables/useGlossary.ts` | Rules Glossary panel state; `rebuildGlossaryEntries()` is called once after the async glossary fetch resolves |
| `src/lib/registryClient.ts` | Singleton factory for HTTP-based CardRegistry |
| `src/lib/themeClient.ts` | Singleton factory for ThemeDefinition[] from R2 |
| `src/lib/glossaryClient.ts` | Singleton factory for KeywordGlossary + RuleGlossary Maps from R2 (non-blocking, devLog-instrumented) |
| `src/registry/schema.ts` | Zod schemas — permissive to handle inconsistent set data |
| `src/registry/shared.ts` | `flattenSet()`, `applyQuery()`, `buildHealthReport()` |
| `src/registry/impl/httpRegistry.ts` | Browser-safe CardRegistry factory (R2 fetches) |
| `src/registry/impl/localRegistry.ts` | Node-only CardRegistry factory (CI validation) |
| `src/registry/browser.ts` | Browser entry point — re-exports HTTP factory only, no Node imports |
| `src/registry/types/` | Zod-inferred types: FlatCard, SetData, CardRegistry, HealthReport |
| `public/registry-config.json` | Runtime config: R2 base URL + eager-load set list |

## Theme Data Pipeline

The Themes tab displays data that originates outside the registry-viewer:

```
content/themes/*.json          ← 68 hand-authored theme files (the source of truth)
content/themes/THEME-INDEX.md  ← planning/tracking index (not consumed by code)
content/themes/CATALOG.md      ← generated slug reference for theme authors
  ↑
scripts/generate-theme-catalog.mjs  ← reads data/cards/ + data/metadata/sets.json
                                       outputs CATALOG.md with all valid slugs

Theme JSONs are uploaded to R2 at:
  https://images.barefootbetters.com/themes/index.json   (filename list)
  https://images.barefootbetters.com/themes/{file}.json  (individual themes)
```

Each theme JSON contains: `themeId`, `name`, `description`, `setupIntent`
(mastermindId, schemeId, villainGroupIds, heroDeckIds, henchmanGroupIds),
`playerCount`, `tags`, `references` (comic issue/year/URLs), `flavorText`.

The `setupIntent` fields use bare slugs matching the `MatchSetupConfig` contract
(WP-005A). The catalog script validates these slugs against card data.

To regenerate the catalog after adding card sets:
```bash
node scripts/generate-theme-catalog.mjs
```

## Keyword & Rule Glossary

Card ability tooltips (keywords like Berserk, Patrol, Focus; rules like Shards,
Divided Cards) are **fetched from R2** at startup via `src/lib/glossaryClient.ts`:

- `/metadata/keywords-full.json` — 123 keyword entries (`{ key, label, description, pdfPage? }[]`)
- `/metadata/rules-full.json`    — 20 rule entries (`{ key, label, summary, pdfPage? }[]`)

Both payloads are validated at fetch time against
`KeywordGlossarySchema` and `RuleGlossarySchema` imported from
`@legendary-arena/registry` (authoritative schema lives at
`packages/registry/src/schema.ts`). The call uses `.safeParse(...)` rather
than `.parse(...)` so the fetch boundary is non-blocking: a malformed R2
publish logs a full-sentence `[Glossary] Rejected ...` warning and
degrades to an empty Map. Schema failures never throw. Network failures
still throw so `App.vue` can catch + continue.

`App.vue`'s `onMounted` handler calls `getKeywordGlossary()`,
`getKeywordPdfPages()`, and `getRuleGlossary()` in parallel (the three share
a single underlying fetch per resource; `getKeywordPdfPages` derives from
the same keyword bundle as `getKeywordGlossary`). It installs the resulting
Maps into `useRules.ts` via `setGlossaries()` and triggers
`rebuildGlossaryEntries()` on `useGlossary.ts` so the Rules Glossary panel
populates. The fetch is **non-blocking**: if R2 is unreachable, `App.vue`
logs `"[Glossary] Load failed (non-blocking)"` and continues — tooltips
are absent but the card view remains functional. `lookupKeyword` /
`lookupRule` return `null` until the fetch resolves; callers
(`CardDetail.vue`, `useGlossary.ts`) already handle null via
tooltip-absent paths.

Entries with a confirmable rulebook page expose a "📖 Rulebook p. N"
anchor in the panel, linking to the Marvel Legendary Universal Rulebook
PDF on R2 at
`https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf`
(configured as `rulebookPdfUrl` in `public/registry-config.json`). The
anchor uses `target="_blank"` and `rel="noopener"` mandatory. When the
`rulebookPdfUrl` config field is missing, the anchor is silently omitted
from every entry (no warning, no fallback UI — this is a supported
absent-config path).

**Do not infer labels from keys under any circumstance.** The WP-060
audit confirmed that heuristic label generation (the deleted `titleCase()`
helper) breaks canonical rulebook capitalization in cases like
"chooseavillaingroup" → "Choose a Villain Group" and "shieldclearance" →
"S.H.I.E.L.D. Clearance". Every display label must trace to an explicit
source: `entry.label` from the JSON for keywords and rules, or the
`HERO_CLASS_LABELS` Map in `useRules.ts` for the 5 hero classes.

Hero class tooltips (Covert, Instinct, Ranged, Strength, Tech) are hardcoded
in `useRules.ts` (`HERO_CLASS_GLOSSARY`, 5 entries) and are **not** in the
external glossary data. These stay hardcoded. Their display labels live in
the parallel `HERO_CLASS_LABELS` Map (also hardcoded, 5 entries).

## Design Patterns

- **Zod-inferred types** — all types derived from schemas, giving runtime validation + static types
- **Singleton caching** — registry and themes promises cached in module scope to prevent duplicate fetches
- **Non-blocking themes** — `Promise.allSettled()` so card view works even if theme fetch fails
- **Browser-safe registry** — `browser.ts` prevents accidental Node imports in the client bundle
- **Ability tokenization** — `[keyword:X]`, `[icon:Y]`, `[rule:Z]`, `[hc:W]`, `[team:T]` syntax parsed into typed tokens for rich rendering with tooltips
- **Permissive schemas** — Zod schemas use optional/nullable fields to handle inconsistencies across 40+ card sets
- **Lazy flattening** — `listCards()` rebuilds flat list on-demand (fine for ~3000 cards)

## Layer Boundary

This app follows the project's layer rules (see `.claude/rules/architecture.md`):

| May import | Must NOT import |
|---|---|
| `registry` package, Vue, Zod, UI framework | `game-engine`, `preplan`, `server`, `pg` |

## Commands

```bash
pnpm --filter registry-viewer dev       # Vite dev server
pnpm --filter registry-viewer build     # production build → dist/
pnpm --filter registry-viewer preview   # preview production build
```

## Deployment

Built output in `dist/` is deployed to Cloudflare Pages at `cards.barefootbetters.com`.
