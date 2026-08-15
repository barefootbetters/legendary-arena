# WP-549 — Registry Viewer LAGN Result Round-Trip

**Status:** Draft 2026-08-15
**Layer:** App (`apps/registry-viewer`) — single layer
**Depends on:** WP-245 / EC-276 (the Loadout-tab LAGN export surface) · WP-291 /
EC-323 / D-24075 (the LAGN importer) · EC-429 / D-24195 (the support-pools
round-trip precedent this one mirrors)
**Reserves:** EC-584 · D-24358
**Baseline:** `origin/main` @ `0e336ff144d6ff826e2f8bb99a5d81c23c15f470`
**Lane:** Standard two-session (8 files; app-layer only; no engine / server /
registry change).

---

## 1. Goal

A LAGN file imported into the Registry Viewer's Loadout tab and re-exported
must carry back the **same** `result.outcome` it arrived with — and a loadout
that never had an outcome must export **no `result` block at all**, rather than
a fabricated `"victory"`. Today the viewer silently invents a match verdict:
a real co-op **loss** re-exports as a **victory**.

## 2. Assumes

- **WP-245 / EC-276** shipped the Loadout-tab LAGN export
  (`useLoadoutLagnExport.ts`), including the user-facing outcome `<select>`.
- **WP-291 / EC-323 / D-24075** shipped the LAGN importer
  (`loadoutLagnImport.ts`) and its `LagnLoadoutComposition` contract, which
  maps `setup` + `player_count` onto the draft.
