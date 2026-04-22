# Session Context — WP-083 (Fetch-Time Schema Validation for Registry-Viewer Clients)

**Purpose:** Full context the WP-083 executing session needs to begin without re-deriving project state. Produced by the WP-083 A0 SPEC pre-flight bundle on 2026-04-21. Read this file at step 0 of the execution workflow (per `01.4` §Step-sequencing rules).

**Prior WP:** WP-082 / EC-107 (Keyword & Rule Glossary Schema, Labels, and Rulebook Deep-Links) — completed 2026-04-21 at commit `3da6ac3`. Baseline **596 passing / 0 failing** locked at that commit.

**Parallel WP:** WP-084 / EC-109 (Delete Unused Auxiliary Metadata Schemas and Files) — **in-flight** as of session-context authoring. See §2.3 for coordination rules.

---

## 1. Dependency Chain & Test Baseline

### 1.1 Dependencies

| WP | Status | Commit | Role in WP-083 |
|---|---|---|---|
| WP-060 / EC-106 | ✅ Complete | `412a31c` | Glossary data migrated to R2; `glossaryClient.ts` validation precedent this packet extends |
| WP-082 / EC-107 | ✅ Complete | `3da6ac3` | `.strict()` + `/schema` subpath + `.safeParse()` fetch-boundary pattern; A-082-01 established the `"./schema"` subpath that A-083-04 mirrors for `"./theme.schema"` |
| WP-055 / EC-055 | ✅ Complete (pre-dates workflow) | — | Authored `theme.schema.ts` with five locked schemas; D-5504 / D-5509 protect schema body |
| WP-084 / EC-109 | 🟡 In flight (uncommitted working-tree changes) | — | Orthogonal deletion packet — does NOT block WP-083 (see §2.3) |

### 1.2 Test baseline (locked)

- **596 passing / 0 failing** at commit `3da6ac3`:
  - `packages/game-engine` — 444 / 0
  - `packages/registry` — 13 / 0
  - `packages/vue-sfc-loader` — 11 / 0
  - `packages/preplan` — 52 / 0
  - `apps/replay-producer` — 4 / 0
  - `apps/server` — 6 / 0
  - `apps/arena-client` — 66 / 0
  - `apps/registry-viewer` — no test script (0 / 0)

- **WP-083 required new tests:** 0. The retrofit preserves the baseline exactly unless the executor elects to author optional schema-parse tests per copilot-check Finding #11.

