# WP-595 — Endgame Coach Client Panel

**Status:** Draft 2026-08-23 — executing this session. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (the endgame report card gains the AI coach affordance). This WP is the CLIENT half (WP-B2) of the endgame AI coach; the server is WP-594. D-24026 live-verification applies (needs WP-594 deployed + `ANTHROPIC_API_KEY` set + the Pass granted).
**Primary Layer:** Arena Client (a new API wrapper + composable + panel component + one EndgameSummary wire). No server/engine change.
**Dependencies:** WP-594 (the `GET /api/me/scores/:replayHash/coach` server endpoint + `legendary_pass_2026` entitlement), WP-108 (`fetchEntitlements`), WP-160 (`useAuthStore`), WP-578/593 (the endgame card + `MyCompetitiveScore.replayHash`). All landed. Baseline `origin/main` at draft: `21cbf8d8`.

## Goal

Surface the WP-594 endgame AI coach on the report card. **Pass holders** get an on-demand "Get AI coaching" affordance that fetches and renders the coaching report (hero fit / purchases / tips). **Non-Pass holders (and guests)** get a locked-teaser upsell — "Unlock AI coaching with the Legendary Pass" — the conversion hook (operator decision 2026-08-23).

## User-Visible Impact

The endgame card gains an "AI Coach" panel. A Pass holder clicks to load a personal debrief; a non-Pass holder sees a compelling reason to buy the Pass. Everything degrades gracefully: no panel for guests without a scored record; a retriable "temporarily unavailable" state if the model call fails; nothing breaks if WP-594 is not yet deployed.

## Contract (Locked by D-24404)

1. **`coachApi.ts`** — a never-throw typed `fetch` wrapper for `GET /api/me/scores/:replayHash/coach` (`status: 0` on network failure), a structural mirror of the WP-594 response (`{ report, wasCached }`). No server-type import.
2. **`useEndgameCoach` composable** — store-free (injected deps): resolves Pass status via `fetchEntitlements` (checking `legendary_pass_2026`) into `guest`/`none`/`has`, and drives the lazy coach fetch state machine (`idle`/`loading`/`ready`/`unavailable`/`error`). `503`/`coach_unavailable` → `unavailable` (retriable); a defensive `not_entitled` → back to the locked state.
3. **`EndgameCoachPanel.vue`** — Pass holders: a coaching button → loading → the rendered report, or a retry on unavailable/error. Non-Pass/guests: the locked-teaser upsell with a CTA to the Pass (`?route=me`). Rendered inside `EndgameSummary.vue` only when a scored record carries a `replayHash`.

### Determinism / boundary
Client-only. No server/engine/`G`/scoring change. The panel resolves its own Pass status and fetches on demand; it never blocks the rest of the card.

## Scope (In)

**Arena Client:** `lib/api/coachApi.ts`; `composables/useEndgameCoach.ts`; `components/hud/EndgameCoachPanel.vue`; `components/hud/EndgameSummary.vue` (import + register + render the panel). **Tests:** `coachApi.test.ts`, `useEndgameCoach.test.ts`, `EndgameCoachPanel.test.ts`, and a Pinia/fetch-stub update to `EndgameSummary.test.ts` (the child now reads the auth store).

## Out of Scope

- Any server/engine change (WP-594 owns the endpoint + entitlement).
- Eager (auto-fetch) coaching — the fetch is on click (operator chose lazy-on-open at WP-594).
- The Pass purchase flow itself (the CTA links to the existing billing surface at `?route=me`).

## Acceptance Criteria

