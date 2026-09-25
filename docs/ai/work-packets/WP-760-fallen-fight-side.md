# WP-760 — The Fallen fight-side: Blood Frenzy, Atrocity's rescue, Patriarch's reveal-draw, Salomé's KO-from-discard (Game Engine + Card Data)

**Status:** Draft 2026-09-25 — **BLOCKED on WP-750** (client Fight gating must read the engine `fightCost` before any villain cost rises above its printed value). The packet is sequenced after WP-757, which shares the `mdns/fallen` marker block and the `mdns.json` regeneration.
**Primary Layer:** Game Engine / Implementation + Card Data (+ one Arena Client copy fix)
**Dependencies:**
- **WP-750 / D-24574** (reserved; client Fight gating reads `UICityCard.fightCost`)
- WP-757 / D-24587 (sequencing only)
- WP-214 (dynamic `N+` fight cost)
- WP-539 / D-24348 (Dark-Portal additive cost-term precedent)
- WP-693 / D-24510 (`PendingKoDiscardChoice` + `resolveKoDiscardChoice`)
- WP-447 / D-24267 (`scry-ko-own-deck`, the villain own-deck peek + reshuffle precedent)
- D-18506 (a Fight-timed `captureBystander` is awarded immediately = rescue)
- D-24285 (a reveal on an empty deck reshuffles the discard)
- D-24583 (a Wound on top reads cost 0)

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It changes the fight-cost authority (a scoring-adjacent competitive surface), adds two villain primitives and a new omit-when-empty `G` field.
**Arc:** the Zarathos arc's Fallen follow-up. Siblings: WP-757 (Haunt), WP-758 (Zarathos), WP-759 (client).

