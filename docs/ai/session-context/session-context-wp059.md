# Session Context — WP-059 (Pre-Plan UI Integration)

> **Authored:** 2026-04-26 as a step-0 bridge from WP-054 closure to
> the WP-059 pre-flight session.
>
> **Reconciled:** 2026-04-26 (this revision) after WP-059 v1 pre-flight
> returned **NOT READY** with six contract-drift findings (CV-1..CV-6),
> the v2 spec rewrite resolved all findings (PS-1..PS-5), pre-flight v2
> returned **READY TO EXECUTE**, and copilot check v2 returned
> **CONFIRM**. This file is the post-A0-SPEC reconciliation per WP-054
> precedent (commit `cbd4f7d`).
>
> **Purpose (v2):** capture the post-pre-flight reconciled state for
> the WP-059 *execution* session. Surface the six contract drifts that
> were caught before code existed, the v2 spec hardenings, and the
> five lessons forward (four from WP-054 + one new from the v1→v2
> cycle) that the executor should carry into implementation.
>
> **This file is not authoritative.** If conflict arises with
> `docs/ai/ARCHITECTURE.md`, `.claude/rules/*.md`, WP-059 v2, or
> EC-059 v2, those documents win. See §6 priority chain.
>
> **No execution is performed by reading this file.** WP-059 itself
> opens in a fresh Claude Code session per the One-Packet-Per-Session
> rule in `.claude/rules/work-packets.md`. The execution session that
> consumes this bridge runs against the landed WP-059 v2 + EC-059 v2
> + this reconciled bridge.

---

## 1. State on `main` (post-WP-059-v2-SPEC-bundle landing)

`main` HEAD at the moment this reconciliation was authored:
**`e6d2f64`** (`SPEC: session-context-wp059 — bridge from WP-054
closure to WP-059 pre-flight`).

The WP-054 implementation commits live on the
`wp-054-public-leaderboards-read-only` topic branch, three commits
ahead of `main` (unchanged from v1 of this bridge):

- `69de7ff` `EC-054:` — leaderboard read surface + PAR-gated helpers
- `d33c862` `SPEC:` — WP-054 / EC-054 governance close
- `c4aafd1` `EC-054:` — follow-up TODO marker at parGate seam

**WP-059 v2 SPEC-bundle:** lands as a single `SPEC:` commit on a
new branch `wp-059-spec-bundle-v2` cut from `main`, parallel to the
WP-054 branch (zero overlap — server-layer vs client-docs). Either
order of merge is safe per the WP-054 / WP-059 file-list disjointness
noted in §10.

The bundle contains exactly three modified/created files:
- `docs/ai/work-packets/WP-059-preplan-ui-integration.md` — v2
  rewrite (CV-1..CV-6 fixes + PS-2 revision-preservation + PS-3
  fixture-field locks)
- `docs/ai/execution-checklists/EC-059-preplan-ui-integration.checklist.md`
  — v2 lockstep updates (status order, fixture names, runtime symbol
  inventory, three new field-name locks, test-count 32→34)
- `docs/ai/session-context/session-context-wp059.md` — this
  reconciliation pass

The four invocation scratchpad files
(`preflight-wp059-…`, `preflight-wp059-…-v2`, `copilot-wp059-…`,
`copilot-wp059-…-v2` under `docs/ai/invocations/`) are gitignored
per `.claude/rules/work-packets.md` and remain in the working tree
as audit artifacts; they do not enter the SPEC commit.

---

## 2. Dependencies (all six are complete)

Unchanged from v1 of this bridge. All six dependencies (WP-028,
WP-056, WP-057, WP-058, WP-061, WP-065) are complete; no deps
deferred or in flight.

The v1 pre-flight discovered six contract drifts in WP-059's text
against actual exports from `@legendary-arena/preplan` — but the
package itself is fully landed and correct. The drifts were entirely
in the WP draft; the v2 rewrite aligned the WP to the actual
package exports verified against `packages/preplan/src/*`.

