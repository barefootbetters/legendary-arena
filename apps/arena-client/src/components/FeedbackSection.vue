<script lang="ts">
import { computed, defineComponent, ref, type PropType } from 'vue';

import {
  validateFeedbackDraft,
  submitFeedback,
  FEEDBACK_TITLE_MAX_LENGTH,
  FEEDBACK_DESCRIPTION_MAX_LENGTH,
  type FeedbackType,
  type FeedbackApiErrorCode,
} from '../lib/api/feedbackApi';

// why: this is the player's intake surface for the D-24414 feedback system —
// the "front door" that posts to the WP-604 POST /api/feedback. It writes one
// item and shows a receipt; it never lists submissions or shows status, because
// the dashboard is the sole status writer (D-24416). It sends text only — no
// diagnostics payload or attachment, as the API has no field for one (D-24721).
//
// why: defineComponent({ setup() { return {...} } }) is required (NOT
// <script setup>) per D-6512 — the @legendary-arena/vue-sfc-loader
// separate-compile pipeline only reaches `_ctx` through setup()'s return.

/** The locked copy shown after a successful submit, for every kind. */
const SUCCESS_COPY = 'Thanks — we received your feedback.';

/** The locked copy for an over-long / empty title (client or server). */
const TITLE_LIMIT_COPY = 'Your title needs to be between 1 and 200 characters.';

/** The locked copy for an over-long / empty description (client or server). */
const DESCRIPTION_LIMIT_COPY =
  'Your description needs to be between 1 and 5000 characters.';

/** The locked copy for a 401 — the session expired or is missing. */
const SIGN_IN_AGAIN_COPY = 'Please sign in again.';

/** The locked copy for any other failure (500, unknown code, network). */
const GENERIC_FAILURE_COPY =
  'Your feedback could not be sent. Please try again.';

/**
 * Map a submit failure to its locked full-sentence copy. A 401 is keyed by HTTP
 * status (its session-validation code is outside the submit set); the two
 * field-limit codes map to their own lines; everything else — any 500, any
 * unrecognized code, `invalid_type`, `invalid_request`, and a network failure
 * (status 0) — falls through to the generic line. Never returns a raw code.
 *
 * @param status The HTTP status from the submit result.
 * @param code The narrowed submit error code, or null.
 * @returns The full-sentence message to show.
 */
function failureMessage(
  status: number,
  code: FeedbackApiErrorCode | null,
): string {
  if (status === 401) {
    return SIGN_IN_AGAIN_COPY;
  }
  if (code === 'invalid_title') {
    return TITLE_LIMIT_COPY;
  }
  if (code === 'invalid_description') {
    return DESCRIPTION_LIMIT_COPY;
  }
  return GENERIC_FAILURE_COPY;
}

export default defineComponent({
  name: 'FeedbackSection',
  props: {
    authToken: {
      type: [String, null] as unknown as PropType<string | null>,
      required: true,
    },
  },
  setup(props) {
    // why: default kind is 'enhancement' (Feature idea) — the kind with a
    // public surface, so the privacy helper and roadmap copy are visible by
    // default and guide the most common submission (EC-850 §Locked Values).
    const feedbackType = ref<FeedbackType>('enhancement');
    const title = ref<string>('');
    const description = ref<string>('');
    const isSubmitting = ref<boolean>(false);
    const errorMessage = ref<string>('');
    // why: the kind that was submitted, captured BEFORE the post-success reset,
    // so the success copy (and its roadmap sentence) reflects what was sent even
    // after the kind control resets to 'enhancement'. Null means "no success
    // showing".
    const submittedType = ref<FeedbackType | null>(null);

    const isSignedOut = computed<boolean>(() => props.authToken === null);

    const titleRemaining = computed<number>(
      () => FEEDBACK_TITLE_MAX_LENGTH - title.value.length,
    );
    const descriptionRemaining = computed<number>(
      () => FEEDBACK_DESCRIPTION_MAX_LENGTH - description.value.length,
    );

    const showPrivacyHelper = computed<boolean>(
      () => feedbackType.value === 'enhancement',
    );
    const showRoadmapSentence = computed<boolean>(
      () => submittedType.value === 'enhancement',
    );

    const draftIsValid = computed<boolean>(
      () =>
        validateFeedbackDraft({
          type: feedbackType.value,
          title: title.value,
          description: description.value,
        }).ok,
    );
    const canSubmit = computed<boolean>(
      () => isSubmitting.value === false && draftIsValid.value === true,
    );

    /**
     * Hide the success message when the player edits any field after a
     * success. Wired to the fields' user `@input` / `@change` handlers, never a
     * `watch`: the post-success reset writes the refs programmatically, which
     * fires no input event, so the success message survives the reset (EC-850
     * §Locked Values).
     */
    function onFieldEdit(): void {
      submittedType.value = null;
    }

    /**
     * Validate the draft, then post it. Clears any prior message first. On an
     * invalid draft (a disabled-button bypass), shows the field-limit copy. On
     * success, records the submitted kind for the receipt and resets the form.
     * On failure, shows the locked copy for the outcome and keeps the typed
     * text.
     */
    async function onSubmit(): Promise<void> {
      errorMessage.value = '';
      submittedType.value = null;

      const token = props.authToken;
      if (token === null) {
        return;
      }

      const validation = validateFeedbackDraft({
        type: feedbackType.value,
        title: title.value,
        description: description.value,
      });
      if (validation.ok === false) {
        errorMessage.value =
          validation.field === 'title' ? TITLE_LIMIT_COPY : DESCRIPTION_LIMIT_COPY;
        return;
      }

      const sentType = validation.value.type;
      isSubmitting.value = true;
      const result = await submitFeedback(token, validation.value);
      isSubmitting.value = false;

      if (result.ok === true) {
        submittedType.value = sentType;
        // why: reset to the default so the next submission starts clean; the
        // success message persists because these programmatic writes fire no
        // input event (see onFieldEdit).
        feedbackType.value = 'enhancement';
        title.value = '';
        description.value = '';
        return;
      }

      errorMessage.value = failureMessage(result.status, result.code);
    }

    return {
      feedbackType,
      title,
      description,
      isSubmitting,
      errorMessage,
      submittedType,
      isSignedOut,
      titleRemaining,
      descriptionRemaining,
      showPrivacyHelper,
      showRoadmapSentence,
      canSubmit,
      onFieldEdit,
      onSubmit,
      successCopy: SUCCESS_COPY,
    };
  },
});
</script>

