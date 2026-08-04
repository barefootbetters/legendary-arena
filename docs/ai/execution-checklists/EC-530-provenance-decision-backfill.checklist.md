# EC-530 — Provenance Decision Backfill (Execution Checklist)

**Source:** docs/ai/work-packets/WP-495-provenance-decision-backfill.md
**Layer:** Shared Tooling (the `scripts/coverage/mechanic-provenance.json` map + the ledger/index generators that read it). Data-only — no code, schema, engine, server, or dashboard-source change.

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] `pnpm -r build` first (the ledger generators import registry + engine `dist`)
- [ ] WP-493 landed: `node -e "const m=require('./scripts/coverage/mechanic-provenance.json').mechanics; process.exit(m.draw&&m.draw.decision==='D-2201'?0:1)"` → exit 0 (else WP-493 not on main — STOP)
- [ ] The 6 targets are wp-filled/decision-empty: `node -e "const m=require('./scripts/coverage/mechanic-provenance.json').mechanics; const t=['koHeroCurrentPlayer','gainWoundEachPlayer','gainWoundCurrentPlayer','heroDeckTopToEscape','attack-per-count','optional-ko-reward']; process.exit(t.every(k=>m[k]&&m[k].wp&&m[k].decision==='')?0:1)"` → exit 0
- [ ] Every cited decision exists: `node -e "const t=require('fs').readFileSync('./docs/ai/DECISIONS.md','utf8'); process.exit(['D-18502','D-18503','D-24016','D-24019'].every(id=>t.includes(id))?0:1)"` → exit 0
- [ ] Working tree clean except this WP

