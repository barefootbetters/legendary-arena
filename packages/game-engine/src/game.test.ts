import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// why: WP-411 / D-24223 — the AC-3 wiring test drives a REAL boardgame.io match
// through the framework's own reducer to prove the top-level `endIf` sets
// `ctx.gameover`. The deep dist entry is the same one the server-layer replay /
// competition tests use (matchReplay.logic.test.ts, competition.logic.test.ts);
// it exposes InitializeGame + CreateGameReducer and carries no types (cast
// below). This is the ONLY vehicle that exercises the boardgame.io wiring —
// the engine-runner simulation harness re-implements the turn loop and calls
// evaluateEndgame directly, so it never sets `ctx.gameover` (see EC-446
// Execution Amendment).
import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';
import { LegendaryGame } from './game.js';
import type { LegendaryGameState, MatchConfiguration } from './types.js';
import { HAND_SIZE } from './moves/drawCards.logic.js';
import { makeMockCtx } from './test/mockCtx.js';
import { evaluateEndgame } from './endgame/endgame.evaluate.js';
import { ENDGAME_CONDITIONS } from './endgame/endgame.types.js';

// why: the deep dist entry carries no types; cast to the minimal shape these
// tests use — mirrors the server-layer precedent (matchReplay.logic.test.ts).
const { InitializeGame, CreateGameReducer } = boardgameInternal as unknown as {
  InitializeGame(config: {
    game: unknown;
    numPlayers: number;
    setupData: unknown;
  }): { G: unknown; ctx: { currentPlayer: unknown; gameover?: unknown } };
  CreateGameReducer(config: {
    game: unknown;
    isClient: boolean;
  }): (
    state: unknown,
    action: { type: string; payload: unknown },
  ) => { G: unknown; ctx: { currentPlayer: unknown; gameover?: unknown } };
};

/**
 * Creates a valid mock MatchConfiguration for testing.
 *
 * All values are plausible ext_id strings and counts that satisfy the
 * MatchConfiguration interface. These are not real card ext_ids — they exist
 * only to exercise the setup contract.
 */
/**
 * @amended WP-113 PS-7: bare slug fixtures migrated to set-qualified
 *   form `'<setAbbr>/<slug>'` per the qualified-ID contract
 *   (per D-10014). Assertions below
 *   were updated to match.
 */
