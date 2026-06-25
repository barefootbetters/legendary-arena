# WP-291 — Loadout Tab "Load LAGN" Import (Close the LAGN Export/Import Round-Trip)

**Status:** Draft — ready to execute (drafted 2026-06-25) · **Lightweight Lane** (D-24028)
**Primary Layer:** Registry Viewer (`apps/registry-viewer`)
**User-Visible Surface:** `cards.legendary-arena.com` (Registry Viewer — a "📥 Load LAGN (paste or file)" control on the Loadout tab)
**Dependencies:** WP-245 (LAGN export — the `compositionToLagnSetup` mapping this reverses) ✅; WP-091 (`useLoadoutDraft` + the existing MATCH-SETUP JSON import) ✅; WP-244 (the published `@legendary-arena/lagn` validator + `LAGN` type) ✅. All landed.
**Baseline:** `origin/main` @ `99ff1dad` (2026-06-25).

---

## Goal

On the Loadout tab a player can already **export** a LAGN file ("⬇ Download LAGN", WP-245) but cannot **import** one back — the only importer ("📥 Load JSON") validates against the MATCH-SETUP schema, so a LAGN file (a different shape: `lagn_version` / `setup` / `result`) is rejected with "field required" / "unknown field" errors. This WP closes that export/import asymmetry by adding a **separate "📥 Load LAGN (paste or file)" control** that parses a LAGN file via the published `@legendary-arena/lagn` validator, reverses WP-245's composition→`setup` mapping, and loads it into the shared draft — after which the WP-288 "🖼 View as cards" gallery and every other Loadout-tab affordance work on it. `pnpm --filter registry-viewer typecheck`, `test`, and `build` exit 0.

---

## Assumes

- **The Loadout tab already imports MATCH-SETUP JSON, NOT LAGN.** `LoadoutBuilder.vue`'s `onFileImport` / `onPasteImport` route to `loadFromJson` → `validateMatchSetupDocument`, which requires `schemaVersion` + `composition`. A LAGN file fails it (operator field report 2026-06-25). (Verified at `apps/registry-viewer/src/composables/useLoadoutDraft.ts` `loadFromJson`.)
- **The LAGN `setup` block carries the full composition in the same id-space.** WP-245's `compositionToLagnSetup` writes `mastermind.id` / `scheme.id` / `villain_groups[].id` / `henchmen_groups[].id` / `heroes[].id` (set-qualified ext_ids, D-24018) + the four counts; the LAGN envelope carries `player_count`. So a LAGN file is losslessly reversible to a composition with no registry lookup. (Verified at `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` `compositionToLagnSetup` + `packages/lagn-spec/src/validator.ts` `GameSetupSchema`.)
- **`@legendary-arena/lagn` exports a browser-safe `validate` + `LAGN` type.** The export composable already imports both and the viewer builds (CI builds the lagn dist before the viewer per PR #323/#327). (Verified at `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts:10`.)
- **The shared draft API exposes the setters needed to apply a composition.** `resetDraft`, `setScheme`, `setMastermind`, `addVillainGroup`, `addHenchmanGroup`, `addHeroGroup`, `setCount`, `setPlayerCount` are all already destructured in `LoadoutBuilder.vue`. So the import drives existing methods — no composable change. (Verified at `apps/registry-viewer/src/components/LoadoutBuilder.vue:60`.)

---

## Context

Surfaced by an operator field report after WP-288 shipped: trying to "load a LAGN → View as cards" failed because the Loadout tab has no LAGN importer — only a MATCH-SETUP JSON importer. WP-288's `## Assumes` block imprecisely claimed "the Loadout tab already imports LAGN / JSON files"; in fact `onFileImport` only handles MATCH-SETUP documents. The gallery itself works (it reads the shared draft however it's populated — theme prefill, manual picking, MATCH-SETUP JSON), but the literal "load a LAGN file" entry the headline promised was never wired. This WP supplies the missing importer.