<template>
  <section id="send-feedback" class="feedback-section" data-testid="feedback-section">
    <h2>Send feedback</h2>

    <p v-if="isSignedOut" class="feedback-signed-out" data-testid="feedback-signed-out">
      Sign in to send feedback.
    </p>

    <template v-else>
      <p class="feedback-help">
        Spotted a bug, have an idea, or want to leave a review? Send it here.
      </p>

      <label class="feedback-field">
        <span class="feedback-label">Kind</span>
        <select
          v-model="feedbackType"
          class="feedback-kind"
          data-testid="feedback-kind"
          @change="onFieldEdit"
        >
          <option value="bug">Bug report</option>
          <option value="enhancement">Feature idea</option>
          <option value="review">Review</option>
        </select>
      </label>

      <label class="feedback-field">
        <span class="feedback-label">Title</span>
        <input
          v-model="title"
          type="text"
          maxlength="200"
          class="feedback-title"
          data-testid="feedback-title"
          @input="onFieldEdit"
        />
        <span class="feedback-counter" data-testid="feedback-title-remaining">
          {{ titleRemaining }} characters left
        </span>
      </label>

      <label class="feedback-field">
        <span class="feedback-label">Description</span>
        <textarea
          v-model="description"
          maxlength="5000"
          rows="5"
          class="feedback-description"
          data-testid="feedback-description"
          @input="onFieldEdit"
        ></textarea>
        <span class="feedback-counter" data-testid="feedback-description-remaining">
          {{ descriptionRemaining }} characters left
        </span>
      </label>

      <p
        v-if="showPrivacyHelper"
        class="feedback-privacy"
        data-testid="feedback-privacy"
      >
        If we plan this idea, its title and description appear on the public
        roadmap without your name. Don't include personal details.
      </p>

      <button
        type="button"
        class="feedback-submit"
        data-testid="feedback-submit"
        :disabled="!canSubmit"
        @click="onSubmit"
      >
        Send feedback
      </button>

      <p
        v-if="submittedType !== null"
        class="feedback-success"
        data-testid="feedback-success"
      >
        {{ successCopy }}
        <template v-if="showRoadmapSentence">
          Feature ideas we plan to build appear on the
          <a href="https://www.legendary-arena.com/roadmap/">public roadmap</a>.
        </template>
      </p>

      <p
        v-if="errorMessage !== ''"
        class="feedback-error"
        data-testid="feedback-error"
      >
        {{ errorMessage }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.feedback-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feedback-section h2 {
  font-size: 1.125rem;
  margin: 0 0 0.25rem 0;
}

.feedback-help {
  font-size: 0.875rem;
  opacity: 0.75;
  margin: 0;
}

.feedback-signed-out {
  font-size: 0.875rem;
  opacity: 0.75;
  margin: 0;
}

.feedback-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.feedback-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.feedback-kind,
.feedback-title,
.feedback-description {
  font: inherit;
  padding: 0.5rem;
}

.feedback-description {
  resize: vertical;
}

.feedback-counter {
  font-size: 0.8rem;
  opacity: 0.65;
}

.feedback-privacy {
  font-size: 0.8rem;
  opacity: 0.8;
  margin: 0;
}

.feedback-submit {
  align-self: flex-start;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.feedback-submit:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.feedback-success {
  font-size: 0.875rem;
  color: #1b5e20;
  margin: 0;
}

.feedback-error {
  font-size: 0.875rem;
  color: #b3261e;
  margin: 0;
}
</style>
