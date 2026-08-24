# WP-594 — Endgame AI Coach (Server)

**Status:** Draft 2026-08-23 — executing this session. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (the endgame report card gains a Pass-gated AI coach). This WP is the SERVER half (WP-B1); the client panel + non-Pass locked-teaser upsell is WP-B2. D-24026 live-verification applies (behind the Pass + `ANTHROPIC_API_KEY`).
**Primary Layer:** Server (a new `apps/server/src/coach/` module + a new entitlement key + two migrations). No engine change.
**Dependencies:** WP-132 (`getEntitlementsForAccount`), WP-333 (`readSeatAccounts`), WP-338/336 (`reduceReplayByHash`, `findCompetitiveScore`), WP-361/D-24153 (`readMatchConfigurationForLagn`/`buildNameResolver`), WP-591 (`ScoreBreakdown.parBaseline` adversity + `inputs.matchLost`), WP-593 (the free report card this complements). All landed. Baseline `origin/main` at draft: `a7781077`.

## Goal

A Legendary-Pass premium endgame coach: a server-side Claude call that reads a finished match and returns opinionated coaching — hero-fit vs the scheme/mastermind, a critique of what was acquired, and 2-3 concrete next-time tips. It complements the free, deterministic WP-593 report card (score, ledger, luck). Operator decisions (2026-08-23): **model Sonnet 5**; **lazy-on-open** (pay only when a Pass holder opens the coach); **cached one-per-match**; **hero-fit + purchases + tips** scope; a distinct **`legendary_pass_2026`** entitlement gates it.

## User-Visible Impact

A Pass holder opening the coach on their endgame card gets a personal debrief. Non-Pass holders get nothing from this WP (the locked-teaser upsell is WP-B2). Zero spend until `ANTHROPIC_API_KEY` is set in the Render environment — the feature ships dark and the operator flips it on.

## Contract (Locked by D-24403)

1. **New entitlement `legendary_pass_2026`** — added to `ENTITLEMENT_KEYS` (union + array) + migration 040 CHECK (the drift triple). The coach gates on this key alone via `getEntitlementsForAccount`.
2. **`GET /api/me/scores/:replayHash/coach`** — authenticated + Pass-gated + owner-gated. Lazy + cached: entitlement → ownership → `legendary.coach_reports` cache → (miss) assemble summary → call Claude ONCE → cache → return. `{ report, wasCached }` on 200.
3. **Match summary** — assembled server-side from `reduceReplayByHash` (loadout via `finalState.matchConfiguration`; per-player acquired cards = deck+hand+discard+in-play minus the fixed starting deck + Wounds) + the stored `ScoreBreakdown` (outcome from `inputs.matchLost`; adversity vs `parBaseline`). NO player free-text enters the prompt (no injection surface).
4. **Injected model client** — `CoachModelClient` interface; the real impl calls the Anthropic Messages API over Node `fetch` (no SDK dependency). Tests pass a stub → the suite makes ZERO paid calls. A DISABLED fail-soft client when `ANTHROPIC_API_KEY` is unset.
5. **Fail-soft** — any model/timeout/parse error → `503 coach_unavailable` (retriable), never blocks the card.
6. **Cache table `legendary.coach_reports`** (migration 041; `replay_hash` PK, `account_id`, `model`, `report` jsonb, `generated_at`) — a derived advisory artifact: never `G`/`ctx`, never hashed, never a score-row column, never affects score/gameplay.

### Determinism / persistence
No engine change, no `G` field, no move, no scoring change → `finalStateHash` / `PRE_WP080_HASH` untouched. The coach report is derived read-time metadata; the `CompetitiveScoreRecord` 16-key lock is untouched.

## Scope (In)

**Server:** `entitlements/entitlements.types.ts` (+`legendary_pass_2026`); `data/migrations/040_add_legendary_pass_entitlement.sql` + `041_create_coach_reports.sql`; `coach/coach.types.ts`, `coach/coachSummary.logic.ts`, `coach/coachReport.persistence.ts`, `coach/coachClient.ts` (Anthropic over `fetch`), `coach/coach.logic.ts` (orchestrator + injectable seam), `coach/coach.routes.ts`; `server.mjs` wiring (Sonnet 5 client or disabled fallback). **Docs + tests:** `docs/ai/REFERENCE/api-endpoints.md` (new row, D-11804); server tests (summary, orchestrator, route, persistence — all stubbed).

## Out of Scope

- The arena-client coach panel + non-Pass locked-teaser upsell (**WP-B2**).
- `seatIdentities`/coaching on `GET /api/me/scores` (the coach is its own endpoint).
- Any engine / `G` / move / scoring change; any `CompetitiveScoreRecord` shape change.
- A Stripe price mapping for the Pass (operator env config: `STRIPE_PRICE_ALLOWLIST` += `<priceId>:legendary_pass_2026`) — not code.

## Acceptance Criteria

