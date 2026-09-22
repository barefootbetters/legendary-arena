# WP-741 — Doubled Superpower icons need that many OTHER matching cards ("Critical Hit" count fidelity) (Engine)

**Status:** Ready
**Primary Layer:** Game Engine / Implementation
**User-Visible Surface:** `play.legendary-arena.com`
**Dependencies:** WP-740 / D-24562 ✅ (`93514f86`, #2275 — landed `countOtherInPlayMatchingCondition` and the digest-scoped `bothConditionCount` this WP builds on and retires), WP-179 / D-17904 ✅ (`heroClassMatch` / `requiresTeam` evaluation + self-exclusion), WP-703 / D-24523 ✅ (dual-class `heroClass2`), D-24074 ✅ (Size-Changing class grants via `cardHasClassWhenPlayed`), D-24391 ✅ (`cardCountsAsTeamMember`, incl. teamless basic S.H.I.E.L.D. tokens)
**Lane:** Standard (two-session). NOT lightweight-lane eligible: edits a contract file (`rules/heroAbility.types.ts`), changes gameplay outcomes, and moves setup-built `G.heroAbilityHooks` data (a hashed surface).

> Baseline: `origin/main` at `1475218f` (WP-738 / #2276), which includes the WP-741 reserve commit `497fe918` (#2272) and WP-740's execution `93514f86` (#2275). WP-740 merged mid-draft; the scaffold was re-run on `1475218f` and every §Assumes line ref below is against it.

---

## Goal

After this session, a printed Superpower whose leading icon prefix repeats an icon — `[hc:tech][hc:tech]:`, `[team:shield][team:shield][team:shield]:`, `[hc:strength][hc:strength][hc:ranged][hc:ranged]:` — fires only when the player has played **that many OTHER cards** bearing each repeated icon earlier this turn. The card itself never counts. Another copy of the same card (a different `#N` instance) does count. Single-icon Superpowers, mixed-icon pairs (`[hc:tech][hc:strength]:`), and "for each other [hc:X]" count lines behave exactly as today.

---

## User-Visible Impact

Today every doubled / tripled / quadrupled icon Superpower is satisfied by **one** other matching card. Example: **Bishop — Concussive Blast** (`dkcy`, `[hc:ranged][hc:ranged]: You get +3 Attack`) grants +3 after a single other Ranged Hero. The rulebook requires two. The same under-gate applies to 35 printed cards (§Context inventory). Eight carry a non-hollow gated hook today: five with a real numeric or Undercover payoff, and three (Gamora, Ice Magic, Enchantress) whose printed text parses to magnitude-less `attack`/`recruit` descriptors the handler skips, so for those only the blocked-ability log line changes:

| Card | Prefix | Gated effect today |
|---|---|---|
| `dkcy/bishop/concussive-blast` | ranged ×2 | +3 Attack |
| `gotg/gamora/galactic-assassin` | covert ×2 | attack hook |
| `amwp/janet-van-dyne/subatomic-size` | covert ×2 | +2 Attack |
| `ssw1/captain-marvel/cosmic-energies` | strength ×2 + ranged ×2 | +6 Attack |
| `ssw2/dr-punisher-soldier-supreme/ice-magic` | ranged ×2 | attack |
| `vill/enchantress/irresistible-bribe` | covert ×2 | recruit/attack |
| `shld/victoria-hand/victoria-hand` | shield ×3 | Undercover |
| `shld/yo-yo-rodriguez/yo-yo-rodriguez` | shield ×2 | Undercover |

After this WP the five payoff cards (Bishop, Janet, Cosmic Energies, Victoria Hand, Yo-Yo) fire only with the printed number of other matching cards, and all eight log the count-aware blocked line. The other 27 gate hollow (effect-less) hooks today; their gates become faithful for whenever their effects are un-hollowed. When a doubled gate fails, the blocked-ability line names the count: "it needs 2 other ranged Heroes played this turn".

This is a **difficulty increase** on the affected cards (fewer free fires). That is the point — it is the printed rule.

---

## Assumes

- **WP-740 / D-24562 landed (`93514f86`)** with exactly this surface:
  - `countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId: CardExtId): number` — `hero/heroConditions.evaluate.ts` L356. `triggeringCardId` is **required**. heroClassMatch via `cardHasClassWhenPlayed`, requiresTeam via `cardCountsAsTeamMember`; skips the exact instance id; 0 for other types, missing zones, or missing `cardTraits`. Unit-tested at `heroConditions.evaluate.test.ts` L1535–1580.
  - `HeroEffectDescriptor.bothConditionCount?: number` — `rules/heroAbility.types.ts` L200–206.
  - The private `countRepeatedBothCondition(conditions)` — `setup/heroAbility.setup.ts` ~L2938 — and its use in `buildDigestIndigestionFusion` (~L2980–3007). The `DIGEST_INDIGESTION_CARDS` comment at ~L513 says the "both" line "carries bothConditionCount 2".
  - `isDigestBothConditionMet(G, playerID, cardId, effect)` — `hero/heroEffects.execute.ts` L4853 — takes the helper branch when `bothConditionCount > 1`, else `evaluateAllConditions(G, playerID, [bothCondition], cardId)`. The helper is imported at L35. The handler JSDoc (~L4883) lists `bothConditionCount?`.
  - Tests naming the field: `rules/heroAbility.setup.test.ts` L2468 (fused-hook deep-equal) and L2472–2482 ("leaves bothConditionCount unset for a mixed 'both' line (D-24562 lock 5)"); `hero/heroEffects.execute.test.ts` L7271 (hand-built `crowdHook()`).
  - `rules/heroKeywords.ts` L89 descriptor-shape comment.
  - D-24562 lock 4 records this WP's path: a later doubled-icon WP "may keep `bothConditionCount` … or retire it."
- **Parse today (`setup/heroAbility.setup.ts` Step 1a L839–904 / Step 1b L906–930):** both regexes scan the WHOLE line and push one condition per token. `[hc:ranged][hc:ranged]:` → two identical `{type:'heroClassMatch',value:'ranged'}`. Conditions are then concatenated heroClass-first, team-second (L934). `parseAbilityText` is module-private.
- **Evaluation today (`hero/heroConditions.evaluate.ts` L52–91):** `heroClassMatch` / `requiresTeam` return true on the FIRST other in-play match; `evaluateAllConditions` (L406) ANDs, so N identical conditions are satisfied by one card. `describeFailedCondition` is at L706.
- **Instance ids are per-copy** (`${baseExtId}#${copyIndex}`, `setup/buildCardTraits.ts` L215), so exact-id self-exclusion leaves a second copy countable — matching the rulebook's "could be another copy of Hidden Weapons".
- **Rulebook** (`docs/legendary-universal-rules-v23.md` L683–696, "'Critical Hit' Superpower Abilities"): a two-icon Superpower needs cards with both icons played earlier in the turn; the card itself does not satisfy its own requirement; another copy does. **Multiclass** (L3110–3116): a multiclass card "counts as both [X] and [Y]" and is "great at enabling" `[X][Y]` Superpowers — one multiclass card satisfies a mixed pair.
- `pnpm -r build` exits 0; engine suite, `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` green on baseline (post-WP-740).

---

## Context (Read First)

- **Why a separate WP.** WP-740 fixed the doubled gate for one card, scoped inside the `digest-indigestion` descriptor, and explicitly deferred the repo-wide gap here (WP-740 §Out of Scope; D-24562 lock 4).
- **Corrected inventory (measured at draft, not estimated).** A scan of every `abilities[]` line in `data/cards/*.json` whose line **starts with** an `[hc:X]` / `[team:X]` run followed by `:` and repeats a token:
  - **32 identical-repeat lines** (32 cards): covert×2 (3), tech×2 (3), strength×2 (3), ranged×2 (2), instinct×2 (2), venomverse×2 (3), avengers×2 (2), shield×2 (1), fantastic-four×2, marvel-knights×2, sinister-six×2, crime-syndicate×2 (1 each), shield×3 (3), covert×3 (1), guardians-of-the-galaxy×3 (1), shield×4 (2), x-men×4 (1), avengers×4 (1).
  - **3 mixed lines with repeats**: `ssw1/captain-marvel/cosmic-energies` (strength×2 + ranged×2), `ssw1/namor-the-sub-mariner/imperius-rex` (strength×2 + instinct×2), `ssw2/beast/multi-variable-smackulus` (tech×2 + strength×2).
  - **13 mixed distinct-icon lines** (e.g. `[hc:tech][hc:strength]:`, `rlmk/crystal` 4-class) — unchanged by this WP.
  - **No Core-set card** carries a doubled prefix. The earlier "~95 lines" estimate counted token occurrences, including the out-of-scope families below.
- **The landmine this design avoids (61 lines repeat a condition token outside a repeated leading prefix).** Breakdown (re-derived independently at pre-flight):
  - **32 single-icon Superpowers that repeat their icon mid-sentence** — core `iron-man/arc-reactor` (`[hc:tech]: … for each other [hc:tech] Hero`), core `captain-america/a-day-unlike-any-other`, core `cyclops/x-men-united`, `ssw1/captain-marvel/absorb-energies`, the Empowered "by [hc:X]" lines, and more. Each parses to two identical conditions today, and a naive "count condition multiplicity in the array" evaluator would wrongly demand two other Tech Heroes for Arc Reactor.
  - **2 that also have a repeated prefix** — `shld/victoria-hand` and `ca75/steve-rogers-director-of-shield/reassign-to-civilian-duty` (prefix ×3 plus a mid-sentence `[team:shield]`).
  - **27 with no leading icon run** — 6 Cyber-Mod (5 doubled + `2099/ghost-rider-2099/infernal-chainsaw`), 16 Size-Changing, 3 X-Gene, Pure Fury, and a Queen Storm Empowered line.

  **Multiplicity is therefore read ONLY from the leading icon prefix**, never from the condition array.
- **Out-of-scope families that also print repeated icons:** 5 `[keyword:Cyber-Mod][hc:X][hc:X]:` lines (`2099`; Cyber-Mod is a Victory-Pile mechanic, rulebook L1254–1262, not a play-this-turn gate) and ~16 `Microscopic Size-Changing [hc:X]…` lines (`amwp`, `antm`; tokens are class GRANTS routed to `sizeChangingClasses`, D-24074). Neither line starts with an icon run, so the prefix rule excludes both mechanically.
- **Draft-time scaffold (observed, then reverted).** A prototype — `requiredMatches?` on `HeroCondition`, a leading-prefix collapse after the L934 concat, and a count loop in the two `evaluateCondition` cases (no `bothConditionCount` retirement) — ran twice: first on `497fe918` (pre-WP-740), then re-run on `1475218f` (post-WP-740). Results on `1475218f`:
  - Parse: Bishop → `[{heroClassMatch ranged, requiredMatches:2}]`; Arc Reactor → unchanged `[{heroClassMatch tech},{heroClassMatch tech}]`; Victoria Hand → `[{requiresTeam shield, requiredMatches:3},{requiresTeam shield}]`; Cosmic Energies → `[{strength, requiredMatches:2},{ranged, requiredMatches:2}]`.
  - Engine suite **4117 tests: 4116 pass / 1 fail**. The one failure is WP-740's fused-hook deep-equal (`rules/heroAbility.setup.test.ts` L2468): the "both" line now arrives as one condition carrying `requiredMatches: 2`, so the fusion no longer derives `bothConditionCount`. That is the planned migration (AC 8), not a regression. Pre-WP-740 the suite was 4101 / 0. No hash re-pin in either run.
  - `apps/server` `sequenceTeacher.logic.test.ts` 12/0. `sim:coverage --check`, `cards:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check` all 0.
  - `sim:runtime-observed:check` **FAILED (stale)**, confirmed caused by the change (the baseline check passes). Regenerating moved `totalObservations` 2528 → 2527 (one `teleport` observation). `apps/dashboard` stayed 482/0 against the regenerated artifact: the `useInPlayCoverage.test.ts` `totalObs` pin (3012) is a max(baseline, live) and held.
- **Determinism exposure (measured).** The change alters `G.heroAbilityHooks` only for matches that include one of the 34 affected hero decks. The sentinel fixture (`sentinel-core-doom-2p`) uses core heroes only; `PRE_WP080_HASH` uses test heroes; no `data/par`, `data/gauntlet-configs.json`, `data/sweep-fixtures`, `data/difficulty-ratings`, or engine test fixture references an affected hero. Expected: **no hash re-pin**. The runtime-observed sweep does include 19 affected heroes, hence its regen.
- **Deploy-boundary note (persisted hooks).** boardgame.io's match blob persists `initialState.G.heroAbilityHooks` (D-24095), and replay/verification re-executes it (D-24119). The new semantics live in hook DATA (`requiredMatches`), so a pre-deploy match of the 34 non-digest cards keeps its setup-time hooks and evaluates at count 1, exactly as it originally played. **Play to the Crowd is the exception:** a match created after WP-740's deploy and before this one carries `bothConditionCount: 2` with a bare `bothCondition`; after this deploy the handler ignores that field, so such a match (in flight or replayed) fires "both" off one Venomverse card. Accepted: one card, the window between the two deploys. The live-verify must use a match created after the deploy.
- **Sequence teacher (server, D-24533).** `heroConditionHoldsForInPlay` delegates to `evaluateCondition` and receives the hook's condition object whole, so it inherits the count with no server change. A doubled gate that one reorder cannot satisfy simply yields no tip.
- **Memory refs:** `reference_hashed_g_field_dual_repin`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_sim_coverage_baseline_gate_distinct`, `feedback_ec_locked_value_stale_baseline`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full-file edits only; ESM; Node 22; `.claude/rules/code-style.md` + `docs/ai/REFERENCE/00.6-code-style.md` (full-word names, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries).
- Moves and effects never throw. `G` stays JSON-serializable; `requiredMatches` is a plain number on a setup-built hook (D-24095). Zones store `CardExtId` strings only.
- Determinism: no `Math.random`, no clock, no I/O in engine code. The parser change is pure string work at setup time.

**Packet-specific:**
- **Multiplicity comes ONLY from the leading icon prefix.** A line matches `LEADING_ICON_PREFIX_PATTERN` only when it STARTS (after optional whitespace) with one or more `[hc:X]` / `[team:X]` tokens followed by `:`. Tokens later in the line never add multiplicity. Lines starting with any other token (`[keyword:…]`, prose) are untouched.
- **Collapse, then count.** For each distinct (`type`, `value`) whose prefix multiplicity m ≥ 2, the FIRST emitted matching condition becomes `{…, requiredMatches: m}` and the next m − 1 emitted identical conditions are dropped. Any further identical conditions (mid-sentence tokens) stay as plain conditions. Conditions the Step 1a/1b suppression flags never emitted are not synthesized.
- **Collapse ordering.** The collapse runs immediately after the L934 concat. The downstream Empowered param splices (L1027 / L1150, via `findFirstHeroClassMatchIndex`) remove the first matching `heroClassMatch`; no current repeated-prefix line carries Empowered (the AC 1 sweep proves it). If one ever does, STOP: the splice would remove the collapsed prefix gate.
- **Omit-when-one.** `requiredMatches` is emitted only when ≥ 2. Every hook without a repeated prefix is byte-identical to baseline.
- **Only `heroClassMatch` and `requiresTeam` honor `requiredMatches`.** Both cases become `countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId) >= effectiveRequired`, where `effectiveRequired` is `requiredMatches` when it is an integer > 1 and 1 otherwise. Every other condition type ignores the field.
- **Distinct conditions count independently.** A multiclass / dual-class / Size-Changing / copy-granted card counts toward every distinct condition it matches (rulebook Multiclass). Mixed `[X][Y]` pairs keep today's behavior.
- **`bothConditionCount` is retired** (D-24562 lock 4's second option). The field, the fusion derivation, and the handler's count branch are removed. The doubled "both" condition now arrives from the parser as ONE `bothCondition` carrying `requiredMatches: 2`, and the handler's existing `evaluateAllConditions(G, playerID, [bothCondition], cardId)` is count-aware through `evaluateCondition`. Play to the Crowd's behavior is unchanged.
- **`evaluateAllConditions` / `findFailedCondition` signatures are unchanged** (public `index.ts` export).
- No new `G` field, no new move, no new keyword, no client change, no card-data change.

**Session protocol:** if the code at the §Assumes line refs has drifted, if the scaffold numbers move in an unexplained direction, or if any single-icon or mid-sentence-repeat line changes its parsed conditions, STOP and surface it. Do not force-fit.

---

## Scope (In)

- `rules/heroAbility.types.ts` — `HeroCondition` gains `requiredMatches?: number` (with a D-24563 `// why:`); `HeroEffectDescriptor.bothConditionCount` is removed.
- `setup/heroAbility.setup.ts`:
  - New module constant `LEADING_ICON_PREFIX_PATTERN = /^\s*((?:\[(?:hc|team):[^\]]+\]\s*)+):/`.
  - New module-private pure function `collapseLeadingRepeatedIconConditions(abilityText: string, conditions: HeroCondition[]): HeroCondition[]` (JSDoc; `for…of`; normalizes token values with `normalizeTraitSlug`; maps `hc` → `heroClassMatch`, `team` → `requiresTeam`), called where `conditions` is built (L934). It is NOT exported; it is tested through `buildHeroAbilityHooks`.
  - Delete the private `countRepeatedBothCondition` (~L2938) and its use in `buildDigestIndigestionFusion` (~L2987–3007). `bothCondition` stays `conditions[0]` of the "both" line, which now carries `requiredMatches`. Rewrite the fusion's D-24562 comment (~L2977–2983) and the `DIGEST_INDIGESTION_CARDS` comment (~L513, "carries bothConditionCount 2") to point at D-24563.
- `hero/heroConditions.evaluate.ts`:
  - `heroClassMatch` / `requiresTeam` cases (L52 / L73) return `countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId) >= effectiveRequired`.
  - Widen the helper's parameter to `triggeringCardId?: CardExtId` (it is required today; `evaluateCondition` passes it optionally). With it undefined, nothing is skipped — today's `evaluateCondition` behavior. Rewrite the helper's JSDoc to match: optional `@param triggeringCardId` (undefined → nothing skipped), and drop the header's claim that `evaluateCondition` "answers only 'at least one'" — `evaluateCondition` is now its caller (D-24563).
  - `describeFailedCondition` (L706): for `heroClassMatch` / `requiresTeam` with an effective required count > 1, return `it needs ${n} other ${value} Heroes played this turn`. The count-1 strings are byte-unchanged.
- `hero/heroEffects.execute.ts` — reduce `isDigestBothConditionMet` (L4853) to `effect.bothCondition !== undefined && evaluateAllConditions(G, playerID, [effect.bothCondition], cardId)`, rewriting its JSDoc; drop the `countOtherInPlayMatchingCondition` import (L35) if nothing else in the file uses it; drop `bothConditionCount?` from the handler JSDoc `@param effect` shape (~L4883).
- `rules/heroKeywords.ts` — comment-only: the `digest-indigestion` descriptor-shape comment (L89) drops `bothConditionCount?`.
- Tests (see §Acceptance Criteria): a new real-data sweep + behavior file, evaluator unit tests, parser unit tests, and migration of WP-740's `bothConditionCount` expectations to `bothCondition.requiredMatches: 2`.
- `docs/ai/coverage/runtime-observed-hollows.json` — regenerated if (and only if) `sim:runtime-observed:check` fails, which the scaffold predicts.

## Out of Scope

- Cyber-Mod (`[keyword:Cyber-Mod][hc:X][hc:X]:`, 5 lines) — a Victory-Pile mechanic; its own future WP.
- Microscopic Size-Changing repeated grant tokens — already routed to grants (D-24074).
- Un-hollowing any of the 27 effect-less gated hooks (Woman Out of Time, Dark Memories, Hyperspeed, Transform, "Instead, do both" on non-digest cards, etc.).
- The mid-sentence repeated conditions (61 lines) — they stay two identical plain conditions; de-duplicating them is cosmetic and would churn hook data for core cards.
- `evaluateAllConditions` / `findFailedCondition` / `heroConditionHoldsForInPlay` signatures; the server sequence teacher; any client surface; card data; rulings corpus (a new `evaluate-condition` scenario action would extend its closed vocabulary — separate WP).
- `vnom/venom/insatiable-hunger` and the other deferred Digest cards.

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified** — `HeroCondition.requiredMatches?`; remove `bothConditionCount?`
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `LEADING_ICON_PREFIX_PATTERN` + `collapseLeadingRepeatedIconConditions` + call site; fusion stops deriving the count
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — count-aware class/team cases via the helper; `describeFailedCondition` count copy
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — digest both-select simplification + JSDoc
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified (comment-only)**
- `packages/game-engine/src/hero/doubledSuperpowerIcon.test.ts` — **new** — real-data sweep + end-to-end behavior (AC 1–5)
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified** — `requiredMatches` evaluator + message tests (AC 6–7)
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — collapse unit tests (AC 3)
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — WP-740 fusion expectation migration (AC 8)
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — WP-740 hand-built `bothConditionCount` effects migrate to `bothCondition.requiredMatches` (AC 8)
- `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated (conditional on its check failing; expected)**
- (conditional) `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — re-pin `totalObs` with a provenance comment ONLY if the dashboard suite fails after the regen (did not at draft)
- (conditional) sentinel fixture / `PRE_WP080_HASH` / `scripts/coverage/hero-effect-coverage.baseline.json` — ONLY if their check fails; dual re-pin honestly with provenance (not expected)
- Governance close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24563 + D-24562 supersession annotation), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

