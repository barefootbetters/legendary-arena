# EC-849 — "Outcome not recorded" / "Ended early", not "Draw", for a non-tie result (Execution Checklist)

**Source:** docs/ai/work-packets/WP-812-result-lagn-unknown-outcome-label.md
**Layer:** Server (`/result-lagn` envelope) + App (`apps/legends-board` label)

## Before Starting
- [ ] **WP-811 / EC-848 has merged to `main`.** If not, STOP (BLOCKED).
- [ ] `pnpm install`, `pnpm -r build` → 0. Record the server baseline (`pnpm --filter @legendary-arena/server test`; 1790 after WP-811, 1791 if its AC 8 applied, +3 if #2779 merged). legends-board → 135 tests, 0 fail; `typecheck` → 0.
- [ ] Re-read the anchors (all `~`; WP-811 shifted `matchLagn.logic.ts`):
  - `matchLagn.logic.ts`: `StoredGameover`, `toLagnResult`, `VERDICT_NOT_RECORDED`
  - engine `endgame.evaluate.ts` `:~41-49` (ended early = `{ outcome: 'tie', endedEarly: true }`, D-24306) and `endgame.types.ts` `:~19`, `:~40`
  - `matchLagn.routes.ts`: the `/result-lagn` handler, its `toLagnResult(gameover)` call and its `koaContext.body = { lagn }`
  - `matchLagn.routes.test.ts`: the decisive `Object.keys(body)` assertion, the tie test, WP-811's no-seam legacy-artifact test
  - `matchResultDisplay.ts` `formatOutcome` / `parseResultLagn`; `matchResultDisplay.test.ts` "Draw" expectations; `matchResultDownload.ts` (reads `body.lagn` only)
- [ ] Check #2779 (D-24717) on `main`: if merged, its gate sits above (the new lines go at the end of the handler) and the `/result-lagn` catalog row is rebuilt from the row on `main`, keeping its D-24717 text.

## Locked Values (do not re-derive)
- **Wire field** `resultOmittedReason`, values `'tie' | 'ended-early' | 'unknown'`, on the `/result-lagn` 200 envelope beside `lagn`; present **only** when `lagn.result` is omitted.
- **Server** (`matchLagn.logic.ts`): `StoredGameover` gains `readonly endedEarly?: boolean;`. After `toLagnResult`: `export type ResultOmittedReason = 'tie' | 'ended-early' | 'unknown';` and `toResultOmittedReason(gameover: StoredGameover): ResultOmittedReason | undefined`: `undefined` when `toLagnResult(gameover) !== undefined`; `'ended-early'` when `gameover.endedEarly === true`; `'tie'` when `gameover.outcome === 'tie'`; else `'unknown'`. It calls `toLagnResult`.
- **Route:** `const resultOmittedReason = toResultOmittedReason(gameover);` beside `toLagnResult`; 200 body `{ lagn }` when `undefined`, else `{ lagn, resultOmittedReason }`.
- **Client** (`matchResultDisplay.ts`): `export type ResultOmittedReason = 'tie' | 'ended-early' | 'unknown'`; `formatOutcome(result: LAGN['result'], resultOmittedReason: ResultOmittedReason | undefined): { label: string; isDecisive: boolean }` (second parameter required): `victory` → `{ label: 'Victory', isDecisive: true }`; `defeat` → `{ label: 'Defeat', isDecisive: true }`; `'tie'` → `{ label: 'Draw', isDecisive: false }`; `'ended-early'` → `{ label: 'Ended early', isDecisive: false }`; otherwise `{ label: 'Outcome not recorded', isDecisive: false }`. `parseResultLagn` reads the reason from the envelope, never from `lagn`.
- **Docs:** `api-endpoints.md` `/result-lagn` row (post-WP-811) replaced whole + footer, and the runbook line `:~125` — WP Locked Values verbatim.

## Guardrails
- No edit to `packages/**`, `matchResultDownload.ts`, `MatchResultPanel.vue`, the arena-client, `/lagn`, `/seat-identities` or WP-811's readers / capture / sweep.
- The field never appears inside `lagn`; `lagn_version` and validation are unchanged.
- A decisive body stays exactly `{ lagn }` (the existing `Object.keys` assertion must stay green unchanged).
- No new query, no engine import in production code (`matchLagn.logic.ts` / `matchLagn.routes.ts`), no re-derived verdict: map the `gameover` the route already holds. Only the logic test imports the engine `.` surface, for `engineVerdictFor`.
- Only the exact `'tie'` yields "Draw"; `endedEarly: true` wins over the `'tie'` string; a missing reason is unknown.
- legends-board must not import from `apps/server` (mirror the type locally).
- Test edits are limited to: the decisive `formatOutcome` test gaining the second argument and the precedence assertion; the two client "Draw" tests gaining a `'tie'` input (expectation unchanged) and retitles; the malformed-body test's expected label ("Draw" → "Outcome not recorded"); the two strengthened route tests; and additions. Any other failing test = STOP and diagnose.
- The logic tests build the tie and ended-early verdicts with the engine's `evaluateEndgame` (`engineVerdictFor`), not by hand. A decisive verdict / `result` always wins over `endedEarly` or any reason.

## Required `// why:` Comments
- `toResultOmittedReason`: LAGN has no tie outcome; the envelope disambiguates; it calls `toLagnResult` so the pairing is exact. The `endedEarly` check: the engine stores an early end as `'tie'` (D-24306).
- The route's conditional 200 body: beside, never inside, `lagn`; decisive body unchanged.
- `formatOutcome`: only an explicit tie may claim "Draw" and only `'ended-early'` "Ended early"; a missing reason (a server before WP-812) reads unknown.
- The new route tests' `gameover: {}` (WP-811's unknown verdict) and ended-early verdict, `engineVerdictFor` (a counters-only state suffices; engine-built so a reshaped flag fails the test), the decisive-with-`endedEarly` pairing entry and the client precedence assertion, and the client test's `undefined` reason case.

