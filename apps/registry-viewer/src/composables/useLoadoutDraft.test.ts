/**
 * useLoadoutDraft.test.ts — node:test coverage for the loadout-draft
 * composable's theme-prefill ext_id resolution (D-24018 follow-up).
 *
 * `prefillFromTheme` must convert the BARE entity slugs stored in theme
 * setupIntent (e.g. "magneto", "brotherhood") into the set-qualified ext_ids
 * ("{setAbbr}/{slug}") the engine's match-setup validator requires (D-10014).
 * Copying bare slugs verbatim — the pre-D-24018 behavior — produced loadouts
 * the engine rejected with an HTTP 500 at match creation. These tests pin:
 *   - all five composition fields resolve to qualified ext_ids and validate
 *   - cardType disambiguation (the same slug maps to different ext_ids per
 *     type — "magneto" is a hero in one set and a mastermind in another)
 *   - matching reads the ENTITY slug from extId, not FlatCard.slug
 *   - unresolved slugs are kept verbatim so the live error list flags them
 *   - reprint ambiguity prefers the core set, else stays unresolved
 *   - already-qualified slugs pass through untouched
 *
 * Runner: node:test (native Node.js)
 * Invoke: pnpm --filter registry-viewer test
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import type { ThemeDefinition } from "../lib/themeClient.js";

import { useLoadoutDraft } from "./useLoadoutDraft.js";

// why: a minimal stand-in for the real CardRegistry (FlatCard[]). The
// composable reads `extId` (validation), `cardType` (prefill resolution), and
// `alwaysLeads` (mastermind Always-Leads auto-include) off each card, so the
// fixture carries just those fields (alwaysLeads optional, masterminds only).
type RegistryCardFixture = {
  extId: string;
  cardType: string;
  alwaysLeads?: readonly string[];
};
function makeRegistry(cards: Array<RegistryCardFixture>): {
  listCards: () => Array<RegistryCardFixture>;
  listSets: () => Array<{ abbr: string }>;
  getSet: (abbr: string) => unknown;
} {
  // why: D-24091 — the validator checks each field against its own entity
  // id-space. Non-henchman ids select by `cardType` from listCards; henchman
  // groups are NOT flat cards, so a henchman-typed fixture is surfaced via
  // getSet().henchmen (its slug), never listCards — mirroring the real
  // registry (flattenSet emits no henchmen).
  const henchmenByAbbr = new Map<string, Array<{ slug: string }>>();
  const abbrs = new Set<string>();
  for (const card of cards) {
    const slashIndex = card.extId.indexOf("/");
    if (slashIndex <= 0) {
      continue;
    }
    const abbr = card.extId.slice(0, slashIndex);
    abbrs.add(abbr);
    if (card.cardType === "henchman") {
      const slug = card.extId.slice(slashIndex + 1);
      const list = henchmenByAbbr.get(abbr) ?? [];
      list.push({ slug });
      henchmenByAbbr.set(abbr, list);
    }
  }
  return {
    listCards: () => cards,
    listSets: () => [...abbrs].map((abbr) => ({ abbr })),
    getSet: (abbr: string) => ({ abbr, henchmen: henchmenByAbbr.get(abbr) ?? [] }),
  };
}

/** Builds a full theme setupIntent with sensible defaults the tests override. */
function makeSetupIntent(
  overrides: Partial<ThemeDefinition["setupIntent"]>,
): ThemeDefinition["setupIntent"] {
  return {
    mastermindId: "magneto",
    schemeId: "midtown-bank-robbery",
    villainGroupIds: ["brotherhood"],
    henchmanGroupIds: ["sentinel"],
    heroDeckIds: ["spider-man"],
    bystanderSetIds: [],
    woundSetIds: [],
    sidekickCardIds: [],
    officerCardIds: [],
    ...overrides,
  };
}

/** Wraps a setupIntent in an otherwise-complete v2 ThemeDefinition fixture. */
function makeTheme(
  setupIntent: ThemeDefinition["setupIntent"],
): ThemeDefinition {
  return {
    themeSchemaVersion: 2,
    themeId: "test-theme",
    name: "Test Theme",
    description: "A theme fixture for prefill resolution tests.",
    setupIntent,
    playerCount: { recommended: [2], min: 2, max: 4 },
    tags: [],
    tips: [],
  };
}