function createMockMatchConfiguration(): MatchConfiguration {
  return {
    schemeId: 'test/test-scheme-001',
    mastermindId: 'test/test-mastermind-001',
    villainGroupIds: ['test/test-villain-group-001', 'test/test-villain-group-002'],
    henchmanGroupIds: ['test/test-henchman-group-001'],
    heroDeckIds: ['test/test-hero-deck-001', 'test/test-hero-deck-002', 'test/test-hero-deck-003'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

describe('LegendaryGame', () => {
  it('setup() returns a JSON-serializable game state', () => {
    const mockConfiguration = createMockMatchConfiguration();

    // why: boardgame.io 0.50.x setup receives (context, setupData) where
    // context includes { ctx, random, events, log }. makeMockCtx provides
    // the minimal shape needed by buildInitialGameState.
    const mockContext = makeMockCtx({ numPlayers: 2 });
    const gameState = LegendaryGame.setup!(
      mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      mockConfiguration,
    );

    // G must be JSON-serializable at all times — no functions, classes, Maps,
    // Sets, Dates, or Symbols. If this throws, the game state contract is broken.
    const serialized = JSON.stringify(gameState);
    assert.ok(serialized, 'JSON.stringify(G) must produce a non-empty string');

    // Round-trip: parse the serialized state and verify it matches the original.
    const deserialized = JSON.parse(serialized);
    assert.deepStrictEqual(
      deserialized,
      gameState,
      'Game state must survive JSON round-trip without data loss',
    );
  });

  it('setup() includes all 9 MatchConfiguration fields in the returned state', () => {
    const mockConfiguration = createMockMatchConfiguration();

    const mockContext = makeMockCtx({ numPlayers: 2 });
    const gameState = LegendaryGame.setup!(
      mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      mockConfiguration,
    );

    assert.equal(gameState.matchConfiguration.schemeId, 'test/test-scheme-001');
    assert.equal(gameState.matchConfiguration.mastermindId, 'test/test-mastermind-001');
    assert.deepStrictEqual(gameState.matchConfiguration.villainGroupIds, ['test/test-villain-group-001', 'test/test-villain-group-002']);
    assert.deepStrictEqual(gameState.matchConfiguration.henchmanGroupIds, ['test/test-henchman-group-001']);
    assert.deepStrictEqual(gameState.matchConfiguration.heroDeckIds, ['test/test-hero-deck-001', 'test/test-hero-deck-002', 'test/test-hero-deck-003']);
    assert.equal(gameState.matchConfiguration.bystandersCount, 30);
    assert.equal(gameState.matchConfiguration.woundsCount, 30);
    assert.equal(gameState.matchConfiguration.officersCount, 30);
    assert.equal(gameState.matchConfiguration.sidekicksCount, 0);
  });

  it('WP-686: setup() with finalBlow: true stores G.finalBlow === true', () => {
    // why: WP-686 / D-24503 — a match created with the Final Blow flag on carries
    // it on G for the WP-687 endgame gate to read.
    const mockConfiguration: MatchConfiguration = {
      ...createMockMatchConfiguration(),
      finalBlow: true,
    };
    const mockContext = makeMockCtx({ numPlayers: 2 });
    const gameState = LegendaryGame.setup!(
      mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      mockConfiguration,
    );
    assert.equal(gameState.finalBlow, true);
  });

  it('WP-686: setup() omits the top-level G.finalBlow when the flag is false or absent', () => {
    // why: WP-686 / D-24503 — the top-level G.finalBlow is the normalized read
    // surface WP-687 consumes; it is seeded ONLY when the payload sets true, so a
    // false or absent flag leaves G.finalBlow === undefined (no top-level key).
    // (matchConfiguration faithfully echoes whatever setupData carried, which is a
    // separate record of the input — see the absent-flag byte-identity check below.)
    const falseFlagState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      { ...createMockMatchConfiguration(), finalBlow: false },
    );
    assert.equal(falseFlagState.finalBlow, undefined);
  });

  it('WP-686: a match whose setupData omits finalBlow serializes with no finalBlow key (byte-identical off, no re-pin)', () => {
    // why: WP-686 / D-24503 — every committed replay/sentinel fixture omits finalBlow
    // from setupData, so its config carries no finalBlow key and neither does G
    // (matchConfiguration = config, and the top-level field is omit-when-off). Both
    // whole-G hash oracles serialize the entire state and JSON.stringify drops absent
    // keys, so such a match is byte-identical to pre-WP-686 — no oracle moves, no
    // re-pin. This is the case that governs the sentinel finalStateHash.
    const absentFlagState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      createMockMatchConfiguration(),
    );
    assert.equal(absentFlagState.finalBlow, undefined);
    assert.ok(
      !JSON.stringify(absentFlagState).includes('"finalBlow"'),
      'A match with no finalBlow in setupData must not serialize a finalBlow key anywhere in G',
    );
  });

  it('WP-802: setup() with isDebugMatch: true stores G.isDebugMatch === true', () => {
    // why: WP-802 / D-24689 — an operator match carries the flag on G for the
    // operator board read, the never-scored refusal and the bot-decision record.
    const gameState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      { ...createMockMatchConfiguration(), isDebugMatch: true },
    );
    assert.equal(gameState.isDebugMatch, true);
  });

  it('WP-802: setup() leaves no isDebugMatch key on G when the flag is absent or false', () => {
    // why: WP-802 / D-24689 — omit-when-off. A key written as false would move
    // PRE_WP080_HASH and every finalStateHash; the keyset proves it is absent.
    const absentFlagState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      createMockMatchConfiguration(),
    );
    const falseFlagState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      { ...createMockMatchConfiguration(), isDebugMatch: false },
    );
    assert.equal(Object.keys(absentFlagState).includes('isDebugMatch'), false);
    assert.equal(Object.keys(falseFlagState).includes('isDebugMatch'), false);
    assert.ok(
      !JSON.stringify(absentFlagState).includes('"isDebugMatch"'),
      'A match with no isDebugMatch in setupData must not serialize an isDebugMatch key anywhere in G',
    );
  });

  it('WP-802: setup() leaves no G.isDebugMatch key for a truthy non-boolean flag', () => {
    // why: WP-802 / D-24689 §1 — only a strict `true` turns an operator match on.
    const truthyFlagState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      { ...createMockMatchConfiguration(), isDebugMatch: 'yes' as unknown as boolean },
    );
    assert.equal(Object.keys(truthyFlagState).includes('isDebugMatch'), false);
  });

  it('WP-805: setup() writes isFirstPlayerRandom: true for 2–5 seats and leaves no key for 1 seat', () => {
    // why: WP-805 / D-24700 — the flag marks a match that draws its opener at play
    // start. Omit-when-off for solo keeps every solo match and solo pin byte-identical.
    for (const numPlayers of [2, 3, 4, 5]) {
      const gameState = LegendaryGame.setup!(
        makeMockCtx({ numPlayers }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
        createMockMatchConfiguration(),
      );
      assert.equal(gameState.isFirstPlayerRandom, true, `a ${numPlayers}-seat match must carry isFirstPlayerRandom: true`);
    }
    const soloState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 1 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      createMockMatchConfiguration(),
    );
    assert.equal(Object.keys(soloState).includes('isFirstPlayerRandom'), false);
    assert.ok(
      !JSON.stringify(soloState).includes('"isFirstPlayerRandom"'),
      'A solo match must not serialize an isFirstPlayerRandom key anywhere in G',
    );
  });

  it('setup() throws when matchConfiguration is not provided', () => {
    const mockContext = makeMockCtx({ numPlayers: 2 });
    assert.throws(
      () => {
        LegendaryGame.setup!(
          mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
          undefined,
        );
      },
      {
        message: /requires a MatchConfiguration argument/,
      },
    );
  });

  it('defines exactly 4 phases: lobby, setup, play, end', () => {
    const phaseNames = Object.keys(LegendaryGame.phases ?? {});
    assert.deepStrictEqual(
      phaseNames.sort(),
      ['end', 'lobby', 'play', 'setup'],
      'LegendaryGame must define exactly 4 phases: lobby, setup, play, end',
    );
  });

  it('defines moves: advanceStage, dodgeCard, drawCards, endMatchEarly, endTurn, exorciseHauntedHero, fightMastermind, fightVillain, healWounds, operatorAddEconomy, operatorEscapeVillain, operatorMoveCard, operatorMoveToDeckTop, operatorRevealNow, operatorSetSupplyCount, phaseCard, playCard, recruitHero, recruitOfficer, recruitSidekick, resolveCopyPowersChoice, resolveCountScaledChoice, resolveCoveringFireChoice, resolveDefeatChoice, resolveDiscardChoice, resolveDiscardToPlay, resolveDoOver, resolveDrawOrEmpowered, resolveElectromagneticBubbleChoice, resolveGiveHqHeroChoice, resolveHeroChoice, resolveKoDiscardChoice, resolveKoHeroChoice, resolveMelterKoChoice, resolveMoveVillainChoice, resolveOptionalKoReward, resolveOptionalPutBottomHQ, resolvePlayVillainTopChoice, resolvePutAnyNumberBottomHQ, resolvePutCardsOnDeckChoice, resolvePutHandOnDeckTop, resolveReorderChoice, resolveReturnOnDiscard, resolveReturnZeroCostDiscard, resolveRevealThreeAssign, resolveRevealTopDispose, resolveRuthlessDictatorChoice, resolveScryKoChoice, resolveSeatChoice, resolveSmashDiscard, resolveSplitFaceChoice, resolveUndercoverChoice, resolveVictoryPileCardPick, and revealVillainCard', () => {
    const moveNames = Object.keys(LegendaryGame.moves ?? {});
    assert.deepStrictEqual(
      moveNames.sort(),
      // why: WP-285 / EC-317 added resolveVictoryPileCardPick (14 → 15); WP-286 / EC-318 added
      // resolveDrawOrEmpowered (15 → 16); the Ionic Energy optional-put-bottom-hq fix added
      // resolveOptionalPutBottomHQ (16 → 17); D-24132 added resolvePutAnyNumberBottomHQ (17 → 18);
      // D-24139 added resolveReturnZeroCostDiscard (18 → 19); WP-379 / D-24179 added healWounds (19 → 20); WP-383 / D-24184 added resolveDiscardToPlay (20 → 21);
      // WP-470 / D-24282 added resolveScryKoChoice (21 → 22) — sorts between resolveReturnZeroCostDiscard and resolveVictoryPileCardPick; NOT a CORE_MOVE_NAME (mirrors resolveKoHeroChoice).
      // WP-476 / D-24284 added resolveDiscardChoice (22 → 23) — sorts between recruitHero and resolveDiscardToPlay; NOT a CORE_MOVE_NAME (mirrors resolveScryKoChoice).
      // WP-479 / D-24286 added resolveReorderChoice (23 → 24) — sorts between resolvePutAnyNumberBottomHQ and resolveReturnZeroCostDiscard; NOT a CORE_MOVE_NAME (mirrors resolveScryKoChoice / resolveDiscardChoice).
      // WP-486 / D-24291 added resolveDefeatChoice (24 → 25) — sorts between recruitHero and resolveDiscardChoice; NOT a CORE_MOVE_NAME (mirrors resolveReorderChoice).
      // WP-498 / D-24301 added resolveReturnOnDiscard (25 → 26) — sorts between resolveReorderChoice and resolveReturnZeroCostDiscard; NOT a CORE_MOVE_NAME (mirrors resolveDefeatChoice).
      // WP-502 / D-24306 added endMatchEarly (26 → 27) — the player-initiated "End Game" control; sorts between drawCards and endTurn; NOT a CORE_MOVE_NAME (mirrors healWounds / the resolve* moves).
      // WP-532 / D-24343 added resolveGiveHqHeroChoice (27 → 28) — the interactive give-HQ-Hero pick (Paibok Fight); sorts between resolveDrawOrEmpowered and resolveHeroChoice; NOT a CORE_MOVE_NAME (mirrors resolveReturnOnDiscard).
      // WP-535 / D-24345 added resolveCopyPowersChoice (28 → 29) — the interactive copy-a-Hero pick (Rogue's Copy Powers); sorts between recruitHero and resolveDefeatChoice; NOT a CORE_MOVE_NAME (mirrors resolveGiveHqHeroChoice).
      // WP-538 / D-24347 added resolvePutCardsOnDeckChoice (29 → 30) — the interactive put-2-on-top pick (core Dr. Doom Master Strike); sorts between resolvePutAnyNumberBottomHQ and resolveReorderChoice; NOT a CORE_MOVE_NAME (mirrors resolveDiscardChoice).
      // WP-603 / D-24413 added resolveMelterKoChoice (30 → 31) — the interactive Melter Fight KO/keep pick; sorts between resolveKoHeroChoice and resolveOptionalKoReward; NOT a CORE_MOVE_NAME (mirrors resolveScryKoChoice).
      // WP-648 / D-24460 added recruitOfficer (31 → 32) — the player-initiated buy of a S.H.I.E.L.D. Officer from the shared supply for 3 recruit; sorts between recruitHero and resolveCopyPowersChoice; NOT a CORE_MOVE_NAME (mirrors recruitHero, internally stage-gated).
      // WP-663 / D-24474 added resolvePlayVillainTopChoice (32 → 33) — the interactive Shadowed Thoughts "play the top Villain-Deck card for +N Attack?" pick; sorts between resolveOptionalPutBottomHQ and resolvePutAnyNumberBottomHQ; NOT a CORE_MOVE_NAME (mirrors resolveOptionalKoReward).
      // WP-675 / D-24490 added resolveCountScaledChoice (33 → 34) — the interactive count-scaled choose-one pick (vnom Symbiotic Adaptation); sorts between resolveCopyPowersChoice and resolveDefeatChoice; NOT a CORE_MOVE_NAME (mirrors resolvePlayVillainTopChoice).
      // WP-676 / D-24492 added resolveSmashDiscard (34 → 35) — the interactive Smash "discard another card from your hand for +N Attack?" pick; sorts between resolveScryKoChoice and resolveVictoryPileCardPick; NOT a CORE_MOVE_NAME (mirrors resolveOptionalKoReward).
      // WP-684 / D-24501 added resolveSeatChoice (35 → 36) — the non-active/multi-seat pending-choice resolve (foundational; no card wired); sorts between resolveScryKoChoice and resolveSmashDiscard; NOT a CORE_MOVE_NAME (mirrors the other resolve* moves).
      // WP-681 / D-24498 added resolveDoOver (36 → 37) — the interactive Do-Over "discard the rest of your hand and draw four cards?" accept/decline pick; sorts between resolveDiscardToPlay and resolveDrawOrEmpowered; NOT a CORE_MOVE_NAME (mirrors resolveSmashDiscard). Battlefield Promotion (optional-ko-shield-officer) reuses resolveOptionalKoReward, so it adds no move.
      // WP-693 / D-24510 added resolveKoDiscardChoice (37 → 38) — the interactive Loki Maniacal Tyrant KO-up-to-four-from-discard pick; sorts between resolveHeroChoice and resolveKoHeroChoice; NOT a CORE_MOVE_NAME (mirrors resolveDefeatChoice / resolvePutCardsOnDeckChoice).
      // WP-695 / D-24512 added resolveRuthlessDictatorChoice (38 → 39) — the interactive Ruthless Dictator scry-3 disposition pick; sorts between resolveReturnZeroCostDiscard and resolveScryKoChoice; NOT a CORE_MOVE_NAME (mirrors resolveMelterKoChoice).
      // WP-695 / D-24512 added resolveElectromagneticBubbleChoice (39 → 40) — the interactive Electromagnetic Bubble X-Men pick; sorts between resolveDrawOrEmpowered and resolveGiveHqHeroChoice; NOT a CORE_MOVE_NAME (mirrors resolveRuthlessDictatorChoice).
      // WP-700 / D-24519 added resolvePutHandOnDeckTop — the interactive put-a-hand-card-on-deck-top pick (Gambit's Stack the Deck + siblings); sorts between resolvePutCardsOnDeckChoice and resolveReorderChoice; NOT a CORE_MOVE_NAME (mirrors resolveSmashDiscard). why: the array actually held 39 entries at HEAD while this message + the prior "(39 → 40)" label already read 40 (a pre-existing off-by-one label); adding this 40th move makes the array 40 and the "exactly 40 moves" message correct.
      // WP-702 / D-24521 added resolveRevealTopDispose (40 → 41) — the interactive reveal-top discard-or-keep pick (Gambit's Hypnotic Charm + standalone family); ONE shared move for both reveal-top-dispose keywords; sorts between resolveReturnZeroCostDiscard and resolveRuthlessDictatorChoice; NOT a CORE_MOVE_NAME (mirrors resolveMelterKoChoice).
      // WP-719 / D-24541 added resolveCoveringFireChoice (41 → 42) — the interactive Covering Fire choose-one pick (Hawkeye, both printings); sorts between resolveCountScaledChoice and resolveDefeatChoice; NOT a CORE_MOVE_NAME (mirrors resolveDrawOrEmpowered).
      // WP-724 / D-24546 added resolveSplitFaceChoice (42 → 43) — the interactive split / dual-faced hero "choose a side" pick (un-defers D-14101; 39 split cards across 5 sets); sorts between resolveSmashDiscard and resolveUndercoverChoice; NOT a CORE_MOVE_NAME (mirrors resolveCoveringFireChoice).
      // WP-757 / D-24587 added exorciseHauntedHero (44 → 45) — the Haunt exorcise (pay a Haunted Hero's cost, KO or give it, release the haunter); sorts between endTurn and fightMastermind; NOT a CORE_MOVE_NAME (mirrors recruitHero, internally stage-gated).
      // WP-753 / D-24580 added resolveRevealThreeAssign (43 → 44) — the interactive reveal-three draw / discard / KO assignment (Crystal of Kadavus, Interplanetary Visitor); sorts between resolveReturnZeroCostDiscard and resolveRevealTopDispose; NOT a CORE_MOVE_NAME (mirrors resolveRuthlessDictatorChoice).
      // WP-783 / D-24629 added phaseCard (45 → 46) — the Phasing hand swap (swap a Phasing card in hand with the top card of the deck); sorts between healWounds and playCard; NOT a CORE_MOVE_NAME (mirrors dodgeCard, internally stage-gated).
      // WP-795 / D-24664 added resolveMoveVillainChoice (46 → 47) — the interactive Spinning Cyclone move-a-Villain pick (core Storm); sorts between resolveMelterKoChoice and resolveOptionalKoReward; NOT a CORE_MOVE_NAME (mirrors resolveCoveringFireChoice). The test title also gains the stale-missing resolveCoveringFireChoice, resolveRevealTopDispose and resolveSplitFaceChoice.
      // WP-806 / D-24713 added the six operator setters (47 → 53) — operatorAddEconomy, operatorEscapeVillain, operatorMoveCard, operatorMoveToDeckTop, operatorRevealNow and operatorSetSupplyCount, operator-match-only; they sort between healWounds and phaseCard; NOT CORE_MOVE_NAMEs and absent from bot / simulation / fixture dispatch (mirrors phaseCard / endMatchEarly).
      // WP-842 / D-24776 added recruitSidekick (53 → 54) — the player-initiated once-per-turn buy of a Sidekick from the Sidekick Stack for 2 recruit; sorts between recruitOfficer and resolveCopyPowersChoice; NOT a CORE_MOVE_NAME and absent from SIMULATION_MOVE_NAMES (mirrors recruitOfficer, internally stage-gated).
      ['advanceStage', 'dodgeCard', 'drawCards', 'endMatchEarly', 'endTurn', 'exorciseHauntedHero', 'fightMastermind', 'fightVillain', 'healWounds', 'operatorAddEconomy', 'operatorEscapeVillain', 'operatorMoveCard', 'operatorMoveToDeckTop', 'operatorRevealNow', 'operatorSetSupplyCount', 'phaseCard', 'playCard', 'recruitHero', 'recruitOfficer', 'recruitSidekick', 'resolveCopyPowersChoice', 'resolveCountScaledChoice', 'resolveCoveringFireChoice', 'resolveDefeatChoice', 'resolveDiscardChoice', 'resolveDiscardToPlay', 'resolveDoOver', 'resolveDrawOrEmpowered', 'resolveElectromagneticBubbleChoice', 'resolveGiveHqHeroChoice', 'resolveHeroChoice', 'resolveKoDiscardChoice', 'resolveKoHeroChoice', 'resolveMelterKoChoice', 'resolveMoveVillainChoice', 'resolveOptionalKoReward', 'resolveOptionalPutBottomHQ', 'resolvePlayVillainTopChoice', 'resolvePutAnyNumberBottomHQ', 'resolvePutCardsOnDeckChoice', 'resolvePutHandOnDeckTop', 'resolveReorderChoice', 'resolveReturnOnDiscard', 'resolveReturnZeroCostDiscard', 'resolveRevealThreeAssign', 'resolveRevealTopDispose', 'resolveRuthlessDictatorChoice', 'resolveScryKoChoice', 'resolveSeatChoice', 'resolveSmashDiscard', 'resolveSplitFaceChoice', 'resolveUndercoverChoice', 'resolveVictoryPileCardPick', 'revealVillainCard'],
      'LegendaryGame must define exactly 54 moves',
    );
  });

  it('configures lobby phase with activePlayers: { all: "lobbyReady" } + matching stages block per D-10007', () => {
    // why: drift-detection lock for the WP-100 fix-forward (D-10007). Without
    // this config, boardgame.io rejects setPlayerReady / startMatchIfReady
    // from any player other than ctx.currentPlayer with "player not active",
    // making lobby ready-up impossible for player 1+. The stage-name approach
    // (`{ all: 'lobbyReady' }` + empty `stages.lobbyReady: {}`) is the
    // type-clean equivalent of boardgame.io's ActivePlayers.ALL constant
    // (which uses `{ all: Stage.NULL }` where Stage.NULL: null at runtime,
    // but is typed as `any` in turn-order.d.ts). The bare-null literal is
    // rejected by `StageArg = StageName | object`; the named empty stage
    // satisfies the type without changing runtime semantics.
    const phases = LegendaryGame.phases as
      | Record<
          string,
          {
            turn?: {
              activePlayers?: unknown;
              stages?: Record<string, unknown>;
            };
          }
        >
      | undefined;
    const lobbyPhase = phases?.lobby;
    assert.notEqual(
      lobbyPhase,
      undefined,
      'lobby phase must be configured on LegendaryGame',
    );
    assert.deepStrictEqual(
      lobbyPhase?.turn?.activePlayers,
      { all: 'lobbyReady' },
      'lobby phase turn.activePlayers must be { all: "lobbyReady" } per D-10007 — without it, only the turn-holder can submit setPlayerReady/startMatchIfReady',
    );
    assert.deepStrictEqual(
      lobbyPhase?.turn?.stages,
      { lobbyReady: {} },
      'lobby phase turn.stages.lobbyReady must exist (empty config) per D-10007 — required by boardgame.io to validate the activePlayers stage reference',
    );
  });

  it('play-phase onBegin does NOT draw (hand/deck untouched) and sets hasDrawnThisTurn true (WP-701 / D-24520)', () => {
    // why: WP-701 / D-24520 — the start-of-turn auto-draw is RETIRED. Setup deals
    // each seat's opening hand and the new hand is drawn at the END of the previous
    // turn (applyEndOfTurnCleanup), so onBegin only resets per-turn flags: it leaves
    // the hand/deck untouched and sets hasDrawnThisTurn true (the incoming seat
    // already holds its hand, so the scaffold drawCards move stays a guarded no-op).
    // The end-of-turn draw itself is covered in moves/endOfTurnCleanup.logic.test.ts.
    const mockConfiguration = createMockMatchConfiguration();
    const mockContext = makeMockCtx({ numPlayers: 2 });
    const gameState = LegendaryGame.setup!(
      mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      mockConfiguration,
    );

    // The active player already holds a hand dealt at setup (no longer empty).
    assert.equal(gameState.playerZones['0']!.hand.length, HAND_SIZE, 'setup deals the opening hand');
    const handBefore = [...gameState.playerZones['0']!.hand];
    const deckBefore = [...gameState.playerZones['0']!.deck];

    const playPhase = (
      LegendaryGame.phases as Record<
        string,
        { turn?: { onBegin?: (context: unknown) => void } }
      >
    ).play;
    const onBegin = playPhase?.turn?.onBegin;
    assert.notEqual(onBegin, undefined, 'play phase must define a turn.onBegin hook');

    onBegin!({
      G: gameState,
      ctx: { currentPlayer: '0', numPlayers: 2, phase: 'play', turn: 1 },
      random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
      events: { setPhase: (): void => {}, endTurn: (): void => {} },
    } satisfies {
      G: LegendaryGameState;
      ctx: { currentPlayer: string; numPlayers: number; phase: string; turn: number };
      random: { Shuffle: <T>(deck: T[]) => T[] };
      events: { setPhase: () => void; endTurn: () => void };
    });

    assert.deepEqual(
      gameState.playerZones['0']!.hand,
      handBefore,
      'onBegin must NOT draw — the hand is unchanged',
    );
    assert.deepEqual(
      gameState.playerZones['0']!.deck,
      deckBefore,
      'onBegin must NOT touch the deck',
    );
    assert.equal(gameState.hasDrawnThisTurn, true);
  });

  it('play-phase onBegin does NOT draw or reshuffle even with an empty deck and stocked discard (WP-701 / D-24520)', () => {
    // why: WP-701 / D-24520 — the reshuffle-on-exhaustion draw moved to end-of-turn
    // (applyEndOfTurnCleanup), so onBegin no longer draws OR reshuffles. Force what
    // used to be the reshuffle path — empty deck, stocked discard, empty hand — and
    // assert onBegin leaves the zones untouched and pushes NO deckReshuffled event.
    // The end-of-turn reshuffle + event is covered in moves/endOfTurnCleanup.logic.test.ts.
    const gameState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      createMockMatchConfiguration(),
    );
    gameState.playerZones['0']!.hand = [];
    gameState.playerZones['0']!.deck = [];
    gameState.playerZones['0']!.discard = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'];
    gameState.notableEvents = [];

    const onBegin = (
      LegendaryGame.phases as Record<
        string,
        { turn?: { onBegin?: (context: unknown) => void } }
      >
    ).play?.turn?.onBegin;
    onBegin!({
      G: gameState,
      ctx: { currentPlayer: '0', numPlayers: 2, phase: 'play', turn: 3 },
      random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
      events: { setPhase: (): void => {}, endTurn: (): void => {} },
    });

    // No draw: the empty hand stays empty; deck/discard untouched.
    assert.equal(gameState.playerZones['0']!.hand.length, 0, 'onBegin must NOT draw');
    assert.deepEqual(gameState.playerZones['0']!.deck, []);
    assert.deepEqual(gameState.playerZones['0']!.discard, ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7']);
    // No reshuffle event pushed.
    assert.equal(
      gameState.notableEvents.filter((event) => event.type === 'deckReshuffled').length,
      0,
      'onBegin must push NO deckReshuffled event',
    );
  });

  it('play-phase onBegin does NOT draw from a full deck and pushes no deckReshuffled (WP-701 / D-24520)', () => {
    // why: WP-701 / D-24520 — companion to the empty-deck case: even with a full
    // starting deck, onBegin never draws (the fill is at end-of-turn now), so the
    // hand/deck are unchanged and no deckReshuffled event is pushed.
    const gameState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      createMockMatchConfiguration(),
    );
    gameState.notableEvents = [];
    // why: setup deals the opening hand, leaving deck == HAND_SIZE; install a larger
    // deck so the scenario is unambiguously "a deck that could feed a draw with room
    // to spare" — and prove onBegin still does not draw from it.
    gameState.playerZones['0']!.hand = [];
    gameState.playerZones['0']!.deck = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'];
    assert.ok(gameState.playerZones['0']!.deck.length > HAND_SIZE, 'deck feeds a draw with room to spare');
    const handBefore = [...gameState.playerZones['0']!.hand];
    const deckBefore = [...gameState.playerZones['0']!.deck];

    const onBegin = (
      LegendaryGame.phases as Record<
        string,
        { turn?: { onBegin?: (context: unknown) => void } }
      >
    ).play?.turn?.onBegin;
    onBegin!({
      G: gameState,
      ctx: { currentPlayer: '0', numPlayers: 2, phase: 'play', turn: 1 },
      random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
      events: { setPhase: (): void => {}, endTurn: (): void => {} },
    });

    assert.deepEqual(gameState.playerZones['0']!.hand, handBefore, 'onBegin must NOT draw from a full deck');
    assert.deepEqual(gameState.playerZones['0']!.deck, deckBefore, 'the deck is untouched');
    assert.equal(
      gameState.notableEvents.filter((event) => event.type === 'deckReshuffled').length,
      0,
    );
  });

  it('play-phase onBegin does NOT consume a handSizeOverride or fill to it (WP-701 / D-24520)', () => {
    // why: WP-701 / D-24520 — the handSizeOverride consume (a defeated Doc Ock "Octet
    // of Valence Electrons" tactic records G.handSizeOverrides[player] = 8) moved from
    // onBegin to the end-of-turn cleanup, since that is where the draw now happens. So
    // onBegin leaves the override in place (it is consumed at the player's NEXT
    // end-of-turn) and does not fill the hand to it. The fill-to-8-and-consume behavior
    // is covered in moves/endOfTurnCleanup.logic.test.ts.
    const gameState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      createMockMatchConfiguration(),
    );

    const playPhase = (
      LegendaryGame.phases as Record<string, { turn?: { onBegin?: (context: unknown) => void } }>
    ).play;
    const onBegin = playPhase!.turn!.onBegin!;
    const beginContext = {
      G: gameState,
      ctx: { currentPlayer: '0', numPlayers: 2, phase: 'play', turn: 1 },
      random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
      events: { setPhase: (): void => {}, endTurn: (): void => {} },
    };

    // Install a known hand and a pending override, then run onBegin.
    gameState.playerZones['0']!.hand = ['keep1', 'keep2'];
    gameState.handSizeOverrides = { '0': 8 };
    onBegin(beginContext);

    // onBegin does not draw, so the hand is unchanged (not filled to 8)...
    assert.deepEqual(gameState.playerZones['0']!.hand, ['keep1', 'keep2'], 'onBegin does not fill to the override');
    // ...and the override survives onBegin (it is consumed at end-of-turn cleanup).
    assert.equal(gameState.handSizeOverrides['0'], 8, 'the override is NOT consumed by onBegin');
  });

  it('play-phase onBegin numbers the first play turn as 1, not the framework ctx.turn (lobby offset)', () => {
    // why: the lobby phase consumes framework turn 1 (startMatchIfReady exits via
    // setPhase('play')), so the play phase's first turn arrives as ctx.turn === 2.
    // The player-facing turn (G.logMeta.turn, read by both the game-log prefix and
    // the HUD header) must be play-relative: first play turn = 1. This guards the
    // off-by-one that opened the log at "2.1.1".
    const gameState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      createMockMatchConfiguration(),
    );
    const playPhase = (
      LegendaryGame.phases as Record<
        string,
        { turn?: { onBegin?: (context: unknown) => void } }
      >
    ).play;
    const onBegin = playPhase!.turn!.onBegin!;
    const makeContext = (turn: number): unknown => ({
      G: gameState,
      ctx: { currentPlayer: '0', numPlayers: 2, phase: 'play', turn },
      random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
      events: { setPhase: (): void => {}, endTurn: (): void => {} },
    });

    // First play turn: framework ctx.turn === 2 (lobby was turn 1) must render as 1.
    onBegin(makeContext(2));
    assert.equal(
      gameState.logMeta!.turn,
      1,
      'first play turn must be play-relative 1, not the framework ctx.turn (2)',
    );
    assert.equal(gameState.logMeta!.firstPlayTurn, 2, 'firstPlayTurn captures the first play framework turn');

    // Second play turn: framework ctx.turn === 3 must render as 2 (offset preserved).
    onBegin(makeContext(3));
    assert.equal(
      gameState.logMeta!.turn,
      2,
      'second play turn must be play-relative 2 (firstPlayTurn offset carried forward)',
    );
    assert.equal(gameState.logMeta!.firstPlayTurn, 2, 'firstPlayTurn is stable across turns');
  });

  it('play-phase onMove wires the pile-depletion loss check — an empty hero deck for Civil War sets SCHEME_LOSS (WP-510 / D-24318, AC-6)', () => {
    // why: proves the WIRING, not just the helper — reverting the
    // applyPileDepletionResourceLoss(G) call in game.ts turn.onMove must make this
    // fail (non-vacuous control). A Super Hero Civil War state whose hero deck is
    // empty must latch SCHEME_LOSS the moment onMove runs.
    const playPhase = (
      LegendaryGame.phases as Record<
        string,
        { turn?: { onMove?: (context: unknown) => void } }
      >
    ).play;
    const onMove = playPhase?.turn?.onMove;
    assert.notEqual(onMove, undefined, 'play phase must define a turn.onMove hook');

    const gameState = {
      selection: {
        schemeId: 'core/super-hero-civil-war',
        mastermindId: 'test-mastermind',
        villainGroupIds: [],
        henchmanGroupIds: [],
        heroDeckIds: [],
      },
      counters: {},
      villainDeck: { deck: ['v-1'], discard: [] },
      heroDeck: [],
      messages: [],
    } as unknown as LegendaryGameState;

    onMove!({ G: gameState });

    assert.equal(
      gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS],
      1,
      'onMove must run the pile-depletion check and set SCHEME_LOSS on an empty hero deck',
    );
    assert.equal(
      evaluateEndgame(gameState)?.outcome,
      'scheme-wins',
      'the wired loss must resolve to scheme-wins',
    );
  });

  it('play-phase onMove wires the deferred-grant re-check — a waiting numeric-threshold ability fires once the threshold is reached (WP-568 / D-24377)', () => {
    // why: pins the WIRE, not the helper. The helper has its own suite; this test
    // exists because removing the resolveDeferredHeroGrants(G, ...) call from
    // game.ts turn.onMove would otherwise leave every test green while the feature
    // shipped 100% dead — the WP-560 failure mode. Reverting that call MUST fail
    // this test (verified by mutation at execution).
    const playPhase = (
      LegendaryGame.phases as Record<
        string,
        { turn?: { onMove?: (context: unknown) => void } }
      >
    ).play;
    const onMove = playPhase?.turn?.onMove;
    assert.notEqual(onMove, undefined, 'play phase must define a turn.onMove hook');

    const gameState = {
      messages: [],
      turnEconomy: { attack: 0, recruit: 9, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
      playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: ['hero-x'], victory: [] } },
      cardTraits: {},
      cardDisplayData: {},
      villainDeck: { deck: ['v-1'], discard: [] },
      heroDeck: ['h-1'],
      counters: {},
      selection: {
        schemeId: 'core/portals-to-the-dark-dimension',
        mastermindId: 'test-mastermind',
        villainGroupIds: [],
        henchmanGroupIds: [],
        heroDeckIds: [],
      },
      heroAbilityHooks: [
        {
          cardId: 'hero-x',
          timing: 'onPlay',
          keywords: ['attack'],
          conditions: [{ type: 'recruitMadeThisTurnAtLeast', value: '8' }],
          effects: [{ type: 'attack', magnitude: 3 }],
        },
      ],
      // why: a grant recorded at play time, when recruit was below 8. The turn's
      // recruit has since reached 9, so the per-move re-check must fire it.
      deferredConditionalGrants: [{ playerId: '0', cardId: 'hero-x', hookIndex: 0 }],
    } as unknown as LegendaryGameState;

    onMove!({ G: gameState, ctx: { turn: 1, currentPlayer: '0' }, random: { Shuffle: (items: unknown[]) => items } });

    assert.equal(
      gameState.turnEconomy.attack,
      3,
      'onMove must run the deferred-grant re-check and apply the waiting +3 attack',
    );
    assert.equal(
      gameState.deferredConditionalGrants,
      undefined,
      'the fired entry must be consumed, so it cannot grant twice',
    );
  });

  it('play-phase onBegin wires the deferred-grant turn-boundary clear (WP-568 / D-24377)', () => {
    // why: also pins a WIRE. A grant surviving into the next turn would re-evaluate
    // against a fresh G.turnEconomy and could fire for the wrong turn; removing the
    // clearDeferredConditionalGrants(G) call from onBegin must fail this test.
    const playPhase = (
      LegendaryGame.phases as Record<
        string,
        { turn?: { onBegin?: (context: unknown) => void } }
      >
    ).play;
    const onBegin = playPhase?.turn?.onBegin;
    assert.notEqual(onBegin, undefined, 'play phase must define a turn.onBegin hook');

    const gameState = {
      messages: [],
      turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
      playerZones: { '0': { deck: ['a', 'b', 'c', 'd', 'e', 'f'], hand: [], discard: [], inPlay: [], victory: [] } },
      villainDeck: { deck: ['v-1'], discard: [] },
      heroDeck: ['h-1'],
      counters: {},
      hq: [null, null, null, null, null],
      city: [null, null, null, null, null],
      scheme: { twistPile: [] },
      mastermind: { id: 'm', baseCardId: 'm-base', tacticsDeck: [], tacticsDefeated: [], strikePile: [], attachedBystanders: [] },
      hookRegistry: [],
      heroAbilityHooks: [],
      villainDeckCardTypes: {},
      attachedBystanders: {},
      escapedPile: [],
      cardStats: {},
      deferredConditionalGrants: [{ playerId: '0', cardId: 'hero-x', hookIndex: 0 }],
    } as unknown as LegendaryGameState;

    onBegin!({
      G: gameState,
      ctx: { turn: 2, currentPlayer: '0', numPlayers: 1 },
      random: { Shuffle: (items: unknown[]) => items },
      events: { setPhase: () => {}, endTurn: () => {} },
    });

    assert.equal(
      gameState.deferredConditionalGrants,
      undefined,
      'onBegin must clear deferred grants at the turn boundary',
    );
  });

  it('play-phase onMove fires a waiting owned-KO grant once per counted KO and consumes the count (WP-853 / D-24789)', () => {
    // why: pins the WIRE. Absorb Energies only works if game.ts turn.onMove runs the
    // resolve that fires per counted KO, re-arms the grant and deletes the count; a mocked
    // resolve would leave every helper test green with the trigger dead in a real match.
    const onMove = (
      LegendaryGame.phases as Record<string, { turn?: { onMove?: (context: unknown) => void } }>
    ).play?.turn?.onMove;
    assert.notEqual(onMove, undefined, 'play phase must define a turn.onMove hook');

    const gameState = {
      messages: [],
      turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
      playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: ['hero-absorb'], victory: [] } },
      cardTraits: {},
      cardDisplayData: {},
      villainDeck: { deck: ['v-1'], discard: [] },
      heroDeck: ['h-1'],
      counters: {},
      selection: {
        schemeId: 'core/portals-to-the-dark-dimension',
        mastermindId: 'test-mastermind',
        villainGroupIds: [],
        henchmanGroupIds: [],
        heroDeckIds: [],
      },
      heroAbilityHooks: [
        {
          cardId: 'hero-absorb',
          timing: 'onPlay',
          keywords: ['recruit'],
          conditions: [{ type: 'ownedCardKoedThisTurn', value: '1' }],
          effects: [{ type: 'recruit', magnitude: 2 }],
        },
      ],
      deferredConditionalGrants: [{ playerId: '0', cardId: 'hero-absorb', hookIndex: 0 }],
      // why: two of player 0's cards were KO'd this move, one of player 1's.
      ownedCardsKoedSinceResolve: { '0': 2, '1': 1 },
    } as unknown as LegendaryGameState;
    const context = { G: gameState, ctx: { turn: 1, currentPlayer: '0' }, random: { Shuffle: (items: unknown[]) => items } };

    onMove!(context);

    assert.equal(gameState.turnEconomy.recruit, 4, 'two counted KOs must grant +2 twice');
    assert.equal('ownedCardsKoedSinceResolve' in gameState, false, 'the count is consumed by the resolve');
    assert.deepEqual(
      gameState.deferredConditionalGrants,
      [{ playerId: '0', cardId: 'hero-absorb', hookIndex: 0 }],
      'the fired grant re-arms for the next KO',
    );

    onMove!(context);
    assert.equal(gameState.turnEconomy.recruit, 4, 'a move with no KO grants nothing');
  });

  it('play-phase onBegin deletes the owned-KO count, and never creates it (WP-853 / D-24789)', () => {
    const onBegin = (
      LegendaryGame.phases as Record<string, { turn?: { onBegin?: (context: unknown) => void } }>
    ).play?.turn?.onBegin;
    assert.notEqual(onBegin, undefined, 'play phase must define a turn.onBegin hook');

    /** A minimal play-phase G, with or without an owned-KO count. */
    function makeTurnStartState(withCount: boolean): LegendaryGameState {
      const state = {
        messages: [],
        turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
        playerZones: { '0': { deck: ['a', 'b', 'c', 'd', 'e', 'f'], hand: [], discard: [], inPlay: [], victory: [] } },
        villainDeck: { deck: ['v-1'], discard: [] },
        heroDeck: ['h-1'],
        counters: {},
        hq: [null, null, null, null, null],
        city: [null, null, null, null, null],
        scheme: { twistPile: [] },
        mastermind: { id: 'm', baseCardId: 'm-base', tacticsDeck: [], tacticsDefeated: [], strikePile: [], attachedBystanders: [] },
        hookRegistry: [],
        heroAbilityHooks: [],
        villainDeckCardTypes: {},
        attachedBystanders: {},
        escapedPile: [],
        cardStats: {},
      } as unknown as LegendaryGameState;
      if (withCount) {
        state.ownedCardsKoedSinceResolve = { '0': 1 };
      }
      return state;
    }
    const context = (G: LegendaryGameState) => ({
      G,
      ctx: { turn: 2, currentPlayer: '0', numPlayers: 1 },
      random: { Shuffle: (items: unknown[]) => items },
      events: { setPhase: () => {}, endTurn: () => {} },
    });

    const counted = makeTurnStartState(true);
    onBegin!(context(counted));
    assert.equal('ownedCardsKoedSinceResolve' in counted, false, 'the count is deleted at the turn boundary');

    const neverCounted = makeTurnStartState(false);
    onBegin!(context(neverCounted));
    assert.equal('ownedCardsKoedSinceResolve' in neverCounted, false, 'no key is created on a G that never had one');
  });

  it('play-phase onMove fires a waiting Hero-KO grant ONCE, does not re-arm it, and consumes the count (WP-856 / D-24792)', () => {
    // why: pins the WIRE for Possessed by Brother's Spirit: the real turn.onMove resolve must
    // park exactly one choose-one however many Heroes were KO'd, drop the grant (the first
    // time only) and delete the count.
    const onMove = (
      LegendaryGame.phases as Record<string, { turn?: { onMove?: (context: unknown) => void } }>
    ).play?.turn?.onMove;
    assert.notEqual(onMove, undefined, 'play phase must define a turn.onMove hook');

    const gameState = {
      messages: [],
      turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
      playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: ['hero-possessed'], victory: [] } },
      cardTraits: {},
      cardDisplayData: {},
      villainDeck: { deck: ['v-1'], discard: [] },
      heroDeck: ['h-1'],
      counters: {},
      selection: {
        schemeId: 'core/portals-to-the-dark-dimension',
        mastermindId: 'test-mastermind',
        villainGroupIds: [],
        henchmanGroupIds: [],
        heroDeckIds: [],
      },
      heroAbilityHooks: [
        {
          cardId: 'hero-possessed',
          timing: 'onPlay',
          keywords: ['count-scaled-choose', 'conditional'],
          conditions: [{ type: 'ownedHeroKoedThisTurn', value: '1' }],
          effects: [{
            type: 'count-scaled-choose',
            countScaledChoiceOptions: [{ kind: 'flat-recruit', magnitude: 4 }, { kind: 'flat-attack', magnitude: 4 }],
          }],
        },
      ],
      deferredConditionalGrants: [{ playerId: '0', cardId: 'hero-possessed', hookIndex: 0 }],
      // why: three of player 0's Heroes were KO'd this move.
      ownedHeroesKoedSinceResolve: { '0': 3 },
    } as unknown as LegendaryGameState;
    const context = { G: gameState, ctx: { turn: 1, currentPlayer: '0' }, random: { Shuffle: (items: unknown[]) => items } };

    onMove!(context);

    assert.equal(gameState.pendingCountScaledChoice?.length, 1, 'three Hero KOs park ONE choice');
    assert.deepEqual(gameState.pendingCountScaledChoice![0]!.options, [
      { kind: 'flat-recruit', magnitude: 4 },
      { kind: 'flat-attack', magnitude: 4 },
    ]);
    assert.equal('ownedHeroesKoedSinceResolve' in gameState, false, 'the count is consumed by the resolve');
    assert.equal((gameState.deferredConditionalGrants ?? []).length, 0, 'the grant is not re-armed (first time only)');

    gameState.ownedHeroesKoedSinceResolve = { '0': 1 };
    onMove!(context);
    assert.equal(gameState.pendingCountScaledChoice?.length, 1, 'a later Hero KO parks nothing more');
  });

  it('play-phase onBegin deletes the Hero-KO count, and never creates it (WP-856 / D-24792)', () => {
    const onBegin = (
      LegendaryGame.phases as Record<string, { turn?: { onBegin?: (context: unknown) => void } }>
    ).play?.turn?.onBegin;
    assert.notEqual(onBegin, undefined, 'play phase must define a turn.onBegin hook');

    /** A minimal play-phase G, with or without a Hero-KO count. */
    function makeTurnStartState(withCount: boolean): LegendaryGameState {
      const state = {
        messages: [],
        turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
        playerZones: { '0': { deck: ['a', 'b', 'c', 'd', 'e', 'f'], hand: [], discard: [], inPlay: [], victory: [] } },
        villainDeck: { deck: ['v-1'], discard: [] },
        heroDeck: ['h-1'],
        counters: {},
        hq: [null, null, null, null, null],
        city: [null, null, null, null, null],
        scheme: { twistPile: [] },
        mastermind: { id: 'm', baseCardId: 'm-base', tacticsDeck: [], tacticsDefeated: [], strikePile: [], attachedBystanders: [] },
        hookRegistry: [],
        heroAbilityHooks: [],
        villainDeckCardTypes: {},
        attachedBystanders: {},
        escapedPile: [],
        cardStats: {},
      } as unknown as LegendaryGameState;
      if (withCount) {
        state.ownedHeroesKoedSinceResolve = { '0': 1 };
      }
      return state;
    }
    const context = (G: LegendaryGameState) => ({
      G,
      ctx: { turn: 2, currentPlayer: '0', numPlayers: 1 },
      random: { Shuffle: (items: unknown[]) => items },
      events: { setPhase: () => {}, endTurn: () => {} },
    });

    const counted = makeTurnStartState(true);
    onBegin!(context(counted));
    assert.equal('ownedHeroesKoedSinceResolve' in counted, false, 'the count is deleted at the turn boundary');

    const neverCounted = makeTurnStartState(false);
    onBegin!(context(neverCounted));
    assert.equal('ownedHeroesKoedSinceResolve' in neverCounted, false, 'no key is created on a G that never had one');
  });

  it('play-phase onBegin deletes the per-turn discard count, and never creates it (WP-777 / D-24616)', () => {
    // why: pins a WIRE plus oracle safety. A count surviving into the next turn would let New
    // Wings / Pumpkin Bombs fire with no discard (the over-credit WP-777 removes), and a key
    // created on a G that never had one would move the sentinel hash oracles.
    const onBegin = (
      LegendaryGame.phases as Record<string, { turn?: { onBegin?: (context: unknown) => void } }>
    ).play?.turn?.onBegin;
    assert.notEqual(onBegin, undefined, 'play phase must define a turn.onBegin hook');

    /** A minimal play-phase G, with or without a discard count. */
    function makeTurnStartState(withCount: boolean): LegendaryGameState {
      const state = {
        messages: [],
        turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
        playerZones: { '0': { deck: ['a', 'b', 'c', 'd', 'e', 'f'], hand: [], discard: [], inPlay: [], victory: [] } },
        villainDeck: { deck: ['v-1'], discard: [] },
        heroDeck: ['h-1'],
        counters: {},
        hq: [null, null, null, null, null],
        city: [null, null, null, null, null],
        scheme: { twistPile: [] },
        mastermind: { id: 'm', baseCardId: 'm-base', tacticsDeck: [], tacticsDefeated: [], strikePile: [], attachedBystanders: [] },
        hookRegistry: [],
        heroAbilityHooks: [],
        villainDeckCardTypes: {},
        attachedBystanders: {},
        escapedPile: [],
        cardStats: {},
      } as unknown as LegendaryGameState;
      if (withCount) {
        state.cardsDiscardedThisTurn = { '0': 2, '1': 1 };
      }
      return state;
    }
    const context = (G: LegendaryGameState) => ({
      G,
      ctx: { turn: 2, currentPlayer: '0', numPlayers: 1 },
      random: { Shuffle: (items: unknown[]) => items },
      events: { setPhase: () => {}, endTurn: () => {} },
    });

    const counted = makeTurnStartState(true);
    onBegin!(context(counted));
    assert.equal('cardsDiscardedThisTurn' in counted, false, 'the count is deleted at the turn boundary');

    const neverCounted = makeTurnStartState(false);
    onBegin!(context(neverCounted));
    assert.equal('cardsDiscardedThisTurn' in neverCounted, false, 'no key is created on a G that never had one');
  });

  it('defines a TOP-LEVEL endIf that returns the evaluateEndgame result for a terminal G and undefined for a mid-game G (WP-411 / D-24223 — AC-1)', () => {
    // why: AC-1 — the fix is a TOP-LEVEL LegendaryGame.endIf (sibling of
    // moves/phases), NOT a phase endIf. Only a top-level endIf sets
    // ctx.gameover. This unit-asserts the endIf's pure return contract; the
    // AC-3 test below proves the framework wiring turns that return into
    // ctx.gameover.
    const endIf = LegendaryGame.endIf;
    assert.notEqual(
      endIf,
      undefined,
      'LegendaryGame must define a top-level endIf (the only endIf that sets ctx.gameover)',
    );

    // why: the endIf must NOT be duplicated on the play phase — a phase endIf
    // only ends the phase and re-introduces the bug (D-24223). Guard the removal.
    const playPhase = (
      LegendaryGame.phases as Record<string, { endIf?: unknown }>
    ).play;
    assert.equal(
      playPhase?.endIf,
      undefined,
      'the play-phase endIf must be removed — a phase endIf never sets ctx.gameover (D-24223)',
    );

    // Terminal G: mastermind defeated → evaluateEndgame returns a heroes-win
    // result, and the endIf must return exactly that.
    const terminalState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      createMockMatchConfiguration(),
    );
    terminalState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] = 1;
    const expected = evaluateEndgame(terminalState);
    assert.notEqual(expected, null, 'a terminal counter must make evaluateEndgame non-null');
    assert.deepStrictEqual(
      endIf!({ G: terminalState } as Parameters<NonNullable<typeof LegendaryGame.endIf>>[0]),
      expected,
      'endIf must return the evaluateEndgame result verbatim for a terminal G',
    );

    // Mid-game G: no terminal counter → evaluateEndgame is null → endIf returns
    // undefined (the game continues; the framework leaves ctx.gameover unset).
    const midGameState = LegendaryGame.setup!(
      makeMockCtx({ numPlayers: 2 }) as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      createMockMatchConfiguration(),
    );
    assert.equal(
      evaluateEndgame(midGameState),
      null,
      'a fresh setup G must be mid-game (evaluateEndgame null)',
    );
    assert.equal(
      endIf!({ G: midGameState } as Parameters<NonNullable<typeof LegendaryGame.endIf>>[0]),
      undefined,
      'endIf must return undefined for a mid-game G',
    );
  });

  it('the top-level endIf sets ctx.gameover through boardgame.io when a match reaches a terminal condition (WP-411 / D-24223 — AC-3 wiring)', () => {
    // why: AC-3 — the bug hid because tests asserted evaluateEndgame(G) directly
    // but NEVER that the boardgame.io wiring turns that into ctx.gameover. This
    // drives a REAL match through boardgame.io's own reducer (InitializeGame →
    // lobby ready-up → startMatchIfReady → play), confirms ctx.gameover is unset
    // mid-game, then reaches a terminal condition (mastermind defeated) and
    // asserts the framework sets ctx.gameover to the evaluateEndgame result.
    // Reaching a natural mastermind defeat would require hundreds of card-data-
    // dependent moves; instead the terminal counter is injected into G and one
    // more move is dispatched so the framework runs the top-level endIf against
    // the terminal G — the exact code path the missing endIf left dead. On the
    // pre-fix code this move left ctx.gameover undefined (verified this session).
    const setupData: MatchConfiguration = createMockMatchConfiguration();
    const initialState = InitializeGame({
      game: LegendaryGame,
      numPlayers: 2,
      setupData,
    });
    const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });

    const makeMove = (
      state: unknown,
      moveName: string,
      args: unknown[],
      playerID: string,
    ): { G: unknown; ctx: { currentPlayer: unknown; gameover?: unknown } } =>
      reducer(state, {
        // why: boardgame.io dispatches a move as
        // { type: 'MAKE_MOVE', payload: { type: <moveName>, args, playerID } }
        // in the locked 0.50.x — the internal.js entry does not re-export the
        // constant, so the stable literal is used directly.
        type: 'MAKE_MOVE',
        payload: { type: moveName, args, playerID },
      });

    // Drive lobby → play: both seats ready, then start.
    let state = makeMove(initialState, 'setPlayerReady', [{ ready: true }], '0');
    state = makeMove(state, 'setPlayerReady', [{ ready: true }], '1');
    state = makeMove(state, 'startMatchIfReady', [], '0');

    assert.equal(
      state.ctx.gameover,
      undefined,
      'a mid-game match must not have ctx.gameover set',
    );

    // why: inject a terminal condition (mastermind defeated) into G — the state
    // fed to the reducer for the next move. The move itself does not touch
    // counters, so the framework's top-level endIf observes the terminal G after
    // the move and must set ctx.gameover.
    const terminalG = {
      ...(state.G as Record<string, unknown>),
      counters: {
        ...((state.G as { counters: Record<string, number> }).counters),
        [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 1,
      },
    };
    const terminalState = { ...state, G: terminalG };
    const expectedGameover = evaluateEndgame(terminalG as unknown as LegendaryGameState);
    assert.notEqual(expectedGameover, null, 'the injected counter must make evaluateEndgame non-null');

    const activePlayer = String(terminalState.ctx.currentPlayer);
    const finalState = makeMove(terminalState, 'advanceStage', [], activePlayer);

    assert.deepStrictEqual(
      finalState.ctx.gameover,
      expectedGameover,
      'the framework must set ctx.gameover to the evaluateEndgame result once the top-level endIf fires — the wiring whose absence was the bug',
    );
  });

  it('advanceStage cannot skip the mandatory start-of-turn villain reveal (fairness guard)', () => {
    // why: the villain reveal is the mandatory first action of a turn; advancing
    // start→main before it would let a player dodge villains entering the City,
    // Ambushes, Scheme Twists, and Master Strikes. This drives a REAL match into
    // the play phase, then asserts advanceStage no-ops at start-before-reveal and
    // advances only once villainRevealedThisTurn is set. The flag is set directly
    // (rather than via revealVillainCard) so the guard is tested independently of
    // whatever card the mock villain deck happens to reveal.
    const setupData: MatchConfiguration = createMockMatchConfiguration();
    const initialState = InitializeGame({ game: LegendaryGame, numPlayers: 2, setupData });
    const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });
    const makeMove = (
      state: unknown,
      moveName: string,
      args: unknown[],
      playerID: string,
    ): { G: unknown; ctx: { currentPlayer: unknown } } =>
      reducer(state, { type: 'MAKE_MOVE', payload: { type: moveName, args, playerID } });

    let state = makeMove(initialState, 'setPlayerReady', [{ ready: true }], '0');
    state = makeMove(state, 'setPlayerReady', [{ ready: true }], '1');
    state = makeMove(state, 'startMatchIfReady', [], '0');

    const activePlayer = String(state.ctx.currentPlayer);
    const startG = state.G as { currentStage: string; villainRevealedThisTurn: boolean };
    assert.equal(startG.currentStage, 'start', 'a fresh turn begins at the start stage');
    assert.equal(startG.villainRevealedThisTurn, false, 'the reveal allowance is unspent at turn start');

    // Before the reveal: advanceStage is a no-op — the stage must not leave 'start'.
    const blocked = makeMove(state, 'advanceStage', [], activePlayer);
    assert.equal(
      (blocked.G as { currentStage: string }).currentStage,
      'start',
      'advanceStage must NOT advance start→main before the villain is revealed',
    );

    // After the reveal allowance is spent: advanceStage advances start→main.
    const revealedState = {
      ...state,
      G: { ...(state.G as Record<string, unknown>), villainRevealedThisTurn: true },
    };
    const advanced = makeMove(revealedState, 'advanceStage', [], activePlayer);
    assert.equal(
      (advanced.G as { currentStage: string }).currentStage,
      'main',
      'advanceStage advances start→main once villainRevealedThisTurn is set',
    );
  });
});


