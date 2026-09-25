#!/usr/bin/env node
/**
 * Wiki lint — the Inspector lane's corpus health check for `wiki/`.
 *
 * Implements the "Lint Targets" listed in `wiki/SCHEMA.md` that no existing gate
 * covers (`check-links.mjs` already fails the build on broken in-body links, so
 * those are not repeated here):
 *
 *   - every entity page has front matter with the required fields;
 *   - `type` and `status` are in their closed sets;
 *   - a `canonical` page has a non-empty `source`;
 *   - the five required H2 sections are present, in order;
 *   - every `related` path and every relative `source` path resolves;
 *   - every entity page is linked from `wiki/INDEX.md` (navigation-first: a page
 *     nothing indexes is effectively invisible);
 *   - the flat-structure cap (75 entity pages) holds.
 *
 * Report-only: it never edits a page and always exits 0 on a completed run, so it
 * can feed the dashboard's Inspector lane without becoming a merge gate. The
 * Inspector reports; the Builder fixes.
 *
 * Usage:
 *   node scripts/wiki-lint.mjs                 # human-readable report
 *   node scripts/wiki-lint.mjs --json <path>   # also write the JSON report
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const WIKI_DIRECTORY = join(REPO_ROOT, 'wiki');

// why: SCHEMA.md §File Layout — these files are not entity pages, so the
// entity-page contract does not apply to them (each has a documented reason).
export const RESERVED_FILE_NAMES = [
  'SCHEMA.md',
  'README.md',
  'INDEX.md',
  'architecture-inventory.md',
  'tags.md',
];

// why: SCHEMA.md §Field reference — `source` is conditional (canonical only), and
// the two mirror-page fields are optional, so neither is listed here.
export const REQUIRED_FRONT_MATTER_FIELDS = [
  'title',
  'type',
  'tags',
  'related',
  'status',
  'last-reviewed',
];

// why: SCHEMA.md §Entity Types (Closed Set) — engine types plus the web/design
// types. The shorter list in SCHEMA's "Lint Targets" paragraph predates the
// web/design types; the Entity Types section is the authority.
export const ENTITY_TYPES = [
  'Mechanic',
  'System',
  'Card-Type',
  'Keyword',
  'Concept',
  'Tutorial',
  'Guide',
  'Tool',
  'Brand',
];

export const STATUS_VALUES = ['canonical', 'draft', 'deprecated'];

export const REQUIRED_SECTIONS = ['Summary', 'Mechanics', 'Interactions', 'Edge Cases', 'References'];

// why: `apps/wiki-viewer/scripts/project-wiki.mjs` generates these pages into the
// site at projection time (they have no `wiki/` source file), so a `related` link
// to one is valid even though the file is absent from `wiki/`.
export const PROJECTED_PAGE_NAMES = ['changelog.md'];

// why: SCHEMA.md §Flat-structure cap — beyond this a SCHEMA amendment must
// introduce partitioning before more pages are added.
export const ENTITY_PAGE_CAP = 75;

/**
 * Split a page into its front-matter block and body. Returns `frontMatter: null`
 * when the page does not open with a `---` delimited block.
 *
 * @param {string} text The page text.
 * @returns {{ frontMatter: string | null, body: string }}
 */
export function splitFrontMatter(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { frontMatter: null, body: normalized };
  }
  const closingIndex = normalized.indexOf('\n---', 4);
  if (closingIndex === -1) {
    return { frontMatter: null, body: normalized };
  }
  const frontMatter = normalized.slice(4, closingIndex);
  const bodyStart = normalized.indexOf('\n', closingIndex + 1);
  const body = bodyStart === -1 ? '' : normalized.slice(bodyStart + 1);
  return { frontMatter, body };
}

/**
 * Parse the small YAML subset wiki front matter uses: `key: value`, `key: [a, b]`,
 * and `key:` followed by `  - item` lines. Values are kept as strings; lists as
 * string arrays. Quotes around scalar values are stripped.
 *
 * @param {string} frontMatter The front-matter block (without delimiters).
 * @returns {Map<string, string | string[]>} Field name → value.
 */
export function parseFrontMatter(frontMatter) {
  const fields = new Map();
  let currentListKey = null;
  for (const rawLine of frontMatter.split('\n')) {
    const listItem = rawLine.match(/^\s+-\s+(.*)$/);
    if (listItem !== null && currentListKey !== null) {
      fields.get(currentListKey).push(stripQuotes(listItem[1].trim()));
      continue;
    }
    const keyValue = rawLine.match(/^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/);
    if (keyValue === null) {
      continue;
    }
    const key = keyValue[1];
    const value = keyValue[2].trim();
    if (value === '') {
      fields.set(key, []);
      currentListKey = key;
      continue;
    }
    currentListKey = null;
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      fields.set(key, inner === '' ? [] : inner.split(',').map((item) => stripQuotes(item.trim())));
      continue;
    }
    fields.set(key, stripQuotes(value));
  }
  return fields;
}

