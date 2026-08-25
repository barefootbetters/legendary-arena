<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useFetch } from '../../composables/useFetch.js';
import { useDataFreshness } from '../../composables/useDataFreshness.js';
import { fetchFeedbackItems, updateFeedbackStatus } from '../../services/endpoints.js';
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TRIAGE_STATUSES,
  buildUpdateFeedbackStatusBody,
  validateStatusEdit,
  type FeedbackTriageItem,
  type FeedbackTriageStatus,
} from '../../types/feedbackTriage.js';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

// why: the operator triage queue (WP-605). The list is a polled read; the status
// editor below drives the ONLY status-write path (PATCH /api/dash/feedback/:id/status).
const { data, loading, error, updatedAt, source, refresh } = useFetch(fetchFeedbackItems);
const { relativeTime, sourceLabel } = useDataFreshness(updatedAt, source);

const selected = ref<FeedbackTriageItem | null>(null);
const editStatus = ref<FeedbackTriageStatus>('under_review');
const editReason = ref('');
const saveError = ref<string | null>(null);
const savingId = ref<number | null>(null);

// why: seed the editor from the selected row; a fresh selection clears any prior
// error and loads that item's current status + reason.
watch(selected, (item) => {
  if (item !== null) {
    editStatus.value = item.status;
    editReason.value = item.resolutionReason ?? '';
    saveError.value = null;
  }
});

const isDeclined = computed(() => editStatus.value === 'declined');
// why: the pure, unit-tested rule (mirrors the server validator) gates the Save
// button so the panel never sends a request the server would reject.
const validation = computed(() => validateStatusEdit(editStatus.value, editReason.value));

function onStatusChange(event: Event): void {
  // why: the <select> only offers valid statuses, so the cast is safe.
  editStatus.value = (event.target as HTMLSelectElement).value as FeedbackTriageStatus;
}

async function save(): Promise<void> {
  const item = selected.value;
  if (item === null || validation.value.ok !== true) {
    return;
  }
  savingId.value = item.id;
  saveError.value = null;
  try {
    await updateFeedbackStatus(
      item.id,
      buildUpdateFeedbackStatusBody(editStatus.value, editReason.value),
    );
    await refresh();
    selected.value = null;
  } catch (caughtError: unknown) {
    saveError.value =
      caughtError instanceof Error ? caughtError.message : 'Failed to update the status.';
  } finally {
    savingId.value = null;
  }
}
</script>

<template>
  <div class="feedback-page">
    <div class="page-header">
      <h1>Feedback</h1>
      <span v-if="sourceLabel" class="freshness-badge">
        <span class="source">{{ sourceLabel }}</span>
        <span class="timestamp">Updated {{ relativeTime }}</span>
      </span>
    </div>
    <p class="page-intro">
      The operator triage queue — every submitted bug, enhancement, and review. Select a row to set
      its status. Players never see status; you author it here.
    </p>

    <div v-if="loading && !data" class="page-loading">
      <p>Loading feedback…</p>
    </div>

    <div v-else-if="error" class="page-error">
      <p>{{ error.message }}</p>
    </div>

    <div v-else-if="!data || data.length === 0" class="page-empty">
      <p>No feedback submitted yet.</p>
    </div>

    <template v-else>
      <DataTable
        v-model:selection="selected"
        :value="data"
        :loading="loading"
        :paginator="true"
        :rows="20"
        data-key="id"
        selection-mode="single"
        class="feedback-table"
      >
        <Column field="feedbackType" header="Type" :sortable="true" />
        <Column field="title" header="Title" :sortable="true" />
        <Column field="status" header="Status" :sortable="true">
          <template #body="{ data: row }">
            {{ FEEDBACK_STATUS_LABELS[(row as FeedbackTriageItem).status] }}
          </template>
        </Column>
        <Column field="voteCount" header="Votes" :sortable="true" />
        <Column field="createdAt" header="Submitted" :sortable="true">
          <template #body="{ data: row }">
            {{ new Date((row as FeedbackTriageItem).createdAt).toLocaleDateString() }}
          </template>
        </Column>
      </DataTable>

      <section v-if="selected !== null" class="edit-panel">
        <h2>Set status — {{ selected.title }}</h2>
        <p class="edit-description">{{ selected.description }}</p>

        <label class="edit-field">
          <span>Status</span>
          <select :value="editStatus" @change="onStatusChange">
            <option v-for="status in FEEDBACK_TRIAGE_STATUSES" :key="status" :value="status">
              {{ FEEDBACK_STATUS_LABELS[status] }}
            </option>
          </select>
        </label>

        <label v-if="isDeclined" class="edit-field">
          <span>Reason (required to decline)</span>
          <textarea
            v-model="editReason"
            rows="3"
            placeholder="Why is this being declined?"
          ></textarea>
        </label>

        <p v-if="!validation.ok" class="edit-hint">{{ validation.message }}</p>
        <p v-if="saveError" class="edit-error">{{ saveError }}</p>

        <div class="edit-actions">
          <button
            type="button"
            class="save-button"
            :disabled="!validation.ok || savingId === selected.id"
            @click="save"
          >
            {{ savingId === selected.id ? 'Saving…' : 'Save status' }}
          </button>
          <button type="button" class="cancel-button" @click="selected = null">Cancel</button>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.feedback-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--p-text-color);
}

.page-intro {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.freshness-badge {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  display: flex;
  gap: 0.5rem;
}

.freshness-badge .source {
  background: var(--p-content-border-color);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-weight: 600;
}

.page-loading,
.page-error,
.page-empty {
  padding: 2rem;
  text-align: center;
}

.page-error {
  color: #dc2626;
}
.page-empty {
  color: var(--p-text-muted-color);
}

.edit-panel {
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 640px;
}

.edit-panel h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--p-text-color);
}

.edit-description {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--p-text-color);
}

.edit-field select,
.edit-field textarea {
  padding: 0.5rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  background: var(--p-content-background);
  color: var(--p-text-color);
  font: inherit;
}

.edit-hint {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.edit-error {
  margin: 0;
  color: #dc2626;
  font-size: 0.85rem;
}

.edit-actions {
  display: flex;
  gap: 0.75rem;
}

.save-button,
.cancel-button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  border: 1px solid var(--p-content-border-color);
}

.save-button {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  border-color: var(--p-primary-color);
}

.save-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-button {
  background: transparent;
  color: var(--p-text-muted-color);
}
</style>
