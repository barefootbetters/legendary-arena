# WP-693 — Loki tactics: free City-Villain defeat + KO-from-discard (Game Engine + Arena Client)

**Status:** Draft 2026-09-10 (EC-730; D-24510 reserved)
**Layer:** Game Engine + Arena Client (cross-layer: engine resolvers park active-scoped
pending choices; the client renders each prompt)
**Hard-deps:** WP-497 (tactic-onFight framework + `tacticHandlers.ts` /
`dispatchTacticOnFight` / D-24300) ✅
**User-Visible Surface:** play.legendary-arena.com (D-24026) — the choice prompts + effects fire in live matches.
**Reused-pattern deps (must be on `main`):** WP-486 / D-24291 (the
`defeat-with-bystander` / `PendingDefeatChoice` / `resolveDefeatChoice` /
`dispatchDefeatWithBystanderTarget` / `defeatCityVillainCore` free-defeat family) ✅;
WP-682 / D-24499 (the `pure-fury` second discriminant on that same family — the
add-a-discriminant precedent) ✅; WP-676 / D-24492 (pending-choice conventions:
FIFO queue, block-all guard, front-pop, `client:false`) ✅

## Goal

Two core **Loki** mastermind tactics currently fire **none** of their printed
**Fight:** ability — like every tactic other than the handful already resolved,
`dispatchTacticOnFight` falls through to the silent no-op for their ext_ids. This WP
adds both as per-tactic resolvers in `rules/tacticHandlers.ts`, each parking an
**active-player** pending choice the client renders:

| Tactic | Mastermind | Printed Fight text | Resolver behavior |
|---|---|---|---|
| Cruel Ruler | Loki | Defeat a Villain in the City for free | active player picks a City Villain and defeats it with **no attack spent**; normal defeat rewards apply |
| Maniacal Tyrant | Loki | KO up to four cards from your discard pile | active player optionally multi-selects **0..4** cards from their **own** discard to KO (global `G.ko`) |

After it lands, defeating Cruel Ruler lets the active player defeat a chosen City
Villain for free (rewards included), and defeating Maniacal Tyrant lets them thin up
to four cards out of their discard pile.

## User-Visible Impact

