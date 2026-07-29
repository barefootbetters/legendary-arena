# WP-449 — Profile Gauntlet Tracker UI + Play-this-leg launch (arena-client + server launch-block)

**User-Visible Surface:** `play.legendary-arena.com/?route=me` (the authenticated owner profile — a new **Gauntlet Runs** section)

**Layer:** App (`apps/arena-client`) **+ Server** (`apps/server`, a minimal additive extension of the WP-446 derived read — see `## Context` for the cross-layer resolution)

**Status:** Draft 2026-07-28 · standard two-session lane · **cross-layer (App + Server)** · reserves **D-24269**

---

## Goal

After this session, a signed-in player at `play.legendary-arena.com/?route=me`
has a **Gauntlet Runs** section on `MyProfilePage.vue` that: (1) **imports** a
downloaded Mastermind Gauntlet pack (file picker + paste-JSON **required**;
drag-drop is **optional polish**, mirroring the existing Saved-Loadouts paste
box) via `POST /api/me/gauntlet-runs`; (2) renders the **active-run tracker**
from the WP-446
`GauntletRunProgressView` — the 5-state `status` shown so **`all-legs-cleared`
and `champion` read as visibly distinct states**, the emerging hero **pool** +
**budget headroom**, per-leg rows (scheme name, cleared chip, `hasFullPicks`,
`lastPlayedAt`), and the derived **"where you left off"** leg highlighted; (3)
lets the player **edit a leg's hero picks** (`PATCH`) and press **"Play this
leg"**, which assembles a full `MatchSetupConfig` from the run's picked heroes
plus a **server-supplied launch composition** (villains / henchmen / mastermind
/ supply counts) and launches the match through WP-448's
`launchMatchFromComposition`; and (4) shows **completed-run history** (runs with
`first_completed_at`) with delete/reset. To supply the launch composition to a
client that cannot import the registry, this WP also makes a **minimal additive
server change**: the WP-446 `GauntletRunProgressView` gains a derived per-run
`launch` block (see `## Context` and `## Contract`).

## Assumes

- **WP-440 (Gauntlet Pack Contract) is Done** — `@legendary-arena/registry`
  exports `validateGauntletPack`; the server validates imported packs. (WORK_INDEX
  WP-440 `[x]`.)
- **WP-445 (Import + Run-CRUD API) is Done** — the four `/api/me/gauntlet-runs`
  endpoints exist: `POST` (idempotent import), `GET`, `PATCH /:id`,
  `DELETE /:id`. Auth is `authenticated-session-required`; error codes are the
  closed `GauntletRunErrorCode` set (`unauthorized`, `account_suspended`,
  `invalid_pack`, `unknown_gauntlet`, `invalid_leg_picks`, `not_found`) surfaced
  as `{ error: code }` bodies; `POST` returns 201 (new) / 200 (idempotent
  attach). (WORK_INDEX WP-445 `[x]`; verified against
  `apps/server/src/gauntlet/gauntletRun.{routes,types}.ts` at draft time.)
- **WP-446 (Derived Progression Read) is Done** — `GET /api/me/gauntlet-runs`
  returns `{ runs: GauntletRunProgressView[] }`, each carrying `status`
  (`needs-heroes | ready | playing | all-legs-cleared | champion`), `pool`,
  `budgetHeadroom`, `heroCount`, `budget`, `isChampion`, and
  `legs[{ schemeId, schemeName, cleared, hasFullPicks, lastPlayedAt }]`, plus the
  raw `GauntletRunView` fields (`id`, `setAbbr`, `mastermindSlug`, `division`,
  `playerCount`, `legPicks`, `createdAt`, `updatedAt`, `firstCompletedAt`).
  `legs[].schemeId` is a **bare scheme slug**; `legPicks` is keyed by that same
  bare slug. (Verified against `gauntletRun.types.ts` + `gauntletRunProgress.logic.ts`.)
- **WP-448 (Composition→Match Launch Primitive) is Done** —
  `apps/arena-client/src/lobby/useCreateMatchFromComposition.ts` exports the
  never-throw `async launchMatchFromComposition({ config: MatchSetupConfig;
  playerCount: number; playerName: string; authToken: string })` returning
  `{ ok: true, matchID } | { ok: false, message }`; on success it runs
  `createMatch → persistMatchSetup → joinMatch(seat '0') → navigate`. (WORK_INDEX
  WP-448 `[x]`; verified against the module.)
- **`apps/arena-client/src/pages/MyProfilePage.vue` exists** as a
  `defineComponent({ setup() { return {…} } })` SFC (D-6512), already rendering a
  Saved-Loadouts paste box (`submitCreateLoadout` guards the paste with a local
  `JSON.parse` before POST) and a read-only Competitive Scores list
  (`fetchMyScores`). It reads the owner auth token via `useAuthStore().token`
  (`readAuthToken()`).
- **`apps/arena-client/src/lib/api/loadoutLibraryApi.ts` exists** as the
  reference client-wrapper pattern: `LoadoutApiResult<T> = { ok: true; value: T }
  | { ok: false; status; code }`, `parseLoadoutFailure` reading `{ error: code }`,
  never-throw `fetch` wrappers, Bearer auth via `buildApiUrl`.
- **`apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts`
  exists** and auto-submits the finished match's score on gameover for a signed-in
  player (POST `{ matchId }`). This WP does **not** touch it; the tracker relies on
  it so a played leg's cleared chip lights up on the **next** tracker load.
- **`?route=me` is a guarded route** — `apps/arena-client/src/auth/routeAuthPolicy.ts`
  `isGuardedRoute('me') === true`; App.vue blocks render and redirects to
  `?route=login` when no session exists. The tracker inherits this guard by living
  inside `MyProfilePage.vue`; no new guard is added.
- **`apps/arena-client` does NOT (and per the layer rules MUST NOT) import
  `@legendary-arena/registry` at runtime** — verified: its `package.json`
  `dependencies` are `preplan`, `hanko`, `boardgame.io`, `howler`, `pinia`, `vue`
  (registry appears nowhere, not even devDeps). This is the load-bearing fact
  behind the server launch-block extension (see `## Context`).
- **The server's WP-446 derivation already holds the approved adversary
  composition** — `GauntletRunProgressInputs.approvedLoadouts:
  GauntletApprovedLoadouts` (`Record<playerCount, GauntletApprovedLoadout[]>`,
  each with `villainGroupIds` + `henchmanGroupIds`), built in `server.mjs` from
  the startup gauntlet catalog. Exposing it in the derived view is additive.
