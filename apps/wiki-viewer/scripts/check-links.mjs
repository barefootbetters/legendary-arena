#!/usr/bin/env node
// why: build-time link-integrity check per WP-139 §Non-Negotiable Constraints
// (Source content discipline). A broken internal markdown link MUST fail the
// build with a non-zero exit and a per-link diagnostic. External URLs (http,
// https, mailto, in-page #anchor) are out of scope — external availability
// is not the wiki's responsibility. Out-of-tree `../**` links are out of
// scope here too; they are rewritten to GitHub blob URLs by the Hugo render
// hook at build time and validated separately at PR-review.
// why: case-sensitive comparison even on Windows. Windows filesystem is
// case-insensitive but CI on Linux is not. A case-insensitive check would
// pass locally and fail in CI when, e.g., the body says `(Master-Strike.md)`
// and the file on disk is `master-strike.md`. The check enforces the strict
// rule so local and CI agree.
// why: fenced code blocks are stripped before scanning per EC-179. Markdown
// link syntax `[text](path)` inside a ``` fence is illustration text, not a
// navigable link — image-embedding examples in blog-post-authoring.md,
// brevo-email-pipeline.md, and wiki-viewer.md teach authors the Hugo
// /-rooted static-asset URL convention and intentionally reference paths
// that don't exist on the engine repo's filesystem. Without stripping,
// every such example trips the gate by design.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectedRoot = join(here, '..', 'content');
// why: check-links runs from apps/wiki-viewer/scripts/, so the engine repo
// root is three directories up. The canonical-source guard resolves the
// front-matter path (repo-root-relative) and the `source` entries
// (wiki/-relative, `../`-prefixed) against these two bases to prove they
// point at the same file.
const repoRoot = resolve(here, '..', '..', '..');
const wikiDir = join(repoRoot, 'wiki');

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
const FENCED_CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;

function stripFencedCodeBlocks(body) {
  return body.replace(FENCED_CODE_BLOCK_PATTERN, '');
}

function isExternal(destination) {
  return (
    destination.startsWith('http://') ||
    destination.startsWith('https://') ||
    destination.startsWith('mailto:') ||
    destination.startsWith('#') ||
    // why: `/`-rooted destinations are Hugo static-root URLs (e.g.
    // /development-workflow/ai-system-flow.jpg). They are served from
    // apps/wiki-viewer/static/<slug>/, projected there from ewiki/<slug>/
    // by project-wiki.mjs — NOT content-relative paths. Resolving them
    // against the projected content/ root (as this check does for
    // internal `.md` links) would always fail, since the asset never
    // lands in content/. The SCHEMA forbids `/`-rooted paths for .md
    // cross-links, so this exemption is unambiguous: a leading `/` here
    // is only ever a static asset, validated by the static projection.
    destination.startsWith('/') ||
    destination.startsWith('../')
  );
}

function fileExistsCaseSensitive(absolutePath) {
  if (!existsSync(absolutePath)) {
    return false;
  }
  const directory = dirname(absolutePath);
  const fileName = absolutePath.slice(directory.length + 1);
  const entries = readdirSync(directory);
  return entries.includes(fileName);
}

/**
 * Extract the YAML front-matter block from a projected page.
 *
 * why: the projection inserts the GENERATED banner AFTER the closing `---`,
 * so the front-matter block is always the text between the first two `---`
 * delimiters and is safe to slice out. A page with no front matter (or an
 * unterminated block) yields an empty string and is treated as field-less.
 *
 * @param {string} body - Raw markdown of a projected content/ page.
 * @returns {string} The front-matter block contents, or '' when absent.
 */
function extractFrontMatter(body) {
  if (!body.startsWith('---')) {
    return '';
  }
  const closingIndex = body.indexOf('\n---', 3);
  if (closingIndex === -1) {
    return '';
  }
  return body.slice(3, closingIndex);
}

/**
 * Normalise one `source` entry to a comparable path: drop the self-reference
 * parenthetical (` (this page — …)`) and any `#anchor`, then trim.
 *
 * @param {string} entry - A raw `source` list item.
 * @returns {string} The bare path portion of the entry.
 */
function bareSourcePath(entry) {
  const withoutParenthetical = entry.split(' (')[0];
  const anchorIndex = withoutParenthetical.indexOf('#');
  const withoutAnchor =
    anchorIndex === -1 ? withoutParenthetical : withoutParenthetical.slice(0, anchorIndex);
  return withoutAnchor.trim();
}

/**
 * Validate the optional `canonical-source` front-matter field (D-24304),
 * including its cross-repo companion `canonical-source-repo` (D-24310).
 *
 * For a **same-repo** mirror (no `canonical-source-repo`), assert two things:
 * (1) the named upstream file exists on disk, and (2) the same file is also
 * cited in `source` (so the Sources section still links it and the two
 * representations cannot drift). For a **cross-repo** mirror (the canonical
 * doc lives in another repo, named by `canonical-source-repo`), the file is
 * not checked out here, so instead assert only that the repo slug is a valid
 * GitHub `owner/repo` and the path is non-empty. Returns a list of violation
 * strings; an empty list means the guard passed.
 *
 * @returns {string[]} Human-readable violation messages.
 */
