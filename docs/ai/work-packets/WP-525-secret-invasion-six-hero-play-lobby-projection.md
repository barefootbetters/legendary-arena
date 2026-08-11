# WP-525 — Secret Invasion "6 Heroes" — Scheme-Aware Play-Lobby Requirement Projection (Server + arena-client)

**Layer:** Server (`/api/match/setup-requirements` projection + autoplay default sizing) +
App (arena-client play lobby) · **Lane:** Standard two-session (cross-layer; a public
endpoint shape change) · **Baseline:** `origin/main` @ `c5cfa21b` (+ WP-525 reservation,
#1324) · **User-Visible Surface:** play.legendary-arena.com lobby · **Epic:** WP-524 +
WP-525 **ship as a set** — hard-deps WP-524 (see §Assumes).

## Goal

WP-524 makes the engine + registry-viewer builder require **6** hero groups for Secret
Invasion (`core/secret-invasion-of-the-skrull-shapeshifters`). The **arena-client play
lobby** (`play.legendary-arena.com`) is scheme-blind: it compares the loadout against a
flat `GET /api/match/setup-requirements` projection (`PLAYER_COUNT_SETUP` verbatim, no
scheme input) and **disables Create on any mismatch** (WP-371). So after WP-524 the play
lobby would **block a correct 6-hero Secret Invasion loadout** ("needs 5, has 6") while the
engine rejects the 5-hero fallback — making the scheme **un-creatable via the play lobby.**
This WP makes the requirement projection scheme-aware end-to-end so the play lobby agrees
with the engine: 6 for Secret Invasion, base otherwise.

## User-Visible Impact

On `play.legendary-arena.com`, selecting Secret Invasion updates the play lobby's required
hero count to **6**: a 6-hero loadout enables Create and a 5-hero one is flagged before
submit — matching the engine. Every other scheme is unchanged.

## Context (Read First)

**This is the second half of the WP-524/525 split epic** (mirrors WP-370/371/372). WP-524
put the scheme→count override in the registry (`resolveEffectiveHeroCount`) and enforced it
in the engine + registry-viewer. This WP threads the **selected scheme id** through the
play-side requirement path so the flat, scheme-blind projection becomes scheme-aware:

- **Server** — `GET /api/match/setup-requirements` gains an **optional `schemeId` query
  param**; when present, each row's `heroCount` is projected through
  `resolveEffectiveHeroCount(schemeId, count, baseHeroCount)` (imported from
  `@legendary-arena/registry`, which the server may import). Without the param, the response
  is byte-identical to today (base table) — so any un-updated caller is unaffected.
- **arena-client** — `fetchSetupRequirements(schemeId?)` appends the param; `LobbyView`
  re-fetches when the selected scheme changes so `computePlayerCountMismatches` compares
  against scheme-aware counts. `playerCountRequirements.ts` (the pure comparator) is
  **unchanged** — the scheme-awareness is entirely in the row values it receives.

**Autoplay is deliberately NOT in scope (pre-flight RS-1/RS-2).** `autoplay.mjs`'s default
loadout builder is hardcoded to a fixed non-Secret-Invasion scheme
(`DEFAULT_LOADOUT_POOL.schemeId = 'core/midtown-bank-robbery'`, `autoplay.mjs:73`) and only
runs when no custom `setupData` is sent — so Secret Invasion never reaches the default
builder, and a scheme-aware slice there would never hit the 6-hero branch. The separate
bot-ally default-loadout path is `POST /api/match/create-with-bot` (WP-375), out of this
WP. A custom Secret Invasion setupData (6 heroes) reaches the engine's WP-524 gate directly
and needs no autoplay change. Autoplay sizing is therefore Out of Scope, not deferred work.

**Stale JSDoc to correct in the same edit (pre-flight RS-3).** `matchGate.routes.ts:28-29`'s
module header claims it imports nothing from `@legendary-arena/registry` — already false
(`:49` imports `PLAYER_COUNT_SETUP`). Adding `resolveEffectiveHeroCount` deepens the drift;
fix the header comment in this WP's edit.

**Layer note:** arena-client may not import `@legendary-arena/registry` at runtime (layer
boundary) — which is exactly why the scheme-aware count arrives as *data* from the server
projection, not a client computation. The server owns the projection; the client threads
the scheme id and consumes the row.

**Endpoint caching.** The current response is `Cache-Control: public, max-age=3600`. With a
`schemeId` param the cache key must include it — add `Vary`-appropriate handling or make the
`schemeId` variant `max-age=3600` too (the projection is deterministic per scheme). Keep the
no-param response's cache header unchanged. (Locked at draft: keep `max-age=3600`; the URL's
`schemeId` query is part of the cache key, so per-scheme responses cache independently.)