- **Baseline:** `origin/main` @ **`7ebb8375`** (`git rev-parse origin/main`;
  `check-number-ledger.mjs --next` returns WP-449 / EC-484 / D-24269).

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Layer Boundary (Authoritative): the App layer and
  its import rules (`apps/arena-client` may import the Runtime-Safe Engine Surface
  type-only for `MatchSetupConfig`; must NOT import `registry`, `server`, or `pg`
  at runtime) **and** the Server layer (the server owns registry-derived data and
  exposes read-only projections over HTTP).
- `.claude/rules/architecture.md` — §Import Rules (Quick Reference) rows for
  `apps/arena-client` (no runtime `registry`) and `apps/server`.
- `.claude/rules/code-style.md` — pure-helper discipline, no `.reduce()` with
  branching, naming (`is/has/can` booleans, full English words), full-sentence
  errors, JSDoc on every function.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 — the nine `MatchSetupConfig`
  field names (`schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`); this WP assembles a `MatchSetupConfig` and renames nothing.
- `docs/ai/REFERENCE/api-endpoints.md` — the `GET /api/me/gauntlet-runs` row this
  WP replaces wholesale (§21; the response shape gains the `launch` block).
- `docs/ai/DECISIONS.md` — scan D-24187 (fixed-pool budget = `heroCount + 2`;
  the leg-clear predicate matches villain-segment + henchman-key + scheme +
  mastermind — supply counts are **not** part of leg-clear), D-24199 (the three
  approved adversary variants per player count), D-24262 (derived-progression
  lock — the client renders derived truth, never recomputes it), D-24264 /
  D-24265 (the run-API + derived-read contracts), D-24268 (the WP-448 launch
  primitive), D-10014 (composition ids are set-qualified `setAbbr/slug`),
  D-24092 (playing a seat requires an account).
- `apps/arena-client/src/pages/MyProfilePage.vue` — the Saved-Loadouts paste box
  (`submitCreateLoadout`, `createLagnText`, `createError`) and the Competitive
  Scores list are the patterns to mirror.
- `apps/arena-client/src/lib/api/loadoutLibraryApi.ts` — the never-throw wrapper
  pattern to mirror byte-for-byte in shape.
- `apps/server/src/gauntlet/gauntletRun.types.ts`,
  `gauntletRunProgress.logic.ts` — the derived-view types + logic the server
  extension is additive to; `apps/server/src/legends/gauntlet.logic.ts`
  (`GauntletApprovedLoadout`, `GauntletApprovedLoadouts`).

**The Play-this-leg composition-assembly resolution (the load-bearing design
decision; flagged for operator review — see `## Contract` and D-24269).**
"Play this leg" needs a full nine-field `MatchSetupConfig`. The run stores the
player's `legPicks` (heroes only) — never the adversary composition or supply
counts. Of the nine fields the client can derive **three** with no registry:
`schemeId = \`${run.setAbbr}/${leg.schemeId}\`` (leg.schemeId is a bare slug; the
match config wants the set-qualified ext_id, D-10014), `mastermindId =
\`${run.setAbbr}/${run.mastermindSlug}\``, and `heroDeckIds =
run.legPicks[leg.schemeId]`. It **cannot** derive the other six: `villainGroupIds`
+ `henchmanGroupIds` come from the gauntlet's **approved adversary variant** (a
registry-resolved menu — WP-444 resolved these *client-side in registry-viewer*,
but **arena-client cannot import the registry**, confirmed in `## Assumes`), and
the four supply counts (`bystandersCount`, `woundsCount`, `officersCount`,
`sidekicksCount`) have **no registry source at all** (`PLAYER_COUNT_SETUP` carries
only `heroCount` / group counts; the lobby reads supply counts out of a LAGN
document, which a gauntlet run has none of). **A server touch is therefore
unavoidable** for any working "Play this leg." **Chosen resolution (operator-confirmed):** extend the
WP-446 derived `GauntletRunProgressView` with a per-run `launch` block the server
resolves from data it already holds (the approved variant-0 composition + the
named canonical launch supply table `GAUNTLET_LEG_STANDARD_SUPPLY`, see
`## Contract`); the client assembles the `MatchSetupConfig` from that block + its
three derivable fields. This fold — client **and** server touched in one WP for
the minimum launch block "Play this leg" needs — is **the confirmed
architecture**, not a live fork (the client cannot import the registry, so the
launch composition must arrive over the existing HTTP read). Alternatives (split /
new-endpoint) are recorded in `## Contract` as considered-and-rejected.

**Cross-layer scope (fold confirmed by operator):** this WP is **cross-layer
(App + Server)** and sits at the ~8-file split threshold. The App half (the
tracker UI + API wrappers) is the natural WP-7 of the epic; the Server half is a
**minimal additive extension** of WP-446's already-derived read (one new derived
sub-object, no new endpoint, no migration, no contract file). The two halves
communicate only over HTTP — no import-boundary is crossed. **The operator
confirmed the fold:** the client cannot import the registry, so extending the
WP-446 derived `GET` with an additive `launch` block is *the* architecture, not
one option among several. **Scope rule (locked):** WP-449 may touch client **and**
server, but **only** for the minimum launch block "Play this leg" needs — **NO**
new endpoint, **NO** migration, **NO** client registry import, **NO** new
progression semantics, and **NO** change to WP-442 / WP-446 truth logic **except**
the additive `launch` serialization on the existing `GET`. The split-into-its-own-
server-WP and dedicated-endpoint options are **considered and rejected** (see
`## Contract`); they are no longer live alternatives. Recorded in D-24269.

## Scope (In)

- **New client API module** `apps/arena-client/src/lib/api/gauntletRunApi.ts` —
  typed, never-throw `fetch` wrappers (Bearer auth via `buildApiUrl`) mirroring
  `loadoutLibraryApi.ts`:
  - `importGauntletRun(authToken, pack: unknown)` → `POST /api/me/gauntlet-runs`
    (201 new / 200 attach → `{ ok: true, value: GauntletRunProgressView }`; typed
    failure branch carrying `status` + closed-set `code`).
  - `listGauntletRuns(authToken)` → `GET /api/me/gauntlet-runs` (200 →
    `{ ok: true, value: { runs: GauntletRunProgressView[] } }`).
  - `updateLegPicks(authToken, id, legPicks)` → `PATCH /api/me/gauntlet-runs/:id`.
  - `deleteGauntletRun(authToken, id)` → `DELETE /api/me/gauntlet-runs/:id` (204).
  - The wire types (`GauntletRunProgressView`, `GauntletRunLegProgress`,
    `GauntletRunLaunch`, `GauntletRunStatus`) are declared **inline** by
    structural compatibility with the server (no server-type import) — exactly as
    `loadoutLibraryApi.ts` mirrors `SavedLoadoutView`.
