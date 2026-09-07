# WP-664 — Project the Transform side deck to the UI + render a face-up pile (Game Engine + Arena Client)

**Status:** Draft — pending execution
**Primary Layer:** Game Engine (UIState projection) + Arena Client (render)
**User-Visible Surface:** play.legendary-arena.com

---

## Goal

`G.transformDeck` — the Transform second-form side deck set aside at setup
(WP-657 / D-24468) and consumed by the `[keyword:Transform]` swap (WP-658 /
D-24469) — exists in engine state and works, but is **never projected to the
client**. `transformDeck` appears nowhere in `packages/game-engine/src/ui/`
(not in the `UIState` type, `buildUIState`, or `filterUIStateForAudience`) and
nowhere in `apps/arena-client/src/`. So a player cannot see the separate
transform deck: from their seat the second-forms (Hurl Trucks, Like Totally
Smart Hulk) are simply invisible. This WP adds a **read-only** UIState
projection of the side deck plus a **face-up** client render, so the player
sees the second-forms sitting beside the play area — matching the physical
game, where Transform cards are laid out face-up.

## User-Visible Impact

In a match with Transform heroes (today: `wwhk` — She-Hulk, Amadeus Cho), the
play surface now shows a **Transform Deck** pile displaying each set-aside
second-form card face-up. A She-Hulk player can see that Hurl Trucks lives in
the transform deck (not the recruitable HQ), so when Hurl Legal Objections
transforms, it is visibly clear where the card came from. In a match with no
Transform heroes the pile does not render (the array is empty).

## Assumes

- **Baseline:** `origin/main` @ `10cdf3fd` (2026-09-07). Re-baseline at execution.
- **`G.transformDeck` is populated and correct.** WP-657 sets aside the
  second-forms into `G.transformDeck: CardExtId[]` (a face-up side deck) and
  WP-662 restored the registry fields that feed it, so the partition is live
  (live-verified: `red-skull-Midtown-Bank-Robbery` on `6095b87` — Hurl Trucks
  never recruitable, transform swap fires). This WP does **not** touch the
  partition, the swap, or any `G` mutation. ✅ on `main`.
- **Display data for the side-deck cards is present in `G.cardDisplayData`.**
  `buildMatchCardImageManifest` already emits the Like Totally Smart Hulk image
  (observed in a live `matchCardImageUrls`), so `resolveDisplay` resolves the
  second-forms to real faces, not `UNKNOWN_DISPLAY_PLACEHOLDER`. Confirm at
  execution with an assertion (the `carddisplaydata_unknown_pattern` guard).
- **The shared-board face-up-pile projection pattern exists and is the model.**
  `koPile` is a **required** top-level public `UIState` field (WP-128 /
  D-12804) of type `UIKoPileState` over `UIDisplayEntry` (`{ extId, display }`),
  built with `buildDisplayEntries` and passed through `filterUIStateForAudience`
  **unredacted** (public shared-board). `strikePile` / `twistPile` /
  `escapedPile` are the same `UIDisplayEntry[]` shape via `deepCopyDisplayEntries`.
  This WP mirrors them. ✅ on `main`.
- **The client single-pile leaf pattern exists.** `KOPile.vue` renders a public
  face-up pile from a projected zone; `CardTile.vue` renders one `UICardDisplay`
  face. This WP adds a sibling leaf. ✅ on `main`.

## Context (Read First)

- `packages/game-engine/src/types.ts` (`transformDeck: CardExtId[]` @ ~L1397) —
  **AUTHORITATIVE for** the side-deck shape (a flat, always-present face-up
  `CardExtId[]`).
- `packages/game-engine/src/ui/uiState.types.ts` (`UIDisplayEntry` @ L297;
  `koPile: UIKoPileState` @ L92) — **AUTHORITATIVE for** the shared face-up
  pile entry type + the top-level public-field precedent.
- `packages/game-engine/src/ui/uiState.build.ts` (`buildDisplayEntries` @ L189;
  `resolveDisplay` @ L159; `buildUIState` @ L528) — **AUTHORITATIVE for** the
  projection builder (per-entry shallow copy; no aliasing).
