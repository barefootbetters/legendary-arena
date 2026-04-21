# Session Context — WP-036 AI Playtesting & Balance Simulation

Bridge from WP-060 execution (Keyword & Rule Glossary Data Migration,
2026-04-20, `cd811eb`) to the WP-036 executor. Carries forward the
repo-state anchor, quarantine state, inherited dirty-tree map,
dependency-chain map that makes WP-036 the single-hop Phase 7
unblocker, and a few governance / ops lessons surfaced during the
WP-034 → WP-035 → WP-042 → WP-055 → WP-056 → WP-057 → WP-058 → WP-081
→ WP-060 post-Phase-6 landing sequence.

**This document is NOT a pre-flight.** It is the input to the WP-036
pre-flight. Author `docs/ai/invocations/preflight-wp036-*.md`
separately once WP-036 + EC-036 have been read in full. The WP-036
executor should expect to produce a SPEC pre-flight bundle analogous
to commit `0654a4c` (WP-060 pre-flight) or `cbb6476` (WP-042
pre-flight) before any EC-036 code commit lands.

---

## Repo-State Anchor (verified 2026-04-20 at session close)

### Branch topology

- **`main`** @ `cd811eb` — synced with `origin/main` (pushed 2026-04-20)
- `wp-060-keyword-rule-glossary` @ `cd811eb` — same tip as `main`; safe
  to delete whenever (subsumed)
- `wp-081-registry-build-pipeline-cleanup` @ `0654a4c` — ancestor of
  `main`, safe to delete
- `wp-064-log-replay-inspector` @ `9fae043` — ancestor of `main`, safe
  to delete
- `wp-068-preferences-foundation` @ `8ec6ced` — independent work,
  **leave intact**
- `wp-081-theme-audio` @ `41fa60a` — independent work (different
  theme-audio WP), **leave intact**

The WP-036 executor should cut `wp-036-ai-playtesting` fresh from
`main` HEAD:

```bash
git checkout -b wp-036-ai-playtesting main
```

### Three-commit topology of the last landed WP (WP-060, for pattern reference)

- **A0 `SPEC:` `0654a4c`** — pre-flight bundle (EC-106 checklist + WP-060
  amendments + pre-flight file + copilot-check 30/30 PASS appendix +
  session prompt)
- **A `EC-106:` `412a31c`** — execution (10 files: 2 new JSONs +
  `glossaryClient.ts` + 5 modified viewer files + viewer `CLAUDE.md` +
  `docs/03.1-DATA-SOURCES.md` + 7 DECISIONS.md entries)
- **B `SPEC:` `cd811eb`** — governance close (STATUS + WORK_INDEX +
  EC_INDEX)

WP-036 should plan for the same three-commit shape: pre-flight bundle
→ code/implementation → governance close.

### Test baselines at HEAD `cd811eb` (must hold through WP-036)

| Package | Tests / Suites / Fail |
|---|---|
| `packages/game-engine` | **436 / 109 / 0 fail** — **MUST hold unchanged** if WP-036 is authored as external tooling per D-0701 |
| `packages/preplan` | 52 / 7 / 0 |
| `packages/registry` | 13 / 2 / 0 |
| `packages/vue-sfc-loader` | 11 / 0 / 0 |
| `apps/server` | 6 / 2 / 0 |
| `apps/replay-producer` | 4 / 2 / 0 |
| `apps/arena-client` | 66 / 0 / 0 |
| **Repo-wide** | **588 passing / 0 failing** |

WP-036 is expected to add tests (AI policy, simulation runner, metrics
aggregation). Lock the expected new-test count in the pre-flight, then
verify against it at execution-close time.

---

## Inherited Dirty-Tree Map (do NOT stage)

`git status --short` at WP-036 session start will show these
pre-existing items. They pre-date the WP-060 session, survived the
WP-060 merge, and **must not be staged by WP-036**.

### Modified (2)

- `docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`
  — pre-existing local doc edit; +240 lines vs `main`
- `docs/ai/session-context/session-context-wp060.md` — pre-existing
  local doc edit; +202 lines vs `main`

### Untracked (11)

- `.claude/worktrees/` — Claude Code worktree scaffolding
- `content/themes/heroes/` — in-flight theme authoring
- `docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md` —
  orphaned reference draft
