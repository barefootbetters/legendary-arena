/**
 * Gauntlet display helpers — pure functions behind the WP-343 panels,
 * kept out of the Vue components so they are unit-testable under
 * node:test (the SPA has no component mount harness).
 */

import type {
  GauntletIndexApprovedLoadout,
  GauntletIndexApprovedLoadouts,
  GauntletIndexEntry,
  GauntletSnapshotEntry,
} from "../snapshots/snapshotClient";

/** One set's slice of the gauntlet index, for grouped rendering. */
export interface GauntletSetGroup {
  readonly setAbbr: string;
  readonly setName: string;
  readonly gauntlets: readonly GauntletIndexEntry[];
}

/** One player-count tab for a gauntlet's board view / index chips
 * (WP-345 / D-24134 §5). `boardName` is the bare gauntlet board for the solo
 * tab and `<board>-p<N>` for counts 2-5; `isClaimed` gates linking (an
 * unclaimed count has NO board file, so it must never be rendered as a link). */
export interface PlayerCountTab {
  readonly playerCount: number;
  readonly boardName: string;
  readonly entryCount: number;
  readonly isClaimed: boolean;
}

// why: the player-count dimension is fixed at 1-5 (D-24134 §2); iterating a
// named constant array keeps buildPlayerCountTabs a plain for...of loop
// rather than a C-style index loop.
const PLAYER_COUNTS = [1, 2, 3, 4, 5] as const;

/** The cards-site loadout-preview origin the challenge links target
 * (WP-114). `cards.legendary-arena.com` appears ONLY in `<a href>` values —
 * never a fetch target (the zero-API invariant, D-24134 §6). */
const CHALLENGE_PREVIEW_BASE_URL = "https://cards.legendary-arena.com/";

/**
 * Formats an integer centesimal PAR-relative average for display.
 *
 * @param averageScoreCentis The ×100 integer average from the snapshot.
 * @returns `E` for zero, else a signed one-decimal string
 *   (`+1.3`, `-3.5`).
 */
export function formatAverageScore(averageScoreCentis: number): string {
  // why: 'E' is the golf even-with-PAR convention the scoring model is
  // built on (VISION §20) — a bare '0.0' reads as "no score" rather
  // than "exactly at PAR".
  if (averageScoreCentis === 0) {
    return "E";
  }
  const oneDecimal = (averageScoreCentis / 100).toFixed(1);
  if (averageScoreCentis > 0) {
    return `+${oneDecimal}`;
  }
  return oneDecimal;
}

/**
 * Groups index entries by set, preserving the artifact's order (the
 * publisher emits setAbbr ASC, mastermind ASC — this function adds no
 * ordering of its own).
 *
 * @param gauntlets The index artifact's entries.
 * @returns Consecutive-set groups in artifact order.
 */
export function groupGauntletsBySet(
  gauntlets: readonly GauntletIndexEntry[],
): GauntletSetGroup[] {
  const groups: GauntletSetGroup[] = [];
  let currentGroup: {
    setAbbr: string;
    setName: string;
    gauntlets: GauntletIndexEntry[];
  } | null = null;

  for (const gauntlet of gauntlets) {
    if (currentGroup === null || currentGroup.setAbbr !== gauntlet.setAbbr) {
      currentGroup = {
        setAbbr: gauntlet.setAbbr,
        setName: gauntlet.setName,
        gauntlets: [],
      };
      groups.push(currentGroup);
    }
    currentGroup.gauntlets.push(gauntlet);
  }

  return groups;
}

/**
 * Composes the attract-cycle board list. When the manifest advertises a
 * gauntlet index, the cycle gains exactly ONE extra slide for it.
 *
 * @param boardNames The manifest's classic board names.
 * @param hasGauntletIndex Whether the manifest carries `gauntletIndex`.
 * @returns The board names the attract cycler should rotate through.
 */
export function buildAttractBoardList(
  boardNames: readonly string[],
  hasGauntletIndex: boolean,
): string[] {
  // why: exactly one slide, and never the per-gauntlet boards — 105
  // gauntlet boards in the rotation would starve the classic slides
  // (EC-373 §Locked Values; D-24131 §8a).
  if (hasGauntletIndex) {
    return [...boardNames, "gauntlet-index"];
  }
  return [...boardNames];
}