function checkCanonicalSources() {
  const sourceFiles = readdirSync(projectedRoot).filter((name) => name.endsWith('.md'));
  const violations = [];

  for (const fileName of sourceFiles) {
    const frontMatter = extractFrontMatter(readFileSync(join(projectedRoot, fileName), 'utf8'));
    const canonicalMatch = frontMatter.match(/^canonical-source:\s*(.+)$/m);
    if (!canonicalMatch) {
      continue;
    }
    const canonicalPath = canonicalMatch[1].trim();
    const canonicalRepoMatch = frontMatter.match(/^canonical-source-repo:\s*(.+)$/m);
    const canonicalRepo = canonicalRepoMatch ? canonicalRepoMatch[1].trim() : '';

    if (canonicalRepo) {
      // Cross-repo mirror (D-24310): the canonical doc lives in another repo,
      // so it is not checked out here — the local existence and source-membership
      // checks below cannot apply. Validate only that the repo slug is a
      // plausible GitHub owner/repo and that the path is non-empty; the footer
      // builds the link from these two values.
      if (!/^[\w.-]+\/[\w.-]+$/.test(canonicalRepo)) {
        violations.push(
          `${fileName}: canonical-source-repo "${canonicalRepo}" is not a valid GitHub owner/repo slug. Use the form "owner/repo" (e.g. legendary-arena/legendary-arena-website).`
        );
      }
      if (canonicalPath === '') {
        violations.push(
          `${fileName}: canonical-source is empty but canonical-source-repo is set. Give the path to the owning doc within that repo.`
        );
      }
      continue;
    }

    // Same-repo mirror: the two checks below both apply.
    // (1) The named upstream file must exist at the repo root.
    const canonicalAbsolute = resolve(repoRoot, canonicalPath);
    if (!fileExistsCaseSensitive(canonicalAbsolute)) {
      violations.push(
        `${fileName}: canonical-source "${canonicalPath}" does not exist at ${canonicalAbsolute}. Point it at the upstream doc that owns this page's prose (or set canonical-source-repo if it lives in another repo).`
      );
    }

    // (2) The same file must also be cited in `source` (resolved-path match).
    // why: source entries are wiki/-relative (`../…`); canonical-source is
    // repo-root-relative. Comparing resolved absolute paths lets the two
    // representations differ textually while still proving they are the
    // same file — so provenance in the Sources section cannot silently drift.
    const sourceEntries = [...frontMatter.matchAll(/^\s+-\s+(.+)$/gm)].map((entry) =>
      resolve(wikiDir, bareSourcePath(entry[1]))
    );
    if (!sourceEntries.includes(canonicalAbsolute)) {
      violations.push(
        `${fileName}: canonical-source "${canonicalPath}" is not listed in the page's source. Add it to source (in its ../-relative form) so the Sources section links it.`
      );
    }
  }

  return violations;
}

function checkLinks() {
  if (!existsSync(projectedRoot)) {
    throw new Error(
      `Projection target ${projectedRoot} does not exist. Run scripts/project-wiki.mjs before the link-integrity check.`
    );
  }

  const sourceFiles = readdirSync(projectedRoot).filter((name) => name.endsWith('.md'));
  const broken = [];

  for (const fileName of sourceFiles) {
    // why: D-14503 — the architecture-inventory page is generated content
    // (sole writer scripts/architecture-inventory.mjs per D-14502, amends
    // D-13810). Its body emits repo-rooted paths (docs/..., packages/...)
    // that resolve to GitHub-blob URLs at Hugo render time via the same
    // path the render-link.html hook applies to `../`-prefixed links
    // elsewhere. Excluding the file from this check is the lint-target
    // exception SCHEMA.md grants; without it, every cron regeneration
    // would trip the link-integrity gate by design.
    if (fileName === 'architecture-inventory.md') {
      continue;
    }
    const filePath = join(projectedRoot, fileName);
    const body = readFileSync(filePath, 'utf8');
    const scanBody = stripFencedCodeBlocks(body);
    const matches = scanBody.matchAll(MARKDOWN_LINK_PATTERN);
    for (const match of matches) {
      const destination = match[2].trim();
      if (isExternal(destination)) {
        continue;
      }
      // Strip in-page anchor (after `#`) for filesystem resolution.
      const anchorIndex = destination.indexOf('#');
      const pathPart = anchorIndex === -1 ? destination : destination.slice(0, anchorIndex);
      if (pathPart === '') {
        continue;
      }
      // INDEX.md is the only filename in source that the projection renames.
      // Body links written against the source name still point at the section
      // landing — accept INDEX.md as resolving to the projected _index.md.
      const resolvedName = pathPart === 'INDEX.md' ? '_index.md' : pathPart;
      const targetPath = resolve(projectedRoot, resolvedName);
      if (!fileExistsCaseSensitive(targetPath)) {
        broken.push({ source: fileName, destination, target: targetPath });
      }
    }
  }

  return broken;
}

try {
  const canonicalViolations = checkCanonicalSources();
  if (canonicalViolations.length > 0) {
    for (const violation of canonicalViolations) {
      process.stderr.write(`canonical-source violation: ${violation}\n`);
    }
    process.stderr.write(
      `canonical-source check failed with ${canonicalViolations.length} violation(s). See wiki/SCHEMA.md §Mirror pages and DECISIONS.md D-24304.\n`
    );
    process.exit(1);
  }

  const broken = checkLinks();
  if (broken.length > 0) {
    for (const entry of broken) {
      process.stderr.write(
        `Broken internal link: ${entry.source} → ${entry.destination} (resolved target: ${entry.target} does not exist case-sensitively)\n`
      );
    }
    process.stderr.write(
      `Link-integrity check failed with ${broken.length} broken internal link(s). Fix the source under wiki/ and re-run pnpm wiki-viewer:check-links.\n`
    );
    process.exit(1);
  }
  process.stdout.write(`Link-integrity check passed across ${readdirSync(projectedRoot).filter((name) => name.endsWith('.md')).length} projected files.\n`);
} catch (error) {
  process.stderr.write(`Link-integrity check failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
