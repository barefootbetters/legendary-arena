# WP-601 — Endgame PAR Derivation: Show the Bystander-Lost Term

**Status:** Draft 2026-08-24 — executing this session.
**User-Visible Surface:** `play.legendary-arena.com` (endgame report card, PAR block). D-24026 live-verification applies (this WP was itself caught by a live-verify).
**Primary Layer:** Arena Client (display only — `vfx/scoreCalcDisplay.ts` + `EndgameSummary.vue`).
**Dependencies:** WP-591 / D-24400 (`bystandersLostPar` in `computeParScore`), WP-599 / D-24409 (removed the bystander-reward term from the derivation). Landed. Baseline `origin/main` @ `6b26b14e`.

## Goal

The endgame PAR-derivation display omitted the **expected bystanders-lost penalty** term, so its shown arithmetic did not reconcile to the printed PAR value. Caught in a real 2p Midtown Bank Robbery / Red Skull live match: the card printed

```
PAR = (Escapes × 10) + (Twists × 30) − (VP × 10)
    = (1 × 10) + (6 × 30) − (74 × 10)
    = −470
```

but `(1 × 10) + (6 × 30) − (74 × 10) = −550`, not −470. The **−470 is correct** — the engine's `computeParScore` also adds `bystandersLostPar × 40 = 2 × 40 = +80` (WP-591 / D-24400) — but `buildParDerivation` never rendered that term. WP-591 added `bystandersLostPar` to the PAR *math* and to the raw-score givens but never to the derivation *display*; WP-599 then removed the huge bystander-reward term that had been masking the gap, leaving the shortfall naked.

## User-Visible Impact

The PAR block's arithmetic reconciles to the printed PAR. For that match it now reads `(1 × 10) + (6 × 30) + (2 × 40) − (74 × 10) = −470`, and an "Expected bystanders lost 2" appears among the baseline givens.

## Contract

- **Display only.** No engine/scoring/server/`G` change. The PAR value itself is unchanged (rendered verbatim from the breakdown); only its shown *derivation* gains the missing term.
- Mirror the existing twist term: derive the per-unit `bystanderLost` weight from the breakdown (symbolic when the match had no bystander loss, so a weight is not fabricated), gate the term on `bystandersLostPar > 0`.

## Scope (In)
- `apps/arena-client/src/vfx/scoreCalcDisplay.ts`: `buildParDerivation` adds the bystander-lost penalty term to `formula` + `substituted`; `ParDerivation.baseline` gains `bystandersLost`.
- `apps/arena-client/src/components/hud/EndgameSummary.vue`: an "Expected bystanders lost" given (gated on `> 0`).
- Tests: a reconciliation test (real-match shape) + the existing baseline `deepEqual` updated for the new field.

## Scope (Out)
- No scoring-model / weight / PAR-value change (that is the engine, unchanged).
- The "Expected bystanders rescued" given stays informational (rescued bystanders score via VP, not a PAR term).
