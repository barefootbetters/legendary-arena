/**
 * Tests for the build-provenance stamp on the diagnostics and game-log exports.
 *
 * Covers the pure record builder (including the "match is older than the running
 * server" flag), the game-log header lines, the fail-soft fetch, the header in
 * `buildGameLogText`, and the `buildProvenance` field on the diagnostics report.
 *
 * Uses node:test + node:assert only.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProvenanceRecord,
  collectBuildProvenance,
  formatProvenanceHeaderLines,
  type FetchLike,
} from './buildProvenance';
import { buildDiagnosticReport, type DiagnosticContext } from './diagnostics';
import { buildGameLogText } from '../components/log/gameLogExport';

const CLIENT = { gitSha: 'c1c1c1c', buildTimestamp: '2026-10-07T03:31:43.208Z' };
const SERVER = { gitSha: '5d1561f', bootedAtIso: '2026-10-07T03:32:35.578Z' };
// The match from the 2026-10-06 Storm live-verify: created ten minutes before the server rebooted.
const MATCH_CREATED_MS = Date.parse('2026-10-07T03:22:25.531Z');

/**
 * Builds a fake fetch that answers each URL from a table; unknown URLs reject.
 *
 * @param table URL → JSON body (or a numeric HTTP status for a non-OK answer).
 * @returns The fake fetch and the list of requested URLs.
 */
function fakeFetch(table: Record<string, unknown>): { fetchImpl: FetchLike; requested: string[] } {
  const requested: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    requested.push(url);
    if (!(url in table)) {
      throw new Error(`fake fetch has no answer for ${url}`);
    }
    const answer = table[url];
    if (typeof answer === 'number') {
      return { ok: false, json: async () => ({}) };
    }
    return { ok: true, json: async () => answer };
  };
  return { fetchImpl, requested };
}

describe('buildProvenanceRecord', () => {
  test('flags a match created before the running server booted', () => {
    const record = buildProvenanceRecord(CLIENT, SERVER, '452o26A0iXw', MATCH_CREATED_MS);
    assert.deepEqual(record, {
      clientGitSha: 'c1c1c1c',
      clientBuildTimestamp: '2026-10-07T03:31:43.208Z',
      serverGitSha: '5d1561f',
      serverBootedAtIso: '2026-10-07T03:32:35.578Z',
      matchId: '452o26A0iXw',
      matchCreatedAtIso: '2026-10-07T03:22:25.531Z',
      isMatchOlderThanServer: true,
    });
  });

  test('does not flag a match created after the server booted', () => {
    const record = buildProvenanceRecord(CLIENT, SERVER, 'm', Date.parse('2026-10-07T04:00:00.000Z'));
    assert.equal(record.isMatchOlderThanServer, false);
  });

  test('leaves the flag null when either time is unknown', () => {
    assert.equal(buildProvenanceRecord(CLIENT, null, 'm', MATCH_CREATED_MS).isMatchOlderThanServer, null);
    assert.equal(buildProvenanceRecord(CLIENT, SERVER, 'm', null).isMatchOlderThanServer, null);
  });
});

describe('formatProvenanceHeaderLines', () => {
  test('returns no lines when nothing was collected', () => {
    assert.deepEqual(formatProvenanceHeaderLines(null), []);
  });

  test('names the client build, the server build, the match creation and the older-match note', () => {
    const lines = formatProvenanceHeaderLines(buildProvenanceRecord(CLIENT, SERVER, '452o26A0iXw', MATCH_CREATED_MS));
    assert.deepEqual(lines, [
      '# Legendary Arena game log — match 452o26A0iXw',
      '# Client build: c1c1c1c (built 2026-10-07T03:31:43.208Z)',
      '# Server build: 5d1561f (running since 2026-10-07T03:32:35.578Z)',
      '# Match created: 2026-10-07T03:22:25.531Z',
      '# Note: this match was created before the running server started, so it may be using card rules from an earlier build.',
    ]);
  });

  test('says the server build is unknown, and omits the note, when the version check failed', () => {
    const lines = formatProvenanceHeaderLines(buildProvenanceRecord(CLIENT, null, 'm', MATCH_CREATED_MS));
    assert.ok(lines.includes('# Server build: unknown (the version check did not answer)'));
    assert.ok(!lines.some((line) => line.startsWith('# Note:')));
  });
});

