<script lang="ts">
import { defineComponent, onMounted, ref, type PropType } from 'vue';
import type { UIPlayerState } from '@legendary-arena/game-engine';
import { playerLabel } from '../../vfx/scoreCalcDisplay';

/** One "Give it to" choice: the seat that gains the Hero and its button label. */
interface ExorciseRecipient {
  playerId: string;
  label: string;
}

/** The payload this chooser emits; HQRow forwards it verbatim to `exorciseHauntedHero`. */
export type ExorciseChoice =
  | { hqIndex: number; outcome: 'ko' }
  | { hqIndex: number; outcome: 'gain'; recipientPlayerId: string };

/**
 * The Exorcise decision for a Haunted HQ Hero (WP-759 / D-24587, rulebook v23 p.27):
 * after paying the Hero's cost, KO it or choose a player to gain it.
 *
 * An in-flow panel HQRow renders below its slot list (never absolute or fixed; see
 * HQRow). Buttons only: KO the Hero, one "Give it to" button per seat (the viewer
 * first, as "You"), and Cancel. It opens with focus on KO; Escape or Cancel emit
 * `close`, and HQRow returns focus to the Exorcise button. The chooser decides
 * nothing: it emits the intent, and the engine validates and resolves it.
 *
 * Per the EC-132 §2 SFC authoring whitelist (D-6512) it uses
 * `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: 'HauntedExorciseChooser',
  emits: ['choose', 'close'],
  props: {
    hqIndex: {
      type: Number,
      required: true,
    },
    heroName: {
      type: String,
      required: true,
    },
    // why: the printed cost the engine charges (G.cardStats); null when the slot has
    // no projected display, in which case the heading names no price.
    cost: {
      type: Number as PropType<number | null>,
      required: false,
      default: null,
    },
    players: {
      type: Array as PropType<UIPlayerState[]>,
      required: true,
    },
    viewerPlayerId: {
      type: String,
      required: true,
    },
  },
  setup(props, { emit }) {
    const koButton = ref<HTMLButtonElement | null>(null);

    /**
     * The seats that can gain the Hero: the viewer first ("You"), then every other
     * seat in `players` order, labelled "Player N".
     *
     * @returns The ordered recipient list.
     */
    function recipients(): ExorciseRecipient[] {
      const ordered: ExorciseRecipient[] = [{ playerId: props.viewerPlayerId, label: 'You' }];
      for (const player of props.players) {
        if (player.playerId === props.viewerPlayerId) {
          continue;
        }
        // why: UIState.players carries no display name and seatIdentities is null until
        // game over, so the seat label is the same "Player N" the endgame summary uses.
        ordered.push({ playerId: player.playerId, label: playerLabel(player.playerId, undefined) });
      }
      return ordered;
    }

    /**
     * The panel heading, naming the Hero and, when known, the price.
     *
     * @returns For example "Exorcise Iron Man (pay 6 Recruit)".
     */
    function heading(): string {
      if (props.cost === null) {
        return `Exorcise ${props.heroName}`;
      }
      return `Exorcise ${props.heroName} (pay ${String(props.cost)} Recruit)`;
    }

    /** Emits the KO outcome. */
    function onKo(): void {
      // why: D-24587 — KO sends no recipientPlayerId; the engine reads one only for 'gain'.
      const choice: ExorciseChoice = { hqIndex: props.hqIndex, outcome: 'ko' };
      emit('choose', choice);
    }

    /**
     * Emits the give-to-a-player outcome.
     *
     * @param recipientPlayerId - The seat that gains the Hero (its discard pile).
     */
    function onGive(recipientPlayerId: string): void {
      const choice: ExorciseChoice = { hqIndex: props.hqIndex, outcome: 'gain', recipientPlayerId };
      emit('choose', choice);
    }

    /**
     * Closes on Escape while focus is inside the panel.
     *
     * @param event - The keydown from inside the panel.
     */
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.stopPropagation();
        emit('close');
      }
    }

    // why: the chooser opens from a click on the Exorcise button; moving focus to the
    // first choice makes it keyboard-operable at once, and Escape works from there.
    onMounted(() => {
      koButton.value?.focus();
    });

    return { koButton, recipients, heading, onKo, onGive, onKeyDown };
  },
});
</script>

<template>
  <div
    class="exorcise-chooser"
    data-testid="play-exorcise-chooser"
    role="group"
    :aria-label="heading()"
    @keydown="onKeyDown"
  >
    <p class="exorcise-chooser__heading">{{ heading() }}</p>
    <div class="exorcise-chooser__actions">
      <button
        ref="koButton"
        type="button"
        class="exorcise-chooser__ko"
        data-testid="play-exorcise-ko"
        @click="onKo"
      >
        KO the Hero
      </button>
      <span class="exorcise-chooser__give-label">Give it to:</span>
      <button
        v-for="recipient in recipients()"
        :key="recipient.playerId"
        type="button"
        class="exorcise-chooser__give"
        data-testid="play-exorcise-give"
        :data-recipient-id="recipient.playerId"
        @click="onGive(recipient.playerId)"
      >
        {{ recipient.label }}
      </button>
      <button
        type="button"
        class="exorcise-chooser__cancel"
        data-testid="play-exorcise-cancel"
        @click="$emit('close')"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<style scoped>
/* why: in flow, but no wider than the screen and pinned to the left edge of the
   sideways-scrolling HQ band (PlayMobile's --scroll-x band), so every choice is
   reachable without scrolling the band. Sticky stays in normal flow (not
   absolute / fixed), so the overflow clip and the fit-stage transform can't
   offset it. */
.exorcise-chooser {
  position: sticky;
  left: 0.5rem;
  align-self: flex-start;
  box-sizing: border-box;
  width: max-content;
  max-width: calc(100vw - 2rem);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.6rem;
  padding: 0.3rem 0.5rem;
  border: 2px solid var(--color-haunt, #5b21b6);
  border-radius: 0.35rem;
  /* why: the play-surface prompt tokens (PendingSeatChoicePrompt), so the heading
     reads in both themes; the haunt purple border ties it to the haunter strip. */
  background: var(--color-background, #fff);
  color: var(--color-foreground, #222);
  font-size: 0.8rem;
}

.exorcise-chooser__heading {
  margin: 0;
  font-weight: 700;
}

.exorcise-chooser__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}

.exorcise-chooser__give-label {
  margin-left: 0.4rem;
}

.exorcise-chooser button {
  padding: 0.15rem 0.5rem;
  font-size: 0.8rem;
}
</style>
