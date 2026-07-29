# EC-484 — Profile Gauntlet Tracker UI + Play-this-leg launch (Execution Checklist)

**Source:** docs/ai/work-packets/WP-449-profile-gauntlet-tracker-ui.md
**Layer:** App (`apps/arena-client`) + Server (`apps/server`, additive derived-read extension)

## Before Starting
- [ ] WP-440 ✅, WP-445 ✅, WP-446 ✅, WP-448 ✅ are Done on `main` (deps).
- [ ] Baseline `git rev-parse origin/main` == `7ebb8375` (else re-verify the shipped shapes).
- [ ] `apps/arena-client/package.json` has NO `@legendary-arena/registry` dep (the no-registry premise).
- [ ] Exact target file set = `## Files to Produce` below; any file outside it is a FAIL (surface as a blocker).
- [ ] `pnpm -r build && pnpm -r --no-bail test` green; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.

## Locked Values (do not re-derive)
- `GauntletRunStatus = 'needs-heroes' | 'ready' | 'playing' | 'all-legs-cleared' | 'champion'` (verbatim from `gauntletRun.types.ts`).
- `GauntletRunApiResult<T> = { ok: true; value: T } | { ok: false; status: number; code: string | null }`; delete = the no-value variant; network-throw → `{ ok: false, status: 0, code: null }`.
- `GauntletRunLaunch = { mastermindId: string; villainGroupIds: readonly string[]; henchmanGroupIds: readonly string[]; bystandersCount: number; woundsCount: number; officersCount: number; sidekicksCount: number }`; `GauntletRunProgressView.launch: GauntletRunLaunch | null` (null = approved menu unconfigured for `(division, playerCount)`).
- Client `MatchSetupConfig` assembly (nine fields): `schemeId = \`${run.setAbbr}/${leg.schemeId}\``; `mastermindId = run.launch.mastermindId`; `villainGroupIds`/`henchmanGroupIds`/four counts from `run.launch`; `heroDeckIds = run.legPicks[leg.schemeId]` → `launchMatchFromComposition({ config, playerCount: run.playerCount, playerName, authToken })`.
- Approved variant = **index 0** (`approvedLoadouts[playerCount][0]`, D-24199 baseline). Supply counts = canonical server-wiring constants (do NOT gate leg-clear, D-24187); confirm exact values with operator (sub-fork C1).
- Endpoints (WP-445, unchanged): `POST` 201/200, `GET` 200 `{ runs: [] }`, `PATCH /:id`, `DELETE /:id` 204; error codes `unauthorized|account_suspended|invalid_pack|unknown_gauntlet|invalid_leg_picks|not_found`; Auth = `authenticated-session-required`.

## Guardrails
- Derived-display only (D-24262): render server `status`/`isChampion`/`pool`/`budgetHeadroom` — NEVER recompute client-side. Only presentation-local values (last-played-leg highlight, Play-button enablement) are computed.
- `all-legs-cleared` ≠ `champion`: distinct badge + distinct copy; all-legs-cleared shows `budget`/`budgetHeadroom` and reads as strategy, not error.
- Client adds NO runtime import of `@legendary-arena/registry` / `apps/server` / `pg`; `gauntletRunApi.ts` imports only `./apiBaseUrl` + declares wire types inline (mirror `loadoutLibraryApi.ts`).
- Server change is ADDITIVE: no WP-445/446 contract field renamed/removed; `launch` is a new nullable field; progress-inputs gain new fields only.
- Never-throw wrappers; Bearer header only when `authToken !== null`; `MatchSetupConfig` fields passed through unrenamed (00.2 §8.1).
- "Play this leg" enabled ONLY when `hasFullPicks && run.launch !== null`; else disabled + explanatory line (no launch with incomplete/unresolved config).
- `MyProfilePage.vue` stays `defineComponent({ setup() { return {…} } })` (D-6512); new bindings returned from setup().
- STOP (hard) if the server change would need a non-additive WP-445/446 contract touch, or the fold-vs-split fork needs an operator call mid-execution.

## Required `// why:` Comments
- The `schemeId` set-qualification (`${setAbbr}/${leg.schemeId}`): why the bare progress slug is qualified to the D-10014 ext_id for the match config.
- The Play-button gating (`hasFullPicks && launch !== null`): why both conditions are required before a launch.
- The never-throw `fetch` catch in each wrapper: why a thrown fetch maps to `{ ok: false, status: 0, code: null }`.
- The server launch-block `null` branch: why an unconfigured approved menu yields `launch === null` (not an empty composition).
- `server.mjs` wiring of canonical supply counts: why the counts are fixed constants and do not affect leg-clear (D-24187).

## Files to Produce
- `apps/arena-client/src/lib/api/gauntletRunApi.ts` — **new** — never-throw wrappers + inline wire types.
- `apps/arena-client/src/lib/api/gauntletRunApi.test.ts` — **new** — stubbed-`fetch` isolation tests.
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — Gauntlet Runs section (import / tracker / per-leg picks + Play this leg / history).
- `apps/server/src/gauntlet/gauntletRun.types.ts` — **modified (additive)** — `GauntletRunLaunch` + `launch` field + launch inputs.
- `apps/server/src/gauntlet/gauntletRunProgress.logic.ts` — **modified** — derive `launch`.
- `apps/server/src/gauntlet/gauntletRunProgress.logic.test.ts` — **modified** — assert populated + `null` launch.
- `apps/server/src/server.mjs` — **modified (wiring, `01.5`)** — inject variant-0 composition + canonical supply counts.
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — replace `GET /api/me/gauntlet-runs` row wholesale (§21).

## After Completing
- [ ] `pnpm -r build && pnpm -r --no-bail test` exits 0 (arena-client + server suites).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] No file outside `## Files to Produce` modified (`git diff --name-only`); `server.mjs` = wiring-only.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` `GET /api/me/gauntlet-runs` row replaced wholesale (§21; Status closed set, Auth `authenticated-session-required`).
- [ ] `docs/ai/STATUS.md` updated — names the `?route=me` Gauntlet Runs surface.
- [ ] `docs/ai/DECISIONS.md` D-24269 → "Active (post-execution)".
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-449 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] **D-24026 live-verify** on `play.legendary-arena.com/?route=me`: import a `core/magneto` pack → tracker renders → full hero pick → status advances → Play this leg launches → gameover auto-submits → reload → cleared chip + headroom update; all-legs-cleared distinct from champion.

## Common Failure Smells
- A `<unknown>` or crash on Play this leg usually means `run.launch` was null (menu unconfigured) but the button wasn't gated, OR `schemeId` was left as the bare slug instead of `${setAbbr}/${schemeId}`.
- Client recomputing champion/pool (instead of reading the view) = D-24262 violation — remove it.
- A renamed/removed WP-445/446 field in `gauntletRun.types.ts` = non-additive contract touch = STOP.
- `all-legs-cleared` and `champion` sharing one badge/copy path = AC-4 fail.
- A registry/server/pg import creeping into `gauntletRunApi.ts` or `MyProfilePage.vue` = layer violation (Verification Step 3 grep must be zero).
