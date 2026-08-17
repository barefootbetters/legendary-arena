import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyImageCheckStatus,
  NO_RESPONSE_STATUS,
} from "./imageCheckStatus.js";

describe("classifyImageCheckStatus", () => {
  test("200 is reachable", () => {
    assert.equal(classifyImageCheckStatus(200), "reachable");
  });

  // why: this is the case that reddened a PR on 2026-08-17. A timeout produces
  // status 0, which under the old `status !== 200` rule was indistinguishable
  // from a 404 and failed the build outright.
  test("a network failure or timeout is transient, not missing", () => {
    assert.equal(classifyImageCheckStatus(NO_RESPONSE_STATUS), "transient");
  });

  test("every 5xx is transient — the server failed, the object did not", () => {
    for (const serverErrorStatus of [500, 502, 503, 504, 520, 599]) {
      assert.equal(
        classifyImageCheckStatus(serverErrorStatus),
        "transient",
        `HTTP ${serverErrorStatus} should be transient`,
      );
    }
  });

  test("408 and 429 are transient despite being 4xx", () => {
    assert.equal(classifyImageCheckStatus(408), "transient");
    assert.equal(classifyImageCheckStatus(429), "transient");
  });

  // why: the whole point of the split is that a genuinely absent image STILL
  // fails the build. A fix for flakiness that also swallowed real 404s would
  // be worse than the flake it replaced.
  test("404 and 410 are missing — a real defect that must fail the build", () => {
    assert.equal(classifyImageCheckStatus(404), "missing");
    assert.equal(classifyImageCheckStatus(410), "missing");
  });

  test("403 is missing — present but not public is still a broken image", () => {
    assert.equal(classifyImageCheckStatus(403), "missing");
  });

  test("an unexpected non-200 defaults to missing rather than being ignored", () => {
    // why: the default has to fail loudly. An unrecognized status silently
    // classified as transient would be retried, warned about, and shipped.
    assert.equal(classifyImageCheckStatus(418), "missing");
    assert.equal(classifyImageCheckStatus(301), "missing");
  });
});