1. `fetchCoachReport` returns `{ report, wasCached }` on 200 (Bearer attached), a typed error code on non-200, and `status: 0` on a network failure — never throws.
2. `useEndgameCoach.initialize()` resolves `guest` (no token) / `has` (Pass key) / `none` (no key or a failed entitlements read).
3. `useEndgameCoach.requestCoaching()`: 200 → `ready` with the report; 503/`coach_unavailable` → `unavailable`; other non-200 → `error`; `not_entitled` → `none`; a no-op without the Pass or without a replay hash.
4. `EndgameCoachPanel` renders the coaching button + report for a Pass holder, the locked-teaser upsell for a non-Pass holder / guest, and the retriable state on a 503.
5. `EndgameSummary` renders the panel only when `competitiveScore.replayHash` exists; the existing report-card tests still pass (Pinia + fetch stub added).
6. `vue-tsc` clean; arena-client + `pnpm -r --no-bail test` green.

## Verification Steps

```bash
pnpm -r build 2>&1 | tail -3
(cd apps/arena-client && pnpm vue-tsc --noEmit && node --import tsx --import @legendary-arena/vue-sfc-loader/register --test "src/lib/api/coachApi.test.ts" "src/composables/useEndgameCoach.test.ts" "src/components/hud/EndgameCoachPanel.test.ts" "src/components/hud/EndgameSummary.test.ts" 2>&1 | tail -4)
pnpm -r --no-bail test 2>&1 | tail -6
# Live (post-deploy; D-24026, needs WP-594 + ANTHROPIC_API_KEY + a granted Pass): finish a scored match; a Pass holder sees + loads coaching, a non-Pass holder sees the locked teaser.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] All 6 Acceptance Criteria pass
- [ ] Verification Steps produce expected output (live step post-deploy)
- [ ] Pass-gated coaching + non-Pass locked-teaser upsell; graceful degradation on every path
- [ ] Client-only; no server/engine/`G`/scoring change
- [ ] `docs/ai/STATUS.md` Done entry names WP-595 + D-24026 operator-pending
- [ ] `docs/ai/DECISIONS.md` D-24404 landed Active
- [ ] WORK_INDEX + EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-630:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed (operator-pending)

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-23)
Every surface exists: `fetchEntitlements` (Pass check), `useAuthStore` (token), the WP-594 endpoint (called at runtime), `MyCompetitiveScore.replayHash` (the key), and `EndgameSummary` (the mount point). The composable is store-free (injected deps) → fully unit-testable without Pinia/network. **Boundary:** client-only; no server/engine change; the panel degrades gracefully when WP-594 is absent/unconfigured.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-23)
Layer boundary (arena-client only; talks to the server via never-throw fetch wrappers; imports no server type) — clean. Determinism (no engine/`G`/scoring) — clean. Business alignment (the locked-teaser upsell is the operator-chosen conversion hook) — clean. **RISK considered:** the panel crashing the card if WP-594 is undeployed (avoided — fail-soft states, `status: 0`/`503` → retriable); a guest seeing a broken affordance (avoided — guests get the locked teaser); the child breaking the presentational EndgameSummary tests (fixed — Pinia + benign fetch stub added). Locked in AC-1..AC-6 + D-24404.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)
§1–§21 pass; closed allowlist across arena-client api/composables/hud + tests + governance; `node:test`; `// why:` on the Pass-key value check, the store-free DI seam, and the fail-soft state mapping citing D-24404. §20 N/A. **§21 N/A** — client-only; no `apps/server` endpoint or library-function change (the endpoint was cataloged at WP-594). No ❌ triggers.

## Vision Alignment
**Clauses touched:** §20-26 (endgame/competitive surface — the premium coaching affordance + upsell), monetization (a Pass conversion hook, aligned with the business posture). **Conflict assertion:** `No conflict` — client display only; no rule/determinism change; degrades gracefully. **Non-Goal proximity:** none (NG-1 no-pay-to-win — coaching is post-match advice; the upsell sells the Pass, not gameplay advantage). **Determinism:** no engine `G`/fixture touched.

## Funding Surface Gate
**N/A** — surfaces an existing Pass-gated feature + an upsell; no §20.1 permitted-revenue-vector change. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update
**N/A** — client-only. The `GET /api/me/scores/:replayHash/coach` endpoint was cataloged at WP-594; no server endpoint or `apps/server/src/**` library-function change here.
