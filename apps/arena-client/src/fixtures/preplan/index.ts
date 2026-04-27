/**
 * Test fixtures for the pre-plan UI surface.
 *
 * Six named exports:
 *   - `activePrePlanFixture`           — a `PrePlan` in `'active'` state.
 *   - `consumedPrePlanFixture`         — same shape with `status: 'consumed'`.
 *   - `invalidatedPrePlanFixture`      — same shape with `status:
 *     'invalidated'` and a populated `invalidationReason` that omits the
 *     optional `affectedCardExtId`.
 *   - `sampleDisruptionResultFixture`  — `DisruptionPipelineResult` whose
 *     embedded notification omits `affectedCardExtId`.
 *   - `sampleDisruptionResultWithCardFixture` — same shape with the optional
 *     `affectedCardExtId` populated; exercises the conditional render path
 *     in `<PrePlanNotification />`.
 *   - `samplePlayerStateSnapshotFixture` — input snapshot for the lifecycle
 *     adapter tests; consumed by `createPrePlan` (WP-057).
 *
 * All values are string- and number-literal trees with no runtime imports
 * from `@legendary-arena/preplan`. Field names verified against
 * `packages/preplan/src/preplan.types.ts:29-228` and
 * `packages/preplan/src/disruption.types.ts:25-126`.
 *
 * The `+1` relationship between `samplePlayerStateSnapshotFixture.currentTurn`
 * (= 3) and `activePrePlanFixture.appliesToTurn` (= 4) mirrors the
 * `appliesToTurn = snapshot.currentTurn + 1` invariant set in
 * `packages/preplan/src/preplanSandbox.ts:52`. The two fixtures are
 * independent at the test level — `createPrePlan` produces its own output —
 * but their values agree with the production invariant so a future drift in
 * the relationship is visible at fixture-read time.
 */

import type {
  DisruptionPipelineResult,
  PlayerStateSnapshot,
  PrePlan,
} from '@legendary-arena/preplan';

/**
 * `PrePlan` in the `'active'` state. Two plan steps, one revealed card.
 */
export const activePrePlanFixture = {
  prePlanId: 'wp059-active-fixture',
  revision: 1,
  playerId: 'player-0',
  appliesToTurn: 4,
  status: 'active',
  baseStateFingerprint: 'wp059-active-fingerprint',
  sandboxState: {
    hand: ['hero:IRONMAN_01', 'hero:CAPTAIN_AMERICA_01'],
    deck: ['hero:IRONMAN_02', 'hero:CAPTAIN_AMERICA_02'],
    discard: [],
    inPlay: [],
    counters: { attack: 0, recruit: 0 },
  },
  revealLedger: [
    { source: 'player-deck', cardExtId: 'hero:IRONMAN_01', revealIndex: 0 },
  ],
  planSteps: [
    {
      intent: 'playCard',
      targetCardExtId: 'hero:IRONMAN_01',
      description: 'Play Iron Man',
      isValid: true,
    },
    {
      intent: 'recruitHero',
      targetCardExtId: 'hero:CAPTAIN_AMERICA_01',
      description: 'Recruit Cap',
      isValid: true,
    },
  ],
} as const satisfies PrePlan;

/**
 * `PrePlan` in the `'consumed'` state. All other fields agree with
 * `activePrePlanFixture` so that the §B test #4 deep-equal-after-consume
 * assertion holds with both fixtures in the same shape.
 */
export const consumedPrePlanFixture = {
  prePlanId: 'wp059-consumed-fixture',
  revision: 1,
  playerId: 'player-0',
  appliesToTurn: 4,
  status: 'consumed',
  baseStateFingerprint: 'wp059-active-fingerprint',
  sandboxState: {
    hand: ['hero:IRONMAN_01', 'hero:CAPTAIN_AMERICA_01'],
    deck: ['hero:IRONMAN_02', 'hero:CAPTAIN_AMERICA_02'],
    discard: [],
    inPlay: [],
    counters: { attack: 0, recruit: 0 },
  },
  revealLedger: [
    { source: 'player-deck', cardExtId: 'hero:IRONMAN_01', revealIndex: 0 },
  ],
  planSteps: [
    {
      intent: 'playCard',
      targetCardExtId: 'hero:IRONMAN_01',
      description: 'Play Iron Man',
      isValid: true,
    },
    {
      intent: 'recruitHero',
      targetCardExtId: 'hero:CAPTAIN_AMERICA_01',
      description: 'Recruit Cap',
      isValid: true,
    },
  ],
} as const satisfies PrePlan;

/**
 * `PrePlan` in the `'invalidated'` state with a populated
 * `invalidationReason`. The `affectedCardExtId` is omitted to exercise the
 * optional-field-absent path in the §J drift sentinel.
 */
export const invalidatedPrePlanFixture = {
  prePlanId: 'wp059-invalidated-fixture',
  revision: 1,
  playerId: 'player-0',
  appliesToTurn: 4,
  status: 'invalidated',
  baseStateFingerprint: 'wp059-active-fingerprint',
  sandboxState: {
    hand: ['hero:IRONMAN_01', 'hero:CAPTAIN_AMERICA_01'],
    deck: ['hero:IRONMAN_02', 'hero:CAPTAIN_AMERICA_02'],
    discard: [],
    inPlay: [],
    counters: { attack: 0, recruit: 0 },
  },
  revealLedger: [
    { source: 'player-deck', cardExtId: 'hero:IRONMAN_01', revealIndex: 0 },
  ],
  planSteps: [
    {
      intent: 'playCard',
      targetCardExtId: 'hero:IRONMAN_01',
      description: 'Play Iron Man',
      isValid: true,
    },
    {
      intent: 'recruitHero',
      targetCardExtId: 'hero:CAPTAIN_AMERICA_01',
      description: 'Recruit Cap',
      isValid: true,
    },
  ],
  invalidationReason: {
    sourcePlayerId: 'player-1',
    effectType: 'discard',
    effectDescription: 'discards a card from your hand',
  },
} as const satisfies PrePlan;

