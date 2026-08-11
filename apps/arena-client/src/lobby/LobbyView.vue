<script lang="ts">
import { defineComponent, ref, computed, onMounted, watch, nextTick } from 'vue';
import type { MatchSetupConfig } from '@legendary-arena/game-engine';
import {
  createMatchWithBot,
  fetchMatch,
  joinMatch,
  listMatches,
  serverUrl,
  fetchSetupRequirements,
} from './lobbyApi';
import type { LobbyMatchSummary } from './lobbyApi';
import { parseMatchReference } from './matchReference';
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
import { persistMatchSetup, persistBotAllySetup } from '../diagnostics/matchSetupSession';
import { launchMatchFromComposition } from './useCreateMatchFromComposition';
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

function parsePositiveInteger(raw: string | number, fieldLabel: string): number {
  // why: a `<input type="number">` v-model yields a string in a real browser, but
  // some hosts (and test harnesses) hand back a number; coerce with String() so
  // this helper never throws a `.trim is not a function` on a numeric value.
  const trimmed = String(raw).trim();
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

    // why: WP-499 — the "Join by match ID or link" input. Holds the raw pasted
    // reference (a bare match ID or a full copy-join-link) until the player
    // clicks Join; `joinByReference` parses + resolves + seats them.
    const joinReference = ref('');

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

    // why: WP-376 — the bot-ally affordance reuses the main `numPlayers` field for
    // the seat count; these two add how many of those seats the bot ally fills
    // (default 1 human + 1 bot) and which policy drives it. Bounds: botCount is
    // 1..seatCount-1 so at least one seat is always left open for the human.
    const botAllyBotCount = ref('1');
    const botAllyPolicy = ref('competent');

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
    // why: WP-525 / D-24338 — the required counts are scheme-aware (Secret
    // Invasion requires 6 heroes), and the manual form and the pasted-loadout
    // path each carry their OWN scheme, so each keeps its own requirements table
    // fetched for its selected scheme. arena-client cannot import the registry
    // (layer boundary), so the scheme-aware count arrives as server data; the
    // pure comparator playerCountRequirements.ts is unchanged.
    const manualSetupRequirements = ref<SetupRequirements | null>(null);
    const jsonSetupRequirements = ref<SetupRequirements | null>(null);

    // why: re-fetch when the selected scheme changes so the pre-submit check and
    // the Create gate reflect the scheme. The in-flight scheme is captured so a
    // stale response (the scheme changed again mid-fetch) is discarded.
    async function refreshManualSetupRequirements(): Promise<void> {
      const requestedSchemeId = schemeId.value;
      try {
        const requirements = await fetchSetupRequirements(requestedSchemeId);
        if (schemeId.value === requestedSchemeId) {
          manualSetupRequirements.value = requirements;
        }
      } catch {
        if (schemeId.value === requestedSchemeId) {
          manualSetupRequirements.value = null;
        }
      }
    }
    async function refreshJsonSetupRequirements(): Promise<void> {
      const requestedSchemeId = parsedLoadout.value?.composition.schemeId ?? '';
      try {
        const requirements = await fetchSetupRequirements(requestedSchemeId);
        if ((parsedLoadout.value?.composition.schemeId ?? '') === requestedSchemeId) {
          jsonSetupRequirements.value = requirements;
        }
      } catch {
        if ((parsedLoadout.value?.composition.schemeId ?? '') === requestedSchemeId) {
          jsonSetupRequirements.value = null;
        }
      }
    }
    watch(schemeId, () => {
      void refreshManualSetupRequirements();
    });
    watch(
      () => parsedLoadout.value?.composition.schemeId,
      () => {
        void refreshJsonSetupRequirements();
      },
    );
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
        jsonSetupRequirements.value,
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
        manualSetupRequirements.value,
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
        // why: buildConfig() + the player-count parse stay INSIDE this try so a
        // pre-launch throw (an empty/non-numeric supply count or player count)
        // is caught here and surfaced with the same "Failed to create and join
        // the match." message the inline chain produced before the WP-448
        // extraction — preserving throw→catch parity. The launch primitive
        // itself never throws; it receives the already-resolved (config,
        // playerCount) and returns a typed result.
        const config = buildConfig();
        const seatCount = parsePositiveInteger(numPlayers.value, 'numPlayers');
        const result = await launchMatchFromComposition({
          config,
          playerCount: seatCount,
          playerName: playerName.value.trim(),
          authToken,
        });
        if (result.ok === false) {
          errorMessage.value = result.message;
        }
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

    /**
     * Creates a cooperative match with a bot ally filling the non-human seat(s),
     * then joins the human's own seat 0 and navigates to the play surface.
     *
     * // why: WP-376 — the human ALWAYS joins seat 0 via `joinMatch(..., authToken)`
     * (the authed path), NOT a server-returned credential like the autoplay
     * spectator flow (`startAutoplay`). That authed join is what writes seat 0's
     * `match_seat_accounts` row and hands back the human's own credential — keeping
     * WP-377's ranked/attribution correct (a server credential would leave seat 0
     * accountless and mark the human's own match Casual + unattributed). The bot
     * seats are reserved + auto-readied server-side; the client never readies or
     * starts the match and never touches the bot seats.
     */
    async function createWithBotAlly(): Promise<void> {
      if (isSubmitting.value) {
        return;
      }
      if (playerName.value.trim() === '') {
        errorMessage.value =
          'The "playerName" field must not be empty before creating a match.';
        return;
      }
      // why: WP-376 fast-follow — use whichever setup the player actually
      // authored. When a loadout is uploaded/pasted (the recommended LAGN path)
      // its composition + declared player count are authoritative (mirrors
      // submitFromJson); otherwise fall back to the manually-entered fields
      // (mirrors createAndJoin). Reading buildConfig() unconditionally sent an
      // empty composition whenever the player used the upload path, which the
      // game server (correctly) rejects with a 400.
      const parsed = parsedLoadout.value;
      const config = parsed !== null ? parsed.composition : buildConfig();
      const seatCount =
        parsed !== null
          ? parsed.playerCount
          : parsePositiveInteger(numPlayers.value, 'numPlayers');
      const botCount = parsePositiveInteger(botAllyBotCount.value, 'botAllyBotCount');
      // why: client-side UX validation mirroring the server 400 — a bot-ally match
      // needs at least 2 seats and must leave at least one open for the human, so
      // botCount is 1..seatCount-1. The server re-validates; this avoids a raw 400.
      if (seatCount < 2) {
        errorMessage.value =
          'A bot-ally match needs at least 2 seats. Choose a 2+ player loadout (or set the player count to 2 or more).';
        return;
      }
      if (botCount < 1 || botCount > seatCount - 1) {
        errorMessage.value =
          `The bot count must be between 1 and ${seatCount - 1} so at least one seat is left open for you.`;
        return;
      }
      const policy = botAllyPolicy.value === 'random' ? 'random' : 'competent';
      const authToken = requireAuthTokenOrRedirectToLogin();
      if (authToken === null) {
        return;
      }

      isSubmitting.value = true;
      try {
        const created = await createMatchWithBot(
          config,
          seatCount,
          botCount,
          policy,
          authToken,
        );
        // why: best-effort client-local setup stash (as createAndJoin does).
        persistMatchSetup(created.matchId, config);
        // why: WP-502 Play Again fix — also stash the bot parameters so a later
        // Play Again on this match rebuilds a bot-ally match (same bot count +
        // policy) instead of a plain human match with an empty bot seat.
        persistBotAllySetup(created.matchId, { botCount, policy });
        // why: the human joins their OWN seat 0 with the auth token — never the
        // server's credential (see the function-level note).
        const joined = await joinMatch(
          created.matchId,
          '0',
          playerName.value.trim(),
          authToken,
        );
        const query =
          `?match=${encodeURIComponent(created.matchId)}` +
          `&player=0` +
          `&credentials=${encodeURIComponent(joined.playerCredentials)}`;
        window.location.search = query;
      } catch (submitError) {
        const cause =
          submitError instanceof Error
            ? submitError.message
            : String(submitError);
        errorMessage.value = `Failed to create the bot-ally match. ${cause}`;
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

    async function joinByReference(): Promise<void> {
      if (isSubmitting.value) {
        return;
      }
      const matchID = parseMatchReference(joinReference.value);
      if (matchID === null) {
        errorMessage.value =
          'Enter a match ID or an invite link to join a match.';
        return;
      }

      let match: LobbyMatchSummary | null;
      try {
        match = await fetchMatch(matchID);
      } catch (fetchError) {
        const cause =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        errorMessage.value = `Could not look up match ${matchID}. ${cause}`;
        return;
      }

      if (match === null) {
        errorMessage.value = `No match found with ID ${matchID}. Check the ID or invite link and try again.`;
        return;
      }
      if (match.gameover !== null) {
        errorMessage.value = `Match ${matchID} has already finished, so it cannot be joined.`;
        return;
      }
      const openSeat = match.players.find(isOpenSeat);
      if (openSeat === undefined) {
        errorMessage.value = `Match ${matchID} has no open seats to join.`;
        return;
      }

      // why: WP-499 — reuse the existing authenticated join path. `joinExisting`
      // owns the playerName guard, the bearer token, POST /api/match/join, and
      // the navigation, so a manual join-by-reference is byte-identical to the
      // row Join button (no duplicated credential or navigation code).
      await joinExisting(matchID, openSeat.id);
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
      // why: envelope `playerCount` maps to `numPlayers` at this call site per
      // docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md §Player Count and the
      // `createMatch(config, numPlayers, authToken)` signature in
      // `./lobbyApi.ts`. The wire body becomes `{ numPlayers, setupData:
      // composition }`; envelope fields other than playerCount are dropped on
      // submission per D-9201 (envelope archival is a future server-side
      // concern). The create → persist → join(seat 0) → nav chain itself now
      // lives once in launchMatchFromComposition (WP-448), never inline here.
      const result = await launchMatchFromComposition({
        config: parsed.composition,
        playerCount: parsed.playerCount,
        playerName: playerName.value.trim(),
        authToken,
      });
      if (result.ok === false) {
        errorMessage.value = result.message;
      }
      isSubmitting.value = false;
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
      // why: WP-371 / WP-525 — load the scheme-aware player-count setup
      // requirements for both create paths' pre-submit checks. Best-effort: on
      // any failure the ref stays null and the authoritative engine block still
      // rejects a bad composition at create time.
      await Promise.all([refreshManualSetupRequirements(), refreshJsonSetupRequirements()]);
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
      joinByReference,
      joinReference,
      isOpenSeat,
      autoplayPlayerCount,
      autoplayPolicy,
      autoplayDelay,
      startAutoplay,
      botAllyBotCount,
      botAllyPolicy,
      createWithBotAlly,
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

    <!-- why: WP-376 — co-op affordance (VISION §23(b)): the bot is an ally on
         the player's side, fighting the Mastermind together. Seat count reuses
         the main numPlayers field above; this adds the bot count + policy. -->
    <section
      class="play-with-bot-ally"
      aria-labelledby="bot-ally-heading"
      data-testid="lobby-bot-ally"
    >
      <h2 id="bot-ally-heading">Play with a bot ally</h2>

      <p class="bot-ally-hint">
        Add a bot ally to your table to play a cooperative game on your own — the
        bot fills the other seat(s) and takes its turns alongside you against the
        Mastermind. Uses the player count and loadout you set above.
      </p>

      <label for="botAllyBotCount">Bot allies (1 or more, leaving a seat for you)</label>
      <input
        id="botAllyBotCount"
        v-model="botAllyBotCount"
        type="number"
        min="1"
        max="4"
        aria-label="Number of bot allies"
      />

      <label for="botAllyPolicy">Bot ally skill</label>
      <select
        id="botAllyPolicy"
        v-model="botAllyPolicy"
        aria-label="Bot ally policy"
      >
        <option value="competent">Competent (heuristic)</option>
        <option value="random">Random</option>
      </select>

      <button
        type="button"
        :disabled="isSubmitting"
        data-testid="lobby-create-bot-ally"
        @click="createWithBotAlly"
      >
        Play with a bot ally
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

      <!-- why: WP-499 — join by a pasted match ID or invite link, so an
           unlisted match (absent from the list below) or a link from a friend
           can be joined directly without hunting the list. -->
      <div class="join-by-reference">
        <label for="join-reference">Join by match ID or link</label>
        <input
          id="join-reference"
          v-model="joinReference"
          type="text"
          placeholder="Paste a match ID or invite link"
          data-testid="lobby-join-reference-input"
        />
        <button
          type="button"
          :disabled="isSubmitting"
          data-testid="lobby-join-reference-submit"
          @click="joinByReference"
        >
          Join
        </button>
      </div>

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
