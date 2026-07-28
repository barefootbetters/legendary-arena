# EC-479 — Registry-Viewer Gauntlet-Pack Import (Execution Checklist)

**Source:** docs/ai/work-packets/WP-444-registry-viewer-gauntlet-pack-import.md
**Layer:** App (`apps/registry-viewer`)

## Before Starting
- [ ] On `origin/main` @ `cef4f0a6` (drafting baseline), worktree clean.
- [ ] **WP-440 landed:** `packages/registry` exports `validateGauntletPack` +
      `GauntletPack` type via the `./gauntletPack` subpath.
- [ ] **WP-395 landed:** `packages/registry` exports `getGauntletLoadoutMenu` /
      `GAUNTLET_LOADOUT_MENUS` via `./gauntletLoadouts`, with variants carrying
      `variantIndex` + `compositionsByPlayerCount[playerCount]` →
      `{ villainGroupIds, henchmanGroupIds }`.
- [ ] `apps/registry-viewer/package.json` has `@legendary-arena/registry` as a
      runtime `dependency`; the viewer already value-imports registry via narrow
      subpaths (the pattern to mirror).
- [ ] `pnpm -r build` exits 0 (registry `dist` present so the value imports resolve).
- [ ] `pnpm --filter registry-viewer test` exits 0 (baseline).
- [ ] `pnpm --filter registry-viewer typecheck` exits 0 (baseline).
- [ ] **Exact target file set (any file outside this list = FAIL, STOP):** the
      three files under `## Files to Produce`.

## Locked Values (do not re-derive)
- Pack detection = `validateGauntletPack` (registry, strict, major-version
  reject); add NO second schema and NO lax pre-check.
- Default variant: `variantIndex = 0` (the field, not array position); variant
  optionally selectable.
- Prefill fields: `schemeId` (picked leg `"{setAbbr}/{schemeSlug}"`),
  `mastermindId` (`"{setAbbr}/{mastermindSlug}"`), `villainGroupIds` +
  `henchmanGroupIds` (from `variant.compositionsByPlayerCount[playerCount]`),
  `playerCount`. **`heroDeckIds` stays EMPTY.**
- Supply-pile counts = builder `createBlankDraft` defaults after `resetDraft()`:
  `bystandersCount 30`, `woundsCount 30`, `officersCount 30`, `sidekicksCount 0`.
  NOT from `PLAYER_COUNT_SETUP` (which carries only `heroCount`).
- Id space = set-qualified `setAbbr/slug` ext_ids (D-10014).
- Graceful reasons (closed set): `unknown-gauntlet` (menu undefined),
  `unoffered-count` (count absent from `compositionsByPlayerCount`),
  `unknown-variant` (variant index absent) — each a full-sentence message.
- Value imports: `@legendary-arena/registry/gauntletPack`,
  `/gauntletLoadouts`, `/playerCountSetup` — NEVER the registry root barrel.

## Guardrails
- **Zero-API.** Resolution is entirely client-side from the bundled registry;
  NO server call, NO `fetch`, NO snapshot/endpoint. If the import path issues a
  network request, STOP.
- **Runtime registry import via narrow subpaths ONLY** — never
  `@legendary-arena/registry` root barrel (Node built-ins break the browser
  build). No `game-engine` / `server` / `pg` / `boardgame.io` import.
- **Do NOT alter WP-440's pack contract, `packages/registry`, or the existing
  "Load JSON"/"Load LAGN" importers.** The gauntlet-pack importer is strictly
  additive (a third dedicated affordance).
- **`parseGauntletPack` + `resolveGauntletLegLoadout` never throw** — return
  discriminated `{ ok }` results; catch the `validateGauntletPack` throw and
  surface its message. Keep both pure + data-injected (menu + scheme list passed
  in) so they unit-test without a live registry.
- **The approved variant's villains/henchmen are the AUTHORITATIVE leg
  composition.** `setMastermind` auto-adds Always-Leads villains — after it,
  set villains/henchmen to exactly the resolved variant ids (clear + add), not
  the mastermind default.
- **Heroes stay empty** — do not pick, suggest, or default `heroDeckIds`.
- **Unknown-gauntlet / unoffered-count → friendly inline message**, never a
  crash and never the raw Zod schema-error wall.
- **No `?pack=` URL deep link** — paste/file affordance only; do NOT touch
  `App.vue`, `lagnUrlParam.ts`, or the `use*FromUrl` composables.

## Required `// why:` Comments
- The default `variantIndex = 0`: why variant 0 is the default (approved
  composition; selectable).
- The supply-pile defaults (`30/30/30/0` via blank draft): why they are NOT read
  from `PLAYER_COUNT_SETUP` (that table carries only `heroCount`; the four
  supply counts are builder defaults).
- The variant-authoritative villains/henchmen application after `setMastermind`:
  why the resolved variant overrides the mastermind's auto-added Always-Leads set
  (the leg clears only against the approved menu composition).

## Files to Produce
- `apps/registry-viewer/src/lib/loadoutGauntletPackImport.ts` — **new** — pure
  `parseGauntletPack` + `resolveGauntletLegLoadout` + `listGauntletLegSchemeIds`.
- `apps/registry-viewer/src/lib/loadoutGauntletPackImport.test.ts` — **new** —
  `node:test`: parse + identity-only, reject non-pack (MATCH-SETUP/LAGN/bad
  version), variant-0 resolve, unknown-gauntlet, unoffered-count, leg-scheme-id
  shape.
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — new
  "Load Gauntlet Pack (paste or file)" importer + leg (scheme) picker + optional
  variant selector + friendly-message handling + draft prefill via the public
  setters.

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter registry-viewer test` exits 0 (new tests green).
- [ ] `pnpm --filter registry-viewer typecheck` exits 0 (`vue-tsc`).
- [ ] `pnpm --filter registry-viewer build` exits 0.
- [ ] **D-24026 live verification (operator-pending on deploy):** on deployed
      `cards.legendary-arena.com`, loading the live `core/magneto`
      `.gauntlet.json` shows the leg picker; picking a leg prefills
      scheme/mastermind/villains/henchmen/playerCount with heroes empty;
      `read_network_requests` = zero API calls; an unknown-gauntlet pack shows
      the friendly message.
- [ ] `docs/ai/STATUS.md` updated (gauntlet-pack import on the cards builder).
- [ ] `docs/ai/DECISIONS.md` **D-24263** flipped Drafted → Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-479 status → `Done`.
- [ ] No file outside the three-file list was modified.

## Common Failure Smells
- Browser build breaks with a `node:fs`/`node:path` error → the registry **root
  barrel** was imported; switch to the narrow `/gauntletPack` etc. subpaths.
- Leg prefills the mastermind's default villains instead of the approved variant
  → the `setMastermind` auto-add was left in place; the resolved variant ids must
  be applied as the authoritative set.
- A valid pack for a mastermind without a menu throws or shows a Zod wall → the
  `unknown-gauntlet` friendly path was not wired; `resolveGauntletLegLoadout`
  must return `{ ok: false, reason }`, never throw.
- Supply piles come out wrong (e.g. 0/0/0/0) → the four counts were read from
  `PLAYER_COUNT_SETUP` instead of left at the blank-draft defaults.
