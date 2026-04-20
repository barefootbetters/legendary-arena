<script lang="ts">
import { defineComponent, ref } from 'vue';
import type { ReplaySnapshotSequence } from '@legendary-arena/game-engine';
import { parseReplayJson } from '../../replay/loadReplay';

// why: defineComponent({ setup() { return {...} } }) is required (NOT
// <script setup>) because the template references non-prop bindings —
// errorMessage, fileInputId, onChange — that under vue-sfc-loader's
// separate-compile pipeline only reach `_ctx` when explicitly returned
// from setup() (D-6512 / P6-30). Same failure mode WP-061's
// BootstrapProbe and WP-062's HUD containers document. The leaf-vs-non-
// leaf distinction in EC-074's locked values is therefore not "uses
// emits or not" but "template touches anything beyond $props" — emits
// itself reaches the template via $emit just like props reach it via
// $props, but rendered text from a script-scope ref does NOT.

// why: the I/O surface for the replay inspector lives here, NOT in
// loadReplay.ts. parseReplayJson is a pure helper that takes a string;
// the browser File API (file.text()) is the actual I/O call. Keeping I/O
// out of the parser lets tests exercise loadReplay without jsdom and
// keeps the parser reusable from any future surface (drag-drop, URL
// fetch, server push) without re-implementing the validation contract.
export default defineComponent({
  name: 'ReplayFileLoader',
  emits: {
    loaded: (sequence: ReplaySnapshotSequence) => sequence !== undefined,
  },
  setup(_props, { emit }) {
    const errorMessage = ref<string | null>(null);
    const fileInputId = 'replay-file-input';

    async function onChange(event: Event): Promise<void> {
      const target = event.target as HTMLInputElement | null;
      if (target === null) {
        return;
      }
      const files = target.files;
      if (files === null || files.length === 0) {
        return;
      }
      const file = files[0];
      if (file === undefined) {
        return;
      }

      let raw: string;
      try {
        raw = await file.text();
      } catch (readError) {
        // why: file.text() can reject when the file is unreadable
        // (revoked permission, deleted between selection and read).
        // Surface as a full-sentence alert region, never alert(), never
        // a swallowed console.error.
        const message =
          readError instanceof Error ? readError.message : String(readError);
        errorMessage.value =
          `Failed to read replay file "${file.name}": ${message}.`;
        return;
      }

      try {
        const sequence = parseReplayJson(raw, file.name);
        errorMessage.value = null;
        emit('loaded', sequence);
      } catch (parseError) {
        const message =
          parseError instanceof Error
            ? parseError.message
            : String(parseError);
        errorMessage.value = message;
      }
    }

    return { errorMessage, fileInputId, onChange };
  },
});
</script>

<template>
  <div class="replay-file-loader" data-testid="replay-file-loader">
    <label :for="fileInputId" class="label">
      Load replay file
    </label>
    <input
      :id="fileInputId"
      type="file"
      accept=".json,application/json"
      data-testid="replay-file-input"
      aria-label="Select a replay JSON file to load"
      @change="onChange"
    />
    <p
      v-if="errorMessage !== null"
      class="error"
      role="alert"
      data-testid="replay-file-error"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>

<style scoped>
.replay-file-loader {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
}

.label {
  font-weight: 600;
}

.error {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-foreground);
}
</style>
