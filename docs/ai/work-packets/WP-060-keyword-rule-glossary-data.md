# WP-060 — Keyword & Rule Glossary Data Migration

**Status:** Complete (pre-flight 2026-04-20 DO NOT EXECUTE YET → amendments landed same day)
**Primary Layer:** Content / Data (Registry) + Registry Viewer (UI Integration)
**Schema Version:** 1
**Last Updated:** 2026-04-20 (amended per `docs/ai/invocations/preflight-wp060-keyword-rule-glossary-data.md`)
**Dependencies:** WP-003 (registry exists)

---

## Session Context

The registry viewer hardcodes three glossaries in
`apps/registry-viewer/src/composables/useRules.ts`:

- `KEYWORD_GLOSSARY: Map<string, string>` — **113 entries** (base keywords
  plus ~30 modifier variants added during viewer development:
  `ultimateabomination`, `doublestriker`, `triplestriker`,
  `doubleabomination`, `highestabomination`, `doubleempowered`,
  `tripleempowered`, `quadrupleempowered`, `doubledarkmemories`,
  `doublelaststand`, `doubleshieldclearance`, etc.)
- `RULES_GLOSSARY: Map<string, RuleEntry>` — **20 entries** (18 base rules
  plus `additional mastermind` + `transforms` — generic rule references
  found in ability text)
- `HERO_CLASS_GLOSSARY: Map<string, string>` — **5 entries** (Covert,
  Instinct, Ranged, Strength, Tech)

**Canonical baseline for this WP is the hardcoded Maps in `useRules.ts`,
not any external file.** The external files at
`C:\Users\jjensen\bbcode\modern-master-strike\src\data\keywords-full.json`
(102 keywords) and `.../rules-full.json` (18 rules) are the upstream
*origin* the hardcoded Maps diverged from, not the target baseline.
The Maps are authoritative because they include the modifier variants,
the extra generic rule references, and the post-divergence editorial
fixes that the external files never received.

This WP migrates the three Maps' contents (minus `HERO_CLASS_GLOSSARY`,
which stays hardcoded) into versioned JSON files under `data/metadata/`,
uploads them to R2, and re-wires the viewer to fetch them at runtime
instead of bundling hardcoded definitions. Full rationale, pre-existing
patterns, and the `useGlossary.ts` scope expansion all live in
`docs/ai/session-context/session-context-wp060.md` and the pre-flight.

---

## Why This Packet Matters

1. **Registry viewer needs them** — keyword and rule tooltips are already
   displayed; the data should come from versioned JSON, not hardcoded strings
2. **Phase 5 will reference them** — WP-021 through WP-026 define keyword
   unions and hooks; having the glossary data in-repo prevents re-derivation
3. **Content authoring** — theme authors and future content tools need keyword
   definitions to validate and describe card abilities
4. **Single source of truth** — the data currently lives only in an external
   project with no git history

---

## Goal

Externalize the three glossary Maps from `useRules.ts` into JSON files
under `data/metadata/`, upload them to R2, and re-wire the viewer to
fetch them at runtime. `HERO_CLASS_GLOSSARY` stays hardcoded (5 entries,
not in any external or R2 artifact).

### After completion:

- `data/metadata/keywords-full.json` exists (**113 keyword entries**,
  re-derived from `KEYWORD_GLOSSARY` at execution time)
- `data/metadata/rules-full.json` exists (**20 rule entries**,
  re-derived from `RULES_GLOSSARY` at execution time)
- Both files are uploaded to R2 at `images.barefootbetters.com/metadata/`
- The registry viewer fetches glossary data from R2 at startup via
  a new `glossaryClient.ts` singleton (mirror of `themeClient.ts`)
- `useRules.ts` no longer defines `KEYWORD_GLOSSARY` / `RULES_GLOSSARY`
  inline; it keeps `HERO_CLASS_GLOSSARY`, `RuleEntry`, `parseAbilityText`,
  `lookupHeroClass`, `lookupKeyword`, and `lookupRule` — with
  `lookupKeyword` and `lookupRule` retargeted to the fetched Maps but
  with their **algorithmic bodies preserved verbatim**
- `useGlossary.ts` rebuilds its `allEntries` list after the async fetch
  resolves (module-eval `const` → reactive `ref`)
