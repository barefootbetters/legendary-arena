# Pre-Flight — WP-037 Public Beta Strategy

**Target Work Packet:** `WP-037`
**Title:** Public Beta Strategy
**Previous WP Status:** WP-036 Complete (2026-04-21, `04c53c0`)
**Pre-Flight Date:** 2026-04-22
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Repo-state anchor:** `main @ f739d7c` (pre-flight opened against this head; PS-1 landed at `a4f5574` on top before session prompt was generated)

**Work Packet Class:** Contract-Only

Rationale: WP-037 introduces pure type declarations (`BetaFeedback`,
`BetaCohort`, `FeedbackCategory`) and two strategy documents. It does
not mutate `G`, does not wire into `game.ts`, does not add moves or
phase hooks, does not add fields to `LegendaryGameState`, does not
change `buildInitialGameState` shape, and ships zero new tests. Beta
types are metadata-only and must never enter runtime state. The class
matches the WP-035 (ops types) and WP-030 (campaign types) precedents.

Mandatory sections per class: Dependency & Sequencing Check, Input
Data Traceability, Structural Readiness, Scope Lock, Test
Expectations, Risk Review. Skipped: Runtime Readiness, Mutation
Boundary. Included lightly (good practice for Contract-Only adding a
new directory + long-lived contract type): Dependency Contract
Verification, Code Category Boundary Check, Maintainability & Upgrade
Readiness, Invocation Prompt Conformance Check.

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-037.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

Verdict is binary (READY / NOT READY). If conditional on pre-session
actions, the actions are listed explicitly and must be resolved before
a session execution prompt is generated.

---

## Authority Chain (Read in Order)

1. `.claude/CLAUDE.md` — EC-mode, lint gate, commit discipline — read.
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary (Authoritative),
   "MVP Gameplay Invariants" (confirmed at line 1277) — read.
3. `docs/03.1-DATA-SOURCES.md` — N/A: WP-037 consumes no input
   datasets; no registry, R2, or DB reads.
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — **BLOCKING at pre-flight
   open: `packages/game-engine/src/beta/` not listed.** See PS-1 below.
   Resolved at `a4f5574`.
5. `docs/ai/execution-checklists/EC-037-beta-strategy.checklist.md` —
   read. Locked values copied verbatim from WP-037 §Locked contract
   values.
6. `docs/ai/work-packets/WP-037-public-beta-strategy.md` — read.
   §Scope (In) specifies 2 new docs + 1 new type file + 2 modified
   re-exports. WORK_INDEX notes this WP "was truncated at 114 lines —
   normalized to full PACKET-TEMPLATE" (verified no residual drift).
7. `docs/ai/session-context/session-context-wp037.md` — **absent.**
   WP-036 step 8 did not emit a session-context bridge for WP-037.
   Context is carried by this pre-flight, the session prompt, the
   WORK_INDEX WP-036 close-row, and `session-context-wp036.md` (if
   re-read). Workflow gap noted; non-blocking for Contract-Only scope.

Higher-authority documents win where they conflict with lower. No such
conflicts were found with CLAUDE.md, ARCHITECTURE.md, or
`.claude/rules/` during this pre-flight; one PS-item (directory
classification) was listed and resolved before session prompt
generation.

---

## Dependency & Sequencing Check

| WP | Status | Evidence |
|---|---|---|
| WP-036 (declared direct dep) | **PASS** | `[x]` in WORK_INDEX line 1278, commit `04c53c0`, 2026-04-21 — AI playtesting & balance simulation closed |
| WP-035 (transitive, cited in Assumes) | **PASS** | `[x]` commit `d5935b5`, 2026-04-19 — release / deployment / ops playbook |
| WP-034 (transitive, cited in Assumes) | **PASS** | `[x]` commit `5139817`, 2026-04-19 — versioning & save migration |
| WP-032 (transitive, cited in Session Context) | **PASS** | WP-036 cites completion; `src/network/` + `ClientTurnIntent` present |
| WP-027 (transitive, replay harness cited in Assumes) | **PASS** | `src/replay/` exists; D-2706 classification; referenced by `BetaFeedback.reproductionReplayId` |
| WP-028 (transitive, UIState cited in Assumes) | **PASS** | `src/ui/` exists; D-2801 classification |
| WP-029 (transitive, audience-filtered views cited in Assumes) | **PASS** | `filterUIStateForAudience` in `src/ui/uiState.filter.ts` |

