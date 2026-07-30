# WP-458 — Collapse Approved Gauntlet Loadouts to One Canonical Configuration (Variant 0)

**User-Visible Surface:** `legends.legendary-arena.com` (and the derived
qualification behavior). After this WP, each mastermind gauntlet offers **one**
approved villain/henchmen configuration per player count — **variant 0**, the one
the challenge links, pack import, and pre-play badge already default to — instead
of a menu of three. The **only** ranked-qualification variable becomes the
**heroes**. Casual play is unchanged (free selection). **D-24026
live-verification applies** (operator-pending on deploy).

## Goal

Collapse the approved-loadout menu from **three** configurations per mastermind
to **one** (variant 0), so a ranked gauntlet leg qualifies only when it uses that
single canonical villain/henchmen composition for its player count — making
heroes the sole competitive variable. This is a one-lever change to the loadout
**generator** (`VARIANTS_PER_MASTERMIND = 3 → 1`) plus a **regeneration** of the
committed data and the tests/comments that assert "three." It supersedes the
WP-395/D-24199 "menu of three" choice.

**Why now (zero migration cost).** `legendary.competitive_scores` is empty in
production, so dropping variants 1 and 2 re-keys and invalidates **no** scores.
The day the first ranked score lands, this collapse would start voiding runs on
the retired variants — so this is the cheapest moment it will ever have.

**Why one, not three.** A ranked leaderboard is a fair time-trial: comparing two
players requires the same course. Three approved courses per leg fragment the
competition three ways (villains are part of `ScenarioKey`) without adding
strategic depth — an optimizer converges on whichever is easiest, splitting the
board. One config concentrates scores (denser boards, faster PAR calibration —
~2,118 scenarios instead of ~6,354) and gives a legible "same fight, your heroes"
format. **The choice removed is not the fun choice — the heroes are.**

## Assumes

- **On `origin/main` @ `4e0f3261`** (drafting baseline). `packages/registry` and
  `apps/server` build/test/typecheck green; `pnpm gauntlet:loadouts:check` green.
- **The generator's variant count is a single constant.**
  `scripts/generate-gauntlet-loadouts.mjs:61` `const VARIANTS_PER_MASTERMIND = 3`
  drives the variant loop (`:265-267`) and the write-count log (`:427`); variant
  0 is `pickByRotation(..., rotationOffset 0)` — the canonical, printed-anchor
  fill. Setting it to `1` emits variant 0 only. (Source: the file on `main`.)
- **The consumers iterate `variants` / approved configs generically** and work
  with a one-element menu: `getGauntletLoadoutMenu`, `buildVillainSegment`,
  `buildHenchmanKey`, the server's `matchesApprovedLoadout` (checks "matches ONE
  approved config" — now there is one), the legends board's `selectApprovedLoadout`
  (`approvedForCount[0]`) + `buildGauntletDetails` (WP-456) + `buildRowChallengeUrl`
  (WP-457), and the WP-444 pack import (defaults variant 0). None hard-codes "3".
  (Source: the files on `main`.)
- **The 3-variant assumption lives in four named places** to update: the
  generator constant + its comments (`:26`, `:58-60`, `:122`, `:199`);
  `packages/registry/src/gauntletLoadouts.test.ts` (`VARIANTS_PER_MASTERMIND = 3`
  `:19`, the "exactly three variants" test `:21`, and the "three variants are
  distinct" test `:94` — the latter guards a property that no longer exists at one
  variant); comments in `gauntletLoadouts.ts:30` +
  `apps/server/src/legends/gauntlet.logic.ts:31,130`; and the legends-board
  `gauntletDisplay.ts:330-333` `selectApprovedLoadout` JSDoc. All are comment/test
  edits — no runtime consumer hard-codes "3" (every qualification test injects its
  own fixture, not the generated menu, so the collapse breaks none). (Source:
  `grep` on `main`; confirmed by the drafting gates.)
