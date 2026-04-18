Two plan-level SPEC commits landed on branch
`wp-068-preferences-foundation`. HEAD is `b23057e`. Key context for
executing WP-068 (Preferences Foundation — Schema, Store, Section
Registry):

- **Branch:** `wp-068-preferences-foundation` (already created and
  checked out; branched from `main` at `1d709e5`).
- **Base commits to read for authority** (in chronological order on
  the branch):
  - `32c8012` — `SPEC: establish WP-068 Preferences Foundation
    (Option A, no UI)`. Lands the plan, the decision, the packet, and
    the top-level docs index row.
  - `b23057e` — `SPEC: register WP-068 in WORK_INDEX`. Adds the WP-068
    row to `WORK_INDEX.md` at line 904 (between WP-067 and the Phase 7
    divider). **WP-068 is already listed in WORK_INDEX — the execution
    session only needs to flip `[ ]` → `[x]` and append a completion
    timestamp, not add a new row.**
- **Governance artifacts WP-068 must conform to** (all live on this
  branch at HEAD):
  1. `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md` — full plan
  2. `docs/ai/work-packets/WP-068-preferences-foundation.md` — the packet
  3. `docs/ai/DECISIONS.md` D-1414 — Option A lock
  4. `docs/00-INDEX.md` — row 14 added for the plan doc
  5. `docs/ai/work-packets/WORK_INDEX.md` — WP-068 row at line 904
- **Primary authority for execution:** the WP-068 packet
  (`docs/ai/work-packets/WP-068-preferences-foundation.md`). Every
  "Acceptance Criteria" and "Verification Steps" item is binary. No
  partial credit. Read the packet's §Context (Read First) before writing
  a single line.
- **Plan §2.3 schema defaults are load-bearing.** Every default value in
  the three shared-tier schemas must match `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md`
  §2.3 character-for-character. The "defaults-match-today" property
  (plan §5.7) requires that a fresh visitor with no stored preferences
  sees bit-identical UI to what ships today. Deviating silently defeats
  the entire packet.
- **Option A path is LOCKED by D-1414.** All files live under
  `apps/registry-viewer/src/prefs/`. Do NOT create
  `packages/ui-preferences/`. The packet includes an explicit
  `Test-Path packages\ui-preferences` verification that must return
  `False`.
- **No user-visible UI changes in this packet.** Gear icon, drawer,
  control primitives, CSS migration — all deferred to WP-069 through
  WP-077. WP-068 is pure foundation: schema, store, registry,
  composable, bootstrap stub, tests.

---

## Repo Test Baseline (Must Not Regress)

Pre-WP-068 baseline (from session-context-wp067, verified against
`main` at `1d709e5`):

- **Total: 429 passing / 0 failing**
  - registry: 3
  - game-engine: 396 (98 suites)
  - vue-sfc-loader: 11
  - server: 6
  - arena-client: 13
  - **registry-viewer: 0 — WP-068 is the first packet adding viewer
    tests.**

After WP-068, the `registry-viewer` line should read a positive
integer (exact count depends on final test granularity; the packet
spec lists four test files with multiple assertions each, so expect
roughly 10-18 new test cases). No other count may change.

Verification command:

```pwsh
pnpm -r test
# Expected: all counts above unchanged except registry-viewer > 0
```

---

## Branch State at Session Start

```
Branch:       wp-068-preferences-foundation
Head commit:  b23057e SPEC: register WP-068 in WORK_INDEX
              32c8012 SPEC: establish WP-068 Preferences Foundation (Option A, no UI)
Parent:       1d709e5 EC-068: WP-067 UIState progress counters ...  [on main]
```

**Uncommitted files in working tree (unrelated to WP-068 — do not
touch):**

