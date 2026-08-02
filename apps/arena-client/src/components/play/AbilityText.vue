<script lang="ts">
import { defineComponent, computed, type PropType } from 'vue';
import {
  parseAbilityMarkers,
  abilityTokenDisplay,
  type AbilityToken,
} from '../../lib/abilityMarkers';

/**
 * Inline renderer for one line of ability / rules text.
 *
 * The engine projection ships scheme / mastermind / card text with inline
 * markup (`[icon:attack]`, `[hc:strength]`, `[keyword:Patrol]`, ...). Rendering
 * the raw string shows the player the literal brackets; this component parses
 * the markers and renders each as a readable glyph / label so the
 * CardReaderModal reads like the printed card.
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
    const tokens = computed<AbilityToken[]>(() =>
      parseAbilityMarkers(props.text),
    );

    // why: text tokens render as plain copy; marker tokens render inside a
    // typed span so CSS can style icons / hero-class chips. The display string
    // (glyph or label) is resolved once here rather than in the template.
    function tokenText(token: AbilityToken): string {
      return abilityTokenDisplay(token);
    }

    return { tokens, tokenText };
  },
});
</script>

<template><!--
  why: rendered as a single inline run — text tokens as bare copy, marker
  tokens as styled spans — so the line reads naturally with no stray
  whitespace between segments.
--><span class="ability-text"><template
      v-for="(token, index) in tokens"
      :key="index"
    ><span
        v-if="token.type !== 'text'"
        :class="['ability-token', `ability-token--${token.type}`]"
      >{{ tokenText(token) }}</span><template v-else>{{ token.value }}</template></template></span></template>

<style scoped>
.ability-token {
  font-weight: 600;
  white-space: nowrap;
}

/* why: resource glyphs (⚔ ★ ◆ …) read as inline symbols alongside the number
   they modify (e.g. "+1⚔"); a hair of horizontal breathing room keeps them
   legible without breaking the "+1⚔" adjacency. */
.ability-token--icon {
  padding: 0 0.05em;
}

/* why: hero-class markers render as small coloured chips so class-synergy text
   ("reveal a Strength Hero") stands out the way it does on the printed card. */
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
