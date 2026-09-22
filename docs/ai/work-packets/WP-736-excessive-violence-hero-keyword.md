# WP-736 — "Excessive Violence" fight-overspend hero keyword (`excessive-violence`; Engine + Data)

**Status:** Ready
**Primary Layer:** Game Engine / Implementation + Card Data
**User-Visible Surface:** `play.legendary-arena.com`
**Dependencies:** D-21602 (the deferral this closes), WP-021/022/023 (hero-keyword union + parser + executor substrate), WP-735 / D-24555 (`digest-indigestion` — the wrapper-descriptor + setup-time line-fusion + allowlist-gated Honest-Partial precedent; the sibling that deferred this family), WP-580 / D-24389 (`recruitSpendableAsAttack` — the omit-when-off turn-scoped `TurnEconomy` flag + `carryConversionFlag` carry chokepoint), WP-731 / D-24552 (`drawsLocked` — the second omit-when-off flag; `enableDrawLock` setter shape), WP-667 / D-24480 (`optional-ko-hand-discard` — serious-overkill's inner executor), WP-216 / D-21601 (`[keyword:rescue:N]`) + D-24551 (`[keyword:draw:N]`), WP-535 / D-24345 + WP-592 / D-24401 (reentrant `executeSingleEffect` dispatch precedent)
**Lane:** Standard (two-session). NOT lightweight-lane eligible: adds a new `HeroKeyword`, extends two contract-adjacent types (`heroAbility.types.ts` descriptor + `economy.types.ts` `TurnEconomy`), extends the fight-move arg contract, and touches the determinism / turn-economy surface — "any ambiguity resolves against eligibility" (01.0a).

> Baseline: `origin/main` at commit `c423a8ce` + the `SPEC: reserve WP-736 / EC-773 / D-24556 / D-24557` ledger commit.

---

## Goal

After this session, `@legendary-arena/game-engine` recognizes a new hero keyword `excessive-violence` and a fight-time opt-in that resolves it. When a player plays an allowlisted Venomverse "Excessive Violence" card, the card's EV ability is **enrolled** into a turn-scoped ledger instead of firing at play time. If that player then fights a Villain or Mastermind **using Excessive Violence** — an opt-in that spends **1 extra `[attack]`** beyond the enemy's cost, allowed **at most once per turn** — every enrolled EV ability fires at fight resolution, in play order, via the shipped `draw` / `recruit` / `rescue` / `optional-ko-hand-discard` executors. Cards outside the allowlist (the reveal-KO EV members, other sets) keep their honest parse-unrecognized hollows.

---

## User-Visible Impact

In a live match, a Venom / Carnage / Venompool player who has played EV cards this turn now sees a real reward for over-committing attack to a fight. Today `[keyword:Excessive Violence]: …` is parse-unrecognized — the ability does nothing (or, for the `+[icon:recruit]` / `+[icon:attack]` lines, fires ungated at play, which is *also* wrong). After this WP: playing **Rending Claws** / **Razor Teeth** / **Serious Overkill** / **Can I Get a Little Gratitude?** enrolls its EV ability, and a fight where the player chooses to spend the extra `[attack]` draws a card / gains +2 Recruit / lets them KO a card from hand or discard / rescues a Bystander — the card as printed. A player who never overspends, or never fights, sees no EV effects — faithful to the rulebook.

---

## Assumes

- **D-21602 landed** — the `[keyword:Excessive Violence]` timing-prefix deferral. Of the **four** cards this WP resolves, ONLY `vnom/venompool/can-i-get-a-little-gratitude` (idx 1) has a `_deferred` row in `scripts/convert-cards/inputs/hero-ability-markers.json`; `carnage/rending-claws`, `venom/razor-teeth`, and `venom-rocket/serious-overkill` are ABSENT from the marker map entirely (their EV hollows are runtime-observed only). This WP adds **2 net-new apply rows** (rending-claws `draw:1`, serious-overkill `optional-ko-hand-discard`), **converts the single `_deferred` row** (can-i-get idx 1 → active `rescue:1`), applies **no marker to razor-teeth** (its `[icon:recruit]` already parses), and **updates the `_deferred` reasons** of the still-deferred EV members (gruesome-feast, feast-or-famine, and the out-of-set slapstick row) to say the EV *timing* now ships but that specific ability is deferred.
- **The hero-keyword substrate exists** — the `HeroKeyword` union + `HERO_KEYWORDS` array (`rules/heroKeywords.ts`; **read the current baseline count at execution — concurrent WPs move it, e.g. WP-735 raised it to 63**); the executor's `HANDLED_KEYWORDS`, `HERO_EFFECT_HANDLERS`, `NO_MAGNITUDE_KEYWORDS`, and the computed `MVP_KEYWORDS` union (`hero/heroEffects.execute.ts`); the union↔array and handler-map↔`HANDLED_KEYWORDS` bidirectional drift tests; `HeroAbilityTiming` includes `'onFight'` (declarative-only today) and `KEYWORD_TIMING_DEFAULTS` (`setup/heroAbility.setup.ts` ~426) maps a keyword to its default hook timing (wall-crawl→onRecruit precedent).
- **`executeHeroEffects` fires every hook at PLAY time and does NOT filter by timing** (`hero/heroEffects.execute.ts` ~666; the comment at ~248 states it explicitly). This is the load-bearing fact: an `excessive-violence` hook (timing `onFight`) fires at play, and its handler's play-time job is to **enroll**, not to apply the inner effects. There is no fight-time hero-hook executor today — this WP adds the fight-time fire path.
- **`HeroEffectDescriptor` is the extensible flat descriptor** (`rules/heroAbility.types.ts`) — each keyword adds its own optional fields (`revealRules?`, `countScaledChoiceOptions?`, and — as of WP-735 — `digestEffects?` / `indigestionEffects?`, the first *nested* `HeroEffectDescriptor[]` fields). `excessiveViolenceEffects?: HeroEffectDescriptor[]` is added the same way (the second nested case).
- **The per-card allowlist-gated fusion pattern exists** — `buildHeroAbilityHooks` (`setup/heroAbility.setup.ts`) threads per-card allowlists (`SUPPORTED_TRANSFORM_BASES` / `X_GENE_CARDS` / `DIGEST_INDIGESTION_CARDS`, canonical `{setAbbr}/{heroSlug}/{cardSlug}` keys) so a mechanic resolves only for allowlisted cards; WP-735's `buildDigestIndigestionFusion` folds a card's tagged line(s) into ONE hook and suppresses the source line's individual hook. `excessive-violence` fusion mirrors this exactly (single-line instead of multi-line: read one `[keyword:Excessive Violence]: …` line's inline effects into `excessiveViolenceEffects`, emit one hook, consume the source tokens).
- **The turn-scoped omit-when-off flag pattern exists** — `TurnEconomy` carries `recruitSpendableAsAttack?` (WP-580) and `drawsLocked?` (WP-731), each lazily materialized (absent until set), dropped by `resetTurnEconomy` (base literal omits them), and carried across every same-turn rebuild by the single `carryConversionFlag` chokepoint (`economy/economy.logic.ts` ~499); setters `enableRecruitSpendableAsAttack` / `enableDrawLock` spread the carry. The EV ledger + once-per-turn flag use this pattern verbatim.
- **The reentrant single-effect dispatcher exists** — `executeSingleEffect(G, ctx, playerID, cardId, effect)` (`hero/heroEffects.execute.ts` ~4983) dispatches one `HeroEffectDescriptor` to `HERO_EFFECT_HANDLERS[effect.type]`, gated by `MVP_KEYWORDS`. The fight-time fire driver calls it once per enrolled EV card's inner effects.
- **The inner executors are shipped** — `draw` (`heroEffectDraw`), flat `recruit` (the resource-grant primitive), `rescue` (`heroEffectRescue`), and `optional-ko-hand-discard` (`heroEffectOptionalKoHandDiscard`, WP-667) all exist and are `MVP_KEYWORDS`. Every wired EV ability reduces to one of these.
- **The fight moves share one cost-gate shape** — `fightVillain` (`moves/fightVillain.ts`) and `fightMastermind` (`moves/fightMastermind.ts`) each compute `requiredFightCost`, gate on `getSpendableAttack(G.turnEconomy) >= requiredFightCost`, and debit via `spendFightCost(G.turnEconomy, requiredFightCost)`; `defeatCityVillainCore` fires the enemy's `onFight` abilities and (WP-542 precedent) runs a *post-defeat* consequence pipeline. The EV overspend + fire hooks into both moves at the same site.
- **The inner-effect marker tokens are already legal** — `[keyword:draw:N]`, `[keyword:rescue:N]`, `[keyword:optional-ko-hand-discard]` are all in `VALID_TOKEN_PATTERN` (`apply-hero-ability-markers.mjs` ~105) and already parse to their effects; `[icon:recruit]` already parses to a flat recruit grant. **No apply-script change.**
- `pnpm -r build` exits 0; engine test + `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` all green on baseline.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `scripts/convert-cards/inputs/keywords-full.json` — glossary **id 30 "Excessive Violence"**: the exact printed semantics. Model these verbatim — do NOT reinterpret:
  - "Once per turn, you can spend 1`[icon:attack]` **more** than you need to fight a Villain or Mastermind 'using Excessive Violence.' If you do, you get to use **all** the 'Excessive Violence' abilities on cards you played this turn."
  - "If you don't fight anything this turn, or if you don't spend an extra 1`[icon:attack]` on someone, then you won't be able to use Excessive Violence."
  - "Since you can only fight 'using Excessive Violence' once per turn, you can only use a card's Excessive Violence ability once per turn. (It's OK to play two cards with the same card name … and use both of those cards' Excessive Violence abilities.)" — the ledger allows **duplicate** enrolments; two copies each fire.
  - "Do the enemy's Fight effect and the Excessive Violence abilities in any order of your choice." — the engine picks a fixed deterministic order (enemy Fight effect first, then EV plays in enrolment order).
  - "If you fight using Excessive Violence and then draw or play more cards with Excessive Violence abilities later in the turn, it will be too late to use those abilities." — the once-per-turn guard closes the window; later enrolments never fire.
