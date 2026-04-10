# Execution Contracts Index

## Purpose

This index enumerates the Execution Contracts (ECs) enforced by
`scripts/ec/health-check.ec.mjs`. Every EC ID and description below is
extracted mechanically from the script's `EC_INDEX` object. This file is
documentation only — the script is the authoritative enforcement source.

## Enforcement Map

| EC ID | Severity | Description | Enforced By | Notes |
|---|---|---|---|---|
| EC-ENV-001 | FAIL | Project root must contain a .env file | `checkDotenvFile` | |
| EC-ENV-002 | FAIL | .env must not be identical to .env.example | `checkDotenvFile` | Recorded as passed if .env.example does not exist |
| EC-ENV-003 | WARN | .env must not contain placeholder values (warn-level) | `checkDotenvFile` | Warn-level: placeholders do not cause exit 1 |
| EC-ENV-004 | FAIL | All required environment variables must be present and non-empty | `checkRequiredEnvironmentVariables` | |
| EC-TOOL-001 | FAIL | Node.js major version must be 22+ | `checkNodeVersion` | |
| EC-TOOL-002 | FAIL | pnpm major version must be 8+ | `checkPnpmVersion` | |
| EC-TOOL-003 | FAIL | dotenv-cli must be installed and .env must be parseable (warn-level for parse issues) | `checkDotenvCli` | Binary-missing = FAIL; .env parse failure = WARN |
| EC-TOOL-004 | FAIL | boardgame.io must be installed at 0.50.x and server entrypoint must exist | `checkBoardgameioPackage` | Verifies CJS entrypoint at dist/cjs/server.js |
| EC-TOOL-005 | FAIL | zod must be installed | `checkZodPackage` | |
| EC-CONN-001 | FAIL | PostgreSQL must be reachable using DATABASE_URL and match EXPECTED_DB_NAME if set | `checkPostgresConnection` | |
| EC-CONN-002 | FAIL | boardgame.io server health endpoint must return HTTP 200 | `checkBoardgameioServer` | Probes /health path |
| EC-CONN-003 | FAIL | Cloudflare R2 metadata/sets.json must be reachable | `checkCloudflareR2` | metadata/sets.json is the authoritative registry manifest |
| EC-CONN-004 | FAIL | Cloudflare Pages SPA must be reachable | `checkCloudflarePages` | |
| EC-CONN-005 | FAIL | GitHub repo API must be reachable | `checkGithubApi` | |
| EC-CONN-006 | FAIL | Local git remote origin must point to the correct GitHub repository | `checkGitRemote` | |
| EC-RCLONE-001 | WARN | rclone config should exist (warn-level) | `checkRclone` | Warn-level: missing config does not cause exit 1 |
| EC-RCLONE-002 | FAIL | rclone binary must be installed and on PATH | `checkRclone` | |
| EC-RCLONE-003 | FAIL | rclone must be able to list the R2 bucket root via r2: | `checkRclone` | Skipped as FAIL if rclone binary is missing |

**Total: 18 ECs** (15 FAIL, 3 WARN)

## Completeness Rules

These rules restate the mechanical guarantees already enforced by the script:

- Every EC ID listed above comes from `scripts/ec/health-check.ec.mjs` (`EC_INDEX` object).
- The script's `assertEcCoverage()` function verifies at runtime that every defined EC ID was evaluated. If any EC is defined but unobserved, or observed but undefined, the script exits with code 1.
- If the script changes (EC IDs added, removed, or renamed), this file must be regenerated from the script.
- This file does not define policy. It documents what the script enforces.

---

*Generated from: `scripts/ec/health-check.ec.mjs`*
*EC universe: 18 assertions (15 FAIL, 3 WARN)*
