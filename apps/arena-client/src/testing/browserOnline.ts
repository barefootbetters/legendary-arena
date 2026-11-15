/**
 * Test helpers that flip jsdom's `navigator.onLine` for components that read
 * the network flag (`useNetworkOnline`, D-24851 follow-up). Test-only.
 */

/**
 * Sets the browser's network flag and fires the matching window event.
 *
 * @param isOnline - The flag to report.
 */
export function setBrowserOnline(isOnline: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { value: isOnline, configurable: true });
  window.dispatchEvent(new window.Event(isOnline ? 'online' : 'offline'));
}

/** Removes the test's override so the jsdom default (online) returns. */
export function resetBrowserOnline(): void {
  delete (window.navigator as { onLine?: boolean }).onLine;
}
