/**
 * OpsAtAGlanceStripWidget source guards.
 *
 * The dashboard test runner is `node --test` with no SFC loader, so the
 * widget cannot be mounted here. These tests pin the two properties the
 * Overview depends on by reading the component source: the cost card reads
 * the real vendor-bill actuals (not the mock factory), and a card backed by
 * mock data never shows a status verdict. The cost arithmetic itself is
 * covered by `config/infraCostActuals.test.ts` against the same composable.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const widgetPath = fileURLToPath(new URL('./OpsAtAGlanceStripWidget.vue', import.meta.url));

/**
 * Reads the widget's single-file-component source as text.
 */
async function readWidgetSource(): Promise<string> {
  return readFile(widgetPath, 'utf8');
}

test('the cost card reads the real infra cost actuals, not the mock factory', async () => {
  const source = await readWidgetSource();
  assert.match(source, /import \{ fetchInfraCostActuals, INFRA_COST_ACTUALS_AS_OF \} from '\.\.\/config\/infraCostActuals\.js';/);
  assert.match(source, /const costResponse = computed\(\(\) => fetchInfraCostActuals\(\)\);/);
  assert.doesNotMatch(source, /fetchInfraCostEntries/);
});

test('cards backed by mock data drop their status verdict', async () => {
  const source = await readWidgetSource();
  const mockGuards = source.match(/const isMock = (health|monitor)\.source\.value === 'MOCK';/g) ?? [];
  assert.equal(mockGuards.length, 2, 'the uptime and error-rate cards must each check for MOCK');
  const suppressedStatuses = source.match(/status: isMock \? null : status,/g) ?? [];
  assert.equal(suppressedStatuses.length, 2, 'both mock-capable cards must null their status when mock');
});

test('every card carries its own source tag and the strip-wide badge is gone', async () => {
  const source = await readWidgetSource();
  const sourceTags = source.match(/sourceTag: buildSourceTag\(/g) ?? [];
  assert.equal(sourceTags.length, 6, 'three cards × (placeholder + data) branches');
  assert.match(source, /class="card-source"/);
  assert.doesNotMatch(source, /freshness-badge/);
});
