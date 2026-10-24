# WP-826 — Cap 75th optional-KO S.H.I.E.L.D. family: Mobilize for War and Reassign to Civilian Duty (Game Engine + card data)

**Status:** Draft 2026-10-24 — pre-flight READY (one scope fix); copilot RISK (all fixes applied); 00.3 PASS — see §Gate Record (EC-864; **D-24759** reserved (#2984)).
**Primary Layer:** Game Engine (`rules/` keywords, `hero/` handlers, `setup/` parser, `ui/` projection, `simulation/` bot) plus the hero-ability marker input and its regenerated card data
**Dependencies:** none open. Builds on WP-248 / D-24019 (the optional-KO-reward queue and `resolveOptionalKoReward`), WP-632 / D-24442 (in-play KO source), WP-667 / D-24480 (`koZones`), WP-681 / D-24498 (`koTeamFilter: 'shield'`, `cardCountsAsShieldHero`), WP-767 / D-24600 (`allowDiscard` in the bot selector), WP-741 / D-24563 (the triple S.H.I.E.L.D. gate), WP-653 / D-24464 (the Savior condition), D-24628 (leading-gate-prefix body tokens are descriptive).
**User-Visible Surface:** `play.legendary-arena.com` (any match using the Cap 75th heroes Agent X-13 or Steve Rogers, Director of S.H.I.E.L.D.)
**Lane:** Standard (two-session). It adds three members to the canonical `HERO_KEYWORDS` array, touches the parser, the projection and the bot in one layer, and shifts the fixed-seed `sim:runtime-observed` sweep, so the lightweight lane does not apply (D-24028).
**Arc:** Cap 75th completion, remaining item 4 (auto-memory `project_cap75_completion_arc`).

> Baseline: `origin/main` at `56bb0412` (the reserve commit #2984 on top of `1dc593b6`). Re-read line anchors and test totals at execution.

---

## Goal

As a player using the Cap 75th S.H.I.E.L.D. heroes, I want Mobilize for War and Reassign to Civilian Duty to do what they print, so that I can thin my deck of starters and, as a Savior, turn those KOs into Attack, or trade a played S.H.I.E.L.D. Hero for a Bystander.

Today both lines do nothing but gate:
- **Mobilize for War, line 0** (`ca75/agent-x-13/mobilize-for-war`): "KO up to two [team:shield] Heroes from your hand and/or discard pile." It parses to a `requiresTeam: shield` gate with no effect (`gate-only`), so the card KOs nothing. The inline `[team:shield]` is the KO target, not a gate.
- **Mobilize for War, line 1**: "[keyword:Savior]: For each card KO'd this way, you get +1[icon:attack]." It parses to a flat `attack: 1` under the Savior gate: +1 for any Savior, with or without a KO.
- **Reassign to Civilian Duty** (`ca75/steve-rogers-director-of-shield/reassign-to-civilian-duty`): "[team:shield][team:shield][team:shield]: You may KO a [team:shield] Hero that you played this turn. If you do, rescue a Bystander." It parses to the triple S.H.I.E.L.D. gate (D-24563) with no effect (`gate-only`).

After this session:
- Mobilize for War offers up to two optional KOs, one at a time, each of a S.H.I.E.L.D. Hero from hand or discard (the S.H.I.E.L.D. Agent, Trooper and Officer tokens count). Declining one does not stop the other.
- As a Savior (3+ Bystanders in your Victory Pile when the card is played), each KO you actually make grants +1 Attack. Not a Savior, or no KO: no Attack.
- Reassign to Civilian Duty, once its triple gate holds, offers one optional KO of a S.H.I.E.L.D. Hero you played this turn (itself included). A KO rescues a Bystander; declining does nothing.

## Scaffold (observed at drafting, REQUIRED evidence)

On 2026-10-24 the change was prototyped in the drafting worktree, measured, and reverted. The patch is kept as evidence (`wp826-scaffold.patch` in the drafting session's scratchpad); the executor re-authors from Locked Values and the Test Contract and may consult it.

- **Parser probe** (`buildHeroAbilityHooks` per single line, before → after):
  - Mobilize line 0: `[{requiresTeam: shield}]`, no effects, `unresolved: ['gate-only']` → no conditions, effects `[{ ko-up-to-shield-hand-discard, 2 }]`.
  - Mobilize line 1: `[{bystandersInVictoryAtLeast: '3'}]`, effects `[attack: 1]` → same condition, effects `[{ attack-per-ko-this-way, 1 }]`.
  - Reassign: `[{requiresTeam: shield, requiredMatches: 3}]`, no effects, `gate-only` → same condition, effects `[{ optional-ko-shield-played-rescue, 1 }]`. The body `[team:shield]` was already non-gating (D-24628), so no parser flag is needed for Reassign.
- **Tests.** The new real-data file (T1-T12) passed 12 / 12; the projection test (T13) and the bot test (T14) passed. Engine suite 5672 → 5686 / 0 fail (+14); `pnpm -r --no-bail test` 0 fail in every package. Revert proofs observed: the baseline `ca75.json` fails T1-T11; reverting the `handPermitted` gate fails T13; dropping `allowHand` from the bot call fails T14.
- **Derived artifacts.** `apply-hero-ability-markers.mjs` updated exactly 3 lines in `data/cards/ca75.json`. Stale and regenerated: `ledger:heroes` (803 rows), `effect-index`, `mechanics:metadata` (162 → 164 mechanics), `sim:runtime-observed` (7793 → 7777 observations; `parse-unrecognized` 7272 → 7256; 79 mechanics, 0 dropped). The dashboard `useInPlayCoverage` totalObs pin moved 8714 → 8698 (resolvedObs 1091 and 12.5% unchanged); dashboard `test:coverage` 584 / 0 and `typecheck` 0.
- Green with no regeneration: `cards:check`, `cards:count-markers:check`, `ledger:villains:check`, `gauntlet:loadouts:check`, `sim:coverage --check`.
- These deltas were measured at `1dc593b6` and are expectations, not targets. If main has moved the feed, the observed delta governs: record it, and explain any difference in the dashboard comment and in D-24759.

## User-Visible Impact

- Agent X-13's Mobilize for War: up to two "You may KO a card" prompts listing only S.H.I.E.L.D. Heroes in hand and discard. As a Savior each prompt shows "+1 Attack" and each KO adds it. Not a Savior: the prompts carry no reward. Line 1's flat +1 is gone.
- Steve Rogers' Reassign to Civilian Duty: after three other S.H.I.E.L.D. cards, one prompt "for a reward (Rescue a Bystander)" listing only the S.H.I.E.L.D. Heroes you played this turn.
- The log names each KO and the rescue (the existing optional-KO lines) and says why when nothing can be KO'd.
- Every other card is unchanged. No client change: the existing `OptionalKoRewardPrompt.vue` already renders whichever of its three lists are non-empty.

---

## Assumes

1. **Optional-KO queue** (`moves/optionalKoReward.resolve.ts` on the baseline): `resolveOptionalKoReward` enforces `front.koZones` (L141) and `front.koTeamFilter === 'shield'` via `cardCountsAsShieldHero` (L151), KOs the card, then dispatches the reward through `executeSingleEffect` (L221) unless it is `'none'` / `'gain-officer-hand'`. Decline front-pops with no KO and no reward. `PendingOptionalKoReward` (`types.ts` L1024) carries `koZones?` (L1045) and `koTeamFilter?: 'shield'` (L1051); `rewardType` is `HeroKeyword | 'none' | 'gain-officer-hand'`, so `'attack'` and `'rescue'` are valid rewards.
2. **Block-all guard**: while `G.pendingOptionalKoRewards` is non-empty no card can be played and the turn cannot end (`hasPendingOptionalKoReward`, replicated per move). So a card's later line runs in the same `executeHeroEffects` call as its earlier line, before any resolve.
3. **Hook order**: `executeHeroEffects` (`hero/heroEffects.execute.ts` ~L820) runs a card's hooks in ability-line order (`getHooksForCard`, `rules/heroAbility.types.ts` L418).
4. **Savior is evaluated at play**: `bystandersInVictoryAtLeast` is not in `WAIT_AND_SEE_CONDITION_TYPES` (`hero/deferredConditionalGrants.ts` L70), so a failed Savior gate never re-fires later in the turn.
5. **Parser** (`setup/heroAbility.setup.ts`): `KEYWORD_PATTERN` (L146) + the generic `isValidHeroKeyword` arm (L1508) push any `HERO_KEYWORDS` member with its `:N` magnitude, and the effect builder emits `{ type, magnitude }`. Step 1b (L1304) turns an inline `[team:X]` into `requiresTeam` unless a line flag suppresses it (`lineHasOptionalKoShieldOfficer`, L1169, is the precedent). The leading-prefix rule (`LEADING_GATE_PREFIX_PATTERN`, L131; D-24628) already keeps Reassign's body token non-gating. The icon-suppression blocks (the ko-wound-reward one starts L2270) drop a plain `attack` keyword when a reward keyword owns the icon.
6. **Keyword lockstep** (auto-memory `reference_hero_keyword_lockstep_sites`): `HeroKeyword` + `HERO_KEYWORDS` (`rules/heroKeywords.ts`, last member `'out-of-time'`, L104 / L191; 78 entries); in `hero/heroEffects.execute.ts`: `HANDLED_KEYWORDS` (L127), `HERO_EFFECT_HANDLERS` (L6269; 61 entries, last `'fight-cost-reduction'` L6448), `NO_MAGNITUDE_KEYWORDS` (L476; all three new keywords carry a magnitude, so none joins it). Count pins: `rules/heroKeywords.test.ts` L65-69 (78), `rules/heroAbility.setup.test.ts` L684 (78 + the ordered array), `setup/heroAbility.setup.test.ts` L1565 (78), `hero/heroEffects.execute.test.ts` L141 + L7877 (61).
7. **Projection** (`ui/uiState.build.ts` §13c): `eligibleHand` (L1643) is built with NO `koZones` check; discard (L1657) and inPlay (L1680) are gated on `koZones`. The inPlay loop (L1684) applies `heroesOnly` but NOT `shieldOnly`. No existing entry needs either (every `koZones` includes hand; every shield-only entry omits inPlay); Reassign needs both.
8. **Bot** (`simulation/ai.legalMoves.ts` L680-681): passes `allowInPlay` / `allowDiscard` to `selectDefaultOptionalKoTarget` (`hero/heroEffects.execute.ts` L6565), which always scans hand. The bot never declines.
9. **S.H.I.E.L.D. membership**: `cardCountsAsShieldHero` (`hero/effectiveTeams.logic.ts` L117) = printed team `shield` or one of the Agent / Trooper / Officer tokens.
10. **Card data** (`data/cards/ca75.json`, generated): the three lines are as quoted in §Goal, unmarked. `VALID_TOKEN_PATTERN` (`scripts/convert-cards/apply-hero-ability-markers.mjs` L123) is a closed list that rejects the three new tokens.
11. **Dashboard pin**: `apps/dashboard/src/composables/useInPlayCoverage.test.ts` pins `totalObs` 8714 against the committed feed.
12. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.
13. **Mechanic provenance**: `scripts/coverage/mechanic-provenance.json` keys each mechanic to `{ wp, decision }` and `hero-mechanic-ledger.mjs` joins it; the last row is `out-of-time` (WP-803 / D-24692). A new mechanic-implementing WP adds its rows (the file's `_comment`; WP-794 / WP-803 precedent).
14. **Client prompt**: `apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue` renders each of `eligibleHand` / `eligibleDiscard` / `eligibleInPlay` only when non-empty, with the generic heading plus `rewardLabel` (`Rescue a Bystander` / `+N Attack` from `deriveOptionalKoRewardLabel`, `ui/uiState.build.ts` L289), so an inPlay-only entry needs no client change.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why reuse the optional-KO queue.** Every printed "you may KO … if you do, <reward>" on main parks a `PendingOptionalKoReward`; the resolve move, its block-all guards, the UIState projection, `OptionalKoRewardPrompt.vue`, the bot short-circuit and both sim MOVE_MAPs already exist. Three new park handlers reuse all of it: no new move, no new `G` field, no new UIState field, no client change.
- **Why one keyword per printed shape** (not a parameter on `optional-ko-reward`). The precedent is `optional-ko-hand-discard`, `optional-ko-shield-officer`, `optional-ko-your-hero`: each printed zone / filter shape is its own closed-union member, so the marker map stays readable and the parser stays a generic `[keyword:X:N]` read.
- **Why "up to two" is two entries.** Each KO is its own optional choice; parking `min(N, eligible)` entries reuses the one-card-per-resolve contract. A KO never adds a S.H.I.E.L.D. Hero to hand or discard, so a surplus entry could only be declined.
- **Why the Savior line upgrades the parked entries** instead of granting at play. "For each card KO'd this way" is known only after the KOs resolve. Line 1 runs right after line 0 in the same play (Assumes 2-3); its own Savior gate decides whether the upgrade runs (Assumes 4), and the reward then fires per actual KO inside the existing resolve. The upgrade matches entries by `playerID`, `sourceCardId` and `rewardType 'none'`; Assumes 2 guarantees they are this play's.
- **Why Reassign may KO itself.** It is a S.H.I.E.L.D. Hero you played this turn; the printed text does not say "another". KO'ing a played card keeps the Attack it already produced (D-24442).
- **Why the projection and bot change.** Reassign's entry is the first that omits hand and the first shield-only entry that permits inPlay (Assumes 7-8). Without the fix the prompt offers hand cards the resolve rejects, and the bot emits a hand target the resolve rejects, which hangs the sim (the legalMoves↔guard divergence, auto-memory `reference_bot_legalmoves_moveguard_divergence`). Both fixes default to today's behavior for every existing entry.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (`[keyword:…]`).
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #1 (determinism) and #2 (engine owns truth; UIState projection integrity), §Layer Boundary (engine owns the rule; card data is a setup-time input).
- `docs/ai/DECISIONS.md`: scan D-24019, D-24442, D-24480, D-24498, D-24600, D-24563, D-24628, D-24464 before coding.
- User memory: `reference_hero_keyword_lockstep_sites`, `reference_pending_choice_wp_full_file_set` (no new move here, so the guard / MOVE_MAP sites are untouched), `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_engine_tests_never_typechecked`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- No randomness, no I/O, no registry access at runtime. Moves never throw; handlers never throw.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24759) before coding. One WP per session.

**Packet-specific:**
- **Card data is generated.** Edit `hero-ability-markers.json`, run `node scripts/convert-cards/apply-hero-ability-markers.mjs`, commit its output. Never hand-edit `data/cards/ca75.json`.
- **Reuse, don't fork.** No new move, pending queue, `G` field or UIState field. The resolve move is unchanged.
- **Lockstep.** The three keywords land in the union, the array, `HANDLED_KEYWORDS`, `HERO_EFFECT_HANDLERS` and the four count pins together. None joins `NO_MAGNITUDE_KEYWORDS`.
- **Defaults preserve every existing entry.** The projection's hand gate and inPlay shield filter, and the selector's `allowHand` (default `true`), change no existing entry's projection or bot pick; the existing projection / bot tests stay green unedited.
- **Regenerate derived artifacts honestly.** Run each `:check`; regenerate only what it reports stale, and record each regeneration with its observed delta.

## Locked Values

- **Keywords**, appended in this order after `'out-of-time'` in both the `HeroKeyword` union and `HERO_KEYWORDS` (78 → 81), in `HANDLED_KEYWORDS`, and in `HERO_EFFECT_HANDLERS` (61 → 64):
  - `'ko-up-to-shield-hand-discard'` → `heroEffectKoUpToShieldHandDiscard`
  - `'attack-per-ko-this-way'` → `heroEffectAttackPerKoThisWay`
  - `'optional-ko-shield-played-rescue'` → `heroEffectOptionalKoShieldPlayedRescue`
- **`heroEffectKoUpToShieldHandDiscard`**: eligible = hand ∪ discard cards with `cardCountsAsShieldHero`. 0 eligible → log `Player ${playerID} could not KO a S.H.I.E.L.D. Hero for ${card}'s ability — their hand and discard pile hold no S.H.I.E.L.D. Hero.` (default outcome) and park nothing. Else push `min(magnitude, eligible)` entries `{ playerID, rewardType: 'none', rewardMagnitude: 0, sourceCardId: cardId, koZones: ['hand', 'discard'], koTeamFilter: 'shield' }` (lazy-init the queue).
- **`heroEffectAttackPerKoThisWay`**: for each entry in `G.pendingOptionalKoRewards ?? []` with `playerID` and `sourceCardId` equal to this play's and `rewardType === 'none'`, set `rewardType = 'attack'`, `rewardMagnitude = magnitude`. If none matched, log (`'neutral'`) `Player ${playerID}'s ${card} gives +${magnitude} Attack for each card KO'd this way, but no card can be KO'd.`
- **`heroEffectOptionalKoShieldPlayedRescue`**: eligible = `inPlay` cards with `cardCountsAsShieldHero` (the played card itself included). 0 eligible → log `Player ${playerID} could not KO a S.H.I.E.L.D. Hero for ${card}'s ability — they played no S.H.I.E.L.D. Hero this turn.` (default outcome) and park nothing. Else push one `{ playerID, rewardType: 'rescue', rewardMagnitude: magnitude, sourceCardId: cardId, koZones: ['inPlay'], koTeamFilter: 'shield' }` (lazy-init the queue).
- **Provenance** (`scripts/coverage/mechanic-provenance.json`, after `out-of-time`): `"ko-up-to-shield-hand-discard"`, `"attack-per-ko-this-way"`, `"optional-ko-shield-played-rescue"`, each `{ "wp": "WP-826", "decision": "D-24759" }`.
- **Parser**: `const lineHasKoUpToShield = abilityText.includes('[keyword:ko-up-to-shield-hand-discard:');` joins the Step 1b suppression condition beside `lineHasOptionalKoShieldOfficer`. A new icon-suppression block, placed before the ko-wound-reward block, drops the plain `'attack'` keyword and its magnitude when `'attack-per-ko-this-way'` is on the line.
- **Projection** (`ui/uiState.build.ts` §13c): `const handPermitted = frontReward.koZones === undefined || frontReward.koZones.includes('hand');` gates the hand loop; the inPlay loop adds `if (shieldOnly && !cardCountsAsShieldHero(gameState, cardId)) { continue; }`.
- **Bot**: `selectDefaultOptionalKoTarget` gains a 6th parameter `allowHand: boolean = true` that skips the hand scan; `ai.legalMoves.ts` passes `const allowHand = front.koZones === undefined || front.koZones.includes('hand');`.
- **Marker validator**: `VALID_TOKEN_PATTERN` gains `^\[keyword:ko-up-to-shield-hand-discard:[1-9]\d*\]$`, `^\[keyword:attack-per-ko-this-way:[1-9]\d*\]$`, `^\[keyword:optional-ko-shield-played-rescue:[1-9]\d*\]$`.
- **Counts:** if another keyword WP lands first, use the current N → N+3 / M → M+3; the lockstep intent governs, and record the observed counts.
- **Markers** (`hero-ability-markers.json`, `ca75` array, after the Paramilitary Ops entry, in this order; shape `{ heroSlug, cardSlug, abilityIndex, markupToken }`):
  - `agent-x-13` / `mobilize-for-war` / 0 / `[keyword:ko-up-to-shield-hand-discard:2]`
  - `agent-x-13` / `mobilize-for-war` / 1 / `[keyword:attack-per-ko-this-way:1]`
  - `steve-rogers-director-of-shield` / `reassign-to-civilian-duty` / 0 / `[keyword:optional-ko-shield-played-rescue:1]`

## Scope (In)

- **A)** `rules/heroKeywords.ts`, `hero/heroEffects.execute.ts` (three handlers, both registries, the selector's `allowHand`), `setup/heroAbility.setup.ts` (the Step 1b flag and the icon suppression).
- **B)** `ui/uiState.build.ts` (hand gate, inPlay shield filter) and `simulation/ai.legalMoves.ts` (`allowHand`).
- **C)** Tests: NEW `hero/ca75OptionalKoShield.test.ts` (T1-T12); one case each in `ui/uiState.build.test.ts` (T13) and `simulation/ai.legalMoves.test.ts` (T14); the four count pins.
- **D)** `scripts/convert-cards/apply-hero-ability-markers.mjs` (validator) and `scripts/convert-cards/inputs/hero-ability-markers.json` (3 markers) → regenerated `data/cards/ca75.json`; and `scripts/coverage/mechanic-provenance.json` (3 rows).
- **E)** Regenerated derived artifacts that their `:check` reports stale, and the dashboard totalObs pin that follows the runtime-observed feed.

