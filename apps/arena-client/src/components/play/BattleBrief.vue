<script lang="ts">
import { computed, defineComponent, ref, watch, type PropType } from 'vue';

import AbilityText from './AbilityText.vue';
import type { SubmitMove } from './uiMoveName.types';
import { useUiStateStore } from '../../stores/uiState';
import { useAuthStore } from '../../stores/auth';
import { useConnectionStore } from '../../stores/connection';
import { fetchMatchLagn } from '../../lib/api/matchLagnApi';
import { summarizeLoadout, type LoadoutSummary } from '../../lib/loadoutSummary';

/**
 * Returns the first game-text line that starts with the given prefix.
 *
 * @param lines The served game-text lines, or undefined when none were served.
 * @param prefix The line prefix to look for (for example `Setup:`).
 * @returns The matching line, or null when there is none.
 */
function findLineStartingWith(
  lines: readonly string[] | undefined,
  prefix: string,
): string | null {
  if (lines === undefined) {
    return null;
  }
  for (const line of lines) {
    if (line.startsWith(prefix)) {
      return line;
    }
  }
  return null;
}

/**
 * Returns the scheme's Evil Wins line: the one starting with `Evil Wins:`, else
 * the first line that mentions "evil wins" at all.
 *
 * @param lines The served scheme game-text lines, or undefined.
 * @returns The line, served verbatim, or null when the scheme has none.
 */
function findEvilWinsLine(lines: readonly string[] | undefined): string | null {
  const prefixed = findLineStartingWith(lines, 'Evil Wins:');
  if (prefixed !== null) {
    return prefixed;
  }
  if (lines === undefined) {
    return null;
  }
  // why: 28 of 200 schemes phrase the loss as "Twist N: Evil Wins!" and 22 carry
  // no Evil Wins line at all; the fallback still shows served text verbatim.
  for (const line of lines) {
    if (/evil wins/i.test(line)) {
      return line;
    }
  }
  return null;
}

/**
 * Formats the seats line for the brief.
 *
 * @param count The number of seats at the table.
 * @returns `1 seat at the table` or `N seats at the table`.
 */
function formatSeatsLine(count: number): string {
  if (count === 1) {
    return '1 seat at the table';
  }
  return `${count} seats at the table`;
}

/**
 * The battle brief (WP-786 / D-24634): shown only in the engine's `lobby`
 * phase. It reads the served Mastermind and Scheme display and game text, the
 * public match loadout for names, and the seat count, then Begin the Battle
 * readies this player and — after the next server frame — asks to start.
 */
export default defineComponent({
  name: 'BattleBrief',
  components: { AbilityText },
  props: {
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
    matchId: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    const uiStateStore = useUiStateStore();
    const authStore = useAuthStore();
    const connectionStore = useConnectionStore();
    const snapshot = computed(() => uiStateStore.snapshot);

    const isHidden = ref(false);
    const hasEntered = ref(false);
    const hasSentStart = ref(false);
    const stateIdAtEntry = ref<number | null>(null);
    const hasRequestedLineup = ref(false);
    const lineup = ref<LoadoutSummary | null>(null);
    const isLineupUnavailable = ref(false);

    const isLobbyPhase = computed<boolean>(
      () => snapshot.value !== null && snapshot.value.game.phase === 'lobby',
    );
    const mastermindName = computed(() => snapshot.value?.mastermind.display.name ?? '');
    const mastermindImageUrl = computed(() => snapshot.value?.mastermind.display.imageUrl ?? '');
    const alwaysLeadsLine = computed(() =>
      findLineStartingWith(snapshot.value?.mastermind.gameText, 'Always Leads'),
    );
    const schemeDisplay = computed(() => snapshot.value?.scheme.display ?? null);
    const setupLine = computed(() => findLineStartingWith(snapshot.value?.scheme.gameText, 'Setup:'));
    const evilWinsLine = computed(() => findEvilWinsLine(snapshot.value?.scheme.gameText));
    const seatCount = computed(() => snapshot.value?.players.length ?? 0);
    const seatsLine = computed(() => formatSeatsLine(seatCount.value));
    const isWaitingForTable = computed(() => hasEntered.value && seatCount.value > 1);
    const beginLabel = computed(() => {
      if (hasEntered.value) {
        return 'Beginning…';
      }
      return 'Begin the Battle';
    });

    /**
     * Fetches the public match loadout once and summarizes it into names.
     */
    async function loadLineup(): Promise<void> {
      hasRequestedLineup.value = true;
      if (props.matchId === '') {
        isLineupUnavailable.value = true;
        return;
      }
      // why: group and hero names come from the public match LAGN (D-24446),
      // not a new UIState field, so the Board-Visible Field Rule is untouched.
      const result = await fetchMatchLagn(props.matchId, authStore.token);
      if (result.ok) {
        lineup.value = summarizeLoadout(result.lagn);
      } else {
        isLineupUnavailable.value = true;
      }
    }

    watch(
      () => snapshot.value?.game.phase,
      (phase) => {
        if (phase === 'lobby' && !hasRequestedLineup.value) {
          void loadLineup();
        }
      },
      { immediate: true },
    );

    // why: both lobby moves are `client: false` (D-10008), so a second submit in
    // the same tick carries a stale `_stateID` and the server drops it. Start is
    // sent only once the ready frame advances the state id past its value at the
    // click.
    watch(
      () => connectionStore.lastStateId,
      (nextStateId) => {
        if (!hasEntered.value || hasSentStart.value || typeof nextStateId !== 'number') {
          return;
        }
        const baseline = stateIdAtEntry.value;
        if (baseline !== null && nextStateId <= baseline) {
          return;
        }
        hasSentStart.value = true;
        props.submitMove('startMatchIfReady', {});
      },
    );

    /**
     * Readies this player; the start request follows the next server frame.
     */
    function beginBattle(): void {
      if (hasEntered.value) {
        return;
      }
      hasEntered.value = true;
      stateIdAtEntry.value = connectionStore.lastStateId;
      props.submitMove('setPlayerReady', { ready: true });
    }

    /** Collapses the brief to its Show button; the lobby controls stay usable. */
    function hideBrief(): void {
      isHidden.value = true;
    }

    /** Restores the brief after it was hidden. */
    function showBrief(): void {
      isHidden.value = false;
    }

    return {
      isLobbyPhase,
      isHidden,
      hasEntered,
      mastermindName,
      mastermindImageUrl,
      alwaysLeadsLine,
      schemeDisplay,
      setupLine,
      evilWinsLine,
      seatsLine,
      isWaitingForTable,
      beginLabel,
      lineup,
      isLineupUnavailable,
      beginBattle,
      hideBrief,
      showBrief,
    };
  },
});
</script>

