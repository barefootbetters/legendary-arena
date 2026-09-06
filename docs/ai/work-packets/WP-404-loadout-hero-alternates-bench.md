# WP-404 — Hero Alternates in the Loadout Tab (Registry Viewer)

**Layer:** App (`apps/registry-viewer`)
**EC:** `docs/ai/execution-checklists/EC-439-loadout-hero-alternates-bench.checklist.md`
**Reserves:** D-24213
**Baseline:** re-drafted off `origin/main` @ `cdff4ea6` (WP-403 merged). Original
draft was off `1c8809f3`, when `LAGN_VERSION` was still `1.1.0`.
**User-Visible Surface:** `cards.legendary-arena.com` — **D-24026 live verification REQUIRED**

---

## Goal

Give the Registry Viewer's Loadout tab a **hero bench**: two alternate slots
alongside the played heroes, carried through the draft, the LAGN export, the
`?lagn=` share link, and the saved-loadout library. A player builds a seven-hero
shortlist — five played, two in reserve — saves or shares it, re-opens it, and the
reserves are still there.

The bench rides an already-current LAGN writer. `LAGN_VERSION` is **`1.5.0`** on
`main` (WP-405 → 1.4.0, WP-641 → 1.5.0), and the `setup.hero_alternates` version
gate accepts any document `>= 1.3.0` (D-24211 ordinal gate), so a 1.5.0 export can
carry a bench today. **This packet performs no `LAGN_VERSION` flip** — see
§Baseline correction. It adds only the observable viewer half: the draft state,
the two-slot UI, and the export/import wiring that makes a bench survive a round
trip.

---

## Baseline correction (why this is a re-draft)

The original WP-404 (drafted off `1c8809f3`) was scoped to **flip `LAGN_VERSION`
from `1.1.0` to `1.3.0`** as its load-bearing step, plus a `packages/lagn-spec`
`package.json`/`validator.test.ts` lockstep and a §21 `api-endpoints.md` row move.
Between that draft and execution, **WP-405 flipped the writer to 1.4.0 and
WP-640/641 flipped it to 1.5.0** — each with its own server-side producer, exactly
the sequencing D-24213 records. Consequences, all verified against `cdff4ea6`:

- `packages/lagn-spec/src/validator.ts:78` is `LAGN_VERSION = LAGN_VERSION_1_3_0`?
  **No — it is `LAGN_VERSION_1_5_0`.** Flipping it to `1.3.0` would *regress*
  WP-405/640/641 (un-emitting `players` / `scoring_profile` / `battle_plan` /
  `result.score` from the result-LAGN producer). The flip is **not just done — it
  is past 1.3.0.** `packages/lagn-spec` is therefore **out of scope entirely.**
- `packages/lagn-spec/package.json` is already `1.5.0`; `validator.test.ts`
  already asserts `LAGN_VERSION === LAGN_VERSION_1_5_0` and the full 1.2.0→1.5.0
  migration chain. Nothing to change.
- `docs/ai/REFERENCE/api-endpoints.md` already records both endpoints at `1.5.0`,
  including "a bench on a 1.3.0 body is accepted and persisted verbatim" (WP-402)
  and the 1.5.0 writer (WP-641). **§21 is NOT triggered by this packet** — no
  endpoint signature or stamped version moves; the server reads the constant and
  the constant does not change here.
- `apps/registry-viewer` has **zero** `hero_alternates` / `heroAlternate`
  handling. The observable bench half is genuinely unshipped — that is this
  packet's whole scope.

The residual work is single-layer (`apps/registry-viewer`) + governance.

---

## Assumes

- **WP-402 ✅** — LAGN 1.3.0 + `setup.hero_alternates` on `main`.
- **WP-403 ✅** — the MATCH-SETUP envelope carries optional `heroAlternateIds`
  (`packages/registry/src/setupContract/**`, merged `cdff4ea6`). The viewer's
  draft *is* a `MatchSetupDocument` and every `setupContract` object is
  `.strict()`; without the envelope field the draft would **reject** a bench at
  parse. **The field is envelope-level** (`draft.heroAlternateIds`, beside
  `themeId` / `supportPools`) — **NOT** `composition.heroAlternateIds`.
- **D-24087 Active** — the saved-loadout library stores a **LAGN document**. That
  is why LAGN is the load-bearing path for this feature.
- **WP-291 ✅ / D-24075** — `parseLagnLoadout` is the single LAGN importer; this
  packet extends it and does **not** fork the validator.
- **WP-245 ✅** — `compositionToLagnSetup` is the single exporter mapping.
- **WP-362 ✅ / D-24154** — the `?lagn=` decode-only URL path; its second import
  consumer is `useLagnFromUrl.applyComposition`.
