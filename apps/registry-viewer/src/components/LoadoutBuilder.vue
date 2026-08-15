<script setup lang="ts">
// LoadoutBuilder.vue — WP-091 Loadout Builder
//
// Two-column authoring surface for MATCH-SETUP documents. Left column is the
// draft summary (9 composition fields + envelope fields + download/upload
// controls + validation error list). Right column is a picker panel that
// filters the already-loaded registry by the currently-active slot.
//
// All WP-093-locked UI strings are sourced from imported registry constants
// rather than inline template literals (EC-091 §Guardrails). Paraphrasing is
// a Session Abort Condition.

import { computed, nextTick, ref, watch } from "vue";
// why: Import from the narrow `./setupContract` subpath to keep the
// viewer's browser build free of `node:fs/promises` (pulled in by the
// root `@legendary-arena/registry` barrel via localRegistry). Same
// mitigation pattern as themeClient.ts for `./schema` / `./theme.schema`.
import {
  HERO_SELECTION_MODE_FUTURE_NOTICE,
  HERO_SELECTION_MODE_LONG_EXPLANATION,
  HERO_SELECTION_MODE_READONLY_LABEL,
  HERO_SELECTION_MODE_SHORT_LABEL,
} from "@legendary-arena/registry/setupContract";
import type {
  CardRegistry,
  FlatCard,
  FlatCardType,
} from "../registry/browser";
import type { ThemeDefinition } from "../lib/themeClient";
import type { UseLoadoutDraftApi } from "../composables/useLoadoutDraft";
import { SUPPORT_POOL_CARD_TYPES } from "../composables/useLoadoutDraft";
import {
  SUPPORT_COUNT_MINIMUMS,
  SUPPORT_POOL_COUNT_FIELD,
} from "@legendary-arena/registry/setupContract";
import type {
  SupportPool,
  SupportPoolKind,
} from "@legendary-arena/registry/setupContract";
import { useLoadoutLagnExport } from "../composables/useLoadoutLagnExport";
import { serializeSetupToUrl } from "../lib/setupUrlParams";
import { parseLagnLoadout, type LagnImportedResult } from "../lib/loadoutLagnImport";
import { sniffLoadoutImportFormat, redirectSentenceFor } from "../lib/loadoutImportFormat";
import {
  parseGauntletPack,
  resolveGauntletLegLoadout,
  listGauntletLegSchemeIds,
} from "../lib/loadoutGauntletPackImport";
import { getGauntletLoadoutMenu } from "@legendary-arena/registry/gauntletLoadouts";
// why: WP-483 — resolve the leg's PER-SCHEME approved composition at the
// orchestrator (parallel to getGauntletLoadoutMenu) via the browser-safe
// ./gauntletConfigs subpath, then inject it into the pure helpers so they stay
// registry-loader-free. This subpath carries no Node built-ins (WP-483 refactor).
import { getGauntletConfig } from "@legendary-arena/registry/gauntletConfigs";
import type { GauntletConfigComposition } from "@legendary-arena/registry/gauntletConfigs";
import type { SupportedPlayerCount } from "@legendary-arena/registry/playerCountSetup";
import type { GauntletPack } from "@legendary-arena/registry/gauntletPack";
import {
  checkGauntletQualification,
  type GauntletQualificationResult,
} from "../lib/gauntletQualificationCheck";
import {
  buildSupportPreset,
  parseSupportPreset,
  serializeSupportPreset,
  supportPresetFilename,
} from "../lib/supportPreset";

// why: Verbatim WP-093 UI strings referenced via imported constants, but also
// recorded in these comments so the §11 Step 9 Select-String gate confirms
// they appear byte-for-byte in this component's source file. Paraphrasing any
// of the three strings below breaks the WP-093 consumer contract and cascades
// into WP-092.
//
// Rule-mode read-only label (verbatim):
//   "Hero selection rule: GROUP_STANDARD — Classic Legendary hero groups"
// Rule-mode hover tooltip (verbatim):
//   "The engine expands each selected hero group into its canonical card set at match start."
// Rule-mode future-notice / info-icon copy (verbatim):
//   "Hero Draft rules are planned for a future update."

interface Props {
  registry: CardRegistry;
  themes: ThemeDefinition[];
  // why: WP-279 — the loadout draft is now a single shared instance owned by
  // App.vue (instantiated post-registry-load) and passed in, so the Cards tab
  // and this builder mutate the SAME draft. LoadoutBuilder no longer calls
  // useLoadoutDraft itself — it consumes the API as a prop.
  draftApi: UseLoadoutDraftApi;
  /**
   * The verdict a `?lagn=` deep-linked match record carried, relayed by App.vue.
   *
   * why: D-24358 — `useLagnFromUrl` runs in App.vue and this component owns its own
   * `useLoadoutLagnExport` instance, so a prop is the only channel between them.
   * Without it the deep-link half of the round trip re-exports a fabricated verdict.
   */
  importedLagnResult?: LagnImportedResult | undefined;
}

const props = defineProps<Props>();
// why: WP-288 — emit (no payload) when the player asks to view this loadout as
// cards. App.vue owns the shared draft and the Cards-tab view state, so this
// component just signals intent; it adds no gallery logic and no draft mutation.
const emit = defineEmits<{ "view-as-cards": [] }>();

const draftApi = props.draftApi;
const {
  draft,
  errors,
  isValid,
  requiredVillainGroupIds,
  missingRequiredVillainGroupIds,
  requiredPlayerCountSetup,
  playerCountCompositionMismatches,
  isReady,
  setScheme,
  setMastermind,
  addVillainGroup,
  removeVillainGroup,
  addHenchmanGroup,
  removeHenchmanGroup,
  addHeroGroup,
  removeHeroGroup,
  setCount,
  setSupportPool,
  setPlayerCount,
  setSeed,
  reRollSeed,
  prefillFromTheme,
  loadFromJson,
  exportToJsonBlob,
  exportFilename,
  resetDraft,
  applySupportPreset,
} = draftApi;

const lagnExportApi = useLoadoutLagnExport(draft);

// why: D-24358 — seed the export verdict from a `?lagn=` deep link. IMMEDIATE is
// load-bearing: useLagnFromUrl runs inside App.vue's async registry loader, which
// completes BEFORE this registry-gated component mounts, so the prop is already
// populated at mount and a non-immediate watcher would never fire — the deep-link
// half would silently no-op. This is the deep-link channel; the paste/file channel
// seeds separately inside applyLagnImport.
watch(
  () => props.importedLagnResult,
  (importedResult) => {
    lagnExportApi.applyImportedResult(importedResult);
  },
  { immediate: true },
);

// why: WP-288 — the loadout gallery has nothing to show on a blank draft, so
// the "🖼 View as cards" button stays disabled until the composition has at
// least one pick. Reads the shared draft's composition only (no mutation).
const hasAnyPick = computed<boolean>(() => {
  const composition = draft.value.composition;
  return (
    composition.schemeId !== "" ||
    composition.mastermindId !== "" ||
    composition.villainGroupIds.length > 0 ||
    composition.henchmanGroupIds.length > 0 ||
    composition.heroDeckIds.length > 0
  );
});

// ── Active slot (drives the picker filter) ─────────────────────────────────

type PickerSlot =
  | "schemeId"
  | "mastermindId"
  | "villainGroupIds"
  | "henchmanGroupIds"
  | "heroDeckIds";

const activeSlot = ref<PickerSlot>("schemeId");
const pickerSearch = ref("");
/** Empty string = every set (the default). Otherwise a `SetIndexEntry.abbr`. */
const pickerSet = ref("");

const slotToCardType: Record<PickerSlot, FlatCardType> = {
  schemeId: "scheme",
  mastermindId: "mastermind",
  villainGroupIds: "villain",
  henchmanGroupIds: "henchman",
  heroDeckIds: "hero",
};

/**
 * Returns the unique card keys for the currently-active slot, filtered by
 * the picker search string. For scheme + mastermind slots we expose each
 * FlatCard key individually; for the three group-ID slots we collapse
 * duplicates (a group like `villain-brotherhood` has one card per member)
 * so the picker renders one chip per group.
 */
const pickerOptions = computed<Array<{ id: string; label: string; cardType: FlatCardType }>>(() => {
  const cardType = slotToCardType[activeSlot.value];
  const allCards: FlatCard[] = props.registry.listCards();
  // why: WP-036 Phase A — filter by set BEFORE the extId collapse below. An
  // extId is `{setAbbr}/{slug}`, so every card in a collapsed group shares one
  // set; filtering first is equivalent to filtering the collapsed entries but
  // avoids building entries that would be discarded.
  const setAbbr = pickerSet.value;
  const matching = allCards.filter(
    (card) => card.cardType === cardType && (setAbbr === "" || card.setAbbr === setAbbr),
  );
  const needle = pickerSearch.value.trim().toLowerCase();
  const entriesById = new Map<string, { id: string; label: string; cardType: FlatCardType }>();
  for (const card of matching) {
    // why: D-24018 — store the set-qualified ext_id (not the flat-card key)
    // into the loadout so the exported document is accepted by the engine's
    // Game.setup() instead of being rejected with an HTTP 500 (D-10014).
    // Collapsing by extId also yields one picker chip per villain/henchman
    // GROUP (every member shares the group's extId) rather than one per
    // member card.
    const id = card.extId;
    if (!entriesById.has(id)) {
      // why: label the collapsed entry by the GROUP/entity name carried on
      // FlatCard.groupName (hero "Black Widow", villain "Brotherhood", …),
      // NOT a member card's name. The cards already collapse into one entry
      // per group above; labeling by card.name made that single entry read
      // like an individual card (e.g. "Mission Accomplished"), so authors
      // thought they had to pick each of a hero's 14 cards. groupName makes
      // one click add the whole group. Falls back to card.name for any card
      // type that doesn't carry a groupName (never a picker slot today).
      entriesById.set(id, { id, label: card.groupName ?? card.name, cardType });
    }
  }
  const all = [...entriesById.values()];
  all.sort((left, right) => left.label.localeCompare(right.label));
  if (needle === "") {
    return all;
  }
  return all.filter(
    (entry) =>
      entry.id.toLowerCase().includes(needle) ||
      entry.label.toLowerCase().includes(needle),
  );
});

