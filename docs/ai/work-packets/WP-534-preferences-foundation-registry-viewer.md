# WP-534 — Preferences Foundation for the Registry Viewer (Schema, Store, Section Registry)

**Status:** Draft 2026-08-12
**Layer:** Client UI (Vue 3 SPA — `apps/registry-viewer/`)
**Baseline:** drafted off `origin/main` @ `daceea7a` (2026-08-12)
**EC:** EC-569 · **Reserves:** D-24344 (Option-A path re-lock) · **Hard-dep:** none
**Lane:** standard two-session (new client subsystem + Zod-schema contract files)

## Non-Negotiable Constraints

- Code must follow `docs/ai/REFERENCE/00.6-code-style.md` (human-style, explicit, junior-readable).
- The executor produces **complete files**, never diffs or `// … unchanged` snippets.
- **Option-A path (D-24344):** everything lives under `apps/registry-viewer/src/prefs/`. **No new
  workspace package** (`packages/ui-preferences/` MUST NOT be created).
- **No user-visible UI change.** No gear icon, no drawer, no CSS, no behavior change. The rendered
  viewer output must be bit-identical to pre-WP production. (Display / Filters / DataSource /
  Advanced *sections* and the settings drawer are later WPs, not this one.)

## 1. Goal

`apps/registry-viewer/` gains the invisible preferences **foundation** — Pinia installed, a typed
Zod preferences schema for the three shared-tier sections (Appearance / Accessibility /
AdvancedBase), a section registry, a corruption-safe Pinia store factory with localStorage
persistence, and a `usePreferences()` composable — with **zero** user-facing surface. This unblocks
the later preference-UI WPs without shipping any of them.

## 2. Context (Resurrection — Read First)

This WP **resurrects the never-merged WP-068 "Preferences Foundation."** WP-068 was drafted "Ready"
in 2026-04 (Option A locked by the old D-1414, per `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md`)
with a complete, tested ~909-line implementation — but **none of it ever merged to `main`.** The WP,
its EC-070, D-1414, the design-plan doc, and the code survive only on **retired local commit
`8ec6ceda`** (former branch `wp-068-preferences-foundation`). It surfaced during the 2026-08 branch
cleanup as the one stale branch carrying genuine unlanded work.

**Scaffold-verified (2026-08-12, this drafting session):** the `src/prefs/` implementation from
`8ec6ceda` was checked out onto current `main` and **typechecks clean (0 errors in `src/prefs/`)**
and its **17 unit tests pass**. (The registry-viewer *build* surfaces pre-existing
`@legendary-arena/registry/*` subpath-resolution errors in `src/lib/*` — the known fresh-worktree
registry-dist trap, resolved by `pnpm -r build` first — **not** caused by the prefs code.) So this
is a **clean bring-forward**, not a rewrite: the risk is integration (Pinia init in `main.ts`, the
`package.json` `pinia` dep) and porting the design-plan doc, not the foundation code itself.

Fresh numbers are used because the originals are unavailable: WP-068 is untracked on `main`, EC-070
is taken by other work, and D-1414 is absent from `main`. This WP reserves **WP-534 / EC-569 /
D-24344** and re-locks the Option-A path as **D-24344** (superseding the never-merged D-1414).

## 3. Assumes

- `apps/registry-viewer/` builds and typechecks on current `main` after `pnpm -r build`
  (`pnpm --filter registry-viewer build` / `typecheck` exit 0).
- `zod` and `vue` (`^3.4.27`) are already dependencies of `apps/registry-viewer`.
- The implementation to bring forward is at commit `8ec6ceda` under `apps/registry-viewer/src/prefs/`
  (schema / store / registry / composable + tests), plus its `main.ts` Pinia wiring and `package.json`
  `pinia` dep.
- The design plan `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md` (also only on `8ec6ceda`) is
  ported forward as the design-of-record for §2.3 defaults.

## 4. Scope

**In:**
- Install + initialize **Pinia** in `apps/registry-viewer/src/main.ts` (+ `pinia` in `package.json`).
- Bring forward `apps/registry-viewer/src/prefs/`: the Zod schema (`shared/schema/*.schema.ts`
  composed into a versioned `PreferencesSchema`), the section registry
  (`shared/registry/sectionRegistry.ts`), the store factory
  (`shared/store/createPreferencesStore.ts` + `persistence.ts`), the `usePreferences()` composable,
  and the app-level `registerSections.ts` stub (registers **zero** app-specific sections).
- Bring forward the unit tests (schema round-trip, corruption backup, quota-failure degradation,
  section-registry duplicate rejection, schema purity).
- Port `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md` (design-of-record).
- Land **D-24344** (Option-A path).

