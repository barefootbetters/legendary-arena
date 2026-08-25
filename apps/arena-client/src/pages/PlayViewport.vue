<script lang="ts">
import { computed, defineComponent, ref, toRef, type PropType } from 'vue';
import { storeToRefs } from 'pinia';

import PlayDesktop from './PlayDesktop.vue';
import PlayMobile from './PlayMobile.vue';
import DiagnosticExportButton from '../components/DiagnosticExportButton.vue';
import ViewLoadoutButton from '../components/ViewLoadoutButton.vue';
import WaitingForPlayersPanel from '../components/WaitingForPlayersPanel.vue';
import HollowEffectsPanel from '../components/play/HollowEffectsPanel.vue';
import DeckProbabilityPanel from '../components/play/DeckProbabilityPanel.vue';
import AudioControls from '../components/play/AudioControls.vue';
import VfxOverlay from '../components/play/VfxOverlay.vue';
import BotAllyStallBanner from '../components/BotAllyStallBanner.vue';
import UpdateAvailableBanner from '../components/UpdateAvailableBanner.vue';
import EndgameActions from '../components/play/EndgameActions.vue';
import { useViewport } from '../composables/useViewport';
import { useSkinApplier } from '../composables/useSkinApplier';
import {
  useCompetitiveSubmitOnGameover,
  type SubmissionStatus,
} from '../composables/useCompetitiveSubmitOnGameover';
import { useCardImagePrefetch } from '../composables/useCardImagePrefetch';
import { useSoundEffects } from '../composables/useSoundEffects';
import { useComboCue } from '../composables/useComboCue';
import { useComboVfx } from '../composables/useComboVfx';
import { useAdaptiveMusic } from '../composables/useAdaptiveMusic';
import { useBotAllyStatus } from '../composables/useBotAllyStatus';
import { useDeployVersionCheck } from '../composables/useDeployVersionCheck';
import { useUiStateStore } from '../stores/uiState';
import { useAuthStore } from '../stores/auth';
import { readMatchSetup, readBotAllySetup } from '../diagnostics/matchSetupSession';
import {
  launchMatchFromComposition,
  launchBotAllyFromComposition,
} from '../lobby/useCreateMatchFromComposition';
import type { SubmitMove } from '../components/play/uiMoveName.types';
import type { MatchSetupConfig } from '@legendary-arena/game-engine';

// why: WP-339 — the user-facing message for each post-match submission status.
// Mounted once here at the shared viewport root (which holds matchId, D-16501), so
// a single submit covers both the <PlayDesktop> and <PlayMobile> surfaces.
// why: WP-465 — typed `Record<Exclude<SubmissionStatus, 'idle'>, string>` so every
// non-idle status is compile-forced to have copy (a new status without a message is a
// vue-tsc error). `'idle'` is excluded because the banner is hidden while idle
// (v-if="submissionStatus !== 'idle'"), so it intentionally has no message.
const SUBMISSION_MESSAGES: Record<Exclude<SubmissionStatus, 'idle'>, string> = {
  submitting: 'Submitting your score…',
  submitted: 'Score submitted to the leaderboard.',
  already: 'Your score for this match was already submitted.',
  guest: 'Sign in to submit your score to the leaderboard.',
  // why: WP-465 — `par_not_published`: the match is not a ranked-gauntlet loadout, so
  // it is permanently not eligible to be scored. An honest, non-alarming line (not an
  // error — the player did nothing wrong).
  ineligible: 'This match isn’t part of a ranked gauntlet, so it isn’t scored to the leaderboard.',
  // why: WP-465 — retry-NEUTRAL. The failed bucket mixes transient (network, 500) and
  // permanent (not_owner, visibility_not_eligible, replay_verification_failed) reasons,
  // so the old “It may still be counted shortly.” was a false promise for the permanent
  // ones; this line is honest for both without implying a retry that does not happen.
  failed: 'Couldn’t submit your score to the leaderboard.',
};