/**
 * `DisruptionPipelineResult` whose embedded notification omits the
 * optional `affectedCardExtId`. Drives §F test #2 (component renders no
 * `__card` paragraph) and §J's no-card field-set drift sentinel.
 *
 * `invalidatedPlan` is a self-contained literal — deliberately not aliased
 * to `invalidatedPrePlanFixture` so a future refactor of either fixture
 * cannot silently couple the two. The message string mirrors the
 * `Player ${sourcePlayerId}'s ${effectDescription}.` format from
 * `packages/preplan/src/disruptionPipeline.ts:138-144` for the
 * no-affectedCardExtId branch.
 */
export const sampleDisruptionResultFixture = {
  invalidatedPlan: {
    prePlanId: 'wp059-invalidated-fixture',
    revision: 1,
    playerId: 'player-0',
    appliesToTurn: 4,
    status: 'invalidated',
    baseStateFingerprint: 'wp059-active-fingerprint',
    sandboxState: {
      hand: ['hero:IRONMAN_01', 'hero:CAPTAIN_AMERICA_01'],
      deck: ['hero:IRONMAN_02', 'hero:CAPTAIN_AMERICA_02'],
      discard: [],
      inPlay: [],
      counters: { attack: 0, recruit: 0 },
    },
    revealLedger: [
      { source: 'player-deck', cardExtId: 'hero:IRONMAN_01', revealIndex: 0 },
    ],
    planSteps: [
      {
        intent: 'playCard',
        targetCardExtId: 'hero:IRONMAN_01',
        description: 'Play Iron Man',
        isValid: true,
      },
      {
        intent: 'recruitHero',
        targetCardExtId: 'hero:CAPTAIN_AMERICA_01',
        description: 'Recruit Cap',
        isValid: true,
      },
    ],
    invalidationReason: {
      sourcePlayerId: 'player-1',
      effectType: 'discard',
      effectDescription: 'discards a card from your hand',
    },
  },
  sourceRestoration: {
    playerDeckReturns: [],
    sharedSourceReturns: {},
  },
  notification: {
    prePlanId: 'wp059-invalidated-fixture',
    affectedPlayerId: 'player-0',
    sourcePlayerId: 'player-1',
    message: "Player player-1's discards a card from your hand.",
  },
  requiresImmediateNotification: true,
} as const satisfies DisruptionPipelineResult;

/**
 * `DisruptionPipelineResult` whose embedded notification carries the
 * optional `affectedCardExtId`. Drives §F test #3 (component renders the
 * `__card` paragraph) and §J's with-card field-set drift sentinel. The
 * message string mirrors the `Player ${sourcePlayerId}'s ${effectDescription}
 * (${affectedCardExtId}).` format from `disruptionPipeline.ts:138-144` for
 * the affectedCardExtId-present branch.
 */
export const sampleDisruptionResultWithCardFixture = {
  invalidatedPlan: {
    prePlanId: 'wp059-invalidated-fixture',
    revision: 1,
    playerId: 'player-0',
    appliesToTurn: 4,
    status: 'invalidated',
    baseStateFingerprint: 'wp059-active-fingerprint',
    sandboxState: {
      hand: ['hero:IRONMAN_01', 'hero:CAPTAIN_AMERICA_01'],
      deck: ['hero:IRONMAN_02', 'hero:CAPTAIN_AMERICA_02'],
      discard: [],
      inPlay: [],
      counters: { attack: 0, recruit: 0 },
    },
    revealLedger: [
      { source: 'player-deck', cardExtId: 'hero:IRONMAN_01', revealIndex: 0 },
    ],
    planSteps: [
      {
        intent: 'playCard',
        targetCardExtId: 'hero:IRONMAN_01',
        description: 'Play Iron Man',
        isValid: true,
      },
      {
        intent: 'recruitHero',
        targetCardExtId: 'hero:CAPTAIN_AMERICA_01',
        description: 'Recruit Cap',
        isValid: true,
      },
    ],
    invalidationReason: {
      sourcePlayerId: 'player-1',
      effectType: 'discard',
      effectDescription: 'discards a card from your hand',
      affectedCardExtId: 'hero:IRONMAN_01',
    },
  },
  sourceRestoration: {
    playerDeckReturns: [],
    sharedSourceReturns: {},
  },
  notification: {
    prePlanId: 'wp059-invalidated-fixture',
    affectedPlayerId: 'player-0',
    sourcePlayerId: 'player-1',
    message: "Player player-1's discards a card from your hand (hero:IRONMAN_01).",
    affectedCardExtId: 'hero:IRONMAN_01',
  },
  requiresImmediateNotification: true,
} as const satisfies DisruptionPipelineResult;

/**
 * `PlayerStateSnapshot` consumed by the lifecycle adapter test
 * (`startPrePlanForActiveViewer`). Six fields per
 * `packages/preplan/src/preplanSandbox.ts:14-21` — the snapshot type does
 * not include `inPlay` (that field exists only on the resulting
 * `PrePlan.sandboxState`).
 */
export const samplePlayerStateSnapshotFixture = {
  playerId: 'player-0',
  hand: ['hero:IRONMAN_01', 'hero:CAPTAIN_AMERICA_01'],
  deck: ['hero:IRONMAN_02', 'hero:CAPTAIN_AMERICA_02'],
  discard: [],
  counters: { attack: 0, recruit: 0 },
  currentTurn: 3,
} as const satisfies PlayerStateSnapshot;
