/**
 * upload-move-sfx-to-r2.mjs — Encode + upload arena-client audio clips to R2.
 *
 * Born as the WP-421 Surface-2 move-SFX assets leg (`play-card` / `recruit-hero`
 * / `attack-villain` / `draw-cards` / `end-turn`.mp3), but deliberately
 * **content-driven**, not hard-coded to those five — it encodes and uploads
 * whatever audio sits in the source directory, so the same tool serves the
 * Surface-3 turn cues and the adaptive-music work still to come. Mirrors
 * `scripts/upload-themes-to-r2.mjs` (the rclone `r2:` remote) and WP-412's encode
 * recipe (mp3, 128 kbps, 44.1 kHz, short tail-faded SFX).
 *
 * Audio bytes are NEVER committed to git (D-24219 — R2 is the sole audio
 * surface); this script only reads local sources and pushes to R2.
 *
 * Prerequisites:
 *   - ffmpeg on PATH
 *   - rclone installed + configured with an "r2:" remote (the same remote
 *     `upload-themes-to-r2.mjs` uses: `rclone lsd r2:legendary-images` succeeds)
 *   - R2 credentials **in the environment** — the r2: remote is `env_auth = true`,
 *     so it reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY rather than storing
 *     keys in rclone.conf. They live in the repo's local `.env`; load them into
 *     the shell before running or every upload fails on AccessDenied.
 *   - curl on PATH (for the post-upload verification GET)
 *   - Source clips in the source dir, named by their **target stem** (the R2
 *     filename without extension — hyphens, never underscores, per the repo
 *     image-URL rule), any audio extension: e.g. `play-card.wav`, `end-turn.ogg`.
 *
 * Usage:
 *   node scripts/upload-move-sfx-to-r2.mjs [options]
 *
 * Options:
 *   --src <dir>        Source directory (default: ./audio-src relative to CWD)
 *   --dist <dir>       Encoded-output directory (default: <src>/dist)
 *   --dest <r2path>    R2 destination dir (default: r2:legendary-images/audio/sound-effects)
 *   --max-seconds <n>  Trim each clip to <= n seconds with an 80 ms tail fade.
 *                      Default 1.6 (short SFX). Pass 0 to DISABLE trimming/fade —
 *                      REQUIRED for music loops and any clip meant to play in full.
 *   --bitrate <k>      mp3 bitrate (default: 128k)
 *   --dry-run          Encode to <dist> only; skip the upload + verify.
 *
 * Examples:
 *   # WP-421 Surface-2 move clips (short SFX, default spec):
 *   node scripts/upload-move-sfx-to-r2.mjs --src ./move-sfx-src
 *
 *   # A music loop — do NOT trim, and let it be a bit heavier:
 *   node scripts/upload-move-sfx-to-r2.mjs --src ./music-src --max-seconds 0 --bitrate 192k
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve, parse } from 'node:path';

// ── Argument parsing (a tiny flag reader — no dependency) ────────────────────

function readFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) return fallback;
  return process.argv[index + 1];
}

const cwd = process.cwd();
const sourceDir = resolve(cwd, readFlag('--src', './audio-src'));
const distDir = resolve(cwd, readFlag('--dist', join(sourceDir, 'dist')));
const r2Dest = readFlag('--dest', 'r2:legendary-images/audio/sound-effects');
const maxSeconds = Number(readFlag('--max-seconds', '1.6'));
const bitrate = readFlag('--bitrate', '128k');
const dryRun = process.argv.includes('--dry-run');

// why: R2 audio is served via images.legendary-arena.com under the
// audio/sound-effects/ prefix (the ewiki hosting rule); the public host is fixed
// so verification can GET the uploaded clip. If --dest points elsewhere the
// verify step is skipped (below) rather than guessing a public URL.
const DEFAULT_R2_DEST = 'r2:legendary-images/audio/sound-effects';
const PUBLIC_BASE = 'https://images.legendary-arena.com/audio/sound-effects';

// why: accept only real audio inputs; ignore a stray dist/ or dotfile so a
// re-run that points --src at a dir already containing dist/ does not try to
// re-encode its own output.
const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.flac', '.aif', '.aiff', '.m4a']);

if (Number.isNaN(maxSeconds) || maxSeconds < 0) {
  console.error(`--max-seconds must be a non-negative number (got '${readFlag('--max-seconds', '1.6')}')`);
  process.exit(1);
}

if (!existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`);
  console.error(`Create it and add clips named by target stem (e.g. play-card.wav), or pass --src <dir>.`);
  process.exit(1);
}

// ── Discover source clips (content-driven — not a hard-coded list) ───────────

const sources = readdirSync(sourceDir)
  .map((filename) => ({ filename, parsed: parse(filename) }))
  .filter(({ parsed }) => AUDIO_EXTENSIONS.has(parsed.ext.toLowerCase()))
  .sort((a, b) => a.parsed.name.localeCompare(b.parsed.name));

if (sources.length === 0) {
  console.error(`No audio files in ${sourceDir}. Add clips named by target stem (any of ${[...AUDIO_EXTENSIONS].join(', ')}).`);
  process.exit(1);
}

// why: an underscore in a target stem would violate the repo image-URL rule
// (hyphens only) and mismatch the manifest — fail loudly at encode time rather
// than shipping an unreachable clip.
const badNames = sources.filter(({ parsed }) => parsed.name.includes('_'));
if (badNames.length > 0) {
  console.error(`Target stems must use hyphens, not underscores: ${badNames.map((s) => s.filename).join(', ')}`);
  process.exit(1);
}

// why: AWS_EC2_METADATA_DISABLED turns a missing-credential run into an instant
// error instead of a ~2 minute silent hang. The r2: remote is env_auth=true, so
// when AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are absent from the environment
// the SDK falls back to the EC2 instance-metadata endpoint (169.254.169.254),
// which black-holes on a workstation and retries before it ever reports failure.
const childEnvironment = { ...process.env, AWS_EC2_METADATA_DISABLED: 'true' };

function run(cmd, args) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnvironment,
  });
}

// ── Step 1: encode ───────────────────────────────────────────────────────────

// why: WP-412's locked SFX recipe — 44.1 kHz mp3 at the chosen bitrate, source
// metadata stripped. When --max-seconds > 0 the clip is trimmed to a short
// tactile hit with an 80 ms tail fade (the areverse/afade-in/areverse pair fades
// the LAST 80 ms without needing the clip's exact length). --max-seconds 0
// disables both — the correct choice for music loops and full-length cues.
const TAIL_FADE = 'areverse,afade=t=in:st=0:d=0.08,areverse';

mkdirSync(distDir, { recursive: true });
for (const { filename, parsed } of sources) {
  const input = join(sourceDir, filename);
  const output = join(distDir, `${parsed.name}.mp3`);
  const trimArgs = maxSeconds > 0 ? ['-t', String(maxSeconds), '-af', TAIL_FADE] : [];
  run('ffmpeg', [
    '-y', '-i', input,
    ...trimArgs,
    '-ar', '44100',
    '-b:a', bitrate,
    '-map_metadata', '-1',
    output,
  ]);
  console.log(`encoded  ${parsed.name}.mp3${maxSeconds > 0 ? ` (<=${maxSeconds}s, tail-faded)` : ' (full length)'}`);
}

if (dryRun) {
  console.log(`\nDry run — encoded ${sources.length} clip(s) to ${distDir}. No upload.`);
  process.exit(0);
}

// ── Step 2: upload ───────────────────────────────────────────────────────────

// why: --s3-no-check-bucket skips rclone's pre-upload bucket-existence probe,
// which otherwise issues a CreateBucket call. R2 API tokens are scoped to object
// read/write and cannot create buckets, so that probe fails the whole upload with
// "CreateBucket ... 403 AccessDenied" even though the bucket plainly exists and
// the token can write to it. This matches every other documented R2 upload in the
// repo (docs/ops/RUNBOOK-r2-image-cache-control.md, wiki/card-image-acquisition.md).
const stems = sources.map(({ parsed }) => parsed.name);
for (const stem of stems) {
  run('rclone', ['copyto', '--s3-no-check-bucket', join(distDir, `${stem}.mp3`), `${r2Dest}/${stem}.mp3`]);
  console.log(`uploaded ${stem}.mp3 -> ${r2Dest}/${stem}.mp3`);
}

// ── Step 3: verify (GET, not HEAD — mirrors the WP-412/413 assets-leg checks) ─

// why: only the default images.legendary-arena.com prefix has a known public URL
// to GET; a custom --dest is uploaded but not verified here (no way to derive its
// public URL), so say so rather than silently skip.
if (r2Dest !== DEFAULT_R2_DEST) {
  console.log(`\nUploaded to ${r2Dest}. Skipping GET-verify (no known public URL for a non-default --dest).`);
  process.exit(0);
}

const nullSink = process.platform === 'win32' ? 'NUL' : '/dev/null';
let failures = 0;
for (const stem of stems) {
  const url = `${PUBLIC_BASE}/${stem}.mp3`;
  try {
    const headers = run('curl', ['-sS', '-o', nullSink, '-D', '-', url]);
    const ok200 = /^HTTP\/[\d.]+ 200/m.test(headers);
    const isAudio = /content-type:\s*audio\/mpeg/i.test(headers);
    if (ok200 && isAudio) {
      console.log(`verified 200 audio/mpeg  ${url}`);
    } else {
      failures += 1;
      console.error(`FAILED  ${url}  (200=${ok200} audio/mpeg=${isAudio})`);
    }
  } catch (err) {
    failures += 1;
    console.error(`FAILED  ${url}  (${err.message})`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} clip(s) not verified. Check the R2 upload + Cloudflare cache.`);
  process.exit(1);
}
console.log(`\nAll ${stems.length} clip(s) live on R2.`);
