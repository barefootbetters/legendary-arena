# EC-369 — Arena-Client Submit-After-Match + "My Scores" (WP-5b) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-339-arena-submit-my-scores.md
**Layer:** Client (`apps/arena-client/**`) — no server/engine change, no migration

## Before Starting
- [ ] WP-338 Done (D-24126 Active): `POST /api/competition/scores { matchId }` + `GET /api/me/scores` live on `main`
- [ ] `pnpm -r build` 0; `apps/arena-client` `typecheck` (vue-tsc) + `test` baseline captured
- [ ] Read `lib/api/ownerProfileApi.ts` (+ `.test.ts`) — the never-throw Bearer-fetch pattern to MIRROR; `apiBaseUrl.ts` (`buildApiUrl`); `stores/auth.ts` (`token`); `stores/uiState.ts` (`snapshot`); `pages/PlayViewport.vue` (`matchId` prop); `pages/MyProfilePage.vue` (`<section data-testid>` + `readAuthToken()`)
- [ ] Target file set == the WP `Files Expected to Change` allowlist

## The Design (settled — do not re-open)
- **Client submits `matchId` only** (it has no `replayHash`; the server resolves + captures + verifies + auto-publishes, WP-338).
- **Submit fires ONCE on the gameover transition, authenticated players only** (guests → prompted to sign in, never submitted). Server is idempotent; client guards with `hasSubmitted`.
- **Watcher mounts at `PlayViewport`** (has `matchId` + reads the store's gameover) — NOT per-page (PlayMobile lacks `matchId`, D-16501).
- **"My Scores"** lives in `MyProfilePage` (owner-authed). The public `PlayerProfilePage` Rank stub is a separate later WP.

## Locked Values (do not re-derive)
- Submit: `POST /api/competition/scores` body `{ matchId: string }`
- Read: `GET /api/me/scores` → `{ scores: MyCompetitiveScore[] }`
- `submissionStatus` ∈ `'idle' | 'submitting' | 'submitted' | 'already' | 'failed' | 'guest'` (`'submitted'` = 200 fresh, `'already'` = 200 `wasExisting`, `'failed'` = non-200 or `status: 0`)
- `MyCompetitiveScore` = LOCAL client interface mirroring `CompetitiveScoreRecord` display fields (NO server import)
- Reserves D-24127

## Guardrails
- `competitionApi` wrappers NEVER throw (network failure → `status: 0`); `Authorization: Bearer` attached ONLY when `authToken !== null` (mirror `ownerProfileApi`)
- The submit body is `{ matchId }` — do NOT send a `replayHash` (the client cannot compute it); `replayHash` appears ONLY as a `MyCompetitiveScore` display field
- The composable fires the submit at most ONCE per match (a `hasSubmitted` ref); a repeated identical snapshot must NOT re-fire; re-arm if the `matchId` changes
- A guest (null token) is a no-op → `submissionStatus = 'guest'`; NEVER POST for a guest
- No client-side engine/server import (HTTP only); no `functions/` edge change; no new npm dep
- `apps/arena-client` has `noUncheckedIndexedAccess` — guard every array/index access
- The gameover status indicator is non-blocking (it must not cover/replace the endgame summary); it lives at the `PlayViewport` level (no deep prop-drill into the HUD)

## Required `// why:` Comments
- `useCompetitiveSubmitOnGameover.ts` fire-once guard: why a `hasSubmitted` ref (the gameover snapshot recurs on every frame; the server is idempotent but the client fires once)
- `useCompetitiveSubmitOnGameover.ts` guest no-op: why a null token skips the POST (guests cannot own/submit; prompt to sign in)
- `competitionApi.ts` submit body: why `matchId` not `replayHash` (the client cannot compute the hash; the server resolves it, WP-338)
- `MyCompetitiveScore` local type: why declared locally, not imported from the server (client must not import `apps/server` types)

## Files to Produce
- `apps/arena-client/src/lib/api/competitionApi.ts` — **new**
- `apps/arena-client/src/lib/api/competitionApi.test.ts` — **new** — mocked fetch (200/wasExisting/409/401/network; Bearer only with token; body `{matchId}`)
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts` — **new**
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.test.ts` — **new** — fire-once / guest / statuses / no-double-fire
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount composable + status indicator
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — "Competitive Scores" section
- `apps/arena-client/src/pages/MyProfilePage.test.ts` — **modified** (if present)
- `docs/ai/DECISIONS.md` — **modified** — D-24127
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` 0 (vue-tsc, noUncheckedIndexedAccess)
- [ ] `pnpm --filter @legendary-arena/arena-client test` green (api + composable + page)
- [ ] Grep: `matchId` present in `competitionApi.ts`; the submit REQUEST body carries no `replayHash`
- [ ] `git diff --name-only apps/server packages/` empty (client-only); no `data/migrations/` file; no `functions/` change
- [ ] `docs/ai/STATUS.md` names the payoff (loop user-complete) + the live-verify deploy dependency (server WP-333..338 + migrations 024/025 PROD-applied)
- [ ] `docs/ai/DECISIONS.md` D-24127 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `git diff --name-only` == allowlist

## Common Failure Smells (Optional)
- The score submits twice / on every frame → the `hasSubmitted` guard is missing or the watcher keys on a recurring snapshot without a transition check
- A guest match POSTs and 401s → the null-token guest guard is missing (should be a `'guest'` no-op)
- vue-tsc red on array access → `noUncheckedIndexedAccess` (guard `scores[i]` / optional chaining)
- The submit sends `replayHash` → wrong body; the client sends `{ matchId }` (it cannot compute the hash)
- The endgame summary is hidden by the status line → the indicator must be non-blocking, at the PlayViewport level
- A network failure throws / breaks the page → the `competitionApi` wrapper must return `status: 0`, never throw
