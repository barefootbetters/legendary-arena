# WP-883 — "You may gain a Wound. If you do, you get +N Attack": an optional gain-a-Wound reward keyword (Game Engine + Card Data + arena-client heading)

**Status:** Draft 2026-11-11
**Primary Layer:** Game Engine (new hero keyword + handler, one seat-choice kind, Diving Block / Flying Shield Block keep-or-forfeit of the reward, bot answers) + Card Data (two markers) + arena-client (one prompt heading)
**Dependencies (all ✅):**
- WP-382 / D-24183 (`ko-wound-reward`: the three-segment `<keyword>:<reward>:<n>` marker, the reward-icon suppression and the seeded reward set this packet mirrors)
- WP-684 / D-24501 (`G.pendingSeatChoice`, `resolveSeatChoice`, the generic client prompt) and WP-683 / D-24500 (`random-acts-wound`: an active-scoped optional gain-a-Wound seat choice parked from a hero handler)
- WP-682 / D-24499, D-24651, D-24673 (Diving Block at the `gainWoundForPlayer` chokepoint, `gainWoundWithOutcome`) and WP-827 / D-24760 (Flying Shield Block)
- WP-765 / D-24598 (Sunlight gate, `DAY_NIGHT_UNMODELED_LINES`) and WP-767 / D-24600 (the precedent for a line leaving that list)
- WP-845 / D-24779 (a player cannot choose to gain a Wound the supply does not have, rules v23 L3199-3201), WP-865 / D-24808 (`woundsDrawn` bumps when a Wound lands), D-24744 / D-24745 (bot-ally answers vs the absent-seat default), WP-876 / D-24823 (the newest seat-choice kind + client heading precedent)

**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM — gameplay rules (a new hero keyword, one seat-choice kind, a reward that follows Diving Block / Flying Shield Block outcomes) plus card data, derived feeds and one client heading; no auth, money, persistence or server surface
**Lane:** Standard (two-session). Engine + card data + one client line; a new `HeroKeyword` with its six lockstep sites; not lightweight-eligible (new keyword, behavior change on two ranked-reachable cards, > 4 code/test files).

