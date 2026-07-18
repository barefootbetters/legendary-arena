<!--
  LoadoutPreview.vue — read-only URL-driven setup preview (WP-114).

  Read-only: no persistence (no localStorage / sessionStorage / IndexedDB /
  cookies), no engine handoff, no server contact. URL is the sole state
  carrier. Consumes the composable outputs (parsedParams, hasUrlParams,
  previewDocument, validationErrors, matchedCount) as props from App.vue's
  single useSetupFromUrl instance owned by App.vue per the EC-116 §Locked
  Values "Composable ownership" rule — the component does NOT call the
  composable itself.

  The "Edit this loadout" button is the sole user-initiated promotion path
  from preview into the editor draft. All other interactions are display-only.
-->

<script setup lang="ts">
import { computed, ref } from "vue";

import type {
  MatchSetupDocument,
  MatchSetupValidationError,
  SetupCompositionInput,
} from "@legendary-arena/registry/setupContract";

import type { CardRegistry, FlatCard } from "../registry/browser";
import type { SetupMatchedCount } from "../composables/useSetupFromUrl";

interface Props {
  hasUrlParams: boolean;
  previewDocument: MatchSetupDocument | null;
  validationErrors: MatchSetupValidationError[];
  matchedCount: SetupMatchedCount;
  parsedParams: Partial<SetupCompositionInput>;
  registry: CardRegistry;
}

const props = defineProps<Props>();

// why: D-24190 — this component is READ-ONLY and now touches no draft at all.
// It previously called `useLoadoutDraft(props.registry)` itself, which creates
// an INDEPENDENT draft instance (the composable is deliberately non-singleton)
// — so "Edit this loadout" populated a draft nothing renders, while the
// builder kept showing App.vue's shared draft. Promotion is now an emitted
// intent that App.vue (the shared draft's owner) applies, which both fixes the
// defect and strengthens the EC-116 §Guardrails read-only constraint.
const emit = defineEmits<{ (event: "edit"): void }>();

const cardsByExtId = computed<Map<string, FlatCard>>(() => {
  const lookup = new Map<string, FlatCard>();
  for (const card of props.registry.listCards()) {
    // why: compositions reference cards by set-qualified extId (D-24018,
    // e.g. "core/red-skull"), NOT by the flatten's internal `key`
    // ("core-mastermind-red-skull-red-skull"). A mastermind's cards (and a
    // hero's sides) share one extId — keep the first so the preview resolves
    // the group by the id the URL actually carries. Keying by `key` here left
    // every scheme/mastermind unresolvable ("Unknown ext_id") since WP-114.
    if (!lookup.has(card.extId)) {
      lookup.set(card.extId, card);
    }
  }
  return lookup;
});

interface PreviewEntry {
  id: string;
  name: string;
  isKnown: boolean;
}

function buildEntry(extId: string): PreviewEntry {
  const card = cardsByExtId.value.get(extId);
  if (card === undefined) {
    return { id: extId, name: extId, isKnown: false };
  }
  return { id: extId, name: card.name, isKnown: true };
}

const schemeEntry = computed<PreviewEntry | null>(() => {
  const id = props.previewDocument?.composition.schemeId;
  if (id === undefined || id === "") {
    return null;
  }
  return buildEntry(id);
});

const mastermindEntry = computed<PreviewEntry | null>(() => {
  const id = props.previewDocument?.composition.mastermindId;
  if (id === undefined || id === "") {
    return null;
  }
  return buildEntry(id);
});

const villainEntries = computed<PreviewEntry[]>(() => {
  const ids = props.previewDocument?.composition.villainGroupIds ?? [];
  return ids.map((id) => buildEntry(id));
});

const henchmanEntries = computed<PreviewEntry[]>(() => {
  const ids = props.previewDocument?.composition.henchmanGroupIds ?? [];
  return ids.map((id) => buildEntry(id));
});

const heroEntries = computed<PreviewEntry[]>(() => {
  const ids = props.previewDocument?.composition.heroDeckIds ?? [];
  return ids.map((id) => buildEntry(id));
});

