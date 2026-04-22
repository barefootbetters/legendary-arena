# Session Prompt — WP-084 Delete Unused Auxiliary Metadata Schemas and Files

**Work Packet:** [docs/ai/work-packets/WP-084-delete-unused-auxiliary-metadata.md](../work-packets/WP-084-delete-unused-auxiliary-metadata.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-109-delete-unused-auxiliary-metadata.checklist.md](../execution-checklists/EC-109-delete-unused-auxiliary-metadata.checklist.md)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp084.md](../session-context/session-context-wp084.md)
**Pre-flight:** [docs/ai/invocations/preflight-wp084.md](preflight-wp084.md) — ⏳ AWAITING GATE RE-RUN → flips to ✅ READY TO EXECUTE once the A0 SPEC amendment lands and Gate 2 re-runs clean in the execution session (pre-flight dry-run 2026-04-21 already confirmed the amended exclusion list is zero-output).
**Amendment:** A-084-01 (2026-04-21) — expands scope with viewer dead-code deletion (confirmed by Explore agent), `00.2-data-requirements.md` in-packet rewrite, current-state docs sweep, legacy `Validate-R2-old.ps1` deletion, registry JSDoc cleanup, and §L viewer types JSDoc + `02-CODE-CATEGORIES.md` fixup (surfaced by Gate 2b dry-run). Pre-flight §Author Decision Log records PS-1..PS-4/PS-8 selections.
**Commit prefix:** `EC-109:` on the execution commit (Commit A); `SPEC:` on the pre-flight bundle (A0) and governance close (B). **`WP-084:` is forbidden** — the commit-msg hook at `.githooks/commit-msg` rejects it per **P6-36** (subject must match `^(EC-[0-9]+[A-Z]?|SPEC|INFRA):`). Subject lines containing `WIP` / `misc` / `tmp` / `updates` / `changes` / `debug` / `fix stuff` are also rejected; subject must be ≥ 12 chars after the prefix.
**WP Class:** **Delete-only subtractive** — Registry + Content / Data hygiene + Registry Viewer dead-code deletion + Legacy script deletion + Docs sweep. **No engine / preplan / server / pg / boardgame.io / arena-client / replay-producer touch points.** **No R2 mutations.**

---

## ⚡ Executor Quick Start (Non-Normative)

**If you read nothing else, follow this order:**

1. Confirm the **Commit A0 SPEC amendment** has landed (WP-084 + EC-109 + preflight-wp084 + session-context-wp084 reflect A-084-01). If not, STOP — the governance bundle is incomplete.
2. Run **Pre-Session Gates** §1–§11 below (branch, baseline, dirty-tree, Gate 2a/2b/2c/2d/2e/2f re-verification).
3. Execute **Commit A (`EC-109:`)** strictly per EC-109 §Locked Values + §Files to Produce + this prompt's §Implementation Task.
4. Run Verification Steps 1–24 per EC-109. All must pass.
5. Land **Commit B (`SPEC:`)** governance close per EC-109 §Three-Commit Topology.

**Absolute no-gos:**

- Do **not** modify `packages/game-engine/`, `apps/server/`, `packages/preplan/`, `apps/arena-client/`, `apps/replay-producer/`, `packages/vue-sfc-loader/`, `content/themes/`, or any `G`/`ctx` state.
- Do **not** modify `apps/registry-viewer/src/**` beyond the A-084-01 carve-out (localRegistry deletion + `index.ts` line 27 re-export removal + `CLAUDE.md` line 62 row removal + `src/registry/types/index.ts` + `src/registry/types/types-index.ts` JSDoc-only cleanup at lines 87+116). **No edits to any `.vue` SFC, no edits to `src/lib/**`, `src/composables/**`, `src/components/**`, `App.vue`, `main.ts`, `src/registry/schema.ts`, `src/registry/shared.ts`, `src/registry/browser.ts`, `src/registry/impl/httpRegistry.ts`, `vite.config.ts`, `public/*`.**
- Do **not** modify any historical WP / EC / session-context / invocation artifact (see exclusion list in EC-109 Gate 2b — these are execution records, not current-state docs).
- Do **not** modify any surviving schema in `schema.ts` (`SetDataSchema`, `SetIndexEntrySchema`, `HeroCardSchema`, `HeroClassSchema`, `HeroSchema`, `MastermindCardSchema`, `MastermindSchema`, `VillainCardSchema`, `VillainGroupSchema`, `SchemeSchema`, `CardQuerySchema`, `RegistryConfigSchema`, `KeywordGlossaryEntrySchema`, `KeywordGlossarySchema`, `RuleGlossaryEntrySchema`, `RuleGlossarySchema`).
- Do **not** modify the four surviving metadata files (`keywords-full.json`, `rules-full.json`, `sets.json`) — LOCKED byte-for-byte.
- Do **not** introduce new schemas, new fetchers, new npm scripts, new test files, new dependencies, or new abstractions.
- Do **not** stage out-of-scope dirty-tree items. `git add .` / `git add -A` / `git add -u` are forbidden (P6-27 / P6-44). Stage by exact filename only.
- Do **not** use `--no-verify` or `--no-gpg-sign`.
- Do **not** push to remote unless explicitly asked.
- Do **not** mutate any R2 artifact. If any of the five deleted files happen to exist on R2 from a historical manual upload, they stay — nothing fetches them. Optional R2 cleanup is out of scope.

