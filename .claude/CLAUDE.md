# Legendary Arena

A pnpm monorepo implementing the Legendary deck-building card game as a multiplayer web app using boardgame.io.

> This file and `.claude/rules/*.md` load on **every** turn, so they hold goals,
> invariants, and routing only. Procedures and rationale live in the docs they
> point to and load when a task needs them. Keep it that way: add a pointer,
> not a paragraph.

## Operating Posture (Why This Matters)

Legendary-arena.com is a real business: payroll every Friday, royalties to
Upper Deck and Marvel on every dollar, cloud and R2 bills, ongoing development.
Binding on every session:

- **Survival lens first.** Does this protect revenue, ship a better product, or
  reduce risk? Working code that ships beats elegant code that doesn't.
- **Anti-commercial drift is a bug.** "Permanently free," closed lists of
  permitted revenue, and similar caps are foreclosed payroll (auto-memory
  `feedback-vision-anticommercial-drift`).
- **Surface risk** to revenue, customer trust, or legal/financial exposure
  before acting, plus papercuts noticed in passing (stale env, doc drift,
  pre-existing test failures). Don't manufacture risk to look thorough.
- **Time and tokens are real costs.** Operator time is the most valuable
  resource on the project. No ceremony when the work is clear.
- **Mistakes land on the business.** Own it in one sentence, move on, don't repeat it.

## Quick Reference

- **Tech stack:** pnpm monorepo, boardgame.io ^0.50.0 (locked), TypeScript, Zod, PostgreSQL, Cloudflare R2
- **Test runner:** `node:test` (native Node.js test runner)
- **Test file extension:** `.test.ts` (never `.test.mjs`)
- **Module system:** ESM-only
- **Node version:** v22+ (uses built-in `fetch`)

## Key Commands

```bash
pnpm install          # install dependencies
pnpm -r build         # build all packages
pnpm -r test          # run all tests (root has no `test` script; bare `pnpm test` exits 1 silently)
```

### Build before you test (stale `dist` fakes failures)

Apps import the **built `dist`** of their package dependencies, not `src`. So
the order is always **`pnpm -r build && pnpm -r test`**, and rebuild before
diagnosing any cross-package test failure.

- **False green:** a `src` fix that never rebuilt still tests the old `dist`.
- **False red:** a stale or missing `dist` crashes a test file at import;
  `node:test` reports a failure and the file's tests never register, so totals
  shrink too (2026-07-19: registry-viewer showed 99 tests / 7 fail stale vs
  174 / 0 rebuilt, same commit).
- `pnpm -r test` **bails on the first failing package**; use
  `pnpm -r --no-bail test` for whole-repo totals.
- A build may rewrite CI-gated generated artifacts (e.g.
  `packages/lagn-spec/schemas/lagn-v1.json`). Check `git status` after
  building, and confirm a real diff exists before committing one; line-ending-only
  churn is noise, not a change.

## Session Start: Catch Up On `main`

Before substantive work, run `git fetch origin main --prune` and
`git log origin/main --oneline -10`. Surface only what changes the current ask
(a WP that already shipped, a touched contract / DECISIONS / ARCHITECTURE /
rules / REFERENCE doc, direct edits to the target files, an overlapping stash
or PR), one sentence each; if nothing relevant landed, say so in one line.

## Architecture Rules (see .claude/rules/ and .claude/skills/ for details)

Cross-cutting rules (architecture, code-style, work-packets) load every session
from `.claude/rules/`. Layer-specific rules (game-engine, registry, persistence,
server) load on demand via `.claude/skills/legendary-*/SKILL.md` and keep full
authority when triggered.

## Card Data (In-Repo Since 2026-05-06)

- **Sources:** `scripts/convert-cards/inputs/cards/*.js` (36 npm-derived sets)
  plus per-set overlays in `scripts/convert-cards/inputs/patches/`.
- **Generated output:** `data/cards/{abbr}.json`, the registry-consumed
  location. 41 sets: 36 converted by `convert-cards-v15.mjs`, 4 outliers
  (`2099`, `amwp`, `wpnx`, `wtif`) from `apply-card-counts.mjs` only, and
  `co2e.json` hand-authored.
- **Regeneration is multi-stage:** `convert-cards-v15.mjs`, then the `apply-*.mjs`
  passes (card-counts, hero-ability-markers, effect-markers,
  defeat-requirement-markers). Stage order: `docs/03-DATA-PIPELINE.md` §1;
  sources: `docs/03.1-DATA-SOURCES.md`.
- **Legacy:** `C:\Users\jjensen\bbcode\modern-master-strike\src\data\cards\` is a
  frozen mirror of old generated output. Nothing reads it; never edit or use it.

## External Data

- Card images hosted at: `https://images.legendary-arena.com/`
- Image URLs use hyphens, not underscores

