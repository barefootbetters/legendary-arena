/**
 * Side-effect module that installs jsdom globals for component tests that
 * call `@vue/test-utils.mount()` under Vue 3.5.x + Node 22+.
 *
 * Consumers import this as the FIRST line of any component `*.test.ts`:
 *
 *   import '../testing/jsdom-setup';
 *
 * No exports — this file exists for its side effects only.
 */

import { JSDOM } from 'jsdom';

// why: jsdom globals injection mirrors the WP-065
// `packages/vue-sfc-loader/src/loader.test.ts` driver. Under Vue 3.5.x
// (pnpm resolves this against the `^3.4.27` peerDep pin per D-6502),
// `@vue/runtime-dom.resolveRootNamespace` probes `SVGElement` and
// `MathMLElement` during `app.mount()`. Missing any of these globals
// surfaces as a cascade of `ReferenceError` rooted inside the Vue
// runtime, not inside the test — expensive to diagnose without this
// precedent.
const dom = new JSDOM('<!doctype html><html><body></body></html>');

function installGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  });
}

installGlobal('window', dom.window);
installGlobal('document', dom.window.document);
installGlobal('HTMLElement', dom.window.HTMLElement);
installGlobal('Element', dom.window.Element);
installGlobal('Node', dom.window.Node);
installGlobal('SVGElement', dom.window.SVGElement);
installGlobal('MathMLElement', dom.window.MathMLElement);

// why: Node 22+ exposes `globalThis.navigator` as a read-only getter, so a
// plain assignment `globalThis.navigator = dom.window.navigator` throws
// `TypeError: Cannot set property navigator of #<Object> which has only
// a getter`. `Object.defineProperty` bypasses the getter and installs the
// jsdom navigator as a writable / configurable property. Precedent:
// WP-065 `loader.test.ts`; the load-bearing detail there and here.
installGlobal('navigator', dom.window.navigator);