If something doesn't fit those constraints → **STOP and escalate.**

---

## Pre-Session Gates (Resolve Before Writing Any File)

These must all be resolved **before the Commit A execution begins**. If any gate is unresolved, STOP.

### 1. Branch cut from WP-084 starting commit

Branch `wp-084-delete-unused-auxiliary-metadata` cut from the current `main` tip (or a clean equivalent — see session-context-wp084 §1). Record the full 40-char SHA in `session-context-wp084.md` §2. All three commits (A0 / A / B) land on this branch.

### 2. Baseline green at starting commit

```bash
pnpm -r build
# expect: exits 0

pnpm -r --if-present test
# expect: exits 0

pnpm registry:validate
# expect: exits 0; log output shows five phases (1/2/3/4/5) running
```

Record actual baseline test count + per-package breakdown in `session-context-wp084.md` §4.2. Any regression vs the amended session-context is a STOP.

### 3. A0 SPEC amendment landed

The A-084-01 amendment must be committed on the A0 SPEC bundle before Commit A begins. Suggested subject: `SPEC: amend WP-084 / EC-109 per pre-flight (A-084-01)`. Files staged in A0:

- `docs/ai/work-packets/WP-084-delete-unused-auxiliary-metadata.md` (A-084-01 amended)
- `docs/ai/execution-checklists/EC-109-delete-unused-auxiliary-metadata.checklist.md` (A-084-01 amended)
- `docs/ai/invocations/preflight-wp084.md` (Author Decision Log recorded)
- `docs/ai/session-context/session-context-wp084.md`
- `docs/ai/invocations/session-wp084-delete-unused-auxiliary-metadata.md` *(this file)*

If A0 has not landed, the session prompt itself is not authoritative — STOP and land A0 first.

### 4. Pre-Flight STOP Gates 1–6 re-run in the execution session

Re-run EC-109 §Pre-Flight STOP Gates 1 through 6 verbatim. All must turn green:

- **Gate 1 — Branch & Baseline:** recorded in §2 above
- **Gate 2a–2f — Pre-Deletion Usage Audit:** six grep commands per EC-109, all must return zero output (the amended exclusion list was dry-run-verified 2026-04-21; a fresh run in the execution session confirms no drift)
- **Gate 3 — Contract & Doc Sanity:** DECISIONS.md no-prior-runtime-contract, `00.2` active contract survey, `upload-r2.ts` clean, `apps/registry-viewer/CLAUDE.md` catalogued
- **Gate 4 — `validate.ts` Safety:** external phase-number references absent, renumbering plan locked, `pnpm registry:validate` uniqueness
- **Gate 5 — Git-File Health:** no post-2026-04-21 commits on the six target files, no `.gitignore` / `.gitattributes` obstruction
- **Gate 6 — Deletion-Intent Confirmation:** delete-only, surviving files locked, no engine / server / preplan / R2 changes

Update `preflight-wp084.md` — flip Current Verdict from ⏳ **AWAITING GATE RE-RUN** to ✅ **READY TO EXECUTE** and record the starting commit hash.

### 5. Working-tree hygiene (dirty-tree map)

`git status --short` will show dirty inherited files. **None outside the in-scope list below are in WP-084 scope.** Stage by exact filename only; never `git add .` / `git add -A` / `git add -u` (P6-27 / P6-44 / P6-50 discipline).

### Inherited Dirty-Tree Map

**In scope for Commit A0 (already landed per §3):**

1. `docs/ai/work-packets/WP-084-delete-unused-auxiliary-metadata.md` (A-084-01 amended)
2. `docs/ai/execution-checklists/EC-109-delete-unused-auxiliary-metadata.checklist.md` (A-084-01 amended)
3. `docs/ai/invocations/preflight-wp084.md`
4. `docs/ai/session-context/session-context-wp084.md`
5. `docs/ai/invocations/session-wp084-delete-unused-auxiliary-metadata.md` (this file)

