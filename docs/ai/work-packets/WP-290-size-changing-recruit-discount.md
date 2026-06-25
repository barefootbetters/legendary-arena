# WP-290 — Size-Changing: Hero Recruit-Cost Discount

**Status:** Ready to Execute
**Layer:** Game Engine (`packages/game-engine` — setup/parser, economy, moves, simulation, UIState projection)
**Depends on:** WP-273 ✅ (recognized-keyword-with-no-onPlay-handler precedent: wall-crawl), WP-179 ✅ (`G.cardTraits.heroClass`), WP-023 ✅ (`heroClassMatch` over `inPlay`), WP-018 ✅ (`G.cardStats.cost` + economy)
**EC:** EC-322
**Decisions:** D-24074
**User-Visible Surface:** play.legendary-arena.com (recruit a Size-Changing hero for less; the HQ shows its discounted cost)

---

## Goal

Implement the printed **Size-Changing** hero mechanic: a recruit-cost discount of **2 Recruit
less per listed Hero Class you played this turn** (e.g. `Size-Changing: [hc:tech]` = "recruit this
card for 2 Recruit less if you played any [hc:tech] Hero this turn"; multi-class
`Size-Changing: [hc:strength], [hc:covert]` = 2 less per listed class you played, cumulative).
The mechanic currently fires a `parse-unrecognized` **hollow** at `onPlay` — confirmed live on
`antm/jocasta/holographic-image-inducer` (diagnostics `gitSha 988ad2e`, 2026-06-25) — because the
parser has no path for the `[keyword:Size-Changing]` marker and the discount is unimplemented.
After this WP: the marker is recognized (no more hollow), and recruiting a Size-Changing hero
costs `max(0, printedCost − 2 × classesPlayedThisTurn)`, applied authoritatively at the recruit
move, priced correctly by the simulation, and shown as the effective cost in the HQ.

---

## Assumes

- **WP-273 ✅** (D-24049) established the structural pattern for a **recognized keyword that has no
  `onPlay` HERO_EFFECT_HANDLERS entry and executes elsewhere**: `wall-crawl` is added to
  `HERO_KEYWORDS`, given a non-`onPlay` default via `KEYWORD_TIMING_DEFAULTS`, and joins a dedicated
  executed-category set (`RECRUIT_TIME_EXECUTED_KEYWORDS`) so its play-time hook visit classifies
  `applied` (not-hollow) without a handler. Size-Changing mirrors this — it is a recruit-time
  **cost** mechanic, not an `onPlay` action.
- **The patrol fight-cost modifier** (`getPatrolModifier`, `board/boardKeywords.logic.ts:37`) is the
  precedent for a pure cost modifier applied **additively at two sites** (`fightVillain.ts:80-82`
  and `ai.legalMoves.ts:222-224`). Size-Changing is the **recruit** analog: a discount applied at
  `recruitHero.ts:71` and `ai.legalMoves.ts:207`.
- **`heroClassMatch`** (`hero/heroConditions.evaluate.ts:49-68`) already computes "did the player
  play a [hc:X] Hero this turn" by scanning `G.playerZones[pid].inPlay` against
  `G.cardTraits[id].heroClass`. `inPlay` holds exactly the cards played this turn (cleared at
  `endTurn`). The discount reuses this read pattern (no new per-turn tracker).
- **`G.cardStats[id].cost`** is the printed recruit cost, read at `recruitHero.ts:71` (affordability
  + spend) and `ai.legalMoves.ts:207` (sim affordability). The HQ display cost is projected through
  `ui/uiState.build.ts` (HQ slot section). These three are the recruit-cost surface the discount
  must reach; the other `cost` reads (hero-capture selection, reveal tie-break, the captured-hero
  cost sum in `resolveFightCost`) use the **printed** cost and are intentionally unaffected.
- **`[keyword:Size-Changing]` marker grammar** in `data/cards/*.json` varies in punctuation:
  `[keyword:Size-Changing] [hc:tech]`, `[keyword:Size-Changing]: [hc:tech]`, multi-class
  `[hc:strength], [hc:covert]` (with/without spaces), and a trailing "this turn." The parser must
  robustly extract the `[hc:...]` class list that follows the marker.

