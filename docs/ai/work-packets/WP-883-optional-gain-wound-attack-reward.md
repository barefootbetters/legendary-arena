# WP-883 — "You may gain a Wound. If you do, you get +N Attack": an optional gain-a-Wound reward keyword (Game Engine + Card Data + arena-client heading)

**Status:** Draft 2026-11-11
**Primary Layer:** Game Engine (new hero keyword + handler, one seat-choice kind, Diving Block / Flying Shield Block keep-or-forfeit of the reward, bot answers) + Card Data (two markers) + arena-client (one prompt heading)
**Dependencies (all ✅):**
- WP-382 / D-24183 (`ko-wound-reward`: the three-segment `<keyword>:<reward>:<n>` marker, the reward-icon suppression and the seeded reward set this packet mirrors)
- WP-684 / D-24501 (`G.pendingSeatChoice`, `resolveSeatChoice`, the generic client prompt) and WP-683 / D-24500 (`random-acts-wound`: an active-scoped optional gain-a-Wound seat choice parked from a hero handler)
- WP-682 / D-24499, D-24651, D-24673 (Diving Block at the `gainWoundForPlayer` chokepoint, `gainWoundWithOutcome`) and WP-827 / D-24760 (Flying Shield Block)
- WP-765 / D-24598 (Sunlight gate, `DAY_NIGHT_UNMODELED_LINES`) and WP-767 / D-24600 (the precedent for a line leaving that list)
- WP-843 / D-24777 (co2e Hulk's Crazed Rampage `reveal-or-gain-wound-each`: the co2e Hulk marker-map section and a hand-authored set taking map markers)
- WP-845 / D-24779 (a player cannot choose to gain a Wound the supply does not have, rules v23 L3199-3201), WP-865 / D-24808 (`woundsDrawn` bumps when a Wound lands), D-24744 / D-24745 (bot-ally answers vs the absent-seat default), WP-876 / D-24823 (the newest seat-choice kind + client heading precedent)

**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM — gameplay rules (a new hero keyword, one seat-choice kind, a reward that follows Diving Block / Flying Shield Block outcomes) plus card data, derived feeds and one client heading; no auth, money, persistence or server surface
**Lane:** Standard (two-session). Engine + card data + one client line; a new `HeroKeyword` with its six lockstep sites; not lightweight-eligible (new keyword, behavior change on two ranked-reachable cards, > 4 code/test files).

> Baseline: `origin/main` at `d13a6252` (#3278 merged: the reserve). Engine suite at the reserve: **6884 / 6884 pass** (`pnpm --filter @legendary-arena/game-engine test`, observed at draft).

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
2. **Keyword lockstep** (memory `reference_hero_keyword_lockstep_sites`): `rules/heroKeywords.ts` union `:26` + `HERO_KEYWORDS` `:133` (98 entries); **three** `HERO_KEYWORDS` length pins: `rules/heroKeywords.test.ts:70-73` (98), `rules/heroAbility.setup.test.ts:601` `expectedKeywords` + `:703` (98), and `setup/heroAbility.setup.test.ts:1613` (98, the X-Gene "stays at the current total" pin); `hero/heroEffects.execute.ts` `HANDLED_KEYWORDS` `:165`, `KO_WOUND_REWARD_SEEDED_REWARDS` `:573`, `NO_MAGNITUDE_KEYWORDS` `:588`, `HERO_EFFECT_HANDLERS` `:7565` (77 handlers); handler-count pins `hero/heroEffects.execute.test.ts:156` and `:8126` (77). `MVP_KEYWORDS` derives from `HANDLED_KEYWORDS`; `scripts/hero-mechanic-ledger.mjs` and `scripts/hero-effect-coverage.mjs` read it from the engine `dist`.
3. **Handlers to mirror** (`hero/heroEffects.execute.ts`): `heroEffectRandomActs` `:4611` parks an active-scoped seat choice with `parkSeatChoice(G, undefined, …)` and logs the park; `heroEffectKoWoundReward` `:4938`; `heroEffectGainWound` `:2138` bumps `G.turnEconomy.woundsDrawn` for the playing seat and logs "would gain" while a Diving Block reveal is pending (D-24673).
4. **Wound chokepoint** (`board/wounds.logic.ts`): `gainWoundForPlayer` `:71` lands the Wound in the discard pile, then parks a Diving Block entry (`checkDivingBlock`) or, if none, a Flying Shield Block entry (`checkFlyingShieldBlock`). `gainWoundWithOutcome` `:125` returns `'no-wound' | 'gained' | 'diving-block-pending'`; **it reports `'gained'` even when a Flying Shield Block entry was parked.**
5. **Interceptions:**
   - `moves/divingBlock.logic.ts`: `checkDivingBlock` `:186` pushes `{ playerID, woundCardId }`; `applyDivingBlockResolvedSeatChoice` `:310` resolves each seat's front entry (reveal → `applyDivingBlockReveal` `:360`; decline → `checkFlyingShieldBlock(G, seat, woundCardId)`, which returns whether it parked).
   - `moves/flyingShieldBlock.logic.ts`: `checkFlyingShieldBlock` `:154` pushes `{ recipientID, woundCardId, candidateSeats }`; `dropUninterceptableWounds` `:196` (the recipient keeps the Wound); `applyFlyingShieldBlockResolvedSeatChoice` `:301`, `applyFlyingShieldBlockDecline` `:340` (returns true when no candidate is left: the recipient keeps it), `applyFlyingShieldBlockReveal` `:368`.
   - Entry lookups: the Diving Block apply takes each seat's **first** entry with `playerID === seat` (`divingBlock.logic.ts:327`); the Flying Shield Block apply takes the entry with `addressedSeat === seat` (`flyingShieldBlock.logic.ts:313`), reveals only when the seat still has a copy (`copy !== undefined`), and otherwise falls through to `applyFlyingShieldBlockDecline`. The wave prompts are built in `openDivingBlockSeatChoiceIfNeeded` (`divingBlock.logic.ts:247`; decline label "Take the Wound") and `buildSeatPrompt` (`flyingShieldBlock.logic.ts:219`; decline labels "Take the Wound" / "Let Player {r} take the Wound"). A copy already in `G.flyingShieldBlockUsedThisTurn` is not revealable, so `checkFlyingShieldBlock` parks nothing for a seat whose only copy is spent.
   - `moves/seatChoice.resolve.ts` `applySeatChoiceTimeoutDefault` `:963` applies `defaultOptionIndex` for every outstanding seat (Diving Block / Flying Shield Block default = decline).
   - `hero/heroEffects.execute.ts` `failsMagnitudePreGate` `:800` drops a magnitude-carrying effect whose magnitude is missing or < 1 before any handler runs.
   - Waves open in the play-phase `onMove` after the move that dealt the Wound, and the board is frozen (block-all) until they resolve, so a deferred grant cannot be spent early. `endgame/mastermindVictory.logic.ts:95,102` drops both queues at game end.
6. **Seat choice:** `types.ts` `PendingSeatChoice` `:1543` (consumer-specific optional fields such as `sizeChangingGrant`, never projected), `PendingDivingBlockWound` `:1788`, `PendingFlyingShieldBlockWound` `:1805`. `moves/seatChoice.resolve.ts` `parkSeatChoice` `:374`, `resolveSeatChoice` `:442`, `applySeatChoiceByKind` `:600` (the WP-876 heist-shuffle dispatch arm `:784` is the newest). `getLegalMoves` offers an addressed seat one `resolveSeatChoice` at `defaultOptionIndex`; the bot ally uses `simulation/ai.seatChoice.ts` `chooseByKind` `:110` (Diving Block → reveal `:116`, Flying Shield Block → reveal `:121`; `readFightableCityIndices` `:255` reads `getLegalMoves` with the open choice set aside).
7. **Client:** `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` renders any kind's projected option labels and keys a heading on `kind` (`heading()` `:88`, fallback "Your choice"). Engine-only `[keyword:…:…]` markers are hidden by `lib/abilityMarkers.ts` (any colon token).
8. **Markers.** `scripts/convert-cards/apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN` `:151-152` has no `gain-wound-reward` form (error-message list `:362-380`). `inputs/hero-ability-markers.json` has `co2e` (`:234`) and `mdns` (`:2231`; Scalded by Sunlight ability 1 at `:2286-2291`) sections; co2e Crazed Rampage's marker comes from this map, so `co2e.json` (hand-authored) takes map markers too.
9. **Corpus.** Exactly two hero lines read "You may gain a Wound. If you do, you get +N[icon:attack]" (grep over `data/cards/*.json` at the baseline). The other "may gain a Wound. If you do" lines have non-attack rewards (§Out of Scope).
10. **No consumer of these hooks' effect shape** beyond the executor: no committed fixture, PAR scenario, sentinel or test plays `co2e/hulk` or `mdns/morbius` Scalded by Sunlight's Sunlight line except `setup/heroAbility.setup.test.ts:1857` ("Scalded by Sunlight: the Sunlight line is an honest hollow"), which migrates in scope. No committed PAR profile (`data/par/profile/v1/*.json`) includes `co2e/hulk` or `mdns/morbius`, so no PAR pin can move; sim / PAR take the decline default anyway. `mdns/morbius` is in the `sim:runtime-observed` sweep; `co2e` is not.
11. `pnpm -r build` exits 0 and the suites are green at the baseline.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` L3190-3201 ("Revealing a Card": a player may decline to reveal and take the Wound; "you can't choose an option that you can't do").
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 / §5.1 (the `[keyword:X]` ability-markup token form the new marker uses).
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #2 (engine owns truth; the UIState projection, D-12803), §Layer Boundary (Authoritative) (engine + data + one client heading, no upward edge), §Card Data Flow (markers → `data/cards` → registry → setup hooks).
- `.claude/rules/architecture.md` §UIState Projection Integrity: the three new optional fields are engine-internal and are **not** projected (the filter is a whitelist and `UIPendingSeatChoice` carries only the per-seat option labels), so the five-step Board-Visible Field contract does not apply; the client sees the reward only through the option labels.
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

- **Keyword.** `HeroKeyword` `'gain-wound-reward'`, appended last to the union and `HERO_KEYWORDS`. It carries the reward magnitude, so it is **not** in `NO_MAGNITUDE_KEYWORDS` (the `ko-wound-reward` posture). It joins `HANDLED_KEYWORDS` and `HERO_EFFECT_HANDLERS`. All six lockstep sites (Assumes 2) move together, including all **three** `HERO_KEYWORDS` length pins; read the current pin values at execution (98 → 99 keywords, 77 → 78 handlers at the baseline).
- **Marker + parser.**
  - Token `[keyword:gain-wound-reward:<reward>:<n>]`; `GAIN_WOUND_REWARD_PATTERN = /\[keyword:gain-wound-reward:([a-z][a-z-]*):(\d+)\]/g`.
  - Seeded rewards `GAIN_WOUND_REWARD_SEEDED_REWARDS = { 'attack' }`, two copies (parser and the new logic module, duplicate-first, like `KO_WOUND_REWARD_SEEDED_REWARDS`).
  - A new **Step 2g**, placed after the ko-wound-reward Step 2f (`:2240-2258`), emits the keyword with `magnitudes` / `rewardTypes` only when the reward is seeded and `n >= 1`. An unseeded reward emits nothing (Honest-Partial).
  - The descriptor builder emits `{ type: 'gain-wound-reward', magnitude: n, rewardType: 'attack' }`.
  - **Reward-icon suppression** (D-24570 sibling): drop the plain keyword matching the reward type and its magnitude, so Hulk Smash!'s printed `+5[icon:attack]` is no longer granted unconditionally.
  - Remove `'mdns/morbius/scalded-by-sunlight:sunlight'` from `DAY_NIGHT_UNMODELED_LINES` (seven entries remain). Rewrite the `:969-970` comment to say seven entries remain, and correct its stale `D-24606` to `D-24600` (Snarling Fangs is WP-767 / D-24600). The Sunlight gate and the Strength gate are kept by the existing parse; no other parser change.
- **Validator.** `apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN` gains `^\[keyword:gain-wound-reward:[a-z][a-z-]*:[1-9]\d*\]$` (with a `// why:` line and the token added to the error-message list).
- **Handler `heroEffectGainWoundReward`** (in `hero/heroEffects.execute.ts`, registered under `'gain-wound-reward'`). A missing or < 1 magnitude never reaches it: `failsMagnitudePreGate` (`:800`) drops the effect upstream. In order:
  1. An unseeded `rewardType` → log L0 and return (mirrors `heroEffectKoWoundReward`'s unseeded skip).
  2. `G.piles.wounds` empty → no prompt; log L2.
  3. `G.pendingSeatChoice` already open → no prompt; log L9 (defensive; neither card can reach it).
  4. Otherwise park `buildGainWoundRewardChoice(playerID, reward)` with `parkSeatChoice(G, undefined, …)` (active-scoped, no stage ride) and log L1.
- **Hook ordering.** Parking does not halt the per-card hook loop: hooks after the parked one in the same play still run before the prompt resolves. That is harmless for both §Card Map cards (Hulk Smash! has one line; Scalded by Sunlight's Sunlight and Moonlight lines are mutually exclusive). The follow-up that adds multi-line cards (Put to the Torch, Violent Conditioning) must revisit it.
- **New module `hero/gainWoundReward.logic.ts`.** No boardgame.io import and no `heroEffects.execute.ts` import (the `hero/heistPayloads.logic.ts` posture).
  - **Constants:** `GAIN_WOUND_REWARD_SEAT_CHOICE_KIND = 'gain-wound-reward'`, `GAIN_WOUND_REWARD_GAIN_OPTION_INDEX = 0`, `GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX = 1`, `GAIN_WOUND_REWARD_SEEDED_REWARDS`. Every module constant is a literal.
  - **Builder:** one addressed seat (the player). Options `[{ label: 'Gain a Wound: you get +N Attack' }, { label: "Don't gain a Wound" }]`, `defaultOptionIndex` = decline. The choice carries `gainWoundReward` (the `GainWoundReward` below).
  - **Apply `applyGainWoundRewardSeatChoice(G, choice)`.**
    - Decline → log L3.
    - Gain → record the Flying Shield Block queue length, then call `gainWoundWithOutcome(G, seat)`.
    - `'no-wound'` → log L6; no reward.
    - Otherwise the Wound landed: `G.turnEconomy.woundsDrawn += 1` (the WP-865 convention).
    - `'diving-block-pending'` → set `gainWoundReward` on the seat's **last** `G.pendingDivingBlockWounds` entry; log L5.
    - `'gained'` and the Flying Shield Block queue grew → set it on the **last** `G.pendingFlyingShieldBlockWounds` entry; log L5.
    - Else → grant now (L4). This includes a Flying Shield Block holder whose only copy is already in `G.flyingShieldBlockUsedThisTurn` (nothing parks).
  - **Import cycle.** `moves/seatChoice.resolve.ts` imports this module (dispatch), and this module imports `board/wounds.logic.ts`, which imports `moves/divingBlock.logic.ts`, which imports `seatChoice.resolve.ts`. Every imported binding is used only inside function bodies, never at module top level, and each new cross-import carries a `// why:` cycle note in the D-24760 / WP-845 style.
- **Leaf module `hero/gainWoundRewardGrant.ts`** (decision: a leaf, so the Diving Block / Flying Shield Block modules take no new cycle edge). It exports `grantGainWoundReward(G, recipientID, reward, isAfterInterception)` and imports only `economy/economy.logic.ts` (`addResources`), `log/logPush.ts`, `log/logDisplay.ts` and types.
  - It switches on `reward.rewardType`; the one arm today is `'attack'`: `G.turnEconomy = addResources(G.turnEconomy, reward.magnitude, 0)`, then log L4 (now) or L7 (after a declined interception). The follow-up adds arms, not fields.
  - The recipient is always the player who played the card, the active player, whose `turnEconomy` this is.
- **Types (`types.ts`).** One interface `GainWoundReward { rewardType: 'attack'; magnitude: number; sourceCardId: CardExtId }`. The same field name `gainWoundReward?` goes on all three carriers, absent unless this keyword set it:
  - `PendingSeatChoice.gainWoundReward?`
  - `PendingDivingBlockWound.gainWoundReward?`
  - `PendingFlyingShieldBlockWound.gainWoundReward?`

  None is projected to the client (the `sizeChangingGrant` posture; see §Context UIState note).
- **Keep or forfeit (the "If you do" rule):**
  - `divingBlock.logic.ts` reveal of a tagged entry → log L8, no grant.
  - Diving Block decline → if `checkFlyingShieldBlock` parked, move the tag onto the new last Flying Shield Block entry; else grant (L7).
  - `flyingShieldBlock.logic.ts`: L8 goes inside the reveal branch (`copy !== undefined`, `applyFlyingShieldBlockReveal`).
  - Flying Shield Block grant (L7) only when `applyFlyingShieldBlockDecline` returns true (no candidate left), including the reveal-without-copy fall-through. A decline that leaves candidates keeps the tag and grants nothing yet.
  - `dropUninterceptableWounds` → grant (L7) for each tagged entry it drops.
  - The disconnect / timeout default (`applySeatChoiceTimeoutDefault`) declines Diving Block / Flying Shield Block, so a tagged entry is kept and granted (L7); on a `gain-wound-reward` choice it declines (L3, no Wound).
  - Untagged entries behave exactly as today.
- **Wave labels.** A tagged entry's decline option reads `Take the Wound (keep +N Attack)` (N filled in) for the recipient: in `openDivingBlockSeatChoiceIfNeeded` (the seat's first entry, as the apply looks it up) and in the Flying Shield Block `buildSeatPrompt` when the seat is the recipient. For another seat the Flying Shield Block decline reads `Let Player {r} take the Wound (they keep +N Attack)`. Untagged entries keep today's labels; option order and indices are unchanged.
- **Dispatch.** `applySeatChoiceByKind` gains a `GAIN_WOUND_REWARD_SEAT_CHOICE_KIND` arm before the `applySeatChoiceCard` fall-through.
- **Bot answers (`simulation/ai.seatChoice.ts`, playing seat only).**
  - `gain-wound-reward`: gain iff the reward newly enables a fight. Count the `fightVillain` + `fightMastermind` moves from `getLegalMoves({ ...G, pendingSeatChoice: undefined }, …)`, then from `getLegalMoves({ ...G, pendingSeatChoice: undefined, turnEconomy: addResources(G.turnEconomy, magnitude, 0) }, …)`. Gain when the second count is larger; else decline. G is never written (shallow local copies only).
  - `diving-block`: look up the seat's entry the way the apply does (the **first** `G.pendingDivingBlockWounds` entry with `playerID === seat`). If it carries `gainWoundReward`, return `choice.defaultOptionIndex` (decline); otherwise reveal, as today.
  - `flying-shield-block`: the entry with `addressedSeat === seat`; same rule.
  - Autoplay, the simulation runner and PAR keep `defaultOptionIndex` (D-24745).
- **Client.** `PendingSeatChoicePrompt.vue` `heading()` gains `case 'gain-wound-reward': return 'Gain a Wound for extra Attack?';` (the WP-876 precedent). The options come from the projection; no other client change.
- **Log lines.** Every line uses the 4-argument form `pushLog(G, text, outcome, sourceCardId)`. `{card}` = `formatCardRef(G.cardDisplayData, sourceCardId)`. L1 and L3-L8 end with the card reference in parentheses; L2 and L9 name it inline; L0 (the `heroEffectKoWoundReward` wording) carries it only as the `sourceCardId` argument. Outcomes in brackets:
  - L0 `Player {p} played a hero ability whose gain-a-Wound reward is not yet supported, so it was skipped.` [blocked]
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
- Kind `'gain-wound-reward'`; options index 0 gain / 1 decline; default 1; labels, the tagged-entry decline labels and the heading verbatim as above.
- `GainWoundReward { rewardType: 'attack'; magnitude; sourceCardId }`; the one field name `gainWoundReward?` on all three carriers; `grantGainWoundReward` in the leaf `hero/gainWoundRewardGrant.ts`, switching on `rewardType`.
- Log lines L0-L9 verbatim, all through the 4-argument `pushLog`.
- Bot entry lookups (first Diving Block entry with `playerID === seat`; the Flying Shield Block entry with `addressedSeat === seat`) and the pure `getLegalMoves` copies.
- The keep-or-forfeit rule and the three bot answers.
- The two §Card Map tokens; `DAY_NIGHT_UNMODELED_LINES` drops exactly one entry (8 → 7).

---

## Scope (In)

- **A) Keyword lockstep.** `rules/heroKeywords.ts`; `hero/heroEffects.execute.ts` (`HANDLED_KEYWORDS`, `HERO_EFFECT_HANDLERS`, `heroEffectGainWoundReward`); pins: the three `HERO_KEYWORDS` length pins (`rules/heroKeywords.test.ts:70`, `rules/heroAbility.setup.test.ts:703` + `expectedKeywords`, `setup/heroAbility.setup.test.ts:1613`) and the two handler-count pins in `hero/heroEffects.execute.test.ts`.
- **B) Parser.** `setup/heroAbility.setup.ts`: pattern, seeded set, Step 2g, descriptor arm, reward-icon suppression, `DAY_NIGHT_UNMODELED_LINES` removal (and the `D-24606` → `D-24600` comment fix).
- **C) Choice + reward.** New `hero/gainWoundReward.logic.ts` and leaf `hero/gainWoundRewardGrant.ts`; `types.ts` (`GainWoundReward` + three optional `gainWoundReward` fields); `moves/seatChoice.resolve.ts` dispatch arm; `moves/divingBlock.logic.ts` and `moves/flyingShieldBlock.logic.ts` keep-or-forfeit and the tagged-entry decline labels.
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
    - A pre-opened seat choice → L9, the open choice untouched. An unseeded reward descriptor (`rewardType: 'draw'`) → L0, no prompt.
    - Two Flying Shield Block holders: the first declines, so the tag stays on the entry and no +N is granted yet. The second either reveals (L8, no +N) or declines (L7, +N); test both.
    - A Flying Shield Block copy spent on an earlier Wound in the same wave, so the tagged entry drops via `dropUninterceptableWounds` → +N (L7).
    - `applySeatChoiceTimeoutDefault` on a `gain-wound-reward` choice → L3, no Wound. On a tagged Diving Block or Flying Shield Block entry → kept, +N (L7).
    - Flying Shield Block held only by a copy already in `G.flyingShieldBlockUsedThisTurn` → nothing parks, +N now (L4).
    - Tagged-entry decline labels: "Take the Wound (keep +5 Attack)" on the Diving Block wave and the recipient's Flying Shield Block prompt; "Let Player 0 take the Wound (they keep +5 Attack)" for another seat; untagged labels unchanged.
  - `simulation/ai.seatChoice.test.ts`:
    - Gain when +N reaches a City Villain's fight cost; decline when it reaches nothing new.
    - Diving Block and Flying Shield Block decline (`defaultOptionIndex`) on a tagged entry and still reveal on an untagged one.
    - One seat with Diving Block entries [untagged, tagged]: the bot reveals in wave 1 and declines in wave 2.
    - Purity: `G` deep-equals a `structuredClone` taken before `choosePlayingSeatChoiceOption` on a `gain-wound-reward` choice.