- **`pnpm gauntlet:loadouts:check`** regenerates and diffs against the committed
  `gauntletLoadouts.generated.ts`, so regenerating with the new constant and
  committing the result keeps the CI gate green. (Source: `package.json` +
  `generate-gauntlet-loadouts.mjs --check` on `main`.)

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24199** (the current "menu of three" this WP
  supersedes), D-24187 (fixed-hero-pool division), D-24131 (gauntlet legs). This
  WP reserves **D-24278** and records D-24199 as superseded-in-part (menu size
  three → one) while its core rule (ranked legs require an approved loadout;
  casual stays free) is unchanged.
- `.claude/rules/architecture.md` + `.claude/skills/legendary-registry` — the
  Registry layer owns the loadout data; the generator is registry tooling. The
  only `apps/server` touch is **comment-only** (correcting the now-stale "three
  configurations" prose the D-24199 decision seeded) — no server behavior change.
- `.claude/rules/code-style.md` — canonical readonly arrays / union drift, ESM,
  `node:test`, `// why:` comments; the generated file is machine-written (never
  hand-edited).
- `scripts/generate-gauntlet-loadouts.mjs` — the sole writer of the generated
  menu; `pickByRotation` variant 0 is the canonical composition.
- `apps/server/src/legends/gauntletTruth.logic.ts` `matchesApprovedLoadout` —
  qualification now compares against the single approved config (no logic change;
  the approved-config array simply has length 1).

## Scope (In)

- **`scripts/generate-gauntlet-loadouts.mjs`** (modified): `VARIANTS_PER_MASTERMIND
  = 3` → `1`; update the header/why comments (`:26`, `:58-60`) from "three
  variants … one canonical loadout would dictate the game" to reflect the
  D-24278 decision that one canonical loadout **is** the ranked configuration
  (heroes are the variable; casual stays free).
- **`packages/registry/src/gauntletLoadouts.generated.ts`** (regenerated): 110
  mastermind menus × **1** variant (was × 3). Machine-written via
  `pnpm gauntlet:loadouts` — do not hand-edit.
- **`packages/registry/src/gauntletLoadouts.test.ts`** (modified):
  `VARIANTS_PER_MASTERMIND = 3` → `1`; the "exactly three variants" test → "exactly
  one variant"; **remove** the "three variants are distinct at every player count"
  test (`:94`) — the property it guards no longer exists with one variant. The
  composition **shape/size** tests (villain/henchmen counts per player count) stay.
- **`packages/registry/src/gauntletLoadouts.ts`** (modified, comment-only):
  `:30` "One of the three approved configurations" → "The approved configuration".
- **`apps/server/src/legends/gauntlet.logic.ts`** (modified, **comment-only**):
  `:31` "one of three approved" and `:130` "the three configurations D-24199
  settled on" → the single-approved-configuration wording (corrects doc-drift this
  change causes; **no** server behavior/code change).
- **`apps/legends-board/src/panels/gauntletDisplay.ts`** (modified,
  **comment-only**): the `selectApprovedLoadout` JSDoc (`:330-333`) "the menu
  offers three configurations … the board itself lists all three, so the player
  keeps the choice the menu preserves" → the single-configuration wording (the
  same doc-drift class this WP scrubs elsewhere, on the shipped legends surface;
  **no** code change — `selectApprovedLoadout` returns `approvedForCount[0]`,
  which now has one entry). Folded in per all three drafting gates.
- **Also within `scripts/generate-gauntlet-loadouts.mjs`** (already in scope):
  correct the remaining "three variants" comments at `:26`, `:122` (`pickByRotation`),
  and `:199` (`buildLoadoutMenus`), not only `:58-60`.
- **`docs/ai/DECISIONS.md`** — reserve **D-24278** (the 3→1 collapse).

## Out of Scope

- **No qualification-logic change** — `matchesApprovedLoadout` and the truth
  helper are untouched; they already compare against "an approved config," and
  there is now one. No migration (competitive_scores is empty).
