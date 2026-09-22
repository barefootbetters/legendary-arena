# EC-773 — "Excessive Violence" fight-overspend hero keyword (Execution Checklist)

**Source:** docs/ai/work-packets/WP-736-excessive-violence-hero-keyword.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] Baseline: `origin/main` @ `c423a8ce` (or later, incl. the WP-736 reserve commit); working tree clean, synced.
- [ ] D-21602 landed. Of the 4 wired cards, ONLY `vnom/venompool/can-i-get-a-little-gratitude` idx1 is in `_deferred`; `carnage/rending-claws`, `venom/razor-teeth`, `venom-rocket/serious-overkill` are ABSENT from the marker map (runtime-observed hollows only).
- [ ] WP-735 shipped: `digest-indigestion` wrapper descriptor + `buildDigestIndigestionFusion` + allowlist threading + reentrant `executeSingleEffect` branch dispatch — the direct template for this WP.
- [ ] Hero substrate: `HeroKeyword` union + `HERO_KEYWORDS`; `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS` + `MVP_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`; bidirectional drift tests. **READ the current baseline counts at execution — do NOT trust a number written here (concurrent WPs move them).**
- [ ] `executeHeroEffects` fires ALL hooks at PLAY time and does NOT filter by timing (`hero/heroEffects.execute.ts` ~666 / comment ~248). No fight-time hero-hook executor exists today.
- [ ] `HeroEffectDescriptor` self-recursive since WP-735 (`digestEffects?`); `HeroAbilityTiming` has `'onFight'`; `KEYWORD_TIMING_DEFAULTS` (~426) maps a keyword→default timing.
- [ ] `TurnEconomy` omit-when-off flags `recruitSpendableAsAttack?` / `drawsLocked?`; `carryConversionFlag` (~499) is the single carry chokepoint; `enableDrawLock` (~671) the setter shape; `resetTurnEconomy` (~725) drops the flags each turn.
- [ ] Reentrant `executeSingleEffect(G, ctx, playerID, cardId, effect)` (~4983), gated by `MVP_KEYWORDS`. Inner executors shipped: `heroEffectDraw`, flat `recruit` primitive, `heroEffectRescue`, `heroEffectOptionalKoHandDiscard` (WP-667).
- [ ] Fight moves: `fightVillain` / `fightMastermind` gate on `getSpendableAttack >= requiredFightCost`, debit via `spendFightCost`; `defeatCityVillainCore` runs a post-defeat consequence pipeline (WP-542 `playTopVillainDeckCards` tail).
- [ ] Inner markers already legal: `[keyword:draw:N]`, `[keyword:rescue:N]`, `[keyword:optional-ko-hand-discard]` in `VALID_TOKEN_PATTERN`; `[icon:recruit]` parses to flat recruit. NO apply-script change.
- [ ] `pnpm -r build` 0; engine test + `cards:check` + `effect-index:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` + `sim:coverage --check` green.
- [ ] Scope lock — target files = `Files to Produce` (+ regenerated `data/cards/vnom.json` and feeds). Anything else is a FAIL; surface it.