All upstream dependencies complete. Sequencing correct per WORK_INDEX
dependency chain `WP-036 → WP-037 → WP-038 → WP-039 → WP-040` (line
1506).

**Foundation Prompts** (FP-00.4 → 00.5 → 01 → 02): assumed complete;
WP-037 does not touch infrastructure that an FP established (no
database schema changes, no R2 data changes, no new environment
variables, no server wiring).

**Rule:** If any prerequisite WP is incomplete, pre-flight is NOT
READY. All prerequisites are complete.

---

## Dependency Contract Verification (light pass for Contract-Only)

Verified against actual source files, not WP text alone.

- [x] **Type/field names match exactly** — `BetaFeedback`, `BetaCohort`,
  `FeedbackCategory` are NEW types introduced by this WP; no prior
  contracts are consumed. WP text and EC text copy the same shapes
  verbatim (verified line-by-line against EC-037 §Locked Values).
- [x] **Function signatures compatible** — N/A (no helpers introduced).
- [x] **Move classification correct** — N/A (no moves introduced).
- [x] **Field paths in `G` verified** — `LegendaryGameState` is NOT
  modified. Confirmed no `BetaFeedback` / `BetaCohort` /
  `FeedbackCategory` reference anywhere under
  `packages/game-engine/src/` at pre-flight open (Grep returned zero
  matches).
- [x] **Helper return patterns understood** — N/A (no helpers).
- [x] **Optional fields identified** — `BetaFeedback.reproductionReplayId`
  is the sole optional field (`?:` syntax); future consumers must
  handle `undefined` explicitly under `exactOptionalPropertyTypes:
  true`. WP-029 `preserveHandCards` conditional-assignment pattern
  applies if a consumer builds the object incrementally; WP-037
  itself defines the type only, so this concern is deferred.
- [x] **Data source identity verified** — N/A (no file / R2 / DB
  loads).
- [x] **TypeScript types accommodate real data quirks** — N/A
  (no registry consumption).
- [x] **Schema-engine alignment verified** — N/A (no JSON schema).
- [x] **Handler ownership explicit** — No handlers introduced. D-3701
  sub-rule explicitly states "no constants, no functions, no
  module-level state" in `beta.types.ts`; runtime construction +
  transport + persistence live in `apps/server/` or future ops
  tooling.
- [x] **Persistence classification clear** — Beta types are
  **metadata** (transport data between clients and server feedback
  collection), NEVER runtime state in `G`, NEVER snapshot content.
  ARCHITECTURE.md §Section 3 three-data-classes taxonomy: beta
  types do not fit any of the three classes because they are not
  consumed by the engine — they are a contract for external
  tooling. D-3701 documents this explicitly.
- [x] **WP scope pre-validated against ARCHITECTURE.md** — No
  conflicts. `LegendaryGameState` 9-field lock is preserved. Layer
  Boundary (server owns feedback collection; engine is unaware)
  respected.
- [x] **Framework API workarounds documented** — N/A (no framework
  API use).
- [x] **New types defined in dedicated contract files** — `beta.types.ts`
  is a dedicated `*.types.ts` file per D-1216 convention (matches
  WP-035 `ops.types.ts` and WP-036 `ai.types.ts` precedents).
- [x] **Immutable file designations respected** — No immutable files
  (`schema.ts`, `shared.ts`, `localRegistry.ts`) modified.
- [x] **Cross-service identifiers use ext_id strings** — N/A
  (`sessionId` and `buildVersion` are opaque server-side identifiers,
  not card / entity references crossing package or storage
  boundaries).
- [x] **Locked value string literals match actual code** — N/A
  (no existing code to match — WP-037 introduces the strings). WP
  text and EC text match verbatim; session prompt copies them again
  verbatim.
- [x] **Runtime data availability verified for all evaluators** — N/A
  (no evaluators).
- [x] **Setup-time data source verified for all extractors** — N/A
  (no setup-time functions).
- [x] **WP function signatures match established conventions** — N/A
  (no functions).
