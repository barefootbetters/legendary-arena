# WP-816 — Villain-side Savior: a marker condition gate, a per-player Savior exclusion, and KO-a-Bystander-from-each-Victory-Pile (Game Engine + card data)

**Status:** Draft 2026-10-20 (EC-854; **D-24749** reserved (#2928); gates pending — see §Gate Record).
**Primary Layer:** Game Engine (+ card-data markers and the derived coverage feeds)
**Dependencies:** none open. Builds on WP-653 / D-24464 (hero-side Savior = `bystandersInVictoryAtLeast:3`), WP-489 / D-24295 (the `@<space>` marker location gate — the structural template), WP-519 / D-24332 (`ko-cullable-each-deck-top`), WP-485 / D-24290 (`draw-cards-current`), WP-252 / D-24023 (descriptor grammar + legacy reverse-map), WP-815 / D-24747 (Man-Fish's Abomination cost, shipped).
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It changes a contract file (`rules/villainAbility.types.ts`), adds a villain primitive and a marker grammar suffix, and regenerates card data and feeds.
**Arc:** Cap 75th (ca75) completion arc, WP 3 (item 2 of the 2026-10-19 audit, auto-memory `project_cap75_completion_arc`).

> Baseline: `origin/main` at `ac80afc9` plus the reserve commit (#2928). Re-read line anchors, the primitive count and test totals at execution.

---

## Goal

As a player fighting the Masters of Evil (WWII), I want Black Knight, Executioner, Melter and Radioactive Man to do what they print (Savior rewards, Savior-exempt Wounds, the Executioner's Escape) and Man-Fish to wound the other players when fought in the Sewers or Bridge, so that rescuing Bystanders matters the way the tabletop game intends.

Today every one of these lines does nothing. The engine reads villain effects only from `[effect:…]` markers, and none of these lines carry one (only their Ambush captures are marked). After this session:

| Card (ca75) | Line | Behavior |
|---|---|---|
| Black Knight | `Fight: [keyword:Savior]: KO one of your Heroes.` | If you are a Savior, KO one of your Heroes (the existing interactive current-player KO). |
| Executioner | `Fight: [keyword:Savior]: Draw a card.` | If you are a Savior, draw a card. |
| Executioner | `Escape: KO a Bystander from each player's Victory Pile.` | Each player with a Bystander in their Victory Pile KOs one. |
| Melter (WWII) | `Fight: [keyword:Savior]: Each player reveals the top card of their deck. For each card, you choose to KO it or put it back.` | If you are a Savior, the existing core-Melter effect (`ko-cullable-each-deck-top`). |
| Radioactive Man | `Fight: Each player who is not a [keyword:Savior] gains a Wound.` and `Escape: Same effect.` | Each player who is not a Savior gains a Wound, on Fight and on Escape. |
| Man-Fish (`zolas-creations`) | `Fight: If you fought Man-Fish in the Sewers or Bridge, then each other player gains a Wound.` | The existing each-other Wound behind the existing location gate. Marker only. |

**Savior** = the player has at least 3 Bystanders in their Victory Pile (rules v23 L1844-1853), counted exactly as the hero-side Savior gate counts them today.

## User-Visible Impact

- Fighting Black Knight, Executioner or Melter (WWII) with 3+ rescued Bystanders gives the printed reward; with fewer, the log says why nothing happened.
- Radioactive Man wounds every non-Savior player when fought and when it escapes.
- An escaping Executioner costs each player one rescued Bystander (and so 1 VP).
- Man-Fish wounds the other players when fought on the Sewers or the Bridge.
- No client change: every effect self-narrates into the game log or uses an existing pending-choice UI.

---

## Assumes

1. **Rules text.** `docs/legendary-universal-rules-v23.md`:
   - L1844-1853 (right column): Savior "means 'Use this ability if you have at least 3 Bystanders in your Victory Pile.'" "If you defeat a Villain with Bystanders, put those Bystanders into your Victory Pile before checking any Savior ability on that Villain."
   - L3715-3716: "Savior: This keyword ability on Heroes and Villains rewards you for saving the innocent."
2. **Card text** (verbatim in `data/cards/ca75.json` on the baseline; the table in §Goal). Each of the four Masters of Evil (WWII) villains has only its Ambush marked (`captureBystander`), and Man-Fish has only its Escape marked (`gainWoundEachPlayer`), in `scripts/convert-cards/inputs/villain-effect-markers.json` L69-80. Black Knight's Fight line also sits in `_unassigned` with reason `conditional` (L411).
3. **The villain parser is marker-only.** `setup/villainAbility.setup.ts:138` `EFFECT_MARKER_PATTERN = /\[effect:([^\]]+)\]/g`; `extractEffects` (L738) never reads `[keyword:…]`. A legacy keyword value is matched first; anything else goes through `parseParameterizedEffect` (L336-358), which splits off the `@<space>[+<space>…]` location gate and attaches `requireCitySpaces`, then `parseUngatedEffect`. A value that parses to null lands in `unresolvedMarkers` (WP-257), never a silent accept.
4. **The executor gate seam.** `villain/villainEffects.execute.ts` L176-191: inside the per-descriptor loop, a descriptor with `requireCitySpaces` is checked **before** `applyVillainEffect` dispatch; on failure it calls `narrateCityGateBlocked` (L595-606, `pushLog(…, 'blocked')`) and `continue`s, recording neither a hollow record nor an EffectTrace. `currentPlayer` is read from `ctx` at L162.
5. **Descriptor key.** `rules/villainAbility.types.ts:609` `descriptorKey` = `primitive|target|magnitude|selector`; `requireCitySpaces`, `zone`, `drawCount` etc. are deliberately excluded, so a gated descriptor reverse-maps to the same legacy keyword as its ungated twin. `target` is `'current' | 'each' | 'each-other'` (L528), append-only per D-24034; `'each-other'` (D-24295) is the precedent for a keyword-less target value.
6. **Existing handlers reused unchanged.**
   - `ko-hero:current` → `villainEffectKoHero` (L938), the interactive current-player KO; reverse-maps to `koHeroCurrentPlayer`.
   - `draw-cards-current:<N>` → `villainEffectDrawCardsCurrent` (L2072); parser arm `setup/villainAbility.setup.ts:526-538` accepts N = 1.
   - `ko-cullable-each-deck-top` → `villainEffectKoCullableEachDeckTop` (L2598). Core Melter's printed line is word-for-word Melter (WWII)'s line after the Savior gate.
   - `gain-wound:each-other[:<N>]` → `villainEffectGainWound` (L817-872), sorted iteration, `gainWoundWithOutcome` (Diving Block), self-narrates.
   - Handler map `VILLAIN_EFFECT_HANDLERS` at L3700.
7. **Fight ordering already satisfies the rule in Assumes 1.** `moves/fightVillain.ts`: the villain goes to the Victory Pile (L378), its attached Bystanders are awarded (L381-389), and only then `executeVillainAbilities(…, 'onFight', …)` runs (L411). Escape fires `executeVillainAbilities(…, 'onEscape', …)` at `villainDeck/villainDeck.reveal.ts:661`.
8. **The hero-side Savior count.** `hero/heroConditions.evaluate.ts:325-341` (`bystandersInVictoryAtLeast`) and `countBystandersInVictory` (L687) count a Victory-Pile card as a Bystander when `extId === BYSTANDER_EXT_ID` (`'pile-bystander'`, `setup/pilesInit.ts:22`) or `extId.startsWith('bystander-villain-deck-')`. `setup/heroAbility.setup.ts:1705` builds `{ type: 'bystandersInVictoryAtLeast', value: '3' }` from `[keyword:Savior]`. `evaluateCondition` is exported (L98).
9. **KO-from-Victory-Pile precedent.** `rules/tacticHandlers.ts:744-805` (Loki's Whispers and Lies): the first Bystander in Victory-Pile order (same two-arm predicate, L744-749) moves to `G.ko` via `moveCardFromZone`, per player in sorted id order, self-narrated.
10. **No Bystander helper is exported from `board/bystanders.logic.ts`** (three pure functions, `attach` / `award` / `carryEscaped`, header L1-11; imports only `CardExtId`). The executor already imports from it (L51-54).
11. **Primitive vocabulary.** `VillainEffectPrimitive` (L335) / `VILLAIN_EFFECT_PRIMITIVES` (L431) hold **28** members, last `ko-up-to-from-discard-current`; `villainAbility.types.test.ts` asserts bidirectional parity. A no-param primitive needs no parser arm: `parseUngatedEffect`'s tail (`setup/villainAbility.setup.ts:716-721`) returns `{ primitive }` for a 1-part token.
12. **The marker script keeps hand-synced copies.** `scripts/convert-cards/apply-effect-markers.mjs` L167 (`VILLAIN_EFFECT_PRIMITIVES`), L204 (`CITY_SPACE_NAMES`), L233-~300 `isValidParameterizedEffectToken` (strips `@`, then the primitive grammar). It does not import `packages/`.
13. **Feeds.** `ledger:villains` (`scripts/villain-mechanic-ledger.mjs`, reads the engine **dist** parser and `scripts/coverage/mechanic-provenance.json`; its `normalizeEffectToken` (L134-137) names a mechanic by splitting the raw token on `:` only, so `ko-cullable-each-deck-top!savior` would come out as an `unsupported` mechanic named with its suffix — fixed in Scope F) and `effect-index` (`scripts/build-effect-implementation-index.mjs`, reads both ledgers) regenerate from the marked data. `mechanics:metadata` reads only the hero ledger (`scripts/build-card-mechanics-metadata.mjs:51`). `sim:runtime-observed` sweeps only `core/dr-doom` + `core/brotherhood`; `sim:coverage` is a static hero parse. WP-757 (`haunt-hq-hero`) touched exactly: the marker script, the marker map, `mechanic-provenance.json`, the set's card JSON, `data/metadata/effect-implementation-index.json`, `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`.
14. **No hashed fixture plays these cards.** `masters-of-evil-wwii` appears in `packages/**` / `apps/**` only in `packages/registry/src/gauntletLoadouts.generated.ts` (9 rows) and the untracked dashboard copy of the effect index. `zolas-creations` (Man-Fish) appears only in `setup/buildCardAbomination.test.ts` (inline copied lines, unaffected), `gauntletLoadouts.generated.ts` and `content/themes/red-skull-classic.json`. None is hashed, and no `data/par` artifact references either group. The hash sentinel is `core/dr-doom`; `PRE_WP080` is synthetic.
15. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- The 2026-10-19 ca75 audit found every Masters of Evil (WWII) Fight / Escape line inert; the villain ledger shows them `executable` only through the marked Ambush capture (auto-memory `project_cap75_completion_arc`, `reference_villain_effect_vocabulary_extension`).
- WP-489 (`docs/ai/work-packets/WP-489-villain-effect-vocab-tier-b-city-spaces.md`) is the structural template: a marker suffix lifted to an optional descriptor gate, checked in the executor loop before dispatch, fail-closed, self-narrated.
- **Why a marker gate and not a `[keyword:Savior]` reader.** The villain parser is marker-only by design (Assumes 3); teaching it English or `[keyword:]` would be a second grammar. The gate is data: one suffix on the existing marker, mirroring `@<space>`.
- **Why a closed condition union of one.** `VILLAIN_EFFECT_CONDITIONS = ['savior']` is the append point for the next villain condition gates already in the data (ssw2 Pink Sphinx `[keyword:Spectrum]:`, Assumes 2 `_unassigned`), without a second suffix grammar.
- **Why `each-non-savior` is a `gain-wound` target and not a gate.** The gate is about the current player; Radioactive Man's exemption is per player. A new `target` value follows the `'each-other'` precedent exactly (D-24295).
- **Why one Savior predicate.** Hero and villain Savior must never disagree in one match, so the villain gate counts with the same two-arm predicate as the hero gate, through a new exported helper pinned to the hero evaluator by a parity test.
- **Why "first Bystander in pile order".** All Bystanders are worth 1 VP in the Victory Pile and a rescued Bystander's ability has already resolved, so which one is KO'd has no game effect; the Whispers and Lies precedent (Assumes 9) is deterministic and needs no choice UI for non-active seats (pending choices are active-player-scoped).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 Villain Group Shape (`cards`, `abilities`), §5 Ability Text Markup Language (the printed `[keyword:X]` / `[icon:X]` / `[hc:X]` / `[team:X]` / `[rule:X]` set). `[effect:X]` is not in §5: it is the pipeline-appended engine marker documented in the `_notes` of `scripts/convert-cards/inputs/villain-effect-markers.json`.
- `docs/ai/ARCHITECTURE.md` §Zone & Pile Structure (zones hold `CardExtId` only; KO via zone moves), Section 3 Persistence Boundaries (`G` runtime-only), §The Rule Execution Pipeline (unknown effects warn, never throw).
- `docs/ai/DECISIONS.md`: scan D-24023, D-24034, D-24081 (`G.messages` hash-excluded), D-24290, D-24295, D-24332, D-24464, D-24499 / D-24673 (Diving Block wound routing), D-24372 before coding.
- User memory: `reference_villain_effect_vocabulary_extension` (the script's own primitive copy; keyword-less descriptors must self-narrate), `reference_card_data_pipeline` (markers only — never re-run the base converter), `reference_engine_tests_never_typechecked`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24749) before coding. One WP per session.

**Packet-specific:**
- **One gate seam.** The condition gate is checked only in the `executeVillainAbilities` per-descriptor loop, immediately **after** the existing location-gate check and **before** dispatch. No handler reads `requireCondition`.
- **The gate reads the current player** (`ctx.currentPlayer`) at every timing. Fail closed when that player has no zones.
- **One Savior predicate.** The executor counts with `countVictoryPileBystanders` + `SAVIOR_BYSTANDER_THRESHOLD`. `hero/heroConditions.evaluate.ts` is **not edited**; the parity test pins the two together.
- **Data, not English.** No parser reads `[keyword:Savior]` on the villain path. Behavior comes only from the seven markers in Locked Values.
- **Markers only.** Regenerate card data with `node scripts/convert-cards/apply-effect-markers.mjs` alone. Never run `convert-cards-v15.mjs` (it strips every marker).
- **Self-narrate.** Every new keyword-less outcome logs through `pushLog` into `G.messages` (hash-excluded, D-24081). `EFFECT_KEYWORD_LABELS`, `VillainEffectKeyword` and the legacy reverse-map stay frozen (D-24023).

## Locked Values

**Types (`rules/villainAbility.types.ts`):**
- `export type VillainEffectCondition = 'savior';` and `export const VILLAIN_EFFECT_CONDITIONS: readonly VillainEffectCondition[] = ['savior'] as const;` — runtime drift test.
- `VillainEffectDescriptor.requireCondition?: VillainEffectCondition` — optional, **not** part of `descriptorKey`.
- `VillainEffectDescriptor.target` widened append-only to `'current' | 'each' | 'each-other' | 'each-non-savior'`.
- Primitive `'ko-bystander-each-victory-pile'` appended to the union **and** at the end of `VILLAIN_EFFECT_PRIMITIVES` (28 → 29, re-read at execution).

**Grammar (`setup/villainAbility.setup.ts` and the script, identical):**
- Full marker value: `<primitive>[:<param>…][@<space>[+<space>…]][!<condition>]`. The `!<condition>` suffix, when present, is **last**.
- `parseParameterizedEffect` splits on `!` **first**: more than one `!` → null; a present right side that is not a member of `VILLAIN_EFFECT_CONDITIONS` (case-sensitive; empty included) → null. The left side then goes through the existing `@` split and `parseUngatedEffect` unchanged. A present condition is set as `requireCondition`.
- `gain-wound:each-non-savior` (exactly 2 parts) → `{ primitive: 'gain-wound', target: 'each-non-savior' }` (no `magnitude`). Any 3-part form → null.
- `ko-bystander-each-victory-pile` (no params) → `{ primitive: 'ko-bystander-each-victory-pile' }` through the existing no-param tail; any param → null.
- Legacy keywords take no suffix: `koHeroCurrentPlayer!savior` → null (unresolved). Gated lines use the parameterized form.

**Savior helpers (`board/bystanders.logic.ts`, pure, no `G`):**
- The file newly imports `BYSTANDER_EXT_ID` from `'../setup/pilesInit.js'` (no cycle: `pilesInit` imports only `shuffle` and types). Update the header comment, which today lists three functions and a `CardExtId`-only import.
- `export const SAVIOR_BYSTANDER_THRESHOLD = 3;`
- `export function countVictoryPileBystanders(victory: readonly CardExtId[]): number` — counts ids that `=== BYSTANDER_EXT_ID` or `startsWith('bystander-villain-deck-')` (Assumes 8, the hero predicate verbatim).
- `export function findFirstVictoryPileBystander(victory: readonly CardExtId[]): CardExtId | undefined` — the first such id in array order.

**Executor (`villain/villainEffects.execute.ts`):**
- Gate: when `descriptor.requireCondition === 'savior'`, the gate passes iff `G.playerZones[currentPlayer]` exists and `countVictoryPileBystanders(zones.victory) >= SAVIOR_BYSTANDER_THRESHOLD`. On failure: `pushLog(G, \`${label} effect: Player ${currentPlayer} is not a Savior (${count} of ${SAVIOR_BYSTANDER_THRESHOLD} Bystanders in their Victory Pile); no effect.\`, 'blocked')` where `label = villainEffectTimingLabel(timing)` and `count` is 0 when the zones are missing; then `continue` with no hollow record and no EffectTrace (the location-gate precedent).
- `gain-wound` `target: 'each-non-savior'`: iterate `Object.keys(G.playerZones).sort()`; skip a player whose `countVictoryPileBystanders(victory) >= SAVIOR_BYSTANDER_THRESHOLD`; otherwise, if `G.piles.wounds.length > 0`, one `gainWoundWithOutcome(G, playerId)`. When the wounded player is `currentPlayer`, `G.turnEconomy.woundsDrawn += 1` (the `'each'` branch rule). Narration:
  - any Diving Block pending → `` `${label} effect: each player who is not a Savior gains a Wound: ${composeWoundOutcomeClause(gainedPlayerIds, divingBlockPendingPlayerIds)}.` `` `'applied'`;
  - else any wounded → `` `${label} effect: each player who is not a Savior gained a Wound (Player 1, Player 2).` `` (names in sorted order, `, `-joined) `'applied'`;
  - else → `` `${label} effect: no player who is not a Savior gained a Wound.` `` `'blocked'`.
  - Return `{ targets: [] }` always (the `'each-other'` shape: a keyword-less descriptor's result is never recorded, executor L202, so a `woundOutcomes` field would be dead).
- `ko-bystander-each-victory-pile` handler `villainEffectKoBystanderEachVictoryPile`: for each player in `Object.keys(G.playerZones).sort()`, `findFirstVictoryPileBystander(zones.victory)`; when found, `moveCardFromZone(zones.victory, G.ko, id)` and write back both arrays (the Whispers and Lies pattern). Narration: some moved → `` `${label} effect: KO'd a Bystander from the Victory Pile of Player 0, Player 2.` `` `'applied'`; none → `` `${label} effect: no player had a Bystander in their Victory Pile to KO.` `` `'blocked'`. Returns `{ targets: [] }`. Registered in `VILLAIN_EFFECT_HANDLERS`.

**Marker map (`scripts/convert-cards/inputs/villain-effect-markers.json`, `villains.ca75`), exactly:**
```json
"masters-of-evil-wwii": {
  "black-knight": { "ambush": ["captureBystander"], "fight": ["ko-hero:current!savior"] },
  "executioner": { "ambush": ["captureBystander"], "fight": ["draw-cards-current:1!savior"], "escape": ["ko-bystander-each-victory-pile"] },
  "melter-wwii": { "ambush": ["captureBystander"], "fight": ["ko-cullable-each-deck-top!savior"] },
  "radioactive-man": { "ambush": ["captureBystander"], "fight": ["gain-wound:each-non-savior"], "escape": ["gain-wound:each-non-savior"] }
},
"zolas-creations": {
  "doughboy": { "fight": ["koHeroCurrentPlayer"] },
  "man-fish": { "fight": ["gain-wound:each-other@sewers+bridge"], "escape": ["gainWoundEachPlayer"] }
}
```
and the `_unassigned` row for `ca75 / masters-of-evil-wwii / black-knight` (L411) is deleted.

**Ledger normalizer (`scripts/villain-mechanic-ledger.mjs` `normalizeEffectToken`):** `rawToken.split('!')[0].split('@')[0].split(':')[0].trim()` — strip the condition suffix, then the location gate, then the params, so a gated marker is named by its primitive (the parser's resolved name).

**Provenance:** `scripts/coverage/mechanic-provenance.json` gains `"ko-bystander-each-victory-pile": { "wp": "WP-816", "decision": "D-24749" }` next to the other villain primitives.

---

## Scope (In)

- **A)** `rules/villainAbility.types.ts` + test: the condition union / array, `requireCondition`, the `each-non-savior` target, the new primitive, JSDoc on each.
- **B)** `setup/villainAbility.setup.ts` + test: the `!` suffix in `parseParameterizedEffect`, the `each-non-savior` arm in the `gain-wound` branch, doc-comment grammar list updated.
- **C)** `board/bystanders.logic.ts` + test: the three Savior exports; header comment updated.
- **D)** `villain/villainEffects.execute.ts` + test: the condition gate + its narration helper, the `each-non-savior` branch, the new handler + map entry.
- **E)** `moves/fightVillain.test.ts` (additions only): the rules-ordering integration cases.
- **F)** Card data: the marker script (primitive, condition list, `!` validation, `each-non-savior`), the marker map, `data/cards/ca75.json` regenerated by the marker script, `mechanic-provenance.json`, the villain-ledger normalizer, and the regenerated villain ledger + effect index.

## Out of Scope

- **Baron Heinrich Zemo** (+9 unless Savior, the 2-recruit rescue passive, the strike, the four tactics incl. *Fallen Idols* "each other player that is not a Savior"). Cap 75th item 3; it reuses `SAVIOR_BYSTANDER_THRESHOLD`, `countVictoryPileBystanders` and `findFirstVictoryPileBystander`.
- **Hero-side Savior** (WP-653, unchanged) and the hero Mobilize for War batch (Cap 75th item 5).
- **Killbots as Bystanders.** Rules v23 L2337-2341 make a defeated Killbot count as a Bystander in the Victory Pile, and `scoring/scoring.logic.ts:68` `isVictoryPileBystander` honors that. Neither the hero Savior gate nor this one counts Killbots. Fixing both together is a follow-up; govern-close records it in STATUS.
- **Other villain condition gates** (ssw2 Pink Sphinx Spectrum, wtif Wolf Demon Soulbind, the anni "If you played a [hc:covert] Hero" line). `VILLAIN_EFFECT_CONDITIONS` is their append point.
- **Melter's "you choose to KO it or put it back"** fidelity: WP-519's cullable collapse is reused as-is.
- **Client and bot.** No client file changes; the AI does not read villain hooks.
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts` — modified
- `setup/villainAbility.setup.ts`, `setup/villainAbility.setup.test.ts` — modified
- `board/bystanders.logic.ts`, `board/bystanders.logic.test.ts` — modified
- `villain/villainEffects.execute.ts`, `villain/villainEffects.execute.test.ts` — modified
- `moves/fightVillain.test.ts` — modified (additions only)

**Scripts and data**
- `scripts/convert-cards/apply-effect-markers.mjs` — modified
- `scripts/convert-cards/inputs/villain-effect-markers.json` — modified
- `scripts/coverage/mechanic-provenance.json` — modified
- `scripts/villain-mechanic-ledger.mjs` — modified (`normalizeEffectToken` only)
- `data/cards/ca75.json` — regenerated (7 lines gain a marker)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv`, `data/metadata/effect-implementation-index.json` — regenerated

**Governance:** `docs/ai/DECISIONS.md` (D-24749), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 9 engine files (5 of them tests), 4 script/input files, 1 card-data file and 3 generated feeds. Above the ~8 guideline because one mechanic spans parser, executor, script mirror and data; splitting would ship a grammar with no data or data with no grammar.

## Contract

- The Locked Values above: `VillainEffectCondition` / `VILLAIN_EFFECT_CONDITIONS`, `requireCondition`, the `each-non-savior` target, the `ko-bystander-each-victory-pile` primitive, the `!<condition>` grammar, the three Savior helpers, the exact narration strings.
- `executeVillainAbilities` and every handler keep their signatures. `descriptorKey` is unchanged.

## Test Contract

Executor / helper cases build a minimal `G` in the style of the existing test file (`makeG` / `createMockGameState`), with `messages: []` so `pushLog` records. "Bystander ids": `pile-bystander` and `bystander-villain-deck-NN`. Each T-case is at least one `it`, grouped under one `describe('WP-816 …')` per file: T1-T3 in `villainAbility.types.test.ts`; T4-T8 in `villainAbility.setup.test.ts`; T9-T11 in `board/bystanders.logic.test.ts` (T11 imports `evaluateCondition` from `../hero/heroConditions.evaluate.js`); T12-T21 in `villainEffects.execute.test.ts`; T22-T23 in `moves/fightVillain.test.ts`. T2 edits the existing primitive-count pin (`villainAbility.types.test.ts` ~L351-397) from 28 to 29: a value change from an intended product change, said so in the commit body.

| # | Input | Expected | Invariant / must NOT |
|---|---|---|---|
| T1 | `VILLAIN_EFFECT_CONDITIONS` | equals `['savior']` | runtime assertion (D-24372) |
| T2 | `VILLAIN_EFFECT_PRIMITIVES` | 29 members, last `ko-bystander-each-victory-pile`; existing parity test still passes | |
| T3 | `descriptorToLegacyKeyword({ primitive: 'ko-hero', target: 'current', requireCondition: 'savior' })`; and `{ primitive: 'gain-wound', target: 'each-non-savior' }` | `koHeroCurrentPlayer`; `undefined` | condition not in the key |
| T4 | parse `ko-hero:current!savior`, `draw-cards-current:1!savior`, `ko-cullable-each-deck-top!savior` | `{ko-hero, current, requireCondition: savior}`, `{draw-cards-current, drawCount: 1, requireCondition: savior}`, `{ko-cullable-each-deck-top, requireCondition: savior}` | |
| T5 | parse `gain-wound:each-non-savior`; `ko-bystander-each-victory-pile`; `gain-wound:each-other@sewers+bridge` | `{gain-wound, each-non-savior}`; `{ko-bystander-each-victory-pile}`; `{gain-wound, each-other, magnitude: 1, requireCitySpaces: [sewers, bridge]}` | Man-Fish shape is the existing one |
| T6 | parse `ko-hero:current@sewers!savior` | `{ko-hero, current, requireCitySpaces: [sewers], requireCondition: savior}` | both gates |
| T7 | `ko-hero:current!`, `ko-hero:current!spectrum`, `ko-hero:current!Savior`, `ko-hero:current!savior!savior`, `ko-hero:current!savior@sewers`, `koHeroCurrentPlayer!savior`, `gain-wound:each-non-savior:2`, `ko-bystander-each-victory-pile:1` | each → no descriptor, value in `unresolvedMarkers` | never a silent accept |
| T8 | `buildVillainAbilityHooks` over mock groups whose lines are copied **verbatim** from the regenerated `ca75.json` (Masters of Evil (WWII) ×4 + Man-Fish) | hooks: Black Knight onFight T4[0]; Executioner onFight T4[1] + onEscape `{ko-bystander-each-victory-pile}`; Melter onFight T4[2]; Radioactive Man onFight + onEscape `{gain-wound, each-non-savior}`; Man-Fish onFight T5[2]; Ambush captures unchanged; no `unresolvedMarkers` | |
| T9 | `countVictoryPileBystanders([v, 'pile-bystander', 'bystander-villain-deck-03', 'pile-wound'])`; `[]` | 2; 0 | pure, input not mutated |
| T10 | `findFirstVictoryPileBystander([v, 'bystander-villain-deck-03', 'pile-bystander'])`; `[v]` | `'bystander-villain-deck-03'`; `undefined` | |
| T11 | parity: Victory Piles with 0, 2, 3, 4 Bystanders (mixed arms) plus a villain id | `countVictoryPileBystanders(v) >= SAVIOR_BYSTANDER_THRESHOLD` === `evaluateCondition(G, '0', { type: 'bystandersInVictoryAtLeast', value: '3' })` for each | `SAVIOR_BYSTANDER_THRESHOLD === 3` |
| T12 | onFight hook `[{draw-cards-current, drawCount 1, requireCondition savior}]`, current `'0'` with 3 Bystanders, deck 2 cards; `executeVillainAbilities` called with `{ random: makeMockCtx().random }` as the shuffle context (5th arg) | hand +1; log `Fight effect: drew 1 card(s).` | without a shuffle context the draw handler no-ops (L2093-2097) |
| T13 | same with 2 Bystanders | hand unchanged; last message `Fight effect: Player 0 is not a Savior (2 of 3 Bystanders in their Victory Pile); no effect.` outcome `blocked`; no hollow record; no EffectTrace for it; results `[]` | gate before dispatch |
| T14 | current `'0'` has 0 Bystanders, player `'1'` has 3 | blocked as T13 with `(0 of 3 …)` | reads the current player only |
| T15 | onFight `[{ko-hero, current, requireCondition savior}]`, 3 Bystanders, two distinct Heroes in hand (`hero-a`, `hero-b`) | `G.pendingKoHeroChoices` equals `[{ choiceType: 'ko-hero', playerID: '0' }]`; results equal `[{ keyword: 'koHeroCurrentPlayer', targets: [], pending: true }]` | legacy narration intact (one Hero would auto-KO instead, L963-990, D-24007) |
| T16 | `{ko-hero, current, requireCitySpaces: [sewers], requireCondition: savior}` fought at `cityIndex 4` with 3 Bystanders; then at `cityIndex 0` with 1 Bystander | first: only the location-blocked line; second: only the Savior-blocked line | location checked first |
| T17 | `{gain-wound, each-non-savior}` onFight; players `0` (3 Bystanders, current), `1` (2), `2` (0); wounds pile 5 | players 1 and 2 gain 1 Wound each, 0 none; message `Fight effect: each player who is not a Savior gained a Wound (Player 1, Player 2).` `applied`; `woundsDrawn` unchanged | sorted order |
| T18 | same, current `'1'`; and onEscape timing | `woundsDrawn` +1; message starts `Escape effect:` | |
| T19 | all three players Saviors; and separately an empty wound pile | no Wound moves; `… no player who is not a Savior gained a Wound.` `blocked` | never throws |
| T20 | `{ko-bystander-each-victory-pile}` onEscape; victory `0: [v, 'bystander-villain-deck-01', 'pile-bystander']`, `1: ['pile-bystander']`, `2: [v2]` | `0` loses `bystander-villain-deck-01`, `1` loses `pile-bystander`, `2` unchanged; `G.ko` ends with those two in that order; `Escape effect: KO'd a Bystander from the Victory Pile of Player 0, Player 1.` `applied` | first in pile order, one per player |
| T21 | no player has a Bystander | nothing moves; `Escape effect: no player had a Bystander in their Victory Pile to KO.` `blocked` | |
| T22 | `fightVillain` (integration): villain V in the City with a `cardStats` fight cost and onFight `{draw-cards-current, drawCount 1, requireCondition savior}`; `G.attachedBystanders[V] = ['bystander-villain-deck-01']` (a Savior-counted id, not the `hostage-N` style); current player's Victory Pile holds 2 Bystanders and the deck holds a card; enough Attack | V defeated, the attached Bystander is awarded, Savior passes (3), hand +1 | rules L1849-1851 ordering |
| T23 | same with 1 Bystander in the Victory Pile | defeated; Savior-blocked line `(2 of 3 …)`; hand unchanged | |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** ca75 Masters of Evil (WWII) appears in 9 published gauntlet loadout rows (`packages/registry/src/gauntletLoadouts.generated.ts`). Their Fights now reward Saviors and Radioactive Man / Executioner now punish, so those legs change difficulty. No committed `data/par` artifact references either group, so nothing is re-pinned here; any future PAR run for those loadouts picks up the new behavior, the same fidelity shift every card WP carries.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (engine-only card fidelity, no paid or persuasive surface).

**Determinism preservation:**
- No new `G` field. The gate and both new behaviors read only `G`; iteration is sorted; no randomness beyond the existing draw / deck-reveal shuffle context.
- Narration goes to hash-excluded `G.messages` (D-24081).
- No hashed fixture plays these cards (Assumes 14), so `finalStateHash` and `PRE_WP080_HASH` are expected unchanged; if either moves, STOP and explain before any re-pin.
- **Replay-compat:** the server replays a stored match from its bgio `initialState` (`apps/server/src/replay/matchReplay.logic.ts`), which already holds the setup-time `G.villainAbilityHooks`, so pre-WP-816 matches replay identically on the new code. Only a path that re-runs setup from config + seed sees the new markers. Recorded in D-24749.

## Funding Surface Gate

§20 **N/A**: engine and card data only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Grammar.** T4-T7 pass in the engine parser. The marker script accepts the seven Locked-Values tokens (Verification 3). It has no test harness and runs `main()` on import, so its rejection side is checked by hand: put each T7 token into the marker map one at a time, run the script, observe a loud failure, revert. Record the eight observed failures in the EC-854 commit body.
2. **Types.** T1-T3 pass as runtime assertions.
3. **Helpers.** T9-T11 pass.
4. **Gate.** T12-T16 pass.
5. **Per-player exclusion.** T17-T19 pass.
6. **KO-a-Bystander.** T20-T21 pass.
7. **Rules ordering.** T22-T23 pass.
8. **Data.** `apply-effect-markers.mjs` prints `ca75.json — 7 new marker(s) this run` and `7 new [effect:] marker(s) appended`, then 0 new markers on a re-run; `git diff data/cards/` touches only `ca75.json`, and only those 7 lines, each gaining one trailing `[effect:…]` token; T8 passes on the regenerated lines.
9. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `cards:check`, `effect-index:check`, `ledger:villains:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check` exit 0 after the regeneration in Verification Steps; `mechanics:metadata`, `sim:runtime-observed` and `sim:coverage` need no regeneration.
10. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.
11. **Ledger rows.** In the regenerated `villain-mechanic-ledger.json`, the 6 new rows (Black Knight `ko-hero`; Executioner `draw-cards-current` and `ko-bystander-each-victory-pile`; Melter (WWII) `ko-cullable-each-deck-top`; Radioactive Man `gain-wound` (one row covering its Fight and Escape markers — the ledger keys rows per card per distinct mechanic); Man-Fish `gain-wound`, beside its existing `gainWoundEachPlayer` row) are `executable` with a handler, and `ko-bystander-each-victory-pile` carries WP-816 / D-24749 provenance. No mechanic name anywhere in the ledger contains `!` or `@`.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record before / after totals.
3. `node scripts/convert-cards/apply-effect-markers.mjs` → `7 new [effect:] marker(s) appended`; re-run → 0 new markers (idempotent). `git diff --stat -- data/cards/` → only `ca75.json`.
4. `pnpm -r build` again (the ledger reads the engine dist), then `pnpm ledger:villains && pnpm effect-index`.
5. `pnpm cards:check && pnpm effect-index:check && pnpm ledger:villains:check && pnpm mechanics:metadata:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0. If `mechanics:metadata:check`, `sim:runtime-observed:check` or `sim:coverage --check` flags, STOP: Assumes 13 is false.
6. `pnpm -r --no-bail test` → 0 fail.
7. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
8. Revert proofs, one at a time, each must fail at least one T-case: remove the executor condition gate; make `each-non-savior` wound Saviors too; make the KO handler take the **last** Bystander.

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the three revert proofs were observed.
- [ ] D-24749 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated, including the Killbot-as-Bystander Savior follow-up line.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] Two-commit topology: `EC-854:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a live match with the deployed gitSha checked, villain group `ca75/masters-of-evil-wwii` (mastermind `ca75/baron-heinrich-zemo`, which always leads it), driven via the operator setter pane or `/api/match/autoplay` setupData:
  - fight a Masters of Evil (WWII) Savior villain with fewer than 3 Bystanders → the log shows the "is not a Savior" line; with 3+ → the printed reward fires;
  - Radioactive Man's Fight wounds the non-Savior players only;
  - an escaping Executioner removes one Bystander from each Victory Pile that has one;
  - in a 2+-player `ca75/arnim-zola` match (always leads `zolas-creations`), fighting Man-Fish on the Sewers or the Bridge wounds every other player, and on another space logs the location-blocked line.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24749 — villain-savior-gate.** It locks:
- Savior on villain lines as data: the `!<condition>` marker suffix (last, at most one, case-sensitive closed set `VILLAIN_EFFECT_CONDITIONS = ['savior']`), lifted to `requireCondition`, outside `descriptorKey`;
- the gate's evaluation: the current player at every timing, after the location gate, before dispatch, fail-closed, self-narrated, no hollow record or trace;
- one Savior predicate for hero and villain (the two-arm Bystander id test, threshold 3), pinned by a parity test; Killbots excluded on both sides until a joint follow-up;
- `gain-wound` target `each-non-savior` (per-player exemption; the `each-other` precedent);
- `ko-bystander-each-victory-pile`: every player, first Bystander in pile order, to `G.ko` (the Whispers and Lies precedent), no choice;
- the rules-ordering note (Bystanders from the defeated villain count, already true by fight ordering);
- the limit: code that reads descriptors outside the executor loop (`villainCardEscapeTriggersSchemeTwist` ~L1494, the `play-villain-deck-cards` count reader ~L1607) does not see `requireCondition`, so a future gated marker on those primitives needs its own gate check;
- the villain-ledger normalizer stripping `!` and `@` suffixes;
- the replay-compat note (stored `initialState` replays are unaffected).

---

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent): NOT READY → two blocking text fixes, applied.**
- Verified against live code and data: card text verbatim; rules v23 L1844-1853 / L3715-3716; marker map rows and the `_unassigned` row; no existing `[effect:` value contains `!`, and every marker reader uses `[^\]]+`; parser anchors and the T4-T7 outcomes of a `!`-first split; 28 primitives, `descriptorKey`, T3; the executor location gate, handlers and map; fight ordering; the shared two-arm Bystander predicate; T9-T21 arithmetic and strings; feed inputs; no hashed fixture or PAR file; dependencies `[x]`; no layer or persistence issue.
- **PS-1 (fixed):** the villain ledger's `normalizeEffectToken` splits on `:` only, so `ko-cullable-each-deck-top!savior` would be an `unsupported` mechanic. The ledger script is now in scope with a locked normalizer, Assumes 13 says so, and AC 11 checks the 7 rows.
- **PS-2 (fixed):** T15 used one Hero, which auto-KOs (L963-990). It now uses two Heroes and locks the parked choice and the result.
- **RS-1 (fixed):** T12 / T22 / T23 name the shuffle context, `messages: []`, the Bystander id and the fight cost.
- **RS-2 (fixed):** the script's real output wording.
- **RS-3 (fixed):** AC 1 states the by-hand rejection method for the script.
- **RS-4 (fixed):** per-file test placement, `describe` grouping, T11's file and import, and T2's 28 → 29 pin edit.
- **RS-5 (fixed):** Assumes 14 covers `zolas-creations` and notes no PAR artifact; the Vision line no longer claims PAR drift.
- **RS-6 (fixed):** replay-compat reworded: stored `initialState` replays keep their setup-time hooks.
- **RS-7 (fixed):** `each-non-savior` returns `{ targets: [] }` only.
- **RS-8 (fixed):** the 00.2 §5 citation.
- **RS-9 (fixed):** the new `BYSTANDER_EXT_ID` import and the header update are locked.
- **RS-10 (fixed):** D-24749 records that out-of-loop descriptor readers do not see `requireCondition`.
- **RS-11 (fixed):** the live-verify DoD adds Man-Fish.
- **RS-12 (fixed):** anchors L687 and L204.
- **RS-13 (accepted):** the baseline is recorded at execution (EC Before Starting).

The reviewer ruled that only PS-1 needs a re-check (one file added to the allowlist); pre-flight round 2 below.

**Pre-flight (01.4), round 2 (same independent subagent): READY TO EXECUTE** after one text fix, applied (no round 3 needed per the reviewer).
- **PS-1 (fixed):** AC 11 / EC said 7 new ledger rows; the ledger keys rows per card per distinct mechanic, so Radioactive Man's two `gain-wound` markers make one row → 6. The marker / line count of 7 (AC 8, Verification 3) stays.
- **RS-1 (noted):** T12's `makeMockCtx` is a new import (`../test/mockCtx.js`) in the allowlisted executor test file.
- Verified: the locked normalizer names all 43 existing `[effect:` tokens identically to today (0 differ), so the only ledger changes are the new ca75 rows; each new token resolves `executable` with provenance; T15 parks with two Heroes; T12 / T22 / T23 inputs match the code; Locked Values, Assumes 13-14, replay note, D-24749 limit, Man-Fish live-verify and the WP ↔ EC allowlist all agree.

_Pending: 01.7 copilot check, 00.3 lint gate._

## Lint Gate Self-Review (00.3)

_Pending._
