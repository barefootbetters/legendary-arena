/**
 * Side-effect entry point consumed via
 * `node --import @legendary-arena/vue-sfc-loader/register`.
 *
 * The single purpose of this file is to install the `.vue` loader
 * hook into the current Node process. It registers `./loader.js` (the
 * emitted JS — this file is itself compiled to `dist/register.js` and
 * resolves `./loader.js` relative to the compiled output).
 */

import { register } from 'node:module';

// why: exposing a single stable `--import` specifier
// (`@legendary-arena/vue-sfc-loader/register`) decouples consumers
// from this package's internal file layout. A future refactor that
// moves `loader.ts` to a different subpath does not break consumer
// `NODE_OPTIONS` strings.
register('./loader.js', import.meta.url);