On `play.legendary-arena.com`, defeating Loki's **Cruel Ruler** tactic prompts the
active player to pick a City Villain, which is then defeated for free (its Bystanders
rescued, its on-defeat abilities fired) — no attack spent. Defeating **Maniacal
Tyrant** prompts the active player to select up to four of their own discard-pile
cards to KO. Both are inert today (no committed Loki-tactic match exists to confirm
live; the arc's known-inert baseline is [[project_mastermind_tactic_fight_arc]]).

## Assumes

- **WP-497 / D-24300** (Mastermind Tactic onFight Execution Framework, ✅) —
  `dispatchTacticOnFight(G, ctx, defeatedTacticId, shuffleContext)` in
  `rules/tacticHandlers.ts`, fired as the final step of `defeatMastermindTacticCore`
  (`moves/fightMastermind.ts`) on `ctx.currentPlayer`. This WP adds two branches to
  that dispatcher. The dispatcher already receives a `ShuffleProvider` (HYDRA
  Conspiracy uses it), so Cruel Ruler's reused defeat core has its scry-reshuffle
  source with no signature change.
- **WP-486 / D-24291** (✅) — `PendingDefeatChoice` (`G.pendingDefeatChoices[]`, FIFO),
  `resolveDefeatChoice` (front-only, front-pop before dispatch), the shared
  `dispatchDefeatWithBystanderTarget` → `defeatCityVillainCore` free-defeat path
  (spends no attack, sets no acted-this-turn flag, awards Bystanders + captured
  Heroes, fires `onFight`). Cruel Ruler reuses this whole path; only its **eligible
  target set** differs (any City Villain, not only Bystander-holders).
- **WP-682 / D-24499** (✅) — `resolveDefeatChoice` already accepts **two**
  `choiceType` discriminants (`'defeat-with-bystander'`, `'pure-fury'`) that share the
  `DefeatWithBystanderTarget[]` snapshot shape and one dispatcher. Adding Cruel Ruler
  is the **same additive move** — a third discriminant, no new resolve move.
- Tactic ext_id grammar `${setAbbr}-mastermind-${slug}-${tacticSlug}` (built at
  `mastermind.setup.ts`); core Loki's tactics resolve to
  **`core-mastermind-loki-cruel-ruler`** and
  **`core-mastermind-loki-maniacal-tyrant`** (card slugs in `data/cards/core.json`) —
  **execution baseline assertion:** confirm both slugs against the built ids before
  keying the constants.
- Global KO zone is `G.ko`; `koCard(G.ko, cardId)` (`board/ko.logic.ts`) is the
  **destination-only** append (the caller removes the card from its source first). A
  player's discard is `G.playerZones[pid].discard`. KO-from-discard is a plain
  removal — it fires **no** return-on-discard reaction (that chokepoint,
  `discardFromHand`, is hand→discard only; Maniacal Tyrant is discard→KO).
- **Multi-select precedent (execution baseline assertion).** Array-payload pending
  resolves exist (`resolvePutCardsOnDeckChoice`, `resolveReorderChoice` take
  `cardIds: CardExtId[]`), but both enforce an **exact** count
  (`args.cardIds.length !== front.count → return`). Maniacal Tyrant is a **bounded,
  optional 0..N** select (0 is legal — "up to four"). **No existing pending pattern is
  a 0..N-cap optional multi-select**, so this WP adds one, mirroring the array-payload
  + FIFO + block-all + front-pop conventions of the exact-count siblings. Confirm this
  against HEAD before building; if a 0..N-cap pattern has since landed, reuse it.

## Context

Per [[project_mastermind_tactic_fight_arc]] the tactic arc (WP-497+) replaces the
inert `defeatMastermindTacticCore` no-op with per-tactic resolvers; WP-506 / WP-567 /
WP-691 shipped the deterministic no-choice slices. This WP takes the two Loki tactics
that need an **active-player choice**. Cruel Ruler is the light half — it reuses a
shipped free-defeat family end to end. Maniacal Tyrant is the heavier half — a new
bounded-optional multi-select pending choice with its own resolve move, UIState
projection, block-all guard, sim dispatch, and client renderer. They ship together
because both are Loki (one mastermind per match) and both are active-scoped
pending-choice tactics that reuse the same client prompt scaffolding.

## Design Rationale

### 1. Cruel Ruler reuses the free-defeat family; only the target predicate is new

The printed text is "Defeat a Villain in the City for free" — villain-only, no
Bystander requirement, no Mastermind option, player-chosen. That is exactly the
`resolveDefeatChoice` path minus the Bystander gate, so:

- **New eligible-target builder** `buildCityVillainDefeatTargets(G)` — every occupied
  City space holding a villain/henchman, in **ascending City index** (the same
  deterministic order the projection + bot/sim default read), each a
  `DefeatWithBystanderTarget` of `kind: 'villain'`. No Mastermind entry.
- **No Guard gate.** A free-defeat effect bypasses the Guard access restriction — the
  shipped `buildDefeatWithBystanderTargets` does not check `isGuardBlocking`, and the
  free-defeat cores spend no attack. **Baseline assertion:** confirm the shipped free
  defeat ignores Guard, and match it (do not add a Guard filter). Faithful to "Defeat
  a Villain in the City for free" — no restriction.
- **Cardinality:** 0 City Villains → silent no-op; 1 → auto-defeat directly via
  `dispatchDefeatWithBystanderTarget` (no prompt, mirroring the exactly-1 auto path);
  ≥2 → park a `PendingDefeatChoice` for `ctx.currentPlayer`.
- **New discriminant** `'cruel-ruler'` on `PendingDefeatChoice.choiceType`, accepted by
  `resolveDefeatChoice`'s front-entry guard (the WP-682 add-a-discriminant move). No
  new resolve move, no new dispatcher — the target shape and defeat dispatch are
  identical.

### 2. Maniacal Tyrant is a new bounded-optional multi-select pending choice

"KO up to four cards from your discard pile" is an active-player, optional (0..4),
multi-select from the player's **own** discard into the global `G.ko`. It needs the
full new-pending-choice file set (there is no 0..N-cap optional multi-select to
reuse):

- **New `G` field** `G.pendingKoDiscardChoices?: PendingKoDiscardChoice[]` (FIFO,
  optional, undefined by default) with `choiceType: 'ko-from-discard'`, `playerID`, and
  the cap `maxCount` (= `MANIACAL_TYRANT_KO_MAX = 4`, clamped by discard size at
  resolve).
- **New resolve move** `resolveKoDiscardChoice({ cardIds })` — `cardIds` is a 0..cap
  array, each a distinct id present in the chooser's discard now (recomputed fresh, no
  snapshot); an empty array is the legal "KO nothing" choice. Remove each from discard,
  `G.ko = koCard(G.ko, id)`, then front-pop. Invalid payloads (over cap, duplicate,
  absent id, wrong player, empty queue) are silent no-ops with the queue intact.
  Registered `client: false` (the engine owns the outcome).
