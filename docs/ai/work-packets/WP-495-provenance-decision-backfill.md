# WP-495 — Provenance Decision Backfill (fill the remaining blank Decision cells on /debug/effects)

**Status:** Draft 2026-08-03 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `dashboard /debug/effects` **and** `dashboard /coverage` (the Decision column fills for 75 executable rows that currently show a WP but a blank Decision; D-24026 live-verification applies).
**Primary Layer:** Shared Tooling (the `scripts/coverage/mechanic-provenance.json` map + the ledger/index generators that read it). Data-only; no code, schema, engine, server, or dashboard-source change.
**Dependencies:** WP-493 / EC-528 (the provenance backfill this extends — same map, same mechanism); WP-484 / D-24289 (the `effect-implementation-index.json` this feeds); WP-259 / D-24035 + WP-487 / D-24292 (the `/coverage` + `/debug/effects` viewers).

---

## Goal

After WP-493, the only executable rows still rendering a blank **Decision** on `/debug/effects` and `/coverage` are the six provenance-map entries that carry a Work Packet but an empty `decision` string — a WP was attributed, but the governing DECISIONS id never was. This WP fills that last gap: it sets the `decision` value on those six existing map keys (the `wp` values are already present and unchanged), then regenerates the two mechanic ledgers + the effect index that read the map verbatim. 75 executable rows across 5 rendered mechanics gain their Decision (plus one map key, `gainWoundCurrentPlayer`, with no current card row — filled for map hygiene). It authors no code, no schema, and no viewer change — the fill flows through the same verbatim pass-through WP-493 used.

## User-Visible Impact

An operator on `/debug/effects` or `/coverage` inspecting one of these executable rows — e.g. a villain `koHeroCurrentPlayer` row showing `WP-185` / `—` — now sees `WP-185` / `D-18503`. 75 rows fill: `koHeroCurrentPlayer` (54, villain), `gainWoundEachPlayer` (14, villain), `optional-ko-reward` (3, hero), `attack-per-count` (2, hero), `heroDeckTopToEscape` (2, villain). No row that is legitimately blank (an `unsupported`/`unmarked` row, or a decision-only WP-493 mechanic whose `wp` is intentionally `""`) is touched. No gameplay, player-facing, or public surface changes.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. WP-493 has landed (this WP extends its map): the `draw` key is present with a decision.
node -e "const m=require('./scripts/coverage/mechanic-provenance.json').mechanics; if(!('draw'in m)||m.draw.decision!=='D-2201') process.exit(1); console.log('A_OK WP-493 present');"
# Expected: A_OK WP-493 present  (if `draw` absent, WP-493 has not landed — STOP)

# B. The six target keys exist with wp filled but decision empty (the exact gap this fills).
node -e "const m=require('./scripts/coverage/mechanic-provenance.json').mechanics; const t=['koHeroCurrentPlayer','gainWoundEachPlayer','gainWoundCurrentPlayer','heroDeckTopToEscape','attack-per-count','optional-ko-reward']; const bad=t.filter(k=>!m[k]||!m[k].wp||m[k].decision!==''); if(bad.length){console.error('not blank-decision-with-wp: '+bad.join(','));process.exit(1);} console.log('B_OK all 6 targets are wp-filled/decision-empty');"
# Expected: B_OK all 6 targets are wp-filled/decision-empty

# C. Every cited decision exists in DECISIONS.md (no fabricated id).
node -e "const t=require('fs').readFileSync('./docs/ai/DECISIONS.md','utf8'); const ids=['D-18502','D-18503','D-24016','D-24019']; const miss=ids.filter(id=>!t.includes(id)); if(miss.length){console.error('MISSING '+miss);process.exit(1);} console.log('C_OK all 4 decisions exist');"
# Expected: C_OK all 4 decisions exist

