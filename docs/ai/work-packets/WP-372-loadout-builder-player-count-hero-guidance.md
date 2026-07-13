# WP-372 — Loadout Builder: Player-Count Required Counts + Warn/Export-Gate (Registry Viewer)

**Status:** **Done 2026-07-13** (EC-401; standard two-session lane; exec worktree off `origin/main` @ `2ee41fe8`; consumes **D-24165**, no new D-entry). Baselines: `registry-viewer` typecheck (vue-tsc) 0 + test **127/0** (+4); `pnpm -r build` 0. **Packaging refinement (scope-neutral, EC-401):** WP-370 exported the table only from the **node-only root** barrel, which the viewer cannot import (breaks Vite's browser build). This WP re-exports `PLAYER_COUNT_SETUP` + `getPlayerCountSetup` + `checkPlayerCountComposition` from the **browser-safe `setupContract` barrel** (`playerCountSetup.ts` has zero node deps) — so the viewer consumes the single source of truth (no re-typed literals). **D-24026 LIVE-VERIFIED** on the worktree dev server: the Loadout tab shows the required-counts readout + per-mismatch warnings + Download disabled, reactive to the player-count input (2→4 flips the readout to 3 villain groups / 2 henchmen / 5 heroes / 8 villain-deck bystanders).
**Primary Layer:** App (`apps/registry-viewer` — cards.legendary-arena.com / cards.barefootbetters.com Loadout tab). Consumes the registry-owned table directly (`registry-viewer` may import `@legendary-arena/registry`).
**Dependencies:** **WP-370** ⛔ (`PLAYER_COUNT_SETUP` + `getPlayerCountSetup` + the `setupContract` player-count coupling); WP-091 (the loadout draft composable + the `missingRequiredVillainGroupIds` warn/block pattern this mirrors); WP-114 / WP-245 / WP-291 (the Loadout tab, setup URL params, `parseLagnLoadout`).
**User-Visible Surface:** cards.legendary-arena.com (Loadout tab) — the builder tells the user how many heroes / villain groups / henchmen / bystanders the chosen player count needs, **warns** when the draft is off, and **disables LAGN export** until it matches.

---

## Session Context

The Loadout tab (`apps/registry-viewer/src/components/LoadoutBuilder.vue` + `src/composables/useLoadoutDraft.ts`, WP-091) lets a user assemble a match loadout and export it as a LAGN. It has a **Player count (1–5)** input (`LoadoutBuilder.vue`), stored on the draft envelope (`useLoadoutDraft.ts:264`, `DEFAULT_PLAYER_COUNT = 2` at :47), but **player count drives nothing**: hero picking is free-form, and there is no "you need 5 heroes for 3 players" guidance. The only composition requirement enforced today is the mastermind's "Always Leads" villain group — `requiredVillainGroupIds` / `missingRequiredVillainGroupIds` (`useLoadoutDraft.ts:295-302, 376-383`), surfaced as a warn + block in the builder. That is the exact pattern this WP reuses for the player-count counts.

WP-370 makes `PLAYER_COUNT_SETUP` importable from `@legendary-arena/registry` and adds the player-count ↔ composition coupling to `setupContract`. This WP wires that into the builder: show the required counts for the selected player count, warn on each mismatch, and gate export on a matching draft — a warn-in-builder UX that mirrors the authoritative block WP-370/WP-371 install at the engine/server (D-24165).

---

## Goal

After this session, the Loadout builder derives the required `{ villainGroupCount, henchmenGroupCount, villainDeckBystanderCount, heroCount }` for the selected player count from `PLAYER_COUNT_SETUP` (imported from `@legendary-arena/registry`), displays them next to the composition, computes per-field mismatches (mirroring `missingRequiredVillainGroupIds`), renders full-sentence warnings for each, and **disables the LAGN export control** while any player-count composition mismatch is present — consistent with the existing "Always Leads" warn/block. Authoring stays free (a user can build an off-count draft and see exactly what's wrong); only **export** is gated. Heroes are the headline ("Select 5 heroes for 3 players — 4 selected"), with the villain-group / henchman / bystander counts shown the same way.

---

## User-Visible Impact

On the Loadout tab, changing the player count updates a "required for N players" readout (heroes, villain groups, henchmen groups, villain-deck bystanders). Picking the wrong number of heroes (or villain/henchman groups) shows a clear warning and disables Export LAGN until fixed. Today the builder gives no player-count guidance and happily exports an illegal loadout that the lobby/engine will later reject.

---

## Assumes

- **WP-370 complete:** `@legendary-arena/registry` exports `PLAYER_COUNT_SETUP` + `getPlayerCountSetup`; `setupContract` validation reports player-count ↔ composition-length mismatches as structured errors on a matching-envelope-passes basis.
- **Loadout draft (WP-091):** `useLoadoutDraft.ts` exposes `draft.playerCount`, `setPlayerCount` (:315, :458), the composition arrays, and the `requiredVillainGroupIds` / `missingRequiredVillainGroupIds` computed pattern (:295-302, :376-383) + how `LoadoutBuilder.vue` renders those warnings and gates the required-villain case.
- **Export control:** `LoadoutBuilder.vue` has a LAGN export affordance already gated on the existing validity (incl. `missingRequiredVillainGroupIds`); the player-count mismatch joins that same disable condition.
- **registry-viewer may import registry:** it already imports `@legendary-arena/registry/setupContract` + `/schema`; importing the table is in-boundary. It must **not** import `game-engine`.
- **Baseline:** captured at execution-prep off `origin/main` (post-WP-370). `registry-viewer` build + typecheck (vue-tsc) + test green.
- No new D-entry — consumes D-24165.

If WP-370 is not merged, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — read `requiredVillainGroupIds` / `missingRequiredVillainGroupIds` (:376-383) end to end; the new player-count computeds mirror it exactly (a `computed` per required count + a `computed` mismatch list). Read `setPlayerCount` (:458) — the counts recompute reactively when it changes; nothing is auto-filled (heroes are chosen by identity, not a number the app can pick).
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — read where `missingRequiredVillainGroupIds` renders a warning and where the export control's disabled state is bound; the player-count warnings render alongside, and the export-disable condition gains the player-count mismatch.
- `docs/ai/ARCHITECTURE.md §Layer Boundary` — `registry-viewer` imports `registry`, never `game-engine`; confirm the table import path is `@legendary-arena/registry` (or the subpath WP-370 exposes).
- `docs/ai/DECISIONS.md` — D-24165 (the enforcement model: **warn in builder, block at engine/server** — this WP is the "warn" half; it must **not** hard-block authoring, only export).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 11 (full-sentence warnings), Rule 4 (naming), Rule 8 (no branching `.reduce()`).

---

## Non-Negotiable Constraints

- **Warn, don't block authoring.** A user may hold an off-count draft and keep editing; the builder shows what's wrong. Only the **LAGN export** control is disabled while a player-count mismatch is present (mirrors the `missingRequiredVillainGroupIds` gate — the same control, an added condition).
- **One source of truth.** Required counts come from `PLAYER_COUNT_SETUP` (imported), never re-typed in the viewer. No literal 3/5/5/5/6 etc. in `registry-viewer` source.
- **Heroes are chosen, not auto-filled.** The builder shows the required hero **count** and whether the draft meets it; it does not auto-pick heroes (identity is the user's choice). Villain-group / henchman counts likewise: guidance + warn, no auto-fill.
- **No `game-engine` import.** `registry-viewer` imports only `registry` (+ UI framework). Any `@legendary-arena/game-engine` import is a FAIL.
- **Villain-deck bystanders shown for guidance only.** The builder displays the required villain-deck bystander count for the player count (from the table) as information; whether the builder's own bystander field maps to that concept follows the existing `setupContract` semantics — do not invent a new field. (The authoritative bystander sizing is WP-370's engine change; the builder surfaces the table value as guidance.)
- ESM; `.test.ts`; full-file outputs; human-style code; no branching `.reduce()`.

---

## Scope (In)

### A) Required-count computeds (`apps/registry-viewer/src/composables/useLoadoutDraft.ts` — modified)
- Add computeds derived from `getPlayerCountSetup(draft.playerCount)`: `requiredHeroCount`, `requiredVillainGroupCount`, `requiredHenchmenGroupCount`, `requiredVillainDeckBystanderCount`, and a `playerCountCompositionMismatches` computed (a list of `{ field, required, actual }` for each of villain groups / henchmen / heroes that disagrees) — the `missingRequiredVillainGroupIds` pattern generalized. Reactive to `setPlayerCount` and composition edits.

### B) Builder UI (`apps/registry-viewer/src/components/LoadoutBuilder.vue` — modified)
- Render a "required for N players" readout (heroes / villain groups / henchmen / villain-deck bystanders) near the player-count input. Render a full-sentence warning per entry in `playerCountCompositionMismatches` (alongside the existing required-villain warning). Add the mismatch presence to the LAGN export control's `disabled` condition.

### C) Tests (`apps/registry-viewer/src/**/*.test.ts` — modified/new)
- The required computeds return the table values per player count; `playerCountCompositionMismatches` flags a wrong hero / villain-group / henchman count and clears when matched; export is disabled while a mismatch is present and enabled when the draft matches (and the existing required-villain gate is satisfied); changing player count recomputes.

---

## Out of Scope

- **The table + engine block + villain-deck fix** — WP-370.
- **The server create-gate + lobby surface** — WP-371.
- **Auto-selecting heroes / villain groups** — guidance + warn only; identity is the user's choice.
- **A new bystander/composition field or schema change** — reuses existing draft fields + `setupContract`.
- **"What If…?" variant / game modes.**
- **Hard-blocking authoring** — only export is gated.
- Refactors outside Scope (In).

---

## Files Expected to Change

- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — **modified** — required-count + mismatch computeds
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — required-count readout + warnings + export-disable
- `apps/registry-viewer/src/**/*.test.ts` — **modified/new** — computed + gate tests
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (no new D — cites D-24165), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` + counts — **modified** — governance close

No other files. Run `registry-viewer` build + typecheck + test and `pnpm roadmap:counts:check` before pushing.

---

## Vision Alignment

- **Clauses:** §1/§2 (faithful setup — correct per-player counts guide the loadout), §3 (trust — the builder stops you exporting an illegal loadout).
- **Conflict:** none — authoring guidance; no NG-1 surface. Export gating is a correctness aid, not a monetization gate.
- **Non-Goal proximity:** not triggered.

## Funding Surface Gate

N/A — Loadout builder UX; no funding affordances/copy/channels.

## API Catalog (00.3 §21)

N/A — `registry-viewer` client only; no `apps/server` endpoint or catalog-recorded library function touched.

---

## Acceptance Criteria

- [ ] The builder shows the required hero / villain-group / henchman / villain-deck-bystander counts for the selected player count, sourced from `PLAYER_COUNT_SETUP` (no re-typed literals in `registry-viewer`).
- [ ] A wrong hero / villain-group / henchman count renders a full-sentence warning; the warnings clear when the draft matches; changing player count recomputes.
- [ ] LAGN export is disabled while a player-count mismatch is present and enabled when the draft matches (and the existing required-villain gate passes). Authoring is never blocked.
- [ ] `registry-viewer` imports no `@legendary-arena/game-engine` (`git grep` empty); the table import is from `@legendary-arena/registry`.
- [ ] `registry-viewer` build + typecheck (vue-tsc) + test green at baseline + new tests; no files outside the allowlist changed.

---

## Verification Steps

```pwsh
pnpm --filter registry-viewer build
pnpm --filter registry-viewer typecheck
pnpm --filter registry-viewer test
git grep "@legendary-arena/game-engine" apps/registry-viewer/src   # expect: no output
git grep -nE "heroCount|villainGroupCount" apps/registry-viewer/src   # only reads of the imported table field, no re-typed 3/5/5/5/6 literals
pnpm roadmap:counts:check
git diff --name-only origin/main   # only ## Files Expected to Change
```

---

## Definition of Done

- [ ] **User-visible verification (surface = cards.legendary-arena.com Loadout tab):** D-24026 operator-pending on deploy — set player count to 3, pick 4 heroes → "Select 5 heroes for 3 players" warning + Export disabled; pick the 5th → warning clears, Export enabled.
- [ ] All acceptance criteria pass.
- [ ] `registry-viewer` build + typecheck + test green; no `game-engine` import; no re-typed count literals.
- [ ] No files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/work-packets/WORK_INDEX.md` WP-372 checked off; mindmap node + `roadmap:counts --write` regenerated in the close commit. (No new D-entry — cites D-24165.)

---

## Lint Gate Self-Review & Gate Verdicts

Recorded in the drafting SPEC commit body (current SPEC-draft convention). Summary: 21/21 resolved (PASS); pre-flight **NOT READY — BLOCKED on WP-370** (needs the table + `setupContract` coupling on `main`); copilot **PASS** (warn-not-block authoring confirmed; single-source-of-truth held; no engine import; export-gate mirrors the existing required-villain gate). WORK_INDEX row carries `blocked: WP-370` until WP-370 merges; pre-flight re-runs to READY at execution-prep.
