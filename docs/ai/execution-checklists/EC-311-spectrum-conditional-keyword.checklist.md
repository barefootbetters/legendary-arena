# EC-311 — Spectrum: ≥3-Hero-Class Conditional Keyword + Simple-Effect Markup

**Source:** docs/ai/work-packets/WP-280-spectrum-conditional-keyword.md
**Layer:** Game Engine (new `distinctHeroClassesAtLeast` condition + parser
recognition of `[keyword:Spectrum]`) **+ card data** (`data/cards/ssw2.json`
direct markup — ssw2 is a non-reproducible pipeline set). Plus the regenerated
CI-gated coverage artifacts.
**Decision:** D-24055 (Spectrum = a conditional gate, not a keyword; semantics +
threshold) + D-24056 (honest-partial scope), reserved at draft; landed at execution.

Authoritative execution contract for WP-280. Compliance is binary. **All
behavioral contracts are owned by WP-280; on any EC⇄WP conflict, WP-280 wins
(per `.claude/CLAUDE.md`).**

---

## Before Starting
- [ ] On `main`, clean, ff-synced to `3409b779` (#447) or later — NOT the earlier
  `1ce1ff2e`. **#447 reshaped `heroEffects.execute.ts` `readTurnNumber` (now reads the
  nested `moveContext.ctx.turn`) and added a regression test to
  `heroEffects.execute.test.ts`, a file in this allowlist** — regenerate that test file's
  full contents ONTO #447's addition; reverting it is a FAIL. Baseline-green:
  `pnpm -r build`; `pnpm --filter @legendary-arena/game-engine test` (record the
  pass count); `pnpm ledger:heroes:check`; `pnpm sim:coverage --check`;
  `pnpm sim:runtime-observed:check`; `pnpm mechanics:metadata:check` all exit 0.
- [ ] Read `hero/heroConditions.evaluate.ts` (the `heroClassMatch` self-EXCLUSION
  pattern Spectrum deliberately INVERTS), `setup/heroAbility.setup.ts` (the
  `[keyword:X]` loop branches + the `if (conditions.length > 0) push 'conditional'`
  step + `RECOGNIZED_NON_KEYWORD_MARKERS`), `hero/heroEffects.execute.ts`
  (`evaluateAllConditions` gate + `detectHollowHeroHook` per-hook/mixed-hook rules),
  `rules/revealRule.ts` (`reveal` = `cost-lte`, `reveal-min` = `cost-gte`), and
  `data/cards/ssw2.json` (the 4 target hero cards).
- [ ] **MANDATORY SCAFFOLD (this is a parse-affecting / validation-touching WP —
  `01.4 §Empirical Scaffold`).** Prototype and **observe** before locking:
  (1) `[keyword:Spectrum]` (and `[keyword:spectrum]`) parses to ONE
  `distinctHeroClassesAtLeast` condition with NO `spectrum` `unresolvedMarker` and
  NO `spectrum` in `hook.keywords`;
  (2) **token pin:** confirm `[keyword:reveal:2]` builds `cost-lte 2` (draw if cost
  ≤ 2) — the long-range-spider-sense intent — and that `reveal-min` would be WRONG
  (`cost-gte`). If the token differs, fold the correction in-scope (`01.1`);
  (3) **gate semantics:** the condition is true at ≥3 distinct in-play hero classes
  **including** the played card, false at <3, and S.H.I.E.L.D./Sidekick (which carry
  `heroClass: null`, skipped by the `typeof === 'string'` guard) never count;
  (4) **honest fix:** a marked-up Spectrum draw line, played with ≥3 classes,
  draws 1; played with <3, mutates nothing AND fires NO hollow (condition-failed,
  not hollow) — NOT a bare recognition that only silences;
  (5) the **5 hero** icon Spectrum lines now gate (the `+attack`/`+recruit` no-ops
  at <3 classes); the 6th icon `[keyword:Spectrum]` line is the **villain** card
  `'92 Jubilee` — out of scope, untouched;
  (6) `borrowed-cloaking-device` STILL flags `parse-unrecognized` **when played
  with ≥3 classes** (the gate passes → `detectHollowHeroHook` runs; at <3 the
  upstream conditions `continue` skips detection — see RS-1);
  (7) **measure the artifact deltas + confirm the sentinel:** the `spectrum`
  ledger change (RS-2 — as a condition it likely DROPS from the ledger, invisible
  to the keyword/effect/marker mechanic extraction), the `runtime-observed-hollows.json`
  delta (sweep-measured), and the `hero-effect-coverage.baseline.json` **ssw2 row**
  (the 3 markup lines `noEffect → executable`). **The sweep sentinel
  `finalStateHash` is UNCHANGED** — the sentinel board
  (`sentinel-core-doom-2p.replay.json`) is core-only and plays no ssw2 card, so
  gating ssw2 Spectrum cannot move it. An unchanged hash is CORRECT here.

