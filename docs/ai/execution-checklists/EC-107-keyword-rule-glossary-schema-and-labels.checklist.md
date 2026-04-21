# EC-107 — Keyword & Rule Glossary Schema, Labels, and Rulebook Deep-Links (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md`
**Layer:** Registry (`packages/registry/src/schema.ts` + `src/index.ts`) +
Registry Viewer (`apps/registry-viewer/src/**`) + Content / Data
(`data/metadata/`) — **no engine, preplan, server, pg, or boardgame.io**

## Execution Authority

This EC is the authoritative execution checklist for WP-082. Compliance
is binary. Failure to satisfy any item is failed execution. If EC-107
and WP-082 conflict on **design intent**, the WP wins; on **execution
contract** (locked values, guardrails, staging discipline), the EC
wins.

**EC slot note:** EC-107 is the next free slot in the registry-viewer
101+ series after EC-106 (WP-060). Commit prefix is `EC-107:`;
`WP-082:` is rejected by `.githooks/commit-msg` per P6-36.

## Execution Style

Schema + metadata pass. Add two Zod schemas at the registry boundary;
backfill `label` (required, keywords) and `pdfPage` (optional, both
files) into existing JSON; wire Zod `.safeParse(...)` into the viewer
fetch boundary; replace `titleCase()` heuristic with `entry.label`;
render optional rulebook deep-link. Upload the rulebook PDF to R2 as
an operator step. Zero engine / preplan / server / pg / boardgame.io
involvement. Zero `G` mutation. Zero algorithm changes to
`lookupKeyword` / `lookupRule`.

---

## Before Starting (Preconditions — Blocking)

Each is a pass/fail gate.

- [ ] WP-060 / EC-106 complete (`412a31c` + governance close `cd811eb`
      on `main`).
- [ ] HEAD is at `45ddb49` (SPEC: close WP-036 / EC-036 governance) or
      on a fresh `wp-082-keyword-rule-glossary-schema-and-labels`
      branch cut from it.
- [ ] Inherited dirty-tree state matches the `git status` map in the
      WP-082 session-context file (must be authored at pre-flight).
      The following items are **in-scope partial work** and will be
      folded into Commit A of this EC — do NOT stage them separately,
      do NOT revert them, and do NOT treat them as unrelated drift:
  - `data/metadata/keywords-full.json` (M — 10 entries added,
    `label` / `pdfPage` not yet filled)
  - `data/metadata/rules-full.json` (M — verify scope; if only
    whitespace / ordering drift, revert; if content change, surface
    at pre-flight before execution)
  - `docs/Marvel Legendary Universal Rules v23.txt` (untracked —
    `pdftotext -layout` extraction output, 466,882 bytes)
  - `docs/legendary-universal-rules-v23.md` (untracked — 5,262-line
    markdown extract **without** the required Authority Notice;
    prepending the notice is an EC-107 task)
- [ ] All other dirty-tree items from session-context are **out of
      scope** — stage by exact filename only. `git add .` / `git add
      -A` / `git add -u` are forbidden (P6-27 / P6-44).
- [ ] `packages/registry/src/schema.ts` exists and imports `zod` at
      the top (line 29).
- [ ] `packages/registry/src/index.ts` explicitly re-exports
      registry schemas (lines 30–36) — pattern to follow for the new
      glossary schemas.
- [ ] `apps/registry-viewer/src/lib/glossaryClient.ts` exists at HEAD
      (117 lines, singleton shape from EC-106).
- [ ] `apps/registry-viewer/src/composables/useGlossary.ts` exists at
      HEAD (223 lines) with `titleCase()` at lines 94–100 and the
      dedup block at lines 52–55.
- [ ] `apps/registry-viewer/src/composables/useRules.ts` exists at
      HEAD with `setGlossaries` / `getKeywordGlossaryMap` /
      `getRuleGlossaryMap` exports (EC-106 contract).
- [ ] `apps/registry-viewer/src/components/GlossaryPanel.vue` exists
      at HEAD with the `<li>` entry block at lines 127–141 — the
      `pdfPage` anchor renders inside this block.
- [ ] `apps/registry-viewer/src/App.vue` has the glossary-load block
      in `onMounted` (lines 170–183 at HEAD) — **no App.vue change
      is required by this EC** (rulebookPdfUrl plumbing uses the
      already-loaded `config` object at line 149).
- [ ] `apps/registry-viewer/public/registry-config.json` exists (10
      lines at HEAD) and contains `metadataBaseUrl` but not
      `rulebookPdfUrl`.
- [ ] `docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf`
      exists locally at working-directory-relative path (44,275,000
      bytes, 91-page rulebook).
- [ ] R2 credentials are available to the executor with write access
      to `images.barefootbetters.com`. If not, STOP and escalate
      before beginning edits — do NOT produce a half-migrated commit
      that ships `rulebookPdfUrl` without the matching PDF artifact.
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm -r --if-present test` exits 0 at the WP-082 starting
      commit (re-derive the baseline passing count at pre-flight —
      record here; baseline must hold through execution).

If any precondition fails, STOP and ask before proceeding.

---

## Locked Values (Do Not Re-Derive)

### Entry counts — exact

- `data/metadata/keywords-full.json` = **123 entries** (working-tree
  value at 2026-04-21; re-confirm at pre-flight with `node -e "const
  k=JSON.parse(require('fs').readFileSync('data/metadata/keywords-full.json','utf8')); console.log(k.length)"`)
- `data/metadata/rules-full.json` = **20 entries** (unchanged from
  EC-106 baseline)
- If either count drifts at execution start, STOP and ask before
  proceeding. Counts are **not re-negotiable inside the session**.

### Zod schemas — exact shape

In `packages/registry/src/schema.ts`, append (after existing registry
schemas, import for `z` already present at line 29):

