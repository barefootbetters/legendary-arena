# EC-730 — Loki tactics: free City-Villain defeat + KO-from-discard (Execution Checklist)

**Source:** docs/ai/work-packets/WP-693-mastermind-tactic-free-defeat-and-ko-core.md
**Layer:** Game Engine + Arena Client
**Status:** Pending

## Before Starting
- [ ] WP-497 (tactic-onFight framework / D-24300) on `main`: `dispatchTacticOnFight(G, ctx, id, shuffle)` fires as the final step of `defeatMastermindTacticCore`. If absent, STOP.
- [ ] WP-486 / D-24291 (defeat-choice family) + WP-682 / D-24499 (`pure-fury` second discriminant) on `main` — read `resolveDefeatChoice`, `buildDefeatWithBystanderTargets`, `dispatchDefeatWithBystanderTarget`, `defeatCityVillainCore` FIRST; Cruel Ruler reuses them.
- [ ] **Baseline assertion:** confirm both tactic slugs against the built ext_ids — `core-mastermind-loki-cruel-ruler`, `core-mastermind-loki-maniacal-tyrant` (`data/cards/core.json`; grammar `${setAbbr}-mastermind-${slug}-${tacticSlug}`).
- [ ] **Baseline assertion:** the shipped free defeat (`buildDefeatWithBystanderTargets` / `defeatCityVillainCore`) does NOT check `isGuardBlocking` — Cruel Ruler must match (no Guard filter).
- [ ] **Baseline assertion:** confirm NO existing pending pattern is a 0..N-cap OPTIONAL multi-select (`resolvePutCardsOnDeckChoice` / `resolveReorderChoice` enforce EXACT count). If one has landed, reuse it instead of adding a new family.
- [ ] `pnpm -r build` 0; engine + arena-client suites green (record pass counts).

## Locked Values (do not re-derive)
- [ ] `LOKI_CRUEL_RULER_TACTIC_ID = 'core-mastermind-loki-cruel-ruler'`; `LOKI_MANIACAL_TYRANT_TACTIC_ID = 'core-mastermind-loki-maniacal-tyrant'` (named consts in `tacticHandlers.ts`).
- [ ] Cruel Ruler cardinality: 0 City Villains → no-op; 1 → auto-defeat via `dispatchDefeatWithBystanderTarget`; ≥2 → park `PendingDefeatChoice` `{ choiceType: 'cruel-ruler' }`.
- [ ] New discriminant value = `'cruel-ruler'` (added to `PendingDefeatChoice.choiceType` AND the `UIPendingDefeatChoice` union AND accepted in the `resolveDefeatChoice` front guard — the WP-682 add-a-discriminant move).
- [ ] `MANIACAL_TYRANT_KO_MAX = 4`; KO source = the active player's own `G.playerZones[pid].discard`; destination = global `G.ko` via `koCard` (remove from discard FIRST); 0 selected is legal.
- [ ] New pending: `G.pendingKoDiscardChoices?` of `PendingKoDiscardChoice { choiceType: 'ko-from-discard', playerID, maxCount }`; move `resolveKoDiscardChoice({ cardIds })`, `client:false`.

## Guardrails
- [ ] Moves never throw; unhandled tactic id stays a silent no-op; every invalid resolve payload is a silent no-op with the queue intact.
- [ ] Both choices are ACTIVE-scoped (`ctx.currentPlayer`); Maniacal Tyrant KOs ONLY the active player's own discard.
- [ ] Cruel Ruler defeat routes through the shared free-defeat core (no attack spent, no acted-this-turn flag, Bystanders + captured Heroes + `onFight` fire) — never a bespoke defeat.
- [ ] `buildCityVillainDefeatTargets` iterates City spaces ascending (a stable contract), villain-only, no Mastermind, no Guard filter; `kind: 'villain'`.
- [ ] `resolveKoDiscardChoice`: reject over-cap / duplicate / absent-id / wrong-player / empty-queue; recompute eligibility fresh (no snapshot); front-pop LAST.
- [ ] Block-all guard `hasPendingKoDiscardChoice(G)` at EVERY action-move site (fight/recruit/play/heal/end-turn — mirror the `hasPendingDefeatChoice` guard placements); `getLegalMoves` enumerate + short-circuit.
- [ ] New move in `SIMULATION_MOVE_NAMES` + BOTH sim `MOVE_MAP`s (runner + aggregator) or the sim hangs; `game.test.ts` move-registration drift updated.
- [ ] UIState FIVE-STEP for `pendingKoDiscardChoice` (types → build → filter owner-scoped pass-through → audience-filter test → diagnostics snapshot); a build-but-not-filter field freezes the client.
- [ ] Determinism: `ctx.random.*` only via the reused core's `ShuffleProvider`; no `Math.random`/wall-clock/I/O; no `.reduce()`; no `boardgame.io`/registry import in `tacticHandlers.ts`.
- [ ] No card data edited; no marker authored. `tactic-provenance.json` rows only.

