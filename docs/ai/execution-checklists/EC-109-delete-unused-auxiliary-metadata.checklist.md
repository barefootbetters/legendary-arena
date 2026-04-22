# EC-109 — Delete Unused Auxiliary Metadata Schemas and Files (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-084-delete-unused-auxiliary-metadata.md`
(amended 2026-04-21 per A-084-01)
**Layer:** Registry (`packages/registry/src/schema.ts` + `packages/registry/src/index.ts` +
`packages/registry/scripts/validate.ts` + `packages/registry/src/impl/localRegistry.ts`
JSDoc-only + `packages/registry/src/impl/httpRegistry.ts` `// why:` note only)
+ Content / Data (`data/metadata/`) + Viewer dead-code deletion
(`apps/registry-viewer/src/registry/impl/localRegistry.ts` only —
**no viewer runtime code touched**) + Legacy script deletion
(`scripts/Validate-R2-old.ps1`) + Docs sweep
(`docs/**` + `docs/ai/REFERENCE/**`)

## Execution Authority

This EC is the authoritative execution checklist for WP-084. Compliance is
binary. Failure to satisfy any item is failed execution. If EC-109 and WP-084
conflict on **design intent**, the WP wins; on **execution contract** (locked
values, guardrails, pre-flight findings, staging discipline), the EC wins.

**EC slot note:** EC-109 is the next free slot after EC-108 (WP-083) in the
registry-viewer 101+ series. Commit prefix is `EC-109:`; `WP-084:` is rejected
by `.githooks/commit-msg` per P6-36.

**Amendment A-084-01 (2026-04-21):** pre-flight discovered four additional
artifacts outside the original five-file scope: (a) viewer's drifted duplicate
`localRegistry.ts` (confirmed dead by Explore agent), (b) active contract
declarations in `00.2-data-requirements.md`, (c) current-state doc references
across `docs/**`, (d) legacy `Validate-R2-old.ps1`. All folded into this EC;
scope expansion authored on the A0 SPEC bundle before any Commit A edit.

## Execution Style

Delete-only surface reduction. Remove five Zod schemas + their five JSON files
+ one orphan JSON file + one viewer dead-code duplicate + one legacy
PowerShell validator + one validation-script phase block that has no runtime
consumer. Renumber the remaining `validate.ts` phases sequentially. Rewrite
`00.2-data-requirements.md` active contract declarations to historical notes.
Sweep current-state docs for stale references. Update `DECISIONS.md` to
record the rationale and block reintroduction (seven entries total per
A-084-01). Zero replacement schemas. Zero new fetchers. Zero JSON content
edits to surviving files. Zero viewer **runtime** changes (the viewer
localRegistry deletion is an orphan cleanup — browser bundle never imported
it). Zero engine, server, or preplan changes. Zero R2 mutations.

---

## Pre-Flight STOP Gates (Binary — Must All Pass Before Deletion)

> **Gate discipline:** Every item in this section is a pass/fail blocker.
> If any item is ❌ or unknown, STOP. EC-109 is BLOCKED until the finding
> is triaged in writing (either resolved or escalated in the session-context
> file with an amendment to WP-084).

### 1. Branch & baseline

- [ ] Working branch is `wp-084-delete-unused-auxiliary-metadata` cut from
      the current `main` tip, OR execution continues on a clean point of
      `wp-036-ai-playtesting` after EC-036 governance closed cleanly. Record
      the starting commit hash in the session-context file.
- [ ] `pnpm -r build` exits 0 at the starting commit.
- [ ] `pnpm -r --if-present test` exits 0 at the starting commit. Baseline
      passing count is **re-derived at pre-flight** (not assumed from prior
      ECs) and recorded in the session-context file: `_______ tests passing`.
- [ ] `pnpm registry:validate` exits 0 at the starting commit (proves the
      existing five-phase pipeline is green before any phase excision).

### 2. Pre-deletion usage audit (HARD BLOCKER)

Run these commands **verbatim** before deleting anything. Any unexpected
output is a BLOCKER. **(Amended A-084-01 — exclusions updated for
schema-definition site, compiled-artifact site, expanded doc scope, and
historical execution records.)**

