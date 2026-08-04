# EC-528 — Mechanic Provenance Backfill (Execution Checklist)

**Source:** docs/ai/work-packets/WP-493-mechanic-provenance-backfill.md
**Layer:** Shared Tooling (the `scripts/coverage/mechanic-provenance.json` map + the ledger/index generators that read it). Data-only — no code, schema, engine, server, or dashboard-source change.

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] `pnpm -r build` first (the ledger generators import registry + engine `dist`)
- [ ] Provenance map has no `draw` key yet: `node -e "process.exit('draw'in require('./scripts/coverage/mechanic-provenance.json').mechanics?1:0)"` → exit 0 (if present, this WP already ran — STOP)
- [ ] Symptom present: `node -e "const r=require('./docs/ai/coverage/hero-mechanic-ledger.json').rows.find(r=>r.extId==='asrd/warriors-three-the'&&r.mechanic==='draw'); process.exit(r&&r.status==='executable'&&r.wp===''&&r.handler!==''?0:1)"` → exit 0
- [ ] Villain ledger reads the same map: `node -e "process.exit(require('fs').readFileSync('./scripts/villain-mechanic-ledger.mjs','utf8').includes('mechanic-provenance.json')?0:1)"` → exit 0
- [ ] Every cited decision exists: `node -e "const t=require('fs').readFileSync('./docs/ai/DECISIONS.md','utf8'); const ids=['D-2201','D-21501','D-24060','D-24074','D-24156','D-24183','D-24184','D-24139','D-24099','D-24132','D-24133','D-24130','D-24267','D-24281','D-24287','D-24270']; process.exit(ids.every(id=>t.includes(id))?0:1)"` → exit 0
- [ ] Working tree clean except for this WP

## Locked Values (do not re-derive — the traced attribution the operator ruled on 2026-08-03)
Add exactly these 17 keys to the `mechanics` object of `scripts/coverage/mechanic-provenance.json` (existing keys + `_comment` UNCHANGED). Hero:
- `"draw": { "wp": "WP-022", "decision": "D-2201" }`
- `"rescue": { "wp": "WP-215", "decision": "D-21501" }`
- `"undercover": { "wp": "WP-282", "decision": "D-24060" }`
- `"size-changing": { "wp": "WP-290", "decision": "D-24074" }`
- `"gain-wound-self": { "wp": "WP-364", "decision": "D-24156" }`
- `"gain-wound-each": { "wp": "WP-364", "decision": "D-24156" }`
- `"ko-wound-reward": { "wp": "WP-382", "decision": "D-24183" }`
- `"discard-to-play": { "wp": "WP-383", "decision": "D-24184" }`
- `"return-zero-cost-discard": { "wp": "", "decision": "D-24139" }`  ← decision-only (INFRA `62648c7f`, no WP; WP-353 is an unrelated Friend-Request-Email packet — do NOT cite it)
- `"victory-villain-attack": { "wp": "WP-285", "decision": "D-24099" }`
- `"put-any-number-bottom-hq": { "wp": "", "decision": "D-24132" }`  ← decision-only (no formal WP)
- `"put-bottom-hq-icon-reward": { "wp": "", "decision": "D-24133" }`  ← decision-only
- `"optional-put-bottom-hq": { "wp": "", "decision": "D-24130" }`  ← decision-only

Villain:
- `"scry-ko-own-deck": { "wp": "WP-447", "decision": "D-24267" }`
- `"reveal-or-wound": { "wp": "WP-469", "decision": "D-24281" }`
- `"become-scheme-twist": { "wp": "WP-481", "decision": "D-24287" }`
- `"gain-attached-hero": { "wp": "WP-450", "decision": "D-24270" }`

