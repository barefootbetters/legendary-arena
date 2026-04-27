/**
 * Villain deck composition tests for WP-014B.
 *
 * Verifies that buildVillainDeck correctly resolves cards from the registry,
 * generates virtual card instances, classifies all cards, and produces a
 * deterministically shuffled deck.
 *
 * Uses node:test and node:assert only. Uses makeMockCtx. No boardgame.io
 * imports. Mock registry satisfies VillainDeckRegistryReader structurally.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildVillainDeck } from './villainDeck.setup.js';
import type { VillainDeckRegistryReader, VillainDeckFlatCard } from './villainDeck.setup.js';
import { REVEALED_CARD_TYPES } from './villainDeck.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import { makeMockCtx } from '../test/mockCtx.js';

// ---------------------------------------------------------------------------
// Mock registry
// ---------------------------------------------------------------------------

/**
 * Creates a mock registry satisfying VillainDeckRegistryReader with
 * one set containing test data for all card types.
 */
function createMockRegistry(): VillainDeckRegistryReader {
  const testSetAbbr = 'test';

  const villainFlatCards: VillainDeckFlatCard[] = [
    { key: 'test-villain-test-group-alpha-card-a', cardType: 'villain', slug: 'card-a', setAbbr: testSetAbbr },
    { key: 'test-villain-test-group-alpha-card-b', cardType: 'villain', slug: 'card-b', setAbbr: testSetAbbr },
    { key: 'test-villain-test-group-beta-card-c', cardType: 'villain', slug: 'card-c', setAbbr: testSetAbbr },
  ];

  const mastermindFlatCards: VillainDeckFlatCard[] = [
    { key: 'test-mastermind-test-mm-main', cardType: 'mastermind', slug: 'main', setAbbr: testSetAbbr },
    { key: 'test-mastermind-test-mm-epic', cardType: 'mastermind', slug: 'epic', setAbbr: testSetAbbr },
    { key: 'test-mastermind-test-mm-tactic-one', cardType: 'mastermind', slug: 'tactic-one', setAbbr: testSetAbbr },
  ];

  const schemeFlatCards: VillainDeckFlatCard[] = [
    { key: 'test-scheme-test-scheme', cardType: 'scheme', slug: 'test-scheme', setAbbr: testSetAbbr },
  ];

  const allFlatCards = [...villainFlatCards, ...mastermindFlatCards, ...schemeFlatCards];

  const testSetData = {
    abbr: testSetAbbr,
    henchmen: [
      { id: 1, slug: 'test-henchman-group', name: 'Test Henchman', imageUrl: 'https://example.com/h.webp', abilities: [] },
    ],
    masterminds: [
      {
        id: 1,
        slug: 'test-mm',
        name: 'Test Mastermind',
        alwaysLeads: [],
        vp: 5,
        cards: [
          { name: 'Main', slug: 'main', tactic: false, vAttack: 8, imageUrl: 'https://example.com/m1.webp', abilities: [] },
          { name: 'Epic', slug: 'epic', vAttack: 10, imageUrl: 'https://example.com/m2.webp', abilities: [] },
          { name: 'Tactic One', slug: 'tactic-one', tactic: true, vAttack: 3, imageUrl: 'https://example.com/t1.webp', abilities: [] },
          { name: 'Tactic Two', slug: 'tactic-two', tactic: true, vAttack: 4, imageUrl: 'https://example.com/t2.webp', abilities: [] },
        ],
      },
    ],
    villains: [
      {
        id: 1, slug: 'test-group-alpha', name: 'Test Group Alpha', ledBy: [],
        cards: [
          { name: 'Card A', slug: 'card-a', vp: 1, vAttack: 2, imageUrl: 'https://example.com/a.webp', abilities: [] },
          { name: 'Card B', slug: 'card-b', vp: 1, vAttack: 3, imageUrl: 'https://example.com/b.webp', abilities: [] },
        ],
      },
      {
        id: 2, slug: 'test-group-beta', name: 'Test Group Beta', ledBy: [],
        cards: [
          { name: 'Card C', slug: 'card-c', vp: 2, vAttack: 4, imageUrl: 'https://example.com/c.webp', abilities: [] },
        ],
      },
    ],
    schemes: [
      { id: 1, slug: 'test-scheme', name: 'Test Scheme', imageUrl: 'https://example.com/s.webp', cards: [] },
    ],
    heroes: [],
    bystanders: [],
    wounds: [],
    other: [],
  };

  return {
    listCards: () => [...allFlatCards],
    listSets: () => [{ abbr: testSetAbbr }],
    getSet: (abbr: string) => (abbr === testSetAbbr ? testSetData : undefined),
  };
}

