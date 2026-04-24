# EC-091 — Loadout Builder in Registry Viewer (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-091-loadout-builder-registry-viewer.md`
**Layer:** Registry / Contracts + Client UI (`apps/registry-viewer/`)

> **Status: DRAFT.** Do not execute until (a) WP-003, WP-005A, WP-055 are merged on `main`; (b) WP-093 is executed and merged (authoritative governance for `heroSelectionMode` must exist before this packet emits it); (c) WP-091 is registered in `WORK_INDEX.md` (done 2026-04-24); (d) the 00.3 lint gate has been re-run against WP-091 and recorded passing (done 2026-04-24); (e) this EC is registered in `EC_INDEX.md`.

## Before Starting

> **STOP** if any checkbox below is false.

- [ ] WP-003 merged: `packages/registry/src/index.ts` exports `CardRegistryReader` with ext_id lookup surface
- [ ] WP-005A merged: `packages/game-engine/src/setup/matchSetup.types.ts` defines `MatchSetupConfig` with the 9 locked fields
- [ ] WP-055 merged: `packages/registry/src/theme.schema.ts` defines `ThemeDefinition.setupIntent` carrying 5 composition fields
- [ ] WP-093 merged: `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` / `MATCH-SETUP-JSON-SCHEMA.json` / `MATCH-SETUP-VALIDATION.md` canonicalize `heroSelectionMode` + error code + message template + label mapping
- [ ] Baseline captured: `pnpm --filter @legendary-arena/registry build` / `test` and `pnpm --filter registry-viewer build` / `typecheck` all exit 0 on `main`; counts noted for later comparison
- [ ] `Select-String -Path "apps\registry-viewer\src","packages\registry\src" -Pattern "from '@legendary-arena/game-engine'" -Recurse` returns no match (zero runtime engine imports pre-session)
- [ ] No parallel session is editing `apps/registry-viewer/src/App.vue` or `packages/registry/src/index.ts`

## Session Abort Conditions

Immediately ABORT (do not continue coding) if any of the following
conditions are observed during execution:

- The zod schema or validator is tempted to accept `"HERO_DRAFT"` in
  any code path (even temporarily for tests).
- Any code in `apps/registry-viewer/**` or `packages/registry/**`
  attempts to import `@legendary-arena/game-engine` (runtime or type).
- The validator produces a rule-mode error message that is not
  byte-for-byte identical to the WP-093 template.
- A composition field name does not exactly match the 9-field locked
  contract from 00.2 §8.1.
- Any attempt is made to "simplify" the schema by merging envelope and
  composition fields into a single flat type without an explicit `// why:`
  justification and validation test coverage.

## Locked Values (do not re-derive)

- **Composition fields (exactly these nine, in this order, verbatim):** `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`
- **Envelope fields (exactly these nine, matching WP-093):** `schemaVersion`, `setupId`, `createdAt`, `createdBy`, `seed`, `playerCount`, `themeId` (optional), `expansions`, `heroSelectionMode` (optional)
- **`heroSelectionMode` v1 enum:** `["GROUP_STANDARD"]` — exactly one value; `"HERO_DRAFT"` is reserved and must never appear in the allowed enum in v1
- **`schemaVersion`:** `"1.0"` (literal)
- **`createdBy` enum:** `"player"` | `"system"` | `"simulation"` — this packet emits `"player"` only
- **`playerCount` range:** integer 1..5
- **ID pattern:** `^[a-z0-9-]+$`
- **Standard pile-count defaults:** `bystandersCount: 30`, `woundsCount: 30`, `officersCount: 30`, `sidekicksCount: 0`
- **Default expansions:** `["base"]`
- **Seed generator (browser, Web Crypto, verbatim):** `crypto.randomUUID().replace(/-/g, '').slice(0, 16)`
- **Seed is opaque.** It is not parsed, interpreted, hashed, or validated beyond length/format. The engine treats it as an opaque determinism anchor.
- **Rule-mode error code (from WP-093):** `"unsupported_hero_selection_mode"`
- **Rule-mode error message template (from WP-093, verbatim — byte-for-byte):**
  `"The loadout envelope's heroSelectionMode is <value>, which is not a supported rule mode in v1 of the match setup schema. Supported modes: GROUP_STANDARD. (HERO_DRAFT is reserved for a future release and is not yet implemented.)"`
- **Rule-mode indicator UI string (from WP-093, verbatim):**
  `"Hero selection rule: GROUP_STANDARD — Classic Legendary hero groups"`
- **Rule-mode hover tooltip (from WP-093, verbatim):**
  `"The engine expands each selected hero group into its canonical card set at match start."`