## Locked Values (do not re-derive)
- New keyword: `'excessive-violence'` (single wrapper, NO top-level magnitude → in `NO_MAGNITUDE_KEYWORDS`; also in `MVP_KEYWORDS` so the enroll wrapper dispatches). Default timing `onFight` (`KEYWORD_TIMING_DEFAULTS`).
- Descriptor field: `excessiveViolenceEffects?: HeroEffectDescriptor[]`.
- `TurnEconomy` fields: `excessiveViolencePlayedCards?: CardExtId[]` (omit-when-empty ledger, append order = fire order, duplicates allowed) + `excessiveViolenceUsedThisTurn?: boolean` (omit-when-off once-per-turn guard). Both carried by `carryConversionFlag`, absent from `resetTurnEconomy` base literal.
- Setters: `enrollExcessiveViolenceCard(economy, cardId)` (append, materialize array on first call) + `markExcessiveViolenceUsed(economy)` (set flag true) — the `enableDrawLock` shape, both spread `carryConversionFlag`.
- `EXCESSIVE_VIOLENCE_PATTERN = /\[keyword:Excessive Violence\]/` (space form; `KEYWORD_PATTERN` can't match it; the printed display token stays as-is).
- Allowlist `EXCESSIVE_VIOLENCE_CARDS` (canonical `{setAbbr}/{heroSlug}/{cardSlug}` keys) — exactly these four + inner effect:
  - `vnom/carnage/rending-claws` idx0 → draw 1 (`[keyword:draw:1]`).
  - `vnom/venom/razor-teeth` idx0 → +2 recruit (`[icon:recruit]`, already present).
  - `vnom/venom-rocket/serious-overkill` idx0 → optional KO hand/discard (`[keyword:optional-ko-hand-discard]`).
  - `vnom/venompool/can-i-get-a-little-gratitude` idx1 → rescue 1 (`[keyword:rescue:1]`).
- Card-data: APPEND `[keyword:draw:1]` (rending-claws idx0, net-new) + `[keyword:optional-ko-hand-discard]` (serious-overkill idx0, net-new); CONVERT the `_deferred` can-i-get idx1 row → active `[keyword:rescue:1]`; NO marker on razor-teeth; UPDATE `_deferred` reasons of gruesome-feast / feast-or-famine / slapstick.
- Overspend rule (in the MOVE BODY of fightVillain/fightMastermind — NOT `defeatCityVillainCore`): `evActive = args.useExcessiveViolence === true && getSpendableAttack(pre) >= requiredFightCost + 1 && !turnEconomy.excessiveViolenceUsedThisTurn` (pre-spend). Sequence: `defeatCityVillainCore` → SINGLE `spendFightCost(requiredFightCost + (evActive ? 1 : 0))` → if `evActive` then `markExcessiveViolenceUsed` then `fireExcessiveViolencePlays`. Fire STRICTLY after the debit (pre-flight RS-1) so a razor-teeth recruit grant can't change what `spendFightCost` pulls under a `recruitSpendableAsAttack` loadout. Baseline counts as of drafting (VERIFY at execution, do not trust): `HERO_KEYWORDS` 63→64, `HERO_EFFECT_HANDLERS` 47→48.

## Guardrails
- **Enroll at play, fire at fight.** `heroEffectExcessiveViolence` (play-time) ONLY appends `cardId` to the ledger — NEVER applies the inner draw/recruit/rescue/ko. The inner effects fire ONLY from `fireExcessiveViolencePlays`. Test: playing an EV card grants no immediate draw/recruit/rescue/KO.
- **Overspend is real, opt-in, once per turn.** EV fires only under `evActive` (all three conditions). On success debit ONE extra attack (single `spendFightCost` at `requiredFightCost + 1`), set the once-per-turn flag, fire the plays. Unaffordable `+1` or already-used → fight NORMALLY (silent decline, no throw, `requiredFightCost` debit). Test all four paths + normal-fight-unchanged.
- **Deterministic fire order + fire site.** Enrolled plays fire in ledger (play) order, from the MOVE BODY (fightVillain/fightMastermind), AFTER the defeat settles AND AFTER the `spendFightCost` debit. `for...of`, no `.reduce()`, no extra `ctx.random`. NEVER call `fireExcessiveViolencePlays` inside the exported `defeatCityVillainCore` (copilot Mode 16) — it is reused by non-fight defeat paths (Silent Sniper's free defeat, `resolveDefeatChoice`) that carry no `useExcessiveViolence` arg; firing there would leak EV to an unpaid defeat. The `args.useExcessiveViolence` gate lives only in the move body, so the fire call must too.
- **Allowlist-gated.** Resolve ONLY the four keys. gruesome-feast / feast-or-famine / slapstick / can-i-get line0 / any future EV card stay parse-unrecognized hollows. Test a non-allowlisted EV card stays hollow.
- **Fusion consumes source tokens.** The fused `excessive-violence` hook is the ONLY hook from the EV line — no leftover standalone draw/recruit/rescue/ko hook (that would fire at play), no residual `Excessive Violence` unresolved marker. Keep the coalescer non-mutating (return a new array; leave the display `abilities[]` untouched). Thread the canonical `{setAbbr}/{heroSlug}/{cardSlug}` key like `DIGEST_INDIGESTION_CARDS` / `SUPPORTED_TRANSFORM_BASES` — do NOT copy a bare-`abilities` signature.
- **Omit-when-off + turn-cleared.** Both new `TurnEconomy` fields absent until set, dropped by `resetTurnEconomy`, carried by `carryConversionFlag` (extend it + both setters spread it so no flag drops another). Test: a turn that never plays/fires EV serializes with NEITHER key (`JSON.stringify`), and the base economy leaves both undefined.
- **JSON-roundtrip.** `excessiveViolenceEffects` nests `HeroEffectDescriptor[]`; the fused hook lives in JSON-serialized `G.heroAbilityHooks` (D-24095) → assert a fused hook survives `JSON.parse(JSON.stringify(hook))` byte-identically. Safe-skip if `excessiveViolenceEffects === undefined`.
- **Lockstep.** `'excessive-violence'` in union AND `HERO_KEYWORDS`; handler in `HERO_EFFECT_HANDLERS` AND `HANDLED_KEYWORDS` AND `MVP_KEYWORDS` AND `NO_MAGNITUDE_KEYWORDS` (a missed `NO_MAGNITUDE_KEYWORDS` entry drops it at the magnitude pre-gate; a missed `MVP_KEYWORDS` entry makes `executeSingleEffect` no-op the enroll wrapper). Bump EVERY numeric `HERO_KEYWORDS.length` site + the order-sensitive expected-array parity + EVERY `HERO_EFFECT_HANDLERS` count site; leave the DYNAMIC `uniqueKeywords.size === HERO_KEYWORDS.length` untouched. Update the stale it()-title / message text at each bumped site, not just the number.
- **Move contract.** `useExcessiveViolence?` is an OPTIONAL boolean validated in Step 1; the EV branch decisions are validation-phase silent (moves never throw). `getLegalMoves` still offers the plain fight (optional arg defaults to normal) → no legalMoves↔guard divergence (`reference_bot_legalmoves_moveguard_divergence`).
- **No client change** — printed `[keyword:Excessive Violence]` token stays, renders via `AbilityText.vue`; no `UIState` field, no pending choice beyond what `optional-ko-hand-discard` already parks, no arena-client surface. (serious-overkill's KO parks the SHIPPED `optional-ko-reward` pending queue — no new pending type.)
- Marker edits touch only `abilities[i]`. After the card-data change REGEN + commit all derived feeds (effect-index / mechanics:metadata / ledger:heroes / runtime-observed); a stale feed fails its `:check`. Revert `lagn-v1.json` CRLF churn.
- **Per-hero aggregation honesty (WP-735 AC #8).** `carnage` carries a wired EV card (rending-claws) AND deferred ones (gruesome-feast, feast-or-famine). Do NOT alias `excessive-violence`→executable per-hook so the aggregated `carnage` row over-claims the deferred siblings. Keep the mixed-hero raw row honest; verify un-hollow via each wired card's runtime-observed drop + `sim:coverage` recognition. If the ledger can't express per-card status, record a govern-close amendment — never force the row green.
- **Coverage cascade:** new keyword grows the hook universe → run `sim:coverage --check`; regen the baseline with `--update-baseline` ONLY if it flags this keyword (distinct baseline, `reference_sim_coverage_baseline_gate_distinct`). Never re-baseline to hide an unrelated shift.
- **Determinism:** all four cards `vnom` (non-core), no committed sentinel/PRE_WP080 replay plays them, omit-when-off fields → `finalStateHash` expected unchanged. If a pin moves, investigate WHY, then dual re-pin HONESTLY (`reference_hashed_g_field_dual_repin`) — never hand-edit a pin to force green.

## Required `// why:` Comments
- `heroKeywords.ts` entry: D-24556 — the fight-overspend Excessive Violence keyword (Venomverse; glossary id 30).
- `heroAbility.types.ts` `excessiveViolenceEffects`: D-24556 — the enrolled EV ability's inner effects; fired at fight time, not at play.
- `EXCESSIVE_VIOLENCE_CARDS` allowlist: D-24556 — resolve only these four; every other EV card keeps an honest unresolved marker (the Digest/transform/x-gene precedent).
- `EXCESSIVE_VIOLENCE_PATTERN`: the printed `[keyword:Excessive Violence]` space-form token `KEYWORD_PATTERN` cannot match; dedicated pattern; display token unchanged.
- `heroEffectExcessiveViolence` (enroll): D-24556 — `executeHeroEffects` fires this at PLAY time; its job is to enroll the card, NOT to apply the inner effect (which fires at fight time).
- `fireExcessiveViolencePlays`: D-24556 — fight-time driver; dispatches each enrolled card's `excessiveViolenceEffects` via reentrant `executeSingleEffect` in ledger order, after the defeat settles.
- `TurnEconomy` fields + setters + `carryConversionFlag` additions: D-24556 — omit-when-off turn-scoped ledger + once-per-turn guard (the `drawsLocked` precedent); carried across same-turn rebuilds, dropped each turn. (pre-flight RS-2: add a `// why:` at the widened `carryConversionFlag` noting it now ALSO carries the EV ledger array, not just the two conversion flags — the carry is what keeps the ledger alive across `addResources`/`spendAttack`/`spendRecruit`.)
- fight-move EV branch (both moves): D-24557 — once-per-turn `+1[icon:attack]` overspend "using Excessive Violence"; unaffordable/already-used declines silently (validation-phase, moves never throw); fire after defeat settles.
- `NO_MAGNITUDE_KEYWORDS` + `MVP_KEYWORDS` inclusion: the wrapper carries no magnitude (inner effects ride their markers) and must dispatch through `executeSingleEffect`.

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — union + array
- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified** — `excessiveViolenceEffects?`
- `packages/game-engine/src/economy/economy.types.ts` — **modified** — two `TurnEconomy` fields
- `packages/game-engine/src/economy/economy.logic.ts` — **modified** — `carryConversionFlag` + two setters
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `EXCESSIVE_VIOLENCE_PATTERN` + allowlist + `buildExcessiveViolenceFusion` + `KEYWORD_TIMING_DEFAULTS` + threading
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `heroEffectExcessiveViolence` + `fireExcessiveViolencePlays` + registration (`HANDLED_KEYWORDS` / `HERO_EFFECT_HANDLERS` / `MVP_KEYWORDS` / `NO_MAGNITUDE_KEYWORDS`)
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — arg + overspend + fire
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** — arg + overspend + fire
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — handler-count drift (all sites) + bidirectional set + enroll/fire/once-per-turn/JSON-roundtrip/safe-skip tests
- `packages/game-engine/src/rules/heroKeywords.test.ts` — **modified** — count + message
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — count + expected-array parity; leave the dynamic `uniqueKeywords.size` check untouched
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — count + message + fusion test (allowlisted → one hook; non-allowlisted EV → hollow)
- `packages/game-engine/src/economy/economy.logic.test.ts` — **modified** — new-setter + omit-when-off + carry-coexistence tests
- `packages/game-engine/src/moves/fightVillain.test.ts` — **modified** — overspend/fire/once-per-turn/decline/normal-unchanged
- `packages/game-engine/src/moves/fightMastermind.test.ts` — **modified** — same for mastermind
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 2 net-new apply rows + convert 1 `_deferred`→active + update 3 `_deferred` reasons
- `data/cards/vnom.json` — **modified (regenerated)** — appended inner markers
- derived feeds for `effect-index` / `mechanics:metadata` / `ledger:heroes` / `sim:runtime-observed` — **modified (regenerated)**
- (conditional) `sim:coverage` baseline — only if `sim:coverage --check` flags the new keyword

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` passes (+ enroll/fire/once-per-turn/decline/fusion tests)
- [ ] `apply-hero-ability-markers.mjs` idempotent (re-run 0 updates); `cards:check` + `effect-index:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` + `sim:coverage --check` all 0
- [ ] the 4 wired cards drop from `runtime-observed-hollows.json`; `carnage` aggregated row stays honest (AC #11)
- [ ] `finalStateHash` fixtures unchanged (or dual-re-pinned honestly with provenance)
- [ ] Live-on-surface verification (D-24026, surface = `play.legendary-arena.com`): a live match — play an EV card, fight with the extra attack, the EV ability fires — post-deploy STATUS-flip (via diagnostic/autoplay `setupData` until the client affordance ships)
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — land D-24556 + D-24557 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-736 checked off; `EC_INDEX.md` Done; mindmap `✅`; `roadmap:counts:check` 0
- [ ] `git diff --name-only` shows only the allowlist (+ regenerated data/feeds)

## Common Failure Smells
- An EV ability fires at PLAY (a draw/recruit/rescue on playing the card) → the fusion didn't consume the inner token, or the handler applies instead of enrolls; the inner effect must fire ONLY from the fight-time driver.
- EV fires without the extra attack, or on a normal fight → the `evActive` gate is wrong; EV requires `useExcessiveViolence === true` AND affordable `+1` AND not-yet-used.
- Double-debit (spent = required, then +1 again) → use a SINGLE `spendFightCost(requiredFightCost + (evActive?1:0))`, not two calls.
- EV fires twice in a turn → the once-per-turn guard (`excessiveViolenceUsedThisTurn`) wasn't set or wasn't checked.
- A normal fight test broke → the EV branch isn't gated behind `useExcessiveViolence` (the arg absent must be byte-identical to today); or the two `TurnEconomy` fields aren't omit-when-off.
- `[keyword:Excessive Violence]` still logs a parse-unrecognized hollow for a wired card → the fusion didn't consume the token (allowlist not threaded).
- A non-allowlisted EV card resolved → the allowlist gate is missing.
- Ledger key present on a non-EV turn's `JSON.stringify` → the field isn't omit-when-off, or `resetTurnEconomy` carries it (it must drop it).
- `carnage` shows `excessive-violence`→executable while gruesome-feast/feast-or-famine are still deferred → per-hook alias over-claims; keep the mixed-hero raw row honest (AC #11).
- Drift test red → keyword in union not array (or vice versa), handler-count mismatch, or a missed `MVP_KEYWORDS` / `NO_MAGNITUDE_KEYWORDS` entry.
- `sim:coverage --check` red → the new keyword grew the hook universe; regen the baseline (only if it flags this keyword) — do NOT re-baseline to hide an unrelated shift.
- `finalStateHash` re-pin needed unexpectedly → investigate (a fixture that plays a wired card, or a non-omit-when-off field?); dual re-pin honestly, never edit a pin to force green.
