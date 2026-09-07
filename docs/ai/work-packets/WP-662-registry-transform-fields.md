# WP-662 — `HeroCardSchema` Must Preserve the Transform Pairing Fields (Registry)

**Status:** EXECUTED 2026-09-07 (Ready — green, pending commit/PR) · **Registry lane** (single schema file + a real-registry regression test). Reserves **D-24473** / **EC-699**. **Production hotfix** — restores WP-657 + WP-658, both currently dead live.

**Primary Layer:** Registry (`packages/registry/src/schema.ts`)
**User-Visible Surface:** `play.legendary-arena.com` — transform second-forms (e.g. **Hurl Trucks**) stop being recruitable from the HQ (WP-657 partition), and **[keyword:Transform]** actually fires (WP-658). **D-24026 REQUIRED** for WP-657 + WP-658, now unblocked.
**Dependencies:** WP-657 ✅ (D-24468) + WP-658 ✅ (D-24469) — this makes both work live. **Baseline:** `origin/main` @ `c8cf7eab`.

---

## Problem (a live, shipped-but-dead feature)

`transform` / `transformOf` / `isTransform` have lived in `data/cards/*.json` since WP-657 / WP-658, and the engine setup reads them off the **registry** (`heroCardInstanceExtIds` for the partition; `buildTransformTargets` for the base→target map). But `HeroCardSchema` never declared them, and a Zod `z.object` **strips unknown keys by default** — so `createRegistryFromLocalFiles` dropped them at load. `registry.getSet('wwhk').heroes[…].cards[…].isTransform` returned `undefined`, which silently broke both features in production:

- **Partition dead:** `buildHeroDeckCards` kept the second-forms in the shuffled Hero Deck / HQ → recruitable (the opposite of D-24468). **Live-observed** (`red-skull-Midtown-Bank-Robbery` 1p, server `7c04cb92`): Hurl Trucks recruited from the HQ.
- **Transform runtime dead:** `buildTransformTargets` read nothing → `G.transformTargets` empty → every swap soft-no-op'd on an empty side deck.

**Why every test passed:** the engine setup tests use **mock** registries that keep the fields; none loaded the transform fields through the REAL Zod schema. The strip was invisible to the whole suite.

**How found:** live-verifying WP-658/WP-660. WP-660's fix was confirmed live (Radioactive Riot no phantom recruit → server on `7c04cb92`), yet Hurl Trucks was still recruitable → a probe showed the real registry returns `isTransform: undefined`.

---

## Fix

Add `transform`, `transformOf`, `isTransform` (all `.optional()`) to `HeroCardSchema`. Additive, permissive (matches the schema's deliberate optional-heavy posture), aligns the registry with the data + engine contracts already locked by D-24468 / D-24469.

## Scope (In)

- `packages/registry/src/schema.ts` — the three fields on `HeroCardSchema`.
- `packages/registry/src/registry.smoke.test.ts` — a REAL-registry regression test asserting the fields survive load for `wwhk/she-hulk` (base `transform` + second-form `transformOf`/`isTransform`). This is the path the engine mocks could never cover.

## Out of Scope

- The engine partition / transform code (WP-657 / WP-658) — unchanged; this only stops the registry from starving them.
- Whether other schemas strip engine-needed fields — not audited here (a possible follow-up).

---

## Acceptance Criteria

1. The real registry (`createRegistryFromLocalFiles`) loads `wwhk/she-hulk` cards with `transform` / `transformOf` / `isTransform` intact (**AC-1**).
2. With the real registry, `buildHeroDeckCards` puts 0 hurl-trucks copies in the hero deck and `buildTransformSideDeckCards` puts 5 in the side deck; `buildTransformTargets` maps `hurl-legal-objections → hurl-trucks` (**AC-2**, verified by probe).
3. Regression test in `registry.smoke.test.ts` asserts AC-1 and would fail on the stripped schema (**AC-3**).
4. Registry suite green; whole-repo green; no hash re-pin, no derived-artifact drift (**AC-4**).

## Definition of Done

- [x] Three fields added to `HeroCardSchema`
- [x] Real-registry regression test added and green
- [x] `pnpm -r build` 0; registry 249/249; engine 3093/3093; whole-repo green
- [x] `cards:check` + `ledger:heroes:check` green; no registry-hash / derived-artifact drift
- [x] Probe confirms partition + transformTargets work against real data
- [ ] D-24026 live-verified (WP-657 + WP-658) after deploy
- [x] `DECISIONS.md` D-24473 + WORK_INDEX (WP-662) + EC_INDEX/EC-699 + STATUS + mindmap

## Vision Alignment

**Vision clauses touched:** card fidelity / a shipped mechanic actually resolves. **Conflict:** none — restores intended behavior. **Determinism:** registry-only; no `G` field, no `ctx.random`; no committed hash oracle pins per-card registry content in a way that shifted (registry + engine suites green with no re-pin).
