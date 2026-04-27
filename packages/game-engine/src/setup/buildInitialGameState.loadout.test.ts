/**
 * End-to-end loadout integration test for WP-113.
 *
 * Verifies that buildInitialGameState produces a non-empty G across all
 * four setup-builder subsystems (villainDeck, mastermind, scheme, hero
 * abilities) when given a real-shape `MatchSetupConfig` with
 * set-qualified `<setAbbr>/<slug>` IDs and a fixture registry that
 * exposes the full `CardRegistryReader` interface plus all four
 * builder-side reader interfaces.
 *
 * Locks the WP-113 acceptance criterion "G.cardStats populated for the
 * chosen cards" as a permanent regression guard against the
 * `economy.logic.ts` PS-7 spec gap surfaced and fixed mid-execution
 * (see WP-113 §Mid-Execution Amendment block; per D-10014).
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialGameState } from './buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// ---------------------------------------------------------------------------
// Fixture registry — full-interface, real-shape
// ---------------------------------------------------------------------------

/**
 * Builds a fixture registry that exposes:
 * - `listCards()`: hero + villain flat cards with `setAbbr`, `cardType`,
 *   `slug`, `key`, `attack`/`recruit`/`cost`, and `abilities` arrays.
 * - `listSets()` and `getSet(abbr)` for the loaded `core` set with
 *   `masterminds`, `schemes`, `henchmen`, and `villains` arrays.
 *
 * The same `listSets` + `getSet` pair satisfies all four
 * orchestration-side registry-reader guards plus the validator's widened
 * reader. (`isSchemeRegistryReader` was realigned to `listSets`/`getSet`
 * in the WP-113 follow-up alignment fix described on the
 * `SchemeRegistryReader` interface.)
 */
function buildLoadoutFixtureRegistry() {
  const setData = {
    abbr: 'core',
    schemes: [{ slug: 'midtown-bank-robbery' }],
    masterminds: [
      {
        slug: 'dr-doom',
        cards: [
          // why: real registry data has ONE non-tactic card per
          // mastermind (the base card); strikes are derived elsewhere.
          // The fixture mirrors real-data shape to make the test a
          // realistic regression guard.
          { slug: 'doom-base', tactic: false, vAttack: '8' },
          { slug: 'doom-tactic-a', tactic: true, vAttack: '4' },
          { slug: 'doom-tactic-b', tactic: true, vAttack: '5' },
        ],
      },
    ],
    henchmen: [{ slug: 'doombot-legion', vAttack: '3' }],
    villains: [
      {
        slug: 'brotherhood',
        cards: [
          { slug: 'magneto', vAttack: '6' },
          { slug: 'mystique', vAttack: '4' },
        ],
      },
    ],
  };

  return {
    listCards: () => [
      {
        key: 'core-hero-black-widow-1',
        cardType: 'hero',
        slug: '1',
        setAbbr: 'core',
        attack: null,
        recruit: '2',
        cost: 2,
        abilities: ['Draw a Card.'],
      },
      {
        key: 'core-hero-black-widow-2',
        cardType: 'hero',
        slug: '2',
        setAbbr: 'core',
        attack: '2',
        recruit: null,
        cost: 3,
        abilities: ['[hc:covert]: rescue a Bystander.'],
      },
      {
        key: 'core-villain-brotherhood-magneto',
        cardType: 'villain',
        slug: 'magneto',
        setAbbr: 'core',
        abilities: ['Magneto attacks!'],
      },
      {
        key: 'core-villain-brotherhood-mystique',
        cardType: 'villain',
        slug: 'mystique',
        setAbbr: 'core',
        abilities: ['Mystique disguises.'],
      },
    ],
    listSets: () => [{ abbr: 'core' }],
    getSet: (abbr: string) => (abbr === 'core' ? setData : undefined),
  };
}

/**
 * Valid loadout config exercising all four entity types via the
 * fixture registry above.
 */
function buildLoadoutConfig(): MatchSetupConfig {
  return {
    schemeId: 'core/midtown-bank-robbery',
    mastermindId: 'core/dr-doom',
    villainGroupIds: ['core/brotherhood'],
    henchmanGroupIds: ['core/doombot-legion'],
    heroDeckIds: ['core/black-widow'],
    bystandersCount: 5,
    woundsCount: 5,
    officersCount: 5,
    sidekicksCount: 5,
  };
}

const SKIPPED_DIAGNOSTIC_PREFIXES = [
  'buildVillainDeck skipped',
  'buildMastermindState skipped',
  'buildSchemeSetupInstructions skipped',
  'buildHeroAbilityHooks skipped',
];