---

## Contract

### `HeroCondition.requiredMatches?: number`

The number of distinct OTHER in-play cards that must satisfy a `heroClassMatch` / `requiresTeam` condition. Absent ≡ 1. Emitted by the parser only for a leading-prefix repeat (m ≥ 2). Other condition types ignore it.

### Parse examples (locked)

| Line (prefix) | `conditions` |
|---|---|
| `[hc:ranged][hc:ranged]: You get +3[icon:attack].` | `[{type:'heroClassMatch',value:'ranged',requiredMatches:2}]` |
| `[hc:tech]: You get +1[icon:attack] for each other[hc:tech] Hero …` | `[{type:'heroClassMatch',value:'tech'},{type:'heroClassMatch',value:'tech'}]` (unchanged) |
| `[team:shield][team:shield][team:shield]: You may send this Hero or a [team:shield] Hero …` | `[{type:'requiresTeam',value:'shield',requiredMatches:3},{type:'requiresTeam',value:'shield'}]` |
| `[hc:strength][hc:strength][hc:ranged][hc:ranged]: You get +6[icon:attack].` | `[{…'strength',requiredMatches:2},{…'ranged',requiredMatches:2}]` |
| `[hc:tech][hc:strength]: …` | `[{…'tech'},{…'strength'}]` (unchanged) |
| `[keyword:Cyber-Mod][hc:tech][hc:tech]: Draw a card.` | `[{type:'heroClassMatch',value:'tech'},{type:'heroClassMatch',value:'tech'}]` (unchanged) |
| `[team:venomverse][team:venomverse]: Instead, do both (in order).` | `[{type:'requiresTeam',value:'venomverse',requiredMatches:2}]` |

