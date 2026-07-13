#!/usr/bin/env node
// why: build-time content projection per WP-139 §Locked Values / D-13810
// default (and the source-relocation amendment in DECISIONS — see latest
// D-entry). Copies wiki/*.md → apps/wiki-viewer/content/ and renames
// ONLY THE COPY of INDEX.md to _index.md so Hugo treats it as the home
// page. The source under wiki/ is read-only from the viewer's perspective;
// using mv/rename here would silently delete wiki/INDEX.md and break the
// SCHEMA.md "Publish / Sync Boundary" contract — every commit would lose
// the canonical source of the wiki index. Cp + post-step assertion
// (line: existsSync check) is the cheap guard against that regression.
// why: case-sensitive filename handling — Windows is case-insensitive but CI
// runs on Linux; a case-insensitive copy would let `INDEX.md` and `Index.md`
// alias and hide drift that fails in CI.

import { existsSync, mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const wikiSource = join(repoRoot, 'wiki');
const ewikiAssets = join(repoRoot, 'ewiki');
const projectionTarget = join(here, '..', 'content');
const staticTarget = join(here, '..', 'static');

// why: D-24164 — the changelog is the ONE docs/ file the ewiki also publishes.
// docs/09-CHANGELOG.md is the single source of truth (read by git/dashboard
// readers too), so it is projected — not duplicated — into the wiki as
// changelog.md. This amends the WP-139/D-13810 wiki-only projection scope for
// exactly this file. The transform below is the reason it must be projected
// (rewritten), not copied: its links are docs-relative and would 404 on the ewiki.
const changelogSource = join(repoRoot, 'docs', '09-CHANGELOG.md');
const githubDocsBlobBase =
  'https://github.com/barefootbetters/legendary-arena/blob/main/docs/';
// why: a Hugo page needs frontmatter for its title + nav; the source docs file
// carries none (it is a plain doc), so the ewiki-specific frontmatter is injected
// here at projection time rather than polluting the source.
const changelogFrontmatter = [
  '---',
  'title: Changelog',
  'type: Guide',
  'tags:',
  '  - changelog',
  '  - milestones',
  '  - project',
  'status: canonical',
  '---',
  '',
  '<!-- Auto-projected from docs/09-CHANGELOG.md by project-wiki.mjs (D-24164). Edit the source, not this copy. -->',
  '',
].join('\n');

/**
 * Project wiki/*.md into apps/wiki-viewer/content/.
 *
 * Contract:
 *   - Read-only on wiki/ — never modifies source files.
 *   - Idempotent — clears the projection target before copying.
 *   - Renames only the copied INDEX.md → _index.md (Hugo home page
 *     convention). The source docs/wiki/INDEX.md is preserved.
 *   - Case-sensitive filename handling.
 */
function projectWiki() {
  if (!existsSync(wikiSource)) {
    throw new Error(
      `Wiki source directory not found at ${wikiSource}. The projection step requires wiki/ to exist before it runs.`
    );
  }

  // Capture pre-projection hash baseline of INDEX.md so the projection-is-copy
  // invariant can be asserted post-copy (the source must survive untouched).
  const sourceIndex = join(wikiSource, 'INDEX.md');
  if (!existsSync(sourceIndex)) {
    throw new Error(
      `Source wiki/INDEX.md not found before projection. The wiki source contract requires this file at ${sourceIndex}.`
    );
  }

  // Clear and recreate the projection target. Idempotent re-runs produce
  // identical output regardless of prior state.
  if (existsSync(projectionTarget)) {
    rmSync(projectionTarget, { recursive: true, force: true });
  }
  mkdirSync(projectionTarget, { recursive: true });

  const entries = readdirSync(wikiSource, { withFileTypes: true });
  let copiedCount = 0;
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.endsWith('.md')) {
      continue;
    }
    const sourcePath = join(wikiSource, entry.name);
    const targetName = entry.name === 'INDEX.md' ? '_index.md' : entry.name;
    const targetPath = join(projectionTarget, targetName);
    copyFileSync(sourcePath, targetPath);
    copiedCount += 1;
  }

  // Post-step assertion: source INDEX.md must still exist. A regression that
  // swaps copyFileSync for renameSync would delete the source and trip this.
  if (!existsSync(sourceIndex)) {
    throw new Error(
      `Projection step deleted source wiki/INDEX.md — must be a copy, not a move. Restore from git and fix scripts/project-wiki.mjs to use copyFileSync.`
    );
  }

  // Project ewiki/<slug>/ asset directories into
  // apps/wiki-viewer/static/<slug>/ so Hugo serves them at /<slug>/
  // on the rendered site. Each wiki page gets its own subdirectory
  // matching its filename slug. Optional — ewiki/ may not exist yet
  // if no assets have been added.
  //
  // Only slug subdirectories from ewiki/ are cleaned and re-copied.
  // Other contents of static/ (if any) are left untouched.
  if (existsSync(ewikiAssets)) {
    mkdirSync(staticTarget, { recursive: true });
    const slugDirs = readdirSync(ewikiAssets, { withFileTypes: true });
    let assetCount = 0;
    for (const dir of slugDirs) {
      if (!dir.isDirectory()) {
        continue;
      }
      const sourceDir = join(ewikiAssets, dir.name);
      const targetDir = join(staticTarget, dir.name);
      if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true, force: true });
      }
      mkdirSync(targetDir, { recursive: true });
      const files = readdirSync(sourceDir, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile()) {
          continue;
        }
        copyFileSync(join(sourceDir, file.name), join(targetDir, file.name));
        assetCount += 1;
      }
    }
    process.stdout.write(`Projected ${assetCount} ewiki assets to ${staticTarget}\n`);
  }

  return copiedCount;
}

