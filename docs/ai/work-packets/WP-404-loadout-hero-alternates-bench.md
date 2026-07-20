# WP-404 — Hero Alternates in the Loadout Tab + LAGN Writer Flip (Registry Viewer)

**Layer:** App (`apps/registry-viewer`) + a single locked constant in `packages/lagn-spec`
**EC:** `docs/ai/execution-checklists/EC-439-loadout-hero-alternates-bench.checklist.md`
**Reserves:** D-24213
**Baseline:** drafted off `origin/main` @ `1c8809f3`
**User-Visible Surface:** `cards.legendary-arena.com` — **D-24026 live verification REQUIRED**

---

## Goal

Give the Registry Viewer's Loadout tab a **hero bench**: two alternate slots
alongside the played heroes, carried through the draft, the LAGN export, the
`?lagn=` share link, and the saved-loadout library. A player builds a seven-hero
shortlist — five played, two in reserve — saves or shares it, re-opens it, and the
reserves are still there.

This packet also **flips `LAGN_VERSION` from `1.1.0` to `1.3.0`**, the step that
makes every prior packet in the arc observable. Until it lands, the bench cannot
survive a round trip: the version gate rejects a bench on a pre-1.3.0 document, so
a producer still stamping 1.1.0 cannot emit one at all.

---

## Assumes

- **WP-402 ⏸ must land first** — LAGN 1.3.0 + `setup.hero_alternates`.
- **WP-403 ⏸ must land first** — MATCH-SETUP envelope `heroAlternateIds`. The
  viewer's draft is a `MatchSetupDocument` and every `setupContract` object is
  `.strict()`; without the envelope field the draft **rejects** a bench at parse.
- **D-24087 Active** — the saved-loadout library stores a **LAGN document**. That
  is why LAGN is the load-bearing path for this feature.
- **WP-291 ✅ / D-24075** — `parseLagnLoadout` is the single LAGN importer; this
  packet extends it and does **not** fork the validator.
- **WP-245 ✅** — `compositionToLagnSetup` is the single exporter mapping.
- **WP-362 ✅ / D-24154** — the `?lagn=` decode-only URL path.
- **D-24026** — user-visible surfaces require live verification on the deployed
  bundle, not a green local build.

---

## Context

### Why the flip belongs here and not earlier

`validator.ts` freezes the writer with a comment that already prescribes the
sequencing: *"The producer-wiring packet flips this together with the producers."*
WP-394 deliberately declined to bump for provenance because nothing produced it —
bumping would have moved a catalogued endpoint's wire format for zero benefit.
Here the benefit exists and arrives in the same commit as the producer.
**D-24213** records the rule so the next version add follows it rather than
re-deriving it.

The flip jumps `1.1.0 → 1.3.0`, skipping 1.2.0. That is intentional and free:
provenance is optional and unpopulated, so a 1.3.0 stamp carries it no differently.

### Measured blast radius (scaffold-observed, not grep-inferred)

The draft-time flip scaffold (`LAGN_VERSION` → a version past 1.1.0,
`pnpm -r build && pnpm -r --no-bail test`) is the authority here — a literal
grep would have misled. **The flip breaks 5 tests, all inside
`packages/lagn-spec/src/validator.test.ts`** (the writer-version assertion, two
`migrateToCurrent` cases, the derived-schema enum, and the AC-5 migration-target
case). Those are the intended behaviour changes and are updated with the flip.

**`packages/registry-viewer` breaks zero tests** (174 / 174 under the scaffold).
The two literal `'1.1.0'` occurrences in `useLagnFromUrl.test.ts:168` and
`loadoutLagnImport.test.ts:127` are **input-document fixtures on an
still-accepted read version** — importing a 1.1.0 document keeps working after
the writer moves, so the flip alone does not touch them. They are edited in this
packet only to add **bench** coverage (a 1.3.0 import fixture), not because the
flip breaks them.

