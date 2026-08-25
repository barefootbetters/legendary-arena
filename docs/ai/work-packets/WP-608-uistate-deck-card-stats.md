# WP-608 — UIState Deck-Card-Stats Projection (`deckCardStats`)

**Status:** Ready
**Primary Layer:** Game Engine (UIState projection — `packages/game-engine/src/ui/**`)
**Dependencies:** WP-606 / D-24417 (the owner-only `deckComposition` projection + its audience-filter redaction posture, which `deckCardStats` mirrors), WP-128 / EC-131 (the two-stage `buildUIState` → `filterUIStateForAudience` pipeline)
**User-Visible Surface:** `none — infrastructure`

> Baseline: `origin/main` at commit `2eabbe11` (SPEC: reserve WP-608 / EC-643 / D-24419, #1653).

---

## Session Context

WP-606 projected the viewer's own draw-pool **composition** (`deckComposition`,
an order-stripped CardExtId multiset, owner-only) and WP-607 rendered it as the
Phase-1 counter. The Phase-2 feature — **hand projection** (a client-side Monte
Carlo predicting the next hand's expected recruit/attack) — needs one datum the
client cannot get: each draw-pool card's **recruit / attack / cost** values.

Those live only in the engine's internal `G.cardStats: Record<CardExtId,
CardStatEntry>` (`{attack, recruit, cost, fightCost, …}`), which is on the
**forbidden-internals** list (`uiState.types.ts`) and is **never projected** —
`buildUIState` reads only `G.cardDisplayData` (carrying `cost`, but not
recruit/attack). `UICardDisplay` is locked to seven presentation fields (a drift
test forbids adding `recruit`/`attack`), and `apps/arena-client` ships no
registry. So there is no client path to recruit/attack today.

This packet adds that datum as a new **owner-only, projection-only** `UIState`
field: a **separate `extId → {recruit, attack, cost}` map** on each player,
derived from `G.cardStats`, redacted for non-owners exactly like
`deckComposition`. It is the engine/data foundation the follow-on client
hand-projection WP consumes; nothing renders it in this packet.

---

## Goal

After this session, `buildUIState` projects a new optional field and
`filterUIStateForAudience` routes it owner-only:

- `UIPlayerState.deckCardStats?: Record<string, UIDeckCardStat>` where
  `UIDeckCardStat = { recruit: number; attack: number; cost: number }`. For each
  **unique** CardExtId in the union of the player's **deck + discard** zones that
  has a `G.cardStats` entry, the map carries `{ recruit, attack, cost }` from
  that entry. Populated for every player in `buildUIState`; **preserved for the
  owning player** and **redacted for every opponent and spectator** in the
  filter — the exact `deckComposition` posture.

Non-hero pool cards (e.g. Wounds) have no `G.cardStats` entry and are simply
omitted from the map — the client defaults a missing key to 0 recruit / 0
attack. The field is derived at projection time from existing `G` state, stored
nowhere on `G`, and therefore **hash-neutral** (neither `finalStateHash` nor
`computeStateHash` moves). No gameplay change; no consumer wired here.

---

## User-Visible Impact

**None — infrastructure only.** No player-observable change ships: the field is
dark data with no client consumer yet. It exists so the follow-on client
hand-projection Monte Carlo can compute expected recruit/attack without the
engine running probability math or the client needing registry access.
STATUS.md records "No user-observable change — infrastructure only" (D-24026
inverted gate for a `none — infrastructure` surface).

---

## Assumes

- WP-606 / D-24417 complete on `main`: `UIPlayerState.deckComposition?` is
  populated in `buildUIState` and rebuilt owner-only in `preserveHandCards`
  (conditional assignment), omitted in `redactHandCards` — the redaction
  precedent `deckCardStats` mirrors.
- `G.cardStats: Record<CardExtId, CardStatEntry>` exists at setup
  (`packages/game-engine/src/types.ts`; `CardStatEntry` in
  `economy/economy.types.ts` carries `attack`, `recruit`, `cost`, …). It is an
  internal G field, never projected — this WP reads it in `buildUIState` only.
- `G.playerZones[id].deck` and `.discard` are `CardExtId[]` (WP-606).
- `uiState.types.drift.test.ts` pins optional UIState fields with a **runtime
  keyset assertion on a built projection** (WP-563 / D-24372).
- UIState is projection-only: never stored on `G`, never hashed (both hashes are
  over `G`).
- `pnpm -r build` 0; the engine suite passes on `2eabbe11`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `packages/game-engine/src/ui/uiState.types.ts` — `UIPlayerState`
  (`deckComposition?` at ~407 is the owner-only template) and the
  forbidden-internals note listing `cardStats`. Add `UIDeckCardStat` +
  `deckCardStats?`. Optional so pre-existing UIState fixtures need no backfill
  (keeps the WP game-engine-only).
- `packages/game-engine/src/ui/uiState.build.ts` — the per-player loop where
  `deckComposition: [...zones.deck].sort()` is built; add the `deckCardStats`
  map beside it, reading `gameState.cardStats`.
- `packages/game-engine/src/ui/uiState.filter.ts` — `preserveHandCards` (the
  `deckComposition` owner block) / `redactHandCards` (the omission). Add
  `deckCardStats` with a fresh deep copy (new object + per-entry `{ ...stat }`).
- `packages/game-engine/src/ui/uiState.filter.test.ts` — the `deckComposition`
  owner-only redaction test (owner `!== undefined`, opponent + spectator
  `=== undefined`) to mirror.
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — the built-
  projection keyset-pin pattern (WP-606's `deckComposition` pin) to extend.
- `packages/game-engine/src/types.ts` + `economy/economy.types.ts` —
  `G.cardStats` shape + `CardStatEntry`.
- `docs/ai/ARCHITECTURE.md §UIState Projection Integrity` — the five-step
  Board-Visible Field Rule this follows.
- `docs/ai/DECISIONS.md` — D-24417 (owner-only projection precedent); land the
  reserved D-24419 at execution.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Never `Math.random()`; no I/O; moves never throw (this WP defines no move).
- Never persist `G`/`ctx`; `G` stays JSON-serializable — the field lives ONLY
  on the projection, never on `G`.
- ESM only, Node v22+, `node:` prefix; `.test.ts`; full file contents — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; no `.reduce()`.

**Packet-specific:**
- **A separate `extId → stats` map — NOT `UICardDisplay`, NOT `deckComposition`
  enrichment.** Recruit/attack are gameplay values; `UICardDisplay` is locked to
  7 presentation fields (adding them trips its drift test) and `cardDisplayData`
  is the presentation channel. `deckComposition` is a deliberate order-stripped
  multiset — enriching it repeats stats per duplicate and invites order leakage.
  A deduped `extId → {recruit, attack, cost}` map keyed by ext_id is DRY and
  order-free; the client counts each ext_id from `deckComposition` and looks up
  its stats here.
- **Owner-only.** Populated for every player in `buildUIState`; preserved in
  `preserveHandCards` (fresh deep copy, conditional assignment), omitted in
  `redactHandCards`. The stat *values* are public card data, but the map *keys*
  reveal the owner's pool composition — the same information `deckComposition`
  redacts. Mirror `deckComposition`.
- **Source = `G.cardStats`, deck+discard union, SORTED keys.** For each unique
  ext_id in `zones.deck ∪ zones.discard` that has a `gameState.cardStats` entry,
  project `{ recruit, attack, cost }`. Omit ext_ids with no entry (non-hero
  cards) — the client defaults them to 0/0.
- **Sorted keys — no order leak.** The map keys are the **sorted** unique
  ext_ids. A `Record`'s serialized key order is its insertion order, so building
  from raw-array first-occurrence order would leak partial next-draw sequence —
  even to the owner, who by design does not know their own deck order. Sort the
  deduped keys before constructing the map (the `deckComposition` order-strip
  rationale, WP-470 scry-KO secret).
- **Projection-only — no `G` field, no hash surface.** Derived at projection
  time; `finalStateHash` + `computeStateHash` byte-identical.
- **Optional in the type**, pinned by a **built-projection** keyset assertion,
  never a `satisfies`/hand-written-fixture keyset (WP-563 / D-24372).
- **No consumer wired here.** The client Monte Carlo is a follow-on WP; this
  ships the tested data foundation only.

**Session protocol:** if a field name, `G.cardStats` shape, or the zone union is
unclear, STOP and read the cited file — never guess.

**Locked values (do not re-derive):**
- `UIDeckCardStat = { recruit: number; attack: number; cost: number }`.
- `UIPlayerState.deckCardStats?: Record<string, UIDeckCardStat>` — owner-only.
- Source: `gameState.cardStats[extId]` for `extId ∈ sorted(unique(zones.deck ∪ zones.discard))` — keys **sorted** (order-stripped).
- Owner redaction posture ≡ `deckComposition`.

---

## Debuggability & Diagnostics

- Pure derivation of existing `G` zones + `G.cardStats`; reproducible by a
  `buildUIState` unit test on a known gameState.
- No new `G` mutation; `JSON.stringify(G)` unaffected.
- Appears in the Play Diagnostics `uiStateSnapshot` automatically (whole-UIState
  serialization).

---

## Scope (In)

### A) Types (`packages/game-engine/src/ui/uiState.types.ts`, **modified**)
- Add `export interface UIDeckCardStat { recruit: number; attack: number; cost: number }`.
- Add `deckCardStats?: Record<string, UIDeckCardStat>` to `UIPlayerState` with
  JSDoc: owner-only (redacted for non-owners, the `deckComposition` posture);
  the recruit/attack/cost of each draw-pool card, keyed by ext_id, sourced from
  the internal `G.cardStats` (NOT `UICardDisplay`/`cardDisplayData` — gameplay
  values, not presentation); projection-only (never a `G` field).

### B) Build (`packages/game-engine/src/ui/uiState.build.ts`, **modified**)
- In the per-player loop, build `deckCardStats` from the union of `zones.deck`
  and `zones.discard`. **Collect the unique ext_ids (a `Set`/seen-guard, no
  `.reduce()`), `.sort()` them, then construct the `Record` in sorted-key
  order** — so the map's key insertion order carries no draw-order information
  (see the sorted-keys constraint above). For each sorted unique ext_id with a
  `gameState.cardStats` entry, set `map[extId] = { recruit, attack, cost }`
  (copy the three fields, not the whole `CardStatEntry`, so the projection never
  aliases `G.cardStats`). Add a `// why:` (a separate stats map from the
  internal `G.cardStats`; SORTED keys strip draw order; owner-only;
  projection-only; non-hero cards omitted).

