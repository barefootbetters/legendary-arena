import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildAttractBoardList,
  buildChallengeUrl,
  buildFixedCountTabs,
  buildGauntletDetails,
  buildPlayerCountTabs,
  buildCoverageMatrix,
  buildRowChallengeUrl,
  findRoutedCountTab,
  findSetDetails,
  formatAverageScore,
  formatApprovedLoadout,
  formatCardDisplayName,
  formatHeroPool,
  formatRoster,
  groupGauntletsBySet,
  isFixedBoardName,
  listApprovedLoadouts,
  pinShowcaseGauntlet,
  resolveBoardIndexEntry,
  rosterForEntry,
  selectApprovedLoadout,
  selectLegApprovedLoadout,
} from "./gauntletDisplay.ts";
import type {
  GauntletEntryCounts,
  GauntletIndexEntry,
  SetDetails,
} from "../snapshots/snapshotClient.ts";

/**
 * Pure display-helper tests (WP-343 AC-3 / AC-7 and the grouping half
 * of AC-4). Component rendering is covered by vue-tsc + the dev-server
 * smoke per the EC-373 test-posture reconciliation.
 */

describe("formatAverageScore", () => {
  it("zero renders as E (even with PAR, the golf convention)", () => {
    assert.equal(formatAverageScore(0), "E");
  });

  it("negative centis render signed one-decimal (under PAR)", () => {
    assert.equal(formatAverageScore(-350), "-3.5");
  });

  it("positive centis gain an explicit plus sign (over PAR)", () => {
    assert.equal(formatAverageScore(125), "+1.3");
  });

  it("sub-decimal magnitudes round to one decimal", () => {
    assert.equal(formatAverageScore(-6), "-0.1");
    assert.equal(formatAverageScore(4), "+0.0");
  });
});

function indexEntry(
  setAbbr: string,
  mastermindSlug: string,
  entryCount: number,
): GauntletIndexEntry {
  return {
    setAbbr,
    setName: `${setAbbr.toUpperCase()} Set`,
    mastermindSlug,
    mastermindName: mastermindSlug,
    legCount: 4,
    entryCount,
    board: `gauntlet-${setAbbr}-${mastermindSlug}`,
  };
}

