<script lang="ts">
import { defineComponent, computed, reactive } from 'vue';
import {
  parseAbilityMarkers,
  abilityTokenDisplay,
  abilityTokenLabel,
  abilityTokenIconUrl,
  type AbilityToken,
} from '../../lib/abilityMarkers';

/** One token plus its resolved render data, computed once per line. */
interface RenderedToken {
  token: AbilityToken;
  /** SVG icon URL, or null when the token renders as text. */
  iconUrl: string | null;
  /** Alt / title / text-fallback word (never a glyph). */
  label: string;
  /** Text / glyph rendering when there is no icon. */
  display: string;
}

/**
 * Inline renderer for one line of ability / rules text.
 *
 * The engine projection ships scheme / mastermind / card text with inline
 * markup (`[icon:attack]`, `[hc:strength]`, `[team:X-Men]`, `[keyword:Patrol]`,
 * ...). Rendering the raw string shows the player the literal brackets; this
 * component parses the markers and renders each hero-class / resource / team
 * marker as its real SVG icon (matching the printed card), falling back to a
 * readable word if the image cannot load.
 *
 * Per the EC-132 §2 SFC authoring whitelist this leaf uses
 * `defineComponent({ setup() { return {...} } })`. Mirrors CardReaderModal.
 */
export default defineComponent({
  name: 'AbilityText',
  props: {
    /** A single ability / rules-text line from the engine projection. */
    text: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const parts = computed<RenderedToken[]>(() =>
      parseAbilityMarkers(props.text).map((token) => ({
        token,
        iconUrl: abilityTokenIconUrl(token),
        label: abilityTokenLabel(token),
        display: abilityTokenDisplay(token),
      })),
    );

    // why: an icon whose SVG 404s (e.g. an unknown team slug) must degrade to
    // its text label rather than a broken-image glyph. Track failures by index
    // so the template swaps that one token to text and keeps the rest as icons.
    const failedIcons = reactive<Record<number, true>>({});
    function markIconFailed(index: number): void {
      failedIcons[index] = true;
    }

    return { parts, failedIcons, markIconFailed };
  },
});
</script>

<template><!--
  why: rendered as a single inline run — text tokens as bare copy, icon
  markers as inline <img> SVGs, and any icon that fails to load falls back to
  its text label — so the line reads naturally with no stray whitespace.
--><span class="ability-text"><template
      v-for="(part, index) in parts"
      :key="index"
    ><img
        v-if="part.iconUrl !== null && failedIcons[index] !== true"
        :src="part.iconUrl"
        :alt="part.label"
        :title="part.label"
        :class="['ability-icon-img', `ability-icon-img--${part.token.type}`]"
        @error="markIconFailed(index)"
      /><span
        v-else-if="part.token.type !== 'text'"
        :class="['ability-token', `ability-token--${part.token.type}`]"
      >{{ part.display }}</span><template v-else>{{ part.token.value }}</template></template></span></template>

<style scoped>
/* why: inline SVG icons sized to the surrounding text and nudged onto the
   text baseline so "+1[attack]" and "reveal a [strength] Hero" read as one
   run. `1.15em` keeps the glyph legible without overpowering the line. */
.ability-icon-img {
  height: 1.15em;
  width: auto;
  vertical-align: -0.2em;
}

/* why: resource icons sit tight against the number they modify ("+1[attack]");
   class / team icons get a hair of breathing room from the surrounding words. */
.ability-icon-img--hc,
.ability-icon-img--team {
  margin: 0 0.15em;
}

.ability-token {
  font-weight: 600;
  white-space: nowrap;
}

.ability-token--icon {
  padding: 0 0.05em;
}

/* why: text fallback for a hero-class whose icon failed to load — a small
   chip so the class still reads distinctly. */
.ability-token--hc {
  display: inline-block;
  padding: 0 0.35em;
  border-radius: 0.25rem;
  background: var(--color-foreground, #444);
  color: var(--color-background, #fff);
  font-size: 0.85em;
}

.ability-token--keyword,
.ability-token--rule,
.ability-token--team {
  font-style: italic;
}
</style>
