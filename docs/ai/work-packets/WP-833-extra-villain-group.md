# WP-833 — "Add an extra Villain Group": a scheme-aware Villain Group requirement (Change the Outcome of WWII and 13 more)

**Status:** Done 2026-10-24 (EC-871 `c47e0cd2`; **D-24766** Active). Live-verify PASS 2026-10-25 (STATUS).
**Primary Layer:** Registry (source of truth) + Game Engine (`Game.setup` gate) + Server (setup-requirements
projection) + App (registry-viewer loadout builder) + gauntlet tooling (menu generator, configs loader)
**User-Visible Surface:** cards.legendary-arena.com loadout builder, play.legendary-arena.com lobby and gauntlet
"Play this leg"
**Lane:** Standard (two-commit topology). A new required `CardRegistry` member, a cross-layer requirement change and a
generated-module change, so NOT lightweight-eligible. Drafted and executed by one session on Jeff's arc direction (the
WP-826..832 practice); independence comes from the three gate subagents and the observed scaffold below.
**Arc:** Cap 75th completion, remaining item 9, part 3 of 3 (WP-831 the City, WP-832 the country Twists). Independent
of both: it touches no file they touch.
**Baseline:** `origin/main` @ `4f53cf18` (2026-10-24).

## Goal

Change the Outcome of WWII prints "Setup: 7 Twists. Add an extra Villain Group." Today no loadout can be set up as
printed: the per-player-count table allows exactly 1 Villain Group at 1 player (2/3/3/4 at 2–5), and the loadout
builder, the lobby and `Game.setup` all reject one more.

A corpus scan of `data/cards/*.json` finds **14 schemes** that print the plain sentence "Add an extra Villain Group."
After this packet each of them **requires** the base count + 1 Villain Groups at every player count (2/3/4/4/5 at 1–5
players), and the base count is rejected. Every surface agrees: the loadout builder and its preview, the play lobby,
`Game.setup`, and the ranked gauntlet's approved compositions for every leg of those schemes.

The 14 (`SCHEMES_WITH_EXTRA_VILLAIN_GROUP`, set order):
`ca75/change-the-outcome-of-wwii`, `co2e/bank-robbery-hostage-crisis`, `co2e/negative-zone-prison-outbreak`,
`cvwr/predict-future-crime`, `dkcy/steal-the-weaponized-plutonium`, `dstr/war-for-the-dream-dimension`,
`dstr/cursed-pages-of-the-darkhold-tome`, `mgtg/inescapable-kyln-space-prison`, `mgtg/provoke-the-sovereign-war-fleet`,
`nmut/superhuman-baseball-game`, `rvlt/earthquake-drains-the-ocean`, `ssw1/fragmented-realities`,
`ssw1/smash-two-dimensions-together`, `ssw2/deadlands-hordes-charge-the-wall`.

## User-Visible Impact

- **Loadout builder (cards):** a WWII loadout shows "2 villain groups" at 1p (5 at 5p) and blocks export with the base
  count. The same for the other 13. Every other scheme is unchanged.
- **Play lobby:** the requirement line and the create gate say 2 at 1p for these schemes (projection-driven; no client
  change). A base-count config gets the existing mismatch message instead of reaching the server.
- **Match:** `Game.setup` rejects a base-count loadout with "A 1-player match requires 2 villain groups, but the loadout
  provides 1. Adjust the loadout composition to match the player count." A 1-player WWII match plays with both ca75
  Villain Groups (16 Villain cards), as printed.
- **Ranked gauntlet:** every leg of the 14 schemes (2 ca75 masterminds, and every mastermind of co2e, cvwr, dkcy, dstr,
  mgtg, nmut, rvlt, ssw1 and ssw2) launches with the extra group through generator-emitted `schemeOverrides`, and that
  is the approved composition a future PAR must key on. No PAR is published for any non-Core scenario (`data/par` is
  Core-only and `gauntletTruth.logic.ts` fails closed on an unpublished scenario), so no replay on these legs qualifies,
  before or after this change.

## Assumes

1. **WP-796 / D-24666 ✅** — the exact precedent, read in full: `SCHEMES_WITH_EXTRA_HENCHMAN_GROUP` +
   `resolveEffectiveHenchmenCount` (`packages/registry/src/playerCountSetup.ts` :200–245) consumed by
   `checkPlayerCountComposition` (:300–310; its villain check is :292); a REQUIRED `CardRegistry` member (`types/index.ts` :252) attached by
   `impl/localRegistry.ts` (:210) and `impl/httpRegistry.ts` (:189); an OPTIONAL `CardRegistryReader` member read with
   `?.` / `??` (`packages/game-engine/src/matchSetup.validate.ts` :85, :520–526; its villain check is :517); the server projection
   (`apps/server/src/match/matchGate.routes.ts` `projectSetupRequirements` :213–233); the viewer overrides
   (`useLoadoutDraft.ts` `requiredPlayerCountSetup` :520–540, `previewSetupRequirement.ts` :55–75); the generator's
   `schemeOverrides` (`scripts/generate-gauntlet-loadouts.mjs` :285–390) read by `getGauntletConfig` when no authored
   leg exists (`packages/registry/src/gauntletConfigs.ts` :392–440).
