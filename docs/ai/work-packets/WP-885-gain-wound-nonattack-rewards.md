# WP-885 — "You may gain a Wound. If you do, <reward>": the non-Attack rewards (Berserk, KO up to two other cards, Transform) (Game Engine + Card Data + arena-client heading)

**Status:** Draft 2026-11-11
**Primary Layer:** Game Engine (three new `gain-wound-reward` reward members and their grant arms, a Wound-sparing flag on the optional-KO queue, the transform swap extracted to a leaf, bot answers) + Card Data (three markers) + arena-client (one prompt heading)
**Dependencies (all ✅):**
- WP-883 / D-24834 (`gain-wound-reward`: the keyword, marker, seat-choice kind, `GainWoundReward` carrier, keep-or-forfeit rule on Diving Block / Flying Shield Block, leaf `grantGainWoundReward`; §11 names this follow-up and fixes its shape: add `rewardType` members and grant arms, never fields)
- WP-256 / D-24029 / D-24031 (Berserk as the `HERO_COMPOSITION_MARKERS` row, run by `interpretHeroPrimitiveEffect`)
- WP-667 / D-24480 (`optional-ko-hand-discard`: a no-reward hand ∪ discard entry on `G.pendingOptionalKoRewards`), WP-767 / D-24600 (`koHeroesOnly`: the precedent for a per-entry target filter read at the resolve, the projection and the bot), D-24442 (the bot's optional-KO default target)
- WP-658 / D-24469 (hero Transform: `G.transformTargets`, `G.transformDeck`, `heroEffectTransform`, `SUPPORTED_TRANSFORM_BASES`), WP-672 / D-24487 (the `transformResolved` notable event)
- D-24623 (`gate-only` hollow), D-24045 (resolved-marker provenance for the ledger), D-24745 (autoplay / sim / PAR stay on the default)

**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM — gameplay rules on three hero cards (one over-grant stops, two hollow lines start working), one optional-KO target filter, a transform refactor that must stay byte-identical, card data and derived feeds; no auth, money, persistence or server surface
**Lane:** Standard (two-session). Engine + card data + one client line; touches a contract file (`rules/heroAbility.types.ts`, one optional field) and > 4 code/test files, so not lightweight-eligible.

> Baseline: `origin/main` at `a374e0a3` plus the reserve commit `6a489b19` (#3289). Engine suite at the baseline: **6930 / 6930 pass** (`pnpm --filter @legendary-arena/game-engine test`, observed at draft).

---

## Goal

Three hero lines print "You may gain a Wound. If you do, <reward>" with a reward that is not Attack:

| Card | Line | Gate | Reward |
|---|---|---|---|
| `wpnx/weapon-x-wolverine/violent-conditioning` ability 0 | "You may gain a Wound. If you do, [keyword:Berserk], [keyword:Berserk]." | none | Berserk twice |
| `msis/bruce-banner/hulk-gets-smashed` ability 0 | "[hc:strength]: You main gain a Wound. If you do, KO up to two other cards from your hand and/or discard pile." (the data prints "main") | another Strength Hero played | KO up to two other cards from hand ∪ discard |
| `wwhk/skaar-son-of-hulk/mood-swings` ability 0 | "[hc:instinct]: You may gain a Wound. If you do, [keyword:Transform] this into Raging Savage." | another Instinct Hero played | Transform into Raging Savage |

**Today** (parser probe at the baseline, `buildHeroAbilityHooks` over the committed lines):
- **Violent Conditioning over-grants.** It parses to two Berserk `primitiveEffects` with no gate and no choice: it Berserks twice on every play and never gains a Wound (the Hulk Smash! over-grant class WP-883 fixed).
- **Hulk Gets Smashed is hollow.** `conditions [heroClassMatch strength]`, no effects, `unresolvedMarkers ['gate-only']` (D-24623).
- **Mood Swings is hollow.** `conditions [heroClassMatch instinct]`, no effects, `unresolvedMarkers ['transform']` (it is not on `SUPPORTED_TRANSFORM_BASES`, D-24469).

**After this session:** each line parks the WP-883 `gain-wound-reward` prompt ("Gain a Wound: <reward>" / "Don't gain a Wound", default don't). The Wound goes through `gainWoundWithOutcome`, so Diving Block and Flying Shield Block are offered as for any Wound. The reward is granted only for a Wound gained and kept, through the WP-883 keep-or-forfeit rule unchanged:
1. Violent Conditioning: Berserk twice (two runs of the Berserk composition).
2. Hulk Gets Smashed: up to two optional KOs from hand ∪ discard. The gained Wound is never one of them ("other").
3. Mood Swings: the existing Transform swap (Mood Swings → Raging Savage, permanent deck upgrade, Raging Savage's printed Attack, the "Transformed!" event).

Each card keeps its printed gate. Hulk Smash! and Scalded by Sunlight behave and log byte-identically except for the shared prompt heading.

## User-Visible Impact

- Playing Violent Conditioning asks "Gain a Wound?". Gain → a Wound in the discard pile, then Berserk twice. Decline → nothing. It no longer Berserks twice for free.
- Playing Hulk Gets Smashed after another Strength Hero asks the same. Gain → a Wound, then up to two "KO a card from your hand or discard pile" prompts. The Wound just gained can't be KO'd by them; an older Wound can.
- Playing Mood Swings after another Instinct Hero asks the same. Gain → a Wound, then Mood Swings Transforms into Raging Savage (+3 Attack, the Transform animation).
- The prompt heading for every gain-a-Wound card, Hulk Smash! included, reads "Gain a Wound?" (it read "Gain a Wound for extra Attack?"); the options name the reward.
- With Diving Block or Flying Shield Block available, a reveal prevents the Wound and the reward; taking the Wound keeps it.

---

## Assumes

1. **Parser** (`packages/game-engine/src/setup/heroAbility.setup.ts`, at the baseline):
   - `GAIN_WOUND_REWARD_PATTERN` `:329`; `GAIN_WOUND_REWARD_SEEDED_REWARDS` `:497` (`{ 'attack' }`, typed `ReadonlySet<HeroKeyword>`); Step 2g `:2276-2293` (emits only when `isValidHeroKeyword(candidate)` and the candidate is seeded); the reward-icon suppression `:2648-2665`; the descriptor arm `:2875-2881`.
   - `SUPPORTED_TRANSFORM_BASES` `:722` (its comment lists "gain-a-Wound" among the unmodelled transform conditions); the transform arm `:1723-1738` (`transformSupported` → keyword, else unresolved `transform`); `transformSupported` is resolved per card at `:5135` and passed in options (`:1273`, `:1292`).
   - The composition arm `:1881-1895` pushes a deep copy of `HERO_COMPOSITION_MARKERS[name]` to `primitiveEffects` and records `resolvedMarkers`.
   - `GATE_ONLY_MARKER` `:179`, recorded `:3060-3061` only when a gated line resolved nothing but its gate.
   - Probe output (verbatim): Violent Conditioning → `keywords []`, two `primitiveEffects`, `resolvedMarkers ['berserk','berserk']`, no conditions. Hulk Gets Smashed → `keywords ['conditional']`, `conditions [{heroClassMatch, strength}]`, `unresolvedMarkers ['gate-only']`. Mood Swings → `keywords ['conditional']`, `conditions [{heroClassMatch, instinct}]`, `unresolvedMarkers ['transform']`.
2. **Descriptor contract** (`rules/heroAbility.types.ts`): `HeroEffectDescriptor.rewardType?: HeroKeyword` `:151`. `berserk` is a composition marker, not a `HeroKeyword` (D-24031), so it cannot travel in `rewardType`.
3. **WP-883 modules:**
   - `hero/gainWoundReward.logic.ts`: seeded set `:45`, `buildGainWoundRewardChoice(playerID, reward)` `:56` (label `Gain a Wound: you get +N Attack`), `applyGainWoundRewardSeatChoice` `:92` (L3 / L6 / L5 inline, attack wording), `buildGainWoundReward(rewardType, magnitude, sourceCardId)` `:180` (attack only).
   - Leaf `hero/gainWoundRewardGrant.ts`: `grantGainWoundReward` `:34` (one `'attack'` arm, L4 / L7), `logGainWoundRewardForfeited` `:72` (L8, attack wording); imports `addResources`, `pushLog`, `formatCardRef`, types.
   - `hero/heroEffects.execute.ts` `heroEffectGainWoundReward` `:7601` (calls `buildGainWoundReward(effect.rewardType, …)`; unseeded → L0).
   - Decline labels: `moves/divingBlock.logic.ts` `:291-305` (`Take the Wound (keep +N Attack)`), `moves/flyingShieldBlock.logic.ts` `:223-236` (`(keep +N Attack)` / `(they keep +N Attack)`).
   - `types.ts` `GainWoundReward` `:1626` (`rewardType: 'attack'`), carried by `PendingSeatChoice` `:1613`, `PendingDivingBlockWound` `:1825`, `PendingFlyingShieldBlockWound` `:1851`.
   - Bot: `simulation/ai.seatChoice.ts` `chooseGainWoundRewardOption` `:304`; the tagged Diving Block / Flying Shield Block declines `:138` / `:150` are reward-neutral already.
   - Client: `PendingSeatChoicePrompt.vue` `:159-160` `case 'gain-wound-reward'` → `'Gain a Wound for extra Attack?'`; asserted at `PendingSeatChoicePrompt.test.ts:408`. The `co2e/hulk|gain-wound-reward` row in `docs/ai/coverage/live-verify.json` is `partial` since #3288; its `evidence` quotes that heading as seen live, a historical record that stays as written.
   - L1 is pushed inline in `heroEffectGainWoundReward` (`heroEffects.execute.ts:7631`); `buildGainWoundRewardChoice('0', REWARD)` is called with two arguments by `simulation/ai.seatChoice.test.ts:490/495/499/505` (engine tests are not type-checked, so a reordered signature would break them at runtime).
   - `moves/flyingShieldBlock.logic.ts` `buildSeatPrompt(seat, entry)` `:230` (one caller, `:296`) has no `G`.
   - `buildHeroEffectTraceParams` (`heroEffects.execute.ts:1885-1909`) copies `rewardType` into the effect trace.
   - `rules/heroKeywords.ts` comments `:74` / `:182` say transform resolves only for `SUPPORTED_TRANSFORM_BASES`; `:125` / `:233` say the `gain-wound-reward` seeded rewards are `{ attack }`.
   - Ledger: `scripts/hero-mechanic-ledger.mjs` classifies `transform` by hook (`BY_HOOK_KEYWORDS` `:187`; executable only when `cardResolvedKeywords` has it, `:375-376`), and `cardResolvedKeywords` is built from `hook.keywords` plus day-night branch effects (`:585-593`). `resolvedMarkers` feeds only the composition-marker branch (`:389`). `berserk` (static composition) and `gain-wound-reward` (in `MVP_KEYWORDS`) are executable by name.
4. **Berserk:** `rules/heroCompositions.ts` `HERO_COMPOSITION_MARKERS.berserk` `:33` (move the deck-top card to discard, gain Attack equal to its printed Attack). `hero/effectPrimitive.interpret.ts` `interpretHeroPrimitiveEffect(G, ctx, playerID, node, sourceCardId)` `:641` (fresh context per call; `ctx` unused by Berserk; logs its own grant). It imports only zoneOps, economy, log and `splitCard.logic.ts` (→ `setup/pilesInit.ts`), so the grant leaf can import it without a new cycle edge.
5. **Optional KO:** `types.ts` `PendingOptionalKoReward` `:1140` (`koZones` `:1161`, `koHeroesOnly` `:1174`). `heroEffectOptionalKoHandDiscard` `heroEffects.execute.ts:3621` parks `{ rewardType: 'none', rewardMagnitude: 0, koZones: ['hand','discard'] }`. The three `koHeroesOnly` readers: `moves/optionalKoReward.resolve.ts:160` (reject), `ui/uiState.build.ts:1876` (eligible lists), `simulation/ai.legalMoves.ts:745` (bot `isEligible`). `selectDefaultOptionalKoTarget` `heroEffects.execute.ts:7990` (lowest `cardStats[id]?.cost ?? 0`, discard before hand). Wounds are the fungible `WOUND_EXT_ID` (`setup/pilesInit.ts`).
6. **Transform:** `heroEffectTransform` `heroEffects.execute.ts:6869-6981` (base `#copy` strip, `G.transformTargets` lookup, first `{target}#` copy in `G.transformDeck`, refusal logs when no copy remains or the base left play, the swap, the second form's printed Attack / Recruit via `addResources`, the applied log, the `transformResolved` notable event). Helpers `resolveTransformCardName` `:6994` (also called at `:2772`, `:2773`, `:3533`, `:4129`) and `formatTransformEconomyClause` `:7012`. `buildTransformTargets` (`setup/buildHeroDeck.ts:833`) maps **every** wwhk base, so `wwhk/skaar-son-of-hulk/mood-swings → …/raging-savage` is already in `G.transformTargets` and Raging Savage copies are in `G.transformDeck`. Raging Savage: cost 6, Attack `3+`, `[keyword:Wounded Fury]` (unsupported; unchanged).
7. **Markers.** `scripts/convert-cards/inputs/hero-ability-markers.json` has `msis` `:1032`, `wwhk` `:1476` and `wpnx` `:2725` sections. `VALID_TOKEN_PATTERN` already accepts `[keyword:gain-wound-reward:<reward>:<n>]` for any `[a-z][a-z-]*` reward (WP-883), so no validator change.
8. **Corpus.** "You may gain a Wound. If you do" (plus msis's "You main gain") appears on exactly five hero lines (grep over `data/cards/*.json`): the two WP-883 attack lines, the three above, and `anni/super-skrull/put-to-the-torch`[2] (§Out of Scope).
9. **No consumer of the three hooks' effect shape** beyond the executor: no committed fixture, PAR scenario, sentinel or test plays them. No committed PAR profile (`data/par/profile/v1/*.json`) includes `wpnx/weapon-x-wolverine`, `msis/bruce-banner` or `wwhk/skaar-son-of-hulk`. `msis/bruce-banner` is on a `sim:runtime-observed` sweep board (`scripts/runtime-observed-hollows.mjs:170`); the sweep, sim and PAR take the decline default (D-24745).
10. `pnpm -r build` exits 0 and the suites are green at the baseline.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 / §5.1 (the `[keyword:X]` ability-markup token form; the three Card Map tokens reuse the WP-883 `gain-wound-reward` token).
- `docs/ai/DECISIONS.md` D-24834 (all of it: this packet extends its mechanism and must not change its attack behavior), D-24031 (composition markers), D-24469 / D-24487 (Transform), D-24480 / D-24600 / D-24442 (optional KO), D-24623, D-24045, D-24745.
- `data/metadata/keywords-full.json`: Berserk ("Discard the top card of your deck. You get +Attack equal to that card's printed Attack").
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #2 (the UIState projection: no new UIState field here; the spare-a-Wound flag only filters the existing optional-KO eligible lists), §Layer Boundary (Authoritative), §Card Data Flow.
- `.claude/rules/architecture.md` §UIState Projection Integrity: no new `UIState` field, so the five-step contract does not apply. One new key, `effectTraces[].params.rewardComposition`, reaches the client through the existing trace-params spread (`uiState.build.ts:2585`, `uiState.filter.ts:1781`); no whitelist step is needed, and §H asserts it survives the filter. `koSparesGainedWound` and `gainWoundReward` are never projected.
- User memory: `reference_setup_hook_change_replay_compat`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_bot_legalmoves_moveguard_divergence` (the bot must never emit a KO target the resolve rejects), `reference_engine_tests_never_typechecked`.
- **Why three rewards in one packet.** They share one mechanism (the WP-883 prompt, chokepoint and keep-or-forfeit rule), one heading change and one label/log phrasing helper. Each reward is one grant arm plus its parse consumption; splitting would repeat the heading and phrasing change three times.
- **Why Put to the Torch is out.** Its reward is "Rooftops Conqueror 4" ("+4 Attack while any Villain is on the Rooftops"). Conqueror is unsupported on all five heroes that print it (`amwp/jentorra`, `anni/heralds-of-galactus`, `anni/super-skrull`, `asrd/valkyrie`, `asrd/warriors-three-the`), including Put to the Torch's own two other lines. How "while" maps onto the turn-economy pool should be decided once, by a Conqueror WP, not for one reward line. When it ships, Put to the Torch adds one `rewardType` arm.
- **Why "other" spares the gained Wound.** "KO up to two other cards" excludes the Wound just gained; without it a player with no Wounds could gain one and KO it plus another card, a free deck thin. Wounds are one fungible id, so the rule is enforced by count: a Wound is a legal target only while hand ∪ discard hold at least two Wounds.
- **Why a contract field for Berserk.** `rewardType` is a `HeroKeyword` and `berserk` deliberately is not (D-24031). One optional descriptor field, `rewardComposition`, names a composition reward; the alternative (making `berserk` a `HeroKeyword`) would reverse D-24031.
- **Why extract the transform swap.** The grant runs from the leaf `gainWoundRewardGrant.ts`, which must not import `heroEffects.execute.ts` (that module imports `gainWoundReward.logic.ts`). Moving the swap body to a leaf `hero/heroTransform.logic.ts` lets both call it. The move is mechanical: same code, same logs, same event; `heroEffectTransform` delegates.
- **Parallel work.** WP-884 (Hunt for Victims, #3287, drafting) is another seat-choice packet; expect hot-file conflicts in `WORK_INDEX.md`, `EC_INDEX.md`, the mindmap and possibly `ai.seatChoice.ts`. Keep both sides.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file; no diffs, no snippets.
- ESM only, Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (full-word names, JSDoc, no nested ternaries, functions ~30 lines).
- Moves and effects never throw. No randomness, no clock. Files limited to §Files Expected to Change.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24836) before coding. One WP per session.

**Packet-specific:**

- **No new `HeroKeyword`, no new seat-choice kind, no new move.** The keyword lockstep pins (99 keywords, 78 handlers) do not move.
- **Reward vocabulary.** `GainWoundReward.rewardType` becomes `'attack' | 'berserk' | 'optional-ko-hand-discard' | 'transform'`; no field is added to `GainWoundReward`.
- **Markers + parser.**
  - Tokens (Card Map): `[keyword:gain-wound-reward:berserk:2]`, `[keyword:gain-wound-reward:optional-ko-hand-discard:2]`, `[keyword:gain-wound-reward:transform:1]`.
  - `GAIN_WOUND_REWARD_SEEDED_REWARDS` (both copies) = `{ 'attack', 'optional-ko-hand-discard', 'transform' }`. New `GAIN_WOUND_REWARD_SEEDED_COMPOSITIONS = { 'berserk' }` (both copies; its members must be `HERO_COMPOSITION_MARKERS` keys).
  - Step 2g: a seeded `HeroKeyword` reward is recorded as today (`rewardTypes`); a seeded composition reward is recorded as the line's composition reward. The descriptor arm emits `{ type: 'gain-wound-reward', magnitude, rewardType }` or `{ type: 'gain-wound-reward', magnitude, rewardComposition: 'berserk' }` (no `rewardType`). Anything else emits nothing.
  - **Token consumption** (the reward-icon suppression's siblings, so no printed reward fires unconditionally and no hollow remains). A per-line pre-scan for the gain-wound-reward token runs before the Step 2 keyword loop (the `xGeneSupported` / `teleportOnDiscardSupported` precedent). On a line whose reward is:
    - `berserk`: the composition arm pushes **no** `primitiveEffects` for `berserk` and records `resolvedMarkers` `berserk` (one per token, as today), so the ledger keeps Berserk executable;
    - `transform`: the transform arm pushes neither the `transform` keyword nor an unresolved marker, and records `resolvedMarkers` `transform`. Mood Swings is **not** added to `SUPPORTED_TRANSFORM_BASES` (that allowlist means an unconditional swap); update its comment to say Mood Swings' gain-a-Wound condition is modelled by `gain-wound-reward` (WP-885).
  - The `attack` path and the reward-icon suppression are unchanged.
- **Contract field.** `rules/heroAbility.types.ts` `HeroEffectDescriptor` gains `rewardComposition?: string` with a `// why: WP-885 / D-24836` comment: set only on a `gain-wound-reward` descriptor whose reward is a composition marker; other keywords ignore it.
- **Handler.** `heroEffectGainWoundReward` builds the reward with `buildGainWoundReward(effect.rewardType, effect.rewardComposition, magnitude, cardId)`; an unseeded one → L0 as today. Order otherwise unchanged (L0, L2, L9, park + L1 / N1).
- **`buildGainWoundReward(rewardType: HeroKeyword | undefined, rewardComposition: string | undefined, magnitude: number, sourceCardId: CardExtId)`.** The keyword path narrows by `GAIN_WOUND_REWARD_SEEDED_REWARDS` membership plus an explicit `switch` to `'attack' | 'optional-ko-hand-discard' | 'transform'`; the composition path narrows by `GAIN_WOUND_REWARD_SEEDED_COMPOSITIONS.has(…)` and `=== 'berserk'`. No `as` casts. If both fields are present, `rewardType` wins (the parser never emits both). Anything else → `undefined`.
- **Phrasing helper** (leaf `hero/gainWoundRewardGrant.ts`, so Diving Block / Flying Shield Block keep their single existing import). For a non-attack reward it returns a **label phrase** (second person) and a **log phrase** (third person):
  - `berserk`: label `Berserk twice` (magnitude 2; `Berserk {N} times` otherwise); log the same.
  - `optional-ko-hand-discard`: label `KO up to {N} other cards from your hand or discard pile`; log `KO up to {N} other cards from their hand or discard pile`.
  - `transform`: label and log `Transform into {second form}`. `{second form}` = the display name of the first `{target}#` copy in `G.transformDeck` (via the moved `resolveTransformCardName`), or `its second form` when none remains.
- **Labels.** Option 0 `Gain a Wound: {label phrase}` for a non-attack reward; option 1 unchanged. Signature `buildGainWoundRewardChoice(playerID, reward, G?)`: `G` is a trailing optional parameter, read only for the transform name (called without `G`, a transform reward labels `its second form`), so the WP-883 two-argument callers stay valid. `flyingShieldBlock.logic.ts` `buildSeatPrompt` gains a `G` parameter (local helper, one caller). Tagged-entry decline suffixes for a non-attack reward: recipient ` (then {label phrase})`; another seat (Flying Shield Block) ` (they keep its reward)`. Every `attack` label is byte-identical.
- **Log lines.** L0, L2, L3, L9 unchanged (reward-neutral). Every `attack` line (L1, L4-L8) byte-identical. Non-attack forms (all 4-argument `pushLog(G, text, outcome, sourceCardId)`; `{card}` = `formatCardRef(G.cardDisplayData, sourceCardId)`):
  - N1 `Player {p} may gain a Wound to {log phrase} ({card}).` [neutral]
  - N4 `Player {p} gained a Wound ({card}).` [applied], then the reward runs and logs its own lines
  - N5 `Player {p} would gain a Wound — they {log phrase} if they keep it ({card}).` [neutral]
  - N6 `Player {p} could not gain a Wound — the Wound supply is empty, so they do not {log phrase} ({card}).` [blocked]
  - N7 `Player {p} kept the Wound ({card}).` [applied], then the reward runs
  - N8 `Player {p}'s Wound was prevented, so they do not {log phrase} ({card}).` [blocked]
  - N10 `Player {p} had no other card in their hand or discard pile to KO ({card}).` [blocked] (KO reward with no eligible target)
- **Grant arms** (`grantGainWoundReward`, after N4 / N7):
  - `berserk`: run `interpretHeroPrimitiveEffect(G, undefined, recipientID, structuredClone(HERO_COMPOSITION_MARKERS.berserk), sourceCardId)` `magnitude` times, in a `for` loop (each a fresh context). A missing composition row → nothing (defensive).
  - `optional-ko-hand-discard`: count eligible targets in the recipient's hand ∪ discard under the spare rule (non-Wounds + max(0, Wounds − 1)). Park `min(magnitude, eligible)` entries `{ playerID: recipientID, rewardType: 'none', rewardMagnitude: 0, sourceCardId, koZones: ['hand','discard'], koSparesGainedWound: true }`, each with its own fresh `koZones` literal (no shared constant array; the `heroEffectOptionalKoHandDiscard` precedent); 0 eligible → N10, nothing parked. Because KOs only remove cards and the board is frozen, every parked entry still has an eligible target when it reaches the front.
  - `transform`: `applyHeroTransform(G, recipientID, sourceCardId)` (the extracted swap; its own refusal logs cover a missing copy and a base that left play).
- **Spare-a-Wound flag.** `types.ts` `PendingOptionalKoReward.koSparesGainedWound?: true` (written `true` or omitted, readers test `=== true`, the `koHeroesOnly` posture). The name follows the entry's `ko*` field family (`koZones`, `koTeamFilter`, `koHeroesOnly`, D-24600) rather than the `is`/`has`/`can` boolean prefix; a `// why:` on the field says so and D-24836 records it. A Wound is an eligible target only while the chooser's hand ∪ discard hold **at least two** Wounds. Same three readers as `koHeroesOnly`, each recounting from current `G`: the resolve rejects a Wound otherwise (silent no-op, queue intact); the projection omits Wounds from the hand and discard lists otherwise; the bot's `isEligible` excludes them otherwise. Absent → every existing entry is byte-unchanged.
- **Transform extraction.** New leaf `hero/heroTransform.logic.ts` exports `applyHeroTransform(G, playerID, cardId)` (the body of `heroEffectTransform` from the `playerZones` guard through the `transformResolved` push, unchanged), `resolveTransformCardName` and `formatTransformEconomyClause` (moved verbatim). `heroEffectTransform` delegates; the four other `resolveTransformCardName` call sites import it. It imports only zoneOps, economy, log, `events/notableEvents.compose.ts` and types; never `heroEffects.execute.ts`. "Verbatim" means identical code tokens, log strings and event push. Exactly two comments change: the `targetKey === undefined` `// why:` (`heroEffects.execute.ts:6896-6899`, "only SUPPORTED_TRANSFORM_BASES cards reach it") and the JSDoc "only executes when the gate passed" (`:6840`) both name the WP-885 `gain-wound-reward` caller too. `composeTransformNarrative` moves its import with the body (drop it from `heroEffects.execute.ts` if no other use remains). Every existing transform test passes unedited.
- **Import edges.** The grant leaf adds imports of `effectPrimitive.interpret.ts`, `rules/heroCompositions.ts`, `hero/heroTransform.logic.ts` and `setup/pilesInit.ts` (`WOUND_EXT_ID`); none reaches `divingBlock.logic.ts`, `flyingShieldBlock.logic.ts`, `seatChoice.resolve.ts` or `heroEffects.execute.ts`. Verify by reading each module's imports; a `// why:` line on each new import.
- **Bot answers** (`chooseGainWoundRewardOption`, playing seat only; G never written):
  - `attack`: unchanged.
  - `berserk`: decline (`choice.defaultOptionIndex`). The payoff is the hidden top card of the deck; the bot must not read it.
  - `optional-ko-hand-discard`: gain iff the seat's hand ∪ discard hold at least `magnitude` cards of cost 0 (`G.cardStats[id]?.cost ?? 0`, the `selectDefaultOptionalKoTarget` read: Wounds and the starting S.H.I.E.L.D. cards), counted before the gain.
  - `transform`: gain iff the base card is in the seat's `inPlay` and a `{target}#` copy remains in `G.transformDeck`.
  - Autoplay, the simulation runner and PAR keep `defaultOptionIndex` (D-24745). For the `gain-wound-reward` choice `getLegalMoves` still offers only the default; its only change is the spare-rule `isEligible` branch on optional-KO entries that carry `koSparesGainedWound`.
- **Client.** `PendingSeatChoicePrompt.vue` `case 'gain-wound-reward'` → `'Gain a Wound?'` (amends D-24834 §5; the options carry the reward). Migrate its WP-883 test case (`PendingSeatChoicePrompt.test.ts:408`). The `co2e/hulk` live-verify `evidence` is a record of what was seen and is not edited.
- **Ledger.** `scripts/hero-mechanic-ledger.mjs`: beside the day-night branch loop, for each hook effect of type `gain-wound-reward` that carries a `rewardType`, add that `rewardType` to `cardResolvedKeywords` (`// why: WP-885 / D-24836` — a Wound-gated reward resolves its keyword inside the descriptor, like the day-night branches). This makes `wwhk/skaar-son-of-hulk|transform` executable from Mood Swings; nothing else changes status (`attack` and `optional-ko-hand-discard` are already by-name).
- **Effect trace.** `buildHeroEffectTraceParams` copies `rewardComposition` when present, next to `rewardType`.
- **`heroKeywords.ts` comments only.** Update the stale comments at `:74` / `:182` (Mood Swings' Transform resolves through `gain-wound-reward`) and `:125` / `:233` (the seeded rewards). No union, array or pin change.
- **Not touched:** `game.ts`, `index.ts`, any move registration, UIState types / the audience filter, `heroKeywords.ts` code, `ko-wound-reward`, `random-acts`, Diving Block / Flying Shield Block behavior (only the non-attack suffix text), Put to the Torch, `SUPPORTED_TRANSFORM_BASES` membership.
- **Determinism / replay.** Setup output plus code paths only the new hooks reach. Pre-deploy match blobs keep their stored `G.heroAbilityHooks` (Violent Conditioning's two ungated Berserks) and replay identically. No new top-level `G` field, no randomness (Berserk's interpreter path reads no `ctx`). The core sentinel `finalStateHash` and `PRE_WP080_HASH` are expected unchanged; confirm by running them.

## Card Map (locked)

| Set / hero / card | Ability | Marker | Gate kept |
|---|---|---|---|
| `wpnx/weapon-x-wolverine/violent-conditioning` | 0 | `[keyword:gain-wound-reward:berserk:2]` | none |
| `msis/bruce-banner/hulk-gets-smashed` | 0 | `[keyword:gain-wound-reward:optional-ko-hand-discard:2]` | `[hc:strength]` (`heroClassMatch`) |
| `wwhk/skaar-son-of-hulk/mood-swings` | 0 | `[keyword:gain-wound-reward:transform:1]` | `[hc:instinct]` (`heroClassMatch`) |

## Locked Values

- Reward members `berserk`, `optional-ko-hand-discard`, `transform`; seeded sets as above; `rewardComposition?: string`; `koSparesGainedWound?: true`.
- The three Card Map tokens; the label phrases, suffixes, heading `'Gain a Wound?'` and log lines N1 / N4-N8 / N10 verbatim.
- The spare rule (a Wound is eligible only while hand ∪ discard hold ≥ 2 Wounds) at all three readers; `min(magnitude, eligible)` entries.
- The three bot answers.
- `applyHeroTransform` / `resolveTransformCardName` / `formatTransformEconomyClause` in the leaf `hero/heroTransform.logic.ts`, moved verbatim.

---

## Scope (In)

- **A) Parser + contract.** `setup/heroAbility.setup.ts` (seeded sets, Step 2g, descriptor arm, pre-scan, berserk and transform consumption, `SUPPORTED_TRANSFORM_BASES` comment); `rules/heroAbility.types.ts` (`rewardComposition?`).
- **B) Reward mechanism.** `types.ts` (`GainWoundReward.rewardType` members, `koSparesGainedWound?`); `hero/gainWoundReward.logic.ts` (seeded sets, `buildGainWoundReward`, labels, N5 / N6); leaf `hero/gainWoundRewardGrant.ts` (phrasing helper, three arms, N4 / N7 / N8 / N10); `hero/heroEffects.execute.ts` (`heroEffectGainWoundReward` reads `rewardComposition` and logs N1; `heroEffectTransform` delegates; helper imports; the trace copies `rewardComposition`); new leaf `hero/heroTransform.logic.ts`; `rules/heroKeywords.ts` (comments only).
- **C) Labels.** `moves/divingBlock.logic.ts`, `moves/flyingShieldBlock.logic.ts` (`buildSeatPrompt` gains `G`): the non-attack suffixes through the phrasing helper.
- **D) Spare-a-Wound readers.** `moves/optionalKoReward.resolve.ts`, `ui/uiState.build.ts`, `simulation/ai.legalMoves.ts`.
- **E) Bots.** `simulation/ai.seatChoice.ts` (three answers).
- **F) Client.** `PendingSeatChoicePrompt.vue` heading (+ migrate its `PendingSeatChoicePrompt.test.ts` case).
- **G) Markers + data.** `inputs/hero-ability-markers.json` three rows; regenerate `data/cards/wpnx.json`, `msis.json`, `wwhk.json` through `apply-hero-ability-markers.mjs`.
- **H) Tests.**
  - `setup/heroAbility.setup.test.ts`: the three cards parse to their locked hooks (Violent Conditioning: no conditions, no `primitiveEffects`, `effects [{gain-wound-reward, 2, rewardComposition berserk}]`, `resolvedMarkers` keeps `berserk`; Hulk Gets Smashed: `[heroClassMatch strength]`, `effects [{gain-wound-reward, 2, optional-ko-hand-discard}]`, no `unresolvedMarkers`; Mood Swings: `[heroClassMatch instinct]`, `effects [{gain-wound-reward, 1, transform}]`, no `transform` keyword, `resolvedMarkers` has `transform`, no `unresolvedMarkers`). An unseeded composition (`[keyword:gain-wound-reward:empowered:1]`) emits nothing. The WP-883 Hulk Smash! and unseeded-`draw` cases pass unedited.
  - New `hero/gainWoundRewardNonAttack.test.ts`, hooks from `buildHeroAbilityHooks` over the regenerated card data (never hand-written):
    - Violent Conditioning: prompt (N1, label `Gain a Wound: Berserk twice`); gain → a Wound, two deck-top cards discarded, Attack += their printed Attack, N4; decline → nothing (L3). Diving Block reveal → N8; the deck loses exactly the one card Diving Block draws to hand; no deck-top card goes to discard; Attack unchanged. Decline → Berserk twice (N7).
    - Hulk Gets Smashed: pre-gain discard [Agent, Trooper], post-gain [Agent, Trooper, Wound] → two optional-KO entries with `koSparesGainedWound`, and the gained Wound (the only Wound) is never eligible. With one prior Wound in hand, a Wound is eligible until one is KO'd. No other card → N10, no entry. One eligible → one entry. Resolve rejects a Wound when hand ∪ discard hold one; the projection omits it; the bot never targets it.
    - Drain loop (the sim-hang invariant): with hand ∪ discard = {gained Wound, older Wound, Agent}, and again with {gained Wound, Agent}, repeatedly call `getLegalMoves`, apply the returned `resolveOptionalKoReward`, and assert the queue shrinks every iteration until empty; at the end at least one Wound remains in hand ∪ discard.
    - Each parked KO entry has its own `koZones` array (not the same reference).
    - Trace: a Violent Conditioning effect trace carries `params.rewardComposition === 'berserk'` after `buildUIState` + `filterUIStateForAudience`.
    - Mood Swings: gain → Raging Savage in play, Mood Swings in the side deck, +3 Attack, `transformResolved` event, N4; no Raging Savage copy left → the existing refusal log, the Wound stays.
    - Non-attack tagged decline labels (`Take the Wound (then Berserk twice)`, `(they keep its reward)`); every attack label, log and heading assertion from WP-883's `gainWoundReward.test.ts` passes unedited.
  - `simulation/ai.seatChoice.test.ts`: berserk → decline; KO → gain with two cost-0 cards, decline with one; transform → gain with a copy in the side deck, decline without; purity (`G` deep-equals a pre-call `structuredClone`).
  - Transform extraction: the existing transform suites pass unedited (behavior identity).