# D. Both viewers + the index are present.
test -f data/metadata/effect-implementation-index.json && test -f apps/dashboard/src/pages/debug/EffectsPage.vue && echo "D_OK"
# Expected: D_OK
```

If A fails, WP-493 has not landed — STOP. If B fails, the map shape changed — STOP and reconcile before editing.

---

## Context (Read First)

- **This is the last slice of the provenance backfill begun in WP-493.** WP-493 added 17 previously-unattributed mechanic keys. Six OTHER keys were attributed to a WP long ago but never carried a DECISIONS id (their `decision` is `""`): the four WP-185 villain fight-effect keywords (`koHeroCurrentPlayer`, `gainWoundEachPlayer`, `gainWoundCurrentPlayer`, `heroDeckTopToEscape`) and the two count-scaled hero frameworks (`attack-per-count` from WP-247, `optional-ko-reward` from WP-248). Each renders `WP-xxx` / `—` on the dashboard today.
- **The blank is a provenance gap, not a code gap.** Both ledger generators build the `decision` column by reading `provenance[mechanic].decision` verbatim (`buildRow`). A key with `decision: ""` yields `—`. Filling the value is the entire fix; the generators pass it through unchanged.
- **Every decision is traced to its DECISIONS.md heading — no guessing.** `koHeroCurrentPlayer` → **D-18503** ("koHeroCurrentPlayer Resolves by Zone + ext_id Over Non-Wound Cards") — its mechanic-specific decision, mirroring the existing `captureBystander` → D-18506 attribution (specific over umbrella). `gainWoundEachPlayer` / `gainWoundCurrentPlayer` / `heroDeckTopToEscape` → **D-18502** ("Villain Effect Vocabulary Locked to Five Keywords", Packet WP-185) — the decision that literally defines these five keywords; no mechanic-specific D exists for them, so the governing vocabulary-lock decision is the correct attribution, not a guess. `attack-per-count` → **D-24016** ("Count-Scaled Hero Attack Framework — attack-per-count Keyword", WP-247). `optional-ko-reward` → **D-24019** ("Optional-KO-then-Reward Hero Effect Framework — optional-ko-reward Keyword", WP-248).
- **`wp` is unchanged.** These six keys already carry the correct `wp`; only the empty `decision` is filled. No `wp` value moves.
- **Row identity is untouched.** No row added, removed, or reordered; only the `decision` cell of the 75 affected rows changes (previously `""`). Every other row and every other field is byte-identical; the ledger `summary` blocks and `card-mechanics.json` are unaffected (none read `decision`).
- **No new Decision.** This WP records existing history; the four cited ids all predate it (precondition C). No `D-NNNNN` is reserved.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the provenance map + generators are build-time Shared Tooling reading committed data; no runtime layer edge is touched.

---

## Non-Negotiable Constraints

- **Read-only provenance, verbatim.** Each filled `decision` is copied from a traced DECISIONS.md heading (Contract table); nothing is inferred or fabricated. A wrong citation is worse than a blank.
- **Data-only — no code is authored.** The verbatim pass-through IS the mechanism; do not edit any generator (`hero-mechanic-ledger.mjs`, `villain-mechanic-ledger.mjs`, `build-effect-implementation-index.mjs`), `packages/registry/src/schema.ts`, or any `apps/dashboard` file. Human-style code discipline per `docs/ai/REFERENCE/00.6-code-style.md` is inert here (no functions/imports/error messages); the only hand-edited file is the JSON provenance map (valid JSON, existing 2-space indent + `_comment`).
- **Fill only the six target keys' `decision`.** Do not add new keys, do not change any `wp`, do not touch keys whose `decision` is already set or whose `wp` is intentionally `""` (the WP-493 decision-only mechanics).
- **Row identity is untouched.** Only the `decision` cell of the 75 affected rows changes; both ledger `summary` blocks and `card-mechanics.json` stay byte-identical.
- **Reserve no new Decision.** Every cited `D-` id predates this WP; `docs/ai/DECISIONS.md` is not modified.
- **Determinism-inert.** Build-time coverage artifacts only; no `G`/`ctx`/RNG/replay/hash surface; no `finalStateHash`/`PRE_WP080` re-pin.

## Scope (In)

- **Modify `scripts/coverage/mechanic-provenance.json`** — set the `decision` on the six existing keys per the Contract table (leave their `wp` and every other key unchanged; `_comment` unchanged; valid JSON, `schemaVersion: 1`).
- **Regenerate `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`** via `pnpm ledger:heroes`; `ledger:heroes:check` passes. The `attack-per-count` + `optional-ko-reward` hero rows gain their `decision`; every other row + the `summary` are byte-identical.
- **Regenerate `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`** via `pnpm ledger:villains`; `ledger:villains:check` passes. The `koHeroCurrentPlayer` / `gainWoundEachPlayer` / `heroDeckTopToEscape` villain rows gain their `decision`; every other row + the `summary` are byte-identical.
- **Regenerate `data/metadata/effect-implementation-index.json`** via `pnpm effect-index`; `effect-index:check` passes; the file self-validates.

## Out of Scope

- **Any generator, schema, or dashboard-source change** — the fill flows through the existing verbatim pass-through.
- **Adding keys or changing a `wp`** — this WP only fills the empty `decision` on six existing keys.
- **Touching WP-493's decision-only mechanics** (`return-zero-cost-discard`, the 3 zone-manip keys) — their `wp` is intentionally `""` and their `decision` is already set; unchanged.
- **Attributing `unsupported`/`unmarked`/`deferred` rows** — they have no implementing WP; stay blank.
- **A new Decision (`D-NNNNN`)** — cites only existing historical decisions.
- **Card data / markers / engine / server / arena-client / registry-viewer** — no such file. No `G`/RNG/replay/scoring/persistence surface.
- **`card-mechanics.json`** — its Set-based read ignores `decision`; stays byte-identical (confirmed post-regen).

---

## Files Expected to Change

- `scripts/coverage/mechanic-provenance.json` — **modified** (6 `decision` values filled; `wp` + other keys + `_comment` unchanged)
- `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv` — **regenerated** (`pnpm ledger:heroes`)
- `docs/ai/coverage/villain-mechanic-ledger.json` + `.csv` — **regenerated** (`pnpm ledger:villains`)
- `data/metadata/effect-implementation-index.json` — **regenerated** (`pnpm effect-index`)
- `docs/ai/STATUS.md` — **modified** (Done entry)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (status flip)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (status flip)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-495 node `📝`→`✅`; then `pnpm roadmap:counts:write`)

1 source file + 5 regenerated artifacts + 4 governance. Zero code/test files. Regenerates THREE CI-gated artifacts → standard two-session lane (WP-491/WP-493 precedent).

## Contract (the traced attribution — no new Decision)

The six `decision` values set in `scripts/coverage/mechanic-provenance.json` (each key's `wp` is already present and unchanged):

| mechanic | wp (unchanged) | decision (filled) | rows | evidence |
|---|---|---|---|---|
| `koHeroCurrentPlayer` | `WP-185` | `D-18503` | 54 | D-18503 "koHeroCurrentPlayer Resolves by Zone + ext_id" (WP-185; specific, mirrors captureBystander→D-18506) |
| `gainWoundEachPlayer` | `WP-185` | `D-18502` | 14 | D-18502 "Villain Effect Vocabulary Locked to Five Keywords" (WP-185; defines the keyword) |
| `heroDeckTopToEscape` | `WP-185` | `D-18502` | 2 | D-18502 (same vocabulary-lock decision) |
| `gainWoundCurrentPlayer` | `WP-185` | `D-18502` | 0* | D-18502 (map-hygiene; no current card row) |
| `attack-per-count` | `WP-247` | `D-24016` | 2 | D-24016 "Count-Scaled Hero Attack Framework — attack-per-count Keyword" (WP-247) |
| `optional-ko-reward` | `WP-248` | `D-24019` | 3 | D-24019 "Optional-KO-then-Reward Hero Effect Framework — optional-ko-reward Keyword" (WP-248) |

*`gainWoundCurrentPlayer` has no executable card row today (no villain card bears it); its map entry is filled for hygiene.

### Determinism / persistence

N/A to gameplay. The provenance map, the two ledgers, and the index touch no `G`/`ctx`/RNG/replay/scoring/persistence surface. All three artifacts are deterministic build-time outputs. No `finalStateHash`/`PRE_WP080_HASH` re-pin.

### Code-style / output discipline

Data-only edit. The provenance map is hand-edited JSON (valid JSON, existing 2-space indent, `_comment` preserved); the ledgers and index are generator output. No `.mjs`/`.ts`/`.vue` change.

---

## Acceptance Criteria

1. `scripts/coverage/mechanic-provenance.json` parses as valid JSON; the six target keys carry the Contract `decision` and their original `wp`; no other key, and no `_comment`, changed.
2. `pnpm ledger:heroes` + `:check` exit 0, byte-stable; `attack-per-count` and `optional-ko-reward` hero rows carry their `decision` (D-24016 / D-24019); the `summary` block + every other row are byte-identical to the pre-WP ledger.
3. `pnpm ledger:villains` + `:check` exit 0, byte-stable; `koHeroCurrentPlayer` (D-18503), `gainWoundEachPlayer` (D-18502), `heroDeckTopToEscape` (D-18502) villain rows carry their `decision`; the `summary` + every other row are byte-identical.
4. No executable row for any of the six mechanics remains blank on `decision`; no `unsupported`/`unmarked`/`deferred` row, and no WP-493 decision-only row (`wp:""`), is changed.
5. `pnpm effect-index` + `:check` exit 0; the index self-validates against `EffectImplementationIndexSchema`; `version`, `summary`, `cards{}`, and all non-affected entries are byte-identical.
6. `card-mechanics.json` is byte-identical after `node scripts/build-card-mechanics-metadata.mjs` (`git diff --exit-code` = 0).
7. Every cited decision id resolves in `docs/ai/DECISIONS.md` (precondition C re-run exits 0).
8. `pnpm -r build` and `pnpm -r --no-bail test` exit 0; no code/schema/engine/dashboard file modified; no `finalStateHash`/`PRE_WP080` re-pin.

---

## Verification Steps

```bash
# 0. Build first (the ledger generators import registry + engine dist)
pnpm -r build

