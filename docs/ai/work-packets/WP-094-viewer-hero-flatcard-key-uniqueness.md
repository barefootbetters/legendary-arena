# WP-094 — Viewer Hero FlatCard Key Uniqueness

**Status:** Ready (drafted 2026-04-24; scope single-file bug fix)
**Primary Layer:** Client UI (`apps/registry-viewer/`)
**Dependencies:** WP-003 (CardRegistry + `FlatCard` type), WP-086 (registry
viewer card-types upgrade — compatible, not a hard dependency).
Independent of the packages/registry `flattenSet` contract; does **not**
modify `packages/registry/**`.

---

## Session Context

The public registry viewer at `cards.barefootbetters.com` was exhibiting a
user-visible search bug: three hero cards from the World War Hulk
(`wwhk`) set — Caiera's *Vengeful Destructor*, Miek The Unhived's fourth
slot, and Rick Jones' sixth slot — appeared in the card grid for **every**
search term, even unrelated ones. A Vue DevTools console warning about
duplicate `v-for` keys confirmed the root cause.

The viewer's local `flattenSet` helper in
`apps/registry-viewer/src/registry/shared.ts` builds each hero
`FlatCard.key` from `${abbr}-hero-${hero.slug}-${card.slot}`. Three heroes
in the `wwhk` set have **two cards sharing the same `slot`** because one
card Transforms into the other (e.g., *Dutiful Protector* (slot 4) →
*Vengeful Destructor* (slot 4)). This produces two `FlatCard` entries
with identical `key`. Vue's keyed `v-for` reconciliation — used by
`CardGrid.vue` — treats the duplicate-keyed entries as a single identity,
so one of the two DOM nodes is stranded: it survives in the grid after
filter updates that should have removed it, creating the "always matches
every search" symptom.

The packages/registry copy of `flattenSet` produces the same duplicate
key but is left untouched in this WP — the engine's
`extractHeroSlug()` consumer in
`packages/game-engine/src/economy/economy.logic.ts` depends on the
`{setAbbr}-hero-{heroSlug}-{slot}` suffix shape to parse hero slugs by
last-dash. Changing the packages/registry key format would be a
cross-layer contract change requiring consumer migration; that work is
explicitly **out of scope** for this packet and is tracked as a future
follow-up if warranted.

The viewer's local `flattenSet` does not feed the engine; its only
consumer is `CardGrid.vue` in the same app. Fixing the viewer copy in
isolation is therefore safe and fully resolves the user-visible bug
without touching any engine contract.

---

## Goal

After this session:

- `apps/registry-viewer/src/registry/shared.ts` produces a unique
  `FlatCard.key` for every hero card, including cards that share a
  `slot` with another card on the same hero.
- The `cards.barefootbetters.com` search grid renders each hero card
  exactly once per flattened entry, with no stranded DOM nodes when the
  filter excludes them.
- The `packages/registry/src/shared.ts` copy of `flattenSet` is
  **unchanged**; its consumers (engine `extractHeroSlug`, test
  fixtures, replay-producer) continue to rely on the existing
  `{setAbbr}-hero-{heroSlug}-{slot}` format.

---

## Assumes

- WP-003 complete: `FlatCard` type includes a `key: string` field and
  `apps/registry-viewer/src/registry/shared.ts` exports `flattenSet`.
- The file at `apps/registry-viewer/src/registry/shared.ts` is locally
  owned by `apps/registry-viewer` and is **not** re-exported from
  `packages/registry`.
- `CardGrid.vue` renders cards via `v-for` keyed on `card.key`.
- The three affected heroes (Caiera / Miek The Unhived / Rick Jones)
  exist in `data/cards/wwhk.json` with duplicate-slot hero cards; no
  other set exhibits the pattern as of 2026-04-24.
- `pnpm --filter registry-viewer build` exits 0 on `main` pre-session.
- `pnpm --filter registry-viewer typecheck` exits 0 on `main`
  pre-session.

---

## Context (Read First)

- `apps/registry-viewer/CLAUDE.md` — app architecture, tech stack
  (Vue 3 + Vite 5 + Zod), single-page tab switching, R2 data source.
- `apps/registry-viewer/src/registry/shared.ts` — the `flattenSet`
  helper that must be modified. Heroes block is the only code path
  touched.
- `apps/registry-viewer/src/components/CardGrid.vue` — the Vue
  component whose `v-for` consumes the `FlatCard.key`; no change
  needed, but confirms consumer relies on key uniqueness.
- `packages/registry/src/shared.ts` — sibling `flattenSet` in the
  registry package. **Do not modify.** Its key format is consumed by
  `extractHeroSlug` in the engine's economy logic.
- `packages/game-engine/src/economy/economy.logic.ts` (`extractHeroSlug`)
  — reads why the packages/registry copy cannot be fixed in lockstep
  without a cross-layer migration.
- `data/cards/wwhk.json` — confirms the three duplicate-slot hero
  pairs drive the bug:
  - Caiera slot 4: *Dutiful Protector* / *Vengeful Destructor*
  - Miek The Unhived slot 4: two cards
  - Rick Jones slot 6: two cards

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- ESM only, Node v22+
- `node:` prefix on Node built-ins (not applicable — browser code)
- Never use `Math.random()` (not applicable — no randomness in scope)
- No new npm dependencies

**Packet-specific:**
- **Sole file modified:** `apps/registry-viewer/src/registry/shared.ts`.
  No other file may be edited.
- **Heroes block only.** Masterminds, villains, henchmen, schemes,
  bystanders, wounds, and other card types are untouched.