### Play to the Crowd fused effect (post-WP-741)

WP-740's locked effect with `bothConditionCount: 2` removed and `bothCondition: {type:'requiresTeam', value:'venomverse', requiredMatches:2}`. Every other key is unchanged. The Core-4 fused hooks stay byte-identical (their "both" lines are single-icon).

### D-24563 (lands Active at execution)

1. **Rule.** A Superpower whose leading icon prefix repeats an icon m times needs m distinct OTHER in-play cards bearing that icon. The card itself never counts; another copy (different `#N`) does (rulebook L683–696). The rulebook states the two-icon rule as "cards with both of those icons"; that two IDENTICAL icons need two cards is an inference from that wording (the extracted text strips the icon glyphs), recorded here as the ruling this engine follows.
2. **Source of multiplicity.** Only the leading icon run of a line (`LEADING_ICON_PREFIX_PATTERN`). Tokens anywhere else never add multiplicity. This protects the 61 lines that repeat a condition token outside a repeated leading prefix: 32 single-icon Superpowers that repeat their icon in prose (Arc Reactor et al.), 2 repeated-prefix lines with an extra mid-sentence token (Victoria Hand, Reassign to Civilian Duty), and 27 lines with no leading icon run (Cyber-Mod, Size-Changing, X-Gene, Pure Fury, Queen Storm).
3. **Representation.** `HeroCondition.requiredMatches?: number`, omit-when-one, produced by collapsing the repeated emitted conditions; honored only by `heroClassMatch` / `requiresTeam` through `countOtherInPlayMatchingCondition`.
4. **Distinct conditions are independent.** A card matching several distinct icons (multiclass, dual-class, Size-Changing, copied team) counts toward each (rulebook Multiclass L3110–3116). Mixed `[X][Y]` pairs are unchanged.
5. **`bothConditionCount` retired.** Supersedes D-24562 lock 1, lock 4's "`evaluateCondition` / `evaluateAllConditions` untouched" clause, and the handler's count branch, exactly as D-24562 lock 4 anticipated. D-24562 lock 5 is narrowed to mixed DISTINCT-icon lines (a mixed line with a repeated prefix icon now carries `requiredMatches` on its first condition). No schema migration: pre-deploy match blobs keep their setup-time hooks. Play to the Crowd matches created after WP-740's deploy and before this one lose the count-2 gate in flight or on replay (accepted: one card, the window between the two deploys). At close, D-24562 is annotated: "lock 1 and lock 4's evaluator-untouched clause superseded by D-24563; lock 5 narrowed to mixed distinct-icon lines."
6. **Scope limit.** Cyber-Mod and Size-Changing repeated tokens are out of scope (neither is a leading icon run).