- **H) Ledger + records.** `scripts/coverage/mechanic-provenance.json` row `gain-wound-reward → WP-883 / D-24834`; `docs/ai/coverage/live-verify.json` two `pending` rows (`co2e/hulk|gain-wound-reward`, `mdns/morbius|gain-wound-reward`).
- **I) Feeds.**
  - Regenerate `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` and `docs/ai/coverage/runtime-observed-hollows.json`.
  - `scripts/coverage/hero-effect-coverage.baseline.json` and `apps/dashboard/src/data/in-play-hollow-baseline.json` only if their gates flag.
  - Run `pnpm --filter @legendary-arena/dashboard prebuild:coverage` first (memory `reference_inplay_totalobs_pin_stale_on_feed_regen`), then re-pin the dashboard `totalObs` / `percentResolved` pins in `useInPlayCoverage.test.ts` only if the regenerated runtime feed moved them.

## Out of Scope

- **The other "may gain a Wound. If you do" lines** (non-attack rewards; one named follow-up WP extends the reward vocabulary):
  - `anni/super-skrull/put-to-the-torch`[2] → Rooftops Conqueror 4 (today: three `conqueror` hollows);
  - `msis/bruce-banner/hulk-gets-smashed`[0] → "KO up to two other cards" (`[hc:strength]` gate-only hollow; the data prints "You main gain");
  - `wpnx/weapon-x-wolverine/violent-conditioning`[0] → Berserk, Berserk (**today it Berserks twice on every play with no Wound**, the Hulk Smash! over-grant class);
  - `wwhk/skaar-son-of-hulk/mood-swings`[0] → Transform (gate-only + `transform` hollow).
