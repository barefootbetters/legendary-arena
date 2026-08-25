# WP-606 — UIState Draw-Pool Composition Projection (`deckComposition` + `villainDeckComposition`)

**Status:** Ready
**Primary Layer:** Game Engine (UIState projection — `packages/game-engine/src/ui/**`)
**Dependencies:** WP-128 / EC-131 (the two-stage `buildUIState` → `filterUIStateForAudience` projection pipeline + audience filter), WP-243 / D-24010 (the owner-only `discardCards` redaction precedent), WP-410 / D-24222 (the `matchCardImageUrls` public information-safe pass-through precedent)
**User-Visible Surface:** `none — infrastructure` (the projection is dark until the Deck Probability Panel UI WP consumes it)

> Baseline: `origin/main` at commit `b1251cc7` (SPEC: reserve WP-606 / EC-641 / D-24417, #1647).

---

## Session Context

The client-visible `UIState` projects every player's zones as **counts
only** — `deckCount` / `discardCount` / `handCount` — and the shared villain
deck as `villainDeckCount`. The one exception already in place is the
owner-only `discardCards` / `discardDisplay` pair (WP-243 / D-24010): the
viewing player sees their own discard-pile identities, redacted for everyone
else. The **deck** array is never projected in any form — `buildUIState`
reads `zones.deck.length` and stops, and the projection contract pins
"counts only; the next-card identity is NEVER projected."

The proposed [Deck Probability Panel](../../../wiki/deck-probability-panel.md)
needs one datum the client does not have: the **composition of each draw
pool** — the multiset of cards a player may still draw, and the multiset
still in the villain deck — so it can compute draw odds and hand
projections client-side. Counts are not enough; the panel needs *which*
cards remain, without their order.

This packet adds that datum as two **projection-only, optional** `UIState`
fields: an owner-only `deckComposition` on each player, and a public
`villainDeckComposition` on the shared decks object. Both are **order-
stripped** (the sorted multiset), so they reveal *what* is in the pool and
never *the sequence* — the next-draw secret the scry-KO redaction protects
stays protected. This is the Phase-1 engine/data foundation; the client
panel that consumes it is a named follow-on WP.

---

## Goal

After this session, `buildUIState` projects two new optional fields, and
`filterUIStateForAudience` routes each to the correct audience:

- `UIPlayerState.deckComposition?: string[]` — the **order-stripped**
  (sorted-ascending) multiset of the player's own draw deck
  (`G.playerZones[playerId].deck`). Populated for every player in
  `buildUIState`, **preserved for the owning player** and **redacted for
  every opponent and spectator** in the filter — the exact posture of the
  existing `discardCards` field.
- `UIDecksState.villainDeckComposition?: string[]` — the **order-stripped**
  (sorted-ascending) multiset of the villain deck's undrawn cards
  (`G.villainDeck.deck`). Populated in `buildUIState` and passed through
  **public and value-identical for every audience** (player and spectator),
  mirroring `matchCardImageUrls`.

Both fields are derived at projection time from existing `G` zones, stored
nowhere on `G`, and therefore **hash-neutral** — neither `finalStateHash`
nor the replay `computeStateHash` moves. No gameplay change; no new `G`
state; no consumer wired this WP (the panel is a follow-on).

---

## User-Visible Impact

**None — infrastructure only.** No player-observable change ships in this
packet: the two fields are dark data with no client consumer yet. They exist
so the follow-on Deck Probability Panel UI WP can compute draw odds without
the engine ever running probability math or touching `ctx.random`. STATUS.md
records "No user-observable change — infrastructure only" (D-24026 inverted
gate for a `none — infrastructure` surface).

---

## Assumes

- WP-128 / EC-131 complete: `playerView` (`packages/game-engine/src/game.ts`)
  runs the two-stage `buildUIState(G, ctx)` → `filterUIStateForAudience(full,
  audience)` pipeline; the filter rebuilds per-player state field-by-field via
  `preserveHandCards` (owner) / `redactHandCards` (non-owner) and passes the
  shared-board objects through publicly.
- WP-243 / D-24010 complete: `UIPlayerState.discardCards?: string[]` is
  populated in `buildUIState` (spread copy of `zones.discard`) and rebuilt
  owner-only in `preserveHandCards` (conditional assignment), omitted in
  `redactHandCards`. This is the redaction precedent `deckComposition`
  mirrors exactly.
- WP-410 / D-24222 complete: `UIState.matchCardImageUrls?: string[]` is
  passed through public + value-identical in `filterUIStateForAudience` with
  a fresh array copy (`[...uiState.matchCardImageUrls]`). This is the public
  information-safe pass-through precedent `villainDeckComposition` mirrors.
- `G.playerZones[playerId].deck: CardExtId[]` and
  `G.villainDeck.deck: CardExtId[]` are plain `CardExtId` (string) arrays;
  `deck[0]` is the top card (order is meaningful in `G` and must be stripped
  in the projection).
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` pins optional
  UIState fields with a **runtime keyset assertion on a built projection**
  (`Object.keys(buildUIState(...).X).sort()` deepStrictEqual), because an
  optional field can never trip a `satisfies` pin (WP-563 / D-24372).
- UIState is a derived projection: never stored on `G`, never persisted,
  never fed to either state hash. Both hashes (`hashGameState`,
  `computeStateHash`) are over `G`.
- `pnpm -r build` exits 0; the engine suite passes on `__BASELINE__`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `packages/game-engine/src/ui/uiState.types.ts` — read `UIPlayerState`
  (the `discardCards?: string[]` field is the template) and `UIDecksState`
  (`{ villainDeckCount, heroDeckCount }` — where `villainDeckComposition`
  joins). Both new fields are **optional** so pre-existing hand-written
  UIState fixtures need no backfill (the WP-179 / `matchCardImageUrls`
  pattern) — this keeps the WP single-layer (game-engine only).
- `packages/game-engine/src/ui/uiState.build.ts` — the per-player loop
  (keyed on `G.playerZones`) where `deckCount`/`discardCount`/`discardCards`
  are produced; the "Project decks (counts only)" block where
  `villainDeckCount: gameState.villainDeck.deck.length` is produced. The
  order-strip goes at both sites: `[...zones.deck].sort()` and
  `[...gameState.villainDeck.deck].sort()`.
- `packages/game-engine/src/ui/uiState.filter.ts` — `preserveHandCards` /
  `redactHandCards` (the `discardCards` conditional-assignment block is the
  owner-only template) and the public `decks` pass-through in the `result`
  literal (`decks: { ...uiState.decks }`) + the `matchCardImageUrls`
  fresh-copy block (the public pass-through template).
- `packages/game-engine/src/ui/uiState.filter.test.ts` — the discard
  redaction test (owner `!== undefined`, opponent + spectator `=== undefined`)
  and the public shared-field tests (all three audiences, per-entry copies).
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — the built-
  projection keyset-pin pattern (the menace / `recruitSpendableAsAttack`
  cases) an optional-field add must extend.
- `packages/game-engine/src/state/zones.types.ts` — `PlayerZones.deck: Zone`
  (`Zone = CardExtId[]`); `packages/game-engine/src/villainDeck/villainDeck.types.ts`
  — `VillainDeckState.deck: CardExtId[]`.
- `docs/ai/ARCHITECTURE.md §UIState Projection Integrity` — the five-step
  Board-Visible Field Rule this WP follows (declare → populate → pass through
  with the correct audience disposition → audience-filter test → Play
  Diagnostics `uiStateSnapshot`). Play Diagnostics serializes the whole
  UIState (`apps/arena-client/src/diagnostics/diagnostics.ts`), so the fields
  appear in the export automatically — no arena-client change.
- `docs/ai/DECISIONS.md` — scan D-24010 (owner-only discard projection) and
  D-24222 (matchCardImageUrls information-safe public pass-through); land the
  reserved D-24417 at execution.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — none used here; the sort is deterministic.
- Moves never throw — this WP defines no move; the projection is pure.
- Never persist `G`/`ctx`; `G` stays JSON-serializable — the fields live
  ONLY on the projection, never on `G`.
- ESM only, Node v22+; `node:` prefix on Node built-ins; test files `.test.ts`.
- Full file contents for every modified file — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; no `.reduce()`.

**Packet-specific:**
- **Order-stripped, always.** Both fields are the **sorted-ascending**
  multiset (`[...arr].sort()`), never the raw zone array. Projecting the raw
  order would leak the owner's / villain deck's next-draw sequence — the exact
  secret the WP-470 scry-KO redaction protects. A test MUST prove
  order-independence (two different deck orders → identical projection).
- **`deckComposition` is owner-only.** Populated for every player in
  `buildUIState`; preserved in `preserveHandCards` (fresh copy, conditional
  assignment — never assign `undefined`), omitted in `redactHandCards`.
  Opponents and spectators see `deckCount` only. Mirror `discardCards`.
- **`villainDeckComposition` is public.** Passed through value-identical for
  every audience with a **fresh array copy** (aliasing defense), mirroring
  `matchCardImageUrls`. The villain-deck remaining composition is public
  board knowledge (setup composition minus the public revealed discard);
  only its order is hidden, which the sort strips.
- **Projection-only — no `G` field, no hash surface.** Both fields are
  derived at projection time from existing `G` zones. `G` gains nothing;
  `finalStateHash` and `computeStateHash` are byte-identical (both hash `G`).
- **Optional in the type.** Both fields are `?:` so no arena-client UIState
  fixture needs backfilling — this WP stays game-engine-only. Optional fields
  are pinned by a **runtime keyset assertion on a built projection**, not a
  `satisfies` (WP-563 / D-24372).
- **No consumer wired here.** The Deck Probability Panel that reads these
  fields is a follow-on UI WP. This packet ships the tested data foundation
  only; the fields are proven populated + correctly audienced by the drift +
  filter tests, not left as untested dead wiring.

**Session protocol:**
- If any contract or field name is unclear, stop and ask — never guess.

**Locked contract values (do not re-derive):**
- **Owner-only field:** `deckComposition?: string[]` on `UIPlayerState`.
- **Public field:** `villainDeckComposition?: string[]` on `UIDecksState`.
- **Order-strip:** `[...zone].sort()` (ascending lexicographic) — a canonical
  order-independent multiset.
- **`deckComposition` source:** `G.playerZones[playerId].deck`.
- **`villainDeckComposition` source:** `G.villainDeck.deck`.
- **Owner redaction posture:** identical to `discardCards` (owner preserve /
  non-owner omit).
- **Public pass-through posture:** identical to `matchCardImageUrls` (fresh
  copy, all audiences, conditional assignment).

---

## Debuggability & Diagnostics

- Both fields are pure derivations of existing `G` zones: reproducible by a
  `buildUIState` unit test on a known gameState.
- Order-independence is testable directly: permuting a zone's order leaves
  the projected composition byte-identical (the sorted multiset).
- No new `G` mutation; `JSON.stringify(G)` unaffected.
- The fields appear in the Play Diagnostics `uiStateSnapshot` automatically
  (whole-UIState serialization) — a live match's diagnostics export will show
  them without any diagnostics-tool change.

---

## Scope (In)

### A) Types — the two optional fields (`packages/game-engine/src/ui/uiState.types.ts`, **modified**)
- Add `deckComposition?: string[]` to `UIPlayerState` with JSDoc: the
  order-stripped multiset of the owner's draw deck; owner-only (redacted for
  non-owners), mirroring `discardCards`; order is deliberately stripped so no
  next-draw sequence leaks; projection-only (never a `G` field).
- Add `villainDeckComposition?: string[]` to `UIDecksState` with JSDoc: the
  order-stripped multiset of the villain deck's undrawn cards; public +
  value-identical for every audience (information-safe from the public setup
  composition), mirroring `matchCardImageUrls`; order stripped; projection-only.

### B) Build — populate both (`packages/game-engine/src/ui/uiState.build.ts`, **modified**)
- In the per-player loop, set `deckComposition: [...zones.deck].sort()` on the
  built `UIPlayerState`. Add a `// why:` (order-stripped for information safety
  — reveals composition, never next-draw order; projection-only, no hash
  surface).
