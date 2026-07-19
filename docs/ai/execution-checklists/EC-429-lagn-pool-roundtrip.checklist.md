# EC-429 — Support Pools Through Share Links (Execution Checklist)

**Source:** docs/ai/work-packets/WP-391-support-card-pools.md
**Layer:** Registry Viewer

Phase E of WP-391. Closes the LAGN round trip: the viewer has EXPORTED
`setup.support_pools` since EC-425, but the importer never read them back, so a
`?lagn=` share link delivered heroes and villains and silently dropped the
harness.

## Before Starting
- [ ] EC-425 (pools), EC-422 (LAGN 1.1.0 / D-24195) and EC-428 (presets) are on
      `main`
- [ ] Confirm the gap is still real: `loadoutLagnImport.ts`'s
      `lagnToComposition` maps the five entity fields and four counts and
      nothing else. Grep it for `support_pools` — no hit means the round trip
      is still broken
- [ ] Know there are **two** apply sites, deliberately duplicated under the
      rule-of-three: `useLagnFromUrl.applyComposition` and
      `LoadoutBuilder.applyLagnImport`. Both need the pool step or the two
      import paths diverge
- [ ] The `useLagnFromUrl` test uses a hand-built recording double. It has no
      `setSupportPool`, so it will THROW on a pooled LAGN until extended —
      passing tests before that fix prove only that no fixture carries pools
- [ ] `pnpm install` in the worktree; junctioned `node_modules` resolves stale
- [ ] Baseline: viewer **170 pass / 36 suites / 0 fail**

## Locked Values (do not re-derive)
- LAGN names the officer pool `shield_officers` (matching
  `shield_officers_count`, D-24195); the MATCH-SETUP envelope names it
  `officers` (matching `officersCount`, D-24194). This is the same non-1:1
  rename the counts already carry
- Card keys rename too: LAGN `ext_id` ↔ MATCH-SETUP `extId`
- The LAGN validator has already enforced pool-sums-equal-count (D-24195), so
  the importer does NOT re-derive counts — it maps them straight across
- Pools are applied AFTER the counts, via `setSupportPool`, which derives the
  paired count. Because the validator guarantees consistency, the derived value
  equals the count just set

## Guardrails
- **"Copy Setup Link" stays entity-only.** `setupUrlParams.ts` deliberately
  serializes just the five entity ids. A select-all bystander pool is ~70
  ext_ids; putting pools in a query string would produce an unusable URL. The
  `?lagn=` route already carries the whole document base64-encoded and is the
  correct vehicle — do not "fix" the other one
- Both apply sites must gain the pool step. Changing only one leaves the file
  importer and the URL importer disagreeing
- Extend the recording double with `setSupportPool` AND add a fixture that
  actually carries pools; without the fixture the new branch is dead code that
  tests cannot reach
- Do not re-derive or "correct" counts on import — the record is authoritative
  and the validator already checked it
- An imported record whose counts sit under the D-24032 floors must surface the
  existing inline validation error, NOT be silently adjusted. LAGN has no
  floors (it is a record format); the MATCH-SETUP validator is where that check
  belongs

## Required `// why:` Comments
- `LagnLoadoutComposition.supportPools`: what silently broke before this
- `lagnToSupportPools`: the `shield_officers` → `officers` rename and why it
  lives in one place
- The apply step in both sites: why pools go after the counts
- The recording double's `setSupportPool`: what it would otherwise throw on

## Files to Produce
- `apps/registry-viewer/src/lib/loadoutLagnImport.ts` — **modified** —
  `supportPools` on the result + `lagnToSupportPools`
- `apps/registry-viewer/src/lib/loadoutLagnImport.test.ts` — **modified** —
  rename + absent-pool cases
- `apps/registry-viewer/src/composables/useLagnFromUrl.ts` — **modified** —
  apply pools
- `apps/registry-viewer/src/composables/useLagnFromUrl.test.ts` — **modified** —
  extend the double; pooled and unpooled link cases
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** —
  apply pools in the file-import path

## After Completing
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `pnpm --filter registry-viewer test` exits 0 — **174 pass** (170 + 4)
- [ ] Live-on-surface (D-24026): open a `?lagn=` link carrying
      `shield_officers` + `sidekicks` pools; the Loadout tab shows counts
      30/30/20/2, officers `explicit`, sidekicks `sets`, and the officer pool
      resolves to `shld/melinda-may` × 20. **Verified in dev**
- [ ] `EC_INDEX.md` flipped with date

## Common Failure Smells
- Pools arrive on a file import but not a URL import (or vice versa) → only one
  of the two apply sites was updated
- `setSupportPool is not a function` in tests → the recording double was not
  extended
- Officer pool missing while sidekicks arrive → the `shield_officers` rename
  was dropped, or the key was passed through verbatim
- Cards present but the pool editor shows zeroes → `ext_id` was not renamed to
  `extId`, so the draft cannot match them
