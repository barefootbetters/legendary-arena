# WP-476 — Magneto Master Strike: Reveal-an-X-Men-or-Discard Conditional + Interactive Discard-to-4

**User-Visible Surface:** `play.legendary-arena.com` — Magneto's Master Strike stops
force-discarding players who have an X-Men Hero, and lets the current player **choose**
which cards to discard when they must. **D-24026 live-verification applies**
(operator-pending: trigger the strike in a live match).

## User-Visible Impact

Fixes a bug reported from a live Magneto 1p match: Magneto's Master Strike —
*"Each player reveals an [team:x-men] Hero or discards down to four cards."* — **always
discarded** (log `[Magneto Master Strike] Player 0 discarded 2 card(s) down to 4.` at
1.1.1 / 4.1.1 / 21.1.1) and **auto-picked** the cards. It never checked the X-Men-reveal
alternative, and gave the player no choice of what to discard. After this packet: a
player who **has an X-Men Hero** reveals it and discards nothing; a player who must
discard **chooses** which cards (interactive for the current player).

## Goal

Make `resolveMagnetoStrike` honour the printed conditional: **(1)** each player who has
an X-Men Hero reveals it and is skipped (no discard); **(2)** a player who must discard
down to 4 does so — the **current player** via an INTERACTIVE discard-choice (a new
pending-choice mirroring the WP-242/243 KO-a-Hero machinery), non-current players via a
deterministic auto-pick (the current architecture's single-current-player limit — see
Scope Out). Adds **D-24284** (the mastermind reveal-or-discard + interactive-discard-to-N
contract).

## Assumes

