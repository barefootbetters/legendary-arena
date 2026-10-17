#!/usr/bin/env node
/**
 * check-node-pin.mjs — asserts the Node toolchain pin is consistent (WP-400 / D-24205).
 *
 * why: the Node version used to be restated across 21 `node-version` entries
 * in 9 GitHub workflow files. A partial bump is invisible: someone updates
 * ci.yml, misses sweep-weekly.yml, and nothing complains until a
 * version-sensitive failure reproduces in one environment and not another. Two
 * Cloudflare Pages builds three days apart reported 22.22.0 and 22.16.0 from
 * this same repository, which is the drift this check exists to prevent.
 *
 * Not checked here: the production droplet's Node, which the
 * `legendary-arena-lab` repo's `10-node.ps1` installs. This check used to
 * compare render.yaml's `NODE_VERSION` envVars, back when Render built the game
 * server. That rule was removed when Render was deleted in Phase 7
 * (2026-10-16); render.yaml is historical and no longer feeds any host.
 *
 * Exit 0 when every rule holds; exit 1 with a full-sentence message naming the
 * file and the mismatch otherwise.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PIN_FILE = ".node-version";
const WORKFLOW_DIRECTORY = join(".github", "workflows");
const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Reads the pinned version and asserts it is a single exact version.
 *
 * @returns {string} The pinned version, e.g. "22.23.1".
 */
function readPinnedVersion() {
  let raw;
  try {
    raw = readFileSync(PIN_FILE, "utf8");
  } catch {
    throw new Error(
      `${PIN_FILE} is missing. It is the single source of truth for the Node ` +
        `toolchain version (D-24205); create it containing one exact version ` +
        `such as 22.23.1.`
    );
  }

  const lines = raw.split("\n").filter((line) => line.trim() !== "");
  if (lines.length !== 1) {
    throw new Error(
      `${PIN_FILE} must contain exactly one non-empty line but contains ` +
        `${lines.length}. Remove the extra lines; setup-node and both hosts ` +
        `read the whole file as a version string.`
    );
  }

  const version = lines[0].trim();
  if (!EXACT_VERSION_PATTERN.test(version)) {
    throw new Error(
      `${PIN_FILE} contains "${version}", which is not an exact MAJOR.MINOR.PATCH ` +
        `version. A floating value such as "22" or "22.x" re-opens the patch ` +
        `drift this pin exists to close (D-24205).`
    );
  }
  return version;
}

/**
 * Asserts no workflow restates a literal Node version.
 *
 * why: workflows must read the pin via `node-version-file`. A literal
 * `node-version:` key is the restatement this packet removed.
 */
function checkWorkflowsUseTheFile() {
  const offenders = [];
  for (const fileName of readdirSync(WORKFLOW_DIRECTORY)) {
    if (!fileName.endsWith(".yml") && !fileName.endsWith(".yaml")) {
      continue;
    }
    const filePath = join(WORKFLOW_DIRECTORY, fileName);
    const lines = readFileSync(filePath, "utf8").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      // why: match the literal key only. `node-version-file:` legitimately
      // contains the same prefix, so the trailing character matters.
      if (/node-version\s*:/.test(lines[index])) {
        offenders.push(`${filePath}:${index + 1}`);
      }
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `${offenders.length} workflow line(s) still restate a literal Node ` +
        `version instead of reading ${PIN_FILE}: ${offenders.join(", ")}. ` +
        `Replace each with "node-version-file: ${PIN_FILE}" (D-24205).`
    );
  }
}

/**
 * Asserts no package.json engines.node was converted from a floor to a pin.
 *
 * why: `engines` describes what the code requires; `.node-version` describes
 * what we build with. Collapsing them over- or under-constrains one of them.
 */
function checkEnginesStayFloors() {
  const manifests = [
    "package.json",
    join("apps", "server", "package.json"),
    join("apps", "engine-runner", "package.json"),
    join("apps", "replay-producer", "package.json"),
  ];

  for (const manifestPath of manifests) {
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      continue;
    }
    const nodeRange = manifest.engines?.node;
    if (nodeRange !== undefined && EXACT_VERSION_PATTERN.test(nodeRange)) {
      throw new Error(
        `${manifestPath} pins engines.node to the exact version "${nodeRange}". ` +
          `engines is a FLOOR (">=22") describing what the code requires; the ` +
          `build version lives in ${PIN_FILE} (D-24205). Restore the range.`
      );
    }
  }
}

readPinnedVersion();
checkWorkflowsUseTheFile();
checkEnginesStayFloors();
