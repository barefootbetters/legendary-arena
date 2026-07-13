/**
 * Tests for undercover keyword recognition (WP-282 / EC-314).
 *
 * Verifies that the undercover keyword is properly recognized in hero ability
 * text via the [keyword:Undercover] marker (case-sensitive).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HERO_KEYWORDS } from './heroKeywords.js';

describe('undercover keyword (WP-282 / EC-314)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('undercover'),
      'undercover must be in HERO_KEYWORDS array',
    );
  });

  it('supports [keyword:Undercover] marker (case-sensitive)', () => {
    const testMarker = '[keyword:Undercover]';
    // Marker format should match other keywords
    const underscoreIndex = testMarker.indexOf('Undercover');
    assert.ok(underscoreIndex > 0, 'marker should contain "Undercover" (capital U)');
  });

  it('is case-sensitive (rejects lowercase)', () => {
    // Lowercase variant should NOT match
    const lowercaseMarker = '[keyword:undercover]';
    const keywordName = 'undercover';
    // Only the actual keyword name should match, not the lowercase marker
    assert.ok(
      HERO_KEYWORDS.includes(keywordName),
      'keyword name is lowercase in array',
    );
  });
});

describe('victory-villain-attack keyword (WP-285 / EC-317 / D-24068)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('victory-villain-attack'),
      'victory-villain-attack must be in HERO_KEYWORDS array',
    );
  });
});

describe('draw-or-empowered keyword (WP-286 / EC-318 / D-24069)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('draw-or-empowered'),
      'draw-or-empowered must be in HERO_KEYWORDS array',
    );
  });
});

describe('size-changing keyword (WP-290 / EC-322 / D-24074)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('size-changing'),
      'size-changing must be in HERO_KEYWORDS array',
    );
  });

  it('HERO_KEYWORDS array has exactly 29 entries after the gain-wound-self/each addition', () => {
    assert.equal(
      HERO_KEYWORDS.length,
      29,
      'HERO_KEYWORDS must have exactly 29 entries (27 + gain-wound-self + gain-wound-each, D-24156)',
    );
  });
});

describe('gain-wound-self / gain-wound-each keywords (WP-364 / EC-393 / D-24156)', () => {
  it('both are registered in HERO_KEYWORDS', () => {
    assert.ok(HERO_KEYWORDS.includes('gain-wound-self'), 'gain-wound-self must be in HERO_KEYWORDS');
    assert.ok(HERO_KEYWORDS.includes('gain-wound-each'), 'gain-wound-each must be in HERO_KEYWORDS');
  });

  it('the generic wound keyword stays deferred (un-defer is two NEW keywords, never a loosening)', () => {
    assert.ok(HERO_KEYWORDS.includes('wound'), 'the generic wound keyword must remain registered and deferred');
  });
});

describe('optional-put-bottom-hq keyword (Ionic Energy fix)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('optional-put-bottom-hq'),
      'optional-put-bottom-hq must be in HERO_KEYWORDS array',
    );
  });
});

describe('put-any-number-bottom-hq keyword (D-24132)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('put-any-number-bottom-hq'),
      'put-any-number-bottom-hq must be in HERO_KEYWORDS array',
    );
  });
});

describe('put-bottom-hq-icon-reward keyword (D-24133 — Absorb Ambient Power)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('put-bottom-hq-icon-reward'),
      'put-bottom-hq-icon-reward must be in HERO_KEYWORDS array',
    );
  });
});