- **Resolver** `resolveManiacalTyrant(G, currentPlayer)` — discard empty → silent
  no-op; otherwise park one `PendingKoDiscardChoice` for `currentPlayer`.

### 3. Cross-layer: the pending choices must project + render (UIState five-step)

A parked pending choice with no UIState projection + prompt HARD-FREEZES the human
player (the WP-567 "Ruthless Dictator" hazard). Per ARCHITECTURE.md §UIState
Projection Integrity, each client-visible field is the five-step contract (declare,
build, pass-through the audience filter, audience-filter test, Play Diagnostics
snapshot). Cruel Ruler rides the **existing** `pendingDefeatChoice` projection (already
five-step-complete for `defeat-with-bystander` / `pure-fury`) — only its
`choiceType` union and the prompt heading gain the `'cruel-ruler'` case. Maniacal
Tyrant needs a **new** `pendingKoDiscardChoice` UIState field carried through all five
steps and a new client renderer.

## Scope (In)

**Game Engine**
- `rules/tacticHandlers.ts`: `resolveCruelRuler`, `resolveManiacalTyrant`, their tactic
  ext_id constants (`LOKI_CRUEL_RULER_TACTIC_ID`, `LOKI_MANIACAL_TYRANT_TACTIC_ID`),
  `MANIACAL_TYRANT_KO_MAX = 4`, and two `dispatchTacticOnFight` branches.
- `moves/defeatChoice.resolve.ts`: `buildCityVillainDefeatTargets(G)` (all City
  Villains, ascending index) + accept `'cruel-ruler'` in the front-entry `choiceType`
  guard of `resolveDefeatChoice`.
- `types.ts`: add `'cruel-ruler'` to `PendingDefeatChoice.choiceType`; add
  `PendingKoDiscardChoice` + `G.pendingKoDiscardChoices?`.
- `moves/koDiscardChoice.resolve.ts` (new): `resolveKoDiscardChoice`,
  `getEligibleKoDiscardCards(G, playerID)` (the round-trip predicate the projection +
  move share), `hasPendingKoDiscardChoice(G)`.
- Block-all guard `hasPendingKoDiscardChoice(G)` added at **every** action-move guard
  site (fight/recruit/play/heal/end-turn — the same set the other pending guards
  occupy in `moves/*.ts`; enumerated in the EC).
- `game.ts`: register `resolveKoDiscardChoice` (`client:false`); enumerate the new
  pending choice in `getLegalMoves` (bot/sim) + its short-circuit.
- `game.test.ts`: move-registration drift assertion for the new move.
- Simulation dispatch: `SIMULATION_MOVE_NAMES` + **both** sim `MOVE_MAP`s (runner +
  aggregator) gain `resolveKoDiscardChoice`, or the sim hangs
  ([[reference_new_resolve_move_sim_dispatch_lockstep]]).
- UIState five-step for `pendingKoDiscardChoice` (`ui/uiState.types.ts`,
  `ui/uiState.build.ts`, `ui/uiState.filter.ts` owner-scoped pass-through, an
  audience-filter test, the Play Diagnostics `uiStateSnapshot`) + the `'cruel-ruler'`
  case in the `pendingDefeatChoice` `choiceType` union.

**Arena Client**
- `components/play/PendingDefeatChoicePrompt.vue`: a `'cruel-ruler'` `heading()` branch.
- New `components/play/PendingKoDiscardChoicePrompt.vue` (multi-select up to 4 from the
  player's discard; submit `resolveKoDiscardChoice({ cardIds })`, submit-empty = KO
  nothing) + its test.
- `composables/useTurnActions.ts` → `components/play/TurnActionBar.vue` →
  `pages/PlayDesktop.vue` / `pages/PlayMobile.vue`: wire the new prompt into the
  pending-choice cascade (mirror the `pendingDefeatChoice` wiring).

**Coverage / provenance**
- `scripts/coverage/tactic-provenance.json`: rows marking both Loki tactics
  `executable`; regenerate the effect-implementation index.

**Tests**
- Cruel Ruler: 0/1/≥2 City Villains → no-op / auto-defeat / park; the chosen defeat
  spends no attack, rescues Bystanders, fires `onFight`; `resolveDefeatChoice` accepts
  `'cruel-ruler'` and rejects a target not in the snapshot; unknown tactic id no-op.
