/**
 * useOperatorEligibility — Arena Client (WP-804 / EC-841 / D-24689 §6).
 *
 * Whether the signed-in account may use the operator tools, from the
 * `admin-session-required` eligibility route. The client has no `isAdmin`; a
 * 200 from that route is the only admin signal. The answer only shows or hides
 * operator UI — every operator route is gated server-side (D-15902).
 *
 * The probe runs only while the caller enables it and a token exists, re-runs
 * when either changes, and resets to `false` when either goes away. A
 * generation counter drops a response that lands after a newer probe or a
 * reset, so a late 200 can never turn `isOperator` back on.
 */

import { ref, watch, type Ref } from 'vue';

import { useAuthStore } from '../stores/auth';
import { fetchOperatorEligibility } from '../lib/api/operatorMatchApi';

/** The reactive eligibility answer. */
export interface OperatorEligibilityState {
  /** `true` only after the eligibility route answered 200 `{ isOperator: true }`. */
  readonly isOperator: Ref<boolean>;
}

/**
 * Probe operator eligibility while `isEnabled` is true and a token exists.
 *
 * @param isEnabled Whether this surface wants the answer at all. The lobby
 *   passes `ref(true)`; the play surface passes "this is an operator match".
 * @returns `{ isOperator }`.
 */
export function useOperatorEligibility(isEnabled: Ref<boolean>): OperatorEligibilityState {
  const authStore = useAuthStore();
  const isOperator = ref(false);
  // why: every probe start and every reset bumps the generation; a response
  // from an older generation is dropped, so a 200 landing after a reset (token
  // cleared, surface disabled) or after a newer probe cannot set the flag.
  let generation = 0;

  /**
   * Run one probe for the current generation and apply its answer if it is
   * still current.
   *
   * @param token The bearer token to probe with.
   */
  async function probe(token: string): Promise<void> {
    generation += 1;
    const probeGeneration = generation;
    // why: a new token can belong to a different account, so the previous
    // answer is not carried over while the new probe is in flight.
    isOperator.value = false;
    const answer = await fetchOperatorEligibility(token);
    if (probeGeneration !== generation) {
      return;
    }
    isOperator.value = answer;
  }

  watch(
    [() => isEnabled.value, () => authStore.token],
    ([enabled, token]) => {
      if (enabled !== true || token === null) {
        generation += 1;
        isOperator.value = false;
        return;
      }
      void probe(token);
    },
    { immediate: true },
  );

  return { isOperator };
}