- **I) Records + ledger script.** `docs/ai/coverage/live-verify.json` three `pending` rows (`wpnx/weapon-x-wolverine|gain-wound-reward`, `msis/bruce-banner|gain-wound-reward`, `wwhk/skaar-son-of-hulk|gain-wound-reward`). The existing `co2e/hulk` row is not edited. `scripts/hero-mechanic-ledger.mjs` (the by-hook `rewardType` branch). `scripts/coverage/mechanic-provenance.json` only if `ledger:heroes:check` flags.
- **J) Feeds.** Regenerate `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json`; `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json` and the dashboard `totalObs` / `percentResolved` pins only if their gates flag (run `pnpm --filter @legendary-arena/dashboard prebuild:coverage` first).

## Out of Scope

- `anni/super-skrull/put-to-the-torch`[2] ("Rooftops Conqueror 4"): blocked on a Conqueror WP (§Context). WP-883's §8 hook-ordering revisit (parking does not halt the hook loop) travels with it: all three cards here are one-line.
- Adjacent lines with a different shape: `wpnx/weapon-x-wolverine/raging-regeneration`[1] ("KO a Wound … If you do, Berserk again": a `ko-wound-reward` with a Berserk reward) and `bkpt` "[hc:instinct]: You may draw a card and get +1 Attack. If you do, gain a Wound." (the reward comes first).
- The msis "You main gain" typo in card data (printed text is source data; the marker carries the semantics).
- Raging Savage's Wounded Fury, Hulk Smash! / Scalded by Sunlight behavior, a bot policy for autoplay / sim / PAR, `effect-rulings.json`.

