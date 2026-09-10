# WP-695 — Interactive single-player core mastermind tactics (Red Skull / Magneto)

**Status:** Draft 2026-09-10 (EC-732; D-24512 reserved)
**Layer:** Game Engine + Arena Client (cross-layer — one pending-choice + UIState projection + renderer per tactic)
**Hard-deps:** WP-497 (tactic-onFight framework + `tacticHandlers.ts` / `dispatchTacticOnFight` + the `handSizeOverrides` next-hand pattern / D-24300) ✅
**User-Visible Surface:** play.legendary-arena.com (D-24026) — the scry + X-Men-pick prompts + effects fire in live matches.
**Baseline:** `origin/main` @ draft time — re-verify at execution (WP/EC drift discipline)

## Goal

Ship the two **single-player interactive** core mastermind tactics as per-tactic
resolvers in `rules/tacticHandlers.ts`, each with the full active-scoped
pending-choice stack (engine pending queue + five-step UIState projection +
arena-client renderer) it needs to not hard-freeze a human player:

| Tactic | Mastermind | Printed Fight text | Interaction shape |
|---|---|---|---|
| Ruthless Dictator | Red Skull (`core-mastermind-red-skull-ruthless-dictator`) | "Look at the top three cards of your deck. KO one, discard one and put one back on top of your deck." | sequential disposition (scry-3, assign each revealed card to KO / discard / top) |
| Electromagnetic Bubble | Magneto (`core-mastermind-magneto-electromagnetic-bubble`) | "Choose one of your [team:x-men] Heroes. When you draw a new hand of cards at the end of this turn, add that Hero to your hand as a seventh card." | single pick (in-play X-Men Hero) + a **deferred specific-card hand injection** at the next hand fill |

Both are the acting (defeating) player's own choice — active-scoped, never
another seat's — so they extend the existing single-player pending-choice
architecture rather than the multi-player auto-resolve stance used for
"each other player" tactics (WP-506).

## User-Visible Impact

On `play.legendary-arena.com`, defeating Red Skull's *Ruthless Dictator* opens a
scry-3 prompt (KO one / discard one / top one); defeating Magneto's
*Electromagnetic Bubble* opens a "choose an X-Men Hero" prompt and then, at the
start of the defeating player's next turn, that specific Hero arrives in hand as
a seventh card with a log line. Today both tactics are inert
(`dispatchTacticOnFight` falls through to the silent no-op). **D-24026 REQUIRED**
(user-visible surface) — live-verify post-deploy.

## Assumes

- **WP-497 / D-24300** (✅) — `dispatchTacticOnFight(G, ctx, defeatedTacticId,
  shuffleContext)` in `rules/tacticHandlers.ts`, called as the final step of
  `defeatMastermindTacticCore` (`moves/fightMastermind.ts:311`), firing on
  `ctx.currentPlayer`. This WP adds two more branches. **Hard dependency** —
  WP-497 must be landed on `main` before this executes.
- The **`handSizeOverrides?: Record<string, number>`** lazy-materialized
  next-hand pattern (WP-497 Octet, `resolveOctetOfValenceElectrons` in
  `tacticHandlers.ts`; consumed at the play-phase `onBegin` fill in
  `game.ts:799` / `:817`) is the precedent for the *deferred* half of
  Electromagnetic Bubble. This WP adds a **sibling** field for a per-card
  deferred injection (a specific ext_id added on top of the fill), not a count
  bump — the count-bump field cannot carry *which* card. **Execution baseline
  assertion:** confirm the field name, that it is per-player, and that it is
  consumed + cleared at `onBegin` exactly where `handSizeOverrides` is.
- The **single-player pending-choice** architecture — `PendingScryKoChoice`
  (WP-470 / D-24282, `moves/scryKoChoice.resolve.ts`) and `PendingMelterKoChoice`
  (WP-603 / D-24413, sequential per-revealed-card resolution) — is the shape both
  new pending choices copy: a snapshot of the revealed / eligible ext_ids parked
  at fire time, front-popped by a resolve move, block-all guarded so the board is
  frozen while pending. Active-player-scoped (`reference_interactive_choice_active_player_only`).
