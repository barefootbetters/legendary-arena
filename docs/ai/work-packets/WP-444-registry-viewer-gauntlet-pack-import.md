# WP-444 — Registry-Viewer Gauntlet-Pack Import (cards builder)

**User-Visible Surface:** `cards.legendary-arena.com` (the Registry-Viewer
Loadout Builder). A visitor can paste or load a downloaded
`*.gauntlet.json` identity pack (WP-440/WP-441) into a new **"Load Gauntlet
Pack (paste or file)"** affordance; on a valid pack the builder shows a **leg
(scheme) picker** for the pack's mastermind, and picking a leg **prefills the
draft** with the approved villain/henchmen composition + scheme + mastermind +
player count for that leg, leaving heroes empty for the visitor to fill.
**D-24026 live-verification applies** (operator-pending on the Cloudflare Pages
deploy).

## Goal

After this session, the Registry-Viewer Loadout Builder
(`apps/registry-viewer`) can **consume a WP-440 identity pack**. A new
dedicated **"Load Gauntlet Pack (paste or file)"** importer (a third importer
beside the existing MATCH-SETUP "Load JSON" and "Load LAGN" boxes) detects and
strictly validates a `{ pack_version, gauntlet }` pack via the registry's
`validateGauntletPack`. On a valid pack it presents a **leg (scheme) picker**
listing the schemes of the pack mastermind's home set (the gauntlet's legs, per
WP-342/D-24131 both-sides-same-set). Picking a leg **resolves the approved
adversary composition** for `(setAbbr, mastermindSlug, playerCount)` from the
registry's `GAUNTLET_LOADOUT_MENUS` (default **variant 0**, optionally
selectable) and **prefills the builder draft** — `schemeId`, `mastermindId`,
`villainGroupIds`, `henchmanGroupIds`, `playerCount` — leaving `heroDeckIds`
**empty** (bring your own heroes). A pack naming an unknown gauntlet (no loadout
menu) or an unoffered player count resolves to a **clear friendly message**, not
a crash and not the raw schema-error wall. All resolution is **client-side from
the registry the viewer already bundles** — **zero-API**, no server call, no
snapshot change. This is the cards-side consumer of the identity-only pack
(the play-server import is WP-5), the fifth WP of the Mastermind Gauntlets:
download → import → build → track epic.

## Assumes

- **On `origin/main` @ `cef4f0a6`** (the drafting baseline; `git rev-parse
  origin/main` at draft time). `apps/registry-viewer` builds, tests, and
  typechecks green on this SHA.
- **WP-440 / EC-475 / D-24260 is landed on `main`** (hard dependency).
  `packages/registry/src/gauntletPack.ts` exports `validateGauntletPack(input:
  unknown): GauntletPack` (throws a full-sentence `Error` on bad version/shape),
  `GAUNTLET_PACK_VERSION` (`1`), and the `GauntletPack` / `GauntletPackIdentity`
  / `GauntletDivision` types; `packages/registry/package.json` `exports` maps
  `./gauntletPack` → `./dist/gauntletPack.{js,d.ts}`. (Source: WORK_INDEX.md
  WP-440 row = **Done 2026-07-27**; the file on `main`.)
- **WP-395 / D-24199 is landed on `main`** (data dependency).
  `packages/registry/src/gauntletLoadouts.ts` exports `getGauntletLoadoutMenu(
  setAbbr, mastermindSlug): GauntletLoadoutMenu | undefined` and
  `GAUNTLET_LOADOUT_MENUS`, under the `./gauntletLoadouts` subpath. A
  `GauntletLoadoutMenu` has `variants: readonly GauntletLoadoutVariant[]`; a
  `GauntletLoadoutVariant` has a stable `variantIndex: number` and
  `compositionsByPlayerCount: Record<SupportedPlayerCount,
  GauntletLoadoutComposition>`; a `GauntletLoadoutComposition` has
  `villainGroupIds` + `henchmanGroupIds` (set-qualified `setAbbr/slug` ext_ids,
  sorted ASC). (Source: the file on `main`.)