**Why a separate control, not auto-detect (operator decision, 2026-06-25).** The existing "Load JSON" importer could be taught to sniff the shape and accept both. The operator chose instead to keep a **distinct "Load LAGN" control** alongside "Load JSON" so the two formats stay explicit and discoverable, mirroring the two explicit "Download MATCH-SETUP" / "Download LAGN" export buttons already on the tab.

---

## Scope (In)

- A boardgame.io-free helper `loadoutLagnImport.ts`: `parseLagnLoadout(jsonText)` parses the text, validates it with the published `@legendary-arena/lagn` `validate`, and on success returns the composition (the five ext_id fields + four counts + `playerCount`) reverse-mapped from `setup`; on failure returns full-sentence errors. Unit-tested with `node:test`.
- A **"📥 Load LAGN (paste or file)"** control in `LoadoutBuilder.vue` (its own `<details>`, parallel to the existing "Load JSON"): a file input + a paste textarea + a "Load pasted LAGN" button, an import-error list, and a success line. Its handlers call `parseLagnLoadout` then apply the composition to the shared draft via the existing setters (`resetDraft` → `setScheme` / `setMastermind` / `add*` / `setCount` / `setPlayerCount`).

## Scope (Out)

- **No change to the existing "Load JSON" MATCH-SETUP importer**, `loadFromJson`, or any `useLoadoutDraft` mutation / validation logic — the new control is additive and routes through existing setters.
- **No auto-detect / merged importer** — the operator chose two explicit controls.
- **No new draft-API method, no composable change, no new contract file** (`.types.ts` / `.validate.ts` / `.gating.ts`), no `MatchSetupConfig` change.
- No engine / registry / server / `data/cards` change; no new HTTP endpoint; no persistence / determinism surface. No change to the LAGN spec / validator (`packages/lagn-spec`) — this WP only *consumes* the published `validate`.
- No change to `App.vue`, the WP-288 gallery, `CardGrid.vue`, the Cards-tab filters, or the WP-279 add-to-loadout button + tray.

---

## Files Expected to Change

- `apps/registry-viewer/src/lib/loadoutLagnImport.ts` — **new** — `parseLagnLoadout` + `LagnLoadoutComposition` (no boardgame.io).
- `apps/registry-viewer/src/lib/loadoutLagnImport.test.ts` — **new** — `node:test` coverage (non-JSON reject / non-LAGN reject / valid-LAGN extraction / group→ids + officers rename).
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — the "📥 Load LAGN" control + handlers driving the existing draft setters.
- Governance: `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/ai/STATUS.md` / `docs/ai/DECISIONS.md` (D-24075) / `docs/05-ROADMAP-MINDMAP.md`.

**3 code/test files (1 modified + 2 new) + governance.** Lightweight-lane eligible.

---

## Contract

### A. Pure helper `loadoutLagnImport.ts` (new) — the testable invariant

- `parseLagnLoadout(jsonText: string): { ok: true; composition: LagnLoadoutComposition } | { ok: false; errors: string[] }`:
  1. `JSON.parse` (catch → a full-sentence "could not be parsed as JSON" error).
  2. `validate(parsed)` (the published `@legendary-arena/lagn` validator) — on `!valid`, return its field-level `errors` (or a single fallback sentence if it returned none).
  3. On valid, reverse WP-245's mapping: `schemeId ← setup.scheme.id`, `mastermindId ← setup.mastermind.id`, the three group arrays ← `setup.{villain_groups,henchmen_groups,heroes}[].id`, `bystandersCount/woundsCount/sidekicksCount` ← the matching `setup.*_count`, **`officersCount ← setup.shield_officers_count`** (the only renamed field), `playerCount ← lagn.player_count`.
- Reads only the LAGN `setup` + `player_count`; never mutates anything; no registry lookup (ids are already set-qualified).

### B. `LoadoutBuilder.vue` "Load LAGN" control (additive)