// ---------------------------------------------------------------------------
// WP-805 / D-24700 — a random player goes first (rules v23 L524). These drive a
// REAL match through boardgame.io's own reducer, because the opener is chosen by
// the play phase's turn.order.first, which only the framework calls (the sim, PAR
// and fixture harnesses keep seat 0 and never reach it). Every match is seeded
// explicitly: an unseeded InitializeGame seeds from the clock.
// ---------------------------------------------------------------------------

/** The slice of a boardgame.io match state the opener tests read. */
interface OpenerTestState {
  G: Record<string, unknown>;
  ctx: { currentPlayer: string; phase: string };
  plugins: { random: { data: unknown } };
}

/** The boardgame.io reducer, typed for the opener tests. */
type OpenerTestReducer = (state: unknown, action: { type: string; payload: unknown }) => OpenerTestState;

/** A seeded match in its lobby, plus the reducer that drives it. */
interface SeededLobby {
  initialState: OpenerTestState;
  reducer: OpenerTestReducer;
}

/** A match driven from its lobby into play. */
interface StartedMatch {
  readiedState: OpenerTestState;
  playState: OpenerTestState;
}

/**
 * The fixed seeds the opener tests walk: `seed-0` … `seed-39`.
 *
 * @returns The 40 seed strings, in order.
 */
