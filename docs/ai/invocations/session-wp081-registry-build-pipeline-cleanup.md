# Session Prompt — WP-081 Registry Build Pipeline Cleanup

**Work Packet:** [docs/ai/work-packets/WP-081-registry-build-pipeline-cleanup.md](../work-packets/WP-081-registry-build-pipeline-cleanup.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-081-registry-build-pipeline-cleanup.checklist.md](../execution-checklists/EC-081-registry-build-pipeline-cleanup.checklist.md)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp081.md](../session-context/session-context-wp081.md)
**Pre-flight (+ 01.7 Copilot Check):** [docs/ai/invocations/preflight-wp081-registry-build-pipeline-cleanup.md](preflight-wp081-registry-build-pipeline-cleanup.md) — READY TO EXECUTE (PS-1 resolved in pre-flight; 01.7 verdict CONFIRM with 29/30 PASS and one RISK on #12 resolved scope-neutrally in the copilot-check SPEC bundle).
**Commit prefix:** `EC-081:` on every code- or doc-changing commit in the WP-081 allowlist; `SPEC:` on governance-only commits outside the allowlist (STATUS.md / WORK_INDEX.md / EC_INDEX.md close). `WP-081:` is **forbidden** (commit-msg hook rejects per P6-36).
**WP Class:** Documentation + Hygiene (subtractive — no new code, no new tests, no new dependencies, no version bump). Closest to Contract-Only in the 01.4 taxonomy.
**Primary layer:** Registry / Build Tooling — deletes three broken operator scripts; trims `packages/registry/package.json`; deletes one step from `.github/workflows/ci.yml`; rewrites five stale regions of `README.md` plus deletes the "How to Standardize Images" section (six anchor regions total after PS-2 pre-execution resolution).

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-081:` on every file-changing commit in the WP-081 allowlist; `SPEC:` on governance close commits. `WP-081:` is forbidden — the commit-msg hook rejects it per P6-36.

2. **Pre-flight + copilot check committed.** Run `git log --oneline -8` and confirm `e592cc4` (draft) + `4a73a59` (refinements) + `efa5882` (session-context) + `9efe41f` (pre-flight) + `06125e9` (01.7 copilot check) are all present as ancestors of the current HEAD. The 01.7 CONFIRM depends on the scope-neutral FIX in `06125e9` (WP §Scope (Out) `.env.example` bullet + session-context §2.6). If any is missing, STOP — execution is blocked on governance.

3. **Baseline green at session base commit.** Run `pnpm -r test`. Expect repo-wide **536 passing / 0 failing** (registry 13 + vue-sfc-loader 11 + game-engine 436 + replay-producer 4 + server 6 + arena-client 66). Engine baseline = **436 / 109 suites / 0 fail**. If the repo baseline diverges, STOP and reconcile against `WORK_INDEX.md`.

4. **Registry build is currently broken — that is the motivating condition.** Do NOT treat `pnpm --filter @legendary-arena/registry build` failing as a blocker at session start. The build failure (`dist/cards.json not found — run 'pnpm normalize' first`) is WP-081's reason for existing and is resolved by the deletions themselves.

5. **Working-tree hygiene.** `git status --short` will show inherited dirty-tree files from other in-flight sessions (`M session-wp079-*.md`; possibly `M DECISIONS.md`, `M DECISIONS_INDEX.md`, `M 02-CODE-CATEGORIES.md`, `M EC_INDEX.md` from WP-056 in-flight work; untracked `??` files from prior sessions). **None of these are in WP-081 scope.** Stage by name only; never `git add .` or `git add -A` (P6-27 / P6-44 / P6-50 discipline).

6. **Branch discipline.** Execution should happen on a branch rooted in the commit chain that carries the WP-081 governance bundle. Recommend branching off whatever carries `311c8fe` (the merge that brings 01.7 into `wp-064-log-replay-inspector`) or a descendant. Suggested branch name: `wp-081-registry-build-pipeline-cleanup`. Do NOT branch off `main` — `main` is behind this governance work.

7. **Schema reality check.** Grep `packages/registry/src/schema.ts` for `CardSchema|CardIDSchema|CANONICAL_ID_REGEX|CardTypeSchema`. Expected: **zero matches** (substring hits on `HeroCardSchema` / `MastermindCardSchema` / `VillainCardSchema` are unrelated — the grep should look for these as whole words or via negative filtering). If any of the four target symbols exists as an actual export, STOP — the deleted scripts are no longer dead code.

If any gate is unresolved, STOP.

---

## Copilot Check (01.7) — COMPLETED, VERDICT: CONFIRM

Per [docs/ai/REFERENCE/01.7-copilot-check.md](../REFERENCE/01.7-copilot-check.md). WP-081 is **Documentation + Hygiene class**, for which 01.7 is *recommended but optional*. Run anyway; see the appended block in the pre-flight file for full 30-issue scan.

**Summary:** 29 PASS, 1 RISK, 0 BLOCK. The one RISK (Issue #12 Scope Creep / Under-scoping — `packages/registry/.env.example` lines 13-17 orphaned after the deletions) was resolved in-place with a **scope-neutral FIX** in the 01.7 commit `06125e9`:

- WP-081 §Scope (Out) gained an explicit `.env.example` OOS bullet (scope-clarifying — the file was never in the allowlist).
- `session-context-wp081.md` §2.6 documents the orphan + the follow-up-WP instruction to delete lines 13-17 together with a future `upload-r2.ts` cleanup.

**Disposition: CONFIRM.** No remediation blocks execution. Pre-flight READY TO EXECUTE verdict stands.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause. WP-081 is purely subtractive documentation + hygiene work. Each of the four 01.5 trigger criteria is **absent**:

| 01.5 Trigger Criterion | Applies to WP-081? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | No types added; no code added. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | No setup orchestrator touched. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move added. Engine baseline **436 / 109 / 0 fail** must hold unchanged. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook added. |

**Conclusion:** 01.5 is **NOT INVOKED**. The scope lock in §Files Expected to Change (below) applies without the allowance. Any file beyond that allowlist is a scope violation per **P6-27**, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it.

Per 01.5 §Escalation: *"It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."* If an unanticipated structural break appears mid-execution, STOP and escalate.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/registry.md](../../../.claude/rules/registry.md) — Schema Authority; WP-003 immutable files (`schema.ts`, `shared.ts`, `impl/localRegistry.ts`); "no game logic in the registry package"
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — naming discipline, full-sentence error messages (none expected since no new code)
4. [.claude/rules/work-packets.md](../../../.claude/rules/work-packets.md) — one packet per session, scope lock, dependency discipline
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Registry Layer (Data Input) + §Layer Boundary (Authoritative) — registry is a data-input layer only; runtime path is `metadata/sets.json` + `metadata/{abbr}.json` from R2
6. [docs/ai/execution-checklists/EC-081-registry-build-pipeline-cleanup.checklist.md](../execution-checklists/EC-081-registry-build-pipeline-cleanup.checklist.md) — primary execution authority (Locked Values + Guardrails + Files to Produce)
7. [docs/ai/work-packets/WP-081-registry-build-pipeline-cleanup.md](../work-packets/WP-081-registry-build-pipeline-cleanup.md) — authoritative WP specification (as amended 2026-04-20 for PS-1 README scope extension + 01.7 `.env.example` OOS bullet)
8. [docs/ai/session-context/session-context-wp081.md](../session-context/session-context-wp081.md) — grep baseline, mid-session findings (§2.1–§2.6), pre-flight open questions (§3), branch/commit topology (§4)
9. [docs/ai/invocations/preflight-wp081-registry-build-pipeline-cleanup.md](preflight-wp081-registry-build-pipeline-cleanup.md) — pre-flight report + 01.7 copilot check appended
10. [docs/ai/post-mortems/01.6-WP-055-theme-data-model.md](../post-mortems/01.6-WP-055-theme-data-model.md) §8 item 3 — original discovery anchor for the dead pipeline issue
11. [docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md) — `EC-###:` commit format, hook interaction
12. [packages/registry/src/schema.ts](../../../packages/registry/src/schema.ts) — current schema (read the top comment block to confirm none of `CardSchema` / `CardIDSchema` / `CANONICAL_ID_REGEX` / `CardTypeSchema` exists as a real export)
13. [packages/registry/scripts/validate.ts](../../../packages/registry/scripts/validate.ts) — remains in scope as the single registry validation step (D-8102 to be registered during execution)
14. [packages/registry/scripts/upload-r2.ts](../../../packages/registry/scripts/upload-r2.ts) — remains OOS; do NOT modify (see session-context §2.4)

If any conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, Legendary Arena's registry build pipeline is tsc-only and CI passes end-to-end. Specifically:

1. The three broken scripts are **deleted**: `packages/registry/scripts/normalize-cards.ts`, `build-dist.mjs`, `standardize-images.ts`.
2. `packages/registry/package.json` `scripts.build` is exactly `"tsc -p tsconfig.build.json"`. The `normalize` and `standardize-img` script entries are gone. `test`, `validate`, `upload`, `prepublishOnly` are unchanged.
3. `.github/workflows/ci.yml` job `build` no longer contains the "Normalize cards" step (the redundant `pnpm registry:validate` invocation with the misleading `# also writes cards.json + index.json` comment). The `validate`, `build-viewer`, `upload-r2`, `publish-npm` jobs are textually unchanged.
4. `README.md` has six anchor regions rewritten per WP-081 §Scope (In) §F.1 through §F.6 (extended from five per PS-2 pre-execution resolution, 2026-04-20 — see session-context §2.7). After the edits, `README.md` does not mention any precomputed registry JSON artifact other than `dist/registry-health.json`.
5. `pnpm --filter @legendary-arena/registry build` exits 0 on a clean `dist/` (verified after `rm -rf packages/registry/dist` first).
6. `pnpm -r build` exits 0.
7. `pnpm test` exits 0 with **engine 436 / 109 / 0 fail** and **repo-wide 536 / 0 fail** — both **UNCHANGED** from baseline.
8. `D-8101` and `D-8102` are registered in `docs/ai/DECISIONS.md` per WP-081 §Governance.
9. `docs/ai/STATUS.md` carries an entry with the verbatim phrase `Registry build is tsc-only; no normalize/dist pipeline remains.` plus D-8101 + D-8102 notes.
10. `docs/ai/work-packets/WORK_INDEX.md` WP-081 row is flipped from Draft to Done (date + commit hash).
11. `docs/ai/execution-checklists/EC_INDEX.md` EC-081 row is flipped from Draft to Done; Summary counts adjusted.

**Zero** engine changes. **Zero** server changes. **Zero** client changes. **Zero** new tests. **Zero** new dependencies. **Zero** new scripts. **Zero** changes to `packages/registry/src/**`. **Zero** changes to `packages/registry/scripts/validate.ts` or `upload-r2.ts`. **Zero** changes to `.env.example`. **Zero** `pnpm-lock.yaml` diff. `version` in `packages/registry/package.json` unchanged.

---

## Locked Values (Do Not Re-Derive)

### Commit topology (two commits)

- **Commit A (`EC-081:`)** — execution: delete three scripts + modify three files (`package.json`, `ci.yml`, `README.md`) + add D-8101 and D-8102 to `docs/ai/DECISIONS.md` (plus `DECISIONS_INDEX.md` rows if the index convention requires them — check at execution). Optional 01.6 post-mortem if the executor judges one useful; per 01.6 triggers, WP-081 adds no long-lived abstraction or new code category, so post-mortem is **optional** (WP-079 precedent: doc-only / subtractive WPs may skip).
- **Commit B (`SPEC:`)** — governance close: `STATUS.md` entry with the verbatim tsc-only phrase + `WORK_INDEX.md` (WP-081 `[x]` with date + commit hash) + `EC_INDEX.md` (EC-081 flipped to Done, Summary counts bumped) + any `DECISIONS_INDEX.md` follow-ups surfaced during execution.

### Files to delete (exactly 3)

- `packages/registry/scripts/normalize-cards.ts`
- `packages/registry/scripts/build-dist.mjs`
- `packages/registry/scripts/standardize-images.ts`

No other file under `packages/registry/scripts/` is deleted. `validate.ts` and `upload-r2.ts` remain.

### Files to modify (exactly 3)

- `packages/registry/package.json` — `scripts.build` trimmed to `"tsc -p tsconfig.build.json"`; `scripts.normalize` and `scripts.standardize-img` removed. No other key touched.
- `.github/workflows/ci.yml` — "Normalize cards" step deleted from the `build` job. No other job, step, trigger, artifact name, or env passthrough changed.
- `README.md` — six anchor regions edited per WP-081 §Scope (In) §F.1 through §F.6. Use the anchor strings, not the line numbers, to locate each block.

### Governance files to touch (during the Commit A and Commit B edits)

- `docs/ai/DECISIONS.md` — add **D-8101** and **D-8102** per WP-081 §Governance (in Commit A).
- `docs/ai/DECISIONS_INDEX.md` — add index rows for D-8101 and D-8102 (in Commit A) if the convention requires them.
- `docs/ai/STATUS.md` — append the new WP-081 close entry in Commit B with the verbatim phrase from WP-081 §Definition of Done.
- `docs/ai/work-packets/WORK_INDEX.md` — flip WP-081 row to Done with date + commit A's hash, in Commit B.
- `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-081 row to Done, bump Draft/Done/Total counts, in Commit B.

### Test baseline (UNCHANGED — enforced as binary AC)

- registry: **13 / 13 / 0 fail**
- vue-sfc-loader: **11 / 11 / 0 fail**
- game-engine: **436 / 436 / 0 fail**, **109 suites**
- replay-producer: **4 / 4 / 0 fail**
- server: **6 / 6 / 0 fail**
- arena-client: **66 / 66 / 0 fail**
- **Repo-wide: 536 / 0 fail**

A delta of even one test (pass or fail) invalidates the subtractive guarantee — STOP and escalate.

### Grep-timing rule (EC §Guardrails)

The final `grep -rn "dist/cards\.json\|dist/keywords\.json\|dist/registry-info\.json" apps/ packages/ scripts/ data/ .github/` and `grep -rn "normalize-cards\|build-dist\|standardize-images" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.claude` must be run **immediately before the delete commit**, not earlier in the session. This prevents a mid-session edit from silently reintroducing a reference between the check and the deletion.

---

## Non-Negotiable Constraints (Inherited)

All items from WP-081 §Non-Negotiable Constraints apply. Non-exhaustive highlights:

- **Subtractive only** — no new `.ts` / `.mjs` files, no new tests, no new dependencies, no renames, no version bump.
- **`packages/registry/src/**` must not change** (`git diff --stat packages/registry/src/` is empty).
- **WP-003 immutable files untouched:** `schema.ts`, `shared.ts`, `impl/localRegistry.ts`.
- **`validate.ts` and `upload-r2.ts` out of scope** for any modification.
- **`.env.example` out of scope** (01.7 RISK resolution; see WP-081 §Scope (Out) and session-context §2.6).
- **CI edit confined** to deleting one step in the `build` job; no other job, trigger, artifact name, or env passthrough changes.
- **If grep reveals a hidden consumer** of the deleted JSON artifacts, **STOP and ask** — do not silently expand scope to a rewrite.
- **No `--amend`** on a published commit; create a new commit if a hook fails.

---

## Files Expected to Change (Strict Allowlist)

**Commit A (`EC-081:`) — execution:**

1. `packages/registry/scripts/normalize-cards.ts` — **deleted**
2. `packages/registry/scripts/build-dist.mjs` — **deleted**
3. `packages/registry/scripts/standardize-images.ts` — **deleted**
4. `packages/registry/package.json` — **modified** (scripts.build / scripts.normalize / scripts.standardize-img only)
5. `.github/workflows/ci.yml` — **modified** (delete "Normalize cards" step in `build` job only)
6. `README.md` — **modified** (six anchor regions per §F.1–§F.6)
7. `docs/ai/DECISIONS.md` — **modified** (add D-8101 and D-8102 entries)
8. `docs/ai/DECISIONS_INDEX.md` — **modified** (if convention requires; add D-8101 / D-8102 index rows)
9. `docs/ai/post-mortems/01.6-WP-081-*.md` — **optional, new** if the executor chooses to author a post-mortem (not required for doc-only / subtractive WPs).

**Commit B (`SPEC:`) — governance close:**

10. `docs/ai/STATUS.md` — **modified** (append close entry)
11. `docs/ai/work-packets/WORK_INDEX.md` — **modified** (flip WP-081 to Done)
12. `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (flip EC-081 to Done; bump counts)

**No other file may be added, modified, or deleted.** `git diff --name-only` is a required verification step (see below).

---

## Verification Steps (Exact Commands, Expected Outputs)

Copy verbatim from WP-081 §Verification Steps. Summary here:

```bash
# Step 1 — confirm baseline green path (BEFORE any edits)
pnpm test
# Expected: exits 0; engine 436 / 109 / 0 fail; repo-wide 536 / 0 fail

# Step 2 — clean dist and run the registry build (AFTER edits)
rm -rf packages/registry/dist
pnpm --filter @legendary-arena/registry build
# Expected: exits 0; packages/registry/dist/ contains *.js, *.d.ts

# Step 3 — run the whole monorepo build (AFTER edits)
pnpm -r build
# Expected: exits 0

# Step 4 — confirm the deleted scripts are gone (AFTER edits)
ls packages/registry/scripts
# Expected: validate.ts  upload-r2.ts

# Step 5 — confirm no README or code reference to the deleted pipeline (AFTER edits)
grep -rn "normalize-cards\|build-dist\|standardize-images" . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  --exclude-dir=.claude
# Expected: matches only inside docs/ai/work-packets/WP-081-*,
#           docs/ai/execution-checklists/EC-081-*,
#           docs/ai/invocations/{preflight,session}-wp081-*,
#           docs/ai/session-context/session-context-wp081.md,
#           docs/ai/DECISIONS.md (D-8101 / D-8102 entries),
#           docs/ai/STATUS.md,
#           docs/ai/post-mortems/01.6-WP-055-*.md (historical mention),
#           docs/ai/post-mortems/01.6-WP-081-*.md (if authored)

# Step 6 — confirm no consumer code references the deleted JSON artifacts (AFTER edits)
grep -rn "dist/cards\.json\|dist/keywords\.json\|dist/registry-info\.json" \
  apps/ packages/ scripts/ data/ .github/
# Expected: no output

# Step 7 — confirm README negative-guarantee AC
grep -n "cards\.json\|index\.json\|keywords\.json" README.md
# Expected: zero matches (or matches only inside `{abbr}.json` / `metadata/{abbr}.json` R2 runtime-path examples written by §F.2)

# Step 8 — confirm scope enforcement (AFTER Commit A is staged, BEFORE commit)
git diff --name-only
git diff --name-only --diff-filter=D
# Expected: exactly the files in ## Files Expected to Change — Commit A

# Step 9 — confirm registry runtime untouched
git diff --stat packages/registry/src/
# Expected: empty

# Step 10 — confirm pnpm-lock.yaml unchanged
git diff pnpm-lock.yaml
# Expected: empty
```

If any step produces unexpected output, STOP and diagnose before proceeding.

---

## Definition of Done (Binary)

All items from [WP-081 §Definition of Done](../work-packets/WP-081-registry-build-pipeline-cleanup.md#definition-of-done) must be checked. Non-exhaustive highlights:

- All acceptance criteria pass.
- `pnpm -r build` exits 0.
- `pnpm --filter @legendary-arena/registry build` exits 0 on a clean `dist/`.
- `pnpm test` exits 0 with engine `436 / 109 / 0 fail` and repo-wide `536 / 0 fail` unchanged.
- Three scripts deleted; three files modified per scope.
- No files outside the §Files Expected to Change allowlist were modified or deleted.
- `packages/registry/src/**` unchanged.
- `docs/ai/STATUS.md` entry contains the verbatim phrase `Registry build is tsc-only; no normalize/dist pipeline remains.`
- `docs/ai/DECISIONS.md` contains D-8101 and D-8102.
- `docs/ai/work-packets/WORK_INDEX.md` WP-081 row flipped to Done with date + commit A's hash.
- `docs/ai/execution-checklists/EC_INDEX.md` EC-081 row flipped to Done with counts updated.

---

## Session Protocol Reminders

- **If a grep reveals a hidden consumer** of the deleted JSON artifacts, STOP and ask — do not silently expand scope.
- **If any test count shifts**, STOP — the subtractive guarantee is broken; diagnose before proceeding.
- **If `git diff --name-only` shows a file outside the allowlist**, STOP — it's a scope violation per P6-27, not a minor deviation.
- **Perform the final greps immediately before the delete commit**, not earlier in the session (EC §Guardrails rule).
- **Do not `--amend`** a published commit. If a commit-msg hook fails, fix the issue and create a **new** commit.
- **Do not run `git add .`** or `git add -A`. Stage by name (P6-27 / P6-44 / P6-50 discipline).
- **`.env.example` is explicitly OOS.** If tempted to clean up lines 13-17 "while I'm here," STOP — that is a follow-up WP (session-context §2.6).
- **`upload-r2.ts` is explicitly OOS.** Same reasoning (session-context §2.4).

---

## Authorized Next Step

You are authorized to execute WP-081 in a **new Claude Code session** reading this prompt as the single execution brief. At the end of that session:

1. **Commit A** (`EC-081:` prefix) lands the six allowlist file changes + D-8101 + D-8102 + optional post-mortem.
2. **Commit B** (`SPEC:` prefix) lands the governance close (STATUS.md + WORK_INDEX.md + EC_INDEX.md + DECISIONS_INDEX.md if applicable).
3. Both commits live on the execution branch off `311c8fe` or a descendant.

After Commit B, `pnpm --filter @legendary-arena/registry build` exits 0 for the first time since WP-003 landed, and the registry build pipeline is tsc-only as locked by D-8101 and D-8102.

**Guard:** execution must conform exactly to the scope, constraints, and decisions locked by this session prompt + the pre-flight + the copilot check + WP-081 + EC-081. No new scope may be introduced.
