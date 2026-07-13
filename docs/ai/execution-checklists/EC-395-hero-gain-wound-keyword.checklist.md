# EC-395 — `gain-wound-self` / `gain-wound-each` Hero Keywords (WP-364)

**Pairs with:** `docs/ai/work-packets/WP-364-hero-gain-wound-keyword.md`
**Reserves/lands:** D-24156 (flips reserved → Active at close)
**Baseline:** `origin/main @ 4756b3b4` (re-checked at commit)
**Lane:** Standard two-session lane (two new closed-`HeroKeyword` members + an executor mutating the shared Wound supply)

> **EC renumber:** WP-364 drafted citing **EC-391**, but WP-361 executed first (PR #701) and landed EC-391; WP-365 landed EC-392. WP-364 therefore renumbers to **EC-395** (next-free) at execution — the WP body / WORK_INDEX row / mindmap node / D-24156 references update to EC-395 in the SPEC close.
>
> The WP is the authoritative design doc. If EC and WP conflict, the WP wins; if either conflicts with ARCHITECTURE.md / `.claude/rules/*`, those win.

---

## Before Starting

- [ ] Hard-deps on `main`: WP-021/022 (hook pipeline + `HERO_EFFECT_HANDLERS`), WP-017 (`gainWound` + `G.piles.wounds`), WP-316 (the villain `gainWound` per-target loop mirrored here).
- [ ] Confirm `gainWound(woundsPile, playerDiscard): { woundsPile, playerDiscard }` in `board/wounds.logic.ts` (empty pile → no-op copy).
- [ ] Capture the absolute engine test/suite baseline (WP asserts a delta).
- [ ] `git fetch` re-check before commit (other engine sessions are live).

## Locked Values

- **Keyword slugs (union + array + token):** `gain-wound-self`, `gain-wound-each`.
- **Marker tokens (single-segment, no magnitude):** `[keyword:gain-wound-self]`, `[keyword:gain-wound-each]`.
- **Descriptor:** `{ type: 'gain-wound-self' }` / `{ type: 'gain-wound-each' }` — no magnitude/rewardType/new field (the generic parser builder emits `{ type }`; no parser edit).
- **Executor:** `self` → active player only; `each` → sorted `Object.keys(G.playerZones)`. Per target: skip missing zone; empty `G.piles.wounds` → logged no-op; else `gainWound(...)` + assign `woundsPile`/`discard`; active-player `G.turnEconomy.woundsDrawn += 1`. One summary log line.
- **The seven data rows** (set / heroSlug / cardSlug / abilityIndex → token):
  - `core`/`hulk`/`crazed-rampage`/**0** · `3dtc`/`hulk`/`crazed-rampage`/**0** · `msp1`/`hulk`/`crazed-rampage`/**0** → `gain-wound-each`
  - `cvwr`/`hulkling`/`half-kree`/**1** · `cvwr`/`luke-cage`/`reckless`/**0** · `dkcy`/`colossus`/`draw-their-fire`/**0** · `ff04`/`human-torch`/`hothead`/**0** → `gain-wound-self`
- **Keyword count:** `HERO_KEYWORDS` 27 → **29**; `HERO_EFFECT_HANDLERS` 14 → **16** (one shared handler under both keys).

## Guardrails

1. **`packages/game-engine/src/setup/heroAbility.setup.ts` (production parser) is NOT modified** — the generic `[keyword:X]` builder already emits `{ type }` for a plain keyword; the only requirement is registering the keywords in `HERO_KEYWORDS` and in `NO_MAGNITUDE_KEYWORDS` (so the magnitude pre-gate does not drop them).
2. **`hollowEffect.types.ts` is NOT modified** — the generic `wound` keyword stays in `DEFERRED_BY_DESIGN_MECHANICS`; the un-defer is two NEW narrow keywords, never a loosening. All 40 targeting/conditional hero wound forms stay hollow (Honest-Partial).
3. **`heroAbility.types.ts` is NOT modified** — each keyword encodes its own target; no descriptor field.
4. **Determinism:** wound draw is top-of-pile (`gainWound` uses `woundsPile[0]`), no RNG; `each` iterates a sorted key order; card markers fire only in real games (EMPTY_REGISTRY replay has no hero hooks) → sentinel `finalStateHash` unchanged. Executor never throws.
5. **No new move** → `game.test.ts` unchanged (gain-wound is an onPlay effect handler, not a boardgame.io move).
6. **No `.reduce()`**; `G` JSON-serializable; empty-supply no-op logged (D-24017), never silent.

## Required `// why:` Comments

- The two union/array entries — `// why: D-24156`.
- `NO_MAGNITUDE_KEYWORDS` + `HANDLED_KEYWORDS` additions — `// why: D-24156`.
- The `each` sorted-key order (determinism) and the `woundsDrawn` bump (mirrors the villain path) inside `heroEffectGainWound`.
- The empty-supply log (D-24017) and the summary log.
- `VALID_TOKEN_PATTERN` gain-wound branch — `// why: D-24156`.

## Files to Produce

- `packages/game-engine/src/rules/heroKeywords.ts` — union + array (two entries).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `heroEffectGainWound` + registration + `NO_MAGNITUDE_KEYWORDS`/`HANDLED_KEYWORDS` membership + `gainWound` import.
- `packages/game-engine/src/rules/heroKeywords.test.ts` — count 27→29 + registration test.
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — drift array + count 27→29.
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — parser emits `{ type }` for both.
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — executor tests (self/each/empty/log/serialize/deferred-boundary) + `woundsDrawn: 0` mock completeness + handler-count 14→16.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — 7 rows.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — `VALID_TOKEN_PATTERN` branch.
- `data/cards/{3dtc,core,msp1,cvwr,dkcy,ff04}.json` — regenerated (7 lines marked).
- `docs/ai/coverage/hero-mechanic-ledger.{csv,json}` — regenerated (`pnpm ledger:heroes`).
- Governance at close: `STATUS.md`, `DECISIONS.md` (D-24156 → Active + EC renumber), `WORK_INDEX.md` (WP-364 ✅, EC-391→EC-395), `EC_INDEX.md` (EC-395 row), `05-ROADMAP-MINDMAP.md` (node 📝→✅ + EC-391→EC-395 + `roadmap:counts --write`), WP-364 body (EC-391→EC-395).

**NOT modified:** `setup/heroAbility.setup.ts`, `hollowEffect.types.ts`, `heroAbility.types.ts`, `game.test.ts`, any `apps/**`.

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` 0; engine suite green (baseline + new).
- [ ] `pnpm ledger:heroes:check` / `mechanics:metadata:check` / `sim:runtime-observed:check` / `sim:coverage --check` OK; `roadmap:counts:check` green.
- [ ] `node scripts/convert-cards/apply-hero-ability-markers.mjs` = 7 updated, idempotent (0 on re-run).
- [ ] `git diff origin/main -- packages/game-engine/src/setup/heroAbility.setup.ts packages/game-engine/src/diagnostics/hollowEffect.types.ts packages/game-engine/src/game.test.ts` **empty**.
- [ ] Two-commit topology: `EC-395:` impl + `SPEC:` close.

## Common Failure Smells

- Keyword-count drift tests (two of them: `heroKeywords.test.ts` and `rules/heroAbility.setup.test.ts`) both hardcode 27 → update both to 29; the handler-count test hardcodes 14 → 16.
- `turnEconomy.woundsDrawn` missing from the executor-test mock → `undefined += 1` = NaN (add `woundsDrawn: 0`).
- Wrong `abilityIndex` (cvwr/half-kree is **1**, not 0).