- In the "Project decks" block, set
  `villainDeckComposition: [...gameState.villainDeck.deck].sort()` on the
  `UIDecksState`. Add a `// why:` (same rationale; public because the
  remaining villain composition is derivable from public setup + revealed
  discard).

### C) Filter — audience routing (`packages/game-engine/src/ui/uiState.filter.ts`, **modified**)
- In `preserveHandCards`: add a conditional-assignment block passing
  `deckComposition` through for the owner with a fresh copy
  (`[...player.deckComposition]`), mirroring the `discardCards` block; never
  assign `undefined`.
- In `redactHandCards`: do **not** assign `deckComposition` (omitted for
  opponents + spectators).
- For `villainDeckComposition`: it lives inside `UIDecksState`, so the public
  `decks` pass-through (`decks: { ...uiState.decks }`) must fresh-copy the
  array — a bare spread shallow-aliases it. Exact `exactOptionalPropertyTypes`-
  safe form: `decks: { ...uiState.decks, ...(uiState.decks.villainDeckComposition
  !== undefined ? { villainDeckComposition: [...uiState.decks.villainDeckComposition]
  } : {}) }` — never a `villainDeckComposition: undefined` literal, never a bare
  `[...maybe-undefined]`. Every audience sees a value-identical independent copy
  (`matchCardImageUrls` precedent).