- **WP-405 ✅ / WP-641 ✅** — advanced `LAGN_VERSION` to `1.5.0`, so the writer is
  already past the `>= 1.3.0` hero_alternates gate.
- **D-24026** — user-visible surfaces require live verification on the deployed
  bundle, not a green local build.

---

## Context

### Why two slots in the UI and no cap in the schema

WP-402 deliberately ships `hero_alternates` unbounded (`.min(1)`, no `.max()`): a
cap in a published open standard cannot be relaxed without a major version. The
**two-slot affordance is a UI decision** and lives here, where it can change
freely. The operator asked for two; the standard does not care, and no schema (LAGN
or `setupContract`) gains a `.max()`.

### Why the field is envelope-level

WP-403 placed `heroAlternateIds` on the MATCH-SETUP **envelope**
(`SetupEnvelope`), not the nine-field composition lock. The viewer draft reads and
writes it at the document root (`draft.heroAlternateIds`), the same level as
`themeId` and `supportPools`. The `composition.heroAlternateIds` phrasing in the
original draft predated WP-403's finalized placement and is corrected here.

### The two import consumers

`parseLagnLoadout` extracts a `LagnLoadoutComposition`; two call sites apply it to
the draft via the public setter API — `LoadoutBuilder.applyLagnImport` (paste /
file) and `useLagnFromUrl.applyComposition` (the `?lagn=` deep link). Both apply
the bench (AC-5, AC-6), so **both source files are in scope**, not just their
tests.

### The export key-order whitelist (EC-425 trap)

`useLoadoutLagnExport.buildLagnFile` serializes through a `JSON.stringify`
replacer whose `keyOrder` array is a **whitelist**: any key absent from it is
dropped from the emitted file. `hero_alternates` must be added to `keyOrder`, or a
bench would live in memory, pass `validate()`, and then vanish from the downloaded
/ shared document — the exact save-and-come-back-empty failure D-24194 and EC-425
closed for `supportPools`.

---

## Scope (In)

1. **Draft state** — envelope-level `heroAlternateIds` on the viewer draft, with
   `addHeroAlternate` / `removeHeroAlternate` setters following the existing
   `addHeroGroup` / `removeHeroGroup` pattern (lazy-create the array; uncapped in
   the composable — the two-slot cap is UI-only). `resetDraft` already clears it
   (a blank draft omits the key).
2. **UI** — a bench section in `LoadoutBuilder.vue` (two slots) + bench display in
   `LoadoutTray.vue`, visually distinct from played heroes so the two are never
   confused at a glance.
3. **Export** — `compositionToLagnSetup` emits `setup.hero_alternates` from
   `draft.heroAlternateIds` when non-empty, **omits the key entirely** when empty
   (never `[]`), and `hero_alternates` is added to the export `keyOrder` whitelist.
4. **Import** — `parseLagnLoadout` reads `setup.hero_alternates` into
   `LagnLoadoutComposition.heroAlternateIds`; both apply sites
   (`LoadoutBuilder.applyLagnImport`, `useLagnFromUrl.applyComposition`) set it on
   the draft, applied atomically with the rest (setters only on `ok`), reusing the
   existing validator — **no fork**.
5. **Round-trip test** — export → import → identical bench. The asymmetry that
   WP-291 and EC-429 both existed to close is the recurring failure mode here.
6. Governance: D-24213 Active, `STATUS.md`, both indices, mindmap, and the
   `wiki/lagn-v1.md` `hero_alternates` producer note (the writer already emits
   `>= 1.3.0`; the viewer now produces a bench).

## Scope (Out)

- **`packages/lagn-spec`** — `validator.ts`, `package.json`, `validator.test.ts`.
  The writer already stamps `1.5.0` (WP-405/641); this packet performs **no**
  `LAGN_VERSION` flip and must not touch the contract package.
- **`docs/ai/REFERENCE/api-endpoints.md`** — already at `1.5.0` (WP-402/405/641);
  **§21 not triggered** — no endpoint or stamped-version movement here.
- **`apps/arena-client`** — the in-match "View loadout in Registry Viewer" link
  relays a **server-produced** LAGN projected from `matchConfiguration`, which has
  no bench and never will (D-24210). Displaying a bench on `SharedLoadoutPage` /
  `MyProfilePage` is a deliberate follow-on, not this packet.
- **`apps/server`** — no code change.
- **`packages/game-engine`** — untouched, including `versioning/**`.
  `finalStateHash` unchanged.
