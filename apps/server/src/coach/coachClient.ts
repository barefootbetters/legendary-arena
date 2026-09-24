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
 * This module is imported by `server.mjs` (production, to wire the live client)
 * and by `scripts/coach-eval.mjs` (the operator-run model eval, WP-737). The
 * orchestrator, routes, and their tests depend on the injected `CoachModelClient`
 * interface and pass a stub — so the test suite makes ZERO paid calls. The real
 * spend starts only when `ANTHROPIC_API_KEY` is set in the Render environment, or
 * when an operator runs `coach:eval` with the key exported in their shell.
 *
 * Layer-boundary contract: imports nothing from `boardgame.io`,
 * `@legendary-arena/game-engine`, the registry, or any UI package — only the
 * coach types and Node built-ins.
 *
 * Authority: WP-594 §Contract; EC-629; D-24403. The model and its per-model
 * quirks are no longer hardcoded here — they come from the injected
 * `CoachModelConfig` (see `coachModelConfig.ts`), the coach model-independence
 * shim.
 */

import type {
  CoachMatchSummary,
  CoachModelClient,
  CoachReport,
} from './coach.types.js';
import type { CoachModelConfig } from './coachModelConfig.js';

/** The Anthropic Messages API endpoint. */
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
// why: the pinned Messages API version header the endpoint requires.
const ANTHROPIC_VERSION = '2023-06-01';

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
  'what the players ACQUIRED and name better options from the heroes that were',
  'available, and read the LUCK of the draw from the actual vs expected adversity.',
  '`schemeTwistsFromVillainDeck` counts Scheme Twists drawn from the Villain Deck —',
  'like Master Strikes, they come from the shuffle, not from the heroes. Never blame',
  'the hero selection or purchases for how many there were, and never suggest a',
  'purchase or play as a way to get fewer of them. If the summary has no',
  '`adversityExpected`, there is nothing to compare against, so make no luck read.',
  'Lower final scores are better. If the summary has no rawScore, finalScore or grade,',
  'this was a casual (unscored) match: coach the play itself and never invent a score',
  'or grade.',
  '',
  "Each player's `acquiredCards` are the hero cards they BOUGHT from the HQ during",
  'the game (their starting S.H.I.E.L.D. deck and Wounds are already excluded) —',
  'so treat them as deliberate purchase choices, never as starter cards. `heroes`',
  'is the pool of five hero decks that were available to buy this match.',
  '',
  "Each player also carries `villainsDefeated`, `henchmenDefeated`, and",
  '`mastermindTacticsDefeated` — the enemies that seat personally took down. Use',
  'them to read who carried the combat and who leaned on their allies, and to give',
  'per-player coaching (e.g. an ally who bought well but defeated little, or one',
  'who cleared villains while another chased bystanders).',
  '',
  'Each player line also carries synergy counts. `conditionalClausesPlayed` and',
  '`conditionalClausesAssembled` are CLAUSE counts: how many conditional hero',
  'abilities that seat played, and how many of them had their condition met.',
  '`conditionalClausesPotentialValue` and `conditionalClausesRealizedValue` are',
  'attack/recruit AMOUNTS, not clause counts. Quote every number exactly as the',
  'summary gives it, and never mix a count with an amount.',
  '',
  'Each player line carries `isBotAlly`; `true` marks a bot ally that played',
  'alongside the humans. In a bot-ally game, coach the human player(s) only. Treat',
  "the bot as their ally: never critique, praise or rank the bot's purchases or",
  "play, and never compare the human's deck-building with the bot's. Use the bot's",
  'line only as context for what the human was left to do (for example, the bot',
  'cleared the villains, so the human could focus on rescues). A bot seat has no',
  "`acquiredCards` on purpose: never guess at or comment on what the bot bought.",
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
 * Escape one raw control character (U+0000–U+001F) as its JSON string escape.
 *
 * @param character A single control character.
 * @returns The escaped form (`\n`, `\r`, `\t`, or `\uXXXX`).
 */