/**
 * Viewport discriminator. Renders `<PlayDesktop>` when the viewport is
 * desktop-sized; `<PlayMobile>` when the viewport is mobile-portrait.
 * The breakpoint is locked at D-12909 (`max-width: 767px`).
 *
 * Filename `PlayViewport.vue` chosen to disambiguate from the deleted
 * WP-100 `components/play/PlayView.vue` per EC-132 §2.
 *
 * Per the EC-132 §2 SFC authoring whitelist: this page uses a composable
 * (`useViewport`) and conditionally renders children, so it MUST use
 * `defineComponent({ setup() { return {...} } })` per P6-30 / P6-46 /
 * D-6512.
 *
 * Per WP-130, `useSkinApplier()` is invoked here against the viewport's
 * root element so the active playmat skin's CSS class propagates to
 * both `<PlayDesktop>` and `<PlayMobile>` (whichever this component
 * renders). Application is exclusive to this root element — never
 * `<body>` or any global document node — so non-Play pages (lobby,
 * replay-viewer, future routes) never inherit skin styling.
 *
 * @see WP-129 §Acceptance Criteria — viewport discriminator
 * @see WP-130 §D "Skin application"
 * @see DECISIONS.md D-12909 viewport breakpoint
 */
export default defineComponent({
  name: 'PlayViewport',
  components: { PlayDesktop, PlayMobile, DiagnosticExportButton, ViewLoadoutButton, WaitingForPlayersPanel, HollowEffectsPanel, DeckProbabilityPanel, AudioControls, VfxOverlay, BotAllyStallBanner, UpdateAvailableBanner, EndgameActions },
  props: {
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
    // why: forwarded to <PlayDesktop> only (the autoplay bar is desktop-only);
    // part of the additive App.vue → PlayViewport.vue → PlayDesktop.vue
    // matchId prop-drill (D-16501). Defaults to '' so non-live mounts forward
    // an empty value that probes nothing.
    matchId: {
      type: String,
      default: '',
    },
    villainGroupIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    henchmanGroupIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    heroDeckIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
  },
  setup(props) {
    const { isMobile } = useViewport();
    const viewportRoot = ref<HTMLElement | null>(null);
    useSkinApplier(viewportRoot);

    // why: WP-410 — warm the match's card images into the browser cache at match
    // start (from the engine-projected UIState.matchCardImageUrls) so a card paints
    // from cache on reveal instead of round-tripping to R2 mid-turn. Fire-and-forget
    // and a no-op until the manifest arrives, so it is safe at this shared root.
    useCardImagePrefetch();

    // why: WP-412 — mount the notable-event SFX consumer at this shared composable
    // root, reading the SAME useUiStateStore snapshot PlayDesktop's overlay reads
    // (a sibling reader of the store, not a prop consumer). Audio is pure client
    // presentation — it reads UIState only, never writes G/ctx, and adds zero
    // determinism/replay footprint. AudioControls (rendered below) owns the
    // autoplay-unlock arm and the persistent mute/volume UI.
    const audioStore = useUiStateStore();
    const { snapshot: audioSnapshot } = storeToRefs(audioStore);
    useSoundEffects(audioSnapshot);

    // why: WP-413 — the tiered combo cue, mounted at the SAME shared composable
    // root beside useSoundEffects, reading the SAME useUiStateStore snapshot. It
    // watches WP-409's UIState.game.lastPlayEffectsFired scalar and plays an
    // escalating sting through the same WP-412 engine (getAudioEngine()), so it
    // inherits that engine's unlock/mute/volume gate. Pure presentation — reads
    // UIState only, never writes G/ctx; no new control (reuses AudioControls).
    useComboCue(audioSnapshot);

    // why: WP-556 — the tiered combo FLASH (the visual twin of useComboCue),
    // mounted at the SAME shared composable root beside useComboCue, reading the
    // SAME useUiStateStore snapshot. It watches WP-409's
    // UIState.game.lastPlayEffectsFired scalar through the SAME comboTierForCount
    // and emits a combo-flash signal the <VfxOverlay> below renders, so the flash
    // and the sting peak together. Pure presentation — reads UIState only, never
    // writes G/ctx, absent from the determinism hash.
    useComboVfx(audioSnapshot);

    // why: WP-560 — the adaptive danger score, mounted at the SAME shared
    // composable root beside useComboCue and reading the SAME snapshot. One
    // host covers both the desktop and mobile play surfaces.
    useAdaptiveMusic(audioSnapshot);

    // why: WP-339 — on gameover, submit this match's competitive score once (for
    // an authenticated player). toRef keeps matchId reactive so the composable
    // re-arms if a new live match reuses this viewport instance.
    const { submissionStatus, submittedScore } = useCompetitiveSubmitOnGameover(
      toRef(props, 'matchId'),
    );
    const submissionMessage = computed<string>(() => {
      const status = submissionStatus.value;
      // why: WP-465 — 'idle' has no banner (rendered only when status !== 'idle')
      // and no message entry; narrowing it out lets SUBMISSION_MESSAGES be the
      // exhaustive Record<Exclude<SubmissionStatus, 'idle'>, string> (a missing
      // status is now a compile error, not a silent '').
      return status === 'idle' ? '' : SUBMISSION_MESSAGES[status];
    });

    // why: WP-415 — mounted ONCE at this 01.5 play-root host (the WP-410/412
    // precedent), so the bot-ally stall banner covers BOTH the <PlayMobile> and
    // <PlayDesktop> surfaces. Probes WP-414's status surface once; a non-bot-ally
    // match reports `absent` and the poll stops immediately, so this adds nothing
    // outside a real bot-ally match. Pure client presentation — HTTP-only, no
    // engine/registry import, no G/ctx read.
    const { hasStopped: isBotAllyStopped, message: botAllyMessage } =
      useBotAllyStatus(props.matchId);

    // why: WP-418 — mounted ONCE at this 01.5 play-root host (the WP-410/412/415
    // wiring precedent), so the deploy-refresh banner covers BOTH the <PlayMobile>
    // and <PlayDesktop> surfaces. Detects a newer client build (a mid-match deploy
    // swaps hashed chunks and freezes the stale tab) and offers a reload — the one
    // recovery the reconnect/resync stack cannot do, since it re-anchors match
    // state but never the JS bundle (D-24238). Pure client presentation — no
    // engine/registry import, no G/ctx read; fail-soft, non-move-gating.
    const { updateAvailable: isUpdateAvailable } = useDeployVersionCheck();

    // why: the reload is USER-INITIATED (a button), never automatic — a forced
    // reload mid-turn would discard an in-progress action and read as hostile
    // (WP-418 §Out of scope). The reload site is owned here at the host and
    // prop-drilled into the pure banner (the ConnectionStatusBanner/resync pattern).
    function reloadForUpdate(): void {
      window.location.reload();
    }

    // why: the stall escape is a NON-DESTRUCTIVE, client-only navigation — it
    // returns to the lobby (the default route, reached by clearing the live
    // `?match=` params) and calls NO server endpoint; the server-side match is
    // never abandoned from here.
    function returnToLobby(): void {
      window.location.assign('/');
    }

    // why: WP-502 / D-24306 — the post-match "Play Again" / "Back to Lobby" panel
    // is mounted ONCE here at the shared viewport root (the WP-410/412/415/418
    // wiring precedent), so it covers BOTH the <PlayMobile> and <PlayDesktop>
    // surfaces. It reads the SAME useUiStateStore snapshot the submit hook reads;
    // gameOver presence is the "match over" signal. Pure client — no engine/G write.
    const endgameStore = useUiStateStore();
    const { snapshot: endgameSnapshot } = storeToRefs(endgameStore);
    const authStore = useAuthStore();

    const isGameOver = computed<boolean>(
      () => endgameSnapshot.value?.gameOver !== undefined,
    );
    const isEndedEarly = computed<boolean>(
      () => endgameSnapshot.value?.gameOver?.endedEarly === true,
    );
    // why: the loadout this match launched with, stashed client-side at create
    // (matchSetupSession). Null when the viewer joined a match they did not create
    // or the tab's session cleared — Play Again then hides (only Back to Lobby).
    const stashedConfig = computed<MatchSetupConfig | null>(() => {
      const raw = readMatchSetup(props.matchId);
      return raw !== null ? (raw as MatchSetupConfig) : null;
    });
    // why: the composition is player-count-specific (WP-370), so Play Again MUST
    // reuse the ORIGINAL seat count — derived from the projected seat list, the
    // server-authoritative count of players in this match.
    const seatCount = computed<number>(
      () => endgameSnapshot.value?.players?.length ?? 0,
    );
    // why: Play Again needs an authenticated account (create requires auth,
    // D-24092) AND a stashed loadout AND a valid seat count. A guest or a
    // no-loadout viewer sees only Back to Lobby.
    const canPlayAgain = computed<boolean>(
      () =>
        isGameOver.value &&
        authStore.token !== null &&
        stashedConfig.value !== null &&
        seatCount.value >= 1,
    );

    const isRelaunching = ref(false);
    const playAgainError = ref('');

    /**
     * Relaunches a fresh match with this match's loadout (same composition, same
     * seat count) and drops the player into seat 0. On success
     * launchMatchFromComposition navigates the tab (window.location.search), so
     * this component unmounts; only a failure returns here to surface a message.
     */
    async function playAgain(): Promise<void> {
      const config = stashedConfig.value;
      const authToken = authStore.token;
      if (config === null || authToken === null || isRelaunching.value) {
        return;
      }
      isRelaunching.value = true;
      playAgainError.value = '';
      // why: WP-502 Play Again fix — if THIS match was created with a bot ally
      // (the bot parameters were stashed at create time), rebuild a bot-ally
      // match so the bot seat is filled again; otherwise relaunching via the
      // plain create path would leave the bot's seat empty ("waiting for a
      // friend"). A plain human match has no stash and takes the plain path.
      const botAlly = readBotAllySetup(props.matchId);
      // why: the join seat label is cosmetic; neither the auth store nor the
      // UIState projection carries a display name, so a stable default is used.
      const result =
        botAlly !== null
          ? await launchBotAllyFromComposition({
              config,
              playerCount: seatCount.value,
              botCount: botAlly.botCount,
              policy: botAlly.policy,
              playerName: 'Player',
              authToken,
            })
          : await launchMatchFromComposition({
              config,
              playerCount: seatCount.value,
              playerName: 'Player',
              authToken,
            });
      if (!result.ok) {
        playAgainError.value = result.message;
        isRelaunching.value = false;
      }
    }

    return {
      isMobile,
      viewportRoot,
      matchId: props.matchId,
      villainGroupIds: props.villainGroupIds,
      henchmanGroupIds: props.henchmanGroupIds,
      heroDeckIds: props.heroDeckIds,
      submissionStatus,
      submittedScore,
      submissionMessage,
      isBotAllyStopped,
      botAllyMessage,
      returnToLobby,
      isUpdateAvailable,
      reloadForUpdate,
      isGameOver,
      isEndedEarly,
      canPlayAgain,
      isRelaunching,
      playAgainError,
      playAgain,
    };
  },
});
</script>

