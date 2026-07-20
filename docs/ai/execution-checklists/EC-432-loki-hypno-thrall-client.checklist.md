# EC-432 — Loki Hypno-Thralls: UIState + Client Display (Execution Checklist)

**Source:** docs/ai/work-packets/WP-399-loki-hypno-thrall-client.md
**Layer:** Game Engine (UI projection) + Arena Client

## Before Starting
- [ ] **WP-398 / D-24201 has landed on `main`** — `G.mastermind.hypnoThralls`
      exists and a Loki strike populates it. If the field is absent, STOP:
      abort and report; this WP projects a zone it does not own
- [ ] **Enumerate the exact scope lock before editing.** The WP pins the
      expected five: `ui/uiState.types.ts`, `ui/uiState.build.{ts,test.ts}`,
      `components/play/MastermindTile.vue` (+ test), and
      `src/fixtures/uiState/` (`mid-turn`, `endgame-win`, `endgame-loss`,
      `typed.ts`). Re-confirm each, then sweep GLOBALLY for any ADDITIONAL
      literal constructor (search `: UIMastermindState = {` across the repo —
      P6-33/P6-54; a directory walk is not sufficient). The resulting list is
      the allowlist; any edit outside it is a FAIL
- [ ] Read the D-12805 / D-12806 `// why:` block above `UIMastermindState`
      before adding a sibling field
- [ ] Identify the display-entry resolution used by `attachedBystanders` —
      the Thrall projection MUST reuse it, not duplicate it
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` 0;
      `pnpm --filter @legendary-arena/arena-client typecheck` 0;
      `pnpm --filter @legendary-arena/arena-client test` 0 — record all four

## Locked Values (do not re-derive)
- Field: `hypnoThralls: UIDisplayEntry[]` on `UIMastermindState` —
  **required**, never optional
- Order: exactly `G.mastermind.hypnoThralls` (append order); empty zone → `[]`
- Resolution: the SAME display-entry path as `attachedBystanders`, including
  its unresolvable-id fallback — no parallel resolver
- The client renders the group only when non-empty, matching the existing
  captured-bystanders treatment
- `attachedBystanders` and `strikePile` projections are unchanged

## Guardrails
- **`pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) is the
  gate that matters.** `vite build` uses esbuild and `node:test` runs under tsx —
  NEITHER typechecks Vue SFCs. A required-field add that skips this ships
  `vue-tsc` errors to `main` (recurred: WP-166 / WP-207 / WP-227)
- **Backfill every fixture in THIS change.** A `UIMastermindState` built
  anywhere without the new field is a compile error waiting for someone else's
  PR to trip
- The engine stays authoritative — the client renders the projection and never
  infers, recomputes, or mutates Thrall state
- No new `G` field and no engine state change (WP-398 owns the zone); no
  registry import in the client
- Do NOT introduce a second display-entry resolver — a missing
  `cardDisplayData` entry must degrade exactly as the bystander path does
  (the `<unknown>` defect class)
- No pending-choice UX, no Thrall removal, no scoring/VP treatment

## Required `// why:` Comments
- The `hypnoThralls` field on `UIMastermindState`: sibling to
  `attachedBystanders` per D-12805/D-12806; projects the D-24201 zone; the
  engine owns it and the client only renders
- At the projection site: reusing the bystander display-entry resolution
  deliberately, so an unresolvable id degrades identically rather than
  rendering a placeholder
- At the fixture backfills: required-field adds to `UIState` must be
  backfilled in the same change because `vue-tsc` is the only gate that
  catches them

## Files to Produce
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** —
  `hypnoThralls` on `UIMastermindState`
- the engine `UIState` builder — **modified** — project via the existing
  display-entry resolution
- that builder's test file — **modified** — empty / populated / unresolvable-id
  coverage (AC-1..AC-3)
- arena-client mastermind tile component — **modified** — render the group
- every engine + client fixture constructing a `UIMastermindState` —
  **modified** — backfill
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24202 Active),
  `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] **`pnpm --filter @legendary-arena/arena-client typecheck` exits 0** —
      the load-bearing gate for this WP class
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] Dev-server smoke via `?fixture=mid-turn&play=1`: populated Thrall zone
      renders the group, empty zone renders nothing, zero console errors
- [ ] `git diff --name-only` on STAGED changes = exactly the enumerated scope
      lock from Before Starting
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24202 Active;
      `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap node
      `📝`→`✅` + `roadmap:counts:write`
- [ ] **D-24026 live-on-surface**: a real Loki strike on the deployed client
      stacks a Hero and the tile shows it. Green tests + a merged PR do NOT
      satisfy this — record the observation, or record it as
      operator-pending
- [ ] Annotate **D-24192** for OBSERVABILITY only — its fidelity gap was
      closed by WP-397 + WP-398; this WP makes the zone visible

## Common Failure Smells
- CI red on `vue-tsc` after merge → a fixture was missed; `vite build` and
  `node:test` both passed and hid it
- A Thrall renders as a placeholder while bystanders render correctly → a
  second resolution path was introduced instead of reusing the existing one
- The group renders empty rather than being hidden → the non-empty guard was
  dropped; match the bystander treatment
- Thrall order differs from the engine's append order → the projection sorted
  or reversed; it must preserve `G` order
