# EC-914 — Heist: the four deferred Heist lines fire their full printed abilities (Execution Checklist)

**Source:** docs/ai/work-packets/WP-876-heist-deferred-lines.md
**Layer:** Game Engine (keywords, count source, Heist payload module, turn economy, move-a-Villain variant, seat-choice kind, UIState) + arena-client (`MoveVillainChoicePrompt.vue`, one `PendingSeatChoicePrompt.vue` heading) + curated `amwp` markers
**Risk Tier:** MEDIUM — gameplay logic, new turn-economy state on G, a new seat-choice kind and a pending-choice variant; no auth, money, persistence or server surface

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `a84d3041` with the reserve #3236 merged; `pnpm -r build && pnpm -r --no-bail test`
      and `pnpm --filter @legendary-arena/arena-client typecheck` exit 0; record every package's count.
- [ ] Read the models: `HEIST_CARDS` / `buildHeistFusion` (`setup/heroAbility.setup.ts` ~l.861–877, ~l.4519); `fireHeistPlays`
      (`hero/heroEffects.execute.ts` ~l.7383); `moves/attemptHeist.ts`; `resolveMoveVillainChoice`; the Red Skull owed = 1
      inline KO park (`rules/mastermindHandlers.ts` ~l.760–766); the Diving Block park + apply arm;
      `playedCardIdsThisTurn` (`hero/splitCard.logic.ts` ~l.227).
- [ ] Re-probe the four parses at HEAD after the markers land. If any differs from Locked Values, STOP and reconcile.

## Locked Values (do not re-derive; verify at HEAD)
- Markers (append to `amwp`): `scott-lang-cat-burglar/the-big-score` 0 `[keyword:heist-master-strike-ko]`;
  `…/putting-a-crew-together` 0 `[keyword:attack-per-count:distinct-costs-you-have:1]`; `…/x-con-security-van` 0
  `[keyword:heist-move-villain-ko-hero]`; `ant-army/revolutionary-anthem` 2 `[keyword:heist-scheme-twist-bonus:2]`.
- `heistEffects`: The Big Score `[{attack 4}, {type:'heist-master-strike-ko'}]`; Revolutionary Anthem `[{attack 2},
  {type:'heist-scheme-twist-bonus', magnitude: 2}]`; Putting a Crew Together `[{type:'attack-per-count', magnitude: 1,
  countSource:'distinct-costs-you-have'}]`; X-Con `[{type:'heist-move-villain-ko-hero'}]`. `HEIST_CARDS` = ten keys.
- Keywords appended to `HERO_KEYWORDS`: `heist-master-strike-ko`, `heist-scheme-twist-bonus`, `heist-move-villain-ko-hero`;
  all three in `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS`; the first and third in `NO_MAGNITUDE_KEYWORDS`.
- Count source `distinct-costs-you-have` appended to `HERO_COUNT_SOURCES` ("cards you have", rules v23 ~l.2164–2167:
  hand + cards played this turn, NOT the "Heroes you have" pool). Local helper `collectCardsYouHave(G, playerID)` in
  `heroCountSource.resolve.ts` = `playedCardIdsThisTurn(G, inPlay)`, `hand`, then controlled Artifacts (deduped), minus
  `pile-wound` / `pile-bystander`;
  `resolveCountSource` arm = `countDistinctCostsOfCardsYouHave` (distinct `cardStats[id]?.cost ?? 0`, 0 included);
  `explainCountSourceInputs` arm = the pool; plus a `countSourceLabel.ts` arm. `heroConditions.evaluate.ts` untouched.
- `TurnEconomy.heistRevealedCardId?: CardExtId` (lazy, carried, reset); `markHeistAttempted(economy, revealedCardId:
  CardExtId)`, parameter required; update its three one-argument test calls (~l.951, ~l.957, ~l.969), keep the omit-when-absent pins.
