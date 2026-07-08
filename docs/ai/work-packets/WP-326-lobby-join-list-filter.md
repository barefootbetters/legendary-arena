# WP-326 — Lobby Join List Shows Only Joinable Matches

**User-Visible Surface:** play.legendary-arena.com (the "Join existing match" list in
the arena-client lobby). The list stops showing dead matches — finished (gameover)
games and matches with no open seat (e.g. single-seat "Watch Bot Play" / solo
creates that already have seat 0 filled) are filtered out, so the lobby shows only
matches a player can actually join.

## Goal

Filter the lobby "Join existing match" list to **joinable** matches only: at least
one open seat (a `players[]` entry with no `name`) **and** not `gameover`.
`listMatches()` additionally requests `?isGameover=false` so finished matches are
dropped server-side before they reach the client. When no joinable match exists,
the list shows a plain empty-state line instead of a wall of un-joinable rows.

## Assumes

- `LobbyView.vue` renders the raw `listMatches()` result via
  `v-for="match in matches"` with a per-seat **Join** button gated on
  `isOpenSeat(seat)` (`seat.name === undefined`). Locked baseline: `origin/main`
  @ `ce022043`.
- `listMatches()` (`lobby/lobbyApi.ts`) fetches the boardgame.io lobby list at
  `GET {serverUrl}/games/legendary-arena` and normalizes each row to
  `LobbyMatchSummary` — `players: { id, name? }[]`, `gameover: unknown | null`
  (explicit `null` when the match is ongoing).
- The boardgame.io lobby list route honors the `?isGameover=false` query param by
  passing `where: { isGameover: false }` to the store's `listMatches`, and the
  WP-309 `bgioPgStore.listMatches` implements that predicate against each row's
  `metadata.gameover` presence (`apps/server/src/db/bgioPgStore.js:264`). A server
  that ignores the param is harmless — the client-side filter still drops gameover
  rows via the normalized `gameover` field.
- `node:test` + the arena-client test harness are available (the pattern used by
  `lobbyApi.test.ts` and by the WP-321/322 pure-helper unit tests).
- `vue-tsc` (`typecheck`), the arena-client `test` suite, and `build` pass on the
  baseline.

## Context (Read First)

- `apps/arena-client/src/lobby/LobbyView.vue` — the lobby component; `matches` ref,
  `refreshMatches()`, `isOpenSeat(seat)`, and the `join-existing` `v-for`.
- `apps/arena-client/src/lobby/lobbyApi.ts` — `listMatches()` + the
  `LobbyMatchSummary` shape (`players`, `gameover`).
- `apps/server/src/db/bgioPgStore.js` — WP-309 store; `listMatches(opts)` honors
  `where.isGameover` / `updatedBefore` / `updatedAfter`.
- `docs/ai/DECISIONS.md` — scan D-24095 (WP-309 pg match store; the durability
  change that exposed this), D-24107/D-24108 (recent client-display precedents),
  D-6512 (leaf `<script setup>` under vue-sfc-loader; LobbyView is already
  `defineComponent`).
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code rules.

**Why now:** WP-309 (D-24095) made the boardgame.io match store durable in Postgres
so an in-progress match survives a deploy. Before that, every Render deploy wiped
the in-memory store, which masked two always-true facts: nothing ever removes an
abandoned match, and the join list never filtered un-joinable rows. Now that matches
persist, the lobby fills with dead single-seat and finished matches (observed on
play.legendary-arena.com, 2026-07-07). This WP is the **client half** — hide what
can't be joined. Its co-release partner **WP-327** is the **server half** — reap the
abandoned rows from `bgio.matches` so the store does not grow unbounded. Split by
layer per the Layer Boundary (arena-client vs server); shared `## Assumes` on WP-309.

## Scope (In)

- **`lobbyMatchFilter.ts`** (new) — a pure
  `filterJoinableMatches(matches: readonly LobbyMatchSummary[]): LobbyMatchSummary[]`
  returning only matches with `gameover === null` **and** at least one open seat
  (`seat.name === undefined`). Extracted as a pure helper so the filter is
  unit-testable without mounting the component (WP-321 `isPinnedToBottom` / WP-322
  `buildGameLogText` precedent).
- **`lobbyMatchFilter.test.ts`** (new) — boundary tests: empty input → empty; a
  match with an open seat and no gameover → kept; a fully-seated match → dropped; a
  gameover match (even with an open seat) → dropped; a mixed list → only the
  joinable subset, order preserved.
