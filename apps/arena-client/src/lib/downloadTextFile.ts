/**
 * Browser text-file download helper.
 *
 * Triggers a file download of a text payload via a transient object-URL anchor.
 * Extracted at the THIRD occurrence of this idiom — `DiagnosticExportButton`'s
 * `triggerDownload` and `GameLogPanel`'s `saveLog` were the first two (each an
 * inline copy under the §16.1 "duplicate first, abstract on the third" rule) —
 * so the new endgame game-log download reuses one path instead of adding a
 * fourth copy. Those two prior call sites can adopt this helper in a follow-up;
 * this change does not retrofit them (they are separately tested and out of
 * scope here).
 *
 * The object-URL APIs are guarded so a call in a non-browser context (jsdom, a
 * thumbnail/preview renderer) is a safe no-op rather than a throw — the DOM side
 * effect itself is verified live, mirroring the two inline predecessors which are
 * likewise not unit-tested for the click.
 */

/**
 * Downloads `text` as a file named `fileName`.
 *
 * @param fileName The download file name (including extension).
 * @param text The full text payload to write into the file.
 * @param mimeType The blob MIME type; defaults to `text/plain`.
 */
export function downloadTextFile(
  fileName: string,
  text: string,
  mimeType: string = 'text/plain',
): void {
  // why: guard the object-URL API — a non-browser context (jsdom / preview) has
  // no URL.createObjectURL, so bail out safely rather than throwing.
  if (typeof URL.createObjectURL !== 'function') {
    return;
  }
  const blob = new Blob([text], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}
