# EC-630 — Endgame Coach Client Panel — Execution Checklist

**Source:** docs/ai/work-packets/WP-595-endgame-coach-client-panel.md
**Layer:** Arena Client — new API wrapper + composable + panel + one EndgameSummary wire + tests. No server/engine change.

## Before Starting
- [ ] Baseline: `pnpm install && pnpm -r build` exit 0 (fresh worktree needs install); `vue-tsc` clean
- [ ] Confirm the surfaces: `fetchEntitlements` (billingApi), `useAuthStore().token`, `MyCompetitiveScore.replayHash`, EndgameSummary's competitive-score section, the WP-594 endpoint shape

## Locked Values (do not re-derive)
- Pass key checked by value: `legendary_pass_2026`. CTA target: `?route=me` (the existing billing surface).
- Endpoint: `GET /api/me/scores/:replayHash/coach`; 200 `{ report: StoredCoachReport, wasCached }`.
- Pass status: `guest` (no token) / `has` (key present) / `none` (no key OR failed entitlements read — fail closed).
- Coach fetch: 200 → `ready`; 503 or `error==='coach_unavailable'` → `unavailable` (retriable); `error==='not_entitled'` → `none`+`idle`; else → `error`. No-op without the Pass or without a replay hash.
- Panel renders only when `competitiveScore.replayHash` exists.

## Guardrails (execution order matters)
1. `lib/api/coachApi.ts`: never-throw `fetchCoachReport(authToken, replayHash)`; encode the path segment; Bearer only for a non-null token; `status: 0` on network failure.
2. `composables/useEndgameCoach.ts`: STORE-FREE — inject `{ getToken, fetchEntitlements, fetchCoachReport }`; `initialize()` (Pass status) + `requestCoaching()` (state machine). No store import (the panel wires deps).
3. `components/hud/EndgameCoachPanel.vue`: `defineComponent` form (vue-sfc-loader separate-compile); wire `useAuthStore().token` + the real API fns into `useEndgameCoach`; `onMounted(initialize)`; render Pass button/report/retry vs the non-Pass/guest locked teaser. Data-testids: `arena-hud-coach-panel`, `arena-hud-coach-button`, `arena-hud-coach-report`, `arena-hud-coach-locked`, `arena-hud-coach-upsell`.
4. `components/hud/EndgameSummary.vue`: import + `components: { EndgameCoachPanel }` + render `<EndgameCoachPanel :replay-hash="competitiveScore.replayHash" v-if="competitiveScore && competitiveScore.replayHash" />` after the luck-read block.
5. Tests: coachApi (fetch stub), useEndgameCoach (DI fakes), EndgameCoachPanel (Pinia + URL-routed fetch stub), and update EndgameSummary.test (add `setActivePinia` + a benign entitlements fetch stub in beforeEach — the child now reads the auth store).

- **Client-only:** NO server/engine/`G`/scoring change. If you reach into `apps/server`, STOP.
- **Fail-soft:** the panel must never crash the card when WP-594 is undeployed/unconfigured — every non-200 maps to a graceful state.
- **Store-free composable:** keeps it unit-testable without Pinia; the panel owns the store wiring.

## Required `// why:` Comments
- On the Pass-key value check: the client cannot import the server union, cite WP-594/D-24404.
- On the store-free DI seam: unit-testable without Pinia.
- On the EndgameSummary.test Pinia/fetch-stub addition: the child now reads the auth store + calls entitlements on mount.

## After Completing
- [ ] `vue-tsc` clean; coach client tests + EndgameSummary regression green
- [ ] `pnpm -r build`; `pnpm -r --no-bail test` no new failures
- [ ] STATUS names WP-595 (+ D-24026 pending); DECISIONS D-24404 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`
- [ ] Live-on-surface (D-24026, after WP-594 deploy + key + Pass grant): Pass holder loads coaching; non-Pass sees the locked teaser

## Common Failure Smells (Optional)
- `getActivePinia() was called but there was no active Pinia` in EndgameSummary tests → the child panel reads the auth store; add `setActivePinia(createPinia())` in a beforeEach.
- The panel never shows anything → passStatus stuck `unknown` (initialize not awaited/mounted) or `competitiveScore.replayHash` absent.
- A 503 shows an error wall instead of a retry → the state machine mapped `coach_unavailable` to `error` instead of `unavailable`.