---

## 3. Test & Build Baseline (LOCKED — verify before any WP-059 code lands)

Unchanged from v1 of this bridge:

| Package | tests / suites / fail | Notes |
|---|---|---|
| `@legendary-arena/game-engine` | 522 / 116 / 0 | Unchanged since WP-053a |
| `@legendary-arena/registry` | smoke-only | One test file |
| `@legendary-arena/preplan` | 52 / 7 / 0 | WP-056/057/058 closure |
| `@legendary-arena/vue-sfc-loader` | (per-package count) | Required for SFC tests |
| `apps/server` | 56 / 8 / 0 | 24 skipped if no `TEST_DATABASE_URL` |
| `apps/arena-client` | 109 / 5 / 0 | Verified against the wp-054 branch on 2026-04-26 |
| `apps/registry-viewer` | (per-package count) | Out of scope for WP-059 |
| `apps/replay-producer` | 4 / 2 / 0 | Out of scope for WP-059 |

**Locked post-WP-059 v2 delta:** **+34 new arena-client tests**
(13 store + 7 lifecycle + 5 notification + 6 step-list + 3 drift),
distributed across **5 new test files**. Post-execution arena-client
total: **143 / 10 / 0**. Per EC-059 §After Completing strict
arithmetic: `POST_ARENA_CLIENT_COUNT - PRE_ARENA_CLIENT_COUNT === 34`
and `POST_COUNT - PRE_COUNT === 34`. Five separate sites in WP + EC
agree on 34 — the v1 had 32, raised to 34 when §J was expanded from
1 to 3 drift tests during the v2 rewrite (per Copilot Issue 27 RISK
fix).

If any baseline diverges at WP-059 execution time, **STOP and
reconcile** before authoring code.

---

## 4. Migration Numbering — N/A

Unchanged. WP-059 is client-only; ships zero migration files.

---

## 5. Pre-Execution State (POST-A0-SPEC v2)

The WP-059 draft is at **v2** as of this reconciliation. The
pre-flight + copilot bundle has run twice:

