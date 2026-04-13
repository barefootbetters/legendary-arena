/**
 * upload-themes-to-r2.mjs — Uploads theme JSON files to Cloudflare R2.
 *
 * Generates content/themes/index.json (manifest of all theme filenames),
 * then uploads all theme JSON files + the index to the R2 themes/ directory.
 *
 * Prerequisites:
 *   - rclone installed and configured with an "r2:" remote
 *   - Theme JSON files exist in content/themes/
 *
 * Usage:
 *   node scripts/upload-themes-to-r2.mjs
 *
 * What it uploads:
 *   content/themes/*.json  →  r2:legendary-arena/themes/*.json
 *   content/themes/index.json  →  r2:legendary-arena/themes/index.json
 */

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const themesDirectory = join(projectRoot, 'content', 'themes');
const r2Destination = 'r2:legendary-arena/themes/';

// ── Step 1: Regenerate index.json ───────────────────────────────────────────

const themeFiles = readdirSync(themesDirectory)
  .filter((filename) => filename.endsWith('.json') && filename !== 'index.json')
  .sort();

const indexPath = join(themesDirectory, 'index.json');
writeFileSync(indexPath, JSON.stringify(themeFiles, null, 2) + '\n', 'utf8');
console.log(`Generated index.json with ${themeFiles.length} theme entries.`);

// ── Step 2: Validate all theme files parse as JSON ──────────────────────────

let validationErrors = 0;
for (const filename of themeFiles) {
  try {
    const data = JSON.parse(readFileSync(join(themesDirectory, filename), 'utf8'));
    const expectedId = filename.replace('.json', '');
    if (data.themeId !== expectedId) {
      console.log(`  ERROR: ${filename} — themeId "${data.themeId}" does not match filename.`);
      validationErrors++;
    }
  } catch (parseError) {
    console.log(`  ERROR: ${filename} — invalid JSON: ${parseError.message}`);
    validationErrors++;
  }
}

if (validationErrors > 0) {
  console.log(`\n${validationErrors} validation error(s). Fix before uploading.`);
  process.exit(1);
}

console.log(`All ${themeFiles.length} themes validated.`);

// ── Step 3: Upload to R2 via rclone ─────────────────────────────────────────

// why: --include filters ensure only JSON files are uploaded. CATALOG.md,
// THEME-INDEX.md, and other non-JSON files are excluded.
const rcloneCommand = `rclone copy "${themesDirectory}" "${r2Destination}" --include "*.json" --progress`;

console.log(`\nUploading to ${r2Destination}...`);
console.log(`  Command: ${rcloneCommand}\n`);

try {
  execSync(rcloneCommand, { stdio: 'inherit', timeout: 60000 });
  console.log(`\nUpload complete. ${themeFiles.length + 1} files sent to R2.`);
} catch (uploadError) {
  console.error('\nUpload failed:', uploadError.message);
  console.error('Verify rclone is configured with an r2: remote. Run: rclone config');
  process.exit(1);
}