- The `CLAUDE.md` for the registry viewer is updated
- `docs/03.1-DATA-SOURCES.md` §Registry Metadata is updated to list the
  two new JSON artifacts

**Count note:** the "113" and "20" figures are correct as of pre-flight
2026-04-20 (`session-context-wp060.md` counted via `node` on
`useRules.ts`). The executor must re-derive the exact counts when
authoring the JSON files and confirm the Verification Steps below against
those re-derived values.

---

## Assumes

- WP-003 complete: `packages/registry/` and `data/metadata/` exist
- R2 bucket at `images.barefootbetters.com` is accessible for uploads
  *and the executor has R2 credentials available* (escalate if not —
  see Session protocol below)
- Hardcoded glossary Maps still exist in `useRules.ts` with the pre-flight
  counts (113 / 20 / 5)
- `pnpm -r build` exits 0
- `pnpm test` exits 0 (baseline: **588 passing / 0 failing** at HEAD
  `00687c5` per `session-context-wp060.md`)

If any assumption is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md — "Registry Layer (Data Input)"` — glossary data
  is registry-layer content only
- `apps/registry-viewer/CLAUDE.md` — current registry viewer architecture
- `apps/registry-viewer/HISTORY-modern-master-strike.md` — data pipeline
  history and original file locations
- `apps/registry-viewer/src/composables/useRules.ts` — current hardcoded
  glossary (to be replaced)
- `apps/registry-viewer/src/lib/themeClient.ts` — pattern for fetching JSON
  from R2 (follow this pattern for glossary loading)

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` extension — never `.test.mjs`
- Full file contents for every new or modified file — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Data migration only** — no game logic, no engine integration
- **No schema changes** — the glossary JSON files are consumed as-is; no Zod
  schema needed (they are display-only text, not validated contracts)
- **Registry viewer only** — no changes to `packages/game-engine/` or
  `apps/server/`
- **Preserve token markup** — ability text in definitions contains `[icon:X]`,
  `[hc:X]`, `[keyword:N]` tokens; these must be preserved as-is in the JSON
  (the registry viewer already has a token parser)
- **No lossy transforms** — copy the source files; do not strip fields,
  truncate summaries, or flatten structure

**Session protocol:**
- If the hardcoded Maps in `useRules.ts` have drifted from pre-flight
  counts (113 / 20 / 5), stop and ask before proceeding
- If R2 credentials are unavailable, STOP and escalate — do NOT silently
  skip the upload step

---

## Scope (In)

### A) Serialize glossary Maps into `data/metadata/` JSON files

- `data/metadata/keywords-full.json` — serialize
  `apps/registry-viewer/src/composables/useRules.ts` `KEYWORD_GLOSSARY`
  (113 entries). Shape: `Array<{ key: string; description: string }>`.
  Entries in alphabetical order by `key` for deterministic diffs.
- `data/metadata/rules-full.json` — serialize
  `apps/registry-viewer/src/composables/useRules.ts` `RULES_GLOSSARY`
  (20 entries). Shape: `Array<{ key: string; label: string; summary: string }>`
  preserving the existing `RuleEntry` fields. Entries in alphabetical
  order by `key` for deterministic diffs.

Both files must parse as valid JSON. Token markup (`[icon:X]`, `[hc:X]`,
`[keyword:N]`, `[rule:N]`) inside definition text is preserved verbatim
— the viewer's existing `parseAbilityText()` handles it at render time.

### B) Upload to R2

Upload both files to:
- `images.barefootbetters.com/metadata/keywords-full.json`
- `images.barefootbetters.com/metadata/rules-full.json`

### C) Update registry viewer to fetch glossary data at runtime

Create `apps/registry-viewer/src/lib/glossaryClient.ts`:
- Follows the same singleton pattern as `themeClient.ts`
- Fetches `keywords-full.json` and `rules-full.json` from R2
- Exposes `getKeywordGlossary()` and `getRuleGlossary()` returning Maps
- Non-blocking — registry viewer works even if glossary fetch fails
  (falls back to no tooltips)

### D) Simplify `useRules.ts`

