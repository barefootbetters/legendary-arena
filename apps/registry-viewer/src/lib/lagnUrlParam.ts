/**
 * lagnUrlParam.ts — pure decoder for the Loadout tab's `?lagn=` deep-link
 * (WP-362 / D-24154).
 *
 * Turns the `?lagn=<base64url(UTF-8 LAGN JSON)>` URL parameter into the JSON
 * **text** that `parseLagnLoadout` (WP-291) already accepts. It is **decode-only**:
 * it never `JSON.parse`s, inspects, or validates the LAGN — all validation stays
 * in the one WP-291 module. The `base64url(UTF-8 JSON)` encoding is a cross-WP
 * contract owned here; WP-363's arena-client encoder is its exact inverse.
 *
 * Pure helper: no Vue, no network, no clock, no randomness, no DOM beyond the
 * global `atob` / `TextDecoder`. Deterministic (same param string → same text or
 * same error) and it **never throws** — every malformed input (a truncated /
 * corrupt payload, a present-but-empty value, an over-length value) returns a
 * typed error result the caller renders.
 *
 * Authority: WP-362 §Scope (In) §A; EC-392; D-24154.
 */

/** The result of inspecting a URL query string for the `lagn` parameter. */
export type ParseLagnUrlParamResult =
  | { present: false }
  | { present: true; ok: true; text: string }
  | { present: true; ok: false; error: string };

// why: a Tier-1 LAGN is ~500–800 bytes; this cap is a generous paste / DoS guard
// (a giant `?lagn=` value is rejected before `atob` rather than decoded), not a
// real size limit.
const MAX_LAGN_PARAM_LENGTH = 8192;

// why: one full-sentence message for every decode failure — the caller shows it
// verbatim, so it must name what to do (get a fresh link) without leaking why.
const DECODE_ERROR =
  "The loadout link could not be read. It may be truncated or corrupted — ask for a fresh link from the game.";

/**
 * Decodes a base64url string (RFC 4648 §5: `-`/`_` alphabet, no `=` padding) of
 * UTF-8 bytes into text. Throws on an invalid alphabet, an impossible length, or
 * invalid UTF-8 — the sole public function catches every throw.
 *
 * @param base64url - The raw `lagn` parameter value.
 * @returns The decoded UTF-8 text.
 */
function decodeBase64UrlToUtf8(base64url: string): string {
  // why: base64url → standard base64 for `atob`. base64url uses `-`/`_` (never
  // `+`/`/`), which also sidesteps `URLSearchParams` decoding a literal `+` to a
  // space — by the time a value reaches here it carries no `+` to mangle.
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = base64.length % 4;
  if (remainder === 1) {
    throw new Error("A base64url value of length % 4 === 1 is malformed.");
  }
  if (remainder === 2) {
    base64 += "==";
  } else if (remainder === 3) {
    base64 += "=";
  }
  // why: `atob` yields a Latin-1 byte string (one char per byte); rebuild the
  // byte array and UTF-8-decode it so multi-byte card names survive the trip.
  // `fatal: true` makes invalid UTF-8 throw (→ the caller's decode error) rather
  // than silently emitting replacement characters.
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/**
 * Parses a URL query string for the `lagn` parameter and decodes it to LAGN JSON
 * text. Returns `{ present: false }` when the key is absent, a decode error
 * result for a present-but-empty / over-length / corrupt value, and the decoded
 * text otherwise. Decode-only — the returned text is validated by
 * `parseLagnLoadout`, never here. Never throws.
 *
 * @param search - The raw query string, with or without a leading `?` (typically
 *                 `window.location.search`).
 * @returns A {@link ParseLagnUrlParamResult}.
 */
export function parseLagnUrlParam(search: string): ParseLagnUrlParamResult {
  const raw = new URLSearchParams(search).get("lagn");
  if (raw === null) {
    return { present: false };
  }
  // why: a present-but-empty (`?lagn=`) or over-length value is present-and-an-
  // error, not absent — the tab still switches and shows the decode error, and
  // neither reaches `atob` / `parseLagnLoadout`.
  if (raw === "" || raw.length > MAX_LAGN_PARAM_LENGTH) {
    return { present: true, ok: false, error: DECODE_ERROR };
  }
  try {
    return { present: true, ok: true, text: decodeBase64UrlToUtf8(raw) };
  } catch (decodeFailure) {
    // why: swallow every decode throw into the typed error result — the decoder
    // is contractually non-throwing so a bad link never white-screens the app.
    void decodeFailure;
    return { present: true, ok: false, error: DECODE_ERROR };
  }
}
