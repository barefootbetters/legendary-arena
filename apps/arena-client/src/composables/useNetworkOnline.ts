import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/**
 * Reads the browser's own network flag. A browser with no `navigator` (a
 * non-browser host) counts as online, so nothing is hidden there.
 *
 * @returns False only when the browser reports it has no network.
 */
function readIsOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }
  return navigator.onLine !== false;
}

/**
 * Tracks whether the device has a network, from `navigator.onLine` and the
 * window's `online` / `offline` events. Call it from a component's `setup`.
 *
 * `navigator.onLine` false is reliable (airplane mode, Wi-Fi off); true only
 * means a network interface is up, so a captive portal still reads as online.
 *
 * @returns A ref that is false while the browser reports no network.
 */
export function useNetworkOnline(): Ref<boolean> {
  const isOnline = ref(readIsOnline());

  /** Re-reads the flag after an `online` or `offline` event. */
  function refresh(): void {
    isOnline.value = readIsOnline();
  }

  onMounted(() => {
    // why: the flag can change between setup and mount; read it again once
    // the listeners are in place so no event is missed.
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    refresh();
  });
  onBeforeUnmount(() => {
    window.removeEventListener('online', refresh);
    window.removeEventListener('offline', refresh);
  });

  return isOnline;
}
