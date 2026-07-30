# EC-492 — Challenge-Link Player-Count Consistency (Execution Checklist)

**Source:** docs/ai/work-packets/WP-457-challenge-link-count-consistency.md
**Layer:** App (`apps/legends-board`) — client-only, zero-API

## Before Starting
- [ ] On `origin/main` @ `7e5f7b2c` (drafting baseline), worktree clean.
- [ ] `gauntletDisplay.ts` exports `buildChallengeUrl(setAbbr, schemeSlug,
      mastermindSlug, playerCount?, approvedLoadout?)` (emits villain/henchmen +
      count params) and `selectApprovedLoadout(entry, playerCount?)` (solo when
      count omitted).
- [ ] `GauntletBoardPanel.vue` already passes one count to BOTH calls (the
      correct pattern to mirror); `GauntletIndexPanel.vue` `firstLegChallengeUrl`
      currently passes `undefined` count + `selectApprovedLoadout(gauntlet)`
      (the bug); the row carries `selectionFor(board).playerCount`.
- [ ] `apps/registry-viewer` consumer is ALREADY correct (D-24190
      `applyPreviewToDraft`) — do NOT touch it.
- [ ] `pnpm --filter @legendary-arena/legends-board test`/`typecheck`/`build`
      green; `pnpm -r build` green (run `pnpm install` first if the registry
      devDep symlink is stale).
- [ ] **Exact target file set (any file outside this list = FAIL, STOP):** the
      three files under `## Files to Produce`.

## Locked Values (do not re-derive)
- Consistency rule: the SAME `playerCount` feeds BOTH `selectApprovedLoadout(entry,
  playerCount)` AND `buildChallengeUrl(..., playerCount, loadout)`.
- Count source (index CTA) = `selectionFor(gauntlet.board).playerCount` (the row
  selector — same source the Download control uses).
- `buildRowChallengeUrl` **signature** (lock, mirroring the WP-456
  `buildGauntletDetails` precedent):
  `buildRowChallengeUrl(entry: Pick<GauntletIndexEntry, "setAbbr" | "mastermindSlug" | "legs" | "approvedLoadouts">, playerCount: number): string | null`.
- `buildRowChallengeUrl` returns `null` on no `legs` **and** must preserve the
  current `firstLegChallengeUrl` `firstLeg === undefined → null` guard (needed
  under `noUncheckedIndexedAccess` — `legs[0]` is `T | undefined`), so the
  extraction is typing-faithful and does not regress `vue-tsc`.
- Unpinned count (no approved loadout for that count) → URL with scheme +
  mastermind + count, NO villain/henchmen params (graceful, unchanged degrade).
- Consumer untouched: the qualifying draft is produced by the existing
  registry-viewer `applyPreviewToDraft` (D-24190).

## Guardrails
- **`vue`-only runtime, zero-API** — no registry import (type or value), no
  `fetch`. Reuse the existing pure `selectApprovedLoadout` + `buildChallengeUrl`.
- **Do NOT change `buildChallengeUrl` / `selectApprovedLoadout` signatures** — fix
  the CALLER only.
- **Do NOT touch `apps/registry-viewer`, `GauntletBoardPanel.vue`, the publisher,
  or the snapshot.** The consumer already works.
- **`buildRowChallengeUrl` is pure + data-injected** (entry + count in) so it
  unit-tests without a live snapshot; never throws.
- **No behavior change to claimed-board links, the Download control, the WP-456
  details reveal, or the count/division selectors.**

## Required `// why:` Comments
- Why the index CTA uses `selectionFor(...).playerCount` for BOTH the pinned
  loadout and the URL count (a countless link pinned the solo loadout but let the
  builder default to `DEFAULT_PLAYER_COUNT = 2` → a solo composition judged at 2
  players; the row selector is the same count the Download control uses).
- Why the consumer needs no change (the registry-viewer `applyPreviewToDraft`,
  D-24190, already applies the URL villains/henchmen onto the draft).
- **Replace** (do not leave stale) the existing
  `GauntletIndexPanel.vue:186-188` `// why: WP-395 …` block that justifies the
  now-removed count-less solo pin — it becomes false when the count is threaded.

## Files to Produce
- `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified** — pure
  `buildRowChallengeUrl(entry, playerCount)` wrapping `selectApprovedLoadout` +
  `buildChallengeUrl` with one shared count; `null` on no legs.
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified** —
  `node:test`: 2p → 2p villains + `playerCount=2`; 1p → solo villains +
  `playerCount=1`; no legs → `null`; unpinned count → scheme/mastermind/count only.
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** —
  `firstLegChallengeUrl` uses `buildRowChallengeUrl(gauntlet,
  selectionFor(gauntlet.board).playerCount)`; remove the countless
  `selectApprovedLoadout(gauntlet)` call.

## After Completing
- [ ] `pnpm --filter @legendary-arena/legends-board test` exits 0 (new cases green).
- [ ] `pnpm --filter @legendary-arena/legends-board typecheck` (`vue-tsc`) exits 0.
- [ ] `pnpm --filter @legendary-arena/legends-board build` exits 0; `pnpm -r build` 0.
- [ ] `apps/legends-board/package.json` runtime deps STILL `{ vue }`.
- [ ] **D-24026 live-verify (operator-pending):** on `legends.legendary-arena.com`,
      an unclaimed row set to 2p → "Challenge →" opens the builder with both
      approved 2p villains + a 2p readout (no "has 1" mismatch); zero non-R2 network.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` **D-24277** Drafted → Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` `📝` → `✅`, then `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-492 → `Done`.
- [ ] No file outside the three-file list was modified.

## Common Failure Smells
- The 2p challenge link still opens a 1-villain builder → the count wasn't threaded
  into BOTH calls; `selectApprovedLoadout` must receive the same count as
  `buildChallengeUrl`.
- A registry-viewer file appears in the diff → the fix drifted to the consumer,
  which is already correct; the fix is the legends-board link only.
- The link drops the `playerCount` param → the builder defaults to 2 again; ensure
  `buildChallengeUrl` gets the count.
- `buildRowChallengeUrl` throws on a legs-less entry → it must return `null`.
