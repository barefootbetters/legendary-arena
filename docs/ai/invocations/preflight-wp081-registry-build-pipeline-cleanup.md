# Pre-Flight Invocation — WP-081

---

### Pre-Flight Header

**Target Work Packet:** `WP-081`
**Title:** Registry Build Pipeline Cleanup
**Previous WP Status:** WP-055 / EC-055 Executed (2026-04-20, commit `dc7010e`); WP-055 / EC-055 governance closed (commit `211516d`)
**Pre-Flight Date:** 2026-04-20
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Contract-Only-adjacent — **Documentation + Hygiene**
(subtractive: deletes three broken operator scripts + trims `package.json`
`scripts.build` + deletes one ci.yml step + rewrites stale README regions;
produces no new code, no new tests, no new dependencies)

Required sections: Dependency Check, Structural Readiness, Scope Lock,
Test Expectations, Risk Review.
Skipped sections: Runtime Readiness Check, Mutation Boundary Confirmation.

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-081.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

### Authority Chain (Must Read)

1. `.claude/CLAUDE.md` — read (EC-mode rules, bug handling, commit discipline)
2. `docs/ai/ARCHITECTURE.md` — read (Registry layer boundaries)
3. `.claude/rules/registry.md` — read (Schema Authority; Immutable Files from WP-003)
4. `docs/ai/execution-checklists/EC-081-registry-build-pipeline-cleanup.checklist.md` — read
5. `docs/ai/work-packets/WP-081-registry-build-pipeline-cleanup.md` — read
6. `docs/ai/session-context/session-context-wp081.md` — read
   (grep baseline, mid-session findings, pre-flight open questions)
7. `docs/ai/post-mortems/01.6-WP-055-theme-data-model.md §8 item 3` —
   discovery anchor for the dead-pipeline issue

No conflicts detected between authority chain documents. Authoritative-Lock
note in WP §Non-Negotiable Constraints confirmed as single source of truth;
Scope §D–§F prose is descriptive, subordinated to the Locked Values.

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-003 | ✅ Complete (2026-04-09) | Card Registry Verification & Defect Correction. `packages/registry/src/schema.ts` exports `SetDataSchema` and friends; does NOT export `CardSchema` / `CardIDSchema` / `CANONICAL_ID_REGEX` / `CardTypeSchema` (verified via grep — zero matches, only substring hits on unrelated schema names like `HeroCardSchema`). |

All prerequisites are met. WP-081 has no other hard upstream.

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — verified at main checkout:
      registry 13/0 fail, vue-sfc-loader 11/0 fail, game-engine 436/0 fail,
      replay-producer 4/0 fail, server 6/0 fail, arena-client 66/0 fail,
      **repo-wide 536/0 fail** (matches WP-081 baseline)
- [x] No known EC violations remain open
- [x] The three scripts WP-081 deletes still exist at their declared paths
      (`normalize-cards.ts`, `build-dist.mjs`, `standardize-images.ts`)
- [x] The two scripts WP-081 preserves still exist unchanged (`validate.ts`,
      `upload-r2.ts`)
- [x] CI job named `build` still contains the "Normalize cards" step to be
      deleted (ci.yml lines 60-61; `registry:validate` invocation with the
      stale `# also writes cards.json + index.json` comment)
- [x] README.md lines 62-64 and 204-205 still contain the expected stale
      content — scope anchors hold
- [x] No architectural boundary conflicts — WP-081 does not touch
      `packages/registry/src/**` (WP-003 immutable files untouched)

**Build note:** `pnpm --filter @legendary-arena/registry build` currently
fails — this is the motivating condition for WP-081, not a pre-flight
blocker. After execution, the build exits 0.

All structural readiness checks pass except for one scope gap (PS-1 below).

---

### Established Patterns to Follow (Locked Precedents)

- **Delete-not-rewrite** for dead derived artifacts when no runtime consumer
  exists. The monorepo runtime path is `metadata/sets.json` +
  `metadata/{abbr}.json` fetched directly from R2 by `httpRegistry.ts` /
  `localRegistry.ts` (WP-003 precedent; D-8101 to be registered).
