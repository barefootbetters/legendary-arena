/**
 * useLagnFromUrl.ts — apply a `?lagn=` deep-link to the Loadout draft on mount
 * (WP-362 / D-24154).
 *
 * Reads `window.location.search` once, decodes the `?lagn=` parameter (the pure
 * `parseLagnUrlParam`), validates the decoded text through the **existing**
 * `parseLagnLoadout` (WP-291 — the sole LAGN validator, no fork), and on success
 * applies the extracted composition to the shared Loadout draft via the public
 * draft setters. Reports whether the parameter was present and any full-sentence
 * errors so `App.vue` can one-shot auto-switch to the Loadout tab and surface a
 * bad link.
 *
 * Atomic apply: `resetDraft()` and the setters run **only** on a valid LAGN. A
 * decode error or an invalid LAGN leaves the draft untouched (no reset, no
 * partial setters). The composable never throws — every path returns the result
 * object.
 *
 * Reads `window.location.search` directly (mirrors `useSetupFromUrl`); tests stub
 * `globalThis.window`.
 *
 * Authority: WP-362 §Scope (In) §B; EC-392; D-24154; WP-291 (`parseLagnLoadout`).
 */

import { parseLagnUrlParam } from "../lib/lagnUrlParam";
import {
  parseLagnLoadout,
  type LagnLoadoutComposition,
  type LagnImportedResult,
} from "../lib/loadoutLagnImport";
import type { UseLoadoutDraftApi } from "./useLoadoutDraft";

/** What the composable reports back to `App.vue`. */
export interface UseLagnFromUrlResult {
  /** Whether the `?lagn=` parameter was present (valid OR malformed). */
  hasLagnParam: boolean;
  /** Full-sentence errors when the parameter was present but unusable. */
  lagnUrlErrors: string[];
  /**
   * The match verdict the shared LAGN carried, when it carried one.
   *
   * why: D-24358 — the deep link is how a REAL match LAGN reaches the viewer, but
   * this composable used to drop the `result` block, so the re-export rebuilt a
   * fabricated verdict. `App.vue` holds this and passes it to `LoadoutBuilder`,
   * which seeds the export composable it owns (the two composables are separate
   * instances with no other channel). Conditionally omitted, so a record carrying
   * no `result` leaves the key absent and the existing exact-shape assertions in
   * this composable's tests keep passing untouched.
   */
  importedResult?: LagnImportedResult | undefined;
}

/**
 * Applies a validated LAGN composition to the draft via the public setter API.
 * Mirrors `LoadoutBuilder.applyLagnImport` (the second call site of this
 * sequence — still under the rule-of-three, so duplicated rather than
 * abstracted). Called ONLY on the `ok:true` path, so `resetDraft` never wipes an
 * in-progress draft for a bad link (atomic apply).
 *
 * @param draftApi - The shared loadout draft API.
 * @param composition - The composition extracted by `parseLagnLoadout`.
 */
function applyComposition(
  draftApi: UseLoadoutDraftApi,
  composition: LagnLoadoutComposition,
): void {
  draftApi.resetDraft();
  if (composition.schemeId !== "") {
    draftApi.setScheme(composition.schemeId);
  }
  if (composition.mastermindId !== "") {
    // why: setMastermind re-applies any Always-Leads villain groups (deduped),
    // so the imported draft carries the villains the printed rule requires —
    // matches LoadoutBuilder.applyLagnImport.
    draftApi.setMastermind(composition.mastermindId);
  }
  for (const villainGroupId of composition.villainGroupIds) {
    draftApi.addVillainGroup(villainGroupId);
  }
  for (const henchmanGroupId of composition.henchmanGroupIds) {
    draftApi.addHenchmanGroup(henchmanGroupId);
  }
  for (const heroDeckId of composition.heroDeckIds) {
    draftApi.addHeroGroup(heroDeckId);
  }
  draftApi.setCount("bystandersCount", composition.bystandersCount);
  draftApi.setCount("woundsCount", composition.woundsCount);
  draftApi.setCount("officersCount", composition.officersCount);
  draftApi.setCount("sidekicksCount", composition.sidekicksCount);

  // why: EC-429 — apply pools AFTER the counts. setSupportPool derives the
  // paired count from the pool, and the LAGN validator has already enforced
  // that copies sum to the count (D-24195), so the derived value equals the
  // one just set. Applying pools first would let setCount overwrite nothing
  // meaningful, but the order keeps the dependency obvious.
  if (composition.supportPools !== undefined) {
    for (const kind of ["bystanders", "wounds", "officers", "sidekicks"] as const) {
      const pool = composition.supportPools[kind];
      if (pool !== undefined) {
        draftApi.setSupportPool(kind, pool);
      }
    }
  }
  draftApi.setPlayerCount(composition.playerCount);
}

/**
 * Reads the `?lagn=` deep-link once and, when present and valid, applies it to
 * the supplied Loadout draft. Returns `{ hasLagnParam, lagnUrlErrors }`.
 *
 * @param draftApi - The shared loadout draft API (from `useLoadoutDraft`).
 * @returns Whether the parameter was present and any full-sentence errors.
 */
export function useLagnFromUrl(
  draftApi: UseLoadoutDraftApi,
): UseLagnFromUrlResult {
  const parsed = parseLagnUrlParam(window.location.search);
  if (!parsed.present) {
    return { hasLagnParam: false, lagnUrlErrors: [] };
  }
  if (!parsed.ok) {
    // why: a decode failure still counts as "present" so App.vue switches to the
    // Loadout tab and shows the error — never a silent no-op. The draft is left
    // untouched (no resetDraft on this path).
    return { hasLagnParam: true, lagnUrlErrors: [parsed.error] };
  }
  const result = parseLagnLoadout(parsed.text);
  if (!result.ok) {
    // why: the single validation call is parseLagnLoadout (WP-291); an invalid
    // LAGN returns its field-level errors and applies nothing (draft untouched).
    return { hasLagnParam: true, lagnUrlErrors: result.errors };
  }
  applyComposition(draftApi, result.composition);
  // why: D-24358 — surface the imported verdict for App.vue to relay to the export
  // composable. Omit the key entirely when the record carried none — never
  // `importedResult: undefined`, which is the same set-an-undefined-property shape
  // the exporter is forbidden to emit.
  const importedResult = result.composition.result;
  if (importedResult === undefined) {
    return { hasLagnParam: true, lagnUrlErrors: [] };
  }
  return { hasLagnParam: true, lagnUrlErrors: [], importedResult };
}
