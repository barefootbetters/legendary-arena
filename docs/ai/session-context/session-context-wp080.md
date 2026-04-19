# Session Context — WP-080 Replay Harness Step-Level API

> **Generated:** 2026-04-18 after WP-063 / EC-071 execution attempt blocked at
> Pre-Session Gate #4 (WP-027 harness is end-to-end only). This file is the
> bridge step-0 input for the WP-080 **drafting** session (SPEC-only). Load
> it first, then load the WP-080 session prompt at
> `docs/ai/invocations/session-wp080-replay-harness-step-level-api.md`.

> **Amendment 2026-04-19 (SPEC) — WP-079 executed + WP-080 drafting complete;
> this file now serves the EXECUTION session.** The drafting session referenced
> in the generated header above has run and produced all artifacts listed in
> §What the Drafting Session Must Produce. WP-079 execution has also landed
> under EC-073. This amendment supersedes the following statements in the
> body; all other guidance (dirty-tree discipline, scope summary, Q1–Q5
> design answers, pre-flight-gate intent) remains load-bearing.
>
> 1. **Branch status** — supersedes "Branch: `wp-062-arena-hud`" in §Upstream
>    State. Current state: `wp-062-arena-hud` was merged to `main` at
>    `3307b12` via an EC-069 `--no-ff` merge. WP-079 execution then cut
>    `wp-079-replay-harness-determinism-label` off main at `3307b12` and
>    landed four commits: `1e6de0b` (`EC-073:` source JSDoc + module
>    headers), `2131116` (`EC-073:` governance closure), `924f88b`
>    (`SPEC:` pre-commit review artifact), `f8858d4` (`SPEC:` 01.3
>    compliance amendment to the review). HEAD at this amendment:
>    `f8858d4`. For WP-080 execution, a branch-strategy decision is
>    required — see §Lessons Learned §Branch strategy at the bottom of
>    this file.
>
> 2. **WP-079 status** — supersedes "WP-079 drafted, untracked, no EC yet"
>    throughout §WP-079 Coordination and §Order of Execution. Current
>    state: WP-079 source commit `1e6de0b` landed 2026-04-19. EC-073 is
>    Done in `EC_INDEX.md` line 187 with "Executed 2026-04-19 at commit
>    `1e6de0b`". D-0205's single follow-up action is formally closed in
>    `DECISIONS.md §D-0205 Follow-up`. `replay.execute.ts` module JSDoc
>    and `replayGame()` JSDoc carry the determinism-only narrowing with
>    D-0205 + `MOVE_LOG_FORMAT.md §Known Gaps / Risks Gap #4`
>    cross-references; `replay.verify.ts` module JSDoc and
>    `verifyDeterminism()` JSDoc carry the same narrowing with a D-0205
>    cross-reference. **WP-080 execution MUST preserve these JSDoc
>    blocks verbatim** when adding `applyReplayStep` — do not re-word
>    (explicit contract per WP-080 body + EC-072).
>
> 3. **WP-080 drafting status** — supersedes "drafting session (this one),
>    SPEC-only" framing throughout §Two distinct sessions and §Order of
>    Execution. Drafting is complete: WP-080 body, EC-072 checklist
>    (Draft), D-6304 decision, and WORK_INDEX / EC_INDEX / STATUS rows
>    are landed as of SPEC bundle `1264133` (merged to main via
>    `3307b12`). Next step is the **execution session** under `EC-072:`
>    prefix.
>
> 4. **Test baseline** — unchanged at **464 passing / 0 failing /
>    0 skipped** (registry 3 + vue-sfc-loader 11 + game-engine 409 +
>    server 6 + arena-client 35), re-verified on
>    `wp-079-replay-harness-determinism-label` at `f8858d4`. WP-080
>    execution adds new tests in `replay.execute.test.ts` per EC-072;
>    the new baseline target is documented in EC-072.
>
> 5. **Pre-flight + authority chain** — the drafted
>    `docs/ai/invocations/session-wp080-replay-harness-step-level-api.md`
>    is the authoritative load for the execution session. If that file's
>    §Pre-Flight Verdict is absent or references a pre-WP-079-execution
>    HEAD, re-run 01.4 pre-flight per
>    `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` against the
>    post-WP-079 HEAD before execution. See §Lessons Learned for two
>    additional governance artifacts the WP-080 invocation likely does
>    NOT cite (PRE-COMMIT-REVIEW.template.md, 01.3-commit-hygiene) that
>    should be loaded explicitly.
>
> 6. **Dirty-tree advisory** — both stashes (`stash@{0}` + `stash@{1}`)
>    retained unchanged through the WP-079 execution session. EC-069
>    `<pending — gatekeeper session>` placeholder in `EC_INDEX.md` line
>    183 retained (not backfilled). Seven untracked Category D files +
>    one modified `session-wp079-...md` file remained outside every
>    commit. Discipline carries into WP-080 execution — see §Lessons
>    Learned.