> Baseline: `origin/main` at `d09d0946` plus the WP-760 reserve commit (#2358). At execution, re-baseline on the commit that landed WP-750 and WP-757.

---

## Goal

The Fallen are always led by Zarathos, and are also selectable under other Masterminds. After WP-757 their Ambush Haunts work, but their fight-side text is still inert. The committed ledger reads Atrocity, Patriarch and Salomé as `unmarked`, and Blood Frenzy is untracked. After this session:

- **Blood Frenzy** (Metarchus, Salomé). The printed text is "+1 Attack for each different Victory Point value among the cards in your Victory Pile". The villain's fight cost gains a term equal to the number of distinct VP values among the cards in the **fighting player's** Victory Pile. The term is added inside the single fight-cost authority `resolveFightCost`, so the fight gate, bot legal moves and the City `fightCost` projection all move together.
- **Atrocity** "Fight: Rescue a Bystander." is marked with the existing `captureBystander` Fight marker. A Fight-timed capture is awarded immediately (D-18506), so no new code is needed.
- **Patriarch** "Fight: Reveal the top card of your deck. If it costs 3 or less, draw it." uses a new villain primitive, `reveal-top-draw-if-cost-lte:3`.
- **Salomé** "Fight: KO up to two cards from your discard pile." uses a new villain primitive, `ko-up-to-from-discard-current:2`. It parks the existing `PendingKoDiscardChoice` (`maxCount: 2`, `sourceCardId`). The resolve log names its real source instead of the hardcoded "(Maniacal Tyrant)", and the client prompt header becomes source-neutral.

## User-Visible Impact

- Metarchus and Salomé get stronger as your Victory Pile diversifies. They cost more to fight, and the City tile shows the real cost once WP-750 lands.
- Defeating Atrocity rescues a Bystander.
- Defeating Patriarch can draw you a card.
- Defeating Salomé lets you thin up to two cards from your discard pile.

Today all four villains are strictly weaker or emptier than printed.

---

## Assumes

1. **WP-750 is merged.**
   - `CityRow.vue` and `useCardCostGating` gate City Fight on `UICityCard.fightCost`, not the printed `display.cost`.
   - Without it, a Blood Frenzy villain shows an enabled Fight button that the engine refuses. This is the dead-button class from auto-memory `reference_client_fight_gating_ignores_fightcost`, and the same reason WP-748 hard-depends on WP-750.
2. **WP-757 is merged.** `villain-effect-markers.json` already holds the three `mdns/fallen` `ambush` rows.
3. **Fight-cost authority.** In `economy/economy.resolve.ts`:
   - `resolveFightCost(G, villainCardId)` (L47) returns `resolveBaseFightCost(...) + darkPortalVillainBonus(...)`. No term reads a player today.
   - Its callers are `moves/fightVillain.ts:147` (adds `getPatrolModifier`; `ctx.currentPlayer` in scope), `simulation/ai.legalMoves.ts:926` (`activePlayer` in scope) and `ui/uiState.build.ts:784` (the `fightCost` projection; `ctx.currentPlayer` in scope).
   - Only tests call it otherwise.
4. **"3+" / "6+" parse.** `economy/economy.logic.ts:358-381` treats a trailing `+` as `fightCostMode: 'dynamic'`, meaning base plus captured-hero recruit costs (WP-214). The Fallen never capture Heroes, so the base stays 3 / 6 and Blood Frenzy is additive on top.
5. **VP authority.** `scoring/scoring.logic.ts:64-150` `computeFinalScores` values victory-pile cards as follows:
   - villain → `computeDynamicVillainVictoryPoints(...) ?? cardVictoryPoints[id] ?? VP_VILLAIN`
   - henchman → `cardVictoryPoints[id] ?? VP_HENCHMAN`
   - bystander (`isBystanderCard`) → `VP_BYSTANDER`
   - defeated tactic (`mastermind.tacticsDefeated` includes id) → the per-tactic value
   - Undercover cards (`zones.undercover`, which also sit in the victory pile) → `VP_UNDERCOVER` (~206)
   - everything else → **no value**

   The per-tactic value is `cardVictoryPoints[mastermind.baseCardId] ?? VP_TACTIC` (~88-89). No per-card helper exists.
6. **Blood Frenzy detection.** `[keyword:Blood Frenzy]` on villain abilities is parsed by nothing today (the villain parser reads only `[effect:X]`). `setup/buildCardKeywords.ts` (called at `buildInitialGameState.ts:378`) is the text-scan precedent, fanned out per copy via the villain-card instance ids.
7. **Villain primitives.** `VillainEffectPrimitive` (`rules/villainAbility.types.ts:291` + array 379; 26 entries after WP-757) and the handler map `VILLAIN_EFFECT_HANDLERS` (`villain/villainEffects.execute.ts:~2967`). Handlers have the signature `(G, currentPlayer, cardId, timing, descriptor, shuffleContext?)`, may park and return `{ pending: true }`, and self-narrate keyword-less.
   - Templates: `villainEffectScryKoOwnDeck` (~L1117, own-deck peek + reshuffle) and `villainEffectDrawCardsCurrent` (~L1662).
8. **KO-from-discard choice.**
   - `PendingKoDiscardChoice { choiceType: 'ko-from-discard'; playerID; maxCount }` (`types.ts:940`) and `G.pendingKoDiscardChoices`.
   - `moves/koDiscardChoice.resolve.ts:161` logs a hardcoded "(Maniacal Tyrant)". The client header at `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.vue:146` reads "Maniacal Tyrant — KO up to N cards…".
   - Other pending choices name their source with `sourceCardId: CardExtId` (e.g. `types.ts:739, 973`), never with display text. `resolveCardDisplayName(G, extId)` (`villainEffects.execute.ts:282`) resolves a name from `G.cardDisplayData`.
   - `fightVillain.ts:198` has the block-all guard, and the bot default is `resolveKoDiscardChoice {cardIds: []}` (`ai.legalMoves.ts:798`).
9. **Feeds.**
   - `scripts/villain-mechanic-ledger.mjs` reads the engine **dist** parser output. A marker resolving to `hook.effects` counts as executable. Unmarked text is `(unmarked)` unless the card is listed in `scripts/coverage/subsystem-coverage.json`. That list is consulted **only for cards with zero `[effect:X]` tokens** (~387-400), and its `cards` keys use the form `{set}-villain-{group}-{card}`.
   - wp / decision come from `scripts/coverage/mechanic-provenance.json`.
   - `scripts/build-effect-implementation-index.mjs` joins the ledgers.
10. `pnpm -r build` exits 0 and the suite is green. Re-read drift counts at execution.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- Rules v23 Blood Frenzy (p.19) and `data/metadata/keywords-full.json` `bloodfrenzy`: "Only the number of different VP values matters, not how many cards you have of each."
- `data/cards/mdns.json` The Fallen (~797-853).
- `docs/ai/ARCHITECTURE.md` §Move Validation Contract and `.claude/rules/architecture.md`.
- `docs/ai/DECISIONS.md` entries: D-24348, D-18506, D-24285, D-24583, D-24510, D-24267, D-24176 (per-player tactic VP).
- `docs/ai/work-packets/WP-748-midtown-bank-robbery-villain-attack-per-bystander.md`, the sibling cost-term packet on the same authority and the same WP-750 dependency. Its cost term and this packet's term must compose additively; the executor reads whichever landed first.
- User memory: `reference_client_fight_gating_ignores_fightcost`, `reference_hashed_g_field_dual_repin`, `reference_card_data_pipeline`, `feedback_card_data_derived_ci_gates`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc, `// why:`, no `.reduce()` (a `Set` for the distinct count is fine), no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. Randomness comes only through the provided shuffle context (Patriarch's empty-deck reshuffle).
- Engine layer, plus exactly one declared arena-client copy fix (`PendingKoDiscardChoicePrompt.vue`), following the WP-753/754 "Game Engine + Arena Client" precedent. No other `apps/*` change.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24589) before coding. One WP per session.

**Packet-specific:**

- **One cost authority.** The Blood Frenzy term lives only in `resolveFightCost`. `resolveFightCost` gains an **optional** third parameter `fightingPlayerId?: string`:
  - With it omitted, the term is 0, so every existing caller and test stays byte-identical until it opts in.
  - All three production callers pass the acting player: `fightVillain` passes `ctx.currentPlayer`, `ai.legalMoves` passes `activePlayer`, and `uiState.build` passes `ctx.currentPlayer`. The City `fightCost` projection therefore shows the **active** player's cost to every audience, which is correct because only the active player can fight.
- **Distinct-VP count.** `countDistinctVictoryPointValues(G, playerId)` iterates `playerZones[playerId].victory` and collects each card's value from a new `victoryPointValueForCard(G, playerId, cardId)`.   That helper mirrors `computeFinalScores`' branch order **exactly**:
  1. villain: dynamic → printed → fallback;
  2. henchman;
  3. bystander;
  4. defeated tactic, at `cardVictoryPoints[mastermind.baseCardId] ?? VP_TACTIC`;
  5. Undercover card → `VP_UNDERCOVER`.

  It returns `null` for "no value" cards. The count is the size of the set of non-null values.
  - Negative and zero **printed** values count as values.
  - `computeFinalScores` is **not** refactored (duplicate first). A parity test sums `victoryPointValueForCard` over a fixture victory pile that includes a tactic and an Undercover card, and asserts the total equals the breakdown's `villainVP + henchmanVP + bystanderVP + tacticVP + undercoverVP`.
- **Blood Frenzy flag.** A new omit-when-empty `G.villainBloodFrenzy?: Record<CardExtId, true>` is built at setup by `setup/buildVillainBloodFrenzy.ts`, which scans villain ability text for `[keyword:Blood Frenzy]` (case-insensitive on the label) and fans out per copy instance id. It is assigned onto `G` only when non-empty, so the core sentinel keeps its hash. `BoardKeyword` is **not** widened, because Blood Frenzy is not a City-structural keyword.
- **Patriarch (`reveal-top-draw-if-cost-lte:N`).**
  1. Peek the current player's deck top. If the deck is empty, reshuffle the discard via `shuffleContext` (D-24285). If both are empty, log a no-op.
  2. Read cost as `cardStats[top].cost`. A Wound reads as 0 (D-24583).
  3. If cost ≤ N, move the card to hand. Otherwise leave it on top and log "revealed X, left on top".
  4. It is not subject to the hero-effect draw lock (the WP-731 precedent: villain draws for the active player route around `heroEffectDraw`).
- **Salomé (`ko-up-to-from-discard-current:N`).**
  - An empty discard is a logged no-op.
  - Otherwise, park `{ choiceType: 'ko-from-discard', playerID: currentPlayer, maxCount: N, sourceCardId: <Salomé's card id> }` and return `{ pending: true }`.
  - `PendingKoDiscardChoice` gains an **optional** `sourceCardId?: CardExtId`. It is additive and omit-when-absent, and follows the `sourceCardId` convention: never store display text in `G`.
  - In an explicit `if` block, `resolveKoDiscardChoice` logs the name resolved from `G.cardDisplayData` (the `resolveCardDisplayName` pattern) when `sourceCardId` is present, and `Maniacal Tyrant` otherwise. The existing Maniacal Tyrant entry and its log stay byte-identical.
  - **Client copy fix:** the `PendingKoDiscardChoicePrompt.vue` header becomes source-neutral: `KO up to {{ maxCount }} card(s) from your discard pile`, keeping the existing pluralisation. Otherwise Salomé's choice would read "Maniacal Tyrant". This is an intentional copy change, and the commit says so.
- **Atrocity** is data-only: `atrocity.fight ["captureBystander"]` (D-18506, awarded immediately on Fight).
- **Salomé's Escape** ("ascends to become an additional Mastermind") stays inert. See Out of Scope.

## Locked Values

- `resolveFightCost(G, villainCardId, fightingPlayerId?: string): number`. The Blood Frenzy term = `villainBloodFrenzy?.[villainCardId] === true && fightingPlayerId !== undefined ? countDistinctVictoryPointValues(G, fightingPlayerId) : 0`. Write it as an explicit `if` block, not a ternary chain.
- `G.villainBloodFrenzy?: Record<CardExtId, true>`, omit-when-empty.
- New primitives, appended to the union and array (26 → 28, re-read at execution): `'reveal-top-draw-if-cost-lte'` (magnitude N) and `'ko-up-to-from-discard-current'` (magnitude N). Tokens: `[effect:reveal-top-draw-if-cost-lte:3]`, `[effect:ko-up-to-from-discard-current:2]`.
- Marker rows under `villains.mdns.fallen`:
  - `atrocity.fight ["captureBystander"]`
  - `patriarch.fight ["reveal-top-draw-if-cost-lte:3"]`
  - `salom-sorceress-supreme.fight ["ko-up-to-from-discard-current:2"]` (the card slug is `salom-sorceress-supreme`)
- `PendingKoDiscardChoice.sourceCardId?: CardExtId`.
- Client header: `KO up to {{ maxCount }} card{{ maxCount === 1 ? '' : 's' }} from your discard pile`.
- `mechanic-provenance.json`: the two new primitives → `{ "wp": "WP-760", "decision": "D-24589" }`.
- `subsystem-coverage.json` `cards`: `mdns-villain-fallen-metarchus` and `mdns-villain-fallen-salom-sorceress-supreme` → `{ subsystem: 'economy:fight-cost-modifier', wp: 'WP-760', decision: 'D-24589' }`. This is documentation-only: both cards carry `[effect:X]` markers, so the allowlist is never consulted and their ledger rows stay `executable` (per the file's `_comment`).

---

## Scope (In)

- **A)** `types.ts`: `villainBloodFrenzy?` and `PendingKoDiscardChoice.sourceCardId?`.
- **B)** `setup/buildVillainBloodFrenzy.ts` (new) + test, wired in `setup/buildInitialGameState.ts` (assigned only when non-empty).
- **C)** `economy/bloodFrenzy.logic.ts` (new) + test: `victoryPointValueForCard`, `countDistinctVictoryPointValues`, and the scoring-parity test.
- **D)** `economy/economy.resolve.ts` + test: the optional parameter and the term.
- **E)** Callers pass the player: `moves/fightVillain.ts`, `simulation/ai.legalMoves.ts`, `ui/uiState.build.ts`, each with tests.
- **F)** The two primitives:
  - `rules/villainAbility.types.ts` + test (union, array, drift)
  - `setup/villainAbility.setup.ts` + test (parse the `:N` magnitude)
  - `villain/villainEffects.execute.ts` + test (two handlers + map)
  - `scripts/convert-cards/apply-effect-markers.mjs` (token validation)
