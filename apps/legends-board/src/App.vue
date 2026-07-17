<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import {
  fetchManifest,
  fetchAllBoards,
  fetchGauntletBoard,
  fetchGauntletIndex,
  pollManifest,
  getPollIntervalMs,
  boardDisplayName,
  type GauntletIndexEntry,
  type GauntletIndexSnapshot,
  type GauntletSnapshotBoard,
  type LegendsManifest,
  type LegendsSnapshotBoard,
} from "./snapshots/snapshotClient";
import { getKioskConfig, type KioskConfig } from "./attract/kioskMode";
import { createHashRouteRef } from "./router/hashRoute";
import {
  buildAttractBoardList,
  findRoutedCountTab,
  resolveBoardIndexEntry,
} from "./panels/gauntletDisplay";
import AttractCycler from "./attract/AttractCycler.vue";
import FreshnessBadge from "./freshness/FreshnessBadge.vue";
import OverallPanel from "./panels/OverallPanel.vue";
import WeeklyPanel from "./panels/WeeklyPanel.vue";
import BySchemePanel from "./panels/BySchemePanel.vue";
import RecentAchievementsPanel from "./panels/RecentAchievementsPanel.vue";
import NowPlayingPanel from "./panels/NowPlayingPanel.vue";
import GauntletIndexPanel from "./panels/GauntletIndexPanel.vue";
import GauntletBoardPanel from "./panels/GauntletBoardPanel.vue";
import VersionBadge from "./components/VersionBadge.vue";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const kioskConfig: KioskConfig = getKioskConfig();

// why: read synchronously at setup so a #/gauntlet/<board> deep link
// renders its target view on first paint (no attract flash).
const currentRoute = createHashRouteRef(window);

const manifest = ref<LegendsManifest | null>(null);
const boards = ref<Map<string, LegendsSnapshotBoard>>(new Map());
const boardErrors = ref<Map<string, string>>(new Map());
const activeBoardName = ref<string | null>(null);

const gauntletIndex = ref<GauntletIndexSnapshot | null>(null);
const gauntletIndexError = ref<string | null>(null);
const routedGauntletBoard = ref<GauntletSnapshotBoard | null>(null);
const routedGauntletError = ref<string | null>(null);

