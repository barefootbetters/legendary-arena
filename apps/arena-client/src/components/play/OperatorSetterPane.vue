<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, reactive, ref, watch, type PropType } from 'vue';
import { Pane } from 'tweakpane';
import type { FolderApi } from 'tweakpane';
import {
  OPERATOR_ECONOMY_MAX_AMOUNT,
  OPERATOR_SUPPLY_PILES,
} from '@legendary-arena/game-engine';
import type {
  OperatorEconomyResource,
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
  toWholeNumberInRange,
  type OperatorListOption,
  type OperatorSetterIntent,
} from '../../lib/operatorSetterIntents';

/** The selections the pane binds; they outlive every rebuild. */
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

/** The Turn economy resource options. */
const RESOURCE_OPTIONS: readonly { text: string; value: OperatorEconomyResource }[] = [
  { text: 'Attack', value: 'attack' },
  { text: 'Recruit', value: 'recruit' },
];

const HINT_CLOSED = 'Setters run on your turn, in the main stage, with no choice open.';
const HINT_OPEN = 'Setters change the board through the engine. A refused setter changes nothing.';

/**
 * Keep a selection that is still among the options, or take the first option.
 *
 * @param selected The current selection.
 * @param values The option values, in list order.
 * @returns The selection to bind.
 */
function keepOrFirst(selected: string, values: readonly string[]): string {
  if (values.includes(selected)) {
    return selected;
  }
  return values[0] ?? '';
}

