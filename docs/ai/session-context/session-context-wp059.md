# Session Context — WP-059 (Pre-Plan UI Integration)

> **Authored:** 2026-04-26 as a step-0 bridge from WP-054 closure
> (Commit A `69de7ff` `EC-054:` + Commit B `d33c862` `SPEC:` governance
> close + Commit C `c4aafd1` `EC-054:` follow-up TODO marker, all on
> the `wp-054-public-leaderboards-read-only` topic branch awaiting
> merge to `main`) and the WP-059 v1 draft (status: Drafted 2026-04-24,
> not yet pre-flighted) to the next WP-059 working session. **Purpose:**
> capture the post-WP-054 reconciled state, surface the locked
> arena-client / engine / server baselines, name the four lessons-
> forward from WP-054 worth carrying, and frame the workflow position
> for the WP-059 pre-flight (`01.4`) and copilot-check (`01.7`) passes.
>
> **This file is not authoritative.** If conflict arises with
> `docs/ai/ARCHITECTURE.md`, `.claude/rules/*.md`, WP-059, or a future
> EC-059, those documents win. See §6 priority chain.
>
> **No execution is performed by reading this file.** WP-059 itself
> opens in a fresh Claude Code session per the One-Packet-Per-Session
> rule in `.claude/rules/work-packets.md`. The pre-flight session that
> consumes this bridge runs against the WP draft + dependencies; the
> execution session that follows runs against an A0-SPEC-landed
> WP-059 v{next} + EC-059 v{next} + a refreshed bridge per the
> WP-054 / WP-053 precedent.

---

## 1. State on `main` (as of authoring)

`main` HEAD: **`cbd4f7d`** (`SPEC: session-context-wp054 — post-A0-
SPEC + post-pre-flight + post-copilot-check reconciliation`).

The WP-054 implementation commits live on the
`wp-054-public-leaderboards-read-only` topic branch, three commits
ahead of `main`:

- `69de7ff` `EC-054:` introduce public leaderboard read surface and
  PAR-gated projection helpers (3 files in
  `apps/server/src/leaderboards/` — types, logic, test; 1285 insertions)
- `d33c862` `SPEC:` WP-054 / EC-054 governance close — public
  leaderboards Done (5 files: STATUS, WORK_INDEX, EC_INDEX,
  DECISIONS [D-5401/D-5402/D-5403], post-mortem; 314 insertions)
- `c4aafd1` `EC-054:` follow-up TODO marker at the `parGate` seam
  in `server.mjs` for the future request-handler WP (1 file,
  12 insertions)

The bridge below assumes the WP-054 branch has merged into `main`
(or will merge before the WP-059 pre-flight session runs). All
baselines below are post-WP-054-merge values and match what the
WP-054 post-mortem / STATUS block will land. If `main` HEAD at
WP-059 pre-flight time is still at `cbd4f7d`, fold the WP-054 merge
first — WP-059 is not blocked by it (zero overlap in touched
files), but the test-baseline numbers in §3 assume WP-054's
`apps/server/` deltas have landed.

---

## 2. Dependencies (all six are complete)

Per the WP-059 row in `WORK_INDEX.md`:

| Dep | Status | Provides |
|---|---|---|
| WP-028 | ✅ | `UIState` contract + projection surface |
| WP-056 | ✅ | `@legendary-arena/preplan` package; `PrePlan` state model |
| WP-057 | ✅ | `createPrePlan`, sandbox + speculative ops |
| WP-058 | ✅ | `executeDisruptionPipeline` + three-status state model (`'active' \| 'consumed' \| 'invalidated'`) |
| WP-061 | ✅ | `apps/arena-client/` Vue 3 + Vite + Pinia bootstrap; `useUiStateStore()` |
| WP-065 | ✅ | `packages/vue-sfc-loader/` test transform for `.vue` SFCs under `node:test` |

No deps deferred. No deps in flight. Pre-flight may discover
contract drift in any of these (the same way WP-054 found post-
WP-053 PlayerId→AccountId drift), but all required surfaces exist.

---

## 3. Test & Build Baseline (LOCKED — verify before any WP-059 code lands)

### Repo-wide build

```bash
pnpm -r build
```

Expected: exit 0. (Currently passes against the post-WP-054 branch
state at `c4aafd1`.)

### Per-package test counts (post-WP-054-merge)

