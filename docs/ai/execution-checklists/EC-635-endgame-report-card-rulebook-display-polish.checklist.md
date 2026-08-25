# EC-635 — Endgame Report Card: Rulebook-Faithful Display Polish (Execution Checklist)

**Source:** docs/ai/work-packets/WP-600-endgame-report-card-rulebook-display-polish.md
**Layer:** Arena Client (display only). Stacked on WP-599 (PR targets the WP-599 branch).

## Before Starting
- [x] Branch off the WP-599 HEAD (the corrected scoring model); engine dist built in the worktree.

## Locked Values (do not re-derive)
- Scoring-key weights (from WP-599 / D-24409): Victory Point −10; villain escaped +10; scheme twist +30; bystander lost +40. A rescued bystander is **not** a separate award (it scores inside VP at 1 VP).

## Guardrails
1. `buildScoringKey()` lives in `vfx/scoreCalcDisplay.ts` as a documented client constant (the `gradeDisplay` precedent) — cross-ref D-24409; pin the weights in a test.
2. `EndgameSummary.vue`: render the key beside the grade scale (inside the competitive-score section); terminology — per-player "bystanders rescued", PAR-derivation "expected bystanders rescued"; tint the raw-ledger sides + per-player chip restyle. No new prop, no `competitionApi` change.
3. Display only — no engine/scoring/server/`G` change; no hash re-pin; values still rendered verbatim from the breakdown.

## After Completing
- [x] `vue-tsc --noEmit` clean; `scoreCalcDisplay` + `EndgameSummary` tests green (+4); full arena-client suite green (1434/0)
- [ ] Live-on-surface (D-24026): a completed ranked match shows the penalties/awards key, tinted ledger, seat chips, and rescued/lost terminology
- [ ] STATUS names WP-600; DECISIONS D-24410 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap node; `pnpm roadmap:counts:write`
