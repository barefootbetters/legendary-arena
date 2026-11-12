<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingSeatChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Foundational inline prompt for a non-active / multi-seat pending choice
 * (WP-684 / D-24501).
 *
 * This is the SCAFFOLD the capability WP shipped; the concrete, card-specific
 * headings ship with the consuming cards. WP-683 (D-24500) adds the Deadpool
 * headings: 'here-hold-this' (pick a Villain to capture a Bystander),
 * 'random-acts-wound' (optional gain-a-Wound-to-hand), and 'random-acts-pass-left'
 * (pass a card to the player on your left). WP-793 (D-24656) adds the escape
 * procedure's 'escape-hq-ko' and 'escape-bystander-discard' headings and the
 * non-active 'return-on-discard' heading. It renders one button per option from
 * the VIEWER'S OWN prompt only
 * (`pendingSeatChoice.seatPrompts[viewerPlayerId]`) — the engine's per-seat
 * audience filter has already redacted the projection to the viewing seat, so a
 * seat never sees another seat's options.
 *
 * Renders iff `pendingSeatChoice !== undefined AND viewerPlayerId` is an
 * addressed, still-outstanding seat (i.e. its own prompt is present). This is the
 * same posture that lets a NON-ACTIVE seat see and answer a choice addressed to
 * it while the active player is blocked. Pressing an option submits
 * `resolveSeatChoice({ optionIndex })`.
 *
 * // why: the choice is game-blocking (the engine block-all guard freezes turn
 * progress until every addressed seat resolves); the only exits are the option
 * buttons. Mirrors CountScaledChoicePrompt — NOT a modal, renders in normal
 * document flow. Controls disable after submit (double-move guard).
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: "PendingSeatChoicePrompt",
  props: {
    pendingSeatChoice: {
      type: Object as PropType<UIPendingSeatChoice | undefined>,
      required: false,
      default: undefined,
    },
    viewerPlayerId: {
      // why: null signals a spectator with no assigned playerId; the prompt must not render.
      type: [String, null] as unknown as PropType<string | null>,
      required: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props) {
    // why: debounce the controls after a submit so the prompt never fires
    // resolveSeatChoice twice for one choice. Reset on every new server frame (a
    // fresh pendingSeatChoice identity) so the controls re-enable for the next
    // choice and recover from a no-op resubmit (mirrors CountScaledChoicePrompt).
    const isSubmitting = ref(false);
    watch(
      () => props.pendingSeatChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    /** This viewer's own prompt (the filter redacts the projection to only this seat). */
    function ownOptions(): { label: string }[] {
      const choice = props.pendingSeatChoice;
      if (choice === undefined || props.viewerPlayerId === null) {
        return [];
      }
      return choice.seatPrompts[props.viewerPlayerId]?.options ?? [];
    }

    function shouldRender(): boolean {
      return (
        props.pendingSeatChoice !== undefined &&
        props.viewerPlayerId !== null &&
        ownOptions().length > 0
      );
    }

    /**
     * The card-specific heading for this choice, keyed by the projection's `kind`.
     * Diving Block (WP-682 / D-24499) and the Deadpool kinds (WP-683 / D-24500) are the
     * concrete consumers; "Your choice" is the foundational fallback for any other kind.
     */
    function heading(): string {
      switch (props.pendingSeatChoice?.kind) {
        case 'diving-block':
          return 'You would gain a Wound — Diving Block?';
        // why: WP-827 / D-24760 — the Wound may be another player's; the option labels name whose.
        case 'flying-shield-block':
          return 'A player would gain a Wound — Flying Shield Block?';
        // why: WP-828 / D-24761 — Winter Soldier's 2>4: pick the hand Hero that goes Out of Time.
        case 'out-of-time-grant':
          return 'Choose a Hero in your hand to gain Man Out of Time this turn';
        case 'here-hold-this':
          return 'Choose a Villain to capture a Bystander';
        case 'random-acts-wound':
          return 'Gain a Wound to your hand?';
        case 'random-acts-pass-left':
          return 'Choose a card to pass to the player on your left';
        // why: WP-694 / D-24511 — the two multi-seat core mastermind tactics. The
        // Monarch's Decree mode choice is the active player's draw-vs-discard pick; the
        // discard + KO kinds are each addressed seat's own concurrent pick.
        case 'monarchs-decree-mode':
          return 'Monarch’s Decree: choose one for the other players';
        case 'monarchs-discard':
          return 'Choose a card to discard (Monarch’s Decree)';
        case 'vanishing-illusions-ko':
          return 'Choose a Villain to KO from your Victory Pile (Vanishing Illusions)';
        // why: WP-793 / D-24656 — the rulebook escape procedure (the current player's HQ
        // KO pick, then every player's Bystander discard) and a non-active seat's own
        // return-on-discard answer.
        // why: WP-829 / D-24762 — Go Back in Time: every HQ Hero sharing the pick's name is KO'd.
        case 'timestream-purge':
          return 'Go Back in Time — choose a Hero in the HQ to Purge from the Timestream';
        case 'escape-hq-ko':
          return 'A Villain escaped — choose a Hero in the HQ to KO';
        case 'escape-bystander-discard':
          return 'Bystanders were carried away — choose a card to discard';
        // why: WP-817 / D-24750 — an owed Escape-effect discard (Primus: each player
        // discards a Hero that costs 2, 3, 5, or 7); the options are already filtered.
        case 'escape-effect-cost-discard':
          return 'A Villain escaped — choose a Hero to discard';
        // why: WP-837 / D-24770 — an owed every-player Hero-trait discard (co2e Mystique /
        // Frost Giant Warrior Ambush); the options are already filtered.
        case 'villain-effect-trait-discard':
          return 'A Villain\'s effect — choose a Hero to discard';
        // why: WP-830 / D-24763 — The Unbreakable Enigma Code's paid peek after a Villain fight.
        case 'enigma-peek':
          return 'Enigma Code — pay 1 Recruit to look at a face-down card?';
        case 'return-on-discard':
          return 'Return the discarded card to your hand?';
        // why: WP-845 / D-24779 — a player who can reveal for "reveal … or gain a Wound" may
        // decline and take the Wound (rules v23 L3196-3200); the options name the Hero needed.
        case 'reveal-or-wound':
          return 'Reveal a Hero or gain a Wound?';
        // why: WP-876 / D-24823 — Revolutionary Anthem's optional Villain Deck shuffle after a
        // Heist that revealed a Scheme Twist (options: Shuffle / Leave).
        case 'heist-shuffle-villain-deck':
          return 'Revolutionary Anthem: shuffle the Villain Deck?';
        // why: WP-882 / D-24833 — Zarathos's tactic choices (WP-758 / D-24588) name their tactic
        // and what is asked; the discard-down kind is asked once per card owed.
        case 'zarathos-corrupted-spirit-discard-down':
          return 'Corrupted Spirit of Vengeance — discard down to 3 cards: choose a card to discard';
        case 'zarathos-eruption':
          return 'Eruption of Hellfire — discard a Covert or Ranged Hero, or gain a Wound';
        case 'zarathos-corrupted-spirit':
          return 'Corrupted Spirit of Vengeance — discard an Instinct or Covert Hero, or discard down to 3 cards';
        case 'zarathos-imprison':
          return 'Imprison in the Soul Crystal — KO a Villain from your Victory Pile and draw cards equal to its VP?';
        case 'zarathos-demonic-essence-first':
        case 'zarathos-demonic-essence-last':
          return 'Demonic Essence of Ghost Rider — KO one of your Heroes?';
        // why: WP-883 / D-24834 — "You may gain a Wound. If you do, you get +N Attack" (Hulk
        // Smash!, Scalded by Sunlight). The two options carry the +N.
        case 'gain-wound-reward':
          return 'Gain a Wound for extra Attack?';
        // why: WP-884 / D-24835 — Stalk the Night Stalkers' Hunt for Victims: the options name each
        // Bystander holder (or, with none, each hunter) and the decline.
        case 'hunt-for-victims':
          return 'Have a Villain or Mastermind Hunt for Victims?';
        // why: WP-884 / D-24835 — the optional KO that follows a Bystander KO or rescue; the options
        // name each Hero and its zone.
        case 'hunt-for-victims-ko-hero':
          return 'KO a Hero from your hand or discard pile?';
        // why: WP-889 / D-24841 — a Lilin Villain's mandatory Hunt for Victims: the options name each
        // Bystander holder; no decline (the rules text has no "may").
        case 'villain-hunt-for-victims':
          return "Hunt for Victims: choose which Bystander is KO'd";
        default:
          return 'Your choice';
      }
    }

    function onChoose(optionIndex: number): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveSeatChoice", { optionIndex });
    }

    return {
      isSubmitting,
      shouldRender,
      ownOptions,
      onChoose,
      heading,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="pending-seat-choice-prompt"
    data-testid="pending-seat-choice-prompt"
    role="region"
    :aria-label="heading()"
  >
    <h3 class="pending-seat-choice-prompt__heading" data-testid="pending-seat-choice-heading">{{ heading() }}</h3>
    <div class="pending-seat-choice-prompt__buttons">
      <button
        v-for="(option, index) in ownOptions()"
        :key="index"
        type="button"
        class="pending-seat-choice-prompt__btn"
        :data-testid="`pending-seat-choice-option-${index}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose(index)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.pending-seat-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-seat-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-seat-choice-prompt__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pending-seat-choice-prompt__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.pending-seat-choice-prompt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
