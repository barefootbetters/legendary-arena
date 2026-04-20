/**
 * Tests for the replay-producer CLI (WP-063 / EC-071).
 *
 * Covers the four AC-locked behaviors:
 *   - determinism: two runs with same --produced-at → byte-identical output
 *   - missing --in → exit 1 with full-sentence stderr message citing the code
 *   - invalid version in input file → exit 2 with full-sentence stderr message
 *   - unwritable --out → exit 4 with full-sentence stderr message
 *
 * Uses node:test + node:assert only. Calls main() directly rather than
 * spawning a subprocess — the entry-point auto-run block is guarded by a
 * process.argv[1] check so import alone does not trigger it.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The minimal fixture shape exercised by the tests. Uses the same
 * 9-field MatchSetupConfig that replay.execute.test.ts does so the fixture
 * is always buildable by buildInitialGameState under an empty-list
 * registry reader.
 */
const minimalInputsFile = {
  version: 1,
  setupConfig: {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  },
  seed: 'test-seed-001',
  playerOrder: ['0', '1'],
  moves: [],
  metadata: { matchId: 'test-match-001' },
};

let tempDir: string;
let stderrBuffer: string[] = [];
let originalStderrWrite: typeof process.stderr.write;

/**
 * Captures process.stderr writes into stderrBuffer so tests can assert on
 * the full-sentence CLI error messages without letting them pollute the
 * test runner's output.
 */
function captureStderr(): void {
  originalStderrWrite = process.stderr.write.bind(process.stderr);
  stderrBuffer = [];
  process.stderr.write = ((chunk: unknown): boolean => {
    if (typeof chunk === 'string') {
      stderrBuffer.push(chunk);
    } else if (chunk instanceof Buffer) {
      stderrBuffer.push(chunk.toString('utf8'));
    }
    return true;
  }) as typeof process.stderr.write;
}

/** Restores the original process.stderr.write after a test. */
function restoreStderr(): void {
  process.stderr.write = originalStderrWrite;
}

before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'replay-producer-'));
});

after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('replay-producer CLI — determinism', () => {
  it('produces byte-identical output across two runs with same --produced-at', async () => {
    const { main } = await import('./cli.js');
    const inputsPath = join(tempDir, 'determinism-inputs.json');
    const out1Path = join(tempDir, 'determinism-run1.json');
    const out2Path = join(tempDir, 'determinism-run2.json');
    await writeFile(inputsPath, JSON.stringify(minimalInputsFile), 'utf8');

    const code1 = await main([
      '--in',
      inputsPath,
      '--out',
      out1Path,
      '--produced-at',
      '2026-04-16T00:00:00Z',
    ]);
    assert.strictEqual(code1, 0);
    const code2 = await main([
      '--in',
      inputsPath,
      '--out',
      out2Path,
      '--produced-at',
      '2026-04-16T00:00:00Z',
    ]);
    assert.strictEqual(code2, 0);

    const bytes1 = await readFile(out1Path, 'utf8');
    const bytes2 = await readFile(out2Path, 'utf8');
    if (bytes1 !== bytes2) {
      let firstDiff = -1;
      const length = Math.min(bytes1.length, bytes2.length);
      for (let i = 0; i < length; i++) {
        if (bytes1[i] !== bytes2[i]) {
          firstDiff = i;
          break;
        }
      }
      assert.fail(
        `Determinism regression: two --produced-at=fixed runs produced divergent output; first differing byte offset = ${firstDiff}.`,
      );
    }
    assert.strictEqual(bytes1, bytes2);
  });
});

describe('replay-producer CLI — exit codes', () => {
  it('exits 1 with full-sentence stderr when --in is missing', async () => {
    const { main } = await import('./cli.js');
    captureStderr();
    try {
      const code = await main([]);
      assert.strictEqual(code, 1);
      const message = stderrBuffer.join('');
      assert.match(message, /Missing required --in flag/);
      assert.match(message, /exit code 1/);
    } finally {
      restoreStderr();
    }
  });

  it('exits 2 with full-sentence stderr when version is not the literal 1', async () => {
    const { main } = await import('./cli.js');
    const badInputsPath = join(tempDir, 'bad-version.json');
    const badFile = { ...minimalInputsFile, version: 2 };
    await writeFile(badInputsPath, JSON.stringify(badFile), 'utf8');

    captureStderr();
    try {
      const code = await main(['--in', badInputsPath]);
      assert.strictEqual(code, 2);
      const message = stderrBuffer.join('');
      assert.match(message, /version.*must be the literal 1/);
      assert.match(message, /exit code 2/);
    } finally {
      restoreStderr();
    }
  });

  it('exits 4 with full-sentence stderr when --out points at an unwritable directory', async () => {
    const { main } = await import('./cli.js');
    const inputsPath = join(tempDir, 'unwritable-inputs.json');
    await writeFile(inputsPath, JSON.stringify(minimalInputsFile), 'utf8');
    // A nested directory path whose parent does not exist — writeFile will
    // fail with ENOENT, mapped to EXIT_OUTPUT_WRITE (4).
    const unwritableOut = join(
      tempDir,
      'nonexistent-subdir-a',
      'nonexistent-subdir-b',
      'output.json',
    );

    captureStderr();
    try {
      const code = await main([
        '--in',
        inputsPath,
        '--out',
        unwritableOut,
        '--produced-at',
        '2026-04-16T00:00:00Z',
      ]);
      assert.strictEqual(code, 4);
      const message = stderrBuffer.join('');
      assert.match(message, /Failed to write output file/);
      assert.match(message, /exit code 4/);
    } finally {
      restoreStderr();
    }
  });
});