/**
 * Builds the player-count tabs (1-5) for a gauntlet's board view and the
 * index's per-count claim chips (WP-345 / D-24134 §5). The solo tab uses the
 * bare gauntlet board name; counts 2-5 use `<board>-p<N>`. A count links only
 * when it reports at least one complete entry.
 *
 * @param indexEntry The gauntlet's index row (its `entryCounts` drives claim
 *   state; a missing `entryCounts` — an old snapshot — degrades to a single
 *   solo tab keyed off the legacy `entryCount`).
 * @returns One tab per known player count, in ascending order.
 */
export function buildPlayerCountTabs(
  indexEntry: GauntletIndexEntry,
): PlayerCountTab[] {
  // why: a pre-WP-344 index entry has no `entryCounts` map — degrade to the
  // WP-343 shape (solo only, claim state from the legacy `entryCount`) so old
  // snapshots keep rendering rather than showing four dead unclaimed tabs.
  if (indexEntry.entryCounts === undefined) {
    return [
      {
        playerCount: 1,
        boardName: indexEntry.board,
        entryCount: indexEntry.entryCount,
        isClaimed: indexEntry.entryCount > 0,
      },
    ];
  }

  const tabs: PlayerCountTab[] = [];
  for (const playerCount of PLAYER_COUNTS) {
    const countKey = String(playerCount) as keyof typeof indexEntry.entryCounts;
    const entryCount = indexEntry.entryCounts[countKey];
    const boardName =
      playerCount === 1
        ? indexEntry.board
        : `${indexEntry.board}-p${playerCount}`;
    tabs.push({
      playerCount,
      boardName,
      entryCount,
      isClaimed: entryCount > 0,
    });
  }
  return tabs;
}

/**
 * Joins a team roster's display handles for presentation.
 *
 * @param players The handle-ASC roster (a one-element array on solo boards).
 * @returns The handles joined by `" + "` — e.g. `'alice + bob'`, `'solo'`.
 */
export function formatRoster(players: readonly string[]): string {
  return players.join(" + ");
}

/**
 * Resolves a gauntlet entry's roster for display, tolerating old snapshots.
 *
 * @param entry A gauntlet snapshot row (its `players` roster may be absent).
 * @returns The joined roster, or the entry's `handle` when `players` is absent.
 */
export function rosterForEntry(
  entry: Pick<GauntletSnapshotEntry, "handle" | "players">,
): string {
  // why: a pre-WP-344 snapshot predates `players`; falling back to the
  // entry's `handle` keeps old boards rendering (never a blank cell).
  const roster = entry.players ?? [entry.handle];
  return formatRoster(roster);
}

/**
 * Builds the challenge link for one gauntlet leg — the WP-114 loadout-preview
 * URL with the leg's scheme and the gauntlet's mastermind pinned, and
 * optionally the board's player count (WP-387).
 *
 * @param setAbbr The set both the scheme and mastermind belong to.
 * @param schemeSlug The leg's scheme slug.
 * @param mastermindSlug The gauntlet's mastermind slug.
 * @param playerCount Optional 1..5 player count for the count-keyed board the
 *   link came from; when provided, the builder pre-sizes its required-count
 *   slots to match. Omitted for the index CTA (no routed count → builder
 *   default). An absent value produces the byte-identical pre-WP-387 two-key
 *   URL.
 * @param approvedLoadout Optional approved villain + henchmen configuration
 *   for the routed player count (WP-395 / D-24199). When supplied, its groups
 *   are pinned into the URL so the builder opens on a QUALIFYING setup.
 * @returns A `cards.legendary-arena.com` URL with the two id keys (plus
 *   `playerCount` and the pinned groups when supplied).
 */
export function buildChallengeUrl(
  setAbbr: string,
  schemeSlug: string,
  mastermindSlug: string,
  playerCount?: number,
  approvedLoadout?: GauntletIndexApprovedLoadout,
): string {
  // why: the two id keys always ride the URL (D-24134 §6); WP-387 adds the
  // player count so the WP-372 required-count readout matches the board.
  // WP-395 / D-24199 additionally pins the villain and henchmen groups when
  // the caller has an approved configuration: a ranked leg now qualifies only
  // when those groups match, so a link that left them free would send the
  // player to build a run that cannot score. Heroes stay the player's choice
  // (they are not part of ScenarioKey). Omitting the loadout reproduces the
  // pre-WP-395 URL byte-for-byte, which is what casual links still want.
  // URLSearchParams encodes the `/` in the set-qualified ids to `%2F`.
  const params = new URLSearchParams();
  params.set("schemeId", `${setAbbr}/${schemeSlug}`);
  params.set("mastermindId", `${setAbbr}/${mastermindSlug}`);
  if (playerCount !== undefined) {
    params.set("playerCount", String(playerCount));
  }
  if (approvedLoadout !== undefined) {
    params.set("villainGroupIds", approvedLoadout.villainGroupIds.join(","));
    params.set("henchmanGroupIds", approvedLoadout.henchmanGroupIds.join(","));
  }
  return `${CHALLENGE_PREVIEW_BASE_URL}?${params.toString()}`;
}