- New reactive state mirroring the JSON importer: `lagnImportText`, `lagnImportErrors`, `lagnImportSuccessAt`.
- `applyLagnImport(text)`: call `parseLagnLoadout(text)`; on `!ok` set `lagnImportErrors` and return; on `ok` **replace** the draft — `resetDraft()` then `setScheme`/`setMastermind`/`add*` per id + `setCount` per count + `setPlayerCount`, then set the success line. (`resetDraft` first = "load this file" replaces the draft, matching `loadFromJson` semantics; `setMastermind` re-applies any Always-Leads villains, deduped.)
- `onLagnFileImport(event)` (FileReader → `applyLagnImport`) + `onLagnPasteImport()` (`applyLagnImport(lagnImportText)`).
- A `<details>` "📥 Load LAGN (paste or file)" rendered after the existing "Load JSON" details; presentation parallel to it. Never throws.

---

## User-Visible Impact

On `cards.legendary-arena.com`, the Loadout tab gains a "📥 Load LAGN (paste or file)" control beside the existing "📥 Load JSON". Uploading/pasting a LAGN file (the "⬇ Download LAGN" output) loads its loadout into the draft — pickers, validation, exports, and the WP-288 "🖼 View as cards" gallery then all work on it. A non-LAGN file shows the validator's errors. No change to any existing control.

## Vision Alignment

On-vision per **Vision §10a** (the registry viewer is a public tool for inspecting cards and building / sharing game setups). Letting a player reload a LAGN file they (or someone else) exported completes the build-and-share loop — you can hand someone a LAGN, they open it, view it as cards, and edit it. **Non-Goal proximity:** none — no monetization, identity, account-gating, PvP, scoring, RNG, or determinism surface. "Loadout" / "LAGN" framing is hero-vs-villain setup authoring (no player-interaction terminology, §23(b)). Determinism: N/A.

---

## Acceptance Criteria

1. `loadoutLagnImport.ts` exposes `parseLagnLoadout`, boardgame.io-free, returning the composition (five ext_id fields + four counts + `playerCount`) for a valid LAGN and full-sentence errors otherwise; unit-tested (**AC-1**).
2. A non-JSON string and a non-LAGN object (e.g. a MATCH-SETUP document) are both rejected with non-empty `errors`; a valid LAGN's `setup` maps field-for-field, including `shield_officers_count → officersCount` and each `group[] → ids[]` (**AC-2**).
3. The Loadout tab shows a "📥 Load LAGN (paste or file)" control; uploading/pasting a valid LAGN replaces the draft with its composition (scheme, mastermind, all villain/henchman/hero groups, the four counts, player count) and shows a success line (**AC-3**).
4. After a LAGN import, the draft's live validation, the pickers, the export buttons, and the WP-288 "🖼 View as cards" gallery all operate on the imported loadout (no regression) (**AC-4**).
5. The existing "📥 Load JSON" MATCH-SETUP importer, `loadFromJson`, `useLoadoutDraft`, `App.vue`, the WP-288 gallery, and `CardGrid` are unchanged (**AC-5**).
6. No forbidden import (`game-engine` / `server` / `dashboard` / `boardgame.io` / `scripts/`) in the new helper or `LoadoutBuilder.vue`; the helper is boardgame.io-free (grep) (**AC-6**).
7. `pnpm --filter registry-viewer typecheck` 0; `test` 0 (prior count preserved + the new helper tests); `build` 0 (no `__vite-browser-external`) (**AC-7**).

---

## Verification Steps

```bash
test -f apps/registry-viewer/src/lib/loadoutLagnImport.ts && echo OK
grep -F "parseLagnLoadout" apps/registry-viewer/src/components/LoadoutBuilder.vue && echo OK   # control wired
grep -RInE "(@legendary-arena/game-engine|apps/server|apps/dashboard|boardgame\.io|(^|/|\.\./)scripts/)" \
  apps/registry-viewer/src/lib/loadoutLagnImport.ts apps/registry-viewer/src/components/LoadoutBuilder.vue \
  && echo "FAIL: forbidden import" || echo OK
pnpm --filter registry-viewer typecheck && pnpm --filter registry-viewer test && pnpm --filter registry-viewer build
```