<template>
  <div ref="viewportRoot" class="play-viewport">
    <PlayMobile
      v-if="isMobile"
      :submit-move="submitMove"
      :villain-group-ids="villainGroupIds"
      :henchman-group-ids="henchmanGroupIds"
      :hero-deck-ids="heroDeckIds"
      :competitive-score="submittedScore"
    />
    <PlayDesktop
      v-else
      :submit-move="submitMove"
      :match-id="matchId"
      :villain-group-ids="villainGroupIds"
      :henchman-group-ids="henchmanGroupIds"
      :hero-deck-ids="heroDeckIds"
      :competitive-score="submittedScore"
    />
    <DiagnosticExportButton />
    <!--
      // why: WP-363 — mounted ONCE here at the shared viewport root (the same
      // shared-child case as <DiagnosticExportButton>), so the in-match "View
      // loadout in Registry Viewer" link covers BOTH the <PlayMobile> and
      // <PlayDesktop> surfaces. Self-hides when there is no `?match=` (not a
      // live match), so it adds no DOM outside real play.
    -->
    <ViewLoadoutButton />
    <!--
      // why: WP-369 — mounted ONCE here at the shared viewport root (the same
      // shared-child case as <ViewLoadoutButton>), so the pre-match "Waiting for
      // players" panel covers BOTH the <PlayMobile> and <PlayDesktop> surfaces.
      // Supersedes WP-366's always-on corner InviteFriendControl: it renders only
      // while the match has an open seat (polled from the public lobby list) and
      // auto-hides when full. It reads only `?match=` — never G or the UIState
      // projection.
    -->
    <WaitingForPlayersPanel />
    <!--
      // why: WP-258 — mounted ONCE here at the shared viewport root (the
      // Mounting Rule's shared-child case), alongside <DiagnosticExportButton>,
      // so a single fixed-position overlay covers BOTH the <PlayMobile> and
      // <PlayDesktop> production play surfaces (whichever this viewport renders).
      // The panel self-hides (v-if ≥1 record) so it adds no DOM during a clean
      // match.
    -->
    <HollowEffectsPanel />
    <!--
      // why: WP-607 — mounted ONCE here at the shared viewport root (the single
      // 01.5 wiring host), so the collapsible Deck Probability Panel (the plain
      // card counter) covers BOTH the <PlayMobile> and <PlayDesktop> surfaces.
      // Self-hides (v-if hasData) so it adds no DOM when the WP-606 projection
      // fields are absent; presentational only (reads the UIState store, no
      // engine runtime import).
    -->
    <DeckProbabilityPanel />
    <!--
      // why: WP-412 — mounted ONCE here at the shared viewport root (the single
      // 01.5 wiring host), so the fixed-position mute/volume control + the
      // autoplay-unlock arm cover BOTH the <PlayMobile> and <PlayDesktop>
      // surfaces. Self-contained (position: fixed via its own scoped CSS), so no
      // layout prop chain and no second wiring host.
    -->
    <AudioControls />
    <!--
      // why: WP-556 — the single full-bleed VFX overlay, mounted ONCE here at the
      // shared viewport root beside <AudioControls> (the same fixed-overlay
      // precedent), so the combo flash + synergy call-out cover BOTH the
      // <PlayMobile> and <PlayDesktop> surfaces from one host. pointer-events:none
      // + position:fixed via its own scoped CSS, so no layout prop chain and no
      // second wiring host. It renders the useComboVfx signal mounted above.
    -->
    <VfxOverlay />
    <!--
      // why: WP-415 — mounted ONCE here at the shared viewport root (the 01.5
      // wiring host), so the co-op stall banner covers BOTH the <PlayMobile> and
      // <PlayDesktop> surfaces. Self-hides unless the bot ally stopped abnormally
      // (v-if hasStopped inside the component), so it adds no DOM during a healthy
      // match or a normal end. Escape is a client-only Return-to-lobby navigation.
    -->
    <BotAllyStallBanner
      :has-stopped="isBotAllyStopped"
      :message="botAllyMessage"
      :return-to-lobby="returnToLobby"
    />
    <!--
      // why: WP-418 — mounted ONCE here at the shared viewport root (the 01.5
      // wiring host, beside the other banners), so the deploy-refresh notice
      // covers BOTH the <PlayMobile> and <PlayDesktop> surfaces. Self-hides until
      // a newer build is detected (v-if inside the component), so it adds no DOM
      // during a normal session. The reload is user-initiated (never mid-turn
      // auto-reload); a failed version fetch shows nothing (fail-soft).
    -->
    <UpdateAvailableBanner
      :update-available="isUpdateAvailable"
      :refresh="reloadForUpdate"
    />
    <!--
      // why: WP-502 / D-24306 — the post-match action panel, mounted ONCE here at
      // the shared viewport root so "Play Again" (relaunch the same loadout) and
      // "Back to Lobby" cover BOTH the <PlayMobile> and <PlayDesktop> surfaces.
      // Self-hides until the match is over (v-if visible inside the component).
    -->
    <EndgameActions
      :visible="isGameOver"
      :ended-early="isEndedEarly"
      :can-play-again="canPlayAgain"
      :is-relaunching="isRelaunching"
      :error-message="playAgainError"
      :on-play-again="playAgain"
      :on-return-to-lobby="returnToLobby"
    />
    <!--
      // why: WP-339 — a small, non-blocking post-match submission status. Shown
      // only once a submission is in flight or resolved (submissionStatus !== 'idle'),
      // so it never appears during play and never covers the endgame summary. A
      // guest sees the sign-in prompt; a signed-in player sees submitted/already/failed.
    -->
    <div
      v-if="submissionStatus !== 'idle'"
      class="score-submission-status"
      :class="`score-submission-status--${submissionStatus}`"
      role="status"
      data-testid="score-submission-status"
    >
      {{ submissionMessage }}
    </div>
  </div>
</template>

<style scoped>
.play-viewport {
  display: contents;
}

.score-submission-status {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  max-width: min(90vw, 32rem);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background: rgba(20, 20, 28, 0.92);
  color: #f4f4f5;
  font-size: 0.875rem;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.score-submission-status--submitted {
  background: rgba(21, 94, 61, 0.94);
}

.score-submission-status--failed {
  background: rgba(120, 40, 40, 0.94);
}

.score-submission-status--guest {
  background: rgba(60, 52, 20, 0.94);
}

/* why: WP-465 — ineligible is neither success nor error, so it uses a neutral
   blue/slate, deliberately distinct from --submitted (green), --failed (red), and
   --guest (amber) so it never reads as a score being recorded or a failure. */
.score-submission-status--ineligible {
  background: rgba(40, 52, 78, 0.94);
}
</style>
