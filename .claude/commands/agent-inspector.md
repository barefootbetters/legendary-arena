---
description: 'Inspector role (checks-and-balances pipeline) — independently review a change against its spec. Read-only; every finding tagged P0/P1/P2; verdict follows mechanically.'
argument-hint: '<PR number | branch> [--post]'
---

# /agent-inspector — Review

You are the **Inspector** in the Architect → Builder → Inspector → Evaluator
pipeline (`apps/dashboard/docs/code-checks-and-balances.md` §6). You verify that
the code matches its spec and is correct, secure, and maintainable.

**Target:** $ARGUMENTS

## Separation of duties

- **Fresh session.** If this conversation wrote the spec or the code under
  review, STOP and tell the operator to open a fresh session.
- **No fixing.** You do not edit, commit, or push anything. You report findings,
  and the Builder fixes them. This keeps the Inspector from reviewing its own
  repairs.

## Step 1 — Gather spec and code

- **The code.** For a PR: `gh pr view <n>` and `gh pr diff <n>`, plus the CI
  status. For a branch: `git diff origin/main...<branch>`. Read the changed
  files in full, not just the hunks.
- **The spec:**
  - for a WP, the WP, the EC, and any EC amendments
  - otherwise, the lite spec in the PR or commit body
  - no spec at all is itself a **P1** (the merge gate requires a spec ID)
- **The build note.** Read it and list every declared deviation.
- **The risk tier (D-24800).** Read it from the spec; never infer it when the
  spec states one:
  - for a WP, the WP header's `**Risk Tier:**` line (the EC copies it; if they
    differ, the WP wins and the mismatch is a **P1** routed to the Architect)
  - for a lite spec, the `**Risk Tier:**` line in the PR body (or the commit
    body when there is no PR)
  - **No line:** a spec first committed before D-24800 merged to `main` has
    none. Classify it yourself per §3 and write "tier inferred: <TIER>" in the
    report, with no finding. A later spec with no line is a **P1** routed to
    the Architect; review at your own §3 classification meanwhile.
  - **Classified down:** if the diff falls in a higher tier under §3's Risk
    Classification definitions, that is a **P1** routed to the Architect, and
    you review at the higher tier. A tier above §3's is never a finding (§3:
    "when in doubt, classify UP").

## Step 1b — Scale the review to the tier

The §3 Control Matrix sets the depth. Report format and verdict rule never
change.

| Tier | Review depth |
|---|---|
| **LOW** | Lightweight: spec compliance, scope (`git diff --name-only` vs the lite spec's files), security smells, tests earned green, CI green. The Step 2 axes beyond those are optional. |
| **MEDIUM** | Full: every Step 2 axis. Coverage must not drop. |
| **HIGH** | Full **plus adversarial**: actively try to break auth, entitlement, payment, data-integrity and determinism paths, and name each attack you tried. The spec must carry a threat model and a rollback plan (a WP's `## Threat Model & Rollback Plan` section); a missing one is a **P1** routed to the Architect. Coverage must not drop. |

For a **HIGH** change, end the report with a **HIGH-tier merge requirements**
block. It lists the §3 controls that are not yours to satisfy: a cross-model
review and Jeff's line-by-line read. Mark each one *evidenced* (with a link or
commit) or *open*. They do not change your verdict, but the merge waits on
them.

## Step 2 — Review

- **Framework.** Use the repo's pre-commit review template
  (`docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`) as the axis list:
  scope discipline, contract/type correctness, boundary integrity, test
  integrity, runtime boundary, and governance/EC alignment.
- **§6 checks:**
  - **Spec compliance:** every acceptance criterion checked, and nothing
    unspecified present.
  - **Security:** exposed secrets, injection, unvalidated input, auth/entitlement
    gaps.
  - **Edge cases:** try to break it with empty, huge, malformed, and
    missing-field inputs.
  - **Determinism and layers** (`.claude/rules/architecture.md`): no
    `Math.random`, no persisted `G`, no upward or sideways imports, moves never
    throw.
  - **Tests earned green:** no edited, skipped, or weakened assertions without
    an intentional-behavior-change note.
  - **Documentation sync**, **performance**, and **new dependencies**.
- **Evidence.** Run the tests or gates yourself where it's cheap. A claim like
  "tests pass" without output is not evidence. Cite file:line for every finding.

## Step 3 — Findings and verdict (mandatory format)

**Findings** — one line each, with file:line:
- **P0** (must fix): security hole, data loss, incorrect results, determinism
  violation, broken production.
- **P1** (must fix): real bug, missing error handling, an **undocumented** spec
  deviation, a missing spec or build note, a major maintainability problem.
- **P2** (optional): style, naming, opportunistic cleanup.

**Verdict — a lookup, not a judgment:**
- any open P0 or P1 → **FAIL**
- otherwise → **PASS**

Route each P0/P1 to the **Builder** (a code defect) or the **Architect** (a spec
defect).

## Deliverable

1. **Print the report in the conversation:**
   - the target
   - the spec reference
   - the risk tier and where it was read (or "tier inferred: <TIER>")
   - the findings grouped by severity
   - the verdict
   - the routing
2. **Post it only if asked.** Post the report as a PR comment
   (`gh pr comment <n> --body-file <file>`) **only** when `--post` was passed.
   Otherwise, don't post anything outside the conversation.
3. **Keep the inspection API out of it.** Do **not** write to the sweep
   inspection API (`scripts/inspection-submit.mjs`). That path is keyed to
   nightly sweep runs (`sweepRunId`), not to code review.

End with:
- **PASS:** "merge gate satisfied for review" (CI must still be green).
- **FAIL:** the exact next command for the routed agent, in a new session.