### C) Filter (`packages/game-engine/src/ui/uiState.filter.ts`, **modified**)
- `preserveHandCards`: pass `deckCardStats` through for the owner with a **fresh
  deep copy** (new object; each entry `{ ...stat }`), conditional assignment
  (never a literal `undefined`).
- `redactHandCards`: omit it (no assignment). Add a `// why:` (owner-only, keys
  reveal the pool composition — the `deckComposition` posture).

### D) Filter test (`packages/game-engine/src/ui/uiState.filter.test.ts`, **modified**)
- Owner sees `deckCardStats` (`!== undefined`, value-equal, an independent copy);
  opponent + spectator see `=== undefined`. Mirror the `deckComposition` test.

### E) Drift test (`packages/game-engine/src/ui/uiState.types.drift.test.ts`, **modified**)
- Add a **built-projection** keyset assertion on the owner's `players[i]`
  including `deckCardStats`, and pin the `UIDeckCardStat` entry keyset
  (`{ recruit, attack, cost }`) on a built projection (not a hand-written
  fixture / `satisfies`).
- The fixture MUST exercise the behaviors the AC claims, non-vacuously:
  (a) an ext_id present in **both** `deck` and `discard` → assert a **single
  deduped key**; (b) a **non-hero pool card with no `G.cardStats` entry** (e.g.
  a Wound) → assert the key is **omitted**; (c) permute the deck/discard order
  and assert `Object.keys(deckCardStats)` is **byte-identical** (sorted,
  order-independent) — mirror the existing `deckComposition` order-independence
  assertion.