---

## Acceptance Criteria

1. **Real-data sweep** (`doubledSuperpowerIcon.test.ts`, reads `data/cards/*.json` via `node:fs` like `setup/heroAbility.setup.test.ts` does): for every hero line matching `LEADING_ICON_PREFIX_PATTERN` with a repeated token, build that line ALONE as a single-ability synthetic card through `buildHeroAbilityHooks` (a minimal `getSet` registry, the `makeHeroRegistry` shape). A lone line has no Digest line, so no fusion consumes it and every line yields a normal hook. That hook carries, for each repeated (`type`, `value`), exactly one condition with `requiredMatches` equal to the prefix multiplicity. The sweep finds **35** such lines (the draft inventory); a different count fails loudly and must be explained, not re-pinned blindly.
2. **Landmine guard:** core `iron-man/arc-reactor`, core `captain-america/a-day-unlike-any-other`, core `cyclops/x-men-united`, and `ssw1/captain-marvel/absorb-energies` hooks are deep-equal to their baseline conditions, with no `requiredMatches` key. No hook built from a line WITHOUT a repeated leading prefix carries `requiredMatches` (sweep assertion over all sets).
3. **Parser unit tests** (`setup/heroAbility.setup.test.ts`, through `buildHeroAbilityHooks` on single-line synthetic cards — `parseAbilityText` and the collapse function stay module-private) reproduce every row of the §Contract parse-examples table.
4. **Bishop end-to-end** (`dkcy/bishop/concussive-blast`, via `buildHeroAbilityHooks` + `executeHeroEffects`):
   - One other Ranged Hero in play → no +3 Attack, and the blocked-line text is `it needs 2 other ranged Heroes played this turn`.
   - Two other Ranged Heroes → +3 Attack.
   - One other Ranged Hero + a second copy of Concussive Blast (different `#N`) already in play → +3 (the copy counts).
   - Only the triggering card itself plus one other Ranged Hero → no grant (self never counts).
