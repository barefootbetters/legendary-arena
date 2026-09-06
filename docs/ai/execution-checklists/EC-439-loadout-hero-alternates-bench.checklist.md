# EC-439 — Loadout Hero Alternates (Execution Checklist)

**Source:** docs/ai/work-packets/WP-404-loadout-hero-alternates-bench.md
**Layer:** App (`apps/registry-viewer`) only — no `packages/lagn-spec` change

> **Re-drafted off `origin/main` @ `cdff4ea6`.** The original EC-439 flipped
> `LAGN_VERSION` 1.1.0 → 1.3.0. That flip is obsolete: WP-405 (→1.4.0) and
> WP-641 (→1.5.0) already advanced the writer, so `LAGN_VERSION` is `1.5.0` and
> the `setup.hero_alternates` gate (`>= 1.3.0`) is already satisfied. This packet
> performs NO flip and does NOT touch `packages/lagn-spec` or `api-endpoints.md`.

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.** Anything else
      = STOP, with ONE sanctioned exception: files surfaced by the §Empirical
      Scaffold run are folded into the WP's Scope (In) + Files list FIRST.
- [ ] **WP-402 ✅ and WP-403 ✅ on `main`** — `setup.hero_alternates` (LAGN) and the
      envelope `heroAlternateIds` (`setupContract`) both exist. Verify, don't assume.
- [ ] **Confirm `LAGN_VERSION === '1.5.0'`** in `packages/lagn-spec/src/validator.ts`.
      It is already past the `>= 1.3.0` hero_alternates gate. **Do NOT flip it.**
      Flipping to 1.3.0 regresses WP-405/641.
- [ ] **Re-verify WP-404 / EC-439 / D-24213 are still free** against `origin/main`
      *and* open PR branches (`gh pr list`).
- [ ] `pnpm -r build` exits 0, then record baselines:
      `pnpm --filter registry-viewer test`, `pnpm --filter registry-viewer typecheck`,
      `pnpm --filter @legendary-arena/lagn test`.
