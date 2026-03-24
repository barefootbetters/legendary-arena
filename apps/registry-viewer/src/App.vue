<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { FlatCard, CardQueryExtended, HealthReport, CardRegistry, SetIndexEntry, FlatCardType } from "./registry/browser";
import { getRegistry } from "./lib/registryClient";
import CardGrid    from "./components/CardGrid.vue";
import CardDetail  from "./components/CardDetail.vue";
import HealthPanel from "./components/HealthPanel.vue";

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

// ── Card type groups ──────────────────────────────────────────────────────────
interface TypeGroup {
  label:    string;
  emoji:    string;
  types:    FlatCardType[];
  subtypes: { label: string; type: FlatCardType }[];
}

const TYPE_GROUPS: TypeGroup[] = [
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
    types: ["location","other"],
    subtypes: [
      { label: "Location", type: "location" },
      { label: "Other",    type: "other" },
    ],
  },
];

// Selected card types — empty means "all"
const selectedTypes = ref<Set<FlatCardType>>(new Set());

function toggleGroup(group: TypeGroup) {
  const allSelected = group.types.every((t) => selectedTypes.value.has(t));
  const next = new Set(selectedTypes.value);
  if (allSelected) {
    group.types.forEach((t) => next.delete(t));
  } else {
    group.types.forEach((t) => next.add(t));
  }
  selectedTypes.value = next;
  applyFilters();
}

function isGroupActive(group: TypeGroup): boolean {
  return group.types.some((t) => selectedTypes.value.has(t));
}

function isGroupFullyActive(group: TypeGroup): boolean {
  return group.types.every((t) => selectedTypes.value.has(t));
}

function clearTypes() {
  selectedTypes.value = new Set();
  applyFilters();
}

// ── Load registry ─────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    loadStatus.value = "Fetching set index from R2…";
    const reg = await getRegistry();
    loadStatus.value = "Parsing card data…";
    registry.value      = reg;
    allSets.value       = reg.listSets();
    allCards.value      = reg.listCards();
    filteredCards.value = allCards.value;
    healthReport.value  = reg.validate();
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err);
    console.error("[Registry] Load failed:", err);
  } finally {
    loading.value = false;
  }
});

// ── Filtering ─────────────────────────────────────────────────────────────────
function applyFilters() {
  if (!registry.value) return;
  const q: CardQueryExtended = {};
  if (selectedTypes.value.size > 0) q.cardTypes = [...selectedTypes.value];
  if (filterSet.value)  q.setAbbr      = filterSet.value;
  if (filterHC.value)   q.heroClass    = filterHC.value as CardQueryExtended["heroClass"];
  if (searchText.value) q.nameContains = searchText.value;
  filteredCards.value = registry.value.query(q as any);
  selectedCard.value  = null;
}

const activeTypeCount = computed(() => selectedTypes.value.size);
</script>

