# WP-661 — Gate the co2e/ssw1 "made at least N recruit" Attack Grants on `recruit-threshold` (card-data + tests)

**Status:** EXECUTED 2026-09-07 (Ready — green, pending commit/PR) · **Card-data + tests lane** (five marker rows in `hero-ability-markers.json`, regen, and setup-parser tests — no engine code change). Reserves **D-24472** / **EC-698**.

**Primary Layer:** card-data pipeline (`scripts/convert-cards/inputs/hero-ability-markers.json` + regen) → Game Engine derived feeds; tests in `packages/game-engine/src/setup/heroAbility.setup.test.ts`.
**User-Visible Surface:** `play.legendary-arena.com` — five Thor / Lady Thor cards that print "if you made at least N recruit this turn" stop handing out their printed grant **unconditionally** and instead gate it on the recruit threshold. **D-24026 REQUIRED** (a live Lady Thor / co2e Thor match: the grant fires only after ≥N recruit).
**Dependencies:** WP-660 ✅ (removed the phantom recruit that co-located with these grants); WP-545 ✅ / #1865 (the `recruit-threshold` marker + `recruitMadeThisTurnAtLeast` condition + ledger reclassification, all shipped). None open.
**Baseline:** `origin/main` @ `7c04cb92` (after WP-660 / EC-697 merged).

---

## Problem

WP-660 stopped the hero-ability parser from reading a `[icon:recruit|attack]` inside a "made at least N" CONDITION clause as a phantom +N grant. But five hero cards have the shape *"Once (this turn / per turn), if you made at least N[icon:recruit] this turn, you get +M[icon:attack]"* where the `+M[icon:attack]` grant is **real** but, after WP-660, fires **ungated** — the recruit-threshold condition is not modeled on these cards. Empirically confirmed against `buildHeroAbilityHooks` on `origin/main` @ `7c04cb92`:

| Card | Current (buggy) hook | Correct after this WP |
|---|---|---|
| co2e `glory-of-asgard` | `{attack:3}`, `conditions:[]` | `{attack:3}` gated `recruitMadeThisTurnAtLeast:8` |
| co2e `spark-of-the-divine` | `{attack:3}`, `conditions:[]` | `{attack:3}` gated `recruitMadeThisTurnAtLeast:8` (KO-choice half stays unmodeled — honest partial) |
| ssw1 `chosen-by-asgard` | `{attack:2}`, `conditions:[]` | `{attack:2}` gated `recruitMadeThisTurnAtLeast:6` |
| ssw1 `living-thunderstorm` | `{attack:6}`, `conditions:[]` | `{attack:6}` gated `recruitMadeThisTurnAtLeast:6` |
| ssw1 `mysterious-origin` | no effect (draw unmarked) | recruit-threshold gate attached; draw stays an honest hollow |

A card granting attack it never printed unconditionally is the same honest-integrity / fairness defect WP-660 fixed for recruit.

## Fix (card-data only — the engine already ships everything)

