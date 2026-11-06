# WP-866 — Next-hand extra draw: hero lines that print "When you draw a new hand this turn, draw an extra card" draw it (Game Engine + card data)

**Status:** Draft 2026-11-05 — pre-flight (01.4) READY TO EXECUTE (after PS-1..2; re-confirmed after every later edit); copilot (01.7) RISK → CONFIRM (round 2); lint (00.3) FAIL → PASS (round 2). See §Gate Record. EC-904; **D-24809** reserved (#3173).
**Primary Layer:** Game Engine (+ card-data-derived feeds, one ewiki page, one dashboard test pin)
**Dependencies:** none open. Builds on WP-497 / D-24300 (`G.handSizeOverrides`, the one-shot next-hand fill target, consumed by the end-of-turn cleanup), WP-543 / D-24352 (the villain `add-next-hand-size` primitive, the additive writer this mirrors), WP-701 / D-24520 (the new hand is drawn at END of turn), D-22501 (which deferred these lines as "no timing dispatch"), WP-844 / D-24778 (the magnitude hero-keyword shape and lockstep). All on `main`.
**User-Visible Surface:** `play.legendary-arena.com` (+ `ewiki.legendary-arena.com/turn-system/`)
**Risk Tier:** MEDIUM — gameplay rules (a new hero keyword handler writing the existing hashed `G.handSizeOverrides`) plus card data and derived determinism feeds; no auth, money, persistence or server surface
**Lane:** Standard (two-session). A new handler-bearing `HeroKeyword` touches eight engine code/test files (Lightweight Lane criterion #2), is a gameplay surface (criterion #6), and moves two derived determinism feeds (D-24028).

> Baseline: `origin/main` @ `adbe8c14134d10968c155af53f17db404e9afb32` (2026-11-05), with the reserve commit for WP-866 / EC-904 / D-24809 (#3173) on top. The scaffold ran at `260af872` (one commit earlier; the only later commit is the WP-864 ledger reservation). Re-baseline at execution and re-read every line anchor and pin value.

---

## Goal

As a player whose hero card says "When you draw a new hand this turn, draw an extra card", I want my next hand to have that extra card, so the card does what it prints. Today the line does nothing at all: no effect, no log line, and no hollow breadcrumb in most cases. Operator match `vZXSkk4xJNC` (2026-11-05) played Wasp's *Infiltrate* six times and never drew the extra card.

After this session the twelve hero lines below raise the playing player's end-of-turn hand by their printed number of extra cards (one, two or three). Gated lines (`[hc:X]:`, `[keyword:Outwit]:`) raise it only when the gate is met, as other gated lines behave. Several copies in one turn stack.

## User-Visible Impact

On play.legendary-arena.com, playing Wasp's *Infiltrate* logs `Player 0 will draw 7 cards on their next hand (+1 extra, Infiltrate (<card id>)).`, and at the end of that turn the player draws seven cards instead of six. Playing a second copy the same turn makes it eight. Captain Britain's *Lead the Captain Britain Corps* adds three. Viv Vision's *Expanding Neural Network* adds one only if you played a [Tech] card, and Bruce Banner's *Solve the Impossible* only when Outwit is met. Nothing changes for any other card. The ewiki Turn System page names the effect in its hand-draw lifecycle.

---

## Assumes

1. **Rules.** "When you draw a new hand of cards at the end of this turn, draw an extra card" changes the size of the hand drawn in that turn's cleanup. The shorter "When you draw a new hand this turn" wording (amwp, co2e) is the same effect. The Savage Land Mutates villain Fight line with the same text already runs as +1 next-hand (D-24352).
2. **The field (WP-497 / D-24300, D-24352).** `types.ts` L2132 `handSizeOverrides?: Record<string, number>` (lazily created, never seeded). `moves/endOfTurnCleanup.logic.ts` L131 fills to `G.handSizeOverrides?.[playerID] ?? HAND_SIZE` and L147-148 deletes the entry after that one fill. The ending player's own entry is consumed at the end of the same turn, so a write during the turn raises that turn's new hand. `HAND_SIZE = 6` is exported from `moves/drawCards.logic.ts` L25, whose imports (`zoneOps`, `setup/shuffle`, a type) close no cycle with the executor.
3. **The template writer.** `villain/villainEffects.execute.ts` `villainEffectAddNextHandSize` (the function after `villainEffectOverrideNextHandSize`, about L2930-2980): lazy-init the container, then `G.handSizeOverrides[currentPlayer] = (G.handSizeOverrides[currentPlayer] ?? HAND_SIZE) + extraCards`. The hero handler is the same write for the playing player. Both writers share one accumulator, so Infiltrate plus a defeated Savage Land Mutates makes eight.
4. **The template keyword.** `gain-sidekick` (WP-844 / D-24778): a magnitude hero keyword. Its handler `heroEffectGainSidekick` is at `hero/heroEffects.execute.ts` L2182. `HANDLED_KEYWORDS` starts at L153 (last entry `'feast'`, L381). `NO_MAGNITUDE_KEYWORDS` starts at L558. `HERO_EFFECT_HANDLERS` starts at L7239 (last entry `feast: heroEffectRevealTopMayKo`, L7457). `hero/heroEffects.execute.ts` L53 already imports `reshuffleDiscardIntoDeck` from `moves/drawCards.logic.js`.
5. **The parser needs no edit.** `setup/heroAbility.setup.ts` Step 2 pushes any `isValidHeroKeyword` match from `KEYWORD_PATTERN` and records the `:N` magnitude. The effect builder emits `{ type: keyword, magnitude }`. A leading `[hc:X]:` becomes a `heroClassMatch` condition, and `[keyword:Outwit]:` becomes `distinctHeroCostsAtLeast` 3. Scaffold-observed (Assumes 12) on the real data: Infiltrate → `onPlay`, `[{ type: 'next-hand-extra-draw', magnitude: 1 }]`, no conditions; Lead the Captain Britain Corps → magnitude 3; Expanding Neural Network → plus `heroClassMatch` / `tech`; Solve the Impossible → plus `distinctHeroCostsAtLeast` / `3`.
6. **Magnitude pre-gate.** `executeSingleEffect` runs only `MVP_KEYWORDS` (derived from `HANDLED_KEYWORDS`). `failsMagnitudePreGate` drops a keyword without a valid magnitude unless it is in `NO_MAGNITUDE_KEYWORDS`. The new keyword always carries `:N`, so it is NOT added to `NO_MAGNITUDE_KEYWORDS`.
7. **Why a new hero keyword name.** `scripts/coverage/mechanic-provenance.json` is one flat `mechanics` map keyed by mechanic name, and `"add-next-hand-size"` (L74) is the villain primitive's WP-543 / D-24352 row. Reusing that string would attribute the hero rows to WP-543. The hero keyword is `next-hand-extra-draw`.
8. **Lockstep pins (read again at execution; they go stale if another hero-keyword WP lands first, and WP-863 / WP-864 / WP-865 are in flight):** `HERO_KEYWORDS.length` = 93 at three sites: `rules/heroKeywords.test.ts` L66-71 (the `it` title and message name WP-862), `rules/heroAbility.setup.test.ts` L697-701 (`93` on L699; the ordered `expectedKeywords` array's last entry is L694, `'hq-hero-gains-size-changing-tech'`; L726-730 is a uniqueness check, not a pin), `setup/heroAbility.setup.test.ts` L1604. `Object.keys(HERO_EFFECT_HANDLERS).length` = 72 at `hero/heroEffects.execute.test.ts` L152 and L8119. The union's last member is `'feast'` (`rules/heroKeywords.ts` L119); the array's last entry is `'hq-hero-gains-size-changing-tech'` (L221). Append the new value last in both.
9. **Token allowlist.** `apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN` (L147) has no `next-hand-extra-draw` form; `assertValidToken` exits 1 on an unlisted token. Its last branch is `^\[keyword:hq-hero-gains-size-changing-tech\]$`.
10. **Client.** `apps/arena-client/src/lib/abilityMarkers.ts` `isEngineOnlyKeyword` drops any `[keyword:…]` value containing `:`, and the registry-viewer's copy (`apps/registry-viewer/src/composables/useRules.ts`) does the same, so the marker never shows to a player. No client change. The Test Contract uses existing exports: `buildHeroAbilityHooks` (`setup/heroAbility.setup.ts`), `executeSingleEffect` (`hero/heroEffects.execute.ts`), `applyEndOfTurnCleanup` (`moves/endOfTurnCleanup.logic.ts`).
11. **No migration.** Hero hooks are captured in a match's `initialState` at setup, so in-flight matches and stored replays keep the old hollow hook. Only matches created after the deploy draw the extra card (memory `reference_setup_hook_change_replay_compat`).
12. **Scaffold (2026-11-05, in this draft worktree at `260af872`, reverted before the draft commit; a rough prototype of Scope (In) A, B and D without the new test file, the pin bumps or the ewiki edit):** `pnpm -r build` 0. `apply-hero-ability-markers.mjs` → `Updated: 13 lines` with Slapstick included, `Updated: 0` on a re-run, `--validate` no drift. A parse probe on the committed data showed Slapstick's `[keyword:Excessive Violence]:` line parsing with **no gate** (Context, "Why Slapstick is out"), so it was dropped. Re-run: 12 lines in 11 set files. Engine suite 6294 / 6299: the only five failures are the five lockstep pins (Assumes 8). `executeSingleEffect` with magnitude 1 then 2 on an empty override → `handSizeOverrides['0']` 7 then 9, two `applied` lines. After regeneration, `cards:check`, `ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `cards:count-markers:check`, `gauntlet:loadouts:check`, `gauntlet:configs:check` and `sim:coverage --check` all exit 0. Hash oracles unchanged (the replay-fixture and `PRE_WP080` tests are among the passing 6294).
13. **Expected derived-feed deltas (scaffold-observed; the executor confirms each, and any other delta is a STOP unless it is pre-existing drift per §Non-Negotiable Constraints):**
    - `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`: twelve `next-hand-extra-draw` rows, `executable`, WP-866 / D-24809 once the provenance key is in. The `co2e/spider-man-miles-morales (unmarked)` and `gotg/groot (unmarked)` rows are replaced (858 rows observed without provenance).
    - `data/metadata/effect-implementation-index.json` and `data/metadata/card-mechanics.json`: regenerated with the new mechanic.
    - `docs/ai/coverage/runtime-observed-hollows.json`: `totalObservations` 7724 → 7701, `parse-unrecognized` 7203 → 7180. Several mechanics' hit counts move both ways. This is a **trajectory shift**: bigger hands change which cards the fixed-seed sweep plays, the WP-862 / D-24806 re-pin precedent. No mechanic changes status.
    - `scripts/coverage/hero-effect-coverage.baseline.json` (`pnpm sim:coverage --update-baseline`): corpus `executable` 3885 → 3936, `noEffect` 2406 → 2355 (−51, the twelve lines weighted by copy count); per-set rows move for amwp, chmp, co2e, cosm, gotg, msmc, rlmk, ssw2, vill, wwhk, xmen. `EXECUTED_KEYWORDS` is now `MVP_KEYWORDS` (`scripts/hero-effect-coverage.mjs` L89), so no label edit is needed.
    - `apps/dashboard/src/composables/useInPlayCoverage.test.ts` L665: `totalObs` 8687 → 8686. `resolvedObs` stays 1091 and `percentResolved` stays 12.6 (scaffold-observed with the pin at 8686).
    - `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`: line-ending churn only (`git diff --ignore-cr-at-eol` empty). Revert it.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Inventory (every card line in `data/cards/*.json` printing "draw/have a new hand … this turn, draw an/two/three extra card(s)", scanned 2026-11-05).**

  **In scope — twelve hero lines:**

  | Set | Hero / card | Ability | Printed text (prefix) | Marker |
  |---|---|---|---|---|
  | amwp | wasp / infiltrate | 1 | When you draw a new hand this turn, draw an extra card. | `next-hand-extra-draw:1` |
  | amwp | freedom-fighters / mystics | 0 | When you draw a new hand this turn, draw an extra card. | `next-hand-extra-draw:1` |
  | chmp | viv-vision / expanding-neural-network | 1 | `[hc:tech]:` … an extra card. | `next-hand-extra-draw:1` |
  | co2e | spider-man-miles-morales / web-trap | 0 | `[hc:instinct]:` … an extra card. | `next-hand-extra-draw:1` |
  | cosm | adam-warlock / regenerative-cocoon | 1 | … draw two extra cards. | `next-hand-extra-draw:2` |
  | gotg | groot / surviving-sprig | 0 | … an extra card. | `next-hand-extra-draw:1` |
  | msmc | warpath / endless-endurance | 0 | … draw two extra cards. | `next-hand-extra-draw:2` |
  | rlmk | karnak / brilliant-strategist | 1 | `[hc:covert]:` … an extra card. | `next-hand-extra-draw:1` |
  | ssw2 | captain-britain / lead-the-captain-britain-corps | 0 | … draw three extra cards. | `next-hand-extra-draw:3` |
  | vill | dr-octopus / brilliant-research | 0 | `[hc:tech]:` … an extra card. | `next-hand-extra-draw:1` |
  | wwhk | bruce-banner / solve-the-impossible | 0 | `[keyword:Outwit]:` … an extra card. | `next-hand-extra-draw:1` |
  | xmen | polaris / ride-the-magnetic-waves | 1 | `[hc:covert]:` … an extra card. | `next-hand-extra-draw:1` |

  **Out of scope:** see §Out of Scope (Slapstick, two Focus lines, S.H.I.E.L.D. Level 3, Patrol the Bridge, Lightshow, Fantomex's compound line, the msp1 Hydra Spies henchman, and eight villain / tactic `Fight:` lines). The scan regex in EC-904 §Before Starting returns 28 lines in all.
- **Why a hero keyword with a magnitude.** Every in-scope line is "+N to your next hand", optionally behind a gate the parser already reads. A `[keyword:next-hand-extra-draw:N]` marker rides the generic Step 2 + effect-builder path (Assumes 5), so the setup parser is untouched and the magnitude passes the pre-gate (Assumes 6). One handler covers N = 1, 2 and 3.
- **Why additive, at play.** The effect is recorded when the card resolves and consumed by the cleanup draw that same turn (Assumes 2). It is additive like D-24352, so two copies, or a copy plus Savage Land Mutates, stack. An absolute override (core Doctor Octopus villain, `override-next-hand-size`) written later in the same turn still replaces the total. That is the shipped villain-side order and stays as it is (§Out of Scope).
- **Why Slapstick is out.** `[keyword:Excessive Violence]:` executes only for the cards on the `EXCESSIVE_VIOLENCE_CARDS` allowlist (`setup/heroAbility.setup.ts` L845, D-24556). `dead/slapstick` is deliberately not on it. The scaffold showed that marking its line makes the effect fire on play with **no** Excessive Violence gate, which is worse than today's honest hollow. Enrolling it means adding the card to that allowlist and confirming the fused EV hook dispatches this keyword at fight time: a parser change, so a follow-up.
- **The `_deferred` block.** `hero-ability-markers.json` `_deferred` holds an entry for chmp viv-vision / expanding-neural-network / 1 (D-22501, "no timing dispatch"). It is stale once the line is marked, so this WP removes it. The wpnx fantomex / misdirection / 1 entry stays: its put-a-card-on-top rider is still unwired.
- **Determinism.** No RNG, no new `G` field, no `TurnEconomy` field. The write lands in an existing, lazily created, hashed field that the villain primitives already write. The marker reaches only matches whose Hero Deck holds one of these cards. The fixed-seed runtime-observed sweep plays some of them and shifts trajectory (Assumes 13). The sentinel fixture and `PRE_WP080` use core / empty registries and stay byte-identical.
- `docs/ai/ARCHITECTURE.md` §The Rule Execution Pipeline, §Zone & Pile Structure, §Layer Boundary.
- `docs/ai/DECISIONS.md`: D-24300, D-24307, D-24352, D-24520, D-22501, D-24556, D-24778, D-24017, D-24021, D-24372 before coding.
- User memory: `reference_hero_keyword_lockstep_sites`, `reference_hero_ability_marker_curated_map`, `reference_sim_coverage_baseline_gate_distinct`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_setup_hook_change_replay_compat`, `feedback_ec_locked_value_stale_baseline`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+, `node:` prefix. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No `Math.random`, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24809) before coding. One WP per session.

**Packet-specific:**
- No new `G` field, no `TurnEconomy` field, no contract-file edit (`rules/heroAbility.types.ts` byte-unchanged; `HeroEffectDescriptor` already has `type: HeroKeyword` and `magnitude?: number`). `moves/endOfTurnCleanup.logic.ts`, `moves/drawCards.logic.ts` and `villain/villainEffects.execute.ts` byte-unchanged.
- `setup/heroAbility.setup.ts` byte-unchanged. If the generic path does not build the effect at execution, STOP: it is a finding, not a parser edit to make silently.
- `next-hand-extra-draw` joins lockstep sites 1-4 (memory `reference_hero_keyword_lockstep_sites`). Site 5 (`NO_MAGNITUDE_KEYWORDS`) is deliberately excluded, and site 6 (the parser) needs nothing per Assumes 5. Each pin is a **runtime** assertion (D-24372).
- Card data changes only through `apply-hero-ability-markers.mjs`; a re-run applies 0. New map entries are appended to each set's existing array keeping the file's existing entry formatting (no whole-file `JSON.stringify` rewrite: the scaffold's rewrite reflowed 30 unrelated lines). amwp is an outlier set whose committed `data/cards/amwp.json` is its own base (the #3151 precedent); the marker pass edits it in place like any other set.
- Every derived-feed delta matches Assumes 13. A delta outside it that also appears when the same generator runs on a clean `origin/main` checkout is pre-existing drift: record it in the `EC-904:` commit body (the WP-843 / WP-844 precedent). Any other delta is a STOP.

## Locked Values

- **Keyword / effect type:** `next-hand-extra-draw`. **Marker:** `[keyword:next-hand-extra-draw:N]`, N ≥ 1. **`VALID_TOKEN_PATTERN` branch:** `^\[keyword:next-hand-extra-draw:[1-9]\d*\]$`, appended after `^\[keyword:hq-hero-gains-size-changing-tech\]$`, with a `// why: WP-866 / D-24809` line in the comment block below the pattern.
- **Curated entries** (append; `markupToken` `[keyword:next-hand-extra-draw:1]` unless stated):
  - `amwp`: `wasp` / `infiltrate` / 1; `freedom-fighters` / `mystics` / 0.
  - `chmp`: `viv-vision` / `expanding-neural-network` / 1. `co2e`: `spider-man-miles-morales` / `web-trap` / 0.
  - `cosm`: `adam-warlock` / `regenerative-cocoon` / 1 → `:2`. `gotg`: `groot` / `surviving-sprig` / 0.
  - `msmc`: `warpath` / `endless-endurance` / 0 → `:2`. `rlmk`: `karnak` / `brilliant-strategist` / 1.
  - `ssw2`: `captain-britain` / `lead-the-captain-britain-corps` / 0 → `:3`. `vill`: `dr-octopus` / `brilliant-research` / 0.
  - `wwhk`: `bruce-banner` / `solve-the-impossible` / 0. `xmen`: `polaris` / `ride-the-magnetic-waves` / 1.
  - Remove the `_deferred` entry `chmp` / `viv-vision` / `expanding-neural-network` / 1.
- **`rules/heroKeywords.ts`:** `| 'next-hand-extra-draw'` appended last in the `HeroKeyword` union (the `;` moves from `'feast'`) and `'next-hand-extra-draw'` appended last in `HERO_KEYWORDS`, each with a `// why: WP-866 / D-24809 —` comment naming the printed "draw a new hand … draw an extra card" family, the magnitude, the additive `handSizeOverrides` write, and the D-24352 villain sibling.
- **Handler** (`hero/heroEffects.execute.ts`, beside `heroEffectGainSidekick`): `function heroEffectNextHandExtraDraw(G: LegendaryGameState, _ctx: unknown, playerID: string, cardId: CardExtId, effect: HeroEffectDescriptor): void`:
  1. `extraCards = effect.magnitude ?? 0`; if `extraCards < 1` return with no log (defensive: `VALID_TOKEN_PATTERN` never emits 0).
  2. If `G.handSizeOverrides === undefined`, set it to `{}`.
  3. `nextHandSize = (G.handSizeOverrides[playerID] ?? HAND_SIZE) + extraCards`; `G.handSizeOverrides[playerID] = nextHandSize`.
  4. One log line, card `cardId` as the 4th `pushLog` argument, `{card}` = `formatCardRef(G.cardDisplayData, cardId)`: `` `Player ${playerID} will draw ${String(nextHandSize)} cards on their next hand (+${String(extraCards)} extra, ${card}).` `` — `'applied'`.
- **Import:** add `HAND_SIZE` to the existing L53 import: `import { HAND_SIZE, reshuffleDiscardIntoDeck } from '../moves/drawCards.logic.js';` (no second import line from that module).
- **Sets:** `'next-hand-extra-draw'` appended last to `HANDLED_KEYWORDS` (after `'feast'`, with a `// why:` saying it has a handler and carries a magnitude, so it is NOT in `NO_MAGNITUDE_KEYWORDS`); `'next-hand-extra-draw': heroEffectNextHandExtraDraw` appended last to `HERO_EFFECT_HANDLERS` (after `feast`) with a `// why:`.
- **Pins:** the three `HERO_KEYWORDS.length` pins 93 → 94 (their title / message text names `next-hand-extra-draw (WP-866 / D-24809)`); `expectedKeywords` appends `'next-hand-extra-draw'` last with a WP-866 `// why:`; both `HERO_EFFECT_HANDLERS` count pins 72 → 73.
- **Provenance:** `"next-hand-extra-draw": { "wp": "WP-866", "decision": "D-24809" }` in `scripts/coverage/mechanic-provenance.json`, after the `hq-hero-gains-size-changing-tech` key.
- **Dashboard pin:** `useInPlayCoverage.test.ts` `totalObs` 8686, `resolvedObs` 1091, `percentResolved` 12.6, with a dated WP-866 / D-24809 provenance comment in the existing chain format.

---

## Scope (In)

- **A) Keyword + handler** — `rules/heroKeywords.ts`; `hero/heroEffects.execute.ts` (handler, import, `HANDLED_KEYWORDS`, `HERO_EFFECT_HANDLERS`).
- **B) Tests** — `hero/nextHandExtraDraw.test.ts` (new; T1-T11) and the five pin bumps in `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`.
- **C) Card data** — the `VALID_TOKEN_PATTERN` branch; twelve curated entries and the one `_deferred` removal; `data/cards/{amwp,chmp,co2e,cosm,gotg,msmc,rlmk,ssw2,vill,wwhk,xmen}.json` (12 lines) regenerated by the pass.
- **D) Derived feeds** — `mechanic-provenance.json`; the regenerated ledger, effect index, card-mechanics feed, runtime-observed artifact and coverage baseline (Assumes 13); the dashboard pin.
- **E) ewiki** — `wiki/turn-system.md`: in "Hand draw & discard lifecycle", one bullet saying hero lines that print "When you draw a new hand … draw an extra card" add to the same one-shot `handSizeOverrides` fill (keyword `next-hand-extra-draw`, additive with Savage Land Mutates, consumed by that turn's cleanup). Add a History entry and D-24809 to References, add `../packages/game-engine/src/hero/heroEffects.execute.ts` and `../scripts/convert-cards/inputs/hero-ability-markers.json` to the frontmatter `source:` list if absent (the file's `../`-relative form), and bump `last-reviewed`.

