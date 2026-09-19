/**
 * Integration tests for conditional hero effect execution (WP-023).
 *
 * Verifies that executeHeroEffects correctly integrates condition evaluation:
 * effects with met conditions execute, effects with unmet conditions are
 * skipped, G is not mutated by condition evaluation, and serialization
 * remains valid.
 *
 * No boardgame.io imports. Uses makeMockCtx for ShuffleProvider.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeHeroEffects } from './heroEffects.execute.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for conditional execution testing.
 *
 * @param overrides - Partial overrides for player zones and hooks.
 * @returns A minimal LegendaryGameState.
 */
function makeTestState(overrides?: {
  deck?: string[];
  hand?: string[];
  discard?: string[];
  inPlay?: string[];
  heroAbilityHooks?: HeroAbilityHook[];
  turnEconomyAttack?: number;
  turnEconomyRecruit?: number;
  ko?: string[];
}): LegendaryGameState {
  return {
    matchConfiguration: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    currentStage: 'main' as LegendaryGameState['currentStage'],
    playerZones: {
      '0': { ...makePlayerZones(),
        deck: overrides?.deck ?? [],
        hand: overrides?.hand ?? [],
        discard: overrides?.discard ?? [],
        inPlay: overrides?.inPlay ?? [],
        victory: [],
      },
    },
    piles: { ...makeGlobalPiles(),
      bystanders: [],
      wounds: [],
      officers: [],
      sidekicks: [],
    },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: overrides?.ko ?? [],
    attachedBystanders: {},
    turnEconomy: { ...makeTurnEconomy(),
      attack: overrides?.turnEconomyAttack ?? 0,
      recruit: overrides?.turnEconomyRecruit ?? 0,
      spentAttack: 0,
      spentRecruit: 0,
    },
    cardStats: {},
    mastermind: { ...makeMastermindState(),
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: [],
      tacticsDefeated: [],
    },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    heroAbilityHooks: overrides?.heroAbilityHooks ?? [],
  };
}

