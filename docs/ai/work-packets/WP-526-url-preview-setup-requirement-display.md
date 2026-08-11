# WP-526 — URL-Preview Scheme-Aware Setup-Requirement Display (registry-viewer)

**Layer:** App (registry-viewer) · **Lane:** Lightweight (single-app, additive UI; no
contract, no determinism/persistence, no new D-entry) · **Baseline:** `origin/main` @
`d41732bb` (WP-526 reservation) · **User-Visible Surface:** cards.legendary-arena.com

## Goal

A shared `?schemeId=…` deep-link on `cards.legendary-arena.com` loads a **read-only
preview** (`<LoadoutPreview>`, WP-114) whose *"Edit this loadout"* button is the only path
into the editable draft (D-114XX). The preview shows the loaded composition but **no setup
requirement** — so a shared **Secret Invasion** link (which requires 6 heroes, WP-524 /
D-24337) gave no hint of the 6-hero rule; the only requirement text on the page was the
*empty editor draft's*, which (being empty, no scheme) reported the base **5**. Reported
from a live test: a Secret Invasion link reads "needs 5 heroes" until you click Edit.

This WP surfaces the **scheme-aware setup requirement in the preview itself**, so a shared
Secret Invasion link immediately shows "6 heroes" — the preview now agrees with the builder
and the engine.

## Context (Read First)

WP-524 made the hero-count requirement scheme-aware in the registry resolver
(`resolveEffectiveHeroCount`) and the *editor draft* + engine. The **preview** surface was
never taught about it. `previewDocument` (from `useSetupFromUrl`) already carries
`playerCount` **and** `composition.schemeId`, so the fix is fully contained in the preview:
compute the effective requirement from the same registry resolver the builder uses.

**Respects the locked read-only preview-first design (D-114XX):** purely additive display,
no draft mutation, no promotion behaviour change — "Edit this loadout" stays the only path
into the editor. This is a *display* enhancement, not a change to the URL→draft flow.

**Pattern:** the requirement logic is a pure `lib/previewSetupRequirement.ts` helper (so it
is unit-testable — registry-viewer tests are plain `node:test`, no component mounting), and
`LoadoutPreview.vue` calls it in a computed. Mirrors the builder's requirement line:
*"For a N-player match: X villain groups, Y henchmen groups, Z heroes, W villain-deck
bystanders."* with a scheme-aware `Z`.

## Scope (In)

- `apps/registry-viewer/src/lib/previewSetupRequirement.ts` (new): pure
  `resolveSetupRequirement(previewDocument)` → `{ playerCount, row }` with a scheme-aware
  `row.heroCount` via `getPlayerCountSetup` + `resolveEffectiveHeroCount` (both already on
  the browser-safe `@legendary-arena/registry/playerCountSetup` subpath from WP-524); null
  for a null document or a player count outside 1–5.
- `apps/registry-viewer/src/lib/previewSetupRequirement.test.ts` (new): SI → 6 at every
  count; non-SI → base; non-hero counts unchanged; null / out-of-range → null.
- `apps/registry-viewer/src/components/LoadoutPreview.vue`: call the helper in a computed
  and render a `[data-testid="preview-setup-requirement"]` line in the preview header.

## Out of Scope

- The URL→draft promotion flow (D-114XX preview-first is unchanged; no auto-populate).
- The editor draft / builder requirement (WP-524, shipped).
- The play lobby / server projection (WP-525, shipped).
- Any registry / engine / server / contract / determinism surface.

## Files Expected to Change

| File | Change |
|---|---|
| `apps/registry-viewer/src/lib/previewSetupRequirement.ts` | new pure helper |
| `apps/registry-viewer/src/lib/previewSetupRequirement.test.ts` | new test |
| `apps/registry-viewer/src/components/LoadoutPreview.vue` | computed + requirement line |

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`STATUS.md`, `NUMBER-LEDGER.md` (reserved).

## Contract

`resolveSetupRequirement(previewDocument: MatchSetupDocument | null):
{ playerCount: number; row: PlayerCountSetupRow } | null` — pure, deterministic; `row` is a
fresh spread of the base `PLAYER_COUNT_SETUP` row with `heroCount` replaced by
`resolveEffectiveHeroCount(schemeId, playerCount, base)`. The immutable table row is never
mutated. No new D-entry — this applies D-24337 to the preview surface.

## Acceptance Criteria

1. `resolveSetupRequirement` for a Secret Invasion preview returns `row.heroCount === 6` at
   player counts 1–5; a non-Secret-Invasion scheme returns the base count (5 at 2p, 6 at 5p);
   the villain/henchmen/bystander counts are the base table values.
2. Null document → null; a player count outside 1–5 → null.
3. `LoadoutPreview.vue` renders the requirement line
   (`[data-testid="preview-setup-requirement"]`) for a valid preview, showing 6 heroes for a
   Secret Invasion deep-link.
4. registry-viewer suite green (`pnpm -r build` first — fresh-worktree dist); vue-tsc clean;
   `pnpm -r build` 0. Control-revert non-vacuous (neuter the resolver → the SI-6 test fails).

## Verification Steps

1. `pnpm -r build` (fresh worktree — apps import built dist).
2. `pnpm --filter registry-viewer test` green; `pnpm --filter registry-viewer typecheck` clean.
3. Control-revert: return `baseRow.heroCount` → the SI-6 test fails; restore.
4. `pnpm -r build` 0; `git diff --name-only` = the 3 files + governance.
5. **D-24026 live-verify (operator-pending):** a Secret Invasion deep-link on
   cards.legendary-arena.com shows "6 heroes" in the preview without clicking Edit.

## Definition of Done

- [ ] ACs met; registry-viewer suite + typecheck green; `pnpm -r build` 0.
- [ ] Control-revert non-vacuous.
- [ ] `git diff --name-only` = allowlist + governance.
- [ ] WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅` + `roadmap:counts:check` 0; STATUS.
- [ ] Two-commit topology (`EC-561:` impl + `SPEC:` govern-close), one PR.
- [ ] No new D-entry (applies D-24337); D-24026 live-verify operator-pending.

## Lint Gate Self-Review (00.3)

All 21 sections PASS or justified N/A. §3 Assumes — WP-524/D-24337 shipped
(`resolveEffectiveHeroCount` on the browser-safe subpath); `previewDocument` carries
playerCount + schemeId. §5 Files — 3-file allowlist. §8 Architecture — registry-viewer only;
pure helper; no registry/engine/server/contract/determinism surface; respects D-114XX
preview-first. §12 Test — `node:test`; non-vacuous control-revert. §17 Vision — faithful
setup display; no NG crossing. §20 N/A. §21 N/A (no endpoint). §9/§10/§11 N/A. §19 baseline
`d41732bb`. **Lightweight-lane eligibility (all hold):** single app, 3 files, additive, no
contract file, no D-entry, UX-display surface, zero determinism/persistence/scoring/identity/
monetization/RNG. **Empirical scaffold:** the helper + test were prototyped and the
registry-viewer suite run (210 pass / 0 fail after `pnpm -r build`) before this section —
observed, not reasoned.