- **No casual-play change** — free selection is unaffected (this governs ranked
  qualification only, per D-24199's original scope).
- **No consumer-surface code change** — the legends board (challenge links,
  details reveal, pack download), the cards builder pack import (WP-444), and the
  WP-454 badge already default to / iterate variant 0; they adapt to a
  one-element menu with **no** edit. (The reveal's *layout* is a separate
  paired WP.)
- **No `ScenarioKey` / `henchman_key` shape change; no PAR calibration** — this
  only shrinks the scenario count that future PAR work will calibrate.
- **No per-mastermind hand-curation** — variant 0 (the generator's canonical
  rotation) is the collapse target for all 110 masterminds uniformly.

## Files Expected to Change

- `scripts/generate-gauntlet-loadouts.mjs` — **modified** — `VARIANTS_PER_MASTERMIND
  1` + comments.
- `packages/registry/src/gauntletLoadouts.generated.ts` — **regenerated** — 110 × 1.
- `packages/registry/src/gauntletLoadouts.test.ts` — **modified** — one-variant
  assertions; remove the distinctness test.
- `packages/registry/src/gauntletLoadouts.ts` — **modified (comment-only)**.
- `apps/server/src/legends/gauntlet.logic.ts` — **modified (comment-only)**.
- `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified (comment-only)**
  — the stale `selectApprovedLoadout` "three configurations" JSDoc.
- `docs/ai/DECISIONS.md` — **D-24278** (drafted at draft; Active at execution).

## Contract

> **Output contract (execution):**
> - Regenerate the generated file with `pnpm gauntlet:loadouts` — never hand-edit
>   it. `pnpm gauntlet:loadouts:check` MUST pass (regen == committed).
> - ESM, Node v22+, human-style code; the generated file is machine output.
> - The only `apps/server` edit is comment-only (no behavior change).

**Locked values (do not re-derive):**

- **`VARIANTS_PER_MASTERMIND = 1`** — the single lever. Variant 0 (rotation offset
  0) is the retained canonical configuration.
- **Menu shape unchanged** — `GauntletLoadoutMenu.variants` stays a
  `readonly GauntletLoadoutVariant[]`; it now has length 1. `variantIndex` for the
  retained variant is `0`.
- **Regeneration is authoritative** — the committed `gauntletLoadouts.generated.ts`
  is exactly `pnpm gauntlet:loadouts` output; CI `:check` enforces it.
- **Ranked-only** — casual play free selection is untouched; qualification logic
  is untouched (one approved config instead of three).

## Acceptance Criteria

- [ ] `scripts/generate-gauntlet-loadouts.mjs` `VARIANTS_PER_MASTERMIND === 1`.
- [ ] `pnpm gauntlet:loadouts` regenerates `gauntletLoadouts.generated.ts` to 110
      menus, each with exactly **1** variant (`variantIndex 0`);
      `pnpm gauntlet:loadouts:check` exits 0.
- [ ] `gauntletLoadouts.test.ts` asserts exactly one variant per menu; the
      distinctness test is removed; the composition shape/size tests still pass.
- [ ] The retained variant-0 compositions are byte-identical to the pre-collapse
      variant-0 (the collapse only drops variants 1 and 2, it does not alter
      variant 0) — spot-check e.g. `core/magneto` 2p villains =
      `[core/brotherhood, core/enemies-of-asgard]`, henchmen = `[core/doombot-legion]`.
- [ ] Server + registry comments no longer say "three configurations."
- [ ] `pnpm -r build` + `pnpm -r --no-bail test` green (registry + server suites,
      including `matchesApprovedLoadout` / gauntlet standings, still pass with a
      one-variant menu).
- [ ] No file outside the list is modified.

## Verification Steps

```bash
pnpm gauntlet:loadouts && pnpm gauntlet:loadouts:check   # regen + gate green
pnpm -r build
pnpm --filter @legendary-arena/registry test             # one-variant menu tests
pnpm --filter @legendary-arena/server test               # qualification unaffected
git diff --stat packages/registry/src/gauntletLoadouts.generated.ts  # 3→1 shrink
# Confirm variant 0 is unchanged (only variants 1/2 removed):
grep -A6 "mastermindSlug: 'magneto'" packages/registry/src/gauntletLoadouts.generated.ts | head
# Deployed smoke (D-24026): legends.legendary-arena.com Magneto "Show details" now
# lists ONE approved config per player count (2p = Brotherhood, Enemies Of Asgard
# / Doombot Legion), and the challenge link opens that single approved loadout.
```

## Vision Alignment

**Vision clauses:** §20–26 (Scoring/PAR/leaderboards — a fair fixed-course ranked
format), §10 (Legends board). No identity / monetization / RNG / determinism /
persistence surface. **Conflict assertion:** *No conflict.* The ranked
qualification rule (D-24199) is preserved; only its menu size shrinks 3→1, which
this WP (D-24278) supersedes. Casual play, scoring math, and `ScenarioKey` shape
are unchanged. **NG check:** none — free, account-less, no paid/pay-to-win surface
(it *removes* an adversary choice from ranked, leaving heroes; no monetization).

## Definition of Done

- [ ] All Acceptance Criteria pass; `pnpm gauntlet:loadouts:check`, `pnpm -r build`,
      registry + server suites green.
- [ ] **D-24026 live-verify (operator-pending):** deployed legends Magneto "Show
      details" lists one config per count; challenge link pins it.
- [ ] `docs/ai/STATUS.md` updated (ranked adversaries collapsed to one; heroes the
      only variable).
- [ ] `docs/ai/DECISIONS.md` **D-24278** Drafted → Active; D-24199 annotated as
      menu-size-superseded (core rule intact).
- [ ] `WORK_INDEX.md` row checked off; `ROADMAP-MINDMAP.md` `📝`→`✅` +
      `pnpm roadmap:counts:write` (`:check` 0); `EC_INDEX.md` EC-493 → Done.
- [ ] No files outside the list modified.

---

## Gate Verdicts (drafting session)

All three gates ran as independent subagents against the frozen WP-458/EC-493.

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE**

- Single lever confirmed: `VARIANTS_PER_MASTERMIND = 3` (`:61`) drives the variant
  loop; variant 0 is `pickByRotation(...,0)`; the write-count log self-corrects.
- **Key risk hunted and NOT found:** no downstream test/consumer hard-fails at 1
  variant. The **only** test that reads the generated `GAUNTLET_LOADOUT_MENUS` is
  `gauntletLoadouts.test.ts` (this WP updates it); every qualification test
  (`gauntletQualificationCheck.test.ts`, `loadoutGauntletPackImport.test.ts`,
  server `gauntlet.logic.test.ts`, `gauntletRunProgress.logic.test.ts`) injects
  its **own** fixture menu, independent of the constant. `matchesApprovedLoadout`
  + `selectApprovedLoadout` (`[0]`) + `server.mjs` wiring iterate generically.
- Distinctness test (`:94`) is genuinely N/A at 1 variant (trivially passes) →
  removal is correct. Comment-only server touch defensible. Zero migration
  (competitive_scores empty; nothing persists menu size).

### Copilot Check (`01.7`) — verdict: **RISK (fixes folded; scope-neutral)**

Convergent finding across all three gates, folded in before recording:
- **Fourth stale "three configurations" comment** on the shipped legends surface —
  `apps/legends-board/src/panels/gauntletDisplay.ts:330-333` (`selectApprovedLoadout`
  JSDoc). It's the same doc-drift class the WP already scrubs; the closed file-set
  would have forbidden fixing it. → **Added as a comment-only 7th file** (code
  unchanged); `## Assumes` corrected "three named places" → "four".
- **Two more in-scope generator comments** (`:122`, `:199`) named alongside `:26`.
- **Shared-branch scope lock** noted in the EC (only WP-458's files in the WP-458
  execution commit).
- Confirmed PASS otherwise: regenerated-artifact discipline (regenerate, never
  hand-edit; `:check` normalizes CRLF→LF so no EOL churn); no unlisted breakage;
  D-24278 supersedes D-24199 **menu-size only** (core rule + casual free intact).

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

§5 file list matches the EC allowlist (now 7 files); §6 names verified against
source; §8 registry-owns-data + comment-only cross-file touches; §12 the
distinctness-test removal is sound and the shape/size tests are preserved (no
vacuous pass — "exactly one" still fails an empty list); §15.1 D-24026 a genuine
deployed smoke; §17 "No conflict" sound (no §20–26 clause mandates three configs —
that was D-24199, a decision; one fixed course *strengthens* the fair-time-trial
model). `## Contract` alias accepted per WP-454..457 precedent.
