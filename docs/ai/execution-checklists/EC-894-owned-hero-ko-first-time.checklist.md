# EC-894 — "The first time one of your Heroes is KO'd this turn": Doctor Voodoo's Possessed by Brother's Spirit (Execution Checklist)

**Source:** docs/ai/work-packets/WP-856-owned-hero-ko-first-time.md
**Layer:** Game Engine (one-shot wait-and-see condition + Hero-aware KO signal + `flat-recruit` choose-one option) + card data

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce` — any edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `67d5f4e1` (WP-856 reserve merge, #3103); WP-853 shipped (`bf7150b8`).
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test` exit 0 (pre-flight: 6075 / 0, 1375 suites).
- [ ] Re-probe the parse (`buildHeroAbilityHooks` on `data/cards/dstr.json`): expect `recruit:4` + `attack:4`, no condition.
- [ ] Re-count `recordOwnedCardKoed(` calls at HEAD: expect 25 at the WP-853 pin's x/1 sites. Final shared signature
      `(G, ownerPlayerID, cardId, fromZone)`: if WP-855 executed first (`(G, ownerPlayerID, fromZone)`), insert `cardId`
      before `fromZone` and keep its `deckCardsKoedSinceResolve` branch and pending-choice draw hold (WP §Context "Coordination").
- [ ] RS-1 is LOCKED (armed at play; KOs before the play do not count). A strict-reading request is a SPEC amendment, not an in-session change.

## Locked Values (do not re-derive; verify at HEAD)
- **Markers** (`hero-ability-markers.json` → `dstr`, this order, each `{ "heroSlug": "doctor-voodoo", "cardSlug":
  "posessed-by-brothers-spirit", "abilityIndex": 0, "markupToken": … }`): `[keyword:owned-hero-koed]`, `[keyword:recruit:4]`,
  `[keyword:attack:4]`. `VALID_TOKEN_PATTERN` arms `^\[keyword:owned-hero-koed\]$` and `^\[keyword:recruit:[1-9]\d*\]$`;
  the script's "locked token forms" error message lists both.
- **Condition:** `export const OWNED_HERO_KOED_CONDITION_TYPE = 'ownedHeroKoedThisTurn'` in `hero/heroConditions.evaluate.ts`
  (beside `OWNED_CARD_KOED_CONDITION_TYPE`), appended to `WAIT_AND_SEE_CONDITION_TYPES`. Evaluate:
  `return (G.ownedHeroesKoedSinceResolve?.[playerID] ?? 0) > 0;` Describe: `'it needs a Hero of yours to be KO\'d this turn'`.
- **Parser:** `owned-hero-koed` after `owned-card-koed` in `HERO_PARSER_RECOGNIZED_MARKER_NAMES`; per-token arm pushes
  `{ type: OWNED_HERO_KOED_CONDITION_TYPE, value: '1' }`. `FLAT_RESOURCE_OR_PATTERN =
  /\+[1-9]\d*\[icon:(?:recruit|attack)\] or \+[1-9]\d*\[icon:(?:recruit|attack)\]/`; gate #1 = prefix OR that pattern.
  `FLAT_RECRUIT_OPTION_MARKER_PATTERN = /\[keyword:recruit:([1-9]\d*)\]/` → `{ kind: 'flat-recruit', magnitude }`.
- **Target hook:** `conditions: [{ type: 'ownedHeroKoedThisTurn', value: '1' }]`, `effects: [{ type: 'count-scaled-choose',
  countScaledChoiceOptions: [{ kind: 'flat-recruit', magnitude: 4 }, { kind: 'flat-attack', magnitude: 4 }] }]`.
- **Option:** `FlatRecruitChoiceOption { kind: 'flat-recruit'; magnitude: number }` in `ChooseOneOption`; resolve branch →
  `executeSingleEffect(G, context, playerID, front.cardId, { type: 'recruit', magnitude })`; UI `kind` adds `'flat-recruit'`;
  projection `{ kind: 'flat-recruit', resource: 'recruit', total: magnitude, label: \`+${magnitude} Recruit\` }`.
- **Field:** `ownedHeroesKoedSinceResolve?: Record<string, number>` on `LegendaryGameState` beside `ownedCardsKoedSinceResolve`;
  never set in `Game.setup`.
- **Recorder:** `recordOwnedCardKoed(G: LegendaryGameState, ownerPlayerID: string, cardId: CardExtId): void` (+ `fromZone` 4th
  if WP-855 landed first). Private gate
  `hasWaitingGrantWithCondition(G, conditionType): boolean` (replaces `hasWaitingOwnedKoGrant`). Owned-card count unchanged in effect but a gated BLOCK, not WP-853's early `return` (which
  would skip the Hero branch);
  then `if (cardId !== WOUND_EXT_ID && cardId !== BYSTANDER_EXT_ID && hasWaitingGrantWithCondition(G,
  OWNED_HERO_KOED_CONDITION_TYPE))` → lazy `{}` + 1 for the owner.
- **KO sites:** the 25 existing calls gain the KO'd card's id as the third argument (the variable passed to that site's
  `koCard` / `moveCardFromZone`). No site added; the WP-853 pin table (34 / 25) is unchanged.
- **Always defer:** the WP-853 branch picks `findConditionOfType(hook, OWNED_CARD_KOED_CONDITION_TYPE) ??
  findConditionOfType(hook, OWNED_HERO_KOED_CONDITION_TYPE)`; everything after the guard unchanged.