/**
 * Remove one pair of matching surrounding quotes from a scalar value.
 *
 * @param {string} value The raw value.
 * @returns {string} The value without surrounding quotes.
 */
function stripQuotes(value) {
  if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value[value.length - 1] === value[0]) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Reduce a `source` / `related` entry to a repo-relative path to check, or `null`
 * when the entry is not a local relative path (the absolute self-reference, a URL,
 * or a bare description).
 *
 * @param {string} entry The raw list entry.
 * @returns {string | null} The path without anchor or trailing annotation.
 */
export function toCheckablePath(entry) {
  const withoutAnnotation = entry.replace(/\s+\(.*\)\s*$/, '').trim();
  if (withoutAnnotation === '' || /^[A-Za-z]:[\\/]/.test(withoutAnnotation)) {
    return null;
  }
  if (/^[a-z]+:\/\//i.test(withoutAnnotation) || withoutAnnotation.includes(' ')) {
    return null;
  }
  const withoutAnchor = withoutAnnotation.split('#')[0];
  return withoutAnchor === '' ? null : withoutAnchor;
}

/**
 * Collect the page file names that `INDEX.md` links to.
 *
 * @param {string} indexText The INDEX.md text.
 * @returns {Set<string>} Linked page file names (e.g. `scoring.md`).
 */