```ts
// why: Keyword and Rule glossary entries are intentionally separate
// schemas. The description/summary distinction is semantic (one
// defines an ability, the other states a rule). Duplicating the
// shared fields keeps semantics explicit at the registry boundary
// and avoids a future contributor extracting a base shape that
// blurs that distinction.
export const KeywordGlossaryEntrySchema = z.object({
  key:         z.string().min(1),
  label:       z.string().min(1),
  description: z.string().min(1),
  pdfPage:     z.number().int().min(1).optional(),
}).strict();

export const RuleGlossaryEntrySchema = z.object({
  key:     z.string().min(1),
  label:   z.string().min(1),
  summary: z.string().min(1),
  pdfPage: z.number().int().min(1).optional(),
}).strict();

export const KeywordGlossarySchema = z.array(KeywordGlossaryEntrySchema);
export const RuleGlossarySchema    = z.array(RuleGlossaryEntrySchema);

export type KeywordGlossaryEntry = z.infer<typeof KeywordGlossaryEntrySchema>;
export type RuleGlossaryEntry    = z.infer<typeof RuleGlossaryEntrySchema>;
```

`.strict()` is mandatory on both entry schemas — rejecting unknown
fields forces a governed extension path for future additions.

### Registry re-exports — exact lines

In `packages/registry/src/index.ts`, extend the existing
`export { ... } from "./schema.js";` block (currently lines 30–36)
to include the four new schema names, and add a parallel
`export type { ... }` block for the two new types:

```ts
// Schema (for external validation use)
export {
  SetDataSchema,
  SetIndexEntrySchema,
  HeroCardSchema,
  HeroClassSchema,
  CardQuerySchema,
  KeywordGlossaryEntrySchema,
  KeywordGlossarySchema,
  RuleGlossaryEntrySchema,
  RuleGlossarySchema,
} from "./schema.js";

export type {
  KeywordGlossaryEntry,
  RuleGlossaryEntry,
} from "./schema.js";
```

No barrel re-export. No `import *`. Explicit named re-export only,
mirroring the existing style.

### Authority Notice — exact shape

The first lines of `docs/legendary-universal-rules-v23.md` (before
any `#` heading) must contain this blockquote **verbatim**:

```markdown
> **Authority Notice:** This file is the authoritative source for all
> `pdfPage` values in glossary metadata. Page numbers must not be
> inferred from the PDF alone.
```

The existing file already has a longer preamble (`Source PDF: ...`);
prepend the Authority Notice as the **first** block before that
preamble. Do not merge into the existing blockquote — the Authority
Notice is a distinct block so a future `grep -A 2 "Authority Notice"`
returns this text without the extraction-method noise.

### Config field — exact shape

In `apps/registry-viewer/public/registry-config.json`, add the new
field between `metadataBaseUrl` and `eagerLoad`:

```json
{
  "metadataBaseUrl": "https://images.barefootbetters.com",
  "rulebookPdfUrl":  "https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf",
  "eagerLoad": [
    "core", "dkcy", "ff04", ...
  ]
}
```

The `rulebookPdfUrl` value is byte-for-byte
`https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf`
— kebab-case filename, no spaces, no parentheses, version-pinned by
`v23`.

### Zod validation in `glossaryClient.ts` — exact path

In `apps/registry-viewer/src/lib/glossaryClient.ts`, after
`response.json()` (currently at lines 46 / 87 at HEAD), replace the
inline `as Array<{...}>` cast with schema-validated parsing. Use
**`.safeParse(...)`** (non-throwing) — `.parse(...)` is forbidden.

Issue-path rendering is locked to this exact shape:

```ts
const result = KeywordGlossarySchema.safeParse(rawPayload);
if (!result.success) {
  const issue = result.error.issues[0];
  const path  = issue.path.length > 0 ? issue.path.join(".") : "root";
  // why: dot-joined path keeps viewer logs operator-readable without
  // Zod fluency; default ["0","label"]-style array paths are noisy.
  console.warn(
    `[Glossary] Rejected keywords-full.json from ${url}: ${path} — ${issue.message}. ` +
    `Panel will show no entries until data is corrected.`,
  );
  return new Map();
}
const entries = result.data;
```

Apply the identical pattern for `rules-full.json` with
`RuleGlossarySchema`. The warning sentence must:
- Start with `[Glossary]`
- Name the file (`keywords-full.json` or `rules-full.json`)
- Include the URL
- Include the dot-joined path or `root`
- Include `issue.message`
- End with the full-sentence hint about the panel state
- Be logged via `console.warn(...)` (not `devLog` — this is an
  operator-visible diagnostic, not a categorical dev log)

Fallback on failure: resolve the IIFE to `new Map()` and continue.
Do NOT throw from the fetch boundary — the caller in `App.vue`
already wraps the call in try/catch for network errors only; schema
failures must not escape as exceptions.

### `useGlossary.ts` — exact edits

1. **Delete `titleCase()` entirely** — current function body at
   `useGlossary.ts:94–100` and its two call sites at lines 60 and 71.
2. **Keyword entries use `entry.label` directly.** Because
   `getKeywordGlossaryMap()` returns `Map<string, string>` (value is
   the description), the type must change. Two options — choose (a):

   **(a) Widen the keyword Map to carry the label** (preferred):
   Update `glossaryClient.ts` so the keyword IIFE builds
   `Map<string, { label: string; description: string }>` from the
   validated `entries`. Update `useRules.ts` types + `setGlossaries`
   signature + `lookupKeyword` body to read `.description` from the
   new value shape. The 40-line `lookupKeyword` matcher stays
   byte-for-byte — only the `.get(...)` return shape changes, which
   collapses to a one-line `.description` access inside the existing
   branches. **`lookupKeyword`'s algorithmic branching (exact /
   space-hyphen-stripped / prefix / suffix / substring) is
   preserved.**

   **(b) Read `label` via a second lookup Map** (fallback if (a)
   cascades): new `Map<string, string>` keyed by `key → label` on the
   `glossaryClient` side; new `getKeywordLabelMap()` getter in
   `useRules.ts`; `useGlossary.ts` consults it for display text.
   **Only use (b) if (a) surfaces a typecheck issue at execution
   time that cannot be resolved with a one-line widening.**

   Locked at pre-flight: **option (a)**. Option (b) requires a
   DECISIONS.md entry before adoption.

