/**
 * Tests for the metadata uploader's rclone arguments (D-24674).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRcloneCopyArgs,
  DEFAULT_CACHE_CONTROL,
  METADATA_SOURCE_FOLDERS,
  R2_METADATA_DESTINATION,
} from './upload-metadata-to-r2.mjs';

test('every upload sets the short Cache-Control and copies (never syncs) into the metadata prefix', () => {
  const args = buildRcloneCopyArgs({
    sourceFolder: 'data/cards',
    cacheControl: DEFAULT_CACHE_CONTROL,
    isBackfill: false,
    isDryRun: false,
  });
  assert.equal(args[0], 'copy', 'copy is additive; sync would delete the other folder\'s files');
  assert.equal(args[2], R2_METADATA_DESTINATION);
  const headerIndex = args.indexOf('--header-upload');
  assert.notEqual(headerIndex, -1);
  assert.equal(args[headerIndex + 1], 'Cache-Control: public, max-age=300, must-revalidate');
  assert.ok(!args.includes('--ignore-times'), 'a plain run only uploads changed files');
  assert.ok(args.includes('--checksum'), 'staged files have fresh modtimes, so compare by MD5');
  assert.ok(!args.includes('--dry-run'));
});

test('--backfill forces a re-upload so existing objects get the header', () => {
  const args = buildRcloneCopyArgs({
    sourceFolder: 'data/metadata',
    cacheControl: DEFAULT_CACHE_CONTROL,
    isBackfill: true,
    isDryRun: true,
  });
  assert.ok(args.includes('--ignore-times'));
  assert.ok(!args.includes('--checksum'), 'a backfill rewrites every object regardless of content');
  assert.ok(args.includes('--dry-run'));
});

test('both local sources publish, taxonomy first', () => {
  assert.deepEqual(METADATA_SOURCE_FOLDERS, ['data/metadata', 'data/cards']);
});
