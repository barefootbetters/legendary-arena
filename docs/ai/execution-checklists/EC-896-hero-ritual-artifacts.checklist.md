# EC-896 — Hero Artifacts you control and Ritual Artifacts: Doctor Voodoo's Staff of Legba and Medallion of Many Loas (Execution Checklist)

**Source:** docs/ai/work-packets/WP-858-hero-ritual-artifacts.md
**Layer:** Game Engine (controlled record, cleanup keep, `useRitualArtifact` + predicate, two ritual keywords, two turn-economy
ledgers, class count) + Arena Client (Artifacts group, Use button) + card data

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce` — any edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `e064d497`; WP-783, WP-803, WP-648, WP-842, WP-856 shipped.
- [ ] `pnpm -r build`, then game-engine, arena-client (+ typecheck) and dashboard `test` exit 0; record the engine count.
- [ ] Re-probe the parse (`buildHeroAbilityHooks` on `data/cards/dstr.json`): Staff `[{ type: 'attack' }]`, Medallion
      `[{ type: 'attack', magnitude: 1 }]`, no condition.
- [ ] Re-read the three `HERO_KEYWORDS` pins (87, or more if WP-857 / WP-859 landed — WP §Context "Coordination") and the
      `game.test.ts` move count (54).

## Locked Values (do not re-derive; verify at HEAD)
- **Keywords:** `'ritual-recruited-hero'`, `'ritual-hero-classes'` appended last to `HeroKeyword` and `HERO_KEYWORDS` together.
  `export const RITUAL_ARTIFACT_EXECUTED_KEYWORDS: readonly HeroKeyword[] = ['ritual-recruited-hero', 'ritual-hero-classes']`
  in `heroEffects.execute.ts`, joined into `MVP_KEYWORDS` like `HAND_ACTION_EXECUTED_KEYWORDS`; no handler; not in
  `HANDLED_KEYWORDS`. Parser: both added to `SELF_COMPUTED_ATTACK_KEYWORDS`; NOT to `HERO_PARSER_RECOGNIZED_MARKER_NAMES`.
- **Markers** (`hero-ability-markers.json` → `dstr`, after the doctor-voodoo Possessed entries): `{ "heroSlug": "doctor-voodoo",
  "cardSlug": "staff-of-legba", "abilityIndex": 0, "markupToken": "[keyword:ritual-recruited-hero]" }`, then `{ …,
  "cardSlug": "medallion-of-many-loas", …, "markupToken": "[keyword:ritual-hero-classes:3]" }`. `VALID_TOKEN_PATTERN` arms
  `^\[keyword:ritual-recruited-hero\]$`, `^\[keyword:ritual-hero-classes:[1-9]\d*\]$`; the error message lists both.
- **Target hooks:** Staff `{ timing: 'onPlay', keywords: ['ritual-recruited-hero'], effects: [{ type: 'ritual-recruited-hero' }] }`;
  Medallion `{ timing: 'onPlay', keywords: ['ritual-hero-classes'], effects: [{ type: 'ritual-hero-classes', magnitude: 3 }] }`.
- **Turn economy:** `TurnEconomy.highestRecruitedHeroCost?: number`, `TurnEconomy.ritualUsedPlayedCardIds?: CardExtId[]`; both in
  `CarriedTurnFields` + `carryConversionFlag` (present-only); setters `recordRecruitedHeroCost(economy, cost)` (max) and
  `recordRitualUsedPlayed(economy, cardId)` (append), spreading the carry like `recordOutOfTimePlayed`. `resetTurnEconomy`
  unchanged. `playedCardIdsThisTurn` unions `G.turnEconomy?.ritualUsedPlayedCardIds` (skip present ids) with no early return
  before it (today's `outOfTimePlayedCardIds === undefined` early return must not skip the union).
- **Field** (`types.ts`, beside `outOfTimeCards`): `controlledArtifacts?: Record<string, CardExtId[]>`; never set in `Game.setup`;
  never cleared at a turn boundary.
- **Module** `moves/ritualArtifact.ts` exports `isRitualArtifact(G, cardId)`, `matchHasRecruitedHeroRitual(G)`,
  `ritualArtifactOptions(G, playerId)`, `ritualArtifactReward(G, playerId, cardId)`, `useRitualArtifact(context, { cardId })`,
  type `UseRitualArtifactArgs = { cardId: CardExtId }`.
- **Predicate:** no seat check (callers pass `ctx.currentPlayer`); `[]` unless `G.currentStage === 'main'` and
  `!hasAnyPendingChoice(G)`; candidates: distinct `inPlay` ids, then `G.controlledArtifacts?.[playerId]`; listed when
  `isRitualArtifact` and — Staff: `G.turnEconomy?.highestRecruitedHeroCost !== undefined`; Medallion:
  `countDistinctHeroClassesYouHave(G, playerId) >= magnitude`.
- **Reward:** Staff `highestRecruitedHeroCost`; Medallion `countDistinctHeroClassesYouHave`, read before the card moves.
- **Use:** card → `discard` via `moveCardFromZone`, from `inPlay` (then `recordRitualUsedPlayed`) else from the controlled list
  (delete the empty list key, then the empty map); `pushLog` "Player N used <card>'s Ritual: discarded it."; then, only when
  `reward > 0`, `executeSingleEffect(G, context, playerId, cardId, { type: 'attack', magnitude: reward })` (logs "gained +R attack
  from <card>"). Ritual-type dispatch: exhaustive `if / else if`; unrecognized → not listed, reward 0.
- **VP lists:** `scoring.logic.ts` `offPlayCardIds` (`gameState.controlledArtifacts?.[playerId] ?? []`) and `bloodFrenzy.logic.ts`
  (identical, `G.…`) spread the controlled list. Spectrum gate text → "in hand, play, or Artifacts you control". Count-marker
  DEFERRED Medallion reason → "Ritual Artifact modeled by WP-858 / D-24794 (`ritual-hero-classes`); not a per-count onPlay grant."
- **RS-6:** Medallion threshold and reward both read at use time.
- **Cleanup:** before the in-play discard, `isRitualArtifact` cards in `inPlay` → `G.controlledArtifacts[playerID]` (lazy);
  `pushLog` "Player N keeps <card> in front of them as an Artifact."
- **Recruit record:** in each recruit move after the spend, when `matchHasRecruitedHeroRitual(G)`:
  `G.turnEconomy = recordRecruitedHeroCost(G.turnEconomy, requiredCost)` (the move's own computed cost).
- **Class count:** third loop over `G.controlledArtifacts?.[playerID] ?? []` (`heroClass` / `heroClass2`, printed only) in
  `countDistinctHeroClassesYouHave` and `collectDistinctHeroClassCards`.
- **Registration:** `useRitualArtifact: { move: useRitualArtifact, client: false }` in `game.ts`.
- **UI:** `UIPlayerState.controlledArtifacts?: UIDisplayEntry[]` (PUBLIC, the `outOfTimeCards` lines);
  `UITurnEconomyState.ritualArtifactOptions?: CardExtId[]` (beside `phasingOptions`); both omitted when empty. Client:
  `'useRitualArtifact'`; `PlayedCardsRow` props `controlledArtifacts`, `ritualCardIds`, optional `submitMove`; group "Artifacts — N";
  `data-testid="use-ritual-artifact"`; empty state requires both lists empty.
- **Pins:** `HERO_KEYWORDS.length` +2 at all three sites (`rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` incl.
  `expectedKeywords` appended last, `setup/heroAbility.setup.test.ts`); `game.test.ts` 54 → 55 (`useRitualArtifact` sorts last).
  Provenance `ritual-recruited-hero`, `ritual-hero-classes` → `{ "wp": "WP-858", "decision": "D-24794" }`; ledger
  `MOVE_EXECUTED_HANDLER_MODULES` both → `packages/game-engine/src/moves/ritualArtifact.ts`; pending live-verify keys
  `dstr/doctor-voodoo|ritual-recruited-hero`, `dstr/doctor-voodoo|ritual-hero-classes`.

## Guardrails
- Move contract: validate → stage gate → `ritualArtifactOptions` → `zoneOps` mutation → void; never throw.
- One legality source (the predicate) for the move and the projection; the client never re-derives legality.
- Not a `CoreMoveName`, not in `MOVE_ALLOWED_STAGES`, not in `getLegalMoves`, not in the simulation / PAR move maps.
- All three fields lazy and absent without the marked cards; the recruit record written only in a Staff-hook match. A moved
  sentinel is a STOP. `replay.execute.ts` untouched.
- Unmarked Artifact cards unchanged; selection by keyword only, no per-card special-casing.
- Import cycle: read imported bindings only inside function bodies; no module-level constant derived from an import.
- No `.reduce()`, no nested ternaries, no `any` / `@ts-ignore`; never edit a test to pass; never `git stash`.

## Required `// why:` Comments
- The ritual category, the `SELF_COMPUTED_ATTACK_KEYWORDS` entries and token arms (WP-858 / D-24794); cleanup keep (rules p.17).
- Predicate (single legality source; RS-3 window; bots excluded); reward read before the card leaves; the dispatch fallback.
- Recruit record gate (no hash surface) + RS-1; both carries / setters; the union (L3441-3453); the class half (L930-932); VP lists.
- The `types.ts` field; the two UIState fields (audience, D-12803).

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts`, `hero/heroEffects.execute.ts`, `setup/heroAbility.setup.ts`,
  `economy/{economy.types,economy.logic}.ts`, `hero/splitCard.logic.ts`, `moves/endOfTurnCleanup.logic.ts`,
  `moves/{recruitHero,recruitOfficer,recruitSidekick}.ts`, `hero/{heroConditions.evaluate,heroCountSource.resolve}.ts`, `types.ts`,
  `scoring/scoring.logic.ts`, `economy/bloodFrenzy.logic.ts`, `game.ts` (01.5 registration), `ui/{uiState.types,uiState.build,uiState.filter}.ts` — modified; `moves/ritualArtifact.ts` — new.
- `apps/arena-client/src/components/play/{uiMoveName.types.ts,PlayedCardsRow.vue}`, `apps/arena-client/src/pages/{PlayDesktop,PlayMobile}.vue`.
- `scripts/hero-mechanic-ledger.mjs`, `scripts/check-hero-count-markers.mjs`, `scripts/convert-cards/apply-hero-ability-markers.mjs`, `inputs/hero-ability-markers.json`;
  `data/cards/dstr.json` (generated).
- Generated / provenance: hero ledger `{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json`, `mechanic-provenance.json`, `live-verify.json`,
  dashboard data copies + `useInPlayCoverage.test.ts` only if it moves.
- Engine tests (every case in WP §Scope "Tests"): `moves/ritualArtifact.test.ts` (new), and `.test.ts` of `economy/economy.logic`,
  `game`, `rules/{heroKeywords,heroAbility.setup}`, `setup/heroAbility.setup`, `hero/{heroEffects.execute,heroConditions.evaluate}`,
  `ui/{uiState.filter,uiState.types.drift}`, `scoring/scoring.logic`, `economy/bloodFrenzy.logic`.
- Client tests: `components/play/PlayedCardsRow.test.ts`, `pages/{PlayDesktop,PlayMobile}.test.ts`.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24794), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; engine, arena-client (+ typecheck), dashboard `test` 0; sentinels byte-unchanged (no pin edited).
- [ ] Wand of Watoomb's parse and cleanup behaviour unchanged (test recorded).
- [ ] Provenance + pending live-verify rows added BEFORE `pnpm ledger:heroes`; regenerated, then 0: `cards:check`,
      `cards:count-markers:check`, `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`.
- [ ] D-24794 → Active (every clause of the WP's Reserved Decision); STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ +
      `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED note (D-24794 line: "marker-selected").
- [ ] Live-on-surface (D-24026) on a match created after the deploy, incl. `uiStateSnapshot.players[0].controlledArtifacts` and
      `economy.ritualArtifactOptions`; or operator-pending in STATUS + `live-verify.json`.

## Common Failure Smells
- +1 Attack on Medallion play — missed `SELF_COMPUTED_ATTACK_KEYWORDS`; a `no-handler` hollow — category not in `MVP_KEYWORDS`.
- Every Artifact card kept — the keep read the printed keyword; no Use on a later turn — the predicate read only `inPlay`.
- A ledger vanishes mid-turn — missing carry; a used Medallion not "played" — the union sits behind the Out of Time early return.
- Medallion short by one — reward read after the move. Sentinel moved — a field written ungated.