Live (preview against the live R2 feed): on the Loadout tab, click "⬇ Download LAGN" for a built loadout, then use the new "📥 Load LAGN" control to upload that file → the draft fills with the same composition → "🖼 View as cards" shows its cards. A MATCH-SETUP document or garbage in the LAGN box shows errors, not a partial load.

---

## Definition of Done (Binary Gate)

- [ ] `loadoutLagnImport.ts` (`parseLagnLoadout`) + tests cover non-JSON reject / non-LAGN reject / valid-LAGN extraction / group→ids + officers rename
- [ ] "📥 Load LAGN (paste or file)" control on `LoadoutBuilder.vue` drives the existing setters (resetDraft → setScheme/setMastermind/add*/setCount/setPlayerCount); error + success feedback
- [ ] No forbidden import; helper boardgame.io-free; no `useLoadoutDraft` / contract / `App.vue` / gallery / `CardGrid` change; existing "Load JSON" importer unchanged
- [ ] `typecheck` + `test` + `build` exit 0 (prior count preserved + new helper tests)
- [ ] D-24075 lands (Active); WORK_INDEX + EC_INDEX + STATUS + mindmap updated
- [ ] Commit prefix `EC-323:` for code, `SPEC:` for governance
- [x] **D-24026 live-verify** post-deploy on `cards.legendary-arena.com` (Download LAGN → Load LAGN round-trip → View as cards) — ✅ verified 2026-06-25 (deployed Loadout tab renders the "📥 Load LAGN (paste or file)" control; round-trip functionally verified against the production R2 feed pre-deploy)

---

## Lightweight-Lane Eligibility (D-24028)

**Structural (provisional):** (1) single layer — `apps/registry-viewer` only ✓; (2) 3 code/test files, no separate runtime-wiring file ✓; (3) no `01.6` trigger — the helper mirrors the existing `loadoutCardActions.ts` / `loadoutGalleryCards.ts` pattern (no new abstraction/builder/contract/wiring category) ✓; (4) no new contract file ✓; (5) one scoped D-entry (D-24075) ✓; (6) narrow UX surface (an import control) — no scoring/identity/RNG/determinism ✓.
**Empirical (confirmed at govern-close):** (7) strictly additive — no existing logic rewritten ✓; (8) zero determinism impact — viewer-only, no persistence/replay/hash ✓; (9) file budget holds at final `git diff --name-only` ✓.
**Scaffold (empirical independence):** the helper + test were prototyped and `pnpm --filter registry-viewer test` run **before** eligibility was confirmed — observed **110 pass / 0 fail** (106 baseline incl. WP-288 + 4 new), `typecheck` 0. Not a validation-tightening change (purely additive — accepts a format previously rejected), so `01.4 §Empirical Scaffold` does not strictly apply; the lane's mandatory scaffold is satisfied with this observed run.

## Decision — D-24075

Establishes that the registry viewer's Loadout tab can **import** a LAGN file (not just export one), via a separate "Load LAGN" control that validates the file with the published `@legendary-arena/lagn` validator and reverses WP-245's composition→`setup` mapping into the shared draft using the existing draft setters. Pure registry-viewer UX; consumes the existing `LAGN` type + `validate` and the `FlatCard`/composition ext_id-space (D-24018) with no draft-API, contract, LAGN-spec, or card-data change. The operator chose two explicit import controls ("Load JSON" for MATCH-SETUP, "Load LAGN" for LAGN) over a single auto-detecting importer, mirroring the two explicit export buttons.

## Lint Gate Self-Review (00.3 — all 21 sections resolved)