---

## Why WP-080 Exists

A prior session attempted to execute `WP-063 / EC-071` (Replay Snapshot
Producer). At **Pre-Session Gate #4 — "WP-027 step-level API"** the
session found that `packages/game-engine/src/replay/replay.execute.ts`
exposes only `replayGame(input, registry): ReplayResult` — an **end-to-end**
harness that loops all moves internally and returns only the final state
plus a hash.

Block evidence (verified at the file level):

- `replay.execute.ts:77` — `MOVE_MAP` is a module-local `const`, no `export`
- `replay.execute.ts:98` — `buildMoveContext` is a module-local `function`,
  no `export`
- `replay.execute.ts:138–178` — `replayGame` does `for (const move of
  input.moves) { ... }` internally and returns only
  `{ finalState, stateHash, moveCount }`; no per-step callback, no
  generator, no intermediate `G` observable from outside
- `packages/game-engine/src/index.ts:206–211` (WP-027 block) exports only:
  - `type { ReplayInput, ReplayMove, ReplayResult }`
  - `replayGame`, `computeStateHash`, `verifyDeterminism`
  — no step function, no `MOVE_MAP`, no `buildMoveContext`

Per the EC-071 session prompt §Session protocol and §Pre-Session Gates #4:

> "If WP-027's harness does not expose a step function or equivalent
> per-input stepping, STOP and ask — do not patch WP-027 locked contract
> files from this packet."
> "If the harness is end-to-end only, WP-063 is **BLOCKED** — STOP and ask;
> do not patch WP-027 locked contract files from this session."

The user selected **"Stop and amend (pre-flight)"** via `AskUserQuestion`
in the blocked session. WP-080 is the amendment: add a step-level export to
`replay.execute.ts`, refactor `replayGame` to route through it (single
source of truth for dispatch), and then `buildSnapshotSequence` (WP-063)
wraps that export cleanly.

---

## Upstream State at WP-080 Drafting Session Start

- **Branch:** `wp-062-arena-hud` (no new branch cut yet for WP-080 drafting).
  This session is SPEC-only — no source code changes — so drafting on the
  current branch is acceptable. If the user prefers a dedicated branch
  (`spec-wp080-drafting` or similar) for cleanliness, that is a pre-flight
  decision, not a gate.
- **Head commit:** `4b75dca` — `SPEC: WP-063 session execution prompt (step 2
  of WP workflow)`.
- **Governance base commit present:** `eb19264` — `SPEC: EC-071 draft +
  D-6301/D-6302/D-6303 for WP-063 replay snapshot producer` — is at
  `HEAD~2`. This is the expected base: WP-063's governance bundle landed
  but WP-063 execution has not. WP-080 drafting proceeds from here.
- **Repo test baseline:** unchanged from WP-062 close — **464 tests
  passing** (3 registry + 409 game-engine + 11 vue-sfc-loader + 6 server
  + 35 arena-client), 0 failures. Drafting does not execute tests; the
  WP-080 *execution* session will.
- **Engine baseline:** 409 tests / 101 suites (unchanged since WP-067 /
  EC-068 at commit `1d709e5`).

---

## Dirty-Tree Advisory (Inherited — DO NOT CLEAN)

The tree carries three classes of unresolved state identical to what
WP-063 inherited. WP-080's drafting session inherits them too:

### 1. Retained `stash@{0}` — WP-068 / MOVE_LOG_FORMAT governance edits

```text
stash@{0}: On wp-062-arena-hud: pre-existing WP-068 + MOVE_LOG_FORMAT
governance edits (quarantined during WP-062 commit)
```

Contents: D-1414, D-0203 / D-0204 / D-0205, WP-068 narrative updates,
EC-070 row in `EC_INDEX.md`.

**WP-080 drafting MUST NOT `git stash pop` this stash.** Owned by the
WP-068 / MOVE_LOG_FORMAT resolver. If WP-080 drafting needs to modify
`DECISIONS.md` / `DECISIONS_INDEX.md` / `WORK_INDEX.md` / `EC_INDEX.md`
(it will — D-6304, WP-080 row, EC-072 row), apply the P6-41 stash +
re-apply + leave-stash pattern. Do not bundle the stash's contents
into the SPEC commit.

