<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onBeforeUnmount } from "vue";
import type { FlatCard, CardQueryExtended, HealthReport, CardRegistry, SetIndexEntry, FlatCardType } from "./registry/browser";
import { getRegistry } from "./lib/registryClient";
import { getThemes } from "./lib/themeClient";
import type { ThemeDefinition } from "./lib/themeClient";
import { getKeywordGlossary, getKeywordPdfPages, getRuleGlossary } from "./lib/glossaryClient";
import { getCardTypes } from "./lib/cardTypesClient";
import { getCardAbilities, buildAbilityTagIndex } from "./lib/cardAbilitiesClient";
import { getSchemeTwistPatterns, getSchemeTwistAssignments } from "./lib/schemeTwistClient";
import { getCardPatterns } from "./lib/cardPatternsClient";
import { getCardMechanics, cardMatchesMechanics } from "./lib/cardMechanicsClient";
import { devLog } from "./lib/devLog";
import type { CardTypeEntry, CardAbilityEntry, SchemeTwistPattern, CardPattern, CardMechanicsIndex } from "@legendary-arena/registry/schema";
import { setGlossaries } from "./composables/useRules";
import { useGlossary, rebuildGlossaryEntries } from "./composables/useGlossary";
import { useLightbox } from "./composables/useLightbox";
import { useCardViewMode } from "./composables/useCardViewMode";
import CardGrid        from "./components/CardGrid.vue";
import CardSizeSlider  from "./components/CardSizeSlider.vue";
import CardDetail      from "./components/CardDetail.vue";
import ThemeGrid      from "./components/ThemeGrid.vue";
import ThemeSizeSlider from "./components/ThemeSizeSlider.vue";
import ThemeDetail    from "./components/ThemeDetail.vue";
import HealthPanel    from "./components/HealthPanel.vue";
import GlossaryPanel  from "./components/GlossaryPanel.vue";
import ImageLightbox  from "./components/ImageLightbox.vue";
import ViewModeToggle from "./components/ViewModeToggle.vue";
import LoadoutBuilder from "./components/LoadoutBuilder.vue";
import LoadoutPreview from "./components/LoadoutPreview.vue";
import LoadoutTray from "./components/LoadoutTray.vue";
import FilterDropdown from "./components/FilterDropdown.vue";
import type { FilterDropdownItem } from "./components/FilterDropdown.vue";
import AppShell from "./components/branding/AppShell.vue";
import { useSetupFromUrl } from "./composables/useSetupFromUrl";
import { parsePlayerCountFromUrl } from "./lib/setupUrlParams";
import { applyPreviewToDraft } from "./lib/applyPreviewToDraft";
import { useLagnFromUrl } from "./composables/useLagnFromUrl";
import { useLoadoutDraft } from "./composables/useLoadoutDraft";
import type { UseLoadoutDraftApi } from "./composables/useLoadoutDraft";
import { isCardInLoadout, toggleCardInLoadout } from "./lib/loadoutCardActions";
import { compositionExtIdSet, isCardInLoadoutComposition, supportPoolExtIdSet } from "./lib/loadoutGalleryCards";
import type {
  MatchSetupDocument,
  MatchSetupValidationError,
  SetupCompositionInput,
} from "@legendary-arena/registry/setupContract";
import type { SetupMatchedCount } from "./composables/useSetupFromUrl";
import type { LagnImportedResult } from "./lib/loadoutLagnImport";

// ── Glossary panel ───────────────────────────────────────────────────────────
const glossary = useGlossary();

// ── Lightbox ─────────────────────────────────────────────────────────────────
const lightbox = useLightbox();

// ── Card view-mode toggle ────────────────────────────────────────────────────
// why: viewMode is read from localStorage (key 'cardViewMode') at the moment
// useCardViewMode.ts is first imported — the composable uses a module-scoped
// ref seeded from localStorage.getItem with narrowing + self-heal write-back.
// That import runs during App setup (above the template), so the reactive
// state is ready before the first render and the user's preference survives
// page reloads without any explicit onMounted work here. See
// src/composables/useCardViewMode.ts for the narrowing and error-swallow logic.
const { viewMode: cardViewMode } = useCardViewMode();

// ── State ─────────────────────────────────────────────────────────────────────
const registry      = ref<CardRegistry | null>(null);
const loading       = ref(true);
const loadStatus    = ref("Starting up…");
const loadError     = ref<string | null>(null);
const allCards      = ref<FlatCard[]>([]);
const filteredCards = ref<FlatCard[]>([]);
const selectedCard  = ref<FlatCard | null>(null);
const healthReport  = ref<HealthReport | null>(null);
const allSets       = ref<SetIndexEntry[]>([]);
const showDiag      = ref(false);
const searchText    = ref("");
const filterSet     = ref("");
const filterHC      = ref("");
const HC_OPTIONS    = ["covert","instinct","ranged","strength","tech"];

// why: Absolute URL to the rulebook PDF on R2, populated from
// registry-config.json. `config.rulebookPdfUrl ?? null` is the supported
// absence path — when the config field is missing, the GlossaryPanel's
// per-entry anchor template already guards against null, so missing config
// is silent (no warning banner, no fallback UI).
const rulebookPdfUrl = ref<string | null>(null);

// why: Absolute URL to the /rules page on www (the full rulebook reproduced as
// HTML). Populated from registry-config.json like rulebookPdfUrl; the same
// null-absence path applies (GlossaryPanel omits the per-entry HTML link when
// null, no warning). The HTML link is shown ALONGSIDE the PDF deep-link, not
// as a replacement (WP-039). Anchor contract: `#keyword-<slug(label)>` /
// `#rule-<slug(label)>` — see GlossaryPanel.
const rulesPageUrl = ref<string | null>(null);

// ── View toggle ──────────────────────────────────────────────────────────────
// why: "loadout" is an additive third tab (WP-091); Cards/Themes tabs are
// unaffected. No router library is added (EC-091 L7) — the existing tab
// switcher is extended in place.
type ActiveView = "cards" | "themes" | "loadout";
const activeView = ref<ActiveView>("cards");

// ── URL-driven setup preview (WP-114) ────────────────────────────────────────
// why: A single useSetupFromUrl instance per page prevents duplicate URL
// parsing and duplicate validator runs across the parent (auto-switch
// decision below) and the child (<LoadoutPreview> render). Instantiated
// lazily inside onMounted because the composable needs the real
// CardRegistryReader and registry.value is null until the R2 fetch
// resolves. The composable reads window.location.search exactly once at
// instantiation, so deferring to post-registry-load does not change the
// declarative arrival semantics.
const setupHasUrlParams = ref(false);
const setupPreviewDocument = ref<MatchSetupDocument | null>(null);
const setupValidationErrors = ref<MatchSetupValidationError[]>([]);
const setupMatchedCount = ref<SetupMatchedCount>({
  schemes: 0,
  masterminds: 0,
  villainGroups: 0,
  henchmanGroups: 0,
  heroDecks: 0,
});
const setupParsedParams = ref<Partial<SetupCompositionInput>>({});

// why: One-shot auto-switch — URL params are a declarative arrival signal,
// not a sticky preference. The first render with hasUrlParams=true flips
// activeView to "loadout"; this ref then latches and the auto-switch never
// re-fires, preserving the user's subsequent manual tab navigation.
const hasAppliedUrlAutoSwitch = ref(false);

// ── URL-driven LAGN deep-link (WP-362 / D-24154) ─────────────────────────────
// why: the `?lagn=<base64url>` param carries a full match loadout (from the
// arena client's in-match "View loadout" link, WP-363). When present it takes
// precedence over — and suppresses — the WP-114 five-field setup preview above,
// so the tab shows one authoritative source per load. Applied once on mount via
// useLagnFromUrl; a bad/decode-failed link switches to the tab and surfaces
// lagnUrlErrors rather than a blank builder.
const hasLagnParam = ref(false);
const lagnUrlErrors = ref<string[]>([]);
// why: D-24358 — the `?lagn=` deep-link is how a real match LAGN reaches the
// viewer, and its verdict must survive a re-export. `useLagnFromUrl` and
// `useLoadoutLagnExport` are SEPARATE instances (this file vs LoadoutBuilder) with
// no other channel, so App.vue holds the imported verdict and relays it down as a
// prop. Snapshotted exactly like hasLagnParam / lagnUrlErrors above.
const importedLagnResult = ref<LagnImportedResult | undefined>(undefined);