## Out of Scope

- **dead Slapstick *Surprise Chainsaw*** (`[keyword:Excessive Violence]:`): the EV gate applies only to `EXCESSIVE_VIOLENCE_CARDS` (Context). Follow-up: enrol it in that allowlist with a fused-hook dispatch test.
- **Keyword-timed lines whose keyword does not execute a trailing marker today:** anni Super-Skrull *Stretching Credibility* and ff04 Mr. Fantastic *Twisting Equations* (`[keyword:Focus]`, a pay-to-activate cost no hero line executes yet); shld Agent Phil Coulson *Impeccable Planning* (`[keyword:S.H.I.E.L.D. Level 3]`); xmen Dazzler *Citywide Mega-Concert* (`[keyword:Lightshow]`, +2); ssw2 Time-Traveling Jean Grey *Bridge to a Better Future* (`[keyword:Patrol the Bridge]: If it's empty, …`). None of the five has a marked line in the corpus today. Follow-up: mark each when its keyword's dispatch lands.
- **wpnx Fantomex *Misdirection* / 1:** "draw an extra card, then put a card from your hand on top of your deck." The extra draw is this keyword, but the rider is a deferred hand-on-deck-top that fires after the new hand. Its `_deferred` entry stays. Follow-up: a post-fill rider.
- **msp1 Hydra Spies henchman** (`[keyword:Fight]:` …): a villain line. The villain `add-next-hand-size` primitive covers it, but `apply-effect-markers.mjs` matches only a literal `Fight:` prefix, not `[keyword:Fight]:`. Follow-up: teach the villain pass the keyword-form prefix.
- **Villain and mastermind-tactic `Fight:` lines with the same text** (villain side, the curated `villain-effect-markers.json` / tactic dispatch, not this hero keyword): chmp *Monsteroso* (+1), cvwr *Cursed Dynasty*, ff04 *Giganto*, mgtg *I'm a Celestial Sweetheart*, msis *Hear Me and Rejoice* (+2 each) carry no marker today, and co2e *Treasures of Latveria* (+3) is missed by the core-only tactic-id dispatch (`rules/tacticHandlers.ts` L170). The villain `add-next-hand-size` primitive covers the shape. Follow-up: a villain-marker sweep (with the Hydra Spies prefix above). Core Savage Land Mutates and core Treasures of Latveria already work.
- **Override ordering:** an absolute `override-next-hand-size` (core Doctor Octopus villain, the co2e Octet tactic) written after this effect in the same turn replaces the total. That is shipped villain behavior (D-24307); this WP does not change it. Because heroes are usually played before a fight, the common order (hero +N, then Doc Ock's absolute 8) loses the +N; the reverse order gives 9 (T8). Whether "instead of six" should replace only the base needs a rules ruling. Follow-up: an order-independent base / extra model.
- **Three hero lines outside the strict scan regex, same family:** cosm Moondragon *Peaceful Meditation* ("if you didn't fight anything this turn, draw an extra card": the condition is read at end of turn, so marking it `next-hand-extra-draw:1` would fire after a fight; it needs a cleanup-time condition), co2e Miles Morales *Jump Dimensions* (the count is the cards discarded) and *Spider Camouflage* (a set-aside card added to the new hand: the `deferredHandInjections` shape). They stay unmarked. Follow-up each.
- **The Deck Probability Panel's next-hand projection** (`apps/arena-client/src/components/play/handProjection.ts` L82-83, WP-609 / D-24420) still assumes `HAND_SIZE`, so after Infiltrate it projects 6 while the engine draws 7 (the villain writers already cause this). Reflecting the override needs a new UIState field (the five-step contract). Follow-up.
- **The client, UIState, server, registry and parser.** No "next hand: 7" indicator on the board: the log line is the surface.

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/heroKeywords.ts` — modified; `rules/heroKeywords.test.ts` — modified (pin)
- `rules/heroAbility.setup.test.ts` — modified (pin + order array)
- `setup/heroAbility.setup.test.ts` — modified (pin only)
- `hero/heroEffects.execute.ts` — modified; `hero/heroEffects.execute.test.ts` — modified (two pins)
- `hero/nextHandExtraDraw.test.ts` — **new**

**Scripts / data**
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — modified (pattern + `// why:`)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — modified (12 entries + 1 `_deferred` removal)
- `data/cards/amwp.json`, `chmp.json`, `co2e.json`, `cosm.json`, `gotg.json`, `msmc.json`, `rlmk.json`, `ssw2.json`, `vill.json`, `wwhk.json`, `xmen.json` — regenerated by the pass
- `scripts/coverage/mechanic-provenance.json` — modified (one key)
- `scripts/coverage/hero-effect-coverage.baseline.json` — regenerated (`pnpm sim:coverage --update-baseline`)
- `docs/ai/coverage/hero-mechanic-ledger.json`, `.csv`; `data/metadata/effect-implementation-index.json`; `data/metadata/card-mechanics.json`; `docs/ai/coverage/runtime-observed-hollows.json` — regenerated
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — modified (one re-pin + provenance comment)

**ewiki:** `wiki/turn-system.md` — modified

**Governance close:** `docs/ai/DECISIONS.md` (D-24809), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED annotation), `docs/ai/coverage/live-verify.json` (live-verify record, or operator-pending).