**v1 cycle (BLOCKING outcome):**
- Pre-flight v1 returned **NOT READY** with six contract drifts:
  - **CV-1**: `createPrePlan` arity mismatch (WP said 2 params; actual 3)
  - **CV-2**: `invalidatePrePlan` signature wrong + return-type wrong
  - **CV-3**: `DisruptionNotification` shape wrong (`cause`/`targetCard` don't exist)
  - **CV-4**: `DisruptionPipelineResult` shape wrong (no `isValid`/`restoration`)
  - **CV-5**: `PrePlan.createdAtTurn` doesn't exist (canonical field is `appliesToTurn`)
  - **CV-6**: `PREPLAN_STATUS_VALUES` order wrong (canonical is `active|invalidated|consumed`)
- Copilot v1 returned **SUSPEND** (25 PASS / 4 RISK / 1 BLOCK; the
  BLOCK was Issue 4 Contract Drift, mirroring CV-1..CV-5)
- Five PS items authored: PS-1 (CV-1..CV-6 lockstep fixes), PS-2
  (revision-preservation), PS-3 (fixture-field locks), PS-4 (status
  order verification), PS-5 (re-run pre-flight)

**v2 cycle (READY outcome):**
- All five PS items resolved against the actual source files
  (`packages/preplan/src/preplanSandbox.ts:37-41`,
  `disruptionPipeline.ts:34-37`, `disruption.types.ts:57-126`,
  `preplan.types.ts:29-228`, `preplanStatus.ts:15`)
- Pre-flight v2 returned **READY TO EXECUTE** — all CV findings
  verified resolved against actual source; no new findings
- Copilot v2 returned **CONFIRM** — 29 PASS / 1 RISK / 0 BLOCK; the
  one remaining RISK (Issue 5, `exactOptionalPropertyTypes`) is
  acceptably deferred to executor discipline because v2 §I's
  contrasting fixture pair forces the conditional-assignment idiom
  by example
- Session prompt generation **authorized**

**v1 → v2 spec changes (executor must internalize before coding):**

The v2 spec differs from v1 in these load-bearing ways:

1. **`startPrePlanForActiveViewer` signature** now takes
   `{ snapshot, prePlanId, prngSeed, store }` — three positional
   forwards into `createPrePlan(snapshot, prePlanId, prngSeed)`. The
   v1 `PrePlanContext` type was dropped; v2 has no
   `PrePlanContext` symbol.
2. **`recordDisruption(result)` reads `result.invalidatedPlan`
   directly** when `current.status === 'active'`. Does NOT call
   `invalidatePrePlan` itself. The store's job is assignment, not
   transformation. The new `// why:` block in §A explains why
   double-invalidation is wrong.
3. **`<PrePlanNotification />` template** renders `message`,
   `sourcePlayerId` attribution, and (conditionally)
   `affectedCardExtId` — NOT `cause` and `targetCard` (which are
   fictional fields).
4. **`PrePlan` field references** use `appliesToTurn` (not
   `createdAtTurn`) and require `prePlanId` in the deep-equal
   field list of test §B #4.
5. **`PREPLAN_STATUS_VALUES` order** is `'active', 'invalidated',
   'consumed'` — NOT the v1 `'active', 'consumed', 'invalidated'`.
   Affects the §J drift test fixture key order.
6. **`§I` fixture set** is six fixtures: `activePrePlanFixture`,
   `consumedPrePlanFixture`, `invalidatedPrePlanFixture`,
   `sampleDisruptionResultFixture`,
   `sampleDisruptionResultWithCardFixture`,
   `samplePlayerStateSnapshotFixture`. The v1
   `samplePrePlanContextFixture` is gone (no `PrePlanContext`
   type). The new `WithCard` variant exercises the optional
   `affectedCardExtId` render path.
7. **`§J` drift test file** has 3 tests now (was 1):
   `PREPLAN_STATUS_VALUES` shape + `DisruptionNotification`
   field-set in two variants (no-card, with-card).
8. **`§D` compile-time drift sentinel** is rewritten as a
   bidirectional tuple-equality `extends` proof against
   `Parameters<typeof createPrePlan>` — catches add/remove/rename/
   reorder of any of the three positional parameters.
9. **`consumePlan` `// why:` block** explicitly states that
   `revision` is preserved (not bumped), citing
   `preplan.types.ts:33-46` and `disruptionPipeline.ts:24-27`.

If the executor finds themselves implementing v1 patterns
(constructing a `PrePlanContext`, calling `invalidatePrePlan` from
the store, rendering a `cause` field, etc.) — STOP. They are
working from a stale memory; reread the v2 WP §A, §C, §C.1, §D, §E,
§F, §I, §J. The drift sentinel and §J drift tests are designed to
catch any such regression at compile-time or test-time.

---

## 6. Authority Chain (read in this order before WP-059 execution)

1. `.claude/CLAUDE.md` — EC-mode, lint gate, commit discipline
2. `.claude/rules/architecture.md` — Layer Boundary (authoritative);
   confirm row 210 still forbids `apps/arena-client → preplan`
   runtime imports (D-5901 will land that carve-out as part of
   WP-059 execution scope §L–§M)
3. `.claude/rules/code-style.md` — ESM, `.test.ts`, JSDoc, `// why:`
4. `.claude/rules/work-packets.md` — One-Packet-Per-Session;
   invocations are scratchpad-by-default
5. `docs/ai/ARCHITECTURE.md` — §Layer Boundary; §Pre-Planning Layer
6. `docs/01-VISION.md` — relevant clauses per WP-059 §Vision
   Alignment block (§3 fairness, §4 multiplayer pacing, §17
   accessibility, §22 determinism, NG-1..7)
7. `docs/ai/work-packets/WP-059-preplan-ui-integration.md` **v2**
8. `docs/ai/execution-checklists/EC-059-preplan-ui-integration.checklist.md`
   **v2** — the authoritative execution contract
9. `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` — pre-flight
   completed; reference only for workflow rules
10. `docs/ai/REFERENCE/01.7-copilot-check.md` — copilot check
    completed; reference only for the lens
11. `docs/ai/REFERENCE/01.6-post-mortem-checklist.md` — MANDATORY
    after EC-059 §After Completing satisfied (per P6-28 — see EC
    §After Completing line "01.6 post-mortem MANDATORY")
12. `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md` —
    commit prefix is `EC-059:` for the implementation commit;
    governance close commit is `SPEC:`
13. `docs/ai/post-mortems/01.6-WP-054-public-leaderboards-read-only.md`
    — §5 Lessons Forward (mirrored in §7 below for proximity)
14. `docs/ai/DECISIONS.md` — D-5601 (`packages/preplan/`
    classification — load-bearing for the §L–§M layer-boundary
    edits in WP-059); D-5901 will be added by WP-059 §N

If any conflict surfaces, higher-authority documents win. WP-059 v2
is subordinate to ARCHITECTURE.md and `.claude/rules/`.

---

## 7. Lessons Carried Forward (v2 — five lessons)

The four lessons from WP-054's post-mortem §5 plus one new lesson
from the WP-059 v1 → v2 pre-flight cycle.

### 7.1. Pre-Session Gate 10 (Hard-Stop substring pre-screen) is load-bearing for `// why:` authorship

(Unchanged from v1 of this bridge.) WP-054 required three
mid-execution `// why:` rephrases to satisfy gates that catch
literal forbidden tokens regardless of whether they appear in code
or in prose. **Generalizes for WP-059:** the prose-vs-grep
discipline (lint §18) is encoded in WP-059 §Non-Negotiable
Constraints; the executor must cite governing sources by
**decision ID + category description** in any `// why:` that needs
to reference a forbidden token (`Math.random`, `localStorage`, etc.).

### 7.2. Test-file cleanup discipline: `TRUNCATE … CASCADE` over `DELETE FROM`

(Unchanged from v1 of this bridge; informational only — WP-059 has
no DB tests.)

### 7.3. Spec arithmetic discrepancies: honor the explicit plan, document the divergence

(Strengthened in v2.) WP-054 had test-count divergence between two
sentences (8 vs 9). **WP-059 v2 has zero divergence** at 34 across
five sites: WP §Acceptance Criteria → Tests, WP §Verification Steps
Step 2 comment, EC §Files to Produce drift-test line, EC
§Test-count lock, EC §After Completing strict arithmetic (two
sites). The v2 rewrite fixed the v1 32 → 34 cascade in lockstep.
**Generalizes for WP-059 execution:** if the executor sees a number
other than 34 anywhere during the session, treat it as a drafting
bug and reconcile against the EC §Test-count lock line (the single
source of truth).

### 7.4. Score-control via state attribute (specific to DB-projection tests; WP-059 N/A)

(Unchanged from v1; informational only — no scoring layer in
WP-059.)

### 7.5. **NEW** — Contract verification at pre-flight time, against actual source

The v1 → v2 cycle's headline lesson. WP-059 v1 was drafted with
six wrong shapes for `@legendary-arena/preplan` exports — likely
because the v1 author wrote against a mental model of the package
that drifted from the actual exports between WP-058's landing and
WP-059's drafting (4 days later). Pre-flight v1 caught all six by
**reading the actual source files** rather than trusting the WP
text. The cost was one A0 SPEC rewrite commit (this v2 bundle).
The cost of catching them at execution time would have been six
compile-fail ripples plus a stale WP that ships out of sync with
the code.

**Generalizes for WP-059 execution:** when the EC §Before Starting
"`createPrePlan` parameter list confirmed" item runs, the executor
must read `packages/preplan/src/preplanSandbox.ts:37-41` and verify
the three-positional signature literally. The v2 §D drift sentinel
would catch a regression at compile-time, but the EC item is the
last opportunity to catch a regression *before* writing any code.
The same discipline applies to every type cited in EC §Locked
Values' three new field-name locks: confirm field-by-field against
the cited source line ranges before authoring fixtures or
templates.

**Generalizes for the WP-author role broadly (future WP authors):**
when a WP draft cites field names, function signatures, or type
shapes from a dependency package, the WP author must read the
dependency's actual exported types — not trust prior WP text or
session memory. The WP draft IS the contract; the contract MUST
match reality. Pre-flight is the second-line defense; the first
line is the WP author opening the dependency source file.

---

## 8. Workflow Position (per `01.4 §Work Packet Execution Workflow`)

| Step | Status | Notes |
|---|---|---|
| Step 0: Session context | **Complete (v2)** | This file (post-A0-SPEC reconciliation) |
| Step 1: Pre-flight (`01.4`) v1 | **Complete** | NOT READY verdict — six CV findings |
| Step 1b: Copilot check (`01.7`) v1 | **Complete** | SUSPEND verdict — 25/4/1 |
| **PS-1..PS-5** | **Complete** | All five resolved 2026-04-26 |
| Step 1: Pre-flight v2 | **Complete** | READY TO EXECUTE — all CVs resolved |
| Step 1b: Copilot check v2 | **Complete** | CONFIRM — 29/1/0 |
| Step 1d: A0 SPEC v2 commit | **Landing now** | Single `SPEC:` commit on `wp-059-spec-bundle-v2` branch (this commit) |
| Step 1e: Bridge re-author | **Complete (this revision)** | This file IS the post-A0-SPEC reconciliation; lands in the same SPEC commit |
| Step 2: Session prompt generation | **In progress** | Drafted at `docs/ai/invocations/session-wp059-preplan-ui-integration.md` (gitignored scratchpad) in the same session as pre-flight v2 + copilot v2 + A0 SPEC v2 per 01.4 §Step Sequencing rule "Step 1b → 2 may proceed in same session" |
| Step 3: Implementation (Commit A) | **Not yet** | Requires fresh Claude Code session per 01.4 §Step 3 sequencing rule; commit prefix `EC-059:` |
| Step 4: Post-mortem (`01.6`) | **Not yet** | Same session as Step 3, after EC passes; **MANDATORY** per P6-28 |
| Step 5: Pre-commit review | **Not yet** | Separate session, gatekeeper |
| Step 6: Commit hygiene (`01.3`) | **Not yet** | `EC-059:` for code, `SPEC:` for governance close |
| Step 7: Lessons learned | **Not yet** | After commit |
| Step 8: Next session-context | **Not yet** | After lessons; bridges to next WP in chain |

---

## 9. Suggested First Actions for the WP-059 Executor (v2)

1. **Open a fresh Claude Code session** (One-Packet-Per-Session
   rule). This session must NOT be the one that authored this
   bridge / generated the session prompt — per 01.4 §Step 3
   sequencing rule.
2. **Read this bridge first**, in full. Internalize §5's nine
   v1 → v2 spec changes — these are the load-bearing differences
   the executor must respect.
3. **Read the authority chain in §6 in order.** Stop after WP-059
   v2 + EC-059 v2; the rest are reference / post-execution.
4. **Verify the §3 baselines** at session start. Run:
   ```
   pnpm --filter @legendary-arena/arena-client test
   pnpm --filter @legendary-arena/preplan test
   pnpm -r test
   ```
   Record `PRE_ARENA_CLIENT_COUNT` and `PRE_COUNT` per the EC
   §Before Starting "Baseline green" item.
5. **Run the EC §Before Starting checklist top to bottom.** Pay
   special attention to the `createPrePlan` parameter-list
   confirmation (item 4) — this is the last opportunity to catch
   a regression before writing code.
6. **Cut a fresh execution branch** from `main` after the WP-059
   v2 SPEC bundle has merged: `git checkout -b
   wp-059-preplan-ui-integration main`.
7. **Implement WP-059 v2 per the EC** in a single
   `EC-059:`-prefixed commit. Follow EC §Files to Produce exactly;
   no scope additions. Use the eight required `// why:` blocks
   verbatim from WP §A / §C / §D / §G.
8. **Run all 13 verification steps** from WP §Verification Steps
   per the EC §After Completing checklist. Record
   `POST_ARENA_CLIENT_COUNT` and `POST_COUNT`. Both deltas must
   equal **34**.
9. **Author the post-mortem** at
   `docs/ai/post-mortems/01.6-WP-059-preplan-ui-integration.md`
   (project convention per EC-066 / EC-068 precedent — not the
   `PM-NNN-*.md` variant). Per P6-28, this is MANDATORY for
   WP-059 (criteria met: new contract surface + new long-lived
   abstraction).
10. **Author the governance close commit** as a `SPEC:`-prefixed
    commit closing WORK_INDEX, EC_INDEX, STATUS, DECISIONS
    (D-5901), and the post-mortem.
11. **Author the next session-context bridge** for the WP that
    consumes WP-059's contract surface (likely the live-mutation
    middleware follow-up — name TBD; check WORK_INDEX at that
    time).

