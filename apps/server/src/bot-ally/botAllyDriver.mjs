/**
 * BotAllyDriver — per-match server-side driver for a mixed human + bot
 * cooperative match (WP-375 / EC-404).
 *
 * A signed-in human plays seat "0"; the remaining seats "1"…"botCount" are
 * reserved, auto-readied, and driven by this driver. It narrows the WP-163
 * autoplay lifecycle (`autoplay.mjs`) to the bot seats of a match that also
 * has a real human: it polls the authoritative match state, and ONLY when it
 * is a bot seat's turn does it submit that seat's moves. The human's seat 0 is
 * never driven here — the human drives it over Socket.IO.
 *
 * This module holds the ORCHESTRATION only (turn-gating, forced-choice drain,
 * fault fallback, teardown, the poll loop) plus the pure bot-decision pipeline
 * (`decideBotMove`). The boardgame.io `Master` move submission, the loopback
 * create/join, and the side-table persistence live in `botAllyRoutes.mjs` and
 * are injected as `deps`, so this file imports no `boardgame.io` and no `pg`
 * and stays unit-testable without a running server or database. It imports the
 * engine ONLY through the barrel helpers autoplay already uses (server layer:
 * server wires, engine decides).
 *
 * Authority: WP-375; EC-404; DESIGN-SOLO-BOT-ALLY §3/§4b/§7; D-24170 (this
 * packet's decisions: poll turn-detection, boot re-registration, side-table
 * metadata); D-24120 (bots have no `match_seat_accounts` row); D-3604 (the bot
 * decision seed is NOT the match shuffle seed); D-16308 (registry-leak teardown
 * discipline); D-24037 / WP-261 (public-safe fault copy).
 */

import {
  getLegalMoves,
  buildUIState,
  filterUIStateForAudience,
  createRandomPolicy,
  createCompetentHeuristicPolicy,
} from '@legendary-arena/game-engine';
import { findPendingChoiceMove } from '../autoplay/botLoopProgress.mjs';

/**
 * Per-match bot-ally drivers, keyed by match id. A driver is registered while
 * it runs and removed on EVERY exit path (terminal / abandon / maxTurns /
 * fault).
 *
 * // why: D-16308 — this map is Class-1 runtime state (mirrors autoplay's
 * `autoplayControllers`); it lives only in this in-process map and is never
 * persisted to any store. The durable `botSeats` tag lives in the
 * `legendary.match_bot_ally` side-table, written by the routes layer.
 */
export const botAllyDrivers = new Map();

/**
 * Stops every registered bot-ally driver: clears each poll timer and
 * de-registers it from {@link botAllyDrivers}. Called from the server's SIGTERM
 * handler (index.mjs) so a graceful shutdown stops THIS process from driving any
 * bot seat.
 *
 * // why: WP-424 / D-24244 — a Render rolling deploy boots the NEW instance
 * (which revives these matches via `rehydrateBotAllyDrivers` and immediately
 * starts driving them) BEFORE it SIGTERMs the OLD one; the old SIGTERM handler
 * then blocks in `httpServer.close` draining the human's long-lived Socket.IO
 * connection, so WITHOUT this call the old instance's drivers keep polling and
 * submitting the bot's moves for the entire termination-grace window. Two
 * instances driving the same bot seat race on boardgame.io's `_stateID`
 * (observed `invalid stateID, was=[N], expected=[N+1]` on `fightVillain`), the
 * bot's fight never lands, and the co-op match freezes with `driving:true` — so
 * the WP-419 stall banner (which needs `driving:false`) never fires and the human
 * sees a silent freeze. Stopping the drivers here ends the old instance's
 * participation the moment SIGTERM arrives; WP-420's `shutdown_interrupted` mark
 * (written just before this call) still lets the new instance revive them.
 * Snapshots the values first because `driver.stop()` deletes from the map as it
 * runs.
 */
export function stopAllBotAllyDrivers() {
  const drivers = [...botAllyDrivers.values()];
  for (const driver of drivers) {
    driver.stop();
  }
}

/**
 * Poll interval (milliseconds) at which the driver re-fetches the match state
 * to detect whose turn it is.
 *
 * // why: D-24170 — v1 uses polling (the proven autoplay idiom: easy to reason
 * about, trivial to tear down) rather than a bgio post-update subscription that
 * would couple to framework internals. 250ms is responsive for a turn-based
 * co-op game without meaningful idle cost at current match volume.
 */
export const BOT_POLL_INTERVAL_MS = 250;

/**
 * Match-lifetime cap on the number of bot turns a single driver will take
 * before tearing itself down. Mirrors autoplay's `maxTurns = 400`.
 *
 * // why: a degenerate match that never reaches a terminal state must not let
 * the driver run forever; 400 is far above any realistic co-op game length.
 */
export const BOT_MAX_TURNS = 400;

/**
 * Upper bound on move-steps the driver will dispatch within a SINGLE bot turn
 * before treating the turn as wedged and falling through to the fault path.
 *
 * // why: a bot turn is a bounded sequence (reveal, ≤hand-size card plays, a
 * few spends, stage advances, endTurn). 100 is generous headroom; the cap
 * bounds a within-turn spin so `BOT_MAX_TURNS` (which counts whole turns)
 * cannot be out-waited by a single stuck turn — the ~10-minute freeze class
 * D-24038 fixed for autoplay.
 */
