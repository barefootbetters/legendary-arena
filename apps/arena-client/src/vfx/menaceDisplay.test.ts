import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasMenaceSignal,
  menaceAriaText,
  menaceBarPercent,
  menaceKindLabel,
  menaceRatioLabel,
  menaceTierClass,
} from './menaceDisplay';
import {
  MENACE_TIERS,
  SCHEME_LOSS_KINDS,
  type MenaceTier,
  type SchemeLossKind,
} from '@legendary-arena/game-engine';

describe('menaceDisplay (WP-558) — bar percentage', () => {
  test('maps the 0..1 scalar onto 0..100', () => {
    assert.equal(menaceBarPercent(0), 0);
    assert.equal(menaceBarPercent(0.5), 50);
    assert.equal(menaceBarPercent(1), 100);
  });

  test('clamps out-of-range input rather than overflowing the bar', () => {
    // why: the engine already clamps, but the meter must not depend on that to
    // avoid a bar wider than its track if a future producer regresses.
    assert.equal(menaceBarPercent(1.5), 100);
    assert.equal(menaceBarPercent(-1), 0);
  });

  test('never yields NaN for a non-finite input', () => {
    assert.equal(menaceBarPercent(Number.NaN), 0);
    assert.equal(menaceBarPercent(Number.POSITIVE_INFINITY), 100);
  });
});

describe('menaceDisplay (WP-558) — tier class', () => {
  test('maps every MenaceTier to a distinct modifier class', () => {
    // why: iterating the engine's canonical array (not a local copy) means a
    // new tier member fails this test until it is given a class — the shared
    // contract stays honest across the package boundary.
    const classes = MENACE_TIERS.map((tier) => menaceTierClass(tier));
    assert.equal(new Set(classes).size, MENACE_TIERS.length);
    for (const className of classes) {
      assert.equal(className.startsWith('danger-meter--'), true);
    }
  });

  test('the class follows the tier it is given, not a re-derived one', () => {
    assert.equal(menaceTierClass('calm'), 'danger-meter--calm');
    assert.equal(menaceTierClass('critical'), 'danger-meter--critical');
  });
});

describe('menaceDisplay (WP-558) — ratio label', () => {
  test('renders progress over threshold when a denominator exists', () => {
    assert.equal(menaceRatioLabel(3, 8), '3/8');
    assert.equal(menaceRatioLabel(4, 5), '4/5');
  });

  test('renders the bare count when the scheme has no denominator', () => {
    // why: post-WP-562 every scheme built by the engine carries a denominator
    // (D-24371 §1); this path is a state that predates the depletion capture.
    // No slash, no invented number.
    assert.equal(menaceRatioLabel(3, undefined), '3');
  });

  test('never substitutes a default denominator', () => {
    // why: the whole defect WP-558 removes was a hardcoded /8. A `?? 8` or
    // `?? 7` anywhere in this path would reintroduce it by the back door.
    const label = menaceRatioLabel(2, undefined);
    assert.equal(label.includes('/'), false);
    assert.equal(label.includes('8'), false);
    assert.equal(label.includes('7'), false);
  });
});

describe('menaceDisplay (WP-558) — accessible text', () => {
  test('names the tier and the progress in a full sentence', () => {
    const text = menaceAriaText('critical', 7, 8, 'twists');
    assert.equal(text.includes('critical'), true);
    assert.equal(text.includes('7 of 8'), true);
    assert.equal(text.endsWith('.'), true);
  });

  test('omits the denominator phrasing when there is none', () => {
    const text = menaceAriaText('rising', 3, undefined, 'twists');
    assert.equal(text.includes(' of '), false);
    assert.equal(text.includes('3'), true);
  });

  test('produces distinct text for every tier', () => {
    const texts = MENACE_TIERS.map((tier: MenaceTier) =>
      menaceAriaText(tier, 1, 4, 'twists'),
    );
    assert.equal(new Set(texts).size, MENACE_TIERS.length);
  });
});