- **New client test** `apps/arena-client/src/lib/api/gauntletRunApi.test.ts` —
  stubbed-`fetch` isolation tests for each wrapper (success + a non-2xx typed
  failure + a network-throw → `{ ok: false, status: 0, code: null }`).
- **Modify** `apps/arena-client/src/pages/MyProfilePage.vue` — add one
  `.profile-gauntlets` `<section>` (rendered inside the existing `?route=me`
  guarded body) delivering:
  - **Import**: a file `<input type="file">` **and** a paste-JSON textarea are
    **required**; a drag-drop target is **optional polish** (include only if it is
    essentially free from existing components — it must NOT expand the file
    allowlist or add scope). Each path reads text, `JSON.parse`-guards locally
    (mirroring `submitCreateLoadout`), and calls `importGauntletRun`. Friendly
    typed messages for `invalid_pack` / `unknown_gauntlet` / `unauthorized` (a
    `gauntletRunMessageForCode` mapper, mirroring `loadoutMessageForCode`) — the
    `invalid_pack` error is visible and actionable.
  - **Active tracker** (each run with `firstCompletedAt === null`): the 5-state
    `status` rendered as a badge with **distinct treatment for `all-legs-cleared`
    vs `champion`**:
    - `champion` = **green** trophy / completed / done (celebratory).
    - `all-legs-cleared` = **amber** "strategy remaining" state, NOT an error.
      Heading **"All legs cleared"**; body (this wording or very close): "You
      cleared every leg, but this run is not champion yet because your winning
      teams use N heroes over the M-hero budget. Trim the run to one legal pool."
      Show `budget` / `budgetHeadroom`. AVOID "incomplete" / "failed" / "error" —
      the player did the hard part; the rest is optimization.
    - champion must **never** be masked by all-legs-cleared; the two states occupy
      separate badge + copy paths.
    Then: the emerging `pool` (count + headroom); per-leg rows (`schemeName`, a
    cleared chip, a `hasFullPicks` indicator, `lastPlayedAt`); the derived
    **last-played leg** (the leg with the max non-null `lastPlayedAt`) visually
    highlighted as "where you left off". The status **display order** matches
    WP-446's evaluation order: `champion → all-legs-cleared → playing → ready →
    needs-heroes`.
  - **Per-leg hero picks**: an editable `heroDeckIds` input per leg → `PATCH`
    (`updateLegPicks`); then a **"Play this leg"** button — enabled only when
    that leg's `hasFullPicks` is true **and** the run's `launch` block is present
    — that assembles the `MatchSetupConfig` (per `## Contract`) and calls
    `launchMatchFromComposition({ config, playerCount: run.playerCount,
    playerName, authToken })`, setting an inline error from `{ ok: false }.message`.
  - **History**: runs with `firstCompletedAt !== null` listed separately (champion
    status re-derived from the same view), each with a **delete/reset** control
    (`deleteGauntletRun`).
- **Modify (server, additive)** `apps/server/src/gauntlet/gauntletRun.types.ts` —
  add the `GauntletRunLaunch` interface and a `readonly launch:
  GauntletRunLaunch | null` field on `GauntletRunProgressView`; add the launch
  inputs (variant-0 `villainGroupIds` / `henchmanGroupIds` + the four supply
  counts + `mastermindId`) to `GauntletRunProgressInputs`. Additive only — no
  existing field renamed or removed (the WP-445/446 A-packet contract shapes are
  preserved).
- **Modify (server)** `apps/server/src/gauntlet/gauntletRunProgress.logic.ts` —
  populate `launch` at read time from the injected inputs; `null` when the
  gauntlet's approved menu is unconfigured for the run's `(division, playerCount)`.
- **Modify (server test)** `apps/server/src/gauntlet/gauntletRunProgress.logic.test.ts` —
  assert the derived `launch` block (present with variant-0 ids + counts when the
  menu is configured; `null` when absent).
- **Modify (server wiring)** `apps/server/src/server.mjs` — inject the variant-0
  approved composition + the named canonical launch supply table
  `GAUNTLET_LEG_STANDARD_SUPPLY` (defined server-side in the launch-block
  resolution layer — the `server.mjs` injection or a small server module it
  imports; NOT in any client file and NOT in the registry) into the
  `resolveGauntletRunProgressInputs` resolver it already builds (per `01.5`
  runtime-wiring allowance; no logic beyond wiring).
- **Modify** `docs/ai/REFERENCE/api-endpoints.md` — replace the
  `GET /api/me/gauntlet-runs` row wholesale (§21): the response now carries the
  per-run `launch` block; `Status`/`Auth`/`Authorizing WP` columns re-populated.

## Out of Scope

- **No variant selector (deferred, not forgotten).** "Play this leg"
  **deterministically** launches against **approved variant 0** (the D-24199
  baseline) for v1; the UI exposes **no** variant picker. Surfacing the other
  approved variants as a launch-time choice is a **deferred optional UX**
  follow-on — the run's picks are leg-scoped and variant-agnostic (any approved
  variant's win clears the leg), so a selector is additive later and changes no
  stored truth.
- **No client-side status / champion / pool recomputation.** The client renders
  the server's `GauntletRunProgressView` verbatim (D-24262). It computes only
  presentation-local values (which leg is last-played for highlighting; whether a
  Play button is enabled) — never `status`, `isChampion`, `pool`, or `budgetHeadroom`.
- **No new endpoint and no migration.** The server change is a single additive
  derived sub-object on the existing `GET` read.
- **No change to `useCompetitiveSubmitOnGameover.ts`** — score submission stays
  the existing auto-submit-on-gameover path; the tracker only re-reads after.
- **No change to `launchMatchFromComposition` / `createMatch` / `joinMatch`
  contracts** — the tracker is a new caller of the WP-448 primitive, unchanged.
- **No open-division badge** — surfacing secondary open per-leg clears beside the
  fixed championship is the epic's separate optional follow-on (plan item 8).