# 1. Six decisions filled, wp unchanged (AC-1)
node -e "const m=require('./scripts/coverage/mechanic-provenance.json').mechanics; const want={koHeroCurrentPlayer:'D-18503',gainWoundEachPlayer:'D-18502',gainWoundCurrentPlayer:'D-18502',heroDeckTopToEscape:'D-18502','attack-per-count':'D-24016','optional-ko-reward':'D-24019'}; for(const[k,d]of Object.entries(want)){if(m[k].decision!==d){console.error('bad '+k);process.exit(1)}} console.log('AC1 OK'); "

# 2. Regenerate + gates
pnpm ledger:heroes && pnpm ledger:heroes:check
pnpm ledger:villains && pnpm ledger:villains:check
pnpm effect-index && pnpm effect-index:check

# 3. No executable-blank-decision row remains for the six mechanics (AC-4)
node -e "const h=require('./docs/ai/coverage/hero-mechanic-ledger.json').rows; const v=require('./docs/ai/coverage/villain-mechanic-ledger.json').rows; const six=new Set(['koHeroCurrentPlayer','gainWoundEachPlayer','gainWoundCurrentPlayer','heroDeckTopToEscape','attack-per-count','optional-ko-reward']); const bad=[...h,...v].filter(r=>r.status==='executable'&&six.has(r.mechanic)&&(!r.decision||r.decision==='')); console.log('still-blank (expect 0):',bad.length); process.exit(bad.length?1:0);"