### D) Filter test (`packages/game-engine/src/ui/uiState.filter.test.ts`, **modified**)
- `deckComposition`: build a UIState with a known non-empty deck; assert the
  owner audience sees it (`!== undefined`, value-equal to the sorted deck) and
  the opponent + spectator audiences see `=== undefined`. Mirror the discard
  redaction test.
- `villainDeckComposition`: assert all three audiences see it, value-equal and
  as independent copies (mutating one does not affect `G` / another audience).

### E) Drift test (`packages/game-engine/src/ui/uiState.types.drift.test.ts`, **modified**)
- **Add** a new built-projection keyset assertion for `UIPlayerState`: build a
  UIState with a populated deck, take the owner's `players[0]`, and
  `assert.deepStrictEqual(Object.keys(player).sort(), [...owner keyset incl.
  deckComposition])`. There is **no existing** `UIPlayerState` built-projection
  keyset pin to extend — the current `UIPlayerState` drift fixtures are
  hand-written `satisfies`, which an optional add can never trip (WP-563 /
  D-24372). Likewise **add** a built-projection keyset assertion on
  `result.decks` including `villainDeckComposition` (do not rely on the
  hand-written `UIDecksState` `satisfies`+keyset — an optional add won't break
  it; only a `Object.keys(...).sort()` assertion on a real `buildUIState`
  result catches a dropped optional field).
