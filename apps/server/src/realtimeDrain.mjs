/**
 * Shutdown seam for the Socket.IO connections boardgame.io holds open.
 *
 * `http.Server.close(callback)` stops accepting at once but fires its callback
 * only after every open connection has ended. A connected player's Socket.IO
 * websocket never ends on its own, so with even one player online the SIGTERM
 * handler's close callback never ran: systemd waited out `TimeoutStopSec`
 * (30 s) and SIGKILLed the process. The listener was already closed, so every
 * request in those 30 s failed ("Failed to fetch" in the browser). Production
 * deploys on 2026-10-15 at 02:42Z and 02:44Z took 36 s from restart to healthy
 * against a 6 s baseline with nobody connected.
 *
 * `http.Server.closeAllConnections()` does not reach these sockets: an upgraded
 * connection leaves the HTTP server's connection list.
 */

/**
 * Closes every Socket.IO connection so `http.Server.close()` can finish.
 *
 * Closes the engine.io layer rather than disconnecting each socket.io socket:
 * the client then sees `transport close` and reconnects on its own (to the new
 * process after a deploy), while a server-side `disconnect(true)` reports
 * `io server disconnect`, which the Socket.IO client does NOT retry. Matches
 * survive: boardgame.io's store is Postgres-backed, and the arena client
 * re-anchors on reconnect (D-24232).
 *
 * @param {{ engine?: { close: () => void } } | undefined} socketServer - The
 *   socket.io `Server` boardgame.io attached (`server.app._io`). Undefined is
 *   a no-op, so a server started without the socket transport still shuts down.
 * @returns {void}
 */
export function closeRealtimeConnections(socketServer) {
  if (socketServer === undefined || socketServer.engine === undefined) {
    return;
  }
  socketServer.engine.close();
}
