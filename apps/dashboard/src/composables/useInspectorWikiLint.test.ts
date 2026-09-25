import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWikiLintProjection,
  useInspectorWikiLint,
  type WikiLintReport,
} from './useInspectorWikiLint.js';

/** A report builder: every finding is `{ rule, page, detail }`. */
function makeReport(findings: WikiLintReport['findings']): WikiLintReport {
  return { entityPageCount: 79, findingCount: findings.length, findings };
}

describe('useInspectorWikiLint', () => {
  it('should_produce_no_items_for_a_clean_report', () => {
    assert.deepEqual(buildWikiLintProjection(makeReport([])).backlog, []);
  });

  it('should_group_findings_into_one_item_per_rule_counting_distinct_pages', () => {
    const projection = buildWikiLintProjection(
      makeReport([
        { rule: 'missing-section', page: 'a.md', detail: 'Mechanics missing.' },
        { rule: 'missing-section', page: 'a.md', detail: 'Interactions missing.' },
        { rule: 'missing-section', page: 'b.md', detail: 'Mechanics missing.' },
      ]),
    );
    assert.equal(projection.backlog.length, 1);
    assert.deepEqual(projection.backlog[0], {
      id: 'wiki-lint-missing-section',
      label: 'Wiki: 2 pages missing required sections — a, b',
      meta: 'Wiki lint',
    });
  });

  it('should_order_items_by_rule_priority_with_unknown_rules_last', () => {
    const projection = buildWikiLintProjection(
      makeReport([
        { rule: 'future-rule', page: 'z.md', detail: 'Something new.' },
        { rule: 'missing-section', page: 'a.md', detail: 'Mechanics missing.' },
        { rule: 'not-in-index', page: 'b.md', detail: 'Not indexed.' },
        {
          rule: 'entity-cap-exceeded',
          page: 'wiki/',
          detail: '79 entity pages exceeds the 75-page flat-structure cap.',
        },
      ]),
    );
    assert.deepEqual(
      projection.backlog.map((item) => item.id),
      [
        'wiki-lint-entity-cap-exceeded',
        'wiki-lint-not-in-index',
        'wiki-lint-missing-section',
        'wiki-lint-future-rule',
      ],
    );
    assert.equal(
      projection.backlog[0]!.label,
      'Wiki: 79 entity pages exceeds the 75-page flat-structure cap.',
    );
    assert.equal(projection.backlog[3]!.label, 'Wiki: 1 page flagged by future-rule — z');
  });

  it('should_list_at_most_three_page_names_then_summarise_the_rest', () => {
    const projection = buildWikiLintProjection(
      makeReport(
        ['a.md', 'b.md', 'c.md', 'd.md', 'e.md'].map((page) => ({
          rule: 'not-in-index',
          page,
          detail: 'Not indexed.',
        })),
      ),
    );
    assert.equal(
      projection.backlog[0]!.label,
      'Wiki: 5 pages not linked from INDEX.md — a, b, c +2 more',
    );
  });

  it('should_describe_every_known_rule_in_plain_words', () => {
    const rules = [
      ['missing-front-matter', 'with no front matter'],
      ['missing-field', 'missing required front-matter fields'],
      ['invalid-type', 'with a type outside the closed set'],
      ['invalid-status', 'with a status outside the closed set'],
      ['canonical-without-source', 'marked canonical with no source'],
      ['broken-source', 'citing a source path that no longer exists'],
      ['broken-related', 'with a related link that no longer exists'],
      ['sections-out-of-order', 'with required sections out of order'],
    ] as const;
    for (const [rule, phrase] of rules) {
      const projection = buildWikiLintProjection(makeReport([{ rule, page: 'x.md', detail: 'd' }]));
      assert.equal(projection.backlog[0]!.label, `Wiki: 1 page ${phrase} — x`, rule);
    }
  });

  it('should_project_an_injected_report_through_the_composable', () => {
    const report = makeReport([
      { rule: 'not-in-index', page: 'orphan.md', detail: 'Not indexed.' },
    ]);
    assert.deepEqual(
      useInspectorWikiLint(report).value.backlog.map((item) => item.id),
      ['wiki-lint-not-in-index'],
    );
  });

  it('should_read_the_build_time_report_by_default', () => {
    const projection = useInspectorWikiLint().value;
    assert.ok(Array.isArray(projection.backlog));
    for (const item of projection.backlog) {
      assert.equal(item.meta, 'Wiki lint');
      assert.ok(item.id.startsWith('wiki-lint-'));
    }
  });
});
