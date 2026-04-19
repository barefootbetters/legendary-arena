# WP-081 — Theme Audio Registry Contract (v2) — DRAFT SKELETON

> **DRAFT — NOT YET READY FOR EXECUTION.**
>
> This file is a **design skeleton**, not a ratified Work Packet. It exists
> to capture the scope and shape of the future WP while the governance path
> is completed. It has NOT yet:
> - passed the Prompt Lint Gate (`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`)
> - been indexed in `docs/ai/work-packets/WORK_INDEX.md`
> - had its companion DECISIONS entries ratified
>
> Do not execute this packet. When ready to promote to a real WP:
> 1. Land WP-062 (arena HUD scoreboard) on current branch.
> 2. Confirm the companion DECISIONS draft
>    (`docs/ai/drafts/theme-audio-v2-decisions-draft.md`) has been reviewed.
> 3. Copy this file to `docs/ai/work-packets/WP-081-theme-audio-registry-contract.md`, fill in the sections marked `[TBD during lint-gate pass]`,
>    run the 00.3 lint checklist, and address every FAIL.
> 4. Insert the indexed entry into `WORK_INDEX.md` (Phase 5 or Phase 6 — see
>    §Placement below).
> 5. Start a fresh Claude Code session for execution.
>
> **Authority:** This skeleton may be cited in design review discussions but
> carries **no execution authority** until promoted. No agent or human may
> begin implementation based on this file alone — promotion to
> `docs/ai/work-packets/` and ratification of the companion DECISIONS
> entries is required first.

**Status:** Draft Skeleton
**Primary Layer:** Content / Data Contracts (Registry)
**Schema Version Target:** `themeSchemaVersion: 2`
**Last Updated:** 2026-04-18
**Dependencies:** WP-003 (registry exists), WP-055 (ThemeDefinition v1 established)

---

## Placement in WORK_INDEX

**Proposed phase:** Phase 5 — Card Mechanics & Abilities, *or* Phase 6 —
Verification, UI & Production.

**Recommendation:** Phase 6, immediately after WP-066 (Registry Viewer Data
Toggle) which is the last registry-adjacent UI WP. Theme audio is a content
contract; it does not block any engine work.

**Parallel-safe with:** Any WP that does not touch `packages/registry/src/theme.*.ts` or the 40+ files in `content/themes/`.

**Promotion rule:** Final phase placement must be resolved during the
lint-gate pass; the skeleton intentionally leaves both Phase 5 and Phase 6
documented so the reviewer has an explicit decision to make. Do not promote
this file with both options still present — pick one and delete the other.

---

## Session Context

WP-055 established `ThemeDefinitionSchema` v1 with a single flat `musicURL`
field (a bare string). As the theme catalog grew past 40 files, a layered
audio model was designed through three review iterations
(see `docs/ai/drafts/theme-audio-v2-decisions-draft.md`). The final design
introduces an optional `audio` block containing four named music tiers and
a closed sting namespace, bumping the schema to v2 while preserving all v1
themes via loader-time alias normalization.

This WP lands only the **registry-layer data contract**. It introduces
**no runtime behavior**, **no playback logic**, and **no engine integration**.

---

## Why This Packet Matters

The existing `musicURL` field supports only one mode: a single looping track.
The v2 contract enables:
- per-context audio (browse preview vs. sustained play vs. end-screen)
- closed-namespace event stings (Scheme Twist, Master Strike, Villain Ambush,
  Bystander reveal) that clients can render without authorial sprawl
- a canonical `STING_EVENTS` array that feeds future drift-detection tests
- a clean migration path for existing themes (lint warning only, no CI break)

Without this WP, the current 40+ themes remain at v1 and any future audio
upgrade requires a breaking change. Landing the v2 contract now unblocks
theme authors to begin producing richer audio packs in parallel with engine
and client work. It also **pre-empts ad-hoc audio contracts**: without a
registry-level data shape, each future client team would invent its own
per-app audio descriptor, and those descriptors would inevitably diverge —
locking the shape now prevents that divergence before it starts.

---

## Goal

Establish a stable, extensible, engine-agnostic **Theme Audio Data Contract
(v2)** such that:

- Themes may optionally declare four named music tiers and a closed set of
  event stings.
