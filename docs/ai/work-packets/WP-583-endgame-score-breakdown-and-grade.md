# WP-583 — Endgame Score Breakdown + Grade Badge

**Status:** Draft 2026-08-22 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com`. The endgame screen gains (a) a **component breakdown** of the competitive score — rounds, bystanders rescued, VP, each penalty event, and PAR — and (b) a **grade badge** (Legendary / A / B / C / D / F) derived from the PAR-relative final score. D-24026 live-verification applies.
**Primary Layer:** Arena Client (`apps/arena-client`) display — with a small shared **Game Engine** grade helper (`packages/game-engine/src/scoring`).
**Dependencies:** WP-578 / D-24387 (surfaced the competitive score on the endgame screen — this extends it); WP-557 / D-24366 (`menaceTierFor` / `MENACE_TIERS` — the threshold-band + copy-boundary pattern this WP mirrors for the grade). All landed. Baseline `origin/main` at draft: `c3db6109`.

---

## Goal

WP-578 put the competitive score on the endgame screen, but it shows only two opaque numbers (`Competitive score: 1220`, `Raw score 920`). A player can't see **where** the score came from or **how good** it is. This WP closes both gaps:

1. **Breakdown** — render the full `ScoreBreakdown` (rounds, bystanders rescued, VP, per-event penalties, PAR) the server **already returns** but the client currently ignores.
2. **Grade** — a coarse rank (Legendary / A / B / C / D / F) banded from the PAR-relative `finalScore`, so the result is legible at a glance.

**Found live (2026-08-22):** a real 2p Red Skull / Midtown Bank Robbery win produced `raw 920 / competitive 1220`; the operator had to ask what the numbers mean and wanted the formula surfaced plus a grade.

## User-Visible Impact

After a ranked match, the endgame panel shows the score's component breakdown and a grade badge alongside the existing totals. Guests, pending/failed submits, and non-scoring matches degrade to the current outcome + VP summary unchanged (the breakdown/grade block is gated on the same `competitiveScore` prop). No monetization or persistence change. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The server already RETURNS the full ScoreBreakdown (built + persisted) — no server change needed
grep -q "buildScoreBreakdown" apps/server/src/competition/competition.logic.ts && grep -q "scoreBreakdown" apps/server/src/competition/competition.types.ts && echo "A_OK"
# Expected: A_OK

# B. The client score type currently OMITS scoreBreakdown (the field to add)
grep -q "interface MyCompetitiveScore" apps/arena-client/src/lib/api/competitionApi.ts && ! grep -q "scoreBreakdown" apps/arena-client/src/lib/api/competitionApi.ts && echo "B_OK"
# Expected: B_OK

# C. The grade helper does not exist yet (this WP adds it)
! grep -rq "gradeForFinalScore\|SCORE_GRADES" packages/game-engine/src && echo "C_OK"
# Expected: C_OK

# D. The menaceTierFor band pattern exists (the template to mirror)
grep -q "export function menaceTierFor" packages/game-engine/src/rules/schemeLossProgress.ts && grep -q "MENACE_TIERS" packages/game-engine/src/rules/schemeLossProgress.ts && echo "D_OK"
# Expected: D_OK

# E. EndgameSummary already imports from the engine (so it may import the grade helper)
grep -q "from '@legendary-arena/game-engine'" apps/arena-client/src/components/hud/EndgameSummary.vue && echo "E_OK"
# Expected: E_OK
```

---

## Context (Read First)