- **`docs/ai/ideas/` — the mystery directory first observed during
  WP-030 pre-flight; contains `audio-stingers-sketch.md`. Re-flagged
  in WP-060. DO NOT TOUCH.** Same WP-030 precedent applies.
- `docs/ai/invocations/forensics-move-log-format.md`
- `docs/ai/invocations/session-wp048-par-scenario-scoring.md`
- `docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md`
- `docs/ai/invocations/session-wp068-preferences-foundation.md`
- `docs/ai/post-mortems/01.6-applyReplayStep.md`
- `docs/ai/session-context/session-context-forensics-move-log-format.md`
- `docs/ai/session-context/session-context-wp067.md`

### Staging discipline (P6-27 / P6-44)

Stage by **exact filename** only. `git add .` / `git add -A` /
`git add -u` are forbidden — they would sweep the inherited items into
the WP-036 commit.

---

## Quarantine State (do NOT pop)

Three stashes are off-limits. Pre-existing; preserved by every WP
session from WP-055 through WP-060.

- `stash@{0}` — `wp-055-quarantine-viewer`: registry-viewer v1→v2
  music-field edits, out of WP-055 scope
- `stash@{1}` — WP-068 / MOVE_LOG_FORMAT governance edits (quarantined
  during WP-062)
- `stash@{2}` — dirty tree before the WP-062 branch cut

Never pop these during WP-036. If any of them would unblock WP-036
work, raise it explicitly before touching — separate session, not a
WP-036 sub-task.

---

## Why WP-036 Is the Single-Hop Unblocker

Dependency analysis traced at end of the WP-060 session (verified
against `WORK_INDEX.md`):

```
WP-036 (AI Playtesting) ──┬── WP-037 → WP-038 → WP-039 → WP-040 → WP-041
                          │     (beta / launch / live-ops / growth / architecture)
                          │
                          └── WP-049 (+ WP-048 ✅) → WP-050 → WP-051 ──┬── WP-052
                                (PAR simulation / storage / gate)        (identity)
                                                                      ├── WP-053
                                                                      │    (score submission)
                                                                      └── WP-054
                                                                           (public leaderboards)
```

Ten WPs chain-blocked on WP-036. Nothing else in the current backlog
has this leverage:

- **WP-042.1** is blocked on FP-03 revival (D-4201), not on any code
  WP
- **WP-059** (Pre-Plan UI Integration) is deferred pending WP-028 UI
  framework decision
- **WP-066** (Registry Viewer Image-to-Data Toggle) is `Not yet
  reviewed` — must pass the review-gate per
  `.claude/rules/work-packets.md` invariant before execution

WP-036's dependency (WP-035 Release & Ops Playbook) landed 2026-04-19
at `d5935b5`, closed via `SPEC: 546b784` and `SPEC: a9f6c1a` back-
pointer D-entries. All upstream contracts WP-036 consumes are in place
(see next section).

---

## Upstream Contract Surface WP-036 Consumes (verify at pre-flight time)

Per WP-036 §Assumes (lines 43–62 of the WP). **The WP-036 pre-flight
must verify each of these exists at the listed path at
`main = cd811eb`.** Any missing surface is a BLOCKED verdict.

| Exported Symbol | File (under `packages/game-engine/src/`) | From WP |
|---|---|---|
| `ClientTurnIntent` | `network/intent.types.ts` | WP-032 |
| `UIState` | `ui/uiState.types.ts` | WP-028 |
| `filterUIStateForAudience` | `ui/uiState.filter.ts` | WP-029 |
| `ReplayInput` | `replay/replay.types.ts` | WP-027 |
| `computeStateHash` | `replay/replay.hash.ts` | WP-027 |
| `FinalScoreSummary` | `scoring/scoring.types.ts` | WP-020 |
| `makeMockCtx` | `test/mockCtx.ts` | WP-005B |

Also required:
- `docs/ai/ARCHITECTURE.md` contains the "MVP Gameplay Invariants"
  section — verify
- `docs/ai/DECISIONS.md` contains **D-0701** (AI Is Tooling, Not
  Gameplay) and **D-0702** (Balance Changes Require Simulation) —
  verify

The WP-036 pre-flight should run a grep-based verification pass for
each and lock the results as a Pre-Session Gate before authoring
code.

---

## EC-036 Slot Status (GOOD — no retargeting trap)