Add `[keyword:recruit-threshold:N]` (N=8 for co2e Thor, N=6 for ssw1 Lady Thor) to each card's ability line via `scripts/convert-cards/inputs/hero-ability-markers.json`, then apply + regen. This mirrors WP-545 (Surge of Power) and WP-658's Hurl Legal Objections. The already-shipped marker→condition parser arm (D-24354 — the D-24055 Spectrum precedent) pushes a `recruitMadeThisTurnAtLeast:N` condition onto the **same hook** that carries the printed effect. `VALID_TOKEN_PATTERN` already allows `recruit-threshold:[1-9]\d*`, and the ledger already classifies `recruit-threshold` as a KNOWN_CONDITION (#1865). **No engine source change.**

## Scope (In)

- `scripts/convert-cards/inputs/hero-ability-markers.json` — 5 new `recruit-threshold` marker rows (2 under `co2e/thor`, 3 under `ssw1/lady-thor`).
- Regenerated card data: `data/cards/co2e.json`, `data/cards/ssw1.json` (via `apply-hero-ability-markers.mjs`).
- Regenerated hero derived-artifact chain: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`.
- Tests: `packages/game-engine/src/setup/heroAbility.setup.test.ts` — the four attack-granting cards gate on `recruitMadeThisTurnAtLeast:N`; a control asserting the un-marked line is UNGATED (non-vacuous); `mysterious-origin` gate-attached-but-effect-less (honest hollow).
- Governance close: `NUMBER-LEDGER.md`, `DECISIONS.md` (D-24472), `WORK_INDEX.md`, `EC_INDEX.md`, `STATUS.md`, `docs/05-ROADMAP-MINDMAP.md`.

## Out of Scope (flagged follow-up (2) — INVESTIGATED, NO BUG)

- The **amwp Ghost mastermind** ("You can't fight Ghost unless you made at least 6[icon:recruit] this turn") — investigated: the villain/mastermind parser (`setup/villainAbility.setup.ts`) reads only `[effect:<value>]` markers and never scans `[icon:]`/English for grants, so the condition clause emits no phantom recruit there. Nothing to port; the WP-660 fix is hero-parser-specific. **No change made.**
- **Modeling spark's KO-choice or mysterious-origin's draw** — separate mechanics; these stay honest hollows, now properly gated.

## Non-Negotiable Constraints

> - Card-data + tests only. A change to any `packages/game-engine/src/**` non-test file ⇒ STOP (the parser arm exists).
> - No new `G` field; no `ctx.random`; no hash re-pin expected (the sentinel plays none of these cards). A hash test failure ⇒ STOP and investigate.
> - The card-data marker is applied by the pipeline (`apply-hero-ability-markers.mjs`), never hand-edited into `data/cards`. `--validate` and `cards:check` confirm.
> - Locked marker values: co2e Thor = `recruit-threshold:8`; ssw1 Lady Thor = `recruit-threshold:6` (the printed thresholds).

## Acceptance Criteria

1. **AC-1** Each of `glory-of-asgard`, `spark-of-the-divine` (N=8), `chosen-by-asgard`, `living-thunderstorm` (N=6) builds a hook carrying its printed `{attack:M}` effect AND exactly one `recruitMadeThisTurnAtLeast:N` condition on the same hook.
2. **AC-2** `mysterious-origin` carries the `recruitMadeThisTurnAtLeast:6` condition and NO fabricated effect (the unmarked "draw a card" stays an honest hollow).
3. **AC-3** Control: the same co2e line WITHOUT the marker builds the `{attack:3}` hook with NO recruit-threshold condition (proves the marker is load-bearing).
4. **AC-4** `recruit-threshold` is never recorded as an unresolved marker on any of the five hooks (no parse-unrecognized hollow).
5. **AC-5** All-package build 0; engine suite green (+6 tests) with NO hash re-pin; whole-repo green; `cards` + `ledger:heroes` + `effect-index` + `mechanics:metadata` + `sim:runtime-observed` `:check` all green after the expected ledger/feed regen.
6. **AC-6** The amwp Ghost mastermind is investigated and documented as NO BUG (villain parser is marker-only); no villain-parser change ships.

## Definition of Done

- [x] 5 marker rows added; `apply-hero-ability-markers.mjs` applied (5 lines updated) and `--validate` clean.
- [x] `data/cards/{co2e,ssw1}.json` marked; only those two card files changed.
- [x] Hero derived chain regenerated; ledger `co2e/thor` + `ssw1/lady-thor` → `recruit-threshold`/`condition`; effect-index + card-mechanics in lockstep.
- [x] Tests (AC-1..AC-4) added and green (engine suite 3093/3093, +6).
- [x] `pnpm -r build` 0; whole-repo green (per-package verified); every `:check` green after regen; no hash re-pin; no `lagn-v1.json` churn committed (CRLF-only, reverted).
- [x] `git diff --name-only` = the finalized allowlist and nothing else.
- [x] `DECISIONS.md` D-24472 Active + `NUMBER-LEDGER` + `WORK_INDEX` (WP-661) + `EC_INDEX`/EC-698 + `STATUS` + mindmap (node + `roadmap:counts:write`).
- [ ] **D-24026 live-verified** (post-deploy Lady Thor / co2e Thor match — grant fires only after ≥N recruit). Operator-pending.

## Vision Alignment

**Vision clauses touched:** card fidelity (a card grants only what it prints, when it prints). **Conflict:** none — removes an unearned grant, adds no RNG, a card getting *weaker* toward its printed text cannot introduce pay-to-win (NG-1 untouched). **Determinism:** card-data + tests only; no new `G` field; no `ctx.random`; both hash oracles byte-unchanged (empirical — engine suite green with no re-pin).

## Funding Surface Gate

§20 N/A — card data + engine tests; no funding affordance or copy.

## API Catalog Update

§21 N/A per D-11804 — no HTTP endpoint or server-reachable library function.

## Lint Gate Self-Review (00.3)

Completed inline at draft against all 21 sections. §1–§9 PASS (single-purpose card-data follow-up; scope + out-of-scope explicit; the Ghost item resolved to NO BUG, not deferred hand-wave). §12–§17 PASS (control run mandated AC-3; card-conservation N/A — a grant gate, not a card move; DoD carries the allowlist check; Vision block carries the §17.2 conflict assertion; §15.1 declares `play.legendary-arena.com` with the D-24026 live gate). §10, §11, §18, §20, §21 resolve N/A with named justifications.
