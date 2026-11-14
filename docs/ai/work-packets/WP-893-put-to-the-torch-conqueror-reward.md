# WP-893 — Put to the Torch: "You may gain a Wound. If you do, you get Rooftops Conqueror 4" (Game Engine + Card Data)

**Status:** Draft 2026-11-13
**Primary Layer:** Game Engine (one `gain-wound-reward` reward member, its grant arm and bot answer) + Card Data (one marker)
**Dependencies (all ✅):**
- WP-883 / D-24834 (the `gain-wound-reward` keyword: the prompt, the `gainWoundWithOutcome` chokepoint, the Diving Block / Flying Shield Block keep-or-forfeit rule, §8 hook ordering, §11 "members and arms, never fields")
- WP-885 / D-24836 (the non-Attack reward machinery: `rewardComposition`, `describeGainWoundRewardPhrases`, the N-lines, the grant arms; §12 names this packet)
- WP-886 / D-24837 (hero Conqueror: `CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE`, its evaluate and describe cases; Put to the Torch lines 0 / 1; Settled Design Question 4 names this packet)
- WP-633 / D-24443 (`data/cards` re-derives from the pipeline; `cards:check`)

**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM — gameplay rules on one hero card (a hollow line starts working), one reward arm and bot answer, a comment-only contract-file edit, card data and derived feeds; no auth, money, persistence or server surface
**Lane:** Standard (two-session). Not lightweight-eligible: it touches a contract file (`rules/heroAbility.types.ts`, comment only) and more than 4 code/test files.

