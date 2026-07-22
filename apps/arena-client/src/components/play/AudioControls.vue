<script lang="ts">
import { defineComponent, onMounted, onUnmounted } from 'vue';
import { getAudioEngine } from '../../audio/audioEngine';
import { useAudioSettings } from '../../composables/useAudioSettings';

/**
 * Fixed-position mute toggle + master-volume slider for the WP-412 audio
 * layer, bound to `useAudioSettings` (persisted to localStorage). Mounted once
 * at the shared viewport root (`PlayViewport.vue`).
 *
 * The component also owns the mandatory autoplay-unlock arm: on mount it
 * registers one-shot `pointerdown` / `keydown` listeners on `window` that arm
 * the audio engine on the FIRST user gesture (browser autoplay policy);
 * interacting with the controls arms it too.
 *
 * Per the EC-132 §2 SFC authoring whitelist (extended to all arena-client SFCs
 * under WP-065 D-6512): this component MUST use `defineComponent({ setup() {
 * return {...} } })` rather than `<script setup>` sugar — the vue-sfc-loader's
 * `inlineTemplate: false` pipeline does not expose script-setup top-level
 * bindings on the template's `_ctx`.
 *
 * @see WP-412 §F "Controls UI"
 * @see DECISIONS.md D-24224 (autoplay unlock + persistent mute/volume)
 */
export default defineComponent({
  name: 'AudioControls',
  setup() {
    const engine = getAudioEngine();
    const { isMuted, volume } = useAudioSettings(engine);

    function onToggleMute(): void {
      // why: a control interaction is itself a valid first user gesture, so arm
      // the audio context here too — a player who unmutes before touching the
      // board still hears the next event.
      engine.arm();
      isMuted.value = !isMuted.value;
    }

    function onVolumeInput(event: Event): void {
      engine.arm();
      const target = event.target as HTMLInputElement;
      volume.value = Number(target.value);
    }

    // why: browser autoplay policy — the audio context must be armed by a real
    // user gesture. Arm on the first ANY interaction (pointerdown or keydown),
    // once; the `armOnce` handler removes both listeners so it never re-arms.
    function armOnce(): void {
      engine.arm();
      window.removeEventListener('pointerdown', armOnce);
      window.removeEventListener('keydown', armOnce);
    }

    onMounted(() => {
      window.addEventListener('pointerdown', armOnce, { once: true });
      window.addEventListener('keydown', armOnce, { once: true });
    });

    onUnmounted(() => {
      // why: remove the one-shot listeners if the component unmounts before any
      // gesture fires (they are `{ once: true }`, but an explicit removal keeps
      // teardown deterministic under HMR / repeated test mounts).
      window.removeEventListener('pointerdown', armOnce);
      window.removeEventListener('keydown', armOnce);
    });

    return { isMuted, volume, onToggleMute, onVolumeInput };
  },
});
</script>

<template>
  <div class="audio-controls" data-testid="audio-controls">
    <button
      type="button"
      class="audio-controls__mute"
      data-testid="audio-mute-toggle"
      :aria-pressed="isMuted"
      :title="isMuted ? 'Unmute sound effects' : 'Mute sound effects'"
      @click="onToggleMute"
    >
      {{ isMuted ? '🔇' : '🔊' }}
    </button>
    <input
      type="range"
      class="audio-controls__volume"
      data-testid="audio-volume-slider"
      min="0"
      max="1"
      step="0.05"
      :value="volume"
      :disabled="isMuted"
      aria-label="Sound effects volume"
      @input="onVolumeInput"
    />
  </div>
</template>

<style scoped>
.audio-controls {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 45;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--color-foreground, #999);
  border-radius: 0.5rem;
  background: rgba(20, 20, 28, 0.9);
  color: #f4f4f5;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}

.audio-controls__mute {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.1rem 0.2rem;
}

.audio-controls__volume {
  width: 6rem;
  cursor: pointer;
}

.audio-controls__volume:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