- §1 WP Structure — PASS: all required sections present; `## Scope (Out)` lists ≥2 excluded items.
- §2 Non-Negotiable Constraints — PASS: forbids cross-layer imports + contract/draft-API edits; references `00.6`.
- §3 Prerequisites (`## Assumes`) — PASS: WP-245 mapping, the existing MATCH-SETUP importer, the LAGN `setup` shape, the published `validate`, and the available draft setters all listed with sources.
- §4 Context References — PASS: cites viewer CLAUDE.md, the layer rule, `00.6`, `00.2 §8.1`, Vision §10a, DECISIONS, WP-245/091/244.
- §5 Output Completeness — PASS: 3 code/test files + governance, each marked new/modified with a one-line role.
- §6 Naming Consistency — PASS: canonical `schemeId`/`mastermindId`/`villainGroupIds`/`henchmanGroupIds`/`heroDeckIds`/`officersCount` per `00.2 §8.1`; descriptive full-word names (`parseLagnLoadout`, `applyLagnImport`, `LagnLoadoutComposition`).
- §7 Dependency Discipline — PASS: no new npm dependency; reuses the already-imported `@legendary-arena/lagn`.
- §8 Architectural Boundaries — PASS (Frontend): new helper + control carry no game logic, no direct R2 fetch, no `boardgame.io`; grep-gated forbidden imports. Backend / Game-Logic / Scripts sub-lists N/A.
- §9 Windows Compatibility — N/A: no shell scripts authored; verification uses `pnpm` + POSIX grep only.
- §10 Environment Variable Hygiene — N/A: no new env vars.
- §11 Authentication Clarity — N/A: no authentication touched.
- §12 Test Quality — PASS: new `node:test` coverage for `loadoutLagnImport.ts`; no boardgame.io import, no network / DB.
- §13 Commands & Verification — PASS: `## Verification Steps` uses exact `pnpm` commands; conn / R2 validate N/A.
- §14 Acceptance Criteria Quality — PASS: 7 binary, observable items naming real files / functions.
- §15 Definition of Done — PASS: binary checkboxes incl. governance + commit-prefix.
- §15.1 User-Visible Verification (D-24026) — PASS: `User-Visible Surface` declared; `## User-Visible Impact` present; DoD includes a live-on-surface verify item.
- §16 Code Style — PASS: small pure helper + JSDoc; explicit `for...of` / `if/else` (no branching `.reduce()`); `is*`/`ok` booleans; `// why:` on the officers rename, the validator-reuse, and the group-id `.map`; no barrels.
- §17 Vision Alignment — PASS: `## Vision Alignment` block present, cites §10a affirmatively + NG-proximity none; determinism line N/A.
- §18 Prose-vs-Grep — N/A: verification greps target identifier tokens (`parseLagnLoadout`), not a count-bounded literal echoed in adjacent prose.
- §19 Bridge-vs-HEAD — N/A: no repo-state-snapshot artifact authored.
- §20 Funding Surface Gate — N/A: loadout-import UX; no donate/support copy, no funding affordance.
- §21 API Catalog Update — N/A: no HTTP endpoints touched, no `apps/server/src/**` library functions added or modified.

## Lint / Pre-Flight / Copilot (lightweight lane)

**Lint (00.3): PASS** — all 21 sections resolved above; §15.1 (D-24026) + §17 (Vision) satisfied with real blocks; §20 / §21 N/A carry non-tautological reasons.

**Condensed pre-flight (01.4):** Class = Lightweight additive UX (single layer, one new pure helper + its test + one additive control in an existing component). **Dependencies complete** — WP-245 ✅ (the mapping reversed), WP-091 ✅ (the draft + existing importer), WP-244 ✅ (the published `validate` + `LAGN` type), all verified against source on `main` @ `99ff1dad`. **Cited authority on main** — the `compositionToLagnSetup` mapping, the `GameSetupSchema`, and the draft setters all read from current `main`. **Scope locked** — 3 files, additive, no contract/determinism/persistence surface. **Behavior-identity** subsumed by the scaffold (the change is additive — it accepts a format the tab previously rejected — so no existing path changes; the suite ran 110/0 with the new code present). Verdict: **READY** (lane).

**Targeted self-review (lane copilot):** eligibility confirmed with artifacts (file count, no contract file, no hash surface, scaffold output) — not argued in prose; the new control routes through existing setters (no mutation of the draft outside the public API); a non-LAGN file is rejected by the published validator (no silent partial load); inline-amendment budget unused so far. No BLOCK.

## Vision / Funding / API

**Vision:** on-vision per §10a. **Funding:** N/A. **API:** N/A — no HTTP endpoint or `apps/server` library function touched.