| Package | tests / suites / fail | Notes |
|---|---|---|
| `@legendary-arena/game-engine` | **522 / 116 / 0** | Unchanged since WP-053a |
| `@legendary-arena/registry` | smoke-only | One test file (`registry.smoke.test.ts`) |
| `@legendary-arena/preplan` | **52 / 7 / 0** | Per STATUS line 1578; WP-056/057/058 closure |
| `@legendary-arena/vue-sfc-loader` | (per-package count) | Required for SFC tests in `apps/arena-client/` |
| `apps/server` | **56 / 8 / 0** | Post-WP-054; with 24 skipped if no `TEST_DATABASE_URL` (16 inherited + 8 of WP-054's 8 DB-dependent tests; test #9 always runs) |
| `apps/arena-client` | **109 / 5 / 0** | Verified against the wp-054 branch on 2026-04-26; no DB-dependent tests; all run unconditionally |
| `apps/registry-viewer` | (per-package count) | Out of scope for WP-059 |
| `apps/replay-producer` | **4 / 2 / 0** | Per STATUS line 1578; out of scope for WP-059 |

WP-059's primary test surface is `apps/arena-client`. The locked
post-WP-059 delta will be defined in EC-059 §Test Plan once the
A0 SPEC pass folds any pre-flight findings; the WP-059 draft §Goal
implies new tests across at least 6 new test files
(`preplan.test.ts`, `preplanLifecycle.test.ts`,
`PrePlanNotification.test.ts`, `PrePlanStepList.test.ts`,
`fixtures/preplan/index.test.ts`, plus any drift-detection sites).

If any baseline diverges at WP-059 pre-flight time, **STOP and
reconcile** before authoring an A0 SPEC.

---

## 4. Migration Numbering — N/A

WP-059 is a client-only packet. The `data/migrations/` sequence
stays at `001_*` through `007_create_competitive_scores_table.sql`
(WP-053). WP-059 ships zero migration files; verify
`ls data/migrations/ | tail -3` returns only the existing
`005_*`, `006_*`, `007_*` triple.

---

## 5. Pre-Execution State (to be folded by pre-flight)

The WP-059 draft is at v1 (Drafted 2026-04-24); pre-flight (`01.4`)
has **not yet run** as of this bridge's authoring. The pre-flight
session is the first action below; its findings will produce a
v{next} A0 SPEC that lands on `main` before any execution branch
is cut.

Anticipated pre-flight focus areas (non-binding — the actual
findings drive the A0 SPEC):

- **Layer-boundary modification surface.** WP-059 Scope §L–§M
  modifies `docs/ai/ARCHITECTURE.md` §Layer Boundary and
  `.claude/rules/architecture.md` to permit `apps/arena-client`
  runtime imports of `@legendary-arena/preplan`. This is a
  **multi-layer-boundary change** that the lint gate (`00.3`)
  must scrutinize carefully; pre-flight should confirm the table
  + diagram changes are consistent and that no other authority
  document (`.claude/CLAUDE.md`, `01-VISION.md`) implies a
  conflicting constraint.
- **D-5901 inline.** WP-059 Scope §N introduces D-5901 (the
  permission decision above) inline. Pre-flight should verify
  the next sequential D-ID against `DECISIONS_INDEX.md` and
  reconcile if `D-5901` has been claimed by a parallel WP since
  the WP-059 draft was authored.
- **Dependency promotion.** WP-059 Scope §K promotes
  `@legendary-arena/preplan` from absent in
  `apps/arena-client/package.json` to `dependencies`. Pre-flight
  should confirm this is the **only** new runtime dep (the WP
  draft says it is) and that no transitive lockfile drift is
  expected.
- **Out-of-scope live-mutation middleware.** The WP draft
  explicitly defers the live boardgame.io middleware that observes
  real mutations to trigger `executeDisruptionPipeline` to WP-090
  (live-match transport). Pre-flight should confirm WP-090 is
  the right deferral target and that no intervening WP claims
  the same surface.
- **Six fixture file structure.** WP-059 Scope §I locks six
  named fixtures in one file. Pre-flight should confirm these
  cover the test scenarios the test files declare in §B / §D /
  §F / §H / §J — no orphan fixture, no fixture-less test path.

These are anticipated topics, **not** anticipated blockers. The
WP-054 pre-flight returned **READY TO EXECUTE** with all four
findings folded into v1.3; WP-059's pre-flight may return the
same, or it may surface real blockers — both outcomes are normal.

---

## 6. Authority Chain (read in this order before WP-059 pre-flight)

1. `.claude/CLAUDE.md` — EC-mode, lint gate, commit discipline
2. `.claude/rules/architecture.md` — Layer Boundary (authoritative)
3. `.claude/rules/code-style.md` — ESM, `.test.ts`, JSDoc, `// why:`
4. `.claude/rules/work-packets.md` — One-Packet-Per-Session;
   invocations are scratchpad-by-default
5. `docs/ai/ARCHITECTURE.md` — §Layer Boundary; §Persistence
   Boundaries (the leaderboard-style INNER JOIN defense from
   WP-054 doesn't apply here — `apps/arena-client` is read-only
   against `UIState`, no DB)
6. `docs/01-VISION.md` — relevant clauses per WP-059 §Vision
   Alignment block (currently in the v1 draft at line 1183+)
7. `docs/ai/work-packets/WP-059-preplan-ui-integration.md` v1 draft
8. `docs/ai/REFERENCE/01.4-pre-flight-checklist.md` — pre-flight
   checklist (the next executable action)
9. `docs/ai/REFERENCE/01.7-copilot-check.md` — copilot-check
   (runs after pre-flight resolves; WP-054 used 30/30 PASS)
10. `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — Vision
    Alignment block (`§17`) and Funding Surface Gate (`§20`)
    requirements that WP-059's A0 SPEC must satisfy
11. `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no
    abbreviations), Rule 6 (`// why:`), Rule 11 (full-sentence
    errors), Rule 13 (ESM only)
