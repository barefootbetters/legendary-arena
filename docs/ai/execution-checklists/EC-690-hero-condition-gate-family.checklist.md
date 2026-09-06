# EC-690 — Hero Condition-Gate Family (Outwit / Worthy / Savior / Antics) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-653-hero-condition-gate-family.md
**Layer:** Game Engine (`packages/game-engine`) + card-data + coverage tooling
(`scripts/hero-mechanic-ledger.mjs`) + Dashboard gauge (`apps/dashboard`)

## Before Starting
- [ ] **WP-280 shipped (D-24055):** `hero/heroConditions.evaluate.ts` is a
      `switch (condition.type)` over the open `HeroCondition = {type,value}`
      union with a live `distinctHeroClassesAtLeast` case, and
      `setup/heroAbility.setup.ts` has the `spectrum` marker→condition arm before
      the `RECOGNIZED_NON_KEYWORD_MARKERS` fallback. If false, STOP.
- [ ] Exact scope lock (any edit outside = FAIL; surface first):
      `hero/heroConditions.evaluate.ts` (+`.test.ts`),
      `setup/heroAbility.setup.ts` (+`.test.ts`),
      `data/cards/{wwhk,asrd,ca75,amwp}.json` + the source patches
      `scripts/convert-cards/inputs/patches/{wwhk,asrd,ca75}.patch.json` (dotted;
      amwp is a hand-authored outlier edited directly, NOT
      `bbcode/modern-master-strike` — a frozen mirror per CLAUDE.md),
      `scripts/hero-mechanic-ledger.mjs` (`KNOWN_CONDITIONS`),
      `apps/dashboard/src/composables/useInPlayCoverage.ts` + `.test.ts`, the
      regenerated `hero-mechanic-ledger.{json,csv}` / `card-mechanics.json` /
      `runtime-observed-hollows.json`, plus governance (STATUS / DECISIONS /
      WORK_INDEX / EC_INDEX / ROADMAP-MINDMAP).
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0,
      `pnpm --filter @legendary-arena/game-engine test` exits 0,
      `pnpm --filter @legendary-arena/dashboard typecheck` exits 0 (record baseline
      — the WP touches `apps/dashboard`; `vue-tsc` is the load-bearing SFC gate).

## Locked Values (do not re-derive)
- `distinctHeroCostsAtLeast` — Outwit — value `'3'` (≥3 distinct non-zero costs
  among `inPlay` Heroes, self-inclusive; read cost as `G.cardStats[id]?.cost ?? 0`
  — safe access, no stats row for tokens; only true Heroes contribute).
- `heroCostAtLeastInHandOrPlay` — Worthy — value `'5'` (a Hero costing ≥5 in
  hand OR inPlay; `G.cardStats[id]?.cost ?? 0`).
- `bystandersInVictoryAtLeast` — Savior — value `'3'` (Victory-Pile bystanders;
  RE-IMPLEMENT the two-arm predicate INLINE — `extId === BYSTANDER_EXT_ID ||
  extId.startsWith('bystander-villain-deck-')`, the `heroCountSource.resolve.ts`
  shape; that classifier is non-exported, so do NOT import/export it).
- `cheapOrSizeChangingAtLeast` — Antics — value `'3'` (hand+inPlay cards costing
  1 or 2 and/or Size-Changing; count each qualifying card ONCE).
- `BYSTANDER_EXT_ID` from `../setup/pilesInit.js`.

## Guardrails
- Model each as a `HeroCondition`, NOT a `HeroKeyword`: do NOT touch
  `HERO_KEYWORDS` / `MVP_KEYWORDS` / `HANDLED_KEYWORDS` or their parity tests. The
  ledger classifies via its OWN `KNOWN_CONDITIONS` map — add the four there so the
  rows flip `unsupported → condition` (a plain regen alone leaves them
  `unsupported`; they do NOT drop). Then teach `computeInPlayCoverage` to credit a
  `condition`-status mechanic as resolved (alongside `executable`) so the baseline
  obs are not a permanent unresolved drag; the frozen baseline seed is unchanged.
- Card-source durability target is the per-set patch JSON, NOT
  `bbcode/modern-master-strike` (a frozen output mirror per CLAUDE.md §Card Data;
  nothing reads it, never edit it). amwp is a hand-authored outlier —
  confirm its path against `docs/03-DATA-PIPELINE.md`.
- **Honest-Partial (load-bearing):** mark ONLY the simple gated effects (draw /
  fixed ±attack / fixed ±recruit). A line gating scry / look-N / Transform /
  Smash / Man-Out-of-Time / each-player / `for each …` scaling / KO-from-hand
  keeps its inner marker as an honest hollow — do NOT stretch a primitive in.
  Recognizing a condition without a real effect (silent no-op) is a FAIL.