- **Rule-mode info-icon copy (from WP-093, verbatim; the ONLY explanatory sentence WP-091 emits beyond the machine name):**
  `"Hero Draft rules are planned for a future update."`
- **Downloaded JSON always emits `heroSelectionMode: "GROUP_STANDARD"` explicitly** (never relies on the absent-default for auditability)

## Guardrails

- **Layer boundary:** no `from '@legendary-arena/game-engine'` import anywhere in `apps/registry-viewer/**` or `packages/registry/**` — even as types. Verified by `Select-String`.
- **No new npm dependencies.** Zod is already present in both touched packages. No `ajv`, `jsonschema`, or any other JSON Schema runtime.
- **Strict zod schemas.** Every object uses `.strict()` to mirror `additionalProperties: false` in the JSON Schema.
- **Normalization of rule-mode defaults occurs only in `validateMatchSetupDocument()` before returning `{ ok: true, value }`.** No other layer (UI, composable, serializer) may assume or inject defaults — they read `value.heroSelectionMode` after validation and rely on it being set.
- **Error message is not constructed locally.** The `"unsupported_hero_selection_mode"` message must be sourced from a single locked constant that matches the WP-093 template byte-for-byte; `<value>` substitution is the only permitted transformation.
- **Rule-mode constants must live in the registry package only.** UI files import the constant; they must not inline, clone, or restate the rule-mode error message or label text.
- **UI copy must match governance labels exactly.** No capitalization changes, punctuation changes, or wording tweaks are permitted for rule-mode labels, tooltips, or info-icon text.
- **No persistence.** No `localStorage` / `sessionStorage` / `IndexedDB` / cookie writes. The loadout lives in memory only.
- **No server calls.** The builder never contacts the game server; it only reads already-cached R2 singletons.
- **No router library.** The "Loadout" tab integrates into the existing single-page tab switcher in `App.vue`.
- **No UI explanation of `HERO_DRAFT` beyond the one locked sentence.** The info-icon copy is the only permitted reference to the reserved mode in v1 UI.
- **Rule-mode indicator is read-only in v1.** Enum has exactly one value; no picker, no dropdown, no toggle.
- **Engine-side `matchSetup.types.ts` / `matchSetup.validate.ts` are untouched.** A drift-detection test asserts the registry-side mirror's 9 field names match engine's `MatchSetupConfig` at compile time.

## Required `// why:` Comments

- `setupContract.types.ts` — on `SetupCompositionInput`: mirrors engine's `MatchSetupConfig`; drift-detection test in `setupContract.test.ts` keeps field sets in sync
- `setupContract.types.ts` — on `HeroSelectionMode`: literal-union with one v1 member; future WPs extend via WP-093 amendment first (cite the naming-governance policy)
- `setupContract.schema.ts` — on every `.strict()` usage: mirrors JSON Schema `additionalProperties: false`
- `setupContract.schema.ts` — on `heroSelectionMode` enum: v1 has exactly one member per WP-093; `"HERO_DRAFT"` is reserved in DECISIONS but not in the enum
- `setupContract.validate.ts` — on zod-error upgrade to WP-093 message template: preserves authoritative message text
- `setupContract.validate.ts` — on Step 3 default normalization: enforces WP-093 backward-compat semantic exactly once at this boundary
- `setupContract.validate.ts` — on accumulate-don't-fail-fast: UX rationale (full error list actionable)
- `useLoadoutDraft.ts` — on `exportToJsonBlob`'s key ordering: deterministic diffs across exports
- `useLoadoutDraft.ts` — on seed generator: Web Crypto (not `Math.random`); 16-hex opaque value, determinism-compatible downstream
- `LoadoutBuilder.vue` — on "🎲 Re-roll" button: re-rolling the seed is a valid authoring step; prior match reproducibility via paste-upload
- `LoadoutBuilder.vue` — on rule-mode indicator (no picker/dropdown/toggle): read-only surface is deliberate; exposing a picker would imply unsupported mechanics. Governance mandates read-only display until the enum expands per WP-093.
- `App.vue` — on new "Loadout" tab entry: additive authoring surface; Cards/Themes tabs unaffected

## Files to Produce (No Substitutions Permitted)

