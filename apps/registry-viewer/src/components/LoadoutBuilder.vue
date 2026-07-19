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
import type {
  SupportPool,
  SupportPoolKind,
} from "@legendary-arena/registry/setupContract";
import { useLoadoutLagnExport } from "../composables/useLoadoutLagnExport";
import { serializeSetupToUrl } from "../lib/setupUrlParams";
import { parseLagnLoadout } from "../lib/loadoutLagnImport";

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
} = draftApi;

const lagnExportApi = useLoadoutLagnExport(draft);

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
 * Fills a pool from whole sets, at one copy per card.
 *
 * why: "one copy each" is the only defensible default — the registry records
 * no per-set pile quantity, so any other multiplier would be invented. The
 * author adjusts copies afterwards; the count follows automatically.
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
  const result = loadFromJson(importText.value);
  if (result.ok) {
    importSuccessAt.value = new Date().toISOString();
    importText.value = "";
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
        <div class="field">
          <div class="field-row">
            <span class="field-label">villainGroupIds ({{ draft.composition.villainGroupIds.length }})</span>
            <button
              type="button"
              class="slot-btn"
              :class="{ active: activeSlot === 'villainGroupIds' }"
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
              <button v-else type="button" class="chip-close" @click="removeVillainGroup(groupId)">✕</button>
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
              @click="activeSlot = 'henchmanGroupIds'"
            >Pick…</button>
          </div>
          <ul class="chip-list">
            <li v-for="groupId in draft.composition.henchmanGroupIds" :key="groupId" class="chip">
              {{ groupId }}
              <button type="button" class="chip-close" @click="removeHenchmanGroup(groupId)">✕</button>
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
            <input type="number" min="0" :disabled="poolOf('bystanders') !== undefined" :value="draft.composition.bystandersCount" @input="(event) => onCountEdit('bystandersCount', event)" />
          </label>
          <label class="field">
            <span class="field-label">woundsCount</span>
            <input type="number" min="0" :disabled="poolOf('wounds') !== undefined" :value="draft.composition.woundsCount" @input="(event) => onCountEdit('woundsCount', event)" />
          </label>
          <label class="field">
            <span class="field-label">officersCount</span>
            <input type="number" min="0" :disabled="poolOf('officers') !== undefined" :value="draft.composition.officersCount" @input="(event) => onCountEdit('officersCount', event)" />
          </label>
          <label class="field">
            <span class="field-label">sidekicksCount</span>
            <input type="number" min="0" :disabled="poolOf('sidekicks') !== undefined" :value="draft.composition.sidekicksCount" @input="(event) => onCountEdit('sidekicksCount', event)" />
          </label>
        </div>

        <p class="pool-hint">
          A support pool names <em>which</em> cards fill a pile. While one is set, its
          count is derived from the pool and the box above is read-only.
        </p>

        <div v-for="kind in (['bystanders', 'wounds', 'officers', 'sidekicks'] as const)" :key="kind" class="pool-block">
          <div class="pool-head">
            <button type="button" class="pool-toggle" @click="togglePoolEditor(kind)">
              {{ openPoolKind === kind ? '▾' : '▸' }} {{ SUPPORT_POOL_LABELS[kind] }}
            </button>
            <span v-if="poolOf(kind)" class="pool-badge">
              {{ poolOf(kind)!.cards.length }} card(s) · {{ poolOf(kind)!.mode }}
            </span>
            <span v-else class="pool-badge pool-badge-off">count only</span>
            <button v-if="poolOf(kind)" type="button" class="pool-clear" @click="clearPool(kind)">Clear</button>
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
                @click="togglePoolSet(kind, entry.abbr)"
              >{{ entry.abbr }}</button>
              <button type="button" class="pool-set-all" @click="selectAllPoolSets(kind)">Select all sets</button>
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
          <button type="button" class="mini-btn" @click="resetDraft">🔄 Reset draft</button>
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
                <span class="error-field">{{ entry.field }}</span>: {{ entry.message }}
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

.error-region { background: #1a0f0f; border: 1px solid #4a1010; border-radius: 6px; padding: 0.6rem 0.8rem; }
.error-title { margin: 0 0 0.3rem 0; font-size: 0.85rem; color: #fca5a5; }
.error-subtitle { margin: 0.4rem 0 0.2rem 0; font-size: 0.72rem; color: #8888aa; text-transform: uppercase; letter-spacing: 0.05em; }
.error-list { margin: 0; padding-left: 1.1rem; color: #fda4af; font-size: 0.78rem; }
.error-field { font-family: ui-monospace, Consolas, monospace; color: #fcd34d; }

.pool-hint { margin: 0.5rem 0 0.4rem 0; font-size: 0.75rem; color: #7c7ca8; line-height: 1.4; }
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
