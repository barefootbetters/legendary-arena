# Session Prompt — WP-042 Deployment Checklists (Data, Database & Infrastructure)

**Work Packet:** [docs/ai/work-packets/WP-042-deployment-checklists.md](../work-packets/WP-042-deployment-checklists.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-042-deployment-checklists.checklist.md](../execution-checklists/EC-042-deployment-checklists.checklist.md)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp042.md](../session-context/session-context-wp042.md)
**Commit prefix:** `EC-042:` on every code- or doc-changing commit in the WP-042 allowlist; `SPEC:` on governance / doc-only commits outside the allowlist; `WP-042:` is **forbidden** (commit-msg hook rejects per P6-36).
**Pre-flight verdict:** READY TO EXECUTE — WP-035 dependency green at `d5935b5`; D-4201 (scope reduction) + WP-042 amendments + EC-042 amendments + this session prompt all landed in the Commit A0 SPEC pre-flight bundle; five blocking pre-flight items (PS-1 through PS-5) and three routine items (RS-1 through RS-3) all resolved in §Locked Values and §Non-Negotiable Constraints below.
**WP Class:** Documentation (no runtime code, no tests, no mutations). Closest to Contract-Only in the 01.4 taxonomy; Copilot Check 01.7 is technically optional for this class but was run and is summarized below.
**Primary layer:** Server / Operations — ships two documentation files under `docs/ai/deployment/` + two back-pointer lines in `docs/ops/RELEASE_CHECKLIST.md` + one cross-reference line in `docs/ai/ARCHITECTURE.md`.

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-042:` on doc-changing commits inside the WP-042 allowlist; `SPEC:` on governance commits (STATUS.md / WORK_INDEX.md / EC_INDEX.md governance close). `WP-042:` is forbidden — the commit-msg hook rejects it per P6-36.

2. **Governance committed (P6-34).** Before the first checklist-file edit, run `git log --oneline -5` and confirm the SPEC pre-flight commit landed **D-4201** in `docs/ai/DECISIONS.md` + the D-4201 row in `docs/ai/DECISIONS_INDEX.md` + the WP-042 scope-reduction amendments + the EC-042 precondition amendments + this session prompt. If unlanded, STOP — execution is blocked on the scope-reduction governance.

3. **Upstream dependency green at session base commit.** Run `pnpm -r test`. Expect repo-wide **526 passing / 0 failing** (registry 3 + vue-sfc-loader 11 + game-engine 436 + server 6 + replay-producer 4 + arena-client 66). Engine baseline = **436 / 109 suites**. If the repo baseline diverges, STOP and reconcile against `WORK_INDEX.md` per the §"Verify First" discipline in the session-context bridge file. Specifically confirm WP-035 closed at `d5935b5` and all WP-035 follow-up SPECs (`546b784`, `a9f6c1a`, `913f0b3`) are present.

4. **Working-tree hygiene.** `git status --short` will show inherited dirty-tree files from prior sessions (M `session-wp079-...`; `??` `forensics-...`, `session-wp048-...`, `session-wp067-...`, `session-wp068-...`, `01.6-applyReplayStep.md`, `session-context-forensics-...`, `session-context-wp067.md`, `01.3-ec-mode-commit-checklist.oneliner.md`) AND ~70 additional theme JSON edits + `themeClient.ts` + `apps/registry-viewer/CLAUDE.md` edits from a separate in-flight session observed during WP-035 execution. **None of these are in WP-042 scope.** Retained stashes `stash@{0}` and `stash@{1}` are owned by the WP-068 / MOVE_LOG_FORMAT resolver — **do NOT pop**. The EC-069 `<pending — gatekeeper session>` placeholder in `EC_INDEX.md` is owned by a separate SPEC commit — **do NOT backfill here**. Stage by name only; never `git add .` or `git add -A` (P6-27 / P6-44 / P6-50 discipline).

5. **Code-category classification confirmed.** The WP-042 outputs live under:
   - `docs/ai/deployment/` — **new top-level `docs/ai/` subdirectory**. Accepted without a new D-entry per RS-4 precedent (precedent: `docs/ai/session-context/`, `docs/ai/invocations/`, `docs/ai/post-mortems/`, etc.). Non-engine, non-shipped documentation.
   - `docs/ops/RELEASE_CHECKLIST.md` — **modified** (two back-pointer lines). Existing file from WP-035.
   - `docs/ai/ARCHITECTURE.md` — **modified** (one cross-reference line). Existing.
   None of these are under `packages/game-engine/src/*/`; no new engine-subdirectory D-entry needed (the D-2706 through D-3501 pattern applies only to engine code).

If any gate is unresolved, STOP.

---

## Copilot Check (01.7) — COMPLETED, VERDICT: CONFIRM

Per [docs/ai/REFERENCE/01.7-copilot-check.md](../REFERENCE/01.7-copilot-check.md) §When Copilot Check Is Required + §Discipline. WP-042 is **Documentation class**, for which 01.7 is *recommended but optional*. It is included here explicitly because the WP is the first use of the P6-51 form (1) vs form (2) placement lock for a WP with multiple DoD DECISIONS.md rationales, and because the scope reduction (D-4201) is a significant structural decision that benefits from a second-opinion pass before execution.

The 30-issue scan was applied to the union of this session prompt + WP-042 (as amended) + EC-042 (as amended) + session-context-wp042 + D-4201 draft. Summary verdicts below; any non-`PASS` finding is accompanied by a `FIX` folded directly into this prompt's Locked Values / Non-Negotiable Constraints / Verification Steps.

**Category 1 — Separation of Concerns & Boundaries**

- **#1 Engine vs UI / App Boundary Drift — PASS.** WP-042 produces documentation only. §Guardrails explicitly forbids references to `packages/game-engine/` internals; verification greps enforce this.
- **#9 UI Re-implements Engine Logic — PASS.** No UI code in scope. Konva.js exclusion explicitly documented in the R2 and PostgreSQL checklists (D-4202 back-pointer).
- **#16 Lifecycle Wiring Creep — PASS.** No `game.ts` edit, no move, no phase hook. §Files Expected to Change allowlist forbids it. 01.5 NOT INVOKED (see §Runtime Wiring Allowance below).
- **#29 Assumptions Leaking Across Layers — PASS.** Deployment is a server/ops concern; WP-042 does not modify engine code, does not modify server code, does not consume engine runtime types.

**Category 2 — Determinism & Reproducibility**

- **#2 Non-Determinism Introduced by Convenience — PASS.** Pure documentation — no runtime code, no randomness possible. Grep verification forbids forbidden-token appearance in checklist prose (per P6-50 paraphrase discipline).
- **#8 No Single Debugging Truth Artifact — PASS.** Replay remains the canonical debugging artifact (WP-027 / D-2706); WP-042's checklists are deployment-verification artifacts, not runtime-debugging artifacts. Separate concerns; no competition.
- **#23 Lack of Deterministic Ordering Guarantees — PASS.** Migration execution order is locked by filename sort (§B.2). R2 validation phases are locked by §A.1 pipeline description.

**Category 3 — Immutability & Mutation Discipline**

- **#3 Pure vs Immer Confusion — PASS.** No runtime code. No G mutation.
- **#17 Hidden Mutation via Aliasing — PASS.** No runtime instance to alias.

**Category 4 — Type Safety & Contract Integrity**

- **#4 Contract Drift Between Types, Tests, and Runtime — PASS.** WP-042 doesn't introduce new types; it references existing ones (`DeploymentEnvironment` from WP-035, `IncidentSeverity` for failure handling prose). No drift possible.
- **#5 Optional Field Ambiguity — PASS.** No types introduced.
- **#6 Undefined Merge Semantics — PASS.** No config layering in scope.
- **#10 Stringly-Typed Outcomes — PASS.** Binary pass/fail outcomes explicitly required in WP-042 §Acceptance Criteria; no free-form result strings.
- **#21 Type Widening at Boundaries — PASS.** No types in scope.
- **#27 Weak Canonical Naming — PASS.** §Locked Values enumerates canonical names (`legendary.*` schema prefix; three migration filenames verbatim; six metadata files with exact entry counts). No drift — locked-vs-reality mismatch was the original blocker; D-4201 + PS-5 amendments reconciled both.

**Category 5 — Persistence & Serialization**

- **#7 Persisting Runtime State — PASS.** Checklists verify persistence of Class 2 Configuration data (card metadata, rules text) per D-0003. Class 1 Runtime (`G`) is out of scope.
- **#19 Weak JSON-Serializability — PASS.** No new data types.
- **#24 Mixed Persistence Concerns — PASS.** R2 checklist covers R2-stored data; PostgreSQL checklist covers PostgreSQL-stored data. No overlap.

**Category 6 — Testing & Invariant Enforcement**

- **#11 Tests Validate Behavior, Not Invariants — PASS with FIX.** WP-042 produces zero new tests (RS-2 lock). The existing 436 engine tests + 90 other-package tests must continue to pass unchanged. **FIX:** §Verification Steps explicitly asserts engine count **unchanged at 436 / 109 / 0 fail** and repo-wide **unchanged at 526 / 0 fail** as post-flight checks (catches any accidental code or test leak).

**Category 7 — Scope & Execution Governance**

- **#12 Scope Creep — PASS with FIX.** §Files Expected to Change is a strict four-file allowlist (2 new docs + 2 modifications). `git diff --name-only` is a required verification step. P6-27 is active. **FIX:** explicit forbidden-file list added (no new `.mjs`, no new `.ts`, no `package.json` edit, no `scripts/` additions — enforces D-4203 documentation-only invariant and prevents the temptation to "helpfully" create `seed-from-r2.mjs` in-scope).
- **#13 Unclassified Directories — PASS.** `docs/ai/deployment/` as a new top-level subdirectory is accepted without a D-entry per RS-4 precedent (matches `docs/ai/session-context/`, `docs/ai/invocations/`, etc.). D-4201 covers the scope-reduction governance; no further D-entries needed for structural classification.
- **#30 Missing Pre-Session Governance Fixes — PASS.** PS-1 through PS-5 all resolved in Commit A0 before this session opens. RS-1 through RS-3 resolved in this prompt's Locked Values.

**Category 8 — Extensibility & Future-Proofing**

- **#14 No Extension Seams — PASS.** The PostgreSQL checklist's "deferred sections" pointer is the explicit extension seam for WP-042.1; a future WP extends the checklist without refactoring its structure.
- **#28 No Upgrade or Deprecation Story — PASS.** Checklists are documentation; they do not carry data-shape versioning (D-0801 applies to persisted artifacts, not to governance docs). WP-042.1 will *extend* (not replace) WP-042's output.

**Category 9 — Documentation & Intent Clarity**

- **#15 Missing "Why" for Invariants — PASS.** Each §B.7 schema-verification item cites the migration that establishes the invariant. D-4201 carries the scope-reduction rationale. D-4202 and D-4203 (to be added during execution) carry the remaining DoD rationales per P6-51.
- **#20 Ambiguous Authority Chain — PASS.** §Authority Chain below lists the read order (CLAUDE.md > rules > ARCHITECTURE > DECISIONS > EC > WP > session-context > this prompt).
- **#26 Implicit Content Semantics — PASS.** Every checklist item has an explicit verification command or SQL query (§Acceptance Criteria "Every checklist item has a specific SQL query or CLI command" requirement).

**Category 10 — Error Handling & Failure Semantics**

- **#18 Outcome Evaluation Timing Ambiguity — PASS.** Pre-deployment checklist runs before promotion (`docs/ops/RELEASE_CHECKLIST.md` Gate 2 and Gate 3 invoke WP-042's checklists). No post-deployment concerns in WP-042 scope.
- **#22 Silent vs Loud Failure — PASS.** Binary pass/fail explicitly required in WP-042 §Acceptance Criteria. A failing checklist item blocks promotion loudly; there is no silent-degradation path in the checklist output (D-0802 alignment).

**Category 11 — Single Responsibility & Logic Clarity**

- **#25 Overloaded Function Responsibilities — PASS.** Each checklist section has a single responsibility. R2 checklist = R2 verification only; PostgreSQL checklist = PostgreSQL verification only; back-pointer additions = cross-reference only. No merged concerns.

**Overall Judgment:** **PASS** — 30 issues scanned, 30 PASS (with two FIXes folded into Verification Steps and §Files Expected to Change for #11 and #12). Pre-flight READY TO EXECUTE verdict stands. Session prompt generation is authorized.

**Disposition:** **CONFIRM** (not HOLD, not SUSPEND). No remediation blocks execution.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause + §Escalation. WP-042 is purely additive documentation work. Each of the four 01.5 trigger criteria is absent:

| 01.5 Trigger Criterion | Applies to WP-042? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | No types added; no code added. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | No setup orchestrator touched. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move added. Engine baseline **436 / 109 / 0 fail** must hold unchanged. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook added. |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock below applies without the allowance. Any file beyond the allowlist in §Files Expected to Change is a scope violation per **P6-27**, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/server.md](../../../.claude/rules/server.md) — server layer is wiring-only; deployment is an ops concern
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — naming discipline (no abbreviations; full-sentence error messages — none expected since no runtime code)
4. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Section 1 + §Section 2 + §Section 3 + §Layer Boundary (Authoritative) — deployment is server/ops; engine is never aware of deployment environments
5. [docs/ai/REFERENCE/00.2-data-requirements.md](../REFERENCE/00.2-data-requirements.md) §4 — what belongs in PostgreSQL vs R2 (canonical split WP-042 verifies)
6. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) §`docs` — documentation is non-engine, non-shipped; no D-entry needed for `docs/ai/deployment/` per RS-4 precedent
7. [docs/ai/execution-checklists/EC-042-deployment-checklists.checklist.md](../execution-checklists/EC-042-deployment-checklists.checklist.md) — primary execution authority (Locked Values + Guardrails + Files to Produce)
8. [docs/ai/work-packets/WP-042-deployment-checklists.md](../work-packets/WP-042-deployment-checklists.md) — authoritative WP specification (as amended 2026-04-19 for D-4201 scope reduction)
9. [docs/ai/session-context/session-context-wp042.md](../session-context/session-context-wp042.md) — session-context bridge from WP-035; baselines, patterns, inherited quarantine, all pre-flight item definitions
10. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D-0602** (Invalid Content Cannot Reach Runtime), **D-0801** (Explicit Version Axes), **D-0802** (Incompatible Data Fails Loudly), **D-0902** (Rollback Is Always Possible), **D-1002** (Immutable Surfaces Are Protected), **D-1201** / **D-1202** (ext_id discipline), **D-3501** through **D-3504** (WP-035 ops decisions), **D-4201** (WP-042 scope reduction — landed at pre-flight)
11. [docs/ops/RELEASE_CHECKLIST.md](../../ops/RELEASE_CHECKLIST.md) — the process-level release gates that invoke WP-042's checklists (Gate 2 for content validation, Gate 3 for replay, §"Relationship to runtime invariant checks" for schema verification)
12. [docs/ops/DEPLOYMENT_FLOW.md](../../ops/DEPLOYMENT_FLOW.md) — the promotion + rollback process WP-042's checklists run within
13. [docs/ops/INCIDENT_RESPONSE.md](../../ops/INCIDENT_RESPONSE.md) — the P0–P3 severity ladder WP-042's checklists may cite for failure-handling prose
14. [docs/archive prompts-legendary-area-game/00.2b-deployment-checklists.md](../../archive%20prompts-legendary-area-game/00.2b-deployment-checklists.md) — legacy source document; §A (R2) and §B (PostgreSQL) are converted; §C (Konva.js canvas) is OUT of scope per D-4202
15. [packages/registry/scripts/validate.ts](../../../packages/registry/scripts/validate.ts) — the validation script `pnpm registry:validate` invokes (documented in §A.1, not re-implemented)
16. [scripts/migrate.mjs](../../../scripts/migrate.mjs) — the migration runner `pnpm migrate` invokes (documented in §B.2, not re-implemented)
17. [data/migrations/](../../../data/migrations/) — the three real migration files (`001_server_schema.sql`, `002_seed_rules.sql`, `003_game_sessions.sql`) as shipped by Foundation Prompt 02 commit `ac8486b`
18. [docs/ai/REFERENCE/01.4-pre-flight-invocation.md](../REFERENCE/01.4-pre-flight-invocation.md) §Established Patterns + §Precedent Log P6-43 through P6-51 — discipline inherited by WP-042

If any conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, Legendary Arena has a complete R2 data verification checklist, a scope-reduced PostgreSQL schema-structure verification checklist, and the `docs/ops/RELEASE_CHECKLIST.md` back-pointers that cross-reference the two. Specifically:

1. **`docs/ai/deployment/r2-data-checklist.md` exists** with sections §A.1 through §A.7 as originally specified by WP-042. Every item has a specific verification command or SQL query. No Konva.js / canvas / UI references. No `packages/game-engine/` internals referenced. Paraphrased language per P6-50 (no literal `boardgame.io`, `Math.random`, `Date.now` tokens in prose).
2. **`docs/ai/deployment/postgresql-checklist.md` exists** with four sections (§B.1 Pre-conditions, §B.2 Migration execution, §B.6 Rules data seeding verification, §B.7 Schema-structure verification) plus an explicit "deferred sections" pointer at the top citing D-4201 and enumerating §B.3 / §B.4 / §B.5 / §B.8 as awaiting WP-042.1. Every item has a specific SQL query or CLI command. No `pnpm seed` or `scripts/seed-from-r2.mjs` references anywhere in the file.
3. **`docs/ai/ARCHITECTURE.md` gains a one-line cross-reference** in the Server Startup Sequence subsection: "Deployment prerequisites are verified by the checklists in `docs/ai/deployment/`."
4. **`docs/ops/RELEASE_CHECKLIST.md` gains two back-pointer lines** (Gate 2 → R2 checklist §A.1; "Relationship to runtime invariant checks" → PostgreSQL checklist §B.7) per PS-2 resolution.
5. **D-4202 and D-4203 land** in DECISIONS.md (D-4202: P6-51 form (2) back-pointer for Konva.js exclusion citing the R2 checklist's §Scope section. D-4203: P6-51 form (1) discrete entry for "WP-042 is documentation class not code class" as a Layer Boundary invariant).
6. **Engine baseline unchanged: 436 tests / 109 suites / 0 fail.** Repo-wide 526 / 0 fail. WP-042 produces **zero new tests** and **zero new runtime code** (RS-2 + D-4203 locks).
7. **No references to the absent seed script.** Grep across both produced checklists returns zero matches for `seed-from-r2`, `pnpm seed`, and any of the deferred section names (§B.3/§B.4/§B.5/§B.8 only appear in the top-of-file "deferred sections" pointer).
8. **WP-042.1 follow-up entry exists** in `WORK_INDEX.md` so the deferred work is durably tracked.

No engine changes. No server changes. No client changes. No new tests. No new npm dependencies. No new scripts. No `package.json` edit.

---

## Locked Values (Do Not Re-Derive)

### Commit & governance prefixes

- **EC / commit prefix:** `EC-042:` on every doc-changing commit in the WP-042 allowlist; `SPEC:` on governance / doc-only commits outside the allowlist; `WP-042:` is **forbidden** (commit-msg hook rejects per P6-36).
- **Commit topology (three commits, matching WP-034/WP-035):**
  - **Commit A0 (`SPEC:`)** — pre-flight bundle: D-4201 in `DECISIONS.md` + D-4201 row in `DECISIONS_INDEX.md` + WP-042 amendments + EC-042 amendments + this session prompt. **Must land before Commit A.**
  - **Commit A (`EC-042:`)** — code + 01.6 post-mortem: four files in the allowlist (`r2-data-checklist.md`, `postgresql-checklist.md`, `ARCHITECTURE.md` one-line edit, `RELEASE_CHECKLIST.md` two-line back-pointer) + D-4202 + D-4203 + `docs/ai/post-mortems/01.6-WP-042-deployment-checklists.md`.
  - **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` (WP-042 `[x]` + WP-042.1 new entry) + `EC_INDEX.md` + any `DECISIONS_INDEX.md` / `DECISIONS.md` follow-ups surfaced during execution.

### Four deployment environments (inherited from WP-035 / D-3502)

`dev` → `test` → `staging` → `prod`. Sequential promotion. Sourced from the typed union `DeploymentEnvironment` in `packages/game-engine/src/ops/ops.types.ts`. WP-042's checklists run per environment; the environment itself is verified by the checklists.

### Three migration files (PS-5 resolution — corrected from WP-042's original five-file paper spec)

Execution order by filename sort:

1. `001_server_schema.sql` — `legendary.*` DDL
2. `002_seed_rules.sql` — rules glossary seed
3. `003_game_sessions.sql` — `public.game_sessions` table + `updated_at` trigger

All three landed via Foundation Prompt 02 commit `ac8486b`. Files `004_upsert_indexes.sql` and `005_lobby_columns.sql` from the pre-amendment WP-042 locked list **do not exist** — they were Foundation Prompt 03 deliverables that were never authored. Do NOT reference them in the produced checklist except to explicitly note (in the "deferred sections" pointer) that the seeding sections awaiting WP-042.1 will probably author `004_upsert_indexes.sql` when they land.

### Six metadata files (inherited from WP-042 §Locked contract values — verbatim)

- `sets.json` — 40 entries
- `card-types.json` — 37 entries
- `hero-classes.json` — 5 entries
- `hero-teams.json` — 25 entries
- `icons-meta.json` — 7 entries
- `leads.json` — 50+ entries

All located under `data/metadata/` (verified via `find . -name "sets.json"` at pre-flight).

### Four PostgreSQL checklist sections (scope-reduced per D-4201)

**Present in WP-042 scope:**

- §B.1 — Pre-conditions (`DATABASE_URL`, `EXPECTED_DB_NAME`, connection health check, Node v22+, `pg` package)
- §B.2 — Migration execution (three files above; `pnpm migrate`; idempotent; expected output)
- §B.6 — Rules data seeding verification (`legendary.rules` + `legendary.rule_docs` + FTS vector — populated by `002_seed_rules.sql` which IS a real migration)
- §B.7 — Schema-structure verification (table/column/FK/index existence; NOT row counts)

**Deferred per D-4201 (do NOT author these in WP-042):**

- §B.3 — Lookup table seeding (depends on `scripts/seed-from-r2.mjs` which does not exist)
- §B.4 — Group and entity seeding (same)
- §B.5 — Card record seeding (same)
- §B.8 — Re-seeding procedure (same)

### Seven R2 checklist sections (unchanged from WP-042)

- §A.1 — Validation script usage
- §A.2 — Registry manifest
- §A.3 — Metadata files
- §A.4 — Image assets (naming convention + HEAD spot-checks)
- §A.5 — Cross-reference checks (`alwaysLeads` slug resolution; duplicate slug detection)
- §A.6 — R2 bucket configuration (`legendary-images` bucket; CORS; cache-control; `rclone` verification)
- §A.7 — New set upload procedure

### Environment variables (RS-3 resolution — read-only verification inputs)

These are the env vars the checklists expect to READ at verification time. None is provisioned, written, or exported by the checklists:

- `DATABASE_URL` — PostgreSQL connection string (provisioned by Render; PostgreSQL checklist §B.1 reads it)
- `EXPECTED_DB_NAME` — expected database name for sanity check (PostgreSQL checklist §B.1)
- `CARDS_DIR` — local path to card JSON files for local validation mode (R2 checklist §A.1)
- `R2_BASE_URL` — R2 public URL for remote validation mode (R2 checklist §A.1; value is `https://images.barefootbetters.com`)
- `SKIP_IMAGES` — optional flag to skip Phase 5 HEAD checks (R2 checklist §A.1)
- `IMAGE_DELAY_MS` — optional flag to override 50ms inter-request delay (R2 checklist §A.1; default `50`)

Any env-var assignment, export, or provisioning step is explicitly forbidden in the produced checklists per RS-3.

### P6-50 paraphrase table for grep discipline

EC-042 §Guardrails + EC-042 §After Completing + WP-042 §Verification Steps all use `Select-String` purity greps that match substrings in both runtime code AND documentation prose. Any mention of the tokens below in the checklist prose would false-positive the grep. Use paraphrase form on the first pass:

| Forbidden grep token | Approved paraphrase |
|---|---|
| `Konva` | "the canvas UI library" / "the UI rendering layer" |
| `canvas` | "UI rendering surface" / "browser canvas surface" |
| `boardLayout` | "UI board-position map" |
| `CARD_TINT` | "UI card tinting constant" |
| `game-engine` | "the engine package" |
| `boardgame.io` | "the game framework" |
| `LegendaryGame` | "the game-state root object" |
| `ctx.` | "the framework context" / "the game-state context" |
| `Math.random` | "non-engine random source" |
| `Date.now` | "wall-clock helper" |
| `performance.now` | "high-resolution timing reads" |
| `seed-from-r2` | (never mention; script does not exist; no paraphrase needed) |
| `pnpm seed` | (never mention; script does not exist; the "deferred sections" pointer names §B.3/§B.4/§B.5/§B.8 but does not name the underlying CLI) |

---

## Non-Negotiable Constraints

**Documentation-class WP (always apply):**

- Documentation only — no new `.mjs`, no new `.ts`, no `package.json` edit, no new `scripts/` files, no new `data/` files. D-4203 (to be added in Commit A) codifies this as a Layer Boundary invariant for WP-042 specifically.
- ESM only for any referenced commands; Node v22+ as the runtime baseline (for documentation correctness — the commands the checklists reference must actually work at the current Node baseline).
- No modifications to `packages/` or `apps/`. Verified via `git diff --name-only` in Verification Steps.
- All checklist items are binary pass/fail. No subjective checks, no "mostly works" language.
- Full file contents for every new file in the output. No diffs, no snippets.
- Human-style prose per [docs/ai/REFERENCE/00.6-code-style.md](../REFERENCE/00.6-code-style.md) Rules 11 (full-sentence error descriptions), 14 (no abbreviations in new names — `DATABASE_URL` is fine because it's the environment-variable name; ad-hoc abbreviations like `DB_URL` in prose are forbidden).
- **No new npm dependencies.** `pnpm-lock.yaml` must NOT appear in the diff.

**Packet-specific:**

- **Scope reduction per D-4201 is non-negotiable.** §B.3, §B.4, §B.5, §B.8 are DEFERRED. The PostgreSQL checklist authors the "deferred sections" pointer at the top and stops at §B.7. The temptation to "helpfully" add a seeding section using a hypothetical future script must be resisted — WP-042.1 owns that work.
- **No `seed-from-r2.mjs` references.** The script does not exist; any reference would fail the checklist's own verification. The only permitted mention is in the "deferred sections" pointer (e.g., "§B.3 awaits WP-042.1, which will revive Foundation Prompt 03 and produce `scripts/seed-from-r2.mjs`").
- **No Konva.js / canvas / UI implementation checks.** Legacy 00.2b Checklist C is explicitly excluded per D-4202 (to be added in Commit A as P6-51 form (2) back-pointer).
- **All table references use the `legendary.*` namespace.** Verified via `Select-String` in Verification Steps.
- **Migration order by filename sort.** The three real migrations (`001_server_schema.sql`, `002_seed_rules.sql`, `003_game_sessions.sql`) execute in filename order. Do NOT reference 004 or 005 in the produced checklist except to note their deferral.
- **Cross-reference back-pointers are additive-only edits** to `docs/ops/RELEASE_CHECKLIST.md`. Do NOT modify the existing gate content; add only the two back-pointer lines specified in §Scope (In) §B-ref of the WP-042 body. Grep verification: `git diff docs/ops/RELEASE_CHECKLIST.md` shows at most ~5 added lines, zero deletions, zero modifications to existing lines' semantics.
- **`docs/ai/ARCHITECTURE.md` edit is additive-only.** A single line added to §Section 2 Server Startup Sequence. Do NOT restructure or modify surrounding text.
- **D-4202 and D-4203 landing timing:** these DECISIONS.md entries land in **Commit A** (the `EC-042:` code commit), not in Commit A0. D-4201 (scope reduction) lands in Commit A0. This sequencing matches P6-51 form (1) / form (2) discipline — the WP-level scope decision is locked before execution; the per-rationale back-pointers land with the execution itself.

**Session protocol:**

- If the engine baseline diverges from 436 / 109 suites at session start, STOP — the WP-042 test-count lock depends on this.
- If `scripts/seed-from-r2.mjs` has magically appeared in the repo since pre-flight (unlikely but possible if another session created it), STOP and re-verify D-4201's scope reduction. The seed sections deferral depends on the script NOT existing; if it does exist, WP-042's scope should probably expand rather than reduce, and that's a new pre-flight.
- If the three locked migration files have grown or shrunk (e.g., a new migration landed between pre-flight and execution), STOP and reconcile with `data/migrations/` against the session prompt's §Locked Values.
- If any contract, field name, or reference is unclear, STOP and ask before proceeding.

---

## Files Expected to Change (Allowlist — P6-27 ENFORCED)

Any file beyond this list is a scope violation. STOP and escalate.

### New — deployment checklists (under `docs/ai/deployment/`)

1. `docs/ai/deployment/r2-data-checklist.md` — **new**. Seven sections (§A.1 through §A.7) per WP-042 §Scope (In) §A. Paraphrase form in all prose per P6-50.
2. `docs/ai/deployment/postgresql-checklist.md` — **new**. Four sections (§B.1, §B.2, §B.6, §B.7) per WP-042 §Scope (In) §B (as amended). Explicit "deferred sections" pointer at the top citing D-4201.

### Modified — cross-references

3. `docs/ai/ARCHITECTURE.md` — **modified**. Single-line addition in the Server Startup Sequence subsection citing `docs/ai/deployment/`.
4. `docs/ops/RELEASE_CHECKLIST.md` — **modified**. Two back-pointer line additions (Gate 2 → R2 checklist §A.1; "Relationship to runtime invariant checks" → PostgreSQL checklist §B.7). Additive only; no existing content modified.

### New — governance & post-mortem (inside Commit A)

5. `docs/ai/post-mortems/01.6-WP-042-deployment-checklists.md` — **new**. Formal 10-section 01.6 post-mortem. Verdict should be **WP COMPLETE** given zero mid-execution fixes expected (this is the P6-50 prevention in action for the second WP).
6. `docs/ai/DECISIONS.md` — **modified**. Two new entries: **D-4202** (Konva.js exclusion back-pointer; P6-51 form (2)) and **D-4203** (documentation-not-code invariant; P6-51 form (1)).
7. `docs/ai/DECISIONS_INDEX.md` — **modified**. Two new rows for D-4202 and D-4203.

### Modified — governance (Commit B; not Commit A)

- `docs/ai/STATUS.md` — **modified** per DoD. Prepend a WP-042 execution entry to §Current State: R2 checklist full; PostgreSQL checklist scope-reduced per D-4201; WP-042.1 follow-up identified.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**. Flip WP-042 to `[x]` with today's date and the Commit A hash; add a new WP-042.1 entry for the deferred seeding checklist sections.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified**. Flip EC-042 from Draft to Done with `Executed YYYY-MM-DD at commit <hash>`; refresh footer.

### Must remain UNTOUCHED

- `packages/` (all subtrees — engine, registry, vue-sfc-loader)
- `apps/` (all subtrees — server, arena-client, registry-viewer, replay-producer)
- `scripts/` (no new files; no edits to `migrate.mjs`)
- `data/` (no new migrations; no new metadata files)
- `package.json` (no `"seed":` entry; no new scripts)
- `pnpm-lock.yaml` (no new deps)
- `docs/ops/DEPLOYMENT_FLOW.md` and `docs/ops/INCIDENT_RESPONSE.md` (WP-042 does not edit these; only `RELEASE_CHECKLIST.md` gets the two back-pointer lines)
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` (no new directory entry per RS-4 precedent)
- All inherited dirty-tree files (M `session-wp079-...`; ~70 theme JSON files; `themeClient.ts`; `apps/registry-viewer/CLAUDE.md`; untracked files listed in Pre-Session Gate #4)
- Both retained stashes (`stash@{0}`, `stash@{1}`) — **NEVER pop**
- The EC-069 `<pending — gatekeeper session>` placeholder — **do NOT backfill**

---

## Acceptance Criteria

### R2 Data Checklist

- [ ] `docs/ai/deployment/r2-data-checklist.md` exists.
- [ ] Contains validation script usage for both local and R2 modes (§A.1).
- [ ] Contains all 6 metadata file checks with expected entry counts (§A.3).
- [ ] Contains image naming convention table (§A.4).
- [ ] Contains new set upload procedure as ordered steps (§A.7).
- [ ] Contains R2 bucket configuration requirements (§A.6 — bucket name `legendary-images`, CORS, cache-control, `rclone` verification).
- [ ] Every checklist item has a specific verification command or query.
- [ ] No Konva.js, canvas, or UI references appear in the file (`Select-String` returns zero matches on the forbidden tokens table).

### PostgreSQL Checklist

- [ ] `docs/ai/deployment/postgresql-checklist.md` exists.
- [ ] Contains a "deferred sections" pointer at the top naming §B.3, §B.4, §B.5, §B.8 as awaiting WP-042.1 and citing D-4201.
- [ ] Contains pre-conditions (§B.1: `DATABASE_URL`, connection health, Node v22+, `pg` package).
- [ ] Contains migration execution order (§B.2: three files — `001_server_schema.sql`, `002_seed_rules.sql`, `003_game_sessions.sql`; `pnpm migrate`; expected output).
- [ ] Contains rules data and FTS vector verification (§B.6).
- [ ] Contains schema-structure verification (§B.7: tables exist, columns exist with expected types, FK constraints exist, indexes exist on `slug` columns where upsert is used, `public.game_sessions` table exists with `updated_at` trigger).
- [ ] Every checklist item has a specific SQL query or CLI command.
- [ ] All table references use `legendary.*` namespace (except `public.game_sessions` which is intentionally under `public.` per D-1201/D-1202).
- [ ] No game logic, move logic, or engine references appear in the file.
- [ ] No references to `pnpm seed` or `scripts/seed-from-r2.mjs` anywhere in the file (including in the "deferred sections" pointer — the pointer names the sections by letter, not by underlying CLI).

### Cross-References

- [ ] `docs/ai/ARCHITECTURE.md` contains a reference to `docs/ai/deployment/` in the Server Startup Sequence subsection.
- [ ] `docs/ops/RELEASE_CHECKLIST.md` contains two new back-pointer lines (Gate 2 and "Relationship to runtime invariant checks") citing the WP-042 checklists.

### Governance

- [ ] D-4201 (scope reduction) is present in `DECISIONS.md` and `DECISIONS_INDEX.md` (landed in Commit A0).
- [ ] D-4202 (Konva.js exclusion back-pointer, P6-51 form (2)) is added to `DECISIONS.md` + `DECISIONS_INDEX.md` in Commit A.
- [ ] D-4203 (documentation-not-code invariant, P6-51 form (1)) is added to `DECISIONS.md` + `DECISIONS_INDEX.md` in Commit A.
- [ ] `STATUS.md`, `WORK_INDEX.md` (with WP-042.1 follow-up entry), `EC_INDEX.md` all updated in Commit B.
- [ ] EC-042 flipped from Draft to Done with `Executed YYYY-MM-DD at commit <hash>` in `EC_INDEX.md` + footer refresh.

### Layer Boundary Compliance

- [ ] Neither checklist file references `packages/game-engine/` internals.
- [ ] Neither checklist file contains game framework concepts in paraphrase form per P6-50 (verified via grep for literal tokens in the paraphrase table).
- [ ] Neither checklist file contains UI implementation details.
- [ ] No files in `packages/` or `apps/` or `scripts/` or `data/` or `package.json` were modified.

### Test Baselines (RS-2 Lock)

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] Engine count **UNCHANGED at 436 / 109 / 0 fail** (RS-2 lock — WP-042 adds zero tests and zero runtime code).
- [ ] `pnpm -r test` exits 0 with **526 passing, 0 failing** (unchanged).

### Scope Enforcement

- [ ] No files outside §Files Expected to Change were modified (`git diff --name-only`).
- [ ] `pnpm-lock.yaml` absent from diff (no new dep).
- [ ] No new `.mjs` or `.ts` files anywhere in the repo (D-4203 invariant).
- [ ] Neither `stash@{0}` nor `stash@{1}` popped. EC-069 placeholder NOT backfilled. No inherited dirty-tree file staged.

---

## Verification Steps (run in order)

```pwsh
# Step 1 — confirm both checklist files exist
Test-Path "docs\ai\deployment\r2-data-checklist.md"
Test-Path "docs\ai\deployment\postgresql-checklist.md"
# Expected: True, True

# Step 2 — R2 checklist layer boundary
Select-String -Path "docs\ai\deployment\r2-data-checklist.md" -Pattern "Konva|canvas|boardLayout|CARD_TINT|game-engine|boardgame\.io|LegendaryGame|ctx\."
# Expected: no output (all forbidden tokens absent per P6-50 paraphrase)

# Step 3 — PostgreSQL checklist layer boundary + scope discipline
Select-String -Path "docs\ai\deployment\postgresql-checklist.md" -Pattern "Konva|canvas|boardLayout|CARD_TINT|game-engine|boardgame\.io|LegendaryGame|ctx\."
Select-String -Path "docs\ai\deployment\postgresql-checklist.md" -Pattern "seed-from-r2|pnpm seed"
# Expected: no output for either (forbidden tokens absent; no seed-script references)

# Step 4 — PostgreSQL checklist uses legendary.* namespace
Select-String -Path "docs\ai\deployment\postgresql-checklist.md" -Pattern "legendary\."
# Expected: multiple matches (all table references — at least 6 distinct tables cited)

# Step 5 — PostgreSQL checklist has deferred sections pointer citing D-4201
Select-String -Path "docs\ai\deployment\postgresql-checklist.md" -Pattern "D-4201"
Select-String -Path "docs\ai\deployment\postgresql-checklist.md" -Pattern "B\.3|B\.4|B\.5|B\.8"
# Expected: at least one D-4201 match; at least one match per deferred section (in the pointer, not as section bodies)

# Step 6 — PostgreSQL checklist names the three real migrations
Select-String -Path "docs\ai\deployment\postgresql-checklist.md" -Pattern "001_server_schema|002_seed_rules|003_game_sessions"
# Expected: at least one match per filename
Select-String -Path "docs\ai\deployment\postgresql-checklist.md" -Pattern "001_initial_schema|002_seed_base_set|003_add_game_sessions|004_upsert_indexes|005_lobby_columns"
# Expected: no output (pre-amendment locked filenames absent)

# Step 7 — ARCHITECTURE.md cross-reference
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "docs/ai/deployment"
# Expected: at least one match

# Step 8 — RELEASE_CHECKLIST.md back-pointer lines
Select-String -Path "docs\ops\RELEASE_CHECKLIST.md" -Pattern "docs/ai/deployment"
# Expected: at least two matches (one for R2 back-pointer, one for PostgreSQL back-pointer)

# Step 9 — D-4201 present (landed in Commit A0)
Select-String -Path "docs\ai\DECISIONS.md" -Pattern "D-4201"
Select-String -Path "docs\ai\DECISIONS_INDEX.md" -Pattern "D-4201"
# Expected: at least one match each

# Step 10 — D-4202 and D-4203 present (landed in Commit A)
Select-String -Path "docs\ai\DECISIONS.md" -Pattern "D-4202"
Select-String -Path "docs\ai\DECISIONS.md" -Pattern "D-4203"
Select-String -Path "docs\ai\DECISIONS_INDEX.md" -Pattern "D-4202"
Select-String -Path "docs\ai\DECISIONS_INDEX.md" -Pattern "D-4203"
# Expected: at least one match each

# Step 11 — engine build and test unchanged (RS-2 lock)
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
# Expected: both exit 0; test reports 436 passing / 109 suites / 0 failing

# Step 12 — repo-wide regression
pnpm -r test
# Expected: 526 passing, 0 failing

# Step 13 — scope enforcement: only expected files in diff
git diff --name-only
# Expected: only
#   docs/ai/deployment/r2-data-checklist.md
#   docs/ai/deployment/postgresql-checklist.md
#   docs/ai/ARCHITECTURE.md
#   docs/ops/RELEASE_CHECKLIST.md
#   docs/ai/DECISIONS.md
#   docs/ai/DECISIONS_INDEX.md
#   docs/ai/post-mortems/01.6-WP-042-deployment-checklists.md

# Step 14 — no new runtime code (D-4203 invariant)
git diff --name-only | Select-String "\.mjs$|\.ts$|\.js$|package\.json"
# Expected: no output

# Step 15 — no new dependencies
git diff --name-only | Select-String "^pnpm-lock\.yaml$"
# Expected: no output

# Step 16 — no packages/ or apps/ modifications
git diff --name-only | Select-String "^(packages|apps)/"
# Expected: no output

# Step 17 — inherited quarantine intact
git stash list
# Expected: both stash@{0} and stash@{1} still present
Select-String -Path "docs\ai\execution-checklists\EC_INDEX.md" -Pattern "pending.*gatekeeper session"
# Expected: still present (EC-069 placeholder not backfilled)
```

---

## Post-Mortem — MANDATORY (P6-35)

Per [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). Triggering criteria that apply:

1. **New long-lived abstraction:** the R2 and PostgreSQL deployment checklists become the canonical pre-deployment verification artifacts for the lifetime of the project. Future deploys, future release cycles, WP-042.1, and future ops tooling will all reference them. Lock the shapes + prose at MVP.
2. **First concrete consumer of WP-035's process docs:** WP-042 is the first WP to add cross-reference back-pointers to `docs/ops/RELEASE_CHECKLIST.md`. The post-mortem captures the integration pattern for future WPs that produce per-pillar checklists.

Run the formal 10-section 01.6 output, save at `docs/ai/post-mortems/01.6-WP-042-deployment-checklists.md`, and stage into Commit A.

---

## Definition of Done

- [ ] Pre-Session Gates #1–#5 all resolved.
- [ ] Copilot Check (§01.7 section above) verdict CONFIRM re-read and honored during execution.
- [ ] All Acceptance Criteria above pass.
- [ ] All Verification Steps return expected output.
- [ ] No `packages/game-engine/` internals or game framework concepts in either produced checklist (grep clean on paraphrase table).
- [ ] No `seed-from-r2` or `pnpm seed` references anywhere in the produced checklists.
- [ ] Engine count **unchanged at 436 / 109 / 0 fail**; repo-wide **526 / 0 fail**.
- [ ] D-4202 and D-4203 added to DECISIONS.md + DECISIONS_INDEX.md in Commit A.
- [ ] WP-042.1 follow-up entry added to `WORK_INDEX.md` in Commit B.
- [ ] `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md` updated in Commit B.
- [ ] EC-042 flipped Draft → Done with commit hash + footer refresh.
- [ ] Commit A0 uses `SPEC:` prefix (pre-flight bundle, landed before this session); Commit A uses `EC-042:` prefix; Commit B uses `SPEC:` prefix.
- [ ] **01.6 post-mortem complete (MANDATORY per P6-35)** — formal 10-section output at `docs/ai/post-mortems/01.6-WP-042-deployment-checklists.md`, in-session, staged into Commit A.
- [ ] Both inherited stashes intact; no inherited dirty-tree files staged; EC-069 placeholder not backfilled.

---

## Out of Scope (Explicit)

- **No CI/CD pipeline implementation.** Checklists document what must be true; CI enforcement is separate.
- **No cloud provider configuration.** Render-specific runbooks are a separate future WP.
- **No logging stack selection.** Monitoring counters exist (`OpsCounters` from WP-035); collection is ops tooling.
- **No alerting integrations.** Passive monitoring at MVP per WP-035.
- **No new scripts or automation.** Checklists document the existing `pnpm registry:validate` and `pnpm migrate`; they do NOT author new CLI tooling.
- **No creation of `scripts/seed-from-r2.mjs`.** D-4203 invariant; handled by WP-042.1.
- **No seeding verification sections.** §B.3 / §B.4 / §B.5 / §B.8 deferred per D-4201.
- **No engine logic changes.** WP-042 is documentation class only.
- **No persistence / database access at verification time.** Checklists DOCUMENT the SQL queries an operator runs; they do not execute them.
- **No new tests.** RS-2 lock.
- **No new npm dependencies.**
- **No modification to any pre-existing engine or app code, any pre-existing test, or any governance document beyond the seven files in §Files Expected to Change (Commit A) plus the three files in the Commit B governance list.**
- **No backfill of the EC-069 `<pending — gatekeeper session>` placeholder** (owned by a separate SPEC session).
- **No pop of `stash@{0}` or `stash@{1}`** (owned by the WP-068 / MOVE_LOG_FORMAT resolver).
- Refactors, cleanups, or "while I'm here" improvements are out of scope unless explicitly listed in §Files Expected to Change above.

---

## Final Instruction

Execute exactly this scope. No synthesis, no scope expansion, no "helpful" additions. If any required modification cannot be classified as within the WP-042 allowlist, STOP and escalate rather than force-fitting. **P6-27 is active.** The 01.7 Copilot Check verdict CONFIRM above presumes the Locked Values and Non-Negotiable Constraints are honored literally — any deviation during execution re-opens the scan.

The most common failure mode for WP-042 is **trying to be helpful with the missing seed script**. Resist it. D-4201 is the durable record of the scope reduction; WP-042.1 owns that work. The four surviving PostgreSQL sections (§B.1, §B.2, §B.6, §B.7) plus the full R2 checklist deliver real value today without invalidating the WP's Documentation class.

When finished: run all verification steps, capture output, run the mandatory 01.6 post-mortem, then commit per the established three-commit pattern (Commit A0: `SPEC:` pre-flight bundle — already landed; Commit A: `EC-042:` docs + D-4202 + D-4203 + post-mortem; Commit B: `SPEC:` governance close).