# 4. Summaries byte-identical (AC-2/3)
git diff docs/ai/coverage/hero-mechanic-ledger.json docs/ai/coverage/villain-mechanic-ledger.json | grep -E '^[-+].*("totalRows"|"byStatus"|"distinctMechanics")' ; echo "summary drift above (expect none)"

# 5. card-mechanics.json byte-identical (AC-6)
node scripts/build-card-mechanics-metadata.mjs && git diff --exit-code data/metadata/card-mechanics.json ; echo "card-mechanics unchanged (expect exit 0)"

# 6. No out-of-scope file (AC-8)
git diff --name-only | grep -E '(\.mjs$)|(packages/)|(apps/)' ; echo "hits above (expect none)"

# 7. Full build/test (AC-8)
pnpm -r build && pnpm -r --no-bail test

# 8. Live render (post-deploy; D-24026): /debug/effects, a koHeroCurrentPlayer villain row shows WP-185 / D-18503.
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed before the edit
- [ ] All 8 Acceptance Criteria pass
- [ ] All 8 Verification Steps produce the expected output (Step 8 is the post-deploy live check)
- [ ] The six keys carry the traced `decision` (wp unchanged); valid JSON; `_comment` intact
- [ ] Hero + villain ledgers regenerated; the 75 affected rows carry `decision`; both `summary` blocks + all non-affected rows byte-identical; both `:check` green
- [ ] `effect-implementation-index.json` regenerated + self-validates; `effect-index:check` green; `version`/`summary`/`cards{}` unchanged
- [ ] `card-mechanics.json` byte-identical; no non-executable row and no WP-493 decision-only row changed; no code/schema/dashboard/engine file modified
- [ ] No `finalStateHash`/`PRE_WP080` re-pin (replay/sentinel suites green with no oracle edit)
- [ ] `docs/ai/STATUS.md` Done entry names WP-495 + the Decision fill, records D-24026 operator-pending
- [ ] No `DECISIONS.md` change (this WP lands no new decision); every cited id verified present
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-495 node `📝`→`✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-530:` for the regen, `SPEC:` for governance close
- [ ] D-24026 live-verification: the filled Decision cells confirmed on the deployed dashboard (operator-pending)