```bash
# 2a. The five schemas are referenced ONLY in validate.ts source (not
# in the definition file schema.ts, not in compiled dist/ artifacts).
# Pre-deletion state: schema.ts will still hit these; post-deletion
# state: schema.ts + dist/ hits all disappear. Both runs share the
# same exclusion list.
grep -rnE "CardTypeEntrySchema|HeroClassEntrySchema|HeroTeamEntrySchema|IconEntrySchema|LeadsEntrySchema" \
  packages/ apps/ scripts/ \
  | grep -v "^packages/registry/scripts/validate.ts" \
  | grep -v "^packages/registry/src/schema.ts" \
  | grep -v "^packages/registry/dist/"
# expected: no output (pre-deletion AND post-deletion)

# 2b. The six JSON filenames (five target + orphan) are referenced
# ONLY by in-scope files. A-084-01 expands the exclusion list to
# cover the viewer dead-code file (deleted in Commit A), the legacy
# PS1 file (deleted in Commit A), the amended 00.2 (edited in
# Commit A), the current-state docs sweep (edited in Commit A), the
# pre-flight artifacts, and historical execution records.
grep -rnE "card-types\.json|card-types-old\.json|hero-classes\.json|hero-teams\.json|icons-meta\.json|leads\.json" \
  packages/ apps/ scripts/ docs/ \
  | grep -v "^packages/registry/scripts/validate.ts" \
  | grep -v "^packages/registry/src/schema.ts" \
  | grep -v "^packages/registry/src/impl/localRegistry.ts" \
  | grep -v "^packages/registry/src/impl/httpRegistry.ts" \
  | grep -v "^packages/registry/dist/" \
  | grep -v "^apps/registry-viewer/src/registry/impl/localRegistry.ts" \
  | grep -v "^apps/registry-viewer/src/registry/types/index.ts" \
  | grep -v "^apps/registry-viewer/src/registry/types/types-index.ts" \
  | grep -v "^apps/registry-viewer/CLAUDE.md" \
  | grep -v "^scripts/Validate-R2-old.ps1" \
  | grep -v "^docs/ai/REFERENCE/02-CODE-CATEGORIES.md" \
  | grep -v "^docs/ai/REFERENCE/00.2-data-requirements.md" \
  | grep -v "^docs/03.1-DATA-SOURCES.md" \
  | grep -v "^docs/01-REPO-FOLDER-STRUCTURE.md" \
  | grep -v "^docs/03-DATA-PIPELINE.md" \
  | grep -v "^docs/08-DEPLOYMENT.md" \
  | grep -v "^docs/10-GLOSSARY.md" \
  | grep -v "^docs/11-TROUBLESHOOTING.md" \
  | grep -v "^docs/ai/ARCHITECTURE.md" \
  | grep -v "^docs/ai/REFERENCE/00.5-validation.md" \
  | grep -v "^docs/ai/deployment/r2-data-checklist.md" \
  | grep -v "^docs/prompts-registry-viewer/" \
  | grep -v "^docs/ai/work-packets/WP-08" \
  | grep -v "^docs/ai/work-packets/WP-003" \
  | grep -v "^docs/ai/work-packets/WP-004" \
  | grep -v "^docs/ai/work-packets/WP-009A" \
  | grep -v "^docs/ai/work-packets/WP-014A" \
  | grep -v "^docs/ai/work-packets/WP-015" \
  | grep -v "^docs/ai/work-packets/WP-017" \
  | grep -v "^docs/ai/work-packets/WP-042" \
  | grep -v "^docs/ai/work-packets/WP-043" \
  | grep -v "^docs/ai/work-packets/WP-060" \
  | grep -v "^docs/ai/work-packets/PACKET-TEMPLATE.md" \
  | grep -v "^docs/ai/work-packets/WORK_INDEX.md" \
  | grep -v "^docs/ai/execution-checklists/EC-109" \
  | grep -v "^docs/ai/execution-checklists/EC_INDEX.md" \
  | grep -v "^docs/ai/execution-checklists/EC-003" \
  | grep -v "^docs/ai/execution-checklists/EC-014A" \
  | grep -v "^docs/ai/execution-checklists/EC-042" \
  | grep -v "^docs/ai/execution-checklists/EC-106" \
  | grep -v "^docs/ai/execution-checklists/EC-107" \
  | grep -v "^docs/ai/execution-checklists/EC-108" \
  | grep -v "^docs/ai/DECISIONS.md" \
  | grep -v "^docs/ai/DECISIONS_INDEX.md" \
  | grep -v "^docs/ai/STATUS.md" \
  | grep -v "^docs/ai/REFERENCE/01.4-pre-flight-invocation.md" \
  | grep -v "^docs/ai/session-context/" \
  | grep -v "^docs/ai/invocations/" \
  | grep -v "^docs/archive prompts-legendary-area-game/" \
  | grep -v "^apps/registry-viewer/HISTORY-" \
  | grep -v "^apps/registry-viewer/src/registry/types/index.ts" \
  | grep -v "^apps/registry-viewer/src/registry/types/types-index.ts" \
  | grep -v "^docs/ai/REFERENCE/02-CODE-CATEGORIES.md"
# expected (pre-deletion): no output — all hits are in excluded paths,
#   which are either (a) scheduled for edit in Commit A, (b) historical
#   execution records preserved as-is, or (c) pre-flight artifacts.
# expected (post-deletion, after Commit A lands): no output — the
#   Commit A edits remove the filename mentions from the in-scope
#   excluded paths, and the historical records retain them by design.

# 2c. Orphan confirmation — card-types-old.json has zero references
# outside the same exclusion set.
grep -rn "card-types-old\.json" packages/ apps/ scripts/ docs/ \
  | grep -v "^docs/ai/work-packets/WP-08" \
  | grep -v "^docs/ai/execution-checklists/EC-109" \
  | grep -v "^docs/ai/session-context/session-context-wp084.md" \
  | grep -v "^docs/ai/invocations/preflight-wp084.md"
# expected: no output

# 2d. No R2-upload automation references any of the six target files.
grep -rn "card-types\.json\|card-types-old\.json\|hero-classes\.json\|hero-teams\.json\|icons-meta\.json\|leads\.json" \
  packages/registry/scripts/ apps/ scripts/ \
  | grep -iE "(upload|sync|deploy|r2|bucket)"
# expected: no output

# 2e. (A-084-01) Viewer dead-code audit — confirm the viewer's
# duplicate localRegistry.ts has zero import sites across the repo
# before deleting it.
grep -rn "from ['\"]\.\(\.*/\)*registry/impl/localRegistry['\"]\|from ['\"]\.\(\.*/\)*registry/index['\"]\|from ['\"]\.\(\.*/\)*registry['\"]" \
  apps/registry-viewer/src/
# expected: no output (no viewer source file imports the registry
#   barrel or the localRegistry module directly; all imports use
#   './registry/browser')

grep -rn "apps/registry-viewer/src/registry/impl/localRegistry\|apps/registry-viewer/src/registry/index" \
  .github/ scripts/ packages/ apps/ 2>/dev/null
# expected: no output (no CI job, no script, no package invokes the
#   viewer's localRegistry)

# 2f. (A-084-01) Legacy PS1 audit — confirm scripts/Validate-R2-old.ps1
# is not invoked by any npm script or CI job.
grep -n "Validate-R2-old" package.json apps/*/package.json packages/*/package.json 2>/dev/null
# expected: no output

grep -rn "Validate-R2-old" .github/ 2>/dev/null
# expected: no output
```

- [ ] 2a returns no output
- [ ] 2b returns no output
- [ ] 2c returns no output
- [ ] 2d returns no output
- [ ] 2e returns no output (A-084-01)
- [ ] 2f returns no output (A-084-01)

If **any** command returns output, STOP. The packet is BLOCKED. Triage the
finding (is it a real consumer, a stale doc outside the in-scope list, or a
legitimate exclusion the A-084-01 list missed?) and either resolve it before
continuing or escalate in writing.

### 3. Contract & doc sanity checks

- [ ] `docs/ai/DECISIONS.md` contains **no prior decision** declaring any of
      the five deleted files or schemas as a current or future runtime
      contract. Grep:
      ```bash
      grep -nE "(card-types\.json|hero-classes\.json|hero-teams\.json|icons-meta\.json|leads\.json|CardTypeEntrySchema|HeroClassEntrySchema|HeroTeamEntrySchema|IconEntrySchema|LeadsEntrySchema)" docs/ai/DECISIONS.md
      ```
      Any hit must be reviewed; a "future runtime contract" hit is a BLOCKER.
