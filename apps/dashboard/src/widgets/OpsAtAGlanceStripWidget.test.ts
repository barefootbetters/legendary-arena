/**
 * OpsAtAGlanceStripWidget source guards.
 *
 * The dashboard test runner is `node --test` with no SFC loader, so the
 * widget cannot be mounted here. These tests pin the properties the
 * Overview depends on by reading the component source: the cost card reads
 * the real vendor-bill actuals (not the mock factory), and the Server and DR
 * drill cards read their live endpoints through the pure card builders (WP-791
 * / D-24653), whose branches — including "mock data never shows a verdict" —
 * are unit tested in `utils/overviewPulse.test.ts`. The cost arithmetic itself
 * is covered by `config/infraCostActuals.test.ts` against the same composable.
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
  assert.match(
    source,
    /import \{ fetchInfraCostActuals, INFRA_COST_ACTUALS_AS_OF \} from '\.\.\/config\/infraCostActuals\.js';/,
  );
  assert.match(source, /const costResponse = computed\(\(\) => fetchInfraCostActuals\(\)\);/);
  assert.doesNotMatch(source, /fetchInfraCostEntries/);
});

test('the server and DR drill cards read live endpoints through the pure card builders', async () => {
  const source = await readWidgetSource();
  assert.match(
    source,
    /import \{ fetchRuntimeHealth, liveEnvelope \} from '\.\.\/services\/endpoints\.js';/,
  );
  assert.match(
    source,
    /import \{ describeDrDrillCard, describeServerCard \} from '\.\.\/utils\/overviewPulse\.js';/,
  );
  assert.match(source, /apiClient\.get<\{ data: DrReadiness \}>\('\/api\/dash\/dr-readiness'\)/);
  assert.match(source, /return liveEnvelope\(response\.data\.data\);/);
  assert.match(source, /const view = describeServerCard\(\{/);
  assert.match(source, /const view = describeDrDrillCard\(\{/);
  for (const retired of [
    'fetchUptimeProbes',
    'fetchErrorRateSnapshots',
    'useDateRange',
    'usePublicSurfaceHealth',
    'useErrorRateMonitor',
  ]) {
    assert.ok(!source.includes(retired), `the strip no longer uses ${retired}`);
  }
});

test('every card carries its own source tag and the strip-wide badge is gone', async () => {
  const source = await readWidgetSource();
  const sourceTags = source.match(/sourceTag: buildSourceTag\(/g) ?? [];
  assert.equal(sourceTags.length, 4, 'server + DR drill + cost × (placeholder + data) branches');
  assert.match(source, /class="card-source"/);
  assert.doesNotMatch(source, /freshness-badge/);
});
