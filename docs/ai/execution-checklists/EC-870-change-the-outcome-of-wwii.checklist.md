# EC-870 — Change the Outcome of WWII (Execution Checklist)

**Source:** docs/ai/work-packets/WP-832-change-the-outcome-of-wwii.md
**Layer:** Game Engine (scheme resolver + WWII module, loss evaluator + meter kind, the settle at the escape path in `villainDeck.reveal.ts`) plus one arena-client meter label

## Before Starting
- [ ] WP-831 (#3001) is merged: `CityZone` is a 1-6 space array and `initializeCity(size)` exists. If not, STOP.
- [ ] `ca75/change-the-outcome-of-wwii` has no `SCHEME_TWIST_CONFIGS` entry; the registry-size pin is `8 + 67 + 2`.
- [ ] `SchemeResourceLossCondition` has no `scheme-counter` kind; `SchemeLossKind` has no `conquered-capitals`.
- [ ] The drafting scaffold patch is evidence only; re-author from Locked Values and the Test Contract.
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] Rebuild first. `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; record the engine and client totals.

## Locked Values (do not re-derive)
- **Constants** (`rules/changeTheOutcomeOfWwii.constants.ts`, a leaf module the config table imports without a load-time cycle): `WWII_COUNTRIES_INVADED = 'wwiiCountriesInvaded'`, `WWII_CONQUERED_CAPITALS = 'wwiiConqueredCapitals'`, `WWII_ESCAPES_AT_INVASION = 'wwiiEscapesAtInvasion'`, `WWII_COUNTRY_CONQUERED = 'wwiiCountryConquered'`, `WWII_CAPITALS_TO_WIN = 3`.
- **Countries** (`rules/changeTheOutcomeOfWwii.logic.ts`): `WWII_COUNTRIES` = Poland 4, France 3, USSR 6, England 3, USA 5, Australia 2, Switzerland 1, in Twist order.
- **`invadeNextCountry(G, context, implementationMap)`**: with 7 countries already invaded, log (`'neutral'`) `[Change the Outcome of WWII] The Axis has no country left to invade; nothing changes.` and stop. Otherwise: `settleWwiiConquest(G)`; raise `WWII_COUNTRIES_INVADED`; return the City (each Villain from index 0 up, then its `attachedBystanders`, to the END of `G.villainDeck.deck`, typing an untyped Bystander `'bystander'` in `villainDeckCardTypes`, deleting the attachment); `G.city = initializeCity(country.citySpaces)`; `WWII_ESCAPES_AT_INVASION` = the escaped Villain count; `WWII_COUNTRY_CONQUERED = 0`; log (`'threat'`) `[Change the Outcome of WWII] Twist ${n}: the Axis invades ${name}. ${k} card${s} from the City go${es} to the bottom of the Villain Deck; the City now has ${spaces} space${s}. 2 cards are played.`; `playTopVillainDeckCards(G, context, implementationMap, 2)`; `settleWwiiConquest(G)`.
- **`settleWwiiConquest(G)`** (called at the end of `resolveVillainEscape`, right after `applyEscapedPileResourceLoss(G)`; inside `invadeNextCountry` before the invasion and after the plays): no-op before Twist 1 or once the current country is conquered; otherwise, when the escaped Villain count (`countEscapedPileByType(G, ['villain', 'henchman'])`) exceeds `WWII_ESCAPES_AT_INVASION`: set `WWII_COUNTRY_CONQUERED = 1`, raise `WWII_CONQUERED_CAPITALS`, log (`'threat'`) `[Change the Outcome of WWII] A Villain escaped ${name}: its capital is conquered (${capitals} of 3).`, then `applySchemeCounterResourceLoss(G)`.
- **Resolver id** `'change-the-outcome-of-wwii'` before `'counter-only'`, registered as `changeTheOutcomeOfWwii`, which calls `invadeNextCountry` and pushes the `schemeTwistResolved` notable event with `resolverKey: 'changeTheOutcomeOfWwii'` (phrase `'the Axis invaded a new country and the City changed size'`; the key appended to the union, the canonical array, both drift lists, ten → eleven).
- **Config**: `{ schemeId, resolverId: 'change-the-outcome-of-wwii', params: {}, lossThreshold: 7 (inert), resourceLossCondition: { kind: 'scheme-counter', counter: WWII_CONQUERED_CAPITALS, threshold: WWII_CAPITALS_TO_WIN, meterKind: 'conquered-capitals', lossDescription: 'capitals conquered' } }`; the registry-size pin `8 + 67 + 3`.
- **Loss kind** `{ kind: 'scheme-counter'; counter: string; threshold: number; meterKind: SchemeLossKind; lossDescription: string }` in `SchemeResourceLossCondition`; **`applySchemeCounterResourceLoss(G)`** (`rules/schemeResourceLoss.ts`): a no-op unless the active condition is `scheme-counter` and SCHEME_LOSS is unset; at `counters[counter] >= threshold` set SCHEME_LOSS = 1 and log `Scheme loss triggered — ${count} ${lossDescription} (threshold ${threshold}).`
- **Meter**: `SchemeLossKind` and `SCHEME_LOSS_KINDS` gain `'conquered-capitals'` (after `'escaped-officer'`); `collectResourceConditions` maps `scheme-counter` to its `meterKind` with `progress = counters[counter] ?? 0`; the client label `'conquered-capitals': 'Capitals'`.
- **Escape path** (`villainDeck/villainDeck.reveal.ts`): `settleWwiiConquest(G)` at the end of `resolveVillainEscape`, after `applyEscapedPileResourceLoss(G)` (a function-level import cycle: the invasion plays cards through this module). No `game.ts` change.

## Guardrails
- No setup change (the extra Villain Group is WP-833); no new `G` field (counter keys only).
- Twists through the registered resolver; escapes driven through the real reveal path in tests.
- The resolver id, the `scheme-counter` kind and the `conquered-capitals` kind are contract changes, recorded in D-24765.
- The only edited existing assertions: the registry-size pin, the `SCHEME_LOSS_KINDS` drift list, the two resolver-key drift lists.
- Regenerate only what a `:check` reports stale after a rebuild; hash oracles byte-identical, else STOP.

## Required `// why:` Comments
- The resolver id, the config entry (the twist proxy suppressed; lossThreshold inert) and the resolver.
- The country counter raised before the plays (a nested Twist); the City emptied before the resize.
- A returned Bystander typed; captured Heroes staying with their Villain.
- "This country": once per country, settled at every escape, before the next invasion and after the plays; the normal City is not a country.
- The constants leaf module (the load-time cycle); the evaluator's latch-once rule; the meter kind; the settle at the end of `resolveVillainEscape`.

