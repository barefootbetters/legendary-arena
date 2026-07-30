# WP-462 — Legends Board Per-Set "Show Set Details" Reveal (Client)

**User-Visible Surface:** `legends.legendary-arena.com` (the Legends Attract Board
gauntlet index). Each **set group** gains a keyboard-accessible **"Show set
details"** reveal listing the set's full roster (masterminds, schemes, villains,
henchmen) with each villain/henchman marked fought/not-fought by that set's
gauntlets. **D-24026 live-verification applies** (operator-pending on the
Cloudflare Pages deploy, after WP-461's snapshot propagates).

## User-Visible Impact

A visitor can expand a set and see, at a glance, exactly what that set's gauntlet
challenge does and does not cover — every mastermind and scheme (all fought) and
every villain/henchman marked ✓ (this set's gauntlets fight it) or ✗ (in the set
but this set's gauntlets never fight it). It makes the coverage gap the operator
flagged visible and honest, on the board itself.

## Goal

Each set group on the legends gauntlet index (`legends.legendary-arena.com`)
gains a keyboard-accessible **"Show set details"** reveal listing the set's full
roster — every **mastermind, scheme, villain group, and henchman group** — with
each **villain and henchman marked ✓ (fought by the gauntlets) or ✗ (in the set
but no gauntlet fights it)**. It renders the `sets` roster WP-461 publishes into
`gauntlet-index.json`, using the registry's authoritative group names. This
answers the operator's transparency ask ("it's unclear if all the villains and
henchmen are being used") directly on the board.

## Assumes

- **On `origin/main` after WP-461 merges** — the deployed publisher emits
  `GauntletIndexSnapshot.sets` with per-set `masterminds/schemes/villains/henchmen`
  and `usedByGauntlets` flags (WP-461 `§Contract`). The client mirror type and
  render degrade gracefully when `sets` is absent (a pre-WP-461 snapshot still on
  the CDN), so this WP can merge before the new snapshot has propagated.
- **legends-board is `vue`-only / zero-API** — its only runtime dependency is
  `vue`; `@legendary-arena/registry` is a type-only devDep that never enters the
  bundle. The snapshot types are **mirrored** in
  `apps/legends-board/src/snapshots/snapshotClient.ts` (the header forbids
  importing the server types across the layer boundary). This WP adds the mirror
  of WP-461's additive types.
- **The board already groups the index by set** via `groupGauntletsBySet` →
  `pinShowcaseGauntlet` (`gauntletDisplay.ts`), and already renders a
  per-mastermind "Show details" reveal (WP-456) in `GauntletIndexPanel.vue`. The
  new per-**set** reveal attaches to the set-group header, beside those.

## Context (Read First)

**Read before executing:** WP-461 `§Contract` (the `SetDetails` shape this WP
mirrors field-for-field), `docs/ai/ARCHITECTURE.md §Layer Boundary` (the board
mirrors server snapshot types, never imports them — `snapshotClient.ts`'s header
forbids it), and the existing WP-456 reveal in `GauntletIndexPanel.vue` (the
native-`<details>` accessibility precedent this reuses).

WP-456 revealed per-mastermind approved adversaries; WP-461 now publishes the
whole set roster with coverage flags. The board already has masterminds (each
gauntlet row) and schemes (any gauntlet's `legs`), but it has **no way to show
the villains/henchmen a gauntlet does not use** — those groups are absent from
`approvedLoadouts`. WP-461's `sets` field supplies the full roster + the honest
`usedByGauntlets` flag; this WP renders it so a visitor can see, per set, exactly
what a "set challenge" does and does not currently cover.

Split rationale: consumer half of the WP-461 producer/consumer contract (shared
`§Assumes`). Client-only, no server/snapshot/registry change — the coverage truth
is computed once in WP-461, so this WP is purely presentational.

## Scope (In)

- **`apps/legends-board/src/snapshots/snapshotClient.ts`** — mirror WP-461's
  `SetNamedGroup`, `SetAdversaryGroup`, `SetDetails` types; add the additive
  optional `sets?: readonly SetDetails[]` to the local `GauntletIndexSnapshot`
  mirror; tolerate its absence in `fetchGauntletIndex` (no new required field,
  no throw on an old snapshot).
- **`apps/legends-board/src/panels/gauntletDisplay.ts`** — a pure
  `findSetDetails(sets, setAbbr)` lookup (returns the matching `SetDetails` or
  `undefined`), for the panel to resolve a set group's roster.
- **`apps/legends-board/src/panels/gauntletDisplay.test.ts`** — tests for
  `findSetDetails` (hit / miss / undefined-sets).
- **`apps/legends-board/src/panels/GauntletIndexPanel.vue`** — per-set-group
  "Show set details" `<details>` reveal (scoped CSS, reusing the WP-459 grid
  tokens): four labelled sections (Masterminds, Schemes, Villains, Henchmen);
  villains/henchmen each rendered with a ✓/✗ coverage marker whose meaning is an
  `aria-label`/visually-hidden span reading "used by this set's gauntlets" /
  "not used by this set's gauntlets" (per-set-scoped wording, not colour alone,
  not `title` alone). Absent `SetDetails` → the reveal is not rendered for that
  group (old snapshot degrades cleanly).

## Out of Scope

- No server/publisher/snapshot-contract change (WP-461 owns the data), no
  registry import (type or value), no `fetch` beyond the existing R2 reads.
- No change to the WP-456 per-mastermind reveal, the standings panels, challenge
  links, download control, or kiosk cycling.
- No recomputation of coverage on the client — it renders WP-461's flag verbatim.

## Files Expected to Change

- `apps/legends-board/src/snapshots/snapshotClient.ts` — **modified** (mirror
  types + `sets?`)
- `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified**
  (`findSetDetails`)
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified** (tests)
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** (reveal)

## Contract

> Full file contents (no diffs); ESM/Node v22+; human-style code per
> `00.6-code-style.md`; `vue`-only runtime / zero-API; types mirror WP-461 verbatim
> (never import the server module); scoped CSS; the coverage marker is
> text-labelled, not colour-only (accessibility).

**Locked:** the mirrored types match WP-461 `§Contract` field-for-field. The
reveal reads `SetDetails` verbatim — it does not derive or recompute
`usedByGauntlets`. Villain/henchman groups render `name` with a ✓/✗ marker whose
meaning is conveyed in **text via an `aria-label` / visually-hidden span (not
`title` alone** — `title` is not reliably exposed to screen readers or keyboards).
**The marker's text must match the flag's PER-SET-SCOPED meaning (LOCKED,
mirroring WP-461 / D-24279):** "used by this set's gauntlets" / "**not** used by
this set's gauntlets" — never the unscoped "any gauntlet" (a group used only as a
cross-set fallback would then read a false ✗ claim).

## Acceptance Criteria

- [ ] Each set group with published `SetDetails` shows a "Show set details"
      reveal listing all masterminds, schemes, villains, henchmen by name.
- [ ] Villains/henchmen render a ✓/✗ marker matching `usedByGauntlets`, with the
      meaning in an `aria-label`/visually-hidden span reading "used by this set's
      gauntlets" / "not used by this set's gauntlets" (per-set-scoped, not colour
      alone, not `title` alone).
- [ ] A snapshot with no `sets` (pre-WP-461) renders the index exactly as before
      — no reveal, no throw, no console error.
- [ ] Runtime deps stay `{ vue }`; no registry import (type or value at runtime);
      no new `fetch`.
- [ ] `pnpm --filter @legendary-arena/legends-board test`, `typecheck`, `build`
      exit 0; `pnpm -r build` exits 0.
- [ ] No file outside the allowlist (+ governance) is modified.

## Verification Steps

```bash
pnpm --filter @legendary-arena/legends-board test
pnpm --filter @legendary-arena/legends-board typecheck
pnpm --filter @legendary-arena/legends-board build
pnpm -r build
# Live smoke (D-24026, after WP-461 deploy propagates): expand a set's
# "Show set details" — the full roster shows, and for Core the villains list
# marks radiation/skrulls/spider-foes ✗ and brotherhood ✓.
```

## Vision Alignment

**Clauses:** §10 (Legends board presentation). No scoring / identity / RNG /
determinism / persistence surface. **Conflict:** *No conflict* — a read-only
render of already-published derived data. **NG:** none.

## Definition of Done

- [ ] All Acceptance Criteria pass; legends-board test/typecheck/build + `pnpm -r
      build` green.
- [ ] **D-24026 live-verify (operator-pending):** deployed board shows the per-set
      reveal with correct ✓/✗ marks (after WP-461's snapshot propagates).
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` row checked off;
      `ROADMAP-MINDMAP.md` `📝`→`✅` + `pnpm roadmap:counts:write` (`:check` 0);
      `EC_INDEX.md` EC-497 → Done.
- [ ] No files outside the allowlist (+ governance) modified. (No D-entry — client
      mirror of the D-24279 server contract.)

## Lint Gate Self-Review

- **§1–4:** WP+EC numbered; authority cited; hard-dep WP-461 (paired producer).
  PASS.
- **§5 (allowlist):** 4 client files, single layer/app. PASS.
- **§8 (layer boundary):** mirrored types, no server import, `vue`-only/zero-API.
  PASS.
- **§15 (D-24026):** user-visible surface = `legends.legendary-arena.com`;
  live-verify present. PASS.
- **§17 (Vision):** §10, No conflict. PASS.
- **§20 (Funding Surface Gate):** N/A — no funding/donation surface or copy.
  **§21:** N/A (no `apps/server` endpoint).
- No new contract *file* (the mirror is additive to an existing types module).

## Gate Verdicts (drafting session)

Recorded at drafting; see the SPEC commit body for the pre-flight / copilot / lint
subagent verdicts run against this WP + EC-497.