function escapeControlCharacter(character: string): string {
  if (character === '\n') {
    return '\\n';
  }
  if (character === '\r') {
    return '\\r';
  }
  if (character === '\t') {
    return '\\t';
  }
  return '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0');
}

/**
 * Escape raw control characters that appear INSIDE JSON string literals, leaving
 * structural whitespace between tokens untouched. A small string-aware scanner:
 * it tracks whether it is inside a `"…"` literal and honours backslash escapes so
 * an escaped quote (`\"`) does not end the string.
 *
 * @param jsonText Candidate JSON text.
 * @returns The same text with in-string control characters escaped.
 */
function escapeControlCharactersInStrings(jsonText: string): string {
  let output = '';
  let isInsideString = false;
  let isEscaping = false;
  for (const character of jsonText) {
    if (isInsideString) {
      if (isEscaping) {
        isEscaping = false;
      } else if (character === '\\') {
        isEscaping = true;
      } else if (character === '"') {
        isInsideString = false;
      } else if (character.charCodeAt(0) < 0x20) {
        output += escapeControlCharacter(character);
        continue;
      }
    } else if (character === '"') {
      isInsideString = true;
    }
    output += character;
  }
  return output;
}

/**
 * Extract the first JSON object from the model's text response. Returns the
 * parsed value, or throws a full-sentence error when no JSON object is present
 * or the object is not valid JSON.
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
  // why: models occasionally emit a literal newline/tab inside a string value
  // (WP-737 eval: 1 of 16 Sonnet 5 calls). Strict JSON.parse rejects that with
  // "Bad control character in string literal", which surfaced to a paying player
  // as coach_unavailable. Escaping in-string control characters recovers the
  // report without loosening anything else about the JSON grammar.
  const sanitized = escapeControlCharactersInStrings(text.slice(start, end + 1));
  try {
    return JSON.parse(sanitized);
  } catch (caughtError) {
    throw new Error(
      'The coach model response contained a JSON object that could not be parsed; expected valid JSON with headline/heroFit/purchases/suggestions. Underlying error: ' +
        (caughtError instanceof Error ? caughtError.message : String(caughtError)),
    );
  }
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
 * `generate` calls the Messages API with the injected model + per-model quirks and
 * returns a validated report, or throws on any failure (the orchestrator maps a
 * throw to `coach_unavailable`). The model and its quirks come from the caller's
 * resolved `config` (see `coachModelConfig.ts`), so a model swap is a config
 * change with no edit here.
 *
 * @param apiKey The Anthropic API key (from `ANTHROPIC_API_KEY`).
 * @param config The resolved coach model + per-model request quirks to apply.
 * @returns A `CoachModelClient` backed by the Anthropic Messages API.
 */
export function createAnthropicCoachClient(
  apiKey: string,
  config: CoachModelConfig,
): CoachModelClient {
  return {
    model: config.model,
    async generate(summary: CoachMatchSummary): Promise<CoachReport> {
      // why: build the request from the injected model config so no model id or
      // per-model quirk (thinking directive, output cap) is hardcoded here — the
      // routing layer (coachModelConfig.ts) owns model-specific behaviour.
      const requestBody: Record<string, unknown> = {
        model: config.model,
        max_tokens: config.quirks.maxOutputTokens,
        system: COACH_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(summary) }],
      };
      // why: send a `thinking` directive only when this model has one configured
      // (e.g. Sonnet 5's disabled-thinking quirk, the EC-629 hotfix). A model with
      // no quirk row sends none and uses its own default — it never re-inherits the
      // previous model's workaround.
      if (config.quirks.thinking !== undefined) {
        requestBody.thinking = config.quirks.thinking;
      }
      // why: some models tune reasoning depth via effort rather than a thinking
      // toggle (e.g. Opus 5, which keeps thinking on at low effort for a bounded
      // call). Send `output_config.effort` only when the model's config sets one;
      // otherwise the API uses its default effort.
      if (config.quirks.effort !== undefined) {
        requestBody.output_config = { effort: config.quirks.effort };
      }
      let response: Response;
      try {
        response = await fetch(ANTHROPIC_MESSAGES_URL, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
          },
          body: JSON.stringify(requestBody),
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