5. **Mixed pair unchanged:** a `[hc:tech][hc:strength]:` Superpower fires with ONE other dual-class Tech/Strength card (multiclass counts as both), and also with one Tech + one Strength card. **Doubled mixed:** Cosmic Energies needs 2 Strength and 2 Ranged others; two Strength/Ranged dual-class others satisfy it; one Strength + two Ranged does not.
6. **Evaluator unit tests** (`heroConditions.evaluate.test.ts`): `requiredMatches` 2 / 3 on `heroClassMatch` and `requiresTeam` (team count includes a basic S.H.I.E.L.D. token per D-24391); absent / 1 / 0 / non-integer ≡ 1; a `requiredMatches` on an unrelated type (e.g. `playedThisTurn`) is ignored.
7. `describeFailedCondition` count-1 strings are byte-identical to baseline (existing tests pass unchanged); the count > 1 string is exactly `it needs ${n} other ${value} Heroes played this turn`.
8. **WP-740 migration** (representation change only; no assertion weakened):
   - `rules/heroAbility.setup.test.ts` L2468: the fused hook deep-equals the §Contract effect — no `bothConditionCount` key, `bothCondition: {type:'requiresTeam', value:'venomverse', requiredMatches:2}`.
   - `rules/heroAbility.setup.test.ts` L2472–2482: retitle to `…carries no requiredMatches for a mixed "both" line (D-24562 lock 5 / D-24563)`; replace the `bothConditionCount` assertion with `assert.equal(effect.bothCondition?.requiredMatches, undefined)`; keep the `bothCondition` deep-equal unchanged.
   - `hero/heroEffects.execute.test.ts` L7271 `crowdHook()`: drop `bothConditionCount: 2`, add `requiredMatches: 2` to `bothCondition`. WP-740's behavior tests then pass unchanged: one other Venomverse Hero → "both" does NOT fire; two → both fire in order.
   - The Core-4 fused hooks are byte-identical to baseline.
