# WP-824 — Cap 75th count-scaled hero lines: two Savior lines per Hero Class, Paramilitary Ops per costed S.H.I.E.L.D. Hero (Game Engine + card data)

**Status:** Draft 2026-10-23 — pre-flight READY; copilot RISK (all fixes applied); 00.3 PASS — see §Gate Record (EC-862; **D-24757** reserved (#2977)).
**Primary Layer:** Game Engine (`rules/` + `hero/` count source) plus the hero-ability marker input and its regenerated card data
**Dependencies:** none open. Builds on WP-247 / D-24016 (`attack-per-count`), WP-674 / D-24489 (`recruit-per-count`), WP-680 / D-24497 + D-24529 (`distinct-hero-classes-played-this-turn`, hand + play), WP-653 / D-24464 (the Savior condition), WP-681 / D-24498 (`cardCountsAsTeamMember` folds in the basic S.H.I.E.L.D. tokens), #2449 (the per-class marker backfill that deferred the two Savior lines).
**User-Visible Surface:** `play.legendary-arena.com` (any match using the Cap 75th heroes Steve Rogers Director of S.H.I.E.L.D., Captain America (Falcon), or Agent X-13)
**Lane:** Standard (two-session). It adds a member to the canonical `HERO_COUNT_SOURCES` array, spans the engine and the card-data pipeline, and shifts the fixed-seed `sim:runtime-observed` sweep, so the lightweight lane's eligibility is not clear-cut (D-24028: ambiguity resolves to the standard lane).
**Arc:** Cap 75th completion, remaining item 3 (auto-memory `project_cap75_completion_arc`).

> Baseline: `origin/main` at `2b6d052e` (the reserve commit #2977 on top of `9a91b190`). Re-read line anchors and test totals at execution.

---

## Goal

As a player using the Cap 75th heroes, I want three hero lines to grant what they print, so that a Savior with many Hero Classes, or a player who chains real S.H.I.E.L.D. Heroes, gets the full amount.

Today each line parses to a flat grant:
- **International Strike Force, line 1** (`ca75/steve-rogers-director-of-shield/international-strike-force`): "[keyword:Savior]: You get +1[icon:attack] for each Hero Class you have." It grants a flat +1 Attack under the Savior gate. Live: +1 with count 3 (match 1oDjFITY7nP, log 27.2.3).
- **Star-Spangled Hero, line 1** (`ca75/captain-america-falcon/star-spangled-hero`): "[keyword:Savior]: You get +2[icon:recruit] for each Hero Class you have." It grants a flat +2 Recruit under the Savior gate. Live: +2 with count 2 (26.2.10).
- **Paramilitary Ops** (`ca75/agent-x-13/paramilitary-ops`): "You get +1[icon:attack] for each other [team:shield] Hero you played this turn that costs 1 or more." It grants a flat +1 gated on `requiresTeam: shield`, so a single cost-0 Agent or Trooper unlocks it and a second costed S.H.I.E.L.D. Hero adds nothing. The live +1 at 27.2.9 / 31.2.4 only looked right because exactly one costed S.H.I.E.L.D. Hero preceded it each time.

After this session:
- The two Savior lines grant `magnitude × (distinct Hero Classes you have, hand + play)` when you are a Savior (3+ Bystanders in your Victory Pile), and nothing otherwise.
- Paramilitary Ops grants +1 Attack per OTHER card played this turn that counts as a S.H.I.E.L.D. Hero AND costs 1 or more. The S.H.I.E.L.D. Officer (cost 3) counts; the Agent and Trooper starters (cost 0 in `G.cardStats`) and the card itself never do.

## Scaffold (observed at drafting, REQUIRED evidence)

On 2026-10-23 the change was prototyped in the drafting worktree, measured, and reverted. The scaffold patch is evidence only, not an input: it predates the Assumes 4 correction, so its "no cardStats row" comments and its starter-free fixtures are wrong. Re-author from Locked Values and the Test Contract.

- **Parser probe.** Built single-line hooks with `buildHeroAbilityHooks`:
  - `[keyword:Savior]: … [keyword:attack-per-count:distinct-hero-classes-played-this-turn:1]` → effects `[{ attack-per-count, 1, distinct-hero-classes-played-this-turn }]`, conditions `[{ bystandersInVictoryAtLeast, '3' }]`.
  - The recruit twin yields the `recruit-per-count` equivalent.
  - So the Savior condition and a count marker already compose on one hook, and the D-24016 / D-24489 icon suppression drops the flat grant. **No parser change is needed.**
  - Paramilitary Ops with a count marker keeps `requiresTeam: shield`, exactly as Nick Fury's Legendary Commander does on main. That gate never changes the outcome: when it fails, no other S.H.I.E.L.D. card was played, so the count is 0 too.
- **Count source.** No existing source filters a team count by cost. `shield-heroes-played-this-turn` counts the starters, which is the bug. A new source is required.
- **Tests.** The new real-data test file (Test Contract T1-T10) passed 10 / 10 with the change. Swapping in the baseline `data/cards/ca75.json` failed 7 / 10; the 3 that still passed are cases whose answer is 0 either way. The resolver test file passed 59 / 59.
- **Derived artifacts.** `apply-hero-ability-markers.mjs` updated exactly 3 lines in `data/cards/ca75.json`. The following went stale and were regenerated: `ledger:heroes` (+3 per-count rows), `effect-index`, `mechanics:metadata` (Attack Per Count 33 → 35 cards, Recruit Per Count 9 → 10), and `sim:runtime-observed` (7794 → 7793 observations; `gate-only` 454 → 453, a fixed-seed trajectory shift). The dashboard `useInPlayCoverage` totalObs pin then moved 8715 → 8714 (resolvedObs 1091 and 12.5% unchanged).
- These stayed green with no regeneration: `cards:check`, `cards:count-markers:check` (after the two DEFERRED entries were removed), `ledger:villains:check`, `sim:coverage --check`.
- These deltas were measured at `2b6d052e` and are expectations, not targets. If main has moved the feed, the observed delta governs: record it, and explain any difference from -1 in the dashboard comment and in D-24757.

## User-Visible Impact

- Steve Rogers' International Strike Force: a Savior holding and playing Heroes of 4 classes gets +4 Attack from line 1 (was +1), on top of line 0's +4 Recruit.
- Captain America (Falcon)'s Star-Spangled Hero: a Savior with 4 classes gets +8 Recruit from line 1 (was +2), on top of line 0's +8 Attack.
- Agent X-13's Paramilitary Ops: +1 Attack per other costed S.H.I.E.L.D. Hero (an Officer, another Agent X-13 card, a Nick Fury, …). Starters alone give +0 (was +1).
- The game log's count-scaled line names the new source as "other S.H.I.E.L.D. Hero costing 1 or more played this turn".
- Every other card is unchanged.

---

## Assumes

1. **Parser** (`setup/heroAbility.setup.ts` on the baseline):
   - `COUNT_SCALED_PATTERN` (L274) and `RECRUIT_COUNT_SCALED_PATTERN` (L280) accept any `[a-z][a-z-]*` source. Steps 2d / 2d′ (~L1855-1900) emit the effect only when `isValidHeroCountSource(source)` holds, i.e. the source is in `HERO_COUNT_SOURCES`.
   - The `savior` keyword arm (L1709) pushes `{ type: 'bystandersInVictoryAtLeast', value: '3' }`.
   - Step 1b (L1296) pushes `requiresTeam` for the inline `[team:shield]`.
2. **Count sources** (`rules/heroCountSource.ts`): `HeroCountSource` (L36) and `HERO_COUNT_SOURCES` (L68) hold 16 values in lockstep. The last one is `extra-cards-drawn-this-turn`.
3. **Resolver** (`hero/heroCountSource.resolve.ts`):
   - `resolveCountSource` (L381) dispatches per source. `'shield-heroes-played-this-turn'` (L419) calls `countTeamCardsPlayedThisTurn(…, 'shield')` (L261), which is self-exclusive over `playedCardIdsThisTurn` and uses `cardCountsAsTeamMember`.
   - `explainCountSourceInputs` (L745) mirrors it (L783); count === list length.
   - `playedCardIdsThisTurn` (`hero/splitCard.logic.ts` ~L174) is already imported by the resolver. `distinct-hero-classes-played-this-turn` is self-INCLUSIVE (it counts the resolving card's own class), which T2 / T5 rely on.
4. **S.H.I.E.L.D. membership and cost:**
   - `cardCountsAsTeamMember(G, id, 'shield')` (`hero/effectiveTeams.logic.ts` L144) → `cardCountsAsShieldHero` (L117), which includes the `pile-shield-officer`, `starting-shield-agent` and `starting-shield-trooper` tokens.
   - `G.cardStats[pile-shield-officer].cost` is 3 (`setup/buildInitialGameState.ts` L557). The Agent and Trooper carry `cardStats` rows with `cost: 0` (`setup/buildInitialGameState.ts` L542-543), their printed cost; the `?? 0` fallback covers any card with no row.
5. **Log label** (`hero/countSourceLabel.ts`): `describeCountSource` has one case per source (the last is `extra-cards-drawn-this-turn`, L52). `countSourceLabel.test.ts` iterates `HERO_COUNT_SOURCES` and fails on a missing label.
6. **Card data** (`data/cards/ca75.json`, generated): the three target lines are as quoted in §Goal, with no marker. `scripts/convert-cards/inputs/hero-ability-markers.json` already marks ability 0 of International Strike Force and Star-Spangled Hero (#2449). `VALID_TOKEN_PATTERN` in `apply-hero-ability-markers.mjs` accepts `attack-per-count` / `recruit-per-count` with any lowercase-hyphen source.
7. **Count-marker gate**: `scripts/check-hero-count-markers.mjs` `DEFERRED` (L155) lists both ca75 Savior lines, and a stale deferral fails `--check`.
8. **Dashboard pin**: `apps/dashboard/src/composables/useInPlayCoverage.test.ts` L585 pins `totalObs` to 8715 against the committed runtime-observed feed.
9. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why markers and one source, not parser work.** The scaffold shows that a Savior-prefixed line composes with a count marker on one hook. The two Savior lines were deferred in #2449 only "until the marker is composed with that gate and verified"; this packet is that verification. Paramilitary Ops needs a cost filter that no source has, and a new source is the parameterized path (`rules/heroCountSource.ts` header: one enum entry plus one resolver branch, never a per-card keyword).
- **Why a new source, not a parameter on the team counter.** The duplicate-first rule (`.claude/rules/code-style.md`) and the closed-union contract: `shield-heroes-played-this-turn` keeps its exact Legendary Commander semantics, and the cost-filtered sibling is its own value. The slug spells "one" because a count-source slug can't contain a digit (the `cost-four-plus-played-this-turn` precedent).
- **Why keep Paramilitary's `requiresTeam` gate.** It is harmless here (see §Scaffold) and identical to Legendary Commander and A Day Unlike Any Other on main. Suppressing descriptive team tokens on count lines is a corpus-wide change, out of scope.
- **"Hero Class you have"** is the rulebook term of art: hand + cards played this turn (`docs/legendary-universal-rules-v23.md` §"'Your Heroes/Allies' & 'Heroes/Allies You Have'"; D-24529). The existing source already reads it that way.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (`[keyword:…]`).
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #1 (determinism), §Layer Boundary (engine owns the rule; card data is a setup-time input, D-24016's marker pipeline).
- `docs/ai/DECISIONS.md`: scan D-24016, D-24489, D-24497, D-24529, D-24464, D-24498, D-24655 (the last direct count-source addition) before coding.
- User memory: `reference_attack_per_count_marker_mechanism`, `reference_per_class_count_marker_backfill_gap`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_engine_tests_never_typechecked`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- No randomness, no I/O, no registry access at runtime. The resolver reads `G` only and never mutates it.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24757) before coding. One WP per session.

**Packet-specific:**
- **Card data is generated.** Edit `hero-ability-markers.json`, run `node scripts/convert-cards/apply-hero-ability-markers.mjs`, and commit its output. Never hand-edit `data/cards/ca75.json`.
- **Lockstep.** The new source lands in the union, the array, `resolveCountSource`, `explainCountSourceInputs` and `describeCountSource` together, with the drift pin as a RUNTIME keyset assertion (D-24372).
- **No parser change.** If the scaffold result does not reproduce (a Savior line does not yield one gated per-count effect), STOP: that is a scope change.
- **Regenerate derived artifacts honestly.** Run each `:check`; regenerate only what it reports stale, and record each regeneration with its observed delta.

## Locked Values

- **Source slug:** `'shield-heroes-cost-one-plus-played-this-turn'`, appended LAST to both the `HeroCountSource` union and `HERO_COUNT_SOURCES` (17 entries).
- **Threshold constant** (`hero/heroCountSource.resolve.ts`): `const SHIELD_HERO_MINIMUM_COST = 1;`.
- **Counter:** `function countShieldHeroesCostOnePlusPlayedThisTurn(G, playerID, triggeringCardId): number`.
  - Iterate `playedCardIdsThisTurn(G, playerZones.inPlay)` with `for…of`; skip `triggeringCardId`.
  - Count a card iff `cardCountsAsTeamMember(G, id, 'shield')` AND `(G.cardStats?.[id]?.cost ?? 0) >= SHIELD_HERO_MINIMUM_COST`.
  - Missing `playerZones` → 0.
- **Collector:** `collectShieldHeroesCostOnePlusPlayedThisTurn(G, playerID, triggeringCardId): CardExtId[]`, the same predicate, returning ids in play order.
- **Dispatch:** `case 'shield-heroes-cost-one-plus-played-this-turn'` in `resolveCountSource` (after `'shield-heroes-played-this-turn'`) and in `explainCountSourceInputs`.
- **Label:** `'other S.H.I.E.L.D. Hero costing 1 or more played this turn'`.
- **Markers** (`hero-ability-markers.json`, `ca75` array, after the International Strike Force ability-0 entry, in this order; each entry is `{ heroSlug, cardSlug, abilityIndex, markupToken }`, the existing shape):
  - `captain-america-falcon` / `star-spangled-hero` / abilityIndex 1 / `[keyword:recruit-per-count:distinct-hero-classes-played-this-turn:2]`
  - `steve-rogers-director-of-shield` / `international-strike-force` / abilityIndex 1 / `[keyword:attack-per-count:distinct-hero-classes-played-this-turn:1]`
  - `agent-x-13` / `paramilitary-ops` / abilityIndex 0 / `[keyword:attack-per-count:shield-heroes-cost-one-plus-played-this-turn:1]`
- **Count-marker gate:** remove the two ca75 entries from `DEFERRED` in `scripts/check-hero-count-markers.mjs` (the three remaining entries stay).
- **Comment accuracy:** `// why:` comments name the Agent / Trooper as `cost: 0` in `G.cardStats` (not "no row"); the `?? 0` fallback is for cards without a row.

## Scope (In)

- **A)** `rules/heroCountSource.ts`, `hero/heroCountSource.resolve.ts`, `hero/countSourceLabel.ts`: the new source.
- **B)** `hero/heroCountSource.resolve.test.ts` (drift pin 16 → 17, resolver + explain cases) and a NEW `hero/ca75CountScaledHeroLines.test.ts` (real hooks from `data/cards/ca75.json` through `executeHeroEffects`).
- **C)** `scripts/convert-cards/inputs/hero-ability-markers.json` (3 markers) → regenerated `data/cards/ca75.json`; `scripts/check-hero-count-markers.mjs` DEFERRED trim.
- **D)** Regenerated derived artifacts that their `:check` reports stale, and the dashboard totalObs pin that follows the runtime-observed feed.

## Out of Scope

- **co2e Nick Fury Stealth Assault Squad** ("+2[icon:attack] if you played another [team:shield] Hero that costs 1 or more this turn"). It has the same starter-unlocks-it defect but needs a cost-filtered team *gate*, not a count. It is a separate follow-up.
- Suppressing descriptive `[team:X]` gates on count-scaled lines corpus-wide (Legendary Commander, A Day Unlike Any Other, X-Men United keep theirs).
- Extending `cards:count-markers` to scan team-count lines.
- The other remaining Cap 75th items (the optional-KO family, Flying Shield Block, Winter Soldier, the three schemes).
- Any client change: the count-scaled log line already prints through `describeCountSource`.

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/heroCountSource.ts`: modified (union + array)
- `hero/heroCountSource.resolve.ts`, `hero/heroCountSource.resolve.test.ts`: modified
- `hero/countSourceLabel.ts`: modified
- `hero/ca75CountScaledHeroLines.test.ts`: **new**

**Card data + scripts**
- `scripts/convert-cards/inputs/hero-ability-markers.json`: modified
- `data/cards/ca75.json` — regenerated
- `scripts/check-hero-count-markers.mjs`: modified (DEFERRED trim)

**Derived artifacts (regenerated only if their `:check` reports stale; the scaffold saw all five)**
- `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv` — regenerated
- `data/metadata/effect-implementation-index.json` — regenerated
- `data/metadata/card-mechanics.json` — regenerated
- `docs/ai/coverage/runtime-observed-hollows.json` — regenerated
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts`: the totalObs pin, re-pinned only to the regenerated feed's value, with a dated comment

That is 8 hand-edited code / data / script files (2 tests) plus up to 6 mechanically regenerated artifacts. It sits above the ~8 guideline only because the card-data pipeline fans one marker edit out to generated feeds (the WP-822 / #2449 precedent); nothing in the regenerated set is hand-authored.

**Governance:** `docs/ai/DECISIONS.md` (D-24757), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note)

## Contract

- New `HeroCountSource` value `'shield-heroes-cost-one-plus-played-this-turn'` with the counter / collector / label in Locked Values. The union is a closed canonical set, so the addition is recorded in D-24757.
- No new keyword, effect type, condition type, `G` field or UIState field. `ca75.json` gains three marker tokens; the hooks built from them change for those three lines only.

## Test Contract

Real-data cases (`ca75CountScaledHeroLines.test.ts`) build hooks from `data/cards/ca75.json` via `buildHeroAbilityHooks` (the `doubledSuperpowerIcon.test.ts` pattern) and play the first copy through `executeHeroEffects`. "Savior" = 3+ `pile-bystander` in the Victory Pile. Classes come from `G.cardTraits`; costs from `G.cardStats`. The T8, T10 and T11-T13 fixtures include `{ cost: 0 }` rows for `starting-shield-agent` / `starting-shield-trooper` (the real setup shape), so a "has a cardStats row" predicate cannot pass them.

| # | Input | Expected | Invariant |
|---|---|---|---|
| T1 | ISF hooks | 2 hooks; line 1 conditions `[{ bystandersInVictoryAtLeast, '3' }]`, effects `[{ attack-per-count, 1, distinct-hero-classes-played-this-turn }]` | no flat attack |
| T2 | ISF played after a Tech card, Covert in hand, 3 Bystanders | attack 3, recruit 3 | hand + play classes |
| T3 | T2 with 2 Bystanders | attack 0, recruit 3 | Savior gate fails; line 0 ungated |
| T4 | Star-Spangled hooks | line 1 `[{ recruit-per-count, 2, distinct-… }]` under the Savior condition | no flat recruit |
| T5 | Star-Spangled after a Ranged card, Tech + Instinct in hand, 4 Bystanders | recruit 8, attack 8 | 2 per class × 4 |
| T6 | Star-Spangled after a Ranged card, 1 Bystander | recruit 0, attack 4 | Savior gate fails |
| T7 | Paramilitary hooks | 1 hook, effects `[{ attack-per-count, 1, shield-heroes-cost-one-plus-played-this-turn }]` | no flat attack |
| T8 | Paramilitary after Agent, Trooper, Agent | attack 0 | starters cost 0 |
| T9 | Paramilitary alone | attack 0 | the `requiresTeam` gate fails alone |
| T10 | Paramilitary after Agent, Officer, another Paramilitary Ops copy, a cost-5 Avenger, Trooper | attack 2 | Officer + other copy only; self present and costed → proves self-exclusion (2, not 3) |
| T11 | resolver: Officer, Agent, Trooper, a cost-2 S.H.I.E.L.D. Hero, a cost-5 Avenger, self | new source 2; `shield-heroes-played-this-turn` 4 | contrast with the unfiltered sibling; self present and costed → proves self-exclusion |
| T12 | resolver: only starters + self | 0 | |
| T13 | explain: Officer, Agent, a cost-2 S.H.I.E.L.D. Hero `nick-fury#0`, self | `[pile-shield-officer, nick-fury#0]`, equal to the resolver count | count === length |
| T14 | drift pin | 17 values in order, last the new slug | RUNTIME keyset assertion |

`countSourceLabel.test.ts` (unchanged) covers the label through its `HERO_COUNT_SOURCES` loop.

## Vision Alignment

**Vision clauses touched:** §1 (rules authenticity: the card grants what it prints), §10 (content as data: marker-map input), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (rules fidelity only, no paid or persuasive surface).

**Determinism preservation:**
- The resolver is a pure read of `G`. No new randomness.
- The hooks change only for three ca75 lines. `finalStateHash` / `PRE_WP080_HASH` fixtures play no ca75 hero (the scaffold's full engine run is the evidence; a moved hash is a STOP).
- **Replay compat:** a stored match replays from its bgio `initialState`, which holds its setup-time hooks, so a pre-deploy match keeps the flat grants and replays identically (corrected at govern-close; the drafted text said the opposite). Only matches created after the deploy carry the per-count grants. No stored-match migration.
- The fixed-seed runtime-observed sweep shifts by one observation (§Scaffold). It is a coverage feed, not a hash gate, and it is regenerated in this packet.

## Funding Surface Gate

§20 **N/A**: engine and card data only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Grants.** T1-T10 pass on the regenerated `data/cards/ca75.json`.
2. **Source.** T11-T14 pass; `countSourceLabel.test.ts` passes.
3. **Revert proof.** With the baseline `data/cards/ca75.json` swapped in temporarily, T1, T2, T4, T5, T7, T8 and T10 fail.
4. **Card data.** `apply-hero-ability-markers.mjs` reports exactly 3 lines updated; `pnpm cards:check` and `pnpm cards:count-markers:check` exit 0.
5. **Derived gates.** `pnpm ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check` and `sim:coverage --check` exit 0 on the committed tree.
6. **Dashboard.** After `pnpm --filter @legendary-arena/dashboard run prebuild:coverage`, `pnpm --filter @legendary-arena/dashboard test:coverage` passes. Only the `totalObs` literal changes; its delta must equal the feed's `summary.totalObservations` delta, unless a baseline floor holds (then name the mechanic). The `resolvedObs` and `percentResolved` assertions stay byte-unchanged; if either would move, or the feed's `distinctMechanics` ≠ 79 or `hollowEffectsDropped` ≠ 0, STOP (a mechanic changed status, out of scope). Then `pnpm --filter @legendary-arena/dashboard typecheck` exits 0 (when `useInPlayCoverage.test.ts` changed).
7. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail.
8. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass. Expected delta: +13 tests / +4 suites (the new file 10 tests in 3 suites, the resolver file 3 tests in 1 suite; drafting scaffold 5649 → 5662). A different delta is explained, never tuned.
3. The AC 3 revert proof: `git show origin/main:data/cards/ca75.json > data/cards/ca75.json` (the pre-change baseline), run `node --import tsx --test packages/game-engine/src/hero/ca75CountScaledHeroLines.test.ts` from `packages/game-engine`, observe T1 / T2 / T4 / T5 / T7 / T8 / T10 fail, re-run `node scripts/convert-cards/apply-hero-ability-markers.mjs`, and confirm `git diff --stat -- data/cards/ca75.json` matches the pre-proof state.
4. Regen chain, in order, each step only if its `:check` reports stale after the prior step: `node scripts/convert-cards/apply-hero-ability-markers.mjs` → `pnpm -r build` → `pnpm ledger:heroes` → `pnpm effect-index` → `pnpm mechanics:metadata` → `pnpm sim:runtime-observed`. Then run `pnpm cards:check`, `pnpm cards:count-markers:check`, `pnpm ledger:heroes:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check` → each exits 0. Whenever the feed moved: `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` (always, before the dashboard test), then re-pin per AC 6.
5. Run the dashboard trio in AC 6.
6. `pnpm -r --no-bail test` → 0 fail.
7. `git status --porcelain` (tracked and untracked) ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] Every Acceptance Criterion passes and the diff is allowlist-only.
- [ ] D-24757 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] Two-commit topology: `EC-862:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). On `play.legendary-arena.com`, after `/api/version` shows a gitSha that contains the merge, in a 2-player operator (debug) match with seat 1 a bot ally and the heroes Steve Rogers Director of S.H.I.E.L.D., Captain America (Falcon) and Agent X-13 in the loadout:
  - stage 3 Bystanders into your Victory Pile, then play International Strike Force with Heroes of 3+ classes across hand and play. The log's count-scaled attack line reads `+N` with `count N` (not a flat +1);
  - the same for Star-Spangled Hero's recruit line (`+2N`);
  - with 2 Bystanders, neither Savior line grants;
  - play Paramilitary Ops after only starters: the gate passes (starters are S.H.I.E.L.D.), so the log shows a count-scaled attack line with `count 0` (or no grant line), and Attack does not rise beyond the card's printed 2. Play it after an Officer and another costed S.H.I.E.L.D. Hero: `+2`, `count 2`.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24757 — ca75-count-scaled-hero-lines.** It locks:
- that a `[keyword:Savior]` line composes with an `attack-per-count` / `recruit-per-count` marker on one hook (the Savior condition gates the per-count grant), verified on the two ca75 lines; this closes the #2449 deferrals;
- the new `HeroCountSource` `shield-heroes-cost-one-plus-played-this-turn`: OTHER cards played this turn that count as S.H.I.E.L.D. Heroes (`cardCountsAsTeamMember`, tokens included) with `cardStats` cost ≥ 1 (`?? 0` for a card with no row), so the Officer (cost 3) counts and the Agent / Trooper starters (cost 0) don't;
- that Paramilitary Ops keeps its `requiresTeam: shield` gate (outcome-neutral, the Legendary Commander precedent);
- the replay-compat note and the runtime-observed / dashboard re-pin;
- the co2e Stealth Assault Squad gate defect as a recorded follow-up.

---

## Gate Record

**Pre-flight (01.4) (independent subagent): NOT READY → READY TO EXECUTE after one text fix (no re-run needed, per the reviewer).** Verified: every Assumes anchor at the cited lines; the three ca75 lines unmarked as quoted; the Savior arm is condition-only and Steps 2d / 2d′ emit the per-count keyword with no Savior special case, so no parser change; Paramilitary's retained `requiresTeam` gate is outcome-neutral (`countOtherInPlayMatchingCondition`, `heroConditions.evaluate.ts` ~L455-490, is a strict superset predicate); the only switches over `HeroCountSource` are the three in scope (the ledger, effect-index, mechanics metadata, arena-client and reference docs hold no source list); dependencies all `[x]`; no new `G` field and the scaffold's full run was 0 fail.
- **PS-1 (fixed):** Assumes 4 said the Agent / Trooper have no `cardStats` row; they have `cost: 0` rows (`buildInitialGameState.ts` L542-543). Corrected in Assumes 4, the Test Contract (starter `{ cost: 0 }` fixture rows) and the EC comment requirement.
- **RS-1..RS-6 (fixed):** the +13 / +4 test delta locked; the revert-proof ref is `origin/main`; `git status --porcelain` for the allowlist check; Vision §1 added; this record filled; the Paramilitary-after-starters live-verify wording.

**Copilot (01.7) (independent subagent): RISK (HOLD), five scope-neutral fixes, all applied; pre-flight stands.** Clean: layer boundary, determinism, ordering, mutation, persistence, lockstep, the drift pin, the replay note; the `EC-862:` commit is guard-exempt (engine source); the AC 3 revert proof runs from `src` under tsx, so a stale `dist` can't fake it.
1. FM 11 / 30: the scaffold patch contradicts the corrected Assumes 4 → §Scaffold now says it is evidence only; re-author from Locked Values; EC Before Starting asserts the cost-0 rows.
2. FM 11: the dashboard re-pin had no independent oracle → only the `totalObs` literal moves, by the feed's `summary.totalObservations` delta; `resolvedObs` / `percentResolved` byte-unchanged, else STOP (AC 6, EC guardrail).
3. FM 11: the scaffold deltas could read as targets → stated as expectations measured at `2b6d052e`; the observed delta governs.
4. FM 11 / 26: T9 is decided by the `requiresTeam` gate, not self-exclusion → T9 relabeled; T10 / T11 carry the self-exclusion proof.
5. FM 12 / 30: dashboard local false-green → Verification 4 runs `prebuild:coverage` before the re-pin.

**Lint (00.3) (independent subagent): FAIL → PASS after six text fixes, applied** (see §Lint Gate Self-Review). Run in parallel with pre-flight; its fixes are wording within listed files, made before the copilot round, which audited the fixed text.

**Final gate state:** pre-flight READY TO EXECUTE · copilot RISK (every concern fixed and recorded above) · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 sections present and non-empty; 8 ACs; 5 Out-of-Scope items |
| §2 | PASS — full files, no diffs, ESM / Node 22, 00.6, packet-specific rules, session protocol; separate Locked Values |
| §3 | PASS — 9 Assumes items with verified anchors, a baseline, a BLOCKED clause (Assumes 4 corrected) |
| §4 | PASS — 00.2 §5, ARCHITECTURE #1 and Layer Boundary, DECISIONS scan list, the rules-v23 term of art, memory refs |
| §5 | PASS — every referenced file listed; derived entries tagged "regenerated"; size justified |
| §6 | PASS — `bystandersInVictoryAtLeast`, `cardStats`, `playerZones.inPlay`, `CardExtId` used as defined |
| §7 | PASS — no new dependencies |
| §8 | PASS — the resolver is a pure read of `G`; markers go through the setup-time pipeline |
| §9 | PASS — pnpm / node / git commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — node:test, local data only, no boardgame.io, network or DB |
| §13 | PASS — the revert-proof ref is `origin/main`; every `:check` named explicitly (fixed) |
| §14 | PASS — 8 binary ACs tied to T-numbers and named commands |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes, allowlist-only diff; live-verify on `play.legendary-arena.com` with log evidence |
| §16 | PASS — `for…of`, full names, JSDoc; counter + collector are two copies (no abstraction owed) |
| §17 | PASS — §1 / §10 / §8 / §22 / §23 / §24 / NG-1 (fixed); conflict line; determinism and replay lines |
| §18 | N/A — no forbidden-token grep |
| §19 | N/A — commit-time discipline |
| §20 | PASS — N/A with reason (engine and card data only) |
| §21 | PASS — N/A with reason (no endpoint or `apps/server/src/**` surface) |

EC-862 vs EC-TEMPLATE: FAIL → PASS after three fixes: Locked Values copied verbatim from the WP; the regen chain listed in order in After Completing; the dashboard typecheck added to Before Starting / After Completing. Section order matches; well under the 100-line ceiling. Advisories applied: A1 (T13 names `nick-fury#0`), A2 (the marker entry shape), A3 (the size line and "regenerated" tags), A4 (`playedCardIdsThisTurn` import and the self-inclusive distinct-class source in Assumes 3).

**Verdict:** PASS.