### 2. Retained `stash@{1}` — pre-existing WP-068 in-flight work

```text
stash@{1}: On wp-068-preferences-foundation: dirty tree before wp-062
branch cut (pre-existing in-flight work + WP-068 lessons-learned 01.4
additions)
```

Same owner. Same discipline: do not pop.

### 3. EC-069 `<pending — gatekeeper session>` placeholder in `EC_INDEX.md`

The EC-069 row in `EC_INDEX.md` reads:

> `Executed 2026-04-18 at commit \`<pending — gatekeeper session>\`.`

The correct hash is `7eab3dc` (WP-062 execution). WP-080 drafting
**MUST NOT** backfill this placeholder. A separate `SPEC:` commit
(or the eventual WP-068 stash-pop resolution commit) owns the
backfill. Cross-WP contamination is a scope violation.

### 4. Untracked, unrelated files

From `git status --short` at the drafting session start:

- Content-theme files (`content/themes/*.json`) — many modified, unrelated
- Session-context + invocation drafts from prior sessions (WP-067,
  WP-068, forensics, WP-079, WP-063)
- WP-079 draft file (`docs/ai/work-packets/WP-079-label-replay-harness-
  determinism-only.md`) — **untracked, but already drafted**; see
  §WP-079 Coordination below
- Root-level survey text files, licensing docs, `.claude/settings.local.json`

**None of these are WP-080's scope.** Stage by name only. Never use
`git add -A` or `git add .`.

---

## WP-080 Scope Summary

**Title (proposed):** Replay Harness Step-Level API for Downstream
Snapshot / Replay Tools
**Deliverable type:** Game Engine additive refactor (new exports + loop
refactor of `replayGame` to route through the new exports; single source
of truth for `MOVE_MAP`).
**Proposed Primary Layer:** Game Engine (`packages/game-engine/src/
replay/`).
**Proposed Dependencies:** WP-027 (harness exists), WP-079 (JSDoc
narrowing; must land first — both WPs touch `replay.execute.ts`),
D-6304 (new decision locking the step-level API approach).
**Consumed by:** WP-063 (blocked; resumes after WP-080 executes),
future replay inspectors and debug tools.

### Two distinct sessions, not one

WP-080 involves **two sessions**:

1. **Drafting session (this one).** SPEC-only. Produces:
   - `docs/ai/work-packets/WP-080-*.md` (new)
   - `docs/ai/execution-checklists/EC-072-*.checklist.md` (new, Draft)
   - `docs/ai/DECISIONS.md §D-6304` (new)
   - Governance index updates (WORK_INDEX, EC_INDEX, STATUS)
   - Amendment to `session-wp063-*.md` §Pre-Session Gates #4
   - **Commits under `SPEC:` prefix only**

2. **Execution session (future).** Commits under `EC-072:` prefix.
   Modifies `replay.execute.ts`, `index.ts`, adds a new test file.
   Mandatory 01.6 post-mortem (new long-lived abstraction trigger).

---

## What the Drafting Session Must Produce (Binary)

1. **`WP-080-replay-harness-step-level-api.md`** per §WP-080 Required
   Sections in the session prompt.
2. **`EC-072-replay-harness-step-level-api.checklist.md`** following
   `EC-TEMPLATE.md` structure verbatim.
3. **`DECISIONS.md §D-6304`** — "WP-027 replay harness exposes a
   step-level API; downstream tools do not duplicate dispatch."
4. **`WORK_INDEX.md`** — new WP-080 row + WP-063 dependency cell
   amended.
5. **`EC_INDEX.md`** — new EC-072 row (Draft status).
6. **`STATUS.md`** — one-line today-dated entry.
7. **`session-wp063-replay-snapshot-producer.md`** — additive amendment
   at §Pre-Session Gates #4 and §Authority Chain citing WP-080 /
   EC-072 / D-6304. **No deletions.**

**No `.ts` / `.tsx` / `.js` / `.mjs` / `.cjs` / `.yaml` / non-docs
`.json` file modified.** Scope lock is binary (P6-27).

---

## Design Questions the Drafted WP-080 Must Resolve

Each question has a recommended default; the drafting session must take
an explicit position in WP-080 §Design Decisions:

- **Q1 — API shape:** single `applyReplayStep` function (Option A,
  recommended), context-pair `buildReplayMoveContext` +
  `dispatchReplayMove` (Option B), or exposed `MOVE_MAP` + helpers
  (Option C). Recommended: **A** (minimum surface).