- `packages/game-engine/src/ui/uiState.filter.ts` (`deepCopyDisplayEntries`;
  the shared-board pass-through block @ L444+) — **AUTHORITATIVE for** the
  public unredacted pass-through (the Board-Visible Field Rule: a field that
  reaches `buildUIState` but not the filter is dropped at the whitelist — the
  EC-206 shipped failure mode; see `.claude/rules/architecture.md §UIState
  Projection Integrity` + the `uistate_filter_whitelist_drops_fields` memory).
- `apps/arena-client/src/components/play/KOPile.vue` — **AUTHORITATIVE for** the
  public face-up single-pile leaf pattern (props a projected zone; renders it;
  type-only engine import per D-16502).
- `apps/arena-client/src/components/play/CardTile.vue` — **AUTHORITATIVE for**
  rendering one `UICardDisplay` face.
- `apps/arena-client/src/pages/PlayDesktop.vue` + `PlayMobile.vue` — **AUTHORITATIVE
  for** where shared-board leaves are wired into the play surface.
- `docs/ai/DECISIONS.md` — the reserved **D-24475** below; scan **D-24468**
  (transform side deck), **D-24469** (transform targets), **D-12804/D-12806**
  (koPile / shared-board audience pass-through).

## Design Rationale

**Mirror `koPile` / `strikePile` end-to-end — a read-only public shared-board
pile.** The transform deck is conceptually identical to the other face-up
shared-board piles: a match-global list of face-up cards everyone may see. So
it takes the same machinery and NOTHING more — a `UIDisplayEntry[]` field,
`buildDisplayEntries` in the build, `deepCopyDisplayEntries` in the filter
(public, unredacted, all audiences), and a client leaf that renders the faces.
There is no new engine behaviour, no `G` mutation, no move, no determinism
surface, and **no hash re-pin** (`computeStateHash` hashes `G`, not `UIState`;
this WP adds no `G` field).

**Optional field, always populated (the EC-206 pattern).** The new `UIState`
field is `transformDeck?: UIDisplayEntry[]` — **optional on the type** (so the
existing hand-authored `UIState` test fixtures need no backfill, avoiding the
`arena_client_uistate_backfill_recurrence` blast radius) but **always populated
by `buildUIState`** from the always-present `G.transformDeck` (so every real
match carries it). The audience filter passes it through with the established
`...(x !== undefined ? { … } : {})` guard (the same shape `scheme.display` /
`gameText` use). Because optional fields are silently dropped by the filter
whitelist when the pass-through is forgotten (the shipped EC-206 failure), the
audience-filter survival test (Step 4 of the Board-Visible Field Rule) is
**mandatory**, not optional.

**Face-up render.** In physical Legendary the Transform cards sit face-up so
players can see what each base becomes; the client renders each entry as a
non-interactive `CardTile` (you cannot recruit them directly — they only arrive
via the swap). The pile hides entirely when the projected array is empty /
absent (non-`wwhk` games).

## Scope (In)

- **New `UIState` field** `transformDeck?: UIDisplayEntry[]` on `uiState.types.ts`
  (top-level, optional, documented as the public face-up Transform side deck).
- **Populate in `buildUIState`** — `transformDeck: buildDisplayEntries(gameState.transformDeck, gameState)`.
- **Pass through `filterUIStateForAudience`** — a top-level public,
  unredacted pass-through via `deepCopyDisplayEntries`, guarded
  `...(uiState.transformDeck !== undefined ? { transformDeck: … } : {})`.
- **Audience-filter survival test** — asserts the projected `transformDeck`
  survives the filter for every audience (owner, opponent, spectator) with its
  entries intact (public — never redacted).
- **`buildUIState` test** — a wwhk setup projects the second-forms with real
  display faces (name resolved, not `<unknown>`); a non-transform setup projects
  `[]`.
- **Play Diagnostics** — verify `transformDeck` appears in the
  `uiStateSnapshot` (Step 5 of the Board-Visible Field Rule).
- **New client leaf** `TransformDeck.vue` — renders each `UIDisplayEntry` as a
  face-up non-interactive `CardTile`, header "Transform Deck", hidden when the
  prop is absent / empty; type-only engine import (D-16502). Plus its component
  test (renders the faces; hides when empty).
- **Wire the leaf** into `PlayDesktop.vue` + `PlayMobile.vue`, passing
  `uiState.transformDeck`.
