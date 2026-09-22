# EC-774 — Coach model eval pack + quirk-registry allowlist (Execution Checklist)

**Source:** docs/ai/work-packets/WP-737-coach-model-eval-pack.md
**Layer:** Server (`apps/server/src/coach/**`, `apps/server/scripts/`)
**Status:** Pending

## Before Starting
- [ ] Set up a fresh worktree off `origin/main` and capture the SHA. Run `pnpm install`, then `pnpm -r build` (expect exit 0). Run the server suite and record the baseline pass count.
- [ ] Read `coachModelConfig.ts` and its test, `coachClient.ts`, `coach.types.ts`, `coachSummary.logic.ts:140-148`, and `server.mjs` ~L1036–1070.
- [ ] Scope lock: exactly the 10 files in Files to Produce. Any other code edit → STOP. `apps/server` has no typecheck, so the tests are the gate.

## Locked Values (do not re-derive)
- Unregistered `COACH_MODEL` (including prototype keys) → `{ model: DEFAULT_COACH_MODEL, quirks: <default's row>, fallbackFromModel: <configured id> }`. Unset or empty → default with **no** `fallbackFromModel`.
- New exports:
  - `lookupCoachModelQuirks(model): CoachModelQuirks | undefined` (uses `Object.hasOwn`)
  - `CoachModelConfig.fallbackFromModel?: string`
- `DEFAULT_COACH_MODEL_QUIRKS` removed.
- `CoachEvalScenario.category: CoachEvalCategory`. `CoachEvalResult` fields: `scenarioId`, `isPassing`, `failures`. `CoachEvalRunSummary` fields: `totalCount`, `passedCount`, `failedCount`.
- Categories (`COACH_EVAL_CATEGORIES` + union): `baseline-win`, `unlucky-loss`, `lucky-win`, `two-seat-contribution`, `solo`, `hallucination-guard`, `no-purchases`, `pre-par-summary`, `tie`, `five-players`.
- Rubric term lists:
  - Luck: `["luck","lucky","luckily","unlucky","fortunate","unfortunate","adversity","twist","twists","escape","escapes","escaped"]`
  - No-purchases: `["buy","buys","bought","buying","recruit","recruited","recruiting","purchase","purchases","purchased","acquire","acquired","acquiring"]`
  - Two-seat: `[["Player 1","P1"],["Player 2","P2"]]`
  - Hallucination-guard `mustNotMention` names must not be ordinary English words (not Storm, Vision, Rogue, Beast, Cable, Angel, Wasp, Phoenix); use distinctive names such as Wolverine, Hawkeye, Deadpool.
- Matching is case-insensitive whole-term: `(?<!\w)` + regex-escaped term + `(?!\w)` (not `\b`), over headline + heroFit + purchases + every suggestion. There is no stemming; the lists enumerate inflections.
- Global rubric: headline, heroFit and purchases non-empty; 2–3 suggestions, each non-empty.
- Eval refusal order (all before any network call, all exit 1):
  1. `--model` missing
  2. no quirk row → `The model <id> has no quirk row; add one to COACH_MODEL_QUIRKS_BY_MODEL in coachModelConfig.ts before evaluating it.`
  3. unknown `--scenario`
  4. `ANTHROPIC_API_KEY` unset or empty → "ANTHROPIC_API_KEY is not set; export it in this shell to run the paid coach eval."
- Package script: `"coach:eval": "node --import tsx scripts/coach-eval.mjs"`. Exit 0 only when all scenarios pass.

