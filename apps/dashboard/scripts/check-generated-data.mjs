#!/usr/bin/env node
/**
 * check-generated-data.mjs — fail fast, and legibly, when the dashboard's
 * generated data files are missing.
 *
 * why: three files under `src/data/` are build outputs, gitignored, and
 * imported STATICALLY by `useCoverageLedger.ts`. A fresh clone or worktree has
 * none of them, so those imports fail at module load and take down every suite
 * that transitively imports the composable — `useInPlayCoverage.test.ts` fails
 * only because `useInPlayCoverage.ts` imports `useCoverageLedger.js`, not for
 * any reason of its own.
 *
 * why: the resulting output is a module-resolution error with no hint of the
 * remedy, and it reads exactly like a regression on main. It is not — CI
 * generates these first (`ci.yml`: prebuild:snapshot, then prebuild:coverage,
 * then test:coverage). This cost two sessions real time before anyone ran the
 * suite in the canonical clone and saw it pass. Running as `pretest` turns a
 * confusing red suite into one line naming the command that fixes it.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIRECTORY = resolve(SCRIPT_DIRECTORY, "..");

/**
 * Generated data files, each paired with the script that produces it.
 *
 * why: the remedy is per-file rather than a single blanket "run the build",
 * because `build` also runs `vite build` — far more than a test run needs.
 */
const GENERATED_DATA_FILES = [
  {
    relativePath: join("src", "data", "governance-snapshot.json"),
    remedy: "pnpm --filter @legendary-arena/dashboard prebuild:snapshot",
  },
  {
    relativePath: join("src", "data", "coverage-ledger.json"),
    remedy: "pnpm --filter @legendary-arena/dashboard prebuild:coverage",
  },
  {
    relativePath: join("src", "data", "runtime-observed-hollows.json"),
    remedy: "pnpm --filter @legendary-arena/dashboard prebuild:coverage",
  },
  {
    relativePath: join("src", "data", "effect-implementation-index.json"),
    remedy: "pnpm --filter @legendary-arena/dashboard prebuild:effect-index",
  },
];

const missingFiles = [];
for (const generatedFile of GENERATED_DATA_FILES) {
  if (!existsSync(join(DASHBOARD_DIRECTORY, generatedFile.relativePath))) {
    missingFiles.push(generatedFile);
  }
}

if (missingFiles.length === 0) {
  process.exit(0);
}

const remedies = [];
for (const missingFile of missingFiles) {
  if (!remedies.includes(missingFile.remedy)) {
    remedies.push(missingFile.remedy);
  }
}

const fileList = missingFiles
  .map((missingFile) => `  - apps/dashboard/${missingFile.relativePath.replace(/\\/g, "/")}`)
  .join("\n");
const remedyList = remedies.map((remedy) => `  ${remedy}`).join("\n");

process.stderr.write(
  `\nDashboard tests cannot run: ${missingFiles.length} generated data file(s) are missing.\n\n` +
    `${fileList}\n\n` +
    `These are build outputs and are gitignored, so a fresh clone or git worktree\n` +
    `will not have them. This is NOT a broken test or a regression on main — CI\n` +
    `generates them before testing. Run:\n\n` +
    `${remedyList}\n\n` +
    `then re-run the tests.\n\n`
);
process.exit(1);