- **Q2 — State ownership:** mutate-and-return-same-reference (Option A,
  recommended) vs clone-return (Option B). Recommended: **A**
  (preserves current `replayGame` semantics; consumers project via
  `buildUIState` rather than retaining `G` copies).
- **Q3 — `replayGame` refactor:** route `replayGame`'s loop through the
  new step function (Option A, recommended) vs leave `replayGame` as-is
  with two copies of dispatch (Option B). Recommended: **A** (single
  source of truth; regression guard via `computeStateHash`).
- **Q4 — Export `ReplayMoveContext`:** only if Q1 = B or C. If Q1 = A,
  keep it file-local.
- **Q5 — `ReplayInputsFile` scope:** **out of scope** for WP-080. That
  is WP-063's concern. WP-080 §Out of Scope must state this explicitly.

If the drafting session cannot resolve Q1–Q5 from the reading list
alone, escalate via `AskUserQuestion` with named options. Do not guess.

---

## WP-079 Coordination (Important)

`WP-079 — Label Engine Replay Harness as Determinism-Only` is a
**doc-only JSDoc** update to `replay.execute.ts` and `replay.verify.ts`
under D-0205. It is currently:

- **Drafted:** `docs/ai/work-packets/WP-079-label-replay-harness-
  determinism-only.md` exists (untracked at session start)
- **Session-context drafted:** `docs/ai/session-context/session-context-
  wp079.md` exists (untracked)
- **EC status:** **UNKNOWN as of WP-080 drafting start.** Check
  `docs/ai/execution-checklists/EC_INDEX.md` at drafting time. If no
  EC exists for WP-079, a separate SPEC drafting session for WP-079's
  EC is a prerequisite to WP-079 execution.

Both WP-079 and WP-080 touch `replay.execute.ts`. The recommended
ordering is:

1. WP-079 executes first (doc-only, minimal merge surface; narrows the
   D-0205 claim at the export site).
2. WP-080 executes second (additive exports + loop refactor; inherits
   WP-079's JSDoc narrowing verbatim — don't re-word it).

The drafted WP-080 **must list WP-079 as a hard upstream dependency**
in its `§Dependencies` header line and in its `§Assumes` block. If
WP-079 has no EC drafted yet, WP-080's `§Dependencies` section should
include a note: *"If WP-079 has no EC at WP-080 execution time,
WP-079's EC drafting is a transitive prerequisite."*

---

## EC Slot Selection

Occupied / tracked ECs in the 070-series:

| EC  | Owner | Status | Notes |
|-----|-------|--------|-------|
| EC-067 | WP-061 (gameplay client bootstrap) | Done | commit `2e68530` |
| EC-068 | WP-067 (UIState PAR projection) | Done | commit `1d709e5` |
| EC-069 | WP-062 (Arena HUD) | Done | commit `7eab3dc` (placeholder in
EC_INDEX) |
| EC-070 | WP-068 (preferences foundation) | Done | commit `bbd58b0` +
`8ec6ced` |
| EC-071 | WP-063 (replay snapshot producer) | Draft | BLOCKED at
Pre-Session Gate #4 |
| EC-072 | *(free)* | — | **recommended for WP-080** |

**Recommended slot for WP-080: `EC-072`** (first truly free slot,
continuing the WP-063/EC-071 pattern — the WP number and EC number
are not required to match, see `EC-071` header note on
`EC-062 → EC-069` / `EC-061 → EC-067` retargeting precedent).

Commit prefix for WP-080 execution: **`EC-072:`**. Not `WP-080:`
(P6-36 — hook rejects). For the drafting session now: **`SPEC:`**.

---

## Pre-Flight Gates WP-080 Drafting Session Must Clear

1. **Commit-prefix literal (P6-36).** Every commit uses `SPEC:`.
   `WP-080:` is rejected by the hook. `EC-072:` is reserved for the
   future execution session that satisfies EC-072's DoD.
2. **Governance base commit present.** `eb19264` must appear in
   `git log --oneline -5`. Governance indexes (`DECISIONS.md`,
   `WORK_INDEX.md`, `EC_INDEX.md`, `STATUS.md`, `02-CODE-CATEGORIES.md`)
   must be clean in `git status --short`.
3. **Stash discipline.** `stash@{0}` and `stash@{1}` present and
   untouched. DO NOT pop.
4. **EC-069 placeholder retained.** Do not backfill
   `<pending — gatekeeper session>` in any SPEC commit produced by
   this session.