---

## Locked Values
- **WP:** WP-280. **EC:** EC-311. **Decisions:** D-24055, D-24056 (reserved).
- **Condition (locked):** `{ type: 'distinctHeroClassesAtLeast', value: '3' }`. A
  new `case 'distinctHeroClassesAtLeast'` in `evaluateCondition` — count distinct
  `G.cardTraits[id].heroClass` across `playerZones[pid].inPlay`, adding each to a
  `Set<string>` **only when `typeof heroClass === 'string' && heroClass.length > 0`**
  (`CardTraitEntry.heroClass` is `string | null` per `state/cardTraits.types.ts:20`; the
  `null` S.H.I.E.L.D./Sidekick carry MUST NOT count — a bare `!== ''` would let `null`
  in as a phantom class), **self-INCLUSIVE** (do NOT exclude `triggeringCardId`), return
  `set.size >= parseInt(condition.value, 10)`; `Number.isNaN(threshold)` → false (safe
  skip, the `playedThisTurn` precedent). No `.reduce()`; `for…of` + the `Set<string>`.
- **Threshold (locked):** `SPECTRUM_CLASS_THRESHOLD = 3` (rulebook; D-24055). The
  parser builds `value: String(SPECTRUM_CLASS_THRESHOLD)`.
- **Parser branch (locked):** in the `[keyword:X]` loop, recognize
  `normalizedKeyword === 'spectrum'` → push the condition into the line's
  conditions (alongside `heroClassMatch`/`requiresTeam`), BEFORE the
  unresolved-marker `else`. NOT a `HeroKeyword`, NOT `keywords.push`, NOT
  `unresolvedMarkers.push`. `isValidHeroKeyword('spectrum')` stays false;
  `HERO_KEYWORDS` is byte-unchanged.
- **Card-data markup (locked, direct edit to `data/cards/ssw2.json`):**
  - `quiver-of-thunderbolts`, `cascading-maneuver`: `"[keyword:Spectrum]: Draw a
    card."` → `"[keyword:Spectrum]: Draw a card. [keyword:draw:1]"`.
  - `long-range-spider-sense`: append `[keyword:reveal:2]` (cost-lte; scaffold-pinned).
  - `borrowed-cloaking-device`: append `[keyword:reveal-multi-take:2]` (an
    unrecognized placeholder → stays `parse-unrecognized`; the honest-partial).
- **Commit message (execution):**
  `EC-311: spectrum ≥3-class conditional keyword + simple-effect markup (D-24055, D-24056)`.

---