## Locked Values (do not re-derive — the traced attribution)
Set the `decision` on these 6 EXISTING keys in `scripts/coverage/mechanic-provenance.json` (leave each key's `wp` and every other key + the `_comment` UNCHANGED):
- `koHeroCurrentPlayer`: `{ "wp": "WP-185", "decision": "D-18503" }`  (its specific resolution decision — mirrors captureBystander→D-18506)
- `gainWoundEachPlayer`: `{ "wp": "WP-185", "decision": "D-18502" }`
- `gainWoundCurrentPlayer`: `{ "wp": "WP-185", "decision": "D-18502" }`
- `heroDeckTopToEscape`: `{ "wp": "WP-185", "decision": "D-18502" }`
- `attack-per-count`: `{ "wp": "WP-247", "decision": "D-24016" }`
- `optional-ko-reward`: `{ "wp": "WP-248", "decision": "D-24019" }`

- **Fill ONLY the `decision`.** Do NOT change any `wp`, do NOT add keys, do NOT touch keys whose `decision` is already set or whose `wp` is intentionally `""` (the WP-493 decision-only mechanics: `return-zero-cost-discard`, `put-any-number-bottom-hq`, `put-bottom-hq-icon-reward`, `optional-put-bottom-hq`).
- **D-18502 rationale:** `gainWound*`/`heroDeckTopToEscape` have no mechanic-specific decision; D-18502 ("Villain Effect Vocabulary Locked to Five Keywords", WP-185) is the decision that DEFINES them — the governing attribution, not a guess.
- **Regen order:** `pnpm ledger:heroes` → `pnpm ledger:villains` → `pnpm effect-index`. Then the three `:check` gates. No dist rebuild needed between them — no generator/schema code changed.

## Guardrails
- READ-ONLY provenance: RECORD existing history. Author NO new effect data, NO generator/schema/viewer change, reserve NO new `D-NNNNN` — every cited decision predates this WP
- Verbatim pass-through IS the mechanism: setting the 6 decision values is the ENTIRE change. Do NOT edit `hero-mechanic-ledger.mjs`, `villain-mechanic-ledger.mjs`, `build-effect-implementation-index.mjs`, `packages/registry/src/schema.ts`, or any `apps/dashboard` file
- Fill ONLY the 6 targets' `decision`; do NOT change any `wp` or touch any other key
- Row identity untouched: no row added/removed/reordered; only the `decision` cell of the 75 affected rows changes. Both ledger `summary` blocks + `card-mechanics.json` MUST stay byte-identical
- Do NOT touch `data/cards/**`, `scripts/convert-cards/**`, any marker-apply pass, `build-card-mechanics-metadata.mjs`, `packages/game-engine`, `apps/server`, `apps/arena-client`, `apps/registry-viewer`
- Determinism: build-time artifacts only; touch no `G`/`ctx`/RNG/replay/hash; NO `finalStateHash`/`PRE_WP080` re-pin
- The provenance JSON stays valid (existing 2-space indent, `_comment` intact)

## Required `// why:` Comments
- N/A — hand-edits a JSON data file + regenerates artifacts; adds no code. (Keep the map's existing `_comment`.)

## Files to Produce
- `scripts/coverage/mechanic-provenance.json` — **modified** — 6 `decision` values filled; `wp` + other keys + `_comment` unchanged; valid JSON
- `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv` — **regenerated** — `pnpm ledger:heroes`
- `docs/ai/coverage/villain-mechanic-ledger.json` + `.csv` — **regenerated** — `pnpm ledger:villains`
- `data/metadata/effect-implementation-index.json` — **regenerated** — `pnpm effect-index`
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip WP-495 node `📝` → `✅`; run `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** — governance close (STATUS records the D-24026 live-verify operator-pending)

## After Completing
- [ ] The 6 keys carry the traced `decision`; `wp` unchanged; other keys + `_comment` intact; valid JSON
- [ ] `pnpm ledger:heroes` + `:check` exit 0, byte-stable; `attack-per-count`→D-24016, `optional-ko-reward`→D-24019; `summary` byte-identical
- [ ] `pnpm ledger:villains` + `:check` exit 0, byte-stable; `koHeroCurrentPlayer`→D-18503, `gainWoundEachPlayer`/`heroDeckTopToEscape`→D-18502; `summary` byte-identical
- [ ] `pnpm effect-index` + `:check` exit 0; self-validates; `version`/`summary`/`cards{}` unchanged; the 75 affected entries carry the fill
- [ ] No executable-blank-decision row remains for the 6 mechanics; no non-executable row and no WP-493 decision-only row changed
- [ ] `node scripts/build-card-mechanics-metadata.mjs` → `git diff --exit-code data/metadata/card-mechanics.json` = 0
- [ ] `/debug/effects` shows the filled Decision (a `koHeroCurrentPlayer` villain row → `WP-185`/`D-18503`)
- [ ] `git diff --name-only | grep -E '(\.mjs$)|(packages/)|(apps/)'` → NO MATCH
- [ ] `pnpm -r build` + `pnpm -r --no-bail test` exit 0; replay/sentinel green with NO oracle edit (no re-pin)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; NO `DECISIONS.md` change (cited ids verified present)
- [ ] Commit prefix: `EC-530:` (regen) + `SPEC:` (governance); D-24026 live-verify on the deployed dashboard (operator-pending)

## Common Failure Smells
- A ledger `summary` block shows a diff after regen → you changed a row's status/wp or touched a non-`decision` field; only the `decision` cell of the 75 executable rows may change
- A `wp` value changed → you edited more than `decision`; the 6 keys' `wp` must stay exactly as-is
- A WP-493 decision-only key (`return-zero-cost-discard` etc.) now has a non-empty `wp` → you touched the wrong key; only the 6 wp-filled/decision-empty keys are in scope
- The index fails `effect-index:check` but the ledgers are green → regenerated the index against stale ledgers; run `ledger:heroes` + `ledger:villains` BEFORE `effect-index`
- A generator `.mjs` or `schema.ts` in `git diff` → you edited code; pure data backfill, revert it
- `card-mechanics.json` shows a diff → it does not read `decision`; a diff means you changed row identity — revert
- A cited decision id 404s in DECISIONS.md → a mis-traced attribution; STOP and re-trace against the WP Contract table