5. **WP-063 block evidence independently verified.** Open
   `replay.execute.ts` and confirm `MOVE_MAP` (line 77) and
   `buildMoveContext` (line 98) are file-local; `replayGame` has no
   per-step callback parameter.
6. **Lint gate (00.3)** run against the drafted WP-080 before commit.
   Unmet items require explicit justification in the commit body.

---

## Things WP-080 Drafting Session MUST NOT Do

- **Modify any `.ts` / `.tsx` / `.js` / `.mjs` / `.cjs` / `.yaml` file.**
  The scope is docs-only. Any source edit is a scope violation
  (P6-27) — STOP and escalate via `AskUserQuestion`.
- **Modify `WP-063-*.md`.** Amendments live in the WP-063 **session
  prompt**, not the WP body. Editing the WP body requires its own
  SPEC commit with a clear trail.
- **Modify `WP-079-*.md`.** Coordination is expressed in WP-080
  `§Dependencies`, not by editing WP-079. (WP-079 is untracked; do not
  even stage it in this session.)
- **Execute tests or builds.** Drafting does not run code.
- **Pop `stash@{0}` or `stash@{1}`.**
- **Backfill the EC-069 `<pending>` placeholder.**
- **Resolve Q1–Q5 by guessing.** If the reading list doesn't support a
  clear recommendation, escalate via `AskUserQuestion`.

---

## Likely New Decisions WP-080 Drafting Will Produce

- **D-6304 — WP-027 replay harness exposes a step-level API; downstream
  tools do not duplicate dispatch.** Captures the Q3 = Option A choice
  (single source of truth) and the rejected alternative (duplicate
  `MOVE_MAP` in `replay-producer`).

Possible secondary decisions (drafter discretion; log if surfaced):

- **D-63## — State-ownership contract for `applyReplayStep`:**
  mutate-and-return-same-reference; consumers wanting historical
  snapshots must project via `buildUIState`, not retain `G`.
- **D-63## — Step-function purity:** no `Date.now`, no `Math.random`,
  no `performance.now`, no `console.*`, no I/O. Inherits WP-027's
  purity guarantee; restated so the export surface makes it explicit.

The drafting session should prefer **one decision (D-6304)** with
embedded sub-rules over three separate decisions, unless the drafter
surfaces a load-bearing reason to split. Follow the D-6301 /
D-6302 / D-6303 precedent (three decisions, each load-bearing).

---

## Order of Execution (Full Chain)

1. **This drafting session (now)** → WP-080 / EC-072 / D-6304 / governance
   updates / WP-063 preflight amendment. Commits under `SPEC:`.
2. **WP-079 EC drafting session (if EC does not yet exist)** → draft the
   EC for WP-079. Commits under `SPEC:`. Check `EC_INDEX.md` during
   drafting to determine if this step applies.
3. **WP-079 execution session** → JSDoc narrowing in `replay.execute.ts`
   and `replay.verify.ts`. Commits under the WP-079 EC prefix.
4. **WP-080 execution session** → step-level API implementation per
   EC-072. Commits under `EC-072:`. 01.6 post-mortem mandatory.
5. **WP-063 execution resume session** → re-opens
   `session-wp063-replay-snapshot-producer.md`. Pre-Session Gate #4
   now passes. Proceeds with EC-071 execution as originally spec'd.

---

## Bootstrap Checklist for the WP-080 Drafting Session

1. Load this file (`session-context-wp080.md`).
2. Load the WP-080 session prompt:
   `docs/ai/invocations/session-wp080-replay-harness-step-level-api.md`.
3. `git branch --show-current` — confirm branch (`wp-062-arena-hud`
   expected unless a fresh drafting branch is cut).
4. `git log --oneline -5` — confirm `eb19264` present.
5. `git status --short` — confirm dirty-tree state matches §Dirty-Tree
   Advisory above; confirm both stashes retained; confirm governance
   indexes clean.
