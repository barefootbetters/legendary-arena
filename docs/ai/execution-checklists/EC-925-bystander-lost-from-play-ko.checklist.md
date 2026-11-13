# EC-925 — A Bystander KO'd from play counts as lost (Execution Checklist)

**Source:** docs/ai/work-packets/WP-887-bystander-lost-from-play-ko.md
**Layer:** Game Engine (counter key, recorder, the two Hunt for Victims Bystander KO sites, both `bystanderLost` derivations) + one arena-client legend line + `wiki/scoring.md`
**Risk Tier:** MEDIUM — a scoring derivation (data transformation) plus one copy line; no auth, money, persistence schema or server surface

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] #3300 and #3302 merged; WP-528, WP-586, WP-884 and WP-889 are `[x]` in WORK_INDEX.
- [ ] `pnpm -r build`, then engine and arena-client `test` and arena-client `typecheck` exit 0 (record the engine count).
- [ ] Re-grep the KO sites (`koCard(`, `\.ko = `, `moveCardFromZone(` into the KO pile) and compare with `ownedCardKoTrigger.test.ts`
      `LOCKED_TABLE` and the WP §Assumes table: the hero Hunt `'ko'` branch and `koVillainHuntedBystander` are still the only
      from-play Bystander KOs. A third one is a STOP.
- [ ] Scaffold: the draft prototype (pre-WP-889) ran 6987 / 6987 pass with no test change. Re-run RS-2 + RS-3 at HEAD, recorder at
      both sites, first; any break is a STOP.

## Locked Values (do not re-derive; verify at HEAD)
- Key: `export const BYSTANDERS_KOED_FROM_PLAY = 'bystandersKoedFromPlay';` in `types.ts`, beside `DARK_PORTAL_COUNT`.
- Recorder: `export function recordBystanderKoedFromPlay(gameState: LegendaryGameState): void` in `board/bystanders.logic.ts`;
  body `gameState.counters[BYSTANDERS_KOED_FROM_PLAY] = (gameState.counters[BYSTANDERS_KOED_FROM_PLAY] ?? 0) + 1;`.
