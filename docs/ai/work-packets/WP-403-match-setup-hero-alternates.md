# WP-403 — MATCH-SETUP Envelope: Hero Alternates (Registry)

**Layer:** Registry (`packages/registry/src/setupContract/**`)
**EC:** `docs/ai/execution-checklists/EC-438-match-setup-hero-alternates.checklist.md`
**Reserves:** D-24212
**Baseline:** drafted off `origin/main` @ `1c8809f3`
**User-Visible Surface:** none — infrastructure (WP-404 carries the surface)

---

## Goal

Add an optional `heroAlternateIds` field to the **MATCH-SETUP envelope** so a
loadout document can carry bench heroes through validation, storage, and the
Registry Viewer's draft state. Without it a bench cannot exist client-side at
all: every `setupContract` object is `.strict()`, so an unknown key is **rejected
at parse time**, and the viewer's draft *is* a `MatchSetupDocument`.

The nine-field **composition lock is untouched**. `heroAlternateIds` sits in the
envelope beside `heroSelectionMode` and `supportPools`, not in `CompositionSchema`.

---

## Assumes

- **WP-402 ⏸ must land first** — LAGN 1.3.0 `setup.hero_alternates` is the
  interchange counterpart this field maps to. Landing the envelope first would
  create a field with nowhere to serialize.
- **D-9301 Active** — the MATCH-SETUP envelope is extensible via additive optional
  fields; `heroSelectionMode` (WP-093) is the precedent this copies.
- **D-24194 Active** — envelope shape; `supportPools` is the second precedent for
  an optional envelope block.
- **D-24210** (reserved by WP-402) — hero alternates are loadout metadata, never
  gameplay state.
- **D-10014 Active** — set-qualified `setAbbr/slug` ext_ids.
- `code-style.md §Data Contracts` — the 9-field composition lock applies to
  `MatchSetupConfig`; the envelope is explicitly outside it.

---

## Context

### Why this cannot ride inside WP-404

`setupContract.schema.ts` / `.types.ts` / `.validate.ts` are **contract files**.
`code-style.md` locks them once created: any change requires architecture review
and a `DECISIONS.md` entry. That makes this a registry-layer packet with its own
D-entry, not a few lines folded into an app packet — and folding it in would cross
a layer boundary inside one WP, which ARCHITECTURE.md forbids.

### Why the envelope and not the composition

The composition block is the nine locked fields that describe **what is on the
board**. A bench is by definition *not* on the board. Putting `heroAlternateIds`
in `CompositionSchema` would break the lock, put a non-gameplay concept into the
structure the engine consumes, and hand a future reader the impression that the
engine should do something with it. The envelope already carries exactly this
class of field (`heroSelectionMode`, `supportPools`, `themeId`) — precedent,
not invention.

### Why validation stays deliberately thin

The bench is checked for **shape and identity** (well-formed unique ext_ids, no
overlap with `heroDeckIds`), not for **count**. There is no correct bench size:
`PLAYER_COUNT_SETUP` governs played heroes (3/5/6 by seat count) and says nothing
about reserves. A count rule here would be invented, and inventing rules is a
prohibited AI failure pattern. **D-24212** records that the bench is
non-authoritative: nothing derives a match composition from it, and
`validateMatchSetup` must behave identically whether it is present or absent.

---

## Scope (In)

1. `setupContract.types.ts` — optional `heroAlternateIds?: string[]` on the
   envelope type.
2. `setupContract.schema.ts` — `heroAlternateIds: uniqueExtIdArray("heroAlternateIds").optional()`
   on the envelope object (**not** `CompositionSchema`), preserving `.strict()`.
3. `setupContract.validate.ts` — resolve each bench id against `knownHeroes` via
   the existing `checkArrayExtIds` helper (no parallel resolver), plus a
   full-sentence overlap check against `composition.heroDeckIds`.
4. Tests: present / absent / unknown-id / duplicate / overlap, and a regression
   asserting a document **without** the field validates byte-identically to today.
5. Governance: D-24212 Active, `00.2` field name, `MATCH-SETUP-SCHEMA.md`
   extensibility row, `STATUS.md`, both indices, mindmap.

## Scope (Out)

- **`CompositionSchema` and the 9-field `MatchSetupConfig` lock** — untouched.
- **`packages/game-engine`** — the engine never reads the bench (D-24210/D-24212).
  `matchSetup.validate.ts`, `matchSetup.types.ts`, and every hash surface are
  out of scope; `finalStateHash` must be unchanged.
- Any bench **count** rule, min, or max.
- `PLAYER_COUNT_SETUP` — unchanged; the bench is not a seat-count concern.
- Any `apps/*` change — viewer draft, UI, import/export (WP-404).
- Any LAGN change (WP-402).
- Any migration or persistence change. Saved loadouts store LAGN (D-24087), not
  MATCH-SETUP, so nothing stored needs backfilling.

---

## Files Expected to Change

