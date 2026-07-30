# WP-457 — Challenge-Link Player-Count Consistency (Legends Index CTA)

**User-Visible Surface:** `legends.legendary-arena.com` (the gauntlet **index**
CTA — the "Challenge →" link on an unclaimed gauntlet row). After this WP, that
link opens the cards builder on a **qualifying** loadout: the pinned approved
villains/henchmen and the URL player count both match the row's selected player
count, instead of pinning the **solo** composition while leaving the count unset
(so the builder evaluated a solo composition at its default 2-player count).
**D-24026 live-verification applies** (operator-pending on the Cloudflare Pages
deploy).

## Goal

After this session, the legends **index** "Challenge →" CTA emits a
player-count-consistent challenge link, so clicking it lands the player on a
loadout that can qualify. Today `firstLegChallengeUrl` (in
`GauntletIndexPanel.vue`) calls `selectApprovedLoadout(gauntlet)` with **no**
player count — which pins the **solo** (count-`1`) approved loadout
(`[core/brotherhood] + [core/doombot-legion]` for Magneto) — and passes
`undefined` for the URL `playerCount`, so the cards builder falls back to
`DEFAULT_PLAYER_COUNT = 2`. The result is a **solo composition evaluated at 2
players**: "A 2-player match needs 2 villain groups — this loadout has 1" (the
exact issue an operator hit). The per-leg links on the **board** panel
(`GauntletBoardPanel`) already pass a single routed count to **both**
`selectApprovedLoadout` and `buildChallengeUrl` and are correct; this WP brings
the index CTA to the same consistency by using the **row's selected player
count** (the same `selectionFor(gauntlet.board).playerCount` that already drives
the row's Download control) for both the pinned loadout and the URL count. It is
a **client-only** `apps/legends-board` change — zero-API, no publisher/server
change. **The cards-builder consumer is already correct** (D-24190's
`applyPreviewToDraft` applies URL `villainGroupIds`/`henchmanGroupIds` onto the
draft); the defect is purely the index CTA emitting an inconsistent link.

## Assumes

- **On `origin/main` @ `7e5f7b2c`** (the drafting baseline; `git rev-parse
  origin/main` at draft time). `apps/legends-board` builds/tests/typechecks green.
- **`gauntletDisplay.ts` exports the correct pure primitives.**
  `buildChallengeUrl(setAbbr, schemeSlug, mastermindSlug, playerCount?,
  approvedLoadout?)` emits `villainGroupIds`/`henchmanGroupIds` params from the
  approved loadout and a `playerCount` param when the count is defined (WP-395 /
  WP-387). `selectApprovedLoadout(entry, playerCount?)` returns the first approved
  config for `String(playerCount ?? 1)` — i.e. **solo** when the count is
  omitted. (Source: `apps/legends-board/src/panels/gauntletDisplay.ts` on `main`.)
- **The board panel is already count-consistent.** `GauntletBoardPanel.vue`
  passes `activePlayerCount.value` to **both** `selectApprovedLoadout` and
  `buildChallengeUrl` (`:158`, `:162-167`) — the pattern this WP applies to the
  index CTA. (Source: the file on `main`.)
- **The index row already carries a per-row selected player count.**
  `GauntletIndexPanel.vue` `selectionFor(gauntlet.board).playerCount`
  (`rowSelections`, `:103`) drives the row's Download control (`:284`,
  `downloadRowPack :138-143`); the CTA reuses it. (Source: the file on `main`.)
- **The consumer is already correct.** `apps/registry-viewer`'s
  `applyPreviewToDraft` (D-24190) applies the URL's `villainGroupIds` /
  `henchmanGroupIds` onto the shared draft after `setMastermind`, and
  `parseSetupUrl` reads those array params — so a count-consistent link with the
  full villains produces a qualifying draft with **no** registry-viewer change.
  (Source: `apps/registry-viewer/src/lib/applyPreviewToDraft.ts` +
  `lib/setupUrlParams.ts` on `main`.)
- `apps/legends-board` runtime dep is `vue` only (zero-API); this WP adds no
  registry/network edge. (Source: `apps/legends-board/package.json` on `main`.)

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary` + the leaderboard wiki — the board is
  a zero-API projection of published R2 snapshots. This WP preserves that (it only
  changes which player count an already-published-data link is built with).
- `.claude/rules/code-style.md` — ESM, `.test.ts`/`node:test`, full English
  names, `// why:` on non-self-evident choices, small pure helpers.