## Design Rationale

**Project on the server, thread the id on the client.** The registry resolver is the single
source (WP-524); the server is the only play-side layer that may import it, so the server
projects and the scheme-blind client simply passes the id and consumes the row — no second
copy of "6", no client-side registry import, minimal client change (the comparator is
untouched).

## Assumes

- **WP-524 / D-24337 (hard-dep; SHIP AS A SET).** `resolveEffectiveHeroCount` exists in
  `@legendary-arena/registry` and the engine already enforces 6 for Secret Invasion. WP-525
  makes the play lobby agree. **The pair is not production-deployed with WP-524's engine
  change live and this play-lobby change absent** — that window is exactly the
  un-creatable-scheme regression the split exists to avoid; execute WP-524 then WP-525 and
  merge them together (or WP-525 immediately after), before Secret Invasion is played on
  prod.
- **The play-lobby requirement path is WP-371 / D-24167.** `GET /api/match/setup-requirements`
  (`matchGate.routes.ts:228`) returns `{ requirements: PLAYER_COUNT_SETUP }`;
  `fetchSetupRequirements` (`lobbyApi.ts:136`) fetches it; `computePlayerCountMismatches`
  (`playerCountRequirements.ts:51`) compares row vs loadout and gates Create in `LobbyView`.
- **The selected scheme id is in the arena-client lobby form** (the composition the user is
  assembling) — available to pass to `fetchSetupRequirements` and to re-fetch on change.
- **The endpoint is a guest/public reference endpoint** — adding an optional query param
  keeps it guest, cacheable, and backward-compatible.

## Scope (In)

- `apps/server/src/match/matchGate.routes.ts`: optional `schemeId` query on
  `/api/match/setup-requirements`; project each row's `heroCount` via
  `resolveEffectiveHeroCount` when present; base table when absent; cache key includes the
  param. Also correct the stale module-header JSDoc (`:28-29`) that claims no registry
  import (RS-3).
- `apps/arena-client/src/lobby/lobbyApi.ts`: `fetchSetupRequirements(schemeId?)` appends the
  query param (URL-encoded).
- `apps/arena-client/src/lobby/LobbyView.vue`: pass the selected scheme id + re-fetch
  requirements on scheme change so mismatch checks are scheme-aware.
- `docs/ai/REFERENCE/api-endpoints.md`: replace-whole-row for `/api/match/setup-requirements`
  (new optional `schemeId` query; per-D-11804 whole-row semantics; §21).
- Tests: server route (scheme-aware projection: SI @2p → heroCount 6; no param → base;
  other scheme → base), autoplay (SI build sizes to 6), arena-client lobby (scheme-aware
  fetch + mismatch: SI 6-hero enables Create, 5-hero flagged).

## Out of Scope

- The registry resolver + engine + registry-viewer enforcement (WP-524).
- **Autoplay default-loadout sizing** — its pool is a fixed non-Secret-Invasion scheme, so
  Secret Invasion never reaches it; a scheme-aware slice would never fire (pre-flight
  RS-1/RS-2). Revisit only if a future default pool uses Secret Invasion.
- The bot-ally default-loadout path (`POST /api/match/create-with-bot`, WP-375).
- The *"Skrull Villain Group required"* constraint (separate follow-up).
- Any villain/henchmen group-count scheme-awareness (only heroCount is scheme-conditioned
  today).

## Files Expected to Change

