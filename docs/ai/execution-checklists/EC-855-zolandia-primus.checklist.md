# EC-855 — Captain Zolandia + Primus (Execution Checklist)

**Source:** docs/ai/work-packets/WP-817-zolandia-primus.md
**Layer:** Game Engine (+ Arena Client consumer, card-data markers, derived feeds)

## Before Starting
- [ ] WP-816 merged; `VILLAIN_EFFECT_PRIMITIVES` length recorded (29 at draft).
- [ ] `fightVillain` step 1 still ends with the defeat-requirement check before the stage gate; `getLegalMoves` fight branch still mirrors it (~L1082-1100).
- [ ] `enqueueEscapeProcedure` still runs before the onEscape `executeVillainAbilities` (`villainDeck.reveal.ts` ~L646 / ~L661); the opener's empty-queue branch is still `delete …; return;`.
- [ ] `countDistinctHeroClassesYouHave` still exported and its imports do not reach `villain/`.
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; record the engine and arena-client test totals.

## Locked Values (do not re-derive)
- Primitives appended last, in order: `gain-recruit-current-per-hero-class` (#30, no params), `discard-hero-each-player-by-cost` (#31, `:<c>[+<c>…]`). `eligibleCosts?: readonly number[]` on the descriptor, not in `descriptorKey`.
- Cost-list grammar (both markers): ≥ 1 `+`-joined tokens matching `^(0|[1-9][0-9]*)$`, strictly ascending; anything else → null / inert.
- Fight marker `[discard-to-fight:cost:2+3+5+7]` → `G.villainFightDiscardCosts[instanceId] = { eligibleCosts }` (omit-when-empty, per copy, fresh objects). `VillainFightDiscardCost { eligibleCosts: number[] }`.
- Helpers in `moves/villainDefeatRequirement.logic.ts`: `getFightDiscardCost`, `isHandCardCostOneOf` (`offPlayCardStats` cost; undefined → false), `listEligibleHandCardsByCost` (hand order), `selectDefaultCostDiscardCard` (lowest cost, earliest tie), `formatEligibleCostList` (`2` / `2 or 3` / `2, 3, 5, or 7`).
- Names: `VillainFightDiscardCost`, `PendingEscapeEffectDiscard { escapedCardId; eligibleCosts }`, `pendingEscapeEffectDiscards?: PendingEscapeEffectDiscard[] | undefined`, `villainFightDiscardCosts?: Record<CardExtId, VillainFightDiscardCost>`, `buildVillainFightDiscardCosts`, `parseFightDiscardCostLine`, `openEscapeEffectDiscardIfNeeded`, `buildEscapeEffectCostDiscardChoice`, `applyEscapeEffectCostDiscard`, `villainEffectGainRecruitCurrentPerHeroClass`, `villainEffectDiscardHeroEachPlayerByCost`.
- `FightVillainArgs.discardCardId?: CardExtId` (runtime string guard). Step 1 refusal unless string, non-empty, in hand, eligible. Step 3 before `defeatCityVillainCore`: `discardFromHand`, then `` `Player ${currentPlayer} discarded ${formatCardRef(G.cardDisplayData, discardCardId)} to fight ${formatCardRef(G.cardDisplayData, cardId)}.` `` `'applied'`. No cost → arg ignored.
- `getLegalMoves`: discard-cost villain → `{ cityIndex, discardCardId: selectDefaultCostDiscardCard(…) }`, null → skip; all others `{ cityIndex }` unchanged.
- Zolandia: recruit += `countDistinctHeroClassesYouHave(G, currentPlayer)`; `` `${label} effect: gained +${count} recruit for the ${count} Hero Class(es) you have.` `` `'applied'` / `` `${label} effect: you have no Hero Classes in hand or play, so no recruit was gained.` `` `'blocked'`.
- Primus Escape: push `{ escapedCardId, eligibleCosts }` on lazy `G.pendingEscapeEffectDiscards`; `` `${label} effect: each player must discard a Hero that costs ${formatEligibleCostList(costs)}.` `` `'applied'`; missing costs → `` `${label} effect: no discard costs were given; no effect.` `` `'blocked'`.
- Opener: empty-queue branch → `delete …; break;`, then `openEscapeEffectDiscardIfNeeded` after the loop (same open-choice / endgame early returns). Kind `ESCAPE_EFFECT_COST_DISCARD_KIND = 'escape-effect-cost-discard'`; options `` `${name} (cost ${cost})` `` in hand order; seat with none → `` `Escape effect: Player ${seat} has no Hero that costs ${costList} to discard.` `` `'blocked'`; step-2 ride rule; `defaultOptionIndex: 0`; apply ascending via `discardFromHand`, `` `Player ${seat} discarded ${formatCardRef(…)} (Escape effect).` `` `'applied'`.
- Bot: kind joins the `indexOfLeastValuableCard` branch (bot-ally only; autoplay / sim / PAR use `defaultOptionIndex` 0). Drop set (`mastermindVictory.logic.ts` + its test's `ALL_PENDING_FIELDS`) and board-busy guard (`operatorSetters.logic.ts` + a `GATE_BLOCKERS` row) gain the new queue.
- Both primitive-count pins (`villainAbility.types.test.ts` ~L356-396 and ~L612-613) move 29 → 31.
- `UICityCard.fightDiscardCosts?: number[]` (fresh copy; conditional spread in build and `deepCopyCitySpaces`). `UIPlayerState.handCosts?: (number | null)[]` = `offPlayCardStats(…)?.cost ?? null` per hand card, owner-only like `handCards` / `handDisplay`.
- Client: `CityRow` props `viewerHandCards` / `viewerHandDisplay` / `viewerHandCosts` (default `[]`); eligibility reads `viewerHandCosts` (printed `display.cost` is `null` for Officer / Sidekick); `gateForCityIndex` (slash gesture) returns false for a `fightDiscardCosts` card; gate order stage → heal → cost → discard, reason `` `Needs a card that costs ${list} to discard` ``; chooser + Cancel; submits `{ cityIndex, discardCardId }` (+ `useExcessiveViolence: true` from EV). Prompt heading `A Villain escaped — choose a Hero to discard`.
- Data: marker map Zolandia `fight` / Primus `escape` rows; requirement map `fightDiscardCosts` row; script final line `` `Done. ${S} set(s) processed, ${R} new [require-to-defeat:] marker(s) and ${F} new [discard-to-fight:] marker(s) appended.` ``; locator = single line whose `trimStart().toLowerCase()` starts with `to fight `. Provenance rows → WP-817 / D-24750.

## Guardrails
- One cost predicate (`isHandCardCostOneOf`); no other inline cost scan.
- The fight gate is in step 1, before any `G` write; the bot mirror lands in the same commit (D-24364).
- Byte-identical for every non-Primus villain and match: no new `G` key, no extra arg in `getLegalMoves`, hash oracles unchanged (STOP if one moves).
- The effect-discard queue never opens while an escape procedure is owed or any choice is open.
- Every hand→discard goes through `discardFromHand`.
- Only `fightVillain` pays the discard cost; `defeatCityVillainCore` and card-effect defeats stay unchanged.
- The Escape-effect discard resolves after the move and after the new Villain's Ambush: D-24750 amends D-24656 point 4 for this effect only (rules v23 L573-575 deviation); every other Escape effect stays inline.
- No parser reads English; markers only; never run `convert-cards-v15.mjs`.
- Client submits intent only; the engine re-validates. No engine-internal import in the client.

## Required `// why:` Comments
- The step-1 gate: D-24185 pre-commit precondition extended to a fought villain; atomic, so no strandable pending discard (D-24750).
- The `getLegalMoves` branch: mirrors the move guard with the same helpers (D-24364); cheapest eligible card.
- `isHandCardCostOneOf`: one predicate for "a card" and "a Hero" (Wounds have no cost); off-play view for split cards.
- The opener `break` + tail call: rule order — steps 1-2 of every escape first, then owed Escape-effect discards (D-24750 amends D-24656 point 4 for this effect; rules v23 L573-575 deviation).
- The Escape handler: the executor has no `events`, so it records the owed discard for the opener.
- The Zolandia handler: the hero side's counter, hand + play (D-24529 / D-24694).
- `eligibleCosts` on the descriptor: kept out of `descriptorKey`; the position-30/31 append note in the types array AND the script copy.
- `fightDiscardCosts` in `deepCopyCitySpaces`: must pass through or the whitelist drops it (EC-206 / #1165).

## Files to Produce
- Engine: `rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`, `setup/villainDefeatRequirement.setup.ts`, `moves/villainDefeatRequirement.logic.ts`, `moves/fightVillain.ts`, `simulation/ai.legalMoves.ts`, `villain/villainEffects.execute.ts`, `villainDeck/villainEscapeProcedure.ts` — each + its test — **modified**
- Engine: `setup/buildInitialGameState.ts` (builder call + spread), `types.ts`, `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts` + test, `endgame/mastermindVictory.logic.ts` + test, `moves/operatorSetters.logic.ts` + `moves/operatorSetters.test.ts`, `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` + `uiState.filter.test.ts` — **modified**
- Client: `components/play/CityRow.vue` + test, `pages/PlayDesktop.vue`, `pages/PlayMobile.vue`, `components/play/PendingSeatChoicePrompt.vue` + test — **modified**
- Scripts: `apply-effect-markers.mjs`, `inputs/villain-effect-markers.json`, `apply-defeat-requirement-markers.mjs`, `inputs/villain-defeat-requirements.json`, `scripts/coverage/mechanic-provenance.json` — **modified**
- `data/cards/ca75.json`, `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json` — **regenerated**
- Governance close: `DECISIONS.md`, `ARCHITECTURE.md` + `.claude/rules/architecture.md` (one Move Validation Contract sentence each, exact text in WP §Files Expected to Change), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## After Completing
- [ ] T1-T33 pass (T27 in `ai.seatChoice.test.ts`; T25 seeds `isHqKoResolved: true`). `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail. `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
- [ ] Markers: 2 `[effect:]` + 1 `[discard-to-fight:]`, `ca75.json` only, 3 lines; both re-runs 0. Hand-checked script rejections recorded in the commit body.
- [ ] `pnpm ledger:villains && pnpm effect-index` after a rebuild; Zolandia + Primus rows `executable` with WP-817 provenance; the six feed checks → 0.
- [ ] Five revert proofs observed (step-1 gate; bot branch; opener order; play-area-only count; `fightDiscardCosts` dropped from `deepCopyCitySpaces`).
- [ ] Hash oracles unchanged. Allowlist-only diff. Two-commit topology `EC-855:` then `SPEC:`.
- [ ] D-24750 Active; STATUS (+ the Blob / Venom client Fight-gate follow-up); WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check` → 0.
- [ ] Live-verify (D-24026) post-deploy STATUS flip, incl. `fightDiscardCosts` on the Primus City card and `handCosts` on the viewer's own player entry only in the diagnostics snapshot.

## Common Failure Smells
- Bot-ally faults on a Primus turn → `getLegalMoves` offered `{ cityIndex }` without `discardCardId`, or picked a card the gate refuses.
- Primus fights with no discard in a live match → the requirement-map row was not applied (`[discard-to-fight:]` missing from `ca75.json`) or the setup builder is not wired in `buildInitialGameState`.
- Primus's Fight button stays enabled with an empty hand → `fightDiscardCosts` dropped by `deepCopyCitySpaces`.
- Primus's Fight is disabled for a player holding only an Officer / Sidekick → eligibility read `display.cost` instead of `handCosts`.
- The Primus discard prompt appears before the Bystander discard → the effect opener ran before the escape-procedure loop drained.
- A sentinel hash moved → a new `G` key is written for matches without Primus.
