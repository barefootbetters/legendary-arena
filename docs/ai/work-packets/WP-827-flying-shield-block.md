# WP-827 — Flying Shield Block: any seat may reveal it, once per turn, to stop a Wound and rescue a Bystander (Game Engine + card data + one client heading)

**Status:** Draft 2026-10-24 — pre-flight READY (one test-contract fix); copilot RISK (all fixes applied); 00.3 PASS — see §Gate Record (EC-865; **D-24760** reserved (#2987)).
**Primary Layer:** Game Engine (`moves/` reactive interception, `board/` wound chokepoint, `game.ts` onMove / onBegin, `simulation/` bot + turn parity) plus the hero-ability marker input, its regenerated card data, and one arena-client heading string
**Dependencies:** none open. Builds on WP-682 / D-24499 (Diving Block: the `gainWoundForPlayer` chokepoint and its land-then-offer-undo wave), WP-684 / D-24501 (the non-active / multi-seat `G.pendingSeatChoice`), D-24651 (reveal from hand or the cards played this turn), D-24673 (one Wound, one interception; the "would gain" log wording), D-24648 (the active seat is not stage-ridden).
**User-Visible Surface:** `play.legendary-arena.com` (any match using the Cap 75th hero Captain America (Falcon))
**Lane:** Standard (two-session). It adds a canonical `HERO_KEYWORDS` member, two `G` fields, a new seat-choice kind wired through the engine, the bot and the client, and touches turn-boundary state, so the lightweight lane does not apply (D-24028).
**Arc:** Cap 75th completion, remaining item 5 (auto-memory `project_cap75_completion_arc`).

> Baseline: `origin/main` at `2492a0ab` (the reserve commit #2987 on top of `ab2de8ab`). WP-826 (exec PR #2986, open at drafting) also bumps the `HERO_KEYWORDS` pins and edits the same marker / keyword files; whichever lands second rebases (Locked Values: counts N → N+1 governs).

---

## Goal

As a player with Captain America (Falcon), I want Flying Shield Block to protect any player at the table, so that when anyone would gain a Wound I can reveal it once per turn, stop that Wound, and rescue a Bystander.

Today the line "Once per turn, if a player would gain a Wound, you may reveal this card and rescue a Bystander instead." (`ca75/captain-america-falcon/flying-shield-block`) builds an empty hook: it does nothing, and the ledgers cannot see it.

After this session:
- When any player would gain a Wound, every seat holding a Flying Shield Block it has not revealed this turn (in hand, or played this turn) may be asked whether to reveal it: the recipient first (if they hold one), then the other seats in ascending order. The first seat that reveals stops the Wound (it returns to the supply) and rescues a Bystander into its own Victory Pile. The card stays where it is.
- Each copy can be revealed once per turn; a second copy can stop a second Wound.
- The Wound recipient's own Diving Block is offered first. Only if they decline it (or hold none) is Flying Shield Block offered for that Wound.
- A seat that declines is not asked again about that Wound; it passes to the next candidate, and when every candidate has declined the recipient keeps it.

## Scaffold (observed at drafting, REQUIRED evidence)

On 2026-10-24 the change was prototyped in the drafting worktree, measured, and reverted. The patch is kept as evidence (`wp827-scaffold.patch` in the drafting session's scratchpad); the executor re-authors from Locked Values and the Test Contract and may consult it.

- **Parser probe.** `[keyword:flying-shield-block]` on the line builds one hook per copy with `keywords: ['flying-shield-block']`, no condition, no unresolved marker (the generic `isValidHeroKeyword` arm; no parser change, as for `diving-block`).
- **Tests.** The new file (F1-F14) passed 14 / 14 on first run. Engine typecheck clean.
- **Suite.** game-engine 5672 → 5686 / 0 fail (+14 tests, +4 suites); `pnpm -r --no-bail test` 0 fail in every package; arena-client `typecheck` 0.
- **Revert proofs (observed).** Baseline `ca75.json`: F1-F8 and F10-F14 fail (F9 passes either way: a revealed Diving Block parks nothing). Chokepoint call removed: F2-F6, F10, F11, F13, F14 fail. Diving Block decline chain removed: F8 fails. `applyOnBeginParity` delete removed: F12 fails.
- **Derived artifacts.** `apply-hero-ability-markers.mjs` updated exactly 1 line. Only `ledger:heroes` was stale (801 rows; the new row reads executable, WP-827 / D-24760 with the provenance row). `effect-index`, `mechanics:metadata`, `sim:runtime-observed` (the empty hook was never a hollow observation), `cards:check`, `cards:count-markers:check`, `ledger:villains:check`, `gauntlet:loadouts:check` and `sim:coverage --check` stayed green with no regeneration, so the dashboard pin does not move.
- These were measured at `ab2de8ab` and are expectations, not targets; on a moved base the observed result governs.

## User-Visible Impact

- A Falcon player sees "A player would gain a Wound — Flying Shield Block?" with "Reveal Flying Shield Block: prevent Player N's Wound and rescue a Bystander" / "Let Player N take the Wound" (or "prevent your Wound" / "Take the Wound" for their own).
- The log reads "Player 1 revealed Flying Shield Block: prevented Player 0's Wound and rescued a Bystander." or "Player 0 took the Wound (Flying Shield Block was not revealed)."
- Every other card is unchanged; Diving Block plays exactly as before when no Flying Shield Block is on the table.

---

## Assumes

1. **Chokepoint** (`board/wounds.logic.ts` on the baseline): `gainWoundForPlayer` (L70) lands the Wound in the recipient's discard, then calls `checkDivingBlock(G, playerID, woundCardId)` (L91). Every wound-to-discard source routes through it. `gainWoundWithOutcome` (L119) reports `'diving-block-pending'` by counting Diving Block entries only.
2. **Diving Block** (`moves/divingBlock.logic.ts`): `checkDivingBlock` (L181) returns `void` and parks a `PendingDivingBlockWound` (`types.ts` L1526) when the recipient can reveal (`countRevealableDivingBlockCopies`, L103: hand + inPlay, D-24651). `openDivingBlockSeatChoiceIfNeeded` (L241) opens one wave as a `G.pendingSeatChoice` via `parkSeatChoice` (`moves/seatChoice.resolve.ts` L271). `applyDivingBlockResolvedSeatChoice` (L304) logs a decline at L329 and keeps the Wound.
3. **Wave plumbing**: `game.ts` turn.onMove calls `openDivingBlockSeatChoiceIfNeeded` after every move (L911), and tolerates a minimal `G` with `ctx` / `events` stubs (`game.test.ts` drives it that way). `applySeatChoiceByKind` dispatches by kind (`seatChoice.resolve.ts` L453). The bot answers by kind in `choosePlayingSeatChoiceOption` → `chooseByKind` (`simulation/ai.seatChoice.ts` L66 / L97, Diving Block branch L103). The turn freezes while `G.pendingSeatChoice` is set (the WP-684 block-all guard).
4. **Sims**: `simulation.runner.ts` (L701), `par.aggregator.ts` (L776) and `test/fixtures/runFixture.ts` do not mirror the Diving Block opener ("unmirrored"); a parked Diving Block Wound there is simply kept. Flying Shield Block follows the same rule.
5. **Turn boundary**: `game.ts` onBegin deletes per-turn flags with guarded deletes (e.g. `ambushVillainPlayedThisTurn`, L953), and `simulation/onBeginParity.ts` mirrors them (L107) for the loops that bypass bgio.
6. **Keyword sets**: `diving-block` is in `HeroKeyword` / `HERO_KEYWORDS` (`rules/heroKeywords.ts`, 78 entries, last `'out-of-time'`) and in `WOUND_TIME_EXECUTED_KEYWORDS` (`hero/heroEffects.execute.ts` L422), with no `HERO_EFFECT_HANDLERS` entry, so it is classified executable and never runs at play. Count pins: `rules/heroKeywords.test.ts` (78), `rules/heroAbility.setup.test.ts` (78 + ordered array), `setup/heroAbility.setup.test.ts` (78).
7. **End-of-game drop and setter guard**: `dropAllPendingPlayerChoices` (`endgame/mastermindVictory.logic.ts` L95) clears `pendingDivingBlockWounds`; its drift test lists every `pending*` field (`ALL_PENDING_FIELDS`, `mastermindVictory.logic.test.ts` L120). `operatorSetters.logic.ts` L77 refuses a setter while Diving Block Wounds are owed.
8. **Client**: `PendingSeatChoicePrompt.vue` picks its heading by `kind` (`case 'diving-block'`, L90) with a "Your choice" fallback, and renders each option's `label` from the projection. `PendingSeatChoicePrompt.test.ts` has a `'diving-block'` heading case (L114).
9. **Card data**: `data/cards/ca75.json` carries the Flying Shield Block line as quoted in §Goal, unmarked. `VALID_TOKEN_PATTERN` (`scripts/convert-cards/apply-hero-ability-markers.mjs` L123) rejects `[keyword:flying-shield-block]`.
10. **Provenance**: `scripts/coverage/mechanic-provenance.json` keys mechanics to `{ wp, decision }`; a new mechanic WP adds its row (the WP-826 gate finding).
11. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why a sibling module, not a Diving Block parameter.** The two differ in who decides (any holder vs the recipient), the reward (a rescue for the revealer vs a draw for the recipient), and the cap (once per turn per copy vs unlimited, D-24673). Duplicate-first (`.claude/rules/code-style.md`): `moves/flyingShieldBlock.logic.ts` mirrors `divingBlock.logic.ts` with its own queue and seat-choice kind, and the two meet at exactly two points: the chokepoint and the Diving Block decline.
- **Why Diving Block first, then Flying Shield Block.** One Wound must never have two open interceptions (a reveal by one would leave the other undoing a Wound that is already gone; all Wounds share `WOUND_EXT_ID`, so there is no per-Wound identity to cross-check). The recipient's own card is offered first; a decline hands the Wound on. The Flying Shield Block wave therefore waits while any Diving Block Wound is pending.
- **Why the recipient first, then ascending seats, and one prompt per seat per wave.** Who reveals decides who gets the Bystander (VP), so priority is a rule, not just a tie-break: the recipient protects their own Wound first, the same precedence as their Diving Block, and the rest go in ascending seat order (the WP-684 deterministic order), all computed from `G` alone. A seat asked about one Wound per wave mirrors Diving Block; the entry is stamped with the seat it was shown to, so the apply resolves exactly that Wound even when an earlier seat's reveal changed who else could reveal.
- **Why "once per turn" is per copy and lives in its own `G` field.** "Once per turn … reveal this card" caps the card, not the player, so a second copy is a second use. The record is not on `G.turnEconomy`: its rebuild helpers drop unknown fields (`carryConversionFlag`), and a non-active seat's reveal is not the active player's economy. A guarded delete at turn start (game.ts onBegin + `applyOnBeginParity`) resets it.
- **Known gap kept out of scope.** The immediate "gains a Wound" log line at a wound source reports a Flying-Shield-pending Wound as gained (`gainWoundWithOutcome` counts Diving Block only); the reveal line that follows says it was prevented. Teaching the 12 call sites a second pending kind is a follow-up.
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #1 (determinism), #2 (engine owns truth; the client renders labels), §Persistence Boundaries (runtime-only `G` fields, lazily initialized), §Layer Boundary (the engine decides; the client only adds a heading string; `.claude/rules/architecture.md`).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (`[keyword:…]`).
- `docs/ai/DECISIONS.md`: scan D-24499, D-24501, D-24648, D-24651, D-24673, D-24678 before coding.
- `docs/legendary-universal-rules-v23.md` §"Revealing a Card" (hand or played this turn; the same card may be revealed more than once unless the card limits it).
- User memory: `reference_hero_keyword_lockstep_sites`, `reference_three_bgio_bypassing_turn_loops` (turn parity), `reference_interactive_choice_active_player_only` (multi-seat = pendingSeatChoice).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- No randomness, no I/O, no registry access at runtime. Helpers never throw.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24760) before coding. One WP per session.

**Packet-specific:**
- **Card data is generated.** Edit `hero-ability-markers.json`, run `node scripts/convert-cards/apply-hero-ability-markers.mjs`, commit its output. Never hand-edit `data/cards/ca75.json`.
- **Diving Block is unchanged** when no Flying Shield Block is on the table: its waves, labels, logs and tests stay byte-identical (existing Diving Block tests pass unedited).
- **Runtime-only, lazily initialized.** Both new `G` fields are absent until first used; neither is created in `Game.setup`.
- **Turn parity.** The once-per-turn reset lands in both `game.ts` onBegin and `applyOnBeginParity`.

## Locked Values

- **Keyword**: `'flying-shield-block'`, appended as the last member of the `HeroKeyword` union and `HERO_KEYWORDS` (after `'out-of-time'` at baseline; after `'optional-ko-shield-played-rescue'` if WP-826 lands first; the ordered array in `rules/heroAbility.setup.test.ts` follows), 78 → 79 (N → N+1 governs), and in `WOUND_TIME_EXECUTED_KEYWORDS` after `'diving-block'`. No `HERO_EFFECT_HANDLERS` entry; not in `HANDLED_KEYWORDS` or `NO_MAGNITUDE_KEYWORDS`.
- **Types** (`types.ts`): `PendingFlyingShieldBlockWound { recipientID: string; woundCardId: CardExtId; candidateSeats: string[]; addressedSeat?: string }`; `LegendaryGameState.pendingFlyingShieldBlockWounds?: PendingFlyingShieldBlockWound[] | undefined`; `LegendaryGameState.flyingShieldBlockUsedThisTurn?: CardExtId[] | undefined`.
- **Module** `moves/flyingShieldBlock.logic.ts`:
  - `FLYING_SHIELD_BLOCK_SEAT_CHOICE_KIND = 'flying-shield-block'`; `FLYING_SHIELD_BLOCK_REVEAL_OPTION_INDEX = 0`; decline index 1; `defaultOptionIndex` = decline.
  - `cardCarriesFlyingShieldBlock(G, cardId)`: a hook of the card has the keyword.
  - `findRevealableFlyingShieldBlockCopy(G, seat)`: first copy in hand, then `inPlay`, not in `flyingShieldBlockUsedThisTurn`.
  - `checkFlyingShieldBlock(G, recipientID, woundCardId): boolean`: `candidateSeats` = the recipient (if it has a revealable copy), then every other seat with one, in ascending id; none → `false`; else push `{ recipientID, woundCardId, candidateSeats }` (lazy-init) and return `true`.
  - `openFlyingShieldBlockSeatChoiceIfNeeded(G, events, currentPlayer?)`: no-op when the queue is empty, a seat choice is open, or any Diving Block Wound is pending. Drops entries none of whose candidates can still reveal (log `Player ${recipientID} took the Wound (no Flying Shield Block was left to reveal).`). Then, for each entry in FIFO order, it addresses that entry's first candidate in `candidateSeats` order that can still reveal; if that seat is already addressed this wave, the entry waits for the next wave (it is never offered to a later candidate first), and stamps `addressedSeat` (so a seat is asked about one Wound per wave and an entry about one seat). The opener deletes `addressedSeat` from every entry before stamping; the apply deletes the stamp of every entry it resolves, reveal or decline; labels `Reveal Flying Shield Block: prevent your Wound and rescue a Bystander` / `Take the Wound` for the recipient, else `Reveal Flying Shield Block: prevent Player ${recipientID}'s Wound and rescue a Bystander` / `Let Player ${recipientID} take the Wound`. `parkSeatChoice(G, events, choice, currentPlayer)`.
  - `applyFlyingShieldBlockResolvedSeatChoice(G, choice)`: ascending seats; each resolves the entry stamped for it. Reveal → push the copy to `flyingShieldBlockUsedThisTurn` (lazy-init), move one `WOUND_EXT_ID` from the recipient's discard to `G.piles.wounds`, rescue `G.piles.bystanders[0]` into the revealer's Victory Pile, log (`'applied'`) `Player ${seat} revealed Flying Shield Block: prevented ${their own | Player N's} Wound and ${rescued a Bystander | could not rescue a Bystander (the supply is empty)}.` (both clauses built with if/else). If no Wound is in the recipient's discard any more (a reshuffle moved it), still mark the copy and rescue, and log `Player ${seat} revealed Flying Shield Block and rescued a Bystander (Player ${recipientID}'s Wound was no longer in their discard pile).` (the Diving Block not-found precedent). Reveal and decline are separate helpers so each function fits the ~30-line rule. Decline → remove the seat from `candidateSeats`; none left → log `Player ${recipientID} took the Wound (Flying Shield Block was not revealed).` and drop the entry. Delete the queue when empty.
- **Chokepoint**: `checkDivingBlock` returns `boolean` (true when it parked); `gainWoundForPlayer` calls `checkFlyingShieldBlock` only when it returned `false`.
- **Diving Block decline**: after its decline log, `applyDivingBlockResolvedSeatChoice` calls `checkFlyingShieldBlock(G, seat, woundEntry.woundCardId)`.
- **onMove**: `openFlyingShieldBlockSeatChoiceIfNeeded(G, events, ctx?.currentPlayer)` right after the Diving Block opener. **onBegin** and **`applyOnBeginParity`**: guarded `delete G.flyingShieldBlockUsedThisTurn`.
- **Dispatch**: `applySeatChoiceByKind` routes the kind to `applyFlyingShieldBlockResolvedSeatChoice` (after the Diving Block branch). **Bot**: `chooseByKind` returns the reveal index for the kind.
- **Drop and guard**: `dropAllPendingPlayerChoices` sets `pendingFlyingShieldBlockWounds = undefined` (alphabetical, after `pendingEscapeProcedures`); `ALL_PENDING_FIELDS` gains `'pendingFlyingShieldBlockWounds'` after `'pendingEscapeProcedures'`; `operatorSetters.logic.ts` treats a non-empty queue as owed.
- **Client heading**: `case 'flying-shield-block': return 'A player would gain a Wound — Flying Shield Block?';`, pinned by one case in `PendingSeatChoicePrompt.test.ts`.
- **Marker**: `VALID_TOKEN_PATTERN` gains `^\[keyword:flying-shield-block\]$`; `hero-ability-markers.json` `ca75` gains `{ "heroSlug": "captain-america-falcon", "cardSlug": "flying-shield-block", "abilityIndex": 0, "markupToken": "[keyword:flying-shield-block]" }` after the last Paramilitary Ops entry.
- **Provenance**: `"flying-shield-block": { "wp": "WP-827", "decision": "D-24760" }` as the last `mechanic-provenance.json` row.
- **Rebase**: on a rebase over WP-826, `ca75.json`, the marker map and the derived ledgers are regenerated through the regen chain, never hand-merged.

## Scope (In)

- **A)** NEW `moves/flyingShieldBlock.logic.ts`; `types.ts`; `board/wounds.logic.ts`; `moves/divingBlock.logic.ts`; `game.ts`; `simulation/onBeginParity.ts`; `moves/seatChoice.resolve.ts`; `simulation/ai.seatChoice.ts`; `endgame/mastermindVictory.logic.ts`; `moves/operatorSetters.logic.ts`; `rules/heroKeywords.ts`; `hero/heroEffects.execute.ts` (the wound-time set).
- **B)** Tests: NEW `moves/flyingShieldBlock.logic.test.ts` (F1-F16); `endgame/mastermindVictory.logic.test.ts` (one field); the three keyword count pins.
- **C)** `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` (one heading case) and its test (one case).
- **D)** Marker validator + marker map → regenerated `data/cards/ca75.json`; `scripts/coverage/mechanic-provenance.json`.
- **E)** Regenerated derived artifacts that their `:check` reports stale, and the dashboard totalObs pin if the runtime-observed feed moves.

