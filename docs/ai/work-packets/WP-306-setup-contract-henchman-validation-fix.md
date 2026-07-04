# WP-306 — Setup-Contract Per-Field ext_id Validation (Henchman Id-Space Fix)

**Status:** Draft (authored 2026-07-03; awaiting user review and execution)
**Primary Layer:** Registry (`packages/registry/`), with mechanical fixture
ripple into App-layer consumers (`apps/registry-viewer/` test stubs,
`apps/engine-runner/` fixtures).
**Baseline:** `origin/main` @ `71a6165c` (recorded per 01.0a Step 2).
**Dependencies:**
- **Hard:** WP-091 (`validateMatchSetupDocument` + `setupContract.types.ts` —
  the contract this WP widens). ✅ landed.
- **Hard:** WP-113 / D-10014 (engine's per-field qualified-ID validator +
  `listHenchmanGroupSlugsInSet` — the authoritative id space this WP mirrors).
  ✅ landed.
- **Hard:** D-24018 (the qualified-`extId` id-space invariant — layer-2 must
  accept exactly the layer-3 id space). ✅ landed.
- **Hard:** WP-304 / EC-334 (engine-runner — the shipped consumer whose
  `scenario.valid.json` fixture this WP corrects). ✅ landed (`2de09ff9`).
- **Related (NOT a dependency, NOT superseding):** WP-122 (viewer henchman
  `flattenSet` emission) — a *distinct* draft that populates the builder's
  empty henchman *picker* (`apps/registry-viewer/src/registry/shared.ts`). It
  does not touch the validator and does not fix this gap; see §Context.

---

## Goal

After this session, `validateMatchSetupDocument` (the registry-side,
browser-safe MATCH-SETUP validator) validates each composition field against
its **own** entity id-space — mirroring the engine's authoritative per-field
validator — instead of one type-blind global set built from
`listCards().extId`. Concretely: a `henchmanGroupIds` entry such as
`core/sentinel` (which the engine's `validateMatchSetup` accepts, but which is
**not** a flat-card `extId` — `flattenSet` emits zero henchmen) is accepted by
layer-2; and a cross-type id such as `core/hydra` (a **villain** group) placed
in the `henchmanGroupIds` slot is **rejected**. This closes the D-24018
"layer-2 accepts exactly the layer-3 id space" invariant for the one field it
currently violates, unblocking the engine-runner (which rejects every
henchman-bearing scenario today) and the registry-viewer loadout builder's
import / URL-preview / live-validation paths.

---

## Assumes

- WP-091 complete: `validateMatchSetupDocument`,
  `setupContract.types.ts` (`CardRegistryReader`), and `setupContract.test.ts`
  exist and the registry suite is green (baseline **19 / 0** in
  `packages/registry/src/setupContract/setupContract.test.ts`, observed
  2026-07-03).
- D-10014 complete: the engine's `buildKnownHenchmanGroupQualifiedIds` +
  `listHenchmanGroupSlugsInSet` derive henchman-group slugs from
  `setData.henchmen[].slug`. This WP re-derives the SAME grammar registry-side
  (no `@legendary-arena/game-engine` import — layer boundary).
- The real `CardRegistry` (both `localRegistry` and the viewer's
  `httpRegistry`) already exposes `listCards()` (with `cardType`), `listSets()`,
  and `getSet()` — verified: `httpRegistry.ts` provides `listSets`/`getSet`,
  so **no production consumer breaks** when `CardRegistryReader` is widened;
  only narrow *test stubs* need the two methods added.
- `data/cards/*.json` henchman entries carry `slug` (confirmed via probe:
  `listHenchmanGroupSlugsInSet(getSet('core'))` →
  `[doombot-legion, hand-ninjas, savage-land-mutates, sentinel]`).

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

The registry-side validator builds its known-id set from
`registry.listCards().map(c => c.extId)` and checks **all five** composition
fields against that single set. Its own comment claims the set "never rejects
an engine-valid id." That claim is false in two directions, and both were
confirmed empirically (probe + scaffold, 2026-07-03):