## Hardened Invariants (binary — each MUST be test-asserted)
- **Self-inclusion (locked, INVERTS heroClassMatch) — boundary-tested.** The class
  count INCLUDES the triggering card. **Required boundary test pair:** with exactly 2
  distinct classes among the OTHER in-play cards, a Spectrum card whose own class is a
  distinct 3rd → gate TRUE; the sibling fixture where that card instead SHARES one of the
  2 → gate FALSE (only 2 distinct). This pins both self-inclusion and that
  `null`/Sidekick cards don't inflate the count. Self-inclusion is structurally possible
  only because `playCard` puts the card in `inPlay` (`moves/coreMoves.impl.ts:144`) before
  `executeHeroEffects` (`:155`). (heroClassMatch/requiresTeam exclude self; Spectrum does
  NOT — "you have ≥3 classes" counts everything you control.)
- **Condition-failed ≠ hollow (locked).** A Spectrum line played with <3 classes
  records NO hollow: the failed `evaluateAllConditions` `continue`s
  (`hero/heroEffects.execute.ts:255-261`) BEFORE `detectHollowHeroHook` (`:289`), so
  detection is never reached. Assert `G.diagnostics?.hollowEffects` is **unchanged** (no
  record added) for that play — not merely that the effect was a no-op.
- **Honest fix (binary FAIL condition).** If `spectrum` is recognized AND a
  marked-up Spectrum line cannot demonstrably execute its effect at ≥3 classes →
  FAIL, even if the onPlay hollow disappears. Silencing the hollow without the
  effect firing is the dishonest-fix failure mode.
- **Honest-partial preserved (locked).** `borrowed-cloaking-device` MUST still
  record a `parse-unrecognized` hollow **when played with ≥3 distinct classes**
  (the gate passes, so `detectHollowHeroHook` runs; at <3 the conditions gate
  `continue`s and detection is skipped — RS-1, so the test fixture sets ≥3
  classes). Recognizing Spectrum must NOT silence a card that still does nothing.
- **No keyword added (locked).** `spectrum ∉ HERO_KEYWORDS`,
  `spectrum ∉ HANDLED_KEYWORDS`, `spectrum ∉ HERO_EFFECT_HANDLERS`. The
  handler-key bidirectional drift test count is UNCHANGED. `heroKeywords.ts` is
  byte-unchanged.
- **Parser precedence (locked).** The `spectrum` branch is a new `else if` placed
  BEFORE the final unresolved-marker arm `else if (!RECOGNIZED_NON_KEYWORD_MARKERS.has(…))`
  in `parseAbilityText`'s `[keyword:X]` loop (`setup/heroAbility.setup.ts`, ~line 418).
  Any reorder that lets `spectrum` reach the unresolved-marker arm reintroduces the
  `parse-unrecognized` hollow — a FAIL. (It need NOT precede the `isValidHeroKeyword`
  arm: `isValidHeroKeyword('spectrum')` is already false, so the keyword arm never catches
  it — the only ordering that load-bears is before the unresolved fallback.)
- **Determinism: sentinel UNCHANGED (locked).** The sweep sentinel
  `finalStateHash` does NOT change — the sentinel board
  (`sentinel-core-doom-2p.replay.json`) is **core-only** (`core/dr-doom`) and
  plays no ssw2 card, so gating ssw2 Spectrum cannot reach it. An unchanged hash
  is CORRECT and required. The artifacts that DO move:
  `hero-effect-coverage.baseline.json`'s ssw2 row (a deterministic static-parse
  delta — the 3 markup lines `noEffect → executable`) + possibly
  `runtime-observed-hollows.json` (sweep-measured). A `finalStateHash` that
  *changed* here is a hard FAIL: STOP, identify the unintended core-path effect, and do
  NOT commit until the hash is restored to its baseline value.

---

## Guardrails
- **Recognize the existing marker; the `[keyword:Spectrum]` lines already exist.**
  The only `data/cards/ssw2.json` edits are the 4 listed effect-markup appends —
  no other card line changes; the `[keyword:Spectrum]` tokens themselves are
  untouched. (ssw2 is non-reproducible — edit the JSON directly; do NOT run the
  card pipeline, which would regress the set.)
