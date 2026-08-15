import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ref } from "vue";
import { validate } from "@legendary-arena/lagn";
import { useLoadoutLagnExport } from "./useLoadoutLagnExport";
import type { MatchSetupDocument } from "@legendary-arena/registry/setupContract";

// why: playerCount is 1 so the export's variant, which is DERIVED (read-only)
// from the seat count (1 → Classic/"solo"), is Solo here. Tests that exercise the
// Custom (→ "cooperative") path set playerCount to 2, which is the only way to
// change the variant now that it is a computed rather than an editable control.
function createValidDraft(): MatchSetupDocument {
  return {
    schemaVersion: "1.0",
    setupId: "setup-test",
    createdAt: "2026-06-12T00:00:00Z",
    createdBy: "player",
    seed: "a1b2c3d4e5f6g7h8",
    playerCount: 1,
    expansions: ["base"],
    heroSelectionMode: "GROUP_STANDARD",
    composition: {
      schemeId: "scheme-plot",
      mastermindId: "mastermind-loki",
      villainGroupIds: ["villain-brotherhood"],
      henchmanGroupIds: ["henchman-dark-minions"],
      heroDeckIds: ["hero-iron-man"],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    },
  };
}

function createIncompleteDraft(): MatchSetupDocument {
  return {
    schemaVersion: "1.0",
    setupId: "setup-incomplete",
    createdAt: "2026-06-12T00:00:00Z",
    createdBy: "player",
    seed: "a1b2c3d4e5f6g7h8",
    playerCount: 2,
    expansions: ["base"],
    heroSelectionMode: "GROUP_STANDARD",
    composition: {
      schemeId: "", // missing
      mastermindId: "mastermind-loki",
      villainGroupIds: ["villain-brotherhood"],
      henchmanGroupIds: ["henchman-dark-minions"],
      heroDeckIds: ["hero-iron-man"],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    },
  };
}

test("UUID generation produces valid v4 format", () => {
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  const uuid = api.gameId.value;
  const uuidv4Pattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.match(uuid, uuidv4Pattern, "game_id should be a valid UUID v4");
});

test("UUID generation produces unique values on regenerate", () => {
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  const first = api.gameId.value;
  api.regenerateGameId();
  const second = api.gameId.value;

  assert.notEqual(first, second, "regenerateGameId() should produce a different UUID");
});

test("composition maps to LAGN setup correctly", () => {
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  const built = api.buildLagnFile();
  assert(built, "buildLagnFile should return a file for valid composition");

  const parsed = JSON.parse(built.file);
  assert.equal(parsed.setup.mastermind.id, "mastermind-loki");
  assert.equal(parsed.setup.scheme.id, "scheme-plot");
  assert.deepEqual(parsed.setup.villain_groups, [{ id: "villain-brotherhood", name: "" }]);
  assert.deepEqual(parsed.setup.henchmen_groups, [{ id: "henchman-dark-minions", name: "" }]);
  assert.deepEqual(parsed.setup.heroes, [{ id: "hero-iron-man", name: "" }]);
  assert.equal(parsed.setup.bystanders_count, 30);
  assert.equal(parsed.setup.wounds_count, 30);
  assert.equal(parsed.setup.shield_officers_count, 30);
  assert.equal(parsed.setup.sidekicks_count, 0);
});

test("variant/outcome selection required for validation", () => {
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  // why: D-24358 — the default outcome is now "unset", which omits the optional
  // result block entirely. The document is still valid: LAGN requires only
  // lagn_version / game_id / variant / player_count / setup.
  assert.equal(api.outcome.value, "unset", "the default outcome must be unset, never victory");
  assert(api.isValid.value, "isValid should be true with the default unset outcome");

  // why: the variant is derived from the seat count (read-only), so a 2-player
  // draft is a cooperative export automatically — no variant control to set.
  draft.value.playerCount = 2;
  assert.equal(api.variant.value, "custom", "2 seats should derive the Custom variant");
  assert(api.isValid.value, "isValid should remain true for a consistent cooperative + 2-player export");

  api.outcome.value = "loss";
  assert(api.isValid.value, "isValid should remain true when outcome changes to loss");
});

