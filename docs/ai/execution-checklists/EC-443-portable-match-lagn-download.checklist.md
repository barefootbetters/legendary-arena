# EC-443 — Portable Match-LAGN Download on the Result View (Execution Checklist)

**Source:** docs/ai/work-packets/WP-408-portable-match-lagn-download.md
**Layer:** App (`apps/legends-board`)

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.**
- [ ] **Re-verify WP-408 / EC-443 / D-24218 free** against `origin/main` AND open PR branches.
- [ ] **WP-406 AND WP-407 must be landed** — the producer endpoint and the result
      view this control lives on. If either is missing, this WP is **BLOCKED**; stop.
- [ ] Confirm `apps/legends-board` builds + typecheck passes on `main`. Record counts.
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md` before the first edit.

## Locked Values (do not re-derive)
- The control fetches `GET /api/match/:matchId/result-lagn` (WP-406) — **no new endpoint.**
- Download filename, verbatim shape: `match-<id>.lagn.json`; MIME `application/json`.
- Download mechanism: a client Blob + object URL from the fetched `lagn` payload —
  no server round-trip beyond the existing read.
- A failed fetch shows a **visible full-sentence error**; the control is **never a
  silent no-op** (the twice-bitten dead-button pattern).

## Guardrails
- **Export-only.** The downloaded file is never re-ingested to score, credit, or
  rank (D-24218 / D-5301). Do NOT add any upload / import-to-score path. (Re-opening
  a loadout via the pre-existing Registry-Viewer `?lagn=` flow is unrelated and out
  of scope.)
- **No new server surface** — reuse WP-406's read.
- **`typecheck` is the load-bearing gate** (SFCs). AC-5.
- No `packages/game-engine` or scoring change; §21 N/A (no catalog change).

## Required `// why:` Comments
- Why the export is one-way and nothing re-ingests it (D-24218 / D-5301)
- Why the download is a client Blob and adds no server endpoint
- Why the failure state is visible, not a silent no-op

## Files to Produce
- `apps/legends-board/src/panels/MatchResultPanel.vue` — **modified** — download control
- `apps/legends-board/src/**/*.test.ts` — **modified/new** — download-trigger + failure-state tests
- `docs/ai/DECISIONS.md` — **modified** — D-24218 Active
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] AC-1..AC-6 each demonstrated; **AC-6 live-verified** (download + re-open the file)
- [ ] `pnpm --filter legends-board typecheck` 0; `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] D-24218 landed **Active** (export-only, no ingest)
- [ ] `git diff --name-only` matches Files to Produce
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0

## Common Failure Smells
- An upload / import-to-score path appeared → D-24218 violation; export is one-way
- The control silently no-ops on fetch failure → show a full-sentence error
- A new server endpoint was added → reuse WP-406's read
- The downloaded file fails `lagn validate` → it must be WP-406's already-validated output verbatim