6. `git stash list` — confirm both stashes present and untouched.
7. **Read for understanding (no modification):**
   - `packages/game-engine/src/replay/replay.execute.ts` — confirm
     `MOVE_MAP` at line 77 and `buildMoveContext` at line 98 are
     module-local; `replayGame` at lines 138–178 loops internally.
   - `packages/game-engine/src/replay/replay.verify.ts` +
     `replay.verify.test.ts` — understand the current `replayGame`
     consumer (determinism guard); WP-080's refactor must preserve
     this test's behavior.
   - `packages/game-engine/src/index.ts:206–211` — the WP-027 barrel
     block; WP-080's new exports follow this pattern.
   - `docs/ai/work-packets/WP-079-label-replay-harness-determinism-only.md`
     — the coordination dependency's scope.
   - `docs/ai/work-packets/WP-063-replay-snapshot-producer.md` — the
     consumer whose Pre-Session Gate #4 is currently BLOCKED.
   - `docs/ai/invocations/session-wp063-replay-snapshot-producer.md`
     §Pre-Session Gates #4 — the exact block this session amends.
   - `docs/ai/DECISIONS.md §D-0201`, `§D-0205`, `§D-6301`, `§D-6302`,
     `§D-6303` — the decision chain that this session's D-6304 extends.
   - `docs/ai/execution-checklists/EC-TEMPLATE.md` — the EC-072
     skeleton.
8. Resolve **Design Questions Q1–Q5**. Prefer the recommended defaults
   unless an explicit reading surfaces a reason to diverge. If
   unresolvable, escalate via `AskUserQuestion`.
9. **Draft files in this order (dependency first):**
   - `WP-080-*.md` — full WP body
   - `EC-072-*.checklist.md` — full EC body
   - `DECISIONS.md §D-6304` — append
   - `WORK_INDEX.md` — add WP-080 row; amend WP-063 dependency cell
   - `EC_INDEX.md` — add EC-072 row (Draft)
   - `STATUS.md` — one-line today-dated entry
   - `session-wp063-replay-snapshot-producer.md` — additive amendment
     at §Pre-Session Gates #4 and §Authority Chain
10. Run **lint gate (00.3)** on the drafted WP-080. Document results
    in the commit body.
11. Run Verification Steps 1–13 from the session prompt.
12. Commit under `SPEC:` (single commit recommended; three-commit
    breakdown acceptable if the user prefers granularity — session
    prompt names both options).
13. Hand off to the next session in the chain (WP-079 EC drafting or
    WP-080 execution, depending on `EC_INDEX.md` state).

---

## Lessons Learned from WP-079 / EC-073 Execution (2026-04-19)

Captured by the WP-079 / EC-073 execution session on 2026-04-19 and
load-bearing for the WP-080 / EC-072 execution session. Evidence
artifacts: `docs/ai/reviews/pre-commit-review-wp079-ec073.md` (review
+ 01.3 compliance audit); `STATUS.md` §"WP-079 / EC-073 Executed";
`DECISIONS.md §D-0205 Follow-up".

### Process gaps discovered (and closed post-hoc)

1. **Step 5 pre-commit review was missed.** 01.6 §Workflow Position
   lists `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md` as step 5,
   running as a non-implementing gatekeeper between post-mortem
   (step 4) and commit (step 6). The WP-079 session prompt did not
   cite this template in its 11-entry Authority Chain, Pre-Session
   Gates, Verification Steps, or Definition of Done. The implementation
   session followed the prompt verbatim and skipped step 5. Closed
   post-hoc as review commit `924f88b` (`SPEC:`).

   **For WP-080 execution:** explicitly load
   `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md` as part of the
   Authority Chain reading, even if the WP-080 invocation does not
   cite it. Run the review as step 5 — either inline before the
   execution commit lands (self-review; faster) or coordinate a
   separate gatekeeper session (cleaner separation of duties per
   01.6). WP-080 introduces `applyReplayStep`, a new long-lived
   abstraction; a pre-commit review is materially higher-value than
   it was for WP-079's doc-only scope.

2. **01.3 commit hygiene was not formally opened** at the top of the
   commit phase. The session relied on prior familiarity + the
   `.githooks` chain as backstop. One subject line contained the
   forbidden word `"updates"` and was rejected by the `commit-msg`
   hook; subject was rewritten and the retry accepted. No
   `--no-verify`, no `--amend`, no bypass. The compliance verdict was
   Pass but the reading of the reference document was retroactive,
   not proactive. Closed post-hoc as amendment commit `f8858d4`
   (`SPEC:`).

   **For WP-080 execution:** read
   `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md` at the
   top of the commit phase. Before each commit, consider
   `pwsh scripts/git/ec-commit.ps1 -Check -Message "<subject>"` for
   dry-run validation — avoids live-hook rejections. Forbidden-word
   list (rejected by `commit-msg`): `WIP`, `wip`, `fix stuff`,
   `misc`, `tmp`, `updates`, `changes`, `debug`, `quick fix`,
   `hotfix`, `cleanup`, `refactor`. Subject must be ≥ 12 chars
   after prefix.

### Hook behaviors observed live

- **`commit-msg` rejects `WP-###:` prefix (P6-36).** Confirmed active.
  WP-080 execution uses `EC-072:`; do not regress to `WP-080:`.