---

## Out of Scope

- **No client / UI change.** The hand-projection Monte Carlo is a follow-on WP.
- **No `G` field / gameplay / move change.** Derived from existing `G`.
- **No change to `UICardDisplay` / `cardDisplayData`.** Stats are a separate map.
- **No non-hero stat synthesis.** Wounds etc. are omitted; the client defaults 0/0.
- **No hand/inPlay/victory coverage.** The draw pool is deck + discard; other
  zones are out of scope (they re-enter the pool via discard over time).
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `UIDeckCardStat` + `deckCardStats?`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate from `G.cardStats` (deck+discard union)
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — owner-only deep-copy pass-through / omit
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — owner-only audience assertions
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — built-projection keyset pin + entry shape

No other files may be modified.

---

## Vision Alignment

N/A — no scoring/PAR/leaderboards, identity, multiplayer sync,
card-data/content-semantics, or monetization. A read-only projection add.

**Determinism note (load-bearing):** UIState is a derived projection built from
`G`; never stored on `G`, never fed to either hash oracle (both hash `G`).
Adding a projected field derived from existing `G` state (`cardStats` + zones)
adds no new `G` state, so `finalStateHash` and the replay `PRE_WP080` /
`computeStateHash` oracles are byte-identical — no re-pin (the
`deckComposition` / `matchCardImageUrls` precedent). The AC still requires
running the engine suite to confirm.