9. `bothConditionCount` no longer appears anywhere under `packages/game-engine/src` (`grep -rn "bothConditionCount" packages/game-engine/src` → no output).
10. Full engine suite green; `pnpm -r build` 0; `apps/server` `sequenceTeacher.logic.test.ts` green; `apps/dashboard` suite green; the six card/coverage `:check`s exit 0 (after the conditional regen); `finalStateHash` / `PRE_WP080_HASH` unchanged (or dual-re-pinned with provenance and an explanation of which affected hero reached the fixture).

---

## Verification Steps

1. `pnpm -r build` → 0; `pnpm --filter @legendary-arena/game-engine test` → all pass.
2. `pnpm sim:runtime-observed:check` → if FAIL, `pnpm sim:runtime-observed` and re-check → 0. Then `pnpm --filter @legendary-arena/dashboard test` → all pass (re-pin `totalObs` with provenance only if it fails).
3. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:coverage --check` → all exit 0.
4. `node --import tsx --test apps/server/src/coach/sequenceTeacher.logic.test.ts` → all pass.
5. `grep -rn "bothConditionCount" packages/game-engine/src` → no output.
6. `git diff --name-only` ⊆ `## Files Expected to Change`. Revert any CRLF-only `packages/lagn-spec/schemas/lagn-v1.json` churn.

