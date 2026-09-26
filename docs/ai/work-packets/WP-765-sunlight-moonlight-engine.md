# WP-765 — Sunlight / Moonlight: the day-night rule, gated hero lines, hero Blood Frenzy (Game Engine + Card Data)

**Status:** Draft 2026-09-25
**Primary Layer:** Game Engine (hero conditions + keywords, UIState projection) + Card Data (hero markers)
**Dependencies:**
- WP-021 / 022 / 023 (hero keyword / parser / executor substrate)
- D-24055 (marker→condition, Spectrum)
- WP-545 / D-24354 (recruit-threshold)
- WP-735 / D-24555 (the Digest / Indigestion composite-keyword fusion)
- WP-740 (`countOtherInPlayMatchingCondition`)
- WP-754 / D-24581
- WP-382 / D-24183
- D-24570 (parsed-grant suppression)
- WP-128 / D-12803

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). The packet adds new conditions and keywords, a UIState field, and changes hero behaviour.
**Arc:** WP-765 (engine, this packet) → WP-766 (client badge). The villain-side follow-up is named in Out of Scope.

> Baseline: `origin/main` at `3955ba1e` plus the reserve commit (#2389).

---

## Goal

Legendary's **Sunlight / Moonlight** (rules v23 ~L1696-1731; `keywords-full.json` `moonlightsunlight`):

- **Moonlight** is in effect when most Heroes in the HQ have odd printed costs.
- **Sunlight** is in effect when most have even printed costs.
- On a tie, neither is in effect.
- Only printed costs count. Haunted Heroes count; haunters don't. A Divided Card counts once.
- Abilities resolve one at a time (~L2603-2610), so day/night is re-read for each line as it resolves.

**Today:**
- `[keyword:Sunlight]` / `[keyword:Moonlight]` is unrecognised and attaches no condition. **Every icon grant on these lines fires on every play.** Examples:
  - Analyze Planetary Rotation always gives +2 recruit **and** +2 attack.
  - Nanite always gives +3 / +3.
  - Starlit Path, Release the Beast, Ride by Moonlight and Creature of Dawn and Dusk always grant their icons.
- The remaining lines are hollow.
- Runtime hits: **moonlight 274, sunlight 107.**

**After this session:**
1. **Day/night rule.** A pure `computeDayNight(G)` helper decides the current state.
2. **Line conditions.** `sunlightInEffect` / `moonlightInEffect` conditions gate every tagged line.
3. **"Instead, you get both".** A composite `day-night-both` keyword handles the three upgrade cards.
4. **Blood Frenzy.** Hero keywords `blood-frenzy` / `blood-frenzy-recruit` are built on a new shared helper file, `economy/bloodFrenzy.logic.ts`. WP-760 is amended to consume it.
5. **Markers.** Curated markers route gated lines to shipped executors.
6. **Honest hollows.** A `DAY_NIGHT_UNMODELED_LINES` allowlist keeps the lines the engine can't yet do honestly hollow. They keep their gate, stay visibly unresolved, and grant nothing.
7. **Projection.** An omit-when-irrelevant `UIHQState.dayNight` field is exposed to the client.

## User-Visible Impact

- **Gated bonuses.** Midnight Sons and New Mutants heroes stop granting their day/night bonuses on every play; each bonus applies only in its state. Today these heroes are over-powered.
- **Blood Frenzy works** on Release the Beast, Creature of Dawn and Dusk, Mesmerize and Insatiable Craving.
- **Hollow lines resolve.** Draw, put-bottom, look-top and KO-Wound lines that were hollow now resolve.
- **No silent free grants.** The lines the engine can't model yet grant nothing, instead of granting free bonuses.
- **The badge** follows in WP-766.

---

## Assumes

1. **Parser** (`setup/heroAbility.setup.ts`):
   - `KEYWORD_PATTERN` is at `:124`.
   - The marker→condition arms are at `:1226-1303`, with `recruit-threshold` at `:1234`.
   - The unresolved-marker fallback is at `:1335`.
   - The Digest composite fusion: `DIGEST_INDIGESTION_CARDS` at `:516`, the fusion build at `:3055-3127` (`bothCondition` at `:3098`, `countRepeatedBothCondition` at `:3028`), and the handler at `hero/heroEffects.execute.ts:~5228-5253`.
   - The parser emits keyword effects **before** icon effects on a line.
2. **Conditions.**
   - `HeroCondition` is `{ type: string; value: string }` (`rules/heroAbility.types.ts:94`): a **bare string type, with no union and no canonical array**.
   - The condition drift pins are the runtime arrays `WAIT_AND_SEE_CONDITION_TYPES` (`hero/deferredConditionalGrants.ts:62`; test `:70/:119`) and `SEQUENCE_GATE_CONDITION_TYPES` (`hero/heroConditions.evaluate.ts:805`; test `:1390`).
   - `evaluateCondition` is at `:40` and `describeFailedCondition` at `:706`.
   - Hooks are evaluated per line, in order (`heroEffects.execute.ts:750-762`). Day/night hooks also count as Synergy Rate clauses (`:755`).
3. **Hollow detection.** `detectHollowHeroHook` (`:1045-1106`) returns early (`:1058`) on a hook shaped `{ keywords: [], conditions: [...] }`.
4. **State reads.** `G.hq` is a five-slot tuple, `null` when empty. `G.cardStats[id].cost` holds printed costs. `G.heroAbilityHooks` is a `HeroAbilityHook[]` with `conditions?`.
5. **Marker pipeline.**
   - `apply-hero-ability-markers.mjs` validates tokens against `VALID_TOKEN_PATTERN` (`:106`), which requires a `:1` magnitude on `optional-put-bottom-hq` and `optional-discard-draw`.
   - `inputs/hero-ability-markers.json` has an `nmut` section (`:1589`) but **no `mdns` section**.
   - `_deferred` entries are at `:2135` (Track the Captives) and `:2303` (Scalded by Sunlight).
6. **Ledger.** `scripts/hero-mechanic-ledger.mjs` reads **card data, not hooks**:
   - `KNOWN_CONDITIONS` (`:160-180`) classifies conditions.
   - `BY_HOOK_KEYWORDS` (`:155`) guards against by-name over-claims (the WP-736 precedent).
7. **Scoring VP.** The per-card VP authority is `scoring/scoring.logic.ts:64-150, :206`. WP-760 (drafted) specified the helper this packet now creates.
8. **UIState.** `UIHQState` is at `ui/uiState.types.ts:625`. The build is at `ui/uiState.build.ts:~2189`. The filter rebuilds `hq` field by field (`uiState.filter.ts:~463`).
8a. **Parallel packet: WP-757 (Haunt), executing 2026-09-25.** It also adds a field to `UIHQState` (`haunters?`) and a pass-through in the same `hq` filter rebuild. If it merges first, rebase onto it and keep **both** pass-throughs. This is a text conflict, not a design conflict.
9. **Scaffold observed at pre-flight (reverted).** `computeDayNight`, the two condition arms and the evaluator cases were built and tested:
   - Engine suite: **4235 / 0**. No drift pin, snapshot or hash moved.
   - Card, feed and coverage gates: OK.
   - `sim:runtime-observed:check` flagged stale. After regeneration, `moonlight` (274) and `sunlight` (107) vanished; `distinctMechanics` went 28 → 26 and `totalObservations` 2514 → 2133.
10. `pnpm -r build` exits 0 and the suites are green.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` ~L1696-1731 and ~L2603-2610.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative), `.claude/rules/architecture.md` §UIState Projection Integrity, and `.claude/rules/code-style.md` §Drift Detection.
- `docs/ai/DECISIONS.md`:
  - D-24055, D-24354, D-24555, D-24570, D-24581, D-24183, D-24497, D-24119 (replay verification).
  - D-24598 is reserved.
- WP-760, which is amended to consume the helper.
- User memory:
  - `reference_hero_ability_marker_curated_map`
  - `reference_hero_keyword_lockstep_sites`
  - `reference_sim_coverage_baseline_gate_distinct`
  - `reference_uistate_filter_whitelist_drops_fields`
  - `reference_inplay_totalobs_pin_stale_on_feed_regen`

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only, Node v22+.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves and effects never throw. No randomness. Engine and card data only.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24598) before coding. One WP per session.

**Packet-specific:**

- **`computeDayNight(G)`** lives in `rules/dayNight.logic.ts` (new) and is pure.
  - It reads `G.hq`, skips `null`, and uses the printed `cardStats[id].cost`.
  - More odd costs → `'moonlight'`. More even costs → `'sunlight'`. Otherwise → `'neither'`.
  - It **tolerates** an absent `G.hq` or `G.cardStats` (test mocks, and the minimal G in `heroConditionHoldsForInPlay`) by returning `'neither'`. It never throws.
- **Conditions.**
  - The parser arms `sunlight` → `{ type: 'sunlightInEffect', value: '' }` and `moonlight` → `{ type: 'moonlightInEffect', value: '' }` sit before `recruit-threshold` and the fallback.
  - `evaluateCondition` reads `computeDayNight(G)` at hook-resolution time.
  - `describeFailedCondition` → "it isn't Sunlight" / "it isn't Moonlight".
  - Neither type is added to `WAIT_AND_SEE_CONDITION_TYPES` or `SEQUENCE_GATE_CONDITION_TYPES`. A new runtime pin in `heroConditions.evaluate.test.ts` asserts both types have evaluate and describe cases.
- **"Both" fusion: the composite keyword `day-night-both`.** This is a no-magnitude, handled HeroKeyword on the Digest precedent.
  - It fuses a card's Sunlight line, its Moonlight line and its upgrade line into one hook. The descriptor carries `sunlightEffects`, `moonlightEffects`, `bothCondition` and optionally `bothConditionCount`, and the source tokens are consumed.
  - The handler works like this:
    - If `bothCondition` holds (counted per `countRepeatedBothCondition` / `countOtherInPlayMatchingCondition`), apply the Sunlight effects, then the Moonlight effects.
    - Otherwise, apply the branch `computeDayNight` selects.
    - On `neither`, apply nothing.
  - Allowlist `DAY_NIGHT_BOTH_CARDS` (all three verified to parse):

    | Card | Upgrade line |
    |---|---|
    | `mdns/werewolf-by-night/release-the-beast` | `[hc:instinct]` |
    | `nmut/warlock/analyze-planetary-rotation` | `[hc:tech]` |
    | `nmut/warlock/nanite-shapeshifter` | four `[team:x-men]` (→ `bothConditionCount: 4`) |

- **Honest hollows: `DAY_NIGHT_UNMODELED_LINES`.** For each listed line the arm still pushes the day/night condition. It **also** pushes `moonlight` / `sunlight` to `unresolvedMarkers`, and **drops the parsed attack/recruit grant** (the D-24570 suppression sibling). These lines therefore grant nothing and stay visible as hollows. The list:
  1. WbN Snarling Fangs — Moonlight
  2. WbN Track the Captives — Moonlight
  3. Morbius Scalded by Sunlight — Sunlight
  4. Sunspot Solar-Powered — Sunlight
  5. Sunspot Thermokinetic Fury — Sunlight
  6. Sunspot Empyreal Force — Sunlight
  7. Wolfsbane Night Vision — Moonlight
  8. Wolfsbane Nocturnal Savagery — Moonlight
  9. Mirage Haunted by the Demon Bear — Moonlight
- **Hero Blood Frenzy.**
  - `economy/bloodFrenzy.logic.ts` (new) exports `victoryPointValueForCard(G, playerId, cardId)` and `countDistinctVictoryPointValues(G, playerId)`.
  - `victoryPointValueForCard` mirrors scoring exactly: villain dynamic → printed → `VP_VILLAIN`; henchman; bystander; defeated tactic (`cardVictoryPoints[mastermind.baseCardId] ?? VP_TACTIC`); Undercover → `VP_UNDERCOVER`; otherwise `null`.
  - `countDistinctVictoryPointValues` returns the size of the set of non-null values.
  - A parity test pins the mirror against the breakdown sum. `computeFinalScores` is **not** refactored.
  - Keywords `blood-frenzy` (+N attack) and `blood-frenzy-recruit` (+N recruit), both no-magnitude, where N = `countDistinctVictoryPointValues(G, currentPlayer)`.
  - The raw `[keyword:Blood Frenzy]` text token needs no handling: `KEYWORD_PATTERN` never matches the space.
- **Keyword lockstep.** `HERO_KEYWORDS` and the handlers each grow by **3** (`blood-frenzy`, `blood-frenzy-recruit`, `day-night-both`). Re-read the base counts at execution; they were 69 / 53 at draft. Update every count site named by `reference_hero_keyword_lockstep_sites`, plus `NO_MAGNITUDE_KEYWORDS`.
- **Ledger lockstep** (`scripts/hero-mechanic-ledger.mjs`): `KNOWN_CONDITIONS` gains `sunlight` / `moonlight`. `blood-frenzy` and `day-night-both` join `BY_HOOK_KEYWORDS`, so a hero is `executable` only when its hook resolved the keyword. This avoids by-name over-claiming for Vengeance of the Bloodstone Gem and It's Morbin Time.
- **Synergy Rate.** Day/night conditions are **excluded** from the Synergy Rate clause count at `heroEffects.execute.ts:755`. Day/night is board state, not a synergy the player built, and counting it would log a guaranteed miss on every two-line card.
- **Blocked-line log.** Each unmet day/night line logs the standard "blocked — it isn't Sunlight/Moonlight" line. This is accepted and noted in D-24598.
- **Projection: `UIHQState.dayNight?: 'sunlight' | 'moonlight' | 'neither'`.**
  - It is built from `computeDayNight` and adds no `G` field.
  - It is **present iff** any hook carries a `sunlightInEffect` / `moonlightInEffect` condition **or** the `day-night-both` keyword. It is omitted otherwise.
  - The filter passes it through explicitly, for every audience.
- **Known deviation (D-24598).** An `optional-put-bottom-hq` line parks a choice, and a later day/night line on the same card is evaluated before that choice changes the HQ.
- **Determinism.** No randomness; only behaviour changes. Core oracles are unchanged, as shown by the scaffold. Replays of pre-WP-765 mdns/nmut matches won't re-execute identically, and **D-24119 re-verification of ranked mdns/nmut matches recorded before this WP will mismatch**. D-24598 records this.

## Card Map (locked)

**Markers appended at line end.** Keyword effects are emitted before icon effects, so the order doesn't matter.

| Card | Line | Marker(s) |
|---|---|---|
| WbN Starlit Path | Moonlight | `[keyword:draw:1]` |
| WbN Snarling Fangs | Sunlight | `[keyword:optional-put-bottom-hq:1]` |
| Blade Creature of Dawn and Dusk | Sunlight | `[keyword:optional-put-bottom-hq:1]` |
| Blade Creature of Dawn and Dusk | Moonlight | `[keyword:blood-frenzy]` |
| Morbius Mesmerize | Moonlight | `[keyword:blood-frenzy-recruit]` |
| Morbius Insatiable Craving | `[hc:covert]` line | `[keyword:blood-frenzy]` |
| Morbius Scalded by Sunlight | Moonlight | `[keyword:ko-wound-reward:attack:2]` (lift `_deferred` `:2303`) |
| Sunspot Absorb Radiation | Moonlight | `[keyword:optional-put-bottom-hq:1]` |
| Sunspot Absorb Radiation | Sunlight | `[keyword:draw:1]` |
| Warlock Nanite Shapeshifter | Sunlight | `[keyword:draw:3]` (fused) |
| Wolfsbane Wolf Out | Sunlight | `[keyword:optional-put-bottom-hq:1]` |
| Wolfsbane Wolf Out | Moonlight | `[keyword:draw:1]` |
| Wolfsbane Howl at the Moon | Moonlight | `[keyword:reveal-top-may-ko]` |
| Mirage Dreams Made Real | Moonlight | `[keyword:optional-discard-draw:1]` |
| Release the Beast, Analyze Planetary Rotation, Nanite Shapeshifter | the three lines | fused via `day-night-both`; Release the Beast's Moonlight carries `[keyword:blood-frenzy]` |

- **`hero-ability-markers.json`:** add a new `mdns` section; `nmut` extends its existing section.
- **Condition only** (icon lines): Ride by Moonlight, Searing Shards, Face Your Demons Sunlight, Starlit Path Sunlight.
- **Honest hollows:** the 9 lines in `DAY_NIGHT_UNMODELED_LINES`, plus Vengeance of the Bloodstone Gem (a doubled Marvel Knights Blood Frenzy prefix, D-22501 posture) and It's Morbin Time (a Blood Frenzy draw variant). The latter two are not day/night lines and stay inert, as they are today.

## Locked Values

- Condition types: `'sunlightInEffect'` and `'moonlightInEffect'`, each with `value: ''`.
- Helper: `computeDayNight` → `'sunlight' | 'moonlight' | 'neither'`.
- Keywords (no-magnitude): `'blood-frenzy'`, `'blood-frenzy-recruit'`, `'day-night-both'`. That is +3 to each count.
- Allowlists: `DAY_NIGHT_BOTH_CARDS` (3 cards) and `DAY_NIGHT_UNMODELED_LINES` (9 lines), both verbatim.
- Projection presence rule: as specified in Packet-specific above.
- The §Card Map tokens, verbatim.

---

## Scope (In)

- **A) Helper.** `rules/dayNight.logic.ts` (new) + test. Cases: odd, even, tie, empty, `null` slots, modified cost, absent `hq` / `cardStats`.
- **B) Conditions.**
  - Parser arms and both allowlists, plus the `day-night-both` fusion build, in `setup/heroAbility.setup.ts`.
  - Descriptor fields for `day-night-both` in `rules/heroAbility.types.ts`.
  - Evaluator and describer in `hero/heroConditions.evaluate.ts`, with the runtime pin.
- **C) Keywords and Blood Frenzy.**
  - `economy/bloodFrenzy.logic.ts` (new) + parity test.
  - `rules/heroKeywords.ts`: +3 keywords.
  - `hero/heroEffects.execute.ts`: +3 handlers and their registration, plus the Synergy Rate exclusion.
  - Every count drift site.
- **D) Markers.**
  - `apply-hero-ability-markers.mjs`: `VALID_TOKEN_PATTERN` accepts the three new keywords.
  - `inputs/hero-ability-markers.json`: the §Card Map rows, the new `mdns` section, and `_deferred` `:2303` lifted.
  - Regenerate `data/cards/{mdns,nmut}.json`.
- **E) Ledger.** `scripts/hero-mechanic-ledger.mjs` (`KNOWN_CONDITIONS`, `BY_HOOK_KEYWORDS`).
- **F) Projection.** The five-step across `uiState.types.ts`, `uiState.build.ts`, `uiState.filter.ts` and `uiState.filter.test.ts`, plus the diagnostics snapshot check.
- **G) Feeds.** Regenerate the effect index, `card-mechanics`, the hero ledger JSON / CSV, `runtime-observed-hollows` and the `sim:coverage` baseline. Re-pin the dashboard `totalObs`.
- **H) Tests.** Cover:
  - Release the Beast × {Sunlight, Moonlight, neither} × {with / without instinct}.
  - Analyze Planetary Rotation: the over-grant is gone.
  - Nanite with 4 X-Men.
  - Starlit Path draw.
  - Mesmerize recruit.
  - Insatiable Craving.
  - An unmodelled line (e.g. Solar-Powered) grants nothing and records a hollow.
  - A tie grants nothing.
  - Per-line re-read.
  - The projection presence rule, including a Warlock-only match.

## Out of Scope

- **The client badge** (WP-766).
- **Villain / mastermind / scheme day/night:**
  - fight-cost terms (Sister Nil, Crotus, N'astirh surcharge, Catseye, Thunderbird, Witchfire, Blackout);
  - Belasco's strikes;
  - Crash the Moon into the Sun;
  - the Switchblade un-defer.

  These are one named follow-up WP after WP-760, reusing both helpers.
- **The 9 unmodelled lines and the two non-day/night Blood Frenzy variants.** Named follow-ups.
- **Resolving the put-bottom ordering deviation.**
- **Face Your Demons line 0.** "4[icon:attack] Darkhold Demon" parses as +4 attack on every play. It is a separate papercut, flagged separately.

## Files Expected to Change

- `packages/game-engine/src/rules/dayNight.logic.ts` — **new**
- `packages/game-engine/src/rules/dayNight.logic.test.ts` — **new**
- `packages/game-engine/src/economy/bloodFrenzy.logic.ts` — **new**
- `packages/game-engine/src/economy/bloodFrenzy.logic.test.ts` — **new**
- `packages/game-engine/src/rules/heroAbility.types.ts` — modified (`day-night-both` descriptor fields)
- `packages/game-engine/src/setup/heroAbility.setup.ts` (+ `setup/heroAbility.setup.test.ts`) — modified (arms, both allowlists, fusion)
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` (+ test) — modified (evaluator, describer, runtime pin)
- `packages/game-engine/src/rules/heroKeywords.ts` (+ `rules/heroKeywords.test.ts`) — modified (+3 keywords)
- `packages/game-engine/src/hero/heroEffects.execute.ts` (+ `heroEffects.execute.test.ts`) — modified (+3 handlers, Synergy exclusion, count drift at every site)
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — modified (keyword array drift)
- `packages/game-engine/src/ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — modified
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json` — modified
- `scripts/hero-mechanic-ledger.mjs` — modified
- `data/cards/mdns.json`, `data/cards/nmut.json` — regenerated
- Derived feeds (G) plus the dashboard `totalObs` pin — regenerated / re-pinned
- Governance: `docs/ai/DECISIONS.md` (D-24598), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is about 24 files. Half are tests or regenerated feeds. The rest is one condition family and one keyword family across their locked lockstep sites.

## Contract

- The Locked Values.
- `countDistinctVictoryPointValues` / `victoryPointValueForCard` are the **shared** Blood Frenzy helpers, consumed by WP-760 and the villain-side follow-up.
- `computeDayNight` is the shared day/night authority.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules; these heroes are over-powered today), §23 / §24 (ranked fairness), NG-1.
**Conflict assertion:** none.
**Non-Goal proximity:** not crossed.
**Determinism:** pure reads, no randomness, core oracles unchanged (scaffold-observed). The replay and D-24119 re-verification note is recorded in D-24598.

