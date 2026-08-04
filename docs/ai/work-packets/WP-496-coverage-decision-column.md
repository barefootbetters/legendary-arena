# WP-496 — Coverage Decision Column (/coverage by-card table provenance parity)

**Status:** Draft 2026-08-04 — lightweight lane (draft + execute one session). **Gates: lint SATISFIED (21/21) · eligibility + scaffold confirmed** — see Gate Verdicts.
**User-Visible Surface:** `dashboard /coverage` (the by-card table gains a **Decision** column; D-24026 live-verification applies).
**Primary Layer:** App (`apps/dashboard` — the `/coverage` viewer). No engine/registry/server/data touch.
**Dependencies:** WP-259 / D-24035 (the `/coverage` viewer + its build-time coverage bundle); WP-493 + WP-495 (which filled the `decision` values now shown).

---

## Goal

The `/coverage` by-card table renders `Card · Design · Set · Mechanic · Status · WP · Handler` but **omits the Decision column** — even though the same page's by-mechanic table and the `/debug/effects` viewer both show it, and every by-card row already carries `row.decision` (the `LedgerRow` type declares it, and the build-time coverage bundle is a full byte-copy of the committed ledger). After WP-493/WP-495 filled those decision values, `/coverage`'s by-card table is the one surface still hiding them. This WP renders the existing `row.decision` as a new **Decision** column between WP and Handler, giving `/coverage` the same WP+Decision provenance `/debug/effects` shows. It is a purely additive display column — no data, schema, type, or generated-artifact change.

## Assumes (Hard-Gate Preconditions)

```bash
# A. The by-card table shows WP + Handler but NOT Decision today.
grep -q "<th>WP</th>" apps/dashboard/src/pages/coverage/CoveragePage.vue && ! grep -A1 "<th>WP</th>" apps/dashboard/src/pages/coverage/CoveragePage.vue | grep -q "<th>Decision</th>" && echo "A_OK by-card lacks Decision"
# B. LedgerRow already carries `decision` (no type change needed).
grep -qE "^\s*decision:\s*string;" apps/dashboard/src/types/coverage.ts && echo "B_OK LedgerRow.decision exists"
# C. The by-mechanic table already renders `decision` (the pattern to mirror; proves the bundle carries it).
grep -q "entry.decision" apps/dashboard/src/pages/coverage/CoveragePage.vue && echo "C_OK by-mechanic renders decision"
```

## Context (Read First)

- **The data is already in the viewer; only the render is missing.** `useCoverageLedger` exposes `rows` = `ledger.rows` (`LedgerRow[]`), each carrying `wp`/`decision`/`handler`/`designs`. The by-card table iterates `displayedRows` (derived from `ledger.rows`) and already renders `row.wp` + `row.handler`; it simply never rendered `row.decision`. `buildMechanicDictionary` reads `row.decision` for the by-mechanic Decision column, which proves the field is present in the build-time bundle (`build-coverage-ledger.mjs` is a full byte-copy of the committed ledger, not a field subset).
- **Column placement:** insert **Decision** between WP and Handler, mirroring the by-mechanic table's `WP · Decision · Handler` order and the `/debug/effects` WP+Decision pairing.
- **Blank stays honest:** `row.decision || '—'` renders `—` for a genuinely unattributed row — never fabricated (the same convention the WP and Handler cells already use).
- **Lightweight lane (D-24028):** single app, single additive display column, no contract/schema/generated-artifact change, zero determinism surface. Eligibility confirmed below.

## Scope (In)

- **Modify `apps/dashboard/src/pages/coverage/CoveragePage.vue`** — add a `<th>Decision</th>` header (between WP and Handler) and a `<td class="mono dim">{{ row.decision || '—' }}</td>` cell (between the WP and Handler cells) in the **by-card** table, with a `// why:` comment. No script/logic/style change; the row `:key` is unchanged.

## Out of Scope

- **The by-mechanic table** — already shows Decision; untouched.
- **`useCoverageLedger.ts` / `types/coverage.ts` / the coverage bundle / the ledgers** — no change (`LedgerRow.decision` already exists; the bundle already carries it; the decision values were filled by WP-493/WP-495).
- **A Scope column, column reordering, `/debug/effects`, `card-mechanics.json`, engine/registry/server/data** — none touched.
- **A new Decision (`D-NNNNN`)** — reserves none.

## Files Expected to Change