---

## Vision Alignment

**Vision clauses touched:** §1, §2, §10 (card data / content semantics — printed rule fidelity), §3 / §8 / §22 (determinism: setup-built hook data changes), §20–26 (simulation baseline regen; outcomes on affected cards shift).

**Conflict assertion:** No conflict: this WP preserves all touched clauses. It makes 35 shipped cards gate on their printed "Critical Hit" requirement (rulebook L683–696) and changes no card text.

**Non-Goal proximity check:** NG-1..7 not crossed. The gate is decided solely by game state and applies identically to every player of the card; no monetization, cosmetic, or paid surface.

**Determinism preservation:** the parser collapse is a pure setup-time string transform; evaluation is a pure, `ctx`-free `for…of` count over `inPlay`. No `Math.random`, no new persisted field, replay-faithful except the accepted Play to the Crowd window (D-24563 lock 5). Matches that include an affected hero deck get different (correct) hook data and outcomes; no committed hash fixture includes one (measured). The runtime-observed simulation artifact is regenerated deterministically.

---

## Lint Gate Self-Review (00.3)

- **§1 structure:** all required sections present and non-empty; Out of Scope names Cyber-Mod, Size-Changing, the hollow hooks, mid-sentence repeats, the server/client, and the rulings corpus.
- **§2 constraints:** engine-wide + packet-specific + session protocol; consistent with the body and Contract.
- **§3 assumes:** WP-740's landed surface is named symbol-by-symbol with line refs on `1475218f`; parser and evaluator line refs; instance-id format; rulebook lines.
- **§4 context:** measured inventory, the 61-line landmine with named cards, the scaffold's observed numbers, fixture exposure, memory refs.
- **§5 files:** every file marked new / modified / regenerated / conditional with a one-line change.
- **§6 naming:** `requiredMatches`, `LEADING_ICON_PREFIX_PATTERN`, `collapseLeadingRepeatedIconConditions` are full English words; canonical `{setAbbr}/{heroSlug}/{cardSlug}` keys; `abilities[]` per `00.2`.
- **§7 dependencies:** WP-740 ✅ (`93514f86`); no new npm package.
- **§8 boundaries:** Game Engine only; pure helpers stay free of `boardgame.io`; no server/client/registry edit; G stays JSON-plain.
- **§9 Windows:** `pnpm` / `node` / `grep` via Git Bash only.
- **§10 env:** N/A — no env vars.
- **§11 auth:** N/A — no auth surface.
- **§12 tests:** `node:test` + `node:assert`; deterministic; real-data reads via `node:fs` at test time (existing precedent); no `boardgame.io/testing`; the sweep fails loudly on an unexpected count; WP-740 test edits are a representation migration with no weakened assertion.
- **§13 verification:** exact commands with expected outcomes, incl. the conditional regen path.
- **§14 acceptance:** 10 binary criteria tied to named cards, strings, and counts.
- **§15 DoD:** STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap + scope check; User-Visible Surface + Impact present; D-24026 live-verify item present (§15.1).
- **§16 code style:** one small named pure function + JSDoc + `// why:`; no `.reduce()`; reuses WP-740's helper (third caller would be the abstraction point — this is the second).
- **§17 vision:** `## Vision Alignment` with clause numbers, conflict assertion, NG check, determinism line.
- **§18 prose-vs-grep:** the only grep (Verification 5) targets a token this WP removes; this WP's own prose names it only in removal context.
- **§19 bridge staleness:** baseline `1475218f` cited; WP-740 merged mid-draft, so the scaffold and every line ref were re-taken on it.
- **§20 funding:** N/A — no funding surface.
- **§21 API catalog:** N/A — no HTTP endpoint and no `apps/server/src/**` function changes.

**Verdict:** all 21 sections PASS or justified N/A.

---

## Pre-flight (01.4)

Run as an independent gate subagent against live `src`. **Class:** Behavior / State Mutation (setup-built `G.heroAbilityHooks` data + the class/team evaluator; no move, phase, or `G` field).

**Verified TRUE against source:** whole-line Step 1a/1b scans and the class-then-team concat; none of the 35 leading-repeat lines carries a suppression flag (flags are line-level, so a prefix-only collapse cannot be half-suppressed; X-Gene emits `heroClassInDiscardPile`, which the collapse does not target); evaluator cases and first-match semantics; `heroConditionHoldsForInPlay` passes the condition object whole and the teacher tests one candidate at a time, so a count-2 gate yields no tip; WP-740's `countOtherInPlayMatchingCondition` / `bothConditionCount` semantics; every other `hook.conditions` consumer only checks length or loops (no client, registry, or script reads conditions); inventory re-derived independently — 32 + 3 = 35 lines across 34 heroes, 13 mixed distinct-icon lines, no core card, 61 non-prefix repeats; rulebook L683–696 and L3110–3116; `#copyIndex` instance ids; no affected hero in the sentinel, `PRE_WP080_HASH`, `data/par`, gauntlet, sweep, difficulty, scoring, or engine fixtures; ledger reservations and index/mindmap rows present; EC 71 lines, Locked Values = Contract, Files to Produce = Files Expected to Change.