test("a user-chosen loss emits NO loss_condition (D-24358)", () => {
  // why: the exporter used to stamp loss_condition="deck_exhausted" on every
  // defeat, which is wrong for a scheme-completion or mastermind loss. It is now
  // IMPORT-ONLY — a user pick carries no loss condition at all.
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  api.outcome.value = "loss";
  const built = api.buildLagnFile();
  assert(built, "buildLagnFile should return a file when outcome is loss");

  const parsed = JSON.parse(built.file);
  assert.equal(parsed.result.outcome, "defeat", "internal 'loss' maps to the LAGN 'defeat'");
  assert.equal(
    Object.prototype.hasOwnProperty.call(parsed.result, "loss_condition"),
    false,
    "no loss_condition may be synthesized for a user-chosen loss",
  );
});

test("an unset outcome omits the result KEY entirely (AC-4, D-24358)", () => {
  // why: a Loadout-tab export is a Tier-1 SETUP document and `result` is optional
  // in LAGN, so an outcome that was never imported nor chosen asserts nothing.
  // Asserted on BOTH the built object and the raw string: JSON.stringify drops
  // `result: undefined`, so a parse-only check would pass on the forbidden shape.
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  assert.equal(api.outcome.value, "unset", "default is unset");
  const built = api.buildLagnFile();
  assert(built, "an unset outcome still produces a valid file");

  assert.equal(built.file.includes('"result"'), false, "the serialized file has no result key");
  assert.equal(
    Object.prototype.hasOwnProperty.call(JSON.parse(built.file), "result"),
    false,
    "the parsed document has no result key",
  );
  const validated = validate(JSON.parse(built.file));
  assert(validated.valid, `a result-less document must still validate: ${String(validated.errors)}`);
});

test("an imported verdict round-trips, including loss_condition (AC-1..AC-3)", () => {
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  api.applyImportedResult({ outcome: "defeat", lossCondition: "city_overrun" });
  const built = api.buildLagnFile();
  assert(built, "buildLagnFile should succeed after an imported defeat");

  const parsed = JSON.parse(built.file);
  assert.equal(parsed.result.outcome, "defeat", "an imported defeat re-exports as defeat");
  assert.equal(
    parsed.result.loss_condition,
    "city_overrun",
    "an imported loss_condition round-trips verbatim, not replaced by deck_exhausted",
  );
});

test("applyImportedResult REPLACES, never merges (AC-6b, D-24358)", () => {
  // why: the bug class D-24358 forbids — a second import carrying no verdict must
  // not leave the first one standing. Replace also overrides a prior USER choice.
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  api.applyImportedResult({ outcome: "defeat", lossCondition: "city_overrun" });
  assert.equal(api.outcome.value, "loss", "the imported defeat seeded the state");

  api.applyImportedResult(undefined);
  assert.equal(api.outcome.value, "unset", "a no-result import resets to unset");

  const built = api.buildLagnFile();
  assert(built);
  assert.equal(built.file.includes('"result"'), false, "no stale verdict survives the second import");

  api.outcome.value = "victory";
  api.applyImportedResult(undefined);
  assert.equal(api.outcome.value, "unset", "an import also overrides a prior user choice");
});

test("valid composition + outcome passes validation", () => {
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  // playerCount 1 derives the classic (solo) variant; only outcome is user-set.
  api.outcome.value = "victory";

  assert(api.isValid.value, "valid draft should pass validation");
  assert.equal(
    api.validationErrors.value.length,
    0,
    "valid draft should have no validation errors",
  );

  const built = api.buildLagnFile();
  assert(built, "buildLagnFile should succeed for valid draft");
  const result = validate(JSON.parse(built.file));
  assert(result.valid, "parsed LAGN should pass @legendary-arena/lagn validator");
});

test("missing mastermindId fails validation", () => {
  const draft = ref(createIncompleteDraft());
  const api = useLoadoutLagnExport(draft);

  assert(!api.isValid.value, "incomplete draft (missing schemeId) should fail validation");
  assert(
    api.validationErrors.value.length > 0,
    "incomplete draft should have validation errors",
  );
});