- `packages/registry/src/playerCountSetup.ts` exports `PLAYER_COUNT_SETUP`,
  `getPlayerCountSetup(numPlayers): PlayerCountSetupRow | undefined`, and
  `SupportedPlayerCount` (`1 | 2 | 3 | 4 | 5`), under `./playerCountSetup`.
  **`PlayerCountSetupRow` carries `heroCount` (among `villainGroupCount`,
  `henchmenGroupCount`, `villainDeckBystanderCount`) — it does NOT carry the
  four supply-pile counts** (`bystandersCount` / `woundsCount` /
  `officersCount` / `sidekicksCount`); those are builder-side defaults (see
  Context). (Source: the file on `main`, WP-370.)
- `apps/registry-viewer/package.json` declares `@legendary-arena/registry` as a
  runtime **`dependency`** (not a devDependency); the viewer already
  value-imports registry symbols through **narrow subpaths**
  (`@legendary-arena/registry/setupContract`, `/playerCountSetup`, `/schema`) —
  never the root barrel (which pulls Node built-ins and breaks the browser
  build). This WP value-imports `/gauntletPack`, `/gauntletLoadouts`, and
  `/playerCountSetup` the same way. (Source: the file on `main`.)
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` exports the draft
  API (`UseLoadoutDraftApi`) with the public setters `resetDraft`, `setScheme`,
  `setMastermind`, `addVillainGroup`, `removeVillainGroup`, `addHenchmanGroup`,
  `addHeroGroup`, `setCount`, `setPlayerCount`; `createBlankDraft()` seeds the
  four supply-pile counts from `DEFAULT_BYSTANDERS_COUNT=30`,
  `DEFAULT_WOUNDS_COUNT=30`, `DEFAULT_OFFICERS_COUNT=30`,
  `DEFAULT_SIDEKICKS_COUNT=0`. The composition fields are `schemeId`,
  `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, and the
  four counts under `draft.value.composition`; `playerCount` is envelope-level.
  (Source: the file on `main`.)
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` hosts the existing
  two importers — `📥 Load JSON (paste or file)` (MATCH-SETUP, via
  `loadFromJson`) and `📥 Load LAGN (paste or file)` (via `parseLagnLoadout` +
  the public setters). This WP adds a third, sibling importer. (Source: the file
  on `main`.)
- The registry the builder holds can list a set's schemes:
  `registry.query({ setAbbr, cardType: 'scheme' })` returns the set's scheme
  `FlatCard`s, each `extId` = `"{setAbbr}/{schemeSlug}"` (equivalently, filter
  `listCards()` by `cardType === 'scheme'` and an `extId` prefix of
  `"{setAbbr}/"`). (Source: `packages/registry/src/types/index.ts` +
  `schema.ts` on `main`.)

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the App layer and
  the Import Rules row for `apps/registry-viewer`: it **may** runtime-import
  `registry` (a browser-safe subpath) and the UI framework; it must never import
  `game-engine`, `server`, `pg`, or `boardgame.io`. This WP adds only registry
  value-imports, which are already permitted for this app.
- `.claude/rules/architecture.md` Import Rules table (`apps/registry-viewer` →
  `registry`) + §Persistence Boundary — no `G`, no snapshot; this WP touches
  neither.
- `.claude/rules/code-style.md` — ESM-only, `node:test`, `.test.ts`, full
  English names, no `.reduce()` for branching, `// why:` on non-self-evident
  constants, human-style code.
- `packages/registry/src/gauntletPack.ts` (WP-440) — `validateGauntletPack`
  validates the pack's **shape only**; it does **not** confirm the
  `(setAbbr, mastermindSlug)` names a real gauntlet nor that `division` /
  `playerCount` are offered. This WP's resolver is what cross-checks against
  `GAUNTLET_LOADOUT_MENUS` and produces the friendly unknown/unoffered message.
- `packages/registry/src/gauntletLoadouts.ts` (WP-395/D-24199) — the approved
  composition menus this WP resolves; the leg's villains/henchmen come from the
  selected `variant.compositionsByPlayerCount[playerCount]`, **not** from the
  mastermind's default Always-Leads set.
- `apps/registry-viewer/src/lib/loadoutLagnImport.ts` +
  `loadoutLagnImport.test.ts` — the pure-parser + `node:test` posture this WP
  mirrors for `loadoutGauntletPackImport.ts` (each document type owns its own
  validator/importer; no unified dispatcher).
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — the setter API the
  prefill drives; note `setMastermind` **auto-adds the mastermind's Always-Leads
  villain groups**, so the resolver's approved variant villains must be applied
  as the authoritative set for the leg (clear + add the variant ids), not left
  as the mastermind default. **The four supply-pile counts are NOT
  player-count-derived** — they stay at the `createBlankDraft` defaults
  (`30/30/30/0`); only `heroCount` lives in `PLAYER_COUNT_SETUP` and, because
  heroes are left empty here, `heroCount` only informs the existing
  required-count readout (WP-372), it is not prefilled.
