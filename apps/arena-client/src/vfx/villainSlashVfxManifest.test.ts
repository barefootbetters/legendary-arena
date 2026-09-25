import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VILLAIN_SLASH_VFX,
  CARD_ASPECT,
  TAKEDOWN_STREAK_WINDOW_MS,
  TAKEDOWN_WORDS,
  isTakedownWord,
  nextTakedownStreak,
  takedownWordForStreak,
  villainSlashAngleForSeq,
} from './villainSlashVfxManifest';
import { EXCESSIVE_VIOLENCE_VFX } from './excessiveViolenceVfxManifest';
import { TRANSFORM_VFX } from './transformVfxManifest';
import { MASTERMIND_HIT_BURST_COLORS } from './mastermindHitVfxManifest';
import { VICTORY_FINALE_VFX } from './victoryFinaleVfxManifest';
import { STRIKE_BLOCKED_VFX } from './strikeBlockedVfxManifest';

describe('villainSlashVfxManifest (WP-755) — the spec', () => {
  test('the spray palette leads with the villain accent, distinct from every other effect lead', () => {
    const lead = VILLAIN_SLASH_VFX.colors[0];
    assert.equal(lead, '#7b1fa2');
    const otherLeads: string[] = [
      EXCESSIVE_VIOLENCE_VFX.colors[0] as string,
      TRANSFORM_VFX.colors[0] as string,
      MASTERMIND_HIT_BURST_COLORS[0] as string,
      VICTORY_FINALE_VFX.colors[0] as string,
      '#960c0c', // the wound vignette (CSS-only, no manifest)
    ];
    for (const threat of Object.values(STRIKE_BLOCKED_VFX)) {
      otherLeads.push(threat.colors[0] as string);
    }
    assert.ok(!otherLeads.includes(lead), `lead ${lead} must differ from ${otherLeads.join(', ')}`);
    assert.deepEqual([...VILLAIN_SLASH_VFX.colors], ['#7b1fa2', '#4a0d67', '#b44fd6']);
  });

  test('spray counts are locked, within the 200-particle ceiling, and full > low', () => {
    assert.equal(VILLAIN_SLASH_VFX.fullParticleCount, 28);
    assert.equal(VILLAIN_SLASH_VFX.lowParticleCount, 10);
    assert.ok(VILLAIN_SLASH_VFX.fullParticleCount <= 200);
    assert.ok(VILLAIN_SLASH_VFX.fullParticleCount > VILLAIN_SLASH_VFX.lowParticleCount);
  });

  test('angles, timings and limits carry the locked values', () => {
    assert.ok(VILLAIN_SLASH_VFX.angles.length > 0);
    assert.deepEqual([...VILLAIN_SLASH_VFX.angles], [-28, 22, -16, 34]);
    assert.equal(VILLAIN_SLASH_VFX.halfFlightMs, 900);
    assert.equal(VILLAIN_SLASH_VFX.streakMs, 260);
    assert.equal(VILLAIN_SLASH_VFX.stainMs, 2400);
    assert.equal(VILLAIN_SLASH_VFX.stainCount, 5);
    assert.equal(VILLAIN_SLASH_VFX.maxLiveHalves, 10);
    assert.equal(VILLAIN_SLASH_VFX.streakCoreColor, '#ffffff');
    assert.equal(VILLAIN_SLASH_VFX.streakGlowColor, '#d6c2ff');
    assert.equal(CARD_ASPECT, 5 / 7);
    assert.equal(TAKEDOWN_STREAK_WINDOW_MS, 4000);
  });

  test('the angle is chosen by seq % 4', () => {
    assert.equal(villainSlashAngleForSeq(0), -28);
    assert.equal(villainSlashAngleForSeq(1), 22);
    assert.equal(villainSlashAngleForSeq(2), -16);
    assert.equal(villainSlashAngleForSeq(3), 34);
    assert.equal(villainSlashAngleForSeq(5), 22);
  });
});

describe('villainSlashVfxManifest (WP-755) — takedown words', () => {
  test('maps each streak length to its locked word', () => {
    assert.equal(takedownWordForStreak(1), null);
    assert.equal(takedownWordForStreak(2), 'DOUBLE TAKEDOWN!');
    assert.equal(takedownWordForStreak(3), 'TRIPLE TAKEDOWN!');
    assert.equal(takedownWordForStreak(4), 'RAMPAGE!');
    assert.equal(takedownWordForStreak(7), 'RAMPAGE!');
  });

  test('isTakedownWord recognises exactly the three takedown words', () => {
    for (const word of TAKEDOWN_WORDS) assert.equal(isTakedownWord(word), true);
    assert.equal(isTakedownWord(null), false);
    assert.equal(isTakedownWord('EXCESSIVE VIOLENCE!'), false);
    assert.equal(isTakedownWord('TRANSFORMED!'), false);
  });
});

describe('villainSlashVfxManifest (WP-755) — nextTakedownStreak', () => {
  test('a null previous state starts a streak of 1', () => {
    assert.deepEqual(nextTakedownStreak(null, '0', 1000), { playerId: '0', atMs: 1000, streak: 1 });
  });

  test('the same player inside the window increments', () => {
    const first = nextTakedownStreak(null, '0', 1000);
    const second = nextTakedownStreak(first, '0', 2500);
    assert.equal(second.streak, 2);
    assert.equal(second.atMs, 2500);
    assert.equal(nextTakedownStreak(second, '0', 3000).streak, 3);
  });

  test('exactly at the window boundary still increments', () => {
    const first = nextTakedownStreak(null, '0', 1000);
    assert.equal(nextTakedownStreak(first, '0', 1000 + TAKEDOWN_STREAK_WINDOW_MS).streak, 2);
  });

  test('past the window resets to 1', () => {
    const first = nextTakedownStreak(null, '0', 1000);
    assert.equal(nextTakedownStreak(first, '0', 1001 + TAKEDOWN_STREAK_WINDOW_MS).streak, 1);
  });

  test('a different player resets to 1', () => {
    const first = nextTakedownStreak(null, '0', 1000);
    const other = nextTakedownStreak(first, '1', 1200);
    assert.equal(other.streak, 1);
    assert.equal(other.playerId, '1');
  });
});
