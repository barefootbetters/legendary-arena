# WP-082 — Keyword & Rule Glossary Schema, Label, and PDF Page Reference

**Status:** Draft (awaiting pre-flight lint + author approval)
**Primary Layer:** Registry (`packages/registry/src/schema.ts`) + Registry Viewer (`apps/registry-viewer/src/**`) + Content / Data (`data/metadata/`)
**Schema Version:** 1
**Last Updated:** 2026-04-21
**Dependencies:** WP-060 (glossary data migrated to R2 — `412a31c`)

---

## Session Context

WP-060 / EC-106 migrated the keyword and rule glossaries from hardcoded
Maps in `useRules.ts` to versioned JSON files on R2. On 2026-04-21 the
keyword glossary grew from 113 to **123 entries** after a rulebook v23
audit (entries: `chooseavillaingroup`, `defeat`, `galactusconsumestheearth`,
`greyheroes`, `halfpoints`, `locations`, `poisonvillains`, `reveal`,
`shards`, `wound`). The audit exposed three latent weaknesses in the
current pipeline:

1. **No validation.** `apps/registry-viewer/src/lib/glossaryClient.ts:46`
   types the fetched payload inline as `Array<{ key, description }>`. A
   malformed R2 publish silently produces empty Maps and the glossary
   panel disappears with no surfaced error.
2. **Heuristic display names.** `apps/registry-viewer/src/composables/useGlossary.ts:94–100`
   uses a `titleCase()` heuristic that splits on camelCase and hyphens.
   The heuristic cannot recover word boundaries inside all-lowercase keys
   such as `chooseavillaingroup` (renders as "Chooseavillaingroup") or
   preserve punctuation like "S.H.I.E.L.D. Clearance" (renders as
   "Shieldclearance"). `rules-full.json` already solves this with an
   explicit `label` field; `keywords-full.json` does not.
3. **No source traceability.** Each entry's text was paraphrased from
   the Universal Rulebook PDF v23, but there is no per-entry link back
   to the source. Future audits (did the v24 rulebook change the
   definition of "Haunt"?) require re-reading the full PDF.

This packet solves all three by adding a Zod schema, a required `label`
field, and an optional `pdfPage` field to both glossary files, then
rendering the page as a deep-link into the rulebook PDF hosted on R2.

---

## Why This Packet Matters

1. **Validation at the fetch boundary** — prevents silent glossary-panel
   breakage on bad R2 publishes (the only thing standing between a
   corrupted deploy and an empty glossary panel today is the JSON parser)
2. **Correct display names** — every keyword renders with the exact
   human-readable name from the rulebook, including all-lowercase keys
   and punctuated names like "S.H.I.E.L.D. Clearance"
3. **Source auditability** — each entry points to its rulebook page,
   so v24 and beyond can be audited with a single diff pass against
   a markdown extract of the rulebook

---

## Goal

Add a Zod schema for keyword and rule glossary entries; add a required
`label` field and optional `pdfPage` field to both glossary JSON files;
host the rulebook PDF on R2; render `pdfPage` as a deep-link in the
glossary panel. Delete `titleCase()` and its consumer paths.

### After completion:

- `packages/registry/src/schema.ts` exports `KeywordGlossaryEntrySchema`
  and `RuleGlossaryEntrySchema` (plus their inferred types)
- `data/metadata/keywords-full.json` entries carry a **required** `label`
  field (string) and **optional** `pdfPage` field (integer ≥ 1) —
  **123 entries**, alphabetical by `key`
- `data/metadata/rules-full.json` entries carry an **optional** `pdfPage`
  field alongside their existing `label` and `summary` — **20 entries**,
  alphabetical by `key`
- `docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf` is
  uploaded to R2 at
  `https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf`
  (kebab-case filename — no spaces or parentheses in URLs)
- `apps/registry-viewer/public/registry-config.json` exposes a
  `rulebookPdfUrl` field pointing to the R2 URL above
- `apps/registry-viewer/src/lib/glossaryClient.ts` validates the fetched
  payload with Zod and rejects malformed data with a full-sentence
  `// why:`-annotated warning
- `apps/registry-viewer/src/composables/useGlossary.ts` uses
  `entry.label` directly; the `titleCase()` helper is removed
- `apps/registry-viewer/src/components/GlossaryPanel.vue` renders
  `pdfPage` as an anchor (`target="_blank"`, `rel="noopener"`) whose
  `href` is `${rulebookPdfUrl}#page=${pdfPage}`; anchor is omitted when
  `pdfPage` is absent
