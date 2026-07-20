# WP-402 — LAGN 1.3.0: Hero Alternates (Contract)

**Layer:** Cross-cutting contract package (`packages/lagn-spec`)
**EC:** `docs/ai/execution-checklists/EC-437-lagn-1-3-0-hero-alternates.checklist.md`
**Reserves:** D-24210, D-24211
**Baseline:** drafted off `origin/main` @ `1c8809f3`
**User-Visible Surface:** none — infrastructure

---

## Goal

Add an optional `setup.hero_alternates` block to LAGN at version **1.3.0**, so a
saved or shared loadout can name **bench heroes** alongside the heroes actually
played. A player who assembles a seven-hero shortlist — five played, two held in
reserve — keeps the whole shortlist when the loadout is saved, shared by link, or
re-opened in the Registry Viewer, instead of silently losing the reserves at the
first round trip.

This packet ships the **contract only**. Readers accept 1.3.0; `LAGN_VERSION`
stays `1.1.0`, so no producer emits a bench and no endpoint payload changes
shape. WP-404 wires the producer and flips the writer.

---

## Assumes

- **WP-394 ✅ / D-24198 Active** — LAGN 1.2.0 provenance; `LAGN_SUPPORTED_VERSIONS`,
  the version-gate pattern, and the five shipped fixtures exist on `main`.
- **WP-392 ✅ / D-24196 Active** — `generateSchema()` derives from `lagnSchema`;
  `UNEXPRESSIBLE_CONSTRAINTS` + the `ZodEffects` count gate are live. Every new
  refinement MUST join the allowlist or the build fails.
- **EC-422 / D-24195 Active** — the LAGN 1.1.0 `setup.support_pools` seam. This
  packet copies its shape decisions deliberately (optional, version-gated,
  strict superset, sibling of the counts it relates to).
- **D-10014 Active** — composition ids are set-qualified `setAbbr/slug`. Bench
  ids live in the same id space as `setup.heroes[].id`; no translation.
- **D-24086 Active** — `packages/lagn-spec` has no runtime edge to
  `@legendary-arena/registry`. Unchanged here.
- `packages/lagn-spec` suite green on `main` at **54 / 0** (observed, baseline above).

---

## Context

### Why a new block and not more entries in `setup.heroes`

`setup.heroes` is unbounded in the schema (`.min(1)`, no max), so seven entries
*validate* — and then fail everywhere it matters. Hero count is **exact-enforced**
downstream against `PLAYER_COUNT_SETUP`
(`packages/registry/src/playerCountSetup.ts`): 3 heroes at 1 player, 5 at 2–4,
**6 at 5**. `matchSetup.validate.ts:496` and `setupContract.validate.ts` both
reject a mismatch, and `apps/registry-viewer`'s LAGN importer maps
`setup.heroes.map(hero => hero.id)` straight into the draft's `heroDeckIds`. Seven
entries therefore produce an invalid draft in the viewer and a thrown
`Game.setup()` on match create.

The bench is also **not** a fixed "5 + 2". It is additive to whatever the player
count requires, which is why nothing in this packet hardcodes 5, 7, or 2.

### Why the operator's framing is the right one

The ask is explicitly **loadout convenience only**: the bench is metadata about a
saved shortlist. It is not a draft/ban pool and not an in-match substitution
mechanic. Both of those were considered and declined for this arc — in-match
substitution in particular would put the bench into gameplay state, break the
`MatchSetupConfig` 9-field composition lock, and invalidate the D-24119
replay/verification carve-out's assumption that `initialState` fully describes the
match. **D-24210** records the boundary so a future packet cannot quietly promote
loadout metadata into gameplay state.

### The defect this packet must fix to exist at all

`validator.ts` gates provenance with **equality**:

```ts
if (data.lagn_version === LAGN_VERSION_1_2_0) { ... }
```

so the moment `1.3.0` joins `LAGN_SUPPORTED_VERSIONS`, a 1.3.0 document carrying
`catalog_ref` is **rejected** — by an error message that reads
`provenance requires lagn_version 1.2.0 or later`. Observed, not reasoned (see
§Empirical Scaffold). This is a latent contract defect that any minor bump would
have tripped; the gate must compare **ordinally**. **D-24211** records the rule so
the next version add does not re-introduce it.