- Remove the hardcoded `KEYWORD_GLOSSARY` Map body (113 entries)
- Remove the hardcoded `RULES_GLOSSARY` Map body (20 entries)
- Keep `HERO_CLASS_GLOSSARY` verbatim (5 entries — not in any external
  or R2 artifact)
- Keep `RuleEntry` interface verbatim
- Keep `parseAbilityText()` verbatim
- Keep `lookupHeroClass()` verbatim
- **Keep `lookupKeyword()` and `lookupRule()` bodies ALGORITHMICALLY
  UNCHANGED — only the Map source changes.** `lookupKeyword` retains
  its full exact-lowercase / space-hyphen-stripped / prefix / suffix /
  substring matching logic (currently `useRules.ts:319–361`).
  `lookupRule` retains its exact + slugified-fallback logic (currently
  `:369–381`). A naïve `return fetchedMap.get(lower) ?? null` rewrite
  silently regresses ~20 modifier keyword tooltips and is **forbidden**.
- Both functions must return `null` when the fetch has not yet resolved
  (not throw, not return an empty string) — callers (`CardDetail.vue`,
  `useGlossary.ts`) already handle null via tooltip-absent paths.
- Signatures of `lookupKeyword`, `lookupRule`, `lookupHeroClass`,
  `parseAbilityText`, and the `AbilityToken` type are **public contract**
  — do not change return types, parameter names, or null semantics.

### E) Update `App.vue` to load glossary data on mount

Add `getKeywordGlossary(metadataBaseUrl)` and
`getRuleGlossary(metadataBaseUrl)` calls in `onMounted`, parallel with
the existing `getThemes(metadataBaseUrl)` call at lines 159–166. Same
`try / catch + console.warn("[Glossary] Load failed (non-blocking):",
...)` pattern. On success, write the resolved Maps into the
`useRules.ts` module-scope holders (via a `setGlossaries(...)` exported
from `useRules.ts` or via direct re-export from `glossaryClient.ts` —
executor picks one, follows the precedent locked in EC-106).

### F) Rebuild `useGlossary.ts` entry list after fetch resolves