- Add an **order-independence** assertion: build the same match with the deck
  zone permuted (reverse order) and assert `deckComposition` /
  `villainDeckComposition` are byte-identical to the unpermuted projection
  (proves the sort strips order; a non-vacuous guard). Include the negative:
  an unsorted raw-order projection would differ — assert the projection is
  NOT equal to the raw (unsorted) zone when the zone is out of order.

---

## Out of Scope

- **No client / UI change.** The Deck Probability Panel that consumes these
  fields is a separate follow-on WP. No `apps/arena-client/**` file changes
  (the fields are optional, so no fixture backfill; Play Diagnostics picks
  them up via whole-UIState serialization).
- **No `G` field, no gameplay change, no move.** The fields are derived at
  projection time from existing `G` zones; `G` gains nothing.
- **No display / registry resolution in the projection.** The fields are raw
  `CardExtId` multisets; the client resolves attack / recruit / cost from the
  registry it already holds. No `deckDisplay` parallel array.
- **No hand-projection or probability math.** All odds / Monte-Carlo work is
  the client panel's job (client-side, `ctx.random`-free), a follow-on WP.
- **No order projection, ever.** Draw ORDER stays private; only the sorted
  multiset ships.
- **No `discardCards` change.** The owner already has discard identities; the
  client combines `deckComposition` + `discardCards` to form the full pool.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — add `deckComposition?` (UIPlayerState) + `villainDeckComposition?` (UIDecksState)
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate both via `[...zone].sort()`
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — owner-only pass-through for `deckComposition`; public fresh-copy for `villainDeckComposition`
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — owner-only + public audience assertions
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — keyset pins + order-independence guard

