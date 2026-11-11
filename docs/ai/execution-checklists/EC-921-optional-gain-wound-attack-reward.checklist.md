# EC-921 — Optional gain-a-Wound → Attack reward keyword (Execution Checklist)

**Source:** docs/ai/work-packets/WP-883-optional-gain-wound-attack-reward.md
**Layer:** Game Engine + Card Data + arena-client (one heading)
**Risk Tier:** MEDIUM — gameplay rules (a new hero keyword, one seat-choice kind, a reward that follows Diving Block / Flying Shield Block outcomes) plus card data, derived feeds and one client heading; no auth, money, persistence or server surface

## Before Starting
- [ ] Baseline `origin/main` includes #3278 (the reserve) and the WP-883 draft SPEC.
- [ ] `pnpm install` and `pnpm -r build` → 0. Engine suite green (6884 / 0 at draft). `pnpm --filter @legendary-arena/arena-client typecheck` and `pnpm --filter @legendary-arena/dashboard typecheck` → 0.
- [ ] Anchors (`heroAbility.setup.ts`): `KO_WOUND_REWARD_PATTERN` `:322`, `KO_WOUND_REWARD_SEEDED_REWARDS` `:480`, Step 2f `:2240-2258`, reward-icon suppression `:2591`, descriptor arm `:2812`, `DAY_NIGHT_UNMODELED_LINES` `:968` (Scalded `:972`).
- [ ] Anchors elsewhere:
  - `heroEffects.execute.ts`: `HANDLED_KEYWORDS` `:165`, `NO_MAGNITUDE_KEYWORDS` `:588`, `failsMagnitudePreGate` `:800`, `heroEffectRandomActs` `:4611`, `heroEffectKoWoundReward` `:4938`, `HERO_EFFECT_HANDLERS` `:7565`.
  - `wounds.logic.ts` `gainWoundWithOutcome` `:125`.
  - `divingBlock.logic.ts`: opener `:247`, apply `:310` (lookup `:327`), reveal `:360`.
  - `flyingShieldBlock.logic.ts`: `checkFlyingShieldBlock` `:154`, `dropUninterceptableWounds` `:196`, `buildSeatPrompt` `:219`, apply `:301` (lookup `:313`), decline `:340`, reveal `:368`.
  - `seatChoice.resolve.ts`: `applySeatChoiceByKind` `:600`, `applySeatChoiceTimeoutDefault` `:963`.
  - `ai.seatChoice.ts` `chooseByKind` `:110`; `types.ts` `:1543` / `:1788` / `:1805`; `PendingSeatChoicePrompt.vue` `heading()` `:88`.
- [ ] Count pins: read the CURRENT values (98 keywords / 77 handlers at draft) at all **three** `HERO_KEYWORDS` length pins: `rules/heroKeywords.test.ts:70`, `rules/heroAbility.setup.test.ts:703` (+ `expectedKeywords` `:601`) and `setup/heroAbility.setup.test.ts:1613`. Also read both handler pins (`heroEffects.execute.test.ts:156`, `:8126`). A keyword WP landing first moves them; +1 each governs, not the literal.
- [ ] Re-grep `gain a Wound. If you do, you get` across `data/cards/*.json` → only co2e Hulk Smash! and mdns Scalded by Sunlight.
- [ ] Scope lock: the target file set is exactly §Files to Produce; anything else needs an inline amendment (01.5).

## Locked Values (do not re-derive)

**Keyword + parser**
- `HeroKeyword` `'gain-wound-reward'` appended last (union + `HERO_KEYWORDS`); in `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS`; NOT in `NO_MAGNITUDE_KEYWORDS`.
- `GAIN_WOUND_REWARD_PATTERN = /\[keyword:gain-wound-reward:([a-z][a-z-]*):(\d+)\]/g`; `GAIN_WOUND_REWARD_SEEDED_REWARDS = { 'attack' }` (parser copy + logic-module copy). **Step 2g**, after Step 2f. Descriptor `{ type: 'gain-wound-reward', magnitude: n, rewardType: 'attack' }` only when seeded and `n >= 1`.
- Reward-icon suppression on the line (D-24570 sibling): drop the plain `attack` keyword + magnitude.
- `DAY_NIGHT_UNMODELED_LINES` loses exactly `'mdns/morbius/scalded-by-sunlight:sunlight'` (8 → 7). Rewrite the `:969-970` comment and correct its stale `D-24606` to `D-24600`.
- Validator alternative `^\[keyword:gain-wound-reward:[a-z][a-z-]*:[1-9]\d*\]$` (+ error-message list).
- Card Map: `co2e/hulk/hulk-smash`[0] `[keyword:gain-wound-reward:attack:5]`; `mdns/morbius/scalded-by-sunlight`[0] `[keyword:gain-wound-reward:attack:2]`.

