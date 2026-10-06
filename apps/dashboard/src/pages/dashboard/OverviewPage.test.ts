/**
 * OverviewPage source guards (WP-791 / EC-828 / D-24653).
 *
 * The dashboard test runner is `node --test` with no SFC loader, so pages
 * cannot be mounted here. These tests read the page sources and pin the
 * Overview content contract: the business-first mount order, no relocated or
 * MOCK-backed widget imported, and the relocated widgets mounted on Vision &
 * Roadmap and Players. The guards match only `import … from` lines and
 * template tags, so a `// why:` comment naming a relocated widget never trips
 * them.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const pagesDirectory = fileURLToPath(new URL('..', import.meta.url));

/**
 * Reads one page's single-file-component source, relative to `src/pages/`.
 */
async function readPageSource(relativePath: string): Promise<string> {
  return readFile(join(pagesDirectory, relativePath), 'utf8');
}

/**
 * The names bound by the page's `import … from` statements (default and named).
 */
function importedNames(source: string): string[] {
  const names: string[] = [];
  const importStatements = source.match(/^import\s[^;]*?\sfrom\s+'[^']+';/gms) ?? [];
  for (const statement of importStatements) {
    const clause = statement.replace(/^import\s+(type\s+)?/, '').replace(/\s+from\s+'[^']+';$/, '');
    for (const part of clause.replace(/[{}]/g, ',').split(',')) {
      const name = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop();
      if (name !== undefined && name !== '') {
        names.push(name);
      }
    }
  }
  return names;
}

/**
 * The page's `<template>` block, so tag guards never see script comments.
 */
function templateBlock(source: string): string {
  const start = source.indexOf('<template>');
  const end = source.lastIndexOf('</template>');
  assert.ok(start >= 0 && end > start, 'the page has a <template> block');
  return source.slice(start, end);
}

const RELOCATED_OR_UNMOUNTED = [
  'VisionCard',
  'GovernanceKpiStrip',
  'GovernanceThroughputWidget',
  'StatusFeedWidget',
  'DauChartWidget',
  'RevenueChartWidget',
  'AcquisitionFunnelStripWidget',
  'AlertsPanel',
];

test('the Overview mounts money → KPIs → engagement → health → checklist, in that order', async () => {
  const template = templateBlock(await readPageSource('dashboard/OverviewPage.vue'));
  const orderedTags = [
    '<BusinessPulseWidget',
    '<KpiCard kpi-id="total_players"',
    '<KpiCard kpi-id="new_players_30d"',
    '<KpiCard kpi-id="total_matches"',
    '<KpiCard kpi-id="revenue_30d"',
    '<KpiCard kpi-id="hero_win_rate_30d"',
    '<EngagementStripWidget',
    '<OpsAtAGlanceStripWidget',
    '<DailyExecutionPanel',
  ];
  let previousIndex = -1;
  for (const tag of orderedTags) {
    const index = template.indexOf(tag);
    assert.ok(index > previousIndex, `${tag} is mounted, after the widget before it`);
    assert.equal(template.indexOf(tag, index + 1), -1, `${tag} is mounted once`);
    previousIndex = index;
  }
  const kpiCards = template.match(/<KpiCard\b/g) ?? [];
  assert.equal(kpiCards.length, 5, 'exactly the five KPI cards');
});

test('the Overview imports no relocated or MOCK-backed widget and no date range', async () => {
  const source = await readPageSource('dashboard/OverviewPage.vue');
  const names = importedNames(source);
  assert.ok(names.includes('BusinessPulseWidget'), 'sanity: the import parser sees the page');
  for (const forbidden of [...RELOCATED_OR_UNMOUNTED, 'useDateRange']) {
    assert.ok(!names.includes(forbidden), `${forbidden} is not imported`);
  }
  const template = templateBlock(source);
  for (const forbidden of RELOCATED_OR_UNMOUNTED) {
    assert.ok(!template.includes(`<${forbidden}`), `${forbidden} is not mounted`);
  }
  assert.ok(!template.includes('range-selector'), 'the range selector is gone');
});

test('the governance widgets are mounted on Vision & Roadmap', async () => {
  const source = await readPageSource('vision/VisionRoadmapPage.vue');
  const names = importedNames(source);
  const template = templateBlock(source);
  assert.ok(template.includes('Build governance'), 'under a "Build governance" heading');
  for (const widget of [
    'VisionCard',
    'GovernanceKpiStrip',
    'GovernanceThroughputWidget',
    'StatusFeedWidget',
  ]) {
    assert.ok(names.includes(widget), `${widget} is imported`);
    assert.ok(template.includes(`<${widget}`), `${widget} is mounted`);
  }
});

test('the DAU chart and acquisition strip are mounted on Players', async () => {
  const source = await readPageSource('players/PlayerAnalyticsPage.vue');
  const names = importedNames(source);
  const template = templateBlock(source);
  for (const widget of ['DauChartWidget', 'AcquisitionFunnelStripWidget']) {
    assert.ok(names.includes(widget), `${widget} is imported`);
    assert.ok(template.includes(`<${widget}`), `${widget} is mounted`);
  }
});

test('no page mounts the Alerts panel', async () => {
  const entries = await readdir(pagesDirectory, { recursive: true });
  const pageFiles = entries.filter((entry) => entry.endsWith('.vue'));
  assert.ok(pageFiles.length > 0, 'sanity: page files were found');
  for (const pageFile of pageFiles) {
    const source = await readPageSource(pageFile);
    assert.ok(!importedNames(source).includes('AlertsPanel'), `${pageFile} imports AlertsPanel`);
    assert.ok(!templateBlock(source).includes('<AlertsPanel'), `${pageFile} mounts AlertsPanel`);
  }
});