export const BOT_MAX_MOVE_STEPS_PER_TURN = 100;

/**
 * How many times the driver re-submits the SAME move when it does not advance the
 * state, and the base back-off between attempts, before treating the move as a
 * genuine wedge and falling through to the fault fallback.
 *
 * // why: 2026-07-24 — a move that does not advance is EITHER a transient DB blip
 * (the bgio store's `runResilientWrite` swallowed the write to keep the server up,
 * so the move genuinely did not apply — a swallowed write is safe to re-submit,
 * it cannot double-apply) OR a real wedge (the engine silently rejected the move).
 * Re-submitting with back-off lets a blip clear (the re-submit lands once the DB
 * recovers) so a brief DB hiccup during the bot's turn no longer FAULTS the whole
 * match — observed when a DB plan resize restarted Postgres mid-turn. A genuine
 * reject never advances across the budget and still falls through to the fault
 * fallback. 3 attempts × (500ms, 1000ms) back-off, each submit itself riding the
 * store's ~1.8s write-retry, spans several seconds — enough for a normal blip
 * without masking a real wedge.
 */
export const BOT_MOVE_SUBMIT_ATTEMPTS = 3;
export const BOT_MOVE_RETRY_BASE_MS = 500;

/**
 * Waits the given milliseconds. Server-layer scheduling only (the determinism
 * rules govern the engine, not the driver) — mirrors autoplay's `delay`.
 *
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Consecutive no-progress poll ticks (the match state id is unchanged while it
 * is NOT a bot seat's turn) after which the driver treats the match as
 * abandoned by the human and tears down.
 *
 * // why: DESIGN §7 — a human who disconnects/abandons must not leave the
 * driver polling forever. Without a real presence signal, a stalled-progress
 * bound is the proxy: 4800 ticks × 250ms ≈ 20 minutes of no progress on the
 * human's turn. It resets on any state change, so a human who is merely
 * thinking (and eventually moves) is never torn down. Counting poll ticks
 * rather than reading a wall clock keeps the driver deterministic and
 * clock-free.
 */
export const BOT_MAX_IDLE_POLLS = 4800;

/**
 * How many CONSECUTIVE empty `fetchState` results the driver tolerates before it
 * treats the match as genuinely gone and tears down. Reset to 0 on any non-empty
 * fetch.
 *
 * // why: WP-426 / D-24247 — an empty fetch is AMBIGUOUS. The bgio store's
 * `resilientFetch` returns EMPTY (not a throw) once it exhausts its ~1.8s retry
 * budget against an unreachable Postgres — a Render DB restart / instability
 * (observed `ECONNREFUSED …:5432` right after a deploy) — which is
 * INDISTINGUISHABLE here from a genuinely reaped match. Treating the FIRST empty
 * as "vanished → teardown completed" killed the driver on a transient DB blip
 * (and the teardown's own status write then also failed against the same dead DB,
 * leaving the row `active` with no driver — a silent freeze the human sees as a
 * frozen board; observed match `nZn_U4QO-hr`). Tolerating a bounded run of
 * empties lets a DB restart recover with the driver still registered; only a
 * match that STAYS empty past this window is treated as truly gone. Each empty
 * tick already carries the store's own ~1.8s retry, so ~90 consecutive empties
 * spans several minutes — comfortably longer than a deploy-coupled DB restart,
 * while still bounding a genuinely-vanished match (rare for a live driver: a
 * gameover / idle-abandon teardown fires first, and the reaper never deletes a
 * live match). Counting poll ticks (not a wall clock) keeps the driver
 * clock-free.
 */
export const BOT_MAX_EMPTY_FETCH_POLLS = 90;

/**
 * The public-safe, co-op-framed sentence surfaced when the bot ally cannot
 * continue its turn. Persisted as the match's `fault_message`.
 *
 * // why: WP-261 / D-24037 — this string may reach a player surface, so it must
 * never carry a raw exception, stack, database error, secret, internal id, or
 * path. §23(b) co-op framing: the bot is an ally, never an opponent.
 */
export const BOT_FAULTED_MESSAGE =
  'The bot ally could not finish its turn, so the match was stopped. ' +
  'You can start a new match with a bot ally.';

/**
 * The closed set of terminal statuses a driver persists to the side-table when
 * it tears down. `active` is the creation status; these are the exit statuses.
 */
export const BOT_ALLY_STATUS = Object.freeze({
  active: 'active',
  completed: 'completed',
  faulted: 'faulted',
  abandoned: 'abandoned',
  exhausted: 'exhausted',
});

/**
 * Builds the minimal lifecycle context the engine's `getLegalMoves` /
 * `buildUIState` need from a fetched match state.
 *
 * @param {object} state - The fetched boardgame.io match state.
 * @returns {{ phase: string, turn: number, currentPlayer: string, numPlayers: number }}
 */
function lifecycleContextFor(state) {
  return {
    phase: state.ctx.phase,
    turn: state.ctx.turn,
    currentPlayer: state.ctx.currentPlayer,
    numPlayers: state.ctx.numPlayers,
  };
}

