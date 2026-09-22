# WP-737 — Coach model eval pack + quirk-registry allowlist (Server)

**Status:** Draft 2026-09-22 (EC-774; D-24559 reserved)
**Primary Layer:** Server (`apps/server/src/coach/**`, `apps/server/scripts/`)
**Dependencies:** WP-594 / D-24403 (the endgame coach) ✅, coach model-independence shim (PR #1619, `coachModelConfig.ts`) ✅, EC-629 hotfix (PR #1599, the disabled-thinking quirk) ✅
**User-Visible Surface:** none — infrastructure. Payoff: a `COACH_MODEL` swap is checked before it reaches paying players, and a misconfigured id falls back to the known-good model instead of returning `coach_unavailable`.
**Baseline:** `origin/main` @ `5b608fc2`

---

## Goal

Make a `COACH_MODEL` swap safe before it reaches paying players. Two changes:

1. **Allowlist, not open default.** Today an unregistered `COACH_MODEL` goes to the
   API with no thinking directive, which is how the EC-629 empty-response bug
   happens on thinking-by-default models. After this WP it falls back to
   `DEFAULT_COACH_MODEL` with that model's quirks, and the server logs a
   full-sentence startup warning naming the model it refused.
2. **Eval pack before the swap.** A fixed set of scenario match summaries plus a
   deterministic rubric scorer. Before changing `COACH_MODEL` in Render, the
   operator runs `pnpm --filter @legendary-arena/server coach:eval --model <id>`
   against the candidate model. It prints a pass/fail table per scenario and exits
   non-zero on any failure.

---

## User-Visible Impact

No user-observable change; this is infrastructure only. If an operator sets
`COACH_MODEL` to a model without a quirk row, the Legendary-Pass coach panel stays
up on the default model instead of returning `coach_unavailable` on every call.
For the operator, a swap now has a check to run first, and a typo or unvetted
model id shows up in the startup log.

---

## Assumes

All verified at baseline `5b608fc2`:

- `coachModelConfig.ts` exposes:
  - `DEFAULT_COACH_MODEL`
  - `resolveCoachModelConfig(environment)`
  - a private `COACH_MODEL_QUIRKS_BY_MODEL` with rows for `claude-sonnet-5`,
    `claude-opus-5` and `claude-sonnet-4-6` (L78–112)

  An unregistered model currently resolves to `DEFAULT_COACH_MODEL_QUIRKS` (L139).
  That constant is referenced only inside this file.
- `createAnthropicCoachClient(apiKey, config)` (`coachClient.ts`) throws on an empty
  text response (L218), a missing JSON object (L98), or a wrong-shaped report (L129).
- `server.mjs:1052` is the only production caller of `resolveCoachModelConfig`
  (repo-wide grep). It treats an empty `ANTHROPIC_API_KEY` as unset (L1054).
- `CoachMatchSummary` (`coach.types.ts`):
  - is fully server-generated, with no player free-text
  - `outcome` includes `'tie'`
  - `adversityExpected` is optional
  - per-player `label` is always `Player N` (`coachSummary.logic.ts:145`); there is
    no bot-seat marker
  - the engine's `maxPlayers` is 5 (`game.ts:331`)
- The server test script globs `scripts/**/*.test.ts` and `src/**/*.test.ts` under
  `node --import tsx --test`. An `.mjs` file under `apps/server/scripts/` run with
  `node --import tsx` resolves `../src/coach/*.js` specifiers to the `.ts` sources.
  Pre-flight confirmed this empirically.
- `apps/server` has no `build` script and no tsconfig. `pnpm -r build` does **not**
  type-check these files, so a green build is not type coverage; the tests are the
  gate.
- `pnpm -r build` exits 0. At baseline the server suite reports **tests 1554 /
  pass 1352 / fail 0 / skipped 202** (the skips are DB-gated). The draft session
  observed this in the drafting worktree. The executor re-records it and the new
  totals in the `EC-774:` commit body.
- Fixture display names come from real card data (`data/cards/*.json`).

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md`: D-24403 (the coach), D-24341 (AI Second Brain; the
  Model Independence principle). D-24559 supersedes the shim's open-default
  behavior.
- `apps/server/src/coach/coachModelConfig.ts`: the shim this WP tightens.
- `apps/server/src/coach/coachModelConfig.test.ts`: its last test ("an unregistered
  model swaps in by config alone with default quirks") pins the behavior this WP
  **intentionally** changes. It is rewritten under D-24559, not deleted.
  Pre-flight's scaffold ran the fallback prototype: 11 tests, 10 pass, and the only
  failure is exactly this test.
- `apps/server/src/coach/coachClient.ts`: the client the eval script drives. Its
  header says it is "imported ONLY by `server.mjs`", which stops being true, so the
  header comment is updated.
- `apps/server/src/coach/coach.types.ts`: `CoachMatchSummary` and `CoachReport`.
- `apps/server/src/server.mjs` L1036–1070: the coach wiring.
- `.env.example` L107–113 and `render.yaml` L138–147: operator comments that say an
  unregistered model "uses … the safe default". Both are corrected at govern-close.
- ewiki `wiki/ai-second-brain.md`: "Gateway routing for the endgame coach" and the
  Edge Case on thinking-by-default models, the design record behind this WP.

**Why now.** The coach is gated behind the Legendary Pass (`coach.logic.ts`), so it
is a paid feature, and EC-629 has already taken it fully dark once. The model
roster moves: `claude-opus-5-5` already exists with no quirk row. A mistyped or
unvetted `COACH_MODEL` should fall back to the known-good model, not leave a broken
panel.

**Split decision.** This is one WP. The allowlist and the eval pack serve the same
purpose, a safe swap, and live in one directory: 10 code/config files in a single
layer.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:`-prefixed imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English words,
  `is`/`has`/`can` booleans, JSDoc on every function, `// why:` on non-obvious
  choices, no branching `.reduce()`.
- Error messages are full sentences.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and
ask.

**Env:** no new variables.
- `COACH_MODEL` stays as-is (Render dashboard + `.env.example`).
- `coach:eval` reads `ANTHROPIC_API_KEY` from the operator's shell
  (`$env:ANTHROPIC_API_KEY = '<key>'`) and uses no `--env-file`.
- An empty key is treated as unset, mirroring `server.mjs:1054`.

**Packet-specific:**
- **Zero paid calls in CI.** Neither new nor modified test file
  (`coachEval.logic.test.ts`, `coachModelConfig.test.ts`) constructs
  `createAnthropicCoachClient` or reads `ANTHROPIC_API_KEY`. The existing
  `coachClient.test.ts` constructs the client only against a stubbed
  `globalThis.fetch` and is untouched. Prose in those two test files must not name
  either token (say "the live client" / "the API key env var"), or the
  Verification grep self-trips. The eval script is operator-run only and is
  never wired into `test`, CI, or a workflow.
- **The eval is strict; production is forgiving.** Production falls back to the
  default model for an unregistered id. The eval script **refuses** one: it exits 1
  before any network call. It never evaluates the fallback model under the
  candidate's name.
- **Rubric is deterministic.** `scoreCoachReport` is a pure function of
  (scenario, report): no I/O, no model call, no LLM judge in this WP.
- **Prompt unchanged.** `COACH_SYSTEM_PROMPT`, `buildUserMessage`, and the summary
  builder are not touched. The eval measures the production prompt on production
  summary shapes.
- **No persistence.** Results go to stdout, plus an optional `--out` JSON path the
  operator chooses. Nothing is written to `legendary.coach_reports` or any other
  table.
- **Never loosen the rubric to get a green run.** If the live check fails a
  scenario, record it as a prompt or model finding in STATUS. Do not edit that
  scenario's rubric to pass.

---

## Scope (In)

### A) `coachModelConfig.ts` (**modified**)
- `CoachModelConfig` gains `readonly fallbackFromModel?: string`. It is set only
  when an unregistered `COACH_MODEL` was replaced.
- `resolveCoachModelConfig` behavior:
  - unset or empty → default (unchanged)
  - registered → that model's row (unchanged)
  - **unregistered → `{ model: DEFAULT_COACH_MODEL, quirks: <default model's row>,
    fallbackFromModel: <configured id> }`**
- New export `lookupCoachModelQuirks(model: string): CoachModelQuirks | undefined`.
  It uses `Object.hasOwn`, so prototype keys (`constructor`, `toString`) return
  `undefined`. `resolveCoachModelConfig` uses the same lookup.
- `DEFAULT_COACH_MODEL_QUIRKS` is removed. Rewrite the file header and the JSDoc at
  L73–77 and L123–127 to describe the allowlist. Drop the claim that a swapped model
  "never re-inherits another model's workaround": the fallback inherits the default
  model's quirks by design.

### B) `coachModelConfig.test.ts` (**modified**)
- Rewrite the unregistered-model test to assert the fallback: `model` is the
  default, `quirks` is the default's row, and `fallbackFromModel` carries the
  requested id. The commit body cites D-24559 as the intentional behavior change.
- Add tests that:
  - registered, unset and empty resolutions carry no `fallbackFromModel`
  - `COACH_MODEL=constructor` falls back
  - `lookupCoachModelQuirks` returns the row for each seeded model, and `undefined`
    for an unknown id, `'toString'`, and `'constructor'`
  - every registry row has `maxOutputTokens > 0`

### C) `server.mjs` (**modified**; on the allowlist, so the 01.5 wiring allowance is NOT invoked)
- After `resolveCoachModelConfig(process.env)`, if `fallbackFromModel` is set, call
  `console.warn` once, with a `// why:` comment. The message is one full sentence
  naming the refused id and the model actually used, with the fix: "add a quirk row
  in coachModelConfig.ts or correct COACH_MODEL".

### D) `coachClient.ts` (**modified — header comment only**)
- Replace "imported ONLY by `server.mjs`" with: imported by `server.mjs`
  (production) and `scripts/coach-eval.mjs` (operator eval).
- No code change.

### E) `coachEval.types.ts` (**new**; a contract file, locked once created)
- `CoachEvalRubric`:
  - `mustMentionAny?: readonly (readonly string[])[]` — each inner list is a set of
    alternatives, and the report must contain at least one from every list
  - `mustNotMention?: readonly string[]`
  - both use **case-insensitive whole-term** matching — `(?<!\w)` + the
    regex-escaped term + `(?!\w)` (works for any term edge, unlike `\b`) — across
    headline + heroFit + purchases + every suggestion. Term lists enumerate
    inflections explicitly (no stemming)
- `CoachEvalScenario`: `id`, `category: CoachEvalCategory`, `description`,
  `summary: CoachMatchSummary`, `rubric: CoachEvalRubric`.
- `CoachEvalCategory`: a union of the 10 category tags in §F, plus the
  `COACH_EVAL_CATEGORIES` canonical readonly array. A runtime drift test asserts
  they match.
- `CoachEvalResult`: `scenarioId`, `isPassing: boolean`,
  `failures: readonly string[]` (each a full sentence).
- `CoachEvalRunSummary`: `totalCount`, `passedCount`, `failedCount`.

### F) `coachEval.fixtures.ts` (**new**)
- `COACH_EVAL_SCENARIOS: readonly CoachEvalScenario[]`: **at least 10** scenarios,
  with unique ids and at least one per category.
- The luck-language constant is `["luck","lucky","luckily","unlucky","fortunate","unfortunate","adversity","twist","twists","escape","escapes","escaped"]`,
  with a `// why:`.
- Categories and their required rubric:
  1. `baseline-win`: heroes-win, adversity at or below expected.
  2. `unlucky-loss`: scheme-wins, actual adversity well above `adversityExpected`.
     `mustMentionAny: [<luck-language>]`.
  3. `lucky-win`: heroes-win, actual adversity well below expected.
     `mustMentionAny: [<luck-language>]`.
  4. `two-seat-contribution`: 2 seats labelled `Player 1` and `Player 2`, with
     different defeat counts. `mustMentionAny: [["Player 1","P1"], ["Player 2","P2"]]`.
     A bot-seat signal is absent from `CoachMatchSummary` and is a follow-up, not
     this WP.
  5. `solo`: 1 player.
  6. `hallucination-guard`: `mustNotMention` lists ≥3 real Legendary hero names
     that appear nowhere in the summary (heroes, every `acquiredCards` string,
     scheme, mastermind, villain groups, henchman groups). The names must not be
     ordinary English words (not Storm, Vision, Rogue, Beast, Cable, Angel, Wasp,
     Phoenix); use distinctive names such as Wolverine, Hawkeye, Deadpool.
  7. `no-purchases`: one seat has an empty `acquiredCards`.
     `mustMentionAny: [["buy","buys","bought","buying","recruit","recruited","recruiting","purchase","purchases","purchased","acquire","acquired","acquiring"]]`.
  8. `pre-par-summary`: `adversityExpected` omitted.
  9. `tie`: outcome `tie`.
  10. `five-players`: 5 seats.

### G) `coachEval.logic.ts` (**new**)
- `scoreCoachReport(scenario, report): CoachEvalResult` checks, in order:
  1. global structure: headline, heroFit and purchases are non-empty, and there are
     2–3 suggestions, each non-empty
  2. `mustMentionAny`
  3. `mustNotMention`
- `summarizeCoachEvalRun(results): CoachEvalRunSummary` counts with a plain
  `for...of` loop.
- No I/O.

### H) `coachEval.logic.test.ts` (**new**)
- Rubric:
  - a compliant canned report passes
  - each rule (every structure check, `mustMentionAny`, `mustNotMention`) has a
    canned failing report whose failure sentence names the rule
  - whole-term matching: "Thor" does **not** match "authority"; "Spider-Man"
    matches "Spider-Man"; "luck" does **not** match "lucky" (hence the explicit
    inflection lists)
- `summarizeCoachEvalRun` counts correctly for a mixed result set.
- Fixture self-consistency (no model):
  - ≥10 scenarios with unique ids
  - every `COACH_EVAL_CATEGORIES` member appears
  - the `COACH_EVAL_CATEGORIES` ↔ union drift check
  - every `hallucination-guard` `mustNotMention` name is absent from its summary
    per the §F list

### I) `apps/server/scripts/coach-eval.mjs` (**new**)
- `parseArgs` options:
  - `--model <id>` (required)
  - `--scenario <id>` (optional, repeatable)
  - `--out <path>` (optional JSON output)
- Refusal order (none needs the network), each a full sentence and exit 1:
  1. `--model` missing
  2. `lookupCoachModelQuirks(model)` is `undefined` → `The model <id> has no quirk row; add one to COACH_MODEL_QUIRKS_BY_MODEL in coachModelConfig.ts before evaluating it.`
  3. an unknown `--scenario` id
  4. `ANTHROPIC_API_KEY` unset or empty → "ANTHROPIC_API_KEY is not set; export it
     in this shell to run the paid coach eval."
- Run the selected scenarios **sequentially** (`for...of` + `await`) through
  `createAnthropicCoachClient(key, { model, quirks }).generate(summary)`:
  - if `generate` throws, the scenario fails and the error message is kept (the
    EC-629 regression signal)
  - otherwise score the report with `scoreCoachReport`
- Print a per-scenario table and totals. Exit 0 only when every scenario passes.
- The file header states that a run makes one paid API call per scenario.

### J) `apps/server/package.json` (**modified**)
- Add `"coach:eval": "node --import tsx scripts/coach-eval.mjs"`.

---

## Out of Scope

- **No live-model check in CI or any workflow.** The eval is operator-run and never
  a required check (it costs money and is nondeterministic).
- **No LLM-as-judge or cross-model scoring.** The rubric is deterministic only.
- **No change to** the system prompt, summary builder, report shape, routes,
  entitlement, cache table, or `coach_unavailable` semantics.
- **No bot-seat signal in `CoachMatchSummary`.** The system prompt already mentions
  bot-ally games, but the summary cannot mark a bot seat. That is a separate
  follow-up.
- **No LiteLLM or gateway work.** Option B stays the routing layer (ewiki Open
  Question 5).
- **No new quirk rows** (e.g. `claude-opus-5-5`). Adding a model is a separate
  one-row change, gated by running this eval.
- **No dashboard surfacing** of eval results (a possible Evaluator-lane follow-up).
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/server/src/coach/coachModelConfig.ts` — **modified** — allowlist fallback + `lookupCoachModelQuirks`
- `apps/server/src/coach/coachModelConfig.test.ts` — **modified** — fallback + lookup tests (unregistered test rewritten per D-24559)
- `apps/server/src/server.mjs` — **modified** — one startup warning (in-allowlist; 01.5 not invoked)
- `apps/server/src/coach/coachClient.ts` — **modified** — header comment only
- `apps/server/src/coach/coachEval.types.ts` — **new** — rubric / scenario / category / result types
- `apps/server/src/coach/coachEval.fixtures.ts` — **new** — ≥10 scenarios
- `apps/server/src/coach/coachEval.logic.ts` — **new** — pure scorer + run summary
- `apps/server/src/coach/coachEval.logic.test.ts` — **new** — rubric, summary, fixture self-consistency tests
- `apps/server/scripts/coach-eval.mjs` — **new** — operator eval runner
- `apps/server/package.json` — **modified** — `coach:eval` script

No other **code** files may be modified. The govern-close `SPEC:` commit edits:
- STATUS, DECISIONS, WORK_INDEX, EC_INDEX, and the mindmap
- the operator config comments in `.env.example` (L107–113) and `render.yaml`
  (L138–147), which move from "the safe default" to "falls back to the default
  model with a startup warning; run `coach:eval` before a swap"
- the ewiki `ai-second-brain.md` coach operating notes

---

## Contract

- `resolveCoachModelConfig(environment)`: unset or empty → default; registered →
  that model's row; unregistered, including prototype keys → default model + the
  default's quirks + `fallbackFromModel`. It never returns an unregistered model
  id.
- `lookupCoachModelQuirks(model)`: the model's own registry row (`Object.hasOwn`),
  or `undefined`.
- `scoreCoachReport(scenario, report)`: pure;
  `isPassing === (failures.length === 0)`.
- `coach:eval` exit codes: `0` when all scenarios pass. `1` when any scenario
  fails, or on a missing model, an unregistered model, an unknown scenario, or a
  missing key.
- New contract file `coachEval.types.ts` holds `CoachEvalRubric`,
  `CoachEvalScenario`, `CoachEvalCategory` + `COACH_EVAL_CATEGORIES`,
  `CoachEvalResult`, and `CoachEvalRunSummary`.

---

## Vision Alignment

- **Vision clauses touched:** §2, §3, §19, NG-1, NG-7, Financial Sustainability.
- **Conflict assertion:** No conflict. This WP preserves all touched clauses. It
  protects a paid feature's reliability.
- **Non-Goal proximity:** NG-1..8 are not crossed. The coach stays advisory,
  post-match and off-ranking, and never feeds the score or `G`.
- **Determinism:** no gameplay, scoring, replay or RNG change. `scoreCoachReport`
  is pure. Live model output is nondeterministic by nature and is never a CI gate.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A. The `GET /api/me/scores/:replayHash/coach` request and response shapes are
unchanged. `resolveCoachModelConfig` and `lookupCoachModelQuirks` are not
catalogued library entries; `api-endpoints.md` carries only the coach route row,
L301.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] An unregistered `COACH_MODEL`, including a prototype key, resolves to
  `DEFAULT_COACH_MODEL` + its quirks with `fallbackFromModel` set. Registered, unset
  and empty resolutions are unchanged and carry no `fallbackFromModel`.
- [ ] `server.mjs` logs exactly one full-sentence warning on fallback, and none
  otherwise.
- [ ] `lookupCoachModelQuirks` returns seeded rows, and `undefined` for unknown ids
  and prototype keys.
- [ ] `COACH_EVAL_SCENARIOS` has ≥10 scenarios covering all 10 categories. The
  hallucination-guard names are absent from their summary.
- [ ] `scoreCoachReport` passes a compliant report, fails each rule with a sentence
  naming it, and matches whole words only.
- [ ] `coach:eval` exits 1 with no network call for an unregistered model, an
  unknown scenario, and a missing key. The empty-string branch mirrors
  `server.mjs:1054` and is checked by reading the code, since PowerShell cannot
  set an empty env var.
- [ ] Neither `coachEval.logic.test.ts` nor `coachModelConfig.test.ts` constructs
  `createAnthropicCoachClient` or reads `ANTHROPIC_API_KEY`.
- [ ] `pnpm -r build` exits 0. The server suite is green at the baseline count plus
  the new cases, with both counts recorded in the commit body. The `EC-774:` diff
  is exactly the 10 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test
# Expected: exit 0; the new coachEval + coachModelConfig cases pass

Select-String -Path "apps\server\src\coach\coachEval.logic.test.ts","apps\server\src\coach\coachModelConfig.test.ts" -Pattern "createAnthropicCoachClient|ANTHROPIC_API_KEY"
# Expected: no match

$env:ANTHROPIC_API_KEY = "unused-dummy"; pnpm --filter @legendary-arena/server coach:eval --model claude-not-a-real-model
# Expected: exit 1, the "has no quirk row" sentence, no network call

pnpm --filter @legendary-arena/server coach:eval --model claude-sonnet-5 --scenario no-such-scenario
# Expected: exit 1, the unknown-scenario sentence, no network call

Remove-Item Env:ANTHROPIC_API_KEY; pnpm --filter @legendary-arena/server coach:eval --model claude-sonnet-5
# Expected: exit 1, the "ANTHROPIC_API_KEY is not set" sentence, no network call

git diff --name-only
# Expected (implementation commit): exactly the 10 files above
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **D-24026 (surface = none, infrastructure):** STATUS.md states "No
  user-observable change — infrastructure only", with the payoff line from the
  header.
- [ ] **Operator check (additional):** one `coach:eval --model claude-sonnet-5` run
  with the real key, totals pasted into STATUS. If a scenario fails, it is recorded
  as a finding and the rubric is not loosened. The deployed server's startup log
  shows **no** fallback warning with `COACH_MODEL` unset.
- [ ] All acceptance criteria pass.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/DECISIONS.md`: D-24559 landed Active.
- [ ] `WORK_INDEX.md` WP-737 is `[x]`, and `EC_INDEX.md` EC-774 is Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then
  `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.
- [ ] The operator comments in `.env.example` and `render.yaml` are corrected.
- [ ] The ewiki `ai-second-brain.md` coach operating note is updated, and the wiki
  gates run.

---

## Reserved Decision (lands at execution)

- **D-24559 (reserved; Drafted 2026-09-22):** the coach model registry is an
  allowlist.
  - An unregistered `COACH_MODEL`, including a prototype key, falls back to
    `DEFAULT_COACH_MODEL` and its quirks with a startup warning, instead of being
    sent with default quirks. This supersedes the shim's original "any model swaps
    in with default quirks" behavior. The paid feature degrades to the known-good
    model rather than going dark (the EC-629 failure class).
  - Model swaps are gated by the operator-run `coach:eval` pack. The pack refuses
    unregistered models, uses a deterministic whole-term rubric, and is never a
    required CI check.

---

## Lint Gate Self-Review (00.3)

Run 2026-09-22 by an independent reviewer. First pass: 7 FAIL, all wording or
consistency. All seven are applied in this revision:

| Section | Fix applied |
|---|---|
| §2 | engine-wide block + session protocol |
| §4 | DECISIONS in Context |
| §10 | Env block |
| §13 | refusal order + PowerShell key handling |
| §14 | test-construction AC narrowed to the two new or modified test files |
| §15.1 | surface = none, infrastructure + STATUS line |
| §16.3 | `isPassing` + `*Count` names |
| §17 | clause list + conflict assertion |

- §21 API catalog confirmed N/A (only the coach route row, L301, `Wired`).
- All other sections PASS or N/A.
- **Re-run (round 2):** every first-pass FAIL fixed. Two new RISKs were raised and fixed in round 3: §13 (the empty-key AC is checked by reading the code, because PowerShell cannot set an empty env var) and §18 (test-file prose must not name the grepped tokens). All sections now PASS or N/A.

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-22)**, conditional on PS-1..PS-3. All three are
applied in this revision:

- **PS-1:** the bot-ally category is replaced by `two-seat-contribution`, because
  production labels are always `Player N`.
- **PS-2:** `server.mjs` is in-allowlist, so 01.5 is not invoked.
- **PS-3:** the `.env.example` / `render.yaml` operator comments are added to
  govern-close.

The recommended clarifications are also applied:

| Item | Change |
|---|---|
| RS-1 | `Object.hasOwn` + prototype-key tests |
| RS-2 | whole-term matching + a wider hallucination-guard scan |
| RS-3 | locked no-purchases terms |
| RS-4 | test-construction wording |
| RS-5 | baseline + new counts recorded in the commit body |
| RS-6 | unknown-scenario refusal |
| RS-7 | empty key = unset |
| RS-8 | `coachClient.ts` header comment in scope |
| RS-9 | unverified model id dropped |
| RS-10 | no server typecheck noted in Assumes |

Scaffold evidence: the fallback prototype on scratch copies gave 11 tests, 10 pass,
1 expected failure (the rewritten test).

## Copilot Check (01.7)

**First pass: RISK / HOLD** on #4 (contract drift), #26 (implicit content
semantics), #11 (tests vs invariants), and #30 (pre-session fixes). Every flagged
item is resolved in this revision by PS-1..3 and RS-1..5.

**Round 2: RISK / HOLD.** All first-pass items are fixed, but whole-word `\b` matching over un-inflected term lists would fail correct reports ("luck" does not match "lucky"), punctuation-edged terms break `\b`, and the WP and EC worded the quirk-row refusal differently.

**Round 3 fixes:**
- inflection-enumerated term lists
- `(?<!\w)…(?!\w)` whole-term matching
- one locked refusal sentence in both files
- `category: CoachEvalCategory`
- `P1`/`P2` alternatives

**Round 3: RISK / HOLD on two one-line items.**
- #26: decoy hero names that are ordinary English words (Storm, Vision, …) would
  false-fail correct reports.
- #4: the EC's empty-key wording disagreed with the WP.

Both lines were applied verbatim as the reviewer supplied them. The reviewer
stated the verdict is **CONFIRM** with those two lines in, and the pre-flight
READY TO EXECUTE stands. Reviewer note, not a finding: the luck and no-purchases
rubrics are deliberately loose, catching an absent topic rather than grading
quality.

---

## See Also

- WP-594 / D-24403 — the coach
- EC-629 / PR #1599 — the empty-response hotfix
- PR #1619 — the model-independence shim
- ewiki `ai-second-brain` — Gateway routing for the endgame coach; Edge Cases
- D-24341 — AI Second Brain architecture
