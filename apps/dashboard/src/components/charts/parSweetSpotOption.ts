import type { EChartsOption } from 'echarts';
import type { ParProfile } from '../../types/parFidelity.js';

/**
 * Theme colors resolved by the wrapper (`ParSweetSpotChart.vue`) from PrimeVue
 * tokens and passed in, so this builder stays PURE and unit-testable — the
 * dashboard test runner cannot mount a `.vue`, so the option logic lives here
 * (the `DrReadinessWidget` "test the data contract, not the mount" precedent).
 */
export interface ParSweetSpotColors {
  /** The median line + its markers. */
  readonly line: string;
  /** The p25/p75 confidence band fill. */
  readonly band: string;
  /** Axis labels, gridlines, and axis lines. */
  readonly axis: string;
}

/**
 * One median-series datum. `gameCount` rides along so the tooltip can name how
 * many games ended on that turn without a second lookup.
 */
interface MedianDatum {
  readonly value: number;
  readonly gameCount: number;
}

/**
 * Renders the per-turn tooltip: turn, median Raw Score (lower is better), and the
 * game count. Typed `unknown` + cast internally, matching the dashboard
 * chart-widget formatter convention.
 */
function formatSweetSpotTooltip(params: unknown): string {
  const list = Array.isArray(params) ? params : [params];
  // The median series is the one carrying a MedianDatum; the band series carry
  // plain numbers, so find the datum with a gameCount.
  let turn: string | number = '';
  let median: number | null = null;
  let gameCount: number | null = null;
  for (const entry of list) {
    const typed = entry as { axisValue?: string | number; data?: MedianDatum | number };
    if (typed.axisValue !== undefined) {
      turn = typed.axisValue;
    }
    const datum = typed.data;
    if (datum !== null && typeof datum === 'object' && 'gameCount' in datum) {
      median = datum.value;
      gameCount = datum.gameCount;
    }
  }
  if (median === null) {
    return '';
  }
  const lines: string[] = [];
  lines.push(`<strong>Turn ${turn}</strong>`);
  lines.push(`Median score: ${median} (lower is better)`);
  if (gameCount !== null) {
    lines.push(`Games: ${gameCount}`);
  }
  return lines.join('<br/>');
}

/**
 * Builds the ECharts option for a scenario's turns-vs-score sweet-spot curve: a
 * median Raw Score line with a shaded p25/p75 band, x = turn the game ended on.
 *
 * The y-axis intentionally sets NO minimum — `medianRawScore` / p25 / p75 are golf
 * scores that go negative (lower is better), so a `min: 0` would clip the curve.
 *
 * @param profile - the per-scenario profile (its `bins[]` is the curve).
 * @param colors - theme colors resolved by the wrapper (keeps this pure).
 * @returns the ECharts option (median line + p25/p75 band).
 */
export function buildParSweetSpotOption(
  profile: ParProfile,
  colors: ParSweetSpotColors,
): EChartsOption {
  const turns: string[] = [];
  const medianData: MedianDatum[] = [];
  const lowerData: number[] = [];
  // why: an ECharts confidence band is drawn as a transparent lower bound plus a
  // stacked "difference" series carrying the area fill — so the band series holds
  // (p75 - p25), not p75 itself.
  const bandDiffData: number[] = [];
  for (const bin of profile.bins) {
    turns.push(String(bin.turnCount));
    medianData.push({ value: bin.medianRawScore, gameCount: bin.gameCount });
    lowerData.push(bin.p25RawScore);
    bandDiffData.push(bin.p75RawScore - bin.p25RawScore);
  }

  return {
    tooltip: { trigger: 'axis', formatter: formatSweetSpotTooltip },
    textStyle: { color: colors.axis },
    xAxis: {
      type: 'category',
      name: 'turn game ended',
      nameLocation: 'middle',
      nameGap: 26,
      data: turns,
      axisLabel: { color: colors.axis },
      axisLine: { lineStyle: { color: colors.axis } },
    },
    yAxis: {
      // why (D-24406): median/p25/p75 Raw Scores are golf scores that go negative
      // (lower is better) — NO `min: 0`, or the curve clips.
      type: 'value',
      name: 'score (lower = better)',
      axisLabel: { color: colors.axis },
      splitLine: { lineStyle: { color: colors.axis, opacity: 0.25 } },
    },
    series: [
      {
        // Transparent lower bound (p25) — the base of the stacked band.
        name: 'p25',
        type: 'line',
        stack: 'band',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        silent: true,
        data: lowerData,
      },
      {
        // The filled band = p75 - p25, stacked on the p25 base.
        name: 'p25–p75 band',
        type: 'line',
        stack: 'band',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: colors.band, opacity: 0.25 },
        silent: true,
        data: bandDiffData,
      },
      {
        name: 'Median score',
        type: 'line',
        smooth: false,
        symbolSize: 6,
        data: medianData,
        itemStyle: { color: colors.line },
        lineStyle: { color: colors.line, width: 2 },
      },
    ],
    grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true },
  };
}