/**
 * Picks the approved configuration a challenge link should pin (WP-395).
 *
 * why: the menu offers three configurations and the link can only carry one.
 * The first is chosen deterministically so the same board always produces the
 * same link; the board itself lists all three, so the player keeps the choice
 * the menu preserves.
 *
 * @param entry The gauntlet's index entry.
 * @param playerCount The routed player count, or undefined on the index CTA.
 * @returns The configuration to pin, or undefined when none is published.
 */
export function selectApprovedLoadout(
  entry: { approvedLoadouts?: GauntletIndexApprovedLoadouts },
  playerCount?: number,
): GauntletIndexApprovedLoadout | undefined {
  if (entry.approvedLoadouts === undefined) {
    return undefined;
  }
  // why: the index CTA has no routed count; solo is the board a first-time
  // challenger lands on, so it is the sensible default to pin.
  const countKey = String(playerCount ?? 1);
  const approvedForCount = entry.approvedLoadouts[countKey];
  if (approvedForCount === undefined || approvedForCount.length === 0) {
    return undefined;
  }
  return approvedForCount[0];
}

// why: a single end-anchored `-p<N>` suffix, N constrained to 2-5 — the solo
// board has no suffix and player counts never exceed 5 (D-24134 §2).
const BOARD_COUNT_SUFFIX_PATTERN = /-p[2-5]$/;

// why: the fixed-division segment precedes the count suffix in the board
// grammar (D-24187 §3: `<board>-fixed` / `<board>-fixed-p<N>`), so a name is
// tested for `-fixed` only AFTER the `-p<N>` suffix has been stripped.
const FIXED_DIVISION_SUFFIX = "-fixed";

/**
 * Strips a trailing `-p<N>` player-count suffix, or returns the name
 * unchanged when none is present.
 */
function stripCountSuffix(boardName: string): string {
  const suffixMatch = BOARD_COUNT_SUFFIX_PATTERN.exec(boardName);
  if (suffixMatch === null) {
    return boardName;
  }
  return boardName.slice(0, boardName.length - suffixMatch[0].length);
}

/**
 * Whether a routed board name addresses the fixed-hero-pool division
 * (WP-385 / D-24187 §3). The active division derives from the ROUTE — hash
 * routing already carries all navigation state, so no component holds a
 * division flag.
 *
 * @param boardName The routed board name.
 * @returns `true` for `<board>-fixed` and `<board>-fixed-p<N>` names.
 */
export function isFixedBoardName(boardName: string): boolean {
  // why: `-p[2-5]` strips FIRST because `-fixed` precedes the count suffix
  // in the grammar — testing the raw name would miss `<board>-fixed-p3`.
  return stripCountSuffix(boardName).endsWith(FIXED_DIVISION_SUFFIX);
}

/**
 * Resolves the index entry for a routed board name, stripping a trailing
 * `-p<N>` player-count suffix and then a trailing `-fixed` division
 * segment (in that order) when the bare lookup misses, so a per-count or
 * fixed-division board view can read its parent gauntlet's index data.
 *
 * @param boardName The routed board name (bare, `<board>-p<N>`,
 *   `<board>-fixed`, or `<board>-fixed-p<N>`).
 * @param gauntlets The gauntlet index rows to search.
 * @returns The matching index entry, or `null` for an unknown board.
 */