3. **Delete the dedup block** at `useGlossary.ts:52–55`:

   ```ts
   // why: some keywords appear twice in the map (villainousweapons). Skip duplicates.
   if (entries.some((existingEntry) => existingEntry.id === `keyword-${key}`)) {
     continue;
   }
   ```

   Uniqueness is a JSON contract (verification step 4 asserts
   duplicate-free); runtime dedup is forbidden defensive programming.

4. **Keep `HERO_CLASS_GLOSSARY` `titleCase` path.** Wait — with
   `titleCase()` deleted, the hero-class branch at `useGlossary.ts:66–74`
   must switch to a hard-coded label source. Add a parallel
   `HERO_CLASS_LABELS: Map<string, string>` constant in `useRules.ts`
   with the 5 entries (`"Covert"`, `"Instinct"`, `"Ranged"`,
   `"Strength"`, `"Tech"`) and export it. The hero-class loop in
   `buildAllEntries()` reads `HERO_CLASS_LABELS.get(key) ?? key` for
   the display label. **Do not reintroduce any string-transformation
   helper.** The whole point of this WP is eliminating label
   inference — hero-class labels are trivial capitalization and must
   be listed explicitly.

### `GlossaryPanel.vue` — exact anchor shape

Inside the existing `<li>` entry block at
`GlossaryPanel.vue:127–141`, after the `<div class="entry-description">`
(currently line 140), add a conditional anchor block:

```html
<a
  v-if="entry.pdfPage !== undefined && rulebookPdfUrl"
  :href="`${rulebookPdfUrl}#page=${entry.pdfPage}`"
  target="_blank"
  rel="noopener"
  class="entry-rulebook-link"
  @click.stop
>
  📖 Rulebook p. {{ entry.pdfPage }}
</a>
```

The `@click.stop` is mandatory — prevents the parent `<li @click>`
handler from also triggering `scrollToEntry`.

`target="_blank"` + `rel="noopener"` are both mandatory (security:
`rel="noopener"` prevents `window.opener` leakage; enabling it is
why the blank-target is acceptable).

**Props plumbing:** Extend the `GlossaryEntry` interface in
`useGlossary.ts` with `pdfPage?: number`. Populate from the widened
keyword value (option (a) above) for keyword entries, and from
`ruleEntry.pdfPage` for rule entries (new optional field on
`RuleEntry` in `useRules.ts`). Pass `rulebookPdfUrl` into the panel
either as a prop on `<GlossaryPanel />` or via the `useGlossary`
composable return — **prop pattern preferred** (mirrors
`registry-config.json` plumbing through `App.vue`, identical shape
to how the panel receives other config). The App.vue change is one
line: `<GlossaryPanel :rulebook-pdf-url="rulebookPdfUrl" />` where
`rulebookPdfUrl` is a `ref<string | null>(null)` populated from
`config.rulebookPdfUrl ?? null` inside `onMounted` (line 150 area).

### `rulebookPdfUrl` absence semantics — lock

When `rulebookPdfUrl` is **absent** from `registry-config.json` (or
the ref is `null`), the anchor is silently omitted. **No warning,
banner, or console message.** This is a supported configuration, not
an error state. Do NOT add a "helpful" fallback UI under any
circumstance — the whole anchor block hinges on `&& rulebookPdfUrl`
evaluating truthy, and the `null` default in App.vue satisfies this
cleanly.

### R2 artifacts — exact URLs and headers

1. **Rulebook PDF** (new upload):
   - URL: `https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf`
   - Source: `docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf`
   - `Content-Type: application/pdf`
   - `Cache-Control: max-age=31536000, immutable` (version-pinned by
     `v23`; a v24 rulebook is a **new file**, not a mutation)
   - Verify with `curl -sI` returning HTTP/2 200 and matching
     `Content-Type` before Commit A lands.

2. **Republished glossary JSONs** (overwrite existing):
   - `https://images.barefootbetters.com/metadata/keywords-full.json`
   - `https://images.barefootbetters.com/metadata/rules-full.json`
   - Cache headers: same as EC-106 (`max-age=3600` per the
     WP-042 r2-data-checklist convention for JSON files — re-confirm
     at pre-flight; if EC-106 used a different value, match EC-106)
   - Verify with `curl -sI` returning HTTP/2 200 before Commit B.

### Commit prefix

`EC-107:` on the execution commit. `SPEC:` on the pre-flight bundle
(A0) and governance close (B). `WP-082:` is **forbidden** — the
commit-msg hook at `.githooks/commit-msg` rejects it per P6-36.
Subject lines containing `WIP` / `misc` / `tmp` / `updates` /
`changes` / `debug` / `fix stuff` are also rejected. Subject must be
≥ 12 characters of substantive summary.

### Three-commit topology

1. **A0 `SPEC:`** — pre-flight bundle: WP-082 amendments (if any
   surface at pre-flight) + this EC file + `EC_INDEX.md` row +
   updated pre-flight verdict + session prompt. Must land before
   Commit A. Stages only governance artifacts.
2. **A `EC-107:`** — execution: schema additions + index re-exports
   + JSON backfill + viewer code changes + markdown extract
   (with Authority Notice) + text extraction source + viewer
   `CLAUDE.md` + `docs/03.1-DATA-SOURCES.md`. R2 upload of the PDF
   and the republished JSON files are **separate operator steps**
   performed between the code commit and verification — NOT `git`
   actions.
3. **B `SPEC:`** — governance close: `STATUS.md` (if exists) +
   `WORK_INDEX.md` (flip WP-082 `[ ]` → `[x]` with date + Commit A
   hash) + `EC_INDEX.md` (EC-107 → `Done`) + DECISIONS.md entries.