The EC-036 slot at
`docs/ai/execution-checklists/EC-036-ai-playtesting.checklist.md` is
**unconsumed**. The commit prefix `EC-036:` is the natural first
choice and is not rejected by `.githooks/commit-msg` (P6-36 rejects
`WP-036:` but not `EC-036:` when the corresponding EC file exists).

This is **unlike** WP-060, where the original EC-060 slot was
consumed by commit `6a63b1c` (earlier viewer-scope work, unrelated to
WP-060) and WP-060 had to retarget to EC-106 following the seven-row
precedent chain (EC-061 → EC-067, EC-066 → EC-068, EC-062 → EC-069,
EC-063 → EC-071, EC-080 → EC-072, EC-079 → EC-073, EC-064 → EC-074,
EC-060 → EC-106). WP-036 faces **no retargeting trap** — confirm at
pre-flight time by running `git log --all --oneline -- docs/ai/execution-checklists/EC-036-*`
and verifying no prior commit consumed the slot.

If the slot turns out to be consumed (unexpected), follow the seven-
row retargeting precedent and use the next free slot (likely EC-107).
Do NOT use `WP-036:` as the commit prefix regardless.

---

## Discipline Precedents to Apply

The post-Phase-6 landing sequence WP-034 → WP-035 → WP-042 → WP-055 →
WP-056 → WP-057 → WP-058 → WP-081 → WP-060 established a dense
precedent log (P6-00 through P6-51, plus WP-specific D-entries).
WP-036 should apply at minimum:

- **P6-22 (WP-031):** escaped-dot grep patterns for `boardgame\.io`
- **P6-27 (WP-031):** stage-by-name only; never `git add .` / `git add
  -A` — applied throughout WP-055/056/057/058/060/081 and throughout
  WP-036
- **P6-36 (WP-033):** `WP-###:` commit prefix forbidden; `EC-###:`
  required — applied to all WP-036 commits (use EC-036: or the
  retargeted slot if unavailable)
- **P6-43 (WP-034) / P6-50 (WP-042):** paraphrase discipline —
  `// why:` comments avoid engine-specific tokens when the WP is NOT
  in the engine runtime layer; WP-036 is Analysis/Tooling (likely a
  new package `packages/ai/` under a fresh D-entry code category, TBD
  by pre-flight), so paraphrase-discipline tokens will differ from
  engine WPs — lock the list at pre-flight time
- **P6-44 (WP-042):** `pnpm-lock.yaml` must not change when no
  `package.json` edited — applied at Verification Step time
- **01.6 post-mortem mandatory triggers:** WP-036 likely triggers at
  least one (new long-lived abstraction `AIPolicy` + possible new
  code-category directory under `packages/ai/`) — evaluate explicitly
  in the pre-flight and plan for a mandatory post-mortem if
  triggered. D-3401 / D-3501 / D-5601 are the recent new-code-
  category D-entries to use as the precedent for a potential
  WP-036 code-category D-entry

---

## Governance / Ops Lessons Surfaced in WP-060

These are not bridge-worthy for WP-036 content, but they are session-
level procedural lessons. Noting here so they don't need to be
rediscovered.

### R2 credentials are NOT in the default shell environment

The `r2:` rclone remote is configured with `env_auth = true` but
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are unset. Any WP that
needs an R2 upload (WP-060 did; WP-036 probably does NOT — it's
engine-consumer analysis tooling) must STOP and escalate at the
Pre-Session Gate, per WP-060 §Pre-Session Gate 8. The executor path
used for WP-060 was:

1. Author files locally
2. Hand off to the user for R2 upload
3. User uploads, confirms URL
4. Executor runs `curl -sI` HEAD probes to verify HTTP 200
5. Executor stages + commits only after R2 verification lands

WP-036 likely skips all of this (no R2 artifacts expected — see
EC-036 §Out of Scope at pre-flight time to confirm).

### `git checkout --merge <branch>` with dirty WT is a trap

During WP-060 close, I attempted `git checkout --merge main` with the
working tree holding pre-existing dirty-tree items. Three files
(`docs/00-INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/05-ROADMAP.md`)
came out with conflict markers inserted directly into the working-
tree content. No `MERGE_HEAD` was created (this is not a formal merge
state), so `git merge --abort` does not work. Recovery:

1. `git reset HEAD -- <3 conflicted files>` (unstage)
2. `git checkout <target-branch> -- <3 conflicted files>` (restore
   from branch)