- **Spectrum is a CONDITION, not a keyword.** Do NOT add it to `HERO_KEYWORDS`,
  `MVP_KEYWORDS`, `HERO_EFFECT_HANDLERS`, or `HANDLED_KEYWORDS`. It rides the
  existing condition path (`evaluateAllConditions` AND-gate), exactly like
  `heroClassMatch`.
- **Self-inclusive — do not copy heroClassMatch's self-exclusion.** The
  `triggeringCardId` skip in `heroClassMatch`/`requiresTeam` MUST NOT be carried
  into the Spectrum case (D-24055).
- **Villain Spectrum is out of scope.** Do NOT touch the villain parser/executor
  or `doctor-spectrum`/`pink-sphinx`. Their `[keyword:Spectrum]` usage is a
  different mechanic.
- **Honest-partial on `borrowed-cloaking-device`.** Use the explicit
  `[keyword:reveal-multi-take:2]` placeholder so it stays reported. Do NOT
  implement the multi-card sum-cost-select reveal here (named follow-up).
- **Regenerate every committed coverage artifact in the SAME commit** (ledger,
  runtime-observed, sim baseline, card-mechanics feed) and add the additive
  `spectrum` provenance entry. A red freshness gate = an artifact not regenerated.
- **The 5 hero icon Spectrum cards become gated — that IS the deliverable**, not a
  regression. Assert it; do not "fix" it back to ungated.

