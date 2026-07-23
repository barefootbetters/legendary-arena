/**
 * registryConfig.drift.test.ts — drift guard for the viewer's public config.
 *
 * The registry-viewer boots by fetching `public/registry-config.json` and
 * validating it against `ViewerConfigSchema` (see `registryClient.ts`). That
 * schema is `.strict()`, so any key present in the shipped config but absent
 * from the schema hard-fails the boot — the viewer renders "Failed to load
 * registry" and nothing else. This exact drift bricked
 * cards.legendary-arena.com once already: the `rulesPageUrl` field (WP-039)
 * was wired through the config and the UI but never added to the schema.
 *
 * This test reads the ACTUAL shipped config file and asserts it parses, so a
 * future config-field addition fails here in CI instead of live in the
 * browser. Add the field to `ViewerConfigSchema` and this test goes green.
 *
 * Runner: node:test (native Node.js)
 * Invoke: pnpm --filter registry-viewer test
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ViewerConfigSchema } from "@legendary-arena/registry/schema";

// why: resolve the config path relative to this test file rather than the
// process cwd, so the test passes whether invoked from the app dir or repo
// root. src/lib/ -> ../../public/registry-config.json.
const configPath = fileURLToPath(
  new URL("../../public/registry-config.json", import.meta.url),
);

describe("registry-config.json drift guard", () => {
  it("the shipped public/registry-config.json satisfies ViewerConfigSchema", () => {
    const rawPayload = JSON.parse(readFileSync(configPath, "utf8"));
    const parseResult = ViewerConfigSchema.safeParse(rawPayload);

    // why: surface the first Zod issue in the failure message so a future
    // drift (a new config key not yet in the schema) points straight at the
    // offending field instead of a bare "expected true".
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      assert.fail(
        `public/registry-config.json failed ViewerConfigSchema at ${path}: ` +
          `${issue.message}. If you added a config field, add it to ` +
          `ViewerConfigSchema in packages/registry/src/schema.ts (the schema ` +
          `is .strict(), so unlisted keys reject and brick the viewer boot).`,
      );
    }
    assert.equal(parseResult.success, true);
  });

  it("rejects an unknown top-level key (documents the .strict() contract)", () => {
    const withUnknownKey = {
      metadataBaseUrl: "https://images.legendary-arena.com",
      someFutureField: "https://example.com/",
    };
    const parseResult = ViewerConfigSchema.safeParse(withUnknownKey);
    assert.equal(
      parseResult.success,
      false,
      "ViewerConfigSchema must stay .strict() so config drift is caught, " +
        "not silently ignored.",
    );
  });
});