/**
 * Constructs the bot policy for a decision seed.
 *
 * // why: D-3604 — the decision seed is the bot's OWN tie-break seed; it is NOT
 * the match shuffle seed (owned by boardgame.io). The policy consumes only the
 * audience-filtered view, never raw `G`.
 *
 * @param {string} decisionSeed - The per-match bot decision seed.
 * @param {'competent' | 'random'} policyName - Which policy to build.
 * @returns {object} An AIPolicy with a `decideTurn(view, legalMoves)` method.
 */
export function buildBotPolicy(decisionSeed, policyName) {
  return policyName === 'random'
    ? createRandomPolicy(decisionSeed)
    : createCompetentHeuristicPolicy(decisionSeed);
}

/**
 * Decides the single move a bot seat should submit for the current state.
 *
 * Pure and deterministic given `(state, botSeat, policy)`: a parked forced
 * choice is drained first with its engine-supplied deterministic default; every
 * other decision asks the policy over the audience-filtered view. The policy
 * NEVER receives raw `G` — only the seat-filtered `UIState` — preserving
 * hidden-information discipline.
 *
 * @param {object} state - The fetched match state (`{ G, ctx, _stateID }`).
 * @param {string} botSeat - The bot seat id (e.g. `"1"`).
 * @param {object} policy - The AIPolicy built by {@link buildBotPolicy}.
 * @returns {{ name: string, args: unknown }} The move to submit.
 */
export function decideBotMove(state, botSeat, policy) {
  const lifecycleContext = lifecycleContextFor(state);
  const legalMoves = getLegalMoves(state.G, lifecycleContext);

  // why: forced-choice drain — when the engine parks a KO-a-Hero /
  // optional-KO-reward choice on this seat, getLegalMoves short-circuits to the
  // single resolve move (deterministic default args already filled). Dispatch
  // it directly so a bot-owned parked choice never freezes the match. The other
  // resolve short-circuits (victory-pile / draw-or-empowered / return-zero-cost)
  // are also singletons, so the policy path below returns them unchanged.
  const pendingChoice = findPendingChoiceMove(legalMoves);
  if (pendingChoice !== null) {
    return { name: pendingChoice.name, args: pendingChoice.args };
  }

  const fullUIState = buildUIState(state.G, {
    phase: lifecycleContext.phase,
    turn: lifecycleContext.turn,
    currentPlayer: botSeat,
  });
  // why: hidden-info discipline — the policy sees only what the bot seat may
  // legitimately see, exactly as autoplay and the offline runner do.
  const filteredView = filterUIStateForAudience(fullUIState, {
    kind: 'player',
    playerId: botSeat,
  });
  const intent = policy.decideTurn(filteredView, legalMoves);
  return { name: intent.move.name, args: intent.move.args };
}

/**
 * Reports whether it is currently a bot seat's turn in the fetched state — the
 * ONLY condition under which the driver may act.
 *
 * @param {object} state - The fetched match state.
 * @param {ReadonlyArray<string>} botSeats - The bot seat ids for this match.
 * @returns {boolean} true only when the play phase is active AND the current
 *   player is one of the bot seats.
 */
export function isBotSeatTurn(state, botSeats) {
  if (state.ctx.gameover !== undefined) {
    return false;
  }
  if (state.ctx.phase !== 'play') {
    return false;
  }
  return botSeats.includes(state.ctx.currentPlayer);
}

/**
 * Creates and registers a per-match bot-ally driver.
 *
 * The driver polls the match state and drives the bot seats' turns. All
 * framework-touching work (state fetch, move submission, side-table status
 * persistence, and the concrete move decision) is injected via `deps` so this
 * factory imports no `boardgame.io` and no `pg`.
 *
 * @param {object} params
 * @param {string} params.matchId - The match id this driver owns.
 * @param {ReadonlyArray<string>} params.botSeats - The bot seat ids ("1"…).
 * @param {object} params.deps - Injected capabilities.
 * @param {(matchId: string) => Promise<object | null>} params.deps.fetchState -
 *   Fetches the authoritative match state, or null when the match is gone.
 * @param {(move: { seat: string, moveName: string, moveArgs: unknown }) => Promise<unknown>} params.deps.submitMove -
 *   Submits one move for a bot seat via the boardgame.io Master.
 * @param {(matchId: string, status: string, faultMessage?: string) => Promise<void>} params.deps.persistStatus -
 *   Updates the side-table status (and fault message) on teardown.
 * @param {(state: object, botSeat: string) => ({ name: string, args: unknown } | null)} params.deps.decide -
 *   Decides the move for a bot seat's current state (production: decideBotMove
 *   closed over the match policy).
 * @param {(matchId: string) => Promise<void>} [params.deps.resetRevivalCount] -
 *   Resets the side-table `revive_count` to 0. Called once, after this driver
 *   completes its first bot turn, ONLY when the match was revived with a nonzero
 *   count (see `initialReviveCount`). Optional — omitted by tests that do not
 *   exercise the reset.
 * @param {number} [params.deps.maxTurns] - Override for BOT_MAX_TURNS (tests).
 * @param {number} [params.deps.maxIdlePolls] - Override for BOT_MAX_IDLE_POLLS.
 * @param {number} [params.deps.maxMoveStepsPerTurn] - Override for the per-turn step cap.
 * @param {number} [params.deps.maxEmptyFetchPolls] - Override for BOT_MAX_EMPTY_FETCH_POLLS.
 * @param {number} [params.deps.pollIntervalMs] - Override for BOT_POLL_INTERVAL_MS.
 * @param {boolean} [params.deps.autoStart=true] - Start the poll immediately
 *   (tests pass false and call `tick()` directly).
 * @param {number} [params.initialReviveCount=0] - The side-table `revive_count`
 *   this driver was (re-)registered with. When > 0 (a revived match), the driver
 *   resets it to 0 after its first successful bot turn — proving the match is
 *   still drivable so past revivals do not count toward the D-24230 lifetime cap
 *   (WP-414 / D-24233). A fresh create passes 0 and never writes the reset.
 * @returns {object} The driver ({ tick, start, stop, matchId, botSeats, getTurnCount, getStatus }).
 */
