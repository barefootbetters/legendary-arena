# Prompt 04 — Registry Viewer SPA (Vite + Vue 3)

> **Historical prompt archive.** Sections that reference
> `card-types.json` as an active filter source reflect the
> pre-2026-04-21 state; that file was deleted by WP-084. The current
> viewer derives card-type classification from per-set data and does
> not fetch `card-types.json`.

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. Client-only — no backend. No Vue Router required.
> All card data fetched from R2 at runtime. No data bundled at build time.
> ESM only. Vite + Vue 3 + TypeScript.

## Assumes

- Prompt 03 complete: registry package source exists in
  `packages/registry/src/`
- pnpm monorepo at `C:\pcloud\BB\DEV\legendary-arena`
- Node.js v22+, pnpm v9+
- `apps/registry-viewer/` is a Vite + Vue 3 workspace package

---

## Role

You are building a client-only SPA that browses Legendary Arena card data.
It fetches JSON from Cloudflare R2 at runtime and displays cards in a
searchable, filterable grid. There is no backend. The app is deployed as
static files to Cloudflare Pages.

---

## Critical Constraints

**No package resolution for the registry — copy source instead.**
Vite's dev server cannot resolve pnpm workspace packages when the package
uses NodeNext `.js` extensions in TypeScript imports. The solution is to
copy `packages/registry/src/` into `apps/registry-viewer/src/registry/`
and use relative imports. This is a known limitation of the toolchain.

**Browser entry point only.**
All imports from the registry use `"../registry/browser"` (relative path)
or `"../../registry/browser"` (from components). Never import from
`"../registry/index"` — that pulls in `localRegistry.ts` which uses `node:fs`.

**`sets.json` is the set index.**
The viewer fetches `metadata/sets.json` — NOT `metadata/card-types.json`.
`card-types.json` contains card type definitions (used for the filter
dropdown) and is fetched separately at app startup.

---

## App Structure

```
apps/registry-viewer/
├── public/
│   └── registry-config.json  ← runtime config (not bundled)
├── src/
│   ├── registry/             ← copied from packages/registry/src/
│   │   ├── browser.ts
│   │   ├── schema.ts
│   │   ├── shared.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── impl/
│   │       ├── httpRegistry.ts
│   │       └── localRegistry.ts
│   ├── lib/
│   │   └── registryClient.ts ← singleton registry instance
│   ├── components/
│   │   ├── CardGrid.vue
│   │   ├── CardDetail.vue
│   │   └── HealthPanel.vue
│   ├── App.vue               ← root component with all filter logic
│   └── main.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Deliverables

### 1. `public/registry-config.json`

Runtime config loaded by the app at startup. Not bundled — can be changed
without a code redeploy:

```json
{
  "metadataBaseUrl": "https://images.barefootbetters.com",
  "eagerLoad": [
    "core", "dkcy", "ff04", "pttr", "vill", "gotg", "fear",
    "3dtc", "ssw1", "ssw2", "ca75", "cvwr", "dead", "noir",
    "xmen", "smhc", "chmp", "wwhk", "msp1", "antm", "vnom",
    "dims", "rvlt", "shld", "asrd", "nmut", "cosm", "rlmk",
    "anni", "msmc", "dstr", "mgtg", "bkpt", "bkwd", "msis",
    "mdns", "wtif", "amwp", "2099", "wpnx"
  ]
}
```

**Workflow:** To add a new set, add its `abbr` to this array and push to
GitHub. Cloudflare Pages auto-deploys. No other code change needed.

### 2. `src/lib/registryClient.ts`

Singleton that loads the registry once and returns the same instance on
every call:

```typescript
import { createRegistryFromHttp } from "../registry/browser";
import type { CardRegistry } from "../registry/browser";

interface RegistryConfig {
  metadataBaseUrl: string;
  eagerLoad?: string[];
}

let _promise: Promise<CardRegistry> | null = null;

export function getRegistry(): Promise<CardRegistry> {
  if (_promise) return _promise;
  _promise = (async () => {
    const res = await fetch("/registry-config.json");
    if (!res.ok) throw new Error(`Cannot load registry-config.json: ${res.status}`);
    const config: RegistryConfig = await res.json();
    return createRegistryFromHttp({
      metadataBaseUrl: config.metadataBaseUrl,
      eagerLoad: config.eagerLoad ?? [],
    });
  })();
  return _promise;
}