- `.claude/settings.local.json` (local tool config)
- `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` (unrelated edit)
- `docs/ai/execution-checklists/EC_INDEX.md` (unrelated edit)
- `docs/ai/session-context/session-context-wp062.md` (WP-062 work)
- `docs/ai/work-packets/WP-062-arena-hud-scoreboard.md` (WP-062 work)
- Several untracked files: Monrovia surveys, `MOVE_LOG_FORMAT.md`,
  `EC-069` checklist, several `invocations/` and `session-context/`
  files, license letters, one-pager

**Uncommitted file that IS this packet's concern:**

- `docs/ai/session-context/session-context-wp068.md` (this file) — not
  yet committed. Stage and include it with the first execution commit
  (see step 7 below for the commit-prefix decision — **not** `EC-068:`,
  that slot is taken by WP-067's execution), alongside the code and
  test files. Do not commit it in its own separate SPEC commit; it is
  an execution-adjacent artifact, not governance.

These files are context for other in-flight work on this developer's
machine. WP-068 execution must not stage or modify any of them. Use
selective staging (`git add <specific-files>`) for every commit.

---

## Scope Summary (Full Detail in the Packet)

WP-068 creates **15 files** under `apps/registry-viewer/`:

- **Modified (2):** `package.json` (add `pinia ^2.1.7`), `src/main.ts`
  (three-line `createApp`/`use`/`mount` + side-effect import of
  `prefs/registerSections`)
- **New source (9):**
  - `src/prefs/shared/schema/{base,appearance,accessibility,advancedBase}.schema.ts`
  - `src/prefs/shared/registry/sectionRegistry.ts`
  - `src/prefs/shared/store/{persistence,createPreferencesStore}.ts`
  - `src/prefs/shared/composables/usePreferences.ts`
  - `src/prefs/registerSections.ts`
- **New tests (4):**
  - `src/prefs/shared/schema/base.schema.test.ts`
  - `src/prefs/shared/schema/_schema-purity.test.ts`
  - `src/prefs/shared/registry/sectionRegistry.test.ts`
  - `src/prefs/shared/store/createPreferencesStore.test.ts`

No other files may be touched (`git diff --name-only` at the end must
list exactly these 15 plus `pnpm-lock.yaml`).

---

## Locked Values (Packet §Non-Negotiable Constraints — DO NOT re-derive)

- `PREFERENCES_SCHEMA_VERSION = 2`
- Storage key: `"legendary-arena.preferences"`
- Backup key: `"legendary-arena.preferences.backup"`
- devLog category: `"prefs"`
- Shared-tier section ids: `"appearance"`, `"accessibility"`,
  `"advancedBase"`
- Shared-tier schema defaults (verbatim from plan §2.3):
  - **AppearancePrefsSchema**: `themeMode: "dark"`, `accentColor:
    "#7070e0"`, `fontScale: 1.0`, `fontFamily: "system"`
  - **AccessibilityPrefsSchema**: `reduceMotion: "auto"`,
    `smoothScroll: true`, `focusRingBold: false`, `glossaryShortcut:
    "Mod+K"`, `escapeClosesLightboxFirst: true`,
    `showFloatingGlossaryFab: "auto"`
  - **AdvancedBasePrefsSchema**: `verboseDevLog: false`

---

## Key Architectural Patterns In Effect

- **Layer boundary (viewer).** `apps/registry-viewer/` may import `vue`,
  `pinia`, `zod`, and other client-safe packages. It must NOT import
  from `packages/game-engine`, `packages/preplan` (does not exist),
  `apps/server`, or `pg`. See `apps/registry-viewer/CLAUDE.md` and
  `docs/ai/ARCHITECTURE.md §Layer Boundary`.
- **Schema purity.** `src/prefs/shared/schema/*.schema.ts` files must
  NOT import `vue`, reference `document`, `window`, or `@vue/`. The
  packet's `_schema-purity.test.ts` enforces this. Purpose: guard the
  eventual Option-A → Option-B hoist. Any Vue import in the schema
  subtree would block the later file-move to `packages/ui-preferences/`.
- **Corruption safety.** Every `localStorage` access wraps a try/catch
  with a `// why:` comment explaining the degradation path (private
  mode, quota exceeded, corrupt JSON). No unhandled throw may reach
  the viewer's main loop.
- **Section registry is immutable after bootstrap.** `registerSection()`
  throws on duplicate id with a full-sentence error. Silent overwrite
  would let a second registration win invisibly, which is catastrophic
  for storage migrations. A test must guard this behavior.
- **Zero user-visible change.** A visual smoke (`pnpm --filter
  registry-viewer dev` + screenshot compare against the pre-packet
  baseline) is a Definition-of-Done item. If any pixel differs, STOP
  and investigate before declaring done.
- **ESM-only, `.test.ts` only.** Per `docs/ai/REFERENCE/00.6-code-style.md`
  Rule 13. Registry-viewer is already ESM; no `.mjs` test files.
- **Vue SFC test loader (WP-065) already in place.** If any test needs
  to import a `.vue` file, the loader at `vue-sfc-loader` is available.
  WP-068 tests target pure `.ts` (schemas, registry, store) so the
  loader is unlikely to be exercised by this packet.

---

## Relevant DECISIONS.md Entries

- **D-1414** — Preferences Panel: Option A delivery path. Locks this
  packet's file-layout decision. `packages/ui-preferences/` must not be
  created.

No other decisions are load-bearing for WP-068. The only reason to
touch `DECISIONS.md` during execution is if a new decision surfaces
that isn't already covered — none is expected. Changes to
`DECISIONS.md` are NOT listed in the packet's "Files Expected to
Change" allowlist; if a new decision is genuinely needed, STOP and
land it in a separate SPEC: commit before continuing execution.

---

## Relationship to WP-066 (Execution Ordering Note)

**WP-066 (Registry Viewer: Card Image-to-Data Toggle) was drafted
before WP-068 and is listed in WORK_INDEX.md at line 847 as `[ ] Not
yet reviewed`. It has NOT been executed.** The 2026-04-18 preferences
planning session explicitly recommended executing **WP-068 before
WP-066**, and rescoping WP-066 to consume the new preferences store
rather than inventing its own persistence path. Do not flip that order
without a new decision entry.

**Why the order matters:**

WP-066 as currently specced persists its `cardViewMode` state via
direct `localStorage.setItem("cardViewMode", ...)` with its own ad-hoc
key. If it executes first, the viewer ends up with two parallel
persistence systems:

- `legendary-arena.preferences` (the WP-068 envelope, with version +
  Zod validation + corruption backup + export/import)
- `cardViewMode` (ad-hoc, unversioned, un-backed-up, no reset path)

That split is avoidable. `cardViewMode` is conceptually just another
Display preference, sitting next to `cardLayout: "grid" | "list"`
(already in `DisplayPrefsSchema` per plan §2.3), `tileSize`, `density`,
etc. It belongs in the same store.

**What WP-068 does NOT need to do:**

- WP-068 does NOT add any `cardViewMode` field, `ViewModeSchema`, or
  anything WP-066-shaped. WP-068 is purely the foundation (shared-tier
  sections only — Appearance, Accessibility, AdvancedBase). Do not
  expand scope to pre-wire WP-066's schema; that belongs to WP-066's
  own rescope amendment.
- WP-068 does NOT add a `DisplayPrefsSchema`. The Display section
  schema lands in WP-071 per the plan. WP-066 (once rescoped) will
  either consume WP-071's schema or add its own minimal
  `ViewModeSchema` ahead of WP-071, depending on how the rescope
  amendment is written.

**What the WP-066 rescope will need (for a future session — not this
one):**

When WP-066 is reviewed and executed after WP-068 lands, its spec
should be amended to:

1. Replace ad-hoc `localStorage.setItem("cardViewMode", ...)` with
   `usePreferences()` reads + writes.
2. Either (a) add a tiny app-specific `ViewModeSchema` registered via
   `registerSection("viewMode", ViewModeSchema, null)` in
   `src/prefs/registerSections.ts`, OR (b) defer the toggle until
   WP-071 (Display section) and fold `cardViewMode` into
   `DisplayPrefsSchema`. Option (a) is lighter and keeps WP-066
   shippable independently; option (b) is more architecturally
   coherent but couples WP-066's ship date to WP-071.
3. Keep WP-066's new components (`ViewModeToggle.vue`,
   `CardDataDisplay.vue`) exactly as originally specced. Only the
   persistence + state-management layer changes.