## Guardrails
- **Zero paid calls in tests.** Neither `coachEval.logic.test.ts` nor `coachModelConfig.test.ts` constructs `createAnthropicCoachClient` or reads `ANTHROPIC_API_KEY`. `coachClient.test.ts` stays untouched. Prose in those two test files never names either token (use "the live client" / "the API key env var"), or the grep gate self-trips.
- **The eval is strict.** An unregistered model is refused, never evaluated as the fallback under the candidate's name.
- **The rubric is pure.** No I/O, no model call, no LLM judge.
- **Untouched:** prompt, summary builder, report shape, routes, entitlement, cache.
- **Not wired to CI or any workflow.** `coach:eval` is operator-run only.
- **The unregistered-model test is rewritten, not deleted.** This is an intentional behavior change under D-24559; say so in the `EC-774:` commit body.
- **Scenarios run sequentially** (`for...of` + `await`), never `Promise.all`.
- **Never loosen a rubric** to make the live operator check pass. Record a failed scenario as a finding.

## Required `// why:` Comments
- The fallback branch in `resolveCoachModelConfig`: the EC-629 failure class; the paid feature stays up.
- The `Object.hasOwn` lookup: prototype keys must not resolve as quirks.
- The `server.mjs` fallback warning.
- The eval's unregistered-model refusal: the eval is strict where production is forgiving.
- The luck-language constant in the fixtures.

## Files to Produce
- `apps/server/src/coach/coachModelConfig.ts` — **modified** — allowlist fallback + `lookupCoachModelQuirks`; header and JSDoc reworded
- `apps/server/src/coach/coachModelConfig.test.ts` — **modified** — fallback, prototype-key, lookup and row-cap tests
- `apps/server/src/server.mjs` — **modified** — one fallback warning (in-allowlist; 01.5 not invoked)
- `apps/server/src/coach/coachClient.ts` — **modified** — header comment only (the eval script now imports it too)
- `apps/server/src/coach/coachEval.types.ts` — **new** — rubric, scenario, category, result and summary types
- `apps/server/src/coach/coachEval.fixtures.ts` — **new** — ≥10 scenarios, one or more per category
- `apps/server/src/coach/coachEval.logic.ts` — **new** — pure `scoreCoachReport` + `summarizeCoachEvalRun`
- `apps/server/src/coach/coachEval.logic.test.ts` — **new** — rubric, whole-term, summary, fixture self-consistency and category drift
- `apps/server/scripts/coach-eval.mjs` — **new** — operator eval runner
- `apps/server/package.json` — **modified** — `coach:eval` script
- Govern-close (`SPEC:`):
  - `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`
  - operator comments in `.env.example` and `render.yaml`
  - `wiki/ai-second-brain.md`

## After Completing
- [ ] `pnpm -r build` exits 0. The server suite is green; record baseline → new counts in the commit body.
- [ ] Refusals each exit 1 with no network call: the unregistered model, an unknown scenario, and a missing key. The empty-key branch mirrors `server.mjs:1054` and is checked by reading the code.
- [ ] `git diff --name-only` for the `EC-774:` commit lists exactly the 10 files.
- [ ] STATUS says "No user-observable change — infrastructure only", with the payoff line.
- [ ] Operator check: `coach:eval --model claude-sonnet-5` with the real key; paste the totals into STATUS. The deployed startup log shows no fallback warning.
- [ ] Governance:
  - DECISIONS D-24559 Active; WORK_INDEX `[x]`; EC_INDEX Done
  - mindmap `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
  - `.env.example` / `render.yaml` comments corrected
  - ewiki note updated and wiki gates run

## Common Failure Smells (Optional)
- **The fallback test passes but production still sends the raw id.** `server.mjs` reads `process.env.COACH_MODEL` somewhere instead of `coachModelConfig.model`.
- **`COACH_MODEL=constructor` returns a function as quirks.** The lookup uses bracket access instead of `Object.hasOwn`.
- **"Thor" fails a report that said "authority".** Substring matching was used instead of whole-term.
- **A decoy ending in punctuation never matches.** `\b` was used instead of `(?<!\w)…(?!\w)`.
- **A hallucination-guard scenario fails self-consistency.** A decoy name appears in the scheme, mastermind, groups, pool or `acquiredCards`.
- **`coach:eval` waits on the network with no key.** The key check ran after client construction.