function buildOpenerSeeds(): string[] {
  const seeds: string[] = [];
  for (let i = 0; i < 40; i++) {
    seeds.push(`seed-${i}`);
  }
  return seeds;
}

const OPENER_SEEDS = buildOpenerSeeds();

/**
 * Creates a seeded match in its lobby with the mock configuration.
 *
 * @param seed - The match seed (the `{ ...LegendaryGame, seed }` precedent).
 * @param numPlayers - The number of seats.
 * @returns The initial lobby state and a reducer for the same seeded game.
 */
function createSeededLobby(seed: string, numPlayers: number): SeededLobby {
  const seededGame = { ...LegendaryGame, seed };
  const initialState = InitializeGame({
    game: seededGame,
    numPlayers,
    setupData: createMockMatchConfiguration(),
  }) as unknown as OpenerTestState;
  const reducer = CreateGameReducer({ game: seededGame, isClient: false }) as unknown as OpenerTestReducer;
  return { initialState, reducer };
}

/**
 * Dispatches one move through the reducer.
 *
 * @param reducer - The boardgame.io reducer.
 * @param state - The state to apply the move to.
 * @param moveName - The move name.
 * @param args - The move arguments.
 * @param playerID - The seat submitting the move.
 * @returns The next state.
 */
function dispatchOpenerMove(
  reducer: OpenerTestReducer,
  state: OpenerTestState,
  moveName: string,
  args: unknown[],
  playerID: string,
): OpenerTestState {
  return reducer(state, { type: 'MAKE_MOVE', payload: { type: moveName, args, playerID } });
}