**`migrate.ts` needs no source edit:** `migrateToCurrent` targets `LAGN_VERSION`
dynamically (`migrate.ts:109`), and WP-402 registers the 1.2.0 → 1.3.0 hop, so
flipping the constant activates it with no change to `migrate.ts` itself.

Every other consumer reads the `LAGN_VERSION` constant, so the flip propagates
automatically — including `apps/server`'s `matchLagn.logic.ts`, which needs no
code edit.

**Trap, called out because a naive grep will surface it:**
`packages/game-engine/src/versioning/versioning.check.ts:35` contains `1.1.0` in
a comment for the **engine save-version namespace, not LAGN.** It must not be
touched; changing it would move a determinism surface for an unrelated reason.

### Why two slots in the UI and no cap in the schema

WP-402 deliberately ships `hero_alternates` unbounded (`.min(1)`, no `.max()`): a
cap in a published open standard cannot be relaxed without a major version. The
**two-slot affordance is a UI decision** and lives here, where it can change
freely. The operator asked for two; the standard does not care.

---

## Scope (In)

1. **Draft state** — `heroAlternateIds` on the viewer draft, with
   `addHeroAlternate` / `removeHeroAlternate` setters following the existing
   `addHeroGroup` / `removeHeroGroup` pattern; cleared by `resetDraft`.
2. **UI** — a bench section in `LoadoutBuilder.vue` (two slots) + bench display in
   `LoadoutTray.vue`, visually distinct from played heroes so the two are never
   confused at a glance.
3. **Export** — `compositionToLagnSetup` emits `setup.hero_alternates` when the
   bench is non-empty, and **omits the key entirely** when empty (never `[]`).
4. **Import** — `parseLagnLoadout` reads `setup.hero_alternates` into
   `composition.heroAlternateIds`, applied atomically with the rest of the draft
   (setters only on `ok`), reusing the existing validator — **no fork**.
5. **Writer flip** — `LAGN_VERSION = LAGN_VERSION_1_3_0` in
   `packages/lagn-spec/src/validator.ts`, plus the `package.json` version +
   description bump **in the same commit** (the EC-422 lockstep miss).
6. **Round-trip test** — export → import → identical bench. The asymmetry that
   WP-291 and EC-429 both existed to close is the recurring failure mode here.
7. Governance: D-24213 Active, `api-endpoints.md` (§21 TRIGGERED), `STATUS.md`,
   both indices, mindmap, and the `wiki/lagn-v1.md` version table.

## Scope (Out)

- **`apps/arena-client`** — the in-match "View loadout in Registry Viewer" link
  relays a **server-produced** LAGN projected from `matchConfiguration`, which has
  no bench and never will (D-24210). Displaying a bench on `SharedLoadoutPage` /
  `MyProfilePage` is a deliberate follow-on, not this packet.
- **`apps/server`** — no code change. The endpoint's stamped version moves because
  it reads the constant; that is the flip, not a server edit.
- **`packages/game-engine`** — untouched, including `versioning/**` (see the trap
  above). `finalStateHash` unchanged.
- Any bench **count** rule in schema or contract. The two slots are UI only.
- Any change to the `?lagn=` encode/decode contract (WP-362/WP-363) beyond the
  payload now optionally carrying a bench.
- Auto-substitution, drafting, banning, or any in-match use of the bench.

---

## Files Expected to Change