// ── Shared loadout draft (WP-279 / D-24054) ──────────────────────────────────
// why: ONE useLoadoutDraft instance per page, owned here and shared by both the
// Loadout tab (LoadoutBuilder consumes it as a prop) and the Cards tab
// (CardDetail's add-to-loadout button). It is instantiated lazily in onMounted
// AFTER the registry resolves — the draft's validation computed dereferences
// `registry`, so building it at setup() top level would throw on the null
// registry (the same reason useSetupFromUrl defers). Null until then; the
// Loadout tab, the CardDetail button, and the tray all gate on a present
// registry / instance.
//
// why: shallowRef (not ref) so Vue does NOT deep-unwrap the API's inner refs —
// `loadoutDraftApi.value.draft` must stay a Ref<MatchSetupDocument> and
// `.errors` a ComputedRef so the shared instance behaves identically whether
// read here or inside LoadoutBuilder. The API object itself is a stable
// container assigned once; only its inner refs need to be reactive.
const loadoutDraftApi = shallowRef<UseLoadoutDraftApi | null>(null);

// ── Loadout gallery filter mode (WP-288 / D-24072) ───────────────────────────
// why: when true, the Cards tab is narrowed to exactly the shared loadout
// draft's composition (the "View loadout as cards" gallery). It is a filter
// MODE over the existing Cards tab — a final, inert-when-off stage in
// applyFilters() — entered from the Loadout tab / tray and cleared by the inline
// banner's ✕. Default false: the Cards tab browses all cards as before.
const loadoutGalleryActive = ref(false);
// why: EC-426 — support cards (bystanders / wounds / officers / sidekicks) are
// opt-in in the gallery. Default OFF per operator feedback: they are not needed
// often and a select-all-sets pool adds ~120 cards that swamp the heroes and
// villains the gallery is usually opened to look at.
const loadoutGalleryIncludesSupport = ref(false);
/** How many distinct cards this loadout's support pools name; 0 hides the toggle. */
const loadoutSupportPoolCount = computed(() =>
  loadoutDraftApi.value === null
    ? 0
    : supportPoolExtIdSet(loadoutDraftApi.value.draft.value.supportPools).size,
);

// ── Filter drawer (collapsible on short viewports) ───────────────────────────
const compactMq = window.matchMedia("(max-height: 800px)");
const filterDrawerOpen = ref(!compactMq.matches);

function onCompactMqChange(e: MediaQueryListEvent) {
  filterDrawerOpen.value = !e.matches;
}
compactMq.addEventListener("change", onCompactMqChange);
onBeforeUnmount(() => compactMq.removeEventListener("change", onCompactMqChange));

const activeFilterCount = computed(() => {
  let n = 0;
  if (filterSet.value) n++;
  if (filterHC.value) n++;
  if (selectedTypeGroupKeys.value.size > 0) n += selectedTypeGroupKeys.value.size;
  if (selectedEffectSlugs.value.size > 0) n += selectedEffectSlugs.value.size;
  if (selectedPatternSlugs.value.size > 0) n += selectedPatternSlugs.value.size;
  if (selectedMechanicSlugs.value.size > 0) n += selectedMechanicSlugs.value.size;
  return n;
});

// ── Theme state ──────────────────────────────────────────────────────────────
const allThemes       = ref<ThemeDefinition[]>([]);
const filteredThemes  = ref<ThemeDefinition[]>([]);
const selectedTheme   = ref<ThemeDefinition | null>(null);
const themeSearchText = ref("");

// ── Card type groups ──────────────────────────────────────────────────────────

// why: types/subtypes widened from FlatCardType (9-value union) to string so
// the same TypeGroup interface accommodates both LEGACY_TYPE_GROUPS (legacy
// FlatCardType values) and displayedTypeGroups built from card-types.json
// (Phase-2 slugs like "sidekick" / "shield-agent" not yet in the FlatCardType
// union). Phase 2 (separate WP) regenerates per-card cardType emission
// upstream via modern-master-strike.
interface TypeGroup {
  label:    string;
  emoji:    string;
  types:    string[];
  subtypes: { label: string; type: string }[];
}

// why: card-types.json (WP-086) is the new source-of-truth for ribbon shape;
// LEGACY_TYPE_GROUPS lights up only on degraded-fetch fallback when
// getCardTypes() resolves to []. Byte-identical to the legacy hardcoded
// array minus the "Location" subchip — flattenSet() in shared.ts never
// assigned cardType="location" (the 8 hardcoded literals are
// hero/mastermind/villain/henchman/scheme/bystander/wound/other; "location"
// was orphan UI). Dead code on the happy path.
const LEGACY_TYPE_GROUPS: TypeGroup[] = [
  {
    label: "Hero", emoji: "🦸",
    types: ["hero"],
    subtypes: [{ label: "Hero", type: "hero" }],
  },
  {
    label: "Mastermind", emoji: "🦹",
    types: ["mastermind"],
    subtypes: [{ label: "Mastermind", type: "mastermind" }],
  },
  {
    label: "Villain", emoji: "💀",
    types: ["villain"],
    subtypes: [{ label: "Villain", type: "villain" }],
  },
  {
    label: "Henchman", emoji: "🗡️",
    types: ["henchman"],
    subtypes: [{ label: "Henchman", type: "henchman" }],
  },
  {
    label: "Scheme", emoji: "📜",
    types: ["scheme"],
    subtypes: [{ label: "Scheme", type: "scheme" }],
  },
  {
    label: "Bystander", emoji: "🧑",
    types: ["bystander"],
    subtypes: [{ label: "Bystander", type: "bystander" }],
  },
  {
    label: "Wound", emoji: "🩸",
    types: ["wound"],
    subtypes: [{ label: "Wound", type: "wound" }],
  },
  {
    label: "Other", emoji: "🃏",
    types: ["other"],
    subtypes: [{ label: "Other", type: "other" }],
  },
];

// Live taxonomy fetched from card-types.json. Empty until onMounted resolves;
// stays empty if fetch fails or schema rejects (non-blocking by design —
// cardTypesClient.ts never throws).
const cardTypes = ref<CardTypeEntry[]>([]);

// why: WP-278 — the Type dropdown's model is the set of selected type-GROUP
// keys (group labels from displayedTypeGroups), not leaf type slugs. `selectedTypes`
// (the leaf slugs the query uses) is a computed below that expands each selected
// group into its `types[]`, preserving the old group→leaf behavior (e.g. the
// SHIELD group → agent/officer/trooper). The query call site still casts the
// leaf set to FlatCardType[]; applyQuery returns zero results for unknown
// Phase-2 slugs (covered by registry/shared.test.ts).
const selectedTypeGroupKeys = ref<Set<string>>(new Set());

// ── Card-abilities effect-tag taxonomy (WP-125 / EC-127) ──────────────────────
// Live taxonomy fetched from card-abilities.json. Empty until onMounted
// resolves; stays empty if fetch fails or schema rejects (non-blocking by
// design — cardAbilitiesClient.ts never throws). The chip ribbon stays
// hidden when this is empty.
const abilitiesTaxonomy = ref<CardAbilityEntry[]>([]);
const abilityTagIndex = ref<Map<string, Set<string>> | null>(null);
const selectedEffectSlugs = ref<Set<string>>(new Set());

// ── Scheme twist pattern taxonomy (WP-183) ───────────────────────────────────
const twistPatterns = ref<SchemeTwistPattern[]>([]);
const twistAssignments = ref<Map<string, string>>(new Map());

// ── Card mechanical pattern taxonomies (WP-184) ──────────────────────────────
// Four parallel taxonomies, one per entity-level cardType. Empty arrays/Maps
// until the cardPatternsClient fetch resolves; stay empty if that taxonomy's
// fetch fails (per-taxonomy isolation via Promise.allSettled).
const heroPatterns = ref<CardPattern[]>([]);
const villainPatterns = ref<CardPattern[]>([]);
const henchmanPatterns = ref<CardPattern[]>([]);
const mastermindPatterns = ref<CardPattern[]>([]);
const heroPatternAssignments = ref<Map<string, string>>(new Map());
const villainPatternAssignments = ref<Map<string, string>>(new Map());
const henchmanPatternAssignments = ref<Map<string, string>>(new Map());
const mastermindPatternAssignments = ref<Map<string, string>>(new Map());
// why: WP-278 — the scheme-twist (WP-183) and the four mechanical-pattern
// (WP-184) selections unify into ONE set behind the single contextual Patterns
// dropdown; applyFilters routes it by the active card type (twistPattern for
// scheme, mechanicalPattern otherwise). The taxonomy data refs above stay split
// (each type has its own pattern list), but the user's selection is one set.
const selectedPatternSlugs = ref<Set<string>>(new Set());

// ── Hero mechanic taxonomy (WP-270 / EC-301) ─────────────────────────────────
// Hero-mechanic feed (card-mechanics.json, WP-269): the mechanics[] list drives
// the filter ribbon and the per-card cards{ extId: { mechanics } } mapping
// drives filtering. null until onMounted resolves; becomes the non-blocking
// empty index if the fetch fails or the schema rejects (cardMechanicsClient.ts
// never throws), in which case the ribbon stays hidden and the grid renders
// unchanged.
const cardMechanicsIndex = ref<CardMechanicsIndex | null>(null);
const selectedMechanicSlugs = ref<Set<string>>(new Set());