### 01.6 post-mortem disposition

Evaluate each trigger explicitly:

- **New long-lived abstraction?** `KeywordGlossaryEntrySchema` +
  `RuleGlossaryEntrySchema` are **new instances of an existing
  abstraction** (Zod entry schemas in `schema.ts` — `HeroCardSchema`,
  `SetIndexEntrySchema`, etc. already follow this pattern). Not
  triggered.
- **New code category?** No — `packages/registry/src/schema.ts` is
  pre-classified.
- **New contract consumed by engine / other packages?** No — the
  new schemas are consumed only by the viewer. Engine, server,
  preplan, arena-client do not import them.
- **New setup artifact in `G`?** No — zero engine involvement.
- **Novel keyboard / interaction pattern?** No — the new anchor
  uses standard `<a href target="_blank" rel="noopener">`, which is
  already used elsewhere in the viewer.

**Disposition: NOT TRIGGERED. 01.6 post-mortem is NOT required.**
Matches EC-106 precedent (theme/glossary data-migration class). If
execution surfaces any finding that *would* trigger a post-mortem
(e.g., option (b) from `useGlossary.ts` edits is adopted mid-session
and a genuinely new abstraction is introduced), re-evaluate and
author one.

### 01.5 runtime-wiring allowance

**NOT INVOKED as an engine-contract clause** (no `LegendaryGameState`
field, no `buildInitialGameState` change, no `LegendaryGame.moves`
entry, no phase hook). The viewer analog **is invoked** for the
`GlossaryEntry` interface extension (new `pdfPage?: number` field) —
cite in the execution summary.

---

## Guardrails (Non-Negotiable)

- **No imports from `packages/game-engine/`, `packages/preplan/`,
  `apps/server/`, `pg`, or `boardgame.io`** in any changed file.
  Registry + Viewer layers only.
- **No changes to `lookupKeyword` / `lookupRule` algorithmic bodies.**
  Only the read path (value shape in the backing Map) changes. See
  §Locked Values `useGlossary.ts` edits option (a).
- **No touching function/type signatures** of `lookupKeyword`,
  `lookupRule`, `lookupHeroClass`, `parseAbilityText`,
  `AbilityToken`, `TokenType`. `CardDetail.vue` depends on all of
  them.
- **`HERO_CLASS_GLOSSARY` content preserved verbatim** (5 entries).
  A new `HERO_CLASS_LABELS` Map is authorized (see §Locked Values),
  but the `_GLOSSARY` description text is untouched.
- **Zod schemas live only in `packages/registry/src/schema.ts`.** No
  schema declarations anywhere else (per `.claude/rules/registry.md`
  §Schema Authority). The viewer imports from
  `@legendary-arena/registry`.
- **`.strict()` is mandatory** on both entry schemas.
- **No `.parse(...)` at the fetch boundary** — `.safeParse(...)` only.
  `.parse` is the throwing path and is forbidden in `glossaryClient.ts`.
- **No new Zod schemas for hero-class data** (`HERO_CLASS_GLOSSARY`
  is 5 hardcoded entries, not a fetched resource).
- **No content changes** to existing `description` / `label` /
  `summary` strings. `label` is a **new** field on keyword entries;
  existing rule `label` / `summary` values are byte-for-byte preserved.
- **No guessed `pdfPage` values.** Every `pdfPage` must trace to a
  specific `page N` marker in `docs/legendary-universal-rules-v23.md`.
  When no confirmable source exists, **omit the field** — do NOT fill
  with a best guess.
- **No new keyword or rule entries.** Counts locked at 123 / 20 for
  this WP. If the count drifts at execution start, STOP.
- **No token-markup transformation** inside the JSON (`[icon:X]`,
  `[hc:X]`, `[keyword:N]`, `[rule:N]` preserved verbatim in all
  `description` and `summary` fields).
- **No fallback UI** when `rulebookPdfUrl` is absent — see §Locked
  Values "absence semantics."
- **No inline PDF viewer embed** — deep-links open in a new tab in
  the browser's native PDF viewer. No PDF.js bundle.
- **No staging of out-of-scope dirty-tree items** — the five
  in-scope partial-work files listed in §Before Starting are the
  only pre-existing modifications that may be folded into Commit A.
- **Never use `--no-verify` or `--no-gpg-sign`** — commit-msg hook
  must pass on its merits.
- **Never push to remote** unless explicitly asked.
- **Baseline invariance:** `pnpm -r --if-present test` must exit 0
  with the pre-flight baseline preserved. No new test file is
  required by WP-082.
- **R2 operations require R2 credentials.** If authentication fails,
  STOP and escalate. Do NOT commit half-migrated state.

---

## Required `// why:` Comments

- `packages/registry/src/schema.ts` — one `// why:` block directly
  above the two new entry schemas explaining that they are
  intentionally separate rather than sharing a base (verbatim text
  in §Locked Values "Zod schemas").
- `apps/registry-viewer/src/lib/glossaryClient.ts` — one `// why:`
  on the dot-joined path rendering explaining that Zod default
  array paths are noisy for operator logs (verbatim text in
  §Locked Values "Zod validation").
- `apps/registry-viewer/src/lib/glossaryClient.ts` — preserve every
  existing `// why:` comment (singleton cache rationale at lines 24–25;
  throw-for-App.vue-catch rationale at lines 62–63 / 105–106).
- `apps/registry-viewer/src/composables/useRules.ts` — one `// why:`
  on the new `HERO_CLASS_LABELS` Map explaining that display labels
  for hero classes are enumerated explicitly rather than derived, so
  no future contributor reintroduces a `titleCase`-style helper.
- `apps/registry-viewer/src/composables/useGlossary.ts` — preserve
  the existing alphabetical-order `// why:` at line 76; delete the
  dedup `// why:` at line 52 along with the block it annotates.