const schemeProvidedTotal = computed<number>(() =>
  "schemeId" in props.parsedParams ? 1 : 0,
);
const mastermindProvidedTotal = computed<number>(() =>
  "mastermindId" in props.parsedParams ? 1 : 0,
);
const villainProvidedTotal = computed<number>(
  () => props.parsedParams.villainGroupIds?.length ?? 0,
);
const henchmanProvidedTotal = computed<number>(
  () => props.parsedParams.henchmanGroupIds?.length ?? 0,
);
const heroProvidedTotal = computed<number>(
  () => props.parsedParams.heroDeckIds?.length ?? 0,
);

const editStatus = ref<"idle" | "loaded" | "rejected">("idle");
const copyLinkStatus = ref<"idle" | "copied" | "failed">("idle");

function onEditLoadout(): void {
  if (props.previewDocument === null) {
    return;
  }
  // why: D-24190 — emit the promotion intent instead of mutating a draft here.
  // The previous implementation round-tripped the preview through
  // `loadFromJson`, which runs the FULL document validation and returns without
  // assigning when it fails: a scheme+mastermind-only challenge link has empty
  // villain / henchman / hero arrays, the schema requires >= 1 of each, so the
  // promote silently no-op'd. App.vue now applies the preview to the shared
  // draft field-by-field (partial-tolerant), so this always succeeds for a
  // renderable preview.
  emit("edit");
  editStatus.value = "loaded";
}

async function onCopyLink(): Promise<void> {
  copyLinkStatus.value = "idle";
  try {
    await navigator.clipboard.writeText(window.location.href);
    copyLinkStatus.value = "copied";
  } catch {
    copyLinkStatus.value = "failed";
  }
}
</script>

<template>
  <section v-if="hasUrlParams" class="loadout-preview" aria-label="URL-loaded setup preview">
    <header class="preview-header">
      <div class="preview-banner">
        <span class="banner-text">Loaded from URL</span>
        <button
          type="button"
          class="mini-btn"
          @click="onCopyLink"
          title="Copy this page's URL to the clipboard"
        >
          🔗 Copy this link
        </button>
        <span v-if="copyLinkStatus === 'copied'" class="status-text success">Copied!</span>
        <span v-if="copyLinkStatus === 'failed'" class="status-text failed">Could not copy — link is in the address bar.</span>
      </div>

      <div class="match-summary" aria-label="Matched entity counts">
        <span class="count-chip">Schemes: {{ matchedCount.schemes }} / {{ schemeProvidedTotal }}</span>
        <span class="count-chip">Masterminds: {{ matchedCount.masterminds }} / {{ mastermindProvidedTotal }}</span>
        <span class="count-chip">Villain Groups: {{ matchedCount.villainGroups }} / {{ villainProvidedTotal }}</span>
        <span class="count-chip">Henchman Groups: {{ matchedCount.henchmanGroups }} / {{ henchmanProvidedTotal }}</span>
        <span class="count-chip">Hero Decks: {{ matchedCount.heroDecks }} / {{ heroProvidedTotal }}</span>
      </div>
    </header>

    <div class="preview-body">
      <section class="preview-section">
        <h3 class="section-title">Scheme</h3>
        <p v-if="schemeEntry === null" class="empty-line">Not specified in URL.</p>
        <p v-else-if="!schemeEntry.isKnown" class="unknown-line">Unknown ext_id: {{ schemeEntry.id }}</p>
        <p v-else class="match-line">
          <span class="entry-name">{{ schemeEntry.name }}</span>
          <span class="entry-id">{{ schemeEntry.id }}</span>
        </p>
      </section>

      <section class="preview-section">
        <h3 class="section-title">Mastermind</h3>
        <p v-if="mastermindEntry === null" class="empty-line">Not specified in URL.</p>
        <p v-else-if="!mastermindEntry.isKnown" class="unknown-line">Unknown ext_id: {{ mastermindEntry.id }}</p>
        <p v-else class="match-line">
          <span class="entry-name">{{ mastermindEntry.name }}</span>
          <span class="entry-id">{{ mastermindEntry.id }}</span>
        </p>
      </section>

      <section class="preview-section">
        <h3 class="section-title">Villain Groups</h3>
        <p v-if="villainEntries.length === 0" class="empty-line">Not specified in URL.</p>
        <ul v-else class="entry-list">
          <li v-for="entry in villainEntries" :key="entry.id">
            <span v-if="!entry.isKnown" class="unknown-line">Unknown ext_id: {{ entry.id }}</span>
            <template v-else>
              <span class="entry-name">{{ entry.name }}</span>
              <span class="entry-id">{{ entry.id }}</span>
            </template>
          </li>
        </ul>
      </section>

      <section class="preview-section">
        <h3 class="section-title">Henchman Groups</h3>
        <p v-if="henchmanEntries.length === 0" class="empty-line">Not specified in URL.</p>
        <ul v-else class="entry-list">
          <li v-for="entry in henchmanEntries" :key="entry.id">
            <span v-if="!entry.isKnown" class="unknown-line">Unknown ext_id: {{ entry.id }}</span>
            <template v-else>
              <span class="entry-name">{{ entry.name }}</span>
              <span class="entry-id">{{ entry.id }}</span>
            </template>
          </li>
        </ul>
      </section>

      <section class="preview-section">
        <h3 class="section-title">Hero Decks</h3>
        <p v-if="heroEntries.length === 0" class="empty-line">Not specified in URL.</p>
        <ul v-else class="entry-list">
          <li v-for="entry in heroEntries" :key="entry.id">
            <span v-if="!entry.isKnown" class="unknown-line">Unknown ext_id: {{ entry.id }}</span>
            <template v-else>
              <span class="entry-name">{{ entry.name }}</span>
              <span class="entry-id">{{ entry.id }}</span>
            </template>
          </li>
        </ul>
      </section>
    </div>

    <footer class="preview-footer">
      <button
        type="button"
        class="primary-btn"
        :disabled="previewDocument === null"
        @click="onEditLoadout"
      >
        ✎ Edit this loadout
      </button>
      <span v-if="editStatus === 'loaded'" class="status-text success">Loaded into a fresh editor draft.</span>
      <span v-if="editStatus === 'rejected'" class="status-text failed">Validation errors — see below.</span>
    </footer>
  </section>
