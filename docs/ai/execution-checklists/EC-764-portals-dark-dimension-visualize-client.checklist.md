# EC-764 — Portals Dark-Portal board overlay (Execution Checklist)

**Source:** docs/ai/work-packets/WP-727-portals-dark-dimension-visualize-client.md
**Layer:** Arena Client (App)

## Before Starting
- [ ] WP-728 / EC-765 ✅ on `main`: `scheme.darkPortals` is served on `UIState` (public shared-board) and `UISchemeState` (from `@legendary-arena/game-engine`) declares `darkPortals?`
- [ ] `MastermindTile.vue` renders from `:mastermind`; `CityRow.vue` renders 5 cells from `:city`; both mounted by `PlayDesktop.vue` / `PlayMobile.vue` which hold `snapshot`
- [ ] Target file set = the `Files to Produce` list below; any file outside it is a FAIL — surface as a blocker
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (vue-tsc — esbuild/tsx do NOT type-check)
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0

## Locked Values (do not re-derive)
- Read `snapshot.scheme.darkPortals` (optional — omitted for non-Portals; guard `undefined`)
- Mastermind marker shows iff `darkPortals?.onMastermind`; bonus = `darkPortals.mastermindAttackBonus`
- City marker shows for each index in `darkPortals?.citySpaceIndices`; bonus = `darkPortals.citySpaceAttackBonus`
- `data-testid="dark-portal-marker"`
- `MastermindTile` prop: `darkPortalBonus?: number` (default 0, marker when `> 0`)
- `CityRow` props: `darkPortalIndices?: number[]` (default `[]`), `darkPortalBonus?: number` (default 0)

## Guardrails
- **Client-only** — no engine / server / `packages/**` change; consume the served field verbatim (D-20105). Do NOT recompute portal locations from `DARK_PORTAL_COUNT`.
- The marker's `+N` is the descriptor's bonus prop — **never a hardcoded `1`** (a future multi-stack buff must render faithfully).
- The city marker renders on a portal'd cell **even when the space is empty** (the portal buffs the space, not the occupant).
- `boardgame.io/react` is never imported; this overlay dispatches NO move.
- Reuse the WP-690 board-VFX / tile-overlay layering; introduce no new positioning system; verify no collision with the bottom-left fixed-pill stack.
- No game logic in the components; render only (Vision NG-1, off-ranking).

## Required `// why:` Comments
- `CityRow` per-cell overlay: a Dark Portal buffs the SPACE, so the marker renders on an empty cell too
- `MastermindTile` marker gate: shown only when `darkPortalBonus > 0` (0 = no portal / non-Portals scheme)
- `PlayDesktop` / `PlayMobile` derivation: `scheme.darkPortals` is `undefined` for non-Portals schemes — guard before reading

## Files to Produce
- `apps/arena-client/src/components/play/DarkPortalMarker.vue` — **new** — the marker glyph + `+N attack`
- `apps/arena-client/src/components/play/DarkPortalMarker.test.ts` — **new** — renders the passed bonus (incl. `+2`)
- `apps/arena-client/src/components/play/MastermindTile.vue` — **modified** — `darkPortalBonus` prop + marker
- `apps/arena-client/src/components/play/CityRow.vue` — **modified** — `darkPortalIndices` / `darkPortalBonus` props + per-cell marker
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — derive + pass props
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — derive + pass props
- `docs/ai/DECISIONS.md` — **modified** — land D-24548
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — governance close
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-727 `📝` → `✅`

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (incl. new marker tests)
- [ ] `pnpm -r build` exits 0
- [ ] `git diff --name-only` shows only the `apps/arena-client` allowlist + governance docs (no `packages/**`, no `apps/server`)
- [ ] Overlay does not collide with the bottom-left fixed-pill stack
- [ ] **Live-on-surface (D-24026) — REQUIRED:** on deployed `play.legendary-arena.com`, in a Core Portals match (via `?match=`, not only `?fixture=`), the Mastermind marker appears at twist 1 and a city-space marker with each subsequent twist, each showing `+N attack`, no freeze — evidence captured
- [ ] `docs/ai/STATUS.md` updated (the Portals visual is live); `docs/ai/DECISIONS.md` D-24548 landed
- [ ] WORK_INDEX + EC_INDEX flipped to Done; `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅`; `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- A `+1` that never changes when a future buff would stack usually means the marker hardcoded the literal instead of reading the bonus prop.
- A portal that vanishes over an empty city space means the overlay was gated on the cell having a villain — remove that gate.
- vue-tsc red on `main` after merge means the typecheck gate was skipped (esbuild/tsx do not type-check).