- `apps/legends-board/src/panels/gauntletDisplay.ts` — `buildChallengeUrl` +
  `selectApprovedLoadout` (the primitives) and the WP-456 `buildGauntletDetails`
  precedent for a pure, tested helper. This WP adds one thin helper here.
- `apps/legends-board/src/panels/GauntletBoardPanel.vue` — the **correct**
  count-consistent per-leg link this WP mirrors for the index CTA.
- `apps/registry-viewer/src/lib/applyPreviewToDraft.ts` (D-24190) — proof the
  consumer already applies URL villains/henchmen; **do not touch it** (out of
  scope). The registry-viewer needs no change.
- `docs/ai/DECISIONS.md` — D-24199 (approved loadouts + link must open a
  qualifying run), D-24134 §6 (challenge links), D-24190 (consumer promotion),
  WP-387 (link carries player count). This WP reserves **D-24277**.

**Why now.** An operator followed an index "Challenge →" link for Core/Magneto,
clicked "Edit this loadout," and landed on `villainGroupIds (1): core/brotherhood`
while the builder evaluated a **2-player** match ("needs 2 villain groups — this
loadout has 1"). Root cause verified: the index CTA pins the solo approved
loadout but emits no player count, so the builder defaults to 2 — a solo
composition judged at 2 players. The link should be self-consistent.

**Why the row's selected count (not a hard-coded solo).** The index row already
exposes a player-count selector (used by the Download control). Driving the CTA
off that same `selectionFor(...).playerCount` makes the "Challenge →" and
"Download Mastermind Gauntlet" controls agree, and lets a player who picked, say,
2p get a 2-player-qualifying challenge link. (The considered alternative —
hard-pin count `1` for both — is self-consistent but ignores the row selector;
recorded in the pre-flight.)

## Scope (In)

- **New pure helper** in `apps/legends-board/src/panels/gauntletDisplay.ts`:
  `buildRowChallengeUrl(entry, playerCount)` — resolves the gauntlet's first leg,
  and (when a leg exists) returns
  `buildChallengeUrl(entry.setAbbr, firstLeg.schemeSlug, entry.mastermindSlug,
  playerCount, selectApprovedLoadout(entry, playerCount))` — i.e. the pinned
  approved loadout AND the URL player count both derived from the **same**
  `playerCount`. Returns `null` when the entry has no legs (mirrors the current
  `firstLegChallengeUrl` null-on-no-legs contract). Pure and data-injected.
- **New tests** in `apps/legends-board/src/panels/gauntletDisplay.test.ts` for
  `buildRowChallengeUrl`: for a Magneto-shaped entry at **playerCount 2**, the URL
  carries `playerCount=2` **and** the 2-player approved villains
  (`brotherhood,enemies-of-asgard`) + henchmen — not the solo set; at
  **playerCount 1**, the solo villains + `playerCount=1`; an entry with **no
  legs** returns `null`; an entry whose count has no approved loadout still
  returns a URL (scheme + mastermind + count, no villain params — graceful).
- **Wiring** in `apps/legends-board/src/panels/GauntletIndexPanel.vue`
  (**modified**): `firstLegChallengeUrl(gauntlet)` now calls
  `buildRowChallengeUrl(gauntlet, selectionFor(gauntlet.board).playerCount)` —
  replacing the current `undefined`-count / no-count `selectApprovedLoadout(gauntlet)`
  call — so the CTA uses the row's selected player count for both the pinned
  loadout and the URL count.

## Out of Scope

- **No `apps/registry-viewer` change** — the consumer already applies URL
  villains/henchmen (D-24190 `applyPreviewToDraft`). This WP does not touch the
  builder, its URL parsing, `useSetupFromUrl`, or `applyPreviewToDraft`.
- **No `buildChallengeUrl` / `selectApprovedLoadout` signature change** — they are
  correct; the WP only fixes the **caller** (the index CTA) to pass a consistent
  count.
- **No board-panel change** — `GauntletBoardPanel`'s per-leg links are already
  count-consistent and are untouched.
- **No publisher/server/snapshot change; no registry import; no new network
  call** — client-only, zero-API.
- **No change to the row's Download control, the details reveal (WP-456), the
  count/division selectors, or claimed-board links** — only the unclaimed-row
  "Challenge →" CTA's URL construction changes.

## Files Expected to Change

- `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified** — add the pure
  `buildRowChallengeUrl(entry, playerCount)` helper (wrapping the existing
  `selectApprovedLoadout` + `buildChallengeUrl`).
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified** — add
  `buildRowChallengeUrl` unit tests (2p carries 2p villains + count; 1p solo; no
  legs → null; unpinned count → scheme/mastermind/count only).
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** —
  `firstLegChallengeUrl` uses `buildRowChallengeUrl(gauntlet,
  selectionFor(gauntlet.board).playerCount)`.

## Contract

> **Output contract for this session (execution):**
> - Full file contents for every modified file (no diffs).
> - ESM only, Node v22+, human-style code per `00.6-code-style.md`.
> - `apps/legends-board` stays `vue`-only at runtime — NO registry import, NO
>   `fetch` / server call.
> - `buildRowChallengeUrl` is **pure, data-injected, side-effect free**, fully
>   unit-tested; the component wiring is covered by `vue-tsc` + the deployed/dev
>   smoke.

**Locked values (do not re-derive):**

- **Consistency rule:** the SAME `playerCount` feeds BOTH
  `selectApprovedLoadout(entry, playerCount)` and `buildChallengeUrl(...,
  playerCount, loadout)`. Never pin a loadout for one count and emit (or default)
  another.
- **Count source:** the index CTA uses `selectionFor(gauntlet.board).playerCount`
  (the row's selector — the same source the Download control uses).
- **Signature:** `buildRowChallengeUrl(entry: Pick<GauntletIndexEntry, "setAbbr" |
  "mastermindSlug" | "legs" | "approvedLoadouts">, playerCount: number): string |
  null` (mirrors the WP-456 `buildGauntletDetails` `Pick`-typed precedent).
- **No-legs contract:** `buildRowChallengeUrl` returns `null` when the entry has
  no `legs` **and** preserves the current `firstLeg === undefined → null` guard
  (`noUncheckedIndexedAccess` — `legs[0]` is `T | undefined`).
- **Graceful unpinned count:** if the selected count has no approved loadout,
  `selectApprovedLoadout` returns `undefined` → the URL carries scheme + mastermind
  + count with no villain/henchmen params (unchanged degrade behavior).
- **Consumer untouched:** the qualifying draft is produced by the existing
  registry-viewer `applyPreviewToDraft` (D-24190) — this WP changes only the link.

## Acceptance Criteria

- [ ] `gauntletDisplay.ts` exports `buildRowChallengeUrl(entry, playerCount)`
      returning a challenge URL (or `null` on no legs).
- [ ] For a Magneto-shaped entry at `playerCount = 2`, the returned URL contains
      `playerCount=2` **and** the 2-player approved villains
      (`core/brotherhood`,`core/enemies-of-asgard`) + henchmen — decoded from the
      URL — not the solo `[core/brotherhood]` set.
- [ ] At `playerCount = 1`, the URL carries the solo villains + `playerCount=1`.
- [ ] An entry with no `legs` returns `null`; an entry whose selected count has no
      approved loadout returns a URL with scheme + mastermind + `playerCount` and
      no `villainGroupIds`/`henchmanGroupIds` params.
- [ ] `GauntletIndexPanel.vue` `firstLegChallengeUrl` uses
      `buildRowChallengeUrl(gauntlet, selectionFor(gauntlet.board).playerCount)`;
      no `selectApprovedLoadout(gauntlet)` (count-less) call remains.
- [ ] No `apps/registry-viewer` file, `GauntletBoardPanel.vue`, publisher, or
      snapshot is modified; no registry import / `fetch` added to `apps/legends-board`.
- [ ] `pnpm --filter @legendary-arena/legends-board test`, `typecheck`, `build`
      exit 0; `pnpm -r build` exits 0.
- [ ] No file outside the three-file list is modified.

## Verification Steps

```bash
pnpm -r build
pnpm --filter @legendary-arena/legends-board test
# Expected: legends-board tests pass incl. buildRowChallengeUrl (2p villains+count,
# 1p solo, no-legs → null, unpinned-count graceful).
pnpm --filter @legendary-arena/legends-board typecheck   # vue-tsc → 0
pnpm --filter @legendary-arena/legends-board build        # vite → 0

# Deployed smoke (D-24026): on legends.legendary-arena.com, set an unclaimed
# gauntlet row's player-count selector to 2, click "Challenge →", and confirm the
# cards builder opens with BOTH approved 2-player villains (e.g. Brotherhood +
# Enemies of Asgard for Magneto) and a 2-player required-count readout — i.e. the
# "needs 2 villain groups — has 1" mismatch is gone. Confirm zero non-R2 network.
```

## Vision Alignment

**Vision clauses touched:** §10 (Legends board) + §20–26 (Scoring/leaderboards —
the challenge link now opens a run that can qualify). No identity / monetization /
RNG / determinism / persistence surface is touched.

**Conflict assertion:** *No conflict.* The change only makes an existing
challenge link internally consistent (same count for the pinned loadout and the
URL param); it scores/persists/mutates nothing and preserves the board's
zero-API / no-runtime-registry invariants.

**Non-Goal proximity check:** No proximity to NG-1..7 — free, account-less, no
paid/pay-to-win/cosmetic surface.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `pnpm --filter @legendary-arena/legends-board test`, `typecheck`, `build`
      exit 0; `pnpm -r build` exits 0.
- [ ] **D-24026 live-verification (operator-pending on deploy):** on deployed
      `legends.legendary-arena.com`, an unclaimed row set to 2p → "Challenge →"
      opens the builder with both approved 2-player villains + a 2-player readout
      (no "has 1" mismatch); zero non-R2 network.
- [ ] `docs/ai/STATUS.md` updated (user-visible: names the index-CTA
      challenge-link count fix).
- [ ] `docs/ai/DECISIONS.md` **D-24277** flipped Drafted → Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-492 status → `Done`.
- [ ] No files outside the `Files Expected to Change` list were modified.

---

## Gate Verdicts (drafting session)

All three gates ran as independent subagents against the frozen WP-457/EC-492.

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE**

- Bug **confirmed** on `main`: `GauntletIndexPanel.vue:189-195` passes `undefined`
  count + `selectApprovedLoadout(gauntlet)` (countless → `String(?? 1)` = solo,
  `gauntletDisplay.ts:349`); `buildChallengeUrl` omits the count param when
  `undefined` (`:317-319`); `useLoadoutDraft.ts:78` `DEFAULT_PLAYER_COUNT = 2`.
- Board panel is already the correct mirror (`GauntletBoardPanel.vue:158,162-167`
  passes one count to both); the row selection `selectionFor(board).playerCount`
  (`:103`) is in scope for the CTA.
- **Key claim verified:** the registry-viewer consumer is already correct —
  `applyPreviewToDraft.ts:86-91` applies URL villains/henchmen, `setupUrlParams.ts:23`
  parses the array keys — so the fix is legends-board-only, not a scoped-out
  consumer change.
- Scope locked (3 files, one app); not validation-tightening (Empirical Scaffold
  N/A). RS: the row selector defaults to `1`, so the deployed smoke must set 2p
  explicitly (per Verification Steps); the stale `WP-395` why-comment is replaced.

### Copilot Check (`01.7`) — verdict: **PASS** (2 scope-neutral fixes folded)

Diagnosis **confirmed** (the wrong-diagnosis / should-be-registry-viewer risk was
disproven by the consumer code). No BLOCK. Folded in:
- **FIX-1:** locked `buildRowChallengeUrl`'s `Pick`-typed signature (above).
- **FIX-2:** locked the `firstLeg === undefined → null` guard preservation
  (`noUncheckedIndexedAccess` typing faithfulness) + replacing the stale
  `WP-395` why-comment (EC Required `// why:`).
- Confirmed no duplicate villain: `addUniqueId` (`useLoadoutDraft.ts:500-509`)
  dedupes the Always-Leads Brotherhood re-add; the `setMastermind`-before-add
  order in `applyPreviewToDraft` is correct. Threading the row count (default `1`)
  also fixes the untouched-selector path. Graceful unpinned-count degrade holds.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

All sections PASS or justified-N/A on independent audit: §5 file list matches the
EC allowlist exactly (3 files, all modified); §6 names verified against
`gauntletDisplay.ts` / `GauntletIndexPanel.vue` / `GauntletBoardPanel.vue`; §8
vue-only/zero-API/no-registry stated + enforced; §12 non-vacuous tests incl. the
2p-count regression + no-legs + unpinned-count; §15.1 **D-24026 a genuine deployed
live-verify (not inverted)**; §17 clause numbers + conflict + NG check;
§18/§20/§21 justified N/A. `## Contract` alias accepted per WP-454/455/456
precedent.
