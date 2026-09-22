# Session Prompt — WP-736 / EC-773: "Excessive Violence" fight-overspend hero keyword

**WP:** docs/ai/work-packets/WP-736-excessive-violence-hero-keyword.md
**EC:** docs/ai/execution-checklists/EC-773-excessive-violence-hero-keyword.checklist.md (authoritative execution contract)
**Reserves:** D-24556 (EV mechanic) + D-24557 (fight-move arg contract + Honest-Partial deferral) — both land Active at govern-close. **Status:** READY TO EXECUTE (pre-flight READY, no PS; copilot PASS).

> Committed via `git add -f` (session-*.md is gitignored) so the brief survives the drafting
> worktree's removal — per `feedback_session_prompt_lost_on_worktree_removal`.

## Invocation intent

Un-hollow the D-21602-deferred Venomverse **"Excessive Violence"** family (keywords-full **id 30**).
Add a new `excessive-violence` hero keyword. Playing an allowlisted EV card ENROLLS it into a
turn-scoped ledger (it does NOT fire at play). A fight where the player opts to spend **1 extra
`[attack]`** "using Excessive Violence" — allowed **at most once per turn** — fires every enrolled
EV ability at fight resolution, via the shipped draw/recruit/rescue/optional-ko executors. Resolve
**only** the four allowlisted vnom cards; keep the reveal-KO EV cards + other sets as honest
hollows. Engine + card-data only — no client affordance (deferred sibling client WP), no new
always-on G field.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` (Game Engine layer; move validation contract; persistence boundary; determinism)
3. `.claude/rules/architecture.md`, `.claude/rules/code-style.md`, `.claude/skills/legendary-game-engine/SKILL.md`
4. WP-736 (design authority)
5. EC-773 (execution contract — satisfy every item exactly)
6. `scripts/convert-cards/inputs/keywords-full.json` glossary **id 30 "Excessive Violence"** — the exact semantics; model verbatim, do NOT reinterpret (the once-per-turn +1 overspend, "cards you played this turn", the later-played-cards-miss-the-window rule, duplicate copies each fire)
7. WP-735 / EC-772 (the just-shipped `digest-indigestion` sibling — the wrapper-descriptor + allowlist-gated `buildDigestIndigestionFusion` + reentrant `executeSingleEffect` template this WP mirrors)
8. Source anchors (from the WP §Context, verified by pre-flight against live source):
   `hero/heroEffects.execute.ts` (`executeHeroEffects` ~666 — fires ALL hooks at play, does NOT filter by timing, comment ~248; `executeSingleEffect` ~4983 gated by `MVP_KEYWORDS`; `heroEffectDraw` ~1315, `heroEffectRescue` ~1436, `heroEffectOptionalKoHandDiscard` ~2516, `heroEffectRecruit` ~1388; `HANDLED_KEYWORDS` ~108, `NO_MAGNITUDE_KEYWORDS` ~430, `MVP_KEYWORDS` ~334 region, `HERO_EFFECT_HANDLERS` ~4841);
   `setup/heroAbility.setup.ts` (`buildHeroAbilityHooks`, `buildDigestIndigestionFusion` ~2865 + allowlist threading ~3012, `KEYWORD_PATTERN` ~124 — confirm it can't match `[keyword:Excessive Violence]` space form, `KEYWORD_TIMING_DEFAULTS` ~426);
   `rules/heroAbility.types.ts` (`HeroEffectDescriptor`, `digestEffects?` ~192 — the self-recursive precedent);
   `economy/economy.types.ts` (`TurnEconomy`, `drawsLocked?` ~67) + `economy/economy.logic.ts` (`carryConversionFlag` ~499, `enableDrawLock` ~671, `resetTurnEconomy` ~725, `spendFightCost` ~702, `getSpendableAttack` ~531);
   `moves/fightVillain.ts` (gate ~135, `defeatCityVillainCore` ~224, `spendFightCost` ~227) + `moves/fightMastermind.ts` (gate ~127, `spendFightCost` ~216)
9. User memory: `reference_hero_ability_marker_curated_map`, `reference_sim_coverage_baseline_gate_distinct`, `reference_hashed_g_field_dual_repin`, `reference_bot_legalmoves_moveguard_divergence`, `project_venompool_digest_indigestion_arc`

## Pre-execution checks

- Baseline `origin/main` clean + synced; the WP-736/EC-773/D-24556/D-24557 reserve is already on main.
- `pnpm --filter @legendary-arena/game-engine build && … test` green; **record the baseline test count** and the current `HERO_KEYWORDS.length` (drafting saw **63**) and `HERO_EFFECT_HANDLERS` size (drafting saw **47**) — concurrent WPs may have moved them; READ them, do not trust the numbers.
- Confirm `[keyword:Excessive Violence]` (space form) is NOT matched by `KEYWORD_PATTERN` and falls through as an unresolved marker today (the hollow being fixed); confirm `razor-teeth`'s `[icon:recruit]` parses to a flat recruit grant.

## Execution rules (operationalizing WP-736 + EC-773 — no new scope)

- **New keyword `excessive-violence`** in the `HeroKeyword` union AND `HERO_KEYWORDS`; default timing `onFight` in `KEYWORD_TIMING_DEFAULTS`; handler in `HERO_EFFECT_HANDLERS` AND `HANDLED_KEYWORDS` AND `MVP_KEYWORDS` (so `executeSingleEffect` dispatches the enroll wrapper) AND `NO_MAGNITUDE_KEYWORDS` (wrapper carries no magnitude; inner effects ride their markers).
- **Wrapper descriptor** — add `excessiveViolenceEffects?: HeroEffectDescriptor[]` to `HeroEffectDescriptor` (the `digestEffects?` additive-optional precedent; land D-24556 Active for the contract-file edit).
- **Setup-time fusion** — an `EXCESSIVE_VIOLENCE_PATTERN` (`/\[keyword:Excessive Violence\]/`, space form) + an `EXCESSIVE_VIOLENCE_CARDS` allowlist (the four canonical `{setAbbr}/{heroSlug}/{cardSlug}` keys); a `buildExcessiveViolenceFusion` mirroring `buildDigestIndigestionFusion` — receives the canonical key (thread it, do NOT copy a bare-`abilities` signature), non-mutating, parses the EV line's inline effects → `excessiveViolenceEffects`, emits ONE `excessive-violence` hook (timing `onFight`), and **consumes** the inner tokens (no leftover standalone draw/recruit/rescue/ko hook, no residual unresolved `Excessive Violence` marker).
- **Enroll handler `heroEffectExcessiveViolence`** — fires at PLAY time via `executeHeroEffects`; its ONLY job is `G.turnEconomy = enrollExcessiveViolenceCard(G.turnEconomy, cardId)`; applies NO inner effect; safe-skip if `excessiveViolenceEffects === undefined`. Returns true.
- **Fight-time driver `fireExcessiveViolencePlays(G, ctx, playerID)`** — for each `cardId` in `G.turnEconomy.excessiveViolencePlayedCards ?? []` (enrolment order), find its `excessive-violence` hook in `G.heroAbilityHooks`, dispatch each descriptor in `excessiveViolenceEffects` via `executeSingleEffect`. `for...of`, no `.reduce()`, never throws.
- **Turn-scoped state** — two omit-when-off `TurnEconomy` fields: `excessiveViolencePlayedCards?: CardExtId[]` (omit-when-empty ledger, append order = fire order, duplicates allowed) + `excessiveViolenceUsedThisTurn?: boolean`. Both absent from the `resetTurnEconomy` base literal; both carried by `carryConversionFlag` (extend it — add a `// why:` that it now ALSO carries the EV ledger, RS-2); two setters `enrollExcessiveViolenceCard` + `markExcessiveViolenceUsed` (the `enableDrawLock` shape, both spread the carry).
- **Fight moves** (`fightVillain` + `fightMastermind`, in the MOVE BODY — NOT `defeatCityVillainCore`, which non-fight defeats reach without the arg): add optional `useExcessiveViolence?: boolean`. `evActive = args.useExcessiveViolence === true && getSpendableAttack(pre) >= requiredFightCost + 1 && !turnEconomy.excessiveViolenceUsedThisTurn`. Sequence: `defeatCityVillainCore` → SINGLE `spendFightCost(requiredFightCost + (evActive ? 1 : 0))` → if `evActive` then `markExcessiveViolenceUsed` then `fireExcessiveViolencePlays`. **Fire strictly after the debit** (RS-1) so a razor-teeth recruit grant can't change what `spendFightCost` pulls under a `recruitSpendableAsAttack` loadout. Unaffordable `+1` / already-used → fight NORMALLY (silent, moves never throw).
- **Card-data** — via the curated map `inputs/hero-ability-markers.json` (all tokens already legal, NO apply-script change): APPEND `[keyword:draw:1]` to `carnage/rending-claws` idx0 + `[keyword:optional-ko-hand-discard]` to `venom-rocket/serious-overkill` idx0 (2 net-new); CONVERT the single `_deferred` `venompool/can-i-get-a-little-gratitude` idx1 → active `[keyword:rescue:1]`; NO marker on `razor-teeth`; UPDATE the `_deferred` reasons of `gruesome-feast` / `feast-or-famine` / `slapstick` (EV timing now ships but that ability/set deferred). Regenerate `data/cards/vnom.json` + the four derived feeds; `sim:coverage --check`, regen the distinct baseline ONLY if it flags the new keyword.
- **Determinism** — ledger + guard omit-when-off, dropped each turn; fixed-order `for...of` fire; no `Math.random`. All four cards vnom (non-core); no committed sentinel/PRE_WP080 fixture plays+fires them → `finalStateHash`/`PRE_WP080_HASH` expected byte-unchanged. VERIFY empirically; if a pin shifts, dual re-pin HONESTLY (`reference_hashed_g_field_dual_repin`) — never edit a pin to force green.
- **Per-hero aggregation honesty (WP-735 AC #8 / AC #11)** — `carnage` carries a wired EV card (rending-claws) AND deferred ones (gruesome-feast, feast-or-famine); do NOT alias `excessive-violence`→executable per-hook so the aggregated `carnage` row over-claims the deferred siblings. Keep the mixed-hero raw row honest; verify un-hollow via each wired card's runtime-observed drop.
- **Tests** — drift bumps (every numeric `HERO_KEYWORDS.length` + expected-array parity, leave the dynamic `uniqueKeywords.size` alone; every `HERO_EFFECT_HANDLERS` count site; bidirectional `HANDLED_KEYWORDS` set) with the stale WP-735 it()-title/message text RE-WORDED to WP-736 (RS-3, not a bare number bump) + behavior tests (enroll-not-fire-at-play, fire-at-fight, once-per-turn, unaffordable-decline, normal-fight-byte-unchanged, ledger omit-when-off `JSON.stringify`, duplicate-enrolment, fused-hook JSON-roundtrip, safe-skip, non-allowlisted-stays-hollow, razor-teeth-under-recruit-as-attack ordering) across the engine + economy + both fight-move test files.
- **No client / new pending type / new move** — serious-overkill reuses the shipped `optional-ko-reward` pending queue; `getLegalMoves` still offers the plain fight (optional arg defaults to normal — no legalMoves↔guard divergence).

## SAFE-KNOBS scope

N/A — no knob surface.

## Session task

Execute WP-736 per EC-773: keyword + wrapper descriptor + two omit-when-off `TurnEconomy` fields +
setters + allowlist-gated non-mutating fusion + enroll handler + fight-time fire driver + the
`useExcessiveViolence?` overspend on both fight moves + card-data markers + regen + full test set.
Two-commit topology: `EC-773:` implementation, then `SPEC:` govern-close (land D-24556 + D-24557
Active; flip WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅, `roadmap:counts:write`,
`ledger:numbers:check`; update STATUS.md). Open one PR. **D-24026 live-verify REQUIRED**
(post-deploy, surface = `play.legendary-arena.com`): a live match where playing an EV card and
fighting with the extra attack fires the EV ability (draw / +recruit / KO-choice / rescue) —
verified against the deployed `/api/version` gitSha; recorded as a follow-up STATUS-flip, not a
merge blocker. NOTE: until the sibling client affordance ships, drive the `useExcessiveViolence`
arg via the diagnostic / autoplay `setupData` path (`reference_autoplay_setupdata_live_verify`).

## Post-merge close ritual (REQUIRED)

After the operator merges the PR (GitHub UI):
- `node scripts/prune-empty-claude-branch.mjs --verify-current` from the worktree (expect `VERIFY PASS`).
- `git branch -D <branch>` + `git push origin --delete <branch>`.
- `node scripts/prune-empty-claude-branch.mjs --report` from canonical (expect silent).

## Scope restriction

This prompt restates/operationalizes WP-736 + EC-773 only. No new scope, files, contract
elements, locked values, or forbidden patterns. New surface goes back into the WP/EC and
re-runs the gates.