2. **WP-370 / D-24165 ✅** — `PLAYER_COUNT_SETUP` is the single table; base Villain Groups 1/2/3/3/4.
3. **WP-472 / WP-483 / D-24283 ✅** — `data/gauntlet-configs.json` is Core only, and no Core scheme is on the list, so
   every authored leg is unchanged. Menu overrides reach "Play this leg" and qualification with no server edit, traced at
   pre-flight:
   1. `server.mjs` :696–741 builds the per-scheme overlay from `getGauntletConfig` for every set × mastermind × scheme
      × count; with no authored leg it falls back to `getMenuSchemeOverride` (`gauntletConfigs.ts` :400–401);
   2. `gauntlet.logic.ts` :278–291 stamps each leg's `approvedLoadouts` as overlay ?? menu;
   3. `gauntletRunProgress.logic.ts` :254–263 turns that into `legLaunch[schemeSlug]` (the leg's variant 0);
   4. `MyProfilePage.vue` :842–846 prefers `legLaunch` over the per-run variant 0 that `resolveGauntletRunProgressInputs`
      (`server.mjs` :1330–1337) builds from the mastermind menu. Every override covers all five counts, so that
      fallback never fires for these legs. Qualification follows the same leg overlay (`gauntletTruth.logic.ts` :226).

   This path is **not yet exercised live**: WP-796's msp1 / vnom override legs were covered by unit tests only
   (`docs/ai/STATUS.md` :711–713). The DoD's ca75 WWII "Play this leg" item is its first live exercise; a 400 there is
   STOP-and-report.
4. **Engine villain deck** — `villainDeck.setup.ts` :214–237 adds every `villainGroupIds` entry; Villain card ids are
   set-qualified (`{setAbbr}-villain-{group}-{card}-NN`), so an extra group needs no deck change.
5. **The arena-client lobby is projection-driven** (`playerCountRequirements.ts` :64–65 reads the server row). No client
   change.
6. **Determinism:** no `G` field and no `MatchSetupConfig` field changes; the sentinel fixture plays
   `core/legacy-virus-the`; seed PAR enumerates `gauntlet-configs.json` (Core), so no seed-PAR scenario moves.

## Context (Read First)

**Rules.** "Add an extra Villain Group" means one more standard 8-card Villain Group, not a Henchman group (rules v23
:2928–2932). The 14 schemes print exactly that sentence and nothing that changes its shape. Out of scope, with the
reason each is a different shape:
- `mdns/ritual-sacrifice-to-summon-chthon` — a named group ("Add Lilin as an extra Villain Group"): card-pool work;
- `noir/five-families-of-crime` — "two extra Villain Groups" (+2), plus five split Villain Decks;
- `ssw1/crush-them-with-my-bare-hands` — "If playing solo, add an extra Villain Group" (1-player only);
- `vnom/symbiotic-absorption` — the drained Mastermind's Always Leads as the extra group;
- `msmc/open-rifts-to-future-timelines` — a Twist-time shuffle, not setup;
- `wtif/breach-the-nexus-of-all-realities` — "1-2 players: Use 3 Villain Groups" (an exact count at 1–2 players, plus
  per-Reality decks);
- mastermind extras — mastermind-keyed: mgtg Ego / Epic Ego and amwp Kang Quantum Conqueror are named follow-ups in
  WP-797 (:141–142); anni Epic Annihilus is named as a follow-up here.

**Deferral is a choice, not a limit.** The count-only parts of noir (+2), ssw1 Crush (+1 at 1 player) and wtif Breach
(exactly 3 at 1–2 players) would fit a small rule table like `SCHEME_HERO_COUNT_RULES` (the resolver already takes
`numPlayers`). They stay out so this packet mirrors D-24666 exactly; until a follow-up lands, those printed setups (and
mdns, vnom) remain unreachable in the builder and lobby.

**Ordering with WP-832.** WP-832's 2-player WWII live-verify (WP-832 :198, EC-870 :52) and any of its tests that send
"two ca75 Villain groups" at 2 players through `validateMatchSetup` with a real registry are rejected once this packet
is on main (2-player WWII needs 3 groups). WP-832's exec PR #3004 is open (its tests use mock registries without
`playerCountSetup`, so they are unaffected); after WP-833 a 2-player WWII config needs both ca75 groups plus one non-ca75
group, or a 1-player config with both ca75 groups. Whichever of the two executes second adjusts its config to base + 1.

The completeness rule is a test, not a promise: a corpus scan of every scheme ability for the sentence
"Add an extra Villain Group." must equal the list.

