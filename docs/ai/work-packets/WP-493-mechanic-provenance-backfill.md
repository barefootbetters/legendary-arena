# WP-493 — Mechanic Provenance Backfill (fill the blank WP/Decision columns on /debug/effects)

**Status:** Draft 2026-08-03 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `dashboard /debug/effects` **and** `dashboard /coverage` (the WP / Decision columns fill for 173 previously-blank rows; D-24026 live-verification applies — the packet is not Done until the columns render populated on the deployed dashboard).
**Primary Layer:** Shared Tooling (the `scripts/coverage/mechanic-provenance.json` map + the ledger/index generators that read it). Data-only; no code, schema, engine, server, or dashboard-source change.
**Dependencies:** WP-484 / D-24289 (the `effect-implementation-index.json` this feeds); WP-259 / D-24035 (the `/coverage` viewer); WP-487 / D-24292 (the `/debug/effects` viewer). Plus the 17 mechanic-implementing WPs whose provenance this records (cited in the Contract).

---

## Goal

After this session, every hero and villain mechanic that is **`executable` with a live handler** carries its implementing Work-Packet and Decision on `/debug/effects` and `/coverage`, instead of a blank WP / Decision cell. Today 173 such rows render blank — 162 hero rows across 13 mechanics (led by `draw`, on 87 cards) and 11 villain rows across 4 mechanics — even though each effect works: the effect fires, the handler column already points at real code. The blank is not a code gap; it is a **provenance gap**. The ledger generators read `scripts/coverage/mechanic-provenance.json` VERBATIM for the `wp` / `decision` columns (`buildRow` → `provenance[mechanic] ?? {}`), and that map was only ever seeded from later mechanic-implementing WPs — the foundational MVP keywords and four recent villain primitives were never added. This WP adds the 17 missing keys to the map, each traced to its real implementing commit, then regenerates the three artifacts that read it. It authors no code, no schema, and no viewer change — the fill is a pure data backfill that flows through the existing verbatim pass-through.

## User-Visible Impact

