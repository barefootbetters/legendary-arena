# EC-583 — Coverage `subsystem`-Covered Status (Execution Checklist)

**Source:** docs/ai/work-packets/WP-548-coverage-subsystem-covered-status.md
**Layer:** Tooling / coverage generators + card-data-derived feeds + `apps/dashboard`.
**No engine / `G` / gameplay / determinism change.**

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Root cause present: `grep -q "rawTokens.length === 0" scripts/villain-mechanic-ledger.mjs && grep -q "extractEffectTokens" scripts/villain-mechanic-ledger.mjs` → OK (the would-be-unmarked path)
- [ ] Index is a verbatim join: `grep -q "STATUS_ORDER" scripts/build-effect-implementation-index.mjs` → OK
- [ ] Status stack present: `grep -q "LedgerStatus" apps/dashboard/src/types/coverage.ts && grep -q "statusLabel" apps/dashboard/src/composables/useEffectIndex.ts && grep -q "effectImplementationIndex" packages/registry/src/schema.ts` → OK
- [ ] Drift tests present: `test -f apps/dashboard/src/types/coverage.drift.test.ts && test -f packages/registry/src/schema.effectImplementationIndex.test.ts` → OK
- [ ] Seed cards confirmed live: `node -e "const r=require('./scripts/convert-cards/inputs/villain-defeat-requirements.json'); process.exit(r.requirements.length>=3?0:1)"` → exit 0 (Blob/Venom/Zombie-Venom)
- [ ] **WP-546 gate** (decides the Supreme HYDRA row): `grep -q "computeDynamicVillainVictoryPoints" packages/game-engine/src/scoring/*.ts 2>/dev/null && echo "WP-546 MERGED — add Supreme HYDRA row" || echo "WP-546 NOT merged — seed only the 3 defeat-requirement cards"`
- [ ] `pnpm -r build` + `pnpm -r --no-bail test` exit 0 on a clean tree

## Locked Values (do not re-derive)
- **NEW status token:** `subsystem` — implemented by a non-`[effect:X]` subsystem (DONE, not a TODO). Distinct from `unmarked` (todo) and `deferred` (recognized-but-unimplemented).
- **NEW allowlist** `scripts/coverage/subsystem-coverage.json` — `{ schemaVersion, _comment, cards: { "<ext_id>": { subsystem, wp, decision } } }`. Keyed by the per-card ledger ext_id `{setAbbr}-villain-{groupSlug}-{cardSlug}`. Seed (live): `core-villain-brotherhood-blob`, `core-villain-spider-foes-venom`, `ssw1-villain-deadlands-the-zombie-venom` → `{ subsystem: "setup:require-to-defeat", wp: "WP-292", decision: "D-24076" }`. Verify each key against `villain-defeat-requirements.json` (`{set}/{group}/{card}`). **Supreme HYDRA** `core-villain-hydra-supreme-hydra` → `{ subsystem: "scoring:dynamic-vp", wp: "WP-546", decision: "D-24355" }` — add ONLY if the WP-546 gate above shows MERGED.
- **`scripts/villain-mechanic-ledger.mjs`** — read the allowlist (like `mechanic-provenance.json`); in `buildCardRows` `rawTokens.length === 0` branch, if the card ext_id is in the allowlist → `buildRow(..., mechanic = entry.subsystem, status = 'subsystem', provenance-from-entry)`; else keep `(unmarked)`. Add `subsystem` to the summary counts. Do NOT change the `[effect:X]`-marked paths.
- **`scripts/build-effect-implementation-index.mjs`** — add `'subsystem'` to `STATUS_ORDER` (line ~78). The join passes status through verbatim; this only stabilizes the summary key.
- **`packages/registry/src/schema.ts`** — add `'subsystem'` to the `effectImplementationIndex` status Zod enum. Update `schema.effectImplementationIndex.test.ts`.
- **`apps/dashboard/src/types/coverage.ts`** — add `'subsystem'` to the `LedgerStatus` union AND the status array. Update `coverage.drift.test.ts` (pins the exact list).
- **`apps/dashboard/src/composables/useEffectIndex.ts`** — add a `case 'subsystem':` to the exhaustive `statusLabel` switch (label e.g. `"Subsystem"`) and a `subsystem: 0` entry to the `byStatus` init.
- **`apps/dashboard/src/pages/debug/EffectsPage.vue`** — add `'subsystem'` to the local `STATUS_ORDER` and an `fx-subsystem` CSS modifier styled as a COVERED/done state (distinct from `fx-unmarked`).
- **DECISIONS reservation:** **D-24357**.