// why: WP-278 — when the Type selection changes, drop any active pattern
// selection. A pattern slug is type-specific (a hero pattern is meaningless on a
// villain card), and the single contextual Patterns dropdown re-populates for
// the newly active type. Fires on every Type dropdown change, including its clear.
function onTypeChange() {
  selectedPatternSlugs.value = new Set();
  applyFilters();
}

/** Resets all card filters to their default state and re-applies. */
function clearAllFilters() {
  searchText.value = "";
  filterSet.value = "";
  filterHC.value = "";
  selectedTypeGroupKeys.value = new Set();
  selectedEffectSlugs.value = new Set();
  selectedPatternSlugs.value = new Set();
  selectedMechanicSlugs.value = new Set();
  selectedCard.value = null;
  applyFilters();
}

// ── Load registry + themes ────────────────────────────────────────────────────
onMounted(async () => {
  try {
    loadStatus.value = "Fetching set index from R2…";
    const configResponse = await fetch("/registry-config.json");
    if (!configResponse.ok) throw new Error(`Cannot load registry-config.json: ${configResponse.status}`);
    const config = await configResponse.json();
    const metadataBaseUrl = config.metadataBaseUrl as string;
    rulebookPdfUrl.value = (config.rulebookPdfUrl as string | undefined) ?? null;
    rulesPageUrl.value = (config.rulesPageUrl as string | undefined) ?? null;

    const reg = await getRegistry();
    loadStatus.value = "Parsing card data…";
    registry.value      = reg;
    allSets.value       = reg.listSets();
    allCards.value      = reg.listCards();
    filteredCards.value = allCards.value;
    healthReport.value  = reg.validate();

    // why: WP-279 / D-24054 — instantiate the single shared loadout draft here,
    // AFTER registry.value is set, because useLoadoutDraft's validation computed
    // calls validateMatchSetupDocument(draft, registry) and would dereference a
    // null registry if built at setup() top level. App.vue holds the one
    // instance; LoadoutBuilder consumes it as a prop. Created BEFORE the URL
    // composables below because useLagnFromUrl applies a `?lagn=` deep-link to it.
    loadoutDraftApi.value = useLoadoutDraft(reg);

    // WP-362 / D-24154: apply a `?lagn=` deep-link (if present) to the shared
    // draft. It takes precedence over the WP-114 setup preview, so when it is
    // present the preview is not computed/rendered (one authoritative source per
    // load). A decode-failed / invalid-LAGN link leaves the draft untouched and
    // surfaces lagnUrlErrors.
    const lagnFromUrl = useLagnFromUrl(loadoutDraftApi.value);
    hasLagnParam.value = lagnFromUrl.hasLagnParam;
    lagnUrlErrors.value = lagnFromUrl.lagnUrlErrors;
    importedLagnResult.value = lagnFromUrl.importedResult;

    // WP-114: instantiate the URL-preview composable once with the real registry
    // and snapshot its outputs — ONLY when no `?lagn=` deep-link is present (which
    // supersedes it). The composable's inputs are stable for the page lifetime so
    // a single read is sufficient.
    if (!hasLagnParam.value) {
      const setupApi = useSetupFromUrl(reg);
      setupHasUrlParams.value = setupApi.hasUrlParams.value;
      setupPreviewDocument.value = setupApi.previewDocument.value;
      setupValidationErrors.value = setupApi.validationErrors.value;
      setupMatchedCount.value = setupApi.matchedCount.value;
      setupParsedParams.value = setupApi.parsedParams.value;

      // why: WP-387 — seed the EDITOR draft's player count from the URL so the
      // WP-372 required-count readout ("For an N-player match: …") matches the
      // count-keyed gauntlet board the "Challenge this leg" link came from. The
      // slot-sizing guidance is driven by the editor draft (getPlayerCountSetup),
      // NOT the read-only preview, and seeding here — right after the draft is
      // created, in the no-`?lagn=` branch (a full LAGN sets its own count and
      // takes precedence) — makes the editor correct independent of the later
      // "Edit this loadout" promote path. Absent / invalid param → null → the
      // draft keeps its DEFAULT_PLAYER_COUNT (unchanged behavior).
      const urlPlayerCount = parsePlayerCountFromUrl(window.location.search);
      if (urlPlayerCount !== null) {
        loadoutDraftApi.value.setPlayerCount(urlPlayerCount);
      }
    }

    // why: one-shot auto-switch — either a `?lagn=` deep-link or the WP-114 setup
    // params is a declarative "open the Loadout tab" arrival signal, not a sticky
    // preference. The first render with either flips activeView once; the latch
    // then never re-fires, preserving subsequent manual tab navigation.
    const hasLoadoutUrlSignal = hasLagnParam.value || setupHasUrlParams.value;
    if (
      hasLoadoutUrlSignal &&
      !hasAppliedUrlAutoSwitch.value &&
      activeView.value !== "loadout"
    ) {
      activeView.value = "loadout";
      hasAppliedUrlAutoSwitch.value = true;
    } else if (hasLoadoutUrlSignal) {
      hasAppliedUrlAutoSwitch.value = true;
    }

    // Load themes in parallel (non-blocking — card view works even if themes fail)
    loadStatus.value = "Loading themes…";
    try {
      const themes = await getThemes(metadataBaseUrl);
      allThemes.value = themes;
      filteredThemes.value = themes;
    } catch (themeError) {
      console.warn("[Themes] Load failed (non-blocking):", themeError);
    }

    // why: card-types.json (WP-086) drives the ribbon as the authoritative
    // taxonomy. cardTypesClient.ts is non-blocking — HTTP failure or schema
    // rejection resolves to []; displayedTypeGroups computed selects
    // LEGACY_TYPE_GROUPS in that case. No try/catch needed at this seam.
    loadStatus.value = "Loading card types taxonomy…";
    cardTypes.value = await getCardTypes(metadataBaseUrl);
    if (cardTypes.value.length === 0) {
      // why: diagnostic-parity emission — makes degraded-fetch mode visible
      // in the console without changing control flow. displayedTypeGroups
      // computed handles the actual fallback to LEGACY_TYPE_GROUPS. Fires
      // at most once per page session because onMounted runs once.
      devLog("cardTypes", "using legacy fallback");
    }

    // why: Parallel to the cardTypes / glossary fetches — the abilities
    // client is non-blocking (resolves to [] on HTTP failure or schema
    // rejection). When the taxonomy is empty the Effects FilterDropdown
    // (WP-278) renders nothing (empty items); the cards view stays functional.
    loadStatus.value = "Loading abilities taxonomy…";
    abilitiesTaxonomy.value = await getCardAbilities(metadataBaseUrl);
    if (abilitiesTaxonomy.value.length > 0) {
      // why: build the per-card effect-tag index exactly once after both
      // registry and taxonomy resolve. Keyed by card.key (the
      // ${abbr}-${cardType}-${slug} string established by WP-122).
      // Subsequent chip toggles consult the index without recomputing —
      // see applyFilters() below.
      abilityTagIndex.value = buildAbilityTagIndex(
        allCards.value,
        abilitiesTaxonomy.value,
      );
    }

    // why: WP-183 — scheme twist pattern taxonomy. Non-blocking parallel
    // fetches; empty results hide the twist UI via v-if guards. Post-hoc
    // enrichment of allCards avoids modifying httpRegistry.ts internals.
    loadStatus.value = "Loading scheme twist patterns…";
    const [fetchedTwistPatterns, fetchedTwistAssignments] = await Promise.all([
      getSchemeTwistPatterns(metadataBaseUrl),
      getSchemeTwistAssignments(metadataBaseUrl),
    ]);
    twistPatterns.value = fetchedTwistPatterns;
    twistAssignments.value = fetchedTwistAssignments;
    if (fetchedTwistAssignments.size > 0) {
      for (const card of allCards.value) {
        if (card.cardType === "scheme") {
          const pattern = fetchedTwistAssignments.get(`${card.setAbbr}/${card.slug}`);
          if (pattern) card.twistPattern = pattern;
        }
      }
    }

    // why: WP-184 — card mechanical pattern taxonomies (hero / villain /
    // henchman / mastermind). cardPatternsClient.ts is non-blocking and uses
    // Promise.allSettled internally, so a failed fetch for one taxonomy does
    // not affect the others. Post-hoc enrichment of allCards mirrors the
    // WP-183 pattern above — the registry was loaded before the pattern
    // assignments resolved, so applyFilters() re-enriches after each query().
    loadStatus.value = "Loading card mechanical patterns…";
    const patternsBundle = await getCardPatterns(metadataBaseUrl);
    heroPatterns.value       = patternsBundle.patternsByType.hero;
    villainPatterns.value    = patternsBundle.patternsByType.villain;
    henchmanPatterns.value   = patternsBundle.patternsByType.henchman;
    mastermindPatterns.value = patternsBundle.patternsByType.mastermind;
    heroPatternAssignments.value       = patternsBundle.assignmentsByType.hero;
    villainPatternAssignments.value    = patternsBundle.assignmentsByType.villain;
    henchmanPatternAssignments.value   = patternsBundle.assignmentsByType.henchman;
    mastermindPatternAssignments.value = patternsBundle.assignmentsByType.mastermind;
    // why: build the card.key → entitySlug index ONCE before enrichment so
    // both the initial allCards pass and every subsequent applyFilters() call
    // share an O(1) lookup table built from the registry's structural data.
    buildCardKeyToEntitySlugIndex();
    enrichMechanicalPatterns(allCards.value);

    // why: WP-270 — hero-mechanic feed (card-mechanics.json, WP-269).
    // cardMechanicsClient.ts is non-blocking (returns the empty index on HTTP
    // failure or schema rejection, never throws), so no try/catch is needed at
    // this seam. When the index has no mechanics the Mechanics FilterDropdown
    // (WP-278) renders nothing (empty items); the card view stays functional.
    loadStatus.value = "Loading hero mechanics taxonomy…";
    cardMechanicsIndex.value = await getCardMechanics(metadataBaseUrl);

    // why: Parallel to getThemes() above — glossary fetch is non-blocking.
    // If R2 is unreachable or the JSON files are missing, console.warn and
    // continue; tooltips will be absent but the card view remains functional.
    loadStatus.value = "Loading glossary…";
    try {
      const [keywords, keywordPdfPages, rules] = await Promise.all([
        getKeywordGlossary(metadataBaseUrl),
        getKeywordPdfPages(metadataBaseUrl),
        getRuleGlossary(metadataBaseUrl),
      ]);
      setGlossaries(keywords, keywordPdfPages, rules);
      rebuildGlossaryEntries();
    } catch (glossaryError) {
      console.warn("[Glossary] Load failed (non-blocking):", glossaryError);
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err);
    console.error("[Registry] Load failed:", err);
  } finally {
    loading.value = false;
  }

  // why: keyboard shortcuts are registered on window so they work regardless
  // of focus. Ctrl/Cmd+K toggles the glossary, Esc closes it when open.
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});