- All v1 themes load unmodified via loader-time `musicURL` → `audio.ambientLoop.url` normalization.
- `STING_EVENTS` is a canonical readonly tuple with a drift-detection test.
- All audio URLs are absolute `https://`.
- No engine imports. No runtime playback logic. No client code.
- **No field in the v2 contract may imply timing, sequencing, or
  conditional logic that could be interpreted as gameplay behavior.**
  The contract describes *what audio assets exist*, not *when or under
  what conditions the client plays them*.

### After completion:

- `packages/registry/src/theme.schema.ts` updated to v2 with new `audio`
  block (strict top-level, passthrough per-track).
- `packages/registry/src/theme.validate.ts` updated with v1→v2 loader
  normalization (musicURL aliasing).
- `STING_EVENTS` canonical tuple exported with drift-detection test.
- `packages/registry/src/theme.schema.test.ts` extended with ≥10 new tests.
- Two example v2 themes demonstrate the new schema.
- DECISIONS.md entries D-8101 through D-8110 (see draft) recorded.
- `WORK_INDEX.md` updated with WP-081 status.
- Existing 40+ v1 themes remain unmodified (migration is a separate future
  WP, out of scope here).

---

## Assumes

- WP-003 complete: `packages/registry/` exists and uses Zod.
- WP-055 complete: `ThemeDefinitionSchema` v1 exists at
  `packages/registry/src/theme.schema.ts`.
- Existing themes in `content/themes/*.json` load cleanly at v1.
- `pnpm -r build` exits 0.
- `pnpm test` exits 0 on current `main`.
- No other WP is concurrently modifying `theme.schema.ts` or
  `theme.validate.ts`.

If any assumption is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — theme audio
  is registry-layer data only; no engine or client code.
- `docs/ai/ARCHITECTURE.md — "Registry Layer (Data Input)"` — registry may
  validate via Zod and expose read-only structures.
- `docs/ai/DECISIONS.md` — scan §D-5501 through §D-5508 for WP-055 precedent;
  scan §D-8101 through §D-8110 (once ratified) for the companion decisions
  driving this WP.
- `docs/ai/drafts/theme-audio-v2-decisions-draft.md` — the companion
  decisions draft (read in full; every decision maps to a WP-081 scope item).
- `.claude/rules/code-style.md` — drift-detection pattern for canonical
  readonly arrays (used for `STING_EVENTS`).
- `.claude/rules/registry.md` — registry-layer enforcement (if present; else
  `.claude/rules/architecture.md` §Registry Layer).
- `packages/registry/src/theme.schema.ts` — v1 schema to extend (preserve
  all existing shape).
- `docs/ai/REFERENCE/00.6-code-style.md` — full-sentence comments, no
  abbreviations, ESM only.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only.
