# WP-084 Pre-Flight Verdict

---

### Pre-Flight Header

**Target Work Packet:** `WP-084`
**Title:** Delete Unused Auxiliary Metadata Schemas and Files
**Execution Checklist:** `EC-109`
**Previous WP Status:** WP-036 Complete (commit `61df4c0`, 2026-04-21); WP-082/083 independent (do not block)
**Pre-Flight Date:** 2026-04-21 (initial); 2026-04-21 (A-084-01 amendment)
**Invocation Stage:** Pre-Execution (Scope & Readiness) — **amended**
**Current Verdict:** ⏳ **AWAITING GATE RE-RUN** — amendment A-084-01
resolves PS-1 / PS-2 / PS-3 / PS-4 / PS-8 on paper; verdict flips to
✅ **READY** once Gate 2 + Gate 3 re-runs confirm clean output
against the amended WP-084 + EC-109. See §Author Decision Log and
§Post-Amendment Gate Re-Run.

**Work Packet Class:** Delete-only subtractive — **Registry + Content /
Data hygiene**. Removes five unused Zod schemas + five JSON files + one
orphan + one `validate.ts` phase block. Produces no new code, no new
tests, no new dependencies, no replacement schemas.

Required sections applied: Dependency Check, Input Data Traceability,
Structural Readiness, Dependency Contract Verification, Scope Lock,
Test Expectations, Risk Review, STOP-Gate Status, Invocation Prompt
Conformance.
Skipped sections: Runtime Readiness Check, Mutation Boundary
Confirmation (delete-only packet does not introduce new mutations),
Maintainability & Upgrade Readiness (no new abstractions introduced).

---

### Pre-Flight Intent

Perform pre-flight validation for WP-084.

- Not implementing.
- Not deleting files.
- Not modifying schemas, loaders, or runtime code.
- Validating readiness and STOP-gate status only.

Blocking conditions discovered during this pre-flight. Verdict: **DO
NOT EXECUTE YET.** See §Pre-Session Actions for resolution path.

---

### Authority Chain (Read Before Execution)

1. `.claude/CLAUDE.md` — EC-mode rules, bug handling, commit discipline
2. `docs/ai/ARCHITECTURE.md` — Registry layer boundaries
3. `.claude/rules/registry.md` — Schema Authority; Immutable Files;
   **D-1203 silent-failure bug precedent**
4. `.claude/rules/code-style.md` — delete-only / no `.reduce()` /
   `Math.random()` invariants
5. `docs/ai/execution-checklists/EC-109-delete-unused-auxiliary-metadata.checklist.md`
6. `docs/ai/work-packets/WP-084-delete-unused-auxiliary-metadata.md`
7. `docs/ai/session-context/session-context-wp084.md` — branch,
   starting commit, scope declaration, baseline placeholders, STOP-gate
   progress

No conflicts detected between authority chain documents. If the EC and
WP conflict on design intent, the WP wins; on execution contract
(locked values, guardrails, STOP gates), the EC wins.

---

### Dependency & Sequencing Check

| WP     | Status                                                       | Notes |
|--------|--------------------------------------------------------------|-------|
| WP-082 | `Done` (commit `3da6ac3`, EC-107 2026-04-21)                 | Adds glossary schemas + labels. Orthogonal; its schemas remain locked byte-for-byte. |
| WP-083 | Draft — **does not block WP-084**                            | Fetch-time validation for viewer config + themes. Orthogonal. Its additions remain locked byte-for-byte if it lands first. |
| WP-036 | `Done` (commit `61df4c0`, 2026-04-21)                        | Immediate predecessor in commit history. Clean baseline. |

Per WP-084 §Dependencies: *"None. Independent of WP-082 and WP-083."*
Execution may proceed first, last, or sandwiched between siblings.
**Dependency gate: PASS.**

---

### Input Data Traceability Check

- ✅ All non-user-generated inputs consumed by this WP are listed in
  `docs/03.1-DATA-SOURCES.md` (the five targets, plus three survivors)
- ✅ Storage locations known: Git (`data/metadata/*.json`), with
  mirrors at `images.barefootbetters.com/metadata/` on R2
- ✅ Diagnostic path for incorrect behavior known: any data bug traces
  to the source JSON under `data/metadata/`; after deletion, the five
  targets are no longer a source and should not appear as a diagnostic
  location
- ✅ The WP does not introduce "implicit data" — the deletion is
  categorical
- ⚠ **Setup-Time Derived Data:** n/a. The deleted schemas have no
  derived G fields. The engine's setup-time resolution of card-type
  classification (`G.villainDeckCardTypes`) is built from per-set data,
  **not** from `data/metadata/card-types.json` (per WP §Session
  Context and confirmed against
  `packages/game-engine/src/setup/*`)

Traceability gate: **PASS.**

---

### Structural Readiness Check (Types & Contracts)

- ✅ The five schemas targeted by WP-084 are defined in
  `packages/registry/src/schema.ts` at lines 51, 61, 70, 79, 89
  (exact HEAD ranges `51–57`, `61–66`, `70–74`, `79–83`, `89–94`)
- ✅ The five target JSON files exist under `data/metadata/`; so does
  `card-types-old.json` (`git ls-files data/metadata/` returns 9
  paths — the 3 survivors + 5 targets + 1 orphan)
- ✅ `packages/registry/scripts/validate.ts` imports the five schemas
  at lines 51–55 (**re-derive at execution**) and invokes them at
  lines 379–383 via `checkMetadataFiles` at lines 372–384
- ✅ **Registry Immutable Files rule (`.claude/rules/registry.md`):**
  `schema.ts` is listed as immutable "unless strong justification".
  WP-084's 2026-04-21 no-consumer audit is the justification; a
  `DECISIONS.md` entry is required per the rules file. The EC
  confirms this at §Governance.
- ❌ **BLOCKER 1 — Viewer `localRegistry.ts` actively reads
  `card-types.json`** (see RS-1 below)
- ❌ **BLOCKER 2 — `00.2-data-requirements.md` lists all five files
  as active data contracts** (see RS-2 below)

Structural Readiness gate: **FAIL — two blockers.**

---

### Dependency Contract Verification

Cross-checked every name and line range in EC-109 §Locked Values
against the actual source files.

- ✅ **Schema identifiers match byte-for-byte:**
  `CardTypeEntrySchema` (schema.ts:51) / `HeroClassEntrySchema`
  (schema.ts:61) / `HeroTeamEntrySchema` (schema.ts:70) /
  `IconEntrySchema` (schema.ts:79) / `LeadsEntrySchema` (schema.ts:89).
  All exported with `export const …`. No inferred `z.infer<typeof …>`
  type aliases are exported for any of the five (verified against
  `schema.ts` and `index.ts`).
- ✅ **JSON filenames match:** `card-types.json`, `hero-classes.json`,
  `hero-teams.json`, `icons-meta.json`, `leads.json`, and
  `card-types-old.json` exist in `data/metadata/` exactly as named.
- ✅ **`validate.ts` import block:** five target schemas imported at
  lines 51–55 alongside `RegistryConfigSchema` (line 49),
  `SetIndexEntrySchema` (line 50), `SetDataSchema` (line 56). Only the
  five targets are to be removed; three other imports preserved.
- ✅ **`validate.ts` Phase 2 boundaries:** `checkMetadataFiles` at
  lines 372–384 contains five `await checkOneMetadataFile(…)` calls
  for the targets plus one for `sets.json` (line 378). The WP's
  "lines 364–376" estimate was off by ~8 lines but the instruction
  "re-derive at execution time" covers it.
- ❌ **PS-5 — Phase 2 deletion footprint understated** (see RS-5).
  The EC's "lines ~364–376" covers only `checkMetadataFiles`. But
  `checkOneMetadataFile` (lines 302–370) is a Phase-2-only helper and
  becomes unused; the EC authorizes its removal via "any Phase-2-only
  helper functions that become unused." In addition, `main()` at
  line 802 contains `await checkMetadataFiles(allFindings);` which
  must also be removed. And the file-header JSDoc at lines 6–12
  describes all five phases and needs renumbering.
- ✅ **Phase renumbering mapping** matches locked values: Phase 1
  (config) unchanged; Phase 2 deleted; former Phase 3 (per-set
  cards) → Phase 2; former Phase 4 (cross-refs) → Phase 3;
  former Phase 5 (images) → Phase 4.