- **The breakdown is already on the wire.** `apps/server/src/competition/competition.logic.ts` calls `buildScoreBreakdown(scoringInputs, hit.scoringConfig)` and persists it as `score_breakdown` jsonb; the `CompetitiveScoreRecord` (`competition.types.ts`) carries `scoreBreakdown: ScoreBreakdown`, and both `POST /api/competition/scores` and `GET /api/me/scores` return the whole record. **No server / persistence / migration change is needed** — the client just doesn't declare the field.
- `apps/arena-client/src/lib/api/competitionApi.ts` — `MyCompetitiveScore` is declared **locally by structural compatibility** (the file forbids importing engine/server types). It omits `scoreBreakdown`. `submitCompetitiveScore` does `body.record as MyCompetitiveScore` with no field stripping, so the breakdown already flows through the JSON untouched — extending the interface just makes it visible to TypeScript.
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — renders the live `competitive-score` `<section v-if="competitiveScore">` (headline `finalScore` + `Raw score {rawScore}`). This is the insertion point for the breakdown `<dl>` and the grade badge. (The separate `par-breakdown` `<dl>` at ~L81 reads `gameOver.par`, which is always `undefined` under D-6701 — **dead**; do not confuse it with the live competitive block.) The component **already imports `@legendary-arena/game-engine`**, so it may import the grade helper.
- `packages/game-engine/src/rules/schemeLossProgress.ts` — `menaceTierFor(menace)` / `MenaceTier` / `MENACE_TIERS` is the pattern to mirror: a pure threshold-band function + a drift-pinned canonical readonly array mirroring a string union, barrel-exported. **Its D-24367 / D-24371 boundary is load-bearing here:** the engine ships the *enum*, never the player-facing *word* — "every player-facing word lives client-side" (`vfx/menaceDisplay.ts` maps tier → CSS class). The grade follows the same split: the engine returns `'legendary' | 'a' | …`; the client renders "Legendary".
- `packages/game-engine/src/scoring/parScoring.types.ts` — `ScoreBreakdown` shape (inputs {rounds, victoryPoints, bystandersRescued, escapes, penaltyEventCounts}, weightedRoundCost, weightedPenaltyTotal, penaltyBreakdown per event, weightedBystanderReward, weightedVictoryPointReward, rawScore, parScore, finalScore, scoringConfigVersion). The client's local `scoreBreakdown` shape mirrors this structurally.

---

## Scope (In)

**Game Engine (`packages/game-engine`):**
- **`src/scoring/parScoring.grade.ts`** — **new** pure module mirroring `menaceTierFor`:
  - `export type ScoreGrade = 'legendary' | 'a' | 'b' | 'c' | 'd' | 'f';`
  - `export const SCORE_GRADES: readonly ScoreGrade[] = ['legendary', 'a', 'b', 'c', 'd', 'f'];` (canonical, drift-pinned)
  - `export function gradeForFinalScore(finalScore: number): ScoreGrade` — ascending-threshold bands (see Contract). Named threshold consts with a `// why:` (centesimal, lower-is-better, 0 = PAR). No boardgame.io import.
- **`src/index.ts`** — barrel-export `ScoreGrade`, `SCORE_GRADES`, `gradeForFinalScore` from the scoring section.
- **`src/scoring/parScoring.grade.test.ts`** — **new**: a **runtime** drift assertion that `SCORE_GRADES` keyset matches the `ScoreGrade` union (D-24372 — not a bare `satisfies`) + band-boundary tests (each threshold and one value inside each band, including exact boundary values).

