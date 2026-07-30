# WP-461 — Publish Per-Set Gauntlet Roster + Coverage to the Legends Index (Server)

**User-Visible Surface:** `legends.legendary-arena.com` (indirectly). This WP is
the **data producer** for the operator-requested per-set "Show set details"
reveal; the visible reveal ships in the paired client WP-462. This WP's own
observable is the deployed `legends/v1/gauntlet-index.json` snapshot carrying the
additive `sets` roster (full per-set masterminds/schemes/villains/henchmen +
`usedByGauntlets` coverage flags). **D-24026 live-verification applies**
(operator-pending on the Render redeploy + next publish cycle): the deployed
snapshot must carry `sets` with correct flags (e.g. for `core`, `radiation`
false / `brotherhood` true).

## User-Visible Impact

A visitor on `legends.legendary-arena.com` gains (once WP-462 renders this data) a
per-set breakdown showing every mastermind, scheme, villain, and henchman a set
ships, with each villain/henchman marked as fought or not-fought by that set's
gauntlets — directly answering "is my set challenge actually covering everything?"
On its own, this WP changes only the published JSON; the pixel-level change lands
with WP-462.

## Goal

The legends snapshot publisher emits a **self-describing per-set roster** into
`legends/v1/gauntlet-index.json`: for every set that ships ≥1 scheme, the full
list of its **masterminds, schemes, villain groups, and henchman groups**
(each with its authoritative registry `name`), and — for each villain and
henchman group — a `usedByGauntlets` flag stating whether that group appears in
**any** approved gauntlet configuration across the set's masterminds. This is
the data half of an operator-requested "Show set details" reveal
(`legends.legendary-arena.com`); WP-462 renders it. Publishing the flag
server-side (computed once from the registry roster + the approved-loadout menu
the wiring layer already holds) makes the snapshot self-describing and keeps the
zero-API client purely presentational.

## Assumes

- **On `origin/main` @ `5b086f66`** (EC-482 merge). `apps/server`
  builds/tests/typechecks green; the legends publisher is live and publishing
  `gauntlet-index.json` on its ~5-minute cycle.
- **WP-395 / D-24199 + WP-458 / D-24278 landed:** the approved-loadout menu is
  one canonical config per mastermind per player count, threaded to the publisher
  as `GauntletDefinition.approvedLoadouts` and built in the wiring layer
  (`server.mjs`) as `approvedLoadoutsByGauntlet` keyed `setAbbr/mastermindSlug`.
  (Source: `apps/server/src/server.mjs:607-635`, `gauntlet.logic.ts:118-158`.)
- **The registry exposes full set rosters:** `registry.getSet(abbr)` returns
  `villains[]` (typed `VillainGroupSchema`, `{ slug, name, ... }`) and `henchmen[]`
  (alongside the already-consumed `schemes[]` / `masterminds[]`). (Source:
  `data/cards/*.json`; the wiring loop at `server.mjs:568-591` already reads
  `setData.schemes` / `.masterminds`.) **Caveat (runtime-verified, not
  type-guaranteed):** the registry schema types `henchmen` as
  `z.array(z.unknown())` (`schema.ts:338`), so `{ slug, name }` on henchmen holds
  by the actual data (`core.json` → "Doombot Legion") but not by the type; the
  wiring reads them in JS exactly like `schemes`/`masterminds`, so there is no
  typecheck exposure — a henchman roster is read `{ slug, name }` from live data.
- **The publisher receives injected plain data, never the registry** — the
  gauntlet catalog and its budgets ride in as parameters (`legends.publisher.ts`
  `publishAllBoards(..., gauntletCatalog?)`), preserving the legends module's
  no-registry-import layer lock. This WP threads one additional injected
  structure the same way (`server.mjs` → `index.mjs` → `legends.scheduler.ts` →
  `publishAllBoards`).

## Context (Read First)