- **False reject.** `flattenSet` emits flat cards for heroes, masterminds,
  villains, and schemes — **never henchmen** (probe: `flat cards with cardType
  'henchman': 0`). So the global set contains **no** henchman-group `extId`,
  and `validateMatchSetupDocument` returns `unknown_extid` for **every**
  `henchmanGroupIds` entry — while the engine's authoritative
  `validateMatchSetup` accepts it.
- **False accept.** Because the set is type-blind, a **villain** id
  (`core/hydra`) placed in the henchman slot *passes* layer-2 (the set
  contains `core/hydra` as a villain `extId`); the engine's per-field
  validator would reject it. The engine-runner's own `scenario.valid.json`
  relies on exactly this accident (`henchmanGroupIds: ["core/hydra"]`).

**Live impact (why now):**
- `apps/engine-runner` (WP-304, shipped `2de09ff9`) validates every scenario
  UP FRONT with `validateMatchSetupDocument` as its **sole** gate
  (`runMatch.ts:loadScenarioDocument`, exit code 2 on failure) — the
  simulation path does not run the engine validator. So **any** scenario with
  a real henchman group is rejected exit-2. Standard Legendary setups almost
  always include a henchman group.
- The registry-viewer loadout builder validates live via
  `validateMatchSetupDocument` (`useLoadoutDraft`, `useSetupFromUrl`): importing
  or URL-previewing any engine-valid loadout with a henchman group fails, and
  the live panel shows a false `unknown_extid`.