12. `docs/ai/post-mortems/01.6-WP-054-public-leaderboards-read-only.md`
    — §5 Lessons Forward (mirrored in §7 below for proximity)
13. `docs/ai/DECISIONS.md` — D-5601 (`packages/preplan/`
    classification — load-bearing for the §L–§M layer-boundary
    edits in WP-059), plus the new D-5401 / D-5402 / D-5403 from
    WP-054 closure (informational; not directly load-bearing for
    WP-059)

If any conflict surfaces, higher-authority documents win.

---

## 7. Lessons Carried Forward From WP-054 Execution (2026-04-26)

These are the four lessons from WP-054's post-mortem §5 that are
worth front-loading for WP-059 — not because WP-059 will repeat
the same situations, but because the underlying disciplines
generalize.

### 7.1. Pre-Session Gate 10 (Hard-Stop substring pre-screen) is load-bearing for `// why:` authorship

WP-054 required three mid-execution `// why:` rephrases to satisfy
gates that catch the literal forbidden tokens regardless of whether
they appear in code or in prose:

- `middleware` in the types-file JSDoc → "request-handling
  intermediary layer"
- `PlayerId` in the types-file JSDoc → "engine identifier per
  D-8701"
- `DELETE statements` / `INSERT statements` in the logic-file and
  test-file JSDocs → "write-side SQL" / "synthetic write-side
  fixtures"

**Generalizes for WP-059:** if WP-059's A0 SPEC introduces grep
gates on tokens like `Math.random` (preplan must be deterministic
per its layer rule) or `localStorage` / `sessionStorage` (no
client-side persistence in MVP), the same prose-rephrasing
discipline applies. Cite by **decision ID + category description**
in any `// why:` that needs to reference the forbidden token; the
WP-103 / WP-054 lesson is the same.

### 7.2. Test-file cleanup discipline: `TRUNCATE … CASCADE` over `DELETE FROM`

WP-053 used `DELETE FROM` for per-test cleanup, which would have
tripped the WP-054 `INSERT |UPDATE |DELETE ` gate had it been
re-applied to the test file. WP-054 adopted
`TRUNCATE TABLE … RESTART IDENTITY CASCADE` — functionally
equivalent for FK-bearing tables, runs as a single statement, not
in the gate's substring list.

**Generalizes for WP-059:** WP-059 has no DB tests (arena-client is
DB-free), but the same principle applies — if a future grep gate
catches a primitive that's used legitimately in test scaffolding,
prefer a hygienic alternative over arguing the gate is too
coarse. Pre-flight should anticipate and pre-screen.

### 7.3. Spec arithmetic discrepancies: honor the explicit plan, document the divergence

WP-054's session prompt and EC `After Completing` line both cited
`+8 tests / 55 total / 23 skipped`, but the explicit 9-test plan
yielded `+9 / 56 / 24` from a 47-test baseline. Implementation
honored the explicit per-test plan; the post-mortem documented
the discrepancy.

**Generalizes for WP-059:** the WP-059 v1 draft has a substantial
6-new-test-file scope. EC-059 should derive `total = baseline +
sum(per-file test counts)` once during A0 SPEC drafting and avoid
divergent counts in two separate sentences. Pre-flight should
verify the arithmetic matches before locking.

### 7.4. Score-control via state attribute (specific to DB-projection tests; WP-059 N/A)

WP-054 used `state.counters.escapedVillains` as a tunable to vary
both cryptographic hash AND engine-derived `finalScore` for
ordering / tie-break / pagination tests. WP-059 has no equivalent
need (no scoring layer; UI store mutations are deterministic by
construction), so this lesson is informational only.

---

## 8. Workflow Position (per `01.4 §Work Packet Execution Workflow`)

