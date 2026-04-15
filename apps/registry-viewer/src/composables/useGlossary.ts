/**
 * useGlossary.ts
 * Shared state for the persistent Rules Glossary panel.
 *
 * The panel displays all rules, keywords, and hero classes from useRules.ts
 * as a searchable, scrollable list. Keywords and rule tokens in ability text
 * are clickable and open the panel scrolled to the matching entry.
 */

import { ref, computed } from "vue";
import {
  RULES_GLOSSARY,
  KEYWORD_GLOSSARY,
  HERO_CLASS_GLOSSARY,
  lookupKeyword,
  lookupRule,
} from "./useRules";

// ── Entry type ──────────────────────────────────────────────────────────────

export type GlossaryEntryType = "rule" | "keyword" | "heroClass";

export interface GlossaryEntry {
  id:          string;          // unique DOM id for scrolling (e.g. "rule-shards")
  type:        GlossaryEntryType;
  key:         string;          // lookup key (e.g. "shards", "berserk")
  label:       string;          // display label (e.g. "Shards", "Berserk")
  description: string;          // full definition text
}

// ── Build the unified entry list from the three glossary maps ───────────────

function buildAllEntries(): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];

  for (const [key, ruleEntry] of RULES_GLOSSARY) {
    entries.push({
      id:          `rule-${key}`,
      type:        "rule",
      key,
      label:       ruleEntry.label,
      description: ruleEntry.summary,
    });
  }

  for (const [key, description] of KEYWORD_GLOSSARY) {
    // why: some keywords appear twice in the map (villainousweapons). Skip duplicates.
    if (entries.some((existingEntry) => existingEntry.id === `keyword-${key}`)) {
      continue;
    }
    entries.push({
      id:          `keyword-${key}`,
      type:        "keyword",
      key,
      label:       titleCase(key),
      description,
    });
  }

  for (const [key, description] of HERO_CLASS_GLOSSARY) {
    entries.push({
      id:          `heroClass-${key}`,
      type:        "heroClass",
      key,
      label:       titleCase(key),
      description,
    });
  }

  // why: alphabetical order within each type makes the panel predictable to scan
  entries.sort((a, b) => {
    if (a.type !== b.type) {
      // Rules first, then Keywords, then Hero Classes
      const order = { rule: 0, keyword: 1, heroClass: 2 };
      return order[a.type] - order[b.type];
    }
    return a.label.localeCompare(b.label);
  });

  return entries;
}

/**
 * Converts a lowercase key like "darkmemories" or "wall-crawl" into Title Case.
 * why: glossary keys are stored lowercase and collapsed for matching; we need
 * a human-readable label for display.
 */
function titleCase(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ── Shared reactive state (module-scoped singleton) ─────────────────────────

const isOpen        = ref<boolean>(false);
const searchQuery   = ref<string>("");
const highlightedId = ref<string | null>(null);
const allEntries    = buildAllEntries();

/** The filtered entry list based on the current search query. */
const filteredEntries = computed<GlossaryEntry[]>(() => {
  const needle = searchQuery.value.toLowerCase().trim();
  if (!needle) return allEntries;
  return allEntries.filter((entry) => {
    return entry.label.toLowerCase().includes(needle)
      || entry.description.toLowerCase().includes(needle)
      || entry.key.includes(needle);
  });
});

// ── Public composable API ───────────────────────────────────────────────────

export function useGlossary() {
  return {
    isOpen,
    searchQuery,
    highlightedId,
    allEntries,
    filteredEntries,
    open,
    close,
    toggle,
    openToKeyword,
    openToRule,
    scrollToEntry,
  };
}

function open(): void {
  isOpen.value = true;
}

function close(): void {
  isOpen.value = false;
  highlightedId.value = null;
}

function toggle(): void {
  if (isOpen.value) close();
  else open();
}

/**
 * Opens the panel and scrolls to the matching keyword entry.
 * Uses lookupKeyword() to handle parameterized forms like "Focus 2" or "Patrol the Bank".
 */
function openToKeyword(keywordName: string): void {
  // why: ensure the matching entry is resolvable before opening, otherwise
  // the user sees a panel with no highlight and wonders what happened
  const definition = lookupKeyword(keywordName);
  if (!definition) return;

  // Find the glossary key that matched (lookupKeyword already did fuzzy matching)
  // We need to find which entry has this description to get its id
  const matchingEntry = allEntries.find(
    (entry) => entry.type === "keyword" && entry.description === definition,
  );
  if (!matchingEntry) return;

  isOpen.value = true;
  searchQuery.value = "";
  highlightedId.value = matchingEntry.id;
  scrollToEntry(matchingEntry.id);
}

/**
 * Opens the panel and scrolls to the matching rule entry.
 */
function openToRule(ruleCode: string): void {
  const ruleEntry = lookupRule(ruleCode);
  if (!ruleEntry) return;

  const matchingEntry = allEntries.find(
    (entry) => entry.type === "rule"
      && entry.label === ruleEntry.label
      && entry.description === ruleEntry.summary,
  );
  if (!matchingEntry) return;

  isOpen.value = true;
  searchQuery.value = "";
  highlightedId.value = matchingEntry.id;
  scrollToEntry(matchingEntry.id);
}

/**
 * Scrolls the panel content to the entry with the given id.
 * why: uses requestAnimationFrame + a short timeout to wait for the panel to
 * finish its open transition before scrolling, otherwise the scroll math is off.
 */
function scrollToEntry(entryId: string): void {
  highlightedId.value = entryId;
  requestAnimationFrame(() => {
    setTimeout(() => {
      const element = document.getElementById(entryId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 250);
  });
}