- **No Saved-Loadouts interaction** — gauntlet run picks live only in
  `legPicks`; the 50-loadout cap is never touched.
- **No `?pack=` / `?route=` deep-link import** — legends is cross-origin and
  zero-API; the file round-trip is the import primitive (import is on `?route=me`).

## Files Expected to Change

- `apps/arena-client/src/lib/api/gauntletRunApi.ts` — **new** — never-throw typed
  wrappers for the four `/api/me/gauntlet-runs` calls + inline mirrored wire types.
- `apps/arena-client/src/lib/api/gauntletRunApi.test.ts` — **new** — stubbed-`fetch`
  isolation tests (success + typed-failure + network-throw per wrapper).
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — add the
  Gauntlet Runs section (import, active tracker, per-leg picks + Play this leg,
  history) and its setup() state/handlers.
- `apps/server/src/gauntlet/gauntletRun.types.ts` — **modified (additive)** — add
  `GauntletRunLaunch` + `launch` on `GauntletRunProgressView` + launch inputs on
  `GauntletRunProgressInputs`.
- `apps/server/src/gauntlet/gauntletRunProgress.logic.ts` — **modified** — derive
  the `launch` block at read time.
- `apps/server/src/gauntlet/gauntletRunProgress.logic.test.ts` — **modified** —
  assert the derived `launch` block (present + `null` cases).
- `apps/server/src/server.mjs` — **modified (wiring, `01.5`)** — inject variant-0
  composition + canonical supply counts into the progress-inputs resolver.
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — replace the
  `GET /api/me/gauntlet-runs` row (response shape now carries `launch`).
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — add the `[ ]` WP-449 row.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — add the EC-484 →
  WP-449 Pending row.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — add the `📝` WP-449 node; regen counts.
- `docs/ai/NUMBER-LEDGER.md` — **modified** — WP-449 / EC-484 / D-24269 reservations.
- `docs/ai/DECISIONS.md` — **modified** — draft D-24269 (Drafted; not yet landed).

## Contract

### Client API wrappers (`gauntletRunApi.ts`)

Result discriminator mirrors `loadoutLibraryApi.ts`:
`GauntletRunApiResult<T> = { ok: true; value: T } | { ok: false; status: number;
code: string | null }` (failure `code` read from the server's `{ error: code }`
body; `null` on network/parse failure or an unrecognized code). `deleteGauntletRun`
returns `{ ok: true } | { ok: false; status; code }` (204 success, no value).
Every wrapper is never-throw: a thrown `fetch` maps to `{ ok: false, status: 0,
code: null }`. Bearer auth header is attached only when `authToken !== null`.

Inline mirrored wire types (structural, no server import):
`GauntletRunStatus = 'needs-heroes' | 'ready' | 'playing' | 'all-legs-cleared' |
'champion'`; `GauntletRunLegProgress = { schemeId; schemeName; cleared;
hasFullPicks; lastPlayedAt }`; `GauntletRunProgressView` = the raw run fields +
`status`, `pool`, `budgetHeadroom`, `heroCount`, `budget`, `isChampion`,
`legs[]`, **and `launch: GauntletRunLaunch | null`**.

### Server launch block (`GauntletRunLaunch`, additive to the WP-446 view)

```
GauntletRunLaunch = {
  mastermindId:     string;            // `${setAbbr}/${mastermindSlug}` (D-10014)
  villainGroupIds:  readonly string[]; // approved variant 0 @ playerCount
  henchmanGroupIds: readonly string[]; // approved variant 0 @ playerCount
  bystandersCount:  number;
  woundsCount:      number;
  officersCount:    number;
  sidekicksCount:   number;
}
```

`GauntletRunProgressView.launch` is `GauntletRunLaunch | null`; `null` when the
gauntlet's approved menu is unconfigured for the run's `(division, playerCount)`
(the same condition under which the WP-446 leg-clear loadout clause is skipped).
When `null`, "Play this leg" is disabled with an explanatory line. `villainGroupIds`
/ `henchmanGroupIds` are copied from `approvedLoadouts[playerCount][0]` (index 0 =
approved variant 0, the D-24199 baseline). The four supply counts are the
**canonical launch supply counts** injected by the server wiring layer.

### Client-side `MatchSetupConfig` assembly (per leg)

```
config = {
  schemeId:         `${run.setAbbr}/${leg.schemeId}`,   // set-qualify the bare slug
  mastermindId:     run.launch.mastermindId,
  villainGroupIds:  run.launch.villainGroupIds,
  henchmanGroupIds: run.launch.henchmanGroupIds,
  heroDeckIds:      run.legPicks[leg.schemeId],
  bystandersCount:  run.launch.bystandersCount,
  woundsCount:      run.launch.woundsCount,
  officersCount:    run.launch.officersCount,
  sidekicksCount:   run.launch.sidekicksCount,
}
→ launchMatchFromComposition({ config, playerCount: run.playerCount, playerName, authToken })
```

### Canonical launch supply table (`GAUNTLET_LEG_STANDARD_SUPPLY`, LOCKED)

The four supply counts in the `launch` block come from **one named canonical v1
launch table** (not scattered per-leg literals):

```
GAUNTLET_LEG_STANDARD_SUPPLY = {
  bystanders: 30,
  wounds:     30,
  officers:   30,
  sidekicks:  15,
} as const
```

- These are **available supply-STACK counts** used to construct a valid
  `MatchSetupConfig` at launch — they map to `bystandersCount` / `woundsCount` /
  `officersCount` / `sidekicksCount`. They are **NOT** "cards inserted into the
  villain deck," and they carry **no scoring / progression semantics**.
- **v1 = the original / common Legendary edition counts** (30 bystanders),
  deliberately **NOT** 2nd Edition (which uses 42) — do not silently switch
  editions.
- The table lives **server-side** in the launch-block resolution layer (the
  `server.mjs` injection or a small server module it imports); it is defined
  **once** as this named constant and referenced there — no per-leg supply
  literals are scattered across the UI.
- **Executor confirmation (implementation-time, put in the EC):** if the existing
  match-setup / engine code has a **separate per-player-count table** for
  *villain-deck* bystanders / strikes / twists / villains / henchmen, WP-449 must
  **NOT** replace or touch it. WP-449 only supplies the missing supply-STACK
  fields (`bystandersCount` / `woundsCount` / `officersCount` / `sidekicksCount`)
  needed for a valid `MatchSetupConfig`. Confirm at implementation time how the
  engine consumes these four fields and keep the villain-deck logic untouched.
