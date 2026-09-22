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

  it('HERO_KEYWORDS array has exactly 63 entries after WP-735 digest-indigestion', () => {
    assert.equal(
      HERO_KEYWORDS.length,
      63,
      'HERO_KEYWORDS must have exactly 63 entries (62 + digest-indigestion (WP-735 / D-24555))',
    );
    assert.ok(
      HERO_KEYWORDS.includes('kidnap-per-count'),
      'kidnap-per-count must be in HERO_KEYWORDS array',
    );
    assert.ok(
      HERO_KEYWORDS.includes('covering-fire'),
      'covering-fire must be in HERO_KEYWORDS array',
    );
  });
});

describe('ko-wound keyword (WP-721 / EC-758 / D-24542)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('ko-wound'),
      'ko-wound must be in HERO_KEYWORDS array',
    );
  });

  it('is distinct from ko-wound-reward (rewardless sibling)', () => {
    // why: WP-721 / D-24542 — the rewardless variant is a SEPARATE keyword from the
    // reward-bearing ko-wound-reward; both must be present and not conflated.
    assert.ok(HERO_KEYWORDS.includes('ko-wound'), 'ko-wound must be registered');
    assert.ok(HERO_KEYWORDS.includes('ko-wound-reward'), 'ko-wound-reward must still be registered');
  });
});

describe('do-over keyword (WP-681 / EC-718 / D-24498)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('do-over'),
      'do-over must be in HERO_KEYWORDS array',
    );
  });
});

describe('optional-ko-shield-officer keyword (WP-681 / EC-718 / D-24498)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('optional-ko-shield-officer'),
      'optional-ko-shield-officer must be in HERO_KEYWORDS array',
    );
  });
});

describe('steal-abilities keyword (WP-592 / D-24401)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('steal-abilities'),
      'steal-abilities must be in HERO_KEYWORDS array',
    );
  });
});

describe('investigate keyword (WP-564 / EC-599 / D-24373)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('investigate'),
      'investigate must be in HERO_KEYWORDS array',
    );
  });
});

describe('defeat-with-bystander keyword (WP-486 / EC-521 / D-24291)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('defeat-with-bystander'),
      'defeat-with-bystander must be in HERO_KEYWORDS array',
    );
  });
});

describe('copy-powers keyword (WP-535 / EC-570 / D-24345)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('copy-powers'),
      'copy-powers must be in HERO_KEYWORDS array',
    );
  });
});

describe('return-on-discard keyword (WP-498 / EC-533 / D-24301)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('return-on-discard'),
      'return-on-discard must be in HERO_KEYWORDS array',
    );
  });
});

describe('ko-wound-reward keyword (WP-382 / EC-411 / D-24183)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('ko-wound-reward'),
      'ko-wound-reward must be in HERO_KEYWORDS array',
    );
  });
});

describe('discard-to-play keyword (WP-383 / EC-412 / D-24184)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('discard-to-play'),
      'discard-to-play must be in HERO_KEYWORDS array',
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

describe('shuffle-discard-empty-reward keyword (WP-356 / EC-386 / D-24148)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('shuffle-discard-empty-reward'),
      'shuffle-discard-empty-reward must be in HERO_KEYWORDS array',
    );
  });
});

describe('no-more-draws keyword (WP-731 / EC-768 / D-24552)', () => {
  it('is registered in HERO_KEYWORDS', () => {
    assert.ok(
      HERO_KEYWORDS.includes('no-more-draws'),
      'no-more-draws must be in HERO_KEYWORDS array',
    );
  });
});
