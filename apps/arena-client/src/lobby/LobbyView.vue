<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import type { MatchSetupConfig } from '@legendary-arena/game-engine';
import {
  createMatch,
  joinMatch,
  listMatches,
} from './lobbyApi';
import type { LobbyMatchSummary } from './lobbyApi';

// why: defineComponent({ setup() { return {...} } }) is required (NOT
// <script setup>) because the template references non-prop bindings under
// the @legendary-arena/vue-sfc-loader separate-compile pipeline. Top-level
// <script setup> bindings do not reach `_ctx` in that mode (D-6512 /
// P6-30; precedent: WP-061 BootstrapProbe, WP-062 ArenaHud, WP-064
// ReplayFileLoader). The failure mode is an undefined template proxy at
// mount time, which crashes under node:test.

function splitCsv(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return [];
  }
  const parts: string[] = [];
  for (const piece of trimmed.split(',')) {
    const cleaned = piece.trim();
    if (cleaned !== '') {
      parts.push(cleaned);
    }
  }
  return parts;
}

function parsePositiveInteger(raw: string, fieldLabel: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new Error(
      `The "${fieldLabel}" field must not be empty. Provide a positive integer.`,
    );
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(
      `The "${fieldLabel}" field must be a non-negative integer. Received "${raw}".`,
    );
  }
  return value;
}

export default defineComponent({
  name: 'LobbyView',
  setup() {
    // why: each of these nine refs is named to match exactly one of the
    // nine locked MatchSetupConfig field names so the per-field `v-model`
    // grep gate (verification step 9) resolves to nine matches.
    const schemeId = ref('');
    const mastermindId = ref('');
    const villainGroupIds = ref('');
    const henchmanGroupIds = ref('');
    const heroDeckIds = ref('');
    const bystandersCount = ref('1');
    const woundsCount = ref('30');
    const officersCount = ref('5');
    const sidekicksCount = ref('12');

    const numPlayers = ref('2');
    const playerName = ref('');

    const matches = ref<LobbyMatchSummary[]>([]);
    const errorMessage = ref<string | null>(null);
    const isSubmitting = ref(false);

    function buildConfig(): MatchSetupConfig {
      return {
        schemeId: schemeId.value.trim(),
        mastermindId: mastermindId.value.trim(),
        villainGroupIds: splitCsv(villainGroupIds.value),
        henchmanGroupIds: splitCsv(henchmanGroupIds.value),
        heroDeckIds: splitCsv(heroDeckIds.value),
        bystandersCount: parsePositiveInteger(bystandersCount.value, 'bystandersCount'),
        woundsCount: parsePositiveInteger(woundsCount.value, 'woundsCount'),
        officersCount: parsePositiveInteger(officersCount.value, 'officersCount'),
        sidekicksCount: parsePositiveInteger(sidekicksCount.value, 'sidekicksCount'),
      };
    }

    async function refreshMatches(): Promise<void> {
      try {
        const summaries = await listMatches();
        matches.value = summaries;
        errorMessage.value = null;
      } catch (fetchError) {
        const cause =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        errorMessage.value = `Unable to refresh the match list. ${cause}`;
      }
    }

    async function submitCreate(): Promise<void> {
      if (isSubmitting.value) {
        return;
      }
      if (playerName.value.trim() === '') {
        errorMessage.value =
          'The "playerName" field must not be empty before creating a match.';
        return;
      }

      isSubmitting.value = true;
      try {
        const config = buildConfig();
        const seatCount = parsePositiveInteger(numPlayers.value, 'numPlayers');
        const created = await createMatch(config, seatCount);
        const joined = await joinMatch(created.matchID, '0', playerName.value.trim());
        const query =
          `?match=${encodeURIComponent(created.matchID)}` +
          `&player=0` +
          `&credentials=${encodeURIComponent(joined.playerCredentials)}`;
        window.location.search = query;
      } catch (submitError) {
        const cause =
          submitError instanceof Error
            ? submitError.message
            : String(submitError);
        errorMessage.value = `Failed to create and join the match. ${cause}`;
      } finally {
        isSubmitting.value = false;
      }
    }

    async function joinExisting(
      matchID: string,
      seatId: string,
    ): Promise<void> {
      if (isSubmitting.value) {
        return;
      }
      if (playerName.value.trim() === '') {
        errorMessage.value =
          'The "playerName" field must not be empty before joining a match.';
        return;
      }

      isSubmitting.value = true;
      try {
        const joined = await joinMatch(
          matchID,
          seatId,
          playerName.value.trim(),
        );
        const query =
          `?match=${encodeURIComponent(matchID)}` +
          `&player=${encodeURIComponent(seatId)}` +
          `&credentials=${encodeURIComponent(joined.playerCredentials)}`;
        window.location.search = query;
      } catch (joinError) {
        const cause =
          joinError instanceof Error ? joinError.message : String(joinError);
        errorMessage.value = `Failed to join match ${matchID} at seat ${seatId}. ${cause}`;
      } finally {
        isSubmitting.value = false;
      }
    }

    function isOpenSeat(seat: { id: string; name?: string }): boolean {
      return typeof seat.name !== 'string';
    }

    onMounted(() => {
      void refreshMatches();
    });

    return {
      schemeId,
      mastermindId,
      villainGroupIds,
      henchmanGroupIds,
      heroDeckIds,
      bystandersCount,
      woundsCount,
      officersCount,
      sidekicksCount,
      numPlayers,
      playerName,
      matches,
      errorMessage,
      isSubmitting,
      refreshMatches,
      submitCreate,
      joinExisting,
      isOpenSeat,
    };
  },
});
</script>