**Read:**
- `docs/ai/DECISIONS.md`: D-24666 (the precedent), D-24165 (table SSOT), D-24337 / D-24338 (requirement overrides),
  D-24199 / D-24278 / D-24283 (gauntlet menu, single variant, per-scheme overlay), D-24372 (runtime drift pins),
  D-11804 (API catalog), D-24026 (live-verify).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) and `.claude/rules/architecture.md` §Layer Boundary: the
  engine reaches the registry only structurally; server and viewer import the `/playerCountSetup` subpath.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §7 Match Configuration: `villainGroupIds` and `MatchSetupConfig` are
  used verbatim; the 9-field composition lock is untouched (no field is added).

**Why strict.** The D-24666 precedent (Jeff, 2026-10-07): the base count is rejected, exactly like Secret Invasion's
"6 Heroes". Every match of these schemes so far ran one group short.

**Why one WP.** As in WP-796 the requirement and the gauntlet compositions cannot ship apart: the requirement alone
makes those legs' approved compositions illegal ("Play this leg" 400s); the overrides alone are rejected by today's
engine.

**The gauntlet design.** The generator's `buildSchemeOverrides` now handles both lists: for an extra-Villain-Group
scheme it refills the villain slot with the D-24199 rule for base + 1 (anchors first, then in-set, then the Core
fallback) and keeps the base henchmen; for an extra-Henchman scheme it does the reverse (unchanged output). The guard
now checks each slot: unchanged, or a superset with exactly one more id; the duplicate-slug guard is kept. The authored
slice in `getGauntletConfig` and the pool-length check in `validateGauntletConfigs` also use the Villain resolver, so a
future authored leg's approved composition is scheme-aware (no current data path). Seed PAR is NOT: its
`enumerateScenarios` (`scripts/generate-seed-par.mjs` :289–300) slices by the base table and maps counts back through
`VILLAIN_COUNT_TO_PLAYER_COUNT` (:113, no entry for 5). Before any authored leg uses a listed scheme, seed PAR must
become scheme-aware (a named follow-up).

## Non-Negotiable Constraints