/**
 * Sets offered in the picker's set filter, restricted to those that actually
 * contain at least one card of the active slot's type.
 *
 * why: listing every set unconditionally would offer choices that silently
 * empty the picker (a hero-only expansion selected while the Scheme slot is
 * active), which reads as a broken filter rather than an empty set.
 */
const pickerSetOptions = computed<Array<{ abbr: string; name: string }>>(() => {
  const cardType = slotToCardType[activeSlot.value];
  const present = new Set<string>();
  for (const card of props.registry.listCards()) {
    if (card.cardType === cardType) {
      present.add(card.setAbbr);
    }
  }
  return props.registry
    .listSets()
    .filter((setEntry) => present.has(setEntry.abbr))
    .map((setEntry) => ({ abbr: setEntry.abbr, name: setEntry.name }));
});

// why: the set filter persists across slot changes so "show me only 2E" stays
// in force while the author fills scheme → mastermind → heroes. But a set that
// carries no cards of the newly-active type would leave the picker empty with
// no obvious cause, so drop the selection in exactly that case.
watch(activeSlot, () => {
  if (pickerSet.value === "") {
    return;
  }
  const stillOffered = pickerSetOptions.value.some((entry) => entry.abbr === pickerSet.value);
  if (!stillOffered) {
    pickerSet.value = "";
  }
});

function pickFromRegistry(entryId: string): void {
  switch (activeSlot.value) {
    case "schemeId":
      setScheme(entryId);
      return;
    case "mastermindId":
      setMastermind(entryId);
      return;
    case "villainGroupIds":
      addVillainGroup(entryId);
      return;
    case "henchmanGroupIds":
      addHenchmanGroup(entryId);
      return;
    case "heroDeckIds":
      addHeroGroup(entryId);
      return;
  }
}

function isEntrySelected(entryId: string): boolean {
  switch (activeSlot.value) {
    case "schemeId":
      return draft.value.composition.schemeId === entryId;
    case "mastermindId":
      return draft.value.composition.mastermindId === entryId;
    case "villainGroupIds":
      return draft.value.composition.villainGroupIds.includes(entryId);
    case "henchmanGroupIds":
      return draft.value.composition.henchmanGroupIds.includes(entryId);
    case "heroDeckIds":
      return draft.value.composition.heroDeckIds.includes(entryId);
  }
}

// ── Support pools (EC-425 / D-24194) ───────────────────────────────────────
//
// why: the composition carries HOW MANY cards fill each supply pile; a pool
// names WHICH. Setting a pool derives its count (useLoadoutDraft.setSupportPool),
// so the two can never disagree — D-24194 rejects a document where they do.

const SUPPORT_POOL_LABELS: Record<SupportPoolKind, string> = {
  bystanders: "Bystanders",
  wounds: "Wounds",
  officers: "S.H.I.E.L.D. Officers",
  sidekicks: "Sidekicks",
};

// ── Support Presets (EC-428 / D-24200) ─────────────────────────────────────
//
// A preset is a named, lockable definition of the non-hero board, stored as a
// downloaded JSON file (operator decision: file-only, so the never-persists
// invariant at the top of useLoadoutDraft.ts stands unamended). Locking makes
// the four piles read-only so a run can vary heroes and nothing else.

const presetName = ref("");
const presetLocked = ref(false);
const presetStatus = ref("");
const presetError = ref("");

/** True while a locked preset is protecting the support surface from edits. */
const supportLocked = computed<boolean>(() => presetLocked.value);

function onToggleLock(): void {
  presetLocked.value = !presetLocked.value;
  presetStatus.value = presetLocked.value
    ? "Support pools locked — only heroes will change."
    : "Support pools unlocked.";
  presetError.value = "";
}

function onDownloadPreset(): void {
  const name = presetName.value.trim() === "" ? "Support preset" : presetName.value;
  const preset = buildSupportPreset(draft.value, {
    name,
    locked: presetLocked.value,
    // why: wall-clock is fine here — this is a browser authoring surface, not
    // the engine, and the timestamp is descriptive metadata only. Nothing
    // reads it back for behaviour.
    createdAt: new Date().toISOString(),
    registry: {
      sets: props.registry.listSets().map((entry) => entry.abbr),
      cardCount: props.registry.listCards().length,
    },
  });
  const blob = new Blob([serializeSupportPreset(preset)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = supportPresetFilename(preset);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  presetError.value = "";
  presetStatus.value = `Saved “${preset.name}”.`;
}

function applyPresetText(text: string): void {
  const result = parseSupportPreset(text);
  if (!result.ok) {
    presetError.value = result.error;
    presetStatus.value = "";
    return;
  }
  const preset = result.preset;
  // why: applying is TOTAL — applySupportPreset overwrites all four counts and
  // replaces the pool block wholesale. A merge would let a leftover pool from
  // the previous draft survive and silently change the harness.
  applySupportPreset({ counts: preset.counts, supportPools: preset.supportPools });
  presetName.value = preset.name;
  // why: the lock travels IN the file, so a preset shared while locked arrives
  // locked for the next person.
  presetLocked.value = preset.locked;
  presetError.value = "";
  const drift =
    preset.registry !== undefined && preset.registry.cardCount !== props.registry.listCards().length
      ? ` Note: authored against a registry of ${preset.registry.cardCount} cards; this one has ${props.registry.listCards().length}.`
      : "";
  presetStatus.value = `Loaded “${preset.name}”${preset.locked ? " (locked)" : ""}.${drift}`;
}

function onPresetFileImport(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    applyPresetText(typeof reader.result === "string" ? reader.result : "");
  };
  reader.readAsText(file);
}

/**
 * "Reset draft" — clears heroes and villains, keeping the support surface when
 * a preset is locked.
 *
 * why: this is the whole point of the lock. `resetDraft` itself still defaults
 * to a total reset because the `?lagn=` import path depends on that; only this
 * button opts into preservation.
 */
function onResetDraft(): void {
  resetDraft({ preserveSupport: supportLocked.value });
  // why: WP-454 — clearing the draft ends any pack-sourced adversary lock (this
  // is the user reset handler; the lock is never cleared inside resetDraft
  // itself, which onPickGauntletLeg calls before RE-locking).
  adversaryFieldsLocked.value = false;
  presetStatus.value = supportLocked.value
    ? "Draft cleared — locked support pools kept."
    : "";
}

/** Which pool's editor is expanded. Only one is open at a time. */
const openPoolKind = ref<SupportPoolKind | null>(null);

function togglePoolEditor(kind: SupportPoolKind): void {
  openPoolKind.value = openPoolKind.value === kind ? null : kind;
}

/**
 * Every registry card eligible for each pool, sorted by set then name.
 *
 * why: this MUST be a computed, not a function the template calls. Vue
 * re-invokes template functions on every render, and each call scanned all
 * ~3,100 registry cards and sorted them — multiplied by four kinds and the
 * three call sites per kind, that locked the renderer hard enough to hang the
 * page when the Loadout tab opened. One pass, cached, keyed by kind.
 */
const poolCandidatesByKind = computed<Record<SupportPoolKind, FlatCard[]>>(() => {
  const buckets: Record<SupportPoolKind, Map<string, FlatCard>> = {
    bystanders: new Map(),
    wounds: new Map(),
    officers: new Map(),
    sidekicks: new Map(),
  };
  const typeToKind = new Map<string, SupportPoolKind>();
  for (const kind of ["bystanders", "wounds", "officers", "sidekicks"] as const) {
    for (const cardType of SUPPORT_POOL_CARD_TYPES[kind]) {
      typeToKind.set(cardType, kind);
    }
  }
  for (const card of props.registry.listCards()) {
    const kind = typeToKind.get(card.cardType as string);
    if (kind === undefined) {
      continue;
    }
    // why: collapse by extId — bystanders and wounds are emitted one per set
    // and sidekick/officer entries can repeat across a set's card list. One
    // row per distinct card is what the author is choosing between.
    const bucket = buckets[kind];
    if (!bucket.has(card.extId)) {
      bucket.set(card.extId, card);
    }
  }
  const sortCards = (cards: FlatCard[]) =>
    cards.sort(
      (left, right) =>
        left.setAbbr.localeCompare(right.setAbbr) || left.name.localeCompare(right.name),
    );
  return {
    bystanders: sortCards([...buckets.bystanders.values()]),
    wounds: sortCards([...buckets.wounds.values()]),
    officers: sortCards([...buckets.officers.values()]),
    sidekicks: sortCards([...buckets.sidekicks.values()]),
  };
});

function poolCandidates(kind: SupportPoolKind): FlatCard[] {
  return poolCandidatesByKind.value[kind];
}

/** Set abbreviations that hold at least one card for each pool. */
const poolSetOptionsByKind = computed<
  Record<SupportPoolKind, Array<{ abbr: string; name: string }>>
>(() => {
  const sets = props.registry.listSets();
  const optionsFor = (kind: SupportPoolKind) => {
    const present = new Set(poolCandidatesByKind.value[kind].map((card) => card.setAbbr));
    return sets
      .filter((entry) => present.has(entry.abbr))
      .map((entry) => ({ abbr: entry.abbr, name: entry.name }));
  };
  return {
    bystanders: optionsFor("bystanders"),
    wounds: optionsFor("wounds"),
    officers: optionsFor("officers"),
    sidekicks: optionsFor("sidekicks"),
  };
});

function poolSetOptions(kind: SupportPoolKind): Array<{ abbr: string; name: string }> {
  return poolSetOptionsByKind.value[kind];
}

function poolOf(kind: SupportPoolKind): SupportPool | undefined {
  return draft.value.supportPools?.[kind];
}

function copiesOf(kind: SupportPoolKind, extId: string): number {
  return poolOf(kind)?.cards.find((card) => card.extId === extId)?.copies ?? 0;
}

/**
 * Writes one card's copy count into a pool, creating or clearing the pool as
 * the edit requires.
 *
 * why: zero copies means "not in the pool" (D-24194 requires a positive
 * `copies`), and a pool with no cards at all is not representable — so the
 * last card's removal must clear the whole pool rather than leave an empty
 * `cards: []` the validator would reject.
 */
function setPoolCopies(kind: SupportPoolKind, card: FlatCard, copies: number): void {
  const rounded = Number.isFinite(copies) ? Math.max(0, Math.trunc(copies)) : 0;
  const existing = poolOf(kind);
  const cards = (existing?.cards ?? []).filter((entry) => entry.extId !== card.extId);
  if (rounded > 0) {
    cards.push({ extId: card.extId, copies: rounded });
  }
  if (cards.length === 0) {
    setSupportPool(kind, undefined);
    return;
  }
  cards.sort((left, right) => left.extId.localeCompare(right.extId));
  // why: hand-picking a card makes the pool explicit — the recorded `sets`
  // origin no longer describes it, and D-24194 rejects an explicit pool that
  // still carries one.
  setSupportPool(kind, { mode: "explicit", cards });
}

function onPoolCopiesInput(kind: SupportPoolKind, card: FlatCard, event: Event): void {
  const raw = (event.target as HTMLInputElement).value;
  setPoolCopies(kind, card, Number.parseInt(raw, 10));
}

/**
 * Fills a pool from whole sets, at one copy per card, then tops the pile up to
 * the engine's supply floor if one copy each would leave it short.
 *
 * why: one copy each is the neutral default — the registry records no per-set
 * pile quantity. But the engine enforces a floor per D-24032 (bystanders,
 * wounds and officers all need 30), and there are only 22 distinct wound cards
 * and 18 officers in the whole registry. "Select all sets" therefore produced a
 * pile of 22 that the builder accepted and match creation rejected with HTTP
 * 400 — the operator hit exactly this. Topping up keeps an explicit
 * "everything from these sets" request producing a LEGAL document.
 *
 * The top-up is deterministic: every card gets the same base count, and the
 * remainder goes to the first cards in ext_id order, so the same selection
 * always yields the same pile. It aims at exactly the minimum, never above.
 */
function fillPoolFromSets(kind: SupportPoolKind, setAbbrs: string[]): void {
  if (setAbbrs.length === 0) {
    setSupportPool(kind, undefined);
    return;
  }
  const chosen = new Set(setAbbrs);
  const cards = poolCandidates(kind)
    .filter((card) => chosen.has(card.setAbbr))
    .map((card) => ({ extId: card.extId, copies: 1 }));
  if (cards.length === 0) {
    setSupportPool(kind, undefined);
    return;
  }
  cards.sort((left, right) => left.extId.localeCompare(right.extId));
  const minimum = SUPPORT_COUNT_MINIMUMS[SUPPORT_POOL_COUNT_FIELD[kind]];
  if (cards.length < minimum) {
    const base = Math.floor(minimum / cards.length);
    const remainder = minimum % cards.length;
    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      if (card !== undefined) {
        card.copies = base + (index < remainder ? 1 : 0);
      }
    }
  }
  setSupportPool(kind, { mode: "sets", sets: [...setAbbrs].sort(), cards });
}