- **WP-003 immutable files cannot be modified** without WP-level
  authorization and a DECISIONS.md entry (schema.ts, shared.ts,
  localRegistry.ts). WP-081 does not modify any of them.
- **Subtractive-only WPs** ship without new tests, new dependencies, or
  version bumps. Test baseline invariance is a binary Acceptance Criterion
  (WP-047/WP-079 precedent).
- **Authoritative-Lock note** locks a single source of truth for locked
  values when the same values appear descriptively in multiple sections
  (post-review refinement pattern introduced here; see WP-081 §Non-Negotiable
  Constraints).
- **Commit prefix `EC-081:`** at execution (never `WP-081:` per P6-36 — the
  `.githooks/commit-msg` hook rejects `WP-###:`).

---

### Scope Lock (Critical)

#### WP-081 Is Allowed To

- **Delete:** `packages/registry/scripts/normalize-cards.ts` — broken script
- **Delete:** `packages/registry/scripts/build-dist.mjs` — broken post-tsc step
- **Delete:** `packages/registry/scripts/standardize-images.ts` — broken operator tool
- **Modify:** `packages/registry/package.json` — trim `scripts.build` to
  `"tsc -p tsconfig.build.json"`; remove `scripts.normalize` and
  `scripts.standardize-img`
- **Modify:** `.github/workflows/ci.yml` — delete "Normalize cards" step
  from the `build` job
- **Modify:** `README.md` — rewrite stale pipeline references (anchors
  listed below — see PS-1 resolution for the five regions)
- **Update:** `docs/ai/STATUS.md` — entry with verbatim phrase
  `Registry build is tsc-only; no normalize/dist pipeline remains.`