- **G)** `moves/koDiscardChoice.resolve.ts` + test: the `sourceCardId` log.
- **G2)** `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.vue` + test: the source-neutral header.
- **H)** Data:
  - 3 marker rows
  - `mechanic-provenance.json`
  - `subsystem-coverage.json`
  - regenerate `data/cards/mdns.json` and the feeds

## Out of Scope

- **Salomé's Escape: "ascends to become an additional Mastermind"** is deferred to a future Ascend / multiple-Masterminds arc.
  - `G.mastermind` is a single object today.
  - Ascend appears on 34 ability lines across 7 sets (wtif, ssw2, msmc, ssw1, xmen, mdns, wpnx).
  - It needs additional-Mastermind state, fight targeting, an all-defeated endgame gate, per-Mastermind strike ordering, UI tiles, bot moves, and scoring as a Villain.
  - Until then, her Escape behaves as any Escape without a handler does today.
- **Hero-side Blood Frenzy** (Blade, Elsa Bloodstone, Morbius, Werewolf by Night: `card-mechanics.json` scope "hero", currently unsupported) is a follow-up. It can reuse `countDistinctVictoryPointValues`.
- **The "N+" overload** (a Fallen villain that captured a Hero would also add that Hero's cost). The Fallen have no capture text, so this is not reachable today; noted only.
- **Interactive choice for Patriarch** (the rule is deterministic: cost ≤ 3 → draw).
- **Other client work.** WP-750 owns the fightCost read, and there is no Blood-Frenzy-specific UI. The only client edit here is the KO-discard header.
- **Mastermind cost** (Blood Frenzy is villain-only here).
- **Scoring changes** (`computeFinalScores` is untouched).
- **PAR table regeneration** (see Vision Alignment).

## Files Expected to Change

- `packages/game-engine/src/types.ts` — modified
- `packages/game-engine/src/setup/buildVillainBloodFrenzy.ts` — **new**
- `packages/game-engine/src/setup/buildVillainBloodFrenzy.test.ts` — **new**
- `packages/game-engine/src/setup/buildInitialGameState.ts` — modified (wiring)
- `packages/game-engine/src/economy/bloodFrenzy.logic.ts` — **new**
- `packages/game-engine/src/economy/bloodFrenzy.logic.test.ts` — **new** (includes the scoring-parity case)
- `packages/game-engine/src/economy/economy.resolve.ts` — modified; its test `economy.resolve.test.ts` — modified
- `packages/game-engine/src/moves/fightVillain.ts` — modified; its test — modified
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — modified; its test — modified
- `packages/game-engine/src/ui/uiState.build.ts` — modified; its test — modified
- `packages/game-engine/src/rules/villainAbility.types.ts` — modified; its test — modified
- `packages/game-engine/src/setup/villainAbility.setup.ts` — modified; its test — modified
- `packages/game-engine/src/villain/villainEffects.execute.ts` — modified; its test — modified
- `packages/game-engine/src/moves/koDiscardChoice.resolve.ts` — modified; its test — modified
- `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.vue` — modified (source-neutral header); `PendingKoDiscardChoicePrompt.test.ts` — modified
- `scripts/convert-cards/apply-effect-markers.mjs` — modified
- `scripts/convert-cards/inputs/villain-effect-markers.json` — modified (3 rows)
- `scripts/coverage/mechanic-provenance.json` — modified
- `scripts/coverage/subsystem-coverage.json` — modified
- `data/cards/mdns.json` — regenerated
- Derived feeds — regenerated: `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json`. The `sim:coverage` baseline changes only if its check flags.
- Governance: `docs/ai/DECISIONS.md` (D-24589), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is ~26 code/test/data files, above the ~8 guideline. It is justified: two independent small mechanics plus one cost term, each with a test file and the standard marker/feed chain, and about half are tests.

## Contract

- The Locked Values above: the `resolveFightCost` signature, `villainBloodFrenzy?`, the two primitives and their tokens, `sourceCardId?`, the client header, and the marker rows.
- `victoryPointValueForCard` / `countDistinctVictoryPointValues` are exported from `economy/bloodFrenzy.logic.ts` for later hero-side Blood Frenzy reuse. They are not added to `index.ts`.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), and NG-1.