// A registry covering the slugs the tests reference, including two deliberate
// collisions: "magneto" exists as a core mastermind AND a Villains-set hero
// (different ext_ids), and "storm" is reprinted as a hero in both core and
// xmen.
const FULL_REGISTRY = makeRegistry([
  { extId: "core/midtown-bank-robbery", cardType: "scheme" },
  { extId: "core/magneto", cardType: "mastermind" },
  { extId: "core/loki", cardType: "mastermind" },
  { extId: "core/brotherhood", cardType: "villain" },
  { extId: "core/hydra", cardType: "villain" },
  { extId: "core/sentinel", cardType: "henchman" },
  { extId: "core/spider-man", cardType: "hero" },
  { extId: "core/wolverine", cardType: "hero" },
  { extId: "core/storm", cardType: "hero" },
  { extId: "xmen/storm", cardType: "hero" },
  { extId: "vill/magneto", cardType: "hero" },
]);

describe("useLoadoutDraft prefillFromTheme — ext_id resolution (D-24018)", () => {
  it("resolves every bare composition slug to its set-qualified ext_id and validates", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.prefillFromTheme(
      makeTheme(
        makeSetupIntent({
          schemeId: "midtown-bank-robbery",
          mastermindId: "loki",
          villainGroupIds: ["brotherhood", "hydra"],
          henchmanGroupIds: ["sentinel"],
          heroDeckIds: ["spider-man", "wolverine"],
        }),
      ),
    );

    const composition = api.draft.value.composition;
    assert.equal(composition.schemeId, "core/midtown-bank-robbery");
    assert.equal(composition.mastermindId, "core/loki");
    assert.deepEqual(composition.villainGroupIds, ["core/brotherhood", "core/hydra"]);
    assert.deepEqual(composition.henchmanGroupIds, ["core/sentinel"]);
    assert.deepEqual(composition.heroDeckIds, ["core/spider-man", "core/wolverine"]);
    assert.equal(api.draft.value.themeId, "test-theme");
    assert.equal(
      api.isValid.value,
      true,
      `Expected a fully-resolved theme prefill to validate; errors: ${JSON.stringify(api.errors.value)}`,
    );
  });

  it("disambiguates the same slug by cardType — mastermind 'magneto' → core/magneto", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.prefillFromTheme(makeTheme(makeSetupIntent({ mastermindId: "magneto" })));
    // why: "magneto" exists as both a core mastermind and a Villains-set hero;
    // the mastermind field must resolve to the mastermind ext_id, not the hero.
    assert.equal(api.draft.value.composition.mastermindId, "core/magneto");
  });

  it("disambiguates the same slug by cardType — hero 'magneto' → vill/magneto", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.prefillFromTheme(makeTheme(makeSetupIntent({ heroDeckIds: ["magneto"] })));
    // why: the hero field must resolve to the hero ext_id even though a
    // mastermind named "magneto" exists in a different set.
    assert.deepEqual(api.draft.value.composition.heroDeckIds, ["vill/magneto"]);
  });

  it("matches the ENTITY slug carried in extId, not the per-card FlatCard.slug", () => {
    // why: hero "wolverine" has extId "core/wolverine" but its FlatCard.slug is
    // an individual card slug (e.g. "keen-senses"). A FlatCard.slug match would
    // miss it; resolution must read the slug portion of extId.
    const registry = makeRegistry([
      { extId: "core/wolverine", cardType: "hero" },
      { extId: "core/midtown-bank-robbery", cardType: "scheme" },
      { extId: "core/magneto", cardType: "mastermind" },
      { extId: "core/brotherhood", cardType: "villain" },
      { extId: "core/sentinel", cardType: "henchman" },
    ]);
    const api = useLoadoutDraft(registry);
    api.prefillFromTheme(makeTheme(makeSetupIntent({ heroDeckIds: ["wolverine"] })));
    assert.deepEqual(api.draft.value.composition.heroDeckIds, ["core/wolverine"]);
  });

  it("keeps an unresolvable slug verbatim so the validator flags it", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.prefillFromTheme(
      makeTheme(makeSetupIntent({ mastermindId: "no-such-mastermind" })),
    );
    // why: a slug matching no card of its type is kept bare — the existing
    // validation error list surfaces an actionable error instead of the fix
    // silently dropping the field or the engine throwing an HTTP 500.
    assert.equal(api.draft.value.composition.mastermindId, "no-such-mastermind");
    assert.equal(api.isValid.value, false);
    const mastermindError = api.errors.value.find(
      (entry) => entry.field === "composition.mastermindId",
    );
    assert.ok(
      mastermindError,
      "Expected a validation error on composition.mastermindId for the unresolved bare slug.",
    );
  });

  it("prefers the core set when a reprinted slug is ambiguous across sets", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.prefillFromTheme(makeTheme(makeSetupIntent({ heroDeckIds: ["storm"] })));
    // why: "storm" is a hero in both core and xmen; prefer core/storm.
    assert.deepEqual(api.draft.value.composition.heroDeckIds, ["core/storm"]);
  });

  it("resolves a reprint deterministically (lexicographically-first) when no core candidate exists", () => {
    const registry = makeRegistry([
      { extId: "bbb/ambiguous", cardType: "villain" },
      { extId: "aaa/ambiguous", cardType: "villain" },
    ]);
    const api = useLoadoutDraft(registry);
    api.prefillFromTheme(makeTheme(makeSetupIntent({ villainGroupIds: ["ambiguous"] })));
    // why: every "{set}/ambiguous" printing is a villain ext_id the engine
    // accepts; resolution picks the lexicographically-first ("aaa/ambiguous")
    // deterministically rather than 500-ing the match. Registry order is
    // intentionally reversed here to prove the sort, not iteration order,
    // decides.
    assert.deepEqual(api.draft.value.composition.villainGroupIds, ["aaa/ambiguous"]);
  });

  it("keeps a slug bare only when NO card of that type carries it", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.prefillFromTheme(
      makeTheme(makeSetupIntent({ villainGroupIds: ["does-not-exist"] })),
    );
    // why: zero candidates is the only null path — the bare slug stays so the
    // validator surfaces a genuine theme/card data gap.
    assert.deepEqual(api.draft.value.composition.villainGroupIds, ["does-not-exist"]);
    assert.equal(api.isValid.value, false);
  });

  it("passes an already-qualified slug through untouched", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.prefillFromTheme(
      makeTheme(makeSetupIntent({ schemeId: "core/midtown-bank-robbery" })),
    );
    assert.equal(api.draft.value.composition.schemeId, "core/midtown-bank-robbery");
  });
});