**Relationship to WP-122 (distinct, complementary).** WP-122 fixes the
*viewer-local* `flattenSet` (`apps/registry-viewer/src/registry/shared.ts`) so
the builder's henchman *picker* is non-empty — a different file, a different
symptom (Gap B: unpickable henchmen). It does **not** touch the validator and
does **not** fix this gap; its 2026-05-01 rationale ("the engine has no
consumer of henchman FlatCards") predates D-24018 making the validator a
`FlatCard.extId` consumer, and is now stale. This WP's per-field approach
derives henchman ids from **set data**, so it is correct independently of
whether either `flattenSet` copy ever emits henchmen. The two WPs do not
overlap and neither subsumes the other.

Read before coding:
- `packages/registry/src/setupContract/setupContract.validate.ts` — Step 2
  (the global-set logic to replace) + the false "never rejects" comment.
- `packages/registry/src/setupContract/setupContract.types.ts` —
  `CardRegistryReader` (the contract file to widen).
- `packages/game-engine/src/matchSetup.validate.ts` —
  `buildKnownHenchmanGroupQualifiedIds` + the five per-field builders (the
  authoritative pattern to mirror, NOT import).
- `packages/game-engine/src/villainDeck/villainDeck.setup.ts` —
  `listHenchmanGroupSlugsInSet` (the henchman slug grammar; re-derive locally).
- `packages/registry/src/shared.ts` — `flattenSet` (confirm it emits no
  henchmen; carries `cardType` + `extId` on every card it does emit).
- `.claude/rules/code-style.md §Contract Files` + `§Data Contracts` — the
  `.types.ts` lock and the `DECISIONS.md`-entry requirement for a contract
  change.
- `docs/ai/DECISIONS.md` — D-24018, D-10014 (cited); D-24091 is the new entry.

---

## Scope (In)

### A) `packages/registry/src/setupContract/setupContract.types.ts` — modified (CONTRACT FILE)
Widen `CardRegistryReader` from `{ listCards(): Array<{ extId }> }` to add
`cardType` on the card element and two set-data accessors:
```ts
listCards(): Array<{ extId: string; cardType: string }>;
listSets(): Array<{ abbr: string }>;
getSet(abbr: string): unknown | undefined;
```
This is authorized by D-24091 (drafted this WP). Comment the `why:` citing
D-24091 + D-10014 (henchman ids are not flat cards; derive from set data).

### B) `packages/registry/src/setupContract/setupContract.validate.ts` — modified
Replace the single type-blind `knownExtIds` set (Step 2) with five per-field
known sets:
- scheme / mastermind / villain-group / hero — derived from `listCards()`
  filtered by `cardType` (their `extId` is emitted by `flattenSet`).
- henchman-group — derived from set data
  (`listSets()` → `getSet(abbr)` → `setData.henchmen[].slug` →
  `` `${abbr}/${slug}` ``), mirroring the engine's
  `buildKnownHenchmanGroupQualifiedIds`. Re-derived locally (no game-engine
  import). `for...of` only (no `.reduce()`).
Check each composition field against its own set. Correct the false
"never rejects an engine-valid id" comment to describe the per-field
isolation. Per-field `unknown_extid` messages name the entity kind
("scheme", "mastermind", "villain group", "henchman group", "hero").

### C) `packages/registry/src/setupContract/setupContract.test.ts` — modified
- Rebuild `buildStubRegistry()` to the widened shape: `cardType` on each
  `listCards()` entry, `listSets()` → `[{ abbr: "core" }]`, `getSet("core")`
  → set data whose `henchmen[]` carries `{ slug: "henchman-group-one" }`.
- Add henchman-specific cases: (1) a real henchman group id (present only in
  set data, absent from `listCards`) is **accepted**; (2) a cross-type id
  (a villain `extId`) in the `henchmanGroupIds` slot is **rejected** with
  `unknown_extid`.

### D) `apps/registry-viewer/src/composables/useLoadoutDraft.test.ts` + `useSetupFromUrl.test.ts` — modified
Add `listSets()` + `getSet()` (and `cardType` where the stub lacks it) to the
narrow validator stubs so they satisfy the widened `CardRegistryReader`. Test
behavior unchanged; these are fixture-shape updates only.

### E) `apps/engine-runner/src/fixtures/scenario.valid.json` + `scenario.invalid.json` + `runMatch.test.ts` — modified
- `scenario.valid.json`: `henchmanGroupIds: ["core/hydra"]` → `["core/sentinel"]`
  (a real core henchman the fix accepts; hydra is a villain).
- `scenario.invalid.json`: same henchman correction, so the fixture remains
  invalid for its **intended single reason** (`core/this-scheme-does-not-exist`)
  and not a second latent henchman defect.
- `runMatch.test.ts`: the inline `henchmanGroupIds: ["core/hydra"]` (≈ line 93)
  → `["core/sentinel"]`.

---

## Scope (Out)

- **No `flattenSet` change** (neither `packages/registry/src/shared.ts` nor the
  viewer copy). Henchman ids derive from set data, not from FlatCard emission.
  Populating the builder's henchman picker is WP-122's job, not this WP's.
- **No engine change** (`packages/game-engine/**`). The engine's per-field
  validator is already correct; this WP mirrors it registry-side.
- **No new endpoint, route, or DB surface.** `apps/server` untouched → §21
  api-catalog N/A.
- **No `MatchSetupConfig` / composition 9-field change.** The composition lock
  is untouched; only the reader interface widens.
- **No lobby (`parseLoadoutJson`) change.** It is a grammar-only guard and is
  not affected.

---

## Files Expected to Change

- `packages/registry/src/setupContract/setupContract.types.ts` — modified (contract widen; D-24091).
- `packages/registry/src/setupContract/setupContract.validate.ts` — modified (per-field sets; comment fix).
- `packages/registry/src/setupContract/setupContract.test.ts` — modified (stub rebuild + 2 henchman cases).
- `apps/registry-viewer/src/composables/useLoadoutDraft.test.ts` — modified (stub gains listSets/getSet).
- `apps/registry-viewer/src/composables/useSetupFromUrl.test.ts` — modified (stub gains listSets/getSet).
- `apps/engine-runner/src/fixtures/scenario.valid.json` — modified (henchman → core/sentinel).
- `apps/engine-runner/src/fixtures/scenario.invalid.json` — modified (henchman → core/sentinel).
- `apps/engine-runner/src/runMatch.test.ts` — modified (inline henchman → core/sentinel).
- `docs/ai/DECISIONS.md` — modified (D-24091 flips Drafted → Active).
- `docs/ai/work-packets/WORK_INDEX.md` — modified (WP-306 row checked off).
- `docs/ai/execution-checklists/EC_INDEX.md` — modified (EC-336 → Done).
- `docs/ai/STATUS.md` — modified (WP-306 execution entry).

---

## Contract

- **`CardRegistryReader` (widened, D-24091):**
  `listCards(): Array<{ extId: string; cardType: string }>`,
  `listSets(): Array<{ abbr: string }>`, `getSet(abbr: string): unknown | undefined`.
  The real `CardRegistry` satisfies this structurally (no production change).
- **Per-field acceptance:** a composition id is accepted iff it is present in
  its own field's known set (scheme/mastermind/villain/hero from
  `listCards` by `cardType`; henchman from `setData.henchmen[].slug`). This is
  the D-24018 "layer-2 = layer-3 id space" invariant, now closed for henchmen.

