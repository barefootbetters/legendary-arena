/**
 * Listen-host wiring for the game server's HTTP listener.
 *
 * boardgame.io's `server.run({ port })` takes a port only, so by default
 * Node listens on every interface. On the droplet, Nginx proxies to
 * 127.0.0.1:3000 and UFW is the only thing keeping :3000 off the internet.
 * Setting `LISTEN_HOST=127.0.0.1` binds the listener to loopback as a
 * second layer: a direct hit on :3000 could otherwise forge
 * `cf-connecting-ip`, which the guest rate limiters trust first.
 *
 * Unset (Render, local dev) keeps today's all-interfaces behavior.
 */

// why: these addresses mean "every interface"; a client cannot connect to
// them, so the server's own loopback calls fall back to `localhost`.
const WILDCARD_HOSTS = new Set(['0.0.0.0', '::', '[::]']);

/**
 * Reads the listen host from the environment.
 *
 * @param {Record<string, string | undefined>} environment - Usually `process.env`.
 * @returns {string | undefined} The trimmed `LISTEN_HOST` value, or
 *   `undefined` when it is unset or blank (listen on every interface).
 */
export function resolveListenHost(environment) {
  const rawValue = environment.LISTEN_HOST;
  if (rawValue === undefined) {
    return undefined;
  }
  const trimmedValue = rawValue.trim();
  if (trimmedValue === '') {
    return undefined;
  }
  return trimmedValue;
}

/**
 * Builds the origin the server uses to call its own native lobby
 * (autoplay, bot-ally, guest joins).
 *
 * When the listener is bound to one address, the loopback calls must target
 * that address: `localhost` can resolve to `::1` first, which a 127.0.0.1-only
 * listener refuses.
 *
 * @param {string | undefined} listenHost - Result of `resolveListenHost`.
 * @param {string} port - The listen port.
 * @returns {string} An `http://host:port` origin.
 */
export function buildLoopbackOrigin(listenHost, port) {
  if (listenHost === undefined || WILDCARD_HOSTS.has(listenHost)) {
    return `http://localhost:${port}`;
  }
  const isBareIpv6 = listenHost.includes(':') && !listenHost.startsWith('[');
  if (isBareIpv6) {
    return `http://[${listenHost}]:${port}`;
  }
  return `http://${listenHost}:${port}`;
}

/**
 * Makes the Koa app's `listen(port, callback)` bind to `listenHost`.
 *
 * boardgame.io calls `app.listen(port, resolve)` inside `server.run()` with
 * no host argument; the SocketIO transport has already replaced
 * `app.listen` with a wrapper that forwards every argument to
 * `http.Server.listen`. Inserting the host here is the one seam that does
 * not fork boardgame.io. No-op when `listenHost` is undefined.
 *
 * @param {{ listen: Function }} koaApp - The `server.app` returned by boardgame.io `Server()`.
 * @param {string | undefined} listenHost - Result of `resolveListenHost`.
 * @returns {void}
 */
export function bindListenToHost(koaApp, listenHost) {
  if (listenHost === undefined) {
    return;
  }
  const originalListen = koaApp.listen;
  koaApp.listen = function listenOnHost(port, callback) {
    return originalListen.call(koaApp, port, listenHost, callback);
  };
}