- Maniacal Tyrant: park on non-empty discard, no-op on empty; KO 0 / KO 3 / KO 4 / KO
  over-cap-rejected / duplicate-rejected / absent-id-rejected; KO'd cards leave discard
  and land in `G.ko`; wrong-player + empty-queue no-ops.
- UIState audience-filter test: `pendingKoDiscardChoice` survives for the owner, is
  redacted for others.

## Out of Scope

- Any other mastermind's tactics; Loki's other tactics (only these two).
- The extra-turn tactic mechanic (a separate WP).
- Card-data changes (resolver + move only; no marker authored).
- A shared data-driven tactic marker vocabulary (deferred per WP-497's operator ruling).
- Reworking the shipped `defeat-with-bystander` / `pure-fury` behavior — Cruel Ruler is
  strictly additive to that family.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/rules/tacticHandlers.ts` | `+ resolveCruelRuler`, `+ resolveManiacalTyrant`, consts, two dispatch branches |
| `packages/game-engine/src/moves/defeatChoice.resolve.ts` | `+ buildCityVillainDefeatTargets`; accept `'cruel-ruler'` |
| `packages/game-engine/src/moves/koDiscardChoice.resolve.ts` | **new** — resolve move + eligibility predicate + `has…` guard |
| `packages/game-engine/src/types.ts` | `+ 'cruel-ruler'`; `+ PendingKoDiscardChoice` + `G.pendingKoDiscardChoices?` |
| `packages/game-engine/src/game.ts` | register `resolveKoDiscardChoice`; `getLegalMoves` enumerate + short-circuit |
| `packages/game-engine/src/moves/*.ts` (action moves) | `+ hasPendingKoDiscardChoice(G)` block-all guard at each site |
| `packages/game-engine/src/ui/uiState.types.ts` / `.build.ts` / `.filter.ts` | `pendingKoDiscardChoice` five-step + `'cruel-ruler'` union case |
| `packages/game-engine/src/**` (sim dispatch) | `SIMULATION_MOVE_NAMES` + both sim `MOVE_MAP`s `+ resolveKoDiscardChoice` |
| `packages/game-engine/src/**/*.test.ts` | resolver, move, drift, audience-filter tests |
| `apps/arena-client/src/components/play/PendingDefeatChoicePrompt.vue` | `+ 'cruel-ruler'` heading branch |
| `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.vue` (+ test) | **new** multi-select prompt |
| `apps/arena-client/src/composables/useTurnActions.ts`, `components/play/TurnActionBar.vue`, `pages/PlayDesktop.vue`, `pages/PlayMobile.vue` | wire the new prompt into the pending cascade |
| `scripts/coverage/tactic-provenance.json` | both Loki tactics `executable` |

Governance (not in the code allowlist): `WORK_INDEX.md`, `EC_INDEX.md`,
`05-ROADMAP-MINDMAP.md`, `DECISIONS.md` (D-24510 flips Active at execution),
`NUMBER-LEDGER.md` (already reserved).

## Non-Negotiable Constraints

- Moves never throw; the dispatch stays a silent no-op for any unhandled tactic id.
- **Active-scoped only** — both choices park for `ctx.currentPlayer` (the defeating
  player). Cruel Ruler defeats a City Villain the active player picks; Maniacal Tyrant
  KOs only from the active player's OWN discard.
- **Cruel Ruler is a free defeat** — reuse `dispatchDefeatWithBystanderTarget` /
  `defeatCityVillainCore` (no attack spent, no acted-this-turn flag, Bystanders +
  captured Heroes + `onFight` fire), never a bespoke defeat path.
- **Maniacal Tyrant KO cap = 4**, clamped by discard size; 0 is a legal choice; each
  KO removes from discard **before** `koCard` (destination-only append); no
  return-on-discard reaction (discard→KO, not hand→discard).
- New pending choices obey the family conventions: FIFO queue, front-only resolve,
  front-pop before any nested dispatch, block-all guard at every action-move site,
  `client:false`, and the getLegalMoves + sim `MOVE_MAP` enumeration
  ([[reference_bot_legalmoves_moveguard_divergence]],
  [[reference_new_resolve_move_sim_dispatch_lockstep]]).
- **UIState five-step** for `pendingKoDiscardChoice` — a field that reaches `build` but
  not the audience filter is dropped and freezes the client
  ([[reference_uistate_filter_whitelist_drops_fields]]).
- Determinism: `ctx.random.*` only via the reused defeat core's `ShuffleProvider` (a
  Fight scry reshuffle) — neither tactic is itself random. No `Math.random`, wall-clock,
  or I/O. No `.reduce()` in the target/KO loops. No `boardgame.io` or registry import in
  `tacticHandlers.ts` (`ctx` narrowed via `unknown`, as the file already does).
- **Canonical-array lockstep:** if `SIMULATION_MOVE_NAMES` is a drift-pinned canonical
  array, update it in lockstep with the sim `MOVE_MAP`s and its runtime drift pin.

**Engine-wide standing constraints.** Honor `.claude/rules/code-style.md` +
`docs/ai/REFERENCE/00.6-code-style.md` (human-style, junior-readable; full English
names; JSDoc every function; `// why:` on non-obvious constants, any `ctx.random.*`,
and each `hasPendingKoDiscardChoice` guard site), ESM-only with `node:`-prefixed
built-ins, `.test.ts` on `node:test`, Node v22+. Work from full file contents.