/**
 * Readies every seat, then starts the match (lobby → play).
 *
 * @param reducer - The boardgame.io reducer.
 * @param lobbyState - A lobby state (possibly with an edited G).
 * @param numPlayers - The number of seats to ready.
 * @returns The state just before startMatchIfReady and the first play state.
 */
function startMatchFromLobby(
  reducer: OpenerTestReducer,
  lobbyState: OpenerTestState,
  numPlayers: number,
): StartedMatch {
  let readiedState = lobbyState;
  for (let seat = 0; seat < numPlayers; seat++) {
    readiedState = dispatchOpenerMove(reducer, readiedState, 'setPlayerReady', [{ ready: true }], String(seat));
  }
  const playState = dispatchOpenerMove(reducer, readiedState, 'startMatchIfReady', [], '0');
  assert.equal(playState.ctx.phase, 'play', 'startMatchIfReady must move a fully readied lobby into play');
  return { readiedState, playState };
}

/**
 * Creates a seeded match and drives it into play.
 *
 * @param seed - The match seed.
 * @param numPlayers - The number of seats.
 * @returns The readied lobby state, the first play state and the reducer.
 */
function startSeededMatch(seed: string, numPlayers: number): StartedMatch & { reducer: OpenerTestReducer } {
  const { initialState, reducer } = createSeededLobby(seed, numPlayers);
  return { ...startMatchFromLobby(reducer, initialState, numPlayers), reducer };
}