- [ ] **(AMENDED A-084-01)** `docs/ai/REFERENCE/00.2-data-requirements.md`
      §§2.1 / 2.3 / 2.4 / 2.5 / 2.6 are now **in scope** for Commit A
      rewrite — sections become historical notes referencing the WP-084
      deletion date. Field-contract references at lines 68, 83,
      581–583, 611–623, 689–690 are also rewritten in Commit A per
      WP-084 §H. The original EC-109 block condition ("active contract
      mentions are a BLOCKER until 00.2 is amended under a separate
      DECISIONS entry") is superseded by this amendment: the 00.2 edit
      and the DECISIONS entry land **together** in the same three-commit
      topology. Pre-execution verification: confirm 00.2 currently
      contains the five sections (expected at pre-flight) and plan the
      edits. If 00.2 has drifted since 2026-04-21 (new active mentions
      in sections outside §§2.1 / 2.3 / 2.4 / 2.5 / 2.6 or outside the
      enumerated line references), STOP and extend scope.
- [ ] `packages/registry/scripts/upload-r2.ts` does not reference any of the
      six target files (re-verify — WP-084 audit says it touches `dist/*.json`
      and images, not `data/metadata/`).
- [ ] `apps/registry-viewer/CLAUDE.md` references are catalogued: if
      §"Key Files" or §"Data Flow" mentions any of the deleted files or
      schemas, those lines are scheduled for removal in Commit A.

### 4. `validate.ts` safety check

- [ ] Phase numbering in `validate.ts` is referenced **only inside the file
      itself**. Grep confirms no external script, doc, or automation pins
      "Phase 2" / "Phase 3" / "Phase 4" / "Phase 5" to the current numbering:
      ```bash
      grep -rnE '"Phase [2-5]"|Phase [2-5] of' packages/ apps/ scripts/ docs/ \
        | grep -v "^packages/registry/scripts/validate.ts" \
        | grep -v "^docs/ai/work-packets/WP-08" \
        | grep -v "^docs/ai/execution-checklists/EC-109"
      # expected: no output
      ```
- [ ] Renumbering plan is locked in §Locked Values: former Phase 3 → Phase 2,
      former Phase 4 → Phase 3, former Phase 5 → Phase 4. Former Phase 1 is
      unchanged.
- [ ] `pnpm registry:validate` is confirmed the only npm script that invokes
      `validate.ts`:
      ```bash
      grep -n "validate.ts\|registry:validate" package.json
      ```

### 5. Git-file health

- [ ] None of the six target files has a pending edit in the working tree
      since the 2026-04-21 audit. Run:
      ```bash
      git log --since=2026-04-21 -- data/metadata/card-types.json \
        data/metadata/card-types-old.json data/metadata/hero-classes.json \
        data/metadata/hero-teams.json data/metadata/icons-meta.json \
        data/metadata/leads.json
      ```
      Any post-audit commit touching these files is a BLOCKER — re-read the
      diff, because a late edit may imply a consumer the audit missed.
- [ ] No `.gitignore` or `.gitattributes` rule prevents `git rm` from tracking
      the deletions.

### 6. Deletion-intent confirmation

- [ ] This WP makes **delete-only** changes:
  - No new schemas
  - No replacement JSON
  - No loader rewiring
  - No new fetchers
  - No new npm scripts
- [ ] The four surviving metadata inputs are **LOCKED and untouched**:
  - `data/metadata/keywords-full.json`
  - `data/metadata/rules-full.json`
  - `data/metadata/sets.json`
- [ ] No file under `apps/registry-viewer/src/`, `apps/server/`,
      `packages/game-engine/`, or `packages/preplan/` will be modified.
- [ ] No R2 artifact will be mutated by this packet. If any of the five
      JSON files happen to exist on R2 from a historical manual upload,
      they stay — nothing fetches them. Optional R2 cleanup is out of scope.

### Pre-Flight Verdict (Binary)

- [ ] **ALL gates 1–6 complete → EC-109 MAY EXECUTE.**
- [ ] **ANY gate incomplete → EXECUTION BLOCKED.**

---

## Locked Values (Do Not Re-Derive)

### Five schemas to delete from `packages/registry/src/schema.ts`

Exact identifiers — match byte-for-byte:

- `CardTypeEntrySchema`
- `HeroClassEntrySchema`
- `HeroTeamEntrySchema`
- `IconEntrySchema`
- `LeadsEntrySchema`

Any `z.infer<typeof …>` types exported from these schemas are deleted with
them. If the schemas have adjacent block comments (`// ── Card types ──` etc.),
those comments are deleted in the same edit. Re-derive exact line ranges at
execution time (HEAD may have shifted since the 2026-04-21 audit).

### Six files to delete from `data/metadata/`

Exact paths — verbatim:

- `data/metadata/card-types.json`
- `data/metadata/card-types-old.json`
- `data/metadata/hero-classes.json`
- `data/metadata/hero-teams.json`
- `data/metadata/icons-meta.json`
- `data/metadata/leads.json`

Use `git rm` (not `rm`) so the deletion is tracked in the single Commit A
alongside the code changes.

### `validate.ts` — exact deletions

- Five import lines at HEAD lines ~50–54 (re-derive exact range):
  the `import { CardTypeEntrySchema, HeroClassEntrySchema, HeroTeamEntrySchema,
  IconEntrySchema, LeadsEntrySchema } from …` block in whatever shape it
  takes.
- The entire Phase 2 validation block at HEAD lines ~364–376 (re-derive
  exact range), including its `console.log('Phase 2: …')` header and any
  Phase-2-only helper functions that become unused after the block is
  removed. If a helper is shared with Phases 1/3/4/5, it stays.

### `validate.ts` — phase renumbering (exact)

- Former **Phase 1** (config / registry shape) → **Phase 1** (unchanged)
- Former **Phase 2** (metadata glossary schemas) → **DELETED**
- Former **Phase 3** (per-set card JSON) → **Phase 2**
- Former **Phase 4** (cross-references) → **Phase 3**
- Former **Phase 5** (image spot-checks) → **Phase 4**

Update every in-file reference: `console.log` headers, error prefixes,
section comments, and any internal `const PHASE_NUMBER = N` constants if
present. After the edit, a grep for `Phase 5` inside `validate.ts` must
return zero matches; `Phase 4` must be the new image-spot-check phase.

### `packages/registry/src/index.ts` — re-export delta

Remove any explicit re-export of the five schemas or their inferred types.
If the file uses `export { CardTypeEntrySchema, HeroClassEntrySchema, … }
from "./schema.js"`, delete the relevant names from that list. If the file
uses `export *` (forbidden by repo style but may pre-exist), no edit is
needed — the deleted schemas simply stop being re-exported automatically.
In either case, §Acceptance Criteria requires **manual inspection** to
confirm the deleted names are not re-exported directly or indirectly.

**Current state (verified 2026-04-21):** `packages/registry/src/index.ts`
does NOT currently re-export any of the five schemas. The export block at
lines 30–40 covers only `SetDataSchema`, `SetIndexEntrySchema`,
`HeroCardSchema`, `HeroClassSchema`, `CardQuerySchema`, and the glossary
schemas + types (WP-082 / EC-107 additions). The §B step is
**verify-and-proceed** — no edit expected. If the executor finds any
re-export of the five deleted names (e.g., a subsequent WP has added one),
STOP, investigate the addition, and extend scope before proceeding.

### A-084-01 additions — viewer dead-code deletion

- **Delete** `apps/registry-viewer/src/registry/impl/localRegistry.ts`
  (`git rm`). Confirmed dead by Explore agent 2026-04-21: zero imports
  across the repo, absent from viewer `dist/` bundle, CI never invokes,
  unchanged since initial commit `d5ea067` (2026-03-23).
- **Modify** `apps/registry-viewer/src/registry/index.ts` — remove line
  27 re-export `export { createRegistryFromLocalFiles  } from
  "./impl/localRegistry.js";`. No other edits to this file.
- **Modify** `apps/registry-viewer/CLAUDE.md` — remove the §"Key Files"
  row at line 62 (`| src/registry/impl/localRegistry.ts | Node-only
  CardRegistry factory (CI validation) |`) and any other mention of
  the deleted file. No other edits.
- **Verify** `pnpm --filter registry-viewer build` exits 0 post-edit
  (expected — browser entry `src/registry/browser.ts` uses HTTP-only
  and never depended on the Node file).

### A-084-01 additions — legacy PowerShell validator deletion

- **Delete** `scripts/Validate-R2-old.ps1` (`git rm`). Superseded by
  `scripts/validate-r2.mjs` and `packages/registry/scripts/validate.ts`.
- **Verify** root `package.json:22` invokes `scripts/Validate-R2.ps1`
  (without `-old` suffix) — that's a different current script and is
  **not to be touched**.

### A-084-01 additions — `00.2-data-requirements.md` amendment

Rewrite `docs/ai/REFERENCE/00.2-data-requirements.md` per WP-084 §H:

- §§2.1 / 2.3 / 2.4 / 2.5 / 2.6: convert to historical notes citing
  WP-084 deletion date + Commit A hash, OR remove entirely (author's
  call; historicize is the default)
- Line 68 (`team` field contract): drop the `hero-teams.json` slug
  reference; `team` is a per-set JSON string
- Line 83 (`hc` field contract): drop the `hero-classes.json` abbr
  reference
- Lines 581–583 (glossary markup tokens): rewrite resolution paths
  to reference per-set data + viewer hardcoded maps
  (`HERO_CLASS_GLOSSARY`, `HERO_CLASS_LABELS` per EC-107) instead of
  the deleted metadata files
- Lines 611–623 (`leads.json` Level 2 index): convert to historical
  note
- Lines 689–690 (`leads.json` data quality rules): convert to
  historical note

No new required inputs are introduced. Surviving sections for
`sets.json`, `keywords-full.json`, `rules-full.json` are unchanged.

### A-084-01 additions — current-state docs sweep

Modify the following files to remove or historicize references to the
five deleted filenames. Exact line ranges re-derived at execution
time; the initial 2026-04-21 audit flagged these files but execution
must re-verify:

- `docs/01-REPO-FOLDER-STRUCTURE.md` — lines ~189–193, 209
- `docs/03-DATA-PIPELINE.md` — lines ~24–28
- `docs/08-DEPLOYMENT.md`, `docs/10-GLOSSARY.md`,
  `docs/11-TROUBLESHOOTING.md` — if references present
- `docs/ai/ARCHITECTURE.md` — if references present
- `docs/ai/REFERENCE/00.5-validation.md` — if references present
- `docs/ai/deployment/r2-data-checklist.md` — if references present
- `docs/prompts-registry-viewer/*.md` — per-file enumeration

**Excluded from sweep** (historical execution records — must NOT be
edited): `docs/ai/work-packets/WP-003*`, `WP-009A*`, `WP-014A*`,
`WP-015*`, `WP-017*`, `WP-042*`, `WP-043*`;
`docs/ai/execution-checklists/EC-003*`, `EC-014A*`;
`prompts-legendary-area-game/*` (external archive).

### A-084-01 additions — registry JSDoc cleanup

- `packages/registry/src/schema.ts` file-header JSDoc line 7: remove
  the `card-types.json → card type taxonomy` line
- `packages/registry/src/impl/localRegistry.ts`: remove the stale
  directory-layout JSDoc lines 6–13 naming the five deleted files;
  clean `// why:` references at lines 36, 61, 91 so they reference
  only `sets.json` + per-set JSON
- `packages/registry/src/impl/httpRegistry.ts`: add a one-line note
  after line 50 clarifying that `card-types.json` was deleted by
  WP-084 on YYYY-MM-DD. Keep the educational `// why:` comments
  intact — they document the WP-003 silent-failure pattern that
  remains relevant for future metadata files.

### A-084-01 §L additions — Gate 2b dry-run followups

Surfaced by the post-amendment Gate 2b dry-run (2026-04-21). Pure
JSDoc / single-line doc edits; no runtime or type-signature impact:

- `apps/registry-viewer/src/registry/types/index.ts`: JSDoc at
  lines 87 and 116 replace `card-types.json` → `sets.json` (drift
  from WP-003 fix era — the viewer's httpRegistry actually fetches
  sets.json)
- `apps/registry-viewer/src/registry/types/types-index.ts`:
  identical JSDoc cleanup at lines 87 and 116
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`: line 162 historicize
  the `card-types.json` reference with a WP-084 / D-1203 citation
  (or rephrase to generic "wrong metadata file" example —
  executor's call; default to historicize to preserve the D-1203
  link)

**Scope discipline (A-084-01 §L):** these three files are the
**only** additional viewer / reference edits beyond the core
A-084-01 list. No other viewer runtime file is touched. No other
reference doc is touched. If the executor discovers additional
JSDoc drift during the sweep, STOP and escalate — do not expand
scope further without author authorization.

### Commit prefix

`EC-109:` on the execution commit (A). `SPEC:` on pre-flight bundle (A0) and
governance close (B). `WP-084:` is **forbidden** — the commit-msg hook at
`.githooks/commit-msg` rejects it per P6-36. Subject lines containing `WIP`
/ `misc` / `tmp` / `updates` / `changes` / `debug` / `fix stuff` are also
rejected. Subject must be ≥ 12 characters of substantive summary.

### Three-commit topology

1. **A0 `SPEC:`** — pre-flight bundle: this EC-109 file + `EC_INDEX.md` row
   (Draft) + session-context file + pre-flight verdict (all six gates green)
   + any WP-084 amendments needed on reality reconciliation. Lands before
   any schema, script, or JSON edit.
2. **A `EC-109:`** — execution: `schema.ts` (five schemas removed) +
   `index.ts` (re-exports removed) + `validate.ts` (Phase 2 block excised,
   phases renumbered) + six `data/metadata/*.json` deletions +
   `apps/registry-viewer/CLAUDE.md` / `docs/03.1-DATA-SOURCES.md` /
   `packages/registry/CLAUDE.md` updates if those files mention any deleted
   artifact + any `package.json` script rename if necessary.
3. **B `SPEC:`** — governance close: `STATUS.md` (if it exists) +
   `WORK_INDEX.md` (flip WP-084 `[ ]` → `[x]` with date + Commit A hash) +
   `EC_INDEX.md` (EC-109 → `Done`) + `DECISIONS.md` entries per WP-084
   §Governance (four deletion-lock entries + the future-reintroduction
   pattern entry).

### 01.6 post-mortem disposition

Evaluate each trigger explicitly:

- **New long-lived abstraction?** No — this packet **removes** five
  schemas and one script phase. No abstraction is introduced.
- **New code category?** No — all touched directories (`packages/registry/`,
  `data/metadata/`) are pre-classified.
- **New contract consumed by engine / other packages?** No — the deletion
  strictly removes dead surface area.
- **New setup artifact in `G`?** No — zero engine involvement.
- **Novel keyboard / interaction pattern?** No — no UI change.

**Disposition: NOT TRIGGERED. 01.6 post-mortem is NOT required.** Matches
EC-106 precedent (glossary data migration — new instance of existing
abstraction) and EC-108 precedent (validation retrofit — not triggered).
If execution surfaces a finding that would trigger a post-mortem (e.g., the
renumbering cascades into an unexpected script dependency that requires a
new abstraction to paper over), re-evaluate and author one.

### 01.5 runtime-wiring allowance

**NOT INVOKED.** No `LegendaryGameState` field added, no
`buildInitialGameState` change, no `LegendaryGame.moves` entry, no phase
hook, no viewer store change. The packet is strictly deletion plus doc
updates.

---

## Guardrails (Non-Negotiable)

- **No imports from `packages/game-engine/`, `packages/preplan/`,
  `apps/server/`, `pg`, or `boardgame.io`** are added or removed by
  this packet. Registry layer + registry-viewer dead-code deletion +
  docs sweep only.
- **Viewer edits strictly limited to A-084-01 scope:** the only
  edits to `apps/registry-viewer/**` are (a) deletion of
  `src/registry/impl/localRegistry.ts`, (b) removal of the single
  re-export line 27 in `src/registry/index.ts`, and (c) removal of
  the single §"Key Files" row at line 62 in `CLAUDE.md`. No edits
  to any `.vue` SFC, no edits to `src/lib/**`, `src/composables/**`,
  `src/components/**`, `App.vue`, `main.ts`, `src/registry/schema.ts`,
  `src/registry/shared.ts`, `src/registry/browser.ts`,
  `src/registry/impl/httpRegistry.ts`, `src/registry/types/**`,
  `vite.config.ts`, or `public/*`. Any edit to the viewer beyond
  the A-084-01 list is a scope violation and requires stop-and-
  escalate.
- **`pnpm --filter registry-viewer build` must exit 0 post-deletion**
  to confirm the viewer is unaffected by the dead-code removal (no
  import was broken because no import existed).
- **No new schemas, no replacement JSON, no new fetchers.** The packet is
  delete-only modulo phase renumbering and doc updates.
- **The four surviving metadata files are LOCKED byte-for-byte:**
  `keywords-full.json`, `rules-full.json`, `sets.json`. A `git diff` of
  each must be empty at the end of execution.
- **The surviving schemas are LOCKED byte-for-byte:** `SetDataSchema`,
  `SetIndexEntrySchema`, `HeroCardSchema`, `MastermindCardSchema`,
  `VillainCardSchema`, `VillainGroupSchema`, `SchemeSchema`, `HeroSchema`,
  `MastermindSchema`, `CardQuerySchema`, `RegistryConfigSchema`,
  `KeywordGlossaryEntrySchema` (EC-107), `RuleGlossaryEntrySchema`
  (EC-107), `ViewerConfigSchema` (EC-108), `ThemeIndexSchema` (EC-108),
  `ThemeDefinitionSchema` et al. A `git diff` restricted to those export
  blocks must show zero change.
- **`createRegistryFromLocalFiles` and `createRegistryFromHttp` are not
  touched.** Their callers are not touched.
- **No content changes** to `public/registry-config.json`,
  `content/themes/*.json`, `data/metadata/keywords-full.json`,
  `data/metadata/rules-full.json`, `data/metadata/sets.json`, or any
  R2 artifact.
- **No refactoring or stylistic cleanup** in `validate.ts` beyond the
  Phase 2 excision and the sequential renumbering. Existing Phase 1/3/4/5
  bodies (post-renumber: 1/2/3/4) are preserved verbatim. Existing
  `// why:` comments in those phases are preserved verbatim.
- **No `import *` or barrel re-exports** anywhere.
- **No new dependencies and no dependency removals.** Zod is still used
  by the surviving schemas.
- **No staging of out-of-scope dirty-tree items.** The WP-084 pre-flight
  session-context file enumerates in-scope vs out-of-scope modified files;
  stage by exact filename only. `git add .` / `git add -A` / `git add -u`
  are forbidden (P6-27 / P6-44).
- **Never use `--no-verify` or `--no-gpg-sign`** — commit-msg hook must
  pass on its merits. If the hook rejects a subject, rephrase.
- **Never push to remote** unless explicitly asked.
- **Baseline invariance:** `pnpm -r --if-present test` must exit 0 with
  the pre-flight baseline passing count preserved (deletion of unused
  surface area must not regress any test). No new test file is required.
- **Paraphrase discipline (P6-43 / P6-50):** JSDoc and `// why:` edits
  must not reference `G`, `LegendaryGameState`, `LegendaryGame`,
  `boardgame.io`, `ctx.random`, or engine move names. The changed files
  are registry-layer only; engine vocabulary is out of scope.
- **Schema removal ≠ data removal, on purpose.** JSON files are deleted
  in the same commit as their schemas. Retaining inert JSON without a
  consumer is forbidden by this packet's governance decision.
- **`validate.ts` contract after execution:** the script validates only
  artifacts with live runtime or fetch-time consumers, or cross-file
  integrity the runtime assumes. It is not a parking lot for unconsumed
  metadata.

---

## Required `// why:` Comments

This packet **removes** code. No new `// why:` comments are authored.

- Preserve every existing `// why:` comment in `validate.ts` Phases 1, 3,
  4, 5 (post-renumber: 1, 2, 3, 4) verbatim. None of them reference the
  deleted Phase 2.
- If any existing `// why:` comment in `schema.ts` references one of the
  five deleted schemas (e.g., a cross-reference from a surviving schema's
  comment), the cross-reference is removed but the comment otherwise
  stays. Re-verify at execution time with:
  ```bash
  grep -nB1 -A2 "CardTypeEntrySchema\|HeroClassEntrySchema\|HeroTeamEntrySchema\|IconEntrySchema\|LeadsEntrySchema" packages/registry/src/schema.ts
  ```

---

## Files to Produce

Exact files. Anything outside this list is out of scope.
**(Amended A-084-01 — viewer dead-code deletion + legacy PS1 deletion +
00.2 rewrite + current-state docs sweep + registry JSDoc cleanup.)**

### Commit A0 (SPEC pre-flight bundle)

- `docs/ai/execution-checklists/EC-109-delete-unused-auxiliary-metadata.checklist.md`
  — **this file** (lands in Commit A0)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — adds
  EC-109 Draft row (already present; A-084-01 text update only)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — pending row for
  WP-084 (already present; A-084-01 text update only)
- `docs/ai/work-packets/WP-084-delete-unused-auxiliary-metadata.md`
  — **modified** — A-084-01 amendment text
- `docs/ai/session-context/session-context-wp084.md`
- `docs/ai/invocations/preflight-wp084.md`

### Commit A (EC-109: execution)

**Registry core:**

- `packages/registry/src/schema.ts` — **modified** — delete five
  schemas + adjacent block comments; remove file-header JSDoc line 7
  (`card-types.json` data-source URL)
- `packages/registry/src/index.ts` — **modified if needed** — remove
  re-exports of the five deleted schemas (current state: no such
  re-exports; verify-and-proceed)
- `packages/registry/scripts/validate.ts` — **modified** — remove
  five schema imports; delete `checkOneMetadataFile` helper; delete
  `checkMetadataFiles` function; remove `checkMetadataFiles` call in
  `main()`; renumber former Phases 3/4/5 → 2/3/4 in all in-file
  references (console logs, error prefixes, section comments,
  file-header JSDoc)
- `packages/registry/src/impl/localRegistry.ts` — **modified
  (A-084-01)** — remove stale directory-layout JSDoc lines 6–13;
  clean `// why:` references at lines 36, 61, 91
- `packages/registry/src/impl/httpRegistry.ts` — **modified
  (A-084-01)** — add one-line clarifying note; keep educational
  `// why:` comments intact

**Data deletions:**

- `data/metadata/card-types.json` — **deleted** (`git rm`)
- `data/metadata/card-types-old.json` — **deleted** (`git rm`)
- `data/metadata/hero-classes.json` — **deleted** (`git rm`)
- `data/metadata/hero-teams.json` — **deleted** (`git rm`)
- `data/metadata/icons-meta.json` — **deleted** (`git rm`)
- `data/metadata/leads.json` — **deleted** (`git rm`)

**Viewer dead-code deletion (A-084-01):**

- `apps/registry-viewer/src/registry/impl/localRegistry.ts` —
  **deleted (`git rm`)**
- `apps/registry-viewer/src/registry/index.ts` — **modified** —
  remove line 27 re-export only; no other edits
- `apps/registry-viewer/CLAUDE.md` — **modified** — remove line 62
  §"Key Files" row for the deleted file; remove any other
  references to deleted files or schemas

**Legacy script deletion (A-084-01):**

- `scripts/Validate-R2-old.ps1` — **deleted (`git rm`)**

**Docs sweep (A-084-01):**

- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** —
  rewrite §§2.1 / 2.3 / 2.4 / 2.5 / 2.6 to historical notes; fix
  field-contract references at lines 68, 83, 581–583, 611–623,
  689–690
- `docs/03.1-DATA-SOURCES.md` — **modified** — remove rows for the
  five deleted files
- `docs/01-REPO-FOLDER-STRUCTURE.md` — **modified** — remove
  references at lines ~189–193, 209
- `docs/03-DATA-PIPELINE.md` — **modified** — remove references at
  lines ~24–28
- `docs/08-DEPLOYMENT.md` — **modified if references present**
- `docs/10-GLOSSARY.md` — **modified if references present**
- `docs/11-TROUBLESHOOTING.md` — **modified if references present**
- `docs/ai/ARCHITECTURE.md` — **modified if references present** —
  authoritative doc; any current-state mentions historicized
- `docs/ai/REFERENCE/00.5-validation.md` — **modified if references
  present**
- `docs/ai/deployment/r2-data-checklist.md` — **modified if
  references present**
- `docs/prompts-registry-viewer/*.md` — **modified (per-file
  enumeration at execution)**
- `packages/registry/CLAUDE.md` — **modified if present** — update
  schema inventory
- `package.json` — **modified if needed** (no change anticipated)

### Commit B (SPEC: governance close)

- `docs/ai/DECISIONS.md` — **modified** — **seven** governance
  entries (A-084-01: five original + viewer orphan deletion +
  legacy PS1 deletion)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — flip
  WP-084 `[ ]` → `[x]` with date + Commit A hash
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** —
  flip EC-109 row to `Done`
- `docs/ai/STATUS.md` — **modified if the file exists and prior
  WPs followed that convention**

### Out-of-scope (must NOT be modified)

- `packages/registry/src/theme.schema.ts` — **not touched**
- `packages/registry/src/theme.validate.ts` — **not touched**
- `packages/registry/scripts/upload-r2.ts` — **not touched**
- `data/metadata/keywords-full.json` / `rules-full.json` /
  `sets.json` — **not touched** (LOCKED byte-for-byte)
- `apps/registry-viewer/src/**` — **all runtime files untouched**
  **EXCEPT** the A-084-01 dead-code deletion + re-export removal.
  Specifically untouched: `App.vue`, `main.ts`, `src/lib/*`,
  `src/composables/*`, `src/components/*`, `src/registry/schema.ts`,
  `src/registry/shared.ts`, `src/registry/browser.ts`,
  `src/registry/impl/httpRegistry.ts`, `src/registry/types/**`,
  `public/*`, `vite.config.ts`.
- `apps/server/**` / `packages/game-engine/**` /
  `packages/preplan/**` — **not touched**
- Historical WP / EC artifacts per A-084-01 exclusion list:
  `docs/ai/work-packets/WP-003*`, `WP-009A*`, `WP-014A*`, `WP-015*`,
  `WP-017*`, `WP-042*`, `WP-043*`;
  `docs/ai/execution-checklists/EC-003*`, `EC-014A*` — **not
  touched** (historical execution records)
- `prompts-legendary-area-game/*` (external archive) — **not
  touched**
- No R2 artifact is mutated.

---

## Out of Scope (Do NOT Expand)

- **Fetch-time schema validation** — EC-108 territory. EC-109 does not
  add validation; it removes schemas that validate dead data.
- **Glossary schemas and labels** — EC-107 territory. EC-109 does not
  touch `KeywordGlossaryEntrySchema` or `RuleGlossaryEntrySchema`.
- **R2 cleanup.** If any of the five deleted files happen to exist on R2
  from a historical manual upload, they stay — nothing fetches them.
  Optional manual R2 cleanup is at the author's discretion and not part
  of this packet.
- **`validate.ts` Phases 1, 3, 4, 5 (post-renumber: 1, 2, 3, 4).** Their
  logic is preserved verbatim; only the phase numbers in headers, log
  prefixes, and section comments are updated.
- **New replacement schemas.** None. If a future feature needs any of the
  deleted data concepts, the governance entry requires it be derived from
  per-set data or wired to a new runtime consumer in the same WP.
- **Hero class glossary** — `HERO_CLASS_GLOSSARY` (five hardcoded entries
  in `useRules.ts`) is unrelated to the deleted `hero-classes.json` and
  stays in place.
- **`sets.json` authoring or shape changes.** The surviving `sets.json`
  + `SetIndexEntrySchema` are untouched.
- **`card-types-old.json` copies inside `.claude/worktrees/`.** Worktrees
  are ephemeral; not this packet's concern.
- **Rebuilding or rehosting any data.** No JSON is regenerated.
- **New test frameworks.** Any tests (none required) use `node:test` only.
- **No staging of any pre-existing untracked file or modified doc outside
  the files listed in §Files to Produce.**

---

## Verification Steps (Run In Order; All Must Pass)

```bash
# 1. Dependencies up to date
pnpm install --frozen-lockfile
# expect: exits 0, pnpm-lock.yaml unchanged

# 2. Post-deletion schema grep — five names fully removed from
# current-state source. `dist/` excluded (regenerated at next build).
grep -rnE "CardTypeEntrySchema|HeroClassEntrySchema|HeroTeamEntrySchema|IconEntrySchema|LeadsEntrySchema" \
  packages/ apps/ scripts/ \
  | grep -v "^packages/registry/dist/"
# expect: no output

# 3. Post-deletion filename grep — six files fully removed from
# current-state references. Same A-084-01 exclusion list as Gate 2b.
grep -rnE "card-types\.json|card-types-old\.json|hero-classes\.json|hero-teams\.json|icons-meta\.json|leads\.json" \
  packages/ apps/ scripts/ docs/ \
  | grep -v "^packages/registry/dist/" \
  | grep -v "^packages/registry/src/impl/httpRegistry.ts" \
  | grep -v "^docs/ai/work-packets/WP-08" \
  | grep -v "^docs/ai/work-packets/WP-003" \
  | grep -v "^docs/ai/work-packets/WP-004" \
  | grep -v "^docs/ai/work-packets/WP-009A" \
  | grep -v "^docs/ai/work-packets/WP-014A" \
  | grep -v "^docs/ai/work-packets/WP-015" \
  | grep -v "^docs/ai/work-packets/WP-017" \
  | grep -v "^docs/ai/work-packets/WP-042" \
  | grep -v "^docs/ai/work-packets/WP-043" \
  | grep -v "^docs/ai/work-packets/WP-060" \
  | grep -v "^docs/ai/work-packets/PACKET-TEMPLATE.md" \
  | grep -v "^docs/ai/work-packets/WORK_INDEX.md" \
  | grep -v "^docs/ai/execution-checklists/EC-109" \
  | grep -v "^docs/ai/execution-checklists/EC_INDEX.md" \
  | grep -v "^docs/ai/execution-checklists/EC-003" \
  | grep -v "^docs/ai/execution-checklists/EC-014A" \
  | grep -v "^docs/ai/execution-checklists/EC-042" \
  | grep -v "^docs/ai/execution-checklists/EC-106" \
  | grep -v "^docs/ai/execution-checklists/EC-107" \
  | grep -v "^docs/ai/execution-checklists/EC-108" \
  | grep -v "^docs/ai/DECISIONS.md" \
  | grep -v "^docs/ai/DECISIONS_INDEX.md" \
  | grep -v "^docs/ai/STATUS.md" \
  | grep -v "^docs/ai/REFERENCE/01.4-pre-flight-invocation.md" \
  | grep -v "^docs/ai/session-context/" \
  | grep -v "^docs/ai/invocations/" \
  | grep -v "^docs/archive prompts-legendary-area-game/" \
  | grep -v "^apps/registry-viewer/HISTORY-" \
  | grep -v "^apps/registry-viewer/src/registry/types/index.ts" \
  | grep -v "^apps/registry-viewer/src/registry/types/types-index.ts" \
  | grep -v "^docs/ai/REFERENCE/02-CODE-CATEGORIES.md"
# expect: no output
# Kept exclusions:
#   - httpRegistry.ts retains educational `// why:` comments with a
#     WP-084 deletion-date clarifying note (A-084-01 §K)
#   - Historical WP / EC files record past execution (unchanged)
#   - WORK_INDEX.md / EC_INDEX.md / DECISIONS.md reference the
#     deletion in governance rows (unchanged by design)
#   - Pre-flight artifacts (session-context + preflight invocation
#     files) preserve the pre-execution trace

# 4. data/metadata/ contains exactly the surviving four files
ls data/metadata/
# expect: exactly three entries:
#   keywords-full.json  rules-full.json  sets.json

# 5. validate.ts phase headers are renumbered sequentially
grep -nE "Phase [0-9]+:" packages/registry/scripts/validate.ts
# expect: Phase 1, Phase 2, Phase 3, Phase 4 only
# (Phase 5 is gone; no gaps; no duplicates)

# 6. validate.ts still passes end-to-end
pnpm registry:validate
# expect: exits 0; log output shows the four renumbered phases running
# over sets.json + per-set cards + cross-refs + images

# 7. Build all
pnpm -r build
# expect: exits 0

# 8. Test baseline preserved
pnpm -r --if-present test
# expect: baseline passing count (recorded at pre-flight) / 0 failing

# 9. Typecheck all
pnpm -r --if-present typecheck
# expect: exits 0

# 10. index.ts barrel check — no deleted schema re-exported directly or
#     indirectly
grep -nE "CardTypeEntrySchema|HeroClassEntrySchema|HeroTeamEntrySchema|IconEntrySchema|LeadsEntrySchema" \
  packages/registry/src/index.ts
# expect: no output
# If the file uses `export * from "./schema.js"`, manually inspect
# `schema.ts` to confirm the five names are no longer defined there
# (i.e., the `export *` transitively stops re-exporting them).

# 11. Surviving schemas untouched (byte-for-byte lock verification)
git diff packages/registry/src/theme.schema.ts
# expect: no output
git diff packages/registry/src/theme.validate.ts
# expect: no output
git diff data/metadata/keywords-full.json
# expect: no output
git diff data/metadata/rules-full.json
# expect: no output
git diff data/metadata/sets.json
# expect: no output

# 12. No engine / preplan / server / viewer-runtime / pg / boardgame.io
#     imports appear in changed files
grep -rE "from ['\"](@legendary-arena/(game-engine|preplan|server)|boardgame\\.io|pg)" \
  packages/registry/src/schema.ts \
  packages/registry/src/index.ts \
  packages/registry/scripts/validate.ts
# expect: no output

# 13. No engine vocabulary in JSDoc / comments (P6-50 paraphrase discipline)
grep -rnE "LegendaryGameState|LegendaryGame|boardgame\\.io|ctx\\.random" \
  packages/registry/src/schema.ts \
  packages/registry/scripts/validate.ts
# expect: no output

# 14. No Math.random / Date.now / ctx.random in changed files
grep -rnE "Math\\.random|ctx\\.random|Date\\.now" \
  packages/registry/src/schema.ts \
  packages/registry/scripts/validate.ts
# expect: no output

# 15. No .reduce( introduced or retained in changed sections (code-style
#     invariant — surviving .reduce() uses in unchanged phases may remain
#     only if pre-existing; do not add new ones)
git diff packages/registry/scripts/validate.ts | grep -E "^\\+.*\\.reduce\\("
# expect: no output (the patch adds no new .reduce() call)

# 16. pnpm-lock.yaml unchanged
git diff pnpm-lock.yaml
# expect: no output (no dependency added or removed)

# 17. Files outside allowlist not modified
git diff --name-only
# expect: only files from §Files to Produce (plus EC_INDEX / WORK_INDEX /
# DECISIONS on their respective commits)

# 18. Commit A staged set (before commit)
git status
# expect (A-084-01): ~8 deleted files (the five JSON + card-types-old.json
# + apps/registry-viewer/src/registry/impl/localRegistry.ts +
# scripts/Validate-R2-old.ps1) plus ~15 modified files (schema.ts,
# index.ts [if re-exports present], validate.ts, viewer index.ts,
# viewer CLAUDE.md, 00.2, 03.1, 01-REPO, 03-DATA-PIPELINE, ARCHITECTURE,
# and the current-state docs sweep files, plus registry JSDoc cleanup in
# localRegistry.ts + httpRegistry.ts). NO other files staged.

# 19. (A-084-01) Viewer build still works post-deletion
pnpm --filter registry-viewer build
# expect: exits 0 — browser bundle was never dependent on the deleted
# localRegistry.ts, so deletion is transparent

# 20. (A-084-01) Viewer import audit — confirm nothing imports the
# deleted file
grep -rn "from ['\"]\.\(\.*/\)*registry/impl/localRegistry['\"]\|createRegistryFromLocalFiles" \
  apps/registry-viewer/src/
# expect: no output (createRegistryFromLocalFiles comment in
# glossaryClient.ts line ~22 was removed during Commit A docs sweep,
# OR the comment is rephrased to not reference the deleted function
# name — author's call at execution time)

# 21. (A-084-01) Legacy PS1 gone
ls scripts/Validate-R2-old.ps1 2>&1
# expect: "No such file or directory" or equivalent

grep -n "Validate-R2-old" package.json
# expect: no output

# 22. (A-084-01) 00.2 sections historicized or removed
grep -nE "^## 2\.(1|3|4|5|6) " docs/ai/REFERENCE/00.2-data-requirements.md
# expect: either zero matches (sections removed) OR matches present
# but section bodies reference "deleted by WP-084" historical framing
# — executor confirms by reading each matched section

# 23. (A-084-01) No historical WP / EC file modified
git diff --name-only \
  | grep -E "docs/ai/work-packets/WP-(003|009A|014A|015|017|042|043)|docs/ai/execution-checklists/EC-(003|014A)"
# expect: no output (historical records preserved)

# 24. (A-084-01) DECISIONS.md has the seven governance entries
grep -cE "^### D-.+WP-084|delete.*(card-types|hero-classes|hero-teams|icons-meta|leads|localRegistry|Validate-R2-old)" \
  docs/ai/DECISIONS.md
# expect: at least 7 (executor verifies each entry exists; this is a
# coarse count — the actual entries are reviewed manually)
```

### Manual smoke test (prove no behavioral change)

```bash
pnpm --filter registry-viewer dev
```

- **19a.** Visit `http://localhost:5173/`. Cards load (reads `sets.json`
  + per-set JSON — unaffected). No console errors about missing files or
  undefined data.
