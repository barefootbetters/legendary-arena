# EC-651 — Per-Player Team-Contribution Attribution (Execution Checklist)

**Source:** docs/ai/work-packets/WP-616-team-contribution-attribution.md
**Layer:** Game Engine (scoring)

## Before Starting
- [ ] WP-588 on `origin/main`: `deriveScoringInputs` builds `perPlayer[]` by
      walking `gameState.playerZones[id].victory` (bystanders via `isBystanderCard`);
      `PlayerScoringContribution` = `{ playerId, victoryPoints, bystandersRescued }`.
- [ ] `computeFinalScores` classifies victory-pile cards by type (villain / henchman
      / mastermind-tactic / bystander) for VP — the classification to REUSE.
- [ ] Fresh worktree off `origin/main` (`497f2e77`); baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 3 code files: `parScoring.types.ts`, `parScoring.logic.ts`,
      `parScoring.logic.test.ts`. Any edit outside → STOP.
- [ ] Read D-24397 + the legendary-game-engine skill + code-style §Contract Files.
- [ ] `pnpm -r build` 0; engine suite green (incl. both hash oracles).

## Locked Values (do not re-derive)
- New `PlayerScoringContribution` fields (all `readonly number`):
  `mastermindTacticsDefeated`, `villainsDefeated`, `henchmenDefeated`.
- Populated in the SAME `deriveScoringInputs` per-player victory-pile walk; 0 when none.

## Guardrails
- **Projection-only, hash-neutral.** Derived from terminal `G` in the existing pass —
  NO new `G` field, no `ctx` change; both hash oracles (`finalStateHash`,
  `PRE_WP080_HASH`) MUST stay byte-identical. Score / PAR / grade unchanged.
- **Reuse the classification.** Count by the SAME per-type logic `computeFinalScores`
  applies to the victory pile — never a parallel classifier (it could drift from VP).
- **Contract discipline.** `parScoring.types.ts` is a contract file; the additions
  land with D-24427 (architecture-reviewed). Required numbers (default 0), not
  optional fields.
- **No migration** — `perPlayer` rides `score_breakdown` jsonb (additive).
- **Deep-copy site:** copy the three new fields where `perPlayer` is deep-copied.
- **`for...of`, no branching `.reduce()`; JSDoc per field.**

## Files to Produce
- `packages/game-engine/src/scoring/parScoring.types.ts` — **modified** — 3 fields
- `packages/game-engine/src/scoring/parScoring.logic.ts` — **modified** — populate + deep-copy
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — **modified** — per-player defeat-count assertions

## After Completing
- [ ] `pnpm -r build` 0; engine suite green; **both hash oracles byte-identical**.
- [ ] Score / PAR / grade unchanged (a per-player count is display-only).
- [ ] `git diff --name-only` — the `EC-651:` implementation commit is only the 3 files.
- [ ] STATUS.md updated; DECISIONS.md D-24427 Active; WORK_INDEX WP-616 `[x]`;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.
- [ ] **Live-verify: N/A** — surface = none (infrastructure; the consumer badge is a follow-on).

## Common Failure Smells (Optional)
- A hash oracle moved → you added a `G` field or touched the score, not just the projection.
- Counts drift from VP → you wrote a parallel classifier instead of reusing `computeFinalScores`'.
- The deep-copy site lost the new fields → a copied `perPlayer` reads 0 where the original didn't.
- A migration in the diff → `perPlayer` is jsonb-additive; no schema change is needed.