<template>
  <section
    v-if="isLobbyPhase && !isHidden"
    class="battle-brief"
    data-testid="battle-brief"
    aria-labelledby="battle-brief-heading"
  >
    <h2 id="battle-brief-heading" class="battle-brief__heading">Battle Brief</h2>
    <p class="battle-brief__subheading">Read the table its setup, then begin together.</p>

    <div class="battle-brief__foes">
      <div class="battle-brief__foe" data-testid="battle-brief-mastermind">
        <img
          v-if="mastermindImageUrl !== ''"
          class="battle-brief__card"
          :src="mastermindImageUrl"
          :alt="mastermindName"
        >
        <div>
          <p class="battle-brief__label">Mastermind</p>
          <p class="battle-brief__name">{{ mastermindName }}</p>
          <p v-if="alwaysLeadsLine !== null" class="battle-brief__line">
            <AbilityText :text="alwaysLeadsLine" />
          </p>
        </div>
      </div>
      <div class="battle-brief__foe" data-testid="battle-brief-scheme">
        <img
          v-if="schemeDisplay !== null && schemeDisplay.imageUrl !== ''"
          class="battle-brief__card"
          :src="schemeDisplay.imageUrl"
          :alt="schemeDisplay.name"
        >
        <div>
          <p class="battle-brief__label">Scheme</p>
          <p v-if="schemeDisplay !== null" class="battle-brief__name">{{ schemeDisplay.name }}</p>
          <p v-if="setupLine !== null" class="battle-brief__line">
            <AbilityText :text="setupLine" />
          </p>
          <p v-if="evilWinsLine !== null" class="battle-brief__line">
            <AbilityText :text="evilWinsLine" />
          </p>
        </div>
      </div>
    </div>

    <div v-if="lineup !== null" class="battle-brief__lineup" data-testid="battle-brief-lineup">
      <div class="battle-brief__tile">
        <p class="battle-brief__label">Villain groups</p>
        <p class="battle-brief__names">{{ lineup.villainGroups.join(', ') }}</p>
      </div>
      <div class="battle-brief__tile">
        <p class="battle-brief__label">Henchmen</p>
        <p class="battle-brief__names">{{ lineup.henchmanGroups.join(', ') }}</p>
      </div>
      <div class="battle-brief__tile">
        <p class="battle-brief__label">Heroes</p>
        <p class="battle-brief__names">{{ lineup.heroes.join(', ') }}</p>
      </div>
    </div>
    <p
      v-else-if="isLineupUnavailable"
      class="battle-brief__unavailable"
      data-testid="battle-brief-lineup-unavailable"
    >
      The lineup could not be loaded. It will appear on the board.
    </p>

    <div class="battle-brief__foot">
      <div>
        <p class="battle-brief__seats" data-testid="battle-brief-seats">{{ seatsLine }}</p>
        <p
          v-if="isWaitingForTable"
          class="battle-brief__waiting"
          data-testid="battle-brief-waiting"
        >
          Waiting for the rest of the table…
        </p>
      </div>
      <div class="battle-brief__actions">
        <button type="button" class="battle-brief__hide" @click="hideBrief">Hide brief</button>
        <button
          type="button"
          class="battle-brief__begin"
          data-testid="battle-brief-enter"
          :disabled="hasEntered"
          @click="beginBattle"
        >
          {{ beginLabel }}
        </button>
      </div>
    </div>
  </section>
  <button
    v-else-if="isLobbyPhase"
    type="button"
    class="battle-brief__show"
    data-testid="battle-brief-show"
    @click="showBrief"
  >
    Show battle brief
  </button>
