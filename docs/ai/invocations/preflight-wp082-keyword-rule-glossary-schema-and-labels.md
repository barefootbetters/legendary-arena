# Pre-Flight — WP-082: Keyword & Rule Glossary Schema, Labels, and Rulebook Deep-Links

> **Artifact type:** Pre-flight (Work Packet Readiness & Scope Lock) per
> `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`.
> **Subordinate to:** `.claude/CLAUDE.md` → `docs/ai/ARCHITECTURE.md` →
> `.claude/rules/*.md` → `EC-107-keyword-rule-glossary-schema-and-labels.checklist.md`.
> **Input session context:** *not yet authored* — see PS-3 below.

---

## Pre-Flight Header

- **Target Work Packet:** `WP-082 — Keyword & Rule Glossary Schema, Label, and PDF Page Reference`
- **Title:** Keyword & Rule Glossary Schema, Labels, and Rulebook Deep-Links
- **Previous WP Status:** `WP-036 Complete (2026-04-21, commit 04c53c0 execution / 45ddb49 governance close)`; `WP-060 Complete (2026-04-20, commit 412a31c / cd811eb governance close)` is the direct data dependency.
- **Pre-Flight Date:** 2026-04-21
- **Invocation Stage:** Pre-Execution (Scope & Readiness)
- **HEAD at pre-flight:** `45ddb49` (`SPEC: close WP-036 / EC-036 governance …`)
- **Current branch:** `wp-036-ai-playtesting` — see PS-4 below (must cut a fresh `wp-082-*` branch before Commit A0).
- **Working tree:** dirty (9 modified + 18 untracked paths); mapping to scope — see §Input Data Traceability and PS-3.

**Work Packet Class:** **Runtime Wiring** *(registry + viewer layer variant)*.

Rationale: WP-082 adds two new Zod schemas at the Registry layer
(`packages/registry/src/schema.ts` + `src/index.ts`), backfills metadata
into two existing content JSON files under `data/metadata/`, and re-wires
the `apps/registry-viewer/` fetch/render path to consume them (Zod-validated
fetch, widened `useRules.ts` keyword Map value shape, new `GlossaryPanel`
anchor). Like WP-060, this touches **zero** boardgame.io state, **zero**
moves, **zero** phase hooks, and **zero** `G` mutations. The
engine/preplan/server layers are completely untouched. Because the
"Runtime Wiring" class in `01.4` is authored for engine WPs, sections
below that are engine-specific (framework ctx, mutation-boundary) are
interpreted for the viewer analog where relevant; structural readiness,
contract fidelity, scope lock, test expectations, and risk review remain
fully applicable.

**01.5 runtime-wiring allowance:** **NOT INVOKED** as an engine-contract
clause (no `LegendaryGameState` field, no `buildInitialGameState` change,
no `LegendaryGame.moves` entry, no phase hook). The **viewer analog** is
invoked for the `GlossaryEntry` interface extension (new
`pdfPage?: number` field) and the widened keyword Map value shape in
`useRules.ts` + `glossaryClient.ts` — cite in the execution summary, per
WP-060 / D-6007 precedent.

---

## Pre-Flight Intent

Perform a pre-flight validation for `WP-082`.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

## Authority Chain (Must Read)

Read in order:

1. `.claude/CLAUDE.md` — EC-mode rules, bug handling, commit discipline.
2. `docs/ai/ARCHITECTURE.md` — §Package Import Rules line 201
   (`apps/registry-viewer` may import `registry`, UI framework; must not
   import `game-engine`/`preplan`/`server`/`pg`); §Layer Boundary
   (Authoritative). Registry layer rules apply to `schema.ts` and
   `index.ts`.
3. `.claude/rules/architecture.md` — Layer Boundary enforcement.
4. `.claude/rules/registry.md` — **Schema Authority** (line: "`packages/registry/src/schema.ts` is the single source of truth for all field shapes"); **Immutable Files** (`schema.ts` requires strong justification + DECISIONS.md entry for modification — satisfied here by WP §Governance + EC §Locked Values); no game logic in registry.
5. `.claude/rules/code-style.md` — full English words, JSDoc on all functions, `// why:` comments on non-obvious code, no `.reduce()` with branching, no `import *` / barrel re-export.
6. `.claude/rules/work-packets.md` — **one packet per session**; dependency discipline; **WP must appear in WORK_INDEX.md before execution** (see PS-1).
7. `docs/03.1-DATA-SOURCES.md` §Registry Metadata lines 61–62 (existing
   `keywords-full.json` + `rules-full.json` rows); schema reference + rulebook PDF rows will be added in Commit A.
8. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — `packages/registry/` +
   `data/` are `data-input` (line 42); `apps/registry-viewer/` is classified implicitly via ARCHITECTURE.md §Package Import Rules and by precedent (EC-101..EC-106) but lacks a formal row in 02-CODE-CATEGORIES.md — see §Code Category Boundary Check RS-6 (non-blocking).
9. `docs/ai/REFERENCE/00.2-data-requirements.md` — `label` is an
   established canonical field name (lines 391–404: icons-meta, hero teams, hero classes, rules all use `label` for human-readable names); `pdfPage` is new but self-describing and consistent with no-abbreviation naming discipline (00.6 Rule 4).
10. `docs/ai/DECISIONS.md` — D-6001 (glossary data is display-only, no Zod) is **superseded in part** by WP-082 §G (Zod IS now added — document this supersession as a §Governance decision in Commit B); D-6004 (`[keyword:N]` resolution); D-6005 (hero-class descriptions stay hardcoded); D-6007 (useGlossary.ts viewer-scope expansion lock).
11. `docs/ai/execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md`.
12. `docs/ai/work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md`.
13. `docs/ai/work-packets/WP-060-keyword-rule-glossary-data.md` +
    `docs/ai/execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md` — direct predecessor; establishes `glossaryClient.ts` singleton, `lookupKeyword` / `lookupRule` preservation lock, `useGlossary.ts` viewer-scope allowance, `App.vue` fetch block pattern.

If conflicts exist, higher-authority documents win. Lower documents must
be corrected rather than worked around.

---

## Dependency & Sequencing Check

| WP / Gate | Status | Notes |
|---|---|---|
| WP-003 (Card Registry Verification) | ✅ pass | Transitive via WP-060. |
| WP-055 (Theme Client) | ✅ pass | `themeClient.ts` pattern locked and reused by `glossaryClient.ts`. |
| WP-060 — Keyword & Rule Glossary Data Migration | ✅ pass | Executed at `412a31c`; governance close `cd811eb`. `lookupKeyword` / `lookupRule` algorithm preservation lock from EC-106 inherited by EC-107. |
| FP-00.4 / FP-00.5 / FP-01 / FP-02 | ✅ pass | Completed 2026-04-09 per WORK_INDEX.md §Foundation Prompts. R2 bucket + image hosting infrastructure live (required by §E rulebook PDF upload). |

**Rule:** All prerequisite WPs are complete and recorded as such. No blockers on dependency readiness.

---

## Dependency Contract Verification

Each sub-item was verified by reading the actual source file, not just WP/EC text.

- [x] **Type/field names match exactly:**
  - Current `keywords-full.json` entry shape is `{ key, description }` — confirmed by `node -e` field-enumeration probe (123 entries, 2 distinct field keys). EC-107 adds `label` (required) and `pdfPage` (optional).
  - Current `rules-full.json` entry shape is `{ key, label, summary }` — confirmed (20 entries, 3 field keys). EC-107 adds `pdfPage` (optional). Existing `label` and `summary` preserved byte-for-byte.
  - `RuleEntry` interface in `apps/registry-viewer/src/composables/useRules.ts:23–26` declares `{ label, summary }` — widening to `{ label, summary, pdfPage?: number }` is consistent.
- [x] **Function signatures are compatible:**
  - `setGlossaries(keywords: Map<string, string>, rules: Map<string, RuleEntry>)` at `useRules.ts:40–46` must widen `keywords` to `Map<string, { label: string; description: string }>`. All callers are audited below (2 callers: `App.vue:179` and `useRules.ts` itself as the module holding the state).
  - `getKeywordGlossaryMap(): Map<string, string> | null` at `useRules.ts:52–54` widens to `Map<string, { label: string; description: string }> | null`.
  - `getRuleGlossaryMap(): Map<string, RuleEntry> | null` at `useRules.ts:60–62` stays the same shape (only the `RuleEntry` body widens with optional `pdfPage`).
  - `lookupKeyword(name: string): string | null` at `useRules.ts:156–199` return type **stays `string | null`** — the preservation lock from EC-106 is honored. Inside the body, **three** `.get(...)` call sites (lines 160, 164, 198) each add a `.description` read. (EC-107 §Locked Values wording said "collapses to a one-line `.description` access" — a minor wording gap; the functional change is three one-line `.description` additions, not one.) See §Risk RS-5.
  - `lookupRule(code: string): RuleEntry | null` at `useRules.ts:207–221` is unchanged. The widening of `RuleEntry` with `pdfPage?: number` is backward-compatible.
- [x] **Move classification is correct:** N/A — no moves touched (viewer-layer WP).
- [x] **Field paths in G are verified:** N/A — no `G` access at all (viewer + registry layers only).
- [x] **Helper return patterns are understood:** `buildInitialGameState` / `Game.setup()` not involved. `glossaryClient` IIFE pattern returns `Promise<Map<…>>` (mirrors `themeClient.ts:49–113` from EC-106 precedent).
- [x] **Optional fields are identified:** `pdfPage?: number` is strictly optional in both entry schemas. Every `v-if` / `!== undefined` guard in `GlossaryPanel.vue` must accommodate `undefined`. EC §Locked Values `v-if="entry.pdfPage !== undefined && rulebookPdfUrl"` is explicit.
- [x] **Data source identity verified:**
  - `/metadata/keywords-full.json` and `/metadata/rules-full.json` at R2 are authoritative content; canonical in-repo copies live at `data/metadata/keywords-full.json` (123 entries) and `data/metadata/rules-full.json` (20 entries). Confirmed alphabetical + duplicate-free by `localeCompare` probe (§Verification Step 9 pattern).
  - Rulebook PDF source: `docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf` (44,275,000 bytes) confirmed present at working-directory-relative path.
  - Markdown extract source: `docs/Marvel Legendary Universal Rules v23.txt` (5250 lines) untracked; `docs/legendary-universal-rules-v23.md` (5262 lines) untracked — both present on disk; neither begins with the required Authority Notice blockquote (confirmed by `head -8`). Prepending the notice is EC §A / §Locked Values "Authority Notice" task.
- [x] **TypeScript types accommodate real data quirks:** No card-stat parsing involved; no `"2*"` / `"2+"` concerns. Glossary fields are all clean strings + one optional integer.
- [x] **Schema-engine alignment verified:** N/A — no engine schema involvement.
- [x] **Handler ownership is explicit:** N/A — no hook definitions or runtime handlers.
- [x] **Persistence classification is clear:** Glossary JSON files are **content / R2 artifact** class (Registry Metadata per `03.1-DATA-SOURCES.md` §Registry Metadata); the new `rulebookPdfUrl` in `registry-config.json` is also content/config class. **No new `G` fields.**
- [x] **WP scope pre-validated against ARCHITECTURE.md:** Registry layer (schema authority) + Registry Viewer layer (UI) — no cross-layer violations. `apps/registry-viewer` may import `@legendary-arena/registry` per ARCHITECTURE.md line 201; schemas flow from registry package to viewer package without crossing game-engine or server boundaries.
- [x] **Framework API workarounds documented:** None needed. Zod `.strict()` is a first-party Zod API; `#page=N` PDF deep-links are RFC 3778 §3 standard (documented in WP §Non-Negotiable Constraints and EC-107 §Locked Values).
- [x] **New types defined in dedicated contract files:**
  - `KeywordGlossaryEntrySchema` / `RuleGlossaryEntrySchema` + inferred types go into `packages/registry/src/schema.ts` — the canonical schema authority file per `.claude/rules/registry.md`. ✓
  - `GlossaryEntry` extension (`pdfPage?: number`) stays in `useGlossary.ts` where the interface already lives; `RuleEntry` extension stays in `useRules.ts`.