An operator on `/debug/effects` or `/coverage` inspecting an implemented effect — e.g. `asrd/warriors-three-the` `draw` (Warriors Three) — sees `WP-022` / `D-2201` where the cell was blank. 173 rows fill: 162 hero (`draw`, `rescue`, `undercover`, `size-changing`, `gain-wound-self`/`-each`, `ko-wound-reward`, `discard-to-play`, `victory-villain-attack`, and 4 decision-only mechanics) + 11 villain (`scry-ko-own-deck`, `reveal-or-wound`, `become-scheme-twist`, `gain-attached-hero`). Four mechanics — the three HQ-bottom zone-manipulation ones plus `return-zero-cost-discard` — were landed as direct INFRA/bug-fix commits with no formal WP, so they fill the **Decision** cell only (WP stays blank — the honest state, per the map's "show blank rather than guess" rule). Rows that are legitimately `unsupported` / `unmarked` / `deferred` (nothing implemented them) stay blank — correctly. No gameplay, player-facing, or public surface changes; both viewers are internal operator tools behind the existing dashboard auth gate. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The provenance map exists and does NOT yet carry a `draw` key (the sentinel of this backfill).
node -e "const m=require('./scripts/coverage/mechanic-provenance.json').mechanics; if('draw'in m) process.exit(1); console.log('A_OK keys='+Object.keys(m).length);"
# Expected: A_OK keys=<n>  (if `draw` already present, this WP already ran — STOP)

# B. The hero ledger shows `draw` executable-but-unattributed (the symptom this fixes).
node -e "const d=require('./docs/ai/coverage/hero-mechanic-ledger.json'); const r=d.rows.find(r=>r.extId==='asrd/warriors-three-the'&&r.mechanic==='draw'); if(!r||r.status!=='executable'||r.wp!==''||r.handler==='') process.exit(1); console.log('B_OK handler='+r.handler);"
# Expected: B_OK handler=packages/game-engine/src/hero/heroEffects.execute.ts#draw

# C. The villain ledger reads the SAME provenance map (so it regenerates too).
node -e "const s=require('fs').readFileSync('./scripts/villain-mechanic-ledger.mjs','utf8'); process.exit(s.includes('mechanic-provenance.json')?0:1);" && echo "C_OK"
# Expected: C_OK

# D. Both viewers + the index are present (the surfaces this WP fills).
test -f data/metadata/effect-implementation-index.json && test -f apps/dashboard/src/pages/debug/EffectsPage.vue && test -f apps/dashboard/src/pages/coverage/CoveragePage.vue && echo "D_OK"
# Expected: D_OK

# E. Every decision this WP cites already exists in DECISIONS.md (no fabricated id).
node -e "const fs=require('fs'),t=fs.readFileSync('./docs/ai/DECISIONS.md','utf8'); const ids=['D-2201','D-21501','D-24060','D-24074','D-24156','D-24183','D-24184','D-24139','D-24099','D-24132','D-24133','D-24130','D-24267','D-24281','D-24287','D-24270']; const miss=ids.filter(id=>!t.includes(id)); if(miss.length){console.error('MISSING '+miss.join(','));process.exit(1);} console.log('E_OK all '+ids.length+' decisions exist');"
# Expected: E_OK all 16 decisions exist
```

If A fails the backfill already ran — STOP. If E fails a cited decision id is wrong — STOP and re-trace before editing.

---

## Context (Read First)

- **The blank is a provenance gap, not a code gap.** `scripts/hero-mechanic-ledger.mjs` and `scripts/villain-mechanic-ledger.mjs` both build their `wp` / `decision` columns by looking the mechanic name up in `scripts/coverage/mechanic-provenance.json` — `const entry = provenance[mechanic] ?? {}; ... wp: entry.wp ?? '', decision: entry.decision ?? ''`. A mechanic absent from the map yields `""` in both columns. `scripts/build-effect-implementation-index.mjs` then passes those columns through VERBATIM into `data/metadata/effect-implementation-index.json`, which both viewers read. So a blank WP/Decision on `/debug/effects` for an `executable` row means only that the mechanic is not a key in the map.
- **The map is incrementally backfilled by design.** Its own header comment reads: *"A missing key (or empty string) means 'not yet attributed' — the ledger shows it blank rather than guessing… Only mappings confirmed from WORK_INDEX / STATUS are seeded below; the rest await backfill."* The map was seeded from the WPs that happened to touch it; the foundational MVP keywords (`draw`, `rescue`, `undercover`, `size-changing`, the `gain-wound` pair, `ko-wound-reward`, …) and four recent villain primitives were implemented by WPs that never edited the map. This WP is that awaited backfill.
- **Every attribution is traced to a real commit — no guessing.** Each of the 17 entries was located by `git log -S<handler>` / DECISIONS.md heading, and the operator ruled the four ambiguous cases (see Contract). Four mechanics (the three HQ-bottom zone-manipulation ones — `put-any-number-bottom-hq`, `put-bottom-hq-icon-reward`, `optional-put-bottom-hq` — plus `return-zero-cost-discard`) were landed as direct INFRA/bug-fix commits with **no formal WP** — they carry a governing Decision only, so their `wp` is `""` (the honest state; the map's "blank rather than guess" rule applies to the WP column just as it does to a missing mechanic). (`return-zero-cost-discard` landed via INFRA `62648c7f`/D-24139; WP-353 is an unrelated Friend-Request-Email packet, not its origin.)
- **Verbatim pass-through means no generator change.** The generators already read `wp` / `decision` from the map and emit them unchanged. Adding keys to the map is the entire mechanism — the hero ledger, the villain ledger, and the effect index fill automatically on regeneration. No `.mjs`, no schema, no `.vue` file is touched.
- **The map feeds BOTH ledgers.** `PROVENANCE_PATH` resolves to `scripts/coverage/mechanic-provenance.json` in both `hero-mechanic-ledger.mjs` and `villain-mechanic-ledger.mjs`, so a single map edit regenerates `hero-mechanic-ledger.{json,csv}`, `villain-mechanic-ledger.{json,csv}`, and (downstream) `data/metadata/effect-implementation-index.json`. All three are CI-gated (`ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`).
- **Row identity is untouched; only two cells per affected row change.** The backfill adds no rows, removes no rows, and reorders nothing. For the 173 affected rows it fills `wp` and/or `decision` (previously `""`); every other row — and every other field of the affected rows — is byte-identical. The ledger `summary`, the `/coverage` metrics, and `card-mechanics.json` are all unaffected (none of them read `wp` / `decision`).
- **No new Decision.** This WP records existing history; it locks no new design choice. The 16 cited decision ids all predate it (precondition E asserts they exist). No `D-NNNNN` is reserved.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the provenance map + ledger/index generators are build-time Shared Tooling reading committed data; no runtime layer edge is touched. `docs/ai/DECISIONS.md D-24289` (the effect index) and the two viewer WPs are the consuming context.
- **WP-491 already landed (#1192, 2026-08-03) — regenerate on top of it.** WP-491 added an additive `designs` column to the SAME hero ledger (`schemaVersion` now 2) + effect index. The two changes are orthogonal: WP-491 added a per-row `designs` array; this fills the `wp`/`decision` cells. The verbatim pass-through is unchanged, so this backfill's regeneration simply carries WP-491's `designs` column forward while filling `wp`/`decision`. At execution, build against current `main` (post-WP-491) so the regenerated ledger + index keep both `designs` and the backfilled attributions.

---

## Scope (In)

- **Modify `scripts/coverage/mechanic-provenance.json`** — add the 17 traced mechanic keys to the `mechanics` object, each `{ "wp": "...", "decision": "..." }` per the Contract table below. The four decision-only mechanics (the three HQ-bottom zone-manipulation ones + `return-zero-cost-discard`) carry `"wp": ""` with a filled `"decision"`. Keep the existing keys and the `_comment` unchanged; the file stays valid JSON (`schemaVersion: 1`).
- **Regenerate `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`** via `pnpm ledger:heroes`; commit them. `pnpm ledger:heroes:check` must pass. The 162 hero rows across the 13 backfilled mechanics gain `wp` / `decision`; every other row and the `summary` are byte-identical.
- **Regenerate `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`** via `pnpm ledger:villains`; commit them. `pnpm ledger:villains:check` must pass. The 11 villain rows across the 4 backfilled mechanics gain `wp` / `decision`; every other row and the `summary` are byte-identical.
- **Regenerate `data/metadata/effect-implementation-index.json`** via `pnpm effect-index`; commit it. `pnpm effect-index:check` must pass; the file self-validates against `EffectImplementationIndexSchema` (unchanged — `wp` / `decision` are already string fields).

## Out of Scope

- **Any generator, schema, or dashboard-source change** — `hero-mechanic-ledger.mjs`, `villain-mechanic-ledger.mjs`, `build-effect-implementation-index.mjs`, `packages/registry/src/schema.ts`, and every `apps/dashboard` `.vue`/`.ts` file are untouched. The fill flows through the existing verbatim pass-through.
- **Attributing non-executable rows** — `unsupported` / `unmarked` / `deferred` rows have no implementing WP, so they stay blank. This WP fills only mechanics that are `executable` with a live handler (17 mechanics; 173 rows).
- **Re-tracing or changing an already-attributed mechanic** — the existing map keys (`reveal`, `ko-hero`, `berserk`, `wall-crawl`, the WP-185 villain camelCase keys, …) are unchanged.
- **Inventing a WP for the four decision-only mechanics** — `put-any-number-bottom-hq`, `put-bottom-hq-icon-reward`, `optional-put-bottom-hq`, and `return-zero-cost-discard` had no formal WP; their `wp` stays `""` (Decision only). No back-dated WP is fabricated, and `return-zero-cost-discard` is NOT attributed to WP-353 (that is an unrelated Friend-Request-Email packet).
- **A new Decision (`D-NNNNN`)** — this WP cites only existing historical decisions; it locks nothing new.
- **Card data / markers / the engine / server / arena-client / registry-viewer** — no `data/cards/**`, `scripts/convert-cards/**`, marker-apply pass, `packages/game-engine`, `apps/server`, `apps/arena-client`, or `apps/registry-viewer` file. No `G`/`ctx`/RNG/replay/scoring/persistence surface.
- **`card-mechanics.json`** — its Set-based read ignores `wp` / `decision`, so it stays byte-identical (this WP only confirms its `:check` stays green after the ledger regen).

---

## Files Expected to Change

- `scripts/coverage/mechanic-provenance.json` — **modified** (17 mechanic keys added; existing keys + `_comment` unchanged)
- `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv` — **regenerated** (`pnpm ledger:heroes`)
- `docs/ai/coverage/villain-mechanic-ledger.json` + `.csv` — **regenerated** (`pnpm ledger:villains`)
- `data/metadata/effect-implementation-index.json` — **regenerated** (`pnpm effect-index`)
- `docs/ai/STATUS.md` — **modified** (Done entry)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (status flip)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (status flip)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (flip the WP-493 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

1 source file (the provenance map) + 5 regenerated artifacts (2 hero-ledger + 2 villain-ledger + the index) + 4 governance. Zero code/test files. Data-only, strictly additive to the map. Regenerates THREE CI-gated artifacts (hero ledger, villain ledger, index) → NOT lightweight-lane eligible (the WP-491 precedent: multiple regenerated CI-gated artifacts take the standard lane); standard two-session lane.

---

## Non-Negotiable Constraints

- **Read-only provenance, verbatim.** Every `wp` / `decision` value is copied verbatim from a traced origin commit (Contract table); nothing is inferred, synthesized, or back-dated. A wrong citation is worse than a blank — the map's rule is "show blank rather than guess."
- **Data-only — no code is authored.** The verbatim pass-through in the generators IS the mechanism; do not edit `hero-mechanic-ledger.mjs`, `villain-mechanic-ledger.mjs`, `build-effect-implementation-index.mjs`, `packages/registry/src/schema.ts`, or any `apps/dashboard` file. Human-style code discipline per `docs/ai/REFERENCE/00.6-code-style.md` is inert here (no functions, imports, or error messages are written); the only hand-edited file is the JSON provenance map, which stays valid JSON with its existing 2-space indent and `_comment`.
- **Fill only `executable` mechanics with a live handler.** `unsupported` / `unmarked` / `deferred` rows have no implementing WP and MUST stay blank.
- **Row identity is untouched.** No row is added, removed, or reordered; only the `wp` / `decision` cells of the 173 affected rows change. Both ledger `summary` blocks and `card-mechanics.json` stay byte-identical.
- **Reserve no new Decision.** Every cited `D-` id predates this WP; `docs/ai/DECISIONS.md` is not modified.
- **Determinism-inert.** Build-time coverage artifacts only; no `G` / `ctx` / RNG / replay / hash surface; no `finalStateHash` / `PRE_WP080_HASH` re-pin.

## Contract (the traced attribution — no new Decision)

This WP records existing provenance; it locks no new design choice, so it reserves no `D-NNNNN`. The 17 keys added to `scripts/coverage/mechanic-provenance.json`:

**Hero (13 mechanics):**

| mechanic | wp | decision | origin evidence |
|---|---|---|---|
| `draw` | `WP-022` | `D-2201` | EC-022 `99a5c199` "execute hero keywords for draw, attack, recruit, ko" |
| `rescue` | `WP-215` | `D-21501` | EC-247 `b95295a9` "hero rescue and reveal-draw effects (WP-215)" |
| `undercover` | `WP-282` | `D-24060` | `heroEffects.execute.ts` "D-24060 / WP-282 — undercover executes…" |
| `size-changing` | `WP-290` | `D-24074` | WORK_INDEX WP-290; EC-322 class-grant on play |
| `gain-wound-self` | `WP-364` | `D-24156` | `17597cfe` WP-364/EC-395; DECISIONS D-24156 |
| `gain-wound-each` | `WP-364` | `D-24156` | same shared handler (`heroEffectGainWound`, D-24156) |
| `ko-wound-reward` | `WP-382` | `D-24183` | `4ed649ff` "draft WP-382 + EC-411 … reserves D-24183" |
| `discard-to-play` | `WP-383` | `D-24184` | WORK_INDEX WP-383 "D-24184 (mechanic)" |
| `return-zero-cost-discard` | `""` | `D-24139` | `62648c7f` INFRA (no WP) "return-a-0-cost-card-from-discard (D-24139)" |
| `victory-villain-attack` | `WP-285` | `D-24099` | `f1f8f67a` WP-285 executor; UX completed WP-313/D-24099 |
| `put-any-number-bottom-hq` | `""` | `D-24132` | `60b4ec7a` INFRA (no WP); D-24132 |
| `put-bottom-hq-icon-reward` | `""` | `D-24133` | `321e4f05` INFRA (no WP); D-24133 |
| `optional-put-bottom-hq` | `""` | `D-24130` | `2125aab0` bug-fix (no WP); D-24130 |

**Villain (4 mechanics):**

| mechanic | wp | decision | origin evidence |
|---|---|---|---|
| `scry-ko-own-deck` | `WP-447` | `D-24267` | `5b086f66` EC-482 [WP-447]; DECISIONS D-24267 |
| `reveal-or-wound` | `WP-469` | `D-24281` | `371345d5` WP-469; DECISIONS D-24281 |
| `become-scheme-twist` | `WP-481` | `D-24287` | `f1430f9a` WP-481/EC-516 [D-24287] |
| `gain-attached-hero` | `WP-450` | `D-24270` | `f6d03070` "draft WP-450 + EC-485 + D-24270" |

**Operator rulings (2026-08-03) baked into the table above:** `draw` → `D-2201` (the "these keywords execute" decision, not the draw-specific `D-2205`); `victory-villain-attack` → `WP-285` executor + `D-24099` (the governing pending-pick decision, since WP-285 reserved no dedicated mechanic-D); four mechanics → **Decision-only** (the three HQ-bottom zone-manipulation mechanics **and** `return-zero-cost-discard` — their `wp` stays `""` because each landed as an INFRA/bug-fix commit with no formal WP; `return-zero-cost-discard`'s D-24139 landed via INFRA `62648c7f`, and WP-353 is an unrelated Friend-Request-Email server packet, so it is Decision-only, not a WP-353 attribution).

### Determinism / persistence

N/A to gameplay. The provenance map, the two ledgers, and the index touch no `G`/`ctx`/RNG/replay/scoring/persistence surface. All three artifacts are deterministic build-time outputs (byte-stable given the map + in-repo card data). No `finalStateHash` / `PRE_WP080_HASH` re-pin.

### Code-style / output discipline

Data-only edit. The provenance map is hand-edited JSON (valid JSON, existing 2-space indent, `_comment` preserved); the ledgers and index are generator output, not hand-authored. No `.mjs`/`.ts`/`.vue` change, so no code-style surface. Full-file emission is N/A (JSON data + generator output).

---

## Acceptance Criteria

1. `scripts/coverage/mechanic-provenance.json` parses as valid JSON and its `mechanics` object gains exactly the 17 keys in the Contract table (existing keys + `_comment` unchanged); the four decision-only keys (`put-any-number-bottom-hq`, `put-bottom-hq-icon-reward`, `optional-put-bottom-hq`, `return-zero-cost-discard`) carry `"wp": ""` with a non-empty `"decision"`.
2. `pnpm ledger:heroes` regenerates `hero-mechanic-ledger.{json,csv}`; `pnpm ledger:heroes:check` exits 0 and a second run is byte-stable. The `asrd/warriors-three-the` `draw` row now carries `wp: "WP-022"` / `decision: "D-2201"`.
3. Every `executable` hero row for the 13 backfilled mechanics carries the Contract `wp` / `decision` (the four decision-only mechanics carry `decision` with `wp: ""`); no `executable` hero row for those mechanics remains blank on both columns; the ledger `summary` block and every non-backfilled row are byte-identical to the pre-WP ledger.
4. `pnpm ledger:villains` regenerates `villain-mechanic-ledger.{json,csv}`; `pnpm ledger:villains:check` exits 0 and is byte-stable. The 11 villain rows across `scry-ko-own-deck` / `reveal-or-wound` / `become-scheme-twist` / `gain-attached-hero` carry the Contract `wp` / `decision`; the `summary` and every other row are byte-identical.
5. No `unsupported` / `unmarked` / `deferred` row anywhere in either ledger gains a `wp` or `decision` (only `executable` rows for the 17 backfilled mechanics change).
6. `pnpm effect-index` regenerates `data/metadata/effect-implementation-index.json`; `pnpm effect-index:check` exits 0 and the index self-validates against `EffectImplementationIndexSchema`. The 173 affected entries carry the backfilled `wp` / `decision`; `version`, `summary`, `cards{}`, and all non-affected entries are byte-identical.
7. `card-mechanics.json` is byte-identical after `node scripts/build-card-mechanics-metadata.mjs` (`git diff --exit-code` = 0) — it does not read `wp` / `decision`.
8. Every cited decision id resolves in `docs/ai/DECISIONS.md` (precondition E re-run exits 0) — no fabricated id.
9. `/debug/effects` and `/coverage` render the backfilled `wp` / `decision` for the affected rows (e.g. Warriors Three `draw` → `WP-022` / `D-2201`); rows that are legitimately `unsupported` / `unmarked` stay blank.
10. `pnpm -r build` and `pnpm -r --no-bail test` exit 0; no `packages/game-engine`, `apps/server`, `apps/arena-client`, `apps/registry-viewer`, generator `.mjs`, or schema file is modified; no `finalStateHash` / `PRE_WP080_HASH` re-pin occurs.

---

## Verification Steps

```bash
# 0. Build first (the ledger generators import registry + engine dist)
pnpm -r build

# 1. Provenance map valid + 17 keys added (AC-1)
node -e "const m=require('./scripts/coverage/mechanic-provenance.json').mechanics; const need=['draw','rescue','undercover','size-changing','gain-wound-self','gain-wound-each','ko-wound-reward','discard-to-play','return-zero-cost-discard','victory-villain-attack','put-any-number-bottom-hq','put-bottom-hq-icon-reward','optional-put-bottom-hq','scry-ko-own-deck','reveal-or-wound','become-scheme-twist','gain-attached-hero']; const miss=need.filter(k=>!(k in m)); if(miss.length){console.error('MISSING '+miss);process.exit(1);} for(const k of ['put-any-number-bottom-hq','put-bottom-hq-icon-reward','optional-put-bottom-hq','return-zero-cost-discard']){if(m[k].wp!==''||!m[k].decision){console.error('decision-only broken: '+k);process.exit(1);}} console.log('AC1 OK 17 keys');"

# 2. Regenerate hero ledger; Warriors Three draw attributed (AC-2/3)
pnpm ledger:heroes && pnpm ledger:heroes:check
node -e "const d=require('./docs/ai/coverage/hero-mechanic-ledger.json'); const r=d.rows.find(r=>r.extId==='asrd/warriors-three-the'&&r.mechanic==='draw'); console.log('warriors-three draw:', r.wp, r.decision); if(r.wp!=='WP-022'||r.decision!=='D-2201') process.exit(1);"

# 3. No executable-missing hero rows remain for the backfilled mechanics (AC-3)
node -e "const d=require('./docs/ai/coverage/hero-mechanic-ledger.json'); const back=new Set(['draw','rescue','undercover','size-changing','gain-wound-self','gain-wound-each','ko-wound-reward','discard-to-play','return-zero-cost-discard','victory-villain-attack','put-any-number-bottom-hq','put-bottom-hq-icon-reward','optional-put-bottom-hq']); const bad=d.rows.filter(r=>r.status==='executable'&&back.has(r.mechanic)&&r.wp===''&&r.decision===''); console.log('still-blank hero rows (expect 0):', bad.length); process.exit(bad.length?1:0);"

# 4. Regenerate villain ledger; 4 primitives attributed (AC-4)
pnpm ledger:villains && pnpm ledger:villains:check
node -e "const d=require('./docs/ai/coverage/villain-mechanic-ledger.json'); const want={'scry-ko-own-deck':'WP-447','reveal-or-wound':'WP-469','become-scheme-twist':'WP-481','gain-attached-hero':'WP-450'}; const bad=d.rows.filter(r=>r.status==='executable'&&want[r.mechanic]&&r.wp!==want[r.mechanic]); console.log('mis-attributed villain rows (expect 0):', bad.length); process.exit(bad.length?1:0);"

# 5. Regenerate index + gate + self-validate (AC-6)
pnpm effect-index && pnpm effect-index:check

# 6. card-mechanics.json byte-identical (AC-7)
node scripts/build-card-mechanics-metadata.mjs && git diff --exit-code data/metadata/card-mechanics.json ; echo "card-mechanics unchanged (expect exit 0)"

# 7. All cited decisions exist (AC-8)
node -e "const t=require('fs').readFileSync('./docs/ai/DECISIONS.md','utf8'); const ids=['D-2201','D-21501','D-24060','D-24074','D-24156','D-24183','D-24184','D-24139','D-24099','D-24132','D-24133','D-24130','D-24267','D-24281','D-24287','D-24270']; const miss=ids.filter(id=>!t.includes(id)); if(miss.length){console.error('MISSING '+miss);process.exit(1);} console.log('AC8 OK');"

# 8. No out-of-scope file touched (AC-10)
git diff --name-only | grep -E '(\.mjs$)|(packages/(game-engine|registry))|(apps/(server|arena-client|registry-viewer|dashboard))' ; echo "hits above (expect none — only the provenance JSON + regenerated artifacts + governance)"

# 9. Full build/test + no re-pin (AC-10)
pnpm -r build && pnpm -r --no-bail test
# Expected: both exit 0; replay/sentinel suites green with no oracle edit

# 10. Live render (post-deploy; D-24026): load the deployed dashboard /debug/effects, search "Warriors Three",
#     confirm the draw row shows WP-022 / D-2201; spot-check a villain row (e.g. Doombot Legion scry-ko-own-deck → WP-447 / D-24267).
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] All preconditions (A–E) passed before the edit
- [ ] All 10 Acceptance Criteria pass
- [ ] All 10 Verification Steps produce the expected output (Step 10 is the post-deploy live check)
- [ ] `scripts/coverage/mechanic-provenance.json` carries the 17 traced keys (4 decision-only); existing keys + `_comment` unchanged; valid JSON
- [ ] Hero + villain ledgers regenerated; the 173 affected rows carry `wp` / `decision`; both `summary` blocks + all non-affected rows byte-identical; `ledger:heroes:check` + `ledger:villains:check` green
- [ ] `data/metadata/effect-implementation-index.json` regenerated + self-validates; `effect-index:check` green; `version` / `summary` / `cards{}` unchanged
- [ ] `card-mechanics.json` byte-identical; no `unsupported`/`unmarked`/`deferred` row gained an attribution; no generator/schema/dashboard/engine file modified
- [ ] No `finalStateHash` / `PRE_WP080_HASH` re-pin (replay/sentinel suites green with no oracle edit)
- [ ] `docs/ai/STATUS.md` Done entry names WP-493 + the fill, records the D-24026 live-verify as operator-pending (`User-Visible Surface = dashboard /debug/effects + /coverage`)
- [ ] No `DECISIONS.md` change (this WP lands no new decision); every cited id verified present
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-493 node flipped `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-528:` for the regen, `SPEC:` for governance close
- [ ] D-24026 live-verification: the backfilled columns confirmed rendering on the deployed dashboard (operator-pending; the packet is not user-Done until this passes)

---

## Gate Verdicts (drafting session)

All three gates ran as **independent subagents** against this WP + EC-528, each verifying claims against the actual repo (not the WP's prose). The first round caught one real defect — the `return-zero-cost-discard` → `WP-353` mis-attribution — which was corrected to Decision-only (`wp: ""` / `D-24139`) across every artifact; the gates were then re-confirmed against the revision.

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-03; first round NOT READY on PS-1, resolved)

All preconditions A–E verified empirically. The load-bearing claim — verbatim pass-through — was confirmed against the generator code: `buildRow` in both `hero-mechanic-ledger.mjs:353-366` and `villain-mechanic-ledger.mjs:309-325` reads `wp`/`decision` from the map (`provenance[mechanic] ?? {}`), and `build-effect-implementation-index.mjs` passes them through verbatim; both ledgers resolve `scripts/coverage/mechanic-provenance.json`. The 17 keys are absent from the current map; each maps to an `executable` row with a live handler (162 hero across 13 mechanics + 11 villain across 4 — counts confirmed); all 16 cited decision ids exist; the hard-deps (WP-484/487/259) are Done on main; determinism-inert (no G/hash surface). **PS-1 (blocking, resolved):** `return-zero-cost-discard` was attributed to `WP-353`, but WP-353 is the unrelated Friend-Request-Email packet — the mechanic landed via INFRA `62648c7f` (D-24139, no WP), so it is a fourth Decision-only mechanic (`wp: ""`). Corrected in-place. RS execution-ordering constraint (in the EC): regenerate `ledger:heroes` → `ledger:villains` → `effect-index` (the index reads the two committed ledgers).

### Copilot (`01.7`) — verdict: **PASS** (2026-08-03; first round BLOCK/HOLD on the same PS-1, then RISK on stale sub-counts, both resolved)

The mis-attribution is the exact failure the map's "show blank rather than guess" rule exists to prevent — a wrong citation is worse than a blank. Fixed: no stray `WP-353` attribution remains (every occurrence is now a corrective "do NOT cite WP-353" note; the WORK_INDEX/EC_INDEX `WP-353` hits are the legitimate unrelated packet). The other 16 attributions verified clean against DECISIONS.md headings + cited commit subjects. Aggregate-preservation confirmed against consumer code (`summary` reads only `status`/`mechanic`; `build-card-mechanics-metadata.mjs` never reads `wp`/`decision`); decision-only honesty, allowlist completeness, determinism, and layer posture all hold; standard-two-session lane correct. The follow-up RISK (three stale "3 decision-only" sub-counts after the fix) was corrected to "4" everywhere.

### Lint Gate (`00.3`) — verdict: **SATISFIED (21/21)** (2026-08-03)

19 sections clean PASS-or-justified-N/A on first pass; §1/§2 resolved by adding a `## Non-Negotiable Constraints` section that cites `docs/ai/REFERENCE/00.6-code-style.md` (folded-Contract convention aligned with the WP-491 precedent). All named scripts/files/gates verified real (`ledger:heroes:check`, `ledger:villains:check`, `effect-index:check` exist in `package.json`; all 13 named files present); no fabricated symbol; §4 (00.2), §20 (funding), §21 (API) correctly N/A; the WP carries `## Lint Gate Self-Review` + `## Vision Alignment`.

## Lint Gate Self-Review

All 21 sections resolved (19 PASS / 2 resolved-via-fix; 3 N/A folded into those where applicable) per the re-run above.

- **§1 / §2 (structure + non-negotiable constraints):** RESOLVED — the WP carries a `## Non-Negotiable Constraints` section citing `docs/ai/REFERENCE/00.6-code-style.md` (code-style surface inert — no code authored).
- **§4 (00.2 disposition):** **N/A — derived-artifact backfill; `wp`/`decision` are pre-existing ledger string columns; introduces no card-data or match-setup field.** `docs/ai/REFERENCE/00.2-data-requirements.md` cited here for this disposition.
- **§10 (env vars):** N/A — data-map edit + regenerated artifacts; no env var.
- **§11 (auth):** N/A — both viewers inherit the existing dashboard auth gate; no new role/meta.
- **§19 (bridge-vs-HEAD):** N/A for lint — commit-time discipline (the STATUS entry is authored at execution against live HEAD).
- **§17 / §20 / §21:** present and resolved in their dedicated sections below.
- All remaining sections (§3, §5–§9, §12–§16, §18) PASS as detailed in the Gate Verdicts.

## Vision Alignment

**Vision clauses touched:** §10 (card data / effect semantics — the ledgers are derived, read-only artifacts gaining verbatim provenance in existing string columns; no card semantics change), §22 (determinism — build-time generated artifacts fed by a hand-edited data map; no `G`/RNG/replay surface).

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.` It records existing implementation history into a derived artifact's existing columns and surfaces it in operator-only views — it changes no card semantics, no gameplay behavior, authors no new effect data, and alters no aggregate (row identity + `summary` unchanged).

**Non-Goal proximity check:** none of NG-1..NG-8 are crossed — the ledgers + viewers are internal developer/operator debugging surfaces carrying no monetization, persuasion, pay-to-win, or competitive-integrity surface.

**Determinism preservation:** replay-irrelevant — the ledgers and index are deterministic build-time artifacts (byte-stable given the map + in-repo card data); the viewers read static bundles; no `G`/`ctx`/RNG/scoring/replay surface is touched, so no hash oracle moves.

## Funding Surface Gate

**N/A — no funding surface touched.** No §20.1 trigger: no navigation/registry-viewer funding affordance, no profile/account funding attribution, no tournament-funding integration, no user-visible funding copy. Internal operator-dashboard debugging tooling only. (Authority chain per §20 form: WP-097, D-9701, D-9801.)

## API Catalog Update

**N/A — no API surface touched.** Per lint §21.4: no HTTP endpoint and no `apps/server/src/**` library function added or modified. The change is a build-time data map + regenerated artifacts read by build-time dashboard bundles; `docs/ai/REFERENCE/api-endpoints.md` is unaffected.