## Documentation

- Architecture: `docs/ai/ARCHITECTURE.md` (authoritative — wins over work packets)
- Work packets: `docs/ai/work-packets/` (one per Claude session)
- Execution checklists: `docs/ai/execution-checklists/` (quick-reference per WP)
- Decisions log: `docs/ai/DECISIONS.md`

## Execution Checklists (Mandatory for Work Packet Execution)

When a WP has an EC (`docs/ai/execution-checklists/EC-NNN-*.checklist.md`),
read the EC before the session starts; it is the **authoritative execution
contract** and compliance is binary. The WP stays the design document and wins
if the two conflict; ECs are subordinate to `docs/ai/ARCHITECTURE.md` and
`.claude/rules/*.md`. Governance set: `docs/ai/REFERENCE/01.1-how-to-use-ecs-while-coding.md`
(workflow), `docs/ai/REFERENCE/01.2-bug-handling-under-ec-mode.md`,
`docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`, and
`docs/ai/execution-checklists/EC-TEMPLATE.md` / `EC_INDEX.md`.

## Lint Gate (Mandatory for Work Packet Actions)

Before creating or modifying a WP, executing a WP, migrating a legacy prompt
into a governed artifact, or proposing a cross-layer refactor spanning WPs,
satisfy the Prompt Lint Gate (`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`):
explicitly confirm every applicable item passes, **or** list each unmet item
with its justification and get approval. If the gate cannot be satisfied, STOP —
do not work around the checklist, guess, or silently proceed.

### File Modifications During Execution

Individual file edits during WP execution follow `.claude/rules/*.md`; the lint
gate covers WP quality, not every edit.

### Authority Constraints

The gate is subordinate to `docs/ai/ARCHITECTURE.md`, must not override
architectural or layer-boundary rules, and adds no requirements of its own. An
item that conflicts with ARCHITECTURE.md, the Layer Boundary, or
`.claude/rules/*.md` is constrained or treated as non-applicable.

## Multi-Step Workflow Integrity (No Skipped Steps, No False "Done")

For any reference doc that defines a multi-step workflow with artifacts — most
of all the WP-drafting preflight `docs/ai/REFERENCE/01.0a-wp-drafting-phase.md`:

- **Read the whole file before acting.** Length is never a reason to skim or
  work from a summary.
- **Execute every step, in order, to its artifact.** For `01.0a`, **Step 6
  (session prompt) and Step 7 (commit) are not optional**; green gates at Step 5
  are not the finish line. The WP is not ready until the session prompt exists
  and the drafting commit has landed per the Phase 1 Definition of Done.
- **Never report "done" or "ready to execute"** until the workflow's Definition
  of Done is met and every artifact exists (WP, EC, index rows, gate verdicts,
  session prompt, commit) — re-check each one before claiming completion. If a
  step was skipped, say which and why.

A premature "ready" is a false-completion claim and a bug, not a rounding error.

## Reward Integrity (Don't Game the Grader)

Tests, CI, `hugo` builds, and quiet lints are *evidence* of done, not the
objective. **Done means** the intended user-visible behavior is true, the
relevant tests pass *for the right reason*, and the fairness / determinism
invariants hold. It is NOT done when a check was deleted, skipped, weakened, or
pointed at a fixture that always passes. When faking the evidence is easier
than earning it, earn it or stop and report the blocker. Rationale:
[Reward Integrity](../wiki/reward-integrity.md).

**To turn a red check green, never:**
- Edit, delete, skip, or comment out a test, assertion, snapshot, or golden
  file — unless product behavior intentionally changed and the commit says so.
- Write the expected answer into the test.
- Modify CI, `.githooks/*`, linters, generated-artifact gates, or permission
  files to silence a failure you introduced.
- Widen tool permissions (`--dangerously-skip-permissions`, always-allow,
  disabled hooks) to finish a task.
- Claim a check passed without running it — paste the command and its output
  tail. A green run against a stale `dist` is not a pass.

**If the honest path is blocked** (missing fixture, unreachable command, a
config that cannot be created, a test that cannot pass without editing it),
STOP and report the blocker. Fix the environment; do not invent a path around
the check.

**Optimize the work, not the metric.** A pass count, a CI-green line, or a low
turn/token count is never the target; doing less real work to shrink one is
gaming.

**Fairness and layers stay intact.** Refuse any change that lets money or a
cosmetic buy a game outcome (`docs/01-VISION.md` NG-1, no pay-to-win). Keep
per-request game state out of the Hugo sites and marketing/checkout out of the
engine (`.claude/rules/architecture.md`).

**After a correction,** record the one-line falsifiable rule in its sink:
auto-memory for behavior, `docs/ai/DECISIONS.md` for an architectural call,
this file only for a repo-wide constraint. One line, not an essay.