describe('collectBuildProvenance', () => {
  test('reads /api/version and the lobby match createdAt', async () => {
    const { fetchImpl, requested } = fakeFetch({
      'https://server.test/api/version': { version: '0.0.1', gitSha: '5d1561f', buildTimestamp: SERVER.bootedAtIso },
      'https://server.test/games/legendary-arena/452o26A0iXw': { createdAt: MATCH_CREATED_MS, updatedAt: MATCH_CREATED_MS },
    });
    const record = await collectBuildProvenance('https://server.test', '452o26A0iXw', CLIENT, fetchImpl);
    assert.deepEqual(requested, [
      'https://server.test/api/version',
      'https://server.test/games/legendary-arena/452o26A0iXw',
    ]);
    assert.equal(record.serverGitSha, '5d1561f');
    assert.equal(record.isMatchOlderThanServer, true);
  });

  test('is fail-soft: a rejected fetch, a non-OK status and a malformed body all become null', async () => {
    const { fetchImpl } = fakeFetch({
      'https://server.test/api/version': 503,
      'https://server.test/games/legendary-arena/m': { createdAt: 'not-a-number' },
    });
    const record = await collectBuildProvenance('https://server.test', 'm', CLIENT, fetchImpl);
    assert.equal(record.serverGitSha, null);
    assert.equal(record.matchCreatedAtIso, null);
    assert.equal(record.isMatchOlderThanServer, null);

    const unreachable = await collectBuildProvenance('https://nowhere.test', 'm', CLIENT, fakeFetch({}).fetchImpl);
    assert.equal(unreachable.serverGitSha, null);
    assert.equal(unreachable.clientGitSha, 'c1c1c1c', 'the client build is always recorded');
  });

  test('skips the match lookup outside a match', async () => {
    const { fetchImpl, requested } = fakeFetch({
      'https://server.test/api/version': { gitSha: '5d1561f', buildTimestamp: SERVER.bootedAtIso },
    });
    await collectBuildProvenance('https://server.test', null, CLIENT, fetchImpl);
    assert.deepEqual(requested, ['https://server.test/api/version']);
  });
});

describe('buildGameLogText header', () => {
  const log = [
    { text: 'first', outcome: 'neutral' as const },
    { text: 'second', outcome: 'applied' as const },
  ];

  test('writes the header lines, a blank line, then the transcript', () => {
    assert.equal(buildGameLogText(log, ['# a', '# b']), '# a\n# b\n\nfirst\n[applied] second\n');
  });

  test('is the plain transcript with no header lines', () => {
    assert.equal(buildGameLogText(log, []), 'first\n[applied] second\n');
    assert.equal(buildGameLogText(log), 'first\n[applied] second\n');
  });
});

describe('diagnostics report buildProvenance field', () => {
  /** A minimal context; only the provenance field varies between cases. */
  function context(overrides: Partial<DiagnosticContext> = {}): DiagnosticContext {
    return {
      appVersion: '0.1.0',
      gitSha: 'c1c1c1c',
      buildTimestamp: CLIENT.buildTimestamp,
      capturedAtIso: '2026-10-07T03:35:01.338Z',
      locationHref: 'http://localhost/play?match=452o26A0iXw',
      matchId: '452o26A0iXw',
      playerId: '0',
      userAgent: 'test-agent',
      viewportWidth: 1024,
      viewportHeight: 768,
      entryDroppedCount: 0,
      uiStateSnapshot: null,
      matchSetup: null,
      transport: {
        isConnected: true,
        lastStateId: 1,
        hasEverConnected: true,
        lastFrameAtMs: null,
        timeSinceLastFrameMs: null,
        reconnectResyncCount: 0,
        moveAckResyncCount: 0,
        spectatorStaleResyncCount: 0,
        tabFocusResyncCount: 0,
      },
      ...overrides,
    };
  }

  test('carries the collected provenance through', () => {
    const provenance = buildProvenanceRecord(CLIENT, SERVER, '452o26A0iXw', MATCH_CREATED_MS);
    const report = buildDiagnosticReport([], context({ buildProvenance: provenance }));
    assert.deepEqual(report.buildProvenance, provenance);
  });

  test('is null, not absent, when no provenance was collected', () => {
    const report = buildDiagnosticReport([], context());
    assert.ok('buildProvenance' in report);
    assert.equal(report.buildProvenance, null);
  });
});