## Out of Scope

- The co-printed siblings that share the shape but are not ca75: dkcy "KO any number of cards from your hand. You get +1[icon:attack] for each card KO'd this way." and dead's Excessive Violence "KO up to two [team:hydra] and/or [team:shield] Heroes from your discard pile. Draw a card for each Hero KO'd this way." (other zones / rewards / team filters; a follow-up can reuse `attack-per-ko-this-way`).
- A bot that declines a KO (the bot never declines, D-24019); the bot KO'ing Reassign itself when it is the cheapest played S.H.I.E.L.D. Hero is accepted.
- Any client change; any new move, pending queue or `G` / UIState field.
- The other remaining Cap 75th items (Flying Shield Block, Winter Soldier, the three schemes).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/heroKeywords.ts`, `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`: modified
- `hero/heroEffects.execute.ts`, `hero/heroEffects.execute.test.ts`: modified
- `hero/ca75OptionalKoShield.test.ts`: **new**
- `setup/heroAbility.setup.ts`, `setup/heroAbility.setup.test.ts`: modified
- `ui/uiState.build.ts`, `ui/uiState.build.test.ts`: modified
- `simulation/ai.legalMoves.ts`, `simulation/ai.legalMoves.test.ts`: modified

**Card data + scripts**
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json`: modified
- `scripts/coverage/mechanic-provenance.json`: modified (three rows `{ "wp": "WP-826", "decision": "D-24759" }` for `ko-up-to-shield-hand-discard`, `attack-per-ko-this-way`, `optional-ko-shield-played-rescue`, after `out-of-time`)
- `data/cards/ca75.json` — regenerated