- **19b.** Open the Themes tab. All themes render. No `[Themes] Rejected`
  warnings. (Themes path is unaffected by this packet.)
- **19c.** Open the Glossary panel. Keywords and rules populate — reads
  `keywords-full.json` + `rules-full.json` via `glossaryClient.ts`
  (EC-106). Tooltips resolve via `useRules.ts`'s hardcoded
  `HERO_CLASS_GLOSSARY` for hero-class hover — unaffected by the
  `hero-classes.json` deletion because the viewer never read that file.
- **19d.** DevTools → Network → confirm no request to any of the six
  deleted filenames:
      `card-types.json`, `card-types-old.json`, `hero-classes.json`,
      `hero-teams.json`, `icons-meta.json`, `leads.json`. A 404 for any
  of them is a BLOCKER — means a consumer was missed at audit time.
- **19e.** DevTools → Console → no warning or error referencing any
  deleted filename or schema name.

### Manual server smoke test (if a server dev loop exists for local work)

- **20a.** `createRegistryFromLocalFiles()` still constructs a
  registry successfully — the five deleted files were never part of its
  inputs. A `node -e "import('@legendary-arena/registry').then(r =>
  r.createRegistryFromLocalFiles())"` style probe should succeed without
  referencing the deleted files.

---

## After Completing