3. `git merge --ff-only <tip-of-target-branch>` (fast-forward; leaves
   the remaining pre-existing dirty items intact)

**Better path for next time:** when fast-forwarding `main` to a topic
branch that is ahead, and the current branch has a dirty WT, use
`git branch -f main <tip>` instead. That updates the ref without
checking out `main`, so the dirty WT is untouched. Requires main to
not be currently checked out.

### Mystery untracked `docs/ai/ideas/` keeps surfacing

Originally flagged in WP-030 execution. Re-flagged in WP-060. Likely
to appear again during WP-036. Per the WP-030 precedent: note in the
execution summary, do NOT touch. Same disposition for all 11 other
untracked items unless WP-036 needs one specifically (unlikely).

---

## What This Bridge Does NOT Contain (Pre-Flight Scope)

Explicitly out of scope for this document. All of the following must
come from the WP-036 pre-flight session (`docs/ai/invocations/preflight-wp036-ai-playtesting-balance-simulation.md`):

- **AIPolicy contract lock** — exact TypeScript shape, argument order,
  legal-moves array derivation, seed injection mechanism, return-
  value constraints
- **RandomPolicy MVP shape** — PRNG seed handling, legal-move
  selection strategy, edge cases (zero legal moves, mandatory moves)
- **Simulation runner API** — inputs (seed, N, policies, scenario),
  outputs (metrics bundle), orchestration model (sync vs async,
  parallelization constraints)
- **Test count estimate** — number of new test files, describe
  blocks, individual `test()` calls; locked baseline shift for
  repo-wide total
- **D-entries to file** — likely a new code-category D-entry if
  `packages/ai/` is introduced (precedent: D-3401 versioning, D-3501
  ops, D-5601 preplan). Possible AI-policy-interface D-entries, a
  seed-handling D-entry, a metrics-aggregation D-entry
- **01.5 / 01.6 trigger evaluation** — likely 01.6 mandatory (new
  long-lived abstraction `AIPolicy` + likely new code category).
  01.5 NOT INVOKED as engine-contract clause (WP-036 is external
  tooling). Lock both at pre-flight time
- **Paraphrase-discipline token embargo list** — the set of tokens
  `// why:` comments in WP-036 code must avoid (depends on layer
  classification)
- **File allowlist** — exact list of new files to create and existing
  files to modify; the forbidden-files tripwire
- **Three-commit topology plan** — commit prefixes, exact staging
  order, governance-close artifacts to update
- **Copilot check (01.7) 30-issue lens** — CONFIRM / FIX / HOLD /
  SUSPEND verdicts and resolution plan for each issue

---

## Quick-Reference Index for WP-036 Pre-Flight

| Artifact | Path |
|---|---|
| WP-036 spec | `docs/ai/work-packets/WP-036-ai-playtesting-balance-simulation.md` |
| EC-036 checklist | `docs/ai/execution-checklists/EC-036-ai-playtesting.checklist.md` |
| ARCHITECTURE.md | `docs/ai/ARCHITECTURE.md` (check §Layer Boundary + §MVP Gameplay Invariants + §Moves & Determinism) |
| DECISIONS.md | `docs/ai/DECISIONS.md` (read D-0701 + D-0702; possibly D-1002 + D-1003 for growth/change classification) |
| Code style rules | `docs/ai/REFERENCE/00.6-code-style.md` |
| Pre-flight template | `docs/ai/invocations/preflight-wp060-keyword-rule-glossary-data.md` (most recent precedent, 2026-04-20) |
| Session prompt template | `docs/ai/invocations/session-wp060-keyword-rule-glossary-data.md` (most recent precedent) |
| Post-mortem template | `docs/ai/post-mortems/01.6-WP-058-preplan-disruption-pipeline.md` (most recent 01.6 MANDATORY precedent) |
| Precedent log | `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` (P6-00 through P6-51) |
| Review discipline | `.claude/rules/work-packets.md` (review gate, one-packet-per-session) |
| Paraphrase discipline | P6-43 (WP-034) + P6-50 (WP-042) in 01.4 precedent log |

---

*Bridge authored 2026-04-20 at session close of WP-060 / EC-106 on
`main @ cd811eb`. Author: session that executed WP-060. Intended
consumer: the next session's pre-flight on WP-036.*
