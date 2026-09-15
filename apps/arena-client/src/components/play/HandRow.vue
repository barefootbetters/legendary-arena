<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { UICardDisplay } from '@legendary-arena/game-engine';
import { useTurnActions } from '../../composables/useTurnActions';
import CardTile from './CardTile.vue';
import { computeHandArc } from './handArc';
import { WOUND_EXT_ID } from './woundIdentity';
import type { SubmitMove } from './uiMoveName.types';

/**
 * Active player's hand row — renders one button per CardExtId in
 * `players[ownIndex].handCards`. WP-129 extends the WP-100 scaffold with
 * `handDisplay` integration (display name + image lookup) and binds the
 * stage-gating reason from {@link useTurnActions} per EC-132 §3 disabled-
 * state tooltip precedence.
 *
 * Cost gating does NOT apply to playCard — every hand card may be played
 * during the main step regardless of economy state. Only stage gating
 * applies here.
 *
 * Per the EC-132 §2 SFC authoring whitelist: this is a tested non-leaf
 * composer that USES a composable, so it MUST use
 * `defineComponent({ setup() { return {...} } })` per P6-30 / P6-46 /
 * D-6512.
 *
 * @see WP-129 §Acceptance Criteria — Click-to-play handCards
 * @see EC-132 §2 move table — Hand card → playCard at play.main
 * @see EC-132 §3 disabled-state tooltip precedence
 */
