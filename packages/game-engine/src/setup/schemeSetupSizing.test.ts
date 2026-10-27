/**
 * Tests for scheme-specific setup sizing (WP-511 / D-24321).
 *
 * resolveEffectiveWoundsCount returns 6×players for Legacy Virus (its printed
 * "6 Wounds per player" setup, deliberately below the 30 config-floor) and the
 * requested count for every other scheme (passthrough). resolveEffectiveTwistCount
 * sizes each scheme whose printed twist stack depends on the player count (D-24733 /
 * D-24734); every table row is pinned to its card's Setup text.
 *
 * Pure helper — no boardgame.io, no G. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveEffectiveWoundsCount,
  resolveEffectiveHeroDeckIds,
  resolveEffectiveTwistCount,
} from './schemeSetupSizing.js';

const LEGACY_VIRUS = 'core/legacy-virus-the';
const CIVIL_WAR = 'core/super-hero-civil-war';
const FIVE_HERO_IDS = ['a', 'b', 'c', 'd', 'e'];

describe('resolveEffectiveWoundsCount (WP-511 / D-24321)', () => {
  it('sizes Legacy Virus at 6×players (12/18/24/30 at 2/3/4/5 players)', () => {
    // requestedCount (30) is ignored for Legacy Virus — the scheme rule wins.
    assert.equal(resolveEffectiveWoundsCount(LEGACY_VIRUS, 2, 30), 12);
    assert.equal(resolveEffectiveWoundsCount(LEGACY_VIRUS, 3, 30), 18);
    assert.equal(resolveEffectiveWoundsCount(LEGACY_VIRUS, 4, 30), 24);
    assert.equal(resolveEffectiveWoundsCount(LEGACY_VIRUS, 5, 30), 30);
  });

  it('deliberately falls below the 30 floor at low player counts (Legacy Virus doom clock)', () => {
    // why: 12 < 30 is the point — the small stack is Legacy Virus's Evil-Wins
    // clock; the flat 30 would make "the Wound stack runs out" unreachable.
    assert.ok(resolveEffectiveWoundsCount(LEGACY_VIRUS, 2, 30) < 30);
  });

  it('passes the requested count through unchanged for any other scheme', () => {
    assert.equal(resolveEffectiveWoundsCount('core/midtown-bank-robbery', 2, 30), 30);
    assert.equal(resolveEffectiveWoundsCount('core/super-hero-civil-war', 5, 30), 30);
    assert.equal(resolveEffectiveWoundsCount('test/test-scheme-001', 3, 15), 15);
  });
});

describe('resolveEffectiveHeroDeckIds (WP-515 / D-24328)', () => {
  it('AC-1 sizes Super Hero Civil War to the first 4 hero groups at exactly 2 players', () => {
    assert.deepStrictEqual(
      resolveEffectiveHeroDeckIds(CIVIL_WAR, 2, [...FIVE_HERO_IDS]),
      ['a', 'b', 'c', 'd'],
    );
  });

  it('AC-2 passes Civil War through unchanged at 3/4/5 players', () => {
    // why: the sizing is gated to exactly 2 players — the 5-group deck is fine at 3-5p.
    assert.deepStrictEqual(resolveEffectiveHeroDeckIds(CIVIL_WAR, 3, [...FIVE_HERO_IDS]), FIVE_HERO_IDS);
    assert.deepStrictEqual(resolveEffectiveHeroDeckIds(CIVIL_WAR, 4, [...FIVE_HERO_IDS]), FIVE_HERO_IDS);
    assert.deepStrictEqual(resolveEffectiveHeroDeckIds(CIVIL_WAR, 5, [...FIVE_HERO_IDS]), FIVE_HERO_IDS);
  });

  it('AC-2 passes any non-Civil-War scheme through unchanged at 2 players', () => {
    assert.deepStrictEqual(resolveEffectiveHeroDeckIds(LEGACY_VIRUS, 2, [...FIVE_HERO_IDS]), FIVE_HERO_IDS);
    assert.deepStrictEqual(
      resolveEffectiveHeroDeckIds('core/midtown-bank-robbery', 2, [...FIVE_HERO_IDS]),
      FIVE_HERO_IDS,
    );
  });

  it('returns a list already shorter than 4 unchanged (slice is safe on the short-list path)', () => {
    // why: matchSetup.validate requires 5 ids at 2p, but the helper must not throw or
    // over-shrink a shorter list — slice(0, 4) returns a <4-id list intact.
    assert.deepStrictEqual(resolveEffectiveHeroDeckIds(CIVIL_WAR, 2, ['a', 'b', 'c']), ['a', 'b', 'c']);
  });
});

describe('resolveEffectiveTwistCount (D-24733 / D-24734)', () => {
  const ANY_MASTERMIND = 'core/dr-doom';

  it('sizes core Civil War at its printed 8 twists for 2-3 players and 5 for 4-5', () => {
    assert.equal(resolveEffectiveTwistCount(CIVIL_WAR, ANY_MASTERMIND, 2, 8), 8);
    assert.equal(resolveEffectiveTwistCount(CIVIL_WAR, ANY_MASTERMIND, 3, 8), 8);
    assert.equal(resolveEffectiveTwistCount(CIVIL_WAR, ANY_MASTERMIND, 4, 8), 5);
    assert.equal(resolveEffectiveTwistCount(CIVIL_WAR, ANY_MASTERMIND, 5, 8), 5);
  });

  it('keeps 8 twists for solo Civil War (1 player mirrors 2, as its loss map does)', () => {
    assert.equal(resolveEffectiveTwistCount(CIVIL_WAR, ANY_MASTERMIND, 1, 8), 8);
  });

  it('sizes the msp1 reprint, which prints the same clause, identically', () => {
    assert.equal(resolveEffectiveTwistCount('msp1/super-hero-civil-war', ANY_MASTERMIND, 3, 8), 8);
    assert.equal(resolveEffectiveTwistCount('msp1/super-hero-civil-war', ANY_MASTERMIND, 4, 8), 5);
  });

  it('sizes the Civil War variants that print a different split by their own text (D-24734)', () => {
    assert.equal(resolveEffectiveTwistCount('co2e/super-hero-civil-war', ANY_MASTERMIND, 3, 8), 6);
    assert.equal(resolveEffectiveTwistCount('co2e/super-hero-civil-war', ANY_MASTERMIND, 4, 8), 5);
    assert.equal(resolveEffectiveTwistCount('cvwr/epic-super-hero-civil-war', ANY_MASTERMIND, 1, 8), 9);
    assert.equal(resolveEffectiveTwistCount('cvwr/epic-super-hero-civil-war', ANY_MASTERMIND, 5, 8), 6);
  });

  it('sizes a formula scheme from the player count ("players plus 6"; "8 minus 1 per player")', () => {
    for (const numPlayers of [1, 2, 3, 4, 5]) {
      assert.equal(
        resolveEffectiveTwistCount('antm/transform-commuters-into-giant-ants', ANY_MASTERMIND, numPlayers, 8),
        numPlayers + 6,
      );
      assert.equal(
        resolveEffectiveTwistCount('bkwd/train-black-widows-in-the-red-room', ANY_MASTERMIND, numPlayers, 8),
        8 - numPlayers,
      );
    }
  });

  it('uses 1 Twist for Ritual Sacrifice to Summon Chthon with Lilith, and 6 plus 1 per player otherwise', () => {
    const chthon = 'mdns/ritual-sacrifice-to-summon-chthon';
    assert.equal(resolveEffectiveTwistCount(chthon, 'mdns/lilith-mother-of-demons', 2, 8), 1);
    assert.equal(resolveEffectiveTwistCount(chthon, 'mdns/lilith-mother-of-demons', 5, 8), 1);
    assert.equal(resolveEffectiveTwistCount(chthon, 'mdns/zarathos', 2, 8), 8);
    assert.equal(resolveEffectiveTwistCount(chthon, 'mdns/zarathos', 5, 8), 11);
  });

  it('passes every scheme outside the table through unchanged at every player count', () => {
    for (const numPlayers of [1, 2, 3, 4, 5]) {
      assert.equal(resolveEffectiveTwistCount('core/midtown-bank-robbery', ANY_MASTERMIND, numPlayers, 8), 8);
      assert.equal(resolveEffectiveTwistCount('core/replace-earths-leaders-with-killbots', ANY_MASTERMIND, numPlayers, 5), 5);
      assert.equal(resolveEffectiveTwistCount(LEGACY_VIRUS, ANY_MASTERMIND, numPlayers, 8), 8);
      assert.equal(resolveEffectiveTwistCount('test/test-scheme-001', ANY_MASTERMIND, numPlayers, 11), 11);
    }
  });

  it('keeps the resolved count for a player count outside 1-5', () => {
    assert.equal(resolveEffectiveTwistCount(CIVIL_WAR, ANY_MASTERMIND, 0, 8), 8);
    assert.equal(resolveEffectiveTwistCount(CIVIL_WAR, ANY_MASTERMIND, 6, 8), 8);
  });
});

/** Reads one scheme's printed Setup line(s) from the repo's data/cards directory. */
function readSchemeSetupText(setAbbr: string, schemeSlug: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const setData = JSON.parse(
    readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', `${setAbbr}.json`), 'utf8'),
  ) as { schemes?: Array<{ slug: string; cards?: Array<{ abilities?: string[] }> }> };
  const scheme = (setData.schemes ?? []).find((entry) => entry.slug === schemeSlug);
  assert.ok(scheme !== undefined, `Scheme ${setAbbr}/${schemeSlug} must exist in data/cards/${setAbbr}.json.`);
  const setupLines: string[] = [];
  for (const card of scheme.cards ?? []) {
    for (const ability of card.abilities ?? []) {
      if (ability.startsWith('Setup:')) {
        setupLines.push(ability);
      }
    }
  }
  return setupLines.join(' ');
}