## Funding Surface Gate

N/A — no funding affordance / channel / user-visible donate-support copy.

## API Catalog

N/A — no HTTP endpoint, no `apps/server/src/**` library function.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `UIDeckCardStat` = `{ recruit, attack, cost }`; `UIPlayerState.deckCardStats?`
  declared optional.
- [ ] `buildUIState` populates `deckCardStats` for the **sorted unique** ext_ids
  of each player's deck + discard union; values are `{ recruit, attack, cost }`
  copied from `G.cardStats` (the three fields, not the whole `CardStatEntry`;
  no `G` aliasing).
- [ ] An ext_id present in **both** deck and discard yields a **single** map key
  (deduped).
- [ ] A **non-hero** pool card with no `G.cardStats` entry is **omitted** from
  the map.
- [ ] The map's key order is **independent of deck/discard order** — permuting
  the source zones leaves `Object.keys(deckCardStats)` byte-identical (no
  draw-order leak).
- [ ] `deckCardStats` survives for the owner audience (value-equal, independent
  deep copy) and is `undefined` for every opponent + spectator audience.
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes with sentinel
  `finalStateHash` + `PRE_WP080_HASH` **unchanged**; `pnpm -r build` 0; no files
  outside `## Files Expected to Change`.

---

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0

pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; sentinel finalStateHash + PRE_WP080_HASH unchanged

Select-String -Path "packages\game-engine\src\ui\uiState.build.ts" -Pattern "cardStats"
# Expected: the new deckCardStats build site reads gameState.cardStats

git diff --name-only
# Expected: only the 5 files in ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **`none — infrastructure` surface (D-24026 inverted):** STATUS.md states
  "No user-observable change — infrastructure only"; no live-surface check.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; engine suite passes; sentinel hashes unchanged.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — land D-24419 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-608 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS** (the §14 acceptance-criteria count [5→7], the §15.1 `**User-Visible Surface:**` header token, and the §2 "no diffs, no snippets" phrasing were added after the gate flagged them).

- §1 Structure — PASS (all sections; 6 Out-of-Scope bullets).
- §2 Non-Negotiable Constraints — PASS (Always-apply: full file contents, no diffs/snippets, ESM/Node v22+, `00.6`; packet-specific; session protocol; locked values).
- §3 Assumes — PASS (WP-606, `G.cardStats` shape+file, zone types, drift-pin, clean baseline).
- §4 Context — PASS (specific file+section refs; ARCH §UIState Projection Integrity, D-24417).
- §5 Files — PASS (5 files, all `— modified`, one-line notes, bounded).
- §6 Naming — PASS (`deckCardStats`/`UIDeckCardStat`; recruit/attack/cost match `CardStatEntry`).
- §7 Dependencies — PASS (no new npm deps).
- §8 Architectural Boundaries — PASS (game-engine only; no DB/G-persist/`Math.random`).
- §9 Windows — PASS (pwsh, Select-String, backslash paths).
- §10 Env / §11 Auth — N/A.
- §12 Test Quality — PASS (node:test, no bgio, no net/DB; deck-golden items N/A).
- §13 Verification — PASS (exact `pnpm` cmds + inline expected output).
- §14 Acceptance Criteria — PASS (7 binary items after split).
- §15 / §15.1 DoD — PASS (`**User-Visible Surface:** none — infrastructure` header + `## User-Visible Impact` + inverted D-24026 DoD gate).
- §16 Code Style — PASS (no `.reduce()`; `for...of` + seen-guard; `// why:` enumerated; deep copy; sorted keys).
- §17 Vision Alignment — PASS (N/A + correct hash-neutral determinism note).
- §18 Prose-vs-Grep — N/A (only a positive-presence `cardStats` grep; no forbidden-token grep).
- §19 Bridge-vs-HEAD — N/A (commit-time; baseline resolved to the #1653 reserve commit).
- §20 Funding / §21 API Catalog — N/A (reasons named).

**Lint verdict: PASS.**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-25).**

