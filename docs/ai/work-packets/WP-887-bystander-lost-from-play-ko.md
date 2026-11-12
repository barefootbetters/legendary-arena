# WP-887 — A Bystander KO'd from play counts as lost (amends D-24339's `bystanderLost`)

**Status:** Draft 2026-11-12 (EC-925; D-24839 reserved (#3300)). Gates: pre-flight READY TO EXECUTE; copilot PASS; lint PASS.
**Layer:** Game Engine (one counter key, one recorder helper, the WP-884 Hunt for Victims KO site, both `bystanderLost` derivations) + one arena-client score-legend line + `wiki/scoring.md`
**User-Visible Surface:** play.legendary-arena.com (endgame score breakdown and competitive score)
**Risk Tier:** MEDIUM — a scoring derivation (data transformation) plus one copy line; no auth, money, persistence schema or server surface
**Lane:** standard two-session (scoring / PAR is barred from the Lightweight Lane, 01.0a §Eligibility gate #6)
**Baseline:** drafted off `origin/main` @ `a34b66a5`.
**Hard-deps:** WP-528 / D-24339 (the `bystanderLost` producer derived from `G.escapedPile`) ✅, WP-586 / D-24395 (the shared
`isBystanderCard` predicate; the no-bump posture for a derivation correction) ✅, WP-884 / D-24835 (Hunt for Victims, the only
from-play Bystander KO site today) ✅

## Goal

Make a civilian who dies count as lost. Today PAR's `bystanderLost` counts only the Bystanders sitting in `G.escapedPile` at
game end, so:
- a Bystander KO'd while a Villain or the Mastermind holds it is never counted, though it died;
- KOing a Bystander out of the Escape Pile (Stalk the Night Stalkers' Hunt for Victims, WP-884) *lowers* `bystanderLost`, so
  killing a civilian improves the score by one 40-point penalty.

After this WP, a Bystander KO'd **from play** — captured by a City Villain, captured by the Mastermind, in the Escape Pile, or in
the HQ — adds one to `bystanderLost`. An Escape-Pile KO nets to zero (it leaves one lost bucket for another). A rescue is not a
KO and is never counted. Bystanders KO'd from the Bystander supply or from a player's Victory Pile do not count (operator
decision 2026-11-12, "Count from-play KOs").

## User-Visible Impact

`play.legendary-arena.com`, endgame score breakdown and the competitive score:
- A match where Hunt for Victims KOs a captured Bystander shows one more "Bystanders lost" (+40 raw score) than today.
- A match where Hunt for Victims KOs an escaped Bystander shows the same "Bystanders lost" as if it had not been KO'd (today
  it shows one fewer).
- The score legend's "Bystander lost" note reads "a civilian carried away by an escaping villain or KO’d from play — the
  heaviest penalty".

Only matches that field Elsa Bloodstone (mdns) can see a difference today; the villain-side Hunt for Victims (Lilin, Lilith,
Ritual Sacrifice to Summon Chthon) inherits the rule when it is built. Live-on-surface is operator-pending (D-24026).

## Assumes

- **Baseline `a34b66a5`**; reserve PR #3300 merged before execution.
- **The `bystanderLost` derivation (D-24339, D-24395).** Two symmetric copies count `isBystanderCard` entries of
  `G.escapedPile`: `deriveScoringInputs` (`scoring/parScoring.logic.ts` loop ~:156-161, used ~:187) and
  `deriveScoringInputsFromFinalState` (`simulation/par.aggregator.ts` loop ~:1063-1068, used ~:1075). `isBystanderCard` is
  `scoring/scoring.logic.ts:44`.
- **Every Bystander KO site today.** The authoritative KO-site inventory is `hero/ownedCardKoTrigger.test.ts` `LOCKED_TABLE`
  (~:373); the drafting audit (2026-11-12, re-confirmed by the 01.4 pre-flight) traced every production `koCard(` call, every
  `moveCardFromZone` write into `G.ko`, and every `attachedBystanders` / `escapedPile` write. Only these can KO a Bystander:
  | Site | Source | Counts? |
  |---|---|---|
  | `moves/huntForVictims.logic.ts` `applyHuntForVictimsResolvedSeatChoice` (`G.ko = koCard(G.ko, bystanderId)` ~:504; `huntAction: 'ko'`) | City captive (`G.attachedBystanders`), Mastermind captive (`G.mastermind.attachedBystanders`), Escape Pile | **yes** — from play |
  | `villain/villainEffects.execute.ts` `villainEffectKoBystanderEachVictoryPile` (~:1288; Executioner, ca75) | Victory Pile | no |
  | `rules/mastermindHandlers.ts` `resolveBaronZemoStrike` (~:970; ca75) | Victory Pile | no |
  | `rules/tacticHandlers.ts` `resolveWhispersAndLies` (~:987; core Loki tactic) | Victory Pile | no |
  | `rules/tacticHandlers.ts` `resolveFindingZemo` (~:2118; ca75) | revealed Villain-Deck card, never captured | no |
  | `moves/operatorSetters.ts` `koFromPlayerZone` (~:269; operator matches only, never scored) | any zone | no |
  No handler KOs a Bystander from the HQ or from the Bystander supply today.
- **Counter conventions.** `G.counters` is `Record<string, number>`, written lazily as `G.counters[KEY] = (G.counters[KEY] ?? 0)
  + 1` (`villainDeck/villainDeck.reveal.ts` ~:673-674 for `ESCAPED_VILLAINS`) and read with `?? 0`. Plain counter keys are
  exported constants in `types.ts` (~:132-149: `KILLBOT_TWISTS_NEXT_TO_SCHEME`, `TRAITOR_BATTALION_TWISTS`,
  `DARK_PORTAL_COUNT`). Invariants check only that values are finite and keys non-empty
  (`invariants/structural.checks.ts` ~:105-113, `invariants/gameRules.checks.ts` ~:256-262).
- **Hash surface.** `G.counters` is hashed (`test/fixtures/hashGameState.ts` ~:106-109 excludes only `messages`, `logMeta`,
  `lastPlayEffectsFired`, `diagnostics`). A key written only on a from-play Bystander KO leaves every other match byte-identical.
  `PRE_WP080_HASH` replays an empty move list; the only fixture game (`sentinel-core-doom-2p`) reaches no Bystander KO site.
- **Bystander helpers live in `board/bystanders.logic.ts`** (`carryEscapedBystandersToPile` ~:204), with its own
  `bystanders.logic.test.ts`. Its header (~:1-17) says every function "never mutate[s] inputs" and that it imports only
  `CardExtId` and `BYSTANDER_EXT_ID`; the recorder is the module's first `G`-mutating function and adds a `LegendaryGameState`
  type import plus the key, so the header is updated (RS-2). No boardgame.io import either way; the prototype showed no import
  cycle.
- **The bot's Hunt rationale** (`simulation/ai.seatChoice.ts` ~:259-265 JSDoc; the file header ~:26-28 states only the answer
  order) says KOing from the Escape Pile is "pure gain" because the Bystander "counts in bystanderLost". After this WP that KO is neutral to `bystanderLost`.
- **Replay verification.** The capture harvester stores `replay_hash` from the final `G` (`apps/server/src/replay/
  matchCapture.logic.ts` ~:103-127); submission re-reduces the match and rejects a hash mismatch
  (`apps/server/src/competition/competition.logic.ts` ~:833, `replay_verification_failed`). `computeStateHash` hashes counters.
- **Gauntlet clears** qualify only when the row's `scoringConfigVersion` equals the published version
  (`apps/server/src/legends/gauntletTruth.logic.ts` ~:202).
- **The UI does not project `G.counters` wholesale.** `buildProgressCounters` (`ui/uiState.build.ts` ~:490) reads named keys
  only; persistence snapshots copy counters (counts are permitted, ARCHITECTURE §Persistence Boundaries).
- **Scoring configs and PAR.** 128 production configs in `data/scoring-configs/*.json`, all `scoringConfigVersion: 5`,
  `bystanderLost: 40`; `scenarioKey` is scheme :: mastermind :: villain groups (heroes are not in the key, so a scored core
  scenario may field Elsa Bloodstone). Seed PAR (`data/par/seed/v1`) is the hand-authored `SCHEME_PROFILES` table in
  `scripts/generate-seed-par.mjs`; the diagnostic profiles (`scripts/generate-par-profiles.mjs`) simulate a fixed six-hero
  core pool. Neither can reach a from-play Bystander KO.
- **The score legend** is `apps/arena-client/src/vfx/scoreCalcDisplay.ts` ~:666-670 (`label: 'Bystander lost'`); no test pins
  its `note` string.

## Context (Read First)

- **Read:** `docs/ai/ARCHITECTURE.md` §Persistence Boundaries (snapshots are counts only) and Architectural Principle #1
  (determinism); `docs/ai/REFERENCE/00.6-code-style.md`; `docs/12-SCORING-REFERENCE.md` (the `bystanderLost` penalty; the coach
  "luck of the draw" read ~:813-816); `wiki/scoring.md` (the RS-4 sites); `docs/01-VISION.md` §21. Scan `docs/ai/DECISIONS.md`
  for D-24339, D-24395, D-24835 (§9, §11), D-24789, D-24687 §4, D-24616 §5, D-4802 / D-4804, D-24026, D-24800. `00.2` is not
  touched: no card data, setup-payload or schema field (`G.counters` stays `Record<string, number>`).

**Why now.** WP-884 shipped the first effect that KOs a Bystander from play, and it exposed the gap D-24835 stated: an
Escape-Pile KO lowers `bystanderLost`. Three decks of villain-side Hunt for Victims (5 Lilin, Lilith's two Master Strikes and four
tactics, Ritual Sacrifice to Summon Chthon) are next; each would compound the inversion. The set itself treats a KO'd
Bystander as a victim (Lilith and the Lilin scale with "each Bystander in the KO pile"; Chthon transforms at 5). The operator chose
the from-play definition on 2026-11-12.

**Why a counter, not a derivation (amends D-24339's "no counter").** D-24339 derived from end state to avoid a hash re-pin. End
state cannot tell a from-play KO from a supply or Victory-Pile KO: all land in `G.ko`, and a captured Bystander may be a supply
`pile-bystander` or a Villain-Deck one. A lazily written counter is the cheapest faithful record, and because it is written only
when a from-play KO happens, no existing pin moves.

**Why one recorder helper.** Every future from-play KO site (villain Hunt for Victims, an HQ KO, a "KO all Bystanders held by
Villains" twist) must count. One exported `recordBystanderKoedFromPlay(G)` beside the `koCard` call is the single seam those WPs
call, the same pattern as the owned-KO recorder (D-24789).

**Version posture (amends D-24339's bump sentence).** D-24339 said any producer wired after production configs exist must bump
`scoringConfigVersion`. D-24839 amends that sentence: a count correction that changes no weight, formula shape, config field or
PAR baseline does not bump. D-24395 (WP-586), a later correction of the same `bystanderLost` derivation made after configs
existed, already shipped that way. This WP is the same class (seed PAR is hand-authored; profiles use core heroes). A bump
would also cost real value: gauntlet clears qualify only at the published `scoringConfigVersion`, so 5→6 would disqualify every
existing gauntlet clear across all 128 scenarios for a change only an Elsa Bloodstone match can trigger. So
`scoringConfigVersion` stays 5, `rawScoreSemanticsVersion` stays 4, no `par:seed:generate`, and existing
`legendary.competitive_scores` rows keep their pinned `score_breakdown` (VISION §22; D-24616 §5).

**Replay window (accepted).** A competitive match captured **before** the deploy that resolved a Hunt for Victims KO, and
submitted **after** it, re-reduces under the new engine, writes the counter, and fails `replay_verification_failed` (the stored
`replay_hash` came from the old final `G`); the gameover backfill likewise reads such an artifact's outcome as unknown. That is the
accepted pre-deploy window, the D-24687 §4 precedent (pre-deploy replays that resolved the changed rule diverge; stored rows stay
frozen). Matches captured after the deploy score under the new rule; matches without a Hunt KO replay byte-identically. The
window is matches that used Stalk the Night Stalkers' KO between the WP-884 deploy and this one.

**Not changed by this WP.** Midtown Bank Robbery's carried-away loss count still reads the Escape Pile (a scheme rule, not
scoring), so an Escape-Pile KO still lowers it, as WP-884 stated. Chthon's "5 Bystanders in the KO pile" reads `G.ko` and is
unaffected. Server badges and the coach summary read `penaltyEventCounts.bystanderLost` and inherit the new count with no code
change; the coach's "luck of the draw" read (`docs/12-SCORING-REFERENCE.md` ~:813-816) counts `bystanderLost` as adversity, so a
Hunt KO the player chose now reads as adversity there (accepted; tiny). `scoring/parScoring.types.ts` ~:159 (`bystandersLostPar`
JSDoc, "carried away by escaping Villains") is a contract file and the PAR expectation it describes is unchanged, so it is
deliberately not edited. `EndgameSummary.vue` shows only the PAR expectation; `docs/12` and `wiki/par-simulation-calibration.md`
do not define the term narrowly.

### RS-1 — What counts (default locked)

A Bystander moved to `G.ko` from: a City Villain's captives (`G.attachedBystanders`), the Mastermind's captives
(`G.mastermind.attachedBystanders`), `G.escapedPile`, or an HQ slot. Not counted: the Bystander supply (stack or deck), a
player's Victory Pile, a revealed Villain-Deck card that was never captured, and operator setters. A rescue, a capture and a
decline are not KOs.

### RS-2 — How it is recorded (default locked)

- `types.ts`: `export const BYSTANDERS_KOED_FROM_PLAY = 'bystandersKoedFromPlay';` with a `// why:` and JSDoc, beside the other
  plain counter keys.
- `board/bystanders.logic.ts`: `export function recordBystanderKoedFromPlay(gameState: LegendaryGameState): void` writes
  `gameState.counters[BYSTANDERS_KOED_FROM_PLAY] = (gameState.counters[BYSTANDERS_KOED_FROM_PLAY] ?? 0) + 1`. Never throws;
  no other effect.
- Called once per Bystander, immediately after its `koCard`, at every from-play site. Today that is the `huntAction: 'ko'` branch
  of `applyHuntForVictimsResolvedSeatChoice` (all three sources). The rescue, capture, decline and stale paths do not call it.
- The `bystanders.logic.ts` header is updated: the recorder mutates `G.counters` (the module's one mutating function) and the
  module now also imports the `LegendaryGameState` type and `BYSTANDERS_KOED_FROM_PLAY`.
- Neither the key nor the recorder is re-exported from `src/index.ts` (engine-internal; scoring reads the key inside the
  package).

### RS-3 — The derivation (default locked)

In both `deriveScoringInputs` and `deriveScoringInputsFromFinalState`: `bystanderLost = (count of isBystanderCard entries in
G.escapedPile) + (G.counters[BYSTANDERS_KOED_FROM_PLAY] ?? 0)`. The two copies stay textually parallel.

### RS-4 — Copy (default locked)

The score legend's `'Bystander lost'` note becomes `'a civilian carried away by an escaping villain or KO’d from play — the
heaviest penalty'` (U+2019 apostrophe, matching the file). `wiki/scoring.md` states the new definition at: ~:203-206
(producer-status prose), ~:214 (producer table row), ~:224-225 ("from the escaped pile"), ~:481-485 (taxonomy bullet). ~:246 is the
rulebook formula and stays. The `par.aggregator.ts` JSDoc ~:1001 ("by counting 'bystander'-typed entries of G.escapedPile") and
the matching `parScoring.logic.ts` `// why:` are corrected to the two buckets.

### RS-5 — The WP-884 comment (default locked)

The `// why:` above the Hunt for Victims Bystander `koCard` (~:500-502), which says the KO "lowers PAR's derived bystanderLost",
is rewritten: the KO is recorded as a from-play loss (D-24839), so an Escape-Pile KO nets to zero in `bystanderLost` but still
lowers Midtown Bank Robbery's carried-away count.

### RS-6 — The bot rationale (default locked; comment only)

`ai.seatChoice.ts`'s Hunt answer is unchanged (rescue from the Escape Pile, else KO from it, else another rescue, else
decline); its file header (answer order only) is untouched. The Hunt JSDoc `// why:` (~:262-265) is rewritten: a rescue removes the Bystander from `bystanderLost` and adds
its VP; an Escape-Pile KO is now neutral to `bystanderLost` (D-24839) but still opens the KO-a-Hero thinning pick; a KO from a
Villain or the Mastermind would add a loss, so the bot never takes one.

## Scope (In)

- The counter key (RS-2) and the recorder helper with JSDoc and `// why:`.
- The recorder call at the Hunt for Victims KO site, and the RS-5 comment.
- Both derivations (RS-3), each `// why:` updated to cite D-24839 and the two buckets; correct any JSDoc that says
  `bystanderLost` counts only `G.escapedPile`.
- Tests:
  - `board/bystanders.logic.test.ts`: the recorder initialises to 1 from absent, increments, touches no other key;
  - `moves/huntForVictims.test.ts`: a KO from a City captive, the Mastermind and the Escape Pile each record 1; rescue, capture,
    decline and a stale option record nothing;
  - `scoring/parScoring.logic.test.ts`: escaped-only, counter-only, both summed; absent counter → escaped count; the sum flows to
    `penaltyBreakdown.bystanderLost`; an Escape-Pile KO scenario (escaped pile −1, counter +1) scores the same as no KO;
  - `simulation/par.aggregator.test.ts`: a terminal state with at least 1 escaped Bystander **and** a counter of at least 1
    asserts the absolute sum (the D-24339 test at ~:593-612 is the shape to follow) and equality with `deriveScoringInputs`;
  - tests index the counter through `BYSTANDERS_KOED_FROM_PLAY`, never the string literal; one test may pin the constant's value
    as a drift check;
  - control-revert: dropping the counter term in either copy fails a test.
- The RS-4 copy line and the `wiki/scoring.md` definition.
- D-24839 lands Active; governance close.

## Out of Scope

- The villain / mastermind / scheme Hunt for Victims (Lilin, Lilith, Ritual Sacrifice to Summon Chthon): a separate WP that calls
  this recorder.
- Any new KO site (HQ, "KO all Bystanders held by Villains", supply-stack KOs) and any change to the Victory-Pile KO sites.
- Weights, `ParBaseline`, `computeParScore`, scoring-config files, PAR artifacts, `scoringConfigVersion`,
  `rawScoreSemanticsVersion`, and any re-score of persisted rows.
- Midtown Bank Robbery's carried-away count and Chthon's KO-pile count.
- A UIState field or a live in-match "Bystanders lost" display.
- Server, registry, persistence schema, `game.ts`, moves, `getLegalMoves`.

## Files Expected to Change

- `packages/game-engine/src/types.ts` — modified — `BYSTANDERS_KOED_FROM_PLAY` key.
- `packages/game-engine/src/board/bystanders.logic.ts` — modified — `recordBystanderKoedFromPlay`.
- `packages/game-engine/src/board/bystanders.logic.test.ts` — modified — recorder tests.
- `packages/game-engine/src/moves/huntForVictims.logic.ts` — modified — recorder call + RS-5 comment.
- `packages/game-engine/src/moves/huntForVictims.test.ts` — modified — counter assertions.
- `packages/game-engine/src/scoring/parScoring.logic.ts` — modified — RS-3.
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — modified — derivation tests.
- `packages/game-engine/src/simulation/par.aggregator.ts` — modified — RS-3 mirror.
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — modified — symmetry test.
- `packages/game-engine/src/simulation/ai.seatChoice.ts` — modified, comments only — RS-6 rationale.
- `apps/arena-client/src/vfx/scoreCalcDisplay.ts` — modified — RS-4 note.
- `wiki/scoring.md` — modified — the new definition.
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24839), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

> **Scaffold (observed at draft, 2026-11-12).** RS-2 + RS-3 prototyped in a scratch copy at `70d9cb70`: game-engine **6987
> tests, 6987 pass, 0 fail**; no existing test changes (none deep-equals `G.counters` or a full breakdown after a Hunt KO; the
> `ownedCardKoTrigger` `LOCKED_TABLE` counts only `koCard` / `recordOwnedCardKoed`, so the recorder does not move it; no
> arena-client test pins the legend note). The executor re-runs it at HEAD; any new break is a STOP, never an assertion edit.

## Non-Negotiable Constraints

- Full file contents for every modified file: no diffs, no snippets. ESM only; Node v22+; human-style code per
  `docs/ai/REFERENCE/00.6-code-style.md` (`for...of`, no `.reduce()`, full-word names, JSDoc, `// why:`).
- Both derivations stay pure, end-of-match and read-only (D-4802 / D-4804); no `ctx.random`; no `boardgame.io` import in
  `parScoring.logic.ts` or `bystanders.logic.ts`.
- The counter is written only by `recordBystanderKoedFromPlay`, only at a from-play KO. No seeding at setup (that would move every
  hash).
- `PenaltyEventType`, `PENALTY_EVENT_TYPES`, `ScoringInputs`, `ScoreBreakdown`, `ScenarioScoringConfig` unchanged (no
  contract-file edit).
- `finalStateHash` sentinels, `PRE_WP080_HASH` and every PAR artifact byte-unchanged; a moved pin is a STOP, never a re-pin.

**Session protocol:** STOP and report if any sentinel, `PRE_WP080_HASH` or PAR value moves; if any existing test breaks (the
draft scaffold broke none); or if a from-play Bystander KO site exists that this WP's audit missed.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- New exported constant `BYSTANDERS_KOED_FROM_PLAY = 'bystandersKoedFromPlay'` (`types.ts`), a plain `G.counters` key, written
  lazily.
- New exported helper `recordBystanderKoedFromPlay(gameState: LegendaryGameState): void` (`board/bystanders.logic.ts`).
- `penaltyEventCounts.bystanderLost` = escaped-pile Bystanders + `BYSTANDERS_KOED_FROM_PLAY`, in both derivations. Shapes
  unchanged.
- No UIState field, projection, move, or persistence-schema change. Neither new symbol is re-exported from `src/index.ts`.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §21 (the moral hierarchy: a lost civilian is the heaviest penalty), §22
(immutability / version-pinning), §24 (replay-verified deterministic scoring), §26 (PAR calibration).
- **§21 wording, stated not stretched:** VISION §21's penalty line reads "Bystanders lost to escaping villains — the heaviest
  penalty". This WP keeps that bucket unchanged and, by the operator's decision of 2026-11-12, adds civilians KO'd from play to
  the same penalty. The moral hierarchy (losing a civilian is the worst outcome) is served, not contradicted. Whether §21's
  wording should name the KO'd-from-play case is the operator's call, outside this WP; D-24839 records the extension.
- **Outcome:** a civilian who dies now scores as lost, and killing one can no longer improve a score.
- **§22:** persisted rows keep their pinned breakdown; configs and PAR artifacts are unchanged (D-24395 posture).
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — no monetization or purchasable advantage.
- **Determinism preservation:** the counter is deterministic game state written at a move; matches without a from-play Bystander
  KO hash byte-identically. Replay: a competitive match captured before the deploy that resolved a Hunt for Victims KO and is
  submitted after it fails `replay_verification_failed` (its stored `replay_hash` predates the counter): the accepted pre-deploy
  window (D-24687 §4 precedent; stored rows frozen, D-24616 §5). Matches captured after the deploy score under the new rule.

## Funding Surface Gate

N/A — no nav, pricing or funding surface; one score-legend note string.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. A Hunt for Victims KO of a City captive, the Mastermind's captive, or an escaped Bystander sets
   `G.counters[BYSTANDERS_KOED_FROM_PLAY]` to 1 (2 after two). Rescue, capture, decline and a stale option leave it absent.
2. `deriveScoringInputs` returns `bystanderLost` = escaped-pile Bystanders + the counter; an absent counter adds 0.
3. A terminal state where an escaped Bystander was KO'd (escaped pile −1, counter +1) yields the same `bystanderLost` and
   `rawScore` as the state before the KO.
4. For a state with at least 1 escaped Bystander and a counter of at least 1, `deriveScoringInputsFromFinalState` returns the
   absolute sum, equal to `deriveScoringInputs`.
5. Reverting either derivation's counter term fails at least one test.
6. The score legend shows the RS-4 note; `wiki/scoring.md` states the from-play rule.
7. Engine and arena-client suites green; `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail; sentinels, `PRE_WP080_HASH` and
   PAR byte-unchanged; no scoring-config or PAR file in the diff.

## Verification Steps

1. `pnpm -r build` → 0; `git status` shows no unexpected generated churn (revert CRLF-only `lagn-v1.json` churn).
2. `pnpm --filter @legendary-arena/game-engine test` → 0; record baseline and delta (expect at least +10).
3. Control-revert: drop the counter term in each derivation in turn → a test fails; restore.
4. `pnpm --filter @legendary-arena/arena-client test` and `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
5. `pnpm -r --no-bail test` → 0 fail.
6. `pnpm wiki-viewer:check-links` → 0.
7. `git diff --name-only origin/main...HEAD` is a subset of §Files Expected to Change and contains no `data/scoring-configs/` or
   `data/par/` path.
8. At govern-close: `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
   `node scripts/check-number-ledger.mjs --check` → 0.

## Definition of Done

- [ ] All Acceptance Criteria pass; control-revert non-vacuous in both suites.
- [ ] Engine + arena-client suites and arena-client `typecheck` green; `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail;
      `wiki-viewer:check-links` 0.
- [ ] Sentinels, `PRE_WP080_HASH` and PAR byte-unchanged; `scoringConfigVersion` still 5.
- [ ] **Live-on-surface (D-24026):** on a match **created after the deploy** with Elsa Bloodstone, stage a Villain holding a
      Bystander, Hunt for Victims KO it, finish the match, and confirm the endgame breakdown counts it as a Bystander lost
      (and the legend note). Otherwise record it operator-pending in `STATUS.md`.
- [ ] `DECISIONS.md` back-annotations: an "Amended by D-24839" note on D-24339 (its "not a new counter" and MUST-bump
      sentences) and on D-24835 §9 and the KO half of §11 (the rescue half still holds).
- [ ] `docs/ai/STATUS.md` updated; D-24839 → Active (every clause of §Reserved Decision); `WORK_INDEX.md` checked;
      `EC_INDEX.md` Done; mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] No files outside `## Files Expected to Change` were modified.

## Reserved Decision (lands at execution)

D-24839 — a Bystander KO'd from play counts as lost (amends D-24339; supersedes the KO half of D-24835 §11 and §9's
`bystanderLost` sentence):

- **Definition.** `bystanderLost` = Bystanders carried away (`isBystanderCard` entries of `G.escapedPile`, D-24339 / D-24395)
  **plus** Bystanders KO'd from play: from a City Villain's or the Mastermind's captives, from the Escape Pile, or from the HQ.
  Not counted: KOs from the Bystander supply, from a Victory Pile, of a revealed never-captured Villain-Deck card, or by operator
  setters. Rescue, capture and decline are not KOs. An Escape-Pile KO nets to zero.
- **Recording.** A lazily written `G.counters` key `BYSTANDERS_KOED_FROM_PLAY` (`'bystandersKoedFromPlay'`), written only by
  `recordBystanderKoedFromPlay(G)` beside each from-play `koCard`. This amends D-24339's "no counter": end state cannot tell the
  KO's source. Matches without such a KO hash byte-identically.
- **Obligation.** Every future from-play Bystander KO site (villain Hunt for Victims, HQ KOs, KO-all-captives twists) calls the
  recorder. Enforced by review: any new KO site fails the `ownedCardKoTrigger` `LOCKED_TABLE` until it is classified, and the
  reviewer who classifies it also checks a from-play Bystander KO for the recorder. The recorder's JSDoc states the obligation. The queued villain Hunt for Victims WP (Lilin, Lilith, Ritual Sacrifice to Summon Chthon) is the
  first consumer and must cite D-24839; extending the `LOCKED_TABLE` failure message to name the recorder is deferred to it.
- **Symmetry.** Both `deriveScoringInputs` and `deriveScoringInputsFromFinalState` sum the two buckets.
- **Versions (amends D-24339).** D-24339's "any producer wired after production configs exist MUST bump
  `scoringConfigVersion`" is amended: a count correction that changes no weight, formula shape, config field or PAR baseline does
  not bump (as D-24395 already shipped). So no `scoringConfigVersion` / `rawScoreSemanticsVersion` bump and no PAR regeneration;
  a bump would disqualify every existing gauntlet clear (`gauntletTruth` qualifies only at the published version). Persisted rows
  keep their pinned breakdown (D-24616 §5).
- **Replay.** A competitive match captured before the deploy that resolved a Hunt for Victims KO, submitted after it, fails
  `replay_verification_failed`: the accepted pre-deploy window (D-24687 §4 precedent). Matches captured after the deploy score
  under the new rule; matches without a Hunt KO replay byte-identically. Where read-only production access allows, the executor
  records the count of captured artifacts in that window (the D-24616 §5 practice); otherwise it says the count was not taken.
- **Bot.** The Hunt answer is unchanged; its rationale now reads an Escape-Pile KO as neutral to `bystanderLost`.
- **Supersedes** D-24835's "stated consequence" that an Escape-Pile KO lowers `bystanderLost`. Midtown Bank Robbery's
  carried-away count is unchanged.

## Gate Record

Each gate ran as an independent subagent against the files on disk.

- **01.4 pre-flight, round 1: NOT READY.**
  - PS-1: the replay window was misstated. A pre-deploy captured match with a Hunt KO fails `replay_verification_failed` because
    the counter is hashed; it does not quietly re-score. Fixed in Context, Vision Alignment and a D-24839 "Replay" clause (D-24687
    §4 / D-24616 §5 precedents).
  - PS-2: `ai.seatChoice.ts`'s "pure gain … counts in bystanderLost" rationale would become false. Added comments-only (RS-6).
  - RS folded: the version clause states it amends D-24339 (gauntlet-clear reason); `bystanders.logic.ts` header update; the
    `LOCKED_TABLE` inventory replaces an unverifiable count; "Not changed" names the contract JSDoc, coach read and other copy;
    no `index.ts` re-export; the observed scaffold; the mindmap node moved to Scoring & PAR.
  - Empirical scaffold (scratch copy at `70d9cb70`): game-engine 6987 / 6987 pass, no existing test changes.
- **01.4 pre-flight, round 2: READY TO EXECUTE.** One wording RS (the Obligation clause overclaimed a test check), applied.
- **01.7 copilot, round 1: RISK → HOLD.** Six fixes, all applied:
  - #20: "Amended by D-24839" back-annotations on D-24339 and D-24835 §9 / §11 (KO half) at close; the heading names both.
  - #11: the aggregator symmetry test needs ≥ 1 escaped Bystander and counter ≥ 1 and asserts the absolute sum.
  - #12: the EC re-grep catches `gameState.ko =` (`\.ko = `) and compares with `LOCKED_TABLE`.
  - #14: the obligation lives in the recorder's JSDoc; the villain Hunt WP is the named first consumer.
  - #10 / #27: tests index the counter through the constant.
  - #26: the `wiki/scoring.md` and `par.aggregator.ts` JSDoc sites are listed.
- **01.4 pre-flight re-confirm (after the copilot edits): READY TO EXECUTE.**
- **01.7 copilot, round 2: PASS.** One optional nit (D-24839 claimed the Hunt `// why:` states the obligation, which the EC did
  not require); the phrase was dropped (deletion only).
- **00.3 lint, run 1: FAIL** on §4 (no explicit read list). Fixed with the Context Read bullet; RS-a (§21 wording stated, not
  stretched), RS-b (the bot edit narrowed to the Hunt JSDoc) and the EC header order were also applied.
- **00.3 lint, run 2: PASS.** Re-run rule: 01.4 re-confirmed READY TO EXECUTE and 01.7 confirmed PASS on the same text.
- `ledger:numbers:check`, `roadmap:counts:check`, `workindex:rows:check`, `workindex:executed:check`: all exit 0.
- Execution needs reserve PR #3300 merged (EC Before Starting).
- Out-of-scope papercut the copilot surfaced: `simulation/par.storage.ts:79` stamps `CURRENT_RAW_SCORE_SEMANTICS_VERSION = 3`
  while `scripts/generate-seed-par.mjs:98` and the seed artifacts are at 4. Pre-existing drift from the 3→4 bump; its own
  follow-up, not this WP.

## Lint Gate Self-Review (00.3)

- §1 Structure: PASS — all ten required sections present and non-empty; Out of Scope names six exclusions (villain Hunt for
  Victims, new KO sites, weights / configs / PAR / versions, Midtown and Chthon counts, UIState, server / registry / moves).
- §2 Constraints: PASS — full-file output, ESM, Node v22+, `00.6` cited; pure end-of-match derivations (D-4802 / D-4804), the
  counter written only by the recorder and never seeded, no contract-file edit, no hash or PAR re-pin; a three-trigger STOP
  protocol; locked values in the EC.
- §3 Assumes: PASS — baseline `a34b66a5`, reserve PR #3300, WP-528 / 586 / 884 ✅; the KO-site table tied to `LOCKED_TABLE`;
  counter conventions, hash surface, replay / gauntlet paths, UI projection, configs / PAR and the legend cited with file and line.
- §4 Context: PASS (after run 1) — explicit Read list (ARCHITECTURE, 00.6, docs/12, wiki, VISION §21) and D-entry scan; `00.2`
  untouched, with the reason.
- §5 Files: PASS — 12 files, each with its role (`ai.seatChoice.ts` comments only), plus governance at close; four are paired
  tests.
- §6 Naming: PASS — `BYSTANDERS_KOED_FROM_PLAY` / `recordBystanderKoedFromPlay` follow `recordOwnedCardKoed`; no 00.2 field.
- §7 Dependencies: PASS — no new npm dependency.
- §8 Boundaries: PASS — engine-only logic, no boardgame.io import in the touched helpers, nothing re-exported from `index.ts`;
  the client change is one note string; no server, persistence or UIState change.
- §9 Windows: PASS — `pnpm` / `node` / `git` commands only.
- §10 Env vars: N/A — none read or added.
- §11 Auth: N/A — no auth surface.
- §12 Tests: PASS — `node:test` `.test.ts` in four existing suites; constant-indexed counter; control-revert in both derivations;
  no network or DB.
- §13 Verification: PASS — eight steps with exact commands and exit 0, engine delta ≥ +10, a scope diff excluding
  `data/scoring-configs/` and `data/par/`, and the close-out checks.
- §14 Acceptance Criteria: PASS — 7 binary criteria, including the Escape-Pile net-zero case and non-vacuous symmetry.
- §15 Definition of Done: PASS — STATUS / DECISIONS (with the D-24339 and D-24835 back-annotations) / WORK_INDEX / EC_INDEX /
  mindmap / ledger and the scope check.
- §15.1 User-visible: PASS — Surface `play.legendary-arena.com`, `## User-Visible Impact`, D-24026 live check on a post-deploy
  match with an operator-pending fallback.
- §15.2 Risk tier: PASS — `MEDIUM` in the header; the EC line is byte-identical; not HIGH, so no threat model.
- §16 Code style: PASS — `00.6` cited; `for...of`, no `.reduce()`, no nested ternaries, never throws; JSDoc and `// why:`
  locations in the EC; one recorder seam per the D-24839 obligation and the D-24789 precedent.
- §17 Vision: PASS (after run 1) — §1, §21, §22, §24, §26; §21's literal wording is quoted and the extension attributed to the
  operator decision, not stretched; NG-1, determinism and replay-window lines.
- §18 Prose-vs-grep: N/A — no forbidden-token count gate; the EC KO-site re-grep is an audit.
- §19 Bridge staleness: N/A — no repo-state summary; the baseline is re-checked at execution.
- §20 Funding: PASS (N/A with reason) — no nav, pricing or funding surface; one score-legend note.
- §21 API catalog: PASS (N/A with reason) — no HTTP endpoint or `apps/server` library function.
- **EC-925:** 58 non-empty content lines (target ~60, ceiling 100); every required section present; Locked Values match WP
  RS-2..RS-6; arena-client `typecheck`, live-on-surface and mindmap gates present; scope lock in Before Starting.
- **Overall:** FAIL → PASS after the §4 fix.