---

## Acceptance Criteria

- [ ] `validateMatchSetupDocument` accepts a composition whose
      `henchmanGroupIds` is a real henchman group id (e.g. `core/sentinel`)
      absent from `listCards().extId`.
- [ ] It rejects a cross-type id (a villain `extId`) placed in
      `henchmanGroupIds` with `unknown_extid`.
- [ ] The false "never rejects an engine-valid id" comment is corrected to
      describe per-field isolation.
- [ ] `CardRegistryReader` is widened per D-24091; the drift/compile checks in
      `setupContract.test.ts` still hold.
- [ ] `pnpm --filter @legendary-arena/registry test` is green (≥ 19 + the 2
      new henchman cases, 0 fail).
- [ ] `pnpm --filter engine-runner test` is green (7 / 0) after the fixture
      corrections (was 5 / 2 under the fix with the stale `core/hydra`
      henchman).
- [ ] `pnpm --filter registry-viewer test` is green (stub-shape updates only).
- [ ] `pnpm -r build` exits 0.
- [ ] `git diff --name-only` shows only §Files Expected to Change.
- [ ] No `@legendary-arena/game-engine` import added to `packages/registry/**`.

---

## Verification Steps

```pwsh
# 1. Registry validator suite (new henchman cases + rebuilt stub)
pnpm --filter @legendary-arena/registry test        # expect ≥ 21 / 0

# 2. Engine-runner suite (fixtures corrected)
pnpm -r build
pnpm --filter engine-runner test                    # expect 7 / 0

# 3. Registry-viewer suite (stub-shape updates)
pnpm --filter registry-viewer test                  # expect prior baseline / 0

# 4. Layer-boundary grep — no engine import registry-side
Select-String -Path "packages\registry\src\setupContract\*.ts" -Pattern "game-engine"
# Expected: zero matches.

# 5. Scope
git diff --name-only                                # only §Files Expected to Change
```

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] All Verification Steps pass.
- [ ] D-24091 in `docs/ai/DECISIONS.md` flipped Drafted → Active.
- [ ] `docs/ai/STATUS.md` updated with the WP-306 execution entry.
- [ ] `WORK_INDEX.md` WP-306 row checked off (date + commit hash).
- [ ] `EC_INDEX.md` EC-336 row set to `Done <date>`.
- [ ] Commit prefix `EC-336:` (impl) + `SPEC:` (govern-close) per `01.3`.
- [ ] `User-Visible Surface`: the engine-runner is dev/ops tooling and the
      registry-viewer builder change is validation-only; D-24026 live-verify
      = **N/A** (no play.legendary-arena.com surface). Proof = the three
      suites + `pnpm -r build`.

---

## Lint-Gate Self-Review (per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`)

