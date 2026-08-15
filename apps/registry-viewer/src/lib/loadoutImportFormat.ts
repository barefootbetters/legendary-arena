/**
 * loadoutImportFormat.ts — tell an operator WHICH import box a pasted file
 * belongs in (WP-551 / EC-586 / D-24360).
 *
 * The Loadout tab has three adjacent JSON import boxes — `Load JSON`
 * (MATCH-SETUP), `Load LAGN`, and `Load Gauntlet Pack` — and pasting a file into
 * the wrong one produced that validator's field-level errors. Observed live
 * 2026-08-15: a LAGN file in `Load JSON` returned NINE errors, ending
 * `root: The match setup document contains unknown field(s) (lagn_version,
 * $schema, game_id, variant, player_count, setup, result) …`. Every line is
 * correct — it is the MATCH-SETUP validator faithfully rejecting a
 * non-MATCH-SETUP document — but none of it says the one thing the operator
 * needs: use the box below. The operator who hit it built the application.
 *
 * The information was already in the error (`lagn_version` sits in the
 * unknown-fields list), so this module surfaces what the validator already knew,
 * one step earlier and in one sentence.
 *
 * why: ADVISORY ONLY — this never routes and never loads. All three importers
 * REPLACE the draft, and a wrong-format paste is usually a wrong-FILE paste, so
 * auto-loading would destroy the loadout the operator was building. Detection
 * only ever changes the message.
 *
 * Pure module: no Vue reactivity, no I/O, and no import of the three parsers —
 * it reads top-level shape and nothing else.
 *
 * Authority: WP-551 §7; EC-586; D-24360.
 */

/** What a pasted document appears to be, or `unknown` when it cannot be told. */
export type LoadoutImportFormat = "match-setup" | "lagn" | "gauntlet-pack" | "unknown";

/** Which of the three boxes received the paste. */
export type LoadoutImportBox = "match-setup" | "lagn" | "gauntlet-pack";

/**
 * The discriminator pairs, verified against the real schemas rather than the
 * importers' prose.
 *
 * why: BOTH keys are required to claim a format (positive-only). Single-key
 * detection would misfire — `schemaVersion` is also used by
 * `packages/registry/src/gauntletConfigs.ts` for a gauntlet **config**, a
 * different artifact entirely. Requiring the pair does not.
 *
 * Exclusivity holds at the schema level: MATCH-SETUP requires
 * `schemaVersion` + `composition` and is `additionalProperties: false`; a
 * Gauntlet Pack is `z.object({ pack_version, gauntlet }).strict()` — exactly two
 * top-level keys; LAGN requires `lagn_version` + `setup` and declares no
 * `composition`. Note `setup` is genuinely absent from MATCH-SETUP, whose
 * envelope field is `setupId`.
 */
const DISCRIMINATOR_PAIRS: ReadonlyArray<{
  readonly format: LoadoutImportBox;
  readonly keys: readonly [string, string];
}> = [
  { format: "match-setup", keys: ["schemaVersion", "composition"] },
  { format: "lagn", keys: ["lagn_version", "setup"] },
  { format: "gauntlet-pack", keys: ["pack_version", "gauntlet"] },
];

/**
 * Identify which of the three import formats some pasted text appears to be.
 *
 * why: takes the RAW TEXT and parses internally rather than accepting an
 * already-parsed value. That is what lets a malformed / non-JSON paste resolve
 * to `unknown` here instead of pushing three `JSON.parse` try/catch sites into
 * the component — and it is what makes the malformed case assertable at this
 * level at all.
 *
 * @param rawText - The pasted or uploaded text, exactly as the operator supplied it.
 * @returns The detected format, or `unknown` when it cannot be told confidently.
 */
export function sniffLoadoutImportFormat(rawText: string): LoadoutImportFormat {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // why: unparseable text is not a wrong-box mistake — the operator needs the
    // real parser error, so fall through to the existing validation unchanged.
    return "unknown";
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "unknown";
  }
  const document = parsed as Record<string, unknown>;

  const matches: LoadoutImportBox[] = [];
  for (const pair of DISCRIMINATOR_PAIRS) {
    const hasFirstKey = Object.prototype.hasOwnProperty.call(document, pair.keys[0]);
    const hasSecondKey = Object.prototype.hasOwnProperty.call(document, pair.keys[1]);
    if (hasFirstKey && hasSecondKey) {
      matches.push(pair.format);
    }
  }

  // why: a document satisfying MORE than one pair is not resolved by precedence
  // — it returns `unknown` and gets the real validator errors. A file that looks
  // like two formats is one we cannot confidently redirect, and a coin-flip
  // redirect is worse than the honest error. Reachable because LAGN is
  // `additionalProperties: true`, so a third-party file could legally carry a
  // second format's pair as well.
  if (matches.length !== 1) {
    return "unknown";
  }
  return matches[0]!;
}

/** Human-facing names for each box, matching the on-screen labels. */
const BOX_LABEL: Record<LoadoutImportBox, string> = {
  "match-setup": "Load JSON",
  lagn: "Load LAGN",
  "gauntlet-pack": "Load Gauntlet Pack",
};

/** The discriminator key each sentence cites, so the operator can see the tell. */
const FORMAT_TELL: Record<LoadoutImportBox, { readonly name: string; readonly key: string }> = {
  "match-setup": { name: "MATCH-SETUP document", key: "schemaVersion" },
  lagn: { name: "LAGN file", key: "lagn_version" },
  "gauntlet-pack": { name: "Gauntlet Pack", key: "pack_version" },
};

/**
 * On-screen order of the three boxes, top to bottom, so a sentence can say
 * "above" or "below" correctly (`LoadoutBuilder.vue` renders them at `:1586`,
 * `:1614`, `:1641`).
 */
const BOX_ORDER: readonly LoadoutImportBox[] = ["match-setup", "lagn", "gauntlet-pack"];

/**
 * The one-sentence redirect shown when a box receives a format another box owns.
 *
 * Returns `null` when there is nothing to say — the detected format is `unknown`
 * (fall through to the real validator errors) or it is the box's own format
 * (load it normally).
 *
 * @param box - The box that received the paste.
 * @param detected - What {@link sniffLoadoutImportFormat} made of the text.
 * @returns The redirect sentence, or null when no redirect applies.
 */
export function redirectSentenceFor(
  box: LoadoutImportBox,
  detected: LoadoutImportFormat,
): string | null {
  if (detected === "unknown" || detected === box) {
    return null;
  }
  const tell = FORMAT_TELL[detected];
  const direction = BOX_ORDER.indexOf(detected) < BOX_ORDER.indexOf(box) ? "above" : "below";
  return `This looks like a ${tell.name} (it has a "${tell.key}" field). Use the "${BOX_LABEL[detected]}" box ${direction} instead.`;
}