describe("useLoadoutDraft — player-count setup requirements (WP-372 / D-24165)", () => {
  it("requiredPlayerCountSetup returns the row for the draft's player count", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setPlayerCount(3);
    assert.equal(api.requiredPlayerCountSetup.value?.villainGroupCount, 3);
    assert.equal(api.requiredPlayerCountSetup.value?.heroCount, 5);
    api.setPlayerCount(5);
    assert.equal(api.requiredPlayerCountSetup.value?.heroCount, 6);
    assert.equal(api.requiredPlayerCountSetup.value?.villainDeckBystanderCount, 12);
  });

  it("requiredPlayerCountSetup is undefined for an out-of-range player count", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setPlayerCount(9);
    assert.equal(api.requiredPlayerCountSetup.value, undefined);
  });

  it("flags composition-count mismatches on a fresh draft and clears them when matched", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setPlayerCount(1); // 1 villain / 1 henchman / 3 heroes
    // a fresh draft has an empty composition → every count is short
    assert.ok(
      api.playerCountCompositionMismatches.value.length > 0,
      "an empty composition must mismatch the player count",
    );

    api.prefillFromTheme(
      makeTheme(
        makeSetupIntent({
          villainGroupIds: ["brotherhood"],
          henchmanGroupIds: ["sentinel"],
          heroDeckIds: ["spider-man", "wolverine", "storm"],
        }),
      ),
    );

    assert.deepEqual(api.playerCountCompositionMismatches.value, []);
  });

  it("reports required and actual counts and is reactive to the player count", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.prefillFromTheme(
      makeTheme(
        makeSetupIntent({
          villainGroupIds: ["brotherhood"],
          henchmanGroupIds: ["sentinel"],
          heroDeckIds: ["spider-man", "wolverine", "storm"],
        }),
      ),
    );
    api.setPlayerCount(1);
    assert.deepEqual(api.playerCountCompositionMismatches.value, []); // matches 1 player

    api.setPlayerCount(2); // needs 2 villain / 1 henchman / 5 heroes
    // why: annotate the row shape structurally — the composable's public
    // ComputedRef type resolves correctly in the .vue consumer, but this .ts
    // test's view of it narrows to never[] under the viewer's bundler module
    // resolution; the annotation restores the field types without changing the
    // (correct) runtime values.
    const mismatches: ReadonlyArray<{ field: string; required: number; actual: number }> =
      api.playerCountCompositionMismatches.value;
    const villain = mismatches.find((mismatch) => mismatch.field === "villainGroupIds");
    const hero = mismatches.find((mismatch) => mismatch.field === "heroDeckIds");
    const henchman = mismatches.find((mismatch) => mismatch.field === "henchmanGroupIds");
    assert.equal(villain?.required, 2);
    assert.equal(villain?.actual, 1);
    assert.equal(hero?.required, 5);
    assert.equal(hero?.actual, 3);
    assert.equal(henchman, undefined, "one henchman still satisfies 2 players");
  });
});

