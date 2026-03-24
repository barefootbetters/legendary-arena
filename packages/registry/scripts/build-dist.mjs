#!/usr/bin/env node
/**
 * build-dist.mjs
 * Post-tsc build step.
 * Reads dist/cards.json (produced by normalize-cards.ts) and generates:
 *   dist/index.json         lightweight id -> minimal metadata
 *   dist/sets.json          unique set names
 *   dist/keywords.json      unique keywords
 *   dist/registry-info.json high-level counts and metadata
 *
 * Run automatically via: pnpm build  (after tsc)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve }                    from "node:path";

const DIST           = resolve("dist");
const CARDS_JSON     = resolve(DIST, "cards.json");
const DATA_VERSION   = process.env.DATA_VERSION ?? "1.0.0";
const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL ?? "";

async function main() {
  let cards;
  try {
    cards = JSON.parse(await readFile(CARDS_JSON, "utf8"));
  } catch {
    console.error(
      "❌  dist/cards.json not found — run 'pnpm normalize' first."
    );
    process.exit(1);
  }

  await mkdir(DIST, { recursive: true });

  // ── index.json ─────────────────────────────────────────────────────────────
  const index = cards.map((c) => ({
    id:                c.id,
    name:              c.name,
    type:              c.type,
    set:               c.set,
    rarity:            c.rarity,
    standardFileName:  c.images.standard.fileName,
  }));
  await writeFile(
    resolve(DIST, "index.json"),
    JSON.stringify(index, null, 2)
  );

  // ── sets.json ──────────────────────────────────────────────────────────────
  const sets = [...new Set(cards.map((c) => c.set))].sort();
  await writeFile(resolve(DIST, "sets.json"), JSON.stringify(sets, null, 2));

  // ── keywords.json ──────────────────────────────────────────────────────────
  const keywords = [...new Set(cards.flatMap((c) => c.keywords))].sort();
  await writeFile(
    resolve(DIST, "keywords.json"),
    JSON.stringify(keywords, null, 2)
  );

  // ── registry-info.json ─────────────────────────────────────────────────────
  const info = {
    dataVersion: DATA_VERSION,
    totalCards:  cards.length,
    sets,
    types:       [...new Set(cards.map((c) => c.type))].sort(),
    keywords,
    generatedAt: new Date().toISOString(),
    ...(IMAGE_BASE_URL ? { imageBaseUrl: IMAGE_BASE_URL } : {}),
  };
  await writeFile(
    resolve(DIST, "registry-info.json"),
    JSON.stringify(info, null, 2)
  );

  console.log(
    `✅  build-dist: index.json, sets.json, keywords.json, registry-info.json`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