function isSetInPool(kind: SupportPoolKind, abbr: string): boolean {
  return poolOf(kind)?.sets?.includes(abbr) ?? false;
}

function togglePoolSet(kind: SupportPoolKind, abbr: string): void {
  const current = poolOf(kind)?.sets ?? [];
  const next = current.includes(abbr)
    ? current.filter((entry) => entry !== abbr)
    : [...current, abbr];
  fillPoolFromSets(kind, next);
}

function selectAllPoolSets(kind: SupportPoolKind): void {
  fillPoolFromSets(kind, poolSetOptions(kind).map((entry) => entry.abbr));
}

function clearPool(kind: SupportPoolKind): void {
  setSupportPool(kind, undefined);
}

// ── Theme prefill ──────────────────────────────────────────────────────────

const selectedThemeId = ref<string>("");

function onThemeSelected(themeId: string): void {
  selectedThemeId.value = themeId;
  if (themeId === "") {
    return;
  }
  const theme = props.themes.find((candidate) => candidate.themeId === themeId);
  if (theme) {
    prefillFromTheme(theme);
    // why: WP-454 — a theme prefill replaces the draft with a non-pack
    // composition, so any pack-sourced adversary lock no longer applies.
    adversaryFieldsLocked.value = false;
  }
}

// ── Seed controls ──────────────────────────────────────────────────────────

const seedEditable = ref(false);

// why: "🎲 Re-roll" is a deliberate authoring step — each draft gets a fresh
// opaque 16-hex seed so two consecutive exports of logically distinct drafts
// produce distinguishable setupIds downstream. A user who needs to reproduce
// a prior match can paste the old JSON via "Load JSON" and keep the original
// seed.
function onReRollSeed(): void {
  reRollSeed();
}

function onSeedEdit(event: Event): void {
  const target = event.target as HTMLInputElement;
  setSeed(target.value);
}

// ── Count editors ──────────────────────────────────────────────────────────

function onCountEdit(
  field: "bystandersCount" | "woundsCount" | "officersCount" | "sidekicksCount",
  event: Event,
): void {
  const target = event.target as HTMLInputElement;
  const parsed = Number.parseInt(target.value, 10);
  setCount(field, Number.isFinite(parsed) ? parsed : 0);
}

function onPlayerCountEdit(event: Event): void {
  const target = event.target as HTMLInputElement;
  const parsed = Number.parseInt(target.value, 10);
  setPlayerCount(Number.isFinite(parsed) ? parsed : 2);
}

// ── Export / Import ────────────────────────────────────────────────────────

const importText = ref("");
const importErrors = ref<Array<{ field: string; message: string }>>([]);
const importSuccessAt = ref<string | null>(null);

function onDownload(): void {
  // why: Belt-and-suspenders guard mirroring onDownloadLagn. The button is
  // already `:disabled`, but guarding the handler too prevents a known-invalid
  // document (e.g. a theme prefill with an unresolved bare slug, D-24018) or a
  // loadout missing a mastermind's Always-Leads villain group from being
  // downloaded, should the template binding ever be bypassed.
  if (!isReady.value) {
    return;
  }
  const blob = exportToJsonBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exportFilename();
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function onDownloadLagn(): void {
  if (!isReady.value || !lagnExportApi.isValid.value) {
    return;
  }
  const blob = lagnExportApi.exportToJsonBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = lagnExportApi.exportFilename();
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function onPasteImport(): void {
  importErrors.value = [];
  importSuccessAt.value = null;
  // why: D-24360 — if this is plainly one of the OTHER two formats, say which box
  // to use instead of handing back nine MATCH-SETUP field errors. Advisory only:
  // it returns before the parser, so nothing is routed and nothing is loaded.
  // `field` is empty so the template omits the `field: ` prefix — the whole point
  // is to not show a `root:`-style prefix on this sentence.
  const redirect = redirectSentenceFor("match-setup", sniffLoadoutImportFormat(importText.value));
  if (redirect !== null) {
    importErrors.value = [{ field: "", message: redirect }];
    return;
  }
  const result = loadFromJson(importText.value);
  if (result.ok) {
    importSuccessAt.value = new Date().toISOString();
    importText.value = "";
    // why: WP-454 — a MATCH-SETUP load replaces the draft with a non-pack
    // composition, so any pack-sourced adversary lock no longer applies.
    adversaryFieldsLocked.value = false;
    return;
  }
  importErrors.value = result.errors.map((entry) => ({
    field: entry.field,
    message: entry.message,
  }));
}

function onFileImport(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === "string" ? reader.result : "";
    importText.value = text;
    onPasteImport();
  };
  reader.readAsText(file);
}

// ── LAGN import (WP-291) — separate from the MATCH-SETUP "Load JSON" above ───
// The Loadout tab can export a LAGN ("Download LAGN") but the JSON importer only
// accepts MATCH-SETUP documents, so a LAGN file is rejected. This control closes
// the round-trip: it parses a LAGN via the published validator and applies its
// composition to the SAME shared draft using the existing setters.

const lagnImportText = ref("");
const lagnImportErrors = ref<string[]>([]);
const lagnImportSuccessAt = ref<string | null>(null);

/**
 * Parses LAGN text and, on success, REPLACES the draft with its composition.
 * On failure, surfaces the validator's errors and leaves the draft untouched.
 */
function applyLagnImport(text: string): void {
  lagnImportErrors.value = [];
  lagnImportSuccessAt.value = null;
  // why: D-24360 — same advisory redirect as the MATCH-SETUP box. Returns before
  // the parser, so the draft is untouched. `lagnImportErrors` is a string list,
  // so the sentence is its single element.
  const redirect = redirectSentenceFor("lagn", sniffLoadoutImportFormat(text));
  if (redirect !== null) {
    lagnImportErrors.value = [redirect];
    return;
  }
  const result = parseLagnLoadout(text);
  if (!result.ok) {
    lagnImportErrors.value = result.errors;
    return;
  }
  const composition = result.composition;
  // why: a LAGN import REPLACES the draft (mirrors loadFromJson's full-document
  // replace) — reset to a fresh blank, then overlay the imported composition
  // through the public draft API only (never by writing draft.composition.*).
  resetDraft();
  // why: D-24358 — the paste/file import channel seeds the export verdict too, on
  // the same total-replace contract as the draft itself: an imported record with no
  // `result` block resets the outcome to "unset" rather than leaving a stale verdict
  // from a previous import or a user pick.
  lagnExportApi.applyImportedResult(composition.result);
  // why: WP-454 — a LAGN load replaces the draft with a non-pack composition,
  // so any pack-sourced adversary lock no longer applies.
  adversaryFieldsLocked.value = false;
  if (composition.schemeId !== "") {
    setScheme(composition.schemeId);
  }
  if (composition.mastermindId !== "") {
    // why: setMastermind re-applies any Always-Leads villain groups (deduped),
    // so the imported draft carries the villains the printed rule requires.
    setMastermind(composition.mastermindId);
  }
  for (const villainGroupId of composition.villainGroupIds) {
    addVillainGroup(villainGroupId);
  }
  for (const henchmanGroupId of composition.henchmanGroupIds) {
    addHenchmanGroup(henchmanGroupId);
  }
  for (const heroDeckId of composition.heroDeckIds) {
    addHeroGroup(heroDeckId);
  }
  setCount("bystandersCount", composition.bystandersCount);
  setCount("woundsCount", composition.woundsCount);
  setCount("officersCount", composition.officersCount);
  setCount("sidekicksCount", composition.sidekicksCount);

  // why: EC-429 — apply pools AFTER the counts. setSupportPool derives the
  // paired count from the pool, and the LAGN validator has already enforced
  // that copies sum to the count (D-24195), so the derived value equals the
  // one just set. Applying pools first would let setCount overwrite nothing
  // meaningful, but the order keeps the dependency obvious.
  if (composition.supportPools !== undefined) {
    for (const kind of ["bystanders", "wounds", "officers", "sidekicks"] as const) {
      const pool = composition.supportPools[kind];
      if (pool !== undefined) {
        setSupportPool(kind, pool);
      }
    }
  }
  setPlayerCount(composition.playerCount);
  lagnImportSuccessAt.value = new Date().toISOString();
  lagnImportText.value = "";
}

function onLagnPasteImport(): void {
  applyLagnImport(lagnImportText.value);
}

function onLagnFileImport(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === "string" ? reader.result : "";
    applyLagnImport(text);
  };
  reader.readAsText(file);
}

