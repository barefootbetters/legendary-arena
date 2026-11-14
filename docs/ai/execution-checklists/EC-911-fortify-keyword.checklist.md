# EC-911 — Fortify: Squirrel Girl (Sidekick Stack) and Colleen Wing (Mastermind) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-873-fortify-keyword.md
**Layer:** Game Engine (Fortify contract + table + helpers, escape primitive, `fightVillain({ fortifiedPlace })` fight path, Sidekick and Mastermind locks, bot mirrors, three UIState fields) + Arena Client (`FortifiedVillains` strip, `MastermindTile` / `SharedDecks` gate arms) + card data (two overlay markers, regenerated feeds)
**Risk Tier:** MEDIUM — a new escape-time primitive that pulls a Villain back out of the Escape Pile (the escape still counts), a second fight path through `fightVillain` with its bot mirror (a divergence freezes bot turns), a new contract file and a lazy hashed `G` table; no auth, money, persistence or server surface.

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] The WP-873 / EC-911 / D-24818 reservation (#3204) is on `main`. Every WP Assumes item (1-14) holds at HEAD; re-read each line anchor.
- [ ] `resolveVillainEscape` is still the only `onEscape` fire site and still pushes to `G.escapedPile` before it; every "escaped Villains" loss still counts the pile, not the counter.
- [ ] Neither Escape line is fired by any hashed fixture, sentinel or PAR artifact (re-grep `great-lakes-avengers`, `heroes-for-hire`).
- [ ] `pnpm -r build`, then `pnpm -r --no-bail test`, exit 0; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0. Record the engine and arena-client counts.

## Locked Values (do not re-derive; verify at HEAD)
- `board/fortify.types.ts` (new): `FortifyPlace = 'sidekick-stack' | 'mastermind'`, `FORTIFY_PLACES` in that order; `FortifyLock = 'no-recruit-or-gain' | 'no-fight'`,
  `FORTIFY_LOCKS` in that order; `FORTIFY_ALLOWED_LOCKS = { 'sidekick-stack': ['no-recruit-or-gain'], mastermind: ['no-fight'] }`;
  labels `'the Sidekick Stack'` / `'the Mastermind'`; lock texts `"Sidekicks can't be recruited or gained"` / `"the Mastermind can't be fought"`;
  `interface Fortification { villainCardId: CardExtId; lock: FortifyLock }`.
- `G.fortifications?: Partial<Record<FortifyPlace, Fortification>>` — lazy; deleted when empty; written only by `fortifyWithEscapedVillain` / `removeFortification`.
- `board/fortify.logic.ts` (new): `isFortifyPlace`, `getFortification`, `isSidekickStackFortified`, `isMastermindFortified`, `listFortifications`
  (`FORTIFY_PLACES` order), `fortifyWithEscapedVillain` (already → no write; not in pile → no write; else remove the last index and set
  the entry; `G.counters` never touched), `removeFortification`, `buildFortifyBlockReason` = `` `${name} fortifies ${label}. Fight ${name} first.` ``.
- Primitive `'fortify'` appended **last** (sibling drafts WP-864 / WP-869 / WP-872 also append; rebase) in the union, `VILLAIN_EFFECT_PRIMITIVES` and the
  marker script's hand-synced list; descriptor `fortifyPlace?` / `fortifyLock?`, not in `descriptorKey`.
- Grammar `fortify:<place>:<lock>`: exactly 3 parts, place in `FORTIFY_PLACES`, lock in `FORTIFY_ALLOWED_LOCKS[place]`; else `null`.
- Handler `villainEffectFortify`: non-`onEscape` → no-op; names via `resolveCardDisplayName(G, id)`; logs (exact):
  `` `${villain} fortifies ${label}: ${lockText} until a player fights ${villain}.` `` ·
  `` `${villain} can't fortify ${label}: ${other} already fortifies it, so ${villain} stays in the Escape Pile.` ``.
- Exhaustiveness: the handler's result branch and every `switch` over `FortifyPlace` / `FortifyLock` end in a `never` default (fail `tsc`, not open).
- `FightVillainArgs.fortifiedPlace?: FortifyPlace`; `fightVillain` routes to `fightFortifyingVillain(G, context, fortifiedPlace)` and returns,
  before any City read. `findFightableFortifier(G, playerId, place)` (in `villainDefeatRequirement.logic.ts`; the single authority for move AND
  bot) runs place → entry → price `Math.max(0, resolveFightPrice)` vs `UNNAMED_CITY_SPACE_TARGET` spendable → defeat requirement →
  `isFightRestrictionBlocking(G, playerId, null, r)` → discard cost exists (refuse); then stage `main` → `hasAnyPendingChoice` → `hasHealedThisTurn`. Then Size-Changing line, `defeatFortifyingVillainCore`, `spendFightCostForTarget(…, UNNAMED_CITY_SPACE_TARGET)`,
  Microscopic gain, `hasActedThisTurn`, the D-24467 signal, the Enigma offer.
- `defeatFortifyingVillainCore`: `removeFortification` → Orrgo recorder (lazy) → Victory Pile → `` `Player ${player} fought ${villain} fortifying ${label}. ${Label} is no longer fortified.` `` (`${villain}` = `formatCardRef`)
  → `executeVillainAbilities(…, 'onFight', shuffleContext, undefined)` + `Fight effect:` line. No `fightResolved`, award, EV or paid rescue.
- `isFightRestrictionBlocking` `cityIndex: number | null`; `no-adjacent-villain` + `null` → `false`.
- Locks: `recruitSidekick` first step-1 check; `gainSidekickToDiscard` returns `false` first; `heroEffectGainSidekick` `blocked` line
  `` `Player ${playerID} could not gain a Sidekick — ${reason} (${card})` ``; `fightMastermind` right after the haunting return;
  `getLegalMoves` fightMastermind `&& !isMastermindFortified`; fortifier intents `{ name: 'fightVillain', args: { fortifiedPlace } }` after the City intents, one per
  `listFortifications` entry with `findFightableFortifier(...) !== null`.
- Invariants: `gameRules.checks.ts` visits each `G.fortifications` `villainCardId` as container `fortifications.${place}`, in
  `FORTIFY_PLACES` order, right after the `hqHaunters` loop (the Escape Pile stays unscanned).
- UIState: `UIFortifier { place, placeLabel, extId, display, fightCost, lockText, fightRestrictionReason? }`; `UICityState.fortifiers?`,
  `UIMastermindState.fortifiedReason?`, `UISharedPilesState.sidekickStackFortifiedReason?` — public, conditional spreads in build and filter.
  `index.ts` exports the `UIFortifier` and `FortifyPlace` types and the value `UNNAMED_CITY_SPACE_TARGET`.
- Client: `FortifiedVillains.vue` (`play-fortifier`, `play-fortifier-fight`; gate stage → heal → cost at `UNNAMED_CITY_SPACE_TARGET` →
  restriction; submits `fightVillain({ fortifiedPlace })`) mounted by `CityRow` under `EscapedPile`; `MastermindTile` arm after cost,
  before tactics; `SharedDecks` arm after the heal lock, before "already recruited".
- Markers: `cvwr/great-lakes-avengers/squirrel-girl` escape `fortify:sidekick-stack:no-recruit-or-gain`; `cvwr/heroes-for-hire/colleen-wing`
  escape `fortify:mastermind:no-fight`.

## Guardrails
- City fights byte-identical: `defeatCityVillainCore` and the City branch of `fightVillain` are not modified beyond the routing line.
- Lazy everywhere: no table, UIState key or new intent without a fortification. STOP if `finalStateHash`, `PRE_WP080_HASH` or `sim:coverage --check` moves.
- One table, one predicate per lock; no inline `G.fortifications` read outside `board/fortify.logic.ts`.
- Free defeats (`defeatChoice.resolve.ts`) are not changed (D-24737).
- Silent refusals; moves and handlers never throw.
- Markers only (`apply-effect-markers.mjs`); never `convert-cards-v15.mjs`.
- Drift / keyset pins are runtime assertions. No `.reduce()`, nested ternaries, `any`, `@ts-ignore`. Never `git stash`.

## Required `// why:` Comments
- `fortify.logic.ts`: the Escape Pile removal and why the counter is untouched (rules v23 L3182-3184 vs L3265); one per place (L1465-1466); delete-when-empty (hash posture).
- `villainEffects.execute.ts`: escape-only timing; the owed escape procedure still resolves (D-24656).
- `fightVillain.ts`: the routing (new argument, not a new move: registration surfaces; City path byte-identical).
- `fortifyFight.ts`: the unnamed target; fail-closed discard cost; why a separate small core; the plain-fight residuals; `hasAnyPendingChoice` = the City
  cluster + the two put-bottom-HQ guards (the bot returns early on both); the runtime-safe import cycles (`villainEscapeProcedure.ts` precedent);
  `villainDefeatRequirement.logic.ts`: the new `economy.resolve` cycle is runtime-safe (bindings read inside functions).
- `villainDefeatRequirement.logic.ts`: `null` = no City neighbours.
- `recruitSidekick.ts` / `gainSidekick.logic.ts` / `fightMastermind.ts`: the lock (WP-873 / D-24818); fightMastermind: free defeats ignore it (D-24737).
- `ai.legalMoves.ts`: both mirrors (D-24364).
- `uiState.build.ts` / `uiState.filter.ts`: public inputs; five-step pass-through.
- Client gate arms: position in the order (resource before structural; SharedDecks: beside its other structural Stack gates).

## Files to Produce
- Engine `packages/game-engine/src/` — **new**: `board/fortify.types.ts`, `board/fortify.logic.ts` + test, `villain/cvwrFortify.test.ts`,
  `moves/fortifyFight.ts` + test. **Modified**: `types.ts`, `index.ts`; `rules/villainAbility.types.ts` + test;
  `setup/villainAbility.setup.ts` + test; `villain/villainEffects.execute.ts`; `moves/fightVillain.ts` + test;
  `moves/villainDefeatRequirement.logic.ts` + test; `moves/recruitSidekick.ts` + test; `moves/gainSidekick.logic.ts`;
  `hero/heroEffects.execute.ts`, `hero/gainSidekick.test.ts`; `moves/fightMastermind.ts` + test; `simulation/ai.legalMoves.ts` + test;
  `simulation/ai.competent.test.ts`; `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts`;
  `invariants/gameRules.checks.ts`, `invariants/invariants.test.ts`.
- Client `apps/arena-client/src/components/play/` — **new**: `FortifiedVillains.vue` + test. **Modified**: `CityRow.vue`, `MastermindTile.vue`,
  `SharedDecks.vue` + their tests.
- Data: `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`,
  `scripts/coverage/mechanic-provenance.json` (`fortify` -> WP-873 / D-24818) (modified);
  `data/cards/cvwr.json`, the villain ledger json/csv, `data/metadata/effect-implementation-index.json` (regenerated); only if they move:
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/hero-effect-coverage.baseline.json`, the dashboard in-play pin pair.
- Close: `docs/ai/DECISIONS.md` (D-24818), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`, `docs/ai/post-mortems/01.6-WP-873-fortify-keyword.md` (new), `docs/ai/coverage/live-verify.json` (pending rows; flipped only when observed).

## After Completing
- [ ] T1-T33 (+ T14b, T20b) pass (T8-T13 read the regenerated `cvwr.json`, so run the overlay before the engine tests); `pnpm -r build` 0;
      `pnpm -r --no-bail test` 0 fail; arena-client `typecheck` 0; counts recorded.
- [ ] Overlay: 2 new markers, re-run 0; `git diff data/cards/` = `cvwr.json`, two lines. Rejection cases observed by hand, recorded in the commit body.
- [ ] Regenerate: `pnpm -r build && pnpm ledger:villains && pnpm effect-index`; dashboard `prebuild:coverage` + `prebuild:effect-index`;
      then `cards:check`, `cards:count-markers:check`, `effect-index:check`, `effect-index:test`, `registry:validate`, `ledger:villains:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`,
      `sim:coverage --check` 0; the two ledger rows recorded verbatim.
- [ ] Twenty revert proofs observed and restored (WP Verification Step 8).
- [ ] D-24818 Active covering every Reserved Decision clause; STATUS with follow-ups A-F, Bribe (must cover the fortifier fight + mirror) and the fortifier-fight residuals;
      01.6 post-mortem; WORK_INDEX `[x]`; EC_INDEX Done; mindmap ✅ + `roadmap:counts:write` / `roadmap:counts:check` 0;
      `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` 0; ledger LANDED note.
- [ ] `EC-911:` then `SPEC:`; `git diff --name-only origin/main...HEAD` inside Files to Produce.
- [ ] Live-on-surface (D-24026) in a match whose setup lists both groups: both locks seen and released; `uiStateSnapshot` shows the
      three fields. Or operator-pending in STATUS.

## Common Failure Smells
- The escape count or score penalty dropped: the counter was decremented (it must still count the escape).
- Squirrel Girl shows in the Escaped Pile and the fortifier strip at once: the pile removal is missing.
- The bot repeats the same fortifier fight to the step cap: the `getLegalMoves` intent skips a check the move makes (restriction, price target).
- A City fight's log or hash moved: the routing line reads a City field before the `fortifiedPlace` check, or `defeatCityVillainCore` was touched.
- Recruit Sidekick enabled but nothing happens: `sidekickStackFortifiedReason` dropped by the filter (five-step step 3).
- Doop-style adjacency blocks a fortifier: `isFightRestrictionBlocking` read `city[null ± 1]` instead of the `null` arm.