**Engine-wide:** no `Math.random()`, no I/O in moves or helpers; moves never throw, only `Game.setup()` may; `G` stays
JSON-serializable; ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test`; no `boardgame.io` import in helpers or
tests; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (full-word names, JSDoc on every function, no nested
ternaries, no branching `.reduce()`); full file contents for every new or modified file — no diffs, no snippets; no new npm dependency, no
`package.json` change.

**Packet-specific:**
- **Session protocol:** if anything here contradicts the code at baseline, STOP and ask.
- **One definition.** `SCHEMES_WITH_EXTRA_VILLAIN_GROUP` and `resolveEffectiveVillainGroupCount` live ONLY in
  `playerCountSetup.ts`. The engine reaches the resolver structurally; the server and viewer import the
  `@legendary-arena/registry/playerCountSetup` subpath; the generator keeps a drift-pinned copy (it runs before any
  build). No other production file encodes the list or the `+ 1`.
- **Requirement side, not build side.** No `schemeSetupSizing` transform. `PLAYER_COUNT_SETUP` is never mutated.
- **Exactly base + 1.** Base, or base + 2, is a mismatch. Every unlisted scheme is byte-identical.
- **The engine fallback stays:** `registry.resolveEffectiveVillainGroupCount?.(…) ?? row.villainGroupCount`.
- **The gauntlet change flows through `getGauntletConfig` only.** No edit to `server.mjs`, `gauntlet.logic.ts`,
  `gauntletRunProgress.logic.ts`, `legends.publisher.ts`, `loadoutGauntletPackImport.ts`, `gauntletQualificationCheck.ts`
  or `LoadoutBuilder.vue`; a needed code edit there is STOP.
- **Generated files** change only through `pnpm gauntlet:loadouts` / `pnpm gauntlet:configs`. The menu diff is additive
  (new `schemeOverrides` entries only).
- **Existing tests pass without edits, EXCEPT these four, observed failing in the scaffold** (all assume only the
  Henchman list emits overrides; the commit carries a `Tests-changed:` trailer naming them):
  - `gauntletLoadouts.test.ts` "the emitted schemeOverrides keys equal SCHEMES_WITH_EXTRA_HENCHMAN_GROUP (drift pin)" →
    counts only overrides whose henchmen grow;
  - `gauntletLoadouts.test.ts` "every scheme override is the base composition plus one distinct-slug henchmen group" →
    checks both slots at their effective counts (renamed "… plus one distinct-slug group on each extended slot");
  - `gauntletLoadouts.test.ts` "menus for masterminds without an extra-Henchman scheme carry no schemeOverrides key" →
    either list (renamed "… extra-Henchman or extra-Villain-Group scheme …");
  - `gauntletConfigs.test.ts` "leaves every unlisted leg as before …" → skips the extra-Villain-Group schemes too.

  Any other failing existing test is STOP-and-report.
- **Sentinel / replay oracles unchanged.** `finalStateHash` and `PRE_WP080_HASH` stay byte-identical; a moved oracle is
  a leak, never a re-pin.

## Locked Contract Values

- **Registry** (`playerCountSetup.ts`): `export const SCHEMES_WITH_EXTRA_VILLAIN_GROUP: readonly string[]` = the 14 ids
  in §Goal order; `export function resolveEffectiveVillainGroupCount(schemeId: string, numPlayers: number,
  baseVillainGroupCount: number): number` returns `base + 1` for a listed id, else `base` (`numPlayers` unused, signature
  parity). `checkPlayerCountComposition` compares `villainGroupIds.length` to
  `resolveEffectiveVillainGroupCount(input.schemeId ?? '', input.playerCount, row.villainGroupCount)`; the mismatch's
  `required` carries it.
- **`CardRegistry`** (`types/index.ts`): REQUIRED `resolveEffectiveVillainGroupCount(schemeId: string, numPlayers:
  number, baseVillainGroupCount: number): number`, attached by both impls.
- **Engine** (`matchSetup.validate.ts`): OPTIONAL `CardRegistryReader.resolveEffectiveVillainGroupCount?`; the villain
  check uses `registry.resolveEffectiveVillainGroupCount?.(schemeId, numPlayers, row.villainGroupCount) ??
  row.villainGroupCount`. The error message is the existing `checkCompositionCount` sentence (unchanged).
- **Server** (`projectSetupRequirements`): each row also sets `villainGroupCount:
  resolveEffectiveVillainGroupCount(schemeId, numPlayers, row.villainGroupCount)`; empty `schemeId` returns the table.
- **Viewer:** `requiredPlayerCountSetup` and `resolveSetupRequirement` set `villainGroupCount` through the resolver.
- **`getGauntletConfig`** authored leg →
  `villainPool.slice(0, resolveEffectiveVillainGroupCount(\`${setAbbr}/${schemeSlug}\`, playerCount, setupRow.villainGroupCount))`;
  no authored leg → the menu's `schemeOverrides` (unchanged branch). **`validateGauntletConfigs`** rejects a `villainPool` shorter than
  `resolveEffectiveVillainGroupCount(id, 5, PLAYER_COUNT_SETUP[5].villainGroupCount)` with a full sentence naming set,
  mastermind and scheme ("… requires N Villain Groups at 5 players …").
- **Generator:** a duplicated `SCHEMES_WITH_EXTRA_VILLAIN_GROUP`; `buildSchemeOverrides(set, mastermindSlug,
  baseVariant, villainPools, henchmanPools)` emits an override for a scheme on either list, refilling only the extended
  slot(s) with `fillGroupSlots(…, base + 1, …)`; `GenerationError` unless each slot equals the base or is a superset
  with exactly one more id, or on a duplicate slug.
- **Expected WWII override** (both ca75 masterminds, arnim-zola and baron-heinrich-zemo; STOP if the generated output
  differs): 1p `ca75/masters-of-evil-wwii`, `ca75/zolas-creations`; 5p + `co2e/brotherhood-of-mutants`,
  `co2e/enemies-of-asgard`, `co2e/hydra`; henchmen = the base menu's.
- **`data/gauntlet-configs.json` `slicing.note`** gains one sentence: the villain slice uses the scheme-effective count
  too, and no authored leg uses such a scheme today.
- **`GauntletLoadoutMenu.schemeOverrides`** doc (`gauntletLoadouts.ts`) names both rules; the type is unchanged.
- **API catalog row** (`docs/ai/REFERENCE/api-endpoints.md`, `GET /api/match/setup-requirements`), replaced whole:
  Status `Wired`, `GET`, Auth `guest`, request and response schemas unchanged; Authorizing WP appends `WP-833 / D-24766
  (scheme-aware villainGroupCount)`; Path unchanged; Notes add, beside the henchmen sentence, that each row's
  `villainGroupCount` is projected through `resolveEffectiveVillainGroupCount` (WP-833 / D-24766 — the 14
  `SCHEMES_WITH_EXTRA_VILLAIN_GROUP` schemes, e.g. Change the Outcome of WWII, require base + 1), with the rest carried
  forward.
- **Long functions:** `checkPlayerCountComposition`, `validatePlayerCountComposition` and the generator's
  `buildSchemeOverrides` grow past ~30 lines by the mirrored block; that is accepted (a single-use helper split would be
  out of scope).

## Scope (In)

- **A) Registry:** `playerCountSetup.ts`; `types/index.ts`; `impl/localRegistry.ts`, `impl/httpRegistry.ts`;
  `gauntletConfigs.ts` (authored slice, pool check, module docs); `gauntletLoadouts.ts` (doc only); the two generated
  modules (regenerated).
- **B) Engine:** `matchSetup.validate.ts`.
- **C) Server:** `matchGate.routes.ts`; the API catalog row.
- **D) registry-viewer:** `useLoadoutDraft.ts`, `previewSetupRequirement.ts`.
- **E) Gauntlet tooling and data:** `scripts/generate-gauntlet-loadouts.mjs`; `data/gauntlet-configs.json` (note only).
- **F) Tests:**
  - `playerCountSetup.test.ts`: the list pin (14, in order); a corpus scan equal to the list; no overlap with the
    Henchman list; the resolver 2/3/4/4/5 for each id and base for unlisted / empty / out-of-scope ids; no mutation;
    `checkPlayerCountComposition` WWII 1p with 1 → one mismatch (required 2), 2 → none, 3 → mismatch, 5p with 4 →
    required 5 and 5 → none, Midtown 1p with 1 → none.
  - `gauntletLoadouts.test.ts`: the three mandated edits; a new villain drift pin (overrides whose villains grow equal
    the list).
  - `gauntletConfigs.test.ts`: the mandated edit; every listed scheme's every in-set mastermind returns the menu override
    with base henchmen and base + 1 villains (a superset); the named WWII villains at 1p and 5p; a synthetic authored
    WWII leg with a 4-entry pool is rejected and passes with 5.
  - `matchSetup.contracts.test.ts`: an override mock rejects a 1-group 1p config with exactly the message above and one
    error, accepts 2 groups; an unlisted scheme keeps the base; a table-only mock keeps the base count.
  - `matchGate.routes.test.ts`: `?schemeId=ca75/change-the-outcome-of-wwii` projects `villainGroupCount` 2/3/4/4/5 with
    base Henchman and hero counts; no `schemeId` / Midtown keeps 1/2/3/3/4.
  - `useLoadoutDraft.test.ts`, `previewSetupRequirement.test.ts`: the WWII required row shows 2 at 1p (5 at 5p); a
    1-group WWII draft is not ready (required 2, actual 1); 2 groups are ready; Midtown unchanged.