- **UIState drift/shape test** — if `uiState.types.drift.test.ts` (or a shape
  test) enumerates the field set, add `transformDeck` there in lockstep.

## Out of Scope

- **The partition / swap / any `G` mutation** (WP-657 / WP-658 / WP-662) — done;
  reused as-is.
- **Amadeus Cho's transform runtime** (Gamma-Draining Nanites → Like Totally
  Smart Hulk) — still unsupported by the WP-658 She-Hulk-only allowlist; a
  separate follow-on. This WP only makes the *deck* visible; it does not expand
  which transforms *fire*.
- **Any interactivity on the pile** — the transform deck is display-only; you
  cannot click/recruit from it (cards leave only via the engine swap).
- **A pile-browse modal** for the transform deck — the pile is small and shown
  face-up inline; no browse affordance needed (unlike KO/discard).
- **`G` changes, new moves, card data, keywords** — none.

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — the `transformDeck?` field.
- `packages/game-engine/src/ui/uiState.build.ts` — populate it.
- `packages/game-engine/src/ui/uiState.filter.ts` — pass it through (public).
- `packages/game-engine/src/ui/uiState.filter.test.ts` — the survival test.
- `packages/game-engine/src/ui/uiState.build.test.ts` — the projection test.
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — iff it enumerates fields.
- `apps/arena-client/src/components/play/TransformDeck.vue` (**new**) + `.test.ts`.
- `apps/arena-client/src/pages/PlayDesktop.vue` + `PlayMobile.vue` — wiring.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24475 Active),
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/ai/NUMBER-LEDGER.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

The exact allowlist (esp. the client wiring files + whether the drift/shape
test enumerates fields) is finalised at execution; any file outside it is a FAIL.

## Non-Negotiable Constraints

> - Full file contents; ESM only, Node v22+; human-style code per `00.6-code-style.md`.
> - **Read-only projection:** NO `G`/`ctx` mutation, NO new `G` field, NO move,
>   NO determinism surface, NO hash re-pin. If any of these becomes necessary,
>   STOP — the WP is mis-scoped.
> - **Board-Visible Field Rule (Invariant):** the new field is declared →
>   populated → **passed through the filter** → filter-tested → diagnostics-verified.
>   An optional field that reaches the build but not the filter is silently
>   dropped (the EC-206 shipped failure) — the survival test is mandatory.
> - Public shared-board data: the transform deck is face-up; it is NEVER
>   redacted for any audience (opponent / spectator see it too).
> - Client SFC authoring per the EC-132 whitelist; type-only engine import (D-16502).
> - No aliasing: per-entry shallow copy in the build (`buildDisplayEntries`) and
>   the filter (`deepCopyDisplayEntries`) — never `[...zone]` of the entries.
> - Session protocol: on any ambiguity not resolved by the WP + EC, STOP and surface it.

## Contract

- **UIState field** — `transformDeck?: UIDisplayEntry[]` (optional; always
  populated by `buildUIState`; `[]` for non-transform games; public / unredacted).
- **Build** — `buildDisplayEntries(gameState.transformDeck, gameState)`.
- **Filter** — public top-level pass-through via `deepCopyDisplayEntries`, guarded
  on `!== undefined`.
- **Client** — `TransformDeck.vue`, face-up non-interactive `CardTile` per entry,
  hidden when absent/empty; wired into `PlayDesktop.vue` + `PlayMobile.vue`.

## Vision Alignment

- **Vision clauses touched:** §2 (UI consumes read-only projections), §4 (client
  render fidelity).
- **Conflict assertion:** No conflict — a face-up shared-board zone made visible;
  read-only, buys no game outcome (NG-1 untouched), adds no RNG.
- **Non-Goal proximity check:** N/A — none of NG-1..7 crossed.
- **Determinism preservation:** No `G`/`ctx` touched, no hash surface; the
  projection is a pure function of existing state.

## Funding Surface Gate

§20 N/A — a read-only gameplay projection + client render; no funding affordance
or copy.

## API Catalog Update

§21 N/A per D-11804 — no HTTP endpoint or server-reachable library function
(a `UIState` field + a Vue leaf).

## Acceptance Criteria