| §  | Topic | Disposition |
|----|-------|-------------|
| 1  | WP structure | PASS — all required sections present, in order. |
| 2  | Non-Negotiable Constraints | PASS — ESM/`node:`/`.test.ts`/no-`.reduce()`/no-`Math.random` apply; the per-field henchman derivation uses `for...of`; contract widen is the only interface change and is D-entry-authorized. |
| 3  | `## Assumes` | PASS — WP-091, WP-113/D-10014, D-24018, WP-304 deps + registry/httpRegistry shape assumption + observed 19/0 baseline. |
| 4  | `## Context (Read First)` | PASS — specific files cited; false-reject/false-accept both evidenced; WP-122 relationship + stale-rationale documented. |
| 5  | `## Files Expected to Change` | PASS — 12 files (3 registry, 2 viewer test, 3 engine-runner, 4 governance), each `— modified` with a reason. |
| 6  | Naming consistency | PASS — `cardType`, `henchmanGroupIds`, `extId` match canonical field names; no abbreviations. |
| 7  | Dependency discipline | PASS — no new npm dep; no `game-engine` import registry-side (grep-gated). |
| 8  | Architectural boundaries | PASS — logic stays in Registry; viewer/engine-runner changes are mechanical fixture updates; no upward/sideways import. |
| 9  | Windows compatibility | PASS — Verification uses `pwsh` `Select-String`. |
| 10 | Environment variable hygiene | N/A — no env vars. |
| 11 | Authentication clarity | N/A — no auth surface. |
| 12 | Test quality | PASS — `node:test` + `node:assert`; deterministic; no boardgame.io import; the henchman cases assert both accept and reject. |
| 13 | Commands and verification | PASS — exact `pnpm` invocations with expected counts (empirically grounded by the scaffold). |
| 14 | Acceptance criteria quality | PASS — 9 binary, observable items. |
| 15 | Definition of Done | PASS — STATUS/DECISIONS/WORK_INDEX/EC_INDEX + scope + build. |
| 16 | Code style | PASS — full English names; `// why:` on the widen + the per-field set builders + the corrected comment; no `.reduce()`. |
| 17 | Vision Alignment | PASS — §10a (registry-viewer public tooling) + dev/ops tooling; no NG-1..7 crossed; determinism N/A (pure validator). |
| 18 | Prose-vs-grep discipline | PASS — the `game-engine` grep (step 4) targets a forbidden import; the `// why:` comments paraphrase to avoid self-tripping it (per `feedback_grep_gate_comment_self_trip`). |
| 19 | Bridge-vs-HEAD staleness | N/A — not a repo-state-summarizing artifact. Baseline `71a6165c` recorded per Step 2. |
| 20 | Funding Surface Gate | N/A — no funding surface, no user-visible copy. |
| 21 | API Catalog Update | N/A — no `apps/server` HTTP or library surface touched. |

**Final gate:** PASS.

## Pre-Flight (per `01.4`) — READY TO EXECUTE

**Empirical Scaffold (validation-tightening WP, 2026-07-03, prototyped on the
canonical checkout for the three registry files — byte-identical to
`71a6165c`):**
- `packages/registry` setupContract baseline **19 / 0**. With the per-field
  validator + the OLD stub: **8 fail** (#2,#3,#4,#13,#14,#15,#18,#19 — every
  existence test). With the rebuilt widened stub: **19 / 0** — confirming the
  stub rebuild is the complete registry-side fixture cost.
- `apps/engine-runner` runMatch baseline **7 / 0**. With the fix in the
  registry `dist`: **5 / 2** — the two fails are "run on a valid scenario" and
  "verify returns identical", both from `scenario.valid.json`
  `henchmanGroupIds: ["core/hydra"]` (a villain) now correctly rejected.
  Corrected fixtures restore 7 / 0.
- Prototype reverted; canonical checkout confirmed pristine (19 / 0).

Dependencies verified on `main` (WP-091, WP-113/D-10014, D-24018, WP-304 all
landed). Scope locked to 12 files. No ambiguity outstanding. **Verdict: READY
TO EXECUTE.**

## Copilot Check (per `01.7`) — PASS

Audited against the 30 failure modes. Notable clears: (1) contract-file change
is D-entry-authorized (D-24091) — not a silent `.types.ts` edit; (2)
cross-package ripple is mechanical fixture updates, not multi-layer logic
ownership; (3) validation-tightening surfaced its full fixture tail via the
scaffold, not by reasoning; (4) the `game-engine` grep gate is not self-tripped
by the `// why:` comments. One RISK noted and accepted: the widened
`CardRegistryReader` adds **required** members; the real registries provide
them, but any *future* narrow stub must too — mitigated by the interface being
the single structural source. **Verdict: PASS.**
