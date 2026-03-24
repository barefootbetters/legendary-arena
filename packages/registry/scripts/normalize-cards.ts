#!/usr/bin/env tsx
/**
 * normalize-cards.ts
 * Reads raw card JSON files from INPUT_DIR and writes normalized, schema-valid
 * cards to OUTPUT_FILE (dist/cards.json).
 *
 * Usage:
 *   INPUT_DIR=data/raw OUTPUT_FILE=dist/cards.json pnpm normalize
 *   # or with defaults:
 *   pnpm normalize
 */

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { CardSchema, CardIDSchema, CANONICAL_ID_REGEX } from "../src/schema.js";
import type { Card } from "../src/types/index.js";

const INPUT_DIR   = resolve(process.env["INPUT_DIR"]   ?? "data/raw");
const OUTPUT_FILE = resolve(process.env["OUTPUT_FILE"] ?? "dist/cards.json");
const DATA_VERSION = process.env["DATA_VERSION"] ?? "1.0.0";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a canonical ID from type + name.  Deterministic — no randomness. */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function deriveCanonicalId(type: string, name: string): string {
  return `${type}-${toSlug(name)}`;
}

/** Derive the canonical image filename from a card ID */
function deriveImageFileName(cardId: string): string {
  return `${cardId}.webp`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📂  Reading raw cards from: ${INPUT_DIR}`);

  const fileNames = (await readdir(INPUT_DIR)).filter(
    (f) => extname(f) === ".json"
  );

  if (fileNames.length === 0) {
    console.error("❌  No JSON files found in INPUT_DIR:", INPUT_DIR);
    process.exit(1);
  }

  const normalized: Card[] = [];
  let errorCount = 0;

  for (const fileName of fileNames.sort()) {
    const filePath = join(INPUT_DIR, fileName);
    let raw: unknown;

    try {
      raw = JSON.parse(await readFile(filePath, "utf8"));
    } catch (err) {
      console.error(`  ✗ Parse error in ${fileName}:`, err);
      errorCount++;
      continue;
    }

    const items: unknown[] = Array.isArray(raw) ? raw : [raw];

    for (const item of items) {
      if (typeof item !== "object" || item === null) {
        console.warn(`  ⚠ Skipping non-object entry in ${fileName}`);
        continue;
      }

      const obj = item as Record<string, unknown>;

      // ── Derive canonical ID if missing or non-canonical ────────────────
      const rawType = String(obj["type"] ?? "").toLowerCase();
      const rawName = String(obj["name"] ?? "");
      const rawId   = String(obj["id"]   ?? "");

      const canonicalId = CANONICAL_ID_REGEX.test(rawId)
        ? rawId
        : deriveCanonicalId(rawType, rawName);

      // ── Ensure images.standard.fileName is canonical ───────────────────
      const existingImages =
        typeof obj["images"] === "object" && obj["images"] !== null
          ? (obj["images"] as Record<string, unknown>)
          : {};
      const existingStandard =
        typeof existingImages["standard"] === "object" &&
        existingImages["standard"] !== null
          ? (existingImages["standard"] as Record<string, unknown>)
          : {};

      const canonicalFileName = deriveImageFileName(canonicalId);

      const normalizedObj = {
        ...obj,
        id: canonicalId,
        dataVersion: DATA_VERSION,
        keywords: Array.isArray(obj["keywords"]) ? obj["keywords"] : [],
        abilities: Array.isArray(obj["abilities"]) ? obj["abilities"] : [],
        images: {
          ...existingImages,
          standard: {
            ...existingStandard,
            fileName: canonicalFileName,
          },
        },
      };

      const result = CardSchema.safeParse(normalizedObj);
      if (result.success) {
        normalized.push(result.data);
        console.log(`  ✓ ${result.data.id}`);
      } else {
        console.error(`  ✗ Validation failed for "${canonicalId}":`);
        for (const issue of result.error.issues) {
          console.error(`    [${issue.path.join(".")}] ${issue.message}`);
        }
        errorCount++;
      }
    }
  }

  if (errorCount > 0) {
    console.error(`\n❌  ${errorCount} error(s) — fix before publishing.`);
    process.exit(1);
  }

  // Sort deterministically by ID
  normalized.sort((a, b) => a.id.localeCompare(b.id));

  // Write output
  await mkdir(resolve("dist"), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(normalized, null, 2), "utf8");

  console.log(`\n✅  Normalized ${normalized.length} cards → ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
