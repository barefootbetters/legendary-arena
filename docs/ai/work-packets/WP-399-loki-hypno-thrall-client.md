# WP-399 — Loki Hypno-Thralls: UIState Projection + Client Display (Engine Projection + Arena Client)

**User-Visible Surface:** play.legendary-arena.com

**Status:** Draft — **BLOCKED on WP-398** (the Thrall zone must exist first)
**Layer:** Game Engine (UI projection) + Arena Client

## Goal

WP-398 writes Hypno-Thralls into `G.mastermind.hypnoThralls` but does not
project them, so a player watching a Loki strike sees their hand shrink and a
log line appear while the card itself vanishes from the interface. This WP
projects the zone into `UIState` and renders it on the mastermind tile, so a
stacked Hero is visible where the card says it goes — next to Loki.

## User-Visible Impact

In a deployed co2e Loki match, the mastermind tile gains a Hypno-Thralls
group listing each stacked Hero by name and image, alongside the existing
captured-bystanders display. A player can see which of their Heroes Loki has
taken and how the count grows across strikes.

## Assumes

- **WP-398 / D-24201 — HARD DEPENDENCY, must land first.**
  `G.mastermind.hypnoThralls` must exist and be populated; without it this WP
  projects an absent field. ⏸ not yet on `main`.
- **WP-128 / D-12805 / D-12806** — `UIMastermindState` already projects
  `attachedBystanders` and `strikePile` as `UIDisplayEntry[]`; that is the
  precedent this WP follows exactly. ✅ on `main`.
- **Arena-client `vue-tsc` breaks on engine `UIState` required-field adds.**
  This has recurred (WP-166 / WP-207 / WP-227). The client fixtures must be
  backfilled **in the same change**, and `pnpm --filter <client> typecheck`
  is a required gate on both sides of this WP.
- Baseline: `origin/main` @ `01498ac1` (re-record at execution — WP-398 lands
  between drafting and this WP's session).

## Context (Read First)

- `packages/game-engine/src/ui/uiState.types.ts` — **AUTHORITATIVE for**
  `UIMastermindState` and the `UIDisplayEntry` shape; read the D-12805 /
  D-12806 `// why:` block above it before adding a sibling field
- `packages/game-engine/src/ui/uiState.build.ts` (+ `uiState.build.test.ts`)
  — **AUTHORITATIVE for** how `attachedBystanders` is resolved to display
  entries; the Thrall projection must reuse that exact path, not a parallel one
- `apps/arena-client/src/components/play/MastermindTile.vue` (+ its test) —
  **AUTHORITATIVE for** the existing captured-bystanders rendering this extends
- `apps/arena-client/src/fixtures/uiState/` (`mid-turn`, `endgame-win`,
  `endgame-loss`, `typed.ts`) — **AUTHORITATIVE for** the client fixtures that
  must be backfilled. These four paths resolved on `main` at draft; EC-432
  §Before Starting still owns enumerating any ADDITIONAL fixture
- `docs/ai/DECISIONS.md` — scan **D-24201** (the zone), **D-12805 / D-12806**
  (the projection precedent), **D-24026** (live-on-surface verification)
- `docs/ai/work-packets/WP-398-loki-hypno-thrall-zone.md` —
  **AUTHORITATIVE for** the zone's semantics (append-only, mastermind-owned)

## Design Rationale

**Why this is a separate WP rather than part of WP-398.** It crosses a layer
boundary — engine projection plus `apps/arena-client` — and the repo's
convention for that is paired WPs, one per side of the boundary (the
WP-384 / WP-385 precedent). Splitting also keeps the sentinel re-pin (WP-398)
away from the `vue-tsc` fixture backfill (this WP), so a failure in either is
unambiguous about its cause.

**Why it is required rather than optional.** State that mutates a player's
hand but is invisible is the shape of bug this project has hit before: cards
leave a zone and the player cannot tell where they went. WP-398's own
`§User-Visible Impact` says its run is infrastructure-only *because* this WP
follows. Shipping WP-398 alone and stopping is the failure mode to avoid.

**Reuse the bystander projection path.** `attachedBystanders` already resolves
`CardExtId`s to `UIDisplayEntry` values with a name/image fallback. Thralls
are the same problem with a different source array; a second resolution path
would be the `<unknown>` class of defect (a missing `cardDisplayData` entry
rendering as a placeholder).

## Scope (In)

- `UIMastermindState.hypnoThralls: UIDisplayEntry[]` — new field, projected
  from `G.mastermind.hypnoThralls` through the **same** display-entry
  resolution used for `attachedBystanders`.
- Arena-client mastermind tile: render the Thralls group, following the
  existing captured-bystanders treatment.
- Backfill every arena-client fixture and any engine `UIState` test fixture
  that constructs a `UIMastermindState`, in this same change.
- Tests: engine projection coverage (empty, populated, unresolvable id) and
  client rendering coverage.

## Out of Scope

- Any engine `G` change — WP-398 owns the zone.
- Any Thrall removal, scoring, or VP treatment.
- Any change to the `attachedBystanders` or `strikePile` projections.
- Any pending-choice UX.

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — the
  `hypnoThralls` field on `UIMastermindState`
- the engine `UIState` builder module — **modified** — project the zone via
  the existing display-entry resolution
- its test file — **modified** — projection coverage
- `apps/arena-client` mastermind tile component — **modified** — render the
  group
- `apps/arena-client` fixtures + any engine `UIState` fixtures — **modified**
  — backfill the new required field
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24202 Active),
  `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance

> The paths above resolved on `main` at draft time and WP-398 touches no
> `UIState` fixture, so they are expected to hold. EC-432 §Before Starting
> still requires re-confirming them and enumerating any ADDITIONAL
> `UIMastermindState` constructor, then treating that full list as the scope
> lock. Per **P6-33 / P6-54**, the enumeration must be a *global* literal-
> constructor sweep (e.g. searching for `: UIMastermindState = {`), not a
> directory walk — `vue-tsc` catches a missed site only after the fact.

## Non-Negotiable Constraints

> **Output contract for this session:**
> - Full file contents for every new or modified file (no diffs, no snippets)
> - ESM only, Node v22+; human-style code per `00.6-code-style.md`
> - **`pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) must pass** — `vite
>   build` and `node:test` under tsx do NOT typecheck Vue SFCs, and this WP's
>   whole risk surface is a required-field add
> - The engine stays authoritative: the client renders a projection and never
>   infers or recomputes Thrall state
> - No new `G` field (WP-398 owns the zone); no registry import in the client
> - Locked contract values: see `## Contract`
> - If any item is unclear or appears to conflict with the source, STOP and ask

