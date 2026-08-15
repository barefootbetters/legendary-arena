/**
 * deployVersion.test.ts — node:test coverage for the deploy-freshness helpers
 * (WP-552 / EC-587 / D-24361).
 *
 * Covers AC-2 (the pure comparison truth table) and AC-3 (every fail-soft path:
 * network rejection, non-200, non-JSON body, JSON without `gitSha`). The
 * composable and the banner have NO unit coverage by design — this app has no
 * `@vue/test-utils`, `jsdom`, or fake-timer harness, and building one would
 * exceed the WP's file budget; they are gated by the D-24026 live-verify.
 *
 * Runner: node:test (native Node.js)
 * Invoke: pnpm --filter registry-viewer test
 */

import { describe, it, beforeEach, after } from "node:test";
import { strict as assert } from "node:assert";
import { fetchDeployedSha, isNewerBuildAvailable, DEPLOY_VERSION_URL } from "./deployVersion.js";

// why: stub globalThis.fetch per test rather than importing a mocking framework
// — the same discipline cardTypesClient.test.ts uses (Node 22+ has fetch built
// in, so reassigning the global is the lowest-friction approach).
const originalFetch = globalThis.fetch;

function stubFetch(
  handler: (url: string) => Promise<Partial<Response>> | Partial<Response>,
): { callCount: () => number } {
  let count = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    count++;
    const url = typeof input === "string" ? input : input.toString();
    const partial = await handler(url);
    return partial as Response;
  }) as typeof fetch;
  return { callCount: () => count };
}

describe("isNewerBuildAvailable (AC-2 truth table)", () => {
  it("is false when the shas match", () => {
    assert.equal(isNewerBuildAvailable("abc1234", "abc1234"), false);
  });

  it("is true when the shas differ", () => {
    assert.equal(isNewerBuildAvailable("abc1234", "def5678"), true);
  });

  it("is false when either sha is empty, null, or undefined", () => {
    // why: the fail-soft guarantee — a prompt is only justified when two real,
    // non-empty builds can be compared. Anything less would reload for no reason.
    assert.equal(isNewerBuildAvailable("", "def5678"), false);
    assert.equal(isNewerBuildAvailable("abc1234", ""), false);
    assert.equal(isNewerBuildAvailable(null, "def5678"), false);
    assert.equal(isNewerBuildAvailable("abc1234", null), false);
    assert.equal(isNewerBuildAvailable(undefined, "def5678"), false);
    assert.equal(isNewerBuildAvailable("abc1234", undefined), false);
    assert.equal(isNewerBuildAvailable(null, null), false);
  });
});

describe("fetchDeployedSha (AC-3 fail-soft paths)", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the sha from a well-formed 200 response", async () => {
    const stub = stubFetch((url) => {
      assert.equal(url, DEPLOY_VERSION_URL, "fetches the page-origin asset, not the API server");
      return { status: 200, json: async () => ({ gitSha: "abc1234" }) };
    });
    assert.equal(await fetchDeployedSha(), "abc1234");
    assert.equal(stub.callCount(), 1);
  });

  it("returns null when the fetch rejects (offline / DNS blip)", async () => {
    stubFetch(() => Promise.reject(new Error("network down")));
    assert.equal(await fetchDeployedSha(), null);
  });

  it("returns null on a non-200 response", async () => {
    stubFetch(() => ({ status: 404, json: async () => ({ gitSha: "abc1234" }) }));
    assert.equal(await fetchDeployedSha(), null);
  });

  it("returns null on a non-JSON body — the pre-fix SPA-fallback symptom", async () => {
    // why: before the emit plugin existed, `/version.json` returned the SPA
    // fallback index.html with HTTP 200. That is exactly this branch, and it
    // must be no-signal rather than an escaping parse error.
    stubFetch(() => ({
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON at position 0");
      },
    }));
    assert.equal(await fetchDeployedSha(), null);
  });

  it("returns null when the body parses but carries no usable gitSha", async () => {
    stubFetch(() => ({ status: 200, json: async () => ({}) }));
    assert.equal(await fetchDeployedSha(), null);

    stubFetch(() => ({ status: 200, json: async () => ({ gitSha: "" }) }));
    assert.equal(await fetchDeployedSha(), null);

    stubFetch(() => ({ status: 200, json: async () => ({ gitSha: 42 }) }));
    assert.equal(await fetchDeployedSha(), null);
  });

  it("never throws on any failure path", async () => {
    // why: the load-bearing contract — the caller polls this on a timer and must
    // never have to guard it. Every failure resolves, none rejects.
    stubFetch(() => Promise.reject(new Error("boom")));
    await assert.doesNotReject(() => fetchDeployedSha());
  });
});
