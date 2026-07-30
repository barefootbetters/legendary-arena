# EC-491 — Legends Board Per-Mastermind Gauntlet Details Reveal (Execution Checklist)

**Source:** docs/ai/work-packets/WP-456-legends-mastermind-details-reveal.md
**Layer:** App (`apps/legends-board`) — client-only, zero-API

## Before Starting
- [ ] On `origin/main` @ `74164b2c` (drafting baseline), worktree clean.
- [ ] `apps/legends-board/package.json` runtime deps are `{ vue }` only; registry
      is a TYPE-ONLY devDep (confirm before + after — must not change).
- [ ] `gauntletDisplay.ts` exports `formatApprovedLoadout` +
      `listApprovedLoadouts` and the private `formatGroupId`; the board's
      `GauntletIndexEntry` carries `legs` (`{schemeSlug, schemeName}`) +
      `approvedLoadouts?` (Record<countString, {villainGroupIds, henchmanGroupIds}[]>).
- [ ] `GauntletIndexPanel.vue` renders the index grouped by set with a per-gauntlet
      row (the reveal's insertion point).
- [ ] `pnpm --filter @legendary-arena/legends-board test` + `typecheck` + `build`
      green at baseline; `pnpm -r build` green.
- [ ] **Exact target file set (any file outside this list = FAIL, STOP):** the
      three files under `## Files to Produce`.

## Locked Values (do not re-derive)
- Data source = the parsed `GauntletIndexEntry`: `legs[].schemeName` (schemes);
  `listApprovedLoadouts(entry, playerCount)` for per-count approved configs. NO
  new snapshot field, NO publisher change.
- Formatting = reuse `formatApprovedLoadout` + `formatGroupId`; do NOT
  re-implement id→label. **`formatApprovedLoadout` emits LOWERCASE**
  `"{villains comma-joined} + {henchmen comma-joined}"` — the `" + "` is the
  villains↔henchmen **divider**, not a villain pairing. The expected test string
  is that literal output: e.g. Magneto 2p variant 0 = `"brotherhood, enemies of
  asgard + doombot legion"` (Enemies of Asgard sits in the **villain** slot). Do
  NOT title-case or place a second villain in the henchman half of a fixture.
- `buildGauntletDetails(entry, playerCounts)` returns
  `{ schemes: string[], loadoutsByCount: { playerCount:number, configs:string[] }[] }`.
- Graceful absence: `approvedLoadouts === undefined` → empty `configs` (render a
  "requirement not published" note, never a crash); no `legs` → empty `schemes`.
- Player counts = 1–5.
- Zero-API: NO `fetch`, NO server call, NO `@legendary-arena/registry` import
  (type OR value) added anywhere in `apps/legends-board`.

## Guardrails
- **`vue`-only runtime.** Adding any `@legendary-arena/registry` import (even
  `import type`) to a runtime-bundled board module is a layer violation — STOP.
  The reveal renders data already in the parsed snapshot.
- **Zero-API preserved** — no new network request; the board still reads only the
  R2 snapshots it already fetches.
- **Additive only** — do NOT change standings, panels, kiosk mode, challenge
  links, or the snapshot contract. The reveal is a new affordance beside them.
- **`buildGauntletDetails` is pure + data-injected** (entry + player-count list
  passed in) so it unit-tests without a live snapshot; it never throws on a
  missing `approvedLoadouts` / `legs`.
- **Keyboard-accessible reveal** — use a native `<details>`/`<summary>` (or an
  equivalent ARIA-correct disclosure); do not build a mouse-only toggle.
- **No re-implemented formatting** — reuse the existing helpers.

## Required `// why:` Comments
- Why `buildGauntletDetails` reads only the parsed snapshot entry and imports no
  registry (the board is `vue`-only at runtime; the data is already published in
  the index snapshot per WP-395/D-24199 — this completes the "board must SHOW the
  requirement" intent, D-24186/D-24190).
- Why an absent `approvedLoadouts` degrades to a "not published" note rather than
  hiding the reveal or throwing (a pre-WP-395 snapshot still parses; the reveal
  must not crash).

## Files to Produce
- `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified** — pure
  `buildGauntletDetails` reusing `listApprovedLoadouts` / `formatApprovedLoadout`.
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified** —
  `node:test`: schemes list; per-count configs incl. the Magneto 2p
  Enemies-of-Asgard variant; undefined-`approvedLoadouts` → empty configs (no
  throw); no-`legs` → empty schemes.
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** — the
  per-gauntlet keyboard-accessible "Show details" reveal (schemes + approved
  villains/henchmen per player count) + a graceful "not published" note.

## After Completing
- [ ] `pnpm --filter @legendary-arena/legends-board test` exits 0 (new cases green).
- [ ] `pnpm --filter @legendary-arena/legends-board typecheck` (`vue-tsc`) exits 0.
- [ ] `pnpm --filter @legendary-arena/legends-board build` exits 0; `pnpm -r build` 0.
- [ ] `apps/legends-board/package.json` runtime deps STILL `{ vue }` (no registry edge).
- [ ] **D-24026 live-verify (operator-pending):** on `legends.legendary-arena.com`,
      Core/Magneto "Show details" reveals schemes + per-count approved
      villains/henchmen (2p includes Enemies of Asgard); zero non-R2 network calls.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` **D-24276** Drafted → Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` `📝` → `✅`, then `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-491 → `Done`.
- [ ] No file outside the three-file list was modified.

## Common Failure Smells
- Browser build gains a `node:*` error / bundle bloat → a registry import crept
  in; the reveal must read only the parsed snapshot entry.
- The reveal throws / renders blank on a gauntlet whose `approvedLoadouts` is
  absent → the graceful "not published" path wasn't wired.
- Villain/henchmen render as raw `setAbbr/slug` ext_ids → `formatGroupId` /
  `formatApprovedLoadout` weren't reused.
- The reveal only toggles on click, not keyboard → use a native `<details>`.
- A network request appears on reveal → zero-API violated; the data is already
  in hand, render it.