- **`commit-msg` issues a non-blocking warning when `EC_INDEX.md` is
  staged with an `EC-###:` prefix.** Text: *"EC governance files
  (EC_INDEX.md, EC-TEMPLATE.md) staged with an EC-### commit. These
  files are usually changed via SPEC: or INFRA: commits. Proceeding,
  but verify this is intentional."* Expected when flipping an EC
  Draft → Done as part of the WP's DoD. Acknowledge in the commit
  body ("EC-072 Draft → Done is named by EC-072 §Files to Produce").
- **`pre-commit`** blocks secrets, `node_modules/`, `dist/`, and
  `.test.mjs`. The new `replay.execute.test.ts` WP-080 adds is
  `.test.ts` (correct extension per EC-072) — no collision.

### Commit-splitting pattern that worked

For EC-073 (6 files), WP-079 used a **two-commit split** under the
same `EC-073:` prefix to avoid needing `--amend` for hash
substitution:

1. Source-code commit first (`1e6de0b`, 2 files:
   `replay.execute.ts` + `replay.verify.ts`). Captured its hash.
2. Governance commit second (`2131116`, 4 files: `STATUS.md` +
   `WORK_INDEX.md` + `DECISIONS.md` + `EC_INDEX.md`). Referenced
   `1e6de0b` verbatim in the body (and in `DECISIONS.md §D-0205
   Follow-up` + `EC_INDEX.md` "Executed at commit" + `STATUS.md`
   summary + `WORK_INDEX.md` checkbox flip).

**For WP-080 execution (EC-072):** same pattern is viable —
source-code commit first (`replay.execute.ts`, `index.ts`, new
`replay.execute.test.ts`), then governance commit referencing its
hash. If 01.6 post-mortem surfaces fixes during execution, those
fixes land **in** the source commit (post-mortem is step 4, before
commit at step 6), not as a third commit.

### Scope-lock verification: the right command

`git diff --name-only <session-start-HEAD>..HEAD` is correct for
multi-commit scope verification. `git diff --name-only` alone shows
only working-tree deltas and will appear empty after all commits
land — do not use it for post-commit scope audit.

For WP-079 this returned exactly the 6 EC-073 allowlist files after
the two EC-073 commits; SPEC commits (review + amendment) added 1
new file under `docs/ai/reviews/`, which is outside the EC-073
allowlist by design. The six-file EC-073 allowlist was honored
exactly.

### 01.6 post-mortem applicability

- WP-079 correctly waived 01.6 (doc-only; both P6-35 triggers
  absent — no new long-lived abstraction, no new code category).
- **WP-080 MUST run 01.6** — `applyReplayStep` is a new long-lived
  abstraction (the canonical step-level dispatch surface for every
  future replay consumer). EC-072 explicitly states "01.6
  post-mortem MANDATORY" per the EC_INDEX row. Budget session time
  accordingly.
- **Aliasing audit (01.6 §5)** is especially relevant for WP-080:
  `applyReplayStep` takes a `LegendaryGameState` and returns it
  (Q2 = Option A, mutate-and-return-same-reference). Confirm the
  return value IS the same reference (not a copy) so the documented
  contract holds, AND confirm no helpers introduced by the refactor
  return aliased references to mutable `G` fields. WP-028 precedent
  in 01.6 §Precedent Log is directly applicable.

### Case-sensitivity of locked-phrase checks

WP-079 had a locked contract `"determinism-only"` ≥ 2 hits in
`replay.execute.ts`. PowerShell `Select-String -Pattern "..."` is
case-insensitive by default (matches `Determinism-only`); bash
`grep -c "..."` is case-sensitive (does not). The WP-079 session
initially wrote `"Determinism-only"` in the module JSDoc and only
caught the case drift via a cross-tool grep check. Fix: lowered
the module-header occurrence to `"determinism-only"` so both tools
count the same.

**For WP-080:** if EC-072 has similar locked phrases (signature
line matchers, required @tags, etc.), use both `grep -c` and
`Select-String` during verification and normalize case at write time.

### Carryover working-tree state

At WP-079 session start, the working tree carried **7 untracked
Category D files** (forensics + WP-048/067/068/063 invocations +
session-contexts) plus **1 modified tracked file** (the WP-079
session-invocation itself, with pre-flight + copilot check content
from prior prep). All 8 files were kept out of every commit via
strict `git add <file>` discipline (never `git add -A` or
`git add .`).

