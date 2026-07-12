# EC-392 — Final-Score VP by Printed Card VP (WP-365)

**Pairs with:** `docs/ai/work-packets/WP-365-printed-vp-scoring.md`
**Reserves/lands:** D-24157 (flips reserved → Active at close)
**Baseline:** `origin/main @ 4d305596` (re-checked at commit)
**Lane:** Standard two-session lane (scoring/competitive surface + G snapshot; NOT lightweight)

> The WP is the authoritative design doc. This EC extracts the drift-prone locked
> values + guardrails. If EC and WP conflict, the WP wins; if either conflicts with
> ARCHITECTURE.md / `.claude/rules/*`, those win.

---

## Before Starting

- [ ] Confirm hard-deps on `main`: WP-020 (`computeFinalScores` + `scoring.types.ts` flat constants), WP-017 (victory classification via `G.villainDeckCardTypes`), the setup-snapshot pattern (`cardStats`/`cardTraits`/`villainDeckCardTypes`), registry `VillainCardSchema.vp` / `MastermindSchema.vp`.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` green on the baseline; **capture the absolute test/suite counts** (WP asserts a delta).
- [ ] Confirm `villainCardInstanceExtIds` is exported from `villainDeck/villainDeck.setup.js` (reused by the new builder).
- [ ] Confirm no concurrent session has `scoring.*` / `buildInitialGameState.ts` / `types.ts` dirty (other engine sessions are live) — re-check `git fetch` before commit.

## Locked Values

- **New G field:** `cardVictoryPoints?: Record<CardExtId, number>` on `LegendaryGameState` — **optional**, omit-when-empty (mirrors `cardSizeChangingClasses?`). Sibling snapshot; built once at setup; read-only at runtime.
- **Scoring rule (per victory-pile card):** `G.cardVictoryPoints?.[cardId] ?? VP_<category>`. Bystander = `VP_BYSTANDER` (1). Wound = `VP_WOUND` (−1).
- **Tactic VP:** `tacticVP = tacticsDefeated.length × (G.cardVictoryPoints?.[G.mastermind.baseCardId] ?? VP_TACTIC)`.
- **Fallback constants (values UNCHANGED, re-documented as fallbacks):** `VP_VILLAIN=1`, `VP_HENCHMAN=1`, `VP_TACTIC=5`, `VP_BYSTANDER=1`, `VP_WOUND=−1`.
- **vp normalization:** parse `string | number`; integer `≥ 0`; `null` / `undefined` / `NaN` / negative / non-integer → **omit** the entry (→ fallback). Never throw.
- **Ext_id keying:** villains → `villainCardInstanceExtIds(setAbbr, slug, cardSlug, card)`; henchmen → `henchman-{groupSlug}-{00..09}`; mastermind → `${setAbbr}-mastermind-${slug}-${baseCard.slug}` (= `G.mastermind.baseCardId`).

## Guardrails (do NOT violate)

1. **`CardStatEntry` / `economy.types.ts` / `economy.logic.ts` / `mastermind.setup.ts` are NOT modified** (WP non-negotiable + concurrency safety — vp is a scoring concern, not a hero-economy stat; a dedicated builder keeps the shared economy contract untouched).
2. **`PlayerScoreBreakdown` shape + field names unchanged** — value-only fix, no consumer break.
3. **Bystander stays 1; wound stays −1** — only villain / henchman / mastermind-tactic VP become printed-value-driven.
4. **Flat constants demoted, not deleted** — a null-`vp` card scores the fallback, never 0.
5. **Determinism:** the field is conditional-spread/omit-when-empty; scoring is a derived view (no G write); the builder + normalizer never throw (only `Game.setup()` may throw); no RNG. Verify sentinel via `sim:coverage --check` (expect no re-pin under `EMPTY_REGISTRY`).
6. **No `.reduce()`**; explicit `for...of`; no `boardgame.io` / registry-package import in the engine files; `G` JSON-serializable.
7. **Scope allowlist only** (below). The new builder file is an inline allowlist amendment (the WP under-specified the build site; the codebase convention is a dedicated `buildCard*.ts`).

## Required `// why:` Comments

- The `cardVictoryPoints?` G field — `// why: D-24157` (immutable setup snapshot of printed VP; omit-when-empty determinism).
- The conditional-spread assign in `buildInitialGameState.ts` — `// why: D-24157` (WP-290 omit-when-empty pattern → no-vp games byte-identical).
- The scoring header-note update (scoring now reads the `cardVictoryPoints` snapshot) — `// why: D-24157`.
- `normalizePrintedVictoryPoints` odd cases (why null/NaN/non-int omit rather than 0).

## Files to Produce

**Amended allowlist** (WP list + the two new-builder files, noted here):
- `packages/game-engine/src/setup/buildCardVictoryPoints.ts` — **NEW** — `normalizePrintedVictoryPoints` + `buildCardVictoryPoints` (villain/henchman/mastermind getSet walks; reuses `villainCardInstanceExtIds`).
- `packages/game-engine/src/setup/buildCardVictoryPoints.test.ts` — **NEW** — normalizer + builder unit tests.
- `packages/game-engine/src/types.ts` — **modified** — `cardVictoryPoints?` field.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — call the builder + conditional-spread assign.
- `packages/game-engine/src/scoring/scoring.logic.ts` — **modified** — per-card printed-VP read + fallback; tactic-by-mastermind-vp; header note.
- `packages/game-engine/src/scoring/scoring.types.ts` — **modified** — constants re-documented as fallbacks (values unchanged).
- `packages/game-engine/src/scoring/scoring.logic.test.ts` — **modified** — per-card + fallback + tactic + bystander/wound tests.
- Governance at close: `STATUS.md`, `DECISIONS.md` (D-24157 → Active + record the dedicated-builder mechanism), `WORK_INDEX.md` (WP-365 ✅), `EC_INDEX.md` (EC-392 Done), `05-ROADMAP-MINDMAP.md` (node 📝→✅ + `roadmap:counts --write`).

**NOT modified:** `economy.types.ts`, `economy.logic.ts`, `mastermind.setup.ts`, any `apps/**`, registry package.

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0; engine suite green (baseline + new).
- [ ] `pnpm sim:coverage --check` OK; sentinel `finalStateHash` unchanged (or re-pin recorded with evidence).
- [ ] `pnpm roadmap:counts:check` green.
- [ ] `git diff origin/main -- packages/game-engine/src/economy packages/game-engine/src/mastermind` **empty** (contract/economy untouched).
- [ ] `git diff --name-only origin/main` = allowlist only.
- [ ] Two-commit topology: `EC-392:` implementation + `SPEC:` governance close.

## Common Failure Smells

- Keying `cardVictoryPoints` by the definition ext_id instead of the copy-suffixed zone instance ext_id → scoring lookups miss (the WP-191 class of bug); reuse `villainCardInstanceExtIds`.
- Reading henchman/mastermind vp from the wrong nesting (henchman vp is group-level like `vAttack`; mastermind vp is on `baseCard`).
- Scoring `?? 0` instead of `?? VP_<category>` → null-`vp` cards silently score 0.
- Forgetting the mastermind branch → tactics stay flat 5 (correct for Magneto, wrong for other masterminds).