export function resetRegistry(): void { _promise = null; }
```

### 3. `src/App.vue`

Root component containing all filter state and layout. Key behaviours:

**Startup:**
1. Fetch `metadata/card-types.json` from R2 for the type filter dropdown
2. Call `getRegistry()` — loads set index + all eagerLoad sets
3. Show spinner with status text while loading
4. Show red error screen (with exact error message) if loading fails

**Filter state:**
- `searchText` — name search (case-insensitive)
- `filterSet` — set abbreviation (`""` = all)
- `filterHC` — hero class (`""` = all)
- `selectedTypes` — `Set<FlatCardType>` (multi-select, empty = all)

**Type group filter (pill buttons):**
Groups with emoji labels. Clicking a group toggles all its types:

| Group | Emoji | Types |
|---|---|---|
| Hero | 🦸 | `hero` |
| Mastermind | 🦹 | `mastermind` |
| Villain | 💀 | `villain` |
| Henchman | 🗡️ | `henchman` |
| Scheme | 📜 | `scheme` |
| Bystander | 🧑 | `bystander` |
| Wound | 🩸 | `wound` |
| Other | 🃏 | `location`, `other` |

Multiple groups can be active simultaneously. "All" button clears selection.
Active groups shown in blue. Partial selection shown with dashed border.

**Set quick-filter pills:**
Row of abbreviated set buttons below the type filter. Clicking a pill sets
`filterSet` to that abbr (or clears it if already selected).

**Layout:**
```
[Header: logo + Diagnostics button]
[Search | Set dropdown | Class dropdown | Card count]
[Type group pill buttons]
[Set abbreviation pills]
[Card grid | Card detail panel (when card selected)]
```

### 4. `src/components/CardGrid.vue`

Props: `{ cards: FlatCard[], selectedKey?: string }`
Emits: `select(card: FlatCard)`

- CSS grid, auto-fill columns, minimum 130px width
- Each tile: image (lazy loaded) + card name + hero name (if hero) + type badge
  + HC badge + cost + rarity dot
- `@error` on image: if URL doesn't include `-epic`, retry with `-epic.webp`
  appended before `.webp`
- Selected tile has highlighted border
- Empty state: "No cards match your filters."

**Image error fallback (epic tactic fix):**
```typescript
(e) => {
  const img = e.target as HTMLImageElement;
  if (!img.src.includes('-epic')) {
    img.src = img.src.replace('.webp', '-epic.webp');
  }
}
```

### 5. `src/components/CardDetail.vue`

Props: `{ card: FlatCard }`
Emits: `close()`

Side panel (fixed 320px width) showing:
- Card image (full width)
- Type, set name + abbr, hero name, team, hero class, cost, attack, recruit,
  rarity — in a 2-column stat grid
- Abilities list — strip markup tags (`[keyword:X]`, `[hc:X]`, `[icon:X]`)
  using: `text.replace(/\[[\w-]+:[^\]]+\]/g, m => m.split(':')[1]?.slice(0, -1) ?? m)`
- Collapsible raw JSON section
- Close button (✕)

### 6. `src/components/HealthPanel.vue`

Props: `{ report: HealthReport, info: RegistryInfo }`
Emits: `close()`

Modal overlay showing:
- Summary tiles: Sets Indexed, Sets Loaded, Heroes, Total Cards, Parse Errors
- Info section: base URL, loaded set abbrs, generated timestamp
- Errors list: each error shows code (red badge), setAbbr, message

### 7. `vite.config.ts`

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".vue", ".json"],
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
```

**No alias for `@legendary-arena/registry`** — the registry source is
copied into `src/registry/` and imported via relative paths.

### 8. `apps/registry-viewer/package.json`

```json
{
  "name": "registry-viewer",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev":   "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.27",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.5",
    "@vue/tsconfig":      "^0.5.1",
    "typescript":         "^5.4.5",
    "vite":               "^5.3.1",
    "vue-tsc":            "^2.0.19"
  }
}
```

**Note:** `build` script uses `vite build` only — NOT `vue-tsc --noEmit && vite build`.
The TypeScript check is omitted from the build script because `vue-tsc` fails
on the copied registry source files (which include `localRegistry.ts` with
`node:fs` imports that vue-tsc cannot resolve in a DOM lib context).

---

## Operational Notes (answer directly)

1. **Adding a new set:** Upload `{abbr}.json` to R2, add `abbr` to
   `registry-config.json` `eagerLoad` array, commit and push. No other
   changes needed. Cloudflare Pages deploys automatically. The new set
   appears in the dropdown and card grid within 2–3 minutes.

2. **Why `zod` is in dependencies (not devDependencies):** Zod runs in the
   browser for runtime validation of R2 JSON. It is part of the production
   bundle. devDependencies are excluded from the browser bundle by Vite.

3. **Why the registry source is copied rather than symlinked:**
   pnpm workspace symlinks + Vite's `@rollup/plugin-node-resolve` +
   NodeNext `.js` extensions in TypeScript = reliable resolution failures.
   Copying is the pragmatic solution. When `packages/registry/src/` changes,
   copy the updated files into `apps/registry-viewer/src/registry/` and push.

4. **Why `vue-tsc` is excluded from the build command:**
   `localRegistry.ts` imports `node:fs/promises` and `node:path`. These are
   valid Node.js imports but `vue-tsc` compiles against the DOM lib and cannot
   resolve them. Vite's bundler handles this correctly (it excludes
   `localRegistry.ts` since nothing in the browser entry point imports it).
   Removing `vue-tsc` from the build script unblocks CI without sacrificing
   any actual type safety in the browser code.

---

## Hard Constraints

- No backend — client-only, zero server-side rendering
- No Vue Router — single page with all state in `App.vue`
- All registry imports use relative paths (`../registry/browser`) — no package name
- `localRegistry.ts` must never be imported by any browser-facing file
- `build` script is `vite build` only — NOT `vue-tsc --noEmit && vite build`
- Card images loaded with `loading="lazy"` attribute
- Image error handler must retry with `-epic` suffix before showing broken image

---

## Acceptance Checklist

- [ ] `pnpm viewer:dev` starts without errors
- [ ] `http://localhost:5173` shows the Registry Viewer UI
- [ ] Loading spinner appears while registry is fetching
- [ ] Error screen appears (with error text) if R2 is unreachable
- [ ] Card grid populates with cards from at least one set
- [ ] Clicking a card opens the detail panel
- [ ] Type group pills filter the card grid correctly
- [ ] Multiple type groups can be active simultaneously
- [ ] Set dropdown shows all 40 set names
- [ ] Search box filters by card name case-insensitively
- [ ] 🔍 Diagnostics button opens health panel with error count
- [ ] `pnpm viewer:build` completes without errors and produces `dist/`
