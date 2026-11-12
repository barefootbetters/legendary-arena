# WP-886 — Hero Conqueror: "<Space> Conqueror N" gives +N Attack if a Villain is in that City space (Game Engine + Card Data)

**Status:** Draft 2026-11-11
**Primary Layer:** Game Engine (one new hero condition, a setup-parser line form) + Card Data (Conqueror text restored on 13 lines)
**Dependencies (all ✅):**
- WP-881 / D-24832 (hero Patrol: the City-space conditions, `patrolSpaceIndex`, `buildPatrolBranchHook`, the Synergy exclusion and failed-board-condition clause rule, the by-hook ledger classification this packet mirrors)
- WP-831 / D-24764 (a City of 1-6 spaces; a removed space does not exist)
- WP-489 / D-24295 (`CITY_SPACE_NAMES`, Sewers(0) … Bridge(4))
- WP-633 / D-24443 (`data/cards` re-derives from the pipeline; `cards:check`)
- D-24623 (honest hollow slugs), D-24570 (parsed-grant suppression)

**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM — gameplay rules (one new hero condition, a setup-parser line form) plus card data and derived feeds; no auth, money, persistence or server surface
**Lane:** Standard (two-session). Parser + evaluator + card data + regenerated feeds; not lightweight-eligible (new grants on ranked-reachable cards, > 4 code/test files).