- **Non-vacuous:** reverting each of these fails at least one new test (report 6/6): (a) the registry resolver's `+ 1`;
  (b) the engine villain check; (c) the server projection's `villainGroupCount`; (d) the viewer's `villainGroupCount`
  override (the "required row shows 2" cases); (e) the generator's villain refill (the villain drift pin and the
  override cases, after `pnpm gauntlet:loadouts`); (f) `validateGauntletConfigs`' villain pool check.

## Out of Scope

- The five different-shape schemes and the mastermind extras listed in §Context (named follow-ups).
- Any arena-client file, any `G` field, any `MatchSetupConfig` field.
- `content/themes/red-skull-classic.json` (WWII, 2 villain groups) and `doctor-strange-sorcerer.json` (War for the Dream
  Dimension, 2) and `five-families-of-crime.json` (Steal the Weaponized Plutonium, 2): themes are setup intent with free player counts and are not validated against the table (the WP-796
  Venom-theme precedent); a named follow-up.
- The legends-board requirement list (`GauntletBoardPanel.vue`) reads the per-mastermind menu, so it shows the base
  Villain count for these legs (display-only; the WP-796 follow-up of the same shape). `scripts/gauntlet-post-block.mjs`
  :192–194 prints the base per-count table the same way.
- The stale "`undefined` for non-Core" comments in `server.mjs`, `LoadoutBuilder.vue` and
  `gauntletQualificationCheck.ts` (the WP-796 follow-up).
- Seed PAR and the diagnostic PAR profiles (Core-only scenarios; no listed scheme is Core). Seed PAR's
  `enumerateScenarios` stays base-count; making it scheme-aware is a named follow-up, required before any authored leg
  uses a listed scheme.
- Autoplay, guest solo and the featured table (they default to Midtown Bank Robbery).

## Files Expected to Change

- `packages/registry/src/playerCountSetup.ts` — modified — list + resolver + villain check
- `packages/registry/src/playerCountSetup.test.ts` — modified — new cases
- `packages/registry/src/types/index.ts` — modified — `CardRegistry` member
- `packages/registry/src/impl/localRegistry.ts` — modified — attach resolver
- `packages/registry/src/impl/httpRegistry.ts` — modified — attach resolver
- `packages/registry/src/gauntletConfigs.ts` — modified — effective villain slice, villain pool check, docs
- `packages/registry/src/gauntletConfigs.test.ts` — modified — mandated edit + new cases
- `packages/registry/src/gauntletConfigs.generated.ts` — regenerated (`pnpm gauntlet:configs`)
- `packages/registry/src/gauntletLoadouts.ts` — modified — `schemeOverrides` doc
- `packages/registry/src/gauntletLoadouts.test.ts` — modified — mandated edits + villain drift pin
- `packages/registry/src/gauntletLoadouts.generated.ts` — regenerated (`pnpm gauntlet:loadouts`)
- `packages/game-engine/src/matchSetup.validate.ts` — modified — structural member + villain check
- `packages/game-engine/src/matchSetup.contracts.test.ts` — modified — new cases
- `apps/server/src/match/matchGate.routes.ts` — modified — projection
- `apps/server/src/match/matchGate.routes.test.ts` — modified — new cases
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — modified — villain override
- `apps/registry-viewer/src/composables/useLoadoutDraft.test.ts` — modified — new cases
- `apps/registry-viewer/src/lib/previewSetupRequirement.ts` — modified — villain override
- `apps/registry-viewer/src/lib/previewSetupRequirement.test.ts` — modified — new cases
- `scripts/generate-gauntlet-loadouts.mjs` — modified — villain list + two-slot overrides + guards
- `data/gauntlet-configs.json` — modified — `slicing.note`
- `docs/ai/REFERENCE/api-endpoints.md` — modified — setup-requirements row replaced whole
- Governance:
  - `docs/ai/STATUS.md` — modified — the WP-833 entry
  - `docs/ai/DECISIONS.md` — modified — D-24766 appended as Active
  - `docs/ai/work-packets/WORK_INDEX.md` — modified — the row flips to `[x]`
  - `docs/ai/execution-checklists/EC_INDEX.md` — modified — EC-871 → Done
  - `docs/05-ROADMAP-MINDMAP.md` — modified — node `✅` + regenerated counts