---

## Context

The hollow-effect detector (WP-257) flagged `antm/jocasta/holographic-image-inducer#2`:
`size-changing` / `onPlay` / `parse-unrecognized` / turn 28, in a real `play.legendary-arena.com`
match. The same gap is already tracked as `unsupported` across the Ant-Man family in the
`/coverage` hero-mechanic ledger (amwp + antm: ant-man, ant-army, cassie-lang, jocasta, wasp, …)
and appears in the committed runtime-observed sweep artifact — so the live signal, the competent
sweep, and the ledger agree. Size-Changing is one of the highest-frequency unsupported mechanics
(the Ant-Man sets' signature), so implementing it clears many cards at once.

The `onPlay` timing in the flag is an artifact: the parser parks the unrecognized marker on an
`onPlay` hook by default, so when the card is played the hook visit sees an unresolved marker. The
mechanic itself never had an `onPlay` effect — it is a recruit-time cost discount — so the fix both
**recognizes** the marker (stopping the false-timing hollow) and **implements** the discount.
Drafted against `origin/main` at `d1adb7fc`. Supersession check clean.

**Why one WP, not paired (engine + UX):** the only client-side touchpoint is the recruit
affordability gate (`useCardCostGating`), which reads `UICardDisplay.cost` — it needs **no change**
if the engine projects the effective HQ recruit cost into that field. So the whole change lives in
`packages/game-engine` (gameplay + its UIState projection); there is no separate client surface to
co-release (unlike WP-286↔WP-287's new prompt component). One WP.

---

## Scope (In)

- **Recognize the keyword.** Add `'size-changing'` to `HERO_KEYWORDS` (union + array, 22 → 23) and
  its drift tests. Parse `[keyword:Size-Changing]` + extract the trailing `[hc:...]` class list
  (single + multi-class, punctuation-tolerant) in `setup/heroAbility.setup.ts`; store the
  normalized class list on the hook (`HeroAbilityHook.sizeChangingClasses?: string[]`). Give it a
  recruit-time category so the `onPlay` hook visit classifies not-hollow with no handler (the
  wall-crawl pattern: a `RECRUIT_COST_KEYWORDS` set + MVP_KEYWORDS membership; no
  HERO_EFFECT_HANDLERS entry).
- **Store per-card at setup.** Build `G.cardSizeChangingClasses: Record<CardExtId, string[]>` (a
  sibling snapshot to `cardKeywords`/`cardTraits`) from the parsed hooks in
  `setup/buildInitialGameState.ts`.
- **The discount helper.** New `economy/sizeChanging.logic.ts`:
  `getSizeChangingRecruitDiscount(G, playerID, cardId): number` — mirrors `getPatrolModifier`;
  returns `2 × (count of the card's listed classes for which `inPlay` holds ≥1 Hero of that class)`
  (0 when the card has no Size-Changing). Pure, `for...of`, no `.reduce()`.
- **Apply authoritatively.** `recruitHero.ts`: `requiredCost = max(0, printedCost − discount)` for
  both the affordability check and the spend. `ai.legalMoves.ts`: the same for the sim's recruit
  affordability (so the bot prices a discounted recruit correctly).
- **Project the effective cost.** `ui/uiState.build.ts` HQ slot projection: surface the effective
  (discounted) recruit cost so the client gate (`useCardCostGating`) allows it and the player sees
  the discount. (Computed per-viewer from `inPlay`; no client change.)
- **Tests** for each: parser extraction, the discount helper, recruit affordability/spend, sim
  pricing, the HQ projection, the keyword/hollow drift.

## Out of Scope

- **Villain fight-cost Size-Changing** (`Size-Changing` on villain cards = fight for 2 Attack less
  per class played) — the parallel mechanic on the fight-cost surface (`resolveFightCost` +
  `fightVillain` + `ai.legalMoves` fight pricing + UIState city cost). A named follow-up WP.
- **Microscopic Size-Changing** — materially different (2 less **per card** played, up to N icons,
  and can drive the cost **negative** → gain Recruit/Attack). Distinct keyword; its own follow-up.
- **The Divided-Card two-sided Size-Changing form** and any negative-cost handling — regular
  Size-Changing floors at 0 (only Microscopic goes negative).
- **No change** to the printed `G.cardStats[id].cost`, to card data, to the captured-hero cost sum,
  hero-capture selection, or reveal tie-break (all use printed cost).

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — add `'size-changing'` (union + array, 22 → 23)
- `packages/game-engine/src/rules/heroKeywords.test.ts` — drift 22 → 23
- `packages/game-engine/src/rules/heroAbility.types.ts` — add `sizeChangingClasses?: string[]` to `HeroAbilityHook`
- `packages/game-engine/src/setup/heroAbility.setup.ts` — recognize `[keyword:Size-Changing]` + extract the class list + recruit-time category
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — drift 22 → 23 + Size-Changing parse tests
- `packages/game-engine/src/types.ts` — add `cardSizeChangingClasses?: Record<CardExtId, string[]>` G field
- `packages/game-engine/src/setup/buildInitialGameState.ts` — build `G.cardSizeChangingClasses` from the parsed hooks
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `'size-changing'` in `RECRUIT_COST_KEYWORDS` → MVP_KEYWORDS (not-hollow at onPlay; no handler)
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — MVP-coverage drift for the new category
- `packages/game-engine/src/economy/sizeChanging.logic.ts` — **new**: `getSizeChangingRecruitDiscount`
- `packages/game-engine/src/economy/sizeChanging.logic.test.ts` — **new**: discount tests
- `packages/game-engine/src/moves/recruitHero.ts` — apply the discount (affordability + spend)
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — apply the discount (sim recruit affordability)
- `packages/game-engine/src/ui/uiState.build.ts` — project the effective HQ recruit cost
- `packages/game-engine/src/ui/uiState.build.test.ts` — effective-cost projection test

**Note on file count:** ~15 files. The mechanic is a single cohesive engine unit (parse → store →
discount → apply at the two cost sites → project → recognize) entirely within `packages/game-engine`;
no layer is crossed. Comparable to WP-285 (18) / WP-286 (22). The discount-helper file pair and the
keyword/G-field/hook additions are inseparable from the cost-site wiring.

---

## Contract

- **D-24074:** `G.cardSizeChangingClasses[id]` is the per-card normalized list of Hero Classes whose
  presence in the player's `inPlay` this turn each grant a **2 Recruit discount** when recruiting
  card `id`. The effective recruit cost is `max(0, G.cardStats[id].cost − getSizeChangingRecruitDiscount(...))`
  and MUST be applied identically at every authoritative recruit-cost site (`recruitHero`,
  `ai.legalMoves`) and projected as the effective HQ cost in UIState. The discount floors at 0
  (regular Size-Changing never gives a negative cost — that is Microscopic, out of scope).
- `'size-changing'` is a `HeroKeyword` recognized at parse time with **no** `onPlay` handler (the
  wall-crawl class): its play-time hook visit classifies not-hollow; the cost discount executes at
  recruit-cost resolution.

---

## Acceptance Criteria

- **AC-1:** Parser — `[keyword:Size-Changing] [hc:tech]` and `[keyword:Size-Changing]: [hc:strength], [hc:covert]`
  each resolve to a hook carrying `sizeChangingClasses` = the normalized class list, and produce
  **no** `unresolvedMarkers` entry and **no** hollow for that line.
- **AC-2:** `antm/jocasta/holographic-image-inducer` no longer fires a `size-changing` /
  `parse-unrecognized` hollow at `onPlay` (its second line still draws 2).
- **AC-3:** `getSizeChangingRecruitDiscount` returns `2 × matchedClassesPlayedThisTurn` (0 when the
  card has no Size-Changing data, or when no listed class is in `inPlay`); reads `inPlay` +
  `cardTraits` fresh from `G`.
- **AC-4:** `recruitHero` — recruiting a Size-Changing hero costs `max(0, printedCost − discount)`:
  the affordability check passes at the discounted threshold and the spend deducts the discounted
  amount; a player with the discounted-but-not-printed amount **can** recruit it.
- **AC-5:** `ai.legalMoves` — the sim enumerates a Size-Changing recruit as affordable at the
  discounted threshold (the bot can recruit it when only the discounted amount is available).
- **AC-6:** UIState — the HQ slot for a Size-Changing hero projects the **effective** recruit cost
  for the viewer (printed cost when no listed class was played; reduced when one or more were).
- **AC-7:** `HERO_KEYWORDS` is 23 entries incl. `'size-changing'`; both drift tests pass; the
  MVP-coverage test recognizes `'size-changing'` via the new recruit-cost category (no
  HERO_EFFECT_HANDLERS entry — handler count unchanged).
- **AC-8:** `pnpm --filter @legendary-arena/game-engine build` 0; `test` green (≥ baseline + the new
  cases); `tsc --noEmit` 0; `pnpm -r build` 0.
- **AC-9:** Determinism — `pnpm sim:runtime-observed:check`: the `size-changing` hollow is **removed**
  from the runtime-observed artifact (the mechanic now executes); the artifact is regenerated and
  committed. `finalStateHash` may shift if the competent bot now recruits a Size-Changing hero it
  previously could not afford — if it shifts, re-pin the sentinel and record the divergence as
  EXPECTED (the bot legitimately prices recruits differently now). Confirm empirically.

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/game-engine build         # 0
pnpm --filter @legendary-arena/game-engine test          # green; ≥ baseline + new cases
pnpm --filter @legendary-arena/game-engine exec tsc --noEmit  # 0
pnpm ledger:heroes                                       # regenerate; size-changing flips unsupported → executable
pnpm sim:runtime-observed                                # regenerate; size-changing hollow removed
pnpm sim:coverage --check                                # no coverage regression
pnpm -r build                                            # 0
git diff --name-only -- packages/game-engine             # only the ~15 listed files (+ coverage artifacts)
```

---

## Vision Alignment

**Touched surfaces (§17.1):** Card-accurate effect execution (Vision §1, §2) — implements a printed
mechanic faithfully; determinism (§3, §8) — the discount is a pure read over `inPlay` + `cardTraits`.

**Clause check:** §1/§2 — Size-Changing is printed on the physical card; this implements it exactly.
No conflict.

**Conflict assertion:** No conflict.

**Non-Goal proximity:** No NG-1..7 (no monetization, scoring weights, identity, or pay-to-win — a
cost discount the printed card already grants).

**Determinism preservation:** `getSizeChangingRecruitDiscount` is pure (reads `inPlay` +
`cardTraits`, no RNG, no mutation). The only determinism effect is that the competent bot may now
afford a recruit it previously could not — a legitimate, deterministic pricing change; the sentinel
re-pins only on that divergence (executor confirms via `sim:runtime-observed`).

---

## Funding Surface Gate

**N/A** — gameplay-fidelity mechanic; no funding affordance, copy, or channel; no §20.1 surface.

## §21 API Catalog

**N/A** — no `apps/server` HTTP endpoint or `Library-only` function added or modified.

---

## Lint Gate Self-Review

| § | Status | Notes |
|---|---|---|
| §1 Structure | ✅ PASS | All required sections present |
| §2 Constraints | ✅ PASS | Reuse patrol-modifier + wall-crawl patterns; both cost sites + UIState; floor at 0 |
| §3 Assumes | ✅ PASS | WP-273/179/023/018 deps; the cost surface + heroClassMatch read cited with file:line |
| §4 Context | ✅ PASS | Live hollow + ledger/sweep agreement; baseline d1adb7fc; onPlay-timing artifact explained |
| §5 Files | ✅ PASS | ~15 files listed; cohesive single-layer rationale |
| §6 Naming | ✅ PASS | Canonical `[hc:X]` slugs; `sizeChangingClasses` / `cardSizeChangingClasses` consistent |
| §7 Dependencies | ✅ PASS | No new npm deps |
| §8 Boundaries | ✅ PASS | All `packages/game-engine`; no layer crossing (UIState projection is engine code) |
| §9 Windows | ✅ PASS | `pwsh` verification steps |
| §10 Env Vars | ✅ PASS | None |
| §11 Auth | N/A | No auth surface |
| §12 Tests | ✅ PASS | `node:test`; parser/discount/recruit/sim/UIState/drift coverage |
| §13 Verification | ✅ PASS | Exact commands incl. coverage-artifact regen + the sweep |
| §14 AC Quality | ✅ PASS | 9 binary, observable items |
| §15 DoD | ✅ PASS | STATUS/DECISIONS/WORK_INDEX/EC_INDEX/mindmap + coverage artifacts; D-24026 live-verify (recruit a Size-Changing hero cheaper) |
| §16 Code Style | ✅ PASS | `// why:` on the discount, the floor, the keyword category; `for...of`; no `.reduce()` |
| §17 Vision | ✅ PASS | §1/§2/§3/§8 cited; determinism line present |
| §18 Grep/Prose | ✅ PASS | No literal-string grep gate restates a forbidden token in adjacent prose |
| §19 HEAD Staleness | N/A | Not a repo-state-summarizing artifact |
| §20 Funding | ✅ PASS | N/A with justification |
| §21 API Catalog | ✅ PASS | N/A with justification |

**Lint gate verdict: ALL PASS — ready for pre-flight.**

---

## Pre-flight Verdict

**READY TO EXECUTE**

- ✅ Live hollow confirmed (`antm/jocasta/holographic-image-inducer`, `gitSha 988ad2e`) + ledger/sweep agreement
- ✅ Cost surface mapped: `recruitHero.ts:71` + `ai.legalMoves.ts:207` (recruit) + the HQ UIState projection — the only sites the discount must reach (other `cost` reads use printed cost, unaffected)
- ✅ Patrol-modifier (`getPatrolModifier`) + wall-crawl (recognized-keyword-no-onPlay-handler) precedents confirmed — the two patterns this mirrors
- ✅ `heroClassMatch` over `inPlay` already computes "played a [hc:X] hero this turn" — no new tracker
- ✅ Scope locked: hero recruit discount only; villain fight-cost + Microscopic + divided-card + negative-cost deferred
- ✅ Determinism: pure discount; sentinel re-pin only if the bot now affords a previously-unaffordable recruit (executor confirms)

---

## Copilot Check Verdict

**PASS**

Mirrors two established patterns (the patrol cost modifier applied at two sites; the wall-crawl
recognized-keyword-with-no-onPlay-handler). The load-bearing risks: (1) a missed recruit-cost site
→ the engine and UI disagree on price — mitigated by the explicit surface map (only `recruitHero` +
`ai.legalMoves` + the HQ projection are authoritative; the other `cost` reads are printed-cost by
design); (2) the parser grammar variety — covered by AC-1's multi-form tests; (3) a determinism
shift if the bot now affords a recruit — handled by AC-9's regenerate-and-re-pin. No new contract
beyond the additive G field + hook field (D-24074).

---

## Definition of Done

- [ ] All 9 Acceptance Criteria pass
- [ ] `pnpm --filter @legendary-arena/game-engine test` green (≥ baseline + new cases)
- [ ] `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` 0; `pnpm -r build` 0
- [ ] `pnpm sim:runtime-observed` regenerated (size-changing hollow removed) + `pnpm ledger:heroes` regenerated (size-changing → executable) + `sim:coverage --check` no regression; sentinel re-pinned only on an EXPECTED bot-pricing divergence
- [ ] `docs/ai/STATUS.md` updated with the WP-290 execution summary
- [ ] `docs/ai/DECISIONS.md` — D-24074 flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-290 checkbox flipped to `[x]`
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-322 flipped to Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-290 node added
- [ ] No files outside `## Files Expected to Change` (+ the regenerated coverage artifacts) modified
- [ ] **User-Visible Surface: play.legendary-arena.com.** D-24026 live-verify (post-deploy): play one
      or more `[hc:tech]` Heroes, then recruit a `Size-Changing: [hc:tech]` Hero (e.g.
      Holographic Image Inducer) and confirm it costs 2 (or more) Recruit less and the HQ shows the
      reduced cost.