| File | Change |
|---|---|
| `apps/server/src/match/matchGate.routes.ts` | optional `schemeId` → scheme-aware heroCount projection; fix stale header JSDoc |
| `apps/server/src/match/matchGate.routes.*test*.ts` | scheme-aware projection cases |
| `apps/arena-client/src/lobby/lobbyApi.ts` | `fetchSetupRequirements(schemeId?)` |
| `apps/arena-client/src/lobby/LobbyView.vue` | thread scheme id + re-fetch on change |
| `apps/arena-client/src/lobby/*test*.ts` | scheme-aware fetch + Create-gate |
| `docs/ai/REFERENCE/api-endpoints.md` | `/api/match/setup-requirements` whole-row (§21) |

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24338 Active at execution), `NUMBER-LEDGER.md` (reserved), `STATUS.md`.

## Non-Negotiable Constraints

- Backward compatible: no `schemeId` → the response is byte-identical to today (base table);
  a non-Secret-Invasion `schemeId` → base counts.
- Server projects via the WP-524 `resolveEffectiveHeroCount` (single source) — no second
  copy of "6" server- or client-side.
- arena-client does NOT import `@legendary-arena/registry` at runtime — the scheme-aware
  count arrives as server data.
- The play lobby's Create gate now agrees with the engine for Secret Invasion (6 enables,
  5 flagged).
- `api-endpoints.md` whole-row replace (§21) since the endpoint's request shape changes;
  `Status`/`Auth` closed-set values preserved (guest).
- No engine / registry / determinism surface touched (server + client wiring only).

**Engine-wide (standing) constraints.** Honor `.claude/rules/*` + `00.6-code-style.md`;
ESM-only, `.test.ts` on `node:test`, Node v22+. Work from full file contents.

## Contract

`GET /api/match/setup-requirements?schemeId=<ext_id>` → `{ requirements: Record<playerCount,
SetupRequirementRow> }` where `heroCount` per row is `resolveEffectiveHeroCount(schemeId,
playerCount, baseHeroCount)`; omitting `schemeId` returns the base table (unchanged).
`fetchSetupRequirements(schemeId?: string): Promise<SetupRequirements>` appends the param.

## Acceptance Criteria

1. `GET /api/match/setup-requirements?schemeId=core/secret-invasion-of-the-skrull-shapeshifters`
   returns `heroCount` 6 for player counts 1–5 (flat, per WP-524); other rows unchanged.
2. `GET /api/match/setup-requirements` (no param) is byte-identical to the pre-WP-525
   response (base table); a non-Secret-Invasion `schemeId` returns base counts.
3. arena-client play lobby: with Secret Invasion selected, a 6-hero loadout **enables**
   Create (both the manual and paste-JSON paths — `canSubmitCreate` / `canSubmitFromJson`)
   and a 5-hero one is **flagged/disabled**; switching to another scheme restores 5.
4. `api-endpoints.md` row for `/api/match/setup-requirements` reflects the optional
   `schemeId` query (whole-row replace); `docs:check` / catalog gate passes.
5. Server + arena-client suites + **whole-workspace** green.

## Verification Steps

1. `pnpm --filter @legendary-arena/server build && pnpm --filter
   @legendary-arena/arena-client build` → 0.
2. Server + arena-client test suites green; **whole-workspace** `pnpm -r --no-bail test`
   green; record delta.
3. Control-revert non-vacuous: drop the server `schemeId` projection → the SI-6 route test
   + the arena-client Create-gate test FAIL; no-param + other-scheme tests stay green.
4. `pnpm -r build` → 0; `git diff --name-only` = allowlist + governance;
   api-catalog gate green.
5. **D-24026 live-verify (operator-pending):** on play.legendary-arena.com a Secret
   Invasion match creates with a 6-hero loadout (and a 5-hero one is blocked before submit).

## Definition of Done

- [ ] All Acceptance Criteria met; server + arena-client + whole-workspace green.
- [ ] Play lobby agrees with the engine on 6 for Secret Invasion.
- [ ] `api-endpoints.md` whole-row updated; catalog gate green.
- [ ] `git diff --name-only` matches the allowlist; `pnpm -r build` 0.
- [ ] D-24338 Active; WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap `📝`→`✅`;
      `roadmap:counts:check` 0; STATUS close-out.
- [ ] Two-commit topology (EC-560 impl + SPEC close).
- [ ] Shipped as a set with WP-524 (no live-engine / stale-lobby window on prod).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decisions (land at execution)