- `docs/ai/work-packets/WP-735-venompool-digest-indigestion.md` + `docs/ai/execution-checklists/EC-772-*.md` — the sibling. Read `buildDigestIndigestionFusion`, the `DIGEST_INDIGESTION_CARDS` allowlist threading, the wrapper-descriptor + `NO_MAGNITUDE_KEYWORDS` posture, the reentrant `executeSingleEffect` branch dispatch, and the **AC #8 per-hero-aggregation correction** (below) — all reused here.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — `buildHeroAbilityHooks`, the allowlist threading, `buildDigestIndigestionFusion` (the single-hook fusion template), `parseAbilityText`, the `KEYWORD_PATTERN` scan (confirm `[keyword:Excessive Violence]` — space form — does NOT match it, so a dedicated `EXCESSIVE_VIOLENCE_PATTERN` is needed), `KEYWORD_TIMING_DEFAULTS` (~426), Step 1a/1b condition building.
- `packages/game-engine/src/rules/heroAbility.types.ts` — `HeroEffectDescriptor`: add `excessiveViolenceEffects?: HeroEffectDescriptor[]` beside `digestEffects?`.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `executeHeroEffects` (~666, fires all hooks at play), `executeSingleEffect` (~4983), `heroEffectDraw` / `heroEffectRescue` / `heroEffectOptionalKoHandDiscard`, and the registration sets `HANDLED_KEYWORDS` (~108), `NO_MAGNITUDE_KEYWORDS` (~430), `MVP_KEYWORDS` (~334 region), `HERO_EFFECT_HANDLERS` (~4841).
- `packages/game-engine/src/economy/economy.types.ts` — `TurnEconomy` (add the two fields beside `drawsLocked?`) — and `economy.logic.ts` — `carryConversionFlag` (~499), `enableDrawLock` (~671, the setter shape), `resetTurnEconomy` (~725, the base literal that drops the flags), `spendFightCost` (~702), `getSpendableAttack` (~531).
- `packages/game-engine/src/moves/fightVillain.ts` + `fightMastermind.ts` — the `requiredFightCost` gate, the `spendFightCost` debit, and (fightVillain) `defeatCityVillainCore`'s post-defeat pipeline (the WP-542 `playTopVillainDeckCards` tail is the "fire a consequence after the defeat is settled" precedent the EV fire mirrors).
- `docs/ai/DECISIONS.md` — D-21602 (the deferral), D-24555 (the Digest sibling + Honest-Partial precedent), D-24389 / D-24552 (turn-scoped-flag precedent), D-24185 (validation-phase silent-return precedent for the unaffordable-`+1` decline). D-24556 + D-24557 are reserved in `docs/ai/NUMBER-LEDGER.md` and land Active in `DECISIONS.md` at execution (not present there at draft time).
- User memory: `project_venompool_digest_indigestion_arc` (the sibling pattern + gotchas), `reference_hero_ability_marker_curated_map` (markers from the curated map, not auto-detect), `reference_sim_coverage_baseline_gate_distinct` (new keyword → run `sim:coverage --check`, regen the distinct baseline if flagged), `reference_hashed_g_field_dual_repin` (honest re-pin discipline), `reference_bot_legalmoves_moveguard_divergence` (the fight-move arg must not diverge legalMoves from the guard).