---

## Gate Verdicts (drafting session)

All three gates ran as **independent subagents** against this WP + EC-530, each verifying the four attributions against DECISIONS.md and the live map (not the WP's prose). No defect surfaced — the tracing held.

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-03)

All preconditions A–D verified empirically. WP-493 is on the base (`draw`→D-2201); exactly the six named keys are `wp`-filled/`decision`-empty (no others); the four WP-493 decision-only keys (`wp:""`) are correctly out of scope. Every attribution matches its DECISIONS heading + packet: D-18503 (koHeroCurrentPlayer, WP-185), D-18502 (the five-keyword vocabulary lock that literally enumerates gainWoundEachPlayer/gainWoundCurrentPlayer/heroDeckTopToEscape, WP-185), D-24016 (attack-per-count, WP-247/EC-278), D-24019 (optional-ko-reward, WP-248/EC-279). The `koHeroCurrentPlayer`→D-18503 (specific) call mirrors the live `captureBystander`→D-18506 convention (specific-when-it-exists, else umbrella) — confirmed. 75 rows across 5 rendered mechanics (koHeroCurrentPlayer 54 / gainWoundEachPlayer 14 / heroDeckTopToEscape 2 / attack-per-count 2 / optional-ko-reward 3); `gainWoundCurrentPlayer` = 0 rows (map-hygiene). Determinism-inert; no re-pin. RS constraint: regen `ledger:heroes` → `ledger:villains` → `effect-index` (index reads the ledgers). Non-blocking note: D-18503 is later amended by D-20602 (SHIELD KO preference); attributing to the root introducing decision D-18503 is correct and matches the captureBystander→D-18506 introducing-decision convention.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-03)