This rescope decision is NOT in scope for WP-068 execution and should
not be made unilaterally during the WP-068 session. It belongs to a
separate WP-066 pre-flight / lint-gate pass.

**Potential conflict flag (for situational awareness, not a blocker):**

Both WP-066 and WP-069 (the next preferences packet — gear icon +
drawer shell) modify `App.vue`. If WP-066 ships between WP-068 and
WP-069, WP-069's `App.vue` edits will need to merge with WP-066's
`viewMode` state. This is a small nuisance, not a blocker, and another
reason to execute WP-068 → (rescope WP-066) → WP-069 in that order.

---

## Files WP-068 Will Need to Read Before Coding

In the packet's declared order (§Context (Read First)):

1. `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md` §2.1, §2.3, §2.4,
   §3.3, §5.7 — authoritative design. §2.3 defaults are load-bearing.
2. `docs/ai/DECISIONS.md` §D-1414 — Option A path lock.
3. `apps/registry-viewer/CLAUDE.md` — layer rules.
4. `apps/registry-viewer/src/main.ts` — entry point (minimal
   modification only).
5. `apps/registry-viewer/src/App.vue` — lines 1-50 only, to confirm the
   existing composable pattern. **This file must NOT be modified in
   this packet.**
6. `apps/registry-viewer/package.json` — confirm current `zod` and `vue`
   versions; confirm `pinia` is not already present.
