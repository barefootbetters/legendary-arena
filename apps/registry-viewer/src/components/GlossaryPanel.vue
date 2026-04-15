<script setup lang="ts">
import { computed } from "vue";
import { useGlossary } from "../composables/useGlossary";
import type { GlossaryEntry } from "../composables/useGlossary";

const {
  isOpen,
  searchQuery,
  highlightedId,
  filteredEntries,
  close,
  scrollToEntry,
} = useGlossary();

// ── Grouped entries for rendering ───────────────────────────────────────────

interface EntryGroup {
  title: string;
  entries: GlossaryEntry[];
}

const groupedEntries = computed<EntryGroup[]>(() => {
  const rules: GlossaryEntry[]      = [];
  const keywords: GlossaryEntry[]   = [];
  const heroClasses: GlossaryEntry[] = [];

  for (const entry of filteredEntries.value) {
    if (entry.type === "rule") rules.push(entry);
    else if (entry.type === "keyword") keywords.push(entry);
    else heroClasses.push(entry);
  }

  const groups: EntryGroup[] = [];
  if (rules.length > 0) groups.push({ title: "Rules", entries: rules });
  if (keywords.length > 0) groups.push({ title: "Keywords", entries: keywords });
  if (heroClasses.length > 0) groups.push({ title: "Hero Classes", entries: heroClasses });
  return groups;
});

const totalCount = computed(() => filteredEntries.value.length);

function handleEntryClick(entry: GlossaryEntry) {
  scrollToEntry(entry.id);
}
</script>

<template>
  <!-- Backdrop (mobile only, click to close) -->
  <div
    v-if="isOpen"
    class="glossary-backdrop"
    @click="close"
  ></div>

  <aside
    v-if="isOpen"
    class="glossary-panel"
    role="complementary"
    aria-label="Rules Glossary"
  >
    <div class="glossary-header">
      <div class="header-title">
        <span class="title-icon">📖</span>
        <h2>Rules Glossary</h2>
        <span class="count">{{ totalCount }}</span>
      </div>
      <button class="close-btn" @click="close" aria-label="Close glossary">✕</button>
    </div>

    <div class="glossary-search">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search rules, keywords, classes…"
        class="search-input"
      />
      <button
        v-if="searchQuery"
        class="clear-search"
        @click="searchQuery = ''"
        aria-label="Clear search"
      >✕</button>
    </div>

    <div class="glossary-content">
      <div v-if="totalCount === 0" class="empty-state">
        No entries match "{{ searchQuery }}".
      </div>

      <div v-for="group in groupedEntries" :key="group.title" class="group">
        <div class="group-title">{{ group.title }} ({{ group.entries.length }})</div>
        <ul class="entry-list">
          <li
            v-for="entry in group.entries"
            :key="entry.id"
            :id="entry.id"
            class="entry"
            :class="{ highlighted: entry.id === highlightedId }"
            @click="handleEntryClick(entry)"
          >
            <div class="entry-label">{{ entry.label }}</div>
            <div class="entry-description">{{ entry.description }}</div>
          </li>
        </ul>
      </div>
    </div>

    <div class="glossary-footer">
      <span class="shortcut-hint">Press <kbd>Esc</kbd> to close · <kbd>Ctrl</kbd>+<kbd>K</kbd> to toggle</span>
    </div>
  </aside>
</template>

<style scoped>
/* ── Backdrop (mobile only) ────────────────────────────────────────────── */
.glossary-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
  animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@media (min-width: 1024px) {
  .glossary-backdrop { display: none; }
}

/* ── Panel base (desktop: left flex sibling, pushes content) ──────────── */
.glossary-panel {
  width: 360px;
  flex-shrink: 0;
  background: #1a1a24;
  border-right: 1px solid #2e2e42;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideInFromLeft 0.2s ease-out;
}
@keyframes slideInFromLeft {
  from { width: 0; opacity: 0; }
  to   { width: 360px; opacity: 1; }
}

/* ── Mobile: bottom sheet overlay ──────────────────────────────────────── */
@media (max-width: 1023px) {
  .glossary-panel {
    position: fixed;
    top: auto;
    right: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    max-height: 85vh;
    border-right: none;
    border-top: 1px solid #2e2e42;
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);
    z-index: 999;
    animation: slideUpFromBottom 0.25s ease-out;
  }
  @keyframes slideUpFromBottom {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
}

/* ── Header ────────────────────────────────────────────────────────────── */
.glossary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1rem;
  background: #22222e;
  border-bottom: 1px solid #2e2e42;
  flex-shrink: 0;
}
.header-title { display: flex; align-items: center; gap: 0.5rem; }
.title-icon { font-size: 1.1rem; }
.glossary-header h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #e8e8ee;
}
.count {
  font-size: 0.7rem;
  color: #7070e0;
  background: #2a2a5a;
  border-radius: 10px;
  padding: 0.1rem 0.5rem;
  font-weight: 600;
}
.close-btn {
  background: none;
  border: none;
  color: #6666aa;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}
.close-btn:hover { background: #2a2a3a; color: #e8e8ee; }

/* ── Search ────────────────────────────────────────────────────────────── */
.glossary-search {
  position: relative;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #22222e;
  flex-shrink: 0;
}
.search-input {
  width: 100%;
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  background: #12121a;
  border: 1px solid #33334a;
  border-radius: 6px;
  color: #e8e8ee;
  font-size: 0.85rem;
  box-sizing: border-box;
}
.search-input:focus { outline: none; border-color: #6060c0; }
.search-input::placeholder { color: #55556a; }
.clear-search {
  position: absolute;
  right: 1.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6666aa;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
}
.clear-search:hover { color: #e8e8ee; }

/* ── Content ───────────────────────────────────────────────────────────── */
.glossary-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}
.empty-state {
  text-align: center;
  color: #55556a;
  padding: 2rem 1rem;
  font-size: 0.85rem;
}

.group { margin-bottom: 0.5rem; }
.group-title {
  position: sticky;
  top: 0;
  background: #1a1a24;
  padding: 0.5rem 1rem;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6666aa;
  font-weight: 700;
  border-bottom: 1px solid #22222e;
  z-index: 1;
}

.entry-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.entry {
  padding: 0.65rem 1rem;
  border-bottom: 1px solid #22222e;
  cursor: pointer;
  transition: background 0.1s;
}
.entry:hover { background: #22222e; }
.entry.highlighted {
  background: #2a2a5a;
  border-left: 3px solid #7070e0;
  padding-left: calc(1rem - 3px);
  animation: highlight-pulse 0.6s ease-out;
}
@keyframes highlight-pulse {
  0%   { background: #3a3a7a; }
  100% { background: #2a2a5a; }
}
.entry-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: #f0c040;
  margin-bottom: 0.25rem;
}
.entry-description {
  font-size: 0.78rem;
  color: #c8c8e0;
  line-height: 1.5;
}

/* ── Footer ────────────────────────────────────────────────────────────── */
.glossary-footer {
  padding: 0.5rem 1rem;
  border-top: 1px solid #22222e;
  background: #15151e;
  flex-shrink: 0;
}
.shortcut-hint {
  font-size: 0.68rem;
  color: #55556a;
}
kbd {
  background: #2a2a3a;
  border: 1px solid #3e3e56;
  border-radius: 3px;
  padding: 0.1rem 0.35rem;
  font-size: 0.65rem;
  font-family: inherit;
  color: #c8c8e0;
}
</style>