describe('WP-805 / D-24700 — a random player goes first', () => {
  it('a 3-seat match can open on every seat: the openers over seed-0 … seed-39 are exactly {0, 1, 2}', () => {
    const openers = new Set<string>();
    for (const seed of OPENER_SEEDS) {
      const { readiedState, playState } = startSeededMatch(seed, 3);
      // why: the draw happened — a flagged match spends one seeded die roll at play start.
      assert.notDeepStrictEqual(
        playState.plugins.random.data,
        readiedState.plugins.random.data,
        `a flagged match must draw its opener from random when play begins (${seed})`,
      );
      openers.add(playState.ctx.currentPlayer);
    }
    // why: an exact set (not "more than one opener") catches a truncated draw range
    // such as Die(length - 1), which could never open the last seat.
    assert.deepStrictEqual([...openers].sort(), ['0', '1', '2']);
  });

  it('the same seed opens the same seat with the same random state', () => {
    const firstRun = startSeededMatch('seed-7', 3);
    const secondRun = startSeededMatch('seed-7', 3);
    assert.equal(firstRun.playState.ctx.currentPlayer, secondRun.playState.ctx.currentPlayer);
    assert.deepStrictEqual(firstRun.playState.plugins.random, secondRun.playState.plugins.random);
  });

  it('a 2-seat state created before WP-805 (no flag) opens seat 1 and draws nothing', () => {
    // why: D-24119 — the faithful replay re-runs a stored initialState + log with the
    // current engine. A stored multi-seat state has no flag and was recorded with seat
    // 1 opening; the legacy branch must reproduce it without shifting the random stream.
    for (const seed of OPENER_SEEDS.slice(0, 10)) {
      const { initialState, reducer } = createSeededLobby(seed, 2);
      assert.equal(initialState.G.isFirstPlayerRandom, true, 'a new 2-seat match carries the flag');
      const legacyG = structuredClone(initialState.G);
      delete legacyG.isFirstPlayerRandom;
      const { readiedState, playState } = startMatchFromLobby(reducer, { ...initialState, G: legacyG }, 2);
      assert.equal(playState.ctx.currentPlayer, '1', `a flagless 2-seat state must open seat 1 (${seed})`);
      assert.deepStrictEqual(
        playState.plugins.random.data,
        readiedState.plugins.random.data,
        `a flagless state must make no random draw at play start (${seed})`,
      );
    }
  });

  it('a solo match has no flag, opens seat 0 and draws nothing', () => {
    for (const seed of OPENER_SEEDS.slice(0, 10)) {
      const { readiedState, playState } = startSeededMatch(seed, 1);
      assert.equal(Object.keys(playState.G).includes('isFirstPlayerRandom'), false, `solo G must carry no flag key (${seed})`);
      assert.equal(playState.ctx.currentPlayer, '0', `a solo match opens seat 0 (${seed})`);
      assert.deepStrictEqual(
        playState.plugins.random.data,
        readiedState.plugins.random.data,
        `a solo match must make no random draw at play start (${seed})`,
      );
    }
  });

  it('after the opener ends its turn the next seat is clockwise, wrapping from seat 2 to seat 0', () => {
    let wrapSeed: string | undefined;
    for (const seed of OPENER_SEEDS) {
      if (startSeededMatch(seed, 3).playState.ctx.currentPlayer === '2') {
        wrapSeed = seed;
        break;
      }
    }
    assert.ok(wrapSeed, 'some seed in seed-0 … seed-39 must open seat 2 on 3 seats');

    const { playState, reducer } = startSeededMatch(wrapSeed, 3);
    assert.equal(playState.ctx.currentPlayer, '2');
    // why: the villain reveal is set directly (the fairness-guard test precedent above)
    // so the turn can leave 'start' regardless of what the mock villain deck holds. The
    // mock configuration has no registry, so both shared decks are empty and the
    // deck-exhaustion final-turn latch (WP-367) would end the game on this turn instead
    // of passing it on; one placeholder card in each deck keeps the match going.
    const villainDeck = playState.G.villainDeck as { deck: string[] };
    let state: OpenerTestState = {
      ...playState,
      G: {
        ...playState.G,
        villainRevealedThisTurn: true,
        heroDeck: ['test/placeholder-hero-card'],
        villainDeck: { ...villainDeck, deck: ['test/placeholder-villain-card'] },
      },
    };
    state = dispatchOpenerMove(reducer, state, 'advanceStage', [], '2'); // start → main
    state = dispatchOpenerMove(reducer, state, 'advanceStage', [], '2'); // main → cleanup
    state = dispatchOpenerMove(reducer, state, 'advanceStage', [], '2'); // cleanup → endTurn
    assert.equal(state.ctx.currentPlayer, '0', 'the seat after seat 2 on a 3-seat table is seat 0');
  });
});