7. `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)`.
8. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4, 6, 9, 11, 13, 14.

Do NOT read or modify anything outside the packet's §Files Expected to
Change allowlist.

---

## Steps Completed for the Plan

0. `session-context-wp067.md` last written; WP-067 executed on `main`
   and committed as `1d709e5`.
1. Registry viewer source audit (this session) — produced
   `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md` v1.
2. Shared-vs-per-app preferences review — added plan §2.8 (tier table)
   and WP-11 (cross-app sync).
3. Refinement pass — added §0.1 how-to-use, §2.1 Option A vs B choice,
   §2.3 defaults-match-today calibration, "Generated by: Claude
   (refined by Grok)" byline.
4. Decision log — `DECISIONS.md` D-1414 added: Option A delivery path
   locked, Option B deferred until `apps/game-ui/` is scoped.
5. WP renumber — plan's internal WP-01…WP-11 → WP-068…WP-078 to match
   the project's 3-digit convention. Verified no stray 2-digit
   references remain.
6. Packet authoring — `docs/ai/work-packets/WP-068-preferences-foundation.md`
   filled from `PACKET-TEMPLATE.md`, adapted for Client UI layer.
7. Index update — `docs/00-INDEX.md` row 14 added for the plan doc.
8. Branch + first SPEC commit — `wp-068-preferences-foundation` created
   from `main`; commit `32c8012` landed the four plan-level artifacts
   (plan, D-1414, WP-068 packet, 00-INDEX row).
9. This session-context file written (staged with the execution commit,
   not separately).
10. WORK_INDEX row — `WORK_INDEX.md` gained an unchecked WP-068 row at
    line 904 between WP-067 and the Phase 7 divider, with full
    dependency / governance / scope / unblocks metadata.
11. Second SPEC commit — `b23057e SPEC: register WP-068 in WORK_INDEX`.
    Branch HEAD is now `b23057e`.
