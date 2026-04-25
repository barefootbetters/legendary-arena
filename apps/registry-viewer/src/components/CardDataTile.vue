<script setup lang="ts">
/**
 * CardDataTile.vue
 * Tile-sized structured-data view for a single FlatCard.
 *
 * why: this is the grid-tile cousin of CardDataDisplay.vue (the sidebar
 * data view). The field set rendered here is locked at WP-096 / EC-096
 * ratification — see docs/ai/work-packets/WP-096-registry-viewer-grid-
 * data-view.md §Locked Values and docs/ai/DECISIONS.md D-9601. Six of
 * the seven labelled rows ("Type", "Class", "Cost", "Attack", "Recruit",
 * "Rarity") are byte-identical to the labels at CardDataDisplay.vue:73,
 * 86, 101, 106, 111, 116. The seventh row deliberately diverges: this
 * tile uses the compact label "Set" rendering FlatCard.setAbbr, while
 * the sidebar at CardDataDisplay.vue:78 uses "Edition" rendering
 * FlatCard.setName with setAbbr parenthesized. The divergence is a
 * tile-compaction choice — the 130px-min `.img-wrap` box (3:4 aspect)
 * cannot accommodate full set names like "Marvel Studios: What If…?"
 * without ellipsis defenses or grid-column reflow.
 *
 * Ability text is intentionally omitted from the tile per D-9601: the
 * sidebar (CardDataDisplay.vue) is the place to read full ability text,
 * and rendering ability strings on a 130px-wide tile would either
 * overflow the 3:4 box or require grid-column resizing.
 *
 * AND-semantics: empty / null / undefined / empty-string fields are
 * omitted entirely (no em-dash, no "—", no placeholder). Guard forms
 * mirror CardDataDisplay.vue exactly for the six common rows.
 */

import type { FlatCard } from "../registry/browser";

defineProps<{ card: FlatCard }>();
</script>

<template>
  <section class="card-data-tile" :aria-label="`Data view for ${card.name}`">
    <h3 v-if="card.name" class="card-data-tile-title">{{ card.name }}</h3>

    <dl class="data-grid">
      <template v-if="card.cardType">
        <dt>Type</dt>
        <dd class="capitalize">{{ card.cardType }}</dd>
      </template>

      <template v-if="card.setAbbr">
        <dt>Set</dt>
        <dd>{{ card.setAbbr }}</dd>
      </template>

      <template v-if="card.hc">
        <dt>Class</dt>
        <dd class="capitalize">{{ card.hc }}</dd>
      </template>

      <!--
        why: the cost guard uses an explicit `!== undefined && !== null`
        check rather than truthiness (`v-if="card.cost"`). A zero-cost
        card is legitimate and present in the source data — truthiness
        would hide every legitimate zero-cost card, breaking AND-semantics
        and silently dropping a real attribute.
      -->
      <template v-if="card.cost !== undefined && card.cost !== null">
        <dt>Cost</dt>
        <dd>{{ card.cost }}</dd>
      </template>

      <!--
        why: the attack and recruit fields are typed `string | null` on
        FlatCard, but real card JSON sometimes carries the empty string
        "" in lieu of null for these fields. The empty-string clause is
        required to keep AND-semantics: omit the row entirely when the
        card has no fight or recruit value, regardless of which empty
        sentinel the source data used.
      -->
      <template v-if="card.attack !== undefined && card.attack !== null && card.attack !== ''">
        <dt>Attack</dt>
        <dd>{{ card.attack }}</dd>
      </template>

      <template v-if="card.recruit !== undefined && card.recruit !== null && card.recruit !== ''">
        <dt>Recruit</dt>
        <dd>{{ card.recruit }}</dd>
      </template>

      <template v-if="card.rarityLabel">
        <dt>Rarity</dt>
        <dd>{{ card.rarityLabel }}</dd>
      </template>
      <template v-else-if="card.rarity !== undefined && card.rarity !== null">
        <dt>Rarity</dt>
        <dd>{{ card.rarity }}</dd>
      </template>
    </dl>
  </section>
</template>

<style scoped>
.card-data-tile {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  background: #12121a;
  color: #d8d8ee;
  padding: 0.45rem 0.5rem;
  overflow: hidden;
  box-sizing: border-box;
}

.card-data-tile-title {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  color: #f0f0ff;
  border-bottom: 1px solid #2a2a3a;
  padding-bottom: 0.3rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 0.45rem;
  row-gap: 0.18rem;
  margin: 0;
  overflow: hidden;
}

.data-grid dt {
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6666aa;
  align-self: baseline;
}

.data-grid dd {
  margin: 0;
  font-size: 0.65rem;
  color: #d8d8ee;
  font-weight: 600;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-grid dd.capitalize {
  text-transform: capitalize;
}

@media print {
  .card-data-tile {
    background: #ffffff;
    color: #000000;
    border: 1px solid #888888;
  }

  .card-data-tile-title {
    color: #000000;
    border-bottom-color: #888888;
  }

  .data-grid dt {
    color: #333333;
  }

  .data-grid dd {
    color: #000000;
  }
}
</style>
