<script lang="ts">
import { computed, defineComponent, ref, toRef, type PropType } from 'vue';

import PlayDesktop from './PlayDesktop.vue';
import PlayMobile from './PlayMobile.vue';
import DiagnosticExportButton from '../components/DiagnosticExportButton.vue';
import ViewLoadoutButton from '../components/ViewLoadoutButton.vue';
import WaitingForPlayersPanel from '../components/WaitingForPlayersPanel.vue';
import HollowEffectsPanel from '../components/play/HollowEffectsPanel.vue';
import { useViewport } from '../composables/useViewport';
import { useSkinApplier } from '../composables/useSkinApplier';
import { useCompetitiveSubmitOnGameover } from '../composables/useCompetitiveSubmitOnGameover';
import { useCardImagePrefetch } from '../composables/useCardImagePrefetch';
import type { SubmitMove } from '../components/play/uiMoveName.types';

// why: WP-339 — the user-facing message for each post-match submission status.
// Mounted once here at the shared viewport root (which holds matchId, D-16501), so
// a single submit covers both the <PlayDesktop> and <PlayMobile> surfaces.
const SUBMISSION_MESSAGES: Record<string, string> = {
  submitting: 'Submitting your score…',
  submitted: 'Score submitted to the leaderboard.',
  already: 'Your score for this match was already submitted.',
  guest: 'Sign in to submit your score to the leaderboard.',
  failed: 'Couldn’t submit your score. It may still be counted shortly.',
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
  components: { PlayDesktop, PlayMobile, DiagnosticExportButton, ViewLoadoutButton, WaitingForPlayersPanel, HollowEffectsPanel },
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

    // why: WP-339 — on gameover, submit this match's competitive score once (for
    // an authenticated player). toRef keeps matchId reactive so the composable
    // re-arms if a new live match reuses this viewport instance.
    const { submissionStatus } = useCompetitiveSubmitOnGameover(
      toRef(props, 'matchId'),
    );
    const submissionMessage = computed<string>(
      () => SUBMISSION_MESSAGES[submissionStatus.value] ?? '',
    );

    return {
      isMobile,
      viewportRoot,
      matchId: props.matchId,
      villainGroupIds: props.villainGroupIds,
      henchmanGroupIds: props.henchmanGroupIds,
      heroDeckIds: props.heroDeckIds,
      submissionStatus,
      submissionMessage,
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
    />
    <PlayDesktop
      v-else
      :submit-move="submitMove"
      :match-id="matchId"
      :villain-group-ids="villainGroupIds"
      :henchman-group-ids="henchmanGroupIds"
      :hero-deck-ids="heroDeckIds"
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
</style>
