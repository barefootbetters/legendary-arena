# WP-715 — Synergy report card on all matches (Game Engine projection + Arena Client)

**Status:** Draft 2026-09-20 (EC-752; D-24538 reserved)
**Layer:** Game Engine (endgame projection) + Arena Client (render) — cross-layer
**Hard-deps:** WP-708 (Synergy Rate + Table Total / D-24531) ✅, WP-709 (Realized Value % / D-24532) ✅, WP-465 (par_not_published casual gating) ✅
**Baseline:** `origin/main` @ (reserve commit)

## Goal

The WP-708/709 endgame **synergy report card** — per-seat "assembled N of M synergy clauses"
(Synergy Rate), the cross-seat **Table Total**, and "realized N% of synergy value" (Realized
Value %) — renders **only on ranked-gauntlet matches**. On a casual match it is entirely
hidden. This WP makes the synergy report card render on **every** match's outcome screen.

**Root cause (verified 2026-09-20, live Red Skull / Midtown casual match):** the per-seat
synergy contribution (`conditionalClauses` Played/Assembled + realized/potential value) reaches
the client only inside the **PAR/competitive-score breakdown** — computed in `parScoring`,
delivered by `competitionApi` (the `/api/…/scores/…` path) and the coach endpoint
(`/api/me/scores/:replay/coach`), and rendered by `EndgameSummary.vue` inside
`v-if="workedCalc"` → `v-if="workedCalc.perPlayer"` (`workedCalc` derives from
`competitiveScore.scoreBreakdown`, L162/L168). A casual match is `par_not_published` (WP-465):
no `competitiveScore` → no `workedCalc` → the whole scoring block, synergy included, is omitted.
The runtime synergy counters DO exist on `G.diagnostics.conditionalClauses` (WP-708/709) — they
are simply never surfaced on a non-scored path. This closes the WP-708/709 D-24026 live-verify
gap (operator's first casual-match check surfaced it).

## User-Visible Impact

Every match's outcome screen (ranked and casual) shows the synergy report card: the Table Total
headline and each seat's "assembled N of M synergy clauses" + "realized N% of synergy value",
in the shipped celebrate-first voice — instead of casual matches showing nothing.

## Assumes

- `G.diagnostics.conditionalClauses` carries the per-seat `{played, assembled}` counts +
  `{potentialValue, realizedValue}` sums at match end for BOTH ranked and casual matches (it is
  recorded at the `heroEffects.execute` chokepoint regardless of ranked status). Confirmed by
  WP-708/709 (`diagnostics/synergyCount.record.ts`).
- `G.diagnostics` is excluded from BOTH hash oracles (D-24034/D-24271), so projecting it into a
  display-only endgame field adds **no** hashed state and needs **no** re-pin.
- The client already receives an always-available endgame payload on every match
  (`props.gameOver`, carrying `scores`/`par` — the VP breakdown that renders today regardless of
  ranked status). This is the natural carrier for the casual synergy figures.
- `EndgameSummary.vue` renders the synergy lines only under the `workedCalc`/`competitiveScore`
  gate today (L355/L378/L384/L407); the synergy phrasing helpers (`synergyPhrase`,
  `realizedValuePhrase`, `synergyTableTotal`) read `conditionalClauses*` fields off the per-seat
  rows and are reusable against a non-scored source.

## Design Rationale

### Delivery channel — the always-available endgame projection (recommended)

The per-seat synergy figures are projected from the hash-excluded `G.diagnostics.conditionalClauses`
into the **always-available endgame payload** the client already receives for every match (the
`gameOver`/endgame projection that carries the per-seat `scores`), as a **display-only**
`synergyContributions` block (per seat: played, assembled, potentialValue, realizedValue). This
reuses the one payload casual matches already get, keeps the figures on the hash-excluded
channel (no re-pin), and does not touch the ranked PAR/score path. **Alternatives considered:**
(a) a new casual-only synergy endpoint — more surface, another fetch; (b) reusing the coach
endpoint — it is itself on the ranked `/scores/` path, so it does not help casual. The endgame
projection is the least-surface, always-present channel. (Exact projection site — the engine
endgame/UIState `gameOver` builder vs. a server endgame assembler — is confirmed against the
code at execution; the figures are display-only and hash-excluded either way.)

### Render — lift the synergy lines out of the score gate

`EndgameSummary.vue` renders the Table Total + per-seat synergy/Realized-Value lines from the
new always-available source, **outside** the `v-if="workedCalc"`/`competitiveScore` gate, so
both casual and ranked matches show them. Ranked matches keep the scoring breakdown as-is; the
synergy lines simply no longer depend on it. Copy, order, and vocabulary are unchanged from
WP-708/709 (Table Total headline first, then per-seat rate; celebrate-first; no
whiff/failed/missed).

## Scope (In)

- Engine (or server) endgame projection: a display-only per-seat `synergyContributions` block
  sourced from `G.diagnostics.conditionalClauses`, present on every match's endgame payload.
- Board-Visible Field Rule: if the projection rides `UIState`, carry the field through BOTH
  `uiState.build` AND `uiState.filter` (public per-seat, or owner-appropriate) with an
  audience-filter test.
- `EndgameSummary.vue`: render Synergy Rate / Table Total / Realized Value % from the new source,
  ungated by `workedCalc`; ranked path unchanged (dedupe so ranked does not double-render).
- Tests: casual endgame shows the synergy block; ranked endgame still shows it (once); a
  pre-WP-708 record (no synergy data) omits the block; audience-filter pass-through (if UIState).

## Out of Scope

- Any change to the scoring/PAR/leaderboard math or the ranked competitive-score breakdown.
- Making synergy affect `finalScore`/PAR/grade — it stays display-only, off-ranking (NG-1).
- The coach report (separate `/scores/` surface) — unchanged.
- New synergy metrics — this WP only relocates the delivery + render of the shipped figures.

## Files Expected to Change

See EC-752 §Files to Produce. Primarily the engine endgame projection (+ `uiState.build` /
`uiState.filter` + audience test if UIState-carried) OR a server endgame assembler,
`apps/arena-client/src/components/hud/EndgameSummary.vue` (+ test), and the client type/props
for the new source (`competitionApi.ts` / a gameOver type). No scoring-math change; no new
hashed field.

## Non-Negotiable Constraints

- Display-only, off-ranking (NG-1) — never enters `finalScore`/`rawScore`/PAR/grade.
- Hash-neutral — figures ride the hash-excluded `G.diagnostics`; NO re-pin (assert empirically).
- Board-Visible Field Rule if UIState-carried (build + filter + audience test), else the
  server/gameOver assembler is the single carrier.
- Copy/vocabulary unchanged from WP-708/709 (celebrate-first; two-vocabulary copy-lint — no
  whiff/failed/missed).
- Ranked matches render the synergy lines exactly once (no double-render with the existing
  workedCalc block; the workedCalc synergy lines are removed in favor of the ungated source).

## Contract

- Every match's endgame payload carries a display-only per-seat `synergyContributions`
  (played, assembled, potentialValue, realizedValue), sourced from `G.diagnostics`.
- `EndgameSummary.vue` renders the Table Total + per-seat Synergy Rate + Realized Value % from
  that source on both casual and ranked matches; hidden only when no seat has synergy data
  (pre-WP-708 records / `played === 0`).

## Vision Alignment

- §3 Player Trust & coaching — the synergy signal is a teaching/celebration surface; gating it to
  ranked matches hid it from the common (casual) case. Display-only, off-ranking preserves NG-1.

## Acceptance Criteria

- A casual match's outcome screen shows the Table Total + each seat's synergy line + Realized
  Value % (driven by the new always-available source).
- A ranked match shows them exactly once (no regression, no double-render).
- A record with no synergy data omits the block (no zero rows).
- Engine + server + client suites green; `pnpm -r build` 0; `vue-tsc` clean; NO re-pin
  (sentinel hashes byte-identical); audience-filter test passes if UIState-carried.
- D-24026 live-verify: a real casual match shows the synergy report card.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` + server + `pnpm --filter
   @legendary-arena/arena-client test` + `vue-tsc` green.
2. `pnpm -r build` 0; sentinel `finalStateHash`/`PRE_WP080_HASH` byte-identical (no re-pin).
3. Fixture-verify the endgame at a casual `?fixture=…` (synergy block renders) and confirm the
   ranked path still renders once.
4. D-24026: play a casual match to game over on the deployed build; confirm the synergy card.

## Definition of Done

Engine + server + client green, build 0, `vue-tsc` clean, NO re-pin, D-24538 Active, WORK_INDEX +
EC_INDEX rows flipped, mindmap 📝→✅, PR squash-merged. A casual match shows the synergy report
card. `User-Visible Surface = play.legendary-arena.com` (endgame) — **D-24026 required**.

## Reserved Decision (lands at execution)

D-24538 — deliver the per-seat synergy contribution through the always-available endgame
projection (display-only, sourced from the hash-excluded `G.diagnostics`) and render the
WP-708/709 synergy lines outside the competitive-score gate, so every match shows them;
off-ranking; no re-pin. See DECISIONS.md.

## Lint Gate Self-Review (00.3)

Cross-layer (engine projection + client render) — the boundary is respected (engine/server
projects display-only data; client renders; no client re-computation, D-20105). Determinism:
figures ride the hash-excluded `G.diagnostics` → no re-pin (asserted empirically); no
scoring-math change. Board-Visible Field Rule cited (build + filter + audience test) for the
UIState path. Off-ranking (NG-1) stated. Copy/vocabulary unchanged from WP-708/709 (two-vocabulary
copy-lint). §21 API catalog: N/A unless a new endpoint is chosen (the recommended channel adds no
endpoint); §20 funding N/A. Files Expected to Change present; the delivery-channel decision is
framed with the recommendation + alternatives. All applicable items satisfied or N/A.