- `apps/registry-viewer/src/components/GlossaryPanel.vue` — one
  `// why:` on the `@click.stop` modifier explaining that it
  prevents the parent `<li @click>` from firing `scrollToEntry` when
  the rulebook link is clicked.
- `apps/registry-viewer/src/App.vue` — one `// why:` on the new
  `rulebookPdfUrl` ref explaining that `config.rulebookPdfUrl ??
  null` is the supported absence path (the anchor template already
  guards against `null` / `undefined`), so missing config is silent.

---

## Files to Produce

Exact files. Anything outside this list is out of scope.

- `packages/registry/src/schema.ts` — **modified** — append the four
  new schemas + two inferred types per §Locked Values
- `packages/registry/src/index.ts` — **modified** — extend the
  `export { ... } from "./schema.js";` block with the four schemas
  and add a parallel `export type { ... }` block for the two types
- `data/metadata/keywords-full.json` — **modified** — add required
  `label` + optional `pdfPage` to all 123 entries; preserve
  `description` byte-for-byte; remain alphabetical by `key`; no
  duplicate keys
- `data/metadata/rules-full.json` — **modified** — add optional
  `pdfPage` to entries where determinable; preserve existing
  `label` and `summary` byte-for-byte; remain alphabetical by `key`;
  no duplicate keys
- `apps/registry-viewer/public/registry-config.json` — **modified** —
  add `rulebookPdfUrl` field (exact URL in §Locked Values)
- `apps/registry-viewer/src/lib/glossaryClient.ts` — **modified** —
  import `KeywordGlossarySchema` + `RuleGlossarySchema` from
  `@legendary-arena/registry`; replace inline `as Array<{...}>` casts
  with `.safeParse(...)` validation; use dot-joined issue-path
  rendering; widen keyword value shape to `{ label, description }`
  per option (a); on schema failure, `console.warn` + return empty
  Map (non-blocking)
- `apps/registry-viewer/src/composables/useRules.ts` — **modified** —
  update `KeywordGlossary` / `setGlossaries` / `getKeywordGlossaryMap`
  / `lookupKeyword` to handle the widened value shape; add
  `HERO_CLASS_LABELS` export; optionally widen `RuleEntry` with
  `pdfPage?: number` (required for the panel anchor to reach rule
  entries); preserve every existing `// why:` comment in
  `lookupKeyword` / `lookupRule` verbatim
- `apps/registry-viewer/src/composables/useGlossary.ts` — **modified** —
  delete `titleCase()` function + both call sites; delete dedup
  block (lines 52–55); read keyword labels from the widened Map
  value; read hero-class labels from `HERO_CLASS_LABELS`; extend
  `GlossaryEntry` with `pdfPage?: number`; populate from the two
  underlying Maps
- `apps/registry-viewer/src/components/GlossaryPanel.vue` — **modified** —
  accept `rulebookPdfUrl` prop; render conditional anchor per
  §Locked Values (`@click.stop`, `target="_blank"`, `rel="noopener"`);
  reuse existing panel class names or add one minimal
  `.entry-rulebook-link` rule in the scoped `<style>` block
- `apps/registry-viewer/src/App.vue` — **modified** — one `ref` for
  `rulebookPdfUrl` populated from `config.rulebookPdfUrl ?? null`
  inside the existing `onMounted` try block; one prop on
  `<GlossaryPanel />` passing `rulebookPdfUrl`. No other App.vue
  edit is permitted.
- `docs/legendary-universal-rules-v23.md` — **modified** (currently
  untracked at pre-flight) — prepend the Authority Notice
  blockquote per §Locked Values; the rest of the file is left as-is
  (5,262 lines of `pdftotext -layout` output already authored)
- `docs/Marvel Legendary Universal Rules v23.txt` — **new in the
  commit** (currently untracked at pre-flight) — raw `pdftotext
  -layout` output; not referenced by runtime code; committed as the
  reproducible source for the markdown extract
- `apps/registry-viewer/CLAUDE.md` — **modified** — extend the
  "Keyword & Rule Glossary" section: mention Zod validation at
  fetch, the `label` field, the `pdfPage` deep-link; include the
  sentence **"Do not infer labels from keys under any
  circumstance."** verbatim
- `docs/03.1-DATA-SOURCES.md` — **modified** — add schema reference
  row and rulebook PDF row under §Registry Metadata
- `docs/ai/DECISIONS.md` — **modified** — add the six decisions per
  WP-082 §Governance
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (Commit B) —
  flip WP-082 `[ ]` → `[x]` with date + Commit A hash
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (Commit
  A0) — add EC-107 row; flipped to `Done` in Commit B
- `docs/ai/execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md`
  — **this file** (lands in Commit A0)

---

## Out of Scope (Do NOT Expand)

- **No changes to `packages/game-engine/`, `packages/preplan/`,
  `packages/vue-sfc-loader/`, `apps/server/`, `apps/arena-client/`,
  `apps/replay-producer/`, or any file under `content/themes/`.**
- **No Zod schema for `HERO_CLASS_GLOSSARY`** (5 hardcoded entries,
  not a fetched resource).
- **No Zod schemas elsewhere than `packages/registry/src/schema.ts`.**
- **No migration of other metadata files** (`sets.json`,
  `themes/*`, `card-types.json`) — out of scope.
- **No `Select-String`-level search for stale 113 references** — the
  count moved to 123 in working-tree pre-state; the EC-106 baseline
  is historical context only.
- **No inline PDF viewer embed** — `#page=N` deep-link opens the
  browser's native viewer in a new tab.
- **No fallback-link UI** when `rulebookPdfUrl` is missing.
- **No database or `load_legendary_data.mjs` changes** — glossary
  data is display-only, not engine input.
- **No new test frameworks.** Any tests use `node:test` only. If
  tests are authored for the new schemas (optional — mirror
  `theme.validate.ts` precedent), they live under
  `packages/registry/src/` with one `describe()` per file.