describe('menaceDisplay (WP-562) — the kind label', () => {
  test('AC-2: a hero-deck kind reads "Heroes", not a twist count', () => {
    // why: the live defect's fix, at the label. A Civil War match showed a
    // twist-derived number; it now shows the hero deck under its own noun.
    assert.equal(menaceKindLabel('hero-deck'), 'Heroes');
    assert.equal(`${menaceKindLabel('hero-deck')} ${menaceRatioLabel(31, 42)}`, 'Heroes 31/42');
  });

  test('names every loss kind the engine can project', () => {
    assert.equal(menaceKindLabel('wound-stack'), 'Wounds');
    assert.equal(menaceKindLabel('escaped-pile'), 'Escaped');
    // why: WP-612 — a bystander-counting escaped-pile scheme reads "Bystanders",
    // not "Escaped": it counts bystanders carried into the escaped pile, and the
    // "Escaped" word both mislabels that and collides with the raw escaped-villain
    // count (Midtown Bank Robbery showed "Escaped 5/8" beside "Escaped: 7").
    assert.equal(menaceKindLabel('escaped-bystander'), 'Bystanders');
    assert.equal(
      `${menaceKindLabel('escaped-bystander')} ${menaceRatioLabel(5, 8)}`,
      'Bystanders 5/8',
    );
    assert.equal(menaceKindLabel('escaped-converted'), 'Escaped');
    assert.equal(menaceKindLabel('twists'), 'Twists');
  });

  test('every SCHEME_LOSS_KINDS member has a non-empty noun', () => {
    // why: iterating the engine's canonical array (not a local copy) means a new
    // kind member fails here until it is given a word — the same cross-package
    // contract check the tier classes get. A missing entry would otherwise
    // render `undefined` in the HUD.
    for (const kind of SCHEME_LOSS_KINDS) {
      const label = menaceKindLabel(kind);
      assert.equal(typeof label, 'string', `${kind} produced ${label}`);
      assert.equal(label.length > 0, true, `${kind} produced an empty label`);
    }
  });

  test('falls back to "Scheme" when the state projects no kind', () => {
    // why: an older fixture or a recorded replay. The generic noun claims only
    // what is known; it must not guess "Twists" and mislabel a real reading.
    assert.equal(menaceKindLabel(undefined), 'Scheme');
  });

  test('the label is a lookup, never a re-derivation of the loss rule', () => {
    // why: D-24367 §2. The kind is the ONLY input — the same kind always yields
    // the same noun, with no scheme id, threshold, or progress consulted.
    const kinds: SchemeLossKind[] = ['hero-deck', 'wound-stack'];
    for (const kind of kinds) {
      assert.equal(menaceKindLabel(kind), menaceKindLabel(kind));
    }
  });
});

describe('menaceDisplay (WP-562) — accessible text names the quantity', () => {
  test('the screen reader hears the same noun the bar shows', () => {
    const text = menaceAriaText('critical', 31, 42, 'hero-deck');
    assert.equal(text.includes('31 of 42 heroes'), true);
  });

  test('a kindless state still reads as a full sentence', () => {
    const text = menaceAriaText('rising', 3, 8, undefined);
    assert.equal(text.includes('3 of 8 scheme'), true);
    assert.equal(text.endsWith('.'), true);
  });
});

describe('menaceDisplay (WP-558) — signal presence', () => {
  test('is true only when both the scalar and the tier are present', () => {
    assert.equal(hasMenaceSignal({ menace: 0.5, menaceTier: 'rising' }), true);
  });

  test('is false when the signal is absent — an old fixture or a replay', () => {
    // why: D-24367 §5 — absent renders NOTHING. An absent measurement is not a
    // claim of safety, so this must not be treated as "calm".
    assert.equal(hasMenaceSignal({}), false);
    assert.equal(hasMenaceSignal({ menace: 0.5 }), false);
    assert.equal(hasMenaceSignal({ menaceTier: 'calm' }), false);
  });

  test('a zero menace with a tier is still a real signal', () => {
    // why: zero danger is a measurement; absence is not. These must not collapse.
    assert.equal(hasMenaceSignal({ menace: 0, menaceTier: 'calm' }), true);
  });
});