- **Optional schema-parse tests (executor's call):** if authored, they live at `packages/registry/src/schema.test.ts` (or an extension of an existing smoke file). Structure: one `describe()` block per new schema — `describe('ViewerConfigSchema (WP-083)', ...)` with 3 `test()` cases (valid minimal shape, unknown-field reject via `.strict()`, missing required field reject) plus `describe('ThemeIndexSchema (WP-083)', ...)` with 2 `test()` cases (valid minimal array, non-`.json`-suffix reject). **If authored:** baseline becomes **601 / 0** with `+5` tests and `+2` suites; the session prompt MUST re-declare the baseline before Commit A.

- **Build baseline:** `pnpm -r build` exits 0 at commit `3da6ac3` and re-confirmed by pre-flight 2026-04-21.

### 1.3 Post-WP-084 baseline coordination

If WP-084 lands before WP-083 executes, the baseline becomes **596 / 0 minus any WP-084 test deltas**. WP-084 §Acceptance Criteria line 919–921 locks "baseline passing count preserved" — WP-084 should not regress the count. Cross-check at WP-083 execution time via `pnpm -r --if-present test` on the fresh `wp-083-*` branch. If the count differs from 596, investigate before proceeding.

---

## 2. Working-Tree State & Coordination with WP-084

### 2.1 Branch strategy (mandatory)

**Do not execute WP-083 on top of the current dirty working tree.** Cut a fresh topic branch from `main` (or from whatever commit hash carries the most recent WP-084 / WP-083 A0 SPEC bundle) for execution:

```bash
git fetch origin
git checkout main
git pull --ff-only
git checkout -b wp-083-fetch-time-schema-validation
```

Rationale: the current working tree at 2026-04-21 session-context authoring contains ~60 modified / deleted items (see §2.2 / §2.3), most driven by WP-084 execution being partially applied uncommitted. A clean branch cut from `main` guarantees the WP-083 executor starts from the baseline WP-082/EC-107 locked at `3da6ac3`, not from a moving target.

### 2.2 In-scope files (A0 SPEC bundle — landing in this commit)

These are the files WP-083's A0 SPEC commit authors and stages. All are either new (untracked before A0 SPEC) or existing governance files being extended:

| Path | Type | Purpose |
|---|---|---|
| `docs/ai/work-packets/WP-083-fetch-time-schema-validation.md` | NEW | The work packet (with A-083-01..04 amendments) |
| `docs/ai/execution-checklists/EC-108-fetch-time-schema-validation.checklist.md` | NEW | The execution checklist (authoritative contract) |
| `docs/ai/work-packets/WORK_INDEX.md` | MODIFIED | Add WP-083 row between WP-082 and WP-084 |
| `docs/ai/execution-checklists/EC_INDEX.md` | MODIFIED | Add EC-108 row between EC-107 and EC-109 |
| `docs/ai/session-context/session-context-wp083.md` | NEW (this file) | Session context for the execution session |
| `docs/ai/invocations/preflight-wp083.md` | EXISTING (v1 + v2 appended) | Pre-flight v2 with READY verdict + PS-1/2/3 resolution |
| `docs/ai/invocations/copilot-check-wp083.md` | EXISTING (v1 + v2 appended) | Copilot-check v2 with CONFIRM disposition |
| `docs/ai/invocations/session-wp083-fetch-time-schema-validation.md` | NEW | Session execution prompt |

### 2.3 Out-of-scope (must not be staged in any WP-083 commit)

The working tree at session-context authoring time (2026-04-21, observed via `git status --porcelain`) contains the following items unrelated to WP-083. **None may be staged in any of the three WP-083 commits (A0 / A / B).** The executor stages by exact filename only per P6-27 / P6-44; `git add .` / `git add -A` / `git add -u` are forbidden by EC-108 §Non-Negotiable.

**WP-084 execution-class changes (in-flight; belongs to WP-084's session, not WP-083's):**

- `D apps/registry-viewer/src/registry/impl/localRegistry.ts` (WP-084 §G deletion)
- `M apps/registry-viewer/src/registry/index.ts` (WP-084 §G re-export removal)
- `M apps/registry-viewer/src/registry/types/index.ts` (WP-084 §L JSDoc cleanup)
- `M apps/registry-viewer/src/registry/types/types-index.ts` (WP-084 §L JSDoc cleanup)
- `M apps/registry-viewer/CLAUDE.md` (WP-084 §F §"Key Files" row removal — WP-083 also edits this file; §2.4 conflict-resolution applies)
- `D data/metadata/card-types-old.json` (WP-084 §D)
- `D data/metadata/card-types.json` (WP-084 §D)
- `D data/metadata/hero-classes.json` (WP-084 §D)
- `D data/metadata/hero-teams.json` (WP-084 §D)
- `D data/metadata/icons-meta.json` (WP-084 §D)
- `D data/metadata/leads.json` (WP-084 §D)
- `M docs/01-REPO-FOLDER-STRUCTURE.md` (WP-084 §I docs sweep)
- `M docs/03-DATA-PIPELINE.md` (WP-084 §I)
- `M docs/03.1-DATA-SOURCES.md` (WP-084 §I — WP-083 also may edit this; §2.4 applies)
- `M docs/08-DEPLOYMENT.md` (WP-084 §I)
- `M docs/10-GLOSSARY.md` (WP-084 §I)
- `M docs/11-TROUBLESHOOTING.md` (WP-084 §I)
- `M docs/ai/ARCHITECTURE.md` (WP-084 §I)
- `M docs/ai/REFERENCE/00.2-data-requirements.md` (WP-084 §H)
- `M docs/ai/REFERENCE/00.5-validation.md` (WP-084 §I)
- `M docs/ai/REFERENCE/02-CODE-CATEGORIES.md` (WP-084 §L)
- `M docs/ai/deployment/r2-data-checklist.md` (WP-084 §I)
- `M docs/prompts-registry-viewer/00-index.md` (WP-084 §I)
- `M docs/prompts-registry-viewer/01-r2-data-structure.md` (WP-084 §I)
- `M docs/prompts-registry-viewer/03-registry-package.md` (WP-084 §I)
- `M docs/prompts-registry-viewer/04-registry-viewer-spa.md` (WP-084 §I)
- `D scripts/Validate-R2-old.ps1` (WP-084 §J)
- `M packages/registry/scripts/validate.ts` (WP-084 §C Phase-2 excision)
- `M packages/registry/src/impl/httpRegistry.ts` (WP-084 §K JSDoc cleanup)
- `M packages/registry/src/impl/localRegistry.ts` (WP-084 §K JSDoc cleanup)
- `M packages/registry/src/schema.ts` (WP-084 §A — deletes 5 schemas + comments; WP-083 §A will append 2 new schemas + comments; §2.4 conflict-resolution applies)
- `M docs/ai/invocations/preflight-wp084.md` (WP-084 amendment record)
- `M docs/ai/session-context/session-context-wp084.md` (WP-084 session-context update)
- `M docs/ai/execution-checklists/EC-066-registry-viewer-data-toggle.checklist.md` (unrelated)
- `M docs/ai/work-packets/WP-066-registry-viewer-data-toggle.md` (unrelated)

**WP-084 governance artifacts (untracked — will land via WP-084's commits):**

- `?? docs/ai/execution-checklists/EC-108-fetch-time-schema-validation.checklist.md` — wait, this IS WP-083's EC. Belongs to WP-083's A0 SPEC. Move from "out-of-scope" to "in-scope" (already listed in §2.2).
- `?? docs/ai/work-packets/WP-083-fetch-time-schema-validation.md` — WP-083's WP. Belongs to A0 SPEC (already listed in §2.2).
- `?? docs/ai/invocations/preflight-wp083.md` — WP-083's pre-flight (already listed in §2.2).
- `?? docs/ai/invocations/copilot-check-wp083.md` — WP-083's copilot check (already listed in §2.2).
- `?? docs/ai/invocations/kickoff-wp084-new-session.md` — WP-084 artifact.

**Unrelated / pre-existing drift (must not be staged):**

- `M data/cards/bkpt.json` (pre-existing upstream data regeneration; not in any WP's scope)
- `M package.json` (pre-existing script additions; not in WP-083's allowlist — WP-083 only touches `packages/registry/package.json`)
- `?? content/themes/heroes/` — single file `black-widow.json`; unrelated theme-authoring work in flight
- `?? .claude/worktrees/` — tooling artifact; never committed
- `?? docs/2022-BlackPanther_Rulesheet.pdf` — unrelated PDF
- `?? docs/legendary-universal-rules-v23.pdf` — rulebook PDF (already uploaded to R2 by WP-082 / EC-107; retained locally)
- `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md` — unrelated reference
- `?? docs/ai/ideas/` — ideas directory; unrelated
- `?? docs/ai/invocations/forensics-move-log-format.md` — unrelated
- `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md` — unrelated WP-048 draft
- `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md` — unrelated WP-067 draft
- `?? docs/ai/invocations/session-wp068-preferences-foundation.md` — unrelated WP-068 draft
- `?? docs/ai/post-mortems/01.6-applyReplayStep.md` — unrelated post-mortem
- `?? docs/ai/session-context/session-context-forensics-move-log-format.md` — unrelated
- `?? docs/ai/session-context/session-context-wp037.md` — unrelated WP-037 draft
- `?? docs/ai/session-context/session-context-wp067.md` — unrelated WP-067 draft

### 2.4 Conflict-resolution rules (WP-083 ↔ WP-084 overlap)

Two of WP-083's in-scope files also appear in WP-084's out-of-scope list:

- **`packages/registry/src/schema.ts`** — WP-084 deletes 5 schemas + adjacent comments (lines ~49–94 at WP-084 HEAD); WP-083 appends 2 new schemas + inferred types at the end of the file (after the glossary schemas added by EC-107) and updates one comment adjacent to `RegistryConfigSchema` (line ~31–32). **The edits are disjoint** — WP-084 deletes an upstream region; WP-083 appends a downstream region + edits a preserved-body comment. No merge conflict.
  - **If WP-084 lands first (recommended):** WP-083 executor reads the post-WP-084 `schema.ts` and appends as planned. Line numbers shift (all schemas are now lower in the file) — EC-108 already instructs "re-derive at execution time".
  - **If WP-083 lands first:** WP-084 executor's grep audits for `CardTypeEntrySchema` et al. still find the 5 targets; `ViewerConfigSchema` / `ThemeIndexSchema` are not in WP-084's deletion targets.
  - **If landed concurrently on different branches:** clean merge at `schema.ts` because the edits don't overlap.
- **`apps/registry-viewer/CLAUDE.md`** — WP-084 removes one §"Key Files" row (line 62: the deleted `localRegistry.ts`); WP-083 annotates two rows for `registryClient.ts` and `themeClient.ts` (lines 56–57 in the WP-082-era file). **Edits at different line ranges.** Clean merge.
- **`docs/ai/DECISIONS.md`** — WP-084 adds D-0840x entries; WP-083 adds D-083A..E entries. No overlap.
- **`docs/ai/work-packets/WORK_INDEX.md`** — WP-084 flips its own `[ ]` → `[x]`; WP-083 flips its own. Different rows. Clean merge.
- **`docs/ai/execution-checklists/EC_INDEX.md`** — EC-109 vs EC-108 rows. Different rows. Clean merge.
- **`docs/03.1-DATA-SOURCES.md`** — WP-084 removes rows for the five deleted metadata files; WP-083 may (optionally) add rows for viewer public config + themes. Different rows. Clean merge. WP-083 §F explicitly grants permission to skip, so the executor's judgment decides.

**Recommendation:** WP-083 executor waits for WP-084 to commit (or explicitly doesn't — the two are declared independent). Either ordering works.

---

## 3. Key Artifacts & Contracts

### 3.1 Schemas touched by WP-083

- **NEW** `ViewerConfigSchema` (strict object): `{ metadataBaseUrl: url, eagerLoad?: string[2–10], rulebookPdfUrl?: url }`. Lives in `packages/registry/src/schema.ts`. Exposed via `@legendary-arena/registry/schema` subpath.
- **NEW** `ThemeIndexSchema` (array): each element a `string().regex(/\.json$/)`. Lives in `packages/registry/src/schema.ts`. Exposed via `@legendary-arena/registry/schema` subpath.
- **REUSED** `ThemeDefinitionSchema` + `ThemeDefinition` type (from `packages/registry/src/theme.schema.ts`). Exposed via NEW `@legendary-arena/registry/theme.schema` subpath (A-083-04 addition).
- **LOCKED** `RegistryConfigSchema` (byte-for-byte preserved; only adjacent comment updated).
- **UNTOUCHED** theme schemas in `theme.schema.ts` (D-5504 / D-5509 / EC-055 locks); `theme.validate.ts` (empty `git diff` post-execution).

### 3.2 Import paths locked by A-083-04

- `registryClient.ts` — exactly one new import:
  ```ts
  import { ViewerConfigSchema, type ViewerConfig } from "@legendary-arena/registry/schema";
  ```
- `themeClient.ts` — exactly two new imports (split across subpaths):
  ```ts
  import { ThemeIndexSchema } from "@legendary-arena/registry/schema";
  import { ThemeDefinitionSchema, type ThemeDefinition } from "@legendary-arena/registry/theme.schema";
  ```
- **Barrel imports forbidden** in both files (Verification Step 7.3 enforces via grep). Barrel would pull Node-only `createRegistryFromLocalFiles` into the Rollup graph and break the viewer's production build per the EC-107 / `glossaryClient.ts:20–28` precedent.

### 3.3 Error rendering locked

All validation-failure messages emit exactly:
- `issue.path.join(".")` (or `"root"` if the path is empty), AND
- `issue.message`

from the **first** Zod issue only. Message prefix is `[RegistryConfig] Rejected <file> from <URL>: <path> — <message>. Viewer cannot boot with an invalid config; fix the file and redeploy.` (or `[Themes] Rejected ...` for theme paths). `.format()` dumps and multi-issue arrays are forbidden.

### 3.4 Severity policy locked (D-083C)

- **Throw** for hard dependencies: viewer config + theme index.
- **Warn + skip** for batch entries: individual theme files (preserves `Promise.allSettled` + null-filter tail).

---

## 4. Commit Topology

| Commit | Type | Prefix | Files |
|---|---|---|---|
| A0 | SPEC | `SPEC:` | WP-083 + EC-108 + WORK_INDEX row + EC_INDEX row + session-context + pre-flight (v2 CONFIRM block) + copilot-check (v2 CONFIRM block) + session prompt |
| A | Execution | `EC-108:` | `schema.ts` + `index.ts` + `packages/registry/package.json` (A-083-04) + `registryClient.ts` + `themeClient.ts` + `apps/registry-viewer/CLAUDE.md` (+ optional `docs/03.1-DATA-SOURCES.md` + optional `packages/registry/src/schema.test.ts`) |
| B | Governance close | `SPEC:` | WORK_INDEX flip `[ ]` → `[x]` + EC_INDEX flip Draft → Done + DECISIONS.md (D-083A..E) + STATUS.md (if applicable) |

`WP-083:` commit prefix is forbidden per P6-36; the `.githooks/commit-msg` hook rejects it. Subject must be ≥ 12 chars after prefix and must not contain `WIP` / `misc` / `tmp` / `updates` / `changes` / `debug` / `fix stuff`.

---

## 5. Governance Entries (Commit B)

Five entries land at governance close. Final numeric IDs allocated at Commit B time; placeholders `D-083A..E` used in WP/EC text.

1. **D-083A** — Viewer fetches validate at the boundary.
2. **D-083B** — `ViewerConfigSchema` is distinct from `RegistryConfigSchema`.
3. **D-083C** — Validation severity policy by dependency type (throw vs warn+skip).
4. **D-083D** — Auxiliary metadata schemas remain offline-only.
5. **D-083E** — Theme-schema subpath export for browser-safe viewer imports (introduced by A-083-04). Locks the `./theme.schema` subpath export in `packages/registry/package.json` as a reusable retrofit precedent alongside D-083A–D-083D and the A-082-01 `./schema` precedent.

---

## 6. Architectural Patterns & Invariants

- **Layer boundary:** WP-083 is strictly Registry + Registry-Viewer. Zero imports of `packages/game-engine/`, `packages/preplan/`, `apps/server/`, `pg`, or `boardgame.io`. Verification Step 17 enforces via grep (P6-22 escaped-dot pattern).
- **01.5 runtime-wiring allowance:** NOT INVOKED. Four criteria enumerated and all absent: no `LegendaryGameState` field, no `buildInitialGameState` change, no `LegendaryGame.moves` entry, no phase hook.
- **01.6 post-mortem:** NOT TRIGGERED. New schemas are instances of the existing abstraction (Zod schemas in the registry package — `SetIndexEntrySchema`, `HeroCardSchema`, `ThemeDefinitionSchema`, `KeywordGlossarySchema`, etc.); `./theme.schema` subpath is a new instance of the A-082-01 `./schema` abstraction; no new code category; zero engine touch.
- **Paraphrase discipline (P6-50):** JSDoc and `// why:` text in all changed files must not reference `G`, `LegendaryGameState`, `LegendaryGame`, `boardgame.io`, `ctx.random`, or engine move names. Verification Step 20 enforces.
- **`.reduce()` ban:** zero `.reduce(` in any changed file (code-style invariant). Verification Step 19 enforces.

---

## 7. Known Pre-Existing Issues (NOT addressed by WP-083)

These are flagged for awareness only — the executor must NOT attempt to fix them during WP-083:

- **`apps/registry-viewer/` category classification gap** — not listed in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §Category Summary (lines 36–49). `client-app` row covers `apps/arena-client/` only; `cli-producer-app` covers `apps/replay-producer/` only. WP-060/EC-106 and WP-082/EC-107 both modified the viewer without this being flagged as blocking — precedent is that the viewer is implicitly a client-category cousin. A separate docs-housekeeping WP should add a `registry-viewer-app` row (D-6511 analog); forcing into WP-083 scope would be scope creep.
- **Viewer's local `apps/registry-viewer/src/registry/` duplicate** — contains its own `schema.ts`, `shared.ts`, `types/`, `browser.ts` that duplicate parts of the `@legendary-arena/registry` package surface. Known architectural smell. Deduplicating is a separate architectural concern; out of scope for WP-083.
- **`docs/03.1-DATA-SOURCES.md` does not list viewer public config or themes as source rows** — WP-083 §F grants permission to skip if doc structure doesn't support it. Soft gap; not blocking.

---

## 8. Execution Read Order

On entering the fresh execution session:

1. Read `.claude/CLAUDE.md` — EC-mode + lint gate rules.
2. Read this file (session-context-wp083.md) — full context.
3. Read `docs/ai/execution-checklists/EC-108-fetch-time-schema-validation.checklist.md` — authoritative contract.
4. Read `docs/ai/work-packets/WP-083-fetch-time-schema-validation.md` — design intent (subordinate to EC-108).
5. Read `docs/ai/invocations/preflight-wp083.md` — pre-flight v2 verdict and PS-1/2/3 resolution log.
6. Read `docs/ai/invocations/copilot-check-wp083.md` — copilot-check v2 CONFIRM disposition.
7. Read `docs/ai/invocations/session-wp083-fetch-time-schema-validation.md` — the actual execution prompt.
8. Cut a fresh branch from `main` (per §2.1).
9. Run `pnpm -r build` and `pnpm -r --if-present test` to confirm baseline.
10. Execute §Scope (In) §A → §G in order; commit A; run verification steps; commit B.

If at any point the executor finds a conflict between EC-108 and WP-083 on **execution contract** (locked values, guardrails, staging discipline), EC-108 wins. On **design intent**, WP-083 wins. Higher-level documents (`.claude/CLAUDE.md`, `docs/ai/ARCHITECTURE.md`) override both.

---

## 9. Amendments Record

| Amendment | Date | Purpose |
|---|---|---|
| A-083-01 | 2026-04-21 | Drop theme-schema redefinition from §A (theme schemas already exist) |
| A-083-02 | 2026-04-21 | Scope `.strict()` to new object schemas only |
| A-083-03 | 2026-04-21 | Supersede `themeSchemaVersion` range-validation note (D-5504 already locks `z.literal(2)`) |
| A-083-04 | 2026-04-21 | Add `./theme.schema` subpath export to `packages/registry/package.json`; lock exact import lines for both retrofitted clients; add Verification Step 7.1 (`themeSchemaVersion` grep-gate) + 7.2 / 7.3 (subpath + barrel audit); add D-083E governance entry |

All four amendments land at Commit A0 SPEC before any Commit A edit.

---

## 10. End State

At WP-083 close (Commit B):

- `packages/registry/src/schema.ts` exports 2 new schemas + 2 new types.
- `packages/registry/src/index.ts` re-exports them via the existing general-schema block.
- `packages/registry/package.json` `exports` field has 3 subpath entries (`.`, `./schema`, `./theme.schema`).
- `apps/registry-viewer/src/lib/registryClient.ts` and `src/lib/themeClient.ts` validate at fetch boundary.
- `apps/registry-viewer/CLAUDE.md` documents the retrofit.
- `docs/ai/DECISIONS.md` has D-083A..E.
- `docs/ai/work-packets/WORK_INDEX.md` has WP-083 `[x]`.
- `docs/ai/execution-checklists/EC_INDEX.md` has EC-108 Done.
- Test baseline **596 / 0** preserved (or **601 / 0** if optional schema-parse tests authored).
- Viewer browser build exits 0 with no `__vite-browser-external` warnings.

Four R2 fetchers (registry config, themes, keywords, rules) all validate at the fetch boundary. WP-083's mandate is complete.