- **Non-effect on derivation:** because the D-24187 leg-clear predicate matches
  only villain-segment + henchman-key + scheme + mastermind, **supply counts do
  not affect whether a leg clears or whether a run reaches champion**. Changing
  this table later cannot alter WP-442 / WP-446 clear / champion derivation — the
  table is a v1 launch default only.

### Alternatives (considered and rejected — folded per operator)

- **A2 — split the server half into its own single-layer server WP** (one-layer-
  per-WP purity; costs a second cycle + a BLOCKED status here). **Considered and
  rejected; folded into WP-449 per operator.** Not a live alternative.
- **A3 — a dedicated launch-config endpoint** (`GET
  /api/me/gauntlet-runs/:id/legs/:schemeId/launch-config` returning a full
  `MatchSetupConfig`): more surface + a per-leg round-trip for data the derived
  read carries inline. **Considered and rejected** (heavier); no new endpoint.
- **C2 — a new registry per-player-count supply-count table** (more faithful to
  official per-count setup, larger): **rejected for v1** in favour of the named
  `GAUNTLET_LEG_STANDARD_SUPPLY` constant above.

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets, no
  "show only the changed section".
- ESM only; Node v22+.
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`. Full English
  words, `is/has/can` booleans, JSDoc on every function, `// why:` on non-obvious
  code, full-sentence error messages, no `.reduce()` with branching, no premature
  abstraction.

**Packet-specific:**
- **Derived-display only (D-24262).** The client renders the server's
  `GauntletRunProgressView` — it never recomputes `status`, `isChampion`, `pool`,
  or `budgetHeadroom`. No stored client state beyond the fetched view + local edit
  buffers (the leg-picks input drafts).
- **`all-legs-cleared` ≠ `champion` must be visibly distinct** — `champion` =
  **green** (trophy / done); `all-legs-cleared` = **amber** ("strategy remaining"):
  separate badge treatment + separate copy path. The all-legs-cleared copy names
  the budget gap (`budget` / `budgetHeadroom`) as strategy, never an error (no
  "incomplete" / "failed" / "error" wording). champion must never be masked by
  all-legs-cleared. The status **display order** matches WP-446's evaluation order:
  `champion → all-legs-cleared → playing → ready → needs-heroes`.
- **Canonical launch supply table (`GAUNTLET_LEG_STANDARD_SUPPLY`).** The four
  supply counts come from the **single named server-side constant** (`{ bystanders:
  30, wounds: 30, officers: 30, sidekicks: 15 }`, v1 original edition — not 2E's
  42); no per-leg supply literals are scattered across the UI. These are
  supply-STACK counts for a valid `MatchSetupConfig`, not villain-deck cards and
  not scoring — changing them cannot affect WP-442 / WP-446 clear / champion
  derivation (D-24187). Any existing separate per-player-count **villain-deck**
  supply table is **not touched**.
- **Fold scope rule (locked).** WP-449 touches client **and** server, but **only**
  for the minimum launch block "Play this leg" needs — **NO** new endpoint, **NO**
  migration, **NO** client registry import, **NO** new progression semantics, and
  **NO** change to WP-442 / WP-446 truth logic **except** the additive `launch`
  serialization on the existing `GET`.
- **Variant 0 only (no picker).** "Play this leg" deterministically launches
  approved variant 0 (`approvedLoadouts[playerCount][0]`, D-24199); the UI exposes
  no variant selector (deferred optional UX).
- **Import affordances.** File upload + paste-JSON are **required**; drag-drop is
  **optional polish** that must NOT expand the file allowlist or scope.
  `invalid_pack` errors are visible and actionable.
- **Layer boundary.** `apps/arena-client` imports `MatchSetupConfig` type-only
  from `@legendary-arena/game-engine` (via the WP-448 primitive's input type) and
  adds **no** runtime import of `@legendary-arena/registry`, `apps/server`, or
  `pg`. `gauntletRunApi.ts` imports only `./apiBaseUrl` and declares wire types
  inline. The server change touches only the server layer.
- **Never-throw API wrappers** — every wrapper returns a typed result; a thrown
  `fetch` maps to `{ ok: false, status: 0, code: null }`.
- **`MatchSetupConfig` passes through unrenamed** — the nine field names (00.2
  §8.1) are neither renamed nor abbreviated in the assembly.
- **Server change is additive** — no WP-445/446 A-packet contract field is
  renamed or removed; `launch` is a new nullable field, and the progress-inputs
  gain new fields only.
- **`defineComponent`/`setup` constraint (D-6512)** — `MyProfilePage.vue` stays a
  `defineComponent({ setup() { return {…} } })` SFC; new bindings are returned
  from `setup()`.
- **Play button gating** — "Play this leg" is enabled only when the leg's
  `hasFullPicks` is true **and** `run.launch !== null`; otherwise disabled with an
  explanatory line (no launch attempt with an incomplete or unresolved config).

**Session protocol:** if any step is unclear, if the server change would require
touching a WP-445/446 contract field non-additively, or if the split-vs-fold
sizing fork needs an operator decision mid-execution, STOP and ask.

**Locked contract values:** the `GauntletRunLaunch` shape, the client assembly
mapping (both in `## Contract`), the 5-state `GauntletRunStatus` union, and the
never-throw result discriminator (see EC-484 Locked Values).

## Acceptance Criteria

1. `apps/arena-client/src/lib/api/gauntletRunApi.ts` exists and exports
   `importGauntletRun`, `listGauntletRuns`, `updateLegPicks`, `deleteGauntletRun`,
   each never-throw and returning the typed `GauntletRunApiResult` discriminator
   (delete returns the no-value variant); all attach Bearer auth via `buildApiUrl`
   and import nothing from `registry` / `server` / `pg`.
2. `gauntletRunApi.test.ts` asserts, per wrapper, a success path, a non-2xx typed
   failure carrying the server `code`, and a network-throw → `{ ok: false,
   status: 0, code: null }` — using a stubbed `fetch`, `node:test` + `node:assert`,
   no boardgame.io / network / DB.
3. `MyProfilePage.vue` renders a `.profile-gauntlets` section inside the guarded
   body with: an import control (file + drag-drop + paste, each `JSON.parse`-guarded
   before POST), the active-run tracker, per-leg rows, and the completed-history list.
4. The 5-state `status` is rendered so **`all-legs-cleared` (amber) and `champion`
   (green) have distinct badge treatment and distinct copy**; the all-legs-cleared
   copy shows `budget` + `budgetHeadroom`, explains the budget/pool gap directly,
   and reads as strategy, not error; champion is never masked by all-legs-cleared;
   the status display order matches WP-446's evaluation order (`champion →
   all-legs-cleared → playing → ready → needs-heroes`).
5. Each active run shows its `pool` size, `budgetHeadroom`, and per-leg rows
   (`schemeName`, cleared chip, `hasFullPicks` indicator, `lastPlayedAt`); the
   derived last-played leg is visually highlighted as "where you left off".
6. Editing a leg's `heroDeckIds` and saving issues `PATCH
   /api/me/gauntlet-runs/:id` via `updateLegPicks`; the tracker reflects the
   returned/refetched view.
7. "Play this leg" is enabled only when `hasFullPicks && run.launch !== null`,
   assembles the `MatchSetupConfig` exactly per `## Contract` (nine fields,
   set-qualified `schemeId`/`mastermindId`, heroes from `legPicks`, adversary +
   counts from `run.launch`), and calls `launchMatchFromComposition`; on
   `{ ok: false }` it sets an inline error from `.message`.