- `packages/lagn-spec/src/validator.ts` — **modified** — `LAGN_VERSION` flip (one constant)
- `packages/lagn-spec/package.json` — **modified** — version + description lockstep
- `packages/lagn-spec/src/validator.test.ts` — **modified** — the `LAGN_VERSION` assertion
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — **modified** — state + setters
- `apps/registry-viewer/src/composables/useLoadoutDraft.test.ts` — **modified**
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` — **modified** — emit bench
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.test.ts` — **modified**
- `apps/registry-viewer/src/lib/loadoutLagnImport.ts` — **modified** — read bench (no version literal here; it reads the constant)
- `apps/registry-viewer/src/lib/loadoutLagnImport.test.ts` — **modified** — add a 1.3.0-with-bench import fixture (flip does not break the existing one)
- `apps/registry-viewer/src/composables/useLagnFromUrl.test.ts` — **modified** — bench via `?lagn=` (existing 1.1.0 fixture unaffected by the flip)
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — bench slots
- `apps/registry-viewer/src/components/LoadoutTray.vue` — **modified** — bench display
- `docs/ai/DECISIONS.md` — **modified** — D-24213 Active
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — rows replaced WHOLE (D-11804)
- `docs/ai/STATUS.md` — **modified**
- `wiki/lagn-v1.md` — **modified** — version table + `hero_alternates`
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` /
  `docs/05-ROADMAP-MINDMAP.md` — **modified**

> The exact viewer test-file set is asserted at execution via `git ls-files` and
> becomes the scope lock (EC-432 pattern); the scaffold may add to it.

---

## Contract

**Version table after this packet:**

| | 1.0.0 | 1.1.0 | 1.2.0 | 1.3.0 |
|---|---|---|---|---|
| Read | ✅ | ✅ | ✅ | ✅ |
| Written | no | no | no | **yes — `LAGN_VERSION`** |

**§21 (D-11804) is TRIGGERED.** Two movements, both requiring whole-row
replacement:

1. `GET /api/match/:matchId/lagn` — the response's `lagn_version` value changes
   `1.1.0` → `1.3.0`.
2. `POST /api/me/loadouts` — the accepted body may now carry
   `setup.hero_alternates` on a 1.3.0 document.

Readers accept all four versions, so **no stored record requires migration** —
that asymmetry is the whole point of the read-set / write-value split.

---

## Acceptance Criteria

- **AC-1** — Two bench slots are present in the Loadout tab and visually distinct
  from played heroes.
- **AC-2** — A bench hero **cannot** be added to played heroes and vice versa; the
  UI prevents it before validation does.
- **AC-3** — Export produces `lagn_version: "1.3.0"` and a `setup.hero_alternates`
  block; the exported document passes `validate()`.
- **AC-4** — Export **omits** `hero_alternates` entirely (not `[]`) when the bench
  is empty, and that document still passes `validate()`.
- **AC-5** — **Round trip:** export → import returns the identical bench, and a
  document with no bench imports to an empty bench without error.
- **AC-6** — A `?lagn=` link carrying a bench applies it to the draft and switches
  to the Loadout tab (WP-362 machinery, unchanged).
- **AC-7** — A malformed / pre-1.3.0-with-bench payload fails **visible** — a
  dismissible full-sentence error banner — and **does not wipe the draft**.
- **AC-8** — `LAGN_VERSION === '1.3.0'`, asserted by test; `packages/lagn-spec`
  `package.json` agrees.
- **AC-9** — `packages/game-engine/src/versioning/**` is unchanged and
  `finalStateHash` is unmoved (assert, do not assume).
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
pnpm --filter @legendary-arena/lagn test
pnpm --filter registry-viewer typecheck      # load-bearing; AC-10
pnpm --filter registry-viewer test
pnpm -r --no-bail test
git diff --name-only | grep game-engine        # expect NO output
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
  inert. NG-2..7 are not approached: no monetization, cosmetic, persuasion,
  identity, or live-ops surface is touched. The Loadout tab remains a
  `cards.legendary-arena.com` public surface with no new gate of any kind.
- **Determinism preservation:** No RNG, scoring, replay, or simulation surface is
  touched, and no engine source changes. The one adjacent risk — the engine
  save-version namespace in `packages/game-engine/src/versioning/**` sharing the
  string `1.1.0` with LAGN — is called out as a trap in §Context and pinned by
  **AC-9**, which asserts those files unchanged and `finalStateHash` unmoved.
  Replay faithfulness is untouched: the bench is absent from every replay path by
  construction.

## Empirical Scaffold (REQUIRED — 01.4)

Both scaffolds were **RUN at draft** (proxying the flip to 1.2.0, since
`LAGN_VERSION_1_3_0` does not exist until WP-402 lands) and re-run at execution
against the real 1.3.0 constant:

1. **The flip alone** — `LAGN_VERSION` moved off 1.1.0, `pnpm -r build &&
   pnpm -r --no-bail test`. **Observed: 5 failures, every one in
   `packages/lagn-spec/src/validator.test.ts`** (writer assertion, two
   `migrateToCurrent` cases, derived-schema enum, AC-5 migration-target); **zero**
   viewer failures (registry-viewer 174 / 174); **zero** engine failures. This
   *falsified* the naive expectation that the viewer version literals would break —
   they are input fixtures on an accepted read version. Nothing outside the already
   in-scope files needed folding in.
2. **The envelope field in the draft** — a `MatchSetupDocument` carrying
   `heroAlternateIds` validated against the (scaffolded) WP-403 `setupContract`
   with the registry suite green (178 / 178). Confirms the round trip is possible
   once WP-403 lands; if it is not present on `main`, this packet is **BLOCKED**.

`pnpm -r build` **before** any dependent suite — apps import the built `dist`, and
a stale one yields both false green and false red.

---

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Non-negotiables | PASS — no engine edit; no validator fork; two-slot cap is UI-only |
| §3 Assumes | PASS — WP-402 ⏸ + WP-403 ⏸ named as blocking hard-deps |
| §4 Context refs | PASS — D-24087 / D-24075 / D-24154 / D-24026 cited |
| §5 Output completeness | PASS — 18-file allowlist; viewer test set resolved at execution |
| §6 Naming | PASS — `hero_alternates` (LAGN snake_case) / `heroAlternateIds` (MATCH-SETUP camelCase); the rename is the same non-1:1 mapping the counts already carry |
| §7 Dependency discipline | **BLOCKED-aware** — both hard-deps stated as ⏸, not assumed |
| §8 Architectural boundaries | PASS — viewer app + one locked constant in the contract package, explicitly authorized by §Scope (In) #5 and D-24213 |
| §9 Windows | PASS |
| §10 Env vars | N/A |
| §11 Auth | N/A in this packet — the saved-loadout endpoints are unchanged; auth posture is WP-302's and is not re-litigated |
| §12 Test quality | PASS — AC-1..AC-11; AC-5 is an explicit round-trip test, the recurring failure mode |
| §13 Commands | PASS |
| §14 AC quality | PASS — 11 binary criteria |
| §15 DoD | PASS |
| §15.1 D-24026 | **TRIGGERED** — `cards.legendary-arena.com`; AC-11 drives the terminal action, not just the render |
| §16 Code style | PASS — reuses existing setters/mapping; no parallel importer; full-sentence errors |
| §17 Vision | PASS — VISION §19b loadout library. No conflict: a bench is organizational convenience, confers no gameplay advantage, so NG-1 is untouched |
| §18 Determinism | **PASS, asserted** — AC-9 pins `game-engine/versioning/**` unchanged and `finalStateHash` unmoved |
| §19 Rollback | PASS — reverting restores `LAGN_VERSION = 1.1.0`; 1.3.0 documents already written stay **readable**, since the read set is unchanged by a revert |
| §20 Migration | N/A — readers accept all four versions; no stored record migrates |
| §21 API catalog | **TRIGGERED** — two rows move; replaced WHOLE per D-11804 |

---

## Definition of Done

- [ ] AC-1..AC-11 each demonstrated with observed output
- [ ] Both scaffolds RUN and their counts recorded
- [ ] `pnpm --filter registry-viewer typecheck` 0 (AC-10, load-bearing)
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] `git diff --name-only` contains no `packages/game-engine/**` path
- [ ] `package.json` bumped in the **same commit** as the constant
- [ ] D-24213 landed **Active**; `api-endpoints.md` rows replaced WHOLE
- [ ] `wiki/lagn-v1.md` version table updated
- [ ] **AC-11 live-verified on the deployed bundle** and the STATUS flip recorded
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0