---

## 10. Recommended Next Action

**Open a fresh Claude Code session for WP-059 EXECUTION** against
the landed v2 SPEC bundle. The execution session is the natural
unit of work — it ships the implementation, the tests, the
governance close, and the post-mortem in a single coherent pass.

Do **not** open WP-059 execution in the same session as this
reconciliation. The execution session opens against:
- `main` HEAD (post-WP-059-v2-SPEC-bundle merge)
- The reconciled bridge (this file)
- WP-059 v2 + EC-059 v2 as the authoritative contract

**WP-054 merge timing:** still your call per session-context-wp059
v1 §10 ("can land before or after WP-059 pre-flight"). The same
applies to WP-059 v2: WP-054 and WP-059 are file-list-disjoint, so
either order works. The WP-059 execution branch can be cut from
`main` whether or not WP-054 has merged — the WP-059 implementation
files (under `apps/arena-client/`) will not conflict with the
WP-054 implementation files (under `apps/server/`).

Out-of-band tidy-up that's **not blocking** WP-059 execution:

- Merge `wp-054-public-leaderboards-read-only` to `main` and
  push origin (your call on timing)
- Merge `wp-059-spec-bundle-v2` to `main` (this branch — your call
  on timing; ideally before opening the WP-059 execution session
  so the executor opens against landed contract)
- DECISIONS_INDEX.md sync for D-5401 / D-5402 / D-5403 (WP-054)
  — deferred per WP-053 precedent
- Pre-existing WIP in working tree (`DESIGN-RANKING.md` mod;
  `data/cards-combined.*`; `WP-100-*.md`; `WP-111-*.md`;
  `Combine-CardData.ps1`) — has been lingering through WP-052 /
  053 / 054 sessions; needs its own session eventually but does
  not block WP-059 v2 execution

The four invocation scratchpad files
(`preflight-wp059-…`, `preflight-wp059-…-v2`, `copilot-wp059-…`,
`copilot-wp059-…-v2` under `docs/ai/invocations/`) will remain in
the working tree as gitignored audit artifacts. The WP-059
executor should consult them if needed (especially the v2
pre-flight's CV-disposition log in §"v1 Findings — Disposition
Log" for traceability of any contract-drift question), but they
are not normative — WP-059 v2 + EC-059 v2 are the contract.
