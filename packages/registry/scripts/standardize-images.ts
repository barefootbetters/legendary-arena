#!/usr/bin/env tsx
/**
 * standardize-images.ts
 * Renames raw images to canonical filenames (<cardId>.webp) and writes a
 * manifest JSON mapping CardID -> canonical filename.
 *
 * Expects images to already be in WebP format (run convert-to-webp.mjs first).
 * Organises output by card type: images/standard/{type}/{id}.webp
 *
 * Usage:
 *   INPUT_IMG_DIR=images/raw OUTPUT_IMG_DIR=images/standard pnpm standardize-img
 */

import { readdir, copyFile, mkdir, writeFile, readFile } from "node:fs/promises";
import { join, extname, resolve, basename } from "node:path";
import { CANONICAL_ID_REGEX, CardTypeSchema } from "../src/schema.js";

const INPUT_IMG_DIR   = resolve(process.env["INPUT_IMG_DIR"]  ?? "images/raw");
const OUTPUT_IMG_DIR  = resolve(process.env["OUTPUT_IMG_DIR"] ?? "images/standard");
const CARDS_JSON_PATH = resolve(process.env["CARDS_JSON"]     ?? "dist/cards.json");
const MANIFEST_OUT    = resolve(process.env["MANIFEST_OUT"]   ?? "dist/image-manifest.json");

interface CardStub {
  id: string;
  type: string;
  images: { standard: { fileName: string } };
}

async function main() {
  // ── Load canonical card list ───────────────────────────────────────────────
  let cards: CardStub[];
  try {
    cards = JSON.parse(await readFile(CARDS_JSON_PATH, "utf8")) as CardStub[];
  } catch {
    console.error(
      `❌  Could not read ${CARDS_JSON_PATH}. Run 'pnpm normalize' first.`
    );
    process.exit(1);
  }

  // Build a lookup: canonical filename -> card
  const fileNameToCard = new Map<string, CardStub>(
    cards.map((c) => [c.images.standard.fileName, c])
  );

  // ── Scan input folder for WebP files ──────────────────────────────────────
  const inputFiles = (await readdir(INPUT_IMG_DIR)).filter(
    (f) => extname(f).toLowerCase() === ".webp"
  );

  console.log(`📂  Found ${inputFiles.length} WebP files in ${INPUT_IMG_DIR}`);

  const manifest: Record<string, string> = {}; // cardId -> fileName
  const collisions: string[] = [];
  let copied = 0;
  let skipped = 0;

  for (const rawFile of inputFiles.sort()) {
    // Normalise the source filename to derive what card it maps to
    const srcBase = basename(rawFile, ".webp")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+|-+$/g, "");

    // Try exact match first, then prefix match
    const card =
      fileNameToCard.get(`${srcBase}.webp`) ??
      [...fileNameToCard.values()].find((c) => c.id === srcBase);

    if (!card) {
      console.warn(`  ⚠ No card matches image "${rawFile}" — skipping`);
      skipped++;
      continue;
    }

    const canonicalFileName = card.images.standard.fileName;

    if (manifest[card.id]) {
      collisions.push(
        `Duplicate image for card "${card.id}": ${rawFile} conflicts with existing entry`
      );
      continue;
    }

    // Validate type matches CardTypeSchema
    const typeResult = CardTypeSchema.safeParse(card.type);
    if (!typeResult.success) {
      console.warn(`  ⚠ Unknown type "${card.type}" for ${card.id} — skipping`);
      skipped++;
      continue;
    }

    const destDir  = join(OUTPUT_IMG_DIR, card.type);
    const destPath = join(destDir, canonicalFileName);

    await mkdir(destDir, { recursive: true });
    await copyFile(join(INPUT_IMG_DIR, rawFile), destPath);

    manifest[card.id] = canonicalFileName;
    console.log(`  ✓ ${rawFile} → ${card.type}/${canonicalFileName}`);
    copied++;
  }

  // ── Report collisions ──────────────────────────────────────────────────────
  if (collisions.length > 0) {
    console.error(`\n❌  Collisions detected:`);
    for (const c of collisions) console.error(`   ${c}`);
    process.exit(1);
  }

  // ── Check for cards with no image ─────────────────────────────────────────
  const missingImages = cards.filter((c) => !manifest[c.id]);
  if (missingImages.length > 0) {
    console.warn(
      `\n⚠  ${missingImages.length} card(s) have no matched image:`
    );
    for (const c of missingImages) console.warn(`   ${c.id}`);
  }

  await writeFile(MANIFEST_OUT, JSON.stringify(manifest, null, 2), "utf8");

  console.log(
    `\n✅  Copied ${copied} images, skipped ${skipped} → manifest: ${MANIFEST_OUT}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