</template>

<style scoped>
.loadout-preview {
  background: #15151e;
  border: 1px solid #22222e;
  border-radius: 8px;
  padding: 1rem;
  margin: 0 1rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  color: #e8e8ee;
}

.preview-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: #1a1a3a;
  border: 1px solid #4a4a8a;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}
.banner-text {
  color: #c0c0ff;
  font-weight: 600;
  font-size: 0.9rem;
}

.match-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.count-chip {
  background: #22222e;
  border: 1px solid #33334a;
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.72rem;
  color: #c8c8e0;
}

.preview-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.6rem;
}

.preview-section {
  background: #12121a;
  border: 1px solid #22222e;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}
.section-title {
  margin: 0 0 0.4rem 0;
  font-size: 0.78rem;
  color: #8888aa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.match-line, .empty-line, .unknown-line {
  margin: 0.2rem 0;
  font-size: 0.82rem;
}
.match-line {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.entry-name { color: #c8c8e0; font-weight: 600; }
.entry-id {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.72rem;
  color: #8888aa;
}
.empty-line { color: #6666aa; font-style: italic; }
.unknown-line { color: #fda4af; font-family: ui-monospace, Consolas, monospace; }

.entry-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.entry-list li {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}

.preview-footer {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-top: 0.5rem;
  border-top: 1px solid #22222e;
}

.primary-btn {
  background: #2a2a5a;
  border: 1px solid #7070e0;
  color: #fff;
  font-weight: 600;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.85rem;
}
.primary-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.primary-btn:hover:not(:disabled) { background: #3a3a7a; }

.mini-btn {
  background: #22222e;
  border: 1px solid #33334a;
  color: #c8c8e0;
  border-radius: 4px;
  padding: 0.3rem 0.65rem;
  cursor: pointer;
  font-size: 0.78rem;
  font-family: inherit;
}
.mini-btn:hover { background: #2a2a3a; }

.status-text { font-size: 0.8rem; }
.status-text.success { color: #6ee7b7; }
.status-text.failed { color: #fda4af; }
</style>
