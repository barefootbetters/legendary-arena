# WP-741 — Doubled Superpower icons need that many OTHER matching cards ("Critical Hit" count fidelity) (Engine)

**Status:** Ready (re-validated 2026-10-12; execute after WP-803)
**Primary Layer:** Game Engine / Implementation
**User-Visible Surface:** `play.legendary-arena.com`
**Dependencies:**
- ✅ WP-740 / D-24562 (`93514f86`, #2275) landed `countOtherInPlayMatchingCondition` and the digest-scoped `bothConditionCount`, which this WP builds on and retires.
- ✅ WP-765 / D-24598, the second `bothConditionCount` consumer: Nanite's `day-night-both` fusion.
- ✅ WP-179 / D-17904: `heroClassMatch` / `requiresTeam` evaluation and self-exclusion.
- ✅ WP-703 / D-24523: dual-class `heroClass2`.
- ✅ D-24074: Size-Changing class grants via `cardHasClassWhenPlayed`.
- ✅ D-24391: `cardCountsAsTeamMember`, including teamless basic S.H.I.E.L.D. tokens.
- ✅ D-24628: the `LEADING_GATE_PREFIX_PATTERN` gate prefix and body-token suppression.
- **Sequenced after WP-803 / EC-840** (Out of Time). The two share production files (`setup/heroAbility.setup.ts`, `hero/heroConditions.evaluate.ts`, the coverage feeds), so per 01.0b they execute one at a time. Their designs compose in either order, but AC 6 consumes WP-803's `TurnEconomy.outOfTimePlayedCardIds`, so WP-803 lands first.

**Lane:** Standard (two-session). NOT lightweight-lane eligible: it edits a contract file (`rules/heroAbility.types.ts`), changes gameplay outcomes, and moves setup-built `G.heroAbilityHooks` data (a hashed surface).

> **Baseline:** `origin/main` after WP-803 merges. Drafted on `1475218f` (2026-09-22). Re-validated on `6cf0c6f7` (2026-10-12): engine 5092 / 0 on baseline, and the WP-741 prototype gave 5087 / 5 (the five planned migrations, §Context). Anchors below are `~symbol` references; re-read them at execution.

---

## Goal

After this session, a printed Superpower whose leading icon prefix repeats an icon fires only when the player has played **that many OTHER cards** bearing each repeated icon earlier this turn. Examples: `[hc:tech][hc:tech]:`, `[team:shield][team:shield][team:shield]:`, `[hc:strength][hc:strength][hc:ranged][hc:ranged]:`.

- The card itself never counts.
- Another copy of the same card (a different `#N` instance) does count.
- Single-icon Superpowers, mixed-icon pairs (`[hc:tech][hc:strength]:`) and "for each other [hc:X]" count lines behave exactly as today.

---

## User-Visible Impact

Today every doubled, tripled or quadrupled icon Superpower is satisfied by **one** other matching card, outside the two fused hooks below. Example: **Bishop — Concussive Blast** (`dkcy`, `[hc:ranged][hc:ranged]: You get +3 Attack`) grants +3 after a single other Ranged Hero, where the rulebook requires two. The same under-gate applies to 33 of the 35 printed lines (§Context inventory); the other two are the already count-correct fused cards below. The WP-708 Synergy Rate (display-only, off-ranking) shifts on the affected decks.

**Real payoffs that tighten (fire only with the printed count):**

| Card | Prefix | Gated effect |
|---|---|---|
| `dkcy/bishop/concussive-blast` | ranged ×2 | +3 Attack |
| `amwp/janet-van-dyne/subatomic-size` | covert ×2 | +2 Attack |
| `ssw1/captain-marvel/cosmic-energies` | strength ×2 + ranged ×2 | +6 Attack |
| `vnom/venomized-dr-strange/crystal-of-kadavus` | venomverse ×2 | "Do this ability again" (reveal-three-assign-again; WP-753 / D-24580) |
| `ca75/agent-x-13/sniper-squad` | shield ×4 | Woman Out of Time (live once WP-803 lands) |
| `anni/psi-lord/reshape-reality` | fantastic-four ×2 | Man / Woman Out of Time (live once WP-803 lands) |

**Log-only change.** Five cards change only their blocked-ability line:
- Three parse to magnitude-less `attack` / `recruit` descriptors that the handler skips: `gotg/gamora/galactic-assassin`, `ssw2/dr-punisher-soldier-supreme/ice-magic` and `vill/enchantress/irresistible-bribe`.
- Two carry the bare `undercover` token, which has had no handler since WP-678 / D-24494: `shld/victoria-hand/victoria-hand` (shield ×3) and `shld/yo-yo-rodriguez/yo-yo-rodriguez` (shield ×2). It now names the count and keeps the D-24649 / D-24623 tail " Its effect is not supported yet."

**Representation-only change, behaviour unchanged.**
- **Play to the Crowd** (`vnom`, venomverse ×2 "both"): already count-correct through `bothConditionCount: 2`.
- **Nanite Shapeshifter** (`nmut/warlock/nanite-shapeshifter`, x-men ×4 day-night "both"): already count-correct through `bothConditionCount: 4`.

**Everything else.** The remaining doubled lines gate hollow (effect-less) hooks. Their gates become faithful for whenever those effects are implemented. Split of the 35 lines at re-validation:
- 4 real payoffs (+2 once WP-803 lands)
- 5 log-only
- 2 representation-only
- 22 hollow

When a doubled gate fails, the blocked-ability line names the count, e.g. "it needs 2 other ranged Heroes played this turn".

This is a **difficulty increase** on the affected cards (fewer free fires). That is intended: it is the printed rule.

---

## Assumes

All anchors are `~` approximate, against `6cf0c6f7`. At execution, STOP only if a named symbol or signature is missing or changed, never on line movement alone.

- **WP-740 / D-24562 surface:**
  - `countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId: CardExtId): number` in `hero/heroConditions.evaluate.ts` (~`:458`). `triggeringCardId` is **required**.
    - `heroClassMatch` goes through `cardHasClassWhenPlayed`, `requiresTeam` through `cardCountsAsTeamMember`.
    - It skips the exact instance id and returns 0 for other types, missing zones or missing `cardTraits`.
    - It iterates `playedCardIdsThisTurn`. After WP-803 that read includes set-aside Out of Time cards, which is the rules-correct "cards you played this turn" read (L3443-3446; L1682).
    - Unit tests: `heroConditions.evaluate.test.ts` ~`:1672-1716`.
  - `HeroEffectDescriptor.bothConditionCount?: number`, at `rules/heroAbility.types.ts` ~`:201-207`. The day-night `// why:` is at ~`:215-221`.
  - The private `countRepeatedBothCondition(conditions)` (`setup/heroAbility.setup.ts` ~`:3842-3865`) has **two** callers:
    - `buildDigestIndigestionFusion` (~`:3881`; uses ~`:3925` / `:3932` / `:3943`). Its `DIGEST_INDIGESTION_CARDS` comment (~`:693-695`) says the "both" line "carries bothConditionCount 2".
    - `buildDayNightBothFusion` (~`:4018`; uses ~`:4035-4049`, comment ~`:4009`). Its `DAY_NIGHT_BOTH_CARDS` comment (~`:763-769`) names Nanite's `bothConditionCount 4`.
  - `isDigestBothConditionMet(G, playerID, cardId, effect)` (`hero/heroEffects.execute.ts` ~`:5780`):
    - It takes the helper branch when `bothConditionCount > 1`.
    - Its helper import is at ~`:35`.
    - The digest handler's JSDoc (~`:5810`) and the `heroEffectDayNightBoth` JSDoc (~`:5932`, `:5939`) list `bothConditionCount?`.
  - Tests naming the field:
    - `rules/heroAbility.setup.test.ts`: the fused deep-equal (~`:2522`, field ~`:2542`) and the mixed "both" test (~`:2546-2557`).
    - `hero/heroEffects.execute.test.ts`: `crowdHook()` (~`:8003-8016`, field ~`:8012`).
    - `setup/heroAbility.setup.test.ts`: the Nanite fusion (~`:1723-1734`, `assert.equal(effect.bothConditionCount, 4)`).
  - The `rules/heroKeywords.ts` descriptor-shape comment is at ~`:90`.
  - D-24562 lock 4 records this WP's path: a later doubled-icon WP "may keep `bothConditionCount` … or retire it."
- **Parse today** (`setup/heroAbility.setup.ts` `parseAbilityText`, which is module-private):
  - Step 1a (~`:1205`) and Step 1b (~`:1272`) push one condition per token. They are concatenated class-first, team-second at ~`:1303`.
  - D-24628 suppresses a `[team:X]` body token after an explicit leading gate prefix (`isBodyTokenAfterGatePrefix`).
  - `LEADING_GATE_PREFIX_PATTERN = /^\s*(?:\[(?:hc|team):[^\]]+\]\s*)+:/` (~`:131`) is already matched once per line into `leadingGatePrefixMatch` (~`:1152`).
  - The Empowered param splices are at ~`:1396` / `:1528` (`findFirstHeroClassMatchIndex`).
- **Evaluation today** (`hero/heroConditions.evaluate.ts`):
  - The `heroClassMatch` (~`:109`) and `requiresTeam` (~`:130`) cases return true on the FIRST other match.
  - `evaluateAllConditions` (~`:509`) ANDs its conditions, so N identical conditions are satisfied by one card.
  - `describeFailedCondition` is at ~`:782`.
- **Instance ids are per copy** (`${baseExtId}#${copyIndex}`, `setup/buildCardTraits.ts` ~`:216`).
- **Rulebook** (`docs/legendary-universal-rules-v23.md`):
  - L683-696, "'Critical Hit' Superpower Abilities": a two-icon Superpower needs cards with both icons played earlier in the turn. The card does not satisfy itself; another copy does.
  - Multiclass, L3110-3116: a multiclass card "counts as both" and is "great at enabling" mixed pairs.
- **Green before the change:** `pnpm -r build` exits 0. The engine suite, `cards:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`, `sim:runtime-observed:check` and `sim:coverage --check` are green on post-WP-803 main.

---

## Context (Read First)

- **Why a separate WP.** WP-740 fixed the doubled gate for one card, scoped inside the `digest-indigestion` descriptor. WP-765 reused that for Nanite. Both deferred the repo-wide gap to this WP (WP-740 §Out of Scope; D-24562 lock 4).
- **Inventory** (re-measured 2026-10-12 on `6cf0c6f7`; unchanged from draft). Counted over every `abilities[]` line in `data/cards/*.json` that **starts with** an `[hc:X]` / `[team:X]` run followed by `:` and repeats a token:
  - **32 identical-repeat lines on 32 cards:**
    - ×2: covert (3), tech (3), strength (3), ranged (2), instinct (2), venomverse (3), avengers (2), and one each of shield, fantastic-four, marvel-knights, sinister-six and crime-syndicate
    - ×3: shield (3), covert (1), guardians-of-the-galaxy (1)
    - ×4: shield (2), x-men (1), avengers (1)
  - **3 mixed lines with repeats:** `ssw1/captain-marvel/cosmic-energies` (strength×2 + ranged×2), `ssw1/namor-the-sub-mariner/imperius-rex` (strength×2 + instinct×2), `ssw2/beast/multi-variable-smackulus` (tech×2 + strength×2).
  - **13 mixed distinct-icon lines** (e.g. `[hc:tech][hc:strength]:`, `rlmk/crystal` with four classes). Unchanged by this WP.
  - **No Core-set card** carries a doubled prefix.
  - Built alone through `buildHeroAbilityHooks`, each of the 35 emits exactly m identical prefix conditions. No suppression flag or Empowered splice touches them.
- **The landmine this design avoids.** 61 lines repeat a condition token outside a repeated leading prefix (raw token count). **42** of them still emit a repeated condition. The other 19 do not:
  - 14 are D-24628 body-token drops, including core `captain-america/a-day-unlike-any-other`, core `cyclops/x-men-united`, `shld/victoria-hand` and `ca75/steve-rogers-director-of-shield/reassign-to-civilian-duty`.
  - 5 are `[hc:X]` lines whose second token is an Empowered "by [hc:X]" parameter the parser splices out: Jocasta, Wonder Man, Queen Storm ×2 and Shuri.

  Still doubling:
  - core `iron-man/arc-reactor`, `msp1/iron-man/arc-reactor`, `ssw1/captain-marvel/absorb-energies` and `xmen/havok/radiation-focus-array`
  - the Cyber-Mod lines (including `2099/ghost-rider-2099/infernal-chainsaw`)

  A naive "count condition multiplicity in the array" evaluator would wrongly demand two other Tech Heroes for Arc Reactor. **Multiplicity is therefore read ONLY from the leading icon prefix**, never from the condition array.
- **Out-of-scope families that also print repeated icons.** Neither line family starts with an icon run, so the prefix rule excludes both mechanically:
  - The 5 `[keyword:Cyber-Mod][hc:X][hc:X]:` lines (`2099`). Cyber-Mod is a Victory-Pile mechanic (L1254-1262).
  - About 16 `Microscopic Size-Changing [hc:X]…` lines (`amwp`, `antm`). Those tokens are class grants (D-24074).
- **Scaffold.**
  - **Draft run (`1475218f`)** found 4116 / 1, no re-pin, and the runtime-observed feed 2528 → 2527.
  - **Re-validation run (2026-10-12, a `git archive` copy of `6cf0c6f7`).** Baseline 5092 / 5092 pass. The prototype, including the `bothConditionCount` retirement, gave 5092 / 5087 / 5 fail with `tsc --noEmit` 0 and no hash, replay or sim test moving. The five failures are exactly the planned migrations (AC 9):
    - the fused deep-equal
    - two `crowdHook()` behavior tests
    - the Nanite `bothConditionCount 4` assert
    - `hero/bodyTeamTokenGate.test.ts` ~`:87-90`, which asserts Reassign's `conditions.length === 3`; it becomes 1 after the collapse
  - The full-workspace gates (`sim:runtime-observed:check`, the dashboard suite, the sequence-teacher test, the card / coverage `:check`s) were not re-run. Re-measure them on post-WP-803 main.
  - Expected baseline on post-WP-803 `main` (measured at #2734's head):
    - engine 5136 / 0
    - `runtime-observed-hollows.json` at 7834 observations
    - dashboard pin `totalObs 8755` / `percentResolved 14.1`

    Re-measure them at execution.
  - **Expected direction.** The runtime-observed count falls or holds, because doubled gates fire less. A rise is diagnosed, not re-pinned. Recent dashboard re-pins moved 1:1 with the raw feed, so expect the conditional dashboard re-pin to follow it.
- **Determinism exposure.** Only matches that include one of the 34 affected hero decks get different `G.heroAbilityHooks`. The sentinel fixture and the sweep setup use core heroes; `PRE_WP080_HASH` uses test heroes. The PAR `HERO_POOL` is core-only, and no other fixture references an affected hero. Expected: **no hash re-pin** (the re-validation prototype confirmed it). The runtime-observed sweep includes 21 affected heroes, hence its regen.
- **Deploy-boundary note (persisted hooks).** boardgame.io's match blob persists `initialState.G.heroAbilityHooks` (D-24095), and replay / verification re-executes it (D-24119). The new semantics live in hook DATA (`requiredMatches`), so a pre-deploy match of the non-fused cards keeps its setup-time hooks and evaluates at count 1, exactly as it originally played.
  - **The two fused cards are the exception:**
    - Play to the Crowd: matches created after WP-740's deploy.
    - Nanite Shapeshifter: matches created after WP-765's deploy.

    These carry `bothConditionCount` with a bare `bothCondition`. After this deploy the handlers ignore that field, so such a match, in flight or replayed, fires "both" off one matching card.
  - Accepted: two cards, in matches created between those deploys and this one. The live-verify must use a match created after this deploy.
- **WP-803 interaction (re-validated).**
  - There is no design conflict. The collapse runs at the concat, before WP-803's whole-line Out of Time recognizer, which keeps gate conditions exactly as built. So Sniper Squad and Reshape Reality pick up `requiredMatches` automatically.
  - After WP-803, set-aside Out of Time cards count toward a doubled gate through `playedCardIdsThisTurn`. That is correct: L3443-3446 says moved cards "still count as 'cards you played this turn'", and L1682 says an Out of Time card helps Superpowers on both turns.
  - A card's own turn-2 replay never counts itself (exact-id self-exclusion).
- **Sequence teacher** (server, D-24533). `heroConditionHoldsForInPlay` delegates to `evaluateCondition` with the condition object whole, so it inherits the count with no server change. Its enabler probe tests one candidate card at a time (`apps/server/src/coach/sequenceTeacher.logic.ts` ~`:205`), so a count ≥ 2 gate never holds there: doubled-gate cards get no reorder tip, and never a false one.
- **Memory refs:** `reference_hashed_g_field_dual_repin`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_sim_coverage_baseline_gate_distinct`, `feedback_ec_locked_value_stale_baseline`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full-file edits only, never diffs or snippets. ESM; Node v22+.
- Follow `.claude/rules/code-style.md` + `docs/ai/REFERENCE/00.6-code-style.md`: full-word names, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. `G` stays JSON-serializable; `requiredMatches` is a plain number on a setup-built hook (D-24095). Zones store `CardExtId` strings only.
- Determinism: no `Math.random`, no clock, no I/O in engine code. The parser change is pure string work at setup time.

**Packet-specific:**
- **Multiplicity comes ONLY from the leading icon prefix,** i.e. `leadingGatePrefixMatch[0]`, the existing D-24628 `LEADING_GATE_PREFIX_PATTERN` match (RS-1). No second prefix regex is added, and the pattern is not widened (WP-803 relies on it unchanged). Tokens later in the line never add multiplicity. Lines starting with any other token (`[keyword:…]`, prose) are untouched.
- **Collapse, then count.** For each distinct (`type`, `value`) whose prefix multiplicity m ≥ 2:
  - The FIRST emitted matching condition becomes `{…, requiredMatches: m}`.
  - The next m − 1 emitted identical conditions are dropped.
  - Any further identical conditions (mid-sentence tokens that D-24628 did not suppress) stay as plain conditions.
  - Conditions the Step 1a / 1b suppression flags never emitted are not synthesized. If fewer than m identical conditions were emitted (1 ≤ k < m), leave them untouched, with no `requiredMatches`.
  - Surviving conditions keep their relative order.
- **Collapse ordering.** The collapse runs immediately after the class-then-team concat (~`:1303`), before the Empowered param splices (~`:1396` / `:1528`). No current repeated-prefix line carries Empowered (the AC 1 sweep proves it). If one ever does, STOP: the splice would remove the collapsed prefix gate.
- **Omit-when-one.** `requiredMatches` is emitted only when ≥ 2. Every hook without a repeated prefix is byte-identical to baseline.
- **Only `heroClassMatch` and `requiresTeam` honor `requiredMatches`.** Both cases become `countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId) >= effectiveRequired`. `effectiveRequired` is `requiredMatches` when it is an integer > 1, and 1 otherwise. Every other condition type ignores the field.
- **Counts read played cards.** The helper reads `playedCardIdsThisTurn`, never WP-803's `playedCardIdsStillInPlay`: a Critical-Hit gate counts cards you played, wherever they went.
- **Distinct conditions count independently.** A multiclass, dual-class, Size-Changing or copy-granted card counts toward every distinct condition it matches (rulebook Multiclass). Mixed `[X][Y]` pairs keep today's behavior.
- **`bothConditionCount` is retired from BOTH fusions** (D-24562 lock 4's second option):
  - The field, `countRepeatedBothCondition` and both fusions' count derivations are removed, along with the digest handler's count branch.
  - The doubled "both" condition now arrives from the parser as ONE `bothCondition` carrying `requiredMatches`.
  - The digest (`isDigestBothConditionMet`) and day-night handlers' existing `evaluateAllConditions(G, playerID, [bothCondition], cardId)` path is count-aware through `evaluateCondition`.
  - Play to the Crowd's and Nanite's behavior is unchanged.
- **`evaluateAllConditions` / `findFailedCondition` signatures are unchanged** (they are public `index.ts` exports).
- No new `G` field, no new move, no new keyword, no client change, no card-data change.

**Session protocol:** STOP and surface it if any of these happens:
- a named symbol or signature has changed
- the scaffold numbers move in an unexplained direction
- any single-icon or mid-sentence-repeat line changes its parsed conditions

Do not force-fit.

---

## Scope (In)

- **`rules/heroAbility.types.ts`:**
  - `HeroCondition` gains `requiredMatches?: number`, with a D-24563 `// why:`.
  - `HeroEffectDescriptor.bothConditionCount` is removed. The day-night `// why:` (~`:215-221`) is rewritten to point at D-24563.
- **`setup/heroAbility.setup.ts`:**
  - New module-private pure function `collapseLeadingRepeatedIconConditions(gatePrefix: string, conditions: HeroCondition[]): HeroCondition[]`. It has JSDoc and uses `for…of`.
    - It tokenizes `gatePrefix` with fresh `new RegExp(PATTERN.source, 'g')` instances (or `matchAll`) of the existing `HERO_CLASS_PATTERN` / `TEAM_PATTERN`, as Step 1a / 1b do, so the shared `/g` constants' `lastIndex` never leaks. It normalizes values with `normalizeTraitSlug` and maps `hc` → `heroClassMatch`, `team` → `requiresTeam`.
    - `gatePrefix` is `leadingGatePrefixMatch?.[0] ?? ''`.
    - It is called where `conditions` is built (~`:1303`). It is NOT exported and is tested through `buildHeroAbilityHooks`.
  - Delete the private `countRepeatedBothCondition` and its uses in both `buildDigestIndigestionFusion` and `buildDayNightBothFusion`. `bothCondition` stays `conditions[0]` of the "both" line, which now carries `requiredMatches`.
  - Rewrite the fusion comments (~`:3881` block, ~`:4009`, ~`:4035-4037`) and the `DIGEST_INDIGESTION_CARDS` (~`:693-695`) and `DAY_NIGHT_BOTH_CARDS` (~`:763-769`) comments to point at D-24563.
- **`hero/heroConditions.evaluate.ts`:**
  - The `heroClassMatch` / `requiresTeam` cases return `countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId) >= effectiveRequired`.
  - Widen the helper's parameter to `triggeringCardId?: CardExtId`. When undefined, nothing is skipped, which is today's `evaluateCondition` behavior.
  - Rewrite the helper's JSDoc to match: optional `@param triggeringCardId`. Drop the header claim that `evaluateCondition` "answers only 'at least one'"; `evaluateCondition` is now its caller (D-24563).
  - `describeFailedCondition`: for `heroClassMatch` / `requiresTeam` with an effective required count > 1, return `it needs ${n} other ${value} Heroes played this turn`. The count-1 strings are byte-unchanged, and the caller's D-24649 / D-24623 "Its effect is not supported yet." tail is unchanged.
- **`hero/heroEffects.execute.ts`:**
  - Reduce `isDigestBothConditionMet` to `effect.bothCondition !== undefined && evaluateAllConditions(G, playerID, [effect.bothCondition], cardId)`, rewriting its JSDoc.
  - Drop the `countOtherInPlayMatchingCondition` import if nothing else in the file uses it.
  - Drop `bothConditionCount?` from the digest handler JSDoc (~`:5810`) and the `heroEffectDayNightBoth` JSDoc (~`:5932`, `:5939`).
  - The day-night handler never reads `bothConditionCount` itself (it calls `isDigestBothConditionMet`); only its JSDoc changes.
- **`rules/heroKeywords.ts`:** comment-only. The `digest-indigestion` descriptor-shape comment (~`:90`) drops `bothConditionCount?`.
- **Tests** (see §Acceptance Criteria):
  - a new real-data sweep + behavior file
  - evaluator unit tests and parser unit tests
  - the AC 9 migrations: WP-740's and WP-765's `bothConditionCount` expectations, and the D-24628 Reassign count
- **`docs/ai/coverage/runtime-observed-hollows.json`:** regenerated if (and only if) `sim:runtime-observed:check` fails. The scaffold predicts it will.

## Out of Scope

- Cyber-Mod (`[keyword:Cyber-Mod][hc:X][hc:X]:`, 5 lines). It is a Victory-Pile mechanic and gets its own future WP.
- Microscopic Size-Changing repeated grant tokens, already routed to grants (D-24074).
- Implementing any effect-less gated hook ("Instead, do both" on non-fused cards, Dark Memories, Hyperspeed, Transform, etc.). Out of Time is WP-803.
- The mid-sentence repeated conditions (42 still emitted). They stay two identical plain conditions. De-duplicating them is cosmetic and would churn hook data for core cards.
- The `evaluateAllConditions` / `findFailedCondition` / `heroConditionHoldsForInPlay` signatures; the server sequence teacher; any client surface; card data; the rulings corpus.
- `vnom/venom/insatiable-hunger` and the other deferred Digest cards.

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroAbility.types.ts`, **modified**: `HeroCondition.requiredMatches?`; remove `bothConditionCount?`; the day-night `// why:`.
- `packages/game-engine/src/setup/heroAbility.setup.ts`, **modified**: `collapseLeadingRepeatedIconConditions` + its call site; both fusions stop deriving the count; four comments.
- `packages/game-engine/src/hero/heroConditions.evaluate.ts`, **modified**: count-aware class / team cases via the helper; `describeFailedCondition` count copy.
- `packages/game-engine/src/hero/heroEffects.execute.ts`, **modified**: digest both-select simplification + two handler JSDocs.
- `packages/game-engine/src/rules/heroKeywords.ts`, **modified (comment-only)**.
- `packages/game-engine/src/hero/doubledSuperpowerIcon.test.ts`, **new**: real-data sweep + end-to-end behavior (AC 1-2, 4-6).
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts`, **modified**: `requiredMatches` evaluator + message tests (AC 7-8).
- `packages/game-engine/src/setup/heroAbility.setup.test.ts`, **modified**: collapse unit tests (AC 3) + the Nanite migration (AC 9).
- `packages/game-engine/src/rules/heroAbility.setup.test.ts`, **modified**: the WP-740 fusion migration (AC 9).
- `packages/game-engine/src/hero/heroEffects.execute.test.ts`, **modified**: `crowdHook()` migration (AC 9).
- `packages/game-engine/src/hero/bodyTeamTokenGate.test.ts`, **modified**: the D-24628 Reassign count migration (AC 9).
- `docs/ai/coverage/runtime-observed-hollows.json`, **regenerated** (conditional on its check failing; expected).
- (conditional) `apps/dashboard/src/composables/useInPlayCoverage.test.ts`: re-pin `totalObs` / `percentResolved` with a provenance comment, ONLY if the dashboard suite fails after the regen (expected).
- (conditional) the sentinel fixture, `PRE_WP080_HASH`, `scripts/coverage/hero-effect-coverage.baseline.json`: ONLY if their check fails. Dual re-pin honestly with provenance (not expected).
- `docs/ai/post-mortems/01.6-WP-741-doubled-superpower-icon-condition-count.md`, **new**: the mandatory 01.6 post-mortem (new contract field and representation; `01.6` triggers).
- Governance close:
  - `docs/ai/STATUS.md`
  - `docs/ai/DECISIONS.md`: D-24563, plus annotations on D-24562, D-24598, D-24628, D-24692
  - `docs/ai/work-packets/WORK_INDEX.md`
  - `docs/ai/execution-checklists/EC_INDEX.md`
  - `docs/05-ROADMAP-MINDMAP.md`

---

## Contract

### `HeroCondition.requiredMatches?: number`

The number of distinct OTHER played-this-turn cards that must satisfy a `heroClassMatch` / `requiresTeam` condition. Absent ≡ 1. The parser emits it only for a leading-prefix repeat (m ≥ 2). Other condition types ignore it.

### Parse examples (locked)

| Line (prefix) | `conditions` |
|---|---|
| `[hc:ranged][hc:ranged]: You get +3[icon:attack].` | `[{type:'heroClassMatch',value:'ranged',requiredMatches:2}]` |
| `[hc:tech]: You get +1[icon:attack] for each other[hc:tech] Hero …` | `[{type:'heroClassMatch',value:'tech'},{type:'heroClassMatch',value:'tech'}]` (unchanged) |
| `[team:shield][team:shield][team:shield]: You may send this Hero or a [team:shield] Hero …` | `[{type:'requiresTeam',value:'shield',requiredMatches:3}]` (D-24628 already drops the body token) |
| `[hc:strength][hc:strength][hc:ranged][hc:ranged]: You get +6[icon:attack].` | `[{…'strength',requiredMatches:2},{…'ranged',requiredMatches:2}]` |
| `[hc:tech][hc:strength]: …` | `[{…'tech'},{…'strength'}]` (unchanged) |
| `[keyword:Cyber-Mod][hc:tech][hc:tech]: Draw a card.` | `[{type:'heroClassMatch',value:'tech'},{type:'heroClassMatch',value:'tech'}]` (unchanged) |
| `[team:venomverse][team:venomverse]: Instead, do both (in order).` | `[{type:'requiresTeam',value:'venomverse',requiredMatches:2}]` |
| `[team:x-men][team:x-men][team:x-men][team:x-men]: Instead, you get both.` (Nanite) | `[{type:'requiresTeam',value:'x-men',requiredMatches:4}]` |

### Fused effects (post-WP-741)

- **Play to the Crowd:** WP-740's locked effect with `bothConditionCount: 2` removed and `bothCondition: {type:'requiresTeam', value:'venomverse', requiredMatches:2}`.
- **Nanite Shapeshifter:** WP-765's fused effect with `bothConditionCount: 4` removed and `bothCondition: {type:'requiresTeam', value:'x-men', requiredMatches:4}`.

Every other key is unchanged. The Core-4 digest fused hooks and the other day-night fused hooks stay byte-identical, because their "both" lines are single-icon.

### D-24563 (lands Active at execution)

1. **Rule.** A Superpower whose leading icon prefix repeats an icon m times needs m distinct OTHER played-this-turn cards bearing that icon. The card itself never counts; another copy (a different `#N`) does (rulebook L683-696). The rulebook states the two-icon rule as "cards with both of those icons". That two IDENTICAL icons need two cards is an inference from that wording, because the extracted text strips the icon glyphs. It is recorded here as the ruling this engine follows.
2. **Source of multiplicity.** Only the leading icon run of a line, the D-24628 `LEADING_GATE_PREFIX_PATTERN` match, reused rather than duplicated. Tokens anywhere else never add multiplicity. This protects the 61 raw lines that repeat a condition token outside a repeated leading prefix. 19 of them already emit no repeat: 14 D-24628 body-token drops (including Victoria Hand's and Reassign's body token, core A Day Unlike Any Other and core X-Men United) and 5 Empowered "by [hc:X]" param splices (Jocasta, Wonder Man, Queen Storm ×2, Shuri). The 42 that still emit a repeat (Arc Reactor ×2, Absorb Energies, Radiation Focus Array, the Cyber-Mod lines, and others) are untouched.
3. **Representation.** `HeroCondition.requiredMatches?: number`, omitted when the count is one, produced by collapsing the repeated emitted conditions. Only `heroClassMatch` / `requiresTeam` honor it, through `countOtherInPlayMatchingCondition`.
4. **Counting.**
   - Counts read `playedCardIdsThisTurn` (cards you played, wherever they went, so a set-aside Out of Time card counts; L3443-3446). They never read `playedCardIdsStillInPlay`.
   - A card matching several distinct icons (multiclass, dual-class, Size-Changing, copied team) counts toward each (rulebook Multiclass L3110-3116).
   - Mixed `[X][Y]` pairs are unchanged.
   - A Penumbra both-sides split card counts as its two face ids (D-24619 §4: "play both sides as if they were two different cards"), so one such card whose faces both bear the icon satisfies a ×2 gate. This is a rules reading for Jeff to confirm at close.
5. **`bothConditionCount` retired from both fusions.**
   - This supersedes D-24562 lock 1, the "`evaluateCondition` / `evaluateAllConditions` untouched" clause of D-24562 lock 4, and D-24598's Nanite count derivation.
   - D-24562 lock 5 is narrowed to mixed DISTINCT-icon lines.
   - No schema migration: pre-deploy match blobs keep their setup-time hooks.
   - Accepted window: two fused cards lose their count gate in flight or on replay, in matches created between their deploy and this one. Play to the Crowd (WP-740's deploy) and Nanite (WP-765's deploy).
   - Stored `competitive_scores` stay frozen, not re-verified (D-24616 §5).
   - Annotations at close:
     - **D-24562:** "lock 1 and lock 4's evaluator-untouched clause superseded by D-24563; lock 5 narrowed to mixed distinct-icon lines; lock 4's 'never persisted' is corrected: match blobs persist setup-time hooks (D-24095)."
     - **D-24598:** "Nanite's bothConditionCount 4 superseded by bothCondition.requiredMatches 4 (D-24563)."
     - **D-24628:** "Reassign keeps one count-3 gate after D-24563's collapse."
     - **D-24692** (lock 10, the repeated-gate deferral): "Sniper Squad / Reshape Reality now need 4 / 2 other cards (D-24563)."
6. **Scope limit.** Cyber-Mod and Size-Changing repeated tokens are out of scope, since neither is a leading icon run.

---

## Acceptance Criteria

1. **Real-data sweep** (`doubledSuperpowerIcon.test.ts`). It reads `data/cards/*.json` via `node:fs`; the precedent is `hero/masterStrikeOrAmbushCondition.test.ts` ~`:144`.
   - For every hero line matching `LEADING_GATE_PREFIX_PATTERN` (the test carries its own literal copy, since the constant is module-private) with a repeated token, build that line ALONE as a single-ability synthetic card through `buildHeroAbilityHooks` (a minimal `getSet` registry). A lone line has no fusion partner, so every line yields a normal hook.
   - That hook carries exactly one condition per repeated (`type`, `value`), with `requiredMatches` equal to the prefix multiplicity.
   - The sweep finds **35** such lines. A different count fails loudly and must be explained, not re-pinned blindly.
2. **Landmine guard.** Each of these hooks is deep-equal to its baseline conditions, with no `requiredMatches` key, and still carries two plain identical conditions:
   - core `iron-man/arc-reactor` and `msp1/iron-man/arc-reactor`
   - `ssw1/captain-marvel/absorb-energies`
   - `xmen/havok/radiation-focus-array`
   - `2099/ghost-rider-2099/infernal-chainsaw`

   No hook built from a line WITHOUT a repeated leading prefix carries `requiredMatches` (a sweep assertion over all sets).
3. **Parser unit tests** (`setup/heroAbility.setup.test.ts`, through `buildHeroAbilityHooks` on single-line synthetic cards) reproduce every row of the §Contract parse-examples table. Each test uses the row's full printed line from `data/cards`; the table elides text with "…"
4. **Bishop end-to-end** (`dkcy/bishop/concussive-blast`, via `buildHeroAbilityHooks` + `executeHeroEffects`):
   - One other Ranged Hero → no +3 Attack. The blocked line's reason clause is `it needs 2 other ranged Heroes played this turn`, with no "not supported yet" tail.
   - Two other Ranged Heroes → +3.
   - One other Ranged Hero plus a second copy of Concussive Blast (a different `#N`) → +3.
   - The triggering card itself plus one other Ranged Hero → no grant.
5. **Mixed pair, doubled mixed, Crystal of Kadavus.**
   - A `[hc:tech][hc:strength]:` Superpower fires with ONE other dual-class Tech/Strength card, and also with one Tech + one Strength card.
   - Cosmic Energies needs 2 other Strength and 2 other Ranged cards. Two Strength/Ranged dual-class others satisfy it; one Strength + two Ranged does not.
   - **Crystal of Kadavus:** one other Venomverse Hero → "Do this ability again" is blocked, with `it needs 2 other venomverse Heroes played this turn`. Two → it re-arms (`remainingRepeats` is 1).
6. **Out of Time.** Requires WP-803's ledger, which is on main by the time this WP executes.
   - A card set aside Out of Time earlier this turn (in `turnEconomy.outOfTimePlayedCardIds`) counts toward a doubled gate.
   - A card's own turn-2 replay never counts itself.
7. **Evaluator unit tests** (`heroConditions.evaluate.test.ts`):
   - `requiredMatches` 2 / 3 on `heroClassMatch` and `requiresTeam`. The team count includes a basic S.H.I.E.L.D. token (D-24391).
   - Absent / 1 / 0 / non-integer ≡ 1.
   - `requiredMatches` on an unrelated type is ignored.
8. **`describeFailedCondition`.** The count-1 strings are byte-identical to baseline; the existing tests pass unchanged. The count > 1 string is exactly `it needs ${n} other ${value} Heroes played this turn`.
9. **Migrations.** These are representation changes only; no assertion is weakened.
   - `rules/heroAbility.setup.test.ts` fused deep-equal (~`:2522`): no `bothConditionCount` key (asserted by the deep-equal; do not name the retired field in test source), and `bothCondition: {type:'requiresTeam', value:'venomverse', requiredMatches:2}`.
   - `rules/heroAbility.setup.test.ts` mixed "both" test (~`:2546-2557`):
     - Retitle it to `…carries no requiredMatches for a mixed "both" line (D-24562 lock 5 / D-24563)`.
     - Replace the `bothConditionCount` assertion with `assert.equal(effect.bothCondition?.requiredMatches, undefined)`.
     - Keep the `bothCondition` deep-equal.
   - `hero/heroEffects.execute.test.ts` `crowdHook()` (~`:8003-8016`): drop `bothConditionCount: 2` and add `requiredMatches: 2` to `bothCondition`. WP-740's behavior tests then pass unchanged.
   - `setup/heroAbility.setup.test.ts` Nanite fusion (~`:1723-1734`):
     - Drop `assert.equal(effect.bothConditionCount, 4)`.
     - Deep-equal `bothCondition` to `{ type: 'requiresTeam', value: 'x-men', requiredMatches: 4 }`.
     - Retitle the test to `'Nanite Shapeshifter fuses with bothCondition.requiredMatches 4 from its four [team:x-men] tokens (D-24563)'`, because its current title names `bothConditionCount` and AC 10's grep would never come back empty. Nanite's end-to-end test (`heroEffects.execute.test.ts` ~`:8837`) passes unchanged.
   - `hero/bodyTeamTokenGate.test.ts` (~`:87-90`): `assert.deepEqual(conditions, [{ type: 'requiresTeam', value: 'shield', requiredMatches: 3 }], 'three printed [team:shield] gate tokens collapse to one count-3 gate; the body repeat stays dropped (D-24628)')`.
   - The commit carries a `Tests-changed:` trailer naming all five.
   - The Core-4 digest hooks and the other day-night hooks are byte-identical to baseline.
10. **The field is gone.** `grep -rn "bothConditionCount" packages/game-engine/src` returns no output.
11. **Full green.**
    - Full engine suite green; `pnpm -r build` exits 0.
    - `apps/server` `sequenceTeacher.logic.test.ts` green; `apps/dashboard` suite and `typecheck` green; `pnpm -r --no-bail test` → 0 fail.
    - The six card / coverage `:check`s exit 0, after the conditional regen.
    - `finalStateHash` / `PRE_WP080_HASH` unchanged. If either moves, dual re-pin with provenance and explain which affected hero reached the fixture.

---

## Verification Steps

1. `pnpm -r build` → 0. Then `pnpm --filter @legendary-arena/game-engine test` → all pass.
2. `pnpm sim:runtime-observed:check`. If it fails, run `pnpm sim:runtime-observed`, re-check → 0.
3. Run the dashboard chain: `pnpm --filter @legendary-arena/dashboard run prebuild:snapshot`, `prebuild:coverage`, `prebuild:effect-index`, `prebuild:par`, then `test:coverage` and `typecheck`. `pretest` runs `check-generated-data.mjs`. Re-pin `totalObs` / `percentResolved` with dated provenance only if it fails, which is expected.
4. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:coverage --check` → all exit 0.
5. `node --import tsx --test apps/server/src/coach/sequenceTeacher.logic.test.ts` → all pass. Then `pnpm -r --no-bail test` → 0 fail.
6. `grep -rn "bothConditionCount" packages/game-engine/src` → no output.
7. `git diff --name-only` ⊆ `## Files Expected to Change`. Revert any CRLF-only `packages/lagn-spec/schemas/lagn-v1.json` churn.

---

## Vision Alignment

**Vision clauses touched:**
- §1, §2, §10: card data / content semantics (printed rule fidelity).
- §3, §8, §22: determinism (setup-built hook data changes).
- §20-26: the simulation baseline regen; outcomes on affected cards shift.

**Conflict assertion:** no conflict; this WP preserves all touched clauses. It makes 35 shipped lines gate on their printed "Critical Hit" requirement (rulebook L683-696) and changes no card text.

**Non-Goal proximity check:** NG-1..7 are not crossed. The gate is decided solely by game state and applies identically to every player of the card. There is no monetization, cosmetic or paid surface.

**Determinism preservation:**
- The parser collapse is a pure setup-time string transform.
- Evaluation is a pure, `ctx`-free `for…of` count over the played-this-turn list.
- No `Math.random` and no new persisted field.
- Replay stays faithful except the accepted fused-card window (D-24563 lock 5).
- No committed hash fixture includes an affected hero (re-measured 2026-10-12).
- The runtime-observed simulation artifact is regenerated deterministically.

---

## Lint Gate Self-Review (00.3)

- **§1 structure:** all required sections are present and non-empty. Out of Scope names Cyber-Mod, Size-Changing, the hollow hooks, mid-sentence repeats, the server / client and the rulings corpus.
- **§2 constraints:** engine-wide (full files, no diffs or snippets, ESM, Node v22+, 00.6), packet-specific, and the session protocol. Consistent with the body and the Contract.
- **§3 assumes:** WP-740's and WP-765's landed surfaces are named symbol by symbol with `~` anchors on `6cf0c6f7`. Also covered: the parser and evaluator anchors, the instance-id format, the rulebook lines, and the WP-803 sequencing.
- **§4 context:** the re-measured inventory, the 61 → 42 landmine split, the scaffold's observed numbers (draft and re-validation), fixture exposure, the WP-803 interaction and memory refs.
- **§5 files:** every file is marked new / modified / regenerated / conditional, with a one-line change. The forced `bodyTeamTokenGate.test.ts` edit and the mandatory 01.6 post-mortem are listed.
- **§6 naming:** `requiredMatches` and `collapseLeadingRepeatedIconConditions` are full English words. Canonical `{setAbbr}/{heroSlug}/{cardSlug}` keys.
- **§7 dependencies:** all ✅; sequenced after WP-803; no new npm package.
- **§8 boundaries:** Game Engine only. Pure helpers stay free of `boardgame.io`. No server, client or registry edit. G stays JSON-plain.
- **§9 Windows:** `pnpm` / `node` commands; `grep` via Git Bash.
- **§10 env:** N/A.
- **§11 auth:** N/A.
- **§12 tests:** `node:test` + `node:assert`, deterministic, real-data reads via `node:fs`, no `boardgame.io/testing`. The sweep fails loudly on an unexpected count. The migrations weaken no assertion.
- **§13 verification:** exact commands, including the dashboard prebuild chain and the conditional regens.
- **§14 acceptance:** 11 binary criteria tied to named cards, strings and counts.
- **§15 DoD:** STATUS / DECISIONS (+4 annotations) / WORK_INDEX / EC_INDEX / mindmap + scope check. The User-Visible Surface + Impact are present, and the D-24026 live-verify item is present.
- **§16 code style:** one small named pure function + JSDoc + `// why:`. It reuses the existing prefix regex (no duplicate) and WP-740's helper. No `.reduce()`.
- **§17 vision:** present, with clause numbers, the conflict assertion, the NG check and the determinism line.
- **§18 prose-vs-grep:** the only grep (Verification 6) targets a token this WP removes.
- **§19 bridge staleness:** re-baselined to post-WP-803 main, with the re-validation on `6cf0c6f7` cited.
- **§20 funding:** N/A.
- **§21 API catalog:** N/A.

**Verdict:** all 21 sections PASS or are justified N/A.

---

## Gate Record

### Draft (2026-09-22, baseline `1475218f`)

**Pre-flight (01.4): READY TO EXECUTE.** PS-1 through PS-4 were fixed in place:
- PS-1: WP-740 merged mid-draft (re-baselined and re-scaffolded).
- PS-2: the shipped symbol names.
- PS-3: the WP-740 mixed test's exact rewrite.
- PS-4: single-line synthetic builds through `buildHeroAbilityHooks`.

RS-1 through RS-4 were applied or noted.

**Copilot (01.7): RISK / HOLD, then PASS.**
- The first pass fixed five scope-neutral items:
  - the persisted-hook upgrade story
  - the supersession wording
  - the magnitude-less trio
  - Empowered ordering
  - the helper's JSDoc
- The re-run passed.
- The verification of Victoria Hand / Reassign as "3 prefix + 1 mid-sentence" was **superseded by D-24628** (see the re-validation).

### Re-validation (2026-10-12, `6cf0c6f7`)

**Pre-flight (01.4): DO NOT EXECUTE YET → fixed in place.** The design holds and the inventory (35 / 13) is unchanged. The prototype gave 5087 / 5, and every failure is a planned migration. Five blockers were applied in this revision:
- **PS-1:** WP-765's `buildDayNightBothFusion` is a second `bothConditionCount` consumer (Nanite). Both fusions retire the field; a Contract row and an AC 9 migration were added; D-24598 is annotated.
- **PS-2:** the forced `hero/bodyTeamTokenGate.test.ts` Reassign edit was added to Files and AC 9; D-24628 is annotated.
- **PS-3:** the parse table's Victoria Hand row is now one count-3 condition. The 61 → 42 / 19 landmine split is documented.
- **PS-4:** the baseline is now post-WP-803; every line ref became a `~symbol` anchor; the EC's anchor check STOPs only on symbol or signature drift; scaffold figures were refreshed; the sweep has 21 heroes.
- **PS-5:** the Impact list was rebuilt: Crystal of Kadavus added, plus Sniper Squad / Reshape Reality after WP-803. Nanite and Play to the Crowd are representation-only, and the trio keeps the "not supported yet" tail. A Crystal of Kadavus AC was added.

RS items applied:
- RS-1: reuse `LEADING_GATE_PREFIX_PATTERN` / `leadingGatePrefixMatch` (no second regex).
- RS-2: the sweep precedent.
- RS-3: the dashboard prebuild chain.
- RS-4: AC 6 + D-24563 lock 4 + the D-24692 annotation.
- RS-5: the landmine AC.
- RS-6: the EC engine-count band.
- RS-7: the trio's tail + Bishop's reason clause.

**Pre-flight (01.4), re-check: READY TO EXECUTE** (2026-10-12; conditional on WP-803 merging first). All PS / RS fixes are verified against source; the parse table and the five migrations match the prototype exactly. Three text fixes were applied:
- **R-1:** Victoria Hand and Yo-Yo are log-only. Their bare `undercover` token has been hollow since WP-678 / D-24494; the original draft's "5 real payoffs" was wrong and both earlier gates passed it.
- **R-2:** the 61-line landmine split is 42 + 19 (14 D-24628 drops + 5 Empowered splices).
- **R-3:** the test-file AC labels.

Optional fixes also applied:
- **RR-1:** fresh `RegExp` tokenizers.
- **RR-2:** the day-night handler is JSDoc-only.
- **RR-3:** the 4 / 5 / 2 / 22 split.
- **RR-4:** the sweep's literal pattern copy.

**Copilot (01.7), re-validation: RISK / HOLD → fixed in place** (2026-10-12). The design holds; the 35-line inventory was re-run independently; RS-1 is in scope; the "never synthesize" rule is sound; WP-803 (#2734) composes cleanly. All 14 scope-neutral findings were applied:
1. Retitle the Nanite test, so AC 10's grep can pass.
2. The EC lists the governance-close files.
3. The mandatory 01.6 post-mortem is added.
4. Fresh `RegExp` tokenizers in the EC.
5. The partial-emit and order rules.
6. Post-WP-803 expected numbers (5136 / 7834 / 8755 / 14.1) and the expected direction.
7. `pnpm -r --no-bail test` and the dashboard `typecheck`.
8. The EC STOP-trigger scope.
9. 33 of 35, plus the Synergy Rate note.
10. The Penumbra both-sides reading, added to lock 4 for Jeff to confirm.
11. The sequence-teacher note.
12. The D-24562 "never persisted" correction, plus frozen `competitive_scores`.
13. AC 6 / AC 5 / AC 3 wording and the dependency line.
14. This record, 42 / 19, and the D-24692 lock 10.

**Copilot (01.7), re-check: CONFIRM** (2026-10-12). All 14 fixes are verified, and the EC is 96 content lines with its Locked Values verbatim. Applied:
- R1: the EC `// why:` and WP AC 9 never spell the retired field, so AC 10's grep can pass.
- Nits: the EC scope lock uses ⊆, and two stale Gate Record wordings are fixed.

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` ⊆ `## Files Expected to Change`.
- [ ] `docs/ai/STATUS.md` updated. D-24563 landed Active in `DECISIONS.md`, with the four D-24563 lock 5 annotations (D-24562, D-24598, D-24628, D-24692). WORK_INDEX row checked; EC_INDEX Done; mindmap node `✅`; `roadmap:counts:check` 0.
- [ ] The 01.6 post-mortem written at `docs/ai/post-mortems/01.6-WP-741-doubled-superpower-icon-condition-count.md`.
- [ ] Two-commit topology: `EC-778:` implementation + `SPEC:` governance close.
- [ ] **D-24026 live-verify (post-merge, REQUIRED).** Verify against the deployed `/api/version` gitSha, in a live match on `play.legendary-arena.com` created AFTER the deploy (in-flight matches keep their setup-time hooks), with Dark City's Bishop in the loadout:
  - Concussive Blast after ONE other Ranged Hero grants no +3 and logs "it needs 2 other ranged Heroes played this turn".
  - After TWO, it grants +3.

  Recorded as a follow-up STATUS-flip, not a merge blocker.