- [ ] All verification steps 1–24 pass (18 original + 6 A-084-01
      additions)
- [ ] Manual viewer smoke (19a–19e) passes — zero requests for deleted
      filenames, zero console warnings referencing them
- [ ] Server-side spot check (20a) passes if performed
- [ ] Test baseline preserved (record pre-flight vs post-execution in the
      execution summary; no regression)
- [ ] No file outside §Files to Produce modified (`git diff --name-only`)
- [ ] `pnpm-lock.yaml` diff empty
- [ ] `packages/registry/src/theme.schema.ts`, `theme.validate.ts`, and
      the four surviving metadata files all show empty `git diff`
- [ ] `validate.ts` phase numbering is sequential 1/2/3/4 with zero
      references to the deleted Phase 2 or the now-nonexistent Phase 5
- [ ] `index.ts` does not re-export any of the five deleted schema names
      directly or indirectly (manual inspection if `export *` is present)
- [ ] Three-commit topology: A0 `SPEC:` → A `EC-109:` → B `SPEC:` all
      landed with hook-compliant subjects (no `--no-verify`)
- [ ] `EC_INDEX.md` has EC-109 flipped to `Done` in Commit B
- [ ] `WORK_INDEX.md` has WP-084 `[ ]` → `[x]` with date + Commit A hash
      in Commit B