describe("useLoadoutDraft — composed readiness", () => {
  it("counts player-count mismatches even when the document schema is valid", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setPlayerCount(2); // needs 2 villain / 1 henchman / 5 heroes
    api.prefillFromTheme(
      makeTheme(
        makeSetupIntent({
          villainGroupIds: ["brotherhood", "hydra"],
          henchmanGroupIds: ["sentinel"],
          heroDeckIds: ["spider-man", "wolverine"],
        }),
      ),
    );

    // the document itself is schema-valid — every ext_id resolves and no array
    // is empty — so `errors` alone would report a ready loadout
    assert.deepEqual(api.errors.value, []);
    assert.equal(api.isValid.value, true);

    // …but 2 heroes cannot seat a 2-player match, so readiness must reject it
    assert.equal(api.playerCountCompositionMismatches.value.length, 1);
    assert.equal(api.readinessIssueCount.value, 1);
    assert.equal(api.isReady.value, false);
  });

  it("counts a missing Always-Leads villain group toward readiness", () => {
    const api = useLoadoutDraft(ALWAYS_LEADS_REGISTRY);
    api.setMastermind("core/magneto"); // auto-includes core/brotherhood
    api.removeVillainGroup("core/brotherhood");

    assert.deepEqual(api.missingRequiredVillainGroupIds.value, ["core/brotherhood"]);
    assert.ok(
      api.readinessIssueCount.value > api.errors.value.length,
      "the missing Always-Leads group must raise the readiness count above the schema-error count",
    );
    assert.equal(api.isReady.value, false);
  });

  it("is ready only when every validity dimension is clear", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setPlayerCount(1); // needs 1 villain / 1 henchman / 3 heroes
    api.prefillFromTheme(
      makeTheme(
        makeSetupIntent({
          villainGroupIds: ["brotherhood"],
          henchmanGroupIds: ["sentinel"],
          heroDeckIds: ["spider-man", "wolverine", "storm"],
        }),
      ),
    );

    assert.equal(api.readinessIssueCount.value, 0);
    assert.equal(api.isReady.value, true);
  });
});

// A registry whose core/magneto mastermind carries an Always-Leads clause
// (Magneto Always Leads the Brotherhood), plus a cross-set case: an
// xmen/magneto mastermind that also leads "brotherhood", with a same-set
// xmen/brotherhood villain present so the resolver prefers the mastermind's
// own set printing over the core reprint.
const ALWAYS_LEADS_REGISTRY = makeRegistry([
  { extId: "core/magneto", cardType: "mastermind", alwaysLeads: ["brotherhood"] },
  { extId: "core/loki", cardType: "mastermind" },
  { extId: "core/brotherhood", cardType: "villain" },
  { extId: "core/hydra", cardType: "villain" },
  { extId: "xmen/magneto", cardType: "mastermind", alwaysLeads: ["brotherhood"] },
  { extId: "xmen/brotherhood", cardType: "villain" },
]);

