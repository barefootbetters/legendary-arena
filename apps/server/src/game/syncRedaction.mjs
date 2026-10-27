/**
 * Outbound `sync` redaction for the boardgame.io socket transport
 * (WP-809 / D-24715).
 *
 * boardgame.io 0.50.2 answers a socket `sync` with
 * `{ state, log, filteredMetadata, initialState }`. Its player-view filter
 * redacts `state` and `log` but passes `initialState` through raw, so any
 * socket that syncs, a spectator with no credentials included, receives the
 * match seed (`initialState.plugins.random.data.seed`) and the unfiltered
 * initial `G` with every deck order. This module drops `initialState` from
 * every outgoing `sync` frame. The client only stores it (for its own
 * `getInitialState()` / debug reset), and nothing in the arena-client reads it.
 */

const SYNC_EVENT_NAME = 'sync';

/**
 * Returns the outgoing socket event arguments with `initialState` removed
 * from a `sync` frame. Every other event passes through unchanged.
 *
 * @param {string} eventName - The socket event name.
 * @param {unknown[]} eventArgs - The event arguments (`[matchID, syncInfo]` for `sync`).
 * @returns {unknown[]} The arguments to emit.
 */
export function redactOutgoingSyncArgs(eventName, eventArgs) {
  if (eventName !== SYNC_EVENT_NAME) {
    return eventArgs;
  }
  const [matchID, syncInfo, ...rest] = eventArgs;
  if (syncInfo === null || typeof syncInfo !== 'object') {
    return eventArgs;
  }
  const redactedSyncInfo = { ...syncInfo };
  delete redactedSyncInfo.initialState;
  return [matchID, redactedSyncInfo, ...rest];
}

/**
 * Installs the `sync` redaction on every game namespace of a boardgame.io
 * server. Call it right after `Server({...})`, before `run()`.
 *
 * @param {{ app: { _io?: { of: (name: string) => unknown } } }} gameServer -
 *   The object `Server({...})` from boardgame.io/server returns.
 * @param {Array<{ name: string }>} games - The same games passed to `Server()`.
 */
export function installSyncRedaction(gameServer, games) {
  const socketServer = gameServer.app._io;
  if (!socketServer) {
    throw new Error(
      'installSyncRedaction found no Socket.IO server on gameServer.app._io. ' +
        'Call it with the object boardgame.io Server() returns, after Server() has run.',
    );
  }
  for (const game of games) {
    const namespace = socketServer.of(game.name);
    // why: boardgame.io sends to one client through `socket.emit(type, ...args)`
    // (its SocketIO TransportAPI `send`), and `sync` is only ever sent that way,
    // to the socket that asked. Wrapping this socket's emit before boardgame.io's
    // 'connection' listener runs covers every sync answer on the namespace.
    namespace.use((socket, nextConnection) => {
      const originalEmit = socket.emit.bind(socket);
      socket.emit = (eventName, ...eventArgs) =>
        originalEmit(eventName, ...redactOutgoingSyncArgs(eventName, eventArgs));
      nextConnection();
    });
  }
}