const loadError = ref<string | null>(null);
const isLoading = ref(true);
const manifestFetchError = ref(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

const boardNames = computed((): readonly string[] => {
  // why: the attract cycle gains exactly ONE gauntlet-index slide when the
  // manifest advertises it — never the per-gauntlet boards (D-24131 §8a).
  return buildAttractBoardList(
    manifest.value?.boards ?? [],
    manifest.value?.gauntletIndex !== undefined,
  );
});

const routedGauntletIndexEntry = computed((): GauntletIndexEntry | null => {
  if (currentRoute.value.view !== "gauntlet" || gauntletIndex.value === null) {
    return null;
  }
  // why: a `-p<N>` per-count board resolves to its parent gauntlet's index
  // entry so the panel reads the shared `entryCounts` + `legs` (WP-345).
  return resolveBoardIndexEntry(
    currentRoute.value.boardName,
    gauntletIndex.value.gauntlets,
  );
});

const routedBoardName = computed((): string | null => {
  return currentRoute.value.view === "gauntlet"
    ? currentRoute.value.boardName
    : null;
});

const activeBoard = computed((): LegendsSnapshotBoard | null => {
  if (!activeBoardName.value) {
    return null;
  }
  return boards.value.get(activeBoardName.value) ?? null;
});

const activeBoardError = computed((): string | null => {
  if (!activeBoardName.value) {
    return null;
  }
  return boardErrors.value.get(activeBoardName.value) ?? null;
});

const r2BaseUrl = computed((): string => {
  return import.meta.env.VITE_LEGENDS_R2_BASE_URL ?? "(not set)";
});

const activeBoardDisplayName = computed((): string => {
  if (!activeBoardName.value) {
    return "";
  }
  return boardDisplayName(activeBoardName.value);
});

// ---------------------------------------------------------------------------
// Panel component resolver
// ---------------------------------------------------------------------------

const panelComponents: Record<string, unknown> = {
  overall: OverallPanel,
  weekly: WeeklyPanel,
  "by-scheme": BySchemePanel,
  "recent-achievements": RecentAchievementsPanel,
  "now-playing": NowPlayingPanel,
};

/** Returns the panel component for a board name, falling back to OverallPanel. */
function getPanelComponent(boardName: string | null): unknown {
  if (!boardName) {
    return OverallPanel;
  }
  return panelComponents[boardName] ?? OverallPanel;
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/** Loads the gauntlet index when the manifest advertises one. */
async function loadGauntletIndex(loadedManifest: LegendsManifest): Promise<void> {
  if (loadedManifest.gauntletIndex === undefined) {
    gauntletIndex.value = null;
    gauntletIndexError.value = null;
    return;
  }
  try {
    gauntletIndex.value = await fetchGauntletIndex();
    gauntletIndexError.value = null;
  } catch (error) {
    gauntletIndexError.value =
      error instanceof Error ? error.message : "Failed to load gauntlet index";
    console.error("[legends] Gauntlet index load failed:", error);
  }
}

/** Loads the gauntlet board the current route points at (if any). */
async function loadRoutedGauntletBoard(): Promise<void> {
  if (currentRoute.value.view !== "gauntlet") {
    routedGauntletBoard.value = null;
    routedGauntletError.value = null;
    return;
  }
  const boardName = currentRoute.value.boardName;
  routedGauntletBoard.value = null;
  routedGauntletError.value = null;
  // why: an unclaimed per-count board has NO file (D-24131 §7) — skip the
  // fetch so a `-p<N>` deep link to an empty count renders the open-
  // championship state instead of a 404 error. When the index has not loaded
  // yet the guard returns false and we fetch as before; the re-run after the
  // index loads then corrects an unclaimed deep link.
  if (isRoutedCountUnclaimed(boardName)) {
    return;
  }
  try {
    routedGauntletBoard.value = await fetchGauntletBoard(boardName);
  } catch (error) {
    routedGauntletError.value =
      error instanceof Error ? error.message : "Failed to load gauntlet board";
    console.error(`[legends] Gauntlet board "${boardName}" load failed:`, error);
  }
}

/**
 * Whether the routed board is a known-unclaimed player count (which has no
 * board file). Returns false when the index has not loaded or the board is
 * unknown, so the caller falls through to a normal fetch.
 */
function isRoutedCountUnclaimed(boardName: string): boolean {
  if (gauntletIndex.value === null) {
    return false;
  }
  const indexEntry = resolveBoardIndexEntry(
    boardName,
    gauntletIndex.value.gauntlets,
  );
  if (indexEntry === null) {
    return false;
  }
  // why: WP-385 — the guard searches BOTH divisions' tab sets, so an
  // unclaimed `-fixed[-p<N>]` deep link renders the open-championship
  // state instead of fetching a board file that does not exist.
  const routedTab = findRoutedCountTab(indexEntry, boardName);
  if (routedTab === null) {
    return false;
  }
  return !routedTab.isClaimed;
}

/** Initial load: fetch manifest, then all boards. */
async function loadData(): Promise<void> {
  isLoading.value = true;
  loadError.value = null;
  manifestFetchError.value = false;

  try {
    const loadedManifest = await fetchManifest();
    manifest.value = loadedManifest;

    await loadGauntletIndex(loadedManifest);

    // why: the immediate route watch may have fetched a routed board before
    // the index was available; re-run now so an unclaimed `-p<N>` deep link
    // drops its spurious 404 and renders the open-championship state.
    await loadRoutedGauntletBoard();

    if (loadedManifest.boards.length === 0) {
      isLoading.value = false;
      return;
    }

    const loadedBoards = await fetchAllBoards(loadedManifest);
    boards.value = loadedBoards;

    for (const boardName of loadedManifest.boards) {
      if (!loadedBoards.has(boardName)) {
        boardErrors.value.set(boardName, "Failed to load board data");
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error loading scoreboard data";
    loadError.value = message;
    manifestFetchError.value = true;
    console.error("[legends] Initial load failed:", error);
  } finally {
    isLoading.value = false;
  }
}

/** Poll handler: re-fetch manifest and reload boards if it changed. */
async function handlePoll(): Promise<void> {
  try {
    const previousGeneratedAt = manifest.value?.generatedAt ?? null;
    const newManifest = await pollManifest();
    manifest.value = newManifest;
    manifestFetchError.value = false;

    if (
      previousGeneratedAt !== null &&
      newManifest.generatedAt !== previousGeneratedAt
    ) {
      const loadedBoards = await fetchAllBoards(newManifest);
      boards.value = loadedBoards;
      boardErrors.value.clear();

      for (const boardName of newManifest.boards) {
        if (!loadedBoards.has(boardName)) {
          boardErrors.value.set(boardName, "Failed to load board data");
        }
      }

      // why: pollManifest invalidated the gauntlet caches too — refresh the
      // index and, if a gauntlet board view is open, its standings.
      await loadGauntletIndex(newManifest);
      await loadRoutedGauntletBoard();
    }
  } catch (error) {
    console.error("[legends] Poll failed:", error);
    manifestFetchError.value = true;
  }
}

/** Retry handler for full-page error state. */
async function handleRetry(): Promise<void> {
  await loadData();
}

/** Handler for attract cycler board changes. */
function handleBoardChange(boardName: string): void {
  activeBoardName.value = boardName;
}

/** Force refresh for debug mode. */
async function handleForceRefresh(): Promise<void> {
  boards.value = new Map();
  boardErrors.value.clear();
  await loadData();
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

// why: immediate — a deep link must start loading its board on first
// paint, not wait for the first hashchange event.
watch(currentRoute, loadRoutedGauntletBoard, { immediate: true });

onMounted(async () => {
  await loadData();

  const pollIntervalMs = getPollIntervalMs();
  pollTimer = setInterval(handlePoll, pollIntervalMs);
  console.log(
    `[legends] Manifest poll started (every ${pollIntervalMs / 1000}s)`,
  );
});

onUnmounted(() => {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<template>
  <div class="legends-app" :class="{ kiosk: kioskConfig.isKiosk }">
    <!-- Header (hidden in kiosk mode) -->
    <header v-if="!kioskConfig.isKiosk" class="app-header">
      <div class="app-header-brand">
        <h1 class="app-title">Hall of Legends</h1>
        <!-- why: three-site ecosystem cross-link (marketing-site Pattern C) —
             every public surface links back to the www home. Plain <a>, zero
             new deps, hidden with the rest of the header in kiosk mode. -->
        <a class="app-home-link" href="https://www.legendary-arena.com">
          legendary-arena.com
        </a>
      </div>
      <FreshnessBadge
        :generated-at="manifest?.generatedAt ?? null"
        :fetch-error="manifestFetchError"
      />
    </header>

    <!-- Gauntlet board view (#/gauntlet/<board>) -->
    <main v-if="currentRoute.view === 'gauntlet'" class="board-content">
      <div class="active-panel">
        <GauntletBoardPanel
          :board="routedGauntletBoard"
          :index-entry="routedGauntletIndexEntry"
          :board-name="routedBoardName"
          :error="routedGauntletError"
        />
      </div>
    </main>

    <!-- Full-page error -->
    <div v-else-if="loadError && !isLoading" class="full-page-error">
      <div class="error-content">
        <h2>Unable to load scoreboard data</h2>
        <p class="error-message">{{ loadError }}</p>
        <button class="retry-button" @click="handleRetry">Retry</button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-else-if="isLoading" class="loading-state">
      <p>Loading Hall of Legends...</p>
    </div>

    <!-- Empty boards -->
    <div
      v-else-if="boardNames.length === 0"
      class="empty-state"
    >
      <h2>No boards available</h2>
      <p>The scoreboard publisher may still be initializing. Check back shortly.</p>
    </div>

    <!-- Main attract board -->
    <main v-else class="board-content">
      <AttractCycler
        :board-names="boardNames"
        :config="kioskConfig"
        @board-change="handleBoardChange"
      >
        <template #default="{ currentBoardName }">
          <div class="active-panel">
            <h2 v-if="kioskConfig.isKiosk" class="kiosk-board-title">
              {{ activeBoardDisplayName }}
            </h2>

            <!-- Kiosk freshness badge -->
            <div v-if="kioskConfig.isKiosk" class="kiosk-freshness">
              <FreshnessBadge
                :generated-at="manifest?.generatedAt ?? null"
                :fetch-error="manifestFetchError"
              />
            </div>

            <!-- why: the gauntlet-index slide renders its own panel with the
                 index snapshot — it is not a LegendsSnapshotBoard, so it never
                 goes through the generic board-panel resolver. -->
            <GauntletIndexPanel
              v-if="currentBoardName === 'gauntlet-index'"
              :index="gauntletIndex"
              :error="gauntletIndexError"
            />
            <component
              :is="getPanelComponent(currentBoardName)"
              v-else
              :board="activeBoard"
              :error="activeBoardError"
            />
          </div>
        </template>
      </AttractCycler>
    </main>

    <VersionBadge />

    <!-- Debug footer -->
    <footer v-if="kioskConfig.isDebug" class="debug-footer">
      <div class="debug-info">
        <span>R2 Base: {{ r2BaseUrl }}</span>
        <span>Manifest generatedAt: {{ manifest?.generatedAt ?? '(none)' }}</span>
        <span>Active panel: {{ activeBoardName ?? '(none)' }}</span>
        <span>Boards: {{ boardNames.join(', ') || '(none)' }}</span>
        <span>Kiosk: {{ kioskConfig.isKiosk }}</span>
        <button class="debug-refresh" @click="handleForceRefresh">Force Refresh</button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.legends-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0a0a0f;
  color: #e0e0e0;
}

.legends-app.kiosk {
  cursor: none;
  user-select: none;
}

/* Header */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  border-bottom: 1px solid #1a1a2e;
}

.app-title {
  font-size: 1.8rem;
  margin: 0;
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-header-brand {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.app-home-link {
  font-size: 0.85rem;
  color: #888;
  text-decoration: none;
}

.app-home-link:hover,
.app-home-link:focus-visible {
  color: #ffd700;
}

/* States */
.full-page-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
}

.error-content h2 {
  color: #f88;
  margin-bottom: 0.5rem;
}

.error-message {
  color: #888;
  margin-bottom: 1rem;
  max-width: 500px;
}

.retry-button {
  padding: 0.5rem 1.5rem;
  background: rgba(255, 215, 0, 0.15);
  color: #ffd700;
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
}

.retry-button:hover {
  background: rgba(255, 215, 0, 0.25);
}

.loading-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #888;
  padding: 2rem;
}

.empty-state h2 {
  color: #aaa;
  margin-bottom: 0.5rem;
}

/* Board content */
.board-content {
  flex: 1;
  padding: 0 1rem;
}

.active-panel {
  max-width: 900px;
  margin: 0 auto;
}

.kiosk-board-title {
  text-align: center;
  font-size: 2rem;
  color: #ffd700;
  margin: 1.5rem 0 0.5rem;
}

.kiosk-freshness {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

/* Debug footer */
.debug-footer {
  border-top: 1px solid #333;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.5);
}

.debug-info {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.75rem;
  color: #888;
  font-family: monospace;
}

.debug-refresh {
  padding: 0.2rem 0.5rem;
  background: rgba(255, 215, 0, 0.1);
  color: #ffd700;
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
}
</style>