## Contract

- `dispatchTacticOnFight(G, ctx, 'core-mastermind-loki-cruel-ruler', shuffle)` → with 0
  City Villains: no-op; 1: that Villain is defeated for free; ≥2: a `PendingDefeatChoice`
  (`choiceType: 'cruel-ruler'`) is parked for the active player, and
  `resolveDefeatChoice({ targetKind: 'villain', cityIndex })` defeats the chosen City
  Villain for free.
- `dispatchTacticOnFight(G, ctx, 'core-mastermind-loki-maniacal-tyrant', shuffle)` →
  with a non-empty active-player discard, a `PendingKoDiscardChoice`
  (`choiceType: 'ko-from-discard'`, `maxCount: 4`) is parked; empty discard: no-op.
- `resolveKoDiscardChoice({ cardIds })` — `cardIds` a 0..min(4, discardSize) array of
  distinct ids in the chooser's discard; each is removed from discard and appended to
  `G.ko`; empty array KOs nothing; invalid payloads are silent no-ops (queue intact).

## Vision Alignment

- §1 / §3 Rules Authenticity & Player Trust — each tactic resolves exactly as printed;
  deterministic, replay-faithful; the active player makes the printed choice.
- NG-1..7 not crossed — no monetization / PvP / identity surface.
- **Determinism (§8 / §22):** no new randomness; the only new hashed state is
  pending-choice queues that are undefined by default and populated only mid-choice.
  No committed replay/sentinel fixture defeats a Loki tactic → both hash oracles stay
  byte-identical → **no re-pin expected** ([[reference_hashed_g_field_dual_repin]]);
  STOP on any drift, never blind-re-pin.

## Acceptance Criteria

1. Defeating `core-mastermind-loki-cruel-ruler` with ≥2 City Villains parks a
   `'cruel-ruler'` `PendingDefeatChoice` for the active player; `resolveDefeatChoice`
   defeats the chosen City Villain with **no attack spent**, rescuing its Bystanders and
   firing its `onFight`.
2. Cruel Ruler with exactly 1 City Villain auto-defeats it (no prompt); with 0, no-op.
3. Defeating `core-mastermind-loki-maniacal-tyrant` with a non-empty active-player
   discard parks a `PendingKoDiscardChoice` (cap 4); empty discard → no-op.
4. `resolveKoDiscardChoice` KOs the selected 0..4 discard cards to `G.ko` (they leave
   discard); an empty selection KOs nothing; over-cap / duplicate / absent-id / wrong-
   player / empty-queue payloads are silent no-ops with the queue intact.
5. `pendingKoDiscardChoice` projects to the **owner** and is redacted for others
   (audience-filter test); it appears in the Play Diagnostics `uiStateSnapshot`.
6. An unknown/unimplemented tactic id remains a silent no-op (unchanged from WP-497).
7. Determinism: full engine suite green; sentinel `finalStateHash` + `PRE_WP080_HASH`
   byte-identical (no committed fixture defeats a Loki tactic) — any drift STOPs.
8. The new move is registered (`game.test.ts` drift), enumerated in `getLegalMoves`, and
   dispatched by both sim `MOVE_MAP`s (a sim run does not hang).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all green; note the pass delta.
3. `pnpm --filter @legendary-arena/arena-client test` → prompt tests green.
4. Control check: stub `resolveCruelRuler` / `resolveManiacalTyrant` to no-ops → the
   park / auto-defeat / KO assertions FAIL (non-vacuous); restore.