- The **five-step Board-Visible Field contract** (`.claude/rules/architecture.md`
  §UIState Projection Integrity): declare on `uiState.types.ts`, populate in
  `uiState.build.ts`, **pass through** `uiState.filter.ts` with the owner-redacted
  disposition, add an audience-filter test, verify in Play Diagnostics
  `uiStateSnapshot`. A field that reaches build but not the filter whitelist is
  silently dropped (`reference_uistate_filter_whitelist_drops_fields`).
- The **new-resolve-move sim lockstep** — a new `resolve*` move needs
  `SIMULATION_MOVE_NAMES` (`simulation/ai.legalMoves.ts`) + a `getLegalMoves`
  short-circuit + **both** sim `MOVE_MAP`s (`simulation.runner.ts` +
  `par.aggregator.ts`) or the simulator hangs
  (`reference_new_resolve_move_sim_dispatch_lockstep`), plus the
  move-registration drift test in `game.test.ts`
  (`feedback_move_registration_drift_test`).
- The `tacticHandlers.ts` comment (lines 75–81) records **why** Ruthless Dictator
  was deferred by WP-567: an interactive tactic parked without its UIState
  projection + prompt hard-freezes the human player. This WP is that deferred
  packet — it ships the projection + prompt + bot enumeration together.

## Context (Read First)

**Why these two, together, now.** WP-567 shipped Red Skull's three
non-interactive tactics and explicitly deferred *Ruthless Dictator* to "its own
packet … projection + prompt + bot enumeration mirror shipped together." WP-506
shipped Magneto's *Crushing Shockwave* and named *Electromagnetic Bubble* as a
follow-on "needs a pending-choice + deferred hand injection." Both remaining
tactics are the **single-player interactive** class — the same pending-choice +
UIState + renderer harness, differing only in the choice payload — so they are
drafted as one WP to enroll that harness once rather than twice.

**Split consideration (Step 4 rule of thumb).** This WP crosses a layer and its
allowlist exceeds ~10 files, which normally argues for a split. It is kept single
because the two tactics share the entire pending-choice plumbing (queue field →
block-all guard enrollment → five-step projection → renderer cascade → sim
dispatch); a split would duplicate that enrollment across two sessions and two
Ds for one mechanic family. One decision (D-24512) covers both. If execution
finds the surface unmanageable, the fallback is to land Ruthless Dictator first
and hand Electromagnetic Bubble to a paired WP sharing this `## Assumes` chain.

**Ruthless Dictator is a sequential disposition, not a single KO.** Unlike
`PendingScryKoChoice` (pick one of two to KO, the other stays), Ruthless Dictator
assigns **each** of the top three a distinct disposition — one KO, one discard,
one back on top. Model it on `PendingMelterKoChoice`'s sequential resolution: park
one entry carrying the `revealedCardIds` snapshot (top `min(3, deck.length)`), and
resolve it across successive calls, one revealed card per call, front-popping only
when every revealed card has been dispositioned. The **discard** here is a
deck-top card to the discard pile via the deck→discard zone helper — **not**
`discardFromHand` (that is the hand chokepoint; it does not apply to a deck-top
card). KO via `koCard`; "top" leaves the card on the deck top in its revealed
relative order.

**Fewer than three cards.** With `deck.length < 3`, dispose only what is available
(baseline assertion on empty-deck / reshuffle behavior — Ruthless Dictator "looks
at" the top, so there is **no** forced reshuffle and **no** `ctx.random.*`; a card
with no remaining disposition slot stays on top). The exact <3 disposition
ordering is a locked design point — see Contract + D-24512.

