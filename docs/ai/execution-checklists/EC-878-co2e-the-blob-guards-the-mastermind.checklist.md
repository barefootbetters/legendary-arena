# EC-878 — co2e The Blob guards the Mastermind (Execution Checklist)

**Source:** docs/ai/work-packets/WP-840-co2e-the-blob-guards-the-mastermind.md
**Layer:** Game Engine (+ Arena Client consumer, card-data marker, derived feeds)
**Risk Tier:** MEDIUM
**Reconciled 2026-11-15** on `main` `a752fc130`: Operator fork 3 = reuse WP-873 Fortify (Jeff). The 2026-10-25 parallel-path values (`defeatVillainCardCore`, `BESIDE_MASTERMIND_TARGET`, `citySpace -1`, `villainsBeside`, `BesideMastermindVillains.vue`) are superseded. Operator forks 1 (free defeats unchanged) and 2 (Energy Shield out of scope) are locked to their defaults at pre-flight.

## Before Starting
- [ ] `main` contains WP-873 (Fortify), WP-839 (#3410) and WP-897 (D-24854). `moves/fortifyFight.ts` has `fightFortifyingVillain` / `defeatFortifyingVillainCore`; `findFightableFortifier` is in `moves/villainDefeatRequirement.logic.ts`; `fightVillain` has the `fortifiedPlace` branch before step 1.
- [ ] `VILLAIN_EFFECT_PRIMITIVES.length` is 63, last `enter-city-from-victory-pile`; the RS-5 set in `villain/ambushNarrative.keywordless.test.ts` has 20 entries.
- [ ] `fightMastermind` and `getLegalMoves` step 4 read `isMastermindFortified`; `MastermindTile.vue` locks on `mastermind.fortifiedReason`; `FortifiedVillains.vue` keys chips by `place`.
- [ ] `packages/game-engine/src/test/**` and `data/par/**` have no `brotherhood-of-mutants` reference (WP Assumes 8).
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; record every package's totals (baseline: game-engine 7233, arena-client 2724).

## Locked Values (do not re-derive)
- `G.villainsBesideMastermind?: CardExtId[]` — arrival order, lazy, deleted when empty, never `[]`.
- `board/besideMastermind.logic.ts`: `listVillainsBesideMastermind`, `getVillainBesideMastermind(G, besideIndex: unknown)` (integer in range else null), `putVillainBesideMastermind` (false if listed), `takeVillainBesideMastermind` (deletes the field when it empties), `isMastermindGuarded` (= `isMastermindFortified || list non-empty`), `buildBesideMastermindBlockReason` → `` `${name} is to the left of the Mastermind. Fight ${name} first.` `` for the first listed Villain, null when empty.
- Primitive `'put-self-beside-mastermind'`, no params, position 64 in the union, the engine array and the script copy. Pins: L390 title + L458-464 → 64 / `put-self-beside-mastermind`; ordered list appended; every `length, 63` → 64 with its `// why:`; WP-839 `slice(60)` → `slice(60, 63)`; parity Record gains it. Intended product change, in the commit body.
- Handler `villainEffectPutSelfBesideMastermind`, each branch logs `` `${label} effect: ${clause}.` `` and returns `{ targets: [], narrativeClause: clause }`: not in City → `` `${name} is not in the City; it stays where it is` `` `'blocked'`; put refused → `` `${name} is already to the left of the Mastermind` `` `'blocked'`; else null the space, `` `${name} moves to the left of the Mastermind; nothing can move him, and the Mastermind can't be fought while he is there` `` `'threat'`. RS-5 set 20 → 21.
- `findFightableOffCityVillain(state, playerId, cardId)` = `findFightableFortifier`'s price / requirement / restriction / discard checks moved verbatim; `findFightableFortifier` delegates; `findFightableVillainBesideMastermind(state, playerId, besideMastermindIndex: unknown)` = get → delegate. Return type `FightableFortifier`.
- `fortifyFight.ts`: `OffCityFightLocation = { kind: 'fortified'; place } | { kind: 'beside-mastermind'; besideIndex }`; `fightOffCityVillain` = today's post-authority body verbatim, its four turn-state refusals moved into `isOffCityFightBlocked(G, currentPlayer)`, defeat via a `never`-default switch; `awardOffCityVillain(G, ctx, zones, cardId, foughtLine, shuffleContext)` = recorder → Victory Pile → log → onFight(undefined) verbatim; new exported `fightVillainBesideMastermind` and `defeatVillainBesideMastermindCore`; Blob line `` `Player ${currentPlayer} fought ${formatCardRef(G.cardDisplayData, cardId)} to the left of the Mastermind.` `` Fortify signatures and output unchanged.
- `FightVillainArgs.besideMastermindIndex?: number`; branch directly after the `fortifiedPlace` branch (fortifiedPlace wins).
- `fightMastermind` and `getLegalMoves` step 4: `isMastermindFortified` → `isMastermindGuarded`. Step 3b: after the fortifier loop, `{ besideMastermindIndex: besideIndex }` per `findFightableVillainBesideMastermind` hit, ascending.
- Invariant: each listed id visited as `` `villainsBesideMastermind.${index}` ``.
- UIState: `UIFortifier.besideMastermindIndex?: number`; `buildFortifyProjection` calls module-local `appendBesideMastermindFortifiers(gameState, activePlayerId, fortifiers)` (one entry per listed Villain: `place: 'mastermind'`, `FORTIFY_PLACE_LABELS.mastermind`, `FORTIFY_LOCK_TEXT['no-fight']`, price / restriction as a fortifier, the index), then `mastermindFortifiedReason ??= buildBesideMastermindBlockReason`; `fortifiedReason` present exactly when `isMastermindGuarded`; `deepCopyFortifiers` conditional-spreads the index. Comment / JSDoc updates: the `fortifiedReason` spread comment, `UIFortifier.place`, the `UICityState.fortifiers` order, `UIMastermindState.fortifiedReason`.
- Client `FortifiedVillains.vue`: index entry submits `fightVillain { besideMastermindIndex }`; title `` `${name} is to the left of ${placeLabel}: ${lockText}.` ``; sr-only `To the left of …`; `fortifierKey` = `place` or `` `${place}-beside-${index}` ``; list `aria-label` `Villains guarding this place`. Gate unchanged. `MastermindTile.vue`, `SharedDecks.vue`, pages unchanged.
- `board/fortify.logic.ts`: comments only (header L11, the `isMastermindFortified` `// why:` L74-75 name `isMastermindGuarded`). `wiki/card-effect-system.md` L177 → "sixty-four entries as of WP-840".
- Data: `villains.co2e.brotherhood-of-mutants.the-blob.ambush = ["put-self-beside-mastermind"]`; provenance → WP-840 / D-24773; `live-verify.json` gains a `pending` row `co2e-villain-brotherhood-of-mutants-the-blob|put-self-beside-mastermind`.

## Guardrails
- Byte-identical without a Blob Ambush, Fortify matches included: no new `G` key, intent arg, log line, projection key or event; hash oracles unchanged (STOP if one moves). Every existing Fortify test passes unedited.
- The `fightMastermind` change and the bot mirrors land in the same commit (D-24364).
- No City code changes: no mover, push, escape, Guard, City fight or City-space helper edit.
- One predicate (`isMastermindGuarded`); one fightability authority (`findFightableOffCityVillain`); the client reads only projected fields.
- Free defeats unchanged (Operator fork 1 default). Pure Fury cannot target a Villain to the left of the Mastermind: a named residual.
- Do not edit `src/fixtures/uiState/mid-turn.json` or page CSS; the board check injects the projection at runtime.
- No parser reads English; marker only; never run `convert-cards-v15.mjs`.
- Client submits intent only; no engine-internal import.

## Required `// why:` Comments
- The handler: the Ambush moves him out of the City after entry, so no City mover reaches him (D-24587 shape, D-24773); the narrative clause is the logged clause (D-24854).
- `isMastermindGuarded` at `fightMastermind` and step 4: "you can't fight the Mastermind" while a fortifier or The Blob is there; one predicate (D-24364).
- The `besideMastermindIndex` branch: a second off-City location for the same fight, after `fortifiedPlace` so every existing input is byte-identical.
- `findFightableOffCityVillain`: one authority for both off-City fights (the extraction keeps Fortify byte-identical).
- `fightOffCityVillain` / `awardOffCityVillain`: shared so a Blob fight never drifts from a fortifier fight.
- The step-3b beside loop: mirrors `fightVillain({ besideMastermindIndex })`; byte-identical without the list.
- `besideMastermindIndex` in the filter: must pass through or the whitelist drops it (EC-206 / #1165).
- The chip key: two Blobs and a fortifier share `place`.
- The array append note in the engine array AND the script copy.

## Files to Produce
- Engine **new**: `board/besideMastermind.logic.ts` + test.
- Engine **modified**: `types.ts`; `rules/villainAbility.types.ts` + test; `setup/villainAbility.setup.ts` (doc list) + test; `villain/villainEffects.execute.ts` + test; `villain/ambushNarrative.keywordless.test.ts` (T8); `moves/villainDefeatRequirement.logic.ts` + test; `moves/fortifyFight.ts` + test (incl. T15 via `fightVillain`); `moves/fightVillain.ts`; `moves/fightMastermind.ts` + test; `simulation/ai.legalMoves.ts` + test; `invariants/gameRules.checks.ts` + `invariants/invariants.test.ts`; `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` + `ui/uiState.filter.test.ts`; `board/fortify.logic.ts` (comments only).
- Client **modified**: `components/play/FortifiedVillains.vue` + test.
- Scripts **modified**: `apply-effect-markers.mjs`, `inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json`. Docs **modified**: `docs/ai/coverage/live-verify.json` (one row), `wiki/card-effect-system.md` (count).
- **Regenerated**: `data/cards/co2e.json`, `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json` (`pnpm spike:local-bundle`); `data/metadata/card-mechanics.json` / wiki-viewer projection only if their checks flag.
- Governance close: `DECISIONS.md` (D-24773), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md` if needed, `docs/ai/post-mortems/01.6-WP-840-co2e-the-blob-guards-the-mastermind.md` (**new**, mandatory 01.6).

## After Completing
- [ ] T1-T22 pass. `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail (every package's totals pasted). `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
- [ ] Marker: 1 `[effect:]` on the Blob line, `co2e.json` only; re-run 0. The hand-checked `put-self-beside-mastermind:1` rejection is recorded in the commit body.
- [ ] `pnpm ledger:villains && pnpm effect-index && pnpm spike:local-bundle` after a rebuild; the Blob row `executable` with WP-840 provenance; `cards:check`, `cards:count-markers:check`, `effect-index:check`, `ledger:villains:check`, `mechanics:metadata:check`, `gauntlet:loadouts:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `node scripts/build-local-spike-bundle.mjs --check`, `wiki-viewer:check-links` (after `wiki-viewer:project`) → 0.
- [ ] Seven revert proofs observed (WP Verification 8); the 1280x720 board check and the 375x812 overflow check observed (AC 7).
- [ ] Hash oracles (`finalStateHash`, `PRE_WP080_HASH`, the local-spike `initialStateHash`) unchanged. Allowlist-only diff. Commits `EC-878:` then `SPEC:`.
- [ ] D-24773 Active (incl. Operator fork 3 = reuse, decided by Jeff; the off-City helpers as a recorded 00.6 Rule 1 exception; the stale-client residual); 01.6 post-mortem written; STATUS (+ Energy Shield, Pure Fury beside-target gap, the shared off-City residuals, the `MastermindTile.vue` L230-233 comment drift); WORK_INDEX `[x]` + `[live-verify: pending]`; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check`, `workindex:liveverify:check` → 0.
- [ ] Live-verify (D-24026) post-deploy via `/api/match/autoplay` setupData, incl. the Blob `city.fortifiers` entry and `mastermind.fortifiedReason` in the `uiStateSnapshot`; then a `SPEC:` PR flips the token to `[live-verify: verified]`.

## Common Failure Smells
- A local-spike `--check` failure after the marker pass → the bundle was not regenerated.
- Bot-ally faults with attack left and The Blob beside → step 4 still reads `isMastermindFortified`, or step 3b offers a beside fight the move refuses (the wrappers diverged from the one authority).
- The Blob still visible in the City after his Ambush → the handler did not null the space (the invariant reports a duplicate).
- The Blob beside but the Mastermind button enabled → `mastermindFortifiedReason` not set from the list, or the filter dropped it.
- Only one Blob chip shows with two listed → the chip key still uses `place` alone.
- A Colleen Wing fight log or projection changed → an extraction altered the Fortify path.
- A restricted Sewers / Mastermind grant pays for The Blob → the off-City price used a named target.
- A sentinel hash moved → a key was written in a match without a Blob Ambush.
