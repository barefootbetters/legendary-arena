# EC-428 — Support Presets: Save, Load, Lock (Execution Checklist)

**Source:** docs/ai/work-packets/WP-391-support-card-pools.md
**Layer:** Registry Viewer

Phase D of WP-391 — the piece that completes the original ask. Pools (EC-425)
let you define the non-hero board; a preset lets you *freeze and reuse* it, so
hero selection becomes the only variable across runs.

## Before Starting
- [ ] EC-425 (pools + picker), EC-426 (gallery toggle) and EC-427 (supply
      floors) are on `main`
- [ ] Re-read the storage decision before designing anything: **file-only**,
      set by the operator. `useLoadoutDraft.ts:6-10` declares the draft NEVER
      persists — no localStorage, sessionStorage, IndexedDB or cookies. A
      preset is a downloaded JSON file re-applied by upload. Do not add a
      storage backend "for convenience"; that invariant stands unamended
- [ ] Know the `resetDraft` hazard: `useLagnFromUrl` calls it as the FIRST HALF
      of an atomic apply (reset, then set from the imported LAGN). Anything
      that makes reset preserve state will leak the previous draft's supply
      piles into an imported game record
- [ ] `pnpm install` in the worktree; junctioned `node_modules` resolves to a
      stale `dist`
- [ ] Baseline: viewer **152 pass / 31 suites / 0 fail**

## Locked Values (do not re-derive)
- `SUPPORT_PRESET_VERSION = "1.0"`; a file declaring any other version is
  refused, not coerced
- A preset always carries **all four counts**, including kinds with no pool —
  a count-only kind is still part of the frozen board
- `locked` travels **in the file**, so a preset shared while locked arrives
  locked
- `presetId` matches `^[a-z0-9-]+$`, derived from the display name;
  `slugifyPresetName` falls back to `support-preset` rather than emitting ""

## Guardrails
- **Applying is TOTAL, never merged.** `applySupportPreset` overwrites all four
  counts and replaces the pool block wholesale; a preset with no pools CLEARS
  existing ones. A surviving leftover pool would silently change the harness —
  exactly the drift a preset exists to prevent
- **`resetDraft` stays a total reset by default.** Preservation is opt-in via
  `resetDraft({ preserveSupport: true })` and is passed ONLY by the builder's
  own Reset button, only while locked. Never change the default
- **Validate on load, not just on save.** A preset file is user-supplied and
  may be hand-edited: check the version, the presetId grammar, the pool
  mode/sets pairing (D-24194), pool-sums-equal-count, and the D-24032 supply
  floors. A rejected preset must leave the draft **untouched** — no partial apply
- The preset serializer uses a replacer ARRAY, which is a **whitelist**; every
  nested key must be listed or it vanishes from the file (the EC-425 trap)
- Locking must seal **every** edit path: the four count inputs, the set chips,
  Select all sets, the per-card copies steppers, and the per-pool Clear button
- `parseSupportPreset` must never throw — it returns a discriminated result so
  the caller renders a full-sentence error

## Required `// why:` Comments
- `SUPPORT_PRESET_VERSION`: why a file must declare what it is
- `counts` on the preset type: why count-only kinds are still recorded
- `locked` on the preset type: why the lock travels in the file
- `applySupportPreset`: why total rather than merged
- `resetDraft`'s `preserveSupport`: the `?lagn=` leak it would otherwise cause
- The serializer `keyOrder`: that an array replacer is a whitelist
- `createdAt` via wall clock: why that is acceptable here (browser authoring
  surface, descriptive metadata, nothing reads it back for behaviour)

## Files to Produce
- `apps/registry-viewer/src/lib/supportPreset.ts` — **new** — types, build,
  serialize, parse, slugify, filename
- `apps/registry-viewer/src/lib/supportPreset.test.ts` — **new** — round trip
  + rejection matrix
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — **modified** —
  `applySupportPreset`, `resetDraft(options)`
- `apps/registry-viewer/src/composables/useLoadoutDraft.test.ts` — **modified**
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** —
  preset bar (name / lock / save / load), lock enforcement, `onResetDraft`

## After Completing
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `pnpm --filter registry-viewer test` exits 0 — **170 pass** (152 + 18)
- [ ] Live-on-surface (D-24026), all verified in dev:
      lock disables counts + chips + Select all + copies and hides Clear;
      Reset keeps pools and counts while clearing the composition;
      loading a preset REPLACES pools (a prior wounds pool became "count only");
      a preset with `woundsCount: 22` is refused with the floor message and the
      draft is unchanged
- [ ] `EC_INDEX.md` flipped with date

## Common Failure Smells
- A pool survives loading a preset that has none → the apply merged instead of
  replacing
- An imported `?lagn=` game shows the previous draft's piles → `resetDraft`'s
  default changed, or `useLagnFromUrl` started passing `preserveSupport`
- A locked preset can still be edited → one of the five edit paths was missed
- A bad preset half-applies → validation runs after mutation instead of before
- Saved file is missing pools → a nested key is absent from the serializer
  whitelist