export function createBotAllyDriver({ matchId, botSeats, deps, initialReviveCount }) {
  const maxTurns = deps.maxTurns ?? BOT_MAX_TURNS;
  const maxIdlePolls = deps.maxIdlePolls ?? BOT_MAX_IDLE_POLLS;
  const maxMoveStepsPerTurn = deps.maxMoveStepsPerTurn ?? BOT_MAX_MOVE_STEPS_PER_TURN;
  const maxEmptyFetchPolls = deps.maxEmptyFetchPolls ?? BOT_MAX_EMPTY_FETCH_POLLS;
  const pollIntervalMs = deps.pollIntervalMs ?? BOT_POLL_INTERVAL_MS;

  const driver = {
    matchId,
    botSeats,
    status: BOT_ALLY_STATUS.active,
    turnCount: 0,
    idlePolls: 0,
    // why: WP-426 — consecutive empty-`fetchState` count; a bounded run is
    // tolerated as a transient DB outage before the match is treated as gone.
    emptyFetchPolls: 0,
    lastStateId: null,
    stopped: false,
    tickInProgress: false,
    timer: null,
    // why: WP-414 / D-24233 — the revival count this driver started with, and a
    // one-shot latch so the reset-on-first-successful-turn fires at most once per
    // driver lifetime (no per-turn write).
    initialReviveCount: initialReviveCount ?? 0,
    revivalReset: false,
    getTurnCount() {
      return driver.turnCount;
    },
    getStatus() {
      return driver.status;
    },
    start() {
      scheduleNextTick(driver, pollIntervalMs);
    },
    stop() {
      // why: D-16308 — synchronous stop path used by external teardown (server
      // shutdown / human leave); clears the timer and de-registers. The status
      // write is the caller's concern here (this path takes no status arg).
      driver.stopped = true;
      if (driver.timer !== null) {
        clearTimeout(driver.timer);
        driver.timer = null;
      }
      botAllyDrivers.delete(matchId);
    },
    async tick() {
      await runTick(driver, deps, { maxTurns, maxIdlePolls, maxMoveStepsPerTurn, maxEmptyFetchPolls });
    },
  };

  botAllyDrivers.set(matchId, driver);
  if (deps.autoStart !== false) {
    driver.start();
  }
  return driver;
}

/**
 * Schedules the next poll tick and re-arms itself until the driver stops.
 *
 * @param {object} driver - The driver object.
 * @param {number} pollIntervalMs - The poll interval.
 */
function scheduleNextTick(driver, pollIntervalMs) {
  if (driver.stopped) {
    return;
  }
  driver.timer = setTimeout(async () => {
    driver.timer = null;
    // why: guard against overlapping ticks — a slow tick (several awaited
    // fetches/dispatches) must not be re-entered by the next scheduled tick.
    if (!driver.tickInProgress) {
      driver.tickInProgress = true;
      try {
        await driver.tick();
      } catch (tickError) {
        // why: a poll tick must never throw out of the timer callback (an
        // unhandled rejection would crash the process). The raw fault stays in
        // the server log; the driver keeps polling and self-heals on the next
        // tick or tears down via its own fault path.
        console.error(
          `[bot-ally] match ${driver.matchId} poll tick failed unexpectedly: ${tickError.message}`,
        );
      } finally {
        driver.tickInProgress = false;
      }
    }
    scheduleNextTick(driver, pollIntervalMs);
  }, pollIntervalMs);
}

/**
 * Tears a driver down on an exit path: marks it stopped, clears the poll,
 * removes it from the registry, and persists the terminal status.
 *
 * @param {object} driver - The driver object.
 * @param {object} deps - The injected capabilities (for persistStatus).
 * @param {string} status - The terminal status (BOT_ALLY_STATUS.*).
 * @param {string} [faultMessage] - The public-safe fault message, when faulted.
 * @returns {Promise<void>}
 */
async function teardown(driver, deps, status, faultMessage) {
  if (driver.stopped) {
    return;
  }
  // why: D-16308 leak discipline — de-register and clear the poll on EVERY exit
  // path (terminal / abandon / maxTurns / fault) before anything can throw, so
  // the in-memory map never accumulates dead drivers across matches.
  driver.stopped = true;
  driver.status = status;
  if (driver.timer !== null) {
    clearTimeout(driver.timer);
    driver.timer = null;
  }
  botAllyDrivers.delete(driver.matchId);

  try {
    await deps.persistStatus(driver.matchId, status, faultMessage);
  } catch (persistError) {
    // why: the side-table status write is best-effort bookkeeping — a failure
    // must not turn a clean teardown into an unhandled rejection. The bot_seats
    // row already exists (written at creation), so WP-377's ranked guard still
    // sees the tag; only the status field may lag.
    console.error(
      `[bot-ally] match ${driver.matchId} failed to persist teardown status "${status}": ${persistError.message}`,
    );
  }
}