- **AC-1** `buildUIState` on a `wwhk` (She-Hulk / Amadeus Cho) setup projects
  `transformDeck` as a non-empty `UIDisplayEntry[]` whose entries resolve to
  real card faces (e.g. `Hurl Trucks`, `Like Totally Smart Hulk`), not
  `<unknown>` placeholders.
- **AC-2** `buildUIState` on a non-transform setup projects `transformDeck` as `[]`.
- **AC-3** The projected `transformDeck` survives `filterUIStateForAudience`
  intact for **every** audience (owner, opponent, spectator) — public, never
  redacted.
- **AC-4** `transformDeck` appears in the Play Diagnostics `uiStateSnapshot`.
- **AC-5** `TransformDeck.vue` renders one face-up card per entry and hides
  entirely when the prop is absent or empty; its component test passes.
- **AC-6** The leaf is wired into both `PlayDesktop.vue` and `PlayMobile.vue`,
  fed `uiState.transformDeck`.
- **AC-7** No `G`/`ctx` mutation, no new `G` field, no move, no card-data change;
  both engine hash oracles are **untouched** (no re-pin) and whole-repo tests are green.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` + `pnpm -r build` exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0; record the pass count.
3. `pnpm --filter @legendary-arena/arena-client test` (or the client test script) exits 0.
4. `git grep -n "PRE_WP080_HASH\|finalStateHash" -- '*.test.ts' '*.json'` unchanged —
   confirm no hash oracle was touched (this WP adds no `G` field).
5. **Control run:** delete the filter pass-through line; confirm AC-3's survival
   test fails (proving the pass-through is load-bearing, the EC-206 guard).
6. Live-verify: on `play.legendary-arena.com` a She-Hulk match shows the
   Transform Deck pile with the second-forms face-up (recorded or operator-pending).
7. `git diff --name-only` = the finalised EC allowlist.

## Definition of Done

- [ ] AC-1..AC-7 satisfied.
- [ ] All Verification Steps green, incl. the Step-5 control run.
- [ ] No files outside the finalised EC allowlist were modified.
- [ ] `docs/ai/DECISIONS.md` — **D-24475 Active**, recording: the read-only
      `transformDeck` projection mirroring `koPile` / `strikePile`; optional-but-
      always-populated + the mandatory filter pass-through & survival test; public
      (unredacted) shared-board disposition; the face-up client leaf; and the
      explicit no-`G`-change / no-hash-re-pin scope.
- [ ] `docs/ai/STATUS.md` close-out.
- [ ] **D-24026 live-on-surface:** on `play.legendary-arena.com`, a real
      She-Hulk match renders the Transform Deck pile face-up; recorded or
      operator-pending.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap node `📝`→`✅` + counts regenerated.

## Reserved Decision (lands at execution)

**D-24475 — The Transform side deck (`G.transformDeck`, D-24468) is projected to
the client as a read-only, public, face-up `UIState.transformDeck?: UIDisplayEntry[]`
zone (the `koPile` / `strikePile` shared-board pattern), rendered by a
`TransformDeck.vue` leaf.** Records: the field is optional on the type (no fixture
backfill) but always populated by `buildUIState` from the always-present
`G.transformDeck`; it is passed through `filterUIStateForAudience` unredacted for
all audiences (face-up public data) with a mandatory survival test (an optional
field that skips the pass-through is silently dropped — the EC-206 failure mode);
the client renders each entry as a non-interactive face-up `CardTile`, hidden when
empty; and the WP makes NO `G`/`ctx` change, adds NO move or card data, and does
NOT touch either engine hash oracle (`computeStateHash` hashes `G`, not `UIState`).

## Lint Gate Self-Review (00.3)

Completed inline at draft against all 21 sections (recorded in the `SPEC:` draft
commit body). §1–§9 PASS (Context specific + authoritative; §4 no card-data /
schema change; §8 layer boundary respected — engine projects read-only state, the
client renders it, no upward import). §12–§17 PASS (control run mandated at
Step 5; §16 human-style per 00.6; §17 Vision block carries clause numbers +
conflict assertion + the determinism line; §15.1 declares `play.legendary-arena.com`
with the D-24026 live gate). §10 (no new move), §11 (no persistence), §18, §20,
§21 resolve N/A with named justifications. **Gate verdicts finalised at execution**
(pre-flight + copilot recorded in the draft commit body).
