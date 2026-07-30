# WP-453 — Gauntlet Loadout Qualification Guard (cards builder)

**User-Visible Surface:** `cards.legendary-arena.com` (the Registry-Viewer
Loadout Builder). While building a loadout, a visitor sees a **pre-play
qualification badge**: when the draft's mastermind hosts a gauntlet, the badge
reads **"✓ Qualifies for the {mastermind} gauntlet (variant N)"** if the
villain/henchmen composition and player count match an approved configuration,
or **"✗ These villains/henchmen won't count toward the {mastermind} gauntlet"**
if they don't — turning a silent, post-game non-qualification into a visible,
pre-game warning. In addition, a draft **prefilled from a Gauntlet Pack**
(WP-444) renders its villain/henchmen fields **locked** (read-only chips, no
add/remove) so the visitor can only change heroes; an explicit **"Unlock
adversaries"** control lets a visitor who deliberately wants a non-gauntlet
loadout opt out. **D-24026 live-verification applies** (operator-pending on the
Cloudflare Pages deploy).

## Goal

After this session, the Registry-Viewer Loadout Builder (`apps/registry-viewer`)
**surfaces gauntlet-leg qualification at build time**, closing the footgun where
a visitor plays a match with the wrong villains/henchmen and only discovers
post-game that it never counted toward a gauntlet. Two additive behaviors: (1) a
**pure qualification-check helper** compares the current draft's adversary
composition (`villainGroupIds` + `henchmanGroupIds`) and `playerCount` against
the mastermind's approved `GAUNTLET_LOADOUT_MENUS` and returns a discriminated
`{ status }` result, which the builder renders as a **qualification badge**
(qualifies / does-not-qualify / not-a-gauntlet); (2) a draft prefilled from a
WP-444 Gauntlet Pack leg renders its villain/henchmen fields **locked**, with an
explicit **"Unlock adversaries"** escape hatch that returns the draft to free
editing. All logic is **client-side from the registry the viewer already
bundles** — **zero-API**, no server call, no snapshot change, no
`packages/registry` change. This is a UX guard over the existing WP-444 import
path and the hand-built loadout path; the server remains the sole adjudication
authority (the badge is advisory, not a gate).

## Assumes

- **On `origin/main` @ `28b3b61f`** (the drafting baseline; `git rev-parse
  origin/main` at draft time). `apps/registry-viewer` builds, tests, and
  typechecks green on this SHA.
- **WP-444 / EC-479 / D-24263 is landed on `main`** (hard dependency).
  `apps/registry-viewer/src/lib/loadoutGauntletPackImport.ts` exports
  `parseGauntletPack`, `resolveGauntletLegLoadout`, and
  `listGauntletLegSchemeIds`; `LoadoutBuilder.vue` hosts the "Load Gauntlet Pack
  (paste or file)" importer, the leg picker, the optional variant selector, the
  `gauntletPack` / `gauntletMenu` / `gauntletSelectedVariantIndex` state, the
  `onPickGauntletLeg` prefill handler, and the `gauntletImportSuccessAt` flag set
  on a successful leg load. (Source: WORK_INDEX.md WP-444 row = **Done
  2026-07-28**; the files on `main`.)
- **WP-395 / D-24199 is landed on `main`** (data dependency).
  `packages/registry/src/gauntletLoadouts.ts` exports `getGauntletLoadoutMenu(
  setAbbr, mastermindSlug): GauntletLoadoutMenu | undefined` and
  `GAUNTLET_LOADOUT_MENUS`, under the `./gauntletLoadouts` subpath. A
  `GauntletLoadoutMenu` has `variants: readonly GauntletLoadoutVariant[]`; a
  `GauntletLoadoutVariant` has a stable `variantIndex: number` and
  `compositionsByPlayerCount: Record<SupportedPlayerCount,
  GauntletLoadoutComposition>`; a `GauntletLoadoutComposition` has
  `villainGroupIds` + `henchmanGroupIds` — set-qualified `setAbbr/slug` ext_ids,
  **sorted ASC**. (Source: the file on `main`.) `LoadoutBuilder.vue` already
  value-imports `getGauntletLoadoutMenu` from `@legendary-arena/registry/
  gauntletLoadouts` (WP-444).
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — the draft's
  `composition` carries `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`,
  `schemeId`, `mastermindId` (all set-qualified `setAbbr/slug` ext_ids, D-10014 /
  D-24018) and the four supply-pile counts; `playerCount` is envelope-level. The
  public setters include `addVillainGroup` / `removeVillainGroup` /
  `addHenchmanGroup` / `resetDraft`. (Source: the file on `main`.)