**Derived artifacts (regenerated only if their `:check` reports stale; the scaffold saw all five)**
- `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv` — regenerated
- `data/metadata/effect-implementation-index.json` — regenerated
- `data/metadata/card-mechanics.json` — regenerated
- `docs/ai/coverage/runtime-observed-hollows.json` — regenerated
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts`: the totalObs pin, re-pinned only to the regenerated feed's value, with a dated comment

That is 15 hand-edited files (7 tests, 4 of them count pins) plus up to 6 regenerated artifacts. It sits above the ~8 guideline because the hero-keyword lockstep spans four pin files and the card-data pipeline fans one marker edit out to generated feeds (the WP-824 precedent); nothing in the regenerated set is hand-authored.

**Governance:** `docs/ai/DECISIONS.md` (D-24759), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note)

## Contract

- Three new `HeroKeyword` values (closed canonical set, recorded in D-24759) with the handlers in Locked Values. All three park or modify `PendingOptionalKoReward` entries using fields that already exist.
- `selectDefaultOptionalKoTarget` gains an optional trailing `allowHand` parameter (default `true`).
- The optional-KO projection lists hand cards only when `koZones` permits hand, and applies `koTeamFilter` to inPlay. Both are no-ops for every pre-existing entry.
- No new move, condition type, effect field, `G` field or UIState field. `ca75.json` gains three marker tokens; the hooks change for those three lines only.

## Test Contract

Real-data cases (`ca75OptionalKoShield.test.ts`) build hooks from `data/cards/ca75.json` via `buildHeroAbilityHooks` (the `ca75CountScaledHeroLines.test.ts` pattern), play the first copy through `executeHeroEffects`, then resolve with `resolveOptionalKoReward`. "Savior" = 3 `pile-bystander` in the Victory Pile. S.H.I.E.L.D. targets are the Agent / Trooper / Officer tokens (no trait row needed) plus, for Reassign, the card itself (trait row `team: 'shield'`); the non-S.H.I.E.L.D. card is an Avengers id.

| # | Input | Expected | Invariant |
|---|---|---|---|
| T1 | Mobilize hooks | 2 hooks; line 0 no conditions, effects `[{ ko-up-to-shield-hand-discard, 2 }]`; line 1 Savior condition, effects `[{ attack-per-ko-this-way, 1 }]` | no gate on line 0; no flat attack; `WAIT_AND_SEE_CONDITION_TYPES` excludes `bystandersInVictoryAtLeast` |
| T2 | Mobilize, not Savior; hand Agent + Avenger, discard Officer | 2 entries `{none, 0, koZones [hand, discard], shield}`; KO both → Attack 0, KO pile both | no flat grant |
| T3 | Mobilize, Savior; hand Agent, discard Trooper | 2 entries `{attack, 1}`; Attack 0 at play, 1 after the first KO, 2 after the second | per actual KO |
| T4 | T3 shape, KO one then decline | Attack 1 | decline grants nothing |
| T5 | Savior, one eligible S.H.I.E.L.D. Hero | 1 entry; KO → Attack 1 | `min(N, eligible)` |
| T6 | Savior, resolve with the Avenger | no KO, entry still pending | shield filter |
| T7 | Savior, no S.H.I.E.L.D. Hero | nothing parks, Attack 0, both "could not KO" and "for each card KO'd this way" lines logged | honest no-op |
| T8 | Reassign hooks | 1 hook, `requiresTeam shield ×3`, effects `[{ optional-ko-shield-played-rescue, 1 }]` | gate kept |
| T9 | Reassign after Agent, Trooper, Officer, Avenger | 1 entry `{rescue, 1, koZones [inPlay], shield}`; KO the Trooper → KO pile, Bystander to Victory Pile | KO then rescue |
| T10 | T9, resolve with a hand Agent, then the played Avenger, then Reassign itself | first two rejected (queue intact); self KO'd + rescue | zone + filter; self legal |
| T11 | Reassign, decline | no KO, no rescue, queue empty | |
| T12 | Reassign after only 2 other S.H.I.E.L.D. | nothing parks | triple gate |
| T15 | Mobilize as a Savior with a foreign `{ rewardType: 'none', sourceCardId: 'other#0' }` entry already queued | the foreign entry stays `'none'`; only this play's two entries become `{attack, 1}` | upgrade matches `sourceCardId` |
| T13 | projection (`uiState.build.test.ts`): entry `koZones [inPlay]`, shield; S.H.I.E.L.D. tokens in hand and discard, a non-S.H.I.E.L.D. card in play | hand `[]`, discard `[]`, inPlay only the played S.H.I.E.L.D. cards in order; label `Rescue a Bystander` | round-trip rule |
| T14 | bot (`ai.legalMoves.test.ts`): same entry; cheaper S.H.I.E.L.D. in hand / discard, a cheaper non-S.H.I.E.L.D. played card | single move `{ zone: 'inPlay', cardId: <cheapest played S.H.I.E.L.D. Hero> }` | no sim hang |

The four count pins move 78 → 81 (three files) and 61 → 64 (two asserts in one file).

## Vision Alignment

**Vision clauses touched:** §1 (rules authenticity: the cards do what they print), §10 (content as data: marker-map input), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (rules fidelity only, no paid or persuasive surface).

**Determinism preservation:**
- Every handler is a pure function of `G`; no randomness. The bot's pick stays deterministic (lowest cost, fixed scan order).
- The hooks change only for three ca75 lines; `finalStateHash` / `PRE_WP080_HASH` fixtures play no ca75 hero (the scaffold's full engine run is the evidence; a moved hash is a STOP).
- **Replay compat:** a stored match replays from its bgio `initialState`, which holds its setup-time hooks, so a pre-deploy match keeps the old hooks and replays identically. Only matches created after the deploy carry the new behavior. No stored-match migration.
- No PAR seed or profile artifact and no gauntlet config contains a ca75 hero (grep-verified at drafting), so none is regenerated.
- The fixed-seed runtime-observed sweep shifts (§Scaffold). It is a coverage feed, not a hash gate, and it is regenerated in this packet.

## Funding Surface Gate

§20 **N/A**: engine and card data only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Behavior.** T1-T12 and T15 pass on the regenerated `data/cards/ca75.json`; T13 and T14 pass.
2. **Lockstep.** The four count pins read 81 / 64 and pass; the existing optional-KO projection, resolve and bot tests pass unedited.
3. **Revert proofs.** (a) With the baseline `data/cards/ca75.json` swapped in, T1-T11 and T15 fail (T12 passes either way: the gate is unchanged; T1-T11 observed at drafting). (b) With the `handPermitted` gate reverted in `uiState.build.ts`, T13 fails. (c) With the `allowHand` argument removed from the `ai.legalMoves.ts` call, T14 fails. (d) With the inPlay `shieldOnly` filter reverted in `uiState.build.ts`, T13 fails. Each is restored afterwards.
4. **Card data.** `apply-hero-ability-markers.mjs` reports exactly 3 lines updated; `pnpm cards:check` and `pnpm cards:count-markers:check` exit 0.
5. **Derived gates.** `pnpm ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `gauntlet:loadouts:check`, `sim:runtime-observed:check` and `sim:coverage --check` exit 0 on the committed tree.
6. **Dashboard.** After `pnpm --filter @legendary-arena/dashboard run prebuild:coverage`, `pnpm --filter @legendary-arena/dashboard test:coverage` passes. Only the `totalObs` literal changes, by the feed's `summary.totalObservations` delta. `resolvedObs` and `percentResolved` stay byte-unchanged; if either would move, or the feed's `distinctMechanics` ≠ 79 or `hollowEffectsDropped` ≠ 0, STOP. Then `pnpm --filter @legendary-arena/dashboard typecheck` exits 0, and `format:check` exits 0.
7. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail.
8. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass. Expected delta: +15 tests (+2 suites: the new file's 13 tests (T1-T12, T15) in 2 suites, plus T13 and T14 in existing suites; scaffold 5672 → 5686 without T15). A different delta is explained, never tuned.
3. AC 3 revert proofs, each from `packages/game-engine` with `node --import tsx --test <file>` and restored afterwards: (a) `git restore --source "$(git merge-base HEAD origin/main)" -- data/cards/ca75.json` (from the repo root), run `src/hero/ca75OptionalKoShield.test.ts`, then `node scripts/convert-cards/apply-hero-ability-markers.mjs` from the repo root and confirm `git diff --stat -- data/cards/ca75.json` matches the pre-proof state; (b), (c) and (d) revert the one line, run `src/ui/uiState.build.test.ts` / `src/simulation/ai.legalMoves.test.ts`, restore.
4. Regen chain, in order, each step only if its `:check` reports stale after the prior step: `node scripts/convert-cards/apply-hero-ability-markers.mjs` → `pnpm -r build` → add the provenance rows → `pnpm ledger:heroes` → `pnpm effect-index` → `pnpm mechanics:metadata` → `pnpm sim:runtime-observed`. Then each check in AC 4-5 → 0. Whenever the feed moved: `pnpm --filter @legendary-arena/dashboard run prebuild:coverage`, then re-pin per AC 6.
5. Run the dashboard trio in AC 6.
6. `pnpm -r --no-bail test` → 0 fail.
7. `git status --porcelain` (tracked and untracked) ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] Every Acceptance Criterion passes and the diff is allowlist-only.
- [ ] D-24759 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]` with date, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-864:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). On `play.legendary-arena.com`, after `/api/version` shows a gitSha that contains the merge, in a 2-player operator (debug) match created after the deploy, seat 1 a bot ally, Agent X-13 and Steve Rogers, Director of S.H.I.E.L.D. in the loadout:
  - Mobilize for War with an Agent in hand and a Trooper in discard, not a Savior: two prompts listing only S.H.I.E.L.D. Heroes, no reward label; KO both → both in the KO pile, Attack unchanged.
  - Stage 3 Bystanders into your Victory Pile and play Mobilize again: each prompt shows `+1 Attack`; KO one and decline the other → +1 Attack.
  - Reassign after three other S.H.I.E.L.D. cards: one prompt listing only the S.H.I.E.L.D. Heroes you played this turn, `Rescue a Bystander`; KO an Agent → a Bystander joins your Victory Pile.
  - Reassign after only two other S.H.I.E.L.D. cards: no prompt; the log names the failed gate.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24759 — ca75-optional-ko-shield.** It locks:
- the three keywords and their entries on the shared optional-KO queue (no new move, queue or field);
- "KO up to N" as `min(N, eligible)` independent optional entries;
- the later-line per-KO reward as an upgrade of this play's still-pending no-reward entries, gated by the later line's own condition (Savior, evaluated at play);
- Reassign's played-this-turn scope including the card itself;
- the projection hand gate / inPlay shield filter and the bot `allowHand`, both defaulting to today's behavior;
- the replay-compat note and the runtime-observed / dashboard re-pin;
- the dkcy / dead "for each card KO'd this way" siblings as a recorded follow-up;
- known limitation: a multi-play move (Steal Abilities, `replayOutOfTimeCards`) can park more S.H.I.E.L.D.-only entries than eligible cards, since each parker counts eligibility alone (pre-existing D-24498 class; Mobilize alone cannot trigger it);
- that `attack-per-ko-this-way` requires an on-play-evaluated gate; making its gate wait-and-see requires revisiting the upgrade;
- telemetry note: `heroClauseValue` has no case for `attack-per-ko-this-way`, so Mobilize's Savior clause value reads 0 instead of the old flat 1 (Realized Value metric only).

---

## Gate Record

**Pre-flight (01.4) (independent subagent): READY TO EXECUTE after one blocking fix, applied (no re-run needed, per the reviewer).** Verified every Assumes anchor at the cited lines on `56bb0412`; dependencies all `[x]`; the four touched test files 298 / 0 under tsx; the only `koZones` park sites (L2962 / L3016 / L3994) all include hand, so `handPermitted` / `allowHand` are no-ops for them; no other count pin or exhaustive `Record<HeroKeyword>` map; Copy Powers re-runs both lines under one id; hero ids are per copy (`#N`).
- **PS-1 (fixed):** `scripts/coverage/mechanic-provenance.json` (three `{ wp, decision }` rows) was missing from scope; `hero-mechanic-ledger.mjs` joins it. Added to Assumes 13, Scope D, Files, Locked Values, Verification 4 and the EC.
- **RS-1..RS-6 (applied):** EC Locked Values copied verbatim; "(lazy-init the queue)" / "(default outcome)" locked on both park handlers; the multi-play over-park known limitation and the `heroClauseValue` telemetry note added to D-24759; T15 (a foreign queued entry is not upgraded) added; `workindex:rows:check` / `workindex:executed:check` added to the DoD.