## Required `// why:` Comments
- At `SPECTRUM_CLASS_THRESHOLD = 3`: the rulebook value (≥3 Hero classes), D-24055.
- At the `distinctHeroClassesAtLeast` case: self-INCLUSIVE count (you *have* the
  classes; inverts heroClassMatch's self-exclusion); S.H.I.E.L.D./Sidekick carry
  `heroClass: null`, skipped by the `typeof === 'string'` guard, so never count (D-24055).
- At the parser Spectrum branch: `[keyword:Spectrum]` is the rulebook gate, modeled
  as a condition (not a keyword), so the line's printed effects gate on ≥3 classes
  (D-24055); placed before the unresolved-marker fallback so it never flags.
- At the `borrowed-cloaking-device` placeholder marker (in the WP/commit notes):
  deliberate honest-partial — keeps the multi-take reveal a reported hollow
  pending its own primitive (D-24056).

## Files to Produce
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** (new case).
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified** (gate true/false; the self-inclusion **boundary pair** [2-other-distinct + 3rd-via-self → true; shares-a-class → false]; `null`/S.H.I.E.L.D./Sidekick excluded; NaN safe-skip).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** (Spectrum branch + threshold const).
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** (Spectrum → condition, no unresolvedMarker, case-insensitive).
- `data/cards/ssw2.json` — **modified** (4 markup appends; direct edit).
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** (play-time: gated fire at ≥3 / condition-failed-not-hollow at <3; marked lines clear; placeholder still flags; icon line gates).
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` — **regenerated**.
- `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**.
- `scripts/coverage/hero-effect-coverage.baseline.json` — **regenerated** (the ssw2 coverage-tally row; this file carries NO hash — not a sentinel re-pin).
- `data/metadata/card-mechanics.json` — **regenerated**.
- `scripts/coverage/mechanic-provenance.json` — **modified** (additive `spectrum`).
- `scripts/hero-mechanic-ledger.mjs` — **modified ONLY IF** RS-2 shows the ledger mis-classifies a condition-gate mechanic.
- Governance: `STATUS.md`, `DECISIONS.md` (D-24055, D-24056), `WORK_INDEX.md` (WP-280 ✅), `EC_INDEX.md` (EC-311 Done), `05-ROADMAP-MINDMAP.md`.

**Explicit non-change:** `apps/**`, `packages/registry/**`, `apps/server/**`,
`packages/game-engine/src/simulation/ai.legalMoves.ts`,
`packages/game-engine/src/rules/heroKeywords.ts` MUST be byte-unchanged.

## After Completing
- [ ] `pnpm -r build` + game-engine `test` exit 0; record the count delta.
- [ ] Parse test green: `[keyword:Spectrum]`/`[keyword:spectrum]` → one
  `distinctHeroClassesAtLeast` condition, no `spectrum` unresolvedMarker/keyword.
- [ ] Gate test green: ≥3 distinct classes (self-inclusive) → true; <3 → false; the
  self-inclusion boundary pair (3rd-via-self → true; shares-a-class → false);
  S.H.I.E.L.D./Sidekick (`heroClass: null`) never count; NaN value → false.
- [ ] Honest fix proven: a marked-up Spectrum draw fires at ≥3, is a
  condition-failed no-op (NOT hollow) at <3.
- [ ] Honest-partial proven: `borrowed-cloaking-device` STILL records a
  `parse-unrecognized` hollow; the 3 marked lines do NOT.
- [ ] Negative classification: `spectrum ∉ HERO_KEYWORDS / HANDLED_KEYWORDS /
  HERO_EFFECT_HANDLERS`; handler-key drift test count unchanged; `heroKeywords.ts`
  byte-unchanged.
- [ ] Four freshness gates green after regeneration; provenance diff additive.
- [ ] Sentinel `finalStateHash` **unchanged** (sentinel board core-only); the
  `hero-effect-coverage.baseline.json` ssw2 row + `runtime-observed-hollows.json`
  deltas recorded.
- [ ] `git diff --name-only` ⊆ allowlist; `apps/**` / `packages/registry/**` /
  `apps/server/**` / `ai.legalMoves.ts` / `heroKeywords.ts` byte-unchanged.
- [ ] `node scripts/roadmap-counts.mjs --check` passes (WP-280 ✅).
- [ ] STATUS notes the D-24026 live-verify (the `/coverage` `spectrum` flip + a
  Silk-match diagnostics check) as pending post-deploy.

## Close Notes Required in PR / Commit Body
- The measured `spectrum` ledger status change + runtime-observed delta.
- The scaffold result: the honest-fix proof (effect fires at ≥3, no-op at <3),
  the self-inclusion confirmation, and the `borrowed-cloaking-device`
  still-hollow confirmation.
- The behavior change: the 5 hero icon Spectrum lines are now gated (named).
- The sentinel: `finalStateHash` UNCHANGED (sentinel board core-only, no ssw2);
  the moving artifacts are the `hero-effect-coverage.baseline.json` ssw2 row + the
  `runtime-observed-hollows.json` delta (each named + measured).
- Confirmation `apps/**` / `packages/registry/**` / `apps/server/**` /
  `ai.legalMoves.ts` / `heroKeywords.ts` are byte-unchanged.

## Common Failure Smells
- `spectrum` appears in `HERO_KEYWORDS` / `MVP_KEYWORDS` → it's a condition, not a
  keyword; revert and route through the condition path.
- A Spectrum line played with <3 classes records a hollow → the condition isn't
  wired (or classified wrong); it must be a `condition-failed` reachable no-op.
- `borrowed-cloaking-device` stops flagging → the placeholder marker is wrong or
  Spectrum recognition silenced it; restore the honest-partial.
- The long-range line draws on a HIGH-cost reveal → `reveal-min` (`cost-gte`) was
  used instead of `reveal` (`cost-lte`); fix the token.
- The icon Spectrum lines still fire ungated → the parser branch didn't attach the
  condition (or the markup line lacks the Spectrum token); the gate must apply.
- The sentinel `finalStateHash` CHANGED → investigate: the sentinel board is
  core-only (no ssw2), so an ssw2-only WP must NOT move it; a change means an
  unintended core-path effect (here, *unchanged* is the goal, not the smell).
- A `data/cards/ssw2.json` line beyond the 4 markup appends changed → the pipeline
  was run (regressing the non-reproducible set) or an over-edit; revert to the
  4 surgical appends.
- A freshness gate red → a coverage artifact wasn't regenerated in the same commit.