**Read before executing:** `docs/ai/ARCHITECTURE.md §Layer Boundary` (the legends
module stays registry/engine-free — rosters arrive as injected data),
`.claude/rules/architecture.md` (persistence/publish boundary), and
`docs/ai/REFERENCE/00.2-data-requirements.md §8.1` (the canonical
`villainGroupIds` / `henchmanGroupIds` / `slug` / `name` field names this WP reads
verbatim). The producing/consuming code is enumerated with line refs in
`§Assumes`.

WP-456 gave each **gauntlet** (mastermind) a "Show details" reveal, and the wiki
(`leaderboard.md §Per-gauntlet editorial content`) states plainly that a
gauntlet fixes the **mastermind + scheme legs** but that villains/henchmen are
pinned to a capped approved config. The operator asked (2026-07-30) for a
**per-set** view — "list all the villains, henchmen, masterminds, and schemes in
that set" — because it is otherwise unclear whether the gauntlets cover every
villain/henchman. They do not: across a set's masterminds the approved menu caps
at ~4 villain groups / 2 henchman groups (`REQUIRED_GROUP_COUNTS`, all
alphabetically-first, so they converge), so for Core Set only 4 of 7 villains and
2 of 4 henchmen appear in any approved config. The operator chose to **ship the
transparency dropdown now** and treat closing that coverage gap as a separate
decision. This WP publishes the roster + honest coverage flag so the reveal can
mark each villain/henchman ✓/✗.

Split rationale: this is a producer/consumer contract across the server → client
layer boundary, so it is a paired WP (WP-461 server producer, WP-462 client
consumer) sharing this `§Assumes` chain, mirroring the WP-342/343 and WP-344/345
gauntlet precedent. The snapshot schema field is additive and optional (a
pre-WP-461 reader ignores it), so the two WPs deploy independently.

## Scope (In)

- **`apps/server/src/legends/legends.types.ts`** — add the snapshot types
  `SetNamedGroup` (`{ slug, name }`), `SetAdversaryGroup`
  (`{ slug, name, usedByGauntlets }`), and `SetDetails`
  (`{ setAbbr, setName, masterminds[], schemes[], villains[], henchmen[] }`);
  add one **additive optional** field `sets?: readonly SetDetails[]` to
  `GauntletIndexSnapshot`. Fixed property order (deterministic JSON).
- **`apps/server/src/legends/gauntlet.logic.ts`** — extend `GauntletSetSummary`
  with `villains: readonly SetNamedGroup[]` and `henchmen: readonly
  SetNamedGroup[]` (full rosters); add a pure `buildSetDetailsCatalog(
  setSummaries, approvedLoadoutsByGauntlet?)` that returns one `SetDetails` per
  set with ≥1 scheme (setAbbr ASC; masterminds/schemes/villains/henchmen slug
  ASC), computing `usedByGauntlets` per villain/henchman group.
- **`apps/server/src/legends/gauntlet.logic.test.ts`** — tests for
  `buildSetDetailsCatalog` (coverage math, ordering, zero-scheme exclusion,
  absent-approvedLoadouts → all-false).
- **`apps/server/src/legends/legends.publisher.ts`** — add optional
  `setDetailsCatalog?: readonly SetDetails[]` param to `publishAllBoards`; emit
  it as the index snapshot's `sets` field (only inside the existing
  `!indexBuildFailed` gauntlet-index write; unchanged when absent).
- **`apps/server/src/legends/legends.publisher.test.ts`** — assert the index
  snapshot carries `sets` when the catalog is supplied and omits it when not.
- **Runtime wiring (01.5):** `apps/server/src/server.mjs` (populate
  `villains`/`henchmen` on each set summary from the registry; build the
  set-details catalog; return it from `startServer`), `apps/server/src/index.mjs`
  (forward `started.setDetailsCatalog` into the scheduler options),
  `apps/server/src/legends/legends.scheduler.ts` (add `setDetailsCatalog?`
  option, forward verbatim to `publishAllBoards`).

## Out of Scope