- `apps/registry-viewer/src/lib/setupUrlParams.ts` + `App.vue` (WP-387) — the
  challenge-link draft-seeding precedent (`parsePlayerCountFromUrl` →
  `setPlayerCount` at mount). This WP mirrors the *draft-seeding-via-setters*
  approach but from a pasted/loaded file, **not** a URL param (a `?pack=` deep
  link is out of scope — see below).
- `docs/ai/DECISIONS.md` — D-24260 (pack identity-only), D-24199 (approved
  loadout menus), D-24131 (both-sides-same-set gauntlet legs), D-10014 (loadout
  composition ids are set-qualified `setAbbr/slug`); this WP reserves
  **D-24263**.

**Why now / split rationale.** This is WP #5 of the approved Mastermind
Gauntlets epic (plan §Work-packet decomposition, Addendum). It exists because a
**live product test** surfaced a gap: Jeff downloaded the live legends pack
(`{ pack_version: 1, gauntlet: { setAbbr: "core", mastermindSlug: "magneto",
division: "fixed", playerCount: 1 } }`) and loaded it into the
cards.legendary-arena.com builder — it errored with 5 schema issues, because the
builder's existing importers expect a full LAGN doc or a MATCH-SETUP composition
and the identity-only pack (WP-440/D-24260) carries neither. This WP gives the
builder a consumer for the pack, resolving the identity token client-side into a
prefilled leg loadout. It is a single-app, single-layer change
(`apps/registry-viewer` only). It runs the **standard two-session lane** (it is
a user-visible cards surface adding a new lib module + resolution logic +
builder UI — beyond the lightweight lane's narrow-input-validation/UX-copy
scope), matching the rest of the epic's posture.

**Design note (leg picker + prefill, not a match launch).** This WP stops at
**prefilling the builder draft** — it does not launch a match or submit a score
(the builder is the cards-site loadout editor; launching is play-side, WP-6/7).
Picking a leg seeds the editor exactly as a hand-built loadout would, and the
visitor completes it by adding their own heroes.

## Scope (In)

- **New pure parser + resolver** `apps/registry-viewer/src/lib/
  loadoutGauntletPackImport.ts` exporting:
  - `parseGauntletPack(jsonText: string)` — `JSON.parse` then
    `validateGauntletPack`; returns a discriminated result
    `{ ok: true, pack } | { ok: false, error }` (never throws; the thrown
    `validateGauntletPack` `Error` is caught and its full-sentence message
    surfaced). Rejects a MATCH-SETUP or LAGN document pasted into the gauntlet
    box loudly (they lack `pack_version` / `gauntlet`).
  - `resolveGauntletLegLoadout(input)` — a **pure, data-injected** resolver
    taking the validated pack, the chosen leg `schemeId`, the chosen
    `variantIndex` (default `0`), and the resolved
    `GauntletLoadoutMenu | undefined` for the pack's `(setAbbr, mastermindSlug)`.
    Returns a discriminated result:
    `{ ok: true, prefill: { schemeId, mastermindId, villainGroupIds,
    henchmanGroupIds, playerCount } }`, or
    `{ ok: false, reason: 'unknown-gauntlet' | 'unoffered-count' |
    'unknown-variant', message }` with a friendly full-sentence message.
    `mastermindId = `${setAbbr}/${mastermindSlug}``; villains/henchmen come from
    `variant.compositionsByPlayerCount[playerCount]`; `heroDeckIds` is **not**
    part of the prefill (left empty).
  - `listGauntletLegSchemeIds(setAbbr, schemes)` — a small pure helper mapping a
    set's scheme `FlatCard`s to their `extId`s (the leg options for the picker),
    injected with the scheme list so it is testable without a live registry.