Scope-expansion via the viewer analog of
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` — minimal, strictly
dependency-driven, no new behavior beyond wiring.

- Convert `allEntries` from `const = buildAllEntries()` (module-eval,
  currently `useGlossary.ts:101`) to a reactive `ref<GlossaryEntry[]>([])`
  (or computed) that rebuilds after the fetch resolves.
- Preserve `openToKeyword` / `openToRule` / `scrollToEntry` / `toggle` /
  `open` / `close` behavior verbatim. Their existing early-return on
  null lookup result already handles the pre-fetch state gracefully.
- Preserve the `// why: some keywords appear twice in the map
  (villainousweapons). Skip duplicates.` dedup logic at lines 47–49 —
  or remove it if the migrated JSON is already deduplicated. Lock one
  approach in EC-106; do not leave the dedup ambiguous.

### G) Update documentation

- Update `apps/registry-viewer/CLAUDE.md` — replace the current
  "hardcoded" narrative in the "Keyword & Rule Glossary" section with
  the R2 fetch flow + non-blocking fallback; add `glossaryClient.ts`
  to the "Key Files" table; add `getKeywordGlossary()` +
  `getRuleGlossary()` to the "Architecture & Data Flow" block.
- Update `docs/03.1-DATA-SOURCES.md` §Registry Metadata — add
  `keywords-full.json` and `rules-full.json` rows to the Files table
  following the `sets.json` / `card-types.json` shape.
- Update `apps/registry-viewer/HISTORY-modern-master-strike.md` only
  if the current narrative is made inaccurate by the migration. If
  unchanged, skip.

---

## Scope (Out)

- **No Zod schema for glossary data** — these are display-only definitions,
  not validated contracts
- **No game engine changes** — Phase 5 WPs will define their own keyword
  unions independently
- **No database migration** — `load_legendary_data.mjs` already handles
  database loading separately
- **No new keywords or rules** — this is a copy, not an authoring task
- **No token markup transformation** — the registry viewer's existing
  `parseAbilityText()` handles `[keyword:N]` references in definition text
- Refactors or improvements outside the glossary migration are out of scope

---

## Files Expected to Change

- `data/metadata/keywords-full.json` — **new** — 113 keyword definitions
  serialized from `useRules.ts` `KEYWORD_GLOSSARY`
- `data/metadata/rules-full.json` — **new** — 20 rule definitions
  serialized from `useRules.ts` `RULES_GLOSSARY`
- `apps/registry-viewer/src/lib/glossaryClient.ts` — **new** — singleton
  fetcher for keyword and rule glossary data from R2 (mirror of
  `themeClient.ts`)
- `apps/registry-viewer/src/composables/useRules.ts` — **modified** —
  remove hardcoded `KEYWORD_GLOSSARY` and `RULES_GLOSSARY` Map bodies;
  retarget `lookupKeyword` / `lookupRule` to fetched data with
  algorithmic bodies preserved verbatim; keep everything else
- `apps/registry-viewer/src/composables/useGlossary.ts` — **modified**
  (viewer analog of 01.5 wiring allowance) — rebuild `allEntries`
  reactively after async glossary fetch resolves
- `apps/registry-viewer/src/App.vue` — **modified** — add
  `getKeywordGlossary()` / `getRuleGlossary()` calls to `onMounted`
  parallel to `getThemes()`
- `apps/registry-viewer/CLAUDE.md` — **modified** — document glossary
  data flow
- `docs/03.1-DATA-SOURCES.md` — **modified** — add two new rows under
  §Registry Metadata for the new JSON artifacts

No other files may be modified.

---

## Governance (Required)

Add the following decisions to `DECISIONS.md`:

- Keyword and rule glossary data is **display-only content**, not a validated
  contract — no Zod schema required
- Glossary data lives in `data/metadata/` (same as sets, hero-classes, etc.)
- Glossary data is served from R2 alongside card and theme data
- `[keyword:N]` numeric references in definition text refer to keyword IDs
  in the same file — the registry viewer resolves these at render time
- Hero class descriptions (Covert, Instinct, Ranged, Strength, Tech) remain
  hardcoded in `useRules.ts` (5 entries) because they are not present in
  any external or R2 glossary artifact and are stable engine-class labels
- Canonical baseline for the migration is the hardcoded `KEYWORD_GLOSSARY`
  (113) / `RULES_GLOSSARY` (20) Maps in `useRules.ts`, not the upstream
  `modern-master-strike` JSON files (102 / 18) the Maps diverged from
- `useGlossary.ts` scope expansion (reactive `allEntries` rebuild after
  fetch) is authorized under the viewer analog of
  `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` — dependency-driven
  wiring only, no new behavior
- `lookupKeyword` and `lookupRule` algorithmic bodies are locked — only
  the backing Map source changes in this migration

Update `WORK_INDEX.md` to flip WP-060 `[ ]` → `[x]` with the 2026-MM-DD
execution date and Commit A hash on governance-close (Commit B).

Update `docs/ai/execution-checklists/EC_INDEX.md` — EC-106 status flips
to `Done` on governance-close.

Update `docs/03.1-DATA-SOURCES.md` §Registry Metadata — add rows for the
two new JSON artifacts.

---

## Acceptance Criteria

- [ ] `data/metadata/keywords-full.json` exists with **113 keyword
  entries** (re-derive exact count at execution time from `KEYWORD_GLOSSARY`
  and update this line if drifted)
- [ ] `data/metadata/rules-full.json` exists with **20 rule entries**
  (re-derive exact count at execution time from `RULES_GLOSSARY` and
  update this line if drifted)
- [ ] Both files are valid JSON, entries sorted alphabetically by `key`
- [ ] Both files are uploaded to R2 and fetchable via HTTP
- [ ] `glossaryClient.ts` fetches data using the same singleton pattern
  as `themeClient.ts` (module-scope `_promise`, non-blocking, `devLog`
  instrumented)
- [ ] Glossary loading is non-blocking (card view works if fetch fails —
  `console.warn` + continue, no thrown exception)
- [ ] Keyword tooltips display in CardDetail for tokens like
  `[keyword:Berserk]`
- [ ] Modifier keyword tooltips still display (e.g., "Ultimate Abomination",
  "Double Striker", "Triple Empowered") — confirms `lookupKeyword`
  suffix/substring matching survived the refactor
- [ ] Rule tooltips display in CardDetail for tokens like `[rule:shards]`
- [ ] Hero class tooltips still display (not regressed)
- [ ] `useRules.ts` no longer contains hardcoded `KEYWORD_GLOSSARY` or
  `RULES_GLOSSARY` Map bodies; `HERO_CLASS_GLOSSARY` preserved verbatim
- [ ] `useGlossary.ts` `allEntries` rebuilds after fetch resolves; panel
  shows the same entry count and ordering as pre-migration
- [ ] No imports from `packages/game-engine/` or `boardgame.io` in any
  changed file
- [ ] `apps/registry-viewer/CLAUDE.md` updated with glossary data flow
- [ ] `docs/03.1-DATA-SOURCES.md` §Registry Metadata updated with new
  JSON artifact rows
- [ ] Repo-wide test baseline **588 passing / 0 failing** preserved (no
  new test failures; adding new tests is OPTIONAL per EC-106 §Test
  Expectations)

---

## Verification Steps

```bash
# Step 1 — verify new JSON files are valid and count matches baseline
node -e "console.log(JSON.parse(require('fs').readFileSync('data/metadata/keywords-full.json','utf8')).length)"
# Expected: 113 (re-derive at execution; must match KEYWORD_GLOSSARY.size)

