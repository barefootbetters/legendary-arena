import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import {
  getRegisteredSections,
  registerSection,
  resetRegistryForTests,
} from "./sectionRegistry";

const FooSchema = z.object({ enabled: z.boolean().default(false) });
const BarSchema = z.object({ count: z.number().int().default(0) });

test("registerSection(id, schema, null) adds the entry to the registry", () => {
  resetRegistryForTests();
  registerSection("foo", FooSchema, null);

  const entry = getRegisteredSections().get("foo");
  assert.ok(entry, "expected 'foo' to be registered");
  assert.equal(entry.schema, FooSchema);
  assert.equal(entry.component, null);
});

test("registering a duplicate id throws an Error whose message contains 'already registered'", () => {
  resetRegistryForTests();
  registerSection("foo", FooSchema, null);

  assert.throws(
    () => registerSection("foo", BarSchema, null),
    (error: unknown) => {
      assert.ok(error instanceof Error, "expected Error instance");
      assert.match(error.message, /already registered/);
      return true;
    },
  );
});

test("getRegisteredSections() returns all registered entries after multiple calls", () => {
  resetRegistryForTests();
  registerSection("foo", FooSchema, null);
  registerSection("bar", BarSchema, null);

  const sections = getRegisteredSections();
  assert.equal(sections.size, 2);
  assert.ok(sections.has("foo"));
  assert.ok(sections.has("bar"));
});

test("resetRegistryForTests() empties the registry", () => {
  resetRegistryForTests();
  registerSection("foo", FooSchema, null);
  assert.equal(getRegisteredSections().size, 1);

  resetRegistryForTests();
  assert.equal(getRegisteredSections().size, 0);
});
