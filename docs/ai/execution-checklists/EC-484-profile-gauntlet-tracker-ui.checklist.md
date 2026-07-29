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
- Approved variant = **index 0** (`approvedLoadouts[playerCount][0]`, D-24199 baseline); "Play this leg" deterministically launches variant 0, **no variant picker** (deferred optional UX).
- **Supply counts = one named canonical launch table, LOCKED:** `GAUNTLET_LEG_STANDARD_SUPPLY = { bystanders: 30, wounds: 30, officers: 30, sidekicks: 15 } as const` → `bystandersCount`/`woundsCount`/`officersCount`/`sidekicksCount`. **v1 = original/common edition (30 bystanders), NOT 2E's 42.** These are supply-STACK counts for a valid `MatchSetupConfig` — NOT villain-deck cards, NOT scoring. Defined **once** server-side (launch-block resolution / `server.mjs` injection or a small server module it imports; never in a client file, never in the registry). They do NOT gate leg-clear (D-24187); changing them cannot affect WP-442/WP-446 clear/champion derivation. C2 (a new registry per-player-count supply table) was **rejected for v1**.
- Endpoints (WP-445, unchanged): `POST` 201/200, `GET` 200 `{ runs: [] }`, `PATCH /:id`, `DELETE /:id` 204; error codes `unauthorized|account_suspended|invalid_pack|unknown_gauntlet|invalid_leg_picks|not_found`; Auth = `authenticated-session-required`.

## Guardrails
- Derived-display only (D-24262): render server `status`/`isChampion`/`pool`/`budgetHeadroom` — NEVER recompute client-side. Only presentation-local values (last-played-leg highlight, Play-button enablement) are computed.
- `all-legs-cleared` ≠ `champion`: **`champion` = green (trophy/done); `all-legs-cleared` = amber ("strategy remaining")** — distinct badge + distinct copy path; all-legs-cleared heading "All legs cleared", body ≈ "You cleared every leg, but this run is not champion yet because your winning teams use N heroes over the M-hero budget. Trim the run to one legal pool." Show `budget`/`budgetHeadroom`. AVOID "incomplete"/"failed"/"error". champion must NEVER be masked by all-legs-cleared. Status **display order** = WP-446 evaluation order: `champion → all-legs-cleared → playing → ready → needs-heroes`.
- **Fold scope rule (locked):** WP-449 touches client AND server, but ONLY for the minimum launch block "Play this leg" needs — NO new endpoint, NO migration, NO client registry import, NO new progression semantics, and NO change to WP-442/WP-446 truth logic EXCEPT the additive `launch` serialization on the existing `GET`. (A2 split / A3 endpoint were rejected — folded per operator.)
- **Villain-deck table is untouchable (executor confirmation):** if the existing match-setup / engine code has a SEPARATE per-player-count table for *villain-deck* bystanders/strikes/twists/villains/henchmen, WP-449 must NOT replace or touch it. WP-449 only supplies the missing supply-STACK fields (`bystandersCount`/`woundsCount`/`officersCount`/`sidekicksCount`) needed for a valid `MatchSetupConfig`. Confirm at implementation time how the engine consumes these four fields and keep the villain-deck logic untouched.
- **Import affordances:** file upload + paste-JSON are REQUIRED; drag-drop is OPTIONAL polish (include only if essentially free from existing components; must NOT expand the file allowlist or scope). `invalid_pack` errors must be visible + actionable.
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
- `apps/server/src/server.mjs` — **modified (wiring, `01.5`)** — inject variant-0 composition + the named `GAUNTLET_LEG_STANDARD_SUPPLY` launch supply table (defined server-side here or in a small server module it imports; not client, not registry).
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
- Supply counts written as scattered per-leg literals instead of the single named `GAUNTLET_LEG_STANDARD_SUPPLY` constant = Call-1 fail; likewise 42 bystanders (2E) instead of the locked v1 30 = wrong edition.
- Editing / replacing an existing separate per-player-count **villain-deck** supply table (bystanders/strikes/twists/villains/henchmen) = out of scope; WP-449 only adds the four supply-STACK fields — STOP and leave villain-deck logic untouched.
- A variant picker in the UI = Call-3 fail; "Play this leg" must deterministically use approved variant 0.
- Drag-drop treated as a required/blocking import path (or expanding the file allowlist) = Call-5 fail; file + paste are the required paths, drag-drop is optional polish only.
- `champion` and `all-legs-cleared` sharing a badge/copy path, using the same colour, or champion masked by all-legs-cleared = AC-4 fail; champion = green, all-legs-cleared = amber, display order `champion → all-legs-cleared → playing → ready → needs-heroes`.
- Adding a new endpoint / migration / client registry import for the launch composition = Call-2 fold-scope violation; the only server change is the additive `launch` serialization on the existing `GET`.