- Never throw inside boardgame.io move functions — return void on invalid input.
- Never persist `G`, `ctx`, or any runtime state.
- `G` must be JSON-serializable at all times — no class instances, Maps,
  Sets, or functions.
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`.
- `node:` prefix on all Node.js built-in imports.
- Test files use `.test.ts` — never `.test.mjs`.
- No database or network access inside move functions or pure helpers.
- Full file contents for every new or modified file in the output — no diffs,
  no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Data only** — no runtime behavior, no playback logic, no client code.
- **Registry-layer only** — new code lives in `packages/registry/src/` only.
- **No engine imports** — no files from `packages/game-engine/`.
- **No audio playback** — no `HTMLAudioElement`, no Web Audio API, no
  preload strategy, no debounce, no crossfade.
- **No UI concerns** — no toggle components, no player preferences, no
  accessibility UI.
- **No default asset shipping** — universal default stings are explicitly
  deferred to a client WP (see D-8109) and **must not appear in the
  registry, the example theme files, or the test fixtures**. Placeholder
  URLs pointing at default assets are a scope violation even if they only
  exist "for tests."
- **v1 compatibility is mandatory** — every existing theme in
  `content/themes/*.json` must continue to load without modification.
- **No modification of existing theme JSON** — migration of v1 themes to
  v2 is out of scope; existing files are read-only for this WP.
- **STING_EVENTS is closed** — the four canonical keys are locked; adding a
  fifth requires a future DECISIONS entry and WP.
- **URLs are absolute `https://`** — validation rejects anything else at
  load time.
- **Zod shape:** `audio` object is strict (unknown top-level keys rejected);
  per-track objects use `.passthrough()` (unknown per-track fields preserved).

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the
  human before proceeding — never guess or invent field names, type shapes,
  or file paths.
- If the DECISIONS entries D-8101 through D-8110 have not been ratified at
  session start, STOP — do not execute without ratified governance.

**Locked contract values:**
- **Schema version target:** `themeSchemaVersion: z.literal(2)`.
- **Music tiers (closed):** `previewIntro`, `matchStart`, `ambientLoop`, `mainTheme`.
- **STING_EVENTS tuple (closed):** `['schemeTwist', 'masterStrike', 'villainAmbush', 'bystander'] as const`.
  The order of this tuple is canonical and must not be reordered without a
  migration decision. Consumers (tests, serializers, UIs) may rely on the
  declared order for stable iteration and snapshot comparisons.
- **`fireOn` enum:** `'every' | 'first' | 'final'` (optional on all stings).
- **URL constraint:** `z.string().url().startsWith('https://')`.
- **Default loudness targets (when omitted on a track):**
  previewIntro/matchStart `-16 LUFS`, ambientLoop `-18 LUFS`,
  mainTheme `-14 LUFS`, stings `-12 LUFS`.
- **v1 alias normalization:** `musicURL` (v1) → `audio.ambientLoop.url` (v2).

---

## Debuggability & Diagnostics

- Validation must be deterministic and reproducible.
- Errors must include:
  - `themeId` (when available)
  - failing field path
  - full-sentence error message
- Identical JSON input must always yield identical validation output.
- v1 themes must produce identical `ThemeDefinition` objects across loader
  runs (normalization is pure).
- Drift-detection test for `STING_EVENTS` must fail loudly if the tuple and
  union type diverge.

---

## Scope (In)

[TBD during lint-gate pass — full Zod shape, full loader normalization, and
full test body go here at promotion time. The bullet list below captures the
**shape of the scope**; concrete source code is written during WP promotion
and execution, not during skeleton draft.]

### A) `packages/registry/src/theme.schema.ts` — **modified**

- Bump `themeSchemaVersion` literal from `1` to `2`.
- Export `STING_EVENTS` readonly tuple.
- Export `StingEventName` type as union of tuple values.
- Add `ThemeAudioBaseTrackSchema` (per-track shape, passthrough): `url` (required, absolute https), `loudnessLufs` (optional number), `license` (optional
  string, advisory), `attribution` (optional string, advisory).
- Add `ThemeAudioAmbientLoopSchema` (extends base track, adds optional
  `loopPointMs` number).
- Add `ThemeAudioStingSchema` (extends base track, adds optional `fireOn` enum).
- Add `ThemeAudioSchema` (strict top-level): four optional music tier tracks
  plus optional `stings` record keyed by `StingEventName`.
- Add `audio: ThemeAudioSchema.optional()` to `ThemeDefinitionSchema`.
- Preserve every existing v1 field unchanged.

### B) `packages/registry/src/theme.validate.ts` — **modified**

- Add `normalizeV1ToV2` helper that detects `themeSchemaVersion: 1` + `musicURL` and produces a v2 shape with `audio.ambientLoop.url` populated.
- Call `normalizeV1ToV2` before `ThemeDefinitionSchema.safeParse` when the
  input declares `themeSchemaVersion: 1`.
- Emit a lint-channel warning (not a validation error) when a v1 theme is
  normalized (mechanism TBD: return field on ValidationSuccess or separate
  return type — decide during lint-gate pass).
- Reject v2 themes that contain a top-level `musicURL` field (validation
  error, full-sentence message).

### C) `packages/registry/src/theme.schema.test.ts` — **modified**

Add at minimum:
- v2 theme with full `audio` block (all four tiers + all four stings) passes.
- v2 theme with partial `audio` block (only `ambientLoop`) passes.
- v2 theme with `audio: {}` passes (equivalent to no audio).
- v2 theme with `audio: null` passes.
- v2 theme with unknown top-level `audio.*` key fails (strict validation).
- v2 theme with unknown sting key (e.g., `audio.stings.madeUpEvent`) fails.
- v2 theme with unknown per-track field (e.g., `audio.ambientLoop.weirdKey`)
  **passes** (passthrough preserved).
- v2 theme with `http://` URL fails.
- v2 theme with `data:` URI fails.
- v2 theme with `musicURL` top-level field fails.
- v1 theme with `musicURL` normalizes to v2 shape with
  `audio.ambientLoop.url` populated.
- v1 theme without `musicURL` normalizes to v2 shape with `audio` absent.
- `STING_EVENTS` tuple matches `StingEventName` union exactly
  (drift-detection test).

### D) `content/themes/example-v2-full.json` — **new**

Canonical v2 theme with all four music tiers and all four stings populated.
Serves as a living validation fixture and author reference.

### E) `content/themes/example-v2-minimal.json` — **new**

Canonical v2 theme with `audio` block present but only `ambientLoop`
populated. Demonstrates the common case of "one track, like v1, but
declared in v2 shape."

---

## Out of Scope

- **No migration of existing 40+ v1 themes to v2.** Every existing file in
  `content/themes/*.json` is read-only for this WP. Bulk migration is a
  separate content-authoring task, deferred indefinitely.
- **No playback logic.** No `HTMLAudioElement`, no Web Audio API, no
  preload strategy, no crossfade, no debounce, no rate-limiting.
- **No universal default sting assets.** Those live in the client layer
  (D-8109) and ship with the first client WP that plays theme audio.
- **No UI controls.** No toggles, no volume sliders, no player preferences,
  no accessibility UI.
- **No referential integrity validation.** v1 deferred this (D-5507); v2
  inherits the deferral.
- **No container/sample-rate enforcement.** URL format is enforced
  strictly; codec and sample rate are advisory (cannot be checked without
  network I/O). The schema nevertheless permits advisory fields (e.g.,
  declared `loudnessLufs`, `license`, `attribution`) for documentation and
  future static-analysis tooling; adding such tooling does not require
  re-opening this WP's governance.
- **No loudness measurement or normalization.** Schema captures declared
  LUFS; the actual audio file is not inspected.
- **No changes to engine code.** Nothing under `packages/game-engine/`.
- **No changes to server code.** Nothing under `apps/server/`.
- **No changes to client code.** Nothing under `apps/arena-client/` or
  any other `apps/*`.
- Refactors, cleanups, or "while I'm here" improvements are **out of
  scope** unless explicitly listed in Scope (In).

---

## Files Expected to Change

- `packages/registry/src/theme.schema.ts` — **modified** —
  schema version bump to 2; `STING_EVENTS` tuple; `StingEventName` union;
  `ThemeAudioBaseTrackSchema`, `ThemeAudioAmbientLoopSchema`,
  `ThemeAudioStingSchema`, `ThemeAudioSchema`; `audio` field on
  `ThemeDefinitionSchema`.
- `packages/registry/src/theme.validate.ts` — **modified** —
  `normalizeV1ToV2` helper; v1 auto-normalization path; v2 `musicURL`
  rejection.
- `packages/registry/src/theme.schema.test.ts` — **modified** —
  ≥10 new tests covering v2 shape, v1 normalization, drift detection,
  URL constraints, and strict/passthrough behavior.
- `content/themes/example-v2-full.json` — **new** — canonical full v2
  example.
- `content/themes/example-v2-minimal.json` — **new** — canonical minimal
  v2 example.

No other files may be modified. In particular, the existing 40+ v1 theme
files are untouched.

---

## Governance (Required)

Add the following decisions to `DECISIONS.md` (content drafted in
`docs/ai/drafts/theme-audio-v2-decisions-draft.md`):

- D-8101 — Theme Schema Bumps to `themeSchemaVersion: 2`
- D-8102 — `musicURL` Is a Deprecated Alias for `audio.ambientLoop.url`
- D-8103 — Theme Audio Is a Four-Tier Closed Set Plus Optional Stings
- D-8104 — `STING_EVENTS` Is a Canonical Closed Array with Drift Detection
- D-8105 — Sting Event Bindings Are Declarative; Firing Is Client-Defined
- D-8106 — `fireOn` Semantics for Recurring Stings
- D-8107 — Fallback Cascade: Theme → Universal Default → Silence
- D-8108 — URL Format and Encoding Constraints
- D-8109 — Universal Default Stings Live in the Client Layer
- D-8110 — Playback Logic Deferred; Accessibility Invariant Is Load-Bearing

Update `WORK_INDEX.md` to add WP-081 with status.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Schema Correctness
- [ ] `themeSchemaVersion` is `z.literal(2)` — not `z.literal(1)` and not
      generic `z.number`.
- [ ] `STING_EVENTS` is exported as a `readonly` tuple of exactly the four
      canonical values, in the exact order:
      `['schemeTwist', 'masterStrike', 'villainAmbush', 'bystander']`.
- [ ] `StingEventName` type matches `STING_EVENTS[number]` exactly (drift test
      asserts this).
- [ ] `ThemeAudioSchema` is strict — unknown top-level keys are rejected.
- [ ] Per-track schemas are passthrough — unknown per-track fields are preserved.
- [ ] All URL fields reject non-`https://` values at validation time.
- [ ] `audio` field on `ThemeDefinitionSchema` is optional; `audio: null`,
      `audio: {}`, and omission are all accepted.
- [ ] The order of `STING_EVENTS` is preserved exactly as declared —
      no test, serializer, or error message may produce the keys in any
      order other than `['schemeTwist', 'masterStrike', 'villainAmbush', 'bystander']`.

### v1 Compatibility
- [ ] Every existing v1 theme in `content/themes/*.json` loads successfully
      (confirmed with directory-scan test).
- [ ] v1 themes with `musicURL` produce a `ThemeDefinition` with
      `audio.ambientLoop.url` populated.
- [ ] v1 themes without `musicURL` produce a `ThemeDefinition` with `audio`
      absent or empty.
- [ ] v2 themes containing a top-level `musicURL` are rejected.

### Validation
- [ ] `validateTheme` returns structured result (never throws).
- [ ] Error messages are full sentences including field path.
- [ ] Lint-channel warning is emitted when a v1 theme is normalized.
- [ ] Lint warnings **do not change** the `ValidationSuccess` shape used by
      existing callers unless the shape change is explicitly documented in
      an amended DECISIONS entry. Warnings ride alongside the existing
      success shape; they do not replace or mutate it.

### Drift Detection
- [ ] The `STING_EVENTS` drift-detection test fails if the tuple or union is
      edited independently.

### Content
- [ ] `example-v2-full.json` exists and passes validation.
- [ ] `example-v2-minimal.json` exists and passes validation.
- [ ] Both example filenames match their `themeId` values (existing
      filename-slug rule from WP-055).

### Layer Boundary
- [ ] No imports from `packages/game-engine/` (confirmed with `grep`).
- [ ] No `boardgame.io` import in any new or modified file (confirmed with
      `grep`).
- [ ] No imports from any `apps/*` package (confirmed with `grep`).
- [ ] No Web Audio, `HTMLAudioElement`, or browser-only API references
      (confirmed with `grep`).

### Tests
- [ ] All new tests pass.
- [ ] Test files use `.test.ts` extension.
- [ ] Tests use `node:test` and `node:assert` only.
- [ ] No `boardgame.io` import in test files.

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`).
- [ ] No `require()` in any generated file (confirmed with `grep`).
- [ ] WP-055 contract files (the rest of `theme.schema.ts`) preserve all
      v1 shape — only additive changes permitted.

---

## Verification Steps

```bash
# Step 1 — build after all changes
pnpm -r build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm test
# Expected: TAP output — all tests passing, including new drift-detection test

# Step 3 — confirm no engine imports in registry theme files
grep -r "game-engine" packages/registry/src/theme.*.ts
# Expected: no output

# Step 4 — confirm no boardgame.io import
grep -r "boardgame.io" packages/registry/src/theme.*.ts
# Expected: no output

# Step 5 — confirm no app imports
grep -rE "from '[\"']@legendary-arena/(arena-client|server)" packages/registry/src/theme.*.ts
# Expected: no output

# Step 6 — confirm no browser-only APIs
grep -rE "HTMLAudioElement|AudioContext|new Audio\(" packages/registry/src/theme.*.ts
# Expected: no output

# Step 7 — confirm no require() in any file in scope
grep -rE "require\(" packages/registry/src/theme.*.ts content/themes/example-v2-*.json
# Expected: no output

# Step 8 — confirm all v1 themes still parse
# why: this step is intentionally slow (scans 40+ theme files) but is
# MANDATORY — it is the only verification that proves every existing
# v1 theme survives the v2 loader normalization. Do not skip or short-
# circuit this step even under time pressure.
node --input-type=module -e "
import { readdir, readFile } from 'node:fs/promises';
import { validateTheme } from './packages/registry/src/theme.validate.ts';
const files = await readdir('content/themes');
for (const file of files) {
  const raw = await readFile('content/themes/' + file, 'utf-8');
  const data = JSON.parse(raw);
  const result = validateTheme(data);
  if (!result.success) {
    console.error(file, 'FAILED:', result.errors);
    process.exit(1);
  }
  console.log(file, 'OK');
}
"
# Expected: all existing v1 themes print OK; both v2 examples print OK

# Step 9 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change

# Step 10 — confirm existing v1 themes are byte-unchanged
git diff content/themes/ -- ':!content/themes/example-v2-*.json'
# Expected: no changes to any pre-existing v1 file
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run
> the commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass.
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm test` exits 0 (all test files).
- [ ] No engine imports in registry theme files (confirmed with `grep`).
- [ ] No `boardgame.io` import in registry theme files (confirmed with `grep`).
- [ ] No app/client imports in registry theme files (confirmed with `grep`).
- [ ] No browser-only APIs referenced (confirmed with `grep`).
- [ ] No `require()` in any generated file (confirmed with `grep`).
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`).
- [ ] All existing v1 theme files are byte-unchanged (confirmed with
      `git diff content/themes/`).
- [ ] Example v2 theme files pass JSON parse and schema validation.
- [ ] `STING_EVENTS` drift-detection test passes.
- [ ] v1 normalization test (musicURL → audio.ambientLoop.url) passes.
- [ ] `docs/ai/STATUS.md` updated — theme audio v2 contract established;
      schema version bumped; v1 auto-normalization in place; closed sting
      namespace with drift detection; no engine or client coupling.
- [ ] `docs/ai/DECISIONS.md` updated with D-8101 through D-8110 (content
      from `docs/ai/drafts/theme-audio-v2-decisions-draft.md`).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-081 added with status.
- [ ] `docs/ai/drafts/theme-audio-v2-decisions-draft.md` and this skeleton
      file are **deleted** as part of the WP promotion commit (governance
      drafts are ephemeral; once ratified, the canonical copies live in
      `DECISIONS.md` and `docs/ai/work-packets/WP-081-*.md`).
- [ ] After promotion, **no historical reference may be made to the
      deleted draft files as authority**. The promoted WP and the ratified
      DECISIONS entries are the sole design record. Citing a deleted draft
      in later review, commits, or debugging is a governance violation —
      if the context is still needed, it belongs in the ratified artifacts.

---

## Open Items Before Promotion (Lint-Gate Pass)

The following items are intentionally unresolved in this skeleton and must
be locked during the promotion pass from draft to ratified WP:

1. **v1 normalization warning mechanism.** Lint warnings for v1 themes need
   a concrete delivery channel: (a) extra field on `ValidationSuccess`, (b)
   separate `warnings` array return, (c) console emit. Pick one during
   promotion and add a test.
2. **Example theme filenames.** `example-v2-full` and `example-v2-minimal`
   are placeholders; they may conflict with the existing `minimal-example`
   from WP-055. Confirm or rename during promotion.
3. **Placement in `WORK_INDEX.md`.** Phase 5 vs. Phase 6 — confirm with
   human reviewer before indexing.
4. **Sting debounce wording in schema docs.** D-8105 asserts "at most once
   per triggering card reveal" as a contract-level rule. The schema
   documentation should restate this; exact wording TBD during promotion.
5. **Open questions in the DECISIONS draft** (numbered list at the bottom
   of the companion draft file) must be resolved before the DECISIONS
   entries are considered ratifiable.

---

## Session Recommendations (For Future Executor)

When this skeleton is promoted and executed:

- Do **not** attempt to migrate any existing v1 theme files. That is
  explicitly out of scope. The temptation is real because the 40+ files
  are sitting right there; resist it.
- Do **not** write any playback code, any HTML audio element, any volume
  toggle, or any default sting asset. Those belong to a future client WP.
- Do **not** create new sting keys beyond the four canonical ones. If the
  temptation arises mid-session, stop and ask.
- Do **not** consult the companion DECISIONS draft file as authoritative
  — it exists only until the entries are copied into `DECISIONS.md` by
  the promotion commit. Once ratified, the live `DECISIONS.md` is the
  single source of truth and the draft file is deleted.
