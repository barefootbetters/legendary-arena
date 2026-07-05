# EC-342 — Empowered Multi-Class Form (Execution Checklist)

**Source:** docs/ai/work-packets/WP-310-empowered-multi-class.md
**Layer:** Game Engine / Setup (parser)

## Before Starting
- [ ] On `main`, clean, synced to `origin/main`; baseline `git rev-parse origin/main` recorded.
- [ ] WP-256/267/283/284 substrate present: `buildEmpoweredComposition(heroClass)` in
      `packages/game-engine/src/rules/heroCompositions.ts`; the empowered dispatch chain in
      `packages/game-engine/src/setup/heroAbility.setup.ts`
      (`tryResolveEmpoweredChooseOneLine` → `tryResolveDrawOrEmpoweredLine` → `tryResolveEmpoweredCore`
      → `tryResolveEmpoweredConditionalPrefix` → `tryResolveEmpoweredFreeChoice` →
      `tryResolveEmpoweredDynamic`), emitting `HeroAbilityHook.primitiveEffects: EffectNode[]`.
- [ ] `8th-wonder-of-the-world` in `data/cards/antm.json` carries `[keyword:Empowered] by [hc:ranged]
      and [hc:strength]` (confirm the exact marker form before writing the regex).
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 on `main`.
- [ ] **Scaffold first** (01.0a Step 3 / WP-290 precedent): prototype the anchored regex against the
      real marker, confirm per-class primitives emit, run the deterministic sweep + engine suite.
      Hash unchanged + no fixture breaks → lightweight lane permitted; else standard two-session.
- [ ] Target file set = the `## Files to Produce` below. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Grant resource = `attack`; count zone = `hq` (`EFFECT_COUNT_ZONE_KINDS = ['hq']`) — per
  `buildEmpoweredComposition`. Do NOT introduce a new resource or zone.
- Emit ONE `buildEmpoweredComposition(class)` per parsed class, in **printed order** (sum is
  commutative; order fixed for determinism).
- Reserved decision: **D-24098** (NOT D-24096/24097 — those are WP-311/WP-312).

## Guardrails
- Reuse `buildEmpoweredComposition` per class — do NOT invent a `'multi-empowered'` keyword, a new
  `ValueExpression`, or a new `EffectNode` type. No `HeroKeyword` addition.
- The new `tryResolveEmpoweredMultiClass` uses an **anchored** regex on the `by [hc:X] and [hc:Y]
  (and [hc:Z]…)` tail ONLY; it must NOT broaden `tryResolveEmpoweredCore` (single-class) or the
  choose-one path. Position it AFTER core and BEFORE the free-choice/dynamic fallbacks; suppress the
  per-token empowered dispatch for a matched line (the `processedAs*` flag pattern).
- **Honest-partial:** the `8th-wonder-of-the-world` HQ-choose prefix ("Choose any number of cards
  from the HQ. Put them on the bottom of the Hero Deck.") stays an unresolved / reported marker —
  do NOT attempt it here (named follow-up).
- `data/cards/*.json` byte-unchanged. No `boardgame.io` import in the parser or its test. No
  `.reduce()` in the emit loop (`for...of`). Parser warns on an unresolved tail; never throws.
- **STOP** if the corpus has a 3+-class / Oxford-comma "and"-list the regex would miss — confirm the
  grammar before broadening.

## Required `// why:` Comments
- On the dispatch ordering (after `tryResolveEmpoweredCore`, before free-choice/dynamic) and on the
  reuse-`buildEmpoweredComposition`-per-class decision.
- `DECISIONS.md` D-24098: multi-class empowered = per-class composition sum; HQ-choose prefix
  deferred; no new keyword/value-expression/node type.

## Files to Produce
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `tryResolveEmpoweredMultiClass`
  pre-pass.
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — two-class parse,
  single-class regression, honest-partial (HQ-choose prefix stays reported), `JSON.stringify(G)`.
- `packages/game-engine/src/rules/heroCompositions.ts` — **modified ONLY IF** a multi-class helper
  reads clearly cleaner than an inline per-class emit loop (duplicate-first: prefer the loop).
- Regenerated coverage artifacts under `docs/ai/coverage/**` (+ any `scripts/coverage/**` output) —
  **modified** — the empowered rows that flip out of hollow.
- Governance: `docs/ai/DECISIONS.md` (D-24098), `docs/ai/STATUS.md`,
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (multi-class + single-class-
      regression + honest-partial cases green).
- [ ] `Select-String effectPrimitive.types.ts "multi"` → no output (no new union member); canonical
      drift arrays unchanged.
- [ ] Sentinel `finalStateHash` unchanged — or a re-pin is documented (if a multi-class card entered
      the core sweep fixture).
- [ ] ALL `:check`-gated coverage feeds regenerated + green: `pnpm ledger:heroes:check`,
      `pnpm sim:coverage --check`, `pnpm sim:runtime-observed:check`, and `mechanics:metadata` if the
      mechanic vocabulary feed moved (run each `--check` first to see which actually change).
- [ ] Live-on-surface (D-24026): play `8th-wonder-of-the-world`, observe the Empowered Attack bonus
      apply (or a diagnostics check showing the card's `empowered` hollow cleared); evidence + SHA.
- [ ] `STATUS.md`, `WORK_INDEX.md` (WP-310 checked off), `EC_INDEX.md` (EC-342 Done) updated.

## Common Failure Smells
- The new regex swallows a single-class `by [hc:X]` line → the single-class regression test fails;
  keep the multi-class match strictly requiring the `and`-joined second class.
- The HQ-choose prefix silently "resolves" → honest-partial breach; it must stay a reported hollow.
- A `:check` feed left stale → repo-wide CI red on a later PR (`mechanics:metadata` is the one ECs
  keep forgetting — see WP-290/WP-292).
- Any diff under `apps/**` or `data/cards/**` → scope breach (engine/setup + generated coverage only).
- A new `HeroKeyword`/`ValueExpression`/`EffectNode` union member → wrong approach; reuse the
  substrate.
