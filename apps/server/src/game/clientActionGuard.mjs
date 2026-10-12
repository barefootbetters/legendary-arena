/**
 * Client action allowlist for the boardgame.io socket transport (D-24701).
 *
 * boardgame.io 0.50's socket `update` handler passes whatever action a client
 * sends straight to `Master.onUpdate`, which checks only that the seat is
 * active and the state id is current, then runs the action through the game
 * reducer. The reducer honours more than player moves:
 *
 * - `GAME_EVENT` runs a flow event (`setPhase`, `endPhase`, `endGame`,
 *   `endTurn`, `setActivePlayers`, ...). The game's `events` config does not
 *   stop it: that config only decides which dispatchers a client is handed,
 *   and the server reducer processes every event name.
 * - `UPDATE`, `SYNC` and `RESET` replace the whole match state with the
 *   action's `state`; `PATCH` applies an arbitrary JSON patch to it.
 * - `UNDO` / `REDO` roll the state back or forward (undo is on by default).
 *
 * Any of these lets a seat skip move validation, and none is re-dispatched by
 * the faithful replay (only `MAKE_MOVE` is), so such a match would also fail
 * score verification. The arena client only ever sends moves, so this guard
 * admits `MAKE_MOVE` and drops every other client `update` before boardgame.io
 * sees it. Server-internal dispatch (autoplay, bot ally) builds its own Master
 * and never passes through the socket, so it is untouched.
 *
 * Wiring only: the guard decides which actions reach the engine, never what a
 * move does.
 */

// why: boardgame.io's action type for a player move (turnOrder.MAKE_MOVE in
// the 0.50 dist). It is the only action type the arena client sends.
const MAKE_MOVE_ACTION_TYPE = 'MAKE_MOVE';

// why: the socket event boardgame.io's SocketIO transport listens on for
// client actions (`socket.on('update', ...)` in boardgame.io/server).
const UPDATE_SOCKET_EVENT = 'update';

// why: the action type is client-controlled text that goes into a server log
// line, so it is clipped to keep one crafted packet from writing a huge line.
const LOGGED_ACTION_TYPE_MAX_LENGTH = 64;

/**
 * Reports whether a client-sent `update` action may reach boardgame.io.
 *
 * @param {unknown} action - The action argument of a socket `update` packet.
 * @returns {boolean} True only for a `MAKE_MOVE` action object.
 */
export function isClientUpdateActionAllowed(action) {
  if (action === null || typeof action !== 'object') {
    return false;
  }
  return action.type === MAKE_MOVE_ACTION_TYPE;
}

/**
 * Builds a short, log-safe label for a rejected action's type. Never includes
 * the payload, which carries the seat's credentials.
 *
 * @param {unknown} action - The rejected action argument.
 * @returns {string} The clipped action type, or a description of its absence.
 */
function describeRejectedActionType(action) {
  if (action === null || typeof action !== 'object') {
    return `a non-object action (${action === null ? 'null' : typeof action})`;
  }
  if (typeof action.type !== 'string') {
    return 'an action with no string type';
  }
  return `"${action.type.slice(0, LOGGED_ACTION_TYPE_MAX_LENGTH)}"`;
}

/**
 * Socket.IO packet middleware: drops a client `update` packet whose action is
 * not a player move, and passes every other packet through unchanged.
 *
 * @param {unknown[]} packet - The incoming event name followed by its args.
 * @param {(error?: Error) => void} nextPacket - Passes the packet on.
 */
export function filterClientUpdatePacket(packet, nextPacket) {
  const [eventName, action, , matchID, playerID] = packet;
  if (eventName !== UPDATE_SOCKET_EVENT || isClientUpdateActionAllowed(action)) {
    nextPacket();
    return;
  }
  // why: the packet is dropped by not calling nextPacket (calling it with an
  // error would make Socket.IO log a missing-handler error instead). The
  // boardgame.io client gets no reply for an `update` either way.
  console.warn(
    `[server] Dropped a client socket update carrying ${describeRejectedActionType(action)} ` +
      `for match ${String(matchID)}, seat ${String(playerID)}: only player moves (MAKE_MOVE) ` +
      'are accepted from clients (D-24701).',
  );
}

/**
 * Installs the client action allowlist on every game namespace of a
 * boardgame.io server. Call it right after `Server({...})`, before `run()`.
 *
 * @param {{ app: { _io?: { of: (name: string) => unknown } } }} gameServer -
 *   The object `Server({...})` from boardgame.io/server returns.
 * @param {Array<{ name: string }>} games - The same games passed to `Server()`.
 */
export function installClientActionGuard(gameServer, games) {
  // why: `app._io` is the Socket.IO server boardgame.io's SocketIO transport
  // attaches inside Server(); boardgame.io itself reads it as
  // `app._io.of(game.name)` to register its handlers, so this is the same
  // namespace its `update` listener lives on.
  const socketServer = gameServer.app._io;
  if (!socketServer) {
    throw new Error(
      'installClientActionGuard found no Socket.IO server on gameServer.app._io. ' +
        'Call it with the object boardgame.io Server() returns, after Server() has run.',
    );
  }
  for (const game of games) {
    const namespace = socketServer.of(game.name);
    // why: namespace middleware runs for every connection before boardgame.io's
    // 'connection' listener attaches its handlers, so each socket gets the
    // packet filter even though it is registered after that listener.
    namespace.use((socket, nextConnection) => {
      socket.use(filterClientUpdatePacket);
      nextConnection();
    });
  }
}
