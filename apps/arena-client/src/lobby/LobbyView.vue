<script lang="ts">
import { defineComponent, ref, computed, onMounted, nextTick } from 'vue';
import type { MatchSetupConfig } from '@legendary-arena/game-engine';
import {
  createMatch,
  joinMatch,
  listMatches,
  serverUrl,
  fetchSetupRequirements,
} from './lobbyApi';
import type { LobbyMatchSummary } from './lobbyApi';
import {
  computePlayerCountMismatches,
  formatMismatchWarning,
} from './playerCountRequirements';
import type { SetupRequirements } from './playerCountRequirements';
import { filterJoinableMatches } from './lobbyMatchFilter';
import { parseLoadoutJson } from './parseLoadoutJson';
import type { ParsedLoadout } from './parseLoadoutJson';
import { convertLagnUpload } from './lagnLoadout';
import type { LagnDisplayNames } from './lagnLoadout';
import { persistMatchSetup } from '../diagnostics/matchSetupSession';
import { useAuthStore } from '../stores/auth';

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
    // why: defaults must meet the engine's per-pile supply floors (D-24032:
    // bystanders/wounds/officers each >= 30) so the advanced manual "Create
    // match" path succeeds out of the box. The former 1 / 5 defaults were
    // below the floor and made every default manual create fail validation —
    // surfaced as an opaque HTTP 500 before the validateSetupData fix. These
    // match the Registry Viewer loadout-builder defaults and loadout-test.json.
    const bystandersCount = ref('30');
    const woundsCount = ref('30');
    const officersCount = ref('30');
    const sidekicksCount = ref('12');

    const numPlayers = ref('2');
    const playerName = ref('');

    const matches = ref<LobbyMatchSummary[]>([]);
    // why: WP-326 — the "Join existing match" list shows only joinable matches
    // (at least one open seat AND not gameover). `matches` keeps the raw server
    // result so a future spectate view can reach the full list without a
    // re-fetch; the template iterates this filtered computed instead. Filtering a
    // read-only server list is a display concern — the client deletes no match
    // (the server-side reaper that removes stale rows is WP-327).
    const joinableMatches = computed(() => filterJoinableMatches(matches.value));

    // why: WP-369 — the waiting-room copy-join-link lands the recipient here as
    // `?route=lobby&match=<id>`. Read that id once and order/highlight the row so
    // the friend can join it in one click instead of hunting the list. Absent
    // param → no highlight, list unchanged. `joinExisting` / the join contract is
    // untouched (this is display ordering only).
    const highlightMatchId =
      new URLSearchParams(window.location.search).get('match') ?? '';
    const orderedMatches = computed<LobbyMatchSummary[]>(() => {
      const list = joinableMatches.value;
      if (highlightMatchId === '') {
        return list;
      }
      const highlighted = list.filter(
        (match) => match.matchID === highlightMatchId,
      );
      const rest = list.filter((match) => match.matchID !== highlightMatchId);
      return [...highlighted, ...rest];
    });

    const errorMessage = ref<string | null>(null);
    const isSubmitting = ref(false);

    const autoplayPlayerCount = ref('1');
    const autoplayPolicy = ref('competent');
    const autoplayDelay = ref('800');

    // why: JSON-first layout per WP-092. The Registry Viewer loadout
    // builder (WP-091) is the expected authoring path; users export a
    // MATCH-SETUP JSON document and either upload the file or paste its
    // contents here. The 9-field manual form below is preserved as a
    // power-user fallback wrapped in a <details> titled "Fill in manually
    // (advanced)" — closed by default, all WP-090 bindings byte-for-byte
    // unchanged. parsedLoadout caches the most recent successful parse so
    // the submit button stays disabled (per the gate below) until a valid
    // shape-guard pass is in hand.
    const pasteText = ref('');
    const parsedLoadout = ref<ParsedLoadout | null>(null);
    // why: WP-371 — the per-player-count setup requirements, fetched once from
    // the server on mount (guest endpoint). Null until loaded (or if the fetch
    // fails), in which case the pre-submit check stays silent and the
    // authoritative engine block (WP-370, surfaced as a create 400) still applies.
    const setupRequirements = ref<SetupRequirements | null>(null);
    // why: content-preview state so the operator can confirm the uploaded
    // setup (mastermind, scheme, villains, henchmen, heroes) before creating
    // the match. `loadoutDisplayNames` is populated only on the LAGN path
    // (LAGN files carry human-readable names); the MATCH-SETUP path leaves it
    // null and the preview falls back to the composition ext_ids.
    const loadoutFormat = ref<'LAGN' | 'MATCH-SETUP' | null>(null);
    const loadoutDisplayNames = ref<LagnDisplayNames | null>(null);
    // why: the preview rows shown under the upload control. Each entity row
    // prefers the LAGN display name and falls back to the composition ext_id,
    // so a Registry-Viewer LAGN export (ids only) still reflects its contents.
    const loadoutPreview = computed(() => {
      const parsed = parsedLoadout.value;
      if (parsed === null) {
        return null;
      }
      const names = loadoutDisplayNames.value;
      const composition = parsed.composition;
      return {
        format: loadoutFormat.value ?? 'MATCH-SETUP',
        mastermind: names?.mastermind ?? composition.mastermindId,
        scheme: names?.scheme ?? composition.schemeId,
        villainGroups: names?.villainGroups ?? composition.villainGroupIds,
        henchmanGroups: names?.henchmanGroups ?? composition.henchmanGroupIds,
        heroes: names?.heroes ?? composition.heroDeckIds,
        bystandersCount: composition.bystandersCount,
        woundsCount: composition.woundsCount,
        officersCount: composition.officersCount,
        sidekicksCount: composition.sidekicksCount,
        playerCount: parsed.playerCount,
        heroSelectionMode: parsed.heroSelectionMode,
      };
    });
    // why: WP-371 — player-count composition mismatches for the two create
    // paths. The uploaded loadout carries its own playerCount + composition;
    // the manual form uses its numPlayers ref + the CSV field lengths. Both
    // return [] when the requirements have not loaded, so the check is a
    // progressive enhancement over the authoritative engine block.
    const jsonPlayerCountMismatches = computed(() => {
      const parsed = parsedLoadout.value;
      if (parsed === null) {
        return [];
      }
      return computePlayerCountMismatches(
        setupRequirements.value,
        parsed.playerCount,
        {
          villainGroups: parsed.composition.villainGroupIds.length,
          henchmanGroups: parsed.composition.henchmanGroupIds.length,
          heroes: parsed.composition.heroDeckIds.length,
        },
      );
    });
    const manualPlayerCountMismatches = computed(() => {
      return computePlayerCountMismatches(
        setupRequirements.value,
        Number(numPlayers.value),
        {
          villainGroups: splitCsv(villainGroupIds.value).length,
          henchmanGroups: splitCsv(henchmanGroupIds.value).length,
          heroes: splitCsv(heroDeckIds.value).length,
        },
      );
    });
    const jsonPlayerCountWarnings = computed<string[]>(() =>
      jsonPlayerCountMismatches.value.map((mismatch) =>
        formatMismatchWarning(parsedLoadout.value?.playerCount ?? 0, mismatch),
      ),
    );
    const manualPlayerCountWarnings = computed<string[]>(() =>
      manualPlayerCountMismatches.value.map((mismatch) =>
        formatMismatchWarning(Number(numPlayers.value), mismatch),
      ),
    );

    // why: disabling the submit button until parse success prevents
    // partially parsed or stale JSON from being submitted, ensuring
    // createMatch is never called with unchecked input. The button also
    // re-disables during submission so a double-click cannot create two
    // matches. WP-371 adds the player-count composition gate so a loadout that
    // does not match its player count cannot be submitted (the engine would
    // reject it anyway; this catches it earlier with a clear warning).
    const canSubmitFromJson = computed(
      (): boolean =>
        parsedLoadout.value !== null &&
        !isSubmitting.value &&
        jsonPlayerCountMismatches.value.length === 0,
    );
    // why: WP-371 — the manual "advanced" create is likewise blocked while its
    // composition does not match the chosen player count.
    const canSubmitCreate = computed(
      (): boolean =>
        !isSubmitting.value && manualPlayerCountMismatches.value.length === 0,
    );

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

    const authStore = useAuthStore();

    // why: D-24092 — playing a seat in a multiplayer match requires a free
    // account. Returns the bearer token when signed in; otherwise sends the
    // visitor to the sign-in route and returns null so the caller aborts
    // without issuing an unauthenticated create/join. Spectating and "Watch
    // Bot Play" stay open and never call this.
    function requireAuthTokenOrRedirectToLogin(): string | null {
      const token = authStore.token;
      if (token === null) {
        window.location.search = '?route=login';
        return null;
      }
      return token;
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
      const authToken = requireAuthTokenOrRedirectToLogin();
      if (authToken === null) {
        return;
      }

      isSubmitting.value = true;
      try {
        const config = buildConfig();
        const seatCount = parsePositiveInteger(numPlayers.value, 'numPlayers');
        const created = await createMatch(config, seatCount, authToken);
        // why: stash the submitted setup so the play-surface Download diagnostics
        // can include the input pile counts (matchSetupSession; client-local,
        // no network egress). Best-effort — never blocks create/join.
        persistMatchSetup(created.matchID, config);
        const joined = await joinMatch(
          created.matchID,
          '0',
          playerName.value.trim(),
          authToken,
        );
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
      const authToken = requireAuthTokenOrRedirectToLogin();
      if (authToken === null) {
        return;
      }

      isSubmitting.value = true;
      try {
        const joined = await joinMatch(
          matchID,
          seatId,
          playerName.value.trim(),
          authToken,
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

    function applyParseResult(input: string): void {
      // why: D-24018 — recognize a LAGN file (WP-244) first and convert it to
      // the composition shape parseLoadoutJson already validates. A LAGN file
      // carries names for the content preview; a MATCH-SETUP file does not, so
      // the preview falls back to ext_ids. `not_lagn` (including malformed
      // JSON) falls through to the MATCH-SETUP path, which owns the canonical
      // invalid_json / shape errors.
      const lagn = convertLagnUpload(input);
      if (lagn.kind === 'error') {
        parsedLoadout.value = null;
        loadoutFormat.value = null;
        loadoutDisplayNames.value = null;
        errorMessage.value = lagn.message;
        return;
      }

      const documentText = lagn.kind === 'ok' ? lagn.documentJson : input;
      const result = parseLoadoutJson(documentText);
      if (result.ok === true) {
        parsedLoadout.value = result.value;
        loadoutFormat.value = lagn.kind === 'ok' ? 'LAGN' : 'MATCH-SETUP';
        loadoutDisplayNames.value =
          lagn.kind === 'ok' ? lagn.displayNames : null;
        errorMessage.value = null;
        return;
      }
      parsedLoadout.value = null;
      loadoutFormat.value = null;
      loadoutDisplayNames.value = null;
      errorMessage.value = result.error.message;
    }

    function readUploadedFile(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            resolve(result);
            return;
          }
          reject(
            new Error(
              'The uploaded file could not be read as text. Re-export the loadout JSON from the Registry Viewer.',
            ),
          );
        };
        reader.onerror = () => {
          reject(
            new Error(
              'The browser failed to read the uploaded file. Try uploading again or paste the JSON contents instead.',
            ),
          );
        };
        reader.readAsText(file);
      });
    }

    async function handleFileUpload(event: Event): Promise<void> {
      const input = event.target as HTMLInputElement | null;
      if (input === null || input.files === null || input.files.length === 0) {
        return;
      }
      const file = input.files[0]!;
      try {
        const text = await readUploadedFile(file);
        applyParseResult(text);
      } catch (readError) {
        const cause =
          readError instanceof Error ? readError.message : String(readError);
        parsedLoadout.value = null;
        errorMessage.value = cause;
      }
    }

    function parsePasted(): void {
      applyParseResult(pasteText.value);
    }

    async function loadSampleLoadout(): Promise<void> {
      try {
        const response = await fetch('/loadout-test.json');
        if (!response.ok) {
          errorMessage.value = `Failed to fetch sample loadout: ${response.status} ${response.statusText}`;
          return;
        }
        const text = await response.text();
        applyParseResult(text);
      } catch (fetchError) {
        const cause =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        errorMessage.value = `Failed to load sample loadout. ${cause}`;
      }
    }

    async function submitFromJson(): Promise<void> {
      if (isSubmitting.value) {
        return;
      }
      const parsed = parsedLoadout.value;
      if (parsed === null) {
        return;
      }
      if (playerName.value.trim() === '') {
        errorMessage.value =
          'The "playerName" field must not be empty before creating a match.';
        return;
      }

      const authToken = requireAuthTokenOrRedirectToLogin();
      if (authToken === null) {
        return;
      }

      isSubmitting.value = true;
      try {
        // why: envelope `playerCount` maps to `numPlayers` at this call
        // site per docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md §Player Count
        // and the `createMatch(config, numPlayers, authToken)` signature in
        // `./lobbyApi.ts`. The wire body becomes `{ numPlayers, setupData:
        // composition }`; envelope fields other than playerCount are dropped
        // on submission per D-9201 (envelope archival is a future
        // server-side concern).
        const created = await createMatch(
          parsed.composition,
          parsed.playerCount,
          authToken,
        );
        // why: stash the submitted composition so the play-surface Download
        // diagnostics can include the input pile counts (matchSetupSession;
        // client-local, no network egress). Best-effort — never blocks create/join.
        persistMatchSetup(created.matchID, parsed.composition);
        const joined = await joinMatch(
          created.matchID,
          '0',
          playerName.value.trim(),
          authToken,
        );
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

    async function startAutoplay(): Promise<void> {
      if (isSubmitting.value) {
        return;
      }
      isSubmitting.value = true;
      try {
        const response = await fetch(`${serverUrl}/api/match/autoplay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerCount: Number(autoplayPlayerCount.value) || 1,
            policy: autoplayPolicy.value,
            delayMs: Number(autoplayDelay.value) || 800,
          }),
        });
        if (!response.ok) {
          const errorBody = await response.text();
          errorMessage.value = `Autoplay failed: ${errorBody}`;
          return;
        }
        const result = await response.json();
        const query =
          `?match=${encodeURIComponent(result.matchId)}` +
          `&player=0` +
          `&credentials=${encodeURIComponent(result.credentials['0'])}`;
        window.location.search = query;
      } catch (autoplayError) {
        const cause =
          autoplayError instanceof Error
            ? autoplayError.message
            : String(autoplayError);
        errorMessage.value = `Autoplay request failed. ${cause}`;
      } finally {
        isSubmitting.value = false;
      }
    }

    onMounted(async () => {
      await refreshMatches();
      // why: WP-371 — load the player-count setup requirements for the
      // pre-submit check. Best-effort: on any failure the pre-check stays
      // silent (setupRequirements stays null) and the authoritative engine
      // block still rejects a bad composition at create time.
      try {
        setupRequirements.value = await fetchSetupRequirements();
      } catch {
        setupRequirements.value = null;
      }
      // why: WP-369 — after the list loads, scroll the highlighted match into
      // view. Guarded because jsdom (tests) does not implement scrollIntoView.
      if (highlightMatchId !== '') {
        await nextTick();
        const highlightedRow = document.querySelector(
          `[data-match-id="${highlightMatchId}"]`,
        );
        if (
          highlightedRow !== null &&
          typeof highlightedRow.scrollIntoView === 'function'
        ) {
          highlightedRow.scrollIntoView({ block: 'center' });
        }
      }
    });

    return {
      highlightMatchId,
      orderedMatches,
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
      joinableMatches,
      errorMessage,
      isSubmitting,
      pasteText,
      parsedLoadout,
      loadoutPreview,
      canSubmitFromJson,
      canSubmitCreate,
      jsonPlayerCountWarnings,
      manualPlayerCountWarnings,
      handleFileUpload,
      parsePasted,
      submitFromJson,
      loadSampleLoadout,
      refreshMatches,
      submitCreate,
      joinExisting,
      isOpenSeat,
      autoplayPlayerCount,
      autoplayPolicy,
      autoplayDelay,
      startAutoplay,
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

    <section
      class="watch-bot-play"
      aria-labelledby="watch-bot-heading"
      data-testid="lobby-watch-bot"
    >
      <h2 id="watch-bot-heading">Watch Bot Play</h2>

      <label for="autoplayPlayerCount">Players (1-5)</label>
      <input
        id="autoplayPlayerCount"
        v-model="autoplayPlayerCount"
        type="number"
        min="1"
        max="5"
        aria-label="Number of bot players"
      />

      <label for="autoplayPolicy">AI Policy</label>
      <select
        id="autoplayPolicy"
        v-model="autoplayPolicy"
        aria-label="AI policy"
      >
        <option value="competent">Competent (heuristic)</option>
        <option value="random">Random</option>
      </select>

      <label for="autoplayDelay">Delay between moves (ms)</label>
      <input
        id="autoplayDelay"
        v-model="autoplayDelay"
        type="number"
        min="100"
        max="5000"
        step="100"
        aria-label="Delay between moves in milliseconds"
      />

      <button
        type="button"
        :disabled="isSubmitting"
        data-testid="lobby-start-autoplay"
        @click="startAutoplay"
      >
        Watch Bot Play
      </button>
    </section>

    <section
      class="create-from-json"
      aria-labelledby="create-from-json-heading"
      data-testid="lobby-create-from-json"
    >
      <h2 id="create-from-json-heading">
        Create match from game setup — LAGN format (recommended)
      </h2>

      <label for="loadoutFile">Upload a loadout JSON file</label>
      <input
        id="loadoutFile"
        type="file"
        accept="application/json,.json"
        data-testid="lobby-loadout-file"
        @change="handleFileUpload"
      />

      <button
        type="button"
        data-testid="lobby-load-sample"
        @click="loadSampleLoadout"
      >
        Load sample loadout (test)
      </button>

      <details class="loadout-paste">
        <summary>Paste loadout JSON instead</summary>
        <label for="loadoutPaste">Paste loadout JSON</label>
        <textarea
          id="loadoutPaste"
          v-model="pasteText"
          rows="8"
          aria-label="Paste loadout JSON"
          data-testid="lobby-loadout-paste"
        ></textarea>
        <button
          type="button"
          data-testid="lobby-loadout-parse"
          @click="parsePasted"
        >
          Parse pasted JSON
        </button>
      </details>

      <div
        v-if="loadoutPreview !== null"
        class="loadout-preview"
        data-testid="lobby-loadout-preview"
      >
        <p
          class="loadout-parsed-summary"
          data-testid="lobby-loadout-parsed-summary"
        >
          Loadout parsed ({{ loadoutPreview.format }}):
          {{ loadoutPreview.playerCount }} seat(s),
          rule mode {{ loadoutPreview.heroSelectionMode }}.
        </p>
        <dl class="loadout-preview-grid">
          <div class="loadout-preview-row">
            <dt>Mastermind</dt>
            <dd data-testid="preview-mastermind">{{ loadoutPreview.mastermind }}</dd>
          </div>
          <div class="loadout-preview-row">
            <dt>Scheme</dt>
            <dd data-testid="preview-scheme">{{ loadoutPreview.scheme }}</dd>
          </div>
          <div class="loadout-preview-row">
            <dt>Villain groups</dt>
            <dd data-testid="preview-villains">{{ loadoutPreview.villainGroups.join(', ') }}</dd>
          </div>
          <div class="loadout-preview-row">
            <dt>Henchman groups</dt>
            <dd data-testid="preview-henchmen">{{ loadoutPreview.henchmanGroups.join(', ') }}</dd>
          </div>
          <div class="loadout-preview-row">
            <dt>Heroes</dt>
            <dd data-testid="preview-heroes">{{ loadoutPreview.heroes.join(', ') }}</dd>
          </div>
          <div class="loadout-preview-row">
            <dt>Bystanders / Wounds / Officers / Sidekicks</dt>
            <dd data-testid="preview-counts">
              {{ loadoutPreview.bystandersCount }} /
              {{ loadoutPreview.woundsCount }} /
              {{ loadoutPreview.officersCount }} /
              {{ loadoutPreview.sidekicksCount }}
            </dd>
          </div>
        </dl>
      </div>

      <ul
        v-if="jsonPlayerCountWarnings.length > 0"
        class="player-count-warnings"
        data-testid="lobby-json-player-count-warnings"
      >
        <li v-for="warning in jsonPlayerCountWarnings" :key="warning">
          {{ warning }}
        </li>
      </ul>

      <button
        type="button"
        :disabled="!canSubmitFromJson"
        data-testid="lobby-submit-from-json"
        @click="submitFromJson"
      >
        Create match from loadout
      </button>
    </section>

    <details class="manual-form-wrapper" data-testid="lobby-manual-form-wrapper">
      <summary>Fill in manually (advanced)</summary>

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

      <ul
        v-if="manualPlayerCountWarnings.length > 0"
        class="player-count-warnings"
        data-testid="lobby-manual-player-count-warnings"
      >
        <li v-for="warning in manualPlayerCountWarnings" :key="warning">
          {{ warning }}
        </li>
      </ul>

      <button
        type="button"
        :disabled="!canSubmitCreate"
        data-testid="lobby-submit-create"
        @click="submitCreate"
      >
        Create match
      </button>
    </section>
    </details>

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

      <p
        v-if="joinableMatches.length === 0"
        class="match-list-empty"
        data-testid="lobby-match-list-empty"
      >
        No open matches right now — create one above.
      </p>

      <ul class="match-list" data-testid="lobby-match-list">
        <li
          v-for="match in orderedMatches"
          :key="match.matchID"
          class="match-row"
          :class="{ 'match-row--highlight': match.matchID === highlightMatchId }"
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
.player-identity,
.create-from-json,
.watch-bot-play {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.loadout-paste {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.manual-form-wrapper {
  margin-top: 0.5rem;
}

.loadout-parsed-summary {
  padding: 0.25rem 0.5rem;
  border: 1px dashed var(--color-foreground, #666);
}

.loadout-preview {
  margin: 0.5rem 0;
}

.loadout-preview-grid {
  margin: 0.5rem 0 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-foreground, #666);
  border-radius: 4px;
}

.loadout-preview-row {
  display: flex;
  gap: 0.75rem;
  padding: 0.15rem 0;
  align-items: baseline;
}

.loadout-preview-row dt {
  flex: 0 0 14rem;
  font-weight: 600;
  margin: 0;
}

.loadout-preview-row dd {
  margin: 0;
  word-break: break-word;
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

/* why: WP-369 — the match reached via a copy-join-link (?match=<id>) is ordered
   first and highlighted so the recipient spots it immediately. */
.match-row--highlight {
  padding: 0.5rem;
  border-top: none;
  border-radius: 6px;
  background: rgba(59, 130, 246, 0.12);
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.5);
}

.seat-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.match-list-empty {
  padding: 0.5rem 0;
  opacity: 0.75;
}
</style>
