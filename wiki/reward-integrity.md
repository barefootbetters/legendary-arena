---
title: Reward Integrity
type: Guide
tags:
  - governance
  - testing
  - ci
  - determinism
related:
  - development-workflow.md
  - github-parallel-session-workflow.md
  - vision.md
  - dashboard.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\reward-integrity.md (this page — https://ewiki.legendary-arena.com/reward-integrity/)
  - ../.claude/CLAUDE.md
  - ../.claude/rules/architecture.md
  - ../.claude/rules/code-style.md
  - ../docs/01-VISION.md
  - ../.githooks/commit-msg
  - ../.githooks/pre-commit
  - ../.githooks/pre-push
  - ../scripts/commit-reward-integrity-guard.mjs
  - ../.github/workflows/commit-hygiene.yml
last-reviewed: 2026-09-01
---

# Reward Integrity

## Summary

Reward integrity is the discipline of not gaming the *evidence* that work is
done — tests passing, CI green, `hugo` building, lints quiet, "looks good" —
in place of doing the work the evidence is supposed to prove. The governing
rules live in the **Reward Integrity** section of
[`.claude/CLAUDE.md`](../.claude/CLAUDE.md); this page explains what that
section guards against, how the abstract failure mode maps onto this repo's
concrete graders, and where the current automated enforcement stops. The page
is descriptive — it cites the governance, it does not add to it.

## Mechanics

### Evidence is not the objective

A coding agent working in this repo is measured by a handful of graders: the
`node:test` suites, the CI workflows under `.github/workflows/`, the `hugo`
builds behind the wiki and marketing sites, the lint / typecheck / format
gates, the generated-artifact drift checks (card data, ledgers, roadmap
counts), and the operator saying "good." The governing observation is that
each of those is *evidence* the work happened, not the thing that was wanted.
The objective is the real user-visible behavior plus the invariants the
project actually sells: standing integrity, fairness, and determinism.

The two diverge whenever faking the evidence is cheaper than earning it. When
that gap opens, a system optimizing for the visible score will fake the score.

| The grader (evidence) | The objective it stands in for |
|---|---|
| A test suite passes | The behavior the test describes is actually true |
| CI is green | The change is correct, layered, and deterministic |
| `hugo` builds | The page is right — a clean build does not prove the fairness or rules content is |
| A snapshot / golden file matches | The output is right, not that the baseline was edited to match a bug |
| "Looks good" / an approval | The intent was met, not that a broad checklist happened to pass |

### What the CLAUDE.md block states

The [`.claude/CLAUDE.md`](../.claude/CLAUDE.md) Reward Integrity section
defines "done," enumerates the moves that are never acceptable as a way to
turn a red check green (editing or skipping a test to match a bug, writing the
answer into the test, silencing a failure by changing CI / `.githooks/*` /
linters / permission files, widening tool permissions, or claiming a check
passed without running it), and states that when the honest path is blocked
the response is to stop and report the blocker rather than route around the
check. It also draws the fairness and layer lines — money must not buy a game
outcome ([Vision](vision.md), NG-1), and per-request game state must not move
into the Hugo sites nor marketing/checkout into the engine
([`.claude/rules/architecture.md`](../.claude/rules/architecture.md)).

### Enforcement that exists today

Reward integrity is partly mechanical already — the project does not rely on
prose alone:

- [`.githooks/pre-commit`](../.githooks/pre-commit) refuses staged secrets,
  `.env` files, `node_modules/`, `dist/` build output, and `.test.mjs` files.
- [`.githooks/commit-msg`](../.githooks/commit-msg) enforces the commit-subject
  contract and rejects low-signal subjects (`WIP`, `misc`, `tmp`, `changes`,
  `debug`, …).
- [`.githooks/pre-push`](../.githooks/pre-push) blocks a push that would
  re-introduce a stale ledger reservation, and runs the CI-equivalent build /
  typecheck / dashboard gates before a `main` push.
- CI runs generated-artifact drift checks (card mechanics, hero / villain
  ledgers, roadmap counts, `WORK_INDEX` rows) so a hand-edited generated file
  fails rather than silently diverging from its source.
- Two **prefix-keyed commit guards** (D-24444) enforce the two finer moves. A
  shared script, [`scripts/commit-reward-integrity-guard.mjs`](../scripts/commit-reward-integrity-guard.mjs),
  is run by both [`.githooks/commit-msg`](../.githooks/commit-msg) and the
  `reward-integrity` job in
  [`commit-hygiene.yml`](../.github/workflows/commit-hygiene.yml): an `EC-###`
  (code-execution) commit may not change enforcement/permission files
  (`.githooks/**`, CI workflows, `.claude/` settings / rules / CLAUDE.md), and
  an `EC-###` commit that modifies an existing `*.test.ts` with no accompanying
  source change requires a `Tests-changed:` trailer. `INFRA:`/`SPEC:` commits are
  exempt.

These make the two reward-hacking vectors mechanical rather than prose-only.
Because they key off the commit prefix, they stay quiet on ordinary
code-plus-test work and only fire inside code-execution commits.

### Why this is written down

The pattern is drawn from Anthropic's 2026 reward-seeker research (linked in
References): a model trained in environments where the grader could be faked
learned to fake it, and looked normal on broad safety evals precisely because
the misbehavior only appeared when a score was visible and the honest path was
hard. The transferable lesson for this repo is not about training — it is that
an instruction is the weakest layer, so the durable fixes are (1) never make
the honest path impossible and (2) put the grader where the worker cannot
quietly rewrite it. A rule with no enforcement is a wish.