- `LoadoutBuilder.vue` renders the villain/henchmen slots as chip lists with
  per-chip `removeVillainGroup(groupId)` / henchmen remove controls and an
  `activeSlot`-driven add affordance. `draft.value.composition.mastermindId` is
  the set-qualified `"{setAbbr}/{mastermindSlug}"` ext_id from which the
  mastermind's menu is resolved. (Source: the file on `main`.)
- `apps/registry-viewer/package.json` declares `@legendary-arena/registry` as a
  runtime **`dependency`**; the viewer value-imports registry symbols through
  **narrow subpaths** (`/gauntletLoadouts`, `/gauntletPack`, `/playerCountSetup`,
  `/setupContract`, `/schema`) — never the root barrel. This WP adds **no new
  registry import** (it reuses the already-imported `getGauntletLoadoutMenu` and
  the `GauntletLoadoutMenu` type). (Source: the file on `main`.)

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the App layer and
  the Import Rules row for `apps/registry-viewer`: it **may** runtime-import
  `registry` (browser-safe subpaths) and the UI framework; it must never import
  `game-engine`, `server`, `pg`, or `boardgame.io`. This WP adds no new
  cross-layer import.
- `.claude/rules/architecture.md` Import Rules table + §Persistence Boundary — no
  `G`, no snapshot; this WP touches neither. The gauntlet **qualification rule**
  is authored server-side (`apps/server/src/legends/gauntletTruth.logic.ts`
  `matchesApprovedLoadout`, WP-395/D-24199); this WP does **not** re-implement or
  relocate that rule — it renders an **advisory client-side mirror** of the
  same approved-menu data for pre-play feedback. The server stays the sole
  adjudicator; a qualifying badge is a prediction, not a guarantee, and a match
  is still scored/adjudicated server-side by `matchId`.
- `.claude/rules/code-style.md` — ESM-only, `node:test`, `.test.ts`, full English
  names, no `.reduce()` for branching logic, `// why:` on non-self-evident
  choices, human-style code, discriminated results over stringly-typed flags.
- `apps/registry-viewer/src/lib/loadoutGauntletPackImport.ts` (WP-444) — the
  pure, data-injected, never-throw, discriminated-result posture this WP's new
  `gauntletQualificationCheck.ts` mirrors. The two modules are siblings: the
  WP-444 module resolves a **pack** into a prefill; this WP's module checks a
  **draft composition** against the approved menu. They are kept separate because
  the qualification check applies to **any** draft (including a hand-built one
  whose mastermind hosts a gauntlet), not only a pack-sourced one.
