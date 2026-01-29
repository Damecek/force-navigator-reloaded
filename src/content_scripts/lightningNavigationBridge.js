const LIGHTNING_NAVIGATION_EVENT = 'forceNavigatorNavigate';

/**
 * Injects the page-context Lightning navigation handler.
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
