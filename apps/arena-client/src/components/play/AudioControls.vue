<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted } from 'vue';
import { getAudioEngine } from '../../audio/audioEngine';
import { useAudioSettings } from '../../composables/useAudioSettings';
import { useEffectIntensity, type EffectIntensity } from '../../vfx/effectIntensity';

/**
 * Fixed-position mute toggle + master-volume slider for the WP-412 audio
 * layer, bound to `useAudioSettings` (persisted to localStorage), plus the
 * WP-556 UNIFIED **Effect Intensity** master (full / low / off) that governs
 * the VFX layer AND, at `off`, mutes audio — one control for the whole feel
 * layer (D-24365). Mounted once at the shared viewport root (`PlayViewport.vue`).
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
    const { intensity, setIntensity } = useEffectIntensity();

    // why: cycle order + per-level glyph for the unified Effect-Intensity
    // master. full ⇒ everything; low ⇒ word + particles, no shake; off ⇒ the
    // whole feel layer silent (visuals blank AND audio muted).
    const INTENSITY_ORDER: readonly EffectIntensity[] = ['full', 'low', 'off'];
    const INTENSITY_GLYPH: Readonly<Record<EffectIntensity, string>> = {
      full: '✨',
      low: '✦',
      off: '⊘',
    };
    const intensityGlyph = computed<string>(() => INTENSITY_GLYPH[intensity.value]);

    function onCycleIntensity(): void {
      engine.arm();
      const nextIndex =
        (INTENSITY_ORDER.indexOf(intensity.value) + 1) % INTENSITY_ORDER.length;
      // why: the modulo keeps nextIndex in range, but noUncheckedIndexedAccess
      // types the lookup as possibly-undefined; the `?? 'full'` is an
      // unreachable, type-satisfying fallback.
      const next = INTENSITY_ORDER[nextIndex] ?? 'full';
      setIntensity(next);
      // why: the UNIFIED master (D-24365) — cycling to `off` silences the whole
      // feel layer (blank visuals AND mute audio); cycling back on restores
      // audio, so one control governs both sensory layers.
      isMuted.value = next === 'off';
    }

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

    return {
      isMuted,
      volume,
      intensity,
      intensityGlyph,
      onCycleIntensity,
      onToggleMute,
      onVolumeInput,
    };
  },
});
</script>

<template>
  <div class="audio-controls" data-testid="audio-controls">
    <button
      type="button"
      class="audio-controls__intensity"
      data-testid="vfx-intensity-toggle"
      :data-intensity="intensity"
      :title="`Effect intensity: ${intensity} (click to cycle)`"
      @click="onCycleIntensity"
    >
      {{ intensityGlyph }}
    </button>
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

.audio-controls__mute,
.audio-controls__intensity {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.1rem 0.2rem;
}

/* why: dim the intensity glyph as the level drops, so the current state reads
   at a glance (full = bright, off = faint). */
.audio-controls__intensity[data-intensity="low"] {
  opacity: 0.7;
}

.audio-controls__intensity[data-intensity="off"] {
  opacity: 0.45;
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
