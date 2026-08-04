# EC-531 — Coverage Decision Column (Execution Checklist)

**Source:** docs/ai/work-packets/WP-496-coverage-decision-column.md
**Layer:** App (`apps/dashboard` — the `/coverage` viewer). Lightweight lane. No engine/registry/server/data touch.

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] `pnpm -r build` first (dashboard imports the registry dist + build-time coverage bundle)
- [ ] By-card table lacks Decision today: `grep -q "<th>WP</th>" apps/dashboard/src/pages/coverage/CoveragePage.vue` AND the next `<th>` is `Handler`, not `Decision`
- [ ] `LedgerRow.decision` exists: `grep -qE "^\s*decision:\s*string;" apps/dashboard/src/types/coverage.ts` → OK (no type change needed)
- [ ] By-mechanic table already renders `entry.decision` (the pattern to mirror; proves the bundle carries it)
- [ ] Working tree clean except this WP

## Locked Values (do not re-derive)
- Add EXACTLY: a `<th>Decision</th>` header **between** `<th>WP</th>` and `<th>Handler</th>`, and a `<td class="mono dim">{{ row.decision || '—' }}</td>` cell **between** the `row.wp` `<td>` and the `row.handler` `<td>` — in the **by-card** table (`v-for="row in displayedRows"`) only.
- Blank → `—` (`row.decision || '—'`), matching the WP/Handler cells. Never fabricate.
- Add a `// why:` comment on the new cell citing WP-496 (mirrors by-mechanic + /debug/effects; `—` never fabricated).
- Do NOT touch the by-mechanic table, `useCoverageLedger.ts`, `types/coverage.ts`, the coverage bundle, the ledgers, or the row `:key`.

## Guardrails
- Additive display ONLY: render the existing `row.decision`; author no data/type/logic/metric change
- Do NOT modify `useCoverageLedger.ts` metric logic, `types/coverage.ts`, `build-coverage-ledger.mjs`, the committed ledgers, `card-mechanics.json`, or any engine/registry/server/data file
- Row `:key` unchanged (rows stay unique per `(extId, mechanic)`) — no duplicate-key regression
- Dashboard coverage thresholds must still hold
- Zero determinism surface; no `G`/RNG/replay/hash; no re-pin (N/A — app layer)
- Lightweight-lane discipline: if any of {new contract, layer crossing, determinism/persistence surface, file-budget overflow, 01.6 trigger, scope ambiguity} arises → STOP and self-demote to two-session lane

## Required `// why:` Comments
- On the new by-card `<td>` for `row.decision` (why: WP-496 — the DECISIONS id governing the mechanic, mirroring the by-mechanic table + /debug/effects; `—` for an unattributed row, never fabricated).

## Files to Produce
- `apps/dashboard/src/pages/coverage/CoveragePage.vue` — **modified** — Decision `<th>` + `<td>` in the by-card table
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-496 node `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` 0
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** — governance close (STATUS records the D-24026 live-verify operator-pending)

## After Completing
- [ ] By-card table shows the Decision column (values + `—` for blank), between WP and Handler; no duplicate-key warning
- [ ] Scaffold: `/coverage` rendered locally (localhost) with the Decision column populated — observed output recorded
- [ ] `pnpm --filter @legendary-arena/dashboard test` + `build` exit 0; coverage thresholds hold; `pnpm -r build` 0
- [ ] `git diff --name-only | grep -vE '^(apps/dashboard/src/pages/coverage/CoveragePage\.vue|docs/)'` → NO MATCH
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; reserves NO decision
- [ ] Commit prefix: `EC-531:` (code) + `SPEC:` (governance); D-24026 live-verify the Decision column on the deployed `/coverage` (operator-pending)

## Common Failure Smells
- The Decision column is all `—` → the bundle didn't carry `decision`; but the by-mechanic Decision column proves it does — check you read `row.decision`, not a typo
- A metric/worklist/summary number shifted → you touched `useCoverageLedger.ts` logic; this is display-only, revert
- Vue duplicate-key warning → you changed the row `:key`; leave it `${row.extId}-${row.mechanic}`
- `types/coverage.ts` or the bundle in `git diff` → out of scope; `LedgerRow.decision` already exists — revert
