# EC-657 — AI Coach Reads Per-Seat Team Contribution (Execution Checklist)

**Source:** docs/ai/work-packets/WP-622-coach-per-seat-contribution.md
**Layer:** Server (`apps/server/src/coach/coachSummary.logic.ts`)

## Before Starting
- [ ] WP-616 on `origin/main`: `PlayerScoringContribution` carries + exports
      `mastermindTacticsDefeated` / `villainsDefeated` / `henchmenDefeated`; the
      stored jsonb `scoreBreakdown.inputs.perPlayer` carries them.
- [ ] Fresh worktree off `origin/main`; baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 4 code files: `coach.types.ts`, `coachSummary.logic.ts`,
      `coachClient.ts`, `coachSummary.logic.test.ts`. Any edit outside → STOP.
- [ ] `pnpm -r build` 0; server suite green.

## Locked Values (do not re-derive)
- Field names match `PlayerScoringContribution` exactly: `mastermindTacticsDefeated`,
  `villainsDefeated`, `henchmenDefeated`.
- Counts on `CoachPlayerLine` are required `number`, populated `?? 0` (default 0 for
  pre-WP-616 records).

## Guardrails
- **Coach summary only.** No score / hash / wire-shape / persistence change — the
  counts are already in the stored breakdown. No route, no migration.
- **Constant system prompt.** Keep `COACH_SYSTEM_PROMPT` per-request-free (a
  prompt-cache target) — describe the fields generically, no match-specific text.
- **`// why:`** on the `?? 0` default (older records carry no per-seat counts).
- Import `PlayerScoringContribution` from the engine runtime-safe surface (already
  exported; `badge.predicates.ts` imports it the same way).

## Files to Produce
- `apps/server/src/coach/coach.types.ts` — **modified** — 3 counts on `CoachPlayerLine`
- `apps/server/src/coach/coachSummary.logic.ts` — **modified** — keep the contribution in the map + populate `?? 0`
- `apps/server/src/coach/coachClient.ts` — **modified** — system-prompt block on the 3 fields
- `apps/server/src/coach/coachSummary.logic.test.ts` — **modified** — flow-through (2 seats) + default-0 (pre-WP-616)

## After Completing
- [ ] `pnpm -r build` 0; server suite green (new coach cases pass).
- [ ] **Live-on-surface (D-24026):** the AI Coach panel for a co-op match reads each
      seat's contribution. The model's narration is non-deterministic, so the
      field-presence unit tests are the gate.
- [ ] `git diff --name-only` — the `EC-657:` implementation commit is only the 4 files.
- [ ] STATUS.md updated; DECISIONS.md D-24433 Active; WORK_INDEX WP-622 `[x]`;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- A pre-WP-616 record shows `undefined` counts → the `?? 0` default is missing.
- `tsc` red on the map → you narrowed the map value type instead of keeping the whole `PlayerScoringContribution`.
- A prompt-snapshot test breaks → expected; update it to the new constant prompt (still no match-specific text).
- The score / grade changed → contribution counts leaked into scoring (they are summary-only).