/**
 * Operator setter pane (WP-807 / EC-844 / D-24713).
 *
 * A Tweakpane pane inside the operator panel whose six folders submit WP-806's
 * six `operator*` moves through the prop-drilled `submitMove`. It only submits
 * intent: it edits no state and runs no rule, and the engine refuses anything
 * outside its table silently.
 *
 * Loaded only through `defineAsyncComponent` in `OperatorBoardPanel.vue`, so
 * Tweakpane ships in its own chunk. Uses `defineComponent({ setup })` per D-6512.
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
    const paneHost = ref<HTMLElement | null>(null);
    let pane: Pane | null = null;
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

    const cardSources = computed(() => buildCardSources(props.operatorView, props.playerId));
    const destinations = computed(() => buildDestinations(props.operatorView, props.playerId));
    const villainOptions = computed(() =>
      buildDeckCardOptions(props.operatorView.villainDeckTopFirst, props.operatorView),
    );
    const heroOptions = computed(() =>
      buildDeckCardOptions(props.operatorView.heroDeckTopFirst, props.operatorView),
    );
    const isWindowOpen = computed(() => isSetterWindowOpen(props.operatorView, props.playerId));
    const canEscape = computed(() => hasEscapeCandidate(props.operatorView));
    const hintText = computed(() => (isWindowOpen.value ? HINT_OPEN : HINT_CLOSED));

    // why: Tweakpane list options are fixed at creation, so the pane rebuilds
    // whenever an option list, the window state or the escape candidate changes.
    // List order is part of the key: a reorder must rebuild, or the position
    // labels go stale.
    const rebuildKey = computed(() => {
      const parts: string[] = [];
      for (const option of villainOptions.value) {
        parts.push(`villain:${option.value}:${option.text}`);
      }
      for (const option of heroOptions.value) {
        parts.push(`hero:${option.value}:${option.text}`);
      }
      for (const source of cardSources.value) {
        parts.push(`source:${source.key}`);
      }
      for (const destination of destinations.value) {
        parts.push(`destination:${destination.key}`);
      }
      parts.push(`open:${isWindowOpen.value}`, `escape:${canEscape.value}`);
      return parts.join('\n');
    });

    /**
     * Submit one setter if the window is still open and the intent exists.
     *
     * @param makeIntent Builds the intent from the current selections, or null.
     */
    function submitIntent(makeIntent: () => OperatorSetterIntent | null): void {
      // why: the click re-check reads the current prop, so a click that slips
      // past a stale disabled state submits nothing. Presentation only — the
      // engine re-checks the match, turn, stage and open choices (WP-806).
      if (!isSetterWindowOpen(props.operatorView, props.playerId)) {
        return;
      }
      const intent = makeIntent();
      if (intent === null) {
        return;
      }
      props.submitMove(intent.name, intent.args);
      emit('submitted');
    }

    /**
     * Add a button that is enabled only while the setter window is open.
     *
     * @param folder The folder to add to.
     * @param title The button title.
     * @param isAvailable Whether this button's own extra condition holds.
     * @param makeIntent Builds the intent on click, or null to submit nothing.
     */
    function addSetterButton(
      folder: FolderApi,
      title: string,
      isAvailable: boolean,
      makeIntent: () => OperatorSetterIntent | null,
    ): void {
      const button = folder.addButton({ title });
      button.disabled = !(isWindowOpen.value && isAvailable);
      button.on('click', () => submitIntent(makeIntent));
    }

    /**
     * Whether a deck selection is a card still in that deck's options.
     *
     * @param selected The selected card id.
     * @param options The deck's current options.
     * @returns True when the selection is non-empty and present.
     */
    function isListedCard(selected: string, options: readonly OperatorListOption[]): boolean {
      return selected !== '' && options.some((option) => option.value === selected);
    }

    /**
     * Add a whole-number text field that snaps back into range on every change.
     *
     * // why: no `max` on the binding, so Tweakpane draws a plain text field and no
     * slider. A slider click on a 0-px track sets NaN (live match cDfRs-e8CqM, the
     * Turn economy Amount); the range is enforced here instead.
     *
     * @param folder The folder to add to.
     * @param key The bound number field.
     * @param label The field label.
     * @param min The smallest allowed value.
     * @param max The largest allowed value (Infinity for none).
     */
    function addWholeNumberBinding(
      folder: FolderApi,
      key: 'count' | 'hqSpace' | 'amount',
      label: string,
      min: number,
      max: number,
    ): void {
      const binding = folder.addBinding(params, key, { label, step: 1 });
      binding.on('change', () => {
        const snapped = toWholeNumberInRange(params[key], min, max);
        if (snapped !== params[key]) {
          params[key] = snapped;
          binding.refresh();
        }
      });
    }

    /**
     * The Supply folder: set a pile to a count.
     *
     * @param target The pane.
     */
    function buildSupplyFolder(target: Pane): void {
      const folder = target.addFolder({ title: 'Supply' });
      const pileOptions: { text: string; value: OperatorSupplyPile }[] = [];
      for (const pile of OPERATOR_SUPPLY_PILES) {
        pileOptions.push({ text: PILE_LABEL[pile], value: pile });
      }
      folder.addBinding(params, 'pile', { label: 'Pile', options: pileOptions });
      addWholeNumberBinding(folder, 'count', 'Count', 0, Number.POSITIVE_INFINITY);
      addSetterButton(folder, 'Set supply count', true, () =>
        buildSupplyCountIntent(params.pile, params.count),
      );
    }

    /**
     * The Villain deck folder: a card to the top, or a reveal now.
     *
     * @param target The pane.
     */
    function buildVillainFolder(target: Pane): void {
      const folder = target.addFolder({ title: 'Villain deck' });
      folder.addBinding(params, 'villainCard', { label: 'Villain card', options: [...villainOptions.value] });
      addSetterButton(folder, 'Move villain card to top', true, () => {
        if (!isListedCard(params.villainCard, villainOptions.value)) {
          return null;
        }
        return buildDeckTopIntent('villain', params.villainCard);
      });
      addSetterButton(folder, 'Reveal a Scheme Twist now', true, () => buildRevealNowIntent('scheme-twist'));
      addSetterButton(folder, 'Reveal a Master Strike now', true, () =>
        buildRevealNowIntent('mastermind-strike'),
      );
    }

    /**
     * The Hero deck folder: a card to the top, or into an HQ space.
     *
     * @param target The pane.
     */
    function buildHeroFolder(target: Pane): void {
      const folder = target.addFolder({ title: 'Hero deck' });
      folder.addBinding(params, 'heroCard', { label: 'Hero card', options: [...heroOptions.value] });
      addSetterButton(folder, 'Move hero card to top', true, () => {
        if (!isListedCard(params.heroCard, heroOptions.value)) {
          return null;
        }
        return buildDeckTopIntent('hero', params.heroCard);
      });
      addWholeNumberBinding(folder, 'hqSpace', 'HQ space', 1, 5);
      addSetterButton(folder, 'Place hero in HQ space', true, () => {
        if (!isListedCard(params.heroCard, heroOptions.value)) {
          return null;
        }
        const heroCard = params.heroCard;
        // why: HQ spaces read 1–5 on screen; WP-806 route R4 takes a 0-based index.
        return buildMoveCardIntent(
          { key: 'heroDeck|' + heroCard, cardId: heroCard, from: { zone: 'heroDeck' }, label: '' },
          { zone: 'hq', hqIndex: params.hqSpace - 1 },
        );
      });
    }

    /**
     * The Move a card folder: one source list and one destination list, each
     * valued by a stable key that maps back to its entry on click.
     *
     * @param target The pane.
     */
    function buildMoveFolder(target: Pane): void {
      const folder = target.addFolder({ title: 'Move a card' });
      const sourceOptions = cardSources.value.map((source) => ({ text: source.label, value: source.key }));
      const destinationOptions = destinations.value.map((entry) => ({ text: entry.label, value: entry.key }));
      folder.addBinding(params, 'source', { label: 'Card', options: sourceOptions });
      folder.addBinding(params, 'destination', { label: 'Destination', options: destinationOptions });
      addSetterButton(folder, 'Move card', true, () => {
        const source = cardSources.value.find((entry) => entry.key === params.source);
        const destination = destinations.value.find((entry) => entry.key === params.destination);
        if (source === undefined || destination === undefined) {
          return null;
        }
        return buildMoveCardIntent(source, destination.ref);
      });
    }

    /**
     * The Turn economy and Escape folders.
     *
     * @param target The pane.
     */
    function buildEconomyAndEscapeFolders(target: Pane): void {
      const economy = target.addFolder({ title: 'Turn economy' });
      economy.addBinding(params, 'resource', { label: 'Resource', options: [...RESOURCE_OPTIONS] });
      addWholeNumberBinding(economy, 'amount', 'Amount', 1, OPERATOR_ECONOMY_MAX_AMOUNT);
      addSetterButton(economy, 'Add to this turn', true, () => buildEconomyIntent(params.resource, params.amount));

      const escape = target.addFolder({ title: 'Escape' });
      addSetterButton(escape, "Escape the Villain at the City's edge", canEscape.value, () => {
        if (!hasEscapeCandidate(props.operatorView)) {
          return null;
        }
        return buildEscapeIntent();
      });
    }

    /** Keep each still-present list selection, or fall back to the first option. */
    function reconcileSelections(): void {
      params.villainCard = keepOrFirst(params.villainCard, villainOptions.value.map((option) => option.value));
      params.heroCard = keepOrFirst(params.heroCard, heroOptions.value.map((option) => option.value));
      params.source = keepOrFirst(params.source, cardSources.value.map((source) => source.key));
      params.destination = keepOrFirst(params.destination, destinations.value.map((entry) => entry.key));
    }

    /** Dispose the live pane, if any, so there is never more than one. */
    function disposePane(): void {
      if (pane !== null) {
        pane.dispose();
        pane = null;
      }
    }

    /** Dispose the old pane and build a fresh one from the current options. */
    function rebuildPane(): void {
      disposePane();
      const host = paneHost.value;
      if (host === null) {
        return;
      }
      reconcileSelections();
      const nextPane = new Pane({ container: host, title: 'Setters' });
      buildSupplyFolder(nextPane);
      buildVillainFolder(nextPane);
      buildHeroFolder(nextPane);
      buildMoveFolder(nextPane);
      buildEconomyAndEscapeFolders(nextPane);
      pane = nextPane;
    }

    onMounted(rebuildPane);
    watch(rebuildKey, rebuildPane);
    onUnmounted(disposePane);

    return { paneHost, hintText };
  },
});
</script>

<template>
  <section class="operator-setters" data-testid="operator-setters">
    <p class="operator-setters-hint" data-testid="operator-setters-hint">{{ hintText }}</p>
    <div ref="paneHost" data-testid="operator-setter-pane"></div>
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