> Baseline: `origin/main` at `d13a6252` (the reserve, #3278). Engine suite at the reserve: **6884 / 6884 pass** (`pnpm --filter @legendary-arena/game-engine test`, observed at draft).

---

## Goal

Two hero lines print the same optional trade:

| Card | Line | Gate |
|---|---|---|
| `mdns/morbius/scalded-by-sunlight` ability 0 | "[keyword:Sunlight]: You may gain a Wound. If you do, you get +2[icon:attack]." | Sunlight in effect |
| `co2e/hulk/hulk-smash` ability 0 | "[hc:strength]: You may gain a Wound. If you do, you get +5[icon:attack]." | another Strength Hero played |

**Today** (parser probe at the baseline, `buildHeroAbilityHooks` over the committed card data):
- **Hulk Smash! over-grants.** It parses to `{ conditions: [heroClassMatch strength], effects: [{ type: 'attack', magnitude: 5 }] }`: a free +5 Attack whenever its Strength gate passes, with no Wound gained and no choice offered.
- **Scalded by Sunlight's Sunlight line is hollow.** It is on `DAY_NIGHT_UNMODELED_LINES`: it keeps the Sunlight gate, drops the +2, and records a `sunlight` `parse-unrecognized` hollow on every Sunlight play.

**After this session:**
1. A new hero keyword **`gain-wound-reward`** (marker `[keyword:gain-wound-reward:attack:N]`) parks an **active-player seat choice**: "Gain a Wound: you get +N Attack" or "Don't gain a Wound" (default: don't).
2. Gaining goes through the Wound chokepoint (`gainWoundWithOutcome`), so Diving Block and Flying Shield Block are offered exactly as for every other Wound.
3. **"If you do" is honest.** The +N is granted only when the Wound is actually gained and kept: no prompt and no +N on an empty Wound supply; no +N if Diving Block or Flying Shield Block prevents that Wound.
4. Both lines keep their printed gate (Sunlight / `[hc:strength]`). Hulk Smash!'s free +5 stops.
5. A bot ally answers the prompt like a playing seat; autoplay, the simulation runner and PAR stay on the default (decline), per D-24745.

## User-Visible Impact

- Playing Hulk Smash! after another Strength Hero asks "Gain a Wound for extra Attack?". Gain → a Wound goes to the discard pile and +5 Attack; decline → nothing. It no longer gives +5 for free.
- Playing Scalded by Sunlight while Sunlight is in effect asks the same, for +2. The `sunlight` hollow stops appearing for it.
- With Captain America's Diving Block in hand (or played), choosing to gain still offers the reveal. Revealing draws a card instead and the log says no Attack was gained. Taking the Wound grants the Attack.
- With an empty Wound supply, the card logs that it did nothing; no prompt opens.

---

## Assumes

1. **Parser** (`packages/game-engine/src/setup/heroAbility.setup.ts`, at the baseline):
   - `KO_WOUND_REWARD_PATTERN` `:322` (three segments, so `KEYWORD_PATTERN` never matches it and it never reaches the unresolved-marker scan); `KO_WOUND_REWARD_SEEDED_REWARDS` `:480`; Step 2f extraction `:2240-2258`; the reward-icon suppression `:2591-2611` (D-24570); the descriptor builder arm `:2812-2820`.
   - `DAY_NIGHT_UNMODELED_LINES` `:968-979` holds `'mdns/morbius/scalded-by-sunlight:sunlight'` `:972` (eight entries; the comment `:969-970` says "eight entries remain"); `isDayNightUnmodeledLine` `:4660`.
   - Probe output (verbatim shape): Hulk Smash! → one hook, `keywords: ['attack','conditional']`, `conditions: [{type:'heroClassMatch',value:'strength'}]`, `effects: [{type:'attack',magnitude:5}]`. Scalded by Sunlight → hook 0 `conditions: [{type:'sunlightInEffect',value:''}]`, no effects, `unresolvedMarkers: ['sunlight']`; hook 1 the Moonlight `ko-wound-reward` attack 2.
2. **Keyword lockstep** (memory `reference_hero_keyword_lockstep_sites`): `rules/heroKeywords.ts` union `:26` + `HERO_KEYWORDS` `:133` (98 entries); pins `rules/heroKeywords.test.ts:70-73` (98) and `rules/heroAbility.setup.test.ts:601` `expectedKeywords` + `:703` (98); `hero/heroEffects.execute.ts` `HANDLED_KEYWORDS` `:165`, `KO_WOUND_REWARD_SEEDED_REWARDS` `:573`, `NO_MAGNITUDE_KEYWORDS` `:588`, `HERO_EFFECT_HANDLERS` `:7565` (77 handlers); handler-count pins `hero/heroEffects.execute.test.ts:156` and `:8126` (77). `MVP_KEYWORDS` derives from `HANDLED_KEYWORDS`; `scripts/hero-mechanic-ledger.mjs` and `scripts/hero-effect-coverage.mjs` read it from the engine `dist`.
3. **Handlers to mirror** (`hero/heroEffects.execute.ts`): `heroEffectRandomActs` `:4611` parks an active-scoped seat choice with `parkSeatChoice(G, undefined, …)` and logs the park; `heroEffectKoWoundReward` `:4938`; `heroEffectGainWound` `:2138` bumps `G.turnEconomy.woundsDrawn` for the playing seat and logs "would gain" while a Diving Block reveal is pending (D-24673).
4. **Wound chokepoint** (`board/wounds.logic.ts`): `gainWoundForPlayer` `:71` lands the Wound in the discard pile, then parks a Diving Block entry (`checkDivingBlock`) or, if none, a Flying Shield Block entry (`checkFlyingShieldBlock`). `gainWoundWithOutcome` `:125` returns `'no-wound' | 'gained' | 'diving-block-pending'`; **it reports `'gained'` even when a Flying Shield Block entry was parked.**
5. **Interceptions:**
   - `moves/divingBlock.logic.ts`: `checkDivingBlock` `:186` pushes `{ playerID, woundCardId }`; `applyDivingBlockResolvedSeatChoice` `:310` resolves each seat's front entry (reveal → `applyDivingBlockReveal` `:360`; decline → `checkFlyingShieldBlock(G, seat, woundCardId)`, which returns whether it parked).
   - `moves/flyingShieldBlock.logic.ts`: `checkFlyingShieldBlock` `:154` pushes `{ recipientID, woundCardId, candidateSeats }`; `dropUninterceptableWounds` `:196` (the recipient keeps the Wound); `applyFlyingShieldBlockResolvedSeatChoice` `:301`, `applyFlyingShieldBlockDecline` `:340` (returns true when no candidate is left: the recipient keeps it), `applyFlyingShieldBlockReveal` `:368`.
   - Waves open in the play-phase `onMove` after the move that dealt the Wound, and the board is frozen (block-all) until they resolve, so a deferred grant cannot be spent early. `endgame/mastermindVictory.logic.ts:95,102` drops both queues at game end.
6. **Seat choice:** `types.ts` `PendingSeatChoice` `:1543` (consumer-specific optional fields such as `sizeChangingGrant`, never projected), `PendingDivingBlockWound` `:1788`, `PendingFlyingShieldBlockWound` `:1805`. `moves/seatChoice.resolve.ts` `parkSeatChoice` `:374`, `resolveSeatChoice` `:442`, `applySeatChoiceByKind` `:600` (the WP-876 heist-shuffle dispatch arm `:784` is the newest). `getLegalMoves` offers an addressed seat one `resolveSeatChoice` at `defaultOptionIndex`; the bot ally uses `simulation/ai.seatChoice.ts` `chooseByKind` `:110` (Diving Block → reveal `:116`, Flying Shield Block → reveal `:121`; `readFightableCityIndices` `:255` reads `getLegalMoves` with the open choice set aside).
7. **Client:** `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` renders any kind's projected option labels and keys a heading on `kind` (`heading()` `:88`, fallback "Your choice"). Engine-only `[keyword:…:…]` markers are hidden by `lib/abilityMarkers.ts` (any colon token).
8. **Markers.** `scripts/convert-cards/apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN` `:151-152` has no `gain-wound-reward` form (error-message list `:362-380`). `inputs/hero-ability-markers.json` has `co2e` (`:234`) and `mdns` (`:2231`; Scalded by Sunlight ability 1 at `:2286-2291`) sections; co2e Crazed Rampage's marker comes from this map, so `co2e.json` (hand-authored) takes map markers too.
9. **Corpus.** Exactly two hero lines read "You may gain a Wound. If you do, you get +N[icon:attack]" (grep over `data/cards/*.json` at the baseline). The other "may gain a Wound. If you do" lines have non-attack rewards (§Out of Scope).
10. **No consumer of these hooks' effect shape** beyond the executor: no committed fixture, PAR scenario, sentinel or test plays `co2e/hulk` or `mdns/morbius` Scalded by Sunlight's Sunlight line except `setup/heroAbility.setup.test.ts:1857` ("Scalded by Sunlight: the Sunlight line is an honest hollow"), which migrates in scope. `mdns/morbius` is in the `sim:runtime-observed` sweep; `co2e` is not.
11. `pnpm -r build` exits 0 and the suites are green at the baseline.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` L3190-3201 ("Revealing a Card": a player may decline to reveal and take the Wound; "you can't choose an option that you can't do").
- `docs/ai/DECISIONS.md`: D-24183 (ko-wound-reward), D-24570 (reward-icon suppression), D-24598 / D-24600 (day/night and leaving the unmodelled list), D-24499 / D-24651 / D-24673 / D-24678 (Diving Block), D-24760 (Flying Shield Block), D-24500 / D-24501 (seat choices), D-24779 (empty Wound supply), D-24808 (`woundsDrawn`), D-24744 / D-24745 (bot answers), D-24156 (plain gain-a-Wound keywords; a slug-word near-match, different mechanic). D-24834 is reserved.
- User memory: `reference_hero_keyword_lockstep_sites` (all six sites apply), `feedback_ec_locked_value_stale_baseline` (read the count pins at execution), `reference_setup_hook_change_replay_compat`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_interactive_choice_active_player_only`, `reference_engine_tests_never_typechecked`.
- **Why a prompt, not auto-resolve.** `ko-wound-reward` auto-resolves because KOing a Wound is always good (D-24183). Here the cost is a dead card added to the deck for the rest of the game. That is a real trade (+5 now vs a weaker deck), so the player must be able to decline.
- **Why the seat choice, not a new pending queue.** `G.pendingSeatChoice` already gives a resolve move (`resolveSeatChoice`), a projection, a generic client prompt, the block-all guard, the disconnect default and the bot hook. A dedicated `Pending*` queue (the `optional-ko-reward` shape) would add a move, a UIState field (the five-step contract) and a client component. Random Acts (D-24500) parks the same kind of active-scoped optional gain-a-Wound choice from a hero handler.
- **Why the chokepoint, and why the reward follows the interception.** D-24678 kept Random Acts off the chokepoint only because its Wound goes to the **hand** and races the pass-left that follows. This Wound goes to the discard pile like any other, so `gainWoundWithOutcome` applies and Diving Block / Flying Shield Block are offered with no special case. Both print "… **instead**": a revealed Wound was never gained, so "If you do" fails. Because the Wound lands first and the reveal resolves in a later wave, the +N is held on the interception entry and granted only when the Wound is kept. Granting it at land would let a player choose "gain", reveal Diving Block, and keep +N plus a card with no Wound.
- **Parallel work.** WP-882 (Zarathos, drafting on another branch) also edits `simulation/ai.seatChoice.ts` and `moves/seatChoice.resolve.ts`. Both changes are additive dispatch arms; on rebase keep both.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file; no diffs, no snippets.
- ESM only, Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (full-word names, JSDoc, no nested ternaries, functions ~30 lines).
- Moves and effects never throw. No randomness, no clock. Files limited to §Files Expected to Change.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24834) before coding. One WP per session.

**Packet-specific:**

- **Keyword.** `HeroKeyword` `'gain-wound-reward'`, appended last to the union and `HERO_KEYWORDS`. It carries the reward magnitude, so it is **not** in `NO_MAGNITUDE_KEYWORDS` (the `ko-wound-reward` posture). It joins `HANDLED_KEYWORDS` and `HERO_EFFECT_HANDLERS`. All six lockstep sites (Assumes 2) move together; read the current pin values at execution (98 → 99 keywords, 77 → 78 handlers at the baseline).
- **Marker + parser.**
  - Token `[keyword:gain-wound-reward:<reward>:<n>]`; `GAIN_WOUND_REWARD_PATTERN = /\[keyword:gain-wound-reward:([a-z][a-z-]*):(\d+)\]/g`.
  - Seeded rewards `GAIN_WOUND_REWARD_SEEDED_REWARDS = { 'attack' }`, two copies (parser and the new logic module, duplicate-first, like `KO_WOUND_REWARD_SEEDED_REWARDS`).
  - A new Step 2f-bis (beside Step 2f) emits the keyword with `magnitudes` / `rewardTypes` only when the reward is seeded and `n >= 1`. An unseeded reward emits nothing (Honest-Partial).
  - The descriptor builder emits `{ type: 'gain-wound-reward', magnitude: n, rewardType: 'attack' }`.
  - **Reward-icon suppression** (D-24570 sibling): drop the plain keyword matching the reward type and its magnitude, so Hulk Smash!'s printed `+5[icon:attack]` is no longer granted unconditionally.
  - Remove `'mdns/morbius/scalded-by-sunlight:sunlight'` from `DAY_NIGHT_UNMODELED_LINES` (seven entries remain; update the `:969-970` comment). The Sunlight gate and the Strength gate are kept by the existing parse; no other parser change.
- **Validator.** `apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN` gains `^\[keyword:gain-wound-reward:[a-z][a-z-]*:[1-9]\d*\]$` (with a `// why:` line and the token added to the error-message list).
- **Handler `heroEffectGainWoundReward`** (in `hero/heroEffects.execute.ts`, registered under `'gain-wound-reward'`). In order:
  1. An unseeded `rewardType`, or a magnitude < 1 → a logged skip.
  2. `G.piles.wounds` empty → no prompt; log line L2.
  3. `G.pendingSeatChoice` already open → no prompt; log line L9 (defensive; neither card can reach it).
  4. Otherwise park `buildGainWoundRewardChoice(playerID, magnitude, cardId)` with `parkSeatChoice(G, undefined, …)` (active-scoped, no stage ride) and log L1.
- **New module `hero/gainWoundReward.logic.ts`.** No boardgame.io import and no `heroEffects.execute.ts` import (the `hero/heistPayloads.logic.ts` posture).
  - **Constants:** `GAIN_WOUND_REWARD_SEAT_CHOICE_KIND = 'gain-wound-reward'`, `GAIN_WOUND_REWARD_GAIN_OPTION_INDEX = 0`, `GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX = 1`.
  - **Builder:** one addressed seat (the player). Options `[{ label: 'Gain a Wound: you get +N Attack' }, { label: "Don't gain a Wound" }]`, `defaultOptionIndex` = decline. The choice carries `gainWoundReward: { attack: N, sourceCardId }`.
  - **Apply `applyGainWoundRewardSeatChoice(G, choice)`.**
    - Decline → log L3.
    - Gain → record the Flying Shield Block queue length, then call `gainWoundWithOutcome(G, seat)`.
    - `'no-wound'` → log L6; no reward.
    - Otherwise the Wound landed: `G.turnEconomy.woundsDrawn += 1` (the WP-865 convention).
    - `'diving-block-pending'` → set `woundAttackReward` on the seat's **last** `G.pendingDivingBlockWounds` entry; log L5.
    - `'gained'` and the Flying Shield Block queue grew → set it on the **last** `G.pendingFlyingShieldBlockWounds` entry; log L5.
    - Else → grant now (L4).
  - **Grant helper:** `grantGainWoundAttackReward(G, recipientID, reward, isAfterInterception)` does `G.turnEconomy = addResources(G.turnEconomy, reward.attack, 0)` and logs L4 (now) or L7 (after an interception was declined). The recipient is always the player who played the card, the active player, whose `turnEconomy` this is.
- **Types (`types.ts`).** One interface `GainWoundAttackReward { attack: number; sourceCardId: CardExtId }`, used by three new optional fields, all absent unless this keyword set them:
  - `PendingSeatChoice.gainWoundReward?`
  - `PendingDivingBlockWound.woundAttackReward?`
  - `PendingFlyingShieldBlockWound.woundAttackReward?`

  None is projected to the client (the `sizeChangingGrant` posture). No UIState field, so the five-step contract does not apply.
- **Keep or forfeit (the "If you do" rule):**
  - `divingBlock.logic.ts` reveal of a tagged entry → log L8, no grant.
  - Decline → if `checkFlyingShieldBlock` parked, move the tag onto the new last Flying Shield Block entry; else grant (L7).
  - `flyingShieldBlock.logic.ts` reveal of a tagged entry → log L8.
  - The final decline (`applyFlyingShieldBlockDecline` returns true) and `dropUninterceptableWounds` → grant (L7).
  - Untagged entries behave exactly as today.
- **Dispatch.** `applySeatChoiceByKind` gains a `GAIN_WOUND_REWARD_SEAT_CHOICE_KIND` arm before the `applySeatChoiceCard` fall-through. The disconnect / timeout default resolves to decline.
- **Bot answers (`simulation/ai.seatChoice.ts`, playing seat only).**
  - `gain-wound-reward`: gain iff the reward newly enables a fight. Count the `fightVillain` + `fightMastermind` moves `getLegalMoves` offers the seat on G with the open choice set aside, then the same with `turnEconomy` raised by `addResources(…, attack, 0)`. Gain when the second count is larger; else decline.
  - `diving-block` / `flying-shield-block`: **decline** when the entry the seat is answering carries `woundAttackReward` (the Wound was taken on purpose); otherwise reveal, as today.
  - Autoplay, the simulation runner and PAR keep `defaultOptionIndex` (D-24745).
- **Client.** `PendingSeatChoicePrompt.vue` `heading()` gains `case 'gain-wound-reward': return 'Gain a Wound for extra Attack?';` (the WP-876 precedent). The options come from the projection; no other client change.
- **Log lines** (each ends with the card reference `formatCardRef(G.cardDisplayData, sourceCardId)` in parentheses; outcomes in brackets):
  - L1 `Player {p} may gain a Wound for +{N} Attack ({card}).` [neutral]
  - L2 `Player {p}'s {card} did nothing — the Wound supply is empty.` [blocked]
  - L3 `Player {p} chose not to gain a Wound ({card}).` [neutral]
  - L4 `Player {p} gained a Wound and got +{N} Attack ({card}).` [applied]
  - L5 `Player {p} would gain a Wound — +{N} Attack if they keep it ({card}).` [neutral]
  - L6 `Player {p} could not gain a Wound — the Wound supply is empty, so no Attack ({card}).` [blocked]
  - L7 `Player {p} kept the Wound and got +{N} Attack ({card}).` [applied]
  - L8 `Player {p}'s Wound was prevented, so no +{N} Attack ({card}).` [blocked]
  - L9 `Player {p}'s {card} could not offer its Wound choice — another choice is open.` [blocked]
- **Not touched:** `game.ts`, `index.ts`, any move registration, UIState / the audience filter, `ko-wound-reward`, `random-acts`, the Diving Block / Flying Shield Block behavior for untagged Wounds, and the four other "may gain a Wound. If you do" lines.
- **Determinism / replay.** Setup output plus code paths only the new hooks reach. Pre-deploy match blobs keep their stored `G.heroAbilityHooks` (Hulk Smash!'s +5 hook) and replay identically (memory `reference_setup_hook_change_replay_compat`). The new optional fields exist only in matches that play these cards. No new top-level `G` field, no randomness, `G.messages` hash-excluded (D-24081). The core sentinel `finalStateHash` and `PRE_WP080_HASH` are expected unchanged; confirm by running them.

## Card Map (locked)

| Set / hero / card | Ability | Marker | Gate kept |
|---|---|---|---|
| `co2e/hulk/hulk-smash` | 0 | `[keyword:gain-wound-reward:attack:5]` | `[hc:strength]` (`heroClassMatch`) |
| `mdns/morbius/scalded-by-sunlight` | 0 | `[keyword:gain-wound-reward:attack:2]` | `[keyword:Sunlight]` (`sunlightInEffect`) |

## Locked Values

- `HeroKeyword` `'gain-wound-reward'` (appended last); marker `[keyword:gain-wound-reward:<reward>:<n>]`; `GAIN_WOUND_REWARD_PATTERN`; seeded `{ 'attack' }`; not in `NO_MAGNITUDE_KEYWORDS`.
- Kind `'gain-wound-reward'`; options index 0 gain / 1 decline; default 1; labels and heading verbatim as above.
- `GainWoundAttackReward { attack; sourceCardId }` and the three optional field names.
- Log lines L1-L9 verbatim.
- The keep-or-forfeit rule and the three bot answers.
- The two §Card Map tokens; `DAY_NIGHT_UNMODELED_LINES` drops exactly one entry (8 → 7).

---

## Scope (In)

- **A) Keyword lockstep.** `rules/heroKeywords.ts`; `hero/heroEffects.execute.ts` (`HANDLED_KEYWORDS`, `HERO_EFFECT_HANDLERS`, `heroEffectGainWoundReward`); pins in `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`.
- **B) Parser.** `setup/heroAbility.setup.ts`: pattern, seeded set, Step 2f-bis, descriptor arm, reward-icon suppression, `DAY_NIGHT_UNMODELED_LINES` removal.
- **C) Choice + reward.** New `hero/gainWoundReward.logic.ts`; `types.ts` (interface + three optional fields); `moves/seatChoice.resolve.ts` dispatch arm; `moves/divingBlock.logic.ts` and `moves/flyingShieldBlock.logic.ts` keep-or-forfeit.
- **D) Bots.** `simulation/ai.seatChoice.ts` (three answers).
- **E) Client.** `PendingSeatChoicePrompt.vue` heading case (+ a test case in `PendingSeatChoicePrompt.test.ts`).
- **F) Markers + data.** `apply-hero-ability-markers.mjs` validator; `inputs/hero-ability-markers.json` two rows; regenerate `data/cards/co2e.json`, `data/cards/mdns.json` through the script.
- **G) Tests.**
  - `setup/heroAbility.setup.test.ts`: **migrate** the `:1857` Scalded by Sunlight case. The fixture line takes the marker, and hook 0 becomes `conditions [sunlightInEffect]`, `effects [{gain-wound-reward, 2, attack}]`, no `unresolvedMarkers`. This is an intentional behavior change (D-24834). Add a Hulk Smash! case: `[heroClassMatch strength]`, `effects [{gain-wound-reward, 5, attack}]`, no plain `attack`. Add an unseeded-reward case: `[keyword:gain-wound-reward:draw:1]` emits no descriptor.
  - New `hero/gainWoundReward.test.ts`, hooks built by `buildHeroAbilityHooks` from the regenerated `data/cards/co2e.json` / `mdns.json` (never hand-written):
    - Hulk Smash! with a Strength Hero played parks the prompt (L1), and without one parks nothing.
    - Gain → one Wound in discard, supply −1, attack +5, `woundsDrawn` +1, L4. Decline → nothing changes but L3.
    - Empty supply → no prompt, L2. Supply emptied after the park → L6, no Attack.
    - Diving Block in hand → gain parks a tagged Diving Block entry and no Attack yet (L5). Reveal → Wound back in the supply, a card drawn, no Attack, L8. Decline → +5, L7.
    - Flying Shield Block held by the other seat → a tagged entry. Reveal → no Attack, L8. Decline → +5, L7.
    - A declined Diving Block that parks Flying Shield Block carries the tag over.
    - A Wound from any other source (Master Strike via `gainWoundWithOutcome`) is untagged and unchanged.
    - Scalded by Sunlight: prompt under Sunlight (gain → +2), nothing under Moonlight's Sunlight line, and Moonlight still runs `ko-wound-reward`.
    - A pre-opened seat choice → L9, the open choice untouched.
  - `simulation/ai.seatChoice.test.ts`:
    - Gain when +N reaches a City Villain's fight cost; decline when it reaches nothing new.
    - Diving Block and Flying Shield Block decline on a tagged entry and still reveal on an untagged one.
