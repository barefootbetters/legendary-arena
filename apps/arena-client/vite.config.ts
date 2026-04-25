import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// why: build.sourcemap is enabled so that first-time bootstrap failures are
// diagnosable against the original TypeScript / Vue source rather than the
// minified bundle. Revisit in a future packet once the app grows and the
// sourcemap size becomes a production concern.

// why: the game-engine barrel (`packages/game-engine/dist/index.js`) re-
// exports from `./simulation/par.storage.js`, which imports Node-only
// modules (`node:crypto`, `node:fs/promises`, `node:path`) for PAR artifact
// storage on the server. Vite externalizes `node:*` for browser builds but
// its stub does not expose the named bindings (`mkdir`, `access`, …) that
// par.storage destructures, so Rollup's pre-bundle analysis fails before
// tree-shaking can drop the module. arena-client never uses any
// par.storage export at runtime (WP-090 consumes LegendaryGame only), so
// this plugin replaces the module's contents with an inert stub that still
// advertises the same export names. Arena-client code paths do not call
// any of them; if a future packet does, the stubbed implementations throw
// a loud descriptive error rather than corrupt browser state.
const stubParStoragePlugin: Plugin = {
  name: 'wp-090-stub-par-storage',
  enforce: 'pre',
  load(id) {
    if (!id.includes('par.storage')) {
      return null;
    }
    const message =
      'par.storage is a Node-only server module and must not be called ' +
      'from the browser bundle. If you need this functionality, reach it ' +
      'through a server endpoint, not a direct runtime import.';
    const throwSource = `() => { throw new Error(${JSON.stringify(message)}); }`;
    return [
      'export class ParStoreReadError extends Error {}',
      'export const PAR_ARTIFACT_SOURCES = [];',
      `export const scenarioKeyToFilename = ${throwSource};`,
      `export const scenarioKeyToShard = ${throwSource};`,
      `export const sourceClassRoot = ${throwSource};`,
      `export const computeArtifactHash = ${throwSource};`,
      `export const writeSimulationParArtifact = ${throwSource};`,
      `export const readSimulationParArtifact = ${throwSource};`,
      `export const writeSeedParArtifact = ${throwSource};`,
      `export const readSeedParArtifact = ${throwSource};`,
      `export const buildParIndex = ${throwSource};`,
      `export const lookupParFromIndex = ${throwSource};`,
      `export const loadParIndex = ${throwSource};`,
      `export const resolveParForScenario = ${throwSource};`,
      `export const validateParStore = ${throwSource};`,
      `export const validateParStoreCoverage = ${throwSource};`,
    ].join('\n');
  },
};

export default defineConfig({
  plugins: [stubParStoragePlugin, vue()],
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
});