## Out of Scope

- Teaching `gainWoundWithOutcome` and its 12 call sites a "Flying Shield Block can prevent it" outcome (Context, known gap).
- Wounds gained to hand outside the chokepoint (Random Acts' optional self-Wound, D-24678): no Flying Shield Block offer there.
- The co-printed sibling "Once per turn, if a player would gain a Wound, you may reveal this card and [keyword:Investigate] for any card instead." (another set).
- Mirroring the Diving Block / Flying Shield Block openers in the simulation runner, the PAR aggregator or `runFixture.ts` (the existing "unmirrored" rule).
- The remaining Cap 75th items (Winter Soldier, the three schemes).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `moves/flyingShieldBlock.logic.ts`, `moves/flyingShieldBlock.logic.test.ts`: **new**
- `types.ts`, `board/wounds.logic.ts`, `moves/divingBlock.logic.ts`, `game.ts`, `simulation/onBeginParity.ts`, `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts`, `endgame/mastermindVictory.logic.ts`, `moves/operatorSetters.logic.ts`, `rules/heroKeywords.ts`, `hero/heroEffects.execute.ts`: modified
- `endgame/mastermindVictory.logic.test.ts`, `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`: modified

**Client**
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue`, `PendingSeatChoicePrompt.test.ts`: modified (one heading, one case)

**Card data + scripts**
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/coverage/mechanic-provenance.json`: modified
- `data/cards/ca75.json` — regenerated

**Derived artifacts (regenerated only if their `:check` reports stale)**
- `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv` — regenerated
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json` — regenerated
- `docs/ai/coverage/runtime-observed-hollows.json` — regenerated; `apps/dashboard/src/composables/useInPlayCoverage.test.ts`: totalObs re-pin, only if the feed moved

That is 23 hand-edited files (6 tests). It is above the ~8 guideline because a reactive interception is wired at fixed sites (chokepoint, onMove, onBegin + parity, dispatch, bot, drop set, setter guard), each a few lines, plus the keyword lockstep pins; the WP-682 Diving Block packet touched the same sites. Nothing in the regenerated set is hand-authored.

**Governance:** `docs/ai/DECISIONS.md` (D-24760), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-827-flying-shield-block.md`

## Contract

- New `HeroKeyword` `'flying-shield-block'` (closed canonical set, recorded in D-24760), wound-time executed.
- New runtime-only `G` fields `pendingFlyingShieldBlockWounds` and `flyingShieldBlockUsedThisTurn`, both lazily initialized; new seat-choice kind `'flying-shield-block'` (no new move: `resolveSeatChoice` carries it).
- `checkDivingBlock` now returns `boolean` (its only production caller is the chokepoint).
- No new UIState field: the seat choice projects through the existing `pendingSeatChoice` projection.

## Test Contract

`moves/flyingShieldBlock.logic.test.ts` builds the Falcon hooks from `data/cards/ca75.json` (three copies) and drives `gainWoundForPlayer`, the LIVE `LegendaryGame.phases.play.turn.onMove` (with `{ G, ctx: { currentPlayer: '0' }, events: {}, random }`, the `game.test.ts` pattern) to open waves, `resolveSeatChoice`, `choosePlayingSeatChoiceOption`, `applyOnBeginParity` and the live `turn.onBegin` on a `LegendaryGame.setup` state. Diving Block is a synthetic hook (the `divingBlock.logic.test.ts` pattern).

| # | Input | Expected | Invariant |
|---|---|---|---|
| F1 | Falcon hooks | each copy: keywords `['flying-shield-block']`, no condition, no unresolved marker | parse |
| F2 | seat 1 holds a copy; seat 0 gains a Wound; seat 1 reveals | entry `{0, wound, ['1']}`; prompt names Player 0; Wound back to supply; seat 1 Victory Pile 1 Bystander; copy stays in hand; used list `[copy]` | another seat intercepts |
| F3 | F2 then a second Wound to seat 0 | nothing parks; Wound kept | once per turn |
| F4 | two copies, two Wounds, two reveals | both prevented; used list both copies | per copy |
| F5 | decline | Wound kept; no rescue; used list absent; "took the Wound (Flying Shield Block was not revealed)" | |
| F6 | holder's own Wound | label "prevent your Wound"; reveal prevents + rescues | |
| F7 | copy in seat 1's play area | revealable | D-24651 |
| F8 | seat 0 Diving Block, seat 1 Flying Shield Block | Diving Block wave first, no FSB entry; decline → FSB entry → FSB wave → reveal prevents | order |
| F9 | Diving Block revealed | no FSB entry; no rescue | one interception |
| F10 | 3 players; seats 1 and 2 hold copies; seat 0 gains a Wound | candidates `['1','2']`; seat 1 declines → seat 2 asked → reveals | pass-on |
| F11 | one copy (seat 1), Wounds to seats 0 and 2 | one prompt (seat 1); reveal stops the first; second dropped with "no Flying Shield Block was left to reveal" | per-seat wave, copy spent |
| F12 | `applyOnBeginParity` | used list deleted; copy revealable again; on a `G` that never had it, no key is created | turn reset (rebuilt loops) |
| F12b | live `turn.onBegin` on a setup state with the used list pre-set | the used list is deleted; on a fresh setup state no key is created | turn reset (live) |
| F13 | empty Bystander supply | Wound still prevented; log says the supply is empty | |
| F14 | bot | `choosePlayingSeatChoiceOption` returns 0 | bot reveals |
| F15 | 3 players; seats 1 and 2 hold one copy each; Wound A to seat 0, then Wound B to seat 2 | wave 1 stamps A→'1', B→'2' (B's recipient first); both decline; wave 2 stamps A→'2', B→'1'; seat 1 reveals, seat 2 declines → seat 2 has 0 Wounds, seat 0 keeps A, seat 1 rescues 1 Bystander; logs "Player 1 revealed Flying Shield Block: prevented Player 2's Wound…" then "Player 0 took the Wound (Flying Shield Block was not revealed)."; queue absent | stamp lifecycle; recipient-first order |
| F16 | reveal when the recipient's Wound has left the discard | copy marked, Bystander rescued, the "no longer in their discard pile" line | not-found branch |

Also: `ALL_PENDING_FIELDS` gains the queue (the drop-set drift test), and the three keyword pins move 78 → 79.

## Vision Alignment

**Vision clauses touched:** §1 (rules authenticity), §4 (faithful multiplayer: a non-active seat is asked mid-turn), §10 (content as data: marker-map input), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (rules fidelity only, no paid or persuasive surface).

**Determinism preservation:**
- Every helper is a pure function of `G`; candidate order is the recipient then ascending seats, and the apply runs in ascending seat order; no randomness (no draw).
- Both `G` fields are lazily created and deleted when empty / at turn start, so a match with no Falcon hero is byte-identical; `finalStateHash` / `PRE_WP080_HASH` fixtures play no ca75 hero.
- **Replay compat:** a stored match replays from its bgio `initialState` (setup-time hooks), so a pre-deploy match has no `flying-shield-block` hook and replays identically. Only matches created after the deploy carry it.
- No PAR seed or profile artifact and no gauntlet config contains a ca75 hero, so none is regenerated. The fixed-seed runtime-observed sweep is regenerated if its check reports stale.

## Funding Surface Gate

§20 **N/A**: engine, card data and one prompt heading. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Behavior.** F1-F16 (with F12b) pass on the regenerated `data/cards/ca75.json`; the client heading case passes.
2. **Unchanged neighbors.** Every existing Diving Block, seat-choice, wound and onBegin-parity test passes unedited; the only edited existing assertions are the three count pins and the `ALL_PENDING_FIELDS` list.
3. **Revert proofs.** (a) With the baseline `data/cards/ca75.json` (`git restore --source "$(git merge-base HEAD origin/main)" -- data/cards/ca75.json`), F1-F8, F10-F14, F15 and F16 fail. (b) With the chokepoint call removed, F2-F6, F10, F11, F13, F14 and F15 fail. (c) With the Diving Block decline chain removed, F8 fails. (d) With the `applyOnBeginParity` delete removed, F12 fails. (e) With the `game.ts` onMove Flying Shield Block opener removed, F2 fails. (f) With the `game.ts` onBegin delete removed, F12b fails. (g) With `gainWoundForPlayer` calling `checkFlyingShieldBlock` unconditionally, F8 and F9 fail. (h) With the stamp lookup replaced by a `candidateSeats` lookup, record whether F15 fails (its invariant is the stamp lifecycle either way). Each is restored afterwards.
4. **Card data.** `apply-hero-ability-markers.mjs` reports exactly 1 line updated; `pnpm cards:check` and `pnpm cards:count-markers:check` exit 0.
5. **Derived gates.** `pnpm ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `gauntlet:loadouts:check`, `sim:runtime-observed:check` and `sim:coverage --check` exit 0 on the committed tree.
6. **Dashboard** (only if the feed moved): after `pnpm --filter @legendary-arena/dashboard run prebuild:coverage`, `test:coverage` passes with only the `totalObs` literal changed by the feed's `summary.totalObservations` delta; `resolvedObs` / `percentResolved` byte-unchanged, else STOP; then dashboard `typecheck` and `format:check` exit 0.
7. **Client.** `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 and the heading test passes.
8. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; expected delta +17 tests / +4 suites (the new file: F1-F16 + F12b; the scaffold's 14 plus three). A different delta is explained, never tuned.
3. AC 3 revert proofs from `packages/game-engine` with `node --import tsx --test src/moves/flyingShieldBlock.logic.test.ts`, each restored (for (a), re-run `node scripts/convert-cards/apply-hero-ability-markers.mjs` from the repo root and confirm `git diff --stat -- data/cards/ca75.json` matches the pre-proof state).
4. Regen chain, each step only if its `:check` reports stale after the prior step: `node scripts/convert-cards/apply-hero-ability-markers.mjs` → `pnpm -r build` → the provenance row → `pnpm ledger:heroes` → `pnpm effect-index` → `pnpm mechanics:metadata` → `pnpm sim:runtime-observed`. Then each check in AC 4-5 → 0, and AC 6 if the feed moved.
5. `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
6. `pnpm -r --no-bail test` → 0 fail.
7. `git status --porcelain` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] Every Acceptance Criterion passes and the diff is allowlist-only.
- [ ] D-24760 appended to `DECISIONS.md` as Active; 01.6 post-mortem written (new contract fields and a new execution path); `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]` with date, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-865:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). On `play.legendary-arena.com`, after `/api/version` shows a gitSha that contains the merge, in a 2-player operator (debug) match created after the deploy, seat 1 a bot ally, Captain America (Falcon) in the loadout:
  - put Flying Shield Block in your hand and make the bot seat gain a Wound (the wound setter on seat 1): you are asked "prevent Player 1's Wound and rescue a Bystander"; reveal → the bot's Wound is gone and a Bystander joins your Victory Pile;
  - in the same turn make a player gain another Wound: no prompt (once per turn) unless you hold a second copy;
  - on your next turn, gain a Wound yourself with Flying Shield Block in hand: "prevent your Wound"; decline → you keep the Wound and the log says so;
  - on the bot's turn, with one copy in your hand, a Master Strike that wounds every player: you (non-active) are first asked "prevent your Wound"; decline it and you are asked "prevent Player 1's Wound"; reveal → the bot's Wound is gone, you rescue a Bystander, and the bot's turn continues with no reload (the D-24648 stage-ride path).

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24760 — flying-shield-block.** It locks:
- the keyword (wound-time executed) and the sibling module with its own queue and seat-choice kind;
- who is asked (every seat with an unused revealable copy: the recipient first, then ascending; priority decides who gets the Bystander VP), one Wound per seat per wave with the shown Wound stamped (stamps cleared by the opener before stamping and by the apply on every resolve), the reward (the revealer rescues; the Wound returns to the supply), and "once per turn" per copy in `G.flyingShieldBlockUsedThisTurn`, reset at turn start in both turn loops;
- the order with Diving Block (recipient's Diving Block first; a decline hands the Wound on; the FSB wave waits while Diving Block is pending), so a Wound never has two open interceptions;
- `checkDivingBlock` returning `boolean`;
- replay-compat and the unmirrored-in-sims rule;
- the known gaps: the wound-source log line reports an FSB-pending Wound as gained; no offer for Wounds gained to hand outside the chokepoint.

---

## Gate Record

**Pre-flight (01.4) (independent subagent): NOT READY → READY TO EXECUTE after one blocking fix, applied (test-contract only; no re-run needed, per the reviewer).** Verified every Assumes anchor on `2492a0ab`; the chokepoint is the only wound-to-discard path (Random Acts' to-hand Wound is out of scope); the UIState projection / filter, the client move name, `effectProvenance`, the server bot-ally / autoplay drivers and the timeout default are all kind-agnostic; no hash exclusion list names these fields; no freeze path; non-active seats ride the proven Diving Block stage-ride path.
- **PS-1 (fixed):** the test opened waves by calling the openers directly and F12 drove only `applyOnBeginParity`, so the `game.ts` onMove opener and onBegin delete could be removed with everything green. The test now drives the live `turn.onMove`; F12b drives the live `turn.onBegin`; revert proofs (e) / (f).
- **RS-1..RS-7 (applied):** a non-active-seat live-verify bullet; F15 (two-seat wave, the stamp); last-member wording vs WP-826 + regen-on-rebase; the reveal's not-found branch (F16); Goal wording; `runFixture.ts` named unmirrored; alphabetical drop-set placement.

**Copilot (01.7) (independent subagent): round 1 RISK (HOLD), seven fixes, all applied; round 2 RISK, three wording fixes, applied (below). Pre-flight stands.** Round 1 clean on FM 1-3, 5, 7, 9, 10, 12-14, 16-25, 27-30 (per-copy "once per turn" is faithful; no freeze; turn-boundary Wounds do not exist; the wound-source log gap is cosmetic; hashes / PAR / gauntlet cannot move).
1. FM 6 / 26: the `addressedSeat` stamp lifecycle → locked (opener clears all stamps first; apply clears on every resolve).
2. FM 11: F15 hedged → a concrete 3-player crossing-stamp case.
3. FM 11: stale revert-proof lists, F9 never failing → lists updated, proof (g), proof (h); F12 / F12b assert no key is created.
4. FM 26: seat priority decides who gets the Bystander VP → the recipient first, then ascending (Goal, Context, Locked Values, D-24760).
5. FM 26: Goal decline wording → fixed.
6. FM 11: live-verify expected the wrong prompts → wound setter; "your next turn"; the Master Strike bullet asks about your own Wound first.
7. FM 11: a duplicated sentence → removed.

Round 2 (all seven verified applied; Locked Values byte-identical; F10 / F11 / F15 hand-checked under recipient-first, and proof (h) would fail F15):
1. FM 23 / 26: "lowest candidate" contradicted recipient-first and left wait-vs-fall-through open → "first candidate in `candidateSeats` order … the entry waits for the next wave".
2. FM 26: Goal decline wording → "it passes to the next candidate, and when every candidate has declined the recipient keeps it".
3. FM 11: F10 now names the recipient (seat 0).

**Lint (00.3) (independent subagent): FAIL → PASS after one WP fix (cite 00.2 §5) and two EC fixes (dashboard typecheck; the onBegin-parity failure smell), applied, plus advisories A1 (the unambiguous wave rule), A4 (Layer Boundary), A5 (Vision §4), A6 (reveal / decline helpers, if/else log clauses), A7 (a client heading test), A8 (the `chooseByKind` anchor). A2 was folded into RS-3; A3 (NUMBER-LEDGER LANDED note) not taken: the ledger reservation line is already on main and editing it in place risks the union-merge duplicate.

**Final gate state:** pre-flight READY TO EXECUTE · copilot RISK (every concern fixed and recorded above) · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 sections present and non-empty; 8 ACs; 5 Out-of-Scope items |
| §2 | PASS — full files, no diffs, ESM / Node 22, 00.6, session protocol, packet-specific rules; separate Locked Values |
| §3 | PASS — 11 anchored Assumes items, the WP-826 overlap and rebase rule, a BLOCKED clause |
| §4 | PASS — 00.2 §5 (fixed), ARCHITECTURE #1 / #2 / Persistence / Layer Boundary, DECISIONS scan list, rules v23, memory refs |
| §5 | PASS — every file listed; regenerated files tagged; the 23-file size justified |
| §6 | PASS — `woundCardId`, `CardExtId`, `WOUND_EXT_ID`, `playerID`, `recipientID` consistent with `types.ts` |
| §7 | PASS — no new dependencies |
| §8 | PASS — logic in the engine; the client adds a heading string; runtime-only lazy `G` fields |
| §9 | PASS — pnpm / node / git only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — node:test, local data, no boardgame.io testing import, network or DB |
| §13 | PASS — exact commands with expected deltas |
| §14 | PASS — 8 binary ACs tied to F-numbers and named commands |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes, allowlist-only diff; live-verify on `play.legendary-arena.com` |
| §16 | PASS — duplicate-first sibling module; helpers split to fit the size rule |
| §17 | PASS — §1 / §4 / §10 / §8 / §22 / §23 / §24 / NG-1; conflict line; determinism and replay lines |
| §18 | N/A — no forbidden-token grep |
| §19 | N/A — commit-time discipline |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason |

EC-865 vs EC-TEMPLATE: FAIL → PASS after the two fixes; Locked Values byte-identical to the WP; under the 100-line ceiling.

**Verdict:** PASS.
