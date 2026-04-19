/**
 * Typed read/write composable for the preferences store.
 *
 * Components should reach for this instead of importing the store module
 * directly — the indirection makes swapping the underlying store (e.g. to
 * an injected instance for SSR or for test harnesses) a single-file
 * change rather than a grep-and-replace across every consumer.
 */

import { storeToRefs } from "pinia";
import { usePreferencesStore } from "../store/createPreferencesStore";

export function usePreferences() {
  const store = usePreferencesStore();
  return { ...storeToRefs(store), store };
}