describe('resolveEffectiveTwistCount rows match the printed Setup text (D-24734)', () => {
  // why: each row's printed twist clause, quoted from the card data. If a card's text
  // changes, its row must be re-derived; this pin fails loudly instead of drifting.
  const PRINTED_TWIST_CLAUSES: ReadonlyArray<{ schemeId: string; clause: string; counts: readonly number[] }> = [
    { schemeId: 'core/super-hero-civil-war', clause: 'For 2-3 players, use 8 Twists. For 4-5 players, use 5 Twists.', counts: [8, 8, 8, 5, 5] },
    { schemeId: 'msp1/super-hero-civil-war', clause: 'For 2-3 players, use 8 Twists. For 4-5 players, use 5 Twists.', counts: [8, 8, 8, 5, 5] },
    { schemeId: 'co2e/super-hero-civil-war', clause: '1-3 players: 6 Twists. 4-5 players: 5 Twists.', counts: [6, 6, 6, 5, 5] },
    { schemeId: 'cvwr/epic-super-hero-civil-war', clause: '1-3 players: 9 Twists. 4-5 players: 6 Twists.', counts: [9, 9, 9, 6, 6] },
    { schemeId: 'dead/deadpool-kills-the-marvel-universe', clause: '1-3 players: 6 Twists. 4-5 Players: 5 Twists.', counts: [6, 6, 6, 5, 5] },
    { schemeId: 'dstr/duels-of-science-and-magic', clause: '2 players: 9 Twists. 1 or 4 players: 10 Twists. 3 or 5 players: 11 Twists.', counts: [10, 9, 11, 10, 11] },
    { schemeId: 'rvlt/secret-hydra-corruption', clause: '1 player: 7 Twists. 2-3 players: 9 Twists. 4-5 players: 11 Twists.', counts: [7, 9, 9, 11, 11] },
    { schemeId: 'ssw2/fountain-of-eternal-life-the', clause: '8 Twists. (1 player: 4 Twists.)', counts: [4, 8, 8, 8, 8] },
    { schemeId: 'wpnx/go-after-heroes-loved-ones', clause: '1 player: 8 Twists. 2-4 players: 10 Twists. 5 players: 11 Twists.', counts: [8, 10, 10, 10, 11] },
    { schemeId: 'antm/transform-commuters-into-giant-ants', clause: 'Twists equal to the number of players plus 6.', counts: [7, 8, 9, 10, 11] },
    { schemeId: 'bkpt/poison-lakes-with-nanite-microbots', clause: 'Twists equal to 5 plus the number of players.', counts: [6, 7, 8, 9, 10] },
    { schemeId: 'bkwd/train-black-widows-in-the-red-room', clause: '8 Twists, minus 1 Twist per player.', counts: [7, 6, 5, 4, 3] },
    { schemeId: 'bkwd/sniper-rifle-assassins', clause: '11 Twists, minus 1 Twist per player.', counts: [10, 9, 8, 7, 6] },
    { schemeId: 'co2e/negative-zone-prison-outbreak', clause: '6 Twists plus 1 per player.', counts: [7, 8, 9, 10, 11] },
    { schemeId: 'co2e/enshrouded-identity', clause: '3 Twists, plus 1 Twist per player.', counts: [4, 5, 6, 7, 8] },
    { schemeId: 'gotg/unite-the-shards', clause: 'Twists equal to the number of players plus 5.', counts: [6, 7, 8, 9, 10] },
    { schemeId: 'mdns/ritual-sacrifice-to-summon-chthon', clause: '6 Twists, plus 1 per player.', counts: [7, 8, 9, 10, 11] },
    { schemeId: 'msis/sacrifice-for-the-soul-stone', clause: 'Twists equal to the number of players plus 4.', counts: [5, 6, 7, 8, 9] },
    { schemeId: 'nmut/trapped-in-the-insane-asylum', clause: '1 Twist, plus 2 Twists per player.', counts: [3, 5, 7, 9, 11] },
    { schemeId: 'rlmk/devolve-with-xerogen-crystals', clause: 'Add Twists equal to the number of players plus 3.', counts: [4, 5, 6, 7, 8] },
    { schemeId: 'wpnx/wipe-heroes-memories', clause: 'Twists equal to the number of players plus 4.', counts: [5, 6, 7, 8, 9] },
  ];

  for (const row of PRINTED_TWIST_CLAUSES) {
    it(`${row.schemeId} prints "${row.clause}" and resolves ${row.counts.join('/')} at 1-5 players`, () => {
      const [setAbbr, schemeSlug] = row.schemeId.split('/') as [string, string];
      const setupText = readSchemeSetupText(setAbbr, schemeSlug);
      assert.ok(setupText.includes(row.clause), `${row.schemeId} Setup text is "${setupText}".`);
      for (let playerIndex = 0; playerIndex < row.counts.length; playerIndex++) {
        assert.equal(
          resolveEffectiveTwistCount(row.schemeId, 'core/dr-doom', playerIndex + 1, 8),
          row.counts[playerIndex],
          `${row.schemeId} at ${playerIndex + 1} players`,
        );
      }
    });
  }
});
