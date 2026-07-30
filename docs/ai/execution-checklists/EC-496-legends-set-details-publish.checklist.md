# EC-496 — Publish Per-Set Gauntlet Roster + Coverage to the Legends Index (Execution Checklist)

**Source:** docs/ai/work-packets/WP-461-legends-set-details-publish.md
**Layer:** Server (`apps/server`) — legends publisher; no registry/engine import

## Before Starting
- [ ] On `origin/main` @ `5b086f66` (or later), worktree clean.
- [ ] Hard-deps on `main`: WP-395 ✅ (`approvedLoadouts` threaded) + WP-458 ✅
      (one config per mastermind).
- [ ] `registry.getSet(abbr)` exposes `villains[]`/`henchmen[]` as `{ slug, name }`
      (confirm on `data/cards/core.json`).
- [ ] server test/typecheck/build + `pnpm -r build` green.
- [ ] **Exact target file set (any file outside = FAIL, STOP):** `legends.types.ts`,
      `gauntlet.logic.ts` (+`.test.ts`), `legends.publisher.ts` (+`.test.ts`),
      `server.mjs`, `index.mjs`, `legends.scheduler.ts` (+ governance + DECISIONS).

## Locked Values (do not re-derive)
- Types verbatim from WP-461 `§Contract` (`SetNamedGroup`, `SetAdversaryGroup`,
  `SetDetails`; property order fixed). `GauntletIndexSnapshot` gains
  `sets?: readonly SetDetails[]` — **additive optional**, nothing else changes.
- `usedByGauntlets` is **PER-SET-SCOPED**: true iff the group's set-qualified id
  `` `${setAbbr}/${slug}` `` appears in ≥1 approved config's villain/henchman ids
  of one of **that set's OWN masterminds** at any player count. Masterminds/schemes
  carry NO flag.
- **Gathering algorithm (LOCKED):** iterate the set summary's OWN `masterminds`,
  look each up by the **EXACT** key `` `${setAbbr}/${mastermind.slug}` `` in
  `approvedLoadoutsByGauntlet`, and union that set's own configs' ids. **NEVER** a
  global membership scan of the whole map (over-counts cross-set fallbacks — real:
  `2099`/`amwp` gauntlets pull `co2e/*` groups, which must NOT flip co2e's own
  flags), and **NEVER** a `startsWith(`${setAbbr}/`)` prefix match (setAbbr-prefix
  collisions).
- **`sets?` construction under `exactOptionalPropertyTypes`:** emit via conditional
  spread `...(setDetailsCatalog !== undefined ? { sets: setDetailsCatalog } : {})`
  inside the existing `!indexBuildFailed` index write — assigning `sets: undefined`
  is a type error and would also change the JSON shape.
- Include a set iff `schemes.length ≥ 1`. Order: sets setAbbr ASC; within a set,
  masterminds/schemes/villains/henchmen slug ASC. Registry slugs/names verbatim.
- Absent `approvedLoadouts` for a set → all flags `false`, never a throw.
- Absent `setDetailsCatalog` → publisher omits `sets` (byte-compatible).

## Guardrails
- The legends module (`gauntlet.logic.ts`, `legends.publisher.ts`, `.types.ts`)
  imports NO registry/engine/preplan/UI code — rosters arrive as injected data.
- Rosters populated in `server.mjs` (wiring), threaded via `index.mjs` +
  `legends.scheduler.ts` exactly as `gauntletCatalog` is (mirror that path).
- Pure `buildSetDetailsCatalog` — no I/O, deterministic; use `for...of`, no
  `.reduce()` for the coverage fold; descriptive names.
- Emit `sets` ONLY inside the existing `!indexBuildFailed` index write; do not
  touch any board file, the manifest, or the standings query.
- Deterministic fixed-property-order JSON (match the existing entry shapes).

## Required `// why:` Comments
- Why the villain/henchman rosters ride the wiring-injected path (legends layer
  lock — no registry import).
- Why `usedByGauntlets` is computed server-side once (self-describing snapshot;
  zero-API client stays presentational).
- Why coverage is gathered from the set's OWN masterminds via the exact
  `${setAbbr}/${mastermindSlug}` key (a global scan would over-count cross-set
  fallback groups; "this set's challenge fights it" is the intended meaning).
- Why `sets` is additive+optional (pre-WP-461 readers ignore it).

## Files to Produce
- `apps/server/src/legends/legends.types.ts` — types + `sets?`.
- `apps/server/src/legends/gauntlet.logic.ts` — `GauntletSetSummary` rosters +
  `buildSetDetailsCatalog`.
- `apps/server/src/legends/gauntlet.logic.test.ts` — tests: (a) coverage math
  (brotherhood true, radiation false on a Core-shaped fixture); (b) ordering
  (setAbbr ASC, slug ASC); (c) zero-scheme set excluded; (d) absent
  `approvedLoadouts` → all flags false, no throw; (e) **cross-set fallback** — a
  set whose gauntlet uses a foreign-set group (`2099` → `co2e/*`) does NOT flip the
  foreign set's own flags, and its own `2099/*` groups flag correctly; (f) **empty
  own-roster** — a set with 0 henchmen yields `henchmen: []` without throwing;
  (g) the roster carries the authoritative `name` (not a re-derived slug).
- `apps/server/src/legends/legends.publisher.ts` — param + `sets` emission.
- `apps/server/src/legends/legends.publisher.test.ts` — emit present/absent.
- `apps/server/src/server.mjs` / `index.mjs` / `legends.scheduler.ts` — 01.5 wiring.

## After Completing
- [ ] server test (run affected pure files directly if the DB suite times out) /
      typecheck / build + `pnpm -r build` exit 0.
- [ ] Land **D-24279** in DECISIONS.md (reserved → Active).
- [ ] **D-24026 live-verify (operator-pending):** deployed `gauntlet-index.json`
      carries `sets` with correct flags.
- [ ] STATUS updated; WORK_INDEX row checked; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-496 Done.
- [ ] No file outside the allowlist (+ governance) modified.

## Common Failure Smells
- `sets` shows only used villains → the full roster was read from
  `approvedLoadouts` (the subset), not from the set summary's `villains[]`.
- A villain marked used when it isn't → the coverage check compared bare slugs,
  not the set-qualified `${setAbbr}/${slug}` id.
- Typecheck breaks in `gauntlet.logic.ts` importing `SetDetails` → import it
  **type-only** from `./legends.types.js` (the module already does this).
