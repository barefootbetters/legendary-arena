#!/usr/bin/env tsx
/**
 * upload-r2.ts
 * Uploads dist/*.json and images/standard/**/*.webp to Cloudflare R2.
 * Writes dist/registry-info.json with the final public base URLs.
 *
 * Requires:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *   R2_PUBLIC_URL  (e.g. https://assets.legendary-arena.com)
 *
 * Usage:
 *   DATA_VERSION=1.0.0 pnpm upload
 */

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, extname, resolve }             from "node:path";
import {
  S3Client,
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import "dotenv/config";

// ── Config from environment ───────────────────────────────────────────────────
function env(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`❌  Missing required env var: ${key}`);
    process.exit(1);
  }
  return v;
}

const ACCOUNT_ID   = env("R2_ACCOUNT_ID");
const ACCESS_KEY   = env("R2_ACCESS_KEY_ID");
const SECRET_KEY   = env("R2_SECRET_ACCESS_KEY");
const BUCKET       = env("R2_BUCKET_NAME");
const PUBLIC_URL   = env("R2_PUBLIC_URL").replace(/\/$/, "");
const DATA_VERSION = process.env["DATA_VERSION"] ?? "1.0.0";

const DIST_DIR     = resolve("dist");
const IMAGES_DIR   = resolve("images/standard");

// ── R2 client (S3-compatible) ─────────────────────────────────────────────────
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

async function upload(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const input: PutObjectCommandInput = {
    Bucket:      BUCKET,
    Key:         key,
    Body:        body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  };
  await s3.send(new PutObjectCommand(input));
  console.log(`  ✓ uploaded → ${key}`);
}

// ── Upload dist/*.json ────────────────────────────────────────────────────────
async function uploadDataFiles() {
  console.log(`\n📤  Uploading data files for version ${DATA_VERSION}...`);
  const files = (await readdir(DIST_DIR)).filter(
    (f) => extname(f) === ".json"
  );
  for (const file of files) {
    const body = await readFile(join(DIST_DIR, file));
    const key  = `data/${DATA_VERSION}/${file}`;
    await upload(key, body, "application/json");
  }
}

// ── Recursively upload images ─────────────────────────────────────────────────
async function uploadImagesDir(dir: string, keyPrefix: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await uploadImagesDir(fullPath, `${keyPrefix}/${entry.name}`);
    } else if (extname(entry.name).toLowerCase() === ".webp") {
      const body = await readFile(fullPath);
      const key  = `${keyPrefix}/${entry.name}`;
      await upload(key, body, "image/webp");
    }
  }
}

async function uploadImages() {
  console.log(`\n🖼   Uploading images for version ${DATA_VERSION}...`);
  try {
    await stat(IMAGES_DIR);
  } catch {
    console.warn(`  ⚠ images/standard not found — skipping image upload`);
    return;
  }
  await uploadImagesDir(IMAGES_DIR, `images/${DATA_VERSION}`);
}

// ── Write registry-info.json with final URLs ──────────────────────────────────
async function writeRegistryInfo() {
  const infoPath = join(DIST_DIR, "registry-info.json");
  let info: Record<string, unknown> = {};
  try {
    info = JSON.parse(await readFile(infoPath, "utf8"));
  } catch {
    /* start fresh if missing */
  }

  info["publicBaseUrl"] = `${PUBLIC_URL}/data/${DATA_VERSION}`;
  info["imageBaseUrl"]  = `${PUBLIC_URL}/images/${DATA_VERSION}`;
  info["dataVersion"]   = DATA_VERSION;
  info["uploadedAt"]    = new Date().toISOString();

  await writeFile(infoPath, JSON.stringify(info, null, 2), "utf8");
  console.log(`\n📄  Updated dist/registry-info.json with public URLs`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `🚀  Legendary Arena — R2 Upload\n   Bucket: ${BUCKET}\n   Version: ${DATA_VERSION}`
  );

  await uploadDataFiles();
  await uploadImages();
  await writeRegistryInfo();

  console.log(`\n✅  Upload complete!`);
  console.log(`   Data:   ${PUBLIC_URL}/data/${DATA_VERSION}/cards.json`);
  console.log(`   Images: ${PUBLIC_URL}/images/${DATA_VERSION}/{type}/{filename}.webp`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