- `apps/dashboard/src/pages/coverage/CoveragePage.vue` — **modified** (Decision `<th>` + `<td>` in the by-card table; `// why:` comment)
- `docs/ai/STATUS.md` / `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

1 code file + 4 governance. No test file (the by-card table has no existing component test, mirroring the by-mechanic Decision column which shipped without one; the change is a display column over an already-typed, already-tested field). Lightweight lane.

## Non-Negotiable Constraints

- **Additive display only.** Render the existing `row.decision`; author no new data, type, or logic. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (inert — no functions/imports authored; one template column + comment).
- **`—` for blank, never fabricated** — `row.decision || '—'`, matching the WP/Handler cells.
- **No schema/type/bundle/generated-artifact change; no engine/data touch; reserve no decision; zero determinism surface** (no `G`/RNG/replay/hash).

## Contract

`/coverage`'s by-card table renders a **Decision** column (`row.decision`, `—` when blank) between WP and Handler, achieving WP+Decision provenance parity with the by-mechanic table and `/debug/effects`. `LedgerRow` is unchanged. No aggregate/metric/worklist change (display-only).

## Acceptance Criteria

1. The `/coverage` by-card table renders a **Decision** column between WP and Handler; each row shows `row.decision` (or `—` when blank).
2. A row with a filled decision shows it (e.g. a `size-changing` hero row → `D-24074`; a `draw` row → `D-2201`); a genuinely blank row shows `—`.
3. No change to the by-mechanic table, the metrics/worklist/summary, or the row `:key`; no Vue duplicate-key or console warning.
4. `pnpm --filter @legendary-arena/dashboard test` + `build` exit 0; coverage thresholds hold. `pnpm -r build` exits 0.
5. No file outside the allowlist is modified (no engine/registry/server/data/type/bundle change); no `finalStateHash`/`PRE_WP080` re-pin (N/A — no engine surface).

## Verification Steps

```bash
pnpm -r build
pnpm --filter @legendary-arena/dashboard test 2>&1 | tail -5
pnpm --filter @legendary-arena/dashboard build 2>&1 | tail -3
# Local dev-server visual (localhost is NOT behind CF Access): load /coverage,
# confirm the by-card table shows the Decision column with values (e.g. draw → D-2201) and — for blanks.
git diff --name-only | grep -vE '^(apps/dashboard/src/pages/coverage/CoveragePage\.vue|docs/)' ; echo "out-of-scope hits above (expect none)"
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–C passed
- [ ] All 5 Acceptance Criteria pass
- [ ] The by-card table shows the Decision column (values + `—` for blank), no duplicate-key warning
- [ ] `pnpm --filter @legendary-arena/dashboard test` + `build` + `pnpm -r build` exit 0; coverage thresholds hold
- [ ] Only `CoveragePage.vue` + governance changed; no schema/type/bundle/engine/data change; reserves no decision
- [ ] `docs/ai/STATUS.md` Done entry; WORK_INDEX `[x]` + EC_INDEX Done; `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` 0
- [ ] Commit prefix `EC-531:` (code) + `SPEC:` (governance close)
- [ ] D-24026 live-verify: the Decision column confirmed on the deployed `/coverage` (operator-pending)

## Gate Verdicts (drafting session)

**Lightweight lane — targeted self-review (per 01.0a §Collapsed / removed):**

- **Eligibility (D-24028) — CONFIRMED.** Single app (`apps/dashboard`), single additive display column; no contract/schema/type file; `LedgerRow.decision` pre-exists; no generated-artifact change; surface = a display column (not scoring/PAR/identity/RNG/determinism); strictly additive. All structural + empirical criteria hold.
- **Scaffold — CONFIRMED (observed, not reasoned).** The column was prototyped and the dashboard suite + build run with the change in place; `/coverage` rendered the Decision column locally (localhost, not CF-gated) with filled values and `—` for blanks. Observed output recorded in the exec commit / STATUS.
- **No self-demotion trigger:** no new contract, no layer crossing, no determinism/persistence/hash surface, file budget (1 code + governance) holds, no 01.6 trigger.

## Lint Gate Self-Review

All 21 sections resolved (PASS or explicit N/A):
- **§4 (00.2):** N/A — renders an existing `LedgerRow` string field; adds no card-data/match-setup field.
- **§5:** Files Expected to Change is a closed set (1 code + 4 governance) matching the EC.
- **§10 (env) / §11 (auth) / §12 (tests):** N/A — no env var; inherits the existing dashboard auth gate; no new test file (mirrors the by-mechanic Decision column precedent).
- **§17 Vision / §20 Funding / §21 API:** resolved below.
- **§18 / §19:** N/A (the only verification grep runs over `git diff --name-only` paths; STATUS authored at close against live HEAD).
- All remaining sections PASS.

## Vision Alignment

**Clauses touched:** §22 (determinism — app-layer display only; no `G`/RNG/replay). **Conflict:** `No conflict.` A read-only operator/developer surface gains a column showing an existing verbatim field; no card semantics, gameplay, or aggregate change. **Non-Goal check:** none of NG-1..8 crossed (internal debugging tool, no monetization/persuasion/pay-to-win/competitive surface).

## Funding Surface Gate

**N/A — no funding surface touched** (no nav/registry/profile/tournament funding affordance or copy; operator-dashboard tooling only). Authority: WP-097, D-9701, D-9801.

## API Catalog Update

**N/A — no HTTP endpoint and no `apps/server/src/**` library function added or modified** (per lint §21.4). A dashboard display column reading a build-time bundle; `docs/ai/REFERENCE/api-endpoints.md` unaffected.
