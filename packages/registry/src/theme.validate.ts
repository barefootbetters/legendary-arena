/**
 * theme.validate.ts — never-throw theme validators (registry layer)
 *
 * Two pure helpers:
 *   - validateTheme(data)      — sync — validate a parsed object against
 *                                ThemeDefinitionSchema
 *   - validateThemeFile(path)  — async — read a file, parse JSON, validate,
 *                                and check filename-to-themeId alignment
 *
 * Both functions return a discriminated `ValidationResult`. Neither throws
 * for any failure mode — including I/O errors (ENOENT, EACCES) and malformed
 * JSON. Directory scanners and authoring CLIs can therefore aggregate errors
 * across many files without try/catch noise, consistent with the project-wide
 * "pure helpers return structured results; only Game.setup() may throw" rule
 * (.claude/rules/code-style.md).
 *
 * Authority: WP-055 (Theme Data Model v2) §Scope (In) §B; EC-055 Locked Values.
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { ThemeDefinitionSchema } from "./theme.schema.js";
import type { ThemeDefinition } from "./theme.schema.js";

type ValidationSuccess = { success: true; theme: ThemeDefinition };
type ValidationFailure = {
  success: false;
  errors: Array<{ path: string; message: string }>;
};
export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validate a parsed object against ThemeDefinitionSchema.
 *
 * Never throws. On failure returns `{ success: false, errors: [...] }` where
 * every error has a dot-joined Zod issue path and a full-sentence message.
 *
 * why: the returned `theme` on success is Zod's `safeParse` output.
 * `safeParse` produces a fresh top-level object for object schemas, but
 * nested arrays and objects may share references with the input `data`.
 * Callers that plan to mutate either the input or the returned theme after
 * validation must clone first — e.g., `structuredClone(result.theme)`. This
 * mirrors the WP-028 / D-2802 aliasing-prevention precedent. The
 * top-level-distinctness guarantee is pinned by test #1
 * (`assert.notStrictEqual(result.theme, inputData)`); nested-reference
 * semantics remain documented-but-untested by design to avoid coupling the
 * test suite to Zod internals.
 */
export function validateTheme(data: unknown): ValidationResult {
  const result = ThemeDefinitionSchema.safeParse(data);
  if (result.success) {
    return { success: true, theme: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

/**
 * Read a JSON file, validate it against ThemeDefinitionSchema, and check
 * filename-to-themeId alignment.
 *
 * Never throws. All failure modes return a structured ValidationFailure with
 * one of four stable error-path labels:
 *   - 'file'    — I/O failure (ENOENT, EACCES, etc.)
 *   - 'json'    — malformed JSON
 *   - 'themeId' — filename-to-themeId mismatch
 *   - <schema>  — Zod issue path (dot-joined) for schema violations
 *
 * why: this contract lets directory scanners and authoring CLIs aggregate
 * errors across many files uniformly, without try/catch noise around each
 * call. It is consistent with the project-wide "pure helpers return
 * structured results; only Game.setup() may throw" rule
 * (.claude/rules/code-style.md) and with the WP-055 Debuggability &
 * Diagnostics clause (stable error-path labels for observability).
 */
export async function validateThemeFile(
  filePath: string,
): Promise<ValidationResult> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    // why: I/O failures return a structured result instead of throwing so
    // callers can aggregate file-scan errors uniformly (project-wide
    // never-throw rule for pure helpers).
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      errors: [
        {
          path: "file",
          message: `Cannot read theme file "${filePath}": ${message}.`,
        },
      ],
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    // why: malformed JSON returns a structured result instead of throwing so
    // authoring workflows can report "invalid JSON at <path>" uniformly.
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      errors: [
        {
          path: "json",
          message: `Theme file "${filePath}" contains invalid JSON: ${message}.`,
        },
      ],
    };
  }

  const validation = validateTheme(data);

  if (validation.success) {
    // why: filename-to-themeId alignment prevents silent directory-scan
    // mismatches (a theme whose filename slug disagrees with its themeId is
    // a data-integrity bug that would otherwise be invisible).
    const filenameSlug = basename(filePath, ".json");
    if (filenameSlug !== validation.theme.themeId) {
      return {
        success: false,
        errors: [
          {
            path: "themeId",
            message: `Filename slug "${filenameSlug}" does not match themeId "${validation.theme.themeId}". Theme files must be named {themeId}.json.`,
          },
        ],
      };
    }
  }

  return validation;
}