describe("useLoadoutDraft setMastermind — Always-Leads villain groups", () => {
  it("auto-includes the led villain group when a mastermind that Always Leads is selected", () => {
    const api = useLoadoutDraft(ALWAYS_LEADS_REGISTRY);
    assert.deepEqual(api.draft.value.composition.villainGroupIds, []);
    api.setMastermind("core/magneto");
    assert.deepEqual(api.draft.value.composition.villainGroupIds, ["core/brotherhood"]);
    assert.deepEqual(api.requiredVillainGroupIds.value, ["core/brotherhood"]);
    assert.deepEqual(api.missingRequiredVillainGroupIds.value, []);
  });

  it("does not duplicate the led group when the mastermind is re-selected", () => {
    const api = useLoadoutDraft(ALWAYS_LEADS_REGISTRY);
    api.setMastermind("core/magneto");
    api.setMastermind("core/magneto");
    assert.deepEqual(api.draft.value.composition.villainGroupIds, ["core/brotherhood"]);
  });

  it("flags the led group as missing when the user removes the required chip", () => {
    const api = useLoadoutDraft(ALWAYS_LEADS_REGISTRY);
    api.setMastermind("core/magneto");
    api.removeVillainGroup("core/brotherhood");
    assert.deepEqual(api.draft.value.composition.villainGroupIds, []);
    assert.deepEqual(api.missingRequiredVillainGroupIds.value, ["core/brotherhood"]);
  });

  it("requires nothing for a mastermind with no Always-Leads clause", () => {
    const api = useLoadoutDraft(ALWAYS_LEADS_REGISTRY);
    api.setMastermind("core/loki");
    assert.deepEqual(api.draft.value.composition.villainGroupIds, []);
    assert.deepEqual(api.requiredVillainGroupIds.value, []);
    assert.deepEqual(api.missingRequiredVillainGroupIds.value, []);
  });

  it("prefers the mastermind's own set printing of the led group over a core reprint", () => {
    const api = useLoadoutDraft(ALWAYS_LEADS_REGISTRY);
    api.setMastermind("xmen/magneto");
    assert.deepEqual(api.draft.value.composition.villainGroupIds, ["xmen/brotherhood"]);
    assert.deepEqual(api.requiredVillainGroupIds.value, ["xmen/brotherhood"]);
  });

  it("keeps villain groups the user added alongside the auto-included led group", () => {
    const api = useLoadoutDraft(ALWAYS_LEADS_REGISTRY);
    api.addVillainGroup("core/hydra");
    api.setMastermind("core/magneto");
    assert.deepEqual(api.draft.value.composition.villainGroupIds, [
      "core/hydra",
      "core/brotherhood",
    ]);
  });

  it("requires nothing when no mastermind is selected", () => {
    const api = useLoadoutDraft(ALWAYS_LEADS_REGISTRY);
    assert.deepEqual(api.requiredVillainGroupIds.value, []);
    assert.deepEqual(api.missingRequiredVillainGroupIds.value, []);
  });
});

// ── Support pools (EC-425 / D-24194) ────────────────────────────────────────