- `packages/registry/src/setupContract/setupContract.types.ts` — **new** — envelope + composition + validation-result types
- `packages/registry/src/setupContract/setupContract.schema.ts` — **new** — strict zod schemas mirroring `MATCH-SETUP-JSON-SCHEMA.json`
- `packages/registry/src/setupContract/setupContract.validate.ts` — **new** — `validateMatchSetupDocument()` pure function with rule-mode upgrade + default normalization
- `packages/registry/src/setupContract/setupContract.test.ts` — **new** — `node:test` coverage; drift-detection vs. engine `MatchSetupConfig`; byte-for-byte message equality for `"unsupported_hero_selection_mode"`
- `packages/registry/src/index.ts` — **modified** — named re-exports of the new `setupContract` public surface
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — **new** — draft-state composable
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **new** — two-column builder + picker + download/upload + rule-mode indicator
- `apps/registry-viewer/src/App.vue` — **modified** — third tab "Loadout" mounting `<LoadoutBuilder />`
- `docs/ai/STATUS.md` — **modified** — WP-091 complete note
- `docs/ai/DECISIONS.md` — **modified** — D-91xx entries: registry-side placement; zod over ajv; third tab over router; persistence deferral; seed via Web Crypto; rule-mode consumption rule
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-091 `[ ]` → `[x]` with today's date
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-091 Draft → Done

## After Completing

- [ ] `pnpm --filter @legendary-arena/registry build` exits 0 with zero new TS errors
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0; new `setupContract.test.ts` passes all cases (minimal valid, absent-mode defaulted, `"HERO_DRAFT"` rejected with exact WP-093 message, `"MADE_UP"` rejected, round-trip deep-equals)
- [ ] `pnpm --filter registry-viewer build` exits 0 (Vite build succeeds)
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `Select-String -Path "apps\registry-viewer\src","packages\registry\src" -Pattern "from '@legendary-arena/game-engine'" -Recurse` returns no match
- [ ] `Select-String -Path "apps\registry-viewer\src" -Pattern "Math\.random|localStorage|sessionStorage|indexedDB" -Recurse` returns no match
- [ ] `Select-String -Path "packages\registry\src\setupContract\setupContract.schema.ts" -Pattern "\.strict\("` returns ≥ 3 matches
- [ ] `Select-String -Path "apps\registry-viewer\src\components\LoadoutBuilder.vue" -Pattern "schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds|bystandersCount|woundsCount|officersCount|sidekicksCount"` returns ≥ 9 matches
- [ ] `Select-String -Path "apps\registry-viewer\src\components\LoadoutBuilder.vue" -Pattern "Hero selection rule: GROUP_STANDARD . Classic Legendary hero groups"` returns exactly 1 match (the locked UI label)
- [ ] `Select-String -Path "apps\registry-viewer\src\components\LoadoutBuilder.vue" -Pattern "Hero Draft rules are planned for a future update\."` returns exactly 1 match
- [ ] `git diff apps/registry-viewer/package.json packages/registry/package.json` shows no changes under `dependencies`
- [ ] Smoke-boot: `pnpm --filter registry-viewer dev`, open browser, confirm (1) new "Loadout" tab present, (2) picker workflow produces schema-valid JSON, (3) downloaded JSON contains `"heroSelectionMode": "GROUP_STANDARD"` explicitly, (4) upload round-trips, (5) Cards/Themes tabs unregressed — recorded in session invocation with screenshots
- [ ] `git diff --name-only packages/game-engine/ apps/server/ apps/arena-client/` returns empty
- [ ] `git diff --name-only` lists only files under `## Files to Produce (No Substitutions Permitted)`

## Common Failure Smells

- Validator accepts `heroSelectionMode: "HERO_DRAFT"` in a test expecting `ok: true` → reserved-future semantics were re-derived; `"HERO_DRAFT"` must never appear in the allowed enum
- Test passes with `assert.ok(errors[0].message.includes("not supported"))` → substring match; byte-for-byte rule was relaxed (see `assert.strictEqual` guardrail)
- Downloaded JSON omits `heroSelectionMode` → explicit-emission rule violated; UI must never rely on the absent-default for its own output
- `apps/registry-viewer/src/` gains an `import { something } from '@legendary-arena/game-engine'` line → layer boundary breach; the registry-side mirror is how the UI stays engine-free
- UI offers a dropdown/picker for `heroSelectionMode` → v1 read-only rule violated; the enum has one value and no user choice exists
- Error message renders "Hero selection mode not supported" or any paraphrase → not sourced from the WP-093 locked constant; fix by extracting the template to a `const` at the top of the validator and referencing it
- `LoadoutBuilder.vue` contains a second sentence about `HERO_DRAFT` (mechanics, timeline, FAQ) → UI-explanation guardrail violated; the info-icon copy is the only sentence permitted
- Tests hard-code a rule-mode error string directly instead of importing the shared constant → brittle test; must assert against the canonical constant
- A new helper re-exports `heroSelectionMode` as lowercase or kebab-case for UI convenience → enum-value-pattern violated (must remain SCREAMING_SNAKE_CASE)

---

*If this EC passes, WP-091 enters a stable "authoring contract" phase; future changes must be additive and gated by new governance WPs.*
