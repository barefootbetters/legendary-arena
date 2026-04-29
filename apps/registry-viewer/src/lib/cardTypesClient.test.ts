/**
 * cardTypesClient.test.ts — node:test coverage for the card-types fetcher.
 *
 * Covers the four EC-086 contract points: happy path, schema rejection
 * (non-blocking), HTTP failure (non-blocking), and singleton caching.
 * Relational orphan validation is a separate post-parse path; not asserted
 * here (covered by manual smoke per EC-086 Step 13).
 *
 * Runner: node:test (native Node.js)
 * Invoke: pnpm --filter registry-viewer test
 */

import { describe, it, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import { getCardTypes, resetCardTypes } from "./cardTypesClient.js";

// why: stub globalThis.fetch per test rather than importing a mocking
// framework. Node 22+ has fetch as a built-in, so reassigning the global is
// the lowest-friction approach and matches registry.smoke.test.ts's
// "no-mocks" discipline by keeping the stub local to the test surface.
const originalFetch = globalThis.fetch;

function stubFetch(handler: (url: string) => Promise<Partial<Response>> | Partial<Response>): { callCount: () => number } {
  let count = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    count++;
    const url = typeof input === "string" ? input : input.toString();
    const partial = await handler(url);
    return partial as Response;
  }) as typeof fetch;
  return { callCount: () => count };
}

describe("cardTypesClient (WP-086)", () => {
  beforeEach(() => {
    resetCardTypes();
    globalThis.fetch = originalFetch;
  });

  it("happy path: fetches card-types.json and returns parsed entries", async () => {
    const fixture = [
      { slug: "hero",         label: "Hero",         emoji: "\u{1F9B8}", order: 10, parentType: null },
      { slug: "shield",       label: "S.H.I.E.L.D.", emoji: "\u{1F6E1}\u{FE0F}", order: 90, parentType: null },
      { slug: "shield-agent", label: "Agent",                                    order: 10, parentType: "shield" },
    ];
    const stub = stubFetch(() => ({
      ok:   true,
      json: async () => fixture,
    }));

    const result = await getCardTypes("https://example.com");

    assert.equal(result.length, 3, "Expected 3 entries to pass through the fetcher.");
    assert.equal(result[0]!.slug, "hero");
    assert.equal(result[2]!.parentType, "shield");
    assert.equal(stub.callCount(), 1, "Expected exactly one fetch on the happy path.");
  });

  it("schema rejection: invalid payload resolves to empty array (non-blocking)", async () => {
    stubFetch(() => ({
      ok:   true,
      // why: invalid — missing required `parentType` field. CardTypeEntrySchema
      // is .strict() and parentType is z.string().nullable() (always present,
      // either string or null), so absence triggers a Zod rejection.
      json: async () => [{ slug: "hero", label: "Hero", emoji: "\u{1F9B8}", order: 10 }],
    }));

    const result = await getCardTypes("https://example.com");

    assert.deepEqual(result, [], "Expected empty array on schema rejection (non-blocking).");
  });

  it("HTTP failure: 404 resolves to empty array (non-blocking)", async () => {
    stubFetch(() => ({
      ok:     false,
      status: 404,
    }));

    const result = await getCardTypes("https://example.com");

    assert.deepEqual(result, [], "Expected empty array on HTTP failure (non-blocking).");
  });

  it("singleton: second call within session does not re-fetch", async () => {
    const stub = stubFetch(() => ({
      ok:   true,
      json: async () => [],
    }));

    await getCardTypes("https://example.com");
    await getCardTypes("https://example.com");

    assert.equal(
      stub.callCount(),
      1,
      "Expected the singleton _promise to cache the first call — a second " +
      "fetch indicates the cache was bypassed.",
    );
  });
});