export function resolveBoardIndexEntry(
  boardName: string,
  gauntlets: readonly GauntletIndexEntry[],
): GauntletIndexEntry | null {
  for (const gauntlet of gauntlets) {
    if (gauntlet.board === boardName) {
      return gauntlet;
    }
  }

  // why: suffix-stripping fires ONLY after the direct lookup misses — a real
  // board name (including any mastermind slug) matches above and returns, so
  // the `-p<N>` rule can never shadow a mastermind whose slug ends in `-p2`.
  const countStrippedName = stripCountSuffix(boardName);
  if (countStrippedName !== boardName) {
    for (const gauntlet of gauntlets) {
      if (gauntlet.board === countStrippedName) {
        return gauntlet;
      }
    }
  }

  // why: `-fixed` strips AFTER `-p[2-5]` (the D-24187 §3 grammar order:
  // `<board>-fixed-p<N>`), and again only because every prior lookup missed.
  if (countStrippedName.endsWith(FIXED_DIVISION_SUFFIX)) {
    const parentBoardName = countStrippedName.slice(
      0,
      countStrippedName.length - FIXED_DIVISION_SUFFIX.length,
    );
    for (const gauntlet of gauntlets) {
      if (gauntlet.board === parentBoardName) {
        return gauntlet;
      }
    }
  }
  return null;
}

/**
 * Builds the player-count tabs for a gauntlet's FIXED-hero-pool division
 * (WP-385 / D-24187 §3/§6): board names follow the `<board>-fixed[-p<N>]`
 * grammar and claim state comes from `fixedEntryCounts`.
 *
 * @param indexEntry The gauntlet's index row.
 * @returns One tab per player count — or an EMPTY array when the entry has
 *   no `fixedEntryCounts` (a pre-WP-384 snapshot), which suppresses the
 *   division toggle entirely so old snapshots render exactly as WP-345.
 */
export function buildFixedCountTabs(
  indexEntry: GauntletIndexEntry,
): PlayerCountTab[] {
  // why: no `fixedEntryCounts` means the artifact predates WP-384 — there is
  // no fixed division to offer, so the empty array (not five unclaimed tabs)
  // keeps old snapshots byte-identical to the WP-345 rendering.
  if (indexEntry.fixedEntryCounts === undefined) {
    return [];
  }

  const tabs: PlayerCountTab[] = [];
  for (const playerCount of PLAYER_COUNTS) {
    const countKey = String(
      playerCount,
    ) as keyof typeof indexEntry.fixedEntryCounts;
    const entryCount = indexEntry.fixedEntryCounts[countKey];
    const boardName =
      playerCount === 1
        ? `${indexEntry.board}${FIXED_DIVISION_SUFFIX}`
        : `${indexEntry.board}${FIXED_DIVISION_SUFFIX}-p${playerCount}`;
    tabs.push({
      playerCount,
      boardName,
      entryCount,
      isClaimed: entryCount > 0,
    });
  }
  return tabs;
}

/**
 * Finds the tab a routed board name addresses, searching the open
 * division's tabs and then the fixed division's (WP-385). The App-level
 * unclaimed-count guard uses this so an unclaimed `-fixed[-p<N>]` deep
 * link renders the open-championship state instead of fetching a file
 * that does not exist.
 *
 * @param indexEntry The routed gauntlet's index row.
 * @param boardName The routed board name.
 * @returns The matching tab from either division, or `null`.
 */
export function findRoutedCountTab(
  indexEntry: GauntletIndexEntry,
  boardName: string,
): PlayerCountTab | null {
  for (const tab of buildPlayerCountTabs(indexEntry)) {
    if (tab.boardName === boardName) {
      return tab;
    }
  }
  for (const tab of buildFixedCountTabs(indexEntry)) {
    if (tab.boardName === boardName) {
      return tab;
    }
  }
  return null;
}

/**
 * Formats a fixed-division entry's hero pool for display (WP-385 /
 * D-24187 §6).
 *
 * @param heroPool The entry's set-qualified hero ids (published order,
 *   sorted ASC).
 * @returns The ids' slug parts joined by `" · "` — e.g.
 *   `'black-widow · iron-man · spider-man'`; an empty string for a
 *   missing or empty pool (old snapshots — never a crash).
 */
export function formatHeroPool(
  heroPool: readonly string[] | undefined,
): string {
  if (heroPool === undefined || heroPool.length === 0) {
    return "";
  }
  const displayParts: string[] = [];
  for (const heroId of heroPool) {
    // why: display shortening ONLY — the `setAbbr/` prefix is dropped for
    // readability, but the underlying ids are never re-slugified, reordered,
    // or used to build links from this shortened form.
    const slashIndex = heroId.indexOf("/");
    displayParts.push(
      slashIndex === -1 ? heroId : heroId.slice(slashIndex + 1),
    );
  }
  return displayParts.join(" · ");
}