**Types, modules, choice**
- `GainWoundReward { rewardType: 'attack'; magnitude: number; sourceCardId: CardExtId }`. One field name `gainWoundReward?` on `PendingSeatChoice`, `PendingDivingBlockWound` and `PendingFlyingShieldBlockWound` (never projected).
- Leaf `hero/gainWoundRewardGrant.ts`: `grantGainWoundReward(G, recipientID, reward, isAfterInterception)` switches on `rewardType` (one arm: `addResources(G.turnEconomy, magnitude, 0)` + L4 / L7). Imports only `addResources`, `pushLog`, `formatCardRef`, types.
- `hero/gainWoundReward.logic.ts`: `GAIN_WOUND_REWARD_SEAT_CHOICE_KIND = 'gain-wound-reward'`; option 0 `Gain a Wound: you get +N Attack`, option 1 `Don't gain a Wound`; `defaultOptionIndex` 1; one addressed seat; parked via `parkSeatChoice(G, undefined, …)`. No boardgame.io or `heroEffects.execute.ts` import. Module constants are literals; imported bindings are used only inside function bodies. Each new cross-import carries a `// why:` cycle note (D-24760 / WP-845 style): `seatChoice.resolve` → this module → `wounds.logic` → `divingBlock.logic` → `seatChoice.resolve`.
- Handler order (magnitude < 1 never arrives; `failsMagnitudePreGate` drops it): unseeded → L0; empty supply → L2, no prompt; `G.pendingSeatChoice` open → L9; else park + L1. Parking does not halt the hook loop (harmless for both cards; the follow-up revisits it).
- Apply: decline → L3. Gain → note the Flying Shield Block queue length, call `gainWoundWithOutcome`:
  - `'no-wound'` → L6, no reward;
  - otherwise `woundsDrawn += 1`;
  - `'diving-block-pending'` → tag the seat's last Diving Block entry, L5;
  - `'gained'` with a grown Flying Shield Block queue → tag its last entry, L5;
  - else grant now (L4). This includes a copy already in `flyingShieldBlockUsedThisTurn` (nothing parks).

**Keep or forfeit, labels, bots**
- Diving Block: reveal of a tagged entry → L8. Decline → move the tag onto the entry `checkFlyingShieldBlock` parked, else grant (L7).
- Flying Shield Block:
  - L8 inside the reveal branch (`copy !== undefined`).
  - Grant (L7) only when `applyFlyingShieldBlockDecline` returns true, including the reveal-without-copy fall-through; a decline that leaves candidates keeps the tag.
  - `dropUninterceptableWounds` grants each tagged entry it drops (L7).
