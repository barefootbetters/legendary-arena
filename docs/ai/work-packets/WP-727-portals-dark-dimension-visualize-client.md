# WP-727 — Portals to the Dark Dimension: Dark-Portal board overlay (arena-client)

**Status:** Draft 2026-09-21 · **EC:** EC-764 · **Reserves:** D-24548
**Primary Layer:** Arena Client (App)
**User-Visible Surface:** `play.legendary-arena.com` (a Core Portals match — a
dark-portal marker above the Mastermind and above each portal'd city space,
growing with each Scheme Twist; D-24026 live-verification applies).
**Lane:** standard two-session — the client half of the visualization arc
(mirrors WP-539's deferred visual; consumes WP-728's projection).

## Goal

Render WP-728's `scheme.darkPortals` descriptor on the play board. A **dark
portal marker** appears above the Mastermind tile (showing `+N attack`) once the
first Scheme Twist opens the Mastermind portal, and above each city space that
gains a portal on subsequent twists — so the board shows the growing portal
threat instead of it living only in the game log. After this packet the Portals
Dark-Portal visualization is complete on-screen; this packet carries the D-24026
live-verify for the arc.

## User-Visible Impact

A player in a Core **Portals to the Dark Dimension** match sees a dark-portal
marker with `+1 attack` appear above the Mastermind after the first twist, and a
new dark-portal marker (with `+1 attack`) appear above a city space with each
subsequent twist — matching the game-log lines ("A Dark Portal opens above the
Mastermind", "…opens in the Bridge", "…in the Streets"). Before this arc the
portals had no on-board visual (operator-reported from a live 1p Magneto Portals
match). The markers are purely presentational — they change no outcome.

## Assumes

- **WP-728 / EC-765 ✅** — the engine serves `scheme.darkPortals`
  (`{ onMastermind, mastermindAttackBonus, citySpaceIndices, citySpaceAttackBonus }`)
  as public shared-board on `UIState`, derived from `DARK_PORTAL_COUNT`. This
  packet consumes that field verbatim and adds no engine change. `UISchemeState`
  is exported from `@legendary-arena/game-engine`, so the arena-client type
  updates automatically — no client-side type mirror.
- **WP-690 / D-24507 ✅** — the board-VFX / tile-overlay layering precedent
  (mastermind-hit beat) — the positioning + z-index model to reuse.
- `MastermindTile.vue` renders from a `mastermind` prop; `CityRow.vue` renders
  the 5 city spaces from a `city` prop; both are mounted by `PlayDesktop.vue` /
  `PlayMobile.vue`, which hold `snapshot` (the audience-filtered `UIState`).
- `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) + test are
  green on `origin/main`.

## Context (Read First)

- `.claude/rules/architecture.md` §UIState Projection Integrity — the client
  renders the served projection; it submits intent only and re-evaluates no rule
  (D-20105). This overlay dispatches no move.
- `apps/arena-client/src/components/play/MastermindTile.vue` — the mastermind
  tile; takes `:mastermind`. Gains a `darkPortalBonus` prop (0 = no portal) and
  renders the marker when it is `> 0`.
- `apps/arena-client/src/components/play/CityRow.vue` — the city row; renders 5
  `city-space` cells indexed `0..4`. Gains a `darkPortalIndices` prop (the
  portal'd indices) + `darkPortalBonus`, and overlays a marker on each named
  cell — including an **empty** cell, because a Dark Portal buffs the space, not
  a specific villain.
- `apps/arena-client/src/pages/PlayDesktop.vue` + `PlayMobile.vue` — mount
  `MastermindTile` / `CityRow`; compute the derived props from
  `snapshot.scheme.darkPortals` (guarding `undefined` for non-Portals schemes)
  and pass them through.
- `apps/arena-client/src/components/play/SchemeTile.vue` — the precedent for a
  component consuming `UISchemeState` (`:scheme="snapshot.scheme"`).
- Auto-memory `reference_clipboard_verify_and_preview_block` — the arena-client
  bottom-left fixed-pill stack collides silently; verify the new overlay does
  not overlap an existing fixed element.
- WP-539 §Out of Scope (the deferred "dedicated portal-token visual"); WP-728
  §Contract for the `scheme.darkPortals` shape.
- `docs/ai/REFERENCE/00.6-code-style.md`; `docs/ai/DECISIONS.md` D-24549 / land D-24548.

## Non-Negotiable Constraints

**Engine-wide (do not remove):** ESM only, Node v22+, `node:` prefix; Vue SFCs
compiled via `vue-sfc-loader` (test-only devDep, never runtime); full file
contents, no diffs; human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Client-only** — no engine / server / `packages/**` change; consume WP-728's
  served field verbatim (D-20105: no client-side rule re-evaluation, no recompute
  of portal locations from the counter — read `scheme.darkPortals` directly).
- The marker shows the descriptor's `mastermindAttackBonus` / `citySpaceAttackBonus`
  (`+N attack`), **never a hardcoded `1`** — a future multi-stack buff renders
  faithfully.
- The city marker renders on a portal'd cell **even when the space is empty**
  (the portal buffs the space).
- `boardgame.io/react` is never imported; this overlay dispatches no move.
- Reuse the WP-690 board-VFX layering; do not introduce a new positioning system;
  verify no collision with the existing fixed-pill stack.
- `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) is gated
  **Before** and **After** (esbuild/tsx do not type-check).

**Session protocol:** if the served `scheme.darkPortals` shape differs from
WP-728's Contract, STOP — do not invent a client-side shape or recompute
locations from `DARK_PORTAL_COUNT`.

**Locked contract values:**
- Read `snapshot.scheme.darkPortals` (optional — omitted for non-Portals).
- Mastermind marker shows when `darkPortals?.onMastermind` (bonus =
  `mastermindAttackBonus`).
- City marker shows on each index in `darkPortals?.citySpaceIndices` (bonus =
  `citySpaceAttackBonus`).

## Scope (In)

### A) `DarkPortalMarker.vue` (new) + `.test.ts` (new)
- Props: `attackBonus: number` (+ an optional label/`data-testid`). Renders a
  dark-portal glyph with `+{{ attackBonus }} attack`. `data-testid="dark-portal-marker"`.
  Tests: renders the passed bonus; renders `+2` when given 2 (not hardcoded 1).

### B) `MastermindTile.vue` — add a `darkPortalBonus?: number` prop (default 0);
render `DarkPortalMarker` above the tile when it is `> 0`. No change to the
existing tactics / cost-gating render.

### C) `CityRow.vue` — add `darkPortalIndices?: number[]` + `darkPortalBonus?: number`
props (defaults `[]` / 0); overlay `DarkPortalMarker` on each `city-space` cell
whose index is in `darkPortalIndices`, including an empty cell.

### D) `PlayDesktop.vue` + `PlayMobile.vue` — compute from `snapshot.scheme.darkPortals`
(guard `undefined`): pass `:dark-portal-bonus` to `MastermindTile`
(`onMastermind ? mastermindAttackBonus : 0`) and `:dark-portal-indices` /
`:dark-portal-bonus` to `CityRow`.

## Out of Scope

- Any engine / server / `packages/**` change (the projection is WP-728).
- Recomputing portal locations client-side from `DARK_PORTAL_COUNT` — read the
  served `scheme.darkPortals` only.
- Animating the portal opening beyond the established board-VFX layering (a
  richer open/close animation is a possible follow-up).
- Any change to the Mastermind fight-requirement number or the villain
  fight-cost number (those are WP-539's combat values, already projected).

## Files Expected to Change

- `apps/arena-client/src/components/play/DarkPortalMarker.vue` — **new** — the marker glyph + `+N attack`.
- `apps/arena-client/src/components/play/DarkPortalMarker.test.ts` — **new** — renders the passed bonus.
- `apps/arena-client/src/components/play/MastermindTile.vue` — **modified** — `darkPortalBonus` prop + marker.
- `apps/arena-client/src/components/play/CityRow.vue` — **modified** — `darkPortalIndices` / `darkPortalBonus` props + per-cell marker.
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — derive + pass the props.
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — derive + pass the props.

No other files may be modified.

## Contract (Locked by D-24548)

- Consumes `scheme.darkPortals` (WP-728) verbatim; dispatches no move.
- The mastermind marker renders iff `darkPortals?.onMastermind`; each city marker
  renders for an index in `darkPortals?.citySpaceIndices` (empty cell included).
- Each marker's `+N` is the descriptor's bonus field, never a literal.
- No new engine/server contract element; purely presentational (off-ranking).

## Acceptance Criteria

1. `DarkPortalMarker.vue` renders `+{{ attackBonus }} attack` from its prop
   (renders `+2` when given 2 — no hardcoded 1); `data-testid="dark-portal-marker"`.
2. `MastermindTile` renders the marker when `darkPortalBonus > 0` and not when 0;
   the existing tactics / cost render is unchanged.
3. `CityRow` overlays a marker on each cell whose index is in `darkPortalIndices`
   — including an empty cell — and on no other cell.
4. `PlayDesktop` + `PlayMobile` pass `onMastermind ? mastermindAttackBonus : 0`
   to `MastermindTile` and `citySpaceIndices` / `citySpaceAttackBonus` to
   `CityRow`, guarding `scheme.darkPortals === undefined` (non-Portals → no
   markers).
5. `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) clean;
   arena-client suite green (incl. the new marker tests).
6. No engine / server / `packages/**` file changed (`git diff --name-only`).

## Verification Steps

```pwsh
# Step 1 — typecheck (vue-tsc — esbuild/tsx do NOT type-check)
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0

# Step 2 — arena-client tests
pnpm --filter @legendary-arena/arena-client test
# Expected: all pass, incl. the new DarkPortalMarker tests

# Step 3 — client-only scope
git diff --name-only
# Expected: only the apps/arena-client allowlist; no packages/**, no apps/server

# Step 4 — marker reads the served bonus, not a literal
Select-String -Path "apps\arena-client\src\components\play\DarkPortalMarker.vue" -Pattern "attackBonus"
# Expected: at least one match (the +N is prop-driven)

# Step 5 — live (post-deploy; D-24026): a Core Portals match. After twist 1 a
#   dark-portal marker (+1 attack) shows above the Mastermind; each subsequent
#   twist adds a marker (+1 attack) above a city space, matching the game log.
#   Verify with ?match= (a live match), not just ?fixture=. Record in STATUS.
```

## Definition of Done

- [ ] **User-visible verification (D-24026) — REQUIRED:** on the deployed
      `play.legendary-arena.com`, in a Core Portals match, confirm the Mastermind
      dark-portal marker appears at twist 1 and a city-space marker appears with
      each subsequent twist, each showing `+N attack`, with no freeze —
      observable evidence captured (via `?match=`, not only `?fixture=`).
- [ ] All 6 acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` + test green; `pnpm -r build` 0
- [ ] No files outside `## Files Expected to Change` (`git diff --name-only`)
- [ ] Overlay does not collide with the existing bottom-left fixed-pill stack
- [ ] `docs/ai/STATUS.md` updated — the Portals Dark-Portal visual is live
- [ ] `docs/ai/DECISIONS.md` D-24548 landed (Status → Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-727 checked off with date;
      `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅` + `pnpm roadmap:counts:write`,
      `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-764:` for code, `SPEC:` for governance close

## Vision Alignment

- **Clauses touched:** §2 / §10 (scheme content faithful on-screen), NG-1 (no
  pay-to-win).
- **Conflict assertion:** No conflict — a display surface over an existing
  engine mechanic; the markers buy no advantage and change no outcome;
  off-ranking.
- **Non-Goal proximity:** NG-1 not crossed.
- **Determinism preservation:** N/A at the client — it renders a served
  projection and submits no move; the engine (WP-728) owns the deterministic
  source. No client-side rule re-evaluation (D-20105).

## Funding Surface Gate

**N/A** — a play-board visualization; no §20.1 trigger (no funding affordance,
navigation, profile, or donate copy). Authority: WP-097 / D-9701 / D-9801.

## API Catalog Update

**N/A** — no `apps/server` endpoint or `Library-only` function changed;
`docs/ai/REFERENCE/api-endpoints.md` unaffected.

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1–7:** all required sections present; closed 6-file allowlist; no new npm
  deps; forbidden packages (`boardgame.io/react`) explicitly excluded.
- **§8 layer boundary:** arena-client only; consumes the engine's served field;
  no upward/sideways runtime import; no game logic in the component.
- **§9 Windows:** `pwsh` / `Select-String`.
- **§10 Env:** N/A. **§11 Auth:** N/A.
- **§12 tests:** `node:test`, no boardgame.io import, no network/DB; mounted
  component states.
- **§13 Verification:** exact `pnpm` + `Select-String` with expected output.
- **§14 AC:** 6 binary, observable. **§15 DoD:** STATUS + DECISIONS D-24548 +
  WORK_INDEX + mindmap + the D-24026 live-verify (surface ≠ infrastructure).
- **§16 code style:** small SFC, descriptive names, prop-driven `+N` (no magic
  literal), `// why:` on the empty-cell overlay rationale.
- **§17 Vision Alignment:** present above.
- **§18 prose-vs-grep:** Step 4 greps `attackBonus` (a required-presence check,
  ≥1 match) — no forbidden-token conflict.
- **§20 Funding Surface Gate:** N/A — no funding affordance / navigation /
  profile / donate copy touched.
- **§21 API Catalog:** N/A — no `apps/server` endpoint or `Library-only`
  function changed.

**Pre-flight:** READY (hard-dep WP-728 is the paired engine projection; scope is
a pure client render of a served field; the SchemeTile consume-`UISchemeState`
and WP-690 board-VFX precedents are established). **Copilot:** PASS (the vue-tsc
gate, the prop-driven `+N` (no hardcoded literal), the empty-cell overlay, and
the non-Portals `undefined` guard — the client under-scope risks — are all in
the allowlist and covered by the component tests).
