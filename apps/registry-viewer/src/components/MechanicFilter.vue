<script setup lang="ts">
/**
 * MechanicFilter — Searchable multi-select dropdown for the registry viewer's
 * hero-mechanic taxonomy (WP-276 / EC-307; supersedes the WP-270 chip ribbon),
 * fed by `card-mechanics.json` (WP-269).
 *
 * Purely presentational: mechanics flow in via the `mechanics` prop, the
 * selection flows out via `update:selectedMechanicSlugs` (v-model). The
 * component performs no fetching of its own and imports no client. The v-model
 * contract is unchanged from the WP-270 ribbon, so App.vue's wiring is untouched.
 *
 * Surfaces ALL mechanics (WP-276 / D-24052): the WP-270 ribbon rendered only
 * `hidden !== true` entries, but ~134 mechanics overflow a pill ribbon, so this
 * dropdown lists every mechanic in a scrolling panel with an in-panel search
 * box. This deliberately supersedes WP-270 AC-7's hidden-by-default UI gate —
 * the feed still carries `hidden` for the producer's diagnostics, but the viewer
 * no longer uses it to suppress entries.
 *
 * Multi-select: each row is a checkbox. Selecting several mechanics is OR-within
 * (App.vue's predicate matches a card with ANY selected mechanic), AND-with the
 * text query + other filters (App.vue composes after applyQuery()).
 *
 * The popover is `position: fixed`, anchored to the toggle button each time it
 * opens, so it escapes the filter drawer's `overflow: hidden` clip; it closes on
 * outside-click, Escape, or any viewport scroll/resize.
 *
 * Degraded-mode invisibility: when the feed carries no mechanics (empty or
 * invalid feed) the whole control is omitted via `v-if`; the card view stays
 * fully functional.
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from "vue";
import type { CardMechanicEntry } from "@legendary-arena/registry/schema";

const props = defineProps<{
  mechanics: readonly CardMechanicEntry[];
}>();

const selectedMechanicSlugs = defineModel<Set<string>>("selectedMechanicSlugs", {
  required: true,
});

const isOpen = ref(false);
const searchText = ref("");
const rootEl = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const popoverStyle = ref<Record<string, string>>({});

// why: list every mechanic (WP-276) sorted by label — the feed carries no
// display-order field. The WP-270 `hidden !== true` suppression is intentionally
// dropped here; ~134 mechanics live in a searchable scrolling panel, not pills.
const sortedMechanics = computed(() =>
  props.mechanics.slice().sort((a, b) => a.label.localeCompare(b.label)),
);

const filteredMechanics = computed(() => {
  const needle = searchText.value.trim().toLowerCase();
  if (!needle) return sortedMechanics.value;
  return sortedMechanics.value.filter(
    (mechanic) =>
      mechanic.label.toLowerCase().includes(needle) ||
      mechanic.slug.toLowerCase().includes(needle),
  );
});

const selectedCount = computed(() => selectedMechanicSlugs.value.size);

function isSelected(slug: string): boolean {
  return selectedMechanicSlugs.value.has(slug);
}

function toggleMechanic(slug: string): void {
  const next = new Set(selectedMechanicSlugs.value);
  if (next.has(slug)) {
    next.delete(slug);
  } else {
    next.add(slug);
  }
  selectedMechanicSlugs.value = next;
}

function clearAll(): void {
  if (selectedMechanicSlugs.value.size === 0) return;
  selectedMechanicSlugs.value = new Set();
}

// why: the popover is position:fixed so it escapes the filter drawer's
// overflow:hidden clip; re-anchor it to the toggle button each time it opens.
function positionPopover(): void {
  const toggleButton = rootEl.value?.querySelector(".mechanic-dropdown-toggle");
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
  // detached via position:fixed), so a single contains() check covers both the
  // toggle button and the popover; anything else is an outside click.
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
// scrolls or the viewport resizes; close it rather than chase the button.
function onViewportChange(event: Event): void {
  if (!isOpen.value) return;
  // why: a capture-phase window 'scroll' listener ALSO receives scroll events
  // from descendant scroll containers, so the popover's own list scroll
  // (mouse wheel / scrollbar drag / keyboard auto-scroll) would otherwise fire
  // this and instantly close the dropdown — making the list look unscrollable.
  // Ignore scrolls that originate inside the popover; only a genuine outside
  // page/drawer scroll (or a resize, whose target is the non-Node window)
  // closes it. The list then scrolls normally.
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
    nextTick(() => searchInput.value?.focus());
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
  <div v-if="mechanics.length > 0" ref="rootEl" class="mechanic-filter">
    <span class="mechanic-filter-label">Mechanics:</span>
    <button
      type="button"
      class="mechanic-dropdown-toggle"
      :class="{ active: selectedCount > 0 }"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      @click="toggleDropdown"
    >
      <span class="mechanic-toggle-text">{{
        selectedCount > 0 ? `${selectedCount} selected` : "Any mechanic"
      }}</span>
      <span class="mechanic-toggle-caret">{{ isOpen ? "▴" : "▾" }}</span>
    </button>
    <button
      v-if="selectedCount > 0"
      type="button"
      class="mechanic-clear"
      @click="clearAll"
    >✕ clear</button>

    <div
      v-if="isOpen"
      class="mechanic-popover"
      :style="popoverStyle"
      role="group"
      aria-label="Filter by hero mechanic"
    >
      <input
        ref="searchInput"
        v-model="searchText"
        type="text"
        class="mechanic-search"
        placeholder="Search mechanics…"
        aria-label="Search mechanics"
      />
      <ul class="mechanic-list">
        <li v-if="filteredMechanics.length === 0" class="mechanic-empty">
          No mechanics match “{{ searchText }}”.
        </li>
        <li v-for="mechanic in filteredMechanics" :key="mechanic.slug">
          <label
            class="mechanic-option"
            :class="{ active: isSelected(mechanic.slug) }"
          >
            <input
              type="checkbox"
              :checked="isSelected(mechanic.slug)"
              @change="toggleMechanic(mechanic.slug)"
            />
            <span class="mechanic-option-label">{{ mechanic.label }}</span>
            <span class="mechanic-option-count">{{ mechanic.cardCount }}</span>
          </label>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.mechanic-filter {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1.25rem;
  background: #12121a;
  border-bottom: 1px solid #22222e;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.mechanic-filter-label {
  font-size: 0.65rem;
  color: #44445a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.mechanic-dropdown-toggle {
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
}
.mechanic-dropdown-toggle:hover {
  background: #2a2a3e;
  color: #c8c8ee;
  border-color: #5555aa;
}
.mechanic-dropdown-toggle.active {
  background: #2a2a5a;
  border-color: #7070e0;
  color: #c0c0ff;
  font-weight: 700;
}
.mechanic-toggle-caret {
  font-size: 0.7rem;
}
.mechanic-clear {
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
.mechanic-clear:hover {
  color: #f87171;
}

/* why: position:fixed so the panel escapes the filter drawer's overflow:hidden
   clip; top/left/min-width come from the toggle button's rect (inline style). */
.mechanic-popover {
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
.mechanic-search {
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
.mechanic-search:focus {
  outline: none;
  border-color: #6060c0;
}
.mechanic-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 300px;
  overflow-y: auto;
}
.mechanic-empty {
  color: #66669a;
  font-size: 0.78rem;
  padding: 0.4rem 0.3rem;
}
.mechanic-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.35rem;
  border-radius: 5px;
  cursor: pointer;
  color: #b8b8d8;
  font-size: 0.82rem;
}
.mechanic-option:hover {
  background: #22223a;
}
.mechanic-option.active {
  color: #c0c0ff;
  font-weight: 600;
}
.mechanic-option input {
  cursor: pointer;
  accent-color: #7070e0;
  flex-shrink: 0;
}
.mechanic-option-label {
  flex: 1;
  line-height: 1.2;
}
.mechanic-option-count {
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