- [x] **WP file paths verified against actual filesystem** —
  `packages/game-engine/src/types.ts` and
  `packages/game-engine/src/index.ts` both exist (confirmed via
  Glob). `packages/game-engine/src/beta/` does not exist — will be
  created. `docs/beta/` does not exist — will be created. No
  collision with existing paths (`docs/ops/`, `docs/ai/`,
  `docs/screenshots/`, `docs/devlog/`).
- [x] **WP file paths verified against code category rules** —
  `packages/game-engine/src/beta/` requires a code-category
  classification before execution. See PS-1 below (resolved).
- [x] **WP gating assumptions verified as true** — All six §Assumes
  bullets from WP-037 verified against the repo at pre-flight open:
  WP-036 complete (✓ `04c53c0`); release process exists (✓ WP-035
  `d5935b5`); AI simulation framework exists (✓ `src/simulation/`);
  authoritative network model exists (✓ `src/network/`); versioning
  exists (✓ `src/versioning/`); replay verification harness exists
  (✓ `src/replay/`); UIState + audience-filtered views exist
  (✓ `src/ui/`); `pnpm --filter @legendary-arena/game-engine build`
  exits 0 (✓); `pnpm --filter @legendary-arena/game-engine test`
  exits 0 (✓ 444 / 110 / 0 fail at pre-flight); ARCHITECTURE.md
  exists with "MVP Gameplay Invariants" (✓ line 1277);
  DECISIONS.md exists (✓).
- [x] **Decision IDs not referenced before creation** — D-0702,
  D-0902, D-1232, D-3501, D-3601 all exist in DECISIONS.md (verified
  with both regular-hyphen and em-dash Grep per WP-028 P6-2
  precedent; matches found for `D‑0702` at line 285, `D‑0902` at
  line 336, `D-3501` at line 5341, `D-3601` at line 6335). D-3701
  was created and landed at `a4f5574` before session prompt
  generation (see PS-1 resolution).
- [x] **Decision ID search accounts for character encoding** —
  Verified via grep for both `D-` (hyphen) and `D‑` (em-dash)
  forms per WP-028 P6-2 precedent.
- [x] **Projection aliasing verified** — N/A (no projection
  functions introduced).
- [x] **Functions the WP calls are actually exported** — N/A
  (no function calls).
- [x] **WP approach does not require forbidden imports** — Verified.
  Beta types require NO boardgame.io import, NO registry import, NO
  server import, NO cross-subdirectory engine import. Pure
  type-level declarations. Mirrors D-3501 ops-types pattern and
  D-3601 simulation-types pattern.
- [x] **Filter/consumer input type contains all needed data** — N/A
  (no filter or consumer function).

**Conclusion:** no contract-drift or path-verification issues.
Dependency contract verification passes. The only structural
finding is the unclassified directory, handled as PS-1.

---

## Input Data Traceability Check

- [x] All non-user-generated inputs consumed by this WP are listed in
  `docs/03.1-DATA-SOURCES.md` — **YES** (WP-037 consumes no external
  datasets; trivially satisfies the requirement).
- [x] The storage location for each input is known — **YES** (no
  inputs).
- [x] It is possible to determine which data source(s) would need to
  be inspected if this WP's behavior is incorrect — **YES** (no
  runtime behavior; type definitions are reviewed against
  `beta.types.ts` directly).
- [x] The WP does not introduce "implicit data" (hardcoded literals
  that actually originate from external datasets) — **YES** (the
  literal unions `BetaCohort` and `FeedbackCategory` are governance
  decisions, not dataset extracts).
- [x] Any setup-time derived fields introduced or modified by this
  WP are listed under **Setup-Time Derived Data (In-Memory)** in
  `docs/03.1-DATA-SOURCES.md` — **YES** trivially (no setup-time
  derived fields introduced; WP-037 is pure type declarations).

**No NO answers.** Traceability OK.

---

## Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — engine `444 / 110 / 0
  fail` at pre-flight; repo-wide `596 / 0 fail` (verified via
  `pnpm --filter @legendary-arena/game-engine test` and `pnpm -r
  test`).
- [x] No known EC violations remain open.
- [x] Required types/contracts exist and are exported as referenced
  by WP-037 — `BetaFeedback`, `BetaCohort`, `FeedbackCategory` are
  all **new** types introduced by this WP; no prior contracts are
  consumed. Confirmed via Grep that these identifiers do not appear
  anywhere under `packages/game-engine/src/` at pre-flight open.
- [x] No naming or ownership conflicts (no duplicate "engine-wide"
  types) — verified.
- [x] No architectural boundary conflicts anticipated at the contract
  level — types are pure data shapes with no imports.
- [x] If the WP touches database schemas or migrations: N/A.
- [x] If the WP depends on R2 data: N/A.
- [x] If the WP reads data from G fields: N/A (no G reads).

**No NO answers.** Structural Readiness OK.

---

## Code Category Boundary Check

- [x] All new or modified files fall cleanly into one existing code
  category — `beta.types.ts` under `packages/game-engine/src/beta/`
  is engine-category per D-3701 (landed at `a4f5574`). `types.ts`
  and `index.ts` are already engine-category. `docs/beta/*.md` are
  non-engine documentation (no category classification required —
  precedent: `docs/ops/`, `docs/ai/`, `docs/screenshots/`).
- [x] Each file's category permits all imports and mutations it
  uses — verified.
- [x] No file blurs category boundaries — verified.
- [ ] **AT PRE-FLIGHT OPEN:** `packages/game-engine/src/beta/` was
  NOT listed in `02-CODE-CATEGORIES.md`. This was the blocking
  finding resolved as **PS-1** below.

**PS-1 (RESOLVED at `a4f5574`).** `packages/game-engine/src/beta/`
required a code-category classification decision before execution.
Resolution: new `D-3701 — Beta Types Code Category` entry added to
`docs/ai/DECISIONS.md` at line 6634, following the D-3601 template
verbatim (section-for-section). `02-CODE-CATEGORIES.md` line 104
updated to list `packages/game-engine/src/beta/` under the engine
category with `(D-3701)` citation. Tenth instance of the
D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 / D-3401 /
D-3501 / D-3601 chain. Commit: `a4f5574` (2026-04-22)
`SPEC: WP-037 PS-1 — D-3701 beta code category + 02-CODE-CATEGORIES
update`. Status: Immutable.

---

## Scope Lock

### WP-037 Is Allowed To

- Create: `docs/beta/BETA_STRATEGY.md` — new strategy doc
  (objectives, cohorts, access, feedback, phases, exit criteria)
- Create: `docs/beta/BETA_EXIT_CRITERIA.md` — new binary pass/fail
  criteria per category
- Create: `packages/game-engine/src/beta/beta.types.ts` — new pure
  type file with `BetaFeedback` interface, `BetaCohort` union,
  `FeedbackCategory` union. Requires `// why:` comment per EC-037
  line 65 covering traceability + reproduction rationale.
- Modify: `packages/game-engine/src/types.ts` — re-export beta types
  only
- Modify: `packages/game-engine/src/index.ts` — public API export of
  beta types only
- Update: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (three new
  minor decisions per DoD: invitation-only signal quality,
  three-cohort signal targets, same release gates as production),
  `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`

### WP-037 Is Explicitly Not Allowed To

- Modify any engine gameplay file: `game.ts`, `moves/**`, `rules/**`,
  `setup/**`, `turn/**`, `state/**`, `ui/**`, `scoring/**`,
  `endgame/**`, `villainDeck/**`, `board/**`, `hero/**`, `economy/**`,
  `mastermind/**`, `persistence/**`, `lobby/**`, `replay/**`,
  `simulation/**`, `campaign/**`, `invariants/**`, `network/**`,
  `versioning/**`, `ops/**`, `content/**`, `schemeMap/**`
- Add any field to `LegendaryGameState` or any G shape
- Introduce `boardgame.io` imports anywhere under `src/beta/`
- Introduce `@legendary-arena/registry` imports anywhere under
  `src/beta/`
- Use `require()` anywhere (ESM only)
- Introduce any runtime logic, function, or side-effect under
  `src/beta/` — this WP produces **type declarations and re-exports
  only**
- Introduce a "beta mode" branch anywhere in the engine
- Introduce persistence of `BetaFeedback` to `G` (metadata only —
  collection is a server/ops concern per WP-037 Out of Scope)
- Touch non-allowlisted files, `package.json`, or `pnpm-lock.yaml`
- Add or modify any test file (see Test Expectations below)

**Rule:** Anything not explicitly allowed is out of scope.

---

## Test Expectations (Locked Before Execution)

**Gap in WP/EC:** Neither WP-037 nor EC-037 explicitly states the
test expectation. Locked here in pre-flight:

- **New tests:** 0 — this WP produces pure type declarations and
  documentation. Type soundness is validated by
  `pnpm --filter @legendary-arena/game-engine build` exiting 0.
- **Existing test changes:** 0 — no existing test assertions change.
- **Prior test baseline:** engine `444 / 110 / 0` (WP-036 close
  baseline confirmed at pre-flight), repo-wide `596 / 0`. All must
  continue to pass post-execution.
- **Test boundaries:** no new `.test.ts` files; no test helper
  modifications; no `boardgame.io/testing` imports; no
  `makeMockCtx` changes.
- **Defensive guards:** N/A (types are additive; no runtime path
  exercises them).

**Rationale for 0-test verdict:** Contract-Only WPs whose only
deliverables are JSON-serializable type declarations + docs have
historically not added tests (the type system is the contract, and
build-exit-0 is the gate). Behavior coverage would require a
server/ops harness that is explicitly Out of Scope. Matches WP-035
RS-2 precedent exactly.

---

## Maintainability & Upgrade Readiness (light pass)

- [x] **Extension seam exists:** `FeedbackCategory` and `BetaCohort`
  are closed unions, extendable by future WPs via a new D-entry +
  coordinated doc update. `severity: 1 | 2 | 3` can widen
  identically. D-3701 Implications section explicitly documents the
  extension contract.
- [x] **Patch locality:** any correction to feedback shape or cohort
  definitions is localized to `beta.types.ts` plus re-exports in
  `types.ts` / `index.ts` — 3 files, mechanical.
- [x] **Fail-safe behavior:** types are metadata; no runtime
  evaluator to fail.
- [x] **Deterministic reconstructability:** N/A (no state mutation;
  JSON-serializable values are trivially reconstructable).
- [x] **Backward-compatible test surface:** additive types only; no
  existing mock state needs to change.
- [x] **Semantic naming stability:** `BetaFeedback`, `BetaCohort`,
  `FeedbackCategory` are semantically stable; no `Simple`, `Temp`,
  `V1` encoding. The `'beta'`-prefixed symbol names correctly
  encode the metadata-not-state boundary.

All pass.

---

## Risk & Ambiguity Review

| # | Risk | Impact | Mitigation | Decision / Pattern |
|---|------|--------|------------|--------------------|
| RS-1 | `src/beta/` directory unclassified (no `02-CODE-CATEGORIES.md` entry, no D-3701) | HIGH (blocks execution per 01.4 precedent: WP-030/031/033/034/035/036 all resolved this as PS-# before session prompt) | Create D-3701 + update `02-CODE-CATEGORIES.md` in a pre-session SPEC commit, following the D-3601 template exactly | **LOCKED + RESOLVED:** PS-1 applied at `a4f5574` (2026-04-22). Tenth instance of the D-2706/D-2801/D-3001/D-3101/D-3201/D-3301/D-3401/D-3501/D-3601 chain. |
| RS-2 | WP / EC do not explicitly lock test expectations (0 new tests, baseline `444/110/0` must hold) | MEDIUM (past WPs have drifted when test count wasn't locked — P6-19, P6-25, WP-031 precedent) | Lock test expectations here in pre-flight; session prompt must include the explicit 0-new-tests lock and the 444/110/0 baseline | **LOCKED:** session prompt includes explicit "0 new tests; engine baseline 444/110/0; repo-wide 596/0" and forbids any `.test.ts` additions under `src/beta/`. Verification Steps #2, #3, #16 enforce. |
| RS-3 | WP verification Step 4 grep covers only `game.ts`, `moves/`, `rules/` — narrower than WP-036's 10-directory engine-isolation check | MEDIUM (allows drift into `setup/`, `turn/`, `ui/`, etc.) | Session prompt must expand the engine-isolation grep to cover all existing engine subdirectories (23 directories + `game.ts` + `matchSetup.*`), matching WP-036's P6-44 precedent, and additionally explicitly exclude `package.json` / `pnpm-lock.yaml` | **LOCKED:** session prompt Verification Step 10 expands the grep; does not modify the WP text. A one-line WP back-sync note may be added during post-mortem (non-blocking nit). |
| RS-4 | WP-037 Non-Negotiable Constraints section does not declare "01.5 NOT INVOKED" explicitly | MEDIUM (WP-030 precedent established that purely-additive Contract-Only WPs must declare 01.5 NOT INVOKED in session prompt to prevent retroactive citation) | Session prompt must include the explicit "01.5 NOT INVOKED — four criteria all absent: no `LegendaryGameState` field added, no `buildInitialGameState` shape change, no new `LegendaryGame.moves` entry, no new phase hook" block | **LOCKED:** session prompt §"Runtime Wiring Allowance (01.5) — NOT INVOKED" includes the 4-criterion table + Escalation citation per WP-030 / WP-035 / WP-036 precedent. |
| RS-5 | EC-037 cohort bullets use `--` separator but WP-037 cohort bullets use em-dash-like style (narrative mismatch, not type mismatch) | LOW (cosmetic; not a type-literal drift) | No action — cohort strings enter types as `'expert-tabletop' \| 'general-strategy' \| 'passive-observer'`; the narrative description mismatch does not affect code | **LOCKED:** no correction needed. |
| RS-6 | `BetaFeedback.severity: 1 \| 2 \| 3` is an unnamed numeric union; future mapping from severity to operations response is implicit | LOW | Acceptable for metadata; a future WP may introduce `BetaSeverity` named type if needed. Do not introduce it now (scope creep). | **LOCKED:** keep inline numeric union; do not introduce `BetaSeverity`. |
| RS-7 | WP-037 Acceptance Criteria item "No `require()` in any generated file" is checked with `Select-String -Path … -Pattern "require("`. The `(` is regex-special in Select-String default behavior; PowerShell handles it as literal in `-SimpleMatch` mode only | LOW (may produce false-negative in the binary gate) | Session prompt should use `-SimpleMatch` or escape: `Select-String -Path "packages\game-engine\src\beta" -SimpleMatch -Pattern "require("`. This follows WP-031 / WP-033 P6-22 audit-grep-escaping precedent | **LOCKED:** session prompt Verification Step 9 uses `-SimpleMatch` for require() grep to avoid false-negative in the binary gate. |
| RS-8 | WP-037 Session Context claims "no engine modifications" but the WP does modify `src/types.ts` and `src/index.ts`. These are re-export-only edits — not gameplay logic — and match the WP-034/035/036 precedent for public-API surface | LOW (wording, not substance) | No correction needed — re-export additions are routine and WP-036 did the same | **LOCKED:** no action. |
| RS-9 | WP-037 was recently "normalized from 114-line truncation to full PACKET-TEMPLATE" per WORK_INDEX notes. Possible residual drift from normalization | MEDIUM (pCloud conflict / truncation risk per user memory `pcloud_conflicts`) | Spot-check: line counts match (WP 308 lines, EC 87 lines), locked values identical in both, no `[conflicted N]` files found under `docs/ai/work-packets/` | **LOCKED:** no residual drift detected. |
| RS-10 | WP-036 step 8 did not emit `session-context-wp037.md` — workflow gap | LOW (context is carried by pre-flight + session prompt + WORK_INDEX WP-036 row) | No action required for this WP; flag as a lessons-learned item for future step-8 discipline | **LOCKED:** noted in session prompt header; non-blocking. |

**All risks resolved or locked.** No ambiguities remain for the
session prompt to interpret.

---

## Pre-Flight Verdict

**READY TO EXECUTE** (conditional at pre-flight open; unconditional
after PS-1 resolution)

**Justification:** WP-036 is complete at `04c53c0` with engine
baseline `444/110/0`. The WP's own scope — beta strategy docs plus
three JSON-serializable type declarations re-exported from
`types.ts` / `index.ts` — is a clean Contract-Only deliverable that
adds no runtime fields, no moves, no phases, and no G mutation.
Dependency chain (WP-032 → WP-033 → WP-034 → WP-035 → WP-036) is
fully green, transitive assumptions hold, and all referenced
authority documents exist (D-0702, D-0902, D-1232, D-3501, D-3601,
"MVP Gameplay Invariants" section, `RELEASE_CHECKLIST.md`). The
locked-value table in EC-037 matches WP-037 verbatim for the three
type shapes. Engine isolation is achievable via an expanded
git-diff grep (RS-3), 01.5-NOT-INVOKED declaration (RS-4), and a
tightened `require()` gate (RS-7), all handled in the session
prompt without changing WP/EC scope.

**Conditional pre-session actions (PS-#) required before session
prompt generation:**

- **PS-1 (RESOLVED at `a4f5574`, 2026-04-22):** Create
  `D-3701 — Beta Types Code Category` in `docs/ai/DECISIONS.md`
  and update `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` to list
  `packages/game-engine/src/beta/` under the engine category.
  Followed the D-3601 template verbatim (section-for-section).
  Status: Immutable. Heading: `### D-3701`. Tenth instance of the
  established pattern (D-2706/D-2801/D-3001/D-3101/D-3201/D-3301/
  D-3401/D-3501/D-3601). Committed under `SPEC:` prefix directly
  to `main`, consistent with recent SPEC-commit history
  (`915a2ca`, `62b68d1`, `d4877ef`).

PS-1 is a scope-neutral classification decision that resolves a
risk identified here without changing WP/EC scope. **No re-run of
pre-flight required.**

---

## Invocation Prompt Conformance Check (Pre-Generation)

Per 01.4 §Invocation Prompt Conformance Check, verified against the
session prompt draft prior to generation:

- [x] All EC-037 Locked Values copied verbatim into the invocation
  prompt (`BetaFeedback` interface, `BetaCohort` union,
  `FeedbackCategory` union, three-cohort narrative, four exit-criteria
  categories).
- [x] No new keywords, helpers, file paths, or timing rules appear
  only in the prompt — all contract elements originate in WP-037
  or EC-037.
- [x] File paths, extensions, and test locations match the WP
  exactly — five allowlisted files match WP §Files Expected to
  Change.
- [x] No forbidden imports or behaviors introduced by wording
  changes — no `boardgame.io` / registry / apps imports under
  `src/beta/`; same pattern as D-3701.
- [x] The prompt does not resolve ambiguities that were not resolved
  in this pre-flight — all RS-# locks originate here.
- [x] Contract names and field names in the prompt match the
  verified dependency code — types are new; re-export target paths
  (`types.ts`, `index.ts`) verified via Glob.
- [x] Helper call patterns in the prompt reflect actual signatures —
  N/A (WP-037 introduces zero helpers).

**Rule satisfied:** The invocation prompt is strictly a transcription
+ ordering artifact. No interpretation required.

---

## Authorized Next Step

**Pre-session actions — ALL RESOLVED (2026-04-22):**

1. Created `### D-3701 — Beta Types Code Category` in
   `docs/ai/DECISIONS.md` at line 6634, following the D-3601 template
   verbatim (`**Decision:** / **Rationale:** / precedent bullet list
   / **Sub-rule** / **Implications** / **Alternatives rejected** /
   **Implementation locations** / **Affected WPs** / **Introduced** /
   **Status: Immutable** / **Raised** / **Resolved**`).
   Landed at commit `a4f5574`.
2. Added `packages/game-engine/src/beta/` to the engine category
   listing in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` at line 104,
   mirroring the `src/simulation/ (D-3601)` line format. Landed at
   commit `a4f5574`.

All mandatory pre-session actions are complete. No re-run of
pre-flight required — these updates resolve risks identified by this
pre-flight without changing scope.

> You are authorized to generate a **session execution prompt** for
> WP-037 to be saved as:
> `docs/ai/invocations/session-wp037-public-beta-strategy.md`

**Guard:** The session prompt **must conform exactly** to the scope,
constraints, and decisions locked by this pre-flight. No new scope
may be introduced. All RS-# locks (expanded engine-isolation grep,
01.5-not-invoked block, tightened require() gate, 0-new-tests +
444/110/0 baseline, `// why:` requirement, session-context-wp037.md
absence noted) must appear.

**Copilot check disposition (01.7):** **CONFIRM** — 30/30 issues
PASS, one FIX folded into Verification Steps for issue #11. Session
prompt generation authorized without HOLD or SUSPEND.

---

## Final Instruction

Pre-flight exists to **prevent premature execution and scope drift**.

This pre-flight verified WP-037 against ten active risk categories
(RS-1 through RS-10), resolved one blocking issue as PS-1 (D-3701
classification), confirmed ten locks, and authorized session prompt
generation. Execution may proceed in a fresh Claude Code session
under EC-mode.

If any state diverges at session open (baseline shift, unexpected
dirty-tree additions, missing D-3701 entry), STOP and escalate per
the session prompt's Pre-Session Gates.
