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
 *   --cache-control <v> Cache-Control header set on every uploaded object
 *                      (default: "public, max-age=300, must-revalidate").
 *                      Pass "" to upload with no Cache-Control at all.
 *   --dry-run          Encode to <dist> only; skip the upload + verify.
 *
 * Examples:
 *   # WP-421 Surface-2 move clips (short SFX, default spec):
 *   node scripts/upload-move-sfx-to-r2.mjs --src ./move-sfx-src
 *
 *   # A music loop — do NOT trim, and let it be a bit heavier:
 *   node scripts/upload-move-sfx-to-r2.mjs --src ./music-src --max-seconds 0 --bitrate 192k
 *
 * Backfilling Cache-Control onto ALREADY-uploaded objects:
 *   rclone skips a re-upload when size and modtime match, so simply re-running
 *   this script will NOT rewrite the header on existing objects. Force it:
 *     rclone copy <dist-dir> r2:legendary-images/audio/music/ \
 *       --s3-no-check-bucket --ignore-times \
 *       --header-upload "Cache-Control: public, max-age=300, must-revalidate"
 *   Objects uploaded before this flag existed carry NO Cache-Control and are
 *   cached at Cloudflare's default TTL, so they need this one-time backfill.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
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

// why: these objects have FIXED filenames (menace-calm.mp3, play-card.mp3) that
// get REPLACED in place, so the immutable long-max-age recipe used for
// content-addressed card images is exactly wrong here — it would pin a stale
// clip at the edge effectively forever. Uploaded without any Cache-Control they
// inherit Cloudflare's default TTL, which is how the 4x music loops uploaded on
// 2026-08-17 kept serving the previous 9.6s files to every listener until a
// manual purge; the stale copy was invisible to a HEAD probe (HEAD is not
// cached, GET is), so it read as a successful swap. A short TTL plus
// revalidation makes a replacement land on its own within minutes, and the
// revalidation itself is a cheap 304 against the object's ETag.
const DEFAULT_CACHE_CONTROL = 'public, max-age=300, must-revalidate';
const cacheControl = readFlag('--cache-control', DEFAULT_CACHE_CONTROL);

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
// why: an empty --cache-control is an explicit opt-out, so the flag is omitted
// entirely rather than sending an empty header value that R2 would store.
const cacheControlArgs =
  cacheControl.length > 0 ? ['--header-upload', `Cache-Control: ${cacheControl}`] : [];

const stems = sources.map(({ parsed }) => parsed.name);
for (const stem of stems) {
  run('rclone', [
    'copyto',
    '--s3-no-check-bucket',
    ...cacheControlArgs,
    join(distDir, `${stem}.mp3`),
    `${r2Dest}/${stem}.mp3`,
  ]);
  console.log(`uploaded ${stem}.mp3 -> ${r2Dest}/${stem}.mp3`);
}

if (cacheControlArgs.length > 0) {
  console.log(`\nCache-Control set on all ${stems.length} object(s): ${cacheControl}`);
} else {
  console.log(`\nNo Cache-Control set (--cache-control was empty).`);
}

// ── Step 3: verify (GET, not HEAD — mirrors the WP-412/413 assets-leg checks) ─

// why: the public URL is derivable for ANY dest inside the legendary-images
// bucket — the bucket is served verbatim under images.legendary-arena.com — so
// verification is no longer limited to the one hard-coded SFX prefix. It used to
// be, and that gap is why the 2026-08-17 music uploads printed
// "Skipping GET-verify" twice and nobody noticed the edge was serving the
// previous files.
const BUCKET_PREFIX = 'r2:legendary-images/';
if (!r2Dest.startsWith(BUCKET_PREFIX)) {
  console.log(`\nUploaded to ${r2Dest}. Skipping GET-verify (dest is outside ${BUCKET_PREFIX}).`);
  process.exit(0);
}
const publicBase = `https://images.legendary-arena.com/${r2Dest.slice(BUCKET_PREFIX.length)}`;

const nullSink = process.platform === 'win32' ? 'NUL' : '/dev/null';
const expectedBytesByStem = new Map(
  stems.map((stem) => [stem, statSync(join(distDir, `${stem}.mp3`)).size]),
);

let failures = 0;
for (const stem of stems) {
  const url = `${publicBase}/${stem}.mp3`;
  try {
    // why: a GET, never a HEAD. Cloudflare caches GET responses but answers HEAD
    // from origin, so a HEAD probe reports the object you just uploaded while
    // every real listener is still being served the previous one. Verifying with
    // HEAD is how a stale swap passes review.
    const headers = run('curl', ['-sS', '-o', nullSink, '-D', '-', url]);
    const ok200 = /^HTTP\/[\d.]+ 200/m.test(headers);
    const isAudio = /content-type:\s*audio\/mpeg/i.test(headers);

    // why: the byte length is what proves the NEW file is being served. Status
    // and content-type are equally true of the stale copy.
    const servedBytes = Number(/content-length:\s*(\d+)/i.exec(headers)?.[1] ?? -1);
    const expectedBytes = expectedBytesByStem.get(stem);
    const isCurrent = servedBytes === expectedBytes;

    const cacheControlHeader = /cache-control:\s*(.+)/i.exec(headers)?.[1]?.trim() ?? '';
    const cacheStatus = /cf-cache-status:\s*(\S+)/i.exec(headers)?.[1] ?? 'unknown';

    if (ok200 && isAudio && isCurrent) {
      console.log(`verified 200 audio/mpeg ${servedBytes}B  cf=${cacheStatus}  ${url}`);
      if (cacheControlHeader.length === 0) {
        console.warn(`  WARNING: no Cache-Control on ${stem}.mp3 — a future replacement will serve stale until purged.`);
      }
    } else if (ok200 && isAudio && !isCurrent) {
      failures += 1;
      console.error(
        `STALE   ${url}\n` +
        `        served ${servedBytes} bytes but uploaded ${expectedBytes} (cf-cache-status: ${cacheStatus}).\n` +
        `        The upload succeeded; Cloudflare is serving a cached copy. Purge this URL.`,
      );
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
console.log(`\nAll ${stems.length} clip(s) live on R2 and served current.`);