describe("useLoadoutDraft setSupportPool", () => {
  it("setting a pool derives the paired composition count", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setSupportPool("sidekicks", {
      mode: "explicit",
      cards: [
        { extId: "core/sidekick-a", copies: 4 },
        { extId: "core/sidekick-b", copies: 6 },
      ],
    });
    assert.equal(api.draft.value.composition.sidekicksCount, 10);
    assert.equal(api.draft.value.supportPools?.sidekicks?.mode, "explicit");
  });

  it("clearing a pool drops the key and leaves the count alone", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setSupportPool("wounds", {
      mode: "explicit",
      cards: [{ extId: "core/wound", copies: 12 }],
    });
    assert.equal(api.draft.value.composition.woundsCount, 12);

    api.setSupportPool("wounds", undefined);
    // why: absence is the default (D-24194) — "counts alone". Resetting the
    // number here would silently discard a deliberate pile size.
    assert.equal(api.draft.value.composition.woundsCount, 12);
    // why: an empty `supportPools: {}` reads as "configured and empty" rather
    // than "never configured"; the key must disappear entirely.
    assert.equal(api.draft.value.supportPools, undefined);
  });

  it("clearing one pool of two keeps the other", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setSupportPool("wounds", { mode: "explicit", cards: [{ extId: "core/wound", copies: 3 }] });
    api.setSupportPool("bystanders", {
      mode: "explicit",
      cards: [{ extId: "core/bystander", copies: 5 }],
    });
    api.setSupportPool("wounds", undefined);
    assert.equal(api.draft.value.supportPools?.wounds, undefined);
    assert.equal(api.draft.value.supportPools?.bystanders?.cards[0]?.copies, 5);
  });

  it("supportPools survives JSON export", async () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setSupportPool("officers", {
      mode: "sets",
      sets: ["core"],
      cards: [{ extId: "core/officer", copies: 7 }],
    });
    const text = await api.exportToJsonBlob().text();
    const parsed = JSON.parse(text) as Record<string, unknown>;
    // why: buildSerializedDocument passes a replacer ARRAY to JSON.stringify,
    // which is a WHITELIST — any key missing from it is dropped from the file
    // entirely. Without this assertion a future field lands in the draft, shows
    // in the UI, and silently vanishes from the download.
    const pools = parsed["supportPools"] as Record<string, { mode: string; sets: string[]; cards: Array<{ extId: string; copies: number }> }>;
    assert.equal(pools?.officers?.mode, "sets");
    assert.deepEqual(pools?.officers?.sets, ["core"]);
    assert.deepEqual(pools?.officers?.cards, [{ extId: "core/officer", copies: 7 }]);
    assert.equal((parsed["composition"] as Record<string, number>)["officersCount"], 7);
  });
});

// ── Support Presets (EC-428 / D-24200) ──────────────────────────────────────

describe("useLoadoutDraft applySupportPreset + resetDraft", () => {
  it("applies counts and pools totally, replacing what was there", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setSupportPool("sidekicks", {
      mode: "explicit",
      cards: [{ extId: "core/old-sidekick", copies: 4 }],
    });
    api.applySupportPreset({
      counts: {
        bystandersCount: 30,
        woundsCount: 30,
        officersCount: 30,
        sidekicksCount: 2,
      },
      supportPools: {
        sidekicks: { mode: "explicit", cards: [{ extId: "cvwr/zabu", copies: 2 }] },
      },
    });
    // why: TOTAL, never merged — the old pool must be gone, not combined.
    assert.deepEqual(api.draft.value.supportPools?.sidekicks?.cards, [
      { extId: "cvwr/zabu", copies: 2 },
    ]);
    assert.equal(api.draft.value.composition.sidekicksCount, 2);
    assert.equal(api.draft.value.composition.bystandersCount, 30);
  });

  it("a preset with no pools clears existing ones", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setSupportPool("wounds", {
      mode: "explicit",
      cards: [{ extId: "core/wound", copies: 30 }],
    });
    api.applySupportPreset({
      counts: {
        bystandersCount: 30,
        woundsCount: 30,
        officersCount: 30,
        sidekicksCount: 0,
      },
    });
    // why: a leftover pool surviving a preset apply would silently change the
    // harness — the exact drift a preset exists to prevent.
    assert.equal(api.draft.value.supportPools, undefined);
  });

  it("resetDraft defaults to a TOTAL reset", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setSupportPool("wounds", {
      mode: "explicit",
      cards: [{ extId: "core/wound", copies: 42 }],
    });
    api.resetDraft();
    // why: the ?lagn= import path calls resetDraft as the first half of an
    // atomic apply. If it preserved pools, a previous draft's supply piles
    // would leak into an imported game record.
    assert.equal(api.draft.value.supportPools, undefined);
    assert.equal(api.draft.value.composition.woundsCount, 30);
  });

  it("resetDraft({ preserveSupport: true }) keeps pools and counts but clears picks", () => {
    const api = useLoadoutDraft(FULL_REGISTRY);
    api.setScheme("core/midtown-bank-robbery");
    api.setSupportPool("wounds", {
      mode: "explicit",
      cards: [{ extId: "core/wound", copies: 42 }],
    });
    api.resetDraft({ preserveSupport: true });
    assert.equal(api.draft.value.composition.schemeId, "");
    assert.equal(api.draft.value.composition.woundsCount, 42);
    assert.deepEqual(api.draft.value.supportPools?.wounds?.cards, [
      { extId: "core/wound", copies: 42 },
    ]);
  });
});
