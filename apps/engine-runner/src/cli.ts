/**
 * cli.ts — pure argument parser for the engine-runner CLI.
 *
 * Turns a raw argv array (`process.argv.slice(2)`) into a validated
 * `RunnerConfig`, or a structured parse error the entrypoint maps to exit
 * code 1. This module is deliberately pure: no filesystem, no engine or
 * registry import, no `process` access — so the whole argument surface is
 * unit-testable in isolation. All simulation work lives in `runMatch.ts`.
 *
 * Layer: application host (`apps/engine-runner`). Imports nothing outside
 * this file — it is the single source of truth for the CLI grammar.
 */

/**
 * The validated runner configuration produced from a well-formed argv.
 *
 * `mode` selects the behaviour (`run` emits a SimulationResult; `verify`
 * runs twice and asserts byte-identical output). `scenarioPath` points at a
 * single MatchSetupDocument JSON file. `games` is the number of bot-vs-bot
 * games to simulate (an integer >= 1). `seed` is the authoritative run seed.
 * `outPath`, when present, redirects the `run` output to a file instead of
 * stdout.
 */
export interface RunnerConfig {
  readonly mode: "run" | "verify";
  readonly scenarioPath: string;
  readonly games: number;
  readonly seed: string;
  readonly outPath?: string;
}

/**
 * The discriminated result of parsing argv. On success it carries the
 * validated `RunnerConfig`; on failure it carries a full-sentence message
 * (what was wrong and how to fix it) that the entrypoint writes to stderr
 * before exiting with code 1.
 */
export type ParseRunnerConfigResult =
  | { readonly ok: true; readonly config: RunnerConfig }
  | { readonly ok: false; readonly message: string };

/**
 * The flags that take a following string value. Any other `--flag` token is
 * rejected as unknown so a typo (`--scenrio`) fails loudly rather than being
 * silently ignored.
 */
const VALUE_FLAGS = ["--scenario", "--games", "--seed", "--out"] as const;

/**
 * Parses a raw CLI argv (without the node executable and script path) into a
 * validated `RunnerConfig`.
 *
 * Grammar: `<mode> --scenario <path> --games <n> --seed <string> [--out <path>]`.
 * The first token is the mode (`run` or `verify`). Remaining tokens are
 * value-flags. Any violation (missing mode, unknown mode, unknown flag,
 * missing flag value, missing `--scenario`/`--seed`, non-integer or `< 1`
 * `--games`, empty `--seed`) returns `{ ok: false, message }` — never a
 * partial config. This function performs no IO and never throws.
 *
 * @param argv - the raw argument list, typically `process.argv.slice(2)`.
 * @returns the validated config, or a structured parse error.
 */
export function parseRunnerConfig(
  argv: readonly string[],
): ParseRunnerConfigResult {
  const mode = argv[0];
  if (mode === undefined) {
    return {
      ok: false,
      message:
        "No mode was provided. The first argument must be 'run' or 'verify' (for example: run --scenario setup.json --games 5 --seed demo).",
    };
  }
  if (mode !== "run" && mode !== "verify") {
    return {
      ok: false,
      message: `The mode "${mode}" is not recognized. The first argument must be 'run' or 'verify'.`,
    };
  }

  let scenarioPath: string | undefined;
  let gamesRaw: string | undefined;
  let seed: string | undefined;
  let outPath: string | undefined;

  let index = 1;
  while (index < argv.length) {
    const token = argv[index];
    if (token === undefined) {
      break;
    }
    if (!isValueFlag(token)) {
      return {
        ok: false,
        message: `The argument "${token}" is not a recognized flag. Supported flags are --scenario, --games, --seed, and --out.`,
      };
    }
    const value = argv[index + 1];
    if (value === undefined) {
      return {
        ok: false,
        message: `The flag "${token}" requires a following value but none was provided.`,
      };
    }
    if (token === "--scenario") {
      scenarioPath = value;
    } else if (token === "--games") {
      gamesRaw = value;
    } else if (token === "--seed") {
      seed = value;
    } else {
      outPath = value;
    }
    index += 2;
  }

  if (scenarioPath === undefined || scenarioPath.length === 0) {
    return {
      ok: false,
      message:
        "The --scenario flag is required and must point at a MatchSetupDocument JSON file.",
    };
  }
  if (seed === undefined || seed.length === 0) {
    return {
      ok: false,
      message:
        "The --seed flag is required and must be a non-empty string used as the run seed.",
    };
  }
  const gamesResult = parseGamesValue(gamesRaw);
  if (gamesResult.ok === false) {
    return { ok: false, message: gamesResult.message };
  }

  const config: RunnerConfig = {
    mode,
    scenarioPath,
    games: gamesResult.games,
    seed,
    ...(outPath === undefined ? {} : { outPath }),
  };
  return { ok: true, config };
}

/**
 * Reports whether a token is one of the known value-taking flags.
 *
 * @param token - a single argv token.
 * @returns true when the token is a supported `--flag`.
 */
function isValueFlag(token: string): boolean {
  for (const flag of VALUE_FLAGS) {
    if (token === flag) {
      return true;
    }
  }
  return false;
}

/**
 * Validates the raw `--games` value as an integer >= 1.
 *
 * A digits-only string is required so decimals (`5.5`), negatives (`-3`),
 * and non-numeric text (`abc`) are all rejected with a full-sentence error;
 * a well-formed but zero value is rejected by the `< 1` check.
 *
 * @param gamesRaw - the raw string captured after `--games`, or undefined.
 * @returns the parsed integer, or a structured parse error.
 */
function parseGamesValue(
  gamesRaw: string | undefined,
): { ok: true; games: number } | { ok: false; message: string } {
  if (gamesRaw === undefined) {
    return {
      ok: false,
      message:
        "The --games flag is required and must be an integer of 1 or greater.",
    };
  }
  // why: a strict digits-only test rejects "5.5", "-3", "1e3", and "abc" in
  // one check; Number.parseInt would accept "5abc" as 5, silently dropping
  // the operator's typo. The `< 1` guard then rejects a well-formed "0".
  if (!/^\d+$/.test(gamesRaw)) {
    return {
      ok: false,
      message: `The --games value "${gamesRaw}" is not a whole number. Provide an integer of 1 or greater.`,
    };
  }
  const games = Number.parseInt(gamesRaw, 10);
  if (games < 1) {
    return {
      ok: false,
      message: `The --games value "${gamesRaw}" must be at least 1; a simulation of zero games has no result.`,
    };
  }
  return { ok: true, games };
}