describe('executeHeroEffects — conditional execution (WP-023)', () => {
  // why: makeMockCtx provides ShuffleProvider-compatible context
  // (random.Shuffle reverses arrays for determinism)
  const mockCtx = makeMockCtx();

  // -------------------------------------------------------------------------
  // Test 1: conditional effect with met conditions executes
  // -------------------------------------------------------------------------
  it('conditional effect with met conditions: effect executes', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x', 'hero-y'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          // why: playedThisTurn value '1' — player has 2 cards in play,
          // so condition is met (2 >= 1)
          conditions: [{ type: 'playedThisTurn', value: '1' }],
          effects: [{ type: 'attack', magnitude: 3 }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.equal(gameState.turnEconomy.attack, 3,
      'Attack should increase by 3 when playedThisTurn condition is met.');
  });

  // -------------------------------------------------------------------------
  // Test 2: conditional effect with unmet conditions skipped
  // -------------------------------------------------------------------------
  it('conditional effect with unmet conditions: effect skipped, no G mutation', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          // why: heroClassMatch is a placeholder that always returns false
          conditions: [{ type: 'heroClassMatch', value: 'tech' }],
          effects: [{ type: 'attack', magnitude: 5 }],
        },
      ],
    });

    const economyBefore = { ...gameState.turnEconomy };
    // why: the `!` on these index accesses is a type-level narrowing, not a
    // suppression: the expression is dereferenced either way, so an undefined
    // value would already throw here. `!` is erased at compile time and carries
    // no runtime semantics. See D-24379 for the idiom and why it is permitted
    // where the suppression pragmas that decision bans are not.
    const inPlayBefore = [...gameState.playerZones['0']!.inPlay];

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.deepEqual(gameState.turnEconomy, economyBefore,
      'turnEconomy should not change when conditions are not met.');
    assert.deepEqual(gameState.playerZones['0']!.inPlay, inPlayBefore,
      'inPlay should not change when conditions are not met.');
  });

  // -------------------------------------------------------------------------
  // Test 3: multiple hooks, some conditional — only met ones execute
  // -------------------------------------------------------------------------
  it('multiple hooks on one card, some conditional: only met ones execute', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          // Hook 1: unconditional — should execute
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['recruit'],
          effects: [{ type: 'recruit', magnitude: 2 }],
        },
        {
          // Hook 2: conditional (heroClassMatch = always false) — should skip
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          conditions: [{ type: 'heroClassMatch', value: 'tech' }],
          effects: [{ type: 'attack', magnitude: 4 }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.equal(gameState.turnEconomy.recruit, 2,
      'Unconditional recruit effect should execute.');
    assert.equal(gameState.turnEconomy.attack, 0,
      'Conditional attack effect should be skipped (condition not met).');
  });

  // -------------------------------------------------------------------------
  // Test 4: condition evaluation does not mutate G
  // -------------------------------------------------------------------------
  it('condition failure mutates nothing except an observability log line (WP-295)', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          conditions: [{ type: 'heroClassMatch', value: 'tech' }],
          effects: [{ type: 'attack', magnitude: 5 }],
        },
      ],
    });

    // why: WP-295 / D-24082 — the condition-failed branch now appends ONE
    // observability line to G.messages so a suppressed ability is no longer a
    // silent skip. The semantic no-mutation invariant still holds for everything
    // else, so compare with messages excluded to pin the exact mutation surface.
    const messagesBefore = gameState.messages.length;
    const snapshotWithoutMessages = JSON.parse(
      JSON.stringify({ ...gameState, messages: [] }),
    );

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    const afterWithoutMessages = JSON.parse(
      JSON.stringify({ ...gameState, messages: [] }),
    );
    assert.deepEqual(afterWithoutMessages, snapshotWithoutMessages,
      'condition failure must not mutate any game state except G.messages.');
    assert.equal(gameState.messages.length, messagesBefore + 1,
      'condition failure must append exactly one observability log line.');
    assert.match(gameState.messages[gameState.messages.length - 1]!.text, /did not activate/,
      'the appended log line must explain the ability did not activate.');
    // why: WP-702 follow-up — a SINGLE-hook card keeps the whole-card wording (the gated hook IS
    // the card's ability), so it must NOT claim only "one of its abilities" was gated.
    assert.equal(
      gameState.messages[gameState.messages.length - 1]!.text.includes('one of its abilities'),
      false,
      'a single-ability card uses the whole-card "ability did not activate" wording.',
    );
  });

  // -------------------------------------------------------------------------
  // Test 4b: a MULTI-hook card names ONE ability (WP-702 live-verify follow-up)
  // -------------------------------------------------------------------------
  it('a multi-hook card says "one of its abilities" when a sibling clause fired (WP-702 follow-up)', () => {
    // why: Gambit's Hypnotic Charm carries an unconditional reveal-top clause PLUS an
    // `[hc:instinct]`-gated each-other clause. In the live log the own-deck reveal clearly
    // resolved, yet the bare "ability did not activate" line for the gated clause read as if the
    // whole card fizzled. A card with >1 ability hook must name ONE ability, not the whole card.
    const gameState = makeTestState({
      deck: ['card-a'],
      inPlay: ['hero-x'], // only the played card is in play, so the heroClassMatch gate below fails
      heroAbilityHooks: [
        // hook 0: unconditional — fires (draws a card), mirroring Hypnotic Charm's own-deck clause
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['draw'],
          effects: [{ type: 'draw', magnitude: 1 }],
        },
        // hook 1: `[hc:tech]`-gated — blocked (no other tech Hero in play), the each-other analogue
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          conditions: [{ type: 'heroClassMatch', value: 'tech' }],
          effects: [{ type: 'attack', magnitude: 2 }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.equal(gameState.playerZones['0']!.hand.length, 1,
      'the unconditional sibling clause still fired (drew a card).');
    const blockedLine = gameState.messages.find((message) => message.text.includes('did not activate'));
    assert.ok(blockedLine !== undefined, 'the gated clause appends a did-not-activate line.');
    assert.match(blockedLine!.text, /did not activate one of its abilities/,
      'a multi-hook card names ONE ability so a fired sibling clause is not read as the whole card fizzling.');
  });

  // -------------------------------------------------------------------------
  // Test 5: JSON.stringify(G) succeeds after conditional execution
  // -------------------------------------------------------------------------
  it('JSON.stringify(G) succeeds after conditional execution', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x', 'hero-y'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          conditions: [{ type: 'playedThisTurn', value: '1' }],
          effects: [{ type: 'attack', magnitude: 3 }],
        },
        {
          cardId: 'hero-y' as string,
          timing: 'onPlay',
          keywords: ['recruit'],
          conditions: [{ type: 'heroClassMatch', value: 'strength' }],
          effects: [{ type: 'recruit', magnitude: 2 }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    const serialized = JSON.stringify(gameState);
    assert.ok(serialized.length > 0,
      'JSON.stringify(G) should succeed after conditional execution.');
  });

  // -------------------------------------------------------------------------
  // WP-566 / D-24375 - the emitted line names the condition that failed
  // -------------------------------------------------------------------------
  it("AC-1/AC-6 (amended by WP-568): a recruit-threshold gate now WAITS, still naming the recruit gate", () => {
    // why: end-to-end at the emit site. Surge of Power shape: a recruit threshold
    // with NO class or team component. The old single string blamed "Hero class or
    // team synergy" here, 8 times in one observed match.
    const gameState = makeTestState({
      inPlay: ["hero-x"],
      heroAbilityHooks: [
        {
          cardId: "hero-x" as string,
          timing: "onPlay",
          keywords: ["attack"],
          conditions: [{ type: "recruitMadeThisTurnAtLeast", value: "8" }],
          effects: [{ type: "attack", magnitude: 3 }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, "0", "hero-x" as string);

    // why: AMENDED BY WP-568. A recruit threshold is now a whole-turn wait-and-see
    // gate, so this scenario produces the WAITING line rather than "did not
    // activate". WP-566's substance is unchanged and still asserted here: the
    // message names the RECRUIT gate and never blames Hero class or team synergy -
    // describeFailedCondition feeds both states, so the misattribution fix holds.
    const line = gameState.messages[gameState.messages.length - 1]!;
    assert.match(line.text, /is waiting/);
    assert.equal(/did not activate/.test(line.text), false,
      "a not-yet-met gate must not reuse the failed wording (D-24377).");
    assert.match(line.text, /8 or more recruit/);
    assert.equal(/Hero class/i.test(line.text), false,
      "the message must not blame Hero class for a recruit-threshold gate.");
    assert.equal(/team synergy/i.test(line.text), false);
    assert.equal(line.outcome, "neutral");
    assert.equal(line.card, "hero-x");
  });

  it("WP-568: an OUT-OF-SCOPE gate still reads as failed, not waiting", () => {
    // why: heroClassMatch keeps ON-PLAY evaluation (D-24377 section 1), so it must
    // still produce WP-566's "did not activate" line at `blocked`. Without this the
    // suite would stop covering the failed path once recruit gates moved to waiting.
    const gameState = makeTestState({
      inPlay: ["hero-x"],
      heroAbilityHooks: [
        {
          cardId: "hero-x" as string,
          timing: "onPlay",
          keywords: ["attack"],
          conditions: [{ type: "heroClassMatch", value: "tech" }],
          effects: [{ type: "attack", magnitude: 5 }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, "0", "hero-x" as string);

    const line = gameState.messages[gameState.messages.length - 1]!;
    assert.match(line.text, /did not activate/);
    assert.match(line.text, /another tech Hero/);
    assert.equal(/is waiting/.test(line.text), false);
    assert.equal(line.outcome, "blocked");
    assert.equal(gameState.deferredConditionalGrants, undefined,
      "an out-of-scope gate must NOT defer.");
  });

  it("AC-8: the gate still BLOCKS - no effect fired", () => {
    const gameState = makeTestState({
      inPlay: ["hero-x"],
      heroAbilityHooks: [
        {
          cardId: "hero-x" as string,
          timing: "onPlay",
          keywords: ["attack"],
          conditions: [{ type: "recruitMadeThisTurnAtLeast", value: "8" }],
          effects: [{ type: "attack", magnitude: 3 }],
        },
      ],
    });
    const attackBefore = gameState.turnEconomy.attack;
    executeHeroEffects(gameState, mockCtx, "0", "hero-x" as string);
    assert.equal(gameState.turnEconomy.attack, attackBefore,
      "WP-566 changes the MESSAGE only - no gate evaluation may move.");
  });

  it("AC-8: a gate that PASSED still fires", () => {
    // why: the other direction of AC-8. Uses playedThisTurn because this file's
    // makeTestState carries NO cardTraits override, so a class gate can never be
    // satisfied here — a class-gated "passing" case would silently assert nothing.
    const gameState = makeTestState({
      inPlay: ["hero-x", "other-card"],
      heroAbilityHooks: [
        {
          cardId: "hero-x" as string,
          timing: "onPlay",
          keywords: ["attack"],
          conditions: [{ type: "playedThisTurn", value: "2" }],
          effects: [{ type: "attack", magnitude: 5 }],
        },
      ],
    });
    const attackBefore = gameState.turnEconomy.attack;
    executeHeroEffects(gameState, mockCtx, "0", "hero-x" as string);
    assert.equal(gameState.turnEconomy.attack, attackBefore + 5,
      "a satisfied gate must still fire - AC-8 pins both directions.");
  });
});