**In scope for Commit A (see §Implementation Task):**

Enumerated in EC-109 §Files to Produce §Commit A.

**In scope for Commit B:**

- `docs/ai/DECISIONS.md` (seven governance entries)
- `docs/ai/work-packets/WORK_INDEX.md` (flip WP-084 `[ ]` → `[x]`)
- `docs/ai/execution-checklists/EC_INDEX.md` (flip EC-109 to Done)
- `docs/ai/STATUS.md` (if the file exists and prior WPs followed convention)

**Out of scope — quarantine, DO NOT TOUCH OR STAGE:**

All other untracked / modified files currently in `git status`. Common offenders:

- `.claude/worktrees/`, `content/themes/heroes/`, `docs/ai/ideas/`
- `docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md`
- `docs/ai/execution-checklists/EC-108-fetch-time-schema-validation.checklist.md` *(WP-083's EC — orthogonal, independent packet; belongs to a separate session)*
- `docs/ai/invocations/forensics-move-log-format.md`
- `docs/ai/invocations/preflight-wp084.md` *(already in Commit A0)*
- `docs/ai/invocations/session-wp048-par-scenario-scoring.md`
- `docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md`
- `docs/ai/invocations/session-wp068-preferences-foundation.md`
- `docs/ai/post-mortems/01.6-applyReplayStep.md`
- `docs/ai/session-context/session-context-forensics-move-log-format.md`
- `docs/ai/session-context/session-context-wp037.md`
- `docs/ai/session-context/session-context-wp067.md`
- `docs/ai/work-packets/WP-083-fetch-time-schema-validation.md` *(WP-083 draft — orthogonal)*
- `docs/legendary-universal-rules-v23.pdf`

If Commit A or Commit B accidentally stages any quarantined item, **revert and redo the staging**. The three-commit topology requires each commit's file list to match §Files to Produce exactly.

### 6. R2 credentials not required

This packet does **not** push to R2. No PDF upload, no JSON republish, no bucket mutation. If any R2-facing automation is discovered at pre-flight time that references the deleted files, STOP — the audit missed a consumer.

### 7. 01.5 Runtime Wiring Allowance — NOT INVOKED

This session prompt **does not invoke** `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`. All four 01.5 trigger conditions are **absent** from WP-084:

- ❌ **No required field added to `LegendaryGameState`** — WP-084 touches zero engine files
- ❌ **No `buildInitialGameState` shape change** — WP-084 does not touch `packages/game-engine/`
- ❌ **No new `LegendaryGame.moves` entry** — WP-084 does not add moves
- ❌ **No new phase hook** — WP-084 does not modify phase wiring

The amendment A-084-01 expansion (viewer dead-code deletion + JSDoc cleanup + 00.2 rewrite + docs sweep + legacy script deletion) is entirely **off-engine** and does not pattern-match 01.5's scope. Per 01.5 §Escalation: *"It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."* If an unanticipated structural break appears mid-execution, **STOP and escalate** — do not force-fit under 01.5.

This precedent matches **EC-109 §01.5 runtime-wiring allowance** ("NOT INVOKED"), the **WP-030 precedent** (first purely-additive WP to explicitly declare 01.5 not-invoked), and **EC-106 / EC-108** (also NOT INVOKED).

### 8. 01.6 Post-Mortem — NOT TRIGGERED

Per EC-109 §01.6 post-mortem disposition, the trigger criteria are all **absent**:

- ❌ No new long-lived abstraction (this packet **removes** surface area)
- ❌ No new code category (all touched directories pre-classified)
- ❌ No new contract consumed by engine / other packages (deletion only)
- ❌ No new setup artifact in `G` (zero engine involvement)
- ❌ No novel keyboard / interaction pattern (no UI change)

**Disposition: NOT TRIGGERED. 01.6 post-mortem is NOT required.** Matches EC-106 and EC-108 precedent. If execution surfaces a finding that would trigger a post-mortem (e.g., the renumbering cascades into an unexpected script dependency that requires a new abstraction), re-evaluate and author one.

### 9. Dependency check

WP-084 §Dependencies reads: *"None. Independent of WP-082 and WP-083."*

- **WP-082** (commit `3da6ac3`, EC-107 Done 2026-04-21): glossary schemas + labels. Orthogonal. Its `KeywordGlossaryEntrySchema`, `KeywordGlossarySchema`, `RuleGlossaryEntrySchema`, `RuleGlossarySchema` in `schema.ts` are LOCKED byte-for-byte.
- **WP-083** (Draft): fetch-time validation for viewer config + themes. Orthogonal. If its schemas have not landed, the surviving-schemas lock list simply omits them.

If either has drifted from Done / locked state since the A0 amendment was authored, STOP and re-run the Dependency Contract Verification from pre-flight §Dependency Check.

### 10. pnpm-lock.yaml invariance

No dependency is added or removed. `git diff pnpm-lock.yaml` at any point during Commit A must return empty output.

### 11. Commit message discipline

Three subjects will be used. Each must satisfy `^(EC-[0-9]+[A-Z]?|SPEC|INFRA):` and be ≥ 12 characters after the prefix:

- **A0 (SPEC):** `SPEC: amend WP-084 / EC-109 per pre-flight (A-084-01)` *(already landed per §3)*
- **A (EC-109):** `EC-109: delete unused auxiliary metadata schemas and files` *(or similar ≥12-char substantive summary)*
- **B (SPEC):** `SPEC: close WP-084 / EC-109 governance (seven DECISIONS entries + WORK_INDEX + EC_INDEX flip)` *(or similar)*

If the commit-msg hook rejects a subject, rephrase — **never** use `--no-verify`.

If any of §1–§11 is unresolved, STOP.

---

## Implementation Task (Commit A, strictly per EC-109 §Locked Values)

Execute the following edits in a single `EC-109:` commit. Order the edits for minimum risk; always do the **usage audits before any deletion**.

### Task 1 — Re-run Pre-Deletion Usage Audit (Gates 2a–2f)

Run EC-109 §Pre-Flight STOP Gates 2a through 2f verbatim. Any non-zero output is a BLOCKER. Pre-flight dry-run 2026-04-21 confirmed zero output against the amended exclusion list — a fresh run in the execution session confirms nothing has drifted.

### Task 2 — Registry core edits

#### 2a. Delete five schemas from `packages/registry/src/schema.ts`

Remove (exact identifiers, byte-for-byte):

- `CardTypeEntrySchema` (lines ~51–57 at HEAD)
- `HeroClassEntrySchema` (lines ~61–66 at HEAD)
- `HeroTeamEntrySchema` (lines ~70–74 at HEAD)
- `IconEntrySchema` (lines ~79–83 at HEAD)
- `LeadsEntrySchema` (lines ~89–94 at HEAD)

Also remove the adjacent `// ──` comment blocks describing each schema. Re-derive exact line ranges at execution time.

#### 2b. Remove stale file-header JSDoc line from `schema.ts`

Remove the `card-types.json → card type taxonomy` line from the JSDoc at lines 4–9. The surviving lines describe `registry-config.json`, `sets.json`, and `{abbr}.json` — keep those.

#### 2c. Verify `packages/registry/src/index.ts` re-exports

Verify the current state (2026-04-21: `index.ts` does NOT re-export any of the five deleted schemas). This step is **verify-and-proceed** — no edit expected. If you find any re-export of the five deleted names, STOP and escalate.

#### 2d. Excise Phase 2 from `packages/registry/scripts/validate.ts`

Remove:

- Five schema imports at lines 51–55: `CardTypeEntrySchema`, `HeroClassEntrySchema`, `HeroTeamEntrySchema`, `IconEntrySchema`, `LeadsEntrySchema`. Preserve `RegistryConfigSchema` (line 49), `SetIndexEntrySchema` (line 50), `SetDataSchema` (line 56).
- `checkOneMetadataFile` helper function (lines ~302–370) — Phase-2-only, becomes unused after deletion.
- `checkMetadataFiles` function (lines ~372–384) — the Phase 2 block.
- `await checkMetadataFiles(allFindings);` call in `main()` (line ~802).

Renumber former Phases 3 / 4 / 5 → 2 / 3 / 4 in all in-file references:

- Per-set card JSON section header: `Phase 3 — Per-Set Card JSON` → `Phase 2 — Per-Set Card JSON`
- Cross-references section: `Phase 4 — Cross-References` → `Phase 3 — Cross-References`
- Image spot-checks section: `Phase 5 — Image Spot-Checks` → `Phase 4 — Image Spot-Checks`

Update **all** in-file references, not just section headers: `console.log` strings (`phase` constants), error-prefix strings, section comment banners, and the file-header JSDoc at lines 2–43 (five-phase enumeration collapses to four-phase).

Final state: grep `validate.ts` for `Phase 5` returns zero matches; grep for `Phase 4` returns matches only for the image spot-checks section (was Phase 5).

#### 2e. Registry JSDoc cleanup

- `packages/registry/src/impl/localRegistry.ts`: remove stale directory-layout JSDoc lines 6–13 naming the five deleted files (keep the `sets.json` line + per-set JSON description). Clean `// why:` references at lines 36, 61, 91 so they reference only `sets.json` + per-set JSON.
- `packages/registry/src/impl/httpRegistry.ts`: add a one-line note after line 50 clarifying that `card-types.json` was deleted by WP-084 on YYYY-MM-DD (insert the actual Commit A date). **Keep the educational `// why:` comments at lines 47–50 and 67 intact** — they document the WP-003 silent-failure pattern that remains relevant for future metadata files.

### Task 3 — Data file deletions (`git rm`)

```bash
git rm data/metadata/card-types.json
git rm data/metadata/card-types-old.json
git rm data/metadata/hero-classes.json
git rm data/metadata/hero-teams.json
git rm data/metadata/icons-meta.json
git rm data/metadata/leads.json
```

Confirm `ls data/metadata/` returns exactly three files: `keywords-full.json`, `rules-full.json`, `sets.json`.

### Task 4 — Viewer dead-code deletion (A-084-01 §G)

```bash
git rm apps/registry-viewer/src/registry/impl/localRegistry.ts
```

- Modify `apps/registry-viewer/src/registry/index.ts`: remove line 27 (`export { createRegistryFromLocalFiles  } from "./impl/localRegistry.js";`). No other edits.
- Modify `apps/registry-viewer/CLAUDE.md`: remove the §"Key Files" row at line 62 (`| src/registry/impl/localRegistry.ts | Node-only CardRegistry factory (CI validation) |`). Also remove any other mention of `card-types.json`, `hero-classes.json`, `hero-teams.json`, `icons-meta.json`, `leads.json`, or `card-types-old.json` if the audit surfaces one (audit 2026-04-21 found none beyond the line 62 row).
- Run `pnpm --filter registry-viewer build` — must exit 0. Browser entry (`browser.ts`) uses HTTP-only and never depended on the Node file.

### Task 5 — Viewer types JSDoc cleanup (A-084-01 §L)

Pure JSDoc edits — no type signature change, no runtime behavior:

- `apps/registry-viewer/src/registry/types/index.ts`:
  - Line 87: change `/** All set index entries (from card-types.json) */` → `/** All set index entries (from sets.json) */`
  - Line 116: change `Pass ["*"] to load all sets listed in card-types.json (slow — many fetches).` → `Pass ["*"] to load all sets listed in sets.json (slow — many fetches).`
- `apps/registry-viewer/src/registry/types/types-index.ts`: identical cleanup at lines 87 and 116.

No other edits to either file. No edits to any other `src/registry/types/**` file.

### Task 6 — Legacy PowerShell validator deletion (A-084-01 §J)

```bash
git rm scripts/Validate-R2-old.ps1
```

Confirm `scripts/Validate-R2.ps1` (without `-old`) still exists — that's the current PowerShell validator and is **NOT** to be touched.

Confirm `package.json` does not reference `Validate-R2-old` (`grep -n "Validate-R2-old" package.json` returns zero matches).

### Task 7 — `00.2-data-requirements.md` amendment (A-084-01 §H)

Rewrite `docs/ai/REFERENCE/00.2-data-requirements.md`:

- **§2.1 (`card-types.json` — 37 types, lines ~260–275):** convert to historical note. Suggested phrasing: *"**§2.1 Card Types (DEPRECATED).** `data/metadata/card-types.json` was deleted on YYYY-MM-DD by WP-084 (Commit `<hash>`) as unused auxiliary metadata with zero runtime consumers. Card type classification is now derived from per-set data at setup time in `G.villainDeckCardTypes` per WP-014B. If card-type metadata is needed for future work, see DECISIONS.md entry for the reintroduction pattern."*
- **§2.3, §2.4, §2.5, §2.6:** same treatment, adjusted for each filename and deletion rationale. §2.4 (`hero-classes.json`) should note that hero-class display labels are hardcoded in `useRules.ts` `HERO_CLASS_GLOSSARY` + `HERO_CLASS_LABELS` per WP-082 / EC-107. §2.6 (`leads.json`) should note that virtual-card conventions (WP-014B) + per-set data + `G.villainDeckCardTypes` setup-time resolution replaced runtime consumption of this file.

**Alternative (author's call at execution time):** full excision of §§2.1 / 2.3 / 2.4 / 2.5 / 2.6. Default to historicize to preserve audit trail.

Field-contract reference fixes:

- **Line 68** (`team` field contract): remove `— matches slug in hero-teams.json` clause. Final: `| team | string | Team slug from per-set JSON |` or similar.
- **Line 83** (`hc` field contract): remove `— matches abbr in hero-classes.json` clause. Final: `| hc | string \| undefined | Hero class from per-set JSON |`.
- **Lines 581–583** (glossary markup tokens): rewrite resolution paths. Suggested: `[icon:X]` resolves to per-set icon data; `[hc:X]` resolves to viewer's `HERO_CLASS_GLOSSARY` + `HERO_CLASS_LABELS` per WP-082 / EC-107; `[team:X]` resolves to per-set team data.
- **Lines 611–623** (leads.json as "Level 2 cross-set index"): convert to historical note. Suggested: *"Level 2 cross-set indexing was historically provided by `leads.json` (deleted by WP-084 YYYY-MM-DD). Current resolution: villain-group / henchman-group membership is declared per-set in the `{abbr}.json` files; `alwaysLeads` on mastermind entries is validated at setup time by the engine's WP-014B virtual-card pipeline."*
- **Lines 689–690** (leads.json data quality rules): convert to historical note.

No new required inputs are introduced. The four surviving sections for `sets.json`, `keywords-full.json`, `rules-full.json` are **unchanged**.

### Task 8 — Current-state docs sweep (A-084-01 §I)

For each file below, remove or historicize references to the five deleted filenames. Exact line ranges re-derived at execution time:

- `docs/03.1-DATA-SOURCES.md` — remove rows for the five deleted files
- `docs/01-REPO-FOLDER-STRUCTURE.md` — remove references at lines ~189–193, 209 (data/metadata folder layout)
- `docs/03-DATA-PIPELINE.md` — remove lines ~24–28 data-flow diagram references
- `docs/08-DEPLOYMENT.md` — if references present, remove or historicize
- `docs/10-GLOSSARY.md` — if references present, remove or historicize
- `docs/11-TROUBLESHOOTING.md` — if references present, remove or historicize
- `docs/ai/ARCHITECTURE.md` — if references present (authoritative doc), remove or historicize
- `docs/ai/REFERENCE/00.5-validation.md` — if references present
- `docs/ai/deployment/r2-data-checklist.md` — if references present
- `docs/prompts-registry-viewer/*.md` — per-file enumeration at execution
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` line 162 — historicize the `card-types.json` reference with a WP-084 / D-1203 citation (or rephrase to generic "wrong metadata file" example; default to historicize)
- `packages/registry/CLAUDE.md` — if it exists and lists any of the five deleted schemas, update the schema inventory

**Excluded from sweep** (historical execution records — MUST NOT be edited): see EC-109 Gate 2b exclusion list.

### Task 9 — Verification

Run EC-109 §Verification Steps 1–24 verbatim. **All** must pass:

- Step 1: `pnpm install --frozen-lockfile` exits 0, lock unchanged
- Step 2: post-deletion schema grep returns zero (filtered)
- Step 3: post-deletion filename grep returns zero (filtered)
- Step 4: `ls data/metadata/` returns three files
- Step 5: `validate.ts` phase headers grep returns Phase 1/2/3/4 only
- Step 6: `pnpm registry:validate` exits 0 with four-phase output
- Step 7: `pnpm -r build` exits 0
- Step 8: `pnpm -r --if-present test` exits 0 with baseline count preserved
- Step 9: `pnpm -r --if-present typecheck` exits 0
- Step 10: `index.ts` schema-name grep returns zero
- Step 11: surviving schemas + four survivors show empty `git diff`
- Step 12: no engine / preplan / server / viewer-runtime / pg / boardgame.io imports in changed registry files
- Step 13: no engine vocabulary in JSDoc / comments (P6-50 paraphrase discipline)
- Step 14: no `Math.random` / `ctx.random` / `Date.now` in changed files
- Step 15: no new `.reduce(` introduced
- Step 16: `pnpm-lock.yaml` diff empty
- Step 17: `git diff --name-only` contains only listed files
- Step 18: `git status` shows the expected staged set
- Step 19 (A-084-01): `pnpm --filter registry-viewer build` exits 0
- Step 20 (A-084-01): viewer import audit returns zero matches
- Step 21 (A-084-01): `scripts/Validate-R2-old.ps1` gone; `package.json` has no `Validate-R2-old` reference
- Step 22 (A-084-01): `00.2` §§2.1/2.3/2.4/2.5/2.6 historicized or removed
- Step 23 (A-084-01): no historical WP / EC file modified
- Step 24 (A-084-01): DECISIONS.md will have seven governance entries after Commit B

Also run the manual viewer smoke (Step 19a–19e): no 404s in DevTools Network for any of the six deleted filenames; no console warnings referencing them; cards / themes / glossary all load.

If any step fails, STOP — do not paper over. Review §Common Failure Smells in EC-109 before taking action.

### Task 10 — Commit A

Stage the files enumerated in EC-109 §Files to Produce §Commit A **by exact filename**. Do NOT use `git add .` / `-A` / `-u`.

Commit message suggestion (≥12 char after prefix):

```
EC-109: delete unused auxiliary metadata schemas and files

Deletes five unused Zod schemas (CardTypeEntrySchema, HeroClassEntrySchema,
HeroTeamEntrySchema, IconEntrySchema, LeadsEntrySchema), their five JSON
files in data/metadata/, the orphan card-types-old.json, and the
validate.ts Phase 2 metadata-validation block. Renumbers former Phases
3/4/5 -> 2/3/4.

A-084-01 amendment expansion: deletes the viewer's drifted duplicate
localRegistry.ts (confirmed dead by Explore agent 2026-04-21) and its
re-export + CLAUDE.md row; deletes legacy scripts/Validate-R2-old.ps1
(superseded orphan); rewrites 00.2-data-requirements.md sections 2.1/2.3
/2.4/2.5/2.6 from active contracts to historical notes; sweeps
current-state docs for stale references; cleans drifted JSDoc in the
viewer's types files + main registry's localRegistry.ts.

Zero runtime consumers per 2026-04-21 audit. Four surviving metadata files
(keywords-full.json, rules-full.json, sets.json) LOCKED byte-for-byte.
No engine, server, preplan, or viewer runtime code touched beyond the
A-084-01 dead-code deletion carve-out. No R2 mutations.

Baseline preserved: <N> tests passing / 0 failing (<pkg-breakdown>).

Refs:
- docs/ai/work-packets/WP-084-delete-unused-auxiliary-metadata.md
- docs/ai/execution-checklists/EC-109-delete-unused-auxiliary-metadata.checklist.md
- docs/ai/invocations/preflight-wp084.md §Amendment A-084-01
```

Confirm the commit-msg hook accepts the subject on its merits. **Never** use `--no-verify`.

### Task 11 — Commit B (Governance Close)

Stage exactly four (or five if STATUS.md exists) files **by name**:

- `docs/ai/DECISIONS.md` — append seven governance entries per WP-084 §Governance (amended). Each entry uses `### D-NNNN —` heading. Allocate the next free decision IDs sequentially. Entries must include:
  1. **Five JSON files deletion + reintroduction rule.** Back-link to D-1203 (*"see D-1203 for the silent-failure precedent that motivated extra caution around card-types.json specifically"*).
  2. **Five schemas deletion + reintroduction rule.**
  3. **`card-types-old.json` orphan deletion.**
  4. **`validate.ts` contract clarification.** One-sentence acknowledgement that `sets.json` soft-validation (count / invalid-entry warnings) moves exclusively to Phase 1's abbreviation extraction — runtime still validates at the `SetIndexEntrySchema.safeParse` boundary (Phase 1 local mode) or HTTP loader boundary (R2 mode).
  5. **Future reintroduction pattern** (derived OR wired, never standalone).
  6. **Viewer duplicate `localRegistry.ts` orphan deletion (A-084-01).** Cite Explore agent 2026-04-21 verdict with the seven pieces of evidence summarized.
  7. **Legacy `Validate-R2-old.ps1` orphan deletion (A-084-01).** Cite supersession by `validate-r2.mjs` and `validate.ts`.

  Also update **D-6002** with a one-line historical-neighbor note (A-084-01 PS-9): *"Updated YYYY-MM-DD per WP-084 — the five auxiliary files `card-types.json`, `hero-classes.json`, `hero-teams.json`, `icons-meta.json`, `leads.json` listed above have been deleted. Glossary JSON remains co-located with `sets.json`, `keywords-full.json`, and `rules-full.json` under `data/metadata/`."*

  **D-1203 is immutable** — do not edit. The back-link from governance entry #1 preserves the link.

- `docs/ai/work-packets/WORK_INDEX.md` — flip WP-084 `[ ]` → `[x]` with date (YYYY-MM-DD) + Commit A short hash.
- `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-109 row status to `Done`. Update the summary counts at the bottom: `Draft` -1, `Done` +1.
- `docs/ai/STATUS.md` — if the file exists and prior WPs followed that convention, add a WP-084 completion line. If the file does not exist, skip — WORK_INDEX.md status column satisfies the lint gate §1 requirement per established repo convention.

Commit message suggestion:

```
SPEC: close WP-084 / EC-109 governance (seven DECISIONS entries + WORK_INDEX + EC_INDEX + D-6002 note)
```

Commit A hash is referenced in WORK_INDEX.md and optionally in the DECISIONS entries. Use the A commit's short 7-char SHA.

If the commit-msg hook rejects, rephrase — **never** use `--no-verify`.

---

## Scope Reminders (Delete-Only, Amendment A-084-01)

### Permitted edits (Commit A)

All listed in EC-109 §Files to Produce §Commit A and summarized in Tasks 2–8 above.

### Forbidden edits

- No engine / server / preplan / arena-client / replay-producer / vue-sfc-loader / content-themes changes
- No viewer edits beyond A-084-01 carve-out (localRegistry deletion + `index.ts` re-export removal + `CLAUDE.md` row removal + types files JSDoc-only cleanup)
- No surviving schema / metadata file modifications
- No new schemas, fetchers, npm scripts, test files, dependencies, or abstractions
- No R2 mutations
- No edits to historical WP / EC / session-context / invocation artifacts
- No `--no-verify`, no `--no-gpg-sign`, no `git add .` / `-A` / `-u`
- No push to remote unless explicitly asked

### Paraphrase discipline (P6-43 / P6-50)

JSDoc and `// why:` edits must **not** reference `G`, `LegendaryGameState`, `LegendaryGame`, `boardgame.io`, `ctx.random`, or engine move names. The changed files are registry-layer + viewer-dead-code + docs only; engine vocabulary is out of scope.

### Commit discipline

- Three commits: A0 (`SPEC:`, already landed), A (`EC-109:`), B (`SPEC:`)
- Subject must match `^(EC-[0-9]+[A-Z]?|SPEC|INFRA):` and be ≥ 12 characters after the prefix
- Forbidden words in subject: `WIP`, `misc`, `tmp`, `updates`, `changes`, `debug`, `fix stuff`
- `git add` by exact filename; no `.` / `-A` / `-u`
- Each commit's staged set must match §Files to Produce exactly — no spillover from adjacent untracked items
- Commit A hash is the governance anchor — it appears in WORK_INDEX.md row flip + optionally in the DECISIONS entries

---

## Failure Modes (See EC-109 §Common Failure Smells)

Re-read EC-109 §Common Failure Smells before acting on any failure. The most likely issues:

- **`pnpm -r build` fails with `Cannot find name 'CardTypeEntrySchema'`** — a consumer outside `validate.ts` existed that the pre-flight audit missed. Do NOT silently re-add the schema — STOP, triage the consumer, and either (a) update the consumer to use a different source of truth or (b) escalate for a WP amendment.
- **`pnpm registry:validate` fails with "cannot find module"** — an import in `validate.ts` still references one of the five deleted schemas.
- **Phase numbering inconsistency** — the renumbering pass was incomplete. Grep `validate.ts` for every digit 2/3/4/5 in log strings and section comments.
- **DevTools 404 for a deleted filename** during viewer smoke — a consumer was missed at audit. Do NOT re-add the file — STOP, find the caller, and escalate.
- **`git diff` shows a surviving metadata file modified** — accidental edit during deletion sweep. Revert immediately.
- **`git diff` shows `theme.schema.ts` / `theme.validate.ts` modified** — scope creep across packet boundaries. Revert.
- **`pnpm-lock.yaml` shows a diff** — investigate; no dependency change authorized.
- **Commit message rejected** — rephrase. Never `--no-verify`.
- **Historical WP / EC file modified** — `git diff --name-only | grep -E "WP-(003|009A|014A|015|017|042|043)|EC-(003|014A)"` should return zero. If non-zero, revert those files.
- **Viewer build fails post-localRegistry deletion** — `pnpm --filter registry-viewer build` should exit 0 because the browser bundle never imported the file. If it fails, something else was relying on the re-export — STOP and investigate.
- **Amendment-scope creep** — executor discovers additional drifted JSDoc comments or stale references not in A-084-01 §L. STOP and escalate — do not silently expand scope.

---

## Final Reminder

This is a **delete-only subtractive** WP. Every edit removes surface area or historicizes stale references. **Zero new abstractions, zero new tests, zero new dependencies, zero runtime behavior change.**

If at any point the executor finds themselves *adding* functionality — new types, new helpers, new validators, new migration code — **STOP**. The premise of WP-084 is that the five files + viewer duplicate + legacy PS1 have no consumers and no replacement is needed. If the premise breaks, escalate; do not paper over with new code.

**Good luck. The audit was thorough. Trust the pre-flight + amendment + dry-run.**