### Single WP or several

**Three, one per layer** — the split is forced by the Layer Boundary, not chosen
for taste:

| | Layer | Carries |
|---|---|---|
| **WP-402** (this) | contract pkg `packages/lagn-spec` | LAGN 1.3.0 `setup.hero_alternates`, reader-only |
| **WP-403** | Registry `setupContract` | MATCH-SETUP envelope `heroAlternateIds` — a **contract-file** change, so it needs its own review + D-entry per `code-style.md` |
| **WP-404** | App `apps/registry-viewer` | bench UI, draft state, LAGN round trip, **writer flip** |

WP-403 is a hard prerequisite of WP-404, not a nice-to-have: every
`setupContract` object is `.strict()`, so an unknown key is rejected at parse
time, and the viewer's draft is a `MatchSetupDocument`. The writer flip rides with
WP-404 because `validator.ts`'s own frozen-writer comment prescribes flipping
"together with the producers" — landing it earlier would move a catalogued
endpoint's wire format with nothing to justify it (the WP-394 precedent).

---

## Scope (In)

1. `LAGN_VERSION_1_3_0 = '1.3.0'` constant; appended to `LAGN_SUPPORTED_VERSIONS`.
2. Optional `setup.hero_alternates: Array<{ id: string, name: string }>`, `.min(1)`,
   mirroring the `{ id, name }` shape of `setup.heroes` exactly.
3. **New refinement A** (on `GameSetupSchema`): no alternate may also appear in
   `setup.heroes`; no ext_id may repeat within `hero_alternates`.
4. **New refinement B** (root): `setup.hero_alternates` requires `lagn_version`
   ≥ 1.3.0 — an earlier document carrying it is **rejected, not stripped**.
5. Two matching `UNEXPRESSIBLE_CONSTRAINTS` entries (1:1 with refinement nodes).
6. **Convert the provenance version gate from equality to an ordinal comparison**
   (the §Context defect), plus a test pinning `1.3.0 + provenance` as VALID.
7. `migrateToCurrent`: register the 1.2.0 → 1.3.0 step, left **unreachable**
   (writer still stamps 1.1.0). It never invents a bench from `setup.heroes`.
8. Sixth example fixture `examples/tier1-hero-alternates.lagn.json`.
9. Regenerated `schemas/lagn-v1.json` (never hand-edited).
10. Test updates: the pinned `lagn_version` enum assertion, new 1.3.0 cases, ajv
    validation of all **six** fixtures.
11. `wiki/lagn-v1.md` — the **read** row for 1.3.0 and the `hero_alternates` block.
    This packet is what makes 1.3.0 readable, so the published spec must not lag
    two packets behind the validator.
12. Governance: D-24210 + D-24211 Active, `00.2` field names, `api-endpoints.md`
    (§21 TRIGGERED — see §Contract), `STATUS.md`, both indices, mindmap.

## Scope (Out)

- **`LAGN_VERSION` stays `1.1.0`.** No producer emits a bench in this packet.
- Any `apps/*` change — viewer UI, draft state, import/export (WP-404).
- The MATCH-SETUP envelope / `packages/registry` `setupContract` — that is
  **WP-403**, a hard prerequisite of WP-404 rather than an optional follow-on.
  Measured at draft: every `setupContract` object is `.strict()`, so an unknown
  key is **rejected at parse time**, not stripped — and the Registry Viewer's
  draft *is* a `MatchSetupDocument`. A bench therefore cannot exist in the viewer
  at all until the envelope carries it.
- Any `packages/game-engine` change. The engine never sees a bench (D-24210).
- Any change to `game_id`, `variant`, `Outcome`, `LossCondition`, `RarityCode`,
  `CardType`, `validate`, `summarize`, the `$schema` default, or existing
  `card_catalog` fields.
- Any cap on bench size. The schema is `.min(1)` and unbounded; the **UI** offers
  two slots. A `.max(2)` in a published open standard cannot be relaxed without a
  major version and buys nothing the UI cannot enforce.
- Hash computation of any kind. No `@legendary-arena/registry` dependency (AC-9
  of WP-394 still holds).

---

## Files Expected to Change

- `packages/lagn-spec/src/validator.ts` — **modified** — constant, schema block,
  2 refinements, 2 allowlist entries, ordinal gate fix
