/**
 * Tests for the wiki lint (Inspector lane corpus health check).
 *
 * Every case injects page text and a path resolver, so the tests do no file I/O
 * and never run the CLI (guarded behind `isRunDirectly()`). Covers each rule's
 * positive and negative case, plus the two false positives found on the real
 * wiki: a heading with an explicit `{#anchor}`, and a `related` link to the
 * projection-generated changelog page.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  collectIndexedPages,
  lintEntityPage,
  lintWiki,
  parseFrontMatter,
  splitFrontMatter,
  toCheckablePath,
  ENTITY_PAGE_CAP,
} from './wiki-lint.mjs';

const ALL_SECTIONS = '## Summary\n\nx\n\n## Mechanics\n\nx\n\n## Interactions\n\nx\n\n## Edge Cases\n\nx\n\n## References\n\nx\n';

/**
 * Build a conforming entity page, with overridable front-matter lines and body.
 */
function buildPage(options: { frontMatterLines?: string[]; body?: string } = {}): string {
  const frontMatterLines = options.frontMatterLines ?? [
    'title: Example Page',
    'type: Concept',
    'tags: [example]',
    'related:',
    '  - other-page.md',
    'status: canonical',
    'source:',
    '  - C:\\pcloud\\BB\\DEV\\legendary-arena\\wiki\\example-page.md (this page — https://ewiki.legendary-arena.com/example-page/)',
    '  - ../docs/ai/ARCHITECTURE.md#section-2',
    'last-reviewed: 2026-09-25',
  ];
  return `---\n${frontMatterLines.join('\n')}\n---\n\n# Example Page\n\n${options.body ?? ALL_SECTIONS}`;
}

const everythingExists = (): boolean => true;
const nothingExists = (): boolean => false;

/** Names of the rules in a finding list. */
function rulesOf(findings: { rule: string }[]): string[] {
  return findings.map((finding) => finding.rule);
}

test('a conforming page has no findings', () => {
  assert.deepEqual(lintEntityPage('example-page.md', buildPage(), everythingExists), []);
});

test('a page with no front matter is reported and not linted further', () => {
  const findings = lintEntityPage('bare.md', '# Bare\n\n' + ALL_SECTIONS, everythingExists);
  assert.deepEqual(rulesOf(findings), ['missing-front-matter']);
});

test('each missing required field is reported', () => {
  const page = buildPage({ frontMatterLines: ['title: Example', 'type: Concept', 'status: draft'] });
  const findings = lintEntityPage('example.md', page, everythingExists);
  const missing = findings.filter((finding) => finding.rule === 'missing-field').map((finding) => finding.detail);
  assert.equal(missing.length, 3);
  assert.ok(missing.some((detail) => detail.includes('`tags`')));
  assert.ok(missing.some((detail) => detail.includes('`related`')));
  assert.ok(missing.some((detail) => detail.includes('`last-reviewed`')));
});

test('type and status outside their closed sets are reported; web/design types are accepted', () => {
  const invalid = buildPage({
    frontMatterLines: ['title: X', 'type: Widget', 'tags: []', 'related: []', 'status: final', 'last-reviewed: 2026-09-25'],
  });
  assert.deepEqual(rulesOf(lintEntityPage('x.md', invalid, everythingExists)).sort(), ['invalid-status', 'invalid-type']);

  const guide = buildPage({
    frontMatterLines: ['title: X', 'type: Guide', 'tags: []', 'related: []', 'status: draft', 'last-reviewed: 2026-09-25'],
  });
  assert.deepEqual(lintEntityPage('x.md', guide, everythingExists), []);
});

test('a canonical page with an empty source is reported; a draft page is not', () => {
  const canonical = buildPage({
    frontMatterLines: ['title: X', 'type: Concept', 'tags: []', 'related: []', 'status: canonical', 'source: []', 'last-reviewed: 2026-09-25'],
  });
  assert.deepEqual(rulesOf(lintEntityPage('x.md', canonical, everythingExists)), ['canonical-without-source']);

  const draft = buildPage({
    frontMatterLines: ['title: X', 'type: Concept', 'tags: []', 'related: []', 'status: draft', 'source: []', 'last-reviewed: 2026-09-25'],
  });
  assert.deepEqual(lintEntityPage('x.md', draft, everythingExists), []);
});

test('unresolvable related and relative source paths are reported; the absolute self-reference is skipped', () => {
  const findings = lintEntityPage('example-page.md', buildPage(), nothingExists);
  assert.deepEqual(rulesOf(findings).sort(), ['broken-related', 'broken-source']);
  const sourceFinding = findings.find((finding) => finding.rule === 'broken-source');
  assert.ok(sourceFinding?.detail.includes('../docs/ai/ARCHITECTURE.md'));
});

