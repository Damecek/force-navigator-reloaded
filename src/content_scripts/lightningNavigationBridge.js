const LIGHTNING_NAVIGATION_EVENT = 'forceNavigatorNavigate';

/**
 * Injects the page-context Lightning navigation handler.
 *
 * The Aura runtime (`window.$A`) is only accessible from the page context, not
 * from the isolated content script. Injecting a script tag allows the handler
 * to call Aura navigation events, while the content script communicates via
 * DOM events.
 *
 * @returns {void}
 */
export function injectLightningNavigationBridge() {
  const existingScript = document.querySelector(
    'script[data-force-navigator-lightning]'
  );
  if (existingScript) {
    return;
  }
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('lightningNavigation.js');
  script.type = 'text/javascript';
  script.dataset.forceNavigatorLightning = 'true';
  script.addEventListener('load', () => {
    script.remove();
  });
  document.documentElement.appendChild(script);
}

/**
 * Dispatches a Lightning navigation request to the injected handler.
 *
 * The injected handler runs in the page context, so the content script signals
 * it via a cancelable DOM event. If the handler calls `preventDefault`, the
 * navigation was handled by Aura; otherwise, the caller should fall back to
 * direct URL navigation.
 *
 * @param {string} url - Destination URL.
 * @returns {boolean} True when the injected handler handled the navigation.
 */
export function dispatchLightningNavigation(url) {
  if (!url) {
    return false;
  }
  const event = new CustomEvent(LIGHTNING_NAVIGATION_EVENT, {
    detail: url,
    cancelable: true,
  });
  return !document.dispatchEvent(event);
}