- `packages/lagn-spec/src/migrate.ts` — **modified** — 1.2.0 → 1.3.0 step (unreachable)
- `packages/lagn-spec/src/types.ts` — **modified** — `HeroAlternate` type
- `packages/lagn-spec/src/index.ts` — **modified** — re-exports
- `packages/lagn-spec/src/validator.test.ts` — **modified** — new cases + enum re-pin
- `packages/lagn-spec/examples/tier1-hero-alternates.lagn.json` — **new** — sixth fixture
- `packages/lagn-spec/schemas/lagn-v1.json` — **modified** — regenerated
- `wiki/lagn-v1.md` — **modified** — 1.3.0 read row + `hero_alternates`
- `docs/ai/DECISIONS.md` — **modified** — D-24210 + D-24211 Active
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — `hero_alternates` fields
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `validate`-gated rows replaced
  WHOLE per D-11804
- `docs/ai/STATUS.md` — **modified** — infrastructure-only line
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — `📝` → `✅`

---

## Contract

**LAGN 1.3.0** — a strict superset of 1.2.0. Every valid 1.0.0 / 1.1.0 / 1.2.0
document remains valid unchanged.

```jsonc
"setup": {
  "heroes": [ { "id": "core/wolverine", "name": "Wolverine" }, ... ],  // played — count per PLAYER_COUNT_SETUP
  "hero_alternates": [                                                 // OPTIONAL, 1.3.0+
    { "id": "core/rogue", "name": "Rogue" }
  ]
}
```

- `hero_alternates` entries are **not** played. Nothing derives a match
  composition from them; `setup.heroes` remains the sole authority on what is on
  the board (D-24210).
- Version table after this packet:

  | | 1.0.0 | 1.1.0 | 1.2.0 | 1.3.0 |
  |---|---|---|---|---|
  | Read | ✅ | ✅ | ✅ | ✅ |
  | Written | no | **yes — `LAGN_VERSION`** | no | no |
  | Adds | — | `support_pools` | provenance | `hero_alternates` |

**§21 (D-11804) is TRIGGERED, not N/A.** The *acceptance envelope* of every
`validate`-gated request row moves: a body carrying `hero_alternates` is silently
stripped and accepted today, and rejected after this packet unless it declares
1.3.0. `POST /api/me/loadouts` is the affected row (the same row WP-394 moved) and
is replaced **whole** per D-11804 — no partial-column edit. `PATCH` carries no
`lagn` and is untouched.

---

## Acceptance Criteria

- **AC-1** — A 1.3.0 document carrying `hero_alternates` validates.
- **AC-2** — The same body declaring 1.0.0 / 1.1.0 / 1.2.0 is **rejected** with the
  locked full-sentence message; the block is never silently stripped.
- **AC-3** — An alternate id also present in `setup.heroes` is rejected; a repeated
  alternate id is rejected.
- **AC-4** — All **six** fixtures validate against the **generated** JSON Schema via
  `ajv` 2020-12 **and** via zod.
- **AC-5** — **A 1.3.0 document carrying `catalog_ref` validates** (the ordinal-gate
  fix). A test pins this; it fails against the pre-fix equality gate.
- **AC-6** — `LAGN_VERSION === '1.1.0'`, asserted by test. No producer emits 1.3.0.
- **AC-7** — `migrateToCurrent` on a 1.3.0 input returns it **unchanged** with
  `applied: []`; it never downgrades, re-stamps, or invents a bench from `heroes`.
- **AC-8** — The refinement-count gate is **mutation-tested**: inject an
  undocumented `.refine()` → red; revert → green.
- **AC-9** — `pnpm --filter @legendary-arena/lagn generate:schema` then
  `git diff --exit-code -- schemas/` is clean.
- **AC-10** — `packages/lagn-spec/package.json` is **unchanged**. The manifest reads
  `1.1.0` today and `LAGN_VERSION` stays `1.1.0`, so the EC-422 lockstep is already
  satisfied by not touching it; the bump belongs to WP-404, where the writer moves.
- **AC-11** — `packages/lagn-spec` still declares no dependency on
  `@legendary-arena/registry` (WP-394 AC-9 re-asserted).

---

## Verification Steps