- **H) Ledger + records.** `scripts/coverage/mechanic-provenance.json` row `gain-wound-reward → WP-883 / D-24834`; `docs/ai/coverage/live-verify.json` two `pending` rows (`co2e/hulk|gain-wound-reward`, `mdns/morbius|gain-wound-reward`).
- **I) Feeds.**
  - Regenerate `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` and `docs/ai/coverage/runtime-observed-hollows.json`.
  - `scripts/coverage/hero-effect-coverage.baseline.json` and `apps/dashboard/src/data/in-play-hollow-baseline.json` only if their gates flag.
  - Re-pin the dashboard `totalObs` in `useInPlayCoverage.test.ts` if the runtime feed moved it.

## Out of Scope

- **The other "may gain a Wound. If you do" lines** (non-attack rewards; one named follow-up WP extends the reward vocabulary):
  - `anni/super-skrull/put-to-the-torch`[2] → Rooftops Conqueror 4 (today: three `conqueror` hollows);
  - `msis/bruce-banner/hulk-gets-smashed`[0] → "KO up to two other cards" (`[hc:strength]` gate-only hollow; the data prints "You main gain");
  - `wpnx/weapon-x-wolverine/violent-conditioning`[0] → Berserk, Berserk (**today it Berserks twice on every play with no Wound**, the Hulk Smash! over-grant class);
  - `wwhk/skaar-son-of-hulk/mood-swings`[0] → Transform (gate-only + `transform` hollow).