> Baseline: `origin/main` at `37a0abef0` (WP-885 live-verify, #3338) plus the reserve #3344. Engine suite at the baseline: **7037 / 7037 pass**. The scaffold below ran at that baseline.

---

## Goal

anni Super-Skrull's **Put to the Torch** prints three lines: "Bridge Conqueror 1", "Streets Conqueror 1", and "You may gain a Wound. If you do, you get Rooftops Conqueror 4." WP-886 shipped the first two. The third is still an honest hollow: playing the card records `rooftops-conqueror` and never offers the Wound.

**After this session:**
1. Playing Put to the Torch opens the WP-883 `gain-wound-reward` prompt: "Gain a Wound: you get Rooftops Conqueror 4" / "Don't gain a Wound".
2. Gaining and keeping the Wound gives +4 Attack when a Villain is in the Rooftops (Rooftops Conqueror 4, rules v23 L1157-1159), and nothing otherwise, with the reason logged. Declining gives neither the Wound nor the Attack.
3. A Diving Block or Flying Shield Block reveal on that Wound forfeits the reward (D-24834 §3, unchanged code).
4. The bot ally gains only when the Rooftops hold a Villain and the +4 opens a fight it could not make; otherwise it declines.
5. The `rooftops-conqueror` hollow leaves the runtime feed, and the hero ledger gains `anni/super-skrull|gain-wound-reward` = `executable`.

## User-Visible Impact

- Put to the Torch now asks "Gain a Wound?". With a Villain in the Rooftops, gaining logs "Player 0 gained a Wound (Put to the Torch …)." then "Player 0 got +4 Attack — a Villain is in the Rooftops (…)."; with the Rooftops empty it logs "… got no Attack — no Villain is in the Rooftops (…)." and the Wound stays.
- Lines 0 / 1 (Bridge / Streets Conqueror 1) are unchanged and resolve first.

---

## Assumes

1. **Parser** (`packages/game-engine/src/setup/heroAbility.setup.ts`, at the baseline):
   - `GAIN_WOUND_REWARD_SEEDED_REWARDS` `:499` (a `HeroKeyword` set); `GAIN_WOUND_REWARD_SEEDED_COMPOSITIONS` `:509`.
   - Step 2g `:2320-2345`: a candidate that is a valid `HeroKeyword` in the seeded set → `rewardTypes`; else a seeded composition → `gainWoundRewardComposition`; else nothing.
   - Descriptor arm `:2934-2937` emits `{ type, magnitude, rewardComposition }` when `gainWoundRewardComposition` is set.
   - The D-24623 unmatched-slug fallback `:3101-3122` runs only when the line resolved no keyword, effect, primitive or marker, so a line that resolves `gain-wound-reward` records no `rooftops-conqueror` slug. The pre-scan `findSeededGainWoundRewardToken` `:3400` matters only for Berserk / Transform token consumption.
2. **Contract field.** `HeroEffectDescriptor.rewardComposition?: string` (`rules/heroAbility.types.ts:152-157`); the trace copies it (`heroEffects.execute.ts:1930-1931`).
3. **Reward carrier.** `GainWoundReward.rewardType: 'attack' | 'berserk' | 'optional-ko-hand-discard' | 'transform'` (`types.ts:1667`, interface `:1662`).
4. **Choice and builder** (`hero/gainWoundReward.logic.ts`): seeded sets `:45` / `:54`; `buildGainWoundRewardChoice` `:68` (non-Attack option 0 = `Gain a Wound: {label phrase}` `:75`); the N5 / N6 forms `:164` / `:193`; `buildGainWoundReward` `:252` (keyword `switch` `:263-265`, composition path `:271`).
5. **Grant leaf** (`hero/gainWoundRewardGrant.ts`): `describeGainWoundRewardPhrases` `:60` (exhaustive `switch` `:64`); `grantGainWoundReward` `:130` (Attack branch `:137`, N4 / N7 `:156-160`, non-Attack `switch` `:161`); `logGainWoundRewardForfeited` `:324`. Leaf rule: imports nothing that reaches `heroEffects.execute.ts`, `divingBlock.logic.ts`, `flyingShieldBlock.logic.ts` or `seatChoice.resolve.ts` (D-24834 §4).
6. **Conqueror condition** (`hero/heroConditions.evaluate.ts`): `CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE` `:80`; `evaluateCondition(G, playerID, condition)` `:210` (Conqueror case `:584`); `describeFailedCondition(G, playerID, condition)` `:1016` (Conqueror case `:1162`, strings `no Villain is in the <Space>` / `there is no <Space> in the City`). Its transitive runtime imports (11 modules, measured at the baseline) reach none of the four leaf-forbidden modules.
7. **Handler and interceptions need no code change.** `heroEffectGainWoundReward` (`heroEffects.execute.ts:7491`) passes `effect.rewardComposition` and logs N1 through the phrase helper; `divingBlock.logic.ts:306` and `flyingShieldBlock.logic.ts:240` take their generic non-Attack branch for any member other than `'attack'`.
8. **Bot** (`simulation/ai.seatChoice.ts`): `chooseGainWoundRewardOption` `:352`, `switch` `:361`, the `attack` arm breaks to the fight-count rule `:377-386`. Tests: WP-883 describe `ai.seatChoice.test.ts:489`, WP-885 describe `:573`.
9. **Existing tests that read line 2.** `setup/heroAbility.setup.test.ts:2773` asserts Put to the Torch line 2 is a hollow (`effects` undefined, `unresolvedMarkers ['rooftops-conqueror']`); it migrates. `hero/heroConqueror.test.ts:189-205` asserts line 2 adds no Attack at play; its fixture's Wound supply is empty (`makeGlobalPiles`, `test/fixtureBuilders.ts`), so after this packet line 2 logs L2 and opens no prompt, and the case passes unedited.
10. **Card data.** `data/cards/anni.json` Put to the Torch line 2 reads `You may gain a Wound. If you do, you get [keyword:Rooftops Conqueror 4].` (restored by WP-886). Markers flow through `scripts/convert-cards/inputs/hero-ability-markers.json` → `apply-hero-ability-markers.mjs`, whose validator already admits `[keyword:gain-wound-reward:[a-z][a-z-]*:[1-9]\d*]`.
11. **Scaffold observed at draft (reverted).** The marker row, `apply-hero-ability-markers.mjs` and a one-line Step 2g prototype:
    - `data/cards` diff = exactly Put to the Torch line 2 in `anni.json` (`Updated: 1 lines`).
    - Probe: line 2 builds `{ keywords: ['gain-wound-reward'], effects: [{ type: 'gain-wound-reward', magnitude: 4, rewardComposition: 'rooftops-conqueror' }] }`, no `conditions`, no `unresolvedMarkers`; lines 0 / 1 unchanged.
    - `pnpm --filter @legendary-arena/game-engine test`: one failure, the `:2773` hollow assertion (to migrate). `heroConqueror.test.ts` passes.
    - `pnpm ledger:heroes`: +1 row `anni/super-skrull|gain-wound-reward` = `executable` (WP-883 / D-24834); no other row moves.
    - `pnpm sim:runtime-observed`: `rooftops-conqueror` 7 → absent (feed 3 insertions / 44 deletions). `pnpm sim:coverage --check` → OK, no baseline update (its two NEW-mechanic warnings, `rooftops-conqueror` and `bank-conqueror`, were already present at the baseline).
    - Dashboard: `useInPlayCoverage.test.ts:749-751` pins move `totalObs` 8724 → 8717, `resolvedObs` 1220 → 1213, `percentResolved` 14 → 13.9; re-pinned, the dashboard suite passes 621 / 621 (pre-flight re-run of the full prototype).
12. `pnpm -r build` exits 0 and the suites are green at the baseline.
13. **Stale comments the change makes false** (comment-only edits, in scope): `setup/heroAbility.setup.ts:932-938` (the `CONQUEROR_LINE_PATTERN` `// why:` says Put to the Torch's Wound line keeps its hollow); `rules/heroKeywords.ts:125` (lists the seeded `gain-wound-reward` rewards); `hero/heroEffects.execute.ts:7479-7482` (the D-24834 §8 note says the multi-line follow-up "must revisit it"); `hero/gainWoundRewardGrant.ts:10-14` (the header says "Four rewards").

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` L1157-1159 (Hero Conqueror: "You get +1 [Attack] if any Villain is on the Bridge"), L3199-3201 ("you can't choose an option that you can't do").
- `docs/ai/DECISIONS.md` D-24834 (all; §3 keep-or-forfeit, §8 hook ordering, §11 members and arms), D-24836 (all; §2 `rewardComposition`, §5 phrasing, §6 N-lines, §12 this packet), D-24837 (condition, describe strings, Settled Design Question 4), D-24031 (composition markers are not `HeroKeyword`s), D-24623, D-24745.
- WP-883, WP-885, WP-886 (their Scope and Gate Records).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (engine-only), §Card Data Flow. No `UIState` field, so the five-step projection contract does not apply.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 / §5.1 (the `[keyword:X]` ability-markup token; the Card Map token reuses the WP-883 `gain-wound-reward` form); `docs/03-DATA-PIPELINE.md` §1 (the marker pass).
- User memory: `reference_setup_hook_change_replay_compat`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_card_data_pipeline`.
- **Why now.** D-24836 §12 and D-24837 SDQ 4 both named this line as the last "You may gain a Wound. If you do" hollow; WP-885 (the reward machinery) and WP-886 (the condition) are both shipped and live-verified.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file; no diffs, no snippets.
- ESM only, Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (full-word names, JSDoc, no nested ternaries, functions ~30 lines).
- Moves and effects never throw. No randomness, no clock. Files limited to §Files Expected to Change.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24850) before coding. One WP per session.

**Packet-specific:**

- **Reward member.** `GainWoundReward.rewardType` gains `'rooftops-conqueror'`; no field is added (D-24834 §11). The space is encoded in the member, so the grant arm maps `'rooftops-conqueror'` to the condition `{ type: CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE, value: 'rooftops' }`. The member's spelling is the WP-886 hollow slug (`<space>-conqueror`), which the coverage fold `(^|-)conqueror$` already maps to the `conqueror` family.
- **Marker.** `anni/super-skrull/put-to-the-torch`[2] `[keyword:gain-wound-reward:rooftops-conqueror:4]` via `inputs/hero-ability-markers.json` (a new row at the top of the `anni` array) and `apply-hero-ability-markers.mjs`. No validator change.
- **Parser.** New seeded set `GAIN_WOUND_REWARD_SEEDED_CONQUEROR_REWARDS: ReadonlySet<string> = new Set<string>(['rooftops-conqueror'])` in two copies (the parser and `hero/gainWoundReward.logic.ts`, duplicate-first, each with a `// why:` naming the other). Step 2g gains a third arm after the composition arm: a candidate in that set with n ≥ 1 pushes `gain-wound-reward`, sets its magnitude, and records the candidate in `gainWoundRewardComposition`. The descriptor is therefore `{ type: 'gain-wound-reward', magnitude: 4, rewardComposition: 'rooftops-conqueror' }`. No pre-scan change: the line has no `[keyword:Berserk]` / `[keyword:Transform]` token, and the resolved keyword already keeps the D-24623 fallback from recording `rooftops-conqueror`.
- **`rewardComposition` carries a non-`HeroKeyword` reward.** Its type is unchanged (`string`). Its contract-file comment (`rules/heroAbility.types.ts:152-157`) is rewritten to say it names a `gain-wound-reward` reward that is not a `HeroKeyword`: a composition marker (Berserk, D-24031) or a Conqueror bonus (`rooftops-conqueror`, D-24850). The `gainWoundRewardComposition` local and the Step 2g comment say the same. (Settled Design Question 2.)
- **Builder.** `buildGainWoundReward` (`gainWoundReward.logic.ts:252`): the composition path accepts `GAIN_WOUND_REWARD_SEEDED_COMPOSITIONS.has(rewardComposition) && rewardComposition === 'berserk'` (unchanged) or `GAIN_WOUND_REWARD_SEEDED_CONQUEROR_REWARDS.has(rewardComposition) && rewardComposition === 'rooftops-conqueror'`, returning `{ rewardType: 'rooftops-conqueror', magnitude, sourceCardId }`. The current early return at `:271` (not a seeded composition → `undefined`) must be restructured so the conqueror branch is reachable; the two accepting conditions and the `undefined` fall-through are what is locked, not the guard's shape. No `as` casts. `rewardType` still wins if both are present; anything else `undefined` (L0).
- **Phrases** (`describeGainWoundRewardPhrases`, new `case 'rooftops-conqueror'`): label `you get Rooftops Conqueror {N}`; log `get Rooftops Conqueror {N}` (the printed keyword; C1 / C2 spell out the +N and the reason). So option 0 reads `Gain a Wound: you get Rooftops Conqueror 4`; N1 `Player {p} may gain a Wound to get Rooftops Conqueror 4 ({card}).`; N5 / N6 / N8 and the Diving Block / Flying Shield Block suffixes follow the D-24836 §5 / §6 templates unchanged. The phrase reads no `G`.
- **Grant arm** (`grantGainWoundReward`, new `case 'rooftops-conqueror'`, after N4 / N7 as for every non-Attack reward): build the condition literal above (a fresh object each call); `evaluateCondition(G, recipientID, condition)`:
  - true → `G.turnEconomy = addResources(G.turnEconomy, reward.magnitude, 0)` and log **C1** `Player {p} got +{N} Attack — a Villain is in the Rooftops ({card}).` [applied];
  - false → no Attack and log **C2** `Player {p} got no Attack — {describeFailedCondition(G, recipientID, condition)} ({card}).` [blocked] (`no Villain is in the Rooftops` / `there is no Rooftops in the City`).
  - The Wound is kept either way: "If you do" is satisfied by the Wound; the Conqueror bonus is a separate check.
  - The leaf imports `evaluateCondition`, `describeFailedCondition` and `CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE` from `./heroConditions.evaluate.js`, with a `// why:` that its runtime imports reach none of the four forbidden modules (Assumes 6).
  - Also add a `default: { const unhandledReward: never = reward.rewardType; return; }` exhaustiveness guard to the `grantGainWoundReward` non-Attack `switch` (today a missing arm would log N4 and grant nothing), with a `// why:`.
- **When the condition is read.** At grant time. The prompt, every Diving Block / Flying Shield Block wave and the grant all happen while the board is frozen (a pending seat choice blocks every other move, and the interception waves draw cards or rescue Bystanders, never touch `G.city`), so the grant-time read equals a play-time read. Reading through `evaluateCondition` means the Firelord destroyed-space follow-up, when it extends the Conqueror case, applies here with no change.
- **The prompt always opens** (Wound supply non-empty, no other choice open), even with the Rooftops empty or missing: gaining a Wound is always an option the player can do (L3199-3201 bars options you cannot do, not ones with no payoff). The label states the condition.
- **Bot** (`chooseGainWoundRewardOption`, new `case 'rooftops-conqueror'`): when `evaluateCondition(G, seat, condition)` is false → `GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX`; otherwise `break` into the existing `attack` fight-count rule with `reward.magnitude`. `ai.seatChoice.ts` imports `evaluateCondition` and `CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE` from `../hero/heroConditions.evaluate.js` (no cycle, Assumes 6; a `// why:` at the import). `G` never written. Autoplay, the simulation runner and PAR keep `defaultOptionIndex` (decline; D-24745); `getLegalMoves` is unchanged.
- **Hook ordering (D-24834 §8 revisit).** Put to the Torch builds three hooks in line order; lines 0 / 1 resolve at play and line 2 parks the prompt last, so no later hook of this card runs before the prompt resolves. §8's general rule ("parking does not halt the hook loop") stands; it is moot for this card. D-24850 records it.
- **Comment-only edits** (Assumes 13): the `CONQUEROR_LINE_PATTERN` `// why:` (the Wound line is now a `gain-wound-reward` reward, D-24850); `heroKeywords.ts:125` (add `rooftops-conqueror` to the listed rewards); the `heroEffects.execute.ts` §8 note (the revisit is D-24850: moot for Put to the Torch, the rule stands); the grant-leaf header (five rewards, naming Put to the Torch). No code token in `heroKeywords.ts` or `heroEffects.execute.ts` changes.
- **Not touched:** `HERO_KEYWORDS`, `HERO_EFFECT_HANDLERS`, `HANDLED_KEYWORDS` and every count pin (101 / 80); any code in `heroEffects.execute.ts` or `heroKeywords.ts`; `divingBlock.logic.ts`; `flyingShieldBlock.logic.ts`; `seatChoice.resolve.ts`; `heroConditions.evaluate.ts`; Put to the Torch lines 0 / 1; the arena-client (the heading is already "Gain a Wound?"); `scripts/hero-mechanic-ledger.mjs` (the scaffold shows the new row comes from the existing by-name path); `UIState`.
- **Determinism / replay.** Setup output plus code paths only the new hook reaches. A match created before the deploy keeps its stored `G.heroAbilityHooks` (line 2 hollow) and replays identically (memory `reference_setup_hook_change_replay_compat`); only matches created after the deploy see the prompt. No new `G` field, no randomness. Core sentinel `finalStateHash`, `PRE_WP080_HASH` and PAR are expected unchanged (no committed PAR profile includes `anni/super-skrull`); confirm by running them.

## Card Map (locked)

| Card | Line | Marker | Parsed hook |
|---|---|---|---|
| `anni/super-skrull/put-to-the-torch` | 2 | `[keyword:gain-wound-reward:rooftops-conqueror:4]` | `keywords ['gain-wound-reward']`, `effects [{ type: 'gain-wound-reward', magnitude: 4, rewardComposition: 'rooftops-conqueror' }]`, no `conditions`, no `unresolvedMarkers` |

Lines 0 / 1 stay the WP-886 Conqueror hooks (Bridge +1, Streets +1).

## Locked Values

- Member `'rooftops-conqueror'`; set `GAIN_WOUND_REWARD_SEEDED_CONQUEROR_REWARDS: ReadonlySet<string> = new Set<string>(['rooftops-conqueror'])` (two copies); the marker and descriptor above.
- Condition literal `{ type: CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE, value: 'rooftops' }`, read at grant time through `evaluateCondition`.
- Phrases, C1 and C2, verbatim. Every Attack label and log line, and every other non-Attack line, byte-identical.
- Bot: decline when the condition fails, else the `attack` rule.

---

## Scope (In)

- **A) Types.** `types.ts`: the member (with a `// why:` naming D-24850). `rules/heroAbility.types.ts`: the `rewardComposition` comment only. `rules/heroKeywords.ts`: the `:125` comment only.
- **B) Parser.** `setup/heroAbility.setup.ts`: the set, the Step 2g arm, the comments on `gainWoundRewardComposition`, the `CONQUEROR_LINE_PATTERN` comment.
- **C) Reward.** `hero/gainWoundReward.logic.ts`: the set, the builder path. `hero/gainWoundRewardGrant.ts`: the phrase case, the grant arm, the three imports, the header. `hero/heroEffects.execute.ts`: the §8 comment only.
- **D) Bot.** `simulation/ai.seatChoice.ts`: the case and its two imports.
- **E) Card data.** The marker row; regenerate `data/cards/anni.json` with `apply-hero-ability-markers.mjs` (re-run reports 0 updates; `--validate` clean).
- **F) Tests.**
  - `setup/heroAbility.setup.test.ts`: migrate the `:2773` case (Put to the Torch line 2 now parses to the Card Map hook; the Stardust and Dragonfang hollow assertions in the same case are unchanged; rename the case so it no longer says Put to the Torch is a hollow). Add an unseeded-member case: `[keyword:gain-wound-reward:bridge-conqueror:1]` on a synthetic line emits no descriptor and no `gain-wound-reward` keyword.
  - New `hero/gainWoundRewardConqueror.test.ts`, hooks from `buildHeroAbilityHooks` over the committed card data. Fixtures follow `hero/gainWoundRewardNonAttack.test.ts`: hero decks `anni/super-skrull` + `ca75/captain-america-falcon` (Flying Shield Block from the committed `ca75.json`), a synthetic `{ cardId: 'core/captain-america/diving-block#0', timing: 'onPlay', keywords: ['diving-block'] }` hook for Diving Block, and a non-empty Wound supply. Cases 3, 4 and 7 build the recipient's `playerZones` (without them `evaluateCondition` returns false and C2 passes for the wrong reason).
    1. Play with Bridge, Streets and Rooftops occupied → +2 at play, a `gain-wound-reward` choice whose option 0 label is the locked text, the N1 line.
    2. Gain with the Rooftops occupied → a Wound in the discard pile, Attack +4 (total 6), N4 then C1.
    3. Gain with the Rooftops empty → the Wound kept, no Attack, N4 then C2 `no Villain is in the Rooftops`.
    4. Gain in a 2-space City → the Wound kept, no Attack, C2 `there is no Rooftops in the City`.
    5. Decline → no Wound, no Attack, L3.
    6. Empty Wound supply → L2, no choice opened.
    7. Grant-time read: the Rooftops Villain is removed from `G.city` before the choice resolves (a direct test edit; real play cannot do this) → no Attack, C2.
    8. Diving Block in hand: gain, then reveal → no Attack, N8 with the locked log phrase; gain, then decline → N7 then C1.
    9. Flying Shield Block: the recipient's tagged decline label ends ` (then you get Rooftops Conqueror 4)`.
  - `simulation/ai.seatChoice.test.ts`, a new describe: gains when the Rooftops are occupied and +4 opens a fight; declines when the Rooftops are empty although +4 would open a fight; declines when occupied but +4 opens no fight; `G` deep-equal before and after (purity).