**For WP-080 execution:** those 8 files are likely still present
plus possibly new ones from the WP-079 execution session. Continue
the same discipline:

- Stage only files in the EC-072 §Files to Produce allowlist.
- Never use `git add -A` or `git add .`.
- `git status --short` immediately before each commit — confirm only
  expected files are staged.
- Untracked governance artifacts (session-contexts, invocations,
  pre-commit reviews) are owned by their respective SPEC / EC
  sessions and MUST NOT be swept into EC-072 commits.

### Branch strategy for WP-080 execution

WP-079 cut its own branch `wp-079-replay-harness-determinism-label`
off main at `3307b12`. WP-080 execution has a branch-strategy
decision. Three options:

- **Option A — Cut new branch off `main`.** WP-080 inherits main's
  state but NOT WP-079's landed JSDoc (WP-079 branch has not yet
  merged to main as of this amendment). WP-080 would then need to
  re-apply the JSDoc narrowing verbatim during execution, or merge
  WP-079 first. Highest merge-conflict risk because both WPs touch
  `replay.execute.ts`.

- **Option B — Cut new branch off `wp-079-replay-harness-determinism-label`.**
  WP-080 inherits WP-079's JSDoc verbatim at branch-cut time —
  cleanest inheritance. Separate PR trail per WP preserved. When
  WP-079's branch later merges to main, WP-080's branch can rebase
  or merge normally. **Recommended** unless the user prefers the
  audit-trail benefits of Option A.

- **Option C — Continue WP-080 execution on the existing
  `wp-079-...` branch.** Simplest but combines WP-079 and WP-080
  commit history on one branch, complicating the "WP-079 lands
  first, WP-080 second" audit story. Not recommended.

The WP-080 invocation's Pre-Flight §Header should record the
branch-cut decision explicitly.

### Authority Chain addenda for WP-080 execution

The WP-080 session prompt's Authority Chain likely does not cite
two governance artifacts that proved load-bearing for WP-079:

- `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md` (step 5 of the
  01.6 workflow)
- `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`
  (commit-phase reference — not the hooks themselves, the rules
  that precede them)

Load both explicitly even if the WP-080 invocation omits them. A
later SPEC patch to the invocation-prompt template (or to 01.1 /
EC-TEMPLATE.md) could formalize this; out of scope for WP-080
execution itself.

### Summary bullets

- Load `PRE-COMMIT-REVIEW.template.md` explicitly; WP-080 is
  higher-stakes than WP-079 (new long-lived abstraction).
- Load `01.3-commit-hygiene-under-ec-mode.md` at the top of the
  commit phase; use `ec-commit.ps1 -Check` for dry-runs.
- Use the two-commit split (source first, governance second
  referencing the source hash) to avoid `--amend`.
- Use `git diff --name-only <session-start>..HEAD` for post-commit
  scope verification.
- 01.6 post-mortem IS MANDATORY for WP-080; aliasing audit (§5) is
  first-priority given Q2 = Option A.
- Normalize case on all locked-phrase occurrences; verify with both
  `grep -c` and `Select-String`.
- Continue strict `git add <file>` discipline.
- Recommended branch: cut WP-080 off `wp-079-replay-harness-determinism-label`
  (Option B) for clean inheritance.

---

## One-Line Handoff

WP-063 / EC-071 blocked at Pre-Session Gate #4 (WP-027 is end-to-end
only); WP-080 drafts the step-level API amendment under a new
`EC-072` slot + `D-6304` decision; commits under `SPEC:`; no source
code changes in this session; WP-079 is a sibling dependency that
lands first; both stashes retained; EC-069 `<pending>` placeholder
retained.

---

## One-Line Handoff (Amended 2026-04-19)

Drafting session + WP-079 execution both complete; WP-080 execution
is next under `EC-072:` prefix; HEAD at handoff `f8858d4` on
`wp-079-replay-harness-determinism-label`; recommended branch-cut
strategy is Option B (cut `wp-080-replay-harness-step-level-api`
off `wp-079-replay-harness-determinism-label` for clean JSDoc
inheritance); 01.6 post-mortem MANDATORY (aliasing audit §5 is
first-priority); load `PRE-COMMIT-REVIEW.template.md` +
`01.3-commit-hygiene-under-ec-mode.md` explicitly even if the WP-080
invocation Authority Chain omits them; both stashes retained;
EC-069 `<pending>` placeholder retained; 7 untracked Category D
files + 1 modified session-invocation file remain outside every
allowlist and MUST stay unstaged.