## Required `// why:` Comments
- [ ] `LOKI_*_TACTIC_ID` consts cite WP-693 / D-24510 + the printed Fight text.
- [ ] `'cruel-ruler'` discriminant + `buildCityVillainDefeatTargets` cite reuse of the WP-486/682 family and the Guard-bypass rationale.
- [ ] `MANIACAL_TYRANT_KO_MAX = 4` cites the printed "up to four"; the remove-before-`koCard` order cites `koCard`'s destination-only contract; the no-return-on-discard note cites discard→KO (not hand→discard).
- [ ] Each `hasPendingKoDiscardChoice` guard site cites WP-693 / D-24510 block-all.
- [ ] The re-pin check comment: both hash oracles stay byte-identical (no committed Loki-tactic fixture) — STOP on drift.

## Files to Produce
- [ ] `rules/tacticHandlers.ts` — `resolveCruelRuler`, `resolveManiacalTyrant`, consts, two dispatch branches
- [ ] `moves/defeatChoice.resolve.ts` — `buildCityVillainDefeatTargets` + accept `'cruel-ruler'`
- [ ] `moves/koDiscardChoice.resolve.ts` (new) — `resolveKoDiscardChoice`, `getEligibleKoDiscardCards`, `hasPendingKoDiscardChoice`
- [ ] `types.ts` — `+ 'cruel-ruler'`; `+ PendingKoDiscardChoice` + `G.pendingKoDiscardChoices?`
- [ ] `game.ts` — register `resolveKoDiscardChoice`; `getLegalMoves` enumerate + short-circuit
- [ ] action-move files — `hasPendingKoDiscardChoice(G)` block-all guard at each site
- [ ] `ui/uiState.types.ts` / `.build.ts` / `.filter.ts` — `pendingKoDiscardChoice` five-step + `'cruel-ruler'` union case
- [ ] sim dispatch — `SIMULATION_MOVE_NAMES` + both `MOVE_MAP`s `+ resolveKoDiscardChoice`
- [ ] `apps/arena-client/.../PendingDefeatChoicePrompt.vue` — `'cruel-ruler'` heading branch
- [ ] `apps/arena-client/.../PendingKoDiscardChoicePrompt.vue` (+ test) — new multi-select prompt
- [ ] `apps/arena-client/.../useTurnActions.ts`, `TurnActionBar.vue`, `PlayDesktop.vue`, `PlayMobile.vue` — wire the new prompt
- [ ] `scripts/coverage/tactic-provenance.json` — both Loki tactics `executable`
- [ ] tests: Cruel Ruler 0/1/≥2 + free-defeat rewards + reject-non-snapshot; Maniacal Tyrant park/no-op + KO 0/3/4/over-cap/dup/absent + wrong-player/empty-queue; audience-filter test; `game.test.ts` drift
- [ ] Governance: `DECISIONS.md` (D-24510 Drafted→Active), `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md` + `roadmap:counts:write`, `STATUS.md`

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` 0; `pnpm -r build` 0
- [ ] engine + arena-client suites green (record delta); control-stub run proves non-vacuous
- [ ] sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical, no regeneration; a sim run does NOT hang
- [ ] `effect-index:check` current; tactic-provenance rows present; `sim:runtime-observed:check` current after regen
- [ ] D-24510 Active; `WORK_INDEX` `[x]` + `EC_INDEX` flipped; mindmap `📝`→`✅`; `roadmap:counts:check` 0; `STATUS.md` close-out; PR squash-merged
- [ ] D-24026 live-verify performed or operator-pending

## Common Failure Smells
- Cruel Ruler spends attack or sets acted-this-turn → not routed through the shared free-defeat core.
- Cruel Ruler lists Bystander-holders only, or offers the Mastermind, or filters by Guard → wrong target builder.
- `resolveDefeatChoice` rejects `'cruel-ruler'` → the front-entry `choiceType` guard was not extended.
- Maniacal Tyrant KOs >4, or an empty selection is rejected, or a card is appended to `G.ko` before leaving discard → cap/optional/remove-order wrong.
- Client freezes on either prompt → UIState field built but not passed through the audience filter, or the renderer not wired into the cascade.
- Sim hangs → new move missing from a sim `MOVE_MAP` / `SIMULATION_MOVE_NAMES`.
- A determinism gate regenerates → a fixture reached a Loki tactic (none committed does); investigate, never blind-re-pin.