**Copilot (01.7) (independent subagent): RISK (HOLD), six scope-neutral fixes, all applied; pre-flight stands.** Clean: FM 1, 3, 5-10, 13-25, 27-29 (cross-line coupling is the simplest faithful design without a new field; "up to two" as `min(N, eligible)` matches the printed text; resolve / projection / bot agree; no PAR, gauntlet or sim baseline beyond runtime-observed holds a ca75 hero).
1. FM 11: AC 3 omitted T15 and had no proof for the inPlay shield filter → AC 3 (a) now lists T15; (d) added.
2. FM 26 / 11: Assumes 4 (Savior evaluated at play) had no pin → T1's invariant asserts `WAIT_AND_SEE_CONDITION_TYPES` excludes it; D-24759 records the dependency.
3. FM 4: count literals can go stale → Locked Values say N → N+3 governs.
4. FM 30: gate records were pending → this record and the lint table.
5. FM 11: the revert-proof ref `origin/main` moves → `git merge-base HEAD origin/main`.
6. FM 12 / 2: dashboard `format:check` added to AC 6; the PAR / gauntlet no-regeneration line added to Determinism.

**Lint (00.3) (independent subagent): FAIL → PASS after the provenance fix (same as PS-1) and four EC fixes, applied** (see §Lint Gate Self-Review). Run in parallel with pre-flight; the copilot round audited the fixed text.

