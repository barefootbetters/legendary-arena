/**
 * Unit tests for board keyword helpers.
 *
 * Tests Patrol, Guard, and Ambush keyword helpers, drift-detection for
 * BOARD_KEYWORDS, and serialization proof for cardKeywords records.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPatrolModifier,
  isGuardBlocking,
  hasAmbush,
} from './boardKeywords.logic.js';
import { BOARD_KEYWORDS } from './boardKeywords.types.js';
import type { BoardKeyword } from './boardKeywords.types.js';
import type { CityZone } from './city.types.js';
import type { CardExtId } from '../state/zones.types.js';

describe('Board keyword helpers', () => {
  // -------------------------------------------------------------------------
  // Patrol
  // -------------------------------------------------------------------------

  it('getPatrolModifier returns 1 for card with Patrol', () => {
    const keywords: Record<CardExtId, BoardKeyword[]> = {
      'v-patrol': ['patrol'],
    };

    assert.equal(getPatrolModifier('v-patrol' as CardExtId, keywords), 1);
  });

  it('getPatrolModifier returns 0 for card without Patrol', () => {
    const keywords: Record<CardExtId, BoardKeyword[]> = {
      'v-patrol': ['patrol'],
    };

    assert.equal(getPatrolModifier('v-plain' as CardExtId, keywords), 0);
  });

  // -------------------------------------------------------------------------
  // Guard
  // -------------------------------------------------------------------------

  it('isGuardBlocking returns true when Guard card is at higher index', () => {
    const city: CityZone = [null, 'v-target' as CardExtId, null, 'v-guard' as CardExtId, null];
    const keywords: Record<CardExtId, BoardKeyword[]> = {
      'v-guard': ['guard'],
    };

    assert.equal(isGuardBlocking(city, 1, keywords), true);
  });

  it('isGuardBlocking returns false when no Guard between target and escape', () => {
    const city: CityZone = ['v-guard' as CardExtId, null, 'v-target' as CardExtId, null, null];
    const keywords: Record<CardExtId, BoardKeyword[]> = {
      'v-guard': ['guard'],
    };

    // Guard at index 0, target at index 2 — no Guard at index > 2
    assert.equal(isGuardBlocking(city, 2, keywords), false);
  });

  it('isGuardBlocking returns false when targeting the Guard card itself', () => {
    const city: CityZone = [null, null, null, 'v-guard' as CardExtId, null];
    const keywords: Record<CardExtId, BoardKeyword[]> = {
      'v-guard': ['guard'],
    };

    // Target index 3 (the Guard itself) — no Guard at index > 3
    assert.equal(isGuardBlocking(city, 3, keywords), false);
  });

  // -------------------------------------------------------------------------
  // Ambush
  // -------------------------------------------------------------------------

  it('hasAmbush returns true for Ambush card', () => {
    const keywords: Record<CardExtId, BoardKeyword[]> = {
      'v-ambush': ['ambush'],
    };

    assert.equal(hasAmbush('v-ambush' as CardExtId, keywords), true);
  });

  it('hasAmbush returns false for non-Ambush card', () => {
    const keywords: Record<CardExtId, BoardKeyword[]> = {
      'v-ambush': ['ambush'],
    };

    assert.equal(hasAmbush('v-plain' as CardExtId, keywords), false);
  });

  // -------------------------------------------------------------------------
  // Drift detection
  // -------------------------------------------------------------------------

  it('BOARD_KEYWORDS contains exactly patrol, ambush, guard', () => {
    // why: drift-detection — canonical array must match BoardKeyword union.
    // If a keyword is added to the union, it must also appear here.
    assert.deepStrictEqual(
      [...BOARD_KEYWORDS],
      ['patrol', 'ambush', 'guard'],
    );
  });

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  it('JSON.stringify succeeds for cardKeywords record', () => {
    const keywords: Record<CardExtId, BoardKeyword[]> = {
      'v-patrol': ['patrol'],
      'v-ambush': ['ambush'],
      'v-guard': ['guard'],
      'v-multi': ['patrol', 'ambush'],
    };

    const serialized = JSON.stringify(keywords);
    assert.equal(typeof serialized, 'string');
    assert.ok(serialized.length > 0);
  });
});
