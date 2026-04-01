# Prompt 03 — Registry Package (Data Access Layer)

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. ESM only. Node v22+. Browser-safe entry point must never
> import node:fs or node:path. Local registry (Node.js only) used for CI/scripts only.

## Assumes

- Prompts 01–02 complete: R2 structure documented, schema and types defined
- `packages/registry/` exists in the pnpm monorepo
- `zod` is installed as a dependency in `packages/registry/package.json`
- `@aws-sdk/client-s3` is installed for the upload script (dev dependency)

---

## Role

You are building a TypeScript data access layer for Legendary Arena card data.
It has two implementations of the same `CardRegistry` interface:

1. **HTTP Registry** — browser-safe, fetches from R2 via `fetch()`
2. **Local Registry** — Node.js only, reads from the local filesystem

Both implementations are exported from the package but only the HTTP registry
is bundled into the browser SPA. The local registry is used by validation
and build scripts.

---

## Package Structure

```
packages/registry/
├── src/
│   ├── schema.ts           ← Zod schemas (from Prompt 02)
│   ├── types/
│   │   └── index.ts        ← TypeScript types (from Prompt 02)
│   ├── shared.ts           ← Pure helpers (from Prompt 02)
│   ├── impl/
│   │   ├── httpRegistry.ts ← Browser-safe HTTP implementation
│   │   └── localRegistry.ts← Node.js filesystem implementation
│   ├── browser.ts          ← Browser-safe public entry point
│   └── index.ts            ← Full public entry point (includes local)
├── scripts/
│   ├── validate.ts         ← CI validation script
│   └── upload-r2.ts        ← R2 upload script
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

---

## Deliverables

### 1. HTTP Registry (`packages/registry/src/impl/httpRegistry.ts`)

`createRegistryFromHttp(options: HttpRegistryOptions): Promise<CardRegistry>`

Initialization sequence:
1. Fetch `{metadataBaseUrl}/metadata/sets.json`
   - Parse defensively: extract `abbr` and `name` from each entry manually
     (do not use Zod here — accept any object with an `abbr` field)
   - Never reject an entry that has a valid `abbr`, even if other fields are missing
2. For each abbr in `options.eagerLoad`:
   - If `eagerLoad` contains `"*"`, load all sets from the index
   - Fetch `{metadataBaseUrl}/metadata/{abbr}.json`
   - Parse with `SetDataSchema.safeParse()` — log parse errors, do not throw
3. Build a `Map<string, SetData>` of successfully loaded sets
4. Return the `CardRegistry` interface implementation

**Important:** `sets.json` parsing must be manual (not Zod) because the index
file's exact field names have varied. Extract the minimum required fields:

```typescript
const abbr = String(r["abbr"] ?? r["slug"] ?? r["id"] ?? "").trim();
const name = String(r["name"] ?? abbr).trim();
if (!abbr) continue; // skip entries with no usable abbreviation
```

`getImageUrl` is NOT on this registry — images use embedded `imageUrl` from
card data. `CardRegistry.query()` accepts `CardQueryExtended` but the interface
types it as `CardQuery` — cast internally.

### 2. Local Registry (`packages/registry/src/impl/localRegistry.ts`)

`createRegistryFromLocalFiles(options: LocalRegistryOptions): Promise<CardRegistry>`

Options:
```typescript
export interface LocalRegistryOptions {
  metadataDir: string; // path to folder with card-types.json + {abbr}.json files
}
```

Node.js only. Uses `node:fs/promises` and `node:path`.

Initialization:
1. Read `card-types.json` from `metadataDir` — parse defensively
2. Read all `*.json` files in `metadataDir` except `card-types.json` and
   `sets.json` — treat each as a set file
3. Parse each with `SetDataSchema.safeParse()` — collect errors, do not throw
4. Return `CardRegistry` interface implementation

Used only by validation scripts. Never imported by browser code.

### 3. Browser entry point (`packages/registry/src/browser.ts`)

Exports only browser-safe items. Never imports `localRegistry.ts`:

```typescript
// Types
export type { SetIndexEntry, SetData, Hero, HeroCard, HeroClass,
  Mastermind, MastermindCard, VillainGroup, VillainCard, Scheme,
  FlatCard, FlatCardType, CardQuery, CardQueryExtended,
  RegistryInfo, HealthReport, CardRegistry, HttpRegistryOptions } from "./types/index.js";

