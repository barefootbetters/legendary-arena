#!/usr/bin/env tsx
/**
 * validate.ts
 * Runs full validation against local card data.  Designed to be the
 * `pnpm registry:validate` command — exits with code 1 on any error
 * so CI fails fast.
 *
 * Usage:
 *   pnpm validate
 *   CARDS_DIR=data/metadata HEALTH_OUT=dist/registry-health.json pnpm validate
 *
 * Environment variables:
 *   CARDS_DIR   Path to folder containing card-types.json + {abbr}.json files.
 *               Defaults to "data/metadata" (relative to cwd).
 *   HEALTH_OUT  Where to write the JSON health report.
 *               Defaults to "dist/registry-health.json".
 */

import { writeFile, mkdir } from "node:fs/promises";
import { resolve }          from "node:path";
import { createRegistryFromLocalFiles } from "../src/impl/localRegistry.js";

const METADATA_DIR = resolve(process.env["CARDS_DIR"] ?? "data/metadata");
const HEALTH_OUT   = resolve(process.env["HEALTH_OUT"] ?? "dist/registry-health.json");

async function main() {
  console.log("🔍  Legendary Arena — Registry Validation\n");
  console.log(`  Metadata dir: ${METADATA_DIR}`);
  console.log(`  Health out:   ${HEALTH_OUT}`);
  console.log("");

  const registry = await createRegistryFromLocalFiles({
    metadataDir: METADATA_DIR,
  });

  const health = registry.validate();
  const info   = registry.info();

  // ── Print summary ──────────────────────────────────────────────────────────
  console.log("📊  Summary");
  console.log(`   Sets indexed:  ${health.summary.setsIndexed}`);
  console.log(`   Sets loaded:   ${health.summary.setsLoaded}`);
  console.log(`   Total heroes:  ${health.summary.totalHeroes}`);
  console.log(`   Total cards:   ${health.summary.totalCards}`);
  console.log(`   Parse errors:  ${health.summary.parseErrors}`);
  console.log(`   Sets:          ${info.loadedSetAbbrs.join(", ") || "(none)"}`);
  console.log("");

  if (health.errors.length > 0) {
    console.error(`❌  ${health.errors.length} error(s) found:\n`);
    for (const e of health.errors) {
      const loc = e.setAbbr ? `[${e.setAbbr}]` : "";
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
    health.summary.parseErrors > 0 ||
    health.errors.some((e) =>
      [
        "SET_INDEX_INVALID",
        "SET_SCHEMA_INVALID",
        "SET_FILE_ERROR",
        "INDEX_FILE_ERROR",
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