- [x] **Immutable file designations respected:**
  - `packages/registry/src/schema.ts` is designated **immutable** by WP-003 (`.claude/rules/registry.md` §Schema Authority). EC-107 honors this with an explicit `// why:` block above the two new entry schemas and a governance decision recording the addition. The addition is **additive** (export append; no modification of existing schemas). ✓
  - `packages/registry/src/shared.ts` and `localRegistry.ts` — untouched. ✓
  - `lookupKeyword` / `lookupRule` algorithmic bodies — preserved byte-for-byte except for the three `.description` suffix additions required by option (a) (EC-107 §Locked Values + §Guardrails).
- [x] **Cross-service identifiers use ext_id strings:** N/A (no cross-service IDs; glossary `key` is already a lowercased slug).
- [x] **Locked value string literals match actual code:**
  - `EC-107:` commit prefix confirmed by `.githooks/commit-msg:45–60` (`^EC-[0-9]+[A-Z]?:` accepted).
  - `WP-082:` commit prefix is rejected — confirmed by regex review of the same hook (not in the allow-list; also caught by Rule 1 only if it trips the `WIP|wip|fix stuff|misc|tmp|updates|changes|debug` list, but the explicit rejection of `WP-###:` is enforced via the allow-list prefix rule at line 45–60, i.e., `WP-082:` does not match `^(EC-[0-9]+[A-Z]?|SPEC|INFRA):` and is rejected). ✓ P6-36.
  - Forbidden subject words (`WIP` / `misc` / `tmp` / `updates` / `changes` / `debug` / `fix stuff`) enforced by hook Rule 1. ✓
  - `.strict()` is a Zod public API — confirmed.
  - R2 URLs: `https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf` uses the established `images.barefootbetters.com` host (confirmed by WP-060 precedent: `images.barefootbetters.com/metadata/`), kebab-case filename, version-pinned `v23`. ✓
- [x] **Runtime data availability verified for all evaluators:** N/A — no runtime `G` evaluators. The glossary pipeline reads from Maps hydrated at mount, which is the pattern locked by EC-106.
- [x] **Setup-time data source verified for all extractors:** N/A — this is not a setup-time extractor WP. `label` values come from the human rulebook transcription in `docs/legendary-universal-rules-v23.md`; `pdfPage` values come from explicit `page N` markers in the same file.
- [x] **WP function signatures match established conventions:**
  - Zod schemas use `z.object({...}).strict()` — standard Zod pattern.
  - The widened keyword Map value `{ label: string; description: string }` is a plain structural interface, consistent with viewer-local shape conventions.
- [x] **WP file paths verified against actual filesystem:** All 17 files in EC §Files to Produce were audited individually:
  - `packages/registry/src/schema.ts` (217 lines) — exists ✓
  - `packages/registry/src/index.ts` (51 lines) — exists ✓; existing schema re-export block is at lines 30–36 as EC claims ✓
  - `data/metadata/keywords-full.json` (493 lines, 123 entries) — exists ✓
  - `data/metadata/rules-full.json` (101 lines, 20 entries) — exists ✓
  - `apps/registry-viewer/public/registry-config.json` (10 lines) — exists ✓; contains `metadataBaseUrl` + `eagerLoad` but not `rulebookPdfUrl` ✓
  - `apps/registry-viewer/src/lib/glossaryClient.ts` (116 lines; EC claimed 117 — drift of 1 line, non-blocking) — exists ✓
  - `apps/registry-viewer/src/composables/useRules.ts` (221 lines; EC claimed 223 as the pre-state — EC-106 closed at 221, drift of 2 lines, non-blocking) — exists ✓
  - `apps/registry-viewer/src/composables/useGlossary.ts` (222 lines; EC claimed 223 — drift of 1 line, non-blocking) — exists ✓; `titleCase()` at lines 94–100 confirmed; dedup block at lines 52–55 confirmed ✓
  - `apps/registry-viewer/src/components/GlossaryPanel.vue` (390 lines) — exists ✓; `<li>` entry block at lines 127–141 confirmed ✓
  - `apps/registry-viewer/src/App.vue` (574 lines) — exists ✓; glossary-load block at lines 170–183 confirmed; `config` object loaded at line 149 confirmed ✓
  - `apps/registry-viewer/CLAUDE.md` — exists ✓; has existing "Keyword & Rule Glossary" section ✓
  - `docs/03.1-DATA-SOURCES.md` — exists ✓; §Registry Metadata rows 61–62 reference `keywords-full.json` (113 keywords — stale; must be updated to 123) + `rules-full.json` (20 rules) ✓
  - `docs/ai/DECISIONS.md` — exists ✓
  - `docs/legendary-universal-rules-v23.md` (5262 lines, untracked) — exists ✓; **does NOT begin with Authority Notice** (starts with `# Marvel Legendary Universal Rulebook v23 — Text Extract`); prepending the Authority Notice is the EC §A task ✓
  - `docs/Marvel Legendary Universal Rules v23.txt` (5250 lines, untracked) — exists ✓
  - `docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf` (44,275,000 bytes) — exists ✓
  - `docs/ai/work-packets/WORK_INDEX.md` — exists ✓ (**but WP-082 row is missing — see PS-1**)
  - `docs/ai/execution-checklists/EC_INDEX.md` — exists ✓ (**but EC-107 row is missing — see PS-2**)

- [x] **WP file paths verified against code category rules:**
  - `packages/registry/src/*.ts` → `data-input` category (02-CODE-CATEGORIES.md line 42). ✓
  - `data/metadata/*.json` → `data-input` category (line 165). ✓
  - `apps/registry-viewer/src/**` → **no formal code-category row**, but ARCHITECTURE.md §Package Import Rules line 201 authoritatively constrains its imports. Modifications by this WP stay within `src/lib/`, `src/composables/`, `src/components/`, `src/App.vue`, `public/`, and viewer `CLAUDE.md` — all pre-existing directories normalized by EC-101..EC-106 precedent. See §Code Category Boundary Check and §Risk RS-6. Non-blocking.
  - `docs/**` → `docs` category. ✓
- [x] **WP gating assumptions verified as true:**
  - "WP-060 / EC-106 complete" — confirmed (`412a31c` on `main`; WORK_INDEX.md line 221 and EC_INDEX.md line 210 both flipped Done).
  - "`packages/registry/src/schema.ts` exists and already imports `zod`" — confirmed (line 29: `import { z } from "zod";`).
  - "`packages/registry/src/index.ts` explicitly re-exports registry schemas" — confirmed (lines 30–36: `SetDataSchema`, `SetIndexEntrySchema`, `HeroCardSchema`, `HeroClassSchema`, `CardQuerySchema`).
  - "`apps/registry-viewer/src/lib/glossaryClient.ts` exists at HEAD (singleton shape from EC-106)" — confirmed (116 lines, singleton `_keywordPromise` / `_rulePromise` cache; IIFE pattern; devLog instrumentation).
  - "`apps/registry-viewer/src/composables/useGlossary.ts` exists at HEAD with `titleCase()` at lines 94–100 and the dedup block at lines 52–55" — both confirmed at the exact line ranges ✓
  - "`apps/registry-viewer/src/composables/useRules.ts` exists at HEAD with `setGlossaries` / `getKeywordGlossaryMap` / `getRuleGlossaryMap` exports" — all three confirmed ✓
  - "`apps/registry-viewer/src/components/GlossaryPanel.vue` exists at HEAD with the `<li>` entry block at lines 127–141" — confirmed ✓
  - "`apps/registry-viewer/src/App.vue` has the glossary-load block in `onMounted` (lines 170–183)" — confirmed ✓; the block reads `config` already (line 149), so no new config fetch is needed
  - "R2 bucket `images.barefootbetters.com` is writable" — confirmed by WP-060 / EC-106 precedent (PDF + JSON uploads landed there); executor must re-confirm R2 credentials before PDF upload (EC §Before Starting blocking item)
  - "`pnpm -r build` exits 0" — **confirmed this session**: all packages built cleanly (registry + vue-sfc-loader + game-engine + replay-producer + preplan + arena-client + registry-viewer)
  - "`pnpm -r --if-present test` exits 0" — **confirmed this session**: baseline **596 passing / 0 failing** (registry 13 / vue-sfc-loader 11 / game-engine 444 / replay-producer 4 / server 6 / preplan 52 / arena-client 66). No registry-viewer tests (per EC-106 precedent — `apps/registry-viewer` has no test script).

  All gating assumptions are verified TRUE.
- [x] **Decision IDs not referenced before creation:**
  - WP/EC reference D-6001, D-6002, D-6004, D-6005, D-6007 — all exist in DECISIONS.md (confirmed by grep). ✓
  - P6-36 (commit-prefix rejects `WP-###:`) — confirmed in `01.4-pre-flight-invocation.md` precedent log line 4216.
  - P6-27 / P6-44 (staging discipline; `pnpm-lock.yaml` implicit allowlist) — confirmed in precedent log lines 3788, 4648.
  - P6-51 (form-2 governance back-pointer) — confirmed in precedent log line 5872.
  - **D-6001 supersession**: D-6001 ("Keyword and Rule Glossary Data Is Display-Only, No Zod Schema") is partially superseded by WP-082 §G — a governance decision (e.g., D-8201 or next free slot) must be authored in Commit B recording the supersession. See §Governance Integrity.
  - EC-107 numeric slot — confirmed free (EC_INDEX.md lists through EC-106; EC-107 does not appear; next-free-slot claim in EC §slot note holds).
- [x] **Decision ID search accounts for character encoding:** All searches above used literal hyphen `D-` matches. No false-negative risk identified (the relevant decision IDs all live under `## D‑` em-dash headings but the in-text references uniformly use regular hyphens; prior sessions confirmed both encodings resolve). No blocker.
- [x] **Projection aliasing verified for all derived outputs:** N/A for this WP — no engine projections produced. Viewer-side, the widened `Map<string, { label, description }>` values are constructed fresh per `new Map(entries.map(...))` in `glossaryClient.ts` and read-only from the viewer's perspective; no `G` fields touched.
- [x] **Functions the WP calls are actually exported:**
  - `KeywordGlossarySchema` / `RuleGlossarySchema` — will be exported from `packages/registry/src/schema.ts` (EC §Locked Values) and re-exported from `packages/registry/src/index.ts` (EC §Locked Values "Registry re-exports").
  - `setGlossaries`, `getKeywordGlossaryMap`, `getRuleGlossaryMap` — already exported from `useRules.ts` ✓
  - `rebuildGlossaryEntries` — exported from `useGlossary.ts:117` ✓
  - `getKeywordGlossary`, `getRuleGlossary` — exported from `glossaryClient.ts:33, 74` ✓
  - `devLog` — exported from `src/lib/devLog.ts` (untouched by this WP) ✓