That is 29 code / test / data / wiki files (7 engine, 20 scripts / data, 1 dashboard test, 1 wiki page): 1 new, 28 modified or regenerated. The hand-written code is two engine source files, one new test, and three script inputs. The count is above 00.3 §5's ~8-file guide only through the lockstep pins, the eleven regenerated card files and the regenerated feeds every hero-keyword WP carries (the WP-844 precedent). No 01.6 post-mortem trigger fires: no new contract, abstraction, builder or wiring category; the keyword follows the existing hero-keyword category and writes an existing field.

## Contract

- **Keyword** `next-hand-extra-draw` (union + `HERO_KEYWORDS`, magnitude N ≥ 1). **Marker** `[keyword:next-hand-extra-draw:N]`. **Effect** `{ type: 'next-hand-extra-draw', magnitude: N }`.
- **Behavior:** at resolve, `G.handSizeOverrides[playerID] = (G.handSizeOverrides[playerID] ?? HAND_SIZE) + N`, lazily creating the container; one `applied` log line. The existing end-of-turn cleanup draws to that target and deletes the entry.
- `executeSingleEffect`, `executeHeroEffects`, `applyEndOfTurnCleanup`, both villain hand-size primitives and every existing keyword keep their behavior.

## Test Contract

All in `hero/nextHandExtraDraw.test.ts`. Parser cases build hooks with `buildHeroAbilityHooks` from the **committed** `data/cards/*.json` (the `amwpWaspSizeChanging.test.ts` `CARDS_DIRECTORY` + one-set registry shape), so they fail on today's data. Handler cases dispatch through the exported `executeSingleEffect` on a minimal `G`, never by calling `heroEffectNextHandExtraDraw` directly.