function handleKeydown(event: KeyboardEvent) {
  // Ctrl/Cmd + K toggles the glossary panel
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    glossary.toggle();
    return;
  }
  // why: Esc closes the topmost overlay. Lightbox takes priority because
  // it's fully modal; glossary is secondary.
  if (event.key === "Escape") {
    if (lightbox.isOpen.value) {
      lightbox.closeLightbox();
      return;
    }
    if (glossary.isOpen.value) {
      glossary.close();
    }
  }
}

// ── Pattern enrichment helpers (WP-184) ──────────────────────────────────────
// why: card.key is shaped `${abbr}-${cardType}-${groupSlug}-${cardSlug}` for
// villain/henchman/mastermind cards and `${abbr}-${cardType}-${heroSlug}-${cardSlug}`
// for hero cards. Both groupSlug and cardSlug can contain hyphens (e.g.
// villain "false-aesir-of-alchemax", hero "old-man-logan", card
// "mission-accomplished"), so string-parsing the boundary inside the key is
// structurally ambiguous. Walk the registry structurally instead and build
// a definitive `card.key → entitySlug` map once after the registry loads;
// then enrichment is O(1) per card and survives any key shape changes.
const cardKeyToEntitySlug = ref<Map<string, string>>(new Map());

function buildCardKeyToEntitySlugIndex() {
  if (!registry.value) return;
  const index = new Map<string, string>();
  for (const setEntry of registry.value.listSets()) {
    const setData = registry.value.getSet(setEntry.abbr);
    if (!setData) continue;
    const abbr = setData.abbr;
    for (const hero of setData.heroes) {
      for (const card of hero.cards) {
        const resolvedCardType = typeof card.cardType === "string" && card.cardType.length > 0
          ? card.cardType
          : "hero";
        // why: hero key shape (per shared.ts flattenSet) uses card.slug as
        // the trailing segment and the resolved cardType in the type slot.
        index.set(`${abbr}-${resolvedCardType}-${hero.slug}-${card.slug}`, hero.slug);
      }
    }
    for (const group of setData.villains) {
      for (const card of group.cards) {
        index.set(`${abbr}-villain-${group.slug}-${card.slug}`, group.slug);
      }
    }
    for (const henchman of setData.henchmen as Array<Record<string, unknown>>) {
      if (typeof henchman !== "object" || henchman === null) continue;
      const groupSlug = String(henchman["slug"] ?? henchman["name"] ?? "henchman");
      const subCards = henchman["cards"];
      if (Array.isArray(subCards) && subCards.length > 0) {
        for (const c of subCards) {
          if (typeof c !== "object" || c === null) continue;
          const cardRecord = c as Record<string, unknown>;
          const cardSlug = String(cardRecord["slug"] ?? cardRecord["name"] ?? groupSlug);
          index.set(`${abbr}-henchman-${groupSlug}-${cardSlug}`, groupSlug);
        }
      } else {
        // why: legacy flat-shape henchman branch in flattenSet emits one
        // FlatCard whose key has no trailing card slug.
        index.set(`${abbr}-henchman-${groupSlug}`, groupSlug);
      }
    }
    for (const mm of setData.masterminds) {
      for (const card of mm.cards) {
        index.set(`${abbr}-mastermind-${mm.slug}-${card.slug}`, mm.slug);
      }
    }
  }
  cardKeyToEntitySlug.value = index;
}

// why: registry.query() rebuilds the flat list each call via flattenSet, so
// post-hoc enrichment on allCards (in onMounted) doesn't carry over to filtered
// results. enrichMechanicalPatterns() re-applies the assignment maps over
// any list of FlatCards; called both at boot (against allCards) and inside
// applyFilters() (against the fresh query results). Explicit per-cardType
// routing — no dynamic dispatch.
function enrichMechanicalPatterns(targetCards: FlatCard[]) {
  const hasAny =
    heroPatternAssignments.value.size > 0 ||
    villainPatternAssignments.value.size > 0 ||
    henchmanPatternAssignments.value.size > 0 ||
    mastermindPatternAssignments.value.size > 0;
  if (!hasAny) return;
  const index = cardKeyToEntitySlug.value;
  for (const card of targetCards) {
    const entitySlug = index.get(card.key);
    if (!entitySlug) continue;
    const entityKey = `${card.setAbbr}/${entitySlug}`;
    let assignment: string | undefined;
    if (card.cardType === "hero") {
      assignment = heroPatternAssignments.value.get(entityKey);
    } else if (card.cardType === "villain") {
      // why: WP-184 per-card defect fix — villain assignments are keyed
      // per-card (`{abbr}/{groupSlug}/{cardSlug}`), not per-group, so the
      // "Fight: KO Hero" chip only matches cards whose own clause KOs a hero.
      assignment = villainPatternAssignments.value.get(`${entityKey}/${card.slug}`);
    } else if (card.cardType === "henchman") {
      assignment = henchmanPatternAssignments.value.get(entityKey);
    } else if (card.cardType === "mastermind") {
      assignment = mastermindPatternAssignments.value.get(entityKey);
    }
    if (assignment) card.mechanicalPattern = assignment;
  }
}