- Random Acts of Unkindness (D-24500 / D-24678) and `ko-wound-reward`: unchanged.
- Other wound replacements printed as "discard this card instead" (cvwr Luke Cage, dkcy Colossus, msmc Strong Guy, ssw2 Soulsword Colossus) and wtif Captain Carter's Shield of Britain: not modelled at the chokepoint today; unchanged.
- A bot policy for autoplay / sim / PAR (they stay on the default, D-24745).
- Effect-rulings corpus entries (`docs/ai/rulings/effect-rulings.json`): optional, not required by any gate.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` (+ `heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` pins) — modified
- `packages/game-engine/src/hero/heroEffects.execute.ts` (+ `heroEffects.execute.test.ts` pins) — modified
- `packages/game-engine/src/setup/heroAbility.setup.ts` (+ `setup/heroAbility.setup.test.ts`) — modified
- `packages/game-engine/src/hero/gainWoundReward.logic.ts` — **new**; `packages/game-engine/src/hero/gainWoundReward.test.ts` — **new**
- `packages/game-engine/src/types.ts` — modified (one interface, three optional fields)
- `packages/game-engine/src/moves/seatChoice.resolve.ts`, `moves/divingBlock.logic.ts`, `moves/flyingShieldBlock.logic.ts` — modified
- `packages/game-engine/src/simulation/ai.seatChoice.ts` (+ `ai.seatChoice.test.ts`) — modified
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` (+ `PendingSeatChoicePrompt.test.ts`) — modified
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json` — modified
- `scripts/coverage/mechanic-provenance.json`, `docs/ai/coverage/live-verify.json` — modified
- `data/cards/co2e.json`, `data/cards/mdns.json` — regenerated (one line each)
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv`, `docs/ai/coverage/runtime-observed-hollows.json` — regenerated
- `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — only if their gates flag
- Governance: `docs/ai/DECISIONS.md` (D-24834), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

The file count is above the ~10-file split heuristic. A split would separate the keyword from its own prompt and keep-or-forfeit rule, which ship as one behavior. Each engine edit beyond the lockstep is one dispatch arm, one tag branch or one bot answer, and the rest is regenerated data.

## Contract

- The Locked Values.
- `GainWoundAttackReward` and the keep-or-forfeit rule are the shared "If you do" mechanism the §Out of Scope follow-up extends to non-attack rewards.

## Vision Alignment

**Vision clauses touched:** §1 Rules Authenticity (Hulk Smash! over-grants today; Scalded by Sunlight is hollow), §2 Content Authenticity and §10 Content as Data (markers; printed text unchanged), §22 Deterministic & Reproducible Evaluation, §23 / §24 (ranked fairness, replay-verified integrity), NG-1 (no pay-to-win; untouched).
**Conflict assertion:** No conflict: this WP preserves all touched clauses.
**Non-Goal proximity:** not crossed.
**Determinism (§22):** no randomness; the bot answers read `G` only; setup-level change, so stored matches replay identically.

## Funding Surface Gate

§20 **N/A**: a rules change on two hero cards. Its only copy is the in-game prompt heading, two option labels and log lines. No funding affordance or channel (WP-097 §A/§B/§C) is touched.

## API Catalog

§21 **N/A**: no `apps/server` HTTP endpoint added, changed or removed. No `Library-only` catalog function is touched: `docs/ai/REFERENCE/api-endpoints.md` lists none of the edited engine functions.

---

## Acceptance Criteria

1. Hulk Smash! and Scalded by Sunlight's Sunlight line parse to their locked hooks (gate kept, `gain-wound-reward` attack 5 / 2, no plain `attack`, no `sunlight` unresolved marker); an unseeded reward emits nothing; `DAY_NIGHT_UNMODELED_LINES` has 7 entries.
2. Playing either card with its gate met parks the `gain-wound-reward` prompt; gain grants +N only for a Wound actually gained and kept; decline changes nothing; an empty supply opens no prompt.
3. A Diving Block or Flying Shield Block reveal on that Wound forfeits the +N; a decline grants it; a declined Diving Block that hands the Wound to Flying Shield Block carries the reward over. Untagged Wounds resolve exactly as before.
4. The bot ally gains only when +N newly enables a fight, and declines Diving Block / Flying Shield Block on a tagged Wound; `getLegalMoves` still offers only the default.
5. `HERO_KEYWORDS` and `HERO_EFFECT_HANDLERS` each grow by exactly one (`gain-wound-reward`), with every lockstep site and pin moved together.
6. The client prompt shows "Gain a Wound for extra Attack?" with the two projected options.
7. `cards:check`, `cards:count-markers:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`, `sim:runtime-observed:check`, `sim:coverage --check` and `ledger:numbers:check` exit 0. The ledger reads `gain-wound-reward` = `executable` for `co2e/hulk` and `mdns/morbius`. The `EC-921:` commit body records the runtime feed's `sunlight` `hitCount` before and after (the feed's `examples` are capped, so the card-level proof is AC-1's parse test).
8. `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; arena-client and dashboard `typecheck` → 0. The core sentinel `finalStateHash` (`game.test.ts`) and `PRE_WP080_HASH` are unchanged.

