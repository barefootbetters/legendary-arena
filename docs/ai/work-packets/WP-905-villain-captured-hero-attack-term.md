# WP-905 — The captured-Hero Attack term is opt-in, not inferred from the "N+"/"*" marker (Game Engine)

**Status:** Draft 2026-11-19 (EC-943; D-24862 reserved, #3450) — pre-flight READY TO EXECUTE; copilot CONFIRM; 00.3 PASS
**Layer:** Game Engine only (one setup builder, one omit-when-empty `G` field, one `resolveFightCost` gate). No card data, registry, server, persistence, or client change.
**User-Visible Surface:** none — infrastructure. The change is behaviour-preserving for every villain in the current card pool (see §Context); it hardens a latent misread, with no observable change.
**Risk Tier:** MEDIUM — a correctness gate on the single fight-cost authority (the engine's outcome-deciding layer) plus one new contract `G` field. Zero fight-cost / gameplay change for any current match; the enforced determinism gates (the `sentinel-core-doom-2p` `finalStateHash` fixture and the core-only spike-bundle `initialStateHash`, both Skrull-free) are byte-identical; D-24026 live-verify N/A. A match that selects a hero-capturing villain group gains the omit-when-empty `villainCapturedHeroCost` field in its full-`G` hash (the accepted WP-838 / WP-841 / WP-760 omit-when-empty pattern). No auth, money, persistence, server, or client surface.
**Hard-deps:** WP-214 / (dynamic fight cost, `fightCostMode`/`fightCostBase`, `G.villainAttachedHeroes`, `resolveBaseFightCost`) ✅; WP-838 / D-24771 (the setup-scan → `G` map → `resolveFightCost` carve-out pattern: `buildVillainAttackPerCaptured`, `G.villainAttackPerCaptured`) ✅; WP-841 / D-24774 (`buildVillainVariableAttack`, `G.villainVariableAttack`, the sibling carve-out) ✅; WP-898 / D-24855 (the shared `listSelectedVillainCards` setup enumerator + `villainCardInstanceExtIds`) ✅.
**Soft-dep / shared-file coordination:** WP-902 / D-24859 (in-flight draft) adds `villainDarkMemoriesBonus` to `economy/economy.resolve.ts` and `buildVillainDarkMemories` + its spread to `setup/buildInitialGameState.ts` — the same two files this WP edits. **WP-903 / D-24860 (Taskmaster's Thunderbolts, drafted 2026-11-19, landed on `main` as #3449)** implements Bullseye's icon-guess Hero capture with a dynamic Attack "equal to that Hero's cost"; it touches the same two files. The three terms are independent; whichever lands last rebases (textual, not semantic, overlap). **Interaction:** this WP makes the captured-Hero cost term opt-in, so when WP-903's Bullseye capture executes it MUST opt Bullseye into `villainCapturedHeroCost` (its Hero-capture marker does this automatically) or Bullseye's dynamic Attack would resolve to base — a hardening, not a regression. See `.claude/rules/*` parallel-WP discipline.
**Origin:** found by the independent 01.7 copilot reviewer while gating WP-902 (Elite Assassins). WP-902 itself is unaffected (its Dark Memories villains never capture a Hero), but the misread touches the fight-cost authority for every dynamic villain that could.

## Goal

`resolveBaseFightCost` (`economy/economy.resolve.ts`) treats the `+` / `*` on a villain's printed Attack as if it universally
meant "plus the recruit cost of each Hero this Villain has captured." It does not. The `+` / `*` is a display marker for "variable
Attack," and the specific rule differs per card: `[keyword:Dark Memories]` (+1 per Hero Class in the fighter's discard pile),
`[keyword:Blood Frenzy]` (+1 per distinct VP value in the fighter's Victory Pile), `[variable-attack:…]` (Sunlight, per-HQ-class),
or a per-card capture clause. Only the villains whose printed text actually says "gets +Attack equal to that Hero's cost" should add
the captured-Hero cost. Today the term is a **deny-list** default (every dynamic villain adds it unless carved out), so it is
correct only by the accident that no dynamic villain in the current pool both captures a Hero and means something other than cost.

This WP makes the captured-Hero cost term **opt-in**, keyed on the villain's actual capture ability (the printed rule that "says
so"), not on the `+` / `*` marker: a new setup builder records the villains whose Attack adds captured-Hero cost into
`G.villainCapturedHeroCost`, and `resolveBaseFightCost` adds the term only for those. The opted-in set is exactly the villains that
can populate `G.villainAttachedHeroes` and whose clause is a cost clause — co2e Skrull Shapeshifter / Skrull Queen Veranke and core
Skrull Shapeshifters / Skrull Queen Veranke — so no current match changes cost. The fix removes the latent trap: a future WP that
gives a Dark-Memories / Blood-Frenzy / Sunlight "N+" villain a Hero-capture line can no longer silently add that Hero's cost.

## User-Visible Impact

None today. Every match resolves fight costs identically: the four Skrull capturers still pay base + Σ(captured-Hero cost), and
every other dynamic villain still pays its base plus its own keyword term. The change is a correctness invariant on the fight-cost
authority, not a surface change — the enforced determinism gates (the Skrull-free `sentinel-core-doom-2p` `finalStateHash` fixture
and the core-only spike `initialStateHash`) are byte-identical, so D-24026 live-verification is N/A. A match that selects a
hero-capturing villain group carries the new omit-when-empty `villainCapturedHeroCost` field, so its full-`G` hash differs from a
pre-WP baseline exactly as it would for any WP-838 / WP-841 / WP-760 omit-when-empty field; no player can observe this.

## Assumes

- Baseline `origin/main` = `2fa49f587` (`SPEC: draft WP-903 Taskmaster's Thunderbolts`, #3449), which carries the adjacent drafted WP-903 (Taskmaster's) and WP-904 that share `economy/economy.resolve.ts` + `setup/buildInitialGameState.ts`; rebase onto whichever of them has executed when WP-905 runs. At the
  baseline `pnpm -r build` exits 0; the executor records the game-engine suite count
  (`pnpm --filter @legendary-arena/game-engine test`) before and after (WP-902 observed 7450 pass / 0 fail at the adjacent SHA).
- **The parser (`economy/economy.logic.ts` L358-382, unchanged by this WP):** `buildCardStats` sets `fightCostMode = 'dynamic'`
  for a `vAttack` of `'*'` (base 0) or any string ending in `'+'` (`fightCostBase = parseCardStatValue`), else `'static'`. This WP
  does **not** change how `fightCostMode` / `fightCostBase` are assigned — the `+` / `*` keeps marking "variable Attack"; only the
  **consumer** stops inferring the cost rule from it.
- **The resolver (`economy/economy.resolve.ts` `resolveBaseFightCost` L406-492):** static → `fightCost`. Dynamic →
  `fightCostBase`, returned unchanged when `G.villainVariableAttack?.[id]` or `G.villainAttackPerCaptured?.[id]` is set (their own
  printed rule), else `fightCostBase + Σ (G.cardStats[heroId]?.cost ?? 0)` over `G.villainAttachedHeroes?.[id] ?? []`. The overlay
  branches (Killbot / Skrull-conversion / micro-sized / Officer / stack) sit above the `cardStats` guard and are untouched.
- **The capture write-sites (`board/heroCapture.logic.ts`):** `G.villainAttachedHeroes[id]` is populated only by
  `captureHeroFromHq` (the `capture-hq-hero` descriptor, selectors rightmost / highestCost / lowestCost) and by
  `attachCapturedHero` / `captureHeroFromHqSlot` (Venom's Sidekick-pile + cheap-HQ captures, `villain/villainEffects.execute.ts`
  L6922, L6987). In the committed card data these surface as the ability markers `[effect:captureHqHeroRightmost]`,
  `[effect:captureHqHeroHighestCost]`, `[effect:captureHqHeroLowestCost]`, `[effect:capture-pile-hero:<pile>]`,
  `[effect:capture-hq-heroes-cost-lte:<n>]`. `[effect:captureBystander]` and the per-HQ / Victory-Pile Bystander captures write
  `G.attachedBystanders`, **not** `G.villainAttachedHeroes`, so they are not Hero captures.
- **The complete set of dynamic Hero-capturing villains in the pool** (verified by a `data/cards/*.json` scan over villain
  `abilities` cross-referenced with `vAttack`): co2e `skulls` Skrull Shapeshifter (`1+`, "gets +Attack equal to that Hero's
  cost") and Skrull Queen Veranke (`2+`, same); core `skrulls` Skrull Shapeshifters (`*`, "attack is equal to that Hero's VP")
  and Skrull Queen Veranke (`*`, same); and co2e Venom (`5+`, `[attack-per-captured:hero:1]`). co2e `hydra` HYDRA Kidnappers
  captures Heroes but is **static** (`vAttack "4"`), so it never reaches the dynamic path. No other villain can populate
  `G.villainAttachedHeroes`.
- **Hero VP is not in the data** (hero cards carry no `vp` field; `G.cardVictoryPoints` is not populated for Hero cards), so the
  core Skrull `*` clause "attack equal to that Hero's **VP**" is unresolvable from card data. WP-214's use of the captured Hero's
  **cost** for the `*` case is the deliberate available proxy, not a defect; this WP preserves it (D-24862). A VP-faithful core
  Skrull resolution would require Hero VP data and is **out of scope**.
- **The carve-out builders:** `buildVillainVariableAttack` (`setup/villainDefeatRequirement.setup.ts:591`) and
  `buildVillainAttackPerCaptured` (same file, L775) live in `villainDefeatRequirement.setup.ts`; `buildVillainBloodFrenzy` lives in
  its **own file** `setup/buildVillainBloodFrenzy.ts`. Each walks `listSelectedVillainCards(registry, matchConfig)`, parses one
  bracket marker per `villainCard.abilityLines` with a **structured** parser (`parseAttackPerCapturedLine` /
  `parseVariableAttackLine`, not a raw substring test), and fans one entry per `villainCard.instanceExtIds`. The new builder is a
  new file, so it mirrors the `buildVillainBloodFrenzy.ts` own-file precedent.
- **Wiring (`setup/buildInitialGameState.ts`):** the sibling builders are invoked with `villainBuildConfig` at **L505-521**, and
  each result is spread onto `G` only when non-empty in the omit-when-empty block at **~L1030-1043** (`Object.keys(x).length > 0`,
  the hash-stability rule).
- **Projection:** `G.villainVariableAttack` and `G.villainAttackPerCaptured` are engine-internal — read only by `resolveFightCost`,
  absent from `ui/uiState.build.ts`. The new `G.villainCapturedHeroCost` follows that pattern (not projected). `resolveFightCost`
  is the single authority its **four** consumers all share: the fight move, the bot's legal moves (`getLegalMoves`), the City
  `fightCost` projection, and `buildPureFuryTargets` (`hero/heroEffects.execute.ts:5785`, "Villain with less than N Attack"). The UI
  never recomputes. The executor's `git grep` for red tests must cover all four surfaces, not just the first three.

## Context (Read First)

Confirmed at baseline with a throwaway `node:test` against `resolveFightCost`:

- A dynamic `3+` villain modelling Blue Talon (`[keyword:Dark Memories]`, which never captures) with a hypothetically attached Hero
  of cost 5 resolved to **8** (3 + 5). Faithful = **3** (the captured Hero adds nothing; Dark Memories is a separate term). This is
  the latent trap: the moment any "N+" keyword villain gains a Hero-capture line, its captured Heroes' costs are added wrongly.
- A `*` villain modelling core Skrull Shapeshifters with an attached Hero (cost 5) resolved to **5** — the captured-Hero cost proxy,
  which this WP preserves (Hero VP is unavailable; see §Assumes).

**Why opt-in keyed on the capture ability, not an explicit new card-data marker.** The reviewer's precise finding is that a
*display* marker (`+` / `*`) is driving a *gameplay* rule. The minimal correct decoupling reads the villain's **actual capture
ability** — the printed clause that attaches a Hero — rather than the Attack glyph. This needs no card-data edit (the capture
markers already exist), is single-layer, and is behaviour-identical for the whole current pool, because the opted-in set it
produces (the four Skrull capturers; Venom excluded by its prior `attack-per-captured` carve-out) is exactly the set that adds the
cost today. An explicit per-card `[attack-from-captured-hero:cost]` marker was considered and rejected for this WP: it would edit
hand-authored `co2e.json` and the generated `core.json` marker-injection source for no behavioural gain, and future cost-capturers
(Dracula, Demon Bear, Party Skrull, Bullseye) will carry a Hero-capture line anyway, so they opt in for free when implemented. A
future villain that captures a Hero but must **not** add its cost would print a `[variable-attack:…]` or `[attack-per-captured:…]`
clause (Witchfire's Sunlight is `variable-attack`), which the resolver already checks first — so the capture-ability key stays
correct without per-card negative markers.

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets; ESM only; Node v22+; human-style code per
  `docs/ai/REFERENCE/00.6-code-style.md` (full words, JSDoc on every function, ~30-line functions, `for` loops, no `.reduce()`,
  no nested ternaries).
- Determinism: the builder is pure (no `Math.random`, clocks, I/O, or registry runtime query — it reads `registry: unknown` behind
  a structural guard, as `buildVillainBloodFrenzy` does); `resolveBaseFightCost` stays pure and never throws; the gate is a
  key-lookup, not iteration over `G`.
- `G` stays JSON; the only new `G` key is `villainCapturedHeroCost`, written only when non-empty. The `sentinel-core-doom-2p`
  `finalStateHash` fixture and the local spike bundle's `initialStateHash` are byte-unchanged — a moved hash is a STOP.
- Behaviour-preserving for the current pool: the opted-in set equals the dynamic villains that add captured-Hero cost today (the
  four Skrulls; Venom stays carved out; HYDRA Kidnappers is static). No current match's fight cost changes.
- No card data, no `scripts/convert-cards/**`, no new ability marker, primitive, move, phase, stage, or other `G` key; no
  per-card name special-casing (the builder reads ability markers, not card names).
- Layer Boundary: engine only; no `registry` / `apps/*` / `pg` / `boardgame.io` import in the new builder or the resolver.
- The breaking-fixture migrations (`economy.resolve.test.ts`, `simulation/ai.legalMoves.test.ts`, `hero/pureFury.logic.test.ts`,
  `setup/buildInitialGameState.shape.test.ts`) are the ONLY sanctioned test edits; they are migrated to the opt-in model, never
  weakened (reward-integrity; the commit records the intended change).

**Session protocol:** STOP and report if a `finalStateHash` sentinel or the spike-bundle `initialStateHash` moves, if any current
match's resolved fight cost changes, if a shipped non-captured-hero villain's cost changes, or if a fix would need a test edit
outside the four sanctioned files.

**Locked contract values:** see the EC `## Locked Values`.

## Scope (In)

**A. New `G` field** (`packages/game-engine/src/types.ts`): `villainCapturedHeroCost?: Record<CardExtId, true>` — the villain
zone-instance ext_ids whose dynamic Attack adds the recruit cost of each captured Hero. Omit-when-empty (lazy), engine-internal,
immutable after setup. A `// why:` cites WP-905 / D-24862 and the `villainBloodFrenzy` precedent.

**B. New builder** (`packages/game-engine/src/setup/buildVillainCapturedHeroCost.ts`, new file):
`buildVillainCapturedHeroCost(registry: unknown, matchConfig: MatchSetupConfig): Record<CardExtId, true>`. The
`buildVillainBloodFrenzy` shape — walk `listSelectedVillainCards(registry, matchConfig)`; a villain qualifies when any
`villainCard.abilityLines` line carries a **Hero-capture** effect marker from the locked `HERO_CAPTURE_EFFECT_MARKERS` set
(`captureHqHeroRightmost`, `captureHqHeroHighestCost`, `captureHqHeroLowestCost`, `capture-hq-hero`, `capture-pile-hero`,
`capture-hq-heroes-cost-lte`) **and** the card is not excluded by the structured `parseAttackPerCapturedLine` /
`parseVariableAttackLine` parsers (those print their own rule and are resolved before this term — detect them with the same
structured parsers the siblings use, not a raw substring test); fan one `true` entry per `villainCard.instanceExtIds`. Narrow test
mocks → empty record (the reader-interface graceful-skip, as the sibling builders). `HERO_CAPTURE_EFFECT_MARKERS` is a
hand-maintained allow-list; a drift assertion in the builder test (§E) pins it ⊇ the hero-capture primitives so a future
hero-capture primitive cannot silently drop a villain's cost term.

**C. Resolver gate** (`packages/game-engine/src/economy/economy.resolve.ts` `resolveBaseFightCost`): the dynamic-mode
captured-Hero cost sum fires **only** when `G.villainCapturedHeroCost?.[villainCardId] === true`; otherwise dynamic mode returns
`fightCostBase`. The existing `villainVariableAttack` / `villainAttackPerCaptured` early-return (return `base`) stays ahead of it
as defence-in-depth. A `// why:` records that the `+` / `*` marker no longer implies the cost rule (WP-905 / D-24862).

**D. Wiring** (`packages/game-engine/src/setup/buildInitialGameState.ts`): build `villainCapturedHeroCost` with
`villainBuildConfig` beside the sibling builders (L505-521) and spread it onto `G` only when non-empty, in the omit-when-empty
block at ~L1030-1043 (`Object.keys(villainCapturedHeroCost).length > 0`), with a `// why:` matching the sibling spreads.

**E. Tests** (`node:test`, `.test.ts`):
- New `setup/buildVillainCapturedHeroCost.test.ts`: a villain with a `captureHqHero*` line qualifies; a `captureBystander` /
  no-capture line does not (negative case); an `attack-per-captured` / `variable-attack` line is excluded even with a capture line
  (Venom); narrow mock → `{}`; instance-id fan-out; **plus a drift assertion** that `HERO_CAPTURE_EFFECT_MARKERS` ⊇ the **data-marker
  tokens the builder actually scans** — the five that appear in co2e/core card data: `captureHqHeroRightmost`,
  `captureHqHeroHighestCost`, `captureHqHeroLowestCost`, `capture-pile-hero`, `capture-hq-heroes-cost-lte` (NOT the kebab dispatch
  primitives) — with a phantom-token negative assertion proving the guard is non-vacuous.
- `economy/economy.resolve.test.ts` (modify): **every** assertion that today has a dynamic villain add captured-Hero cost with no
  opt-in flag goes red under the opt-in model and MUST be migrated (not weakened) — this is an intended behaviour change, recorded
  in the commit (reward-integrity; D-24862). The `makeG` helper (L28-36) gains `villainCapturedHeroCost?: Record<string, true>`.
  The complete enumeration (set the flag to preserve the asserted cost-capturer totals, AND add no-flag latent-trap cases asserting
  base):
  - the base `"*"` case **L74-82** (`villain-skrull` → 5) and `"N+"` case **L113-121** (`villain-np` → 7);
  - the multiple-captured-heroes block **L139-151** (→ 10) and **L154-166** (→ 4);
  - the WP-838 block **T9 L965-979** — its title "an entry replaces the captured-Hero cost sum; a villain with no entry keeps it"
    **inverts** under this WP (no entry now means no cost); rewrite the title and the `OTHER_DYNAMIC` assertion (L979, `3 + 5`) so
    `OTHER_DYNAMIC` gets the opt-in flag to keep asserting 8 (or is reframed as the no-flag base-3 latent case);
  - **T11 L1005-1023** (`villain-dynamic` → 7 at L1015/L1023) — same migration.
- `simulation/ai.legalMoves.test.ts` (modify): the dynamic-villain affordability regression (~L631-655) sets `dyn-villain`
  (`fightCostBase 0`) + an attached Hero (cost 5) and asserts resolved cost 5 → the fight is unaffordable at attack 4. Under the
  opt-in model `dyn-villain` has no flag → resolves to 0 → affordable, breaking the assertion. Set
  `gameState.villainCapturedHeroCost = { 'dyn-villain': true }` to preserve the test's intent (resolved cost 5, unaffordable).
- `hero/pureFury.logic.test.ts` (modify): the fourth `resolveFightCost` consumer is `buildPureFuryTargets`
  (`hero/heroEffects.execute.ts:5785`, "Villain with less than N Attack"). Its test **L407-418** sets `villain-dyn`
  (`fightCostBase 1`) + a captured Hero (cost 2) with no flag and asserts `buildPureFuryTargets(G,'0') === []` ("base 1 + captured
  2 = 3, not below 3"). Under the opt-in model `villain-dyn` resolves to 1 → `1 < 3` → it enters the targets, breaking the `[]`
  assertion. Set `G.villainCapturedHeroCost = { 'villain-dyn': true }` to restore the 3.
- `setup/buildInitialGameState.shape.test.ts` (**modify — required**): the shape test enumerates the omit-when-empty optional
  `G` fields (`villainVariableAttack` at T15/T15b L598-615, `villainAttackPerCaptured` at T29/T29b L640-668). Add a
  `villainCapturedHeroCost` present-when-set / absent-when-empty pair mirroring **T15 / T29** (not `villainBloodFrenzy`, which has
  no shape case).

## Out of Scope

- Any change to `fightCostMode` / `fightCostBase` assignment, the `vAttack` parser, or the overlay branches (Killbot, Skrull
  conversion, micro-sized, Officer, stack) of `resolveBaseFightCost`.
- A VP-faithful core Skrull `*` resolution (needs Hero VP data — a separate card-data/registry WP). The cost proxy is retained.
- Any card-data edit (`data/cards/*.json`, `scripts/convert-cards/**`); any new ability marker, primitive, move, phase, stage, or
  other `G` key; any registry, server, persistence, or arena-client change.
- The Dark Memories / Blood Frenzy / Sunlight *terms themselves* (WP-902, WP-760, WP-841 own those). This WP only ensures the
  captured-Hero **cost** term does not fire on top of them.

## Files Expected to Change

- `packages/game-engine/src/types.ts` — **modified** — `villainCapturedHeroCost?` field (contract; D-24862).
- `packages/game-engine/src/setup/buildVillainCapturedHeroCost.ts` — **new** — the builder + `HERO_CAPTURE_EFFECT_MARKERS`.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — build + omit-when-empty spread.
- `packages/game-engine/src/economy/economy.resolve.ts` — **modified** — gate the captured-Hero cost term on the new map.
- `packages/game-engine/src/setup/buildVillainCapturedHeroCost.test.ts` — **new** — builder unit test.
- `packages/game-engine/src/economy/economy.resolve.test.ts` — **modified** — migrate every no-flag dynamic captured-cost assertion (base `*`/`N+`, multiple-heroes, T9, T11) to the opt-in model + latent-trap cases; `makeG` gains `villainCapturedHeroCost?`.
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` — **modified** — the `dyn-villain` affordability regression (~L631-655) gets `villainCapturedHeroCost` set so the resolved cost stays 5 (unaffordable).
- `packages/game-engine/src/hero/pureFury.logic.test.ts` — **modified** — the `villain-dyn` captured-Hero case (L407-418) gets `villainCapturedHeroCost` set so `buildPureFuryTargets` still resolves it to 3.
- `packages/game-engine/src/setup/buildInitialGameState.shape.test.ts` — **modified** — `villainCapturedHeroCost` present/absent assertion pair mirroring T15 / T29.

## Contract

- `G.villainCapturedHeroCost?: Record<CardExtId, true>` — set at setup, immutable after; engine-internal (not projected); present
  only when non-empty. Meaning: "this villain's dynamic Attack adds the recruit cost of each Hero it has captured."
- `resolveFightCost` / `resolveBaseFightCost` semantics: the dynamic captured-Hero cost term is gated on
  `G.villainCapturedHeroCost`, not inferred from the `vAttack` `+` / `*` marker. Static villains, the overlay branches, the
  `villainVariableAttack` / `villainAttackPerCaptured` carve-outs, and the scheme / keyword terms layered in `resolveFightCost` are
  unchanged.
- **In-flight / replay posture (mirrors WP-838 / D-24771, WP-841 / D-24774).** `villainCapturedHeroCost` is built in `Game.setup()`
  and lives only in `initialState.G`. A match or replay whose `initialState` predates this WP has no such field, so a pre-WP Skrull
  match re-resolves / replays its Skrull fight cost as base only — the same accepted consequence as the WP-838 / WP-841 carve-out
  maps, and outside the enforced Skrull-free hash gates. Stored competitive scores are frozen; in-flight matches keep their setup
  hooks.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §8 (Deterministic Game Engine).
- **No conflict:** a villain's Attack adds a captured Hero's cost only where its printed rule says so, not because a display glyph
  (`+` / `*`) happens to mark variable Attack — this makes the engine *more* faithful to the printed card, not less.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — fight cost is engine-decided from card text; nothing cosmetic or paid
  changes an outcome.
- **Determinism preservation:** the builder is pure and setup-time; one omit-when-empty `G` key; `resolveFightCost` stays the single
  authority. The enforced sentinels (`sentinel-core-doom-2p`, spike `initialStateHash`) are byte-identical. A pre-WP `initialState`
  blob carries no `villainCapturedHeroCost`, so a stored Skrull match replays its Skrull fight cost as base only — the same accepted
  consequence as the WP-838 / WP-841 carve-out maps (D-24771 / D-24774); stored competitive scores stay frozen.

## Funding Surface Gate

N/A — no funding, nav or account surface.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. For a dynamic villain with a captured Hero but **no** `villainCapturedHeroCost` entry, `resolveFightCost` returns `fightCostBase`
   (no cost added) — the latent-trap case.
2. For a villain in `villainCapturedHeroCost` with captured Heroes, `resolveFightCost` returns `fightCostBase + Σ(captured Hero
   cost)` — the four Skrull capturers are unchanged from baseline.
3. Venom resolves to `fightCostBase` (its `attack-per-captured` carve-out wins), unchanged from baseline.
4. `buildVillainCapturedHeroCost` records exactly the match's villains that carry a Hero-capture marker and no
   `attack-per-captured` / `variable-attack` marker; narrow mocks → `{}`.
5. The enforced determinism gates are unchanged: the `sentinel-core-doom-2p` `finalStateHash` fixture and the local-spike
   `initialStateHash` (both Skrull-free, so they carry no `villainCapturedHeroCost` field). The executor confirms both fixtures
   select no hero-capturing villain group. (A match that does select one gains the omit-when-empty field — the accepted
   WP-838 / WP-841 / WP-760 pattern — and no fight cost changes.)
6. `pnpm -r build && pnpm -r --no-bail test` green.

## Verification Steps

1. `pnpm -r build && pnpm --filter @legendary-arena/game-engine test` — record before/after counts; new tests pass.
2. `pnpm -r --no-bail test` — whole-repo green (sentinel/hash gates included).
3. `git grep -n villainCapturedHeroCost packages/game-engine/src` — the field is read only by `resolveBaseFightCost` and written
   only by the builder + the setup spread; no UIState / projection reference.
4. Confirm the `finalStateHash` sentinel and the spike-bundle `--check` are unchanged (no determinism drift).

## Definition of Done

- All Acceptance Criteria met; `pnpm -r build && pnpm -r --no-bail test` green with before/after counts recorded.
- `docs/ai/DECISIONS.md` D-24862 flipped to Active (post-execution); `docs/ai/STATUS.md` states "No user-observable change —
  infrastructure only".
- `docs/ai/work-packets/WORK_INDEX.md` row checked; `docs/ai/execution-checklists/EC_INDEX.md` Status `Done`;
  `docs/05-ROADMAP-MINDMAP.md` node `✅` and `pnpm roadmap:counts:write` run.
- D-24026 live-verification: **N/A** — behaviour-preserving, `finalStateHash` unchanged; the WORK_INDEX row records "no
  user-visible change (hardening); live-verify N/A".
- No files outside `## Files Expected to Change` modified — `git diff --name-only origin/main...HEAD` checked.