- `docs/legendary-universal-rules-v23.md` exists — a
  lightly-cleaned markdown transcription of the PDF text for offline
  audit (source for `pdfPage` values; referenced at execution time)
- Baseline repo test count preserved; build passes

---

## Assumes

- WP-060 / EC-106 complete (glossary data in R2 at `images.barefootbetters.com/metadata/`)
- `apps/registry-viewer/src/lib/glossaryClient.ts`,
  `apps/registry-viewer/src/composables/useGlossary.ts`,
  `apps/registry-viewer/src/composables/useRules.ts`,
  `apps/registry-viewer/src/components/GlossaryPanel.vue`,
  `apps/registry-viewer/src/App.vue`,
  and `apps/registry-viewer/public/registry-config.json` all exist at HEAD
- `packages/registry/src/schema.ts` exists and already imports `zod`
- R2 bucket `images.barefootbetters.com` is writable and the executor
  has credentials
- `docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf` exists at
  the working-directory-relative path above (44 MB, 91-page rulebook)
- `pnpm -r build` exits 0
- `pnpm -r --if-present test` exits 0 at the WP-082 starting commit
  (re-derive the baseline passing count at pre-flight time)

If any assumption is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` Section 1 ("Monorepo Package Boundaries")
  and §"Registry Layer (Data Input)" and §"Layer Boundary (Authoritative)"
  — Zod schemas belong in `packages/registry/src/schema.ts`; the viewer
  must not redefine them
- `.claude/rules/architecture.md` §"Layer Boundary (Authoritative)" —
  this packet touches Registry + Registry Viewer layers and must not
  cross into Game Engine or Server
- `.claude/rules/registry.md` — schema authority is centralized in
  `packages/registry/src/schema.ts`; no schemas may live elsewhere
- `docs/ai/REFERENCE/00.2-data-requirements.md` — field-naming authority;
  any new field names (`label`, `pdfPage`) must not contradict 00.2
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code rules
  (enforced by the lint gate §16)
- `docs/ai/DECISIONS.md` — scan for prior decisions on glossary data,
  R2 hosting, and schema authority before adding new ones
- `docs/ai/work-packets/WP-060-keyword-rule-glossary-data.md` — prior
  art for glossary JSON shape, R2 upload, and `glossaryClient.ts`
- `docs/ai/execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md`
  — reference for verbatim-preservation rules around `lookupKeyword`
  and `lookupRule` (those functions are **unchanged** by this WP)
- `apps/registry-viewer/src/lib/glossaryClient.ts` — current inline-typed
  fetcher to be retrofitted with Zod validation
- `apps/registry-viewer/src/composables/useGlossary.ts:85–105` — current
  `buildAllEntries()` and `titleCase()` — `titleCase()` is deleted by
  this WP, consumers retargeted to `entry.label`
- `apps/registry-viewer/src/components/GlossaryPanel.vue:119–144` —
  entry rendering to extend with the optional `pdfPage` anchor
- `packages/registry/src/schema.ts` — existing Zod schemas (for card
  data) serve as pattern reference for the new glossary schemas

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**

- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (e.g.,
  `import { readFile } from 'node:fs/promises'`)
- Test files use `.test.ts` extension — never `.test.mjs`
- **Full file contents** for every new or modified file — no diffs, no
  snippets, no partial edits
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (no
  nested ternaries; no `.reduce()` with branching; descriptive names;
  JSDoc on all functions; `// why:` comments for non-obvious code;
  full-sentence error messages)
- No `import *` or barrel re-exports

**Packet-specific:**

- **No content changes** — existing `description` / `label` / `summary`
  text is preserved byte-for-byte. This WP adds `label` to keyword
  entries (new field) and `pdfPage` to both (new field) — it does not
  edit, reword, shorten, or translate any existing text.
- **No keyword or rule additions / deletions** — this is a schema and
  metadata pass. The 123-keyword / 20-rule counts are locked at
  execution time.
- **`lookupKeyword` and `lookupRule` are LOCKED** — their algorithmic
  bodies in `useRules.ts` must not be modified. The only viewer-side
  behavior change is that `useGlossary.ts` reads `entry.label` instead
  of calling `titleCase(entry.key)` when building display names for the
  panel list.
- **`HERO_CLASS_GLOSSARY` stays hardcoded** — 5 entries; not part of
  this WP.
- **Registry viewer only on the UI side** — no changes to
  `packages/game-engine/`, `apps/server/`, or `packages/preplan/`.