// ---------------------------------------------------------------------------
// WP-793 / D-24656 — the play-phase turn.onMove openers for the rulebook escape
// procedure and a non-active seat's return-on-discard. These prove the WIRING in
// game.ts (the injected-seam trap): dropping either opener from turn.onMove must fail
// a case here even though the helper unit tests stay green.
// ---------------------------------------------------------------------------

/** The play phase's turn.onMove hook. */
function playPhaseOnMove(): (context: unknown) => void {
  const playPhase = (
    LegendaryGame.phases as Record<string, { turn?: { onMove?: (context: unknown) => void } }>
  ).play;
  const onMove = playPhase?.turn?.onMove;
  assert.ok(onMove, 'play phase must define a turn.onMove hook');
  return onMove;
}

/**
 * A complete two-seat G from boardgame.io's own setup, cloned so it is mutable, with
 * an empty HQ and empty Hero Deck the cases fill in.
 */
function cloneSetupG(): LegendaryGameState {
  const initialState = InitializeGame({ game: LegendaryGame, numPlayers: 2, setupData: createMockMatchConfiguration() });
  const gameState = structuredClone(initialState.G) as LegendaryGameState;
  gameState.hq = [null, null, null, null, null];
  gameState.heroDeck = [];
  return gameState;
}

/** Runs the play-phase onMove for active seat 0 with a no-op events surface. */
function runOnMove(gameState: LegendaryGameState): void {
  playPhaseOnMove()({
    G: gameState,
    ctx: { turn: 1, currentPlayer: '0' },
    random: { Shuffle: (items: unknown[]) => items },
    events: { setActivePlayers: () => {} },
  });
}

describe('play-phase turn.onMove escape-procedure wiring (WP-793 / D-24656)', () => {
  it('a queued escape with two eligible HQ Heroes opens an escape-hq-ko choice', () => {
    const gameState = cloneSetupG();
    gameState.hq = ['test-hq-a', 'test-hq-b', null, null, null];
    gameState.pendingEscapeProcedures = [
      { escapedCardId: 'test-escaper', chooserPlayerID: '0', hasCarriedBystanders: false, isHqKoResolved: false },
    ];

    runOnMove(gameState);

    assert.equal(gameState.pendingSeatChoice?.kind, 'escape-hq-ko', 'onMove must open the escape procedure');
    assert.deepEqual(gameState.pendingSeatChoice?.addressedSeats, ['0']);
  });

  it('a non-active return-on-discard front entry opens its seat choice', () => {
    const gameState = cloneSetupG();
    gameState.playerZones['1']!.discard = ['core/cyclops'];
    gameState.pendingReturnOnDiscard = [{ playerID: '1', cardId: 'core/cyclops' }];

    runOnMove(gameState);

    assert.equal(gameState.pendingSeatChoice?.kind, 'return-on-discard', 'onMove must open the reaction for seat 1');
    assert.deepEqual(gameState.pendingSeatChoice?.addressedSeats, ['1']);
  });

  it('leaves an open Diving Block wave alone and does not open the escape over it', () => {
    const gameState = cloneSetupG();
    gameState.hq = ['test-hq-a', 'test-hq-b', null, null, null];
    const divingBlockWave = {
      kind: 'diving-block',
      addressedSeats: ['1'],
      seatPrompts: { '1': { options: [{ label: 'Reveal' }, { label: 'Take the Wound' }] } },
      submissions: {},
      defaultOptionIndex: 1,
    };
    gameState.pendingSeatChoice = structuredClone(divingBlockWave);
    gameState.pendingEscapeProcedures = [
      { escapedCardId: 'test-escaper', chooserPlayerID: '0', hasCarriedBystanders: false, isHqKoResolved: false },
    ];

    runOnMove(gameState);

    assert.deepEqual(gameState.pendingSeatChoice, divingBlockWave, 'the open wave is untouched');
    assert.equal(gameState.pendingEscapeProcedures?.[0]?.isHqKoResolved, false, 'the escape waits for it');
  });

  it('real reducer: a Bystander-carrying escape parks a two-seat discard and the ACTIVE seat\'s submission is accepted first', () => {
    const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });
    const makeMove = (
      state: unknown,
      moveName: string,
      args: unknown[],
      playerID: string,
    ): { G: unknown; ctx: { currentPlayer: unknown } } =>
      reducer(state, { type: 'MAKE_MOVE', payload: { type: moveName, args, playerID } });
    const initialState = InitializeGame({ game: LegendaryGame, numPlayers: 2, setupData: createMockMatchConfiguration() });
    let state = makeMove(initialState, 'setPlayerReady', [{ ready: true }], '0');
    state = makeMove(state, 'setPlayerReady', [{ ready: true }], '1');
    state = makeMove(state, 'startMatchIfReady', [], '0');
    const activeSeat = String(state.ctx.currentPlayer);
    const otherSeat = activeSeat === '0' ? '1' : '0';

    // why: inject a full City whose space-4 Villain carries a Bystander and a Villain on
    // top of the Villain Deck, with an empty HQ so step 1 is the logged no-op and the
    // two-seat discard (step 2) is what onMove parks after the real reveal move.
    const escapeG = structuredClone(state.G) as LegendaryGameState;
    escapeG.city = ['test-c0', 'test-c1', 'test-c2', 'test-c3', 'test-escaper'];
    escapeG.attachedBystanders = { 'test-escaper': ['test-bystander'] };
    escapeG.villainDeck = { deck: ['test-entering'], discard: [] };
    escapeG.villainDeckCardTypes = { ...escapeG.villainDeckCardTypes, 'test-escaper': 'villain', 'test-entering': 'villain' };
    escapeG.hq = [null, null, null, null, null];
    const activeHandBefore = escapeG.playerZones[activeSeat]!.hand.length;
    const otherHandBefore = escapeG.playerZones[otherSeat]!.hand.length;
    assert.ok(activeHandBefore > 0 && otherHandBefore > 0, 'both seats start with a hand');

    state = makeMove({ ...state, G: escapeG }, 'revealVillainCard', [], activeSeat);
    const parkedG = state.G as LegendaryGameState;
    assert.equal(parkedG.pendingSeatChoice?.kind, 'escape-bystander-discard', 'onMove opened the discard after the reveal');
    assert.deepEqual([...parkedG.pendingSeatChoice!.addressedSeats].sort(), ['0', '1']);

    state = makeMove(state, 'resolveSeatChoice', [{ optionIndex: 0 }], activeSeat);
    const afterActiveG = state.G as LegendaryGameState;
    assert.deepEqual(
      afterActiveG.pendingSeatChoice?.submissions[activeSeat],
      { optionIndex: 0 },
      'the reducer must accept the active seat\'s own discard first (no active-seat skip on a mixed ride)',
    );

    state = makeMove(state, 'resolveSeatChoice', [{ optionIndex: 0 }], otherSeat);
    const finalG = state.G as LegendaryGameState;
    assert.equal(finalG.pendingSeatChoice, undefined, 'the choice applied once both seats answered');
    assert.equal(finalG.playerZones[activeSeat]!.hand.length, activeHandBefore - 1);
    assert.equal(finalG.playerZones[otherSeat]!.hand.length, otherHandBefore - 1);
    assert.equal(
      finalG.messages.some((entry) => entry.text.includes('gained a wound from villain escape')),
      false,
      'no generic escape Wound',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-803 / D-24692 — the live advanceStage binding replays Out of Time cards. Only the real
// reducer exercises game.ts's beginMain closure behind the reveal gate and the block-all
// guards (the injected-seam trap: the turnLoop / replay unit tests mock the closure).
// ---------------------------------------------------------------------------

describe('advanceStage Out of Time replay wiring (WP-803 / D-24692)', () => {
  it('real reducer: nothing replays before the reveal or while a reveal choice is pending; then the card plays once and is discarded', () => {
    const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });
    const makeMove = (
      state: unknown,
      moveName: string,
      args: unknown[],
      playerID: string,
    ): { G: unknown; ctx: { currentPlayer: unknown } } =>
      reducer(state, { type: 'MAKE_MOVE', payload: { type: moveName, args, playerID } });
    const initialState = InitializeGame({ game: LegendaryGame, numPlayers: 2, setupData: createMockMatchConfiguration() });
    let state = makeMove(initialState, 'setPlayerReady', [{ ready: true }], '0');
    state = makeMove(state, 'setPlayerReady', [{ ready: true }], '1');
    state = makeMove(state, 'startMatchIfReady', [], '0');
    const activeSeat = String(state.ctx.currentPlayer);

    // why: inject a card the seat set aside last turn (an ungated Out of Time card whose line 0
    // draws a card and whose printed icon is +2 attack), and a benign Villain on top of the
    // Villain Deck so the real reveal move spends the reveal allowance.
    const outOfTimeCard = 'test/oot-hero/returning-card#0';
    const injectedG = structuredClone(state.G) as LegendaryGameState;
    injectedG.outOfTimeCards = { [activeSeat]: [outOfTimeCard] };
    injectedG.heroAbilityHooks = [
      ...injectedG.heroAbilityHooks,
      { cardId: outOfTimeCard, timing: 'onPlay', keywords: ['draw'], effects: [{ type: 'draw', magnitude: 1 }] },
      { cardId: outOfTimeCard, timing: 'onPlay', keywords: ['out-of-time'], effects: [{ type: 'out-of-time' }] },
    ];
    injectedG.cardStats = {
      ...injectedG.cardStats,
      [outOfTimeCard]: {
        attack: 2, recruit: 0, cost: 3, fightCost: 0, fightCostMode: 'static', fightCostBase: 0,
        hasAttackIcon: true, hasRecruitIcon: false, isShieldOrHydra: false,
      },
    };
    injectedG.villainDeck = { deck: ['test-entering'], discard: [] };
    injectedG.villainDeckCardTypes = { ...injectedG.villainDeckCardTypes, 'test-entering': 'villain' };
    state = { ...state, G: injectedG };

    // Before the reveal: advanceStage is refused and nothing replays.
    state = makeMove(state, 'advanceStage', [], activeSeat);
    let currentG = state.G as LegendaryGameState;
    assert.equal(currentG.currentStage, 'start');
    assert.deepEqual(currentG.outOfTimeCards, { [activeSeat]: [outOfTimeCard] }, 'no replay before the reveal');

    state = makeMove(state, 'revealVillainCard', [], activeSeat);
    currentG = state.G as LegendaryGameState;
    assert.equal(currentG.villainRevealedThisTurn, true);

    // While a reveal choice (a KO-a-Hero choice) is pending: advanceStage is refused, no replay.
    const pendingG = structuredClone(currentG) as LegendaryGameState;
    pendingG.pendingKoHeroChoices = [{ playerID: activeSeat } as never];
    const blocked = makeMove({ ...state, G: pendingG }, 'advanceStage', [], activeSeat);
    const blockedG = blocked.G as LegendaryGameState;
    assert.equal(blockedG.currentStage, 'start');
    assert.deepEqual(blockedG.outOfTimeCards, { [activeSeat]: [outOfTimeCard] }, 'no replay while a choice is pending');

    // Choice resolved (none pending): the advance replays the card once, then discards it.
    const handBefore = currentG.playerZones[activeSeat]!.hand.length;
    const attackBefore = currentG.turnEconomy.attack;
    state = makeMove(state, 'advanceStage', [], activeSeat);
    const finalG = state.G as LegendaryGameState;
    const zones = finalG.playerZones[activeSeat]!;
    assert.equal(finalG.currentStage, 'main');
    assert.equal(finalG.outOfTimeCards, undefined, 'the set-aside is consumed');
    assert.equal(zones.discard[zones.discard.length - 1], outOfTimeCard, 'discarded after the second play');
    assert.equal(zones.inPlay.includes(outOfTimeCard), false);
    assert.equal(zones.hand.length, handBefore + 1, 'line 0 drew a card');
    assert.equal(finalG.turnEconomy.attack, attackBefore + 2, 'its printed +2 attack is credited');
    assert.deepEqual(finalG.turnEconomy.outOfTimePlayedCardIds, [outOfTimeCard]);
    const texts = finalG.messages.map((entry) => entry.text);
    assert.ok(texts.some((text) => text.includes('returns from Out of Time and is played a second time.')));
    assert.ok(texts.some((text) => text.includes(`Player ${activeSeat} played `)), 'the play-core log line');
    assert.ok(texts.some((text) => text.endsWith('is not set aside again: a card goes Out of Time only once.')));
  });
});

// ---------------------------------------------------------------------------
// WP-845 / D-24779 — reveal or gain a Wound: a player who can reveal chooses. Only the real
// reducer proves the turn.onMove opener is wired and that a NON-active seat's answer is accepted
// (the stage ride); the helper unit tests call the opener directly.
// ---------------------------------------------------------------------------

/** The reducer-driven move helper the WP-845 cases use. */
type RevealOrWoundMakeMove = (
  state: unknown,
  moveName: string,
  args: unknown[],
  playerID: string,
) => { G: unknown; ctx: { currentPlayer: unknown } };

/** A started two-seat match through the real reducer, with its active and other seat. */
interface RevealOrWoundMatch {
  state: { G: unknown; ctx: { currentPlayer: unknown } };
  makeMove: RevealOrWoundMakeMove;
  activeSeat: string;
  otherSeat: string;
}

const AMBUSHER = 'test-ambusher';
const XMEN_HERO = 'test/xmen/claws#0';
const PLAIN_HERO = 'test/plain/punch#0';
const DIVING_BLOCK_HERO = 'core/captain-america/diving-block#0';

/**
 * Starts a real two-seat match and injects an X-Men reveal-or-wound Ambush Villain on top of the
 * Villain Deck, with the given hands.
 *
 * @param handFor - Builds each seat's hand from whether it is the active seat.
 * @returns The started match, ready for the active seat's revealVillainCard.
 */
function startRevealOrWoundMatch(handFor: (isActiveSeat: boolean) => string[]): RevealOrWoundMatch {
  const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });
  const makeMove: RevealOrWoundMakeMove = (state, moveName, args, playerID) =>
    reducer(state, { type: 'MAKE_MOVE', payload: { type: moveName, args, playerID } });
  const initialState = InitializeGame({ game: LegendaryGame, numPlayers: 2, setupData: createMockMatchConfiguration() });
  let state = makeMove(initialState, 'setPlayerReady', [{ ready: true }], '0');
  state = makeMove(state, 'setPlayerReady', [{ ready: true }], '1');
  state = makeMove(state, 'startMatchIfReady', [], '0');
  const activeSeat = String(state.ctx.currentPlayer);
  const otherSeat = activeSeat === '0' ? '1' : '0';

  const injectedG = structuredClone(state.G) as LegendaryGameState;
  injectedG.playerZones[activeSeat]!.hand = handFor(true);
  injectedG.playerZones[otherSeat]!.hand = handFor(false);
  injectedG.villainDeck = { deck: [AMBUSHER], discard: [] };
  injectedG.villainDeckCardTypes = { ...injectedG.villainDeckCardTypes, [AMBUSHER]: 'villain' };
  // why: the reveal fires onAmbush only for a card whose board keywords carry 'ambush'.
  injectedG.cardKeywords = { ...injectedG.cardKeywords, [AMBUSHER]: ['ambush'] };
  injectedG.villainAbilityHooks = [
    ...injectedG.villainAbilityHooks,
    {
      cardId: AMBUSHER,
      timing: 'onAmbush',
      keywords: [],
      effects: [{ primitive: 'reveal-or-wound', requireKind: 'team', requireValue: 'x-men' }],
    },
  ];
  injectedG.heroAbilityHooks = [
    ...injectedG.heroAbilityHooks,
    { cardId: DIVING_BLOCK_HERO, timing: 'onPlay', keywords: ['diving-block'] },
  ] as LegendaryGameState['heroAbilityHooks'];
  injectedG.cardTraits = {
    ...injectedG.cardTraits,
    [XMEN_HERO]: { heroClass: 'covert', team: 'x-men' },
    [PLAIN_HERO]: { heroClass: 'covert', team: 'spider-friends' },
    [DIVING_BLOCK_HERO]: { heroClass: 'instinct', team: 'avengers' },
  } as LegendaryGameState['cardTraits'];
  return { state: { ...state, G: injectedG }, makeMove, activeSeat, otherSeat };
}