**Electromagnetic Bubble is a pick plus a deferred injection.** The active choice
selects one **in-play** `[team:x-men]` Hero (scan the defeating player's in-play
zone, `G.cardTraits[extId]?.team === 'x-men'`, the WP-506 team-only precedent —
no `heroClass` guard, keep the map-level `?.`). The chosen ext_id is recorded in
the new deferred-injection field; at the defeating player's **next** `onBegin`
fill, after the normal fill, that specific card is pulled from where it then sits
(its owner's discard after end-of-turn cleanup — baseline assertion) into hand as
the seventh card, and the field key is deleted. **0 X-Men in play → no-op** (no
pending entry parked). **Exactly 1 → auto-select inline** (no pending choice, no
freeze — the undercover 1→auto precedent); **≥2 → park** the pick.

**Determinism (the re-pin question).** Both new pending-queue fields and the
deferred-injection field are added to `G` (hashed by `computeStateHash`, which
serializes all of `G` except `diagnostics`) but are **lazily materialized** —
absent/undefined by default, never seeded in `Game.setup`, so an untouched game's
canonical JSON is unchanged (the `handSizeOverrides` precedent: an absent optional
field is not serialized). They are written **only** when a
`core-mastermind-red-skull-ruthless-dictator` or
`core-mastermind-magneto-electromagnetic-bubble` tactic is defeated, and **no
committed replay/sentinel fixture does so** (the sentinel is `core/dr-doom`;
`PRE_WP080_HASH` replays an empty state). So both oracles are expected
**byte-identical → no re-pin**. Verify both at execution; **STOP on any drift,
never blind-re-pin** (`reference_hashed_g_field_dual_repin`).

## Design Rationale (load-bearing decisions)

1. **Two new pending-choice types, not one shared.** The payloads differ (a 3-card
   sequential disposition vs a single pick from a variable eligible set), so a
   shared type would be a discriminated union carrying dead fields for each case.
   Per "duplicate first, abstract only when a third copy appears," each tactic gets
   its own `Pending…Choice` queue, resolve move, UIState projection, and renderer,
   modeled on the closest existing sibling (Melter for Ruthless Dictator, a single
   pick for Electromagnetic Bubble).

2. **The deferred injection is a new field, not `handSizeOverrides`.**
   `handSizeOverrides[player] = N` bumps the fill *count*; it cannot say *which*
   card. Electromagnetic Bubble injects a **specific** ext_id, so it needs a
   `Record<string, CardExtId[]>`-shaped sibling consumed at the same `onBegin`
   site. Kept additive and lazily materialized so it re-pins nothing.

3. **Active-scoped, single-player.** Both effects act on the defeating player only,
   so they use the single-player pending-choice architecture (block-all guard,
   front-pop) and are enrolled exactly like `hasPendingScryKoChoice` across the
   block-all guard set — never a multi-seat park.

## Scope (In)

- `packages/game-engine/src/rules/tacticHandlers.ts`:
  - `resolveRuthlessDictator(G, currentPlayer)` — snapshot the top
    `min(3, deck.length)` of the defeating player's deck and **park** a
    `PendingRuthlessDictatorChoice`; log the park (the resolved dispositions are
    logged by the resolve move).
  - `resolveElectromagneticBubble(G, currentPlayer)` — scan in-play X-Men Heroes:
    0 → logged no-op; 1 → record the deferred injection inline; ≥2 → park a
    `PendingElectromagneticBubbleChoice` carrying the eligible ext_ids.
  - Two tactic-id constants + two `dispatchTacticOnFight` branches.
- `packages/game-engine/src/types.ts` — `PendingRuthlessDictatorChoice` +
  `G.pendingRuthlessDictatorChoices?`, `PendingElectromagneticBubbleChoice` +
  `G.pendingElectromagneticBubbleChoices?`, and the deferred-injection field
  (sibling to `handSizeOverrides`; propose `G.deferredHandInjections?:
  Record<string, CardExtId[]>` — final name a baseline assertion).
- `packages/game-engine/src/moves/ruthlessDictatorChoice.resolve.ts` +
  `moves/electromagneticBubbleChoice.resolve.ts` — new resolve moves + their
  `hasPending…` predicates; sequential disposition (Ruthless) / single pick
  (Bubble); silent no-ops; front-pop on completion.
- `packages/game-engine/src/game.ts` — register the two moves; consume + clear the
  deferred-injection field at the `onBegin` fill (alongside `handSizeOverrides`);
  enroll both `hasPending…` predicates in the play-phase turn-end / stage guards.
- **Block-all guard enrollment** — add both `hasPending…` predicates everywhere
  `hasPendingScryKoChoice` is consumed: `moves/coreMoves.impl.ts`,
  `moves/discardChoice.resolve.ts`, `moves/dodgeCard.ts`,
  `moves/fightMastermind.ts`, `moves/fightVillain.ts`, `moves/healWounds.ts`,
  `moves/melterKoChoice.resolve.ts`, `moves/recruitHero.ts`,
  `moves/recruitOfficer.ts`, `moves/scryKoChoice.resolve.ts`,
  `villainDeck/villainDeck.reveal.ts`, `simulation/ai.legalMoves.ts`, `game.ts`
  (**verify the exact set at execution** against a `git grep hasPendingScryKoChoice`
  — the set drifts; `reference_pending_choice_wp_full_file_set`).
- **UIState (five-step ×2)** — `ui/uiState.types.ts` (two `UIPending…Choice`
  types + optional fields), `ui/uiState.build.ts` (project each FRONT entry),
  `ui/uiState.filter.ts` (owner-redacted pass-through), `ui/uiState.build.test.ts`
  + `ui/uiState.filter.test.ts` (audience-survival assertions),
  `ui/uiState.types.drift.test.ts` if the drift pin enumerates optional fields.
- **Sim lockstep** — `simulation/ai.legalMoves.ts` (`SIMULATION_MOVE_NAMES` + a
  `getLegalMoves` short-circuit returning the default disposition/pick), both
  `simulation.runner.ts` + `par.aggregator.ts` `MOVE_MAP`s,
  `simulation/simulation.moveDispatch.drift.test.ts`.
- **Arena client** — `components/play/PendingRuthlessDictatorChoicePrompt.vue` +
  `PendingElectromagneticBubbleChoicePrompt.vue`,
  `components/play/uiMoveName.types.ts` (two move names in the union),
  `composables/useTurnActions.ts` (two `hasPending…` params, appended LAST),
  `components/play/TurnActionBar.vue`, `pages/PlayDesktop.vue` +
  `pages/PlayMobile.vue` (mount the prompts).
- `scripts/coverage/tactic-provenance.json` — rows marking both tactics
  `executable`; regenerate the effect-implementation index.
- Tests: each resolver (park / inline / no-op paths), each resolve move
  (valid disposition, sequential front-pop, <3 edge, invalid/stale no-op), the
  deferred injection materializing at the right player's `onBegin` (incl. the
  card-not-locatable edge), UIState build + filter survival, sim dispatch drift,
  the client prompt renderers.