test("empty villainGroupIds fails validation", () => {
  const draft = ref(createValidDraft());
  draft.value.composition.villainGroupIds = [];
  const api = useLoadoutLagnExport(draft);

  assert(
    !api.isValid.value,
    "draft with empty villainGroupIds should fail validation",
  );
  assert(
    api.validationErrors.value.length > 0,
    "draft with empty villainGroupIds should have validation errors",
  );
});

test("exported file includes $schema URI", () => {
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  const built = api.buildLagnFile();
  assert(built, "buildLagnFile should return file");

  const parsed = JSON.parse(built.file);
  assert.equal(
    parsed.$schema,
    "https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json",
    "$schema must be the canonical hardcoded URL",
  );
});

test("filename format: game-{id}.lagn.json", () => {
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  const filename = api.exportFilename();
  assert.match(
    filename,
    /^game-[0-9a-f-]{36}\.lagn\.json$/i,
    "filename should match pattern game-{uuid}.lagn.json",
  );
});

test("exportToJsonBlob returns valid Blob with correct MIME type", () => {
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  const blob = api.exportToJsonBlob();
  assert.equal(blob.type, "application/json", "Blob should have application/json MIME type");
  assert(blob.size > 0, "Blob should not be empty");
});

test("variant/outcome changes trigger re-validation", () => {
  const draft = ref(createValidDraft());
  const api = useLoadoutLagnExport(draft);

  // Start valid (classic/solo + 1 player)
  assert(api.isValid.value, "should start valid");

  // why: setting 2 seats derives the cooperative variant on its own (no separate
  // control), and the export stays valid.
  draft.value.playerCount = 2;
  assert(api.isValid.value, "consistent cooperative + 2-player export should stay valid");

  // Changing outcome should not invalidate
  api.outcome.value = "loss";
  assert(api.isValid.value, "changing outcome should not invalidate");

  // Making draft invalid should invalidate
  draft.value.composition.mastermindId = "";
  assert(!api.isValid.value, "emptying mastermindId should invalidate");
});

test("variant is derived read-only from the draft player count", () => {
  // A 2-seat draft — a fresh viewer default, or a multiplayer match opened via
  // `?lagn=` — exports as Custom/cooperative with no separate control to set.
  // This is the fixed "stuck on solo" trap: the variant now tracks the seat count.
  const draft = ref(createValidDraft());
  draft.value.playerCount = 2;
  const api = useLoadoutLagnExport(draft);
  assert.equal(
    api.variant.value,
    "custom",
    "a 2-seat draft should derive the Custom (cooperative) variant",
  );
  assert.equal(
    api.variantLabel.value,
    "Cooperative (2–5 players)",
    "the read-only label should describe the derived cooperative variant",
  );
  assert(
    api.isValid.value,
    "a 2-seat draft should export without any manual variant selection",
  );

  // why: dropping back to a single seat re-derives the variant as Classic
  // (→ "solo") so the export stays consistent with the new seat count.
  draft.value.playerCount = 1;
  assert.equal(
    api.variant.value,
    "classic",
    "returning to 1 seat should re-derive the variant as Classic (solo)",
  );
  assert.equal(
    api.variantLabel.value,
    "Solo (1 player)",
    "the read-only label should describe the derived solo variant",
  );
  assert(
    api.isValid.value,
    "a 1-seat draft should stay valid after the variant re-derives",
  );
});

test("derived variant and player count are always consistent", () => {
  // Solo + 1 player.
  const soloDraft = ref(createValidDraft());
  const soloApi = useLoadoutLagnExport(soloDraft);
  assert.equal(soloApi.variant.value, "classic", "1 seat derives Classic (solo)");
  assert(soloApi.isValid.value, "solo + 1 player should be a valid export");

  // Cooperative + 2 players — the variant derives from the seat count, not a control.
  const coopDraft = ref(createValidDraft());
  coopDraft.value.playerCount = 2;
  const coopApi = useLoadoutLagnExport(coopDraft);
  assert.equal(coopApi.variant.value, "custom", "2 seats derive Custom (cooperative)");
  assert(coopApi.isValid.value, "cooperative + 2 players should be a valid export");
});
