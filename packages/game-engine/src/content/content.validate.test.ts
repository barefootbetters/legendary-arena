/**
 * Tests for validateContent / validateContentBatch (WP-033).
 *
 * Uses node:test and node:assert only — no boardgame.io import, no
 * makeMockCtx (content validation is pure and needs no mock ctx).
 *
 * All 9 tests are wrapped in one describe block so node:test registers
 * them as a single suite per WP-031 P6-19 precedent — bare top-level
 * test() calls do NOT register as suites, which would break the
 * 376 tests / 96 suites / 0 fail baseline (RS-2 lock).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateContent,
  validateContentBatch,
  type ContentValidationContext,
} from './content.validate.js';

describe('validateContent / validateContentBatch (WP-033)', () => {
  test('Valid hero card passes validation', () => {
    const hero = {
      name: 'Black Widow',
      slug: 'black-widow',
      team: 'avengers',
      hc: 'tech',
      cost: 2,
      attack: 0,
      recruit: 0,
      abilities: ['Draw a Card.'],
      keywords: ['draw'],
    };
    const result = validateContent(hero, 'hero');
    assert.equal(result.valid, true);
  });

  test('Hero card missing required field fails with specific error', () => {
    const hero = {
      name: 'Black Widow',
      slug: 'black-widow',
      // team is missing
      hc: 'tech',
      cost: 2,
      attack: 0,
      recruit: 0,
      abilities: ['Draw a Card.'],
    };
    const result = validateContent(hero, 'hero');
    assert.equal(result.valid, false);
    if (result.valid) {
      return;
    }
    const teamError = result.errors.find((error) => error.field === 'team');
    assert.ok(teamError, 'Expected an error for the missing "team" field.');
    assert.equal(teamError.contentType, 'hero');
    assert.equal(teamError.contentId, 'black-widow');
    assert.match(teamError.message, /missing required field "team"/);
  });

  test('Hero card with invalid keyword fails with enum error', () => {
    const hero = {
      name: 'Black Widow',
      slug: 'black-widow',
      team: 'avengers',
      hc: 'tech',
      cost: 2,
      attack: 0,
      recruit: 0,
      abilities: ['Teleport across the board.'],
      keywords: ['teleport'],
    };
    const result = validateContent(hero, 'hero');
    assert.equal(result.valid, false);
    if (result.valid) {
      return;
    }
    const keywordError = result.errors.find(
      (error) => error.field === 'keywords',
    );
    assert.ok(keywordError, 'Expected an enum error on field "keywords".');
    assert.match(
      keywordError.message,
      /keyword "teleport" which is not a valid HERO_KEYWORDS value/,
    );
  });

  test('Valid mastermind with tactics passes', () => {
    const mastermind = {
      name: 'Doctor Doom',
      slug: 'dr-doom',
      vp: 6,
      alwaysLeads: ['doombots'],
      cards: [
        { name: 'Doombot Legion', slug: 'doombot-legion', tactic: true },
        { name: 'Monarchs Decree', slug: 'monarchs-decree', tactic: true },
      ],
    };
    const result = validateContent(mastermind, 'mastermind');
    assert.equal(result.valid, true);
  });

  test('Mastermind with no tactic cards fails', () => {
    const mastermind = {
      name: 'Doctor Doom',
      slug: 'dr-doom',
      vp: 6,
      alwaysLeads: ['doombots'],
      cards: [
        { name: 'Doombot Legion', slug: 'doombot-legion', tactic: false },
      ],
    };
    const result = validateContent(mastermind, 'mastermind');
    assert.equal(result.valid, false);
    if (result.valid) {
      return;
    }
    const tacticError = result.errors.find((error) => error.field === 'cards');
    assert.ok(tacticError, 'Expected a tactic-presence error on field "cards".');
    assert.match(
      tacticError.message,
      /must have at least one card with "tactic": true/,
    );
  });

  test('Scheme with invalid setup instruction type fails', () => {
    const scheme = {
      name: 'Negative Zone Prison Break',
      slug: 'negative-zone-prison-break',
      setupInstructions: [
        { type: 'modifyCitySiz', value: 6 },
      ],
    };
    const result = validateContent(scheme, 'scheme');
    assert.equal(result.valid, false);
    if (result.valid) {
      return;
    }
    const instructionError = result.errors.find(
      (error) => error.field === 'setupInstructions',
    );
    assert.ok(
      instructionError,
      'Expected an error on field "setupInstructions" for invalid type.',
    );
    assert.match(
      instructionError.message,
      /setup instruction type "modifyCitySiz" which is not a valid SCHEME_SETUP_TYPES value/,
    );
  });

  test('Cross-reference check: alwaysLeads referencing non-existent group with context fails, without context passes', () => {
    // Tests both halves in one test per RS-3 locked decision.
    const mastermind = {
      name: 'Doctor Doom',
      slug: 'dr-doom',
      vp: 6,
      alwaysLeads: ['unknown-group'],
      cards: [
        { name: 'Doombot Legion', slug: 'doombot-legion', tactic: true },
      ],
    };
    const context: ContentValidationContext = {
      validVillainGroupSlugs: new Set(['hand-ninjas', 'brotherhood']),
    };

    const withContext = validateContent(mastermind, 'mastermind', context);
    assert.equal(withContext.valid, false);
    if (!withContext.valid) {
      const crossRefError = withContext.errors.find(
        (error) => error.field === 'alwaysLeads',
      );
      assert.ok(
        crossRefError,
        'Expected a cross-reference error on field "alwaysLeads".',
      );
      assert.match(
        crossRefError.message,
        /references alwaysLeads slug "unknown-group" which is not in the supplied valid-villain-groups set/,
      );
    }

    const withoutContext = validateContent(mastermind, 'mastermind');
    assert.equal(withoutContext.valid, true);
  });

  test('Batch validation aggregates errors from multiple items', () => {
    const itemOne = {
      content: {
        name: 'Hero One',
        slug: 'hero-one',
        // team missing
        hc: 'tech',
        cost: 1,
        attack: 0,
        recruit: 0,
        abilities: ['Draw.'],
      },
      contentType: 'hero',
    };
    const itemTwo = {
      content: {
        name: 'Hero Two',
        slug: 'hero-two',
        team: 'xmen',
        hc: 'not-a-real-class',
        cost: 2,
        attack: 0,
        recruit: 0,
        abilities: ['Attack.'],
      },
      contentType: 'hero',
    };
    const itemThree = {
      content: {
        name: 'Hero Three',
        slug: 'hero-three',
        team: 'avengers',
        hc: 'strength',
        cost: 3,
        attack: 1,
        recruit: 0,
        abilities: ['Fight.'],
      },
      contentType: 'hero',
    };
    const result = validateContentBatch([itemOne, itemTwo, itemThree]);
    assert.equal(result.valid, false);
    if (result.valid) {
      return;
    }
    const itemOneErrors = result.errors.filter(
      (error) => error.contentId === 'hero-one',
    );
    const itemTwoErrors = result.errors.filter(
      (error) => error.contentId === 'hero-two',
    );
    const itemThreeErrors = result.errors.filter(
      (error) => error.contentId === 'hero-three',
    );
    assert.ok(
      itemOneErrors.length > 0,
      'Expected batch to include hero-one errors.',
    );
    assert.ok(
      itemTwoErrors.length > 0,
      'Expected batch to include hero-two errors.',
    );
    assert.equal(
      itemThreeErrors.length,
      0,
      'Expected hero-three to contribute no errors.',
    );
  });

  test('All error messages are full sentences, including unknown-contentType', () => {
    // Part A: pattern check — produce several failures and assert
    // each message matches /^[A-Z].*\.$/ (starts with capital, ends
    // with period).
    const heroMissing = {
      name: 'Hero Missing',
      slug: 'hero-missing',
      hc: 'tech',
      cost: 1,
      attack: 0,
      recruit: 0,
      abilities: ['Draw.'],
    };
    const resultA = validateContent(heroMissing, 'hero');
    assert.equal(resultA.valid, false);
    if (!resultA.valid) {
      for (const error of resultA.errors) {
        assert.match(
          error.message,
          /^[A-Z].*\.$/,
          `Error message does not read as a full sentence: ${error.message}`,
        );
      }
    }

    // Part B: unknown-contentType branch (copilot RISK #10/#21 lock,
    // §Pre-Flight Locked Decisions #10).
    const resultB = validateContent({}, 'Hero');
    assert.equal(resultB.valid, false);
    if (!resultB.valid) {
      assert.equal(resultB.errors.length, 1);
      assert.equal(resultB.errors[0].field, 'contentType');
      assert.equal(resultB.errors[0].contentType, 'Hero');
      assert.ok(
        resultB.errors[0].message.startsWith('The contentType'),
        'Unknown-contentType error message must start with "The contentType".',
      );
      assert.ok(
        resultB.errors[0].message.endsWith('.'),
        'Unknown-contentType error message must end with a period.',
      );
    }

    // Part C: empty string and pluralized form — confirm accept-list
    // is strict.
    const resultEmpty = validateContent({}, '');
    assert.equal(resultEmpty.valid, false);
    if (!resultEmpty.valid) {
      assert.equal(resultEmpty.errors.length, 1);
      assert.equal(resultEmpty.errors[0].field, 'contentType');
      assert.equal(resultEmpty.errors[0].contentType, '');
    }
    const resultPlural = validateContent({}, 'heroes');
    assert.equal(resultPlural.valid, false);
    if (!resultPlural.valid) {
      assert.equal(resultPlural.errors.length, 1);
      assert.equal(resultPlural.errors[0].field, 'contentType');
      assert.equal(resultPlural.errors[0].contentType, 'heroes');
    }
  });
});