5. Confirm sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged; `pnpm
   sim:runtime-observed:check` current after tactic-coverage regen; run a sim to confirm
   it does not hang on the new pending choice.
6. `pnpm -r build` → 0; `pnpm effect-index:check` current; tactic-provenance rows present.
7. **D-24026 live-verify (operator-pending, post-deploy):** on
   `play.legendary-arena.com`, defeat each Loki tactic and confirm the prompt + effect.

## Definition of Done

Engine + arena-client suites green, `pnpm -r build` 0, effect-index + tactic coverage
regenerated, sentinel + PRE_WP080 hashes byte-identical (or a deliberate documented
re-pin — not expected), D-24510 Active, WORK_INDEX + EC_INDEX rows flipped, roadmap
mindmap node flipped (`roadmap:counts:check` 0), PR squash-merged, `STATUS.md`
close-out. D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decision (lands at execution)

**D-24510** — Two core Loki tactic Fight resolvers: **Cruel Ruler** ("Defeat a Villain
in the City for free") reuses the WP-486/682 `PendingDefeatChoice` free-defeat family
via a new `'cruel-ruler'` discriminant + a new all-City-Villain target builder (0/1/≥2
City Villains → no-op / auto-defeat / active-player pending choice; free defeat via the
shared core, Guard-bypassing, rewards applied); **Maniacal Tyrant** ("KO up to four
cards from your discard pile") adds a new bounded-optional (0..4) multi-select
`PendingKoDiscardChoice` + `resolveKoDiscardChoice` move that KOs the active player's
chosen own-discard cards to global `G.ko`. Cross-layer: engine resolvers park
active-scoped choices; the arena client renders each prompt (UIState five-step per
ARCHITECTURE.md §UIState Projection Integrity). See DECISIONS.md.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS (all required WP sections present, in order).
- **§2 Non-Negotiable Constraints** — PASS (explicit block; standing engine + client rules cited).
- **§3 Assumes** — PASS (WP-497 hard dep; WP-486/682/676 reused-pattern deps each cite their lock; slugs + multi-select precedent flagged as baseline assertions).
- **§4 Context** — PASS (`## Context` + `## Design Rationale` cover the light/heavy split, free-defeat reuse, the new multi-select, and the UIState five-step).
- **§5 Files Expected to Change** — PASS (closed cross-layer allowlist + governance).
- **§6 Naming Consistency** — PASS (canonical `pendingDefeatChoices`, `defeatCityVillainCore`, `G.ko`, `koCard`, `playerZones[pid].discard`, tactic ext_id grammar).
- **§7 Dependency Discipline** — PASS (WP-497 landed; all reused deps ✅).
- **§8 Architectural Boundaries** — PASS (engine resolvers/moves in game-engine; client renders projections only; UIState five-step is the sole engine→client boundary; no `boardgame.io`/registry import in `tacticHandlers.ts`; `ctx` via `unknown`; no `.reduce()`).
- **§9 Windows Compatibility** — N/A (no shell/path work).
- **§10 Env Var Hygiene** — N/A.
- **§11 Authentication Clarity** — N/A.
- **§12 Test Quality** — PASS (`node:test`, `.test.ts`; non-vacuous control-stub step; audience-filter + sim-no-hang checks).
- **§13 Commands & Verification** — PASS (`## Verification Steps` runnable).
- **§14 Acceptance Criteria Quality** — PASS (8 testable, non-vacuous ACs).
- **§15 Definition of Done** — PASS (binary gates incl. hash byte-identity + cross-layer suites).
- **§16 Code Style** — PASS (human-style, JSDoc, `// why:` on the new consts + each guard site).
- **§17 Vision Alignment** — PASS (§1/§3 faithful rules; NG-1..7 not crossed; determinism line present).
- **§18 Prose-vs-Grep Discipline** — PASS (no verification-grep token reused in prose).
- **§19 Bridge-vs-HEAD Staleness** — PASS (baseline `origin/main` at draft; slugs + multi-select precedent to reconfirm at execution).
- **§20 Funding Surface Gate** — N/A (no pricing/checkout/account surface).
- **§21 API Catalog Update** — N/A (no `apps/server` HTTP endpoint or `Library-only` export change).

Pre-flight verdict: **READY TO EXECUTE** pending the three execution baseline assertions
(both tactic slugs; Guard-bypass on the shipped free defeat; the absence of a 0..N-cap
optional multi-select precedent). Cross-layer scope is intentional and bounded — Cruel
Ruler is additive to a shipped family; Maniacal Tyrant is a new pending family carried
through its full file set.
