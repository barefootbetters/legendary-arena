# WP-408 — Portable Match-LAGN Download on the Result View (App)

**Layer:** App (`apps/legends-board`)
**EC:** `docs/ai/execution-checklists/EC-443-portable-match-lagn-download.checklist.md`
**Reserves:** D-24218
**Baseline:** drafted off `origin/main` @ `08da2952`
**User-Visible Surface:** `legends.legendary-arena.com` — **D-24026 live verification REQUIRED**

---

## Goal

Add a **"Download this match as a portable LAGN"** control to the WP-407 per-match
result view: one click fetches the WP-406 result LAGN and saves it as a
`.lagn.json` file the viewer can re-open in the Registry Viewer, share, or feed to
any third-party LAGN tool. This is the self-describing-artifact half of the arc —
a completed match becomes a portable, standards-conformant record.

---

## Assumes

- **WP-406 ⏸** — the `GET /api/match/:matchId/result-lagn` producer whose document
  is downloaded. **BLOCKED on WP-406.**
- **WP-407 ⏸** — the per-match result view this control lives on. **BLOCKED on WP-407.**
- **WP-244 ✅** — LAGN is a published open standard, so a downloaded `.lagn.json` is
  consumable by the CLI, the Registry Viewer `?lagn=` flow, and third-party tools.
- **D-24026** — user-visible surfaces require live verification.

---

## Context

### Export-only — the boundary that keeps this safe (D-24218)

The download is a **one-way export**: the client fetches the server-produced result
LAGN (built from the authoritative blob) and hands the bytes to the user. The
downloaded artifact is **never re-ingested to score, credit, or rank** — competitive
outcomes stay `matchId → blob → re-execute → AccountId` server-side (D-5301). A
user could edit the downloaded file, but nothing on the platform reads it back as
authority; it is a portable *copy*, exactly as `players[]` / `scoring_profile` are
descriptive (D-24214 / D-24215). **D-24218** records that offering a portable
export introduces no ingest path and no new trust surface.

### Why its own packet and not folded into WP-407

WP-407 is the read-only display; WP-408 adds a user *action* (a download) with its
own D-5301/export-only consideration. Splitting keeps the display shippable and
verifiable on its own, and lets the export ride once the display is proven — the
same display-then-action sequencing WP-402→WP-404 used. It is a small packet by
design.

---

## Scope (In)

1. A download control on `MatchResultPanel.vue` (WP-407) that fetches
   `GET /api/match/:matchId/result-lagn` and triggers a browser download of the
   `lagn` payload as `match-<id>.lagn.json` (a Blob + object URL; no server round-trip
   beyond the existing read).
2. Filename + MIME (`application/json`) and a full-sentence failure state if the
   fetch fails (never a silent no-op — the twice-bitten dead-button pattern).
3. Governance: D-24218 Active, `STATUS.md`, both indices, mindmap; and the D-24026
   live-verify STATUS flip after deploy.

## Scope (Out)

- Any **re-import / ingest** of a downloaded LAGN into scoring, ranking, or a match —
  forbidden (D-24218 / D-5301). (Re-opening a downloaded loadout in the Registry
  Viewer via the existing `?lagn=` flow is a pre-existing, unrelated capability.)
- Any change to WP-406's producer or WP-407's display beyond adding the control.
- Any new server endpoint — the download reuses WP-406's read.
- Any `packages/game-engine` or scoring change.

---

## Files Expected to Change

- `apps/legends-board/src/panels/MatchResultPanel.vue` — **modified** — download control (WP-407 file)
- `apps/legends-board/src/**/*.test.ts` — **modified/new** — download-trigger + failure-state tests
- `docs/ai/DECISIONS.md` — **modified** — D-24218 Active
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` /
  `docs/05-ROADMAP-MINDMAP.md` — **modified**

---

## Contract

Read-only client action. No new server surface (reuses WP-406's `result-lagn` read).
§21 N/A (no catalog change). The downloaded document is a LAGN 1.4.0 result record,
`validate()`-conformant by WP-406's construction.

---

## Acceptance Criteria

- **AC-1** — The control on a completed match's result view downloads a
  `match-<id>.lagn.json` whose contents equal the WP-406 endpoint's `lagn` payload.
- **AC-2** — The downloaded document passes `lagn validate` (it is the server's
  already-validated output, byte-for-byte).
- **AC-3** — A failed fetch shows a visible full-sentence error; the control is never
  a silent no-op.
- **AC-4** — Nothing re-ingests the downloaded file: assert no scoring/ranking path
  consumes an uploaded/edited LAGN (the export is one-way; D-24218).
- **AC-5** — `pnpm --filter legends-board typecheck` 0; `pnpm --filter legends-board test` 0; `pnpm -r build` 0.
- **AC-6** — **D-24026 live verification** on `legends.legendary-arena.com`: click the
  control on a real completed match, confirm a valid `.lagn.json` downloads and
  re-opens (drive the terminal action — a rendered button is not proof it downloads).

---

## Verification Steps

```bash
pnpm -r build
pnpm --filter legends-board typecheck
pnpm --filter legends-board test
pnpm -r --no-bail test
pnpm roadmap:counts:check
```

Then the AC-6 live pass: download from the deployed bundle and re-open the file.

---

## Vision Alignment

- **Clauses touched:** Hall of Legends public surface; NG-1.
- **Conflict assertion:** `No conflict.` A portable copy of a public record confers no
  gameplay capability; the export is one-way and scores nothing (D-24218).
- **Determinism:** no engine, RNG, or scoring surface; a client download of an
  already-produced document.

## Lint Gate Self-Review (`00.3`) — abbreviated

§1 Structure PASS · §2 PASS (export-only, no ingest) · §3 PASS (WP-406 ⏸ + WP-407 ⏸) ·
§7 BLOCKED-aware · §8 PASS (single app file) · §11 N/A (reuses WP-406's read) ·
§15.1 **TRIGGERED** (legends.legendary-arena.com; AC-6 drives the terminal action) ·
§17 PASS · §18 N/A · §21 N/A (no catalog change). All others PASS/N/A.

---

## Definition of Done

- [ ] AC-1..AC-6 each demonstrated; AC-6 live-verified on the deployed bundle
- [ ] `pnpm --filter legends-board typecheck` 0; `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] D-24218 landed **Active** (export-only, no ingest path)
- [ ] `git diff --name-only` matches §Files Expected to Change
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0