No other files. Line-ending-only build churn (e.g. `packages/lagn-spec/schemas/lagn-v1.json`) is reverted.

## Scaffold (observed at drafting, REQUIRED evidence)

The production change (§A–§E, no new tests) was implemented on the baseline and the whole repo run:
- `pnpm -r build` exit 0; `pnpm gauntlet:loadouts` wrote 110 menus with no `GenerationError` (no slug collision), the
  diff additive only; `gauntlet:loadouts:check` OK.
- `pnpm -r --no-bail test`: **only** the four tests named in §Constraints failed (registry 295 / 4). Every other package
  was identical to the baseline, 0 fail: game-engine 5672, server 1836, registry-viewer 329, arena-client 2435, dashboard
  584, legends-board 138, lagn-spec 108, preplan 52, engine-runner 20, vue-sfc-loader 11, replay-producer 4.
- With the §F tests added, each touched file's suite passed in isolation (playerCountSetup 46, gauntletLoadouts 12,
  gauntletConfigs 28, matchSetup.contracts 75, matchGate.routes 18, the two viewer files 63).
- **Locked post-execution counts** (`pnpm -r --no-bail test`, 0 fail everywhere): registry 295 → 310 (+15), game-engine
  5672 → 5676 (+4), server 1836 → 1838 (+2), registry-viewer 329 → 335 (+6); every other package unchanged. The menu
  diff is +397 / −0: 47 new `schemeOverrides` entries across 34 menus (56 in total with the 9 pre-existing Henchman
  ones), each covering 1–5 players (corrected at execution; the draft said 56 new). A different count is STOP-and-report.

## Contract

- For the 14 listed schemes every enforcement surface requires exactly base + 1 Villain Groups; for every other scheme
  nothing changes.
- Every ranked gauntlet leg of a listed scheme has an approved composition, produced by `getGauntletConfig`, that is legal
  under that rule at every player count.

## Acceptance Criteria

1. `resolveEffectiveVillainGroupCount(id, n, base)` is `base + 1` for each listed id at n = 1..5, and `base` otherwise;
   the list equals the corpus scan.
2. `checkPlayerCountComposition` reports a `villainGroupIds` mismatch (required 2) for a 1p WWII config with 1 group,
   none with 2, a mismatch with 3; a 1p Midtown config with 1 group has none.
3. `validateMatchSetup` with a resolver-bearing registry rejects a 1-group 1p config for an override scheme with "A
   1-player match requires 2 villain groups, but the loadout provides 1. …" and accepts 2; a table-only mock keeps the
   base.
4. `GET /api/match/setup-requirements?schemeId=ca75/change-the-outcome-of-wwii` returns `villainGroupCount` 2/3/4/4/5;
   without `schemeId` the base table.
5. The registry-viewer required row and preview show 2 Villain Groups for a 1p WWII loadout; a 1-group WWII draft is not
   ready; Midtown unchanged.