**Competitive surface:** The Fallen appear in gauntlet loadouts (`gauntletLoadouts.generated.ts:820-837`: Zarathos, Lilith). Raising two villains' fight costs and adding three Fight rewards changes expected difficulty for those loadouts. Published PAR for affected seeds may drift. That is the same class of fidelity shift every card WP carries, and PAR regeneration stays with the existing PAR pipeline, not this packet.

**Conflict assertion:** None. This is card fidelity, with no pay-to-win vector (NG-1).

**Determinism preservation:**
- `villainBloodFrenzy` is omit-when-empty.
- The new cost term reads only `G`.
- Patriarch's only randomness is the reshuffle through `shuffleContext`.
- The core sentinel plays no Fallen, so `finalStateHash` and `PRE_WP080_HASH` are expected unchanged; if either moves, dual re-pin honestly.
- **Replay-compat:** stored replays of pre-WP-760 matches that fought a Fallen villain will not re-execute identically. This is recorded in D-24589.

## Funding Surface Gate

§20 **N/A**: engine and card data only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Omit-when-empty field.** A match without The Fallen has no `villainBloodFrenzy` key, and both hash oracles are unchanged. A Fallen match has `villainBloodFrenzy` true for every Metarchus and Salomé copy id and for no other card.
2. **Distinct-VP count.**
   - `countDistinctVictoryPointValues` counts **distinct** values: {Bystander 1, Bystander 1, Villain 2, Villain 3} → 3.
   - It ignores heroes and twists.
   - It counts a defeated tactic at its scoring value, and an Undercover card at 1.
   - The scoring-parity test passes.