## Contract

- `UIMastermindState.hypnoThralls: UIDisplayEntry[]` — **required**, ordered
  as `G.mastermind.hypnoThralls` (append order), empty array when none.
- Resolution reuses the `attachedBystanders` display-entry path verbatim,
  including its unresolvable-id fallback.
- The client renders the group only when non-empty, matching the existing
  bystander treatment.

## Vision Alignment

- **Vision clauses touched:** §1, §2, §10a (client surfaces the engine's
  truth).
- **Conflict assertion:** No conflict: this WP preserves all touched clauses —
  it surfaces existing engine state and adds no rule behaviour.
- **Non-Goal proximity check:** N/A — none of NG-1..7 are crossed.
- **Determinism preservation:** No engine state, RNG, or replay behaviour
  changes; `UIState` is a read-only projection. Hash oracles unaffected.

## Funding Surface Gate

N/A — no funding affordance or copy (§20.1 absent).

## API Catalog Update

N/A per D-11804 — no HTTP endpoint or server-reachable library function.

## Acceptance Criteria

- **AC-1** `UIMastermindState.hypnoThralls` projects every entry of
  `G.mastermind.hypnoThralls`, in the same order.
- **AC-2** An empty zone projects `[]`, and the client renders no group.
- **AC-3** An id with no `cardDisplayData` entry falls back exactly as
  `attachedBystanders` does — no `<unknown>` regression and no throw.
- **AC-4** The client tile lists each Thrall by name/image alongside the
  captured-bystanders display.
- **AC-5** `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 —
  every fixture constructing a `UIMastermindState` carries the new field.
- **AC-6** `attachedBystanders` and `strikePile` projections are unchanged.

## Verification Steps

1. `pnpm -r build` exits 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0.
3. `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 — the gate
   this WP class historically fails.
4. `pnpm --filter @legendary-arena/arena-client test` exits 0.
5. Dev-server smoke via the documented play-fixture route
   (`?fixture=mid-turn&play=1`): a populated Thrall zone renders the group; an
   empty zone renders nothing; zero console errors.
6. `git diff --name-only` on staged changes equals the enumerated scope lock.

## Definition of Done

- [ ] All Acceptance Criteria AC-1..AC-6 satisfied.
- [ ] All Verification Steps green with recorded observed output.
- [ ] **No files outside the EC-432 enumerated scope lock were modified.**
- [ ] `docs/ai/DECISIONS.md` — D-24202 Active.
- [ ] `docs/ai/STATUS.md` close-out entry recorded.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap node `📝` → `✅` +
      counts regenerated.
- [ ] `User-Visible Surface = play.legendary-arena.com` — **D-24026
      live-on-surface verification on the deployed client**: a real Loki
      strike stacks a Hero and the tile shows it. Green tests plus a merged PR
      do not satisfy this; record the observation or record it as
      operator-pending.
- [ ] D-24192's **fidelity** gap is closed by WP-397 + WP-398, not by this
      WP. Annotate D-24192 only for **observability** — the Thrall zone is now
      visible — and do not re-state fidelity closure here.

## Reserved Decision (lands at execution)

**D-24202 — Hypno-Thralls project through the existing mastermind
display-entry path.** Records that the Thrall projection reuses the
`attachedBystanders` resolution rather than introducing a parallel one (the
`<unknown>` defect class), that the client renders a projection and never
infers Thrall state, and that engine `UIState` required-field adds must
backfill client fixtures in the same change because `vue-tsc` is the only gate
that catches them.

## Lint Gate Self-Review (00.3)

Run at draft against all 21 sections. §1–§9 PASS (structure; constraints block
carrying the `vue-tsc` requirement; `§Assumes` names the hard dep and the
recurring failure mode; caps-tagged `§Context`; `§Files Expected to Change`
carries per-file descriptions with an explicit execution-time enumeration
clause). §12–§17 PASS (client `typecheck` gated on both sides per
EC-TEMPLATE; six binary verification steps incl. a dev smoke; six observable
ACs; DoD with the scope-boundary check and a D-24026 live-on-surface item;
Vision block with the §17.2 conflict assertion). §10, §11, §18, §20, §21
resolve N/A with named justifications.
