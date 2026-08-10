# EC-555 — co2e Masters of Evil: Mark the Covered Timing Lines (Execution Checklist)

**Source:** docs/ai/work-packets/WP-520-co2e-masters-of-evil-mark-covered-lines.md
**Layer:** Card Data (Registry input) only — NO engine change

## Before Starting
- [ ] **Hard-dep WP-519 / D-24332 merged to `main`** — `ko-cullable-each-deck-top` is in the `VillainEffectPrimitive` union + array + `apply-effect-markers.mjs`'s local `VILLAIN_EFFECT_PRIMITIVES`. Without it the Melter marker fails `apply-effect-markers.mjs` validation. (Ultron/Whirlwind markers do not depend on it.)
- [ ] `reveal-or-wound:hc:tech` is a valid existing marker (it is the core Ultron Escape marker in `data/cards/core.json`).
- [ ] `ko-hero:current@rooftops+bridge` parses: the `@rooftops+bridge` gate lifts to `requireCitySpaces`, leaving the bare `ko-hero:current` (implicit magnitude 1, the WP-242 path). Confirm `ko-hero:current:1` is NOT used (the parser rejects magnitude < 2, D-24298).
- [ ] `apply-effect-markers.mjs` processes `co2e.json` (it reported `co2e.json — 0 new marker(s)` on the WP-519 run). There is currently NO `co2e` key under `villains` in `inputs/villain-effect-markers.json`.
- [ ] `pnpm -r build` 0; engine test + `ledger:villains:check` + `effect-index:check` green.

## Locked Values (do not re-derive)
- New `co2e` block in `scripts/convert-cards/inputs/villain-effect-markers.json` under `villains`, group `masters-of-evil`, EXACTLY three rows:
  - `"melter": { "fight": ["ko-cullable-each-deck-top"] }`
  - `"ultron": { "escape": ["reveal-or-wound:hc:tech"] }`
  - `"whirlwind": { "fight": ["ko-hero:current@rooftops+bridge"] }`
- **Whirlwind = `ko-hero:current@rooftops+bridge`** (KO ONE — bare current + location gate, magnitude-1 implicit). NOT `ko-hero:current:1@…` (rejected token, D-24298). NOT `:2` (that is core Whirlwind, KO two).
- **NO engine change, NO new primitive, NO test file change, NO `mechanic-provenance.json` row** (each line inherits its owning primitive's WP/D — Melter=WP-519/D-24332, Ultron=WP-469/D-24281, Whirlwind=WP-252/D-24023).
- co2e Melter Fight text is VERBATIM the core Melter Fight, so `ko-cullable-each-deck-top` applies unchanged.

## Guardrails
- Mark ONLY the three enumerated lines. Do NOT mark the deferred lines (Baron Zemo Ambush, Ultron Fight, Whirlwind Ambush) or the two variable-attack passives (Baron Zemo / Ultron `+1[icon:attack]` lines) — those need new primitives / are a separate mechanic class (curation boundary, D-24333).
- If `apply-effect-markers.mjs` loud-fails or a line does NOT reduce to its named primitive (parser rejection / unresolvedMarkers), STOP — that line belongs in the deferred epic, not here. Do NOT invent a marker or primitive.
- Regenerate every derived artifact via its canonical script (`apply-effect-markers.mjs`, `ledger:villains`, `effect-index`). Commit only real diffs — check `git diff --numstat` for CRLF-only churn (e.g. `lagn-v1.json` from a build) and revert noise.
- **Hash verification:** confirm no HASHED oracle (`finalStateHash` via `record-game-fixture.mjs`; `PRE_WP080_HASH` in `replay.execute.test.ts`; the sentinel replay fixture) has a villain config including/exercising `co2e/masters-of-evil`. Known oracles = `core/brotherhood` + synthetic `test/test-villain-group-001` (WP-519 pre-flight) → expected UNCHANGED. If any shifts, re-record via the canonical tool, never hand-edit.

## Files to Produce
- Data/tooling: `scripts/convert-cards/inputs/villain-effect-markers.json` (co2e block, 3 rows) + `data/cards/co2e.json` regen + `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` + `data/metadata/effect-implementation-index.json`
- Governance: DECISIONS (D-24333), NUMBER-LEDGER, STATUS, WORK_INDEX, EC_INDEX, mindmap

## After Completing
- [ ] `node scripts/convert-cards/apply-effect-markers.mjs` → `co2e.json — 3 new marker(s)`, all other sets `0`; idempotent on re-run
- [ ] `pnpm -r build` 0; engine test pass (NO test change — reused handlers already covered); `co2e/masters-of-evil` hooks parse with no `unresolvedMarkers`
- [ ] `ledger:villains:check` + `effect-index:check` + `sim:runtime-observed:check` + `roadmap:counts:check` all 0
- [ ] `git diff --name-only` = allowlist (+ regenerated data/artifacts)
- [ ] The three co2e MoE lines flip unmarked → executable in the villain ledger + effect-index (attributed to the owning primitive's WP/D); NO `no-handler` hollow when fought/escaped; deferred lines + passives still unmarked
- [ ] Hashed oracles verified UNCHANGED (or re-recorded via the canonical tool)
- [ ] D-24333 Active; §11/§21 N/A; STATUS/WORK_INDEX `[x]`/EC_INDEX Done/mindmap ✅ + counts
- [ ] Live-verify (D-24026, operator, post-deploy): a co2e MoE match — Melter cull, Ultron escape reveal-or-wound, Whirlwind Fight KO-one on Rooftops/Bridge — each logs its effect, no breadcrumb

## Common Failure Smells
- `apply-effect-markers.mjs` loud-fails on `ko-cullable-each-deck-top` → WP-519 not merged (primitive not in the script's local array).
- `ko-hero:current@rooftops+bridge` → `unresolvedMarkers` or a parse rejection → wrong grammar; confirm the gate lifts and the bare `current` form is used (not `:1`).
- `co2e.json — 0 new marker(s)` when 3 expected → the co2e block key path is wrong (`villains → co2e → masters-of-evil → <slug>`), or a card slug mismatch (`melter`/`ultron`/`whirlwind`).
- `ledger:villains:check` red → derived artifact not regenerated after the marker edit.
- A deferred line got marked → curation-boundary violation; only Melter Fight / Ultron Escape / Whirlwind Fight are in scope.
- Hash shifted unexpectedly → a committed HASHED fixture includes co2e MoE; re-record via the canonical tool, don't hand-edit.