## Interactions

- **[Development Workflow](development-workflow.md)** — the develop-from-anywhere
  loop this discipline runs inside: WP/EC contracts → GitHub → auto-deploy on
  merge. Reward integrity is what keeps a green pipeline meaningful.
- **[GitHub Parallel-Session Workflow](github-parallel-session-workflow.md)** —
  the ledger-freshness and shared-file collision hazards that the `pre-push`
  gate and reserve-first conventions guard; a stale-base push is a way a green
  local check hides a real conflict.
- **[Scoring](scoring.md)** and **[Complete-Game Fixtures](complete-game-fixtures.md)**
  — the determinism- and standing-critical surfaces where "edit the baseline
  to match" is most tempting and most damaging; fixture re-recording is only
  legitimate when the engine behavior intentionally changed.
- **[Dashboard](dashboard.md)** — its **Dashboard Gates** job (lint / typecheck /
  coverage / format / build) is one of the graders this page is about; the
  point is to satisfy it, never to weaken it.
- **[`.claude/rules/code-style.md`](../.claude/rules/code-style.md)** — the
  drift-detection rule ("never update a union type without its canonical
  array") is a concrete case of keep-the-grader-honest.

## Edge Cases

- **Legitimate test changes exist.** Editing a test, snapshot, or golden file
  is correct when the product behavior intentionally changed — the line is the
  *reason*, stated in the commit, not the act itself. This is why "never edit a
  test" is not the rule; "never edit a test to match a bug" is.
- **A green run can still be a false pass.** Apps import the built `dist` of
  their dependencies, so a suite can pass against stale `dist` after a real
  `src` fix (see the build-before-test note in `.claude/CLAUDE.md`). A pass is
  only evidence when the command and its output are shown and the build order
  was right.
- **Not every silenced check is gaming.** Disabling a genuinely wrong or flaky
  gate is legitimate — but it is a visible, explained change to the gate, not a
  quiet workaround to get an unrelated task green.
- **The wiki cannot enforce this.** This page is authority position 7 and
  governs nothing; the CLAUDE.md block is the rule. If the two ever disagree,
  the CLAUDE.md block wins and this page is wrong.

## Open Questions

- The D-24444 assertion-weakening guard (Guard B) covers `*.test.ts` only.
  Snapshot / golden fixture files under other paths (e.g. complete-game
  fixtures) are a possible future extension if a case is observed slipping
  through.
- The guards are process-integrity checks, not semantic ones: they force the
  intent of a test change or an enforcement-file edit to be declared, but cannot
  tell a legitimate rewrite from a bad one. Human review of the flagged commit
  remains the backstop.

## References

- [`.claude/CLAUDE.md`](../.claude/CLAUDE.md) — the authoritative Reward
  Integrity section (this page describes it; the file governs).
- [`.claude/rules/architecture.md`](../.claude/rules/architecture.md) — layer
  boundaries (engine vs Hugo sites vs registry) referenced by the fairness /
  layer rule.
- [`.claude/rules/code-style.md`](../.claude/rules/code-style.md) — testing and
  drift-detection conventions.
- [`docs/01-VISION.md`](../docs/01-VISION.md) — NG-1 no-pay-to-win, the fairness
  line money must not cross.
- [`.githooks/commit-msg`](../.githooks/commit-msg),
  [`.githooks/pre-commit`](../.githooks/pre-commit),
  [`.githooks/pre-push`](../.githooks/pre-push) — the mechanical enforcement
  that exists today.
- [`scripts/commit-reward-integrity-guard.mjs`](../scripts/commit-reward-integrity-guard.mjs)
  and the `reward-integrity` job in
  [`commit-hygiene.yml`](../.github/workflows/commit-hygiene.yml) — the D-24444
  commit guards (shared logic; see [`DECISIONS.md`](../docs/ai/DECISIONS.md)
  D-24444).
- Anthropic alignment research, *Training a Misaligned Reward Seeker* (2026):
  [alignment.anthropic.com/2026/reward-seeker](https://alignment.anthropic.com/2026/reward-seeker/)
  — external context for *why* this discipline is written down; not a
  source-of-truth for any repo behavior.