- **EC-429 / D-24195** already extended `LagnLoadoutComposition` with an
  optional `supportPools` field for exactly this class of round-trip gap
  ("a `?lagn=` share link delivered the heroes and villains while silently
  dropping the harness"). This WP applies the same remedy to `result`.
  **Precisely:** the EC-429 *code* is on `main` (`loadoutLagnImport.ts:45-55`),
  which is all this WP needs; its owning **WP-391 is still `[ ]` in execution**,
  so this is a code-level dependency, not a completed-WP one.
- **Known overlap:** WP-404 / EC-439 (status **Blocked**) targets these same
  files plus `packages/lagn-spec`. If WP-404 unblocks before this executes,
  sequence them — do not run both in parallel.
- **Sequencing with WP-550.** Both were drafted in one SPEC PR. Their *code* is
  fully disjoint (`apps/registry-viewer` vs `packages/game-engine`) and they may
  execute in either order, but they share five governance files and both run
  `pnpm roadmap:counts:write`. Execute **sequentially**; the second to land
  rebases onto the first, re-anchors its `DECISIONS.md` append on the
  newly-landed prior entry, and re-runs `roadmap:counts:write`.
- **The LAGN contract makes `result` optional.** `packages/lagn-spec` requires
  only `lagn_version, game_id, variant, player_count, setup` at the document
  level; `result` is optional, and when present requires `outcome ∈
  {victory, defeat}`. A Tier-1 setup document legitimately omits it.
- **`apps/server/src/match/matchLagn.logic.ts` `toLagnResult` is CORRECT** and
  is the sole authority for a real match verdict: `heroes-win → victory`,
  `scheme-wins → defeat`, `tie` / unknown → omit the block. It is **not** in
  scope and must not be touched.

## 3. Context

Observed 2026-08-15 while live-verifying WP-544. A Loki / Secret Invasion 2p
match ended `gameOver.outcome === "scheme-wins"` — the scheme completed, a
**co-op loss** — yet its `GAME` LAGN file read `"result": { "outcome":
"victory" }`.

The first hypothesis (that a producer derives the outcome from a highest-VP
winner comparison — player 0 scored 9 to player 1's −2) was **investigated and
refuted**: no code anywhere derives `result.outcome` from scores. The VP split
was a coincidence.

The actual mechanism is a **round-trip data loss** across two files:

1. **Import discards it.** `loadoutLagnImport.ts` maps only `setup` +
   `player_count` (+ `supportPools`) onto the draft. The incoming `result`
   block is parsed by the validator and then dropped on the floor — it never
   reaches `LagnLoadoutComposition`. The `?lagn=` deep-link path
   (`useLagnFromUrl.ts`), which is how a real match's LAGN actually reaches the
   viewer, inherits the same loss.
2. **Export re-invents it.** `useLoadoutLagnExport.ts` rebuilds `result` from a
   Vue ref whose default is `"victory"`, and stamps
   `loss_condition: "deck_exhausted"` on **any** defeat — wrong for a
   scheme-completion or mastermind loss, and a value the server producer
   deliberately never emits.

So the exported file is not a corrupted server export; it is a **viewer
export** wearing a guessed verdict. The tell is structural: a server-produced
LAGN always stamps `scoring_profile` and usually `players[]`; the observed file
had neither, and its key order matches `buildLagnObject` exactly.

**Why it matters beyond cosmetics.** LAGN is the interchange format for
loadout sharing and is consumed by the Legends board surface. A document that
asserts `victory` on a match that was lost is a false record — and because
`result` is optional in the schema, asserting nothing is both legal and honest.
Fabricating a verdict claims an authority the loadout builder does not have.

**Single WP, not a split.** One app, one round-trip; import and export must
change together, or `main` carries a half-fixed round trip.

## 4. Scope (In)

- Surface the validated LAGN's `result` block through the importer's
  `LagnLoadoutComposition` contract as an **optional** field (mirroring how
  `supportPools` was added by EC-429).
- Thread it through the `?lagn=` deep-link path so a shared match link
  preserves its outcome.
- Seed `useLoadoutLagnExport`'s outcome state from an import when one arrives.
- Introduce an explicit **unset** outcome state. A draft whose outcome was
  neither imported nor explicitly chosen exports **no `result` block**.
- Stop synthesizing `loss_condition`: emit it **only when it was imported**,
  never derived from the outcome. Remove the dead `lossReason` API and its
  test (RS-1 — the UI offers no way to choose one).
- Add the round-trip tests that would have caught this.

## 5. Scope (Out)

- **`apps/server/src/match/matchLagn.logic.ts` (`toLagnResult`) — untouched.**
  It is correct. Its tests stay green unmodified.
- **No engine, registry, or `packages/lagn-spec` change.** The schema already
  makes `result` optional; no contract widening is needed.
- **No new LAGN field** and no change to `variant`, `player_count`, `setup`, or
  `support_pools` mapping.
- **Not adding `tie` to the LAGN outcome enum.** LAGN has only
  `victory | defeat`; the server already handles a tie by omitting the block,
  and this WP makes the viewer able to omit it too. Whether LAGN should model a
  tie is a separate contract question, deliberately deferred.
- **No backfill** of already-exported `.lagn.json` files.

## 6. Files Expected to Change

| File | Change |
|---|---|
| `apps/registry-viewer/src/lib/loadoutLagnImport.ts` | Surface `result` on `LagnLoadoutComposition` (optional) |
| `apps/registry-viewer/src/lib/loadoutLagnImport.test.ts` | Assert the block survives the parse; absent stays absent |
| `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` | Unset outcome state; `applyImportedResult`; omit `result` when unset; never synthesize `loss_condition` |
| `apps/registry-viewer/src/composables/useLoadoutLagnExport.test.ts` | Round-trip + omit-when-unset + no-fabricated-`loss_condition` tests |
| `apps/registry-viewer/src/composables/useLagnFromUrl.ts` | Return the imported result on `UseLagnFromUrlResult` |
| `apps/registry-viewer/src/composables/useLagnFromUrl.test.ts` | Add a **new** case whose fixture carries `result.outcome`, asserting `importedResult` is returned. `:91` / `:100` stay **unmodified** — their fixture has no `result`, so conditional omission leaves both passing |
| `apps/registry-viewer/src/App.vue` | **(PS-1)** hold the deep-link result in state and pass it to `LoadoutBuilder` as a prop |
| `apps/registry-viewer/src/components/LoadoutBuilder.vue` | Accept the prop, call `applyImportedResult`, and add the unset option to the outcome `<select>` |

**Why `App.vue` is on the list (PS-1).** `useLagnFromUrl` is instantiated in
`App.vue` and receives only `UseLoadoutDraftApi`; `useLoadoutLagnExport` is a
**separate instance** created later inside `LoadoutBuilder.vue` from `draft`
alone. There is no existing channel between them, so the deep-link half of the
round trip is unbuildable without `App.vue`. The two rejected alternatives:
parking the result on the draft would require `useLoadoutDraft.ts` **and**
`MatchSetupDocument` in `packages/registry/setupContract` (forbidden by §5);
module-level state would contradict the "no module-level state, independent
instance per invocation" invariant `useLoadoutLagnExport.ts:182` documents. Note
this is **not** an `01.5` runtime-wiring case — a new prop plus seeding is
behavior, not wiring, so it belongs in the allowlist up front.

`01.5` runtime wiring: none anticipated.

## 7. Contract

**Importer.** `LagnLoadoutComposition` gains one optional field carrying the
validated document's `result`. Because `parseLagnLoadout` returns the **raw**
parsed object (`parsed as LAGN` — zod's strip never runs), the field is built
by **copying the two known keys explicitly** (`outcome`, and `loss_condition`
when present). **Never spread** the incoming block: `result` also permits
`victory_points` and `timestamp`, and a spread would additionally round-trip
arbitrary unknown keys from an untrusted file (RS-2). Absent `result` → the
field is `undefined`. The importer performs **no** inference: it never derives
an outcome, and never invents a `loss_condition`.

**Exporter.** The outcome is tri-state: `unset` (default) | `victory` | `loss`.

| Outcome state | Emitted `result` block |
|---|---|
| `unset` | **omitted entirely** — the `result` key is absent from the object |
| imported | the imported `outcome` (+ `loss_condition` iff it was imported) |
| user-chosen | the chosen `outcome`; **no** `loss_condition` |

`loss_condition` is **import-only** (RS-1). The UI offers no way to choose one:
the only control is a Victory/Loss `<select>`, and the existing `lossReason`
computed is a hardcoded `"unavailable"` the template never reads. Rather than
invent a control (scope creep) or ship an unreachable branch, this WP locks
`loss_condition` to import-only and **removes the dead `lossReason` API and its
test**.

An import calls `applyImportedResult`, which **replaces** the outcome state (and
`loss_condition`) from the imported block. Replace, never merge: an import
carrying **no** `result` resets to `unset` and clears `loss_condition`, and an
import also overrides a prior *user* choice — matching `applyLagnImport`'s
documented total-replace contract. Keeping a stale outcome because the new file
carried none is the exact bug class D-24358 forbids. `loss_condition` is
**never** derived from `outcome`.

**Invariant (locked by D-24358):** the Loadout tab never asserts a match
verdict it was not given.

## 8. Acceptance Criteria

- **AC-1** A LAGN with `result.outcome: "defeat"` imported and re-exported
  yields `result.outcome: "defeat"` — the regression this WP exists to prevent.
- **AC-2** A LAGN with `result.outcome: "victory"` round-trips as `"victory"`.
- **AC-3** A LAGN carrying `loss_condition` round-trips it unchanged.
- **AC-4** A hand-built draft (no import, no explicit choice) exports **no**
  `result` key at all, and the document still validates against
  `@legendary-arena/lagn`.
- **AC-5** A user-chosen `loss` emits `outcome: "defeat"` and **no**
  `loss_condition` — the fabricated `"deck_exhausted"` is gone. The dead
  `lossReason` API and its test are removed (RS-1).
- **AC-6** A LAGN with **no** `result` block imports cleanly and re-exports
  with none.
- **AC-6b** *(replace semantics)* Importing a `"defeat"` LAGN and then importing
  a no-`result` LAGN leaves the export with **no** `result` key — the first
  outcome does not survive the second import.
- **AC-7** `apps/server` tests are untouched and green; `toLagnResult` behavior
  is unchanged.
- **AC-8** `pnpm --filter @legendary-arena/registry-viewer test` and
  `pnpm -r build` + `pnpm -r --no-bail test` exit 0.

## 9. Verification Steps

1. `pnpm install && pnpm -r build` **first** (a fresh worktree has no
   `node_modules` / `dist`, and an absent `dist` reports as failing tests),
   then `pnpm --filter @legendary-arena/registry-viewer test` — record the
   pre-change baseline count before editing.
2. *(operator machine only — this artifact is not in any worktree)* Round-trip
   the real file `C:\pcloud\matches\Core\loki-Secret-Invasion-GAME-2p.lagn.json`:
   import, re-export, diff — `result` must be preserved, not rewritten. The
   in-repo equivalent of this check is AC-1, which the executor can run.
3. In the Loadout tab, build a loadout from scratch and download the LAGN;
   confirm the file has **no** `result` key.
4. Import a LAGN whose `result.outcome` is `"defeat"`; confirm the outcome
   control reflects it and the re-download still says `"defeat"`.
5. Open a `?lagn=` deep link built from a match export; confirm the outcome
   survives.

## 10. Definition of Done

- AC-1..AC-8 all pass.
- D-24358 landed (Active); STATUS, WORK_INDEX, EC_INDEX flipped; mindmap
  `📝` → `✅` + `pnpm roadmap:counts:write`.
- Commit topology: `EC-584:` (implementation) + `SPEC:` (governance).
- `User-Visible Surface = the Registry Viewer Loadout tab` — **D-24026
  live-verify required**: import a real match LAGN on the deployed viewer,
  re-export, confirm the outcome survives.

## Vision Alignment

Required by `00.3 §17.1` — this WP touches a **Registry Viewer
(cards.legendary-arena.com) public surface (Vision §10a)**.

**Vision clauses touched:** §10a (Registry Viewer), §2 (Content Authenticity),
§10 (Content as Data).

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.*
Vision §10a names "Contributors — inspect card data quality" and "the project
itself — a living smoke test for the … content-as-data architecture" among the
viewer's three audiences. A viewer that silently stamps a fabricated `victory`
onto an exported interchange document undermines both: the artifact stops being
trustworthy evidence. Vision §2 requires that the digital implementation "never
alter gameplay meaning," and a match verdict is gameplay meaning. Emitting no
`result` when none is known — rather than guessing one — moves the surface
**toward** these clauses.

**Non-Goal proximity check:** none of NG-1..NG-7 are crossed. The change is
neither paid, persuasive, nor competitive: no monetization surface, no
pay-to-win lever (NG-1), no randomized purchase (NG-2), no gating of any
existing capability. The outcome control remains free and unauthenticated.

**Determinism preservation:** N/A by §17.2's own trigger — this WP touches no
scoring, replay, RNG, or simulation surface. `result.outcome` here is a
**transcription** of a verdict the engine already decided, never a
re-derivation; this WP explicitly forbids inferring an outcome from scores
(§5, and EC-584 Guardrails).

## Gate Record (Phase 1)

| Gate | Verdict | Notes |
|---|---|---|
| Pre-flight (`01.4`) | **READY TO EXECUTE** (2026-08-15) | Three rounds. Round 1 NOT READY (PS-1 the deep-link seeding channel was unbuildable with the declared allowlist; PS-2 `useLagnFromUrl.test.ts` unlisted; PS-3 missing `## Vision Alignment` behind a mis-scored lint table). Round 2 READY with one gate defect (`grep -A4` could not display the `scheme-wins` arm it claimed → `-A8`). Round 3 confirmed all fixes. |
| Copilot (`01.7`) | **RISK → resolved** (2026-08-15) | 12 findings, all applied in place; re-run left 2 residual wording items (R1 a three-way contradiction on `useLagnFromUrl.test.ts:91/:100`, R2 grep-primacy drift), both since corrected. Load-bearing catches: undefined re-import merge semantics (now REPLACE-never-merge + AC-6b), an AC-4 gate that could not detect the failure its own smell described, and an untestable `.vue` wiring requirement in an app with no SFC harness. |
| Lint gate (`00.3`) | **PASS** | All 21 sections resolved in `## Lint Gate Self-Review`; §17 triggered (Registry Viewer public surface) and answered in `## Vision Alignment`. |

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Title | Verdict |
|---|---|---|
| 1 | Work Packet Structure | PASS |
| 2 | Non-Negotiable Constraints Block | PASS — §5 Scope (Out) + EC Guardrails |
| 3 | Prerequisites (`## Assumes`) | PASS — §2; EC-429 code is on `main` (its owner WP-391 is still in execution, but the `supportPools` precedent this depends on has landed) |
| 4 | Context References | PASS — §3 cites the live artifact, the refuted hypothesis, and the structural tell |
| 5 | Output Completeness | PASS — §6, eight files, incl. `App.vue` + `useLagnFromUrl.test.ts` added after pre-flight PS-1/PS-2 |
| 6 | Naming Consistency | PASS — LAGN snake_case vs MATCH-SETUP camelCase mapping unchanged |
| 7 | Dependency Discipline | PASS — §2; note the WP-404 / EC-439 (Blocked) overlap on these files, flagged in §3 |
| 8 | Architectural Boundaries | PASS — `apps/registry-viewer` only; `apps/server` and `packages/lagn-spec` explicitly out and gated in the EC |
| 9 | Windows Compatibility | N/A — no path or shell work |
| 10 | Environment Variable Hygiene | N/A — no env read |
| 11 | Authentication Clarity | N/A — no auth surface; the Loadout tab is unauthenticated |
| 12 | Test Quality | PASS — §8 AC-1..AC-8; baseline count to be locked at execution (§9 step 1) |
| 13 | Commands and Verification | PASS — §9, install-and-build first |
| 14 | Acceptance Criteria Quality | PASS — every AC is assertable, incl. `Object.hasOwn(doc,"result") === false` |
| 15 | Definition of Done | PASS — §10 |
| 15.1 | User-visible verification (D-24026) | PASS — §10, live-verify required on the deployed viewer |
| 16 | Code Style | PASS — explicit key copying (no spread), no new abstraction; a dead API is removed rather than left unreachable |
| 17 | Vision Alignment | PASS — the `## Vision Alignment` section above; clauses §10a / §2 / §10 |
| 18 | Prose-vs-Grep Discipline | PASS — AC-5's primary gate is the **scoped** non-comment `deck_exhausted` grep (an unscoped `grep -c` is recorded as the corroborating check once the `:26` mapping sentence is deleted, which EC-584 lists as a required deliverable). The `grep -vc` exit-1 caveat is stated |
| 19 | Bridge-vs-HEAD Staleness | PASS — baseline SHA pinned in the header |
| 20 | Funding Surface Gate | N/A — no funding or monetization surface |
| 21 | API Catalog Update (D-11804) | N/A — no HTTP endpoint added, changed, removed, or restatused; no `apps/server` library function; `apps/server` is untouched and gated by the EC |
