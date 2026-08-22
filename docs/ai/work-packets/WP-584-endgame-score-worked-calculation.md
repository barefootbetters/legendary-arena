# WP-584 — Endgame Score as a Worked Calculation (Formula-First)

**Status:** Draft 2026-08-22 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com`. The endgame score, which WP-583 rendered as a flat component list, is now shown as a **worked solution** — a symbolic formula, then the values substituted, the products, and the result; then `Final = Raw − PAR → Grade`. D-24026 live-verification applies.
**Primary Layer:** Arena Client (`apps/arena-client`) — ONLY.
**Dependencies:** WP-583 / D-24392 (the endgame breakdown + grade this reformats); WP-578 / D-24387 (the server-returned score record). All landed. Baseline `origin/main` at draft: `bc594c45`.

## Goal

WP-583 put the score components on the endgame screen, but as a flat list of numbers — it doesn't *show the work*. The operator (reviewing a real match) asked for it rendered "like a math teacher grading a student's work": the formula, the values plugged in, the arithmetic, the result. This WP reformats the existing breakdown into that worked solution. **Operator design choices (confirmed at draft): formula-first** (symbolic formula line, then substitution) and **whole numbers** (the centesimal integers already shown, no ÷100).

## User-Visible Impact

After a ranked match, the endgame panel shows: the givens (rounds, bystanders rescued, VP, escapes, lost, twists); then `Raw = (Rounds × 50) + Penalties − (Bystanders × 200) − (VP × 10)`, the same line with match values substituted, the weighted products summed, and `= Raw`; then `Final = Raw − PAR = … = Final` with the grade. Guests / pending / non-scoring matches degrade to the unchanged summary. No monetization, engine, server, or persistence change. D-24026 applies.

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

```bash
# A. WP-583's breakdown display + grade badge are present (this reformats them)
grep -q "arena-hud-score-breakdown" apps/arena-client/src/components/hud/EndgameSummary.vue && grep -q "gradeForFinalScore" apps/arena-client/src/components/hud/EndgameSummary.vue && echo "A_OK"
# Expected: A_OK

# B. The client score type already carries the full scoreBreakdown (WP-583) — no type change needed
grep -q "CompetitiveScoreBreakdown" apps/arena-client/src/lib/api/competitionApi.ts && echo "B_OK"
# Expected: B_OK

