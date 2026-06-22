<script setup lang="ts">
/**
 * FilterDropdown — the registry viewer's shared filter control (WP-278 / EC-309,
 * D-24053). A toggle button opens a `position: fixed` popover with an optional
 * search box and a scrollable checkbox list. It is the single control behind
 * every header filter — Set, Class, Type, Mechanics, Effects, and the contextual
 * Patterns dropdown — replacing the WP-125/183/184 pill ribbons and folding in
 * the WP-270/276 mechanic dropdown.
 *
 * Purely presentational: items flow in via the `items` prop, the selection flows
 * out via `update:selected` (v-model `Set<string>`). The component does no
 * fetching and owns no taxonomy. It renders nothing when `items` is empty, so a
 * missing taxonomy or an empty contextual list hides the control (the card grid
 * stays functional).
 *
 * Modes: `multi` (default) toggles values and keeps the popover open; `single`
 * (Set/Class) replaces the selection with the picked value and closes. The
 * caller supplies `items` already in display order (label for Type/Mechanics,
 * `order` for Effects/Patterns); the component preserves that order and only
 * filters it by the search text.
 *
 * The popover is `position: fixed`, anchored to the toggle button, so it escapes
 * the filter drawer's `overflow: hidden` clip; it closes on outside-click,
 * Escape, or a genuine outside scroll/resize — but NOT when the user scrolls the
 * list itself (the WP-277 scroll-origin guard).
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from "vue";

export interface FilterDropdownItem {
  value:  string;
  label:  string;
  count?: number;
  emoji?: string;
  title?: string;
}

const props = withDefaults(
  defineProps<{
    label:       string;
    items:       readonly FilterDropdownItem[];
    mode?:       "single" | "multi";
    searchable?: boolean;
    emptyLabel?: string;
  }>(),
  {
    mode:       "multi",
    searchable: true,
    emptyLabel: "",
  },
);

const selected = defineModel<Set<string>>("selected", { required: true });

const isOpen = ref(false);
const searchText = ref("");
const rootEl = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const popoverStyle = ref<Record<string, string>>({});

// why: preserve the caller's item order (they pre-sort by label or `order`);
// the dropdown only narrows that order by the search text, never re-sorts.
const filteredItems = computed(() => {
  const needle = searchText.value.trim().toLowerCase();
  if (!needle) return props.items;
  return props.items.filter(
    (item) =>
      item.label.toLowerCase().includes(needle) ||
      item.value.toLowerCase().includes(needle),
  );
});

const selectedCount = computed(() => selected.value.size);

const toggleText = computed(() => {
  if (selectedCount.value === 0) {
    return props.emptyLabel || `Any ${props.label.toLowerCase()}`;
  }
  if (props.mode === "single") {
    const onlyValue = [...selected.value][0];
    const match = props.items.find((item) => item.value === onlyValue);
    return match ? match.label : `Any ${props.label.toLowerCase()}`;
  }
  return `${selectedCount.value} selected`;
});

function isSelected(value: string): boolean {
  return selected.value.has(value);
}

function toggleValue(value: string): void {
  const next = new Set(selected.value);
  if (props.mode === "single") {
    // why: single-select replaces the selection with the picked value (or
    // clears it when re-picked) and closes — Set/Class allow only one value.
    if (next.has(value)) {
      next.clear();
    } else {
      next.clear();
      next.add(value);
    }
    selected.value = next;
    closeDropdown();
    return;
  }
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  selected.value = next;
}

function clearAll(): void {
  if (selected.value.size === 0) return;
  selected.value = new Set();
}

// why: the popover is position:fixed so it escapes the filter drawer's
// overflow:hidden clip; re-anchor it to the toggle button each time it opens.
function positionPopover(): void {
  const toggleButton = rootEl.value?.querySelector(".filter-dropdown-toggle");
  if (!toggleButton) return;
  const rect = toggleButton.getBoundingClientRect();
  popoverStyle.value = {
    top:      `${Math.round(rect.bottom + 4)}px`,
    left:     `${Math.round(rect.left)}px`,
    minWidth: `${Math.round(rect.width)}px`,
  };
}

function openDropdown(): void {
  positionPopover();
  isOpen.value = true;
}

function closeDropdown(): void {
  isOpen.value = false;
  searchText.value = "";
}

function toggleDropdown(): void {
  if (isOpen.value) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function onDocumentMouseDown(event: MouseEvent): void {
  if (!isOpen.value) return;
  const target = event.target as Node | null;
  // why: the popover is a DOM descendant of rootEl (only its painting is
  // detached via position:fixed), so one contains() check covers the toggle
  // button and the popover; anything else is an outside click.
  if (rootEl.value && target && !rootEl.value.contains(target)) {
    closeDropdown();
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && isOpen.value) {
    closeDropdown();
  }
}

// why: a fixed-positioned popover drifts from its anchor when the page/drawer
// scrolls or the viewport resizes, so close it. BUT a capture-phase window
// 'scroll' listener also receives scroll events from descendant scroll
// containers — without this guard, scrolling the popover's own list (wheel /
// scrollbar / keyboard auto-scroll) would fire this and instantly close the
// dropdown, making the list look unscrollable (the WP-277 bug). Ignore scrolls
// that originate inside the popover; only an outside scroll (or a resize, whose
// target is the non-Node window) closes it.
function onViewportChange(event: Event): void {
  if (!isOpen.value) return;
  const target = event.target;
  if (target instanceof Node && rootEl.value?.contains(target)) return;
  closeDropdown();
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    if (props.searchable) nextTick(() => searchInput.value?.focus());
  } else {
    document.removeEventListener("mousedown", onDocumentMouseDown);
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocumentMouseDown);
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("scroll", onViewportChange, true);
  window.removeEventListener("resize", onViewportChange);
});
</script>

<template>
  <div v-if="items.length > 0" ref="rootEl" class="filter-dropdown">
    <span class="filter-dropdown-label">{{ label }}:</span>
    <button
      type="button"
      class="filter-dropdown-toggle"
      :class="{ active: selectedCount > 0 }"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      @click="toggleDropdown"
    >
      <span class="filter-dropdown-toggle-text">{{ toggleText }}</span>
      <span class="filter-dropdown-caret">{{ isOpen ? "▴" : "▾" }}</span>
    </button>
    <button
      v-if="selectedCount > 0"
      type="button"
      class="filter-dropdown-clear"
      @click="clearAll"
    >✕ clear</button>

    <div
      v-if="isOpen"
      class="filter-dropdown-popover"
      :style="popoverStyle"
      role="group"
      :aria-label="`Filter by ${label}`"
    >
      <input
        v-if="searchable"
        ref="searchInput"
        v-model="searchText"
        type="text"
        class="filter-dropdown-search"
        :placeholder="`Search ${label.toLowerCase()}…`"
        :aria-label="`Search ${label}`"
      />
      <ul class="filter-dropdown-list">
        <li v-if="filteredItems.length === 0" class="filter-dropdown-empty">
          No {{ label.toLowerCase() }} match “{{ searchText }}”.
        </li>
        <li v-for="item in filteredItems" :key="item.value">
          <label
            class="filter-dropdown-option"
            :class="{ active: isSelected(item.value) }"
            :title="item.title"
          >
            <input
              :type="mode === 'single' ? 'radio' : 'checkbox'"
              :checked="isSelected(item.value)"
              @change="toggleValue(item.value)"
            />
            <span v-if="item.emoji" class="filter-dropdown-emoji">{{ item.emoji }}</span>
            <span class="filter-dropdown-option-label">{{ item.label }}</span>
            <span
              v-if="item.count !== undefined"
              class="filter-dropdown-option-count"
            >{{ item.count }}</span>
          </label>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.filter-dropdown {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}
.filter-dropdown-label {
  font-size: 0.65rem;
  color: #44445a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.filter-dropdown-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #1e1e2e;
  border: 1.5px solid #33334a;
  color: #8888cc;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  max-width: 220px;
}
.filter-dropdown-toggle:hover {
  background: #2a2a3e;
  color: #c8c8ee;
  border-color: #5555aa;
}
.filter-dropdown-toggle.active {
  background: #2a2a5a;
  border-color: #7070e0;
  color: #c0c0ff;
  font-weight: 700;
}
.filter-dropdown-toggle-text {
  overflow: hidden;
  text-overflow: ellipsis;
}
.filter-dropdown-caret {
  font-size: 0.7rem;
  flex-shrink: 0;
}
.filter-dropdown-clear {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 0.72rem;
  color: #6666aa;
  cursor: pointer;
}
.filter-dropdown-clear:hover {
  color: #f87171;
}

/* why: position:fixed so the panel escapes the filter drawer's overflow:hidden
   clip; top/left/min-width come from the toggle button's rect (inline style). */