No other files may be modified.

---

## Vision Alignment

N/A — this WP touches none of the trigger surfaces: no scoring/PAR/
leaderboards, no identity, no multiplayer sync, no card-data/content-semantics
change, no monetization. It is a read-only projection add.

**Determinism note (load-bearing):** UIState is a **derived projection** built
by `buildUIState` from `G`; it is never stored on `G`, never persisted, and
never fed to either hash oracle (`hashGameState` / `computeStateHash` both
hash `G`). Adding a projected field built from existing `G` zones adds **no
new `G` state**, so both `finalStateHash` and the replay `PRE_WP080` /
`computeStateHash` oracles are **byte-identical** — no re-pin (the
`matchCardImageUrls` / menace precedent: "projection-only: never a G field, so
no state-hash surface"). The AC still requires running the engine suite to
confirm both oracles are unchanged.

## Funding Surface Gate

N/A — no funding affordance / channel / user-visible donate-support copy.

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function;
the fields flow over the boardgame.io state projection, not the HTTP surface.

---

## Acceptance Criteria

All items are binary pass/fail.

### Types + build
- [ ] `UIPlayerState.deckComposition?: string[]` and
  `UIDecksState.villainDeckComposition?: string[]` are declared optional.
- [ ] `buildUIState` populates `deckComposition` = `[...zones.deck].sort()` for
  every player and `villainDeckComposition` = `[...villainDeck.deck].sort()`.
- [ ] Both projections are order-independent: permuting the source zone leaves
  the projected field byte-identical (proven by test).

### Filter (audience)
- [ ] `deckComposition` survives for the owner audience (value-equal to the
  sorted deck) and is `undefined` for every opponent + spectator audience.
- [ ] `villainDeckComposition` is present + value-identical for all three
  audiences (player / opponent / spectator) as independent array copies.

### Determinism + scope
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes with the
  sentinel `finalStateHash` and `PRE_WP080_HASH` **unchanged** (projection-
  only; no re-pin).
- [ ] `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified
  (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build everything
pnpm -r build
# Expected: exits 0

# Step 2 — engine tests (drift keyset + order-independence + filter audience + NO hash re-pin)
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; sentinel finalStateHash + PRE_WP080_HASH unchanged

# Step 3 — confirm the projection is order-stripped (sorted) at both build sites
Select-String -Path "packages\game-engine\src\ui\uiState.build.ts" -Pattern "\.sort\(\)"
# Expected: the two new composition sites among the matches

# Step 4 — scope check
git diff --name-only
# Expected: only the 5 files in ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] **`none — infrastructure` surface (D-24026 inverted):** STATUS.md states
  "No user-observable change — infrastructure only"; no live-surface check
  applies (the fields have no client consumer this WP).
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0.
- [ ] Engine suite passes; sentinel `finalStateHash` + `PRE_WP080_HASH`
  unchanged (projection-only).
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated — UIState now projects owner-only
  `deckComposition` + public `villainDeckComposition` (dark data for the
  future Deck Probability Panel).
- [ ] `docs/ai/DECISIONS.md` updated — land D-24417 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-606 checked off with today's date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node flipped `📝` → `✅`; `pnpm roadmap:counts:write` refreshed.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` (**Lint verdict: PASS**):

- §1 Structure — PASS. All required sections present and non-empty; Out of Scope lists 7 exclusions.
- §2 Non-Negotiable Constraints — PASS. Full-file-contents required, diffs/snippets forbidden, ESM/Node v22+, references 00.6-code-style.md.
- §3 Assumes — PASS. WP-128/243/410 + exact G zone shapes (`playerZones[id].deck`, `villainDeck.deck`) + drift-test pattern + BLOCKED clause.
- §4 Context (Read First) — PASS. Specific files/sections + ARCHITECTURE.md §UIState Projection Integrity + D-24010/D-24222. 00.2 §8.1 N/A: UIState projection fields, not card-data/match-config fields (WP-410 precedent).
- §5 Files Expected to Change — PASS. 5 files, each modified with change note; "No other files may be modified"; bounded; no ambiguous-output language.
- §6 Naming — PASS. `deckComposition` / `villainDeckComposition` are full English words; no forbidden abbreviations; no 00.2 conflict.
- §7 Dependency Discipline — N/A. No new npm dependencies.
- §8 Architectural Boundaries — PASS. Game-engine projection only; no DB/move/`Math.random`; fields live only on the projection; `G` stays JSON-serializable.
- §9 Windows Compatibility — PASS. Verification Steps use `Select-String` (pwsh) and backslash paths.
- §10 Env Var Hygiene — N/A. No environment variables; no secrets.
- §11 Authentication — N/A. Does not touch authentication.
- §12 Test Quality — PASS. `node:test`/`node:assert`, no boardgame.io import, no network/DB; deck-construction golden test N/A (projection WP; order-independence + sentinel-hash-unchanged are the determinism proofs).
- §13 Commands & Verification — PASS. All `pnpm`, exact commands with inline expected output; `pnpm check`/`validate` N/A.
- §14 Acceptance Criteria — PASS. 8 binary, observable, specific items aligned to deliverables.
- §15 Definition of Done — PASS. STATUS/DECISIONS/WORK_INDEX + scope-boundary + all-AC-pass; `User-Visible Surface = none — infrastructure`; §15.1 inverted STATUS line present.
- §16 Code Style — PASS. `[...zone].sort()` + conditional-assignment design; no `.reduce()`; `// why:` comments required; references 00.6.
- §17 Vision Alignment — PASS. Section present, N/A declared with reason; load-bearing determinism-preservation line included (projection built from `G`, never stored on `G`, never fed to either hash oracle).
- §18 Prose-vs-Grep — PASS. The `.sort()` grep is a presence grep on `uiState.build.ts` (not a forbidden-token grep), and WP/EC prose is not under the grep path — no false-positive risk.
- §19 Bridge-vs-HEAD Staleness — N/A for lint (commit-time discipline); baseline resolved to `b1251cc7`.
- §20 Funding Surface Gate — PASS. N/A with non-tautological justification (no funding affordance/channel/donate-support copy).
- §21 API Catalog — PASS. N/A with reason (no HTTP endpoint, no `apps/server/src/**` Library-only function; fields flow over the state projection).

**Lint verdict: PASS (all 21 resolved; 6 N/A each justified).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-25).**