## Guardrails
- Tooling + coverage feeds + dashboard ONLY. Do NOT touch `packages/game-engine`, `G`, or any card's implementation. This is pure observability.
- Do NOT edit `data/cards/*.json` — the allowlist is a coverage artifact under `scripts/coverage/`, not card data.
- Regenerate EVERY derived feed in ONE commit: `villain-mechanic-ledger.{csv,json}`, `data/metadata/effect-implementation-index.json`, and the dashboard's bundled copy (prebuild). A partial regen reddens the freshness `:check` on `main`.
- Byte-check each regenerated feed is a REAL diff (`git diff --numstat`), not CRLF churn.
- The allowlist reflects MERGED coverage only — never add a card whose subsystem code is not yet on `main` (the WP-546 gate).
- Adding a status is a drift-guarded change: the union, the status array, the Zod enum, the exhaustive `statusLabel` switch, `coverage.drift.test.ts`, and the schema test must ALL move together (a missed one fails to compile or reddens a drift test).

## Required `// why:` Comments
- On the allowlist read + the `subsystem` branch in `villain-mechanic-ledger.mjs`: a card implemented by a non-`[effect:X]` subsystem (setup:require-to-defeat / scoring:dynamic-vp) is DONE, not a TODO; `subsystem` is the honest "covered elsewhere" status (contrast `unmarked`/`deferred`).
- On `subsystem-coverage.json` `_comment`: the allowlist reflects MERGED coverage only; a card joins when its subsystem implementation lands.

## Files to Produce
- `scripts/coverage/subsystem-coverage.json` — **new** — curated allowlist
- `scripts/villain-mechanic-ledger.mjs` — **modified** — read allowlist + emit `subsystem` + summary
- `scripts/build-effect-implementation-index.mjs` — **modified** — `STATUS_ORDER` += `subsystem`
- `docs/ai/coverage/villain-mechanic-ledger.{csv,json}` — **regenerated**
- `data/metadata/effect-implementation-index.json` — **regenerated** (+ dashboard bundled copy via prebuild)
- `packages/registry/src/schema.ts` (+ `schema.effectImplementationIndex.test.ts`) — **modified** — Zod enum
- `apps/dashboard/src/types/coverage.ts` (+ `coverage.drift.test.ts`) — **modified** — union + array
- `apps/dashboard/src/composables/useEffectIndex.ts` — **modified** — `statusLabel` + `byStatus`
- `apps/dashboard/src/pages/debug/EffectsPage.vue` — **modified** — `STATUS_ORDER` + `fx-subsystem` CSS
- (verify) `apps/dashboard/src/pages/coverage/CoveragePage.vue` — add the label/colour if it keeps its own status list
- `docs/ai/DECISIONS.md` (D-24357 → Active) · `STATUS.md` · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-548 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] `node -e "const j=require('./docs/ai/coverage/villain-mechanic-ledger.json'); const b=j.rows.find(r=>r.extId==='core-villain-brotherhood-blob'); process.exit(b && b.status==='subsystem' ? 0 : 1)"` → exit 0 (Blob is `subsystem`)
- [ ] `grep -c "subsystem" data/metadata/effect-implementation-index.json` → ≥ 1; `git diff --numstat` shows real diffs on all regenerated feeds
- [ ] A card NOT in the allowlist that was `unmarked` is still `unmarked` (spot-check one)
- [ ] `git status` shows NO `packages/game-engine/` change and NO `data/cards/` change
- [ ] `pnpm -r build` + `pnpm -r --no-bail test` exit 0; the dashboard typechecks + builds; `ledger:villains --check` + effect-index freshness `:check` green
- [ ] `/debug/effects` (or a viewer test) renders `subsystem` as a covered chip, distinct from `unmarked`
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP `✅` + counts; D-24357 Active
- [ ] Commit prefix `EC-583:` (code + regenerated feeds) + `SPEC:` (governance)

## Common Failure Smells
- Blob still `unmarked` → the allowlist key doesn't match the ledger ext_id (`{setAbbr}-villain-{groupSlug}-{cardSlug}`); check the group slug (`brotherhood`) and card slug (`blob`).
- Dashboard fails to compile → a status-stack site was missed (union, array, Zod enum, `statusLabel` switch, drift test, schema test — all must include `subsystem`).
- Freshness `:check` red though the code is right → a derived feed wasn't regenerated (villain ledger CSV+JSON, effect-index JSON, dashboard copy — regen ALL).
- Supreme HYDRA shows `subsystem` but WP-546 isn't merged → false-green; remove its allowlist row until WP-546 lands (the gate).
- A `data/cards/*.json` diff appears → wrong; the allowlist is under `scripts/coverage/`, not card data.