- [x] **WP approach does not require forbidden imports:**
  - `packages/registry/src/schema.ts` imports `zod` only (line 29) ✓; new schemas require no new imports.
  - `packages/registry/src/index.ts` imports from `./schema.js` only ✓; new re-exports require no new imports.
  - Viewer files will import `KeywordGlossarySchema`, `RuleGlossarySchema`, `KeywordGlossaryEntry`, `RuleGlossaryEntry` from `@legendary-arena/registry` — permitted per ARCHITECTURE.md line 201.
  - **Forbidden**: `@legendary-arena/game-engine`, `@legendary-arena/preplan`, `apps/server`, `pg`, `boardgame.io` in any changed file. EC §Guardrails enforces this; §Verification Step 16 greps the five changed viewer files.
- [x] **Filter/consumer input type contains all needed data:** Not a filter WP in the WP-029 sense. The widened keyword Map value and the `RuleEntry` widening together provide all data the panel needs (`label` + `description` + `pdfPage`). EC §Locked Values "GlossaryPanel.vue" lists the exact prop plumbing.

**No blocking dependency-contract issues identified.**

Precedent alignment: this WP is a viewer-layer successor to WP-060 / EC-106 (glossary data migration) with strict reuse of the `glossaryClient.ts` singleton shape, `setGlossaries` mount-time installation, and `lookupKeyword` / `lookupRule` algorithmic-body preservation. The schema-authority centralization follows WP-003 / `.claude/rules/registry.md`. The "no fallback UI for missing `rulebookPdfUrl`" silence-is-the-contract pattern extends the WP-028 lifecycle-isolation precedent (WP-028 / §Lifecycle wiring creep risk).

---

## Input Data Traceability Check

- [x] All non-user-generated inputs are listed in `docs/03.1-DATA-SOURCES.md` — YES, with two pending updates in Commit A (the existing `keywords-full.json` row moves from 113 → 123 entries and gains a schema-reference note; the `rules-full.json` row gains a schema-reference note; **two new rows** are added for the rulebook PDF artifact and the markdown extract).
- [x] The storage location for each input is known:
  - `data/metadata/*.json` — Git repo + R2 (`images.barefootbetters.com/metadata/`)
  - `docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf` — Git repo + R2 (`images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf` after Commit A)
  - `docs/legendary-universal-rules-v23.md` — Git repo only (reference artifact; not linked from runtime code)
  - `docs/Marvel Legendary Universal Rules v23.txt` — Git repo only (reproducible source for the markdown extract)
  - `apps/registry-viewer/public/registry-config.json` — Git repo (bundled into the Cloudflare Pages deploy at `cards.barefootbetters.com`)
- [x] It is possible to determine which data source(s) to inspect if behavior is incorrect — YES; `03.1-DATA-SOURCES.md` is the inspection map.
- [x] The WP does not introduce implicit data — confirmed; `label` / `pdfPage` values come verbatim from the rulebook PDF, sourced via the committed markdown extract.
- [x] Setup-time derived fields introduced or modified — NONE; this is not a setup-time WP.

**All YES.** No traceability concerns.

---

## Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — **confirmed this session**: `pnpm -r build` exits 0; `pnpm -r --if-present test` reports **596 passing / 0 failing** across 7 packages. Baseline locked at 596/0.
- [x] No known EC violations remain open — WP-036 / EC-036 governance close landed at `45ddb49`; prior EC index shows 6 Done / no open violations.
- [x] Required types/contracts exist and are exported — `RuleEntry`, `setGlossaries`, `getKeywordGlossaryMap`, `getRuleGlossaryMap`, `lookupKeyword`, `lookupRule`, `rebuildGlossaryEntries`, `getKeywordGlossary`, `getRuleGlossary`, `KeywordGlossary` / `RuleGlossary` (viewer-local), `HERO_CLASS_GLOSSARY`, `devLog` — all audited.
- [x] No naming / ownership conflicts — `KeywordGlossaryEntrySchema` / `RuleGlossaryEntrySchema` / `KeywordGlossarySchema` / `RuleGlossarySchema` / `KeywordGlossaryEntry` / `RuleGlossaryEntry` are not currently defined anywhere in the repo (`grep` confirms); no collision.
- [x] No architectural boundary conflicts anticipated — Registry + Registry Viewer only. No game-engine / preplan / server / pg / boardgame.io touch points.
- [x] Database schemas / migrations — N/A (glossary data is R2-hosted, not PostgreSQL).
- [x] R2 data validation — `pnpm validate` was not re-run in-session, but WP-060 / EC-106 closed with HTTP 200 confirmed at both glossary URLs; new artifact is an additive upload, not a data-validation prerequisite. Executor re-confirms at EC §Verification Steps 20–22.
- [x] G fields + subfields — N/A.

**All YES.**

---

## Runtime Readiness Check (Mutation & Framework)

*(Viewer-scope reading; engine-specific items are N/A because this WP does not touch the engine. The items below apply to the Vue composition API and the fetch boundary.)*

- [x] Expected runtime touchpoints are known — `App.vue:149` reads `config.rulebookPdfUrl` into a new `ref<string | null>(null)`; `App.vue:424` gains `:rulebook-pdf-url="rulebookPdfUrl"` prop. `glossaryClient.ts` fetch boundary adds `.safeParse(...)` branches. `useGlossary.ts` builder retargets label sources. `GlossaryPanel.vue` entry block (127–141) adds a conditional `<a>` below the description.
- [x] Framework context requirements — N/A (no boardgame.io `ctx`).
- [x] Existing test infrastructure can support required mocks — **no new tests required** per WP-082 + EC-107 (schema + metadata pass); optional registry-side tests mirror `theme.validate.ts` if authored, but not required.
- [x] Runtime wiring allowance (01.5) — engine clause **NOT INVOKED**; viewer analog invoked for (a) `GlossaryEntry` interface extension with `pdfPage?: number`, and (b) widened keyword Map value shape + `setGlossaries` signature widening + `lookupKeyword` three-site `.description` suffix addition. Cited in execution summary per WP-060 / D-6007 precedent.
- [x] No architecture-boundary violations expected — confirmed above.
- [x] Integration point code has been read and the call site is confirmed — `App.vue:149` config loader, `App.vue:170–183` glossary-load block, `App.vue:424` GlossaryPanel mount, `glossaryClient.ts:46/87` fetch-then-JSON boundary, `useGlossary.ts:52–55/60/71/94–100` targeted for deletion, `useRules.ts:40–46/156–199/207–221` for widening / preservation, `GlossaryPanel.vue:127–141` entry block — all audited.
- [x] New moves / hooks / stage gating — N/A.
- [x] Multi-step mutation ordering — N/A.
- [x] Registry data flow — Schemas added to the Registry package; viewer imports via `@legendary-arena/registry` package export. Build ordering (`pnpm -r build`) handles the topology; EC §Common Failure Smells notes `Cannot find module '@legendary-arena/registry'` as the smell if the registry package is not built first.
- [x] Phase transitions / observability flags / simultaneous conditions — N/A.
- [x] Unknown-type degradation — `glossaryClient.ts` Zod failures degrade via `console.warn(...)` + `return new Map()` (non-blocking fallback). Established in EC-106; reinforced by EC-107 §Locked Values.
- [x] Move functions outside framework context — N/A.
- [x] Mock / PRNG capability assumptions — N/A.

**All YES** (subject to the viewer-scope interpretation of the runtime items).

---

## Established Patterns to Follow (Locked Precedents)

This WP reuses precedents rather than inventing new ones. Direct precedent references:

- `themeClient.ts`-style **singleton IIFE fetcher** with `devLog` instrumentation and throw-for-App.vue-catch failure (EC-106 established; `glossaryClient.ts` extends to add `.safeParse(...)`).
- **`lookupKeyword` / `lookupRule` algorithmic-body preservation** under the glossary Map backing-store retarget (EC-106 lock; EC-107 extends with Map-value widening, three `.description` suffix adds).
- **Centralized schema authority** in `packages/registry/src/schema.ts` per `.claude/rules/registry.md` §Schema Authority (WP-003 precedent).
- **Non-throwing fetch validation** via `.safeParse(...)` + `console.warn` + empty-Map fallback (extends EC-106's non-blocking-at-the-boundary pattern).
- **`target="_blank"` + `rel="noopener"` + `@click.stop`** for the new PDF deep-link anchor (reuses the viewer's existing `<a>` patterns; no new security surface).
- **Silent config-absence contract** (anchor omitted without warning when `rulebookPdfUrl` is missing) — WP-028 lifecycle-isolation style.
- **Three-commit topology** (A0 `SPEC:` → A `EC-107:` → B `SPEC:`) per WP-060 / EC-106 precedent and all recent WPs.
- **EC slot retargeting in the 101+ series** (EC-107 is next-free after EC-106) per the seven-row retargeting chain documented in EC_INDEX.md line 210.
- **`.strict()`** on both entry schemas forces a governed-extension path — new pattern within `schema.ts` (existing schemas are permissive by design for real-data quirks; these entry schemas govern **new** authored metadata, not real shipped data, so strictness is appropriate — WP-033 / D-3303 author-facing vs. loader-facing schema distinction).
- **Optional-field conditional rendering** (`v-if="entry.pdfPage !== undefined && rulebookPdfUrl"`) — avoids `exactOptionalPropertyTypes` drift (WP-029 precedent).

No deviations from established patterns.

---

## Maintainability & Upgrade Readiness (Senior Review)

- [x] **Extension seam exists:** `.strict()` forces future field additions (e.g., `since`, `aliases`, `relatedRule`) to go through a schema update → governance → EC cycle; the Zod schemas + inferred types are the seam. `pdfPage?: number` is already optional and extensible to `pdfPageEnd?: number` (page ranges) without a breaking change.
- [x] **Patch locality:** fixing any single keyword `label` or `pdfPage` is a one-line edit to `data/metadata/keywords-full.json` + an R2 republish. Fixing a panel-rendering bug is localized to `GlossaryPanel.vue`. No cross-cutting change.
- [x] **Fail-safe behavior:** invalid JSON → Zod `.safeParse(...)` returns `!success` → full-sentence `console.warn` + empty Map → panel renders with zero entries; card view is unaffected. Missing `rulebookPdfUrl` → anchor silently absent; panel functional. Missing `pdfPage` on an entry → anchor silently absent for that entry. All three paths are deterministic no-ops with clear operator visibility.
- [x] **Deterministic reconstructability:** the rendered panel state is a pure function of the two JSON files + the config field. No hidden logging or side effects.
- [x] **Backward-compatible test surface:** no existing tests consume the glossary schemas directly. The widened keyword Map value shape is internal to the viewer and does not affect any test fixture.
- [x] **Semantic naming stability:** `KeywordGlossaryEntrySchema`, `RuleGlossaryEntrySchema`, `KeywordGlossarySchema`, `RuleGlossarySchema`, `KeywordGlossaryEntry`, `RuleGlossaryEntry` — all full-word, no MVP markers, no version suffixes. `label`, `pdfPage`, `rulebookPdfUrl`, `HERO_CLASS_LABELS` — canonical semantic names.

**All YES.**

---

## Code Category Boundary Check

- [x] `packages/registry/src/schema.ts` + `index.ts` → `data-input` category ✓
- [x] `data/metadata/*.json` → `data-input` category ✓
- [x] `docs/legendary-universal-rules-v23.md`, `docs/Marvel Legendary Universal Rules v23.txt`, `docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf`, `docs/03.1-DATA-SOURCES.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md` → `docs` category ✓
- [x] `apps/registry-viewer/**` → see §Risk RS-6. `apps/registry-viewer/` does not have a formal row in the 02-CODE-CATEGORIES.md Category Summary table (only `apps/server/` = `server`, `apps/arena-client/` = `client-app` (D-6511), `apps/replay-producer/` = `cli-producer-app` (D-6301)). Its import rules are authoritatively codified in ARCHITECTURE.md §Package Import Rules line 201; EC-101..EC-106 precedent normalizes modifications to this directory without a category row. **Non-blocking for WP-082** (no new directory is created inside `apps/registry-viewer/`; all modifications are to pre-existing files). A proactive governance improvement would be a follow-up WP / SPEC commit to add a `registry-viewer-app` or `browser-viewer-app` category to 02-CODE-CATEGORIES.md; that is out of scope here.
- [x] WP does not create files in a new directory — confirmed. All modifications are to existing directories.

**No blocking code-category boundary violations.**

---

## Scope Lock (Critical)

### WP-082 Is Allowed To

- **Create:** `docs/legendary-universal-rules-v23.md` (already exists on disk as untracked) — prepend Authority Notice + commit.
- **Create:** `docs/Marvel Legendary Universal Rules v23.txt` (already exists on disk as untracked) — commit as-is (reproducible `pdftotext -layout` source).
- **Create:** `docs/ai/execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md` (currently untracked) — land in Commit A0.
- **Modify:** `packages/registry/src/schema.ts` — append two entry schemas + two array schemas + two inferred types per EC §Locked Values (no edits to existing schemas).
- **Modify:** `packages/registry/src/index.ts` — extend existing `export { ... } from "./schema.js";` block with four new names; add parallel `export type { ... }` block for two new types.
- **Modify:** `data/metadata/keywords-full.json` — add `label` (required) + `pdfPage` (optional) to all 123 entries; preserve `description` byte-for-byte; remain alphabetical by `key`.
- **Modify:** `data/metadata/rules-full.json` — add `pdfPage` (optional) to determinable entries; preserve `label` + `summary` byte-for-byte; remain alphabetical by `key`.
- **Modify:** `apps/registry-viewer/public/registry-config.json` — add `rulebookPdfUrl` field.
- **Modify:** `apps/registry-viewer/src/lib/glossaryClient.ts` — import `KeywordGlossarySchema` + `RuleGlossarySchema` from `@legendary-arena/registry`; add `.safeParse(...)` at the fetch boundary; widen keyword Map value to `{ label, description }` per option (a); dot-joined issue-path rendering.
- **Modify:** `apps/registry-viewer/src/composables/useRules.ts` — widen `KeywordGlossary` / `setGlossaries` / `getKeywordGlossaryMap` / `lookupKeyword` per option (a); add `HERO_CLASS_LABELS` export; widen `RuleEntry` with `pdfPage?: number`; preserve every existing `// why:` comment in `lookupKeyword` / `lookupRule` verbatim; preserve `HERO_CLASS_GLOSSARY` content verbatim.
- **Modify:** `apps/registry-viewer/src/composables/useGlossary.ts` — delete `titleCase()` (function body + two call sites); delete dedup block (lines 52–55); retarget keyword label reads to the widened Map value; retarget hero-class label reads to `HERO_CLASS_LABELS`; extend `GlossaryEntry` with `pdfPage?: number`.
- **Modify:** `apps/registry-viewer/src/components/GlossaryPanel.vue` — accept `rulebookPdfUrl` prop; render the conditional anchor per EC §Locked Values (`@click.stop`, `target="_blank"`, `rel="noopener"`, class `entry-rulebook-link`).
- **Modify:** `apps/registry-viewer/src/App.vue` — add `ref<string | null>(null)` for `rulebookPdfUrl` populated from `config.rulebookPdfUrl ?? null` inside existing `onMounted` try; add `:rulebook-pdf-url="rulebookPdfUrl"` prop on `<GlossaryPanel />`. No other App.vue edit.
- **Modify:** `apps/registry-viewer/CLAUDE.md` — extend "Keyword & Rule Glossary" section with Zod / `label` / `pdfPage` / deep-link content; include the literal sentence **"Do not infer labels from keys under any circumstance."**
- **Modify:** `docs/03.1-DATA-SOURCES.md` — update keyword count (113 → 123); add schema-reference notes + rulebook PDF row.
- **Modify:** `docs/ai/DECISIONS.md` — append six governance decisions from WP §Governance; record **D-6001 supersession** (partial — Zod schemas now exist for glossary entries).
- **Modify (Commit A0):** `docs/ai/execution-checklists/EC_INDEX.md` — add EC-107 row.
- **Modify (Commit B):** `docs/ai/work-packets/WORK_INDEX.md` — flip WP-082 row to `[x]` with date + Commit A hash (row must be created at pre-flight per PS-1).
- **Modify (Commit B):** `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-107 row to `Done`.
- **R2 operator steps** (not `git` actions, performed between Commit A code landing and verification):
  - Upload `docs/Marvel Legendary Universal Rules v23 (hyperlinks).pdf` to `https://images.barefootbetters.com/docs/legendary-universal-rules-v23.pdf` with `Content-Type: application/pdf` and `Cache-Control: max-age=31536000, immutable`.
  - Republish `data/metadata/keywords-full.json` → `https://images.barefootbetters.com/metadata/keywords-full.json`.
  - Republish `data/metadata/rules-full.json` → `https://images.barefootbetters.com/metadata/rules-full.json`.

### WP-082 Is Explicitly Not Allowed To

- Modify `packages/game-engine/`, `packages/preplan/`, `packages/vue-sfc-loader/`, `apps/server/`, `apps/arena-client/`, `apps/replay-producer/`, or any file under `content/themes/`.
- Add Zod schemas anywhere other than `packages/registry/src/schema.ts`.
- Change `lookupKeyword` / `lookupRule` / `lookupHeroClass` / `parseAbilityText` / `AbilityToken` / `TokenType` function or type signatures.
- Change `lookupKeyword` / `lookupRule` algorithmic bodies except for the option (a) three-site `.description` suffix addition in `lookupKeyword`.
- Edit any existing `description` / `label` / `summary` text in either JSON file (byte-for-byte preservation).
- Reintroduce a `titleCase`-style helper under any name.
- Add a fallback UI when `rulebookPdfUrl` is absent.
- Add an inline PDF viewer embed (PDF.js or similar).
- Guess any `pdfPage` value — unverifiable sources must leave the field absent.
- Add new keyword or rule entries (counts locked at 123 / 20 for this WP).
- Introduce any `.reduce()` with branching logic, any `require()` or `.cjs` file, any `import *` barrel export, any `.test.mjs` file.
- Use `--no-verify` or `--no-gpg-sign`.
- Push to remote without explicit user request.
- Stage any dirty-tree file outside the in-scope five items listed by EC §Before Starting + the new EC file itself. `git add .` / `git add -A` / `git add -u` are forbidden per P6-27 / P6-44.
- Modify `pnpm-lock.yaml` (no new dependencies; `zod` is already in `packages/registry`).
- Execute if R2 credentials are not available — STOP and escalate rather than ship `rulebookPdfUrl` pointing at an unuploaded PDF.
- Execute if entry counts drift from the locked 123 / 20 at execution start — STOP and ask.

**Rule:** Anything not explicitly allowed is out of scope.

---

## Test Expectations (Locked Before Execution)

- **New tests:** **zero required.** Optional: registry-side Zod-schema tests mirroring `theme.validate.ts` (one `describe()` per file, `node:test` + `node:assert`). If authored, they live under `packages/registry/src/` and add (tests, +N) / (suites, +N `describe` blocks). If omitted, the execution summary must note that optional tests were skipped per EC §Out of Scope.
- **Existing test changes:** none. `lookupKeyword` algorithmic preservation is the EC-106 lock; EC-107 makes three `.description` suffix additions at existing `.get(...)` call sites — type-system changes propagate from `glossaryClient.ts` widening, but no test file references `getKeywordGlossaryMap()` return type directly.
- **Prior test baseline (locked):** **596 passing / 0 failing** (re-derived this session 2026-04-21):
  - `packages/registry`: 13 / 0 (2 suites)
  - `packages/vue-sfc-loader`: 11 / 0 (0 suites — top-level tests)
  - `packages/game-engine`: 444 / 0 (110 suites)
  - `apps/replay-producer`: 4 / 0 (2 suites)
  - `apps/server`: 6 / 0 (2 suites)
  - `packages/preplan`: 52 / 0 (7 suites)
  - `apps/arena-client`: 66 / 0 (0 suites)
  - `apps/registry-viewer`: (no test script — per EC-106 precedent)
- **Test boundaries:** no new test frameworks (`node:test` only); no `boardgame.io/testing` imports; no modifications to `makeMockCtx` or other shared helpers; no new `vue-sfc-loader` / `jsdom` test infra.
- **Defensive guards:** N/A (no existing test mocks are exposed to the changed code).

**Rule:** Test baseline is locked for execution. Any deviation must be documented in the execution summary and justified in the pre-commit review.

---

## Mutation Boundary Confirmation

**Skipped — Work Packet Class is Runtime Wiring (viewer-scope), not Behavior / State Mutation.** No `G` mutation occurs anywhere in WP-082's scope (no engine touch points at all).

---

## Risk & Ambiguity Review (Resolve Now, Lock for Execution)

### RS-1 — `keywords-full.json` pre-state is at +10 entries vs WP-060 close

- **Risk / ambiguity:** Committed copy of `data/metadata/keywords-full.json` at `412a31c` has 113 entries (per WP-060 close). Working-tree copy has 123 entries (confirmed in-session: `node -e` length probe). The 10 new keys (`chooseavillaingroup`, `defeat`, `galactusconsumestheearth`, `greyheroes`, `halfpoints`, `locations`, `poisonvillains`, `reveal`, `shards`, `wound`) are present on disk in the `{ key, description }` shape but have no `label` / `pdfPage` fields yet. EC-107 §Before Starting and §Locked Values anchor the 123-entry baseline.
- **Impact:** LOW. Accurately documented in WP §Session Context and EC §Before Starting.
- **Mitigation:** Session context file (see PS-3) must explicitly record the 113 → 123 drift and name the 10 new keys.
- **Decision / pattern to follow:** Baseline is **123 entries**, locked. If the count drifts from 123 at execution start, STOP. The 10 new entries are in-scope partial work; they will be folded into Commit A when their `label` / `pdfPage` fields are filled.

### RS-2 — Inherited dirty-tree contains 20+ items beyond EC's in-scope list

- **Risk / ambiguity:** `git status` shows 9 modified + 18 untracked paths. EC §Before Starting enumerates only 4 in-scope partial-work items (`keywords-full.json` M, `rules-full.json` M, `docs/Marvel Legendary Universal Rules v23.txt` ??, `docs/legendary-universal-rules-v23.md` ??) plus the EC file itself (`EC-107-keyword-rule-glossary-schema-and-labels.checklist.md` ??). The remaining items — `docs/00-INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/05-ROADMAP.md`, `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`, `docs/ai/invocations/session-wp079-*.md`, `docs/ai/session-context/session-context-wp060.md`, various untracked invocation / session-context / post-mortem / WP files, `.claude/worktrees/`, `content/themes/heroes/`, `docs/ai/ideas/`, `data/metadata/card-types-old.json` (D), `docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md` — are **all out of scope** for WP-082.
- **Impact:** MEDIUM. Ambiguity about staging discipline could leak unrelated work into Commit A.
- **Mitigation:** Session context file (PS-3) must catalogue every dirty-tree item and mark each as **in-scope** (five items) or **out-of-scope (quarantine)**. Executor stages by exact filename only per P6-27 / P6-44; `git add .` / `git add -A` / `git add -u` are forbidden.
- **Decision / pattern to follow:** In-scope staging set for Commit A (execution):
  1. `data/metadata/keywords-full.json` (M)
  2. `data/metadata/rules-full.json` (M) — subject to RS-3 clarification
  3. `docs/Marvel Legendary Universal Rules v23.txt` (?? → staged)
  4. `docs/legendary-universal-rules-v23.md` (?? → staged)
  5. All *new* edits performed by EC-107 (schema.ts, index.ts, registry-config.json, glossaryClient.ts, useGlossary.ts, useRules.ts, GlossaryPanel.vue, App.vue, viewer CLAUDE.md, 03.1-DATA-SOURCES.md, DECISIONS.md).

  In-scope staging set for Commit A0 (pre-flight bundle): WP-082 amendments (if any) + EC-107 checklist + EC_INDEX.md row + this pre-flight file + copilot check + session prompt.

  In-scope staging set for Commit B (governance close): STATUS.md (if exists) + WORK_INDEX.md (WP-082 `[ ]` → `[x]`) + EC_INDEX.md (EC-107 → Done) + DECISIONS.md (if any additional entries).

  Everything else stays untouched and unstaged.

### RS-3 — `rules-full.json` modification scope unclear

- **Risk / ambiguity:** `git status` shows `rules-full.json` M. EC §Before Starting requires: "if only whitespace / ordering drift, revert; if content change, surface at pre-flight before execution."
- **Impact:** LOW-MEDIUM. A surprise content change could violate the byte-for-byte preservation guardrail.
- **Mitigation:** Verified in-session — the working-tree `rules-full.json` has **20 entries, alphabetical by `key`, zero duplicates**, and fields `{ key, label, summary }` per entry (same shape as the WP-060 close). A focused `git diff data/metadata/rules-full.json` at execution start is a blocking precondition for Commit A. If the diff is whitespace-only or re-ordering-only, revert and re-apply only the `pdfPage` additions; if the diff is content, STOP and escalate.
- **Decision / pattern to follow:** Executor runs `git diff data/metadata/rules-full.json` as the first step after reading EC. Whitespace / ordering → revert; content → STOP.

### RS-4 — `.strict()` is the first use in `packages/registry/src/schema.ts`

- **Risk / ambiguity:** Existing registry Zod schemas are permissive by design (`LeadsEntrySchema` uses `.catchall(z.unknown())` on line 94; `HeroCardSchema` uses optional/nullable extensively per schema.ts lines 101–123). Adding `.strict()` on two new entry schemas introduces a new pattern in the same file.
- **Impact:** LOW. Distinct author-facing vs loader-facing schema pattern per WP-033 / D-3303 precedent.
- **Mitigation:** Document the distinction in the `// why:` block above the new schemas (EC §Locked Values already requires the comment). The `// why:` copy must include the author-facing / loader-facing rationale.
- **Decision / pattern to follow:** Use the exact `// why:` block from EC §Locked Values; the author-facing-strict-vs-loader-permissive distinction is implicit and acceptable. No new DECISIONS.md entry required beyond the six already in WP §Governance.

### RS-5 — `lookupKeyword` has three `.get(...)` call sites, not one

- **Risk / ambiguity:** EC §Locked Values says the `lookupKeyword` body "collapses to a one-line `.description` access inside the existing branches." Actual body has **three** `.get(...)` call sites (line 160 exact, line 164 stripped, line 198 best-match), each requiring `.description`. The wording is slightly off.
- **Impact:** LOW. The behavior is unchanged; the wording is cosmetic.
- **Mitigation:** Executor reads the actual `useRules.ts:156–199` body before applying the widening and makes three (not one) `.description` suffix additions. Existing `// why:` comments at lines 159, 162, 166 preserved verbatim.
- **Decision / pattern to follow:** Three `.description` additions at lines 160, 164, 198 (identifier-only changes; no algorithmic branch re-ordering). EC-106 algorithmic-preservation lock holds.

### RS-6 — `apps/registry-viewer/` has no formal code-category row

- **Risk / ambiguity:** 02-CODE-CATEGORIES.md Category Summary table (lines 36–49) lists `apps/server/` = `server`, `apps/arena-client/` = `client-app` (D-6511), `apps/replay-producer/` = `cli-producer-app` (D-6301), but not `apps/registry-viewer/`. Import rules are authoritatively codified in ARCHITECTURE.md §Package Import Rules line 201; EC-101..EC-106 precedent normalized modifications.
- **Impact:** LOW (for WP-082). Non-blocking: no new directory is created inside `apps/registry-viewer/` by WP-082; all modifications are to pre-existing files.
- **Mitigation:** Flag as a latent governance gap for a future follow-up WP / SPEC commit (e.g., add a `browser-viewer-app` category row to 02-CODE-CATEGORIES.md with a D-NNNN reference). Do NOT expand WP-082 scope to fix this.
- **Decision / pattern to follow:** No action within WP-082. Acknowledged as pre-existing tech debt; recommend filing a standalone governance SPEC.

### RS-7 — `setGlossaries` signature widening cascades across four files

- **Risk / ambiguity:** The widened keyword Map value `{ label: string; description: string }` ripples through: (1) `glossaryClient.ts` fetch-result shape, (2) `useRules.ts` module-scope holder type + `setGlossaries` parameter + `getKeywordGlossaryMap` return type + three `.get(...)` sites in `lookupKeyword`, (3) `useGlossary.ts` `buildAllEntries()` keyword-entry loop reads `.label` / `.description` from the widened value instead of treating the value as a raw string, (4) `App.vue` is untouched because `setGlossaries(keywords, rules)` is called with the already-widened `keywords` produced by `getKeywordGlossary()`.
- **Impact:** LOW-MEDIUM. TypeScript will fail fast at the build step if any call site is missed. The fallback option (b) in EC-107 requires a DECISIONS.md entry before adoption — **not permitted without explicit user authorization**.
- **Mitigation:** Executor runs `pnpm -r --if-present typecheck` after each viewer-file edit. If a type error surfaces that cannot be resolved with a one-line widening, STOP and escalate — do NOT pivot to option (b) without authorization.
- **Decision / pattern to follow:** Option (a) is locked. Option (b) is forbidden without a new DECISIONS.md entry authored before adoption.

### RS-8 — `titleCase` deletion cascades into two paths (keywords + hero classes)

- **Risk / ambiguity:** `useGlossary.ts:60` uses `titleCase(key)` for keyword entries; `useGlossary.ts:71` uses `titleCase(key)` for hero-class entries. Deleting `titleCase` without a replacement for both sites would produce raw lowercase display names for hero classes in the panel.
- **Impact:** MEDIUM. A stale hero-class label would be a visible regression.
- **Mitigation:** EC §Locked Values "useGlossary.ts edits #4" requires a new `HERO_CLASS_LABELS: Map<string, string>` constant in `useRules.ts` with exactly 5 entries (`"Covert"`, `"Instinct"`, `"Ranged"`, `"Strength"`, `"Tech"`). The hero-class loop reads `HERO_CLASS_LABELS.get(key) ?? key` for display.
- **Decision / pattern to follow:** Executor authors `HERO_CLASS_LABELS` in `useRules.ts` (exported); `useGlossary.ts` hero-class loop reads from it. Manual smoke test 24b enforces the outcome. The `// why:` comment on `HERO_CLASS_LABELS` must cite "no future contributor reintroduces a `titleCase`-style helper" per EC §Required `// why:` Comments.

### RS-9 — D-6001 is partially superseded by WP-082

- **Risk / ambiguity:** D-6001 ("Keyword and Rule Glossary Data Is Display-Only, No Zod Schema") was authored at WP-060. WP-082 §G adds Zod schemas. D-6001 is superseded **in part** (the "no Zod schema" clause); the "display-only" clause remains accurate.
- **Impact:** LOW. Decision-supersession is a normal governance flow.
- **Mitigation:** WP §Governance enumerates six new decisions; the first (Zod schemas added) is the supersession vehicle. Add a one-line back-pointer to the new decision from D-6001, or mark D-6001 with a `**Superseded by:** D-NNNN` line (house-style TBD — match the existing DECISIONS.md supersession patterns).
- **Decision / pattern to follow:** Executor adds the supersession back-pointer in the Commit B DECISIONS.md update, using the first WP §Governance decision as the anchor.

### RS-10 — 01.7 copilot check is mandatory for this WP class

- **Risk / ambiguity:** Per `01.7-copilot-check.md` §When Copilot Check Is Required, **Runtime Wiring** class WPs require the copilot check before the session prompt is generated. WP-082 is Runtime Wiring (viewer-scope).
- **Impact:** LOW. Pre-flight verdict READY → copilot check is the next gate.
- **Mitigation:** Run the 30-issue lens against this pre-flight + WP-082 + EC-107 in the same session after this pre-flight's verdict is logged. Append the result as `## Copilot Check` within this file or save to a separate artifact following WP-036 / WP-060 precedent.
- **Decision / pattern to follow:** Copilot check follows this pre-flight in the same session, per the workflow table in `01.4` + `01.7`.

### RS-11 — `docs/legendary-universal-rules-v23.md` size and scope preservation

- **Risk / ambiguity:** The markdown extract is 5262 lines (5250 lines of `pdftotext -layout` output + 12 lines of preamble + blank lines). EC §A wording "Lightly clean" leaves some authorial discretion. Prepending the Authority Notice is the only mandatory edit per EC §Locked Values; any other "light clean" must not invent content.
- **Impact:** LOW-MEDIUM. Over-aggressive cleaning would undermine the file's role as the authoritative `pdfPage` source.
- **Mitigation:** Executor prepends **only** the Authority Notice blockquote before any heading and commits the rest of the file as-is. Any other cleaning is explicitly out of scope for this WP.
- **Decision / pattern to follow:** The file's "light cleaning" is limited to (1) prepending the Authority Notice, and (2) the existing transcription work already authored before this pre-flight. No further editing.

### RS-12 — Zod package version in viewer package

- **Risk / ambiguity:** Viewer imports `KeywordGlossarySchema` / `RuleGlossarySchema` from `@legendary-arena/registry`. The viewer's own `zod` dependency version (if any) might differ from the registry's. Zod's runtime is type-safe across minor versions but a major-version mismatch could cause `.safeParse` shape drift.
- **Impact:** LOW. `zod` is a peer dependency pattern in most monorepos; `pnpm-lock.yaml` will expose any drift.
- **Mitigation:** Executor verifies `pnpm-lock.yaml` is unmodified post-execution (EC §Common Failure Smells). If `zod` versions differ between packages, the registry export flows through the registry's Zod runtime, which is the single authority.
- **Decision / pattern to follow:** No action required; verify `pnpm-lock.yaml` absence from `git diff` post-execution per P6-44.

**No HIGH-impact risks identified.** All risks are LOW or MEDIUM with concrete mitigations.

---

## Pre-Flight Verdict (Binary)

### **READY TO EXECUTE** — conditional on resolution of PS-1, PS-2, PS-3, PS-4 below.

**Justification (6 sentences):**

1. **Dependency readiness:** WP-060 / EC-106 is complete at `412a31c`; all four Foundation Prompts are green; baseline `pnpm -r build` and `pnpm -r --if-present test` both exit 0 at HEAD `45ddb49` with a locked **596 passing / 0 failing** test baseline. **2. Contract fidelity:** every file path, line range, export, function signature, and data field in WP-082 + EC-107 was verified against the actual filesystem and source; three minor line-count drifts (1–2 lines in each of three viewer files) and one wording gap (`lookupKeyword` three `.get(...)` sites vs EC's "one-line `.description`") are documented as LOW-impact risks RS-5. **3. Scope lock clarity:** the allowed / forbidden lists are comprehensive, the three-commit topology is explicit, the five in-scope dirty-tree items are enumerated, and every forbidden action is guarded by either a `.githooks/commit-msg` rule or an EC §Guardrails clause. **4. Risks resolved:** twelve risks identified (RS-1..RS-12) are all LOW or MEDIUM with concrete mitigations locked in this pre-flight; no HIGH-impact risk surfaced. **5. Architectural boundary confidence:** Registry + Registry Viewer layers only; zero engine / preplan / server / pg / boardgame.io touch points; the new Zod schemas live in the sole schema authority file per `.claude/rules/registry.md`; `.strict()` is a governed-extension-path seam per WP-033 / D-3303 precedent. **6. Maintainability:** extension seams exist (Zod schemas + optional `pdfPage`), patch locality is excellent (single-file edits for most bug fixes), fail-safe behavior is deterministic (empty Map + `console.warn` on Zod failure; silent-absence on missing `rulebookPdfUrl` or `pdfPage`), and semantic naming is stable (no MVP / V1 / Simple markers).

**Pre-Session Actions (ALL BLOCKING — must complete before session prompt generation):**

- **PS-1 — Add WP-082 row to `docs/ai/work-packets/WORK_INDEX.md`.** Currently absent. Follow the format of existing rows in a relevant phase (likely Phase 6 / registry-viewer cluster near WP-060 or a new post-Phase-7 governance block). Dependencies: WP-060. Review status: `[ ]` → `✅ Reviewed` once lint-gate passes on the WP itself. Scope-neutral governance fix.

- **PS-2 — Add EC-107 row to `docs/ai/execution-checklists/EC_INDEX.md`.** Currently absent. Follow the EC-106 row format; Status `Draft`, to be flipped to `Done` in Commit B. This addition lands in Commit A0 per EC §Three-commit topology. Scope-neutral governance fix.

- **PS-3 — Author `docs/ai/session-context/session-context-wp082.md`.** Required by EC §Before Starting item 3 (dirty-tree map + in-scope partial-work identification) and standard workflow step 0. Template: follow WP-060 / WP-081 precedent. Must document:
  - HEAD at session start (`45ddb49`).
  - Branch (to become `wp-082-keyword-rule-glossary-schema-and-labels` once PS-4 is resolved).
  - Baseline test count (596 / 0) per-package breakdown.
  - Complete dirty-tree map with in-scope vs out-of-scope classification (≈27 items total; 5 in-scope).
  - The 113 → 123 keyword-count drift from WP-060.
  - The `rules-full.json` M drift (pending RS-3 diff inspection at execution start).
  - Inherited stash list (if any) from `git stash list`.

  Scope-neutral governance fix.

- **PS-4 — Cut fresh branch `wp-082-keyword-rule-glossary-schema-and-labels` from `45ddb49`.** Currently on `wp-036-ai-playtesting`. Not strictly forbidden by `.githooks/*` but required by EC §Before Starting item 2 ("or on a fresh `wp-082-…` branch cut from it"). Scope-neutral governance fix.

**All four PS actions are scope-neutral — no re-run of pre-flight is required once they resolve.** Log their resolution in the Authorized Next Step section below.

---

## Invocation Prompt Conformance Check (Pre-Generation)

To be performed once PS-1..PS-4 resolve and the session prompt is drafted.

- [ ] All EC-107 locked values copied verbatim into the invocation prompt (Zod schemas exact shape, Authority Notice blockquote text, config field exact shape, `glossaryClient.ts` issue-path rendering pattern, anchor HTML, `HERO_CLASS_LABELS` five entries).
- [ ] No new keywords, helpers, file paths, or timing rules appear only in the prompt.
- [ ] File paths match EC-107 + WP-082 + verified filesystem exactly.
- [ ] No forbidden imports or behaviors introduced by wording changes.
- [ ] The prompt does not resolve any ambiguity not already resolved here (RS-1..RS-12 are fully locked).
- [ ] Contract names and field names match verified source code (three-line drift in line-count claims is documented, not re-derived).
- [ ] Helper call patterns reflect actual signatures (option (a) Map widening; `lookupKeyword` three-site `.description`; `HERO_CLASS_LABELS` new export; `<GlossaryPanel :rulebook-pdf-url>` one-line plumbing).

The session prompt is a **transcription + ordering artifact**. No interpretation.

---

## Authorized Next Step

Once **PS-1 through PS-4 are resolved** and the **01.7 copilot check returns `CONFIRM`**, the executor is authorized to generate a session execution prompt for WP-082 saved as:

```
docs/ai/invocations/session-wp082-keyword-rule-glossary-schema-and-labels.md
```

**Guard:** The session prompt must conform exactly to the scope, constraints, and decisions locked by this pre-flight. No new scope may be introduced.

```
**Pre-session actions — PENDING (2026-04-21):**

1. PS-1 — Add WP-082 row to docs/ai/work-packets/WORK_INDEX.md (Phase 6 registry-viewer cluster or successor block).
2. PS-2 — Add EC-107 row to docs/ai/execution-checklists/EC_INDEX.md (Status: Draft).
3. PS-3 — Author docs/ai/session-context/session-context-wp082.md with dirty-tree map + baseline + 113→123 drift note + rules-full.json RS-3 pending-diff note.
4. PS-4 — Cut branch wp-082-keyword-rule-glossary-schema-and-labels from 45ddb49.

Log resolution inline as:

**Pre-session actions — ALL RESOLVED (YYYY-MM-DD):**

1. PS-1 resolved at commit <hash> — WORK_INDEX.md row <line> added for WP-082.
2. PS-2 resolved at commit <hash> — EC_INDEX.md row <line> added for EC-107.
3. PS-3 resolved at commit <hash> — session-context-wp082.md authored.
4. PS-4 resolved at commit <hash> — branch wp-082-keyword-rule-glossary-schema-and-labels cut.
```

---

## Final Instruction

This pre-flight is the authoritative audit surface for WP-082 readiness. If any clause above becomes stale between now and session-prompt generation (HEAD advances, test baseline moves, dirty-tree changes), re-run pre-flight rather than patching in place. The 01.7 copilot check must run **in the same session** as this pre-flight, before the session prompt is generated, per `01.7-copilot-check.md` §Workflow Position.

**Verdict reiteration: READY TO EXECUTE (conditional on PS-1..PS-4 + 01.7 CONFIRM).**

---

## Copilot Check — WP-082 (Keyword & Rule Glossary Schema, Labels, and Rulebook Deep-Links)

**Date:** 2026-04-21
**Pre-flight verdict under review:** READY TO EXECUTE (conditional on PS-1..PS-4) — 2026-04-21
**Inputs reviewed:**
- EC: `docs/ai/execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md`
- WP: `docs/ai/work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md`
- Pre-flight: this file, sections above.

### Overall Judgment

**RISK**

The pre-flight, WP, and EC form a tight, precedent-aligned package that explicitly prevents most of the 30 failure modes. Categories 1 (Separation of Concerns), 2 (Determinism), 3 (Mutation Discipline), 5 (Persistence), 9 (Documentation), and 11 (Single Responsibility) all resolve to clean PASS via established WP-060 / WP-028 / WP-033 / `.claude/rules/registry.md` precedents. The RISK findings are governance / wording gaps — not architectural or determinism hazards — and all are scope-neutral: four blocking Pre-Session Actions already identified in the pre-flight (covered by Issue #30), a canonical-array concern (Issue #4) resolved by the fact that `.strict()` forces the governed-extension path, and minor rendering-semantics lock wording gaps (Issues #10, #22, #26). No finding would cause architectural or determinism damage if execution proceeded without remediation, so this does not escalate to BLOCK; however, the RISK findings must be resolved in-place before the session prompt is generated.

### Findings

**Category 1 — Separation of Concerns & Boundaries**

1. **#1 Engine vs UI / App Boundary Drift — PASS** — EC §Guardrails explicitly forbids `packages/game-engine/`, `packages/preplan/`, `apps/server/`, `pg`, and `boardgame.io` imports; EC §Verification Step 16 greps the five changed viewer files for the prohibition; pre-flight §Dependency Contract Verification audits every import path; ARCHITECTURE.md §Package Import Rules line 201 is the authoritative constraint and WP cites it explicitly in §Context.

2. **#9 UI Re-implements or Re-interprets Engine Logic — PASS** — Glossary data is display-only per D-6001 (partially superseded by WP-082 §G but the display-only clause holds); no engine outcomes computed; WP is explicit that `lookupKeyword` / `lookupRule` algorithmic bodies are preserved byte-for-byte; the new Zod schemas live in the Registry layer (the data-authority boundary), not in the viewer.

3. **#16 Lifecycle Wiring Creep — PASS** — Pre-flight §Runtime Readiness Check explicitly declares "01.5 runtime-wiring allowance NOT INVOKED as an engine-contract clause"; viewer-scope analog is cited for two specific items (`GlossaryEntry` extension + widened Map value); EC §01.5 runtime-wiring allowance section makes the same distinction; no new function is wired into `game.ts`, any phase hook, or any move (there is no engine to wire into).

4. **#29 Assumptions Leaking Across Layers — PASS** — Registry layer owns schema authority per `.claude/rules/registry.md`; viewer consumes types via `@legendary-arena/registry` package export (one-directional dependency); engine does not know about glossary data at all (no import from viewer or registry into engine code for this purpose).

**Category 2 — Determinism & Reproducibility**

5. **#2 Non-Determinism Introduced by Convenience — PASS** — No `Math.random`, `Date.now`, `performance.now`, locale-dependent behavior, or ordering-sensitive operations introduced. `glossaryClient.ts` already uses `performance.now()` for devLog timing (pre-existing, non-replay-affecting). JSON alphabetical ordering enforced by `localeCompare` verification step 9.

6. **#8 No Single Debugging Truth Artifact — PASS** — `console.warn(...)` at the fetch boundary produces operator-readable, deterministic diagnostics; the warning sentence is locked in EC §Locked Values "Zod validation" with six specific content requirements; the `data/metadata/*.json` files are Git-versioned and reproducible from the markdown extract (via `pdfPage`) back to the PDF source.

7. **#23 Lack of Deterministic Ordering Guarantees — PASS** — Both JSON arrays are alphabetical by `key` using `localeCompare` (verification step 9); Map iteration order in JS is insertion order, which is preserved through the `new Map(entries.map(...))` construction; `buildAllEntries()` sort at `useGlossary.ts:77–85` is preserved verbatim.

**Category 3 — Immutability & Mutation Discipline**

8. **#3 Confusion Between Pure Functions and Immer Mutation — PASS** — No Immer / `G` / engine involvement. Viewer Maps are constructed fresh, never mutated after construction; `setGlossaries` installs the Map once.

9. **#17 Hidden Mutation via Aliasing — PASS** — `glossaryClient.ts` constructs fresh Maps per fetch; `useGlossary.ts buildAllEntries()` returns a fresh array (spread-copy pattern is not needed because the source is a Map, not a `G` field); `GlossaryPanel.vue` reads via Vue reactivity (`ref`); no aliasing risk identified. Pre-flight §Maintainability "Backward-compatible test surface" addresses this.

**Category 4 — Type Safety & Contract Integrity**

10. **#4 Contract Drift Between Types, Tests, and Runtime — RISK**
    **Issue:** EC §Locked Values "Zod schemas" lists the exact schema shape, but there is no **drift-detection test** pairing the new Zod schemas with a canonical readonly array the way `MATCH_PHASES` / `TURN_STAGES` / `CORE_MOVE_NAMES` / `RULE_TRIGGER_NAMES` / `RULE_EFFECT_TYPES` / `REVEALED_CARD_TYPES` are paired with their union types. Per `.claude/rules/code-style.md` §Drift Detection, "Drift-detection tests must assert arrays exactly match their union types." However, these glossary schemas are **not closed enumerations** — keywords and rules are open-ended content that will grow over time, so no canonical array exists to compare against. The `.strict()` modifier forces a governed-extension path (any new field requires editing the schema + schema.ts file + DECISIONS.md entry), which is the **WP-033 / D-3303 author-facing-strict pattern** — a valid substitute for drift-detection tests. Still: the pre-flight and EC should explicitly state that drift detection is **satisfied by `.strict()`**, not by a canonical-array parity test, so a future reviewer doesn't file a false-positive "missing drift-detection test" finding.
    **FIX:** In the Commit B `DECISIONS.md` entry that records Zod schema addition (WP §Governance first bullet), add a one-sentence note: *"Drift detection for glossary schemas is enforced by `.strict()` + governed-extension path rather than canonical-array parity, because glossary entries are open-ended content rather than a closed engine enumeration (WP-033 / D-3303 author-facing-strict precedent)."* No test addition required. Scope-neutral.

11. **#5 Optional Field Ambiguity (`exactOptionalPropertyTypes`) — PASS** — `pdfPage?: number` on entry schemas; the anchor `v-if` explicitly checks `entry.pdfPage !== undefined && rulebookPdfUrl`; `RuleEntry.pdfPage?: number` widening follows the same pattern. EC §Locked Values anchor shape demonstrates conditional rendering, which avoids the `exactOptionalPropertyTypes` footgun (WP-029 precedent cited in §Risk RS-12 pattern).

12. **#6 Undefined Merge Semantics (Replace vs Append) — PASS** — Not applicable: this WP does not introduce overrides or merge logic. `setGlossaries` replaces the holder state (never merges); JSON files are full documents, not partial overrides.

13. **#10 Stringly-Typed Outcomes and Results — RISK**
    **Issue:** `lookupKeyword` returns `string | null`; `lookupRule` returns `RuleEntry | null`. These are preserved by the EC-106 algorithmic-body lock, so the return-type-level typing is already established. The new `glossaryClient.ts` `.safeParse(...)` result object is typed by Zod (`{ success: true; data: ... } | { success: false; error: ... }`) — this is a discriminated union, already typed correctly. However, the `console.warn` warning sentence is a free-form string the EC locks by content requirements (six specific components) — a future contributor could drift the wording. This is not strictly "stringly-typed outcomes" in the failure-mode sense (no logic branches on the warning string), but locking the warning format as a shared helper function or a named constant would make the drift surface smaller.
    **FIX:** Not required. The EC §Locked Values "Zod validation" block already locks the six wording components; verification steps 12–13 grep for `safeParse`, `issue.path.join`; if future WPs extract a helper, that is a follow-up concern. **PASS on reconsideration** — the lens does not require extracting every locked string into a constant when the EC already enforces six content requirements + grep-based verification. Downgrade to PASS.

14. **#21 Type Widening at Boundaries — PASS** — `setGlossaries` signature widens from `Map<string, string>` to `Map<string, { label: string; description: string }>`; pre-flight §Dependency Contract Verification item "Function signatures are compatible" audits all call sites; TypeScript will fail fast at build time if any site is missed. The widening is fully typed; no `any` or `unknown` used at the boundary. `useRules.ts` module-scope holder type flows from the `setGlossaries` parameter type, maintaining type safety across the installation.

15. **#27 Weak Canonical Naming Discipline — PASS** — `label` is an established canonical field name in `00.2-data-requirements.md` (lines 391–404 for icons-meta, hero teams, hero classes, rules); `pdfPage` is new but self-describing and consistent with no-abbreviation naming discipline (`00.6-code-style.md` Rule 4 — full English words). `KeywordGlossaryEntrySchema` / `RuleGlossaryEntrySchema` / `HERO_CLASS_LABELS` are all full-word names with no MVP / V1 / Simple markers. Pre-flight §Maintainability "Semantic naming stability" confirms this.

**Category 5 — Persistence & Serialization**

16. **#7 Persisting Runtime State by Accident — PASS** — No `G` touchpoints; no engine state affected; glossary data is Registry Metadata (R2-hosted content), not engine runtime state. Pre-flight §Dependency Contract Verification "Persistence classification is clear" confirms this.

17. **#19 Weak JSON-Serializability Guarantees — PASS** — Zod schemas enforce primitive-only fields (`string`, `number`, optional `number`). No functions, Maps, Sets, or class instances in the JSON. Entry schemas are trivially serializable.

18. **#24 Mixed Persistence Concerns — PASS** — Clear persistence class separation: Registry Metadata (R2 JSON + PDF) vs viewer runtime state (`glossaryClient` Maps) vs display-only rendered DOM. No blurring of classes.

**Category 6 — Testing & Invariant Enforcement**

19. **#11 Tests Validate Behavior, Not Invariants — PASS** — Pre-flight §Test Expectations locks the **596 / 0** baseline across 7 packages at 2026-04-21; no new tests required by this WP; algorithmic preservation of `lookupKeyword` / `lookupRule` is enforced by manual smoke test 24g (hover-tooltip regression) + `grep -cE "(Suffix match|Substring match|Prefix match|space-hyphen)"` structural check at EC §Verification Step 15. Verification steps 2, 7, 8, 9 assert JSON invariants (schema parses, label presence, alphabetical + duplicate-free). The invariants are explicit and verifiable.

**Category 7 — Scope & Execution Governance**

20. **#12 Scope Creep During "Small" Packets — PASS** — Explicit allowlist at EC §Files to Produce + WP §Files Expected to Change + pre-flight §Scope Lock. "Anything not explicitly allowed is out of scope" stated at three separate authority levels. `git diff --name-only` verification step 23 enforces the allowlist. RS-2 in pre-flight enumerates out-of-scope dirty-tree items explicitly to prevent leakage.

21. **#13 Unclassified Directories and Ownership Ambiguity — PASS** — No new directories created by WP-082; all modifications are to pre-existing directories. RS-6 in pre-flight acknowledges the pre-existing `apps/registry-viewer/` classification gap as out-of-scope tech debt, not a blocker.

22. **#30 Missing Pre-Session Governance Fixes — RISK**
    **Issue:** The pre-flight identifies four blocking Pre-Session Actions (PS-1..PS-4), each scope-neutral. These must resolve before the session prompt is generated.
    **FIX:** Execute PS-1..PS-4 as listed in pre-flight §Authorized Next Step, log resolution in the same section, then proceed to session prompt generation. Scope-neutral governance fixes.

**Category 8 — Extensibility & Future-Proofing**

23. **#14 No Extension Seams for Future Growth — PASS** — `.strict()` forces governed-extension path for new fields; `pdfPage?: number` is extensible to `pdfPageEnd?: number` (page ranges) without breaking; the viewer's `GlossaryEntry` type is extensible. Pre-flight §Maintainability "Extension seam exists" confirms.

24. **#28 No Upgrade or Deprecation Story — RISK**
    **Issue:** WP-082 supersedes D-6001 in part ("no Zod schema" clause becomes obsolete; "display-only" clause remains). Pre-flight RS-9 notes this. The Rulebook PDF filename `legendary-universal-rules-v23.pdf` version-pins via `v23`; WP §Non-Negotiable Constraints and EC §Locked Values both state "a v24 rulebook is a new file, not a mutation" — this is the upgrade story, but it lives inline in the WP/EC text rather than as a top-level decision. The decision is enumerated as one of the six WP §Governance bullets ("…version-pinned by `v23` — a v24 rulebook is a new file, not a mutation") — acceptable, but the D-6001 supersession needs explicit back-pointer per the RS-9 mitigation.
    **FIX:** In Commit B's DECISIONS.md update, add `**Superseded by:** D-NNNN` back-pointer on D-6001's "No Zod Schema" clause (pointing to whichever new decision records the schema addition). Also explicitly mark the new Zod-schema decision with `**Supersedes:** D-6001 (partial — Zod schema clause only; display-only clause remains)`. Scope-neutral governance edit.

**Category 9 — Documentation & Intent Clarity**

25. **#15 Missing "Why" for Invariants and Boundaries — PASS** — EC §Required `// why:` Comments enumerates six specific sites (schema.ts, glossaryClient.ts path rendering, useRules.ts HERO_CLASS_LABELS, GlossaryPanel.vue @click.stop, App.vue rulebookPdfUrl). All existing `// why:` comments in `lookupKeyword` / `lookupRule` are preserved verbatim per EC §Guardrails. The `// why:` block above the two new entry schemas has verbatim text locked in EC §Locked Values.

26. **#20 Ambiguous Authority Chain — PASS** — Pre-flight §Authority Chain lists 13 documents in read order; EC header "If EC-107 and WP-082 conflict on design intent, the WP wins; on execution contract, the EC wins"; WP header cites `.claude/CLAUDE.md` → ARCHITECTURE.md → `.claude/rules/*.md`; override hierarchy is explicit at every level.

27. **#26 Implicit Content Semantics — RISK**
    **Issue:** The WP and EC both lock `#page=N` PDF deep-link syntax as "RFC 3778 §3 open-parameter syntax supported by Chrome, Firefox, Edge, and Safari native PDF viewers." This is implicit semantics — the `#page=N` behavior depends on the user's PDF viewer. If the user has Adobe Reader, the behavior may differ; mobile browsers may not support it; some organizations set a non-default PDF handler. The WP / EC handle this at the contract level ("Do not introduce any other PDF anchor syntax"), but there is no test assertion or manual smoke-test step that confirms `#page=N` behavior in non-Chromium browsers. Manual smoke 24c / 25c tests only "browser opens PDF in a new tab at the correct page" — implicitly testing the primary dev browser.
    **FIX:** Add to EC §Manual DEV smoke or §Manual PROD smoke a one-line note: *"Validate `#page=N` deep-link behavior in at least one Firefox and one Safari instance, not only the primary dev browser."* Alternatively, accept the risk as documented in a WP §Non-Negotiable Constraints footnote ("Browser compatibility is the user's responsibility; mobile in-app browsers may fall back to page 1 — this is acceptable UX drift, not a defect."). Either addition is scope-neutral and improves content-semantics auditability.

**Category 10 — Error Handling & Failure Semantics**

28. **#18 Outcome Evaluation Timing Ambiguity — PASS** — Not applicable. Glossary data has no game-outcome semantics; there is no "before vs after game end" question. Fetch timing is deterministic (`App.vue onMounted` → `Promise.all([getKeywordGlossary, getRuleGlossary])` → `setGlossaries` → `rebuildGlossaryEntries`), established by EC-106.

29. **#22 Silent Failure vs Loud Failure Decisions Made Late — PASS** — Explicit fail-soft policy locked in three places: (a) Zod `.safeParse` failure → `console.warn` + empty Map fallback + non-blocking; (b) missing `rulebookPdfUrl` config → silent anchor omission (documented as "supported configuration, not an error state"); (c) missing `pdfPage` on entry → silent anchor omission. All three are deterministic no-ops with clear operator visibility. Full-sentence warning messages per `00.6-code-style.md` Rule 11 (six content requirements locked). `.parse` (throwing) is explicitly forbidden by EC §Guardrails; verified by grep step 12.

**Category 11 — Single Responsibility & Logic Clarity**

30. **#25 Overloaded Function Responsibilities — PASS** — Clean separation: `glossaryClient` does fetch + parse + validate; `useRules` holds Maps + exposes lookups; `useGlossary` builds display entries; `GlossaryPanel` renders. No function does merging + validation + evaluation + mutation. EC §Files to Produce respects function-per-file boundaries.

### Mandatory Governance Follow-ups

- **DECISIONS.md entry (Commit B):** Add six new decisions per WP §Governance; explicitly mark the first decision (Zod schemas added) as `**Supersedes:** D-6001 (partial — Zod schema clause only; display-only clause remains)`; add a `**Superseded by:** D-NNNN` back-pointer on D-6001. (Resolves Findings #10 + #24.)
- **02-CODE-CATEGORIES.md update:** **NOT REQUIRED for WP-082.** Pre-existing `apps/registry-viewer/` classification gap is out-of-scope tech debt (pre-flight RS-6). Recommend a follow-up standalone governance SPEC commit to add a `browser-viewer-app` category row.
- **.claude/rules/*.md update:** **NOT REQUIRED.** No new enforcement pattern introduced.
- **WORK_INDEX.md update:** Required via PS-1 (Commit A0: add WP-082 row) and Commit B (flip `[ ]` → `[x]`).
- **EC_INDEX.md update:** Required via PS-2 (Commit A0: add EC-107 row) and Commit B (flip to `Done`).
- **Session-context file:** Required via PS-3 (`docs/ai/session-context/session-context-wp082.md`).
- **Branch cut:** Required via PS-4 (fresh `wp-082-*` branch from `45ddb49`).
- **Manual smoke test augmentation:** Optional scope-neutral improvement per Finding #27 — add a Firefox/Safari `#page=N` validation note in EC §Manual PROD smoke. Recommend but not blocking.

### Pre-Flight Verdict Disposition

- [x] **HOLD** — Apply listed FIXes in-place, re-run copilot check. No pre-flight re-run required (scope unchanged).
- [ ] CONFIRM
- [ ] SUSPEND

**Rationale for HOLD:** Three RISK findings surfaced (#4, #24, #27) plus the expected #30 governance-fix finding. All four are scope-neutral:
- #4 is a one-sentence addition to the new DECISIONS.md entry;
- #24 is a supersession back-pointer pair (D-6001 ↔ new decision);
- #27 is a one-line addition to EC §Manual PROD smoke (or a WP §Non-Negotiable Constraints footnote accepting the risk);
- #30 is the PS-1..PS-4 resolution already enumerated in pre-flight §Authorized Next Step.

None change the WP allowlist, move the mutation boundary, introduce a new contract, or alter the test baseline. After resolving these four (and re-running the copilot check to produce a 30/30 PASS snapshot in the same session or a follow-up appended block), the verdict flips to CONFIRM and session-prompt generation is authorized.

---

### Copilot Check Summary

- **Total issues reviewed:** 30 / 30
- **PASS:** 26 (Issues #1, #2, #3, #5, #6, #7, #8, #9, #10 [downgraded from initial RISK], #11, #13, #14, #15, #16, #17, #18, #19, #20, #21, #22, #23, #25, #28, #29)
- **RISK:** 4 (Issues #4, #24, #27, #30)
- **BLOCK:** 0
- **Net disposition:** HOLD — fix the four RISK items in-place, re-confirm, then proceed to session prompt generation.

**No finding would cause architectural or determinism damage if execution proceeded without remediation.** All RISK items are governance / wording / traceability improvements.

---

## Copilot Check — Re-Run 2026-04-21 (After A0 Fixes)

**Date:** 2026-04-21
**Scope of this re-run:** Confirm that the four RISK findings from the initial scan (Issues #4, #24, #27, #30) are resolved by the scope-neutral fixes landing in Commit A0 alongside this re-confirmation.
**Base artifacts (same as initial scan):**
- EC: `docs/ai/execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md` *(amended in A0: added §Manual PROD smoke item 25d for Firefox/Safari `#page=N` validation)*
- WP: `docs/ai/work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md` *(unchanged)*
- Pre-flight: this file, all sections above. *(amended in A0: this re-confirmation appended.)*
- Session prompt: `docs/ai/invocations/session-wp082-keyword-rule-glossary-schema-and-labels.md` *(locks drift-detection note language for RISK FIX #1 and D-6001 supersession back-pointers for RISK FIX #2 as Commit B tasks; Executor Quick Start + Option (α) ownership boundary + HERO_CLASS_LABELS WP-060 incident context added per the in-session review pass)*
- Session context: `docs/ai/session-context/session-context-wp082.md` *(new; authored in A0 per PS-3)*
- WORK_INDEX.md: WP-082 row added in A0 per PS-1
- EC_INDEX.md: EC-107 row added in A0 per PS-2
- Branch: `wp-082-keyword-rule-glossary-schema-and-labels` cut from `45ddb49` per PS-4

### Overall Judgment (Re-Run)

**PASS**

All four RISK findings are resolved scope-neutrally. No new findings surfaced. No BLOCKs. Pre-flight READY TO EXECUTE verdict stands and is now **unconditional** — session prompt generation is authorized, and the execution session may begin with Commit A.

### Findings (Re-Run — Delta Only)

**Issue #4 (Contract Drift) — PASS (was RISK).** Resolved: the session prompt §Pre-Session Gate 5 ("RISK FIX #1") locks the verbatim drift-detection sentence for the new DECISIONS.md entry in Commit B — *"Drift detection for glossary schemas is enforced by `.strict()` + governed-extension path rather than canonical-array parity, because glossary entries are open-ended editorial metadata rather than a closed engine enumeration (WP-033 / D-3303 author-facing-strict precedent)."* The session-context file §2.9 reiterates the author-facing-strict-vs-loader-permissive pattern. Future reviewers cannot file a false-positive "missing drift-detection test" finding.

**Issue #24 (Upgrade / Deprecation) — PASS (was RISK).** Resolved: session prompt §Pre-Session Gate 6 ("RISK FIX #2") locks the symmetric D-6001 supersession back-pointer pair for Commit B — `**Superseded by:** D-NNNN (partial — Zod schema clause only; display-only clause remains)` on D-6001, and `**Supersedes:** D-6001 (partial …)` on the new Zod-schema decision. Session context §2.8 reiterates. The upgrade story (version-pinned `v23` filename; v24 is a new file, not a mutation) is already captured in WP §Governance item 4.

**Issue #27 (Implicit Content Semantics) — PASS (was RISK).** Resolved: EC-107 §Manual PROD smoke gained item **25d** in A0 (*"Validate `#page=N` deep-link behavior in at least one Firefox and one Safari instance …"* with explicit acceptable-variance carve-out for mobile in-app WebViews and a STOP-and-escalate clause if a desktop Firefox/Safari in the last two major releases fails). The implicit RFC 3778 §3 dependency is now an explicit verification step.

**Issue #30 (Missing Pre-Session Governance Fixes) — PASS (was RISK).** Resolved: all four PS actions landed in A0:
- **PS-1** — WP-082 row added to `docs/ai/work-packets/WORK_INDEX.md` after WP-081 and before WP-084 (dependencies: WP-060, WP-003, WP-055; review status `✅ Reviewed 2026-04-21`; full notes block with locked values, drift cross-reference to 113→123 count, and 01.5 viewer-analog citation).
- **PS-2** — EC-107 row added to `docs/ai/execution-checklists/EC_INDEX.md` between EC-106 and EC-109 (Status `Draft`; Summary counts bumped in A0; will flip to `Done` in Commit B).
- **PS-3** — `docs/ai/session-context/session-context-wp082.md` authored (8 sections covering baseline / dirty-tree classification / 113→123 drift / RS-3 gate / option (α) ownership boundary / titleCase incident context / D-6001 supersession / `.strict()` first-use rationale / pre-flight RS resolution / commit topology / ready signal).
- **PS-4** — branch `wp-082-keyword-rule-glossary-schema-and-labels` cut from `45ddb49` by the operator (user-owned action).

**All remaining PASS verdicts from the initial scan (Issues #1, #2, #3, #5, #6, #7, #8, #9, #10, #11, #13, #14, #15, #16, #17, #18, #19, #20, #21, #22, #23, #25, #28, #29) are unchanged** — none of the A0 fixes touched the artefacts on which those verdicts were based, except for additive session-prompt improvements (Executor Quick Start, Authority Chain sub-headers, Option (α) ownership hard-lock, HERO_CLASS_LABELS WP-060 incident context, `MUST` emphasis, `(explicit authorization)` on the viewer analog invocation). Those improvements *strengthen* the relevant PASS findings (notably #1 Engine/UI Boundary Drift, #16 Lifecycle Wiring Creep, #22 Silent vs Loud Failure, #26 Implicit Content Semantics for the HERO_CLASS_LABELS context) and cannot downgrade any of them.

### Mandatory Governance Follow-ups (Re-Run)

- All remaining items from the initial scan's "Mandatory Governance Follow-ups" block stand unchanged (DECISIONS.md entries land in Commit B per session prompt §Pre-Session Gates 5–6; `02-CODE-CATEGORIES.md` update remains out of scope for this WP; no `.claude/rules/*.md` update required).
- No new governance follow-ups surfaced.

### Pre-Flight Verdict Disposition (Re-Run)

- [x] **CONFIRM** — Pre-flight READY TO EXECUTE verdict stands unconditionally. Session prompt generation authorized. The execution session may begin with Commit A at any time.
- [ ] HOLD
- [ ] SUSPEND

### Copilot Check Summary (Re-Run)

- **Total issues reviewed:** 30 / 30
- **PASS:** 30
- **RISK:** 0
- **BLOCK:** 0
- **Net disposition:** **CONFIRM** — HOLD → CONFIRM transition complete. A0 fixes landed. No remediation remains. Execution authorized.

**Every A0 artefact is now a ratified ancestor of the EC-107 execution commit**, per the governance bundle topology. The new Claude Code session consuming `session-wp082-keyword-rule-glossary-schema-and-labels.md` is authorized to begin **Commit A** without further governance gates.