- Markers: `VALID_TOKEN_PATTERN` (`apply-hero-ability-markers.mjs` ~l.147–148) + the error-message forms list (~l.365–368).
- Seat choice: kind `heist-shuffle-villain-deck`; seat = active player; options `Shuffle the Villain Deck` (0) /
  `Leave the Villain Deck as it is` (1); `defaultOptionIndex: 1`; one prompt per Heist. Apply =
  `applyHeistShuffleResolvedSeatChoice(G, choice, shuffleContext)` in `heistPayloads.logic.ts`, its arm placed before the
  generic fall-through; shuffle = `shuffleContext.random.Shuffle([...deck])`. Prompt heading (`PendingSeatChoicePrompt.vue`
  `case`): `Revolutionary Anthem: shuffle the Villain Deck?`.
- `PendingMoveVillainChoice.variant?: 'x-con-security-van'` and `UIPendingMoveVillainChoice.variant?` (chooser-only, omitted
  when absent). Variant rules, in the named `resolveXConSecurityVanMove`: empty destination only (`G.city[i] === null`,
  occupied = silent invalid), no rescue, KO after a move only via the NEW export `koOneOfYourHeroes(G, playerID):
  { outcome: 'none' } | { outcome: 'parked' } | { outcome: 'koed'; koedCardId: CardExtId; zone: VillainKoZone }` (owed = 1;
  `koSingleTarget`; parks the bare `ko-hero` entry; no log). `villainEffectKoHero` is NOT modified.
- Choices open together (D-24823 §8): X-Con move, `ko-hero` and the Anthem shuffle resolve independently, any order.
- Big Score: type must be `'mastermind-strike'` AND `deck[0] === heistRevealedCardId`; KO via `koCard`; Bystander front of
  `G.piles.bystanders` to top; `villainDeckCardTypes[id] ??= 'bystander'`.
- Client (variant): heading and `aria-label` `X-Con Security Van: move a Villain to an empty space`; note
  `If you move a Villain, you KO one of your Heroes.`; destinations = empty spaces only (same `=== null` test; five- and
  six-space City tested).
- Bots: `selectDefaultMoveVillainArgs` → `{ decline: true }` for the variant (load-bearing: a sim would hang otherwise);
  `chooseByKind` → 1 for the shuffle kind.
- Count pins (read each at HEAD; values at `a84d3041`): `HERO_KEYWORDS` 95 → 98 in `rules/heroKeywords.test.ts` ~l.70,
  `rules/heroAbility.setup.test.ts` ordered list ~l.596–700, `setup/heroAbility.setup.test.ts` ~l.1605;
  `HERO_EFFECT_HANDLERS` 74 → 77 in `hero/heroEffects.execute.test.ts` ~l.154/~l.8123; `HERO_COUNT_SOURCES` 18 → 19 in
  `hero/heroCountSource.resolve.test.ts` ~l.83 + its ordered list.
- Tests (new cases): `hero/heistPayloads.test.ts` (each AC 3–7 branch); `setup/heistFusion.test.ts` (ten fusions, no hollow);
  `moves/attemptHeist.test.ts` (revealed id recorded; mixed-crew order; AC 7 choices open together); `moves/moveVillainChoice.resolve.test.ts` (variant
  occupied-reject, move+KO auto/park, decline, no rescue); `economy/economy.logic.test.ts`; `hero/heroCountSource.resolve.test.ts`;
  filter + keyset pin; bot answers (`simulation/ai.legalMoves.test.ts` via `getLegalMoves`, `simulation/ai.seatChoice.test.ts`);
  client `MoveVillainChoicePrompt.test.ts`, `PendingSeatChoicePrompt.test.ts`.
- Regen order: apply markers → live-verify rows → `ledger:heroes` → `effect-index` → `mechanics:metadata` →
  `sim:runtime-observed` → `sim:coverage --update-baseline`.