## Funding Surface Gate

§20 **N/A**.

## API Catalog

§21 **N/A**.

---

## Acceptance Criteria

1. `computeDayNight` returns the right state for odd, even, tie, empty and mocked-absent HQs. Modified costs are ignored, and it never throws.
2. Every gated line fires only under its condition. Specifically, Analyze Planetary Rotation grants:
   - +2 recruit under Sunlight;
   - +2 attack under Moonlight;
   - both with a tech Hero;
   - nothing on a tie without one.

   Nanite grants draw 3 under Sunlight, +3 / +3 under Moonlight, and both with four X-Men.
3. Release the Beast gives +3 recruit under Sunlight and Blood Frenzy attack under Moonlight. It gives both with another instinct Hero, and nothing on a tie without one.
4. Blood Frenzy grants attack equal to the number of distinct VP values in the Victory Pile. Mesmerize grants the same amount as recruit, and Insatiable Craving applies Blood Frenzy under its covert condition. The parity test passes.
5. Every §Card Map marked line resolves under its condition. Every `DAY_NIGHT_UNMODELED_LINES` line grants nothing, and records a `moonlight` / `sunlight` hollow when its condition holds.
6. `UIHQState.dayNight` is present exactly per the presence rule, including a Warlock-only match. It passes the audience filter for every audience.
7. Drift and lockstep pins are green. That means the keyword and handler counts (+3 each), the new condition runtime pin, and `WAIT_AND_SEE` / `SEQUENCE_GATE` unchanged.
8. `cards:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`, `sim:runtime-observed:check` and `sim:coverage --check` all exit 0. In `runtime-observed-hollows`, `moonlight` / `sunlight` hits remain **only** for the named honest-hollow lines.
9. `pnpm -r build` → 0, and `pnpm -r --no-bail test` → 0 fail (including the dashboard `totalObs` pin). Core oracles are unchanged.

