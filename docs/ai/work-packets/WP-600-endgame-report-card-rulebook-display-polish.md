# WP-600 — Endgame Report Card: Rulebook-Faithful Display Polish

**Status:** Draft 2026-08-24 — executing this session. **Stacked on WP-599** (rulebook-faithful scoring); PR targets the WP-599 branch.
**User-Visible Surface:** `play.legendary-arena.com` (endgame report card). The three operator-requested refinements, on top of the corrected scoring model. D-24026 live-verification applies.
**Primary Layer:** Arena Client (display only — `EndgameSummary.vue` + `vfx/scoreCalcDisplay.ts`).
**Dependencies:** WP-599 / D-24409 (the rulebook-faithful model this displays). WP-583/584/587/588/593 (the report card). All landed / in the parent branch. Baseline: WP-599 branch HEAD.

## Goal

Three operator asks against the endgame report card, now that the scoring model is corrected (WP-599):

1. **Rescued/lost terminology.** The card never says a bare "bystanders" — it distinguishes **bystanders rescued** (an award, via VP) from **bystanders lost** (the heaviest penalty). Fixes the ambiguous per-player stat and the PAR-derivation "expected bystanders" given.
2. **A penalties/awards scoring key.** A legend beside the grade scale showing what every event is worth, grouped into **Awards** (lower your score) and **Penalties** (raise it): Victory Point −10 (each defeated villain/henchman/tactic + each rescued bystander at 1 VP); Villain escaped +10; Scheme twist +30; Bystander lost +40. Makes the scoring system legible at a glance.
3. **RAW SCORE + BY PLAYER styling.** The raw-score ledger sides are tinted to their sign (penalties warm / earned cool, matching the key); the per-player split renders as distinct seat chips rather than an inline run of numbers.

## User-Visible Impact

A player finishing a ranked match can read *why* their score is what it is: a colour-coded penalties/awards key explains every lever, the raw-score ledger's two sides are visually grouped, and each seat's VP + rescues read as a card. The terminology is unambiguous — "rescued" vs "lost" — matching the rulebook language.

## Contract

- **Display only.** No engine, scoring, server, or `G` change. Every value rendered still comes from the server-returned breakdown (verbatim) or, for the explanatory scoring key, from documented rulebook-faithful weights (WP-599 / D-24409) owned by `buildScoringKey` — a client constant like the grade words in `gradeDisplay`, pinned by a test so it cannot drift from the engine.
- **Scoring key weights** (locked by D-24409): Victory Point −10; villain escaped +10; scheme twist +30; bystander lost +40.

## Scope (In)
- `apps/arena-client/src/vfx/scoreCalcDisplay.ts`: `buildScoringKey()` + `ScoringKey` / `ScoringKeyLine` types.
- `apps/arena-client/src/components/hud/EndgameSummary.vue`: import + render the scoring key beside the grade scale; terminology fixes (per-player "bystanders rescued", PAR "expected bystanders rescued"); tint the raw-ledger sides; per-player chip restyle.
- Tests: `scoreCalcDisplay.test.ts` (scoring-key weights pinned), `EndgameSummary.test.ts` (key renders, terminology).

## Scope (Out)
- No new report-card data (server-returned breakdown unchanged).
- No change to the scoring model / weights / grade bands (that is WP-599).
