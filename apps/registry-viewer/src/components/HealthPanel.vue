<script setup lang="ts">
import type { HealthReport, RegistryInfo } from "../registry/browser";

defineProps<{ report: HealthReport; info: RegistryInfo }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <!-- why: overlay kept as <div> with ARIA fallback — it wraps the modal panel
       and can't be a <button> (buttons must not contain complex interactive
       content). role="button" + tabindex + Enter/Space keydown close parity.
       @click.self + keydown still trigger close only when the overlay itself
       is the event target, not when bubbled from inside the panel (EC-103). -->
  <div
    class="overlay"
    role="button"
    tabindex="0"
    aria-label="Close diagnostics"
    @click.self="emit('close')"
    @keydown.enter.self.prevent="emit('close')"
    @keydown.space.self.prevent="emit('close')"
  >
    <div class="panel">
      <div class="panel-header">
        <h2>Registry Diagnostics</h2>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>
      <div class="panel-body">
        <div class="summary-grid">
          <div class="tile"><span class="val">{{ report.summary.setsIndexed }}</span><span class="lbl">Sets Indexed</span></div>
          <div class="tile ok"><span class="val">{{ report.summary.setsLoaded }}</span><span class="lbl">Sets Loaded</span></div>
          <div class="tile"><span class="val">{{ report.summary.totalHeroes }}</span><span class="lbl">Heroes</span></div>
          <div class="tile"><span class="val">{{ report.summary.totalCards }}</span><span class="lbl">Total Cards</span></div>
          <div class="tile" :class="{ warn: report.summary.parseErrors > 0 }">
            <span class="val">{{ report.summary.parseErrors }}</span><span class="lbl">Parse Errors</span>
          </div>
        </div>

        <div class="info-section">
          <div class="section-title">Info</div>
          <div class="info-row"><span>Base URL</span><code>{{ info.metadataBaseUrl }}</code></div>
          <div class="info-row"><span>Loaded Sets</span><code>{{ info.loadedSetAbbrs.join(", ") || "none" }}</code></div>
          <div class="info-row"><span>Generated</span><code>{{ report.generatedAt }}</code></div>
        </div>

        <div class="errors-section">
          <div class="section-title">Errors <span class="badge" :class="{ ok: !report.errors.length }">{{ report.errors.length }}</span></div>
          <div v-if="!report.errors.length" class="no-errors">✅ No errors</div>
          <ul v-else class="error-list">
            <li v-for="(e, i) in report.errors" :key="i" class="error-item">
              <span class="err-code">{{ e.code }}</span>
              <span v-if="e.setAbbr" class="err-id">{{ e.setAbbr }}</span>
              <span class="err-msg">{{ e.message }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 100; display: flex; align-items: flex-start; justify-content: center; padding: 2rem 1rem; overflow-y: auto; }
.panel { background: #1a1a24; border: 1px solid #2e2e42; border-radius: 12px; width: 100%; max-width: 580px; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid #2e2e42; }
.panel-header h2 { margin: 0; font-size: 1rem; font-weight: 700; }
.close-btn { background: none; border: none; color: #6666aa; font-size: 1.1rem; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 4px; }
.close-btn:hover { background: #2a2a3a; }
.panel-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 1.5rem; }
.summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(95px, 1fr)); gap: 0.55rem; }
.tile { background: #12121a; border: 1px solid #2e2e42; border-radius: 8px; padding: 0.65rem 0.5rem; text-align: center; }
.tile.ok   { border-color: #10b981; }
.tile.warn { border-color: #f59e0b; }
.val { display: block; font-size: 1.4rem; font-weight: 700; color: #e8e8ee; }
.lbl { font-size: 0.65rem; color: #6666aa; text-transform: uppercase; letter-spacing: 0.05em; }
.info-section, .errors-section { display: flex; flex-direction: column; gap: 0.45rem; }
.section-title { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: #6666aa; display: flex; align-items: center; gap: 0.5rem; }
.badge { background: #f87171; color: #fff; border-radius: 999px; padding: 0.1rem 0.4rem; font-size: 0.68rem; font-weight: 700; }
.badge.ok { background: #10b981; }
.info-row { display: flex; gap: 0.75rem; font-size: 0.78rem; }
.info-row span { color: #6666aa; min-width: 80px; }
.info-row code { color: #9999cc; word-break: break-all; font-size: 0.75rem; }
.no-errors { color: #10b981; font-size: 0.9rem; }
.error-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.45rem; }
.error-item { background: #1f1015; border: 1px solid #4a1a1a; border-radius: 6px; padding: 0.45rem 0.7rem; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: baseline; }
.err-code { font-size: 0.7rem; font-weight: 700; color: #f87171; background: #2a0f0f; border-radius: 4px; padding: 0.1rem 0.35rem; }
.err-id   { font-size: 0.73rem; color: #a0a0c8; font-family: monospace; }
.err-msg  { font-size: 0.78rem; color: #cc9999; }
</style>