- **Dependencies verified against `main` code:** the `discardCards` owner-only redaction precedent (`uiState.filter.ts` `preserveHandCards`/`redactHandCards`), `UIDecksState = { villainDeckCount, heroDeckCount }`, the `matchCardImageUrls` public fresh-copy pass-through, `PlayerZones.deck` / `VillainDeckState.deck` as `CardExtId[]` (top = index 0), and the runtime keyset-pin-on-built-projection pattern all confirmed by direct source read.
- **No collision:** neither `deckComposition` nor `villainDeckComposition` exists anywhere in the engine.
- **Determinism:** both hash oracles (`hashGameState`, `computeStateHash`) serialize `G` only; a projection-only field cannot move `finalStateHash` / `PRE_WP080_HASH`. Confirmed.
- **Green baseline:** `main @ b1251cc7`; the `pnpm -r build` + engine-suite green check is an execution-time precondition.
- **RS-1 (resolved in Scope E):** there is no existing `UIPlayerState` built-projection keyset pin to *extend* — the executor **adds** a new built-projection keyset assertion for both new fields (Scope E reworded accordingly).
- **RS-2 (non-blocking):** `villainDeckComposition` public-safety rests on the match loadout being public (villain/henchman groups, twists, strikes, bystander count derive from the public configuration, consistent with D-24153); land D-24417 with that public-derivability rationale explicit (it is).
- **PS items (blocking): none.**