3. **Blood Frenzy cost.** `resolveFightCost(G, metarchusId, p)` = 3 + distinct(p). Omitting the player gives 3. `fightVillain` refuses at 3 attack when distinct(p) ≥ 1. Bot legal moves and `UICityCard.fightCost` show the same raised cost.
4. **Atrocity.** Defeating Atrocity puts one Bystander in the defeater's Victory Pile. An empty Bystander supply is a no-op.
5. **Patriarch.**
   - A top card costing ≤ 3 (including a Wound) is drawn.
   - A top card costing > 3 stays on top with a log line.
   - An empty deck reshuffles the discard first.
   - An empty deck and discard is a no-op.
6. **Salomé.**
   - Defeating Salomé parks `maxCount: 2` with `sourceCardId` set, and the resolve log names Salomé.
   - An empty discard is a no-op.
   - The Maniacal Tyrant log text is unchanged.
   - The client prompt header reads "KO up to 2 cards from your discard pile" and does not name Maniacal Tyrant.
7. **Drift.** Drift tests are green, with the primitive count increased by 2.
8. **Gates.** `pnpm -r --no-bail test` has 0 failures, `pnpm --filter @legendary-arena/arena-client typecheck` exits 0, and every card/feed gate exits 0. The ledger shows Atrocity, Patriarch and Salomé as `executable`. The two Blood Frenzy entries are present in `subsystem-coverage.json`.