- **No new test infrastructure** (no `vue-sfc-loader` changes, no
  `jsdom` setup).
- **No mid-execution refactoring of `lookupKeyword` / `lookupRule`**
  beyond the one-line `.description` access adjustment required by
  option (a). If a simplification seems attractive, STOP — it is
  forbidden by the §Locked Values preservation rule.
- **No simplification or reformatting of existing `// why:` comments.**
- **No rewriting of `buildAllEntries()` beyond the label-source
  retarget + dedup removal.** The two-level `for` loop structure and
  the alphabetical-per-type sort at lines 77–85 are preserved.
- **No widening of the keyword Map value past `{ label, description }`**
  (e.g., adding `pdfPage` to the Map value). The `pdfPage` flows
  through the `GlossaryEntry` interface, not through the
  `useRules.ts` backing Map. Keeping `useRules.ts` value minimal
  avoids a second migration if we later decide to expose `pdfPage`
  in tooltips.
- **No new `devLog` categories.** Schema failures use `console.warn`
  directly — they are operator-visible diagnostics, not dev-mode
  categorical traces.
- **No staging of any pre-existing untracked file or modified doc
  outside the five in-scope partial-work items** — see §Before
  Starting.

---

## Verification Steps (Run In Order; All Must Pass)

```bash
# 1. Dependencies up to date
pnpm install --frozen-lockfile
# expect: exits 0, pnpm-lock.yaml unchanged

# 2. Typecheck — all packages
pnpm -r --if-present typecheck
# expect: exits 0

# 3. Lint viewer — warning budget inherits EC-105 baseline
pnpm --filter registry-viewer lint
# expect: 0 errors; warnings ≤ 180

# 4. Build all
pnpm -r build
# expect: exits 0

# 5. Test baseline preserved
pnpm -r --if-present test
# expect: pre-flight baseline passing / 0 failing (record at pre-flight)

# 6. New schemas present and exported
grep -c "KeywordGlossaryEntrySchema\|KeywordGlossarySchema\|RuleGlossaryEntrySchema\|RuleGlossarySchema" \
  packages/registry/src/schema.ts
# expect: >= 4

grep -c "KeywordGlossaryEntrySchema\|KeywordGlossarySchema\|RuleGlossaryEntrySchema\|RuleGlossarySchema\|KeywordGlossaryEntry\|RuleGlossaryEntry" \
  packages/registry/src/index.ts
# expect: >= 6 (four schemas + two types)

grep -c ".strict()" packages/registry/src/schema.ts
# expect: >= 2 (both new entry schemas)

# 7. JSON files validate against the schemas + entry counts match
node --input-type=module -e "
import { readFile } from 'node:fs/promises';
import { KeywordGlossarySchema, RuleGlossarySchema } from './packages/registry/dist/index.js';
const kw = JSON.parse(await readFile('data/metadata/keywords-full.json', 'utf8'));
const ru = JSON.parse(await readFile('data/metadata/rules-full.json', 'utf8'));
KeywordGlossarySchema.parse(kw);
RuleGlossarySchema.parse(ru);
console.log('keywords:', kw.length, 'rules:', ru.length);
"
# expect: 'keywords: 123 rules: 20' (or re-derived pre-flight counts); no Zod errors

# 8. Every keyword has a non-empty label
node -e "
const kw = JSON.parse(require('fs').readFileSync('data/metadata/keywords-full.json','utf8'));
const missing = kw.filter(e => !e.label || typeof e.label !== 'string').map(e => e.key);
console.log(missing.length === 0 ? 'OK' : 'MISSING LABELS: ' + missing.join(','));
"
# expect: OK

# 9. Alphabetical order + no duplicate keys (both files)
node -e "
for (const f of ['data/metadata/keywords-full.json','data/metadata/rules-full.json']) {
  const arr = JSON.parse(require('fs').readFileSync(f,'utf8'));
  const keys = arr.map(e => e.key);
  const sorted = [...keys].sort((a,b) => a.localeCompare(b));
  const inOrder = keys.every((k,i) => k === sorted[i]);
  const dups = keys.filter((k,i) => keys.indexOf(k) !== i);
  console.log(f, 'alphabetical:', inOrder, 'duplicates:', dups.length);
}
"
# expect: both files 'alphabetical: true duplicates: 0'

# 10. titleCase is deleted from the viewer
grep -c "titleCase" apps/registry-viewer/src/composables/useGlossary.ts
# expect: 0

grep -c "titleCase" apps/registry-viewer/src/
# expect: 0 (or confirm any remaining hit is an unrelated test fixture)

# 11. Dedup block is deleted from useGlossary.ts
grep -c "some keywords appear twice in the map" apps/registry-viewer/src/composables/useGlossary.ts
# expect: 0

# 12. glossaryClient uses safeParse, not parse
grep -c "safeParse" apps/registry-viewer/src/lib/glossaryClient.ts
# expect: >= 2 (one per fetch)

grep -cE "\\.parse\\(" apps/registry-viewer/src/lib/glossaryClient.ts
# expect: 0 — .parse throws, and the fetch boundary must stay non-blocking

# 13. Dot-joined issue path rendering present
grep -c "issue.path.join" apps/registry-viewer/src/lib/glossaryClient.ts
# expect: >= 2 (one per fetch branch, or one shared helper)

# 14. GlossaryPanel anchor present with required attrs
grep -c 'rel="noopener"' apps/registry-viewer/src/components/GlossaryPanel.vue
# expect: >= 1

grep -c 'target="_blank"' apps/registry-viewer/src/components/GlossaryPanel.vue
# expect: >= 1

grep -c '@click.stop' apps/registry-viewer/src/components/GlossaryPanel.vue
# expect: >= 1

# 15. lookupKeyword algorithmic branching preserved
grep -cE "(Suffix match|Substring match|Prefix match|space-hyphen)" \
  apps/registry-viewer/src/composables/useRules.ts
# expect: >= 3 (EC-106 preservation invariant holds — byte-for-byte modulo identifier)

# 16. No engine / boardgame.io / preplan / server / pg imports in touched viewer files
grep -rE "from ['\"](@legendary-arena/(game-engine|preplan|server)|boardgame\\.io|pg)" \
  apps/registry-viewer/src/lib/glossaryClient.ts \
  apps/registry-viewer/src/composables/useGlossary.ts \
  apps/registry-viewer/src/composables/useRules.ts \
  apps/registry-viewer/src/components/GlossaryPanel.vue \
  apps/registry-viewer/src/App.vue
# expect: no output

# 17. registry-config.json has rulebookPdfUrl
grep -c "rulebookPdfUrl" apps/registry-viewer/public/registry-config.json
# expect: 1

# 18. Markdown extract has Authority Notice as the first block
head -3 docs/legendary-universal-rules-v23.md | grep -c "Authority Notice"
# expect: 1

# 19. CLAUDE.md has the locked sentence
grep -c "Do not infer labels from keys under any circumstance" \
  apps/registry-viewer/CLAUDE.md
# expect: 1

# 20. R2 PDF reachable after operator upload
curl -sI https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf | head -1
# expect: HTTP/2 200

curl -sI https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf | \
  grep -i "^content-type:"
# expect: content-type: application/pdf

# 21. R2 glossary JSONs reachable after operator upload (republished)
curl -sI https://images.barefootbetters.com/metadata/keywords-full.json | head -1
# expect: HTTP/2 200

curl -sI https://images.barefootbetters.com/metadata/rules-full.json | head -1
# expect: HTTP/2 200

# 22. R2 content matches repo (republished JSON is not stale)
curl -s https://images.barefootbetters.com/metadata/keywords-full.json | \
  node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ const a=JSON.parse(d); console.log('R2 keywords:', a.length, 'has label:', a.filter(e=>e.label).length); })"
# expect: R2 keywords: 123 has label: 123

# 23. Files outside allowlist not modified
git diff --name-only
# expect: only files from §Files to Produce (plus EC_INDEX / WORK_INDEX
# / STATUS on their respective commits)
```