## Guardrails
- Payloads fire only from `fireHeistPlays` on a won Heist, in readying order; nothing at play.
- Revealed-type checks read `heistRevealedCardId`, never the live top.
- Only randomness: the shuffle apply's `shuffleContext.random`; moves and handlers never throw.
- `heistPayloads.logic.ts` never imports `boardgame.io` or `heroEffects.execute`; cycle bindings read inside function bodies.
- Spinning Cyclone and every villain `ko-hero` caller stay byte-identical; their existing tests pass unedited.
- Core sentinel / `finalStateHash` / PAR pins do not move (a moved pin is a STOP); the hollow / coverage feeds regenerate as listed. No `getLegalMoves`, `CORE_MOVE_NAMES`,
  `LOG_OUTCOMES` or `HeroAbilityTiming` change; no new move or component.
- `data/cards/amwp.json` only via `apply-hero-ability-markers.mjs`; only the listed count pins are edited.
- No `.reduce()`, no nested ternaries; JSDoc on every function; full-sentence log text.

## Required `// why:` Comments
- `HEIST_CARDS` (now ten; the hollow branch kept for future sets); the three keywords and the count source.
- `heistRevealedCardId` (why recorded, not re-read); the Big Score on-top check; the WWII `??= 'bystander'` typing.
- The shuffle park (one prompt per Heist) and its apply (`ctx.random`, default Leave).
- The X-Con variant: empty-only, no rescue, KO only after a move; `koOneOfYourHeroes` (the owed = 1 Red Skull shape).
- The filter pass-through of `variant`; each bot answer (never reached while bots do not Heist).

## Files to Produce
- Engine: `rules/{heroKeywords,heroCountSource}.ts`, `hero/{heroCountSource.resolve,countSourceLabel}.ts`,
  `setup/heroAbility.setup.ts`, `hero/heistPayloads.logic.ts` (**new**), `hero/heroEffects.execute.ts`,
  `economy/{economy.types,economy.logic}.ts`, `moves/attemptHeist.ts`, `types.ts`, `moves/moveVillainChoice.resolve.ts`,
  `villain/villainEffects.execute.ts`, `moves/seatChoice.resolve.ts`, `simulation/{ai.legalMoves,ai.seatChoice}.ts`,
  `ui/{uiState.types,uiState.build,uiState.filter}.ts`. `index.ts` NOT modified.
- Client: `apps/arena-client/src/components/play/{MoveVillainChoicePrompt,PendingSeatChoicePrompt}.{vue,test.ts}`.
- Data: `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/convert-cards/apply-hero-ability-markers.mjs`,
  `data/cards/amwp.json` (generated), `scripts/hero-mechanic-ledger.mjs` (comment refresh ~l.174–177 only).
- Generated: hero ledger, effect index, card mechanics, runtime-observed hollows, coverage baseline + provenance,
  `live-verify.json`, dashboard copies (+ `useInPlayCoverage.test.ts` only if its pin moves).
- Tests: new `hero/heistPayloads.test.ts`; the modified tests and pin files above, including
  `simulation/{ai.legalMoves,ai.seatChoice}.test.ts`.
- Close: `DECISIONS.md` (D-24823), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`.

## After Completing
- [ ] `apply-hero-ability-markers.mjs --validate`, `cards:check`, `cards:count-markers:check`: 0.
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail everywhere; arena-client `typecheck` 0; feed `:check`s 0.
- [ ] Dashboard `prebuild:coverage` + `test:coverage` 0; `ledger:numbers:check`, `workindex:rows:check`,
      `workindex:executed:check` 0.
- [ ] `git diff --name-only origin/main` ⊆ Files to Produce; five-step UIState contract met (Play Diagnostics checked).
- [ ] D-24823 Active; STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap ✅ + `roadmap:counts:write` + `:check` 0; ledger
      LANDED; D-24026 live-verify operator-pending with the two `live-verify.json` rows.

## Common Failure Smells
- Putting a Crew Together grants a flat +1: `distinct-costs-you-have` is missing from `HERO_COUNT_SOURCES`.
- The Big Score never KOs: it read `deck[0]`'s type after an earlier card changed the top, or the id was never recorded.
- X-Con swaps or rescues: the resolver ignored `variant`. The prompt still says Spinning Cyclone: `variant` was not passed
  through the filter.