## Out of Scope

- Any other mastermind's tactics; the extra-turn tactic mechanic.
- The multi-player auto-resolve tactics (WP-506 stance) — these two are
  single-player interactive by nature.
- A data-driven tactic marker vocabulary (still per-tactic resolvers per the
  operator ruling in `tacticHandlers.ts`).
- Card-data changes — both tactic ability texts are already correct.
- Converting the `dispatchTacticOnFight` unhandled fallthrough into a throw
  (other masterminds' tactics stay deliberately inert).

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/rules/tacticHandlers.ts` | 2 resolvers + 2 consts + 2 dispatch branches |
| `packages/game-engine/src/types.ts` | 2 pending-choice types + queues + deferred-injection field |
| `packages/game-engine/src/moves/ruthlessDictatorChoice.resolve.ts` | new resolve move + predicate |
| `packages/game-engine/src/moves/electromagneticBubbleChoice.resolve.ts` | new resolve move + predicate |
| `packages/game-engine/src/game.ts` | move registration + `onBegin` injection consume + guard enrollment |
| `packages/game-engine/src/moves/*.ts`, `villainDeck/villainDeck.reveal.ts` | block-all guard enrollment (verify set vs HEAD) |
| `packages/game-engine/src/ui/uiState.types.ts` / `.build.ts` / `.filter.ts` | five-step projection ×2 |
| `packages/game-engine/src/simulation/ai.legalMoves.ts` / `simulation.runner.ts` / `par.aggregator.ts` | sim move lockstep ×2 |
| `packages/game-engine/src/game.test.ts` | move-registration drift (2 new moves) |
| `apps/arena-client/src/components/play/Pending{RuthlessDictator,ElectromagneticBubble}ChoicePrompt.vue` | 2 renderers |
| `apps/arena-client/src/components/play/uiMoveName.types.ts` / `TurnActionBar.vue`, `composables/useTurnActions.ts`, `pages/Play{Desktop,Mobile}.vue` | renderer cascade |
| `scripts/coverage/tactic-provenance.json` | 2 `executable` rows |
| `*.test.ts` (engine + client) | resolver / move / injection / UIState / sim / renderer coverage |

Governance (not in the code allowlist): `WORK_INDEX.md`, `EC_INDEX.md`,
`05-ROADMAP-MINDMAP.md`, `DECISIONS.md` (D-24512 → Active), `NUMBER-LEDGER.md`
(reserved), `STATUS.md`.

## Non-Negotiable Constraints

- Moves never throw; `dispatchTacticOnFight` stays a silent no-op for unhandled
  ids. Both resolve moves are silent no-ops on any invalid/stale state, leaving
  the queue byte-identical so the player can resubmit.
- **Active-scoped only** — both pending choices are parked for `ctx.currentPlayer`
  (the defeating player); no other seat is ever parked.
- **No UIState-less park** — every parked choice ships its five-step projection +
  renderer in the same WP (the WP-567 deferral reason).
- Ruthless Dictator: KO via `koCard`, discard the deck-top card via the
  deck→discard zone helper (**not** `discardFromHand`), "top" leaves the card on
  the deck top; no `ctx.random.*` (no reshuffle on `look-at`).
- Electromagnetic Bubble: team-only match `G.cardTraits?.[extId]?.team === 'x-men'`
  (map-level `?.`, no `heroClass` guard); deferred injection is a specific ext_id
  added at `onBegin`, then the key is cleared.
- New `G` fields are lazily materialized; re-pin only if an oracle actually
  drifts, after confirming the delta — not expected here (no fixture defeats these
  tactics).
- No `boardgame.io` import in `tacticHandlers.ts` (`ctx` narrowed via `unknown`);
  no `.reduce()`; all zone mutation via `zoneOps`/zone helpers.
- Client `gameText`/marker rendering (if any) routes through `AbilityText.vue`;
  raw marker syntax is never shown.
- Standing engine + client rules apply (`.claude/rules/code-style.md`,
  `00.6-code-style.md`): full English names, per-function JSDoc, `// why:` on
  non-obvious constants and any `ctx.random.*` (none here), ESM `node:` imports,
  `.test.ts` on `node:test`, Node v22+. Executor works from full file contents.

## Contract

- `dispatchTacticOnFight(G, ctx, 'core-mastermind-red-skull-ruthless-dictator',
  shuffleContext)` → parks a `PendingRuthlessDictatorChoice` for `currentPlayer`
  snapshotting the top `min(3, deck.length)` deck ext_ids.
  `resolveRuthlessDictatorChoice({ cardId, disposition })` assigns one revealed
  card per call to `'ko' | 'discard' | 'top'`; with 3 cards exactly one of each;
  front-pops when all are dispositioned. **Locked <3 rule (D-24512):** apply
  dispositions in printed priority — KO first, then discard, then top — to as many
  cards as exist; a card with no remaining slot stays on top; never reshuffle.
- `dispatchTacticOnFight(G, ctx, 'core-mastermind-magneto-electromagnetic-bubble',
  …)` → 0 in-play X-Men Heroes: logged no-op; 1: record the deferred injection
  inline; ≥2: park a `PendingElectromagneticBubbleChoice` snapshotting the eligible
  in-play X-Men ext_ids. `resolveElectromagneticBubbleChoice({ cardId })` validates
  the pick against the snapshot, records the deferred injection, front-pops. At the
  player's next `onBegin` fill, that ext_id is added as an extra (seventh) card and
  the injection key is cleared; if the card is not locatable, a logged no-op.
- Both resolved effects **LOG** (a mutate-without-log resolver is a FAIL, per the
  WP-567 stance). Dispatch stays per-ext_id with a silent fallthrough.

## Vision Alignment

- §1 Rules Authenticity — each tactic resolves exactly as printed, with a real
  player choice rather than an oracle shortcut where the printed text gives one.
- §3 Player Trust & Fairness — deterministic, replay-faithful; the pending choice
  freezes the board so no state drifts under the decision.
- NG-1..7 not crossed (no pay-to-win, no PvP, no identity surface). Determinism
  §8/§22 preserved — no `ctx.random.*`, no I/O; lazily-materialized fields re-pin
  nothing (no fixture defeats these tactics).

## Funding Surface Gate

N/A — no pricing, checkout, or account surface.

## API Catalog Update

N/A — no `apps/server` HTTP endpoint or `Library-only` export change.

## Acceptance Criteria

1. Defeating *Ruthless Dictator* parks a scry-3 pending choice for the defeating
   player; resolving it KOs one, discards one (deck→discard), and leaves one on
   top, in the player's chosen assignment; with <3 cards it disposes only what
   exists per the locked priority and never reshuffles.
2. Defeating *Electromagnetic Bubble* with ≥2 in-play X-Men Heroes parks a pick;
   with exactly 1 it auto-selects inline; with 0 it is a logged no-op.
3. The chosen X-Men Hero is added to the defeating player's hand as an extra
   (seventh) card at their next `onBegin` fill, then the injection is cleared; a
   card not locatable at fill time is a logged no-op.
4. Both pending choices project through `buildUIState` **and survive**
   `filterUIStateForAudience` for the owning player only (audience-filter tests),
   and appear in the Play Diagnostics `uiStateSnapshot`.
5. Both resolve moves are registered (game.test.ts drift), enumerated in
   `SIMULATION_MOVE_NAMES`, dispatched in **both** sim `MOVE_MAP`s, and returned by
   `getLegalMoves` while pending; a sim run over a match that defeats these tactics
   does not hang.
6. Both `hasPending…` predicates are enrolled in the full block-all guard set;
   turn-end is blocked while either choice is pending.
7. Every resolved effect emits a play-by-play log line.
8. Determinism: full engine suite green; sentinel `finalStateHash` +
   `PRE_WP080_HASH` **byte-identical** (no committed fixture defeats these) — any
   drift STOPs execution.
9. `pnpm -r build` 0; engine + arena-client suites green; `effect-index:check` +
   tactic-provenance regenerated + green.
10. **D-24026** — live match: defeating each tactic drives its prompt and its
    outcome (KO/discard/top; the seventh-card injection next turn).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` — resolvers, resolve moves,
   deferred injection, UIState build + filter, sim dispatch drift; note the pass
   delta.
3. Control check: stub each resolver to a no-op → the new park/injection
   assertions FAIL (non-vacuous), restore.
4. `pnpm --filter @legendary-arena/arena-client test` — both prompt renderers green.
5. Confirm sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical (sweep +
   full run); `pnpm sim:runtime-observed:check` current after regen.
6. `pnpm -r build` → 0; `pnpm effect-index:check` current; tactic-provenance rows
   present.
7. `git diff --name-only` = the allowlist + governance only.
8. Post-deploy: AC-10 (D-24026), or record operator-pending.

## Definition of Done

- [ ] All Acceptance Criteria met; engine + client suites green (pass delta recorded).
- [ ] Sentinel + PRE_WP080 hashes byte-identical (or a diagnosed, documented,
      deliberate re-pin — not expected).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `effect-index:check` + tactic-provenance + `sim:runtime-observed:check` current.
- [ ] D-24512 flipped Active; WORK_INDEX row → `[x]`; EC_INDEX → `Done`; mindmap
      node flipped; `roadmap:counts:check` 0; `STATUS.md` close-out entry.
- [ ] Two-commit topology (EC-732 impl + SPEC close).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decision (lands at execution)

**D-24512** — Two single-player interactive core mastermind tactics as per-tactic
resolvers: *Ruthless Dictator* (Red Skull) = a scry-3 sequential-disposition
pending choice (KO one / discard one / top one; with <3 cards, dispositions apply
in printed priority KO→discard→top with no reshuffle) with its five-step UIState
projection + arena-client renderer; *Electromagnetic Bubble* (Magneto) = a
single-pick pending choice over in-play `[team:x-men]` Heroes (0 → no-op, 1 →
auto-select inline, ≥2 → park) plus a **deferred specific-card hand injection** —
a new lazily-materialized field sibling to `handSizeOverrides`, consumed once at
the defeating player's next `onBegin` fill to add the chosen Hero as a seventh
card. Both active-scoped; no re-pin expected (no committed fixture defeats these
tactics). See DECISIONS.md.

## Lint Gate Self-Review (00.3, 21 sections)

- **§1 Structure** — PASS (all required WP sections present, in order).
- **§2 Non-Negotiable Constraints** — PASS (explicit block; standing engine + client rules cited).
- **§3 Assumes** — PASS (WP-497 hard dep + each pattern cites its locking WP/D).
- **§4 Context** — PASS (why-now, split consideration, sequential vs single-KO, deferred injection, re-pin).
- **§5 Files Expected to Change** — PASS (allowlist + governance; guard/UIState/sim/renderer cascade enumerated, set-drift flagged for HEAD verification).
- **§6 Naming Consistency** — PASS (canonical `cardTraits.team`, `handSizeOverrides`, tactic ext_id grammar, `koCard`, deck→discard helper).
- **§7 Dependency Discipline** — PASS (WP-497 landed; baseline re-verify at execution).
- **§8 Architectural Boundaries** — PASS (engine + client, respected; no `boardgame.io` in `tacticHandlers.ts`; five-step projection contract honored; `.reduce()` forbidden).
- **§9 Windows Compatibility** — N/A.
- **§10 Env Var Hygiene** — N/A.
- **§11 Authentication Clarity** — N/A.
- **§12 Test Quality** — PASS (`node:test`, `.test.ts`; non-vacuous control-stub; UIState survival + sim-hang guard).
- **§13 Commands & Verification** — PASS (runnable Verification Steps).
- **§14 Acceptance Criteria Quality** — PASS (10 testable ACs).
- **§15 Definition of Done** — PASS (binary gates incl. hash byte-identity + two-commit topology).
- **§16 Code Style** — PASS (human-style, JSDoc, `// why:` on non-obvious consts).
- **§17 Vision Alignment** — PASS (§1/§3; NG-1..7 not crossed; determinism line present).
- **§18 Prose-vs-Grep Discipline** — PASS (no verification-grep token reused in prose).
- **§19 Bridge-vs-HEAD Staleness** — PASS (baseline re-verify at execution; guard/UIState/sim site sets flagged for HEAD confirmation, not hardcoded).
- **§20 Funding Surface Gate** — N/A (stated).
- **§21 API Catalog Update** — N/A (no HTTP/library surface; stated).

Pre-flight verdict at draft: **draft** — the deferred-injection field name, the
`onBegin` injection-source zone, the <3-card disposition ordering, and the exact
block-all guard / UIState / sim site sets are flagged as execution baseline
assertions to confirm against HEAD before coding.
