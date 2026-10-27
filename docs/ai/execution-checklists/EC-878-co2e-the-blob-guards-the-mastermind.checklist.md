# EC-878 — co2e The Blob guards the Mastermind (Execution Checklist)

**Source:** docs/ai/work-packets/WP-840-co2e-the-blob-guards-the-mastermind.md
**Layer:** Game Engine (+ Arena Client consumer, card-data marker, derived feeds)

## Before Starting
- [ ] WP-831 (#3001) merged (WP-829 #2995 = `461ed924` and WP-830 #2998 = `e580d801` already on `main`). `fightVillain` has the `cityIndex >= G.city.length` guard and the `UNNAMED_CITY_SPACE_TARGET` fallback; `fightMastermind` has the Enigma gate; `MastermindTile.vue` has the Enigma picker.
- [ ] Record `VILLAIN_EFFECT_PRIMITIVES.length` (31 at draft; higher if WP-835..839 landed) and every marker-map row already under `villains.co2e.brotherhood-of-mutants`.
- [ ] `defeatCityVillainCore` still nulls the space, then its body = route → awards (incl. any WP-838 Step 3c branch) → rescue → onFight → log → `fightResolved` → Endless Armies (+ any WP-839 Boomerang block). Carry any WP-838 / WP-839 block verbatim into `defeatVillainCardCore`. Its callers are `fightVillain`, `defeatChoice.resolve.ts` (Silent Sniper, Pure Fury and Cruel Ruler route through it) and two direct test calls (`fightVillain.test.ts` ~L553 / ~L582).
- [ ] WP-831 head `0585f811` at drafting (rebased onto `e580d801`; tree-identical to `a6e8dfa5` / `9e710dfb`; anchors code-identical to `dfc118c8`); only #3001 remains to merge; if WP-832 (#3004) merged first, re-read the `villainDeck.reveal.ts` / `notableEvents.types.ts` anchors. If WP-759 landed, keep its MastermindTile lock beside this one.
- [ ] `fightMastermind` still returns on `isMastermindHaunting(G)` before the cost check; `getLegalMoves` step 4 still mirrors it.
- [ ] `packages/game-engine/src/test/**` and `data/par/**` still have no `brotherhood-of-mutants` reference (WP Assumes 14).
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; record the engine and arena-client test totals.

## Locked Values (do not re-derive)
- `G.villainsBesideMastermind?: CardExtId[]` — arrival order, lazy, deleted when empty, never `[]`.
- `board/besideMastermind.logic.ts`: `hasVillainBesideMastermind(G)`, `getVillainBesideMastermind(G, besideIndex)` (integer in range else null), `putVillainBesideMastermind(G, cardId)` (false if listed), `takeVillainBesideMastermind(G, besideIndex)` (deletes the field when it empties).
- Primitive `'put-self-beside-mastermind'`, no params, appended last to the union, the engine array and the script copy. Pins in `villainAbility.types.test.ts`: L393-397 length +1, L398-402 last entry re-pointed to `put-self-beside-mastermind` and its position, L403-405 ordered list appended, L619 / L652 length +1 (re-read positions if WP-835..839 landed); intended product change, stated in the commit body.
- Handler `villainEffectPutSelfBesideMastermind`: not in City → `` `${label} effect: ${name} is not in the City; it stays where it is.` `` `'blocked'`; put refused → `` `${label} effect: ${name} is already beside the Mastermind.` `` `'blocked'`; else null the space, `` `${label} effect: ${name} moves to the left of the Mastermind. Nothing moves him there, and the Mastermind can't be fought while he is there.` `` `'threat'`. Always `{ targets: [] }`.
- `BESIDE_MASTERMIND_TARGET = 'beside-mastermind'` in `AttackTargetName`; label `'beside the Mastermind'`.
- `FightVillainArgs.cityIndex?: number`, `besideMastermindIndex?: number`. Beside branch: `cityIndex` also given → return; `getVillainBesideMastermind` null → return; target `BESIDE_MASTERMIND_TARGET`; no Guard. City branch unchanged. Every later gate shared.
- Step 3 beside: `takeVillainBesideMastermind(G, besideMastermindIndex)`, then `defeatVillainCardCore(G, ctx, cardId, { kind: 'beside-mastermind' }, { random }, { payRescueOnFight })` with the step-1 `cardId`. `FightLocation = { kind: 'city'; cityIndex } | { kind: 'beside-mastermind' }`. `defeatCityVillainCore` signature and output unchanged.
- Beside fight: onFight `cityIndex` undefined; line `` `Player ${currentPlayer} fought ${formatCardRef(G.cardDisplayData, cardId)} beside the Mastermind.` ``; `fightResolved.citySpace = OFF_CITY_FIGHT_SPACE` (`-1`).
- `fightMastermind`: `if (hasVillainBesideMastermind(G)) { return; }` right after the haunting return.
- `getLegalMoves`: step 3b after the City loop, `besideIndex` ascending, same requirement / discard / cost checks with `BESIDE_MASTERMIND_TARGET`, args `{ besideMastermindIndex }` (+ `discardCardId`); step 4 adds `&& !hasVillainBesideMastermind(gameState)`.
- Invariant: `scanZone(G.villainsBesideMastermind ?? [], 'villainsBesideMastermind', firstSeenZone)`.
- `FightResolvedEvent.citySpace` JSDoc: `City space the defeated card occupied, or -1 for a Villain fought outside the City (WP-840, beside the Mastermind).`
- UIState: `UIMastermindState.villainsBeside?: UICityCard[]`; build via the extracted `buildCityCardProjection(gameState, ctx, cardId)`; filter via the extracted `deepCopyCityCard(card)`; both conditional spreads, every audience.
- Client: `BesideMastermindVillains.vue` (props `villains`, `currentStage`, `isViewerTurn`, `hasHealedThisTurn`, `economy`, `submitMove`; testids `play-beside-mastermind`, `play-beside-mastermind-villain` + `data-beside-index`; label `Left of the Mastermind`); gate `canFightVillain` → `healLockGate` → `canFight(fightCost, 'beside-mastermind')`; payload `fightVillain { besideMastermindIndex: index }`. First child of the Mastermind zone / band on both pages.
- `MastermindTile` `gateForFight` order: stage → heal → cost → the existing vanquished check (unchanged) → beside lock `` `You can't fight the Mastermind while ${name} is beside it — fight ${name} first` `` → allowed. A vanquished Mastermind keeps its vanquished reason (T24 case).
- Data: `villains.co2e.brotherhood-of-mutants.the-blob.ambush = ["put-self-beside-mastermind"]`; provenance → WP-840 / D-24773.

## Guardrails
- Byte-identical without a Blob Ambush: no new `G` key, intent arg, log line or event change; hash oracles unchanged (STOP if one moves).
- The `fightMastermind` gate and the bot mirror land in the same commit (D-24364).
- No City code changes: no mover, push, escape, Guard or City-space helper edit.
- One predicate (`hasVillainBesideMastermind`); the client reads only the projected `villainsBeside`.
- Free defeats unchanged (Operator fork 1 default) unless Jeff chose the alternative. Pure Fury cannot target a Villain beside the Mastermind (its builder iterates `G.city`): a named residual, not fixed here.
- Do not edit `src/fixtures/uiState/mid-turn.json` or page CSS; the board check injects `villainsBeside` at runtime.
- No parser reads English; marker only; never run `convert-cards-v15.mjs`.
- Client submits intent only; no engine-internal import.

## Required `// why:` Comments
- The handler: Ambush moves him out of the City after entry, so no City mover reaches him (D-24587 shape, D-24773).
- The `fightMastermind` gate and the step-4 bot condition: "you can't fight the Mastermind" while he is there; one predicate (D-24364).
- The beside branch in step 1: a second location for the same fight, so every rider applies; `cityIndex` and `besideMastermindIndex` together are ambiguous.
- `BESIDE_MASTERMIND_TARGET`: no restricted grant names it, so plain Attack only.
- `OFF_CITY_FIGHT_SPACE`: keeps the `fightResolved` shape; `useVillainSlashVfx.ts` forwards it and `VfxOverlay.vue` finds no City cell (slice hint `take(-1)` finds nothing).
- `defeatVillainCardCore`: the shared defeat half, so a beside fight never drifts from a City fight.
- The step-3 take: nothing between step 1 and step 3 writes the list, so the step-1 read still holds.
- Doc touch-ups (same files): the `fightVillain` header + JSDoc name the second location; the `getLegalMoves` order JSDoc gains "3b. fightVillain beside the Mastermind".
- `villainsBeside` in the filter: must pass through or the whitelist drops it (EC-206 / #1165).
- The array append note in the engine array AND the script copy.

## Files to Produce
- Engine **new**: `board/besideMastermind.logic.ts` + test.
- Engine **modified**: `types.ts`; `rules/villainAbility.types.ts` + test; `setup/villainAbility.setup.ts` (doc list) + test; `villain/villainEffects.execute.ts` + test; `economy/economy.types.ts`, `economy/economy.logic.ts`; `moves/fightVillain.ts` + test; `moves/fightMastermind.ts` + test; `simulation/ai.legalMoves.ts` + test; `invariants/gameRules.checks.ts` + `invariants/invariants.test.ts`; `events/notableEvents.types.ts`; `villainDeck/villainDeck.reveal.test.ts`; `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` + `ui/uiState.filter.test.ts`.
- Client: `components/play/BesideMastermindVillains.vue` + test (**new**); `components/play/MastermindTile.vue` + test, `pages/PlayDesktop.vue`, `pages/PlayMobile.vue` (**modified**).
- Scripts: `apply-effect-markers.mjs`, `inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json` (**modified**).
- **Regenerated**: `data/cards/co2e.json`, `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`; `data/metadata/card-mechanics.json` only if its check flags.
- Governance close: `DECISIONS.md` (D-24773), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-840-co2e-the-blob-guards-the-mastermind.md` (**new**, mandatory 01.6).

## After Completing
- [ ] T1-T24 pass. `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail. `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
- [ ] Marker: 1 `[effect:]` on the Blob line, `co2e.json` only; re-run 0. The hand-checked `put-self-beside-mastermind:1` rejection is recorded in the commit body.
- [ ] `pnpm ledger:villains && pnpm effect-index` after a rebuild; the Blob row `executable` with WP-840 provenance; the seven feed checks → 0.
- [ ] Seven revert proofs observed (WP Verification 8); the 1280x720 board check observed (AC 7), and `PlayMobile` at 375x812 has no horizontal overflow (the component root wraps).
- [ ] Hash oracles unchanged. Allowlist-only diff. Commits `EC-878:` then `SPEC:` (or `EC-878:` engine, `EC-878:` client, `SPEC:`).
- [ ] D-24773 Active (incl. the D-24587 free-defeat contrast and the three extracted helpers); 01.6 post-mortem written; STATUS (+ Energy Shield, Pure Fury beside-target gap, the "no Ambush effect" overlay class, beside EV / rescue controls, slice VFX, the stale `useVillainSlashVfx.ts` `citySpace` "0..4" JSDoc); WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0.
- [ ] Live-verify (D-24026) post-deploy, incl. `mastermind.villainsBeside` in the diagnostics snapshot; operator-pending until seen.

## Common Failure Smells
- Bot-ally faults with attack left and The Blob beside → `getLegalMoves` still offers `fightMastermind`, or offers a beside fight the move refuses (target or cost mismatch).
- The Blob still visible in the City after his Ambush → the handler did not null the space (the invariant reports a duplicate).
- The Blob beside but the Mastermind button enabled → `villainsBeside` dropped by the filter, or MastermindTile not reading it.
- A City fight's log or `fightResolved` changed → the core split altered the City path.
- A restricted Sewers / Mastermind grant pays for The Blob → the beside branch used a City or `'mastermind'` target.
- A sentinel hash moved → a key was written in a match without a Blob Ambush.
