# Registry Viewer — Prompt Sequence Index

## Purpose

This prompt sequence documents and reproduces the **Legendary Arena Registry
Viewer** — a client-only SPA that browses card data hosted on Cloudflare R2.
It is NOT the game itself. It serves as an internal card browser, image validator,
and data diagnostics tool.

Run these prompts in order to recreate the full Registry Viewer from scratch,
or use individual prompts as reference when modifying a specific layer.

---

## What the Registry Viewer Is

| Layer | Description |
|---|---|
| **R2 Data Store** | Card JSON + WebP images hosted on Cloudflare R2 |
| **Registry Package** | TypeScript data access layer (browser + Node.js) |
| **Registry Viewer SPA** | Vite + Vue 3 static app deployed to Cloudflare Pages |

**Live URLs:**
- Viewer: `https://cards.barefootbetters.com`
- Card images + JSON: `https://images.barefootbetters.com`
- GitHub: `https://github.com/barefootbetters/legendary-arena`

---

## Prompt Map

| # | File | Phase | Builds On | Version | Status |
|---|------|-------|-----------|---------|--------|
| 00 | `00-index.md` | Meta | Nothing | v1.1 | Stable |
| 01 | `01-r2-data-structure.md` | Data | Nothing — run first | v1.0 | Stable |
| 02 | `02-registry-schema.md` | Data | 01 | v1.0 | Stable |
| 03 | `03-registry-package.md` | Package | 01, 02 | v1.0 | Stable |
| 04 | `04-registry-viewer-spa.md` | Frontend | 03 | v1.0 | Stable |
| 05 | `05-cloudflare-deployment.md` | Operations | 04 | v1.0 | Stable |
| 06 | `06-card-detail-rules-tooltips.md` | Frontend | 04 | v1.0 | Stable |

---

## Versioning Rules

Versions follow `MAJOR.MINOR`. Update the table above when a prompt changes.

| Change type | Bump |
|---|---|
| Typo fix, wording clarification | patch — no bump |
| Add/remove/rename a deliverable | minor — bump last digit |
| Change a hard constraint or architectural boundary | major — bump first digit |

---

## Status Values

| Status | Meaning |
|---|---|
| **Stable** | Reviewed, passes constraints, safe to execute |
| **Draft** | Being written — do not execute |
| **Needs-Review** | Content complete but not yet validated |
| **Deprecated** | Superseded — do not use |

---

## Phase Descriptions

### Phase 0 — Data (Prompts 01–02)
Documents the R2 bucket structure: folder layout, file naming conventions,
JSON schema for each set type, and `sets.json` / `card-types.json` index files.
Also documents the real-world schema variations found across 40+ sets
(null fields, slot counts > 4, vAttack as number vs string vs null, etc.).

### Phase 1 — Package (Prompt 03)
The `packages/registry/` TypeScript data access layer. Exports browser-safe
and Node.js implementations. Zod schemas, shared types, flat card abstraction,
query filtering, and health reporting.

### Phase 2 — Frontend (Prompts 04, 06)
The `apps/registry-viewer/` Vite + Vue 3 SPA. Registry client bootstrap,
type-grouped multi-select filter, card grid, card detail panel, and
diagnostics overlay. All card data fetched from R2 at runtime — no build-time
data bundling.

**Prompt 04** — Core SPA: layout, filters, grid, card detail panel (plain text abilities).

**Prompt 06** — Card Detail rules tooltips: rich ability text rendering with
inline token types (keyword, rule, icon, hc, team), gold keyword chips,
native browser tooltips showing rule definitions on hover, and the
`src/composables/useRules.ts` rules/keyword glossary.

### Phase 3 — Operations (Prompt 05)
GitHub repo setup, Cloudflare Pages configuration, build command, and the
ongoing "upload to R2 → auto-deploy" workflow.

---

## What Already Exists (do not recreate)

| Asset | Location |
|---|---|
| Card JSON (per set) | `https://images.barefootbetters.com/metadata/{abbr}.json` |
| Set index | `https://images.barefootbetters.com/metadata/sets.json` |
| Card type definitions | `https://images.barefootbetters.com/metadata/card-types.json` |
| Card images (WebP) | `https://images.barefootbetters.com/{abbr}/{filename}.webp` |
| Registry Viewer SPA | `https://cards.barefootbetters.com` |
| Monorepo | `C:\pcloud\BB\DEV\legendary-arena` (pnpm workspaces) |
| GitHub repo | `https://github.com/barefootbetters/legendary-arena` |
| Cloudflare Pages project | `legendary-arena` (auto-deploys from `main`) |
| Rules glossary data | `data/seed_rules.sql` (18 game mechanic rules) |
| Rules composable | `apps/registry-viewer/src/composables/useRules.ts` |

---

## Key Architectural Decisions

**Why client-only (no backend)?**
Card data is public and read-only. R2 serves it directly over HTTPS with CORS
enabled. No authentication required. Static hosting on Cloudflare Pages is
free and deploys automatically from GitHub.

**Why copy registry source into the viewer instead of workspace resolution?**
Vite's module resolver struggled with pnpm workspace symlinks and NodeNext
`.js` extensions in TypeScript source. Copying `packages/registry/src/` into
`apps/registry-viewer/src/registry/` removes all resolution ambiguity at the
cost of a manual sync step when the package changes.

**Why a `browser.ts` entry point separate from `index.ts`?**
`index.ts` exports `localRegistry.ts` which uses `node:fs/promises` — a
Node.js-only API that breaks Vite's browser bundler. `browser.ts` exports
only the HTTP registry implementation, which is safe for all environments.

**Why Zod schemas with broad optional/nullable fields?**
The 40+ sets span 12 years of game releases. Older sets have null IDs, missing
`displayName` fields, `vAttack` as numbers instead of strings, and heroes with
more than 4 cards. The schema validates what it can and accepts the rest
rather than rejecting entire sets on minor field variations.

**Why native `title` attribute for keyword tooltips instead of a custom tooltip?**
The detail panel's `.detail-body` uses `overflow-y: auto`, which creates a CSS
stacking context. Any `position: fixed` custom tooltip element — even one
teleported outside the component via Vue's `<Teleport>` — may be clipped or
hidden by this stacking context regardless of `z-index`. The native `title`
attribute is rendered by the browser's OS-level UI and is immune to all CSS
stacking context issues.

---

## Recommended Execution Order

**To recreate from scratch:**
01 → 02 → 03 → 04 → 05 → 06

**To update the schema for a new set's data quirks:**
02 only (update schema) → copy updated `schema.ts` into viewer → push

**To add a new filter or UI feature to the viewer:**
04 only (SPA prompt, reference the relevant component section)

**To add or update keyword/rule definitions shown in tooltips:**
06 only — update `KEYWORD_GLOSSARY` or `RULES_GLOSSARY` in `useRules.ts`

**To change the deployment target:**
05 only

---

## Output Contract (applies to every prompt in this set)

Each prompt file contains this contract at the top. When executing a prompt,
Claude must output:

1. **Files changed** — every new or modified file path
2. **Full file contents** — complete content of every changed file, no diffs
3. **Commands to run** — exact `pnpm` commands with expected output
4. **Acceptance checklist** — 6–12 concrete checkboxes to validate correctness