// why: the leading articles the upstream card source moves to the end of a
// name for alphabetisation ("Legacy Virus, The"). Ordered longest-first so
// "An" is tested before "A" and a name ending ", An" is never mis-split.
const SORT_ORDER_ARTICLE_SUFFIXES = [", An", ", The", ", A"] as const;

/**
 * Restores a sort-order card name to natural reading order for display.
 *
 * The upstream card source stores some names with the leading article moved
 * to the end so they alphabetise under the significant word — `"Legacy
 * Virus, The"`, `"Dark Phoenix Saga, The"`. 25 names across 20 sets carry
 * this form. The hand-authored `co2e` set does not, so the same scheme
 * reads two ways depending on which set published it.
 *
 * This is a **display-only** correction. It never touches the underlying
 * data, and callers must never feed the result back into an id, a slug, a
 * link, or a lookup key: slugs are the set-qualified competitive id space
 * (D-10014) and are embedded in `scenario_key`s, replay artifacts, and
 * published board names. `gauntlet-rvlt-hood-the` stays `gauntlet-rvlt-hood-the`
 * no matter what this function renders.
 *
 * Renaming the data instead was considered and rejected: `data/cards/` is
 * generated from `scripts/convert-cards/inputs/cards/*.js`, and card names
 * reach `G.cardDisplayData`, which `computeStateHash` hashes as part of the
 * full `G` — so a data rename would re-pin the sentinel fixture and
 * `PRE_WP080_HASH` while leaving the five sort-form board slugs unchanged
 * anyway.
 *
 * @param cardName The published card name, in whatever form the set stores.
 * @returns The name in natural order — `"The Legacy Virus"` — or the input
 *   unchanged when it carries no trailing article.
 */
export function formatCardDisplayName(cardName: string): string {
  for (const articleSuffix of SORT_ORDER_ARTICLE_SUFFIXES) {
    if (!cardName.endsWith(articleSuffix)) {
      continue;
    }
    // why: `", The"` is 5 chars of which the article is the trailing 3 —
    // slicing by the suffix length drops the comma and space together.
    const significantPart = cardName.slice(
      0,
      cardName.length - articleSuffix.length,
    );
    // why: a name that is nothing BUT an article suffix (", The") would
    // otherwise render as a bare article with an empty subject; leaving such
    // a degenerate value untouched is safer than publishing "The ".
    if (significantPart.length === 0) {
      return cardName;
    }
    const article = articleSuffix.slice(2);
    return `${article} ${significantPart}`;
  }
  return cardName;
}

/**
 * Renders one approved configuration as the label the board shows.
 *
 * why: the ids are set-qualified (`core/brotherhood`), which is precise but
 * unreadable in a list. The set prefix is dropped and hyphens become spaces so
 * the requirement reads as the card names a player recognises; the pinned
 * challenge link still carries the exact ids.
 *
 * @param approvedLoadout The configuration to label.
 * @returns A display string, villains first then henchmen.
 */
export function formatApprovedLoadout(
  approvedLoadout: GauntletIndexApprovedLoadout,
): string {
  const villains = approvedLoadout.villainGroupIds
    .map(formatGroupId)
    .join(", ");
  const henchmen = approvedLoadout.henchmanGroupIds
    .map(formatGroupId)
    .join(", ");
  return `${villains} + ${henchmen}`;
}

/**
 * Turns a set-qualified group id into a readable label.
 *
 * @param groupId A `setAbbr/slug` id.
 * @returns The slug with hyphens replaced by spaces.
 */
function formatGroupId(groupId: string): string {
  const slug = groupId.slice(groupId.indexOf("/") + 1);
  return slug.split("-").join(" ");
}

/**
 * Every approved configuration for a gauntlet at one player count, for the
 * board's requirement list (WP-395 / D-24199).
 *
 * @param entry The gauntlet's index entry.
 * @param playerCount The routed player count.
 * @returns The configurations, or an empty array when none is published.
 */
export function listApprovedLoadouts(
  entry: { approvedLoadouts?: GauntletIndexApprovedLoadouts },
  playerCount: number,
): readonly GauntletIndexApprovedLoadout[] {
  if (entry.approvedLoadouts === undefined) {
    return [];
  }
  return entry.approvedLoadouts[String(playerCount)] ?? [];
}