- Random Acts of Unkindness (D-24500 / D-24678) and `ko-wound-reward`: unchanged.
- Other wound replacements printed as "discard this card instead" (cvwr Luke Cage, dkcy Colossus, msmc Strong Guy, ssw2 Soulsword Colossus) and wtif Captain Carter's Shield of Britain: not modelled at the chokepoint today; unchanged.
- A bot policy for autoplay / sim / PAR (they stay on the default, D-24745).
- Effect-rulings corpus (`docs/ai/rulings/effect-rulings.json`): not touched (no gate requires it).

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` (+ `heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` pins) — modified
- `packages/game-engine/src/hero/heroEffects.execute.ts` (+ `heroEffects.execute.test.ts` pins) — modified
- `packages/game-engine/src/setup/heroAbility.setup.ts` (+ `setup/heroAbility.setup.test.ts`) — modified
- `packages/game-engine/src/hero/gainWoundReward.logic.ts`, `hero/gainWoundRewardGrant.ts` (leaf) — **new**; `packages/game-engine/src/hero/gainWoundReward.test.ts` — **new**
- `packages/game-engine/src/types.ts` — modified (one interface, three optional fields)
- `packages/game-engine/src/moves/seatChoice.resolve.ts`, `moves/divingBlock.logic.ts`, `moves/flyingShieldBlock.logic.ts` — modified
- `packages/game-engine/src/simulation/ai.seatChoice.ts` (+ `ai.seatChoice.test.ts`) — modified
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` (+ `PendingSeatChoicePrompt.test.ts`) — modified
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json` — modified
- `scripts/coverage/mechanic-provenance.json`, `docs/ai/coverage/live-verify.json` — modified
- `data/cards/co2e.json`, `data/cards/mdns.json` — regenerated (one line each)
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv`, `docs/ai/coverage/runtime-observed-hollows.json` — regenerated
- `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — only if their gates flag
- Governance (execution close): `docs/ai/DECISIONS.md` (D-24834 appended Active), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

The file count is above the ~8-file split heuristic. A split would separate the keyword from its own prompt and keep-or-forfeit rule, which ship as one behavior. Each engine edit beyond the lockstep is one dispatch arm, one tag branch or one bot answer, and the rest is regenerated data.

## Contract

- The Locked Values.
- `GainWoundReward` (discriminated on `rewardType`), the single `gainWoundReward` field on all three carriers, `grantGainWoundReward` and the keep-or-forfeit rule are the shared "If you do" mechanism. The §Out of Scope follow-up extends it to non-attack rewards by adding `rewardType` members and grant arms, never by renaming fields.

## Vision Alignment

**Vision clauses touched:** §1 Rules Authenticity (Hulk Smash! over-grants today; Scalded by Sunlight is hollow), §2 Content Authenticity and §10 Content as Data (markers; printed text unchanged), §22 Deterministic & Reproducible Evaluation, §23 / §24 (ranked fairness, replay-verified integrity), §26 Simulation-Calibrated PAR Determination (sim / PAR take the decline default; no committed PAR profile includes `co2e/hulk` or `mdns/morbius`, so no PAR value moves), NG-1 (no pay-to-win; untouched).
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
3. A Diving Block or Flying Shield Block reveal on that Wound forfeits the +N; a decline grants it; a declined Diving Block that hands the Wound to Flying Shield Block carries the reward over. A Flying Shield Block decline that leaves candidates keeps the tag; `dropUninterceptableWounds` and the timeout default grant it. A tagged entry's decline option reads "Take the Wound (keep +N Attack)" (another seat: "Let Player {r} take the Wound (they keep +N Attack)"). Untagged Wounds resolve and are labelled exactly as before.
4. The bot ally gains only when +N newly enables a fight, and declines Diving Block / Flying Shield Block on a tagged Wound (entry looked up as the apply does); `choosePlayingSeatChoiceOption` never writes `G`; `getLegalMoves` still offers only the default.
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
   - then `pnpm --filter @legendary-arena/dashboard prebuild:coverage`, and re-pin the dashboard `totalObs` / `percentResolved` pins only if the regenerated runtime feed moved them.
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
  - the chokepoint, the keep-or-forfeit rule on Diving Block / Flying Shield Block (incl. the timeout default and `dropUninterceptableWounds`), the tagged-entry decline labels, `GainWoundReward` on the three `gainWoundReward` carriers and the leaf `grantGainWoundReward`;
  - the three bot answers and their entry lookups, with autoplay / sim / PAR on the default;
  - that parking does not halt the hook loop (harmless for both cards; the follow-up revisits it);
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

**D-24834 — optional-gain-wound-attack-reward.** It locks everything listed in the DoD item above. Reserved in NUMBER-LEDGER (#3278); the entry is written Active in the execution `SPEC:` close.

## Settled Design Questions (coordinator decisions, 2026-11-11)

1. **Reveal forfeits the reward.** Diving Block / Flying Shield Block on the voluntarily gained Wound means "If you do" fails, so no +N. Rejected alternative: grant +N when the Wound lands and let a reveal keep it (a Diving Block holder would get +N and a card with no Wound).
2. **Bot-ally gain rule.** The bot gains only when +N newly enables a fight right now. Rejected alternative: always gain.
3. **Flying Shield Block bot on a teammate's chosen Wound.** The bot declines, which costs it a Bystander rescue but keeps the teammate's +N.

---

## Lint Gate Self-Review (00.3)

Independent subagent run (coordinator, 2026-11-11). **Run 1: FAIL**, text-only, fixed in this revision:
- §4: Context gained `00.2-data-requirements.md` §5 / §5.1, ARCHITECTURE §Architectural Principles #2 / §Layer Boundary (Authoritative) / §Card Data Flow, and `.claude/rules/architecture.md` §UIState Projection Integrity.
- Q1: the log-line preamble was wrong for L2 / L9 (they name the card inline); now L0-L9 with the 4-argument `pushLog`.
- Q2: WP-843 / D-24777 added to the header; WP-865 and WP-876 added to the WORK_INDEX row and the session prompt.
- Q3: reward-integrity wording names the dashboard `totalObs` / `percentResolved` pins as editable only if the regenerated feed moved them.

**Result after the fixes: PASS** (2026-11-11).

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Constraints | PASS |
| §3 Assumes | PASS |
| §4 Context | PASS (after fix) |
| §5 Files | PASS |
| §6 Naming | PASS |
| §7 Dependencies | PASS (after fix Q2) |
| §8 Boundaries | PASS |
| §9 Windows | PASS |
| §10 Env vars | N/A: none introduced or read |
| §11 Auth | N/A: no auth surface |
| §12 Tests | PASS |
| §13 Verification | PASS |
| §14 ACs | PASS |
| §15 / §15.1 / §15.2 | PASS (after fix Q3) |
| §16 Code style | PASS |
| §17 Vision | PASS (§26 added) |
| §18 Prose-vs-grep | N/A: no forbidden-token grep step |
| §19 Bridge-vs-HEAD | N/A: commit-time rule |
| §20 Funding | N/A, justified |
| §21 API catalog | N/A, justified |
| EC-TEMPLATE | PASS (after fix Q1) |

## Gate Record

**Pre-flight (01.4), independent subagent: READY TO EXECUTE, conditional on F1 and F2** (both applied in this revision). Findings applied:
- **F1:** the third `HERO_KEYWORDS` length pin, `setup/heroAbility.setup.test.ts:1613` (98), is in Assumes 2, §Scope A and the EC.
- **F2:** the bot looks up the entry the way the apply does (first Diving Block entry with `playerID === seat`, `divingBlock.logic.ts:327`; Flying Shield Block entry with `addressedSeat === seat`, `flyingShieldBlock.logic.ts:313`) and returns `choice.defaultOptionIndex` on a tagged entry; a [untagged, tagged] two-wave test.
- **F3:** L8 sits inside the Flying Shield Block reveal branch (`copy !== undefined`); L7 only when `applyFlyingShieldBlockDecline` returns true, including the reveal-without-copy fall-through.
- **F4:** the parser step is Step 2g, after the ko-wound-reward Step 2f (`:2240-2258`).
- **F5:** the rewritten `DAY_NIGHT_UNMODELED_LINES` comment corrects the stale `D-24606` to `D-24600`.
- **F6:** the L0 unseeded skip; magnitude < 1 never reaches the handler (`failsMagnitudePreGate`).
- **F7:** `pnpm --filter @legendary-arena/dashboard prebuild:coverage` runs before any `totalObs` re-pin (§I, Verification step 3).
- **F8:** the import-cycle rule is stated; the grant helper and its imports live in the leaf `hero/gainWoundRewardGrant.ts`.
- **F9:** Vision §26 and the no-PAR-profile fact (Assumes 10).

**Copilot (01.7), independent subagent: RISK → HOLD; six scope-neutral findings, all applied:**
- **#1:** discriminated `GainWoundReward { rewardType: 'attack'; magnitude; sourceCardId }`, one field name `gainWoundReward` on all three carriers, one `grantGainWoundReward` switching on `rewardType`.
- **#2:** keep-or-forfeit tests added: two Flying Shield Block holders, `dropUninterceptableWounds`, `applySeatChoiceTimeoutDefault`, and a copy already used this turn.
- **#3:** the bot entry lookup (= pre-flight F2).
- **#4:** bot purity: `getLegalMoves` on shallow copies only, "G is never written", a deep-equal test.
- **#5:** the import cycle (= pre-flight F8).
- **#6:** (a) logging form; (b) parking does not halt the hook loop, harmless for both cards, revisited by the follow-up; (c) tagged-entry decline label "Take the Wound (keep +N Attack)" (coordinator decision), plus the other-seat Flying Shield Block wording "Let Player {r} take the Wound (they keep +N Attack)".

Design questions settled by the coordinator on 2026-11-11 (§Settled Design Questions). The fixes add no scope category; the only file added is the leaf grant module (pre-flight F8).