- **G) Records.** `docs/ai/coverage/live-verify.json`: a `pending` row `anni/super-skrull|gain-wound-reward`.
- **H) Feeds.** Regenerate `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json`; re-pin `apps/dashboard/src/composables/useInPlayCoverage.test.ts:749-751` to `totalObs` 8717, `resolvedObs` 1213, `percentResolved` 13.9 (observed), with a dated re-pin comment in the file's existing style. If the run reports other values, STOP and reconcile. `scripts/coverage/hero-effect-coverage.baseline.json` and `apps/dashboard/src/data/in-play-hollow-baseline.json` only if their gates flag.

## Out of Scope

- Villain-side Conqueror and Firelord line 0 (destroyed spaces): their own WPs (D-24837). This packet reads through `evaluateCondition`, so it inherits the Firelord change when that lands.
- Any other `<space>-conqueror` member: no other card prints a gain-a-Wound Conqueror reward. Duplicate-first; generalize only when a second card appears.
- A state-aware prompt label (e.g. "no Villain is in the Rooftops" on the option itself) and skipping the prompt when the Rooftops are empty (Settled Design Question 3).
- Stardust's Focus line and Dragonfang's Thrown Artifact line (their keywords' WPs).

## Files Expected to Change

- `packages/game-engine/src/types.ts` — modified (one union member)
- `packages/game-engine/src/rules/heroAbility.types.ts` — modified (comment only; contract file)
- `packages/game-engine/src/rules/heroKeywords.ts`, `packages/game-engine/src/hero/heroEffects.execute.ts` — modified (comment only)
- `packages/game-engine/src/setup/heroAbility.setup.ts` (+ `setup/heroAbility.setup.test.ts`) — modified
- `packages/game-engine/src/hero/gainWoundReward.logic.ts`, `hero/gainWoundRewardGrant.ts` — modified
- `packages/game-engine/src/hero/gainWoundRewardConqueror.test.ts` — **new**
- `packages/game-engine/src/simulation/ai.seatChoice.ts` (+ `simulation/ai.seatChoice.test.ts`) — modified
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `docs/ai/coverage/live-verify.json` — modified
- `data/cards/anni.json` — regenerated
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv`, `docs/ai/coverage/runtime-observed-hollows.json` — regenerated
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — modified (the in-play re-pin the scaffold showed)
- `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json` — only if their gates flag
- Governance (execution close): `docs/ai/DECISIONS.md` (D-24850 appended Active), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — modified

Eight engine source files (three comment-only), three engine test files (one new), one data input, one record, one dashboard pin; the rest is regenerated.

## Contract

- The Locked Values.
- `rewardComposition` names any `gain-wound-reward` reward that is not a `HeroKeyword`; a future non-keyword reward joins a seeded set and this field, not a new field.

## Vision Alignment

**Vision clauses touched:** §1 Rules Authenticity (a hollow line starts working), §22 Deterministic & Reproducible Evaluation, §23 / §24 (ranked fairness, replay-verified integrity), NG-1 (no pay-to-win; untouched).
**Conflict assertion:** No conflict: this WP preserves all touched clauses.
**Non-Goal proximity:** not crossed.
**Determinism (§22):** a pure read of `G.city` at grant time, no randomness; setup-level change, so stored matches replay identically.

## Funding Surface Gate

§20 **N/A**: a rules change on one hero card. Its only copy is a prompt label and log lines. No funding affordance or channel (WP-097 §A/§B/§C) is touched.

## API Catalog

§21 **N/A**: no `apps/server` HTTP endpoint added, changed or removed. No `Library-only` catalog function is touched: `docs/ai/REFERENCE/api-endpoints.md` lists none of the edited engine functions.

---

## Acceptance Criteria

1. Put to the Torch line 2 parses to the Card Map hook; lines 0 / 1 are unchanged; an unseeded `<space>-conqueror` member emits nothing (setup test).
2. Playing Put to the Torch opens the `gain-wound-reward` choice with the locked option 0 label and logs N1.
3. Gain with a Villain in the Rooftops → +4 Attack, N4 then C1; Rooftops empty or missing → no Attack, the Wound kept, C2 with the matching reason; decline → neither (L3); empty supply → L2, no prompt.
4. The condition is read at grant time (§Scope F case 7).
5. A Diving Block reveal forfeits the reward (N8); a decline grants it (N7 + C1); the Flying Shield Block tagged label carries the locked suffix.
6. The bot gains only with the Rooftops occupied and a fight the +4 newly enables; `G` is never written.
7. `data/cards` content diff = exactly Put to the Torch line 2; the ledger gains `anni/super-skrull|gain-wound-reward` = `executable` and no other row moves; `rooftops-conqueror` is absent from the runtime feed (the `EC-931:` body records its hitCount before → after).
8. `cards:check`, `cards:count-markers:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `registry:validate` and `ledger:numbers:check` exit 0.
9. `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/dashboard typecheck` → 0. Core `finalStateHash` and `PRE_WP080_HASH` unchanged. No `HERO_KEYWORDS` / handler count change; no `UIState` field.

## Verification Steps

1. `pnpm -r build` → 0.
2. Record the runtime hitCount: `node -e "const f=require('./docs/ai/coverage/runtime-observed-hollows.json');for(const m of Object.keys(f.byMechanic))if(/conqueror/.test(m))console.log(m,f.byMechanic[m].hitCount)"`. Baseline at `37a0abef0`: `rooftops-conqueror 7`.
3. Add the marker row, then `node scripts/convert-cards/apply-hero-ability-markers.mjs` (expect `Updated: 1 lines`), re-run (expect 0), `node scripts/convert-cards/apply-hero-ability-markers.mjs --validate` → 0. `git diff --stat -- data/cards` → `anni.json` only.
4. After the engine edits: `pnpm -r build && pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata && pnpm sim:runtime-observed`; then `pnpm sim:coverage --check`; then `pnpm --filter @legendary-arena/dashboard prebuild:coverage` and expect the in-play pins at 8717 / 1213 / 13.9 and re-pin them; STOP on any other value. Re-run step 2 (expect no `rooftops-conqueror`).
5. `pnpm cards:check && pnpm cards:count-markers:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check && pnpm registry:validate && pnpm ledger:numbers:check` → all 0.
6. `pnpm --filter @legendary-arena/game-engine test` → 0 fail (7037 at the baseline plus the new cases); `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/dashboard typecheck` → 0.
7. Ledger spot check: `node -e "const l=require('./docs/ai/coverage/hero-mechanic-ledger.json');for(const m of ['gain-wound-reward','conqueror']){const r=l.rows.find(x=>x.extId==='anni/super-skrull'&&x.mechanic===m);console.log(m,r&&r.status)}"` → `executable`, `condition`.
8. `git diff --name-only` ⊆ Files Expected to Change; revert any `lagn-v1.json` or other EOL-only churn.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24850 Active. It records: the member `rooftops-conqueror` and why the space lives in the member (D-24834 §11); `rewardComposition` widened to "any non-`HeroKeyword` reward" and the rejected alternatives (a new descriptor field, a `HeroKeyword`); the marker and the parse (no pre-scan change, why no hollow); the phrases, C1 / C2; the grant-time read and why it equals play time; reading through `evaluateCondition` so the Firelord follow-up carries over; the prompt opening with the Rooftops empty (L3199-3201); the bot answer; the D-24834 §8 revisit (moot for this card, rule unchanged); the one migrated setup-test case; `heroConqueror.test.ts:189-205` passing unedited only because its fixture's Wound supply is empty (L2), so its message "the Wound line never grants Rooftops Conqueror 4" is stale (accepted; Scope F case 1 covers +2 at play); the accepted bot gap (on another seat's tagged Flying Shield Block entry the bot declines to keep a reward it could see is worthless with the Rooftops empty; D-24834 §7's rule unchanged); the label choice (the printed keyword); the replay note; the dashboard re-pin. **Amends** D-24836 §2 / §12, D-24837 §5 / §11(a), D-24834 §8 / §11 (says so in its heading).
- [ ] STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `pnpm roadmap:counts:write` then `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-931:` then `SPEC:`).
- [ ] **D-24026 live-verify (post-merge):** on an operator match created after the deploy with Super-Skrull: Put to the Torch with a Villain in the Rooftops prompts "Gain a Wound?"; gain → a Wound and +4 Attack (C1); decline → neither; with the Rooftops empty, gain → the Wound and "got no Attack — no Villain is in the Rooftops". Recorded as a STATUS flip and the `live-verify.json` row.

