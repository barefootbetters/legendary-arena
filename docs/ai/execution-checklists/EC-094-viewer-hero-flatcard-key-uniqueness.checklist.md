# EC-094 — Viewer Hero FlatCard Key Uniqueness (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-094-viewer-hero-flatcard-key-uniqueness.md`
**Layer:** Client UI (`apps/registry-viewer/`)

## Before Starting

> **STOP** if any checkbox below is false.

- [ ] WP-003 merged: `FlatCard` type and `flattenSet` helper exist in
      `apps/registry-viewer/src/registry/shared.ts`.
- [ ] Baseline captured: `pnpm --filter registry-viewer build` and
      `pnpm --filter registry-viewer typecheck` both exit 0 on `main`.
- [ ] `packages/registry/src/shared.ts` hero-key line reads
      `key: \`${abbr}-hero-${hero.slug}-${card.slot}\`,` (the
      engine-consumer format that must NOT change in this packet).
- [ ] `data/cards/wwhk.json` still contains the three duplicate-slot
      hero pairs (Caiera slot 4, Miek The Unhived slot 4, Rick Jones
      slot 6). If upstream has deduplicated them, re-read WP-094 before
      proceeding.
- [ ] No parallel session is editing
      `apps/registry-viewer/src/registry/shared.ts` or `CardGrid.vue`.

## Session Abort Conditions

Immediately ABORT (do not continue coding) if any of the following
conditions are observed during execution:

- Any edit is proposed to `packages/registry/src/shared.ts`, any file
  under `packages/game-engine/**`, or any file under
  `apps/arena-client/**`.
- The hero key format change is made to a different card-type block
  (masterminds, villains, henchmen, etc.) — heroes only.
- `extractHeroSlug()` in
  `packages/game-engine/src/economy/economy.logic.ts` is referenced or
  modified.
- `card.slot` is proposed to be *removed* from the `FlatCard` — only
  its role in the key is changing; the field remains on the record.
- Any refactor, rename, or formatting churn is proposed outside the
  single hero `key:` line and its new `// why:` comment.

## Locked Values (do not re-derive)

- **Sole file modified (verbatim):**
  `apps/registry-viewer/src/registry/shared.ts`
- **Old hero key format (verbatim):**
  `` `${abbr}-hero-${hero.slug}-${card.slot}` ``
- **New hero key format (verbatim):**
  `` `${abbr}-hero-${hero.slug}-${card.slug}` ``
- **Affected hero set abbreviation (verbatim):** `wwhk`
- **Affected hero entries (verbatim):**
  - `Caiera` slot 4 — *Dutiful Protector* and *Vengeful Destructor*
  - `Miek, The Unhived` slot 4 — two cards
  - `Rick Jones` slot 6 — two cards
- **Engine consumer format (unchanged — not this packet's scope):**
  `` `${setAbbr}-hero-${heroSlug}-${slot}` `` consumed by
  `extractHeroSlug()` in
  `packages/game-engine/src/economy/economy.logic.ts`.

## Guardrails

- **Single-file scope.** Only
  `apps/registry-viewer/src/registry/shared.ts` is edited. Any staged
  file outside that path (other than governance files) is a scope
  violation.
- **Heroes block only.** The change applies to the heroes loop exactly
  once; no other card-type block is modified.
- **No packages/registry edits.** The engine-side `flattenSet` copy
  and all its consumers remain on the slot-based key format.
- **No consumer migration.** `CardGrid.vue` requires no change; it
  already consumes `card.key` opaquely. Do not "helpfully" update
  consumers.
- **No new dependencies.** No package.json changes.
- **No refactor.** The surrounding code in the heroes loop is
  untouched. Whitespace and formatting around the changed line match
  the existing file style.
- **`// why:` comment required.** A multi-line `// why:` comment
  immediately above the `key:` line documents the three affected
  heroes, the Transform-pair data pattern, and the Vue `v-for`
  stranded-DOM consequence.
- **No test file edits or additions.** The viewer has no Vue
  component-test harness; manual smoke is the verification path.

## Required `// why:` Comments

- `apps/registry-viewer/src/registry/shared.ts`, immediately above the
  hero `key:` line — explain: (a) a few heroes in `wwhk` have two
  cards sharing the same slot because one Transforms into the other
  (name: Caiera, Miek The Unhived, Rick Jones); (b) keying on slot
  produced duplicate Vue `v-for` keys and stranded DOM nodes that
  survived filtering, which caused those cards to appear to match
  every search term.

## Files to Produce

- `apps/registry-viewer/src/registry/shared.ts` — **modified** —
  hero `FlatCard.key` uses `card.slug` instead of `card.slot`; adds
  the required `// why:` comment.

## After Completing

- [ ] `pnpm --filter registry-viewer build` exits 0.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0.
- [ ] `git diff packages/registry/src/shared.ts` → no output.
- [ ] `git diff --name-only` shows only
      `apps/registry-viewer/src/registry/shared.ts` plus governance
      files (WP-094, EC-094, WORK_INDEX.md, EC_INDEX.md, DECISIONS.md).
- [ ] Manual smoke passes: search "z" in the Cards tab yields no
      Caiera/Miek/Rick Jones cards; search "caiera" yields all 5
      Caiera cards; no Vue duplicate-key warning in the browser
      console.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-094 row flipped
      `[ ]` → `[x]` with today's date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-094 row status
      set to `Done 2026-04-24`.
- [ ] `docs/ai/DECISIONS.md` updated with a D-9400-range entry
      capturing the viewer-only fix scope and the rationale for
      leaving `packages/registry/src/shared.ts` unchanged.

## Common Failure Smells

- **Symptom:** engine tests fail after the commit → likely means
  `packages/registry/src/shared.ts` was edited despite scope.
  Revert that file; keep only the viewer edit.
- **Symptom:** typecheck error in `CardGrid.vue` → likely means
  `FlatCard.key` was accidentally renamed or its type changed. The
  fix alters only the key **value**, never its type or field name.
- **Symptom:** Vue duplicate-key warning still fires after the fix →
  verify another card-type block (masterminds, villains, etc.) also
  has a duplicate-key case not covered here. If so, STOP and open a
  follow-up WP; do not in-line fix additional blocks in this packet.