export function collectIndexedPages(indexText) {
  const indexed = new Set();
  for (const match of indexText.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
    const target = match[1].replace(/^\.\//, '');
    if (!target.includes('/')) {
      indexed.add(target);
    }
  }
  return indexed;
}

/**
 * Lint one entity page's front matter and sections.
 *
 * @param {string} fileName The page file name.
 * @param {string} text The page text.
 * @param {(relativePath: string) => boolean} pathExists Resolves a path relative to `wiki/`.
 * @returns {{ rule: string, page: string, detail: string }[]} The page's findings.
 */
export function lintEntityPage(fileName, text, pathExists) {
  const findings = [];
  const { frontMatter, body } = splitFrontMatter(text);
  if (frontMatter === null) {
    findings.push({ rule: 'missing-front-matter', page: fileName, detail: 'The page has no front-matter block.' });
    return findings;
  }
  const fields = parseFrontMatter(frontMatter);
  for (const field of REQUIRED_FRONT_MATTER_FIELDS) {
    if (!fields.has(field)) {
      findings.push({ rule: 'missing-field', page: fileName, detail: `Front matter is missing the required \`${field}\` field.` });
    }
  }
  const type = fields.get('type');
  if (typeof type === 'string' && !ENTITY_TYPES.includes(type)) {
    findings.push({ rule: 'invalid-type', page: fileName, detail: `\`type: ${type}\` is not in the closed set.` });
  }
  const status = fields.get('status');
  if (typeof status === 'string' && !STATUS_VALUES.includes(status)) {
    findings.push({ rule: 'invalid-status', page: fileName, detail: `\`status: ${status}\` is not in the closed set.` });
  }
  const source = fields.get('source');
  const sourceEntries = Array.isArray(source) ? source : [];
  if (status === 'canonical' && sourceEntries.length === 0) {
    findings.push({ rule: 'canonical-without-source', page: fileName, detail: 'A canonical page must cite a non-empty `source`.' });
  }
  findings.push(...lintPaths(fileName, 'related', fields.get('related'), pathExists));
  findings.push(...lintPaths(fileName, 'source', source, pathExists));
  findings.push(...lintSections(fileName, body));
  return findings;
}

/**
 * Check that each local path in a front-matter list resolves.
 *
 * @param {string} fileName The page file name.
 * @param {string} field The field name (`related` or `source`).
 * @param {string | string[] | undefined} value The field value.
 * @param {(relativePath: string) => boolean} pathExists Resolves a path relative to `wiki/`.
 * @returns {{ rule: string, page: string, detail: string }[]} Broken-path findings.
 */
function lintPaths(fileName, field, value, pathExists) {
  const findings = [];
  if (!Array.isArray(value)) {
    return findings;
  }
  for (const entry of value) {
    const checkablePath = toCheckablePath(entry);
    const isProjectedPage = PROJECTED_PAGE_NAMES.includes(checkablePath ?? '');
    if (checkablePath !== null && !isProjectedPage && !pathExists(checkablePath)) {
      findings.push({
        rule: `broken-${field}`,
        page: fileName,
        detail: `\`${field}\` entry \`${checkablePath}\` does not resolve.`,
      });
    }
  }
  return findings;
}

/**
 * Check the five required H2 sections are present and in order.
 *
 * @param {string} fileName The page file name.
 * @param {string} body The page body (front matter removed).
 * @returns {{ rule: string, page: string, detail: string }[]} Section findings.
 */
function lintSections(fileName, body) {
  const headings = [];
  let isInFence = false;
  for (const line of body.split('\n')) {
    if (line.startsWith('```')) {
      isInFence = !isInFence;
      continue;
    }
    const heading = !isInFence ? line.match(/^##\s+(.+?)\s*$/) : null;
    if (heading !== null) {
      // why: a heading may carry an explicit anchor (`## Edge Cases {#edge-cases}`);
      // the section name is the text before it.
      headings.push(heading[1].replace(/\s*\{#[^}]*\}\s*$/, ''));
    }
  }
  const findings = [];
  const missing = REQUIRED_SECTIONS.filter((section) => !headings.includes(section));
  for (const section of missing) {
    findings.push({ rule: 'missing-section', page: fileName, detail: `The required \`## ${section}\` section is missing.` });
  }
  if (missing.length === 0) {
    const positions = REQUIRED_SECTIONS.map((section) => headings.indexOf(section));
    const isInOrder = positions.every((position, index) => index === 0 || position > positions[index - 1]);
    if (!isInOrder) {
      findings.push({ rule: 'sections-out-of-order', page: fileName, detail: `Required sections must appear in the order ${REQUIRED_SECTIONS.join(' → ')}.` });
    }
  }
  return findings;
}

/**
 * Lint the whole wiki. Pure: every input is injected.
 *
 * @param {{ fileName: string, text: string }[]} pages Every `*.md` file in `wiki/`.
 * @param {(relativePath: string) => boolean} pathExists Resolves a path relative to `wiki/`.
 * @returns {{ entityPageCount: number, findings: { rule: string, page: string, detail: string }[] }}
 */
export function lintWiki(pages, pathExists) {
  const findings = [];
  const indexPage = pages.find((page) => page.fileName === 'INDEX.md');
  const indexedPages = indexPage === undefined ? new Set() : collectIndexedPages(indexPage.text);
  const entityPages = pages.filter((page) => !RESERVED_FILE_NAMES.includes(page.fileName));
  for (const page of entityPages) {
    findings.push(...lintEntityPage(page.fileName, page.text, pathExists));
    if (!indexedPages.has(page.fileName)) {
      findings.push({ rule: 'not-in-index', page: page.fileName, detail: 'The page is not linked from `wiki/INDEX.md`.' });
    }
  }
  if (entityPages.length > ENTITY_PAGE_CAP) {
    findings.push({
      rule: 'entity-cap-exceeded',
      page: 'wiki/',
      detail: `${entityPages.length} entity pages exceeds the ${ENTITY_PAGE_CAP}-page flat-structure cap; SCHEMA requires a partitioning amendment.`,
    });
  }
  return { entityPageCount: entityPages.length, findings };
}

/**
 * Read `wiki/`, lint it, print the report, and optionally write JSON.
 */
function runLint() {
  const fileNames = readdirSync(WIKI_DIRECTORY).filter((name) => name.endsWith('.md')).sort();
  const pages = fileNames.map((fileName) => ({ fileName, text: readFileSync(join(WIKI_DIRECTORY, fileName), 'utf8') }));
  const pathExists = (relativePath) => existsSync(resolve(WIKI_DIRECTORY, relativePath));
  const result = lintWiki(pages, pathExists);
  const report = { generatedFrom: 'wiki/', entityPageCount: result.entityPageCount, findingCount: result.findings.length, findings: result.findings };

  console.log(`Wiki lint: ${result.entityPageCount} entity page(s), ${result.findings.length} finding(s).`);
  for (const finding of result.findings) {
    console.log(`  [${finding.rule}] ${finding.page} — ${finding.detail}`);
  }

  const jsonFlagIndex = process.argv.indexOf('--json');
  if (jsonFlagIndex !== -1) {
    const outputPath = process.argv[jsonFlagIndex + 1];
    if (outputPath === undefined) {
      throw new Error('The --json flag needs an output path, for example: --json apps/dashboard/src/data/wiki-lint.json');
    }
    const absoluteOutput = resolve(process.cwd(), outputPath);
    mkdirSync(dirname(absoluteOutput), { recursive: true });
    writeFileSync(absoluteOutput, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
}

/**
 * True when this file is the process entry point (not imported by a test).
 *
 * @returns {boolean}
 */
function isRunDirectly() {
  const invokedPath = process.argv[1];
  if (invokedPath === undefined) {
    return false;
  }
  return resolve(invokedPath) === fileURLToPath(import.meta.url);
}

if (isRunDirectly()) {
  runLint();
}