// ── Filtering ─────────────────────────────────────────────────────────────────
function applyFilters() {
  if (!registry.value) return;
  const q: CardQueryExtended = {};
  // why: cast to FlatCardType[] because selectedTypes can hold Phase-2 slugs
  // (e.g., "sidekick", "shield-agent") not yet in the FlatCardType 9-value
  // union. applyQuery() gracefully returns zero results for unknown slugs
  // (Phase 1 invariant covered by registry/shared.test.ts).
  if (selectedTypes.value.size > 0) q.cardTypes = [...selectedTypes.value] as FlatCardType[];
  if (filterSet.value)  q.setAbbr      = filterSet.value;
  if (filterHC.value)   q.heroClass    = filterHC.value as CardQueryExtended["heroClass"];
  if (searchText.value) q.nameContains = searchText.value;
  const queryResults = registry.value.query(q as any);
  // why: registry.query() returns fresh FlatCard objects each call (listCards
  // rebuilds via flattenSet), so the post-hoc twistPattern enrichment applied
  // to allCards in onMounted doesn't carry over. Re-enrich scheme cards here
  // so the twist filter and downstream grid/detail badges see the field.
  if (twistAssignments.value.size > 0) {
    for (const card of queryResults) {
      if (card.cardType !== "scheme") continue;
      const pattern = twistAssignments.value.get(`${card.setAbbr}/${card.slug}`);
      if (pattern) card.twistPattern = pattern;
    }
  }
  // why: WP-184 — re-enrich mechanicalPattern on query results for the same
  // reason as twistPattern above (the registry's query() returns fresh
  // FlatCards each call). enrichMechanicalPatterns() handles per-cardType
  // routing internally.
  enrichMechanicalPatterns(queryResults);
  // why: WP-278 — the unified Patterns filter (collapsing WP-183's scheme-twist
  // ribbon + WP-184's four mechanical-pattern ribbons). The contextual Patterns
  // dropdown is gated to a single active card type (activeSingleType); its
  // selection is ONE set routed by that type — scheme → the card's twistPattern,
  // any other type → its mechanicalPattern (both enriched onto the cards above).
  // AND-combined with every other filter; applied post-query because query()
  // doesn't know about patterns.
  let patternFiltered = queryResults;
  if (selectedPatternSlugs.value.size > 0 && activeSingleType.value) {
    const activeType = activeSingleType.value;
    const activePatterns = selectedPatternSlugs.value;
    patternFiltered = queryResults.filter((card) => {
      if (card.cardType !== activeType) return false;
      const pattern = activeType === "scheme" ? card.twistPattern : card.mechanicalPattern;
      return pattern != null && activePatterns.has(pattern);
    });
  }
  // why: the abilities filter is applied *after* applyQuery() rather than
  // inside it. applyQuery() lives in apps/registry-viewer/src/registry/shared.ts
  // (the registry package's per-viewer flatten copy) and an effect-tag
  // concept is out of scope for that helper — keeping the filter outside
  // preserves shared.ts's purity. Semantics: OR within the abilities
  // filter (a card matches if ANY selected effect's tag is present); AND
  // with every other filter (set / hero class / card type / search —
  // existing applyQuery() semantics preserved upstream).
  let effectFiltered = patternFiltered;
  if (selectedEffectSlugs.value.size > 0 && abilityTagIndex.value) {
    const tagIndex = abilityTagIndex.value;
    const selected = selectedEffectSlugs.value;
    effectFiltered = patternFiltered.filter((card) => {
      const tags = tagIndex.get(card.key);
      if (!tags) return false;
      for (const slug of selected) {
        if (tags.has(slug)) return true;
      }
      return false;
    });
  }
  // why: WP-270 — hero-mechanic filter, applied AFTER applyQuery() and the
  // other post-query filters so OR-within-selected-mechanics composes as an AND
  // with the text query + every other filter. Card→mechanic membership is read
  // ONLY from the feed's per-card cards[extId].mechanics mapping via
  // cardMatchesMechanics; the viewer never parses ability text at runtime (the
  // producer, WP-269, already classified each hero's mechanics).
  if (selectedMechanicSlugs.value.size > 0 && cardMechanicsIndex.value) {
    const index = cardMechanicsIndex.value;
    const selected = selectedMechanicSlugs.value;
    filteredCards.value = effectFiltered.filter((card) =>
      cardMatchesMechanics(index, card.extId, selected),
    );
  } else {
    filteredCards.value = effectFiltered;
  }
  // why: WP-288 — the loadout-gallery stage is the FINAL narrowing stage and is
  // INERT when loadoutGalleryActive is false, so every existing filter path
  // above assigns filteredCards byte-identically (AC-2). When active (and the
  // shared draft is loaded), restrict to the cards whose extId is in the
  // loadout composition, expanding each group pick to its member cards via the
  // loadoutGalleryCards helper (App.vue does not re-encode the expansion). The
  // draft-presence guard mirrors selectedCardInLoadout: the draft is null before
  // the registry resolves.
  if (loadoutGalleryActive.value && loadoutDraftApi.value) {
    const draftValue = loadoutDraftApi.value.draft.value;
    const galleryExtIds = compositionExtIdSet(draftValue.composition);
    // why: support pools are opt-in. They live on the envelope (D-24194) so the
    // gallery never saw them before, but they are also numerous — a
    // select-all-sets bystander pool is ~70 cards — and wanted far less often
    // than the heroes and villains, so folding them in unconditionally would
    // bury the cards the gallery exists to show. Default off; the banner
    // carries the toggle.
    if (loadoutGalleryIncludesSupport.value) {
      for (const extId of supportPoolExtIdSet(draftValue.supportPools)) {
        galleryExtIds.add(extId);
      }
    }
    filteredCards.value = filteredCards.value.filter((card) =>
      isCardInLoadoutComposition(card, galleryExtIds),
    );
  }
  selectedCard.value = null;
}

// why: displayedTypeGroups selects between the fetched taxonomy
// (data/metadata/card-types.json via cardTypesClient.ts) and the legacy
// hardcoded fallback. cardTypes.value.length === 0 means the fetch returned
// empty (HTTP failure or schema rejection); LEGACY_TYPE_GROUPS preserves the
// original ribbon so the card view stays functional in degraded mode.
const displayedTypeGroups = computed<TypeGroup[]>(() => {
  if (cardTypes.value.length === 0) return LEGACY_TYPE_GROUPS;

  const topLevel = cardTypes.value
    .filter((entry) => entry.parentType === null)
    .sort((a, b) => a.order - b.order);

  return topLevel.map((parent) => {
    const children = cardTypes.value
      .filter((entry) => entry.parentType === parent.slug)
      .sort((a, b) => a.order - b.order);

    if (children.length > 0) {
      return {
        label:    parent.label,
        emoji:    parent.emoji ?? "",
        types:    children.map((child) => child.slug),
        subtypes: children.map((child) => ({ label: child.label, type: child.slug })),
      };
    }
    return {
      label:    parent.label,
      emoji:    parent.emoji ?? "",
      types:    [parent.slug],
      subtypes: [{ label: parent.label, type: parent.slug }],
    };
  });
});

// ── Unified filter dropdowns (WP-278 / EC-309) ───────────────────────────────

// why: the leaf card-type slugs the query filters on, expanded from the Type
// dropdown's selected group keys. Preserves the group→leaf behavior (a group
// toggles all its types[], e.g. the SHIELD group → agent/officer/trooper).
// Read-only — the Type dropdown mutates selectedTypeGroupKeys, never this.
const selectedTypes = computed<Set<string>>(() => {
  const leafTypes = new Set<string>();
  for (const group of displayedTypeGroups.value) {
    if (selectedTypeGroupKeys.value.has(group.label)) {
      for (const type of group.types) leafTypes.add(type);
    }
  }
  return leafTypes;
});

// why: the single active card type that owns a pattern taxonomy, else null —
// gates the contextual Patterns dropdown + its filter (the WP-183/184
// single-cardType rule). A multi-leaf group (SHIELD) makes selectedTypes.size > 1,
// so it correctly yields null (no pattern dropdown).
const PATTERN_BEARING_TYPES = ["hero", "villain", "henchman", "mastermind", "scheme"];
const activeSingleType = computed<string | null>(() => {
  if (selectedTypes.value.size !== 1) return null;
  const onlyType = [...selectedTypes.value][0]!;
  return PATTERN_BEARING_TYPES.includes(onlyType) ? onlyType : null;
});

// why: the Set/Class dropdowns are single-select, but FilterDropdown's model is a
// Set; these bridge the single-string refs (filterSet/filterHC — applyQuery reads
// them unchanged) to a ≤1-element Set.
const selectedSetValues = computed<Set<string>>({
  get: () => (filterSet.value ? new Set([filterSet.value]) : new Set<string>()),
  set: (next) => { filterSet.value = [...next][0] ?? ""; },
});
const selectedClassValues = computed<Set<string>>({
  get: () => (filterHC.value ? new Set([filterHC.value]) : new Set<string>()),
  set: (next) => { filterHC.value = [...next][0] ?? ""; },
});

const setItems = computed<FilterDropdownItem[]>(() =>
  allSets.value.map((setEntry) => ({ value: setEntry.abbr, label: setEntry.name })),
);

const classItems = computed<FilterDropdownItem[]>(() =>
  HC_OPTIONS.map((heroClass) => ({ value: heroClass, label: heroClass })),
);

const typeItems = computed<FilterDropdownItem[]>(() => {
  // why: per-group count = cards whose cardType is one of the group's leaf types.
  const countByType = new Map<string, number>();
  for (const card of allCards.value) {
    countByType.set(card.cardType, (countByType.get(card.cardType) ?? 0) + 1);
  }
  return displayedTypeGroups.value.map((group) => {
    let count = 0;
    for (const type of group.types) count += countByType.get(type) ?? 0;
    return {
      value: group.label,
      label: group.label,
      emoji: group.emoji || undefined,
      count,
      title: group.subtypes.map((sub) => sub.label).join(", "),
    };
  });
});

const mechanicItems = computed<FilterDropdownItem[]>(() => {
  // why: WP-276 / D-24052 — list ALL mechanics, sorted by label (the feed
  // carries no display-order field).
  const mechanics = cardMechanicsIndex.value?.mechanics ?? [];
  return [...mechanics]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((mechanic) => ({ value: mechanic.slug, label: mechanic.label, count: mechanic.cardCount }));
});

