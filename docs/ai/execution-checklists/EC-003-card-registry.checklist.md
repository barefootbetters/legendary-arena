# EC-003 — Card Registry Verification & Defect Correction (Execution Checklist)

**Source:** docs/ai/work-packets/WP-003-card-registry.md
**Layer:** Registry

**Execution Authority:**
This EC is the authoritative execution checklist for WP-003.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-003.

---

## Before Starting

- [ ] WP-001 complete: all REFERENCE docs updated and reviewed
- [ ] WP-002 complete: `packages/game-engine/` builds and tests pass
- [ ] `packages/registry/` exists with `schema.ts`, `localRegistry.ts`, `httpRegistry.ts`
- [ ] `data/metadata/` exists with `sets.json` and `card-types.json`
- [ ] `data/cards/` exists with at least one per-set JSON file
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-003.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **`sets.json` shape** (what `httpRegistry.ts` must fetch):
  `{ id: string, abbr: string, pkgId: string, slug: string, name: string, releaseDate: string, type: string }`

- **`card-types.json` shape** (must NOT be used as set index):
  `{ id: string, slug: string, name: string, displayName: string, prefix: string }`

- **`FlatCard.cost` corrected type** (star-cost strings like `"2*"` exist):
  `string | number | undefined` (was incorrectly `number | undefined`)

---

## Guardrails

- `src/schema.ts` must NOT be modified — Zod schemas are correct as-is
- `src/shared.ts` must NOT be modified
- `src/impl/localRegistry.ts` must NOT be modified — already uses `sets.json`
- Registry must NOT import `game-engine`, `server`, any `apps/*`, or `pg`
- ESM only — no `require()`; `node:` prefix on all built-in imports
- Smoke test uses local files only — no R2/HTTP integration testing

---

## Required `// why:` Comments

- `httpRegistry.ts` fetch site: distinguish `sets.json` (set index) from `card-types.json` (card type taxonomy); explain silent failure mode

---

## Files to Produce

- `packages/registry/src/impl/httpRegistry.ts` — **modified** — fix `card-types.json` to `sets.json`; add `// why:`
- `packages/registry/src/types/index.ts` — **modified** — widen `FlatCard.cost`; fix stale JSDoc
- `packages/registry/src/registry.smoke.test.ts` — **new** — local registry smoke test

---

## Common Failure Smells (Optional)

- Zero sets loaded silently -- httpRegistry still fetches `card-types.json`
- Smoke test passes but FlatCard.cost rejects star-cost strings -- type not widened
- `localRegistry.ts` modified -- it was already correct; only `httpRegistry.ts` needs fixing

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/registry build` exits 0
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0
- [ ] Zero occurrences of `card-types.json` as fetch target in `httpRegistry.ts`
- [ ] `FlatCard.cost` is `string | number | undefined`
- [ ] `schema.ts`, `shared.ts`, `localRegistry.ts` were NOT modified
- [ ] No files outside scope were modified
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated
      (card-types vs sets.json; FlatCard.cost widening)
- [ ] `docs/ai/work-packets/WORK_INDEX.md`
      WP-003 checked off with date