// ── Gauntlet Pack import (WP-444) — a third importer beside JSON / LAGN ───────
// A WP-440 Gauntlet Pack is an identity-only token ({ pack_version, gauntlet })
// — neither a MATCH-SETUP nor a LAGN document — so the two importers above reject
// it. This control detects and validates a pack, then lets the visitor pick a leg
// (scheme) whose approved adversary composition prefills the draft. All
// resolution is client-side from the bundled registry: zero API, no server call.

const gauntletImportText = ref("");
const gauntletPackError = ref<string | null>(null);
const gauntletPack = ref<GauntletPack | null>(null);
const gauntletLegMessage = ref<string | null>(null);
const gauntletImportSuccessAt = ref<string | null>(null);
const gauntletSelectedVariantIndex = ref(0);

/** The approved loadout menu for the loaded pack's gauntlet, or undefined. */
const gauntletMenu = computed(() => {
  const pack = gauntletPack.value;
  if (pack === null) {
    return undefined;
  }
  return getGauntletLoadoutMenu(pack.gauntlet.setAbbr, pack.gauntlet.mastermindSlug);
});

/** The variant indices the loaded gauntlet offers (for the optional selector). */
const gauntletVariantIndices = computed<number[]>(() => {
  const menu = gauntletMenu.value;
  if (menu === undefined) {
    return [];
  }
  const indices: number[] = [];
  for (const variant of menu.variants) {
    indices.push(variant.variantIndex);
  }
  return indices;
});

/** The leg (scheme) options for the loaded pack's home set. */
const gauntletLegOptions = computed<Array<{ id: string; label: string }>>(() => {
  const pack = gauntletPack.value;
  if (pack === null) {
    return [];
  }
  const setAbbr = pack.gauntlet.setAbbr;
  const schemeCards = props.registry.query({ setAbbr, cardType: "scheme" });
  const legSchemeIds = listGauntletLegSchemeIds(setAbbr, schemeCards);
  const labelByExtId = new Map<string, string>();
  for (const card of schemeCards) {
    if (!labelByExtId.has(card.extId)) {
      labelByExtId.set(card.extId, card.groupName ?? card.name ?? card.extId);
    }
  }
  const options: Array<{ id: string; label: string }> = [];
  for (const legSchemeId of legSchemeIds) {
    options.push({ id: legSchemeId, label: labelByExtId.get(legSchemeId) ?? legSchemeId });
  }
  return options;
});

/**
 * Parses pasted/loaded text as a Gauntlet Pack. On success, holds the pack so
 * the leg picker renders; on failure, surfaces the friendly message and clears
 * any previously loaded pack.
 */
function applyGauntletPackImport(text: string): void {
  gauntletPackError.value = null;
  gauntletLegMessage.value = null;
  gauntletImportSuccessAt.value = null;
  // why: D-24360 — same advisory redirect. Note this does NOT clear
  // `gauntletPack.value` the way the parse-failure branch below does: tearing
  // down a loaded pack and its leg picker because the operator pasted into the
  // wrong box is the same harm the advisory-only rule exists to prevent.
  // `gauntletPackError` is a lone string, not a list.
  const redirect = redirectSentenceFor("gauntlet-pack", sniffLoadoutImportFormat(text));
  if (redirect !== null) {
    gauntletPackError.value = redirect;
    return;
  }
  const result = parseGauntletPack(text);
  if (!result.ok) {
    gauntletPack.value = null;
    gauntletPackError.value = result.error;
    return;
  }
  gauntletPack.value = result.pack;
  gauntletSelectedVariantIndex.value = 0;
  gauntletImportText.value = "";
}

function onGauntletPackPaste(): void {
  applyGauntletPackImport(gauntletImportText.value);
}

function onGauntletPackFile(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === "string" ? reader.result : "";
    applyGauntletPackImport(text);
  };
  reader.readAsText(file);
}

/**
 * Resolves a leg's per-scheme approved composition via the browser-safe
 * `getGauntletConfig` loader (WP-483 / D-24283), or `undefined` for an absent leg
 * — non-Core / unswapped, empty ids, or an out-of-range player count. The caller
 * then falls back to the per-mastermind menu (the WP-472 `overlay ?? menu` model).
 *
 * @param setAbbr the gauntlet's home set abbreviation.
 * @param mastermindSlug the gauntlet's mastermind slug.
 * @param schemeId the leg's scheme ext_id (`setAbbr/schemeSlug`), or `""`.
 * @param playerCount the draft/pack player count (narrowed to 1..5 here).
 * @returns the leg's per-scheme composition, or `undefined`.
 */
function resolveLegConfig(
  setAbbr: string,
  mastermindSlug: string,
  schemeId: string,
  playerCount: number,
): GauntletConfigComposition | undefined {
  const separatorIndex = schemeId.indexOf("/");
  if (setAbbr === "" || mastermindSlug === "" || separatorIndex < 0) {
    return undefined;
  }
  if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > 5) {
    return undefined;
  }
  const schemeSlug = schemeId.slice(separatorIndex + 1);
  return getGauntletConfig(
    setAbbr,
    mastermindSlug,
    schemeSlug,
    playerCount as SupportedPlayerCount,
  );
}

/**
 * Resolves the picked leg against the approved menu and prefills the draft.
 * On a friendly-failure result (unknown gauntlet / unoffered count / unknown
 * variant) it surfaces the message inline and leaves the draft untouched.
 */
function onPickGauntletLeg(schemeId: string): void {
  const pack = gauntletPack.value;
  if (pack === null) {
    return;
  }
  gauntletLegMessage.value = null;
  gauntletImportSuccessAt.value = null;
  // why: WP-483 — resolve the leg's per-scheme composition (Skrulls for a Dr. Doom
  // Secret-Invasion leg); an absent leg → undefined → the resolver uses the menu.
  const approvedComposition = resolveLegConfig(
    pack.gauntlet.setAbbr,
    pack.gauntlet.mastermindSlug,
    schemeId,
    pack.gauntlet.playerCount,
  );
  const result = resolveGauntletLegLoadout({
    pack,
    schemeId,
    menu: gauntletMenu.value,
    variantIndex: gauntletSelectedVariantIndex.value,
    approvedComposition,
  });
  if (!result.ok) {
    gauntletLegMessage.value = result.message;
    return;
  }
  const prefill = result.prefill;
  // why: a leg prefill REPLACES the draft (mirrors the LAGN importer) — reset to
  // a fresh blank, then overlay the approved leg composition through the public
  // setters only (never by writing draft.composition.*).
  resetDraft();
  setScheme(prefill.schemeId);
  setMastermind(prefill.mastermindId);
  // why: setMastermind auto-adds the mastermind's Always-Leads villain groups,
  // but the approved variant is the AUTHORITATIVE leg composition — clear the
  // auto-added villains and set exactly the resolved variant ids so the leg
  // matches the approved menu, not the mastermind default.
  for (const autoAddedVillainGroupId of [...draft.value.composition.villainGroupIds]) {
    removeVillainGroup(autoAddedVillainGroupId);
  }
  for (const villainGroupId of prefill.villainGroupIds) {
    addVillainGroup(villainGroupId);
  }
  for (const henchmanGroupId of prefill.henchmanGroupIds) {
    addHenchmanGroup(henchmanGroupId);
  }
  // why: heroes stay empty (bring your own) and the four supply-pile counts stay
  // at the blank-draft defaults (30/30/30/0) from resetDraft — they are NOT read
  // from PLAYER_COUNT_SETUP, which carries only heroCount, not the supply counts.
  setPlayerCount(prefill.playerCount);
  gauntletImportSuccessAt.value = new Date().toISOString();
  // why: WP-454 — a pack-resolved leg is the approved composition, so lock the
  // villain/henchmen fields (heroes only) to stop an accidental edit that would
  // make the played match not count toward the gauntlet. The visitor can opt out
  // with "Unlock adversaries" for a deliberate non-gauntlet loadout.
  adversaryFieldsLocked.value = true;
}