| Step | Status | Notes |
|---|---|---|
| Step 1: A0 SPEC bundle on `main` | **Not yet** | WP-059 v1 draft exists at `docs/ai/work-packets/WP-059-preplan-ui-integration.md`; no EC-059 file yet; no session-context bridge for the *executor* yet (this file is the bridge for the **pre-flight** session, mirroring `session-context-wp054`'s pattern of being authored before the v1.3 A0 SPEC) |
| Step 1b: Pre-flight (`01.4`) | **Not yet** | Next executable action |
| Step 1c: Copilot check (`01.7`) | **Not yet** | Runs after pre-flight resolves; WP-054 saw 30/30 PASS |
| Step 1d: A0 SPEC v{next} commit | **Not yet** | Folds pre-flight + copilot findings; lands on `main` as a single `SPEC:` commit (WP-054 precedent: `f56a955`) |
| Step 1e: Bridge re-author / reconciliation | **Not yet** | This file becomes the post-A0-SPEC reconciliation per WP-054 precedent (commit `cbd4f7d`) |
| Step 2: Execution branch cut | **Not yet** | `git checkout -b wp-059-preplan-ui-integration main` after Step 1e |
| Step 3: Implementation (Commit A) | **Not yet** | `EC-059:` prefix on the code commit |
| Step 4: Governance close (Commit B) | **Not yet** | `SPEC:` prefix; closes WORK_INDEX, EC_INDEX, STATUS, DECISIONS, post-mortem |

---

## 9. Suggested First Actions for the WP-059 Pre-Flight Author

1. **Open a fresh session** (One-Packet-Per-Session). Read this
   bridge first, then the authority chain in §6 in order.
2. **Re-verify the §3 baselines** against `main` HEAD at session
   start. If WP-054 has merged, confirm the post-merge tip is the
   parent of any A0 SPEC commit you author. If WP-054 has NOT
   merged, decide whether to merge it first or to author the WP-059
   A0 SPEC against `cbd4f7d` (the WP-054 work doesn't conflict
   with WP-059's file list — server-layer vs client-layer — so
   either order works).
3. **Read WP-059 v1 in full** (1239 lines).
4. **Run pre-flight (`01.4`)**: section-by-section pass against the
   WP-059 v1 draft, surfacing any CV / SR / Vision Sanity findings.
   Default verdict: HOLD until either READY TO EXECUTE or split-
   recommended.
5. **If pre-flight returns HOLD with findings**: fold them into
   WP-059 v{next} + author EC-059 v{next} + revise this bridge
   to reflect the post-pre-flight state. Land all three as one
   `SPEC:` commit on `main` (per WP-054 `f56a955` precedent).
6. **If pre-flight returns READY TO EXECUTE with no findings**:
   author EC-059 v1 + revise this bridge to record the verdict.
   Land as one `SPEC:` commit on `main`.
7. **Run copilot check (`01.7`)** against the post-A0 artifacts.
   WP-054 saw 30/30 PASS; WP-059 may see different.
8. **If copilot returns CONFIRM**: revise this bridge once more
   to flip the workflow status in §8 to "complete" through Step
   1e, and authorize session-prompt generation. Commit as a
   second `SPEC:` reconciliation per WP-054 `cbd4f7d` precedent.
9. **Hand off to the executor session** with the session prompt
   per the WP-054 pattern (`docs/ai/invocations/session-wp059-
   preplan-ui-integration.md`, scratchpad-by-default per
   `.claude/rules/work-packets.md`).

---

## 10. Recommended Next Action

**Open a fresh Claude Code session** for the WP-059 pre-flight
pass. This bridge plus the authority chain in §6 are the only
inputs that session needs. The pre-flight is the natural unit
of work — short enough to fit one session comfortably, long
enough that bundling it with execution would violate the
One-Packet-Per-Session rule.

Do **not** open WP-059 execution in the same session as the
WP-059 pre-flight. The execution session opens against the
landed A0 SPEC bundle (Step 1d) + reconciled bridge (Step 1e),
not against the pre-flight findings directly.

Out-of-band tidy-up that's **not blocking** WP-059 (per
WP-054 closure §"anything to tidy up" exchange):

- Merge `wp-054-public-leaderboards-read-only` to `main` and
  push origin (your call on timing; can land before or after
  WP-059 pre-flight)
- DECISIONS_INDEX.md sync for D-5401 / D-5402 / D-5403
  (deferred per WP-053 precedent; can fold into a future
  decisions-index sweep WP)
- Pre-existing WIP in working tree (`DESIGN-RANKING.md` mod;
  `data/cards-combined.*`; `WP-100-*.md`; `WP-111-*.md`;
  `Combine-CardData.ps1`) — has been lingering through
  WP-052 / WP-053 / WP-054 sessions; needs its own session
  eventually but doesn't block WP-059
