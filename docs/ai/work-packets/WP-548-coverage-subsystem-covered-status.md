# WP-548 — Coverage `subsystem`-Covered Status

**Status:** Draft 2026-08-14
**Layer:** Tooling / Observability — coverage generators (`scripts/`) + card-data-derived
feeds + the dashboard viewer (`apps/dashboard`). **No engine / `G` / gameplay change.**
**Depends on:** WP-292 / D-24076 (the require-to-defeat setup subsystem — the live
seed cards) · WP-507 (the tactic-provenance overlay + effect-index join precedent) ·
WP-484..489 (the effect-debugging surface / `/debug/effects`)
**Soft dep:** WP-546 / D-24355 (Supreme HYDRA scoring — supplies its allowlist row;
add that one row only once WP-546's scoring code is merged)
**Reserves:** EC-583 · D-24357
**Lane:** Standard (INFRA/tooling) — one new status threaded through the coverage stack.

---

## 1. Problem

`/debug/effects` (and `/coverage`) flag some cards as `(unmarked)` — the "a DATA todo"
state — even though they are **fully implemented**, just by a subsystem *other* than the
`[effect:X]` villain-ability pipeline. Two live/known classes:

1. **Defeat-requirement cards** — Blob, Venom, Zombie-Venom — implemented via
   `apply-defeat-requirement-markers.mjs` → `[require-to-defeat:…]` + the
   `villainDefeatRequirement.setup.ts` subsystem (WP-292 / D-24076). Live today.
2. **Card-text VP modifiers** — Supreme HYDRA — implemented via the scoring subsystem
   `scoring/dynamicVictoryPoints.ts` (WP-546 / D-24355). Lands with WP-546.

Because the villain-mechanic-ledger's `extractEffectTokens` only recognizes `[effect:X]`
tokens, a card with ability text but no `[effect:X]` tag falls to `(unmarked)`
(`villain-mechanic-ledger.mjs`, the `rawTokens.length === 0` path). The
effect-implementation-index is a **verbatim join** of the hero + villain ledgers, so this
`(unmarked)` status flows straight into `/debug/effects`. The result: implemented cards
read as unfinished, and "is the Core set complete?" cannot be answered from the dashboard.

This is the observability follow-on flagged in WP-546.

## 2. Design — a curated `subsystem`-coverage allowlist + a new `subsystem` status

Cards covered outside the `[effect:X]` pipeline are declared in a **curated allowlist**
(mirroring the existing `mechanic-provenance.json` / `tactic-provenance.json` pattern),
and the villain ledger emits a **new status `subsystem`** for them — semantically
distinct from the three existing states:

- `unmarked` — ability text, no marker → **a TODO**.
- `deferred` — recognized but intentionally unimplemented → **a TODO-ish**.
- **`subsystem`** — **implemented by another subsystem** (setup / scoring) → **done**,
  just not via the effect-marker pipeline. Rendered as covered, not a TODO.

**Why not reuse `[require-to-defeat:…]` marker detection?** It would cover Blob (which
has that marker) but not Supreme HYDRA (pure scoring code, no marker). The allowlist
covers both marker-based and marker-less subsystems uniformly, and is explicit curation
(no fragile ability-text parsing).

**Why not mark them `executable`?** They are not resolved by the villain-ability parser;
calling them `executable` would be dishonest. `subsystem` is the honest "done elsewhere"
signal.

## 3. Contract (locked)

### 3.1 New curated allowlist

`scripts/coverage/subsystem-coverage.json`:

```json
{
  "schemaVersion": 1,
  "_comment": "Cards implemented by a subsystem OTHER than the [effect:X] villain-ability pipeline (setup:require-to-defeat, scoring:dynamic-vp). The villain-mechanic-ledger emits status 'subsystem' (implemented, done — not a TODO) for a would-be-'(unmarked)' card listed here. Curated: a card joins ONLY when its subsystem implementation is merged.",
  "cards": {
    "core-villain-brotherhood-blob":        { "subsystem": "setup:require-to-defeat", "wp": "WP-292", "decision": "D-24076" },
    "core-villain-spider-foes-venom":       { "subsystem": "setup:require-to-defeat", "wp": "WP-292", "decision": "D-24076" },
    "ssw1-villain-deadlands-the-zombie-venom": { "subsystem": "setup:require-to-defeat", "wp": "WP-292", "decision": "D-24076" }
  }
}
```

- Keyed by the **per-card ledger ext_id** (`{setAbbr}-villain-{groupSlug}-{cardSlug}`,
  the `card.key` the ledger rows use — verify each key against
  `villain-defeat-requirements.json`'s `set`/`group`/`card`).
- **Supreme HYDRA** (`core-villain-hydra-supreme-hydra` → `scoring:dynamic-vp`,
  `WP-546` / `D-24355`) is added **iff WP-546's scoring code is merged** (EC grep gate).
  If executing this before WP-546, ship the 3 defeat-requirement rows and add Supreme
  HYDRA in WP-546's wake — the allowlist must reflect *merged* coverage, never a promise.

### 3.2 Villain ledger emits `subsystem`

`scripts/villain-mechanic-ledger.mjs`:
- Read `subsystem-coverage.json` (like it reads `mechanic-provenance.json`).
- In `buildCardRows`, in the `rawTokens.length === 0` branch (the would-be-`unmarked`
  path), if the card's ext_id is in the allowlist: emit a row with status `subsystem`,
  `mechanic` = the entry's `subsystem` label (e.g. `setup:require-to-defeat`), and
  `wp` / `decision` from the entry. Otherwise keep `(unmarked)` as today.
- Add `subsystem` to the status summary counts.
- Regenerate `docs/ai/coverage/villain-mechanic-ledger.{csv,json}` (`pnpm ledger:villains`).

### 3.3 Thread `subsystem` through the status stack

- `scripts/build-effect-implementation-index.mjs` — add `subsystem` to `STATUS_ORDER`
  (the join already passes any status through verbatim; this makes the summary carry a
  stable `subsystem` count key). Regenerate `data/metadata/effect-implementation-index.json`
  (`pnpm` effect-index build) + the dashboard's bundled copy (`build-effect-index.mjs`
  prebuild).
- `packages/registry/src/schema.ts` — add `subsystem` to the `effectImplementationIndex`
  status Zod enum (+ `schema.effectImplementationIndex.test.ts`).
- `apps/dashboard/src/types/coverage.ts` — add `subsystem` to the `LedgerStatus` union
  **and** the status array (+ `coverage.drift.test.ts`, which pins the exact list).
- `apps/dashboard/src/composables/useEffectIndex.ts` — add a `subsystem` case to the
  exhaustive `statusLabel` switch and the `byStatus` init object.
- `apps/dashboard/src/pages/debug/EffectsPage.vue` — add `subsystem` to `STATUS_ORDER`
  (summary chips + filter row) and an `fx-subsystem` CSS modifier styled as a **covered**
  state (a done colour, visually distinct from `unmarked`).

### 3.4 Status label

`statusLabel('subsystem')` → a short covered-state label, e.g. **"Subsystem"** (or
"Covered (subsystem)"). Pick one; keep it consistent across `useEffectIndex.ts` and any
CSV header expectations.

## 4. Determinism / scope

- **No engine / `G` / gameplay / determinism change.** This is coverage tooling + the
  dashboard. No card data is edited (the allowlist is a coverage artifact, not card data).
- Regenerate **every** derived feed in one commit (villain ledger CSV+JSON, the
  effect-index JSON, the dashboard bundled copy) or the freshness `:check` gates redden
  `main` (the standard card-data-derived-feed trap).

## 5. Out of scope

- The hero ledger — no hero card is subsystem-covered yet.
- `/coverage` (villain-mechanic-ledger CSV) already inherits the `subsystem` status via
  §3.2 (it *is* that feed); no separate CoveragePage change is needed beyond what the
  shared status stack in §3.3 provides — verify the CoveragePage renders the new status
  and add a label/colour there too if it maintains its own status list.
- Mastermind/scheme subsystem coverage (none marker-less today) — a future extension of
  the same allowlist.
- Changing any card's actual implementation — this is pure observability.

## 6. Definition of Done

- `subsystem-coverage.json` added (3 defeat-requirement cards; + Supreme HYDRA iff WP-546
  merged); villain ledger emits `subsystem` for them; all derived feeds regenerated (real
  diffs, freshness `:check` green).
- `subsystem` threaded through the index generator, the registry Zod schema (+ test), and
  the dashboard union/drift-test/statusLabel/STATUS_ORDER/CSS.
- Tests: an allowlisted would-be-unmarked card → `subsystem` (not `unmarked`); a
  non-allowlisted unmarked card unchanged; the summary counts `subsystem`; the drift +
  schema + exhaustive-switch updates compile and pass.
- `pnpm -r build` + `pnpm -r --no-bail test` green; the dashboard typechecks/builds.
- `/debug/effects` shows Blob / Venom / Zombie-Venom (and Supreme HYDRA, if WP-546 in) as
  `subsystem` (covered), not `unmarked`.
- Governance: D-24357 → Active; STATUS; WORK_INDEX + EC_INDEX flipped; mindmap `📝` → `✅`
  + `pnpm roadmap:counts:write`.
- Commit topology: `EC-583:` (scripts + registry schema + dashboard + regenerated feeds)
  + `SPEC:` (governance).