**Arena Client (`apps/arena-client`):**
- **`src/lib/api/competitionApi.ts`** — extend `MyCompetitiveScore` with an optional `scoreBreakdown?: CompetitiveScoreBreakdown`, where `CompetitiveScoreBreakdown` (+ its nested `inputs` / `penaltyBreakdown` shape) is **declared locally** by structural compatibility with the engine `ScoreBreakdown` (the file must not import engine/server types). Optional so a record without it still typechecks.
- **`src/components/hud/EndgameSummary.vue`** — inside the existing `competitive-score` section: (a) a breakdown `<dl>` rendering `competitiveScore.scoreBreakdown` fields **verbatim** (rounds, bystanders rescued, VP, each penalty event contribution, penalty total, bystander reward, VP reward, raw, PAR, final); (b) a grade badge computed via `gradeForFinalScore(competitiveScore.finalScore)` → the client label. Both gated on `competitiveScore && competitiveScore.scoreBreakdown` (breakdown block) — a record without a breakdown still renders the existing headline. (The component's existing engine import is `import type` — add a separate **value** import for `gradeForFinalScore`.)
- **`src/vfx/gradeDisplay.ts`** — **new** client helper co-located with (and mirroring) `vfx/menaceDisplay.ts`: `gradeLabel(grade): string` (`'legendary'` → "Legendary", `'a'` → "A", …) and `gradeClass(grade): string` (CSS modifier). This is where the display copy "Legendary" lives (the D-24367 boundary). (Placed in the existing `vfx/` dir beside `menaceDisplay.ts` — the enum→display precedent — rather than a new single-file folder, per code-style §File Structure.)
- **Tests** — `EndgameSummary` test (breakdown rows render from a fixture; the grade badge shows the right label for representative bands; the block is absent when `competitiveScore` / `scoreBreakdown` is null); `gradeDisplay` unit test (every enum → a non-empty label + class).

## Out of Scope

- **Any server / persistence / migration change** — the breakdown is already built, persisted, and returned. This WP reads it, never recomputes it.
- **The leaderboard / legends grade badge** — `PublicLeaderboardEntry` exposes `finalScore` (so a grade is derivable) and the legends board renders a per-row score, but adding the grade there touches the server publisher + `apps/legends-board` (a separate surface). **Deferred** to a follow-up; the shared engine helper makes it a trivial later reuse with no threshold drift.
- **Recomputing any score client-side** — the client renders the server's `scoreBreakdown` verbatim (WP-578 / D-24387 preserved).
- **The dead `par-breakdown` `<dl>`** (`gameOver.par`, always `undefined` under D-6701) — untouched.
- **Tuning the grade thresholds beyond the locked v1 bands** — the bands are operator-approved at draft and tunable via the helper constant; re-tuning is a later config change, not this WP.

---

## Files Expected to Change

- `packages/game-engine/src/scoring/parScoring.grade.ts` — **new** (`ScoreGrade` / `SCORE_GRADES` / `gradeForFinalScore`)
- `packages/game-engine/src/index.ts` — **modified** (barrel export)
- `packages/game-engine/src/scoring/parScoring.grade.test.ts` — **new** (runtime drift pin + band tests)
- `apps/arena-client/src/lib/api/competitionApi.ts` — **modified** (add local `scoreBreakdown` shape to `MyCompetitiveScore`)
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **modified** (breakdown `<dl>` + grade badge)
- `apps/arena-client/src/vfx/gradeDisplay.ts` — **new** (enum → label/class; the display copy)
- `apps/arena-client/src/**/*.test.ts` — **modified/new** (EndgameSummary + gradeDisplay tests)
- `docs/ai/DECISIONS.md` — **modified** (land D-24392)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** (governance close)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-583 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

Cross-layer (game-engine helper + arena-client display); standard two-session lane.

---

## Contract (Locked by D-24392)

- **Breakdown from the wire:** the endgame breakdown is rendered from the already-returned `record.scoreBreakdown`, never recomputed client-side. No server / persistence / migration change.
- **Grade is an engine enum, the word is client copy:** `gradeForFinalScore` returns `ScoreGrade` (`'legendary' | 'a' | 'b' | 'c' | 'd' | 'f'`); the client `gradeDisplay.ts` owns "Legendary" / "A" / … — the D-24367 / D-24371 no-copy-in-`packages/` boundary.
- **Grade bands (v1, tunable)** on `finalScore` (centesimal integer, lower = better, 0 = PAR), ascending thresholds:

  | Grade | Condition (centesimal) | In points |
  |---|---|---|
  | `legendary` | `finalScore <= -1000` | ≤ −10.00 (well under PAR) |
  | `a` | `-1000 < finalScore <= -300` | −10.00 … −3.00 |
  | `b` | `-300 < finalScore <= 300` | around PAR |
  | `c` | `300 < finalScore <= 800` | +3.00 … +8.00 |
  | `d` | `800 < finalScore <= 1800` | +8.00 … +18.00 |
  | `f` | `finalScore > 1800` | > +18.00 |

  (The live example `finalScore 1220` → `d`.)
- **Endgame screen only.** Leaderboard/legends grade badge deferred.
- **Accessible:** the grade badge conveys meaning by text (the label), not colour alone; `aria-label`; no required animation (reduced-motion safe) — Vision §17.

### Determinism / persistence

`gradeForFinalScore` is a **pure** function of one number — it is not stored in `G`, touches no hashed field, and adds no fixture. The client change is display-only over already-served data. **No `finalStateHash` / `PRE_WP080_HASH` change** (no engine `G` / fixture touched). No snapshot, no DB, no migration. Barrel export is additive.

### Code-style / output discipline

Mirror `menaceTierFor`: full-word names, a canonical readonly array drift-pinned against the union as a **runtime** assertion (D-24372), `// why:` on the threshold constants (centesimal, lower-is-better). `competitionApi.ts` stays import-clean (local structural shape only). ESM, Node v22+; vue-tsc clean.

---

## Acceptance Criteria

1. `gradeForFinalScore` returns the correct band at each boundary: `-1000 → legendary`, `-999 → a`, `-300 → a`, `-299 → b`, `300 → b`, `301 → c`, `800 → c`, `801 → d`, `1800 → d`, `1801 → f`; `SCORE_GRADES` matches the `ScoreGrade` union (runtime drift test).
2. `MyCompetitiveScore` carries an optional locally-declared `scoreBreakdown`; `competitionApi.ts` imports nothing from engine/server (structural shape only).
3. On the endgame screen, an authenticated winner with a scored match sees the component breakdown (rounds, bystanders rescued, VP, each penalty, PAR) rendered verbatim from `scoreBreakdown` **and** a grade badge whose label matches `gradeForFinalScore(finalScore)`.
4. A guest / pending / failed / non-scoring match (prop `null`, or a record with no `scoreBreakdown`) renders the existing summary with no breakdown block and no crash.
5. The grade badge conveys meaning by text + `aria-label` (not colour-only); no required animation.
6. No engine `G` / fixture / hash change (both oracles byte-unchanged); no server / persistence / migration change. `pnpm -r build` + engine tests + arena-client `vue-tsc` + tests green; `pnpm -r --no-bail test` shows no new failures.

---

## Verification Steps

```bash
# 1. Grade helper exists, is barrel-exported, and is pure
grep -n "export function gradeForFinalScore\|export const SCORE_GRADES\|export type ScoreGrade" packages/game-engine/src/scoring/parScoring.grade.ts
grep -n "gradeForFinalScore\|SCORE_GRADES\|ScoreGrade" packages/game-engine/src/index.ts
! grep -q "boardgame.io" packages/game-engine/src/scoring/parScoring.grade.ts && echo "pure OK"

# 2. Client type extended without engine/server imports
grep -n "scoreBreakdown" apps/arena-client/src/lib/api/competitionApi.ts
! grep -qE "@legendary-arena/(game-engine|registry)|apps/server" apps/arena-client/src/lib/api/competitionApi.ts && echo "import-clean OK"

# 3. EndgameSummary renders the breakdown + grade; gradeDisplay owns the copy
grep -n "scoreBreakdown|gradeForFinalScore" apps/arena-client/src/components/hud/EndgameSummary.vue
grep -n "Legendary" apps/arena-client/src/vfx/gradeDisplay.ts   # the word lives here, not in packages/

# 4. No engine G / fixture / hash surface touched
git diff --name-only | grep -E 'packages/game-engine/src' | grep -vE 'scoring/parScoring.grade|index.ts' ; echo "expect none"

# 5. Suites
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -4
(cd apps/arena-client && pnpm vue-tsc --noEmit 2>&1 | tail -3 && pnpm test 2>&1 | tail -4)
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8
# Expected: engine green (grade drift + band tests), arena-client vue-tsc + tests green, no hash change

# 6. Live (post-deploy; D-24026): play.legendary-arena.com — finish a ranked match; the endgame
#    panel shows the component breakdown + a grade badge matching the finalScore band. Record in STATUS.
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–E passed before the edit
- [ ] All 6 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 6 is post-deploy)
- [ ] `gradeForFinalScore` bands match the locked table; `SCORE_GRADES` runtime-drift-pinned; engine ships the enum, client owns the word
- [ ] Breakdown rendered verbatim from `record.scoreBreakdown`; no client recompute; no server/persistence/migration change
- [ ] `competitionApi.ts` import-clean (local structural shape); guests/pending/failed degrade unchanged
- [ ] Grade badge accessible (text + aria, not colour-only, reduced-motion)
- [ ] No engine `G` / fixture / hash change (both oracles byte-unchanged); engine + arena-client green; `pnpm -r --no-bail` no new failures
- [ ] `docs/ai/STATUS.md` Done entry names WP-583, records the D-24026 live-verify as operator-pending (`User-Visible Surface = play.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24392 landed Active
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-583 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-618:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed in the deployed play surface (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-22)

Dependencies verified on `main` @ `c3db6109`: the server already builds (`buildScoreBreakdown`), persists (`score_breakdown` jsonb), and returns (`record.scoreBreakdown` from both score endpoints) the full breakdown — a scoping scaffold confirmed the two-WP split has **no** justification (a server WP would be net-zero), so this is one client-focused WP. `menaceTierFor` / `MENACE_TIERS` is the exact band + copy-boundary pattern to mirror; `EndgameSummary.vue` already imports the engine. **Mutation boundary** — `gradeForFinalScore` is pure (no `G`, no hash surface, no fixture); the client change is display-only over already-served data; both hash oracles untouched (verify). **Empirical scaffold — NOT required:** additive helper + display; the band-boundary + drift tests are the proof.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-22)

