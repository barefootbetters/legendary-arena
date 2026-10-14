<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, reactive, ref, watch, type PropType } from 'vue';
import { Pane } from 'tweakpane';
import { OPERATOR_ECONOMY_MAX_AMOUNT, OPERATOR_SUPPLY_PILES } from '@legendary-arena/game-engine';
import type {
  OperatorEconomyResource,
  OperatorRevealCardType,
  OperatorSupplyPile,
  OperatorView,
} from '@legendary-arena/game-engine';

import type { SubmitMove } from './uiMoveName.types';
import {
  PILE_LABEL,
  buildCardSources,
  buildDeckCardOptions,
  buildDeckTopIntent,
  buildDestinations,
  buildEconomyIntent,
  buildEscapeIntent,
  buildMoveCardIntent,
  buildRevealNowIntent,
  buildSupplyCountIntent,
  hasEscapeCandidate,
  isSetterWindowOpen,
  type OperatorSetterIntent,
} from '../../lib/operatorSetterIntents';

/** A Tweakpane folder, as `Pane.addFolder` returns it. */
type SetterFolder = ReturnType<Pane['addFolder']>;

/** One Tweakpane list option. */
interface ListOption {
  text: string;
  value: string;
}

/** The selections the pane binds; they live outside the pane so a rebuild keeps them. */
interface SetterParams {
  pile: OperatorSupplyPile;
  count: number;
  villainCard: string;
  heroCard: string;
  hqSpace: number;
  source: string;
  destination: string;
  resource: OperatorEconomyResource;
  amount: number;
}

const CLOSED_HINT = 'Setters run on your turn, in the main stage, with no choice open.';
const OPEN_HINT = 'Setters change the board through the engine. A refused setter changes nothing.';

/** The pile list options, in WP-806's display order. */
const PILE_OPTIONS: ListOption[] = OPERATOR_SUPPLY_PILES.map((pile) => ({ text: PILE_LABEL[pile], value: pile }));

/** The turn resource list options. */
const RESOURCE_OPTIONS: ListOption[] = [
  { text: 'Attack', value: 'attack' },
  { text: 'Recruit', value: 'recruit' },
];

/**
 * Keep a selection that is still among the options, else take the first one.
 *
 * @param current The current selection.
 * @param options The options now offered.
 * @returns The kept selection, the first option's value, or `''` when there are none.
 */
function keepOrFirst(current: string, options: readonly { value: string }[]): string {
  for (const option of options) {
    if (option.value === current) {
      return current;
    }
  }
  return options[0]?.value ?? '';
}

/**
 * Operator Setters pane (WP-807 / EC-844 / D-24689 §6 / D-24713).
 *
 * A Tweakpane control pane inside the WP-804 operator panel. Its six folders
 * submit WP-806's six `operator*` moves through the prop-drilled `submitMove`
 * and emit `submitted` so the panel refreshes the board. It only submits
 * intent: it never edits state or runs a rule, and the engine decides every
 * setter. Card labels are names only, never card text.
 *
 * Loaded only through `defineAsyncComponent` in `OperatorBoardPanel.vue`, so
 * Tweakpane ships in its own lazy chunk. Uses `defineComponent({ setup })` per
 * D-6512.
 */