**Single WP, not split (rationale):** the mechanic touches ~15 files across the engine, but it is one indivisible unit — the fight-overspend timing, the ledger, and at least one wired card must ship together to be testable (an infra-only WP has no observable behavior; a card-only WP has no timing to fire it). It stays single-layer (Game Engine + its card data), locks 2 D-entries, and adds no pending choice / client surface. Per 01.0a the >10-file heuristic is a "consider splitting" prompt, not a bar; the cohesion here argues against a split.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:`-prefixed built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English words (Rule 4), a `// why:` on every non-obvious constant / choice (Rule 6), no `.reduce()` in effect application or the fire loop (Rule 7/8), one screen per function (Rule 2), JSDoc on every function.

**Packet-specific:**
- Architecture (`.claude/rules/architecture.md`): moves **never throw** — an out-of-allowlist or malformed EV card safe-skips (leaves an unresolved marker), and an unaffordable / already-used EV opt-in **silently fights normally**, never throws; the ledger stores `CardExtId` **strings only** (never card objects); `G` and `TurnEconomy` are runtime-only (never persisted by application code). Only `Game.setup()` may throw.
- **The move validation contract holds.** The fight moves keep their exact order (validate args → stage/pending gates → mutate). `useExcessiveViolence` is validated as an optional boolean in Step 1; the EV branch's affordability + once-per-turn checks are part of the mutate step and **decline silently** (return to a normal fight, no throw, no message beyond the ordinary fight log) when unmet — the D-24185 pre-commit-precondition / validation-phase-silent-return posture.
- **Enroll at play, fire at fight.** The `excessive-violence` handler, when it fires at play time (via `executeHeroEffects`), does NOTHING but append the card to the ledger — it MUST NOT apply the inner `draw`/`recruit`/`rescue`/`optional-ko` effects. Those fire ONLY from the fight-time driver. A test MUST assert playing an EV card grants no immediate draw/recruit/rescue.
- **Overspend is a real +1 attack spend, opt-in, once per turn.** EV fires ONLY when (a) the move arg `useExcessiveViolence === true`, (b) `getSpendableAttack >= requiredFightCost + 1`, and (c) `G.turnEconomy.excessiveViolenceUsedThisTurn` is not set. On success the move debits `requiredFightCost + 1` (one extra attack), sets the once-per-turn flag, and fires all enrolled EV plays. If (b) or (c) fails, the flag is ignored and the move fights normally (debits `requiredFightCost`). Tests MUST cover: EV fires on a valid opt-in; EV declines silently when the extra `+1` is unaffordable; EV declines on the second fight of the same turn (once-per-turn); a normal fight (`useExcessiveViolence` absent/false) is byte-identical to today.
- **Deterministic fire order.** Enrolled EV plays fire in **enrolment (play) order**, after the enemy's Fight effect is resolved and the defeat is settled (the WP-542 post-defeat-consequence precedent). No `ctx.random` in the fire path beyond what an inner executor already uses. The order is fixed, not player-chosen (the glossary permits any order; the engine picks one).
- **Fire from the MOVE BODY, not the shared defeat-core (copilot 01.7 Mode 16).** `fireExcessiveViolencePlays` is called from `fightVillain` / `fightMastermind` themselves — NEVER from inside the exported `defeatCityVillainCore`. That core is reused by non-fight defeat paths (Silent Sniper's free `defeat-with-bystander`, `resolveDefeatChoice`) that carry no `useExcessiveViolence` arg; firing EV there would leak the overspend reward to a defeat the player never paid `+1` for. The `args.useExcessiveViolence` gate lives only in the move body, so the fire call must too.
- **Fire strictly AFTER the `spendFightCost` debit (pre-flight 01.4 RS-1).** In both moves the order is `defeatCityVillainCore` → `spendFightCost(requiredFightCost + 1)` → `markExcessiveViolenceUsed` → `fireExcessiveViolencePlays`. An EV inner effect can grant a resource (razor-teeth's +2 recruit); under a `recruitSpendableAsAttack` (God of Thunder) loadout, firing it *before* the debit could change what `spendFightCost` pulls from. Debiting first keeps the fight cost byte-stable. A test SHOULD cover the razor-teeth-under-recruit-as-attack ordering.
- **Allowlist-gated (the Digest / transform / x-gene precedent).** Fusion + resolution fire ONLY for the four `EXCESSIVE_VIOLENCE_CARDS` keys. Every other EV card (gruesome-feast, feast-or-famine, slapstick, and any future member) keeps its honest parse-unrecognized hollow — do NOT resolve them. The `can-i-get-a-little-gratitude` **line 0** passive rescue-doubler is a separate reactive mechanic and stays hollow.
- **`excessive-violence` lockstep.** Added to the `HeroKeyword` union AND `HERO_KEYWORDS`; the handler to `HERO_EFFECT_HANDLERS` AND `HANDLED_KEYWORDS`; AND to `MVP_KEYWORDS` (so `executeSingleEffect` dispatches the enroll wrapper) AND `NO_MAGNITUDE_KEYWORDS` (the wrapper carries no top-level magnitude — the inner effects ride their own markers; a missed entry drops it at the magnitude pre-gate). Read the CURRENT baseline counts at execution; bump every numeric `.length` drift site + the order-sensitive expected-array parity, and leave the **dynamic** `uniqueKeywords.size === HERO_KEYWORDS.length` self-comparison untouched.
- **Fusion consumes the source tokens.** For an allowlisted card, the fused `excessive-violence` hook is the ONLY hook produced from the `[keyword:Excessive Violence]: …` line — the inner `[keyword:draw:1]` / `[keyword:rescue:1]` / `[keyword:optional-ko-hand-discard]` / `[icon:recruit]` tokens are consumed into `excessiveViolenceEffects` (no leftover standalone draw/recruit/rescue/ko hook that would fire at play time, no residual unresolved `Excessive Violence` marker).
- **Turn-scoped, omit-when-off, never persisted.** `excessiveViolencePlayedCards?` (omit-when-empty) and `excessiveViolenceUsedThisTurn?` (omit-when-off) live on `TurnEconomy`, are absent from the `resetTurnEconomy` base literal (dropped every turn), and are carried by `carryConversionFlag` across same-turn rebuilds. A test MUST assert both are absent from `JSON.stringify` on a turn that never plays/fires EV.
- **First-time self-recursion is already shipped, but re-assert it.** `excessiveViolenceEffects` nests `HeroEffectDescriptor[]` (WP-735 made the descriptor self-recursive first). The fused hook lives in the JSON-serialized `G.heroAbilityHooks` (D-24095) → assert a fused hook survives `JSON.parse(JSON.stringify(hook))` byte-identically (plain data, acyclic).
- **No client change.** The printed `[keyword:Excessive Violence]` display token stays in the card text and renders through `AbilityText.vue` unchanged. The `useExcessiveViolence` fight-move arg is engine-only; the client "Fight using Excessive Violence" affordance is a **deferred sibling client WP** (bots/sim reach the branch only if a caller passes the arg). No `UIState` field, no pending choice, no arena-client surface.
- Marker edits touch only `abilities[i]` text — no other card field.

**Session protocol:** if any of the four wired EV abilities does not reduce to a shipped `draw`/`recruit`/`rescue`/`optional-ko-hand-discard` effect, STOP and surface it — it belongs in the deferred set, not force-fit.

**Locked contract values:** the four cards + their inner effects, the two `TurnEconomy` fields, and the overspend rule are in `## Contract`.

---

## Scope (In)

- New `excessive-violence` `HeroKeyword` (union + array) — `rules/heroKeywords.ts`; its `onFight` default timing entry in `KEYWORD_TIMING_DEFAULTS` — `setup/heroAbility.setup.ts`.
- New optional field `excessiveViolenceEffects?: HeroEffectDescriptor[]` on `HeroEffectDescriptor` — `rules/heroAbility.types.ts`.
- Two new optional `TurnEconomy` fields — `excessiveViolencePlayedCards?: CardExtId[]` (omit-when-empty ledger) and `excessiveViolenceUsedThisTurn?: boolean` (omit-when-off once-per-turn guard) — `economy/economy.types.ts`; their carry in `carryConversionFlag` and two new setters `enrollExcessiveViolenceCard(economy, cardId)` + `markExcessiveViolenceUsed(economy)` (the `enableDrawLock` shape) — `economy/economy.logic.ts`.
- Setup-time fusion — `setup/heroAbility.setup.ts`: an `EXCESSIVE_VIOLENCE_PATTERN` (`/\[keyword:Excessive Violence\]/`, space form) and an `EXCESSIVE_VIOLENCE_CARDS` allowlist (the four canonical keys); a `buildExcessiveViolenceFusion` (mirroring `buildDigestIndigestionFusion`) that, for an allowlisted card, parses the EV line's inline effects into `excessiveViolenceEffects` and emits ONE `excessive-violence` hook (timing `onFight`), consuming the source tokens.
- New handlers in `hero/heroEffects.execute.ts`: `heroEffectExcessiveViolence` (play-time ENROLL — appends `cardId` to the ledger via `enrollExcessiveViolenceCard`, applies no inner effect) + a `fireExcessiveViolencePlays(G, ctx, playerID)` driver (reads the ledger, looks up each enrolled card's `excessive-violence` hook in `G.heroAbilityHooks`, dispatches its `excessiveViolenceEffects` via `executeSingleEffect` in enrolment order); registration in `HERO_EFFECT_HANDLERS` + `HANDLED_KEYWORDS` + `MVP_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`.
- Fight-move opt-in — `moves/fightVillain.ts` + `moves/fightMastermind.ts`: an optional `useExcessiveViolence?: boolean` arg; the affordability + once-per-turn gate; the `requiredFightCost + 1` overspend; the `markExcessiveViolenceUsed` + `fireExcessiveViolencePlays` call, placed AFTER the defeat is settled.
- Drift-test updates (keyword count + handler count + expected-array parity + registration) across the drift test files; behavior tests (enroll-at-play, fire-at-fight, once-per-turn, unaffordable decline, normal-fight-unchanged, ledger omit-when-off, fused-hook JSON-roundtrip, non-allowlisted-stays-hollow).
- Card-data markers via the curated map — `inputs/hero-ability-markers.json`: append `[keyword:draw:1]` to `carnage/rending-claws` (idx 0) and `[keyword:optional-ko-hand-discard]` to `venom-rocket/serious-overkill` (idx 0) — **2 net-new apply rows**; convert the single existing `_deferred` row `venompool/can-i-get-a-little-gratitude` (idx 1) to an active `[keyword:rescue:1]` apply row; apply **no** marker to `venom/razor-teeth` (its `[icon:recruit]` already parses); update the `_deferred` reasons of the still-deferred EV members (gruesome-feast, feast-or-famine, slapstick) to reflect that the EV timing now ships but that ability/set is deferred.
- Regenerated `data/cards/vnom.json` + the derived feeds (`effect-implementation-index.json`, `card-mechanics.json`, `hero-mechanic-ledger.{json,csv}`, `runtime-observed-hollows.json`); `sim:coverage` baseline only if `sim:coverage --check` flags the new keyword.

## Out of Scope

- **The reveal-KO EV members stay deferred (honest hollows):** `vnom/carnage/gruesome-feast` (EV: "Reveal the top card of your deck. You may KO it." — needs a reveal-top-may-KO executor that does not exist) and `vnom/carnage/feast-or-famine` (EV: "Reveal the top card … if it costs 0, KO it and you may repeat this process." — needs reveal-KO **loop** infra). Their `[keyword:Excessive Violence]` markers remain unresolved; only their `_deferred` reasons update.
- **`can-i-get-a-little-gratitude` line 0** — the passive "Whenever you Rescue a Bystander this turn, do any 'rescue' ability on it an extra time." is a separate reactive-passive mechanic, not EV; it stays hollow.
- **Other sets** — `dead/slapstick/saturday-morning-harpoons` (EV: rescue) reduces to a shipped executor but is a different set; it belongs in a later cross-set EV/dims sweep, not this vnom WP. Its `_deferred` reason updates only.
- **The client EV affordance** — the "Fight using Excessive Violence" button / prompt on `play.legendary-arena.com` is a deferred sibling **client** WP. This WP only makes the engine move accept + resolve the arg.
- **Bot/sim EV preference** — no bot heuristic is added to *choose* to overspend; `getLegalMoves` continues to offer the plain fight (the optional arg defaults to a normal fight, so no legalMoves↔guard divergence). The fire path is exercised by unit tests, not by sim autoplay.
- No new count-source, no reveal/KO machinery, no `Gravity Mines` triggered-artifact "whenever you use Excessive Violence" reactive (id 30's example artifact — not a Venomverse card in scope), no change to `AbilityText.vue` or any display token.
- No scoring / PAR / leaderboard / identity / multiplayer-sync / monetization surface.

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — `excessive-violence` in union + array (+1)
- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified** — `excessiveViolenceEffects?` descriptor field
- `packages/game-engine/src/economy/economy.types.ts` — **modified** — two `TurnEconomy` fields (`excessiveViolencePlayedCards?`, `excessiveViolenceUsedThisTurn?`)
- `packages/game-engine/src/economy/economy.logic.ts` — **modified** — `carryConversionFlag` carries both fields; new `enrollExcessiveViolenceCard` + `markExcessiveViolenceUsed` setters
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `EXCESSIVE_VIOLENCE_PATTERN` + `EXCESSIVE_VIOLENCE_CARDS` allowlist + `buildExcessiveViolenceFusion` + `KEYWORD_TIMING_DEFAULTS` entry + `parseAbilityText`/`buildHeroAbilityHooks` threading
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `heroEffectExcessiveViolence` (enroll) + `fireExcessiveViolencePlays` (fight-time driver) + registration in `HERO_EFFECT_HANDLERS` + `HANDLED_KEYWORDS` + `MVP_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — `useExcessiveViolence?` arg + overspend gate + `fireExcessiveViolencePlays` call after defeat
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** — same opt-in + overspend + fire
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — handler-count drift (all count-assertion sites) + bidirectional `HANDLED_KEYWORDS` set + enroll/fire/once-per-turn/JSON-roundtrip tests
- `packages/game-engine/src/rules/heroKeywords.test.ts` — **modified** — `HERO_KEYWORDS.length` bump + message text
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — `HERO_KEYWORDS.length` bump + order-sensitive expected-array parity; leave the **dynamic** `uniqueKeywords.size === HERO_KEYWORDS.length` untouched
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — `HERO_KEYWORDS.length` bump + message + a fusion test (allowlisted → one `excessive-violence` hook; non-allowlisted EV card → hollow)
- `packages/game-engine/src/economy/economy.logic.test.ts` — **modified** — new-setter tests + omit-when-off serialization + `carryConversionFlag` co-existence with the two existing flags
- `packages/game-engine/src/moves/fightVillain.test.ts` — **modified** — overspend + EV fire + once-per-turn + unaffordable decline + normal-fight-unchanged
- `packages/game-engine/src/moves/fightMastermind.test.ts` — **modified** — same for the mastermind fight
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 2 net-new apply rows (rending-claws `draw:1`, serious-overkill `optional-ko-hand-discard`) + convert the single `_deferred` can-i-get idx1 row to active `rescue:1` + update the `_deferred` reasons of gruesome-feast / feast-or-famine / slapstick
- `data/cards/vnom.json` — **modified (regenerated)** — appended inner-effect markers
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — **modified (regenerated)**
- (conditional) `scripts/coverage/*coverage-baseline*` — only if `sim:coverage --check` flags the new keyword

(No `finalStateHash` re-pin expected: all four cards are `vnom` (non-core) and no committed sentinel / PRE_WP080 replay plays them; the two new `TurnEconomy` fields are omit-when-off so a non-EV game serializes byte-identically. VERIFY empirically; if a pin shifts, dual re-pin honestly per `reference_hashed_g_field_dual_repin` — never edit a pin to force green.)

---

## Contract

- Keyword label `excessive-violence`; the wrapper `HeroEffectDescriptor` carries `excessiveViolenceEffects: HeroEffectDescriptor[]` (the enrolled ability's inner effects). Top-level `magnitude` unused (in `NO_MAGNITUDE_KEYWORDS`). Default hook timing `onFight` (`KEYWORD_TIMING_DEFAULTS`); the hook still fires at play time (enroll) because `executeHeroEffects` does not filter by timing.
- `TurnEconomy.excessiveViolencePlayedCards?: CardExtId[]` — the ordered ledger of EV cards played this turn (duplicates allowed; append order = fire order). Absent until the first EV card is played; dropped by `resetTurnEconomy`; carried by `carryConversionFlag`.
- `TurnEconomy.excessiveViolenceUsedThisTurn?: boolean` — set true the first time a fight resolves "using Excessive Violence"; blocks a second EV fight that turn. Absent until set; dropped by `resetTurnEconomy`; carried by `carryConversionFlag`.
- `enrollExcessiveViolenceCard(economy, cardId): TurnEconomy` — returns a rebuilt economy with `cardId` appended to `excessiveViolencePlayedCards` (materializing the array on first call). `markExcessiveViolenceUsed(economy): TurnEconomy` — returns a rebuilt economy with `excessiveViolenceUsedThisTurn: true`. Both spread `carryConversionFlag` so neither drops the other flags.
- `heroEffectExcessiveViolence(G, ctx, playerID, cardId, effect)` — play-time handler: `G.turnEconomy = enrollExcessiveViolenceCard(G.turnEconomy, cardId)`; returns `true` (enrolled). Applies NO inner effect. Safe-skips (no-op) if `effect.excessiveViolenceEffects` is undefined.
- `fireExcessiveViolencePlays(G, ctx, playerID)` — fight-time driver: for each `cardId` in `G.turnEconomy.excessiveViolencePlayedCards ?? []` (enrolment order), find that card's `excessive-violence` hook in `G.heroAbilityHooks`, and for each descriptor in its `excessiveViolenceEffects` call `executeSingleEffect(G, ctx, playerID, cardId, descriptor)`. No `.reduce()`; explicit `for...of`. Never throws.
- Fight-move rule (both `fightVillain` and `fightMastermind`, in the MOVE BODY — not `defeatCityVillainCore`): let `evActive = args.useExcessiveViolence === true && getSpendableAttack(G.turnEconomy) >= requiredFightCost + 1 && !G.turnEconomy.excessiveViolenceUsedThisTurn`, evaluated against the **pre-spend** economy. Sequence: settle the defeat (`defeatCityVillainCore`) → `G.turnEconomy = spendFightCost(G.turnEconomy, requiredFightCost + (evActive ? 1 : 0))` (a SINGLE debit — never double-spend) → if `evActive`, `G.turnEconomy = markExcessiveViolenceUsed(G.turnEconomy)` then `fireExcessiveViolencePlays(G, ctx, playerID)`. When `evActive` is false the move debits `requiredFightCost` and fires nothing — byte-identical to today. **Fire strictly after the debit** (pre-flight RS-1) so an EV resource grant cannot alter what `spendFightCost` pulls under a `recruitSpendableAsAttack` loadout.
- The four allowlisted cards (`EXCESSIVE_VIOLENCE_CARDS`), with the inner effect each EV line reduces to:

| Card key (`{set}/{hero}/{card}`) | idx | EV inner effect | Inner marker (source) |
|---|---|---|---|
| `vnom/carnage/rending-claws` | 0 | draw 1 | `[keyword:draw:1]` (net-new apply) |
| `vnom/venom/razor-teeth` | 0 | +2 recruit | `[icon:recruit]` (already present — no apply) |
| `vnom/venom-rocket/serious-overkill` | 0 | optional KO from hand/discard | `[keyword:optional-ko-hand-discard]` (net-new apply) |
| `vnom/venompool/can-i-get-a-little-gratitude` | 1 | rescue 1 | `[keyword:rescue:1]` (convert `_deferred`→active) |

- The printed `[keyword:Excessive Violence]` display token stays in each card's `abilities[i]` text and is NOT re-authored; only the inner-effect marker is appended (where missing).

---

## Acceptance Criteria

1. `excessive-violence` is in the `HeroKeyword` union and `HERO_KEYWORDS` (baseline count +1, order matched); `heroEffectExcessiveViolence` is in `HERO_EFFECT_HANDLERS` + `HANDLED_KEYWORDS` + `MVP_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`; every numeric `HERO_KEYWORDS.length` / `HERO_EFFECT_HANDLERS` count assertion + the expected-array parity + the bidirectional handler-set test pass, and the dynamic `uniqueKeywords.size === HERO_KEYWORDS.length` check stays dynamic.
2. For an allowlisted card, `buildHeroAbilityHooks` produces exactly ONE `excessive-violence` hook carrying the card's inner effect in `excessiveViolenceEffects` (no leftover standalone draw/recruit/rescue/ko hook, no residual unresolved `Excessive Violence` marker).
3. **Enroll, don't fire at play:** playing `rending-claws` appends it to `G.turnEconomy.excessiveViolencePlayedCards` and grants NO immediate draw (hand size unchanged by the EV ability at play); same for the other three (no recruit / rescue / KO at play).
4. **Fire at fight with opt-in:** a player who has played `rending-claws` and fights a Villain with `useExcessiveViolence: true`, affording `requiredFightCost + 1`, draws 1 card as the fight resolves; `razor-teeth` grants +2 Recruit; `serious-overkill` parks the optional-KO choice; `can-i-get` (line 1) rescues a Bystander. The extra attack is debited (spent = `requiredFightCost + 1`).
5. **Once per turn:** a second fight the same turn with `useExcessiveViolence: true` does NOT fire EV again and does NOT debit an extra attack (the guard holds); `excessiveViolenceUsedThisTurn` is set after the first EV fight.
6. **Unaffordable `+1` declines silently:** with exactly `requiredFightCost` spendable attack, `useExcessiveViolence: true` fights normally (debits `requiredFightCost`, EV does not fire, flag not set, no throw).
7. **Normal fight unchanged:** `fightVillain` / `fightMastermind` with `useExcessiveViolence` absent or `false` is byte-identical to today (existing fight tests pass unmodified; the two new `TurnEconomy` fields are absent from `JSON.stringify`).
8. **Duplicate enrolment:** two copies of an EV card played the same turn both enrol and both fire on one EV fight (the glossary's "two cards with the same name" case).
9. A non-allowlisted EV card (e.g. `carnage/gruesome-feast`) still produces a parse-unrecognized hollow for its `[keyword:Excessive Violence]` — the allowlist gate holds.
10. `data/cards/vnom.json` carries the appended inner markers (`rending-claws` draw:1, `serious-overkill` optional-ko-hand-discard, `can-i-get` idx1 rescue:1; `razor-teeth` unchanged); `apply-hero-ability-markers.mjs` is idempotent (re-run 0 updates).
11. `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` all exit 0; the four wired cards drop out of `runtime-observed-hollows.json` for the EV mechanic, and `sim:coverage` recognizes `excessive-violence` (no coverage regression). **Per-hero-aggregation honesty (the WP-735 AC #8 lesson):** the hero-mechanic ledger aggregates status per-hero, and `carnage` carries BOTH a wired EV card (`rending-claws`) AND two deferred ones (`gruesome-feast`, `feast-or-famine`); an aggregated `excessive-violence`→`executable` label for `carnage` would over-claim the deferred siblings (a reward-integrity violation). The raw aggregated row for a mixed hero stays honest (not blanket-`executable`); the un-hollow is verified by each wired card's runtime-observed drop, not by the aggregated row. If the ledger cannot express per-card status, record it as a govern-close amendment rather than forcing the row green.
12. A fused `excessive-violence` hook survives `JSON.parse(JSON.stringify(hook))` byte-identically; a `heroEffectExcessiveViolence` effect with `excessiveViolenceEffects === undefined` safe-skips as a no-op.
13. Full `@legendary-arena/game-engine` suite green; `pnpm -r build` 0; `finalStateHash` unchanged (or dual-re-pinned honestly with provenance if it moved).

---

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0; `pnpm --filter @legendary-arena/game-engine test` → all pass (+ enroll / fire / once-per-turn / decline / fusion tests).
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → "Updated 3 lines" (rending-claws, serious-overkill, can-i-get); re-run → 0 updates (idempotent).
3. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → all 0.
4. `grep "excessive-violence" docs/ai/coverage/hero-mechanic-ledger.csv` → the four wired cards present; confirm the per-hero aggregation for `carnage` stays honest (not blanket-executable) per AC #11.
5. `git diff --name-only` shows only the allowlist (+ regenerated data/feeds); confirm `finalStateHash` fixtures unchanged (or re-pinned with one-line provenance); revert any `lagn-v1.json` CRLF-only churn.

---

## Vision Alignment

**Vision clauses touched:** §1, §2, §10 (card data / content semantics), §8 / §22 (determinism).

**Conflict assertion:** No conflict — this WP makes already-shipped cards resolve their printed Excessive Violence ability faithfully (Venomverse rulebook, glossary id 30). It adds no new content and changes no rule text.

**Non-Goal proximity check:** None of NG-1..7 is crossed — no pay-to-win surface (the overspend is a strategic in-game attack spend available to every player who plays the card), no cosmetic-for-outcome, no monetization or persuasive surface.

**Determinism preservation:** the fire path is a fixed-order `for...of` dispatch of already-parsed effects, keyed off a `CardExtId[]` ledger; the overspend is a deterministic `spendFightCost` debit; the two new `TurnEconomy` fields are omit-when-off, dropped every turn (Vision §22 replay-faithful). No `Math.random`; no new persisted state read back by application code; the sentinel / PRE_WP080 hashes are expected byte-unchanged (all four cards non-core, omit-when-off fields), verified empirically at execution.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved:

- **§1 (structure):** `## Goal`, `## Assumes`, `## Context (Read First)`, `## Scope (In)`, `## Out of Scope`, `## Files Expected to Change`, `## Non-Negotiable Constraints`, `## Acceptance Criteria`, `## Verification Steps`, `## Definition of Done` all present and non-empty; `## Out of Scope` excludes the reveal-KO EV cards, the passive line 0, other sets, and the client affordance.
- **§2 (constraints):** engine-wide block requires full file contents, forbids diffs/snippets, states ESM/Node v22, references `00.6-code-style.md`; packet-specific + session-protocol + locked-values present; no contradiction with the body.
- **§3 (assumes):** every dependency file/state listed with the shape it must have (substrate, the "fires all hooks at play" fact, allowlist-fusion pattern, turn-scoped-flag pattern, reentrant dispatcher, inner executors, fight-move gate shape, marker legality).
- **§4 (context):** specific docs + sections — glossary id 30 quoted verbatim, WP-735 sibling, the exact setup/execute/economy/moves files + line regions, `DECISIONS.md` entries, user memories.
- **§5 (files):** every file marked new/modified with a one-line change; bounded to the engine + card-data allowlist.
- **§6 (naming):** `ext_id` / `abilities[]` / canonical `{setAbbr}/{heroSlug}/{cardSlug}` keys, `CardExtId`, `TurnEconomy` field names match `00.2` / existing code; no abbreviations.
- **§7 (dependencies):** no new npm dependency; `node:test` only.
- **§8 (boundaries):** Game Engine + Card Data only; no server/DB/client/RNG; moves never throw; `G`/`TurnEconomy` stay JSON-serializable (ledger is `CardExtId` strings); no boardgame.io import in pure helpers (the economy setters + fire driver are pure).
- **§9 (Windows):** commands are `pnpm` / `node`; no bash-only assumptions.
- **§10 (env):** N/A — no environment variables introduced.
- **§11 (auth):** N/A — no authentication surface.
- **§12 (tests):** `node:test` + `node:assert`; `makeMockCtx`; no boardgame.io import; no network/DB; deterministic.
- **§13 (verification):** exact `pnpm` / `node` commands with expected output.
- **§14 (acceptance):** 13 binary, observable, file/function-specific criteria aligned to scope.
- **§15 (DoD):** STATUS.md / DECISIONS.md (land D-24556 + D-24557) / WORK_INDEX.md updates + scope-boundary check present; `**User-Visible Surface:** play.legendary-arena.com` + `## User-Visible Impact` present; D-24026 live-verify item present.
- **§16 (code style):** the fusion helper, the two economy setters, the enroll handler, and the fire driver are single-purpose, JSDoc'd, `// why:`-commented, no abbreviations, no `.reduce()` in the fire loop, no premature abstraction (fusion follows `buildDigestIndigestionFusion`; setters follow `enableDrawLock`).
- **§17 (vision):** triggered (card semantics + determinism) — `## Vision Alignment` present with clause numbers + determinism line.
- **§18 (prose-vs-grep):** the only grep Verification Step targets `excessive-violence` (a permitted new token), not a forbidden token.
- **§19 (bridge staleness):** N/A — no repo-state-summarizing artifact; baseline SHA cited.
- **§20 (funding):** N/A — no funding surface or copy.
- **§21 (API catalog):** N/A — no HTTP endpoint and no `apps/server/src/**` library function added or modified (the fight-move arg is an engine move signature, not a server API).

**Verdict:** all sections PASS or justified N/A.

## Pre-flight (01.4)

Run as an independent gate subagent against live code on this branch (synced to `origin/main` @ `c423a8ce` + the reserve commit). All twelve mechanic-level claims verified TRUE with file:line evidence. **Confirmed baseline counts: `HERO_KEYWORDS.length` = 63 (→64), `HERO_EFFECT_HANDLERS` = 47 (→48)** — but the EC's "read the baseline at execution" posture stands (concurrent WPs move these). Verified: `executeHeroEffects` fires all hooks at play and does not filter by timing (`heroEffects.execute.ts:248`); `HeroAbilityTiming` has `onFight` + `KEYWORD_TIMING_DEFAULTS` (`setup/heroAbility.setup.ts:426`); `HeroEffectDescriptor` self-recursive since WP-735 (`digestEffects?` `heroAbility.types.ts:192`); `buildDigestIndigestionFusion` (`:2865`, non-mutating, allowlist-threaded on the canonical key `:3012`); the `TurnEconomy` carry chokepoint `carryConversionFlag` (`economy.logic.ts:499`) + `enableDrawLock` (`:671`) + `resetTurnEconomy` base literal drops the flags (`:728`); `executeSingleEffect` (`:4983`) gated by `MVP_KEYWORDS` with all four inner executors present (`heroEffectDraw` :1315, `heroEffectRescue` :1436, `heroEffectOptionalKoHandDiscard` :2516, `heroEffectRecruit` :1388); the fight-move gate/debit shape in both moves; the inner marker tokens legal in `VALID_TOKEN_PATTERN`; the four cards' ability text/idx exact; **the `_deferred` scope-lock exact (only `can-i-get` idx1 deferred; `rending-claws`/`razor-teeth`/`serious-overkill` absent from the file — no WP-735 PS-1 recurrence)**; and the drift-site enumeration COMPLETE (`heroKeywords.test.ts:65`, `rules/heroAbility.setup.test.ts:627` + parity `:633` + dynamic `:654`, `setup/heroAbility.setup.test.ts:1430`, `heroEffects.execute.test.ts:107` + `:7123` + bidirectional `:50`). All hard-deps landed.

**PS-items: none.** **RS-items (folded in):** RS-1 → the "fire strictly after the `spendFightCost` debit" constraint is now locked in `## Contract` + `## Non-Negotiable Constraints` (razor-teeth-under-recruit-as-attack ordering). RS-2 → a Required `// why:` notes `carryConversionFlag` now also carries the EV ledger. RS-3 → the "update the WP-735-referencing drift-message text at each bumped site" instruction is reinforced in the EC.

**Verdict: READY TO EXECUTE.**

## Copilot (01.7)

Run as an independent gate subagent (30-mode audit) against the WP + EC + live source. **All 30 modes PASS.** The four highest-risk areas each verified against real code facts: the `executeSingleEffect` `MVP_KEYWORDS`/`NO_MAGNITUDE_KEYWORDS` double-gate (makes the wrapper's registry membership load-bearing — a miss on either silently drops the enroll); the `carryConversionFlag` chokepoint (guarantees the ledger's turn-scoped survival across same-turn rebuilds); the spend-after-defeat fight-move structure (makes the single-`spendFightCost(required+1)` arithmetic sound, no double-debit); and the marker-map `_deferred` state (the exact WP-735 PS-1 blocker class — here already correct). The reward-integrity per-hero-aggregation premise (`carnage` mixes wired `rending-claws` + deferred `gruesome-feast`/`feast-or-famine`) is factually accurate and AC #11 handles it honestly.

**One advisory (Mode 16, folded in):** fire `fireExcessiveViolencePlays` from the MOVE BODY, never inside the exported `defeatCityVillainCore` (reused by non-fight defeat paths carrying no EV arg). Now locked as an explicit `## Non-Negotiable Constraints` bullet + an EC guardrail.

**Verdict: PASS** (CONFIRM). Session-prompt generation authorized.

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` = the allowlist only (+ regenerated data/feeds).
- [ ] `docs/ai/STATUS.md` updated with what changed; D-24556 + D-24557 flipped Active in `DECISIONS.md`; WORK_INDEX row checked; EC_INDEX Done; mindmap node `✅`; `roadmap:counts:check` 0.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] **D-24026 live-verify (post-merge, REQUIRED):** in a live match on `play.legendary-arena.com`, playing an EV card and fighting with the extra attack fires the EV ability (draw / +recruit / KO-choice / rescue), verified against the deployed `/api/version` gitSha. Inherently post-deploy; recorded as a follow-up STATUS-flip, not a merge blocker. **Note:** the client "Fight using Excessive Violence" affordance is a deferred sibling client WP — until it ships, live-verify drives the arg via the diagnostic / autoplay `setupData` path (or the follow-up client WP), not a player-facing button.