| # | Input | Expected | Invariant / must NOT |
|---|---|---|---|
| T1 | Committed amwp: wasp / infiltrate ability 1 hook | `timing` `onPlay`; `effects` deep-equals `[{ type: 'next-hand-extra-draw', magnitude: 1 }]`; no `heroClassMatch` condition; `unresolvedMarkers` absent or empty | the line is no longer hollow |
| T2 | Committed amwp: freedom-fighters / mystics ability 0 | same effect, magnitude 1 | |
| T3 | Committed ssw2 captain-britain / lead-the-captain-britain-corps; cosm adam-warlock / regenerative-cocoon; msmc warpath / endless-endurance | magnitude 3, 2, 2 | magnitude read from the marker |
| T4 | Committed chmp viv-vision / expanding-neural-network ability 1 | the effect plus a `heroClassMatch` / `tech` condition | the gate is kept |
| T5 | Committed wwhk bruce-banner / solve-the-impossible | the effect plus a `distinctHeroCostsAtLeast` / `3` condition (Outwit) | the Outwit gate is kept |
| T6 | `executeSingleEffect(G, ctx, '0', cardId, { type: 'next-hand-extra-draw', magnitude: 1 })`, no `handSizeOverrides` | returns `true`; `G.handSizeOverrides` deep-equals `{ '0': 7 }`; one log line, the locked text (expected text built with `formatCardRef(G.cardDisplayData, cardId)`, which renders `<id> (<id>)` on empty display data), outcome `'applied'`, `card === cardId` | lazy init, HAND_SIZE base |
| T7 | T6 then magnitude 2 on the same `G` | `{ '0': 9 }`; second line names 9 and `+2` | additive stacking |
| T8 | `handSizeOverrides: { '0': 8, '1': 6 }` then magnitude 1 for `'0'` | `{ '0': 9, '1': 6 }` | adds to an existing target (the override-first order); other seats untouched |
| T9 | T6's `G` with a 10-card deck, `hand` 2 cards, then `applyEndOfTurnCleanup` for `'0'` | hand length 7 after the cleanup; `G.handSizeOverrides?.['0'] === undefined` (the container stays as `{}`) | the shipped consumer draws the extra card, once |
| T10 | Control: the effect with no `magnitude` | `executeSingleEffect` returns `false`; no `handSizeOverrides` key | the magnitude pre-gate still guards it |
| T11 | Committed dead slapstick / surprise-chainsaw ability 0 | no `next-hand-extra-draw` effect on any hook for the card (today it builds an `onFight` hook with `unresolvedMarkers: ['excessive-violence']`) | a regression guard, green on today's data too: Slapstick stays out (EV gate) |