```bash
pnpm -r build
pnpm --filter @legendary-arena/lagn test          # expect 54 → 60+ / 0
pnpm --filter @legendary-arena/lagn generate:schema
git diff --exit-code -- packages/lagn-spec/schemas/    # expect clean
pnpm -r --no-bail test
pnpm roadmap:counts:check
```

Judge drift by `git diff --numstat`, never by `git status` — generated artifacts
show ` M` on line-ending churn alone.

---

## Empirical Scaffold (REQUIRED — 01.4; RUN, not reasoned)

This packet **tightens validation**: input accepted today (`hero_alternates` on a
1.1.0 body, silently stripped) is newly rejected. Per `01.4 §Empirical Scaffold` a
`READY` reached by argument is invalid for this class. Prototyped on the draft
branch, suite run, output recorded, scaffold reverted:

| | Observed |
|---|---|
| Baseline | **54 / 0** |
| Scaffolded | **52 / 2** |
| Failure 1 | `published contract fields survive derivation` — pins the `lagn_version` enum |
| Failure 2 | `the committed schemas/lagn-v1.json matches the generator` — regeneration |
| Existing fixture breakage | **none** |
| Refinement-count gate | **green** with +2 nodes / +2 allowlist entries (1:1 confirmed) |

Both failures are the expected mechanical consequences and are already inside
§Files Expected to Change. **Nothing needed folding into scope.**

The scaffold also produced the §Context defect as a *measured* result, not an
inspection: with the equality gate, `1.3.0 + provenance` →
`INVALID: catalog_ref: provenance requires lagn_version 1.2.0 or later`; with the
ordinal gate, → `VALID`. That is the evidence behind AC-5 and D-24211.

---

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Verdict |
|---|---|
| §1 Structure | PASS — all 9 sections present, in template order |
| §2 Non-negotiables | PASS — writer frozen at 1.1.0; additive-only; no registry edge |
| §3 Assumes | PASS — 5 prerequisites, each citing its locking D-entry/WP |
| §4 Context refs | PASS — `01.0a`, `00.6`, EC-424/EC-422 precedents cited |
| §5 Output completeness | PASS — 15-file closed allowlist |
| §6 Naming | PASS — `hero_alternates` matches LAGN snake_case; `{id,name}` mirrors `heroes` |
| §7 Dependency discipline | PASS — all hard-deps ✅ landed on `main`; verified, not assumed |
| §8 Architectural boundaries | PASS — single package, no new import edge |
| §9 Windows | PASS — no path/shell work |
| §10 Env vars | N/A — none touched |
| §11 Auth | N/A — no auth surface in this packet (WP-403 carries the endpoint) |
| §12 Test quality | PASS — AC-1..AC-11 each map to an assertion; count gate mutation-tested |
| §13 Commands | PASS — §Verification Steps are runnable verbatim |
| §14 AC quality | PASS — 11 binary, observable criteria |
| §15 DoD | PASS — see below |
| §15.1 D-24026 | N/A — `User-Visible Surface = none — infrastructure` |
| §16 Code style | PASS — `00.6` full English names, JSDoc, no `.reduce()` for branching logic |
| §17 Vision | PASS — VISION §19b (loadout library). No conflict: the bench is metadata, not a gameplay advantage, so NG-1 "no pay-to-win" is untouched |
| §18 Determinism | N/A — no engine, RNG, or persistence surface; `finalStateHash` unaffected |
| §19 Rollback | PASS — additive; reverting the commit restores 1.2.0 semantics exactly |
| §20 Migration | N/A — no DB migration; `migrateToCurrent` step is unreachable |
| §21 API catalog | **TRIGGERED** — acceptance envelope moves; `POST /api/me/loadouts` replaced WHOLE per D-11804 |

---

## Definition of Done

- [ ] AC-1..AC-11 each demonstrated with observed output pasted into the session log
- [ ] `pnpm --filter @legendary-arena/lagn test` 0 fail; count recorded
- [ ] `generate:schema` + `git diff --exit-code -- schemas/` clean
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] D-24210 + D-24211 landed **Active** in `DECISIONS.md`
- [ ] `00.2` carries the new field names; `api-endpoints.md` rows replaced WHOLE
- [ ] `packages/lagn-spec/package.json` untouched (AC-10)
- [ ] `git diff --name-only` matches §Files Expected to Change exactly
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0
