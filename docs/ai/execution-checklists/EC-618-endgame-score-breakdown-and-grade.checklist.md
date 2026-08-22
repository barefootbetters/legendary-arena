# EC-618 — Endgame Score Breakdown + Grade Badge (Execution Checklist)

**Source:** docs/ai/work-packets/WP-583-endgame-score-breakdown-and-grade.md
**Layer:** Game Engine (`packages/game-engine` — pure grade helper) + Arena Client (`apps/arena-client` — display)

## Before Starting
- [ ] Preconditions A–E in WP-583 all pass (server already returns/persists the breakdown; client type omits it; no grade helper yet; `menaceTierFor` pattern present; EndgameSummary imports the engine)
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (baseline)
- [ ] `(cd apps/arena-client && pnpm vue-tsc --noEmit && pnpm test)` exit 0 (baseline)
- [ ] Capture baseline `finalStateHash` + `PRE_WP080_HASH` (must stay byte-identical — no engine G/fixture change)

## Locked Values (do not re-derive)
- Grade enum: `ScoreGrade = 'legendary' | 'a' | 'b' | 'c' | 'd' | 'f'`; canonical `SCORE_GRADES = ['legendary','a','b','c','d','f']`.
- Grade bands on `finalScore` (centesimal, lower=better, 0=PAR), ascending:
  `finalScore <= -1000 → legendary`; `<= -300 → a`; `<= 300 → b`; `<= 800 → c`; `<= 1800 → d`; else `f`.
- The engine ships the ENUM ONLY. The player-facing word ("Legendary", "A", …) lives in `apps/arena-client/src/vfx/gradeDisplay.ts` — the D-24367/D-24371 no-copy-in-`packages/` boundary.
- Breakdown is rendered VERBATIM from `record.scoreBreakdown` (already returned by both score endpoints). NEVER recompute client-side.
- NO server / persistence / migration change.

## Guardrails
- `gradeForFinalScore` is a PURE engine helper mirroring `menaceTierFor` (`rules/schemeLossProgress.ts`): no boardgame.io import, no `G`, no hashed field, no fixture. It is NOT stored anywhere — a read-only banding function.
- `SCORE_GRADES` is drift-pinned against the `ScoreGrade` union as a **RUNTIME** assertion (a keyset/value check), NEVER a bare `satisfies` (D-24372).
- `apps/arena-client/src/lib/api/competitionApi.ts` MUST NOT import from `@legendary-arena/game-engine`, `@legendary-arena/registry`, or `apps/server` — declare `scoreBreakdown` (and its nested `inputs` / `penaltyBreakdown`) as a LOCAL structural shape. Make the field OPTIONAL so a record without it still typechecks.
- `EndgameSummary.vue` MAY import `gradeForFinalScore` from `@legendary-arena/game-engine`. NOTE: its existing engine import is `import type { UIGameOverState }` — a TYPE-only import cannot carry a runtime value, so add a SEPARATE value import: `import { gradeForFinalScore } from '@legendary-arena/game-engine'`. The grade WORD comes from `gradeDisplay.ts`, not from the engine.
- Gate the breakdown block on `competitiveScore && competitiveScore.scoreBreakdown`; the existing headline stays for a record that lacks a breakdown. Guests/pending/failed (prop `null`) render the current summary unchanged — no crash.
- Accessibility: the grade badge conveys meaning by TEXT (the label) + `aria-label`, not colour alone; no required animation (reduced-motion safe). Vision §17.
- Determinism: both hash oracles MUST stay byte-identical (no engine `G`/fixture touched). If either moves, STOP — the change strayed out of scope.
- `for...of` never `.reduce()`; no `Math.random`/`Date.now`.

## Required `// why:` Comments
- On the grade threshold constants: centesimal, lower-is-better, 0 = PAR; the bands are tunable config, not a formula change.
- On the `SCORE_GRADES` drift pin: union + array move together (code-style §Drift Detection).
- On the local `scoreBreakdown` shape in `competitionApi.ts`: declared structurally because the file must not import engine/server types (mirrors the existing `MyCompetitiveScore` note).

## Files to Produce
- `packages/game-engine/src/scoring/parScoring.grade.ts` — **new** — `ScoreGrade` / `SCORE_GRADES` / `gradeForFinalScore`
- `packages/game-engine/src/index.ts` — **modified** — barrel export the three grade symbols
- `packages/game-engine/src/scoring/parScoring.grade.test.ts` — **new** — runtime drift pin + band-boundary tests
- `apps/arena-client/src/lib/api/competitionApi.ts` — **modified** — add optional local `scoreBreakdown` shape to `MyCompetitiveScore`
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **modified** — breakdown `<dl>` + grade badge
- `apps/arena-client/src/vfx/gradeDisplay.ts` — **new** — enum → label + CSS class (the display copy)
- `apps/arena-client/src/**/*.test.ts` — **modified/new** — EndgameSummary render + gradeDisplay unit tests

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (grade drift + band-boundary tests green)
- [ ] `(cd apps/arena-client && pnpm vue-tsc --noEmit && pnpm test)` exit 0 (breakdown renders; grade badge label per band; null-prop degrades)
- [ ] `finalStateHash` + `PRE_WP080_HASH` byte-unchanged
- [ ] `pnpm -r build` + `pnpm -r --no-bail test` — no new failures; `lagn-v1.json` CRLF churn (if any) reverted
- [ ] Live-on-surface (D-24026): finish a ranked match on play.legendary-arena.com; the endgame panel shows the component breakdown + a grade badge matching the finalScore band
- [ ] `docs/ai/STATUS.md` updated (names WP-583; D-24026 operator-pending)
- [ ] `docs/ai/DECISIONS.md` D-24392 landed Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-583 node `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)
- A hash oracle moved → something engine-`G`/fixture-adjacent was touched; the grade helper must be pure and unstored.
- vue-tsc errors on `scoreBreakdown` → the local shape doesn't structurally match the served JSON, or the field wasn't made optional.
- The word "Legendary" appears in `packages/` → the copy boundary was violated; the engine ships the enum only.
- The breakdown numbers differ from the server → something recomputed client-side instead of rendering `scoreBreakdown` verbatim.
- Grade badge invisible to a screen reader → it's colour-only; add the text label + `aria-label`.
