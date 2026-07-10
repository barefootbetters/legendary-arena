# EC-379 — Player-Count Gauntlet Boards + Challenge Links, Legends-Board Client (Execution Checklist)

> Pairs with [WP-345](../work-packets/WP-345-player-count-gauntlet-client.md)
> (authoritative design) and D-24134 §2–§6 / D-24135. WP wins on conflict.
> (At EC-draft time EC-374 is reserved by open PR #637 and EC-378 landed
> via PR #659; this EC takes the next uncontested slot.)

## Before Starting

- [ ] Read WP-345 in full, then D-24134 §2–§6 + D-24135, then this file.
- [ ] Confirm WP-344 is Done in WORK_INDEX (executed 2026-07-09, PR #643) —
      it publishes every field this packet mirrors.
- [ ] Fresh worktree off current `origin/main` (WP drafted @ `321e4f05`;
      EC drafted @ `e6d1cf2d`). `pnpm install` + `pnpm -r build` exit 0.
- [ ] Baseline capture: `pnpm --filter @legendary-arena/legends-board build`,
      `typecheck`, and `test` all exit 0 (40/40 at EC-draft, live-run
      2026-07-10). A red baseline is a STOP.
- [ ] Read `snapshotClient.ts`, `gauntletDisplay.ts`, `hashRoute.ts`,
      `GauntletIndexPanel.vue`, `GauntletBoardPanel.vue`, `App.vue` end to
      end before editing. `hashRoute.ts` is read-only this packet.
- [ ] Scope lock: EXACTLY the 7 files under Files to Produce (+ governance
      at close). Any other modification is a FAIL — surface as a blocker.
- [ ] If the live `gauntlet-index.json` lacks `entryCounts`/`legs` (WP-344
      not yet deployed): develop against fixtures and note the dependency in
      the close — the panels must degrade to WP-343 behavior on old snapshots.

## Locked Values (do not re-derive)

- Route grammar unchanged (D-24135): `-p<N>` board names ride the existing
  `^gauntlet-[a-z0-9-]+$` rule; `parseHashRoute` is byte-identical after
  this packet.
- Count-tab derivation: tabs render counts 1..5 in order; the solo tab's
  board name is the bare gauntlet board; count N's is `<board>-p<N>`; a
  count links only when `entryCounts` reports ≥1 entry for it; otherwise it
  renders inline unclaimed state (never a link to an absent file — the
  WP-343 index rule, applied per count).
- Suffix resolution: `resolveBoardIndexEntry` strips a trailing `-p[2-5]`
  (exactly one, end-anchored) to find the parent gauntlet's index entry; a
  bare board name resolves directly; resolution only fires when the bare
  lookup misses; unknown name → null (WP-343 missing-board state).
- Roster display: `formatRoster(players)` joins handles with `" + "` in the
  order published (handle ASC per D-24134 §4); a missing `players` field
  falls back to the entry's `handle` — old snapshots keep rendering.
- Challenge URL: `https://cards.legendary-arena.com/?schemeId=<encoded
  setAbbr/schemeSlug>&mastermindId=<encoded setAbbr/mastermindSlug>` built
  with `URLSearchParams`; exactly these two keys — villain groups, henchmen,
  heroes, counts, and player count are deliberately NOT in the URL
  (D-24134 §6). Links open `target="_blank" rel="noopener"`. Pinned AC-3
  string: `https://cards.legendary-arena.com/?schemeId=core%2Fmidtown-bank-robbery&mastermindId=core%2Fdr-doom`.
- Display format: the D-24135 signed one-decimal average format and
  gold-under-PAR styling apply unchanged on every count's board.
- Type mirroring: additive fields hand-mirrored from
  `apps/server/src/legends/legends.types.ts` with a source comment; no
  cross-package import.

## Guardrails

- `package.json` untouched — `vue` stays the sole runtime dependency; any
  dependency addition is a HARD FAIL.
- No engine / registry / preplan / server import; no server API call; no
  cookies or localStorage; built bundle carries no server-API hostname
  (grep `dist/assets/*.js` for `onrender` / `api.legendary-arena` — the
  EC-164 precedent); `cards.legendary-arena.com` appears only in `<a href>`.
- Kiosk/attract cycle byte-identical — per-count boards never cycle
  (D-24135: exactly ONE gauntlet-index slide).
- Existing populated-state rendering for solo boards with old-shape entries
  (no `players`) preserved — additive degradation, never a crash or blank cell.
- No `Math.random()`; no wall-clock reads outside the existing
  freshness-badge path.
- Copy: plain competitive call-to-action; the challenge link's visible text
  names the leg ("Challenge: <schemeName>"); no pricing, no account-benefit
  claims.

## Required `// why:` Comments

- Count-tab unclaimed branch: why an empty count renders inline state and
  never a link (no board file exists below 1 entry — a link would 404).
- `resolveBoardIndexEntry`: why suffix-stripping fires only when the bare
  lookup misses (a mastermind slug can never be shadowed by the suffix rule).
- `buildChallengeUrl`: why only the two id keys ride the URL (D-24134 §6 —
  hero/villain choice is the player's; counts are the builder's defaults).
- Roster fallback: why a missing `players` falls back to `handle` (old
  snapshots predate WP-344 and must keep rendering).

## Files to Produce

EC-draft lock (WP §Files item 8, "locked at EC time"): the parent-gauntlet
resolution helper `resolveBoardIndexEntry` lives in `gauntletDisplay.ts`
with its tests in `gauntletDisplay.test.ts` — no `App.test.ts`. 7 files,
all under `apps/legends-board/src/`, all **modified**, none new:

1. `snapshots/snapshotClient.ts` — additive mirrored fields (`players`,
   `entryCounts`, `legs`) with the source-naming comment.
2. `snapshots/snapshotClient.test.ts` — fixture coverage; absent fields
   tolerated (old-snapshot shape).
3. `panels/gauntletDisplay.ts` — `buildPlayerCountTabs`, `formatRoster`,
   `buildChallengeUrl`, `resolveBoardIndexEntry`.
4. `panels/gauntletDisplay.test.ts` — unit tables for all four helpers
   (pinned URL string incl. encoding; WP ACs 1–4).
5. `panels/GauntletBoardPanel.vue` — count selector + roster column + legs
   list with challenge links.
6. `panels/GauntletIndexPanel.vue` — per-count claim chips + challenge link
   on the unclaimed CTA (first leg).
7. `App.vue` — `-p<N>` board-name → parent index entry resolution passed
   into the board panel.

(+ governance files at close per the WP Definition of Done.)

## After Completing

- [ ] `pnpm --filter @legendary-arena/legends-board build` + `typecheck` +
      `test` all exit 0; zero-API bundle grep clean.
- [ ] Local dev smoke against the live manifest (WP Verification Step 4):
      count selector renders, a `-p2` deep link renders (unclaimed state if
      no entries), a challenge link click-through lands pinned.
- [ ] Governance close: D-24134 annotated with the execution date + any
      addenda; WORK_INDEX WP-345 checked off; STATUS user-visible change;
      EC_INDEX EC-379 → Done; the 05-ROADMAP-MINDMAP WP-345 node flips
      📝 → ✅ + `pnpm roadmap:counts:write` (the recurring omission).
- [ ] D-24026 live-on-surface verification recorded as deploy-dependent
      (CF Pages builds on merge): on legends.legendary-arena.com — count
      selector visible, a `-p<N>` deep link renders, a challenge link lands
      on the cards.legendary-arena.com preview with scheme + mastermind
      pinned. Observed and recorded, not inferred.

## Common Failure Smells

- vue-tsc errors on panel props ⇒ mirrored types drifted from
  `legends.types.ts` — reconcile against the server file, never loosen.
- A p3 tab linking to a 404 ⇒ tab derivation keyed on the count key's
  presence instead of `entryCounts` ≥ 1.
- A literal `/` in the challenge URL's ids ⇒ string concatenation instead
  of `URLSearchParams` (the pinned AC-3 test asserts the encoding).
- An old-snapshot board crashing or blanking ⇒ `players`/`legs` treated as
  required instead of optional mirrors.

## Rules

Commit prefix `EC-379:` for implementation commits; `SPEC:` for governance
(never `WP-345:`). Bug handling per `01.2-bug-handling-under-ec-mode.md`.
STOP means hard stop (EC-TEMPLATE): fix the precondition and re-verify, or
abort and report — never improvise a partial fix.
