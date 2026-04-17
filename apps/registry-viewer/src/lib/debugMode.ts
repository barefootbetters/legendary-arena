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
export const DEBUG_VIEWER =
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("debug");