8. `GauntletRunProgressView` (server) carries `launch: GauntletRunLaunch | null`;
   `gauntletRunProgress.logic.ts` populates it from the injected variant-0
   composition + canonical supply counts, and `null` when the approved menu is
   unconfigured for the run's `(division, playerCount)`.
9. `gauntletRunProgress.logic.test.ts` asserts both the populated-`launch` and
   `launch === null` cases; no WP-445/446 contract field is renamed or removed
   (additive only).
10. `docs/ai/REFERENCE/api-endpoints.md`'s `GET /api/me/gauntlet-runs` row is
    replaced wholesale with the `launch`-carrying response shape; `Status` ∈ the
    closed set, `Auth = authenticated-session-required`, canonical field names.
11. `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
12. `pnpm -r build && pnpm -r --no-bail test` green (arena-client suite incl. the
    new API tests; server suite incl. the extended progress-logic test).
13. **Canonical launch supply table (Call 1).** One named canonical launch supply
    constant/table (`GAUNTLET_LEG_STANDARD_SUPPLY = { bystanders: 30, wounds: 30,
    officers: 30, sidekicks: 15 }`, v1 original edition) exists server-side; "Play
    this leg" uses that table for the launch-only supply counts; no per-leg
    arbitrary supply literals are scattered across the UI; the table is documented
    as a v1 launch default (not a scoring / leg-clear rule); changing the table
    later cannot affect WP-442 / WP-446 clear / champion derivation. Any existing
    separate per-player-count villain-deck supply table is left untouched.
14. **Variant 0 only (Call 3).** "Play this leg" deterministically launches
    approved variant 0; the UI exposes no variant picker; the variant selector is
    documented as deferred optional UX (not forgotten).
15. **Import affordances (Call 5).** Import by file works; import by pasted JSON
    works; `invalid_pack` errors are visible + actionable; drag-drop, if present,
    is optional polish (not a blocker) and does not expand the file allowlist.
16. **Fold scope (Call 2).** The server change is the single additive `launch`
    serialization on the existing `GET` — no new endpoint, no migration, no client
    registry import, no new progression semantics, and no change to WP-442 /
    WP-446 truth logic.

## Verification Steps

```bash
# 1. Build all (packages' dist feed the app + server tests) then run suites.
pnpm -r build                                             # expect: exit 0
pnpm -r --no-bail test                                    # expect: exit 0 (arena-client + server)

# 2. Arena-client SFC typecheck (vite build + node:test do NOT typecheck).
pnpm --filter @legendary-arena/arena-client typecheck     # expect: exit 0

# 3. No runtime registry/server/pg import leaked into the client additions.
git grep -n "@legendary-arena/registry\|apps/server\|from 'pg'" -- apps/arena-client/src/lib/api/gauntletRunApi.ts apps/arena-client/src/pages/MyProfilePage.vue   # expect: zero matches

# 4. The server view carries the additive launch field (no WP-445/446 field removed).
git grep -n "launch" -- apps/server/src/gauntlet/gauntletRun.types.ts   # expect: GauntletRunLaunch + the launch field

# 5. D-24026 live-verify (post-deploy, on play.legendary-arena.com/?route=me):
#    sign in → import a Magneto (core/magneto) gauntlet pack → the tracker renders
#    status needs-heroes → enter a full hero pick for a leg → status advances to
#    ready and "Play this leg" enables → press it → the match launches (?match=…) →
#    on gameover the auto-submit records the score → reload ?route=me → that leg's
#    cleared chip is set and headroom updates. Confirm all-legs-cleared (over budget)
#    renders visibly distinct from champion.
```

## Definition of Done

- [ ] All Acceptance Criteria (1–16) pass.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] `pnpm -r build && pnpm -r --no-bail test` green.
- [ ] No files outside `## Files Expected to Change` were modified
      (`git diff --name-only`); `server.mjs` change is wiring-only (`01.5`).
- [ ] `docs/ai/REFERENCE/api-endpoints.md` `GET /api/me/gauntlet-runs` row replaced
      wholesale (§21).
