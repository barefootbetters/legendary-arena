import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildLagnFilename,
  serializeLagnDocument,
} from "./matchResultDownload.ts";

/**
 * Pure-logic tests for the portable download (WP-408 / EC-443). The
 * fetch + Blob/anchor trigger is DOM-bound and covered by the dev-server smoke;
 * these pin the filename shape (AC-1) and that the serialized bytes equal the
 * `lagn` payload (AC-1/AC-2 — the download is the server's already-validated
 * output verbatim).
 */

describe("buildLagnFilename", () => {
  it("builds match-<id>.lagn.json", () => {
    assert.equal(buildLagnFilename("abc-123"), "match-abc-123.lagn.json");
    assert.equal(buildLagnFilename("TYB2_jQuUc"), "match-TYB2_jQuUc.lagn.json");
  });
});

describe("serializeLagnDocument", () => {
  it("pretty-prints the lagn payload byte-for-byte", () => {
    const lagn = {
      lagn_version: "1.4.0",
      game_id: "match-1",
      players: [{ seat: 0, player_id: "ana-handle", display_name: "Ana" }],
      result: { outcome: "victory" },
    };
    // why: the downloaded file must equal the endpoint's `lagn` payload — the
    // serializer adds only pretty-print whitespace, never reshapes the document.
    assert.equal(serializeLagnDocument(lagn), JSON.stringify(lagn, null, 2));
    assert.deepEqual(JSON.parse(serializeLagnDocument(lagn)), lagn);
  });
});