- **No change to which adversaries the gauntlets use** (the coverage gap stays
  open by operator decision) — this WP only *reports* coverage.
- No change to `GauntletDefinition`, the standings query, `approvedLoadouts`
  qualification, PAR/scoring, or any board file other than the index.
- No client change (WP-462), no registry import in the legends module, no new
  R2 file (the roster rides the existing `gauntlet-index.json`).

## Files Expected to Change

- `apps/server/src/legends/legends.types.ts` — **modified** (add types + `sets?`)
- `apps/server/src/legends/gauntlet.logic.ts` — **modified** (extend summary +
  `buildSetDetailsCatalog`)
- `apps/server/src/legends/gauntlet.logic.test.ts` — **modified** (new tests)
- `apps/server/src/legends/legends.publisher.ts` — **modified** (param + emit)
- `apps/server/src/legends/legends.publisher.test.ts` — **modified** (assert emit)
- `apps/server/src/server.mjs` — **modified** (01.5 wiring)
- `apps/server/src/index.mjs` — **modified** (01.5 wiring)
- `apps/server/src/legends/legends.scheduler.ts` — **modified** (01.5 wiring)
- `docs/ai/DECISIONS.md` — **modified** (land D-24279 at execution)

## Contract

> Full file contents (no diffs); ESM/Node v22+; human-style code per
> `00.6-code-style.md`; the legends module imports **no** registry/engine/preplan/UI
> code; deterministic fixed-property-order JSON; the `sets` field is additive +
> optional (a pre-WP-461 consumer ignores it).

**Locked types** (`legends.types.ts`, property order fixed):

```ts
export interface SetNamedGroup { readonly slug: string; readonly name: string; }
export interface SetAdversaryGroup {
  readonly slug: string;
  readonly name: string;
  readonly usedByGauntlets: boolean;
}
export interface SetDetails {
  readonly setAbbr: string;
  readonly setName: string;
  readonly masterminds: readonly SetNamedGroup[];
  readonly schemes: readonly SetNamedGroup[];
  readonly villains: readonly SetAdversaryGroup[];
  readonly henchmen: readonly SetAdversaryGroup[];
}
// GauntletIndexSnapshot gains:  readonly sets?: readonly SetDetails[];
```

**`usedByGauntlets` semantics — PER-SET-SCOPED (LOCKED):** the flag answers "does
**this set's own** gauntlets fight this group" (so completing *this set's*
challenge would fight it). A set villain (resp. henchman) group `g` is
`usedByGauntlets: true` **iff** its set-qualified id `` `${setAbbr}/${g.slug}` ``
appears in at least one approved configuration's `villainGroupIds` (resp.
`henchmanGroupIds`) of one of **that set's own masterminds** at any player count.
**Gathering algorithm (LOCKED):** iterate the set summary's OWN `masterminds` and
look each up by the **exact** key `` `${setAbbr}/${mastermind.slug}` `` in
`approvedLoadoutsByGauntlet` — **never** a global membership scan of the whole map
(which would mark a group used on set A's panel when only set B's gauntlet fights
it — real in the data: `2099`/`amwp` gauntlets pull `co2e/*` fallback groups) and
**never** a `startsWith(`${setAbbr}/`)` prefix match (setAbbr-prefix collisions).
Masterminds and schemes carry no flag — every mastermind is a gauntlet and every
scheme is a leg of every gauntlet, so all are covered by construction. When a set
has no injected `approvedLoadouts` for any of its masterminds, every
villain/henchman is `false` (nothing is confirmed reachable) — never a throw.

**Inclusion + ordering (LOCKED):** one `SetDetails` per set with `schemes.length
≥ 1` (matching `buildGauntletCatalog`); sets `setAbbr` ASC; within a set,
masterminds/schemes/villains/henchmen each sorted by `slug` ASC. Slugs and names
are the registry's canonical fields verbatim (never re-derived).

## Acceptance Criteria