- [ ] `docs/ai/DECISIONS.md` has **seven** WP-084 §Governance entries
      recorded (A-084-01): five original — JSON-deletion +
      reintroduction rule; schema-deletion + reintroduction rule;
      `card-types-old.json` orphan deletion; `validate.ts` contract
      clarification; future-reintroduction pattern (derived OR wired,
      never standalone) — plus two A-084-01 entries — viewer
      duplicate `localRegistry.ts` orphan deletion; legacy
      `Validate-R2-old.ps1` orphan deletion
- [ ] `docs/03.1-DATA-SOURCES.md` updated if it previously listed any
      deleted file
- [ ] `apps/registry-viewer/CLAUDE.md` has §"Key Files" row for
      `localRegistry.ts` removed
- [ ] `apps/registry-viewer/src/registry/index.ts` has the line-27
      re-export of `createRegistryFromLocalFiles` removed
- [ ] `apps/registry-viewer/src/registry/impl/localRegistry.ts` is
      deleted (`git diff --diff-filter=D --name-only` includes it)
- [ ] `pnpm --filter registry-viewer build` exits 0 post-deletion
- [ ] `scripts/Validate-R2-old.ps1` is deleted
- [ ] `docs/ai/REFERENCE/00.2-data-requirements.md` §§2.1 / 2.3 / 2.4
      / 2.5 / 2.6 historicized or removed; field-contract references
      at lines 68, 83, 581–583, 611–623, 689–690 updated
