import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREPLAN_STATUS_VALUES,
  type PrePlanStatusValue,
} from '@legendary-arena/preplan';
import {
  sampleDisruptionResultFixture,
  sampleDisruptionResultWithCardFixture,
} from './index';

describe('preplan fixtures drift sentinels', () => {
  test('PREPLAN_STATUS_VALUES has exactly three members in canonical order', () => {
    // why: failure here means a status value was added to the union
    // without updating the canonical array, or vice versa, and a
    // corresponding UI surface (PrePlanStepList template, store
    // recordDisruption guard, fixtures) likely also needs updates.
    assert.equal(PREPLAN_STATUS_VALUES.length, 3);
    assert.deepStrictEqual(
      [...PREPLAN_STATUS_VALUES],
      ['active', 'invalidated', 'consumed'],
    );
    const exhaustiveByStatus: { [K in PrePlanStatusValue]: number } = {
      active: 1,
      invalidated: 1,
      consumed: 1,
    };
    assert.equal(Object.keys(exhaustiveByStatus).length, 3);
  });

  test('DisruptionNotification field-set (no-card variant) matches the four required fields', () => {
    // why: failure here means DisruptionNotification drifted (field
    // renamed, added, or removed) since this WP was authored;
    // reconcile the fixture, the <PrePlanNotification /> template,
    // and the WP body before re-running.
    const fieldNames = Object.keys(sampleDisruptionResultFixture.notification)
      .sort()
      .join(',');
    assert.equal(
      fieldNames,
      'affectedPlayerId,message,prePlanId,sourcePlayerId',
    );
  });

  test('DisruptionNotification field-set (with-card variant) matches the four required fields plus affectedCardExtId', () => {
    // why: this variant additionally protects the conditional render
    // path in <PrePlanNotification />. Same rationale as the no-card
    // variant — rename / add / remove in DisruptionNotification fails
    // here at fixture-load time rather than at component-mount time.
    const fieldNames = Object.keys(
      sampleDisruptionResultWithCardFixture.notification,
    )
      .sort()
      .join(',');
    assert.equal(
      fieldNames,
      'affectedCardExtId,affectedPlayerId,message,prePlanId,sourcePlayerId',
    );
  });
});