- [ ] Enumerate the real viewer file set: `git ls-files apps/registry-viewer/src`.
      **That enumeration becomes the scope lock** (EC-432 pattern).
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md` before the first edit.
- [ ] **Scaffold — export/round-trip.** Prototype: a draft carrying
      `heroAlternateIds` exports a 1.5.0 document whose `setup.hero_alternates`
      passes `validate()` and re-imports to the identical bench; an empty bench
      omits the key. `pnpm -r build && pnpm --filter registry-viewer test`, RECORD
      the output. This adds an optional read on an existing input path.

## Locked Values (do not re-derive)
- **`LAGN_VERSION` is NOT changed.** It is `1.5.0`, which is `>= 1.3.0`. No flip,
  no `package.json` bump, no `validator.test.ts` edit — `packages/lagn-spec` is
  out of scope.
- MATCH-SETUP field, verbatim: `heroAlternateIds` (camelCase), **envelope-level**
  (`draft.heroAlternateIds`, beside `themeId` / `supportPools`). **NOT**
  `composition.heroAlternateIds`.
- LAGN field, verbatim: `setup.hero_alternates` (snake_case), entry shape
  `{ id, name }` — identical to `setup.heroes`. Map the rename in ONE place
  (`compositionToLagnSetup` / `lagnToComposition`), the same way
  `officersCount` ↔ `shield_officers_count` already is.
- Bench UI slot count: **2**. UI-only. Do NOT add a `.max()` to any schema, and do
  NOT cap in the composable setter (mirror `addHeroGroup`).
- Empty bench ⇒ the `hero_alternates` **key is omitted entirely**, never `[]`.
- **Export `keyOrder` whitelist:** add `hero_alternates` to
  `useLoadoutLagnExport.buildLagnFile`'s `keyOrder`. A `JSON.stringify` replacer
  array is a whitelist — an absent key is dropped from the file (the EC-425
  supportPools trap). `id` / `name` are already listed.
- Setter names, verbatim: `addHeroAlternate`, `removeHeroAlternate` — mirroring
  `addHeroGroup` / `removeHeroGroup`.
- `ext_id` grammar is D-10014 set-qualified `setAbbr/slug`.

## Guardrails
- **Do NOT touch `packages/lagn-spec`** (`validator.ts`, `package.json`,
  `validator.test.ts`). The writer is already 1.5.0; a flip regresses shipped WPs.
- **Do NOT touch `docs/ai/REFERENCE/api-endpoints.md`.** §21 is not triggered —
  the stamped version already reads 1.5.0 (WP-641) and no endpoint signature moves.
- **No `packages/game-engine` file may change**, including `versioning/**`.
  `finalStateHash` unmoved.
- **Do not fork the validator.** Import extends `parseLagnLoadout` and reuses the
  published `validate` — a second LAGN parser is the failure this arc avoids
  (D-24075).
- **Do not fork the exporter.** Extend `compositionToLagnSetup`; do not add a
  second composition→LAGN mapping.
- **Both import consumers apply the bench.** `LoadoutBuilder.applyLagnImport` AND
  `useLagnFromUrl.applyComposition` — a bench applied in one but not the other is
  the round-trip asymmetry AC-5/AC-6 exist to catch.
- Import stays **atomic**: setters fire only on `ok`. A malformed payload must
  leave the existing draft intact and show a dismissible full-sentence banner.
- The bench field is **envelope-level** — read/write `draft.heroAlternateIds`, not
  `draft.composition.*`. Putting it in the composition breaks the WP-403 placement.
- `apps/arena-client` and `apps/server` are out of scope entirely.
- `pnpm --filter registry-viewer typecheck` is the load-bearing gate. `vite build`
  is esbuild and `node:test` runs via tsx — **neither typechecks SFCs**.

## Required `// why:` Comments
- The `heroAlternateIds` draft field: why envelope-level and not composition —
  WP-403 placement; a bench is not on the board (D-24212)
- The empty-bench omission: why the key is dropped rather than emitted as `[]` —
  an empty array asserts "a bench exists and is empty," a different claim
- The `hero_alternates` `keyOrder` entry: why it must be whitelisted or the export
  silently drops it (the EC-425 replacer trap)
- The snake_case ↔ camelCase mapping: why it is done in one place
- The two-slot UI: why the cap lives here and not in the published schema or the
  composable setter
- The bench's visual distinction: why played and reserve heroes must not be
  confusable at a glance

## Files to Produce
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` (+ `.test.ts`) — **modified**
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` (+ `.test.ts`) — **modified**
- `apps/registry-viewer/src/lib/loadoutLagnImport.ts` (+ `.test.ts`) — **modified**
- `apps/registry-viewer/src/composables/useLagnFromUrl.ts` (+ `.test.ts`) — **modified**
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified**
- `apps/registry-viewer/src/components/LoadoutTray.vue` — **modified**
- `docs/ai/DECISIONS.md` — **modified** — D-24213 Active
- `docs/ai/STATUS.md` — **modified**
- `wiki/lagn-v1.md` — **modified** — `hero_alternates` producer note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — `📝` → `✅`

## After Completing
- [ ] AC-1..AC-11 each demonstrated with observed output
- [ ] AC-5 **round trip** explicitly run: export → import → identical bench
- [ ] AC-4 empty-bench case: key omitted, document still valid
- [ ] `pnpm --filter registry-viewer typecheck` 0 (load-bearing)
- [ ] `git diff --name-only` contains **no** `packages/game-engine/**` or
      `packages/lagn-spec/**` path
- [ ] D-24213 landed **Active**
- [ ] `wiki/lagn-v1.md` `hero_alternates` producer note updated
- [ ] **D-24026 live verification** on deployed `cards.legendary-arena.com` —
      build a bench, SAVE it, RE-OPEN it, confirm the bench survived. A rendering
      slot is NOT proof; drive the terminal action.
- [ ] STATUS flip recorded after the deploy-confirmed SHA
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0

## Common Failure Smells
- `packages/lagn-spec/**` in the diff → the obsolete flip was attempted; revert —
  the writer is already 1.5.0
- A bench survives export but not import (or vice versa) → the round trip was never
  run; AC-5 exists because this exact asymmetry recurred in WP-291 and EC-429
- A bench applies via paste but not via `?lagn=` → only one of the two import
  consumers was wired
- `hero_alternates: []` in an exported document → the empty-bench omission was missed
- `hero_alternates` absent from an exported document that should carry it → the
  `keyOrder` whitelist entry was missed (EC-425 trap)
- `draft.composition.heroAlternateIds` anywhere → wrong placement; the field is
  envelope-level (WP-403)
- A second LAGN parser or a second composition→LAGN mapping appeared → fork; revert
- A malformed payload wiped the draft → import was not atomic
- `.max(2)` appeared in a schema or the composable setter → the cap belongs in the UI
- Viewer tests green but `typecheck` red → SFC types; `typecheck` is the real gate
- The bench appears in a match, a projection, or `matchConfiguration` → the bench
  reached gameplay state; STOP and re-read D-24210