T9 builds its `G` and shuffle provider the way `moves/endOfTurnCleanup.logic.test.ts` does (`applyEndOfTurnCleanup(G, playerID, shuffleProvider)`, L99).

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §2, §22 (determinism), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed. A printed hero ability now does what it prints. A bigger hand is in-game card flow; no money, cosmetic or account state reaches it.

**Determinism preservation:** no RNG, no new `G` or `TurnEconomy` field, no setup default. Hash oracles (sentinel `finalStateHash`, `PRE_WP080_HASH`) unchanged (scaffold). The runtime-observed artifact and the coverage baseline move only as Assumes 13 names; both are regenerated, not hand-edited. **Replay-compat:** hooks live in `initialState`, so a match created before the deploy replays identically; live-verify uses a match created after it.

## Funding Surface Gate

§20 **N/A**: engine gameplay and card data. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Parser.** T1-T5 and T11 pass on the committed data with `setup/heroAbility.setup.ts` byte-unchanged.
2. **Handler.** T6-T8 pass, including the exact log text, outcome and card attribution.
3. **Consumer.** T9 passes with `moves/endOfTurnCleanup.logic.ts` byte-unchanged.
4. **Lockstep.** The keyword is in the union, `HERO_KEYWORDS`, `HANDLED_KEYWORDS` and `HERO_EFFECT_HANDLERS`, and not in `NO_MAGNITUDE_KEYWORDS`. The three `HERO_KEYWORDS`-length pins and both handler-count pins move +1 from their execution-time values, the order array gains the value last, and T10 passes.
5. **Card data.** The twelve lines end with their locked marker; a re-run of the pass applies 0; `--validate` reports no drift; no other line changes; `pnpm cards:check` exits 0; the viv-vision `_deferred` entry is gone.
6. **Feeds.** Every Assumes 13 delta is observed and nothing else beyond pre-existing drift recorded per §Non-Negotiable Constraints; every `:check` gate in Verification 3 exits 0 after regeneration.
7. **Gates.** `pnpm -r build` 0; `pnpm -r --no-bail test` 0 failures; hash oracles unchanged.
8. **ewiki.** `wiki/turn-system.md` documents the effect; `pnpm wiki-viewer:project` then `pnpm wiki-viewer:check-links` exit 0.