- `packages/registry/src/setupContract/setupContract.types.ts` — **modified**
- `packages/registry/src/setupContract/setupContract.schema.ts` — **modified**
- `packages/registry/src/setupContract/setupContract.validate.ts` — **modified**
- `packages/registry/src/setupContract/setupContract.test.ts` — **modified**
- `docs/ai/DECISIONS.md` — **modified** — D-24212 Active
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified**
- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` — **modified** — extensibility row
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified**
- `docs/05-ROADMAP-MINDMAP.md` — **modified**

> Exact test-file paths are asserted at execution (`git ls-files` under
> `setupContract/`), and the enumerated set becomes the scope lock — the EC-432
> pattern.

---

## Contract

```jsonc
// MATCH-SETUP envelope (NOT the composition block)
{
  "heroSelectionMode": "manual",
  "supportPools": { ... },
  "heroAlternateIds": ["core/rogue", "core/gambit"]   // OPTIONAL, additive
}
```

- Optional. Absent ⇒ behaviour identical to today, byte for byte.
- Every id is a D-10014 set-qualified `setAbbr/slug` resolving to a known hero.
- Unique within itself; disjoint from `composition.heroDeckIds`.
- **Non-authoritative.** Nothing derives a composition from it; `validateMatchSetup`
  and every engine path ignore it entirely (D-24212).

---

## Acceptance Criteria

- **AC-1** — A document carrying a valid `heroAlternateIds` validates.
- **AC-2** — A document **without** it validates exactly as today (regression test).
- **AC-3** — An unknown hero ext_id is rejected with a full-sentence error naming
  the field and the offending id.
- **AC-4** — A duplicate within `heroAlternateIds` is rejected.
- **AC-5** — An id present in both `heroAlternateIds` and `composition.heroDeckIds`
  is rejected.
- **AC-6** — `.strict()` still rejects a misspelled envelope key
  (e.g. `heroAlternatIds`) — the field addition did not loosen the envelope.
- **AC-7** — `CompositionSchema` is unchanged; the 9-field lock is re-asserted by
  the existing test.
- **AC-8** — No `packages/game-engine` file changed; the engine sentinel
  `finalStateHash` is unchanged (assert, do not assume).

---

## Verification Steps

```bash
pnpm -r build
pnpm --filter @legendary-arena/registry test
pnpm -r --no-bail test          # engine suite must be unmoved
git diff --name-only            # must contain no packages/game-engine path
pnpm roadmap:counts:check
```

---

## Empirical Scaffold (REQUIRED — 01.4)

This packet **adds validation on an existing input path**, so `01.4 §Empirical
Scaffold` applies. **RUN at draft**, output recorded, scaffold reverted:

- Prototyped `heroAlternateIds: uniqueExtIdArray("heroAlternateIds").optional()`
  on `EnvelopeSchema` + the type. `pnpm -r build` 0; **registry suite 178 / 178**;
  a `MatchSetupDocument` carrying the field validated and `.strict()` still
  rejected a misspelled key. **Zero existing-fixture breakage.**
- Full repo (`pnpm -r --no-bail test`) surfaced **one failure — unrelated to the
  schema change**: `apps/dashboard`'s `workIndexRowPattern` drift guard rejected
  the draft's WORK_INDEX rows because the status token was written
  `**Draft; BLOCKED on …**` rather than a closed `**Blocked**` token. Fixed in the
  index rows during drafting (the canonical regex closes the bold token
  immediately); re-run green. Folded into no code scope — it was a governance-row
  format issue, not a validator issue.

Measured at draft (the finding that created this packet): every `setupContract`
object is `.strict()` (`setupContract.schema.ts:78,98,140,189` + the root `:231`),
so an unknown envelope key is **rejected**, not stripped. Adding the field is
therefore mandatory for WP-404 rather than cosmetic.

**Known risk to size at scaffold:** `uniqueExtIdArray` and `checkArrayExtIds` are
shared helpers, and per `feedback_registry_dist_cross_package_tests`, apps consume
the **built `dist`** — so run `pnpm -r build` before the dependent suites or a
stale `dist` will produce a false red. Fold every observed failure into
§Scope (In) and §Files Expected to Change **before** editing.

---

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Non-negotiables | PASS — composition lock untouched; engine untouched; envelope stays `.strict()` |
| §3 Assumes | PASS — WP-402 ⏸ named as a blocking hard-dep |
| §4 Context refs | PASS — D-9301 / D-24194 / D-24210 / `code-style.md` cited |
| §5 Output completeness | PASS — 11-file allowlist, test paths resolved at execution per EC-432 pattern |
| §6 Naming | PASS — `heroAlternateIds` matches MATCH-SETUP camelCase + the `*Ids` convention |
| §7 Dependency discipline | **BLOCKED on WP-402** — stated, not assumed; scaffold confirms the field is otherwise ready |
| §8 Architectural boundaries | PASS — registry only; no engine or app edge |
| §9 Windows | PASS — no path/shell work |
| §10 Env vars | N/A |
| §11 Auth | N/A |
| §12 Test quality | PASS — AC-1..AC-8 each map to an assertion incl. two negative-space tests |
| §13 Commands | PASS |
| §14 AC quality | PASS — 8 binary criteria |
| §15 DoD | PASS |
| §15.1 D-24026 | N/A — no user-visible surface (WP-404 carries it) |
| §16 Code style | PASS — reuses `checkArrayExtIds`; no parallel resolver; full-sentence errors |
| §17 Vision | PASS — VISION §19b; no conflict (metadata only, no gameplay advantage) |
| §18 Determinism | **PASS, asserted** — AC-8 pins engine files unchanged + `finalStateHash` unmoved |
| §19 Rollback | PASS — optional field; revert restores prior semantics exactly |
| §20 Migration | N/A — no DB change; saved loadouts store LAGN, not MATCH-SETUP |
| §21 API catalog | N/A — no endpoint added, removed, or re-statused; no `validate`-gated request shape moves in this packet |

---

## Definition of Done

- [ ] AC-1..AC-8 each demonstrated with observed output
- [ ] Empirical scaffold RUN and its counts recorded in the session log
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] `git diff --name-only` contains no `packages/game-engine/**` path
- [ ] D-24212 landed **Active**; `00.2` + `MATCH-SETUP-SCHEMA.md` updated
- [ ] `git diff --name-only` matches §Files Expected to Change exactly
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0
