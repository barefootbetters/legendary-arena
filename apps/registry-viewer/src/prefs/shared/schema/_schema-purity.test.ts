import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// why: guards the Option-A → Option-B hoist (D-1414). Any `vue` or DOM
// import in the schema subtree would block the later file-move of these
// modules to `packages/ui-preferences/` because that package is
// intentionally Node-consumable (future CLI tools, SSR shareable-link
// rendering, CI validators) and cannot depend on a UI framework.

const forbiddenPatterns: Array<{ label: string; regex: RegExp }> = [
  { label: 'from "vue"', regex: /from\s+["']vue["']/ },
  { label: 'from "@vue/...', regex: /from\s+["']@vue\// },
  { label: "document.", regex: /\bdocument\./ },
  { label: "window.", regex: /\bwindow\./ },
];

const here = dirname(fileURLToPath(import.meta.url));

function listSchemaFiles(): string[] {
  return readdirSync(here)
    .filter((name) => name.endsWith(".schema.ts"))
    .map((name) => join(here, name));
}

test("every *.schema.ts file in the schema subtree is free of Vue and DOM references", () => {
  const files = listSchemaFiles();
  assert.ok(
    files.length >= 4,
    `expected at least four schema files (base + appearance + accessibility + advancedBase), found ${files.length}`,
  );
  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    for (const { label, regex } of forbiddenPatterns) {
      assert.equal(
        regex.test(source),
        false,
        `${filePath} contains forbidden pattern: ${label}`,
      );
    }
  }
});