## Reserved Decision (lands at execution)

**D-24850 — put-to-the-torch-conqueror-reward.** It locks everything in the DoD item above. Reserved in NUMBER-LEDGER (#3344); written Active in the execution `SPEC:` close.

## Settled Design Questions (drafting decisions, 2026-11-13)

1. **The City space lives in the member** (`'rooftops-conqueror'`), not a field. D-24834 §11 and D-24836 §1 say rewards extend `GainWoundReward` by members and arms, never fields. Only one card prints a gain-a-Wound Conqueror reward, so one member is enough (duplicate-first); a second card would add its own member. Rejected: amending §11 to add a `citySpace` field (a carrier change on three entry types for one card); a generic `conqueror` member with the space parsed out of a string (a stringly-typed sub-format).
2. **The descriptor carries it in `rewardComposition`.** `rooftops-conqueror` is not a `HeroKeyword`, so it cannot travel in `rewardType` (Step 2g requires `isValidHeroKeyword`, and the descriptor's `rewardType` is typed `HeroKeyword`). Rejected: a new `HeroKeyword` (moves the 101 / 80 pins and adds a handler for a reward that is not a play effect, against D-24031's reasoning); a new descriptor field (a second "non-keyword reward" field beside `rewardComposition`, one more contract change and one more trace copy). Chosen: widen `rewardComposition`'s documented meaning from "a composition marker" to "a reward that is not a `HeroKeyword`"; its type is already `string`, the trace already copies it, and the handler already passes it to the builder. A comment-only contract change, recorded in D-24850.
3. **The prompt always opens; the label is static.** Gaining a Wound is always a legal option, so the prompt opens even with the Rooftops empty (L3199-3201 bars options you cannot do, not options with no payoff). The label names the printed keyword ("you get Rooftops Conqueror 4"); C1 / C2 spell out the +4 and the reason, and the bot declines when the Rooftops are empty. Rejected wordings: "+4 Attack with a Villain in the Rooftops" (reads like a restricted-Attack clause, copilot mode 26) and "+4 Attack if a Villain is in the Rooftops" (N5 becomes "… if … if they keep it"). Rejected designs: skipping the prompt on an empty Rooftops (denies a legal choice and splits the read between play and grant); a state-aware label (the phrase helper is shared by the N5 / N6 / N8 lines and the interception suffixes, which must stay stable across waves).
4. **Grant-time read.** The bonus is checked when the kept Wound is granted, through `evaluateCondition`. The board is frozen from the prompt through every interception wave, so this equals the play-time read rules v23 L1157-1159 implies (D-24837 SDQ 1), and the Firelord follow-up's destroyed-space change applies here for free. Rejected: snapshotting the condition at play time into the reward (a field, against SDQ 1).
5. **D-24834 §8 is moot for this card's own hooks.** The Wound line is the card's last line, so no later hook of the card runs before the prompt resolves. Other cards' hooks can still run after it parks (Steal Abilities re-fires several stolen cards in a loop, `heroEffects.execute.ts:6107`), but none writes `G.city`, so the grant-time read is unaffected. The general rule (parking does not halt the hook loop) is unchanged.

---

## Lint Gate Self-Review (00.3)

Independent subagent run (2026-11-13). **Run 1: FAIL** on three text-only items, fixed in this revision:
- §4: Context gained `00.2-data-requirements.md` §5 / §5.1 (the `[keyword:X]` token) and `03-DATA-PIPELINE.md` §1.
- §15.2: the WP Risk Tier line is now byte-identical to the EC's.
- EC-TEMPLATE: the EC Locked Values now copy the WP verbatim (the full `new Set<string>([...])`, the builder conditions spelled with `rewardComposition`, the full `G.turnEconomy = addResources(...)` expression).

Advisories applied: `registry:validate` in AC8, Verification Step 5 and the EC gate list; the WORK_INDEX row spacing; a full path for `heroEffects.execute.ts`; "checked off with date" in the EC; the EC_INDEX description matches the "Rooftops Conqueror 4" wording.

**Run 2: PASS** (2026-11-13), after the copilot round-1 edits.

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
| §10 Env vars | N/A: the change introduces and reads no env var |
| §11 Auth | N/A: no auth surface |
| §12 Tests | PASS |
| §13 Verification | PASS |
| §14 ACs | PASS (9 items) |
| §15 / §15.1 | PASS |
| §15.2 Risk tier | PASS (after fix) |
| §16 Code style | PASS |
| §17 Vision | PASS |
| §18 Prose-vs-grep | N/A: no forbidden-token grep step |
| §19 Bridge-vs-HEAD | N/A: commit-time rule |
| §20 Funding | N/A, justified |
| §21 API catalog | N/A, justified |
| EC-TEMPLATE | PASS (EC 49 content lines) |

## Gate Record

**Pre-flight (01.4), independent subagent.** Round 1: **READY TO EXECUTE**, no PS items. The agent prototyped the whole engine change in a throwaway worktree (marker, member, both sets, Step 2g arm, builder, phrase + grant arm, bot case) and reproduced every scaffold number: `Updated: 1 lines` / re-run 0 / `--validate` clean; the parse probe; engine 7037 run, 7036 pass, the one failure the `:2773` hollow case (`heroConqueror.test.ts`, sentinel, hash and PAR tests pass unedited); ledger +1 row only; runtime feed 7352 → 7345 observations, `rooftops-conqueror` 7 → absent; dashboard 8717 / 1213 / 13.9 re-pinned → 621 / 621; six data gates 0; arena-client 2638 / 0. Verified: Step 2g ordering and the D-24623 fallback; no pre-scan interaction; `heroConditions.evaluate.ts`'s 11-module runtime closure reaches no forbidden module; every `rewardType` reader is covered (`grantGainWoundReward`'s switch is not exhaustive, so a missing case would silently no-op: the grant tests catch it); the board-frozen claim (`hasPendingSeatChoice` guards every action move; the interception reveals never write `G.city`); dependencies `[x]`. RS applied: the four stale comments the change makes false are now comment-only edits in scope (Assumes 13; adds `heroKeywords.ts` and `heroEffects.execute.ts` to the allowlist as comment-only); the bot's two imports; the builder's `:271` early return restructure; `percentResolved` locked at 13.9; the `:152` anchor; the file count. Round 2 (re-read of the edited WP + EC): **READY TO EXECUTE**, no PS items; it confirmed every Assumes 13 anchor, one file set across Scope / Files / EC, the "comment-only" vs "Not touched" wording, and that no script or test reads either comment-only file's source. Cosmetic RS applied without a re-run: Assumes 12 / 13 order; Verification Step 4 now matches the 8717 / 1213 / 13.9 lock; the EC notes `heroKeywords.ts:125` is a trailing comment on a code line; Assumes 7 says "no code change".

