# WP-740 — Venompool "Play to the Crowd": Digest 7 per-two-Bystanders + Indigestion rescue 2 + double-Venomverse "both" (Engine + Data)

**Status:** Ready
**Primary Layer:** Game Engine / Implementation + Card Data
**User-Visible Surface:** `play.legendary-arena.com`
**Dependencies:** WP-735 / D-24555 ✅ (the fused `digest-indigestion` keyword + `DIGEST_INDIGESTION_CARDS` allowlist this WP extends; it explicitly deferred this card), WP-247 / D-24016 ✅ (`attack-per-count` + the `victory-bystanders` count source), WP-677 / D-24493 ✅ (the `perEach` "for each N" divisor on the per-count executors), WP-215 / D-21501 + WP-216 / D-21601 ✅ (`rescue` + the `[keyword:rescue:N]` marker)
**Lane:** Standard (two-session). NOT lightweight-lane eligible: extends a contract file (`heroAbility.types.ts`, one optional descriptor field) and widens a parser pattern (`COUNT_SCALED_PATTERN`) — "any ambiguity resolves against eligibility" (01.0a).

> Baseline: `origin/main` at commit `93cfc858` + the `SPEC: reserve WP-740 / EC-777 / D-24562` ledger commit (`3d5b34e3`, PR #2267). Renumbered from WP-739 / EC-776 / D-24561: #2264 (client-ev-affordance) landed on those numbers first. The drafting scaffold and gates ran on `5b608fc2`; the intervening main commits (#2263–#2266) touch no file in this WP's allowlist.

---

## Goal

After this session, playing **Play to the Crowd** (`vnom/venompool/play-to-the-crowd`) resolves its printed ability faithfully through the WP-735 fused `digest-indigestion` hook:

- **Digest 7:** if the player's Victory Pile holds at least 7 cards (any type, read-only), they get **+1 Attack for each two Bystanders** in their Victory Pile (floor).
- **Indigestion:** otherwise, they **rescue two Bystanders**.
- **Both:** when **two other** Venomverse Heroes were played this turn (`[team:venomverse][team:venomverse]`), they do **both in order**: the Digest grant is computed first, then the two Bystanders are rescued.

The stray flat `+1 Attack` the card grants today is removed.

---

## User-Visible Impact

Live bug (Jeff, Dr. Doom / The Legacy Virus, 2p, turn 30; `doom-LegacyVirus-LOG-2p.txt` + `-DIAGNOSTICS-2p.lagn.json`):

```
30.2.6 Player 1 played Play to the Crowd (…#0) (+4 attack) — Digest 7: …
[applied] 30.2.7 Player 1 gained +1 attack from Play to the Crowd (…#0).
[blocked] 30.2.8 Unhandled effect observed: … declared a "indigestion" mechanic at onPlay, but no executable handler was reached (parse-unrecognized).
```

**What should have fired (reconstructed from the log + the end-of-game `uiStateSnapshot.players[1].victoryCards`):** at 30.2.6, Player 1's Victory Pile held **10 cards, 4 of them Bystanders**: 3 from Digest That Chimichanga rescues (7.2.2, 7.2.5, 11.2.5), 6 fought villains/henchmen, and 1 Bystander rescued at 30.2.5. Nothing was removed. Only **one** other Venomverse Hero had been played that turn (Digest That Chimichanga, 30.2.3; Determination, 30.2.1, is X-Men). So the **Digest branch alone** was correct: 10 ≥ 7 → floor(4 / 2) = **+2 Attack**, and no rescue. The engine instead applied a flat **+1** (effect trace `{"effect":"attack","params":{"magnitude":1}}`), because the Digest line's `+1[icon:attack]` parsed as a flat grant, and it logged the Indigestion clause as a hollow.

After this WP the same play grants +2 Attack. With fewer than 7 Victory-Pile cards it rescues two Bystanders. With two other Venomverse Heroes played, it does both.

---

## Assumes

- **WP-735 / D-24555 landed** — `DIGEST_INDIGESTION_CARDS` (`setup/heroAbility.setup.ts` ~L507, 4 entries) gates `buildDigestIndigestionFusion` (~L2897), which is called inside `buildHeroAbilityHooks` (~L3092) with the canonical `{setAbbr}/{heroSlug}/{cardSlug}` key and consumes the Digest / Indigestion / "Instead … both" lines. The fusion builds `bothCondition` from **only** `parseAbilityText(bothLine).conditions[0]` (~L2939). Its own comment says the doubled `[team:X][team:X]` form "belongs only to deferred cards". `heroEffectDigestIndigestion` (`hero/heroEffects.execute.ts` ~L4852) runs Digest then Indigestion when `evaluateAllConditions(G, playerID, [bothCondition], cardId)` holds; otherwise it runs exactly one branch by `victory.length >= digestThreshold`.
- **The `victory-bystanders` count source exists** (D-24016; `rules/heroCountSource.ts` L37/L67; `hero/heroCountSource.resolve.ts` ~L381 `countVictoryBystanders`). It counts the player's Victory-Pile Bystanders (both ext_id forms). **No new count source is needed.**
- **`perEach` exists on the descriptor and the executor** (D-24493; `heroAbility.types.ts` L121). `heroEffectAttackPerCount` (`heroEffects.execute.ts` ~L2101) grants `magnitude × floor(count / perEach)`, with absent/≤0 treated as 1.
- **The standalone per-count parser does NOT accept the 4-segment form (observed at draft).** `COUNT_SCALED_PATTERN` (`setup/heroAbility.setup.ts` L192) is `/\[keyword:attack-per-count:([a-z][a-z-]*):(\d+)\]/g`. Only the count-scaled-choose pre-pass (`ATTACK_PER_COUNT_MARKER_PATTERN` ~L2279) reads the optional `:<perEach>` segment, which is why shld's `[keyword:attack-per-count:shield-levels:1:2]` works only inside a coalesced "Choose one:". The draft scaffold showed that appending `[keyword:attack-per-count:victory-bystanders:1:2]` to a standalone line still yields `{type:'attack', magnitude:1}`: the marker is ignored and the printed icon is kept.
- **Doubled team tokens parse as two identical conditions (observed at draft).** `[team:venomverse][team:venomverse]` → `[{type:'requiresTeam',value:'venomverse'}, {type:'requiresTeam',value:'venomverse'}]`. `evaluateCondition` (`hero/heroConditions.evaluate.ts` ~L73) returns true when ANY one other in-play card matches, so two identical conditions are satisfied by ONE other Venomverse Hero. The rulebook disagrees: `docs/legendary-universal-rules-v23.md` §"'Critical Hit' Superpower Abilities" (~L683) says a two-icon Superpower needs cards with both icons played "earlier in your turn" (two other cards). In the live turn-30 case, allowlisting the card without a count-aware gate would **wrongly fire "both"** (one other Venomverse Hero was played).
- **The marker apply pipeline accepts both tokens as-is.** `VALID_TOKEN_PATTERN` (`scripts/convert-cards/apply-hero-ability-markers.mjs` L106) already allows `attack-per-count:<source>:N(:M)?` and `rescue:N`. No apply-script change is needed.
- **Card text** (`data/cards/vnom.json`, `venompool/play-to-the-crowd`, Rare, cost 7, attack `4+`, hc strength): idx0 `[keyword:Digest 7]: You get +1[icon:attack] for each two Bystanders in your Victory Pile.` · idx1 `[keyword:Indigestion]: “Rescue“ two Bystanders.` · idx2 `[team:venomverse][team:venomverse]: Instead, do both (in order).` Its single `_deferred` row (idx1, reason "D-21602 — keyword timing prefix…") is in `scripts/convert-cards/inputs/hero-ability-markers.json`.
- `pnpm -r build` exits 0. On baseline, the engine suite plus `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` are all green.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- **Why a WP and not a one-line allowlist add.** The draft scaffold found three coupled gaps: (1) the standalone per-count parser drops the `:2` divisor; (2) the fusion reads only the first of the two doubled `[team:venomverse]` conditions, and the evaluator would accept one other Venomverse Hero; (3) the WP-735 negative fusion test uses this very card as its "stays hollow" example. None can be fixed alone without shipping a wrong result: a flat `+1` per Bystander, or a "both" that fires on one Venomverse Hero.
- **Draft-time scaffold (observed, then reverted).** A prototype of the Scope (In) engine changes plus the two marker rows gave: the fused hook = ONE `digest-indigestion` hook `{digestThreshold:7, digestEffects:[{type:'attack-per-count',magnitude:1,countSource:'victory-bystanders',perEach:2}], indigestionEffects:[{type:'rescue',magnitude:2}], bothCondition:{type:'requiresTeam',value:'venomverse'}, bothConditionCount:2}` with no leftover flat-attack hook and no unresolved marker. The engine suite was **4097 tests, 4096 pass, 1 fail**, and the only failure was the WP-735 negative test that names play-to-the-crowd (retargeted in Scope). All `finalStateHash` / sentinel pins held. Apply script: `Updated: 2 lines`, re-run `0`. `cards:check`, `effect-index:check`, `mechanics:metadata:check`, and `sim:runtime-observed:check` passed (play-to-the-crowd is absent from `runtime-observed-hollows.json`). Those checks ran BEFORE the ledger regen, so the ordered regen may still move the two metadata files. `ledger:heroes` regenerated two venompool rows (`attack-per-count` + `rescue` gain `play-to-the-crowd`). `sim:coverage --check` exited 0 with a warn-only `NEW unsupported mechanic: attack-per-count:victory-bystanders:1`: the coverage script's `normalizeMechanicToken` strips only ONE trailing `:N`, the same quirk behind the baselined `attack-per-count:shield-levels:1`. It is informational, not a gate failure.
- **The "in order" reading (primary source = the printed card).** `Instead, do both (in order).` → run the Digest branch, then the Indigestion branch. The Digest grant counts Victory-Pile Bystanders **before** the two rescues, so the rescued Bystanders do not feed that play's grant. The handler already dispatches `digestEffects` then `indigestionEffects` (D-24555 lock 4). This WP pins the ordering with a test. As in D-24555, "Instead … both" overrides the Digest 7 gate: when two other Venomverse Heroes were played, both branches run regardless of Victory-Pile size.
- **Why a count field and not a global doubled-icon fix.** The doubled-icon under-gate is repo-wide (~95 printed `[hc:X][hc:X]` / `[team:X][team:X]` Superpower lines). Fixing it globally re-gates many shipped cards and belongs in its own WP with its own sweep. This WP carries the count **only** inside the `digest-indigestion` descriptor (`bothConditionCount`) so it cannot change any other card. The global gap is recorded as an out-of-scope follow-up.
- Read: `DECISIONS.md` D-24555 (the fusion + allowlist this extends; §5 names this card's deferral), D-24016 (`victory-bystanders`), D-24493 (`perEach`); `setup/heroAbility.setup.ts` L186-L206 (per-count patterns), Step 2d ~L1359-L1382, the effect build ~L1786-L1794, `buildDigestIndigestionFusion` ~L2884-L2961; `hero/heroConditions.evaluate.ts` `evaluateCondition` ~L40-L90 + `evaluateAllConditions` ~L347; `hero/heroEffects.execute.ts` `heroEffectDigestIndigestion` ~L4836-L4895 + `heroEffectAttackPerCount` ~L2080-L2110.
- User memory: `reference_hero_ability_marker_curated_map` (markers come from the curated map), `reference_sim_coverage_baseline_gate_distinct`, `reference_hashed_g_field_dual_repin`, `reference_inplay_totalobs_pin_stale_on_feed_regen` (only bites if `runtime-observed-hollows.json` changes; the scaffold showed it does not).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets, no "show only the changed section."
- ESM only, Node v22+, `node:`-prefixed built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English words, a `// why:` on every non-obvious constant / choice, no `.reduce()` in effect application, one screen per function, JSDoc on every function.

**Packet-specific:**
- Effects never throw. `G` stays JSON-serializable: `bothConditionCount` is a plain number on a hook in the JSON-serialized `G.heroAbilityHooks` (D-24095). Zones store `CardExtId` strings only. Digest stays a READ-ONLY Victory-Pile count.
- **Parser widening is additive.** `COUNT_SCALED_PATTERN` gains an OPTIONAL 4th `(?::(\d+))?` segment. A 3-segment marker must parse byte-identically to today, with no `perEach` key emitted (omit-when-absent). A 4-segment marker sets `perEach`. The count-scaled-choose suppression (`!processedAsCountScaledChoose`) is unchanged, so shld's choose-one lines still emit only the `count-scaled-choose` effect.
- **Count-aware "both" is scoped to `digest-indigestion`.** `bothConditionCount` is read ONLY by `heroEffectDigestIndigestion`. `evaluateCondition` / `evaluateAllConditions` and every other card's gating stay byte-unchanged. Absent or `1` → today's `evaluateAllConditions` path (the Core-4 are unchanged). `>1` → count distinct OTHER in-play cards matching the condition (self-excluded, via the same `cardCountsAsTeamMember` / `cardHasClassWhenPlayed` membership the evaluator uses) and require `>= bothConditionCount`.
- **Fusion derives the count from the print.** Set `bothConditionCount` to the number of conditions on the "both" line ONLY when there are > 1 AND EVERY condition equals `conditions[0]` (same `type` + `value`). Otherwise leave it unset: single-condition Core-4 hooks stay byte-identical (omit-when-absent), and a mixed line such as `[hc:X][hc:Y]` or `[hc:X][hc:X][hc:Y]` is never counted (D-24562 lock 5).
- **Allowlist-gated.** Add exactly `vnom/venompool/play-to-the-crowd` to `DIGEST_INDIGESTION_CARDS`. `hungry-for-action`, `insatiable-hunger`, and the Excessive Violence exclusions stay deferred.
- Marker edits touch only `abilities[i]` text, via the curated map. The printed display tokens stay as-is. No client / `UIState` / pending-choice change.

**Session protocol:** if the executor finds the Victory-Pile Bystander count, the `perEach` floor, or the doubled-Venomverse count cannot be expressed through the shipped executors plus the one descriptor field, STOP and surface it. Do not force-fit.

**Locked contract values:** see `## Contract`.

---

## Scope (In)

- `rules/heroAbility.types.ts` — one optional field `bothConditionCount?: number` on `HeroEffectDescriptor` (with a `// why:` D-24562 comment).
- `setup/heroAbility.setup.ts`:
  - `COUNT_SCALED_PATTERN` gains the optional `:<perEach>` segment. Step 2d records it, and the `attack-per-count` effect build attaches `perEach` only when present.
  - `DIGEST_INDIGESTION_CARDS` gains `vnom/venompool/play-to-the-crowd`, and its `// why:` comment is updated (the deferred list shrinks by one).
  - `buildDigestIndigestionFusion` derives `bothConditionCount` from the doubled-identical conditions, and its stale "double form belongs only to deferred cards" comment is corrected.
- `hero/heroConditions.evaluate.ts` — new exported pure helper `countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId): number` (heroClassMatch / requiresTeam; self-excluded; 0 for other types, missing zones, or missing `cardTraits`).
- `hero/heroEffects.execute.ts` — `heroEffectDigestIndigestion`'s both-select uses the helper when `bothConditionCount > 1`, and `evaluateAllConditions` otherwise.
- Tests:
  - `rules/heroAbility.setup.test.ts`:
    - Retarget the WP-735 "does NOT fuse a non-allowlisted Digest card" test to `vnom/venom/insatiable-hunger` (its real 3-line text; `makeHeroRegistry('vnom','venom',…)` / `digestConfig('venom')`), keeping both assertions byte-identical. On baseline that card yields `unresolvedMarkers:['indigestion']`. `hungry-for-action` is NOT usable: it has no Indigestion line and builds no unresolved marker.
    - Add a play-to-the-crowd fusion test: exact fused shape, and no stray flat attack.
    - Add a standalone 4-segment per-count parse test, plus a 3-segment no-`perEach` regression test.
  - `hero/heroEffects.execute.test.ts` — play-to-the-crowd branch tests (AC 3–6).
  - `hero/heroConditions.evaluate.test.ts` — helper tests.
- `scripts/convert-cards/inputs/hero-ability-markers.json`:
  - Add 2 net-new apply rows: idx0 `[keyword:attack-per-count:victory-bystanders:1:2]` and idx1 `[keyword:rescue:2]`.
  - Remove the single play-to-the-crowd `_deferred` row (idx1).
- Regenerate, in this order: `data/cards/vnom.json` (apply script) → `pnpm ledger:heroes` → `pnpm effect-index` → `pnpm mechanics:metadata` → the six `:check` commands. Commit whatever the regen produces. The effect-index and mechanics builders read the hero ledger; WP-735 regenerated both. `runtime-observed-hollows.json` is regenerated only if its check fails; the scaffold showed it unchanged.

## Out of Scope

- **The repo-wide doubled-icon ("Critical Hit") under-gate.** ~95 `[hc:X][hc:X]` / `[team:X][team:X]` Superpower lines on other cards keep today's any-one-other evaluation. This is a separate follow-up WP; `evaluateCondition` / `evaluateAllConditions` are not touched.
- `vnom/venom-rocket/hungry-for-action` and `vnom/venom/insatiable-hunger` stay deferred (insatiable-hunger as a parse-unrecognized hollow; hungry-for-action builds no marker at all — see 01.4 RS-5), and the Excessive Violence exclusions are unchanged.
- The `sim:coverage` normalizer's single-`:N` strip (the warn-only mislabel). No coverage-script change and no baseline update unless `--check` exits non-zero.
- The separately observed Impossible Trick Shot "rescue three Bystanders on defeat" non-fire in the same match log (turns 19/26/28). This is its own bug report.
- No new `HeroKeyword`, no new count source, no new G field, no `UIState` / client / pending-choice / move change, no scoring / PAR / RNG surface.

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified** — `bothConditionCount?: number`
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `COUNT_SCALED_PATTERN` 4th segment + Step 2d `perEach` + effect build; allowlist +1; fusion `bothConditionCount`
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — `countOtherInPlayMatchingCondition`
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — count-aware both-select + import + the handler JSDoc `@param effect` shape gains `bothConditionCount?`
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified (comment-only)** — the `digest-indigestion` descriptor-shape comment (~L89) gains `bothConditionCount?`
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — retarget negative test; fusion + parse tests
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — branch tests
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified** — helper tests
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 2 apply rows added, 1 `_deferred` row removed
- `data/cards/vnom.json` — **modified (regenerated)** — the 2 appended markers
- `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv` — **modified (regenerated)**
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json` — **expected (regenerated)**; commit whatever the ordered regen produces (they read the hero ledger)
- (conditional, only if its `:check` fails after regen) `docs/ai/coverage/runtime-observed-hollows.json` (+ the `useInPlayCoverage.test.ts` totalObs pin **only** if that feed moves), `scripts/coverage/hero-effect-coverage.baseline.json`
- Governance close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24562 Active), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` (+ `roadmap:counts:write` output)

No `finalStateHash` re-pin is expected. The card is `vnom` (non-core), no committed sentinel / PRE_WP080 replay plays it, and there is no new G field. The draft scaffold ran the full engine suite with every hash pin green. VERIFY at execution. If a pin moves, dual re-pin honestly per `reference_hashed_g_field_dual_repin`.

---

## Contract

- **Descriptor:** `HeroEffectDescriptor.bothConditionCount?: number`. For a `digest-indigestion` effect, it is the number of OTHER in-play cards that must satisfy `bothCondition`. Absent ≡ 1 (today's behavior). It is set by the fusion only when the "both" line prints ≥ 2 conditions, all identical to the first. Other keywords ignore it.
- **Helper:** `countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId): number`.
  - It loops over `G.playerZones[playerID].inPlay` in `for…of` order and skips `triggeringCardId`.
  - It counts `requiresTeam` via `cardCountsAsTeamMember` and `heroClassMatch` via `cardHasClassWhenPlayed`.
  - It returns 0 for any other condition type, a missing player zone, or a missing `G.cardTraits`. The `cardTraits` guard comes BEFORE the loop, because `cardHasClassWhenPlayed` dereferences `G.cardTraits[cardId]` unguarded.
  - It deliberately duplicates the module-private `countTeamCardsPlayedThisTurn` / `countHeroClassCardsPlayedThisTurn` in `heroCountSource.resolve.ts` (duplicate-first, 00.6 Rule 1); the `// why:` says so.
  - It is pure: no mutation, never throws.
- **Handler both-select:**
  ```
  runsBoth = bothCondition present && (
    bothConditionCount > 1
      ? countOtherInPlayMatchingCondition(G, playerID, bothCondition, cardId) >= bothConditionCount
      : evaluateAllConditions(G, playerID, [bothCondition], cardId)
  )
  ```
  All other D-24555 behavior is unchanged: the safe-skip, the read-only `victory.length`, mutual exclusivity, and Digest-then-Indigestion order.
- **Parser:**
  - `COUNT_SCALED_PATTERN = /\[keyword:attack-per-count:([a-z][a-z-]*):(\d+)(?::(\d+))?\]/g`.
  - A match with group 3 sets `perEach = parseInt(group3)` on the emitted `attack-per-count` effect.
  - A match without group 3 emits the effect with NO `perEach` key.
  - Only `attack-per-count` changes; the recruit and kidnap siblings are untouched.
- **Card (allowlisted key `vnom/venompool/play-to-the-crowd`):**

| Field | Value |
|---|---|
| `digestThreshold` | `7` |
| `digestEffects` | `[{ type: 'attack-per-count', magnitude: 1, countSource: 'victory-bystanders', perEach: 2 }]` (idx0 + `[keyword:attack-per-count:victory-bystanders:1:2]`) |
| `indigestionEffects` | `[{ type: 'rescue', magnitude: 2 }]` (idx1 + `[keyword:rescue:2]`) |
| `bothCondition` | `{ type: 'requiresTeam', value: 'venomverse' }` (idx2) |
| `bothConditionCount` | `2` |

### D-24562 (reserved; lands Active in `DECISIONS.md` at execution)

D-24562 locks five things (`heroAbility.types.ts` is a contract file):

1. **The field.** `HeroEffectDescriptor.bothConditionCount?: number` is read ONLY by `digest-indigestion`. Absent ≡ 1. The fusion sets it only when the "both" line prints ≥ 2 conditions, all identical to the first.
2. **The helper.** `countOtherInPlayMatchingCondition` is the shared counting primitive. It self-excludes by exact instance id and uses the same membership helpers as `evaluateCondition`.
3. **The parser.** `COUNT_SCALED_PATTERN` gains an optional 4th `perEach` segment, attack-only, omit-when-absent.
4. **The future path.** A later repo-wide doubled-icon ("Critical Hit") WP builds on the same helper. The fusion collapses duplicate conditions to ONE `bothCondition` plus a count, and the handler passes a single-condition array. So a duplicate-aware `evaluateAllConditions` cannot double-gate this card. That WP may keep `bothConditionCount` as the digest-scoped representation, or retire it in favor of its own duplicate-aware call. Neither choice needs a data migration: the field is setup-derived hook data, never persisted.
5. **The scope limit.** A mixed-condition "both" line (e.g. `[hc:X][hc:Y]`) is out of scope. The fusion leaves `bothConditionCount` unset unless EVERY condition on the line equals `conditions[0]`, and allowlisting such a card needs its own WP.

---

## Acceptance Criteria

1. `buildHeroAbilityHooks` on the real play-to-the-crowd text (with the 2 markers) yields exactly ONE hook for the card: `keywords: ['digest-indigestion']`, the effect deep-equals the Contract table, and there is no `attack` hook and no `unresolvedMarkers` from any of the three lines. A fusion unit test on a synthetic mixed "both" line (`[hc:strength][team:venomverse]`) asserts `bothConditionCount` stays unset (D-24562 lock 5).
2. A standalone line carrying `[keyword:attack-per-count:victory-bystanders:1:2]` parses to `{type:'attack-per-count', magnitude:1, countSource:'victory-bystanders', perEach:2}`. The core 3-segment `[keyword:attack-per-count:victory-bystanders:1]` still parses to an effect with NO `perEach` key. shld's choose-one lines still emit only `count-scaled-choose`.
3. **Digest branch:** Victory Pile of 10 cards including 4 Bystanders, and no other Venomverse Hero in play → +2 Attack, no Bystander rescued, Victory Pile byte-identical (the turn-30 case). With 5 Bystanders → +2 (floor). With 1 Bystander → +0.
4. **Indigestion branch:** Victory Pile of 6 cards → two Bystanders move from the Bystander stack to the Victory Pile and there is no attack grant. With 1 Bystander left in the stack, one is rescued, and nothing throws.
5. **Both, in order:** two OTHER Venomverse cards in play, and a Victory Pile of 5 cards (4 Bystanders + 1 villain; 5 < 7):
   - The Digest grant is computed first on the pre-rescue count: floor(4 / 2) = **+2**, not floor(6 / 2) = +3.
   - Then two Bystanders are rescued (pile Bystanders 4 → 6).
   - Both branches run even though the pile is below the Digest 7 threshold (the "Instead" override).
6. **Double-count gate:** exactly ONE other Venomverse card in play → "both" does NOT fire; the card resolves the single branch its Victory-Pile size selects (the turn-30 regression). The card itself does not count toward the two (self-exclusion). A second in-play copy of the same card (a different `#N` instance id) DOES count toward the two.
7. The Core-4 fused hooks are byte-identical to baseline, with no `bothConditionCount` key. Their existing D-24555 tests pass unchanged, except the one retargeted negative test, which now asserts `insatiable-hunger` stays hollow.
8. `countOtherInPlayMatchingCondition` has unit tests covering: team count, class count, self-exclusion, unsupported type → 0, missing zones → 0.
9. `data/cards/vnom.json` carries the two appended markers, and the `_deferred` row is gone. `apply-hero-ability-markers.mjs` is idempotent (re-run: 0 updates).
10. `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` all exit 0. The `attack-per-count:victory-bystanders:1` coverage WARN is acceptable (warn-only, the known normalizer quirk). The hero ledger lists `play-to-the-crowd` under venompool `attack-per-count` and `rescue` (`executable`).
11. The full `@legendary-arena/game-engine` suite is green, `pnpm -r build` exits 0, and `finalStateHash` is unchanged (or dual-re-pinned honestly with provenance).

---

## Verification Steps

1. `pnpm -r build` → 0; `pnpm --filter @legendary-arena/game-engine test` → all pass (baseline + the new tests).
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → `Updated: 2 lines`; re-run → `Updated: 0 lines`.
3. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → all exit 0.
4. `grep "play-to-the-crowd" docs/ai/coverage/hero-mechanic-ledger.csv` → the venompool `attack-per-count` and `rescue` rows.
5. `git diff --name-only` ⊆ `## Files Expected to Change`. Revert any CRLF-only `packages/lagn-spec/schemas/lagn-v1.json` churn from the build.

---

## Vision Alignment

**Vision clauses touched:** §1, §2, §10 (card data / content semantics), §8 / §22 (determinism).

**Conflict assertion:** No conflict. This WP makes an already-shipped card resolve its printed ability faithfully (Venomverse Digest/Indigestion, keywords-full; the rulebook's two-icon Superpower rule for the doubled Venomverse gate). It adds no content and changes no rule text.

**Non-Goal proximity check:** NG-1..7 not crossed. The branch is decided solely by game state, the mechanic is available to every player of the card, and there is no monetization or cosmetic surface.

**Determinism preservation:** Everything is a pure read of existing zone state (`victory`, `inPlay`, `cardTraits`) plus a `for…of` dispatch of already-parsed effects. It is `ctx`-free, adds no `Math.random` and no new persisted G field, and replays identically. The only G-visible change is the setup-built hook data for play-to-the-crowd (a `vnom` card no committed sentinel uses). The draft scaffold ran every hash pin green.

---

## Lint Gate Self-Review (00.3)

- **§1 structure:** all required sections present and non-empty; Out of Scope names the global doubled-icon gap, the two remaining Digest cards, the coverage normalizer, and the Trick Shot bug.
- **§2 constraints:** engine-wide block (full files, ESM/Node 22, 00.6) + packet-specific + session protocol + locked values; no contradiction with the body.
- **§3 assumes:** each prerequisite cites file + line and the observed draft-scaffold facts (parser gap, doubled-token parse).
- **§4 context:** cites D-24555 / D-24016 / D-24493, exact source ranges, the rulebook section, and memory refs; no vague "see the docs".
- **§5 files:** every file marked new/modified with a one-line change; conditional feeds gated on their `:check`.
- **§6 naming:** `abilities[]` / canonical `{setAbbr}/{heroSlug}/{cardSlug}` keys per `00.2`; the new names (`bothConditionCount`, `countOtherInPlayMatchingCondition`) are full English words.
- **§7 dependencies:** no new npm package; `node:test`.
- **§8 boundaries:** Game Engine + Card Data only. No server/DB/client. Effects never throw. G stays JSON-plain. The new helper is pure, with no boardgame.io import.
- **§9 Windows:** `pnpm` / `node` commands only.
- **§10 env:** N/A — no env vars.
- **§11 auth:** N/A — no auth surface.
- **§12 tests:** `node:test` + `node:assert`; deterministic; no network/DB; no `boardgame.io/testing`.
- **§13 verification:** exact commands with expected output.
- **§14 acceptance:** 11 binary criteria tied to named functions/files and the live turn-30 numbers.
- **§15 DoD:** STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap + scope check; User-Visible Surface + Impact present; D-24026 live-verify item present.
- **§16 code style:** single-purpose helper + JSDoc + `// why:`; no `.reduce()`; the parser change extends the existing pattern (no new abstraction).
- **§17 vision:** `## Vision Alignment` with clause numbers + determinism line.
- **§18 prose-vs-grep:** the grep step targets a permitted new data token (`play-to-the-crowd`), not a forbidden one.
- **§19 bridge staleness:** baseline SHA + reserve commit cited.
- **§20 funding:** N/A — no funding surface.
- **§21 API catalog:** N/A — no HTTP endpoint or `apps/server/src/**` function.

**Verdict:** all 21 sections PASS or justified N/A.

## Pre-flight (01.4)

Run as an independent gate subagent against live `src` on this branch (synced to `origin/main` `5b608fc2` + the reserve commit; renumbered afterwards, no source change). **Class:** Behavior / State Mutation (setup-built hook data + a handler branch; no move / phase / G field).

**Verified TRUE against source:**
- **Parser gap:** 3-segment `COUNT_SCALED_PATTERN` at `:192`. On baseline, a standalone `…:1:2` gives a flat `attack` 1. The 4th segment is read only by `ATTACK_PER_COUNT_MARKER_PATTERN` `:2279` in the pre-pass.
- **Widening is safe for existing data:** the only 4-segment markers in `data/cards` are `shld.json:63` + `:286`, both in coalesced choose-one groups that build one `count-scaled-choose` hook, so `processedAsCountScaledChoose` suppresses Step 2d. No 4-segment recruit or kidnap markers exist.
- **Doubled conditions:** the fusion reads only `conditions[0]` (`:2939`). Doubled `[team:venomverse]` parses to two identical `requiresTeam` conditions, and `evaluateCondition` (`:73-90`) accepts any one other card.
- **Count source + divisor:** `perEach` exists (`types :116-121`) and `heroEffectAttackPerCount` honors it (`:2077-2106`). `victory-bystanders` is at `heroCountSource.ts:37/67` and `resolve.ts:76`.
- **Handler order** (`:4852-4895`) runs Digest then Indigestion with the count resolved at dispatch, consistent with the D-24555 "Instead" override.
- **Rescue** (`:1462-1489`) takes `min(magnitude, stack)`, so it never throws.
- **Helpers** `cardCountsAsTeamMember` / `cardHasClassWhenPlayed` are exported and already imported by `heroConditions.evaluate.ts`. Instance ids carry `#N`.
- **Marker tooling:** `VALID_TOKEN_PATTERN` (`:106`) accepts both tokens. The `_deferred` row is at `hero-ability-markers.json:2146-2153`.
- **Lockstep:** no descriptor-key drift test and no other lockstep site. The client `isEngineOnlyKeyword` already hides colon tokens.
- **Coverage:** the `sim:coverage` WARN is warn-only (`:366-371`).
- **Hashes:** no hash fixture uses venompool.
- **Rulebook:** `legendary-universal-rules-v23.md:683-696` confirms the two-icon rule.
- **Dependencies** all Done; D-24562 reserved in `NUMBER-LEDGER.md` (renumbered from D-24561).
- **Size:** EC ≤100 lines.

**PS-1 (blocking, FIXED):** the negative-test retarget named `hungry-for-action`. That card has no Indigestion line and builds no `unresolvedMarkers`, so the test's second assertion could not hold without weakening it. The target is now `vnom/venom/insatiable-hunger` (real 3-line text; baseline yields `unresolvedMarkers:['indigestion']`), with both assertions byte-identical. Fixed in Scope (In), AC 7, and the EC Guardrail.

**RS-1 (addressed):** the drafting worktree's `dist` carried the reverted scaffold. It was rebuilt at draft, and the EC Before-Starting now requires `pnpm -r build` first.
**RS-2 (addressed):** `rules/heroKeywords.ts` ~L89 descriptor-shape comment and the handler JSDoc gain `bothConditionCount?` — added (comment-only) to both file lists.
**RS-3 (addressed):** AC 6 now pins that a second in-play copy (different `#N`) counts toward the two.
**RS-4 (addressed):** the helper returns 0 on `!G.cardTraits` BEFORE the loop (`cardHasClassWhenPlayed` dereferences it unguarded). The deliberate duplication of the private `heroCountSource.resolve.ts` counters is noted (duplicate-first).
**RS-5 (out of scope, noted):** `hungry-for-action` builds no unresolved marker, so it is invisible to parse-level hollow detection despite being called an "honest hollow" in D-24555. This is a separate ticket.
**RS-6 (noted):** Draft WP-716 rewords the count-scaled log line in `heroEffects.execute.ts` (~L2106). WP-740 does not touch that line, so there is no semantic conflict, but land them in sequence.

**Verdict: READY TO EXECUTE** (after the PS-1 fix; RS-1..4 applied).

## Copilot (01.7)

Run as an independent gate subagent (30-mode audit) against the WP + EC + pre-flight report.

**First pass: RISK / HOLD** on five modes, all scope-neutral and all fixed in place:
- **Modes 4 + 28:** D-24562's lock content and the upgrade path to a later global doubled-icon fix were not recorded. Added the `### D-24562` block (field / helper / parser / future path / mixed-condition scope limit), cited from the EC Locked Values.
- **Mode 12:** `effect-implementation-index.json` + `card-mechanics.json` read the hero ledger. They moved from conditional to expected-regenerated, with the locked order apply → `ledger:heroes` → `effect-index` → `mechanics:metadata` → checks.
- **Mode 14:** the fusion now counts only when EVERY condition on the "both" line equals `conditions[0]`. A mixed line stays unset, pinned by an AC 1 synthetic-mixed-line test.
- **Mode 30:** the WORK_INDEX row was synced (insatiable-hunger retarget; Ready status).

**Re-run: RISK** on one residual inconsistency: the Packet-specific fusion bullet still carried the old "identical to the first" rule. It was rewritten to the all-identical rule, alongside polish to the Contract / lock 1 wording, the EC_INDEX row file list, and the Context regen note.

**Final verdict: PASS.** All 30 modes resolve. No regression in separation, determinism, persistence, test integrity, or scope.

**Post-gate edit (renumber only):** after both gates passed, #2264 landed WP-739 / EC-776 / D-24561 on `main` first. This packet was mechanically renumbered to WP-740 / EC-777 / D-24562 (file names, self-references, the baseline line, and the index/mindmap rows). No scope, contract, locked value, or AC changed, so the gate verdicts carry over (01.0b §Parallel WP execution rule 3 renumber). `ledger:numbers:check`, `roadmap:counts:check`, and `workindex:rows:check` re-ran green.

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` ⊆ `## Files Expected to Change` (+ regenerated data/feeds).
- [ ] `docs/ai/STATUS.md` updated; D-24562 landed Active in `DECISIONS.md`; WORK_INDEX row checked; EC_INDEX Done; mindmap node `✅`; `roadmap:counts:check` 0.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] **D-24026 live-verify (post-merge, REQUIRED):** in a live match on `play.legendary-arena.com`, verified against the deployed `/api/version` gitSha:
  - Play to the Crowd with ≥ 7 Victory-Pile cards grants +1 Attack per two Bystanders there.
  - With < 7 it rescues two Bystanders.
  - After two other Venomverse Heroes it does both. One other Venomverse Hero is not enough.

  This is inherently post-deploy and is recorded as a follow-up STATUS-flip, not a merge blocker.
