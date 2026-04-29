/**
 * debugMode.ts — single execution gate for all dev-only observability in
 * the registry viewer. Introduced by EC-104.
 *
 * `import.meta.env.DEV` is compiled to a literal `false` by Vite in
 * production builds. With DEV as the LEFT operand of `&&`, the right
 * operand (the URLSearchParams construction) is statically unreachable
 * in prod and stripped by dead-code elimination.
 *
 * why: DO NOT reorder the operands. If URLSearchParams appears first it
 * executes on every prod page load before short-circuit evaluation
 * rejects it, and the reference survives DCE — defeating the entire
 * point of this gate.
 *
 * No other file may reference `import.meta.env.DEV` for viewer debugging.
 * Every other file must import `DEBUG_VIEWER` from here.
 */
// why: IIFE + try/catch wraps the original gate so the module loads cleanly
// under node:test (where `import.meta.env` is undefined because Vite is not
// in the loader chain). The gate logic is unchanged: Vite still substitutes
// `import.meta.env.DEV` to literal `false` in prod, making the inner
// expression statically false and letting DCE strip the URLSearchParams
// reference. DO NOT reorder the inner operands — URLSearchParams must remain
// after the env gate (per EC-104) or it executes on every prod page load.
// Required by WP-086 PS-2 Option B (the new node:test runner imports
// devLog.ts, which transitively loads this module).
export const DEBUG_VIEWER = (() => {
  try {
    return import.meta.env.DEV &&
      new URLSearchParams(location.search).has("debug");
  } catch {
    return false;
  }
})();
