# WP-371 — Lobby Player-Count Pre-Submit Check: read-only setup-requirements endpoint (Server) + warn/disable-before-submit (Arena Client)

**Status:** **Done 2026-07-13** (EC-400; standard two-session lane; design per **D-24167** now Active). **Executed with an operator-approved scope change (2026-07-13): the drafted server "composition gate" was dropped as redundant** — WP-370's `validateSetupData` already blocks a composition/player-count mismatch at match creation and the existing `POST /api/match/create` passthrough already returns that as a 400. Per the operator "expand it" decision, WP-371 instead adds a **read-only `GET /api/match/setup-requirements` endpoint** (guest) + a **lobby pre-submit check** that warns and disables Create *before* the user submits, with the engine 400 as the backstop. See §Execution Amendment.
**Primary Layer:** Server (`apps/server` — a read-only requirements projection) + App (`apps/arena-client` — the lobby pre-check). The server imports the registry table; the arena-client does **not** (it consumes the requirements as data from the endpoint).
**Dependencies:** WP-370 ✅ (the `PLAYER_COUNT_SETUP` table + its registry export + the engine block); WP-334 / WP-333 / WP-301 (`POST /api/match/create` gate + Hanko session auth); the arena-client lobby (`LobbyView.vue` create paths).
**User-Visible Surface:** play.legendary-arena.com — the lobby. A composition that does not match the chosen player count is **flagged with a warning and Create is disabled** before submit; the engine still rejects it at create time as a backstop.

---

## Execution Amendment (2026-07-13) — gate → read-only endpoint + pre-check

