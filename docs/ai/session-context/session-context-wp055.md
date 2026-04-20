# Session Context — WP-055 Theme Data Model

Bridge from WP-042 execution (Phase 6 closure, 2026-04-19) to the WP-055
executor. Carries baselines, inherited dirty-tree state, quarantine
notes, and session-to-session discipline precedents that the WP-055
session prompt should consume at pre-flight.

---

## Baselines (Phase 6 closed at commit `c376467`)

- **Engine package:** `436 tests / 109 suites / 0 failing` — unchanged
  across the final three Phase-6 executions (WP-034 / WP-035 / WP-042).
- **Repo-wide:** `526 passing / 0 failing` — sum of registry 3 +
  vue-sfc-loader 11 + game-engine 436 + server 6 + replay-producer 4 +
  arena-client 66.
- **Phase 6 tag:** `phase-6-complete` published to `origin` at commit
  `c376467` (the WP-042 `SPEC:` governance-close commit on branch
  `wp-064-log-replay-inspector`).

**WP-055 test-count expectation (not a lock yet, confirm at pre-flight):**
WP-055 is Code+Content class (Zod schema + validation helpers + test file
+ content JSON). Expected baseline shift: **registry package 3 → 13
tests** (the WP-055 spec §A+§D lists 10 new tests; add to the existing
registry smoke test = 13). Repo-wide target: `526 → 536`. Engine
baseline must remain **unchanged** at 436/109/0 (WP-055 touches no
engine code). RS-2-style lock should state this explicitly.

---

## CRITICAL: Inherited dirty-tree state — investigate before staging

Running `git status --short` at session start will show a large dirty
tree. Most of it is inherited from other sessions, but three classes
of file are **directly relevant to WP-055** and must be investigated
before the WP-055 pre-flight locks any scope:

1. **~70 modified `content/themes/*.json` files.** Every shipped theme
   has working-tree edits. These may be:
   - Partial WP-055 work (music-field additions per **D-5509** — v1→v2
     migration staged but uncommitted).
   - A separate in-flight theme-curation session (unrelated to WP-055
     schema work).
   - A mix of both.

   **Action for WP-055 pre-flight:** diff a representative sample
   (e.g., `content/themes/dark-phoenix-saga.json`, one of the obvious
   flagship themes) against `HEAD` to determine what the edits are.
   If they ARE the v1→v2 music-field migration, WP-055 should stage
   them under its allowlist as fixtures (the `§D.8` directory-scan
   test requires every file in `content/themes/` to pass validation).
   If they are unrelated, quarantine them in a stash and confirm the
   scope is additive-only.

2. **`apps/registry-viewer/src/lib/themeClient.ts`** modified.
3. **`apps/registry-viewer/CLAUDE.md`** modified.

   Both are in the registry-viewer app. WP-055's spec explicitly
   scopes only `packages/registry/src/` + `content/themes/` —
   registry-viewer touches are **out of scope**. These working-tree
   edits likely belong to the same separate session that is editing
   the theme JSON files; quarantine them alongside.

**Other inherited dirty-tree items (unrelated to WP-055 — do NOT stage):**

