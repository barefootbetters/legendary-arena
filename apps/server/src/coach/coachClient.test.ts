/**
 * Tests for the Anthropic-backed coach client.
 *
 * Stubs `globalThis.fetch` — no real network, no paid call. Pins: (1) the request
 * faithfully sends the injected config's model + quirks — for Sonnet 5 that means
 * DISABLING extended thinking (it runs it by default and it drained max_tokens,
 * capping the response before any JSON was emitted); (2) a model whose config has
 * no thinking quirk sends NO thinking directive (the model-independence claim at
 * the client layer — a swapped model never re-inherits Sonnet 5's workaround); and
 * (3) a thinking-only / no-text response THROWS (the orchestrator maps that to
 * coach_unavailable) rather than silently returning a malformed report.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAnthropicCoachClient } from './coachClient.js';
import type { CoachMatchSummary } from './coach.types.js';
import type { CoachModelConfig } from './coachModelConfig.js';

// The shipped Sonnet 5 config: disabled thinking (the EC-629 quirk) + the bounded
// report cap. Mirrors what resolveCoachModelConfig returns for the default model.
const SONNET5_CONFIG: CoachModelConfig = {
  model: 'claude-sonnet-5',
  quirks: { thinking: { type: 'disabled' }, maxOutputTokens: 2048 },
};

// why: generate() only JSON-stringifies the summary, so a minimal cast suffices.
const SUMMARY = {
  outcome: 'heroes-win',
  playerCount: 2,
  rounds: 20,
  scheme: 'Midtown Bank Robbery',
  mastermind: 'Red Skull',
  villainGroups: ['HYDRA'],
  henchmanGroups: ['Doombot Legion'],
  heroes: ['Cyclops', 'Rogue'],
  rawScore: -1800,
  finalScore: 640,
  grade: 'b',
  team: { victoryPoints: 50, bystandersRescued: 11 },
  adversity: { schemeTwists: 3, villainsEscaped: 0, bystandersLost: 0 },
  perPlayer: [],
} as unknown as CoachMatchSummary;

const REPORT_JSON = JSON.stringify({
  headline: 'Sharp win.',
  heroFit: 'Good fit.',
  purchases: 'Buy bigger.',
  suggestions: ['Tip one', 'Tip two'],
});

function installFetch(
  makeResponse: () => { status: number; body: unknown },
): { captured: { url: string; init: RequestInit }[]; restore: () => void } {
  const original = globalThis.fetch;
  const captured: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    captured.push({ url: String(url), init: init ?? {} });
    const { status, body } = makeResponse();
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }) as typeof globalThis.fetch;
  return { captured, restore: () => { globalThis.fetch = original; } };
}

test('disables extended thinking in the request and parses the text-block JSON', async () => {
  const stub = installFetch(() => ({
    status: 200,
    // Sonnet 5 returns a thinking block THEN the text block; the client must
    // read the text block and ignore thinking.
    body: {
      content: [
        { type: 'thinking', thinking: '', signature: 'x' },
        { type: 'text', text: REPORT_JSON },
      ],
    },
  }));
  try {
    const client = createAnthropicCoachClient('sk-test', SONNET5_CONFIG);
    const report = await client.generate(SUMMARY);
    assert.equal(report.headline, 'Sharp win.');
    assert.equal(report.suggestions.length, 2);
    // the request must carry the config's model, output cap, and disabled-thinking
    const sent = JSON.parse(String(stub.captured[0]!.init.body));
    assert.deepEqual(sent.thinking, { type: 'disabled' });
    assert.equal(sent.model, 'claude-sonnet-5');
    assert.equal(sent.max_tokens, 2048);
  } finally {
    stub.restore();
  }
});

test('a model whose config has no thinking quirk sends no thinking directive', async () => {
  const stub = installFetch(() => ({
    status: 200,
    body: { content: [{ type: 'text', text: REPORT_JSON }] },
  }));
  try {
    // a swapped-in model selected by config alone, with its own (default) quirks:
    // no thinking directive, its own output cap — driven by config, not code.
    const swappedConfig: CoachModelConfig = {
      model: 'some-other-model-5',
      quirks: { maxOutputTokens: 1500 },
    };
    const client = createAnthropicCoachClient('sk-test', swappedConfig);
    const report = await client.generate(SUMMARY);
    assert.equal(report.headline, 'Sharp win.');
    const sent = JSON.parse(String(stub.captured[0]!.init.body));
    assert.equal(sent.model, 'some-other-model-5');
    assert.equal(sent.max_tokens, 1500);
    // the swapped model must NOT re-inherit Sonnet 5's disabled-thinking workaround
    assert.equal('thinking' in sent, false);
  } finally {
    stub.restore();
  }
});

test('throws when the response has only a thinking block and no text (the prod bug)', async () => {
  const stub = installFetch(() => ({
    status: 200,
    body: { content: [{ type: 'thinking', thinking: 'lots of reasoning', signature: 'x' }] },
  }));
  try {
    const client = createAnthropicCoachClient('sk-test', SONNET5_CONFIG);
    await assert.rejects(client.generate(SUMMARY));
  } finally {
    stub.restore();
  }
});

test('throws on a non-2xx status', async () => {
  const stub = installFetch(() => ({ status: 429, body: { error: 'rate_limited' } }));
  try {
    const client = createAnthropicCoachClient('sk-test', SONNET5_CONFIG);
    await assert.rejects(client.generate(SUMMARY));
  } finally {
    stub.restore();
  }
});