/**
 * Runs one poll tick: fetch state, decide whether it is a bot seat's turn, and
 * either drive that turn or track idle/abandon.
 *
 * @param {object} driver - The driver object.
 * @param {object} deps - The injected capabilities.
 * @param {{ maxTurns: number, maxIdlePolls: number, maxMoveStepsPerTurn: number }} limits
 * @returns {Promise<void>}
 */
async function runTick(driver, deps, limits) {
  if (driver.stopped) {
    return;
  }

  let state;
  try {
    state = await deps.fetchState(driver.matchId);
  } catch (fetchError) {
    // why: a transient fetch fault (DB blip) is not a reason to tear down — the
    // raw detail stays in the log and the next poll retries.
    console.error(
      `[bot-ally] match ${driver.matchId} state fetch failed transiently: ${fetchError.message}`,
    );
    return;
  }

  if (state === null || state === undefined) {
    // why: WP-426 — an empty fetch is AMBIGUOUS: the bgio store returns empty on
    // BOTH a genuinely reaped match AND a transient Postgres outage (its
    // `resilientFetch` exhausts retries and returns empty to keep the server up).
    // Do NOT teardown on the first empty — tolerate a bounded run so a DB restart
    // recovers with the driver still registered; only a match that stays empty
    // past the window is treated as truly gone. (See BOT_MAX_EMPTY_FETCH_POLLS.)
    await tolerateEmptyFetch(driver, deps, limits.maxEmptyFetchPolls);
    return;
  }
  // why: WP-426 — a real state came back, so the store is reachable; reset the
  // empty-fetch tolerance so the count reflects only CONSECUTIVE empties.
  driver.emptyFetchPolls = 0;
  if (state.ctx.gameover !== undefined) {
    await teardown(driver, deps, BOT_ALLY_STATUS.completed);
    return;
  }

  // why: driver turn-gate — the driver acts ONLY on a bot seat's turn. On the
  // human's turn (seat "0"), or during the lobby phase, it waits and tracks
  // idle progress; it NEVER dispatches for the human seat (the human drives
  // seat 0 over Socket.IO).
  if (!isBotSeatTurn(state, driver.botSeats)) {
    trackIdle(driver, state);
    if (driver.idlePolls >= limits.maxIdlePolls) {
      await teardown(driver, deps, BOT_ALLY_STATUS.abandoned);
    }
    return;
  }

  driver.idlePolls = 0;
  driver.lastStateId = state._stateID;

  const result = await driveBotTurn(driver, deps, state.ctx.currentPlayer, limits.maxMoveStepsPerTurn);
  // why: WP-424 — the driver may have been stopped mid-turn by a SIGTERM
  // graceful shutdown while driveBotTurn was awaiting. If so, do not advance the
  // turn counter or write to the side-table on the way out: the process is
  // tearing down and the new instance now owns this match's revival/status.
  if (driver.stopped) {
    return;
  }
  if (result.kind === 'vanished') {
    // why: WP-426 — `vanished` means an empty fetch DURING the turn (the same
    // ambiguous transient-DB-vs-reaped signal as the top-of-tick empty above), so
    // it gets the SAME tolerance rather than an immediate teardown — a Postgres
    // blip mid-turn no longer kills the driver.
    await tolerateEmptyFetch(driver, deps, limits.maxEmptyFetchPolls);
    return;
  }
  if (result.kind === 'game-over') {
    await teardown(driver, deps, BOT_ALLY_STATUS.completed);
    return;
  }
  if (result.kind === 'faulted') {
    await teardown(driver, deps, BOT_ALLY_STATUS.faulted, result.message);
    return;
  }

  driver.turnCount += 1;
  await maybeResetRevivalCount(driver, deps);
  if (driver.turnCount >= limits.maxTurns) {
    await teardown(driver, deps, BOT_ALLY_STATUS.exhausted);
  }
}

/**
 * Handles an ambiguous empty `fetchState` result: counts it, and tears the
 * driver down as `completed` ONLY once the empties have run consecutively past
 * `maxEmptyFetchPolls` (a genuinely-gone match). A shorter run is a transient DB
 * outage, so the driver stays registered and retries on the next poll.
 *
 * // why: WP-426 / D-24247 — the bgio store returns EMPTY for both a reaped match
 * and an unreachable Postgres (its `resilientFetch` swallows the connection error
 * to keep the server up), so the driver cannot distinguish them from a single
 * empty. The consecutive-count is the distinguisher: a DB restart empties for a
 * bounded stretch then recovers; a truly-vanished match empties forever. The
 * counter resets on any non-empty fetch (in `runTick`), so only a sustained empty
 * run trips the teardown.
 *
 * @param {object} driver - The driver object.
 * @param {object} deps - The injected capabilities.
 * @param {number} maxEmptyFetchPolls - The consecutive-empty tolerance.
 * @returns {Promise<void>}
 */