**PS-1 (blocking, FIXED):** WP-740 merged mid-draft (`93514f86`). Status, Dependencies, baseline, index rows, and line refs updated; worktree rebased onto `1475218f`; scaffold re-measured (4116/1, the one failure being the planned AC 8 migration).
**PS-2 (blocking, FIXED):** conditional wording replaced with the shipped symbols — the required `triggeringCardId` (widen to optional), `countRepeatedBothCondition` (delete), `isDigestBothConditionMet` (reduce), the L35 import, and the `DIGEST_INDIGESTION_CARDS` comment.
**PS-3 (blocking, FIXED):** WP-740's mixed-"both" test asserts on the retired field; AC 8 now authorizes its exact rewrite.
**PS-4 (blocking, FIXED):** in a full-card build, Play to the Crowd's "both" line is consumed by the fusion and `parseAbilityText` is private. AC 1 now builds each line as a single-ability synthetic card; AC 3 tests go through `buildHeroAbilityHooks`; the collapse function stays unexported.
**RS-1 (applied):** D-24563 lock 2 and §Context carry the 32 / 2 / 27 breakdown of the 61 lines.
**RS-2 (applied):** D-24563 lock 1 labels "two identical icons need two cards" as an inference from the rulebook wording.
**RS-3 (applied):** DoD adds the D-24562 supersession annotation (widened at 01.7 to lock 4's evaluator clause and the lock 5 narrowing).
**RS-4 (noted, no action):** a count-2 sequence-teacher tip can be missed when one matching card was already in play; conservative (no false tip).

**Verdict: READY TO EXECUTE** (PS-1..4 fixed in place; the reviewer stated READY on their application without a re-run).

## Copilot (01.7)

Run as an independent gate subagent (30-mode audit) against the WP + EC + pre-flight report, verifying against live source (`1475218f`) with a scratch parse over all of `data/cards`: the 35 / 13 counts are exact; no suppression flag touches any of the 35; Victoria Hand / Reassign emit 3 prefix + 1 mid-sentence `shield`; the landmines and Cyber-Mod lines are untouched; the venomverse "both" line collapses and the fusion's `conditions[0]` inherits it; `bothConditionCount` is referenced only in the listed files; AC 8 is a pure representation migration.

**First pass: RISK / HOLD** on five modes, all scope-neutral, all fixed in place:
- **Mode 28 (upgrade story):** "hook data is never persisted" was false: the bgio blob persists `initialState.G.heroAbilityHooks` and replay re-executes it. Harmless for the 34 non-digest cards (old hooks lack `requiredMatches`, so count 1, as originally played). Play to the Crowd matches from the WP-740 → WP-741 window lose the count-2 gate. D-24563 lock 5 and the §Context deploy note now say so (accepted window); the live-verify must use a match created after the deploy.
- **Modes 20 / 26 (authority vs D-24562):** the supersession also covers lock 4's "evaluator untouched" clause and narrows lock 5 to mixed distinct-icon lines. The annotation text is updated in lock 5, the DoD, and the EC.
- **Mode 26 (content):** Gamora, Ice Magic, and Enchantress parse to magnitude-less descriptors. User-Visible Impact now says 5 real payoffs + 3 log-only; the WORK_INDEX and EC_INDEX rows mirror it. The Cyber-Mod parse row now states the literal value.
- **Mode 6 (ordering):** the collapse precedes the Empowered param splices; a guardrail was added (no current repeated-prefix line has Empowered; STOP if one appears).
- **Mode 15 (why):** the widened helper's JSDoc rewrite is now required in Scope and the EC.

**Noted for a separate ticket (not this WP):** the three magnitude-less descriptors (Gamora "gets no [icon:attack]", Ice Magic "+[icon:attack] equal to…", Enchantress) are classified as applied rather than hollow.

**Re-run: PASS.** All five fixes are verified present and consistent (annotation wording identical across lock 5, DoD, and EC; Empowered splice refs L1027 / L1150 confirmed). One optional wording fix is applied: the Vision determinism line now qualifies "replay-faithful" with the accepted Play to the Crowd window.

**Final verdict: PASS.**

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` ⊆ `## Files Expected to Change`.
- [ ] `docs/ai/STATUS.md` updated; D-24563 landed Active in `DECISIONS.md` and D-24562 annotated "lock 1 and lock 4's evaluator-untouched clause superseded by D-24563; lock 5 narrowed to mixed distinct-icon lines"; WORK_INDEX row checked; EC_INDEX Done; mindmap node `✅`; `roadmap:counts:check` 0.
- [ ] Two-commit topology: `EC-778:` implementation + `SPEC:` governance close.
- [ ] **D-24026 live-verify (post-merge, REQUIRED):** in a live match on `play.legendary-arena.com`, verified against the deployed `/api/version` gitSha, in a match CREATED AFTER the deploy (in-flight matches keep their setup-time hooks), with Dark City's Bishop in the loadout: Concussive Blast after ONE other Ranged Hero grants no +3 and logs "it needs 2 other ranged Heroes played this turn"; after TWO it grants +3. Recorded as a follow-up STATUS-flip, not a merge blocker.