## Verification Steps

1. `pnpm -r build` → 0; `pnpm --filter @legendary-arena/game-engine test` → 0 fail; record the total before any edit.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → `Updated:` 12; again → `Updated:` 0; `--validate` → no drift. `git diff --stat -- data/cards` lists only the eleven set files in Scope (In) C.
3. `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`, `pnpm sim:coverage --update-baseline`; diff each against Assumes 13 (`git diff --ignore-cr-at-eol`); then `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`, `pnpm cards:count-markers:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`, `pnpm gauntlet:loadouts:check`, `pnpm gauntlet:configs:check` → each exits 0.
4. `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` and `pnpm --filter @legendary-arena/dashboard run prebuild:effect-index`; re-pin `useInPlayCoverage.test.ts`; `pnpm -r build`; `pnpm -r --no-bail test` → 0 fail (server suites need `TEST_DATABASE_URL`; record whether they ran). Then `pnpm --filter @legendary-arena/dashboard typecheck`, `lint`, `run format:check`, `run test:coverage` → each 0.
5. **Control run:** remove `'next-hand-extra-draw'` from `HANDLED_KEYWORDS` only → T6 fails (`executeSingleEffect` returns `false`, no override); restore.
6. **Revert proof:** make the handler write `= HAND_SIZE + extraCards` (absolute) → T7 and T8 fail; restore.
7. `pnpm wiki-viewer:project` then `pnpm wiki-viewer:check-links` → 0.
8. `git status --porcelain` (tracked + untracked) ⊆ Files Expected to Change. Revert line-ending-only churn (`packages/lagn-spec/schemas/lagn-v1.json`, `villain-mechanic-ledger.*`).