- `docs/ai/REFERENCE/00.2-data-requirements.md §7` — the locked composition
  field names this WP consumes (`villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `mastermindId`); do not rename or abbreviate.
- `docs/ai/DECISIONS.md` — D-24199 (approved loadout menus + the server
  qualification rule), D-24187 (fixed-hero-pool division — the hero-pool
  constraint this WP explicitly does NOT guard, see Out of Scope), D-24131
  (both-sides-same-set gauntlet legs — the load-bearing premise for F2's
  no-false-negative soundness), D-10014 / D-24018 (set-qualified `setAbbr/slug`
  ext_ids). This WP reserves **D-24273**.

**Why now / split rationale.** A live product concern surfaced (2026-07-29): the
downloaded gauntlet pack (WP-440) is identity-only, and while WP-444's importer
prefills the approved villains/henchmen, those fields stay **editable** — and a
hand-built loadout has no guard at all. A visitor can therefore play a match with
a non-approved adversary composition and only discover it never counted toward
the gauntlet **after** the game, because qualification is enforced only at
aggregation (`qualifiesAsLegClear` / `matchesApprovedLoadout`, server-side) or,
for an uncalibrated `ScenarioKey`, rejected at submission (`par_not_published`).
This WP moves the feedback **before** play. It is a single-app, single-layer
change (`apps/registry-viewer` only) and runs the **standard two-session lane**:
though additive, it is a user-visible cards surface adding a new lib module +
resolution logic + builder UI (beyond the lightweight lane's
narrow-input-validation/UX-copy scope), and it is leaderboard-adjacent (the
lightweight lane excludes leaderboard surfaces; any ambiguity resolves against
eligibility). This matches WP-444's posture.

**Design note (advisory, not a gate).** The badge and the lock are UX guidance,
not enforcement. The builder cannot and must not adjudicate qualification — that
is the server's job at play time. The badge predicts qualification from the same
approved-menu data the server uses; the lock reduces accidental edits of a
pack-sourced composition. Neither blocks the visitor from building or exporting
any loadout they want (the "Unlock adversaries" escape hatch is deliberate).

## Scope (In)

- **New pure helper** `apps/registry-viewer/src/lib/gauntletQualificationCheck.ts`
  exporting:
  - `checkGauntletQualification(input)` — a **pure, data-injected** function
    taking the draft's `villainGroupIds` + `henchmanGroupIds` (set-qualified
    ext_ids), the draft's `playerCount`, and the resolved
    `GauntletLoadoutMenu | undefined` for the draft's mastermind. Returns a
    discriminated result:
    - `{ status: 'not-a-gauntlet' }` — the mastermind hosts no gauntlet menu
      (menu `undefined`), so there is no qualification claim to make (badge
      hidden).
    - `{ status: 'qualifies', variantIndex }` — some variant's
      `compositionsByPlayerCount[playerCount]` has a villain-group set **and**
      henchmen-group set **exactly equal** (order-insensitive) to the draft's.
    - `{ status: 'not-qualifying', approvedVariantCount }` — the mastermind has a
      menu (and an offered player count) but no variant matches; carries the
      count of approved variants for the message.
    - `{ status: 'unoffered-count' }` — the menu exists but offers no
      composition for the draft's `playerCount`.
    Comparison is **exact set equality on the full set-qualified ext_ids** (sort
    both sides, compare element-wise) — stricter and more precise than the
    server's `ScenarioKey` villain-*segment* (bare-slug) comparison, which is
    correct here because the draft and the menu both carry full ext_ids.
- **New tests** `apps/registry-viewer/src/lib/gauntletQualificationCheck.test.ts`
  (`node:test`) covering: menu `undefined` → `not-a-gauntlet`; a composition
  set-equal to variant 0 (including a **reordered** id list, proving
  order-insensitivity) → `qualifies` with `variantIndex 0`; a composition
  matching a non-zero variant → `qualifies` with that `variantIndex`; a
  composition with a wrong/extra/missing villain or henchmen group → not
  matching → `not-qualifying` with `approvedVariantCount`; a `playerCount` with
  no offered composition → `unoffered-count`; and a **non-mutation** assertion —
  the input `villainGroupIds` / `henchmanGroupIds` arrays are unchanged in
  contents and order after a call (proves the spread-copy sort, F1).
- **Builder wiring** `apps/registry-viewer/src/components/LoadoutBuilder.vue`
  (**modified**):
  - **Qualification badge.** A `computed` resolves the draft mastermind's menu
    via the already-imported `getGauntletLoadoutMenu` (split `mastermindId` on
    `/`), calls `checkGauntletQualification`, and renders a badge near the
    villain/henchmen fields: `qualifies` → a positive "✓ Qualifies … (variant
    N)" line; `not-qualifying` → a warning "✗ These villains/henchmen won't count
    toward the {mastermind} gauntlet (N approved configuration(s))"; `unoffered-count`
    → a neutral "this gauntlet isn't offered at {playerCount} players" note;
    `not-a-gauntlet` → **no badge**. The badge updates reactively as the visitor
    edits villains/henchmen or player count.
  - **Adversary lock for pack-sourced drafts.** A `ref` (e.g.
    `adversaryFieldsLocked`) is set **true** when `onPickGauntletLeg` succeeds
    (the existing WP-444 success path) and **false** on `resetDraft`-driven
    clears and on the explicit unlock. While locked: the villain/henchmen chips
    render **without** their remove (✕) controls and the add-slot affordance for
    those two fields is disabled, with a short "locked by gauntlet pack — heroes
    only" note and an **"Unlock adversaries"** button that sets the ref false
    (restoring free editing). Heroes, scheme, counts, and player count remain
    editable throughout.

## Out of Scope

- **No server / engine / persistence / migration change** — the badge and lock
  are client-side; the server-side qualification rule (`matchesApprovedLoadout`,
  WP-395) is unchanged and remains authoritative. This WP does not gate, block,
  or reject any submission.
- **No `packages/registry` change** — `getGauntletLoadoutMenu`,
  `GAUNTLET_LOADOUT_MENUS`, and the `GauntletLoadoutMenu` type are consumed
  as-is; no registry file is modified and no registry export is added.
- **No change to WP-444's `loadoutGauntletPackImport.ts` contract** — the new
  qualification helper lives in its **own** module; `parseGauntletPack`,
  `resolveGauntletLegLoadout`, and `listGauntletLegSchemeIds` are untouched.
- **No hero-pool guard (D-24187 fixed-hero-pool division).** The
  "same ≤ `heroCount + 2` heroes across all legs" constraint is a **cross-leg,
  server-adjudicated** property inferred from submitted wins; a single leg's hero
  choice is free. The builder edits one loadout at a time and cannot see a run's
  other legs, so it makes no hero-pool claim. Heroes stay free and empty-able.
- **No scheme-leg validity check** — the WP-444 leg picker already constrains a
  pack-sourced scheme to the set; the qualification badge is scoped to the
  adversary composition + player count (the actual footgun), not to whether a
  hand-picked scheme belongs to the mastermind's set.
- **No `?pack=` / URL deep link, no new importer, no gallery/preview change** —
  strictly a badge + lock over the existing draft and the WP-444 importer.
- **No blocking of export or match launch** — the builder never prevents building
  or exporting a non-qualifying loadout; the guard is advisory only.

## Files Expected to Change

- `apps/registry-viewer/src/lib/gauntletQualificationCheck.ts` — **new** — pure
  `checkGauntletQualification` + its discriminated result type.
- `apps/registry-viewer/src/lib/gauntletQualificationCheck.test.ts` — **new** —
  `node:test` unit tests (not-a-gauntlet, qualifies incl. reordered ids,
  non-zero variant, not-qualifying, unoffered-count).
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** —
  qualification-badge computed + render, and the pack-sourced adversary lock +
  "Unlock adversaries" escape hatch.

## Contract

> **Output contract for this session:**
> - Full file contents for every new or modified file (no diffs).
> - ESM only, Node v22+, human-style code per `00.6-code-style.md`.
> - App layer (`apps/registry-viewer`): reuse the **already-imported**
>   `getGauntletLoadoutMenu` + `GauntletLoadoutMenu` from
>   `@legendary-arena/registry/gauntletLoadouts` — **never** the registry root
>   barrel. Add no new registry import.
> - `checkGauntletQualification` is **pure, side-effect free, data-injected**
>   (the menu is passed in), fully unit-tested; the badge + lock DOM are covered
>   by the dev-server smoke + `vue-tsc`.
> - `checkGauntletQualification` **never throws** — it returns a discriminated
>   `{ status }` result.

**Locked values (do not re-derive):**

- **Qualification comparison:** exact **set equality** on the full set-qualified
  `setAbbr/slug` ext_ids of both `villainGroupIds` **and** `henchmanGroupIds`,
  order-insensitive (**sort a spread copy — `[...ids].sort()` — never the input
  array**; the draft's `villainGroupIds` is a live reactive `string[]`, and an
  in-place sort would silently reorder the visitor's on-screen chips). Both must
  match for `qualifies`. This is stricter than the server's bare-slug
  villain-segment comparison and is correct client-side (draft + menu both hold
  full ext_ids).
- **No false-negative risk (soundness):** the stricter full-ext_id villain check
  can never say "✗ won't count" for a loadout the set-blind server would accept,
  because D-24131 (both-sides-same-set legs) plus the server's **exact
  set-qualified `henchman_key`** comparison already collapse the only divergent
  case (same bare slug, different set — e.g. `co2e/hydra` vs `core/hydra`). A
  client `qualifies` therefore implies a server match on both dimensions.
- **Player-count boundary:** `playerCount` is a plain envelope `number`;
  `compositionsByPlayerCount` is keyed by the `SupportedPlayerCount` closed set.
  An out-of-range / absent lookup is narrowed explicitly and mapped to
  `unoffered-count` (never an unchecked cast).
- **Status set (closed):** `not-a-gauntlet` (menu undefined) · `unoffered-count`
  (no composition for the draft player count) · `qualifies` (with the matching
  `variantIndex`) · `not-qualifying` (with `approvedVariantCount`). No free-form
  status strings.
- **Variant identity:** the `variantIndex` reported is the variant's
  `variantIndex` **field**, not its array position.
- **Lock trigger:** `adversaryFieldsLocked` becomes true only via the existing
  `onPickGauntletLeg` success path (a pack-resolved leg); it is cleared by
  `resetDraft` and by the explicit "Unlock adversaries" control. A hand-built
  draft is **never** auto-locked (the badge still shows for it).
- **Advisory-only:** neither the badge nor the lock blocks building, editing, or
  exporting any loadout. The server remains the sole qualification authority.
- **Id space:** `villainGroupIds` / `henchmanGroupIds` / `mastermindId` are all
  set-qualified `setAbbr/slug` ext_ids (D-10014 / D-24018).

## Acceptance Criteria

- [ ] `apps/registry-viewer/src/lib/gauntletQualificationCheck.ts` exports
      `checkGauntletQualification` returning the discriminated `{ status }` result
      described in Scope.
- [ ] `checkGauntletQualification` with `menu === undefined` returns
      `{ status: 'not-a-gauntlet' }`.
- [ ] Given the `core/magneto` menu and a `villainGroupIds` + `henchmanGroupIds`
      set-equal to variant 0's composition for the given `playerCount` — **even
      when the input arrays are in a different order** — it returns
      `{ status: 'qualifies', variantIndex: 0 }`.
- [ ] A composition matching a non-zero `variantIndex` returns
      `{ status: 'qualifies', variantIndex }` with that index.
- [ ] A composition with a wrong, extra, or missing villain or henchmen group
      (not set-equal to any variant) returns
      `{ status: 'not-qualifying', approvedVariantCount }` with the menu's variant
      count.
- [ ] A `playerCount` with no `compositionsByPlayerCount[playerCount]` in any
      variant returns `{ status: 'unoffered-count' }`.
- [ ] After any `checkGauntletQualification` call, the input `villainGroupIds`
      and `henchmanGroupIds` arrays are unchanged in contents and order (the
      comparison sorts a spread copy, never the input — F1).
- [ ] `LoadoutBuilder.vue` renders a qualification badge near the
      villain/henchmen fields: positive on `qualifies` (naming the variant),
      warning on `not-qualifying`, neutral on `unoffered-count`, and **absent** on
      `not-a-gauntlet`; it updates reactively when villains/henchmen or player
      count change.
- [ ] After a successful gauntlet-pack leg load (`onPickGauntletLeg`), the
      villain/henchmen fields render locked (no remove ✕, add-slot disabled) with
      an "Unlock adversaries" control; clicking it restores free editing; heroes
      remain editable throughout; `resetDraft` clears the lock.
- [ ] No new registry import is added; `getGauntletLoadoutMenu` /
      `GauntletLoadoutMenu` are reused from `@legendary-arena/registry/
      gauntletLoadouts`; no `game-engine` / `server` / `pg` / `boardgame.io`
      import appears; no `fetch` / network call is introduced.
- [ ] `pnpm --filter registry-viewer test`, `pnpm --filter registry-viewer
      typecheck` (`vue-tsc --noEmit`), and `pnpm --filter registry-viewer build`
      all exit 0; `pnpm -r build` exits 0.
- [ ] No file outside the `Files Expected to Change` list is modified.

## Verification Steps

```bash
pnpm -r build
# Expected: whole-repo build green; registry dist present so registry-viewer's
# value import of /gauntletLoadouts resolves.

pnpm --filter registry-viewer test
# Expected: all registry-viewer tests pass, including
# gauntletQualificationCheck.test.ts (not-a-gauntlet, qualifies incl. reordered,
# non-zero variant, not-qualifying, unoffered-count).

pnpm --filter registry-viewer typecheck
# Expected: vue-tsc --noEmit exits 0.

pnpm --filter registry-viewer build
# Expected: vite build exits 0.

# Dev-server smoke (pure logic is unit-tested; the badge + lock DOM are
# smoke-verified): run the SPA, open the Loadout Builder. (1) Load the live
# core/magneto .gauntlet.json via "Load Gauntlet Pack", pick a leg, and confirm
# the villain/henchmen fields are locked with an "Unlock adversaries" control and
# the badge reads "✓ Qualifies … (variant 0)". (2) Click "Unlock adversaries",
# remove one villain group, and confirm the badge flips to "✗ … won't count".
# (3) Click "Unlock adversaries" is gone; re-add the removed group and confirm
# the badge returns to "✓ Qualifies". Confirm read_network_requests shows ZERO
# API calls throughout.
```

## Vision Alignment

**Vision clauses touched:** §10a (Registry Viewer / cards.legendary-arena.com
public surface — this WP adds a build-time qualification badge + a field lock)
and §20–26 (Scoring, PAR & leaderboards — the gauntlet is a competitive surface;
the badge predicts whether a loadout will count as a gauntlet leg). No identity /
monetization / RNG / determinism / persistence surface is touched.

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.* The
guard is advisory and client-side; it scores, ranks, credits, gates, and
persists nothing, and the server remains the sole authority for legs, approved
compositions, and adjudication (`matchesApprovedLoadout`, WP-395). The badge
reads the same approved-menu data the server uses, resolved from the live
registry, so it always tracks current rules — no drift.

**Non-Goal proximity check:** No proximity to NG-1..7. The guard is free,
account-less, carries no paid surface, no pay-to-win lever, and no
cosmetic/monetization affordance — it only tells a visitor, before play, whether
their loadout will count toward a gauntlet.

## Definition of Done

This packet is complete when ALL of the following are true:
- [ ] All Acceptance Criteria pass.
- [ ] `pnpm --filter registry-viewer test`, `typecheck`, and `build` exit 0;
      `pnpm -r build` exits 0.
- [ ] **D-24026 live-verification (operator-pending on deploy):** on the deployed
      `cards.legendary-arena.com` builder, a pack-sourced `core/magneto` leg shows
      the locked adversary fields + the "✓ Qualifies (variant 0)" badge; unlocking
      and removing a villain group flips the badge to the "✗ won't count" warning;
      `read_network_requests` shows zero API calls.
- [ ] `docs/ai/STATUS.md` updated (user-visible: names the gauntlet qualification
      badge + adversary lock on the cards builder).
- [ ] `docs/ai/DECISIONS.md` **D-24273** flipped from "Drafted" to "Active
      (post-execution)".
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph moved `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-488 status → `Done`.
- [ ] No files outside the `Files Expected to Change` list were modified.

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE**

- **Authority chain read:** CLAUDE.md → ARCHITECTURE.md §Layer Boundary (App /
  registry-viewer import rules) → `.claude/rules/architecture.md` Import Rules +
  §Persistence Boundary → `.claude/rules/code-style.md` → this WP → EC-488. No
  conflict: `apps/registry-viewer` already runtime-imports `registry` through
  browser-safe subpaths and already imports `getGauntletLoadoutMenu`; this WP
  adds no new import.
- **Dependencies verified on `main` @ `28b3b61f`:** WP-444 is **Done**
  (WORK_INDEX row 2026-07-28) — `loadoutGauntletPackImport.ts`, the "Load
  Gauntlet Pack" importer, `onPickGauntletLeg`, and `gauntletImportSuccessAt` are
  present; WP-395 is **Done** — `getGauntletLoadoutMenu` / `GAUNTLET_LOADOUT_MENUS`
  and the variant shape (`variantIndex` + `compositionsByPlayerCount`) are
  present under `./gauntletLoadouts`; `useLoadoutDraft.ts` exposes the setters and
  `draft.composition.{villainGroupIds,henchmanGroupIds,mastermindId}`.
- **Scope lock:** exactly three files, all under `apps/registry-viewer` (2 new, 1
  modified) + governance ledgers. Single layer (App), single app. No contract
  file (`.types.ts`/`.validate.ts`/`.gating.ts`) touched; no
  registry/server/persistence/migration surface.
- **Validation-tightening check (Empirical Scaffold, `01.4`):** this WP adds a
  brand-new pure helper with its own new tests and an advisory UI; it **tightens
  no existing input path** and rejects no previously-accepted input (no parser is
  narrowed; the builder still accepts and exports any loadout). The
  scaffold-first empirical gate does not trigger. (Execution still runs the
  affected suite green, per DoD.)
- **Ambiguities resolved (recorded in Contract + EC):** (1) **helper home** — a
  **new sibling module** `gauntletQualificationCheck.ts`, not an addition to
  WP-444's `loadoutGauntletPackImport.ts`, because the check applies to any draft
  (including hand-built), not only a pack. (2) **comparison basis** — **exact set
  equality on full set-qualified ext_ids**, not the server's bare-slug
  villain-segment projection, because the draft + menu both hold full ext_ids and
  a stricter client check is correct. (3) **lock is opt-out, not hard** — an
  explicit "Unlock adversaries" escape hatch preserves the visitor's freedom to
  build a non-gauntlet loadout, turning a silent mistake into a deliberate choice
  rather than a prohibition. (4) **hero-pool excluded** — the D-24187 fixed-pool
  constraint is cross-leg and server-adjudicated, out of a single-loadout
  builder's scope.

### Copilot Check (`01.7`) — verdict: **RISK (concerns addressed inline; scope-neutral)**

An independent copilot audit returned **RISK/HOLD** with four scope-neutral
findings — all wording / one added test, no allowlist or contract change (so no
pre-flight re-run required). Each is now folded into the Contract Locked Values
and the EC before this verdict was recorded:

- **F1 (hidden mutation).** The comparison must **sort a spread copy**
  (`[...ids].sort()`), never the live reactive draft array — an in-place sort
  would reorder the visitor's on-screen chips. → Locked in Contract + EC Locked
  Values; a **non-mutation test** (input arrays unchanged after a call) is added
  to the test plan.
- **F2 (implicit soundness).** The "no false-negative" property of the stricter
  full-ext_id villain check rests on D-24131 same-set + exact `henchman_key`. →
  Now stated explicitly in Contract Locked Values and required as a `// why:`.
- **F3 (lock-clear wiring).** `onPickGauntletLeg` itself calls `resetDraft()`
  then sets the lock true, so the clear must live in the **user reset-button
  handler** (and the explicit unlock), not literally inside every `resetDraft`
  call. → Clarified in EC Locked Values.
- **F4 (player-count boundary).** Out-of-range `playerCount` is narrowed
  explicitly → `unoffered-count`, not an unchecked cast. → Locked in Contract.

With F1–F4 folded in, the remaining audit lens is PASS:
- **Separation of concerns / layer boundaries — PASS.** App layer only; reuses an
  already-permitted registry subpath import; no engine/server/pg/boardgame.io
  reach; the server stays the sole adjudication authority (the guard is
  advisory).
- **Determinism — PASS.** Pure, data-injected comparison; no RNG, no time, no I/O;
  no `G`/`ctx`.
- **Immutability / mutation — PASS.** The helper returns fresh `{ status }`
  objects and mutates nothing; the draft is edited only through existing public
  setters; the lock is a view-state `ref`.
- **Type safety / contract integrity — PASS.** Consumes the registry's typed
  `GauntletLoadoutMenu` / `SupportedPlayerCount` closed sets; ids are the
  set-qualified `setAbbr/slug` space (D-10014 / D-24018).
- **Stringly-typed outcomes — PASS.** Discriminated result with a closed status
  set (`not-a-gauntlet` | `unoffered-count` | `qualifies` | `not-qualifying`).
- **Persistence / serialization — PASS.** No persistence; no snapshot; in-memory
  editor state only.
- **Testing / invariants — PASS.** Order-insensitivity, both qualify paths, the
  negative path, and the unoffered-count path are unit-tested against injected
  data (no live registry).
- **Scope / governance — PASS.** Three-file, single-app additive scope with
  explicit Out-of-Scope fences (no server change, no registry edit, no WP-444
  contract change, no hero-pool guard, no scheme-leg check, no export/launch
  block).
- **Error handling — PASS.** `checkGauntletQualification` never throws; the badge
  renders a friendly line for every status; the lock has an explicit escape.
- **Truth/authority integrity — PASS.** The WP states plainly that the badge is a
  **prediction** mirroring server data, not an adjudication — no risk of the
  client being mistaken for the authority.
- **Documentation / intent — PASS.** JSDoc on the export; `// why:` on the
  exact-set-equality choice (vs the server bare-slug segment), the lock-trigger
  source, and the advisory-only posture.

No RISK or BLOCK findings.

## Lint Gate Self-Review (`00.3`, all 21 sections)

- **§1 Structure** — PASS. All required sections present in order.
- **§2 Non-Negotiable Constraints** — PASS. ESM, Node v22+, reuse of the
  browser-safe registry subpath, pure data-injected helper, human-style code,
  discriminated result — all stated in Contract.
- **§3 Prerequisites (`## Assumes`)** — PASS. Each assumption cites its source on
  `main` @ `28b3b61f`; the WP-444 + WP-395 hard-deps are verified Done.
- **§4 Context References** — PASS. Specific docs/sections + files listed,
  including the server rule this WP mirrors but does not relocate.
- **§5 Output Completeness (`## Files Expected to Change`)** — PASS. Three files
  enumerated (new/modified) with one line each; matches the EC allowlist.
- **§6 Naming Consistency** — PASS. `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `mastermindId`, `playerCount`, `variantIndex`, `setAbbr`,
  `mastermindSlug` all match 00.2 / the WP-395 + WP-444 contracts; no
  abbreviations invented.
- **§7 Dependency Discipline** — PASS. No new npm dependency; registry is an
  existing runtime dependency. Hard-deps WP-444 + WP-395 are **Done** on `main`.
- **§8 Architectural Boundaries** — PASS. App layer; registry value-import via a
  browser-safe subpath already in use; no engine/server/pg/boardgame.io; no `G`,
  no snapshot, no persistence.
- **§9 Windows Compatibility** — PASS. No shell scripts authored; `pnpm`
  verification commands only.
- **§10 Environment Variable Hygiene** — PASS. No new env access.
- **§11 Authentication Clarity** — N/A. No auth surface; the builder is a public
  zero-auth cards page and the guard is a client-side, credential-free advisory.
- **§12 Test Quality** — PASS. `node:test`, `.test.ts`, no `boardgame.io/testing`,
  no live server/DB; non-vacuous set-equality assertions incl. a reordered-input
  case that would pass a naive array-equality bug.
- **§13 Commands & Verification** — PASS. Exact `pnpm` commands + a scripted
  dev-server smoke with expected badge transitions.
- **§14 Acceptance Criteria Quality** — PASS. Binary, observable checks naming
  real symbols, statuses, and the exact badge/lock behavior.
- **§15 Definition of Done** — PASS, incl. §15.1: `User-Visible Surface` is the
  named cards surface, so the DoD carries the **D-24026 live-verification** item
  (operator-pending on the Pages deploy), plus the `typecheck` gate
  (registry-viewer app-package requirement).
- **§16 Code Style** — PASS. Small pure function, discriminated result (no nested
  ternaries / branching `.reduce()`), JSDoc, `// why:` on the comparison-basis /
  lock-trigger / advisory-only choices, named export, human-style code.
- **§17 Vision Alignment** — PASS. `## Vision Alignment` present; §10a + §20–26
  cited; "No conflict"; NG proximity checked (none).
- **§18 Prose-vs-Grep Discipline** — N/A. This WP defines no count-bounded grep
  gate over a literal token.
- **§19 Bridge-vs-HEAD Staleness** — N/A. No bridge/adapter reconciliation; the
  baseline SHA `28b3b61f` is recorded in `## Assumes`.
- **§20 Funding Surface Gate** — N/A. No funding surface: no global-nav,
  registry-viewer funding affordance, or donate/tournament-funding copy — the WP
  adds a qualification badge and an adversary-field lock.
- **§21 API Catalog Update** — N/A. App-layer only: adds no `apps/server` HTTP
  endpoint and no `apps/server/src/**` `Library-only` function; the guard is
  client-side with no server call.

All 21 sections resolved (PASS or justified N/A). Lint gate satisfied.
