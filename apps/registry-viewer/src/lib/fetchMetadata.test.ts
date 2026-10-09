/**
 * Tests for fetchMetadata — R2 data fetches always revalidate (D-24675).
 */

import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { fetchMetadata } from "./fetchMetadata";
import { createRegistryFromHttp } from "../registry/impl/httpRegistry";

// why: stub globalThis.fetch per test rather than importing a mocking
// framework, matching the sibling client tests.
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * Installs a fetch stub that records each call's URL and init and answers with
 * the given JSON body per URL suffix.
 */
function stubFetch(bodies: Record<string, unknown>): Array<{ url: string; init: RequestInit | undefined }> {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    for (const [suffix, body] of Object.entries(bodies)) {
      if (url.endsWith(suffix)) {
        return new Response(JSON.stringify(body), { status: 200 });
      }
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return calls;
}

test("fetchMetadata asks the browser to revalidate any cached copy", async () => {
  const calls = stubFetch({ "/metadata/core.json": {} });
  await fetchMetadata("https://images.legendary-arena.com/metadata/core.json");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.init?.cache, "no-cache");
});

test("loading the card registry revalidates sets.json and every set file (the stale Always Leads path)", async () => {
  const calls = stubFetch({
    "/metadata/sets.json": [{ abbr: "core", name: "Core Set" }],
    "/metadata/core.json": { abbr: "core", heroes: [], masterminds: [], villains: [], henchmen: [], schemes: [] },
  });
  await createRegistryFromHttp({ metadataBaseUrl: "https://images.legendary-arena.com", eagerLoad: ["core"] });
  assert.ok(calls.length >= 2, `expected sets.json and core.json requests, got ${JSON.stringify(calls.map((call) => call.url))}`);
  for (const call of calls) {
    assert.equal(call.init?.cache, "no-cache", `${call.url} must revalidate`);
  }
});