export default defineComponent({
  name: 'OperatorSetterPane',
  props: {
    operatorView: {
      type: Object as PropType<OperatorView>,
      required: true,
    },
    playerId: {
      type: String,
      required: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  emits: ['submitted'],
  setup(props, { emit }) {
    const host = ref<HTMLElement | null>(null);
    const params = reactive<SetterParams>({
      pile: 'wounds',
      count: 0,
      villainCard: '',
      heroCard: '',
      hqSpace: 1,
      source: '',
      destination: '',
      resource: 'attack',
      amount: 1,
    });
    let pane: Pane | null = null;

    const isWindowOpen = computed(() => isSetterWindowOpen(props.operatorView, props.playerId));
    const hintText = computed(() => (isWindowOpen.value ? OPEN_HINT : CLOSED_HINT));

    // why: Tweakpane list options are fixed when the binding is created, so the
    // pane is rebuilt whenever an option list, the window state or the escape
    // candidate changes. List order is part of the key: a reorder must rebuild,
    // or the deck options' position labels go stale.
    const rebuildKey = computed(() => {
      const view = props.operatorView;
      return [
        view.villainDeckTopFirst.join(','),
        view.heroDeckTopFirst.join(','),
        buildCardSources(view).map((source) => source.key).join(','),
        buildDestinations(view).map((destination) => destination.key).join(','),
        String(isWindowOpen.value),
        String(hasEscapeCandidate(view)),
      ].join('#');
    });

    // why: presentation only — the engine re-checks the operator match, the turn,
    // the stage and open choices on every setter (WP-806). This click-time
    // re-check reads the current prop, so a click that lands after the turn
    // passed (before the rebuild disables the button) submits nothing.
    /**
     * Submit one setter if the window is open now, then emit `submitted`.
     *
     * @param intent The setter to submit, or `null` when nothing is selected.
     * @param needsEscapeCandidate Whether the setter also needs a Villain at the City's edge.
     */
    function submitIntent(intent: OperatorSetterIntent | null, needsEscapeCandidate: boolean): void {
      const view = props.operatorView;
      if (!isSetterWindowOpen(view, props.playerId)) {
        return;
      }
      if (needsEscapeCandidate && !hasEscapeCandidate(view)) {
        return;
      }
      if (intent === null) {
        return;
      }
      props.submitMove(intent.name, intent.args);
      emit('submitted');
    }

    /**
     * Add a button that submits the intent its builder returns at click time.
     *
     * @param folder The folder to add to.
     * @param title The button title.
     * @param isDisabled Whether the button starts disabled.
     * @param buildIntent Builds the intent from the current selections, or `null` for none.
     * @param needsEscapeCandidate Whether the setter also needs a Villain at the City's edge.
     */
    function addSetterButton(
      folder: SetterFolder,
      title: string,
      isDisabled: boolean,
      buildIntent: () => OperatorSetterIntent | null,
      needsEscapeCandidate = false,
    ): void {
      const button = folder.addButton({ title });
      button.disabled = isDisabled;
      button.on('click', () => submitIntent(buildIntent(), needsEscapeCandidate));
    }

    /**
     * Folder 1, Supply: set a pile to a count.
     *
     * @param target The pane.
     * @param isDisabled Whether its button is disabled.
     */
    function addSupplyFolder(target: Pane, isDisabled: boolean): void {
      const folder = target.addFolder({ title: 'Supply' });
      folder.addBinding(params, 'pile', { label: 'Pile', options: PILE_OPTIONS });
      folder.addBinding(params, 'count', { label: 'Count', min: 0, step: 1 });
      addSetterButton(folder, 'Set supply count', isDisabled, () => buildSupplyCountIntent(params.pile, params.count));
    }

    /**
     * Folder 2, Villain deck: a card to the top, or reveal a twist or strike now.
     * An empty deck binds a list with no options; its empty selection submits nothing.
     *
     * @param target The pane.
     * @param isDisabled Whether its buttons are disabled.
     * @param options The villain deck's card options.
     */
    function addVillainFolder(target: Pane, isDisabled: boolean, options: ListOption[]): void {
      const folder = target.addFolder({ title: 'Villain deck' });
      folder.addBinding(params, 'villainCard', { label: 'Villain card', options });
      addSetterButton(folder, 'Move villain card to top', isDisabled, () =>
        params.villainCard === '' ? null : buildDeckTopIntent('villain', params.villainCard),
      );
      const reveals: [string, OperatorRevealCardType][] = [
        ['Reveal a Scheme Twist now', 'scheme-twist'],
        ['Reveal a Master Strike now', 'mastermind-strike'],
      ];
      for (const [title, cardType] of reveals) {
        addSetterButton(folder, title, isDisabled, () => buildRevealNowIntent(cardType));
      }
    }

    /**
     * The "Place hero in HQ space" intent: hero deck to HQ space `hqSpace` (WP-806 route R4).
     *
     * @returns The intent, or `null` when no hero card is selected.
     */
    function buildPlaceHeroIntent(): OperatorSetterIntent | null {
      if (params.heroCard === '') {
        return null;
      }
      const source = { key: `heroDeck|${params.heroCard}`, cardId: params.heroCard, from: { zone: 'heroDeck' as const }, label: '' };
      return buildMoveCardIntent(source, { zone: 'hq', hqIndex: params.hqSpace - 1 });
    }

    /**
     * Folder 3, Hero deck: a card to the top, or into an HQ space.
     *
     * @param target The pane.
     * @param isDisabled Whether its buttons are disabled.
     * @param options The hero deck's card options.
     */
    function addHeroFolder(target: Pane, isDisabled: boolean, options: ListOption[]): void {
      const folder = target.addFolder({ title: 'Hero deck' });
      folder.addBinding(params, 'heroCard', { label: 'Hero card', options });
      addSetterButton(folder, 'Move hero card to top', isDisabled, () =>
        params.heroCard === '' ? null : buildDeckTopIntent('hero', params.heroCard),
      );
      folder.addBinding(params, 'hqSpace', { label: 'HQ space', min: 1, max: 5, step: 1 });
      addSetterButton(folder, 'Place hero in HQ space', isDisabled, buildPlaceHeroIntent);
    }

    /**
     * The "Move card" intent: each selected key mapped back to its current entry.
     *
     * @returns The intent, or `null` when either key is missing from the current lists.
     */
    function buildSelectedMoveIntent(): OperatorSetterIntent | null {
      const view = props.operatorView;
      const source = buildCardSources(view).find((entry) => entry.key === params.source);
      const destination = buildDestinations(view).find((entry) => entry.key === params.destination);
      if (source === undefined || destination === undefined) {
        return null;
      }
      return buildMoveCardIntent(source, destination.ref);
    }

    /**
     * Folder 4, Move a card: one source list and one destination list, valued by key.
     *
     * @param target The pane.
     * @param isDisabled Whether its button is disabled.
     * @param sources The source options.
     * @param destinations The destination options.
     */
    function addMoveFolder(target: Pane, isDisabled: boolean, sources: ListOption[], destinations: ListOption[]): void {
      const folder = target.addFolder({ title: 'Move a card' });
      folder.addBinding(params, 'source', { label: 'Card', options: sources });
      folder.addBinding(params, 'destination', { label: 'Destination', options: destinations });
      addSetterButton(folder, 'Move card', isDisabled, buildSelectedMoveIntent);
    }

    /**
     * Folders 5 and 6: Turn economy, and Escape.
     *
     * @param target The pane.
     * @param isDisabled Whether their buttons are disabled.
     */
    function addEconomyAndEscapeFolders(target: Pane, isDisabled: boolean): void {
      const economy = target.addFolder({ title: 'Turn economy' });
      economy.addBinding(params, 'resource', { label: 'Resource', options: RESOURCE_OPTIONS });
      economy.addBinding(params, 'amount', { label: 'Amount', min: 1, max: OPERATOR_ECONOMY_MAX_AMOUNT, step: 1 });
      addSetterButton(economy, 'Add to this turn', isDisabled, () => buildEconomyIntent(params.resource, params.amount));
      const escape = target.addFolder({ title: 'Escape' });
      const isEscapeDisabled = isDisabled || !hasEscapeCandidate(props.operatorView);
      addSetterButton(escape, "Escape the Villain at the City's edge", isEscapeDisabled, buildEscapeIntent, true);
    }

    /** Dispose the live pane, if any. */
    function disposePane(): void {
      if (pane !== null) {
        pane.dispose();
        pane = null;
      }
    }

    /** Build the pane from the current view, keeping still-present selections. */
    function buildPane(): void {
      const container = host.value;
      if (container === null) {
        return;
      }
      const view = props.operatorView;
      const villainOptions = buildDeckCardOptions(view.villainDeckTopFirst, view);
      const heroOptions = buildDeckCardOptions(view.heroDeckTopFirst, view);
      const sourceOptions = buildCardSources(view).map((source) => ({ text: source.label, value: source.key }));
      const destinationOptions = buildDestinations(view).map((entry) => ({ text: entry.label, value: entry.key }));
      params.villainCard = keepOrFirst(params.villainCard, villainOptions);
      params.heroCard = keepOrFirst(params.heroCard, heroOptions);
      params.source = keepOrFirst(params.source, sourceOptions);
      params.destination = keepOrFirst(params.destination, destinationOptions);
      const isDisabled = !isWindowOpen.value;
      const nextPane = new Pane({ container, title: 'Setters' });
      addSupplyFolder(nextPane, isDisabled);
      addVillainFolder(nextPane, isDisabled, villainOptions);
      addHeroFolder(nextPane, isDisabled, heroOptions);
      addMoveFolder(nextPane, isDisabled, sourceOptions, destinationOptions);
      addEconomyAndEscapeFolders(nextPane, isDisabled);
      pane = nextPane;
    }

    /** Dispose the old pane, then build a new one: never more than one live `Pane`. */
    function rebuildPane(): void {
      disposePane();
      buildPane();
    }

    onMounted(buildPane);
    watch(rebuildKey, rebuildPane);
    onUnmounted(disposePane);

    return { host, hintText };
  },
});
</script>

<template>
  <section class="operator-setters" data-testid="operator-setters">
    <p class="operator-setters-hint" data-testid="operator-setters-hint">{{ hintText }}</p>
    <div ref="host" data-testid="operator-setter-pane"></div>
  </section>
</template>

<style scoped>
.operator-setters {
  margin-top: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--la-color-border-subtle);
}

.operator-setters-hint {
  margin: 2px 0 6px;
  color: var(--la-color-text-secondary);
}
</style>