export default defineComponent({
  name: 'HandRow',
  components: { CardTile },
  props: {
    handCards: {
      type: Array as PropType<readonly string[]>,
      required: true,
    },
    /**
     * Parallel display payload for `handCards`; populated by WP-128's
     * `players[ownIndex].handDisplay`. Length must match `handCards`
     * exactly when present. Undefined when redacted (other audiences) —
     * but for the active-player surface the field is always present.
     */
    handDisplay: {
      type: Array as PropType<readonly UICardDisplay[] | undefined>,
      required: false,
      default: undefined,
    },
    currentStage: {
      type: String,
      required: true,
    },
    isViewerTurn: {
      type: Boolean,
      required: false,
      default: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props) {
    // why: a Wound (WOUND_EXT_ID) carries no play value and CANNOT be played
    // (wiki/wounds.md — "there is no 'play a Wound' path"). The engine playCard
    // has no effect for a Wound, but before this guard the tile still rendered
    // as a normal playCard button; clicking it moved the Wound from hand to
    // inPlay, which silently disabled the Heal-Wounds ability (heal KOs Wounds
    // FROM HAND, so a Wound in inPlay is unreachable). Gate the Wound tile here.
    function isWound(cardId: string): boolean {
      return cardId === WOUND_EXT_ID;
    }

    function onPlay(cardId: string): void {
      // why: never submit a playCard for a Wound — the tile is disabled, but a
      // CardTile interactive click path must not slip a Wound play through.
      if (isWound(cardId)) {
        return;
      }
      props.submitMove('playCard', { cardId });
    }

    function buttonReason(cardId: string): string | null {
      // why: per EC-132 §3 disabled-state tooltip precedence — stage →
      // resource → structural. playCard has no resource cost (any playable
      // hand card may be played); the stage gate applies first, then the
      // Wound structural gate.
      const gate = useTurnActions(props.currentStage, props.isViewerTurn).canPlayCard();
      if (!gate.allowed) {
        return gate.reason;
      }
      if (isWound(cardId)) {
        return 'Wounds cannot be played. Use Heal Wounds to KO all Wounds from your hand.';
      }
      return null;
    }

    function buttonDisabled(cardId: string): boolean {
      if (!useTurnActions(props.currentStage, props.isViewerTurn).canPlayCard().allowed) {
        return true;
      }
      // why: a Wound is never playable even when the stage allows play — disable
      // its tile so the player cannot play a Wound out of hand and lose the
      // Heal-Wounds affordance for the turn.
      return isWound(cardId);
    }

    function humanizeCardId(cardId: string): string {
      // why: produce a readable label from a CardExtId when the engine's
      // cardDisplayData lookup misses (returns the WP-111
      // UNKNOWN_DISPLAY_PLACEHOLDER with name '<unknown>'). The starter
      // cards `'starting-shield-agent'` / `'starting-shield-trooper'`
      // are engine-synthetic and not in the registry, so
      // buildCardDisplayData does not populate entries for them — a
      // future engine WP will close the gap. This fallback is
      // formatting-only (replace dashes with spaces); no engine
      // knowledge of canonical card names lives client-side.
      return cardId.replace(/-/g, ' ');
    }

    function displayName(cardId: string, index: number): string {
      if (props.handDisplay !== undefined && index < props.handDisplay.length) {
        const candidate = props.handDisplay[index]!.name;
        // why: detect the WP-111 UNKNOWN_DISPLAY_PLACEHOLDER shape and
        // fall back to a humanized cardId. The placeholder ships with
        // name '<unknown>' and imageUrl '' (per
        // packages/game-engine/src/ui/uiState.build.ts:73-78). Either
        // signal indicates the engine has no display data for this
        // ext_id; the cardId itself is informative enough as a fallback
        // until the engine gap is closed.
        if (candidate !== '<unknown>') {
          return candidate;
        }
      }
      return humanizeCardId(cardId);
    }

    function displayForIndex(index: number): UICardDisplay | null {
      if (props.handDisplay !== undefined && index < props.handDisplay.length) {
        const entry = props.handDisplay[index]!;
        if (entry.name !== '<unknown>') {
          return entry;
        }
      }
      return null;
    }

    function resolveDisplay(cardId: string, index: number): UICardDisplay {
      const existing = displayForIndex(index);
      if (existing !== null) {
        return existing;
      }
      return {
        extId: cardId,
        name: humanizeCardId(cardId),
        imageUrl: '',
        cost: null,
      };
    }

    function arcStyle(index: number): Record<string, string> {
      // why: WP-699 — bind the pure arc geometry as CSS custom properties the
      // hand-rolled CSS applies as a transform (no animation dependency, D-24365).
      const { rotationDegrees, offsetPx } = computeHandArc(props.handCards.length, index);
      return {
        '--hand-card-rotation': `${rotationDegrees}deg`,
        '--hand-card-offset': `${offsetPx}px`,
      };
    }

    function listStyle(): Record<string, string> {
      // why: small hands sit with positive spacing; once the hand grows past
      // what the well holds, cards overlap (negative margin) so the fan never
      // overflows the fitted 1280×720 board (WP-688) and forces a page scroll.
      // Capped at -40px so overlapping cards stay legible.
      const count = props.handCards.length;
      const spacingPx = count <= 6 ? 8 : Math.max(-40, 8 - (count - 6) * 9);
      return { '--hand-card-spacing': `${spacingPx}px` };
    }

    return {
      onPlay,
      buttonReason,
      buttonDisabled,
      displayName,
      displayForIndex,
      resolveDisplay,
      arcStyle,
      listStyle,
    };
  },
});
</script>

<template>
  <section
    class="hand-row"
    data-testid="play-hand-row"
    aria-label="Hand"
  >
    <header class="hand-row__heading" data-testid="play-hand-heading">
      Your Hand — {{ handCards.length }} unplayed
    </header>
    <p
      v-if="handCards.length === 0"
      class="hand-empty"
      data-testid="play-hand-empty"
    >
      Hand is empty.
    </p>
    <ul v-else class="hand-cards" :style="listStyle()">
      <li
        v-for="(cardId, index) in handCards"
        :key="`${cardId}-${index}`"
        class="hand-card"
        :style="arcStyle(index)"
      >
        <button
          type="button"
          data-testid="play-hand-card"
          :data-card-id="cardId"
          :disabled="buttonDisabled(cardId)"
          :aria-disabled="buttonDisabled(cardId) ? 'true' : undefined"
          :title="buttonReason(cardId) ?? undefined"
          @click="onPlay(cardId)"
        >
          <!-- why: disabled-state tooltip precedence locked at EC-132 §3
               (stage → resource → structural). The reason text is bound
               from useTurnActions().canPlayCard() rather than composed
               ad-hoc; the per-card structural gate additionally disables
               the un-playable Wound tile (wounds.md). -->
          <CardTile
            :display="resolveDisplay(cardId, index)"
            size="md"
            :interactive="!buttonDisabled(cardId)"
            :show-label="true"
            :hand-lift="true"
          />
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.hand-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hand-row__heading {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.85;
}

/* WP-699 — the hand fans along a shallow arc (replacing the WP-685 flat
   scroll well). The full handCards array is still bound above (never sliced);
   a hand larger than fits OVERLAPS (negative margin via --hand-card-spacing,
   set from the hand size) rather than scrolling or wrapping, so the fan stays
   inside the fitted 1280×720 board (WP-688) without a page scroll. Centred and
   bottom-aligned so the arc pivots from a common baseline. overflow is visible
   so a hovered lifted card can rise above its neighbours. The top padding
   reserves room for the -12px lift so it is never clipped by the row above. */
.hand-cards {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: flex-end;
  list-style: none;
  padding: 1rem 0 0.25rem;
  margin: 0;
  max-width: 100%;
  overflow: visible;
}

.hand-card {
  flex: 0 0 auto;
  /* why: rotate about the bottom-centre so cards splay like a held fan rather
     than pivoting from their middle. */
  transform-origin: center bottom;
  transform: rotate(var(--hand-card-rotation, 0deg)) translateY(var(--hand-card-offset, 0px));
  transition: transform 0.15s ease-out, margin 0.15s ease-out;
}

.hand-card:not(:first-child) {
  margin-left: var(--hand-card-spacing, 8px);
}

.hand-card button {
  padding: 0;
  border: 0;
  background: transparent;
  cursor: inherit;
  font-variant-numeric: tabular-nums;
}

@media (hover: hover) {
  /* why: the hovered card straightens upright and rises above the fan so it is
     fully readable; the lift itself (translateY + scale + shadow) is on the
     inner CardTile, gated by the feel-layer accessibility contract. */
  .hand-card:hover {
    transform: rotate(0deg) translateY(0);
    z-index: 5;
  }

  /* why: nudge the immediate neighbours outward so the straightened card has
     room — the card to the right eases right, the card to the left eases left
     (:has selects the left neighbour of the hovered card). */
  .hand-card:hover + .hand-card {
    transform: rotate(var(--hand-card-rotation, 0deg)) translateY(var(--hand-card-offset, 0px)) translateX(12px);
  }

  .hand-card:has(+ .hand-card:hover) {
    transform: rotate(var(--hand-card-rotation, 0deg)) translateY(var(--hand-card-offset, 0px)) translateX(-12px);
  }
}

/* why: honour OS reduced-motion — the arc still lays out (a static resting
   shape, not motion), but the hover straighten / nudge apply instantly with no
   animated transition. The CardTile lift is separately suppressed in JS. */
@media (prefers-reduced-motion: reduce) {
  .hand-card {
    transition: none;
  }
}
</style>
