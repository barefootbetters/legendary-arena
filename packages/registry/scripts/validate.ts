#!/usr/bin/env tsx
/**
 * validate.ts
 * Runs full validation against local card data.  Designed to be the
 * `pnpm registry:validate` command — exits with code 1 on any error
 * so CI fails fast.
 *
 * Usage:
 *   CARDS_DIR=data/raw DATA_VERSION=1.0.0 pnpm validate
 */

import { writeFile, mkdir } from "node:fs/promises";
import { resolve }          from "node:path";
import { createRegistryFromLocalFiles } from "../src/impl/localRegistry.js";

const CARDS_DIR         = resolve(process.env["CARDS_DIR"]     ?? "data/raw");
const IMAGE_MANIFEST    = process.env["IMAGE_MANIFEST"]         // optional
  ? resolve(process.env["IMAGE_MANIFEST"])
  : undefined;
const DATA_VERSION      = process.env["DATA_VERSION"]          ?? "1.0.0";
const HEALTH_OUT        = resolve(process.env["HEALTH_OUT"]    ?? "dist/registry-health.json");

async function main() {
  console.log("🔍  Legendary Arena — Registry Validation\n");
  console.log(`  Cards dir:       ${CARDS_DIR}`);
  console.log(`  Image manifest:  ${IMAGE_MANIFEST ?? "(not provided)"}`);
  console.log(`  Data version:    ${DATA_VERSION}`);
  console.log("");

  const registry = await createRegistryFromLocalFiles({
    cardsDir:           CARDS_DIR,
    imageManifestPath:  IMAGE_MANIFEST,
    dataVersion:        DATA_VERSION,
  });

  const health = registry.validate();
  const info   = registry.info();

  // ── Print summary ──────────────────────────────────────────────────────────
  console.log("📊  Summary");
  console.log(`   Total cards:      ${health.summary.total}`);
  console.log(`   Valid:            ${health.summary.valid}`);
  console.log(`   Invalid:          ${health.summary.invalid}`);
  console.log(`   Missing images:   ${health.summary.missingImages}`);
  console.log(`   Duplicate IDs:    ${health.summary.duplicateIds}`);
  console.log(`   Sets:             ${info.sets.join(", ") || "(none)"}`);
  console.log("");

  if (health.errors.length > 0) {
    console.error(`❌  ${health.errors.length} error(s) found:\n`);
    for (const e of health.errors) {
      const loc = e.cardId ? `[${e.cardId}]` : e.file ? `[${e.file}]` : "";
      console.error(`   ${e.code} ${loc}: ${e.message}`);
    }
    console.log("");
  }

  // ── Write health report ────────────────────────────────────────────────────
  await mkdir(resolve("dist"), { recursive: true });
  await writeFile(HEALTH_OUT, JSON.stringify(health, null, 2), "utf8");
  console.log(`📄  Health report written → ${HEALTH_OUT}`);

  // ── Exit code ──────────────────────────────────────────────────────────────
  const failed =
    health.summary.invalid > 0 ||
    health.summary.duplicateIds > 0 ||
    health.errors.some((e) =>
      [
        "SCHEMA_INVALID",
        "DUPLICATE_ID",
        "IMAGE_FILENAME_MISMATCH",
        "MISSING_IMAGE_MANIFEST_ENTRY",
        "FILE_PARSE_ERROR",
      ].includes(e.code)
    );

  if (failed) {
    console.error("\n❌  Validation FAILED — fix errors before publishing.\n");
    process.exit(1);
  }

  console.log("\n✅  Validation passed!\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