- **No new Zod schemas outside `packages/registry/src/schema.ts`** —
  consumers import from there. Per `.claude/rules/registry.md`, schema
  authority is centralized.
- **Browser-compatible PDF deep-links only** — `#page=N` is
  [RFC 3778 §3](https://datatracker.ietf.org/doc/html/rfc3778#section-3)
  open-parameter syntax supported by Chrome, Firefox, Edge, and Safari
  native PDF viewers. Do not introduce any other PDF anchor syntax.
- **New anchor opens in a new window/tab** — `target="_blank"` plus
  `rel="noopener"` (security: prevents `window.opener` leakage).
- **Absence of `rulebookPdfUrl` is a supported configuration.** When
  the config field is missing, the panel renders entries without the
  rulebook anchor and emits no warning, banner, or console message.
  Do not introduce a "helpful" fallback UI for the missing-config
  case — silence is the contract.

**Session protocol:**

- If any keyword or rule count drifts from the pre-flight baseline
  (123 / 20), STOP and ask before proceeding.
- If the R2 PDF upload fails or returns non-200, STOP and escalate —
  do NOT silently omit `rulebookPdfUrl` and ship a broken link.
- If a single `pdfPage` value cannot be determined from the markdown
  rulebook extract, leave the field **absent** for that entry (optional
  field). Do NOT guess a page number.

---

## Scope (In)

### A) Markdown reference extract of the rulebook

Create `docs/legendary-universal-rules-v23.md` from the
plain-text extraction at
`docs/Marvel Legendary Universal Rules v23.txt` (produced by `pdftotext
-layout`, 5250 lines). Lightly clean:

- Convert "Keyword Abilities" section headers to `##` headings.
- Preserve the `page N` markers at section boundaries (these are the
  authoritative source for `pdfPage` values).
- Strip repeated page footers and PDF reflow artifacts where they make
  a keyword definition unreadable — leave the rest verbatim.
- Prepend an **Authority Notice** at the top of the file (before any
  heading) in this exact form:

  > **Authority Notice:** This file is the authoritative source for all
  > `pdfPage` values in glossary metadata. Page numbers must not be
  > inferred from the PDF alone.

  The notice is required so future audits ("why not just open the PDF?")
  have a one-glance answer.

No full rewrite. The file is a reference artifact, not documentation.
It is **not** linked from any runtime code.

### B) Zod schemas in the registry package

Add to `packages/registry/src/schema.ts`:

- `KeywordGlossaryEntrySchema = z.object({ key: z.string().min(1), label: z.string().min(1), description: z.string().min(1), pdfPage: z.number().int().min(1).optional() }).strict()`
- `RuleGlossaryEntrySchema = z.object({ key: z.string().min(1), label: z.string().min(1), summary: z.string().min(1), pdfPage: z.number().int().min(1).optional() }).strict()`
- `KeywordGlossarySchema = z.array(KeywordGlossaryEntrySchema)`
- `RuleGlossarySchema = z.array(RuleGlossaryEntrySchema)`
- Inferred TypeScript types: `KeywordGlossaryEntry`, `RuleGlossaryEntry`

`.strict()` rejects unknown fields — forces a governed extension path
for future field additions.

A `// why:` comment must sit directly above the two entry schemas
explaining that they are intentionally separate rather than built from
a shared base:

```ts
// why: Keyword and Rule glossary entries are intentionally separate
// schemas. The description/summary distinction is semantic (one
// defines an ability, the other states a rule). Duplicating the
// shared fields keeps semantics explicit at the registry boundary
// and avoids a future contributor extracting a base shape that
// blurs that distinction.
```

### C) Backfill `label` and `pdfPage` in `keywords-full.json`

For each of the 123 entries in `data/metadata/keywords-full.json`:

- Add `label` (required): the human-readable keyword name from the
  rulebook (e.g., `"Burn Shards"`, `"Choose a Villain Group"`,
  `"S.H.I.E.L.D. Clearance"`). Preserve capitalization and punctuation
  exactly as printed in the rulebook.
- Add `pdfPage` (optional): the 1-indexed PDF page number where the
  keyword is defined, per `docs/legendary-universal-rules-v23.md`.
  Omit the field when no page can be determined.

Preserve the existing `description` field byte-for-byte. Entries remain
alphabetical by `key`.

### D) Backfill `pdfPage` in `rules-full.json`

For each of the 20 rule entries, add optional `pdfPage` where
determinable. Existing `label` and `summary` unchanged.

### E) Rulebook PDF on R2

- Upload `docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf`
  to R2 at
  `https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf`
- Cache-control: long-lived (`max-age=31536000, immutable` — the file
  is version-pinned by `v23` in the filename; a v24 rulebook is a new
  file, not a mutation)
- Content-Type: `application/pdf`

### F) Config field for the rulebook URL

Add `rulebookPdfUrl` (string, absolute URL) to
`apps/registry-viewer/public/registry-config.json`. Wire it through
the existing config-loading path in `App.vue` alongside `metadataBaseUrl`.

### G) Zod validation at fetch time

Update `apps/registry-viewer/src/lib/glossaryClient.ts`:

- Import `KeywordGlossarySchema` and `RuleGlossarySchema` from
  `@legendary-arena/registry`
- After `response.json()`, parse the payload through `.safeParse(...)`.
  On failure, log a full-sentence warning that names the file, the
  URL, and the first validation issue (e.g.,
  `"[Glossary] Rejected keywords-full.json from <url>: entry 17.label is missing. Panel will show no entries until data is corrected."`)
  and resolve to an empty Map (non-blocking fallback, consistent with
  EC-106).
- **Zod issue path rendering is locked:** extract the first issue and
  render its path as a dot-joined string (or the literal `root` when
  the path is empty) so viewer logs stay operator-readable without
  Zod fluency. Exact shape:

  ```ts
  const issue = result.error.issues[0];
  const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
  // use `path` and `issue.message` in the warning text
  ```

  This prevents noisy default Zod paths such as `["0","label"]` from
  reaching the console.
- No `.parse(...)` (which throws) — the fetch boundary must remain
  non-blocking. Validation failures are logged, not thrown.

Inline `Array<{...}>` types are removed; types flow from the schema.

### H) Replace `titleCase()` with `entry.label`

Update `apps/registry-viewer/src/composables/useGlossary.ts`:

- In `buildAllEntries()`, for keyword entries, use `entry.label` as the
  display name. For rules, continue using `entry.label` (already
  present).
- Delete the `titleCase()` function body and all call sites.
- **Dedup logic is removed.** The canonical JSON is alphabetical,
  duplicate-free (verification step 4 asserts this), and validated by
  Zod on fetch. The defensive dedup block in `buildAllEntries()`
  (`// why: some keywords appear twice in the map (villainousweapons).
  Skip duplicates.`) must be deleted along with `titleCase()`. No
  "check at execution time" — uniqueness is a contract of the JSON,
  not a runtime concern.

### I) Render `pdfPage` as a deep-link in the glossary panel

Update `apps/registry-viewer/src/components/GlossaryPanel.vue`:

- When an entry has `pdfPage`, render a small anchor below the
  description (e.g., `"📖 Rulebook p. 17"` — or the equivalent Vue
  template; emoji OK here since this is UI copy, not code).
- `href` computed as `${rulebookPdfUrl}#page=${pdfPage}`.
- `target="_blank"` and `rel="noopener"` mandatory.
- When `rulebookPdfUrl` is absent from config or `pdfPage` is absent
  from the entry, omit the anchor silently (no broken-link fallback).

Inline styles may reuse existing panel class names. No new CSS files.

### J) Republish glossary JSON to R2

After the `label` and `pdfPage` backfill lands in-repo, republish both
files to R2 at their existing URLs
(`images.barefootbetters.com/metadata/keywords-full.json` and
`/rules-full.json`). Same cache headers as WP-060.

### K) Documentation

- Update `apps/registry-viewer/CLAUDE.md` — extend the "Keyword & Rule
  Glossary" section: mention Zod validation at fetch, the `label`
  field, the `pdfPage` deep-link. The section must include the exact
  sentence: **"Do not infer labels from keys under any circumstance."**
  (this prevents a future contributor from reintroducing a
  `titleCase`-style heuristic).
- Update `docs/03.1-DATA-SOURCES.md` §Registry Metadata — add the
  schema reference and the rulebook PDF row.
- Add a row to `docs/ai/DECISIONS.md` for each governance decision
  listed below (see §Governance).

---

## Out of Scope

- **No changes to `lookupKeyword` / `lookupRule` algorithm** — their
  bodies in `useRules.ts` stay byte-for-byte identical.
- **No new keyword or rule entries** — counts locked at 123 / 20.
- **No rewriting of existing descriptions, labels, or summaries** —
  only new fields are added.
- **No Zod schema for `HERO_CLASS_GLOSSARY`** — 5 hardcoded entries,
  not a fetched resource.
- **No Zod schemas outside `packages/registry/src/schema.ts`**
  (centralized schema authority per `.claude/rules/registry.md`).
- **No migration of other metadata files** (`sets.json`, `themes/*`,
  `card-types.json`) — out of scope.
- **No changes to `packages/game-engine/`, `apps/server/`, or
  `packages/preplan/`**.
- **No inline PDF viewer embed** — deep-links open the PDF in a new
  tab in the browser's native PDF viewer. No PDF.js bundle.
- **No fallback-link UI** when `rulebookPdfUrl` is missing — if the
  config field is absent, the panel renders without the anchor. There
  is no warning banner.
- **No database or `load_legendary_data.mjs` changes** — glossary data
  is display-only, not engine input.
- **No new test frameworks** — any tests use `node:test` only.

---

## Files Expected to Change

- `packages/registry/src/schema.ts` — **modified** — add
  `KeywordGlossaryEntrySchema`, `KeywordGlossarySchema`,
  `RuleGlossaryEntrySchema`, `RuleGlossarySchema`, and their inferred
  types
- `packages/registry/src/index.ts` — **modified** — export the four
  new schemas and two new types (no `import *`, explicit re-export)
- `data/metadata/keywords-full.json` — **modified** — add `label`
  (required) and `pdfPage` (optional) to all 123 entries
- `data/metadata/rules-full.json` — **modified** — add `pdfPage`
  (optional) to rule entries where determinable
- `apps/registry-viewer/public/registry-config.json` — **modified** —
  add `rulebookPdfUrl` field
- `apps/registry-viewer/src/lib/glossaryClient.ts` — **modified** —
  import schemas from `@legendary-arena/registry`, validate with
  `.safeParse(...)`, log + fallback on failure
- `apps/registry-viewer/src/lib/configClient.ts` — **modified** (if
  config typing is centralized there) — add `rulebookPdfUrl?: string`
  to the config type
- `apps/registry-viewer/src/composables/useGlossary.ts` — **modified**
  — delete `titleCase()`, retarget keyword entries to use
  `entry.label`, expose `rulebookPdfUrl` if consumed by the panel
  through this composable
- `apps/registry-viewer/src/components/GlossaryPanel.vue` — **modified**
  — render optional `pdfPage` anchor with `target="_blank"` +
  `rel="noopener"`
- `apps/registry-viewer/src/App.vue` — **modified** — plumb
  `rulebookPdfUrl` from loaded config into the panel (wiring only)
- `apps/registry-viewer/CLAUDE.md` — **modified** — document Zod
  validation, `label` field, `pdfPage` deep-link
- `docs/03.1-DATA-SOURCES.md` — **modified** — add schema reference
  and rulebook PDF row
- `docs/ai/DECISIONS.md` — **modified** — governance decisions (see
  §Governance)
- `docs/legendary-universal-rules-v23.md` — **new** —
  markdown extract of the rulebook for offline audit

No other files may be modified.

---

## Governance (Required)

Add the following decisions to `docs/ai/DECISIONS.md`:

- Glossary JSON files now have Zod schemas in
  `packages/registry/src/schema.ts` — fetched payloads are validated
  with `.safeParse(...)` at the fetch boundary (non-throwing); invalid
  payloads degrade to an empty Map with a full-sentence warning
- Keyword glossary entries carry a **required** `label` field and an
  **optional** `pdfPage` field; the `titleCase()` heuristic in
  `useGlossary.ts` is deleted
- Rule glossary entries carry an **optional** `pdfPage` field; existing
  `label` and `summary` fields unchanged
- The Marvel Legendary Universal Rulebook v23 PDF is hosted on R2 at
  `images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf`
  (kebab-case filename; version-pinned by `v23` — a v24 rulebook is a
  new file, not a mutation)
- PDF deep-links use the RFC 3778 `#page=N` open-parameter syntax;
  anchors use `target="_blank"` and `rel="noopener"` mandatory
- `docs/legendary-universal-rules-v23.md` is the
  authoritative reference for `pdfPage` values; a `pdfPage` entry
  without a confirmable source in the markdown extract must be omitted
  (optional field) rather than guessed

Update `docs/ai/work-packets/WORK_INDEX.md` to flip WP-082 `[ ]` →
`[x]` with the 2026-MM-DD execution date and Commit A hash on
governance-close (Commit B).

Update `docs/ai/execution-checklists/EC_INDEX.md` — EC-107 (to be
allocated at pre-flight) status flips to `Done` on governance-close.

Update `docs/03.1-DATA-SOURCES.md` §Registry Metadata — add schema
reference row and rulebook PDF row.

---

## Acceptance Criteria

- [ ] `packages/registry/src/schema.ts` exports
  `KeywordGlossaryEntrySchema`, `KeywordGlossarySchema`,
  `RuleGlossaryEntrySchema`, `RuleGlossarySchema`, and the inferred
  types `KeywordGlossaryEntry` + `RuleGlossaryEntry`
- [ ] All four schemas are `.strict()` (reject unknown fields)
- [ ] `data/metadata/keywords-full.json` has **123 entries** and every
  entry validates against `KeywordGlossaryEntrySchema` (re-derive the
  count at execution time; update this line if the count drifted from
  the pre-flight baseline)
- [ ] Every keyword entry has a non-empty `label` field matching the
  human-readable name from the rulebook (including punctuation — e.g.,
  `"S.H.I.E.L.D. Clearance"`, not `"Shield Clearance"`)
- [ ] `data/metadata/rules-full.json` has **20 entries** and every
  entry validates against `RuleGlossaryEntrySchema`
- [ ] Both JSON files remain alphabetical by `key`
- [ ] Both JSON files are uploaded to R2 and return HTTP 200 on HEAD
- [ ] The rulebook PDF is uploaded to R2 at
  `images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf`
  and returns HTTP 200 on HEAD with `Content-Type: application/pdf`
- [ ] `apps/registry-viewer/public/registry-config.json` contains
  `"rulebookPdfUrl": "https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf"`
- [ ] `glossaryClient.ts` uses `.safeParse(...)` (not `.parse(...)`);
  invalid payloads log a full-sentence warning and resolve to an empty
  Map (non-blocking)
- [ ] `useGlossary.ts` contains no `titleCase` function or call site
- [ ] `useGlossary.ts` contains no dedup block for duplicate keyword
  keys (uniqueness is a JSON contract, enforced by verification step 4)
- [ ] `glossaryClient.ts` renders Zod issue paths as dot-joined strings
  (or the literal `root` when empty) — default `["0","label"]`-style
  array paths must not appear in the warning text
- [ ] `apps/registry-viewer/CLAUDE.md` contains the sentence
  "Do not infer labels from keys under any circumstance." in the
  Keyword & Rule Glossary section
- [ ] `docs/legendary-universal-rules-v23.md` begins with the
  **Authority Notice** blockquote specified in §A before any heading
- [ ] `GlossaryPanel.vue` renders the `pdfPage` anchor with
  `target="_blank"` and `rel="noopener"` when both `pdfPage` and
  `rulebookPdfUrl` are present; renders nothing when either is absent
- [ ] `docs/legendary-universal-rules-v23.md` exists and
  contains recognizable `## Keyword Abilities` subsection headings
  derived from the PDF TOC
- [ ] No imports of `packages/game-engine/` or `boardgame.io` in any
  changed file
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm -r --if-present test` exits 0 with the pre-flight baseline
  passing count preserved (re-derived at pre-flight time)
- [ ] `git diff --name-only` shows only files listed in
  §"Files Expected to Change"

---

## Verification Steps

```bash
# Step 1 — Zod schemas present and exported
grep -c "KeywordGlossaryEntrySchema" packages/registry/src/schema.ts
# Expected: >= 1

grep -c "RuleGlossaryEntrySchema" packages/registry/src/schema.ts
# Expected: >= 1

grep -c "KeywordGlossary\|RuleGlossary" packages/registry/src/index.ts
# Expected: >= 4 (two schemas + two types re-exported)

# Step 2 — JSON files validate against the schemas
node --input-type=module -e "
import { readFile } from 'node:fs/promises';
import { KeywordGlossarySchema, RuleGlossarySchema } from './packages/registry/dist/index.js';
const kw = JSON.parse(await readFile('data/metadata/keywords-full.json', 'utf8'));
const ru = JSON.parse(await readFile('data/metadata/rules-full.json', 'utf8'));
KeywordGlossarySchema.parse(kw);
RuleGlossarySchema.parse(ru);
console.log('keywords:', kw.length, 'rules:', ru.length);
"
# Expected: "keywords: 123 rules: 20" (or re-derived counts); no Zod errors

# Step 3 — every keyword has a non-empty label
node -e "
const kw = JSON.parse(require('fs').readFileSync('data/metadata/keywords-full.json','utf8'));
const missing = kw.filter(e => !e.label || typeof e.label !== 'string').map(e => e.key);
console.log(missing.length === 0 ? 'OK' : 'MISSING LABELS: ' + missing.join(','));
"
# Expected: OK

# Step 4 — alphabetical and no duplicate keys
node -e "
const kw = JSON.parse(require('fs').readFileSync('data/metadata/keywords-full.json','utf8'));
const keys = kw.map(e => e.key);
const sorted = [...keys].sort();
const inOrder = keys.every((k,i) => k === sorted[i]);
const dups = keys.filter((k,i) => keys.indexOf(k) !== i);
console.log('alphabetical:', inOrder, 'duplicates:', dups.length);
"
# Expected: "alphabetical: true duplicates: 0"

# Step 5 — titleCase is deleted from the viewer
grep -c "titleCase" apps/registry-viewer/src/composables/useGlossary.ts
# Expected: 0

# Step 6 — glossaryClient uses safeParse (not parse)
grep -c "safeParse" apps/registry-viewer/src/lib/glossaryClient.ts
# Expected: >= 2 (one per fetch)

grep -c "\.parse(" apps/registry-viewer/src/lib/glossaryClient.ts
# Expected: 0 (the non-throwing path is mandatory)

# Step 7 — panel renders rel=noopener on the deep-link
grep -c "rel=\"noopener\"" apps/registry-viewer/src/components/GlossaryPanel.vue
# Expected: >= 1

# Step 8 — no game engine / boardgame.io imports in changed files
grep -rE "from ['\"](@legendary-arena/game-engine|boardgame\.io)" \
  apps/registry-viewer/src/lib/glossaryClient.ts \
  apps/registry-viewer/src/composables/useGlossary.ts \
  apps/registry-viewer/src/components/GlossaryPanel.vue
# Expected: no output

# Step 9 — R2 assets reachable
curl -sI https://images.barefootbetters.com/metadata/keywords-full.json | head -1
# Expected: HTTP/2 200

curl -sI https://images.barefootbetters.com/metadata/rules-full.json | head -1
# Expected: HTTP/2 200

curl -sI https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf | head -1
# Expected: HTTP/2 200

curl -sI https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf | \
  grep -i "content-type"
# Expected: content-type: application/pdf

# Step 10 — build and test
pnpm -r build
# Expected: exits 0

pnpm -r --if-present test
# Expected: exits 0; pre-flight baseline passing count preserved

# Step 11 — manual smoke in the registry viewer
#   pnpm --filter registry-viewer dev
#   Open any card with a keyword badge; open the glossary panel.
#   Confirm: display names show spaces/punctuation (e.g.,
#     "Choose a Villain Group", "S.H.I.E.L.D. Clearance").
#   Confirm: keywords with a pdfPage show a clickable rulebook link
#     that opens the PDF in a new tab at the correct page.
#   Confirm: keywords without a pdfPage show no anchor (no broken UI).
#   Confirm: if registry-config.json has rulebookPdfUrl removed,
#     no anchor renders (config-absent fallback).
```

---

## Definition of Done

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm -r --if-present test` exits 0 with baseline passing count preserved
- [ ] Both glossary JSON files in `data/metadata/` validate against
  their Zod schemas and are republished to R2
- [ ] Rulebook PDF is on R2 at the URL above with HTTP 200 on HEAD
- [ ] Registry viewer renders correct labels and working rulebook
  deep-links for entries with `pdfPage`
- [ ] No files outside §"Files Expected to Change" were modified
  (confirmed with `git diff --name-only`)
- [ ] `docs/ai/DECISIONS.md` updated with all items from §Governance
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-082 flipped `[ ]` →
  `[x]` with date + Commit A hash
- [ ] `docs/ai/STATUS.md` updated with the WP-082 completion line
  following the convention used by prior WPs (if
  `docs/ai/STATUS.md` does not exist, the lint gate §1 requirement is
  satisfied via `WORK_INDEX.md` status column per established repo
  convention — confirm at pre-flight)
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has the allocated EC
  (EC-107 at time of drafting; re-confirm at pre-flight) flipped to
  `Done`
- [ ] `docs/03.1-DATA-SOURCES.md` §Registry Metadata updated
- [ ] `apps/registry-viewer/CLAUDE.md` updated
- [ ] Three-commit topology followed: A0 `SPEC:` pre-flight bundle →
  A `EC-107:` execution → B `SPEC:` governance close (commit prefix
  `WP-082:` is forbidden per P6-36)

---

## Amendments

**A-082-01 (2026-04-21, governance-close SPEC bundle):** Three
beyond-allowlist files were landed in Commit A (`3da6ac3`) and are
formalized here. Each was forced by the EC's own locked design
(*"The viewer imports from `@legendary-arena/registry`"*,
§Non-Negotiable Constraints) interacting with Vite's browser-build
semantics. All three are additive and zero-runtime-risk; they extend
the §Files Expected to Change allowlist to match the design as shipped.

1. **`apps/registry-viewer/package.json`** — added
   `"@legendary-arena/registry": "workspace:*"` to `dependencies`.
   The viewer previously had no declared dependency on the workspace
   registry package; its `import` of `KeywordGlossarySchema` /
   `RuleGlossarySchema` was unresolvable without this entry.

2. **`packages/registry/package.json`** — added the `"./schema"`
   subpath to the `exports` map, resolving to
   `./dist/schema.js` / `./dist/schema.d.ts`. Required so the
   viewer's Vite build can import the two schemas without
   transitively pulling `impl/localRegistry.js` (which uses Node-only
   `node:fs/promises` and `node:path`). The barrel import
   (`@legendary-arena/registry`) fails at build time on
   *"`resolve` is not exported by `__vite-browser-external`"* because
   Rollup resolves the import graph before tree-shaking can prune the
   unused Node-only factory. The dedicated subpath export has zero
   Node-module dependencies and sidesteps the issue entirely. Per
   `.claude/rules/registry.md` §Schema Authority, schema.ts remains
   the single source of truth — this amendment only exposes an
   additional *path* to the same file, not a second copy.

3. **`pnpm-lock.yaml`** — 3-line delta, entirely the workspace-link
   entry from (1). No NPM packages added, removed, or
   version-changed. `pnpm install` downloaded zero new packages.

Scope-neutral corrections — no new tests, no new dependencies
(the workspace link is architecturally an intra-monorepo reference,
not a new package), no new export surface beyond the explicit
`KeywordGlossaryEntrySchema` / `KeywordGlossarySchema` /
`RuleGlossaryEntrySchema` / `RuleGlossarySchema` / `KeywordGlossaryEntry`
/ `RuleGlossaryEntry` list already in §Scope (In) §B. `session-context`
§5 "pnpm-lock.yaml expectation: no diff" is superseded by this amendment
— the session-context was authored before the Vite-resolution cascade
surfaced.

**A-082-02 (2026-04-21, governance-close SPEC bundle):** The
RS-3 diff gate at the start of Commit A found `data/metadata/rules-full.json`
in a **content-altering** state, not whitespace-only. A pre-session
rewrite had replaced every `summary` with longer rulebook-verbatim
prose (20 entries, 21 insertions / 21 deletions including the
trailing-newline drop). Per EC §Non-Negotiable *"existing rule `label`
/ `summary` values are byte-for-byte preserved"* and the session-context
§2.2 RS-3 STOP clause, the rewrite was not in scope. Path 1 of the
STOP clause was selected after operator authorization: the working-tree
version was quarantined to `stash@{0}` with message *"WP-082 quarantine:
rules-full.json summary rewrites (rulebook v23 verbatim) — out of
WP-082 scope per EC-107 byte-for-byte guardrail; reclaim in a future
governed WP"*, and the file was reverted to HEAD before Commit A
applied only the optional `pdfPage` backfill. The quarantined content
is recoverable with `git stash show -p stash@{0}`; a future dedicated
WP can reclaim and govern the summary rewrite properly.

**A-082-03 (2026-04-21, governance-close SPEC bundle):** Operator R2
upload step proceeded as documented (EC §Verification Steps 20–22 all
green: PDF HTTP 200 + `Content-Type: application/pdf` + 44,275,000
bytes — matching EC §Assumes byte count exactly; both JSONs HTTP 200
with republished content matching repo). One operator iteration: the
rulebook was initially uploaded as `legendary-universal-rules-v23.md`
at `/docs/`, which would have broken the `#page=N` RFC 3778 §3
deep-link semantics (markdown files don't support page-fragment
navigation in native browser viewers). The operator re-uploaded as
`legendary-universal-rules-v23.pdf` to match the EC-locked URL; the
orphan `.md` file on R2 is decorative and may be deleted at operator
discretion. `Cache-Control: max-age=31536000, immutable` did not
surface in the HEAD response — either Cloudflare strips it in HEAD
or it was not applied at upload. The URL's `v23` version pin makes
this a non-blocker (a future v24 rulebook is a new filename, not a
mutation of this one); worth a check before the next rulebook drop.
Cross-browser smoke tests 24/25 all passed per operator confirmation.
