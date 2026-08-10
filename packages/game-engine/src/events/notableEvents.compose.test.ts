/**
 * Golden-string tests for the pure narrative composers in
 * `notableEvents.compose.ts`.
 *
 * Pins the byte-stable output of every composer for representative inputs
 * — empty-effects, single-effect, multi-effect, and missing-display
 * fallback (raw cardId as cardName). A future change to any format string
 * trips these tests AND requires re-pinning the replay hashes per WP-200
 * §Non-Negotiable Constraints.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  composeFightNarrative,
  composeAmbushNarrative,
  composeSchemeTwistNarrative,
  composeMastermindStrikeNarrative,
  composeEffectResultLogLine,
  composeHealNarrative,
} from './notableEvents.compose.js';

describe('composeFightNarrative (WP-319 — names the effect targets)', () => {
  it('emits the bare-fight sentence when no effects applied and no bystanders rescued', () => {
    const narrative = composeFightNarrative('Magneto', 0, []);
    assert.equal(narrative, 'Fought "Magneto".');
  });

  it('includes the bystander clause when bystandersRescued > 0', () => {
    const narrative = composeFightNarrative('Magneto', 2, []);
    assert.equal(narrative, 'Fought "Magneto" and rescued 2 bystander(s).');
  });

  it('renders a no-target effect with its generic label (unchanged from WP-316)', () => {
    const narrative = composeFightNarrative('Toad', 0, [
      { keyword: 'captureBystander', targetNames: [] },
    ]);
    assert.equal(narrative, 'Fought "Toad"; Fight effect: a bystander was captured.');
  });

  it('NAMES the KO’d hero for a target-bearing Fight effect', () => {
    const narrative = composeFightNarrative('Sentinel', 1, [
      { keyword: 'koHeroCurrentPlayer', targetNames: ['Spider-Man'] },
    ]);
    assert.equal(
      narrative,
      'Fought "Sentinel" and rescued 1 bystander(s); Fight effect: the active player KO’d a hero (Spider-Man).',
    );
  });

  it('joins multiple effects with "; " and names each target', () => {
    const narrative = composeFightNarrative('Pyro', 0, [
      { keyword: 'koHeroCurrentPlayer', targetNames: ['Iron Man'] },
      { keyword: 'gainWoundEachPlayer', targetNames: [] },
    ]);
    assert.equal(
      narrative,
      'Fought "Pyro"; Fight effect: the active player KO’d a hero (Iron Man); every player gained a wound.',
    );
  });

  it('renders the pending phrase for a parked interactive KO', () => {
    const narrative = composeFightNarrative('Sentinel', 0, [
      { keyword: 'koHeroCurrentPlayer', targetNames: [], pending: true },
    ]);
    assert.equal(
      narrative,
      'Fought "Sentinel"; Fight effect: the active player must KO a hero.',
    );
  });

  it('appends the Skrull-gain clause when skrullGained is true (WP-518 — no bystanders, no effects)', () => {
    const narrative = composeFightNarrative('Optic Blast', 0, [], true);
    assert.equal(
      narrative,
      'Fought "Optic Blast" and gained the Hero into the active player\'s discard pile.',
    );
  });

  it('places the Skrull-gain clause after the bystander clause and before the Fight effect clause (WP-518)', () => {
    const narrative = composeFightNarrative(
      'Determination',
      1,
      [{ keyword: 'koHeroCurrentPlayer', targetNames: ['Wolverine'] }],
      true,
    );
    assert.equal(
      narrative,
      'Fought "Determination" and rescued 1 bystander(s) and gained the Hero into the active player\'s discard pile; Fight effect: the active player KO’d a hero (Wolverine).',
    );
  });

  it('omits the Skrull-gain clause when skrullGained is false — byte-identical to the 3-arg form (WP-518)', () => {
    // why: WP-518 — the fourth param defaults to false; an explicit false must
    // reproduce the pre-WP-518 output exactly, so ordinary villain defeats (and
    // the hashed notableEvents narrative) are unchanged.
    assert.equal(
      composeFightNarrative('Magneto', 2, [], false),
      composeFightNarrative('Magneto', 2, []),
    );
  });

  it('falls back to the raw cardId when display data was missing at the call site', () => {
    // why: defensive fallback — the call site substitutes the raw cardId
    // into `cardName` when `G.cardDisplayData[cardId]` is missing, so the
    // composer renders the raw token without throwing.
    const narrative = composeFightNarrative(
      'core-villain-brotherhood-blob-00',
      0,
      [],
    );
    assert.equal(narrative, 'Fought "core-villain-brotherhood-blob-00".');
  });
});

describe('composeAmbushNarrative (WP-319 — names the effect targets)', () => {
  it('emits the no-effect sentence when the executor returned an empty array', () => {
    const narrative = composeAmbushNarrative('Magneto', []);
    assert.equal(narrative, '"Magneto" entered the city with no Ambush effect.');
  });

  it('renders a no-target effect with its generic label', () => {
    const narrative = composeAmbushNarrative('Toad', [
      { keyword: 'gainWoundEachPlayer', targetNames: [] },
    ]);
    assert.equal(narrative, '"Toad" ambushed: every player gained a wound.');
  });

  it('NAMES the captured HQ hero for a target-bearing Ambush effect', () => {
    const narrative = composeAmbushNarrative('Skrull Queen Veranke', [
      { keyword: 'captureHqHeroHighestCost', targetNames: ['Amulet of Avalon'] },
    ]);
    assert.equal(
      narrative,
      '"Skrull Queen Veranke" ambushed: the highest-cost HQ hero was captured (Amulet of Avalon).',
    );
  });

  it('falls back to the raw cardId when display data was missing', () => {
    const narrative = composeAmbushNarrative('core-villain-x-men-toad-00', []);
    assert.equal(
      narrative,
      '"core-villain-x-men-toad-00" entered the city with no Ambush effect.',
    );
  });
});

describe('composeSchemeTwistNarrative', () => {
  it('emits the locked phrase for revealOrPunish', () => {
    const narrative = composeSchemeTwistNarrative('Legacy Virus', 'revealOrPunish');
    assert.equal(
      narrative,
      'Scheme Twist "Legacy Virus": players were forced to reveal a matching hero or suffer a penalty.',
    );
  });

  it('emits the locked phrase for chainedReveals', () => {
    const narrative = composeSchemeTwistNarrative(
      'Negative Zone Prison Breakout',
      'chainedReveals',
    );
    assert.equal(
      narrative,
      'Scheme Twist "Negative Zone Prison Breakout": extra villain-deck cards were revealed.',
    );
  });

  it('emits the locked phrase for woundAll', () => {
    const narrative = composeSchemeTwistNarrative(
      'Unleash the Power of the Cosmic Cube',
      'woundAll',
    );
    assert.equal(
      narrative,
      'Scheme Twist "Unleash the Power of the Cosmic Cube": every player gained wounds.',
    );
  });

  it('emits the locked phrase for koFromHq', () => {
    const narrative = composeSchemeTwistNarrative('Super Hero Civil War', 'koFromHq');
    assert.equal(
      narrative,
      'Scheme Twist "Super Hero Civil War": heroes were KO’d from the HQ.',
    );
  });

  it('emits the locked phrase for midtownBankRobbery', () => {
    const narrative = composeSchemeTwistNarrative(
      'Midtown Bank Robbery',
      'midtownBankRobbery',
    );
    assert.equal(
      narrative,
      'Scheme Twist "Midtown Bank Robbery": the Bank villain captured bystanders and another card was revealed.',
    );
  });

  it('falls back to the raw cardId when display data was missing', () => {
    const narrative = composeSchemeTwistNarrative(
      'core-scheme-twist-legacy-virus',
      'revealOrPunish',
    );
    assert.equal(
      narrative,
      'Scheme Twist "core-scheme-twist-legacy-virus": players were forced to reveal a matching hero or suffer a penalty.',
    );
  });
});

describe('composeEffectResultLogLine (WP-316)', () => {
  it('names the resolved target of a single KO effect in parentheses', () => {
    const line = composeEffectResultLogLine([
      { keyword: 'koHeroCurrentPlayer', targetNames: ['Spider-Man'] },
    ]);
    assert.equal(line, 'the active player KO’d a hero (Spider-Man)');
  });

  it('emits the fixed pending phrase (no target) for a parked interactive KO', () => {
    const line = composeEffectResultLogLine([
      { keyword: 'koHeroCurrentPlayer', targetNames: [], pending: true },
    ]);
    assert.equal(line, 'the active player must KO a hero');
  });

  it('renders the bare generic label for a no-target effect (wound / bystander)', () => {
    const line = composeEffectResultLogLine([
      { keyword: 'gainWoundEachPlayer', targetNames: [] },
    ]);
    assert.equal(line, 'every player gained a wound');
  });

  it('joins multiple resolved target names with ", " inside the parentheses', () => {
    const line = composeEffectResultLogLine([
      { keyword: 'koHeroEachPlayer', targetNames: ['Spider-Man', 'Hulk'] },
    ]);
    assert.equal(line, 'every player KO’d a hero (Spider-Man, Hulk)');
  });

  it('joins multiple effect clauses with "; " in dispatch order', () => {
    const line = composeEffectResultLogLine([
      { keyword: 'koHeroCurrentPlayer', targetNames: ['Spider-Man'] },
      { keyword: 'captureHqHeroRightmost', targetNames: ['Iron Man'] },
      { keyword: 'gainWoundEachPlayer', targetNames: [] },
    ]);
    assert.equal(
      line,
      'the active player KO’d a hero (Spider-Man); the rightmost HQ hero was captured (Iron Man); every player gained a wound',
    );
  });

  it('falls back to the raw ext_id when the fire site could not resolve a name', () => {
    // why: the fire site substitutes the raw ext_id into targetNames when
    // G.cardDisplayData had no entry; the composer renders it verbatim.
    const line = composeEffectResultLogLine([
      { keyword: 'heroDeckTopToEscape', targetNames: ['core-hero-spider-man-00'] },
    ]);
    assert.equal(line, 'the top of the hero deck escaped (core-hero-spider-man-00)');
  });
});

describe('composeMastermindStrikeNarrative', () => {
  it('emits the locked Master Strike sentence with the resolved name', () => {
    const narrative = composeMastermindStrikeNarrative('Dr. Doom Strike');
    assert.equal(narrative, 'Master Strike: "Dr. Doom Strike" resolved.');
  });

  it('falls back to the raw cardId when display data was missing', () => {
    const narrative = composeMastermindStrikeNarrative('master-strike-00');
    assert.equal(narrative, 'Master Strike: "master-strike-00" resolved.');
  });
});

describe('composeHealNarrative (WP-381)', () => {
  it('emits the locked sentence for a single Wound', () => {
    assert.equal(
      composeHealNarrative(1),
      "Used Healing, KO'ing 1 Wound(s) from hand.",
    );
  });

  it('emits the locked sentence for multiple Wounds', () => {
    assert.equal(
      composeHealNarrative(2),
      "Used Healing, KO'ing 2 Wound(s) from hand.",
    );
  });
});