### Manual DEV smoke test

```bash
pnpm --filter registry-viewer dev
```

- 24a. Visit `http://localhost:5173/`. Console shows
       `[glossary] load start` → `[glossary] load complete` events.
       No `[Glossary] Rejected ...` warnings.
- 24b. Open the Rules Glossary panel (Ctrl+K). Entry count matches
       123 keywords + 20 rules + 5 hero classes = **148**. Display
       names reflect rulebook capitalization — in particular:
       - `"Choose a Villain Group"` (not `"Chooseavillaingroup"`)
       - `"S.H.I.E.L.D. Clearance"` (not `"Shieldclearance"`)
       - `"Grey Heroes"` (not `"Greyheroes"`)
       - `"Half-Points"` (per rulebook capitalization)
       All five were failures under the old `titleCase()` heuristic;
       all five must render correctly here.
- 24c. Scroll to an entry with a `pdfPage` (e.g., a keyword
       definitely present in the rulebook). Confirm:
       - `"📖 Rulebook p. N"` link visible below the description
       - Clicking it opens a new tab to the PDF at the correct page
       - The parent `<li>` does NOT also scroll (the `@click.stop`
         modifier is working)
- 24d. Scroll to an entry **without** `pdfPage`. Confirm no anchor
       renders, no broken link, no placeholder.
- 24e. (Negative test) Edit `public/registry-config.json`
       temporarily to remove the `rulebookPdfUrl` field. Reload.
       Confirm:
       - No anchor renders on ANY entry (config-absent fallback)
       - No warning / banner / console message
       - Card view still functional
       Revert the config edit.
- 24f. (Negative test) Serve a corrupted `keywords-full.json` (e.g.,
       delete the `label` field from one entry in `data/metadata/`,
       restart dev server which serves it from disk). Confirm:
       - Exactly one `console.warn` matching
         `[Glossary] Rejected keywords-full.json from <url>: 17.label — ...`
         (or the equivalent index/path)
       - The glossary panel shows 0 keyword entries (rules + hero
         classes still present)
       - No exception thrown in the console
       Revert the corruption.
- 24g. Hover a `[keyword:Berserk]` / `[rule:shards]` badge on any
       hero card. Tooltip text matches rulebook definitions —
       `lookupKeyword` / `lookupRule` algorithms preserved.
       **Failure here means EC-106 algorithmic preservation was
       violated by option (a) — STOP.**
- 24h. Hover `[hc:covert]` / `[hc:instinct]` / `[hc:ranged]` /
       `[hc:strength]` / `[hc:tech]`. Tooltips show descriptions
       (hardcoded path unchanged).

### Manual PROD smoke test

```bash
pnpm --filter registry-viewer build
pnpm --filter registry-viewer preview
```

- 25a. Visit `http://localhost:4173/`. Repeat 24a–24d + 24g–24h
       against the production bundle. All must pass.
- 25b. DevTools → Network → confirm exactly three glossary-related
       fetches: `keywords-full.json`, `rules-full.json`, and
       `registry-config.json`. No duplicate glossary fetches
       (singleton pattern honoured from EC-106).
- 25c. Click a rulebook link. Browser opens the PDF from R2 (not
       localhost) at the correct page. New tab; no `opener`
       reference on the new window (DevTools console in the PDF tab:
       `window.opener === null`).