CONFIRM — no RISK/BLOCK. The determinism/mutation/persistence/type half of the lens is structurally inert (data-only, no code). The two load-bearing categories are clean: every `decision`↔`wp` packet linkage is internally consistent and non-fabricated; scope is locked (touches only `decision` on the six, never a `wp`, never a WP-493 decision-only key); aggregate preservation is gated by construction (`summary`/`card-mechanics.json` don't read `decision`). D-18502 for gainWound*/heroDeckTopToEscape is an honest citation to the decision that defines the keyword (not a guess), and the WP is transparent that it is a vocabulary-lock rather than a resolution-semantics decision.

### Lint Gate (`00.3`) — verdict: **SATISFIED (21/21)** (2026-08-03)

18 PASS, 3 N/A (§10 env, §11 auth, §12 tests) + §18/§19 correctly N/A. All named scripts/files/decisions verified real; §4 (00.2), §20 (funding), §21 (API) correctly N/A; the WP carries `## Non-Negotiable Constraints` (citing `00.6-code-style.md`), `## Vision Alignment`, `## Funding Surface Gate`, `## API Catalog Update`, and this `## Lint Gate Self-Review`. No fabricated symbol; the 21/21 header claim is earned.

## Lint Gate Self-Review

All 21 sections resolved per the re-run above (18 PASS / 3 N/A; §18/§19 N/A).

- **§4 (00.2 disposition):** **N/A — derived-artifact backfill; `decision` is a pre-existing ledger string column; introduces no card-data or match-setup field.** `docs/ai/REFERENCE/00.2-data-requirements.md` cited here for this disposition.
- **§10 (env vars):** N/A — data-map edit + regenerated artifacts; no env var.
- **§11 (auth):** N/A — the viewers inherit the existing dashboard auth gate; no new role/meta.
- **§12 (tests):** N/A — authors no test files (runs suites in verification only).
- **§18 (prose-vs-grep):** N/A — the only verification grep runs over `git diff --name-only` (changed paths), not file contents.
- **§19 (bridge-vs-HEAD):** N/A for lint — commit-time discipline (STATUS authored at execution against live HEAD).
- **§17 / §20 / §21:** present and resolved in their dedicated sections.
- All remaining sections (§1–§3, §5–§9, §13–§16) PASS as detailed in the Gate Verdicts.

## Vision Alignment

**Vision clauses touched:** §10 (card data / effect semantics — derived, read-only artifacts gaining verbatim provenance in an existing string column), §22 (determinism — build-time generated artifacts; no `G`/RNG/replay surface).

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.` It records existing implementation history into a derived artifact's existing `decision` column and surfaces it in operator-only views — no card semantics change, no gameplay behavior, no new effect data, no aggregate change (row identity + `summary` unchanged).

**Non-Goal proximity check:** none of NG-1..NG-8 are crossed — internal developer/operator debugging surfaces with no monetization, persuasion, pay-to-win, or competitive-integrity surface.

**Determinism preservation:** replay-irrelevant — deterministic build-time artifacts; the viewers read static bundles; no `G`/`ctx`/RNG/scoring/replay surface touched, so no hash oracle moves.

## Funding Surface Gate

**N/A — no funding surface touched.** No §20.1 trigger: no navigation/registry-viewer funding affordance, no profile/account funding attribution, no tournament-funding integration, no user-visible funding copy. Internal operator-dashboard debugging tooling only. (Authority chain per §20 form: WP-097, D-9701, D-9801.)

## API Catalog Update

**N/A — no API surface touched.** Per lint §21.4: no HTTP endpoint and no `apps/server/src/**` library function added or modified. Build-time data map + regenerated artifacts read by build-time dashboard bundles; `docs/ai/REFERENCE/api-endpoints.md` is unaffected.