- **On `origin/main`** — WP-476 / EC-511 / D-24284 reserved (ledger line landed via the
  reserve-first SPEC #1126); the reveal-or-wound hand+in-play helper amendment (D-24281,
  #1125) is on `main`. `apps/server` + `apps/arena-client` + game-engine green.
- Chain map (2026-07-31 surface study): Master Strikes are **hardcoded per-mastermind**
  (`rules/mastermindHandlers.ts` `mastermindStrikeHandler` if/else on `mastermindId`),
  NOT text/marker-driven. `resolveMagnetoStrike` (mastermindHandlers.ts:192) loops
  `Object.keys(playerZones).sort()` and `hand.slice(0, discardCount)` — auto-picks the
  front cards, no reveal check (`MAGNETO_HAND_SIZE_LIMIT = 4`). Strikes fire at
  **start-of-turn** villain reveal (`villainDeck.reveal.ts` gated on
  `currentStage === 'start'`), so every player's hand is **full** and inPlay empty →
  the reveal is **hand-only** here (do NOT copy D-24281's hand+inPlay scope; inPlay is
  empty at strike time). `G.cardTraits` is available at strike resolution
  (`selectLowestCostHero` already reads `cardTraits[id].team`). The KO-a-Hero
  pending-choice is the template (queue + resolve move + block-all guard + UIState
  projection + D-24011 private filter + bot/sim default + client prompt).

## Context (Read First)

**Read before executing:** `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, §The Move
Validation Contract (moves never throw), §UIState projection; `.claude/rules/*.md` +
`.claude/skills/legendary-game-engine/SKILL.md`; the **KO-a-Hero pending-choice** files
as the template — `moves/koHeroChoice.resolve.ts` (`resolveKoHeroChoice` +
`hasPendingKoHeroChoice`), `types.ts` (`PendingKoHeroChoice` ~464, `pendingKoHeroChoices`
~784), `ui/uiState.build.ts` (~845-866), `ui/uiState.filter.ts` (~479-505),
`simulation/ai.legalMoves.ts` (~257-265 + `SIMULATION_MOVE_NAMES`),
`apps/arena-client/src/components/play/PendingKoHeroChoicePrompt.vue`; the strike handler
`rules/mastermindHandlers.ts` (`resolveMagnetoStrike` :192, `mastermindStrikeHandler`
:661, `selectLowestCostHero` :260, `TEAM_X_MEN` :74); `docs/ai/DESIGN-MASTERMIND-STRIKE-MIGRATION.md`
(the future generalization path — out of scope here). The `D-24284` reservation in
`NUMBER-LEDGER.md`.

## Scope (In)

- **Reveal-check (all players), `rules/mastermindHandlers.ts`:** in `resolveMagnetoStrike`,
  before discarding, skip any player who **has an X-Men Hero in hand** (read `G.cardTraits`
  for `team === 'x-men'`, hand-only — strike fires at start-of-turn). Reuse a shared
  trait-scan (export `playerHasHeroMatchingTrait` from `villainEffects.execute.ts`, OR add
  a small `playerHasXMenHeroInHand` mirroring `selectLowestCostHero`'s existing
  `cardTraits` read — the executor's call; mind the `'hero-class'` vs `'heroClass'`
  spelling if reusing). Self-narrate the reveal (a `[Magneto Master Strike] Player N
  revealed an X-Men Hero — no discard.` log line).
- **Interactive discard-to-4 for the CURRENT player** — a new pending-choice mirroring
  KO-a-Hero:
  - `types.ts`: `PendingDiscardChoice { choiceType: 'discard-to-limit'; playerID: string; limit: number }` + `G.pendingDiscardChoices?: PendingDiscardChoice[]` (FIFO).
  - `moves/discardChoice.resolve.ts` (**new**): `resolveDiscardChoice({ G, playerID }, { cardIds })` validates the front entry (playerID + choiceType + `cardIds` are in hand + count discards exactly to `limit`), moves the chosen cards hand→discard, front-pops; invalid → silent no-op (moves never throw); `hasPendingDiscardChoice(G)` predicate.
  - `resolveMagnetoStrike`: when the **current** player must discard, park a
    `PendingDiscardChoice` (KO nothing yet); when a **non-current** player must discard,
    auto-pick deterministically — cheapest-first (mirroring the Red Skull /
    `selectLowestCostHero` selector, **not** Magneto's *current* front-of-hand
    `hand.slice(0, discardCount)`; keeping the expensive cards is the sensible default) —
    see Scope Out for why non-current stays auto.
- **Block-all guard:** thread `hasPendingDiscardChoice(G)` into **every** action-move
  guard site alongside the existing `hasPendingKoHeroChoice` (surface study list):
  `game.ts` (advanceStage/endTurn), `moves/coreMoves.impl.ts`, `dodgeCard.ts`,
  `fightMastermind.ts`, `fightVillain.ts`, `recruitHero.ts`, `healWounds.ts`,
  `playFromUndercover.ts`, `villainDeck/villainDeck.reveal.ts`, `simulation/ai.legalMoves.ts`.
  (A pending choice parked at **start** stage must block the start→main advance until resolved.)
- **UIState:** `ui/uiState.build.ts` projects the front `pendingDiscardChoice` (playerID,
  limit, the choosing player's revealable hand); `ui/uiState.types.ts`
  `UIPendingDiscardChoice`; `ui/uiState.filter.ts` redacts it for every audience except
  the choosing `playerID` (D-24011).
- **Bot/sim deterministic resolve:** `simulation/ai.legalMoves.ts` short-circuits to
  `resolveDiscardChoice` with a deterministic cheapest-first selection. **Unconditional**
  (or the per-turn sim loop hangs the moment a Magneto strike parks a discard): register in
  `SIMULATION_MOVE_NAMES` + both sim MOVE_MAPs (`simulation/simulation.runner.ts`,
  `simulation/par.aggregator.ts`, + their `*_MOVE_NAMES`), and keep the drift test
  `simulation/simulation.moveDispatch.drift.test.ts` green. **Only-if-dispatched:**
  `replay/replay.execute.ts` + `test/fixtures/runFixture.ts` MOVE_MAPs are core-moves-only
  dispatchers — add `resolveDiscardChoice` there **only if** a committed replay log / fixture
  move-list actually dispatches it (the re-pin below reveals this); a Magneto-strike fixture
  that parks a discard will force it.
- **Move registration:** `game.ts` — `resolveDiscardChoice: { move: ..., client: false }`;
  `game.test.ts` move-set + count +1.
- **Client (arena-client):** `components/play/PendingDiscardChoicePrompt.vue` (**new**,
  mirrors `PendingKoHeroChoicePrompt.vue` — shows the hand, select-N-to-discard, submit);
  `pages/PlayDesktop.vue` + `pages/PlayMobile.vue` import/register/guard-flag/mount;
  `components/play/uiMoveName.types.ts` add `'resolveDiscardChoice'`;
  `composables/useTurnActions.ts` reads `snapshot.pendingDiscardChoice`.
- **`docs/ai/DECISIONS.md`:** add **D-24284** (Drafted → Active at execution).

## Out of Scope

- **Interactive discard for NON-current players** (multiplayer human opponents). The
  strike resolves every player synchronously in one move, but the pending-choice model
  assumes a **single current-player chooser** (park writes `playerID: currentPlayer`; the
  bot resolver + block-all guards + UIState projection are current-player-scoped).
  Non-current players auto-pick here; a full non-active-chooser model is a **deferred
  follow-on** (larger — touches the guard model, bot resolver, and UIState projection).
  For 1p (the reported case) the current player is the only player, so this WP fully fixes
  it; multiplayer opponents get a deterministic auto-pick until the follow-on.
- **Generalizing to other masterminds' reveal-or-discard strikes** — strikes are hardcoded
  per-mastermind; other resolvers are a separate code follow-on (the composable-strike
  migration in `DESIGN-MASTERMIND-STRIKE-MIGRATION.md`). This WP marks **Magneto only**.
- No change to other mastermind strikes, the villain `[effect:]` vocabulary, or the
  reveal-or-wound handler (D-24281).

## Files Expected to Change

- `packages/game-engine/src/rules/mastermindHandlers.ts` — reveal-check + park/auto-pick (+ its test)
- `packages/game-engine/src/types.ts` — `PendingDiscardChoice` + `G.pendingDiscardChoices`
- `packages/game-engine/src/moves/discardChoice.resolve.ts` — **new** (resolve move + guard predicate) (+ test)
- `packages/game-engine/src/game.ts` — move registration + advanceStage guard
- `packages/game-engine/src/moves/coreMoves.impl.ts`, `dodgeCard.ts`, `fightMastermind.ts`, `fightVillain.ts`, `recruitHero.ts`, `healWounds.ts`, `playFromUndercover.ts` — block-all guard
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — block-all guard
- `packages/game-engine/src/ui/uiState.build.ts`, `ui/uiState.types.ts`, `ui/uiState.filter.ts` — projection + private filter
- `packages/game-engine/src/simulation/ai.legalMoves.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts` — bot default + sim MOVE_MAPs + `*_MOVE_NAMES` (unconditional)
- `replay/replay.execute.ts`, `test/fixtures/runFixture.ts` — core-moves-only MOVE_MAPs; add `resolveDiscardChoice` **only if** a committed replay log / fixture dispatches it (the re-pin reveals this)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — export `playerHasHeroMatchingTrait` (if reused)
- `packages/game-engine/src/game.test.ts` — move-set/count +1
- `apps/arena-client/src/components/play/PendingDiscardChoicePrompt.vue` — **new**
- `apps/arena-client/src/pages/PlayDesktop.vue`, `pages/PlayMobile.vue`, `components/play/uiMoveName.types.ts`, `composables/useTurnActions.ts` — client wiring
- `docs/ai/DECISIONS.md` — land D-24284

## Contract

> Full file contents (no diffs); ESM/Node v22+; `00.6`; moves never throw (validation-phase
> silent return); deterministic (no `ctx.random`, no I/O); the pending queue is a hashed
> `G` field; `G.messages` hash-excluded (D-24081); the reveal is **hand-only** at strike time.

**Locked:** reveal-check reads `G.cardTraits` `team === 'x-men'` in HAND only (strike =
start-of-turn); a player with an X-Men Hero discards nothing; the current player's discard
is an interactive pending-choice discarding **exactly** down to 4; non-current players
auto-pick cheapest-first; `resolveDiscardChoice` validates the front entry + is a silent
no-op on any invalid state; the new pending queue joins every block-all guard site + the
sim MOVE_MAP dispatch + the drift test; Magneto only.

## Acceptance Criteria

1. A player holding an X-Men Hero in hand at strike time **reveals** it and discards
   nothing (new test; the reported 1p case — no more forced discard).
2. The **current** player who must discard gets a `pendingDiscardChoice` (nothing
   discarded until they resolve); `resolveDiscardChoice` discards exactly the chosen cards
   down to 4, front-pops, and is a silent no-op on wrong playerID / wrong count / cards
   not in hand.
3. A **non-current** player who must discard auto-picks deterministically (cheapest-first)
   — no hang, no pending entry for them.
4. `hasPendingDiscardChoice` blocks every action move + the start→main / End-Turn advance
   while a discard choice is pending (no skipping).
5. The bot/sim path resolves the pending discard deterministically (`sim:runtime-observed:check`
   returns — no sim hang); `resolveDiscardChoice` is in `SIMULATION_MOVE_NAMES` + both sim
   MOVE_MAPs + the drift test passes; `game.test.ts` move-set/count updated (+1).
6. UIState projects `pendingDiscardChoice` only to the choosing player (D-24011 filter);
   the client `PendingDiscardChoicePrompt.vue` renders the hand + a submit.
7. `pnpm --filter @legendary-arena/game-engine build` + `test`, arena-client `test`/`typecheck`,
   `pnpm -r build` exit 0; a fixture re-pin (new hashed `pendingDiscardChoices` field on a
   Magneto strike) is **LIKELY** — regenerate + re-pin any shifted `finalStateHash` with a note.
8. `D-24284` landed (Active). No file outside the allowlist (+ governance).

## Verification Steps

```bash
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test
pnpm --filter @legendary-arena/arena-client test typecheck
node scripts/runtime-observed-hollows.mjs --check   # proves the sim didn't hang on the pending discard
pnpm -r build
# Post-deploy (D-24026): trigger Magneto's Master Strike — a hand with an X-Men Hero
# discards nothing; a hand without one prompts you to pick which cards to discard down to 4.
```

## Vision Alignment

**Clauses:** §17 (gameplay fidelity — the printed reveal-or-discard + player choice),
§10 (client interaction). **Conflict:** *No conflict* — implements the printed conditional
+ restores the player's discard choice. Determinism preserved (bots/sims auto-resolve).
**NG:** none.

## Definition of Done

- [ ] All 8 AC pass; game-engine + arena-client + `pnpm -r build` green.
- [ ] Determinism: fixture/replay hash unchanged OR regenerated-with-note.
- [ ] `D-24284` landed (Active).
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + `roadmap:counts:write`; EC_INDEX EC-511 → Done.
- [ ] **D-24026 live-verify (operator-pending):** the strike offers reveal + interactive discard.
- [ ] No file outside the allowlist (+ governance).

## Lint Gate Self-Review (`00.3`)

- §1/§15: header + User-Visible Impact; D-24026 present. PASS. §2: full-file/no-diffs/`00.6`.
  PASS. §4: read-list (KO-a-Hero template + strike handler + surface map). PASS. §5:
  closed allowlist, engine + arena-client, engine-then-client order. PASS. §8: engine
  decides / client projects; no layer leak. §17: §17/§10, No conflict. PASS. §20 N/A —
  no funding surface. §21 N/A — no `apps/server` HTTP endpoint or catalogued Library-only
  fn (strike + pending-choice are engine/client). Contract change (new pending-choice type
  + move + `G` field + UIState field) recorded by **D-24284**. §Drift: `resolveDiscardChoice`
  joins `SIMULATION_MOVE_NAMES` + both MOVE_MAPs + the drift test (§5 AC).

## Gate Verdicts (drafting session)

Recorded at drafting; see the SPEC commit body for the pre-flight / copilot / lint verdicts.