1. `legendary_pass_2026` in the union + array + migration CHECK; `ENTITLEMENT_KEYS.length` drift test = 7.
2. `buildCoachMatchSummary` resolves the loadout to names, derives per-player acquired cards (starters + Wounds netted out; victory pile excluded), reads outcome from `matchLost`, and includes expected adversity only with a WP-591 baseline.
3. The orchestrator: refuses without the Pass (`not_entitled`) and without ownership (`not_owner`) before any model call; returns the cache on a hit (no model call); generates once on a miss and caches; `not_found` when unscored/unreplayable; `coach_unavailable` (fail-soft) on a model throw.
4. The route: auth chain (401/403/500), `400` on a missing param, `200 { report, wasCached }`, refusal→status mapping (403/404/503), `500` locked envelope on a throw; `Cache-Control: no-store` first.
5. The test suite makes ZERO paid calls (stubbed client) and touches no real database (injected seams / stub `query`).
6. No game-state-hash re-pin; server + `pnpm -r --no-bail test` green; `api-endpoints.md` updated.

## Verification Steps

```bash
pnpm -r build 2>&1 | tail -3
node --import tsx --test apps/server/src/coach/*.test.ts apps/server/src/entitlements/entitlements.logic.test.ts apps/server/src/billing/*.test.ts 2>&1 | tail -6
pnpm -r --no-bail test 2>&1 | tail -6
# Live (post-deploy; D-24026): set ANTHROPIC_API_KEY + grant legendary_pass_2026; open the coach on a scored match — hero-fit + purchases critique + tips render; a second open is a cache hit.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] All 6 Acceptance Criteria pass
- [ ] Verification Steps produce expected output (live step post-deploy)
- [ ] New entitlement (drift triple); lazy + cached endpoint; injected client (zero paid calls in CI); fail-soft; derived non-persisted cache
- [ ] No game-state-hash re-pin; no engine/`G`/move/scoring change; `CompetitiveScoreRecord` 16-key lock untouched
- [ ] `docs/ai/REFERENCE/api-endpoints.md` new row (D-11804 whole-row)
- [ ] `docs/ai/STATUS.md` Done entry names WP-594 + D-24026 operator-pending
- [ ] `docs/ai/DECISIONS.md` D-24403 landed Active
- [ ] WORK_INDEX + EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-629:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed (operator-pending)

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-23)
Every input surface exists server-side (`getEntitlementsForAccount`, `reduceReplayByHash`, `findCompetitiveScore`, `findReplayOwnershipForAccount`, `buildNameResolver`, the starter/Wound ext_id constants). The summary is derivable from the reduced state + stored breakdown alone (no matchId, no log parsing). **Mutation boundary:** no engine/`G`/hash/fixture; the coach report is a new derived table, not a score-row column (16-key lock intact); the model client is injected so CI makes zero paid calls. The Postgres inline-CHECK auto-name (`entitlements_entitlement_key_check`) is the standard convention — the migration DROP-then-ADD is safe and idempotent.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-23)
Layer boundary (server module; engine imports are the runtime-safe public surface + types; Anthropic via `fetch`, no SDK) — clean. Determinism (no `G`, no hash, no scoring) — clean. Persistence (coach report derived, non-persisted into the score row) — clean. Cost control (lazy + cached one-per-match; disabled-by-default until the key is set) — clean. **RISK considered:** a paid call in CI (avoided — injected stub client); prompt injection (avoided — server-generated summary, no player free-text); a model failure blocking the card (avoided — fail-soft `coach_unavailable`); the CHECK-rename two-constraint trap (avoided — standard auto-name). Locked in AC-1..AC-6 + D-24403.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)
§1–§21 pass; closed allowlist across server entitlements + migrations + coach module + server.mjs + tests + governance; `node:test`; `// why:` on the new entitlement key, the cache-table persistence carve-out framing, the fail-soft swallow, and the disabled-client fallback citing D-24403. §20 N/A (no funding-surface trigger — a Pass-gated feature is monetization-positive, not a §20.1 vector change). **§21 SATISFIED:** a new HTTP endpoint — `docs/ai/REFERENCE/api-endpoints.md` updated in the same change. No ❌ triggers.

## Vision Alignment
**Clauses touched:** §20-26 (competitive/endgame surface — a premium coaching layer on the free card), §22 (determinism — no game-state change), monetization (a Pass-gated value-add, aligned with the business posture). **Conflict assertion:** `No conflict` — additive server feature; no rule/determinism change; ships dark until enabled. **Non-Goal proximity:** none (NG-1 no-pay-to-win — coaching is post-match advice, never affects gameplay or score). **Determinism:** no engine `G`/fixture → both hash oracles byte-identical.

## Funding Surface Gate
**N/A** — a Pass-gated feature consuming an existing entitlement mechanism; no §20.1 permitted-revenue-vector change. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update
**Required — DONE.** New `GET /api/me/scores/:replayHash/coach`; `docs/ai/REFERENCE/api-endpoints.md` row added whole (D-11804). No existing row's status changed.