- **`lobbyApi.ts`** (modified) — `listMatches()` requests
  `{serverUrl}/games/legendary-arena?isGameover=false` (server-side drop of finished
  matches). Response normalization is unchanged.
- **`lobbyApi.test.ts`** (modified) — assert the fetch URL carries
  `?isGameover=false`; existing normalization tests pass unchanged.
- **`LobbyView.vue`** (modified) — add a `joinableMatches` computed = 
  `filterJoinableMatches(matches.value)`; the `join-existing` `v-for` iterates
  `joinableMatches` instead of `matches`; show a plain empty-state line
  ("No open matches right now — create one above.") when `joinableMatches.length ===
  0`. `matches`, `refreshMatches()`, `isOpenSeat`, and every create/join path are
  otherwise unchanged. The component is already `defineComponent({ setup() {...} })`
  (D-6512) — no conversion needed.

## Out of Scope

- **Any server change** — the reaper that deletes abandoned rows from
  `bgio.matches` is the co-release partner **WP-327** (server layer). This WP only
  changes what the client displays; it deletes nothing.
- **A spectate affordance for full / in-progress matches** — the lobby offers only
  a Join action; a "watch this match" surface is a separate future WP. Full matches
  are simply hidden here.
- **Reversing, sorting, or paginating the list** — order is preserved verbatim from
  the server response; richer list UX is deferred.
- **Any `MatchSetupConfig` / envelope / projection change** — no data-contract edit.
- **New npm dependencies** — none; the filter is a plain array predicate.

## Files Expected to Change

| File | Action |
|------|--------|
| `apps/arena-client/src/lobby/lobbyMatchFilter.ts` | **New** — pure `filterJoinableMatches` |
| `apps/arena-client/src/lobby/lobbyMatchFilter.test.ts` | **New** — filter boundary tests |
| `apps/arena-client/src/lobby/lobbyApi.ts` | **Modified** — `listMatches()` requests `?isGameover=false` |
| `apps/arena-client/src/lobby/lobbyApi.test.ts` | **Modified** — assert the query param |
| `apps/arena-client/src/lobby/LobbyView.vue` | **Modified** — `joinableMatches` computed + empty state; `v-for` iterates it |
| `docs/ai/DECISIONS.md` | **Modified** — D-24112 (Active on execution) |
| `docs/ai/STATUS.md` | **Modified** — record the change (execution) |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-326 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-356 row |

No other files may be modified.

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Deliver **full file contents** for every new or modified file — no diffs.
- ESM only; Node v22+.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (explicit control flow,
  descriptive names, JSDoc on every function, `// why:` on non-obvious code).

**Packet-specific:**
- **Display filter only.** The client hides un-joinable rows; it never mutates,
  ends, or deletes a match. Match lifecycle is the server's (WP-327).
- Keep the `matches` ref intact (raw server result); filter in a **computed** so a
  future spectate view can still reach the full list without a re-fetch.
- The pure helper takes no Vue reactivity — it is a plain function over a readonly
  array, so it is unit-testable without a component mount.
- No `MatchSetupConfig` / envelope / projection edit; no `finalStateHash` surface
  (client display only).
- No new npm dependencies.

**Session protocol:** if any scope or contract question is ambiguous, STOP and ask —
do not guess or widen scope.

**Locked contract values:**
- Joinable = `gameover === null` **AND** `players.some((seat) => seat.name ===
  undefined)`.
- List fetch: `{serverUrl}/games/legendary-arena?isGameover=false`.
- Empty-state copy: `No open matches right now — create one above.`
- Reserved decision: **D-24112**.

## Vision Alignment

- **Vision clauses touched:** §14 (observability / a lobby that shows real state),
  §11 (UI consumes read-only projections). **Conflict assertion:** `No conflict.`
  The client filters a read-only server list for display; no clause is weakened.
  **Non-Goal proximity:** none of NG-1..7 crossed (no monetization, identity,
  competitive, or persuasive surface). **Determinism:** N/A — client display; no
  engine / RNG / replay / hash surface touched.

## Acceptance Criteria

1. `filterJoinableMatches([])` returns `[]`.
2. A match with `gameover === null` and ≥1 seat whose `name` is `undefined` is
   **kept**; a match with every seat named is **dropped**; a match with
   `gameover !== null` is **dropped even if it has an open seat** (asserted).
3. `filterJoinableMatches` preserves input order of the kept subset (asserted).
4. `listMatches()` issues its fetch against a URL containing `?isGameover=false`
   (asserted against a stubbed `fetch`); response normalization is unchanged.
