# EC-568 — co2e Paibok Fight: Mark the co2e Twin (Execution Checklist)

**Source:** docs/ai/work-packets/WP-533-co2e-paibok-fight-give-hq-hero-each-player.md
**Layer:** Card Data (Lightweight Lane)

## Before Starting
- [ ] **Scope lock — the EXACT file set is `## Files to Produce` below; any edit outside it is a FAIL.** Card-data only: NO engine/client/server change.
- [ ] `give-hq-hero-each-player` primitive is landed + executable (WP-532/D-24343); `apply-effect-markers.mjs` already recognizes the token (no tooling change).
- [ ] co2e group slug is `skulls` (co2e-source typo; `data/cards/co2e.json` `"slug": "skulls"`, instance ext_id `co2e-villain-skulls-paibok-the-power-skrull-00`) — the marker key MUST be `skulls`.
- [ ] `pnpm -r build` 0 (engine dist feeds the ledger regen); `pnpm --filter @legendary-arena/registry test` 0.

## Locked Values (do not re-derive)
- **Card marked (1):** co2e `skulls/paibok-the-power-skrull` **Fight** line only → `"paibok-the-power-skrull": { "fight": ["give-hq-hero-each-player"] }` added as a **new `skulls` group** under the co2e section of `villain-effect-markers.json` (the co2e section currently holds only `masters-of-evil`).
- Existing primitive `give-hq-hero-each-player` (WP-532/D-24343) — NO new primitive, NO union/array edit, NO new D.
- The co2e-only passive `"Paibok gets +1[icon:attack] for each Hero Class among Heroes in the HQ."` is OUT of scope (variable-attack, not a timing line).

## Guardrails
- Card-data only: NO `packages/game-engine/**`, `apps/**` edit; NO new primitive / D-entry / contract.
- Marker key group = `skulls` (the co2e typo), NOT `skrulls` — must match `co2e.json`.
- Regenerate via the pipeline (`apply-effect-markers.mjs` → `ledger:villains` → `effect-index`); NEVER hand-edit the generated artifacts.
- `mechanic-provenance.json` UNCHANGED — the primitive already carries its `{WP-532, D-24343}` row (no net-new primitive).
- No hash re-pin: no committed fixture fights co2e Paibok (verify: `grep -rl co2e` over engine fixtures = none) → `finalStateHash`/`PRE_WP080` byte-identical.
- co2e.json diff MUST be exactly the 1 Fight line (no unrelated card churn / CRLF noise — revert `lagn-v1.json` if `pnpm -r build` dirties it with a 0-content diff).

## Files to Produce
- Data/tooling: `scripts/convert-cards/inputs/villain-effect-markers.json` (co2e `skulls` block) + `data/cards/co2e.json` regen + `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` + `data/metadata/effect-implementation-index.json` — **modified**
- Governance: NUMBER-LEDGER, STATUS, WORK_INDEX, EC_INDEX, mindmap

## After Completing
- [ ] `node scripts/convert-cards/apply-effect-markers.mjs` → 1 new marker; `pnpm -r build && pnpm ledger:villains && pnpm effect-index`
- [ ] `ledger:villains:check` + `effect-index:check` + `sim:runtime-observed:check` + `roadmap:counts:check` all 0
- [ ] `pnpm --filter @legendary-arena/registry test` 0
- [ ] co2e Paibok row flips `(unmarked)` → `give-hq-hero-each-player`/`executable` with `{WP-532, D-24343}`; co2e.json diff = 1 line
- [ ] `git diff --name-only` = allowlist; hash oracles UNCHANGED (no co2e fixture)
- [ ] STATUS updated; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅` + `pnpm roadmap:counts:write`
- [ ] Live-verify (D-24026): fight co2e Paibok → the fighting human gets a "choose a Hero to gain" prompt; each player gains an HQ Hero; no `no-handler`

## Common Failure Smells
- Marker keyed `skrulls` (correct spelling) instead of `skulls` (the co2e typo) → the marker never matches the co2e card; ledger stays unmarked.
- Edited an engine/client file → over-scope; the primitive already exists.
- Hand-edited the ledger / effect-index → must be regenerated from the pipeline.
- Marked the `+1 attack per HQ Hero Class` passive → out of scope (variable-attack line).