## Files to Produce
- `apps/server/src/match/matchLagn.logic.ts` + `.test.ts` (+5) — **modified**
- `apps/server/src/match/matchLagn.routes.ts` + `.test.ts` (+2, 2 strengthened) — **modified**
- `apps/legends-board/src/panels/matchResultDisplay.ts` + `.test.ts` (+3, 4 changed) — **modified**
- `docs/ai/REFERENCE/api-endpoints.md`, `docs/ops/RUNBOOK-legends-match-result-live-verify.md` — **modified**
- `docs/ai/DECISIONS.md` (D-24720 + D-24719 follow-up line), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **governance close**

## After Completing
- [ ] `pnpm -r build` → 0; server = baseline + 7, 0 fail; legends-board 138 / 0 fail; legends-board `typecheck` → 0; `pnpm -r --no-bail test` → 0 fail.
- [ ] The twelve mutants per WP AC 7 (3 / 3 / 2 / 3 / 1 / 2 / 1 / 1 / 1 / 1 / 1 / 1 fail), each restored.
- [ ] `git status --porcelain --untracked-files=all` ⊆ allowlist; revert `lagn-v1.json` CRLF churn.
- [ ] D-24720 Active (every WP DoD clause); D-24719 follow-up line. STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `pnpm roadmap:counts:write`, then `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-849:` then `SPEC:`) with a `Tests-changed:` trailer for `matchResultDisplay.test.ts` and `matchLagn.routes.test.ts`, worded exactly as the WP DoD.
- [ ] D-24026 live-verify after both deploys (WP DoD steps 1–5): decisive keys `["lagn"]`; an unknown-outcome artifact → `"unknown"` + "Outcome not recorded"; a non-early tie artifact if one exists → `"tie"` + "Draw"; an ended-early match → `"ended-early"` + "Ended early"; STATUS flip.

## Common Failure Smells
- **Every match shows "Outcome not recorded":** the client reads the reason from `lagn` instead of the envelope, or the server never sets it.
- **A tie still shows "Outcome not recorded" after both deploys:** the server compares a different string than the engine's `'tie'`.
- **An abandoned match shows "Draw":** the `endedEarly` check is missing or runs after the `'tie'` check.
- **The decisive route test's `Object.keys` assertion fails:** the reason is emitted as `undefined` instead of being omitted.
- **The downloaded file carries `resultOmittedReason`:** the field was put inside `lagn`. `validate()` still passes (the schema is not `.strict()`), so only the envelope tests catch it; it belongs beside `lagn`.
- **The downloaded file changed:** `matchResultDownload.ts` was edited; it must save `body.lagn` only.