5. `LobbyView` renders only `joinableMatches`; when it is empty the empty-state line
   is shown (verified live per D-24026; the filter is unit-asserted in criteria 1–3).
6. Existing `lobbyApi.test.ts` normalization tests pass unchanged.
7. `vue-tsc` clean; arena-client `test` + `build` green.
8. No files outside `## Files Expected to Change` are modified.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client run typecheck   # clean
pnpm --filter @legendary-arena/arena-client run test        # 0 fail
pnpm --filter @legendary-arena/arena-client run build       # succeeds
git diff --name-only                                        # only ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `vue-tsc` clean; arena-client `test` + `build` green
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):**
      after merge + deploy, the "Join existing match" list shows only matches with an
      open seat and no gameover; the dead single-seat / finished rows are gone; an
      empty list shows the empty-state line. Until then STATUS.md records the test
      evidence + the deferred live observation.
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24112 Active; `WORK_INDEX.md`
      WP-326 `[x]`; `EC_INDEX.md` EC-356 Done
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | All required sections present; Out of Scope lists ≥2 exclusions; single layer (arena-client) |
| 2 | ✅ PASS | Engine-wide (full files, ESM/Node22, 00.6) + packet-specific + session protocol + locked values present |
| 3 | ✅ PASS | §Assumes lists LobbyView, listMatches/LobbyMatchSummary, the server param contract, the test harness, green baseline @ ce022043 |
| 4 | ✅ PASS | §Context cites the specific files + D-entries to read |
| 5 | ✅ PASS | §Files lists 5 code/test + 4 governance files, each with an action; bounded |
| 6 | ✅ PASS | Names match: `LobbyMatchSummary`, `filterJoinableMatches`, `isOpenSeat`; no 00.2 field surface touched |
| 7 | ✅ PASS | No new npm dependency — plain array predicate; explicitly excluded in §Out of Scope |
| 8 | ✅ PASS | Layer Boundary respected — arena-client filters a read-only server list; no engine/registry/server import added; the server half is WP-327 |
| 9 | ✅ N/A | No shell scripts / paths introduced (Verification uses pnpm on Windows pwsh) |
| 10 | ✅ N/A | No environment variables |
| 11 | ✅ N/A | No authentication surface (the list endpoint is already public; create/join auth unchanged) |
| 12 | ✅ PASS | Tests use `node:test`; no boardgame.io import; no live server; boundary assertions on the pure filter + a stubbed-`fetch` URL assertion |
| 13 | ✅ PASS | Verification uses `pnpm --filter … run …` with expected output + `git diff --name-only` scope check |
| 14 | ✅ PASS | 8 binary, observable, function-specific acceptance criteria |
| 15 | ✅ PASS | DoD includes STATUS / DECISIONS / WORK_INDEX + scope-boundary check; User-Visible Surface declared + live D-24026 item |
| 16 | ✅ PASS | Explicit control flow; descriptive names; JSDoc + `// why:`; pure helper extracted for testability (§16.1 disposition, WP-321/322 precedent) |
| 17 | ✅ PASS | `## Vision Alignment` present — §14/§11; no conflict; no NG crossed; determinism N/A |
| 18 | ✅ N/A | No literal-string-scoped forbidden-token grep in Verification Steps |
| 19 | ✅ N/A | No repo-state-summarizing artifact |
| 20 | ✅ N/A | No funding surface |
| 21 | ✅ N/A | No HTTP endpoint added and no `apps/server/src/**` library function touched — arena-client only (the `?isGameover=false` param consumes an existing boardgame.io lobby route, not a new/edited endpoint) |

**Verdict: 21/21 resolved (14 PASS, 7 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Lightweight-lane shape: single layer (arena-client), pure
additive filter + one component wiring edit, no contract file, no determinism /
persistence / hash surface. The one un-jsdom-testable surface (the actual rendered
empty list) is covered by unit-asserting the pure `filterJoinableMatches` + the
stubbed-`fetch` URL check and deferring the rendered view to D-24026. Co-released
with WP-327 (server reaper); this half is independently safe — it only changes what
is displayed.

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing (client filters a read-only list; the server half is a
separate WP), no monetization / identity / RNG / multiplayer-sync, no new contract,
no hash impact. The `?isGameover=false` param consumes an existing boardgame.io
lobby route honored by the WP-309 store; a server that ignores it degrades to the
client-side filter (still correct). No BLOCK modes.
