# EC-909 — Villain fight restrictions: Orrgo, Squirrel Girl, Doop (Execution Checklist)

**Source:** docs/ai/work-packets/WP-871-villain-fight-restriction-gate.md
**Layer:** Game Engine (fight-precondition table, gate, bot mirror, City projection, turn-economy flag) + Arena Client (`CityRow` gate arm) + card data (overlay markers, regenerated feeds)
**Risk Tier:** MEDIUM — a new move precondition with its bot mirror (a divergence freezes bot turns), three contract files, a lazy hashed `turnEconomy` field; no auth, money, persistence or server surface.

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] The WP-871 / EC-909 / D-24816 reservation (#3197) is on `main`. Every WP Assumes item (1-13) holds at HEAD; re-read each line anchor.
- [ ] `defeatCityVillainCore(` is still the only City-Villain defeat path (grep its callers and any other `G.city[…] = null` + Victory Pile push).
- [ ] `pnpm -r build`, then `pnpm -r --no-bail test`, exit 0; record the engine and arena-client counts.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.

## Locked Values (do not re-derive; verify at HEAD)
- Kinds, canonical order: `'requires-villain-defeated-this-turn'`, `'at-most-one-card-played'`, `'no-adjacent-villain'` —
  `VillainFightRestrictionKind`, `VILLAIN_FIGHT_RESTRICTION_KINDS`, `interface VillainFightRestriction { kind }` beside
  `VillainFightDiscardCost` in `rules/villainAbility.types.ts`.
- Marker `[fight-restriction:<kind>]`, pattern `/\[fight-restriction:([^\]]+)\]/g`; unknown / empty / extra `:` → no entry.
  `parseFightRestrictionLine`, `buildVillainFightRestrictions(registry: unknown, matchConfig: MatchSetupConfig)` (the
  `buildVillainFightDiscardCosts` signature and shape, per-copy fan-out), called with **`villainBuildConfig`** (Clash Monster Pit Orrgo).
- `G.villainFightRestrictions?: Record<CardExtId, VillainFightRestriction>` — omit-when-empty spread beside `villainFightDiscardCosts`.
- `turnEconomy.hasDefeatedVillainThisTurn?: boolean` (only ever `true`); `'hasDefeatedVillainThisTurn'` in `CarriedTurnFields`;
  copied by `carryConversionFlag`; `recordVillainDefeated(economy)` built like `recordSidekickReturned`.
- Helpers in `moves/villainDefeatRequirement.logic.ts`: `getFightRestriction`, `matchHasFightRestrictionKind`,
  `isFightRestrictionBlocking(state, playerId, cityIndex, restriction)`, `getFightRestrictionBlockReason(state, playerId, cityIndex)`,
  `FIGHT_RESTRICTION_REASONS`. Predicates: flag `!== true`; `playedCardIdsThisTurn(...).length > 1`; `city[i-1]` or `city[i+1]`
  non-null inside `G.city`; `default: { const unhandledKind: never = restriction.kind; return false; }` (exhaustiveness).
- Reasons (exact): `Defeat another Villain first this turn` · `You played more than one card this turn` ·
  `A Villain is in an adjacent city space`.
- `fightVillain` step 1: after the defeat-requirement return, before the discard-cost block. `getLegalMoves`: same spot, `continue`.
- `defeatCityVillainCore`: right after `G.city[cityIndex] = null`, `if (matchHasFightRestrictionKind(G, 'requires-villain-defeated-this-turn'))
  G.turnEconomy = recordVillainDefeated(G.turnEconomy);`.
- `UICityCard.fightRestrictionReason?: string`; `buildUIState` City loop gains an index; conditional spread in build and in
  `deepCopyCitySpaces` (every audience).
- `CityRow.gateForCell`: stage → heal → cost → discard → restriction; cue `data-testid="play-city-fight-restriction"`, text
  `Can't fight yet`, reason as its `title`, only in the viewer's Main stage with no heal lock.
- Overlay: `fightRestrictions` list (Orrgo `chmp/monsters-unleashed/orrgo` · Squirrel Girl `cvwr/great-lakes-avengers/squirrel-girl` ·
  Doop `ssw2/deadpools-secret-secret-wars/doop`, kinds in that order); locator prefix `you can't fight `; `fightRestrictionEditCount`
  subtracted in the `totalRequirementMarkers` line (~L689); banner names four kinds; final line keeps its leading `\n` and adds
  `${X} new [fight-restriction:] marker(s)` as the last counter.
- `subsystem-coverage.json`: Orrgo and Doop only → `{ "subsystem": "setup:fight-restriction", "wp": "WP-871", "decision": "D-24816" }`.

## Guardrails
- One predicate: only `isFightRestrictionBlocking` decides; move, bot and projection all call it.
- Fight only: `defeatCityVillainCore` and `defeatChoice.resolve.ts` never check the restriction (D-24737); a free defeat sets the flag.
- Silent refusal: no `G` write, no log line, no throw.
- Lazy: no table, no flag write, no UIState key in a match without the cards; `getLegalMoves` args unchanged (`{ cityIndex }`).
- STOP if `finalStateHash`, `PRE_WP080_HASH`, `sim:runtime-observed:check` or `sim:coverage --check` moves.
- Markers only (`apply-defeat-requirement-markers.mjs`); never `convert-cards-v15.mjs`. Squirrel Girl stays `unmarked` in the ledger.
- Drift / keyset pins are runtime assertions. No `.reduce()`, nested ternaries, `any`, `@ts-ignore`. Never `git stash`.

## Required `// why:` Comments
- `fightVillain.ts`: the gate (WP-871 / D-24816, state-only precondition, single helper); the recorder in the core (lazy, Orrgo-only,
  free defeats count, D-24737).
- `villainDefeatRequirement.logic.ts`: the `cityIndex ± 1` bound inside `G.city.length` (D-24764); `> 1` via `playedCardIdsThisTurn`,
  not `inPlay.length` (D-24776 / D-24794; inherited self-KO residual); the Mastermind does not count for Orrgo; the
  `FIGHT_RESTRICTION_REASONS` constant (engine-owned public copy); the `never` exhaustiveness default.
- `ai.legalMoves.ts`: the mirror (D-24364; a divergence spins the bot to the 100-step cap).
- `economy.logic.ts`: the carry entry (the post-defeat cost spend rebuilds the economy).
- `villainDefeatRequirement.setup.ts`: sibling table, not a third requirement kind (D-24750 precedent).
- `uiState.build.ts` / `uiState.filter.ts`: public inputs, `ctx.currentPlayer` like `fightCost`; the five-step pass-through.
- `CityRow.vue`: gate position (resource before structural) and the loud cue (match `OSth9-iV03C` feedback).

## Files to Produce
- Engine `packages/game-engine/src/` (modified): `rules/villainAbility.types.ts` + test; `setup/villainDefeatRequirement.setup.ts` + test;
  `setup/buildInitialGameState.ts` + `setup/buildInitialGameState.shape.test.ts` (T25); `rules/clashMonsterPit.test.ts` (T25b,
  one added case); `types.ts`; `economy/economy.types.ts`, `economy/economy.logic.ts` + test;
  `moves/villainDefeatRequirement.logic.ts` + test; `moves/fightVillain.ts` + test; `simulation/ai.legalMoves.ts` + test;
  `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts`.
- Client (modified): `apps/arena-client/src/components/play/CityRow.vue` + `CityRow.test.ts`.
- Data: `scripts/convert-cards/apply-defeat-requirement-markers.mjs`, `scripts/convert-cards/inputs/villain-defeat-requirements.json`,
  `scripts/coverage/subsystem-coverage.json` (modified); `data/cards/chmp.json`, `cvwr.json`, `ssw2.json`, the villain ledger
  json/csv, `data/metadata/effect-implementation-index.json` (regenerated).
- Close: `docs/ai/DECISIONS.md` (D-24816), `docs/ai/ARCHITECTURE.md` + `.claude/rules/architecture.md` (one sentence each),
  `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`,
  `docs/ai/post-mortems/01.6-WP-871-villain-fight-restriction-gate.md` (new; 01.6 mandatory), `docs/ai/coverage/live-verify.json`
  (only if live-verify is observed in-session).

## After Completing
- [ ] T1-T25b pass (T21 lives in `uiState.filter.test.ts`; T25b in `clashMonsterPit.test.ts` pins the Clash `villainBuildConfig`
      wiring; T2 and T25b read the regenerated card data, so run the overlay before the engine tests); `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail; arena-client `typecheck` 0; counts recorded.
- [ ] Overlay: 3 new `[fight-restriction:]` markers, re-run 0; `git diff data/cards/` = 3 files, one line each. Rejection cases observed by
      hand and recorded in the commit body.
- [ ] Regenerate after the overlay: `pnpm -r build && pnpm ledger:villains && pnpm effect-index`; then
      `cards:check`, `cards:count-markers:check`, `effect-index:check`, `ledger:villains:check`, `ledger:heroes:check`,
      `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check` 0; ledger shows Orrgo + Doop `subsystem`, Squirrel Girl unchanged.
- [ ] Eight revert proofs observed and restored (gate, mirror, carry entry, filter spread, client arm, core recorder call,
      lazy `matchHasFightRestrictionKind` guard, `config` for `villainBuildConfig`).
- [ ] D-24816 Active covering every Reserved Decision clause; ARCHITECTURE / rules sentence; STATUS with the Fortify, Mastermind-
      restriction, Forearm / Iron Fist, Blob / Venom and registry-viewer raw-marker follow-ups; 01.6 post-mortem authored; WORK_INDEX `[x]`; EC_INDEX Done; mindmap ✅ + `roadmap:counts:write` /
      `roadmap:counts:check` 0; `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` 0; ledger LANDED note.
- [ ] `EC-909:` then `SPEC:`; `git diff --name-only origin/main...HEAD` inside Files to Produce.
- [ ] Live-on-surface (D-24026), in a match whose setup lists all three groups (autoplay setupData or lobby config; setter-staged
      cards only restrict when their group is in setup): Doop / Squirrel Girl / Orrgo blocked with their reasons and unblocked when
      the condition clears; `uiStateSnapshot` shows `fightRestrictionReason`. Or operator-pending in STATUS.

## Common Failure Smells
- Orrgo stays blocked after a fight: `hasDefeatedVillainThisTurn` missing from `CarriedTurnFields` (the cost spend dropped it).
- The bot re-picks the same fight until the step cap: the `getLegalMoves` mirror is missing or sits after the cost check with a
  different helper.
- A hash oracle moved: the flag is written unconditionally, or the table is spread when empty.
- Fight button enabled but nothing happens: `fightRestrictionReason` dropped by `deepCopyCitySpaces` (five-step step 3).
- A Monster Pit Orrgo (Clash of the Monsters Unleashed) is fightable at turn start: the builder got `config`, not `villainBuildConfig`.
- The overlay reports `[require-to-defeat:]` markers on a fresh run: the fight-restriction edits were not subtracted (~L689).
- Squirrel Girl blocked after one card: `inPlay.length` read instead of `playedCardIdsThisTurn`, or `>= 1` instead of `> 1`.