- [ ] `docs/ai/STATUS.md` updated — names the new `?route=me` Gauntlet Runs surface.
- [ ] `docs/ai/DECISIONS.md` D-24269 flipped to "Active (post-execution)".
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-449 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph moved `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] **D-24026 live-on-surface verification** performed on
      `play.legendary-arena.com/?route=me` per Verification Step 5 (import → pick →
      Play this leg → cleared chip updates; all-legs-cleared distinct from champion).

## Vision Alignment

**Vision clauses touched:** §3 (identity — the tracker is the authenticated owner
surface, and launching a leg requires an account, D-24092), §11 (account-local
visibility — run state is owner-only), §19b (account-local saved content — run
picks are account-local, non-portable), §20–26 (scoring/leaderboards-adjacent —
the tracker reads derived clear/champion status computed from
`competitive_scores`; it renders, never re-scores), NG-1.

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The
tracker is a read/edit surface over derived server truth (D-24262); scoring and
champion derivation stay server-authoritative, the account gate is unchanged, and
nothing about fairness, PAR, or monetization moves.

**Non-Goal proximity check:** None of NG-1..7 are crossed. No pay-to-win surface,
no persuasive/competitive change beyond surfacing the player's own derived
progression; "Play this leg" reuses the existing create/join + auto-submit paths.

**Determinism preservation:** N/A to the engine — this is client-side profile
UI plus an additive read-only server projection. It touches no `G`/`ctx`, no
`ctx.random`, no replay/scoring/simulation write path, and no `finalStateHash`
surface. The supply counts it carries do not affect leg-clear qualification
(D-24187) and are consumed only as ordinary match-setup inputs.

## Funding Surface Gate

**N/A** — this WP touches no WP-097 §A/§B/§C funding affordance, no tournament
funding channel, and no user-visible "donate/support" copy; it is a gauntlet
progression tracker plus an additive read-only server projection, with no funding
surface anywhere in scope.

## §21 — API Catalog

**Triggered — not N/A.** This WP **modifies the response shape** of the existing
`GET /api/me/gauntlet-runs` endpoint (each `GauntletRunProgressView` gains the
additive `launch` block). Per §21.1 (modifies response shape of a catalogued
endpoint) the executing session MUST replace the `GET /api/me/gauntlet-runs` row
in `docs/ai/REFERENCE/api-endpoints.md` **wholesale** (D-11804 replace-whole-row
semantics) in the same commit: `Status` stays `Wired`; `Auth` stays
`authenticated-session-required` (D-9905); `Authorizing WP` gains `WP-449`; the
response schema documents the new `launch` sub-object with canonical field names
(`villainGroupIds`, `henchmanGroupIds`, `bystandersCount`, `woundsCount`,
`officersCount`, `sidekicksCount`, `mastermindId`, `schemeId` per 00.2 §8.1). The
`POST` / `PATCH` / `DELETE` rows are unchanged. No new endpoint is added.

## Lint Gate Self-Review (`00.3`, all 21 sections)

- **§1 Structure** — PASS. All required sections present (`## Goal`, `## Assumes`,
  `## Context (Read First)`, `## Scope (In)`, `## Out of Scope`, `## Files
  Expected to Change`, `## Non-Negotiable Constraints`, `## Acceptance Criteria`,
  `## Verification Steps`, `## Definition of Done`); `## Out of Scope` names eight
  excluded items (variant selector, client recompute, new endpoint/migration,
  useCompetitiveSubmitOnGameover, launch primitive contract, open-division badge,
  saved-loadouts, deep-link import).
- **§2 Non-Negotiable Constraints** — PASS. Engine-wide (full file contents, no
  diffs, ESM/Node v22+, cites `00.6-code-style.md`) + packet-specific + session
  protocol + locked contract values all present.
- **§3 Assumes** — PASS. Every dependency WP (440/445/446/448) and file
  (MyProfilePage, loadoutLibraryApi, useCompetitiveSubmitOnGameover,
  routeAuthPolicy, gauntletRun.{types,routes}.ts, gauntlet.logic.ts) listed with
  the exact shapes relied on; the no-registry-import fact stated explicitly; the
  `7ebb8375` baseline recorded.
- **§4 Context** — PASS. Specific docs + sections (ARCHITECTURE §Layer Boundary,
  rules files, 00.2 §8.1, api-endpoints.md, the DECISIONS scan list, the source
  files), plus the load-bearing composition-assembly resolution and the
  split-vs-single rationale.
- **§5 Files Expected to Change** — PASS. Eight code/doc files (3 client + 4
  server + api-endpoints) marked new/modified with one-line descriptions +
  governance ledgers; at the split threshold, the cross-layer fold is
  **operator-confirmed** (not silently exceeded; A2 split rejected).
- **§6 Naming** — PASS. `MatchSetupConfig` nine fields (00.2 §8.1),
  `villainGroupIds`/`henchmanGroupIds`/`schemeId`/`mastermindId`,
  `GauntletRunProgressView`/`GauntletRunLegProgress`/`GauntletRunStatus` used
  verbatim from the shipped server types; no abbreviations.
- **§7 Dependency Discipline** — PASS. No new npm dependency; forbidden runtime
  imports (registry/server/pg in the client) explicitly excluded and grep-gated.
- **§8 Architectural Boundaries** — PASS. Frontend adds no game logic and no
  engine/registry runtime import; the server change is additive and read-only
  (no `G`/`ctx` persistence, no move-level DB query); the App↔Server boundary is
  crossed only over HTTP.
- **§9 Windows** — PASS. Verification uses `pnpm` + `git grep`; no Unix-only
  assumptions.
- **§10 Env Vars** — N/A. No environment variable introduced or consumed.
- **§11 Auth Clarity** — PASS. The endpoints are `authenticated-session-required`
  (unchanged WP-445 posture); the client attaches the existing Bearer token from
  `useAuthStore()`; no new identity model.
- **§12 Test Quality** — PASS. New client test uses `node:test` + `node:assert`
  with a stubbed `fetch`, no boardgame.io, no network/DB; the server test extends
  the existing DB-free derived-logic suite.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output + the
  D-24026 live-verify script; no vague "verify manually".
- **§14 Acceptance Criteria** — PASS. Sixteen binary, observable,
  file/function-specific checks aligned to the deliverables.
- **§15 Definition of Done** — PASS. Includes STATUS.md, DECISIONS.md,
  WORK_INDEX.md, the scope-boundary check, the §21 row replacement, and the §15.1
  live-on-surface verification (surface ≠ `none`, so the D-24026 item is present
  and not satisfiable by tests + merge alone).
- **§16 Code Style** — PASS. The API wrappers mirror the small never-throw
  `loadoutLibraryApi.ts` functions (JSDoc, typed results, no `.reduce()` branching,
  full-sentence errors); the config-assembly is one explicit mapping function; the
  view is rendered, not recomputed (no premature abstraction). `// why:` required
  on the set-qualification of `schemeId`, the Play-button gating, and the
  never-throw catch.