describe('buildInitialGameState — loadout integration', () => {
  it('produces a non-empty villainDeck.deck with set-qualified IDs and a real-shape registry', () => {
    const registry = buildLoadoutFixtureRegistry();
    const config = buildLoadoutConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);

    assert.ok(
      gameState.villainDeck.deck.length > 0,
      'villainDeck.deck must be non-empty for a valid qualified-ID loadout',
    );
  });

  it('produces a non-empty mastermind.tacticsDeck for a valid qualified mastermind', () => {
    const registry = buildLoadoutFixtureRegistry();
    const config = buildLoadoutConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);

    assert.ok(
      gameState.mastermind.tacticsDeck.length > 0,
      'mastermind.tacticsDeck must be non-empty for a valid qualified mastermind',
    );
  });

  it('populates G.cardStats for the chosen heroes / villains / henchmen (POSITIVE — regression guard for the WP-113 mid-execution spec gap fix in economy.logic.ts)', () => {
    const registry = buildLoadoutFixtureRegistry();
    const config = buildLoadoutConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);

    assert.ok(
      Object.keys(gameState.cardStats).length > 0,
      'G.cardStats must be non-empty after buildCardStats consumes set-qualified IDs',
    );

    // Hero stat present
    assert.ok(
      gameState.cardStats['core-hero-black-widow-1'],
      'cardStats must include the chosen hero ext_ids (core-hero-black-widow-1)',
    );

    // Villain stat present
    assert.ok(
      gameState.cardStats['core-villain-brotherhood-magneto'],
      'cardStats must include the chosen villain ext_ids (core-villain-brotherhood-magneto)',
    );

    // Henchman stat present (10 virtual copies)
    assert.ok(
      gameState.cardStats['henchman-doombot-legion-00'],
      'cardStats must include the chosen henchman virtual copies (henchman-doombot-legion-00)',
    );

    // Mastermind base card stat present
    assert.ok(
      gameState.cardStats['core-mastermind-dr-doom-doom-base'],
      'cardStats must include the mastermind base card ext_id (core-mastermind-dr-doom-doom-base)',
    );
  });

  it('does NOT push any "skipped" diagnostic into G.messages with a real-shape registry (NEGATIVE — orchestration-side guards must all pass)', () => {
    const registry = buildLoadoutFixtureRegistry();
    const config = buildLoadoutConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);

    for (const prefix of SKIPPED_DIAGNOSTIC_PREFIXES) {
      const matched = gameState.messages.some((message) => message.startsWith(prefix));
      assert.equal(
        matched,
        false,
        `G.messages must not contain a "${prefix}" diagnostic when the registry exposes the full reader interface; got messages: ${JSON.stringify(gameState.messages)}`,
      );
    }
  });
});

// ===========================================================================
// Orchestration-side diagnostic-presence regression tests
// ---------------------------------------------------------------------------
// One per builder. Each test constructs a NARROW mock registry that
// satisfies only `listCards` (the validator's minimal floor), forcing
// the four orchestration-side guards to detect the incomplete interface
// and push a full-sentence diagnostic into G.messages. Per WP-113 PS-4
// Q3 LOCKED, all four diagnostics emit at the orchestration site
// (`buildInitialGameState`); no builder pushes to G.messages directly.
// ===========================================================================

/**
 * Returns a registry mock that exposes only `listCards: () => []` —
 * deliberately narrow so the four orchestration-side guards return
 * `false` and push their diagnostics.
 */
function buildNarrowRegistry() {
  return { listCards: () => [] };
}

describe('buildInitialGameState — orchestration-side diagnostic emission (PS-4)', () => {
  it('pushes a "buildVillainDeck skipped" diagnostic when the registry-reader interface is narrow', () => {
    const registry = buildNarrowRegistry();
    const config = buildLoadoutConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);

    const matched = gameState.messages.some((message) => message.startsWith('buildVillainDeck skipped'));
    assert.ok(
      matched,
      'G.messages must contain a "buildVillainDeck skipped" diagnostic when listSets / getSet are missing',
    );
  });

  it('pushes a "buildMastermindState skipped" diagnostic when the registry-reader interface is narrow', () => {
    const registry = buildNarrowRegistry();
    const config = buildLoadoutConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);

    const matched = gameState.messages.some((message) => message.startsWith('buildMastermindState skipped'));
    assert.ok(
      matched,
      'G.messages must contain a "buildMastermindState skipped" diagnostic when listSets / getSet are missing',
    );
  });

  it('pushes a "buildSchemeSetupInstructions skipped" diagnostic when the registry-reader interface is narrow', () => {
    const registry = buildNarrowRegistry();
    const config = buildLoadoutConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);

    const matched = gameState.messages.some((message) => message.startsWith('buildSchemeSetupInstructions skipped'));
    assert.ok(
      matched,
      'G.messages must contain a "buildSchemeSetupInstructions skipped" diagnostic when listSets / getSet are missing',
    );
  });

  it('does NOT push a "buildHeroAbilityHooks skipped" diagnostic when only listCards is present (the hero-ability guard is satisfied by listCards alone)', () => {
    const registry = buildNarrowRegistry();
    const config = buildLoadoutConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);

    const matched = gameState.messages.some((message) => message.startsWith('buildHeroAbilityHooks skipped'));
    assert.equal(
      matched,
      false,
      'isHeroAbilityRegistryReader requires only listCards; the narrow mock satisfies it and no diagnostic should fire',
    );
  });
});