- **All code/dependency claims verified TRUE against `main`:** `G.cardStats: Record<CardExtId, CardStatEntry>` (`types.ts`), `CardStatEntry.{attack,recruit,cost,…}` (`economy/economy.types.ts`), `cardStats` on the forbidden-internals list (never in UIState), the WP-606 `deckComposition` owner-only precedent (build/preserve/omit + built-projection drift pin), `UICardDisplay` locked-7-fields drift test, `deck`/`discard` as `CardExtId[]`, projection-only/hash-neutral. No name collision.
- **PS-1 (resolved):** the initial pre-flight ran while the reserve PR (#1653) was still auto-merging, so `main` did not yet show WP-608/EC-643/D-24419 — a timing artifact of the reserve-first flow, not a defect. #1653 has since merged; the reservation is on `main` and the baseline note is correct.
- **RS-1 (non-blocking):** non-hero cards (Wounds) having no `cardStats` entry is immaterial — a present entry projects `{0,0,0}`, an absent one is omitted and the client defaults 0/0; both safe. The drift test pins the omission branch regardless.
- **PS items (blocking): none** (PS-1 resolved on merge).

---

## Copilot Check (01.7)

**Verdict: RISK (minor) → CONFIRM (2026-08-25).** Scope unchanged (5-file allowlist). Copilot verified projection-only/hash-neutral, the owner-only disposition (the map *keys* reveal the pool composition — already redacted by `deckComposition`/`discardCards`; projecting wider would leak it), and the deep-copy discipline. Two scope-neutral RISKs were **applied in-place**:

1. **Key-order leak (the important one).** A `Record`'s serialized key order = insertion order, so building the map in raw deck/discard first-occurrence order would leak partial next-draw sequence — even to the owner, the exact secret `deckComposition`'s sort strips (WP-470). **Fix:** build from a **sorted** deduped key list (Scope B + the sorted-keys constraint), pinned by a key-order-independence assertion (Scope E).
2. **Non-vacuous behavior tests.** The dedupe-over-union and non-hero-omission behaviors were AC'd but not pinned. **Fix:** the drift fixture must include a cross-zone duplicate ext_id (assert one deduped key) and a non-hero card with no `cardStats` entry (assert omission) (Scope E + ACs).

**Disposition: CONFIRM** — both concerns applied; session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24419 (reserved; Drafted 2026-08-25, not yet landed)** — Owner-only
  UIState projection of the viewer's draw-pool card stats (`extId →
  recruit/attack/cost`) derived from the internal `G.cardStats`, for the Phase-2
  client-side hand-projection Monte Carlo (D-24418 advisory). A **separate
  `extId → stats` map** keyed by ext_id (not enriching the order-stripped
  `deckComposition` multiset — DRY, no order leak), sourced from `G.cardStats`
  in `buildUIState` (**not** `UICardDisplay`, locked to 7 presentation fields;
  recruit/attack are gameplay values, distinct from the `cardDisplayData`
  presentation channel). Redacted **owner-only** (the `deckComposition` posture
  — the keys reveal the owner's pool). Covers the union of the owner's deck +
  discard ext_ids that have a `cardStats` entry (non-hero cards e.g. Wounds have
  none → omitted → the client defaults them to 0 recruit / 0 attack).
  **Projection-only** — never a `G` field, no state-hash surface.

---

## See Also

- [WP-606](WP-606-uistate-draw-pool-composition.md) / D-24417 — the owner-only `deckComposition` projection this mirrors
- `wiki/deck-probability-panel.md` — the panel design; hand projection is the Phase-2 consumer
- `docs/ai/ARCHITECTURE.md §UIState Projection Integrity` — the five-step Board-Visible Field Rule