> Baseline: `origin/main` at `73120510` (after the reserve #3293 and WP-884 #3294). Engine suite at the baseline: **6960 / 6960 pass**. The gates and the scaffold ran at `aad52201` (6930 / 6930); WP-884 touched only `heroEffects.execute.ts` among the anchored files (anchors re-measured, Gate Record).

---

## Goal

Legendary's **Conqueror** keyword (rules v23 L1150-1159):

- Enemies: "Rooftops Conqueror 2" means "This gets +2 [Attack] while any Villain is on the Rooftops."
- **Heroes:** "Hero cards also say things like 'Bridge Conqueror 1,' meaning 'You get +1 [Attack] if any Villain is on the Bridge.'"
- A destroyed City space no longer exists, so "card effects won't do anything that say 'If there is a Villain on the Rooftops...' (like Conqueror)" (L1481-1485).

**Today** (parser probe at the baseline):
- **Every hero Conqueror line is hollow.** No line grants anything. `amwp/jentorra`, `anni/heralds-of-galactus`, `anni/super-skrull`, `asrd/valkyrie` and `asrd/warriors-three-the` read `conqueror` = `unsupported` in the hero-mechanic ledger.
- **Four lines lost their City space and number.** `anni.patch.json` and `asrd.patch.json` overwrote the converter's correct text with a bare `[keyword:Conqueror]` on Rock Solid ("[hc:strength]: Sewers Conqueror 1" on the card), Transparent Motives ("Bank Conqueror 1"), Stardust ("Focus 4 → Rooftops Conqueror 4") and Volstagg the Valiant ("[hc:instinct]: Instead, Bridge Conqueror 3"). Checked against the card images and the upstream source (`inputs/cards/annihilation.js:422,445,247`, `heroesofasgard.js:357`: `{ keyword: 49, text: "Sewers Conqueror 1." }` etc.).
- **Seven lines are split into two tokens** (`[keyword:Bridge] [keyword:Conqueror] 1`) by the same patches. That split makes phantom `bridge` / `streets` / `rooftops` ledger rows for Super-Skrull, Valkyrie and the Warriors Three. One of them also names the wrong space: Flying Stallion prints **Rooftops** Conqueror 1 (card image; `heroesofasgard.js:270`), and `asrd.patch.json:10` says Streets.
- **Two lines are invisible.** `amwp/freedom-fighters` Steel Warrior ("Streets Conqueror 1") and Xolum ("Bridge Conqueror 1") print plain text with no `[keyword:]` token, so the parser drops them silently and the ledger has no Conqueror row for the hero.

**After this session:**
1. **One board-state condition.** `conquerorSpaceHasVillain` (value = the `CitySpaceName`) is true when that City space exists and holds a card, read from `G.city` as the hook resolves.
2. **Pure Conqueror lines parse as gated attack hooks.** A line that is only `[gate:] [keyword:<Space> Conqueror N]` becomes one hook granting +N Attack under the line's gate plus `conquerorSpaceHasVillain`. Sixteen lines on fourteen cards.
3. **"Instead" upgrades.** Volstagg's "[hc:instinct]: Instead, Bridge Conqueror 3" becomes a +2 hook under instinct plus the Bridge condition, on top of the base +1.
4. **Card data restored.** All 13 damaged or untokened hero lines carry the canonical `[keyword:<Space> Conqueror N]` form.
5. **Honest hollows.** A Conqueror token inside another mechanic's line grants nothing, as today. The recorded slugs follow the existing D-24623 fallback (`heroAbility.setup.ts:3047-3058`, which adds unmatched slugs only when no other marker was recorded): Put to the Torch line 2 → `rooftops-conqueror` (today `rooftops`, `conqueror`); Dragonfang line 0 → `thrown-artifact`, `sewers-conqueror` (unchanged); Stardust line 0 → `focus` only (today `focus`, `conqueror`; its Conqueror token is dropped because `focus` is recorded first). No parser change for these.

## User-Visible Impact

- Playing a Conqueror hero while a Villain is in the named City space adds the Attack: Put to the Torch gives +1 with a Villain on the Bridge and +1 more with one in the Streets; Firelord gives +2 with the Bridge occupied after another Ranged Hero; Volstagg gives +1, or +3 after another Instinct Hero.
- With the space empty, nothing is added and the log reads, e.g., "Player 0's Transparent Motives did not activate one of its abilities — no Villain is in the Bank." (Most Card Map cards build more than one hook, so they log the executor's multi-hook phrase, `heroEffects.execute.ts:1177`; a single-hook card such as Unite the Oppressed logs "… ability did not activate — no Villain is in the Sewers.")
- The play log and in-game card text show the restored text ("Sewers Conqueror 1" where it read a bare "Conqueror"). The card viewer (cards.legendary-arena.com, read from R2) shows it after the operator's post-merge `pnpm metadata:upload` (DoD).

---

## Assumes

1. **Parser** (`packages/game-engine/src/setup/heroAbility.setup.ts`, at the baseline):
   - `KEYWORD_PATTERN` `:154` never matches a multi-word token. `collectUnmatchedKeywordSlugs` `:3283` turns `[keyword:Bridge Conqueror 1]` into `bridge-conqueror` (number dropped).
   - Patrol imports `:51-52`; `PATROL_LINE_PATTERN` `:909` (gate prefix `((?:\[(?:hc|team):[^\]]+\]\s*)*:?\s*)`); `PATROL_NAMED_SPACE_PATTERN` `:915`.
   - `parseAbilityText` `:1262`; `buildHookFromParsedAbility` `:4791`; `buildPatrolBranchHook(cardId, gatePrefix, branchBody, conditionType, spaceName, hollowSlug)` `:4837` (parses `<gate> <body>`, appends `{type, value: spaceName}`, adds `conditional` once, records the hollow slug when the body resolves nothing, omit-when-empty construction).
   - Per-line loop in `buildHeroAbilityHooks` `:4948`; the Patrol consume block `:5106-5113` and the `PATROL_BOTH_CARDS` block `:5114-5128` (`previousLineHook = null` after a consumed line).
2. **Conditions** (`hero/heroConditions.evaluate.ts`): the `*_CONDITION_TYPE` export pattern (`PATROL_SPACE_OCCUPIED_CONDITION_TYPE` `:72`); `patrolSpaceIndex(G, spaceName)` `:91` (−1 for an unknown name, a non-array `G.city` or an index `>= G.city.length`); `describeFailedPatrolCondition` `:107`; `evaluateCondition` `:186` (Patrol cases `:541` / `:553`); `describeFailedCondition` `:978` (Patrol cases `:1119-1122`); `SEQUENCE_GATE_CONDITION_TYPES` `:1146`. `WAIT_AND_SEE_CONDITION_TYPES` `hero/deferredConditionalGrants.ts:79`.
3. **Execution** (`hero/heroEffects.execute.ts`): Patrol imports `:38-39`; `isCountableConditionalClause` `:1031-1034`; `countSynergyConditions` `:1527` (excludes day/night and both Patrol types); `allPatrolConditionsPass` `:1557` (one caller, `:1034`); `heroEffectAttack` `:1997`.
4. **City contents.** `G.city` is `CitySpace[]` (`CardExtId | null`, length 1-6, `board/city.types.ts`). Every writer either places a Villain (villain, henchman, a converted stack villain typed `'villain'`, or a Mandarin's Ring) through `pushVillainIntoCity` or a swap / move of an existing occupant (`villainDeck.reveal.ts:288,913`, `villainDeck.enterCity.ts:52,116`, `moves/mandarinRingEntry.logic.ts:365`, `moveVillainChoice.resolve.ts`, `villainEffects.execute.ts:4804`), clears a space (`fightVillain.ts:621`, `operatorSetters.ts:458-460`, `schemeTwistResolvers.ts:1121`, `villainEffects.execute.ts:4873`), or builds an empty City (`scheme/schemeSetup.execute.ts:123`, `rules/changeTheOutcomeOfWwii.logic.ts:150`). Locations are not in `G.city`. So "a card is in the space" ⇔ "a Villain is in the space".
5. **Card data.**
   - `scripts/convert-cards/inputs/patches/anni.patch.json` hero `abilities` overrides: Stardust `:95`, Rock Solid `:170`, Transparent Motives `:178`, Put to the Torch `:186-188`.
   - `scripts/convert-cards/inputs/patches/asrd.patch.json`: Flying Stallion `:10`, Usher to Valhalla `:17`, Ride of the Valkyries `:24`, Volstagg the Valiant `:43-44`. Its villain lines (`:94` onward) are not touched.
   - `data/cards/amwp.json` is an outlier base (`docs/03-DATA-PIPELINE.md`: produced by `apply-card-counts.mjs` from the committed file): Steel Warrior `:847`, Xolum `:862`. `scripts/convert-cards/inputs/patches/amwp.patch.json:438,453` and `amwp_patch.json` still print the plain text, but for outlier sets `apply-card-counts.mjs:313-345` reads only `imageUrl` from them, so their `abilities` are inert and are **not** edited.
   - The converter renders `{ keyword: N, text: "…" }` as `[keyword:<text>]` (`convert-cards-v15.mjs:671`); amwp Jentorra, Firelord, Dragonfang and Three Stand as One already print `[keyword:<Space> Conqueror N]`.
6. **Ledger.** `scripts/hero-mechanic-ledger.mjs` imports the Patrol constants from the engine dist `:62-67`; `KNOWN_CONDITIONS` `:192` (`'patrol'` `:235`); `patrolStatusForHooks` `:332`; the per-hook check `:601` runs before `statusForMechanic` `:356`. `scripts/coverage/mechanic-family-fold.mjs:46` folds `(^|-)conqueror$` to `conqueror`.
7. **Scaffold observed at draft (reverted).** The patch / amwp edits below, the pipeline (`convert-cards-v15` + the four `apply-*` passes), a prototype condition, Synergy edits and Conqueror line builder:
   - `data/cards` content diff = exactly the 13 Card Map lines in `amwp.json` (2), `anni.json` (6), `asrd.json` (5); `pnpm cards:check` → "A clean regen is semantically identical".
   - A probe printed the intended hook for all 16 pure lines (Volstagg's Instead hook +2) and the three hollows.
   - `pnpm --filter @legendary-arena/game-engine test`: **6930 / 6930 pass** (no existing test pins a Conqueror line).
   - `pnpm ledger:heroes` (by-name prototype): +1 row `amwp/freedom-fighters|conqueror`; −6 phantom rows (`anni/super-skrull` `bridge` / `rooftops` / `streets`, `asrd/valkyrie` `bridge` / `streets`, `asrd/warriors-three-the` `bridge`).
8. **Other readers of hook conditions ignore the new type.** Two read `hook.conditions` outside the executor: the coach sequence teacher (`apps/server/src/coach/sequenceTeacher.logic.ts:58-62,150-153`) keeps only `SEQUENCE_GATE_CONDITION_TYPES`, and `ui/uiState.build.ts:657` reads only the day/night types. Neither sees `conquerorSpaceHasVillain`, and neither changes. Nothing in `packages/preplan` or the simulation reads conditions or the Patrol constants (grep at baseline). No committed PAR profile includes the six heroes. `amwp/freedom-fighters`, `anni/heralds-of-galactus`, `anni/super-skrull`, `asrd/valkyrie` and `asrd/warriors-three-the` are on `sim:runtime-observed` sweep boards (`scripts/runtime-observed-hollows.mjs:150-153`).
9. `pnpm -r build` exits 0 and the suites are green at the baseline.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` L1150-1159 (Conqueror), L1478-1485 (destroyed City spaces; Firelord overrides), L2603-2610 (abilities resolve one at a time). `data/metadata/keywords-full.json` `conqueror` (the Enemy-worded "while" gloss).
- `docs/03-DATA-PIPELINE.md` §1 (stage order, outlier sets), `docs/ai/REFERENCE/00.2-data-requirements.md` §5 / §5.1 (the `[keyword:X]` ability-markup token).
- `docs/ai/DECISIONS.md`: D-24832 (all of it; this packet reuses its builder, index helper and Synergy rule), D-24764, D-24295, D-24443, D-24623, D-24570, D-24834 §8 / §11 (Put to the Torch follow-up). D-24837 is reserved.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (engine-only pure reads), §Card Data Flow; `.claude/rules/architecture.md` §UIState Projection Integrity (no new UIState field, so the five-step contract does not apply).
- User memory: `reference_setup_hook_change_replay_compat`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_card_data_pipeline`.
- **Why a new condition type, not `patrolSpaceOccupied`.** The evaluation is identical today, but Firelord's first line ("your Heroes' Conqueror abilities also give you Attack if those city spaces have been destroyed") must one day pass Conqueror conditions on a destroyed space without touching Patrol. The ledger classifies `conqueror` by its own condition type, and the blocked log names a Villain rather than "nothing".
- **Why restore the text, not add markers.** The text is wrong, not just unparsed: the patches dropped the space and number that the card and the upstream source print. Restoring the converter's own `[keyword:<Space> Conqueror N]` form gives one parseable shape across all 16 lines, removes six phantom ledger rows, and keeps the glossary match (`registry-viewer` `lookupKeyword` matches "Rooftops Conqueror 3" by substring).
- **Accepted coach gap.** The sequence teacher tips "play a Strength / Instinct / Ranged Hero first" from class gates only, so it can tip for Rock Solid, Unite the Oppressed, Firelord line 1 or Volstagg's Instead line while the space is empty. Patrol has the same gap (D-24832). Accepted and recorded in D-24837; the coach is not changed.
- **Parallel work.** WP-885 (drafted, not executed) touches `heroAbility.setup.ts`, `heroEffects.execute.ts` and the same regenerated feeds. Whichever executes second rebases and regenerates the feeds. Its §Context line "Conqueror is unsupported on all five heroes" goes stale when this lands (six heroes, with Freedom Fighters); that is historical text and is not edited here.
- **Put to the Torch.** Lines 0 / 1 are pure Conqueror lines and ship here. Line 2 ("You may gain a Wound. If you do, you get Rooftops Conqueror 4") is a `gain-wound-reward` reward; that keyword's non-Attack rewards are WP-885 (drafted, not executed). Adding a Conqueror reward member here would block this packet on WP-885 and add a carrier for the space, which D-24834 §11 ("members and arms, never fields") does not allow. It is a named follow-up (Settled Design Question 4).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file; no diffs, no snippets.
- ESM only, Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (full-word names, JSDoc, no nested ternaries, functions ~30 lines).
- Moves and effects never throw. No randomness, no clock. Files limited to §Files Expected to Change: engine, two patch files, the amwp base, the ledger script, two records, regenerated card files and feeds.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24837) before coding. One WP per session.

**Packet-specific:**

- **Condition.** `{ type: 'conquerorSpaceHasVillain', value: <CitySpaceName> }`.
  - **One literal.** Export `CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE = 'conquerorSpaceHasVillain'` from `hero/heroConditions.evaluate.ts` beside the Patrol pair. The parser, the evaluate / describe cases, `countSynergyConditions`, the clause rule and the ledger use the constant, never a re-typed string.
  - **Evaluation**, read as the hook resolves (never cached): `index = patrolSpaceIndex(G, value)`; true ⇔ `index !== -1 && G.city[index] !== null`. Unknown value, non-array `G.city` or a missing space → false.
  - **Describe:** missing space → `"there is no <Space> in the City"`; otherwise `"no Villain is in the <Space>"` (`<Space>` = Sewers / Bank / Rooftops / Streets / Bridge). Read after the engine's "… did not activate[ one of its abilities] — " prefix. Implemented in a new `describeFailedConquerorCondition(G, condition)`; `describeFailedPatrolCondition` is unchanged.
  - Not in `WAIT_AND_SEE_CONDITION_TYPES`, not in `SEQUENCE_GATE_CONDITION_TYPES`. A runtime pin in `heroConditions.evaluate.test.ts` asserts it has evaluate and describe cases and is in neither array.
- **Synergy Rate.** `countSynergyConditions` excludes the type (board state). `allPatrolConditionsPass` is renamed `allCitySpaceConditionsPass` (one caller) and also requires every Conqueror condition on the hook to pass `evaluateCondition` directly. So a hook whose Conqueror condition fails is not a countable clause on that play. This **extends D-24832's failed-Patrol clause rule** to the Conqueror type (D-24837 says so; the comment at `heroEffects.execute.ts:1027-1030` gains the same note). Expected per play: Rock Solid after another Strength Hero with the Sewers occupied → 1 assembled; Sewers empty → 0 assembled, 0 missed; Sewers occupied, no Strength Hero → 1 missed. An ungated Conqueror hook counts nothing: Transparent Motives with a Villain in the Bank → +1 Attack and a clause tally of 0 played / 0 assembled (the case that fails if the `countSynergyConditions` exclusion is missing).
- **Conqueror line recognition** (per-line loop, after the Patrol blocks, consumed at its own index; `previousLineHook = null` after):
  - `CONQUEROR_LINE_PATTERN = /^\s*((?:\[(?:hc|team):[^\]]+\]\s*)*:?)\s*(Instead,\s*)?\[keyword:(Sewers|Bank|Rooftops|Streets|Bridge)\s+Conqueror\s+(\d+)\]\.?\s*$/i` (non-global). Group 1 = gate prefix, 2 = "Instead,", 3 = space, 4 = N. A line with any other text is not a Conqueror line and takes the generic parse (so Put to the Torch[2], Stardust[0] and Dragonfang[0] keep their hollows).
  - **Base line** (no "Instead,"): one hook from `` buildPatrolBranchHook(instance.extId, gatePrefix, 'You get +N[icon:attack].', CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE, value, `${value}-conqueror`) `` where `value` = group 3 lower-cased (a `CITY_SPACE_NAMES` member; the captured "Bridge" would make `patrolSpaceIndex` return −1). The builder is reused unchanged; a `// why:` at the call says why.
  - **"Instead" line:** find the card's first line that matches the pattern with no gate prefix, no "Instead," and the same space; base amount B. If it exists and N > B, one hook as above with body `You get +(N−B)[icon:attack].`. Otherwise one honest hollow in the `buildPatrolLineHooks` other-target shape (`heroAbility.setup.ts:4874-4882`): `conditions` and `keywords: ['conditional']` only when the gate prefix parses to ≥1 condition, else `keywords: []`; no effects; `unresolvedMarkers: ['<value>-conqueror']`.
  - **No aliasing (D-13502).** Each hook comes from its own `parseAbilityText` call (inside the builder). The setup test asserts Volstagg's base and Instead hooks, and copies `#0` / `#1` of one card, share no `conditions` / `effects` array (`assert.notStrictEqual`).
- **Card data** (Card Map). Patch and amwp lines are rewritten to the canonical form; `data/cards/anni.json` / `asrd.json` are regenerated by the pipeline, never hand-edited. No other patch line, set or villain / mastermind / scheme line changes.
- **Ledger.** `KNOWN_CONDITIONS['conqueror'] = CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE` (imported from the dist beside the Patrol pair), classified **by hook** like `patrol`: a new `conquerorStatusForHooks(cardConditionTypes)` returns `condition` when some hook carries the type, else `unsupported`, checked before `statusForMechanic`. All six heroes read `condition`.
- **Provenance / live-verify.** `scripts/coverage/mechanic-provenance.json` gains `conqueror → WP-886 / D-24837`. `docs/ai/coverage/live-verify.json` gains `pending` rows `anni/super-skrull|conqueror` and `asrd/warriors-three-the|conqueror`.
- **Not touched:** `HERO_KEYWORDS`, `HERO_EFFECT_HANDLERS`, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS` and every count pin; `buildPatrolBranchHook` / `patrolSpaceIndex` / `describeFailedPatrolCondition` bodies; the amwp patch files; Patrol behavior; UIState; villain-side Conqueror; `gain-wound-reward`; Firelord[0].
- **Determinism / replay.** Setup output plus an evaluator case only new hooks reference. Pre-deploy match blobs keep their stored `G.heroAbilityHooks` and replay identically (memory `reference_setup_hook_change_replay_compat`); only matches created after the deploy see Conqueror. No `G` field, no randomness. The core sentinel `finalStateHash` is expected unchanged; confirm by running it.

## Card Map (locked)

**Card data** (rewritten line → canonical text):

| File | Card | Line | New text |
|---|---|---|---|
| `anni.patch.json` | `anni/heralds-of-galactus/stardust` | 0 | `[keyword:Focus] 4[icon:recruit] [icon:5] [keyword:Rooftops Conqueror 4]` |
| `anni.patch.json` | `anni/super-skrull/rock-solid` | 0 | `[hc:strength]: [keyword:Sewers Conqueror 1]` |
| `anni.patch.json` | `anni/super-skrull/transparent-motives` | 0 | `[keyword:Bank Conqueror 1]` |
| `anni.patch.json` | `anni/super-skrull/put-to-the-torch` | 0 / 1 / 2 | `[keyword:Bridge Conqueror 1]` / `[keyword:Streets Conqueror 1]` / `You may gain a Wound. If you do, you get [keyword:Rooftops Conqueror 4].` (the card prints "you get") |
| `asrd.patch.json` | `asrd/valkyrie/flying-stallion` | 0 | `[keyword:Rooftops Conqueror 1]` (the card and upstream print Rooftops; the patch had Streets) |
| `asrd.patch.json` | `asrd/valkyrie/ride-of-the-valkyries` | 0 | `[keyword:Streets Conqueror 1]` |
| `asrd.patch.json` | `asrd/valkyrie/usher-to-valhalla` | 0 | `[keyword:Bridge Conqueror 1]` |
| `asrd.patch.json` | `asrd/warriors-three-the/volstagg-the-valiant` | 0 / 1 | `[keyword:Bridge Conqueror 1]` / `[hc:instinct]: Instead, [keyword:Bridge Conqueror 3]` |
| `data/cards/amwp.json` | `amwp/freedom-fighters/steel-warrior` | 0 | `[keyword:Streets Conqueror 1]` |
| `data/cards/amwp.json` | `amwp/freedom-fighters/xolum` | 0 | `[keyword:Bridge Conqueror 1]` |

**Hooks** (16 pure lines; condition = `conquerorSpaceHasVillain`):

| Card | Line | Gate | Space | Attack |
|---|---|---|---|---|
| `amwp/jentorra/take-the-high-ground` | 0 | — | bridge | +1 |
| `amwp/jentorra/unite-the-oppressed` | 0 | `[hc:strength]` | sewers | +2 |
| `amwp/jentorra/conquer-the-conqueror` | 0 | — | bridge | +1 |
| `amwp/freedom-fighters/steel-warrior` | 0 | — | streets | +1 |
| `amwp/freedom-fighters/xolum` | 0 | — | bridge | +1 |
| `anni/heralds-of-galactus/firelord` | 1 | `[hc:ranged]` | bridge | +2 |
| `anni/super-skrull/rock-solid` | 0 | `[hc:strength]` | sewers | +1 |
| `anni/super-skrull/transparent-motives` | 0 | — | bank | +1 |
| `anni/super-skrull/put-to-the-torch` | 0 / 1 | — | bridge / streets | +1 / +1 |
| `asrd/valkyrie/flying-stallion` | 0 | — | rooftops | +1 |
| `asrd/valkyrie/usher-to-valhalla` | 0 | — | bridge | +1 |
| `asrd/valkyrie/ride-of-the-valkyries` | 0 | — | streets | +1 |
| `asrd/warriors-three-the/volstagg-the-valiant` | 0 / 1 | — / `[hc:instinct]` | bridge | +1 / +2 (Instead 3 − base 1) |
| `asrd/warriors-three-the/three-stand-as-one` | 1 | `[team:heroes-of-asgard]` | streets | +3 |

**Honest hollows (Conqueror inside another mechanic; grant nothing):** Stardust 0 (`focus` only; the D-24623 fallback drops its Conqueror slug); Put to the Torch 2 (`rooftops-conqueror`); Dragonfang 0 (`thrown-artifact`, `sewers-conqueror`).

**Evidence.** Every rewritten text was checked against the upstream source (`annihilation.js:247,422,445,464-468`; `heroesofasgard.js:270,284,299,353,357`) and, for Rock Solid, Transparent Motives, Stardust, Volstagg, Flying Stallion and Put to the Torch, the card image.

## Locked Values

- Condition type `'conquerorSpaceHasVillain'` via `CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE`; `value` ∈ `CITY_SPACE_NAMES`.
- The two describe strings, verbatim.
- `CONQUEROR_LINE_PATTERN`, verbatim; the base-line and Instead-line hook rules.
- Synergy: excluded from the count; `allCitySpaceConditionsPass` covers Patrol and Conqueror types; the three Rock Solid outcomes above.
- Ledger `KNOWN_CONDITIONS['conqueror']`, classified by hook.
- The Card Map texts and hooks, verbatim.

---

## Scope (In)

- **A) Condition.** `hero/heroConditions.evaluate.ts`: the constant, evaluate case, describe case (+ `heroConditions.evaluate.test.ts`: occupied, empty, removed space in a 3-space City, unknown value, and the runtime pin). `hero/heroEffects.execute.ts`: `countSynergyConditions` exclusion; `allPatrolConditionsPass` → `allCitySpaceConditionsPass`.
- **B) Parser.** `setup/heroAbility.setup.ts`: `CONQUEROR_LINE_PATTERN` and the consume block (base and Instead lines).
- **C) Card data.** The Card Map rows in `anni.patch.json`, `asrd.patch.json` and `data/cards/amwp.json`; regenerate `data/cards/anni.json` and `asrd.json` through the pipeline.
- **D) Tests.**
  - `setup/heroAbility.setup.test.ts`: per-line hook shape for a base line (Transparent Motives), a gated line (Rock Solid), the Instead pair (Volstagg: +1 and instinct +2), Flying Stallion's Rooftops hook, and each hollow (no effects; Put to the Torch 2 `['rooftops-conqueror']`, Stardust 0 `['focus']`, Dragonfang 0 `['thrown-artifact','sewers-conqueror']`). An Instead line with no same-space base line is a hollow in the locked shape (synthetic text, gated and ungated). No-aliasing assertions (Volstagg's two hooks; copies `#0` / `#1`).
  - New `hero/heroConqueror.test.ts`, hooks from `buildHeroAbilityHooks` over the committed card data (never hand-written): Transparent Motives +1 with a Villain in the Bank, nothing and a blocked line containing "no Villain is in the Bank" with it empty (assert the reason substring); with the Bank occupied, a clause tally of 0 played / 0 assembled (Synergy exclusion), and the same for Volstagg's ungated base hook; Put to the Torch +2 with Bridge and Streets occupied, +1 with only one, and its line 2 adds nothing; Volstagg +1 / +3 with another Instinct Hero / +0 with the Bridge empty; Rock Solid's three Synergy outcomes; a 3-space City (no Streets / Bridge) → Steel Warrior and Xolum add nothing and log "there is no Streets in the City" / "there is no Bridge in the City"; the Attack stays after the Bridge Villain is defeated in the same turn (no clawback); Transparent Motives played with the Bank empty, then a Villain placed in the Bank and another card played the same turn → still no Attack (not wait-and-see).
- **E) Ledger + records.** `scripts/hero-mechanic-ledger.mjs`; `scripts/coverage/mechanic-provenance.json`; `docs/ai/coverage/live-verify.json`.
- **F) Feeds.** Regenerate `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json`; `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json` and the dashboard `totalObs` / `percentResolved` pins in `useInPlayCoverage.test.ts` only if their gates flag.

## Out of Scope

- **Put to the Torch line 2** (gain a Wound → Rooftops Conqueror 4): a follow-up after WP-885 and this packet (Settled Design Question 4).
- **Villain-side Conqueror** (amwp / msp1 / asrd Villains and Henchmen, Kang masterminds' "Conqueror N for each city space under a Time Incursion", the amwp scheme's stacked Henchmen, Pursuit Craft's Ambush), including the asrd patch's villain lines and the bare `[keyword:Conqueror]` on The Nightsword, The Hel-Crown and Surtur. "While" is continuous there (a fight-cost read); its own WP.
- **Firelord line 0** (Conqueror on destroyed spaces): needs destroyed-space modelling. Unchanged (its magnitude-less attack effect is dropped by the magnitude pre-gate, as today).
- **Stardust's Focus reward and Dragonfang's Thrown Artifact reward**: with those keywords' WPs.
- Jentorra Take the High Ground line 1 ("If there are no Villains on the Rooftops, draw a card.", parsed to an empty hook today), and the pre-existing flat grants on Conquer the Conqueror line 1 (+1) and Three Stand as One line 0 (+3): not Conqueror lines.
- A client badge for Conqueror spaces. The blocked-log line is the surface.

## Files Expected to Change

- `packages/game-engine/src/hero/heroConditions.evaluate.ts` (+ `heroConditions.evaluate.test.ts`) — modified
- `packages/game-engine/src/hero/heroEffects.execute.ts` — modified (Synergy exclusion, clause-rule rename)
- `packages/game-engine/src/setup/heroAbility.setup.ts` (+ `setup/heroAbility.setup.test.ts`) — modified
- `packages/game-engine/src/hero/heroConqueror.test.ts` — **new**
- `scripts/convert-cards/inputs/patches/anni.patch.json`, `scripts/convert-cards/inputs/patches/asrd.patch.json`, `data/cards/amwp.json` — modified
- `data/cards/anni.json`, `data/cards/asrd.json` — regenerated
- `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json`, `docs/ai/coverage/live-verify.json` — modified
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv`, `docs/ai/coverage/runtime-observed-hollows.json` — regenerated
- `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — only if their gates flag
- Governance (execution close): `docs/ai/DECISIONS.md` (D-24837 appended Active), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — modified

Six engine code/test files, three data inputs, the ledger script and two records; the rest is regenerated.

## Contract

- The Locked Values.
- `conquerorSpaceHasVillain` is the hero Conqueror condition the Firelord and Put to the Torch follow-ups extend; the villain-side WP does not reuse it (Enemy Conqueror is a fight-time read).

## Vision Alignment

**Vision clauses touched:** §1 Rules Authenticity (sixteen hollow lines start working), §2 Content Authenticity and §10 Content as Data (13 lines restored to their printed text), §22 Deterministic & Reproducible Evaluation, §23 / §24 (ranked fairness, replay-verified integrity), NG-1 (no pay-to-win; untouched).
**Conflict assertion:** No conflict: this WP preserves all touched clauses.
**Non-Goal proximity:** not crossed.
**Determinism (§22):** pure reads of `G.city`, no randomness; setup-level change, so stored matches replay identically.

## Funding Surface Gate

§20 **N/A**: a rules change on hero cards. Its only copy is the existing blocked-log line with a new reason clause. No funding affordance or channel (WP-097 §A/§B/§C) is touched.

## API Catalog

§21 **N/A**: no `apps/server` HTTP endpoint added, changed or removed. No `Library-only` catalog function is touched: `docs/ai/REFERENCE/api-endpoints.md` lists none of the edited engine functions.

---

## Acceptance Criteria

1. The condition evaluates per the rule for occupied, empty, removed and unknown values, never throws, has a describe case, and is in neither `WAIT_AND_SEE` nor `SEQUENCE_GATE` (runtime pin).
2. Every Card Map hook line parses to its locked hook (setup test), including Volstagg's +2 Instead hook and Flying Stallion on the Rooftops; the three hollow lines grant nothing and record exactly the Card Map slugs (Stardust `focus` only); an Instead line without a same-space base line is a hollow.
3. At play, each hook adds its Attack only when its space holds a Villain (and its gate passes), reads the board as it resolves, never fires later in the turn, and the Attack stays after that Villain is defeated (§Scope D cases).
4. The type is excluded from the Synergy count and a failed Conqueror condition is not a countable clause (Rock Solid: 1 assembled / 0 / 1 missed in the three states). Patrol's Axe of the Slayer expectations (D-24832) still hold.
5. The `data/cards` content diff is exactly the 13 Card Map lines; `cards:check` exits 0.
6. The ledger reads `conqueror` = `condition` for `amwp/jentorra`, `amwp/freedom-fighters`, `anni/heralds-of-galactus`, `anni/super-skrull`, `asrd/valkyrie`, `asrd/warriors-three-the`; the six phantom `bridge` / `streets` / `rooftops` rows are gone.
7. `cards:check`, `cards:count-markers:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`, `ledger:villains:check`, `registry:validate`, `sim:runtime-observed:check`, `sim:coverage --check` and `ledger:numbers:check` exit 0. In the regenerated runtime-observed feed there is no `bridge-conqueror`, `streets-conqueror` or `bank-conqueror` hit; the `EC-924:` body records the `conqueror`-family, `bridge`, `streets` and `rooftops` hitCounts before and after (the bare `conqueror` count also drops because Stardust now records `focus` only).
8. `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/dashboard typecheck` → 0. The core sentinel `finalStateHash` is unchanged. No `HERO_KEYWORDS` / handler count change; no UIState field.

## Verification Steps

1. `pnpm -r build` → 0.
2. Record the runtime hitCounts: `node -e "const f=require('./docs/ai/coverage/runtime-observed-hollows.json');for(const m of Object.keys(f.byMechanic))if(/conqueror|^(bridge|streets|rooftops)$/.test(m))console.log(m,f.byMechanic[m].hitCount)"`. Baseline at `aad52201`: `bridge 13`, `bridge-conqueror 14`, `conqueror 45`, `rooftops 9`, `streets 65`.
3. Edit the Card Map lines, then run the pipeline (`docs/03-DATA-PIPELINE.md` §1): `node scripts/convert-cards/convert-cards-v15.mjs && node scripts/convert-cards/apply-card-counts.mjs && node scripts/convert-cards/apply-hero-ability-markers.mjs && node scripts/convert-cards/apply-effect-markers.mjs && node scripts/convert-cards/apply-defeat-requirement-markers.mjs`. `git diff --stat -- data/cards` → content changes only in `amwp.json`, `anni.json`, `asrd.json` (revert any EOL-only churn in other sets with `git checkout -- <file>`).
4. After the engine edits: `pnpm -r build && pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata && pnpm sim:runtime-observed`; then `pnpm sim:coverage --check` (only if it flags: `pnpm sim:coverage --update-baseline`); then `pnpm --filter @legendary-arena/dashboard prebuild:coverage`, re-pinning the dashboard pins only if the feed moved them. Re-run step 2.
5. `pnpm cards:check && pnpm cards:count-markers:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm ledger:villains:check && pnpm registry:validate && pnpm sim:runtime-observed:check && pnpm sim:coverage --check && pnpm ledger:numbers:check` → all 0.
6. `pnpm --filter @legendary-arena/game-engine test` → 0 fail (6960 at the baseline plus the new cases); `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/dashboard typecheck` → 0.
7. Ledger spot check: `node -e "const l=require('./docs/ai/coverage/hero-mechanic-ledger.json');for(const id of ['amwp/jentorra','amwp/freedom-fighters','anni/heralds-of-galactus','anni/super-skrull','asrd/valkyrie','asrd/warriors-three-the']){const r=l.rows.find(x=>x.extId===id&&x.mechanic==='conqueror');console.log(id,r&&r.status)}console.log(l.rows.filter(x=>['bridge','streets','rooftops'].includes(x.mechanic)).length)"` → six `condition`, then `0`.
8. `git diff --name-only` ⊆ Files Expected to Change; revert `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24837 Active. It records: the play-time reading of "while" for Heroes (rules L1157-1159) and the rejected options; the condition, its evaluation and describe strings; why a new type and not `patrolSpaceOccupied`; the line pattern, base and Instead hook rules and honest hollows; the Synergy exclusion and the `allCitySpaceConditionsPass` rename, stated as an extension of D-24832's failed-Patrol clause rule; the multi-hook blocked-log phrase; the card-data restoration (13 lines, canonical form, Flying Stallion corrected to Rooftops, Put to the Torch "you get", six phantom ledger rows removed) and the hollow slugs it leaves (Stardust `focus` only, so the runtime `conqueror` count drops); the full `G.city` writer list behind "every occupant is a Villain"; the by-hook ledger classification; the accepted coach sequence-teacher gap; the follow-ups (Put to the Torch line 2 with the D-24834 §8 note, villain-side Conqueror, Firelord line 0); the replay note.
- [ ] STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `pnpm roadmap:counts:write` then `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-924:` then `SPEC:`).
- [ ] **Card viewer publish (operator, post-merge):** run `pnpm metadata:upload` from the updated `main`; verify Rock Solid reads "Sewers Conqueror 1" and Flying Stallion "Rooftops Conqueror 1" on cards.legendary-arena.com. Recorded in STATUS; pending until done.
- [ ] **D-24026 live-verify (post-merge):** on an operator match created after the deploy with Super-Skrull and the Warriors Three: Put to the Torch adds +1 for each of Bridge / Streets holding a Villain; Transparent Motives logs "Player N's Transparent Motives did not activate one of its abilities — no Villain is in the Bank." with the Bank empty; Volstagg adds +3 with a Bridge Villain after another Instinct Hero. Recorded as a STATUS flip and the two `live-verify.json` rows.

## Reserved Decision (lands at execution)

**D-24837 — hero-conqueror-keyword.** It locks everything in the DoD item above. Reserved in NUMBER-LEDGER (#3293); written Active in the execution `SPEC:` close.

## Settled Design Questions (drafting decisions, 2026-11-11)

1. **"+N while any Villain is in <space>" is checked once, when the hook resolves, and the Attack is kept.**
   - **Evidence.** The Enemy wording is "while" (L1153-1156; `keywords-full.json`): an Enemy's Attack is read whenever you fight it, so "while" is naturally continuous there. The Hero wording is explicitly different: "You get +1 if any Villain is on the Bridge" (L1157-1159), the same "if" every other hero ability resolves at the moment it is used (L2603-2610). L1481-1485 also groups Conqueror with "If there is a Villain on the Rooftops…" effects. The engine's Attack is a spendable pool (`addResources`), not a per-card total.
   - **A) Play-time (chosen).** Read `G.city` as the hook resolves; grant once; keep it. Matches the hero "if", matches Patrol (D-24832: "if it becomes empty later in the turn, it's too late"), and needs no new state.
   - **B) Whole-turn wait-and-see** (`WAIT_AND_SEE_CONDITION_TYPES`, D-24377): grant once if a Villain enters the space later this turn. Rejected: the hero text says "if", not "if … this turn"; D-24377's window is for "If you [did X] this turn" conditions.
   - **C) Continuous.** Recompute the pool as Villains enter and leave. Rejected: the pool has no per-source ledger to claw back from, and it would take the Attack away the moment you defeat the Bridge Villain with it, which inverts the card's purpose.
   - The rules text settles it, so the drafting session did not escalate it.
2. **A new condition type** rather than `patrolSpaceOccupied` (§Context). Rejected: sharing the Patrol type, which would block the Firelord follow-up from treating Conqueror and Patrol differently and blur the ledger.
3. **Restore the card text** to `[keyword:<Space> Conqueror N]` in the patches and the amwp base (§Context). Rejected: per-line markers over damaged text, and teaching the parser the split and plain forms.
4. **Put to the Torch line 2 is a named follow-up**, not a reward member here. It needs WP-885's reward machinery first and a way to carry the space (D-24834 §11 forbids new fields, so the follow-up encodes it in the member or amends §11). On D-24834 §8 ("parking does not halt the hook loop"): the Wound line is the card's last line, so no later hook runs before the prompt resolves, and its Conqueror check at grant time reads the board after the choice resolves; the board is frozen until it does, so the result equals a play-time read. The follow-up records that.
5. **Volstagg's "Instead" is a delta hook** (+2 under instinct ∧ Bridge) on top of the base +1. Rejected: a `PATROL_BOTH_CARDS`-style allowlisted fusion (unneeded: Attack adds) or a negated class condition (none exists).

---

## Lint Gate Self-Review (00.3)

Independent subagent run (2026-11-11). **Run 1: FAIL** on one text-only item, fixed in this revision:
- §5: the governance line gained `— modified` and full `WORK_INDEX.md` / `EC_INDEX.md` paths.

Advisories applied: the multi-hook log anchor is `heroEffects.execute.ts:1163` (not `:1155`); a not-wait-and-see play case in §Scope D (AC3); the step 2 baseline hitCounts; the exact engine test command in the EC; double-backtick spans around the builder call.

**Run 2: PASS** (2026-11-11).

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Constraints | PASS |
| §3 Assumes | PASS |
| §4 Context | PASS |
| §5 Files | PASS (after fix) |
| §6 Naming | PASS |
| §7 Dependencies | PASS |
| §8 Boundaries | PASS |
| §9 Windows | PASS |
| §10 Env vars | N/A: the change introduces and reads no env var; the operator's `metadata:upload` uses its existing R2 keys |
| §11 Auth | N/A: no auth surface |
| §12 Tests | PASS |
| §13 Verification | PASS |
| §14 ACs | PASS |
| §15 / §15.1 | PASS |
| §15.2 Risk tier | PASS |
| §16 Code style | PASS |
| §17 Vision | PASS |
| §18 Prose-vs-grep | N/A: no forbidden-token grep step |
| §19 Bridge-vs-HEAD | N/A: commit-time rule |
| §20 Funding | N/A, justified |
| §21 API catalog | N/A, justified |
| EC-TEMPLATE | PASS (EC 58 content lines) |

## Gate Record

**Pre-flight (01.4), independent subagent.** Round 1: **NOT READY**, three PS items, all fixed:
- **PS-1:** Stardust line 0 records `focus` only (the D-24623 fallback at `heroAbility.setup.ts:3047-3058` skips unmatched slugs once a marker is recorded), not `focus` + `rooftops-conqueror`. Card Map, §Goal 5, Scope D and AC2 corrected; D-24837 notes the runtime `conqueror` drop.
- **PS-2:** Flying Stallion prints **Rooftops** Conqueror 1 (`heroesofasgard.js:270`; confirmed from the card image), and the patch had Streets. Card Map, hooks table, EC and WORK_INDEX row corrected.
- **PS-3:** §Assumes 8 missed two condition readers (the coach sequence teacher, `uiState.build.ts:657`); both ignore the new type. Reworded.
- RS applied: the full `G.city` writer list; Put to the Torch line 2 "you get" (card image); the accepted coach-tip gap; the WP-885 parallel note; `ledger:villains:check` and `registry:validate` added; the mindmap suffix.

Verified by the agent: every anchor; the rules evidence and all five Settled Design Questions; exactly 20 hero Conqueror lines in the data (16 hooks, 3 hollows, Firelord line 0); the regex matches the 16 and none of the 4 others; every `G.city` occupant is a Villain; a re-run scaffold in a throwaway worktree (13-line data diff, `cards:check` and `cards:count-markers:check` pass). Round 2: **READY TO EXECUTE**, one cosmetic RS (§Context "you get") applied.

**Copilot (01.7), independent subagent.** Round 1: **RISK → HOLD**, nine scope-neutral findings, all applied:
- **Mode 26 / 18:** the quoted blocked-log line is the multi-hook phrase ("… did not activate one of its abilities — …", `heroEffects.execute.ts:1163`); tests assert the reason substring.
- **Mode 11:** a Synergy-exclusion test (an ungated hook with its space occupied → 0 played / 0 assembled).
- **Mode 17:** the no-aliasing rule in the EC and `notStrictEqual` assertions.
- **Mode 28:** the card viewer reads R2, so the restored text appears there only after the operator's `pnpm metadata:upload` (DoD item).
- **Mode 20:** D-24837 states it extends D-24832's failed-Patrol clause rule.
- **Mode 27 / 26:** the condition `value` is group 3 lower-cased; a new `describeFailedConquerorCondition`, the Patrol describer unchanged.
- **Mode 5:** the Instead-hollow shape locked to the other-target Patrol hollow.
- **Mode 23:** targeted edits only on the ledger script (NUL-byte sort separators at `:613-614`).
- **Mode 12:** the amwp patch files' `abilities` are inert and not edited.

Verified by the agent: determinism / replay, layer boundaries, the single caller of the renamed helper, no condition-type drift pin beyond the per-type runtime pin, the three Rock Solid outcomes, the builder's hook shape, the ledger by-hook logic. Round 2: **PASS — CONFIRM**; one cosmetic note (Unite the Oppressed builds one hook, so it logs the single-hook phrase) applied. Pre-flight not re-run: no scope or allowlist change.

**Post-gate rebase (2026-11-11).** Merging `origin/main` brought WP-884 (#3294), which added 75 lines to `heroEffects.execute.ts` and no change to `heroAbility.setup.ts`, `heroConditions.evaluate.ts`, `deferredConditionalGrants.ts`, the ledger script or the three card-data inputs. The executor anchors shifted by +14 and were re-measured (`:1027-1034`, `:1177`, `:1527`, `:1557`, `:1997`; the Gate Record lines above quote the pre-rebase numbers). Engine baseline re-measured at 6960 / 6960. No content, scope or allowlist change. **Pre-flight round 3: READY TO EXECUTE** — every re-measured executor anchor and every unchanged setup / evaluate / ledger / patch / amwp anchor matches HEAD, and WP-884's five executor hunks (an import, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`, its handler, `HERO_EFFECT_HANDLERS`) touch none of the Synergy code; its feed regenerations are all inside this WP's regenerated / conditional allowlist.