- **§17 Vision Alignment** — PASS. Section present with clause numbers (§3, §11,
  §19b, §20–26, NG-1), No-conflict assertion, NG proximity check, determinism line
  (N/A to engine, justified — supply counts don't gate leg-clear).
- **§18 Prose-vs-Grep** — PASS. Verification greps target
  `@legendary-arena/registry` / `apps/server` / `pg` and `launch`; the WP prose
  discusses these as governed scope, not as an enumerated forbidden-token list
  under a literal-count gate; no count-bounded grep is echoed verbatim.
- **§19 Bridge-vs-HEAD** — N/A. This WP is not a repo-state-summarizing artifact;
  the `origin/main` @ `7ebb8375` baseline is a fixed reproducibility anchor, not a
  "recent commits" chain.
- **§20 Funding Surface Gate** — N/A with justification (see `## Funding Surface
  Gate` — no funding affordance, channel, or user-visible funding copy anywhere in
  a gauntlet progression tracker + read-only projection).
- **§21 API Catalog** — **Triggered, satisfied** (see `## §21 — API Catalog`): the
  `GET /api/me/gauntlet-runs` response shape changes (additive `launch` block), so
  the executing session replaces that catalog row wholesale in the same commit;
  `Status`/`Auth` stay in their closed sets; canonical field names.

**Verdict:** PASS — all 21 sections resolved (§10/§19 N/A with reason; §20 N/A
with named justification; §21 triggered and satisfied via the wholesale row
replacement). **Re-affirmed after the 2026-07-28 operator amendment** (calls 1–5
are locks/refinements: named supply table, fold confirmed, variant-0, amber/green
badges, import affordances); no section regresses and no new NOT-READY blocker is
introduced.

## Pre-Flight (`01.4`) — READY TO EXECUTE

**Date:** 2026-07-28 · **Baseline:** `origin/main` @ `7ebb8375`. **Amended
2026-07-28** with operator review calls 1–5 (canonical supply table, fold
confirmed, variant-0, amber/green badges, import affordances) — refinements /
locks only; deps unchanged; no new NOT-READY blocker introduced.

- **Sequencing:** hard-deps WP-440 ✅, WP-445 ✅, WP-446 ✅, WP-448 ✅ (all Done on
  `main`, verified). No dep is draft-state or in-flight. READY.
- **Green baseline:** the arena-client + server suites are green on `origin/main`.
  This is **not** a validation-tightening WP — it accepts no previously-valid
  input newly-rejected (the client is additive; the server `launch` field is
  additive-nullable), so the `01.4` empirical-scaffold rule does not apply. The
  server change is guarded by the extended `gauntletRunProgress.logic.test.ts`;
  the client wrappers by stubbed-`fetch` isolation tests.
- **Scope lock:** eight code/doc files (3 client + 4 server + api-endpoints) plus
  governance ledgers. `server.mjs` is authorized wiring (`01.5`). Anything outside
  is forbidden.
- **Contract fidelity:** the WP-445/446 shapes (`GauntletRunProgressView`,
  `GauntletRunLegProgress`, `GauntletRunStatus`, the error closed set) and the
  WP-448 `launchMatchFromComposition` signature verified verbatim at draft time
  against the shipped source (see `## Assumes`); the client mirrors them
  structurally and the server change is additive.
- **Risks/ambiguities resolved:** (a) *client cannot reach the registry* — the
  villains/henchmen + supply counts come from a **server** launch block on the
  derived read (resolved; the load-bearing decision, D-24269); (b) *`schemeId` is
  a bare slug* — the client set-qualifies it as `${setAbbr}/${schemeId}`
  (resolved); (c) *no registry source for supply counts* — the server wiring
  supplies the named canonical `GAUNTLET_LEG_STANDARD_SUPPLY` table (`{ bystanders:
  30, wounds: 30, officers: 30, sidekicks: 15 }`, v1), which does not gate
  leg-clear (D-24187) (**resolved — operator-locked**); (d) *cross-layer sizing* —
  **folded per operator** into one WP (the fold is the confirmed architecture, not
  a fork).
- **Operator forks — now resolved (calls 1–5):** the fold is confirmed (server
  half stays in WP-449; split / new-endpoint rejected); the supply-count source is
  locked to the named `GAUNTLET_LEG_STANDARD_SUPPLY` constant (C2 registry table
  rejected); the variant selector is deferred (variant 0 only). All recorded in
  D-24269. No open fork remains.

**Verdict: READY TO EXECUTE.**

## Copilot Check (`01.7`) — PASS

**Date:** 2026-07-28 · **Pre-flight under review:** READY TO EXECUTE (2026-07-28).
All 30 issues scanned; findings that were not a clean PASS:

- **#1 / #9 / #16 / #29 Boundary drift** — PASS. The client adds no
  engine/registry/server runtime import (constraint + Verification Step 3 grep);
  villains/henchmen + counts arrive over HTTP via the server launch block, never a
  client registry read. The server change stays in the server layer, read-only.
- **#4 / #21 Contract / widening** — PASS. `launch` is a typed nullable
  sub-object, additive to `GauntletRunProgressView`; the client result is a
  discriminated union, not a bare `unknown`; the `MatchSetupConfig` assembly
  renames no field.
- **#6 Merge semantics (replace vs append)** — PASS. Not a data-merge WP; the §21
  catalog row is a wholesale replace (D-11804).
- **#12 Scope creep** — PASS. Explicit eight-file allowlist + `git diff
  --name-only` DoD check + eight named out-of-scope items; the cross-layer sizing
  is surfaced as a fork, not smuggled.
- **#22 Silent vs loud failure** — PASS. Never-throw wrappers with typed codes +
  friendly per-code copy; the Play button is disabled (not silently no-op) when
  `hasFullPicks` is false or `launch` is null, with an explanatory line.
- **#11 Tests validate invariants** — PASS. Client tests assert the typed
  success/failure/network-throw branches; the server test asserts both the
  populated and `null` launch cases (non-vacuous — the `null` branch proves the
  unconfigured-menu path).
- **#25 Overloaded responsibility** — PASS. `gauntletRunApi.ts` only wraps HTTP;
  the config-assembly is one small function in the SFC; status/champion derivation
  stays server-side.
- **Fixed-pool legibility (epic-specific)** — PASS. AC-4 + the constraint make
  `all-legs-cleared` vs `champion` a distinct, non-error state with the budget gap
  shown — directly addressing the epic's invisible-failure risk.

**Governance follow-ups:** D-24269 records the tracker UX contract + the
Play-this-leg composition-assembly resolution, amended 2026-07-28 with operator
review calls 1–5: the fold is confirmed (A2 split / A3 endpoint recorded as
considered-and-rejected), the supply-count source is locked to the named
`GAUNTLET_LEG_STANDARD_SUPPLY` constant (C2 rejected), and the variant selector is
deferred. No operator fork remains open.

**Disposition:** CONFIRM — Pre-flight READY TO EXECUTE stands (amendment adds
locks/refinements only; all 21 lint sections still resolve; no new NOT-READY
blocker). Session-prompt generation authorized.