- [ ] Current-state docs sweep complete — `docs/01-REPO-FOLDER-STRUCTURE.md`,
      `docs/03-DATA-PIPELINE.md`, `docs/ai/ARCHITECTURE.md`, and any
      of `docs/08-DEPLOYMENT.md` / `docs/10-GLOSSARY.md` /
      `docs/11-TROUBLESHOOTING.md` / `docs/ai/REFERENCE/00.5-validation.md`
      / `docs/ai/deployment/r2-data-checklist.md` /
      `docs/prompts-registry-viewer/*.md` that had references are
      updated
- [ ] Historical WP / EC files **unmodified** per Verification Step
      23 (`git diff --name-only | grep -E "WP-(003|009A|014A|015|017|042|043)|EC-(003|014A)"`
      returns zero hits)
- [ ] `packages/registry/src/impl/localRegistry.ts` JSDoc cleaned;
      `httpRegistry.ts` retains educational comments with WP-084
      clarifying note
- [ ] None of the out-of-scope inherited dirty-tree items staged or
      committed

---

## Common Failure Smells

- **`pnpm -r build` fails with `Cannot find name 'CardTypeEntrySchema'`**
  somewhere in the repo. A consumer outside `validate.ts` existed that
  the pre-flight audit missed. Do NOT silently re-add the schema — STOP,
  triage the consumer, and either (a) update the consumer to use a
  different source of truth or (b) escalate for a WP amendment.