- **Firing:** Hero-KO hook: `repeatCount` stays 1; NOT added to the re-arm check (one-shot). Guarded
  `delete G.ownedHeroesKoedSinceResolve` right after the owned-card delete; same in `turn.onBegin` and `applyOnBeginParity`.
- **Ledger:** `KNOWN_CONDITIONS['owned-hero-koed'] = 'ownedHeroKoedThisTurn'`; provenance `owned-hero-koed` →
  `{ "wp": "WP-856", "decision": "D-24792" }`; pending live-verify key `dstr/doctor-voodoo|owned-hero-koed`.

## Guardrails
- No new hero keyword, handler, pending-choice queue, move, `CORE_MOVE_NAMES` entry, UIState field, or client file.
- List entry + `evaluateCondition` case land together (lockstep pin). RUNTIME pins, not `satisfies` (D-24372).
- Recorder gated per type; field consumed every resolve; `replay.execute.ts` untouched (D-24322). A moved sentinel is a STOP.
- Absorb Energies (WP-853) behaviour and tests unchanged; the cosm "or" line and Spy Network parse unchanged.
- Moves never throw; no `.reduce()`; no nested ternaries; no `any` / `@ts-ignore`; never edit a test to pass; never `git stash`.
- `dstr.json` regenerated from the marker map only. No per-card special-casing.

## Required `// why:` Comments
- Recorder third parameter + Hero filter (WP-828 precedent; consumed in-move → no hash surface).
- Parser condition arm; the "or" gate (printed "or" form = choose-one; ≥2 option markers still required); `flat-recruit`
  candidate; `VALID_TOKEN_PATTERN` arms (WP-856 / D-24792).
- Always-defer covering both owned-KO types; the Hero-KO hook left out of the re-arm (first time = one-shot); all three
  deletes (post-resolve, `turn.onBegin`, `applyOnBeginParity`).
- `FlatRecruitChoiceOption` (`heroCountSource.ts`) and the `'flat-recruit'` member (`uiState.types.ts`): WP-856 / D-24792, the
  D-24696 `flat-attack` sibling.
- `flat-recruit` resolve branch and projection (the D-24696 `flat-attack` mirror).

## Files to Produce
- `packages/game-engine/src/hero/{heroConditions.evaluate,deferredConditionalGrants,heroEffects.execute}.ts`,
  `setup/heroAbility.setup.ts`, `rules/heroCountSource.ts`, `moves/countScaledChoice.resolve.ts`,
  `ui/{uiState.types,uiState.build}.ts`, `types.ts`, `game.ts` (01.5 onBegin delete), `simulation/onBeginParity.ts` — modified.
- KO sites (third argument only): `moves/{healWounds,koDiscardChoice.resolve,koHeroChoice.resolve,melterKoChoice.resolve,optionalKoReward.resolve,revealThreeAssign.resolve,revealTopDispose.resolve,ruthlessDictatorChoice.resolve,scryKoChoice.resolve,seatChoiceTactics,operatorSetters}.ts`,
  `rules/mastermindHandlers.ts`, `villain/villainEffects.execute.ts`.
- `scripts/hero-mechanic-ledger.mjs`, `scripts/convert-cards/apply-hero-ability-markers.mjs`,
  `inputs/hero-ability-markers.json` — modified; `data/cards/dstr.json` — generated.
- Generated / provenance: hero ledger `{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json`, `mechanic-provenance.json`, `live-verify.json`,
  dashboard data copies + `useInPlayCoverage.test.ts` only if it moves.
- Tests: `hero/ownedHeroKoTrigger.test.ts` (new; the WP Scope cases incl. both option resolves, the Wound / other-seat
  pre-resolve key asserts, three Heroes in one move = `{ '0': 3 }` then one choice and exactly +4, Absorb + Possessed together, a `koHeroChoice` owing two + the parked choose-one both resolving), `hero/deferredConditionalGrants.test.ts` (list + `TRUTHY_FIXTURE`),
  `simulation/onBeginParity.test.ts`, `game.test.ts`, `setup/heroAbility.setup.test.ts` (the "or" gate),
  `ui/uiState.filter.test.ts` (`flat-recruit` survives); `heroConditions.evaluate.test.ts` only if a pin moves.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24792), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; game-engine, arena-client, dashboard `test` 0; sentinels byte-unchanged (no pin edited).
- [ ] Ledger row `dstr/doctor-voodoo` `owned-hero-koed` reads `condition`.
- [ ] Each of the 25 recorder calls passes the identifier its function passes to `koCard` / `moveCardFromZone` (or
      `WOUND_EXT_ID` at the Wound sites) — checked site by site in the diff.
- [ ] Provenance + pending live-verify rows added BEFORE `pnpm ledger:heroes`; regenerated, then 0: `cards:check`,
      `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`.
- [ ] D-24792 → Active (every clause of the WP's Reserved Decision); STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ +
      `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) on a match created after the deploy (`isMatchOlderThanServer: false`), incl.
      `uiStateSnapshot.pendingCountScaledChoice.options[0].kind === 'flat-recruit'`; or operator-pending in STATUS + `live-verify.json`.

## Common Failure Smells
- +4/+4 on play still — the markers did not reach the parser, or the pre-pass gate missed the "or" form.
- Condition missing from the hook — the arm was put before the pre-pass, whose splice cleared it.
- Two choices on a three-Hero move, or a choice on every later KO — the Hero-KO hook was re-armed.
- Wound heal opens the prompt — the Hero filter is missing. Sentinel moved — a recorder branch is ungated.
- `ReferenceError` on engine import — the const was put in `deferredConditionalGrants.ts`.