/**
 * Project docs/09-CHANGELOG.md into apps/wiki-viewer/content/changelog.md.
 *
 * Read-only on the source. Injects ewiki frontmatter (the source is a plain
 * doc), drops the source's `# 09 — Changelog` H1 (the frontmatter title supplies
 * it), and rewrites docs-relative markdown links to absolute GitHub blob URLs so
 * they resolve on the rendered ewiki AND pass the link-integrity check (which
 * exempts http(s) links). Every link in the changelog is a docs-relative `.md`
 * path (no http / mailto / #anchor / rooted forms), so the rewrite rule is total.
 *
 * @returns 1 when the changelog was projected, 0 when the source is absent.
 */
function projectChangelog() {
  if (!existsSync(changelogSource)) {
    process.stdout.write(
      'Changelog source docs/09-CHANGELOG.md not found — skipping changelog projection.\n'
    );
    return 0;
  }
  const raw = readFileSync(changelogSource, 'utf8');
  // why: drop the leading `# 09 — Changelog` H1 (the `09-` is a docs-ordering
  // prefix) so the page title comes from the injected frontmatter, not a
  // duplicated in-body heading.
  const withoutTitle = raw.replace(/^# 09 — Changelog\r?\n/, '');
  // why: rewrite docs-relative `.md` links (e.g. ai/work-packets/WORK_INDEX.md,
  // 05-ROADMAP-MINDMAP.md) — which resolve against docs/, not the ewiki content/
  // root — to absolute GitHub blob URLs. The negative lookahead skips links that
  // are already external / rooted / in-page anchors.
  const rewritten = withoutTitle.replace(
    /\]\((?!https?:|mailto:|#|\/)([^)]+\.md[^)]*)\)/g,
    (_whole, relativePath) => `](${githubDocsBlobBase}${relativePath})`
  );
  writeFileSync(
    join(projectionTarget, 'changelog.md'),
    changelogFrontmatter + rewritten,
    'utf8'
  );
  return 1;
}

try {
  const count = projectWiki();
  process.stdout.write(`Projected ${count} wiki files to ${projectionTarget}\n`);
  const changelogCount = projectChangelog();
  if (changelogCount > 0) {
    process.stdout.write(`Projected the changelog to ${join(projectionTarget, 'changelog.md')}\n`);
  }
} catch (error) {
  process.stderr.write(`Wiki projection failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