## Verification Steps

1. `pnpm -r build` → 0.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → the §Card Map rows update. Re-run it and expect 0 updates.
3. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → all 0. Regenerate first, and commit the regenerated feeds.
4. `pnpm --filter @legendary-arena/game-engine test` → all pass.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git diff --name-only` ⊆ Files Expected to Change. Revert `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24598 Active, covering: the rule, the conditions, `day-night-both`, the unmodelled-line suppression, hero Blood Frenzy with the shared helper, the Synergy exclusion, the presence rule, the known deviation, and the replay / D-24119 note.
- [ ] STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-802:` then `SPEC:`).
- [ ] **D-24026 live-verify (post-merge):** in a Werewolf by Night match, Release the Beast gives +3 recruit only when the HQ is majority even, and nothing on a tie. Recorded as a STATUS-flip.

## Reserved Decision (lands at execution)

**D-24598 — sunlight-moonlight.** It locks everything listed in the DoD item above.

---

## Lint Gate Self-Review (00.3)

- §1: all sections present.
- §2: boilerplate and protocol.
- §3: Assumes verified; the round-1 false claim about a HeroCondition union is corrected.
- §4: cited.
- §5: about 24 files, justified.
- §6: tokens validated against `VALID_TOKEN_PATTERN`.
- §7: all dependencies ✅.
- §8: engine + data.
- §9: pnpm.
- §10–11: N/A.
- §12: `node:test`.
- §13: exact commands.
- §14: 9 binary ACs.
- §15: STATUS, DECISIONS, indexes, live-verify.
- §16: 00.6.
- §17: satisfied.
- §18–21: N/A.

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent, with an observed scaffold): DO NOT EXECUTE YET.**

The scaffold (helper + arms + evaluator) ran at 4235 / 0 with no pins moved. Its only effect was that runtime-observed went stale, and after regeneration moonlight and sunlight vanished. The findings, all fixed in this revision:

- **PS-1:** `HeroCondition` is a bare string; the pins are the runtime arrays, and a new runtime pin is added.
- **PS-2:** the "both" fusion is now the composite `day-night-both` keyword (Digest precedent). Counts are +3, and `heroAbility.types.ts` is added.
- **Nanite** is confirmed to parse and is included.
- **PS-3:** the "none over-grants" claim was false. The `DAY_NIGHT_UNMODELED_LINES` suppression allowlist fixes it.
- **PS-4:** `:1` magnitudes added to the tokens; the Creature marker-order wording is corrected; a new `mdns` marker section is added.
- **PS-5:** ledger lockstep (`KNOWN_CONDITIONS`, `BY_HOOK_KEYWORDS`).
- **PS-6:** Insatiable Craving is mapped; Vengeance of the Bloodstone Gem and It's Morbin Time are named.
- **PS-7:** the presence rule now includes the fused keyword.
- **RS-1:** Synergy exclusion. **RS-2:** blocked log accepted. **RS-3:** absent-state tolerance. **RS-4:** D-24119 note.
- **WP-760 / EC-797:** the stale amendment spots are corrected.

**Scope verdict: READY TO EXECUTE.**

**Copilot (01.7): RISK → SUSPEND.** The findings covered §4, §6, §7 and §9 of the copilot checklist, and all are resolved above. Re-confirm: **CONFIRM** (final gate, 2026-09-25).
