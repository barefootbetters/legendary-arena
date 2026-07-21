# EC-442 — Hall of Legends Per-Match Result View (Execution Checklist)

**Source:** docs/ai/work-packets/WP-407-hall-of-legends-match-result-view.md
**Layer:** App (`apps/legends-board`) + optional thin server read

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.**
- [ ] **Re-verify WP-407 / EC-442 / D-24217 free** against `origin/main` AND open PR branches.
- [ ] **WP-406 must be landed** — the `GET /api/match/:matchId/result-lagn` producer.
      If not, this WP is **BLOCKED**; stop.
- [ ] Confirm `apps/legends-board` builds and its typecheck passes on `main`. Record counts.
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md` before the first edit.

## Locked Values (do not re-derive)
- The view is a **pure consumer** of `GET /api/match/:matchId/result-lagn` — parse
  `players[]` / `result` via `@legendary-arena/lagn` types; **no parser fork**.
- Show only the public labels WP-406 emitted (`player_id` = handle, optional
  `display_name`). **Never** back-fill an omitted seat from any private source.
- An omitted / bot / guest seat renders **anonymous**, never with an id.
- Fetch is **read-only**; no server write; if a matchId list is needed, it is a
  read-only endpoint catalogued at execution.

## Guardrails
- **No new identity surface.** The view exposes nothing beyond what WP-406's result
  LAGN already made public (D-24217). Do not join to `match_seat_accounts`,
  `players`, or any identity table directly — consume the LAGN only.
- **No scoring / ranking logic.** Display only.
- **`typecheck` is the load-bearing gate** — the bundler does not typecheck SFCs
  (recurred WP-166/207/227). AC-4.
- Read-only: no snapshot-publisher change beyond a minimal matchId feed.
- No `packages/game-engine` edit.

## Required `// why:` Comments
- Why the view consumes the result LAGN and never joins identity tables (D-24217)
- Why an omitted seat renders anonymous (WP-406 chose not to emit it)
- Why the feed is a live fetch, not a snapshot-publisher entry (keeps aggregate scope unchanged)

## Files to Produce
- `apps/legends-board/src/panels/MatchResultPanel.vue` — **new**
- `apps/legends-board/src/**` — **modified** — panel registration + matchId feed (exact set via `git ls-files`)
- `apps/legends-board/src/**/*.test.ts` — **modified/new** — panel + roster tests
- `apps/server/src/**` — **modified** — ONLY if a thin recent-completed-matches read is needed
- `docs/ai/DECISIONS.md` — **modified** — D-24217 Active
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] AC-1..AC-6 each demonstrated; **AC-6 live-verified on the deployed bundle** (drive the terminal action)
- [ ] `pnpm --filter legends-board typecheck` 0; `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] D-24217 landed **Active**; STATUS flip after the deploy-confirmed SHA
- [ ] `git diff --name-only` matches Files to Produce (server row present only if the feed was needed)
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0

## Common Failure Smells
- The view joins `match_seat_accounts` / `players` directly → consume the LAGN only (D-24217)
- An omitted seat shows a real or fabricated id → render anonymous
- `typecheck` skipped because `test`/`build` passed → SFCs are not typechecked by either
- A snapshot-publisher aggregate change crept in → out of scope