- **New tests** `apps/registry-viewer/src/lib/loadoutGauntletPackImport.test.ts`
  (`node:test`) covering: a valid `core/magneto` pack parses (identity-only —
  no legs/heroes/compositions leak in); a non-pack (MATCH-SETUP / LAGN / bad
  version) is rejected with a message; `resolveGauntletLegLoadout` at
  variant 0 produces the expected set-qualified villain/henchmen ids +
  `mastermindId` + `playerCount` and **no** `heroDeckIds`; an unknown gauntlet
  (menu `undefined`) → `unknown-gauntlet`; an unoffered count (no
  `compositionsByPlayerCount[count]`) → `unoffered-count`; `listGauntletLegSchemeIds`
  yields `"{setAbbr}/{schemeSlug}"` ids.
- **Builder wiring** `apps/registry-viewer/src/components/LoadoutBuilder.vue`
  (**modified**): a new `<details>` **"Load Gauntlet Pack (paste or file)"**
  affordance (paste textarea + `Load pasted pack` button + file input,
  mirroring the two existing importers) that calls `parseGauntletPack`; on a
  valid pack, render a **leg (scheme) picker** (the set's scheme options) and an
  optional **variant selector** (default `variantIndex 0`); on leg selection
  call `resolveGauntletLegLoadout` and, on `ok`, prefill the draft via the
  public setters — `resetDraft()` → `setScheme(schemeId)` →
  `setMastermind(mastermindId)` → set villains/henchmen to the resolved approved
  variant exactly (the authoritative leg composition) → `setPlayerCount(
  playerCount)`; heroes left empty. On a `false` result render the friendly
  message inline (not a schema-error wall).

## Out of Scope

- **No `?pack=` URL deep link** — this WP is a paste/file affordance only.
  `App.vue`, `lagnUrlParam.ts`, and the `use*FromUrl` composables are **not**
  touched; a URL-carried pack is a possible follow-on, not this WP.
- **No server endpoint, no `apps/server` change, no persistence, no migration**
  — resolution is entirely client-side from the bundled registry; the play-side
  import + run persistence is WP-5.
- **No `packages/registry` change** — `validateGauntletPack`,
  `GAUNTLET_LOADOUT_MENUS`, `PLAYER_COUNT_SETUP`, and scheme listing are all
  consumed as-is; this WP modifies no registry file and adds no registry export.
  **No change to WP-440's pack contract.**
- **No hero prefill** — `heroDeckIds` is left empty by design ("bring your own
  heroes"); the WP does not pick, suggest, or default heroes.
- **No match launch / score submission** — the WP prefills the builder draft
  only; launching a leg and submitting a competitive score is play-side
  (WP-6/7).
- **No change to the existing "Load JSON" (MATCH-SETUP) or "Load LAGN"
  importers, the `?lagn=` / `?playerCount=` URL paths, the gallery, or the
  Loadout/Preview tabs** — the gauntlet-pack importer is strictly additive
  beside them.
- **No legends-board change** — a legends "import at play…" hint is a separate
  optional touch, not this WP.

## Files Expected to Change

- `apps/registry-viewer/src/lib/loadoutGauntletPackImport.ts` — **new** — pure
  `parseGauntletPack` + `resolveGauntletLegLoadout` + `listGauntletLegSchemeIds`.
- `apps/registry-viewer/src/lib/loadoutGauntletPackImport.test.ts` — **new** —
  `node:test` unit tests (parse, identity-only, reject non-pack, variant-0
  resolve, unknown-gauntlet, unoffered-count, leg-scheme-id shape).
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — new
  "Load Gauntlet Pack (paste or file)" importer + leg picker + optional variant
  selector + friendly-message handling + draft prefill via the public setters.

## Contract

> **Output contract for this session:**
> - Full file contents for every new or modified file (no diffs).
> - ESM only, Node v22+, human-style code per `00.6-code-style.md`.
> - App layer (`apps/registry-viewer`): registry is a **runtime dependency**
>   here; value-import the needed symbols through **narrow subpaths**
>   (`@legendary-arena/registry/gauntletPack`, `/gauntletLoadouts`,
>   `/playerCountSetup`) — **never** the registry root barrel (Node-built-in
>   contamination breaks the browser build).
> - The parser/resolver in `loadoutGauntletPackImport.ts` are **pure,
>   side-effect free, data-injected** (the menu + scheme list are passed in),
>   fully unit-tested; the DOM affordance + leg picker are covered by the
>   dev-server smoke + `vue-tsc`.
> - `parseGauntletPack` and `resolveGauntletLegLoadout` **never throw** — they
>   return discriminated `{ ok }` results; the only throw source
>   (`validateGauntletPack`) is caught and its message surfaced.

**Locked values (do not re-derive):**

- **Pack-detection contract:** a gauntlet pack is a JSON object carrying
  `pack_version` + `gauntlet`; detection/validation is delegated **entirely** to
  the registry's `validateGauntletPack` (strict, major-version-reject) — this WP
  adds no second schema and no lax pre-check.
- **Default variant:** `variantIndex = 0` (the `variant.variantIndex` field,
  not array position); variant optionally selectable among the menu's variants.
- **Prefilled fields (from the resolved leg):** `schemeId` (the picked leg's
  `"{setAbbr}/{schemeSlug}"`), `mastermindId` (`"{setAbbr}/{mastermindSlug}"`),
  `villainGroupIds` + `henchmanGroupIds` (from
  `variant.compositionsByPlayerCount[playerCount]`, set-qualified ext_ids),
  `playerCount` (the pack's `playerCount`). **`heroDeckIds` stays EMPTY.**
- **Supply-pile counts:** `bystandersCount 30`, `woundsCount 30`,
  `officersCount 30`, `sidekicksCount 0` — the builder's `createBlankDraft`
  defaults after `resetDraft()`; they are **NOT** read from `PLAYER_COUNT_SETUP`
  (which carries only `heroCount`, not these four).
- **Id space:** `schemeId` / `mastermindId` / `villainGroupIds` /
  `henchmanGroupIds` are all set-qualified `setAbbr/slug` ext_ids (D-10014),
  matching what `GAUNTLET_LOADOUT_MENUS` stores and what the composition expects.
- **Graceful outcomes:** menu `undefined` → `unknown-gauntlet`;
  `compositionsByPlayerCount[playerCount]` absent → `unoffered-count`; a chosen
  variant index absent → `unknown-variant`; each surfaces a full-sentence
  message, never a crash or the raw Zod schema wall.
- **Runtime imports (value, not type-only):** `validateGauntletPack` from
  `@legendary-arena/registry/gauntletPack`; `getGauntletLoadoutMenu` /
  `GAUNTLET_LOADOUT_MENUS` from `@legendary-arena/registry/gauntletLoadouts`;
  `getPlayerCountSetup` / `PLAYER_COUNT_SETUP` from
  `@legendary-arena/registry/playerCountSetup` (used only if the readout needs
  `heroCount`).

## Acceptance Criteria

- [ ] `apps/registry-viewer/src/lib/loadoutGauntletPackImport.ts` exports
      `parseGauntletPack`, `resolveGauntletLegLoadout`, and
      `listGauntletLegSchemeIds`.
- [ ] `parseGauntletPack('{"pack_version":1,"gauntlet":{"setAbbr":"core",
      "mastermindSlug":"magneto","division":"fixed","playerCount":1}}')` returns
      `{ ok: true, pack }` whose `pack` is identity-only (exactly `pack_version`
      + `gauntlet.{setAbbr,mastermindSlug,division,playerCount}`; the test
      asserts NO `legs`, `heroDeckIds`, `villainGroupIds`, `henchmanGroupIds`).
- [ ] `parseGauntletPack` on a MATCH-SETUP composition, a LAGN doc, and a
      `pack_version: 2` pack each returns `{ ok: false, error }` with a
      non-empty full-sentence message (no throw).
- [ ] `resolveGauntletLegLoadout` for a `core/magneto` pack at `variantIndex 0`,
      given the `core/magneto` menu, returns `{ ok: true, prefill }` whose
      `prefill` has `schemeId` = the picked leg id, `mastermindId` =
      `"core/magneto"`, the variant-0 `villainGroupIds` + `henchmanGroupIds` for
      the pack's `playerCount`, and `playerCount` — and carries **no**
      `heroDeckIds`.
- [ ] `resolveGauntletLegLoadout` with `menu === undefined` returns
      `{ ok: false, reason: 'unknown-gauntlet', message }`; with a
      `playerCount` absent from `compositionsByPlayerCount` returns
      `{ ok: false, reason: 'unoffered-count', message }`.
- [ ] `listGauntletLegSchemeIds('core', schemes)` returns the schemes'
      `"core/{schemeSlug}"` ext_ids.
- [ ] `LoadoutBuilder.vue` renders a "Load Gauntlet Pack (paste or file)"
      affordance; loading a valid pack shows a leg (scheme) picker; picking a
      leg prefills the draft's `schemeId`, `mastermindId`, `villainGroupIds`,
      `henchmanGroupIds`, and `playerCount` and leaves `heroDeckIds` empty; an
      unknown-gauntlet / unoffered-count pack shows the friendly message, not the
      schema-error wall.
- [ ] The importer value-imports registry only through the narrow subpaths
      (`/gauntletPack`, `/gauntletLoadouts`, `/playerCountSetup`) — never the
      registry root barrel; no `game-engine` / `server` / `pg` / `boardgame.io`
      import appears.
- [ ] `pnpm --filter registry-viewer test`, `pnpm --filter registry-viewer
      typecheck` (`vue-tsc --noEmit`), and `pnpm --filter registry-viewer build`
      all exit 0; `pnpm -r build` exits 0.
- [ ] No file outside the `Files Expected to Change` list is modified.

## Verification Steps

```bash
pnpm -r build
# Expected: whole-repo build green; registry dist present so registry-viewer's
# value imports of /gauntletPack + /gauntletLoadouts + /playerCountSetup resolve.

pnpm --filter registry-viewer test
# Expected: all registry-viewer tests pass, including
# loadoutGauntletPackImport.test.ts (parse, identity-only, reject non-pack,
# variant-0 resolve, unknown-gauntlet, unoffered-count, leg-scheme-id shape).

pnpm --filter registry-viewer typecheck
# Expected: vue-tsc --noEmit exits 0.

pnpm --filter registry-viewer build
# Expected: vite build exits 0.

# Dev-server smoke (pure logic is unit-tested; the DOM affordance + leg picker
# are smoke-verified): run the SPA, open the Loadout Builder, load the live
# core/magneto .gauntlet.json into "Load Gauntlet Pack", confirm the leg picker
# lists Core Set schemes, pick a leg, and confirm the draft prefills the
# scheme/mastermind/villains/henchmen/playerCount with heroes empty — with
# read_network_requests showing ZERO API calls. Then load a pack for a
# mastermind with no loadout menu and confirm the friendly "isn't in the
# registry" message renders instead of a schema-error wall.
```

## Vision Alignment

**Vision clauses touched:** §10a (Registry Viewer / cards.legendary-arena.com
public surface — this WP adds a builder import affordance) and §20–26 (Scoring,
PAR & leaderboards — the gauntlet is a competitive surface; the pack names
*which* gauntlet leg a visitor prepares). No identity / monetization / RNG /
determinism / persistence surface is touched.

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.*
The import resolves an identity-only token into a prefilled editor draft entirely
client-side; it scores, ranks, credits, and persists nothing, and the server
remains the sole authority for legs, approved compositions, and adjudication at
play-side import (WP-5). The approved composition is resolved from the live
registry, so it always tracks current rules — no drift.

**Non-Goal proximity check:** No proximity to NG-1..7. The import is free,
account-less, carries no paid surface, no pay-to-win lever, and no
cosmetic/monetization affordance — it prefills a loadout the visitor then
completes with their own heroes.

## Definition of Done

This packet is complete when ALL of the following are true:
- [ ] All Acceptance Criteria pass.
- [ ] `pnpm --filter registry-viewer test`, `typecheck`, and `build` exit 0;
      `pnpm -r build` exits 0.
- [ ] **D-24026 live-verification (operator-pending on deploy):** on the
      deployed `cards.legendary-arena.com` builder, loading the live
      `core/magneto` `.gauntlet.json` shows the leg picker, and picking a leg
      prefills the draft (scheme/mastermind/villains/henchmen/playerCount, heroes
      empty) with `read_network_requests` showing zero API calls; an
      unknown-gauntlet pack shows the friendly message.
- [ ] `docs/ai/STATUS.md` updated (user-visible: names the gauntlet-pack import
      on the cards builder).
- [ ] `docs/ai/DECISIONS.md` **D-24263** flipped from "Drafted" to "Active
      (post-execution)".
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph moved `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-479 status → `Done`.
- [ ] No files outside the `Files Expected to Change` list were modified.

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE**

- **Authority chain read:** CLAUDE.md → ARCHITECTURE.md §Layer Boundary (App /
  registry-viewer import rules) → `.claude/rules/architecture.md` Import Rules +
  §Persistence Boundary → `.claude/rules/code-style.md` → this WP → EC-479. No
  conflict: `apps/registry-viewer` is explicitly permitted to runtime-import
  `registry` through browser-safe subpaths (it already imports `/setupContract`
  and `/playerCountSetup`).
- **Dependencies verified on `main` @ `cef4f0a6`:** WP-440 is **Done**
  (WORK_INDEX row 2026-07-27) — `validateGauntletPack` + the `GauntletPack`
  types + the `./gauntletPack` subpath are present; WP-395 is **Done** —
  `getGauntletLoadoutMenu` / `GAUNTLET_LOADOUT_MENUS` + the `./gauntletLoadouts`
  subpath are present with the documented variant shape; `PLAYER_COUNT_SETUP`
  and scheme listing (`registry.query({setAbbr,cardType:'scheme'})`) are present;
  `apps/registry-viewer/package.json` carries `@legendary-arena/registry` as a
  runtime dependency; `useLoadoutDraft.ts` exposes the setters and the blank-draft
  supply-pile defaults; `LoadoutBuilder.vue` hosts the two existing importers.
- **Scope lock:** exactly three files, all under `apps/registry-viewer`
  (2 new, 1 modified) + governance ledgers. Single layer (App), single app. No
  contract file modified; no registry/server/persistence/migration surface.
- **Validation-tightening check (Empirical Scaffold, `01.4`):** this WP adds a
  brand-new import path with its own new tests; it **tightens no existing input
  path** and rejects no previously-accepted input (the existing "Load JSON" and
  "Load LAGN" importers are untouched), so no pre-existing fixture can carry a
  now-invalid form. The scaffold-first empirical gate does not trigger.
- **Ambiguities resolved (recorded in Contract + EC):** (1) **dedicated
  affordance** vs reusing "Load JSON" — resolved to a **third dedicated "Load
  Gauntlet Pack" importer**, matching the existing per-document-type-owns-its-
  validator pattern (the identity pack is neither a MATCH-SETUP nor a LAGN doc).
  (2) **supply-pile counts source** — resolved to the **builder blank-draft
  defaults** (`30/30/30/0`), because `PLAYER_COUNT_SETUP` carries only
  `heroCount`, not the four supply counts (a factual correction to the plan's
  "counts from PLAYER_COUNT_SETUP" framing). (3) **`setMastermind` auto-adds
  Always-Leads villains** — resolved by making the approved variant's
  villains/henchmen the **authoritative** leg composition (clear + add the
  variant ids after `setMastermind`), so the leg matches the approved menu, not
  the mastermind default.

### Copilot Check (`01.7`) — verdict: **PASS**

Audited against the Top-30 lens; findings summarized:
- **Separation of concerns / layer boundaries — PASS.** App layer only; registry
  is value-imported through browser-safe subpaths (already permitted for this
  app); no `game-engine` / `server` / `pg` / `boardgame.io` reach; the server
  stays the sole adjudication authority (import is client-side prefill only).
- **Determinism — PASS.** Pure, data-injected parser + resolver; no RNG, no time,
  no I/O beyond `JSON.parse` and the DOM; no `G`/`ctx`.
- **Immutability / mutation — PASS.** The resolver returns fresh `{ ok }` result
  objects; the draft is mutated only through the existing public setters.
- **Type safety / contract integrity — PASS.** `validateGauntletPack` is the
  single source of pack shape; the resolver consumes the registry's typed
  `GauntletLoadoutMenu` / `SupportedPlayerCount` closed sets; ids are the
  set-qualified `setAbbr/slug` space (D-10014).
- **Stringly-typed outcomes — PASS.** The resolver returns a **discriminated**
  result with a closed `reason` set (`unknown-gauntlet` | `unoffered-count` |
  `unknown-variant`), not free-form strings.
- **Persistence / serialization — PASS.** No persistence; the pack is
  plain-JSON; the draft is the existing in-memory editor state.
- **Testing / invariants — PASS.** Identity-only key assertion, non-pack reject,
  variant-0 resolution, and both graceful-failure reasons are unit-tested against
  injected data (no live registry needed).
- **Scope / governance — PASS.** Three-file, single-app additive scope with
  explicit Out-of-Scope fences (no URL deep link, no endpoint, no persistence, no
  registry edit, no hero prefill, no match launch, no WP-440 contract change).
- **Error handling — PASS.** `parseGauntletPack`/`resolveGauntletLegLoadout`
  never throw; the one throw source (`validateGauntletPack`) is caught and its
  full-sentence message surfaced; unknown/unoffered render a friendly message,
  never the raw schema wall.
- **Extensibility — PASS.** The pack's forward-compat major-version gate lives in
  WP-440's `validateGauntletPack`; this consumer inherits it (an unknown major
  version is rejected with a clear message, not silently mishandled).
- **Documentation / intent — PASS.** JSDoc on every export; `// why:` on the
  default `variantIndex 0`, the supply-pile-defaults choice, and the
  variant-authoritative villains note.

No RISK or BLOCK findings.

## Lint Gate Self-Review (`00.3`, all 21 sections)

- **§1 Structure** — PASS. All required sections present in order.
- **§2 Non-Negotiable Constraints** — PASS. ESM, Node v22+, narrow-subpath
  registry value-imports, pure data-injected helpers, human-style code stated in
  Contract.
- **§3 Prerequisites (`## Assumes`)** — PASS. Each assumption cites its source on
  `main` @ `cef4f0a6`; the WP-440 + WP-395 hard-deps are verified Done.
- **§4 Context References** — PASS. Specific docs/sections + files listed.
- **§5 Output Completeness (`## Files Expected to Change`)** — PASS. Three files
  enumerated with new/modified + one-line each; matches the EC allowlist.
- **§6 Naming Consistency** — PASS. `schemeId`, `mastermindId`,
  `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `playerCount`, `setAbbr`,
  `mastermindSlug`, `division` all match 00.2 §8.1 and the WP-440 contract; no
  abbreviations invented.
- **§7 Dependency Discipline** — PASS. No new npm dependency; registry is an
  existing runtime dependency of registry-viewer. Hard-deps WP-440 + WP-395 are
  **Done** on `main` (not in-flight).
- **§8 Architectural Boundaries** — PASS. App layer; registry value-import via
  browser-safe subpaths (permitted); no engine/server/pg/boardgame.io; no `G`,
  no snapshot, no persistence.
- **§9 Windows Compatibility** — PASS. No shell scripts authored; `pnpm`
  verification commands only.
- **§10 Environment Variable Hygiene** — PASS. No new env access.
- **§11 Authentication Clarity** — N/A. No auth surface; the builder is a public
  zero-auth cards page and the import is a client-side prefill with no credential.
- **§12 Test Quality** — PASS. `node:test`, `.test.ts`, no `boardgame.io/testing`,
  no live server/DB; non-vacuous identity-only key assertion + both
  graceful-failure reasons asserted.
- **§13 Commands & Verification** — PASS. Exact `pnpm` commands with expected
  output.
- **§14 Acceptance Criteria Quality** — PASS. Binary, observable checks naming
  real symbols/values and the exact prefill fields.
- **§15 Definition of Done** — PASS, incl. §15.1: `User-Visible Surface` is the
  named cards surface, so the DoD carries the **D-24026 live-verification** item
  (operator-pending on the Pages deploy), plus the `typecheck` gate
  (registry-viewer app-package requirement).
- **§16 Code Style** — PASS. Small pure functions, discriminated results (no
  nested ternaries / branching `.reduce()`), JSDoc, `// why:` on the default
  variant / supply-pile defaults / variant-authoritative villains, named exports,
  full-sentence error messages.
- **§17 Vision Alignment** — PASS. `## Vision Alignment` present; §10a + §20–26
  cited; "No conflict"; NG proximity checked (none).
- **§18 Prose-vs-Grep Discipline** — N/A. This WP defines no count-bounded grep
  gate over a literal token.
- **§19 Bridge-vs-HEAD Staleness** — N/A. No bridge/adapter reconciliation; the
  baseline SHA `cef4f0a6` is recorded in `## Assumes`.
- **§20 Funding Surface Gate** — N/A. No funding surface: no global-nav,
  registry-viewer funding affordance, or donate/tournament-funding copy — the WP
  adds a gauntlet-pack import affordance and a leg picker.
- **§21 API Catalog Update** — N/A. App-layer only: adds no `apps/server` HTTP
  endpoint and no `apps/server/src/**` `Library-only` function; resolution is
  client-side with no server call. (WP-5 will trigger §21 when it adds the
  play-side import endpoint.)

All 21 sections resolved (PASS or justified N/A). Lint gate satisfied.