- 25d. **(Added 2026-04-21 in A0 per 01.7 copilot check RISK FIX #3 — Issue #27 Implicit Content Semantics.)** Validate `#page=N` deep-link behavior in at least one **Firefox** and one **Safari** instance, not only the primary dev browser. Expected: both browsers' native PDF viewers honour the fragment and open to the correct page. Acceptable variance: mobile in-app browsers (e.g., embedded WebViews) may fall back to page 1 — that is documented UX drift, not a defect. If any **desktop** Firefox or Safari version in the last two major releases fails to honour `#page=N`, STOP and escalate — the RFC 3778 §3 assumption underlying the deep-link design no longer holds and the WP needs a design review.

---

## After Completing

- [ ] Verification steps 1–23 all pass
- [ ] Manual DEV smoke (24a–24h) passes
- [ ] Manual PROD smoke (25a–25c) passes
- [ ] R2 HEAD probes (steps 20–21) all return 200
- [ ] R2 content probe (step 22) confirms republished JSON is not
      stale
- [ ] Test baseline preserved (record pre-flight vs post-execution
      in the execution summary)
- [ ] No file outside §Files to Produce modified (`git diff
      --name-only`)
- [ ] All `// why:` comments from §Required Comments present
- [ ] All existing `// why:` comments in `lookupKeyword` /
      `lookupRule` preserved verbatim
- [ ] Three-commit topology: A0 `SPEC:` → A `EC-107:` → B `SPEC:`
      all landed with hook-compliant subjects (no `--no-verify`)
- [ ] `EC_INDEX.md` has EC-107 flipped to `Done` in Commit B
- [ ] `WORK_INDEX.md` has WP-082 `[ ]` → `[x]` with date + Commit A
      hash in Commit B
- [ ] `docs/ai/DECISIONS.md` has all six WP-082 §Governance entries
      recorded
- [ ] `docs/03.1-DATA-SOURCES.md` §Registry Metadata has schema
      reference row and rulebook PDF row
- [ ] `apps/registry-viewer/CLAUDE.md` updated with the locked
      sentence "Do not infer labels from keys under any
      circumstance."
- [ ] All three quarantine stashes intact (per session-context
      inheritance — re-derive at pre-flight)
- [ ] None of the out-of-scope inherited dirty-tree items staged or
      committed

---

## Common Failure Smells

- **Panel shows 0 keyword entries after Zod changes.** Either the
  `.safeParse(...)` path rejected valid data (check that `.strict()`
  is on the schemas but no stray fields exist in the JSON) or the
  option-(a) Map-value widening broke the destructuring in
  `buildAllEntries()`. Inspect `console.warn` output first —
  operator-readable by design.
- **Tooltips go blank for modifier keywords** (`"Focus 2"`,
  `"Ultimate Abomination"`, `"Double Striker"`, etc.). The
  `lookupKeyword` algorithm was not preserved when swapping to the
  widened value shape. STOP — §Locked Values preservation rule
  violated. Revert the `lookupKeyword` change and re-do as a
  one-line `.description` access at the `return` path.
- **Display names still mangled** (e.g., `"Chooseavillaingroup"`
  appears in the panel). The `titleCase()` call was not actually
  replaced — it was retained somewhere under a different name. Grep
  for `titleCase` across the viewer source; if any hit exists,
  delete it.
- **`[Glossary] Rejected ...` appears for valid data.** The
  schemas may be stricter than the actual data. Re-read §Locked
  Values "Zod schemas" — the only required fields are `key`,
  `label`, `description` / `summary`; `pdfPage` is optional; no
  other fields are permitted by `.strict()`. If the JSON carries an
  unexpected field, either remove it or widen the schema — but
  widening requires a DECISIONS.md entry, not a silent change.
- **Rulebook link opens on the same tab** instead of a new one, or
  the parent `<li>` also scrolls when the link is clicked.
  `target="_blank"` is missing, or `@click.stop` is missing. Check
  `GlossaryPanel.vue` against the exact shape in §Locked Values.
- **`window.opener` is not null in the new PDF tab.** `rel="noopener"`
  is missing. Fix immediately — this is a security guardrail.
- **Default Zod path `["0","label"]` appears in the warning text.**
  The `issue.path.join(".")` rendering was not applied. Fix per
  §Locked Values "Zod validation."
- **Rulebook link renders with `pdfPage` but missing
  `rulebookPdfUrl`** produces `href="undefined#page=17"`. The
  `v-if` guard is incomplete — it must check **both**
  `entry.pdfPage !== undefined` AND `rulebookPdfUrl`.
- **Build fails with `Cannot find module '@legendary-arena/registry'`
  in the viewer.** The registry package was not rebuilt before the
  viewer build. Run `pnpm --filter @legendary-arena/registry build`
  first, or rely on `pnpm -r build` which handles the topology.
- **`schema.ts` export compiles but the viewer reports
  `KeywordGlossarySchema is not a function`.** The package export
  map resolves to a stale `dist/index.js`. Re-run the registry
  build; verify `packages/registry/dist/index.js` contains the four
  schema names.
- **Commit message rejected by hook.** Subject contains a forbidden
  word (`WIP`/`misc`/`tmp`/`updates`/`changes`/`debug`/`fix stuff`)
  or uses `WP-082:` prefix. Rephrase using `EC-107:` + a substantive
  ≥12-char summary.
- **`git diff` shows `pnpm-lock.yaml` modified.** Should not happen
  for WP-082 (no new dependencies — `zod` is already in
  `packages/registry`). If it does, investigate — likely an
  unintended side-effect of a different `pnpm` command, revert.
- **`data/metadata/rules-full.json` shows wholesale changes in
  `git diff`** beyond the added `pdfPage` fields. The byte-for-byte
  preservation of existing `label` / `summary` values was violated.
  Check for inadvertent whitespace / JSON formatter reflow; restore
  from HEAD and re-apply the `pdfPage` additions only.
- **R2 HEAD probe returns 200 but browser fetch returns stale
  content.** Cloudflare edge cache not yet invalidated. Wait 5
  minutes, then verify with a cache-bypass query string
  (`?v=${Date.now()}`). If still stale, escalate to operator — do
  not flip the EC to `Done` until R2 content matches repo.
- **Authority Notice missing from the markdown extract.** The
  existing preamble was kept but the new blockquote was not
  prepended. Verification step 18 catches this; fix by inserting
  the exact blockquote as the very first block in the file.