- Any bench **count** rule in schema or contract. The two slots are UI only.
- Any change to the `?lagn=` encode/decode contract (WP-362/363) beyond the
  payload now optionally carrying a bench (`lagnUrlParam.ts` unchanged — it
  base64url-encodes the whole document and enumerates no fields).
- Auto-substitution, drafting, banning, or any in-match use of the bench.

---

## Files Expected to Change

- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — **modified** — envelope state + setters
- `apps/registry-viewer/src/composables/useLoadoutDraft.test.ts` — **modified**
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` — **modified** — emit bench + keyOrder whitelist
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.test.ts` — **modified**
- `apps/registry-viewer/src/lib/loadoutLagnImport.ts` — **modified** — read bench into the composition
- `apps/registry-viewer/src/lib/loadoutLagnImport.test.ts` — **modified**
- `apps/registry-viewer/src/composables/useLagnFromUrl.ts` — **modified** — `applyComposition` applies the bench
- `apps/registry-viewer/src/composables/useLagnFromUrl.test.ts` — **modified** — bench via `?lagn=`
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — bench slots + `applyLagnImport`
- `apps/registry-viewer/src/components/LoadoutTray.vue` — **modified** — bench display
- `docs/ai/DECISIONS.md` — **modified** — D-24213 Active
- `docs/ai/STATUS.md` — **modified**
- `wiki/lagn-v1.md` — **modified** — `hero_alternates` producer note
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` /
  `docs/05-ROADMAP-MINDMAP.md` — **modified**

> The exact viewer test-file set is asserted at execution via `git ls-files` and
> becomes the scope lock (EC-432 pattern); the scaffold may add to it.

---

## Contract

**LAGN version posture (unchanged by this packet):**

| | 1.0.0 | 1.1.0 | 1.2.0 | 1.3.0 | 1.4.0 | 1.5.0 |
|---|---|---|---|---|---|---|
| Read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Written | no | no | no | no | no | **yes — `LAGN_VERSION`** |

The viewer exports at `LAGN_VERSION` (`1.5.0`), which satisfies the
`setup.hero_alternates` `>= 1.3.0` gate. Readers accept all six versions, so no
stored record migrates — the whole point of the read-set / write-value split.

**§21 (D-11804): NOT triggered.** No `apps/server` endpoint signature moves, and
the stamped `lagn_version` already reads `1.5.0` in `api-endpoints.md` (WP-641).
The viewer emitting an optional `setup.hero_alternates` block on an already-1.5.0
document is a client-side producer change with no catalogued-endpoint movement.

---

## Acceptance Criteria

- **AC-1** — Two bench slots are present in the Loadout tab and visually distinct
  from played heroes.
- **AC-2** — A bench hero **cannot** be added to played heroes and vice versa; the
  UI prevents it before validation does.
- **AC-3** — Export produces `lagn_version: "1.5.0"` (the current `LAGN_VERSION`)
  and a `setup.hero_alternates` block that survives the `keyOrder` whitelist; the
  exported document passes `validate()`.
- **AC-4** — Export **omits** `hero_alternates` entirely (not `[]`) when the bench
  is empty, and that document still passes `validate()`.
- **AC-5** — **Round trip:** export → import returns the identical bench (on the
  envelope `heroAlternateIds`), and a document with no bench imports to an empty
  bench without error.
- **AC-6** — A `?lagn=` link carrying a bench applies it to the draft and switches
  to the Loadout tab (WP-362 machinery, unchanged).
- **AC-7** — A malformed payload fails **visible** — a dismissible full-sentence
  error banner — and **does not wipe the draft** (atomic import).
- **AC-8** — `packages/lagn-spec` is **untouched**: `LAGN_VERSION` stays `1.5.0`
  (`>= 1.3.0`, so the bench export is a legal write); `git diff --name-only`
  contains no `packages/lagn-spec/**` path.
- **AC-9** — `packages/game-engine/**` is unchanged and `finalStateHash` is
  unmoved (assert, do not assume).
- **AC-10** — `pnpm --filter registry-viewer typecheck` exits 0. This is the
  load-bearing gate: `vite build` is esbuild and `node:test` runs via tsx —
  **neither typechecks SFCs** (recurred WP-166 / 207 / 227).
- **AC-11** — **D-24026 live verification** on deployed `cards.legendary-arena.com`:
  build a bench, save it, re-open it from the saved-loadout library, and confirm the
  bench survives. Per `feedback_verify_cross_surface_link_landing`, **drive the
  terminal action** — a rendering bench slot is not proof the round trip works.

---

## Verification Steps

```bash
pnpm -r build
pnpm --filter registry-viewer typecheck      # load-bearing; AC-10
pnpm --filter registry-viewer test
pnpm -r --no-bail test
git diff --name-only | grep -E 'game-engine|lagn-spec'   # expect NO output
pnpm roadmap:counts:check
```

Then the AC-11 live pass on the deployed bundle, after the deploy-confirmed SHA.

---

## Vision Alignment

- **Vision clauses touched:** §10a (Registry Viewer public surfaces), §19b
  (loadout library), NG-1.
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
  A hero bench is organizational convenience — it records a shortlist the player
  already assembled. It confers no in-match capability, since the bench never
  reaches `matchConfiguration` or any engine path (D-24210/D-24212), so it cannot
  become a competitive advantage.
- **Non-Goal proximity check:** NG-1 ("no pay-to-win") is the nearest Non-Goal
  and is **not crossed** — the bench is free, unmetered, ungated, and mechanically
  inert. The Loadout tab remains a `cards.legendary-arena.com` public surface with
  no new gate of any kind.
- **Determinism preservation:** No engine source changes; no RNG, scoring, replay,
  or simulation surface is touched. AC-9 pins `game-engine/**` unchanged and
  `finalStateHash` unmoved.

## Empirical Scaffold (REQUIRED — 01.4)

This packet adds an optional block to an existing export/import path and a new
optional field read on an existing input path; the scaffold confirms it is
additive.

1. **Export/round-trip** — a draft carrying `heroAlternateIds` exports a 1.5.0
   document whose `setup.hero_alternates` passes `validate()` and re-imports to the
   identical bench; an empty bench omits the key and still validates. Run the
   registry-viewer + lagn suites and record the counts.
2. **No writer flip needed** — confirm `LAGN_VERSION === '1.5.0'` on `main` and
   that a 1.5.0 document with `hero_alternates` validates. The original flip
   scaffold is **moot** — the writer is already past 1.3.0.

`pnpm -r build` **before** any dependent suite — apps import the built `dist`, and
a stale one yields both false green and false red.

---

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Non-negotiables | PASS — no engine edit; no lagn-spec edit; no validator/exporter fork; two-slot cap is UI-only |
| §3 Assumes | PASS — WP-402 ✅ + WP-403 ✅ landed; WP-405/641 ✅ (writer already 1.5.0) |
| §4 Context refs | PASS — D-24087 / D-24075 / D-24154 / D-24026 / D-24211 cited |
| §5 Output completeness | PASS — 10 code/test files (both import consumers included) + 6 governance; lagn-spec + api-endpoints REMOVED as already-shipped |
| §6 Naming | PASS — `hero_alternates` (LAGN snake_case) / `heroAlternateIds` (MATCH-SETUP camelCase, envelope-level); the rename is the same non-1:1 mapping the counts carry |
| §7 Dependency discipline | PASS — both hard-deps landed; no in-flight collision |
| §8 Architectural boundaries | PASS — single layer, `apps/registry-viewer` only |
| §9 Windows | PASS |
| §10 Env vars | N/A |
| §11 Auth | N/A — saved-loadout endpoints unchanged |
| §12 Test quality | PASS — AC-1..AC-11; AC-5 is an explicit round-trip test |
| §13 Commands | PASS |
| §14 AC quality | PASS — 11 binary criteria |
| §15 DoD | PASS |
| §15.1 D-24026 | **TRIGGERED** — `cards.legendary-arena.com`; AC-11 drives the terminal action |
| §16 Code style | PASS — reuses existing setters/mapping; no parallel importer; full-sentence errors |
| §17 Vision | PASS — VISION §19b loadout library; NG-1 untouched |
| §18 Determinism | **PASS, asserted** — AC-9 pins `game-engine/**` unchanged and `finalStateHash` unmoved |
| §19 Rollback | PASS — reverting removes the viewer bench affordance; already-written 1.5.0 documents stay readable (reader set unchanged) |
| §20 Migration | N/A — readers accept all six versions; no stored record migrates |
| §21 API catalog | **N/A** — no endpoint or stamped-version movement (already `1.5.0` on `main` per WP-641); the change is a client-side optional producer |

---

## Definition of Done

- [ ] AC-1..AC-11 each demonstrated with observed output
- [ ] Scaffold RUN and its counts recorded
- [ ] `pnpm --filter registry-viewer typecheck` 0 (AC-10, load-bearing)
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] `git diff --name-only` contains no `packages/game-engine/**` or
      `packages/lagn-spec/**` path
- [ ] D-24213 landed **Active**
- [ ] `wiki/lagn-v1.md` `hero_alternates` producer note updated
- [ ] **AC-11 live-verified on the deployed bundle** and the STATUS flip recorded
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0
