# WP-407 — Hall of Legends Per-Match Result View (Display) (App)

**Layer:** App (`apps/legends-board`) + a supporting server read in `apps/server`
**EC:** `docs/ai/execution-checklists/EC-442-hall-of-legends-match-result-view.checklist.md`
**Reserves:** D-24217
**Baseline:** drafted off `origin/main` @ `08da2952`
**User-Visible Surface:** `legends.legendary-arena.com` — **D-24026 live verification REQUIRED**

---

## Goal

Give the Hall of Legends its first **per-match result view**: a panel that shows a
single completed match's outcome and its **participant roster** (who played which
seat), read from the WP-406 result-LAGN producer. Today `apps/legends-board` shows
only aggregate standings; a finished match has no page that names the people in it.

---

## Assumes

- **WP-406 ⏸ must land first** — the `GET /api/match/:matchId/result-lagn` producer.
  This view renders that document's `players[]` + `result`. **BLOCKED on WP-406.**
- **WP-405 ⏸** (transitively, via WP-406) — the LAGN 1.4.0 `players[]` reader
  contract this view parses.
- **`apps/legends-board`** is the kiosk app (`legends.legendary-arena.com`) of
  aggregate panels reading published snapshots; this adds the first per-match panel.
- **D-24026** — user-visible surfaces require live verification on the deployed bundle.

---

## Context

### Why a new panel, not an extension

The grounding found **no per-match view anywhere** — `/api/leaderboards/scores/:replayHash`
returns a single *score* by hash, not a match with its roster; every legends-board
panel is aggregate. So this is net-new: a match-result panel plus the wiring that
feeds it a `matchId` (from a recent-matches list or a deep link).

### Privacy posture (D-24217)

The roster shows the **same public labels the leaderboard already exposes** —
`player_id` (the claimed handle from WP-406) and the optional `display_name`. It
shows **only** the participants WP-406 chose to emit (claimed-handle accounts);
seats WP-406 omitted (no handle, bots, guests) are shown as an anonymous/empty seat,
never back-filled from any private source. No new identity is exposed beyond what
WP-406's result LAGN already made public. **D-24217** records that the view is a
pure consumer of the result LAGN and introduces no new identity surface.

### Feed: live endpoint vs snapshot

legends-board reads published JSON snapshots today. Two options, resolved at draft:
this view fetches the WP-406 endpoint **live** by `matchId` (a completed match's
result is small and cacheable), rather than adding it to the snapshot publisher —
keeping the publisher's aggregate scope unchanged. A thin recent-completed-matches
list (matchIds only) may be needed to populate the panel; scope it minimally or
reuse the dashboard `/api/dash/matches` shape (read-only, matchId list).

---

## Scope (In)

1. A `MatchResultPanel.vue` (or equivalent) in `apps/legends-board` rendering a
   completed match's `result` (outcome) + `players[]` roster from a result LAGN.
2. Wiring to obtain the `matchId` — a minimal recent-completed-matches list (matchIds)
   or a deep-link route param — feeding the panel.
3. A read-only fetch of `GET /api/match/:matchId/result-lagn` (WP-406), parsing
   `players[]` / `result` via `@legendary-arena/lagn` types (no parser fork).
4. Empty/omitted-seat rendering: a seat WP-406 omitted shows as anonymous, never
   back-filled.
5. Governance: D-24217 Active, `STATUS.md`, both indices, mindmap; and the D-24026
   live-verify STATUS flip after deploy.

## Scope (Out)

- The **download** control (WP-408).
- Any change to WP-406's producer or the LAGN contract.
- Any aggregate-panel or snapshot-publisher change beyond a minimal matchId feed.
- Any private identity source — the view consumes only the public result LAGN.
- Any `packages/game-engine` or scoring change.

---

## Files Expected to Change

- `apps/legends-board/src/panels/MatchResultPanel.vue` — **new**
- `apps/legends-board/src/**` — **modified** — panel registration + matchId feed (exact set asserted at execution via `git ls-files`)
- `apps/legends-board/src/**/*.test.ts` — **modified/new** — panel render + roster tests
- `apps/server/src/**` — **modified** — (only if a thin recent-completed-matches list is needed; otherwise none)
- `docs/ai/DECISIONS.md` — **modified** — D-24217 Active
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` /
  `docs/05-ROADMAP-MINDMAP.md` — **modified**

---

## Contract

Read-only. Consumes `GET /api/match/:matchId/result-lagn` (WP-406). Adds no server
write. If a thin matchId-list endpoint is required, it is read-only and catalogued
(§21) at execution; otherwise §21 N/A.

---

## Acceptance Criteria

- **AC-1** — The panel renders a completed match's outcome and its `players[]`
  roster (handle + optional display name) from the result LAGN.
- **AC-2** — Seats WP-406 omitted render as anonymous/empty; no private id appears.
- **AC-3** — An in-progress or unknown `matchId` renders a visible, non-crashing
  empty/error state (WP-406 returns 404).
- **AC-4** — `pnpm --filter legends-board typecheck` exits 0 (SFCs are not typechecked
  by the bundler — the recurring gate).
- **AC-5** — `pnpm --filter legends-board test` 0 fail; `pnpm -r build` 0.
- **AC-6** — **D-24026 live verification** on `legends.legendary-arena.com`: open a
  real completed match's result view and confirm the roster renders (drive the
  terminal action — a rendered panel shell is not proof the roster populates).

---

## Verification Steps

```bash
pnpm -r build
pnpm --filter legends-board typecheck
pnpm --filter legends-board test
pnpm -r --no-bail test
pnpm roadmap:counts:check
```

Then the AC-6 live pass on the deployed bundle after the deploy-confirmed SHA.

---

## Vision Alignment

- **Clauses touched:** Hall of Legends public surface; NG-1.
- **Conflict assertion:** `No conflict.` The view displays only public, already-exposed
  labels from the result LAGN; it confers no gameplay capability and scores nothing.
- **Determinism:** no engine, RNG, or scoring surface; read-only display.

## Lint Gate Self-Review (`00.3`) — abbreviated

§1 Structure PASS · §2 PASS (consumer-only, no fork) · §3 PASS (WP-406 ⏸) · §7 BLOCKED-aware ·
§8 PASS (app + optional thin read) · §11 NOTED (public labels only, D-24217) ·
§15.1 **TRIGGERED** (legends.legendary-arena.com; AC-6 drives the terminal action) ·
§17 PASS (no NG-1 conflict) · §18 N/A · §21 CONDITIONAL (only if a matchId-list read is added). All others PASS/N/A.

---

## Definition of Done

- [ ] AC-1..AC-6 each demonstrated; AC-6 live-verified on the deployed bundle
- [ ] `pnpm --filter legends-board typecheck` 0; `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] D-24217 landed **Active**
- [ ] `git diff --name-only` matches §Files Expected to Change (server row present only if the thin feed was needed)
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0
