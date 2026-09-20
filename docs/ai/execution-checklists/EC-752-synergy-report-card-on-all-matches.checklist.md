# EC-752 — Synergy report card on all matches (Execution Checklist)

**Source:** docs/ai/work-packets/WP-715-synergy-report-card-on-all-matches.md
**Layer:** Game Engine (endgame projection) + Arena Client — cross-layer
**Status:** Pending

## Before Starting
- [ ] Confirm `G.diagnostics.conditionalClauses` holds per-seat `{played, assembled}` +
      `{potentialValue, realizedValue}` at match end for BOTH casual and ranked (WP-708/709,
      `diagnostics/synergyCount.record.ts`) — it is recorded independent of ranked status
- [ ] Confirm `G.diagnostics` is excluded from both hash oracles (D-24034/D-24271) → no re-pin
- [ ] Read `EndgameSummary.vue` L146–170 (workedCalc from competitiveScore), L355/378/384/407
      (synergy lines under the `workedCalc` gate) + `synergyPhrase`/`realizedValuePhrase`/
      `synergyTableTotal` (L45–88, L218–235) — these read `conditionalClauses*` off per-seat rows
- [ ] Identify the always-available endgame payload the client gets on every match
      (`props.gameOver` carrying per-seat `scores`) — the casual synergy carrier
- [ ] engine + server + arena-client suites green; `pnpm -r build` 0; `vue-tsc` clean (baselines)

## Locked Values (do not re-derive)
- [ ] Delivery channel: the ALWAYS-AVAILABLE endgame projection (not the ranked PAR/score path,
      not the coach `/scores/` endpoint). A display-only per-seat `synergyContributions` block:
      `{played, assembled, potentialValue, realizedValue}` per seat, sourced from
      `G.diagnostics.conditionalClauses`
- [ ] Render: the Table Total + per-seat Synergy Rate + Realized Value % move OUTSIDE the
      `v-if="workedCalc"`/`competitiveScore` gate; ranked renders them exactly ONCE (remove the
      duplicate under workedCalc — the ungated source is the single renderer)
- [ ] Copy/order/vocabulary IDENTICAL to WP-708/709: Table Total headline first, then per-seat
      rate, then Realized Value %; celebrate-first; NO whiff/failed/missed/error/wasted
- [ ] Hidden when no seat has synergy data (pre-WP-708 record / `played === 0`) — never zero rows

## Guardrails
- [ ] Display-only, off-ranking (NG-1) — the block never enters `finalScore`/`rawScore`/PAR/grade;
      assert an unchanged score with vs without it
- [ ] Hash-neutral — figures ride the hash-excluded `G.diagnostics`; sentinel `finalStateHash` +
      `PRE_WP080_HASH` byte-identical (NO re-pin — verify empirically)
- [ ] Board-Visible Field Rule (IF the projection rides UIState): declare on the type, populate
      in `uiState.build`, pass through `uiState.filter` (per-seat audience disposition), add an
      audience-filter test, verify in the diagnostics snapshot. A field in build but not filter
      is silently dropped
- [ ] Layer boundary: engine/server projects display-only data; client only renders (no client
      re-derivation of synergy, D-20105)
- [ ] No scoring-math change; the ranked competitive-score breakdown is untouched except that the
      synergy lines are no longer rendered from it (moved to the ungated source)

## Required `// why:` Comments
- [ ] The endgame `synergyContributions` projection cites WP-715 / D-24538 + the hash-excluded
      `G.diagnostics` source (display-only, no re-pin)
- [ ] The `EndgameSummary.vue` un-gating cites WP-715 (synergy no longer depends on workedCalc)
      and the single-render dedupe vs the old workedCalc block

## Files to Produce
- [ ] Engine endgame/UIState projection (+ `uiState.build` + `uiState.filter` + audience test if
      UIState-carried) OR a server endgame assembler — the per-seat `synergyContributions` source
- [ ] `apps/arena-client/src/components/hud/EndgameSummary.vue` — render synergy lines from the
      new source, ungated; remove the duplicate under `workedCalc`
- [ ] `apps/arena-client/src/components/hud/EndgameSummary.test.ts` — casual shows it; ranked
      shows it once; no-synergy record omits it
- [ ] Client type/props for the new source (`competitionApi.ts` types or a gameOver type)

## After Completing
- [ ] engine + server + arena-client suites green; `vue-tsc` clean; `pnpm -r build` 0
- [ ] sentinel hashes byte-identical (NO re-pin); audience-filter test green (if UIState)
- [ ] D-24538 Active; WORK_INDEX `[x]` + EC_INDEX row flipped; roadmap mindmap 📝→✅
- [ ] D-24026 live-verify (casual match → synergy card) — operator-pending flagged in WORK_INDEX
- [ ] PR squash-merged when green

## Common Failure Smells
- Synergy block still hidden on casual → it's still sourced from `competitiveScore`; source it from the always-available endgame payload.
- Ranked shows synergy twice → the old workedCalc synergy lines weren't removed when the ungated source was added.
- A field added to `uiState.build` but not `uiState.filter` → silently dropped (EC-206 / Board-Visible-Field-Rule).
- A sentinel hash flips → the projection touched hashed state; it must read only `G.diagnostics`.