<template>
  <section class="lobby-view" data-testid="lobby-view">
    <h1>Legendary Arena — Lobby</h1>

    <p
      v-if="errorMessage !== null"
      class="lobby-error"
      role="alert"
      data-testid="lobby-error"
    >
      {{ errorMessage }}
    </p>

    <section class="player-identity" aria-labelledby="player-identity-heading">
      <h2 id="player-identity-heading">Player identity</h2>
      <label for="playerName">Display name</label>
      <input
        id="playerName"
        v-model="playerName"
        type="text"
        autocomplete="off"
        aria-label="Display name for this player"
      />
    </section>

    <section class="create-match" aria-labelledby="create-match-heading">
      <h2 id="create-match-heading">Create match</h2>

      <label for="schemeId">schemeId</label>
      <input id="schemeId" v-model="schemeId" type="text" aria-label="schemeId" />

      <label for="mastermindId">mastermindId</label>
      <input
        id="mastermindId"
        v-model="mastermindId"
        type="text"
        aria-label="mastermindId"
      />

      <label for="villainGroupIds">villainGroupIds (comma-separated)</label>
      <input
        id="villainGroupIds"
        v-model="villainGroupIds"
        type="text"
        aria-label="villainGroupIds"
      />

      <label for="henchmanGroupIds">henchmanGroupIds (comma-separated)</label>
      <input
        id="henchmanGroupIds"
        v-model="henchmanGroupIds"
        type="text"
        aria-label="henchmanGroupIds"
      />

      <label for="heroDeckIds">heroDeckIds (comma-separated)</label>
      <input
        id="heroDeckIds"
        v-model="heroDeckIds"
        type="text"
        aria-label="heroDeckIds"
      />

      <label for="bystandersCount">bystandersCount</label>
      <input
        id="bystandersCount"
        v-model="bystandersCount"
        type="text"
        inputmode="numeric"
        aria-label="bystandersCount"
      />

      <label for="woundsCount">woundsCount</label>
      <input
        id="woundsCount"
        v-model="woundsCount"
        type="text"
        inputmode="numeric"
        aria-label="woundsCount"
      />

      <label for="officersCount">officersCount</label>
      <input
        id="officersCount"
        v-model="officersCount"
        type="text"
        inputmode="numeric"
        aria-label="officersCount"
      />

      <label for="sidekicksCount">sidekicksCount</label>
      <input
        id="sidekicksCount"
        v-model="sidekicksCount"
        type="text"
        inputmode="numeric"
        aria-label="sidekicksCount"
      />

      <label for="numPlayers">numPlayers (1-5)</label>
      <input
        id="numPlayers"
        v-model="numPlayers"
        type="number"
        min="1"
        max="5"
        aria-label="numPlayers"
      />

      <button
        type="button"
        :disabled="isSubmitting"
        data-testid="lobby-submit-create"
        @click="submitCreate"
      >
        Create match
      </button>
    </section>

    <section class="join-existing" aria-labelledby="join-existing-heading">
      <h2 id="join-existing-heading">Join existing match</h2>

      <button
        type="button"
        :disabled="isSubmitting"
        data-testid="lobby-refresh-matches"
        @click="refreshMatches"
      >
        Refresh
      </button>

      <ul class="match-list" data-testid="lobby-match-list">
        <li
          v-for="match in matches"
          :key="match.matchID"
          class="match-row"
        >
          <span class="match-id" :data-match-id="match.matchID">
            {{ match.matchID }}
          </span>
          <span class="seat-summary">
            {{ match.players.length }} seats
          </span>
          <ul class="seat-list">
            <li
              v-for="seat in match.players"
              :key="match.matchID + '-' + seat.id"
              class="seat-row"
            >
              <span>seat {{ seat.id }}</span>
              <span v-if="seat.name !== undefined"> — {{ seat.name }}</span>
              <button
                v-if="isOpenSeat(seat)"
                type="button"
                :disabled="isSubmitting"
                :data-testid="'lobby-join-' + match.matchID + '-' + seat.id"
                @click="joinExisting(match.matchID, seat.id)"
              >
                Join
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.lobby-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.lobby-error {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-foreground);
}

.create-match,
.join-existing,
.player-identity {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.match-list,
.seat-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.match-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0;
  border-top: 1px solid var(--color-foreground, #666);
}

.seat-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
</style>