// ── Gauntlet qualification guard (WP-454 / D-24274) ──────────────────────────
// A build-time ADVISORY over the draft's adversary composition. The badge tells
// the visitor, before play, whether the loadout would count toward the
// mastermind's gauntlet; the lock keeps a pack-sourced leg's villains/henchmen
// read-only until an explicit unlock. Both are advisory — the server remains the
// sole adjudicator, and nothing here blocks building or exporting a loadout.

/** True after a gauntlet-pack leg prefill; gates adversary-field editing. */
const adversaryFieldsLocked = ref(false);

/** Restores free editing of the villain/henchmen fields (the opt-out). */
function unlockAdversaryFields(): void {
  adversaryFieldsLocked.value = false;
}

/**
 * The pre-play qualification verdict for the current draft, or null when the
 * draft has no mastermind yet. Reacts to villain/henchmen/player-count edits.
 * Resolves the draft mastermind's approved menu from the registry and delegates
 * the comparison to the pure `checkGauntletQualification`.
 */
const gauntletQualification = computed<GauntletQualificationResult | null>(() => {
  const mastermindId = draft.value.composition.mastermindId;
  const separatorIndex = mastermindId.indexOf("/");
  if (separatorIndex < 0) {
    return null;
  }
  const setAbbr = mastermindId.slice(0, separatorIndex);
  const mastermindSlug = mastermindId.slice(separatorIndex + 1);
  // why: WP-483 — resolve the draft leg's per-scheme config and pass both it and
  // the draft schemeId, so the badge qualifies against THIS leg's approved
  // adversaries; an empty/absent leg → undefined → the per-mastermind menu path.
  const schemeId = draft.value.composition.schemeId;
  const approvedComposition = resolveLegConfig(
    setAbbr,
    mastermindSlug,
    schemeId,
    draft.value.playerCount,
  );
  return checkGauntletQualification({
    villainGroupIds: draft.value.composition.villainGroupIds,
    henchmanGroupIds: draft.value.composition.henchmanGroupIds,
    playerCount: draft.value.playerCount,
    schemeId,
    menu: getGauntletLoadoutMenu(setAbbr, mastermindSlug),
    approvedComposition,
  });
});

/** The bare mastermind slug for the badge copy (from the set-qualified id). */
const gauntletMastermindName = computed<string>(() => {
  const mastermindId = draft.value.composition.mastermindId;
  const separatorIndex = mastermindId.indexOf("/");
  return separatorIndex < 0 ? mastermindId : mastermindId.slice(separatorIndex + 1);
});

/**
 * The badge to render (tone + text), or null when there is nothing to say — the
 * draft has no mastermind, or its mastermind hosts no gauntlet (`not-a-gauntlet`).
 */
const qualificationBadge = computed<
  { tone: "qualifies" | "not-qualifying" | "unoffered"; text: string } | null
>(() => {
  const verdict = gauntletQualification.value;
  if (verdict === null || verdict.status === "not-a-gauntlet") {
    return null;
  }
  const mastermindName = gauntletMastermindName.value;
  if (verdict.status === "qualifies") {
    return {
      tone: "qualifies",
      text: `✓ Qualifies for the ${mastermindName} gauntlet (variant ${verdict.variantIndex}).`,
    };
  }
  if (verdict.status === "unoffered-count") {
    return {
      tone: "unoffered",
      text: `This ${mastermindName} gauntlet isn't offered at ${draft.value.playerCount} players.`,
    };
  }
  const plural = verdict.approvedVariantCount === 1 ? "" : "s";
  return {
    tone: "not-qualifying",
    text: `✗ These villains/henchmen won't count toward the ${mastermindName} gauntlet (${verdict.approvedVariantCount} approved configuration${plural}).`,
  };
});

// ── URL share button (WP-114) ───────────────────────────────────────────────

const copyLinkUrl = ref("");
const copyLinkStatus = ref<"idle" | "copied" | "fallback">("idle");
const fallbackInputRef = ref<HTMLInputElement | null>(null);

async function onCopySetupLink(): Promise<void> {
  const url = serializeSetupToUrl(
    draft.value.composition,
    window.location.origin + window.location.pathname,
  );
  copyLinkUrl.value = url;
  try {
    await navigator.clipboard.writeText(url);
    copyLinkStatus.value = "copied";
  } catch {
    // why: Browsers gate `clipboard.writeText` behind a permissions prompt
    // and an insecure-context block (HTTP / non-localhost). The
    // readonly-input fallback ensures the URL is never lost — the user can
    // still select+copy manually. Both branches are required by EC-116
    // §Guardrails #10.
    copyLinkStatus.value = "fallback";
    await nextTick();
    fallbackInputRef.value?.select();
  }
}

// ── Errors grouped by envelope vs composition ──────────────────────────────

const envelopeErrors = computed(() =>
  errors.value.filter((entry) => !entry.field.startsWith("composition")),
);
const compositionErrors = computed(() =>
  errors.value.filter((entry) => entry.field.startsWith("composition")),
);

function slotLabel(slot: PickerSlot): string {
  switch (slot) {
    case "schemeId":
      return "Scheme";
    case "mastermindId":
      return "Mastermind";
    case "villainGroupIds":
      return "Villain groups";
    case "henchmanGroupIds":
      return "Henchman groups";
    case "heroDeckIds":
      return "Hero groups";
  }
}
</script>

