import { computed, type ComputedRef } from 'vue';
import wikiLintData from '../data/wiki-lint.json';
import type { InspectorWikiLintProjection, PipelineItem } from './useAgentPipeline.js';

// ============================================================================
// Inspector-lane wiki lint producer.
//
// Projects the wiki lint report (`scripts/wiki-lint.mjs`, copied into the
// gitignored `src/data/wiki-lint.json` by the `prebuild:wiki-lint` step) into
// Inspector-lane backlog items: one item per rule that has findings, naming the
// affected pages. Mirrors `useArchitectGapIntake`: a pure projection over an
// injected report, with the lane type owned by `useAgentPipeline.ts`.
// ============================================================================

/** The meta tag carried by every wiki-lint backlog item. */
const WIKI_LINT_META = 'Wiki lint';

/** How many page names an item lists before summarising the rest. */
const PAGE_NAMES_SHOWN = 3;

/** One finding from the wiki lint report. */
export interface WikiLintFinding {
  readonly rule: string;
  readonly page: string;
  readonly detail: string;
}

/** The wiki lint report written by `scripts/wiki-lint.mjs --json`. */
export interface WikiLintReport {
  readonly entityPageCount: number;
  readonly findingCount: number;
  readonly findings: readonly WikiLintFinding[];
}

// why: a fixed rule order puts structural problems (the page cap, pages nobody
// can navigate to) ahead of per-page hygiene, so the lane leads with what most
// affects the wiki as a whole. A rule missing from this list still renders,
// after these, under its raw rule name.
const RULE_ORDER: readonly string[] = [
  'entity-cap-exceeded',
  'not-in-index',
  'missing-front-matter',
  'missing-field',
  'invalid-type',
  'invalid-status',
  'canonical-without-source',
  'broken-source',
  'broken-related',
  'missing-section',
  'sections-out-of-order',
];

/**
 * The human description for a rule's backlog item, given how many distinct pages
 * it affects.
 *
 * @param rule The lint rule id.
 * @param pageCount The number of distinct pages with findings for the rule.
 * @returns The description (without the page list).
 */
function describeRule(rule: string, pageCount: number): string {
  const pages = pageCount === 1 ? '1 page' : `${pageCount} pages`;
  if (rule === 'not-in-index') {
    return `${pages} not linked from INDEX.md`;
  }
  if (rule === 'missing-front-matter') {
    return `${pages} with no front matter`;
  }
  if (rule === 'missing-field') {
    return `${pages} missing required front-matter fields`;
  }
  if (rule === 'invalid-type') {
    return `${pages} with a type outside the closed set`;
  }
  if (rule === 'invalid-status') {
    return `${pages} with a status outside the closed set`;
  }
  if (rule === 'canonical-without-source') {
    return `${pages} marked canonical with no source`;
  }
  if (rule === 'broken-source') {
    return `${pages} citing a source path that no longer exists`;
  }
  if (rule === 'broken-related') {
    return `${pages} with a related link that no longer exists`;
  }
  if (rule === 'missing-section') {
    return `${pages} missing required sections`;
  }
  if (rule === 'sections-out-of-order') {
    return `${pages} with required sections out of order`;
  }
  return `${pages} flagged by ${rule}`;
}

/**
 * List page slugs (without `.md`), showing at most `PAGE_NAMES_SHOWN`.
 *
 * @param pages Distinct page file names, in report order.
 * @returns e.g. `a, b, c +2 more`.
 */
function listPages(pages: readonly string[]): string {
  const slugs = pages.map((page) => page.replace(/\.md$/, ''));
  const shown = slugs.slice(0, PAGE_NAMES_SHOWN).join(', ');
  const hiddenCount = slugs.length - PAGE_NAMES_SHOWN;
  return hiddenCount > 0 ? `${shown} +${hiddenCount} more` : shown;
}

/**
 * Build one backlog item for a rule's findings.
 *
 * @param rule The lint rule id.
 * @param findings Every finding for that rule, in report order.
 * @returns The Inspector-lane item.
 */
function itemForRule(rule: string, findings: readonly WikiLintFinding[]): PipelineItem {
  if (rule === 'entity-cap-exceeded') {
    return {
      id: `wiki-lint-${rule}`,
      label: `Wiki: ${findings[0]?.detail ?? 'the page cap is exceeded'}`,
      meta: WIKI_LINT_META,
    };
  }
  const distinctPages: string[] = [];
  for (const finding of findings) {
    if (!distinctPages.includes(finding.page)) {
      distinctPages.push(finding.page);
    }
  }
  return {
    id: `wiki-lint-${rule}`,
    label: `Wiki: ${describeRule(rule, distinctPages.length)} — ${listPages(distinctPages)}`,
    meta: WIKI_LINT_META,
  };
}

/**
 * Project a wiki lint report into Inspector-lane backlog items, one per rule with
 * findings, in `RULE_ORDER` then first-seen order for any unlisted rule.
 *
 * @param report The wiki lint report.
 * @returns The Inspector-lane projection.
 */
export function buildWikiLintProjection(report: WikiLintReport): InspectorWikiLintProjection {
  const findingsByRule = new Map<string, WikiLintFinding[]>();
  for (const finding of report.findings) {
    const existing = findingsByRule.get(finding.rule);
    if (existing === undefined) {
      findingsByRule.set(finding.rule, [finding]);
    } else {
      existing.push(finding);
    }
  }
  const orderedRules = [
    ...RULE_ORDER.filter((rule) => findingsByRule.has(rule)),
    ...[...findingsByRule.keys()].filter((rule) => !RULE_ORDER.includes(rule)),
  ];
  const backlog: PipelineItem[] = [];
  for (const rule of orderedRules) {
    backlog.push(itemForRule(rule, findingsByRule.get(rule) ?? []));
  }
  return { backlog };
}

/**
 * The Inspector-lane wiki lint projection for the Pipeline page.
 *
 * @param report The report to project; defaults to the build-time copy.
 * @returns A computed projection.
 */
export function useInspectorWikiLint(
  report: WikiLintReport = wikiLintData as WikiLintReport,
): ComputedRef<InspectorWikiLintProjection> {
  return computed(() => buildWikiLintProjection(report));
}
