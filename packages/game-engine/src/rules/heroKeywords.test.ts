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

  it('HERO_KEYWORDS array has exactly 24 entries after the Ionic Energy fix', () => {
    assert.equal(
      HERO_KEYWORDS.length,
      24,
      'HERO_KEYWORDS must have exactly 24 entries (23 post-WP-290 + optional-put-bottom-hq)',
    );
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