- No evaluator signature change — every condition reads `G` alone.
- No `.reduce()` with branching (explicit `for...of`); no boardgame.io import in
  `heroConditions.evaluate.ts`; conditions never mutate `G`.
- `finalStateHash` / `PRE_WP080_HASH` expected byte-UNCHANGED (non-core sets). A
  re-pin is the smell — STOP and investigate, never re-baseline to green.
- No new keyword / primitive / zone / timing / pending choice.
- Card markers are faithful printed text — only ADD the effect markers the simple
  lines need; never rewrite a marker to change display; add the same markers to
  the per-set source patch so a re-convert does not revert. Do NOT regenerate
  `data/cards` (WP-565 pipeline is lossy) — edit the consumed JSON directly.

## Required `// why:` Comments
- Each new `evaluateCondition` case: the D-24055 condition-not-keyword posture +
  the exact predicate (self-inclusive count / hand+inPlay scan / victory-pile
  bystander read).
- The Antics Size-Changing predicate: why the chosen helper identifies
  Size-Changing (and not Copy-Powers).
- The four parser arms: cite the Spectrum/recruit-threshold precedent and that
  they precede the unresolved-marker fallback so no hollow records.

## Files to Produce
- `hero/heroConditions.evaluate.ts` — **modified** — 4 condition cases + 4
  `describeFailedCondition` arms.
- `setup/heroAbility.setup.ts` — **modified** — 4 marker→condition arms.
- `hero/heroConditions.evaluate.test.ts`, `setup/heroAbility.setup.test.ts` —
  **modified** — boundary/malformed/parse cases + parity non-change + gate
  integration.
- `data/cards/{wwhk,asrd,ca75,amwp}.json` (consumed, direct) + the source patches
  `scripts/convert-cards/inputs/patches/{wwhk,asrd,ca75}.patch.json` (durability;
  amwp outlier has no ability-text patch — confirm at execution) — **modified** —
  mark simple gated effects.
- `scripts/hero-mechanic-ledger.mjs` — **modified** — extend `KNOWN_CONDITIONS`
  with the four keyword→condition mappings.
- `apps/dashboard/src/composables/useInPlayCoverage.ts` (+ `.test.ts`) —
  **modified** — credit `condition` status as resolved; re-pin the ONE forced
  value (no-arg real-seed case) + ADD a condition-credit assertion; do NOT edit
  the injected-baseline case.
- `hero-mechanic-ledger.{json,csv}`, `data/metadata/card-mechanics.json`,
  `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**.
- Governance: STATUS / DECISIONS (D-24464 Active) / WORK_INDEX / EC_INDEX /
  ROADMAP-MINDMAP.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] `pnpm -r build && pnpm ledger:heroes && pnpm mechanics:metadata &&
      pnpm sim:runtime-observed`, then `ledger:heroes:check`,
      `mechanics:metadata:check`, `sim:runtime-observed:check`,
      `sim:coverage --check` all exit 0 (each: exits 0 AND performs no
      regeneration — the committed artifact stays byte-current).
- [ ] `Select-String docs/ai/coverage/runtime-observed-hollows.json` for
      `"outwit"|"worthy"|"savior"|"antics"` → no output (outer hollows cleared);
      the four ledger rows read `status: condition` (was `unsupported`).
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` + `test:coverage`
      exit 0 (the gauge credits condition-status; the ONE forced
      `useInPlayCoverage.test.ts` value re-pinned + a condition-credit assertion
      added, injected-baseline case untouched; frozen baseline seed unchanged).
- [ ] `finalStateHash` byte-unchanged (no fixture re-pin).
- [ ] `git diff --name-only` = exactly the scope lock.
- [ ] **Live-on-surface (D-24026):** after deploy, a condition-gated ability
      visibly resolves on play.legendary-arena.com; evidence vs a deploy-confirmed
      SHA. Green tests do NOT satisfy this.
- [ ] `docs/ai/STATUS.md` updated (what a player now sees + the Honest-Partial
      note). `docs/ai/DECISIONS.md` — **D-24464 Active**.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap `📝`→`✅` +
      `roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Common Failure Smells
- A parity drift test goes red → a keyword was wrongly added to
  `HERO_KEYWORDS`/`MVP_KEYWORDS` (model it as a condition, not a keyword).
- The runtime sweep still shows `outwit`/etc. → the parser arm is after the
  unresolved fallback, or the marker normalization differs from the literal.
- A marked line does nothing at a passing condition → the effect marker is wrong
  (bare English never fires); a silent no-op is a FAIL, not a pass.
- `finalStateHash` re-pin demanded → a core-set card was touched, or a fixture
  plays one of these Heroes — investigate before re-baselining.