## Verification Steps

1. `pnpm -r build` → 0.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → the two §Card Map lines update; re-run → 0 updates; `node scripts/convert-cards/apply-hero-ability-markers.mjs --validate` → 0.
3. Regenerate in pipeline order (`docs/03-DATA-PIPELINE.md` §1; markers applied by step 2), then rebuild the engine so the scripts read the new `MVP_KEYWORDS`:
   - `pnpm -r build && pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata && pnpm sim:runtime-observed`
   - then `pnpm sim:coverage --check` (only if it flags: `pnpm sim:coverage --update-baseline`)
   - then re-pin the dashboard `totalObs` from the regenerated feed if it moved.
4. `pnpm cards:check && pnpm cards:count-markers:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check && pnpm ledger:numbers:check` → all 0.
5. `pnpm --filter @legendary-arena/game-engine test` → 0 fail (6884 at the baseline plus the new cases).
6. `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` and `pnpm --filter @legendary-arena/dashboard typecheck` → 0.
7. AC-7 spot checks:
   - `node -e "const l=require('./docs/ai/coverage/hero-mechanic-ledger.json');for(const id of ['co2e/hulk','mdns/morbius']){const r=l.rows.find(x=>x.extId===id&&x.mechanic==='gain-wound-reward');console.log(id,r&&r.status)}"` → `co2e/hulk executable`, `mdns/morbius executable`.
   - `node -e "console.log(require('./docs/ai/coverage/runtime-observed-hollows.json').byMechanic.sunlight.hitCount)"` (29 at the baseline) before step 3 and after; paste both into the `EC-921:` commit body.