- **Decision-only rule:** four mechanics landed as INFRA/bug-fix commits with NO formal WP — the three HQ-bottom zone-manipulation ones **and** `return-zero-cost-discard` — so `wp` stays `""` (the map's "blank rather than guess" rule). Do NOT fabricate a WP for them; in particular do NOT attribute `return-zero-cost-discard` to WP-353 (Friend-Request-Email packet, unrelated).
- **Do NOT touch existing keys** (`reveal`, `ko-hero`, `berserk`, `wall-crawl`, `dodge`, the WP-185 camelCase villain keys, etc.) or the `_comment`. `schemaVersion` stays `1`.
- **Regen order:** `pnpm ledger:heroes` → `pnpm ledger:villains` → `pnpm effect-index` (index reads the ledgers). Then the three `:check` gates. No dist rebuild needed between them — no generator/schema code changed.

## Guardrails
- READ-ONLY provenance: this backfill RECORDS existing history. Author NO new effect data, NO generator/schema/viewer change, and reserve NO new `D-NNNNN` — every cited decision predates this WP (precondition asserts it)
- Verbatim pass-through IS the mechanism: adding map keys is the ENTIRE change. Do NOT edit `hero-mechanic-ledger.mjs`, `villain-mechanic-ledger.mjs`, `build-effect-implementation-index.mjs`, `packages/registry/src/schema.ts`, or any `apps/dashboard` file
- Fill ONLY `executable` mechanics with a live handler (the 17 above). Do NOT attribute `unsupported` / `unmarked` / `deferred` rows — they have no implementing WP and MUST stay blank
- Row identity is untouched: no row added/removed/reordered; only the `wp` / `decision` cells of the 173 affected rows change. Both ledger `summary` blocks + every non-affected row MUST stay byte-identical
- Do NOT touch `data/cards/**`, `scripts/convert-cards/**`, any marker-apply pass, `build-card-mechanics-metadata.mjs`, `packages/game-engine`, `apps/server`, `apps/arena-client`, `apps/registry-viewer`
- Determinism: build-time artifacts only; touch no `G`/`ctx`/RNG/replay/hash; NO `finalStateHash` / `PRE_WP080_HASH` re-pin
- The provenance JSON stays valid (existing 2-space indent, trailing structure); a malformed map fails the ledger generators' read

## Required `// why:` Comments
- N/A — this WP hand-edits a JSON data file and regenerates artifacts; it adds no code. (The provenance map's existing `_comment` documents the "missing key = not yet attributed" convention; do not remove it.)

## Files to Produce
- `scripts/coverage/mechanic-provenance.json` — **modified** — 17 keys added (4 decision-only); existing keys + `_comment` unchanged; valid JSON
- `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv` — **regenerated** — `pnpm ledger:heroes`
- `docs/ai/coverage/villain-mechanic-ledger.json` + `.csv` — **regenerated** — `pnpm ledger:villains`
- `data/metadata/effect-implementation-index.json` — **regenerated** — `pnpm effect-index`
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip WP-493 node `📝` → `✅`; run `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** — governance close (STATUS records the D-24026 live-verify operator-pending)

## After Completing
- [ ] Provenance map has the 17 keys; the 4 decision-only keys (3 zone-manip + `return-zero-cost-discard`) are `"wp": ""` with a filled `"decision"`; existing keys + `_comment` intact; valid JSON
- [ ] `pnpm ledger:heroes` + `:check` exit 0, byte-stable; Warriors Three `draw` → `WP-022` / `D-2201`; no `executable` hero row for the 13 backfilled mechanics stays blank on both columns; `summary` byte-identical
- [ ] `pnpm ledger:villains` + `:check` exit 0, byte-stable; the 4 villain primitives attributed; `summary` + non-affected rows byte-identical
- [ ] `pnpm effect-index` + `:check` exit 0; the index self-validates; `version` / `summary` / `cards{}` unchanged; the 173 affected entries carry the fill
- [ ] No `unsupported` / `unmarked` / `deferred` row anywhere gained a `wp` or `decision`
- [ ] `node scripts/build-card-mechanics-metadata.mjs` → `git diff --exit-code data/metadata/card-mechanics.json` = 0
- [ ] `/debug/effects` + `/coverage` show the backfilled columns (Warriors Three `draw` → `WP-022`/`D-2201`); legitimately-blank rows still blank
- [ ] `git diff --name-only | grep -E '(\.mjs$)|(packages/(game-engine|registry))|(apps/(server|arena-client|registry-viewer|dashboard))'` → NO MATCH
- [ ] `pnpm -r build` + `pnpm -r --no-bail test` exit 0; replay/sentinel suites green with NO oracle edit (no re-pin)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; NO `DECISIONS.md` change (cited ids verified present)
- [ ] Commit prefix: `EC-528:` (regen) + `SPEC:` (governance); D-24026 live-verify the backfilled columns on the deployed dashboard (operator-pending)

## Common Failure Smells
- A ledger `summary` block shows a diff after regen → you changed a row's status or touched a non-`wp`/`decision` field; only those two cells of the 173 `executable` rows may change
- An `unsupported` / `unmarked` row gained a `wp` → you keyed a non-executable mechanic; only the 17 executable mechanics are backfilled
- The index fails `effect-index:check` but the ledgers are green → you regenerated the index against a stale ledger; run `ledger:heroes` + `ledger:villains` BEFORE `effect-index`
- A generator `.mjs` or `schema.ts` shows in `git diff` → you edited code; this is a pure data backfill, the verbatim pass-through needs no generator change — revert it
- `card-mechanics.json` shows a diff → unexpected: it does not read `wp`/`decision`; a diff means you changed row identity in the ledger — revert
- One of the four decision-only keys (3 zone-manip + `return-zero-cost-discard`) has a non-empty `wp` → they are Decision-only (no formal WP); set `"wp": ""` (and never cite WP-353 for `return-zero-cost-discard`)
- `ledger:heroes:check` fails after a byte-stable-looking edit → CRLF/indent drift in the hand-edited JSON, or a decision id typo; re-run the generator and diff `--numstat`
- A cited decision id 404s in DECISIONS.md → a mis-traced attribution slipped in; STOP and re-trace against the origin commit in the WP Contract table before regenerating
