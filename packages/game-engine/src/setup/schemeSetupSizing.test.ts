/**
 * Tests for scheme-specific setup sizing (WP-511 / D-24321).
 *
 * resolveEffectiveWoundsCount returns 6×players for Legacy Virus (its printed
 * "6 Wounds per player" setup, deliberately below the 30 config-floor) and the
 * requested count for every other scheme (passthrough). resolveEffectiveTwistCount
 * sizes Super Hero Civil War's twist stack to its printed 8 / 5 split (D-24733).
 *
 * Pure helper — no boardgame.io, no G. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

describe('resolveEffectiveTwistCount (D-24733)', () => {
  it('sizes core Civil War at its printed 8 twists for 2-3 players and 5 for 4-5', () => {
    assert.equal(resolveEffectiveTwistCount(CIVIL_WAR, 2, 8), 8);
    assert.equal(resolveEffectiveTwistCount(CIVIL_WAR, 3, 8), 8);
    assert.equal(resolveEffectiveTwistCount(CIVIL_WAR, 4, 8), 5);
    assert.equal(resolveEffectiveTwistCount(CIVIL_WAR, 5, 8), 5);
  });

  it('keeps 8 twists for solo Civil War (1 player mirrors 2, as its loss map does)', () => {
    assert.equal(resolveEffectiveTwistCount(CIVIL_WAR, 1, 8), 8);
  });

  it('sizes the msp1 reprint, which prints the same clause, identically', () => {
    assert.equal(resolveEffectiveTwistCount('msp1/super-hero-civil-war', 3, 8), 8);
    assert.equal(resolveEffectiveTwistCount('msp1/super-hero-civil-war', 4, 8), 5);
    assert.equal(resolveEffectiveTwistCount('msp1/super-hero-civil-war', 5, 8), 5);
  });

  it('passes every other scheme through unchanged at 4-5 players, including Civil War reprints with a different split', () => {
    assert.equal(resolveEffectiveTwistCount('core/midtown-bank-robbery', 4, 8), 8);
    assert.equal(resolveEffectiveTwistCount('core/replace-earths-leaders-with-killbots', 5, 5), 5);
    assert.equal(resolveEffectiveTwistCount(LEGACY_VIRUS, 5, 8), 8);
    assert.equal(resolveEffectiveTwistCount('test/test-scheme-001', 4, 11), 11);
    // why: co2e prints 6 / 5 and cvwr Epic prints 9 / 6 — not the core clause, so out of scope here.
    assert.equal(resolveEffectiveTwistCount('co2e/super-hero-civil-war', 4, 8), 8);
    assert.equal(resolveEffectiveTwistCount('cvwr/epic-super-hero-civil-war', 5, 8), 8);
  });
});