describe("groupGauntletsBySet", () => {
  it("groups consecutive entries by set, preserving artifact order", () => {
    const groups = groupGauntletsBySet([
      indexEntry("core", "dr-doom", 1),
      indexEntry("core", "loki", 0),
      indexEntry("dkpr", "high-evolutionary", 0),
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.setAbbr, "core");
    assert.equal(groups[0]?.gauntlets.length, 2);
    assert.equal(groups[1]?.setAbbr, "dkpr");
    assert.equal(groups[1]?.gauntlets.length, 1);
  });

  it("an empty index yields no groups", () => {
    assert.deepEqual(groupGauntletsBySet([]), []);
  });
});

describe("pinShowcaseGauntlet (WP-441)", () => {
  it("moves magneto first within an already-leading core group", () => {
    const groups = groupGauntletsBySet([
      indexEntry("core", "dr-doom", 1),
      indexEntry("core", "magneto", 0),
      indexEntry("dkpr", "high-evolutionary", 0),
    ]);
    const pinned = pinShowcaseGauntlet(groups);
    assert.equal(pinned[0]?.setAbbr, "core");
    assert.equal(pinned[0]?.gauntlets[0]?.mastermindSlug, "magneto");
    assert.equal(pinned[0]?.gauntlets[1]?.mastermindSlug, "dr-doom");
    assert.equal(pinned[1]?.setAbbr, "dkpr");
  });

  it("moves a non-leading core/magneto group to the front", () => {
    const groups = groupGauntletsBySet([
      indexEntry("dkpr", "high-evolutionary", 0),
      indexEntry("core", "dr-doom", 1),
      indexEntry("core", "magneto", 0),
    ]);
    const pinned = pinShowcaseGauntlet(groups);
    assert.equal(pinned[0]?.setAbbr, "core");
    assert.equal(pinned[0]?.gauntlets[0]?.mastermindSlug, "magneto");
    assert.equal(pinned[1]?.setAbbr, "dkpr");
  });

  it("returns a fresh copy unchanged when core/magneto is absent", () => {
    const groups = groupGauntletsBySet([
      indexEntry("core", "dr-doom", 1),
      indexEntry("dkpr", "high-evolutionary", 0),
    ]);
    const pinned = pinShowcaseGauntlet(groups);
    assert.deepEqual(pinned, groups);
    // why: unchanged in content, but a NEW array (the caller always gets a
    // fresh value, never the input reference).
    assert.notEqual(pinned, groups);
  });

  it("does not mutate the input groups or their gauntlet arrays", () => {
    const groups = groupGauntletsBySet([
      indexEntry("dkpr", "high-evolutionary", 0),
      indexEntry("core", "dr-doom", 1),
      indexEntry("core", "magneto", 0),
    ]);
    const snapshotBefore = groups.map((group) => ({
      setAbbr: group.setAbbr,
      slugs: group.gauntlets.map((gauntlet) => gauntlet.mastermindSlug),
    }));
    pinShowcaseGauntlet(groups);
    const snapshotAfter = groups.map((group) => ({
      setAbbr: group.setAbbr,
      slugs: group.gauntlets.map((gauntlet) => gauntlet.mastermindSlug),
    }));
    assert.deepEqual(snapshotAfter, snapshotBefore);
  });
});

describe("buildAttractBoardList", () => {
  it("without a gauntlet index the cycle list is unchanged", () => {
    assert.deepEqual(buildAttractBoardList(["global-top"], false), [
      "global-top",
    ]);
  });

  it("with a gauntlet index the cycle gains exactly one extra slide", () => {
    assert.deepEqual(buildAttractBoardList(["global-top"], true), [
      "global-top",
      "gauntlet-index",
    ]);
  });

  it("never adds per-gauntlet boards to the cycle", () => {
    const cycle = buildAttractBoardList(["global-top"], true);
    const gauntletBoardSlides = cycle.filter(
      (name) => name.startsWith("gauntlet-") && name !== "gauntlet-index",
    );
    assert.deepEqual(gauntletBoardSlides, []);
  });
});

/**
 * Fresh-shape index entry (WP-344 fields present) for the player-count
 * helpers. `entryCounts` and `legs` default to a solo-only claimed shape.
 */
function freshIndexEntry(
  overrides: Partial<GauntletIndexEntry> = {},
): GauntletIndexEntry {
  return {
    setAbbr: "core",
    setName: "Core Set",
    mastermindSlug: "dr-doom",
    mastermindName: "Dr. Doom",
    legCount: 4,
    entryCount: 3,
    board: "gauntlet-core-dr-doom",
    entryCounts: { "1": 3, "2": 0, "3": 0, "4": 0, "5": 0 },
    legs: [{ schemeSlug: "midtown-bank-robbery", schemeName: "Midtown Bank Robbery" }],
    ...overrides,
  };
}

describe("buildPlayerCountTabs (WP AC-1)", () => {
  it("links the claimed counts and leaves the empty counts unlinked", () => {
    const entryCounts: GauntletEntryCounts = {
      "1": 3,
      "2": 1,
      "3": 0,
      "4": 0,
      "5": 0,
    };
    const tabs = buildPlayerCountTabs(freshIndexEntry({ entryCounts }));

    assert.equal(tabs.length, 5);
    // Solo — linked, bare board name.
    assert.equal(tabs[0]?.playerCount, 1);
    assert.equal(tabs[0]?.boardName, "gauntlet-core-dr-doom");
    assert.equal(tabs[0]?.isClaimed, true);
    // p2 — linked, `-p2` board name.
    assert.equal(tabs[1]?.playerCount, 2);
    assert.equal(tabs[1]?.boardName, "gauntlet-core-dr-doom-p2");
    assert.equal(tabs[1]?.isClaimed, true);
    // p3-p5 — unclaimed, still carry the `-p<N>` board name for the tab label.
    for (const tab of tabs.slice(2)) {
      assert.equal(tab.isClaimed, false);
      assert.equal(tab.boardName, `gauntlet-core-dr-doom-p${tab.playerCount}`);
    }
  });

  it("degrades to a solo-only tab when `entryCounts` is absent", () => {
    const oldShape: GauntletIndexEntry = {
      setAbbr: "core",
      setName: "Core Set",
      mastermindSlug: "loki",
      mastermindName: "Loki",
      legCount: 4,
      entryCount: 2,
      board: "gauntlet-core-loki",
    };
    const tabs = buildPlayerCountTabs(oldShape);
    assert.equal(tabs.length, 1);
    assert.equal(tabs[0]?.playerCount, 1);
    assert.equal(tabs[0]?.boardName, "gauntlet-core-loki");
    assert.equal(tabs[0]?.isClaimed, true);
  });
});

describe("formatRoster / rosterForEntry (WP AC-2)", () => {
  it("joins a multi-player roster with ' + '", () => {
    assert.equal(formatRoster(["alice", "bob"]), "alice + bob");
  });

  it("renders a solo roster as the single handle", () => {
    assert.equal(formatRoster(["solo"]), "solo");
  });

  it("shapes an entry's roster from its `players` field", () => {
    assert.equal(
      rosterForEntry({ handle: "alice", players: ["alice", "bob"] }),
      "alice + bob",
    );
  });

  it("falls back to `handle` when `players` is absent (old snapshot)", () => {
    assert.equal(rosterForEntry({ handle: "carol" }), "carol");
  });
});

describe("buildChallengeUrl (WP AC-3)", () => {
  it("pins the two-key URL with `/` encoded as %2F", () => {
    assert.equal(
      buildChallengeUrl("core", "midtown-bank-robbery", "dr-doom"),
      "https://cards.legendary-arena.com/?schemeId=core%2Fmidtown-bank-robbery&mastermindId=core%2Fdr-doom",
    );
  });

  it("WP-387: appends &playerCount when a count is supplied", () => {
    assert.equal(
      buildChallengeUrl("core", "midtown-bank-robbery", "dr-doom", 4),
      "https://cards.legendary-arena.com/?schemeId=core%2Fmidtown-bank-robbery&mastermindId=core%2Fdr-doom&playerCount=4",
    );
  });

  it("WP-387: omitting the count is byte-identical to the pre-WP-387 two-key URL", () => {
    // why: the drift guard — the optional param must not perturb the existing
    // link when a caller (e.g. the index CTA) has no routed count.
    assert.equal(
      buildChallengeUrl("core", "midtown-bank-robbery", "dr-doom"),
      buildChallengeUrl("core", "midtown-bank-robbery", "dr-doom", undefined),
    );
    assert.equal(
      buildChallengeUrl("core", "midtown-bank-robbery", "dr-doom"),
      "https://cards.legendary-arena.com/?schemeId=core%2Fmidtown-bank-robbery&mastermindId=core%2Fdr-doom",
    );
  });
});

describe("resolveBoardIndexEntry (WP AC-4)", () => {
  const gauntlets: readonly GauntletIndexEntry[] = [
    freshIndexEntry(),
    freshIndexEntry({
      mastermindSlug: "loki",
      mastermindName: "Loki",
      board: "gauntlet-core-loki",
    }),
  ];

  it("strips a `-p<N>` suffix to the parent gauntlet entry", () => {
    const resolved = resolveBoardIndexEntry(
      "gauntlet-core-dr-doom-p2",
      gauntlets,
    );
    assert.equal(resolved?.board, "gauntlet-core-dr-doom");
  });

  it("resolves a bare board name directly", () => {
    const resolved = resolveBoardIndexEntry("gauntlet-core-loki", gauntlets);
    assert.equal(resolved?.board, "gauntlet-core-loki");
  });

  it("returns null for an unknown board", () => {
    assert.equal(resolveBoardIndexEntry("gauntlet-core-thanos", gauntlets), null);
    assert.equal(
      resolveBoardIndexEntry("gauntlet-core-thanos-p3", gauntlets),
      null,
    );
  });

  it("strips `-fixed` (solo) to the parent gauntlet entry (WP-385)", () => {
    const resolved = resolveBoardIndexEntry(
      "gauntlet-core-dr-doom-fixed",
      gauntlets,
    );
    assert.equal(resolved?.board, "gauntlet-core-dr-doom");
  });

  it("strips `-p<N>` THEN `-fixed` for a fixed per-count board (WP-385)", () => {
    const resolved = resolveBoardIndexEntry(
      "gauntlet-core-dr-doom-fixed-p2",
      gauntlets,
    );
    assert.equal(resolved?.board, "gauntlet-core-dr-doom");
  });

  it("returns null for an unknown fixed board", () => {
    assert.equal(
      resolveBoardIndexEntry("gauntlet-core-thanos-fixed-p3", gauntlets),
      null,
    );
  });
});

// ---------------------------------------------------------------------------
// WP-385 — fixed-hero-pool division helpers (D-24187)
// ---------------------------------------------------------------------------

describe("isFixedBoardName (WP-385)", () => {
  it("recognizes the fixed grammar with and without a count suffix", () => {
    assert.equal(isFixedBoardName("gauntlet-core-dr-doom-fixed"), true);
    assert.equal(isFixedBoardName("gauntlet-core-dr-doom-fixed-p3"), true);
  });

  it("rejects open-division names", () => {
    assert.equal(isFixedBoardName("gauntlet-core-dr-doom"), false);
    assert.equal(isFixedBoardName("gauntlet-core-dr-doom-p2"), false);
  });
});

describe("buildFixedCountTabs (WP-385 AC-1)", () => {
  it("links claimed fixed counts with the `-fixed[-p<N>]` grammar", () => {
    const tabs = buildFixedCountTabs(
      freshIndexEntry({
        fixedEntryCounts: { "1": 1, "2": 0, "3": 0, "4": 0, "5": 0 },
      }),
    );
    assert.equal(tabs.length, 5);
    assert.equal(tabs[0]?.boardName, "gauntlet-core-dr-doom-fixed");
    assert.equal(tabs[0]?.isClaimed, true);
    assert.equal(tabs[1]?.boardName, "gauntlet-core-dr-doom-fixed-p2");
    assert.equal(tabs[1]?.isClaimed, false);
  });

  it("returns an EMPTY array when `fixedEntryCounts` is absent (old-snapshot degrade)", () => {
    assert.deepEqual(buildFixedCountTabs(freshIndexEntry()), []);
  });
});

describe("findRoutedCountTab (WP-385 — the unclaimed-guard extension)", () => {
  const entry = freshIndexEntry({
    fixedEntryCounts: { "1": 1, "2": 0, "3": 0, "4": 0, "5": 0 },
  });

  it("finds an open-division tab by board name", () => {
    const tab = findRoutedCountTab(entry, "gauntlet-core-dr-doom-p2");
    assert.equal(tab?.playerCount, 2);
  });

  it("finds a fixed-division tab by board name, including unclaimed counts", () => {
    const claimedTab = findRoutedCountTab(entry, "gauntlet-core-dr-doom-fixed");
    assert.equal(claimedTab?.isClaimed, true);
    const unclaimedTab = findRoutedCountTab(
      entry,
      "gauntlet-core-dr-doom-fixed-p3",
    );
    assert.equal(unclaimedTab?.playerCount, 3);
    assert.equal(unclaimedTab?.isClaimed, false);
  });

  it("returns null for a name in neither division", () => {
    assert.equal(findRoutedCountTab(entry, "gauntlet-core-loki"), null);
  });
});

describe("formatHeroPool (WP-385 AC-3)", () => {
  it("strips the set prefix and joins with ' · ' (pinned string)", () => {
    assert.equal(
      formatHeroPool([
        "core/black-widow",
        "core/iron-man",
        "msp1/spider-man",
      ]),
      "black-widow · iron-man · spider-man",
    );
  });

  it("returns an empty string for a missing or empty pool (never throws)", () => {
    assert.equal(formatHeroPool(undefined), "");
    assert.equal(formatHeroPool([]), "");
  });
});

describe("formatCardDisplayName (sort-order article restoration)", () => {
  it("restores ', The' to natural order", () => {
    // why: pinned against the real corpus — these are 3 of the 25 sort-form
    // names the 2026-07-18 sweep found across data/cards/*.json.
    assert.equal(formatCardDisplayName("Legacy Virus, The"), "The Legacy Virus");
    assert.equal(
      formatCardDisplayName("Dark Phoenix Saga, The"),
      "The Dark Phoenix Saga",
    );
    assert.equal(formatCardDisplayName("Hood, The"), "The Hood");
  });

  it("restores ', A' and ', An' without mis-splitting one for the other", () => {
    assert.equal(formatCardDisplayName("Ancient Evil, An"), "An Ancient Evil");
    assert.equal(formatCardDisplayName("New Beginning, A"), "A New Beginning");
  });

  it("leaves names without a trailing article untouched", () => {
    assert.equal(formatCardDisplayName("The Legacy Virus"), "The Legacy Virus");
    assert.equal(formatCardDisplayName("Midtown Bank Robbery"), "Midtown Bank Robbery");
    assert.equal(formatCardDisplayName("Hail Hydra"), "Hail Hydra");
  });

  it("does not fire on a comma that is not a trailing article", () => {
    assert.equal(
      formatCardDisplayName("Daimonic, The White Light"),
      "Daimonic, The White Light",
    );
    assert.equal(
      formatCardDisplayName("Leo Fitz and Jemma Simmons"),
      "Leo Fitz and Jemma Simmons",
    );
  });

  it("leaves a degenerate article-only value alone rather than emitting a bare article", () => {
    assert.equal(formatCardDisplayName(", The"), ", The");
    assert.equal(formatCardDisplayName(""), "");
  });
});

// ---------------------------------------------------------------------------
// Canonical loadout discoverability (WP-395 / D-24199)
// ---------------------------------------------------------------------------

const APPROVED_ENTRY = {
  approvedLoadouts: {
    "1": [
      {
        villainGroupIds: ["core/brotherhood"],
        henchmanGroupIds: ["core/doombot-legion"],
      },
      {
        villainGroupIds: ["core/hydra"],
        henchmanGroupIds: ["core/hand-ninjas"],
      },
    ],
    "5": [
      {
        villainGroupIds: ["core/brotherhood", "core/skrulls"],
        henchmanGroupIds: ["core/sentinel"],
      },
    ],
  },
};

describe("canonical loadout discoverability (WP-395)", () => {
  it("buildChallengeUrl pins the approved villain and henchmen groups", () => {
    const url = buildChallengeUrl("core", "scheme-a", "mm-one", 1, {
      villainGroupIds: ["core/brotherhood"],
      henchmanGroupIds: ["core/doombot-legion"],
    });
    const params = new URL(url).searchParams;
    assert.strictEqual(params.get("villainGroupIds"), "core/brotherhood");
    assert.strictEqual(params.get("henchmanGroupIds"), "core/doombot-legion");
    assert.strictEqual(params.get("playerCount"), "1");
  });

  it("buildChallengeUrl without a loadout omits both group keys", () => {
    // why: the pre-WP-395 URL must be reproducible byte-for-byte, so a casual
    // or pre-WP-395 snapshot link is unchanged.
    const url = buildChallengeUrl("core", "scheme-a", "mm-one", 1);
    const params = new URL(url).searchParams;
    assert.strictEqual(params.get("villainGroupIds"), null);
    assert.strictEqual(params.get("henchmanGroupIds"), null);
  });

  it("buildChallengeUrl joins multiple groups with commas", () => {
    const url = buildChallengeUrl("core", "scheme-a", "mm-one", 5, {
      villainGroupIds: ["core/brotherhood", "core/skrulls"],
      henchmanGroupIds: ["core/sentinel"],
    });
    assert.strictEqual(
      new URL(url).searchParams.get("villainGroupIds"),
      "core/brotherhood,core/skrulls",
    );
  });

  it("selectApprovedLoadout picks the routed count, defaults to solo, and misses cleanly", () => {
    assert.deepEqual(selectApprovedLoadout(APPROVED_ENTRY, 5), {
      villainGroupIds: ["core/brotherhood", "core/skrulls"],
      henchmanGroupIds: ["core/sentinel"],
    });
    // No routed count → the solo configuration (the index CTA case).
    assert.deepEqual(selectApprovedLoadout(APPROVED_ENTRY), {
      villainGroupIds: ["core/brotherhood"],
      henchmanGroupIds: ["core/doombot-legion"],
    });
    // A count with no published configuration, and a pre-WP-395 entry.
    assert.strictEqual(selectApprovedLoadout(APPROVED_ENTRY, 3), undefined);
    assert.strictEqual(selectApprovedLoadout({}, 1), undefined);
  });

  it("listApprovedLoadouts returns every configuration for the count", () => {
    assert.strictEqual(listApprovedLoadouts(APPROVED_ENTRY, 1).length, 2);
    assert.strictEqual(listApprovedLoadouts(APPROVED_ENTRY, 3).length, 0);
    assert.strictEqual(listApprovedLoadouts({}, 1).length, 0);
  });

  it("formatApprovedLoadout drops set prefixes and reads as card names", () => {
    assert.strictEqual(
      formatApprovedLoadout({
        villainGroupIds: ["core/brotherhood", "core/enemies-of-asgard"],
        henchmanGroupIds: ["co2e/doombot-legion"],
      }),
      "brotherhood, enemies of asgard + doombot legion",
    );
  });
});

describe("buildGauntletDetails (WP-474 per-scheme)", () => {
  // why: WP-474 — each leg carries its OWN per-scheme approved loadout, so the
  // reveal pairs each scheme with its own villains/henchmen. Legacy-Virus fights
  // Enemies of Asgard; Midtown fights Hydra — different adversaries per scheme.
  const magnetoEntry = {
    legs: [
      {
        schemeSlug: "legacy-virus-the",
        schemeName: "Legacy Virus, The",
        approvedLoadouts: {
          "2": [
            {
              villainGroupIds: ["core/brotherhood", "core/enemies-of-asgard"],
              henchmanGroupIds: ["core/doombot-legion"],
            },
          ],
        },
      },
      {
        schemeSlug: "midtown-bank-robbery",
        schemeName: "Midtown Bank Robbery",
        approvedLoadouts: {
          "2": [
            {
              villainGroupIds: ["core/brotherhood", "core/hydra"],
              henchmanGroupIds: ["core/hand-ninjas"],
            },
          ],
        },
      },
    ],
  };

  it("lists the scheme names from the legs", () => {
    const details = buildGauntletDetails(magnetoEntry, [1, 2, 3, 4, 5]);
    assert.deepEqual(details.schemes, [
      "Legacy Virus, The",
      "Midtown Bank Robbery",
    ]);
  });

  it("pairs each scheme with its OWN per-scheme config, title-cased and separated", () => {
    const details = buildGauntletDetails(magnetoEntry, [2]);
    assert.equal(details.loadoutsByCount.length, 1);
    const twoPlayer = details.loadoutsByCount[0];
    assert.equal(twoPlayer.playerCount, 2);
    // one config PER LEG (per scheme), each tagged with its scheme name.
    assert.deepEqual(twoPlayer.configs[0], {
      schemeName: "Legacy Virus, The",
      villains: ["Brotherhood", "Enemies Of Asgard"],
      henchmen: ["Doombot Legion"],
    });
    assert.deepEqual(twoPlayer.configs[1], {
      schemeName: "Midtown Bank Robbery",
      villains: ["Brotherhood", "Hydra"],
      henchmen: ["Hand Ninjas"],
    });
  });

  it("falls back to the per-mastermind entry-level config on a pre-WP-472 snapshot", () => {
    // why: legs carry no per-leg loadout (old snapshot) → each scheme resolves to
    // the entry-level per-mastermind config (variant 0), so the reveal still renders.
    const oldSnapshotEntry = {
      legs: [
        { schemeSlug: "scheme-a", schemeName: "Scheme A" },
        { schemeSlug: "scheme-b", schemeName: "Scheme B" },
      ],
      approvedLoadouts: {
        "2": [
          {
            villainGroupIds: ["core/brotherhood"],
            henchmanGroupIds: ["core/doombot-legion"],
          },
        ],
      },
    };
    const details = buildGauntletDetails(oldSnapshotEntry, [2]);
    assert.deepEqual(details.loadoutsByCount[0].configs, [
      { schemeName: "Scheme A", villains: ["Brotherhood"], henchmen: ["Doombot Legion"] },
      { schemeName: "Scheme B", villains: ["Brotherhood"], henchmen: ["Doombot Legion"] },
    ]);
  });

  it("returns empty configs for a count with no published loadout (no throw)", () => {
    const details = buildGauntletDetails(magnetoEntry, [1, 3]);
    assert.deepEqual(details.loadoutsByCount, [
      { playerCount: 1, configs: [] },
      { playerCount: 3, configs: [] },
    ]);
  });

  it("returns empty configs for every count when no loadout is published", () => {
    const details = buildGauntletDetails(
      {
        legs: [
          { schemeSlug: "legacy-virus-the", schemeName: "Legacy Virus, The" },
          { schemeSlug: "midtown-bank-robbery", schemeName: "Midtown Bank Robbery" },
        ],
      },
      [1, 2],
    );
    assert.deepEqual(details.loadoutsByCount, [
      { playerCount: 1, configs: [] },
      { playerCount: 2, configs: [] },
    ]);
  });

  it("returns empty schemes when the entry has no legs", () => {
    const details = buildGauntletDetails({}, [2]);
    assert.deepEqual(details.schemes, []);
  });
});

describe("buildRowChallengeUrl", () => {
  const magnetoEntry = {
    setAbbr: "core",
    mastermindSlug: "magneto",
    legs: [{ schemeSlug: "legacy-virus-the", schemeName: "Legacy Virus, The" }],
    approvedLoadouts: {
      "1": [
        {
          villainGroupIds: ["core/brotherhood"],
          henchmanGroupIds: ["core/doombot-legion"],
        },
      ],
      "2": [
        {
          villainGroupIds: ["core/brotherhood", "core/enemies-of-asgard"],
          henchmanGroupIds: ["core/doombot-legion"],
        },
        {
          villainGroupIds: ["core/brotherhood", "core/hydra"],
          henchmanGroupIds: ["core/hand-ninjas"],
        },
      ],
    },
  };

  it("at 2 players carries playerCount=2 and the 2-player approved villains", () => {
    const url = new URL(buildRowChallengeUrl(magnetoEntry, 2) ?? "");
    assert.equal(url.searchParams.get("playerCount"), "2");
    // The first approved 2p variant — two villains, NOT the solo single-villain set.
    assert.equal(
      url.searchParams.get("villainGroupIds"),
      "core/brotherhood,core/enemies-of-asgard",
    );
    assert.equal(url.searchParams.get("henchmanGroupIds"), "core/doombot-legion");
  });

  it("at 1 player carries the solo villains and playerCount=1", () => {
    const url = new URL(buildRowChallengeUrl(magnetoEntry, 1) ?? "");
    assert.equal(url.searchParams.get("playerCount"), "1");
    assert.equal(url.searchParams.get("villainGroupIds"), "core/brotherhood");
  });

  it("returns null when the entry has no legs", () => {
    const noLegs = {
      setAbbr: "core",
      mastermindSlug: "magneto",
      approvedLoadouts: magnetoEntry.approvedLoadouts,
    };
    assert.equal(buildRowChallengeUrl(noLegs, 2), null);
  });

  it("degrades gracefully when the count has no approved loadout", () => {
    // Player count 3 has no published loadout: the link still carries scheme,
    // mastermind, and count — just no villain/henchmen params.
    const url = new URL(buildRowChallengeUrl(magnetoEntry, 3) ?? "");
    assert.equal(url.searchParams.get("playerCount"), "3");
    assert.equal(url.searchParams.has("villainGroupIds"), false);
    assert.equal(url.searchParams.has("henchmanGroupIds"), false);
  });
});

describe("findSetDetails (WP-462)", () => {
  const CORE_DETAILS: SetDetails = {
    setAbbr: "core",
    setName: "Core Set",
    masterminds: [{ slug: "magneto", name: "Magneto" }],
    schemes: [{ slug: "scheme-a", name: "Scheme A" }],
    villains: [
      { slug: "brotherhood", name: "The Brotherhood", usedByGauntlets: true },
      { slug: "radiation", name: "Radiation", usedByGauntlets: false },
    ],
    henchmen: [
      { slug: "doombot-legion", name: "Doombot Legion", usedByGauntlets: true },
    ],
  };
  const CO2E_DETAILS: SetDetails = {
    setAbbr: "co2e",
    setName: "Core 2E",
    masterminds: [],
    schemes: [],
    villains: [],
    henchmen: [],
  };

  it("returns the matching set's details", () => {
    const found = findSetDetails([CORE_DETAILS, CO2E_DETAILS], "co2e");
    assert.equal(found, CO2E_DETAILS);
  });

  it("returns undefined for a set not in the roster", () => {
    assert.equal(findSetDetails([CORE_DETAILS], "xmen"), undefined);
  });

  it("returns undefined when sets is absent (pre-WP-461 snapshot)", () => {
    assert.equal(findSetDetails(undefined, "core"), undefined);
  });
});

describe("buildCoverageMatrix (WP-464)", () => {
  // why: Magneto approves brotherhood (1p+) then adds enemies-of-asgard (2p+),
  // henchman doombot-legion; it has NO "3" count key (undefined-loadout path).
  const MAGNETO: GauntletIndexEntry = {
    setAbbr: "core",
    setName: "Core Set",
    mastermindSlug: "magneto",
    mastermindName: "Magneto",
    legCount: 2,
    entryCount: 0,
    board: "gauntlet-core-magneto",
    legs: [
      { schemeSlug: "scheme-a", schemeName: "Scheme A" },
      { schemeSlug: "scheme-b", schemeName: "Scheme B" },
    ],
    approvedLoadouts: {
      "1": [
        {
          villainGroupIds: ["core/brotherhood"],
          henchmanGroupIds: ["core/doombot-legion"],
        },
      ],
      "2": [
        {
          villainGroupIds: ["core/brotherhood", "core/enemies-of-asgard"],
          henchmanGroupIds: ["core/doombot-legion"],
        },
      ],
    },
  };
  const DR_DOOM: GauntletIndexEntry = {
    setAbbr: "core",
    setName: "Core Set",
    mastermindSlug: "dr-doom",
    mastermindName: "Dr. Doom",
    legCount: 2,
    entryCount: 0,
    board: "gauntlet-core-dr-doom",
    legs: [
      { schemeSlug: "scheme-a", schemeName: "Scheme A" },
      { schemeSlug: "scheme-b", schemeName: "Scheme B" },
    ],
    approvedLoadouts: {
      "2": [
        {
          villainGroupIds: ["core/masters-of-evil"],
          henchmanGroupIds: ["core/doombot-legion"],
        },
      ],
    },
  };
  const CORE_DETAILS: SetDetails = {
    setAbbr: "core",
    setName: "Core Set",
    masterminds: [
      { slug: "magneto", name: "Magneto" },
      { slug: "dr-doom", name: "Dr. Doom" },
    ],
    schemes: [
      { slug: "scheme-a", name: "Scheme A" },
      { slug: "scheme-b", name: "Scheme B" },
    ],
    villains: [
      { slug: "brotherhood", name: "The Brotherhood", usedByGauntlets: true },
      { slug: "enemies-of-asgard", name: "Enemies of Asgard", usedByGauntlets: true },
      { slug: "masters-of-evil", name: "Masters of Evil", usedByGauntlets: true },
      { slug: "radiation", name: "Radiation", usedByGauntlets: false },
    ],
    henchmen: [
      { slug: "doombot-legion", name: "Doombot Legion", usedByGauntlets: true },
      { slug: "sentinel", name: "Sentinel", usedByGauntlets: false },
    ],
  };

  it("orders columns villains-then-henchmen with kinds", () => {
    const matrix = buildCoverageMatrix([MAGNETO], CORE_DETAILS, 2);
    assert.deepStrictEqual(
      matrix.columns.map((column) => `${column.kind}:${column.slug}`),
      [
        "villain:brotherhood",
        "villain:enemies-of-asgard",
        "villain:masters-of-evil",
        "villain:radiation",
        "henchman:doombot-legion",
        "henchman:sentinel",
      ],
    );
  });

  it("emits one row per mastermind × scheme, mastermind-major", () => {
    const matrix = buildCoverageMatrix([MAGNETO, DR_DOOM], CORE_DETAILS, 2);
    assert.strictEqual(matrix.rows.length, 4);
    assert.deepStrictEqual(
      matrix.rows.map((row) => `${row.mastermindSlug}/${row.schemeSlug}`),
      [
        "magneto/scheme-a",
        "magneto/scheme-b",
        "dr-doom/scheme-a",
        "dr-doom/scheme-b",
      ],
    );
  });

  it("marks a covered cell with a challenge link and an uncovered cell with none", () => {
    const matrix = buildCoverageMatrix([MAGNETO], CORE_DETAILS, 2);
    const row = matrix.rows[0]; // magneto / scheme-a
    assert.ok(row);
    // brotherhood (col 0) covered → link; masters-of-evil (col 2) not → null.
    assert.strictEqual(row.cells[0]?.covered, true);
    assert.ok(row.cells[0]?.challengeUrl?.startsWith("https://cards.legendary-arena.com/"));
    assert.strictEqual(row.cells[2]?.covered, false);
    assert.strictEqual(row.cells[2]?.challengeUrl, null);
    // doombot-legion (col 4, henchman) covered.
    assert.strictEqual(row.cells[4]?.covered, true);
  });

  it("is count-sensitive (enemies-of-asgard covered at 2p, not 1p)", () => {
    const at1p = buildCoverageMatrix([MAGNETO], CORE_DETAILS, 1).rows[0];
    const at2p = buildCoverageMatrix([MAGNETO], CORE_DETAILS, 2).rows[0];
    // column 1 = enemies-of-asgard
    assert.strictEqual(at1p?.cells[1]?.covered, false);
    assert.strictEqual(at2p?.cells[1]?.covered, true);
  });

  it("a count with no published config leaves every cell uncovered, no throw", () => {
    // Magneto has no "3" key → selectApprovedLoadout undefined at 3p.
    const matrix = buildCoverageMatrix([MAGNETO], CORE_DETAILS, 3);
    assert.strictEqual(matrix.rows.length, 2);
    for (const row of matrix.rows) {
      assert.ok(row.cells.every((cell) => cell.covered === false));
      assert.ok(row.cells.every((cell) => cell.challengeUrl === null));
    }
  });

  it("empty entries yield no rows but keep columns; no throw", () => {
    const matrix = buildCoverageMatrix([], CORE_DETAILS, 2);
    assert.strictEqual(matrix.rows.length, 0);
    assert.strictEqual(matrix.columns.length, 6);
  });
});

// ---------------------------------------------------------------------------
// WP-474 / D-24283 — per-scheme approved loadouts (client consumers)
// ---------------------------------------------------------------------------

describe("selectLegApprovedLoadout (WP-474)", () => {
  const LEG_WITH_OWN = {
    approvedLoadouts: {
      "2": [
        {
          villainGroupIds: ["core/skrulls"],
          henchmanGroupIds: ["core/hand-ninjas"],
        },
      ],
    },
  };
  const ENTRY_FALLBACK = {
    approvedLoadouts: {
      "2": [
        {
          villainGroupIds: ["core/brotherhood"],
          henchmanGroupIds: ["core/doombot-legion"],
        },
      ],
    },
  };

  it("prefers the leg's own per-scheme config", () => {
    assert.deepEqual(selectLegApprovedLoadout(LEG_WITH_OWN, ENTRY_FALLBACK, 2), {
      villainGroupIds: ["core/skrulls"],
      henchmanGroupIds: ["core/hand-ninjas"],
    });
  });

  it("falls back to the entry-level config when the leg carries none (old snapshot)", () => {
    assert.deepEqual(selectLegApprovedLoadout({}, ENTRY_FALLBACK, 2), {
      villainGroupIds: ["core/brotherhood"],
      henchmanGroupIds: ["core/doombot-legion"],
    });
  });

  it("returns undefined when neither the leg nor the entry has a config", () => {
    assert.strictEqual(selectLegApprovedLoadout({}, {}, 2), undefined);
  });
});

describe("buildCoverageMatrix per-scheme (WP-474)", () => {
  const CORE_DETAILS: SetDetails = {
    setAbbr: "core",
    setName: "Core Set",
    masterminds: [{ slug: "dr-doom", name: "Dr. Doom" }],
    schemes: [
      { slug: "scheme-a", name: "Scheme A" },
      { slug: "scheme-b", name: "Scheme B" },
    ],
    villains: [
      { slug: "brotherhood", name: "The Brotherhood", usedByGauntlets: true },
      { slug: "enemies-of-asgard", name: "Enemies of Asgard", usedByGauntlets: true },
      { slug: "masters-of-evil", name: "Masters of Evil", usedByGauntlets: true },
    ],
    henchmen: [
      { slug: "doombot-legion", name: "Doombot Legion", usedByGauntlets: true },
    ],
  };
  // why: scheme-a swaps in masters-of-evil; scheme-b keeps brotherhood — the two
  // legs carry DIFFERENT per-leg loadouts. The entry-level field (enemies-of-asgard)
  // must be IGNORED because every leg carries its own (proves leg-level wins).
  const DOOM_PERSCHEME: GauntletIndexEntry = {
    setAbbr: "core",
    setName: "Core Set",
    mastermindSlug: "dr-doom",
    mastermindName: "Dr. Doom",
    legCount: 2,
    entryCount: 0,
    board: "gauntlet-core-dr-doom",
    legs: [
      {
        schemeSlug: "scheme-a",
        schemeName: "Scheme A",
        approvedLoadouts: {
          "2": [
            {
              villainGroupIds: ["core/masters-of-evil"],
              henchmanGroupIds: ["core/doombot-legion"],
            },
          ],
        },
      },
      {
        schemeSlug: "scheme-b",
        schemeName: "Scheme B",
        approvedLoadouts: {
          "2": [
            {
              villainGroupIds: ["core/brotherhood"],
              henchmanGroupIds: ["core/doombot-legion"],
            },
          ],
        },
      },
    ],
    approvedLoadouts: {
      "2": [
        {
          villainGroupIds: ["core/enemies-of-asgard"],
          henchmanGroupIds: ["core/doombot-legion"],
        },
      ],
    },
  };

  it("shows DIFFERENT coverage per scheme (the point of the variety)", () => {
    const matrix = buildCoverageMatrix([DOOM_PERSCHEME], CORE_DETAILS, 2);
    // columns: 0 brotherhood, 1 enemies-of-asgard, 2 masters-of-evil, 3 doombot(henchman)
    const schemeA = matrix.rows.find((row) => row.schemeSlug === "scheme-a");
    const schemeB = matrix.rows.find((row) => row.schemeSlug === "scheme-b");
    assert.ok(schemeA && schemeB);
    // scheme-a marks masters-of-evil (col 2), NOT brotherhood (col 0).
    assert.strictEqual(schemeA.cells[2]?.covered, true);
    assert.strictEqual(schemeA.cells[0]?.covered, false);
    // scheme-b marks brotherhood (col 0), NOT masters-of-evil (col 2).
    assert.strictEqual(schemeB.cells[0]?.covered, true);
    assert.strictEqual(schemeB.cells[2]?.covered, false);
    // the entry-level fallback (enemies-of-asgard, col 1) is IGNORED for both.
    assert.strictEqual(schemeA.cells[1]?.covered, false);
    assert.strictEqual(schemeB.cells[1]?.covered, false);
  });

  it("buildRowChallengeUrl pins the FIRST LEG's own per-scheme villains", () => {
    const url = new URL(buildRowChallengeUrl(DOOM_PERSCHEME, 2) ?? "");
    assert.strictEqual(
      url.searchParams.get("villainGroupIds"),
      "core/masters-of-evil",
    );
    assert.strictEqual(url.searchParams.get("schemeId"), "core/scheme-a");
  });
});