- ✅ **`packages/registry/src/index.ts` re-export delta:** NONE of
  the five deleted schemas are re-exported from `index.ts`. The
  public API surface at lines 30–40 re-exports only `SetDataSchema`,
  `SetIndexEntrySchema`, `HeroCardSchema`, `HeroClassSchema`,
  `CardQuerySchema`, and the glossary schemas + types. Scope §B is
  effectively a **no-op** — this should be called out in the
  session prompt so the executor doesn't invent false-positive edits.
  (See PS-7.)
- ✅ **`package.json` `registry:validate` scope:** confirmed at
  `package.json:9` as the only script that invokes
  `packages/registry/scripts/validate.ts`. The root `pnpm validate`
  at `package.json:21` invokes a DIFFERENT script
  (`scripts/validate-r2.mjs`) with its own phase numbering —
  unaffected by this WP.
- ✅ **`upload-r2.ts`:** grep against `packages/registry/scripts/upload-r2.ts`
  for all six target filenames returns **zero matches**. Gate 2d
  passes for its home file.
- ✅ **Cross-service identifiers (ext_id strings):** n/a — WP-084
  deletes data, does not introduce new identifiers.
- ✅ **Handler ownership / persistence classification:** n/a —
  delete-only, no new `G` fields, no new handlers.
- ✅ **Framework API workarounds:** n/a — no framework contact.
- ✅ **Immutable file designations respected:** `schema.ts` is the
  only "immutable unless justified" file touched; justification
  present (2026-04-21 audit + DECISIONS entry planned for Commit B).
  `theme.schema.ts`, `theme.validate.ts`, `upload-r2.ts`,
  `shared.ts`, `localRegistry.ts` (main registry) all untouched.

Dependency Contract Verification gate: **CONDITIONAL PASS** — name /
range / classification verified; scope-footprint refinements required
via PS-5 / PS-7 / PS-8 / PS-10.

---

### Code Category Boundary Check

- ✅ `packages/registry/src/schema.ts` → Registry category
- ✅ `packages/registry/src/index.ts` → Registry category
- ✅ `packages/registry/scripts/validate.ts` → Registry category
  (build tooling under registry package)
- ✅ `data/metadata/*.json` → Content / Data category
- ✅ `apps/registry-viewer/CLAUDE.md` → Docs (if modified, only to
  remove stale references)