6. `getGauntletConfig` for every leg of a listed scheme returns base henchmen and base + 1 villains (a superset of the
   menu's); WWII's are the locked ids.
7. Every other `getGauntletConfig` result and every menu entry outside the ten affected sets is byte-identical; both
   gauntlet `:check` scripts exit 0.
8. The sentinel `finalStateHash` / `PRE_WP080_HASH` are unchanged; the only edited existing assertions are the four
   mandated ones.

## Verification Steps

```pwsh
pnpm gauntlet:loadouts; pnpm gauntlet:configs
pnpm gauntlet:loadouts:check && pnpm gauntlet:configs:check
git diff --numstat -- packages/registry/src/gauntletLoadouts.generated.ts
# Expected: exit 0; "397 0" — 47 schemeOverrides added (34 menus) (ca75, co2e, cvwr, dkcy, dstr, mgtg, nmut, rvlt, ssw1, ssw2)
pnpm -r build
pnpm -r --no-bail test
# Expected: 0 failures; registry 310, game-engine 5676, server 1838, registry-viewer 335, others unchanged
pnpm --filter registry-viewer typecheck
pnpm --filter @legendary-arena/game-engine exec node --import tsx --test "src/test/fixtures/replayFixtures.test.ts"
git diff --exit-code -- packages/game-engine/src/test/fixtures/games
pnpm ledger:numbers:check; pnpm roadmap:counts:write; pnpm roadmap:counts:check
git status --porcelain
# Expected: each exits 0; only the §Files Expected to Change allowlist
```

## Definition of Done

- [ ] ACs 1–8 pass; revert proofs 6/6 reported.
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail with per-package counts; registry-viewer typecheck 0; both
      gauntlet `:check` 0; replay oracles byte-identical.
- [ ] `git status --porcelain` ⊆ the allowlist. Two-commit topology `EC-871:` then `SPEC:`.
- [ ] Before the `EC-871:` commit, an independent subagent reviews the final diff against EC-871 (compensates for one
      session drafting and executing); its verdict is recorded in STATUS.md.
- [ ] STATUS.md updated; D-24766 authored in DECISIONS.md as Active (the five points below); WORK_INDEX `[x]` with date;
      EC_INDEX Done; mindmap `📝` → `✅`; `pnpm roadmap:counts:write`, `roadmap:counts:check` and
      `ledger:numbers:check` 0.
- [ ] **D-24026 live-verify (REQUIRED, after deploy; operator-pending until seen):** first,
      `GET https://<server>/api/match/setup-requirements?schemeId=ca75/change-the-outcome-of-wwii` returns
      `villainGroupCount` 2/3/4/4/5 (the executing session can check this itself); then the cards loadout builder shows 2
      Villain Groups for a 1p WWII loadout and exports with 2; a 1p WWII match created from it starts (both ca75
      groups in the Villain Deck); a ca75 WWII gauntlet "Play this leg" launches with 2 Villain Groups at 1p; the play
      lobby shows 2 for a 1p WWII config after a hard refresh (`Cache-Control: max-age=3600`). Record the matchId in
      STATUS.md.

## Reserved Decision (lands at execution)

**D-24766 — extra-villain-group.** Five points:
1. **A requirement override, strict.** The 14 schemes that print the plain sentence "Add an extra Villain Group."
   require exactly base + 1 Villain Groups at every player count; the base count is rejected. The list is closed and
   pinned to a corpus scan.
2. **One definition.** List and resolver in `playerCountSetup.ts`; the engine reaches it structurally with a base
   fallback; the server projection and the loadout builder read the same resolver; the generator's copy is drift-pinned
   through its output.
3. **Gauntlet compositions follow the rule.** Menu-fallback legs use generator `schemeOverrides` (base plus the next
   villain group in D-24199 fill order), a single approved composition per leg and count (the D-24278 single variant). The approved villain segment of these legs changes. No PAR is published for any
   non-Core scenario, so no replay on these legs qualifies before or after; this sets the approved composition a future
   PAR must key on. The authored slice and pool check are scheme-aware for a future authored leg; seed PAR's
   `enumerateScenarios` is not, and must be made scheme-aware before any authored leg uses a listed scheme.
4. **Not covered** (named follow-ups): the named-group (mdns Lilin), +2 (noir Five Families), solo-only (ssw1 Crush Them),
   drained-mastermind (vnom Symbiotic Absorption) and Twist-time (msmc Open Rifts) shapes; the mastermind extras (anni,
   mgtg ×2, amwp); wtif Breach the Nexus (exactly 3 at 1–2 players); the three themes; the legends-board list and
   `gauntlet-post-block.mjs`; a scheme-aware seed-PAR `enumerateScenarios`.
5. **No migration.** Matches in progress keep their setup. Saved and exported base-count loadouts for these schemes become
   invalid and are flagged by the builder and the lobby when loaded, not rewritten. Play Again from a pre-deploy
   base-count match of these schemes returns the setup 400 ("A 1-player match requires 2 villain groups …"); the player
   rebuilds the loadout. A completed pre-deploy match still
   verifies (the D-24119 replay re-runs its stored `initialState`; setup validation does not re-run).

## Vision Alignment

- **Clauses touched:** §1 / §2 faithful setup (printed text applies); §3 / §23 fairness and leaderboards (no non-Core PAR is
  published, so no replay on these legs qualifies before or after; the approved composition a future PAR must key on
  changes); §10a Registry Viewer (required row and export gate); §19b saved / exported base-count loadouts are
  flagged on load, not rewritten; §8 / §22 determinism (no `G` change; sentinel untouched); §24 competitive integrity (no seed-PAR scenario
  moves: all Core-only).
- None of NG-1..NG-8 is crossed. **Conflict assertion:** no conflict; rules fidelity only, no monetization surface.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 sections; Out of Scope lists the related exclusions |
| §2 | PASS — engine-wide rules incl. "no diffs, no snippets" (fix B2), packet rules, session protocol, Locked Values |
| §3 | PASS — WP-796 / D-24666, WP-370 / D-24165, WP-472 / WP-483 / D-24283 anchored; the "Play this leg" trace |
| §4 | PASS — §Context **Read:** block with DECISIONS scan list, ARCHITECTURE / rules §Layer Boundary, 00.2 §7 (fix B1) |
| §5 | PASS — closed allowlist, generated modules marked regenerated, governance files described |
| §6 | PASS — canonical names, 9-field lock untouched; the wrapped Locked Value rejoined (fix B3) |
| §7 | PASS — no new dependency, no `package.json` change |
| §8 | PASS — one registry definition, structural engine read, subpath imports, drift-pinned generator copy |
| §9 | PASS — `pwsh` verification |
| §10 | N/A — no environment variable |
| §11 | N/A — setup-requirements stays `guest`; no auth code |
| §12 | PASS — `node:test`, mock registries / fake pool, 6/6 revert proofs, sentinel pinned |
| §13 | PASS — exact commands, locked counts and the `397 0` menu numstat |
| §14 | PASS — 8 binary ACs |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes, allowlist check, independent diff review, live-verify with matchId |
| §16 | PASS — JSDoc, full-sentence errors, no nested ternary; the long-function growth noted in Locked Values |
| §17 | PASS — clauses exist in `01-VISION.md`; NG check, no-conflict and determinism lines |
| §18 | N/A — no literal-string grep in Verification |
| §19 | N/A at lint — commit-time discipline |
| §20 | N/A — the touched surfaces carry no funding affordance or donate copy |
| §21 | PASS — the setup-requirements row replaced whole (D-11804); `Wired` / `guest` in the closed sets |

EC-871 vs EC-TEMPLATE: PASS (69 content lines); Locked Values agree with the WP. **Verdict:** PASS after B1-B3.

## Gate Record

**Pre-flight (01.4) (independent subagent): READY TO EXECUTE after two blocking text fixes, applied in scope (no
re-run needed).** It independently re-ran the touched suites in the scaffold worktree (registry 310 / 0, game-engine
5676 / 0, server 1838 / 0, registry-viewer 335 / 0 and typecheck 0, both gauntlet `:check` OK, `par:seed:test` 2 / 0,
`themes:check-slugs:check` 0 unresolved), ran the baseline copies of the two gauntlet test files against the new source
(exactly the four mandated tests fail, 32 pass), validated all 56 overrides (47 new: villains +1, henchmen +0; 9 pre-existing Henchman ones unchanged; no duplicate
slug, WWII ids as locked), re-ran the corpus scan (exactly the 14), and traced "Play this leg" end to end.
- **PS-1 (blocking, fixed):** §Assumes 3 claimed the WP-796 live-verify proved the menu-override path; STATUS :711–713
  says it was unit-tested only → the four-step trace, and the DoD's WWII "Play this leg" is marked its first live
  exercise (a 400 is STOP).
- **PS-2 (blocking, fixed):** locked post-execution counts added to §Scaffold and the EC.
- Non-blocking, applied: RS-1 wtif Breach the Nexus named out of scope; RS-2 the mastermind-extra attribution; RS-3 the
  third theme; RS-4 `gauntlet-post-block.mjs`; RS-5 the WP-832 ordering note; RS-6 the deferral stated as a choice;
  RS-7 the WORK_INDEX links; RS-8 anchors; RS-9 "single approved composition" in D-24766 §3.

**Copilot (01.7) (independent subagent): round 1 RISK → HOLD; delta re-run PASS → CONFIRM** (it verified all six
fixes; its one leftover, stale §Vision wording on §3 / §23, applied). It checked the scaffold
diff file by file against the WP / EC and the style rules (one definition, the engine fallback, both impls, the
projection, both viewer sites, the two-slot generator and guards, the authored slice and pool check; the single
template-string ternary is allowed), and confirmed the four mandated test edits lose no coverage.
- **#1 (blocking, fixed):** seed PAR's `enumerateScenarios` slices by the base table, so the "future authored leg" claim
  was too strong → §Context reworded to "approved composition", seed PAR named in §Out of Scope and D-24766 §3 / §4.
- Non-blocking, applied: #2 no non-Core PAR, so no replay on these legs qualifies either way (Impact and D-24766 §3);
  #3 Play Again from a pre-deploy base-count match returns the setup 400 (D-24766 §5); #4 the EC corpus-scan smell now
  says to confirm a new match is unconditional; #5 PR #3004 named in the WP-832 ordering note; #9 an independent
  pre-commit review of the final diff added to the DoD and the EC. #6 (gate records) is this section.

**Lint (00.3) (independent subagent): FAIL → PASS.** Final Gate #7 / #8 fired on §4 (no **Read:** block, no 00.2
citation) → fixed (B1); B2 "no diffs, no snippets"; B3 a Locked Value split by a line wrap. Advisory, applied: A1 / A2
the EC's pool-check wording, API row, `slicing.note` and mindmap in Files to Produce; A3 governance file descriptions;
A4 locked counts and the menu numstat in Verification; A5 the setup-requirements curl as the first live-verify item;
A6 the long-function note; A7 the catalog Notes wording; A8 the WORK_INDEX dependency. Noticed and left as follow-ups:
the stale `/api/me/gauntlet-runs` catalog Notes (since WP-796) and WP-831's "part 1 of 2" row wording.

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.