async function tolerateEmptyFetch(driver, deps, maxEmptyFetchPolls) {
  driver.emptyFetchPolls += 1;
  if (driver.emptyFetchPolls >= maxEmptyFetchPolls) {
    // why: the store has returned empty for the whole tolerance window — treat the
    // match as genuinely gone (reaped / never re-hydrated) and stop polling.
    await teardown(driver, deps, BOT_ALLY_STATUS.completed);
  }
}

/**
 * Resets the side-table `revive_count` to 0 the first time a REVIVED driver
 * completes a bot turn.
 *
 * // why: WP-414 / D-24233 — D-24230's `revive_count` is a LIFETIME counter, so a
 * match that is genuinely drivable but keeps losing its in-memory driver to
 * repeated Postgres-instability restarts burns all MAX_REVIVALS revivals and is
 * then stranded as permanently `faulted` — even though every restart it drives
 * turns fine. Completing a full bot turn is proof the match is NOT permanently
 * wedged, so the lifetime count is cleared; the cap then only strands a match
 * that cannot drive even one turn after revival (the real doomed case). No-ops
 * for a fresh match (initialReviveCount 0) and after the one-shot latch, so this
 * adds at most one extra write per revived driver's lifetime. Best-effort: a
 * failed reset is logged and swallowed (it must not fault an otherwise-healthy
 * turn); the count simply stays until the next revived turn clears it.
 *
 * @param {object} driver - The driver object.
 * @param {object} deps - The injected capabilities.
 * @returns {Promise<void>}
 */
async function maybeResetRevivalCount(driver, deps) {
  if (
    driver.revivalReset ||
    driver.initialReviveCount <= 0 ||
    typeof deps.resetRevivalCount !== 'function'
  ) {
    return;
  }
  // why: latch BEFORE the await so a slow reset write cannot be re-entered by a
  // later successful turn into a second write.
  driver.revivalReset = true;
  try {
    await deps.resetRevivalCount(driver.matchId);
  } catch (resetError) {
    console.error(
      `[bot-ally] match ${driver.matchId} failed to reset revive_count after a successful turn: ${resetError.message}`,
    );
  }
}

/**
 * Advances the idle counter when the match has made no progress since the last
 * poll, resetting it whenever the state id changes.
 *
 * @param {object} driver - The driver object.
 * @param {object} state - The fetched match state.
 */
function trackIdle(driver, state) {
  if (driver.lastStateId === state._stateID) {
    driver.idlePolls += 1;
  } else {
    driver.idlePolls = 0;
    driver.lastStateId = state._stateID;
  }
}

/**
 * Drives a single bot seat's turn, retrying the whole turn exactly once from
 * fresh authoritative state before it is treated as faulted.
 *
 * // why: WP-414 / D-24230 — {@link attemptBotTurn} already exhausts the
 * per-step fault fallback (endTurn → advanceStage) at every wedge, but a
 * transient `getLegalMoves` / stateID race can still surface a spurious fault.
 * `retriedOnce` grants exactly ONE fresh re-attempt of the ENTIRE turn — its
 * `while` condition bounds the retry to a single extra pass — so every fault
 * exit of `attemptBotTurn` (the three `runFaultFallback` sites AND the step-cap
 * exhaustion, which does not call it) is covered by one, and only one, retry. A
 * real wedge faults again on the second pass; the retry re-fetches state, so it
 * is a fresh continuation from current state, not a re-submit of applied steps.
 *
 * @param {object} driver - The driver object.
 * @param {object} deps - The injected capabilities.
 * @param {string} botSeat - The bot seat currently to move.
 * @param {number} maxMoveStepsPerTurn - The per-turn step cap.
 * @returns {Promise<{ kind: 'passed' | 'game-over' | 'vanished' | 'faulted', message?: string }>}
 */
async function driveBotTurn(driver, deps, botSeat, maxMoveStepsPerTurn) {
  let retriedOnce = false;
  let result = await attemptBotTurn(driver, deps, botSeat, maxMoveStepsPerTurn);
  while (result.kind === 'faulted' && !retriedOnce) {
    retriedOnce = true;
    result = await attemptBotTurn(driver, deps, botSeat, maxMoveStepsPerTurn);
  }
  return result;
}

// why: WP-433 — the nine block-all pending-choice flags on `G`. When a bot turn
// faults, logging which of these is set is the single most useful signal for
// telling a getLegalMoves resolution gap (a pending is set) from a transient
// store/_stateID wedge (none set) — the exact discriminator that three rounds of
// server logs could not provide because the fault path logged nothing.
const PENDING_CHOICE_FLAGS = [
  'pendingHeroChoice',
  'pendingKoHeroChoices',
  'pendingOptionalKoRewards',
  'pendingVictoryPileCardPick',
  'pendingDrawOrEmpowered',
  'pendingReturnZeroCostDiscard',
  'pendingDiscardToPlay',
  'pendingOptionalPutBottomHQ',
  'pendingPutAnyNumberBottomHQ',
];