</template>

<style scoped>
/* why: z-index 100 keeps the brief below the 9999 corner overlays (the Battle
   Plan top-right, the invite panel bottom-right, the loadout and diagnostics
   bottom-left), and the width cap leaves those corner lanes clear. */
.battle-brief {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 100;
  box-sizing: border-box;
  width: min(880px, calc(100vw - 360px));
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  padding: 24px 28px 20px;
  transform: translate(-50%, -50%);
  border: 1px solid var(--la-color-border-strong, rgba(212, 175, 55, 0.3));
  border-radius: 14px;
  background: var(--la-color-surface);
  color: var(--la-color-text-primary);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
}

.battle-brief__heading {
  margin: 0;
  font-family: var(--la-font-display, 'Bebas Neue', Impact, sans-serif);
  font-weight: 400;
  font-size: 40px;
  letter-spacing: 3px;
  line-height: 1;
  text-transform: uppercase;
  color: var(--la-color-gold);
}

.battle-brief__subheading {
  margin: 4px 0 0;
  font-size: 14px;
  opacity: 0.75;
}

.battle-brief__foes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 18px;
}

.battle-brief__foe {
  display: grid;
  grid-template-columns: 104px 1fr;
  gap: 14px;
  padding: 12px;
  border-radius: 10px;
  background: var(--la-color-bg-secondary);
}

.battle-brief__card {
  width: 104px;
  border-radius: 8px;
}

.battle-brief__label {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--la-color-gold);
}

.battle-brief__name {
  margin: 4px 0 8px;
  font-family: var(--la-font-display, 'Bebas Neue', Impact, sans-serif);
  font-size: 28px;
  letter-spacing: 1.5px;
  line-height: 1;
  text-transform: uppercase;
}

.battle-brief__line {
  margin: 0 0 6px;
  font-size: 14px;
  line-height: 1.45;
}

.battle-brief__lineup {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 14px;
}

.battle-brief__tile {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--la-color-bg-secondary);
}

.battle-brief__names {
  margin: 6px 0 0;
  font-size: 15px;
  font-weight: 600;
}

.battle-brief__unavailable {
  margin: 14px 0 0;
  font-size: 14px;
  opacity: 0.75;
}

.battle-brief__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 18px;
}

.battle-brief__seats,
.battle-brief__waiting {
  margin: 0;
  font-size: 14px;
}

.battle-brief__waiting {
  opacity: 0.75;
}

.battle-brief__actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.battle-brief__hide {
  border: 0;
  background: none;
  cursor: pointer;
  font-size: 14px;
  text-decoration: underline;
  color: inherit;
  opacity: 0.8;
}

.battle-brief__begin {
  padding: 12px 36px 10px;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  font-family: var(--la-font-display, 'Bebas Neue', Impact, sans-serif);
  font-size: 24px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #ffffff;
  background: var(--la-color-cta);
}

.battle-brief__begin:disabled {
  cursor: wait;
  opacity: 0.7;
}

.battle-brief__show {
  position: fixed;
  top: 12px;
  left: 50%;
  z-index: 100;
  transform: translateX(-50%);
  padding: 8px 16px;
  border: 1px solid var(--la-color-border-strong, rgba(212, 175, 55, 0.3));
  border-radius: 999px;
  cursor: pointer;
  background: var(--la-color-surface);
  color: var(--la-color-text-primary);
}

@media (max-width: 767px) {
  /* why: on a phone the panel sits between the site header and the bottom
     audio / diagnostics bar and scrolls inside, so it never covers either. */
  .battle-brief {
    top: 120px;
    bottom: 88px;
    width: calc(100vw - 32px);
    max-height: none;
    padding: 18px 16px;
    transform: translateX(-50%);
  }

  .battle-brief__foes,
  .battle-brief__lineup {
    grid-template-columns: 1fr;
  }

  .battle-brief__foe {
    grid-template-columns: 76px 1fr;
  }

  .battle-brief__card {
    width: 76px;
  }

  .battle-brief__actions {
    flex-direction: column-reverse;
    align-items: stretch;
    width: 100%;
  }
}
</style>
