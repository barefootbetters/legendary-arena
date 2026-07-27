/**
 * Client-side Gauntlet Pack download (WP-441 / D-24261).
 *
 * Builds the WP-440 identity pack for a gauntlet — `{ pack_version, gauntlet:
 * { setAbbr, mastermindSlug, division, playerCount } }` — entirely in the
 * browser from data the SPA already holds, and hands the bytes to the user as a
 * `.gauntlet.json` download. It mirrors `matchResultDownload.ts`'s Blob/anchor
 * pattern MINUS the `fetch`: this pack is assembled client-side, never fetched.
 *
 * why: ZERO-API / SOLE-RUNTIME-DEP (WP-343). `legends-board` ships `vue` as its
 * only runtime dependency; `@legendary-arena/registry` is a devDependency
 * consumed TYPE-ONLY here (`import type`), so the registry never enters the
 * runtime bundle. The pack is built as a plain inline literal that
 * `satisfies GauntletPack`, not via a runtime `buildGauntletPack` call — the
 * server re-resolves and re-validates the pack at import (WP-5).
 *
 * why: the Blob/anchor trigger (`downloadGauntletPack`) is DOM-bound and not
 * unit-tested (node:test cannot supply `document` / `Blob` / `URL`); the pure
 * `buildGauntletPackDocument` / `buildGauntletPackFilename` /
 * `serializeGauntletPack` helpers are tested in `gauntletPackDownload.test.ts`,
 * and the trigger is covered by the dev-server smoke.
 */

import type {
  GauntletDivision,
  GauntletPack,
  GauntletPackIdentity,
} from "@legendary-arena/registry/gauntletPack";

// why: the pack version is a hardcoded literal `1` rather than a runtime import
// of the registry's `GAUNTLET_PACK_VERSION` constant. A value import would give
// this zero-API board SPA a runtime edge into `@legendary-arena/registry`,
// breaking the sole-runtime-dependency invariant (WP-343). The literal mirrors
// `GAUNTLET_PACK_VERSION`; the server re-validates the version at import (WP-5),
// so any drift is caught there rather than shipping a mismatched pack.
const GAUNTLET_PACK_VERSION = 1;

/** Re-exported so the panel can type its division selector without a second
 * registry import. */
export type { GauntletDivision };

/** The 1..5 player-count union the pack identity accepts (from the WP-440
 * contract), re-exported for the panel's count selector. */
export type GauntletPackPlayerCount = GauntletPackIdentity["playerCount"];

/**
 * Builds an identity-only Gauntlet Pack from a gauntlet identity, inline.
 *
 * The four identity fields are copied explicitly so no stray key on the input
 * can leak into the pack, and the literal `satisfies GauntletPack` binds it to
 * the WP-440 contract at compile time.
 *
 * @param identity The gauntlet identity (set, mastermind, division, count).
 * @returns The identity-only pack: `{ pack_version, gauntlet }` and nothing else.
 */
export function buildGauntletPackDocument(
  identity: GauntletPackIdentity,
): GauntletPack {
  return {
    pack_version: GAUNTLET_PACK_VERSION,
    gauntlet: {
      setAbbr: identity.setAbbr,
      mastermindSlug: identity.mastermindSlug,
      division: identity.division,
      playerCount: identity.playerCount,
    },
  } satisfies GauntletPack;
}

/**
 * Builds the download filename for a gauntlet identity.
 *
 * @param identity The gauntlet identity.
 * @returns `gauntlet-<setAbbr>-<mastermindSlug>-<division>-p<N>.gauntlet.json`.
 */
export function buildGauntletPackFilename(
  identity: GauntletPackIdentity,
): string {
  return `gauntlet-${identity.setAbbr}-${identity.mastermindSlug}-${identity.division}-p${identity.playerCount}.gauntlet.json`;
}

/**
 * Serializes a Gauntlet Pack for download (pretty-printed JSON).
 *
 * @param pack The pack to serialize.
 * @returns The two-space-indented JSON text.
 */
export function serializeGauntletPack(pack: GauntletPack): string {
  return JSON.stringify(pack, null, 2);
}

/**
 * Builds the identity pack for a gauntlet and triggers a browser download of it
 * as `gauntlet-<set>-<mm>-<div>-p<N>.gauntlet.json` (MIME `application/json`).
 *
 * why: a client Blob + object URL, NOT a server call — the bytes are assembled
 * from the already-cached index entry plus the selector, so the download adds
 * no network surface.
 *
 * @param identity The gauntlet identity to package and download.
 */
export function downloadGauntletPack(identity: GauntletPackIdentity): void {
  const pack = buildGauntletPackDocument(identity);
  const blob = new Blob([serializeGauntletPack(pack)], {
    type: "application/json",
  });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = buildGauntletPackFilename(identity);
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // why: revoke the object URL after the click so the Blob is not leaked for
    // the page's lifetime (mirrors matchResultDownload.ts).
    URL.revokeObjectURL(objectUrl);
  }
}