/**
 * Builds a one-line diagnostic of a bot turn's state for a fault log: turn,
 * stage, stateID, remaining economy, hand size, and which block-all pending
 * choices are set. Defensive — never throws (a fault log must never itself
 * crash the tick).
 *
 * @param {object|null|undefined} state - The boardgame.io match state ({ G, ctx, _stateID }).
 * @param {string} botSeat - The bot seat id, for the hand-size read.
 * @returns {string} A compact `key=value` summary, or `state=unavailable`.
 */
export function summarizeBotTurnState(state, botSeat) {
  try {
    if (!state || !state.G || !state.ctx) return 'state=unavailable';
    const gameState = state.G;
    const pendingSet = [];
    for (const flag of PENDING_CHOICE_FLAGS) {
      const value = gameState[flag];
      const isSet = Array.isArray(value) ? value.length > 0 : Boolean(value);
      if (isSet) pendingSet.push(flag);
    }
    const economy = gameState.turnEconomy ?? {};
    const availableAttack = (economy.attack ?? 0) - (economy.spentAttack ?? 0);
    const availableRecruit = (economy.recruit ?? 0) - (economy.spentRecruit ?? 0);
    const handSize = gameState.playerZones?.[botSeat]?.hand?.length ?? '?';
    return [
      `turn=${state.ctx.turn}`,
      `stage=${gameState.currentStage}`,
      `stateId=${state._stateID}`,
      `attack=${availableAttack}`,
      `recruit=${availableRecruit}`,
      `hand=${handSize}`,
      `pending=[${pendingSet.join(',') || 'none'}]`,
    ].join(' ');
  } catch (summaryError) {
    // why: a diagnostic summary must never throw — degrade to a marker instead.
    return `state=unsummarizable (${summaryError.message})`;
  }
}

/**
 * Attempts a single bot seat's turn to completion: repeatedly decides + submits
 * a move until the turn passes to another seat, the match ends, or the turn
 * wedges (fault). Every stalled/erroring step falls through the fault fallback
 * so the human is never permanently blocked on the bot. Wrapped by
 * {@link driveBotTurn}, which grants one whole-turn retry before faulting.
 *
 * @param {object} driver - The driver object.
 * @param {object} deps - The injected capabilities.
 * @param {string} botSeat - The bot seat currently to move.
 * @param {number} maxMoveStepsPerTurn - The per-turn step cap.
 * @returns {Promise<{ kind: 'passed' | 'game-over' | 'vanished' | 'faulted', message?: string }>}
 */
