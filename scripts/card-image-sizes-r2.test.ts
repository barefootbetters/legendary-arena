/**
 * Tests for the card image size-tier R2 wrapper's rclone arguments
 * (WP-888 / D-24840). No rclone process is started.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  R2_BUCKET,
  TIER_CACHE_CONTROL,
  buildPullArguments,
  buildPushManifestArguments,
  buildPushTierArguments,
} from './card-image-sizes-r2.mjs';
import { DEFAULT_CACHE_CONTROL } from './upload-metadata-to-r2.mjs';

const WORK_ROOT = path.resolve('work-root');
const DESTRUCTIVE_VERBS = ['sync', 'move', 'delete', 'deletefile', 'purge'];

test('the constants name the bucket and the immutable tier header', () => {
  assert.equal(R2_BUCKET, 'r2:legendary-images');
  assert.equal(TIER_CACHE_CONTROL, 'public, max-age=31536000, immutable');
  assert.equal(DEFAULT_CACHE_CONTROL, 'public, max-age=300, must-revalidate');
});

test('buildPullArguments copies the listed originals of one set into r2-originals', () => {
  const filesFromPath = path.join('tmp', '3dtc.txt');
  assert.deepEqual(buildPullArguments({ workRoot: WORK_ROOT, setAbbr: '3dtc', filesFromPath, isDryRun: false }), [
    'copy',
    'r2:legendary-images/3dtc/',
    path.join(WORK_ROOT, 'r2-originals', '3dtc'),
    '--files-from',
    filesFromPath,
    '--s3-no-check-bucket',
  ]);
  assert.deepEqual(buildPullArguments({ workRoot: WORK_ROOT, setAbbr: '3dtc', filesFromPath, isDryRun: true }), [
    'copy',
    'r2:legendary-images/3dtc/',
    path.join(WORK_ROOT, 'r2-originals', '3dtc'),
    '--files-from',
    filesFromPath,
    '--s3-no-check-bucket',
    '--dry-run',
  ]);
});

test('buildPushTierArguments copies one tier folder to <set>/<tier>/ with --checksum and the immutable header', () => {
  assert.deepEqual(buildPushTierArguments({ workRoot: WORK_ROOT, setAbbr: 'co2e', tier: 'phone', isDryRun: false }), [
    'copy',
    path.join(WORK_ROOT, 'sizes', 'co2e', 'phone'),
    'r2:legendary-images/co2e/phone/',
    '--checksum',
    '--header-upload',
    'Cache-Control: public, max-age=31536000, immutable',
    '--s3-no-check-bucket',
  ]);
  assert.deepEqual(buildPushTierArguments({ workRoot: WORK_ROOT, setAbbr: 'co2e', tier: 'thumb', isDryRun: true }), [
    'copy',
    path.join(WORK_ROOT, 'sizes', 'co2e', 'thumb'),
    'r2:legendary-images/co2e/thumb/',
    '--checksum',
    '--header-upload',
    'Cache-Control: public, max-age=31536000, immutable',
    '--s3-no-check-bucket',
    '--dry-run',
  ]);
});

test('buildPushManifestArguments copies the manifest under metadata/image-sizes/ with the five-minute header', () => {
  assert.deepEqual(buildPushManifestArguments({ workRoot: WORK_ROOT, setAbbr: 'co2e', isDryRun: false }), [
    'copyto',
    path.join(WORK_ROOT, 'sizes', 'co2e', 'image-sizes.json'),
    'r2:legendary-images/metadata/image-sizes/co2e.json',
    '--checksum',
    '--header-upload',
    'Cache-Control: public, max-age=300, must-revalidate',
    '--s3-no-check-bucket',
  ]);
  assert.deepEqual(buildPushManifestArguments({ workRoot: WORK_ROOT, setAbbr: 'co2e', isDryRun: true }), [
    'copyto',
    path.join(WORK_ROOT, 'sizes', 'co2e', 'image-sizes.json'),
    'r2:legendary-images/metadata/image-sizes/co2e.json',
    '--checksum',
    '--header-upload',
    'Cache-Control: public, max-age=300, must-revalidate',
    '--s3-no-check-bucket',
    '--dry-run',
  ]);
});

test('no argument array contains a destructive rclone verb', () => {
  const argumentArrays = [];
  for (const isDryRun of [false, true]) {
    argumentArrays.push(buildPullArguments({ workRoot: WORK_ROOT, setAbbr: 'core', filesFromPath: 'list.txt', isDryRun }));
    argumentArrays.push(buildPushManifestArguments({ workRoot: WORK_ROOT, setAbbr: 'core', isDryRun }));
    for (const tier of ['thumb', 'phone', 'large']) {
      argumentArrays.push(buildPushTierArguments({ workRoot: WORK_ROOT, setAbbr: 'core', tier, isDryRun }));
    }
  }
  for (const rcloneArguments of argumentArrays) {
    for (const verb of DESTRUCTIVE_VERBS) {
      assert.ok(!rcloneArguments.includes(verb), `rclone ${rcloneArguments.join(' ')} must not contain ${verb}`);
    }
    assert.ok(rcloneArguments[0] === 'copy' || rcloneArguments[0] === 'copyto');
    assert.ok(rcloneArguments.includes('--s3-no-check-bucket'));
  }
});