## Definition of Done

- [ ] AC 1-8 pass; the control run and the revert proof were observed; the diff is allowlist-only.
- [ ] D-24809 appended to `DECISIONS.md` as Active, superseding D-22501's deferral for these lines. `docs/ai/STATUS.md` updated, naming every §Out of Scope item as a follow-up.
- [ ] `wiki/turn-system.md` updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0; NUMBER-LEDGER lines annotated LANDED.
- [ ] Two-commit topology: `EC-904:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a `play.legendary-arena.com` match created after the deploy (deployed gitSha checked) with Wasp (amwp) in the Hero Deck: play *Infiltrate*, see the `applied` log line naming 7, end the turn, and see seven cards in hand. Recipe (auto-memory `reference_operator_match_live_verify_recipe`): an operator match via `?route=workshop` → Paste loadout JSON whose `heroDeckIds` include `amwp/wasp`; with the setters, give +6 Recruit, place Infiltrate in an HQ space and recruit it, move it from discard to hand, play it, end the turn, count the hand. Optional: two copies → eight. Use a loadout with no core Doctor Octopus villain, no core Savage Land Mutates, no Dr. Doom or co2e Doc Ock mastermind and no Magneto, and fight nothing that turn, so nothing else changes the hand size. Drive it with Claude in Chrome (the admin session is needed for the Operator checkbox) and read the hand count from `uiState.snapshot.players[0].handDisplay.length`. After the ewiki deploy, `ewiki.legendary-arena.com/turn-system/` returns 200 and contains `next-hand-extra-draw` (curl with the `CF-Access-Client-Id` / `CF-Access-Client-Secret` service-token headers). Recorded in `docs/ai/coverage/live-verify.json`, STATUS and D-24809, or operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24809 — hero-next-hand-extra-draw.** It locks:
- `next-hand-extra-draw` as a magnitude-bearing hero keyword (`[keyword:next-hand-extra-draw:N]`) riding the generic parser path, so the setup parser is unchanged and a leading `[hc:X]:` or `[keyword:Outwit]:` stays a faithful gate;
- the effect writes `(G.handSizeOverrides[player] ?? HAND_SIZE) + N` at resolve, the D-24352 additive write, into the existing WP-497 field, consumed once by the existing end-of-turn cleanup: no new `G` field, no second consumption site, so hero and villain bonuses stack; it keys on the resolving `playerID`; every current dispatch path (including Copy Powers and the Steal Abilities re-fire) is active-seat only, so it equals `currentPlayer`; a future non-active resolver would carry the bonus to that seat's next cleanup and must re-check this; the common order (hero +N, then an absolute Doc Ock override) loses the +N, an open rules question left as a follow-up;
- the keyword is named apart from the villain primitive because `mechanic-provenance.json` is one flat map keyed by mechanic name;
- D-22501's "no timing dispatch" deferral was wrong for this family: the effect needs no end-of-turn trigger, only a write at play that the shipped cleanup reads;
- the twelve in-scope lines and the Out of Scope items (Slapstick's EV allowlist, the five keyword-timed lines, Fantomex's rider, the Hydra Spies `[keyword:Fight]:` prefix, the six unmarked villain / tactic `Fight:` lines, override ordering, Moondragon *Peaceful Meditation* and Miles Morales *Jump Dimensions* / *Spider Camouflage*, the Deck Probability Panel projection), each a follow-up;
- the expected derived-feed movement (runtime-observed −23 raw observations from a trajectory shift, coverage `noEffect` −51 / `executable` +51, dashboard `totalObs` −1) and no hash-oracle movement;
- replay-compat: hooks are captured at setup, so only matches created after the deploy draw the extra card.

---

## Gate Record

All three gates ran as independent subagents.

**Pre-flight (01.4): READY TO EXECUTE once PS-1..2 applied (both applied).** The reviewer ran the full scaffold in a throwaway worktree at `adbe8c14`: every Locked Value applied, T1-T11 written and 11 / 11 passing, engine 6299 / 0 → 6310 / 0 (the five pin bumps the only existing-test edits), `pnpm -r --no-bail test` 0 fail in every package, marker pass `Updated: 12` then 0 with `--validate` clean, all ten `:check` gates 0, every Assumes 13 number matched, the dashboard pin at 8686 passing, control run (T6-T9 fail) and revert proof (exactly T7, T8 fail) observed, and the Slapstick ungated-parse claim confirmed in memory.
- **PS-1 (fixed):** the last `HANDLED_KEYWORDS` / `HERO_EFFECT_HANDLERS` entry is `feast` (L381 / L7457), not `hq-hero-gains-size-changing-tech`; the Sets lock now says "appended last, after `feast`".
- **PS-2 (fixed):** `heroEffects.execute.ts` L53 already imports from `drawCards.logic.js`; `HAND_SIZE` folds into that line.
- **RS-1..6 (applied where text changed):** T6 expected text via `formatCardRef`; T9 asserts the entry, not the container, is gone; T11 named a regression guard (green today); cleanup delete anchor L147-148.
- **Re-confirm (after the copilot and lint edits): READY TO EXECUTE, no new PS.**

**Copilot (01.7), round 1: RISK (HOLD), six fixes, all applied.** 1. three same-family hero lines outside the strict regex (Moondragon *Peaceful Meditation*, Miles Morales *Jump Dimensions* / *Spider Camouflage*) named Out of Scope; 2. the realistic override order (hero +N then Doc Ock's absolute 8 loses the +N) stated as an open rules follow-up, T8 labelled the override-first order; 3. the Deck Probability Panel's `HAND_SIZE` projection named a follow-up; 4. the `playerID` write key locked in D-24809 and the handler `// why:`; 5. log text aligned to the Treasures of Latveria sibling ("on their next hand"); 6. live-verify loadout constraints and the snapshot field to read. **Round 2: PASS → CONFIRM**; one P2 nit (exclude Savage Land Mutates and Dr. Doom from the live-verify loadout, fight nothing) applied.

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 runs. Run 1 FAILED §15.2 (no `**Risk Tier:**` line, D-24800) and the EC-TEMPLATE app-package rule (dashboard `typecheck` / `lint` / `format:check` missing from EC Before Starting); both fixed. Run 2 PASS, with two non-blocking notes applied (file count 29, regen commands named in EC After Completing).