- **`pnpm registry:validate` fails with "cannot find module" after
  deletion.** An import in `validate.ts` still references one of the five
  deleted schemas. Re-read §Locked Values → `validate.ts — exact
  deletions` and finish the import cleanup.
- **`pnpm registry:validate` fails with a phase-numbering inconsistency
  (e.g., "Phase 3 completed" followed by "Phase 3 starting").** A
  renumbering pass was incomplete. Grep `validate.ts` for every digit 2/3/4/5
  in log strings and section comments; the final state must be 1/2/3/4
  only.
- **DevTools Network shows a 404 for `hero-classes.json` (or any of the
  six deleted names)** during the viewer smoke test. A consumer was
  missed at audit. Do NOT re-add the file — STOP, find the caller, and
  escalate. The WP's whole premise is that nothing fetches these files.
- **`git diff` shows `keywords-full.json` / `rules-full.json` /
  `sets.json` modified.** Accidental edit during deletion sweep. Revert
  immediately — the three survivors are byte-for-byte locked.
- **`git diff` shows `theme.schema.ts` or `theme.validate.ts` modified.**
  Scope creep across packet boundaries. Revert. Those files are
  off-limits to EC-109.
- **`pnpm-lock.yaml` shows a diff.** No dependency change is authorized
  by this packet. Investigate — likely an unintended side-effect of a
  `pnpm install` variant; revert.
- **Commit message rejected by hook.** Subject contains a forbidden word
  (`WIP` / `misc` / `tmp` / `updates` / `changes` / `debug` / `fix stuff`)
  or uses `WP-084:` prefix. Rephrase using `EC-109:` + a substantive
  ≥12-char summary.
- **`00.2-data-requirements.md` audit surfaces an active mention of one
  of the five files as a current/future required input.** This is a hard
  BLOCKER. Do NOT delete the file without amending `00.2` under a
  separate DECISIONS entry — the WP-084 governance rule specifically
  distinguishes active contract (blocks) from historical mention (cleaned
  up in same commit).
- **An `export *` in `index.ts` silently still exposes a deleted schema
  name** (unlikely, but the Acceptance Criteria guard). Manual inspection
  of `schema.ts` confirms the name is actually removed from the source
  module — the `export *` then transitively stops re-exporting it.
- **Test baseline drops by N tests.** Deletion of unused surface area
  should not regress any test. Investigate — likely a test file imported
  a deleted schema as a fixture (audit should have caught this; if not,
  treat as a pre-flight audit miss and STOP).