- `applySeatChoiceTimeoutDefault`: on `gain-wound-reward` → L3, no Wound; on a tagged Diving Block / Flying Shield Block entry → kept, L7.
- Tagged-entry decline labels (N filled in):
  - `Take the Wound (keep +N Attack)` in `openDivingBlockSeatChoiceIfNeeded` (the seat's first entry) and in `buildSeatPrompt` for the recipient;
  - `Let Player {r} take the Wound (they keep +N Attack)` for another seat.
  - Untagged labels unchanged.
- Bot (playing seat):
  - `gain-wound-reward` → 0 iff the `fightVillain` + `fightMastermind` count from `getLegalMoves({ ...G, pendingSeatChoice: undefined, turnEconomy: addResources(G.turnEconomy, magnitude, 0) }, …)` exceeds that from `getLegalMoves({ ...G, pendingSeatChoice: undefined }, …)`, else 1. G is never written.
  - `diving-block`: the first `G.pendingDivingBlockWounds` entry with `playerID === seat`. `flying-shield-block`: the entry with `addressedSeat === seat`. Either one tagged → return `choice.defaultOptionIndex`; untagged → reveal as today.
  - Autoplay / sim / PAR keep the default.
- Client heading `'Gain a Wound for extra Attack?'`.

**Log lines** (verbatim; all `pushLog(G, text, outcome, sourceCardId)`; `{card}` = `formatCardRef(G.cardDisplayData, sourceCardId)`; L1 and L3-L8 end with `({card})`, L2 / L9 name it inline, L0 carries it only as the argument)
- L0 `Player {p} played a hero ability whose gain-a-Wound reward is not yet supported, so it was skipped.` [blocked] · L1 `Player {p} may gain a Wound for +{N} Attack ({card}).` [neutral]
- L2 `Player {p}'s {card} did nothing — the Wound supply is empty.` [blocked] · L3 `Player {p} chose not to gain a Wound ({card}).` [neutral]
- L4 `Player {p} gained a Wound and got +{N} Attack ({card}).` [applied] · L5 `Player {p} would gain a Wound — +{N} Attack if they keep it ({card}).` [neutral]
- L6 `Player {p} could not gain a Wound — the Wound supply is empty, so no Attack ({card}).` [blocked] · L7 `Player {p} kept the Wound and got +{N} Attack ({card}).` [applied]
- L8 `Player {p}'s Wound was prevented, so no +{N} Attack ({card}).` [blocked] · L9 `Player {p}'s {card} could not offer its Wound choice — another choice is open.` [blocked]

## Guardrails
- "If you do" is honest: never +N without a Wound actually gained and kept (no free grant at land, none on an empty supply, none after a reveal).
- The Wound goes through `gainWoundWithOutcome` only — never the bare `gainWound` helper.
- Untagged Diving Block / Flying Shield Block entries behave and are labelled byte-identically; every existing interception test passes unedited.
- All six keyword lockstep sites (three keyword pins) move together; a magnitude keyword stays out of `NO_MAGNITUDE_KEYWORDS`.
- The only existing assertions edited are the `setup/heroAbility.setup.test.ts:1857` Scalded by Sunlight case (intentional; say so in the `EC-921:` body), plus the count pins and, only if the regenerated runtime feed moved them, the dashboard `totalObs` / `percentResolved` pins (after `pnpm --filter @legendary-arena/dashboard prebuild:coverage`).
- `gainWoundReward.test.ts` builds hooks with `buildHeroAbilityHooks` from the regenerated card data, never hand-written hooks.
- No new move, no UIState field, no `game.ts` / `index.ts` edit; the four other "may gain a Wound" lines stay untouched; `effect-rulings.json` not touched.
- Moves and effects never throw. No `.reduce()` for branching. No `git stash`.

## Required `// why:` Comments
- Handler: why a prompt (a real trade, unlike D-24183's auto-resolve) and why the seat choice (D-24500 precedent, no new move / projection).
- Empty-supply no-prompt: rules v23 L3199-3201 / D-24779. Parking does not halt the hook loop (both cards single-firing).
- Chokepoint + tag: the Wound lands first, the reveal resolves later (D-24673); "instead" means not gained, so the reward waits.
- The Flying Shield Block length check: `gainWoundWithOutcome` reports `'gained'` even when Flying Shield Block parked.
- Tag transfer on a declined Diving Block (D-24760); grant site: the recipient is the active player.
- Import-cycle notes on every new cross-import; the leaf grant module exists to keep Diving Block / Flying Shield Block cycle-free.
- Bot answers: gain only when a fight opens; decline a reveal on a Wound taken on purpose; lookup mirrors the apply.
- `DAY_NIGHT_UNMODELED_LINES` removal (D-24600 precedent); reward-icon suppression (D-24570).

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` + `heroKeywords.test.ts`; `rules/heroAbility.setup.test.ts` (pin) — **modified**
- `packages/game-engine/src/hero/heroEffects.execute.ts` + `heroEffects.execute.test.ts` (pins) — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.ts` + `setup/heroAbility.setup.test.ts` (migration + `:1613` pin) — **modified**
- `packages/game-engine/src/hero/gainWoundReward.logic.ts`, `hero/gainWoundRewardGrant.ts`, `hero/gainWoundReward.test.ts` — **new**
- `packages/game-engine/src/types.ts`, `moves/seatChoice.resolve.ts`, `moves/divingBlock.logic.ts`, `moves/flyingShieldBlock.logic.ts`, `simulation/ai.seatChoice.ts` + `ai.seatChoice.test.ts` — **modified**
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + `.test.ts` — **modified**
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/coverage/mechanic-provenance.json`, `docs/ai/coverage/live-verify.json` — **modified**
- `data/cards/co2e.json`, `data/cards/mdns.json`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**
- `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **only if their gates flag**
- `docs/ai/DECISIONS.md` (D-24834 appended Active), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0. Markers idempotent; `--validate` 0.
- [ ] Eight gates → 0 (`cards`, `cards:count-markers`, `effect-index`, `mechanics:metadata`, `ledger:heroes`, `sim:runtime-observed`, `sim:coverage`, `ledger:numbers`).
- [ ] Engine suite passes (every WP §Scope G case, incl. two Flying Shield Block holders, `dropUninterceptableWounds`, timeout default, used-this-turn copy, labels, [untagged, tagged] bot waves, bot purity); `pnpm -r --no-bail test` → 0 fail; arena-client + dashboard `typecheck` → 0; core `finalStateHash` and `PRE_WP080_HASH` unchanged.
- [ ] Ledger: `gain-wound-reward` = `executable` for `co2e/hulk` and `mdns/morbius`; `sunlight` hitCount before / after in the `EC-921:` body.
- [ ] D-24834 appended Active. STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology. Live-verify (D-24026) post-deploy on a NEW match.

## Common Failure Smells
- Hulk Smash! still gives +5 with no prompt → the reward-icon suppression is missing, or the marker never reached `co2e.json`.
- The handler is registered but nothing happens → `gain-wound-reward` missing from `HANDLED_KEYWORDS`.
- Gain then reveal Diving Block still yields +N → the grant fired at land instead of being tagged.
- A Flying Shield Block reveal by another seat leaves +N → the queue-length check is missing (`'gained'` was trusted).
- +N granted after the first of two Flying Shield Block holders declines → the grant ignored `applyFlyingShieldBlockDecline`'s return.
- Scalded by Sunlight still logs a `sunlight` hollow → the `DAY_NIGHT_UNMODELED_LINES` entry is still present.
- A bot gains a Wound and then reveals Diving Block on it → the bot read the wrong entry (not the first with `playerID === seat`).
