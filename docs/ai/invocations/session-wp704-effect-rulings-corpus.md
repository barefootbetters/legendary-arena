# Session Prompt — WP-704 / EC-741: Executable effect-rulings corpus (first slice)

**WP:** docs/ai/work-packets/WP-704-effect-rulings-corpus.md
**EC:** docs/ai/execution-checklists/EC-741-effect-rulings-corpus.checklist.md (authoritative execution contract)
**Reserves:** D-24524 (lands Active at govern-close). **Status:** READY TO EXECUTE.

> Committed via `git add -f` (session-*.md is gitignored) so the brief survives the drafting
> worktree's removal — per `feedback_session_prompt_lost_on_worktree_removal`.

## Invocation intent

Stand up the first slice of the **effect-rulings corpus**: a private JSON file of
`scenario → expected → why` card-effect edge-case rulings, executed by a `node:test`
harness against the **real engine handlers** so a ruling can never silently drift from
code. Test corpus only — no gameplay/determinism change.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` (Game Engine layer; the Node-built-ins-only import rule)
3. `.claude/rules/architecture.md`, `.claude/rules/code-style.md`, `.claude/skills/legendary-game-engine/SKILL.md`
4. WP-704 (design authority)
5. EC-741 (execution contract — satisfy every item exactly)
6. `wiki/card-effect-system.md` §Edge Cases + the seed decisions (D-24281, D-24329, D-24413, D-24442, D-24523)
7. `packages/game-engine/src/rules/ruleRuntime.integration.test.ts` (the harness precedent), `src/test/mockMoveContext.ts`, `src/setup/buildInitialGameState.ts`, `src/test/fixtureBuilders.ts`

## Pre-execution checks

- Baseline `origin/main` clean + synced; `pnpm --filter @legendary-arena/game-engine build && … test` green; record the baseline test count.
- Confirm `game-engine` has **no zod dependency** (`packages/game-engine/package.json`) — the validator is hand-written, Node built-ins only.

## Execution rules (operationalizing WP-704 + EC-741 — no new scope)

- **Runtime validator, NOT zod** — `packages/game-engine/src/rules/effectRulings.validate.ts`: a hand-written runtime type guard + closed scenario/expectation readonly unions with **runtime** drift pins (the `VillainEffectPrimitive` precedent). A zod import would break `pnpm -r build` and cross the layer boundary.
- **Corpus** — `docs/ai/rulings/effect-rulings.json`; each ruling `{ id (kebab, unique), mechanic, decision? (D-ref), scenario, expected, why (non-empty) }`.
- **Harness** — `packages/game-engine/src/rules/effectRulings.test.ts`: build minimal `G` via `buildInitialGameState`/`fixtureBuilders`, fire through the **real handler** with `makeMockMoveContext` (NOT `makeMockCtx`), assert on **handler output**. Resolve the corpus path via `import.meta.url` + `path.resolve` (never `process.cwd()`); iterate in **file order**; the fs read is a test-harness exemption to the `src/rules/` no-I/O rule.
- **Per-ruling non-vacuity self-test (the crux)** — a standing guard that perturbs **every** ruling's `expected` and asserts **that** ruling fails. No one-shot manual flip; no `it.skip`; no always-pass; never re-implement a handler in the harness.
- **Seed set** — target ≥ 8 from decided edge cases, **subordinate to vocabulary minimalism**: ship fewer + defer the rest rather than adding a verb just to hit the count. Write each ruling's `why` against the cited decision's actual text (esp. D-24442).
- **No engine behavior change** — no production `src` handler edit, no `G` field, no move/phase/UIState; `finalStateHash`/`PRE_WP080` sentinels byte-identical (verify).
- **Private naming** — "effect rulings", never "LAGN rulings"; nothing in `packages/lagn-spec`.

## SAFE-KNOBS scope

N/A — no knob surface.

## Session task

Execute WP-704 per EC-741: validator + corpus + harness + per-ruling non-vacuity self-test
+ seed set + authoring README. Two-commit topology: `EC-741:` implementation, then `SPEC:`
govern-close (land D-24524 Active; flip WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅,
`roadmap:counts:write`, `ledger:numbers:check`). Open one PR. No D-24026 live-verify
(internal test infra, no user surface).

## Post-merge close ritual (REQUIRED)

After the operator merges the PR (GitHub UI):
- `node scripts/prune-empty-claude-branch.mjs --verify-current` from the worktree (expect `VERIFY PASS`).
- `git branch -D <branch>` + `git push origin --delete <branch>`.
- `node scripts/prune-empty-claude-branch.mjs --report` from canonical (expect silent).

## Scope restriction

This prompt restates/operationalizes WP-704 + EC-741 only. No new scope, files, contract
elements, locked values, or forbidden patterns. New surface goes back into the WP/EC and
re-runs the gates.