**Out:**
- Any user-visible UI (gear icon, settings drawer, section components) — later WPs.
- Any app-specific sections (Display / Filters / DataSource / Advanced) — later WPs.
- A new workspace package (`packages/ui-preferences/`) — forbidden by Option A (D-24344).
- Any change to existing viewer components (`App.vue`, `CardGrid.vue`, `CardDetail.vue`,
  `ThemeGrid.vue`, `ThemeDetail.vue`, `HealthPanel.vue`, `GlossaryPanel.vue`, `ImageLightbox.vue`,
  `src/lib/*.ts`).

## 5. Files Expected to Change

- `apps/registry-viewer/package.json` — **modified** — add `pinia`.
- `apps/registry-viewer/src/main.ts` — **modified** — `createPinia()` init (merged into the *current*
  `main.ts`, not clobbered with the 4-month-old version).
- `apps/registry-viewer/src/prefs/**` — **new** — schema, registry, store, composable, `registerSections.ts`, tests (from `8ec6ceda`).
- `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md` — **new** — ported design plan.
- Govern-close: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/ai/STATUS.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/DECISIONS.md` (D-24344 → Active). `NUMBER-LEDGER.md` reserved in this SPEC.

## 6. Contract

- Option-A path (D-24344): all preferences code under `apps/registry-viewer/src/prefs/`; no new package.
- Locked values (from EC-070, re-verified at execution): `PREFERENCES_SCHEMA_VERSION = 2`; storage
  key `"legendary-arena.preferences"`; backup key `"legendary-arena.preferences.backup"`; shared-tier
  section ids `"appearance"`, `"accessibility"`, `"advancedBase"`; §2.3 schema defaults.
- `*.schema.ts` files import **no** `vue` / `@vue/*` and reference **no** `document` / `window`
  (schema-purity test enforces this).
- `createPreferencesStore.ts` contains **no** `throw` — degradation is always to defaults + devLog.
- `sectionRegistry.registerSection` throws on duplicate id with a full-sentence error containing
  `"already registered"`.
- No user-visible UI change; viewer output bit-identical.

## 7. Acceptance Criteria

- [ ] `pnpm --filter registry-viewer build` + `typecheck` exit 0 (after `pnpm -r build`).
- [ ] The `src/prefs/**` unit tests pass (the scaffold observed **17/0** on current `main`).
- [ ] Schema-purity test passes (no `vue`/dom imports in `*.schema.ts`).
- [ ] No existing viewer component or `src/lib/*` file is modified (only `main.ts` + `package.json`
      + the new `prefs/` tree).
- [ ] Pinia is initialized once in `main.ts`; no store is instantiated at module scope.
- [ ] D-24344 flipped Active; no `packages/ui-preferences/` exists.

## 8. Verification Steps

1. `pnpm -r build` → 0 (registry dist built so registry-viewer resolves `@legendary-arena/registry/*`).
2. `pnpm --filter registry-viewer typecheck` → 0.
3. `pnpm --filter registry-viewer test` → 0 (incl. the ported prefs tests).
4. `pnpm -r --no-bail test` → whole workspace 0-fail.
5. `git diff --name-only` matches §5 (no stray component edits).

## 9. User-Visible Impact

**None** in this WP — the foundation is invisible. **User-Visible Surface = `cards.legendary-arena.com`**
only once a later WP mounts the settings UI on top of this foundation. D-24026 live-verification is
**N/A for this WP** (nothing renders differently); STATUS records "foundation only; no user-visible surface."

## 10. Definition of Done

- [ ] §4–6 implemented from the `8ec6ceda` source, integrated (not clobbered) into current `main`.
- [ ] All §7 criteria pass; `pnpm -r --no-bail test` green; `git diff --name-only` = the §5 allowlist.
- [ ] D-24344 Active; `WORK_INDEX` `[x]`, `EC_INDEX` Done, mindmap ✅, STATUS updated;
      `roadmap:counts:check` exits 0.
- [ ] Design plan `docs/14-*` present; no new workspace package.

## Lint Gate Self-Review

Per `00.3` (21 sections): non-negotiable constraints block + `00.6` reference present (§1/§2);
scope-boundary DoD checkbox present (§15). §17 — serves the operator/player-preference roadmap
(invisible foundation for accessibility + appearance controls). §20 **N/A** — no funding/support
affordance. §21 **N/A** — no HTTP endpoint or `apps/server` surface (client-only). §7 (determinism)
**N/A** — client UI, no engine/persistence/hash surface; the store uses no `Math.random` / `Date.now`
/ `performance.now` (guardrail). §9 **N/A** — no shell scripts.

Gate verdicts (2026-08-12): **scaffold OBSERVED** — the `8ec6ceda` `src/prefs/` code typechecks
clean (0 prefs errors) and passes 17/17 tests against current `main` (recorded at draft). Pre-flight
(`01.4`) and copilot (`01.7`) to run at the start of the execution session per the two-session lane.