- **Update:** `docs/ai/DECISIONS.md` — register D-8101 and D-8102
- **Update:** `docs/ai/work-packets/WORK_INDEX.md` — flip WP-081 to Done
- **Update:** `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-081 to
  Done; summary counts adjusted

#### WP-081 Is Explicitly Not Allowed To

- No modifications to `packages/registry/src/**` (WP-003 immutable files;
  `schema.ts` / `shared.ts` / `impl/localRegistry.ts` must remain unchanged)
- No modifications to `packages/registry/scripts/validate.ts` (functional
  and current; out of scope)
- No modifications to `packages/registry/scripts/upload-r2.ts` (still
  parses and runs; out of scope even though session-context §2.4 flags
  it as follow-up worthy)
- No new `.ts` or `.mjs` files under `packages/registry/scripts/`
- No new tests, no new dependencies, no `pnpm-lock.yaml` change, no
  `version` bump
- No changes to `apps/server/**` or `apps/registry-viewer/**` (runtime
  consumers use `metadata/*.json`, not any dist artifact)
- No changes to `data/metadata/*.json` or `content/themes/*.json`
  (registry data untouched)
- No rewrite of the deleted pipeline (D-8101 seals this)

**Rule:** Anything not explicitly allowed is out of scope.

---

### Test Expectations (Locked Before Execution)

- **New tests:** 0 — subtractive packet
- **Existing test changes:** None
- **Prior test baseline (verified at pre-flight):**
  - registry: 13 tests / 13 pass / 0 fail
  - vue-sfc-loader: 11 tests / 11 pass / 0 fail
  - game-engine: 436 tests / 436 pass / 0 fail (109 suites per WP baseline — suite count not verified at pre-flight; to be re-checked at execution)
  - replay-producer: 4 / 4 / 0 fail
  - server: 6 / 6 / 0 fail
  - arena-client: 66 / 66 / 0 fail
  - **Repo-wide: 536 / 0 fail** (matches WP baseline)
- **Post-execution expectation:** baseline **UNCHANGED** across every
  package. A single test delta — pass or fail — invalidates the subtractive
  guarantee and requires stop-and-escalate.
- **Test boundaries:** No test files may be created, modified, or deleted.

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

#### PS-1: README has three additional `cards.json` references outside WP-081 §F scope — BLOCKING until amended

**Finding:** Pre-flight grep (`grep -n "cards\.json" README.md`) returned
**five** matches, not the two addressed by WP-081 §F:

- Line 62: `#  1. scripts/normalize-cards.ts  → dist/cards.json` — in §F ✅
- Line 111: `The viewer fetches {dataBaseUrl}/data/{dataVersion}/cards.json ...` — **NOT in §F**
- Line 132: `data/1.0.0/cards.json, index.json, etc. → R2` — **NOT in §F**
- Line 204: `- [ ] dist/cards.json contains all normalized cards sorted by ID` — in §F ✅
- Line 207: `- [ ] Viewer loads cards.json and registry-health.json from R2 base URL` — **NOT in §F**

Lines 111, 132, 207 all describe pre-WP-003 behavior that was never
actually the runtime path after WP-003 landed — the viewer consumes
`metadata/sets.json` + `metadata/{abbr}.json` directly, not `cards.json`.

**Impact:** WP-081's post-review Acceptance Criterion "README.md does not
mention any precomputed registry JSON artifact other than
`dist/registry-health.json`" would **fail** against lines 111, 132, 207.
The executor would either:
- (a) correctly observe the AC failure and stop-and-escalate mid-session,
  forcing an amendment under time pressure, or
- (b) silently expand scope to fix the additional lines without
  governance authorization.

Neither outcome is acceptable. This is a classic "WP scope pre-validated
against ARCHITECTURE.md" pre-flight finding — the WP's stated Acceptance
Criterion is stricter than its Scope §F coverage.

**Resolution:** Amend WP-081 §Scope §F and the EC §Locked Values
"README.md regions edited" entry to extend to five anchor regions:

1. Pipeline diagram near the top of the file (currently lines 62-64)
2. Registry Config section — viewer-fetch sentence (currently line 111)
3. How to Upload to R2 section — upload listing (currently line 132)
4. Acceptance Checklist items (currently lines 204-205)
5. Definition of Done Checklist — viewer-loads item (currently line 207)

Keep the edits minimal and subtractive:
- Lines 62-64, 204-205, 207: delete the stale blocks / items
- Line 111: rewrite to reflect the actual runtime path (viewer fetches
  `metadata/sets.json` + per-set `metadata/{abbr}.json` from R2), since
  the section is titled "Registry Config" and the replacement must leave
  a coherent paragraph
- Line 132: rewrite the "Uploads:" listing to reflect that after WP-081
  lands, `upload-r2.ts` uploads only `registry-health.json` plus TypeScript
  artifacts (`.js` / `.d.ts`), not `cards.json` / `index.json`. The whole
  "How to Upload to R2" section may remain — only the listing changes

**Decision:** Amend WP-081 + EC-081 in the same SPEC bundle as this
pre-flight. The amendment is surgical and mechanical — no new contracts,
no new scope, only broader coverage of already-in-scope README hygiene.
After amendment, PS-1 is closed.

#### Risk 2: `upload-r2.ts` console.log at line 139 advertises `cards.json` (OOS confirmed)

- **Risk:** `packages/registry/scripts/upload-r2.ts:139` prints
  `Data: ${PUBLIC_URL}/data/${DATA_VERSION}/cards.json` at the end of a
  successful upload run. After WP-081 deletes the pipeline, `cards.json`
  will not exist, so this log line is a false claim.
- **Impact:** Low — operators running `pnpm upload` would see a
  misleading completion message, but no downstream consumer is harmed.
- **Mitigation:** Session-context-wp081.md §2.4 explicitly flags this as
  a follow-up WP candidate. WP-081 deliberately keeps `upload-r2.ts`
  untouched to preserve the subtractive-only guarantee and minimize
  blast radius.
- **Decision:** OOS for WP-081. Flag for a future WP that addresses
  the whole `upload-r2.ts` future (trim its scope, rename the upload
  directory layout, or delete the script entirely). Track via session
  context, not via WP-081 amendment.

#### Risk 3: Branch topology — main is behind `wp-064-log-replay-inspector`

- **Risk:** At pre-flight time, `main` is at `8d9f1c5` while the
  accumulated governance work (WP-034/035/042/055/079/080/081-draft) lives
  on `wp-064-log-replay-inspector` (currently at `efa5882`). Any executor
  branching off `main` for WP-081 will miss the WP-081 files themselves.
- **Impact:** Medium — a mis-branched executor would fail Step 0
  (session context loading) and early Pre-Session Gates.
- **Mitigation:** The execution session must branch off
  `wp-064-log-replay-inspector` (or whichever branch carries cumulative
  governance at execution time), not `main`. The EC-081 "Before Starting"
  section lists `Current branch: claude/<worktree> — NOT main`; this
  guard stands and is authoritative.
- **Decision:** Executor must verify `git log --oneline -5` shows
  `efa5882` (session-context bundle) or a descendant before starting.

#### Risk 4: README line-number drift between pre-flight and execution

- **Risk:** README.md may be edited between this pre-flight and
  WP-081 execution (e.g., by a concurrent WP or a manual tweak),
  shifting the cited line numbers.
- **Impact:** Low — line numbers are hedged with "currently" in both
  WP and EC per the post-review refinement pass. The anchor strings
  (`#  1. scripts/normalize-cards.ts`, `dist/cards.json contains...`,
  etc.) are locked; executor should use anchors, not line numbers.
- **Mitigation:** EC-081 §Locked Values explicitly states "use the
  anchor strings, not the line numbers, to locate the blocks during
  edit; line numbers are provided as a hint, not a lock." After the
  PS-1 amendment, this same hedge extends to the three new regions.
- **Decision:** No action. Hedge already in place.

#### Risk 5: Grep timing — concurrent edits between the final grep and the delete commit

- **Risk:** Between the final "verify no consumer of dead artifacts"
  grep and the delete commit, a concurrent doc or config edit could
  reintroduce a reference.
- **Impact:** Low — the session is single-threaded; concurrent edits
  would require external authorship.
- **Mitigation:** EC-081 §Guardrails (post-review refinement) now
  states "Perform the final grep checks immediately before the
  delete commit, not earlier in the session." This window is as
  small as the protocol allows.
- **Decision:** No action. Post-review refinement is sufficient.

All non-PS risks have mitigations. PS-1 is resolved in-place by the
amendment bundle committed alongside this pre-flight.

---

### Pre-Flight Verdict (Binary)

**✅ READY TO EXECUTE** — conditional on the PS-1 amendment bundle
committed alongside this pre-flight.

**Rationale:**

- **Sequencing:** WP-081's sole hard dependency (WP-003) is complete.
  No transitive upstream blockers.
- **Scope lock:** After the PS-1 amendment, WP-081 §F covers all five
  stale README regions, aligning with the post-review negative-guarantee
  Acceptance Criterion. No scope ambiguity remains.
- **Test baseline:** Verified at main checkout — engine 436 / 0 fail,
  repo-wide 536 / 0 fail, matching WP-081 baseline. Subtractive-only
  guarantee is testable.
- **Authority chain:** No conflicts. Authoritative-Lock note in WP
  §Non-Negotiable Constraints subordinates Scope §D–§F prose to the
  Locked Values block, preventing divergence.
- **Layer boundary:** WP-081 touches no `packages/registry/src/**` file.
  WP-003 immutable files remain untouched. Registry runtime path
  unchanged.
- **Risks:** Five reviewed. PS-1 is resolved in-place by this bundle.
  Risks 2-5 have locked mitigations; no new blockers remain.

---

### Authorized Next Step

> You are authorized to generate a **session execution prompt** for WP-081
> to be saved as:
> `docs/ai/invocations/session-wp081-registry-build-pipeline-cleanup.md`

**Guard:** The session prompt **must conform exactly** to the scope,
constraints, and decisions locked by this pre-flight and the amended
WP-081 / EC-081. No new scope may be introduced.

**Commit prefix at execution:** `EC-081:` (never `WP-081:` per P6-36).

---

### Final Instruction

Pre-flight exists to **prevent premature execution and scope drift**.

If there is uncertainty, missing context, or unresolved ambiguity:

**DO NOT PROCEED TO EXECUTION.**

Escalate, clarify, or split the WP instead.