## Verification Steps

1. `pnpm -r build` → exit 0. Run this first, because the ledger reads the engine dist.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass.
3. `node scripts/convert-cards/apply-effect-markers.mjs` → 3 lines updated. A re-run → 0 updates.
4. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:villains:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] Every Acceptance Criterion passes, and the diff is allowlist-only.
- [ ] D-24589 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, and `roadmap:counts:check` exits 0.
- [ ] Two-commit topology: `EC-797:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a live Fallen match on `play.legendary-arena.com`, with the deployed gitSha checked:
  - Metarchus's City tile shows 3 + distinct VP values;
  - Fight is enabled only at that cost;
  - defeating Patriarch or Salomé does what it prints.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24589 — fallen-fight-side.** It locks:
- the Blood Frenzy term in `resolveFightCost`, with the optional acting-player parameter (the active player's cost is projected to every audience);
- the per-card VP helper that mirrors scoring, plus its parity test;
- `villainBloodFrenzy` as an omit-when-empty setup map, not a `BoardKeyword`;
- the two primitives and their semantics (Wound = 0, empty-deck reshuffle, no draw lock);
- `sourceCardId` on the KO-discard choice, and the source-neutral client header;
- the Ascend deferral;
- the replay-compat note.

---

## Lint Gate Self-Review (00.3)

Drafted directly in house structure, after the WP-757/758/759 round-1 gate findings. The same classes of fix were applied up front: sections, boilerplate, exact commands, allowlist tags, and the §17/§20/§21 blocks.

- **§1:** all sections present.
- **§2:** boilerplate and the session protocol are present.
- **§3:** the Assumes items were verified by the research subagent against live code. Every line reference there is its report.
- **§4:** context is complete.
- **§5:** ~26 files, justified.
- **§6:** field names are canonical; the slug `salom-sorceress-supreme` is verbatim from the data.
- **§7:** no new dependencies.
- **§8:** engine only.
- **§9–§11:** N/A.
- **§12:** `node:test`.
- **§13:** exact commands.
- **§14:** 8 binary Acceptance Criteria.
- **§15:** STATUS, DECISIONS, the indexes and live-verify are covered.
- **§16:** 00.6.
- **§17:** satisfied, including the competitive and PAR note.
- **§18–§21:** N/A, each justified.

**Verdict:** PASS, pending the independent gate run recorded below.

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent).** Every Assumes claim was verified against live code: the three callers, the `+` parse, the magnitude grammar, D-18506 in code, the Blood Frenzy text on both cards, the Salomé slug, and WP-748 composing additively.

Findings, all fixed in this revision:
- **PS-1:** wrong subsystem key format, and the entry is inert for marked cards. Fixed with the correct keys, a documentation-only note, and a rewritten AC-8.
- **PS-2:** Undercover VP was missed. Fixed with a new branch, the parity sum, and an AC-2 case.
- **PS-3:** `sourceName` put display text in `G`. Replaced with `sourceCardId`.
- **PS-4:** the client header was hardcoded to "Maniacal Tyrant". Fixed with a declared client copy fix.
- **PS-5:** ledger reservation. Reserve PR #2358 lands before the draft SPEC.

**Scope verdict:** READY TO EXECUTE once WP-750 and WP-757 merge.

**Copilot (01.7): RISK.** The flagged modes were the G-text field and the user-visible mislabel, both fixed above. Residual risk: WP-750 is still undrafted; drafting it also unblocks WP-748.

**Round 3 CONFIRM (independent subagent):** CONFIRM. Every recorded fix is consistent across WP, EC and session prompt, code facts were re-verified, the cross-packet contract matches verbatim, and the stale-text sweep came back clean.