12. WP-066 / WP-068 execution-ordering analysis — concluded WP-068 runs
    BEFORE WP-066; WP-066 will be rescoped at its own pre-flight to
    consume the preferences store instead of inventing an ad-hoc
    `cardViewMode` localStorage key. See the "Relationship to WP-066"
    section above for the full rationale and rescope-amendment shape.
    This analysis is captured in the session-context file only — no
    separate DECISIONS.md entry because it is an ordering
    recommendation, not a binding architectural decision. If the
    rescope proves contentious at WP-066 pre-flight, a new D-NNNN
    entry may be added then.

---

## Execution Direction

In the new session:

1. **Load this file** and confirm the branch (`git branch --show-current`
   must return `wp-068-preferences-foundation`).
2. **Read the packet** `docs/ai/work-packets/WP-068-preferences-foundation.md`
   end-to-end before writing any code.
3. **Read the plan §2.3** and copy the defaults verbatim. Do NOT
   re-derive them from memory.
4. **Run the pre-flight verification** to confirm the starting state:
   - `Test-Path packages\ui-preferences` → `False`
   - `Test-Path apps\registry-viewer\src\prefs` → `False` (directory
     doesn't exist yet)
   - `pnpm -r test` → current baseline (registry-viewer: 0)
5. **Execute in the packet's §Scope (In) order**: A → B → C → D → E →
   F → G → H. Each sub-task has its own acceptance criteria bullet.
6. **Run the §Verification Steps** before claiming any Acceptance
   Criteria item. `Select-String` + `git diff --name-only` +
   `pnpm --filter registry-viewer test` + visual smoke.
7. **Decide the commit prefix for the execution commit.** `SPEC:` is not
   correct — this is execution, not spec. **`EC-068:` is NOT available**
   — that slot is taken by WP-067's execution commit (`1d709e5`). The
   next free EC slots as of 2026-04-18 are EC-069 (reserved by
   `EC-069-arena-hud-scoreboard.checklist.md` in the untracked files) and
   **EC-070** (first truly free slot). Two options:
   - **Option A — draft a new EC** (e.g., `EC-070-preferences-foundation.checklist.md`)
     before execution, then commit with prefix `EC-070:`. Adds overhead but
     matches the project's EC-backed execution pattern.
   - **Option B — execute without a dedicated EC** and use prefix
     `WP-068:` on the commit. Matches the more lightweight pattern for
     registry-viewer-only work (WP-066 has an EC-066 file but there's no
     strict 1:1 rule). Cheaper but gives up the EC audit surface.

   Verify EC availability with `ls docs/ai/execution-checklists/` before
   committing. Follow
   `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md` either way.
   The two SPEC commits already on the branch (`32c8012` and `b23057e`)
   cover governance; the execution commit is the next one on top.
8. **Update `docs/ai/STATUS.md`** to record that the viewer now has a
   functional preferences store with three shared-tier sections
   registered but no user-visible UI yet.
9. **Flip the WP-068 row in `docs/ai/work-packets/WORK_INDEX.md` from
   `[ ]` to `[x]`** at line 904 and append a completion note (match the
   WP-067 format: `✅ Reviewed (...) — Completed YYYY-MM-DD under EC-???
   (see [session-wp068-....md](../invocations/...))`). The row itself
   already exists — this is a checkbox flip + completion note, not a
   new insertion. Allowed outside the Files Expected to Change allowlist;
   standard cross-packet bookkeeping.
10. **Write a post-mortem session-context** (`session-context-wp068.md`
    replacement or `session-context-wp069.md` for the next packet)
    recording the final test count, any deviations from the plan, and
    flagging WP-069's readiness.

**Do NOT in this session:**
- Stage, modify, or commit any of the unrelated in-flight files
  listed above.
- Create `packages/ui-preferences/`.
- Add any UI to `App.vue` or any of the `src/components/*.vue` files.
- Register any app-specific section (Display / Filters / DataSource /
  Advanced) — those come in WP-071 / WP-072 / WP-074 / WP-077.

If any acceptance criterion cannot be satisfied, STOP and flag it.
Silent partial completion is not acceptable.