test('a related link to the projection-generated changelog page is not reported', () => {
  const page = buildPage({
    frontMatterLines: ['title: X', 'type: Concept', 'tags: []', 'related:', '  - changelog.md', 'status: draft', 'last-reviewed: 2026-09-25'],
  });
  assert.deepEqual(lintEntityPage('x.md', page, nothingExists), []);
});

test('a missing required section is reported by name', () => {
  const body = '## Summary\n\nx\n\n## Mechanics\n\nx\n\n## Edge Cases\n\nx\n\n## References\n\nx\n';
  const findings = lintEntityPage('x.md', buildPage({ body }), everythingExists);
  assert.deepEqual(rulesOf(findings), ['missing-section']);
  assert.ok(findings[0].detail.includes('## Interactions'));
});

test('required sections out of order are reported', () => {
  const body = '## Summary\n\nx\n\n## Interactions\n\nx\n\n## Mechanics\n\nx\n\n## Edge Cases\n\nx\n\n## References\n\nx\n';
  assert.deepEqual(rulesOf(lintEntityPage('x.md', buildPage({ body }), everythingExists)), ['sections-out-of-order']);
});

test('a section heading with an explicit anchor counts as that section', () => {
  const body = ALL_SECTIONS.replace('## Edge Cases', '## Edge Cases {#edge-cases}');
  assert.deepEqual(lintEntityPage('x.md', buildPage({ body }), everythingExists), []);
});

test('a heading inside a fenced code block is not a section', () => {
  const body = '## Summary\n\nx\n\n```md\n## Mechanics\n```\n\n## Interactions\n\nx\n\n## Edge Cases\n\nx\n\n## References\n\nx\n';
  const findings = lintEntityPage('x.md', buildPage({ body }), everythingExists);
  assert.deepEqual(rulesOf(findings), ['missing-section']);
  assert.ok(findings[0].detail.includes('## Mechanics'));
});

test('lintWiki reports entity pages missing from INDEX.md and skips reserved files', () => {
  const pages = [
    { fileName: 'INDEX.md', text: '# Index\n\n- [Listed](listed.md)\n- [Anchored](anchored.md#section)\n' },
    { fileName: 'SCHEMA.md', text: '# Schema, not an entity page' },
    { fileName: 'listed.md', text: buildPage() },
    { fileName: 'anchored.md', text: buildPage() },
    { fileName: 'orphan.md', text: buildPage() },
  ];
  const result = lintWiki(pages, everythingExists);
  assert.equal(result.entityPageCount, 3);
  assert.deepEqual(
    result.findings.map((finding) => `${finding.rule}:${finding.page}`),
    ['not-in-index:orphan.md'],
  );
});

test('lintWiki reports the flat-structure cap only when exceeded', () => {
  const indexLinks: string[] = [];
  const pages: { fileName: string; text: string }[] = [];
  for (let pageNumber = 0; pageNumber <= ENTITY_PAGE_CAP; pageNumber += 1) {
    const fileName = `page-${pageNumber}.md`;
    indexLinks.push(`- [P](${fileName})`);
    pages.push({ fileName, text: buildPage() });
  }
  pages.push({ fileName: 'INDEX.md', text: indexLinks.join('\n') });
  const overCap = lintWiki(pages, everythingExists);
  assert.deepEqual(rulesOf(overCap.findings), ['entity-cap-exceeded']);

  const atCap = lintWiki(pages.filter((page) => page.fileName !== 'page-0.md'), everythingExists);
  assert.deepEqual(rulesOf(atCap.findings), []);
});

test('front matter parsing handles scalars, inline lists, block lists, and quotes', () => {
  const { frontMatter } = splitFrontMatter('---\ntitle: "Quoted Title"\ntags: [a, b]\nrelated:\n  - one.md\n  - two.md\n---\nbody');
  assert.ok(frontMatter !== null);
  const fields = parseFrontMatter(frontMatter ?? '');
  assert.equal(fields.get('title'), 'Quoted Title');
  assert.deepEqual(fields.get('tags'), ['a', 'b']);
  assert.deepEqual(fields.get('related'), ['one.md', 'two.md']);
});

test('toCheckablePath skips absolute, URL, and prose entries and strips anchors and annotations', () => {
  assert.equal(toCheckablePath('C:\\pcloud\\wiki\\x.md (this page — https://example.com/)'), null);
  assert.equal(toCheckablePath('https://example.com/page'), null);
  assert.equal(toCheckablePath('Legendary rulebook v23'), null);
  assert.equal(toCheckablePath('../docs/x.md#section'), '../docs/x.md');
  assert.equal(toCheckablePath('../docs/x.md (the spec)'), '../docs/x.md');
});

test('collectIndexedPages reads flat wiki links and ignores nested paths', () => {
  const indexed = collectIndexedPages('- [A](a.md)\n- [B](./b.md#x)\n- [Out](../docs/c.md)\n');
  assert.deepEqual([...indexed].sort(), ['a.md', 'b.md']);
});