## Files Expected to Change

- `packages/game-engine/src/setup/heroAbility.setup.ts` (+ `setup/heroAbility.setup.test.ts`) — modified
- `packages/game-engine/src/rules/heroAbility.types.ts` — modified (one optional field; contract file, D-24836)
- `packages/game-engine/src/rules/heroKeywords.ts` — modified (comments only)
- `scripts/hero-mechanic-ledger.mjs` — modified (by-hook `rewardType` branch)
- `packages/game-engine/src/types.ts` — modified (reward members, one optional KO field)
- `packages/game-engine/src/hero/gainWoundReward.logic.ts`, `hero/gainWoundRewardGrant.ts`, `hero/heroEffects.execute.ts` — modified
- `packages/game-engine/src/hero/heroTransform.logic.ts` — **new**; `packages/game-engine/src/hero/gainWoundRewardNonAttack.test.ts` — **new**
- `packages/game-engine/src/moves/divingBlock.logic.ts`, `moves/flyingShieldBlock.logic.ts`, `moves/optionalKoReward.resolve.ts` — modified
- `packages/game-engine/src/ui/uiState.build.ts` — modified (eligible lists only)
- `packages/game-engine/src/simulation/ai.legalMoves.ts`, `simulation/ai.seatChoice.ts` (+ `ai.seatChoice.test.ts`) — modified
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` (+ `PendingSeatChoicePrompt.test.ts`) — modified
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `docs/ai/coverage/live-verify.json` — modified; `scripts/coverage/mechanic-provenance.json` — only if its gate flags
- `data/cards/wpnx.json`, `data/cards/msis.json`, `data/cards/wwhk.json` — regenerated (one line each)
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv`, `docs/ai/coverage/runtime-observed-hollows.json` — regenerated
- `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — only if their gates flag
- Governance (execution close): `docs/ai/DECISIONS.md` (D-24836 appended Active), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

The count is above the split heuristic for the reason in §Context: one mechanism, three arms. Each edit outside the grant leaf is one reader branch, one label suffix, one bot answer or a verbatim move.

## Contract

- The Locked Values.
- `HeroEffectDescriptor.rewardComposition?` (contract file) and `PendingOptionalKoReward.koSparesGainedWound?` are the two new optional fields; `GainWoundReward` gains members only.

## Vision Alignment

**Vision clauses touched:** §1 Rules Authenticity (Violent Conditioning over-grants today; Hulk Gets Smashed and Mood Swings are hollow), §2 Content Authenticity and §10 Content as Data (markers; printed text unchanged), §22 Deterministic & Reproducible Evaluation, §23 / §24 (ranked fairness, replay-verified integrity), §26 Simulation-Calibrated PAR Determination (sim / PAR take the decline default; no committed PAR profile includes the three heroes), NG-1 (no pay-to-win; untouched).
**Conflict assertion:** No conflict: this WP preserves all touched clauses.
**Non-Goal proximity:** not crossed.
**Determinism (§22):** no randomness; bot answers read `G` only (the Berserk answer deliberately reads nothing hidden); setup-level change, so stored matches replay identically.

## Funding Surface Gate

§20 **N/A**: a rules change on three hero cards. Its only copy is the prompt heading, option labels and log lines. No funding affordance or channel (WP-097 §A/§B/§C) is touched.

## API Catalog

§21 **N/A**: no `apps/server` HTTP endpoint added, changed or removed. No `Library-only` catalog function is touched: `docs/ai/REFERENCE/api-endpoints.md` lists none of the edited engine functions.

---

## Acceptance Criteria

1. The three cards parse to their locked hooks: gate kept, one `gain-wound-reward` descriptor, no unconditional Berserk / Transform, no `gate-only` or `transform` unresolved marker, `berserk` and `transform` in `resolvedMarkers`. An unseeded reward or composition emits nothing. Hulk Smash! and Scalded by Sunlight parse unchanged.
2. Playing each card with its gate met parks the prompt with the locked label. Gain grants the reward only for a Wound gained and kept (Berserk twice; up to two optional KOs that never take the gained Wound; Transform into Raging Savage). Decline changes nothing. An empty supply opens no prompt.
3. Diving Block / Flying Shield Block keep-or-forfeit applies to all three rewards exactly as to Attack; non-attack tagged decline labels read `Take the Wound (then {label phrase})` / `(they keep its reward)`; every attack label and log line is byte-identical.
4. The spare rule holds at the resolve, the projection and the bot; every existing optional-KO entry is unchanged.
5. The bot ally declines Berserk, gains KO with ≥ 2 cost-0 cards, gains Transform when a copy remains; `choosePlayingSeatChoiceOption` never writes `G`; `getLegalMoves` still offers only the default.
6. The client heading reads "Gain a Wound?". The transform extraction leaves every existing transform test passing unedited.
7. `cards:check`, `cards:count-markers:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`, `sim:runtime-observed:check`, `sim:coverage --check` and `ledger:numbers:check` exit 0. The ledger reads `gain-wound-reward` = `executable` for the three heroes and `transform` = `executable` for `wwhk/skaar-son-of-hulk`. The `EC-923:` body records the runtime feed's `gate-only`, `transform` and `berserk` `hitCount`s before and after.
8. `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` and `pnpm --filter @legendary-arena/dashboard typecheck` → 0. The core sentinel `finalStateHash` and `PRE_WP080_HASH` are unchanged.

## Verification Steps

1. `pnpm -r build` → 0.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → the three Card Map lines update; re-run → 0 updates; `--validate` → 0.
3. Record the `gate-only`, `transform` and `berserk` hitCounts: `node -e "const f=require('./docs/ai/coverage/runtime-observed-hollows.json');for(const m of ['gate-only','transform','berserk'])console.log(m,f.byMechanic[m]&&f.byMechanic[m].hitCount)"`.
4. Regenerate (`docs/03-DATA-PIPELINE.md` §1): `pnpm -r build && pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata && pnpm sim:runtime-observed`; then `pnpm sim:coverage --check` (only if it flags: `--update-baseline`); then `pnpm --filter @legendary-arena/dashboard prebuild:coverage`, re-pinning the dashboard pins only if the feed moved them. Re-run step 3.
5. `pnpm cards:check && pnpm cards:count-markers:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check && pnpm ledger:numbers:check` → all 0.
6. `pnpm --filter @legendary-arena/game-engine test` → 0 fail (6930 at the baseline plus the new cases); `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` and `pnpm --filter @legendary-arena/dashboard typecheck` → 0.
7. Ledger spot check: `node -e "const l=require('./docs/ai/coverage/hero-mechanic-ledger.json');for(const [id,m] of [['wpnx/weapon-x-wolverine','gain-wound-reward'],['msis/bruce-banner','gain-wound-reward'],['wwhk/skaar-son-of-hulk','gain-wound-reward'],['wwhk/skaar-son-of-hulk','transform']]){const r=l.rows.find(x=>x.extId===id&&x.mechanic===m);console.log(id,m,r&&r.status)}"` → four `executable`.
8. `git diff --name-only` ⊆ Files Expected to Change; revert `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24836 Active. It records: the three reward members and seeded sets; `rewardComposition` (why a field, not a `HeroKeyword`) and its trace copy; the ledger's by-hook `rewardType` branch; the token consumption for Berserk and Transform; the phrasing, labels, heading change (amends D-24834 §5) and N-lines; the three grant arms; the spare rule and `koSparesGainedWound` at three readers (and why its name keeps the `ko*` family); the transform extraction; the three bot answers (Berserk declines: hidden information); Put to the Torch blocked on Conqueror with the §8 revisit; the replay note.
- [ ] STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-923:` then `SPEC:`).
- [ ] **D-24026 live-verify (post-merge):** on an operator match created after the deploy: Violent Conditioning prompts (gain → a Wound and two Berserks; decline → neither); Hulk Gets Smashed after a Strength Hero → gain → two KO prompts that don't offer the gained Wound; Mood Swings after an Instinct Hero → gain → Raging Savage in play with the Transform animation. Recorded as a STATUS flip and the three `live-verify.json` rows.

## Reserved Decision (lands at execution)

**D-24836 — gain-wound-nonattack-rewards.** It locks everything in the DoD item above. Reserved in NUMBER-LEDGER (#3289); written Active in the execution `SPEC:` close.

## Settled Design Questions (drafting decisions, 2026-11-11)

1. **Put to the Torch is excluded** until Conqueror exists (§Context). Rejected: modelling Rooftops Conqueror for one reward line, which would pre-decide Conqueror's "while" semantics for five heroes.
2. **"Other" spares the gained Wound**, enforced by count. Rejected: ignoring "other" (a free KO of the gained Wound).
3. **The bot declines Berserk.** Rejected: peeking at the deck top to decide (reads hidden information).
4. **One heading for every reward** ("Gain a Wound?"). Rejected: a second seat-choice kind per reward (more dispatch and bot arms for no player benefit).
5. **The prompt still opens when the reward can't pay off** (no Raging Savage copy left, nothing else to KO): the Wound itself is gainable, so the option is legal (rules v23 L3199-3201 forbids only options you can't do). The bot declines those.

---

## Lint Gate Self-Review (00.3)

Independent subagent run (2026-11-11). **Run 1: FAIL** on four text-only items, all fixed in this revision:
- §4: Context gained `00.2-data-requirements.md` §5 / §5.1.
- §13: AC 8 and Verification step 6 name the exact `pnpm --filter … typecheck` commands.
- §15.2: the EC Risk Tier line is the WP's, verbatim.
- EC-TEMPLATE: exact typecheck commands at Before Starting / After Completing, and `pnpm roadmap:counts:write` before the check.

**Run 2: PASS** (2026-11-11).

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Constraints | PASS |
| §3 Assumes | PASS |
| §4 Context | PASS (after fix) |
| §5 Files | PASS |
| §6 Naming | PASS |
| §7 Dependencies | PASS |
| §8 Boundaries | PASS |
| §9 Windows | PASS |
| §10 Env vars | N/A: none introduced or read |
| §11 Auth | N/A: no auth surface |
| §12 Tests | PASS |
| §13 Verification | PASS (after fix) |
| §14 ACs | PASS |
| §15 / §15.1 | PASS |
| §15.2 Risk tier | PASS (after fix) |
| §16 Code style | PASS (`koSparesGainedWound` keeps the `ko*` entry-field family, D-24600; D-24836 records it) |
| §17 Vision | PASS |
| §18 Prose-vs-grep | N/A: no forbidden-token grep step |
| §19 Bridge-vs-HEAD | N/A: commit-time rule |
| §20 Funding | N/A, justified |
| §21 API catalog | N/A, justified |
| EC-TEMPLATE | PASS (after fix; EC 65 content lines) |

## Gate Record

**Pre-flight (01.4), independent subagent.** Round 1: **NOT READY** (two PS items, seven RS items), all applied:
- **PS-1:** the ledger classifies `transform` by hook from `hook.keywords` only (`hero-mechanic-ledger.mjs:187`, `:375-376`, `:585-593`), so `resolvedMarkers` alone would leave Skaar's `transform` unsupported. Added the by-hook `rewardType` branch and the script to the allowlist.
- **PS-2:** `buildGainWoundRewardChoice` keeps its two-argument callers (`ai.seatChoice.test.ts:490-505`, untype-checked): `G` is a trailing optional.
- **RS:** N1 lives in `heroEffects.execute.ts:7631`; `buildSeatPrompt` gains `G`; `heroKeywords.ts` comment-only edits; the `co2e/hulk` live-verify note migrates (superseded after the gates: #3288 rewrote that row as `partial` and the heading now appears only in its historical `evidence`, which is not edited); the trace copies `rewardComposition`; explicit pre-/post-gain fixture; anchors `:6994`, `:159-160`.

Verified by the agent: baseline 6930 / 0; the parse probe; every anchor; the grant leaf's runtime import closure never reaches `heroEffects.execute` / `divingBlock.logic` / `flyingShieldBlock.logic` / `seatChoice.resolve`; Berserk from the leaf reads no `ctx` (empty deck: no-op, no reshuffle); `min(magnitude, eligible)` cannot hang the bot; no bot answer reads hidden information; Empirical Scaffold N/A (only entries carrying the new flag are filtered). Round 2 (after all gate edits): **READY TO EXECUTE**, no new PS item.

**Copilot (01.7), independent subagent.** Round 1: **RISK → HOLD**, seven scope-neutral findings, all applied:
- **#11:** a Diving Block reveal draws its one card; the §H line no longer says "deck untouched".
- **#21 / #10:** `buildGainWoundReward(rewardType, rewardComposition, magnitude, sourceCardId)` locked with checked narrowing, no casts, `rewardType` wins.
- **#11:** the drain-loop sim-hang test.
- **#15 / #26:** "verbatim" defined; the two transform comments that become false are named; the `composeTransformNarrative` import moves.
- **#4:** `effectTraces[].params.rewardComposition` acknowledged as a client-visible key through the existing spread, with a filter-survival test.
- **#17:** a fresh `koZones` literal per parked entry.
- **#27:** `koSparesGainedWound` naming rationale.

Round 2: **RISK → HOLD** on one line (WP:149 said `getLegalMoves` is unchanged; it gains the spare-rule `isEligible`), applied verbatim. Round 3 (after the lint edits): **PASS — CONFIRM**.