.filter-dropdown-popover {
  position: fixed;
  z-index: 200;
  width: 260px;
  max-width: 360px;
  background: #15151e;
  border: 1px solid #3e3e56;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.filter-dropdown-search {
  width: 100%;
  box-sizing: border-box;
  padding: 0.4rem 0.6rem;
  background: #22222e;
  border: 1px solid #33334a;
  border-radius: 6px;
  color: #e8e8ee;
  font-size: 0.82rem;
  font-family: inherit;
}
.filter-dropdown-search:focus {
  outline: none;
  border-color: #6060c0;
}
.filter-dropdown-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 300px;
  overflow-y: auto;
}
.filter-dropdown-empty {
  color: #66669a;
  font-size: 0.78rem;
  padding: 0.4rem 0.3rem;
}
.filter-dropdown-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.35rem;
  border-radius: 5px;
  cursor: pointer;
  color: #b8b8d8;
  font-size: 0.82rem;
}
.filter-dropdown-option:hover {
  background: #22223a;
}
.filter-dropdown-option.active {
  color: #c0c0ff;
  font-weight: 600;
}
.filter-dropdown-option input {
  cursor: pointer;
  accent-color: #7070e0;
  flex-shrink: 0;
}
.filter-dropdown-emoji {
  font-size: 0.9rem;
  line-height: 1;
  flex-shrink: 0;
}
.filter-dropdown-option-label {
  flex: 1;
  line-height: 1.2;
}
.filter-dropdown-option-count {
  background: #0f0f13;
  border: 1px solid #2a2a38;
  color: #66669a;
  border-radius: 10px;
  padding: 0.05rem 0.4rem;
  font-size: 0.66rem;
  font-weight: 600;
  line-height: 1.2;
  flex-shrink: 0;
}
</style>