| § | Result |
|---|---|
| §1 | PASS — every required section; Out of Scope closed (9 items); 8 ACs |
| §2 | PASS — engine-wide block, session protocol, packet constraints, Locked Values |
| §3 | PASS — Assumes 1-13 with line anchors and feed deltas; BLOCKED if any is false |
| §4 | PASS — ARCHITECTURE sections, D-ids, memories; 00.2 not needed (marker append, no schema change) |
| §5 | PASS — 29 files marked new / modified / regenerated; size justified (WP-844 precedent); gitignored prebuild outputs omitted |
| §6 | PASS — the twelve slugs / indexes / magnitudes match `data/cards` |
| §7 | PASS — no new dependency |
| §8 | PASS — engine plus data; no new `G` field, RNG, persistence or parser edit |
| §9 | PASS — `pnpm` / `node` / `git` only |
| §10 | N/A — no new environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — `node:test`, committed-data parser tests, `executeSingleEffect` dispatch, control run + revert proof |
| §13 | PASS — exact commands with expected values, dashboard CI gates included |
| §14 | PASS — 8 binary ACs tied to T1-T11 and the feeds |
| §15 / §15.1 | PASS — DoD covers ACs, allowlist, STATUS, DECISIONS, indexes; D-24026 live-verify recipe with loadout constraints |
| §15.2 | PASS — Risk Tier MEDIUM, EC verbatim; not HIGH, so no threat model |
| §16 | PASS — full words, JSDoc, `// why:` sites enumerated, no `.reduce()`, no throws |
| §17 | PASS — §1 / §2 / §22 / NG-1; conflict line; determinism + replay-compat |
| §18 | N/A — no literal-string grep step |
| §19 | N/A at draft — commit-time (baseline SHA cited) |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason |

**Verdict:** PASS.