/**
 * Creates a valid test MatchSetupConfig targeting the mock registry data.
 *
 * @amended WP-113 PS-7: bare slug fixtures (`'test-scheme'`,
 *   `'test-mm'`, `'test-group-alpha'`, `'test-henchman-group'`,
 *   `'test-hero-deck'`) migrated to set-qualified form
 *   `'<testSetAbbr>/<slug>'` per the qualified-ID contract
 *   (per D-10014).
 */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mm',
    villainGroupIds: ['test/test-group-alpha'],
    henchmanGroupIds: ['test/test-henchman-group'],
    heroDeckIds: ['test/test-hero-deck'],
    bystandersCount: 5,
    woundsCount: 5,
    officersCount: 5,
    sidekicksCount: 5,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildVillainDeck', () => {
  it('produces a non-empty deck for a valid config', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const result = buildVillainDeck(config, registry, context);

    assert.ok(
      result.state.deck.length > 0,
      'Deck must be non-empty for a valid config',
    );
    assert.deepStrictEqual(
      result.state.discard,
      [],
      'Discard must be empty after setup',
    );
  });

  it('every card in the deck has an entry in cardTypes', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const result = buildVillainDeck(config, registry, context);

    for (const cardId of result.state.deck) {
      assert.ok(
        cardId in result.cardTypes,
        `Card "${cardId}" must have an entry in cardTypes`,
      );
    }
  });

  it('deck is shuffled (order differs from sorted insertion order)', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const result = buildVillainDeck(config, registry, context);

    // makeMockCtx reverses arrays, so shuffled order differs from sorted order
    const sorted = [...result.state.deck].sort();
    const isIdentical = result.state.deck.every(
      (card, index) => card === sorted[index],
    );
    assert.ok(
      !isIdentical,
      'Deck order must differ from sorted order after shuffle (proves shuffle ran)',
    );
  });

  it('cardTypes keys are a subset of unique deck IDs and vice versa', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const result = buildVillainDeck(config, registry, context);

    const uniqueDeckIds = new Set(result.state.deck);
    const cardTypeKeys = new Set(Object.keys(result.cardTypes));

    // Every unique deck ID must have a cardTypes entry
    for (const deckId of uniqueDeckIds) {
      assert.ok(
        cardTypeKeys.has(deckId),
        `Deck card "${deckId}" must have a cardTypes entry`,
      );
    }

    // Every cardTypes key must be in the deck
    for (const key of cardTypeKeys) {
      assert.ok(
        uniqueDeckIds.has(key),
        `cardTypes key "${key}" must appear in the deck`,
      );
    }
  });

  it('henchman copies: correct count per group and correct ext_id format', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const result = buildVillainDeck(config, registry, context);

    const henchmanCards = result.state.deck.filter((id) =>
      id.startsWith('henchman-'),
    );
    assert.equal(
      henchmanCards.length,
      10,
      'Must have exactly 10 henchman copies for one group',
    );

    // Verify ext_id format: henchman-{groupSlug}-{00..09}
    for (let i = 0; i < 10; i++) {
      const paddedIndex = String(i).padStart(2, '0');
      const expectedId = `henchman-test-henchman-group-${paddedIndex}`;
      assert.ok(
        result.state.deck.includes(expectedId),
        `Deck must contain "${expectedId}"`,
      );
      assert.equal(
        result.cardTypes[expectedId],
        'henchman',
        `"${expectedId}" must be classified as henchman`,
      );
    }
  });

  it('scheme twist copies: correct count and correct ext_id format', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const result = buildVillainDeck(config, registry, context);

    const twistCards = result.state.deck.filter((id) =>
      id.startsWith('scheme-twist-'),
    );
    assert.equal(
      twistCards.length,
      8,
      'Must have exactly 8 scheme twist copies',
    );

    // Verify ext_id format: scheme-twist-{schemeSlug}-{00..07}
    for (let i = 0; i < 8; i++) {
      const paddedIndex = String(i).padStart(2, '0');
      const expectedId = `scheme-twist-test-scheme-${paddedIndex}`;
      assert.ok(
        result.state.deck.includes(expectedId),
        `Deck must contain "${expectedId}"`,
      );
      assert.equal(
        result.cardTypes[expectedId],
        'scheme-twist',
        `"${expectedId}" must be classified as scheme-twist`,
      );
    }
  });

  it('bystander copies: count matches numPlayers', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();
    const numPlayers = 3;
    const context = makeMockCtx({ numPlayers });

    const result = buildVillainDeck(config, registry, context);

    const bystanderCards = result.state.deck.filter((id) =>
      id.startsWith('bystander-villain-deck-'),
    );
    assert.equal(
      bystanderCards.length,
      numPlayers,
      `Must have exactly ${numPlayers} bystander copies (1 per player)`,
    );

    // Verify ext_id format
    for (let i = 0; i < numPlayers; i++) {
      const paddedIndex = String(i).padStart(2, '0');
      const expectedId = `bystander-villain-deck-${paddedIndex}`;
      assert.ok(
        result.state.deck.includes(expectedId),
        `Deck must contain "${expectedId}"`,
      );
      assert.equal(
        result.cardTypes[expectedId],
        'bystander',
        `"${expectedId}" must be classified as bystander`,
      );
    }
  });

  it('mastermind strikes: only non-tactic cards included', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const result = buildVillainDeck(config, registry, context);

    const strikeCards = result.state.deck.filter((id) =>
      result.cardTypes[id] === 'mastermind-strike',
    );

    // Test mastermind has 2 non-tactic cards (main: tactic=false, epic: tactic=undefined)
    // and 2 tactic cards (tactic=true)
    assert.equal(
      strikeCards.length,
      2,
      'Must have exactly 2 mastermind strike cards (non-tactic only)',
    );

    // Verify tactic cards are excluded
    const tacticInDeck = result.state.deck.some(
      (id) => id.includes('tactic-one') || id.includes('tactic-two'),
    );
    assert.ok(
      !tacticInDeck,
      'Tactic cards must NOT appear in the villain deck',
    );

    // Verify ext_id format: {setAbbr}-mastermind-{mastermindSlug}-{cardSlug}
    assert.ok(
      result.state.deck.includes('test-mastermind-test-mm-main'),
      'Deck must contain the main mastermind strike card',
    );
    assert.ok(
      result.state.deck.includes('test-mastermind-test-mm-epic'),
      'Deck must contain the epic mastermind strike card',
    );
  });

  it('JSON.stringify succeeds for the result (serialization proof)', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const result = buildVillainDeck(config, registry, context);

    const serialized = JSON.stringify(result);
    assert.ok(
      serialized,
      'JSON.stringify must produce a non-empty string',
    );

    const deserialized = JSON.parse(serialized);
    assert.deepStrictEqual(
      deserialized.state.discard,
      [],
      'Discard must survive JSON round-trip as empty array',
    );
  });

  it('all cardTypes values are valid REVEALED_CARD_TYPES members', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 2 });

    const result = buildVillainDeck(config, registry, context);

    const validTypes = new Set(REVEALED_CARD_TYPES);
    for (const [cardId, cardType] of Object.entries(result.cardTypes)) {
      assert.ok(
        validTypes.has(cardType),
        `Card "${cardId}" has invalid type "${cardType}" — must be a REVEALED_CARD_TYPES member`,
      );
    }
  });
});