node -e "console.log(JSON.parse(require('fs').readFileSync('data/metadata/rules-full.json','utf8')).length)"
# Expected: 20 (re-derive at execution; must match RULES_GLOSSARY.size)

# Step 2 — build
pnpm -r build
# Expected: exits 0

# Step 3 — run all tests
pnpm -r --if-present test
# Expected: exits 0; 588 passing / 0 failing (adjust if EC-106 adds tests)

# Step 4 — confirm no engine or boardgame.io imports in new file
grep -E "from ['\"](@legendary-arena/game-engine|boardgame\.io)" apps/registry-viewer/src/lib/glossaryClient.ts
# Expected: no output

# Step 5 — confirm KEYWORD_GLOSSARY / RULES_GLOSSARY Map bodies are gone
grep -c "^export const KEYWORD_GLOSSARY" apps/registry-viewer/src/composables/useRules.ts
# Expected: 0
grep -c "^export const RULES_GLOSSARY" apps/registry-viewer/src/composables/useRules.ts
# Expected: 0
grep -c "^export const HERO_CLASS_GLOSSARY" apps/registry-viewer/src/composables/useRules.ts
# Expected: 1 (preserved verbatim)

# Step 6 — confirm lookupKeyword enhanced matching preserved
grep -cE "(suffix match|substring match|prefix match)" apps/registry-viewer/src/composables/useRules.ts
# Expected: ≥ 3 (one comment per matching branch — proves algorithm survived)

# Step 7 — verify R2 upload
curl -sI https://images.barefootbetters.com/metadata/keywords-full.json | head -1
# Expected: HTTP/2 200

curl -sI https://images.barefootbetters.com/metadata/rules-full.json | head -1
# Expected: HTTP/2 200

# Step 8 — manual tooltip smoke in registry viewer
#   pnpm --filter registry-viewer dev
#   Open a card with "Ultimate Abomination" / "Double Striker" / "Focus 2"
#   in ability text → hover the keyword badge → tooltip text matches the
#   pre-migration hardcoded text.
```

---

## Definition of Done

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm -r --if-present test` exits 0 (baseline 588 / 0 preserved)
- [ ] Glossary files exist in `data/metadata/` and on R2 (HTTP 200 on
  HEAD from both URLs)
- [ ] Registry viewer displays keyword/rule tooltips from fetched data,
  including modifier keywords ("Ultimate Abomination", "Double Striker",
  etc.)
- [ ] No files outside `## Files Expected to Change` were modified
  (confirmed with `git diff --name-only`)
- [ ] `docs/ai/DECISIONS.md` updated with all items from ## Governance
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-060 flipped `[ ]` →
  `[x]` with date + Commit A hash
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-106 flipped to
  `Done`
- [ ] `docs/03.1-DATA-SOURCES.md` §Registry Metadata updated
- [ ] `apps/registry-viewer/CLAUDE.md` updated
- [ ] Three-commit topology followed: A0 `SPEC:` pre-flight bundle
  → A `EC-106:` execution → B `SPEC:` governance close (commit prefix
  `WP-060:` is forbidden per P6-36)