**D-24338** — The play-side requirement projection consumed by the arena-client lobby is
scheme-aware, so the play lobby agrees with WP-524/D-24337's engine + registry-viewer
requirement of 6 hero groups for Secret Invasion. `GET /api/match/setup-requirements` gains
an optional `schemeId` that projects `resolveEffectiveHeroCount` per player count (base
table when absent — backward compatible); the arena-client lobby (registry-barred) threads
the selected `schemeId` into `fetchSetupRequirements` + `computePlayerCountMismatches` (the
pure comparator `playerCountRequirements.ts` unchanged). Autoplay default-loadout sizing is
Out of Scope — its pool is a fixed non-Secret-Invasion scheme so Secret Invasion never
reaches it. WP-525 ships as a set with WP-524: WP-524's live engine change without this
play-lobby change would make Secret Invasion un-creatable via play.legendary-arena.com.
`api-endpoints.md` whole-row replace (§21). Server + arena-client wiring only — no engine /
registry / determinism surface.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1–§2 Structure / Constraints** — PASS.
- **§3 Assumes** — PASS (WP-524 hard-dep + ship-as-a-set; WP-371 requirement path; scheme id
  in the lobby form; guest public endpoint).
- **§4 Context** — PASS (project-on-server / thread-id-on-client; layer bar; cache-key note).
- **§5 Files** — PASS (8-file allowlist across server + arena-client + the api catalog).
- **§6 Naming** — PASS (`fetchSetupRequirements(schemeId?)`).
- **§7 Dependency** — PASS (WP-524/D-24337 hard-dep, reserved).
- **§8 Architecture** — PASS (server projects via the registry resolver; arena-client does
  NOT import registry at runtime — scheme-aware count arrives as server data; no engine /
  registry / determinism surface).
- **§9 Cross-repo** — N/A. **§10 Conflict** — PASS (no conflicting in-flight edits to these
  files). **§11 Migration** — N/A.
- **§12 Test Quality** — PASS (`node:test`; non-vacuous control-revert: drop the projection
  → route + Create-gate tests fail).
- **§13 Commands** — PASS (whole-workspace + api-catalog gate).
- **§14 Acceptance Criteria** — PASS (6 testable ACs incl. backward-compat + autoplay).
- **§15 Definition of Done** — PASS (ship-as-a-set; api-catalog gate).
- **§16 Code Style** — PASS. **§17 Vision Alignment** — PASS (§3 faithful setup; no
  NG-1..7 crossing).
- **§18 Prose-vs-Grep** — PASS. **§19 Bridge-vs-HEAD** — PASS (baseline `c5cfa21b` + WP-524).
- **§20 Funding Surface** — N/A.
- **§21 API Catalog** — **APPLIES** — `/api/match/setup-requirements` gains an optional
  `schemeId` query; whole-row replace in `api-endpoints.md` (D-11804), `Auth` stays `guest`,
  `Status` unchanged, canonical field names. Both the draft-time §21 gate and the
  commit-time catalog gate must pass at execution.

Pre-flight verdict (independent subagent, all 7 load-bearing claims verified at source):
**READY TO EXECUTE**. No PS items. Confirmed the play lobby DISABLES Create (not just warns)
on a mismatch — `canSubmitCreate`/`canSubmitFromJson` (`LobbyView.vue:239-250`) — so the
ship-as-a-set coupling is real. Four advisory RS folded: RS-1/RS-2 (autoplay AC was
untestable — the default pool is a fixed non-SI scheme, and bot-ally is a different path
(WP-375) — so autoplay is now Out of Scope, allowlist reduced); RS-3 (stale module-header
JSDoc claiming no registry import — corrected in the same edit); RS-4 (cache-key: the
`schemeId` query is part of the HTTP/Cloudflare cache key by default — no `Vary` needed;
confirmed sound). Copilot verdict (independent subagent, on the paired epic): **PASS —
CONFIRM**. No BLOCK/RISK. Disjoint allowlists, the ship-as-a-set coupling, and the
`api-endpoints.md` §21 whole-row obligation verified. NOTE-B confirmed (independently) that
the bot-ally create path has no scheme-blind client gate — it relies on the engine 400 — so
excluding autoplay/bot-ally is correct and leaves no un-creatable regression; the coupling is
specific to `canSubmitCreate`/`canSubmitFromJson`, both fixed here (AC-3).
