#!/usr/bin/env node
/**
 * check-node-pin.mjs — asserts the Node toolchain pin is consistent (WP-400 / D-24205).
 *
 * why: the Node version is restated in 23 places — 21 `node-version` entries
 * across 9 GitHub workflow files, plus two `NODE_VERSION` envVars in
 * render.yaml. A partial bump is invisible: someone updates ci.yml, misses
 * sweep-weekly.yml, and nothing complains until a version-sensitive failure
 * reproduces in one environment and not another. Two Cloudflare Pages builds
 * three days apart reported 22.22.0 and 22.16.0 from this same repository,
 * which is the drift this check exists to prevent recurring.
 *
 * why: Render's documented precedence is
 * `NODE_VERSION` > `.node-version` > `.nvmrc` > `engines`, so render.yaml's
 * envVar OUTRANKS the pin file. Leaving it stale does not merely duplicate the
 * value — it silently overrides it on the host that runs the game server.
 * That is why rule 2 below compares rather than assumes.
 *
 * Exit 0 when every rule holds; exit 1 with a full-sentence message naming the
 * file and the mismatch otherwise.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PIN_FILE = ".node-version";
const RENDER_FILE = "render.yaml";
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
 * Asserts both render.yaml NODE_VERSION envVars equal the pinned version.
 *
 * @param {string} pinnedVersion - The version from `.node-version`.
 */
function checkRenderEnvironmentVariables(pinnedVersion) {
  const renderYaml = readFileSync(RENDER_FILE, "utf8");
  const lines = renderYaml.split("\n");

  const foundValues = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes("key: NODE_VERSION")) {
      continue;
    }
    const valueLine = lines[index + 1] ?? "";
    const match = valueLine.match(/value:\s*"?([^"\s]+)"?/);
    foundValues.push({ lineNumber: index + 2, value: match ? match[1] : "(none)" });
  }

  if (foundValues.length === 0) {
    throw new Error(
      `${RENDER_FILE} declares no NODE_VERSION envVar. Render's precedence puts ` +
        `NODE_VERSION above ${PIN_FILE}, so removing it silently changes which ` +
        `version the server host builds with.`
    );
  }

  for (const found of foundValues) {
    if (found.value !== pinnedVersion) {
      throw new Error(
        `${RENDER_FILE}:${found.lineNumber} sets NODE_VERSION to "${found.value}" ` +
          `but ${PIN_FILE} pins "${pinnedVersion}". Render's NODE_VERSION ` +
          `OUTRANKS ${PIN_FILE}, so this mismatch does not merely duplicate the ` +
          `value — it overrides the pin on the server host. Update ` +
          `${RENDER_FILE} to "${pinnedVersion}".`
      );
    }
  }
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

const pinnedVersion = readPinnedVersion();
checkRenderEnvironmentVariables(pinnedVersion);
checkWorkflowsUseTheFile();
checkEnginesStayFloors();