- ✅ `docs/03.1-DATA-SOURCES.md`, `docs/ai/DECISIONS.md`,
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/ai/STATUS.md` → Docs

No new directories created. No new category classification required.

Code Category Boundary gate: **PASS.**

---

### Scope Lock (Critical)

#### WP-084 Is Allowed To

- **Delete** five schemas (`CardTypeEntrySchema`, `HeroClassEntrySchema`,
  `HeroTeamEntrySchema`, `IconEntrySchema`, `LeadsEntrySchema`) from
  `packages/registry/src/schema.ts`, plus the section comment blocks
  immediately above each schema definition.
- **Delete** five JSON files from `data/metadata/`: `card-types.json`,
  `hero-classes.json`, `hero-teams.json`, `icons-meta.json`,
  `leads.json` (via `git rm`).
- **Delete** the orphan `data/metadata/card-types-old.json` (via
  `git rm`).
- **Modify** `packages/registry/src/index.ts` only if any re-export of
  the five schemas is present (current state: NONE — see PS-7).
- **Modify** `packages/registry/scripts/validate.ts`:
  - Remove five schema imports (lines 51–55 at HEAD)
  - Delete `checkOneMetadataFile` helper (lines 302–370 at HEAD)
  - Delete `checkMetadataFiles` function (lines 372–384 at HEAD)
  - Remove `await checkMetadataFiles(allFindings);` call in `main()`
    (line 802 at HEAD)
  - Renumber former Phases 3 / 4 / 5 → 2 / 3 / 4 in all `console.log`,
    section-comment, error-message, and file-header-JSDoc references
- **Modify** `apps/registry-viewer/CLAUDE.md` only if §"Key Files" or
  §"Data Flow" references a deleted file or schema (audit says none;
  guard step).
- **Modify** `packages/registry/CLAUDE.md` only if it exists and lists
  a deleted schema in its inventory.
- **Modify** `docs/03.1-DATA-SOURCES.md` to remove rows listing the
  five deleted files.
- **Modify** `package.json` only if the `registry:validate` script
  needs a flag or name change (skip otherwise — no change anticipated).
- **Update** `docs/ai/DECISIONS.md` (Commit B) with five governance
  entries per WP-084 §Governance.
- **Update** `docs/ai/work-packets/WORK_INDEX.md` (Commit B) to flip
  WP-084 `[ ]` → `[x]` with date + Commit A hash.
- **Update** `docs/ai/execution-checklists/EC_INDEX.md` (Commit B) to
  flip EC-109 to `Done`.
- **Update** `docs/ai/STATUS.md` (Commit B) if the file exists and
  prior WPs followed that convention.
- **Create** the A0 SPEC bundle files already present in the working
  tree: `docs/ai/execution-checklists/EC-109-…checklist.md`,
  `docs/ai/session-context/session-context-wp084.md`, and this
  pre-flight file.

#### Additional Scope Required to Unblock Execution (PS-1 / PS-2 / PS-3)

The current scope as drafted is **insufficient** to satisfy WP-084's
own acceptance criteria. The pre-flight-locked expansion is:

- **PS-1 fix:** resolve `apps/registry-viewer/src/registry/impl/localRegistry.ts`
  active read of `card-types.json` before deletion. See §Pre-Session
  Actions RS-1.
- **PS-2 fix:** amend `docs/ai/REFERENCE/00.2-data-requirements.md`
  before deletion, OR record a DECISIONS.md amendment first. See
  §Pre-Session Actions RS-2.
- **PS-3 fix:** either expand doc scope or add explicit exclusions to
  the acceptance criteria for repo-wide docs references. See
  §Pre-Session Actions RS-3.

#### WP-084 Is Explicitly Not Allowed To

- Modify `packages/registry/src/theme.schema.ts` or `theme.validate.ts`.
- Modify `packages/registry/scripts/upload-r2.ts`.
- Modify the four surviving metadata files (`keywords-full.json`,
  `rules-full.json`, `sets.json`) — locked byte-for-byte.
- Modify any surviving schema in `schema.ts` (`SetDataSchema`,
  `SetIndexEntrySchema`, `HeroCardSchema`, `HeroClassSchema`,
  `HeroSchema`, `MastermindCardSchema`, `MastermindSchema`,
  `VillainCardSchema`, `VillainGroupSchema`, `SchemeSchema`,
  `CardQuerySchema`, `RegistryConfigSchema`, `KeywordGlossaryEntrySchema`,
  `KeywordGlossarySchema`, `RuleGlossaryEntrySchema`,
  `RuleGlossarySchema`) or any schema added by WP-082 / WP-083 —
  locked byte-for-byte.
- Touch any file under `apps/server/`, `packages/game-engine/`, or
  `packages/preplan/`.
- Touch `apps/registry-viewer/src/**` **runtime** code. *(Exception
  under PS-1 resolution Option A — one surgical edit to the viewer's
  dead-code `localRegistry.ts`, explicitly authorized by the amendment
  before execution begins.)*
- Modify any R2 artifact.
- Add new schemas, replacement JSON, new fetchers, new npm scripts, or
  new test frameworks.
- Re-format, stylistically clean up, or re-order the surviving code in
  `schema.ts`, `index.ts`, or `validate.ts` beyond what the deletion
  and renumbering strictly require.
- Use `--no-verify`, `--no-gpg-sign`, or any commit-hook bypass.
- Push to a remote unless explicitly asked.
- Use `git add .` / `git add -A` / `git add -u` — stage by exact
  filename only (EC-109 guardrail P6-27 / P6-44).

**Rule:** Anything not explicitly allowed is out of scope.

---

### Test Expectations (Locked Before Execution)

- **New tests:** 0 — delete-only packet
- **Existing test changes:** 0 — no source test file imports any of
  the five deleted schemas (confirmed via Gate 2a grep: no hits under
  `packages/` or `apps/` outside `schema.ts` definitions, `validate.ts`
  imports/usage, and `dist/` compiled artifacts)
- **Prior test baseline:** placeholders in
  `session-context-wp084.md` §4.2. Record actual `pnpm -r --if-present
  test` count and per-package breakdown BEFORE Commit A.
- **Post-execution expectation:** baseline **UNCHANGED** across every
  package. A single test delta (pass or fail) invalidates the
  delete-only guarantee and requires stop-and-escalate.
- **`pnpm registry:validate` expectation:** exits 0 both before
  (five-phase output) and after (four-phase output, renumbered
  1 / 2 / 3 / 4) execution.
- **`pnpm -r build` expectation:** exits 0 before and after.
- **`pnpm-lock.yaml` expectation:** unchanged. No dependency added or
  removed.
- **Test boundaries:** no `boardgame.io/testing` imports, no
  modification to `makeMockCtx` or other shared test helpers, no new
  test files.

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

**RS-1 (BLOCKER) — Viewer's `localRegistry.ts` actively reads `card-types.json`**

- **Risk / ambiguity:** `apps/registry-viewer/src/registry/impl/localRegistry.ts:37`
  contains an active `readFile(join(dir, "card-types.json"), "utf8")`
  call, and its docstring at line 23 reads *"Path to folder containing
  card-types.json + {abbr}.json files"*. Its filter at line 64 is
  `(f: string) => extname(f) === ".json" && f !== "card-types.json"`.
  Although nothing in the viewer's `src/` imports from `./registry/index`
  (browser runtime uses only `./registry/browser` → `httpRegistry`),
  and viewer CLAUDE.md §"Key Files" line 62 labels this file *"Node-only
  CardRegistry factory (CI validation)"*, the file IS exported from
  `apps/registry-viewer/src/registry/index.ts:27` as part of the viewer
  registry entry. It is also a **drifted duplicate** of the main
  `packages/registry/src/impl/localRegistry.ts` that still carries the
  exact WP-003 Defect 1 silent-failure bug (card-types.json where
  sets.json is expected — D-1203).
- **Impact:** HIGH. EC-109 Gate 2b grep *"the five JSON filenames are
  referenced ONLY in validate.ts"* returns this file. WP-084 Acceptance
  Criterion *"grep returns **no matches**"* cannot be satisfied while
  this code exists. The EC's scope lock forbids touching
  `apps/registry-viewer/src/**`. Execution cannot proceed without
  resolution.
- **Mitigation options (select ONE before execution):**
  - **Option A (recommended):** Expand WP-084 scope by one file. Update
    `apps/registry-viewer/src/registry/impl/localRegistry.ts` so it
    reads `sets.json` instead of `card-types.json` (mirror the WP-003
    fix applied to `packages/registry/src/impl/localRegistry.ts`),
    update the docstring + filter, add a `// why:` comment citing
    D-1203, and document the one-line scope expansion in a new
    DECISIONS entry. This converts dead-but-broken code into dead-and-
    correct code and resolves Gate 2b.
  - **Option B:** Delete `apps/registry-viewer/src/registry/impl/localRegistry.ts`
    and its re-export from `apps/registry-viewer/src/registry/index.ts:27`
    as part of WP-084. Requires confirming zero external consumers
    (grep across `.github/`, `scripts/`, and `tests/` shows no CI
    invocation — the "CI validation" label is stale). Add to WP scope
    with DECISIONS entry.
  - **Option C:** Split WP-084. WP-084a: fix/delete viewer localRegistry
    first. WP-084b: proceed with the original five-file deletion.
  - **Option D (narrow):** Defer deletion of `card-types.json`; keep
    it + `CardTypeEntrySchema` in this WP and only delete the other
    four targets. Reduces WP scope from 5 files → 4 files and
    5 schemas → 4 schemas, leaves WP-003 cleanup debt in place.
- **Decision / pattern to follow:** **AWAIT AUTHOR SELECTION.** Author
  to pick A / B / C / D; pre-flight re-runs the Gate 2b audit against
  the chosen option and updates this file to **READY** only when the
  resulting grep is clean.

**RS-2 (BLOCKER) — `00.2-data-requirements.md` lists the five files as ACTIVE data contracts**

- **Risk / ambiguity:** `docs/ai/REFERENCE/00.2-data-requirements.md`
  contains six sections defining each of the five target files as
  current required inputs:
  - §2.1 *"Card Types (`card-types.json`) — 37 types"* (line 260),
    validated by `CardTypeEntrySchema` (line 274)
  - §2.3 *"Hero Teams (`hero-teams.json`) — 25 teams"* (line 351),
    validated by `HeroTeamEntrySchema` (line 363)
  - §2.4 *"Hero Classes (`hero-classes.json`) — 5 classes"* (line 368),
    validated by `HeroClassEntrySchema` (line 381)
  - §2.5 *"Icons / Stat Symbols (`icons-meta.json`) — 7 icons"* (line 388),
    validated by `IconEntrySchema` (line 406)
  - §2.6 *"Mastermind-Villain Leads (`leads.json`)"* (line 408),
    validated by `LeadsEntrySchema` (line 421)
  - Plus active field-contract references at lines 68 (`team` matches
    `slug` in `hero-teams.json`), 83 (`hc` matches `abbr` in
    `hero-classes.json`), 581–583 (glossary token lookups),
    611–623 (leads.json as "Level 2 cross-set index"),
    and 689–690 (leads.json data quality rules).
- **Impact:** HIGH. EC-109 Gate 3.2 explicitly reads: *"Active contract
  mentions are a BLOCKER until `00.2` is amended under a separate
  DECISIONS entry."* These are **ACTIVE** contract mentions — entire
  sections, not historical crossed-out fields.
- **Mitigation options (select ONE before execution):**
  - **Option A (recommended):** Expand Commit A scope to include
    `docs/ai/REFERENCE/00.2-data-requirements.md` edits. Rewrite
    §§2.1, 2.3, 2.4, 2.5, 2.6 to explicit historical notes (*"The
    following files were removed by WP-084 on YYYY-MM-DD as unused
    auxiliary metadata. The information remains documented in
    per-set card JSON …"*). Rewrite lines 68, 83, 581–583, 611–623,
    689–690 to reflect the new reality (per-set data as source of
    truth). Add `docs/ai/REFERENCE/00.2-data-requirements.md` to
    §Files to Produce in a WP amendment.
  - **Option B:** Author a separate DECISIONS.md amendment FIRST
    (before A0 SPEC bundle lands) that explicitly supersedes the
    five `00.2` sections as active contracts and downgrades them to
    historical. Then execute WP-084 normally. Requires a new
    decision ID allocation and an index update in `DECISIONS_INDEX.md`.
- **Decision / pattern to follow:** **AWAIT AUTHOR SELECTION.**
  Option A (in-packet expansion) is cleaner because the `00.2` edit
  is a direct consequence of the deletion; coupling them ensures
  the decision + code + docs land together. Option B is lower-risk
  for scope purity but introduces an extra commit.

**RS-3 — Many docs reference the five filenames outside the WP's doc scope**

- **Risk / ambiguity:** WP-084 §Files Expected to Change names only
  `docs/03.1-DATA-SOURCES.md`, `apps/registry-viewer/CLAUDE.md`, and
  `packages/registry/CLAUDE.md`. But live grep reveals references in:
  - `docs/01-REPO-FOLDER-STRUCTURE.md` (lines 189–193, 209 —
    filesystem layout description of `data/metadata/`)
  - `docs/03-DATA-PIPELINE.md` (lines 24–28 — ASCII data-flow
    diagram lists all five files by name)
  - `docs/08-DEPLOYMENT.md`, `docs/10-GLOSSARY.md`,
    `docs/11-TROUBLESHOOTING.md` — present; exact-line hits to
    be enumerated at execution
  - `docs/ai/ARCHITECTURE.md` — **authoritative** doc; references
    the file names
  - `docs/ai/REFERENCE/00.5-validation.md`
  - `docs/ai/deployment/r2-data-checklist.md`
  - `docs/prompts-registry-viewer/*.md` (prompt archive)
  - `docs/ai/work-packets/WP-003…`, `WP-009A…`, `WP-014A…`,
    `WP-015…`, `WP-017…`, `WP-042…`, `WP-043…` (historical WP text —
    OK to leave as-is; historical)
  - `docs/ai/execution-checklists/EC-003-…`,
    `EC-014A-…` (historical EC text — OK to leave as-is)
  - `scripts/Validate-R2-old.ps1` (legacy script — see RS-8)
  - `prompts-legendary-area-game/*.md` (external repo archive —
    out of scope even if present on disk)
- **Impact:** MEDIUM. WP-084 Acceptance Criterion reads *"grep -rn
  'card-types.json|...' packages/ apps/ scripts/ docs/ returns **no
  matches**"*. This criterion cannot be satisfied against the current
  repo state without either scope expansion OR explicit exclusions.
- **Mitigation:** the pre-flight-locked policy is:
  - **Current-state docs** (`01-REPO-FOLDER-STRUCTURE.md`,
    `03-DATA-PIPELINE.md`, `08-DEPLOYMENT.md`, `10-GLOSSARY.md`,
    `11-TROUBLESHOOTING.md`, `docs/ai/ARCHITECTURE.md`,
    `docs/ai/REFERENCE/00.5-validation.md`,
    `docs/ai/deployment/r2-data-checklist.md`,
    `docs/prompts-registry-viewer/*.md`) — **add to Commit A scope**
    for update. Each is a one-or-two-line touch to remove or
    historicize the dead filenames.
  - **Historical WP / EC files** — **exclude explicitly** from the
    acceptance-criterion grep. They are a record of past execution
    and should not be rewritten. The EC-109 Gate 2b already
    excludes `^docs/ai/work-packets/WP-08` and
    `^docs/ai/execution-checklists/EC-109`; extend the exclusion
    list to `docs/ai/work-packets/WP-003*`, `WP-009A*`, `WP-014A*`,
    `WP-015*`, `WP-017*`, `WP-042*`, `WP-043*` and
    `docs/ai/execution-checklists/EC-003*`, `EC-014A*`.
  - **External archive** `prompts-legendary-area-game/` — confirm
    it is outside the monorepo (appears to be a sibling directory
    on disk). Exclude from the grep via path or `.gitignore`
    check.
- **Decision / pattern to follow:** Author the amendment to WP-084
  §Files Expected to Change + acceptance criteria during the
  pre-session action block; capture the exclusion list in a new EC-109
  §Locked Values row. Then re-run Gate 2b.

**RS-4 — EC-109 Gate 2a grep pattern matches the DEFINITION file and `dist/` artifacts**

- **Risk / ambiguity:** EC-109 Gate 2a as written is:

  ```bash
  grep -rn "CardTypeEntrySchema|...|LeadsEntrySchema" packages/ apps/ scripts/ \
    | grep -v "^packages/registry/scripts/validate.ts"
  # expected: no output
  ```

  This excludes `validate.ts` but NOT `packages/registry/src/schema.ts`
  (where the five schemas are **defined** — always 5 hits) or
  `packages/registry/dist/schema.js` + `dist/schema.d.ts`
  (compiled artifacts — always 10 hits after `pnpm -r build`).
  A literal run of Gate 2a as written produces 15 lines of output
  against a clean repo. The gate's "expected: no output" is
  unreachable.
- **Impact:** LOW-MEDIUM. The **semantic** intent of Gate 2a (no
  external **consumers**) is satisfied; the gate's **literal** text
  is not. An executor running the gate verbatim will see output,
  conclude STOP, and escalate — wasting a cycle.
- **Mitigation:** patch the Gate 2a grep (in EC-109 §Pre-Flight
  STOP Gates 2a) to add:
  ```bash
  | grep -v "^packages/registry/src/schema.ts" \
  | grep -v "^packages/registry/dist/"
  ```
  Also apply the same fix to WP-084 §Verification Step 1. This is a
  pre-flight refinement that does NOT change scope — it corrects
  a grep-pattern defect in the EC.
- **Decision / pattern to follow:** apply the two `grep -v` additions
  to EC-109 Gate 2a + WP-084 Verification Step 1 during the
  pre-session action block. Recorded under PS-4. (Precedent: WP-031
  P6-22 and WP-033 precedent for grep-pattern refinement.)

**RS-5 — Phase 2 deletion footprint: helper + main() call + JSDoc**

- **Risk / ambiguity:** EC-109 §Locked Values names "Phase 2 block at
  HEAD lines ~364–376" as the Phase 2 deletion. Reality is wider:
  1. Five schema imports (lines 51–55) — covered
  2. `checkOneMetadataFile` generic helper (lines 302–370) — used
     ONLY by Phase 2; becomes unused after deletion. EC authorizes
     via *"any Phase-2-only helper functions that become unused."*
  3. `checkMetadataFiles` function itself (lines 372–384) — covered
     by "lines ~364–376" approximately
  4. `await checkMetadataFiles(allFindings);` call in `main()`
     (line 802) — **not** explicitly mentioned in EC
  5. File-header JSDoc at lines 6–12 describing five phases by name —
     covered under EC's "Update all in-file references to the phase
     numbers (console logs, error prefixes, section comments)"
- **Impact:** MEDIUM. Items 2 and 4 are not called out explicitly.
  An executor who interprets the EC literally and deletes only
  "lines ~364–376" will leave (a) dead code in `checkOneMetadataFile`
  and (b) a broken call site in `main()` — TypeScript compile error
  `Cannot find name 'checkMetadataFiles'`.
- **Mitigation:** add the explicit item list above to the session
  prompt under §Implementation Task. The EC's text already authorizes
  the edits (via the "Phase-2-only helpers" clause + "Update all
  in-file references" clause), but the session prompt should
  enumerate them.
- **Decision / pattern to follow:** session-prompt refinement, not an
  EC amendment. The EC stays as-is.

**RS-6 — `sets.json` loses count-and-invalid-entry validation after Phase 2 deletion**

- **Risk / ambiguity:** current Phase 2 validates `sets.json` via
  `checkOneMetadataFile("sets.json", SetIndexEntrySchema, 40, …)`
  at line 378 — reports `METADATA_LOW_COUNT` if <40 entries and
  `METADATA_ENTRIES_INVALID` for parse failures. After Phase 2
  deletion, this call disappears. `sets.json` is still parsed by
  Phase 1's `readSetAbbreviationsFromSetsJson` (local mode) but only
  to extract abbreviations — no low-count warning, no invalid-entry
  count.
- **Impact:** LOW. `sets.json` still validated at runtime by both
  loaders (`createRegistryFromHttp` throws on non-array or wrong
  shape). Phase 1's extractor already surfaces catastrophic failure
  (missing file → `SETS_JSON_MISSING` error). Only the soft
  count-and-invalid-entry warning disappears from the offline
  validator.
- **Mitigation:** acknowledge the minor regression in the Commit B
  DECISIONS entry for "validate.ts contract clarification". No code
  change required — WP-084's goal is to scope `validate.ts` to
  artifacts with live runtime consumers, and `sets.json` IS still
  validated (at runtime + Phase 1 parsing) even after Phase 2
  deletion.
- **Decision / pattern to follow:** add one-sentence acknowledgement
  in the "validate.ts contract" DECISIONS entry (governance entry
  #4 per WP-084 §Governance).

**RS-7 — `index.ts` re-export removal is a no-op**

- **Risk / ambiguity:** WP-084 §B and EC-109 §Locked Values →
  `packages/registry/src/index.ts — re-export delta` both instruct
  the executor to "Remove any explicit re-export of the five schemas
  or their inferred types." Current state (verified 2026-04-21):
  `index.ts` exports `SetDataSchema`, `SetIndexEntrySchema`,
  `HeroCardSchema`, `HeroClassSchema`, `CardQuerySchema`,
  `KeywordGlossaryEntrySchema`, `KeywordGlossarySchema`,
  `RuleGlossaryEntrySchema`, `RuleGlossarySchema` — NONE of the
  five targets. The §B step is a **no-op**.
- **Impact:** LOW. Benign. But the executor may try to "find and
  remove" the names, fail, and question the EC.
- **Mitigation:** session prompt notes explicitly that `index.ts`
  already has no re-exports of the five schemas; §B is a
  verify-and-proceed step (the §Acceptance Criteria grep of
  `index.ts` for the five names returns clean already).
- **Decision / pattern to follow:** session-prompt refinement.

**RS-8 — `scripts/Validate-R2-old.ps1` references all five filenames**

- **Risk / ambiguity:** `scripts/Validate-R2-old.ps1` lines 12, 17,
  18–20, 93 document the five-phase structure and filenames in a
  legacy PowerShell validator. Filename suggests it's been
  superseded (by `scripts/validate-r2.mjs`). Gate 2b returns its
  filename hits.
- **Impact:** MEDIUM. This file is under `scripts/` which IS in
  the WP-084 acceptance criteria grep path. It's not in the WP
  scope, which means the WP cannot satisfy its own acceptance
  criteria unless this file is handled.
- **Mitigation options:**
  - **Option A:** Delete `Validate-R2-old.ps1` as part of WP-084
    (legacy — validator superseded by `validate-r2.mjs` per file
    naming). Add to §Files to Produce. Governance entry in
    DECISIONS notes the deletion as orphan cleanup adjacent to
    the primary deletion.
  - **Option B:** Modify the file to remove the deleted filenames
    from its docstring. Preserves the legacy PowerShell entry
    point but updates its documentation.
  - **Option C:** Exclude `scripts/Validate-R2-old.ps1` from the
    acceptance-criteria grep via `| grep -v "Validate-R2-old"`
    and flag for a separate cleanup WP.
- **Decision / pattern to follow:** **AWAIT AUTHOR SELECTION.**
  Option A is recommended (the file name itself admits it is
  `-old`), but the author may want to delete it under a separate
  cleanup WP.

**RS-9 — D-6002 in DECISIONS.md references the five target files**

- **Risk / ambiguity:** D-6002 (*"Glossary Data Lives in
  `data/metadata/` Alongside Registry Metadata"*) at
  `DECISIONS.md:6214` explicitly names the five target files as the
  co-located neighbors: *"the same directory that holds `sets.json`,
  `card-types.json`, `hero-classes.json`, `hero-teams.json`,
  `icons-meta.json`, and `leads.json`"*. After deletion, D-6002's
  file list becomes historically accurate but factually stale. The
  decision's **intent** (glossary belongs alongside registry
  metadata) is unaffected.
- **Impact:** LOW. Not a hard blocker per Gate 3 (*"no prior
  decision declaring any of the five deleted files or schemas as a
  current or future **runtime contract**"*) — D-6002 names them as
  neighbors, not as runtime contracts.
- **Mitigation:** in Commit B, add a one-line note to D-6002 citing
  the WP-084 deletion (*"Updated 2026-MM-DD per WP-084 — the five
  auxiliary files `card-types.json`, `hero-classes.json`,
  `hero-teams.json`, `icons-meta.json`, `leads.json` listed above
  have been deleted. Glossary JSON remains co-located with
  `sets.json`, `keywords-full.json`, and `rules-full.json` under
  `data/metadata/`."*). Alternatively, supersede D-6002 with the
  new WP-084 DECISIONS entry and back-link.
- **Decision / pattern to follow:** include the D-6002 update in the
  Commit B DECISIONS edits. Pre-flight locks the text form;
  executor transcribes verbatim.

**RS-10 — D-1203 references `card-types.json` as a counter-example**

- **Risk / ambiguity:** D-1203 (*"sets.json and card-types.json Are
  Incompatible Shapes"*) at `DECISIONS.md:418` documents the WP-003
  Defect 1 silent-failure bug. After `card-types.json` deletion, the
  decision still reads correctly as historical documentation (the
  file USED to exist and the silent-failure mode USED to be reachable).
- **Impact:** LOW. D-1203 is an Immutable decision and should remain
  as-is; it's a safety rail against any future reintroduction.
- **Mitigation:** the new WP-084 DECISIONS entry (governance #1
  "five JSON files deleted") should explicitly back-link to D-1203
  to preserve the historical link — phrasing: *"see D-1203 for the
  silent-failure precedent that motivated extra caution around this
  specific file's removal."*
- **Decision / pattern to follow:** session prompt includes D-1203
  back-link in governance entry text.

**RS-11 — Main registry's `localRegistry.ts` + `httpRegistry.ts` mention the five filenames in comments**

- **Risk / ambiguity:**
  - `packages/registry/src/impl/localRegistry.ts` lines 6–13 contain
    a JSDoc block listing all five filenames as "expected metadata
    directory contents." Lines 36, 61, 91 reference them in `// why:`
    comments.
  - `packages/registry/src/impl/httpRegistry.ts` lines 47–50, 67
    reference `card-types.json` in `// why:` comments as the WP-003
    Defect 1 counter-example.
  - `packages/registry/src/schema.ts` file-header JSDoc at line 7
    lists `card-types.json` as a runtime data source URL.
  None of these files ACTIVELY reads the five target files (only
  `sets.json` and per-set JSON). They're documentation references.
- **Impact:** MEDIUM. After deletion, the comments become factually
  stale. Gate 2b returns hits from these files. WP-084's current
  scope does NOT include any of these three files for modification
  (except `schema.ts`, which is in scope for the schema deletions
  but not for the file-header JSDoc edit).
- **Mitigation:**
  - **`schema.ts` file-header JSDoc** (line 7): add to Scope §A
    explicitly. The WP already authorizes editing `schema.ts` —
    removing the stale line is a direct consequence. Session prompt
    enumerates.
  - **`packages/registry/src/impl/localRegistry.ts`**: add to
    Commit A scope. One-paragraph JSDoc edit + three `// why:`
    cleanups. No runtime behavior change.
  - **`packages/registry/src/impl/httpRegistry.ts`**: the two
    comments at lines 47–50 and 67 are instructive — they document
    the WP-003 silent-failure bug. Option A: keep verbatim (they
    educate future readers about why sets.json is fetched). Option
    B: rephrase to "two different metadata files" without naming
    card-types.json. Author's call.
- **Decision / pattern to follow:** expand Commit A scope to include
  `schema.ts` header JSDoc edit and `packages/registry/src/impl/localRegistry.ts`.
  Defer `httpRegistry.ts` comment edits until author decision —
  lean toward keeping the instructional comments.

**RS-12 — Dirty working tree has many untracked files outside WP-084 scope**

- **Risk / ambiguity:** `git status --porcelain` shows ~20 untracked
  files, most unrelated to WP-084:
  `docs/ai/invocations/forensics-move-log-format.md`,
  `docs/ai/invocations/session-wp048-…`, `session-wp067-…`,
  `session-wp068-…`, `docs/ai/post-mortems/01.6-applyReplayStep.md`,
  `docs/ai/session-context/session-context-forensics-move-log-format.md`,
  `session-context-wp037.md`, `session-context-wp067.md`,
  `docs/ai/work-packets/WP-083-….md`, and others.
  **Only** these are WP-084 A0 SPEC bundle files:
  - `docs/ai/execution-checklists/EC-109-…checklist.md`
  - `docs/ai/session-context/session-context-wp084.md`
  - `docs/ai/invocations/preflight-wp084.md` (this file)
  - `docs/ai/work-packets/WP-084-…md`
  Note also `EC-108-fetch-time-schema-validation.checklist.md`
  (WP-083's EC — co-located but independent; do NOT stage with
  WP-084 commits).
- **Impact:** MEDIUM. EC-109 guardrail is explicit: *"No staging of
  out-of-scope dirty-tree items. … `git add .` / `git add -A` /
  `git add -u` are forbidden (P6-27 / P6-44)."* Executor must stage
  by exact filename only.
- **Mitigation:** session prompt reproduces the exact staging
  commands per commit. Commit A0 stages exactly four files (the
  four A0 SPEC bundle files). Commit A stages the Commit A list
  (schema.ts + index.ts + validate.ts + deletions + doc updates).
  Commit B stages exactly the four governance files + any 00.2
  amendment resulting from RS-2.
- **Decision / pattern to follow:** session prompt enumerates the
  exact `git add` command per commit.

---

### STOP-Gate Status

Tracked authoritatively in `docs/ai/session-context/session-context-wp084.md` §5.
Current pre-flight assessment:

- **Gate 1 — Branch & Baseline:** pending (executor runs at commit A0
  land or Commit A start).
- **Gate 2 — Pre-Deletion Usage Audit:**
  - 2a (schemas): FAIL (RS-4 — grep matches `schema.ts` + `dist/`;
    fix via PS-4)
  - 2b (filenames): FAIL (RS-1 viewer localRegistry + RS-3 docs +
    RS-8 legacy PS1 + RS-11 comments)
  - 2c (orphan `card-types-old.json`): PASS (`grep -rn
    "card-types-old.json" packages/ apps/ scripts/ docs/` returns
    zero hits outside WP-084 / EC-109 artifacts)
  - 2d (R2 upload automation): PASS (`upload-r2.ts` grep clean)
- **Gate 3 — Contract & Doc Sanity:**
  - DECISIONS.md no-prior-runtime-contract: PASS (D-1203 and
    D-6002 are historical / neighbor references, not runtime
    contracts)
  - `00.2-data-requirements.md` no-active-contract: **FAIL (RS-2).**
  - `upload-r2.ts` clean: PASS
  - `apps/registry-viewer/CLAUDE.md` references: CATALOGED —
    §"Key Files" line 62 mentions `src/registry/impl/localRegistry.ts`
    (the problematic file from RS-1). Not a direct filename
    reference, but coupled to RS-1 resolution.
- **Gate 4 — `validate.ts` Safety:**
  - External phase-number references (narrow EC grep `"Phase [2-5]"`
    or `"Phase [2-5] of"`): PASS (no hits outside validate.ts itself,
    WP-084 drafts, EC-109 draft)
  - Broader `Phase 3/4/5` literal search: `scripts/validate-r2.mjs`
    and `scripts/Validate-R2-old.ps1` have their own phase
    numberings — independent of packages/registry/scripts/validate.ts,
    no cascading impact. PASS with note.
  - Renumbering plan locked (1 / deleted / 2 / 3 / 4): PASS
  - `pnpm registry:validate` uniqueness: PASS
- **Gate 5 — Git-File Health:**
  - No post-2026-04-21 commits on the six target files: PASS
    (latest commit `e24847f` on `card-types.json` predates audit)
  - No `.gitignore` / `.gitattributes` obstruction: PASS
- **Gate 6 — Deletion-Intent Confirmation:**
  - Delete-only: PASS (with RS-1/RS-2/RS-3/RS-11 scope additions
    all strictly deletions or one-line surgical fixes — no new
    code)
  - Four surviving metadata files locked: PASS
  - No engine/server/preplan/R2 modification: PASS (RS-1's viewer
    localRegistry fix is explicitly carved out if Option A selected)

**Binary verdict rule:** all six ✅ → READY. Current: ❌ **Gate 2 + Gate 3 fail.**

---

### Pre-Flight Verdict (Binary)

❌ **DO NOT EXECUTE YET**

Justification (6 sentences):

1. **Dependency readiness is clean** — WP-082 is Done; WP-083 is
   independent; WP-036 predecessor is at commit `61df4c0`.
2. **Contract fidelity is solid** — every schema name, file path, line
   range, import pattern, and phase-number mapping in EC-109 matches
   the actual source files; the A0 SPEC bundle can be trusted at
   the transcription level.
3. **Scope lock has two hard gaps (RS-1, RS-2) and three medium-
   severity gaps (RS-3, RS-8, RS-11)** that must be closed before
   execution — the viewer's dead-but-active-consuming `localRegistry.ts`
   (RS-1) and the active contract declarations in `00.2-data-
   requirements.md` (RS-2) are both explicit STOP conditions per
   EC-109's own gate criteria.
4. **Risks RS-4 (grep pattern defect), RS-5 (Phase 2 deletion
   footprint), RS-6 (sets.json validation regression), RS-7
   (index.ts no-op), RS-9 (D-6002), RS-10 (D-1203), RS-11 (stale
   comments), and RS-12 (dirty tree staging discipline)** are
   either pattern fixes to EC-109, session-prompt enumerations, or
   one-line DECISIONS amendments — none require design change.
5. **Architectural boundary confidence is high** — registry-only
   packet; no engine / server / preplan touch; `schema.ts` Immutable
   rule is satisfied by the 2026-04-21 no-consumer audit + planned
   DECISIONS entry.
6. **Maintainability is strictly improved** — the deletion reduces
   surface area, eliminates five dormant schemas, closes the
   "schemas exist but nothing consumes them" gap identified in
   WP-083's complement framing, and when paired with RS-1 Option A
   fixes the drifted WP-003 silent-failure bug in the viewer's
   duplicate localRegistry.

---

### Pre-Session Actions (Required Before READY Verdict)

All items below must be resolved — either by scope expansion (amend
WP-084 §Files Expected to Change and §Acceptance Criteria), pattern
fix (amend EC-109 Gate greps), or session-prompt refinement — before
this pre-flight verdict flips to **READY**. An amendment commit to
A0 SPEC may be required for WP-084 and EC-109 text.

**Blocking (must resolve — execution forbidden until cleared):**

- **PS-1 — Resolve viewer `localRegistry.ts` card-types.json read.**
  Author selects Option A / B / C / D from RS-1 Mitigation. Author's
  choice is recorded as an amendment to WP-084 §Files Expected to
  Change (and §Scope Lock) + an EC-109 §Locked Values note + a new
  DECISIONS entry (allocate next D-NNNN) describing the resolution.
  Pre-flight re-runs Gate 2b against the proposed final state.

- **PS-2 — Amend `00.2-data-requirements.md` (or DECISIONS pre-amend).**
  Author selects Option A (in-packet 00.2 edit) or Option B (pre-
  commit DECISIONS amendment) from RS-2 Mitigation. If Option A,
  add `docs/ai/REFERENCE/00.2-data-requirements.md` to WP-084
  §Files Expected to Change. If Option B, author and land the
  separate DECISIONS amendment first; then re-run Gate 3.

**Scope-expansion (strongly recommended — unblocks AC grep):**

- **PS-3 — Expand doc scope for current-state references and
  explicit exclusions for historical artifacts.** Add to WP-084
  §Files Expected to Change:
  - `docs/01-REPO-FOLDER-STRUCTURE.md`
  - `docs/03-DATA-PIPELINE.md`
  - `docs/08-DEPLOYMENT.md`
  - `docs/10-GLOSSARY.md`
  - `docs/11-TROUBLESHOOTING.md`
  - `docs/ai/ARCHITECTURE.md`
  - `docs/ai/REFERENCE/00.5-validation.md`
  - `docs/ai/deployment/r2-data-checklist.md`
  - `docs/prompts-registry-viewer/*.md` (enumerated per-file at
    execution)
  Amend WP-084 Acceptance Criteria grep exclusions to cover
  historical WP and EC files as described in RS-3 Mitigation.

- **PS-4 — Fix EC-109 Gate 2a + WP-084 Verification Step 1 grep
  patterns.** Add `| grep -v "^packages/registry/src/schema.ts" |
  grep -v "^packages/registry/dist/"` to the 2a pipe. Same for
  WP Verification Step 2. Zero-scope refinement; no execution
  impact.

- **PS-8 — Decide on `scripts/Validate-R2-old.ps1`.** Author
  selects Option A (delete) / B (update docs) / C (exclude from
  AC grep) per RS-8. Preferred: Option A (legacy admitted by
  `-old` suffix).

**Session-prompt refinements (non-blocking — session author
enumerates):**

- **PS-5 — Enumerate Phase 2 deletion footprint in session prompt:**
  (a) five imports lines 51–55,
  (b) `checkOneMetadataFile` helper lines 302–370,
  (c) `checkMetadataFiles` function lines 372–384,
  (d) `main()` call at line 802,
  (e) file-header JSDoc lines 6–12 renumbering.
  EC authorizes all via existing clauses; session prompt spells
  them out so the executor doesn't miss any.

- **PS-6 — Acknowledge `sets.json` soft-validation regression in
  the Commit B DECISIONS entry #4 ("validate.ts contract
  clarification").** One-sentence note; no code impact.

- **PS-7 — Document that `index.ts` re-export removal is a no-op.**
  Session prompt verifies current state and proceeds without
  false edits.

- **PS-9 — Add D-6002 historical-neighbor note to Commit B edits.**
  Session prompt includes verbatim text for the D-6002 update.

- **PS-10 — Add D-1203 back-link to the new WP-084 DECISIONS
  governance entry #1.** Session prompt includes phrasing.

- **PS-11 — Add `packages/registry/src/schema.ts` file-header JSDoc
  edit (line 7 removal of card-types.json reference) to Scope §A
  in session prompt.**

- **PS-12 — Add `packages/registry/src/impl/localRegistry.ts`
  JSDoc + `// why:` comment cleanup to Commit A scope** (deferred
  to author's explicit approval during PS-1 resolution —
  optional; can be a separate cleanup WP).

**Pre-flight re-confirmation:** once PS-1 and PS-2 are resolved (with
scope-neutral fixes only per WP-031 mid-execution amendment pattern),
the pre-flight may be updated in-place — no full re-run required.
If PS-1 or PS-2 resolution changes scope materially (e.g., Option C
from RS-1 splitting the WP), pre-flight **must re-run** before the
session prompt is generated.

---

### Invocation Prompt Conformance Check (Pre-Generation)

**Deferred** — session execution prompt has not yet been generated
(Step 2 of the 01.4 workflow). Conformance check runs when the prompt
is authored, after PS-1 through PS-8 are all resolved and the verdict
flips to READY. Pre-requisite locks for the invocation prompt:

- [ ] All EC-109 locked values copied verbatim (post-PS amendments)
- [ ] No new keywords, helpers, file paths, or timing rules appear
      only in the prompt
- [ ] File paths, extensions, and test locations match the WP
      (post-PS-3 scope expansion)
- [ ] No forbidden imports or behaviors introduced by wording
- [ ] The prompt does not resolve ambiguities not resolved in this
      pre-flight + PS block
- [ ] Helper call patterns match actual signatures (N/A — delete-only)
- [ ] 01.5 runtime-wiring allowance declared **NOT INVOKED** per
      EC-109 (matches the WP-030 precedent for purely-additive /
      purely-subtractive WPs)
- [ ] 01.6 post-mortem declared **NOT TRIGGERED** per EC-109
      (matches EC-106 / EC-108 precedent)

---

### Authorized Next Step

**Verdict:** ❌ **DO NOT EXECUTE YET**

Execution of a session prompt is **NOT authorized**. The author must
resolve PS-1 and PS-2 (blocking) and is strongly advised to resolve
PS-3, PS-4, and PS-8 (scope-expansion / pattern-fix) before the
pre-flight verdict can flip to **READY**.

**Ordered resolution sequence (recommended):**

1. **Author selects mitigation options** for RS-1 / RS-2 / RS-8
   (PS-1 / PS-2 / PS-8). Record choices in a comment on this file
   (or in an appended §Author Decision Log section).
2. **Amend WP-084** with new §Files Expected to Change entries and
   §Scope Lock additions driven by PS-1 / PS-2 / PS-3 / PS-8.
   Amend WP-084 §Acceptance Criteria grep exclusions per PS-3.
3. **Amend EC-109** §Locked Values and §Pre-Flight STOP Gates 2a
   with the `schema.ts` + `dist/` exclusions (PS-4) and any new
   file entries from PS-1 / PS-2 / PS-3 / PS-8.
4. **Land the amendment commit** on the A0 SPEC bundle
   (`SPEC: amend WP-084 / EC-109 after pre-flight findings`).
5. **Re-run Gate 2 + Gate 3** against the amended state. Confirm
   all six gates now green.
6. **Update this pre-flight file** — flip ❌ DO NOT EXECUTE YET to
   ✅ READY TO EXECUTE, append §Authorized Next Step with the
   session-prompt authorization statement, and record the starting
   commit hash.
7. **Generate session execution prompt** at
   `docs/ai/invocations/session-wp084-delete-unused-auxiliary-metadata.md`
   (Step 2 of the 01.4 workflow). Prompt must conform exactly to
   the amended scope; no new scope may be introduced.

**Guard:** Any resolution that materially changes WP scope
(splitting the WP, changing the deletion list, changing the
validate.ts approach) requires a **full pre-flight re-run**, not
an in-place update.

If the verdict ever flips to READY, the authorization statement
will read:

> You are authorized to generate a **session execution prompt** for
> WP-084 to be saved as:
> `docs/ai/invocations/session-wp084-delete-unused-auxiliary-metadata.md`

That authorization is **not** issued by this pre-flight.

---

### Final Instruction

Pre-flight exists to **prevent premature execution and scope drift**.
Two hard blockers (RS-1 / RS-2) and three scope / pattern gaps
(RS-3 / RS-4 / RS-8) must be resolved before a session prompt may
be generated.

**DO NOT PROCEED TO EXECUTION.** Escalate PS-1 / PS-2 / PS-3 /
PS-4 / PS-8 to the author; land the amendment commit; re-run Gate
2 + Gate 3; then update this file to READY.

---

### Author Decision Log (Amendment A-084-01, 2026-04-21)

Resolutions to pre-session actions PS-1, PS-2, PS-3, PS-4, PS-8
(blocking and recommended). Non-blocking refinements PS-5, PS-6,
PS-7, PS-9, PS-10, PS-11, PS-12 are folded into the amended WP /
EC and documented there.

#### PS-1 — Viewer `localRegistry.ts` (BLOCKER → RESOLVED)

**Decision:** Option B — **delete the viewer's duplicate
`localRegistry.ts` entirely** and remove its single re-export.

**Authority:** Explore agent verdict 2026-04-21 — DEAD CODE, SAFE
TO DELETE. Seven pieces of evidence:

1. No imports of `createRegistryFromLocalFiles` from the viewer path
   anywhere in the repo
2. No viewer source file imports from `./registry/index`; all imports
   use `./registry/browser`
3. `vite.config.ts:13` comment confirms the file is not bundled
4. `browser.ts:33` comment confirms HTTP factory is the only browser
   export
5. CI `.github/workflows/ci.yml:66–97` runs lint / typecheck / build
   only — no CI job invokes the viewer's localRegistry
6. Viewer `dist/` output contains zero traces of localRegistry or
   Node fs calls
7. File unchanged since initial commit `d5ea067` (2026-03-23) —
   3+ weeks of stale code; CLAUDE.md's "CI validation" label is
   aspirational

**Scope addition (A-084-01 §G):**
- Delete `apps/registry-viewer/src/registry/impl/localRegistry.ts`
- Remove line 27 re-export from `apps/registry-viewer/src/registry/index.ts`
- Remove line 62 §"Key Files" row from `apps/registry-viewer/CLAUDE.md`
- Verify `pnpm --filter registry-viewer build` exits 0

**Rationale:** deletion is lower-churn than the one-line fix
(Option A: change `"card-types.json"` → `"sets.json"`) because
deletion also eliminates the drifted D-1203 silent-failure bug
permanently rather than merely patching it in dead code. The main
registry's `packages/registry/src/impl/localRegistry.ts` remains
the canonical Node factory (used by server + smoke test) —
unaffected.

#### PS-2 — `00.2-data-requirements.md` active contracts (BLOCKER → RESOLVED)

**Decision:** Option A — **amend `00.2-data-requirements.md`
in-packet (Commit A).**

**Authority:** pre-flight recommendation §RS-2 Mitigation. Coupling
the 00.2 edit + schema deletion + DECISIONS entry into one three-
commit topology lands the decision atomically. Option B (pre-commit
DECISIONS amendment) would add an extra commit cycle without scope
benefit.

**Scope addition (A-084-01 §H):**
- Rewrite `00.2` §§2.1 / 2.3 / 2.4 / 2.5 / 2.6 as historical notes
  citing WP-084 deletion + Commit A hash
- Rewrite field-contract references at lines 68, 83, 581–583,
  611–623, 689–690 to reflect current-state resolution paths
  (per-set JSON + viewer hardcoded `HERO_CLASS_GLOSSARY` /
  `HERO_CLASS_LABELS` per EC-107)

**Rationale:** the 00.2 rewrite is a direct consequence of the
deletion. Historicizing preserves audit trail (readers can trace
why the sections exist in git history) while making current-state
doc truthful.

#### PS-3 — Repo-wide docs references (SCOPE EXPANSION → RESOLVED)

**Decision:** **Expand doc scope** to cover all current-state
references; **explicitly exclude** historical WP / EC artifacts from
the acceptance-criterion grep.

**Authority:** pre-flight §RS-3 Mitigation. Current-state docs drift
if not swept; historical records must remain accurate.

**Scope addition (A-084-01 §I):**
- Add to §Files Expected to Change: `docs/01-REPO-FOLDER-STRUCTURE.md`,
  `docs/03-DATA-PIPELINE.md`, `docs/08-DEPLOYMENT.md`,
  `docs/10-GLOSSARY.md`, `docs/11-TROUBLESHOOTING.md`,
  `docs/ai/ARCHITECTURE.md`, `docs/ai/REFERENCE/00.5-validation.md`,
  `docs/ai/deployment/r2-data-checklist.md`,
  `docs/prompts-registry-viewer/*.md` (if-references-present for
  several)
- Extend acceptance-criterion grep exclusions to cover:
  `docs/ai/work-packets/WP-003*`, `WP-009A*`, `WP-014A*`, `WP-015*`,
  `WP-017*`, `WP-042*`, `WP-043*`, `WORK_INDEX.md`;
  `docs/ai/execution-checklists/EC-003*`, `EC-014A*`, `EC_INDEX.md`;
  `DECISIONS.md`; the pre-flight artifacts themselves;
  `packages/registry/dist/` (compiled output)

**Rationale:** the AC grep must reach "no matches" against
current-state paths; historical records are execution artifacts
that must NOT be rewritten.

#### PS-4 — Gate 2a grep pattern (PATTERN FIX → RESOLVED)

**Decision:** **Fix EC-109 Gate 2a + WP-084 Verification Step 1
grep patterns** to exclude `packages/registry/src/schema.ts`
(definition site — disappears post-deletion) and
`packages/registry/dist/` (compiled artifacts — regenerated at
next build).

**Scope:** zero code scope change; purely EC-109 + WP-084 text
refinement. Lands on A0 SPEC bundle as part of the amendment
commit.

**Rationale:** the original gate grep was semantically correct
but literally unreachable — the DEFINITIONS of the five schemas
live in `schema.ts` and always appear until deletion lands,
and `dist/` always hits until rebuild. The fix preserves the
semantic intent ("no external consumers") while making the
literal output checkable.

#### PS-8 — `scripts/Validate-R2-old.ps1` (SCOPE EXPANSION → RESOLVED)

**Decision:** Option A — **delete `scripts/Validate-R2-old.ps1`
as an orphan** in Commit A.

**Authority:** pre-flight §RS-8 Mitigation. The `-old` suffix is
self-admitting; the script is superseded by `scripts/validate-r2.mjs`
(Node, wired to root `pnpm validate`) and
`packages/registry/scripts/validate.ts` (tsx, wired to
`pnpm registry:validate`). Root `package.json:22` invokes the
non-`-old` file (`scripts/Validate-R2.ps1`) — distinct and
preserved.

**Scope addition (A-084-01 §J):**
- Delete `scripts/Validate-R2-old.ps1` (`git rm`)
- Add governance entry (#7) documenting the superseded-orphan
  deletion

**Rationale:** same pattern as the `card-types-old.json` orphan
deletion already in scope — legacy `*-old.ext` files are a repo
smell.

#### Non-blocking refinements (PS-5, PS-6, PS-7, PS-9–PS-12)

All folded into the amended WP-084 + EC-109 artifacts:

- **PS-5** — Phase 2 deletion footprint enumerated in EC-109
  §Locked Values (checkOneMetadataFile helper + main() call +
  file-header JSDoc)
- **PS-6** — `sets.json` soft-validation regression acknowledged
  in the `validate.ts` contract clarification DECISIONS entry
  (will be finalized in Commit B)
- **PS-7** — `index.ts` re-export removal documented as
  verify-and-proceed no-op in EC-109 §Locked Values
- **PS-9** — D-6002 historical-neighbor note queued for Commit B
  DECISIONS edits
- **PS-10** — D-1203 back-link queued for Commit B DECISIONS
  governance entry #1
- **PS-11** — `schema.ts` file-header JSDoc line 7 cleanup added
  to WP-084 §A (Commit A)
- **PS-12** — `packages/registry/src/impl/localRegistry.ts` JSDoc
  cleanup added to WP-084 §K (Commit A); `httpRegistry.ts` kept
  as-is with one-line clarifying note (A-084-01 §K — preserves
  educational value of the WP-003 silent-failure commentary)

---

### Post-Amendment Gate Re-Run

**Gate 2b pre-flight dry-run (2026-04-21):** ✅ **CLEAN (zero output)**
against the amended exclusion list. Two iterations were needed:

- **First dry-run** surfaced 10 additional hit categories (historical
  ECs, historical WPs, session contexts, invocations, STATUS.md,
  DECISIONS_INDEX, 01.4 pre-flight template, `docs/archive
  prompts-legendary-area-game/`, `apps/registry-viewer/HISTORY-…`,
  and two current-state categories: viewer types files + 02-CODE-
  CATEGORIES.md). The historical categories were added to Gate 2b
  exclusions; the two current-state categories were added to
  A-084-01 §L scope.
- **Second dry-run** (after §L scope expansion + exclusion-list
  extension) returned zero output. Gate 2b is satisfied by the
  amended EC-109 / WP-084 state.

**Amendment §L additions (surfaced by dry-run):**

- `apps/registry-viewer/src/registry/types/index.ts` lines 87+116
  — JSDoc drift `card-types.json` → `sets.json` (WP-003 fix era
  drift; never affected behavior because httpRegistry uses
  sets.json in reality)
- `apps/registry-viewer/src/registry/types/types-index.ts` lines
  87+116 — identical JSDoc drift
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` line 162 —
  `card-types.json` used as a concrete bug-pattern example;
  historicize with D-1203 citation

**Remaining gate work:**

1. **Commit A0 amendment (required):** the in-place amendments to
   WP-084 + EC-109 + preflight-wp084.md + session-context-wp084.md
   must land as part of the A0 SPEC bundle commit. Use prefix
   `SPEC:` per three-commit topology. Subject suggestion:
   `SPEC: amend WP-084 / EC-109 per pre-flight (A-084-01)`.
2. **Gate 2a + Gate 2b verified at Commit A start (mandatory):**
   the executor re-runs the amended Gate 2 patterns in the new
   Claude Code execution session as a final sanity check before
   any deletion. Expected: zero output on both.
3. **Gates 1, 3, 4, 5, 6 run in full at Commit A start
   (mandatory):** per amended EC-109.

Once the Commit A0 amendment lands and Gate 2 is re-run clean, the
pre-flight verdict flips to ✅ **READY TO EXECUTE** and the session
execution prompt (Step 2 of the 01.4 workflow) may be generated.

---

### Checklist Status

- ☒ A0 SPEC pre-flight bundle scaffolded (EC-109 + EC_INDEX row +
  WORK_INDEX row + this file + session-context-wp084.md)
- ☒ Pre-flight executed (2026-04-21)
- ☒ STOP-gate status assessed; RS-1 through RS-12 recorded
- ☒ Pre-session actions enumerated (PS-1 through PS-12)
- ☒ Author decisions recorded for PS-1 / PS-2 / PS-3 / PS-4 / PS-8
- ☒ Non-blocking refinements (PS-5..PS-7, PS-9..PS-12) folded into
  amended WP-084 + EC-109
- ☒ WP-084 amended with §Amendments §A-084-01 entry + expanded
  §Scope / §Files / §Governance / §Acceptance Criteria
- ☒ EC-109 amended with expanded Locked Values + Files to Produce +
  fixed Gate 2a/2b grep patterns + A-084-01 guardrails + new
  Verification Steps 19–24 + updated After Completing checklist
- ☒ A-084-01 §L additions authored after Gate 2b dry-run surfaced
  three additional current-state references (viewer types JSDoc x2
  + 02-CODE-CATEGORIES.md line 162)
- ☒ Gate 2b dry-run returns ✅ CLEAN (zero output) against the
  amended exclusion list (second iteration, 2026-04-21)
- ☐ Amendment commit lands on A0 SPEC bundle (WP-084 / EC-109 /
  preflight-wp084 / session-context-wp084)
- ☐ Gate 2a + Gate 2b re-verified at Commit A start in the new
  execution session — expected clean (dry-run already confirmed)
- ☐ Current Verdict flipped from ⏳ **AWAITING GATE RE-RUN** to
  ✅ **READY TO EXECUTE**
- ☐ Starting commit recorded in `session-context-wp084.md` §2
- ☐ Baseline checks populated with actual results
- ☐ Session execution prompt generated (Step 2)
- ☐ Commit A0 (`SPEC:` A0 bundle + amendments) landed
- ☐ Commit A (`EC-109:` execution) landed
- ☐ Commit B (`SPEC:` governance close) landed