- [ ] `buildSetDetailsCatalog` returns one `SetDetails` per ≥1-scheme set, ordered
      setAbbr ASC, with masterminds/schemes/villains/henchmen slug-ASC.
- [ ] A villain/henchman group in ≥1 approved config → `usedByGauntlets: true`;
      one in none → `false`. Verified on a Core-shaped fixture (e.g.
      `brotherhood` true, `radiation` false).
- [ ] A set summary with no matching `approvedLoadouts` entries yields all-`false`
      flags and does not throw.
- [ ] `publishAllBoards` emits `sets` on the index snapshot when
      `setDetailsCatalog` is supplied, and omits the field entirely when it is
      not (byte-compatible with a pre-WP-461 reader).
- [ ] The legends module still imports no registry/engine/preplan/UI code; the
      `villains`/`henchmen` rosters reach it only as injected plain data.
- [ ] `pnpm --filter @legendary-arena/server test` (DB-gated; run the affected
      pure files directly if the full suite times out), `typecheck`, `build`
      exit 0; `pnpm -r build` exits 0.
- [ ] No file outside the allowlist (+ governance) is modified.

## Verification Steps

```bash
pnpm --filter @legendary-arena/server build
pnpm --filter @legendary-arena/server typecheck
node --import tsx --test apps/server/src/legends/gauntlet.logic.test.ts \
  apps/server/src/legends/legends.publisher.test.ts
pnpm -r build
# Post-deploy (D-24026): after Render redeploys and the publisher's next cycle,
# GET https://images.legendary-arena.com/legends/v1/gauntlet-index.json →
# `.sets[]` present; for core, villains include radiation with
# usedByGauntlets:false and brotherhood with usedByGauntlets:true.
```

## Vision Alignment

**Clauses:** §10 (Legends board / leaderboard presentation), §22 (scoring config
versioning — untouched; this publishes derived roster metadata, not scores).
**Conflict:** *No conflict* — additive, read-only derived data; no scoring,
identity, RNG, determinism, or persistence surface changes (`G` untouched; the
snapshot is a published projection). **NG:** none.

## Definition of Done

- [ ] All Acceptance Criteria pass; server test/typecheck/build + `pnpm -r build`
      green.
- [ ] **D-24279 landed** in `DECISIONS.md` (flip from reserved to Active).
- [ ] **D-24026 live-verify (operator-pending):** the deployed `gauntlet-index.json`
      carries `sets` with correct coverage flags.
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` row checked off;
      `ROADMAP-MINDMAP.md` `📝`→`✅` + `pnpm roadmap:counts:write` (`:check` 0);
      `EC_INDEX.md` EC-496 → Done.
- [ ] No files outside the allowlist (+ governance) modified.

## Lint Gate Self-Review

- **§1–4 (identity/authority/deps):** WP+EC numbered, authority chain cited,
  hard-deps WP-395/WP-458 ✅ on `main`. PASS.
- **§5 (file allowlist):** 6 server files (4 code/test + 1 threading pair) + 3
  wiring files enumerated; the three `.mjs`/scheduler edits are 01.5 runtime
  wiring, cited. PASS.
- **§8 (layer boundary):** legends module stays registry-free; rosters injected
  as plain data via the existing catalog-injection path. PASS.
- **§15 (D-24026):** user-visible surface = `legends.legendary-arena.com` (via the
  published snapshot); live-verify present. PASS.
- **§17 (Vision):** §10 + §22, No conflict, documented above. PASS.
- **§20 (Funding Surface Gate):** N/A — no funding/donation surface, affordance,
  or copy is added or touched; this is a derived-data publication change.
- **§21 (API catalog):** N/A — no HTTP endpoint added/changed; the publisher writes
  R2, not an `apps/server` route.
- Remaining sections resolve or N/A (no new contract *file*; additive snapshot
  field is a contract *element* documented in `§Contract` + D-24279).

## Gate Verdicts (drafting session)

Recorded at drafting; see the SPEC commit body for the pre-flight / copilot / lint
subagent verdicts run against this WP + EC-496.