## Files to Produce
- `packages/game-engine/src/rules/changeTheOutcomeOfWwii.logic.ts`, `rules/changeTheOutcomeOfWwii.constants.ts`, `rules/changeTheOutcomeOfWwii.logic.test.ts` — **new** (X1-X10)
- `packages/game-engine/src/rules/schemeTwistConfig.types.ts`, `rules/schemeTwistConfigs.ts` + `schemeTwistConfigs.test.ts`, `rules/schemeTwistResolvers.ts`, `rules/schemeResourceLoss.ts`, `rules/schemeLossProgress.ts` + `schemeLossProgress.test.ts`, `events/notableEvents.types.ts` + test, `events/notableEvents.compose.ts`, `villainDeck/villainDeck.reveal.ts` — **modified**
- `apps/arena-client/src/vfx/menaceDisplay.ts` + `menaceDisplay.test.ts` — **modified** (one label)
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-832-change-the-outcome-of-wwii.md` — **modified / new** (governance close)

## After Completing
- [ ] X1-X10 and the client label case pass; engine delta as in WP §Scaffold.
- [ ] Revert proofs as listed in WP AC 3, each restored.
- [ ] Every card / coverage `:check` → 0 after the rebuild; arena-client `typecheck` → 0; dashboard `test:coverage` / `typecheck` / `format:check` → 0.
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.
- [ ] D-24765 Active; 01.6 post-mortem WP COMPLETE; STATUS updated; WORK_INDEX `[x]` with date; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0.
- [ ] Allowlist-only diff (revert `lagn-v1.json` CRLF churn). Two-commit topology `EC-870:` then `SPEC:`.
- [ ] Live-verify (D-24026), operator-pending until seen: a 2-player operator match with this scheme created after the deploy (gitSha checked): a Twist resizes the City and plays 2; an escape conquers a capital ("Capitals 1/3"); the USSR's 6 spaces fit the 1280x720 board; Twist 7 does not end the game.

## Common Failure Smells
- The game ends at the seventh Twist → the config or its `scheme-counter` condition is missing.
- A returned Bystander's reveal fails ("no entry in villainDeckCardTypes") → it was not typed.
- A nested Twist invades the same country twice → the country counter was raised after the plays.
- An escape is never counted (or only in the live game, not in sims) → the escape-path settle or the pre-invasion settle is missing.
- The meter reads "Twists" → the meter kind is missing.