<template>
  <div class="app">
    <header class="header">
      <h1 class="logo">⚔️ Legendary Arena <span class="sub">Registry Viewer</span></h1>
      <button v-if="!loading && !loadError" class="diag-btn" @click="showDiag = !showDiag">
        🔍 Diagnostics
      </button>
    </header>

    <div v-if="loading" class="status-screen">
      <div class="spinner">⏳</div>
      <p class="status-text">{{ loadStatus }}</p>
      <p class="status-hint">Connecting to images.barefootbetters.com…</p>
    </div>

    <div v-else-if="loadError" class="status-screen error">
      <div class="err-icon">❌</div>
      <p class="err-title">Failed to load registry</p>
      <pre class="err-detail">{{ loadError }}</pre>
    </div>

    <template v-else>
      <HealthPanel v-if="showDiag && healthReport" :report="healthReport" :info="registry!.info()" @close="showDiag = false" />

      <!-- ── Search + Set + Class filters ───────────────────────────────────── -->
      <div class="filter-bar">
        <input v-model="searchText" class="search" placeholder="Search cards…" @input="applyFilters" />

        <select v-model="filterSet" @change="applyFilters">
          <option value="">All Sets</option>
          <option v-for="s in allSets" :key="s.abbr" :value="s.abbr">{{ s.name }}</option>
        </select>

        <select v-model="filterHC" @change="applyFilters">
          <option value="">All Classes</option>
          <option v-for="hc in HC_OPTIONS" :key="hc" :value="hc">{{ hc }}</option>
        </select>

        <span class="count">{{ filteredCards.length }} cards</span>
      </div>

      <!-- ── Card type group toggles ─────────────────────────────────────────── -->
      <div class="type-bar">
        <button
          class="type-group-btn"
          :class="{ active: activeTypeCount === 0 }"
          @click="clearTypes"
        >All</button>

        <button
          v-for="group in TYPE_GROUPS"
          :key="group.label"
          class="type-group-btn"
          :class="{
            active: isGroupFullyActive(group),
            partial: isGroupActive(group) && !isGroupFullyActive(group)
          }"
          @click="toggleGroup(group)"
          :title="group.subtypes.map(s => s.label).join(', ')"
        >
          {{ group.emoji }} {{ group.label }}
        </button>

        <span v-if="activeTypeCount > 0" class="clear-link" @click="clearTypes">✕ clear</span>
      </div>

      <!-- ── Set quick-filter pills ──────────────────────────────────────────── -->
      <div class="set-pills">
        <span class="pills-label">Set:</span>
        <button
          v-for="s in allSets"
          :key="s.abbr"
          class="pill"
          :class="{ active: filterSet === s.abbr }"
          @click="filterSet = filterSet === s.abbr ? '' : s.abbr; applyFilters()"
        >{{ s.abbr }}</button>
      </div>

      <!-- ── Main body ───────────────────────────────────────────────────────── -->
      <div class="body">
        <CardGrid :cards="filteredCards" :selected-key="selectedCard?.key" @select="selectedCard = $event" />
        <CardDetail v-if="selectedCard" :card="selectedCard" @close="selectedCard = null" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: #0f0f13; color: #e8e8ee; }

.header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.25rem; background: #1a1a24; border-bottom: 1px solid #2e2e42; flex-shrink: 0; }
.logo  { margin: 0; font-size: 1.1rem; font-weight: 700; color: #fff; }
.sub   { font-weight: 400; color: #8888aa; font-size: 0.85rem; margin-left: 0.5rem; }
.diag-btn { background: #2a2a3a; border: 1px solid #3e3e56; color: #c8c8e0; padding: 0.4rem 0.9rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
.diag-btn:hover { background: #35354a; }

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
select { padding: 0.4rem 0.6rem; background: #22222e; border: 1px solid #33334a; border-radius: 6px; color: #e8e8ee; font-size: 0.85rem; cursor: pointer; }
.count { color: #6666aa; font-size: 0.8rem; margin-left: auto; white-space: nowrap; }

/* ── Type group toggles ──────────────────────────────────────────────────── */
.type-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1.25rem;
  background: #12121a;
  border-bottom: 1px solid #22222e;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.type-group-btn {
  background: #1e1e2e;
  border: 1.5px solid #33334a;
  color: #8888cc;
  padding: 0.3rem 0.75rem;
  border-radius: 20px;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  font-weight: 500;
}
.type-group-btn:hover  { background: #2a2a3e; color: #c8c8ee; border-color: #5555aa; }
.type-group-btn.active { background: #2a2a5a; border-color: #7070e0; color: #c0c0ff; font-weight: 700; }
.type-group-btn.partial { background: #1e1e3a; border-color: #5555aa; color: #9999dd; border-style: dashed; }
.clear-link { font-size: 0.72rem; color: #6666aa; cursor: pointer; margin-left: 0.25rem; }
.clear-link:hover { color: #f87171; }

/* ── Set pills ───────────────────────────────────────────────────────────── */
.set-pills { display: flex; gap: 0.35rem; padding: 0.35rem 1.25rem; background: #0f0f13; border-bottom: 1px solid #1a1a22; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
.pills-label { font-size: 0.65rem; color: #44445a; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
.pill { background: #161620; border: 1px solid #2a2a38; color: #66669a; padding: 0.15rem 0.45rem; border-radius: 3px; font-size: 0.67rem; cursor: pointer; }
.pill:hover  { background: #22223a; color: #aaaadd; }
.pill.active { background: #22225a; border-color: #5555aa; color: #9999ff; }

.body { display: flex; flex: 1; overflow: hidden; }
</style>