describe('play-phase turn.onMove reveal-or-wound wiring (WP-845 / D-24779)', () => {
  it('real reducer: a NON-active revealer is asked after the reveal, answers, and the turn proceeds', () => {
    const match = startRevealOrWoundMatch((isActiveSeat) => (isActiveSeat ? [PLAIN_HERO] : [XMEN_HERO]));
    const { makeMove, activeSeat, otherSeat } = match;

    let state = makeMove(match.state, 'revealVillainCard', [], activeSeat);
    const parkedG = state.G as LegendaryGameState;
    assert.equal(parkedG.playerZones[activeSeat]!.discard.length, 1, 'the cannot-reveal active seat was wounded inline');
    assert.equal(parkedG.pendingSeatChoice?.kind, 'reveal-or-wound', 'onMove opened the choice after the reveal');
    assert.deepEqual(parkedG.pendingSeatChoice?.addressedSeats, [otherSeat]);

    state = makeMove(state, 'resolveSeatChoice', [{ optionIndex: 0 }], otherSeat);
    const answeredG = state.G as LegendaryGameState;
    assert.equal(answeredG.pendingSeatChoice, undefined, 'the reducer accepted the non-active seat answer');
    assert.equal(answeredG.pendingRevealOrWoundChoices, undefined, 'the queue drained');
    assert.equal(answeredG.playerZones[otherSeat]!.discard.length, 0, 'Reveal avoided the Wound');
    assert.ok(
      answeredG.notableEvents.some(
        (event) => event.type === 'strikeBlocked' && event.playerId === otherSeat && event.threatKind === 'ambush',
      ),
      'the Reveal pushed its strikeBlocked',
    );

    state = makeMove(state, 'advanceStage', [], activeSeat);
    assert.equal((state.G as LegendaryGameState).currentStage, 'main', 'the turn proceeds');
  });

  it('real reducer: a mixed ride (active + non-active) accepts the active seat first, then the other seat decline', () => {
    const match = startRevealOrWoundMatch(() => [XMEN_HERO]);
    const { makeMove, activeSeat, otherSeat } = match;

    let state = makeMove(match.state, 'revealVillainCard', [], activeSeat);
    assert.deepEqual([...(state.G as LegendaryGameState).pendingSeatChoice!.addressedSeats], ['0', '1']);

    state = makeMove(state, 'resolveSeatChoice', [{ optionIndex: 0 }], activeSeat);
    assert.deepEqual(
      (state.G as LegendaryGameState).pendingSeatChoice?.submissions[activeSeat],
      { optionIndex: 0 },
      'the active seat answer is accepted first (no active-seat skip on a mixed ride)',
    );
    const woundsBefore = (state.G as LegendaryGameState).piles.wounds.length;
    state = makeMove(state, 'resolveSeatChoice', [{ optionIndex: 1 }], otherSeat);
    const finalG = state.G as LegendaryGameState;
    assert.equal(finalG.pendingSeatChoice, undefined);
    assert.equal(finalG.playerZones[activeSeat]!.discard.length, 0, 'the active seat revealed');
    assert.equal(finalG.playerZones[otherSeat]!.discard.length, 1, 'the other seat chose the Wound');
    assert.equal(finalG.piles.wounds.length, woundsBefore - 1);
    assert.equal(finalG.turnEconomy.woundsDrawn, 0, 'only a current-player Wound moves woundsDrawn');

    state = makeMove(state, 'advanceStage', [], activeSeat);
    assert.equal((state.G as LegendaryGameState).currentStage, 'main', 'the turn proceeds');
  });

  it('real reducer: a decliner holding Diving Block gets the Wound parked and the Diving Block wave opens in that move', () => {
    const match = startRevealOrWoundMatch(
      (isActiveSeat) => (isActiveSeat ? [PLAIN_HERO] : [XMEN_HERO, DIVING_BLOCK_HERO]),
    );
    const { makeMove, activeSeat, otherSeat } = match;

    let state = makeMove(match.state, 'revealVillainCard', [], activeSeat);
    assert.equal((state.G as LegendaryGameState).pendingSeatChoice?.kind, 'reveal-or-wound');

    state = makeMove(state, 'resolveSeatChoice', [{ optionIndex: 1 }], otherSeat);
    const finalG = state.G as LegendaryGameState;
    assert.deepEqual(
      finalG.pendingDivingBlockWounds?.map((entry) => entry.playerID),
      [otherSeat],
      'the declined Wound is parked for Diving Block',
    );
    assert.equal(finalG.pendingSeatChoice?.kind, 'diving-block', 'the wave opened in the resolve move onMove');
    assert.deepEqual(finalG.pendingSeatChoice?.addressedSeats, [otherSeat]);
  });
});
