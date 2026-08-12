/**
 * Corruption-safe localStorage envelope helpers for the preferences store.
 *
 * Every read returns null on any failure; every write returns a boolean
 * success flag. Callers handle degradation (typically: log once, continue
 * in-memory). No unhandled throw may reach the viewer's main loop — a
 * preferences failure must never brick the UI.
 */

/**
 * Reads a JSON-parsed value from localStorage. Returns `null` if the key
 * is missing, storage is unavailable (private mode), or the stored string
 * is not valid JSON.
 */
export function readEnvelope(key: string): unknown | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (error) {
    // why: absorbs three distinct failure modes that all collapse to the
    // same caller behavior (treat as "no stored value, use defaults"):
    //   1. `localStorage` missing or access-denied (private browsing,
    //      cookies disabled, file:// origin).
    //   2. Stored string is not valid JSON — caller will back it up to
    //      the backup key before continuing.
    //   3. Any synchronous error surfaced by the storage implementation.
    // Returning null keeps the degradation uniform: the caller never
    // needs to distinguish these cases.
    console.warn("[prefs] readEnvelope failed", error);
    return null;
  }
}

/**
 * Writes a JSON-serialized value to localStorage. Returns `true` on
 * success, `false` on any failure (quota exceeded, private mode,
 * serialization error).
 */
export function writeEnvelope(key: string, value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    // why: absorbs quota-exceeded (the common case on mobile browsers
    // with small storage budgets), private-mode access denial, and the
    // rare serialization failure (circular reference in a user-imported
    // JSON). Caller logs once per session and continues in-memory; the
    // alternative would be a UI that silently loses user edits on the
    // next reload, which is strictly worse.
    console.warn("[prefs] writeEnvelope failed", error);
    return false;
  }
}

/**
 * Best-effort copy of a corrupt blob to a backup key. Silently succeeds
 * on any failure — the backup is a diagnostic convenience for support,
 * not a correctness requirement.
 */
export function backupCorrupt(key: string, backupKey: string): void {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      localStorage.setItem(backupKey, raw);
    }
  } catch (error) {
    // why: the primary load path already failed and defaults are being
    // applied; if the backup copy also fails there is nothing useful to
    // recover. Logging here is purely diagnostic.
    console.warn("[prefs] backupCorrupt failed", error);
  }
}
