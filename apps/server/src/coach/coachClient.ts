/**
 * Endgame AI Coach — Anthropic Model Client (WP-594 / EC-629 / D-24403)
 *
 * The real `CoachModelClient`: builds a bounded prompt from the match summary,
 * calls the Anthropic Messages API over Node's built-in `fetch` (no SDK
 * dependency — the repo's built-in-fetch posture), and parses the JSON response
 * into a `CoachReport`. Any transport / parse / shape failure THROWS; the
 * orchestrator catches it and returns `coach_unavailable` (fail-soft), so the
 * endgame card is never blocked (D-24403).
 *
 * This module is imported ONLY by `server.mjs` to wire the production client. The
 * orchestrator, routes, and their tests depend on the injected `CoachModelClient`
 * interface and pass a stub — so the test suite makes ZERO paid calls. The real
 * spend starts only when `ANTHROPIC_API_KEY` is set in the Render environment.
 *
 * Layer-boundary contract: imports nothing from `boardgame.io`,
 * `@legendary-arena/game-engine`, the registry, or any UI package — only the
 * coach types and Node built-ins.
 *
 * Authority: WP-594 §Contract (model = Sonnet 5); EC-629; D-24403.
 */

import type {
  CoachMatchSummary,
  CoachModelClient,
  CoachReport,
} from './coach.types.js';

/** The Anthropic Messages API endpoint. */
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
// why: the pinned Messages API version header the endpoint requires.
const ANTHROPIC_VERSION = '2023-06-01';
/** Output cap — the bounded report (headline + two paragraphs + 2-3 tips) fits well under this. */
const MAX_OUTPUT_TOKENS = 1024;

/**
 * The system prompt: who the coach is and the exact JSON shape it must return.
 * Constant (no per-request interpolation), so it is a natural prompt-cache target
 * and can never carry match-specific text.
 */
const COACH_SYSTEM_PROMPT = [
  'You are a friendly, sharp Legendary deck-building coach reviewing a finished',
  'cooperative game (heroes vs a scheme + mastermind). You are given a factual',
  'match summary. Give concise, encouraging, concrete coaching — never generic',
  'filler. Judge the HERO SELECTION against the scheme and mastermind, critique',
  'what the players ACQUIRED (the acquiredCards lists) and name better options',
  'from the heroes that were available, and read the LUCK of the draw from the',
  'actual vs expected adversity. Lower final scores are better.',
  '',
  'Respond with ONLY a JSON object, no prose around it, matching exactly:',
  '{',
  '  "headline": string,            // one punchy line',
  '  "heroFit": string,             // 2-4 sentences on hero choice vs this scenario',
  '  "purchases": string,           // 2-4 sentences critiquing what was acquired',
  '  "suggestions": string[]        // 2-3 concrete "next time" tips',
  '}',
].join('\n');

/**
 * Build the user turn: the match summary as JSON plus a one-line ask. All data
 * is server-generated (no player free-text), so there is no injection surface.
 *
 * @param summary The match summary.
 * @returns The user message text.
 */
function buildUserMessage(summary: CoachMatchSummary): string {
  return (
    'Here is the finished match summary as JSON. Coach this team.\n\n' +
    JSON.stringify(summary, null, 2)
  );
}

/**
 * Extract the first JSON object from the model's text response. Returns the
 * parsed value, or throws a full-sentence error when no JSON object is present.
 *
 * @param text The model's raw text output.
 * @returns The parsed JSON value.
 */
function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      'The coach model response contained no JSON object; expected a single JSON object with headline/heroFit/purchases/suggestions.',
    );
  }
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Validate a parsed value into a `CoachReport`, throwing a full-sentence error on
 * any missing or wrong-typed field. Keeps the persisted cache well-formed.
 *
 * @param value The parsed model output.
 * @returns The validated report.
 */
function validateCoachReport(value: unknown): CoachReport {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The coach model response was not a JSON object.');
  }
  const candidate = value as {
    headline?: unknown;
    heroFit?: unknown;
    purchases?: unknown;
    suggestions?: unknown;
  };
  if (
    typeof candidate.headline !== 'string' ||
    typeof candidate.heroFit !== 'string' ||
    typeof candidate.purchases !== 'string' ||
    !Array.isArray(candidate.suggestions) ||
    !candidate.suggestions.every((tip) => typeof tip === 'string')
  ) {
    throw new Error(
      'The coach model response was missing a required field or had the wrong type; expected string headline/heroFit/purchases and a string[] suggestions.',
    );
  }
  return {
    headline: candidate.headline,
    heroFit: candidate.heroFit,
    purchases: candidate.purchases,
    suggestions: candidate.suggestions as string[],
  };
}

/**
 * Create the production Anthropic-backed coach client. The returned client's
 * `generate` calls the Messages API and returns a validated report, or throws on
 * any failure (the orchestrator maps a throw to `coach_unavailable`).
 *
 * @param apiKey The Anthropic API key (from `ANTHROPIC_API_KEY`).
 * @param model The model id to call (e.g. `claude-sonnet-5`).
 * @returns A `CoachModelClient` backed by the Anthropic Messages API.
 */
export function createAnthropicCoachClient(
  apiKey: string,
  model: string,
): CoachModelClient {
  return {
    model,
    async generate(summary: CoachMatchSummary): Promise<CoachReport> {
      let response: Response;
      try {
        response = await fetch(ANTHROPIC_MESSAGES_URL, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: MAX_OUTPUT_TOKENS,
            system: COACH_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: buildUserMessage(summary) }],
          }),
        });
      } catch (caughtError) {
        // why: a transport failure is a fail-soft signal, not a crash — re-throw
        // with context so the orchestrator returns coach_unavailable.
        throw new Error(
          'The coach model request failed at the network layer; check ANTHROPIC_API_KEY and outbound connectivity. Underlying error: ' +
            (caughtError instanceof Error ? caughtError.message : String(caughtError)),
        );
      }
      if (!response.ok) {
        throw new Error(
          'The coach model request returned a non-2xx status ' +
            response.status +
            '; the endgame coaching is temporarily unavailable.',
        );
      }
      const body = (await response.json()) as {
        content?: { type?: string; text?: string }[];
      };
      // why: the Messages API returns content blocks; concatenate the text blocks.
      const text = (body.content ?? [])
        .filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('');
      if (text === '') {
        throw new Error('The coach model response carried no text content.');
      }
      return validateCoachReport(extractJsonObject(text));
    },
  };
}