async function attemptBotTurn(driver, deps, botSeat, maxMoveStepsPerTurn) {
  let step = 0;
  // why: WP-433 — retain the most recent fetched state so the step-cap fault
  // (which returns after the loop, out of `state`'s scope) can still log the
  // wedged turn's diagnostic summary.
  let lastStateSnapshot = null;
  while (step < maxMoveStepsPerTurn) {
    step += 1;
    // why: WP-424 — the driver may have been stopped mid-turn by a SIGTERM
    // graceful shutdown while this loop was awaiting a fetch/submit. Bail the
    // instant that happens so a tick in flight at shutdown submits NO further
    // moves — an old draining instance that kept submitting would race the new
    // instance's revived driver on `_stateID` (the freeze this WP fixes).
    if (driver.stopped) {
      return { kind: 'passed' };
    }
    const state = await deps.fetchState(driver.matchId);
    if (state === null || state === undefined) {
      return { kind: 'vanished' };
    }
    lastStateSnapshot = state;
    if (state.ctx.gameover !== undefined) {
      return { kind: 'game-over' };
    }
    if (state.ctx.currentPlayer !== botSeat) {
      // why: the turn moved on (the bot's endTurn passed control to the human /
      // next seat) — the bot's turn is done.
      return { kind: 'passed' };
    }

    let move;
    try {
      move = deps.decide(state, botSeat);
    } catch (decideError) {
      // why: never block the human — a decideTurn throw falls through to the
      // fault fallback; the raw error stays in the log, never in the match.
      console.error(
        `[bot-ally] match ${driver.matchId} seat ${botSeat} decision threw: ${decideError.message}`,
      );
      const recovered = await runFaultFallback(driver, deps, botSeat);
      if (recovered) {
        continue;
      }
      // why: WP-433 — log the fault reason + state so the freeze is diagnosable.
      console.error(
        `[bot-ally] match ${driver.matchId} seat ${botSeat} FAULTED (decision-threw; fallback could not advance): ${summarizeBotTurnState(state, botSeat)}`,
      );
      return { kind: 'faulted', message: BOT_FAULTED_MESSAGE };
    }

    if (move === null || move === undefined) {
      const recovered = await runFaultFallback(driver, deps, botSeat);
      if (recovered) {
        continue;
      }
      // why: WP-433 — the policy produced no move AND the fallback could not
      // advance. If `pending` names a set choice, this is a getLegalMoves
      // resolution gap (the pending has no bot-resolvable move); if `pending` is
      // none, the turn was already end-able and this is a store/_stateID wedge.
      console.error(
        `[bot-ally] match ${driver.matchId} seat ${botSeat} FAULTED (policy-returned-no-move; fallback could not advance): ${summarizeBotTurnState(state, botSeat)}`,
      );
      return { kind: 'faulted', message: BOT_FAULTED_MESSAGE };
    }

    // why: 2026-07-24 — re-submit the move up to BOT_MOVE_SUBMIT_ATTEMPTS times
    // with back-off when it does not advance the state, so a transient DB blip
    // (a write swallowed by the store to keep the server up — safe to re-submit)
    // rides out and the match keeps playing instead of faulting. A genuine wedge
    // (the engine silently rejects the move) never advances across the budget and
    // still falls through to the fault fallback below.
    const previousStateId = state._stateID;
    let moveAdvanced = false;
    for (let submitAttempt = 1; submitAttempt <= BOT_MOVE_SUBMIT_ATTEMPTS; submitAttempt++) {
      await deps.submitMove({ seat: botSeat, moveName: move.name, moveArgs: move.args });
      const after = await deps.fetchState(driver.matchId);
      if (after === null || after === undefined) {
        return { kind: 'vanished' };
      }
      if (after.ctx.gameover !== undefined) {
        return { kind: 'game-over' };
      }
      if (after._stateID !== previousStateId) {
        moveAdvanced = true;
        break;
      }
      // why: not advanced yet — back off before re-submitting so a transient DB
      // blip has time to clear (no back-off after the final attempt).
      if (submitAttempt < BOT_MOVE_SUBMIT_ATTEMPTS) {
        await delay(BOT_MOVE_RETRY_BASE_MS * submitAttempt);
      }
    }
    if (!moveAdvanced) {
      // why: the move never advanced across the retry budget — a genuine wedge
      // (the live engine rejected a move getLegalMoves offered) or an outage
      // longer than the budget. Fall through the fault fallback rather than
      // re-dispatching the same no-op to the step cap.
      const recovered = await runFaultFallback(driver, deps, botSeat);
      if (recovered) {
        continue;
      }
      // why: WP-433 — the engine rejected the offered move across the whole
      // retry budget (a getLegalMoves-offered move the reducer no-ops) or the
      // store never advanced. The offered move name is the key extra signal here.
      console.error(
        `[bot-ally] match ${driver.matchId} seat ${botSeat} FAULTED (move "${move.name}" did not advance across ${BOT_MOVE_SUBMIT_ATTEMPTS} attempts; fallback could not advance): ${summarizeBotTurnState(state, botSeat)}`,
      );
      return { kind: 'faulted', message: BOT_FAULTED_MESSAGE };
    }
  }

  // why: the turn hit the within-turn step cap without passing — treat as a
  // wedged turn and fault rather than spin toward the match turn cap.
  // why: WP-433 — log the wedged turn's diagnostic (via the retained snapshot,
  // since `state` is out of scope here) so a step-cap fault is diagnosable.
  console.error(
    `[bot-ally] match ${driver.matchId} seat ${botSeat} FAULTED (hit the ${maxMoveStepsPerTurn}-step per-turn cap without ending the turn): ${summarizeBotTurnState(lastStateSnapshot, botSeat)}`,
  );
  return { kind: 'faulted', message: BOT_FAULTED_MESSAGE };
}

/**
 * The fault fallback: attempts to move the wedged bot turn forward so control
 * returns to the human. Tries `endTurn` (passes the turn from cleanup), then
 * `advanceStage` (progresses start/main). Reports whether either recovered.
 *
 * @param {object} driver - The driver object.
 * @param {object} deps - The injected capabilities.
 * @param {string} botSeat - The wedged bot seat.
 * @returns {Promise<boolean>} true when the fallback advanced the match (the
 *   caller continues the turn loop); false when the turn is truly wedged (the
 *   caller marks the match bot-faulted).
 */
async function runFaultFallback(driver, deps, botSeat) {
  // why: WP-261 / D-24037 + the never-block-the-human invariant — endTurn ends
  // the bot's turn from cleanup (handing control back to the human); if that is
  // a no-op (not at cleanup), advanceStage progresses the stage so a later step
  // reaches endTurn. Only when NEITHER advances the state is the turn wedged.
  if (await tryDispatchAdvances(driver, deps, botSeat, 'endTurn')) {
    return true;
  }
  if (await tryDispatchAdvances(driver, deps, botSeat, 'advanceStage')) {
    return true;
  }
  return false;
}

/**
 * Dispatches one recovery move and reports whether it advanced the match
 * (state id changed, the turn passed to another seat, or the match ended).
 *
 * @param {object} driver - The driver object.
 * @param {object} deps - The injected capabilities.
 * @param {string} botSeat - The bot seat.
 * @param {string} moveName - The recovery move name (`endTurn` / `advanceStage`).
 * @returns {Promise<boolean>} true when the dispatch made observable progress.
 */
async function tryDispatchAdvances(driver, deps, botSeat, moveName) {
  const before = await deps.fetchState(driver.matchId);
  if (before === null || before === undefined) {
    return true;
  }
  if (before.ctx.gameover !== undefined || before.ctx.currentPlayer !== botSeat) {
    return true;
  }
  const previousStateId = before._stateID;
  await deps.submitMove({ seat: botSeat, moveName, moveArgs: {} });
  const after = await deps.fetchState(driver.matchId);
  if (after === null || after === undefined) {
    return true;
  }
  if (after.ctx.gameover !== undefined || after.ctx.currentPlayer !== botSeat) {
    return true;
  }
  return after._stateID !== previousStateId;
}
