# EC-699 — `HeroCardSchema` Must Preserve the Transform Pairing Fields (Execution Checklist)

**Source:** docs/ai/work-packets/WP-662-registry-transform-fields.md
**Layer:** Registry (`packages/registry/src/schema.ts`) — production hotfix restoring WP-657 + WP-658

## Before Starting
- [ ] Baseline `origin/main` @ `c8cf7eab` (WP-657 / WP-658 / WP-660 / WP-661 all merged).
- [ ] Reproduce with the REAL registry: `createRegistryFromLocalFiles({ metadataDir: data/metadata })`, then `registry.getSet('wwhk').heroes.find(h=>h.slug==='she-hulk').cards.find(c=>c.slug==='hurl-trucks').isTransform` → confirm it reads `undefined` (the strip) while `data/cards/wwhk.json` has `"isTransform": true`.

## Locked Values (do not re-derive)
- Add to `HeroCardSchema` (schema.ts): `transform: z.string().optional()`, `transformOf: z.string().optional()`, `isTransform: z.boolean().optional()`.
- Field names + types match `data/cards/*.json` and the engine's usage (`heroCardInstanceExtIds`, `buildTransformTargets`) verbatim.
- Reserved decision: **D-24473** (land Active at close). EC **EC-699**. WP **WP-662**.

## Guardrails
- **Registry-only.** No engine change (WP-657/658 are correct — they were starved, not wrong). A `packages/game-engine/**` edit ⇒ STOP.
- **Additive contract change.** Three OPTIONAL fields; permissive load (matches HeroCardSchema's optional-heavy posture). Aligns the schema with D-24468 / D-24469. Requires the D-24473 entry (contract-file change).
- **Test the REAL path.** The regression test MUST load through `createRegistryFromLocalFiles` (the real Zod schema), not a mock — that mock-vs-real gap is exactly what hid the bug. A mock-based test does NOT satisfy this.
- **No hash re-pin / no regen expected.** Confirm the registry-hash + card-derived `:check` gates stay green with no committed-artifact change. If a hash shifts ⇒ investigate before pinning.

## Required `// why:` Comments
- `schema.ts` (the three fields): they live in the card data (WP-657 / WP-658) but were stripped by the default `z.object`; names the two features it silently broke; the field survives load now. D-24473.
- `registry.smoke.test.ts` (the test): loads through the REAL registry — the gap the engine mocks could never catch. D-24473.

## Files to Produce
- `packages/registry/src/schema.ts` — **modified** — three optional fields on `HeroCardSchema`
- `packages/registry/src/registry.smoke.test.ts` — **modified** — real-registry regression test (wwhk/she-hulk transform fields survive)
- Governance: `NUMBER-LEDGER.md` + `DECISIONS.md` (D-24473) + `WORK_INDEX.md` (WP-662) + `EC_INDEX.md` (this row) + `docs/ai/STATUS.md` + `docs/05-ROADMAP-MINDMAP.md`

## After Completing
- [ ] `pnpm -r build` → 0
- [ ] `pnpm --filter @legendary-arena/registry test` → green (+1 test)
- [ ] `pnpm --filter @legendary-arena/game-engine test` → green (unchanged; no re-pin)
- [ ] `pnpm -r --no-bail test` whole-repo green
- [ ] Probe (real registry): 0 hurl-trucks in hero deck, 5 in side deck, `transformTargets['wwhk/she-hulk/hurl-legal-objections'] === 'wwhk/she-hulk/hurl-trucks'`
- [ ] `cards:check` + `ledger:heroes:check` green; `git diff --name-only` = schema.ts + the test + governance, nothing else (revert any `lagn-v1.json` line-ending churn)
- [ ] D-24473 landed Active; WORK_INDEX (WP-662) + STATUS + mindmap updated
- [ ] **D-24026 operator-pending** (WP-657 + WP-658): a live She-Hulk match — Hurl Trucks NOT recruitable from the HQ; Hurl Legal Objections transforms into Hurl Trucks after ≥6 recruit.

## Execution Result (2026-09-07)
Root cause found while live-verifying WP-658 / WP-660 on the deployed server (`7c04cb92`): both fixes were live (Radioactive Riot no phantom recruit) yet Hurl Trucks was still recruitable. A real-registry probe showed `hurl-trucks.isTransform === undefined` (stripped) vs `"isTransform": true` in `data/cards/wwhk.json`. Added the three fields to `HeroCardSchema`; re-probe confirms 0 hurl-trucks in the hero deck, 5 in the side deck, and `transformTargets['wwhk/she-hulk/hurl-legal-objections'] === 'wwhk/she-hulk/hurl-trucks'`. `pnpm -r build` 0; registry **249/249** (with the real-registry regression test), engine **3093/3093** (unchanged, no re-pin); whole-repo green; `cards:check` + `ledger:heroes:check` green; no derived-artifact drift. **D-24026 operator-pending** (WP-657 + WP-658, now unblocked). Pending commit/PR. (WP/EC/D re-numbered from 661/698/472 after a parallel-session collision with #1871.)
