# EC-629 — Endgame AI Coach (Server) — Execution Checklist

**Source:** docs/ai/work-packets/WP-594-endgame-ai-coach-server.md
**Layer:** Server — new entitlement key + 2 migrations + `apps/server/src/coach/` module + `server.mjs` wiring + docs/tests. No engine change.

## Before Starting
- [ ] Baseline: `pnpm install && pnpm -r build` exit 0 (fresh worktree needs install)
- [ ] Confirm the input surfaces: `getEntitlementsForAccount` (WP-132), `reduceReplayByHash` + `findCompetitiveScore` (competition/replay), `findReplayOwnershipForAccount`, `buildNameResolver` (matchLagn), the `SHIELD_AGENT_EXT_ID`/`SHIELD_TROOPER_EXT_ID`/`WOUND_EXT_ID` + `gradeForFinalScore` engine barrel exports

## Locked Values (do not re-derive)
- Entitlement key: `legendary_pass_2026` (a DISTINCT product; drift triple = union + array + migration-040 CHECK). Coach gates on this key ALONE.
- Model: Sonnet 5 (`claude-sonnet-5`); lazy-on-open; cached one-per-match; scope = hero-fit + purchases + 2-3 tips.
- Endpoint: `GET /api/me/scores/:replayHash/coach`; 200 `{ report, wasCached }`; refusals `not_entitled`/`not_owner` → 403, `not_found` → 404, `coach_unavailable` → 503; `400` missing param; `500` locked envelope; `Cache-Control: no-store` first.
- Acquired cards = deck+hand+discard+inPlay minus 8 Agents + 4 Troopers minus Wounds; victory pile EXCLUDED. Outcome = `breakdown.inputs.matchLost ? 'scheme-wins' : 'heroes-win'`.
- Cache table `legendary.coach_reports` (`replay_hash` PK) — derived, non-persisted into the score row; NOT a `CompetitiveScoreRecord` key (16-key lock stays 16).

## Guardrails (execution order matters)
1. Migration 040: DROP + re-ADD `entitlements_entitlement_key_check` (the standard inline auto-name) with `legendary_pass_2026` added. Migration 041: `legendary.coach_reports`.
2. `entitlements.types.ts`: add key to union + array. `entitlements.logic.test.ts`: add the `case`, bump length assertion 6→7.
3. `coach/coach.types.ts`: `CoachMatchSummary`, `CoachReport`, `StoredCoachReport`, `CoachRefusalReason`, `CoachResult`, `CoachModelClient` (injected), `CoachDependencies`.
4. `coach/coachReport.persistence.ts`: `readCoachReport` (map/null) + `writeCoachReport` (ON CONFLICT upsert).
5. `coach/coachSummary.logic.ts`: `buildCoachMatchSummary` (pure; loadout names, acquired cards, adversity, outcome from matchLost, expected adversity only with a WP-591 baseline).
6. `coach/coachClient.ts`: `createAnthropicCoachClient(apiKey, model)` — Anthropic Messages API over `fetch`; system prompt constant; parse+validate JSON → `CoachReport`; throw on any failure. Imported ONLY by `server.mjs`.
7. `coach/coach.logic.ts`: `generateOrGetCoachReport` + injectable `CoachLogic` seam (entitlement → ownership → cache → score+reduce → summary → model (try/catch fail-soft) → cache).
8. `coach/coach.routes.ts`: `registerCoachRoutes` + injectable `CoachRouteLogic` seam; auth chain (session → unsuspended); resolver from `buildNameResolver(registry)` once at registration.
9. `server.mjs`: import + wire; Sonnet 5 client when `ANTHROPIC_API_KEY` set, else a DISABLED fail-soft client; `registerCoachRoutes(server.router, pool, {...})` after `registerMatchLagnRoutes`.
10. Docs: `api-endpoints.md` new row (D-11804 whole-row). Tests: summary, orchestrator, route, persistence (all stubbed — ZERO paid calls, no real DB).

- **Determinism:** NO engine/`G`/move/scoring change → both hash oracles byte-identical. If a hash oracle moves, STOP.
- **Zero paid calls:** the model client is INJECTED; tests pass a stub. Never import `coachClient.ts` from a test.
- **Record lock:** `seatIdentities`/coach report never enters `CompetitiveScoreRecord`. The coach report is its own table.

## Required `// why:` Comments
- On the new entitlement key (union + array): distinct product, drift triple, cite WP-594 / D-24403.
- On the cache-table persistence framing: derived advisory artifact, never `G`/hash/score-row.
- On the fail-soft try/catch: a model failure returns coach_unavailable, never blocks the card.
- On the disabled-client fallback in `server.mjs`: ships dark until `ANTHROPIC_API_KEY` is set.

## After Completing
- [ ] Coach tests + entitlements + billing tests green
- [ ] `pnpm -r build`; `pnpm -r --no-bail test` no new failures
- [ ] `api-endpoints.md` new row; STATUS names WP-594 (+ D-24026 pending); DECISIONS D-24403 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`
- [ ] Live-on-surface (D-24026): operator sets `ANTHROPIC_API_KEY` + grants the Pass; coach renders + caches

## Common Failure Smells (Optional)
- INSERT of `legendary_pass_2026` rejected in prod → migration 040 DROPed the wrong constraint name; the inline auto-name is `entitlements_entitlement_key_check`.
- A test made a paid call → a test imported `coachClient.ts` or `server.mjs` instead of injecting a stub `CoachModelClient`.
- Acquired cards include rescued bystanders / KO'd enemies → the victory zone was included; it must be excluded.
- Coach 500 instead of 503 on a model failure → the orchestrator re-threw instead of catching to `coach_unavailable`.
