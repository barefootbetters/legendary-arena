# EC-594 — Hero Ledger `subsystem` Covered Status

**Work Packet:** WP-559
**Layer:** Tooling + Coverage Feeds + Dashboard
**Status:** Pending
**Locks:** D-24368

> The WP is the authoritative design document. Where this EC and WP-559
> conflict, the WP wins. This EC extracts the drift-prone values.

---

## Before Starting

- [ ] `git fetch origin main`, branch from a clean tree, record the SHA.
- [ ] Fresh worktree? `pnpm install` first, then `pnpm -r build` — the ledger
      scripts import built `dist`.
- [ ] Baseline the four gates: `ledger:heroes:check`, `effect-index:check`,
      `ledger:villains:check`, `mechanics:metadata:check` — all 0 at draft.
- [ ] Read `scripts/villain-mechanic-ledger.mjs`'s `subsystem` handling — you are
      mirroring its intent, **not** its key shape (see Locked Values).

## Locked Values

- Seed EXACTLY one hero row — allowlist records **merged** coverage only:
  `core/spider-man` × `reveal-reorder` →
  `{ subsystem: 'setup:reveal-reorder-modifier', wp: 'WP-479', decision: 'D-24286' }`
- Granularity: villains stay **card-keyed** (`cards` block, untouched); heroes are
  **(card × mechanic)** — a new sibling block. A card-keyed hero entry is WRONG
  and AC-2 exists to fail it.
- Classifier: `statusForMechanic` at `scripts/hero-mechanic-ledger.mjs:291`. The
  new check goes **first**, before `KNOWN_CONDITIONS`.
- **Also fix the summary initializer** in the same file — the literal
  `{ executable: 0, deferred: 0, condition: 0, unsupported: 0, unmarked: 0 }`
  needs `subsystem: 0`. Without it the accumulator writes to `undefined` and the
  JSON serialises `"subsystem": null` while `totalRows` (651) stops matching the
  bucket sum (650). Observed at draft.
- Expected post-change tallies: `executable 235 · deferred 0 · condition 5 ·
  unsupported 367 · unmarked 43 · subsystem 1`, `totalRows 651`,
  `distinctMechanics 122`.
- Regeneration set (empirically determined at draft — a partial regen reds
  `main`): `pnpm ledger:heroes` **and** `pnpm effect-index`. The latter rewrites
  `data/metadata/effect-implementation-index.json` — note `data/metadata/`, NOT
  `docs/ai/coverage/`. `ledger:villains` and `mechanics:metadata` are NOT
  affected.
- Dashboard: `LedgerByStatus` at `apps/dashboard/src/types/coverage.ts:58-64`
  (closed 5-field interface); `CoveragePage.vue` owns its own status list, count
  chips and CSS — the `CoverageStatus` union already has `subsystem`, the page
  does not.

## Guardrails

1. **Do NOT edit `scripts/villain-mechanic-ledger.mjs`.** `git diff --exit-code`
   on that path must return 0.
2. **Do NOT modify the allowlist's existing `cards` block.** The villain ledger
   reads it unchanged; your diff there must be additions only.
3. **Do NOT widen `EFFECT_INDEX_STATUSES`** — it already contains `subsystem`
   (verified at draft). Correcting its "a villain card" comment is allowed.
4. **Do NOT add a second allowlist row.** `reveal-reorder` is the only bare
   modifier marker hero-side at this baseline; speculative rows re-introduce the
   over-claim WP-548 avoided.
5. **Do NOT touch the engine**, `reveal-reorder` itself, or any card data.
6. **Do NOT regenerate only the hero ledger.** `effect-index:check` goes stale
   (exit 1) and reds `main` — both writers, every time.
7. **Rebuild before testing after regenerating.** A downstream package reads a
   build-time copy; testing without rebuilding produces a false green (the
   WP-453 / `useInPlayCoverage` precedent).
8. No `.reduce()`; keep the guard-clause idiom already in `statusForMechanic`.

## Required Comments

- [ ] `// why:` on the new branch — that `subsystem` means implemented-elsewhere
      (not a TODO), that hero granularity is `(card × mechanic)` because one card
      legitimately mixes both cases, citing WP-548 / D-24357 and D-24368.
- [ ] `// why:` on the `subsystem: 0` initializer addition — that a missing key
      silently produces `null` and breaks `totalRows === sum(byStatus)`.

## Files to Produce

| File | New? |
|---|---|
| `scripts/coverage/subsystem-coverage.json` | edit (additive) |
| `scripts/hero-mechanic-ledger.mjs` | edit |
| `docs/ai/coverage/hero-mechanic-ledger.json` / `.csv` | regenerated |
| `data/metadata/effect-implementation-index.json` | regenerated |
| `apps/dashboard/src/types/coverage.ts` | edit |
| `apps/dashboard/src/pages/coverage/CoveragePage.vue` | edit |
| `packages/registry/src/schema.ts` | comment only (optional) |
| `docs/ai/DECISIONS.md` (D-24368) | edit |

Governance close: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
`docs/ai/STATUS.md`.

## After Completing

- [ ] All four `:check` gates exit 0; `pnpm -r --no-bail test` green; dashboard
      `vue-tsc` clean.
- [ ] Confirm the three ledger rows by inspection: ASM `reveal-reorder` =
      `subsystem` with wp/decision/handler populated, ASM `reveal-count` =
      `unsupported`, `co2e/spider-man` untouched.
- [ ] Confirm `totalRows === sum(byStatus)`.
- [ ] Land D-24368; flip WORK_INDEX `[x]`, EC_INDEX `Done`, mindmap to `✅`,
      `pnpm roadmap:counts:write`; STATUS.md.
- [ ] **D-24026 live-verify** on `dashboard.legendary-arena.com/coverage` after
      deploy — this WP has a real user-visible surface. Record the observation.
- [ ] Two-commit topology: `EC-594:` implementation, then `SPEC:` governance close.

## Common Failure Smells

- **Card-keyed hero entry.** Clears ASM's `reveal-count` too, hiding a real TODO.
  AC-2 is the guard — make it fail first.
- **Forgetting the `byStatus` initializer.** The ledger still regenerates and
  `ledger:heroes:check` still passes; the damage is `"subsystem": null` and a
  `totalRows` that no longer reconciles. Assert the arithmetic, not just the gate.
- **Partial regeneration.** `effect-index:check` reds `main` for everyone,
  including concurrent sessions.
- **False green from a stale build.** Regenerate, then `pnpm -r build`, then test.
- **`git status` noise.** `packages/lagn-spec/schemas/lagn-v1.json` shows ` M`
  from line-ending churn; confirm with `git diff --ignore-cr-at-eol --numstat`
  and `git checkout --` it.