Layer boundary (a pure engine helper mirroring `menaceTierFor`; client display + a local structural type; `competitionApi.ts` stays import-clean; the engine ships the enum and the client owns the word — the D-24367 boundary held) — clean. Determinism (pure function, no `G`/hash/fixture; display-only) — clean. Contract fidelity (breakdown rendered verbatim from the server record — WP-578/D-24387 preserved; no recompute) — clean. Scope (endgame screen only; leaderboard grade deferred; no server/persistence change) — clean. **RISK considered:** the grade thresholds are a design call — the v1 bands are operator-approved at draft, documented, and tunable via the helper constant, so a later re-tune is a config change, not a formula change. Both locked in AC-1 and D-24392.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS. **§2 Constraints** — PASS. **§3 Assumes** — PASS (A–E w/ expected output). **§4 Context** — PASS (breakdown-on-the-wire, the client omission, the `menaceTierFor` pattern + copy boundary, the dead `par-breakdown`; 00.2 — no renamed field). **§5 Files** — PASS (closed allowlist across engine + arena-client + governance). **§6 Naming** — PASS (`ScoreGrade` / `SCORE_GRADES` / `gradeForFinalScore` mirror `MenaceTier` canon). **§7 Deps** — PASS (WP-578, WP-557 landed). **§8 Boundaries** — PASS (pure engine helper, no boardgame.io; `competitionApi.ts` import-clean; EndgameSummary may import engine). **§9 Windows** — N/A. **§10 Env** — N/A. **§11 Auth** — the score is owner-only, already gated by WP-578's submit path; no new auth. **§12 Test Quality** — PASS (`node:test` band + drift; arena-client component + helper tests). **§13 Verification** — PASS. **§14 AC** — PASS (6 binary). **§15 DoD** — PASS (STATUS + DECISIONS D-24392 + indices + mindmap + D-24026). **§16 Code Style** — PASS (runtime drift pin per D-24372; `// why:` on thresholds). **§17 Vision** — §17 a11y present. **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — commit-time. **§20 Funding** — N/A. **§21 API Catalog** — N/A (no endpoint change; the breakdown field already ships in the existing response).

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Clauses touched:** §17 (accessibility — the grade badge is text + aria, not colour-only), §20-26 (scoring transparency — surfaces the component breakdown the reference model calls for). **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it makes the already-computed score legible without changing the formula, the server, or determinism. **Non-Goal proximity:** none of NG-1..NG-8. **Determinism preservation:** pure helper, no engine `G` / fixture → both hash oracles byte-identical.

## Funding Surface Gate

**N/A** — a display/transparency change on the endgame screen; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A** — no HTTP endpoint change and no `apps/server/src/**` library-function change. The `scoreBreakdown` field already ships in the existing `POST /api/competition/scores` + `GET /api/me/scores` responses; only the client type is extended. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