// HTTP factory only
export { createRegistryFromHttp } from "./impl/httpRegistry.js";

// Schema exports safe for browser
export { SetDataSchema, SetIndexEntrySchema, HeroCardSchema,
  HeroClassSchema, CardQuerySchema } from "./schema.js";
```

### 4. Full entry point (`packages/registry/src/index.ts`)

Exports everything from `browser.ts` plus the local registry:

```typescript
export * from "./browser.js";
export { createRegistryFromLocalFiles } from "./impl/localRegistry.js";
export type { LocalRegistryOptions } from "./impl/localRegistry.js";
```

### 5. `packages/registry/package.json`

```json
{
  "name": "@legendary-arena/registry",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types":  "./dist/index.d.ts"
    }
  },
  "files": ["dist", "docs"],
  "scripts": {
    "build":    "tsc -p tsconfig.build.json",
    "validate": "tsx scripts/validate.ts"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "dotenv":             "^16.4.5",
    "tsx":                "^4.15.7",
    "typescript":         "^5.4.5"
  }
}
```

### 6. Validation script (`packages/registry/scripts/validate.ts`)

`tsx scripts/validate.ts` — runs `createRegistryFromLocalFiles` against
`data/raw/` (or `INPUT_DIR` env var), calls `registry.validate()`, prints
health report, exits 1 if any parse errors.

---

## Operational Notes (answer directly)

1. **Why manual parsing for `sets.json` but Zod for `{abbr}.json`?**
   The index file has historically had different field names across uploads.
   Using manual extraction with fallbacks ensures no set is dropped from the
   dropdown due to a minor index schema mismatch. Set data files are more
   controlled, so Zod adds value there.

2. **When does `eagerLoad: ["*"]` cause problems?**
   Loading all 40 sets on page load fires 40 parallel fetch requests. R2
   handles this fine but the browser may throttle connections. If initial
   load feels slow, switch to loading sets on demand when the user selects
   them from the filter dropdown.

3. **What happens when a set file has parse errors?**
   The error is recorded in the health report (`SET_FETCH_ERROR`) and the
   set is excluded from `listCards()` output. The viewer still loads — it
   just shows 0 cards for that set. The Diagnostics panel shows the errors.

---

## Hard Constraints

- `browser.ts` must never import `node:fs`, `node:path`, or `localRegistry.ts`
- All registry implementations must use `safeParse` — never `parse` (never throw)
- `sets.json` parsing must use manual field extraction — not Zod schema validation
- `FlatCard.imageUrl` must always be a non-null string — use `""` as fallback
- `FlatCard.abilities` must always be a non-null array — use `[]` as fallback
- ESM only — no `require()`

---

## Acceptance Checklist

- [ ] `import { createRegistryFromHttp } from "@legendary-arena/registry"` works
      in a browser context without errors about `node:fs`
- [ ] `createRegistryFromHttp({ metadataBaseUrl: "https://images.barefootbetters.com",
      eagerLoad: ["2099"] })` returns a registry with 2099 cards
- [ ] `registry.listSets()` returns all 40 sets from `sets.json`
- [ ] `registry.listCards()` returns FlatCard objects with non-null `imageUrl`
      and non-null `abilities`
- [ ] `registry.validate()` returns a health report with 0 parse errors for
      a correctly formatted set
- [ ] `browser.ts` imports compile without errors in a Vite browser build
- [ ] `localRegistry.ts` is NOT included in the Vite browser bundle
- [ ] Parse errors for one set do not crash the registry — other sets still load
