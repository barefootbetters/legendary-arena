/**
 * devLog.ts — Development-only console logging helper.
 *
 * Logs are visible only when running via `pnpm dev` (Vite dev server).
 * In production builds, the function is a no-op and the dead code is
 * tree-shaken by Vite's minifier.
 *
 * Usage:
 *   import { devLog } from '../lib/devLog';
 *   devLog('applyFilters', { searchText: searchText.value });
 */

/**
 * Logs a labeled message to the console in development mode only.
 * @param label - Short identifier for the log source (e.g. 'CardGrid', 'Glossary')
 * @param data - Any values to log alongside the label
 */
export function devLog(label: string, ...data: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log(`%c[${label}]`, "color:#7070e0;font-weight:600", ...data);
  }
}