The WP was drafted (in #724) **before** WP-370 was implemented, on the assumption the server needed its own composition gate. Execution framing found that redundant:

- `POST /api/match/create` (`matchGate.routes.ts:257-266`) already **propagates the native lobby's non-ok status + body verbatim**. Post-WP-370 the native lobby runs `LegendaryGame.validateSetupData(setupData, numPlayers)`, which returns the composition-mismatch message as a **400** — already surfaced to the client through `lobbyApi.createMatch` → `LobbyView` `errorMessage`.
- A second server gate would **duplicate enforcement** and violate the route's own "server wires, engine decides" contract.

Per the operator "expand it" decision, WP-371 delivers the genuinely-new value instead: a **read-only, guest-accessible `GET /api/match/setup-requirements`** (a projection of the `PLAYER_COUNT_SETUP` table, since arena-client may not import registry) + a **lobby pre-submit check** that warns and disables Create for a mismatched composition **before** submit. The authoritative block stays at the engine (D-24165); this is a progressive-enhancement UX. D-24167 is reframed accordingly.

---

## Goal

After this session, the server exposes a read-only `GET /api/match/setup-requirements` (guest) returning the per-player-count required counts (from `PLAYER_COUNT_SETUP`). The arena-client lobby fetches it on mount and, on both create paths (the uploaded loadout's `playerCount`/composition and the manual form's `numPlayers`/CSV lengths), computes any villain-group / henchman / hero count mismatch, renders a full-sentence warning per mismatch, and **disables Create while a mismatch is present** — a warn-then-disable UX consistent with the D-24165 enforcement model. If the requirements fetch is unavailable the pre-check stays silent and the engine block (surfaced as a create 400) remains the authority. No redundant server gate is added.

---

## User-Visible Impact

In the lobby, a composition that does not fit the chosen player count now shows a clear warning ("A 4-player match needs 3 villain groups — this loadout has 1.") and disables Create until it is fixed — catching the problem before submit instead of only via the create-time 400. Valid setups are unaffected.

---

## Assumes

- **WP-370 complete:** `@legendary-arena/registry` exports `PLAYER_COUNT_SETUP` + `getPlayerCountSetup` on a browser-safe/server-safe path; the engine already blocks the same mismatch authoritatively at `Game.setup()`.
- **Create gate:** `apps/server/src/match/matchGate.routes.ts:224` `router.post('/api/match/create', …)` reads `{ numPlayers, setupData }` (:235-253) and delegates to the native lobby; it is `authenticated-session-required` (WP-334/301).
- **Lobby:** `apps/arena-client/src/lobby/LobbyView.vue` — `submitCreate` (:207-225, manual `numPlayers` ref → `createMatch(config, seatCount, authToken)`) and `submitFromJson` (:390-…, envelope `playerCount` → `numPlayers`); `apps/arena-client/src/lobby/lobbyApi.ts` `createMatch` wraps the POST and returns/throws on the server response.
- **Server imports registry:** `apps/server` may import `@legendary-arena/registry` (Import Rules); `apps/arena-client` may **not** import `registry` at runtime — it consumes the server's structured error only.
- **Baseline:** captured at execution-prep off `origin/main` (post-WP-370). Server + arena-client suites green.
- `docs/ai/DECISIONS.md` exists; **D-24167** is reserved.

If any of the above is false (esp. WP-370 not merged), this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary` + `.claude/rules/architecture.md §Import Rules` — server may import `registry`; arena-client must not (runtime). The lobby learns the expected counts only from the server response, never a local table.
- `docs/ai/ARCHITECTURE.md §Server Layer` — the server **wires**; it does not "decide gameplay." Confirm this gate is framed as **input validation at the create boundary** (rejecting malformed setup requests), not as re-implementing engine rules — the engine remains the authority; the server gate is a fast, friendly pre-check reading the same registry data (D-24167 records this framing).
- `apps/server/src/match/matchGate.routes.ts` — read the whole create handler (:224-279): body parsing, the existing auth gate, the delegation call. The composition check slots in after auth + body validation and before delegation; on mismatch, return the structured error and do not delegate.
- `apps/server/src/match/matchGate.routes.test.ts` + `.integration.test.ts` — the existing gate tests; mirror their structure for the new rejection cases.
- `apps/arena-client/src/lobby/LobbyView.vue` + `lobbyApi.ts` — the two submit paths + the `createMatch` wrapper; where the server error is caught and surfaced. Read the existing error-render pattern (e.g. the WP-254 `ext_id` guard messaging) and reuse it.
- `docs/ai/REFERENCE/api-endpoints.md` (D-11804) — the `POST /api/match/create` row; its `Auth` / `Status` and the response schema get the new rejection documented (updated in the impl commit).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 11 (full-sentence messages), Rule 4 (naming).

---

## Non-Negotiable Constraints

- **Server is authority-adjacent, not authority.** The engine block (WP-370) is the source of truth; this gate is a friendlier early rejection using the same `PLAYER_COUNT_SETUP` data. It must reject exactly the compositions the engine would reject for the given `numPlayers` — no stricter, no looser (a drift test asserts parity of the length rules).
- **Structured error, closed set.** Mismatch → `400` with a typed error code (e.g. `PLAYER_COUNT_COMPOSITION_MISMATCH`) + a full-sentence message naming the field and the expected/actual counts. The arena-client renders the message; it does not re-derive the numbers.
- **arena-client imports no registry / engine table.** The lobby surface reads the server's error only. Any `@legendary-arena/registry` runtime import in arena-client is a FAIL.
- **No match on rejection.** The gate returns before delegating to the native lobby; a rejected create leaves no match, no bgio state.
- **Auth unchanged.** `authenticated-session-required` + existing session handling untouched; the composition check runs after auth.
- ESM only; `node:` prefix; `.test.ts`; full-file outputs; no `.reduce()` with branching; human-style code.

---

## Scope (In)

> **Superseded by §Execution Amendment.** The scope below is the original
> draft (a server create-gate). It was **not** executed as written — the gate
> is redundant with WP-370. The delivered scope is: a read-only
> `GET /api/match/setup-requirements` (server) + a lobby pre-submit warn/disable
> (arena-client). See §Execution Amendment and §Files Expected to Change.

### A) Server create-gate (`apps/server/src/match/matchGate.routes.ts` — modified)
- After auth + body validation, before delegation: read the composition arrays + `numPlayers` from `setupData`/body, look up `PLAYER_COUNT_SETUP[numPlayers]`, and check `villainGroupIds` / `henchmanGroupIds` / `heroDeckIds` lengths. On mismatch, respond `400 { errorCode: 'PLAYER_COUNT_COMPOSITION_MISMATCH', message }` and return (no delegation). Absent table row / unparseable numPlayers → fall through to existing behavior (not this gate's error to own). `// why:` cites D-24167.
- A small shared pure helper (server-local or reused from registry) computes the mismatch list so the route stays thin.

### B) Server tests (`apps/server/src/match/matchGate.routes.test.ts` (+ integration) — modified)
- A matching create still delegates + succeeds; a wrong villain-group / henchman / hero count for the player count returns the typed `400` and does **not** create a match; auth-first ordering preserved; parity with the engine length rules (drift assertion).

### C) API catalog (`docs/ai/REFERENCE/api-endpoints.md` — modified, D-11804)
- Replace the `POST /api/match/create` row entirely (whole-row replace per D-11804): document the new `400` rejection + error code in the response schema. `Auth` / `Status` unchanged otherwise.

### D) Lobby surface (`apps/arena-client/src/lobby/LobbyView.vue` (+ `lobbyApi.ts` if the error shape needs typing) — modified)
- Both submit paths: catch the `PLAYER_COUNT_COMPOSITION_MISMATCH` `400`, render the server's full-sentence message inline (existing error-surface pattern), and keep the user in the lobby. Optionally disable the create button when the current form's composition lengths already disagree with the chosen player count (a soft pre-check using the counts the user has entered — a length compare, **not** a re-typed table; the button-disable is UX only, the server remains the gate).

### E) Lobby tests (`apps/arena-client/src/lobby/*.test.ts` — modified)
- A `400` mismatch renders the message + creates no match; a successful create is unchanged; the button-disable pre-check (if added) toggles on length disagreement.

---

## Out of Scope

- **The engine block + the table + villain-deck fix** — WP-370.
- **The registry-viewer loadout builder** — WP-372.
- **Re-implementing engine setup rules on the server** — the gate checks only the three composition lengths against the shared table; it is not a second engine.
- **"What If…?" variant / game modes** — none in the app.
- **Retro-validation of existing matches.**
- Refactors outside Scope (In).

---

## Files Expected to Change

> Reflects the executed (amended) design — read-only endpoint + lobby pre-check, no server gate. See §Execution Amendment.

- `apps/server/src/match/matchGate.routes.ts` — **modified** — new `GET /api/match/setup-requirements` (guest, read-only)
- `apps/server/src/match/matchGate.routes.test.ts` — **modified** — fake router `get`; endpoint-list + endpoint tests
- `apps/arena-client/src/lobby/playerCountRequirements.ts` — **new** — pure mismatch check + warning formatter + row types
- `apps/arena-client/src/lobby/playerCountRequirements.test.ts` — **new**
- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — `fetchSetupRequirements` (+ shape guard)
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — mount fetch + mismatch computeds + gate both create buttons + warning lists
- `apps/arena-client/src/lobby/LobbyView.test.ts` — **modified** — mismatch→disabled+warn; match→enabled; unavailable→inert
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — new `GET /api/match/setup-requirements` row (D-11804)
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24167), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` + counts — **modified** — governance close

No other files. (The `POST /api/match/create` gate + `matchGate.routes.integration.test.ts` in the original draft were **not** touched — the redundant-gate work was dropped.)

---

## Vision Alignment

- **Clauses:** §3 (trust/fairness — clean rejection at the boundary), §23(b) (no PvP framing in copy — the message is about setup legality, not opponents).
- **Conflict:** none — input-validation UX; no NG-1 surface.
- **Non-Goal proximity:** §multiplayer-sync — not triggered (no transport/sync change; a create-time input check).

## Funding Surface Gate

N/A — lobby validation only; no funding affordances/copy/channels.

## API Catalog (00.3 §21)

**Applies.** A **new** endpoint `GET /api/match/setup-requirements` is added (`Wired`, `Auth = guest`). A row is added to `docs/ai/REFERENCE/api-endpoints.md` (D-11804) in the impl commit. `POST /api/match/create` is **unchanged** (the redundant gate was dropped — see §Execution Amendment).

---

## Acceptance Criteria

- [ ] `POST /api/match/create` returns `400 { errorCode: 'PLAYER_COUNT_COMPOSITION_MISMATCH', message }` and creates no match when a composition length ≠ the table for `numPlayers`; a matching create still succeeds.
- [ ] The server gate rejects exactly what the engine (WP-370) rejects for the same `numPlayers` (parity drift test).
- [ ] The lobby renders the server's message inline on both `submitCreate` and `submitFromJson`; the user stays in the lobby.
- [ ] arena-client has no `@legendary-arena/registry` runtime import (`git grep` empty outside comments).
- [ ] Server + arena-client suites green at baseline + new tests; api-endpoints row updated; no files outside the allowlist changed.

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/server test
pnpm --filter @legendary-arena/arena-client test
pnpm --filter @legendary-arena/arena-client typecheck
git grep "@legendary-arena/registry" apps/arena-client/src   # expect: comments only, no runtime import
pnpm roadmap:counts:check
git diff --name-only origin/main   # only ## Files Expected to Change
```

---

## Definition of Done

- [ ] **User-visible verification (surface = play.legendary-arena.com lobby):** D-24026 operator-pending on deploy — create a 4-player match with 1 villain group → the lobby shows the mismatch message and no match is created; a matching setup creates normally.
- [ ] All acceptance criteria pass.
- [ ] Server + arena-client builds + suites green; api-endpoints.md row replaced (D-11804).
- [ ] arena-client imports no registry runtime table.
- [ ] No files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24167 → Active; `docs/ai/work-packets/WORK_INDEX.md` WP-371 checked off; mindmap node + `roadmap:counts --write` regenerated in the close commit.

---

## Lint Gate Self-Review & Gate Verdicts

Recorded in the drafting SPEC commit body (current SPEC-draft convention). Summary: 21/21 resolved (PASS — incl. §21 API-catalog obligation flagged for the create-gate row); pre-flight **NOT READY — BLOCKED on WP-370** (hard-dep table + registry export must land first); copilot **PASS** (server-as-authority-adjacent framing confirmed; arena-client boundary held; structured-error closed set). The WORK_INDEX row carries `blocked: WP-370` until WP-370 merges, at which point pre-flight re-runs to READY at execution-prep.