const effectItems = computed<FilterDropdownItem[]>(() => {
  const taxonomy = [...abilitiesTaxonomy.value].sort((a, b) => a.order - b.order);
  const tagIndex = abilityTagIndex.value;
  // why: per-effect count = cards whose ability-tag set includes that slug
  // (session-wide, independent of other active filters — stable as the user narrows).
  const counts = new Map<string, number>();
  if (tagIndex) {
    for (const tags of tagIndex.values()) {
      for (const slug of tags) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  return taxonomy.map((entry) => ({
    value: entry.slug,
    label: entry.label,
    emoji: entry.emoji ?? undefined,
    count: tagIndex ? (counts.get(entry.slug) ?? 0) : undefined,
  }));
});

// why: the contextual Patterns dropdown's label depends on the single active
// card type (scheme → "Twist"; the four entity types → "… Pattern").
const patternDropdownLabel = computed<string>(() => {
  const activeType = activeSingleType.value;
  if (activeType === "scheme") return "Twist";
  if (activeType === "hero") return "Hero Pattern";
  if (activeType === "villain") return "Villain Pattern";
  if (activeType === "henchman") return "Henchman Pattern";
  if (activeType === "mastermind") return "Mastermind Pattern";
  return "Pattern";
});

const patternItems = computed<FilterDropdownItem[]>(() => {
  const activeType = activeSingleType.value;
  if (!activeType) return [];
  const isScheme = activeType === "scheme";
  // why: explicit per-type routing (no dynamic key access, per 00.6 Rule 7).
  let taxonomy: readonly (SchemeTwistPattern | CardPattern)[] = [];
  if (activeType === "scheme") taxonomy = twistPatterns.value;
  else if (activeType === "hero") taxonomy = heroPatterns.value;
  else if (activeType === "villain") taxonomy = villainPatterns.value;
  else if (activeType === "henchman") taxonomy = henchmanPatterns.value;
  else if (activeType === "mastermind") taxonomy = mastermindPatterns.value;
  // why: per-pattern count = cards of the active type carrying that pattern
  // (scheme → twistPattern, else → mechanicalPattern), session-wide.
  const counts = new Map<string, number>();
  for (const card of allCards.value) {
    if (card.cardType !== activeType) continue;
    const pattern = isScheme ? card.twistPattern : card.mechanicalPattern;
    if (pattern) counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }
  return [...taxonomy]
    .sort((a, b) => a.order - b.order)
    .map((pattern) => ({
      value: pattern.slug,
      label: pattern.label,
      emoji: pattern.emoji ?? undefined,
      count: counts.get(pattern.slug) ?? 0,
      title: pattern.description,
    }));
});

// ── Theme filtering ──────────────────────────────────────────────────────────
function applyThemeFilters() {
  const needle = themeSearchText.value.toLowerCase().trim();
  if (!needle) {
    filteredThemes.value = allThemes.value;
    return;
  }
  filteredThemes.value = allThemes.value.filter((theme) => {
    const searchable = [
      theme.name,
      theme.description,
      theme.setupIntent.mastermindId,
      theme.setupIntent.schemeId,
      ...(theme.tags ?? []),
      ...(theme.setupIntent.heroDeckIds ?? []),
    ].join(" ").toLowerCase();
    return searchable.includes(needle);
  });
  selectedTheme.value = null;
}

/**
 * Cross-link: navigate from theme detail to the card view, searching by slug.
 * The `@navigate-to-card` event also carries a card-type string, but this
 * handler intentionally searches by slug only (it clears the type filter), so
 * that second emitted argument is deliberately not bound.
 */
function navigateToCard(slug: string) {
  activeView.value = "cards";
  searchText.value = slug;
  selectedTypeGroupKeys.value = new Set();
  selectedPatternSlugs.value = new Set();
  filterSet.value = "";
  filterHC.value = "";
  applyFilters();
}

/**
 * Enters the "View loadout as cards" gallery: switches to the Cards tab and
 * narrows it to the shared loadout draft's composition. Routed from both the
 * Loadout-tab "🖼 View as cards" button and the floating tray's action.
 */
function navigateToLoadoutGallery() {
  const api = loadoutDraftApi.value;
  // why: defensive no-op — both entry points are disabled / hidden on an empty
  // composition, but if a handler still fires with no draft or zero picks there
  // is nothing to view, so return without throwing rather than entering an empty
  // gallery.
  if (!api || loadoutPickCount.value === 0) {
    return;
  }
  activeView.value = "cards";
  loadoutGalleryActive.value = true;
  // why: mirror navigateToCard — "view THIS loadout" REPLACES the prior Cards
  // filters rather than ANDing with them, so clear the same refs navigateToCard
  // clears (search / type / patterns / set / hero class) before re-filtering.
  searchText.value = "";
  selectedTypeGroupKeys.value = new Set();
  selectedPatternSlugs.value = new Set();
  filterSet.value = "";
  filterHC.value = "";
  applyFilters();
}

/** Exits the loadout gallery and restores normal Cards browsing (all cards). */
function clearLoadoutGallery() {
  loadoutGalleryActive.value = false;
  applyFilters();
}

// ── Cards-tab add-to-loadout wiring (WP-279 / D-24054) ───────────────────────

// why: the selected card's current slot occupancy in the shared draft. False
// while the draft hasn't been instantiated yet (pre-registry) or no card is
// selected. CardDetail renders its button label/state from this.
const selectedCardInLoadout = computed<boolean>(() => {
  const api = loadoutDraftApi.value;
  const selected = selectedCard.value;
  if (!api || !selected) {
    return false;
  }
  return isCardInLoadout(api.draft.value.composition, selected);
});

/**
 * Promotes the URL setup preview into the SHARED loadout draft (D-24190).
 *
 * why: App.vue owns the one draft the builder renders (WP-279 / D-24054), so
 * the promotion has to be applied HERE. `LoadoutPreview` used to call
 * `useLoadoutDraft()` itself — an independent instance — and load into that,
 * so "Edit this loadout" appeared to do nothing. It also went through
 * `loadFromJson`, which rejects a partial (scheme+mastermind-only) preview
 * outright; `applyPreviewToDraft` instead applies the composition through the
 * draft's own mutators, which tolerate an incomplete work-in-progress.
 */
function onPromotePreviewToDraft(): void {
  const api = loadoutDraftApi.value;
  const previewDocument = setupPreviewDocument.value;
  // why: defensive no-op — the button is only rendered with a preview present
  // and the draft is created before the preview is read at mount, but both are
  // nullable refs so neither is assumed.
  if (!api || previewDocument === null) {
    return;
  }
  applyPreviewToDraft(api, previewDocument);
}

/** Toggles the selected card in/out of the shared loadout draft (WP-279). */
function onToggleLoadout(): void {
  const api = loadoutDraftApi.value;
  const selected = selectedCard.value;
  if (!api || !selected) {
    return;
  }
  // why: all routing (which slot, add vs remove, the Always-Leads no-op) lives
  // in the shared helper — App.vue does not re-encode it.
  toggleCardInLoadout(api, selected);
}

// ── Floating loadout tray (WP-279 / D-24054) ─────────────────────────────────

// why: total composition picks across the two single slots + three group
// slots. Drives both the tray's show/hide gate and (indirectly) its summary.
const loadoutPickCount = computed<number>(() => {
  const api = loadoutDraftApi.value;
  if (!api) {
    return 0;
  }
  const composition = api.draft.value.composition;
  let count = 0;
  if (composition.schemeId) count += 1;
  if (composition.mastermindId) count += 1;
  count += composition.villainGroupIds.length;
  count += composition.henchmanGroupIds.length;
  count += composition.heroDeckIds.length;
  return count;
});

// why: SHOW ⟺ (picks > 0) AND (Loadout tab not active). On the Loadout tab the
// pill is redundant; on a blank draft there is nothing to summarize.
const showLoadoutTray = computed<boolean>(
  () => loadoutPickCount.value > 0 && activeView.value !== "loadout",
);

// why: the read-only summary the LoadoutTray renders — the two single slots as
// booleans, the three group slots as counts, and the live readiness issue
// count — `readinessIssueCount`, the same three-part predicate that gates the
// builder's export buttons, so the pill can never say "ready" while the
// Loadout tab is reporting a blocker. Falls back to an all-empty summary
// before the draft is instantiated.
const loadoutTraySummary = computed(() => {
  const api = loadoutDraftApi.value;
  if (!api) {
    return {
      schemeSet: false,
      mastermindSet: false,
      heroes: 0,
      villains: 0,
      henchmen: 0,
      issues: 0,
    };
  }
  const composition = api.draft.value.composition;
  return {
    schemeSet: composition.schemeId !== "",
    mastermindSet: composition.mastermindId !== "",
    heroes: composition.heroDeckIds.length,
    villains: composition.villainGroupIds.length,
    henchmen: composition.henchmanGroupIds.length,
    issues: api.readinessIssueCount.value,
  };
});
</script>

<template>
  <AppShell>
    <div class="app">
    <header class="header">
      <h1 class="logo">⚔️ <a class="logo-link" href="https://www.legendary-arena.com">Legendary Arena</a> <span class="sub">Registry Viewer</span></h1>
      <div class="header-actions">
        <ViewModeToggle v-if="!loading && !loadError" />
        <button v-if="!loading && !loadError" class="diag-btn" @click="glossary.toggle()" title="Open Rules Glossary (Ctrl+K)">
          📖 Glossary
        </button>
        <button v-if="!loading && !loadError" class="diag-btn" @click="showDiag = !showDiag">
          🔍 Diagnostics
        </button>
      </div>
    </header>

    <!-- Floating glossary toggle button (mobile only — bottom-right FAB) -->
    <button
      v-if="!loading && !loadError && !glossary.isOpen.value"
      class="floating-glossary-btn"
      @click="glossary.open()"
      title="Open Rules Glossary (Ctrl+K)"
      aria-label="Open Rules Glossary"
    >
      📖
    </button>

    <!-- Floating Loadout tray (WP-279) — bottom-left pill, shown once the
         shared draft has ≥1 pick and the Loadout tab is not active. Bottom-left
         keeps it clear of the bottom-right glossary FAB. -->
    <LoadoutTray
      v-if="!loading && !loadError && showLoadoutTray"
      :scheme-set="loadoutTraySummary.schemeSet"
      :mastermind-set="loadoutTraySummary.mastermindSet"
      :heroes="loadoutTraySummary.heroes"
      :villains="loadoutTraySummary.villains"
      :henchmen="loadoutTraySummary.henchmen"
      :issues="loadoutTraySummary.issues"
      @open="activeView = 'loadout'"
      @view-as-cards="navigateToLoadoutGallery"
    />

    <!-- Full-screen image lightbox (mounted once, opened from anywhere) -->
    <ImageLightbox />

    <div
      v-if="loading"
      class="status-screen"
      role="status"
      aria-live="polite"
      :aria-busy="loading"
    >
      <div class="spinner" aria-hidden="true">⏳</div>
      <p class="status-text">{{ loadStatus }}</p>
      <p class="status-hint">Connecting to images.legendary-arena.com…</p>
    </div>

    <div v-else-if="loadError" class="status-screen error">
      <div class="err-icon">❌</div>
      <p class="err-title">Failed to load registry</p>
      <pre class="err-detail">{{ loadError }}</pre>
    </div>

    <template v-else>
      <HealthPanel
        v-if="showDiag && healthReport"
        :report="healthReport"
        :info="registry!.info()"
        :debug-state="{
          searchText: searchText,
          filterSet: filterSet,
          filterHC: filterHC,
          selectedTypes: [...selectedTypes].sort(),
          selectedCardKey: selectedCard?.key ?? null,
          selectedThemeId: selectedTheme?.themeId ?? null,
          filteredCount: filteredCards.length,
          totalCount: allCards.length,
          glossaryOpen: glossary.isOpen.value,
          lightboxOpen: lightbox.isOpen.value,
        }"
        @close="showDiag = false"
      />

      <!-- ── View tabs ──────────────────────────────────────────────────────── -->
      <div class="view-tabs">
        <button class="view-tab" :class="{ active: activeView === 'cards' }" @click="activeView = 'cards'">
          🃏 Cards <span class="tab-count">{{ allCards.length }}</span>
        </button>
        <button class="view-tab" :class="{ active: activeView === 'themes' }" @click="activeView = 'themes'">
          🎭 Themes <span class="tab-count">{{ allThemes.length }}</span>
        </button>
        <!-- why: Loadout tab is additive authoring surface per WP-091; Cards
             and Themes tabs are unaffected. -->
        <button class="view-tab" :class="{ active: activeView === 'loadout' }" @click="activeView = 'loadout'">
          🧰 Loadout
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════════ -->
      <!-- ── THEMES VIEW (filter bar only) ───────────────────────────────────── -->
      <!-- ══════════════════════════════════════════════════════════════════════ -->
      <template v-if="activeView === 'themes'">
        <div class="filter-bar">
          <input v-model="themeSearchText" class="search" placeholder="Search themes by name, tag, hero…" @input="applyThemeFilters" />
          <ThemeSizeSlider />
          <span class="count">{{ filteredThemes.length }} themes</span>
        </div>
      </template>

      <!-- ══════════════════════════════════════════════════════════════════════ -->
      <!-- ── CARDS VIEW (filter bar + collapsible drawer) ────────────────────── -->
      <!-- ══════════════════════════════════════════════════════════════════════ -->
      <template v-if="activeView === 'cards'">

      <!-- ── Search bar (always visible) ────────────────────────────────────── -->
      <div class="filter-bar">
        <input v-model="searchText" class="search" placeholder="Search cards…" @input="applyFilters" />

        <button
          type="button"
          class="filter-drawer-toggle"
          :aria-expanded="filterDrawerOpen"
          @click="filterDrawerOpen = !filterDrawerOpen"
        >
          Filters
          <span v-if="!filterDrawerOpen && activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
          <span class="filter-caret">{{ filterDrawerOpen ? '▴' : '▾' }}</span>
        </button>

        <CardSizeSlider />

        <span class="count">{{ filteredCards.length }} cards</span>
      </div>

      <!-- ── Collapsible filter drawer ──────────────────────────────────────── -->
      <div class="filter-drawer" :class="{ open: filterDrawerOpen }">
        <div class="filter-drawer-inner">

          <!-- Unified filter dropdown row (WP-278 / EC-309). One shared
               FilterDropdown per filter; each hides itself when its taxonomy is
               empty (missing feed / not-yet-loaded). The contextual Patterns
               dropdown renders only when exactly one pattern-bearing card type is
               active (its items() is [] otherwise, so FilterDropdown self-hides). -->
          <div class="filter-dropdown-row">
            <FilterDropdown
              label="Set"
              mode="single"
              :items="setItems"
              v-model:selected="selectedSetValues"
              @update:selected="applyFilters"
            />
            <FilterDropdown
              label="Class"
              mode="single"
              :searchable="false"
              :items="classItems"
              v-model:selected="selectedClassValues"
              @update:selected="applyFilters"
            />
            <FilterDropdown
              label="Type"
              :items="typeItems"
              v-model:selected="selectedTypeGroupKeys"
              @update:selected="onTypeChange"
            />
            <FilterDropdown
              label="Mechanics"
              :items="mechanicItems"
              v-model:selected="selectedMechanicSlugs"
              @update:selected="applyFilters"
            />
            <FilterDropdown
              label="Effects"
              :items="effectItems"
              v-model:selected="selectedEffectSlugs"
              @update:selected="applyFilters"
            />
            <FilterDropdown
              :label="patternDropdownLabel"
              :items="patternItems"
              v-model:selected="selectedPatternSlugs"
              @update:selected="applyFilters"
            />
          </div>

        </div>
      </div>

      <!-- ── Loadout gallery banner (WP-288) ──────────────────────────────── -->
      <!-- why: presentation-only; rendered ONLY while the gallery mode is active.
           Its ✕ exits the mode and restores full browsing. Kept inline (not a
           new component) to hold the WP file budget. -->
      <div v-if="loadoutGalleryActive" class="loadout-gallery-banner" role="status">
        <span class="loadout-gallery-text">🖼 Viewing loadout — {{ filteredCards.length }} cards</span>
        <label
          v-if="loadoutSupportPoolCount > 0"
          class="loadout-gallery-support"
          :title="`Show the ${loadoutSupportPoolCount} bystander / wound / officer / sidekick cards named by this loadout's support pools`"
        >
          <input type="checkbox" v-model="loadoutGalleryIncludesSupport" @change="applyFilters" />
          Support cards ({{ loadoutSupportPoolCount }})
        </label>
        <button
          type="button"
          class="loadout-gallery-clear"
          @click="clearLoadoutGallery"
          title="Exit the loadout gallery and show all cards"
          aria-label="Exit the loadout gallery and show all cards"
        >✕</button>
      </div>

      </template><!-- end cards filter bar -->

      <!-- ── Main body (single flex row, shared across both views) ──────────── -->
      <!-- why: GlossaryPanel is rendered once here instead of duplicated in each
           view's body div. This eliminates DOM duplication and makes the resizable
           splitter work seamlessly across view switches. -->
      <div class="body">
        <GlossaryPanel :rulebook-pdf-url="rulebookPdfUrl" :rules-page-url="rulesPageUrl" />

        <!-- Themes content -->
        <template v-if="activeView === 'themes'">
          <ThemeGrid :themes="filteredThemes" :selected-id="selectedTheme?.themeId" @select="selectedTheme = $event" />
          <ThemeDetail v-if="selectedTheme" :theme="selectedTheme" @close="selectedTheme = null" @navigate-to-card="navigateToCard" />
        </template>

        <!-- Cards content -->
        <template v-if="activeView === 'cards'">
          <CardGrid
            :cards="filteredCards"
            :selected-key="selectedCard?.key"
            :twist-patterns="twistPatterns"
            :hero-patterns="heroPatterns"
            :villain-patterns="villainPatterns"
            :henchman-patterns="henchmanPatterns"
            :mastermind-patterns="mastermindPatterns"
            @select="selectedCard = $event"
            @clear-filters="clearAllFilters"
          />
          <CardDetail
            v-if="selectedCard"
            :card="selectedCard"
            :view-mode="cardViewMode"
            :in-loadout="selectedCardInLoadout"
            :twist-patterns="twistPatterns"
            :hero-patterns="heroPatterns"
            :villain-patterns="villainPatterns"
            :henchman-patterns="henchmanPatterns"
            :mastermind-patterns="mastermindPatterns"
            @close="selectedCard = null"
            @toggle-loadout="onToggleLoadout"
          />
        </template>

        <!-- Loadout content -->
        <template v-if="activeView === 'loadout' && registry">
          <div class="loadout-tab-stack">
            <!-- why: WP-362 — a bad/decode-failed `?lagn=` link still opens the
                 Loadout tab and explains itself here (never a silent blank
                 builder). Dismissible; absent when the link was valid or none. -->
            <div
              v-if="lagnUrlErrors.length > 0"
              class="lagn-url-error"
              role="alert"
              data-testid="lagn-url-error"
            >
              <strong>This loadout link couldn't be opened.</strong>
              <ul class="lagn-url-error-list">
                <li v-for="(lagnError, index) in lagnUrlErrors" :key="index">{{ lagnError }}</li>
              </ul>
              <button
                type="button"
                class="lagn-url-error-dismiss"
                @click="lagnUrlErrors = []"
              >
                Dismiss
              </button>
            </div>
            <LoadoutPreview
              :hasUrlParams="setupHasUrlParams"
              :previewDocument="setupPreviewDocument"
              :validationErrors="setupValidationErrors"
              :matchedCount="setupMatchedCount"
              :parsedParams="setupParsedParams"
              :registry="registry!"
              @edit="onPromotePreviewToDraft"
            />
            <LoadoutBuilder
              :registry="registry!"
              :themes="allThemes"
              :draft-api="loadoutDraftApi!"
              :imported-lagn-result="importedLagnResult"
              @view-as-cards="navigateToLoadoutGallery"
            />
          </div>
        </template>
      </div>
    </template>
    </div>
  </AppShell>
</template>

<style scoped>
/* why: WP-007b mount-layout — .app is now a flex child of
   <AppShell>'s main slot. flex: 1 + min-height: 0 (vs the prior
   height: 100vh) lets the shell's BrandHeader and BrandFooter
   consume the viewport edges while .app fills the remainder. */
.app { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; background: var(--la-color-bg-primary); color: var(--la-color-text-primary); }

.header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.25rem; background: #1a1a24; border-bottom: 1px solid #2e2e42; flex-shrink: 0; }
.logo  { margin: 0; font-size: 1.1rem; font-weight: 700; color: #fff; }
.logo-link { color: inherit; text-decoration: none; }
.logo-link:hover, .logo-link:focus-visible { color: var(--la-color-cta, #6aa6ff); text-decoration: underline; }
.sub   { font-weight: 400; color: #8888aa; font-size: 0.85rem; margin-left: 0.5rem; }
.header-actions { display: flex; gap: 0.5rem; align-items: center; }
.diag-btn { background: #2a2a3a; border: 1px solid #3e3e56; color: #c8c8e0; padding: 0.4rem 0.9rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-family: inherit; }
.diag-btn:hover { background: #35354a; }

/* ── Floating glossary button (mobile-focused) ─────────────────────────── */
.floating-glossary-btn {
  position: fixed;
  bottom: 1.25rem;
  right: 1.25rem;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #2a2a5a;
  border: 2px solid #7070e0;
  color: #fff;
  font-size: 1.3rem;
  cursor: pointer;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transition: transform 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.floating-glossary-btn:hover {
  background: #3a3a7a;
  transform: scale(1.05);
}
/* Hide the floating button on desktop — the header button is sufficient */
@media (min-width: 1024px) {
  .floating-glossary-btn { display: none; }
}

.status-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 2rem; }
.spinner { font-size: 2.5rem; animation: spin 1.5s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.status-text { font-size: 1.1rem; color: #c8c8e0; font-weight: 600; margin: 0; }
.status-hint { font-size: 0.85rem; color: #6666aa; margin: 0; }
.status-screen.error { background: #130a0a; }
.err-icon  { font-size: 2.5rem; }
.err-title { font-size: 1.2rem; font-weight: 700; color: #f87171; margin: 0; }
.err-detail { background: #1a0808; border: 1px solid #4a1010; border-radius: 8px; padding: 1rem; color: #fca5a5; font-size: 0.8rem; max-width: 600px; white-space: pre-wrap; word-break: break-all; margin: 0; }

.filter-bar { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 1.25rem; background: #15151e; border-bottom: 1px solid #22222e; flex-shrink: 0; flex-wrap: wrap; }
.search { flex: 1; min-width: 160px; padding: 0.4rem 0.75rem; background: #22222e; border: 1px solid #33334a; border-radius: 6px; color: #e8e8ee; font-size: 0.9rem; }
.search:focus { outline: none; border-color: #6060c0; }
.count { color: #6666aa; font-size: 0.8rem; margin-left: auto; white-space: nowrap; }

/* ── Loadout gallery banner (WP-288) ─────────────────────────────────────── */
.loadout-gallery-support {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: #a8a8e8;
  cursor: pointer;
  user-select: none;
}
.loadout-gallery-support input { cursor: pointer; }

.loadout-gallery-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 1.25rem;
  background: #1f1f3a;
  border-bottom: 1px solid #3a3a7a;
  color: #c0c0ff;
  font-size: 0.85rem;
  font-weight: 600;
  flex-shrink: 0;
}
.loadout-gallery-text { flex: 1; }
.loadout-gallery-clear {
  background: none;
  border: 1px solid #44445a;
  color: #c0c0ff;
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-family: inherit;
}
.loadout-gallery-clear:hover { background: #2a2a5a; border-color: #7070e0; color: #fff; }

/* ── Filter drawer toggle button ─────────────────────────────────────────── */
.filter-drawer-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #2a2a3a;
  border: 1px solid #3e3e56;
  color: #c8c8e0;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}
.filter-drawer-toggle:hover { background: #35354a; }
.filter-badge {
  background: #7070e0;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  min-width: 1.1em;
  height: 1.1em;
  line-height: 1.1em;
  text-align: center;
  border-radius: 9px;
  padding: 0 0.3rem;
}
.filter-caret { font-size: 0.7rem; }

/* ── Collapsible filter drawer ───────────────────────────────────────────── */
.filter-drawer {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.2s ease;
  flex-shrink: 0;
  background: #12121a;
  border-bottom: 1px solid transparent;
}
.filter-drawer.open {
  max-height: 500px;
  border-bottom-color: #22222e;
}
.filter-drawer-inner {
  display: flex;
  flex-direction: column;
}
/* ── Unified filter dropdown row (WP-278) ────────────────────────────────── */
.filter-dropdown-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  row-gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  flex-wrap: wrap;
}

/* ── View tabs ──────────────────────────────────────────────────────────── */
.view-tabs {
  display: flex;
  gap: 0;
  background: #1a1a24;
  border-bottom: 1px solid #2e2e42;
  flex-shrink: 0;
}
.view-tab {
  flex: 1;
  background: #15151e;
  border: none;
  border-bottom: 2px solid transparent;
  color: #6666aa;
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.view-tab:hover { background: #1e1e2e; color: #9999dd; }
.view-tab.active { background: #1a1a24; border-bottom-color: #7070e0; color: #c0c0ff; }
.tab-count { font-size: 0.7rem; color: #44445a; margin-left: 0.35rem; font-weight: 400; }
.view-tab.active .tab-count { color: #7070e0; }

.body { display: flex; flex: 1; overflow: hidden; }

/* WP-114: stack LoadoutPreview above LoadoutBuilder inside the Loadout tab */
.loadout-tab-stack { display: flex; flex-direction: column; flex: 1; overflow: auto; }

/* why: WP-362 — the `?lagn=` deep-link decode/validation error banner. */
.lagn-url-error {
  margin: 0 0 0.75rem 0;
  padding: 0.75rem 1rem;
  border: 1px solid #b91c1c;
  border-radius: 6px;
  background: #2a1214;
  color: #fca5a5;
  font-size: 0.9rem;
}
.lagn-url-error-list { margin: 0.4rem 0 0.5rem 1.1rem; padding: 0; }
.lagn-url-error-dismiss {
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  color: #fca5a5;
  background: transparent;
  border: 1px solid #b91c1c;
  border-radius: 4px;
  cursor: pointer;
}
.lagn-url-error-dismiss:hover { background: #3a1a1c; }

/* ── Compact mode for short viewports ────────────────────────────────────── */
@media (max-height: 800px) {
  .header { padding-block: 0.4rem; }
  .logo { font-size: 0.95rem; }
  .view-tab { padding: 0.35rem 0.75rem; }
  .filter-bar { padding-block: 0.4rem; }
  .filter-dropdown-row { padding-block: 0.4rem; }
}
</style>