**Copilot (01.7), independent subagent.** Round 1: **RISK → HOLD**, seven scope-neutral findings, all applied:
- **Mode 26:** "+4 Attack with a Villain in the Rooftops" reads like a restricted-Attack clause; the label / log phrase is now the printed keyword "Rooftops Conqueror {N}" (C1 / C2 spell out the +N and the reason). SDQ 3 records both rejected wordings.
- **Mode 11:** `heroConqueror.test.ts:189-205` passes only because its Wound supply is empty, so its message goes stale; accepted and recorded in the D-24850 DoD item (Scope F case 1 covers +2 at play).
- **Modes 11 / 26:** Scope F names the `gainWoundRewardNonAttack.test.ts` fixtures (synthetic Diving Block hook, `ca75/captain-america-falcon` for Flying Shield Block, a non-empty Wound supply) and requires the recipient's `playerZones` in the grant cases.
- **Mode 20:** D-24850 states it amends D-24836 §2 / §12, D-24837 §5 / §11(a), D-24834 §8 / §11; SDQ 5 is scoped to this card's own hooks (Steal Abilities can run other cards' hooks after the park; none writes `G.city`).
- **Modes 22 / 14:** a `never` exhaustiveness guard on the grant `switch`; the EC smell no longer claims every switch fails to compile.
- **Mode 26:** the bot's Flying Shield Block decline on a worthless (Rooftops-empty) tagged reward is an accepted gap recorded in D-24850.
- **Mode 30:** the lint gate ran (below).
Verified by the agent: the three `rewardComposition` readers (builder, trace, handler; no script, client or server reads it; display layers drop the marker); the bot's other false paths only decline; the board-frozen claim (`dropUninterceptableWounds` runs inside the same move's `onMove`); the 11-module import closure; determinism, aliasing and replay; every substituted N-line reads grammatically. Round 2: **PASS — CONFIRM**, no new findings; the new phrase substituted into option 0, N1 / N5 / N6 / N8 and both suffixes reads cleanly (no "if … if", no restricted-Attack reading); the `never` guard compiles under the engine tsconfig (the `const x: never` pattern already appears in five engine files). Pre-flight not re-run: no scope or allowlist change after round 2.