8. `git diff --name-only` ⊆ Files Expected to Change; revert `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24834 Active. It records:
  - the `gain-wound-reward` keyword and marker, seeded `{attack}`, and the reward-icon suppression;
  - the active-seat prompt (why a prompt, why the seat choice) and the empty-supply no-prompt rule;
  - the chokepoint, the keep-or-forfeit rule on Diving Block / Flying Shield Block, and the three optional fields;
  - the three bot answers, with autoplay / sim / PAR on the default;
  - Scalded by Sunlight leaving `DAY_NIGHT_UNMODELED_LINES` (amends D-24598's list, the D-24600 precedent) and Hulk Smash!'s over-grant fix;
  - the replay note and the named follow-ups.
- [ ] STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-921:` then `SPEC:`).
- [ ] **D-24026 live-verify (post-merge):** on an operator match created after the deploy:
  - Hulk Smash! after another Strength Hero prompts. Gain → +5 Attack and a Wound in the discard pile; decline → neither.
  - With Diving Block in hand, gain then reveal → a card drawn, no Attack.
  - Scalded by Sunlight prompts for +2 under Sunlight.

  Recorded as a STATUS flip and the two `live-verify.json` rows.

## Reserved Decision (lands at execution)

**D-24834 — optional-gain-wound-attack-reward.** It locks everything listed in the DoD item above. The drafting SPEC records it in `DECISIONS.md` as "Drafted 2026-11-11; not yet landed".