**Final gate state:** pre-flight READY TO EXECUTE · copilot RISK (every concern fixed and recorded above) · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 sections present and non-empty; 8 ACs; 4 Out-of-Scope items |
| §2 | PASS — full files, no diffs, ESM / Node 22, 00.6, packet-specific rules, session protocol; separate Locked Values |
| §3 | PASS — 14 Assumes items with verified anchors (provenance added), a baseline, a BLOCKED clause |
| §4 | PASS — 00.2 §5, ARCHITECTURE #1 / #2 / Layer Boundary, DECISIONS scan list, memory refs |
| §5 | PASS — every referenced file listed (provenance added); derived entries tagged "regenerated"; size justified |
| §6 | PASS — `koZones`, `koTeamFilter`, `rewardType`, `rewardMagnitude`, `sourceCardId`, `bystandersInVictoryAtLeast` as defined in `types.ts` |
| §7 | PASS — no new dependencies |
| §8 | PASS — engine-only; no new move, `G` or UIState field (the five-step UIState contract does not apply); markers go through the setup pipeline |
| §9 | PASS — pnpm / node / git commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — node:test, local data only, no boardgame.io, network or DB |
| §13 | PASS — exact commands with expected deltas |
| §14 | PASS — 8 binary ACs tied to T-numbers and named commands |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes, allowlist-only diff; live-verify on `play.legendary-arena.com` with log evidence |
| §16 | PASS — `handPermitted` / `allowHand` mirror `discardPermitted` / `inPlayPermitted` / `allowDiscard`; `for…of`, full names, JSDoc |
| §17 | PASS — §1 / §10 / §8 / §22 / §23 / §24 / NG-1; conflict line; determinism and replay lines |
| §18 | N/A — no forbidden-token grep |
| §19 | N/A — commit-time discipline |
| §20 | PASS — N/A with reason (engine and card data only) |
| §21 | PASS — N/A with reason (no endpoint or `apps/server/src/**` surface) |

EC-864 vs EC-TEMPLATE: FAIL → PASS after four fixes: Locked Values copied verbatim from the WP; the dashboard typecheck in Before Starting; the provenance file in Files to Produce and the regen chain; "WORK_INDEX `[x]` with date". Section order matches; well under the 100-line ceiling. Advisories applied: A1 (Assumes 6 names `hero/heroEffects.execute.ts`), A2 (EC: rebuild before any check), A3 (Assumes 14, the client prompt), A4 (revert via `git restore`).

**Verdict:** PASS.