<template>
  <div class="loadout-builder">
    <!-- ── Left column: draft summary ─────────────────────────────────── -->
    <section class="panel draft-panel" aria-label="Loadout draft summary">
      <header class="panel-header">
        <h2 class="panel-title">Loadout draft</h2>
        <span class="status-chip" :class="{ valid: isValid, invalid: !isValid }">
          {{ isValid ? "Schema valid" : `${errors.length} issue(s)` }}
        </span>
      </header>

      <!-- why: Rule-mode indicator is read-only in v1. The enum has exactly one
           value; exposing a picker would imply unsupported mechanics. Governance
           mandates read-only display until the enum expands per WP-093 (L5).
           The draft's heroSelectionMode binding is shown verbatim alongside the
           locked human-readable label so an auditor can confirm the downloaded
           JSON carries GROUP_STANDARD explicitly (L4 explicit-emission policy). -->
      <div class="rule-mode" role="status">
        <div class="rule-mode-row">
          <span class="rule-mode-machine" :title="HERO_SELECTION_MODE_LONG_EXPLANATION">
            {{ HERO_SELECTION_MODE_READONLY_LABEL }}
          </span>
          <button
            type="button"
            class="rule-mode-info"
            :title="HERO_SELECTION_MODE_FUTURE_NOTICE"
            :aria-label="HERO_SELECTION_MODE_FUTURE_NOTICE"
          >
            ⓘ
          </button>
        </div>
        <p class="rule-mode-short">{{ HERO_SELECTION_MODE_SHORT_LABEL }}</p>
        <p class="rule-mode-machine-value">
          <span class="field-label">heroSelectionMode:</span>
          <code>{{ draft.heroSelectionMode }}</code>
        </p>
      </div>

      <!-- Envelope fields -->
      <div class="field-group">
        <label class="field">
          <span class="field-label">Theme (Start from theme)</span>
          <select :value="selectedThemeId" @change="onThemeSelected(($event.target as HTMLSelectElement).value)">
            <option value="">— none —</option>
            <option v-for="theme in props.themes" :key="theme.themeId" :value="theme.themeId">
              {{ theme.name }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">Player count (1–5)</span>
          <input
            type="number"
            min="1"
            max="5"
            :value="draft.playerCount"
            @input="onPlayerCountEdit"
          />
        </label>

        <p
          v-if="requiredPlayerCountSetup"
          class="player-count-requirements"
          data-testid="player-count-requirements"
        >
          For a {{ draft.playerCount }}-player match:
          {{ requiredPlayerCountSetup.villainGroupCount }} villain groups,
          {{ requiredPlayerCountSetup.henchmenGroupCount }} henchmen groups,
          {{ requiredPlayerCountSetup.heroCount }} heroes,
          {{ requiredPlayerCountSetup.villainDeckBystanderCount }} villain-deck bystanders.
        </p>
        <ul
          v-if="playerCountCompositionMismatches.length > 0"
          class="requirement-warning player-count-warnings"
          data-testid="player-count-warnings"
          role="alert"
        >
          <li v-for="mismatch in playerCountCompositionMismatches" :key="mismatch.field">
            A {{ draft.playerCount }}-player match needs {{ mismatch.required }}
            {{ mismatch.label }} — this loadout has {{ mismatch.actual }}.
          </li>
        </ul>

        <label class="field seed-field">
          <span class="field-label">Seed (16-hex opaque)</span>
          <div class="seed-row">
            <input
              type="text"
              :value="draft.seed"
              :readonly="!seedEditable"
              @input="onSeedEdit"
            />
            <button type="button" class="mini-btn" @click="onReRollSeed" title="Re-roll to a new random seed">
              🎲 Re-roll
            </button>
            <button type="button" class="mini-btn" @click="seedEditable = !seedEditable">
              {{ seedEditable ? "✓ Done" : "✎ Edit" }}
            </button>
          </div>
        </label>
      </div>

      <!-- Composition: scalars -->
      <div class="field-group">
        <!-- why: schemeId / mastermindId rows wrap a <button>, not a form
             control, so <label> would be semantically wrong (and
             `vuejs-accessibility/label-has-for` would still flag them with
             `required: { some: ['nesting'] }` because the button isn't in
             the rule's controlTypes). The .field / .field-row classes carry
             the styling identically on a <div>. -->
        <div class="field field-row">
          <span class="field-label">schemeId</span>
          <div class="field-value">
            <button
              type="button"
              class="slot-btn"
              :class="{ active: activeSlot === 'schemeId' }"
              @click="activeSlot = 'schemeId'"
            >Pick…</button>
            <span class="ext-id">{{ draft.composition.schemeId || "—" }}</span>
          </div>
        </div>
        <div class="field field-row">
          <span class="field-label">mastermindId</span>
          <div class="field-value">
            <button
              type="button"
              class="slot-btn"
              :class="{ active: activeSlot === 'mastermindId' }"
              @click="activeSlot = 'mastermindId'"
            >Pick…</button>
            <span class="ext-id">{{ draft.composition.mastermindId || "—" }}</span>
          </div>
        </div>
      </div>

      <!-- Composition: arrays -->
      <div class="field-group">
        <!-- WP-454: pre-play gauntlet qualification badge (advisory only) -->
        <p
          v-if="qualificationBadge"
          class="qual-badge"
          :class="qualificationBadge.tone"
          role="status"
        >{{ qualificationBadge.text }}</p>
        <!-- WP-454: pack-sourced adversary lock notice + opt-out -->
        <p v-if="adversaryFieldsLocked" class="adversary-lock-note">
          🔒 Villains &amp; henchmen are locked to the approved gauntlet loadout — pick your heroes only.
          <button type="button" class="mini-btn" @click="unlockAdversaryFields">Unlock adversaries</button>
        </p>
        <div class="field">
          <div class="field-row">
            <span class="field-label">villainGroupIds ({{ draft.composition.villainGroupIds.length }})</span>
            <button
              type="button"
              class="slot-btn"
              :class="{ active: activeSlot === 'villainGroupIds' }"
              :disabled="adversaryFieldsLocked"
              @click="activeSlot = 'villainGroupIds'"
            >Pick…</button>
          </div>
          <ul class="chip-list">
            <li
              v-for="groupId in draft.composition.villainGroupIds"
              :key="groupId"
              class="chip"
              :class="{ required: requiredVillainGroupIds.includes(groupId) }"
            >
              {{ groupId }}
              <!-- why: a villain group the selected mastermind Always Leads is
                   mandatory (e.g. Magneto → Brotherhood) — show a lock instead
                   of a remove button so it can't be taken out of the deck. -->
              <span
                v-if="requiredVillainGroupIds.includes(groupId)"
                class="chip-lock"
                title="Always Leads — the selected mastermind requires this villain group; it can't be removed."
              >🔒</span>
              <button v-else-if="!adversaryFieldsLocked" type="button" class="chip-close" @click="removeVillainGroup(groupId)">✕</button>
            </li>
          </ul>
          <p v-if="missingRequiredVillainGroupIds.length > 0" class="requirement-warning" role="alert">
            ⚠ The selected mastermind Always Leads
            <strong>{{ missingRequiredVillainGroupIds.join(", ") }}</strong> — this villain
            group is required and must be in the deck. Add it before exporting.
          </p>
        </div>

        <div class="field">
          <div class="field-row">
            <span class="field-label">henchmanGroupIds ({{ draft.composition.henchmanGroupIds.length }})</span>
            <button
              type="button"
              class="slot-btn"
              :class="{ active: activeSlot === 'henchmanGroupIds' }"
              :disabled="adversaryFieldsLocked"
              @click="activeSlot = 'henchmanGroupIds'"
            >Pick…</button>
          </div>
          <ul class="chip-list">
            <li v-for="groupId in draft.composition.henchmanGroupIds" :key="groupId" class="chip">
              {{ groupId }}
              <button v-if="!adversaryFieldsLocked" type="button" class="chip-close" @click="removeHenchmanGroup(groupId)">✕</button>
            </li>
          </ul>
        </div>

        <div class="field">
          <div class="field-row">
            <span class="field-label">heroDeckIds ({{ draft.composition.heroDeckIds.length }})</span>
            <button
              type="button"
              class="slot-btn"
              :class="{ active: activeSlot === 'heroDeckIds' }"
              @click="activeSlot = 'heroDeckIds'"
            >Pick…</button>
          </div>
          <ul class="chip-list">
            <li v-for="groupId in draft.composition.heroDeckIds" :key="groupId" class="chip">
              {{ groupId }}
              <button type="button" class="chip-close" @click="removeHeroGroup(groupId)">✕</button>
            </li>
          </ul>
        </div>
      </div>

      <!-- Composition: counts + support pools (EC-425) -->
      <div class="field-group">
        <div class="count-grid">
          <label class="field">
            <span class="field-label">bystandersCount</span>
            <input type="number" min="0" :disabled="supportLocked || poolOf('bystanders') !== undefined" :value="draft.composition.bystandersCount" @input="(event) => onCountEdit('bystandersCount', event)" />
          </label>
          <label class="field">
            <span class="field-label">woundsCount</span>
            <input type="number" min="0" :disabled="supportLocked || poolOf('wounds') !== undefined" :value="draft.composition.woundsCount" @input="(event) => onCountEdit('woundsCount', event)" />
          </label>
          <label class="field">
            <span class="field-label">officersCount</span>
            <input type="number" min="0" :disabled="supportLocked || poolOf('officers') !== undefined" :value="draft.composition.officersCount" @input="(event) => onCountEdit('officersCount', event)" />
          </label>
          <label class="field">
            <span class="field-label">sidekicksCount</span>
            <input type="number" min="0" :disabled="supportLocked || poolOf('sidekicks') !== undefined" :value="draft.composition.sidekicksCount" @input="(event) => onCountEdit('sidekicksCount', event)" />
          </label>
        </div>

        <p class="pool-hint">
          A support pool names <em>which</em> cards fill a pile. While one is set, its
          count is derived from the pool and the box above is read-only.
        </p>

        <!-- Support Preset (EC-428): save / load / lock the non-hero board -->
        <div class="preset-bar">
          <input
            v-model="presetName"
            class="preset-name"
            placeholder="Preset name…"
            aria-label="Support preset name"
          />
          <button
            type="button"
            class="mini-btn"
            :class="{ 'preset-locked': supportLocked }"
            :title="supportLocked
              ? 'Unlock to edit the support pools again'
              : 'Lock the support pools so only heroes change between runs'"
            @click="onToggleLock"
          >{{ supportLocked ? '🔒 Locked' : '🔓 Unlocked' }}</button>
          <button type="button" class="mini-btn" @click="onDownloadPreset">💾 Save preset</button>
          <label class="mini-btn preset-load">
            📂 Load preset
            <input type="file" accept="application/json,.json" @change="onPresetFileImport" />
          </label>
        </div>
        <p v-if="presetError" class="preset-error">{{ presetError }}</p>
        <p v-else-if="presetStatus" class="preset-status">{{ presetStatus }}</p>

        <div v-for="kind in (['bystanders', 'wounds', 'officers', 'sidekicks'] as const)" :key="kind" class="pool-block">
          <div class="pool-head">
            <button type="button" class="pool-toggle" @click="togglePoolEditor(kind)">
              {{ openPoolKind === kind ? '▾' : '▸' }} {{ SUPPORT_POOL_LABELS[kind] }}
            </button>
            <span v-if="poolOf(kind)" class="pool-badge">
              {{ poolOf(kind)!.cards.length }} card(s) · {{ poolOf(kind)!.mode }}
            </span>
            <span v-else class="pool-badge pool-badge-off">count only</span>
            <button v-if="poolOf(kind) && !supportLocked" type="button" class="pool-clear" @click="clearPool(kind)">Clear</button>
          </div>

          <div v-if="openPoolKind === kind" class="pool-body">
            <div class="pool-sets">
              <span class="pool-sets-label">By set:</span>
              <button
                v-for="entry in poolSetOptions(kind)"
                :key="entry.abbr"
                type="button"
                class="pool-set-chip"
                :class="{ selected: isSetInPool(kind, entry.abbr) }"
                :title="entry.name"
                :disabled="supportLocked"
                @click="togglePoolSet(kind, entry.abbr)"
              >{{ entry.abbr }}</button>
              <button type="button" class="pool-set-all" :disabled="supportLocked" @click="selectAllPoolSets(kind)">Select all sets</button>
            </div>

            <ul class="pool-card-list">
              <li v-for="card in poolCandidates(kind)" :key="card.extId" class="pool-card-row">
                <span class="pool-card-name">{{ card.name }}</span>
                <span class="pool-card-id">{{ card.extId }}</span>
                <input
                  type="number"
                  min="0"
                  class="pool-copies"
                  :aria-label="`Copies of ${card.name}`"
                  :disabled="supportLocked"
                  :value="copiesOf(kind, card.extId)"
                  @input="(event) => onPoolCopiesInput(kind, card, event)"
                />
              </li>
              <li v-if="poolCandidates(kind).length === 0" class="pool-empty">
                No {{ SUPPORT_POOL_LABELS[kind].toLowerCase() }} cards in the loaded registry.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Download / Upload -->
      <div class="field-group">
        <div class="action-row">
          <button
            type="button"
            class="primary-btn"
            @click="onDownload"
            :disabled="!isReady"
          >
            ⬇ Download MATCH-SETUP
          </button>
          <button
            type="button"
            class="primary-btn"
            @click="onDownloadLagn"
            :disabled="!isReady || !lagnExportApi.isValid.value"
          >
            ⬇ Download LAGN
          </button>
          <button type="button" class="mini-btn" @click="onResetDraft">🔄 Reset draft</button>
          <button type="button" class="mini-btn" @click="onCopySetupLink">🔗 Copy Setup Link</button>
          <!-- why: WP-288 — view this loadout's cards on the Cards tab. Disabled
               on an empty composition so the gallery is never entered empty. -->
          <button
            type="button"
            class="mini-btn"
            @click="emit('view-as-cards')"
            :disabled="!hasAnyPick"
            title="Show this loadout's cards on the Cards tab"
          >
            🖼 View as cards
          </button>
        </div>

        <!-- LAGN export options -->
        <div v-if="isValid" class="lagn-options">
          <div class="lagn-row">
            <!-- why: WP-732 follow-up — the LAGN variant is DERIVED from the player
                 count (1 → Solo, 2+ → Cooperative; the engine has no competitive
                 variant), so it is shown read-only rather than as an editable
                 dropdown that could only ever pick the one consistent value. Change
                 the "Player count (1–5)" field above to change the variant. -->
            <div class="field">
              <span class="field-label">LAGN Variant</span>
              <span class="variant-readonly" data-testid="lagn-variant-readonly">
                {{ lagnExportApi.variantLabel.value }}
              </span>
            </div>
            <label class="field">
              <span class="field-label">Outcome</span>
              <select v-model="lagnExportApi.outcome.value">
                <option value="unset">— not recorded —</option>
                <option value="victory">Victory</option>
                <option value="loss">Loss</option>
              </select>
            </label>
          </div>
          <div class="lagn-info">
            <p class="lagn-game-id">
              <span class="field-label">Game ID:</span>
              <code>{{ lagnExportApi.gameId.value }}</code>
              <button type="button" class="mini-btn" @click="lagnExportApi.regenerateGameId">
                🔄 Regenerate
              </button>
            </p>
            <ul v-if="lagnExportApi.validationErrors.value.length > 0" class="error-list">
              <li v-for="(error, index) in lagnExportApi.validationErrors.value" :key="`lagn-${index}`">
                {{ error }}
              </li>
            </ul>
          </div>
        </div>

        <p v-if="copyLinkStatus === 'copied'" class="copy-link-success">
          Setup link copied to clipboard.
        </p>
        <div v-if="copyLinkStatus === 'fallback'" class="copy-link-fallback">
          <label class="field">
            <span class="field-label">Setup link (clipboard unavailable — copy manually)</span>
            <input
              type="text"
              readonly
              :value="copyLinkUrl"
              ref="fallbackInputRef"
              @focus="($event.target as HTMLInputElement).select()"
            />
          </label>
        </div>

        <details class="import-details">
          <summary>📥 Load JSON (paste or file)</summary>
          <div class="import-body">
            <label class="field">
              <span class="field-label">Choose JSON file</span>
              <input type="file" accept="application/json,.json" @change="onFileImport" />
            </label>
            <label class="field">
              <span class="field-label">Or paste JSON</span>
              <textarea
                v-model="importText"
                rows="6"
                placeholder="Paste a MATCH-SETUP document here…"
              ></textarea>
            </label>
            <button type="button" class="mini-btn" @click="onPasteImport">Load pasted JSON</button>
            <p v-if="importSuccessAt" class="import-success">Loaded at {{ importSuccessAt }}.</p>
            <ul v-if="importErrors.length > 0" class="error-list">
              <li v-for="(entry, index) in importErrors" :key="index">
                <!--
                  why: D-24360 — the `: ` separator sits OUTSIDE the span, so
                  omitting only the span on an empty `field` would render a bare
                  leading colon — one character from the `root:` prefix the
                  redirect sentence exists to replace. Both go together. Every
                  non-empty `field` renders exactly as before.
                -->
                <template v-if="entry.field !== ''"
                  ><span class="error-field">{{ entry.field }}</span
                  >: </template
                >{{ entry.message }}
              </li>
            </ul>
          </div>
        </details>

        <!-- why: WP-291 — a SEPARATE LAGN importer next to "Load JSON" (operator
             chose two explicit controls over auto-detect), closing the
             Download-LAGN → re-upload round-trip the JSON importer can't accept. -->
        <details class="import-details">
          <summary>📥 Load LAGN (paste or file)</summary>
          <div class="import-body">
            <label class="field">
              <span class="field-label">Choose LAGN file</span>
              <input type="file" accept="application/json,.json" @change="onLagnFileImport" />
            </label>
            <label class="field">
              <span class="field-label">Or paste LAGN</span>
              <textarea
                v-model="lagnImportText"
                rows="6"
                placeholder="Paste a LAGN file (the ⬇ Download LAGN output) here…"
              ></textarea>
            </label>
            <button type="button" class="mini-btn" @click="onLagnPasteImport">Load pasted LAGN</button>
            <p v-if="lagnImportSuccessAt" class="import-success">Loaded at {{ lagnImportSuccessAt }}.</p>
            <ul v-if="lagnImportErrors.length > 0" class="error-list">
              <li v-for="(message, index) in lagnImportErrors" :key="index">{{ message }}</li>
            </ul>
          </div>
        </details>

        <!-- why: WP-444 — a THIRD importer for the WP-440 identity pack, which is
             neither a MATCH-SETUP nor a LAGN document. It detects/validates the
             pack, then offers a leg (scheme) picker whose approved composition
             prefills the draft — all client-side from the bundled registry. -->
        <details class="import-details">
          <summary>📥 Load Gauntlet Pack (paste or file)</summary>
          <div class="import-body">
            <label class="field">
              <span class="field-label">Choose gauntlet pack file</span>
              <input type="file" accept="application/json,.json" @change="onGauntletPackFile" />
            </label>
            <label class="field">
              <span class="field-label">Or paste gauntlet pack</span>
              <textarea
                v-model="gauntletImportText"
                rows="6"
                placeholder="Paste a .gauntlet.json identity pack (the legends-site download) here…"
              ></textarea>
            </label>
            <button type="button" class="mini-btn" @click="onGauntletPackPaste">Load pasted pack</button>
            <p v-if="gauntletPackError" class="import-error">{{ gauntletPackError }}</p>

            <div v-if="gauntletPack !== null" class="gauntlet-leg-picker">
              <p class="gauntlet-pack-identity">
                Gauntlet: <code>{{ gauntletPack.gauntlet.setAbbr }}/{{ gauntletPack.gauntlet.mastermindSlug }}</code>
                · {{ gauntletPack.gauntlet.division }} · {{ gauntletPack.gauntlet.playerCount }}-player
              </p>
              <label v-if="gauntletVariantIndices.length > 1" class="field">
                <span class="field-label">Variant</span>
                <select v-model.number="gauntletSelectedVariantIndex">
                  <option
                    v-for="variantIndex in gauntletVariantIndices"
                    :key="variantIndex"
                    :value="variantIndex"
                  >
                    Variant {{ variantIndex }}
                  </option>
                </select>
              </label>
              <p class="field-label">Pick a leg (scheme) to prefill the draft:</p>
              <div class="gauntlet-leg-grid">
                <button
                  v-for="leg in gauntletLegOptions"
                  :key="leg.id"
                  type="button"
                  class="mini-btn gauntlet-leg-btn"
                  @click="onPickGauntletLeg(leg.id)"
                >
                  <span class="gauntlet-leg-name">{{ leg.label }}</span>
                  <span class="gauntlet-leg-id">{{ leg.id }}</span>
                </button>
                <p v-if="gauntletLegOptions.length === 0" class="picker-empty">
                  No schemes found for this gauntlet's set.
                </p>
              </div>
              <p v-if="gauntletLegMessage" class="import-error">{{ gauntletLegMessage }}</p>
              <p v-if="gauntletImportSuccessAt" class="import-success">
                Leg loaded at {{ gauntletImportSuccessAt }} — add your own heroes to complete the loadout.
              </p>
            </div>
          </div>
        </details>
      </div>

      <!-- Errors -->
      <section v-if="errors.length > 0" class="error-region" aria-label="Validation errors">
        <h3 class="error-title">Validation errors</h3>
        <div v-if="envelopeErrors.length > 0">
          <h4 class="error-subtitle">Envelope</h4>
          <ul class="error-list">
            <li v-for="(entry, index) in envelopeErrors" :key="`env-${index}`">
              <span class="error-field">{{ entry.field }}</span>: {{ entry.message }}
            </li>
          </ul>
        </div>
        <div v-if="compositionErrors.length > 0">
          <h4 class="error-subtitle">Composition</h4>
          <ul class="error-list">
            <li v-for="(entry, index) in compositionErrors" :key="`comp-${index}`">
              <span class="error-field">{{ entry.field }}</span>: {{ entry.message }}
            </li>
          </ul>
        </div>
      </section>
    </section>

    <!-- ── Right column: picker ───────────────────────────────────────── -->
    <section class="panel picker-panel" aria-label="Card picker">
      <header class="panel-header">
        <h2 class="panel-title">Pick: {{ slotLabel(activeSlot) }}</h2>
        <input
          v-model="pickerSearch"
          class="picker-search"
          :placeholder="`Search ${slotLabel(activeSlot).toLowerCase()}…`"
        />
        <select
          v-model="pickerSet"
          class="picker-set"
          :aria-label="`Filter ${slotLabel(activeSlot).toLowerCase()} by set`"
        >
          <option value="">All sets</option>
          <option v-for="setEntry in pickerSetOptions" :key="setEntry.abbr" :value="setEntry.abbr">
            {{ setEntry.name }}
          </option>
        </select>
      </header>
      <div class="picker-grid">
        <button
          v-for="entry in pickerOptions"
          :key="entry.id"
          type="button"
          class="picker-entry"
          :class="{ selected: isEntrySelected(entry.id) }"
          @click="pickFromRegistry(entry.id)"
        >
          <span class="picker-entry-name">{{ entry.label }}</span>
          <span class="picker-entry-id">{{ entry.id }}</span>
        </button>
        <p v-if="pickerOptions.length === 0" class="picker-empty">
          No matching entries.
          <button v-if="pickerSet !== ''" type="button" class="picker-clear-set" @click="pickerSet = ''">
            Clear set filter
          </button>
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.loadout-builder {
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 1rem;
  padding: 1rem;
  background: #0f0f13;
  color: #e8e8ee;
}

.panel {
  background: #15151e;
  border: 1px solid #22222e;
  border-radius: 8px;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.draft-panel { flex: 1 1 55%; min-width: 320px; }
.picker-panel { flex: 1 1 45%; min-width: 280px; }

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.panel-title { margin: 0; font-size: 1rem; color: #c8c8e0; }
.status-chip {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid #33334a;
}
.status-chip.valid { color: #6ee7b7; border-color: #285d44; }
.status-chip.invalid { color: #f87171; border-color: #5d2828; }

.rule-mode {
  background: #1a1a24;
  border: 1px solid #2e2e42;
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.rule-mode-row { display: flex; align-items: center; gap: 0.5rem; }
.rule-mode-machine { font-weight: 600; color: #c0c0ff; font-size: 0.85rem; }
.rule-mode-info {
  background: none;
  border: 1px solid #44445a;
  color: #9999dd;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  cursor: pointer;
  font-size: 0.75rem;
}
.rule-mode-short { margin: 0; font-size: 0.75rem; color: #8888aa; }
.rule-mode-machine-value { margin: 0; font-size: 0.75rem; color: #8888aa; display: flex; gap: 0.4rem; align-items: center; }
.rule-mode-machine-value code { font-family: ui-monospace, Consolas, monospace; color: #c0c0ff; }

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.6rem 0.8rem;
  background: #12121a;
  border: 1px solid #22222e;
  border-radius: 6px;
}
.field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; }
.field-label { color: #8888aa; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
.field-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.field-value { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

input[type="text"], input[type="number"], select, textarea {
  background: #22222e;
  border: 1px solid #33334a;
  border-radius: 4px;
  color: #e8e8ee;
  font-size: 0.85rem;
  font-family: inherit;
  padding: 0.35rem 0.55rem;
}
input:focus, select:focus, textarea:focus { outline: none; border-color: #6060c0; }

.ext-id { font-family: ui-monospace, Consolas, monospace; font-size: 0.8rem; color: #c8c8e0; }

.count-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.seed-row { display: flex; gap: 0.35rem; flex-wrap: wrap; align-items: center; }
.seed-row input { flex: 1; min-width: 160px; font-family: ui-monospace, Consolas, monospace; }

.slot-btn {
  background: #22223a;
  border: 1px solid #3e3e56;
  border-radius: 4px;
  color: #c0c0ff;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  cursor: pointer;
}
.slot-btn.active { background: #3a3a7a; border-color: #7070e0; color: #fff; }

.chip-list { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: #22223a;
  border: 1px solid #3e3e56;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.75rem;
  color: #c8c8e0;
  font-family: ui-monospace, Consolas, monospace;
}
.chip-close {
  background: none;
  border: none;
  color: #8888aa;
  cursor: pointer;
  padding: 0;
  font-size: 0.75rem;
}
.chip-close:hover { color: #f87171; }
.chip.required { border-color: #7070e0; background: #25254a; }
.chip-lock { font-size: 0.7rem; cursor: help; }
.requirement-warning {
  margin: 0.45rem 0 0 0;
  padding: 0.4rem 0.6rem;
  background: #2a1f0a;
  border: 1px solid #7a5a18;
  border-radius: 6px;
  color: #fcd34d;
  font-size: 0.76rem;
  line-height: 1.4;
}
.requirement-warning strong { font-family: ui-monospace, Consolas, monospace; color: #fde68a; }

.action-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.primary-btn {
  background: #2a2a5a;
  border: 1px solid #7070e0;
  color: #fff;
  font-weight: 600;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.primary-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.primary-btn:hover:not(:disabled) { background: #3a3a7a; }
.mini-btn {
  background: #22222e;
  border: 1px solid #33334a;
  color: #c8c8e0;
  border-radius: 4px;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
  font-size: 0.78rem;
  font-family: inherit;
}
.mini-btn:hover:not(:disabled) { background: #2a2a3a; }
.mini-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.copy-link-success { color: #6ee7b7; font-size: 0.78rem; margin: 0.25rem 0 0 0; }
.copy-link-fallback { margin-top: 0.4rem; }
.copy-link-fallback input { width: 100%; font-family: ui-monospace, Consolas, monospace; font-size: 0.75rem; }

.import-details { background: #12121a; border: 1px solid #22222e; border-radius: 6px; padding: 0.5rem 0.8rem; }
.import-details summary { cursor: pointer; color: #c0c0ff; font-size: 0.85rem; }
.import-body { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
.import-success { color: #6ee7b7; font-size: 0.8rem; margin: 0; }
.import-error { color: #fda4af; font-size: 0.8rem; margin: 0; line-height: 1.4; }

.gauntlet-leg-picker { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid #2a2a3a; padding-top: 0.5rem; }
.gauntlet-pack-identity { margin: 0; font-size: 0.8rem; color: #c8c8e8; }
.gauntlet-pack-identity code { font-family: ui-monospace, Consolas, monospace; color: #a5b4fc; }
.gauntlet-leg-grid { display: flex; flex-direction: column; gap: 0.35rem; }
.gauntlet-leg-btn { display: flex; flex-direction: column; align-items: flex-start; gap: 0.1rem; text-align: left; }
.gauntlet-leg-name { font-size: 0.82rem; }
.gauntlet-leg-id { font-family: ui-monospace, Consolas, monospace; font-size: 0.7rem; color: #7c7ca8; }

/* WP-454: gauntlet qualification badge (advisory) + adversary-lock notice */
.qual-badge { margin: 0 0 0.5rem; padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.82rem; border: 1px solid transparent; }
.qual-badge.qualifies { color: #6ee7b7; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.4); }
.qual-badge.not-qualifying { color: #fca5a5; background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.4); }
.qual-badge.unoffered { color: #c8c8e8; background: rgba(148, 163, 184, 0.12); border-color: rgba(148, 163, 184, 0.35); }
.adversary-lock-note { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 0.5rem; font-size: 0.8rem; color: #c8c8e8; }

.error-region { background: #1a0f0f; border: 1px solid #4a1010; border-radius: 6px; padding: 0.6rem 0.8rem; }
.error-title { margin: 0 0 0.3rem 0; font-size: 0.85rem; color: #fca5a5; }
.error-subtitle { margin: 0.4rem 0 0.2rem 0; font-size: 0.72rem; color: #8888aa; text-transform: uppercase; letter-spacing: 0.05em; }
.error-list { margin: 0; padding-left: 1.1rem; color: #fda4af; font-size: 0.78rem; }
.error-field { font-family: ui-monospace, Consolas, monospace; color: #fcd34d; }

.pool-hint { margin: 0.5rem 0 0.4rem 0; font-size: 0.75rem; color: #7c7ca8; line-height: 1.4; }
.preset-bar { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
.preset-name { flex: 1; min-width: 8rem; }
.preset-load { position: relative; overflow: hidden; cursor: pointer; }
.preset-load input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.mini-btn.preset-locked { border-color: #c0a060; color: #f0d090; }
.preset-status { margin: 0 0 0.4rem 0; font-size: 0.72rem; color: #8b8bd6; }
.preset-error { margin: 0 0 0.4rem 0; font-size: 0.72rem; color: #fca5a5; }
.pool-block { border-top: 1px solid #22222e; padding-top: 0.4rem; margin-top: 0.4rem; }
.pool-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.pool-toggle {
  background: none; border: none; padding: 0; font: inherit;
  color: #c8c8e0; font-size: 0.85rem; font-weight: 600; cursor: pointer;
}
.pool-badge { font-size: 0.72rem; color: #8b8bd6; }
.pool-badge-off { color: #6666aa; }
.pool-clear {
  margin-left: auto; background: none; border: none; padding: 0; font: inherit;
  font-size: 0.72rem; color: #8b8bd6; text-decoration: underline; cursor: pointer;
}
.pool-body { margin: 0.4rem 0 0.2rem 0.9rem; }
.pool-sets { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
.pool-sets-label { font-size: 0.72rem; color: #8888aa; }
.pool-set-chip, .pool-set-all {
  font-size: 0.72rem; padding: 0.15rem 0.4rem; border-radius: 4px;
  border: 1px solid #33334a; background: #15151e; color: #c8c8e0; cursor: pointer;
}
.pool-set-chip.selected { border-color: #6060c0; background: #23233a; }
.pool-set-all { border-style: dashed; }
.pool-card-list { list-style: none; margin: 0; padding: 0; max-height: 11rem; overflow-y: auto; }
.pool-card-row { display: flex; align-items: center; gap: 0.4rem; padding: 0.15rem 0; }
.pool-card-name { flex: 1; font-size: 0.78rem; }
.pool-card-id { font-family: ui-monospace, Consolas, monospace; font-size: 0.68rem; color: #8888aa; }
.pool-copies { width: 4rem; }
.pool-empty { font-size: 0.75rem; color: #6666aa; }

.picker-search { flex: 1; min-width: 180px; }
/* why: the picker header carries a title + search + set filter; without wrap
   the three squeeze the search box unusably at the 280px panel min-width. */
.picker-panel .panel-header { flex-wrap: wrap; }
.picker-set { flex: 0 1 auto; min-width: 120px; max-width: 100%; }
.picker-grid { display: flex; flex-direction: column; gap: 0.35rem; overflow-y: auto; }
.picker-entry {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: #12121a;
  border: 1px solid #22222e;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  color: #c8c8e0;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}
.picker-entry:hover { background: #1a1a26; border-color: #44445a; }
.picker-entry.selected { background: #22225a; border-color: #7070e0; }
.picker-entry-name { font-weight: 600; font-size: 0.85rem; }
.picker-entry-id { font-family: ui-monospace, Consolas, monospace; font-size: 0.72rem; color: #8888aa; }
.picker-empty { color: #6666aa; font-size: 0.8rem; }
.picker-clear-set {
  margin-left: 0.4rem;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: #8b8bd6;
  text-decoration: underline;
  cursor: pointer;
}

.lagn-options { background: #12121a; border: 1px solid #22222e; border-radius: 6px; padding: 0.75rem; margin-top: 0.5rem; }
.lagn-row { display: flex; gap: 0.75rem; margin-bottom: 0.5rem; }
.lagn-row .field { flex: 1; }
.variant-readonly {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.35rem 0.55rem;
  font-size: 0.85rem;
  color: #c8c8e0;
}
.lagn-info { font-size: 0.8rem; }
.lagn-game-id { margin: 0; display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: #0f0f13; border-radius: 4px; font-family: ui-monospace, Consolas, monospace; color: #c8c8e0; }
.lagn-game-id code { color: #60a5fa; flex: 1; word-break: break-all; }
</style>