## Open Questions (for Jeff; the draft locks the first answer in each)

1. **Reveal forfeits the reward.** Diving Block / Flying Shield Block on the voluntarily gained Wound means "If you do" fails, so no +N. The cheaper alternative is to grant +N when the Wound lands and let a reveal keep it. It is rejected because a Diving Block holder would get +N and a card with no Wound.
2. **Bot-ally gain rule.** The draft gains only when +N newly enables a fight right now. The alternative is to always gain.
3. **Flying Shield Block bot on a teammate's chosen Wound.** The draft declines, which costs the bot a Bystander rescue but keeps the teammate's +N.

---

## Lint Gate Self-Review (00.3)

_Pending: the coordinator runs 00.3 as an independent subagent after the draft._

| § | Verdict |
|---|---|
| §1 Structure | _pending_ |
| §2 Constraints | _pending_ |
| §3 Assumes | _pending_ |
| §4 Context | _pending_ |
| §5 Files | _pending_ |
| §6 Naming | _pending_ |
| §7 Dependencies | _pending_ |
| §8 Boundaries | _pending_ |
| §9 Windows | _pending_ |
| §10 Env vars | _pending_ |
| §11 Auth | _pending_ |
| §12 Tests | _pending_ |
| §13 Verification | _pending_ |
| §14 ACs | _pending_ |
| §15 / §15.1 / §15.2 | _pending_ |
| §16 Code style | _pending_ |
| §17 Vision | _pending_ |
| §18 Prose-vs-grep | _pending_ |
| §19 Bridge-vs-HEAD | _pending_ |
| §20 Funding | _pending_ |
| §21 API catalog | _pending_ |
| EC-TEMPLATE | _pending_ |

## Gate Record

**Pre-flight (01.4):** _pending (independent subagent)._

**Copilot (01.7):** _pending (runs after pre-flight READY)._