- `M docs/ai/invocations/session-wp079-...`
- `M docs/ai/work-packets/WP-055-theme-data-model.md` (may pick up
  edits from this session's recommendations — see next §)
- `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md`
- `?? docs/ai/invocations/forensics-move-log-format.md`
- `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md`
- `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md`
- `?? docs/ai/invocations/session-wp068-preferences-foundation.md`
- `?? docs/ai/post-mortems/01.6-applyReplayStep.md`
- `?? docs/ai/session-context/session-context-forensics-move-log-format.md`
- `?? docs/ai/session-context/session-context-wp067.md`

Stage by name only. Never `git add .` / `git add -A` (P6-27 / P6-44 /
P6-50 discipline).

---

## Quarantine state (do not disturb)

- **`stash@{0}`** and **`stash@{1}`** — both owned by the WP-068 /
  MOVE_LOG_FORMAT resolver. **Do NOT pop.**
- **EC-069 `<pending — gatekeeper session>`** placeholder in
  `EC_INDEX.md` — owned by a separate SPEC session. **Do NOT
  backfill.**

---

## What already exists (do NOT recreate)

68 theme JSON files already exist in `content/themes/` — authored,
validated against card registry data, deployed to R2 — plus their
support infrastructure. WP-055 creates the Zod schema + validation
helpers + tests, **not** the themes themselves.

Existing assets:

- `content/themes/*.json` — 68 committed themes across 9 categories.
- `content/themes/CATALOG.md` — generated slug reference (774 entries).
- `content/themes/THEME-INDEX.md` — canonical index with governance
  rules.
- `content/themes/index.json` — R2 manifest of all theme filenames.
- `scripts/generate-theme-catalog.mjs` — catalog generator.
- `scripts/comicvine-cover-fetcher.mjs` — cover-image URL fetcher.
- `scripts/upload-themes-to-r2.mjs` — R2 upload script.
- `apps/registry-viewer/` — Themes tab, ThemeGrid, ThemeDetail
  already live.
- `docs/ai/DECISIONS.md` — D-5501 through D-5509 (theme governance,
  including D-5509 music-fields bump).
- `docs/ai/work-packets/WP-055-theme-data-model.md` — full spec with
  v2 schema including music fields.

What WP-055 must create:

- `packages/registry/src/theme.schema.ts` — Zod schemas
  (`ThemeDefinitionSchema`, `ThemeSetupIntentSchema`,
  `ThemePlayerCountSchema`, `ThemePrimaryStoryReferenceSchema`,
  `ThemeMusicAssetsSchema`).
- `packages/registry/src/theme.validate.ts` — `validateTheme()` sync,
  `validateThemeFile()` async with filename-to-themeId alignment
  check.
- `packages/registry/src/theme.schema.test.ts` — 10 tests per the WP
  spec §D.

---

## Theme JSON shape (current v2, all 68 files follow this)

- `themeSchemaVersion: 2` (literal; v1 files must be migrated, never
  loaded as-is — §D test #9)
- `themeId` — kebab-case string; filename must match
- `name`, `description` — required strings
- `setupIntent` — `{ mastermindId, schemeId, villainGroupIds,
  henchmanGroupIds?, heroDeckIds }`
- `playerCount` — `{ recommended: number[], min, max }` with `min <=
  max` refinement and `recommended` within `[min, max]`
- `tags?` — `string[]`
- `references?` — `{ primaryStory: { issue?, year?, externalUrl?,
  marvelUnlimitedUrl?, externalIndexUrls? } }`
- `flavorText?` — string
- `comicImageUrl?` — `string | null` (editorial cover image; D-5506)
- `musicTheme?` — string (D-5509, v2)
- `musicAIPrompt?` — string (D-5509, v2)
- `musicAssets?` — eight optional URL fields
  (`previewIntroUrl`, `matchStartUrl`, `ambientLoopUrl`,
  `mainThemeUrl`, `schemeTwistUrl`, `masterStrikeUrl`,
  `villainAmbushUrl`, `bystanderUrl`) (D-5509, v2)

`MatchSetupConfig` contract (WP-005A, locked):

- IDs are bare slugs matching `SetData` entries (e.g., `"loki"`,
  `"hydra"`).
- Count fields (`bystandersCount`, `woundsCount`, etc.) are excluded
  from themes — themes describe content composition, not pile sizing.

**Layer constraint:** theme schema lives in `packages/registry/` only.
No imports from `packages/game-engine/`. No `boardgame.io` imports.
Registry layer boundary enforced.

**Test runner:** `node:test`. **Test extension:** `.test.ts`. No
`.test.mjs`.

---

## Discipline precedents to carry into the WP-055 pre-flight

The following precedents were locked or validated during the
WP-034 → WP-035 → WP-042 Phase-6 closure sequence (2026-04-19). Each
one is citable by its precedent ID in `01.4-pre-flight-invocation.md`.

### Reality-reconciliation at pre-flight (derived from WP-042 §8)

Before locking any **Locked Value** in the WP-055 session prompt —
schema field names, file paths, env vars, test-count baselines —
**grep the actual source files** to confirm the name exists and
matches. WP-042's post-mortem §8 surfaced three drifts at execution
time where the session prompt's locked values referenced
paper-specs names that the real code never used
(`CARDS_DIR` → actual `SETS_DIR`; `EXPECTED_DB_NAME` → not read by
the runner; `legendary.card_types` / `legendary.cards` → tables that
don't exist yet). Each cost authoring cycles that a pre-flight grep
would have prevented.

**For WP-055 specifically,** cross-check:

- `packages/registry/src/schema.ts` — the existing Zod-schema patterns
  the WP will mirror. Confirm naming conventions (camelCase vs
  snake_case, `Entry` vs `Definition` suffix) match what WP-055's
  schema adopts.
- One or two representative `content/themes/*.json` files — confirm
  the v2 field set in the bridge above matches reality. If the
  dirty-tree edits have migrated the files, verify the v2 fields
  land at the expected keys.
- `packages/registry/src/index.ts` — confirm the registry package's
  public-surface export pattern. WP-055's `theme.schema.ts` +
  `theme.validate.ts` should export according to that convention.
- `apps/registry-viewer/src/` — confirm how the viewer currently
  consumes theme data (since the viewer already displays themes,
  there's a de facto runtime contract that WP-055's schema must
  not break).

### Three-commit topology (proven across WP-034 / WP-035 / WP-042)

Every Phase-6 WP closed with this topology and the pattern should
hold for WP-055:

1. **Commit A0 (`SPEC:`)** — pre-flight bundle: new D-entries +
   WP/EC amendments + session invocation prompt. **Lands before
   Commit A.**
2. **Commit A (`EC-XXX:`)** — execution: files in the allowlist +
   new D-entries authored during execution + 01.6 post-mortem.
3. **Commit B (`SPEC:`)** — governance close: `STATUS.md` +
   `WORK_INDEX.md` flip + `EC_INDEX.md` flip + any
   DECISIONS/INDEX follow-ups.

The commit-msg hook enforces the prefixes; `WP-055:` as a commit
prefix is **forbidden** per P6-36 (the hook rejects it). Use
`EC-055:` for code-changing commits and `SPEC:` for governance and
pre-flight.

### 01.5 Runtime Wiring Allowance — likely NOT INVOKED for WP-055

WP-055 adds **new** types and files; it does not modify
`LegendaryGameState`, `LegendaryGame.moves`, or any other engine-wide
shared contract. All four 01.5 trigger criteria (new required field
on shared type, shape change to setup-orchestrator return type, new
move affecting structural assertions, new phase hook) are absent.
State the **NOT INVOKED** verdict explicitly in the session prompt
per P6-51 form-(1) precedent (see WP-042's session prompt §Runtime
Wiring Allowance block as template).

### 01.6 Post-Mortem — MANDATORY for WP-055

Two triggers fire: **new long-lived abstraction** (`ThemeDefinition`
is the canonical content-primitive surface for the lifetime of the
project) and **new contract consumed by future WPs** (every future
theme-consumer WP will import `ThemeDefinitionSchema`). Formal
10-section audit at
`docs/ai/post-mortems/01.6-WP-055-theme-data-model.md`, staged into
Commit A.

### Paraphrase discipline (P6-50)

Less critical for WP-055 than for WP-042's documentation checklists,
but the `// why:` comments in `theme.schema.ts` should avoid
accidentally referring to engine concepts (`G`, `ctx`, framework
types). The existing `// why:` comments in `packages/registry/src/schema.ts`
are the model — they describe registry / data concerns only.

### Forbidden staging patterns (P6-27 / P6-44)

- Never `git add .` or `git add -A`.
- Stage by name only.
- Never `--no-verify`; never `--no-gpg-sign`.
- If the commit-msg hook rejects a message, fix the message and
  re-stage. The hook's rejection is load-bearing.

---

## Open questions for the WP-055 pre-flight session

These surfaced while reading through the shipped assets; resolve them
at pre-flight rather than at execution:

1. **Are the ~70 dirty-tree `content/themes/*.json` edits the v1→v2
   music-field migration?** If yes, WP-055's allowlist should cover
   them (test #8 runs the directory scan). If no, quarantine them
   and confirm WP-055 ships with a clean theme-file set.
2. **Is `packages/registry/src/index.ts` exporting
   `@legendary-arena/registry`'s public surface?** If yes, WP-055
   should extend it with `ThemeDefinition` / `validateTheme` /
   `validateThemeFile` per the existing pattern. If no, state the
   export convention in the session prompt.
3. **Does `apps/registry-viewer/` currently consume the theme JSON
   via a de-facto runtime shape?** The viewer already renders themes.
   WP-055's schema is authoritative going forward, but the pre-flight
   should confirm the viewer's existing read paths will continue to
   work (i.e., the viewer currently reads the same fields the new
   Zod schema will enforce, so validation is a strict no-op on
   already-accepted data).
4. **Test count reconciliation.** WP-055 spec §D currently lists
   "Ten tests" but §Files Expected to Change and §Acceptance
   Criteria say "8 tests" in two places. Confirm the target at
   pre-flight and update the spec consistently — or land the
   reconciliation in the pre-flight `SPEC:` commit.

---

## Final reminders

- **Phase 6 is closed.** No mid-WP-055 retro-editing Phase-6 artifacts.
- **Registry layer boundary is load-bearing** — no engine imports, no
  `boardgame.io` imports, no filesystem access from registry runtime
  (scripts are a separate concern).
- **68 themes already shipped.** WP-055 is a governance
  crystallization of their shape, not a content-authoring WP.
- **Three-commit topology + 01.6 MANDATORY + 01.5 NOT INVOKED** —
  call all three out in the session prompt per WP-042 precedent.