- Call sites (two), each immediately after its `G.ko = koCard(G.ko, bystanderId);`:
  - `applyHuntForVictimsResolvedSeatChoice` (the `'ko'` branch, all three sources);
  - `koVillainHuntedBystander` (before its `pushLog`; only on the path that KO'd, never when it returns `false`).
  Not on rescue / capture / decline / a stale hero option; a stale villain pick records only through its default
  re-resolution's KO.
- Derivation (both `deriveScoringInputs` and `deriveScoringInputsFromFinalState`):
  `bystanderLost = <isBystanderCard count over escapedPile> + (counters[BYSTANDERS_KOED_FROM_PLAY] ?? 0)`.
- Legend note (`scoreCalcDisplay.ts`, `label: 'Bystander lost'`):
  `'a civilian carried away by an escaping villain or KO’d from play — the heaviest penalty'` (U+2019, U+2014).
- Counted sources: City captives, Mastermind captives, Escape Pile, HQ. Not counted: supply, Victory Pile, revealed
  never-captured Villain-Deck card, operator setters.
- Versions unchanged: `scoringConfigVersion` 5, `rawScoreSemanticsVersion` 4; no `par:seed:generate`.
- Neither the key nor the recorder is re-exported from `src/index.ts`.
- Bot (`ai.seatChoice.ts`): behaviour unchanged; comments only (WP RS-6). `defaultVillainHuntOptionIndex` and its `// why:`
  are untouched.
- Tests index the counter via `BYSTANDERS_KOED_FROM_PLAY` (one drift pin may assert its literal). The `par.aggregator.test.ts`
  symmetry state has ≥ 1 escaped Bystander AND counter ≥ 1 and asserts the absolute sum.
- `wiki/scoring.md` sites: ~:203-206, ~:214, ~:224-225, ~:481-485 (leave ~:246, the rulebook formula).

## Guardrails
- The counter is written only by the recorder, only at a from-play KO; never seeded at setup.
- Both derivations stay pure, end-of-match, read-only (D-4802 / D-4804) and textually parallel.
- No edit to `PenaltyEventType`, `PENALTY_EVENT_TYPES`, `ScoringInputs`, `ScoreBreakdown`, `ScenarioScoringConfig`,
  `computeParScore`, weights, configs or PAR artifacts.
- No UIState field, move, `getLegalMoves` or persistence-schema change; Victory-Pile KO sites untouched.
- Sentinels, `PRE_WP080_HASH` and PAR byte-unchanged; a moved pin is a STOP, never a re-pin.
- Never throw. No `.reduce()`, nested ternaries, `any` or `@ts-ignore`. Never edit a test to pass. Never `git stash`.

## Required `// why:` Comments
- The key: a lazily written plain counter of Bystanders KO'd from play (D-24839); absent means zero.
- The recorder (JSDoc + `// why:`): the single seam every from-play Bystander KO site MUST call (D-24839 obligation); why a
  counter (end state cannot tell a KO's source).
- Both Hunt KO sites (rewrite each RS-5 comment; the villain one keeps WP-889 / D-24841): recorded as a from-play loss, an
  Escape-Pile KO nets to zero in `bystanderLost`, Midtown Bank Robbery's carried-away count still drops.
- Each derivation: the two buckets, D-24339 + D-24839, symmetry with the other copy; correct the `par.aggregator.ts` JSDoc ~:1001
  ("counting 'bystander'-typed entries of G.escapedPile") and the `parScoring.logic.ts` loop comment.
- `bystanders.logic.ts` header: the recorder is the one function that mutates `G`; the new type + key imports.
- `ai.seatChoice.ts` Hunt JSDoc ~:262-265 only (WP RS-6; the file header is untouched): an Escape-Pile KO is neutral to `bystanderLost`; the order is kept (whether a rescue should outrank it is a follow-up).

## Files to Produce
- Engine: `types.ts`, `board/bystanders.logic.ts`, `moves/huntForVictims.logic.ts`, `scoring/parScoring.logic.ts`,
  `simulation/par.aggregator.ts`, `simulation/ai.seatChoice.ts` (comments only).
- Tests: `board/bystanders.logic.test.ts`, `moves/huntForVictims.test.ts`, `moves/villainHuntForVictims.test.ts`,
  `scoring/parScoring.logic.test.ts`, `simulation/par.aggregator.test.ts`.
- Client / docs: `apps/arena-client/src/vfx/scoreCalcDisplay.ts`, `wiki/scoring.md`.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24839), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; engine + arena-client `test` 0 (count rose ≥ +10); arena-client `typecheck` 0;
      `pnpm -r --no-bail test` 0 fail; `pnpm wiki-viewer:check-links` 0.
- [ ] Control-revert non-vacuous in both `parScoring.logic.test.ts` and `par.aggregator.test.ts`.
- [ ] Sentinels, `PRE_WP080_HASH`, PAR byte-unchanged; no `data/scoring-configs/` or `data/par/` path in the diff.
- [ ] "Amended by D-24839" notes on D-24339 (no-counter + MUST-bump sentences) and D-24835 §9 + the KO half of §11.
- [ ] D-24839 → Active (every WP §Reserved Decision clause); STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap ✅ +
      `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) on a match created after the deploy; otherwise operator-pending in STATUS.
- [ ] Replay window: record the read-only count of pre-deploy captured artifacts with a Hunt KO, or say it was not taken.

## Common Failure Smells
- Escape-Pile KO still lowers the score → the counter term is missing in one copy, or the recorder sits on the rescue branch.
- A Lilin hunt KO is not counted → the recorder is missing at `koVillainHuntedBystander`.
- Live score and calibrated PAR disagree → only one derivation was changed.
- A sentinel hash moved → the key was seeded at setup or written outside a from-play KO.