# C. The worked-calc helper does not exist yet
! grep -rq "buildWorkedScoreCalc" apps/arena-client/src && echo "C_OK"
# Expected: C_OK
```

## Context (Read First)

- `apps/arena-client/src/components/hud/EndgameSummary.vue` — WP-583's `.score-breakdown` `<dl>` lists the components (rounds, BP, VP, penalties, weighted terms, PAR) flat. This WP replaces that `<dl>` with a worked-calculation block; the headline + grade badge are unchanged.
- `apps/arena-client/src/lib/api/competitionApi.ts` — `MyCompetitiveScore.scoreBreakdown: CompetitiveScoreBreakdown` (WP-583) already carries every field the worked calc needs (`inputs`, `weightedRoundCost`, `weightedPenaltyTotal`, `penaltyBreakdown`, `weightedBystanderReward`, `weightedVictoryPointReward`, `rawScore`, `parScore`, `finalScore`). **No type / server / persistence change.**
- **Weights are DERIVED, never hardcoded.** The engine's scoring weights (roundCost 50, bystanderReward 200, vpReward 10; penalty weights) are NOT exposed to the client. To show `× 50` etc. honestly, the helper derives each weight as `product ÷ count` (guarded `count > 0`); a zero-count term shows its `0` product with no invented weight. This keeps the shown formula from ever drifting from the engine's real weights — the same no-duplication discipline as the D-24367 grade/menace boundary.
- The values are rendered **verbatim** from `record.scoreBreakdown` (WP-578 / D-24387 preserved) — the client never recomputes the score.

## Scope (In)

- **`apps/arena-client/src/vfx/scoreCalcDisplay.ts`** — **new** pure helper: `buildWorkedScoreCalc(breakdown): WorkedScoreCalc` returning the `givens`, the symbolic `formula`, the `substituted` line (values plugged in; penalties expanded to their nonzero `count × weight` terms), the `products` line, `rawScore`, `parScore`, `finalSubstituted` (`Raw − PAR`, wrapping a negative PAR in parens), and `finalScore`. Weights derived (`product ÷ count`, guard `count > 0`); no Vue import.
- **`apps/arena-client/src/components/hud/EndgameSummary.vue`** — replace the `.score-breakdown` `<dl>` with the worked-calc block (givens row + Raw block: formula / substituted / products / result + Final block: `Raw − PAR` / result), gated on the same optional breakdown; add `workedCalc` computed via `buildWorkedScoreCalc`; monospace + tabular-nums styles so the arithmetic lines up. Headline + grade badge unchanged.
- **Tests** — `vfx/scoreCalcDisplay.test.ts` (**new**: formula/substituted/products/final strings; derived weights; multi-penalty expansion; zero-count reward degrades gracefully; positive-vs-negative PAR) + `components/hud/EndgameSummary.test.ts` (**modified**: assert the worked-calc lines render; grade / null-degrade tests unchanged).

## Out of Scope

- Any engine / server / persistence / migration / hash change — pure client reformat of WP-583's already-returned data.
- `competitionApi.ts` — unchanged; the `scoreBreakdown` shape already carries every needed field.
- The grade badge, the dead `par-breakdown` `<dl>`, and the WP-578 headline — unchanged.
- Changing any scoring weight or the ÷100 units — the numbers stay whole (centesimal), weights derived.
- Leaderboard/legends — still the deferred follow-up from WP-583.

## Files Expected to Change

- `apps/arena-client/src/vfx/scoreCalcDisplay.ts` — **new** (pure worked-calc builder)
- `apps/arena-client/src/vfx/scoreCalcDisplay.test.ts` — **new**
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **modified** (worked-calc block + computed + styles)
- `apps/arena-client/src/components/hud/EndgameSummary.test.ts` — **modified**
- `docs/ai/DECISIONS.md` — **modified** (land D-24393)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified**
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-584 node `📝` → `✅`; `pnpm roadmap:counts:write`)

Arena-client only; single-session lane.

## Contract (Locked by D-24393)

- **Formula-first** (operator choice): symbolic formula line, then substituted, then products, then result; then `Final = Raw − PAR → Grade`.
- **Whole numbers** (operator choice): centesimal integers as shown today; no ÷100.
- **Weights derived** from `record.scoreBreakdown` (`product ÷ count`), never hardcoded client-side; a zero-count term shows its `0` product with no invented weight.
- **Verbatim**: values rendered from the server record, never recomputed (WP-578 / D-24387).
- **Client-only**: no engine / server / persistence / hash change.
- **Accessible**: the worked calc is real text with `aria-label`s per line; not colour-dependent.

### Determinism / persistence

No engine `G`, fixture, snapshot, DB, or migration touched — a pure client display reformat. `finalStateHash` / `PRE_WP080_HASH` untouched (no engine change).

## Acceptance Criteria

1. `buildWorkedScoreCalc` produces the formula-first strings with weights derived from the breakdown (e.g. game-2: `(Rounds × 50) + Penalties − (Bystanders × 200) − (VP × 10)` → `(29 × 50) + (6 × 300) − (11 × 200) − (103 × 10)` → `1450 + 1800 − 2200 − 1030` → `20`; `Final = 20 − (−300) = 320`).
2. Multiple nonzero penalties expand in fixed order; no penalties → `0`; a zero-count reward term shows its `0` product with no invented weight; positive PAR is not parenthesized.
3. On the endgame screen, an authenticated winner sees the worked calculation (formula → substituted → products → raw, then `Final = Raw − PAR → Grade`), values verbatim.
4. Guest / pending / no-breakdown records degrade to the unchanged summary; the grade badge still shows whenever a score exists.
5. No engine / server / persistence / hash change; `competitionApi.ts` unchanged. Arena-client `vue-tsc` + tests green; `pnpm -r --no-bail test` no new failures.

## Verification Steps

```bash
grep -n "buildWorkedScoreCalc" apps/arena-client/src/vfx/scoreCalcDisplay.ts apps/arena-client/src/components/hud/EndgameSummary.vue
! grep -qE "× 50|× 200|× 10" apps/arena-client/src/vfx/scoreCalcDisplay.ts && echo "no hardcoded weights OK"   # weights derived, not literal
git diff --name-only | grep -E 'packages/game-engine|apps/server|migrations' ; echo "expect none (client-only)"
(cd apps/arena-client && pnpm vue-tsc --noEmit 2>&1 | tail -3 && pnpm test 2>&1 | tail -4)
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -6
# Live (post-deploy; D-24026): finish a ranked match; the endgame panel shows the worked formula + Final = Raw − PAR → grade.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–C passed before the edit
- [ ] All 5 Acceptance Criteria pass
- [ ] Verification Steps produce the expected output (live step post-deploy)
- [ ] Formula-first, whole numbers, weights DERIVED (no hardcoded weights — grep clean); values verbatim
- [ ] No engine / server / persistence / hash change; `competitionApi.ts` unchanged; arena-client green
- [ ] `docs/ai/STATUS.md` Done entry names WP-584 + D-24026 operator-pending
- [ ] `docs/ai/DECISIONS.md` D-24393 landed Active
- [ ] WORK_INDEX + EC_INDEX rows Done; mindmap `📝` → `✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-619:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed (operator-pending)

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-22)
Dependencies verified on `main` @ `bc594c45`: WP-583's breakdown display + grade badge + `CompetitiveScoreBreakdown` client type are present and carry every field the worked calc needs; no server/engine work required. **Mutation boundary** — a pure client display reformat + a pure helper; no `G`/hash/fixture/server; both hash oracles untouched. Operator confirmed the two design forks (formula-first, whole numbers) at draft via an inline mockup.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-22)
Layer boundary (arena-client only; a pure `vfx/` helper + the component) — clean. Determinism (no engine/G/hash) — clean. Contract fidelity (values verbatim from the server record; weights DERIVED not hardcoded, so the shown formula cannot drift from the engine weights — the no-duplication discipline) — clean. Scope (reformat only; no type/server/persistence change; leaderboard still deferred) — clean. **RISK considered:** hardcoding weights client-side would drift from the engine — resolved by deriving `product ÷ count` with a zero-count fallback (locked in AC-2 + D-24393).

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)
§1–§21 pass; closed file allowlist (arena-client + governance); `node:test`; `// why:` on the derived-weight rationale + MINUS glyph; §17 a11y (aria-labelled worked lines); §20 N/A; §21 N/A (no endpoint change). No ❌ triggers.

## Vision Alignment
**Clauses touched:** §17 (a11y — the worked calc is real aria-labelled text), §20-26 (scoring transparency — shows the arithmetic, not just the result). **Conflict assertion:** `No conflict` — a display reformat; no formula, determinism, or other surface changes. **Non-Goal proximity:** none. **Determinism:** no engine change → oracles byte-identical.

## Funding Surface Gate
**N/A** — an endgame display/transparency change. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update
**N/A** — no HTTP endpoint or `apps/server/src/**` change. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
