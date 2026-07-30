# WP-456 — Legends Board Per-Mastermind Gauntlet Details Reveal

**User-Visible Surface:** `legends.legendary-arena.com` (the Legends Attract
Board gauntlet index). Each gauntlet in the index gains a **clickable "Show
details" reveal** (an expandable card / `<details>`) that displays, for that
mastermind: its **schemes** (the gauntlet legs) and the **approved villain and
henchmen groups** per player count — the composition a run must use to qualify.
**D-24026 live-verification applies** (operator-pending on the Cloudflare Pages
deploy).

## Goal

After this session, a visitor on `legends.legendary-arena.com` can click a
per-gauntlet **details reveal** and see exactly what each mastermind's gauntlet
requires: the **scheme legs**, and the **approved villain + henchmen groups for
each player count** (1–5). Today the board publishes this data in the gauntlet
index snapshot (`GauntletIndexEntry.legs` + `.approvedLoadouts`, WP-395/D-24199)
and even uses `approvedLoadouts` to build challenge links — but it never *shows*
the composition, so a player arriving via a challenge link (which seeds only
scheme + mastermind and auto-adds the Always-Leads villain) has no on-board way
to learn they must add, e.g., **Enemies of Asgard** as the 2-player Magneto
variant-0 second villain group. This WP renders the already-published
requirement. It is a **client-only** `apps/legends-board` change — **zero-API**,
no publisher/server change, no snapshot-contract change, no new artifact — and it
delivers the board-side half of the D-24199 promise that the requirement be
*visible* ("a qualification rule the player cannot see reads as a broken
feature", D-24186/D-24190, quoted in `legends.types.ts:140-144`).

## Assumes

- **On `origin/main` @ `74164b2c`** (the drafting baseline; `git rev-parse
  origin/main` at draft time). `apps/legends-board` builds/tests/typechecks green.
- **The published gauntlet index already carries the data.** `GauntletIndexEntry`
  (`apps/server/src/legends/legends.types.ts:121`) has `mastermindName`,
  `setName`, `legs: readonly GauntletIndexLeg[]` (each `{ schemeSlug, schemeName }`),
  and the optional `approvedLoadouts?: GauntletIndexApprovedLoadouts` — a
  `Record<playerCountString, readonly GauntletIndexApprovedLoadout[]>` where each
  `GauntletIndexApprovedLoadout` is `{ villainGroupIds, henchmanGroupIds }`
  (set-qualified `setAbbr/slug` ext_ids). The **publisher** populates these into
  the published index (`legends.publisher.ts:274` `legs` + `:278`
  `approvedLoadouts`); `approvedLoadouts` is optional so a pre-WP-395 snapshot
  still parses. (Source: the files on `main`.)
- **The board consumes a MIRRORED copy of these types**, not the server type —
  `apps/legends-board/src/snapshots/snapshotClient.ts` ("Mirrored from
  apps/server/… — DO NOT import"), where `legs?` and `approvedLoadouts?` are BOTH
  optional. `buildGauntletDetails` must type its `entry` param against the
  **board's** mirrored type (optional `legs`), which is exactly why the "no-legs →
  empty schemes" path is real and testable. No registry/server type import.
- **`apps/legends-board` already parses and uses these fields.**
  `apps/legends-board/src/panels/gauntletDisplay.ts` exports
  `formatApprovedLoadout(loadout): string` (renders "villains + henchmen"),
  `listApprovedLoadouts(entry, playerCount): readonly GauntletIndexApprovedLoadout[]`,
  and the private `formatGroupId` (`setAbbr/slug` → readable label); the panel
  already reads `gauntlet.legs` and `approvedLoadouts` for challenge-link building
  (`gauntletDisplay.ts:321-322, 604-642`). This WP reuses those helpers; the data
  is already in hand at runtime. (Source: the files on `main`.)
- **`apps/legends-board/src/panels/GauntletIndexPanel.vue`** renders the gauntlet
  index grouped by set (`v-for setGroup … v-for gauntlet`), with per-gauntlet
  chips, player-count and division options. This WP adds a details reveal inside
  each gauntlet's row. (Source: the file on `main`.)
- **Layer invariant (load-bearing):** `apps/legends-board`'s sole runtime
  dependency is `vue`; `@legendary-arena/registry` is a **type-only devDep** and
  must never become a runtime edge (zero-API, WP-343/345). This WP adds **no**
  registry import of any kind — it renders data already present in the parsed
  snapshot. (Source: `apps/legends-board/package.json` on `main`.)

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary` + the leaderboard wiki — the board is
  a zero-API projection of published R2 snapshots; it performs no server calls
  and holds no auth. This WP preserves that exactly (it renders already-fetched
  snapshot fields).
- `.claude/rules/code-style.md` — ESM, `.test.ts`/`node:test`, full English
  names, no branching `.reduce()`, `// why:` on non-self-evident choices,
  human-style code, small pure helpers.
- `apps/legends-board/src/panels/gauntletDisplay.ts` — the existing display
  helpers this WP reuses (`formatApprovedLoadout`, `listApprovedLoadouts`,
  `formatGroupId`) plus the `GauntletIndexEntry` / `GauntletIndexApprovedLoadout`
  types the board already holds. The WP adds one thin, testable aggregation
  helper here (`buildGauntletDetails`) so the template stays declarative.
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — the `node:test`
  posture the new helper's tests mirror.
- `docs/ai/DECISIONS.md` — D-24199 (approved loadouts + the "board must SHOW the
  requirement" intent), D-24131 (both-sides-same-set legs), D-24187 (fixed-pool
  division). This WP reserves **D-24276**.

**Why now.** A live product test (2026-07-29): a 2-player `core/magneto` run
reached the cards builder via a challenge link with only **1** villain group
(Brotherhood, the Always-Leads auto-add), and the WP-454 badge correctly flagged
it "won't count" — but the board offered **no way to discover** that the approved
2-player variant needs Brotherhood **+ Enemies of Asgard** (variant 0). The
composition is already published in the index snapshot; it just isn't shown.
This WP shows it, completing the D-24199 board-side visibility promise.

**Why client-only (no publisher change).** The gauntlet index snapshot already
emits `legs` and `approvedLoadouts` for every gauntlet (verified in
`legends.types.ts` + `gauntlet.logic.ts` on `main`), and the board already parses
them. So surfacing the details needs **no** server/publisher/snapshot-contract
change and no new committed artifact — only board UI + a thin display helper.

## Scope (In)

- **New display helper** in `apps/legends-board/src/panels/gauntletDisplay.ts`:
  `buildGauntletDetails(entry, playerCounts)` — a **pure** function taking a
  gauntlet index entry (`{ legs?, approvedLoadouts? }`) and the player-count list
  (`1..5`), returning a display-ready shape:
  `{ schemes: string[]; loadoutsByCount: { playerCount: number; configs: string[] }[] }`
  where `schemes` are the legs' `schemeName`s and each `configs` entry is a
  `formatApprovedLoadout(...)` string for that player count's approved variants
  (via the existing `listApprovedLoadouts`). A count with no published loadout
  yields an empty `configs` (rendered as a graceful "not published" note, never a
  crash); an entry with no `legs` yields an empty `schemes`.
- **New tests** in `apps/legends-board/src/panels/gauntletDisplay.test.ts` for
  `buildGauntletDetails`: a `core/magneto`-shaped entry yields the scheme names
  and, at player count 2, the approved variant strings (e.g.
  `"Brotherhood + Doombot Legion"`, and the variant that includes Enemies of
  Asgard); an entry with `approvedLoadouts === undefined` yields empty `configs`
  for every count (no throw); an entry with no `legs` yields empty `schemes`.
- **Builder wiring** in `apps/legends-board/src/panels/GauntletIndexPanel.vue`
  (**modified**): inside each gauntlet row, add a **"Show details"** affordance
  (a native `<details>`/`<summary>` expandable card, keyboard-accessible) that
  renders `buildGauntletDetails(...)` output — the **Schemes** list and, per
  player count, the **approved villain + henchmen groups** (labelled by count).
  Uses only existing scoped styling patterns; no new fetch, no new snapshot field.

## Out of Scope

- **No publisher / server / snapshot-contract change** — the data is already
  emitted; this WP only renders it. No `apps/server` edit, no new `legends/v1/*`
  field, no migration.
- **No registry import** (runtime or otherwise) — the board stays `vue`-only at
  runtime; the reveal reads already-parsed snapshot data.
- **No challenge-link prefill change** — making the challenge link (or the cards
  builder's URL-param consumer) actually apply the villain/henchmen params is a
  separate `apps/registry-viewer` concern (a possible follow-on), not this WP.
  This WP is the *reveal* (the operator-chosen option), not the prefill fix.
- **No board data/scoring/ranking change** — the standings, panels, kiosk mode,
  and challenge links are untouched beside the additive reveal.
- **No per-variant editorial / naming beyond the group labels** the existing
  `formatGroupId` already produces from the ext_id slug.

## Files Expected to Change

- `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified** — add the
  pure `buildGauntletDetails` helper (reusing `listApprovedLoadouts` /
  `formatApprovedLoadout`).
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified** — add
  `buildGauntletDetails` unit tests (schemes, per-count configs, undefined-loadouts,
  no-legs).
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** — the
  per-gauntlet "Show details" reveal rendering schemes + approved adversaries.

## Contract

> **Output contract for this session (execution):**
> - Full file contents for every modified file (no diffs).
> - ESM only, Node v22+, human-style code per `00.6-code-style.md`.
> - `apps/legends-board` stays **`vue`-only at runtime** — NO
>   `@legendary-arena/registry` import (type or value) added; the reveal reads
>   already-parsed snapshot fields. NO `fetch` / server call (zero-API).
> - `buildGauntletDetails` is **pure, data-injected, side-effect free**, fully
>   unit-tested; the `<details>` affordance is covered by `vue-tsc` + the
>   dev-server / deployed smoke.

**Locked values (do not re-derive):**

- **Data source:** the parsed `GauntletIndexEntry` — `legs[].schemeName` for
  schemes; `approvedLoadouts[String(playerCount)]` (via `listApprovedLoadouts`)
  for the per-count approved villain/henchmen configs. NO new snapshot field.
- **Formatting:** reuse `formatApprovedLoadout` (→ "villains + henchmen") and
  `formatGroupId`; do not re-implement id→label formatting.
- **Graceful absence:** `approvedLoadouts === undefined` (pre-WP-395 snapshot) →
  empty configs rendered as a "requirement not published" note, never a crash;
  `legs` empty/absent → no schemes list, no crash.
- **Player counts:** 1–5 (the `SupportedPlayerCount` range the snapshot keys on).
- **Zero-API:** no `fetch`, no server call, no registry import — render only.

## Acceptance Criteria

- [ ] `gauntletDisplay.ts` exports `buildGauntletDetails` returning
      `{ schemes, loadoutsByCount }` as specified.
- [ ] For a `core/magneto`-shaped entry, `buildGauntletDetails` yields the scheme
      names, and at player count 2 the approved-config strings are the **literal
      `formatApprovedLoadout` output** for the published 2-player variants — note
      that helper emits **lowercase** `"{villains comma-joined} + {henchmen
      comma-joined}"`, where `" + "` is the **villains↔henchmen divider** (NOT a
      villain pairing). So variant 0 renders `"brotherhood, enemies of asgard +
      doombot legion"` (Enemies of Asgard is the second **villain**), and the
      test asserts that exact string — do not invent a title-cased or
      differently-shaped expectation.
- [ ] `buildGauntletDetails` on an entry with `approvedLoadouts === undefined`
      returns empty `configs` for every count and does not throw; on an entry with
      no `legs`, returns empty `schemes`.
- [ ] `GauntletIndexPanel.vue` renders a keyboard-accessible "Show details" reveal
      per gauntlet showing the schemes and, per player count, the approved
      villain + henchmen groups; an unpublished-requirement gauntlet shows the
      graceful note, not an error.
- [ ] No `@legendary-arena/registry` import (type or value) and no `fetch` /
      server call is added to `apps/legends-board`; `package.json` runtime deps
      stay `{ vue }`.
- [ ] `pnpm --filter @legendary-arena/legends-board test`, `typecheck`
      (`vue-tsc`), and `build` exit 0; `pnpm -r build` exits 0.
- [ ] No file outside the three-file list is modified.

## Verification Steps

```bash
pnpm -r build
# Expected: whole-repo build green.

pnpm --filter @legendary-arena/legends-board test
# Expected: all legends-board tests pass, including the new buildGauntletDetails
# cases (schemes, per-count configs incl. the Magneto 2p Enemies-of-Asgard
# variant, undefined-loadouts graceful, no-legs).

pnpm --filter @legendary-arena/legends-board typecheck   # vue-tsc --noEmit → 0
pnpm --filter @legendary-arena/legends-board build       # vite build → 0

# Deployed smoke (D-24026): on legends.legendary-arena.com, open the gauntlet
# index, click "Show details" on Core Set / Magneto, and confirm it reveals the
# schemes and the approved villains/henchmen per player count (2p shows the
# Enemies-of-Asgard variant). Confirm read_network_requests shows ZERO API calls
# beyond the R2 snapshot reads.
```

## Vision Alignment

**Vision clauses touched:** §10 (Legends Attract Board / `legends.legendary-arena.com`
public surface) and §20–26 (Scoring, PAR & leaderboards — the gauntlet is the
competitive surface; this shows what a run must use to qualify). No identity /
monetization / RNG / determinism / persistence surface is touched.

**Conflict assertion:** *No conflict.* The reveal is a read-only projection of
already-published snapshot data; it scores, ranks, persists, and mutates nothing,
and preserves the board's zero-API / no-runtime-registry invariants. It completes
the D-24199 intent that the qualification requirement be visible to players.

**Non-Goal proximity check:** No proximity to NG-1..7 — free, account-less, no
paid/pay-to-win/cosmetic surface.

## Definition of Done

This packet is complete when ALL of the following are true:
- [ ] All Acceptance Criteria pass.
- [ ] `pnpm --filter @legendary-arena/legends-board test`, `typecheck`, `build`
      exit 0; `pnpm -r build` exits 0.
- [ ] **D-24026 live-verification (operator-pending on deploy):** on the deployed
      `legends.legendary-arena.com`, the Core/Magneto gauntlet's "Show details"
      reveals schemes + approved villains/henchmen per player count (2p includes
      the Enemies-of-Asgard variant), zero non-R2 network calls.
- [ ] `docs/ai/STATUS.md` updated (user-visible: names the per-mastermind details
      reveal on the legends board).
- [ ] `docs/ai/DECISIONS.md` **D-24276** flipped from "Drafted" to "Active
      (post-execution)".
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-491 status → `Done`.
- [ ] No files outside the `Files Expected to Change` list were modified.

---

## Gate Verdicts (drafting session)

All three gates ran as independent subagents against the frozen WP-456/EC-491.

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE**

- Verified on `main` @ `74164b2c`: the published gauntlet index carries `legs` +
  `approvedLoadouts` and the **publisher populates them** (`legends.publisher.ts:274/278`);
  the board's `gauntletDisplay.ts` already exports `formatApprovedLoadout` /
  `listApprovedLoadouts` (private `formatGroupId`) and `GauntletIndexPanel.vue`
  renders the per-gauntlet index; `buildGauntletDetails` needs **no** registry
  import (data already parsed). `apps/legends-board` runtime deps = `{ vue }` only.
- Scope locked: exactly 3 files, all `apps/legends-board` (2 `.ts` + 1 `.vue`,
  all modified), single App layer. No server/publisher/snapshot change.
- Empirical Scaffold N/A (additive, read-only UI over already-published data).
- RS folded: the board consumes a **mirrored** snapshot type (`snapshotClient.ts`,
  `legs?` optional) — the helper types its param against that, not the server type
  (recorded in Assumes).

### Copilot Check (`01.7`) — verdict: **RISK (concern addressed inline; scope-neutral)**

One real finding folded in before recording (no allowlist/contract change → no
pre-flight re-run):
- **F1 (misleading expected string).** `formatApprovedLoadout` emits **lowercase**
  `"{villains comma-joined} + {henchmen comma-joined}"`; the `" + "` is the
  villains↔henchmen **divider**, not a villain pairing, and Enemies of Asgard is a
  second **villain**. The AC's "Brotherhood + Enemies-of-Asgard variant" phrasing
  invited a wrong-shaped fixture. → AC-2 + EC Locked Values now pin the literal
  output (`"brotherhood, enemies of asgard + doombot legion"`) and the villain-slot
  placement.
- Confirmed PASS on the load-bearing lenses: vue-only/zero-API invariant (the
  touched path imports only `vue` + local mirror modules — no registry edge);
  graceful absence (`undefined approvedLoadouts`/`legs` → empty, no throw);
  string-keyed player count already handled by `listApprovedLoadouts`; readable
  labels via reused `formatGroupId`; keyboard-accessible native `<details>`;
  challenge-link prefill correctly out of scope.
- Live-smoke watch-item (pre-existing, not a defect): the reveal surfaces the
  `"villainA, villainB + henchman"` format more prominently than elsewhere.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

All sections PASS or justified-N/A: §5 file list matches the EC allowlist exactly
(3 files, all modified); §6 field names verified against the real `GauntletIndexEntry`
+ `gauntletDisplay.ts`; §8 vue-only/zero-API/no-registry invariant stated AND
enforced by an AC gate; §12 non-vacuous tests incl. undefined-loadouts + no-legs;
§15.1 **D-24026 is a genuine deployed live-verify (not inverted)** for the
`legends.legendary-arena.com` surface; §17 clause numbers + conflict assertion +
NG check. One noted deviation: `## Contract` alias for `## Non-Negotiable
Constraints` — accepted per the shipped WP-454/455 precedent.