- **No packages/registry changes.** The engine-side key format and
  consumer contract (`extractHeroSlug`) remain frozen.
- **Key format change (verbatim):**
  from `${abbr}-hero-${hero.slug}-${card.slot}`
  to   `${abbr}-hero-${hero.slug}-${card.slug}`
- **Required `// why:` comment** on the new key line explaining the
  duplicate-slot root cause, naming the three affected heroes
  (Caiera, Miek The Unhived, Rick Jones), and explaining the Vue
  `v-for` stranded-DOM consequence.
- **No refactor, no cleanup, no formatting churn** elsewhere in the
  file. Adjacent code paths are untouched.

---

## Vision Alignment

Vision clauses touched: §10a (Registry Viewer public surface — search
and browse quality), NG-1..7 (monetization proximity — none crossed;
this is a bug fix on free public tooling).

Conflict assertion: no conflict. The fix restores intended search
behavior; it does not introduce new UX, new data, or new surfaces.

---

## Scope (In)

- **`apps/registry-viewer/src/registry/shared.ts`** — modified:
  - In the Heroes loop (`for (const hero of set.heroes) { for (const
    card of hero.cards) { ... } }`), change the `key` field on the
    pushed `FlatCard` from `${abbr}-hero-${hero.slug}-${card.slot}` to
    `${abbr}-hero-${hero.slug}-${card.slug}`.
  - Add a multi-line `// why:` comment immediately above the `key`
    field documenting: the three affected heroes, the Transform-pair
    data pattern, the Vue `v-for` stranded-DOM consequence, and the
    deliberate divergence from `packages/registry/src/shared.ts` (which
    keeps slot-based keys for engine consumer compatibility).

---

## Out of Scope

- No changes to `packages/registry/**` — the engine consumer's
  contract is preserved.
- No migration of `extractHeroSlug` in
  `packages/game-engine/src/economy/economy.logic.ts`. If a future WP
  harmonizes the two `flattenSet` copies, that WP must include the
  consumer migration in its scope.
- No changes to card source data under `data/cards/**`. The upstream
  fix (deduplicating slots in the raw JSON) belongs to the
  modern-master-strike repository pipeline, not this packet.
- No new tests. The viewer has no Vue-component test harness
  configured; introducing one is a separate WP. Verification is
  manual smoke + build + typecheck.
- No refactor of `flattenSet`'s other card-type blocks.
- No changes to `CardGrid.vue` or any Vue component.

---

## Files Expected to Change

- `apps/registry-viewer/src/registry/shared.ts` — **modified** — hero
  `FlatCard.key` uses `card.slug` instead of `card.slot`; adds a
  `// why:` comment documenting the duplicate-slot root cause.

No other files may be modified.

---

## Acceptance Criteria

- [ ] `apps/registry-viewer/src/registry/shared.ts` hero-key line
      reads `key:         \`${abbr}-hero-${hero.slug}-${card.slug}\`,`
- [ ] A multi-line `// why:` comment immediately precedes the key
      line, naming Caiera, Miek The Unhived, and Rick Jones and
      explaining the Vue `v-for` stranded-DOM consequence.
- [ ] `packages/registry/src/shared.ts` is **unchanged** (confirmed
      with `git diff packages/registry/src/shared.ts` → no output).
- [ ] No files outside `apps/registry-viewer/src/registry/shared.ts`
      are modified under `packages/**` or `apps/**`.
- [ ] `pnpm --filter registry-viewer build` exits 0.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0.

---

## Verification Steps

```pwsh
# 1. Build + typecheck the viewer
pnpm --filter registry-viewer build
pnpm --filter registry-viewer typecheck

# 2. Confirm the key format changed exactly once
Select-String -Path "apps\registry-viewer\src\registry\shared.ts" -Pattern "abbr.*-hero-.*hero\.slug.*card\.(slot|slug)"
# Expected: exactly one match, and it uses card.slug (not card.slot)

# 3. Confirm packages/registry is untouched
git diff packages/registry/src/shared.ts
# Expected: no output

# 4. Confirm scope
git diff --name-only
# Expected: apps/registry-viewer/src/registry/shared.ts (plus governance
# files: the WP, the EC, WORK_INDEX.md, EC_INDEX.md)

# 5. Manual smoke
# Terminal: pnpm --filter registry-viewer dev
# Open http://localhost:5173
# 1. Type "z" in the Cards search box — confirm no Caiera / Miek /
#    Rick Jones hero cards appear.
# 2. Type "caiera" — confirm all 5 Caiera cards appear (including both
#    slot-4 entries: Dutiful Protector and Vengeful Destructor).
# 3. Clear the search — confirm the grid returns to the full card list
#    without duplicate renders.
# 4. Open the browser DevTools console — confirm no "Duplicate keys
#    detected" Vue warning on initial render or on search.
```

---

## Definition of Done

- [ ] All acceptance criteria pass.
- [ ] Manual smoke (Verification Step 5) passes end-to-end.
- [ ] No Vue "Duplicate keys detected" warning in the browser console.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-094 registered and
      checked off with today's date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-094 registered
      with status `Done` and today's date.
- [ ] Commit uses `EC-094:` prefix per
      `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`.
- [ ] `docs/ai/DECISIONS.md` updated with a D-9400-range entry
      recording: (a) viewer-only fix scope, (b) rationale for leaving
      `packages/registry/src/shared.ts` on the slot-based key format
      (engine consumer `extractHeroSlug` contract), and
      (c) follow-up path if the two copies are later harmonized.
