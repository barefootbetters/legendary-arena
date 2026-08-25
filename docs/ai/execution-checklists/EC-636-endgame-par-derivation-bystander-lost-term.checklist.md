# EC-636 — Endgame PAR Derivation: Show the Bystander-Lost Term (Execution Checklist)

**Source:** docs/ai/work-packets/WP-601-endgame-par-derivation-bystander-lost-term.md
**Layer:** Arena Client (display only).

## Locked Values (do not re-derive)
- The bystander-lost weight is **derived from the breakdown** (`penaltyBreakdown.bystanderLost ÷ count`), symbolic when the match had no bystander loss. Never a hardcoded 40 in the derivation.
- The term is gated on `bystandersLostPar > 0` (older rows without it render exactly as before).

## Guardrails
1. `buildParDerivation` (`vfx/scoreCalcDisplay.ts`): add `lostWeight`, `lostFormula`, `lostSub` mirroring the twist term; insert after the twist term, before the `− VP` term; add `bystandersLost` to the returned `baseline`; extend the `ParDerivation.baseline` type.
2. `EndgameSummary.vue`: add the "Expected bystanders lost" given (gated on `> 0`), beside the "Expected twists" given.
3. Display only — no engine/scoring/server/`G` change; the PAR value is rendered verbatim (unchanged).

## After Completing
- [x] `vue-tsc --noEmit` clean; scoreCalcDisplay + EndgameSummary tests green; whole arena-client suite green (1435/0)
- [x] Reconciliation test: a real-match-shaped breakdown's substituted line expands to the printed PAR (`(1×10)+(6×30)+(2×40)−(74×10) = −470`)
- [ ] Live-on-surface (D-24026): the PAR block's arithmetic reconciles on a real match card
- [ ] STATUS names WP-601; DECISIONS D-24411 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap node; `pnpm roadmap:counts:write`