---

## Copilot Check (01.7)

**Verdict: RISK (minor) → CONFIRM (2026-08-25).** The pre-flight READY verdict
stands; scope is unchanged (same 5-file allowlist, same contract, no
mutation-boundary move). The copilot independently verified every high-risk
claim against the real engine code — and its adversarial information-leak
hypotheses were **refuted by the code**:

- **Villain-deck public-safety — PASS (code-verified).** The concern that
  shuffled-in villain-deck cards might carry randomly-drawn hidden identities a
  sorted multiset would leak: refuted. `villainDeck.setup.ts` generates
  villain-deck bystanders / twists / strikes as **synthetic generic** ext_ids
  (`bystander-villain-deck-NN`, `scheme-twist-{slug}-NN`, `master-strike-NN`),
  deterministic and public from setup; only ORDER is secret, which the sort
  strips.
- **Owner-deck, determinism, layer boundary, dead-wiring — all PASS
  (code-verified):** the D-24010 owner-only posture, the hash-neutral
  projection (both oracles hash `G`), game-engine-only (optional fields → no
  fixture backfill), and tested-not-dead (drift + filter + order-independence).

Two minor EC clarifications were raised and **applied in-place** (scope-neutral,
so no pre-flight re-run):

1. **Drift-test vacuous-pin trap** — the EC now requires **adding a new
   built-projection keyset assertion** over `buildUIState(...)`, and forbids
   extending the hand-written-fixture `UIDecksState`/`UIPlayerState` keysets (a
   keyset over a hand-written fixture is as vacuous as `satisfies` for an
   optional add). EC Guardrails + Common Failure Smells updated; WP Scope E
   already worded "add," not "extend."
2. **`decks`-spread `exactOptionalPropertyTypes` shape** — the EC now locks the
   exact conditional fresh-copy form for `villainDeckComposition` inside the
   `decks` pass-through (never a `: undefined` literal, never a bare
   `[...maybe-undefined]`); WP Scope C spells out the same form.

**Disposition: CONFIRM** — both concerns documented + resolved; session-prompt
generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24417 (reserved; Drafted 2026-08-25, not yet landed)** — Locks the
  information-disclosure boundary for the draw-pool composition projection. A
  player's **own draw-pool composition** (the sorted, order-stripped multiset
  of `G.playerZones[id].deck`) is information-safe to project **to that player
  only** — it is derivable from their own deckbuilding plus the public discard,
  and is distinct from draw **order**, which stays private (the WP-470 scry-KO
  redaction). It is projected as owner-only `UIPlayerState.deckComposition`,
  redacted for opponents + spectators (the WP-243 `discardCards` posture). The
  **villain-deck composition** (sorted, order-stripped multiset of
  `G.villainDeck.deck`) is **public** — derivable from the public setup
  composition minus the public revealed discard — projected as
  `UIDecksState.villainDeckComposition`, value-identical for every audience
  (the WP-410 `matchCardImageUrls` posture). Both are **projection-only**
  (never a `G` field, no state-hash surface) and **order-stripped** (the sort
  guarantees composition-not-sequence). Enables the client-side Deck
  Probability Panel to compute draw odds without the engine running
  probability math or `ctx.random` (advisory, never authoritative). Both
  fields are optional in the type, so no arena-client fixture backfill.

---

## See Also

- [WP-243](WP-243-villain-fight-ko-hero-player-choice-ux.md) / D-24010 — the owner-only `discardCards` redaction precedent this mirrors
- [WP-410](WP-410-card-image-setup-prefetch.md) / D-24222 — the `matchCardImageUrls` public information-safe pass-through precedent
- `wiki/deck-probability-panel.md` — the follow-on UI consumer (the panel that reads these fields)
- `wiki/play-board.md` — the zone→UIState field map + the two-stage projection pipeline
- `docs/ai/ARCHITECTURE.md §UIState Projection Integrity` — the five-step Board-Visible Field Rule
